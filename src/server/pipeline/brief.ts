/**
 * 快速概要生成（design/architecture.md §3.2）：
 * 一次 LLM 调用完成翻译 + 四要素概要（领域/类型/问题/结论），强制 JSON 输出。
 */
import crypto from "node:crypto";
import { articlesRepo } from "@/server/db/repositories/articles";
import { briefsRepo } from "@/server/db/repositories/articles";
import { usageRepo } from "@/server/db/repositories/usage";
import { providersRepo } from "@/server/db/repositories/providers";
import { subscriptionsRepo } from "@/server/db/repositories/sources";
import { chat, isLlmConfigured, type LlmConfig } from "@/server/llm/client";
import { paperTypesPromptBlock, PAPER_TYPE_KEYS } from "./paper-types";
import { cleanValue, cleanField, truncate } from "./brief-postprocess";
import type { TaskRow } from "@/server/db/repositories/tasks";

function contentHash(title: string, abstract: string | null): string {
  return crypto.createHash("sha256").update(`${title}\n${abstract ?? ""}`).digest("hex").slice(0, 16);
}

const SYSTEM_PROMPT = `你是学术文献分析助手。对给定的英文论文标题与摘要：
1. 翻译标题与摘要为简体中文（学术风格、准确简洁练）；
2. 判断研究领域（中文短语，如"计量经济学"）；
3. 判断论文类型（可多选，只能从以下取值中选择）：
${paperTypesPromptBlock()}
4. 提炼研究问题（中文，1~2 句）；
5. 提炼研究结论（中文，1~3 句）。

只输出 JSON，格式：
{"title_zh":"","abstract_zh":"","field":"","paper_types":[],"research_question":"","conclusion":""}
各字段值直接写内容，不要带标签前缀或 Markdown 记号。
若摘要缺失，abstract_zh/research_question/conclusion 输出空字符串。`;

/**
 * 解析概要任务的 LLM 配置：
 * 基线任务（无归属）用全局开发者模型；个人任务用归属用户的个人模型，
 * 归属用户配置失效时回退到同源其他已配置订阅者。
 */
function resolveTaskConfig(task: TaskRow): LlmConfig | undefined {
  if (task.user_id == null) {
    // 基线任务：返回 undefined 由 chat() 解析全局配置；未配置时抛错触发重试提示
    if (!isLlmConfigured()) throw new Error("LLM 未配置（设置页或 .env.local）");
    return undefined;
  }
  const ownerId = task.user_id;
  const own = providersRepo.resolvePersonalBrief(ownerId);
  if (own) return own;
  // 归属失效：回退到文章所属源的其他已配置订阅者
  const article = articlesRepo.findById(task.article_id);
  if (article) {
    for (const uid of subscriptionsRepo.listSubscribers(article.source_id)) {
      if (uid === ownerId) continue;
      const alt = providersRepo.resolvePersonalBrief(uid);
      if (alt) return alt;
    }
  }
  throw new Error("归属用户未配置个人概要模型");
}

export async function processBriefTask(task: TaskRow): Promise<void> {
  const config = resolveTaskConfig(task);
  const article = articlesRepo.findById(task.article_id);
  if (!article) return;

  const hash = contentHash(article.title, article.abstract);
  const user = `标题: ${article.title}\n\n摘要: ${article.abstract ?? "（无摘要）"}`;
  const res = await chat({ system: SYSTEM_PROMPT, user, jsonMode: true, maxTokens: 1500 }, config);

  // Token 消耗入账（仪表盘数据源）
  usageRepo.record({
    taskType: "brief",
    model: res.model,
    promptTokens: res.promptTokens,
    completionTokens: res.completionTokens,
    articleId: article.id,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(res.text);
  } catch {
    throw new Error("LLM 输出不是合法 JSON");
  }
  const types = Array.isArray(parsed.paper_types)
    ? (parsed.paper_types as string[]).filter((t) => PAPER_TYPE_KEYS.includes(t as never))
    : [];
  const quality = article.abstract ? "full" : "partial";

  // 后台整理：去前缀/去 Markdown/截断（见 brief-postprocess.ts）
  const titleZh = truncate(cleanValue(parsed.title_zh) || article.title, 300);
  const abstractZh = truncate(cleanValue(parsed.abstract_zh), 1200) || null;
  const researchQuestion = truncate(cleanValue(parsed.research_question), 200) || null;
  const conclusion = truncate(cleanValue(parsed.conclusion), 200) || null;

  briefsRepo.upsert({
    articleId: article.id,
    titleZh,
    abstractZh,
    field: cleanField(parsed.field) || null,
    paperTypes: types,
    researchQuestion,
    conclusion,
    quality,
    contentHash: hash,
    model: res.model,
  });
}
