/**
 * 批量摘要（信息流体验升级）：对「订阅源 × 日期范围」内尚无概要的文章一键入队。
 * 基线源 → 全局模型（baseline 优先级）；非基线 → 触发者个人模型（personalBatch 最低优先级，
 * 受触发者每日额度约束，超额部分跳过；运行期调度器另有额度兜底推迟到次日）。
 */
import { articlesRepo } from "@/server/db/repositories/articles";
import { sourcesRepo } from "@/server/db/repositories/sources";
import { providersRepo } from "@/server/db/repositories/providers";
import { quotaRepo } from "@/server/db/repositories/quota";
import { usageRepo } from "@/server/db/repositories/usage";
import { tasksRepo, BRIEF_PRIORITY } from "@/server/db/repositories/tasks";

export type BatchRange = "today" | "week" | "month" | "quarter" | "halfyear" | "all";

export interface BatchResult {
  /** 本次实际入队（或可入队）篇数 */
  count: number;
  /** 受每日额度限制跳过的篇数 */
  skippedQuota: number;
  /** 非基线源但因触发者未配置个人概要模型无法处理的篇数 */
  noModel: number;
}

function splitByBaseline(userId: number, sourceIds: number[], range: BatchRange) {
  const rows = articlesRepo.listUnbriefedInScope({ userId, sourceIds, range });
  const baselineIds: number[] = [];
  const personalIds: number[] = [];
  for (const r of rows) {
    if (sourcesRepo.findById(r.source_id)?.is_baseline) baselineIds.push(r.id);
    else personalIds.push(r.id);
  }
  return { baselineIds, personalIds };
}

/** 预览：返回将入队的篇数构成（不落库） */
export function previewBatchBrief(userId: number, sourceIds: number[], range: BatchRange): BatchResult {
  const { baselineIds, personalIds } = splitByBaseline(userId, sourceIds, range);
  const hasModel = !!providersRepo.get(userId, "brief_personal");
  if (!hasModel) {
    return { count: baselineIds.length, skippedQuota: 0, noModel: personalIds.length };
  }
  const cap = quotaRepo.get(userId).briefDailyCap;
  const remaining = Math.max(0, cap - usageRepo.countBriefTodayForUser(userId));
  const take = Math.min(personalIds.length, remaining);
  return {
    count: baselineIds.length + take,
    skippedQuota: personalIds.length - take,
    noModel: 0,
  };
}

/** 执行：基线文章全部入队；个人文章按剩余额度入队（personalBatch 低优先级） */
export function runBatchBrief(userId: number, sourceIds: number[], range: BatchRange): BatchResult {
  const { baselineIds, personalIds } = splitByBaseline(userId, sourceIds, range);
  let enqueued = 0;
  for (const id of baselineIds) {
    if (tasksRepo.enqueue("brief", id, BRIEF_PRIORITY.baseline) !== null) enqueued++;
  }
  const hasModel = !!providersRepo.get(userId, "brief_personal");
  if (!hasModel) {
    return { count: enqueued, skippedQuota: 0, noModel: personalIds.length };
  }
  const cap = quotaRepo.get(userId).briefDailyCap;
  const remaining = Math.max(0, cap - usageRepo.countBriefTodayForUser(userId));
  let take = 0;
  for (const id of personalIds) {
    if (take >= remaining) break;
    if (tasksRepo.enqueue("brief", id, BRIEF_PRIORITY.personalBatch, userId) !== null) {
      enqueued++;
      take++;
    }
  }
  return { count: enqueued, skippedQuota: personalIds.length - take, noModel: 0 };
}
