import { getDb } from "../db-manager";

export type SourceKind = "journal" | "arxiv" | "nber" | "book";

export interface SourceRow {
  id: number;
  kind: SourceKind;
  identifier: string;
  name: string;
  publisher: string | null;
  rss_url: string | null;
  fetch_interval_min: number;
  last_fetched_at: string | null;
  active: number;
  /** 基线源：抓取+摘要由开发者全局模型承担（004 迁移） */
  is_baseline: number;
  created_at: string;
}

export const sourcesRepo = {
  findById(id: number): SourceRow | undefined {
    return getDb().prepare("SELECT * FROM sources WHERE id = ?").get(id) as SourceRow | undefined;
  },
  findByKey(kind: string, identifier: string): SourceRow | undefined {
    return getDb().prepare("SELECT * FROM sources WHERE kind = ? AND identifier = ?").get(kind, identifier) as
      | SourceRow
      | undefined;
  },
  /** 全局源列表（源是共享的，订阅按用户） */
  listActive(): SourceRow[] {
    return getDb().prepare("SELECT * FROM sources WHERE active = 1 ORDER BY id").all() as SourceRow[];
  },
  /** 到期需要抓取的源：未抓过，或距上次抓取超过各自间隔 */
  listDue(now: Date = new Date()): SourceRow[] {
    return this.listActive().filter((s) => {
      if (!s.last_fetched_at) return true;
      const last = new Date(s.last_fetched_at + "Z");
      return now.getTime() - last.getTime() >= s.fetch_interval_min * 60_000;
    });
  },
  upsert(input: { kind: SourceKind; identifier: string; name: string; publisher?: string | null; rss_url?: string | null }): SourceRow {
    const db = getDb();
    db.prepare(
      `INSERT INTO sources (kind, identifier, name, publisher, rss_url)
       VALUES (@kind, @identifier, @name, @publisher, @rss_url)
       ON CONFLICT(kind, identifier) DO UPDATE SET name = excluded.name, publisher = excluded.publisher`
    ).run({
      kind: input.kind,
      identifier: input.identifier,
      name: input.name,
      publisher: input.publisher ?? null,
      rss_url: input.rss_url ?? null,
    });
    return this.findByKey(input.kind, input.identifier)!;
  },
  markFetched(id: number, at: Date = new Date()): void {
    getDb()
      .prepare("UPDATE sources SET last_fetched_at = ? WHERE id = ?")
      .run(at.toISOString().replace("T", " ").slice(0, 19), id);
  },
  updateRssUrl(id: number, rssUrl: string | null): void {
    getDb().prepare("UPDATE sources SET rss_url = ? WHERE id = ?").run(rssUrl, id);
  },
  setActive(id: number, active: boolean): void {
    getDb().prepare("UPDATE sources SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
  },
  setBaseline(id: number, baseline: boolean): void {
    getDb().prepare("UPDATE sources SET is_baseline = ? WHERE id = ?").run(baseline ? 1 : 0, id);
  },
};

export const subscriptionsRepo = {
  subscribe(userId: number, sourceId: number): void {
    getDb()
      .prepare("INSERT OR IGNORE INTO subscriptions (user_id, source_id) VALUES (?, ?)")
      .run(userId, sourceId);
  },
  unsubscribe(userId: number, sourceId: number): void {
    getDb().prepare("DELETE FROM subscriptions WHERE user_id = ? AND source_id = ?").run(userId, sourceId);
  },
  listByUser(userId: number): SourceRow[] {
    return getDb()
      .prepare(
        `SELECT s.* FROM sources s JOIN subscriptions sub ON sub.source_id = s.id
         WHERE sub.user_id = ? ORDER BY s.name`
      )
      .all(userId) as SourceRow[];
  },
  /** 所有"至少被一个用户订阅"的活跃源 */
  listSubscribedActive(): SourceRow[] {
    return getDb()
      .prepare(
        `SELECT DISTINCT s.* FROM sources s JOIN subscriptions sub ON sub.source_id = s.id
         WHERE s.active = 1 ORDER BY s.id`
      )
      .all() as SourceRow[];
  },
  /** 订阅了指定源的用户 id 列表 */
  listSubscribers(sourceId: number): number[] {
    const rows = getDb()
      .prepare("SELECT user_id FROM subscriptions WHERE source_id = ?")
      .all(sourceId) as { user_id: number }[];
    return rows.map((r) => r.user_id);
  },
};

export const fetchLogsRepo = {
  start(sourceId: number): number {
    const info = getDb()
      .prepare("INSERT INTO fetch_logs (source_id, started_at) VALUES (?, datetime('now'))")
      .run(sourceId);
    return Number(info.lastInsertRowid);
  },
  finish(logId: number, newCount: number, error?: string): void {
    getDb()
      .prepare("UPDATE fetch_logs SET finished_at = datetime('now'), new_count = ?, error = ? WHERE id = ?")
      .run(newCount, error ?? null, logId);
  },
  lastForSource(sourceId: number): { new_count: number; started_at: string; error: string | null } | undefined {
    return getDb()
      .prepare("SELECT new_count, started_at, error FROM fetch_logs WHERE source_id = ? ORDER BY id DESC LIMIT 1")
      .get(sourceId) as { new_count: number; started_at: string; error: string | null } | undefined;
  },
};
