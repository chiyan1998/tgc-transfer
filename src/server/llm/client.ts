/**
 * OpenAI 兼容 LLM 客户端（design/architecture.md §2）：
 * 仅服务端持有密钥；超时、重试、脱敏。
 * 配置优先级：DB 模型配置（设置页） > .env.local 环境变量。
 */
import OpenAI from "openai";
import { maskSecrets } from "../security/mask";
import { providersRepo } from "../db/repositories/providers";
import { decryptSecret } from "../security/crypto";

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function envLlmConfig(): LlmConfig | null {
  if (process.env.LLM_API_KEY && process.env.LLM_BASE_URL && process.env.LLM_MODEL) {
    return { baseUrl: process.env.LLM_BASE_URL, apiKey: process.env.LLM_API_KEY, model: process.env.LLM_MODEL };
  }
  return null;
}

/** 快速概要配置解析：DB 全局配置优先，回退环境变量 */
export function resolveBriefConfig(): LlmConfig | null {
  const row = providersRepo.getBriefGlobal();
  if (row) {
    try {
      return { baseUrl: row.base_url, apiKey: decryptSecret(row.api_key_enc), model: row.model };
    } catch {
      // 密文损坏（如 AUTH_SECRET 变更）时降级到环境变量
    }
  }
  return envLlmConfig();
}

export function isLlmConfigured(): boolean {
  return resolveBriefConfig() !== null;
}

export function llmModel(): string {
  return resolveBriefConfig()?.model ?? "";
}

export function getLlmClient(config?: LlmConfig): OpenAI {
  const c = config ?? resolveBriefConfig();
  if (!c) {
    throw new Error("LLM 未配置：请在设置页配置模型，或在 .env.local 设置 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL");
  }
  return new OpenAI({
    baseURL: c.baseUrl,
    apiKey: c.apiKey,
    timeout: 120_000,
    maxRetries: 2,
  });
}

export interface ChatResult {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export async function chat(
  opts: {
    system: string;
    user: string;
    temperature?: number;
    maxTokens?: number;
    /** 要求 JSON 输出时置为 true */
    jsonMode?: boolean;
  },
  config?: LlmConfig
): Promise<ChatResult> {
  const resolved = config ?? resolveBriefConfig();
  const c = getLlmClient(resolved ?? undefined);
  try {
    const res = await c.chat.completions.create({
      model: resolved?.model ?? "",
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 2000,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
    });
    return {
      text: res.choices[0]?.message?.content ?? "",
      model: res.model ?? resolved?.model ?? "",
      promptTokens: res.usage?.prompt_tokens ?? 0,
      completionTokens: res.usage?.completion_tokens ?? 0,
      totalTokens: res.usage?.total_tokens ?? 0,
    };
  } catch (e) {
    throw new Error(maskSecrets(e instanceof Error ? e.message : String(e)));
  }
}

/**
 * 启动自检 / 设置页测试连接（design/architecture.md §7 第 2 层）：
 * 验证配置完整性与连通性；失败仅提示“密钥无效”，不回显密钥。
 */
export async function selfCheck(config?: LlmConfig): Promise<{ ok: boolean; error?: string }> {
  const c = config ?? resolveBriefConfig();
  if (!c) {
    return { ok: false, error: "LLM 未配置（设置页或 .env.local 均无配置）" };
  }
  try {
    await getLlmClient(c).models.list();
    return { ok: true };
  } catch {
    return { ok: false, error: "LLM 密钥无效或端点不可达（请检查配置，具体错误已脱敏）" };
  }
}
