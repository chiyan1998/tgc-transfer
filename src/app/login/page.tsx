"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { AuthLayout } from "@/components/AuthLayout";

/**
 * 登录（账号体系升级）：
 * 错误码映射——`unverified` 显示重发验证邮件入口；`locked:<分钟>` 显示锁定剩余时间；
 * 其余统一「邮箱或密码不正确」（防枚举）。
 * 注：NextAuth v5 的 redirect:false 模式只回传泛化的 "CredentialsSignin"，
 * 自定义门禁错码仅在重定向回调的 `code` 参数中，故用重定向式登录并从 URL 读取。
 */
function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resendMsg, setResendMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // 验证落地回跳提示
  const justVerified = params.get("verified") === "1";
  const verifyFailed = params.get("verify") === "failed";

  // 登录失败回跳后：error 被泛化为 CredentialsSignin，真实门禁码在 code 参数
  const code = params.get("error") ? params.get("code") ?? "" : "";
  const unverified = code === "unverified";
  const lockedMin = code.startsWith("locked:") ? code.slice(7) : "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // 重定向式登录：失败回 /login?error=…&code=…，成功跳 from 目标页（默认 /feed）
    await signIn("credentials", { email, password, redirectTo: params.get("from") || "/feed" });
  }

  async function resend() {
    setResendMsg("");
    await fetch("/api/auth/resend-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => undefined);
    setResendMsg("验证邮件已发送（如已发送过需等待 60 秒冷却），请查收收件箱与垃圾邮件夹。");
  }

  const input =
    "w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-amber-500 focus:outline-none";

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
      <h1 className="text-xl font-bold">登录</h1>
      {justVerified && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">邮箱验证成功，请登录。</p>}
      {verifyFailed && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          验证链接无效或已过期，请重新注册或在登录后重发验证邮件。
        </p>
      )}
      <input type="email" required placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
      <input
        type="password"
        required
        placeholder="密码"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={input}
      />
      {code && !unverified && !lockedMin && (
        <p className="text-sm text-red-600">邮箱或密码不正确</p>
      )}
      {lockedMin && (
        <p className="text-sm text-red-600">登录失败次数过多，账号已锁定，请 {lockedMin} 分钟后再试。</p>
      )}
      {unverified && (
        <p className="text-sm text-red-600">该邮箱尚未验证，请查收验证邮件或重发。</p>
      )}
      {unverified && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={resend}
            className="rounded-lg border border-amber-300 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50"
          >
            重发验证邮件
          </button>
          {resendMsg && <p className="text-xs text-stone-500">{resendMsg}</p>}
        </div>
      )}
      <button
        disabled={loading}
        className="w-full rounded-lg bg-amber-500 py-2.5 font-medium text-white hover:bg-amber-600 disabled:opacity-50"
      >
        {loading ? "登录中…" : "登录"}
      </button>
      <div className="flex items-center justify-between text-sm text-stone-500">
        <p>
          还没有账号？
          <Link href="/register" className="text-amber-600 hover:underline">
            注册
          </Link>
        </p>
        <span title="本期暂不提供自助找回，请联系管理员重置密码">忘记密码？</span>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <AuthLayout>
        <LoginForm />
      </AuthLayout>
    </Suspense>
  );
}
