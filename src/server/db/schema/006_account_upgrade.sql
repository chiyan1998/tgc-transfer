-- 006: 账号体系升级（邮箱验证 + 登录防护 + 验证令牌）

-- users 扩展：邮箱验证状态与登录失败锁定
ALTER TABLE users ADD COLUMN email_verified_at TEXT;
ALTER TABLE users ADD COLUMN login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TEXT;

-- 存量用户视为已验证，避免锁死现有账号
UPDATE users SET email_verified_at = datetime('now') WHERE email_verified_at IS NULL;

-- 验证/重置令牌（token 仅存 SHA-256 哈希，原文只出现在邮件链接）
CREATE TABLE IF NOT EXISTS auth_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('verify', 'reset')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id, kind);
