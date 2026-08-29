import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/api-utils";
import { previewBatchBrief } from "@/server/pipeline/batch-brief";

const body = z.object({
  sourceIds: z.array(z.number().int().positive()).min(1).max(100),
  range: z.enum(["today", "week", "month", "quarter", "halfyear", "all"]).default("all"),
});

/** 批量摘要预览：返回将入队的篇数构成（不落库） */
export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "参数校验失败" }, { status: 422 });
  const result = previewBatchBrief(user.id, parsed.data.sourceIds, parsed.data.range);
  return NextResponse.json({ data: result });
}
