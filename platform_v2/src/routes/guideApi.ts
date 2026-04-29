import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { getSessionFromCookie } from "../services/authSession.js";
import { decideGuideAutoSave, type GuideAutoSaveDecision } from "../services/guideAutoSave.js";
import { createGuideLiveToken } from "../services/guideLiveToken.js";
import { analyzeScene, saveGuideRecord, type SceneResult } from "../services/guideSession.js";
import { buildGuideScript, generateTts } from "../services/guideTts.js";
import { getSiteBrief, type SiteBrief } from "../services/siteBrief.js";
import type { TtsLang } from "../services/guideTts.js";

const ALLOWED_LANGS: TtsLang[] = ["ja", "en", "es", "pt-BR", "ko", "zh"];

function parseLang(raw: unknown): TtsLang {
  if (typeof raw === "string" && (ALLOWED_LANGS as string[]).includes(raw)) {
    return raw as TtsLang;
  }
  return "ja";
}

type PendingGuideScene = {
  sceneId: string;
  sessionId: string;
  userId: string | null;
  lat: number;
  lng: number;
  lang: TtsLang;
  capturedAt: string;
  requestedAt: string;
  returnedAt: string | null;
  frameThumb: string | null;
  status: "pending" | "ready" | "error";
  result: SceneResult | null;
  autoSave: PendingGuideAutoSave | null;
  error: string | null;
};

type PendingGuideAutoSave =
  | ({ state: "saved"; guideRecordId: string } & GuideAutoSaveDecision)
  | ({ state: "skipped" } & GuideAutoSaveDecision)
  | ({ state: "error"; error: string } & GuideAutoSaveDecision);

const sceneJobs = new Map<string, PendingGuideScene>();
const SCENE_JOB_TTL_MS = 30 * 60 * 1000;
let lastSceneJobGc = Date.now();

function pruneSceneJobs(): void {
  const now = Date.now();
  if (now - lastSceneJobGc < 60_000 && sceneJobs.size < 2_000) return;
  lastSceneJobGc = now;
  for (const [sceneId, job] of sceneJobs) {
    const baseTime = Date.parse(job.returnedAt ?? job.requestedAt);
    if (Number.isFinite(baseTime) && now - baseTime > SCENE_JOB_TTL_MS) {
      sceneJobs.delete(sceneId);
    }
  }
  while (sceneJobs.size > 2_000) {
    const first = sceneJobs.keys().next().value;
    if (!first) break;
    sceneJobs.delete(first);
  }
}

function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function sceneAgeSeconds(capturedAt: string, now = new Date()): number {
  const t = Date.parse(capturedAt);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.round((now.getTime() - t) / 1000));
}

function buildDelayedSceneCopy(result: SceneResult, ageSec: number): {
  delayedSummary: string;
  whyInteresting: string;
  nextLookTarget: string;
  uncertaintyReason: string | null;
} {
  const ageLabel = ageSec < 60 ? `${ageSec}秒前` : `${Math.round(ageSec / 60)}分前`;
  const subject = result.primarySubject?.name || result.detectedSpecies[0] || "";
  const lowConfidence = (result.primarySubject?.confidence ?? 1) < 0.62;
  const delayedSummary = `${ageLabel}の地点で、${result.summary}`;
  const whyInteresting = result.seasonalNote || result.environmentContext || (subject
    ? `${subject}だけでなく、周囲の環境と一緒に見ると発見が増えます。`
    : "種名が確定しなくても、環境や季節の手がかりとして残せます。");
  const nextLookTarget = subject
    ? `${subject}をもう一度見るなら、全体・近い特徴・いた場所の3つを分けて確認すると進みます。`
    : "次に見るなら、葉・花・実・足元の環境など、名前以外の手がかりを1つ足してください。";
  const uncertaintyReason = lowConfidence
    ? "このフレームだけでは特徴が足りないため、種名は確定せず手がかりとして扱います。"
    : null;
  return { delayedSummary, whyInteresting, nextLookTarget, uncertaintyReason };
}

function distanceFromCurrent(job: PendingGuideScene, currentLatRaw: unknown, currentLngRaw: unknown): number | null {
  const currentLat = Number(currentLatRaw);
  const currentLng = Number(currentLngRaw);
  if (!Number.isFinite(currentLat) || !Number.isFinite(currentLng)) return null;
  return Math.round(metersBetween({ lat: job.lat, lng: job.lng }, { lat: currentLat, lng: currentLng }));
}

function buildScenePayload(job: PendingGuideScene, distanceFromCurrentM: number | null): Record<string, unknown> {
  if (job.status !== "ready" || !job.result || !job.returnedAt) {
    return {
      sceneId: job.sceneId,
      status: job.status,
      capturedAt: job.capturedAt,
      returnedAt: job.returnedAt,
      lat: job.lat,
      lng: job.lng,
      frameThumb: job.frameThumb,
      error: job.error,
    };
  }

  const ageSec = sceneAgeSeconds(job.capturedAt, new Date(job.returnedAt));
  const copy = buildDelayedSceneCopy(job.result, ageSec);
  const deliveryState = distanceFromCurrentM != null && distanceFromCurrentM > 25 ? "deferred" : "ready";

  return {
    sceneId: job.sceneId,
    status: "ready",
    capturedAt: job.capturedAt,
    returnedAt: job.returnedAt,
    lat: job.lat,
    lng: job.lng,
    frameThumb: job.frameThumb,
    distanceFromCurrentM,
    deliveryState,
    summary: job.result.summary,
    delayedSummary: copy.delayedSummary,
    whyInteresting: copy.whyInteresting,
    nextLookTarget: copy.nextLookTarget,
    uncertaintyReason: copy.uncertaintyReason,
    detectedSpecies: job.result.detectedSpecies,
    detectedFeatures: job.result.detectedFeatures,
    primarySubject: job.result.primarySubject,
    environmentContext: job.result.environmentContext,
    seasonalNote: job.result.seasonalNote,
    coexistingTaxa: job.result.coexistingTaxa,
    saveRecommendation: job.result.saveRecommendation,
    autoSave: job.autoSave,
    isNew: job.result.isNew,
    sceneHash: job.result.sceneHash,
  };
}

function writeSse(reply: { raw: { write: (chunk: string) => void } }, event: string, payload: Record<string, unknown>): void {
  reply.raw.write(`event: ${event}\n`);
  reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function resolveGuideSiteBrief(
  lat: number,
  lng: number,
  lang: TtsLang,
  fallbackLabel: string | null,
): Promise<SiteBrief | null> {
  try {
    return await getSiteBrief(lat, lng, lang === "en" ? "en" : "ja");
  } catch {
    if (!fallbackLabel) return null;
    return {
      hypothesis: { id: "client_label", label: fallbackLabel, confidence: 0.2 },
      reasons: [],
      checks: [],
      captureHints: [],
      signals: { landcover: [], nearbyLandcover: [], waterDistanceM: null, elevationM: null },
      officialNotices: [],
    };
  }
}

async function applyGuideAutoSave(input: {
  sceneResult: SceneResult;
  siteBrief: SiteBrief | null;
  sessionId: string;
  userId: string | null;
  lat: number;
  lng: number;
  capturedAt: string;
  returnedAt: string;
  frameThumb: string | null;
  sceneId: string;
  lang: TtsLang;
}): Promise<PendingGuideAutoSave> {
  const decision = decideGuideAutoSave({ result: input.sceneResult, siteBrief: input.siteBrief });
  if (decision.decision === "skip") {
    return { state: "skipped", ...decision };
  }

  const ageSec = sceneAgeSeconds(input.capturedAt, new Date(input.returnedAt));
  const copy = buildDelayedSceneCopy(input.sceneResult, ageSec);
  try {
    const guideRecordId = await saveGuideRecord({
      sessionId: input.sessionId,
      userId: input.userId,
      lat: input.lat,
      lng: input.lng,
      capturedAt: input.capturedAt,
      returnedAt: input.returnedAt,
      currentDistanceM: null,
      deliveryState: "ready",
      seenState: "saved",
      frameThumb: input.frameThumb,
      sceneHash: input.sceneResult.sceneHash,
      sceneSummary: copy.delayedSummary,
      detectedSpecies: input.sceneResult.detectedSpecies,
      detectedFeatures: input.sceneResult.detectedFeatures,
      primarySubject: input.sceneResult.primarySubject ?? null,
      environmentContext: input.sceneResult.environmentContext ?? null,
      seasonalNote: input.sceneResult.seasonalNote ?? null,
      coexistingTaxa: input.sceneResult.coexistingTaxa ?? [],
      confidenceContext: {
        delayed: true,
        ageSec,
        uncertaintyReason: copy.uncertaintyReason,
        autoSave: decision,
      },
      mediaRefs: input.frameThumb ? { frameThumb: input.frameThumb } : {},
      meta: {
        sceneId: input.sceneId,
        whyInteresting: copy.whyInteresting,
        nextLookTarget: copy.nextLookTarget,
        autoSave: decision,
        siteBrief: input.siteBrief
          ? {
              id: input.siteBrief.hypothesis.id,
              label: input.siteBrief.hypothesis.label,
              confidence: input.siteBrief.hypothesis.confidence,
              signals: input.siteBrief.signals,
            }
          : null,
      },
      lang: input.lang,
    });
    return { state: "saved", guideRecordId, ...decision };
  } catch (error) {
    return {
      state: "error",
      ...decision,
      error: error instanceof Error ? error.message : "guide_auto_save_failed",
    };
  }
}

export function registerGuideApiRoutes(app: FastifyInstance): void {
  /**
   * POST /api/v1/guide/scene
   * Queue video frame (+ optional privacy-filtered natural audio) analysis and immediately return a scene_id.
   * Body (JSON):
   *   frame:       string  base64 JPEG/PNG frame
   *   frameThumb?: string  compact data URL thumbnail for delayed trail cards
   *   audio?:      string  base64 audio buffer after client speech-risk filtering
   *   audioPrivacy?: { clientSkippedCount?: number, policy?: string }
   *   frameMime?:  string  MIME type of frame (default "image/jpeg")
   *   lat:         number
   *   lng:         number
   *   sessionId:   string
   *   lang?:       TtsLang (default "ja")
   *   siteBriefLabel?: string
   *
   * This endpoint auto-saves only scenes that pass the field-observation
   * quality gate. Indoor/person-only/duplicate scenes remain transient.
   */
  app.post("/api/v1/guide/scene", async (request, reply) => {
    pruneSceneJobs();
    const body = request.body as Record<string, unknown>;
    const frame = typeof body.frame === "string" ? body.frame : null;
    if (!frame) return reply.status(400).send({ error: "frame is required" });

    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return reply.status(400).send({ error: "lat/lng are required" });
    }

    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "anonymous";
    const lang = parseLang(body.lang);
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    const userId = session?.userId ?? null;

    const capturedAt = typeof body.capturedAt === "string" ? body.capturedAt : new Date().toISOString();
    const azimuthRaw = body.azimuth;
    const azimuth = typeof azimuthRaw === "number" && Number.isFinite(azimuthRaw)
      ? azimuthRaw
      : (typeof azimuthRaw === "string" && azimuthRaw !== "" && Number.isFinite(Number(azimuthRaw)) ? Number(azimuthRaw) : null);
    const sceneId = randomUUID();
    const requestedAt = new Date().toISOString();
    const frameThumb = typeof body.frameThumb === "string" ? body.frameThumb : null;

    const job: PendingGuideScene = {
      sceneId,
      sessionId,
      userId,
      lat,
      lng,
      lang,
      capturedAt,
      requestedAt,
      returnedAt: null,
      frameThumb,
      status: "pending",
      result: null,
      autoSave: null,
      error: null,
    };
    sceneJobs.set(sceneId, job);

    void (async () => {
      try {
        const siteBrief = await resolveGuideSiteBrief(
          lat,
          lng,
          lang,
          typeof body.siteBriefLabel === "string" ? body.siteBriefLabel : null,
        );
        const sceneResult = await analyzeScene({
          frameBase64: frame,
          audioBase64: typeof body.audio === "string" ? body.audio : null,
          frameMimeType: typeof body.frameMime === "string" ? body.frameMime : "image/jpeg",
          context: {
            lat,
            lng,
            lang,
            sessionId,
            userId,
            siteBriefLabel: siteBrief?.hypothesis.label ?? (typeof body.siteBriefLabel === "string" ? body.siteBriefLabel : null),
            siteBriefSignals: siteBrief?.signals ?? null,
            capturedAt,
            azimuth,
          },
        });

        const returnedAt = new Date().toISOString();
        job.returnedAt = returnedAt;
        job.result = sceneResult;
        job.autoSave = await applyGuideAutoSave({
          sceneResult,
          siteBrief,
          sessionId,
          userId,
          lat,
          lng,
          capturedAt,
          returnedAt,
          frameThumb,
          sceneId,
          lang,
        });
        job.status = "ready";
      } catch (error) {
        job.status = "error";
        job.returnedAt = new Date().toISOString();
        job.error = error instanceof Error ? error.message : "scene_analysis_failed";
      }
    })();

    return reply.status(202).send({
      sceneId,
      status: "pending",
      capturedAt,
      lat,
      lng,
      frameThumb,
    });
  });

  app.get<{ Params: { id: string }; Querystring: { currentLat?: string; currentLng?: string } }>(
    "/api/v1/guide/scene/:id",
    async (request, reply) => {
      pruneSceneJobs();
      const job = sceneJobs.get(request.params.id);
      if (!job) return reply.status(404).send({ error: "scene not found" });

      return reply.send(buildScenePayload(job, distanceFromCurrent(job, request.query.currentLat, request.query.currentLng)));
    },
  );

  app.get<{ Params: { id: string }; Querystring: { currentLat?: string; currentLng?: string } }>(
    "/api/v1/guide/scene/:id/events",
    async (request, reply) => {
      pruneSceneJobs();
      const job = sceneJobs.get(request.params.id);
      if (!job) return reply.status(404).send({ error: "scene not found" });

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const distance = () => distanceFromCurrent(job, request.query.currentLat, request.query.currentLng);
      writeSse(reply, "pending", buildScenePayload(job, distance()));

      const startedAt = Date.now();
      const interval = setInterval(() => {
        if (reply.raw.destroyed) {
          clearInterval(interval);
          return;
        }
        const payload = buildScenePayload(job, distance());
        if (payload.status === "ready") {
          writeSse(reply, "ready", payload);
          clearInterval(interval);
          reply.raw.end();
          return;
        }
        if (payload.status === "error") {
          writeSse(reply, "scene-error", payload);
          clearInterval(interval);
          reply.raw.end();
          return;
        }
        if (Date.now() - startedAt > 30_000) {
          writeSse(reply, "timeout", payload);
          clearInterval(interval);
          reply.raw.end();
          return;
        }
        writeSse(reply, "ping", payload);
      }, 900);

      request.raw.on("close", () => clearInterval(interval));
    },
  );

  app.post("/api/v1/guide/live-token", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    if (!session) return reply.status(401).send({ error: "login required" });

    try {
      const body = request.body as Record<string, unknown> | undefined;
      const token = await createGuideLiveToken({
        model: typeof body?.model === "string" ? body.model : undefined,
        lang: parseLang(body?.lang),
      });
      return reply.send(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : "live_token_failed";
      const status = message.includes("GEMINI_API_KEY") ? 503 : 500;
      return reply.status(status).send({ error: message });
    }
  });

  /**
   * POST /api/v1/guide/tts
   * Build a guide script and convert to TTS audio.
   * Body (JSON):
   *   sceneSummary:     string
   *   category:         "biodiversity"|"land_history"|"buildings"|"people_history"
   *   lang?:            TtsLang
   *   lat:              number
   *   lng:              number
   *   siteBriefLabel?:  string
   *   detectedSpecies?: string[]
   *   voice?:           string  (voice name override)
   * Returns: { script: string, audioBase64: string }
   */
  app.post("/api/v1/guide/tts", async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const sceneSummary = typeof body.sceneSummary === "string" ? body.sceneSummary : "";
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const lang = parseLang(body.lang);

    const allowedCategories = ["biodiversity", "land_history", "buildings", "people_history"] as const;
    type Category = (typeof allowedCategories)[number];
    const categoryRaw = typeof body.category === "string" ? body.category : "biodiversity";
    const category: Category = (allowedCategories as readonly string[]).includes(categoryRaw)
      ? (categoryRaw as Category)
      : "biodiversity";

    const detectedSpecies = Array.isArray(body.detectedSpecies)
      ? (body.detectedSpecies as unknown[]).filter((s): s is string => typeof s === "string")
      : [];

    const script = await buildGuideScript({
      category,
      sceneSummary,
      lang,
      lat: Number.isFinite(lat) ? lat : 35.0,
      lng: Number.isFinite(lng) ? lng : 138.0,
      siteBriefLabel: typeof body.siteBriefLabel === "string" ? body.siteBriefLabel : undefined,
      detectedSpecies,
    });

    if (!script) return reply.status(500).send({ error: "Script generation failed" });

    const audioBase64 = await generateTts(
      script,
      lang,
      typeof body.voice === "string" ? body.voice : undefined,
    );

    return reply.send({ script, audioBase64 });
  });

  /**
   * POST /api/v1/guide/record
   * Manually save a guide observation to guide_records (user-initiated).
   * Body (JSON): same as scene result + sessionId, lang, lat, lng
   */
  app.post("/api/v1/guide/record", async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "manual";
    const lang = parseLang(body.lang);
    const lat = Number(body.lat);
    const lng = Number(body.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return reply.status(400).send({ error: "lat/lng required" });
    }

    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);

    const id = await saveGuideRecord({
      sessionId,
      userId: session?.userId ?? null,
      lat,
      lng,
      capturedAt: typeof body.capturedAt === "string" ? body.capturedAt : null,
      returnedAt: typeof body.returnedAt === "string" ? body.returnedAt : null,
      currentDistanceM: Number.isFinite(Number(body.currentDistanceM)) ? Number(body.currentDistanceM) : null,
      deliveryState: "surfaced",
      seenState: "saved",
      frameThumb: typeof body.frameThumb === "string" ? body.frameThumb : null,
      sceneHash: typeof body.sceneHash === "string" ? body.sceneHash : "manual",
      sceneSummary: typeof body.sceneSummary === "string" ? body.sceneSummary : "",
      detectedSpecies: Array.isArray(body.detectedSpecies)
        ? (body.detectedSpecies as unknown[]).filter((s): s is string => typeof s === "string")
        : [],
      detectedFeatures: [],
      mediaRefs: typeof body.frameThumb === "string" ? { frameThumb: body.frameThumb } : {},
      ttsScript: typeof body.ttsScript === "string" ? body.ttsScript : null,
      lang,
    });

    return reply.send({ guideRecordId: id });
  });
}
