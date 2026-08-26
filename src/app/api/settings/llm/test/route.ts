/**
 * 模型配置「测试连接」（M1 迭代意见 7）：
 * 用给定配置（或已存配置）调用 models.list 验证连通性；错误脱敏。
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/api-utils";
import { providersRepo } from "@/server/db/repositories/providers";
import { decryptSecret } from "@/server/security/crypto";
import { selfCheck, type LlmConfig } from "@/server/llm/client";

const bodySchema = z.object({
  slot: z.enum(["brief", "brief_personal", "notes"]),
  baseUrl: z.string().url().max(500).optional(),
  model: z.string().max(200).optional(),
  apiKey: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  }
  const stored = providersRepo.get(user.id, parsed.data.slot);
  let config: LlmConfig | null = null;
  if (parsed.data.baseUrl && (parsed.data.apiKey || stored?.api_key_enc)) {
    config = {
      baseUrl: parsed.data.baseUrl,
      model: parsed.data.model ?? "",
      apiKey: parsed.data.apiKey ?? decryptSecret(stored!.api_key_enc),
    };
  }
  const result = await selfCheck(config ?? undefined);
  return NextResponse.json({ data: result }, { status: result.ok ? 200 : 502 });
}
