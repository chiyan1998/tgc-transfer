/**
 * arXiv 官方 API 适配器（design/architecture.md §3.1）。
 * 按学科分类轮询，以 arXiv id 去重。
 */
import { safeFetchFollow } from "@/server/security/ssrf-guard";
import type { ArticleInput } from "@/server/db/repositories/articles";

const ARXIV_API = "https://export.arxiv.org/api/query";

/** 常用学科分类（订阅中心预置，可按需扩充） */
export const ARXIV_CATEGORIES: { id: string; label: string }[] = [
  { id: "econ.EM", label: "经济学 · 计量经济学 (econ.EM)" },
  { id: "econ.TH", label: "经济学 · 理论经济学 (econ.TH)" },
  { id: "econ.GN", label: "经济学 · 一般经济学 (econ.GN)" },
  { id: "stat.ML", label: "统计学 · 机器学习 (stat.ML)" },
  { id: "stat.ME", label: "统计学 · 统计方法 (stat.ME)" },
  { id: "cs.CL", label: "计算机 · 自然语言处理 (cs.CL)" },
  { id: "cs.LG", label: "计算机 · 机器学习 (cs.LG)" },
  { id: "cs.AI", label: "计算机 · 人工智能 (cs.AI)" },
  { id: "q-fin.ST", label: "量化金融 · 统计金融 (q-fin.ST)" },
  { id: "physics.soc-ph", label: "物理 · 社会物理学 (physics.soc-ph)" },
];

interface ArxivEntry {
  id: { _: string };
  title: { _: string };
  summary?: { _: string };
  published?: { _: string };
  updated?: { _: string };
  link?: { $: Record<string, string> }[];
  author?: { name: { _: string } }[];
}

export async function fetchArxivCategory(category: string): Promise<{ articles: ArticleInput[]; fetchedAt: Date }> {
  const url = `${ARXIV_API}?search_query=cat:${encodeURIComponent(category)}&sortBy=submittedDate&sortOrder=descending&max_results=50`;
  const res = await safeFetchFollow(url);
  if (!res.ok) throw new Error(`arxiv api failed: ${res.status}`);
  const xml = await res.text();
  const entries = parseEntries(xml);
  const articles: ArticleInput[] = entries.map((e) => {
    const arxivId = e.id._.replace(/^https?:\/\/arxiv\.org\/abs\//, "").replace(/v\d+$/, "");
    const pdf = e.link?.find((l) => l.$?.title === "pdf")?.$?.href ?? `https://arxiv.org/pdf/${arxivId}`;
    return {
      sourceId: 0,
      externalId: arxivId,
      doi: null,
      title: e.title._.replace(/\s+/g, " ").trim(),
      authors: (e.author ?? []).map((a) => ({ name: a.name._ })),
      abstract: e.summary?._.replace(/\s+/g, " ").trim() ?? null,
      publishedAt: e.published?._.slice(0, 10) ?? null,
      publishedOnline: e.published?._.slice(0, 10) ?? null, // arXiv 均为在线首发
      url: `https://arxiv.org/abs/${arxivId}`,
      pdfUrl: pdf,
      isOa: true, // arXiv 全开放
    };
  });
  return { articles, fetchedAt: new Date() };
}

/** 极简 Atom 解析：避免引入重依赖；entry 级字段抽取 */
function parseEntries(xml: string): ArxivEntry[] {
  const entries: ArxivEntry[] = [];
  const entryBlocks = xml.split("<entry>").slice(1);
  for (const block of entryBlocks) {
    const body = block.split("</entry>")[0];
    const pick = (tag: string): string | undefined => {
      const m = body.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return m?.[1]?.trim();
    };
    const id = pick("id");
    const title = pick("title");
    if (!id || !title) continue;
    const authors = [...body.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g)].map((m) => ({
      name: { _: m[1].trim() },
    }));
    const links = [...body.matchAll(/<link([^>]*)\/>/g)].map((m) => {
      const attrs: Record<string, string> = {};
      for (const am of m[1].matchAll(/(\w+)="([^"]*)"/g)) attrs[am[1]] = am[2];
      return { $: attrs };
    });
    entries.push({
      id: { _: id },
      title: { _: title },
      summary: pick("summary") ? { _: pick("summary")! } : undefined,
      published: pick("published") ? { _: pick("published")! } : undefined,
      link: links,
      author: authors,
    });
  }
  return entries;
}
