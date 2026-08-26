import { getDb } from "../db-manager";

export const usageRepo = {
  record(input: {
    taskType: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    articleId?: number | null;
  }): void {
    getDb()
      .prepare(
        `INSERT INTO llm_usage (task_type, model, prompt_tokens, completion_tokens, total_tokens, article_id)
         VALUES (@task_type, @model, @prompt_tokens, @completion_tokens, @total_tokens, @article_id)`
      )
      .run({
        task_type: input.taskType,
        model: input.model,
        prompt_tokens: input.promptTokens,
        completion_tokens: input.completionTokens,
        total_tokens: input.promptTokens + input.completionTokens,
        article_id: input.articleId ?? null,
      });
  },
  /** 按日 × 时段聚合（本地时区）；slot: 0 深夜(0-6) 1 上午(6-12) 2 下午(12-18) 3 晚间(18-24) */
  aggregateByDaySlot(days: number): { date: string; slot: number; tokens: number }[] {
    return getDb()
      .prepare(
        `SELECT date(created_at, 'localtime') AS date,
                CASE WHEN CAST(strftime('%H', created_at, 'localtime') AS INTEGER) < 6 THEN 0
                     WHEN CAST(strftime('%H', created_at, 'localtime') AS INTEGER) < 12 THEN 1
                     WHEN CAST(strftime('%H', created_at, 'localtime') AS INTEGER) < 18 THEN 2
                     ELSE 3 END AS slot,
                SUM(total_tokens) AS tokens
         FROM llm_usage
         WHERE created_at >= datetime('now', '-' || @days || ' days')
         GROUP BY date, slot`
      )
      .all({ days }) as { date: string; slot: number; tokens: number }[];
  },
  totals(): { today: number; week: number; all: number } {
    const pick = (where: string, params: Record<string, unknown> = {}): number =>
      ((getDb().prepare(`SELECT COALESCE(SUM(total_tokens), 0) AS t FROM llm_usage WHERE ${where}`).get(params) as { t: number }).t);
    return {
      today: pick("date(created_at, 'localtime') = date('now', 'localtime')"),
      week: pick("created_at >= datetime('now', '-7 days')"),
      all: pick("1 = 1"),
    };
  },
  /**
   * 用户今日已由个人模型摘要的篇数（额度口径，004 迁移）：
   * 归属规则按文章所属源为用户订阅的非基线源判定，基线源摘要由开发者承担不计入。
   */
  countBriefTodayForUser(userId: number): number {
    const row = getDb()
      .prepare(
        `SELECT COUNT(DISTINCT u.article_id) AS c
         FROM llm_usage u
         JOIN articles a ON a.id = u.article_id
         JOIN sources s ON s.id = a.source_id AND s.is_baseline = 0
         JOIN subscriptions sub ON sub.source_id = a.source_id AND sub.user_id = @userId
         WHERE u.task_type = 'brief' AND date(u.created_at, 'localtime') = date('now', 'localtime')`
      )
      .get({ userId }) as { c: number };
    return row.c;
  },
};
