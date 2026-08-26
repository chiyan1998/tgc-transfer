import { NextResponse } from "next/server";
import { requireUser } from "@/server/api-utils";
import { searchJournals } from "@/server/ingest/adapters/crossref";
import { upstreamErrorCategory } from "@/server/security/mask";

export async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ data: { journals: [] } });
  try {
    const journals = await searchJournals(q);
    return NextResponse.json({ data: { journals } });
  } catch (e) {
    return NextResponse.json({ error: "上游检索失败", upstream: upstreamErrorCategory(e) }, { status: 502 });
  }
}
