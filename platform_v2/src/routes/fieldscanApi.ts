import type { FastifyInstance } from "fastify";
import {
  submitAudioSegment,
  recordAudioDetections,
  getSessionRecap,
  type AudioSegmentSubmitInput,
  type AudioDetectionCallbackInput,
} from "../services/fieldscanAudio.js";
import { getSessionFromCookie } from "../services/authSession.js";
import { assertPrivilegedWriteAccess } from "../services/writeGuards.js";

/**
 * FieldScan (Phase E) 音声パイプライン。
 *
 * - POST /api/v1/fieldscan/audio/submit         セッション中の音声 segment を登録
 * - POST /api/v1/fieldscan/audio/callback       外部同定ワーカーから detection 結果を登録 (privileged)
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
        reply.code(message.endsWith("_required") ? 400 : 500);
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
        reply.code(message === "forbidden" ? 403 : message.endsWith("_required") ? 400 : 500);
        return { ok: false, error: message };
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/v1/fieldscan/session/:id/recap",
    async (request, reply) => {
      try {
        const recap = await getSessionRecap(request.params.id);
        return { ok: true, recap };
      } catch (error) {
        reply.code(500);
        return { ok: false, error: error instanceof Error ? error.message : "recap_failed" };
      }
    },
  );
}
