/** 修改密码：校验旧密码，新密码强度与注册同规则 */
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireUser } from "@/server/api-utils";
import { usersRepo } from "@/server/db/repositories/users";
import { isStrongPassword, PASSWORD_RULE_MSG } from "@/server/security/password";

const schema = z.object({
  oldPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  const row = usersRepo.findById(user.id)!;
  if (!(await bcrypt.compare(parsed.data.oldPassword, row.password_hash))) {
    return NextResponse.json({ error: "当前密码不正确" }, { status: 400 });
  }
  if (!isStrongPassword(parsed.data.newPassword)) {
    return NextResponse.json({ error: PASSWORD_RULE_MSG }, { status: 422 });
  }
  usersRepo.updatePassword(user.id, await bcrypt.hash(parsed.data.newPassword, 10));
  return NextResponse.json({ data: { ok: true } });
}
