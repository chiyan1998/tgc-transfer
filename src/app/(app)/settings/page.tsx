"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { LlmProviderSettings } from "@/components/LlmProviderSettings";
import { AccountSettings, type AccountInfo } from "@/components/AccountSettings";
import { AdminUsers } from "@/components/AdminUsers";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [intervalMin, setIntervalMin] = useState(60);
  const [defaultLang, setDefaultLang] = useState("zh");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<AccountInfo | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d?.data) {
          setAutoRefresh(d.data.autoRefreshOnLogin);
          setIntervalMin(d.data.refreshIntervalMin);
          setDefaultLang(d.data.defaultLang);
          if (d.data.account) setAccount(d.data.account);
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaved("");
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        autoRefreshOnLogin: autoRefresh,
        refreshIntervalMin: intervalMin,
        defaultLang,
      }),
    });
    setSaved(res.ok ? "已保存" : "保存失败");
    setTimeout(() => setSaved(""), 3000);
  }

  if (loading) return <p className="text-stone-400">加载中…</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">设置</h1>

      {account && (
        <div className="mb-6 rounded-xl border border-stone-200 bg-white p-6">
          <AccountSettings account={account} />
        </div>
      )}

      <div className="space-y-6 rounded-xl border border-stone-200 bg-white p-6">
        <div>
          <h2 className="mb-3 font-semibold">刷新</h2>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            登录时自动刷新订阅源
          </label>
          <label className="mt-3 block text-sm text-stone-700">
            自动刷新频率
            <select
              value={intervalMin}
              onChange={(e) => setIntervalMin(Number(e.target.value))}
              className="ml-3 rounded-lg border border-stone-300 bg-white px-2 py-1.5"
            >
              <option value={15}>每 15 分钟</option>
              <option value={30}>每 30 分钟</option>
              <option value={60}>每 1 小时</option>
              <option value={180}>每 3 小时</option>
              <option value={720}>每 12 小时</option>
            </select>
          </label>
          <p className="mt-2 text-xs text-stone-400">后台调度器每 5 分钟扫描一次，到期的源才会真正抓取。</p>
        </div>

        <div>
          <h2 className="mb-3 font-semibold">语言</h2>
          <select
            value={defaultLang}
            onChange={(e) => setDefaultLang(e.target.value)}
            className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="zh">中文（概要默认中文）</option>
            <option value="en">English</option>
          </select>
        </div>

        <div>
          <h2 className="mb-3 font-semibold">阅读笔记（预留）</h2>
          <p className="text-sm text-stone-500">
            Obsidian vault 目录将在阅读笔记平台开发完成后启用，当前无需配置。
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={save} className="rounded-lg bg-amber-500 px-6 py-2 text-sm font-medium text-white hover:bg-amber-600">
            保存
          </button>
          {saved && <span className="text-sm text-green-600">{saved}</span>}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-stone-200 bg-white p-6">
        <LlmProviderSettings />
      </div>

      {account?.role === "admin" && (
        <div className="mt-6 rounded-xl border border-stone-200 bg-white p-6">
          <AdminUsers selfId={session?.user?.id ? Number(session.user.id) : undefined} />
        </div>
      )}
    </div>
  );
}
