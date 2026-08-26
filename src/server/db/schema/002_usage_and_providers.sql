-- 002: Token 消耗日志 + 模型配置 + 文章发表日期细分（M1 迭代）

-- LLM Token 消耗日志（仪表盘热力图数据源）
CREATE TABLE IF NOT EXISTS llm_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_type TEXT NOT NULL,                 -- brief / deep_read / notes
  model TEXT NOT NULL DEFAULT '',
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_llm_usage_created ON llm_usage(created_at);

-- 模型配置（API Key 以 AES-256-GCM 密文存储，见 security/crypto.ts）
-- slot=brief：快速概要（全局共享，管理员配置）；slot=notes：阅读笔记（每用户）
CREATE TABLE IF NOT EXISTS llm_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('brief', 'notes')),
  base_url TEXT NOT NULL,
  model TEXT NOT NULL,
  api_key_enc TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, slot)
);

-- 文章发表日期细分：online 优先，print 次之，published_at 保留兼容
ALTER TABLE articles ADD COLUMN published_online TEXT;
ALTER TABLE articles ADD COLUMN published_print TEXT;
