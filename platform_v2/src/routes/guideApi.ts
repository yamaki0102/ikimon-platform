import type { FastifyInstance } from "fastify";
import { getSessionFromCookie } from "../services/authSession.js";
import { analyzeScene, saveGuideRecord } from "../services/guideSession.js";
import { buildGuideScript, generateTts } from "../services/guideTts.js";
import type { TtsLang } from "../services/guideTts.js";

const ALLOWED_LANGS: TtsLang[] = ["ja", "en", "es", "pt-BR", "ko", "zh"];

function parseLang(raw: unknown): TtsLang {
  if (typeof raw === "string" && (ALLOWED_LANGS as string[]).includes(raw)) {
    return raw as TtsLang;
  }
  return "ja";
}

export function registerGuideApiRoutes(app: FastifyInstance): void {
  /**
   * POST /api/v1/guide/scene
   * Analyse a video frame (+ optional audio) → scene summary + auto-save to guide_records.
   * Body (JSON):
   *   frame:       string  base64 JPEG/PNG frame
   *   audio?:      string  base64 PCM audio buffer
   *   frameMime?:  string  MIME type of frame (default "image/jpeg")
   *   lat:         number
   *   lng:         number
   *   sessionId:   string
   *   lang?:       TtsLang (default "ja")
   *   siteBriefLabel?: string
   */
  app.post("/api/v1/guide/scene", async (request, reply) => {
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

    const capturedAt = typeof body.capturedAt === "string" ? body.capturedAt : null;
    const azimuthRaw = body.azimuth;
    const azimuth = typeof azimuthRaw === "number" && Number.isFinite(azimuthRaw)
      ? azimuthRaw
      : (typeof azimuthRaw === "string" && azimuthRaw !== "" && Number.isFinite(Number(azimuthRaw)) ? Number(azimuthRaw) : null);

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
        siteBriefLabel: typeof body.siteBriefLabel === "string" ? body.siteBriefLabel : null,
        capturedAt,
        azimuth,
      },
    });

    // Auto-save to guide_records (non-blocking on failure)
    if (sceneResult.isNew) {
      void saveGuideRecord({
        sessionId,
        userId,
        lat,
        lng,
        sceneHash: sceneResult.sceneHash,
        sceneSummary: sceneResult.summary,
        detectedSpecies: sceneResult.detectedSpecies,
        detectedFeatures: sceneResult.detectedFeatures,
        lang,
      }).catch(() => undefined);
    }

    return reply.send({
      summary: sceneResult.summary,
      detectedSpecies: sceneResult.detectedSpecies,
      detectedFeatures: sceneResult.detectedFeatures,
      primarySubject: sceneResult.primarySubject,
      environmentContext: sceneResult.environmentContext,
      seasonalNote: sceneResult.seasonalNote,
      coexistingTaxa: sceneResult.coexistingTaxa,
      isNew: sceneResult.isNew,
      sceneHash: sceneResult.sceneHash,
    });
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
      sceneHash: typeof body.sceneHash === "string" ? body.sceneHash : "manual",
      sceneSummary: typeof body.sceneSummary === "string" ? body.sceneSummary : "",
      detectedSpecies: Array.isArray(body.detectedSpecies)
        ? (body.detectedSpecies as unknown[]).filter((s): s is string => typeof s === "string")
        : [],
      detectedFeatures: [],
      ttsScript: typeof body.ttsScript === "string" ? body.ttsScript : null,
      lang,
    });

    return reply.send({ guideRecordId: id });
  });
}
