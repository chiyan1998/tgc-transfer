/**
 * 个人自动摘要额度偏好（基线分层自动摘要）：
 * GET 返回每日上限、优先源、当日已消耗篇数；
 * PUT 校验上限范围与优先源必须全部为当前用户已订阅源。
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/api-utils";
import { quotaRepo } from "@/server/db/repositories/quota";
import { subscriptionsRepo } from "@/server/db/repositories/sources";
import { usageRepo } from "@/server/db/repositories/usage";

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const prefs = quotaRepo.get(user.id);
  return NextResponse.json({
    data: {
      briefDailyCap: prefs.briefDailyCap,
      prioritySourceIds: prefs.prioritySourceIds,
      usedToday: usageRepo.countBriefTodayForUser(user.id),
    },
  });
}

const bodySchema = z.object({
  briefDailyCap: z.number().int().min(0).max(1000),
  prioritySourceIds: z.array(z.number().int()).max(50),
});

export async function PUT(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  const subscribed = new Set(subscriptionsRepo.listByUser(user.id).map((s) => s.id));
  const ids = [...new Set(parsed.data.prioritySourceIds)];
  if (ids.some((sid) => !subscribed.has(sid))) {
    return NextResponse.json({ error: "优先源必须是已订阅的源" }, { status: 400 });
  }
  const prefs = quotaRepo.set(user.id, { briefDailyCap: parsed.data.briefDailyCap, prioritySourceIds: ids });
  return NextResponse.json({ data: prefs });
}
