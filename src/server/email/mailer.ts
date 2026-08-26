/**
 * SMTP 邮件服务（账号体系升级）：注册验证邮件。
 * 凭据仅从环境变量读取（.env.local），不入库、不打日志。
 * 未配置 SMTP_HOST 时 isMailConfigured() 为 false，调用方应降级提示。
 */
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let cached: Transporter | null = null;

export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter(): Transporter {
  if (cached) return cached;
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: process.env.SMTP_SECURE !== "false", // 默认 465 TLS
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
  });
  return cached;
}

function fromAddress(): string {
  return process.env.SMTP_FROM ?? process.env.SMTP_USER!;
}

function baseUrl(): string {
  return process.env.APP_BASE_URL ?? "http://localhost:3000";
}

/** 发送注册验证邮件；未配置或发送失败抛错（调用方脱敏处理） */
export async function sendVerifyEmail(toEmail: string, token: string): Promise<void> {
  const link = `${baseUrl()}/api/auth/verify?token=${encodeURIComponent(token)}`;
  await getTransporter().sendMail({
    from: fromAddress(),
    to: toEmail,
    subject: "激活你的虎妞小猫账号",
    text: `你好！

请在 24 小时内点击下方链接完成邮箱验证，激活你的「虎妞小猫学术信息中转站」账号：

${link}

如非本人操作，请忽略此邮件。

—— 虎妞小猫学术信息中转站`,
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <h2 style="color:#b45309;">虎妞小猫学术信息中转站</h2>
      <p>你好！请点击下方按钮完成邮箱验证，激活你的账号（24 小时内有效）：</p>
      <p style="margin:24px 0;">
        <a href="${link}" style="background:#f59e0b;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;">激活账号</a>
      </p>
      <p style="color:#78716c;font-size:13px;">如按钮不可点，请复制以下链接到浏览器：<br/>${link}</p>
      <p style="color:#a8a29e;font-size:12px;">如非本人操作，请忽略此邮件。</p>
    </div>`,
  });
}
