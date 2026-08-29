/**
 * 基线源标记（基线分层自动摘要）：仅 admin 可切换。
 * 基线源的抓取与摘要全部由开发者全局概要模型承担。
 * 设为基线：存量无概要文章全部回填入队；取消基线：作废未开始的基线任务。
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/api-utils";
import { sourcesRepo } from "@/server/db/repositories/sources";
import { articlesRepo } from "@/server/db/repositories/articles";
import { tasksRepo, BRIEF_PRIORITY } from "@/server/db/repositories/tasks";

const bodySchema = z.object({ baseline: z.boolean() });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "仅管理员可设置基线源" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const source = sourcesRepo.findById(Number(id));
  if (!source) return NextResponse.json({ error: "源不存在" }, { status: 404 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  sourcesRepo.setBaseline(source.id, parsed.data.baseline);

  // 回填：存量无概要文章以基线优先级入队（已有未完成任务的自动跳过）；
  // 历史遗留的低优先级个人任务升级为基线任务，确保切基线后由全局模型消化；
  // 升级数计入 enqueued（用户视角新增待摘要数不变，但归属切为基线）
  let enqueued = 0;
  let cancelled = 0;
  if (parsed.data.baseline) {
    for (const articleId of articlesRepo.listUnbriefedIds(source.id)) {
      if (tasksRepo.enqueue("brief", articleId, BRIEF_PRIORITY.baseline) !== null) enqueued++;
    }
    enqueued += tasksRepo.upgradeToBaselineForSource(source.id);
  } else {
    cancelled = tasksRepo.cancelPendingBaselineForSource(source.id);
  }
  return NextResponse.json({ data: { id: source.id, isBaseline: parsed.data.baseline, enqueued, cancelled } });
}
