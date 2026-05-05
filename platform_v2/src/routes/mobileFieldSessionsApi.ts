import type { FastifyInstance } from "fastify";
import { getSessionFromMobileAuth } from "../services/authSession.js";
import {
  getMobileFieldSessionRecap,
  normalizeMobileSceneDigestBody,
  saveMobileSceneDigest,
} from "../services/mobileFieldSessions.js";

function statusForMobileError(message: string): number {
  if (message.endsWith("_required") || message === "lat_lng_required") return 400;
  return 500;
}

export async function registerMobileFieldSessionsApiRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/v1/mobile/field-sessions/start", async (request) => {
    const session = await getSessionFromMobileAuth(request).catch(() => null);
    const body = request.body as Record<string, unknown> | undefined;
    const requested = typeof body?.session_id === "string" && body.session_id.trim() ? body.session_id.trim() : null;
    return {
      ok: true,
      sessionId: requested ?? `mobile-${Date.now()}`,
      userAuthState: session ? "logged_in" : "anonymous",
      userId: session?.userId ?? null,
      rawMediaPolicy: "digest_only",
    };
  });

  app.post<{ Params: { sessionId: string } }>(
    "/api/v1/mobile/field-sessions/:sessionId/scene-digest",
    async (request, reply) => {
      try {
        const session = await getSessionFromMobileAuth(request).catch(() => null);
        const input = normalizeMobileSceneDigestBody(
          request.body as Record<string, unknown>,
          request.params.sessionId,
        );
        input.userId = session?.userId ?? null;
        const saved = await saveMobileSceneDigest(input);
        return {
          ok: true,
          sessionId: input.sessionId,
          guideRecordId: saved.guideRecordId,
          duplicate: saved.duplicate,
          rawMediaStored: false,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "scene_digest_failed";
        reply.code(statusForMobileError(message));
        return { ok: false, error: message };
      }
    },
  );

  app.post<{ Params: { sessionId: string } }>(
    "/api/v1/mobile/field-sessions/:sessionId/audio-events",
    async (request) => {
      const session = await getSessionFromMobileAuth(request).catch(() => null);
      const body = request.body as Record<string, unknown> | undefined;
      const events = Array.isArray(body?.events) ? body.events : [];
      return {
        ok: true,
        sessionId: request.params.sessionId,
        acceptedCount: events.length,
        userAuthState: session ? "logged_in" : "anonymous",
        rawAudioStored: false,
      };
    },
  );

  app.post<{ Params: { sessionId: string } }>(
    "/api/v1/mobile/field-sessions/:sessionId/end",
    async (request) => {
      const session = await getSessionFromMobileAuth(request).catch(() => null);
      const recap = await getMobileFieldSessionRecap(request.params.sessionId, session?.userId ?? null);
      return { ok: true, recap };
    },
  );

  app.get<{ Params: { sessionId: string } }>(
    "/api/v1/mobile/field-sessions/:sessionId/recap",
    async (request) => {
      const session = await getSessionFromMobileAuth(request).catch(() => null);
      const recap = await getMobileFieldSessionRecap(request.params.sessionId, session?.userId ?? null);
      return { ok: true, recap };
    },
  );
}
