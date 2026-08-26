import { NextResponse } from "next/server";
import { requireUser } from "@/server/api-utils";
import { subscriptionsRepo } from "@/server/db/repositories/sources";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;
  subscriptionsRepo.unsubscribe(user.id, Number(id));
  return NextResponse.json({ data: { ok: true } });
}
