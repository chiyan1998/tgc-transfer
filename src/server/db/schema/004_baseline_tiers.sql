-- v4：基线分层自动摘要（M2 迭代意见 3）
-- 基线源：抓取+摘要全走开发者全局模型；非基线源摘要走订阅者个人概要模型（含每日额度）

-- 1. 源级基线标记（开发者/管理员维护）
ALTER TABLE sources ADD COLUMN is_baseline INTEGER NOT NULL DEFAULT 0;

-- 2. 用户额度偏好：每日自动摘要上限（篇数，0=仅手动）+ 优先摘要的订阅源
CREATE TABLE IF NOT EXISTS user_quota_prefs (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  brief_daily_cap INTEGER NOT NULL DEFAULT 20,
  priority_source_ids TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. 任务归属：个人概要任务记录归属用户（基线任务为 NULL）
ALTER TABLE llm_tasks ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
