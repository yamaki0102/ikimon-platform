import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import type { PoolClient } from "pg";
import { loadConfig } from "../config.js";
import { getPool } from "../db.js";
import { createObservationAiRun, ensureLegacyAiRunsForVisit, getLatestObservationAiRunForVisit } from "./observationAiRuns.js";
import { matchTaxon, matchTaxonBatch, type GbifMatch } from "./gbifBackboneMatch.js";
import { getStoredVisitDisplayState, upsertVisitDisplayState, deriveVisitDisplayState } from "./visitDisplayState.js";
import { getVisitSubjectSummaries } from "./visitSubjects.js";

export type ReassessResult = {
  aiRunId: string;
  assessmentId: string;
  occurrenceId: string;
  visitId: string;
  confidenceBand: string;
  recommendedTaxonName: string;
  narrative: string;
  candidateCount: number;
  regionCount: number;
  gbifMatchedPrimary: boolean;
  gbifMatchedCoexistingCount: number;
  modelUsed: string;
  selectionSource: string;
  featuredOccurrenceId: string | null;
};

export type ReassessImageInput = {
  mime: string;
  b64: string;
  assetId?: string | null;
  frameTimeMs?: number | null;
};

export type ReassessObservationOptions = {
  photos?: ReassessImageInput[];
  promptVersion?: string;
  sourceTag?: string;
  triggeredBy?: string | null;
};

type GeminiRegion = {
  asset_index?: number;
  rect?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  frame_time_ms?: number;
  confidence?: number;
  note?: string;
};

type GeminiAreaCandidate = {
  label?: string;
  why?: string;
  confidence?: number;
};

type GeminiAreaInference = {
  vegetation_structure_candidates?: GeminiAreaCandidate[];
  succession_stage_candidates?: GeminiAreaCandidate[];
  human_influence_candidates?: GeminiAreaCandidate[];
  moisture_regime_candidates?: GeminiAreaCandidate[];
  management_hint_candidates?: GeminiAreaCandidate[];
};

type GeminiShotSuggestion = {
  role?: string;
  target?: string;
  rationale?: string;
  priority?: string;
};

type GeminiJson = {
  confidence_band?: string;
  recommended_rank?: string;
  recommended_taxon_name?: string;
  recommended_scientific_name?: string;
  best_specific_taxon_name?: string;
  narrative?: string;
  simple_summary?: string;
  observer_boost?: string;
  next_step_text?: string;
  stop_reason?: string;
  fun_fact?: string;
  fun_fact_grounded?: boolean;
  diagnostic_features_seen?: string[];
  missing_evidence?: string[];
  similar_taxa?: Array<{ name?: string; rank?: string }>;
  distinguishing_tips?: string[];
  confirm_more?: string[];
  geographic_context?: string;
  seasonal_context?: string;
  area_inference?: GeminiAreaInference;
  shot_suggestions?: GeminiShotSuggestion[];
  recommended_media_regions?: GeminiRegion[];
  coexisting_taxa?: Array<{
    name?: string;
    scientific_name?: string;
    rank?: string;
    confidence?: number;
    note?: string;
    media_regions?: GeminiRegion[];
  }>;
};

const AREA_INFERENCE_KEYS = [
  "vegetation_structure_candidates",
  "succession_stage_candidates",
  "human_influence_candidates",
  "moisture_regime_candidates",
  "management_hint_candidates",
] as const;

type AreaInferenceKey = typeof AREA_INFERENCE_KEYS[number];

type NormalizedAreaCandidate = {
  label: string;
  why: string;
  confidence: number | null;
};

type NormalizedAreaInference = Record<AreaInferenceKey, NormalizedAreaCandidate[]>;

const SHOT_SUGGESTION_ROLES = new Set([
  "full_body",
  "close_up_organ",
  "habitat_wide",
  "substrate",
  "scale_reference",
]);

const SHOT_SUGGESTION_PRIORITIES = new Set(["high", "medium"]);

type NormalizedShotSuggestion = {
  role: string;
  target: string;
  rationale: string;
  priority: "high" | "medium";
};

function normalizeAreaCandidate(raw: unknown): NormalizedAreaCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as GeminiAreaCandidate;
  const label = typeof obj.label === "string" ? obj.label.trim() : "";
  if (!label) return null;
  const why = typeof obj.why === "string" ? obj.why.trim() : "";
  const confidenceRaw = typeof obj.confidence === "number" && Number.isFinite(obj.confidence)
    ? Math.min(1, Math.max(0, obj.confidence))
    : null;
  return { label: label.slice(0, 60), why: why.slice(0, 120), confidence: confidenceRaw };
}

function normalizeAreaInference(raw: GeminiAreaInference | undefined): NormalizedAreaInference {
  const out: NormalizedAreaInference = {
    vegetation_structure_candidates: [],
    succession_stage_candidates: [],
    human_influence_candidates: [],
    moisture_regime_candidates: [],
    management_hint_candidates: [],
  };
  if (!raw || typeof raw !== "object") return out;
  for (const key of AREA_INFERENCE_KEYS) {
    const arr = (raw as Record<string, unknown>)[key];
    if (!Array.isArray(arr)) continue;
    out[key] = arr
      .map(normalizeAreaCandidate)
      .filter((value): value is NormalizedAreaCandidate => value !== null)
      .slice(0, 4);
  }
  return out;
}

function normalizeShotSuggestions(raw: GeminiShotSuggestion[] | undefined): NormalizedShotSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: NormalizedShotSuggestion[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const role = typeof entry.role === "string" ? entry.role.trim() : "";
    const target = typeof entry.target === "string" ? entry.target.trim() : "";
    const rationale = typeof entry.rationale === "string" ? entry.rationale.trim() : "";
    const priorityRaw = typeof entry.priority === "string" ? entry.priority.trim().toLowerCase() : "";
    if (!SHOT_SUGGESTION_ROLES.has(role) || !target) continue;
    const priority: "high" | "medium" = SHOT_SUGGESTION_PRIORITIES.has(priorityRaw)
      ? (priorityRaw as "high" | "medium")
      : "medium";
    const dedupeKey = `${role}|${target.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({
      role,
      target: target.slice(0, 60),
      rationale: rationale.slice(0, 120),
      priority,
    });
    if (out.length >= 5) break;
  }
  return out;
}

type LoadedPhotoInput = ReassessImageInput & {
  assetId: string | null;
};

type ResolvedObservationTarget = {
  visitId: string;
  selectedOccurrenceId: string;
  primaryOccurrenceId: string;
  selectedSubjectIndex: number;
  vernacularName: string | null;
  scientificName: string | null;
  taxonRank: string | null;
};

type NormalizedRegion = {
  assetIndex: number;
  frameTimeMs: number | null;
  confidence: number | null;
  note: string | null;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

const PIPELINE_VERSION = "observation-reassess/v2-durable";
const TAXONOMY_VERSION = "gbif-backbone/current";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = resolve(__dirname, "../prompts/observation_reassess.md");
let CACHED_PROMPT: string | null = null;

function loadPrompt(): string {
  if (CACHED_PROMPT) return CACHED_PROMPT;
  CACHED_PROMPT = readFileSync(PROMPT_PATH, "utf-8");
  return CACHED_PROMPT;
}

function renderPrompt(vars: Record<string, string>): string {
  let out = loadPrompt();
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`\${${k}}`).join(v);
  }
  return out;
}

function guessSeason(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const m = (isNaN(d.getTime()) ? new Date() : d).getMonth() + 1;
  if (m >= 3 && m <= 5) return "春";
  if (m >= 6 && m <= 8) return "夏";
  if (m >= 9 && m <= 11) return "秋";
  return "冬";
}

function normalizeRank(r: string | undefined): "species" | "genus" | "family" | "order" | "lifeform" | "unknown" {
  const v = String(r ?? "").toLowerCase().trim();
  if (v === "species" || v === "genus" || v === "family" || v === "order" || v === "lifeform") return v;
  return "unknown";
}

function normalizeBand(b: string | undefined): "high" | "medium" | "low" | "unknown" {
  const v = String(b ?? "").toLowerCase().trim();
  if (v === "high" || v === "medium" || v === "low") return v;
  return "unknown";
}

function normalizeRectCandidate(region: GeminiRegion): NormalizedRegion | null {
  const assetIndex = Number(region.asset_index);
  if (!Number.isInteger(assetIndex) || assetIndex < 0) {
    return null;
  }
  const rect = region.rect ?? {};
  const x = Number(rect.x);
  const y = Number(rect.y);
  const width = Number(rect.width);
  const height = Number(rect.height);
  if (![x, y, width, height].every((value) => Number.isFinite(value))) {
    return null;
  }
  if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1.001 || y + height > 1.001) {
    return null;
  }
  const frameTimeMs = region.frame_time_ms == null ? null : Number(region.frame_time_ms);
  const confidence = region.confidence == null ? null : Math.min(1, Math.max(0, Number(region.confidence)));
  return {
    assetIndex,
    frameTimeMs: Number.isFinite(frameTimeMs ?? NaN) ? Math.max(0, Math.round(frameTimeMs ?? 0)) : null,
    confidence: confidence != null && Number.isFinite(confidence) ? confidence : null,
    note: typeof region.note === "string" && region.note.trim() ? region.note.trim() : null,
    rect: { x, y, width, height },
  };
}

function buildCandidateKey(vernacularName: string, scientificName: string, rank: string | null): string {
  return [scientificName.trim().toLowerCase(), vernacularName.trim().toLowerCase(), String(rank ?? "").trim().toLowerCase()]
    .filter((part) => part.length > 0)
    .join("|");
}

function buildAssetFingerprint(sourceTag: string, photos: LoadedPhotoInput[]): string {
  const hash = createHash("sha256");
  hash.update(sourceTag);
  for (const photo of photos) {
    hash.update("|");
    hash.update(photo.assetId ?? "inline");
    hash.update(":");
    hash.update(String(photo.frameTimeMs ?? ""));
    hash.update(":");
    hash.update(String(photo.b64.length));
    hash.update(":");
    hash.update(photo.b64.slice(0, 64));
  }
  return hash.digest("hex");
}

async function loadPhotoBytes(client: PoolClient, visitId: string): Promise<LoadedPhotoInput[]> {
  const rows = await client.query<{
    asset_id: string;
    mime_type: string | null;
    storage_path: string | null;
    public_url: string | null;
  }>(
    `SELECT ea.asset_id::text,
            ab.mime_type,
            ab.storage_path,
            ab.public_url
       FROM evidence_assets ea
       JOIN asset_blobs ab ON ab.blob_id = ea.blob_id
      WHERE ea.visit_id = $1
        AND ea.asset_role = 'observation_photo'
      ORDER BY ea.created_at ASC
      LIMIT 3`,
    [visitId],
  );

  const { legacyPublicRoot } = loadConfig();
  const out: LoadedPhotoInput[] = [];
  for (const row of rows.rows) {
    const candidates: string[] = [];
    if (row.storage_path) {
      if (path.isAbsolute(row.storage_path)) candidates.push(row.storage_path);
      else candidates.push(path.join(legacyPublicRoot, row.storage_path));
    }
    if (row.public_url && !row.public_url.startsWith("http")) {
      candidates.push(path.join(legacyPublicRoot, row.public_url.replace(/^\/+/, "")));
    }
    for (const candidate of candidates) {
      try {
        const buf = await readFile(candidate);
        out.push({
          mime: row.mime_type || "image/jpeg",
          b64: buf.toString("base64"),
          assetId: row.asset_id,
          frameTimeMs: null,
        });
        break;
      } catch {
        // continue
      }
    }
  }
  return out;
}

async function resolveObservationTarget(client: PoolClient, observationId: string): Promise<ResolvedObservationTarget | null> {
  const result = await client.query<{
    visit_id: string;
    selected_occurrence_id: string | null;
    primary_occurrence_id: string;
    selected_subject_index: number | null;
    vernacular_name: string | null;
    scientific_name: string | null;
    taxon_rank: string | null;
  }>(
    `WITH matched_visit AS (
        SELECT visit_id
          FROM visits
         WHERE visit_id = $1
            OR legacy_observation_id = $1
        UNION
        SELECT visit_id
          FROM occurrences
         WHERE occurrence_id = $1
            OR legacy_observation_id = $1
        LIMIT 1
     )
     SELECT v.visit_id,
            selected.occurrence_id AS selected_occurrence_id,
            primary_occurrence.occurrence_id AS primary_occurrence_id,
            selected.subject_index AS selected_subject_index,
            coalesce(selected.vernacular_name, primary_occurrence.vernacular_name) AS vernacular_name,
            coalesce(selected.scientific_name, primary_occurrence.scientific_name) AS scientific_name,
            coalesce(selected.taxon_rank, primary_occurrence.taxon_rank) AS taxon_rank
       FROM matched_visit mv
       JOIN visits v ON v.visit_id = mv.visit_id
       JOIN occurrences primary_occurrence
         ON primary_occurrence.visit_id = v.visit_id
        AND primary_occurrence.subject_index = 0
       LEFT JOIN LATERAL (
         SELECT occurrence_id, subject_index, vernacular_name, scientific_name, taxon_rank
           FROM occurrences
          WHERE visit_id = v.visit_id
            AND (occurrence_id = $1 OR legacy_observation_id = $1)
          ORDER BY subject_index ASC
          LIMIT 1
       ) selected ON true
      LIMIT 1`,
    [observationId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    visitId: row.visit_id,
    selectedOccurrenceId: row.selected_occurrence_id ?? row.primary_occurrence_id,
    primaryOccurrenceId: row.primary_occurrence_id,
    selectedSubjectIndex: row.selected_subject_index ?? 0,
    vernacularName: row.vernacular_name,
    scientificName: row.scientific_name,
    taxonRank: row.taxon_rank,
  };
}

function getClient(): GoogleGenAI {
  const cfg = loadConfig();
  if (!cfg.geminiApiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey: cfg.geminiApiKey });
}

async function runGemini(prompt: string, photos: ReassessImageInput[]): Promise<{ parsed: GeminiJson; modelUsed: string; rawText: string }> {
  const ai = getClient();
  const parts: Array<Record<string, unknown>> = photos.map((photo) => ({
    inlineData: { mimeType: photo.mime, data: photo.b64 },
  }));
  parts.push({ text: prompt });

  const MODELS = ["gemini-3.1-flash-lite-preview", "gemini-2.5-flash-lite"];
  let lastErr: unknown = null;
  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({ model, contents: [{ role: "user", parts }] });
      const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      let parsed: GeminiJson = {};
      try {
        const matched = rawText.match(/\{[\s\S]*\}/);
        if (matched) parsed = JSON.parse(matched[0]);
      } catch {
        parsed = {};
      }
      return { parsed, modelUsed: model, rawText };
    } catch (error) {
      lastErr = error;
      const msg = error instanceof Error ? error.message : String(error);
      if (!/503|UNAVAILABLE|RESOURCE_EXHAUSTED|rate|quota/i.test(msg)) throw error;
    }
  }
  throw lastErr ?? new Error("gemini_all_models_failed");
}

/**
 * 観察単位の AI 再判定。
 * canonical occurrence は直接更新せず、immutable な ai_run / assessment / candidate / region を追記する。
 * stable display state は human lock を維持しつつ、未確定 visit だけ最新 run を既定表示に使う。
 */
export async function reassessObservation(
  observationId: string,
  options: ReassessObservationOptions = {},
): Promise<ReassessResult> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const target = await resolveObservationTarget(client, observationId);
    if (!target) {
      throw new Error("occurrence_not_found");
    }

    const visit = await client.query<{
      observed_at: string;
      latitude: number | null;
      longitude: number | null;
      place_id: string | null;
    }>(
      `SELECT to_char(v.observed_at, 'YYYY-MM-DD HH24:MI') AS observed_at,
              coalesce(v.point_latitude, p.center_latitude) AS latitude,
              coalesce(v.point_longitude, p.center_longitude) AS longitude,
              v.place_id
         FROM visits v
         LEFT JOIN places p ON p.place_id = v.place_id
        WHERE v.visit_id = $1
        LIMIT 1`,
      [target.visitId],
    );
    const vctx = visit.rows[0] ?? { observed_at: "", latitude: null, longitude: null, place_id: null };

    const overridePhotos = Array.isArray(options.photos)
      ? options.photos
          .filter((photo) =>
            typeof photo?.mime === "string" &&
            photo.mime.trim().startsWith("image/") &&
            typeof photo.b64 === "string" &&
            photo.b64.trim().length > 0,
          )
          .map((photo) => ({
            ...photo,
            assetId: photo.assetId ?? null,
          }))
      : [];
    const photos = overridePhotos.length > 0
      ? overridePhotos
      : await loadPhotoBytes(client, target.visitId);
    if (photos.length === 0) {
      throw new Error("no_photo_for_reassess");
    }

    const lat = vctx.latitude ?? 35.0;
    const lng = vctx.longitude ?? 138.0;
    const existingLabel = target.vernacularName || target.scientificName || "未同定";
    const prompt = renderPrompt({
      occurrenceId: target.primaryOccurrenceId,
      lat: lat.toFixed(5),
      lng: lng.toFixed(5),
      observedAt: vctx.observed_at || "不明",
      season: guessSeason(vctx.observed_at || null),
      existingLabel,
      siteBriefLabel: vctx.place_id ?? "不明",
    });

    const { parsed, modelUsed, rawText } = await runGemini(prompt, photos);
    const promptVersion = options.promptVersion?.trim() || "observation_reassess.md/v2";
    const sourceTag = options.sourceTag?.trim() || "photo";

    const band = normalizeBand(parsed.confidence_band);
    const rank = normalizeRank(parsed.recommended_rank);
    const recommendedName = String(parsed.recommended_taxon_name ?? "").trim();
    const recommendedScientificName = String(parsed.recommended_scientific_name ?? "").trim();
    const bestSpecific = String(parsed.best_specific_taxon_name ?? "").trim();
    const narrative = String(parsed.narrative ?? "").trim();
    const simple = String(parsed.simple_summary ?? "").trim();
    const diagFeatures = Array.isArray(parsed.diagnostic_features_seen) ? parsed.diagnostic_features_seen.filter((value) => typeof value === "string") : [];
    const missing = Array.isArray(parsed.missing_evidence) ? parsed.missing_evidence.filter((value) => typeof value === "string") : [];
    const similar = Array.isArray(parsed.similar_taxa)
      ? parsed.similar_taxa
          .filter((value) => value && typeof value.name === "string" && value.name.trim().length > 0)
          .map((value) => ({ name: value.name, rank: value.rank ?? "species" }))
      : [];
    const distinguishing = Array.isArray(parsed.distinguishing_tips) ? parsed.distinguishing_tips.filter((value) => typeof value === "string") : [];
    const confirmMore = Array.isArray(parsed.confirm_more) ? parsed.confirm_more.filter((value) => typeof value === "string") : [];
    const areaInference = normalizeAreaInference(parsed.area_inference);
    const shotSuggestions = normalizeShotSuggestions(parsed.shot_suggestions);
    const coexisting = Array.isArray(parsed.coexisting_taxa)
      ? parsed.coexisting_taxa.filter((value) => {
          if (!value) return false;
          const name = typeof value.name === "string" ? value.name.trim() : "";
          const scientificName = typeof value.scientific_name === "string" ? value.scientific_name.trim() : "";
          return name.length > 0 || scientificName.length > 0;
        })
      : [];

    const primaryRankHint = rank === "unknown" ? null : rank;
    const primaryMatchName = recommendedScientificName || recommendedName;
    const preparedCandidates = coexisting.map((candidate) => {
      const vernacularName = String(candidate.name ?? "").trim();
      const scientificName = String(candidate.scientific_name ?? "").trim();
      const normalizedRank = normalizeRank(candidate.rank);
      const confidence =
        typeof candidate.confidence === "number" && Number.isFinite(candidate.confidence)
          ? Math.min(1, Math.max(0, candidate.confidence))
          : 0.5;
      return {
        vernacularName,
        scientificName,
        matchName: scientificName || vernacularName,
        rankHint: normalizedRank === "unknown" ? null : normalizedRank,
        rank: normalizedRank,
        confidence,
        note: typeof candidate.note === "string" ? candidate.note.trim() : null,
        regions: Array.isArray(candidate.media_regions)
          ? candidate.media_regions.map(normalizeRectCandidate).filter((region): region is NormalizedRegion => Boolean(region))
          : [],
      };
    });

    const [primaryGbifMatch, coexistingGbifMatches] = await Promise.all([
      matchTaxon({ name: primaryMatchName, rank: primaryRankHint }),
      matchTaxonBatch(preparedCandidates.map((candidate) => ({ name: candidate.matchName, rank: candidate.rankHint }))),
    ]);
    const gbifMatchedPrimary = primaryGbifMatch.usageKey !== null;
    const gbifMatchedCoexistingCount = coexistingGbifMatches.reduce((count, match) => (match.usageKey !== null ? count + 1 : count), 0);
    const primaryRegions = Array.isArray(parsed.recommended_media_regions)
      ? parsed.recommended_media_regions.map(normalizeRectCandidate).filter((region): region is NormalizedRegion => Boolean(region))
      : [];

    await client.query("begin");
    await ensureLegacyAiRunsForVisit(client, target.visitId);
    const previousRun = await getLatestObservationAiRunForVisit(client, target.visitId);
    const aiRun = await createObservationAiRun(client, {
      visitId: target.visitId,
      triggerOccurrenceId: target.primaryOccurrenceId,
      pipelineVersion: PIPELINE_VERSION,
      modelProvider: "google",
      modelName: modelUsed,
      modelVersion: modelUsed,
      promptVersion,
      taxonomyVersion: TAXONOMY_VERSION,
      inputAssetFingerprint: buildAssetFingerprint(sourceTag, photos),
      triggerKind: sourceTag === "video_thumb" ? "video_thumb_reassess" : "manual_reassess",
      triggeredBy: options.triggeredBy ?? null,
      supersedesRunId: previousRun?.aiRunId ?? null,
      runStatus: "succeeded",
      sourcePayload: {
        sourceTag,
        selectedOccurrenceId: target.selectedOccurrenceId,
        photoCount: photos.length,
      },
    });

    const assessmentId = randomUUID();
    await client.query(
      `INSERT INTO observation_ai_assessments (
         assessment_id,
         ai_run_id,
         occurrence_id,
         visit_id,
         confidence_band,
         model_used,
         prompt_version,
         pipeline_version,
         taxonomy_version,
         interpretation_status,
         recommended_rank,
         recommended_taxon_name,
         best_specific_taxon_name,
         narrative,
         simple_summary,
         observer_boost,
         next_step_text,
         stop_reason,
         fun_fact,
         fun_fact_grounded,
         diagnostic_features_seen,
         missing_evidence,
         similar_taxa,
         distinguishing_tips,
         confirm_more,
         geographic_context,
         seasonal_context,
         area_inference,
         shot_suggestions,
         raw_json
       ) VALUES (
         $1::uuid,
         $2::uuid,
         $3,
         $4,
         $5,
         $6,
         $7,
         $8,
         $9,
         'selected',
         $10,
         $11,
         $12,
         $13,
         $14,
         $15,
         $16,
         $17,
         $18,
         $19,
         $20::jsonb,
         $21::jsonb,
         $22::jsonb,
         $23::jsonb,
         $24::jsonb,
         $25,
         $26,
         $27::jsonb,
         $28::jsonb,
         $29::jsonb
       )`,
      [
        assessmentId,
        aiRun.aiRunId,
        target.primaryOccurrenceId,
        target.visitId,
        band,
        modelUsed,
        promptVersion,
        PIPELINE_VERSION,
        TAXONOMY_VERSION,
        rank === "unknown" ? null : rank,
        recommendedName || null,
        bestSpecific || null,
        narrative,
        simple,
        String(parsed.observer_boost ?? "").trim(),
        String(parsed.next_step_text ?? "").trim(),
        String(parsed.stop_reason ?? "").trim(),
        String(parsed.fun_fact ?? "").trim(),
        Boolean(parsed.fun_fact_grounded),
        JSON.stringify(diagFeatures),
        JSON.stringify(missing),
        JSON.stringify(similar),
        JSON.stringify(distinguishing),
        JSON.stringify(confirmMore),
        String(parsed.geographic_context ?? "").trim(),
        String(parsed.seasonal_context ?? "").trim(),
        JSON.stringify(areaInference),
        JSON.stringify(shotSuggestions),
        JSON.stringify({ raw: rawText.slice(0, 12000), parsed }),
      ],
    );

    const subjects = await getVisitSubjectSummaries(target.visitId, client);
    const subjectByKey = new Map<string, { occurrenceId: string }>();
    for (const subject of subjects) {
      const subjectKey = buildCandidateKey(subject.vernacularName ?? "", subject.scientificName ?? "", subject.rank);
      if (subjectKey) {
        subjectByKey.set(subjectKey, { occurrenceId: subject.occurrenceId });
      }
    }

    let candidateCount = 0;
    let regionCount = 0;
    for (let index = 0; index < preparedCandidates.length; index += 1) {
      const candidate = preparedCandidates[index];
      if (!candidate) continue;
      const gbif = coexistingGbifMatches[index];
      const candidateKey = buildCandidateKey(candidate.vernacularName, candidate.scientificName, candidate.rankHint);
      const matchedSubject = candidateKey ? subjectByKey.get(candidateKey) ?? null : null;
      const candidateId = randomUUID();
      await client.query(
        `INSERT INTO observation_ai_subject_candidates (
           candidate_id,
           ai_run_id,
           visit_id,
           suggested_occurrence_id,
           candidate_key,
           vernacular_name,
           scientific_name,
           taxon_rank,
           confidence_score,
           candidate_status,
           note,
           source_payload,
           updated_at
         ) VALUES (
           $1::uuid,
           $2::uuid,
           $3,
           $4,
           $5,
           $6,
           $7,
           $8,
           $9,
           $10,
           $11,
           $12::jsonb,
           NOW()
         )`,
        [
          candidateId,
          aiRun.aiRunId,
          target.visitId,
          matchedSubject?.occurrenceId ?? null,
          candidateKey || `${candidate.vernacularName}:${index}`,
          candidate.vernacularName || null,
          candidate.scientificName || null,
          candidate.rankHint,
          candidate.confidence,
          matchedSubject ? "matched" : "proposed",
          candidate.note,
          JSON.stringify({
            sourceTag,
            gbif: {
              usageKey: gbif?.usageKey ?? null,
              matchType: gbif?.matchType ?? "NONE",
              confidence: gbif?.confidence ?? null,
            },
          }),
        ],
      );
      candidateCount += 1;

      for (const region of candidate.regions) {
        const photo = photos[region.assetIndex];
        if (!photo?.assetId) continue;
        await client.query(
          `INSERT INTO subject_media_regions (
             region_id,
             ai_run_id,
             occurrence_id,
             candidate_id,
             asset_id,
             normalized_rect,
             frame_time_ms,
             confidence_score,
             source_kind,
             source_model,
             source_payload
           ) VALUES (
             gen_random_uuid(),
             $1::uuid,
             $2,
             $3::uuid,
             $4::uuid,
             $5::jsonb,
             $6,
             $7,
             'ai',
             $8,
             $9::jsonb
           )`,
          [
            aiRun.aiRunId,
            matchedSubject?.occurrenceId ?? null,
            candidateId,
            photo.assetId,
            JSON.stringify(region.rect),
            region.frameTimeMs ?? photo.frameTimeMs ?? null,
            region.confidence,
            modelUsed,
            JSON.stringify({
              note: region.note,
              sourceTag,
              assetIndex: region.assetIndex,
            }),
          ],
        );
        regionCount += 1;
      }
    }

    for (const region of primaryRegions) {
      const photo = photos[region.assetIndex];
      if (!photo?.assetId) continue;
      await client.query(
        `INSERT INTO subject_media_regions (
           region_id,
           ai_run_id,
           occurrence_id,
           asset_id,
           normalized_rect,
           frame_time_ms,
           confidence_score,
           source_kind,
           source_model,
           source_payload
         ) VALUES (
           gen_random_uuid(),
           $1::uuid,
           $2,
           $3::uuid,
           $4::jsonb,
           $5,
           $6,
           'ai',
           $7,
           $8::jsonb
         )`,
        [
          aiRun.aiRunId,
          target.primaryOccurrenceId,
          photo.assetId,
          JSON.stringify(region.rect),
          region.frameTimeMs ?? photo.frameTimeMs ?? null,
          region.confidence,
          modelUsed,
          JSON.stringify({
            note: region.note,
            sourceTag,
            assetIndex: region.assetIndex,
          }),
        ],
      );
      regionCount += 1;
    }

    // Phase γ: evidence_assets.role_tag を region サイズから heuristic 推定。
    // 既に user/heuristic が付いているものは上書きしない (role_tag_source=ai のみ更新)。
    // area ≥ 0.55 → full_body / 0.05-0.55 → close_up_organ / region なし → habitat_wide
    const roleAreaByAsset = new Map<string, number>();
    for (const region of primaryRegions) {
      const photo = photos[region.assetIndex];
      if (!photo?.assetId || !region.rect) continue;
      const area = Math.max(0, Math.min(1, region.rect.width * region.rect.height));
      const prev = roleAreaByAsset.get(photo.assetId) ?? 0;
      if (area > prev) roleAreaByAsset.set(photo.assetId, area);
    }
    for (const photo of photos) {
      if (!photo?.assetId) continue;
      const maxArea = roleAreaByAsset.get(photo.assetId) ?? 0;
      const roleTag = maxArea >= 0.55 ? "full_body"
        : maxArea > 0 && maxArea < 0.55 ? "close_up_organ"
        : "habitat_wide";
      await client.query(
        `UPDATE evidence_assets
           SET role_tag = $1, role_tag_source = 'ai'
         WHERE asset_id = $2::uuid
           AND (role_tag IS NULL OR role_tag_source = 'ai')`,
        [roleTag, photo.assetId],
      );
    }

    const storedDisplayState = await getStoredVisitDisplayState(client, target.visitId).catch(() => null);
    const latestSubjects = await getVisitSubjectSummaries(target.visitId, client);
    let resolvedDisplayState = storedDisplayState;
    if (!storedDisplayState || !storedDisplayState.lockedByHuman) {
      resolvedDisplayState = deriveVisitDisplayState(target.visitId, latestSubjects, aiRun.aiRunId);
      await upsertVisitDisplayState(client, resolvedDisplayState);
    }

    await client.query("commit");

    return {
      aiRunId: aiRun.aiRunId,
      assessmentId,
      occurrenceId: target.primaryOccurrenceId,
      visitId: target.visitId,
      confidenceBand: band,
      recommendedTaxonName: recommendedName,
      narrative,
      candidateCount,
      regionCount,
      gbifMatchedPrimary,
      gbifMatchedCoexistingCount,
      modelUsed,
      selectionSource: resolvedDisplayState?.selectionSource ?? "system_stable",
      featuredOccurrenceId: resolvedDisplayState?.featuredOccurrenceId ?? null,
    };
  } catch (error) {
    try { await client.query("rollback"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}
