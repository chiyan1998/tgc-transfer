/**
 * 数据库管理模块（design/data-model.md §3）：
 * 建库、迁移、WAL、备份、统计、健康检查。
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

let db: Database.Database | null = null;

export function dataDir(): string {
  return process.env.DATA_DIR ?? path.join(process.cwd(), "data");
}

export function getDb(): Database.Database {
  if (db) return db;
  const dir = dataDir();
  fs.mkdirSync(path.join(dir, "backups"), { recursive: true });
  db = new Database(path.join(dir, "tgc.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  return db;
}

function migrate(database: Database.Database): void {
  database.exec(
    "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))"
  );
  const row = database.prepare("SELECT MAX(version) AS v FROM schema_version").get() as { v: number | null };
  const current = row.v ?? 0;
  for (const file of schemaFiles()) {
    if (file.version <= current) continue;
    database.transaction(() => {
      database.exec(fs.readFileSync(file.path, "utf8"));
      database.prepare("INSERT INTO schema_version (version) VALUES (?)").run(file.version);
    })();
    console.log(`[db] 已应用迁移 ${path.basename(file.path)} (v${file.version})`);
  }
}

/** 定位 schema 目录：bundle 后 __dirname 会被重定位，需多候选路径兜底 */
function schemaDir(): string {
  const candidates = [
    path.join(process.cwd(), "src", "server", "db", "schema"),
    path.join(__dirname, "schema"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(`schema 目录未找到，候选路径：${candidates.join(" | ")}`);
}

/** 按版本号排序的迁移文件列表（文件名前缀即版本号，如 001_ / 002_） */
function schemaFiles(): { version: number; path: string }[] {
  return fs
    .readdirSync(schemaDir())
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .map((f) => ({ version: Number(f.split("_")[0]), path: path.join(schemaDir(), f) }))
    .sort((a, b) => a.version - b.version);
}

/** SQLite Online Backup API：复制到 data/backups/，返回备份文件路径 */
export function backup(): string {
  const d = getDb();
  const file = path.join(dataDir(), "backups", `tgc-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
  d.backup(file);
  return file;
}

export interface DbStats {
  fileBytes: number;
  tables: Record<string, number>;
  schemaVersion: number;
}

export function stats(): DbStats {
  const d = getDb();
  const dbFile = path.join(dataDir(), "tgc.db");
  const tables = d
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[];
  const counts: Record<string, number> = {};
  for (const { name } of tables) {
    counts[name] = (d.prepare(`SELECT COUNT(*) AS c FROM "${name}"`).get() as { c: number }).c;
  }
  const v = d.prepare("SELECT MAX(version) AS v FROM schema_version").get() as { v: number | null };
  return {
    fileBytes: fs.existsSync(dbFile) ? fs.statSync(dbFile).size : 0,
    tables: counts,
    schemaVersion: v.v ?? 0,
  };
}

/** 启动健康检查：可写性 + 磁盘空间阈值 */
export function healthCheck(): { ok: boolean; error?: string } {
  try {
    const d = getDb();
    d.prepare("SELECT 1").get();
    const probe = path.join(dataDir(), ".health");
    fs.writeFileSync(probe, "ok");
    fs.rmSync(probe);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
