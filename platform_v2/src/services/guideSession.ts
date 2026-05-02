import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import { loadConfig } from "../config.js";
import { getPool } from "../db.js";
import { canonicalizeSpeciesFeatures, canonicalizeTaxonList } from "./guideRecordInsights.js";
import { isLikelyGuideNonBiologicalName } from "./guideNonBiological.js";
import type { TtsLang } from "./guideTts.js";

export type GuideMode = "walk" | "vehicle";

export type SceneContext = {
  lat: number;
  lng: number;
  lang: TtsLang;
  sessionId: string;
  guideMode?: GuideMode;
  userId?: string | null;
  siteBriefLabel?: string | null;
  siteBriefSignals?: Record<string, unknown> | null;
  season?: string | null;
  /** EXIF 撮影日時 ISO 8601。画像アップロード時に EXIF から抽出した値を渡す。 */
  capturedAt?: string | null;
  /** EXIF 方位角（0-360、北=0）。 */
  azimuth?: number | null;
};

export type GuideSceneSaveRecommendation = {
  decision: "save" | "skip";
  confidence?: number;
  reasonCodes?: string[];
  note?: string;
};

export type DetectedFeature = {
  type: "species" | "vegetation" | "landform" | "structure" | "sound";
  name: string;
  confidence?: number;
  note?: string;
};

export type PrimarySubject = {
  name: string;
  rank: "species" | "genus" | "family" | "lifeform" | "unknown";
  confidence: number;
};

export type SceneResult = {
  summary: string;
  detectedSpecies: string[];
  detectedFeatures: DetectedFeature[];
  primarySubject?: PrimarySubject;
  environmentContext?: string;
  seasonalNote?: string;
  coexistingTaxa?: string[];
  saveRecommendation?: GuideSceneSaveRecommendation;
  isNew: boolean;
  sceneHash: string;
};

function isVehicleModeCoarseVegetationName(name: string): boolean {
  return /街路樹|植栽|樹木|樹列|草地|雑草|草本|植物|生垣|低木|林縁/u.test(name);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = resolve(__dirname, "../prompts/guide_scene.md");
let CACHED_PROMPT_TEMPLATE: string | null = null;

function loadPromptTemplate(): string {
  if (CACHED_PROMPT_TEMPLATE !== null) return CACHED_PROMPT_TEMPLATE;
  try {
    CACHED_PROMPT_TEMPLATE = readFileSync(PROMPT_PATH, "utf-8");
  } catch (err) {
    // プロンプトファイルがないと Gemini 呼び出しが無意味な応答になるので明示的に失敗。
    throw new Error(`guide_scene.md not found at ${PROMPT_PATH}: ${(err as Error).message}`);
  }
  return CACHED_PROMPT_TEMPLATE;
}

function renderPrompt(vars: Record<string, string>): string {
  let out = loadPromptTemplate();
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`\${${key}}`).join(value);
  }
  return out;
}

function normalizeGuideMode(raw: unknown): GuideMode {
  return raw === "vehicle" ? "vehicle" : "walk";
}

export function sanitizeGuideSceneResult(parsed: {
  summary?: string;
  detectedSpecies?: string[];
  detectedFeatures?: DetectedFeature[];
  primarySubject?: PrimarySubject;
  environmentContext?: string;
  seasonalNote?: string;
  coexistingTaxa?: string[];
}, guideMode: GuideMode): {
  summary: string;
  detectedSpecies: string[];
  detectedFeatures: DetectedFeature[];
  primarySubject?: PrimarySubject;
  environmentContext?: string;
  seasonalNote?: string;
  coexistingTaxa?: string[];
} {
  const rawFeatures = Array.isArray(parsed.detectedFeatures) ? parsed.detectedFeatures : [];
  const contextText = [
    parsed.summary,
    parsed.environmentContext,
    parsed.seasonalNote,
    ...rawFeatures.map((feature) => `${feature.name} ${feature.note ?? ""}`),
  ].filter(Boolean).join(" ");
  const detectedFeatures = rawFeatures
    .filter((feature) => feature && typeof feature.name === "string" && feature.name.trim())
    .map((feature) => {
      const featureContext = `${feature.name} ${feature.note ?? ""} ${contextText}`;
      if (feature.type === "species" && isLikelyGuideNonBiologicalName(feature.name, featureContext)) {
        return { ...feature, type: "structure" as const, note: feature.note ?? "看板・文字・車両などの人工物として扱います" };
      }
      if (guideMode === "vehicle" && feature.type === "species" && isVehicleModeCoarseVegetationName(feature.name)) {
        return { ...feature, type: "vegetation" as const, note: feature.note ?? "車窓では種名ではなく植生手がかりとして扱います" };
      }
      return feature;
    });
  const speciesFromFeatures = detectedFeatures
    .filter((feature) => feature.type === "species" && (feature.confidence ?? 0) >= (guideMode === "vehicle" ? 0.72 : 0.55))
    .map((feature) => feature.name.trim())
    .filter((name) => !isLikelyGuideNonBiologicalName(name, contextText));
  const speciesFromModel = Array.isArray(parsed.detectedSpecies) ? parsed.detectedSpecies : [];
  const detectedSpecies = Array.from(new Set([...speciesFromFeatures, ...speciesFromModel]
    .map((name) => String(name).trim())
    .filter((name) => name && !isLikelyGuideNonBiologicalName(name, contextText))
    .filter((name) => guideMode !== "vehicle" || !isVehicleModeCoarseVegetationName(name))))
    .slice(0, guideMode === "vehicle" ? 2 : 6);
  const primarySubject = parsed.primarySubject &&
    typeof parsed.primarySubject.name === "string" &&
    detectedSpecies.includes(parsed.primarySubject.name) &&
    parsed.primarySubject.confidence >= (guideMode === "vehicle" ? 0.72 : 0.5)
      ? parsed.primarySubject
      : undefined;
  const vegetationOrContext = detectedFeatures.some((feature) => feature.type === "vegetation" || feature.type === "landform" || feature.type === "structure");
  const summary = typeof parsed.summary === "string" && parsed.summary.trim()
    ? parsed.summary
    : vegetationOrContext
      ? "植生・土地利用・水辺や道路際の状態を手がかりとして記録します。"
      : "";
  const coexistingTaxa = Array.isArray(parsed.coexistingTaxa)
    ? parsed.coexistingTaxa.map(String).filter((name) => !isLikelyGuideNonBiologicalName(name, contextText)).slice(0, 8)
    : undefined;
  return {
    summary,
    detectedSpecies,
    detectedFeatures,
    primarySubject,
    environmentContext: typeof parsed.environmentContext === "string" ? parsed.environmentContext : undefined,
    seasonalNote: typeof parsed.seasonalNote === "string" ? parsed.seasonalNote : undefined,
    coexistingTaxa,
  };
}

export type GuideRecordInput = {
  sessionId: string;
  userId?: string | null;
  occurrenceId?: string | null;
  lat: number;
  lng: number;
  capturedAt?: string | null;
  returnedAt?: string | null;
  currentDistanceM?: number | null;
  deliveryState?: "pending" | "ready" | "surfaced" | "deferred" | "archived";
  seenState?: "unseen" | "seen" | "dismissed" | "saved";
  frameThumb?: string | null;
  sceneHash: string;
  sceneSummary: string;
  detectedSpecies: string[];
  detectedFeatures: DetectedFeature[];
  primarySubject?: PrimarySubject | null;
  environmentContext?: string | null;
  seasonalNote?: string | null;
  coexistingTaxa?: string[] | null;
  confidenceContext?: Record<string, unknown> | null;
  mediaRefs?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
  ttsScript?: string | null;
  lang: TtsLang;
};

// In-process dedup store: sessionId → Map<sceneHash, lastSeenMs>
// メモリリーク対策: DEDUP_SESSION_TTL_MS を超えた session は定期的に削除される。
// 各 session 内の scene hash は DEDUP_COOLDOWN_MS を超えたら dedup 対象外になる。
const dedupStore = new Map<string, Map<string, number>>();
const DEDUP_COOLDOWN_MS = 30_000;
const DEDUP_SESSION_TTL_MS = 6 * 60 * 60 * 1000; // 6時間無操作の session は破棄
const DEDUP_GC_INTERVAL_MS = 15 * 60 * 1000; // 15分ごとに掃除
const DEDUP_MAX_SESSIONS = 5_000; // 過剰流入時の上限

let lastDedupGc = Date.now();

function runDedupGc(): void {
  const now = Date.now();
  if (now - lastDedupGc < DEDUP_GC_INTERVAL_MS && dedupStore.size < DEDUP_MAX_SESSIONS) return;
  lastDedupGc = now;
  for (const [sid, sessionMap] of dedupStore) {
    // session 内で最後に見た時刻
    let maxSeen = 0;
    for (const t of sessionMap.values()) if (t > maxSeen) maxSeen = t;
    if (now - maxSeen > DEDUP_SESSION_TTL_MS) {
      dedupStore.delete(sid);
      continue;
    }
    // session 内の古い hash を削除
    for (const [hash, t] of sessionMap) {
      if (now - t > DEDUP_COOLDOWN_MS * 10) sessionMap.delete(hash);
    }
  }
  // 上限超過時は古い順に落とす（粗い FIFO: Map は insertion order 保持）
  while (dedupStore.size > DEDUP_MAX_SESSIONS) {
    const first = dedupStore.keys().next().value;
    if (first === undefined) break;
    dedupStore.delete(first);
  }
}

function checkDedup(sessionId: string, sceneHash: string): boolean {
  runDedupGc();
  let sessionMap = dedupStore.get(sessionId);
  if (!sessionMap) {
    sessionMap = new Map();
    dedupStore.set(sessionId, sessionMap);
  }
  const lastSeen = sessionMap.get(sceneHash) ?? 0;
  const now = Date.now();
  if (now - lastSeen < DEDUP_COOLDOWN_MS) return false;
  sessionMap.set(sceneHash, now);
  return true;
}

function getClient(): GoogleGenAI {
  const config = loadConfig();
  if (!config.geminiApiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey: config.geminiApiKey });
}

/**
 * Analyse a scene from a video frame (+ optional audio) using Gemini.
 * Returns structured scene data and whether this is a new scene (dedup check).
 */
export async function analyzeScene(opts: {
  frameBase64: string;
  audioBase64?: string | null;
  frameMimeType?: string;
  context: SceneContext;
}): Promise<SceneResult> {
  const ai = getClient();

  const parts: Array<Record<string, unknown>> = [
    {
      inlineData: {
        mimeType: opts.frameMimeType ?? "image/jpeg",
        data: opts.frameBase64,
      },
    },
  ];

  if (opts.audioBase64) {
    parts.push({
      inlineData: {
        mimeType: "audio/pcm",
        data: opts.audioBase64,
      },
    });
  }

  const season = opts.context.season ?? guessSeason(opts.context.capturedAt);
  const guideMode = normalizeGuideMode(opts.context.guideMode);
  const prompt = renderPrompt({
    lat: opts.context.lat.toFixed(5),
    lng: opts.context.lng.toFixed(5),
    capturedAt: opts.context.capturedAt ?? "不明",
    azimuth: opts.context.azimuth != null ? `${opts.context.azimuth.toFixed(0)}°` : "不明",
    season,
    siteBriefLabel: opts.context.siteBriefLabel ?? "不明",
    guideMode: guideMode === "vehicle" ? "車・自転車などの移動中モード" : "徒歩・立ち止まり観察モード",
    guideModeRules: guideMode === "vehicle"
      ? "移動中なので種同定を主目的にしない。車窓から確実に読める植生帯、街路樹、草刈り、農地、水路、林縁、道路際、土地利用の変化を優先する。看板・ロゴ・車名・店舗名を生きものとして扱わない。種名は画像上で生物個体が明確な場合だけ返す。"
      : "徒歩観察でも、種名だけに寄せず、植生・土地被覆・管理痕跡・水辺・林縁を同じ重さで扱う。看板・ロゴ・車名・店舗名を生きものとして扱わない。",
  });

  parts.push({ text: prompt });

  // Primary: gemini-3.1-flash-lite-preview (ユーザー指定の基本モデル)
  // Fallback: gemini-2.5-flash-lite (503/UNAVAILABLE 時)
  // 3.1-flash-lite-preview は Preview で quota 限定のため現在 503 が頻発する。
  // 一時障害時に guide/scene 全体が止まらないよう自動フォールバック。
  const MODELS = ["gemini-3.1-flash-lite-preview", "gemini-2.5-flash-lite"];
  let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
  let lastErr: unknown = null;
  for (const model of MODELS) {
    try {
      response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
      });
      break;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      // 503/UNAVAILABLE/RESOURCE_EXHAUSTED は fallback
      if (!/503|UNAVAILABLE|RESOURCE_EXHAUSTED|rate|quota/i.test(msg)) throw err;
    }
  }
  if (!response) throw lastErr ?? new Error("gemini_all_models_failed");

  const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  let parsed: {
    summary?: string;
    detectedSpecies?: string[];
    detectedFeatures?: DetectedFeature[];
    primarySubject?: PrimarySubject;
    environmentContext?: string;
    seasonalNote?: string;
    coexistingTaxa?: string[];
    saveRecommendation?: GuideSceneSaveRecommendation;
  } = {};
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch {
    parsed = {};
  }

  const sanitized = sanitizeGuideSceneResult({
    ...parsed,
    summary: parsed.summary ?? rawText.slice(0, 120),
  }, guideMode);
  const summary = sanitized.summary;
  const detectedSpecies = sanitized.detectedSpecies;
  const detectedFeatures = sanitized.detectedFeatures;
  const primarySubject = sanitized.primarySubject;
  const environmentContext = sanitized.environmentContext;
  const seasonalNote = sanitized.seasonalNote;
  const coexistingTaxa = sanitized.coexistingTaxa;
  const saveRecommendation = normalizeSaveRecommendation(parsed.saveRecommendation);

  const sceneHash = createHash("sha256")
    .update(detectedSpecies.sort().join(",") + detectedFeatures.map((f) => f.name).sort().join(","))
    .digest("hex")
    .slice(0, 16);

  const isNew = checkDedup(opts.context.sessionId, sceneHash);

  return {
    summary,
    detectedSpecies,
    detectedFeatures,
    primarySubject,
    environmentContext,
    seasonalNote,
    coexistingTaxa,
    saveRecommendation,
    isNew,
    sceneHash,
  };
}

function normalizeSaveRecommendation(raw: unknown): GuideSceneSaveRecommendation | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as Record<string, unknown>;
  const decision = value.decision === "save" || value.decision === "skip" ? value.decision : null;
  if (!decision) return undefined;
  const confidence = Number(value.confidence);
  return {
    decision,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : undefined,
    reasonCodes: Array.isArray(value.reasonCodes)
      ? value.reasonCodes.filter((item): item is string => typeof item === "string").slice(0, 8)
      : undefined,
    note: typeof value.note === "string" ? value.note.slice(0, 160) : undefined,
  };
}

/** Persist a guide record to the database. Returns the guide_record_id. */
export async function saveGuideRecord(input: GuideRecordInput): Promise<string> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const canonicalTaxa = canonicalizeTaxonList(input.detectedSpecies);
    const detectedSpecies = canonicalTaxa.map((item) => item.canonicalName);
    const detectedFeatures = canonicalizeSpeciesFeatures(input.detectedFeatures) as DetectedFeature[];
    const meta = {
      ...(input.meta ?? {}),
      guideTaxonCanonicalization: {
        rawSpecies: input.detectedSpecies,
        canonicalSpecies: canonicalTaxa,
      },
    };
    const result = await client.query<{ guide_record_id: string }>(
      `insert into guide_records
         (session_id, user_id, occurrence_id, lat, lng, scene_hash, scene_summary,
          detected_species, detected_features, tts_script, lang)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
       returning guide_record_id`,
      [
        input.sessionId,
        input.userId ?? null,
        input.occurrenceId ?? null,
        input.lat,
        input.lng,
        input.sceneHash,
        input.sceneSummary,
        detectedSpecies,
        JSON.stringify(detectedFeatures),
        input.ttsScript ?? null,
        input.lang,
      ],
    );
    const guideRecordId = result.rows[0]?.guide_record_id ?? "";

    if (guideRecordId) {
      await client.query(
        `insert into guide_record_latency_states
           (guide_record_id, captured_at, returned_at, current_distance_m, delivery_state, seen_state,
            frame_thumb, primary_subject, environment_context, seasonal_note, coexisting_taxa,
            confidence_context, media_refs, meta)
         values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12::jsonb, $13::jsonb, $14::jsonb)
         on conflict (guide_record_id) do update set
           captured_at = excluded.captured_at,
           returned_at = excluded.returned_at,
           current_distance_m = excluded.current_distance_m,
           delivery_state = excluded.delivery_state,
           seen_state = excluded.seen_state,
           frame_thumb = excluded.frame_thumb,
           primary_subject = excluded.primary_subject,
           environment_context = excluded.environment_context,
           seasonal_note = excluded.seasonal_note,
           coexisting_taxa = excluded.coexisting_taxa,
           confidence_context = excluded.confidence_context,
           media_refs = excluded.media_refs,
           meta = excluded.meta`,
        [
          guideRecordId,
          input.capturedAt ?? null,
          input.returnedAt ?? null,
          input.currentDistanceM ?? null,
          input.deliveryState ?? "ready",
          input.seenState ?? "unseen",
          input.frameThumb ?? null,
          JSON.stringify(input.primarySubject ?? {}),
          input.environmentContext ?? null,
          input.seasonalNote ?? null,
          input.coexistingTaxa ?? [],
          JSON.stringify(input.confidenceContext ?? {}),
          JSON.stringify(input.mediaRefs ?? {}),
          JSON.stringify(meta),
        ],
      );
    }

    return guideRecordId;
  } finally {
    client.release();
  }
}

function guessSeason(capturedAt?: string | null): string {
  const d = capturedAt ? new Date(capturedAt) : new Date();
  const month = (isNaN(d.getTime()) ? new Date() : d).getMonth() + 1;
  if (month >= 3 && month <= 5) return "春";
  if (month >= 6 && month <= 8) return "夏";
  if (month >= 9 && month <= 11) return "秋";
  return "冬";
}
