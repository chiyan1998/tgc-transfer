/** llm_tasks 队列访问（design/data-model.md llm_tasks） */
import { getDb } from "../db-manager";

export type TaskType = "brief" | "pdf_probe" | "resource_discovery" | "deep_read";
export type TaskStatus = "pending" | "processing" | "done" | "failed" | "no_pdf";

/** 概要任务优先级（数值大优先）：手动 > 基线 > 个人优先源 > 个人普通 */
export const BRIEF_PRIORITY = {
  manual: 8,
  baseline: 6,
  personalPriority: 4,
  personal: 2,
} as const;

export interface TaskRow {
  id: number;
  type: TaskType;
  article_id: number;
  status: TaskStatus;
  priority: number;
  attempts: number;
  run_after: string;
  error: string | null;
  /** 个人概要任务归属用户；基线任务为 null */
  user_id: number | null;
}

const MAX_ATTEMPTS = 3;

export const tasksRepo = {
  /** 入队；同文章同类型已有未完成任务则跳过 */
  enqueue(type: TaskType, articleId: number, priority = 0, userId: number | null = null): number | null {
    const db = getDb();
    const existing = db
      .prepare("SELECT id FROM llm_tasks WHERE type = ? AND article_id = ? AND status IN ('pending','processing')")
      .get(type, articleId);
    if (existing) return null;
    const info = db
      .prepare("INSERT INTO llm_tasks (type, article_id, priority, user_id) VALUES (?, ?, ?, ?)")
      .run(type, articleId, priority, userId);
    return Number(info.lastInsertRowid);
  },
  /** 当日额度已超：推迟到次日零点（本地时区），不计重试 */
  deferUntilTomorrow(id: number): void {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const utc = tomorrow.toISOString().replace("T", " ").slice(0, 19);
    getDb()
      .prepare("UPDATE llm_tasks SET status = 'pending', run_after = ?, updated_at = datetime('now') WHERE id = ?")
      .run(utc, id);
  },
  /** 领取一个到期任务（置为 processing） */
  claim(): TaskRow | null {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT * FROM llm_tasks
         WHERE status = 'pending' AND run_after <= datetime('now')
         ORDER BY priority DESC, id ASC LIMIT 1`
      )
      .get() as TaskRow | undefined;
    if (!row) return null;
    db.prepare("UPDATE llm_tasks SET status = 'processing', updated_at = datetime('now') WHERE id = ?").run(row.id);
    return { ...row, status: "processing" };
  },
  markDone(id: number): void {
    getDb()
      .prepare("UPDATE llm_tasks SET status = 'done', error = NULL, updated_at = datetime('now') WHERE id = ?")
      .run(id);
  },
  /** 失败：未达上限则指数退避重回 pending，否则 failed */
  markFailed(id: number, error: string): void {
    const db = getDb();
    const row = db.prepare("SELECT attempts FROM llm_tasks WHERE id = ?").get(id) as { attempts: number } | undefined;
    const attempts = (row?.attempts ?? 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      db.prepare(
        "UPDATE llm_tasks SET status = 'failed', attempts = ?, error = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(attempts, error, id);
    } else {
      const backoffSec = 60 * 2 ** attempts;
      db.prepare(
        `UPDATE llm_tasks SET status = 'pending', attempts = ?, error = ?,
         run_after = datetime('now', '+' || ? || ' seconds'), updated_at = datetime('now') WHERE id = ?`
      ).run(attempts, error, backoffSec, id);
    }
  },
  markNoPdf(id: number): void {
    getDb().prepare("UPDATE llm_tasks SET status = 'no_pdf', updated_at = datetime('now') WHERE id = ?").run(id);
  },
  /** 进程重启恢复：processing 超 10 分钟的重置为 pending */
  reclaimStale(): number {
    return getDb()
      .prepare(
        "UPDATE llm_tasks SET status = 'pending' WHERE status = 'processing' AND updated_at < datetime('now', '-10 minutes')"
      )
      .run().changes;
  },
  backlog(): Record<string, number> {
    const rows = getDb()
      .prepare("SELECT status, COUNT(*) AS c FROM llm_tasks GROUP BY status")
      .all() as { status: string; c: number }[];
    return Object.fromEntries(rows.map((r) => [r.status, r.c]));
  },
};
