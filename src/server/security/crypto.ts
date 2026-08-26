/**
 * 对称加解密（design/architecture.md §7 演进）：
 * 用户在设置页录入的 API Key 以 AES-256-GCM 密文入库，密钥派生自 AUTH_SECRET。
 * 界面与日志永不明文回显。
 */
import crypto from "node:crypto";

const ALGO = "aes-256-gcm";

function deriveKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET 未配置，无法加密存储密钥");
  return crypto.createHash("sha256").update(secret).digest();
}

/** 加密：iv:密文:tag 三段 base64 */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv.toString("base64"), enc.toString("base64"), cipher.getAuthTag().toString("base64")].join(":");
}

export function decryptSecret(payload: string): string {
  const [ivB64, encB64, tagB64] = payload.split(":");
  const decipher = crypto.createDecipheriv(ALGO, deriveKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encB64, "base64")), decipher.final()]).toString("utf8");
}

/** 掩码回显：仅保留末 4 位 */
export function maskKey(plain: string): string {
  return plain.length <= 4 ? "****" : `${plain.slice(0, 3)}****${plain.slice(-4)}`;
}
