"use client";

import { useCallback, useEffect, useState } from "react";
import { fmtBeijing } from "@/lib/time";

interface JournalHit {
  issn: string;
  name: string;
  publisher: string;
}

interface ArxivCat {
  id: string;
  label: string;
}

interface SubscribedSource {
  id: number;
  kind: string;
  identifier: string;
  name: string;
  publisher: string | null;
  is_baseline: number;
  last_fetched_at: string | null;
  lastFetch: { new_count: number; started_at: string; error: string | null } | null;
}

interface UsageData {
  days: number;
  cells: { date: string; slot: number; tokens: number }[];
  totals: { today: number; week: number; all: number };
}

const SLOT_LABELS = ["深夜 0-6", "上午 6-12", "下午 12-18", "晚间 18-24"];

/** Token 消耗仪表盘：今日大数字 + 日 × 4 时段热力图（悬停显示具体消耗） */
function UsageDashboard() {
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    fetch("/api/stats/usage?days=90")
      .then((r) => r.json())
      .then((d) => setUsage(d?.data ?? null))
      .catch(() => undefined);
  }, []);

  if (!usage) return null;

  const days = usage.days;
  const today = new Date();
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  const cellMap = new Map<string, number>();
  let max = 0;
  for (const c of usage.cells) {
    const key = `${c.date}-${c.slot}`;
    cellMap.set(key, (cellMap.get(key) ?? 0) + c.tokens);
    max = Math.max(max, cellMap.get(key)!);
  }
  const fmt = (n: number) => n.toLocaleString("zh-CN");
  /** 深浅 5 档 */
  const levelCls = (v: number) => {
    if (v === 0) return "bg-stone-100";
    const lv = max > 0 ? v / max : 0;
    if (lv <= 0.25) return "bg-amber-200";
    if (lv <= 0.5) return "bg-amber-400";
    if (lv <= 0.75) return "bg-amber-500";
    return "bg-amber-600";
  };

  return (
    <section className="mb-8 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-semibold">仪表盘 · Token 消耗</h2>
          <p className="mt-1 text-xs text-stone-400">快速概要等 LLM 任务的 Token 消耗统计（近 {days} 天）</p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-2xl font-bold text-amber-600">{fmt(usage.totals.today)}</p>
            <p className="text-xs text-stone-400">今日</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-stone-700">{fmt(usage.totals.week)}</p>
            <p className="text-xs text-stone-400">近 7 日</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-stone-700">{fmt(usage.totals.all)}</p>
            <p className="text-xs text-stone-400">累计</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="flex gap-1">
          <div className="flex shrink-0 flex-col justify-between py-0.5 text-[10px] leading-[14px] text-stone-400">
            {SLOT_LABELS.map((s) => (
              <span key={s} className="h-[14px]">
                {s}
              </span>
            ))}
          </div>
          <div className="flex gap-[2px]">
            {dates.map((date) => (
              <div key={date} className="flex flex-col gap-[2px]">
                {[0, 1, 2, 3].map((slot) => {
                  const v = cellMap.get(`${date}-${slot}`) ?? 0;
                  return (
                    <div key={slot} className="group relative">
                      <div className={`h-[14px] w-[7px] rounded-[2px] ${levelCls(v)}`} />
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-stone-800 px-2 py-1 text-[10px] text-white group-hover:block">
                        {date} {SLOT_LABELS[slot]}：{fmt(v)} Token
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-2 text-right text-[10px] text-stone-300">← 近 {days} 天（左早右近）</p>
    </section>
  );
}

export function Sources() {
  const [subscribed, setSubscribed] = useState<SubscribedSource[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<JournalHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [arxivCats, setArxivCats] = useState<ArxivCat[]>([]);
  const [message, setMessage] = useState("");

  const loadSubscribed = useCallback(async () => {
    const res = await fetch("/api/sources");
    const data = await res.json().catch(() => null);
    if (res.ok && data?.data) {
      setSubscribed(data.data.sources);
      setIsAdmin(Boolean(data.data.isAdmin));
    }
  }, []);

  useEffect(() => {
    loadSubscribed();
    fetch("/api/sources/arxiv/categories")
      .then((r) => r.json())
      .then((d) => setArxivCats(d?.data?.categories ?? []))
      .catch(() => undefined);
  }, [loadSubscribed]);

  // 期刊搜索防抖
  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/sources/journals/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json().catch(() => null);
      setSearching(false);
      if (res.ok) setHits(data?.data?.journals ?? []);
    }, 500);
    return () => clearTimeout(t);
  }, [query]);

  async function subscribe(payload: { kind: string; identifier: string; name: string; publisher?: string }) {
    setMessage("");
    const res = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setMessage(String(data?.error ?? "订阅失败"));
      return;
    }
    setMessage(`已订阅「${payload.name}」，正在后台抓取首批文章…`);
    await loadSubscribed();
  }

  async function unsubscribe(id: number) {
    await fetch(`/api/sources/${id}`, { method: "DELETE" });
    await loadSubscribed();
  }

  async function refreshOne(id: number) {
    setMessage("正在刷新…");
    const res = await fetch(`/api/sources/${id}/refresh`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setMessage(res.ok ? `刷新完成，新增 ${data?.data?.newCount ?? 0} 篇` : "刷新失败");
    await loadSubscribed();
  }

  async function toggleBaseline(s: SubscribedSource) {
    const res = await fetch(`/api/sources/${s.id}/baseline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseline: !s.is_baseline }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setMessage(String(data?.error ?? "设置失败"));
      return;
    }
    setMessage(`「${s.name}」${!s.is_baseline ? "已标记为基线源（全局模型自动摘要）" : "已取消基线标记"}`);
    await loadSubscribed();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">订阅中心</h1>
      <UsageDashboard />
      {message && <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">{message}</p>}

      {/* 期刊搜索 */}
      <section className="mb-8">
        <h2 className="mb-2 font-semibold">订阅学术期刊（Crossref）</h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="输入期刊名搜索，如 American Economic Review"
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-amber-500 focus:outline-none"
        />
        {searching && <p className="mt-2 text-sm text-stone-400">搜索中…</p>}
        <ul className="mt-2 divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
          {hits.map((j) => (
            <li key={j.issn} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{j.name}</p>
                <p className="text-xs text-stone-400">
                  ISSN {j.issn}
                  {j.publisher ? ` · ${j.publisher}` : ""}
                </p>
              </div>
              <button
                onClick={() => subscribe({ kind: "journal", identifier: j.issn, name: j.name, publisher: j.publisher })}
                className="shrink-0 rounded-lg bg-amber-500 px-3 py-1 text-xs text-white hover:bg-amber-600"
              >
                订阅
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* arXiv 分类 */}
      <section className="mb-8">
        <h2 className="mb-2 font-semibold">订阅 arXiv 学科分类</h2>
        <div className="flex flex-wrap gap-2">
          {arxivCats.map((c) => (
            <button
              key={c.id}
              onClick={() => subscribe({ kind: "arxiv", identifier: c.id, name: c.label })}
              className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs hover:border-amber-500 hover:text-amber-700"
            >
              + {c.label}
            </button>
          ))}
        </div>
      </section>

      {/* NBER */}
      <section className="mb-8">
        <h2 className="mb-2 font-semibold">订阅 NBER 工作论文</h2>
        <button
          onClick={() => subscribe({ kind: "nber", identifier: "new_papers", name: "NBER New Working Papers" })}
          className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm hover:border-amber-500 hover:text-amber-700"
        >
          + NBER 最新工作论文（RSS）
        </button>
      </section>

      {/* 已订阅 */}
      <section>
        <h2 className="mb-2 font-semibold">我的订阅（{subscribed.length}）</h2>
        {subscribed.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-400">
            还没有订阅任何来源
          </p>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
            {subscribed.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    <span className="mr-2 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] uppercase text-stone-500">
                      {s.kind}
                    </span>
                    {s.name}
                    {s.is_baseline === 1 && (
                      <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">基线</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-400">
                    {s.lastFetch
                      ? s.lastFetch.error
                        ? `上次抓取失败：${s.lastFetch.error}`
                        : `上次抓取 ${fmtBeijing(s.lastFetch.started_at)}（+${s.lastFetch.new_count} 篇）`
                      : "尚未抓取"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {isAdmin && (
                    <button
                      onClick={() => toggleBaseline(s)}
                      title={s.is_baseline ? "基线源：抓取+摘要由开发者全局模型承担" : "非基线源：仅抓取入库，摘要按订阅者个人模型"}
                      className={`rounded-lg border px-3 py-1 text-xs ${
                        s.is_baseline
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-stone-300 hover:bg-stone-100"
                      }`}
                    >
                      {s.is_baseline ? "基线 ✓" : "设为基线"}
                    </button>
                  )}
                  <button
                    onClick={() => refreshOne(s.id)}
                    className="rounded-lg border border-stone-300 px-3 py-1 text-xs hover:bg-stone-100"
                  >
                    刷新
                  </button>
                  <button
                    onClick={() => unsubscribe(s.id)}
                    className="rounded-lg border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    退订
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
