/** admin 调整用户角色 / 验证状态（不可降级自己） */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/api-utils";
import { usersRepo } from "@/server/db/repositories/users";

const schema = z.object({
  role: z.enum(["admin", "user"]).optional(),
  verified: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;
  const target = usersRepo.findById(Number(id));
  if (!target) return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || (!parsed.data.role && parsed.data.verified === undefined)) {
    return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  }
  if (parsed.data.role) {
    if (target.id === admin.id && parsed.data.role !== "admin") {
      return NextResponse.json({ error: "不能降级自己的管理员权限" }, { status: 400 });
    }
    usersRepo.updateRole(target.id, parsed.data.role);
  }
  if (parsed.data.verified && !target.email_verified_at) {
    usersRepo.markVerified(target.id);
  }
  return NextResponse.json({
    data: {
      id: target.id,
      role: parsed.data.role ?? target.role,
      verified: parsed.data.verified !== undefined ? parsed.data.verified : Boolean(target.email_verified_at),
    },
  });
}
