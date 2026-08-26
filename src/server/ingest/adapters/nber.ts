/**
 * NBER 官方 RSS 适配器（design/architecture.md §3.1）。
 * NBER 工作论文无官方 API，RSS 为官方发布渠道。
 */
import Parser from "rss-parser";
import { safeFetchFollow } from "@/server/security/ssrf-guard";
import type { ArticleInput } from "@/server/db/repositories/articles";

export const NBER_RSS_URL = "https://www.nber.org/rss/new.xml";

let parser: Parser | null = null;

export async function fetchNber(): Promise<{ articles: ArticleInput[]; fetchedAt: Date }> {
  const res = await safeFetchFollow(NBER_RSS_URL);
  if (!res.ok) throw new Error(`nber rss failed: ${res.status}`);
  const xml = await res.text();
  parser ??= new Parser();
  const feed = await parser.parseString(xml);
  const articles: ArticleInput[] = (feed.items ?? [])
    .map((item): ArticleInput | null => {
      const link = item.link ?? "";
      // 编号：链接形如 https://www.nber.org/papers/w12345
      const m = link.match(/\/papers\/([a-z0-9]+)/i);
      const wpNo = m?.[1];
      if (!wpNo || !item.title) return null;
      const creator = String(item.creator ?? "");
      return {
        sourceId: 0,
        externalId: wpNo,
        doi: null,
        title: item.title.trim(),
        authors: creator
          .split(/,| and /)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((name) => ({ name })),
        abstract: item.contentSnippet ?? item.content ?? null,
        publishedAt: item.isoDate?.slice(0, 10) ?? null,
        publishedOnline: item.isoDate?.slice(0, 10) ?? null, // 工作论文以发布日为准
        url: link,
        pdfUrl: null,
        isOa: false,
        incomplete: true, // NBER 摘要常不完整，标记供概要降级
      };
    })
    .filter((a): a is ArticleInput => a !== null);
  return { articles, fetchedAt: new Date() };
}
