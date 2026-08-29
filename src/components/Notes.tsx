"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Material {
  id: number;
  kind: "main" | "attachment";
  originalName: string;
  size: number;
  createdAt: string;
}

const KIND_META = {
  main: { title: "论文正文", accept: ".pdf,.epub", hint: "支持 PDF / EPUB，单文件 ≤50MB" },
  attachment: { title: "附加材料", accept: ".pdf,.zip", hint: "支持 PDF / ZIP，单文件 ≤50MB" },
} as const;

function fmtSize(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

/** 上传卡：拖拽或点选上传单个文件 */
function UploadCard({ kind, onUploaded }: { kind: keyof typeof KIND_META; onUploaded: () => void }) {
  const meta = KIND_META[kind];
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function upload(file: File) {
    setBusy(true);
    setMsg("");
    const form = new FormData();
    form.append("kind", kind);
    form.append("file", file);
    const res = await fetch("/api/notes/materials", { method: "POST", body: form }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setMsg(String(d?.error ?? "上传失败，请稍后重试"));
      return;
    }
    setMsg(`已上传 ${file.name}`);
    onUploaded();
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold">{meta.title}</h3>
      <p className="mb-3 mt-1 text-xs text-stone-400">{meta.hint}</p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void upload(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-sm transition-colors ${
          drag ? "border-amber-500 bg-amber-50 text-amber-700" : "border-stone-300 text-stone-500 hover:bg-stone-50"
        }`}
      >
        <span>{busy ? "上传中…" : "拖拽文件到这里，或点击选择文件"}</span>
        <input
          ref={inputRef}
          type="file"
          accept={meta.accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
      </div>
      {msg && <p className={`mt-2 text-xs ${msg.startsWith("已上传") ? "text-green-600" : "text-red-600"}`}>{msg}</p>}
    </div>
  );
}

/** 阅读笔记起步页内容：材料上传 + 已上传列表（笔记自动生成功能开发中） */
export function Notes() {
  const [items, setItems] = useState<Material[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/notes/materials").catch(() => null);
    const d = await res?.json().catch(() => null);
    if (res?.ok && d?.data) {
      setItems(d.data.items);
      setError("");
    } else {
      setError("加载失败，请稍后重试");
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: number) {
    const res = await fetch(`/api/notes/materials/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((m) => m.id !== id));
    else setError("删除失败，请稍后重试");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">阅读笔记</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <UploadCard kind="main" onUploaded={load} />
        <UploadCard kind="attachment" onUploaded={load} />
      </div>

      <div className="mt-6 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">已上传材料</h2>
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        {!loaded && <p className="text-sm text-stone-400">加载中…</p>}
        {loaded && items.length === 0 && (
          <p className="text-sm text-stone-400">还没有上传任何材料。论文正文支持 PDF / EPUB，附加材料支持 PDF / ZIP。</p>
        )}
        <ul className="divide-y divide-stone-100">
          {items.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span
                className={`w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-xs ${
                  m.kind === "main" ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-600"
                }`}
              >
                {m.kind === "main" ? "正文" : "附件"}
              </span>
              <span className="min-w-0 flex-1 truncate" title={m.originalName}>
                {m.originalName}
              </span>
              <span className="shrink-0 text-xs text-stone-400">{fmtSize(m.size)}</span>
              <span className="shrink-0 text-xs text-stone-400">{m.createdAt.replace("T", " ").slice(0, 16)}</span>
              <button
                onClick={() => void remove(m.id)}
                className="shrink-0 text-xs text-stone-400 hover:text-red-600"
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-center text-xs text-stone-400">笔记自动生成功能开发中，敬请期待。</p>
    </div>
  );
}
