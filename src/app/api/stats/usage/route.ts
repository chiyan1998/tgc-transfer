/**
 * Token 消耗统计（M1 迭代意见 6.2）：
 * 按日 × 4 时段聚合 + 今日/近 7 日/累计总量，供订阅中心仪表盘热力图使用。
 */
import { NextResponse } from "next/server";
import { requireUser } from "@/server/api-utils";
import { usageRepo } from "@/server/db/repositories/usage";

export async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const daysRaw = Number(new URL(req.url).searchParams.get("days") ?? "90");
  const days = Number.isFinite(daysRaw) ? Math.min(Math.max(daysRaw, 7), 365) : 90;
  return NextResponse.json({
    data: {
      days,
      cells: usageRepo.aggregateByDaySlot(days),
      totals: usageRepo.totals(),
    },
  });
}
