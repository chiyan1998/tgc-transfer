import { NextResponse } from "next/server";
import { requireUser } from "@/server/api-utils";
import { sourcesRepo } from "@/server/db/repositories/sources";
import { fetchSource } from "@/server/ingest";

/** 手动刷新单个源 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;
  const source = sourcesRepo.findById(Number(id));
  if (!source) return NextResponse.json({ error: "源不存在" }, { status: 404 });
  const result = await fetchSource(source);
  return NextResponse.json({ data: result });
}
