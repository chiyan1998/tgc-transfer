"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthLayout } from "@/components/AuthLayout";

/**
 * 验证邮件引导页（账号体系升级，公开页）：
 * 注册成功后跳转至此；支持重发（60 秒冷却倒计时，服务端另有每日上限）。
 */
function VerifyEmailContent() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const [cooldown, setCooldown] = useState(60);
  const [msg, setMsg] = useState("");

  // 刚注册跳转过来时默认 60 秒冷却（注册时已发过一封）
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function resend() {
    setMsg("");
    await fetch("/api/auth/resend-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => undefined);
    setMsg("验证邮件已发送，请查收收件箱与垃圾邮件夹。");
    setCooldown(60);
  }

  return (
    <div className="w-full max-w-sm space-y-4 text-center">
      <div className="text-5xl">📮</div>
      <h1 className="text-xl font-bold">验证你的邮箱</h1>
      <p className="text-sm leading-relaxed text-stone-500">
        {email ? (
          <>
            验证邮件已发送至 <span className="font-medium text-stone-700">{email}</span>，
            请在 24 小时内点击邮件中的链接激活账号。
          </>
        ) : (
          "请先完成注册，我们会向你的邮箱发送验证邮件。"
        )}
      </p>
      {msg && <p className="text-sm text-green-600">{msg}</p>}
      <div className="flex flex-col gap-2">
        {email && (
          <button
            onClick={resend}
            disabled={cooldown > 0}
            className="rounded-lg border border-amber-300 px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-50"
          >
            {cooldown > 0 ? `重新发送（${cooldown}s）` : "重新发送验证邮件"}
          </button>
        )}
        <Link href="/login" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600">
          已完成验证？去登录
        </Link>
      </div>
      <p className="text-xs text-stone-400">没有收到邮件？检查垃圾邮件夹，或稍后重发。</p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <AuthLayout>
        <VerifyEmailContent />
      </AuthLayout>
    </Suspense>
  );
}
