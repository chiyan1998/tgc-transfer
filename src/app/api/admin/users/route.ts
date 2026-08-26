/**
 * admin 用户管理：列表 / 创建账号（仅 admin，403 拦截）。
 * 创建的账号直接已验证；随机密码一次性回显，由管理员线下告知后用户自行改密。
 */
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireAdmin } from "@/server/api-utils";
import { usersRepo } from "@/server/db/repositories/users";

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const users = usersRepo.listAll().map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    verified: Boolean(u.email_verified_at),
    createdAt: u.created_at,
  }));
  return NextResponse.json({ data: { users } });
}

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(64).default(""),
  role: z.enum(["admin", "user"]).default("user"),
});

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  const email = parsed.data.email.trim().toLowerCase();
  if (usersRepo.findByEmail(email)) {
    return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });
  }
  // 随机初始密码：含字母与数字，满足强度规则
  const initialPassword = `${randomBytes(6).toString("base64url")}1A`;
  const user = usersRepo.create({
    email,
    passwordHash: await bcrypt.hash(initialPassword, 10),
    name: parsed.data.name.trim() || email.split("@")[0],
    role: parsed.data.role,
    verified: true,
  });
  return NextResponse.json(
    { data: { id: user.id, email, initialPassword } },
    { status: 201 }
  );
}
