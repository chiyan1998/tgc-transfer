import { getDb } from "../db-manager";

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: "admin" | "user";
  /** 006 迁移：邮箱验证时间，NULL=未验证 */
  email_verified_at: string | null;
  /** 006 迁移：连续登录失败次数 */
  login_attempts: number;
  /** 006 迁移：锁定截止时间（UTC 字符串） */
  locked_until: string | null;
  created_at: string;
}

/** 连续失败多少次后锁定 / 锁定时长（分钟） */
export const LOCK_AFTER = 5;
export const LOCK_MINUTES = 15;

export const usersRepo = {
  findByEmail(email: string): UserRow | undefined {
    return getDb().prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
  },
  findById(id: number): UserRow | undefined {
    return getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  },
  create(input: { email: string; passwordHash: string; name: string; role?: string; verified?: boolean }): UserRow {
    const db = getDb();
    const info = db
      .prepare(
        "INSERT INTO users (email, password_hash, name, role, email_verified_at) VALUES (?, ?, ?, ?, datetime('now'))"
      )
      .run(input.email, input.passwordHash, input.name, input.role ?? "user");
    const user = this.findById(Number(info.lastInsertRowid))!;
    if (!input.verified) {
      db.prepare("UPDATE users SET email_verified_at = NULL WHERE id = ?").run(user.id);
      return { ...user, email_verified_at: null };
    }
    return user;
  },
  count(): number {
    return (getDb().prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c;
  },
  listAll(): UserRow[] {
    return getDb().prepare("SELECT * FROM users ORDER BY id").all() as UserRow[];
  },
  markVerified(id: number): void {
    getDb().prepare("UPDATE users SET email_verified_at = datetime('now') WHERE id = ?").run(id);
  },
  updatePassword(id: number, passwordHash: string): void {
    getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, id);
  },
  updateName(id: number, name: string): void {
    getDb().prepare("UPDATE users SET name = ? WHERE id = ?").run(name, id);
  },
  updateRole(id: number, role: "admin" | "user"): void {
    getDb().prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
  },
  /** 锁定未过期返回剩余分钟数 */
  lockedMinutesLeft(user: UserRow, now: Date = new Date()): number {
    if (!user.locked_until) return 0;
    const until = new Date(user.locked_until + "Z");
    const left = Math.ceil((until.getTime() - now.getTime()) / 60_000);
    return left > 0 ? left : 0;
  },
  /** 登录成功：清零失败计数与锁定 */
  clearLoginFailure(id: number): void {
    getDb().prepare("UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = ?").run(id);
  },
  /** 登录失败：计数+1，达阈值则锁定并清零；返回是否新触发锁定 */
  registerLoginFailure(id: number): boolean {
    const db = getDb();
    const row = db.prepare("SELECT login_attempts FROM users WHERE id = ?").get(id) as { login_attempts: number };
    const attempts = row.login_attempts + 1;
    if (attempts >= LOCK_AFTER) {
      db.prepare(
        "UPDATE users SET login_attempts = 0, locked_until = datetime('now', '+' || ? || ' minutes') WHERE id = ?"
      ).run(LOCK_MINUTES, id);
      return true;
    }
    db.prepare("UPDATE users SET login_attempts = ? WHERE id = ?").run(attempts, id);
    return false;
  },
};
