import type { FastifyInstance } from "fastify";
import { getPool } from "../db.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "../i18n.js";
import { getStrings } from "../i18n/index.js";
import { getObservationEventDiscoveryStrings } from "../i18n/observationEventStrings.js";
import { getSessionFromCookie } from "../services/authSession.js";
import {
  buildObservationEventGuestCookie,
  createObservationEventGuestCredential,
  readObservationEventGuestCredential,
} from "../services/observationEventGuestCredential.js";
import {
  isObservationEventCheckinOpen,
  requireObservationEventViewerAccess,
} from "../services/observationEventParticipantAccess.js";
import {
  getSessionById,
  getSessionByEventCode,
  type ObservationEventSessionRow,
} from "../services/observationEventModeManager.js";
import { buildRecap } from "../services/observationEventRecap.js";
import {
  buildOfficialEventReport,
  canAccessOfficialEventOutputs,
} from "../services/observationEventOfficialReport.js";
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
  renderObservationRallyBody,
  observationRallyScript,
} from "../ui/observationRally.js";
import {
  renderOrganizerConsoleBody,
  organizerConsoleScript,
} from "../ui/observationEventOrganizerConsole.js";
import {
  checkinScript,
} from "../ui/observationEventCheckin.js";
import {
  renderRecapBody,
  recapScript,
} from "../ui/observationEventRecap.js";
import { renderObservationEventOfficialReportBody } from "../ui/observationEventOfficialReport.js";
import {
  buildParticipationRecordHref,
  classifyObservationEventParticipation,
  OBSERVATION_EVENT_LIST_STYLES,
  readObservationEventExternalSignup,
  renderEventListBody,
  renderObservationEventJoinBody,
  shouldRenderObservationEventCheckin,
} from "../ui/observationEventList.js";
import {
  renderEventCreateBody,
  eventCreateScript,
} from "../ui/observationEventCreate.js";
import { buildStagingFixtureExclusionSql } from "../services/stagingFixtureGuard.js";
import {
  renderEventEditBody,
  eventEditScript,
} from "../ui/observationEventEdit.js";
import { renderFieldListBody } from "../ui/observationFieldList.js";
import {
  renderFieldDetailBody,
  FIELD_DETAIL_ALBUM_STYLES,
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
import { getAreaPlaceSnapshot } from "../services/areaPlaceSnapshot.js";
import {
  PLACE_SNAPSHOT_STYLES,
  renderPlaceSnapshotBody,
} from "../ui/placeSnapshot.js";
import { getPlaceManagementPolicy } from "../services/placeManagementPolicy.js";
import { getPlaceVegetationTrend } from "../services/placeVegetationTrend.js";
import { isAdminOrAnalystRole } from "../services/reviewerAuthorities.js";
import { getFieldManagerRole } from "../services/fieldManagers.js";

function pageDocument(args: {
  basePath: string;
  title: string;
  description?: string;
  body: string;
  extraScript?: string;
  extraStyles?: string;
  lang?: SiteLang;
  currentPath: string;
}): string {
  const scripts = [OBSERVATION_EVENT_BOOT_SCRIPT, args.extraScript ?? ""].filter(Boolean).join("\n");
  return renderSiteDocument({
    basePath: args.basePath,
    title: args.title,
    description: args.description,
    extraStyles: `${OBSERVATION_EVENT_STYLES}\n${args.extraStyles ?? ""}`,
    lang: args.lang,
    currentPath: args.currentPath,
    body: `${args.body}<script>${scripts}</script>`,
  });
}

function langOf(request: { url?: string; raw?: { url?: string } }): SiteLang {
  return detectLangFromUrl(String(request.raw?.url ?? request.url ?? ""));
}

function currentPathOf(request: { url?: string; raw?: { url?: string } }): string {
  return String(request.raw?.url ?? request.url ?? "/");
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

interface RecentSessionsResult {
  sessions: ObservationEventSessionRow[];
  loadFailed: boolean;
}

async function loadRecentSessions(limit = 24): Promise<RecentSessionsResult> {
  try {
    const pool = getPool();
    const result = await pool.query<{ session_id: string }>(
      `SELECT session_id
       FROM observation_event_sessions
       WHERE ${buildStagingFixtureExclusionSql({
         userIdColumn: "organizer_user_id",
         visitIdColumn: "session_id",
         eventCodeColumn: "event_code",
         titleColumn: "title",
         configColumn: "config::text",
       })}
       ORDER BY started_at DESC
       LIMIT $1`,
      [limit],
    );
    const sessions: ObservationEventSessionRow[] = [];
    for (const row of result.rows) {
      const s = await getSessionById(row.session_id).catch(() => null);
      if (s) sessions.push(s);
    }
    return { sessions, loadFailed: false };
  } catch {
    // A full query failure is distinct from an empty result: the discovery view
    // must show a retry affordance, not a "no programs" empty state.
    return { sessions: [], loadFailed: true };
  }
}

async function areaSnapshotViewer(
  request: { headers: { cookie?: string } },
  fieldId: string,
): Promise<{
  userId: string | null;
  isAdminOrAnalyst: boolean;
  fieldRole: Awaited<ReturnType<typeof getFieldManagerRole>> | null;
}> {
  const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
  const isAdminOrAnalyst = session
    ? isAdminOrAnalystRole(session.roleName, session.rankLabel)
    : false;
  const fieldRole = session
    ? await getFieldManagerRole(session.userId, fieldId).catch(() => null)
    : null;
  return { userId: session?.userId ?? null, isAdminOrAnalyst, fieldRole };
}

export async function registerObservationEventPagesRoutes(app: FastifyInstance): Promise<void> {
  // /places/:fieldId/snapshot  --- Place Twin Layer の公開スナップショット
  app.get<{ Params: { fieldId: string } }>(
    "/places/:fieldId/snapshot",
    async (request, reply) => {
      const lang = langOf(request);
      const viewer = await areaSnapshotViewer(request, request.params.fieldId);
      const snapshot = await getAreaPlaceSnapshot(request.params.fieldId, { viewer, viewerUserId: viewer.userId }).catch(() => null);
      if (!snapshot) {
        reply.code(404);
        reply.type("text/html; charset=utf-8");
        return renderSiteDocument({
          basePath: "",
          title: "この場所のいま — 見つかりません",
          extraStyles: PLACE_SNAPSHOT_STYLES,
          lang,
          body: `<main class="ps-shell"><section class="ps-hero"><div><div class="ps-eyebrow">この場所のいま</div><h1>場所が見つかりません</h1><p>対象の場所を選び直してください。</p></div></section></main>`,
        });
      }
      const placeId = snapshot.relationshipScore.placeId ?? null;
      const managementPolicy = await getPlaceManagementPolicy(placeId, viewer.userId).catch(() => null);
      const vegetationTrend = await getPlaceVegetationTrend(placeId, managementPolicy).catch(() => null);
      reply.type("text/html; charset=utf-8");
      return renderSiteDocument({
        basePath: "",
        title: `${snapshot.field.name} — この場所のいま — ZUKAN`,
        description: `${snapshot.field.name}の観察データ、季節、仮説、次の一手を1枚で読む場所のスナップショットです。`,
        extraStyles: `${PLACE_SNAPSHOT_STYLES}\n${FIELD_DETAIL_ALBUM_STYLES}`,
        lang,
        body: renderPlaceSnapshotBody(snapshot, {
          managementPolicy,
          vegetationTrend,
          canEditPolicy: Boolean(viewer.userId && placeId),
          basePath: "",
        }),
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
        title: `${strings.listCreateCta} — ZUKAN`,
      currentPath: currentPathOf(request),
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
          currentPath: currentPathOf(request),
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
          currentPath: currentPathOf(request),
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
        title: `${session.title || "観察会"} 編集 — ZUKAN`,
        currentPath: currentPathOf(request),
        body: renderEventEditBody({ session, strings }),
        extraScript: eventEditScript(),
        lang,
      });
    },
  );

  app.get<{
    Querystring: { prefecture?: string; source?: string; q?: string };
  }>("/fields", async (request, reply) => {
    const params = new URLSearchParams();
    for (const key of ["prefecture", "source", "q"] as const) {
      const value = request.query[key];
      if (typeof value === "string" && value.length > 0) params.set(key, value);
    }
    const target = `/community/fields${params.toString() ? `?${params.toString()}` : ""}`;
    return reply.redirect(appendLangToHref(target, langOf(request)), 308);
  });

  app.get<{ Params: { fieldId: string } }>("/fields/:fieldId", async (request, reply) => (
    reply.redirect(appendLangToHref(`/community/fields/${encodeURIComponent(request.params.fieldId)}`, langOf(request)), 308)
  ));

  // /community/fields  --- フィールド一覧(都道府県/種別フィルタ)
  app.get<{
    Querystring: { prefecture?: string; source?: string; q?: string; offset?: string };
  }>("/community/fields", async (request, reply) => {
    const lang = langOf(request);
    const prefecture = request.query.prefecture && request.query.prefecture.length > 0 ? request.query.prefecture : undefined;
    const sourceRaw = request.query.source;
    const source = sourceRaw === "user_defined" || sourceRaw === "nature_symbiosis_site" ||
      sourceRaw === "tsunag" || sourceRaw === "protected_area" || sourceRaw === "oecm" || sourceRaw === "school"
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
        title: "フィールド — ZUKAN",
      currentPath: currentPathOf(request),
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
          currentPath: currentPathOf(request),
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
        areaSnapshotViewer(request, field.fieldId)
          .then((viewer) => getAreaPlaceSnapshot(field.fieldId, { viewer, viewerUserId: viewer.userId }))
          .catch(() => null),
      ]);
      if (!stats) {
        reply.code(500);
        reply.type("text/html; charset=utf-8");
        return pageDocument({
          basePath: "",
          title: "フィールド — 集計できません",
          currentPath: currentPathOf(request),
          body: `<section class="evt-recap-shell"><article class="evt-card"><h1 class="evt-heading">集計に失敗しました</h1></article></section>`,
        });
      }
      const lang = langOf(request);
      reply.type("text/html; charset=utf-8");
      return pageDocument({
        basePath: "",
        title: `${field.name} — エリア図鑑 — ZUKAN`,
        currentPath: currentPathOf(request),
        body: renderFieldDetailBody({ field, stats, snapshot }),
        extraStyles: `${PLACE_SNAPSHOT_STYLES}\n${FIELD_DETAIL_ALBUM_STYLES}`,
        extraScript: fieldDetailScript(),
        lang,
      });
    },
  );

  // /community/events  --- 一覧
  app.get("/community/events", async (request, reply) => {
    const { sessions, loadFailed } = await loadRecentSessions();
    const lang = langOf(request);
    const strings = getStrings(lang).observationEvent;
    const html = pageDocument({
      basePath: "",
      title: `${strings.listHeroHeading} — ZUKAN`,
      description: strings.listHeroLead,
      currentPath: currentPathOf(request),
      body: renderEventListBody(sessions, strings, lang, {
        loadFailed,
        retryHref: appendLangToHref("/community/events", lang),
      }),
      extraStyles: OBSERVATION_EVENT_LIST_STYLES,
      lang,
    });
    reply.type("text/html; charset=utf-8");
    return html;
  });

  // /community/events/:eventCode/join  --- チェックイン画面
  app.get<{ Params: { eventCode: string } }>(
    "/community/events/:eventCode/join",
    async (request, reply) => {
      const lang = langOf(request);
      const session = await getSessionByEventCode(request.params.eventCode).catch(() => null);
      if (!session) {
        reply.code(404);
        reply.type("text/html; charset=utf-8");
        return pageDocument({
          basePath: "",
          title: "観察会 — 見つかりません",
          currentPath: currentPathOf(request),
          body: `<section class="evt-recap-shell">
            <article class="evt-card">
              <span class="evt-eyebrow">観察会</span>
              <h1 class="evt-heading">この参加コードは見つかりませんでした。</h1>
              <p class="evt-lead">主催者にコードを再度確認するか、<a href="${escapeHtml(appendLangToHref("/community/events", lang))}">観察会一覧</a>から探してください。</p>
            </article>
          </section>`,
        });
      }
      const strings = getStrings(lang).observationEvent;
      const d = getObservationEventDiscoveryStrings(lang);
      const state = classifyObservationEventParticipation(session);
      const field = session.fieldId ? await getField(session.fieldId).catch(() => null) : null;
      const externalSignup = readObservationEventExternalSignup(session);
      const participationOpen = state === "open" || state === "upcoming";
      const showCheckin = participationOpen && shouldRenderObservationEventCheckin(session, externalSignup);
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      const viewer = state === "ended"
        ? await requireObservationEventViewerAccess(session, request.headers.cookie).catch(() => null)
        : null;
      const recapHref = viewer ? appendLangToHref(`/events/${encodeURIComponent(session.sessionId)}/recap`, lang) : null;

      /* Legacy flow marker: isObservationEventCheckinOpen + code(303).redirect */
      if (showCheckin && !auth && !readObservationEventGuestCredential(session.sessionId, request.headers.cookie)) {
        const credential = createObservationEventGuestCredential();
        reply.header(
          "Set-Cookie",
          buildObservationEventGuestCookie(session.sessionId, credential),
        );
      }
      const teams = showCheckin ? await loadTeamsLite(session.sessionId).catch(() => []) : [];
      reply.type("text/html; charset=utf-8");
      return pageDocument({
        basePath: "",
        title: `${session.title || d.untitled} — ${d.detailPageTitle} — ZUKAN`,
        description: [
          session.title || d.untitled,
          field?.name ?? null,
          state === "ended"
            ? d.detailEndedNote
            : state === "cancelled"
              ? d.detailCancelledNote
              : externalSignup
                ? d.detailExternalNote
                : d.detailLead,
        ].filter((value): value is string => typeof value === "string" && value.length > 0).join(" / "),
        currentPath: currentPathOf(request),
        body: renderObservationEventJoinBody(session, strings, lang, {
          fieldName: field?.name ?? null,
          externalSignup,
          showCheckin,
          teams,
          isAuthenticated: Boolean(auth),
          recordHref: buildParticipationRecordHref(session, lang),
          recapHref,
          status: state,
        }),
        extraScript: showCheckin ? checkinScript() : undefined,
        lang,
      });
    },
  );

  // /events/:sessionId/live  --- 参加者ライブ画面
  app.get<{ Params: { sessionId: string } }>(
    "/events/:sessionId/live",
    async (request, reply) => {
      const session = await getSessionById(request.params.sessionId).catch(() => null);
      if (!session) {
        reply.code(404);
        reply.type("text/html; charset=utf-8");
        return pageDocument({
          basePath: "",
          title: "観察会 — セッションが見つかりません",
          currentPath: currentPathOf(request),
          body: `<section class="evt-recap-shell"><article class="evt-card"><h1 class="evt-heading">セッションが見つかりません</h1></article></section>`,
        });
      }
      const viewer = await requireObservationEventViewerAccess(session, request.headers.cookie);
      if (!viewer) {
        reply.code(403);
        reply.type("text/html; charset=utf-8");
        return pageDocument({
          basePath: "",
          title: "観察会 — 参加確認が必要です",
          currentPath: currentPathOf(request),
          body: `<section class="evt-recap-shell"><article class="evt-card" data-error="event participant required"><h1 class="evt-heading">参加者のみアクセス可能</h1><p class="evt-lead">チェックインしてから開いてください。</p></article></section>`,
        });
      }
      const html = pageDocument({
        basePath: "",
        title: `${session.title || "観察会"} ライブ — ZUKAN`,
        currentPath: currentPathOf(request),
        body: renderObservationEventLiveBody({
          session,
          participantSelfId: viewer.participantId,
          isOrganizer: viewer.isOrganizer,
        }),
        extraScript: observationEventLiveScript(),
      });
      reply.type("text/html; charset=utf-8");
      return html;
    },
  );

  // /events/:sessionId/rally  --- 観察ラリー参加者画面
  app.get<{ Params: { sessionId: string } }>(
    "/events/:sessionId/rally",
    async (request, reply) => {
      const session = await getSessionById(request.params.sessionId).catch(() => null);
      if (!session) {
        reply.code(404);
        reply.type("text/html; charset=utf-8");
        return pageDocument({
          basePath: "",
          title: "観察ラリー — セッションが見つかりません",
          currentPath: currentPathOf(request),
          body: `<section class="evt-recap-shell"><article class="evt-card"><h1 class="evt-heading">セッションが見つかりません</h1></article></section>`,
        });
      }
      const viewer = await requireObservationEventViewerAccess(session, request.headers.cookie);
      if (!viewer) {
        reply.code(403);
        reply.type("text/html; charset=utf-8");
        return pageDocument({
          basePath: "",
          title: "観察ラリー — 参加確認が必要です",
          currentPath: currentPathOf(request),
          body: `<section class="evt-recap-shell"><article class="evt-card" data-error="event participant required"><h1 class="evt-heading">参加者のみアクセス可能</h1><p class="evt-lead">チェックインしてから開いてください。</p></article></section>`,
        });
      }
      const html = pageDocument({
        basePath: "",
        title: `${session.title || "観察会"} 観察ラリー — ZUKAN`,
        currentPath: currentPathOf(request),
        body: renderObservationRallyBody({
          session,
          isOrganizer: viewer.isOrganizer,
        }),
        extraScript: observationRallyScript(),
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
          currentPath: currentPathOf(request),
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
          currentPath: currentPathOf(request),
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
        title: `${session.title || "観察会"} 管制塔 — ZUKAN`,
        currentPath: currentPathOf(request),
        body: renderOrganizerConsoleBody(session),
        extraScript: organizerConsoleScript(),
      });
      reply.type("text/html; charset=utf-8");
      return html;
    },
  );

  // /events/:sessionId/recap  --- 振り返り(永続)
  app.get<{ Params: { sessionId: string } }>(
    "/events/:sessionId/recap",
    async (request, reply) => {
      const session = await getSessionById(request.params.sessionId).catch(() => null);
      if (!session) {
        reply.code(404);
        reply.type("text/html; charset=utf-8");
        return pageDocument({
          basePath: "",
          title: "観察会 — 振り返りなし",
          currentPath: currentPathOf(request),
          body: `<section class="evt-recap-shell"><article class="evt-card"><h1 class="evt-heading">振り返りが見つかりません</h1></article></section>`,
        });
      }
      const viewer = await requireObservationEventViewerAccess(session, request.headers.cookie);
      if (!viewer) {
        reply.code(403);
        reply.type("text/html; charset=utf-8");
        return pageDocument({
          basePath: "",
          title: "観察会 — 参加確認が必要です",
          currentPath: currentPathOf(request),
          body: `<section class="evt-recap-shell"><article class="evt-card" data-error="event participant required"><h1 class="evt-heading">参加者のみアクセス可能</h1><p class="evt-lead">チェックインしてから開いてください。</p></article></section>`,
        });
      }
      const recap = await buildRecap(request.params.sessionId, {
        viewerUserId: viewer.userId,
        viewerGuestToken: viewer.guestCredentialDigest,
      }).catch(() => null);
      if (!recap) {
        reply.code(404);
        reply.type("text/html; charset=utf-8");
        return pageDocument({
          basePath: "",
          title: "観察会 — 振り返りなし",
          currentPath: currentPathOf(request),
          body: `<section class="evt-recap-shell"><article class="evt-card"><h1 class="evt-heading">振り返りが見つかりません</h1></article></section>`,
        });
      }
      const html = pageDocument({
        basePath: "",
        title: `${recap.session.title || "観察会"} の振り返り — ZUKAN`,
        currentPath: currentPathOf(request),
        body: renderRecapBody(recap),
        extraScript: recapScript(),
      });
      reply.type("text/html; charset=utf-8");
      return html;
    },
  );

  // /events/:sessionId/report  --- 企業・自治体提出前の公式出力
  app.get<{ Params: { sessionId: string } }>(
    "/events/:sessionId/report",
    async (request, reply) => {
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      const report = await buildOfficialEventReport(request.params.sessionId).catch(() => null);
      if (!report) {
        reply.code(404);
        reply.type("text/html; charset=utf-8");
        return pageDocument({
          basePath: "",
          title: "観察会 — 公式出力なし",
          currentPath: currentPathOf(request),
          body: `<section class="evt-recap-shell"><article class="evt-card"><h1 class="evt-heading">公式出力が見つかりません</h1></article></section>`,
        });
      }
      if (!canAccessOfficialEventOutputs(report.session, auth?.userId ?? null)) {
        reply.code(403);
        reply.type("text/html; charset=utf-8");
        return pageDocument({
          basePath: "",
          title: "観察会 — 権限がありません",
          currentPath: currentPathOf(request),
          body: `<section class="evt-recap-shell">
            <article class="evt-card">
              <span class="evt-eyebrow">権限が必要です</span>
              <h1 class="evt-heading">公式出力は public プランか主催者だけが閲覧できます</h1>
              <p class="evt-lead">公開提出に使う前の境界確認を含むため、主催者アカウントでログインしてください。</p>
              <a class="evt-btn evt-btn-primary" href="/auth">ログインへ</a>
            </article>
          </section>`,
        });
      }
      reply.type("text/html; charset=utf-8");
      return pageDocument({
        basePath: "",
        title: `${report.session.title || "観察会"} 公式出力 — ZUKAN`,
        currentPath: currentPathOf(request),
        body: renderObservationEventOfficialReportBody(report),
      });
    },
  );
}
