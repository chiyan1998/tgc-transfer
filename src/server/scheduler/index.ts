/**
 * 调度器与队列 Worker（design/architecture.md §5）。
 * 与 Web 进程同进程运行，经 instrumentation.ts 注册，避免 dev HMR 重复启动。
 */
import cron from "node-cron";
import { fetchDueSources } from "@/server/ingest";
import { tasksRepo, BRIEF_PRIORITY } from "@/server/db/repositories/tasks";
import { quotaRepo } from "@/server/db/repositories/quota";
import { usageRepo } from "@/server/db/repositories/usage";
import { processBriefTask } from "@/server/pipeline/brief";
import { maskSecrets } from "@/server/security/mask";
import { healthCheck } from "@/server/db/db-manager";
import { selfCheck } from "@/server/llm/client";

let fetching = false;

/** 抓取所有到期源 */
export async function runFetchCycle(): Promise<void> {
  if (fetching) return;
  fetching = true;
  try {
    await fetchDueSources();
  } finally {
    fetching = false;
  }
}

async function processOneTask(): Promise<boolean> {
  const task = tasksRepo.claim();
  if (!task) return false;
  try {
    // 个人自动概要的每日额度检查（手动触发的任务不受限；超限推迟到次日）
    if (task.type === "brief" && task.user_id != null && task.priority < BRIEF_PRIORITY.manual) {
      const prefs = quotaRepo.get(task.user_id);
      if (usageRepo.countBriefTodayForUser(task.user_id) >= prefs.briefDailyCap) {
        tasksRepo.deferUntilTomorrow(task.id);
        return true;
      }
    }
    if (task.type === "brief") {
      await processBriefTask(task);
    }
    // pdf_probe / resource_discovery / deep_read：M3 接入
    tasksRepo.markDone(task.id);
  } catch (e) {
    tasksRepo.markFailed(task.id, maskSecrets(e instanceof Error ? e.message : String(e)));
  }
  return true;
}

let workerTimer: NodeJS.Timeout | null = null;

function startQueueWorker(): void {
  if (workerTimer) return;
  workerTimer = setInterval(async () => {
    try {
      // 单进程简单串行；需要并发时在此扩展
      await processOneTask();
    } catch (e) {
      console.error("[worker] loop error:", maskSecrets(String(e)));
    }
  }, 5_000);
  workerTimer.unref();
}

export function startServerRuntime(): void {
  const g = globalThis as Record<string, unknown>;
  if (g.__tgcRuntimeStarted) return;
  g.__tgcRuntimeStarted = true;

  const health = healthCheck();
  if (!health.ok) console.error("[runtime] db health check failed:", health.error);

  selfCheck().then((r) => {
    if (r.ok) console.log("[runtime] LLM 自检通过");
    else console.warn("[runtime]", r.error);
  });

  tasksRepo.reclaimStale();

  // 每 5 分钟扫描到期源（源各自还有 fetch_interval_min 控制）
  cron.schedule("*/5 * * * *", () => {
    runFetchCycle().catch((e) => console.error("[scheduler]", maskSecrets(String(e))));
  });
  // 启动后立即跑一轮
  runFetchCycle().catch(() => undefined);

  startQueueWorker();
  console.log("[runtime] TGC Transfer 服务端运行时已启动");
}
