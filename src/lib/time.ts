/**
 * 时间显示工具（M2 迭代意见 1）：
 * 数据库统一以 UTC 存储（datetime('now')），显示端转换为北京时间（Asia/Shanghai）。
 */

/** 把 SQLite 的 UTC 字符串（"YYYY-MM-DD HH:MM:SS"）解析为 Date；解析失败返回 null */
function parseUtc(utc: string | null | undefined): Date | null {
  if (!utc) return null;
  const d = new Date(utc.includes("T") || utc.endsWith("Z") ? utc : utc.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 格式化为北京时间 "YYYY-MM-DD HH:mm" */
export function fmtBeijing(utc: string | null | undefined): string {
  const d = parseUtc(utc);
  if (!d) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(/\//g, "-");
}

/** 相对时间（北京时间语义）：刚刚 / x 分钟前 / x 小时前 / x 天前 / 具体日期 */
export function fmtBeijingRelative(utc: string | null | undefined): string {
  const d = parseUtc(utc);
  if (!d) return "";
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return fmtBeijing(utc);
}
