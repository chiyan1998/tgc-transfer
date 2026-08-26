/** 修改昵称 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/api-utils";
import { usersRepo } from "@/server/db/repositories/users";

const schema = z.object({ name: z.string().min(1).max(64) });

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "昵称需为 1–64 个字符" }, { status: 400 });
  usersRepo.updateName(user.id, parsed.data.name.trim());
  return NextResponse.json({ data: { name: parsed.data.name.trim() } });
}
