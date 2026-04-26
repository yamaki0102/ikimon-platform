import type { FastifyInstance } from "fastify";
import { getPool } from "../db.js";
import { detectLangFromUrl, type SiteLang } from "../i18n.js";
import { getStrings } from "../i18n/index.js";
import { getSessionFromCookie } from "../services/authSession.js";
import {
  getSessionById,
  getSessionByEventCode,
  type ObservationEventSessionRow,
} from "../services/observationEventModeManager.js";
import { buildRecap } from "../services/observationEventRecap.js";
import { renderSiteDocument } from "../ui/siteShell.js";
import {
  OBSERVATION_EVENT_STYLES,
  OBSERVATION_EVENT_BOOT_SCRIPT,
} from "../ui/observationEventStyles.js";
import {
  renderObservationEventLiveBody,
  observationEventLiveScript,
} from "../ui/observationEventLive.js";
import {
  renderOrganizerConsoleBody,
  organizerConsoleScript,
} from "../ui/observationEventOrganizerConsole.js";
import {
  renderCheckinBody,
  checkinScript,
} from "../ui/observationEventCheckin.js";
import {
  renderRecapBody,
  recapScript,
} from "../ui/observationEventRecap.js";
import { renderEventListBody } from "../ui/observationEventList.js";

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function pageDocument(args: {
  basePath: string;
  title: string;
  body: string;
  extraScript?: string;
  lang?: SiteLang;
}): string {
  const scripts = [OBSERVATION_EVENT_BOOT_SCRIPT, args.extraScript ?? ""].filter(Boolean).join("\n");
  return renderSiteDocument({
    basePath: args.basePath,
    title: args.title,
    extraStyles: OBSERVATION_EVENT_STYLES,
    lang: args.lang,
    body: `${args.body}<script>${scripts}</script>`,
  });
}

function langOf(request: { url?: string; raw?: { url?: string } }): SiteLang {
  return detectLangFromUrl(String(request.raw?.url ?? request.url ?? ""));
}

async function loadTeamsLite(sessionId: string): Promise<Array<{ teamId: string; name: string; color: string; memberCount: number }>> {
  const pool = getPool();
  const result = await pool.query<{
    team_id: string;
    name: string;
    color: string;
    member_count: string;
  }>(
    `SELECT t.team_id, t.name, t.color,
            COALESCE((SELECT COUNT(*)::text FROM observation_event_participants p WHERE p.team_id = t.team_id), '0') AS member_count
     FROM observation_event_teams t
     WHERE t.session_id = $1
     ORDER BY t.created_at`,
    [sessionId],
  );
  return result.rows.map((r) => ({
    teamId: r.team_id,
    name: r.name,
    color: r.color,
    memberCount: Number(r.member_count),
  }));
}

async function loadRecentSessions(limit = 24): Promise<ObservationEventSessionRow[]> {
  try {
    const pool = getPool();
    const result = await pool.query<{ session_id: string }>(
      `SELECT session_id
       FROM observation_event_sessions
       ORDER BY started_at DESC
       LIMIT $1`,
      [limit],
    );
    const sessions: ObservationEventSessionRow[] = [];
    for (const row of result.rows) {
      const s = await getSessionById(row.session_id).catch(() => null);
      if (s) sessions.push(s);
    }
    return sessions;
  } catch {
    return [];
  }
}

export async function registerObservationEventPagesRoutes(app: FastifyInstance): Promise<void> {
  // /community/events  --- 一覧
  app.get("/community/events", async (request, reply) => {
    const sessions = await loadRecentSessions();
    const lang = langOf(request);
    const strings = getStrings(lang).observationEvent;
    const html = pageDocument({
      basePath: "",
      title: `${strings.listEyebrow} — ikimon.life`,
      body: renderEventListBody(sessions, strings, lang),
      lang,
    });
    reply.type("text/html; charset=utf-8");
    return html;
  });

  // /community/events/:eventCode/join  --- チェックイン画面
  app.get<{ Params: { eventCode: string } }>(
    "/community/events/:eventCode/join",
    async (request, reply) => {
      const session = await getSessionByEventCode(request.params.eventCode).catch(() => null);
      if (!session) {
        reply.code(404);
        reply.type("text/html; charset=utf-8");
        return pageDocument({
          basePath: "",
          title: "観察会 — 見つかりません",
          body: `<section class="evt-recap-shell">
            <article class="evt-card">
              <span class="evt-eyebrow">観察会</span>
              <h1 class="evt-heading">この参加コードは見つかりませんでした。</h1>
              <p class="evt-lead">主催者にコードを再度確認するか、<a href="/community/events">観察会一覧</a>から探してください。</p>
            </article>
          </section>`,
        });
      }
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      const teams = await loadTeamsLite(session.sessionId).catch(() => []);
      const html = pageDocument({
        basePath: "",
        title: `${session.title || "観察会"} に参加 — ikimon.life`,
        body: renderCheckinBody({ session, teams, isAuthenticated: Boolean(auth) }),
        extraScript: checkinScript(),
      });
      reply.type("text/html; charset=utf-8");
      return html;
    },
  );

  // /events/:sessionId/live  --- 参加者ライブ画面
  app.get<{ Params: { sessionId: string }; Querystring: { token?: string } }>(
    "/events/:sessionId/live",
    async (request, reply) => {
      const session = await getSessionById(request.params.sessionId).catch(() => null);
      if (!session) {
        reply.code(404);
        reply.type("text/html; charset=utf-8");
        return pageDocument({
          basePath: "",
          title: "観察会 — セッションが見つかりません",
          body: `<section class="evt-recap-shell"><article class="evt-card"><h1 class="evt-heading">セッションが見つかりません</h1></article></section>`,
        });
      }
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      const html = pageDocument({
        basePath: "",
        title: `${session.title || "観察会"} ライブ — ikimon.life`,
        body: renderObservationEventLiveBody({
          session,
          participantSelfId: null,
          isOrganizer: auth ? auth.userId === session.organizerUserId : false,
          guestToken: asString(request.query.token),
        }),
        extraScript: observationEventLiveScript(),
      });
      reply.type("text/html; charset=utf-8");
      return html;
    },
  );

  // /events/:sessionId/console  --- 主催者管制塔
  app.get<{ Params: { sessionId: string } }>(
    "/events/:sessionId/console",
    async (request, reply) => {
      const session = await getSessionById(request.params.sessionId).catch(() => null);
      if (!session) {
        reply.code(404);
        reply.type("text/html; charset=utf-8");
        return pageDocument({
          basePath: "",
          title: "観察会 — セッションが見つかりません",
          body: `<section class="evt-recap-shell"><article class="evt-card"><h1 class="evt-heading">セッションが見つかりません</h1></article></section>`,
        });
      }
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      if (!auth || auth.userId !== session.organizerUserId) {
        reply.code(403);
        reply.type("text/html; charset=utf-8");
        return pageDocument({
          basePath: "",
          title: "観察会 — 権限がありません",
          body: `<section class="evt-recap-shell">
            <article class="evt-card">
              <span class="evt-eyebrow">権限が必要です</span>
              <h1 class="evt-heading">主催者のみアクセス可能</h1>
              <p class="evt-lead">主催者アカウントでログインしてから再度開いてください。</p>
              <a class="evt-btn evt-btn-primary" href="/auth">ログインへ</a>
            </article>
          </section>`,
        });
      }
      const html = pageDocument({
        basePath: "",
        title: `${session.title || "観察会"} 管制塔 — ikimon.life`,
        body: renderOrganizerConsoleBody(session),
        extraScript: organizerConsoleScript(),
      });
      reply.type("text/html; charset=utf-8");
      return html;
    },
  );

  // /events/:sessionId/recap  --- 振り返り(永続)
  app.get<{ Params: { sessionId: string }; Querystring: { token?: string } }>(
    "/events/:sessionId/recap",
    async (request, reply) => {
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      const recap = await buildRecap(request.params.sessionId, {
        viewerUserId: auth?.userId ?? null,
        viewerGuestToken: asString(request.query.token),
      }).catch(() => null);
      if (!recap) {
        reply.code(404);
        reply.type("text/html; charset=utf-8");
        return pageDocument({
          basePath: "",
          title: "観察会 — 振り返りなし",
          body: `<section class="evt-recap-shell"><article class="evt-card"><h1 class="evt-heading">振り返りが見つかりません</h1></article></section>`,
        });
      }
      const html = pageDocument({
        basePath: "",
        title: `${recap.session.title || "観察会"} の振り返り — ikimon.life`,
        body: renderRecapBody(recap),
        extraScript: recapScript(),
      });
      reply.type("text/html; charset=utf-8");
      return html;
    },
  );
}
