/**
 * 回填脚本：为存量期刊文章补齐发表日期（published_online / published_print / published_at）。
 * 场景：早期入库的文章未存日期字段，按 DOI 逐条查询 Crossref 回填。
 * 用法：node scripts/backfill-published-dates.mjs
 */
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

// 从 .env.local 取 Crossref 礼貌邮箱
let mailto = "";
try {
  const env = readFileSync(path.join(root, ".env.local"), "utf8");
  mailto = env.match(/^UNPAYWALL_EMAIL=(.*)$/m)?.[1]?.trim() ?? "";
} catch {
  // 忽略：无邮箱也能调，但官方建议携带
}

const db = new Database(path.join(root, "data", "tgc.db"));
const rows = db
  .prepare(
    `SELECT a.id, a.doi FROM articles a
     JOIN sources s ON s.id = a.source_id
     WHERE a.doi IS NOT NULL AND s.kind = 'journal'
       AND a.published_at IS NULL AND a.published_online IS NULL AND a.published_print IS NULL`
  )
  .all();

console.log(`待回填 ${rows.length} 篇`);

const fmt = (d) => {
  const parts = d?.["date-parts"]?.[0];
  if (!parts?.length) return null;
  const [y, m, day] = parts;
  if (!y) return null;
  const mm = m ? String(m).padStart(2, "0") : null;
  const dd = day ? String(day).padStart(2, "0") : null;
  return [y, mm, dd].filter(Boolean).join("-");
};

const update = db.prepare(
  `UPDATE articles SET published_online = ?, published_print = ?, published_at = ? WHERE id = ?`
);

let ok = 0;
let fail = 0;
for (const r of rows) {
  try {
    const res = await fetch(
      `https://api.crossref.org/works/${encodeURIComponent(r.doi)}${mailto ? `?mailto=${mailto}` : ""}`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const w = (await res.json()).message;
    const online = fmt(w["published-online"]);
    const print = fmt(w["published-print"]);
    const at = online ?? print ?? fmt(w["published"]) ?? fmt(w["created"]);
    update.run(online, print, at, r.id);
    ok++;
    console.log(`#${r.id} ${r.doi} → ${at ?? "无日期"}`);
  } catch (e) {
    fail++;
    console.error(`#${r.id} ${r.doi} 失败：${e.message}`);
  }
  await new Promise((res) => setTimeout(res, 1000)); // Crossref 限速礼貌等待
}

console.log(`完成：成功 ${ok}，失败 ${fail}`);
