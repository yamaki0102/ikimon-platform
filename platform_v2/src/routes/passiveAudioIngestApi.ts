import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  ingestPassiveAudioDetectionsBatch,
  type PassiveAudioBatchResult,
} from "../services/passiveAudioIngest.js";
import { assertPrivilegedWriteAccess } from "../services/writeGuards.js";

export type PassiveAudioIngestRouteOptions = {
  ingestBatch?: (events: unknown[]) => Promise<PassiveAudioBatchResult>;
};

function parseEventsBody(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object" && Array.isArray((body as { events?: unknown }).events)) {
    return (body as { events: unknown[] }).events;
  }
  return [body];
}

function statusForError(message: string): number {
  if (message === "privileged_write_api_key_not_configured") return 503;
  if (message === "forbidden" || message === "forbidden_privileged_write") return 403;
  if (message === "batch_limit_exceeded" || message.endsWith("_required") || message.endsWith("_invalid")) return 400;
  return 500;
}

export async function registerPassiveAudioIngestApiRoutes(
  app: FastifyInstance,
  options: PassiveAudioIngestRouteOptions = {},
): Promise<void> {
  const ingestBatch = options.ingestBatch ?? ingestPassiveAudioDetectionsBatch;

  app.post<{ Body: unknown }>(
    "/api/v1/ingest/audio-detections",
    async (request: FastifyRequest<{ Body: unknown }>, reply) => {
      try {
        assertPrivilegedWriteAccess(request);
        const events = parseEventsBody(request.body);
        if (events.length > 100) {
          reply.code(400);
          return { ok: false, error: "batch_limit_exceeded", accepted: 0, rejected: events.length, duplicates: 0, results: [] };
        }
        const result = await ingestBatch(events);
        if (result.rejected > 0) reply.code(207);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "passive_audio_ingest_failed";
        reply.code(statusForError(message));
        return { ok: false, error: message };
      }
    },
  );
}
