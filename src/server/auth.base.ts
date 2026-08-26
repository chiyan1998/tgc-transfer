import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

/**
 * NextAuth 基础配置（无数据库依赖）：
 * middleware 运行于 Edge，不能引入 better-sqlite3，故单独提供此配置只做会话解析。
 * authorize 校验在 Node 端由 auth.ts 的完整配置负责。
 */
export const baseAuthConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // Edge 上下文永不会执行登录动作，此处仅为配置完整性
      async authorize() {
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "user";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? "");
        session.user.role = (token.role as "admin" | "user") ?? "user";
      }
      return session;
    },
  },
};

export const baseAuth = NextAuth(baseAuthConfig);
