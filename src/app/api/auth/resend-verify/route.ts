/**
 * 重发验证邮件：一律返回成功（防账号枚举）。
 * 内部约束：60 秒冷却 + 每日 5 封上限；已验证/不存在/未配置邮件时静默跳过。
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { usersRepo } from "@/server/db/repositories/users";
import { authTokensRepo } from "@/server/db/repositories/auth-tokens";
import { isMailConfigured, sendVerifyEmail } from "@/server/email/mailer";

const COOLDOWN_SEC = 60;
const DAILY_MAX = 5;

const schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  const email = parsed.data.email.trim().toLowerCase();

  const user = usersRepo.findByEmail(email);
  if (user && !user.email_verified_at && isMailConfigured()) {
    const last = authTokensRepo.lastIssuedAt(user.id, "verify");
    const cooled = last && Date.now() - new Date(last + "Z").getTime() < COOLDOWN_SEC * 1000;
    if (!cooled && authTokensRepo.countToday(user.id, "verify") < DAILY_MAX) {
      authTokensRepo.invalidateUserTokens(user.id, "verify");
      const token = authTokensRepo.issue(user.id, "verify");
      await sendVerifyEmail(email, token).catch(() => undefined);
    }
  }
  // 无论实际是否发送，统一返回成功
  return NextResponse.json({ data: { ok: true } });
}
