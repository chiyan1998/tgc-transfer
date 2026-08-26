"use client";

import { useRef, useState } from "react";

/** 附件限制：与后端 /api/feedback 一致 */
const MAX_FILES = 3;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPT = ".png,.jpg,.jpeg,.gif,.webp,.bmp,.pdf";

/**
 * 「我要反馈」弹窗（M2 迭代意见 2）：
 * 问题概述（单行）+ 详情描述（多行）+ 附件上传（图片/PDF，≤10MB，最多 3 个）。
 */
export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [summary, setSummary] = useState("");
  const [detail, setDetail] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!open) return null;

  function reset() {
    setSummary("");
    setDetail("");
    setFiles([]);
    setError("");
    setDone(false);
  }

  function close() {
    reset();
    onClose();
  }

  function pickFiles(list: FileList | null) {
    if (!list) return;
    setError("");
    const picked = Array.from(list);
    const merged = [...files];
    for (const f of picked) {
      const okType = /\.(png|jpe?g|gif|webp|bmp|pdf)$/i.test(f.name);
      if (!okType) {
        setError(`不支持的文件类型：${f.name}（仅接受图片与 PDF）`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        setError(`文件过大：${f.name}（单文件 ≤10MB）`);
        continue;
      }
      if (merged.length >= MAX_FILES) {
        setError(`附件最多 ${MAX_FILES} 个`);
        break;
      }
      merged.push(f);
    }
    setFiles(merged);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function submit() {
    if (!summary.trim()) {
      setError("请填写问题概述");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("summary", summary.trim());
      fd.append("detail", detail.trim());
      files.forEach((f) => fd.append("files", f));
      const res = await fetch("/api/feedback", { method: "POST", body: fd });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "提交失败，请稍后再试");
        return;
      }
      setDone(true);
    } catch {
      setError("网络异常，请稍后再试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
      <div
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <div className="py-8 text-center">
            <p className="text-lg font-medium text-green-700">反馈已提交，感谢！</p>
            <p className="mt-2 text-sm text-stone-500">虎妞会尽快查看你的反馈。</p>
            <button
              onClick={close}
              className="mt-6 rounded-lg bg-amber-500 px-6 py-2 text-sm font-medium text-white hover:bg-amber-600"
            >
              关闭
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">我要反馈</h2>
              <button onClick={close} className="text-stone-400 hover:text-stone-600" aria-label="关闭">
                ✕
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-sm text-stone-600">问题概述 *</label>
                <input
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  maxLength={200}
                  placeholder="一句话描述问题或建议"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-stone-600">详情描述</label>
                <textarea
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  rows={5}
                  maxLength={5000}
                  placeholder="复现步骤、期望行为、截图说明等"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-stone-600">附件（图片 / PDF，单文件 ≤10MB，最多 3 个）</label>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => fileInput.current?.click()}
                    className="rounded-lg border border-dashed border-stone-300 px-3 py-1.5 text-sm text-stone-500 hover:border-amber-400 hover:text-amber-600"
                  >
                    + 添加附件
                  </button>
                  {files.map((f, i) => (
                    <span
                      key={`${f.name}-${i}`}
                      className="flex items-center gap-1 rounded bg-stone-100 px-2 py-1 text-xs text-stone-600"
                    >
                      {f.name}
                      <button
                        onClick={() => setFiles(files.filter((_, j) => j !== i))}
                        className="text-stone-400 hover:text-red-500"
                        aria-label={`移除 ${f.name}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  accept={ACCEPT}
                  multiple
                  className="hidden"
                  onChange={(e) => pickFiles(e.target.files)}
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={close}
                  className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-100"
                >
                  取消
                </button>
                <button
                  onClick={submit}
                  disabled={busy}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {busy ? "提交中…" : "提交反馈"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
