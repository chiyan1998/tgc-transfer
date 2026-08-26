/**
 * 概要任务分层入队（基线分层自动摘要）：
 * 基线源 → 开发者全局模型；非基线源 → 已配置个人概要模型的订阅者，
 * 优先源订阅者归属优先；无人配置则不入队，保持「待摘要」等手动触发。
 */
import { articlesRepo } from "@/server/db/repositories/articles";
import { sourcesRepo, subscriptionsRepo } from "@/server/db/repositories/sources";
import { providersRepo } from "@/server/db/repositories/providers";
import { quotaRepo } from "@/server/db/repositories/quota";
import { tasksRepo, BRIEF_PRIORITY } from "@/server/db/repositories/tasks";

export function enqueueBriefForArticle(articleId: number): void {
  const article = articlesRepo.findById(articleId);
  if (!article) return;
  const source = sourcesRepo.findById(article.source_id);
  if (!source) return;

  if (source.is_baseline) {
    tasksRepo.enqueue("brief", articleId, BRIEF_PRIORITY.baseline);
    return;
  }

  // 非基线源：找已配置个人概要模型的订阅者作为任务归属
  let owner: number | null = null;
  let isPriority = false;
  for (const userId of subscriptionsRepo.listSubscribers(source.id)) {
    if (!providersRepo.get(userId, "brief_personal")) continue;
    if (owner === null) owner = userId;
    if (quotaRepo.get(userId).prioritySourceIds.includes(source.id)) {
      owner = userId;
      isPriority = true;
      break;
    }
  }
  if (owner === null) return; // 待摘要：等用户配置个人模型后手动触发
  tasksRepo.enqueue(
    "brief",
    articleId,
    isPriority ? BRIEF_PRIORITY.personalPriority : BRIEF_PRIORITY.personal,
    owner
  );
}
