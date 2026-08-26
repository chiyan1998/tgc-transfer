/**
 * 引文生成器（M1 迭代意见 4）：轻量自研，零依赖。
 * 基于文章元数据生成 7 种格式；工作论文以预印本编号呈现。
 */

export const CITATION_FORMATS = [
  { key: "apa", label: "APA 7th" },
  { key: "chicago", label: "Chicago" },
  { key: "ieee", label: "IEEE" },
  { key: "nature", label: "Nature" },
  { key: "apsa", label: "APSA" },
  { key: "bibtex", label: "BibTeX" },
  { key: "biblatex", label: "BibLaTeX" },
] as const;

export type CitationFormat = (typeof CITATION_FORMATS)[number]["key"];

export interface CitationData {
  title: string;
  authors: { given?: string; family?: string; name?: string }[];
  year: string | null; // 优先发表年
  date: string | null; // 完整日期（YYYY-MM-DD 或 YYYY-MM）
  venue: string; // 期刊名 / arXiv / NBER
  kind: "journal" | "arxiv" | "nber" | "book" | string;
  externalId: string;
  volume: string | null;
  issue: string | null;
  page: string | null;
  doi: string | null;
  url: string;
}

/** 作者规范化：{family, given, name} */
function normAuthors(data: CitationData): { family: string; given: string }[] {
  return data.authors
    .map((a) => {
      if (a.family || a.given) return { family: a.family ?? "", given: a.given ?? "" };
      const name = (a.name ?? "").trim();
      if (!name) return { family: "", given: "" };
      const parts = name.split(/\s+/);
      return parts.length > 1
        ? { family: parts[parts.length - 1], given: parts.slice(0, -1).join(" ") }
        : { family: name, given: "" };
    })
    .filter((a) => a.family || a.given);
}

const initials = (given: string) =>
  given
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + ".")
    .join(" ");

function apaAuthors(authors: { family: string; given: string }[]): string {
  const fmt = (a: { family: string; given: string }) =>
    a.given ? `${a.family}, ${initials(a.given)}` : a.family;
  if (authors.length === 0) return "";
  if (authors.length === 1) return fmt(authors[0]);
  if (authors.length <= 20)
    return authors.slice(0, -1).map(fmt).join(", ") + ", & " + fmt(authors[authors.length - 1]);
  return authors.slice(0, 19).map(fmt).join(", ") + ", ... " + fmt(authors[authors.length - 1]);
}

function venueText(data: CitationData): string {
  if (data.kind === "arxiv") return `arXiv preprint arXiv:${data.externalId}`;
  if (data.kind === "nber") return `NBER Working Paper No. ${data.externalId}`;
  return data.venue;
}

const doiText = (data: CitationData) => (data.doi ? ` https://doi.org/${data.doi}` : "");

export function formatCitation(fmt: CitationFormat, data: CitationData): string {
  const authors = normAuthors(data);
  const year = data.year ?? "n.d.";
  const venue = venueText(data);
  const isWorkingPaper = data.kind === "arxiv" || data.kind === "nber";

  switch (fmt) {
    case "apa": {
      const a = apaAuthors(authors);
      const core = isWorkingPaper
        ? `${a} (${year}). ${data.title}. ${venue}.${doiText(data)}`
        : `${a} (${year}). ${data.title}. ${venue}${data.volume ? `, ${data.volume}` : ""}${data.issue ? `(${data.issue})` : ""}${data.page ? `, ${data.page}` : ""}.${doiText(data)}`;
      return core;
    }
    case "chicago": {
      const first = authors[0];
      const firstStr = first ? (first.given ? `${first.family}, ${first.given}` : first.family) : "";
      const rest = authors.slice(1).map((a) => (a.given ? `${a.given} ${a.family}` : a.family));
      const authorStr =
        authors.length === 0 ? "" : [firstStr, ...rest].filter(Boolean).join(", ");
      const tail = isWorkingPaper ? `${venue}.` : `${venue} ${data.volume ?? ""}${data.issue ? `, no. ${data.issue}` : ""}${data.page ? `: ${data.page}` : ""}.`;
      return `${authorStr} ${year}. "${data.title}." ${tail}${doiText(data)}`.trim();
    }
    case "ieee": {
      const a = authors
        .map((x) => (x.given ? `${initials(x.given)} ${x.family}` : x.family))
        .join(", ");
      const middle = isWorkingPaper
        ? `"${data.title}," ${venue}, ${year}.`
        : `"${data.title}," ${venue}${data.volume ? `, vol. ${data.volume}` : ""}${data.issue ? `, no. ${data.issue}` : ""}${data.page ? `, pp. ${data.page}` : ""}, ${year}.`;
      return `${a ? a + ", " : ""}${middle}${doiText(data)}`;
    }
    case "nature": {
      const a = authors
        .map((x) => (x.given ? `${x.family}, ${initials(x.given)}` : x.family))
        .slice(0, 5)
        .join(", ");
      const middle = isWorkingPaper
        ? `${data.title}. ${venue} (${year}).`
        : `${data.title}. ${venue}${data.volume ? ` ${data.volume}` : ""}${data.page ? `, ${data.page}` : ""} (${year}).`;
      return `${a ? a + ". " : ""}${middle}${doiText(data)}`;
    }
    case "apsa": {
      // APSA 沿用 Chicago 作者-日期体例
      return formatCitation("chicago", data);
    }
    case "bibtex":
    case "biblatex": {
      const key = citeKey(authors, year, data.title);
      const a = authors.map((x) => (x.given ? `${x.family}, ${x.given}` : x.family)).join(" and ");
      const lines = [
        `@${isWorkingPaper ? "misc" : "article"}{${key},`,
        a ? `  author    = {${a}},` : null,
        `  title     = {${data.title}},`,
        isWorkingPaper ? `  note      = {${venue}},` : `  journal   = {${venue}},`,
        data.volume ? `  volume    = {${data.volume}},` : null,
        data.issue ? `  number    = {${data.issue}},` : null,
        data.page ? `  pages     = {${data.page}},` : null,
        fmt === "biblatex" && data.date ? `  date      = {${data.date}},` : `  year      = {${year}},`,
        data.doi ? `  doi       = {${data.doi}},` : null,
        `  url       = {${data.url}},`,
        "}",
      ];
      return lines.filter(Boolean).join("\n");
    }
  }
}

/** BibTeX citekey：一作姓氏 + 年份 + 标题首个实词 */
function citeKey(authors: { family: string; given: string }[], year: string, title: string): string {
  const family = (authors[0]?.family ?? "unknown").toLowerCase().replace(/[^a-z]/g, "") || "unknown";
  const stop = new Set(["a", "an", "the", "of", "on", "in", "for", "and", "to", "with"]);
  const word =
    title
      .split(/\s+/)
      .find((w) => /[a-zA-Z]/.test(w) && !stop.has(w.toLowerCase()))
      ?.toLowerCase()
      .replace(/[^a-z]/g, "") ?? "paper";
  return `${family}${year.replace(/[^\d]/g, "")}${word}`;
}
