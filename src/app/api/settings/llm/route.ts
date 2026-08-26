/**
 * 模型配置 API（M1 迭代意见 7）：
 * slot=brief 快速概要（全局共享，仅管理员可写）；slot=notes 阅读笔记（每用户）。
 * API Key 以 AES-256-GCM 密文入库，GET 仅回显掩码。
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/api-utils";
import { providersRepo, type LlmSlot } from "@/server/db/repositories/providers";
import { encryptSecret, decryptSecret } from "@/server/security/crypto";
import { envLlmConfig, resolveBriefConfig } from "@/server/llm/client";

/** Key 掩码：仅保留后 4 位 */
function maskKey(plain: string): string {
  const tail = plain.slice(-4);
  return `${plain.startsWith("sk-") ? "sk-" : ""}****${tail}`;
}

function serialize(slot: LlmSlot, row: ReturnType<typeof providersRepo.get>) {
  if (!row) return null;
  let masked = "";
  try {
    masked = maskKey(decryptSecret(row.api_key_enc));
  } catch {
    masked = "****（密文损坏）";
  }
  return {
    slot,
    baseUrl: row.base_url,
    model: row.model,
    apiKeyMasked: masked,
    updatedAt: row.updated_at,
  };
}

/** GET 模型配置：brief 取全局最新一条，notes 取本人 */
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const brief = serialize("brief", providersRepo.getBriefGlobal());
  const notes = serialize("notes", providersRepo.get(user.id, "notes"));
  const briefPersonal = serialize("brief_personal", providersRepo.get(user.id, "brief_personal"));
  // 当前实际生效的概要配置（DB 优先、环境变量回退），仅暴露提供商与模型名，不含 Key
  const eff = resolveBriefConfig();
  return NextResponse.json({
    data: {
      brief,
      notes,
      briefPersonal,
      isAdmin: user.role === "admin",
      // brief 无 DB 配置时是否回退到 .env.local
      briefEnvFallback: !brief && envLlmConfig() !== null,
      briefEffective: eff ? { baseUrl: eff.baseUrl, model: eff.model } : null,
    },
  });
}

const putSchema = z.object({
  slot: z.enum(["brief", "brief_personal", "notes"]),
  baseUrl: z.string().url().max(500),
  model: z.string().min(1).max(200),
  /** 留空表示沿用已存的 Key */
  apiKey: z.string().min(1).max(500).optional(),
});

/** PUT 保存模型配置 */
export async function PUT(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const body = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  }
  const { slot, baseUrl, model, apiKey } = parsed.data;
  if (slot === "brief" && user.role !== "admin") {
    return NextResponse.json({ error: "快速概要模型为全局配置，仅管理员可修改" }, { status: 403 });
  }
  const existing = providersRepo.get(user.id, slot);
  let apiKeyEnc: string;
  if (apiKey) {
    apiKeyEnc = encryptSecret(apiKey);
  } else if (existing?.api_key_enc) {
    apiKeyEnc = existing.api_key_enc;
  } else {
    return NextResponse.json({ error: "首次配置需要提供 API Key" }, { status: 400 });
  }
  const row = providersRepo.upsert(user.id, slot, { baseUrl, model, apiKeyEnc });
  return NextResponse.json({ data: serialize(slot, row) });
}

/** DELETE 清除本人某槽配置（brief 仅管理员可清） */
export async function DELETE(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const slot = new URL(req.url).searchParams.get("slot");
  if (slot !== "brief" && slot !== "brief_personal" && slot !== "notes") {
    return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  }
  if (slot === "brief" && user.role !== "admin") {
    return NextResponse.json({ error: "快速概要模型为全局配置，仅管理员可修改" }, { status: 403 });
  }
  providersRepo.remove(user.id, slot);
  return NextResponse.json({ data: { ok: true } });
}
