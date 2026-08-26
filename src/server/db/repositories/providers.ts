import { getDb } from "../db-manager";
import { decryptSecret } from "@/server/security/crypto";
import type { LlmConfig } from "@/server/llm/client";

export type LlmSlot = "brief" | "brief_personal" | "notes";

export interface ProviderRow {
  id: number;
  user_id: number;
  slot: LlmSlot;
  base_url: string;
  model: string;
  api_key_enc: string;
  updated_at: string;
}

export const providersRepo = {
  get(userId: number, slot: LlmSlot): ProviderRow | undefined {
    return getDb()
      .prepare("SELECT * FROM llm_providers WHERE user_id = ? AND slot = ?")
      .get(userId, slot) as ProviderRow | undefined;
  },
  /** 全局概要配置：取任一（管理员）配置的 brief 槽，最近更新优先 */
  getBriefGlobal(): ProviderRow | undefined {
    return getDb()
      .prepare("SELECT * FROM llm_providers WHERE slot = 'brief' ORDER BY updated_at DESC LIMIT 1")
      .get() as ProviderRow | undefined;
  },
  upsert(userId: number, slot: LlmSlot, input: { baseUrl: string; model: string; apiKeyEnc: string }): ProviderRow {
    getDb()
      .prepare(
        `INSERT INTO llm_providers (user_id, slot, base_url, model, api_key_enc, updated_at)
         VALUES (@user_id, @slot, @base_url, @model, @api_key_enc, datetime('now'))
         ON CONFLICT(user_id, slot) DO UPDATE SET
           base_url = excluded.base_url, model = excluded.model,
           api_key_enc = excluded.api_key_enc, updated_at = excluded.updated_at`
      )
      .run({
        user_id: userId,
        slot,
        base_url: input.baseUrl,
        model: input.model,
        api_key_enc: input.apiKeyEnc,
      });
    return this.get(userId, slot)!;
  },
  remove(userId: number, slot: LlmSlot): void {
    getDb().prepare("DELETE FROM llm_providers WHERE user_id = ? AND slot = ?").run(userId, slot);
  },
  /** 解析用户个人概要模型配置（非基线源摘要用）；未配置或密文损坏返回 null */
  resolvePersonalBrief(userId: number): LlmConfig | null {
    const row = this.get(userId, "brief_personal");
    if (!row) return null;
    try {
      return { baseUrl: row.base_url, apiKey: decryptSecret(row.api_key_enc), model: row.model };
    } catch {
      return null;
    }
  },
};
