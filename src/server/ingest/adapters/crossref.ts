/**
 * Crossref 期刊抓取适配器（design/architecture.md §3.1）。
 * 按 ISSN 增量拉取（from-created-date 游标），mailto 进入 polite pool。
 */
import { safeFetchFollow } from "@/server/security/ssrf-guard";
import type { ArticleInput } from "@/server/db/repositories/articles";

const CROSSREF = "https://api.crossref.org";

function mailto(): string {
  return process.env.UNPAYWALL_EMAIL || "tgc-transfer@example.com";
}

interface CrossrefWork {
  DOI: string;
  title?: string[];
  author?: { given?: string; family?: string; name?: string }[];
  abstract?: string;
  volume?: string;
  issue?: string;
  page?: string;
  URL?: string;
  "published-print"?: { "date-parts": number[][] };
  "published-online"?: { "date-parts": number[][] };
  created?: { "date-time": string };
  link?: { URL: string; "content-type": string }[];
  "container-title"?: string[];
}

/** 期刊检索（订阅中心用） */
export async function searchJournals(query: string): Promise<{ issn: string; name: string; publisher: string }[]> {
  const url = `${CROSSREF}/journals?query=${encodeURIComponent(query)}&rows=15&mailto=${mailto()}`;
  const res = await safeFetchFollow(url);
  if (!res.ok) throw new Error(`crossref journals search failed: ${res.status}`);
  const json = (await res.json()) as { message: { items: { ISSN?: string[]; title?: string; publisher?: string }[] } };
  return (json.message.items ?? [])
    .filter((j) => j.ISSN?.length)
    .map((j) => ({ issn: j.ISSN![0], name: j.title ?? "Unknown", publisher: j.publisher ?? "" }));
}

/** 增量拉取某期刊的新文章 */
export async function fetchJournalWorks(
  issn: string,
  since: Date | null,
  opts?: { rows?: number }
): Promise<{ articles: ArticleInput[]; fetchedAt: Date }> {
  const rows = opts?.rows ?? 50;
  const from = since ? since.toISOString().slice(0, 10) : daysAgo(30);
  const url =
    `${CROSSREF}/journals/${encodeURIComponent(issn)}/works` +
    `?filter=from-created-date:${from}&sort=created&order=desc&rows=${rows}&mailto=${mailto()}`;
  const res = await safeFetchFollow(url);
  if (!res.ok) throw new Error(`crossref works failed: ${res.status}`);
  const json = (await res.json()) as { message: { items: CrossrefWork[] } };
  const articles: ArticleInput[] = (json.message.items ?? []).map((w) => {
    const pdfLink = w.link?.find((l) => l["content-type"] === "application/pdf");
    const fmt = (d?: { "date-parts": number[][] }): string | null => {
      const parts = d?.["date-parts"]?.[0];
      if (!parts?.length) return null;
      // 补零为 ISO 格式，保证范围过滤的字符串比较正确（Crossref 可能返回 [2026, 8]）
      const [y, m, day] = parts;
      if (!y) return null;
      const mm = m ? String(m).padStart(2, "0") : null;
      const dd = day ? String(day).padStart(2, "0") : null;
      return [y, mm, dd].filter(Boolean).join("-");
    };
    const online = fmt(w["published-online"]);
    const print = fmt(w["published-print"]);
    return {
      sourceId: 0, // 由调用方填入
      externalId: w.DOI,
      doi: w.DOI,
      title: (w.title?.[0] ?? "").trim(),
      authors: (w.author ?? []).map((a) => ({ given: a.given, family: a.family, name: a.name })),
      abstract: cleanAbstract(w.abstract),
      volume: w.volume ?? null,
      issue: w.issue ?? null,
      page: w.page ?? null,
      publishedAt: online ?? print,
      publishedOnline: online,
      publishedPrint: print,
      url: w.URL ?? `https://doi.org/${w.DOI}`,
      pdfUrl: pdfLink?.URL ?? null,
      isOa: Boolean(pdfLink),
      incomplete: !(w.title?.[0] ?? "").trim(),
    };
  });
  return { articles: articles.filter((a) => a.title), fetchedAt: new Date() };
}

/** Crossref 摘要常带 jats XML 标签，清洗为纯文本 */
function cleanAbstract(raw?: string): string | null {
  if (!raw) return null;
  const text = raw
    .replace(/<jats:title>.*?<\/jats:title>/gs, "")
    .replace(/<jats:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}
