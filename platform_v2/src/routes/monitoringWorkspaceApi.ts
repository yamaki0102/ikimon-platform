import type { FastifyInstance, FastifyRequest } from "fastify";
import { getSessionFromCookie } from "../services/authSession.js";
import { loadMonitoringWorkspaceReadModelForField } from "../services/monitoringWorkspaceData.js";
import type { MonitoringWorkspaceReportPurpose } from "../services/monitoringWorkspaceReadModel.js";
import { isAdminOrAnalystRole } from "../services/reviewerAuthorities.js";
import { assertPrivilegedWriteAccess } from "../services/writeGuards.js";

function parseDateParam(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function parseLimit(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function parseGridStep(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parsePurpose(value: unknown): MonitoringWorkspaceReportPurpose | undefined {
  if (value === "formal_report" || value === "identification_strengthening" || value === "area_strengthening") {
    return value;
  }
  return undefined;
}

async function canReadMonitoringWorkspace(request: FastifyRequest): Promise<boolean> {
  try {
    assertPrivilegedWriteAccess(request);
    return true;
  } catch {
    // Continue to session role check.
  }
  const session = await getSessionFromCookie(request.headers.cookie).catch(() => null);
  return Boolean(session && !session.banned && isAdminOrAnalystRole(session.roleName, session.rankLabel));
}

export async function registerMonitoringWorkspaceApiRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: {
      field_id?: string;
      start?: string;
      end?: string;
      limit?: string;
      purpose?: string;
      grid_step?: string;
    };
  }>("/api/v1/monitoring/workspace/field", async (request, reply) => {
    if (!await canReadMonitoringWorkspace(request)) {
      reply.code(403);
      return { ok: false, error: "forbidden_monitoring_workspace" };
    }

    const fieldId = String(request.query.field_id ?? "").trim();
    const start = parseDateParam(request.query.start);
    const end = parseDateParam(request.query.end);
    if (!fieldId || !start || !end) {
      reply.code(400);
      return { ok: false, error: "missing_field_or_term" };
    }

    const model = await loadMonitoringWorkspaceReadModelForField({
      fieldId,
      start,
      end,
      limit: parseLimit(request.query.limit),
      reportPurpose: parsePurpose(request.query.purpose),
      gridStepDegrees: parseGridStep(request.query.grid_step),
    });
    if (!model) {
      reply.code(404);
      return { ok: false, error: "monitoring_workspace_not_found" };
    }

    reply.header("Cache-Control", "private, max-age=30");
    return {
      ok: true,
      model,
    };
  });
}

export const monitoringWorkspaceApiRouteContract = {
  path: "/api/v1/monitoring/workspace/field",
  requiredQuery: ["field_id", "start", "end"],
  allowedPurposes: ["formal_report", "identification_strengthening", "area_strengthening"],
  guards: ["privileged_write_access", "admin_or_analyst_session"],
} as const;
