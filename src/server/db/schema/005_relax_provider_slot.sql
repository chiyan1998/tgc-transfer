-- 005: llm_providers.slot 放宽为三槽（基线分层自动摘要）
-- SQLite 无法 ALTER 修改 CHECK 约束，需重建表：brief | brief_personal | notes

CREATE TABLE IF NOT EXISTS llm_providers_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('brief', 'brief_personal', 'notes')),
  base_url TEXT NOT NULL,
  model TEXT NOT NULL,
  api_key_enc TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, slot)
);

INSERT INTO llm_providers_new (id, user_id, slot, base_url, model, api_key_enc, updated_at)
SELECT id, user_id, slot, base_url, model, api_key_enc, updated_at FROM llm_providers;

DROP TABLE llm_providers;
ALTER TABLE llm_providers_new RENAME TO llm_providers;
