import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/api-utils";
import { statesRepo } from "@/server/db/repositories/articles";

const bodySchema = z.object({ starred: z.boolean() });

/** POST 收藏/取消收藏文献 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  statesRepo.setStarred(Number(user.id), Number(id), parsed.data.starred);
  return NextResponse.json({ data: { starred: parsed.data.starred } });
}
