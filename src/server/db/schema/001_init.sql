-- 001 初始化：虎妞中转站（TGC Transfer）核心表
-- 详细字段说明见 design/data-model.md（v3）

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,                      -- journal / arxiv / nber / book（预留 ssrn）
  identifier TEXT NOT NULL,
  name TEXT NOT NULL,
  publisher TEXT,
  rss_url TEXT,
  fetch_interval_min INTEGER NOT NULL DEFAULT 30,
  last_fetched_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (kind, identifier)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, source_id)
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  doi TEXT,
  isbn TEXT,
  title TEXT NOT NULL,
  authors TEXT NOT NULL DEFAULT '[]',
  abstract TEXT,
  volume TEXT,
  issue TEXT,
  page TEXT,
  published_at TEXT,
  url TEXT NOT NULL DEFAULT '',
  cover_url TEXT,
  pdf_url TEXT,
  is_oa INTEGER NOT NULL DEFAULT 0,
  incomplete INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (source_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_articles_source_created ON articles(source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_created ON articles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_doi ON articles(doi);

CREATE TABLE IF NOT EXISTS paper_briefs (
  article_id INTEGER PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
  title_zh TEXT NOT NULL DEFAULT '',
  abstract_zh TEXT,
  field TEXT,
  paper_types TEXT NOT NULL DEFAULT '[]',
  research_question TEXT,
  conclusion TEXT,
  quality TEXT NOT NULL DEFAULT 'full',    -- full / partial
  content_hash TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS article_resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                      -- appendix / dataset / dataverse
  label TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  found_via TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (article_id, kind, url)
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  auto_refresh_on_login INTEGER NOT NULL DEFAULT 1,
  refresh_interval_min INTEGER NOT NULL DEFAULT 30,
  default_lang TEXT NOT NULL DEFAULT 'zh',
  obsidian_vault_path TEXT                 -- 预留：阅读笔记平台
);

CREATE TABLE IF NOT EXISTS user_article_states (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  is_read INTEGER NOT NULL DEFAULT 0,
  is_starred INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, article_id)
);

CREATE TABLE IF NOT EXISTS llm_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,                      -- brief / pdf_probe / resource_discovery / deep_read
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending / processing / done / failed / no_pdf
  priority INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  run_after TEXT NOT NULL DEFAULT (datetime('now')),
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_llm_tasks_queue ON llm_tasks(status, run_after, priority DESC);

CREATE TABLE IF NOT EXISTS fetch_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  new_count INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_fetch_logs_source ON fetch_logs(source_id, started_at DESC);
