import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getSessionFromCookie, type SessionSnapshot } from "../services/authSession.js";
import {
  assertCanAccessSitePlot,
  buildSitePlotReport,
  listSatelliteContexts,
  listSitePlotVisits,
  listSitePlots,
  saveSatelliteContext,
  saveSitePlot,
  saveSitePlotVisit,
  type SitePlotAccessAction,
} from "../services/plotMonitoring.js";

type SiteParams = {
  siteId: string;
};

type PlotParams = SiteParams & {
  plotId: string;
};

type ApiBody = Record<string, unknown>;

function withJson(reply: FastifyReply): FastifyReply {
  return reply
    .type("application/json; charset=utf-8")
    .header("Cache-Control", "no-store");
}

function plotApiStatusCode(message: string): number {
  if (message === "session_required") {
    return 401;
  }
  if (message === "account_disabled" || message === "site_plot_admin_required") {
    return 403;
  }
  if (message === "site_not_found" || message === "plot_not_found") {
    return 404;
  }
  if (message.endsWith("_conflict")) {
    return 409;
  }
  if (message.endsWith("_required") || message.startsWith("invalid_")) {
    return 400;
  }
  return 500;
}

function sendPlotApiError(reply: FastifyReply, error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  withJson(reply).code(plotApiStatusCode(message));
  return { ok: false, error: message };
}

async function getSession(request: FastifyRequest): Promise<SessionSnapshot | null> {
  return getSessionFromCookie(request.headers.cookie).catch(() => null);
}

async function assertSiteAccess(
  request: FastifyRequest,
  siteId: string,
  action: SitePlotAccessAction,
): Promise<SessionSnapshot> {
  const session = await getSession(request);
  await assertCanAccessSitePlot(session, siteId, action);
  if (!session) {
    throw new Error("session_required");
  }
  return session;
}

/**
 * Plot monitoring is v2-only. The legacy PHP endpoints are intentionally
 * sealed, so these routes are the backstage surface for fixed plots,
 * field visits, satellite context snapshots, and report JSON.
 */
export async function registerPlotMonitoringApiRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: SiteParams }>("/api/v1/sites/:siteId/plots", async (request, reply) => {
    try {
      await assertSiteAccess(request, request.params.siteId, "view");
      const payload = await listSitePlots(request.params.siteId);
      withJson(reply);
      return { ok: true, ...payload };
    } catch (error) {
      return sendPlotApiError(reply, error, "site_plots_lookup_failed");
    }
  });

  app.post<{ Params: SiteParams; Body: ApiBody }>("/api/v1/sites/:siteId/plots", async (request, reply) => {
    try {
      const session = await assertSiteAccess(request, request.params.siteId, "edit");
      const payload = await saveSitePlot(request.params.siteId, request.body ?? {}, session.userId);
      withJson(reply);
      return { ok: true, ...payload };
    } catch (error) {
      return sendPlotApiError(reply, error, "site_plot_save_failed");
    }
  });

  app.get<{ Params: SiteParams }>("/api/v1/sites/:siteId/plot-report", async (request, reply) => {
    try {
      await assertSiteAccess(request, request.params.siteId, "view");
      const payload = await buildSitePlotReport(request.params.siteId);
      withJson(reply);
      return { ok: true, payload };
    } catch (error) {
      return sendPlotApiError(reply, error, "plot_report_lookup_failed");
    }
  });

  app.get<{ Params: PlotParams }>("/api/v1/sites/:siteId/plots/:plotId/report", async (request, reply) => {
    try {
      await assertSiteAccess(request, request.params.siteId, "view");
      const payload = await buildSitePlotReport(request.params.siteId, request.params.plotId);
      withJson(reply);
      return { ok: true, payload };
    } catch (error) {
      return sendPlotApiError(reply, error, "plot_report_lookup_failed");
    }
  });

  app.get<{ Params: PlotParams }>("/api/v1/sites/:siteId/plots/:plotId/visits", async (request, reply) => {
    try {
      await assertSiteAccess(request, request.params.siteId, "view");
      const payload = await listSitePlotVisits(request.params.siteId, request.params.plotId);
      withJson(reply);
      return { ok: true, ...payload };
    } catch (error) {
      return sendPlotApiError(reply, error, "site_plot_visits_lookup_failed");
    }
  });

  app.post<{ Params: PlotParams; Body: ApiBody }>("/api/v1/sites/:siteId/plots/:plotId/visits", async (request, reply) => {
    try {
      const session = await assertSiteAccess(request, request.params.siteId, "edit");
      const payload = await saveSitePlotVisit(
        request.params.siteId,
        request.params.plotId,
        request.body ?? {},
        session.userId,
      );
      withJson(reply);
      return { ok: true, ...payload };
    } catch (error) {
      return sendPlotApiError(reply, error, "site_plot_visit_save_failed");
    }
  });

  app.get<{ Params: SiteParams }>("/api/v1/sites/:siteId/satellite-context", async (request, reply) => {
    try {
      await assertSiteAccess(request, request.params.siteId, "view");
      const payload = await listSatelliteContexts("site", request.params.siteId);
      withJson(reply);
      return { ok: true, ...payload };
    } catch (error) {
      return sendPlotApiError(reply, error, "site_satellite_context_lookup_failed");
    }
  });

  app.post<{ Params: SiteParams; Body: ApiBody }>("/api/v1/sites/:siteId/satellite-context", async (request, reply) => {
    try {
      const session = await assertSiteAccess(request, request.params.siteId, "edit");
      const payload = await saveSatelliteContext("site", request.params.siteId, null, request.body ?? {}, session.userId);
      withJson(reply);
      return { ok: true, ...payload };
    } catch (error) {
      return sendPlotApiError(reply, error, "site_satellite_context_save_failed");
    }
  });

  app.get<{ Params: PlotParams }>("/api/v1/sites/:siteId/plots/:plotId/satellite-context", async (request, reply) => {
    try {
      await assertSiteAccess(request, request.params.siteId, "view");
      const payload = await listSatelliteContexts("plot", request.params.siteId, request.params.plotId);
      withJson(reply);
      return { ok: true, ...payload };
    } catch (error) {
      return sendPlotApiError(reply, error, "plot_satellite_context_lookup_failed");
    }
  });

  app.post<{ Params: PlotParams; Body: ApiBody }>("/api/v1/sites/:siteId/plots/:plotId/satellite-context", async (request, reply) => {
    try {
      const session = await assertSiteAccess(request, request.params.siteId, "edit");
      const payload = await saveSatelliteContext(
        "plot",
        request.params.siteId,
        request.params.plotId,
        request.body ?? {},
        session.userId,
      );
      withJson(reply);
      return { ok: true, ...payload };
    } catch (error) {
      return sendPlotApiError(reply, error, "plot_satellite_context_save_failed");
    }
  });
}
