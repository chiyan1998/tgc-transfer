/**
 * 注册（账号体系升级）：创建未验证账号 → 签发验证 token → 发验证邮件。
 * 不自动登录；SMTP 未配置时明确降级；内存级 IP 频控（每小时 10 次）。
 */
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { usersRepo } from "@/server/db/repositories/users";
import { authTokensRepo } from "@/server/db/repositories/auth-tokens";
import { isMailConfigured, sendVerifyEmail } from "@/server/email/mailer";
import { isStrongPassword, PASSWORD_RULE_MSG } from "@/server/security/password";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(64).default(""),
});

// 内存级 IP 频控：每 IP 每小时最多 10 次注册
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const ipHits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_LIMIT) {
    ipHits.set(ip, hits);
    return true;
  }
  hits.push(now);
  ipHits.set(ip, hits);
  return false;
}

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export async function POST(req: Request) {
  if (process.env.ALLOW_REGISTRATION === "false") {
    return NextResponse.json({ error: "注册已关闭，请联系管理员创建账号" }, { status: 403 });
  }
  if (rateLimited(clientIp(req))) {
    return NextResponse.json({ error: "注册过于频繁，请稍后再试" }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体无效" }, { status: 422 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数校验失败", fields: parsed.error.flatten() }, { status: 422 });
  }
  const { email, password, name } = parsed.data;
  if (!isStrongPassword(password)) {
    return NextResponse.json({ error: PASSWORD_RULE_MSG }, { status: 422 });
  }
  const normalized = email.trim().toLowerCase();
  if (usersRepo.findByEmail(normalized)) {
    return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });
  }
  if (!isMailConfigured()) {
    return NextResponse.json({ error: "邮件服务未配置，暂时无法发送验证邮件，请联系管理员" }, { status: 503 });
  }
  // 第一个注册的用户成为管理员（对应 ADMIN_EMAIL 场景的简化）
  const isFirst = usersRepo.count() === 0;
  const role = isFirst || normalized === (process.env.ADMIN_EMAIL ?? "").toLowerCase() ? "admin" : "user";
  const user = usersRepo.create({
    email: normalized,
    passwordHash: await bcrypt.hash(password, 10),
    name: name.trim() || normalized.split("@")[0],
    role,
    verified: false,
  });
  authTokensRepo.invalidateUserTokens(user.id, "verify");
  const token = authTokensRepo.issue(user.id, "verify");
  try {
    await sendVerifyEmail(normalized, token);
  } catch {
    return NextResponse.json({ error: "验证邮件发送失败，请稍后重试或联系管理员" }, { status: 502 });
  }
  return NextResponse.json({ data: { needVerify: true, email: normalized } }, { status: 201 });
}
