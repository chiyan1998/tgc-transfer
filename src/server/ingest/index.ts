/**
 * 抓取编排（design/architecture.md §3.1）：
 * 按源类型分发到适配器，去重入库，为新文章入队概要任务。
 */
import { articlesRepo } from "@/server/db/repositories/articles";
import { sourcesRepo, subscriptionsRepo, fetchLogsRepo, type SourceRow } from "@/server/db/repositories/sources";
import { enqueueBriefForArticle } from "@/server/pipeline/brief-routing";
import { fetchJournalWorks } from "./adapters/crossref";
import { fetchArxivCategory } from "./adapters/arxiv";
import { fetchNber } from "./adapters/nber";
import { maskSecrets } from "@/server/security/mask";

export interface FetchResult {
  sourceId: number;
  newCount: number;
  error?: string;
}

export async function fetchSource(source: SourceRow): Promise<FetchResult> {
  const logId = fetchLogsRepo.start(source.id);
  try {
    const since = source.last_fetched_at ? new Date(source.last_fetched_at + "Z") : null;
    let articles;
    switch (source.kind) {
      case "journal":
        articles = (await fetchJournalWorks(source.identifier, since)).articles;
        break;
      case "arxiv":
        articles = (await fetchArxivCategory(source.identifier)).articles;
        break;
      case "nber":
        articles = (await fetchNber()).articles;
        break;
      default:
        // book / ssrn 等：M3 实现，先跳过
        sourcesRepo.markFetched(source.id);
        fetchLogsRepo.finish(logId, 0);
        return { sourceId: source.id, newCount: 0 };
    }

    let newCount = 0;
    for (const input of articles) {
      const row = articlesRepo.insert({ ...input, sourceId: source.id });
      if (row) {
        newCount++;
        // 分层入队：基线源走全局模型，非基线源按订阅者个人配置路由（见 brief-routing）
        enqueueBriefForArticle(row.id);
      }
    }
    sourcesRepo.markFetched(source.id);
    fetchLogsRepo.finish(logId, newCount);
    console.log(`[ingest] ${source.kind}:${source.identifier} +${newCount} new`);
    return { sourceId: source.id, newCount };
  } catch (e) {
    const msg = maskSecrets(e instanceof Error ? e.message : String(e));
    fetchLogsRepo.finish(logId, 0, msg);
    console.error(`[ingest] ${source.kind}:${source.identifier} failed: ${msg}`);
    return { sourceId: source.id, newCount: 0, error: msg };
  }
}

/** 强制抓取全部活跃订阅源（手动刷新，忽略 fetch_interval_min） */
export async function fetchAllSources(): Promise<FetchResult[]> {
  const sources = subscriptionsRepo.listSubscribedActive();
  const results: FetchResult[] = [];
  for (const source of sources) {
    results.push(await fetchSource(source)); // 串行，尊重上游速率
  }
  return results;
}

/** 抓取全部到期的、且至少被一个用户订阅的活跃源 */
export async function fetchDueSources(): Promise<FetchResult[]> {
  const due = subscriptionsRepo.listSubscribedActive().filter((s) => {
    if (!s.last_fetched_at) return true;
    const last = new Date(s.last_fetched_at + "Z");
    return Date.now() - last.getTime() >= s.fetch_interval_min * 60_000;
  });
  const results: FetchResult[] = [];
  for (const source of due) {
    results.push(await fetchSource(source)); // 串行，尊重上游速率
  }
  return results;
}
