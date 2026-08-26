"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * 模型配置（M1 迭代意见 7，M2 迭代意见 2 调整，基线分层自动摘要扩展）：
 * brief 槽全局共享、由开发者统一配置，界面对所有用户只读（有框不可填）；
 * brief_personal 槽：非基线源的个人自动摘要模型，每用户可写；
 * notes 槽每用户可写。Key 留空提交表示沿用已存 Key；界面仅回显掩码。
 */

type Slot = "brief" | "brief_personal" | "notes";

interface SlotConfig {
  slot: Slot;
  baseUrl: string;
  model: string;
  apiKeyMasked: string;
  updatedAt: string;
}

export function LlmProviderSettings() {
  const [notes, setNotes] = useState<SlotConfig | null>(null);
  const [briefPersonal, setBriefPersonal] = useState<SlotConfig | null>(null);
  const [effective, setEffective] = useState<{ baseUrl: string; model: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetch("/api/settings/llm");
    const d = await res.json().catch(() => null);
    if (res.ok && d?.data) {
      setNotes(d.data.notes);
      setBriefPersonal(d.data.briefPersonal ?? null);
      setEffective(d.data.briefEffective ?? null);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  if (!loaded) return null;

  const disabledInput =
    "w-full cursor-not-allowed rounded-lg border border-stone-200 bg-stone-100 px-3 py-2 text-sm text-stone-500 focus:outline-none";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="mb-1 font-semibold">快速概要模型（全局共享 · 开发者统一维护）</h2>
        <p className="mb-3 text-xs text-stone-400">
          信息流概要由开发者统一配置并承担费用，全体用户直接使用，此处不可修改。
        </p>
        <div className="space-y-2 rounded-lg border border-stone-200 p-3">
          <input disabled value={effective?.baseUrl ?? ""} placeholder="提供商 URL（服务端已配置）" className={disabledInput} />
          <input disabled value={effective?.model ?? ""} placeholder="模型名称（服务端已配置）" className={disabledInput} />
          <input disabled value="" placeholder="API Key：由服务端安全保管，不在界面显示" className={disabledInput} />
          {effective ? (
            <p className="text-xs text-stone-500">
              当前使用的模型：<span className="font-medium">{effective.model}</span> · 提供商：{effective.baseUrl}（API Key 不展示）
            </p>
          ) : (
            <p className="text-xs text-red-500">尚未配置模型，概要生成暂不可用，请联系开发者。</p>
          )}
          <p className="text-xs leading-relaxed text-stone-400">
            此模型由开发者预先配置并提供。上线云服务器后，开发者在服务器上写入配置（环境变量或数据库），
            应用启动时自动读取，无需每位用户自行配置。
          </p>
        </div>
      </div>

      <div>
        <h2 className="mb-1 font-semibold">个人概要模型（范围外摘要 · 个人）</h2>
        <p className="mb-3 text-xs text-stone-400">
          开发者未标记为「基线」的订阅源，入库后由你的个人模型自动生成摘要（费用自担）；
          未配置时文章保持「待摘要」状态，可随时手动触发。
        </p>
        <ProviderForm slot="brief_personal" existing={briefPersonal} onSaved={reload} />
        <QuotaPrefs personalConfigured={Boolean(briefPersonal)} />
      </div>

      <div>
        <h2 className="mb-1 font-semibold">阅读笔记模型（个人）</h2>
        <p className="mb-3 text-xs text-stone-400">
          阅读笔记生成功能预留；可按个人偏好配置独立的提供商与 Key。
        </p>
        <ProviderForm slot="notes" existing={notes} onSaved={reload} />
      </div>
    </div>
  );
}

function ProviderForm({
  slot,
  existing,
  onSaved,
}: {
  slot: Slot;
  existing: SlotConfig | null;
  onSaved: () => void;
}) {
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? "");
  const [model, setModel] = useState(existing?.model ?? "");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setBaseUrl(existing?.baseUrl ?? "");
    setModel(existing?.model ?? "");
  }, [existing]);

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/settings/llm", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot, baseUrl, model, ...(apiKey ? { apiKey } : {}) }),
    });
    const d = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setMsg({ ok: false, text: String(d?.error ?? "保存失败") });
      return;
    }
    setApiKey("");
    setMsg({ ok: true, text: "已保存" });
    onSaved();
  }

  async function test() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/settings/llm/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot, baseUrl, model, ...(apiKey ? { apiKey } : {}) }),
    });
    const d = await res.json().catch(() => null);
    setBusy(false);
    setMsg(
      d?.data?.ok
        ? { ok: true, text: "连接成功 ✓" }
        : { ok: false, text: String(d?.data?.error ?? "测试连接失败") }
    );
  }

  const input =
    "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none";

  return (
    <div className="space-y-2 rounded-lg border border-stone-200 p-3">
      {existing && (
        <p className="text-xs text-stone-400">
          已配置：{existing.model} · Key {existing.apiKeyMasked} · 更新于 {existing.updatedAt.replace("T", " ").slice(0, 16)}
        </p>
      )}
      <input
        value={baseUrl}
        onChange={(e) => setBaseUrl(e.target.value)}
        placeholder="提供商 URL，如 https://api.openai.com/v1"
        className={input}
      />
      <input
        value={model}
        onChange={(e) => setModel(e.target.value)}
        placeholder="模型名称，如 gpt-4o-mini"
        className={input}
      />
      <input
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder={existing ? "API Key（留空沿用已存）" : "API Key"}
        className={input}
      />
      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={busy || !baseUrl || !model || (!existing && !apiKey)}
          className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
        >
          保存
        </button>
        <button
          onClick={test}
          disabled={busy || !baseUrl}
          className="rounded-lg border border-stone-300 px-4 py-1.5 text-sm hover:bg-stone-100 disabled:opacity-50"
        >
          测试连接
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}

/**
 * 个人自动摘要额度偏好：每日上限（0=仅手动）+ 优先摘要订阅源。
 * 优先源只影响调度顺序，不额外扣额度；超限任务自动排队到次日。
 */
interface QuotaSource {
  id: number;
  name: string;
  is_baseline: number;
}

function QuotaPrefs({ personalConfigured }: { personalConfigured: boolean }) {
  const [cap, setCap] = useState("20");
  const [usedToday, setUsedToday] = useState<number | null>(null);
  const [priorityIds, setPriorityIds] = useState<number[]>([]);
  const [sources, setSources] = useState<QuotaSource[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings/quota")
      .then((r) => r.json())
      .then((d) => {
        if (d?.data) {
          setCap(String(d.data.briefDailyCap));
          setPriorityIds(d.data.prioritySourceIds ?? []);
          setUsedToday(d.data.usedToday ?? 0);
        }
      })
      .catch(() => undefined);
    fetch("/api/sources")
      .then((r) => r.json())
      .then((d) => setSources(d?.data?.sources ?? []))
      .catch(() => undefined);
  }, []);

  async function save() {
    const n = Number(cap);
    if (!Number.isInteger(n) || n < 0 || n > 1000) {
      setMsg({ ok: false, text: "每日上限需为 0–1000 的整数" });
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/settings/quota", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ briefDailyCap: n, prioritySourceIds: priorityIds }),
    });
    const d = await res.json().catch(() => null);
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: "已保存" } : { ok: false, text: String(d?.error ?? "保存失败") });
  }

  function toggle(id: number) {
    setPriorityIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const candidates = sources.filter((s) => s.is_baseline !== 1);

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-stone-200 p-3">
      <div className="flex items-center gap-2">
        <label className="text-sm text-stone-600" htmlFor="brief-daily-cap">
          每日自动摘要上限（篇）
        </label>
        <input
          id="brief-daily-cap"
          type="number"
          min={0}
          max={1000}
          value={cap}
          onChange={(e) => setCap(e.target.value)}
          className="w-24 rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm focus:border-amber-500 focus:outline-none"
        />
        {usedToday !== null && (
          <span className="text-xs text-stone-400">（今日已自动消耗 {usedToday} 篇）</span>
        )}
      </div>
      <p className="text-xs text-stone-400">
        设为 0 表示「仅手动触发」，不会自动消耗你的 Key。超出上限的任务自动排队到次日消化。
      </p>
      {candidates.length > 0 && (
        <div>
          <p className="mb-1 text-sm text-stone-600">优先摘要的订阅源（优先调度，不额外扣额度）</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {candidates.map((s) => (
              <label key={s.id} className="flex items-center gap-1.5 text-sm text-stone-600">
                <input
                  type="checkbox"
                  checked={priorityIds.includes(s.id)}
                  onChange={() => toggle(s.id)}
                  className="accent-amber-500"
                />
                {s.name}
              </label>
            ))}
          </div>
        </div>
      )}
      {!personalConfigured && (
        <p className="text-xs text-stone-400">提示：尚未配置上方个人概要模型时，自动摘要不会生效。</p>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
        >
          保存额度设置
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
