import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import sharp from "sharp";
import { AI_MODEL_CHAIN_ENV_KEYS } from "../services/aiModels.js";
import { generateAiTextWithRoleChain, googleMediaResolution, googleResponseText, type AiRouterPart } from "../services/aiModelRouter.js";
import { getObservationDataRights, type ObservationDataRights } from "../services/observationDataRights.js";
import { PRODUCTION_PUBLIC_ORIGIN } from "../services/trustedPublicOrigin.js";
import { observationImageTargetPath, resolveObservationImageTargets, type ObservationImageTarget } from "./resolveObservationImageTargets.js";

export const ZUKAN_MODEL_BENCH_VERSION = "zukan-post-model-bench-v2";
export const ZUKAN_MODEL_BENCH_PROMPT_VERSION = "observation-reassess-post-cold-start-v2";
export const DEFAULT_ZUKAN_BENCH_MANIFEST = "ops/model-bench/fixtures/zukan-public-post-core-v2.json";
export const DEFAULT_ZUKAN_BENCH_SMOKE_MANIFEST = "ops/model-bench/fixtures/zukan-public-post-smoke-v2.external.json";
export const DEFAULT_ZUKAN_OWNER_BENCH_SMOKE_MANIFEST = "ops/model-bench/fixtures/zukan-owner-post-smoke-v2.json";
export const DEFAULT_ZUKAN_OWNER_BENCH_SMOKE_EXTERNAL_MANIFEST = "ops/model-bench/fixtures/zukan-owner-post-smoke-v2.external.json";
export const DEFAULT_ZUKAN_BENCH_REPORT_DIR = "ops/model-bench/reports";
export const ZUKAN_BENCH_CORE_POST_COUNT = 24;
export const ZUKAN_BENCH_SMOKE_POST_COUNT = 8;
export const ZUKAN_BENCH_MIN_GOLD_POSTS = 8;
export const ZUKAN_OWNER_BENCH_SMOKE_DATASET_SHA256 = "5636ef685524c59813449c3c9afffbeaee4be062d80834f3f86bc3ee185b251b";
export const ZUKAN_OWNER_BENCH_SMOKE_PROMPT_SHA256 = "6d0cc93200ad45142713287f81a8a55d96489c0c0e9397b15098ed6b387fd9e9";
export const CLOUDFLARE_GLM_5_3_FLASH_MODEL = "@cf/zai-org/glm-5.3-flash";
export const CLOUDFLARE_QWEN_3_8_27B_MODEL = "@cf/qwen/qwen3.8-27b";
export const CLOUDFLARE_LLAMA_3_2_11B_VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
export const CLOUDFLARE_OPENAI_GPT_5_6_LUNA_MODEL = "openai/gpt-5.6-luna";
export const CLOUDFLARE_GOOGLE_GEMINI_3_7_FLASH_MODEL = "google-ai-studio/gemini-3.7-flash";
export const CLOUDFLARE_XAI_GROK_4_6_MODEL = "grok/grok-4.6";
export const XAI_GROK_4_6_MODEL = "grok-4.6";
export const ZUKAN_PRODUCTION_VISION_BASELINE_MODEL = "gemini-3.5-flash-lite";
export const ZUKAN_BENCH_REPORT_SCHEMA_VERSION = "zukan-model-bench-report-v1";
export type ZukanBenchOutputContractVersion = "legacy-v1" | "compact-v2";
export const ZUKAN_BENCH_MODEL_RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    confidence_band: { type: "string", enum: ["high", "medium", "low"] },
    recommended_rank: { type: "string", enum: ["species", "genus", "family", "order", "lifeform"] },
    recommended_taxon_name: { type: "string" },
  },
  required: ["confidence_band", "recommended_rank", "recommended_taxon_name"],
  additionalProperties: true,
} as const;
export const ZUKAN_BENCH_COMPACT_RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    confidence_band: { type: "string", enum: ["high", "medium", "low"], description: "Overall visual-evidence confidence." },
    recommended_rank: { type: "string", enum: ["species", "genus", "family", "order", "lifeform"], description: "Stop at the finest rank supported by visible evidence." },
    recommended_taxon_name: { type: "string", description: "Taxon name only. Do not include rationale, caveats, prose, location, or observer information." },
    taxonomic_candidates: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          taxon_name: { type: "string", description: "Candidate taxon name only." },
          rank: { type: "string", enum: ["species", "genus", "family", "order", "lifeform"] },
          confidence_band: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["taxon_name", "rank", "confidence_band"],
        additionalProperties: false,
      },
    },
    diagnostic_features_observed: { type: "array", maxItems: 8, items: { type: "string" }, description: "Short visible features shared across the ordered images." },
    diagnostic_features_missing: { type: "array", maxItems: 8, items: { type: "string" }, description: "Short diagnostic features that cannot be verified." },
    uncertain_features: { type: "array", maxItems: 6, items: { type: "string" }, description: "Short ambiguous or contradictory visual observations." },
    geographic_context: { type: "string", description: "Use withheld or unknown because location is not provided to the model." },
  },
  required: [
    "confidence_band",
    "recommended_rank",
    "recommended_taxon_name",
    "taxonomic_candidates",
    "diagnostic_features_observed",
    "diagnostic_features_missing",
    "uncertain_features",
    "geographic_context",
  ],
  additionalProperties: false,
} as const;
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

export type ZukanBenchCanonicalRightsSnapshot = Pick<ObservationDataRights,
  | "visitId"
  | "recordConsent"
  | "researchUseConsent"
  | "datasetLicense"
  | "mediaLicense"
  | "externalExportAllowed"
  | "withdrawalStatus"
>;

export type ZukanBenchProviderResultMeta = {
  http_status: number | null;
  content_type: string | null;
  response_shape: "chat_completions" | "responses" | "error" | "unknown";
  root_fields: string[];
  envelope_fields: string[];
  response_fields: string[];
  usage_fields: string[];
  finish_reason: string | null;
  status: string | null;
  provider_error_fields: string[];
  provider_error_code: string | null;
  model: string | null;
};

export type ZukanBenchHumanReviewFields = {
  visual_grounding?: unknown;
  hallucinated_features?: unknown;
  useful_observations?: unknown;
  missing_observations?: unknown;
  taxonomic_reasonableness?: unknown;
  abstention_quality?: unknown;
  explanation_quality?: unknown;
  human_reviewer_notes?: unknown;
};

export type ZukanBenchRequestConfig = {
  transport: "model-router" | "cloudflare-official-rest" | "cloudflare-ai-rest" | "cloudflare-ai-run" | "cloudflare-google-native" | "cloudflare-xai-native";
  temperature: number;
  max_completion_tokens?: number;
  max_output_tokens?: number;
  reasoning_effort?: "low";
  thinking_level?: "minimal" | "low" | "medium" | "high";
  media_resolution?: "low" | "medium" | "high";
  image_max_edge?: number;
  image_fetch_origin?: string;
  stream: false;
  modalities: "omitted";
  response_format?: { type: "json_object" } | { type: "json_schema"; json_schema: unknown };
  response_mime_type?: "application/json";
  response_schema_mode?: "provider-native" | "parser-only";
  output_schema: "zukan-model-bench-parser-v1" | "zukan-model-bench-compact-v2";
  output_schema_sha256?: string;
  execution_concurrency?: number;
  canary_gate_report?: string;
  gateway_selection?: "explicit-existing-named-gateway-only";
  attempts_per_model: 1;
  fallback_count: 0;
};

export type ZukanBenchFinalOutputRecord = {
  raw_final_content: string | null;
  parsed_json: Record<string, unknown> | null;
  recommended_taxon: string | null;
  recommended_rank: string | null;
  confidence: string | null;
  candidates: unknown;
  observed_features: unknown;
  diagnostic_features: unknown;
  missing_features: unknown;
  uncertain_features: unknown;
  geographic_context: unknown;
  context_fields: Record<string, unknown>;
  other_final_output_fields: Record<string, unknown>;
  finish_reason: string | null;
  token_usage: { input_tokens: number | null; output_tokens: number | null };
  latency_ms: number | null;
  model: string;
  provider: string;
  config: ZukanBenchRequestConfig;
  dataset_sha256: string;
  post_sha256: string;
  image_sha256: string[];
  transmitted_image_sha256: string[];
  transmitted_image_bytes: number[];
  transmitted_image_mime_types: string[];
  transmitted_post_sha256: string;
  prompt_sha256: string;
  response_field: string | null;
  http_status?: number | null;
  content_type?: string | null;
  provider_result_meta?: ZukanBenchProviderResultMeta | null;
  human_review?: ZukanBenchHumanReviewFields | null;
  internal_reasoning_saved: false;
  raw_content_redacted: boolean;
};

export type ZukanBenchFixtureScore = {
  fixtureId: string;
  visitId: string;
  imageCount: number;
  schemaValid: boolean;
  taxonScore: number | null;
  criticalFailures: string[];
  recommendedTaxonName?: string;
  recommendedRank?: string;
  confidenceBand?: string;
  geographicContext?: string;
  responseField?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  rawResponseText?: string;
  finishReason?: string | null;
  finalOutput?: ZukanBenchFinalOutputRecord;
};

export type ZukanBenchModelReport = {
  version: typeof ZUKAN_MODEL_BENCH_VERSION;
  promptVersion: string;
  promptSha256: string;
  outputContractVersion?: ZukanBenchOutputContractVersion;
  outputSchemaSha256?: string;
  executionConcurrency?: number;
  canaryReportPath?: string | null;
  model: string;
  provider: string;
  manifestPath: string;
  datasetSha256: string;
  startedAt: string;
  completedAt: string;
  postCount: number;
  imageCount: number;
  successCount: number;
  modelRequestCount: number;
  successRatePct: number;
  schemaValidRatePct: number;
  goldPostCount: number;
  taxonScorePct: number | null;
  criticalFailurePostCount: number;
  highConfidenceWrongPostCount: number;
  overprecisionPostCount: number;
  locationHallucinationPostCount: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostUsd: number | null;
  pricing: { inputUsdPer1M: number; outputUsdPer1M: number; source: string } | null;
  transport?: "model-router" | "cloudflare-official-rest" | "cloudflare-ai-rest" | "cloudflare-ai-run" | "cloudflare-google-native" | "cloudflare-xai-native";
  usageMeasurement?: "provider-reported" | "not-exposed";
  observedAdditionalCostUsd?: number | null;
  reportSchemaVersion?: typeof ZUKAN_BENCH_REPORT_SCHEMA_VERSION;
  requestConfig?: ZukanBenchRequestConfig;
  accuracyStatus?: "INSUFFICIENT_GOLD" | "MEASURED";
  reportPath?: string;
  fixtureScores: ZukanBenchFixtureScore[];
};

type BenchResponse = Record<string, unknown> & {
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

type ResearchOccurrenceCandidate = {
  eventID?: unknown;
  occurrenceID?: unknown;
  eventDate?: unknown;
  scientificName?: unknown;
  vernacularName?: unknown;
  taxonRank?: unknown;
  consensusStatus?: unknown;
  identificationVerificationStatus?: unknown;
  associatedMedia?: unknown;
  licenseStatus?: {
    mediaLicense?: unknown;
    externalExportAllowed?: unknown;
    withdrawalStatus?: unknown;
    rightsPolicyVersion?: unknown;
  } | null;
};

type RightsVettedTarget = ObservationImageTarget & {
  gold: ZukanBenchGold;
  mediaLicense: string | null;
  rightsPolicyVersion: string | null;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";
}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function zukanBenchResponseSchema(contract: ZukanBenchOutputContractVersion): typeof ZUKAN_BENCH_MODEL_RESPONSE_JSON_SCHEMA | typeof ZUKAN_BENCH_COMPACT_RESPONSE_JSON_SCHEMA {
  return contract === "compact-v2" ? ZUKAN_BENCH_COMPACT_RESPONSE_JSON_SCHEMA : ZUKAN_BENCH_MODEL_RESPONSE_JSON_SCHEMA;
}

export function zukanBenchOutputSchemaSha256(contract: ZukanBenchOutputContractVersion): string {
  return sha256(JSON.stringify(zukanBenchResponseSchema(contract)));
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
    throw new Error(`zukan_bench_concurrency_invalid:${concurrency}`);
  }
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]!, index);
    }
  }));
  return results;
}

export function assertZukanBenchParallelCanary(input: {
  canary: ZukanBenchModelReport | undefined;
  model: string;
  datasetSha256: string;
  promptSha256: string;
  outputContract: ZukanBenchOutputContractVersion;
  outputSchemaSha256: string;
  fixtureCount: number;
  maxEstimatedCostUsd: number | undefined;
}): void {
  const canary = input.canary;
  if (!canary || canary.postCount !== 1 || canary.successCount !== 1 || canary.schemaValidRatePct !== 100) {
    throw new Error("zukan_bench_parallel_canary_invalid");
  }
  if (
    canary.model !== input.model
    || canary.datasetSha256 !== input.datasetSha256
    || canary.promptSha256 !== input.promptSha256
    || (canary.outputContractVersion ?? "legacy-v1") !== input.outputContract
    || canary.outputSchemaSha256 !== input.outputSchemaSha256
  ) {
    throw new Error("zukan_bench_parallel_canary_identity_mismatch");
  }
  if (input.maxEstimatedCostUsd === undefined || canary.estimatedCostUsd === null) {
    throw new Error("zukan_bench_parallel_cost_preflight_required");
  }
  const projectedUpperBound = canary.estimatedCostUsd * input.fixtureCount * 2;
  if (projectedUpperBound > input.maxEstimatedCostUsd) {
    throw new Error(`zukan_bench_parallel_cost_cap_preflight:${projectedUpperBound.toFixed(8)}/${input.maxEstimatedCostUsd.toFixed(8)}`);
  }
}

export type ZukanBenchTransmittedImage = {
  buffer: Buffer;
  mimeType: string;
  sha256: string;
  bytes: number;
};

export async function prepareZukanBenchImageForTransmission(input: {
  buffer: Buffer;
  mimeType: string;
  maxEdge?: number;
}): Promise<ZukanBenchTransmittedImage> {
  const maxEdge = input.maxEdge;
  if (maxEdge === undefined) {
    return { buffer: input.buffer, mimeType: input.mimeType, sha256: sha256(input.buffer), bytes: input.buffer.length };
  }
  if (!Number.isInteger(maxEdge) || maxEdge < 320 || maxEdge > 4096) {
    throw new Error(`zukan_bench_image_max_edge_invalid:${maxEdge}`);
  }
  const buffer = await sharp(input.buffer, { failOn: "none" })
    .rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
  return { buffer, mimeType: "image/jpeg", sha256: sha256(buffer), bytes: buffer.length };
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
  const observationFirstRows = [...detailHtml.matchAll(/<figure\b[^>]*class="[^"]*\bof-media-slide\b[^"]*"[^>]*>[\s\S]*?<\/figure>/gu)]
    .map((match) => match[0])
    .map((figure) => figure.match(/<img\b[^>]*>/u)?.[0] ?? "")
    .map((tag) => htmlAttribute(tag, "src"))
    .filter(Boolean);
  if (observationFirstRows.length > 0) return [...new Set(observationFirstRows)];
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
  for (const target of [...targets].sort((a, b) => a.occurrenceId.localeCompare(b.occurrenceId))) {
    if (!eligibleTarget(target) || byVisit.has(target.visitId)) continue;
    byVisit.set(target.visitId, target);
  }
  return [...byVisit.values()]
    .sort((a, b) => selectionKey(a.visitId).localeCompare(selectionKey(b.visitId)) || a.visitId.localeCompare(b.visitId))
    .slice(0, Math.max(0, Math.floor(count)));
}

function humanConsensusRecord(record: ResearchOccurrenceCandidate): boolean {
  const consensus = clean(record.consensusStatus);
  const verification = clean(record.identificationVerificationStatus);
  return consensus === "authority_backed"
    || consensus === "community_consensus"
    || verification === "authority_reviewed"
    || verification === "community_consensus";
}

export function rightsVettedTargetsFromResearchPayload(payload: unknown): RightsVettedTarget[] {
  const records = payload && typeof payload === "object" && Array.isArray((payload as { records?: unknown }).records)
    ? (payload as { records: ResearchOccurrenceCandidate[] }).records
    : [];
  return records.flatMap((record): RightsVettedTarget[] => {
    const visitId = clean(record.eventID);
    const occurrenceId = clean(record.occurrenceID);
    const photoUrl = clean(record.associatedMedia);
    const label = meaningfulLabel(clean(record.vernacularName)) ?? meaningfulLabel(clean(record.scientificName));
    const rights = record.licenseStatus;
    if (!visitId || !occurrenceId || !photoUrl || !label || !humanConsensusRecord(record)) return [];
    if (rights?.externalExportAllowed !== true || clean(rights.withdrawalStatus) !== "active") return [];
    const scientificName = meaningfulLabel(clean(record.scientificName));
    return [{
      path: observationImageTargetPath({ visitId, occurrenceId }),
      visitId,
      occurrenceId,
      observedAt: clean(record.eventDate),
      displayName: label,
      photoUrl,
      source: /^record-\d+$/u.test(visitId) ? "record-path" : "occurrence-path",
      gold: {
        label,
        aliases: scientificName && normalizeTaxon(scientificName) !== normalizeTaxon(label) ? [scientificName] : [],
        rank: meaningfulLabel(clean(record.taxonRank)),
        status: "human_consensus",
      },
      mediaLicense: meaningfulLabel(clean(rights.mediaLicense)),
      rightsPolicyVersion: meaningfulLabel(clean(rights.rightsPolicyVersion)),
    }];
  });
}

async function fetchRightsVettedResearchTargets(baseUrl: string): Promise<RightsVettedTarget[]> {
  const url = new URL("/api/v1/research/occurrences", baseUrl);
  url.searchParams.set("export_ready_only", "true");
  url.searchParams.set("tier_gte", "1");
  url.searchParams.set("limit", "1000");
  const response = await fetch(url, { headers: { accept: "application/json", "cache-control": "no-store" } });
  if (!response.ok) throw new Error(`zukan_bench_research_api_failed:${response.status}:${url}`);
  return rightsVettedTargetsFromResearchPayload(await response.json());
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

async function fetchImage(url: string, overrideOrigin?: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const fetchUrl = resolveZukanBenchImageFetchUrl(url, overrideOrigin);
  const response = await fetch(fetchUrl, { headers: { accept: "image/*", "cache-control": "no-store" } });
  if (!response.ok) throw new Error(`zukan_bench_image_fetch_failed:${response.status}:${url}`);
  const mimeType = clean(response.headers.get("content-type") ?? "").split(";", 1)[0]?.toLowerCase() ?? "";
  if (!mimeType.startsWith("image/")) throw new Error(`zukan_bench_non_image:${mimeType}:${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength < 512) throw new Error(`zukan_bench_image_too_small:${bytes.byteLength}:${url}`);
  return { bytes, mimeType };
}

export function resolveZukanBenchImageFetchUrl(frozenUrl: string, overrideOrigin?: string): string {
  if (!overrideOrigin) return frozenUrl;
  const frozen = new URL(frozenUrl);
  const override = new URL(overrideOrigin);
  if (override.protocol !== "https:" || override.pathname !== "/" || override.search || override.hash || override.username || override.password) {
    throw new Error("zukan_bench_image_fetch_origin_invalid");
  }
  return new URL(`${frozen.pathname}${frozen.search}`, override.origin).toString();
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

export type ZukanBenchPrompt = {
  sourcePath: string;
  text: string;
  sha256: string;
};

export async function loadZukanBenchPrompt(
  manifest: Pick<ZukanBenchManifest, "promptPath">,
  promptSource?: string,
): Promise<ZukanBenchPrompt> {
  const sourcePath = promptSource?.trim() || manifest.promptPath;
  const text = await readFile(sourcePath, "utf8");
  return { sourcePath, text, sha256: sha256(text) };
}

export async function freezeZukanBenchManifest(options: {
  baseUrl?: string;
  count?: number;
  outputPath?: string;
  rightsVettedResearchApi?: boolean;
  ownerVisitIds?: string[];
} = {}): Promise<ZukanBenchManifest> {
  const baseUrl = (options.baseUrl ?? PRODUCTION_PUBLIC_ORIGIN).replace(/\/+$/u, "");
  const count = Math.max(1, Math.floor(options.count ?? ZUKAN_BENCH_CORE_POST_COUNT));
  const outputPath = options.outputPath ?? DEFAULT_ZUKAN_BENCH_MANIFEST;
  const promptPath = defaultPromptSnapshotPath(outputPath);
  await assertNewFile(outputPath);
  await assertNewFile(promptPath);

  const discoveryCount = Math.max(count * 2, count + 8);
  const ownerTargets = options.ownerVisitIds?.map((visitId): ObservationImageTarget => ({
    path: `/observations/${encodeURIComponent(visitId)}`,
    visitId,
    occurrenceId: `occ:${visitId}:0`,
    observedAt: "",
    displayName: "名前待ち",
    photoUrl: `/observations/${encodeURIComponent(visitId)}`,
    source: "record-path",
  })) ?? null;
  const directTargets = !ownerTargets && options.rightsVettedResearchApi ? await fetchRightsVettedResearchTargets(baseUrl) : null;
  const resolved = ownerTargets || directTargets ? null : await resolveObservationImageTargets({ baseUrl, count: discoveryCount });
  const selected = selectDeterministicPostTargets(ownerTargets ?? directTargets ?? resolved?.targets ?? [], count);
  if (selected.length < count) {
    const reason = options.rightsVettedResearchApi ? "zukan_bench_not_enough_rights_vetted_human_consensus_posts" : "zukan_bench_not_enough_unique_posts";
    throw new Error(`${reason}:${selected.length}/${count}`);
  }

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
    const vettedTarget = options.rightsVettedResearchApi ? target as RightsVettedTarget : null;
    fixtures.push({
      fixtureId: `zukan-post-${target.visitId}`,
      visitId: target.visitId,
      occurrenceId: target.occurrenceId,
      detailPath,
      observedAt: target.observedAt,
      images,
      postInputSha256: canonicalImageDigest(images),
      gold: vettedTarget?.gold ?? inferGold(target, detailHtml),
      externalExportAllowed: vettedTarget ? true : null,
      mediaLicense: vettedTarget?.mediaLicense ?? null,
      rightsPolicyVersion: vettedTarget?.rightsPolicyVersion ?? null,
      withdrawalStatus: vettedTarget ? "active" : null,
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
    externalProcessingVettedAt: options.rightsVettedResearchApi ? new Date().toISOString() : null,
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

const INTERNAL_REASONING_KEY_RE = /^(?:reasoning(?:_content|Content)?|thoughts?(?:_content|Content)?|thinking(?:_content|Content)?)$/iu;
const INTERNAL_REASONING_FIELD_RE = /["'](?:reasoning(?:_content|Content)?|thoughts?(?:_content|Content)?|thinking(?:_content|Content)?)["']\s*:/iu;
const SENSITIVE_OUTPUT_RE = /(?:\bbearer\s+[A-Za-z0-9._~+/=-]{12,}\b|\b(?:sk|AIza|xox[baprs]-)[A-Za-z0-9_-]{12,}\b|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?:email|e-mail|phone|telephone|tel|電話番号|携帯番号)\s*[:：]?\s*\+?[0-9][0-9 -]{7,}[0-9])/iu;
const FINAL_OUTPUT_PROJECTION_KEYS = new Set([
  "recommended_taxon_name",
  "recommended_rank",
  "confidence_band",
  "taxonomic_candidates",
  "candidate_readings",
  "candidates",
  "diagnostic_features_observed",
  "diagnostic_features_seen",
  "observed_features",
  "visible_features",
  "diagnostic_features",
  "diagnostic_features_missing",
  "missing_evidence",
  "missing_features",
  "uncertain_features",
  "uncertain_evidence",
  "geographic_context",
  "seasonal_context",
  "area_inference",
  "management_action_candidates",
  "confirm_more",
  "weak_points",
]);

function sanitizeFinalOutputValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeFinalOutputValue);
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && SENSITIVE_OUTPUT_RE.test(value)) return "[REDACTED]";
    return value;
  }
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !INTERNAL_REASONING_KEY_RE.test(key))
    .map(([key, item]) => [key, sanitizeFinalOutputValue(item)]));
}

function outputField(parsed: Record<string, unknown> | null, keys: string[]): unknown {
  if (!parsed) return null;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(parsed, key)) return parsed[key];
  }
  return null;
}

function outputFieldProjection(parsed: Record<string, unknown> | null, keys: string[]): Record<string, unknown> | null {
  if (!parsed) return null;
  const projected = Object.fromEntries(keys
    .filter((key) => Object.prototype.hasOwnProperty.call(parsed, key))
    .map((key) => [key, parsed[key]]));
  return Object.keys(projected).length > 0 ? projected : null;
}

function persistedFinalContent(rawText: string | null | undefined, responseField: string | null | undefined): {
  text: string | null;
  redacted: boolean;
} {
  if (!rawText || responseField?.includes("reasoning_content")) return { text: null, redacted: false };
  if (INTERNAL_REASONING_FIELD_RE.test(rawText) || SENSITIVE_OUTPUT_RE.test(rawText)) {
    const parsed = parseJsonObject(rawText);
    if (!parsed) return { text: null, redacted: true };
    return {
      text: JSON.stringify(sanitizeFinalOutputValue(parsed)),
      redacted: true,
    };
  }
  return { text: rawText, redacted: false };
}

export function buildZukanBenchFinalOutputRecord(input: {
  fixture: ZukanBenchFixture;
  rawText?: string | null;
  responseField?: string | null;
  finishReason?: string | null;
  latencyMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  usageReported: boolean;
  httpStatus?: number | null;
  contentType?: string | null;
  providerResultMeta?: ZukanBenchProviderResultMeta | null;
  model: string;
  provider: string;
  config: ZukanBenchRequestConfig;
  datasetSha256: string;
  promptSha256: string;
  transmittedImages?: ReadonlyArray<Pick<ZukanBenchTransmittedImage, "sha256" | "bytes" | "mimeType">>;
}): ZukanBenchFinalOutputRecord {
  const persisted = persistedFinalContent(input.rawText, input.responseField);
  const parsedSource = persisted.text === null ? null : parseJsonObject(input.rawText ?? "");
  const parsed = parsedSource && sanitizeFinalOutputValue(parsedSource) as Record<string, unknown>;
  const otherFinalOutputFields = parsed
    ? Object.fromEntries(Object.entries(parsed).filter(([key]) => !FINAL_OUTPUT_PROJECTION_KEYS.has(key)))
    : {};
  const token = (value: number | null | undefined): number | null => (
    input.usageReported && typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null
  );
  const transmittedImages = input.transmittedImages ?? input.fixture.images.map((image) => ({
    sha256: image.sha256,
    bytes: image.bytes,
    mimeType: image.mimeType,
  }));
  return {
    raw_final_content: persisted.text,
    parsed_json: parsed,
    recommended_taxon: clean(parsed?.recommended_taxon_name) || null,
    recommended_rank: clean(parsed?.recommended_rank).toLowerCase() || null,
    confidence: clean(parsed?.confidence_band).toLowerCase() || null,
    candidates: outputField(parsed, ["taxonomic_candidates", "candidate_readings", "candidates", "similar_taxa"]),
    observed_features: outputFieldProjection(parsed, ["observed_features", "diagnostic_features_observed", "diagnostic_features_seen", "visible_features"]),
    diagnostic_features: outputFieldProjection(parsed, ["diagnostic_features", "diagnostic_features_observed", "diagnostic_features_seen"]),
    missing_features: outputFieldProjection(parsed, ["missing_features", "diagnostic_features_missing", "missing_evidence"]),
    uncertain_features: outputFieldProjection(parsed, ["uncertain_features", "uncertain_evidence", "weak_points"]),
    geographic_context: outputField(parsed, ["geographic_context"]),
    context_fields: outputFieldProjection(parsed, ["seasonal_context", "area_inference", "management_action_candidates", "confirm_more"]) ?? {},
    other_final_output_fields: otherFinalOutputFields,
    finish_reason: input.finishReason ?? null,
    token_usage: { input_tokens: token(input.inputTokens), output_tokens: token(input.outputTokens) },
    latency_ms: input.latencyMs ?? null,
    model: input.model,
    provider: input.provider,
    config: input.config,
    dataset_sha256: input.datasetSha256,
    post_sha256: input.fixture.postInputSha256,
    image_sha256: input.fixture.images.map((image) => image.sha256),
    transmitted_image_sha256: transmittedImages.map((image) => image.sha256),
    transmitted_image_bytes: transmittedImages.map((image) => image.bytes),
    transmitted_image_mime_types: transmittedImages.map((image) => image.mimeType),
    transmitted_post_sha256: sha256(transmittedImages.map((image, index) => `${index}:${image.sha256}:${image.bytes}:${image.mimeType}`).join("\n")),
    prompt_sha256: input.promptSha256,
    response_field: input.responseField ?? null,
    http_status: input.httpStatus ?? null,
    content_type: input.contentType ?? null,
    provider_result_meta: input.providerResultMeta ?? null,
    human_review: null,
    internal_reasoning_saved: false,
    raw_content_redacted: persisted.redacted,
  };
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

function compactText(value: unknown, maxLength: number): boolean {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength && !/[\r\n]/u.test(value);
}

function compactTextArray(value: unknown, maxItems: number, maxLength = 160): boolean {
  return Array.isArray(value)
    && value.length <= maxItems
    && value.every((item) => compactText(item, maxLength));
}

function compactCandidate(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const keys = Object.keys(row).sort();
  return JSON.stringify(keys) === JSON.stringify(["confidence_band", "rank", "taxon_name"])
    && compactText(row.taxon_name, 120)
    && VALID_RANKS.has(clean(row.rank).toLowerCase())
    && VALID_CONFIDENCE.has(clean(row.confidence_band).toLowerCase());
}

function compactOutputContractValid(parsed: BenchResponse): boolean {
  const expectedKeys = [
    "confidence_band",
    "diagnostic_features_missing",
    "diagnostic_features_observed",
    "geographic_context",
    "recommended_rank",
    "recommended_taxon_name",
    "taxonomic_candidates",
    "uncertain_features",
  ];
  return JSON.stringify(Object.keys(parsed).sort()) === JSON.stringify(expectedKeys)
    && compactText(parsed.recommended_taxon_name, 120)
    && Array.isArray(parsed.taxonomic_candidates)
    && parsed.taxonomic_candidates.length <= 4
    && parsed.taxonomic_candidates.every(compactCandidate)
    && compactTextArray(parsed.diagnostic_features_observed, 8)
    && compactTextArray(parsed.diagnostic_features_missing, 8)
    && compactTextArray(parsed.uncertain_features, 6)
    && compactText(parsed.geographic_context, 160);
}

export function scoreZukanBenchResponse(
  fixture: ZukanBenchFixture,
  rawText: string,
  outputContract: ZukanBenchOutputContractVersion = "legacy-v1",
): ZukanBenchFixtureScore {
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
  const schemaValid = Boolean(
    recommended
    && VALID_RANKS.has(rank)
    && VALID_CONFIDENCE.has(confidence)
    && (outputContract === "legacy-v1" || compactOutputContractValid(parsed)),
  );
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
  if (!schemaValid) criticalFailures.push(outputContract === "compact-v2" ? "output_contract_invalid" : "schema_invalid");
  return {
    fixtureId: fixture.fixtureId,
    visitId: fixture.visitId,
    imageCount: fixture.images.length,
    schemaValid,
    taxonScore,
    criticalFailures: [...new Set(criticalFailures)],
    recommendedTaxonName: recommended,
    recommendedRank: rank,
    confidenceBand: confidence,
    geographicContext: geography,
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

export function benchmarkThinkingLevel(
  model: string,
  requested?: "minimal" | "low" | "medium" | "high",
): "minimal" | "low" | "medium" | "high" {
  if (requested) return requested;
  return model === "gemini-3.7-flash" ? "low" : "minimal";
}

function modelProvider(model: string): string {
  const separator = model.indexOf(":");
  if (separator > 0) return model.slice(0, separator);
  if (model.startsWith("gemini-")) return "gemini";
  if (model.startsWith("deepseek-")) return "deepseek";
  if (model.startsWith("@cf/")) return "cloudflare-workers-ai";
  if (model === CLOUDFLARE_OPENAI_GPT_5_6_LUNA_MODEL) return "cloudflare-openai";
  return "unknown";
}

function assertExternalProcessingAllowed(manifest: ZukanBenchManifest): void {
  if (!manifest.externalProcessingVettedAt || manifest.fixtures.some((fixture) => fixture.externalExportAllowed !== true || fixture.withdrawalStatus !== "active")) {
    throw new Error("zukan_bench_rights_vetted_manifest_required");
  }
  if (process.env.ZUKAN_MODEL_BENCH_ALLOW_EXTERNAL_IMAGE_PROCESSING !== "1") {
    throw new Error("zukan_bench_external_provider_not_acknowledged");
  }
}

async function assertCanonicalObservationDataRights(
  fixtures: ZukanBenchFixture[],
  snapshot?: ReadonlyMap<string, ZukanBenchCanonicalRightsSnapshot>,
): Promise<void> {
  const blockers: string[] = [];
  for (const fixture of fixtures) {
    const rights = snapshot === undefined
      ? await getObservationDataRights(fixture.visitId)
      : snapshot.get(fixture.visitId) ?? null;
    if (!rights) {
      blockers.push(`${fixture.visitId}:missing`);
      continue;
    }
    if (rights.externalExportAllowed !== true) blockers.push(`${fixture.visitId}:external_export_not_allowed`);
    if (rights.withdrawalStatus !== "active") blockers.push(`${fixture.visitId}:withdrawal_${rights.withdrawalStatus}`);
    if (rights.recordConsent !== "external_export") blockers.push(`${fixture.visitId}:record_consent_${rights.recordConsent}`);
    if (rights.researchUseConsent !== "public_export") blockers.push(`${fixture.visitId}:research_consent_${rights.researchUseConsent}`);
    if (rights.datasetLicense !== "CC-BY-4.0") blockers.push(`${fixture.visitId}:dataset_license_${rights.datasetLicense ?? "missing"}`);
    if (rights.mediaLicense !== "CC-BY-NC-4.0") blockers.push(`${fixture.visitId}:media_license_${rights.mediaLicense ?? "missing"}`);
  }
  if (blockers.length > 0) throw new Error(`zukan_bench_canonical_rights_not_ready:${blockers.join(",")}`);
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

export type CloudflareOfficialRestPart =
  | { type: "image_url"; image_url: { url: string } }
  | { type: "text"; text: string };

export class CloudflareAiProviderError extends Error {
  constructor(message: string, public readonly providerResultMeta: ZukanBenchProviderResultMeta) {
    super(message);
    this.name = "CloudflareAiProviderError";
  }
}

function objectFieldNames(value: unknown): string[] {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value as Record<string, unknown>) : [];
}

function safeProviderErrorCode(value: unknown): string | null {
  if (typeof value === "string" && /^[A-Za-z0-9_.-]{1,80}$/u.test(value)) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function providerErrorCode(root: Record<string, unknown>, envelope: Record<string, unknown>): string | null {
  const candidates = [root.error, envelope.error, root.errors, envelope.errors];
  for (const candidate of candidates) {
    const first = Array.isArray(candidate) ? candidate[0] : candidate;
    const row = asRecord(first);
    const code = safeProviderErrorCode(row.code ?? row.type ?? row.error_code);
    if (code) return code;
  }
  return null;
}

function providerErrorFields(root: Record<string, unknown>, envelope: Record<string, unknown>): string[] {
  return [
    root.error !== undefined ? "error" : null,
    root.errors !== undefined ? "errors" : null,
    envelope.error !== undefined ? "result.error" : null,
    envelope.errors !== undefined ? "result.errors" : null,
  ].filter((value): value is string => Boolean(value));
}

function providerResultMeta(input: {
  httpStatus: number | null;
  contentType: string | null;
  responseShape: ZukanBenchProviderResultMeta["response_shape"];
  root: Record<string, unknown>;
  envelope?: Record<string, unknown>;
  responseFields?: string[];
  finishReason?: string | null;
  status?: string | null;
}): ZukanBenchProviderResultMeta {
  const envelope = input.envelope ?? {};
  const usage = asRecord(envelope.usage ?? input.root.usage);
  return {
    http_status: input.httpStatus,
    content_type: input.contentType,
    response_shape: input.responseShape,
    root_fields: objectFieldNames(input.root),
    envelope_fields: objectFieldNames(input.envelope),
    response_fields: input.responseFields ?? [],
    usage_fields: objectFieldNames(usage),
    finish_reason: input.finishReason ?? null,
    status: input.status ?? (typeof input.root.status === "string" ? input.root.status : null),
    provider_error_fields: providerErrorFields(input.root, envelope),
    provider_error_code: providerErrorCode(input.root, envelope),
    model: typeof (envelope.model ?? input.root.model) === "string" ? String(envelope.model ?? input.root.model) : null,
  };
}

export function buildCloudflareOfficialRestPayload(parts: CloudflareOfficialRestPart[]) {
  return {
    messages: [{ role: "user", content: parts }],
    temperature: 0,
    max_completion_tokens: 8192,
    reasoning_effort: "low",
    stream: false,
    response_format: { type: "json_object" },
  } as const;
}

export function buildCloudflareAiChatPayload(
  model: string,
  parts: CloudflareOfficialRestPart[],
  maxCompletionTokens = 8192,
  responseSchema: unknown = ZUKAN_BENCH_MODEL_RESPONSE_JSON_SCHEMA,
  schemaName = "zukan-model-bench-parser-v1",
) {
  const thirdPartyStructuredModel = model === CLOUDFLARE_GOOGLE_GEMINI_3_7_FLASH_MODEL
    || model === CLOUDFLARE_XAI_GROK_4_6_MODEL
    || model === XAI_GROK_4_6_MODEL;
  const payload: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: parts }],
    temperature: 0,
    max_completion_tokens: maxCompletionTokens,
    stream: false,
    response_format: {
      type: "json_schema",
      json_schema: thirdPartyStructuredModel
        ? {
          name: schemaName,
          strict: false,
          schema: responseSchema,
        }
        : responseSchema,
    },
  };
  if (
    model === CLOUDFLARE_QWEN_3_8_27B_MODEL
    || model === CLOUDFLARE_GOOGLE_GEMINI_3_7_FLASH_MODEL
    || model === CLOUDFLARE_XAI_GROK_4_6_MODEL
    || model === XAI_GROK_4_6_MODEL
  ) payload.reasoning_effort = "low";
  return payload;
}

export function buildCloudflareResponsesPayload(
  model: string,
  parts: CloudflareOfficialRestPart[],
  maxOutputTokens = 8192,
  responseSchema: unknown = ZUKAN_BENCH_MODEL_RESPONSE_JSON_SCHEMA,
  schemaName = "zukan-model-bench-parser-v1",
) {
  return {
    model,
    input: [{
      role: "user",
      content: parts.map((part) => part.type === "image_url"
        ? { type: "input_image", image_url: part.image_url.url }
        : { type: "input_text", text: part.text }),
    }],
    reasoning: { effort: "low" },
    max_output_tokens: maxOutputTokens,
    stream: false,
    store: false,
    text: {
      format: {
        type: "json_schema",
        name: schemaName,
        // The shared benchmark schema deliberately allows optional final-output
        // fields for later review. Cloudflare's Responses adapter rejects that
        // schema when strict Structured Outputs are requested, so keep the
        // provider-native JSON-schema hint while letting the local validator
        // enforce the required benchmark keys.
        strict: false,
        schema: responseSchema,
      },
    },
  } as const;
}

export function buildCloudflareAiRunPayload(
  model: string,
  parts: CloudflareOfficialRestPart[],
  maxOutputTokens = 8192,
  responseSchema: unknown = ZUKAN_BENCH_MODEL_RESPONSE_JSON_SCHEMA,
  schemaName = "zukan-model-bench-parser-v1",
) {
  return {
    model,
    input: {
      input: [{
        role: "user",
        content: parts.map((part) => part.type === "image_url"
          ? { type: "input_image", image_url: part.image_url.url }
          : { type: "input_text", text: part.text }),
      }],
      reasoning: { effort: "low" },
      max_output_tokens: maxOutputTokens,
      stream: false,
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: false,
          schema: responseSchema,
        },
      },
    },
  } as const;
}

export function buildCloudflareAiRequestHeaders(
  env: NodeJS.ProcessEnv = process.env,
  requireExistingGateway = false,
): Record<string, string> {
  const gatewayId = typeof env.CLOUDFLARE_AI_GATEWAY_ID === "string"
    ? env.CLOUDFLARE_AI_GATEWAY_ID.trim()
    : "";
  if (gatewayId === "default" && env.ZUKAN_MODEL_BENCH_VERIFIED_DEFAULT_GATEWAY !== "1") {
    throw new Error("cloudflare_ai_gateway_default_unverified");
  }
  if (gatewayId.length > 64 || /[\r\n]/u.test(gatewayId)) {
    throw new Error("cloudflare_ai_gateway_id_invalid");
  }
  if (requireExistingGateway && !gatewayId) {
    throw new Error("zukan_bench_cloudflare_existing_gateway_required");
  }
  return gatewayId ? { "cf-aig-gateway-id": gatewayId } : {};
}

export function cloudflareGoogleAiStudioBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const accountId = clean(env.CLOUDFLARE_ACCOUNT_ID);
  const gatewayId = clean(env.CLOUDFLARE_AI_GATEWAY_ID);
  if (!/^[a-f0-9]{32}$/u.test(accountId)) throw new Error("zukan_bench_cloudflare_account_id_invalid");
  buildCloudflareAiRequestHeaders(env, true);
  return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/google-ai-studio`;
}

export function cloudflareXaiBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const accountId = clean(env.CLOUDFLARE_ACCOUNT_ID);
  const gatewayId = clean(env.CLOUDFLARE_AI_GATEWAY_ID);
  if (!/^[a-f0-9]{32}$/u.test(accountId)) throw new Error("zukan_bench_cloudflare_account_id_invalid");
  buildCloudflareAiRequestHeaders(env, true);
  return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/grok`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function optionalFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function responseContentText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((part) => responseContentText(part)).join("");
  if (!value || typeof value !== "object") return "";
  const row = asRecord(value);
  if (typeof row.text === "string") return row.text;
  if (typeof row.output_text === "string") return row.output_text;
  if (row.content !== undefined) return responseContentText(row.content);
  return "";
}

function parseCloudflareOfficialRestResponse(payload: unknown): {
  text: string;
  responseField: string;
  finishReason: string | null;
  inputTokens: number;
  outputTokens: number;
  usageReported: boolean;
} {
  const root = asRecord(payload);
  const resultValue = root.result;
  const result = asRecord(resultValue);
  const resultChoices = Array.isArray(result.choices) ? result.choices : [];
  const rootChoices = Array.isArray(root.choices) ? root.choices : [];
  const candidates: Array<{ field: string; value: unknown }> = [];
  for (const source of [
    { prefix: "result.choices[0]", choice: resultChoices[0] },
    { prefix: "choices[0]", choice: rootChoices[0] },
  ]) {
    const choice = asRecord(source.choice);
    const message = asRecord(choice.message);
    candidates.push(
      { field: `${source.prefix}.message.content`, value: message.content },
      { field: `${source.prefix}.message.reasoning_content`, value: message.reasoning_content },
      { field: `${source.prefix}.text`, value: choice.text },
    );
  }
  candidates.push(
    { field: "result.response", value: result.response },
    { field: "response", value: root.response },
    { field: "result", value: resultValue },
  );
  const selected = candidates.map((candidate) => ({ ...candidate, text: responseContentText(candidate.value) }))
    .find((candidate) => candidate.text.length > 0);
  const usage = asRecord(result.usage ?? root.usage);
  const inputTokens = optionalFiniteNumber(usage.prompt_tokens ?? usage.input_tokens);
  const outputTokens = optionalFiniteNumber(usage.completion_tokens ?? usage.output_tokens);
  if (!selected) throw new Error("cloudflare_official_rest_empty_response");
  const selectedChoice = asRecord(resultChoices[0] ?? rootChoices[0]);
  const finishReasonValue = selectedChoice.finish_reason ?? result.finish_reason ?? root.finish_reason;
  return {
    text: selected.text,
    responseField: selected.field,
    finishReason: typeof finishReasonValue === "string" ? finishReasonValue : null,
    inputTokens: inputTokens ?? 0,
    outputTokens: outputTokens ?? 0,
    usageReported: inputTokens !== null && outputTokens !== null,
  };
}

type CloudflareAiGenerationResult = {
  text: string;
  responseField: string;
  finishReason: string | null;
  inputTokens: number;
  outputTokens: number;
  usageReported: boolean;
  providerResultMeta: ZukanBenchProviderResultMeta;
};

export async function generateWithCloudflareGoogleAiStudio(options: {
  model: string;
  parts: AiRouterPart[];
  maxOutputTokens?: number;
  mediaResolution?: "low" | "medium" | "high";
  responseJsonSchema?: unknown;
  env?: NodeJS.ProcessEnv;
}): Promise<CloudflareAiGenerationResult> {
  const env = options.env ?? process.env;
  const apiKey = clean(env.GEMINI_API_KEY);
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const gatewayToken = clean(env.CLOUDFLARE_AI_GATEWAY_TOKEN);
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      baseUrl: cloudflareGoogleAiStudioBaseUrl(env),
      ...(gatewayToken ? { headers: { "cf-aig-authorization": `Bearer ${gatewayToken}` } } : {}),
    },
  });
  const response = await ai.models.generateContent({
    model: options.model,
    contents: [{ role: "user", parts: options.parts }],
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      temperature: 0,
      maxOutputTokens: options.maxOutputTokens ?? 8192,
      mediaResolution: googleMediaResolution(options.mediaResolution),
      responseMimeType: "application/json",
      responseJsonSchema: options.responseJsonSchema ?? ZUKAN_BENCH_MODEL_RESPONSE_JSON_SCHEMA,
    },
  });
  const usage = (response as {
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      thoughtsTokenCount?: number;
    };
  }).usageMetadata;
  const inputTokens = optionalFiniteNumber(usage?.promptTokenCount) ?? 0;
  const candidateTokens = optionalFiniteNumber(usage?.candidatesTokenCount) ?? 0;
  const thoughtsTokens = optionalFiniteNumber(usage?.thoughtsTokenCount) ?? 0;
  const outputTokens = candidateTokens + thoughtsTokens;
  const text = googleResponseText(response);
  const finishReasonValue = response.candidates?.[0]?.finishReason;
  const finishReason = typeof finishReasonValue === "string"
    ? finishReasonValue
    : finishReasonValue ? String(finishReasonValue) : null;
  const root = asRecord(response);
  const meta = providerResultMeta({
    httpStatus: null,
    contentType: "application/json",
    responseShape: "unknown",
    root,
    responseFields: text ? ["candidates[0].content.parts"] : [],
    finishReason,
    status: finishReason,
  });
  if (!text.trim()) throw new CloudflareAiProviderError("cloudflare_google_ai_studio_empty_response", meta);
  return {
    text,
    responseField: "candidates[0].content.parts",
    finishReason,
    inputTokens,
    outputTokens,
    usageReported: usage?.promptTokenCount !== undefined && usage?.candidatesTokenCount !== undefined,
    providerResultMeta: meta,
  };
}

export async function generateWithCloudflareXai(options: {
  model: string;
  parts: CloudflareOfficialRestPart[];
  maxCompletionTokens?: number;
  responseJsonSchema?: unknown;
  schemaName?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}): Promise<CloudflareAiGenerationResult> {
  const env = options.env ?? process.env;
  const gatewayToken = clean(env.CLOUDFLARE_AI_GATEWAY_TOKEN);
  if (!gatewayToken) throw new Error("zukan_bench_cloudflare_gateway_token_missing");
  const providerKey = clean(env.XAI_API_KEY);
  const endpoint = `${cloudflareXaiBaseUrl(env)}/v1/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 180_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "cf-aig-authorization": `Bearer ${gatewayToken}`,
        ...(providerKey ? { authorization: `Bearer ${providerKey}` } : {}),
      },
      body: JSON.stringify(buildCloudflareAiChatPayload(
        options.model,
        options.parts,
        options.maxCompletionTokens ?? 8192,
        options.responseJsonSchema,
        options.schemaName,
      )),
      signal: controller.signal,
    });
    const contentType = clean(response.headers.get("content-type") ?? "").split(";", 1)[0] || null;
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      const meta = providerResultMeta({
        httpStatus: response.status,
        contentType,
        responseShape: response.ok ? "unknown" : "error",
        root: {},
      });
      throw new CloudflareAiProviderError("cloudflare_xai_invalid_json_response", meta);
    }
    if (!response.ok) {
      const root = asRecord(body);
      const meta = providerResultMeta({
        httpStatus: response.status,
        contentType,
        responseShape: "error",
        root,
        envelope: asRecord(root.result),
      });
      throw new CloudflareAiProviderError(
        `cloudflare_xai_request_failed:${response.status}:${meta.provider_error_code ?? "unknown"}`,
        meta,
      );
    }
    return parseCloudflareAiChatResponse(body, response.status, contentType);
  } finally {
    clearTimeout(timer);
  }
}

function cloudflareResponseContentCandidates(root: Record<string, unknown>, envelope: Record<string, unknown>): Array<{ field: string; value: unknown }> {
  const candidates: Array<{ field: string; value: unknown }> = [];
  for (const source of [
    { prefix: "result.choices[0]", choice: Array.isArray(envelope.choices) ? envelope.choices[0] : undefined },
    { prefix: "choices[0]", choice: Array.isArray(root.choices) ? root.choices[0] : undefined },
  ]) {
    const choice = asRecord(source.choice);
    const message = asRecord(choice.message);
    candidates.push(
      { field: `${source.prefix}.message.content`, value: message.content },
      { field: `${source.prefix}.message.reasoning_content`, value: message.reasoning_content },
      { field: `${source.prefix}.text`, value: choice.text },
    );
  }
  candidates.push(
    { field: "result.response", value: envelope.response },
    { field: "response", value: root.response },
  );
  return candidates;
}

function parseCloudflareAiChatResponse(payload: unknown, httpStatus: number, contentType: string | null): CloudflareAiGenerationResult {
  const root = asRecord(payload);
  const envelope = asRecord(root.result);
  const candidates = cloudflareResponseContentCandidates(root, envelope);
  const selected = candidates
    .map((candidate) => ({ ...candidate, text: responseContentText(candidate.value) }))
    .find((candidate) => candidate.text.length > 0);
  const choice = asRecord((Array.isArray(envelope.choices) ? envelope.choices[0] : undefined)
    ?? (Array.isArray(root.choices) ? root.choices[0] : undefined));
  const usage = asRecord(envelope.usage ?? root.usage);
  const inputTokens = optionalFiniteNumber(usage.prompt_tokens ?? usage.input_tokens);
  const outputTokens = optionalFiniteNumber(usage.completion_tokens ?? usage.output_tokens);
  const finishReasonValue = choice.finish_reason ?? envelope.finish_reason ?? root.finish_reason;
  const finishReason = typeof finishReasonValue === "string" ? finishReasonValue : null;
  const responseFields = candidates.filter((candidate) => candidate.value !== undefined).map((candidate) => candidate.field);
  const meta = providerResultMeta({
    httpStatus,
    contentType,
    responseShape: "chat_completions",
    root,
    envelope,
    responseFields,
    finishReason,
  });
  if (!selected) throw new CloudflareAiProviderError("cloudflare_ai_empty_response", meta);
  return {
    text: selected.text,
    responseField: selected.field,
    finishReason,
    inputTokens: inputTokens ?? 0,
    outputTokens: outputTokens ?? 0,
    usageReported: inputTokens !== null && outputTokens !== null,
    providerResultMeta: meta,
  };
}

function parseCloudflareResponsesResponse(payload: unknown, httpStatus: number, contentType: string | null): CloudflareAiGenerationResult {
  const root = asRecord(payload);
  const envelope = asRecord(root.result);
  const output = Array.isArray(envelope.output) ? envelope.output : Array.isArray(root.output) ? root.output : [];
  const responseFields: string[] = [];
  let text = "";
  let responseField = "";
  for (const [outputIndex, itemValue] of output.entries()) {
    const item = asRecord(itemValue);
    const content = Array.isArray(item.content) ? item.content : [];
    for (const [contentIndex, contentValue] of content.entries()) {
      const contentItem = asRecord(contentValue);
      if (contentItem.type === "output_text" && typeof contentItem.text === "string") {
        responseFields.push(`output[${outputIndex}].content[${contentIndex}].text`);
        text += contentItem.text;
        if (!responseField) responseField = `output[${outputIndex}].content[${contentIndex}].text`;
      }
    }
  }
  if (!text && typeof envelope.output_text === "string") {
    text = envelope.output_text;
    responseField = "result.output_text";
    responseFields.push(responseField);
  }
  if (!text && typeof root.output_text === "string") {
    text = root.output_text;
    responseField = "output_text";
    responseFields.push(responseField);
  }
  const usage = asRecord(envelope.usage ?? root.usage);
  const inputTokens = optionalFiniteNumber(usage.input_tokens ?? usage.prompt_tokens);
  const outputTokens = optionalFiniteNumber(usage.output_tokens ?? usage.completion_tokens);
  const incompleteDetails = asRecord(envelope.incomplete_details ?? root.incomplete_details);
  const statusValue = envelope.status ?? root.status;
  const status = typeof statusValue === "string" ? statusValue : null;
  const finishReasonValue = incompleteDetails.reason ?? envelope.finish_reason ?? root.finish_reason;
  const finishReason = typeof finishReasonValue === "string" ? finishReasonValue : null;
  const meta = providerResultMeta({
    httpStatus,
    contentType,
    responseShape: "responses",
    root,
    envelope,
    responseFields,
    finishReason,
    status,
  });
  if (!text) throw new CloudflareAiProviderError("cloudflare_ai_empty_response", meta);
  return {
    text,
    responseField,
    finishReason,
    inputTokens: inputTokens ?? 0,
    outputTokens: outputTokens ?? 0,
    usageReported: inputTokens !== null && outputTokens !== null,
    providerResultMeta: meta,
  };
}

async function fetchCloudflareAiJson(options: {
  model: string;
  payload: unknown;
  responsesApi: boolean;
  universalRun?: boolean;
  requireExistingGateway?: boolean;
  timeoutMs?: number;
}): Promise<CloudflareAiGenerationResult> {
  const accountId = clean(process.env.CLOUDFLARE_ACCOUNT_ID);
  const token = clean(process.env.CLOUDFLARE_API_TOKEN ?? process.env.CLOUDFLARE_AUTH_TOKEN);
  if (!accountId || !token) throw new Error("zukan_bench_cloudflare_credentials_missing");
  const endpoint = options.universalRun
    ? `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run`
    : `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/${options.responsesApi ? "responses" : "chat/completions"}`;
  const timeoutMs = options.timeoutMs ?? 180_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          ...buildCloudflareAiRequestHeaders(process.env, options.requireExistingGateway ?? false),
        },
        body: JSON.stringify(options.payload),
        signal: controller.signal,
      });
    } catch {
      throw new Error("cloudflare_ai_transport_error");
    }
    const contentType = clean(response.headers.get("content-type") ?? "").split(";", 1)[0] || null;
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      const meta = providerResultMeta({
        httpStatus: response.status,
        contentType,
        responseShape: response.ok ? "unknown" : "error",
        root: {},
      });
      throw new CloudflareAiProviderError("cloudflare_ai_invalid_json_response", meta);
    }
    const root = asRecord(body);
    const envelope = asRecord(root.result);
    if (!response.ok) {
      const meta = providerResultMeta({
        httpStatus: response.status,
        contentType,
        responseShape: "error",
        root,
        envelope,
      });
      const code = meta.provider_error_code ?? "unknown";
      throw new CloudflareAiProviderError(`cloudflare_ai_request_failed:${response.status}:${code}`, meta);
    }
    return options.responsesApi
      ? parseCloudflareResponsesResponse(body, response.status, contentType)
      : parseCloudflareAiChatResponse(body, response.status, contentType);
  } finally {
    clearTimeout(timer);
  }
}

export async function generateWithCloudflareAiRest(options: {
  model: string;
  parts: CloudflareOfficialRestPart[];
  maxCompletionTokens?: number;
  responseJsonSchema?: unknown;
  schemaName?: string;
  requireExistingGateway?: boolean;
  timeoutMs?: number;
}): Promise<CloudflareAiGenerationResult> {
  const maxTokens = options.maxCompletionTokens ?? 8192;
  if (
    options.model.startsWith("@cf/")
    || options.model === CLOUDFLARE_GOOGLE_GEMINI_3_7_FLASH_MODEL
    || options.model === CLOUDFLARE_XAI_GROK_4_6_MODEL
  ) {
    return fetchCloudflareAiJson({
      model: options.model,
      payload: buildCloudflareAiChatPayload(options.model, options.parts, maxTokens, options.responseJsonSchema, options.schemaName),
      responsesApi: false,
      requireExistingGateway: options.requireExistingGateway,
      timeoutMs: options.timeoutMs,
    });
  }
  if (options.model === CLOUDFLARE_OPENAI_GPT_5_6_LUNA_MODEL) {
    return fetchCloudflareAiJson({
      model: options.model,
      payload: buildCloudflareResponsesPayload(options.model, options.parts, maxTokens, options.responseJsonSchema, options.schemaName),
      responsesApi: true,
      requireExistingGateway: options.requireExistingGateway,
      timeoutMs: options.timeoutMs,
    });
  }
  throw new Error("cloudflare_ai_model_invalid");
}

export async function generateWithCloudflareAiRun(options: {
  model: string;
  parts: CloudflareOfficialRestPart[];
  maxOutputTokens?: number;
  responseJsonSchema?: unknown;
  schemaName?: string;
  requireExistingGateway?: boolean;
  timeoutMs?: number;
}): Promise<CloudflareAiGenerationResult> {
  if (options.model !== CLOUDFLARE_OPENAI_GPT_5_6_LUNA_MODEL) throw new Error("cloudflare_ai_run_model_invalid");
  return fetchCloudflareAiJson({
    model: options.model,
    payload: buildCloudflareAiRunPayload(
      options.model,
      options.parts,
      options.maxOutputTokens ?? 8192,
      options.responseJsonSchema,
      options.schemaName,
    ),
    responsesApi: true,
    universalRun: true,
    requireExistingGateway: options.requireExistingGateway,
    timeoutMs: options.timeoutMs,
  });
}

export async function generateWithCloudflareOfficialRest(options: {
  model: string;
  parts: CloudflareOfficialRestPart[];
  requireExistingGateway?: boolean;
  timeoutMs?: number;
}): Promise<{ text: string; responseField?: string; finishReason?: string | null; inputTokens: number; outputTokens: number; usageReported: boolean; providerResultMeta?: ZukanBenchProviderResultMeta | null }> {
  if (!options.model.startsWith("@cf/")) throw new Error("cloudflare_official_rest_model_invalid");
  const accountId = clean(process.env.CLOUDFLARE_ACCOUNT_ID);
  const token = clean(process.env.CLOUDFLARE_API_TOKEN ?? process.env.CLOUDFLARE_AUTH_TOKEN);
  if (!accountId || !token) throw new Error("zukan_bench_cloudflare_credentials_missing");
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${options.model}`;
  const timeoutMs = options.timeoutMs ?? 180_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...buildCloudflareAiRequestHeaders(process.env, options.requireExistingGateway ?? false),
      },
      body: JSON.stringify(buildCloudflareOfficialRestPayload(options.parts)),
      signal: controller.signal,
    });
    if (!response.ok) {
      const errorBody = (await response.text()).slice(0, 1_000);
      throw new Error(`cloudflare_official_rest_failed:${response.status}:${errorBody}`);
    }
    return parseCloudflareOfficialRestResponse(await response.json());
  } finally {
    clearTimeout(timer);
  }
}

export function selectZukanBenchFixtures(
  manifest: ZukanBenchManifest,
  options: { limit?: number; fixtureVisitIds?: readonly string[] } = {},
): ZukanBenchFixture[] {
  if (options.fixtureVisitIds !== undefined) {
    if (options.fixtureVisitIds.length === 0) throw new Error("zukan_bench_fixture_visit_ids_empty");
    const requested = [...options.fixtureVisitIds];
    if (new Set(requested).size !== requested.length) throw new Error("zukan_bench_fixture_visit_ids_duplicate");
    const byVisitId = new Map(manifest.fixtures.map((fixture) => [fixture.visitId, fixture]));
    const missing = requested.filter((visitId) => !byVisitId.has(visitId));
    if (missing.length > 0) throw new Error(`zukan_bench_fixture_visit_id_missing:${missing.join(",")}`);
    return requested.map((visitId) => byVisitId.get(visitId)!);
  }
  return typeof options.limit === "number" && options.limit > 0
    ? manifest.fixtures.slice(0, Math.floor(options.limit))
    : manifest.fixtures;
}

export async function runZukanModelBench(options: {
  model: string;
  manifestPath?: string;
  reportDir?: string;
  pricing?: BenchPricing | null;
  limit?: number;
  maxEstimatedCostUsd?: number;
  transport?: "model-router" | "cloudflare-official-rest" | "cloudflare-ai-rest" | "cloudflare-ai-run" | "cloudflare-google-native" | "cloudflare-xai-native";
  maxOutputTokens?: number;
  temperature?: number;
  thinkingLevel?: "minimal" | "low" | "medium" | "high";
  mediaResolution?: "low" | "medium" | "high";
  imageMaxEdge?: number;
  imageFetchOrigin?: string;
  promptSource?: string;
  promptVersion?: string;
  outputContract?: ZukanBenchOutputContractVersion;
  concurrency?: number;
  completedCanaryReport?: ZukanBenchModelReport;
  canaryReportPath?: string;
  reportLabel?: string;
  fixtureVisitIds?: readonly string[];
  requireFixedOwnerSmoke?: boolean;
  requireCanarySuccess?: boolean;
  canonicalRightsSnapshot?: ReadonlyMap<string, ZukanBenchCanonicalRightsSnapshot>;
}): Promise<ZukanBenchModelReport> {
  const manifestPath = options.manifestPath ?? defaultRightsManifestPath(DEFAULT_ZUKAN_BENCH_MANIFEST);
  const reportDir = options.reportDir ?? DEFAULT_ZUKAN_BENCH_REPORT_DIR;
  const manifest = await loadZukanBenchManifest(manifestPath);
  assertExternalProcessingAllowed(manifest);
  const transport = options.transport ?? "model-router";
  if (options.requireFixedOwnerSmoke && (
    manifest.fixtures.length !== ZUKAN_BENCH_SMOKE_POST_COUNT
    || manifest.postCount !== ZUKAN_BENCH_SMOKE_POST_COUNT
    || manifest.imageCount !== 24
    || manifest.datasetSha256 !== ZUKAN_OWNER_BENCH_SMOKE_DATASET_SHA256
    || manifest.promptSha256 !== ZUKAN_OWNER_BENCH_SMOKE_PROMPT_SHA256
  )) {
    throw new Error("zukan_bench_fixed_owner_smoke_manifest_mismatch");
  }
  if (transport === "model-router") configureModelProvider(options.model);
  const prompt = await loadZukanBenchPrompt(manifest, options.promptSource);
  const promptTemplate = prompt.text;
  const fixtures = selectZukanBenchFixtures(manifest, options);
  const outputContract = options.outputContract ?? "legacy-v1";
  const responseSchema = zukanBenchResponseSchema(outputContract);
  const schemaName: ZukanBenchRequestConfig["output_schema"] = outputContract === "compact-v2"
    ? "zukan-model-bench-compact-v2"
    : "zukan-model-bench-parser-v1";
  const outputSchemaSha256 = zukanBenchOutputSchemaSha256(outputContract);
  const concurrency = options.concurrency ?? 1;
  if (options.imageFetchOrigin && fixtures[0]?.images[0]?.url) {
    resolveZukanBenchImageFetchUrl(fixtures[0].images[0].url, options.imageFetchOrigin);
  }
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
    throw new Error(`zukan_bench_concurrency_invalid:${concurrency}`);
  }
  if (concurrency > 1) {
    if (options.requireCanarySuccess !== false) throw new Error("zukan_bench_parallel_requires_completed_canary");
    assertZukanBenchParallelCanary({
      canary: options.completedCanaryReport,
      model: options.model,
      datasetSha256: manifest.datasetSha256,
      promptSha256: prompt.sha256,
      outputContract,
      outputSchemaSha256,
      fixtureCount: fixtures.length,
      maxEstimatedCostUsd: options.maxEstimatedCostUsd,
    });
  }
  if (options.requireFixedOwnerSmoke && (
    fixtures.length !== ZUKAN_BENCH_SMOKE_POST_COUNT
    || fixtures.reduce((sum, fixture) => sum + fixture.images.length, 0) !== 24
  )) {
    throw new Error("zukan_bench_fixed_owner_smoke_target_mismatch");
  }
  await assertCanonicalObservationDataRights(fixtures, options.canonicalRightsSnapshot);
  if (transport === "cloudflare-google-native") {
    cloudflareGoogleAiStudioBaseUrl(process.env);
  } else if (transport === "cloudflare-xai-native") {
    cloudflareXaiBaseUrl(process.env);
    if (!clean(process.env.CLOUDFLARE_AI_GATEWAY_TOKEN)) {
      throw new Error("zukan_bench_cloudflare_gateway_token_missing");
    }
  } else if (transport === "cloudflare-official-rest" || transport === "cloudflare-ai-rest" || transport === "cloudflare-ai-run") {
    buildCloudflareAiRequestHeaders(process.env, true);
  }
  const provider = transport === "cloudflare-google-native"
    ? "cloudflare-google-ai-studio"
    : transport === "cloudflare-xai-native"
      ? "cloudflare-xai"
    : transport === "cloudflare-official-rest"
    ? "cloudflare-workers-ai"
    : transport === "cloudflare-ai-rest" || transport === "cloudflare-ai-run"
      ? options.model.startsWith("@cf/")
        ? "cloudflare-workers-ai"
        : options.model === CLOUDFLARE_GOOGLE_GEMINI_3_7_FLASH_MODEL
          ? "cloudflare-google-ai-studio"
          : options.model === CLOUDFLARE_XAI_GROK_4_6_MODEL
            ? "cloudflare-xai"
            : "cloudflare-ai-openai"
      : modelProvider(options.model);
  const requestConfig: ZukanBenchRequestConfig = transport === "cloudflare-google-native"
    ? {
      transport,
      temperature: 0,
      max_output_tokens: options.maxOutputTokens ?? 8192,
      thinking_level: "low",
      ...(options.mediaResolution ? { media_resolution: options.mediaResolution } : {}),
      ...(options.imageMaxEdge !== undefined ? { image_max_edge: options.imageMaxEdge } : {}),
      ...(options.imageFetchOrigin ? { image_fetch_origin: options.imageFetchOrigin } : {}),
      stream: false,
      modalities: "omitted",
      response_mime_type: "application/json",
      response_schema_mode: "provider-native",
      output_schema: schemaName,
      output_schema_sha256: outputSchemaSha256,
      execution_concurrency: concurrency,
      ...(options.canaryReportPath ? { canary_gate_report: options.canaryReportPath } : {}),
      gateway_selection: "explicit-existing-named-gateway-only",
      attempts_per_model: 1,
      fallback_count: 0,
    }
    : transport === "cloudflare-xai-native"
      ? {
        transport,
        temperature: 0,
        max_completion_tokens: options.maxOutputTokens ?? 8192,
        reasoning_effort: "low",
        ...(options.imageMaxEdge !== undefined ? { image_max_edge: options.imageMaxEdge } : {}),
        ...(options.imageFetchOrigin ? { image_fetch_origin: options.imageFetchOrigin } : {}),
        stream: false,
        modalities: "omitted",
        response_format: {
          type: "json_schema",
          json_schema: {
            name: schemaName,
            strict: false,
            schema: responseSchema,
          },
        },
        response_schema_mode: "provider-native",
        output_schema: schemaName,
        output_schema_sha256: outputSchemaSha256,
        execution_concurrency: concurrency,
        ...(options.canaryReportPath ? { canary_gate_report: options.canaryReportPath } : {}),
        gateway_selection: "explicit-existing-named-gateway-only",
        attempts_per_model: 1,
        fallback_count: 0,
      }
    : transport === "cloudflare-official-rest"
    ? {
      transport,
      temperature: 0,
      max_completion_tokens: 8192,
      reasoning_effort: "low",
      ...(options.imageMaxEdge !== undefined ? { image_max_edge: options.imageMaxEdge } : {}),
      ...(options.imageFetchOrigin ? { image_fetch_origin: options.imageFetchOrigin } : {}),
      stream: false,
      modalities: "omitted",
      response_format: { type: "json_object" },
      output_schema: schemaName,
      output_schema_sha256: outputSchemaSha256,
      execution_concurrency: concurrency,
      ...(options.canaryReportPath ? { canary_gate_report: options.canaryReportPath } : {}),
      gateway_selection: "explicit-existing-named-gateway-only",
      attempts_per_model: 1,
      fallback_count: 0,
    }
    : transport === "cloudflare-ai-rest" || transport === "cloudflare-ai-run"
      ? {
        transport,
        temperature: 0,
        ...(options.model === CLOUDFLARE_OPENAI_GPT_5_6_LUNA_MODEL
          ? { max_output_tokens: options.maxOutputTokens ?? 8192 }
          : { max_completion_tokens: options.maxOutputTokens ?? 8192 }),
        ...(
          options.model === CLOUDFLARE_QWEN_3_8_27B_MODEL
          || options.model === CLOUDFLARE_OPENAI_GPT_5_6_LUNA_MODEL
          || options.model === CLOUDFLARE_GOOGLE_GEMINI_3_7_FLASH_MODEL
          || options.model === CLOUDFLARE_XAI_GROK_4_6_MODEL
          ? { reasoning_effort: "low" as const }
          : {}),
        stream: false,
        modalities: "omitted",
        response_format: { type: "json_schema", json_schema: responseSchema },
        response_schema_mode: "provider-native",
        ...(options.imageMaxEdge !== undefined ? { image_max_edge: options.imageMaxEdge } : {}),
        ...(options.imageFetchOrigin ? { image_fetch_origin: options.imageFetchOrigin } : {}),
        output_schema: schemaName,
        output_schema_sha256: outputSchemaSha256,
        execution_concurrency: concurrency,
        ...(options.canaryReportPath ? { canary_gate_report: options.canaryReportPath } : {}),
        gateway_selection: "explicit-existing-named-gateway-only",
        attempts_per_model: 1,
        fallback_count: 0,
      }
    : {
      transport,
      temperature: options.temperature ?? 0,
      max_output_tokens: options.maxOutputTokens ?? 1024,
      thinking_level: benchmarkThinkingLevel(options.model, options.thinkingLevel),
      ...(options.mediaResolution ? { media_resolution: options.mediaResolution } : {}),
      ...(options.imageMaxEdge !== undefined ? { image_max_edge: options.imageMaxEdge } : {}),
      ...(options.imageFetchOrigin ? { image_fetch_origin: options.imageFetchOrigin } : {}),
      stream: false,
      modalities: "omitted",
      response_mime_type: "application/json",
      response_schema_mode: modelProvider(options.model) === "gemini" ? "provider-native" : "parser-only",
      output_schema: schemaName,
      output_schema_sha256: outputSchemaSha256,
      execution_concurrency: concurrency,
      ...(options.canaryReportPath ? { canary_gate_report: options.canaryReportPath } : {}),
      attempts_per_model: 1,
      fallback_count: 0,
    };
  const previousChain = process.env[MODEL_CHAIN_ENV];
  if (transport === "model-router") process.env[MODEL_CHAIN_ENV] = options.model;
  const startedAt = new Date().toISOString();
  const fixtureScores: ZukanBenchFixtureScore[] = [];
  const latencies: number[] = [];
  let successCount = 0;
  let modelRequestCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let usageObserved = false;
  let usageComplete = true;

  try {
    const processFixture = async (fixture: ZukanBenchFixture, fixtureIndex: number): Promise<boolean> => {
      const isCanary = fixtureIndex === 0;
      const spentBeforeCall = estimatedCost(totalInputTokens, totalOutputTokens, options.pricing ?? null);
      const averageCompletedCost = spentBeforeCall !== null && fixtureScores.length > 0 ? spentBeforeCall / fixtureScores.length : 0;
      if (concurrency === 1 && spentBeforeCall !== null && options.maxEstimatedCostUsd !== undefined && spentBeforeCall + averageCompletedCost > options.maxEstimatedCostUsd) {
        throw new Error(`zukan_bench_cost_cap_preflight:${spentBeforeCall.toFixed(8)}/${options.maxEstimatedCostUsd.toFixed(8)}`);
      }
      const verified = await Promise.all(fixture.images.map(async (imageRef) => {
        const image = await fetchImage(imageRef.url, options.imageFetchOrigin);
        const actualDigest = sha256(image.bytes);
        if (actualDigest !== imageRef.sha256 || image.bytes.byteLength !== imageRef.bytes || image.mimeType !== imageRef.mimeType) {
          throw new Error(`zukan_bench_image_identity_mismatch:${fixture.fixtureId}:${imageRef.index}`);
        }
        return { ref: imageRef, bytes: image.bytes };
      }));
      const verifiedImages = verified.map((item) => item.ref);
      if (canonicalImageDigest(verifiedImages) !== fixture.postInputSha256) {
        throw new Error(`zukan_bench_post_identity_mismatch:${fixture.fixtureId}`);
      }
      const transmitted = await Promise.all(verified.map(async (item) => ({
        ref: item.ref,
        ...(await prepareZukanBenchImageForTransmission({
          buffer: item.bytes,
          mimeType: item.ref.mimeType,
          maxEdge: options.imageMaxEdge,
        })),
      })));
      const renderedPrompt = renderColdStartPrompt(promptTemplate, fixture);
      const started = Date.now();
      let canarySchemaValid = true;
      try {
        modelRequestCount += 1;
        const result = transport === "cloudflare-google-native"
          ? await generateWithCloudflareGoogleAiStudio({
            model: options.model,
            maxOutputTokens: options.maxOutputTokens ?? 8192,
            mediaResolution: options.mediaResolution,
            responseJsonSchema: responseSchema,
            parts: [
              ...transmitted.map((item): AiRouterPart => ({ inlineData: { mimeType: item.mimeType, data: item.buffer.toString("base64") } })),
              { text: renderedPrompt },
            ],
          })
          : transport === "cloudflare-xai-native"
            ? await generateWithCloudflareXai({
              model: options.model,
              maxCompletionTokens: options.maxOutputTokens ?? 8192,
              responseJsonSchema: responseSchema,
              schemaName,
              parts: [
                ...transmitted.map((item): CloudflareOfficialRestPart => ({
                  type: "image_url",
                  image_url: { url: `data:${item.mimeType};base64,${item.buffer.toString("base64")}` },
                })),
                { type: "text", text: renderedPrompt },
              ],
            })
          : transport === "cloudflare-official-rest"
          ? await generateWithCloudflareOfficialRest({
            model: options.model,
            requireExistingGateway: true,
            parts: [
              ...transmitted.map((item): CloudflareOfficialRestPart => ({
                type: "image_url",
                image_url: { url: `data:${item.mimeType};base64,${item.buffer.toString("base64")}` },
              })),
              { type: "text", text: renderedPrompt },
            ],
          })
          : transport === "cloudflare-ai-rest"
            ? await generateWithCloudflareAiRest({
              model: options.model,
              requireExistingGateway: true,
              maxCompletionTokens: options.maxOutputTokens ?? 8192,
              responseJsonSchema: responseSchema,
              schemaName,
              parts: [
                ...transmitted.map((item): CloudflareOfficialRestPart => ({
                  type: "image_url",
                  image_url: { url: `data:${item.mimeType};base64,${item.buffer.toString("base64")}` },
                })),
                { type: "text", text: renderedPrompt },
              ],
              })
            : transport === "cloudflare-ai-run"
              ? await generateWithCloudflareAiRun({
                model: options.model,
                requireExistingGateway: true,
                maxOutputTokens: options.maxOutputTokens ?? 8192,
                responseJsonSchema: responseSchema,
                schemaName,
                parts: [
                  ...transmitted.map((item): CloudflareOfficialRestPart => ({
                    type: "image_url",
                    image_url: { url: `data:${item.mimeType};base64,${item.buffer.toString("base64")}` },
                  })),
                  { type: "text", text: renderedPrompt },
                ],
              })
            : {
            ...(await generateAiTextWithRoleChain({
              chainName: "observationVisualExtract",
              parts: [
                ...transmitted.map((item): AiRouterPart => ({ inlineData: { mimeType: item.mimeType, data: item.buffer.toString("base64") } })),
                { text: renderedPrompt },
              ],
              responseMimeType: "application/json",
              thinkingConfig: { thinkingLevel: benchmarkThinkingLevel(options.model, options.thinkingLevel) },
              temperature: requestConfig.temperature,
              maxOutputTokens: requestConfig.max_output_tokens,
              mediaResolution: options.mediaResolution,
              responseJsonSchema: modelProvider(options.model) === "gemini"
                ? responseSchema
                : undefined,
              retriesPerModel: 0,
            })),
            usageReported: true,
          };
        usageObserved = true;
        usageComplete = usageComplete && result.usageReported;
        totalInputTokens += result.inputTokens;
        totalOutputTokens += result.outputTokens;
        const latencyMs = Date.now() - started;
        latencies.push(latencyMs);
        const scored = scoreZukanBenchResponse(fixture, result.text, outputContract);
        const finalContentAvailable = !result.responseField?.includes("reasoning_content");
        canarySchemaValid = scored.schemaValid && finalContentAvailable;
        const finalOutput = buildZukanBenchFinalOutputRecord({
          fixture,
          rawText: result.text,
          responseField: result.responseField ?? null,
          finishReason: result.finishReason ?? null,
          latencyMs,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          usageReported: result.usageReported,
          httpStatus: result.providerResultMeta?.http_status ?? null,
          contentType: result.providerResultMeta?.content_type ?? null,
          providerResultMeta: result.providerResultMeta ?? null,
          model: options.model,
          provider,
          config: requestConfig,
          datasetSha256: manifest.datasetSha256,
          promptSha256: prompt.sha256,
          transmittedImages: transmitted,
        });
        const finalFailures = finalContentAvailable
          ? scored.criticalFailures
          : [...scored.criticalFailures, "reasoning_only_response"];
        fixtureScores.push({
          ...scored,
          schemaValid: canarySchemaValid,
          criticalFailures: [...new Set(finalFailures)],
          responseField: result.responseField,
          finishReason: result.finishReason ?? null,
          latencyMs,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          finalOutput,
        });
        successCount += 1;
      } catch (error) {
        const latencyMs = Date.now() - started;
        latencies.push(latencyMs);
        fixtureScores.push({
          fixtureId: fixture.fixtureId,
          visitId: fixture.visitId,
          imageCount: fixture.images.length,
          schemaValid: false,
          taxonScore: fixture.gold.status === "human_consensus" ? 0 : null,
          criticalFailures: [`model_error:${error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000)}`],
          latencyMs,
          finishReason: null,
          finalOutput: buildZukanBenchFinalOutputRecord({
            fixture,
            rawText: null,
            responseField: null,
            finishReason: null,
            latencyMs,
            inputTokens: null,
            outputTokens: null,
            usageReported: false,
            providerResultMeta: error instanceof CloudflareAiProviderError ? error.providerResultMeta : null,
            httpStatus: error instanceof CloudflareAiProviderError ? error.providerResultMeta.http_status : null,
            contentType: error instanceof CloudflareAiProviderError ? error.providerResultMeta.content_type : null,
            model: options.model,
            provider,
            config: requestConfig,
            datasetSha256: manifest.datasetSha256,
            promptSha256: prompt.sha256,
            transmittedImages: transmitted,
          }),
        });
      }
      const spentAfterCall = estimatedCost(totalInputTokens, totalOutputTokens, options.pricing ?? null);
      if (concurrency === 1 && spentAfterCall !== null && options.maxEstimatedCostUsd !== undefined && spentAfterCall > options.maxEstimatedCostUsd) {
        throw new Error(`zukan_bench_cost_cap_reached:${spentAfterCall.toFixed(8)}/${options.maxEstimatedCostUsd.toFixed(8)}`);
      }
      return canarySchemaValid;
    };
    if (concurrency === 1) {
      for (const [fixtureIndex, fixture] of fixtures.entries()) {
        const schemaValid = await processFixture(fixture, fixtureIndex);
        if (options.requireCanarySuccess && fixtureIndex === 0 && !schemaValid) break;
      }
    } else {
      await mapWithConcurrency(fixtures, concurrency, processFixture);
    }
    const fixtureOrder = new Map(fixtures.map((fixture, index) => [fixture.fixtureId, index]));
    fixtureScores.sort((left, right) => (fixtureOrder.get(left.fixtureId) ?? 0) - (fixtureOrder.get(right.fixtureId) ?? 0));
  } finally {
    if (transport === "model-router") {
      if (previousChain === undefined) delete process.env[MODEL_CHAIN_ENV];
      else process.env[MODEL_CHAIN_ENV] = previousChain;
    }
  }

  const goldScores = fixtureScores.filter((score) => score.taxonScore !== null);
  const safeModel = options.model.replace(/[^a-z0-9._-]+/giu, "-").replace(/^-+|-+$/gu, "").slice(0, 90);
  const suffix = fixtures.length === ZUKAN_BENCH_SMOKE_POST_COUNT ? "smoke" : "core";
  const reportPath = path.join(reportDir, `${new Date().toISOString().slice(0, 10)}-${safeModel}-${options.reportLabel ?? suffix}.json`);
  const reportLocator = path.relative(process.cwd(), reportPath).replace(/\\/gu, "/");
  const report: ZukanBenchModelReport = {
    version: ZUKAN_MODEL_BENCH_VERSION,
    promptVersion: options.promptVersion ?? ZUKAN_MODEL_BENCH_PROMPT_VERSION,
    promptSha256: prompt.sha256,
    outputContractVersion: outputContract,
    outputSchemaSha256,
    executionConcurrency: concurrency,
    canaryReportPath: options.canaryReportPath ?? null,
    model: options.model,
    provider,
    manifestPath,
    datasetSha256: manifest.datasetSha256,
    startedAt,
    completedAt: new Date().toISOString(),
    postCount: fixtures.length,
    imageCount: fixtures.reduce((sum, fixture) => sum + fixture.images.length, 0),
    successCount,
    modelRequestCount,
    successRatePct: Number(((successCount / Math.max(1, fixtures.length)) * 100).toFixed(2)),
    schemaValidRatePct: Number(((fixtureScores.filter((score) => score.schemaValid).length / Math.max(1, fixtures.length)) * 100).toFixed(2)),
    goldPostCount: goldScores.length,
    taxonScorePct: goldScores.length
      ? Number(((goldScores.reduce((sum, score) => sum + (score.taxonScore ?? 0), 0) / goldScores.length) * 100).toFixed(2))
      : null,
    criticalFailurePostCount: fixtureScores.filter((score) => score.criticalFailures.length > 0).length,
    highConfidenceWrongPostCount: fixtureScores.filter((score) => score.criticalFailures.includes("high_confidence_wrong_species")).length,
    overprecisionPostCount: fixtureScores.filter((score) => score.criticalFailures.includes("overprecise_beyond_human_gold")).length,
    locationHallucinationPostCount: fixtureScores.filter((score) => score.criticalFailures.includes("location_hallucination")).length,
    p50LatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
    totalInputTokens,
    totalOutputTokens,
    estimatedCostUsd: estimatedCost(totalInputTokens, totalOutputTokens, options.pricing ?? null),
    pricing: options.pricing ?? null,
    transport,
    usageMeasurement: usageObserved && usageComplete ? "provider-reported" : "not-exposed",
    observedAdditionalCostUsd: null,
    reportSchemaVersion: ZUKAN_BENCH_REPORT_SCHEMA_VERSION,
    requestConfig,
    accuracyStatus: goldScores.length > 0 ? "MEASURED" : "INSUFFICIENT_GOLD",
    reportPath: reportLocator,
    fixtureScores,
  };
  await mkdir(reportDir, { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

export type ZukanBenchFinalVerdict = "KEEP_GEMINI" | "SWITCH_TO_GLM" | "INSUFFICIENT_GOLD" | "BASELINE_INVALID";

export type ZukanBenchComparison = {
  datasetSha256: string;
  promptSha256: string;
  decision: "KEEP" | "SWITCH" | "REJECT_CHALLENGER" | "INSUFFICIENT_GOLD" | "BASELINE_INVALID";
  finalVerdict?: ZukanBenchFinalVerdict;
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
    if (
      (report.outputContractVersion ?? "legacy-v1") !== (baseline.outputContractVersion ?? "legacy-v1")
      || (report.outputSchemaSha256 ?? null) !== (baseline.outputSchemaSha256 ?? null)
    ) throw new Error("zukan_bench_compare_output_contract_mismatch");
  }
  const maxGold = Math.max(...reports.map((report) => report.goldPostCount));
  if (maxGold < ZUKAN_BENCH_MIN_GOLD_POSTS) return {
    datasetSha256: baseline.datasetSha256,
    promptSha256: baseline.promptSha256,
    decision: "INSUFFICIENT_GOLD",
    finalVerdict: "INSUFFICIENT_GOLD",
    baselineModel: baseline.model,
    winnerModel: baseline.model,
    reason: `Human-consensus gold posts are ${maxGold}; at least ${ZUKAN_BENCH_MIN_GOLD_POSTS} are required for automatic switching.`,
  };

  const eligible = reports.filter(hardGatePass);
  const challengerEligible = eligible.filter((report) => report.model !== baseline.model);
  if (!hardGatePass(baseline) && !challengerEligible.length) return {
    datasetSha256: baseline.datasetSha256,
    promptSha256: baseline.promptSha256,
    decision: "BASELINE_INVALID",
    finalVerdict: "BASELINE_INVALID",
    baselineModel: baseline.model,
    winnerModel: "",
    reason: "Baseline and all challengers failed reliability hard gates; no model is approved.",
  };
  if (!challengerEligible.length) return {
    datasetSha256: baseline.datasetSha256,
    promptSha256: baseline.promptSha256,
    decision: "REJECT_CHALLENGER",
    finalVerdict: baseline.model === ZUKAN_PRODUCTION_VISION_BASELINE_MODEL ? "KEEP_GEMINI" : undefined,
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
  const finalVerdict: ZukanBenchFinalVerdict | undefined = winner.model === CLOUDFLARE_GLM_5_3_FLASH_MODEL
    ? "SWITCH_TO_GLM"
    : winner.model === ZUKAN_PRODUCTION_VISION_BASELINE_MODEL
      ? "KEEP_GEMINI"
      : undefined;
  return {
    datasetSha256: baseline.datasetSha256,
    promptSha256: baseline.promptSha256,
    decision: winner.model === baseline.model ? "KEEP" : "SWITCH",
    finalVerdict,
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

function transportFromArgs(args: string[]): "model-router" | "cloudflare-official-rest" | "cloudflare-ai-rest" | "cloudflare-ai-run" | "cloudflare-google-native" | "cloudflare-xai-native" | undefined {
  const value = stringArg(args, "transport");
  if (value === undefined) return undefined;
  if (
    value === "model-router"
    || value === "cloudflare-official-rest"
    || value === "cloudflare-ai-rest"
    || value === "cloudflare-ai-run"
    || value === "cloudflare-google-native"
    || value === "cloudflare-xai-native"
  ) return value;
  throw new Error(`invalid_transport:${value}`);
}

function thinkingLevelFromArgs(args: string[]): "minimal" | "low" | "medium" | "high" | undefined {
  const value = stringArg(args, "thinking-level");
  if (value === undefined) return undefined;
  if (value === "minimal" || value === "low" || value === "medium" || value === "high") return value;
  throw new Error(`invalid_thinking_level:${value}`);
}

function mediaResolutionFromArgs(args: string[]): "low" | "medium" | "high" | undefined {
  const value = stringArg(args, "media-resolution");
  if (value === undefined) return undefined;
  if (value === "low" || value === "medium" || value === "high") return value;
  throw new Error(`invalid_media_resolution:${value}`);
}

function outputContractFromArgs(args: string[]): ZukanBenchOutputContractVersion | undefined {
  const value = stringArg(args, "output-contract");
  if (value === undefined) return undefined;
  if (value === "legacy-v1" || value === "compact-v2") return value;
  throw new Error(`invalid_output_contract:${value}`);
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
  if (command === "prepare-smoke") {
    const manifest = await freezeZukanBenchManifest({
      baseUrl: stringArg(args, "base-url"),
      count: ZUKAN_BENCH_SMOKE_POST_COUNT,
      outputPath: stringArg(args, "out") ?? DEFAULT_ZUKAN_BENCH_SMOKE_MANIFEST,
      rightsVettedResearchApi: true,
    });
    console.log(JSON.stringify({ status: "RIGHTS_VETTED_SMOKE_FROZEN", postCount: manifest.postCount, imageCount: manifest.imageCount, datasetSha256: manifest.datasetSha256, promptSha256: manifest.promptSha256 }, null, 2));
    return;
  }
  if (command === "freeze-owner-smoke") {
    const ownerVisitIds = (stringArg(args, "visit-ids") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
    if (ownerVisitIds.length < ZUKAN_BENCH_SMOKE_POST_COUNT) throw new Error("--visit-ids requires at least 8 owner visit IDs");
    const manifest = await freezeZukanBenchManifest({
      baseUrl: stringArg(args, "base-url"),
      count: ZUKAN_BENCH_SMOKE_POST_COUNT,
      outputPath: stringArg(args, "out") ?? DEFAULT_ZUKAN_OWNER_BENCH_SMOKE_MANIFEST,
      ownerVisitIds,
    });
    console.log(JSON.stringify({ status: "OWNER_SMOKE_FROZEN", postCount: manifest.postCount, imageCount: manifest.imageCount, datasetSha256: manifest.datasetSha256, promptSha256: manifest.promptSha256, fixtureIds: manifest.fixtures.map((fixture) => fixture.fixtureId) }, null, 2));
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
    if (!model) throw new Error("--model is required; example: --model=@cf/zai-org/glm-5.3-flash");
    const canaryReportPath = stringArg(args, "canary-report");
    const completedCanaryReport = canaryReportPath
      ? JSON.parse(await readFile(canaryReportPath, "utf8")) as ZukanBenchModelReport
      : undefined;
    const report = await runZukanModelBench({
      model,
      manifestPath: stringArg(args, "manifest"),
      reportDir: stringArg(args, "report-dir"),
      pricing: pricingFromArgs(args),
      limit: numericArg(args, "limit"),
      maxEstimatedCostUsd: numericArg(args, "max-estimated-cost-usd"),
      transport: transportFromArgs(args),
      maxOutputTokens: numericArg(args, "max-output-tokens"),
      thinkingLevel: thinkingLevelFromArgs(args),
      mediaResolution: mediaResolutionFromArgs(args),
      imageMaxEdge: numericArg(args, "image-max-edge"),
      imageFetchOrigin: stringArg(args, "image-fetch-origin"),
      promptSource: stringArg(args, "prompt-source"),
      promptVersion: stringArg(args, "prompt-version"),
      outputContract: outputContractFromArgs(args),
      concurrency: numericArg(args, "concurrency"),
      completedCanaryReport,
      canaryReportPath,
      requireCanarySuccess: canaryReportPath ? false : undefined,
      reportLabel: stringArg(args, "report-label"),
    });
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (command === "smoke-glm") {
    const report = await runZukanModelBench({
      model: CLOUDFLARE_GLM_5_3_FLASH_MODEL,
      manifestPath: stringArg(args, "manifest") ?? DEFAULT_ZUKAN_OWNER_BENCH_SMOKE_EXTERNAL_MANIFEST,
      reportDir: stringArg(args, "report-dir"),
      pricing: { inputUsdPer1M: 0.15, outputUsdPer1M: 0.50, source: "cloudflare-workers-ai-2026-08-26" },
      maxEstimatedCostUsd: 0.35,
      transport: "cloudflare-official-rest",
      requireFixedOwnerSmoke: true,
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
  throw new Error(`unknown command:${command}; use prepare-smoke, freeze-owner-smoke, smoke-glm, freeze, vet-rights, run, or compare`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
