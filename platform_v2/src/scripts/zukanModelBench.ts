import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AI_MODEL_CHAIN_ENV_KEYS } from "../services/aiModels.js";
import { generateAiTextWithRoleChain, type AiRouterPart } from "../services/aiModelRouter.js";
import { getObservationDataRights } from "../services/observationDataRights.js";
import { PRODUCTION_PUBLIC_ORIGIN } from "../services/trustedPublicOrigin.js";
import { resolveObservationImageTargets, type ObservationImageTarget } from "./resolveObservationImageTargets.js";

export const ZUKAN_MODEL_BENCH_VERSION = "zukan-post-model-bench-v2";
export const ZUKAN_MODEL_BENCH_PROMPT_VERSION = "observation-reassess-post-cold-start-v2";
export const DEFAULT_ZUKAN_BENCH_MANIFEST = "ops/model-bench/fixtures/zukan-public-post-core-v2.json";
export const DEFAULT_ZUKAN_BENCH_REPORT_DIR = "ops/model-bench/reports";
export const ZUKAN_BENCH_CORE_POST_COUNT = 24;
export const ZUKAN_BENCH_SMOKE_POST_COUNT = 8;
export const ZUKAN_BENCH_MIN_GOLD_POSTS = 8;
const DEFAULT_PROMPT_SOURCE = "src/prompts/observation_reassess.md";
const SELECTION_SEED = "zukan-public-post-core-v2-seed-1";
const MODEL_CHAIN_ENV = AI_MODEL_CHAIN_ENV_KEYS.observationVisualExtract;
const VALID_RANKS = new Set(["species", "genus", "family", "order", "lifeform"]);
const VALID_CONFIDENCE = new Set(["high", "medium", "low"]);
const GENERIC_LABEL_RE = /^(?:名前待ち|同定待ち|名前を確認中|未同定|不明|unknown|unidentified|unresolved|awaiting id)$/iu;
const NON_PUBLIC_ID_RE = /(?:smoke|fixture|synthetic|dummy|placeholder|e2e|test)/iu;
const LOCATION_ASSERTION_RE = /(?:北海道|東京都|京都府|大阪府|.{2,4}県|.{1,8}市|.{1,8}区|.{1,8}町|.{1,8}村|緯度\s*[:：]?\s*\d|経度\s*[:：]?\s*\d|北緯|東経)/u;

export type ZukanBenchGold = {
  label: string | null;
  aliases: string[];
  rank: string | null;
  status: "human_consensus" | "public_label" | "unknown";
};

export type ZukanBenchImage = {
  index: number;
  url: string;
  sha256: string;
  bytes: number;
  mimeType: string;
};

export type ZukanBenchFixture = {
  fixtureId: string;
  visitId: string;
  occurrenceId: string;
  detailPath: string;
  observedAt: string;
  images: ZukanBenchImage[];
  postInputSha256: string;
  gold: ZukanBenchGold;
  externalExportAllowed?: boolean | null;
  mediaLicense?: string | null;
  rightsPolicyVersion?: string | null;
  withdrawalStatus?: string | null;
};

export type ZukanBenchManifest = {
  version: typeof ZUKAN_MODEL_BENCH_VERSION;
  sourceOrigin: string;
  frozenAt: string;
  selectionPolicy: "deterministic_seeded_visit_order";
  selectionSeed: string;
  postCount: number;
  imageCount: number;
  datasetSha256: string;
  promptPath: string;
  promptSha256: string;
  externalProcessingVettedAt?: string | null;
  fixtures: ZukanBenchFixture[];
};

export type ZukanBenchFixtureScore = {
  fixtureId: string;
  visitId: string;
  imageCount: number;
  schemaValid: boolean;
  taxonScore: number | null;
  criticalFailures: string[];
};

export type ZukanBenchModelReport = {
  version: typeof ZUKAN_MODEL_BENCH_VERSION;
  promptVersion: typeof ZUKAN_MODEL_BENCH_PROMPT_VERSION;
  promptSha256: string;
  model: string;
  provider: string;
  manifestPath: string;
  datasetSha256: string;
  startedAt: string;
  completedAt: string;
  postCount: number;
  imageCount: number;
  successCount: number;
  schemaValidRatePct: number;
  goldPostCount: number;
  taxonScorePct: number | null;
  criticalFailurePostCount: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostUsd: number | null;
  pricing: { inputUsdPer1M: number; outputUsdPer1M: number; source: string } | null;
  fixtureScores: ZukanBenchFixtureScore[];
};

type BenchResponse = {
  recommended_taxon_name?: unknown;
  recommended_rank?: unknown;
  confidence_band?: unknown;
  taxonomic_candidates?: unknown;
  geographic_context?: unknown;
};

type BenchPricing = {
  inputUsdPer1M: number;
  outputUsdPer1M: number;
  source: string;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";
}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizeTaxon(value: unknown): string {
  return clean(value)
    .replace(/[（(].*?[）)]/gu, "")
    .replace(/[|｜]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

function fullUrl(baseUrl: string, value: string): string {
  return new URL(value, `${baseUrl.replace(/\/+$/u, "")}/`).toString();
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&amp;/gu, "&")
    .replace(/&quot;/gu, "\"")
    .replace(/&#39;|&apos;/gu, "'")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">");
}

function htmlAttribute(tag: string, name: string): string {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`, "u"));
  return match ? decodeHtmlAttribute(match[1] ?? "") : "";
}

export function extractOrderedPostPhotoUrls(detailHtml: string): string[] {
  const thumbRows = [...detailHtml.matchAll(/<button\b[^>]*>/gu)]
    .map((match) => match[0])
    .filter((tag) => /\bobs-hero-thumb\b/u.test(tag))
    .map((tag) => ({
      index: Number(htmlAttribute(tag, "data-obs-thumb-index")),
      url: htmlAttribute(tag, "data-obs-thumb-full-src"),
    }))
    .filter((row) => Number.isFinite(row.index) && Boolean(row.url))
    .sort((a, b) => a.index - b.index);
  if (thumbRows.length > 0) {
    return [...new Set(thumbRows.map((row) => row.url))];
  }
  const preview = [...detailHtml.matchAll(/<img\b[^>]*>/gu)]
    .map((match) => match[0])
    .find((tag) => /\bdata-obs-preview-img\b/u.test(tag));
  const previewUrl = preview ? htmlAttribute(preview, "data-obs-full-src") || htmlAttribute(preview, "src") : "";
  return previewUrl ? [previewUrl] : [];
}

function eligibleTarget(target: ObservationImageTarget): boolean {
  return Boolean(target.photoUrl) && !NON_PUBLIC_ID_RE.test(`${target.visitId} ${target.occurrenceId} ${target.photoUrl}`);
}

function selectionKey(visitId: string): string {
  return sha256(`${SELECTION_SEED}|${visitId}`);
}

export function selectDeterministicPostTargets(targets: ObservationImageTarget[], count: number): ObservationImageTarget[] {
  const byVisit = new Map<string, ObservationImageTarget>();
  for (const target of targets) {
    if (!eligibleTarget(target) || byVisit.has(target.visitId)) continue;
    byVisit.set(target.visitId, target);
  }
  return [...byVisit.values()]
    .sort((a, b) => selectionKey(a.visitId).localeCompare(selectionKey(b.visitId)) || a.visitId.localeCompare(b.visitId))
    .slice(0, Math.max(0, Math.floor(count)));
}

function meaningfulLabel(value: string): string | null {
  const label = clean(value);
  return !label || GENERIC_LABEL_RE.test(label) ? null : label;
}

export function detailHasHumanConsensus(html: string): boolean {
  const normalized = html.replace(/\s+/gu, " ");
  if (/(?:authority_reviewed|community_consensus)/u.test(normalized)) return true;
  if (/同定ルールにより同定されています/u.test(normalized)) return true;
  if (/同定済み/u.test(normalized)) return true;
  return /同定済/u.test(normalized) && !/(?:未同定|同定されていません)/u.test(normalized);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function scientificAliases(html: string, label: string): string[] {
  const text = html.replace(/<[^>]+>/gu, " ").replace(/&nbsp;/gu, " ").replace(/\s+/gu, " ");
  const found = new Set<string>();
  const labelPattern = new RegExp(`\\b([A-Z][a-z]{2,}(?:\\s+[a-z][a-z.-]{2,}){1,2})\\s*[（(]\\s*${escapeRegExp(label)}\\s*[）)]`, "gu");
  for (const match of text.matchAll(labelPattern)) {
    const value = clean(match[1]);
    if (value) found.add(value);
  }
  if (found.size === 0) {
    for (const match of text.matchAll(/\b([A-Z][a-z]{2,}\s+[a-z][a-z.-]{2,})\b/gu)) {
      const value = clean(match[1]);
      if (value) found.add(value);
      if (found.size >= 3) break;
    }
  }
  return [...found];
}

function inferRank(label: string, aliases: string[]): string | null {
  if (/属(?:の一種)?$/u.test(label)) return "genus";
  if (/科(?:の一種)?$/u.test(label)) return "family";
  if (/目(?:の一種)?$/u.test(label)) return "order";
  return aliases.length > 0 ? "species" : null;
}

function inferGold(target: ObservationImageTarget, detailHtml: string): ZukanBenchGold {
  const label = meaningfulLabel(target.displayName);
  if (!label) return { label: null, aliases: [], rank: null, status: "unknown" };
  const human = detailHasHumanConsensus(detailHtml);
  const aliases = human ? scientificAliases(detailHtml, label) : [];
  return {
    label,
    aliases,
    rank: human ? inferRank(label, aliases) : null,
    status: human ? "human_consensus" : "public_label",
  };
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { accept: "text/html", "cache-control": "no-store" } });
  if (!response.ok) throw new Error(`zukan_bench_fetch_failed:${response.status}:${url}`);
  return response.text();
}

async function fetchImage(url: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const response = await fetch(url, { headers: { accept: "image/*", "cache-control": "no-store" } });
  if (!response.ok) throw new Error(`zukan_bench_image_fetch_failed:${response.status}:${url}`);
  const mimeType = clean(response.headers.get("content-type") ?? "").split(";", 1)[0]?.toLowerCase() ?? "";
  if (!mimeType.startsWith("image/")) throw new Error(`zukan_bench_non_image:${mimeType}:${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength < 512) throw new Error(`zukan_bench_image_too_small:${bytes.byteLength}:${url}`);
  return { bytes, mimeType };
}

function canonicalImageDigest(images: ZukanBenchImage[]): string {
  return sha256(JSON.stringify(images.map((image) => ({
    index: image.index,
    url: image.url,
    sha256: image.sha256,
    bytes: image.bytes,
    mimeType: image.mimeType,
  }))));
}

function canonicalFixtureDigest(fixtures: ZukanBenchFixture[]): string {
  return sha256(JSON.stringify(fixtures.map((fixture) => ({
    fixtureId: fixture.fixtureId,
    visitId: fixture.visitId,
    occurrenceId: fixture.occurrenceId,
    detailPath: fixture.detailPath,
    observedAt: fixture.observedAt,
    images: fixture.images,
    postInputSha256: fixture.postInputSha256,
    gold: fixture.gold,
    externalExportAllowed: fixture.externalExportAllowed ?? null,
    mediaLicense: fixture.mediaLicense ?? null,
    rightsPolicyVersion: fixture.rightsPolicyVersion ?? null,
    withdrawalStatus: fixture.withdrawalStatus ?? null,
  }))));
}

async function assertNewFile(filePath: string): Promise<void> {
  try {
    await access(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new Error(`zukan_bench_manifest_already_exists:${filePath}`);
}

function defaultPromptSnapshotPath(manifestPath: string): string {
  return manifestPath.replace(/\.json$/u, ".prompt.md");
}

function defaultRightsManifestPath(manifestPath: string): string {
  return manifestPath.replace(/\.json$/u, ".external.json");
}

export async function freezeZukanBenchManifest(options: {
  baseUrl?: string;
  count?: number;
  outputPath?: string;
} = {}): Promise<ZukanBenchManifest> {
  const baseUrl = (options.baseUrl ?? PRODUCTION_PUBLIC_ORIGIN).replace(/\/+$/u, "");
  const count = Math.max(1, Math.floor(options.count ?? ZUKAN_BENCH_CORE_POST_COUNT));
  const outputPath = options.outputPath ?? DEFAULT_ZUKAN_BENCH_MANIFEST;
  const promptPath = defaultPromptSnapshotPath(outputPath);
  await assertNewFile(outputPath);
  await assertNewFile(promptPath);

  const discoveryCount = Math.max(count * 2, count + 8);
  const resolved = await resolveObservationImageTargets({ baseUrl, count: discoveryCount });
  const selected = selectDeterministicPostTargets(resolved.targets, count);
  if (selected.length < count) throw new Error(`zukan_bench_not_enough_unique_posts:${selected.length}/${count}`);

  const prompt = await readFile(DEFAULT_PROMPT_SOURCE, "utf8");
  const fixtures: ZukanBenchFixture[] = [];
  for (const target of selected) {
    const detailPath = target.path;
    const detailHtml = await fetchText(fullUrl(baseUrl, detailPath));
    const sourceUrls = extractOrderedPostPhotoUrls(detailHtml);
    const orderedUrls = sourceUrls.length > 0 ? sourceUrls : [target.photoUrl];
    const images: ZukanBenchImage[] = [];
    for (const [index, rawUrl] of orderedUrls.entries()) {
      const url = fullUrl(baseUrl, rawUrl);
      const image = await fetchImage(url);
      images.push({
        index,
        url,
        sha256: sha256(image.bytes),
        bytes: image.bytes.byteLength,
        mimeType: image.mimeType,
      });
    }
    fixtures.push({
      fixtureId: `zukan-post-${target.visitId}`,
      visitId: target.visitId,
      occurrenceId: target.occurrenceId,
      detailPath,
      observedAt: target.observedAt,
      images,
      postInputSha256: canonicalImageDigest(images),
      gold: inferGold(target, detailHtml),
      externalExportAllowed: null,
      mediaLicense: null,
      rightsPolicyVersion: null,
      withdrawalStatus: null,
    });
  }

  const manifest: ZukanBenchManifest = {
    version: ZUKAN_MODEL_BENCH_VERSION,
    sourceOrigin: baseUrl,
    frozenAt: new Date().toISOString(),
    selectionPolicy: "deterministic_seeded_visit_order",
    selectionSeed: SELECTION_SEED,
    postCount: fixtures.length,
    imageCount: fixtures.reduce((sum, fixture) => sum + fixture.images.length, 0),
    datasetSha256: canonicalFixtureDigest(fixtures),
    promptPath,
    promptSha256: sha256(prompt),
    externalProcessingVettedAt: null,
    fixtures,
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(promptPath, prompt, "utf8");
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

export async function loadZukanBenchManifest(manifestPath: string): Promise<ZukanBenchManifest> {
  const parsed = JSON.parse(await readFile(manifestPath, "utf8")) as ZukanBenchManifest;
  if (parsed.version !== ZUKAN_MODEL_BENCH_VERSION || !Array.isArray(parsed.fixtures) || parsed.fixtures.length === 0) {
    throw new Error("zukan_bench_manifest_invalid");
  }
  if (parsed.fixtures.some((fixture) => !Array.isArray(fixture.images) || fixture.images.length === 0)) {
    throw new Error("zukan_bench_manifest_post_without_images");
  }
  for (const fixture of parsed.fixtures) {
    if (canonicalImageDigest(fixture.images) !== fixture.postInputSha256) {
      throw new Error(`zukan_bench_post_digest_mismatch:${fixture.fixtureId}`);
    }
  }
  const digest = canonicalFixtureDigest(parsed.fixtures);
  if (digest !== parsed.datasetSha256) throw new Error(`zukan_bench_manifest_digest_mismatch:${digest}:${parsed.datasetSha256}`);
  const prompt = await readFile(parsed.promptPath, "utf8");
  const promptDigest = sha256(prompt);
  if (promptDigest !== parsed.promptSha256) throw new Error(`zukan_bench_prompt_digest_mismatch:${promptDigest}:${parsed.promptSha256}`);
  return parsed;
}

export async function vetZukanBenchRights(options: {
  manifestPath?: string;
  outputPath?: string;
} = {}): Promise<ZukanBenchManifest> {
  const manifestPath = options.manifestPath ?? DEFAULT_ZUKAN_BENCH_MANIFEST;
  const manifest = await loadZukanBenchManifest(manifestPath);
  const outputPath = options.outputPath ?? defaultRightsManifestPath(manifestPath);
  await assertNewFile(outputPath);
  const eligible: ZukanBenchFixture[] = [];
  for (const fixture of manifest.fixtures) {
    const rights = await getObservationDataRights(fixture.visitId);
    if (!rights || rights.withdrawalStatus !== "active" || rights.externalExportAllowed !== true) continue;
    eligible.push({
      ...fixture,
      externalExportAllowed: true,
      mediaLicense: rights.mediaLicense,
      rightsPolicyVersion: rights.rightsPolicyVersion,
      withdrawalStatus: rights.withdrawalStatus,
    });
  }
  if (eligible.length === 0) throw new Error("zukan_bench_no_external_export_eligible_posts");
  const vetted: ZukanBenchManifest = {
    ...manifest,
    postCount: eligible.length,
    imageCount: eligible.reduce((sum, fixture) => sum + fixture.images.length, 0),
    datasetSha256: canonicalFixtureDigest(eligible),
    externalProcessingVettedAt: new Date().toISOString(),
    fixtures: eligible,
  };
  await writeFile(outputPath, `${JSON.stringify(vetted, null, 2)}\n`, "utf8");
  return vetted;
}

function renderColdStartPrompt(template: string, fixture: ZukanBenchFixture): string {
  const substitutions: Record<string, string> = {
    occurrenceId: fixture.occurrenceId,
    lat: "不明",
    lng: "不明",
    observedAt: fixture.observedAt || "不明",
    season: "不明",
    existingLabel: "未入力",
    siteBriefLabel: "不明",
    profileDigestSummary: "なし",
    observationPackageSummary: `同一投稿の写真${fixture.images.length}枚。写真順は投稿順。位置情報・既存同定・観察者個人情報は評価から除外。`,
    knowledgeClaimsContext: "なし",
  };
  const rendered = template.replace(/\$\{([A-Za-z0-9_]+)\}/gu, (_match, key: string) => substitutions[key] ?? "不明");
  return `${rendered}\n\n## ベンチマーク追加条件\nこれは同一投稿を1ケースとするcold-start評価です。上の${fixture.images.length}枚は同じ投稿の写真で、投稿順です。写真群をまとめて判断してください。既存ラベル、位置、観察者情報は与えられていません。画像群だけで種まで確定できない場合は粗いrankで止め、位置を推測しないでください。JSONのみ返してください。`;
}

function parseJsonObject(raw: string): BenchResponse | null {
  try {
    const direct = JSON.parse(raw) as unknown;
    if (direct && typeof direct === "object" && !Array.isArray(direct)) return direct as BenchResponse;
  } catch {
    // fall through
  }
  const match = raw.match(/\{[\s\S]*\}/u);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as BenchResponse : null;
  } catch {
    return null;
  }
}

function candidateNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    return [clean(row.taxon_name), clean(row.scientific_name)].filter(Boolean);
  });
}

function matchesGold(value: string, gold: ZukanBenchGold): boolean {
  const candidate = normalizeTaxon(value);
  return Boolean(candidate) && [gold.label, ...gold.aliases].some((alias) => Boolean(alias) && normalizeTaxon(alias) === candidate);
}

function sameGenus(value: string, gold: ZukanBenchGold): boolean {
  const candidateGenus = normalizeTaxon(value).split(" ")[0] ?? "";
  return Boolean(candidateGenus) && gold.aliases.some((alias) => normalizeTaxon(alias).split(" ")[0] === candidateGenus);
}

function rankDepth(rank: string): number {
  return ["lifeform", "order", "family", "genus", "species"].indexOf(rank);
}

export function scoreZukanBenchResponse(fixture: ZukanBenchFixture, rawText: string): ZukanBenchFixtureScore {
  const parsed = parseJsonObject(rawText);
  if (!parsed) return {
    fixtureId: fixture.fixtureId,
    visitId: fixture.visitId,
    imageCount: fixture.images.length,
    schemaValid: false,
    taxonScore: fixture.gold.status === "human_consensus" ? 0 : null,
    criticalFailures: ["invalid_json"],
  };
  const recommended = clean(parsed.recommended_taxon_name);
  const rank = clean(parsed.recommended_rank).toLowerCase();
  const confidence = clean(parsed.confidence_band).toLowerCase();
  const schemaValid = Boolean(recommended && VALID_RANKS.has(rank) && VALID_CONFIDENCE.has(confidence));
  const criticalFailures: string[] = [];
  const geography = clean(parsed.geographic_context);
  if (LOCATION_ASSERTION_RE.test(geography) && !/(?:不明|未取得|保留|評価でき|推測しない|特定でき)/u.test(geography)) {
    criticalFailures.push("location_hallucination");
  }

  let taxonScore: number | null = null;
  if (fixture.gold.status === "human_consensus" && fixture.gold.label) {
    const candidates = candidateNames(parsed.taxonomic_candidates);
    if (matchesGold(recommended, fixture.gold)) taxonScore = 1;
    else if (candidates.some((candidate) => matchesGold(candidate, fixture.gold))) taxonScore = 0.8;
    else if (sameGenus(recommended, fixture.gold)) taxonScore = 0.5;
    else taxonScore = 0;
    if (confidence === "high" && rank === "species" && !matchesGold(recommended, fixture.gold)) {
      criticalFailures.push("high_confidence_wrong_species");
    }
    if (fixture.gold.rank && confidence === "high" && rankDepth(rank) > rankDepth(fixture.gold.rank)) {
      criticalFailures.push("overprecise_beyond_human_gold");
    }
  }
  if (!schemaValid) criticalFailures.push("schema_invalid");
  return {
    fixtureId: fixture.fixtureId,
    visitId: fixture.visitId,
    imageCount: fixture.images.length,
    schemaValid,
    taxonScore,
    criticalFailures: [...new Set(criticalFailures)],
  };
}

function percentile(values: number[], quantile: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1))] ?? 0;
}

function estimatedCost(inputTokens: number, outputTokens: number, pricing: BenchPricing | null): number | null {
  if (!pricing) return null;
  return Number((((inputTokens / 1_000_000) * pricing.inputUsdPer1M) + ((outputTokens / 1_000_000) * pricing.outputUsdPer1M)).toFixed(8));
}

function modelProvider(model: string): string {
  const separator = model.indexOf(":");
  return separator > 0 ? model.slice(0, separator) : "unknown";
}

function assertExternalProcessingAllowed(manifest: ZukanBenchManifest): void {
  if (!manifest.externalProcessingVettedAt || manifest.fixtures.some((fixture) => fixture.externalExportAllowed !== true || fixture.withdrawalStatus !== "active")) {
    throw new Error("zukan_bench_rights_vetted_manifest_required");
  }
  if (process.env.ZUKAN_MODEL_BENCH_ALLOW_EXTERNAL_IMAGE_PROCESSING !== "1") {
    throw new Error("zukan_bench_external_provider_not_acknowledged");
  }
}

function configureModelProvider(model: string): void {
  if (!model.startsWith("openai-compatible:")) return;
  const modelId = model.slice("openai-compatible:".length);
  if (!modelId.startsWith("@cf/")) return;
  const accountId = clean(process.env.CLOUDFLARE_ACCOUNT_ID);
  const token = clean(process.env.CLOUDFLARE_API_TOKEN ?? process.env.CLOUDFLARE_AUTH_TOKEN);
  if (!accountId || !token) throw new Error("zukan_bench_cloudflare_credentials_missing");
  process.env.OPENAI_COMPATIBLE_API_KEY = token;
  process.env.OPENAI_COMPATIBLE_CHAT_COMPLETIONS_URL = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
}

export async function runZukanModelBench(options: {
  model: string;
  manifestPath?: string;
  reportDir?: string;
  pricing?: BenchPricing | null;
  limit?: number;
}): Promise<ZukanBenchModelReport> {
  const manifestPath = options.manifestPath ?? defaultRightsManifestPath(DEFAULT_ZUKAN_BENCH_MANIFEST);
  const reportDir = options.reportDir ?? DEFAULT_ZUKAN_BENCH_REPORT_DIR;
  const manifest = await loadZukanBenchManifest(manifestPath);
  assertExternalProcessingAllowed(manifest);
  configureModelProvider(options.model);
  const promptTemplate = await readFile(manifest.promptPath, "utf8");
  const fixtures = typeof options.limit === "number" && options.limit > 0
    ? manifest.fixtures.slice(0, Math.floor(options.limit))
    : manifest.fixtures;
  const previousChain = process.env[MODEL_CHAIN_ENV];
  process.env[MODEL_CHAIN_ENV] = options.model;
  const startedAt = new Date().toISOString();
  const fixtureScores: ZukanBenchFixtureScore[] = [];
  const latencies: number[] = [];
  let successCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  try {
    for (const fixture of fixtures) {
      const parts: AiRouterPart[] = [];
      const verifiedImages: ZukanBenchImage[] = [];
      for (const imageRef of fixture.images) {
        const image = await fetchImage(imageRef.url);
        const actualDigest = sha256(image.bytes);
        if (actualDigest !== imageRef.sha256 || image.bytes.byteLength !== imageRef.bytes || image.mimeType !== imageRef.mimeType) {
          throw new Error(`zukan_bench_image_identity_mismatch:${fixture.fixtureId}:${imageRef.index}`);
        }
        verifiedImages.push(imageRef);
        parts.push({ inlineData: { mimeType: imageRef.mimeType, data: image.bytes.toString("base64") } });
      }
      if (canonicalImageDigest(verifiedImages) !== fixture.postInputSha256) {
        throw new Error(`zukan_bench_post_identity_mismatch:${fixture.fixtureId}`);
      }
      parts.push({ text: renderColdStartPrompt(promptTemplate, fixture) });
      const started = Date.now();
      try {
        const result = await generateAiTextWithRoleChain({
          chainName: "observationVisualExtract",
          parts,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: "minimal" },
          temperature: 0,
          maxOutputTokens: 4096,
          retriesPerModel: 1,
        });
        latencies.push(Date.now() - started);
        totalInputTokens += result.inputTokens;
        totalOutputTokens += result.outputTokens;
        fixtureScores.push(scoreZukanBenchResponse(fixture, result.text));
        successCount += 1;
      } catch (error) {
        latencies.push(Date.now() - started);
        fixtureScores.push({
          fixtureId: fixture.fixtureId,
          visitId: fixture.visitId,
          imageCount: fixture.images.length,
          schemaValid: false,
          taxonScore: fixture.gold.status === "human_consensus" ? 0 : null,
          criticalFailures: [`model_error:${error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180)}`],
        });
      }
    }
  } finally {
    if (previousChain === undefined) delete process.env[MODEL_CHAIN_ENV];
    else process.env[MODEL_CHAIN_ENV] = previousChain;
  }

  const goldScores = fixtureScores.filter((score) => score.taxonScore !== null);
  const report: ZukanBenchModelReport = {
    version: ZUKAN_MODEL_BENCH_VERSION,
    promptVersion: ZUKAN_MODEL_BENCH_PROMPT_VERSION,
    promptSha256: manifest.promptSha256,
    model: options.model,
    provider: modelProvider(options.model),
    manifestPath,
    datasetSha256: manifest.datasetSha256,
    startedAt,
    completedAt: new Date().toISOString(),
    postCount: fixtures.length,
    imageCount: fixtures.reduce((sum, fixture) => sum + fixture.images.length, 0),
    successCount,
    schemaValidRatePct: Number(((fixtureScores.filter((score) => score.schemaValid).length / Math.max(1, fixtures.length)) * 100).toFixed(2)),
    goldPostCount: goldScores.length,
    taxonScorePct: goldScores.length
      ? Number(((goldScores.reduce((sum, score) => sum + (score.taxonScore ?? 0), 0) / goldScores.length) * 100).toFixed(2))
      : null,
    criticalFailurePostCount: fixtureScores.filter((score) => score.criticalFailures.length > 0).length,
    p50LatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
    totalInputTokens,
    totalOutputTokens,
    estimatedCostUsd: estimatedCost(totalInputTokens, totalOutputTokens, options.pricing ?? null),
    pricing: options.pricing ?? null,
    fixtureScores,
  };
  await mkdir(reportDir, { recursive: true });
  const safeModel = options.model.replace(/[^a-z0-9._-]+/giu, "-").replace(/^-+|-+$/gu, "").slice(0, 90);
  const suffix = fixtures.length === ZUKAN_BENCH_SMOKE_POST_COUNT ? "smoke" : "core";
  const reportPath = path.join(reportDir, `${new Date().toISOString().slice(0, 10)}-${safeModel}-${suffix}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

export type ZukanBenchComparison = {
  datasetSha256: string;
  promptSha256: string;
  decision: "KEEP" | "SWITCH" | "REJECT_CHALLENGER" | "INSUFFICIENT_GOLD";
  baselineModel: string;
  winnerModel: string;
  reason: string;
};

function hardGatePass(report: ZukanBenchModelReport): boolean {
  const successRatePct = (report.successCount / Math.max(1, report.postCount)) * 100;
  const criticalRatePct = (report.criticalFailurePostCount / Math.max(1, report.postCount)) * 100;
  return successRatePct >= 99 && report.schemaValidRatePct >= 99 && criticalRatePct <= 2;
}

export function compareZukanBenchReports(reports: ZukanBenchModelReport[]): ZukanBenchComparison {
  if (reports.length < 2) throw new Error("zukan_bench_compare_requires_two_reports");
  const baseline = reports[0];
  if (!baseline) throw new Error("zukan_bench_compare_missing_baseline");
  for (const report of reports) {
    if (report.datasetSha256 !== baseline.datasetSha256) throw new Error("zukan_bench_compare_dataset_mismatch");
    if (report.promptSha256 !== baseline.promptSha256) throw new Error("zukan_bench_compare_prompt_mismatch");
    if (report.postCount !== baseline.postCount || report.imageCount !== baseline.imageCount) throw new Error("zukan_bench_compare_input_shape_mismatch");
  }
  const maxGold = Math.max(...reports.map((report) => report.goldPostCount));
  if (maxGold < ZUKAN_BENCH_MIN_GOLD_POSTS) return {
    datasetSha256: baseline.datasetSha256,
    promptSha256: baseline.promptSha256,
    decision: "INSUFFICIENT_GOLD",
    baselineModel: baseline.model,
    winnerModel: baseline.model,
    reason: `Human-consensus gold posts are ${maxGold}; at least ${ZUKAN_BENCH_MIN_GOLD_POSTS} are required for automatic switching.`,
  };

  const eligible = reports.filter(hardGatePass);
  const challengerEligible = eligible.filter((report) => report.model !== baseline.model);
  if (!challengerEligible.length) return {
    datasetSha256: baseline.datasetSha256,
    promptSha256: baseline.promptSha256,
    decision: "REJECT_CHALLENGER",
    baselineModel: baseline.model,
    winnerModel: baseline.model,
    reason: "No challenger passed the success/schema/critical-failure hard gates.",
  };

  const ranked = [...eligible].sort((a, b) => {
    const quality = (b.taxonScorePct ?? -1) - (a.taxonScorePct ?? -1);
    if (Math.abs(quality) > 1) return quality;
    if (a.estimatedCostUsd !== null && b.estimatedCostUsd !== null && a.estimatedCostUsd !== b.estimatedCostUsd) {
      return a.estimatedCostUsd - b.estimatedCostUsd;
    }
    return a.p95LatencyMs - b.p95LatencyMs;
  });
  const winner = ranked[0] ?? baseline;
  return {
    datasetSha256: baseline.datasetSha256,
    promptSha256: baseline.promptSha256,
    decision: winner.model === baseline.model ? "KEEP" : "SWITCH",
    baselineModel: baseline.model,
    winnerModel: winner.model,
    reason: winner.model === baseline.model
      ? "Baseline remains best after hard gates; quality wins first, then cost and p95 latency within a 1-point quality tie."
      : "Challenger passed hard gates and ranked best by post-level taxon quality, then cost and p95 latency within a 1-point quality tie.",
  };
}

function numericArg(args: string[], name: string): number | undefined {
  const raw = args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function stringArg(args: string[], name: string): string | undefined {
  return args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function pricingFromArgs(args: string[]): BenchPricing | null {
  const inputUsdPer1M = numericArg(args, "input-usd-per-1m");
  const outputUsdPer1M = numericArg(args, "output-usd-per-1m");
  if (inputUsdPer1M === undefined || outputUsdPer1M === undefined) return null;
  return { inputUsdPer1M, outputUsdPer1M, source: stringArg(args, "pricing-source") ?? "manual-cli" };
}

async function main(): Promise<void> {
  const [command = "run", ...args] = process.argv.slice(2);
  if (command === "freeze") {
    const manifest = await freezeZukanBenchManifest({
      baseUrl: stringArg(args, "base-url"),
      count: numericArg(args, "count"),
      outputPath: stringArg(args, "out"),
    });
    console.log(JSON.stringify({ status: "FROZEN", postCount: manifest.postCount, imageCount: manifest.imageCount, datasetSha256: manifest.datasetSha256 }, null, 2));
    return;
  }
  if (command === "vet-rights") {
    const manifest = await vetZukanBenchRights({
      manifestPath: stringArg(args, "manifest"),
      outputPath: stringArg(args, "out"),
    });
    console.log(JSON.stringify({ status: "RIGHTS_VETTED", postCount: manifest.postCount, imageCount: manifest.imageCount, datasetSha256: manifest.datasetSha256 }, null, 2));
    return;
  }
  if (command === "run") {
    const model = stringArg(args, "model");
    if (!model) throw new Error("--model is required; example: --model=openai-compatible:@cf/zai-org/glm-5.3-flash");
    const report = await runZukanModelBench({
      model,
      manifestPath: stringArg(args, "manifest"),
      reportDir: stringArg(args, "report-dir"),
      pricing: pricingFromArgs(args),
      limit: numericArg(args, "limit"),
    });
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (command === "compare") {
    const reportPaths = (stringArg(args, "reports") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
    if (reportPaths.length < 2) throw new Error("--reports requires at least baseline.json,challenger.json");
    const reports = await Promise.all(reportPaths.map(async (reportPath) => JSON.parse(await readFile(reportPath, "utf8")) as ZukanBenchModelReport));
    console.log(JSON.stringify(compareZukanBenchReports(reports), null, 2));
    return;
  }
  throw new Error(`unknown command:${command}; use freeze, vet-rights, run, or compare`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
