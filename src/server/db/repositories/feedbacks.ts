/**
 * 反馈仓库（M2 迭代意见 2）：用户反馈入库与查询。
 */
import { getDb } from "@/server/db/db-manager";

export interface FeedbackRow {
  id: number;
  user_id: number;
  summary: string;
  detail: string;
  attachments: string;
  status: string;
  created_at: string;
}

export const feedbacksRepo = {
  insert(input: { userId: number; summary: string; detail: string; attachments: string[] }): number {
    const r = getDb()
      .prepare(
        `INSERT INTO feedbacks (user_id, summary, detail, attachments) VALUES (?, ?, ?, ?)`
      )
      .run(input.userId, input.summary, input.detail, JSON.stringify(input.attachments));
    return Number(r.lastInsertRowid);
  },

  listByUser(userId: number): FeedbackRow[] {
    return getDb()
      .prepare(`SELECT * FROM feedbacks WHERE user_id = ? ORDER BY id DESC`)
      .all(userId) as FeedbackRow[];
  },
};
