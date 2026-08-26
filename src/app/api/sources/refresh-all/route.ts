import { NextResponse } from "next/server";
import { requireUser } from "@/server/api-utils";
import { fetchAllSources } from "@/server/ingest";

let lastRefreshAll = 0;

/** 手动刷新全部订阅源（防抖 60s，见 api-design §9 429） */
export async function POST() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (Date.now() - lastRefreshAll < 60_000) {
    return NextResponse.json({ error: "刷新过于频繁，请稍后再试" }, { status: 429 });
  }
  lastRefreshAll = Date.now();
  const results = await fetchAllSources();
  return NextResponse.json({ data: { results } });
}
