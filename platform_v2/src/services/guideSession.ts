import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "../db.js";
import { generateAiTextWithRoleChain, type AiRouterPart } from "./aiModelRouter.js";
import { canonicalizeSpeciesFeatures, canonicalizeTaxonList } from "./guideRecordInsights.js";
import { isLikelyGuideNonBiologicalName } from "./guideNonBiological.js";
import { refreshGuideSessionPublicSummaryForSession } from "./guideSessionPublicSummary.js";
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
  frameBundleSummary?: string | null;
  effortSummary?: string | null;
  coverageSummary?: string | null;
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
  newSignals?: string[];
  continuedSignals?: string[];
  coverageHints?: string[];
  absenceBoundary?: {
    state: "non_detection_note" | "searched_not_found" | "absence_candidate";
    note: string;
  };
  isNew: boolean;
  sceneHash: string;
  visualExtractModel?: string;
  textModel?: string;
};

export type GuideFrameInput = {
  frameBase64: string;
  mimeType?: string | null;
  capturedAt?: string | null;
  lat?: number | null;
  lng?: number | null;
  accuracyM?: number | null;
  speedMps?: number | null;
  headingDegrees?: number | null;
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

function normalizeGuideAudioMimeType(raw: unknown): string {
  if (typeof raw !== "string") return "audio/webm";
  const value = raw.trim().toLowerCase();
  if (/^audio\/(?:webm|ogg|mp4|mpeg|mp3|wav|aac|flac|pcm)(?:;codecs=[a-z0-9.+-]+)?$/.test(value)) {
    return value;
  }
  return "audio/webm";
}

function buildGuideVisualExtractPrompt(prompt: string): string {
  return `${prompt}

この段階は視覚解析専用です。添付された画像フレーム束だけを読み、画像生成・画像編集は行わないでください。
音声は次段階で扱うため、ここでは画像に写っている視覚事実、フレーム間の変化、継続して見えている環境手がかりだけを抽出してください。
JSON スキーマは最終出力と同じ形を使ってよいですが、判断を盛らず、見えている根拠と不確実性を優先してください。

JSON のみ出力。コードブロックやコメントは不要。`;
}

function buildGuideTextIntegrationPrompt(prompt: string, visualExtractText: string): string {
  return `${prompt}

以下は Gemini 3.1 Flash Image Preview による視覚解析結果です。この段階では、画像を再解析せず、視覚解析結果と添付されている場合の自然音候補だけを統合してください。

視覚解析結果:
${visualExtractText.slice(0, 12000)}

最終的な guide scene JSON を作ってください。summary、environmentContext、seasonalNote、newSignals、continuedSignals、coverageHints、absenceBoundary、saveRecommendation は、野外で何が言えるようになったかが分かる密度に整えてください。特に努力量、エリア網羅、探したが見つからなかった情報は、短く削らず、記録価値や不足の判断に使ってください。
ただし、視覚解析結果にない種名や断定的な不在は追加しないでください。

JSON のみ出力。コードブロックやコメントは不要。`;
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

/**
 * Analyse a scene from a video frame (+ optional audio) using Gemini.
 * Returns structured scene data and whether this is a new scene (dedup check).
 */
export async function analyzeScene(opts: {
  frameBase64?: string;
  frames?: GuideFrameInput[];
  audioBase64?: string | null;
  audioMimeType?: string | null;
  frameMimeType?: string;
  context: SceneContext;
}): Promise<SceneResult> {
  const frames = (Array.isArray(opts.frames) && opts.frames.length > 0
    ? opts.frames
    : (opts.frameBase64 ? [{ frameBase64: opts.frameBase64, mimeType: opts.frameMimeType ?? "image/jpeg", capturedAt: opts.context.capturedAt ?? null }] : []))
    .filter((frame) => typeof frame.frameBase64 === "string" && frame.frameBase64.length > 0)
    .slice(-4);
  if (!frames.length) throw new Error("frameBase64 is required");

  const visualParts: AiRouterPart[] = frames.map((frame) => ({
    inlineData: {
      mimeType: frame.mimeType ?? opts.frameMimeType ?? "image/jpeg",
      data: frame.frameBase64,
    },
  }));

  const season = opts.context.season ?? guessSeason(opts.context.capturedAt);
  const guideMode = normalizeGuideMode(opts.context.guideMode);
  const prompt = renderPrompt({
    lat: opts.context.lat.toFixed(5),
    lng: opts.context.lng.toFixed(5),
    capturedAt: opts.context.capturedAt ?? "不明",
    azimuth: opts.context.azimuth != null ? `${opts.context.azimuth.toFixed(0)}°` : "不明",
    season,
    siteBriefLabel: opts.context.siteBriefLabel ?? "不明",
    frameBundleSummary: opts.context.frameBundleSummary ?? summarizeFrameBundleForPrompt(frames),
    effortSummary: opts.context.effortSummary ?? "不明",
    coverageSummary: opts.context.coverageSummary ?? "不明",
    guideMode: guideMode === "vehicle" ? "車・電車・バス・新幹線・自転車などの移動中モード" : "徒歩・立ち止まり観察モード",
    guideModeRules: guideMode === "vehicle"
      ? "移動中なので、その場で次に見る行動を促さない。車・電車・バス・新幹線・自転車などから確実に読める植生帯、街路樹、草刈り、農地、水路、林縁、道路際、土地利用の変化を通過ログとして優先する。看板・ロゴ・車名・店舗名を生きものとして扱わない。種名は画像上で生物個体が明確な場合だけ返す。"
      : "徒歩観察でも、種名だけに寄せず、植生・土地被覆・管理痕跡・水辺・林縁を同じ重さで扱う。看板・ロゴ・車名・店舗名を生きものとして扱わない。",
  });

  visualParts.push({ text: buildGuideVisualExtractPrompt(prompt) });

  const visualExtract = await generateAiTextWithRoleChain({
    chainName: "guideScene",
    parts: visualParts,
    retriesPerModel: 1,
    cost: {
      layer: "hot",
      endpoint: "guide_scene_visual_extract",
      userId: opts.context.userId ?? null,
      metadata: { guideMode, frameCount: frames.length },
    },
  });

  const textParts: AiRouterPart[] = [];
  if (opts.audioBase64) {
    textParts.push({
      inlineData: {
        mimeType: normalizeGuideAudioMimeType(opts.audioMimeType),
        data: opts.audioBase64,
      },
    });
  }
  textParts.push({ text: buildGuideTextIntegrationPrompt(prompt, visualExtract.text) });

  const response = await generateAiTextWithRoleChain({
    chainName: "guideSceneText",
    parts: textParts,
    responseMimeType: "application/json",
    retriesPerModel: 1,
    cost: {
      layer: "hot",
      endpoint: "guide_scene_text",
      userId: opts.context.userId ?? null,
      metadata: {
        guideMode,
        frameCount: frames.length,
        visualExtractModel: `${visualExtract.provider}:${visualExtract.model}`,
      },
    },
  });
  const rawText = response.text || "{}";
  let parsed: {
    summary?: string;
    detectedSpecies?: string[];
    detectedFeatures?: DetectedFeature[];
    primarySubject?: PrimarySubject;
    environmentContext?: string;
    seasonalNote?: string;
    coexistingTaxa?: string[];
    saveRecommendation?: GuideSceneSaveRecommendation;
    newSignals?: string[];
    continuedSignals?: string[];
    coverageHints?: string[];
    absenceBoundary?: unknown;
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
  const newSignals = normalizeStringList(parsed.newSignals, 8);
  const continuedSignals = normalizeStringList(parsed.continuedSignals, 8);
  const coverageHints = normalizeStringList(parsed.coverageHints, 8);
  const absenceBoundary = normalizeAbsenceBoundary(parsed.absenceBoundary);

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
    newSignals,
    continuedSignals,
    coverageHints,
    absenceBoundary,
    isNew,
    sceneHash,
    visualExtractModel: `${visualExtract.provider}:${visualExtract.model}`,
    textModel: `${response.provider}:${response.model}`,
  };
}

function summarizeFrameBundleForPrompt(frames: GuideFrameInput[]): string {
  return frames.map((frame, index) => {
    const parts = [
      `#${index + 1}`,
      frame.capturedAt ? `time=${frame.capturedAt}` : null,
      Number.isFinite(frame.lat) && Number.isFinite(frame.lng) ? `lat=${Number(frame.lat).toFixed(5)} lng=${Number(frame.lng).toFixed(5)}` : null,
      Number.isFinite(frame.accuracyM) ? `accuracy=${Number(frame.accuracyM).toFixed(0)}m` : null,
      Number.isFinite(frame.speedMps) ? `speed=${Number(frame.speedMps).toFixed(1)}m/s` : null,
      Number.isFinite(frame.headingDegrees) ? `heading=${Number(frame.headingDegrees).toFixed(0)}deg` : null,
    ].filter(Boolean);
    return parts.join(" ");
  }).join(" / ");
}

function normalizeStringList(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => typeof item === "string" ? item.trim() : "")
    .filter(Boolean)
    .slice(0, max);
}

function normalizeAbsenceBoundary(raw: unknown): SceneResult["absenceBoundary"] | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const value = raw as Record<string, unknown>;
  const state = value.state === "searched_not_found" || value.state === "absence_candidate"
    ? value.state
    : value.state === "confirmed_absence"
      ? "absence_candidate"
      : "non_detection_note";
  const note = typeof value.note === "string" && value.note.trim()
    ? value.note.trim().slice(0, 220)
    : "通過中のAI未検出であり、確定不在ではありません。";
  return { state, note };
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
      if (input.userId) {
        await refreshGuideSessionPublicSummaryForSession(input.userId, input.sessionId).catch(() => []);
      }
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
