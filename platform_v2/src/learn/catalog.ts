import { getShortCopy, renderLongformPage } from "../content/index.js";
import { listMarketingPages, type SitePageDefinition } from "../siteMap.js";
import type { LearnCatalogEntry } from "./search.js";

export type { LearnCatalogEntry } from "./search.js";

type LearnPageMeta = {
  title: string;
  heading: string;
  lead: string;
  bodyPageId: string;
};

type LearnCatalogSource = {
  pages: readonly SitePageDefinition[];
  readMetadata: (pageKey: string) => unknown;
  renderContent: (bodyPageId: string) => string | undefined;
};

function isPageMeta(value: unknown): value is LearnPageMeta {
  if (!value || typeof value !== "object") return false;
  const meta = value as Record<string, unknown>;
  return ["title", "heading", "lead", "bodyPageId"].every((key) => typeof meta[key] === "string" && Boolean(meta[key]));
}

function textFromHtml(html: string): string {
  // The canonical Markdown renderer escapes raw HTML. Strip its actual markup
  // before decoding entities, so a literal "<script>" stays plain searchable text.
  const withoutTags = html.replace(/<[^>]*>/gu, "");
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return withoutTags.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/giu, (entity, code: string) => {
    if (!code.startsWith("#")) return named[code.toLowerCase()] ?? entity;
    const codePoint = code[1]?.toLowerCase() === "x" ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
    return codePoint > 0 && codePoint <= 0x10ffff && !(codePoint >= 0xd800 && codePoint <= 0xdfff)
      ? String.fromCodePoint(codePoint)
      : "\ufffd";
  }).replace(/\s+/gu, " ").trim();
}

export function learnHeadingsFromHtml(html: string): string[] {
  const headings = Array.from(html.matchAll(/<h([1-6])(?:\s[^>]*)?>([\s\S]*?)<\/h\1>/giu), (match) => textFromHtml(match[2] ?? ""));
  return [...new Set(headings.filter(Boolean))];
}

function isPublicLearnArticle(page: SitePageDefinition): boolean {
  // These are the existing public/article/SEO registrations used by marketing
  // routes and the Japanese sitemap. Do not enumerate content files or links
  // from the twenty-term introduction: neither establishes publication.
  if (page.lane !== "learn" || page.layout !== "reading" || page.auth !== "public") return false;
  if (page.audience !== "public" && page.audience !== "visitor") return false;
  if (!page.marketing || !page.navVisibility.includes("xml")) return false;
  if (!page.path.startsWith("/learn/") || /[?#:\\\s]/u.test(page.path)) return false;
  const path = new URL(page.path, "https://learn.invalid").pathname;
  return path === page.path && !path.includes("//") && !path.endsWith("/");
}

/**
 * Project every registered public Japanese longform from the existing stores.
 * The /learn hub and the separately rendered invasive-species catalogue are
 * navigation surfaces, not marketing longforms. Private/trust/ops routes and
 * routes withheld from XML publication cannot enter this projection.
 */
export function buildLearnCatalog(source: Partial<LearnCatalogSource> = {}): LearnCatalogEntry[] {
  const pages = source.pages ?? listMarketingPages();
  const readMetadata = source.readMetadata ?? ((pageKey: string) => getShortCopy<unknown>("ja", "public", `marketing.pages.${pageKey}`));
  const renderContent = source.renderContent ?? ((bodyPageId: string) => renderLongformPage("ja", bodyPageId));
  const entries = new Map<string, LearnCatalogEntry>();
  for (const page of pages) {
    if (!isPublicLearnArticle(page) || entries.has(page.path)) continue;
    let meta: unknown;
    let html: string | undefined;
    try {
      meta = readMetadata(page.marketing!.pageKey);
      if (!isPageMeta(meta)) continue;
      html = renderContent(meta.bodyPageId);
    } catch {
      // A route alone does not prove an article exists. Never create a result
      // for a missing metadata/body pair or let a read failure invent a URL.
      continue;
    }
    if (!html?.trim()) continue;
    const headings = learnHeadingsFromHtml(html);
    const knownText = new Set([page.title.ja, page.summary.ja, ...headings]);
    const searchAliases = [...new Set([meta.title, meta.heading, meta.lead])].filter((text) => !knownText.has(text));
    entries.set(page.path, {
      path: page.path,
      kind: page.path.startsWith("/learn/terms/") ? "term" : "reading",
      title: page.title.ja,
      summary: page.summary.ja,
      headings,
      ...(searchAliases.length ? { searchAliases } : {}),
    });
  }
  return [...entries.values()];
}
