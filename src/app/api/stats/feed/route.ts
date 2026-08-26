/**
 * 信息流统计（M2 迭代意见 1）：
 * 订阅范围内文章总数、已自动摘要数、最近一次抓取时间，供信息流顶部统计行。
 */
import { NextResponse } from "next/server";
import { requireUser } from "@/server/api-utils";
import { articlesRepo } from "@/server/db/repositories/articles";

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  return NextResponse.json({ data: articlesRepo.feedStats(user.id) });
}
