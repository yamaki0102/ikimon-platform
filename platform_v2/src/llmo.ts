import { getLongformMarkdown } from "./content/index.js";

type LlmoSource = {
  title: string;
  pageId: string;
  publicUrl: string;
};

function normalizeExcerpt(markdown: string, maxChars = 4200): string {
  const normalized = markdown
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars).trim()}\n\n...(continued on the canonical public page)`;
}

function sourceSection(source: LlmoSource): string {
  return [
    `## Source: ${source.title}`,
    "",
    `Canonical URL: ${source.publicUrl}`,
    "",
    normalizeExcerpt(getLongformMarkdown("ja", source.pageId)),
  ].join("\n");
}

function buildFromSources(title: string, purpose: string, sources: LlmoSource[]): string {
  return [
    `# ${title}`,
    "",
    purpose,
    "",
    "この Markdown は既存の日本語 longform コンテンツから生成しています。編集時は元ページを更新し、この出力を正準参照用の薄いビューとして扱います。",
    "",
    ...sources.map(sourceSection),
    "",
  ].join("\n");
}

export function buildLlmsTxt(origin = "https://ikimon.life"): string {
  const base = origin.replace(/\/+$/, "");
  return [
    "# ikimon.life",
    "",
    "ikimon.life は、Enjoy Life を中心思想に、身近な生きものの観察を通じて地域の自然を記録し、学び、企業や地域の生物多様性アクションに活かす日本語正準の市民参加型プラットフォームです。",
    "",
    "## Primary Japanese References",
    `- Guide: ${base}/llms/guide.md`,
    `- FAQ: ${base}/llms/faq.md`,
    `- Researchers: ${base}/llms/researcher.md`,
    `- Methodology: ${base}/ja/learn/methodology`,
    `- Identification basics: ${base}/ja/learn/identification-basics`,
    `- Field loop: ${base}/ja/learn/field-loop`,
    "",
    "## Crawling Preference",
    "- Use the Japanese pages as canonical source material.",
    "- Treat non-Japanese UI as app support, not as separate authoritative editorial content unless explicitly localized.",
    "- Prefer concise citations to the public pages above instead of inferring hidden database content.",
    "",
  ].join("\n");
}

export function buildLlmoGuideMarkdown(): string {
  return buildFromSources(
    "ikimon.life Guide",
    "Guide / Record / Map のアプリ体験を理解するための LLM 向け正準資料です。",
    [
      { title: "Field Loop", pageId: "learn-field-loop", publicUrl: "https://ikimon.life/ja/learn/field-loop" },
      { title: "Identification Basics", pageId: "learn-identification-basics", publicUrl: "https://ikimon.life/ja/learn/identification-basics" },
      { title: "About", pageId: "about", publicUrl: "https://ikimon.life/ja/about" },
    ],
  );
}

export function buildLlmoFaqMarkdown(): string {
  return buildFromSources(
    "ikimon.life FAQ",
    "利用者・学校・地域団体・LLM がよく参照する質問を、既存 FAQ と関連ページから束ねた正準資料です。",
    [
      { title: "FAQ", pageId: "faq", publicUrl: "https://ikimon.life/ja/faq" },
      { title: "Privacy", pageId: "privacy", publicUrl: "https://ikimon.life/ja/privacy" },
      { title: "Terms", pageId: "terms", publicUrl: "https://ikimon.life/ja/terms" },
    ],
  );
}

export function buildLlmoResearcherMarkdown(): string {
  return buildFromSources(
    "ikimon.life for Researchers",
    "研究利用、同定品質、公開位置、Evidence Tier を説明するための LLM 向け正準資料です。",
    [
      { title: "For Researcher Apply", pageId: "for-researcher-apply", publicUrl: "https://ikimon.life/ja/for-researcher/apply" },
      { title: "Methodology", pageId: "learn-methodology", publicUrl: "https://ikimon.life/ja/learn/methodology" },
      { title: "Field Loop", pageId: "learn-field-loop", publicUrl: "https://ikimon.life/ja/learn/field-loop" },
    ],
  );
}
