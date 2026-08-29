import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/api-utils";
import { articlesRepo, briefsRepo } from "@/server/db/repositories/articles";
import { sourcesRepo, subscriptionsRepo } from "@/server/db/repositories/sources";
import { PAPER_TYPE_KEYS } from "@/server/pipeline/paper-types";

const KIND_ALLOW = ["journal", "arxiv", "nber"];

const query = z.object({
  cursor: z.coerce.number().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  source_id: z.coerce.number().optional(),
  /** 单篇查询（卡片轮询待摘要状态），提供时忽略分页/筛选参数 */
  id: z.coerce.number().optional(),
  range: z.enum(["today", "week", "month", "quarter", "halfyear", "all"]).default("month"),
  oa: z.coerce.number().optional(),
  /** 搜索：英文/中文标题、来源名 */
  q: z.string().max(200).optional(),
  /** 来源类型，逗号分隔 */
  kinds: z.string().max(100).optional(),
  /** 论文类型，逗号分隔 */
  types: z.string().max(200).optional(),
  /** 排序字段（默认入库时间） */
  sort: z.enum(["ingest", "published", "source", "brief"]).default("ingest"),
  /** 排序方向（默认降序） */
  dir: z.enum(["asc", "desc"]).default("desc"),
  /** 具体来源多选，逗号分隔（仅限本人订阅） */
  sources: z.string().max(500).optional(),
});

export async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const parsed = query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "参数校验失败" }, { status: 422 });
  const q = parsed.data;

  // 具体来源多选：仅保留本人已订阅的源，防止越权查询
  const sourceIds = q.sources
    ?.split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  let filterSourceIds: number[] | undefined;
  if (sourceIds?.length) {
    const subscribed = new Set(subscriptionsRepo.listByUser(user.id).map((s) => s.id));
    filterSourceIds = sourceIds.filter((id) => subscribed.has(id));
    if (!filterSourceIds.length) return NextResponse.json({ data: { items: [], nextCursor: null } });
  }

  // 单篇查询：复用下方组装逻辑，强制 limit=1 且不走游标（id 升序游标不适用）
  const rows = q.id
    ? (() => {
        const r = articlesRepo.findById(q.id);
        return r ? [r] : [];
      })()
    : articlesRepo.listFeed({
    userId: user.id,
    cursor: q.cursor,
    limit: q.limit,
    sourceId: q.source_id,
    sourceIds: filterSourceIds,
    range: q.range,
    oaOnly: q.oa === 1,
    q: q.q,
    sort: q.sort,
    dir: q.dir,
    kinds: q.kinds
      ?.split(",")
      .map((s) => s.trim())
      .filter((s) => KIND_ALLOW.includes(s)),
    types: q.types
      ?.split(",")
      .map((s) => s.trim())
      .filter((s) => (PAPER_TYPE_KEYS as string[]).includes(s)),
  });
  const briefs = briefsRepo.forArticles(rows.map((r) => r.id));
  const sourceCache = new Map<number, { id: number; kind: string; name: string }>();

  const items = rows.map((r) => {
    let src = sourceCache.get(r.source_id);
    if (!src) {
      const s = sourcesRepo.findById(r.source_id);
      src = { id: r.source_id, kind: s?.kind ?? "", name: s?.name ?? "" };
      sourceCache.set(r.source_id, src);
    }
    const b = briefs.get(r.id);
    return {
      id: r.id,
      externalId: r.external_id,
      doi: r.doi,
      title: r.title,
      authors: JSON.parse(r.authors),
      abstract: r.abstract,
      volume: r.volume,
      issue: r.issue,
      page: r.page,
      publishedAt: r.published_at,
      publishedOnline: r.published_online,
      publishedPrint: r.published_print,
      url: r.url,
      pdfUrl: r.pdf_url,
      isOa: Boolean(r.is_oa),
      createdAt: r.created_at,
      source: src,
      brief: b
        ? {
            status: "done",
            titleZh: b.title_zh,
            abstractZh: b.abstract_zh,
            field: b.field,
            paperTypes: JSON.parse(String(b.paper_types ?? "[]")),
            researchQuestion: b.research_question,
            conclusion: b.conclusion,
            quality: b.quality,
          }
        : { status: "pending" },
    };
  });

  const nextCursor = q.id ? null : rows.length === q.limit ? rows[rows.length - 1].id : null;
  return NextResponse.json({ data: { items, nextCursor } });
}
