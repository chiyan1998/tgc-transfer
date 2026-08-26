/**
 * 认证令牌（006 迁移）：邮箱验证/密码重置。
 * 安全约定：原文 token 仅出现在邮件链接，库内只存 SHA-256 哈希；
 * 24 小时过期、一次性使用。
 */
import { createHash, randomBytes } from "node:crypto";
import { getDb } from "../db-manager";

export type TokenKind = "verify" | "reset";

interface AuthTokenRow {
  id: number;
  user_id: number;
  kind: TokenKind;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

const TTL_HOURS = 24;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const authTokensRepo = {
  /** 签发新令牌；返回原文（仅此处与邮件链接持有） */
  issue(userId: number, kind: TokenKind): string {
    const token = randomBytes(32).toString("base64url");
    getDb()
      .prepare(
        `INSERT INTO auth_tokens (user_id, kind, token_hash, expires_at)
         VALUES (?, ?, ?, datetime('now', '+' || ? || ' hours'))`
      )
      .run(userId, kind, hashToken(token), TTL_HOURS);
    return token;
  },
  /** 校验并消费令牌；有效返回 user_id，否则 null（过期/已用/不存在统一处理） */
  consume(token: string, kind: TokenKind): number | null {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT * FROM auth_tokens
         WHERE token_hash = ? AND kind = ? AND used_at IS NULL AND expires_at > datetime('now')`
      )
      .get(hashToken(token), kind) as AuthTokenRow | undefined;
    if (!row) return null;
    db.prepare("UPDATE auth_tokens SET used_at = datetime('now') WHERE id = ?").run(row.id);
    return row.user_id;
  },
  /** 作废某用户某类型的全部未用令牌（签发新令牌前调用） */
  invalidateUserTokens(userId: number, kind: TokenKind): void {
    getDb()
      .prepare("UPDATE auth_tokens SET used_at = datetime('now') WHERE user_id = ? AND kind = ? AND used_at IS NULL")
      .run(userId, kind);
  },
  /** 最近一次签发时间（UTC 字符串），用于重发冷却 */
  lastIssuedAt(userId: number, kind: TokenKind): string | null {
    const row = getDb()
      .prepare("SELECT created_at FROM auth_tokens WHERE user_id = ? AND kind = ? ORDER BY id DESC LIMIT 1")
      .get(userId, kind) as { created_at: string } | undefined;
    return row?.created_at ?? null;
  },
  /** 今日签发次数（本地时区），用于每日上限 */
  countToday(userId: number, kind: TokenKind): number {
    const row = getDb()
      .prepare(
        `SELECT COUNT(*) AS c FROM auth_tokens
         WHERE user_id = ? AND kind = ? AND date(created_at, 'localtime') = date('now', 'localtime')`
      )
      .get(userId, kind) as { c: number };
    return row.c;
  },
};
