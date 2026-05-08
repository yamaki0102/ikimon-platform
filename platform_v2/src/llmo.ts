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

function sourceSectionWithLimit(source: LlmoSource, maxChars: number): string {
  return [
    `## Source: ${source.title}`,
    "",
    `Canonical URL: ${source.publicUrl}`,
    "",
    normalizeExcerpt(getLongformMarkdown("ja", source.pageId), maxChars),
  ].join("\n");
}

function buildFromSourcesWithLimit(title: string, purpose: string, sources: LlmoSource[], maxChars: number): string {
  return [
    `# ${title}`,
    "",
    purpose,
    "",
    "この Markdown は既存の日本語 longform コンテンツから生成しています。編集時は元ページを更新し、この出力を正準参照用の薄いビューとして扱います。",
    "",
    ...sources.map((source) => sourceSectionWithLimit(source, maxChars)),
    "",
  ].join("\n");
}

export function buildLlmsTxt(origin = "https://ikimon.life"): string {
  const base = origin.replace(/\/+$/, "");
  return [
    "# ikimon.life",
    "",
    "ikimon.life は、Enjoy Life を中心思想に、市民・企業・自治体が一緒に自然の変化を見守り、その記録を環境保全や企業活動に活かしていく、世界でもまだ確立されていない仕組みに挑む日本語正準の市民参加型プラットフォームです。",
    "",
    "## Primary Japanese References",
    `- Guide: ${base}/llms/guide.md`,
    `- FAQ: ${base}/llms/faq.md`,
    `- Researchers: ${base}/llms/researcher.md`,
    `- Terms: ${base}/llms/terms.md`,
    `- Biodiversity basics: ${base}/ja/learn/biodiversity`,
    `- Policy and business: ${base}/ja/learn/policy-and-business`,
    `- Citizen science: ${base}/ja/learn/citizen-science`,
    `- BioMonWeek field guide: ${base}/ja/learn/biomonweek`,
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

const TERM_SOURCES: LlmoSource[] = [
  { title: "Glossary", pageId: "learn-glossary", publicUrl: "https://ikimon.life/ja/learn/glossary" },
  { title: "BioMonWeek field guide", pageId: "learn-biomonweek", publicUrl: "https://ikimon.life/ja/learn/biomonweek" },
  { title: "Biodiversity", pageId: "term-biodiversity", publicUrl: "https://ikimon.life/ja/learn/terms/biodiversity" },
  { title: "Nature connectedness", pageId: "term-nature-connectedness", publicUrl: "https://ikimon.life/ja/learn/terms/nature-connectedness" },
  { title: "Attention Restoration Theory", pageId: "term-attention-restoration-theory", publicUrl: "https://ikimon.life/ja/learn/terms/attention-restoration-theory" },
  { title: "Identification", pageId: "term-identification", publicUrl: "https://ikimon.life/ja/learn/terms/identification" },
  { title: "AI candidate", pageId: "term-ai-candidate", publicUrl: "https://ikimon.life/ja/learn/terms/ai-candidate" },
  { title: "BioMonWeek", pageId: "term-biomonweek", publicUrl: "https://ikimon.life/ja/learn/terms/biomonweek" },
  { title: "Biodiversity monitoring", pageId: "term-biodiversity-monitoring", publicUrl: "https://ikimon.life/ja/learn/terms/biodiversity-monitoring" },
  { title: "Participatory monitoring", pageId: "term-participatory-monitoring", publicUrl: "https://ikimon.life/ja/learn/terms/participatory-monitoring" },
  { title: "Sampling effort", pageId: "term-sampling-effort", publicUrl: "https://ikimon.life/ja/learn/terms/sampling-effort" },
  { title: "Baseline", pageId: "term-baseline", publicUrl: "https://ikimon.life/ja/learn/terms/baseline" },
  { title: "Evidence Tier", pageId: "term-evidence-tier", publicUrl: "https://ikimon.life/ja/learn/terms/evidence-tier" },
  { title: "Open dispute", pageId: "term-open-dispute", publicUrl: "https://ikimon.life/ja/learn/terms/open-dispute" },
  { title: "Environmental DNA", pageId: "term-environmental-dna", publicUrl: "https://ikimon.life/ja/learn/terms/environmental-dna" },
  { title: "GBIF", pageId: "term-gbif", publicUrl: "https://ikimon.life/ja/learn/terms/gbif" },
  { title: "Darwin Core", pageId: "term-darwin-core", publicUrl: "https://ikimon.life/ja/learn/terms/darwin-core" },
  { title: "TNFD", pageId: "term-tnfd", publicUrl: "https://ikimon.life/ja/learn/terms/tnfd" },
  { title: "Nature symbiosis site", pageId: "term-nature-symbiosis-site", publicUrl: "https://ikimon.life/ja/learn/terms/nature-symbiosis-site" },
  { title: "OECM", pageId: "term-oecm", publicUrl: "https://ikimon.life/ja/learn/terms/oecm" },
  { title: "Natural capital", pageId: "term-natural-capital", publicUrl: "https://ikimon.life/ja/learn/terms/natural-capital" },
];

export function buildLlmoTermsMarkdown(): string {
  return buildFromSourcesWithLimit(
    "ikimon.life Terms",
    "自然観察、生物多様性、同定、研究利用、政策・企業活動の用語を LLM が誤用しないための正準資料です。",
    TERM_SOURCES,
    1500,
  );
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
