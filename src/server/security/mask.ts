/**
 * 密钥脱敏（design/architecture.md §7 第 3 层）：
 * 所有日志与错误信息输出前经此模块过滤。
 */
const SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]{8,}/g, // OpenAI 风格 key
  /Bearer\s+[A-Za-z0-9._~+/=-]{16,}/gi,
  /(api[_-]?key|authorization|token)["']?\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{12,}/gi,
];

/** 将文本中疑似密钥的内容替换为 *** */
export function maskSecrets(text: string): string {
  let out = text;
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, "***");
  }
  return out;
}

/** 对 API Key 做展示用脱敏：sk-****1234 */
export function maskKeyForDisplay(key: string): string {
  if (key.length <= 8) return "****";
  return `${key.slice(0, 3)}****${key.slice(-4)}`;
}

/** 将上游错误转为类别码，不泄漏细节（见 api-design §9 502 约定） */
export function upstreamErrorCategory(e: unknown): string {
  const msg = maskSecrets(e instanceof Error ? e.message : String(e)).toLowerCase();
  if (msg.includes("timeout") || msg.includes("timed out")) return "timeout";
  if (msg.includes("429") || msg.includes("rate")) return "rate_limited";
  if (msg.includes("401") || msg.includes("403") || msg.includes("unauthorized")) return "auth";
  if (msg.includes("fetch failed") || msg.includes("econn") || msg.includes("enotfound")) return "network";
  return "unknown";
}
