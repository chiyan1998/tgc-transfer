import { getDb } from "../db-manager";

export interface ArticleRow {
  id: number;
  source_id: number;
  external_id: string;
  doi: string | null;
  isbn: string | null;
  title: string;
  authors: string;
  abstract: string | null;
  volume: string | null;
  issue: string | null;
  page: string | null;
  published_at: string | null;
  published_online: string | null;
  published_print: string | null;
  url: string;
  cover_url: string | null;
  pdf_url: string | null;
  is_oa: number;
  incomplete: number;
  created_at: string;
}

export interface ArticleInput {
  sourceId: number;
  externalId: string;
  doi?: string | null;
  isbn?: string | null;
  title: string;
  authors?: { given?: string; family?: string; name?: string }[];
  abstract?: string | null;
  volume?: string | null;
  issue?: string | null;
  page?: string | null;
  publishedAt?: string | null;
  publishedOnline?: string | null;
  publishedPrint?: string | null;
  url?: string;
  coverUrl?: string | null;
  pdfUrl?: string | null;
  isOa?: boolean;
  incomplete?: boolean;
}

export const articlesRepo = {
  findById(id: number): ArticleRow | undefined {
    return getDb().prepare("SELECT * FROM articles WHERE id = ?").get(id) as ArticleRow | undefined;
  },
  findByKey(sourceId: number, externalId: string): ArticleRow | undefined {
    return getDb()
      .prepare("SELECT * FROM articles WHERE source_id = ? AND external_id = ?")
      .get(sourceId, externalId) as ArticleRow | undefined;
  },
  /** 插入新文章；已存在则返回 null（DOI/编号去重由调用方保证） */
  insert(input: ArticleInput): ArticleRow | null {
    const db = getDb();
    const info = db
      .prepare(
        `INSERT OR IGNORE INTO articles
         (source_id, external_id, doi, isbn, title, authors, abstract, volume, issue, page,
          published_at, published_online, published_print, url, cover_url, pdf_url, is_oa, incomplete)
         VALUES (@source_id, @external_id, @doi, @isbn, @title, @authors, @abstract, @volume, @issue, @page,
                 @published_at, @published_online, @published_print, @url, @cover_url, @pdf_url, @is_oa, @incomplete)`
      )
      .run({
        source_id: input.sourceId,
        external_id: input.externalId,
        doi: input.doi ?? null,
        isbn: input.isbn ?? null,
        title: input.title,
        authors: JSON.stringify(input.authors ?? []),
        abstract: input.abstract ?? null,
        volume: input.volume ?? null,
        issue: input.issue ?? null,
        page: input.page ?? null,
        published_at: input.publishedAt ?? null,
        published_online: input.publishedOnline ?? null,
        published_print: input.publishedPrint ?? null,
        url: input.url ?? "",
        cover_url: input.coverUrl ?? null,
        pdf_url: input.pdfUrl ?? null,
        is_oa: input.isOa ? 1 : 0,
        incomplete: input.incomplete ? 1 : 0,
      });
    if (info.changes === 0) return null;
    return this.findById(Number(info.lastInsertRowid))!;
  },
  setPdf(id: number, pdfUrl: string | null, isOa: boolean): void {
    getDb().prepare("UPDATE articles SET pdf_url = ?, is_oa = ? WHERE id = ?").run(pdfUrl, isOa ? 1 : 0, id);
  },
  countSince(sinceUtc: string): number {
    return (getDb().prepare("SELECT COUNT(*) AS c FROM articles WHERE created_at > ?").get(sinceUtc) as { c: number })
      .c;
  },
  /** 某源下尚无概要的文章 id（基线回填 / 批量摘要用） */
  listUnbriefedIds(sourceId: number): number[] {
    const rows = getDb()
      .prepare(
        `SELECT a.id FROM articles a
         WHERE a.source_id = ? AND NOT EXISTS (SELECT 1 FROM paper_briefs b WHERE b.article_id = a.id)
         ORDER BY a.id`
      )
      .all(sourceId) as { id: number }[];
    return rows.map((r) => r.id);
  },
  /** 用户订阅范围内、指定来源与日期区间中尚无概要的文章（批量摘要/预览用） */
  listUnbriefedInScope(opts: {
    userId: number;
    sourceIds: number[];
    range?: "today" | "week" | "month" | "quarter" | "halfyear" | "all";
  }): { id: number; source_id: number }[] {
    if (!opts.sourceIds.length) return [];
    const pubExpr = "COALESCE(a.published_online, a.published_print, a.published_at, a.created_at)";
    const where: string[] = [
      "sub.user_id = @userId",
      `a.source_id IN (${opts.sourceIds.map((_, i) => `@sid${i}`).join(",")})`,
      "NOT EXISTS (SELECT 1 FROM paper_briefs b WHERE b.article_id = a.id)",
    ];
    const params: Record<string, unknown> = { userId: opts.userId };
    opts.sourceIds.forEach((sid, i) => {
      params[`sid${i}`] = sid;
    });
    const rangeDays: Record<string, number> = { today: 0, week: 7, month: 30, quarter: 90, halfyear: 180 };
    if (opts.range === "today") where.push(`date(${pubExpr}) = date('now')`);
    else if (opts.range && opts.range in rangeDays) where.push(`${pubExpr} >= datetime('now', '-${rangeDays[opts.range]} days')`);
    return getDb()
      .prepare(
        `SELECT a.id, a.source_id FROM articles a
         JOIN subscriptions sub ON sub.source_id = a.source_id
         WHERE ${where.join(" AND ")}
         ORDER BY a.id`
      )
      .all(params) as { id: number; source_id: number }[];
  },
  /** 信息流：仅返回当前用户订阅源的文章，按指定字段游标分页（键集排序，游标统一以 a.id 定位） */
  listFeed(opts: {
    userId: number;
    cursor?: number;
    limit?: number;
    sourceId?: number;
    sourceIds?: number[];
    range?: "today" | "week" | "month" | "quarter" | "halfyear" | "all";
    oaOnly?: boolean;
    /** 来源类型白名单过滤（journal / arxiv / nber） */
    kinds?: string[];
    /** 论文类型多标签过滤（paper_types JSON 包含任一） */
    types?: string[];
    /** 搜索：英文标题 / 中文标题 / 来源名 */
    q?: string;
    /** 排序字段（默认入库时间） */
    sort?: "ingest" | "published" | "source" | "brief";
    /** 排序方向（默认降序） */
    dir?: "asc" | "desc";
  }): ArticleRow[] {
    const limit = Math.min(opts.limit ?? 20, 100);
    const sort = opts.sort ?? "ingest";
    const dir = opts.dir ?? "desc";
    // 发表时间优先：online → print → 通用 → 入库时间兜底；摘要状态 1=已摘要（降序时在前）
    const pubExpr = "COALESCE(a.published_online, a.published_print, a.published_at, a.created_at)";
    const SORT_EXPR: Record<string, string> = {
      ingest: "a.id",
      published: pubExpr,
      source: "src.name",
      brief: "CASE WHEN EXISTS (SELECT 1 FROM paper_briefs pb WHERE pb.article_id = a.id) THEN 1 ELSE 0 END",
    };
    const sortExpr = SORT_EXPR[sort];
    const where: string[] = ["sub.user_id = @userId"];
    const params: Record<string, unknown> = {
      userId: opts.userId,
      limit,
    };
    // 游标键集：(sortExpr, a.id) < / > (@sortVal, @cursor)；sortVal 回查游标行取得（来源名同值跨界允许轻微误差）
    if (opts.cursor != null) {
      let sortVal: unknown = opts.cursor;
      if (sort !== "ingest") {
        const row = getDb()
          .prepare(`SELECT ${sortExpr} AS v FROM articles a JOIN sources src ON src.id = a.source_id WHERE a.id = ?`)
          .get(opts.cursor) as { v: unknown } | undefined;
        if (row == null) {
          // 游标行已不存在：退化为仅按 a.id 键集翻页，保持可用
          where.push(dir === "desc" ? "a.id < @cursor" : "a.id > @cursor");
          params.cursor = opts.cursor;
        } else {
          sortVal = row.v;
        }
      } else {
        params.cursor = opts.cursor;
        where.push(dir === "desc" ? "a.id < @cursor" : "a.id > @cursor");
      }
      if (params.sortVal === undefined && params.cursor === undefined) {
        params.cursor = opts.cursor;
        params.sortVal = sortVal;
        where.push(dir === "desc" ? `(${sortExpr}, a.id) < (@sortVal, @cursor)` : `(${sortExpr}, a.id) > (@sortVal, @cursor)`);
      }
    }
    if (opts.oaOnly) where.push("a.is_oa = 1");
    const rangeDays: Record<string, number> = { today: 0, week: 7, month: 30, quarter: 90, halfyear: 180 };
    if (opts.range === "today") where.push(`date(${pubExpr}) = date('now')`);
    else if (opts.range && opts.range in rangeDays) where.push(`${pubExpr} >= datetime('now', '-${rangeDays[opts.range]} days')`);
    if (opts.kinds?.length) {
      const ks = opts.kinds.map((k) => k.replace(/[^a-z]/g, "")).filter(Boolean);
      if (ks.length) {
        where.push(`src.kind IN (${ks.map((_, i) => `@kind${i}`).join(",")})`);
        ks.forEach((k, i) => {
          params[`kind${i}`] = k;
        });
      }
    }
    if (opts.types?.length) {
      // JSON 数组带引号匹配，避免子串误命中
      const ors = opts.types.map((_, i) => `b.paper_types LIKE @pt${i}`).join(" OR ");
      where.push(`(${ors})`);
      opts.types.forEach((t, i) => {
        params[`pt${i}`] = `%"${t}"%`;
      });
    }
    if (opts.q?.trim()) {
      where.push("(a.title LIKE @q OR b.title_zh LIKE @q OR src.name LIKE @q)");
      params.q = `%${opts.q.trim()}%`;
    }
    if (opts.sourceId) where.push("a.source_id = @sourceId");
    if (opts.sourceId) params.sourceId = opts.sourceId;
    if (opts.sourceIds?.length) {
      where.push(`a.source_id IN (${opts.sourceIds.map((_, i) => `@fsid${i}`).join(",")})`);
      opts.sourceIds.forEach((sid, i) => {
        params[`fsid${i}`] = sid;
      });
    }
    return getDb()
      .prepare(
        `SELECT a.* FROM articles a
         JOIN subscriptions sub ON sub.source_id = a.source_id
         JOIN sources src ON src.id = a.source_id
         LEFT JOIN paper_briefs b ON b.article_id = a.id
         WHERE ${where.join(" AND ")}
         ORDER BY ${sortExpr} ${dir.toUpperCase()}, a.id ${dir.toUpperCase()} LIMIT @limit`
      )
      .all(params) as ArticleRow[];
  },
  /** 信息流统计：订阅范围内文章总数 / 已生成概要数 / 最近一次抓取时间（UTC） */
  feedStats(userId: number): { total: number; briefed: number; lastFetchAt: string | null } {
    const total = (
      getDb()
        .prepare(
          `SELECT COUNT(*) AS c FROM articles a JOIN subscriptions sub ON sub.source_id = a.source_id WHERE sub.user_id = ?`
        )
        .get(userId) as { c: number }
    ).c;
    const briefed = (
      getDb()
        .prepare(
          `SELECT COUNT(*) AS c FROM articles a
           JOIN subscriptions sub ON sub.source_id = a.source_id
           WHERE sub.user_id = ? AND EXISTS (SELECT 1 FROM paper_briefs b WHERE b.article_id = a.id)`
        )
        .get(userId) as { c: number }
    ).c;
    const last = (
      getDb()
        .prepare(
          `SELECT MAX(fl.started_at) AS t FROM fetch_logs fl
           JOIN subscriptions sub ON sub.source_id = fl.source_id
           WHERE sub.user_id = ?`
        )
        .get(userId) as { t: string | null }
    ).t;
    return { total, briefed, lastFetchAt: last ?? null };
  },
};

export const briefsRepo = {
  upsert(input: {
    articleId: number;
    titleZh: string;
    abstractZh?: string | null;
    field?: string | null;
    paperTypes?: string[];
    researchQuestion?: string | null;
    conclusion?: string | null;
    quality?: "full" | "partial";
    contentHash: string;
    model: string;
  }): void {
    getDb()
      .prepare(
        `INSERT INTO paper_briefs
         (article_id, title_zh, abstract_zh, field, paper_types, research_question, conclusion, quality, content_hash, model, updated_at)
         VALUES (@article_id, @title_zh, @abstract_zh, @field, @paper_types, @research_question, @conclusion, @quality, @content_hash, @model, datetime('now'))
         ON CONFLICT(article_id) DO UPDATE SET
           title_zh = excluded.title_zh, abstract_zh = excluded.abstract_zh, field = excluded.field,
           paper_types = excluded.paper_types, research_question = excluded.research_question,
           conclusion = excluded.conclusion, quality = excluded.quality,
           content_hash = excluded.content_hash, model = excluded.model, updated_at = datetime('now')`
      )
      .run({
        article_id: input.articleId,
        title_zh: input.titleZh,
        abstract_zh: input.abstractZh ?? null,
        field: input.field ?? null,
        paper_types: JSON.stringify(input.paperTypes ?? []),
        research_question: input.researchQuestion ?? null,
        conclusion: input.conclusion ?? null,
        quality: input.quality ?? "full",
        content_hash: input.contentHash,
        model: input.model,
      });
  },
  forArticles(articleIds: number[]): Map<number, Record<string, unknown>> {
    if (articleIds.length === 0) return new Map();
    const rows = getDb()
      .prepare(`SELECT * FROM paper_briefs WHERE article_id IN (${articleIds.map(() => "?").join(",")})`)
      .all(...articleIds) as Record<string, unknown>[];
    return new Map(rows.map((r) => [r.article_id as number, r]));
  },
};

export const statesRepo = {
  markRead(userId: number, articleIds: number[]): void {
    const db = getDb();
    const stmt = db.prepare(
      `INSERT INTO user_article_states (user_id, article_id, is_read, updated_at)
       VALUES (?, ?, 1, datetime('now'))
       ON CONFLICT(user_id, article_id) DO UPDATE SET is_read = 1, updated_at = datetime('now')`
    );
    db.transaction(() => articleIds.forEach((id) => stmt.run(userId, id)))();
  },
  setStarred(userId: number, articleId: number, starred: boolean): void {
    getDb()
      .prepare(
        `INSERT INTO user_article_states (user_id, article_id, is_starred, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(user_id, article_id) DO UPDATE SET is_starred = excluded.is_starred, updated_at = datetime('now')`
      )
      .run(userId, articleId, starred ? 1 : 0);
  },
};
