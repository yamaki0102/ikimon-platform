import type { FastifyInstance } from "fastify";
import { isUiKpiEventName, recordUiKpiEvent } from "../services/uiKpi.js";

type UiKpiBody = {
  eventName: "first_action" | "task_completion" | "section_view" | "read_depth" | "primary_cta_click";
  pagePath?: string;
  routeKey?: string;
  actionKey?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
};

export async function registerUiKpiRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: UiKpiBody }>("/api/v1/ui-kpi/events", async (request, reply) => {
    try {
      if (!isUiKpiEventName(request.body?.eventName)) {
        reply.code(400);
        return {
          ok: false,
          error: "invalid_event_name",
        };
      }

      const result = await recordUiKpiEvent({
        eventName: request.body.eventName,
        eventSource: "web",
        pagePath: request.body.pagePath,
        routeKey: request.body.routeKey,
        actionKey: request.body.actionKey,
        userId: request.body.userId,
        metadata: request.body.metadata,
      });

      return {
        ok: true,
        eventId: result.eventId,
      };
    } catch (error) {
      reply.code(400);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "ui_kpi_event_failed",
      };
    }
  });
}
