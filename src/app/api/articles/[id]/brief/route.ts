/**
 * 手动触发快速概要（基线分层自动摘要）：
 * 已配置个人概要模型 → 以手动优先级入队（归属当前用户，豁免当日额度检查）；
 * 未配置 → 400 引导去设置页。
 */
import { NextResponse } from "next/server";
import { requireUser } from "@/server/api-utils";
import { articlesRepo } from "@/server/db/repositories/articles";
import { providersRepo } from "@/server/db/repositories/providers";
import { tasksRepo, BRIEF_PRIORITY } from "@/server/db/repositories/tasks";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;
  const article = articlesRepo.findById(Number(id));
  if (!article) return NextResponse.json({ error: "文献不存在" }, { status: 404 });
  if (!providersRepo.get(user.id, "brief_personal")) {
    return NextResponse.json({ error: "请先在设置页配置个人概要模型" }, { status: 400 });
  }
  const taskId = tasksRepo.enqueue("brief", article.id, BRIEF_PRIORITY.manual, user.id);
  return NextResponse.json({ data: { queued: taskId != null, taskId } }, { status: 201 });
}
