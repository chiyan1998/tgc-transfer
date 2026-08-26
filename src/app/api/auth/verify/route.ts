/**
 * 邮箱验证落地：消费一次性 token，置验证时间，重定向回登录页。
 * 失败（过期/已用/无效）不泄露细节，统一引导重新注册或重发。
 */
import { NextResponse } from "next/server";
import { authTokensRepo } from "@/server/db/repositories/auth-tokens";
import { usersRepo } from "@/server/db/repositories/users";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") ?? "";
  const userId = token ? authTokensRepo.consume(token, "verify") : null;
  if (userId !== null) {
    usersRepo.markVerified(userId);
    return NextResponse.redirect(new URL("/login?verified=1", req.url));
  }
  return NextResponse.redirect(new URL("/login?verify=failed", req.url));
}
