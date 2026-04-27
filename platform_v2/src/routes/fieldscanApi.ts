import type { FastifyInstance } from "fastify";
import {
  submitAudioSegment,
  recordAudioDetections,
  recordAudioPrivacyDecision,
  getSessionRecap,
  loadAudioSegmentForPlayback,
  type AudioSegmentSubmitInput,
  type AudioDetectionCallbackInput,
  type AudioPrivacyCallbackInput,
} from "../services/fieldscanAudio.js";
import { getSessionFromCookie } from "../services/authSession.js";
import { assertPrivilegedWriteAccess } from "../services/writeGuards.js";

const AUDIO_SUBMIT_BAD_REQUEST_ERRORS = new Set([
  "unsupported_audio_format",
  "decoded_audio_empty",
  "audio_too_large",
]);

function audioSubmitStatusCode(message: string): number {
  if (message.endsWith("_required") || AUDIO_SUBMIT_BAD_REQUEST_ERRORS.has(message)) {
    return 400;
  }
  return 500;
}

function privilegedAudioStatusCode(message: string): number {
  if (message === "privileged_write_api_key_not_configured") {
    return 503;
  }
  if (message === "forbidden" || message === "forbidden_privileged_write") {
    return 403;
  }
  if (message === "segment_not_found") {
    return 404;
  }
  if (message === "deleted_segment_cannot_be_restored") {
    return 409;
  }
  if (message.endsWith("_required") || message === "invalid_privacy_decision") {
    return 400;
  }
  return 500;
}

/**
 * FieldScan (Phase E) 音声パイプライン。
 *
 * - POST /api/v1/fieldscan/audio/submit         セッション中の音声 segment を登録
 * - POST /api/v1/fieldscan/audio/callback       外部同定ワーカーから detection 結果を登録 (privileged)
 * - POST /api/v1/fieldscan/audio/privacy-callback 人声 privacy 判定を反映 (privileged)
 * - GET  /api/v1/fieldscan/audio/segment/:id    owner-only playback
 * - GET  /api/v1/fieldscan/session/:id/recap    セッション単位の集計
 */
export async function registerFieldscanApiRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: AudioSegmentSubmitInput }>(
    "/api/v1/fieldscan/audio/submit",
    async (request, reply) => {
      try {
        const session = await getSessionFromCookie(request.headers.cookie).catch(() => null);
        const body = request.body ?? ({} as AudioSegmentSubmitInput);
        const result = await submitAudioSegment({
          ...body,
          userId: body.userId ?? session?.userId ?? null,
        });
        return { ok: true, ...result };
      } catch (error) {
        const message = error instanceof Error ? error.message : "audio_submit_failed";
        reply.code(audioSubmitStatusCode(message));
        return { ok: false, error: message };
      }
    },
  );

  app.post<{ Body: AudioDetectionCallbackInput }>(
    "/api/v1/fieldscan/audio/callback",
    async (request, reply) => {
      try {
        assertPrivilegedWriteAccess(request);
        const result = await recordAudioDetections(request.body ?? ({} as AudioDetectionCallbackInput));
        return { ok: true, ...result };
      } catch (error) {
        const message = error instanceof Error ? error.message : "detection_callback_failed";
        reply.code(privilegedAudioStatusCode(message));
        return { ok: false, error: message };
      }
    },
  );

  app.post<{ Body: AudioPrivacyCallbackInput }>(
    "/api/v1/fieldscan/audio/privacy-callback",
    async (request, reply) => {
      try {
        assertPrivilegedWriteAccess(request);
        const result = await recordAudioPrivacyDecision(request.body ?? ({} as AudioPrivacyCallbackInput));
        return { ok: true, ...result };
      } catch (error) {
        const message = error instanceof Error ? error.message : "privacy_callback_failed";
        reply.code(privilegedAudioStatusCode(message));
        return { ok: false, error: message };
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/v1/fieldscan/audio/segment/:id",
    async (request, reply) => {
      try {
        const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
        if (!session?.userId) {
          reply.code(401);
          return { ok: false, error: "unauthorized" };
        }
        const playback = await loadAudioSegmentForPlayback(request.params.id, session.userId);
        if (!playback) {
          reply.code(404);
          return { ok: false, error: "audio_not_found" };
        }
        reply
          .type(playback.mimeType)
          .header("Cache-Control", "private, no-store")
          .send(playback.data);
        return;
      } catch (error) {
        reply.code(500);
        return { ok: false, error: error instanceof Error ? error.message : "audio_stream_failed" };
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/v1/fieldscan/session/:id/recap",
    async (request, reply) => {
      try {
        const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
        const recap = await getSessionRecap(request.params.id, session?.userId ?? null);
        return { ok: true, recap };
      } catch (error) {
        reply.code(500);
        return { ok: false, error: error instanceof Error ? error.message : "recap_failed" };
      }
    },
  );
}
