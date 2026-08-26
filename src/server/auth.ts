import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { usersRepo, LOCK_MINUTES } from "@/server/db/repositories/users";
import { baseAuthConfig } from "./auth.base";

/**
 * Node 端完整认证配置：带真实的 authorize（bcrypt 校验）。
 * Edge（middleware）请使用 auth.base.ts 的 baseAuth。
 *
 * 登录门禁（账号体系升级）：
 * - 锁定中 → 错码 `locked:<剩余分钟>`；
 * - 邮箱未验证 → 错码 `unverified`；
 * - 密码错误 → 失败计数+1，达阈值锁定；不存在/错误统一不泄露区别。
 */

/**
 * NextAuth v5 对客户端只透传错误 `code`（默认泛化为 "CredentialsSignin"），
 * 构造函数参数仅写入 message；故用子类覆写 code 才能把门禁错码传给登录页。
 */
class LoginGateError extends CredentialsSignin {
  constructor(code: string) {
    super();
    this.code = code;
  }
}
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...baseAuthConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;
        const user = usersRepo.findByEmail(email);
        if (!user) return null;
        const left = usersRepo.lockedMinutesLeft(user);
        if (left > 0) throw new LoginGateError(`locked:${left}`);
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
          const justLocked = usersRepo.registerLoginFailure(user.id);
          if (justLocked) throw new LoginGateError(`locked:${LOCK_MINUTES}`);
          return null;
        }
        if (!user.email_verified_at) throw new LoginGateError("unverified");
        usersRepo.clearLoginFailure(user.id);
        return { id: String(user.id), email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
});
