import type { ObservationAiCandidate, ObservationAiSubjectCandidate } from "./cloudflareObservationAi";
import {
  GEMINI_CANDIDATE_FUSION_RULE_VERSION,
  GEMINI_PRIMARY_MODEL,
  PHOTO_READING_INSTRUCTION,
  parseGeminiPhotoReadings,
  type GeminiEnvironmentFields,
  type GeminiMergedObservation,
  type GeminiObservationImage,
} from "./geminiObservationBatch";
import { FEATURE_TERMS, PLACE_SLOTS, PLACE_TERMS, validTimeRange, type FeatureKind, type PlaceSlot, type ReadingFeatureInput, type ReadingMediaMeta, type ReadingPlaceInput, type ReadingTimeRange } from "./recordReading";

export const VIDEO_READ_MAX_BYTES = 12 * 1024 * 1024;
export const VIDEO_READ_MAX_DURATION_MS = 60_000;
export const VIDEO_READ_MAX_VIDEOS = 2;
export const VIDEO_READ_MAX_SCENES = 8;
export const VIDEO_READ_MAX_ORGANISMS = 4;
export const VIDEO_READ_PROMPT_VERSION = "record-video-scenes/v1";
export const VIDEO_READ_MODEL = GEMINI_PRIMARY_MODEL;
const END_TOLERANCE_MS = 500;
const MIN_SCENE_MS = 500;

export type VideoOrganism = { name: string; scientific: string | null; rank: ObservationAiSubjectCandidate["rank"]; confidence: number };
export type VideoScene = {
  range: ReadingTimeRange;
  assessmentState: "informative" | "not_informative" | "not_assessable";
  fields: Partial<Record<PlaceSlot, string>>;
  featureKinds: FeatureKind[];
  organisms: VideoOrganism[];
};
export type VideoReading = { assetId: string; durationMs: number | null; scenes: VideoScene[] };

export type VideoCoverage =
  | { assetId: string; state: "read"; scenes: number }
  | { assetId: string; state: "skipped"; reason: "too_large" | "too_long" | "unknown_size" | "over_limit" | "object_missing" | "read_failed" };

export type VideoAssetRow = { asset_id: string; mime: string; bytes: number | null; duration_ms: number | null };

export function videoReadEligibility(row: VideoAssetRow, index: number): { eligible: true } | { eligible: false; reason: Extract<VideoCoverage, { state: "skipped" }>["reason"] } {
  if (index >= VIDEO_READ_MAX_VIDEOS) return { eligible: false, reason: "over_limit" };
  const bytes = Number(row.bytes);
  if (!Number.isFinite(bytes) || bytes <= 0) return { eligible: false, reason: "unknown_size" };
  if (bytes > VIDEO_READ_MAX_BYTES) return { eligible: false, reason: "too_large" };
  const duration = Number(row.duration_ms);
  if (Number.isFinite(duration) && duration > VIDEO_READ_MAX_DURATION_MS) return { eligible: false, reason: "too_long" };
  return { eligible: true };
}

const placeProperties = Object.fromEntries(PLACE_SLOTS.map((slot) => [slot, { type: "string", enum: PLACE_TERMS[slot].map(([code]) => code) }]));
const FEATURE_CODES = FEATURE_TERMS.map(([code]) => code).filter((code) => code !== "unknown_feature");

export const VIDEO_SCENES_SCHEMA = {
  type: "object",
  properties: {
    scenes: {
      type: "array", maxItems: VIDEO_READ_MAX_SCENES,
      items: {
        type: "object",
        properties: {
          start_sec: { type: "number", minimum: 0 },
          end_sec: { type: "number", minimum: 0 },
          assessment_state: { type: "string", enum: ["informative", "not_informative", "not_assessable"] },
          ...placeProperties,
          feature_kinds: { type: "array", maxItems: 6, items: { type: "string", enum: FEATURE_CODES } },
          organisms: {
            type: "array", maxItems: VIDEO_READ_MAX_ORGANISMS,
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                scientific_name: { type: "string" },
                rank: { type: "string", enum: ["species", "genus", "family", "order", "class", "lifeform", "unknown"] },
                confidence: { type: "number", minimum: 0, maximum: 1 },
              },
              required: ["name", "scientific_name", "rank", "confidence"],
            },
          },
        },
        required: ["start_sec", "end_sec", "assessment_state", ...PLACE_SLOTS, "feature_kinds", "organisms"],
      },
    },
  },
  required: ["scenes"],
} as const;

export function buildVideoSceneRequest(recordId: string, video: GeminiObservationImage, durationMs: number | null) {
  const length = durationMs && durationMs > 0 ? `動画の長さは約${(durationMs / 1000).toFixed(1)}秒です。` : "";
  const prompt = `公開された市民科学の観察動画を、見えている内容が変わる区切り（シーン）に分けて読み取ってください。\n記録ID:${recordId}\n${length}\n最大${VIDEO_READ_MAX_SCENES}シーン。start_secとend_secは動画の先頭からの秒数（小数1桁、動画の長さを超えない、end_secはstart_secより後）。各シーンについて、${PHOTO_READING_INSTRUCTION.replace(/^photosには、写真1枚ごとに1件ずつ、その写真だけから/u, "そのシーンだけから")}\n生きものが見えるシーンだけ、organismsにそのシーンで確かに見える生きもの（和名、分かる階級まで。種の決め手が見えなければ属・科で止める）を入れます。人・声・音声の内容は書かず、見えない生きものを足しません。生きものがいなければorganismsは空配列です。日本語、JSONのみを返してください。`;
  return {
    contents: [{ role: "user", parts: [{ inlineData: { mimeType: video.mimeType, data: video.base64Data } }, { text: prompt }] }],
    generationConfig: { maxOutputTokens: 3072, responseMimeType: "application/json", responseJsonSchema: VIDEO_SCENES_SCHEMA, thinkingConfig: { thinkingLevel: "minimal" } },
  };
}

const RANKS = new Set(["species", "genus", "family", "order", "class", "lifeform", "unknown"]);
const NAME_CLEAN = (value: unknown, max: number): string | null => (typeof value === "string" && value.trim() ? value.trim().replace(/\s+/gu, " ").slice(0, max) : null);

export function parseVideoScenes(text: string, durationMs: number | null): VideoScene[] {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return []; }
  const raw = parsed && typeof parsed === "object" ? (parsed as { scenes?: unknown }).scenes : null;
  if (!Array.isArray(raw)) return [];
  const known = typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs > 0 ? durationMs : null;
  const seen = new Set<string>();
  const scenes: VideoScene[] = [];
  for (const entry of raw.slice(0, VIDEO_READ_MAX_SCENES)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const source = entry as Record<string, unknown>;
    if (typeof source.start_sec !== "number" || typeof source.end_sec !== "number" || !Number.isFinite(source.start_sec) || !Number.isFinite(source.end_sec)) continue;
    const startMs = Math.round(source.start_sec * 1000);
    let endMs = Math.round(source.end_sec * 1000);
    if (known !== null && endMs > known && endMs <= known + END_TOLERANCE_MS) endMs = known;
    const range = validTimeRange({ startMs, endMs }, known);
    if (!range || range.endMs - range.startMs < MIN_SCENE_MS) continue;
    const key = `${range.startMs}-${range.endMs}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const [reading] = parseGeminiPhotoReadings([{ ...source, asset_index: 0 }]);
    const organisms: VideoOrganism[] = [];
    for (const item of Array.isArray(source.organisms) ? source.organisms.slice(0, VIDEO_READ_MAX_ORGANISMS) : []) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const organism = item as Record<string, unknown>;
      const name = NAME_CLEAN(organism.name, 120);
      if (!name || /^(ヒト|人間|人物|人|人影)$/u.test(name)) continue;
      const confidence = Number(organism.confidence);
      organisms.push({
        name,
        scientific: NAME_CLEAN(organism.scientific_name, 180),
        rank: typeof organism.rank === "string" && RANKS.has(organism.rank) ? organism.rank as VideoOrganism["rank"] : "unknown",
        confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
      });
    }
    scenes.push({ range, assessmentState: reading?.assessment_state ?? "not_assessable", fields: reading?.fields ?? {}, featureKinds: reading?.feature_kinds ?? [], organisms });
  }
  return scenes.sort((left, right) => left.range.startMs - right.range.startMs || left.range.endMs - right.range.endMs);
}

export type VideoReadingInputs = {
  mediaIds: string[];
  mediaMeta: ReadingMediaMeta[];
  features: ReadingFeatureInput[];
  place: ReadingPlaceInput[];
  subjects: ObservationAiSubjectCandidate[];
};

const nameKey = (value: string | null): string => (value ?? "").normalize("NFKC").toLowerCase().replace(/\s+/gu, "");

export function videoReadingInputs(readings: readonly VideoReading[], imageMediaIds: readonly string[], existing: readonly ObservationAiSubjectCandidate[] = []): VideoReadingInputs {
  const mediaIds: string[] = [];
  const mediaMeta: ReadingMediaMeta[] = [];
  const features: ReadingFeatureInput[] = [];
  const place: ReadingPlaceInput[] = [];
  const subjects: ObservationAiSubjectCandidate[] = [];
  const takenNames = new Set(existing.flatMap((subject) => [nameKey(subject.vernacularName), nameKey(subject.scientificName)]).filter(Boolean));
  for (const reading of readings) {
    if (reading.scenes.length === 0) continue;
    const assetIndex = imageMediaIds.length + mediaIds.length;
    mediaIds.push(reading.assetId);
    mediaMeta.push({ durationMs: reading.durationMs });
    const best = new Map<string, { organism: VideoOrganism; range: ReadingTimeRange }>();
    for (const scene of reading.scenes) {
      const seenKinds = new Set<string>();
      for (const kind of scene.featureKinds) if (!seenKinds.has(kind)) { seenKinds.add(kind); features.push({ kind, assetIndex, timeRange: scene.range }); }
      place.push({ assetIndex, timeRange: scene.range, fields: scene.fields as GeminiEnvironmentFields, assessmentState: scene.assessmentState, scope: "photo" });
      for (const organism of scene.organisms) {
        const key = nameKey(organism.scientific) || nameKey(organism.name);
        const longer = (range: ReadingTimeRange) => range.endMs - range.startMs;
        const current = best.get(key);
        if (!current || longer(scene.range) > longer(current.range)) best.set(key, { organism, range: scene.range });
      }
    }
    for (const { organism, range } of best.values()) {
      if (subjects.length >= VIDEO_READ_MAX_ORGANISMS) break;
      const keys = [nameKey(organism.name), nameKey(organism.scientific)].filter(Boolean);
      if (keys.some((key) => takenNames.has(key))) continue;
      keys.forEach((key) => takenNames.add(key));
      subjects.push({
        candidateKey: `video:${reading.assetId}:${keys[0]}`.slice(0, 80),
        vernacularName: organism.name, scientificName: organism.scientific, rank: organism.rank, confidence: Math.min(organism.confidence, 0.6),
        visualEvidence: [], needsMoreEvidence: [], assetIndex, assetIndices: [assetIndex], sourceModel: VIDEO_READ_MODEL, subjectLocator: { timeRange: range },
      });
    }
  }
  return { mediaIds, mediaMeta, features, place, subjects };
}

export function candidateWithVideoSubjects(candidate: ObservationAiCandidate, subjects: readonly ObservationAiSubjectCandidate[]): ObservationAiCandidate {
  return subjects.length === 0 ? candidate : { ...candidate, coexistingSubjects: [...candidate.coexistingSubjects, ...subjects] };
}

const LEGACY_VALUES: Record<keyof GeminiEnvironmentFields, readonly string[]> = {
  place_type: ["grassland_urban_edge", "urban", "woodland", "water_edge", "wetland", "coast"],
  contact_surface: ["soil_gravel_litter", "soil", "plant", "water", "rock", "artificial"],
  surrounding_cover: ["low_grass", "trees_shrubs", "bare_ground", "water", "snow", "built_surface"],
  environment_condition: ["open_dry", "sunny", "shaded", "wet", "flowing", "windy"],
  human_change: ["trampling_mowing", "mowing", "trampling", "planting", "construction", "none_visible"],
};

export function mergedFromVideoReadings(readings: readonly VideoReading[]): GeminiMergedObservation {
  const scenes = readings.flatMap((reading) => reading.scenes);
  const informative = scenes.some((scene) => scene.assessmentState === "informative");
  const longest = [...scenes].sort((left, right) => (right.range.endMs - right.range.startMs) - (left.range.endMs - left.range.startMs))[0];
  const fields = Object.fromEntries((Object.keys(LEGACY_VALUES) as Array<keyof GeminiEnvironmentFields>).map((slot) => {
    const value = longest?.fields[slot];
    return [slot, value && LEGACY_VALUES[slot].includes(value) ? value : "unknown"];
  })) as GeminiEnvironmentFields;
  const subjects = [...videoReadingInputs(readings, []).subjects].sort((left, right) => right.confidence - left.confidence);
  const [primary, ...others] = subjects;
  return {
    candidate: primary
      ? { ...primary, nonBiological: false, coexistingSubjects: others }
      : { candidateKey: null, vernacularName: null, scientificName: null, rank: "unknown", confidence: 0, visualEvidence: [], needsMoreEvidence: [], subjectLocator: {}, sourceModel: VIDEO_READ_MODEL, nonBiological: true, coexistingSubjects: [] },
    topCandidates: [],
    genericCandidateOnly: false,
    candidateFusionRuleVersion: GEMINI_CANDIDATE_FUSION_RULE_VERSION,
    recordClass: primary ? "organism" : "environment",
    informationState: informative ? "informative" : "not_informative",
    detectionState: primary ? "detected" : informative ? "not_detected" : "not_assessable",
    environment: { assessment_state: informative ? "informative" : "not_informative", fields, cues: [], uncertain_cues: [], photos: [] },
    relations: [], qualityFlags: ["video_only"], needsReview: Boolean(primary), reviewReasons: [], specialistEscalation: null, summary: null,
  };
}

export type VideoAssetSource = VideoAssetRow & { object_key: string };
export type VideoReadDeps = {
  fetchBytes: (objectKey: string) => Promise<ArrayBuffer | null>;
  toBase64: (bytes: ArrayBuffer) => string;
  generate: (request: Record<string, unknown>) => Promise<string>;
};
export type VideoReadResult = { readings: VideoReading[]; coverage: VideoCoverage[] };

export async function readVideos(recordId: string, rows: readonly VideoAssetSource[], deps: VideoReadDeps): Promise<VideoReadResult> {
  const readings: VideoReading[] = [];
  const coverage: VideoCoverage[] = [];
  for (const [index, row] of rows.entries()) {
    const gate = videoReadEligibility(row, index);
    if (!gate.eligible) { coverage.push({ assetId: row.asset_id, state: "skipped", reason: gate.reason }); continue; }
    const durationMs = Number.isFinite(Number(row.duration_ms)) && Number(row.duration_ms) > 0 ? Number(row.duration_ms) : null;
    try {
      const bytes = await deps.fetchBytes(row.object_key);
      if (!bytes || bytes.byteLength === 0) { coverage.push({ assetId: row.asset_id, state: "skipped", reason: "object_missing" }); continue; }
      if (bytes.byteLength > VIDEO_READ_MAX_BYTES) { coverage.push({ assetId: row.asset_id, state: "skipped", reason: "too_large" }); continue; }
      const text = await deps.generate(buildVideoSceneRequest(recordId, { assetId: row.asset_id, mimeType: row.mime || "video/mp4", base64Data: deps.toBase64(bytes) }, durationMs));
      const scenes = parseVideoScenes(text, durationMs);
      if (scenes.length === 0) { coverage.push({ assetId: row.asset_id, state: "skipped", reason: "read_failed" }); continue; }
      readings.push({ assetId: row.asset_id, durationMs, scenes });
      coverage.push({ assetId: row.asset_id, state: "read", scenes: scenes.length });
    } catch {
      coverage.push({ assetId: row.asset_id, state: "skipped", reason: "read_failed" });
    }
  }
  return { readings, coverage };
}
