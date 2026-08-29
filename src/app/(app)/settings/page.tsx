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
  // 阅读笔记：Obsidian vault 目录
  const [vaultPath, setVaultPath] = useState("");
  const [vaultMsg, setVaultMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [vaultBusy, setVaultBusy] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d?.data) {
          setAutoRefresh(d.data.autoRefreshOnLogin);
          setIntervalMin(d.data.refreshIntervalMin);
          setDefaultLang(d.data.defaultLang);
          setVaultPath(d.data.obsidianVaultPath ?? "");
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

  async function saveVault() {
    setVaultBusy(true);
    setVaultMsg(null);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ obsidianVaultPath: vaultPath.trim() || null }),
    });
    setVaultBusy(false);
    setVaultMsg(res.ok ? { ok: true, text: "已保存" } : { ok: false, text: "保存失败" });
  }

  async function checkVault() {
    const p = vaultPath.trim();
    if (!p) {
      setVaultMsg({ ok: false, text: "请先填写目录路径" });
      return;
    }
    setVaultBusy(true);
    setVaultMsg(null);
    const res = await fetch("/api/settings/vault-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: p }),
    });
    const d = await res.json().catch(() => null);
    setVaultBusy(false);
    if (!res.ok || !d?.data) {
      setVaultMsg({ ok: false, text: String(d?.error ?? "检查失败") });
      return;
    }
    setVaultMsg(d.data.ok ? { ok: true, text: "校验通过：是一个有效的 Obsidian 仓库" } : { ok: false, text: d.data.reason });
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
          <h2 className="mb-3 font-semibold">阅读笔记 · Obsidian 目录</h2>
          <p className="mb-3 text-sm text-stone-500">
            填写本机 Obsidian 仓库（vault）根目录，后续自动生成的阅读笔记会写入这里。
            校验仅在应用运行于本机时有效；云端部署后无法访问你的本地目录。
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={vaultPath}
              onChange={(e) => {
                setVaultPath(e.target.value);
                setVaultMsg(null);
              }}
              placeholder="例如 /Users/you/Documents/MyVault"
              className="w-96 max-w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm focus:border-amber-500 focus:outline-none"
            />
            <button
              onClick={saveVault}
              disabled={vaultBusy}
              className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
            >
              保存
            </button>
            <button
              onClick={checkVault}
              disabled={vaultBusy}
              className="rounded-lg border border-amber-500 px-4 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
            >
              {vaultBusy ? "检查中…" : "检查"}
            </button>
          </div>
          {vaultMsg && (
            <p className={`mt-2 text-sm ${vaultMsg.ok ? "text-green-600" : "text-red-600"}`}>{vaultMsg.text}</p>
          )}
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
