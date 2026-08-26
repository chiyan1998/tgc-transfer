/**
 * 用户额度偏好（004 迁移）：每日自动摘要上限与优先摘要订阅源。
 * brief_daily_cap = 0 表示「仅手动触发」，不自动消耗个人 Key。
 */
import { getDb } from "../db-manager";

export interface QuotaPrefsRow {
  user_id: number;
  brief_daily_cap: number;
  priority_source_ids: string;
  updated_at: string;
}

export interface QuotaPrefs {
  briefDailyCap: number;
  prioritySourceIds: number[];
}

const DEFAULT_CAP = 20;

function parseIds(json: string): number[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((n): n is number => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

export const quotaRepo = {
  get(userId: number): QuotaPrefs {
    const row = getDb()
      .prepare("SELECT * FROM user_quota_prefs WHERE user_id = ?")
      .get(userId) as QuotaPrefsRow | undefined;
    if (!row) return { briefDailyCap: DEFAULT_CAP, prioritySourceIds: [] };
    return { briefDailyCap: row.brief_daily_cap, prioritySourceIds: parseIds(row.priority_source_ids) };
  },
  set(userId: number, prefs: QuotaPrefs): QuotaPrefs {
    getDb()
      .prepare(
        `INSERT INTO user_quota_prefs (user_id, brief_daily_cap, priority_source_ids, updated_at)
         VALUES (@user_id, @cap, @ids, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET
           brief_daily_cap = excluded.brief_daily_cap,
           priority_source_ids = excluded.priority_source_ids,
           updated_at = datetime('now')`
      )
      .run({ user_id: userId, cap: prefs.briefDailyCap, ids: JSON.stringify(prefs.prioritySourceIds) });
    return prefs;
  },
};
