import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { escapeHtml } from "../ui/siteShell.js";
import type { SiteLang } from "../i18n.js";

export type MarketingCard = {
  title: string;
  body: string;
  href?: string;
  label?: string;
  eyebrow?: string;
};

export type MarketingRow = {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
};

export type MarketingInlineLink = {
  label: string;
  href: string;
};

export type MarketingLongformPage = {
  title: string;
  eyebrow: string;
  heading: string;
  lead: string;
  activeNavKey: string;
  inlineLink?: MarketingInlineLink;
  cards: MarketingCard[];
  rows: MarketingRow[];
  markdown: string;
};

const contentRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../content/marketing");

function localizedPath(lang: SiteLang, slug: string, ext: "json" | "md"): string {
  const direct = resolve(contentRoot, lang, `${slug}.${ext}`);
  if (existsSync(direct)) {
    return direct;
  }
  return resolve(contentRoot, "ja", `${slug}.${ext}`);
}

export function loadMarketingLongformPage(slug: string, lang: SiteLang): MarketingLongformPage {
  const jsonPath = localizedPath(lang, slug, "json");
  const markdownPath = localizedPath(lang, slug, "md");
  const config = JSON.parse(readFileSync(jsonPath, "utf8")) as Omit<MarketingLongformPage, "markdown">;
  const markdown = readFileSync(markdownPath, "utf8");
  return {
    ...config,
    cards: Array.isArray(config.cards) ? config.cards : [],
    rows: Array.isArray(config.rows) ? config.rows : [],
    markdown,
  };
}

function renderInlineMarkdown(text: string, resolveHref: (href: string) => string): string {
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let cursor = 0;
  let html = "";
  for (const match of text.matchAll(linkPattern)) {
    const start = match.index ?? 0;
    html += escapeHtml(text.slice(cursor, start));
    const label = match[1] ?? "";
    const href = match[2] ?? "";
    html += `<a class="inline-link" href="${escapeHtml(resolveHref(href))}">${escapeHtml(label)}</a>`;
    cursor = start + match[0].length;
  }
  html += escapeHtml(text.slice(cursor));
  return html;
}

export function renderMarketingMarkdown(markdown: string, resolveHref: (href: string) => string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [
    `<section class="section mkt-markdown">
      <style>
        .mkt-markdown { display: grid; gap: 18px; }
        .mkt-markdown h2 { margin: 8px 0 12px; font-size: clamp(22px, 2vw, 28px); line-height: 1.35; letter-spacing: -.02em; color: #0f172a; }
        .mkt-markdown .eyebrow { margin-bottom: 8px; }
        .mkt-markdown p { margin: 0 0 12px; font-size: 15px; line-height: 1.8; color: #475569; }
        .mkt-markdown p:last-child { margin-bottom: 0; }
        .mkt-markdown ul { margin: 14px 0 0 18px; padding: 0; display: grid; gap: 8px; color: #475569; }
        .mkt-markdown li { line-height: 1.7; }
        .mkt-markdown article { padding: 24px 28px; }
      </style>`,
  ];
  let inArticle = false;
  let paragraph: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    html.push(`<p>${renderInlineMarkdown(paragraph.join(" "), resolveHref)}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    html.push(`<ul>${listItems.map((item) => `<li>${renderInlineMarkdown(item, resolveHref)}</li>`).join("")}</ul>`);
    listItems = [];
  };

  const closeArticle = () => {
    flushParagraph();
    flushList();
    if (inArticle) {
      html.push("</article>");
      inArticle = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "") {
      flushParagraph();
      flushList();
      continue;
    }
    if (line === "---") {
      closeArticle();
      continue;
    }
    if (line.startsWith("### ")) {
      closeArticle();
      html.push(`<article class="card is-soft"><div class="eyebrow">${renderInlineMarkdown(line.slice(4), resolveHref)}</div>`);
      inArticle = true;
      continue;
    }
    if (line.startsWith("## ")) {
      if (!inArticle) {
        html.push(`<article class="card is-soft">`);
        inArticle = true;
      }
      flushParagraph();
      flushList();
      html.push(`<h2>${renderInlineMarkdown(line.slice(3), resolveHref)}</h2>`);
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      listItems.push(line.slice(2));
      continue;
    }
    paragraph.push(line);
  }

  closeArticle();
  html.push("</section>");
  return html.join("");
}
