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
import {
  renderEventCreateBody,
  eventCreateScript,
} from "../ui/observationEventCreate.js";
import {
  renderEventEditBody,
  eventEditScript,
} from "../ui/observationEventEdit.js";
import { renderFieldListBody } from "../ui/observationFieldList.js";
import {
  renderFieldDetailBody,
  fieldDetailScript,
} from "../ui/observationFieldDetail.js";
import {
  getField,
  getFieldStats,
  listFields,
  listPrefectureBuckets,
  searchFieldsByName,
  type FieldSource,
} from "../services/observationFieldRegistry.js";
import { getPlaceSnapshot } from "../services/placeSnapshot.js";
import {
  PLACE_SNAPSHOT_STYLES,
  renderPlaceSnapshotBody,
} from "../ui/placeSnapshot.js";

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function pageDocument(args: {
  basePath: string;
  title: string;
  body: string;
  extraScript?: string;
  extraStyles?: string;
  lang?: SiteLang;
}): string {
  const scripts = [OBSERVATION_EVENT_BOOT_SCRIPT, args.extraScript ?? ""].filter(Boolean).join("\n");
  return renderSiteDocument({
    basePath: args.basePath,
    title: args.title,
    extraStyles: `${OBSERVATION_EVENT_STYLES}\n${args.extraStyles ?? ""}`,
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
  // /places/:fieldId/snapshot  --- Place Twin Layer の公開スナップショット
  app.get<{ Params: { fieldId: string } }>(
    "/places/:fieldId/snapshot",
    async (request, reply) => {
      const lang = langOf(request);
      const snapshot = await getPlaceSnapshot(request.params.fieldId).catch(() => null);
      if (!snapshot) {
        reply.code(404);
        reply.type("text/html; charset=utf-8");
        return renderSiteDocument({
          basePath: "",
          title: "この場所のいま — 見つかりません",
          extraStyles: PLACE_SNAPSHOT_STYLES,
          lang,
          body: `<main class="ps-shell"><section class="ps-hero"><div><div class="ps-eyebrow">この場所のいま</div><h1>フィールドが見つかりません</h1><p>フィールドDBから対象の場所を選び直してください。</p></div></section></main>`,
        });
      }
      reply.type("text/html; charset=utf-8");
      return renderSiteDocument({
        basePath: "",
        title: `${snapshot.field.name} — この場所のいま — ikimon.life`,
        description: `${snapshot.field.name}の観察データ、季節、仮説、次の一手を1枚で読む場所のスナップショットです。`,
        extraStyles: PLACE_SNAPSHOT_STYLES,
        lang,
        body: renderPlaceSnapshotBody(snapshot),
      });
    },
  );

  // /community/events/new  --- 作成フォーム(主催者ログイン必要)
  app.get("/community/events/new", async (request, reply) => {
    const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    const lang = langOf(request);
    const strings = getStrings(lang).observationEvent;
    reply.type("text/html; charset=utf-8");
    return pageDocument({
      basePath: "",
      title: `${strings.listCreateCta} — ikimon.life`,
      body: renderEventCreateBody({ isAuthenticated: Boolean(auth), strings }),
      extraScript: eventCreateScript(),
      lang,
    });
  });

  // /events/:sessionId/edit  --- 編集(主催者のみ)
  app.get<{ Params: { sessionId: string } }>(
    "/events/:sessionId/edit",
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
          title: "編集 — 権限がありません",
          body: `<section class="evt-recap-shell">
            <article class="evt-card">
              <span class="evt-eyebrow">権限が必要です</span>
              <h1 class="evt-heading">主催者のみ編集できます</h1>
              <p class="evt-lead">主催者アカウントでログインしてから再度開いてください。</p>
              <a class="evt-btn evt-btn-primary" href="/auth">ログインへ</a>
            </article>
          </section>`,
        });
      }
      const lang = langOf(request);
      const strings = getStrings(lang).observationEvent;
      reply.type("text/html; charset=utf-8");
      return pageDocument({
        basePath: "",
        title: `${session.title || "観察会"} 編集 — ikimon.life`,
        body: renderEventEditBody({ session, strings }),
        extraScript: eventEditScript(),
        lang,
      });
    },
  );

  // /community/fields  --- フィールド一覧(都道府県/種別フィルタ)
  app.get<{
    Querystring: { prefecture?: string; source?: string; q?: string; offset?: string };
  }>("/community/fields", async (request, reply) => {
    const lang = langOf(request);
    const prefecture = request.query.prefecture && request.query.prefecture.length > 0 ? request.query.prefecture : undefined;
    const sourceRaw = request.query.source;
    const source = sourceRaw === "user_defined" || sourceRaw === "nature_symbiosis_site" ||
      sourceRaw === "tsunag" || sourceRaw === "protected_area" || sourceRaw === "oecm"
      ? (sourceRaw as FieldSource)
      : undefined;
    const query = request.query.q && request.query.q.length > 0 ? request.query.q : undefined;
    let fields: Awaited<ReturnType<typeof listFields>>;
    let prefectures: Awaited<ReturnType<typeof listPrefectureBuckets>> = [];
    try {
      [fields, prefectures] = await Promise.all([
        query
          ? searchFieldsByName(query, 60)
          : listFields({ prefecture, source, limit: 60 }),
        listPrefectureBuckets(),
      ]);
    } catch {
      fields = [];
      prefectures = [];
    }

    const html = pageDocument({
      basePath: "",
      title: "フィールド DB — ikimon.life",
      body: renderFieldListBody({
        fields,
        prefectures,
        filter: { prefecture, source: source ?? sourceRaw, query },
      }),
      lang,
    });
    reply.type("text/html; charset=utf-8");
    return html;
  });

  // /community/fields/:fieldId  --- フィールド詳細
  app.get<{ Params: { fieldId: string } }>(
    "/community/fields/:fieldId",
    async (request, reply) => {
      const field = await getField(request.params.fieldId).catch(() => null);
      if (!field) {
        reply.code(404);
        reply.type("text/html; charset=utf-8");
        return pageDocument({
          basePath: "",
          title: "フィールド — 見つかりません",
          body: `<section class="evt-recap-shell">
            <article class="evt-card">
              <span class="evt-eyebrow">フィールド</span>
              <h1 class="evt-heading">このフィールドは見つかりませんでした。</h1>
              <a class="evt-btn evt-btn-primary" href="/community/fields">フィールド一覧へ</a>
            </article>
          </section>`,
        });
      }
      const [stats, snapshot] = await Promise.all([
        getFieldStats(field.fieldId).catch(() => null),
        getPlaceSnapshot(field.fieldId).catch(() => null),
      ]);
      if (!stats) {
        reply.code(500);
        reply.type("text/html; charset=utf-8");
        return pageDocument({
          basePath: "",
          title: "フィールド — 集計できません",
          body: `<section class="evt-recap-shell"><article class="evt-card"><h1 class="evt-heading">集計に失敗しました</h1></article></section>`,
        });
      }
      const lang = langOf(request);
      reply.type("text/html; charset=utf-8");
      return pageDocument({
        basePath: "",
        title: `${field.name} — フィールド DB — ikimon.life`,
        body: renderFieldDetailBody({ field, stats, snapshot }),
        extraStyles: PLACE_SNAPSHOT_STYLES,
        extraScript: fieldDetailScript(),
        lang,
      });
    },
  );

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
