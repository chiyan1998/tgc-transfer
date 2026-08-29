"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CITATION_FORMATS, formatCitation, type CitationFormat } from "@/lib/citation";
import { fmtBeijing } from "@/lib/time";

interface Brief {
  status: "done" | "pending";
  titleZh?: string;
  abstractZh?: string;
  field?: string;
  paperTypes?: string[];
  researchQuestion?: string;
  conclusion?: string;
  quality?: string;
}

interface Article {
  id: number;
  externalId: string;
  doi: string | null;
  title: string;
  authors: { given?: string; family?: string; name?: string }[];
  abstract: string | null;
  volume: string | null;
  issue: string | null;
  page: string | null;
  publishedAt: string | null;
  publishedOnline: string | null;
  publishedPrint: string | null;
  url: string;
  pdfUrl: string | null;
  isOa: boolean;
  source: { id: number; kind: string; name: string };
  brief: Brief;
}

/** 论文类型五分类标签（仅中文）与各自配色；键名与 paper-types.ts 保持一致 */
const PAPER_TYPE_STYLES: Record<string, { label: string; cls: string }> = {
  quant_empirical: { label: "量化实证", cls: "bg-sky-100 text-sky-700" },
  qualitative: { label: "质性研究", cls: "bg-violet-100 text-violet-700" },
  model: { label: "模型", cls: "bg-teal-100 text-teal-700" },
  methodology: { label: "方法论", cls: "bg-orange-100 text-orange-700" },
  theory: { label: "理论研究", cls: "bg-indigo-100 text-indigo-700" },
};

/** 仓库配色：期刊=玫红系 / arXiv=蓝色系 / NBER=绿色系 */
const KIND_STYLES: Record<string, { cls: string; group: "期刊论文" | "工作论文" }> = {
  journal: { cls: "bg-rose-100 text-rose-700", group: "期刊论文" },
  arxiv: { cls: "bg-blue-100 text-blue-700", group: "工作论文" },
  nber: { cls: "bg-green-100 text-green-700", group: "工作论文" },
  book: { cls: "bg-stone-200 text-stone-700", group: "期刊论文" },
};

const KIND_OPTIONS = [
  { key: "journal", label: "期刊（Crossref）" },
  { key: "arxiv", label: "arXiv 预印本" },
  { key: "nber", label: "NBER 工作论文" },
];

type Range = "today" | "week" | "month" | "quarter" | "halfyear" | "all";

interface FeedStats {
  total: number;
  briefed: number;
  lastFetchAt: string | null;
}

export function Feed() {
  const [items, setItems] = useState<Article[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");
  const [range, setRange] = useState<Range>("month");
  const [oaOnly, setOaOnly] = useState(false);
  const [stats, setStats] = useState<FeedStats | null>(null);
  // 搜索与筛选
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [groups, setGroups] = useState<string[]>([]); // journal / working
  const [kindSel, setKindSel] = useState<string[]>([]); // journal / arxiv / nber
  const [typeSel, setTypeSel] = useState<string[]>([]); // 论文类型五分类
  const [batchOpen, setBatchOpen] = useState(false);
  // 排序与具体来源筛选（动态读已订阅源）
  const [sort, setSort] = useState<"ingest" | "published" | "source" | "brief">("ingest");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [availSources, setAvailSources] = useState<SourceOption[]>([]);
  const [sourceSel, setSourceSel] = useState<number[]>([]);
  const initialLoaded = useRef(false);

  // 生效的来源类型：论文类别勾选 ∪ 来源类型勾选
  const effectiveKinds = Array.from(
    new Set([
      ...(groups.includes("journal") ? ["journal"] : []),
      ...(groups.includes("working") ? ["arxiv", "nber"] : []),
      ...kindSel,
    ])
  );
  const filterActive =
    effectiveKinds.length > 0 || typeSel.length > 0 || q !== "" || sourceSel.length > 0;

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/stats/feed");
    const d = await res.json().catch(() => null);
    if (res.ok && d?.data) setStats(d.data);
  }, []);

  const load = useCallback(
    async (reset = false) => {
      setLoading(true);
      const params = new URLSearchParams({ limit: "20", range, sort, dir });
      if (oaOnly) params.set("oa", "1");
      if (q) params.set("q", q);
      if (effectiveKinds.length) params.set("kinds", effectiveKinds.join(","));
      if (typeSel.length) params.set("types", typeSel.join(","));
      if (sourceSel.length) params.set("sources", sourceSel.join(","));
      if (!reset && cursor) params.set("cursor", String(cursor));
      const res = await fetch(`/api/articles?${params}`);
      const data = await res.json().catch(() => null);
      setLoading(false);
      if (!res.ok || !data?.data) {
        setNotice("加载失败，请稍后重试");
        return;
      }
      setItems(reset ? data.data.items : [...items, ...data.data.items]);
      setCursor(data.data.nextCursor);
      setNotice("");
    },
    [
      cursor,
      items,
      range,
      oaOnly,
      q,
      sort,
      dir,
      effectiveKinds.join(","),
      typeSel.join(","),
      sourceSel.join(","),
    ]
  );

  // 首次加载 + 登录自动刷新（每个浏览器会话一次，见 product-design §5）
  useEffect(() => {
    if (initialLoaded.current) return;
    initialLoaded.current = true;
    (async () => {
      if (!sessionStorage.getItem("tgc-auto-refreshed")) {
        sessionStorage.setItem("tgc-auto-refreshed", "1");
        setRefreshing(true);
        await fetch("/api/sources/refresh-all", { method: "POST" }).catch(() => undefined);
        setRefreshing(false);
      }
      await load(true);
      await loadStats();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 搜索防抖 500ms
  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput.trim()), 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  // 筛选条件变化后重置加载（首次挂载由上方 effect 负责）
  const filterKey = `${range}|${oaOnly}|${q}|${effectiveKinds.join(",")}|${typeSel.join(",")}|${sort}|${dir}|${sourceSel.join(",")}`;
  useEffect(() => {
    if (!initialLoaded.current) return;
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  // 打开筛选面板时加载已订阅源列表（具体来源多选）
  useEffect(() => {
    if (!filterOpen || availSources.length > 0) return;
    (async () => {
      const res = await fetch("/api/sources");
      const d = await res.json().catch(() => null);
      if (res.ok && d?.data) setAvailSources(d.data.sources ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterOpen]);

  // 统计行 30 秒静默轮询：批量/回填入队后摘要数字自然增长，卸载时清理
  useEffect(() => {
    const t = setInterval(() => loadStats(), 30_000);
    return () => clearInterval(t);
  }, [loadStats]);

  async function manualRefresh() {
    setRefreshing(true);
    setNotice("");
    const res = await fetch("/api/sources/refresh-all", { method: "POST" });
    const data = await res.json().catch(() => null);
    setRefreshing(false);
    if (res.status === 429) {
      setNotice(String(data?.error ?? "刷新过于频繁，请稍后再试"));
      return;
    }
    const newCount = (data?.data?.results ?? []).reduce((n: number, r: { newCount: number }) => n + r.newCount, 0);
    setNotice(`刷新完成，新增 ${newCount} 篇`);
    await load(true);
    await loadStats();
  }

  function clearFilters() {
    setGroups([]);
    setKindSel([]);
    setTypeSel([]);
    setSourceSel([]);
    setSearchInput("");
    setQ("");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">文献集市</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBatchOpen(true)}
            className="rounded-lg border border-amber-500 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50"
          >
            批量生成摘要
          </button>
          <button
            onClick={manualRefresh}
            disabled={refreshing}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {refreshing ? "刷新中…" : "手动刷新"}
          </button>
        </div>
      </div>

      {/* 统计行：总数 / 已摘要数 / 上次自动更新（北京时间） */}
      <p className="mb-3 text-sm text-stone-500">
        {stats ? (
          <>
            当前共有论文 <span className="font-semibold text-stone-700">{stats.total}</span> 篇，已自动摘要{" "}
            <span className="font-semibold text-stone-700">{stats.briefed}</span> 篇
            <span className="mx-2 text-stone-300">·</span>
            上次自动更新 {stats.lastFetchAt ? fmtBeijing(stats.lastFetchAt) : "暂无"}
          </>
        ) : (
          "统计加载中…"
        )}
      </p>

      {/* 搜索 + 筛选栏 */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="搜索期刊名 / 论文标题（中英文）/ 来源…"
          className="w-72 max-w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 focus:border-amber-500 focus:outline-none"
        />
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as Range)}
          className="rounded-lg border border-stone-300 bg-white px-2 py-1.5"
        >
          <option value="today">今天</option>
          <option value="week">最近一周</option>
          <option value="month">最近一月</option>
          <option value="quarter">最近三个月</option>
          <option value="halfyear">最近半年</option>
          <option value="all">全部时间</option>
        </select>
        <label className="flex items-center gap-1.5 text-stone-600">
          <input type="checkbox" checked={oaOnly} onChange={(e) => setOaOnly(e.target.checked)} />
          仅开放获取
        </label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="rounded-lg border border-stone-300 bg-white px-2 py-1.5"
          title="排序字段"
        >
          <option value="ingest">按入库时间</option>
          <option value="published">按发表日期</option>
          <option value="source">按来源名</option>
          <option value="brief">按摘要状态</option>
        </select>
        <button
          onClick={() => setDir(dir === "desc" ? "asc" : "desc")}
          className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-stone-600 hover:bg-stone-100"
          title={dir === "desc" ? "当前降序，点击切换为升序" : "当前升序，点击切换为降序"}
        >
          {dir === "desc" ? "↓ 降序" : "↑ 升序"}
        </button>
        <button
          onClick={() => setFilterOpen(!filterOpen)}
          className={`rounded-lg border px-3 py-1.5 ${
            filterOpen || filterActive
              ? "border-amber-500 bg-amber-50 text-amber-700"
              : "border-stone-300 bg-white text-stone-600 hover:bg-stone-100"
          }`}
        >
          筛选{filterActive ? " ●" : ""}
        </button>
        {filterActive && (
          <button onClick={clearFilters} className="text-stone-500 hover:text-amber-600">
            清除筛选
          </button>
        )}
        {notice && <span className="text-amber-700">{notice}</span>}
      </div>

      {/* 筛选面板 */}
      {filterOpen && (
        <div className="mb-4 space-y-3 rounded-xl border border-stone-200 bg-white p-4 text-sm shadow-sm">
          <FilterGroup
            label="论文类别"
            options={[
              { key: "journal", label: "期刊论文" },
              { key: "working", label: "工作论文" },
            ]}
            selected={groups}
            onChange={setGroups}
          />
          <FilterGroup label="来源类型" options={KIND_OPTIONS} selected={kindSel} onChange={setKindSel} />
          <FilterGroup
            label="论文类型"
            options={Object.entries(PAPER_TYPE_STYLES).map(([key, s]) => ({ key, label: s.label }))}
            selected={typeSel}
            onChange={setTypeSel}
          />
          <div className="flex items-start gap-2">
            <span className="w-16 shrink-0 pt-1 text-xs font-semibold text-stone-500">具体来源</span>
            <div className="max-h-40 flex-1 overflow-auto">
              {availSources.length === 0 && (
                <p className="py-1 text-xs text-stone-400">暂无已订阅来源</p>
              )}
              <div className="flex flex-wrap gap-2 pb-1">
                {availSources.map((s) => {
                  const on = sourceSel.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() =>
                        setSourceSel(on ? sourceSel.filter((x) => x !== s.id) : [...sourceSel, s.id])
                      }
                      className={`rounded-full px-3 py-1 text-xs ${
                        on ? "bg-amber-500 font-medium text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {range === "all" && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          回翻全部时间会加载较多历史文献，耗时较长；未生成概要的文章会排队调用 LLM，将消耗较多 Token，请知悉。
        </div>
      )}

      {items.length === 0 && !loading && (
        <div className="rounded-2xl border border-dashed border-stone-300 p-12 text-center text-stone-500">
          <p>{filterActive || q ? "没有符合当前搜索/筛选条件的文献。" : "信息流还是空的。"}</p>
          {!filterActive && !q && (
            <p className="mt-2">
              去{" "}
              <Link href="/sources" className="text-amber-600 hover:underline">
                订阅中心
              </Link>{" "}
              订阅期刊 / arXiv / NBER，稍等片刻后即可看到最新文章。
            </p>
          )}
        </div>
      )}

      <div className="space-y-4">
        {items.map((a) => (
          <ArticleCard key={a.id} article={a} />
        ))}
      </div>

      {cursor && (
        <div className="mt-6 text-center">
          <button
            onClick={() => load(false)}
            disabled={loading}
            className="rounded-lg border border-stone-300 px-6 py-2 text-sm hover:bg-stone-100 disabled:opacity-50"
          >
            {loading ? "加载中…" : "加载更多"}
          </button>
        </div>
      )}

      {batchOpen && (
        <BatchBriefModal
          onClose={() => setBatchOpen(false)}
          onDone={(msg) => {
            setBatchOpen(false);
            setNotice(msg);
            loadStats();
          }}
        />
      )}
    </div>
  );
}

interface SourceOption {
  id: number;
  kind: string;
  name: string;
  is_baseline: number;
}

const BATCH_KIND_LABEL: Record<string, string> = {
  journal: "期刊",
  arxiv: "arXiv",
  nber: "NBER",
  book: "图书",
};

/** 批量生成摘要弹窗：来源多选 + 日期范围 → 预览篇数 → 确认入队 */
function BatchBriefModal({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sel, setSel] = useState<number[]>([]);
  const [range, setRange] = useState<Range>("all");
  const [preview, setPreview] = useState<{ count: number; skippedQuota: number; noModel: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/sources");
      const d = await res.json().catch(() => null);
      if (res.ok && d?.data) setSources(d.data.sources ?? []);
      setLoaded(true);
    })();
  }, []);

  function toggleSource(id: number) {
    setPreview(null);
    setMsg("");
    setSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function doPreview() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/articles/batch-brief/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceIds: sel, range }),
    });
    const d = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok || !d?.data) {
      setMsg(String(d?.error ?? "预览失败，请稍后重试"));
      return;
    }
    setPreview(d.data);
  }

  async function doRun() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/articles/batch-brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceIds: sel, range }),
    });
    const d = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok || !d?.data) {
      setMsg(String(d?.error ?? "提交失败，请稍后重试"));
      return;
    }
    const r = d.data as { count: number; skippedQuota: number };
    onDone(`已加入队列 ${r.count} 篇，概要将陆续生成${r.skippedQuota ? `（另有 ${r.skippedQuota} 篇受今日额度限制跳过）` : ""}`);
  }

  const confirmDisabled = busy || !preview || preview.count === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">批量生成摘要</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            ✕
          </button>
        </div>
        <p className="mb-3 text-xs text-stone-500">
          对选定来源中尚无概要的文章一键入队。基线来源走全局模型；其余来源使用你的个人概要模型并计入每日额度。
        </p>

        <div className="mb-2 text-sm font-medium text-stone-700">选择来源（{sel.length}/{sources.length}）</div>
        <div className="mb-3 max-h-52 space-y-1 overflow-auto rounded-lg border border-stone-200 p-2">
          {!loaded && <p className="p-2 text-xs text-stone-400">加载中…</p>}
          {loaded && sources.length === 0 && <p className="p-2 text-xs text-stone-400">还没有订阅任何来源，请先去订阅中心订阅。</p>}
          {sources.map((s) => {
            const on = sel.includes(s.id);
            return (
              <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-stone-50">
                <input type="checkbox" checked={on} onChange={() => toggleSource(s.id)} />
                <span className="w-14 shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-center text-xs text-stone-500">
                  {BATCH_KIND_LABEL[s.kind] ?? s.kind}
                </span>
                <span className={on ? "font-medium text-stone-800" : "text-stone-600"}>{s.name}</span>
                {s.is_baseline ? (
                  <span className="ml-auto shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700">基线 · 全局模型</span>
                ) : (
                  <span className="ml-auto shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">个人模型 · 计额度</span>
                )}
              </label>
            );
          })}
        </div>

        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="font-medium text-stone-700">日期范围</span>
          <select
            value={range}
            onChange={(e) => {
              setRange(e.target.value as Range);
              setPreview(null);
              setMsg("");
            }}
            className="rounded-lg border border-stone-300 bg-white px-2 py-1.5"
          >
            <option value="today">今天</option>
            <option value="week">最近一周</option>
            <option value="month">最近一月</option>
            <option value="quarter">最近三个月</option>
            <option value="halfyear">最近半年</option>
            <option value="all">全部时间</option>
          </select>
        </div>

        {preview && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            将批量摘要 <span className="font-semibold">{preview.count}</span> 篇
            {preview.skippedQuota > 0 && <>（另有 {preview.skippedQuota} 篇受每日额度限制跳过）</>}
            {preview.noModel > 0 && (
              <>（另有 {preview.noModel} 篇来自非基线来源，需先在设置页配置个人概要模型）</>
            )}
          </div>
        )}
        {msg && <p className="mb-3 text-sm text-red-600">{msg}</p>}

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={doPreview}
            disabled={busy || sel.length === 0}
            className="rounded-lg border border-amber-500 px-4 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
          >
            预览篇数
          </button>
          <button
            onClick={doRun}
            disabled={confirmDisabled}
            className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
          >
            确定生成
          </button>
        </div>
      </div>
    </div>
  );
}

/** 复选筛选组：点击切换多选 */
function FilterGroup({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { key: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 shrink-0 text-xs font-semibold text-stone-500">{label}</span>
      {options.map((o) => {
        const on = selected.includes(o.key);
        return (
          <button
            key={o.key}
            onClick={() => onChange(on ? selected.filter((k) => k !== o.key) : [...selected, o.key])}
            className={`rounded-full px-3 py-1 text-xs ${
              on ? "bg-amber-500 font-medium text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** 日期规范化：2026-8-1 → 2026-08-01（Crossref date-parts 可能不补零） */
function fmtDate(d: string): string {
  const parts = d.split("-");
  if (parts.length >= 2) {
    parts[1] = parts[1].padStart(2, "0");
    if (parts[2]) parts[2] = parts[2].padStart(2, "0");
  }
  return parts.join("-").slice(0, 10);
}

/** 发表信息展示：期刊优先 Online 日期 + 卷期（无日期也显示卷期）；工作论文显示发布/提交日期 */
function PublishInfo({ article }: { article: Article }) {
  const isWorking = article.source.kind === "arxiv" || article.source.kind === "nber";
  if (isWorking) {
    const d = article.publishedAt ?? article.publishedOnline;
    return d ? <span className="text-stone-400">{fmtDate(d)}</span> : null;
  }
  const volIssue =
    (article.volume ? `Vol.${article.volume}` : "") + (article.issue ? `(${article.issue})` : "");
  const date = article.publishedOnline ?? article.publishedPrint ?? article.publishedAt;
  if (!date && !volIssue) return null;
  const label = article.publishedOnline ? "Online" : "发表";
  return (
    <span className="text-stone-400">
      {date ? `${label} ${fmtDate(date)}` : ""}
      {date && volIssue ? " · " : ""}
      {volIssue}
    </span>
  );
}

function ArticleCard({ article }: { article: Article }) {
  const [expanded, setExpanded] = useState(false);
  const [citeOpen, setCiteOpen] = useState(false);
  // 手动触发后的概要状态本地跟踪（轮询单篇接口更新）
  const [brief, setBrief] = useState<Brief>(article.brief);
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefMsg, setBriefMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    let tries = 0;
    pollRef.current = setInterval(async () => {
      tries += 1;
      const res = await fetch(`/api/articles?id=${article.id}`).catch(() => null);
      const d = await res?.json().catch(() => null);
      const item = d?.data?.items?.[0];
      if (item?.brief?.status === "done") {
        if (pollRef.current) clearInterval(pollRef.current);
        setBrief(item.brief);
        setBriefMsg("");
        return;
      }
      if (tries >= 60 && pollRef.current) {
        // 5 分钟未出结果（排队/额度限制）停止轮询，保留提示
        clearInterval(pollRef.current);
        setBriefMsg("已入队，生成后刷新页面可见");
      }
    }, 5000);
  }

  async function triggerBrief() {
    setBriefBusy(true);
    setBriefMsg("");
    const res = await fetch(`/api/articles/${article.id}/brief`, { method: "POST" });
    const d = await res.json().catch(() => null);
    setBriefBusy(false);
    if (!res.ok) {
      setBriefMsg(String(d?.error ?? "触发失败"));
      return;
    }
    setBriefMsg(d?.data?.queued ? "已加入队列，正在生成…" : "已在队列中，正在生成…");
    startPolling();
  }

  const authors = article.authors
    .map((a) => (a.name ?? [a.given, a.family].filter(Boolean).join(" ")))
    .filter(Boolean)
    .slice(0, 4)
    .join(", ");
  const kind = KIND_STYLES[article.source.kind] ?? KIND_STYLES.book;

  function markRead() {
    if (!expanded) {
      fetch("/api/articles/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleIds: [article.id] }),
      }).catch(() => undefined);
    }
    setExpanded(!expanded);
  }

  return (
    <article className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      {/* 来源行：论文类别徽标 + 仓库名（配色区分） + 发表信息 */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-stone-800 px-2 py-0.5 font-medium text-white">{kind.group}</span>
        <span className={`rounded px-2 py-0.5 ${kind.cls}`}>{article.source.name}</span>
        {article.isOa && <span className="rounded bg-green-100 px-2 py-0.5 text-green-700">OA</span>}
        <PublishInfo article={article} />
      </div>

      <h2 className="font-semibold leading-snug">{brief.status === "done" && brief.titleZh ? brief.titleZh : article.title}</h2>
      <p className="mt-1 text-xs text-stone-500">{article.title}</p>
      {authors && <p className="mt-1.5 text-sm text-stone-600">{authors}</p>}

      {brief.status === "done" ? (
        <div className="mt-3 space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm">
          {brief.field && (
            <div className="flex gap-2">
              <span className="w-20 shrink-0 rounded bg-stone-200 px-2 py-0.5 text-center text-xs font-semibold leading-5 text-stone-700">
                研究领域
              </span>
              <p className="leading-6 text-stone-700">{brief.field}</p>
            </div>
          )}
          {brief.paperTypes && brief.paperTypes.length > 0 && (
            <div className="flex gap-2">
              <span className="w-20 shrink-0 rounded bg-stone-200 px-2 py-0.5 text-center text-xs font-semibold leading-5 text-stone-700">
                论文类型
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {brief.paperTypes.map((t) => {
                  const s = PAPER_TYPE_STYLES[t];
                  return (
                    <span
                      key={t}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s ? s.cls : "bg-stone-100 text-stone-600"}`}
                    >
                      {s ? s.label : t}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {brief.researchQuestion && (
            <div className="flex gap-2">
              <span className="w-20 shrink-0 rounded bg-stone-200 px-2 py-0.5 text-center text-xs font-semibold leading-5 text-stone-700">
                研究问题
              </span>
              <p className="leading-6 text-stone-700">{brief.researchQuestion}</p>
            </div>
          )}
          {brief.conclusion && (
            <div className="flex gap-2">
              <span className="w-20 shrink-0 rounded bg-stone-200 px-2 py-0.5 text-center text-xs font-semibold leading-5 text-stone-700">
                研究结论
              </span>
              <p className="leading-6 text-stone-700">{brief.conclusion}</p>
            </div>
          )}
          {brief.quality === "partial" && (
            <p className="text-xs text-stone-400">摘要缺失，概要为部分信息</p>
          )}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded bg-stone-100 px-2 py-0.5 font-medium text-stone-500">待摘要</span>
          {briefMsg ? (
            <span className="text-stone-400">{briefMsg}</span>
          ) : (
            <span className="text-stone-400">该源未开启自动摘要，可用你的个人模型生成</span>
          )}
          {!briefMsg && (
            <button
              onClick={triggerBrief}
              disabled={briefBusy}
              className="rounded-lg bg-amber-500 px-2.5 py-1 font-medium text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {briefBusy ? "入队中…" : "生成摘要"}
            </button>
          )}
          {briefMsg === "请先在设置页配置个人概要模型" && (
            <Link href="/settings" className="rounded-lg border border-amber-300 px-2.5 py-1 text-amber-700 hover:bg-amber-50">
              去设置
            </Link>
          )}
        </div>
      )}

      {expanded && article.abstract && (
        <p className="mt-3 rounded-lg bg-stone-50 p-3 text-sm text-stone-600">{article.abstract}</p>
      )}

      <div className="mt-3 flex items-center gap-4 text-sm">
        <button onClick={markRead} className="text-stone-500 hover:text-amber-600">
          {expanded ? "收起摘要" : "查看摘要"}
        </button>
        <button onClick={() => setCiteOpen(true)} className="text-stone-500 hover:text-amber-600">
          生成引用
        </button>
        {article.url && (
          <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline">
            原文页面 ↗
          </a>
        )}
        {article.pdfUrl && (
          <a href={article.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline">
            PDF ↗
          </a>
        )}
      </div>

      {citeOpen && <CitationModal article={article} onClose={() => setCiteOpen(false)} />}
    </article>
  );
}

/** 生成引用弹窗：7 格式 Tab 切换 + 一键复制 */
function CitationModal({ article, onClose }: { article: Article; onClose: () => void }) {
  const [fmt, setFmt] = useState<CitationFormat>("apa");
  const [copied, setCopied] = useState(false);

  const data = {
    title: article.title,
    authors: article.authors,
    year: (article.publishedOnline ?? article.publishedPrint ?? article.publishedAt ?? "").slice(0, 4) || null,
    date: article.publishedOnline ?? article.publishedPrint ?? article.publishedAt,
    venue: article.source.name,
    kind: article.source.kind,
    externalId: article.externalId,
    volume: article.volume,
    issue: article.issue,
    page: article.page,
    doi: article.doi,
    url: article.url,
  };
  const text = formatCitation(fmt, data);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">生成引用</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            ✕
          </button>
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {CITATION_FORMATS.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setFmt(f.key);
                setCopied(false);
              }}
              className={`rounded-full px-3 py-1 text-sm ${
                fmt === f.key ? "bg-amber-500 font-medium text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-stone-50 p-4 text-sm leading-6 text-stone-700">
          {text}
        </pre>
        <div className="mt-3 flex justify-end">
          <button
            onClick={copy}
            className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-600"
          >
            {copied ? "已复制 ✓" : "复制引文"}
          </button>
        </div>
      </div>
    </div>
  );
}
