import { getLongformMarkdown } from "./content/index.js";
import { PRODUCTION_PUBLIC_ORIGIN } from "./services/trustedPublicOrigin.js";

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

export function buildLlmsTxt(origin = PRODUCTION_PUBLIC_ORIGIN): string {
  const base = origin.replace(/\/+$/, "");
  return [
    "# ZUKAN",
    "",
    "ZUKAN は、Enjoy Life を中心思想に、市民・企業・自治体が一緒に自然の変化を見守り、その記録を環境保全や企業活動に活かしていく、世界でもまだ確立されていない仕組みに挑む日本語正準の市民参加型プラットフォームです。",
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
  { title: "Glossary", pageId: "learn-glossary", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/learn/glossary` },
  { title: "BioMonWeek field guide", pageId: "learn-biomonweek", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/learn/biomonweek` },
  { title: "Biodiversity", pageId: "term-biodiversity", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/learn/terms/biodiversity` },
  { title: "Nature connectedness", pageId: "term-nature-connectedness", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/learn/terms/nature-connectedness` },
  { title: "Attention Restoration Theory", pageId: "term-attention-restoration-theory", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/learn/terms/attention-restoration-theory` },
  { title: "Identification", pageId: "term-identification", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/learn/terms/identification` },
  { title: "AI candidate", pageId: "term-ai-candidate", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/learn/terms/ai-candidate` },
  { title: "BioMonWeek", pageId: "term-biomonweek", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/learn/terms/biomonweek` },
  { title: "Biodiversity monitoring", pageId: "term-biodiversity-monitoring", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/learn/terms/biodiversity-monitoring` },
  { title: "Participatory monitoring", pageId: "term-participatory-monitoring", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/learn/terms/participatory-monitoring` },
  { title: "Sampling effort", pageId: "term-sampling-effort", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/learn/terms/sampling-effort` },
  { title: "Baseline", pageId: "term-baseline", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/learn/terms/baseline` },
  { title: "Evidence Tier", pageId: "term-evidence-tier", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/learn/terms/evidence-tier` },
  { title: "Open dispute", pageId: "term-open-dispute", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/learn/terms/open-dispute` },
  { title: "Environmental DNA", pageId: "term-environmental-dna", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/learn/terms/environmental-dna` },
  { title: "GBIF", pageId: "term-gbif", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/learn/terms/gbif` },
  { title: "Darwin Core", pageId: "term-darwin-core", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/learn/terms/darwin-core` },
  { title: "TNFD", pageId: "term-tnfd", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/learn/terms/tnfd` },
  { title: "Nature symbiosis site", pageId: "term-nature-symbiosis-site", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/learn/terms/nature-symbiosis-site` },
  { title: "OECM", pageId: "term-oecm", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/learn/terms/oecm` },
  { title: "Natural capital", pageId: "term-natural-capital", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/learn/terms/natural-capital` },
];

export function buildLlmoTermsMarkdown(): string {
  return buildFromSourcesWithLimit(
    "ZUKAN Terms",
    "自然観察、生物多様性、同定、研究利用、政策・企業活動の用語を LLM が誤用しないための正準資料です。",
    TERM_SOURCES,
    1500,
  );
}

export function buildLlmoGuideMarkdown(): string {
  return buildFromSources(
    "ZUKAN Guide",
    "Guide / Record / Map のアプリ体験を理解するための LLM 向け正準資料です。",
    [
      { title: "Field Loop", pageId: "learn-field-loop", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/learn/field-loop` },
      { title: "Identification Basics", pageId: "learn-identification-basics", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/learn/identification-basics` },
      { title: "About", pageId: "about", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/about` },
    ],
  );
}

export function buildLlmoFaqMarkdown(): string {
  return buildFromSources(
    "ZUKAN FAQ",
    "利用者・学校・地域団体・LLM がよく参照する質問を、既存 FAQ と関連ページから束ねた正準資料です。",
    [
      { title: "FAQ", pageId: "faq", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/faq` },
      { title: "Privacy", pageId: "privacy", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/privacy` },
      { title: "Terms", pageId: "terms", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/terms` },
    ],
  );
}

export function buildLlmoResearcherMarkdown(): string {
  return buildFromSources(
    "ZUKAN for Researchers",
    "研究利用、同定品質、公開位置、Evidence Tier を説明するための LLM 向け正準資料です。",
    [
      { title: "For Researcher Apply", pageId: "for-researcher-apply", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/for-researcher/apply` },
      { title: "Methodology", pageId: "learn-methodology", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/learn/methodology` },
      { title: "Field Loop", pageId: "learn-field-loop", publicUrl: `${PRODUCTION_PUBLIC_ORIGIN}/ja/learn/field-loop` },
    ],
  );
}
