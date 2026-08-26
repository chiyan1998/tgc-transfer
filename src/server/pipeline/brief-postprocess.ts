/**
 * LLM 概要输出后台整理（M1 迭代意见 2）：
 * 去标签前缀、去 Markdown、截断超长、规范字段，保证卡片展示整洁一致。
 */

const FIELD_PREFIXES = [
  "研究领域",
  "论文类型",
  "研究问题",
  "研究结论",
  "标题",
  "摘要",
  "领域",
  "field",
  "research question",
  "conclusion",
  "title",
  "abstract",
];

/** 去除字段值里的标签前缀（如「研究问题：」）、Markdown 符号、首尾引号 */
export function cleanValue(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  let s = String(raw).trim();
  // 去 Markdown 记号
  s = s.replace(/[*_`#>]+/g, "");
  // 去标签前缀（中英文冒号）
  const prefixRe = new RegExp(`^\\s*(?:${FIELD_PREFIXES.join("|")})\\s*[:：]\\s*`, "i");
  s = s.replace(prefixRe, "");
  // 去首尾引号
  s = s.replace(/^["'“”‘’「『（(]+|["'“”‘’」』）)]+$/g, "");
  // 合并空白
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** 超长截断（按字符），避免 LLM 冗长输出撑爆卡片 */
export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).replace(/[,，;；、\s]+$/, "") + "…";
}

/** 研究领域规范为短语：取第一个分句，限 24 字 */
export function cleanField(raw: unknown): string {
  let s = cleanValue(raw);
  s = s.split(/[。.；;]/)[0].trim();
  return truncate(s, 24);
}
