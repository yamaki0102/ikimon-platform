// Stewardship action recording route (Phase B+)
// GET  /sites/:place_id/stewardship/new  -> form
// POST /sites/:place_id/stewardship_actions  -> insert + redirect

import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { getPool } from "../db.js";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { detectLangFromUrl, type SiteLang } from "../i18n.js";
import { renderSiteDocument } from "../ui/siteShell.js";
import { getSessionFromCookie } from "../services/authSession.js";
import {
  renderStewardshipActionForm,
  STEWARDSHIP_ACTION_FORM_STYLES,
} from "../ui/stewardshipActionForm.js";

const VALID_ACTION_KINDS = new Set([
  "cleanup",
  "mowing",
  "water_management",
  "pruning",
  "planting",
  "harvesting",
  "tilling",
  "trampling",
  "bare_ground",
  "invasive_removal",
  "unknown",
  "patrol",
  "signage",
  "monitoring",
  "external_program",
  "restoration",
  "community_engagement",
  "other",
]);

const VALID_SPECIES_STATUSES = new Set([
  "invasive",
  "dominant_native",
  "disturbance",
  "unknown",
]);

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

function requestUrl(request: { url?: string; raw?: { url?: string } }): string {
  return String(request.raw?.url ?? request.url ?? "");
}

function pageTitle(lang: SiteLang): string {
  switch (lang) {
    case "en": return "Record stewardship action";
    case "es": return "Registrar acción de cuidado";
    case "pt-BR": return "Registrar ação de cuidado";
    default: return "保全活動を記録";
  }
}

function loginRequiredMessage(lang: SiteLang): string {
  switch (lang) {
    case "en": return "Please sign in to record stewardship actions.";
    case "es": return "Inicie sesión para registrar acciones de cuidado.";
    case "pt-BR": return "Faça login para registrar ações de cuidado.";
    default: return "保全活動の記録にはログインが必要です。";
  }
}

function successMessage(lang: SiteLang): string {
  switch (lang) {
    case "en": return "Stewardship action recorded.";
    case "es": return "Acción de cuidado registrada.";
    case "pt-BR": return "Ação de cuidado registrada.";
    default: return "保全活動を記録しました。";
  }
}

function invalidMessage(lang: SiteLang, key: string): string {
  switch (lang) {
    case "en": return `Invalid input: ${key}`;
    case "es": return `Entrada inválida: ${key}`;
    case "pt-BR": return `Entrada inválida: ${key}`;
    default: return `入力エラー: ${key}`;
  }
}

export async function registerStewardshipActionRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { place_id: string }; Querystring: { ok?: string; error?: string } }>(
    "/sites/:place_id/stewardship/new",
    async (request, reply) => {
      const basePath = requestBasePath(request as { headers: Record<string, unknown> });
      const lang = detectLangFromUrl(requestUrl(request));
      const placeId = request.params.place_id;

      const session = await getSessionFromCookie(
        (request.headers["cookie"] as string | undefined) ?? undefined
      );
      const successText = request.query?.ok === "1" ? successMessage(lang) : undefined;
      const errorText = request.query?.error
        ? invalidMessage(lang, String(request.query.error))
        : !session
        ? loginRequiredMessage(lang)
        : undefined;

      reply.type("text/html; charset=utf-8");
      return renderSiteDocument({
        basePath,
        title: pageTitle(lang),
        lang,
        currentPath: requestUrl(request),
        extraStyles: STEWARDSHIP_ACTION_FORM_STYLES,
        body: renderStewardshipActionForm(placeId, lang, {
          successMessage: successText,
          errorMessage: errorText,
        }),
      });
    }
  );

  app.post<{
    Params: { place_id: string };
    Body: {
      occurred_at?: string;
      action_kind?: string;
      description?: string;
      species_status?: string;
      linked_visit_id?: string;
    };
  }>("/sites/:place_id/stewardship_actions", async (request, reply) => {
    const basePath = requestBasePath(request as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    const placeId = request.params.place_id;
    const formUrl = withBasePath(basePath, `/sites/${encodeURIComponent(placeId)}/stewardship/new?lang=${lang}`);

    const session = await getSessionFromCookie(
      (request.headers["cookie"] as string | undefined) ?? undefined
    );
    if (!session?.userId) {
      reply.code(302);
      reply.header("location", `${formUrl}&error=login_required`);
      return reply.send();
    }

    const body = request.body ?? {};
    const occurredAtStr = (body.occurred_at ?? "").trim();
    const actionKind = (body.action_kind ?? "").trim();
    const description = (body.description ?? "").trim();
    const speciesStatusRaw = (body.species_status ?? "").trim();
    const linkedVisitId = (body.linked_visit_id ?? "").trim();

    if (!occurredAtStr) {
      reply.code(302);
      reply.header("location", `${formUrl}&error=occurred_at_missing`);
      return reply.send();
    }
    const occurredAt = new Date(occurredAtStr);
    if (Number.isNaN(occurredAt.getTime())) {
      reply.code(302);
      reply.header("location", `${formUrl}&error=occurred_at_invalid`);
      return reply.send();
    }
    if (!VALID_ACTION_KINDS.has(actionKind)) {
      reply.code(302);
      reply.header("location", `${formUrl}&error=action_kind_invalid`);
      return reply.send();
    }
    const speciesStatus = speciesStatusRaw && VALID_SPECIES_STATUSES.has(speciesStatusRaw)
      ? speciesStatusRaw
      : null;

    try {
      const pool = getPool();
      await pool.query(
        `INSERT INTO stewardship_actions (
            action_id, place_id, occurred_at, action_kind, actor_user_id,
            linked_visit_id, description, species_status, metadata
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
        [
          randomUUID(),
          placeId,
          occurredAt,
          actionKind,
          session.userId,
          linkedVisitId || null,
          description || null,
          speciesStatus,
          JSON.stringify({ source: "web_form" }),
        ]
      );
    } catch (error) {
      console.warn("[stewardshipActions] insert failed", error);
      reply.code(302);
      reply.header("location", `${formUrl}&error=insert_failed`);
      return reply.send();
    }

    reply.code(302);
    reply.header("location", `${formUrl}&ok=1`);
    return reply.send();
  });
}
