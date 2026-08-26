"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthLayout } from "@/components/AuthLayout";

/**
 * 注册（账号体系升级）：确认密码 + 强度提示（≥8 位且含字母与数字）+ 服务条款勾选；
 * 成功后不再自动登录，跳转 /verify-email 引导查收验证邮件。
 */
export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const strongEnough = password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    if (!strongEnough) {
      setError("密码需至少 8 位，且同时包含字母与数字");
      return;
    }
    if (!agree) {
      setError("请先阅读并同意服务条款");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(String(data.error ?? "注册失败"));
      return;
    }
    // 引导去验证邮箱（邮箱经 URL 参数带入，仅用于本地展示与重发）
    router.push(`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`);
  }

  const input =
    "w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-amber-500 focus:outline-none";

  return (
    <AuthLayout>
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-3">
        <h1 className="text-xl font-bold">注册</h1>
        <input required maxLength={64} placeholder="昵称" value={name} onChange={(e) => setName(e.target.value)} className={input} />
        <input type="email" required placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        <input
          type="password"
          required
          placeholder="密码（至少 8 位，含字母与数字）"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={input}
        />
        {password && !strongEnough && (
          <p className="text-xs text-amber-600">密码需至少 8 位，且同时包含字母与数字</p>
        )}
        <input
          type="password"
          required
          placeholder="确认密码"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={input}
        />
        <label className="flex items-start gap-1.5 text-xs text-stone-500">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 accent-amber-500" />
          <span>
            我已阅读并同意
            <Link href="/about" target="_blank" className="text-amber-600 hover:underline">
              服务条款与平台说明
            </Link>
          </span>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={loading}
          className="w-full rounded-lg bg-amber-500 py-2.5 font-medium text-white hover:bg-amber-600 disabled:opacity-50"
        >
          {loading ? "注册中…" : "注册"}
        </button>
        <p className="text-center text-sm text-stone-500">
          已有账号？
          <Link href="/login" className="text-amber-600 hover:underline">
            登录
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
