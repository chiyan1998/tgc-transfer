import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/api-utils";
import { statesRepo } from "@/server/db/repositories/articles";

const bodySchema = z.object({ articleIds: z.array(z.number().int()).min(1).max(100) });

/** POST 批量标记已读（打开卡片详情时上报） */
export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  statesRepo.markRead(Number(user.id), parsed.data.articleIds);
  return NextResponse.json({ data: { ok: true } });
}
