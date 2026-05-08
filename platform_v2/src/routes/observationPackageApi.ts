import type { FastifyInstance, FastifyRequest } from "fastify";
import { buildObservationPackage } from "../services/observationPackage.js";
import { getSessionFromCookie } from "../services/authSession.js";
import {
  assertObservationOwnedByUser,
  assertPrivilegedWriteAccess,
} from "../services/writeGuards.js";

async function canReadObservationPackage(request: FastifyRequest, observationId: string): Promise<boolean> {
  try {
    assertPrivilegedWriteAccess(request);
    return true;
  } catch {
    // Fall through to owner session check.
  }
  const session = await getSessionFromCookie(request.headers.cookie).catch(() => null);
  if (!session || session.banned) return false;
  await assertObservationOwnedByUser(observationId, session.userId);
  return true;
}

export async function registerObservationPackageApiRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string }; Querystring: { subject?: string } }>(
    "/api/v1/observations/:id/package",
    async (request, reply) => {
      try {
        if (!await canReadObservationPackage(request, request.params.id)) {
          throw new Error("forbidden_observation_package");
        }
        const pkg = await buildObservationPackage({
          occurrenceId: request.params.id,
          targetOccurrenceId: request.query.subject ?? null,
        });
        if (!pkg) {
          reply.code(404);
          return {
            ok: false,
            error: "observation_package_not_found",
          };
        }
        reply.header("Cache-Control", "private, max-age=30");
        return {
          ok: true,
          package: pkg,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "observation_package_failed";
        reply.code(message === "observation_not_owned" || message.startsWith("forbidden") ? 403 : 400);
        return {
          ok: false,
          error: message,
        };
      }
    },
  );
}
