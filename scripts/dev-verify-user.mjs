/**
 * 开发自测脚本：无 SMTP 环境时手动标记用户邮箱已验证。
 * 用法：npm run dev:verify-user -- email=someone@example.com
 */
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const emailArg = process.argv.find((a) => a.startsWith("email="));
if (!emailArg) {
  console.error("用法: npm run dev:verify-user -- email=someone@example.com");
  process.exit(1);
}
const email = emailArg.slice(6).trim().toLowerCase();

const db = new Database(path.join(root, "data", "tgc.db"));
const user = db.prepare("SELECT id, email, name, email_verified_at FROM users WHERE email = ?").get(email);
if (!user) {
  console.error(`未找到邮箱为 ${email} 的用户`);
  process.exit(1);
}
db.prepare("UPDATE users SET email_verified_at = datetime('now') WHERE id = ?").run(user.id);
console.log(`已将用户 #${user.id}（${user.name} <${user.email}>）标记为邮箱已验证`);
