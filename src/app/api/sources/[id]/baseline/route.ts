/**
 * 基线源标记（基线分层自动摘要）：仅 admin 可切换。
 * 基线源的抓取与摘要全部由开发者全局概要模型承担。
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/api-utils";
import { sourcesRepo } from "@/server/db/repositories/sources";

const bodySchema = z.object({ baseline: z.boolean() });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "仅管理员可设置基线源" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const source = sourcesRepo.findById(Number(id));
  if (!source) return NextResponse.json({ error: "源不存在" }, { status: 404 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  sourcesRepo.setBaseline(source.id, parsed.data.baseline);
  return NextResponse.json({ data: { id: source.id, isBaseline: parsed.data.baseline } });
}
