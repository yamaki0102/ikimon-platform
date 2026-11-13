import { assertSameOriginRequest, escapeHtml, html, json, normalizeOptionalText, randomToken, readJson, redirect303 } from "../core/http";
import type { Env } from "../core/env";
import { RYUYO_DISCOVERY_TITLE, renderObservationEventDiscoveryCampaign, renderObservationEventDiscoveryCapture, renderObservationEventDiscoveryGallery, renderObservationEventDiscoveryJoin, renderObservationEventDiscoveryPrint } from "../../../src/ui/observationEventDiscovery";
import { handleEventTemplatePreviewPage } from "../eventTemplatePages";
import { COMMON_EVENT_TEMPLATE_CONTRACT_VERSION, COMMON_EVENT_TEMPLATE_LABELS, isCommonEventTemplateConfig, isCommonEventTemplateKey } from "../../../src/services/commonEventTemplateContract";
import { decodePublicProgramHandoffPayload } from "../publicProgramReceiver";
import { publicProgramConfirmationError, publicProgramConfirmationTitle, renderPublicProgramConfirmationBody } from "../publicProgramConfirmation";
import type { ObservationEventSessionRow } from "../../../src/services/observationEventModeManager";
import { getObservationEventStrings } from "../../../src/i18n/observationEventStrings";
import { OBSERVATION_EVENT_LIST_STYLES, renderEventListBody } from "../../../src/ui/observationEventList";
import { RYUYO_DISCOVERY_GEMINI_NOTICE_VERSION, discoveryNickname, isEventDiscoveryProfile } from "../eventDiscovery";
import { RYUYO_FIELD_ID } from "../areaEncyclopediaNative";
import { FRONTEND_FOUNDATION_CSS } from "../../../src/ui/frontendFoundation";
import { APP_EXPERIENCE_STYLES, renderAppExperienceHeader, renderAppExperienceNavigation } from "../../../src/ui/appExperience";
import { OBSERVATION_EVENT_STYLES } from "../../../src/ui/observationEventStyles";
import type { CommonEventTemplateKey } from "../../../src/services/commonEventTemplateContract";
import { renderObservationEventTemplateOrganizer } from "../../../src/ui/observationEventTemplateOrganizer";
import { observationRallyScript, renderObservationRallyBody } from "../../../src/ui/observationRally";
import { applyCspNonceToHtmlScripts, asPlainObject, browserSecurityHeaders, createHtmlCspNonce, getFieldManagerRoleFromD1, isD1UniqueConstraintError, isMunicipalWalkMapAdminRole, langQueryToUrlSegment, publicLangFromPath, readCompatibleSession, safeRedirectPath, stripPublicLangPrefix, type SessionSnapshot } from "../core/shared";
import { buildObservationEventGuestCookie, buildObservationEventOperationsDashboard, claimObservationEventGuestParticipant, findObservationEventParticipant, getObservationEventSessionById, isObservationEventActivityOpen, isObservationEventCheckinOpen, listObservationEventLiveEvents, listObservationEventTeams, mapObservationEventSession, observationEventGuestCredentialDigest, observationEventLiveParticipantDetail, observationEventParticipantContext, publicObservationEventLiveEvent, readObservationEventGuestCredential, recordObservationEventParticipantPageMetric, recordObservationEventServerFunnelMetric, requireObservationEventOrganizer, serverObservationEventFunnelContext, shouldDeliverObservationEvent, summarizePublicObservationEventLive, type ObservationEventParticipantD1Row, type ObservationEventSessionD1Row, type ObservationEventTeamD1Row, type ObservationEventTemplate, type PublicObservationEventLiveEvent } from "./runtime";
import { getObservationEventGuestMedia, getObservationEventSessionByEventCode, getObservationRallyCourseBySession, getObservationRallySnapshot, isObservationEventQaFixture, isPrivateReceivedProgram, isRyuyoDiscoveryEvent, mapObservationRallyCourse, mapObservationRallyMission, mapObservationRallyProgress, mapObservationRallyStation, observationEventGuestMediaActor, observationEventGuestMediaEnabled } from "./rally";
import { DISCOVERY_CAMPAIGN_VERSION, buildObservationEventOfficialReport, discoveryCampaignConfig, getObservationEventRecap, hasProfessionalReportEntitlement, summarizeObservationEventEffort } from "./sessions";

const SYNTHETIC_RENRI_BROWSER_QA_BASE_PATH = "/__ops/browser-qa/renri";

const SYNTHETIC_RENRI_BROWSER_QA_ROUTES = Object.freeze({
  manifest: `${SYNTHETIC_RENRI_BROWSER_QA_BASE_PATH}/manifest.json`,
  join: `${SYNTHETIC_RENRI_BROWSER_QA_BASE_PATH}/join`,
  rally: `${SYNTHETIC_RENRI_BROWSER_QA_BASE_PATH}/rally`,
  live: `${SYNTHETIC_RENRI_BROWSER_QA_BASE_PATH}/live`,
  recap: `${SYNTHETIC_RENRI_BROWSER_QA_BASE_PATH}/recap`
});

const SYNTHETIC_RENRI_BROWSER_QA_ROUTE_SET = new Set<string>(Object.values(SYNTHETIC_RENRI_BROWSER_QA_ROUTES));

const SYNTHETIC_RENRI_BROWSER_QA_HOST_SET = new Set([
  "staging.ikimon.life",
  "ikimon-life-cloudflare-staging.yamaki0102.workers.dev"
]);

const SYNTHETIC_RENRI_BROWSER_QA_VIEWPORTS = Object.freeze([
  "320x568",
  "360x800",
  "375x667",
  "390x844",
  "412x915",
  "768x1024",
  "1024x768",
  "1366x768",
  "1440x900",
  "1920x1080"
]);

type SyntheticObservationEventRenderOptions = Readonly<{
  syntheticQaBasePath: string;
}>;

export function handleSyntheticRenriBrowserQa(
  request: Request,
  url: URL,
  environment: string
): Response | null {
  const ownsPath = url.pathname === SYNTHETIC_RENRI_BROWSER_QA_BASE_PATH
    || url.pathname.startsWith(`${SYNTHETIC_RENRI_BROWSER_QA_BASE_PATH}/`);
  if (!ownsPath) return null;

  if (
    environment !== "staging"
    || !SYNTHETIC_RENRI_BROWSER_QA_HOST_SET.has(url.hostname)
    || (request.method !== "GET" && request.method !== "HEAD")
    || url.search !== ""
    || !SYNTHETIC_RENRI_BROWSER_QA_ROUTE_SET.has(url.pathname)
  ) {
    return syntheticRenriBrowserQaNotFound();
  }

  if (url.pathname === SYNTHETIC_RENRI_BROWSER_QA_ROUTES.manifest) {
    return json({
      ok: true,
      schema_version: "ikimon.synthetic-renri-browser-qa/v1",
      synthetic: true,
      staging_only: true,
      values_exposed: false,
      customer_data_access: false,
      customer_data_write: false,
      production_unchanged: true,
      external_requests: false,
      routes: SYNTHETIC_RENRI_BROWSER_QA_ROUTES,
      viewports: SYNTHETIC_RENRI_BROWSER_QA_VIEWPORTS,
      interaction_checks: [
        "join_required_name_error",
        "join_guardian_consent_error",
        "join_browser_local_draft_restore",
        "join_synthetic_success",
        "rally_browser_local_progress"
      ]
    }, 200, syntheticRenriBrowserQaSecurityHeaders());
  }

  const fixture = syntheticRenriBrowserQaFixture();
  if (url.pathname === SYNTHETIC_RENRI_BROWSER_QA_ROUTES.join) {
    const body = `<div data-renderer-contract="renderObservationEventJoinPage">${renderObservationEventJoinPage(
      fixture.session,
      fixture.teams,
      false,
      { syntheticQaBasePath: SYNTHETIC_RENRI_BROWSER_QA_BASE_PATH }
    )}</div>`;
    return syntheticRenriBrowserQaPageHtml("参加", "join", body);
  }
  if (url.pathname === SYNTHETIC_RENRI_BROWSER_QA_ROUTES.rally) {
    const body = `<div data-renderer-contract="renderObservationEventRallyPage">${renderObservationEventRallyPage(
      fixture.session,
      fixture.rally,
      true,
      false,
      { syntheticQaBasePath: SYNTHETIC_RENRI_BROWSER_QA_BASE_PATH }
    )}</div>${renderSyntheticRenriRallyInteractions(fixture.rally)}`;
    return syntheticRenriBrowserQaPageHtml("観察ラリー", "rally", body);
  }
  if (url.pathname === SYNTHETIC_RENRI_BROWSER_QA_ROUTES.live) {
    const body = `<div data-renderer-contract="renderObservationEventLivePage">${renderObservationEventLivePage(
      fixture.session,
      fixture.teams,
      fixture.liveEvents,
      false
    )}</div>`;
    return syntheticRenriBrowserQaPageHtml("ライブ", "live", body);
  }

  const body = `<div data-renderer-contract="renderObservationEventRecapPage">${renderObservationEventRecapPage(
    fixture.recap
  )}</div>`;
  return syntheticRenriBrowserQaPageHtml("振り返り", "recap", body);
}

function syntheticRenriBrowserQaNotFound(): Response {
  return json({ error: "not_found" }, 404, {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
}

function syntheticRenriBrowserQaSecurityHeaders(cspNonce?: string): Record<string, string> {
  const contentSecurityPolicy = cspNonce
    ? [
        "default-src 'none'",
        "base-uri 'none'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'none'",
        `script-src 'nonce-${cspNonce}'`,
        "style-src 'unsafe-inline'",
        "img-src data:",
        "connect-src 'none'",
        "font-src 'none'",
        "media-src 'none'",
        "worker-src 'none'",
        "manifest-src 'none'"
      ].join("; ")
    : "default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; connect-src 'none'";
  return {
    "cache-control": "no-store, max-age=0",
    "content-security-policy": contentSecurityPolicy,
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), browsing-topics=()",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "x-ikimon-synthetic-browser-qa": "renri-v1",
    "x-robots-tag": "noindex, nofollow, noarchive, nosnippet"
  };
}

function syntheticRenriBrowserQaPageHtml(
  title: string,
  state: "join" | "rally" | "live" | "recap",
  body: string
): Response {
  const cspNonce = createHtmlCspNonce();
  const document = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive,nosnippet">
  <title>${escapeHtml(title)} - 連理 合成Browser QA</title>
  <style>
    :root{color-scheme:light;--ink:#17231b;--muted:#587062;--line:#d9e5dd;--brand:#0b6b54;--base:#f7faf8;--surface:#fff;--warn:#fff7d6}
    *{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--base);color:var(--ink);line-height:1.65;overflow-wrap:anywhere}
    a{color:var(--brand)}button,input,select{font:inherit}button,input,select,a.btn{min-height:44px}input,select{width:100%;margin-top:6px;padding:10px 12px;border:1px solid #b9cbc1;border-radius:8px;background:#fff;color:var(--ink)}
    label{display:block;margin:14px 0;font-weight:700}.qa-header{border-bottom:1px solid var(--line);background:#fff}.qa-header-inner{max-width:1040px;margin:auto;padding:12px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px}.qa-brand{font-weight:900}.qa-marker{padding:4px 9px;border-radius:999px;background:var(--warn);font-size:12px;font-weight:900}
    .qa-nav{max-width:1040px;margin:auto;padding:10px 18px;display:flex;gap:8px;overflow-x:auto}.qa-nav a{flex:0 0 auto;padding:8px 11px;border:1px solid var(--line);border-radius:999px;background:#fff;text-decoration:none;font-weight:800}.qa-nav a[aria-current="page"]{background:var(--brand);color:#fff;border-color:var(--brand)}
    main{width:min(100%,1040px);margin:auto;padding:18px 18px 56px}.qa-boundary{margin-bottom:18px;padding:12px 14px;border:2px solid #d49b00;border-radius:10px;background:var(--warn)}.qa-boundary strong{display:block}.qa-boundary p{margin:4px 0 0}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:12px}.card{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:16px}.muted{color:var(--muted)}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.btn{display:inline-flex;align-items:center;justify-content:center;padding:8px 13px;border:0;border-radius:8px;background:var(--brand);color:#fff;text-decoration:none;font-weight:800;cursor:pointer}.btn.secondary{background:#e8f1ed;color:#174c3d}.pill{display:inline-block;border:1px solid #cbd8d0;border-radius:999px;padding:3px 8px;margin:2px;font-size:12px;color:#315241}
    .evt-check-row{display:flex;align-items:flex-start;gap:10px}.evt-check-row input{flex:0 0 auto;width:22px;min-height:22px;margin:3px 0}.evt-check-row span{min-width:0}.evt-check-row small{display:block;font-weight:400;color:var(--muted)}[hidden]{display:none!important}
    .qa-mission{display:grid;gap:10px}.qa-progress{height:12px;overflow:hidden;border-radius:999px;background:#e1ebe5}.qa-progress>span{display:block;height:100%;background:var(--brand);transition:width .2s ease}.qa-footer{padding:18px;text-align:center;color:var(--muted);font-size:13px}
    @media(max-width:420px){.qa-header-inner,main,.qa-nav{padding-left:12px;padding-right:12px}.card{padding:14px}.actions>.btn{width:100%}h1{font-size:1.6rem;line-height:1.35}h2{font-size:1.2rem}}
  </style>
</head>
<body data-synthetic-browser-qa="renri-v1" data-synthetic-state="${escapeHtml(state)}">
  <header class="qa-header"><div class="qa-header-inner"><span class="qa-brand">ikimon.life / 連理</span><span class="qa-marker">合成QA・staging限定</span></div></header>
  <nav class="qa-nav" aria-label="合成QA状態">
    ${(["join", "rally", "live", "recap"] as const).map((item) => `<a href="${escapeHtml(SYNTHETIC_RENRI_BROWSER_QA_ROUTES[item])}"${item === state ? ' aria-current="page"' : ""}>${escapeHtml({ join: "参加", rally: "ラリー", live: "ライブ", recap: "振り返り" }[item])}</a>`).join("")}
  </nav>
  <main>
    <aside class="qa-boundary" data-synthetic-marker="true"><strong>合成データだけを使う表示・操作確認面です</strong><p>顧客データ、D1、R2、Queue、認証、位置情報、実投稿APIには接続しません。</p></aside>
    ${body}
  </main>
  <footer class="qa-footer">Synthetic visual and interaction QA only — 実データ・実端末・人による確認の代替ではありません。</footer>
</body>
</html>`;
  return html(applyCspNonceToHtmlScripts(document, cspNonce), 200, {
    ...syntheticRenriBrowserQaSecurityHeaders(cspNonce),
    "x-ikimon-cloudflare-native": `synthetic-renri-browser-qa-${state}`
  });
}

function syntheticRenriBrowserQaFixture() {
  const session = mapObservationEventSession({
    session_id: "synthetic-renri-browser-qa-v1",
    legacy_event_id: null,
    event_code: "SYNTHETIC-RENRI-QA",
    title: "連理サイエンスアドベンチャー（合成QA）",
    organizer_user_id: "synthetic-organizer",
    corporation_id: null,
    plan: "community",
    primary_mode: "discovery",
    active_modes_json: JSON.stringify(["discovery", "survey"]),
    location_lat: null,
    location_lng: null,
    location_radius_m: 0,
    started_at: "2026-07-19T09:00:00.000Z",
    ended_at: null,
    target_species_json: JSON.stringify(["セミの声", "樹皮の模様", "足元の小さないきもの"]),
    config_json: JSON.stringify({ synthetic_browser_qa: true, public_list_visibility: "hidden" }),
    field_id: null,
    template_source_session_id: null,
    created_at: "2026-07-17T00:00:00.000Z",
    updated_at: "2026-07-17T00:00:00.000Z"
  });
  const teams: ObservationEventTeamD1Row[] = [
    {
      team_id: "synthetic-team-green",
      name: "みどり班（合成）",
      color: "#0b6b54",
      lead_user_id: null,
      target_taxa_json: JSON.stringify(["セミの声", "樹皮の模様"]),
      created_at: "2026-07-17T00:00:00.000Z"
    },
    {
      team_id: "synthetic-team-water",
      name: "みず班（合成）",
      color: "#2878a8",
      lead_user_id: null,
      target_taxa_json: JSON.stringify(["足元の小さないきもの"]),
      created_at: "2026-07-17T00:00:00.000Z"
    }
  ];
  const course = mapObservationRallyCourse({
    course_id: "synthetic-renri-course",
    session_id: session.sessionId,
    title: "連理の木をめぐる合成ラリー",
    status: "active",
    config_json: JSON.stringify({ synthetic_browser_qa: true }),
    created_by: null,
    created_at: "2026-07-17T00:00:00.000Z",
    updated_at: "2026-07-17T00:00:00.000Z"
  });
  const stations = [
    mapObservationRallyStation({
      station_id: "synthetic-station-trunk",
      course_id: course.courseId,
      field_id: null,
      code: "TRUNK",
      name: "連理の幹（合成）",
      description: "樹皮の模様を比べる合成地点です。",
      lat: null,
      lng: null,
      radius_m: null,
      polygon_json: null,
      route_geojson: null,
      is_private: 0,
      access_note: "合成QAのため現地案内ではありません。",
      danger_note: "",
      status: "open",
      sort_order: 1,
      created_at: "2026-07-17T00:00:00.000Z",
      updated_at: "2026-07-17T00:00:00.000Z"
    }),
    mapObservationRallyStation({
      station_id: "synthetic-station-canopy",
      course_id: course.courseId,
      field_id: null,
      code: "CANOPY",
      name: "木陰の音（合成）",
      description: "聞こえた音を比べる合成地点です。",
      lat: null,
      lng: null,
      radius_m: null,
      polygon_json: null,
      route_geojson: null,
      is_private: 0,
      access_note: "合成QAのため現地案内ではありません。",
      danger_note: "",
      status: "open",
      sort_order: 2,
      created_at: "2026-07-17T00:00:00.000Z",
      updated_at: "2026-07-17T00:00:00.000Z"
    })
  ];
  const missions = [
    mapObservationRallyMission({
      mission_id: "synthetic-mission-bark",
      course_id: course.courseId,
      station_id: stations[0]?.stationId ?? null,
      replacement_for_mission_id: null,
      scope: "event",
      location_binding: "none",
      title: "樹皮の違いを3つ見つける",
      target: "樹皮の模様",
      count_unit: "scene",
      goal_count: 3,
      counting_policy_json: "{}",
      verification_policy: "auto",
      weather_sensitivity: "all_weather",
      fallback_group: "",
      status: "published",
      starts_at: null,
      ends_at: null,
      sort_order: 1,
      created_by: null,
      created_at: "2026-07-17T00:00:00.000Z",
      updated_at: "2026-07-17T00:00:00.000Z"
    }),
    mapObservationRallyMission({
      mission_id: "synthetic-mission-sound",
      course_id: course.courseId,
      station_id: stations[1]?.stationId ?? null,
      replacement_for_mission_id: null,
      scope: "event",
      location_binding: "none",
      title: "聞こえた音を2種類見つける",
      target: "セミの声",
      count_unit: "taxon",
      goal_count: 2,
      counting_policy_json: "{}",
      verification_policy: "auto",
      weather_sensitivity: "all_weather",
      fallback_group: "",
      status: "published",
      starts_at: null,
      ends_at: null,
      sort_order: 2,
      created_by: null,
      created_at: "2026-07-17T00:00:00.000Z",
      updated_at: "2026-07-17T00:00:00.000Z"
    })
  ];
  const progress = missions.map((mission, index) => mapObservationRallyProgress({
    progress_id: `synthetic-progress-${index + 1}`,
    course_id: course.courseId,
    mission_id: mission.missionId,
    progress_scope: "event",
    team_id: null,
    participant_key: null,
    station_id: mission.stationId,
    actual_count: index === 0 ? 1 : 0,
    goal_count: mission.goalCount,
    percent: index === 0 ? 33 : 0,
    status: "active",
    updated_at: "2026-07-17T00:00:00.000Z"
  }));
  const liveEvents: PublicObservationEventLiveEvent[] = [
    {
      type: "observation_added",
      label: "観察が追加されました",
      payload: { taxonName: "樹皮の模様（合成）" },
      createdAt: "2026-07-19T09:12:00.000Z"
    },
    {
      type: "rally_station_opened",
      label: "観察地点が開きました",
      payload: { name: "木陰の音（合成）" },
      createdAt: "2026-07-19T09:08:00.000Z"
    },
    {
      type: "announce",
      label: "主催者からのお知らせ",
      payload: { message: "足元に気をつけて、合成ミッションを続けましょう。" },
      createdAt: "2026-07-19T09:05:00.000Z"
    }
  ];
  return {
    session,
    teams,
    rally: { course, stations, missions, progress },
    liveEvents,
    recap: {
      session: { title: session.title },
      highlights: {
        observationCount: 12,
        uniqueSpeciesCount: 7,
        participantsCount: 4,
        topTaxa: [
          { name: "セミの声（合成）", count: 4 },
          { name: "樹皮の模様（合成）", count: 3 }
        ]
      },
      photos: [],
      synthetic: true
    }
  };
}

function renderSyntheticRenriRallyInteractions(
  rally: Pick<Awaited<ReturnType<typeof getObservationRallySnapshot>>, "missions" | "progress">
): string {
  const cards = rally.missions.map((mission) => {
    const initial = rally.progress.find((item) => item.missionId === mission.missionId)?.actualCount ?? 0;
    const percent = Math.min(100, Math.round((initial / Math.max(1, mission.goalCount)) * 100));
    return `<article class="card qa-mission" data-synthetic-mission="${escapeHtml(mission.missionId)}" data-count="${initial}" data-goal="${mission.goalCount}">
      <h2>${escapeHtml(mission.title)}</h2>
      <p class="muted">${escapeHtml(mission.target)} / 目標 ${mission.goalCount}</p>
      <div class="qa-progress" role="progressbar" aria-label="${escapeHtml(mission.title)} の進み具合" aria-valuemin="0" aria-valuemax="${mission.goalCount}" aria-valuenow="${initial}"><span style="width:${percent}%"></span></div>
      <p data-synthetic-mission-status role="status">${initial} / ${mission.goalCount}</p>
      <button type="button" class="btn" data-synthetic-mission-add>合成発見を1件追加</button>
    </article>`;
  }).join("");
  return `<section aria-labelledby="synthetic-missions-heading"><h2 id="synthetic-missions-heading">合成ミッション操作</h2><div class="grid">${cards}</div><div class="actions"><a class="btn secondary" href="${SYNTHETIC_RENRI_BROWSER_QA_ROUTES.live}">合成ライブを見る</a></div></section>
<script>
(() => {
  document.querySelectorAll("[data-synthetic-mission]").forEach((card) => {
    const button = card.querySelector("[data-synthetic-mission-add]");
    const status = card.querySelector("[data-synthetic-mission-status]");
    const progress = card.querySelector('[role="progressbar"]');
    const fill = progress?.querySelector("span");
    button?.addEventListener("click", () => {
      const goal = Math.max(1, Number(card.dataset.goal || "1"));
      const count = Math.min(goal, Number(card.dataset.count || "0") + 1);
      card.dataset.count = String(count);
      if (status) status.textContent = count + " / " + goal + (count >= goal ? " 達成（合成）" : "");
      if (progress) progress.setAttribute("aria-valuenow", String(count));
      if (fill) fill.style.width = String(Math.round((count / goal) * 100)) + "%";
      if (count >= goal && button instanceof HTMLButtonElement) button.disabled = true;
    });
  });
})();
</script>`;
}

export async function handleObservationEventPages(request: Request, url: URL, env: Env): Promise<Response | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const pathname = stripPublicLangPrefix(url.pathname);
  if (pathname === "/events/ryuyo" || pathname === "/events/ryuyo/print") {
    const response = observationEventPageHtml("こんちゅうクンとめぐる、竜洋のとっておき。", pathname.endsWith("/print")
      ? renderObservationEventDiscoveryPrint() : renderObservationEventDiscoveryCampaign(), "event-discovery-campaign", 200, "ja", false, { standalone: pathname === "/events/ryuyo" });
    response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
    return response;
  }
  const eventTemplatePreview = handleEventTemplatePreviewPage(request, pathname);
  if (eventTemplatePreview) return eventTemplatePreview;
  if (pathname === "/community/programs/confirm") {
    return getPublicProgramConfirmationPage(request, url, env);
  }
  if (pathname === "/community/events") {
    return getObservationEventListPage(request, env);
  }
  if (pathname === "/community/events/new") {
    const auth = await readCompatibleSession(request, env).catch(() => null);
    const pageHtml = (title: string, body: string, marker: string, status = 200) => observationEventPageHtml(title, body, marker, status, publicLangFromPath(new URL(request.url).pathname) ?? "ja", Boolean(auth && !auth.banned));
    const templateFrom = normalizeOptionalText(url.searchParams.get("template_from"));
    const requestedTemplate = url.searchParams.get("event_template");
    const templateKey = isCommonEventTemplateKey(requestedTemplate) ? requestedTemplate : null;
    const initialFieldId = normalizeOptionalText(url.searchParams.get("field_id")) ?? "";
    const returnParams = new URLSearchParams();
    if (templateKey) returnParams.set("event_template", templateKey);
    if (initialFieldId) returnParams.set("field_id", initialFieldId);
    if (templateFrom) returnParams.set("template_from", templateFrom);
    const returnPath = `${url.pathname}${returnParams.size ? `?${returnParams.toString()}` : ""}`;
    const template = auth && templateFrom
      ? await getObservationEventSessionById(env, templateFrom).then((candidate) => (
        candidate && candidate.organizerUserId === auth.userId ? candidate : null
      )).catch(() => null)
      : null;
    return pageHtml("観察会を作成", renderObservationEventCreatePage(auth, initialFieldId, template, { templateKey, returnPath }), "event-page-create");
  }
  const applicationMatch = pathname.match(/^\/community\/events\/([^/]+)\/apply$/);
  if (applicationMatch?.[1]) {
    return getObservationEventApplicationPage(request, env, decodeURIComponent(applicationMatch[1]));
  }
  const joinMatch = pathname.match(/^\/community\/events\/([^/]+)\/join$/);
  if (joinMatch?.[1]) {
    return getObservationEventJoinPage(request, env, decodeURIComponent(joinMatch[1]));
  }
  const eventPageMatch = pathname.match(/^\/events\/([^/]+)\/(edit|live|rally|gallery|console|recap|report|discoveries|print)$/);
  if (!eventPageMatch?.[1] || !eventPageMatch[2]) return null;
  return getObservationEventSessionPage(request, url, env, decodeURIComponent(eventPageMatch[1]), eventPageMatch[2]);
}

async function getPublicProgramConfirmationPage(request: Request, url: URL, env: Env): Promise<Response> {
  const lang = publicLangFromPath(url.pathname) ?? langQueryToUrlSegment(url.searchParams.get("lang")) ?? "ja";
  let program;
  try {
    program = decodePublicProgramHandoffPayload(url.searchParams.get("payload") ?? "");
  } catch {
    const copy = publicProgramConfirmationError(lang);
    return observationEventPageHtml(
      publicProgramConfirmationTitle(lang),
      observationEventEmptyState(copy.heading, copy.body),
      "program-confirmation-invalid",
      400,
      lang,
      false,
    );
  }
  const auth = await readCompatibleSession(request, env).catch(() => null);
  const redirect = url.pathname + url.search;
  const body = renderPublicProgramConfirmationBody({
    program,
    authenticated: Boolean(auth && !auth.banned),
    loginHref: "/auth?redirect=" + encodeURIComponent(redirect),
    lang,
  });
  return observationEventPageHtml(publicProgramConfirmationTitle(lang), body, "program-confirmation", 200, lang, Boolean(auth && !auth.banned));
}

const OBSERVATION_EVENT_PUBLIC_LIST_LIMIT = 24;

const OBSERVATION_EVENT_PUBLIC_SCAN_PAGE_LIMIT = 8;

async function getObservationEventListPage(request: Request, env: Env): Promise<Response> {
  const auth = await readCompatibleSession(request, env).catch(() => null);
  const publicLang = publicLangFromPath(new URL(request.url).pathname) ?? "ja";
  const lang = publicLang === "pt-br" ? "pt-BR" : publicLang;
  const pageHtml = (title: string, body: string, marker: string, status = 200) => observationEventPageHtml(title, body, marker, status, publicLang, Boolean(auth && !auth.banned));
  let loadFailed = false;
  let scanLimitReached = false;
  const sessions: ObservationEventSessionRow[] = [];
  const ownerSessionIds = new Set<string>();
  let cursor: { startedAt: string; sessionId: string } | null = null;
  let publicScanPages = 0;
  let lastPublicPageWasFull = false;
  try {
    if (auth?.userId) {
      const ownedRows = await env.OBS_DB.prepare(
        `SELECT session_id, legacy_event_id, event_code, title, organizer_user_id, corporation_id,
                plan, primary_mode, active_modes_json, location_lat, location_lng, location_radius_m,
                started_at, ended_at, target_species_json, config_json, field_id, template_source_session_id,
                created_at, updated_at
           FROM observation_event_sessions
          WHERE organizer_user_id = ? AND event_code IS NOT NULL AND trim(event_code) <> ''
          ORDER BY started_at DESC, session_id ASC
          LIMIT ${OBSERVATION_EVENT_PUBLIC_LIST_LIMIT}`
      ).bind(auth.userId).all<ObservationEventSessionD1Row>();
      for (const row of ownedRows.results) {
        const session = mapObservationEventSession(row);
        ownerSessionIds.add(session.sessionId);
        sessions.push(session);
      }
    }
    // Load owner rows first so public traffic cannot starve private drafts. Each public fetch stays bounded;
    // the shared QA filter runs before a row counts toward the 24 visible entries.
    while (sessions.length < OBSERVATION_EVENT_PUBLIC_LIST_LIMIT
      && publicScanPages < OBSERVATION_EVENT_PUBLIC_SCAN_PAGE_LIMIT) {
      const rows: { results: ObservationEventSessionD1Row[] } = await env.OBS_DB.prepare(
        `SELECT session_id, legacy_event_id, event_code, title, organizer_user_id, corporation_id,
                plan, primary_mode, active_modes_json, location_lat, location_lng, location_radius_m,
                started_at, ended_at, target_species_json, config_json, field_id, template_source_session_id,
                created_at, updated_at
           FROM observation_event_sessions
          WHERE event_code IS NOT NULL AND trim(event_code) <> ''
            AND (? IS NULL OR started_at < ? OR (started_at = ? AND session_id > ?))
          ORDER BY started_at DESC, session_id ASC
          LIMIT ${OBSERVATION_EVENT_PUBLIC_LIST_LIMIT}`
      ).bind(cursor?.startedAt ?? null, cursor?.startedAt ?? null, cursor?.startedAt ?? null, cursor?.sessionId ?? null)
        .all<ObservationEventSessionD1Row>();
      publicScanPages += 1;
      lastPublicPageWasFull = rows.results.length === OBSERVATION_EVENT_PUBLIC_LIST_LIMIT;
      if (rows.results.length === 0) break;
      for (const row of rows.results) {
        const session = mapObservationEventSession(row);
        if (ownerSessionIds.has(session.sessionId)) continue;
        if (auth?.userId === session.organizerUserId) {
          ownerSessionIds.add(session.sessionId);
          sessions.push(session);
        } else if (!isObservationEventQaFixture(session)) {
          sessions.push(session);
        }
      }
      const last: ObservationEventSessionD1Row = rows.results.at(-1)!;
      cursor = { startedAt: last.started_at, sessionId: last.session_id };
      if (rows.results.length < OBSERVATION_EVENT_PUBLIC_LIST_LIMIT) break;
    }
    scanLimitReached = sessions.length < OBSERVATION_EVENT_PUBLIC_LIST_LIMIT
      && publicScanPages >= OBSERVATION_EVENT_PUBLIC_SCAN_PAGE_LIMIT
      && lastPublicPageWasFull;
  } catch {
    loadFailed = true;
    scanLimitReached = false;
    sessions.length = 0;
  }
  const strings = getObservationEventStrings(lang);
  return pageHtml(
    strings.listHeroHeading,
    renderEventListBody(sessions.slice(0, OBSERVATION_EVENT_PUBLIC_LIST_LIMIT), strings, lang, {
      loadFailed,
      partial: scanLimitReached,
      retryHref: "/community/events",
    }),
    "event-page-list",
  );
}

async function getObservationEventJoinPage(request: Request, env: Env, eventCode: string): Promise<Response> {
  const [auth, session] = await Promise.all([
    readCompatibleSession(request, env).catch(() => null),
    getObservationEventSessionByEventCode(env, eventCode).catch(() => null)
  ]);
  const pageHtml = (title: string, body: string, marker: string, status = 200) => observationEventPageHtml(title, body, marker, status, publicLangFromPath(new URL(request.url).pathname) ?? "ja", Boolean(auth && !auth.banned));
  if (!session) {
    return pageHtml("観察会が見つかりません", observationEventEmptyState("参加コードが見つかりません", "主催者にコードを確認してください。"), "event-page-not-found", 404);
  }
  if (isEventDiscoveryProfile(session.config)) {
    if (!observationEventGuestMediaEnabled(env, session)) return pageHtml("企画が見つかりません", observationEventEmptyState("参加コードを確認してください", "主催者から案内された参加コードを確認してください。"), "event-discovery-unavailable", 404);
    const course = await getObservationRallyCourseBySession(env, session.sessionId);
    const canJoin = !auth?.banned && course?.status === "live" && isObservationEventActivityOpen(session);
    const teams = await listObservationEventTeams(env, session.sessionId).catch(() => []);
    const ownApplication = !auth?.banned ? await ownObservationEventApplication(request, env, session, auth) : null;
    const response = pageHtml(session.title + " に参加", renderObservationEventDiscoveryJoin({
      sessionId: session.sessionId, title: session.title, eventCode: session.eventCode ?? eventCode,
      geminiConsentVersion: isRyuyoDiscoveryEvent(env, session) ? RYUYO_DISCOVERY_GEMINI_NOTICE_VERSION : undefined,
      startedAt: session.startedAt, endedAt: session.endedAt, isAuthenticated: Boolean(auth && !auth.banned), canJoin,
      displayName: ownApplication?.participant?.role === "participant" ? ownApplication.participant.display_name : null,
      canViewGallery: Boolean(course && course.status !== "draft" && session.config.cancelled !== true && session.config.status !== "cancelled" && session.config.state !== "cancelled"),
      teams: teams.map((team) => ({ teamId: team.team_id, name: team.name })),
      stateMessage: auth?.banned ? "このアカウントでは参加できません。" : !isObservationEventCheckinOpen(session)
        ? "今回の受付は終了しました。みんなの発見は引き続きご覧いただけます。" : course?.status !== "live" || !isObservationEventActivityOpen(session)
          ? "主催者が受付を準備しています。開始の案内をお待ちください。" : undefined,
    }), "event-discovery-join");
    response.headers.set("cache-control", "private, no-store");
    response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
    if (!auth && canJoin) {
      const credential = await readObservationEventGuestCredential(request.headers.get("cookie"), session.sessionId) ?? randomToken();
      response.headers.set("set-cookie", await buildObservationEventGuestCookie(session, credential));
    }
    return response;
  }
  if (!isObservationEventCheckinOpen(session)) {
    return redirect303(`/events/${encodeURIComponent(session.sessionId)}/recap`, {
      "cache-control": "no-store",
      "x-ikimon-cloudflare-native": "event-page-recap-redirect"
    });
  }
  const teams = await listObservationEventTeams(env, session.sessionId).catch(() => []);
  const guestCredential = auth
    ? null
    : await readObservationEventGuestCredential(request.headers.get("cookie"), session.sessionId) ?? randomToken();
  if (request.method === "GET") {
    const context = serverObservationEventFunnelContext(request, "join", Boolean(auth));
    const actorKey = auth
      ? `user:${auth.userId}`
      : `guest:${await observationEventGuestCredentialDigest(guestCredential!)}`;
    await recordObservationEventServerFunnelMetric(env, session.sessionId, {
      event_name: "event_qr_open",
      ...context
    }, actorKey);
    await recordObservationEventServerFunnelMetric(env, session.sessionId, {
      event_name: "event_join_loaded",
      ...context
    }, actorKey);
  }
  const applicationEnabled = !auth?.banned && observationEventApplicationEnabled(env, session);
  const response = pageHtml(`${session.title} に参加`, renderObservationEventJoinPage(session, teams, Boolean(auth), undefined, applicationEnabled), "event-page-join");
  if (!auth && guestCredential) {
    response.headers.set("set-cookie", await buildObservationEventGuestCookie(session, guestCredential));
  }
  return response;
}

function isObservationEventCancelled(session: ObservationEventTemplate): boolean {
  return session.config.cancelled === true || session.config.status === "cancelled" || session.config.state === "cancelled";
}

function isStrictDiscoveryCampaignAdministrator(roleName: unknown): boolean {
  return typeof roleName === "string" && /^(?:admin|administrator)$/.test(roleName.trim().toLowerCase());
}

/** Current native identities and field grants, never a persisted role assertion in event config. */
async function discoveryCampaignAuthority(env: Env, userId: string): Promise<{ banned: boolean; fieldManager: boolean; administrator: boolean }> {
  const user = await env.CORE_DB.prepare("SELECT role_name, banned FROM auth_users WHERE user_id = ? LIMIT 1")
    .bind(userId).first<{ role_name: string | null; banned: number }>();
  // A canonical account row always wins, including a ban or a removed role.
  // Multiple OAuth identities must agree before they can supply admin authority.
  const identities = user ? [user] : (await env.CORE_DB.prepare("SELECT role_name, banned FROM oauth_accounts WHERE user_id = ?")
    .bind(userId).all<{ role_name: string | null; banned: number }>()).results;
  if (identities.some((identity) => Boolean(identity.banned))) return { banned: true, fieldManager: false, administrator: false };
  const fieldRole = await getFieldManagerRoleFromD1(userId, RYUYO_FIELD_ID, env);
  return {
    banned: false, fieldManager: fieldRole === "owner" || fieldRole === "steward",
    administrator: identities.length > 0 && identities.every((identity) => isStrictDiscoveryCampaignAdministrator(identity.role_name)),
  };
}

function discoveryCampaignHref(session: ObservationEventTemplate): string {
  return "/events/ryuyo?event=" + encodeURIComponent(session.eventCode ?? "");
}

async function discoveryCampaignEventContext(env: Env, session: ObservationEventTemplate, auth: SessionSnapshot | null = null, participant: ObservationEventParticipantD1Row | null = null) {
  const course = await getObservationRallyCourseBySession(env, session.sessionId);
  const cancelled = isObservationEventCancelled(session);
  const organizer = auth?.userId === session.organizerUserId;
  const canCheckIn = !auth?.banned && !organizer && course?.status === "live" && isObservationEventActivityOpen(session);
  const canApply = !auth?.banned && !organizer && observationEventApplicationEnabled(env, session);
  const canViewGallery = Boolean(course && course.status !== "draft" && !cancelled);
  return {
    sessionId: session.sessionId, eventCode: session.eventCode ?? "", title: session.title,
    startedAt: session.startedAt, endedAt: session.endedAt, canApply, canCheckIn,
    canSubmit: canCheckIn && participant?.status === "checked_in", canViewGallery,
    stateMessage: cancelled ? "この開催回の受付は取りやめになりました。" : !isObservationEventCheckinOpen(session)
      ? "この開催回の受付は終了しました。確認が済んだみんなの発見をご覧いただけます。"
      : canCheckIn ? "当日の参加を始められます。" : canApply ? "参加申込みを受け付けています。当日の参加開始は主催者の案内をお待ちください。"
        : "参加申込みの受付は現在開いていません。主催者の案内をご確認ください。",
  };
}

async function ownObservationEventApplication(request: Request, env: Env, session: ObservationEventTemplate, auth: SessionSnapshot | null) {
  const credential = await readObservationEventGuestCredential(request.headers.get("cookie"), session.sessionId);
  const guestToken = credential ? await observationEventGuestCredentialDigest(credential) : null;
  const userParticipant = auth ? await findObservationEventParticipant(env, session.sessionId, auth.userId, null) : null;
  return { credential, participant: userParticipant ?? await findObservationEventParticipant(env, session.sessionId, null, guestToken) };
}

async function discoveryCampaignSelectionAllowed(request: Request, env: Env, session: ObservationEventTemplate, auth: SessionSnapshot | null): Promise<boolean> {
  if (!isRyuyoDiscoveryEvent(env, session) || isObservationEventCancelled(session)) return false;
  if (auth && !auth.banned && auth.userId === session.organizerUserId) return true;
  if (observationEventApplicationEnabled(env, session)) return true;
  const course = await getObservationRallyCourseBySession(env, session.sessionId);
  if (course && course.status !== "draft") return true;
  if (!auth?.banned && (await ownObservationEventApplication(request, env, session, auth)).participant?.role === "participant") return true;
  if (discoveryCampaignConfig(session.config)?.listed) {
    const authority = await discoveryCampaignAuthority(env, session.organizerUserId);
    return !authority.banned && (authority.fieldManager || authority.administrator);
  }
  return false;
}

export async function getRyuyoDiscoveryCampaign(request: Request, url: URL, env: Env): Promise<Response> {
  const headers = { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow, noarchive" };
  const requestedCode = url.searchParams.get("event");
  const auth = requestedCode ? await readCompatibleSession(request, env) : null;
  let selectedEvent = null;
  if (requestedCode !== null) {
    const session = requestedCode.length <= 128 && requestedCode.trim() ? await getObservationEventSessionByEventCode(env, requestedCode.trim()) : null;
    if (!session || !await discoveryCampaignSelectionAllowed(request, env, session, auth)) {
      return json({ error: "discovery_campaign_event_unavailable" }, 404, headers);
    }
    selectedEvent = await discoveryCampaignEventContext(env, session, auth);
  }
  // Dedicated campaign admission is independent of global public-list flags.
  // Those remain hidden for this unlisted, same-event journal profile.
  const rows = await env.OBS_DB.prepare(
    `SELECT session_id, legacy_event_id, event_code, title, organizer_user_id, corporation_id,
            plan, primary_mode, active_modes_json, location_lat, location_lng, location_radius_m,
            started_at, ended_at, target_species_json, config_json, field_id, template_source_session_id,
            created_at, updated_at
       FROM observation_event_sessions
      WHERE field_id = ? AND plan = 'public' AND json_valid(config_json)
        AND json_extract(config_json, '$.discovery_campaign.listed') = 1
      ORDER BY CASE WHEN ended_at IS NULL OR ended_at > ? THEN 0 ELSE 1 END, started_at ASC, session_id ASC
      LIMIT 100`
  ).bind(RYUYO_FIELD_ID, new Date().toISOString()).all<ObservationEventSessionD1Row>();
  const authorityByOrganizer = new Map<string, ReturnType<typeof discoveryCampaignAuthority>>();
  const events = [];
  for (const row of rows.results) {
    const session = mapObservationEventSession(row);
    const fixtureConfig = { ...session.config };
    for (const key of ["public_list_visibility", "publicListVisibility", "public_listed", "publicListVisible"]) delete fixtureConfig[key];
    if (!isRyuyoDiscoveryEvent(env, session) || !discoveryCampaignConfig(session.config)?.listed || isObservationEventCancelled(session)
      || isObservationEventQaFixture({ ...session, config: fixtureConfig })) continue;
    let pendingAuthority = authorityByOrganizer.get(session.organizerUserId);
    if (!pendingAuthority) {
      pendingAuthority = discoveryCampaignAuthority(env, session.organizerUserId);
      authorityByOrganizer.set(session.organizerUserId, pendingAuthority);
    }
    const authority = await pendingAuthority;
    if (authority.banned || (!authority.fieldManager && !authority.administrator)) continue;
    events.push(await discoveryCampaignEventContext(env, session));
  }
  return json({ events, selectedEvent }, 200, headers);
}

export async function manageObservationEventDiscoveryCampaign(request: Request, env: Env, sessionId: string): Promise<Response> {
  if (request.method === "PATCH") {
    const sameOriginError = assertSameOriginRequest(request, true);
    if (sameOriginError) return sameOriginError;
  }
  const organizer = await requireObservationEventOrganizer(request, env, sessionId);
  if (organizer instanceof Response) return organizer;
  const { auth, session } = organizer;
  const headers = { "cache-control": "private, no-store" };
  if (!isRyuyoDiscoveryEvent(env, session)) return json({ error: "discovery_campaign_event_unavailable" }, 404, headers);
  const authority = await discoveryCampaignAuthority(env, auth.userId);
  if (authority.banned) return json({ error: "discovery_campaign_listing_forbidden" }, 403, headers);
  const canManageListing = authority.fieldManager || (authority.administrator && isStrictDiscoveryCampaignAdministrator(auth.roleName) && isMunicipalWalkMapAdminRole(auth));
  let campaign = discoveryCampaignConfig(session.config) ?? { version: DISCOVERY_CAMPAIGN_VERSION, listed: false, applications_open: false };
  if (request.method === "PATCH") {
    const body = await readJson<Record<string, unknown>>(request);
    if (typeof body.listed !== "boolean" || typeof body.applicationsOpen !== "boolean" || Object.keys(body).some((key) => !["listed", "applicationsOpen"].includes(key))) {
      return json({ error: "discovery_campaign_invalid" }, 400, headers);
    }
    if (body.listed && !canManageListing) return json({ error: "discovery_campaign_listing_forbidden" }, 403, headers);
    if ((body.applicationsOpen && !isObservationEventCheckinOpen(session)) || (body.listed && isObservationEventCancelled(session))) return json({ error: "discovery_campaign_closed" }, 409, headers);
    campaign = { version: DISCOVERY_CAMPAIGN_VERSION, listed: body.listed, applications_open: body.applicationsOpen };
    await env.OBS_DB.prepare("UPDATE observation_event_sessions SET config_json = json_set(config_json, '$.discovery_campaign', json(?)), updated_at = CURRENT_TIMESTAMP WHERE session_id = ?")
      .bind(JSON.stringify(campaign), sessionId).run();
  }
  const counts = await env.OBS_DB.prepare(
    `SELECT COALESCE(SUM(CASE WHEN status = 'registered' THEN 1 ELSE 0 END), 0) AS registered,
            COALESCE(SUM(CASE WHEN status IN ('checked_in', 'offline', 'left') THEN 1 ELSE 0 END), 0) AS checkedIn
       FROM observation_event_participants WHERE session_id = ? AND role = 'participant'`
  ).bind(sessionId).first<{ registered: number; checkedIn: number }>();
  return json({ campaign: { listed: campaign.listed, applicationsOpen: campaign.applications_open }, canManageListing, canManageApplications: true, campaignHref: discoveryCampaignHref(session), participantCounts: counts ?? { registered: 0, checkedIn: 0 } }, 200, headers);
}

export async function getObservationEventApplicationStatus(request: Request, env: Env, sessionId: string): Promise<Response> {
  const session = await getObservationEventSessionById(env, sessionId);
  const auth = await readCompatibleSession(request, env);
  const headers = { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow, noarchive" };
  if (auth?.banned) return json({ error: "event_application_unavailable" }, 403, headers);
  if (!session || !await discoveryCampaignSelectionAllowed(request, env, session, auth)) return json({ error: "event_application_unavailable" }, 404, headers);
  const { credential, participant } = await ownObservationEventApplication(request, env, session, auth);
  const event = await discoveryCampaignEventContext(env, session, auth, participant);
  const response = json({ event, participant: participant?.role === "participant" ? { status: participant.status, displayName: participant.display_name?.trim() || null } : null, confirmed: false }, 200, headers);
  if (!auth && (credential || event.canApply || event.canCheckIn)) response.headers.set("set-cookie", await buildObservationEventGuestCookie(session, credential ?? randomToken()));
  return response;
}

function observationEventApplicationEnabled(env: Env, session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>): boolean {
  const eventCode = normalizeOptionalText(session.eventCode)?.toLowerCase();
  if (!eventCode || session.plan !== "public" || !isObservationEventCheckinOpen(session) || isPrivateReceivedProgram(session)) return false;
  if (isRyuyoDiscoveryEvent(env, session)) return discoveryCampaignConfig(session.config)?.applications_open === true;
  if (isObservationEventQaFixture(session)) return env.ENVIRONMENT !== "production" && session.config.qa_fixture === true;
  const enabledCodes = new Set((env.OBSERVATION_EVENT_APPLICATION_CODES ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
  return enabledCodes.has(eventCode);
}

async function getObservationEventApplicationPage(request: Request, env: Env, eventCode: string): Promise<Response> {
  const [auth, session] = await Promise.all([
    readCompatibleSession(request, env).catch(() => null),
    getObservationEventSessionByEventCode(env, eventCode).catch(() => null)
  ]);
  const pageHtml = (title: string, body: string, marker: string, status = 200) => observationEventPageHtml(title, body, marker, status, publicLangFromPath(new URL(request.url).pathname) ?? "ja", Boolean(auth && !auth.banned));
  if (auth?.banned) {
    return pageHtml("申込みを受け付けていません", observationEventEmptyState("申込みを利用できません", "主催者へお問い合わせください。"), "event-application-denied", 403);
  }
  if (!session || !observationEventApplicationEnabled(env, session)) {
    return pageHtml("申込みを受け付けていません", observationEventEmptyState("申込み受付はありません", "このイベントでは現在、オンライン申込みを受け付けていません。"), "event-application-unavailable", 404);
  }
  if (isRyuyoDiscoveryEvent(env, session)) return redirect303(discoveryCampaignHref(session) + "#discovery-signup", { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow, noarchive" });
  const userId = auth?.userId ?? null;
  const existingGuestCredential = await readObservationEventGuestCredential(request.headers.get("cookie"), session.sessionId);
  const activeGuestCredential = existingGuestCredential ?? (userId ? null : randomToken());
  const guestToken = activeGuestCredential ? await observationEventGuestCredentialDigest(activeGuestCredential) : null;
  const participant = await findObservationEventParticipant(env, session.sessionId, userId, guestToken);
  const response = pageHtml(`${session.title} 参加申込み`, renderObservationEventApplicationPage(session, participant), "event-application");
  response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  if (!userId && activeGuestCredential) response.headers.set("set-cookie", await buildObservationEventGuestCookie(session, activeGuestCredential));
  return response;
}

export async function applyToObservationEvent(request: Request, env: Env, sessionId: string): Promise<Response> {
  const sameOriginError = assertSameOriginRequest(request, true);
  if (sameOriginError) return sameOriginError;
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session || !observationEventApplicationEnabled(env, session)) {
    return json({ error: "event_application_unavailable" }, 404, { "cache-control": "no-store" });
  }
  const auth = await readCompatibleSession(request, env);
  if (auth?.banned || auth?.userId === session.organizerUserId) return json({ error: "event_application_unavailable" }, 403, { "cache-control": "no-store" });
  const userId = auth?.userId ?? null;
  const browserGuestCredential = await readObservationEventGuestCredential(request.headers.get("cookie"), sessionId);
  if (userId && browserGuestCredential) {
    await claimObservationEventGuestParticipant(env, sessionId, userId, await observationEventGuestCredentialDigest(browserGuestCredential));
  }
  const guestCredential = userId ? null : browserGuestCredential;
  if (!userId && !guestCredential) return json({ error: "event_guest_cookie_required" }, 428, { "cache-control": "no-store" });
  const body = await readJson<Record<string, unknown>>(request);
  const optionalNickname = isEventDiscoveryProfile(session.config);
  let displayName: string | null;
  try { displayName = optionalNickname ? discoveryNickname(body.display_name) ?? "" : normalizeOptionalText(body.display_name); }
  catch { return json({ error: "event_application_name_invalid" }, 400, { "cache-control": "no-store" }); }
  if ((!optionalNickname && !displayName) || displayName === null || Array.from(displayName).length > 32 || /[\u0000-\u001f\u007f]/u.test(displayName)) {
    return json({ error: "event_application_name_invalid" }, 400, { "cache-control": "no-store" });
  }
  const guestToken = guestCredential ? await observationEventGuestCredentialDigest(guestCredential) : null;
  let participant = await findObservationEventParticipant(env, sessionId, userId, guestToken);
  let created = false;
  if (!participant) {
    const participantId = crypto.randomUUID();
    try {
      await env.OBS_DB.prepare(
        `INSERT INTO observation_event_participants (
           participant_id, session_id, user_id, guest_token, display_name, team_id, role, status,
           checked_in_at, share_location, is_minor, location_share_until, location_share_consent_type
         ) VALUES (?, ?, ?, ?, ?, NULL, 'participant', 'registered', NULL, 0, 0, NULL, NULL)`
      ).bind(participantId, sessionId, userId, guestToken, displayName).run();
      created = true;
    } catch (error) {
      if (!isD1UniqueConstraintError(error)) throw error;
    }
    participant = await findObservationEventParticipant(env, sessionId, userId, guestToken);
  }
  if (!participant || participant.role === "organizer") {
    return json({ error: "event_application_readback_failed" }, 503, { "cache-control": "no-store" });
  }
  return json({ participant: { status: participant.status }, confirmed: false, created }, created ? 201 : 200, { "cache-control": "no-store" });
}

async function getObservationEventSessionPage(request: Request, url: URL, env: Env, sessionId: string, page: string): Promise<Response> {
  const [auth, session] = await Promise.all([
    readCompatibleSession(request, env).catch(() => null),
    getObservationEventSessionById(env, sessionId).catch(() => null)
  ]);
  const pageHtml = (title: string, body: string, marker: string, status = 200) => observationEventPageHtml(title, body, marker, status, publicLangFromPath(new URL(request.url).pathname) ?? "ja", Boolean(auth && !auth.banned));
  if (!session) {
    return pageHtml("観察会が見つかりません", observationEventEmptyState("セッションが見つかりません", "観察会一覧から選び直してください。"), "event-page-not-found", 404);
  }
  let canManage = Boolean(auth?.userId && !auth.banned && auth.userId === session.organizerUserId);
  if (page === "discoveries" || page === "print" || (page === "recap" && isEventDiscoveryProfile(session.config))) {
    if (!isEventDiscoveryProfile(session.config) || !observationEventGuestMediaEnabled(env, session)) {
      return pageHtml("ページが見つかりません", observationEventEmptyState("ページが見つかりません", "主催者から案内されたリンクを確認してください。"), "event-discovery-unavailable", 404);
    }
    const course = await getObservationRallyCourseBySession(env, sessionId);
    if (!canManage && (!course || course.status === "draft" || session.config.cancelled === true || session.config.status === "cancelled" || session.config.state === "cancelled")) {
      return pageHtml("公開の準備中です", observationEventEmptyState("公開の準備中です", "主催者からの案内をお待ちください。"), "event-discovery-unavailable", 404);
    }
    if (page === "recap") return redirect303(`/events/${encodeURIComponent(sessionId)}/discoveries`, {
      "cache-control": "no-store", "x-robots-tag": "noindex, nofollow, noarchive", "x-ikimon-cloudflare-native": "event-discovery-recap-redirect",
    });
    const body = page === "print"
      ? renderObservationEventDiscoveryPrint({ title: session.title, eventCode: session.eventCode ?? undefined, sessionId })
      : renderObservationEventDiscoveryGallery({ sessionId, title: session.title, eventCode: session.eventCode ?? "", canManage });
    const response = pageHtml(session.title, body, "event-discovery-" + page);
    response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
    return response;
  }
  let liveViewer: Awaited<ReturnType<typeof observationEventParticipantContext>> | null = null;
  if (page === "live" || page === "rally" || page === "gallery") {
    liveViewer = await observationEventParticipantContext(request, env, session);
    canManage = canManage || liveViewer.isOrganizer;
    if (!liveViewer.isOrganizer && !liveViewer.isCheckedInParticipant) {
      return pageHtml(
        "権限がありません",
        observationEventEmptyState("参加者のみ閲覧できます", "先に観察会へチェックインしてください。"),
        "event-page-forbidden",
        403
      );
    }
  }
  if ((page === "edit" || page === "console") && !canManage) {
    return pageHtml("権限がありません", observationEventEmptyState("主催者のみアクセスできます", "主催者アカウントでログインしてください。"), "event-page-forbidden", 403);
  }
  if (page === "rally" && isEventDiscoveryProfile(session.config)) {
    if (auth?.banned || !observationEventGuestMediaEnabled(env, session)) return pageHtml("参加できません", observationEventEmptyState("参加できません", "主催者にお問い合わせください。"), "event-discovery-denied", 403);
    const [course, actor] = await Promise.all([getObservationRallyCourseBySession(env, sessionId), observationEventGuestMediaActor(request, env, sessionId)]);
    const geminiNoticeRequired = isRyuyoDiscoveryEvent(env, session) && course?.status === "live"
      && isObservationEventActivityOpen(session)
      && (actor.participant?.discovery_gemini_notice_version !== RYUYO_DISCOVERY_GEMINI_NOTICE_VERSION || !actor.participant?.discovery_gemini_notice_at);
    const canSubmit = Boolean(actor.participant?.status === "checked_in") && course?.status === "live"
      && isObservationEventActivityOpen(session) && !geminiNoticeRequired;
    const response = pageHtml(session.title, renderObservationEventDiscoveryCapture({
      sessionId, title: session.title, eventCode: session.eventCode ?? "", canSubmit, canManage,
      geminiNoticeRequired,
      isMinor: actor.participant?.is_minor === 1, displayName: actor.participant?.display_name?.trim() || null,
      stateMessage: canSubmit ? undefined : !isObservationEventCheckinOpen(session) ? "受付は終了しました。保存した3枚は引き続き確認できます。"
        : geminiNoticeRequired ? undefined : "いまは写真の受付を停止しています。保存した写真は確認できます。",
    }), "event-discovery-capture");
    response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
    return response;
  }
  if (page === "recap") {
    return getObservationEventRecapPage(request, url, env, session);
  }
  if (page === "report") {
    return getObservationEventReportPage(request, env, session);
  }
  if (page === "gallery") {
    const mediaResponse = await getObservationEventGuestMedia(request, env, session.sessionId).catch(() => json({ error: "guest_media_read_failed" }, 503));
    if (!mediaResponse.ok) {
      const status = mediaResponse.status;
      const message = status === 403
        ? "チェックイン済みの参加者または主催者のみ閲覧できます。"
        : status === 404
          ? "この観察会では非公開ギャラリーを利用できません。"
          : "写真・動画を読み込めませんでした。時間をおいて再読み込みしてください。";
      return pageHtml(status === 403 ? "権限がありません" : "写真・動画を読み込めません", observationEventGuestGalleryErrorPage(session.sessionId, message), status === 403 ? "event-gallery-forbidden" : "event-gallery-error", status);
    }
    const data = await mediaResponse.json() as Record<string, unknown>;
    return pageHtml(`${session.title} 非公開ギャラリー`, renderObservationEventGuestGalleryPage(session, data, canManage), "event-page-private-gallery");
  }
  if (page === "rally") {
    let rally: Awaited<ReturnType<typeof getObservationRallySnapshot>>;
    try {
      rally = await getObservationRallySnapshot(env, session.sessionId, liveViewer ?? undefined, session);
    } catch {
      return pageHtml(`${session.title} 観察ラリー`, `<section class="card"><h1>進み具合を読み込めませんでした</h1><p>時間をおいて、もう一度お試しください。</p><a class="btn secondary" href="/events/${encodeURIComponent(session.sessionId)}/rally">再読み込み</a></section>`, "event-page-rally-unavailable", 503);
    }
    await recordObservationEventParticipantPageMetric(request, env, session, "event_rally_opened", "rally");
    return pageHtml(`${session.title} 観察ラリー`, renderObservationEventRallyPage(
      session, rally, Boolean(auth), canManage, undefined, observationEventGuestMediaEnabled(env, session), canManage,
      Boolean(liveViewer?.isActiveParticipant) && isObservationEventActivityOpen(session)
    ), "event-page-rally");
  }
  const [teams, events, effort] = await Promise.all([
    listObservationEventTeams(env, session.sessionId).catch(() => []),
    listObservationEventLiveEvents(env, session.sessionId, 40).catch(() => []),
    summarizeObservationEventEffort(env, session).catch(() => null)
  ]);
  if (page === "edit") {
    return pageHtml(`${session.title} 編集`, renderObservationEventEditPage(session), "event-page-edit");
  }
  if (page === "console") {
    const dashboard = await buildObservationEventOperationsDashboard(env, session);
    return pageHtml(`${session.title} 管制塔`, renderObservationEventConsolePage(session, teams, events, effort, dashboard), "event-page-console");
  }
  await recordObservationEventParticipantPageMetric(request, env, session, "event_live_viewed", "live");
  const participantEvents = events
    .filter((event) => shouldDeliverObservationEvent(event, liveViewer!))
    .map(publicObservationEventLiveEvent)
    .filter((event): event is PublicObservationEventLiveEvent => event !== null);
  return pageHtml(`${session.title} ライブ`, renderObservationEventLivePage(session, teams, participantEvents, canManage), "event-page-live");
}

async function getObservationEventRecapPage(request: Request, url: URL, env: Env, session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>): Promise<Response> {
  const auth = await readCompatibleSession(request, env).catch(() => null);
  const pageHtml = (title: string, body: string, marker: string, status = 200) => observationEventPageHtml(title, body, marker, status, publicLangFromPath(new URL(request.url).pathname) ?? "ja", Boolean(auth && !auth.banned));
  const recapResponse = await getObservationEventRecap(request, url, env, session.sessionId);
  if (!recapResponse.ok) return recapResponse;
  const recap = await recapResponse.json() as Record<string, unknown>;
  await recordObservationEventParticipantPageMetric(request, env, session, "event_recap_viewed", "recap");
  return pageHtml(`${session.title} の振り返り`, renderObservationEventRecapPage(recap), "event-page-recap");
}

async function getObservationEventReportPage(request: Request, env: Env, session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>): Promise<Response> {
  const auth = await readCompatibleSession(request, env).catch(() => null);
  const pageHtml = (title: string, body: string, marker: string, status = 200) => observationEventPageHtml(title, body, marker, status, publicLangFromPath(new URL(request.url).pathname) ?? "ja", Boolean(auth && !auth.banned));
  const report = await buildObservationEventOfficialReport(request, env, session.sessionId);
  if (report instanceof Response) return report;
  return pageHtml(`${session.title} 公式出力`, renderObservationEventReportPage(report), "event-page-report");
}

export function observationEventPageHtml(title: string, body: string, nativeMarker: string, status = 200, lang = "ja", member = false, options: { standalone?: boolean } = {}): Response {
  const cspNonce = createHtmlCspNonce();
  const standalone = options.standalone === true;
  const document = `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}${standalone ? "" : " | ZUKAN"}</title>
  <style>
    body{margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f7faf8;color:#17231b}
    main{max-width:980px;margin:0 auto;padding:24px 18px 48px}
    a{color:#0b6b54}
    .site-header{position:sticky;top:0;z-index:20;border-bottom:1px solid rgba(15,23,42,.08);background:rgba(255,255,255,.92);backdrop-filter:blur(14px)}
    .site-header-inner{max-width:1180px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 18px}
    .site-brand-cluster{display:flex;align-items:center;gap:8px;min-width:0}.desktop-side-nav-toggle{display:none}
    .brand{display:inline-flex;align-items:center;min-width:0;color:#17231b;text-decoration:none;font-weight:900}
    .brand-logo-lockup{display:inline-flex;align-items:center;gap:7px;min-width:0}.brand-mark{width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;overflow:hidden;border-radius:10px;background:#fff;box-shadow:0 7px 16px rgba(15,23,42,.1)}.brand-mark img{width:100%;height:100%;object-fit:cover}.brand-wordmark{display:inline-flex;align-items:center;height:16px;aspect-ratio:711/222}.brand-wordmark-img{display:block;width:auto;height:100%;object-fit:contain}
    .site-nav{display:flex;align-items:center;gap:6px}.site-nav-link{min-height:38px;display:inline-flex;align-items:center;padding:8px 10px;border-radius:999px;color:#42574c;text-decoration:none;font-size:13px;font-weight:800;white-space:nowrap}.site-nav-link:hover{background:#e8f1ed}
    .site-search{min-width:200px;max-width:300px;height:38px;display:inline-flex;align-items:center;gap:7px;padding:0 11px;border-radius:999px;background:#fff;border:1px solid #d6e3dc}.site-search-input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:#17231b;font:inherit;font-size:13px}.site-search-icon{font-size:13px;opacity:.72}
    .site-header-actions{display:flex;align-items:center;gap:8px}.site-header-actions-mobile{display:none}.site-record-link{min-height:38px;display:inline-flex;align-items:center;justify-content:center;padding:8px 12px;border-radius:999px;background:#0b6b54;color:#fff;text-decoration:none;font-size:13px;font-weight:900;box-shadow:0 8px 18px rgba(11,107,84,.14)}.lang-switch-label,.site-account-icons{display:inline-flex;align-items:center;border:1px solid #d6e3dc;background:#fff;color:#315241}.lang-switch-label{gap:5px;min-height:34px;padding:0 10px;border-radius:999px;font-size:12px;font-weight:900}.site-account-icons{gap:4px;padding:3px;border-radius:999px}.site-account-icon{width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;color:#315241;text-decoration:none}.desktop-side-nav-icon{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .site-mobile-menu{position:relative;display:none}.site-mobile-menu-toggle{list-style:none;width:42px;min-height:38px;display:inline-flex;align-items:center;justify-content:center;padding:0;border-radius:999px;border:1px solid #d6e3dc;background:#fff;color:#17231b;cursor:pointer}.site-mobile-menu-toggle::-webkit-details-marker{display:none}.site-mobile-menu-icon,.site-mobile-menu-icon::before,.site-mobile-menu-icon::after{display:block;width:14px;height:2px;border-radius:999px;background:currentColor}.site-mobile-menu-icon{position:relative}.site-mobile-menu-icon::before,.site-mobile-menu-icon::after{content:"";position:absolute;left:0}.site-mobile-menu-icon::before{top:-5px}.site-mobile-menu-icon::after{top:5px}.site-mobile-menu-panel{position:absolute;right:0;top:calc(100% + 9px);z-index:30;width:min(340px,calc(100vw - 28px));display:grid;gap:10px;padding:12px;border-radius:16px;border:1px solid #d6e3dc;background:#fff;box-shadow:0 20px 42px rgba(15,23,42,.16)}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.card{background:#fff;border:1px solid #d9e5dd;border-radius:8px;padding:16px}.event-photo-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:12px}.event-photo-card{margin:0;padding:0;overflow:hidden}.event-photo-card img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:#e8f1ed}.event-photo-card figcaption{padding:12px 14px;font-weight:700}.event-private-media{display:block;width:100%;max-height:360px;object-fit:contain;border-radius:8px;background:#e8f1ed}.event-private-gallery-card form{display:grid;gap:10px;margin-top:14px}.event-private-gallery-card label{display:grid;gap:6px;font-weight:700}.event-private-gallery-card textarea{box-sizing:border-box;width:100%;min-height:88px;padding:10px;border:1px solid #cbd8d0;border-radius:6px;font:inherit}
    .muted{color:#587062}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.btn{display:inline-flex;align-items:center;min-height:36px;padding:0 12px;border-radius:6px;background:#0b6b54;color:#fff;text-decoration:none;font-weight:600}
    button.btn{border:0;cursor:pointer;font:inherit}.area-sketch-card{margin-top:14px}.area-sketch-label,.area-sketch-cover label{display:grid;gap:6px;font-weight:700;color:#315241}.area-sketch-label input,.area-sketch-cover input,textarea[data-area-sketch-polygon]{width:100%;box-sizing:border-box;border:1px solid #cbd8d0;border-radius:6px;padding:9px 10px;font:inherit;background:#fff;color:#17231b}.area-sketch-map{height:420px;min-height:320px;border:1px solid #cbd8d0;border-radius:8px;overflow:hidden;background:#dce6df;margin:12px 0}.area-sketch-cover{margin-top:12px}
    .btn.secondary{background:#e8f1ed;color:#174c3d}.btn.rally-record-cta{min-height:44px}.pill{display:inline-block;border:1px solid #cbd8d0;border-radius:999px;padding:3px 8px;margin:2px;font-size:12px;color:#315241}
    pre{white-space:pre-wrap;word-break:break-word;background:#102018;color:#f3fff8;border-radius:8px;padding:12px}
    @media(max-width:900px){.site-nav-desktop,.site-search-desktop,.site-header-actions-desktop{display:none}.site-header-actions-mobile{display:flex}.site-mobile-menu{display:block}.site-header-inner{padding:9px 14px}.brand-wordmark{height:15px}.site-record-link{min-height:38px;padding:8px 11px}}
    ${FRONTEND_FOUNDATION_CSS}
    :root{--evt-motion-fast:var(--ik-motion-fast);--evt-motion:var(--ik-motion-normal);--evt-motion-slow:var(--ik-motion-slow)}
    ${APP_EXPERIENCE_STYLES}
    ${OBSERVATION_EVENT_LIST_STYLES}
    ${nativeMarker === "event-page-rally" ? OBSERVATION_EVENT_STYLES : ""}
    body[data-zukan-app-experience] main{padding-bottom:56px}body[data-zukan-app-experience] .btn{min-height:44px;border-radius:8px;background:#245c3a}body[data-zukan-app-experience] .btn.secondary{background:#edf3ee;color:#245c3a}
  </style>
</head>
<body ${standalone ? 'data-zukan-design="v1" data-event-lp="standalone"' : 'data-zukan-app-experience="v1"'}>
  ${standalone ? '<a class="zukan-app-skip" href="#main-content">本文へ</a>' : renderAppExperienceHeader(lang, 4, member)}
  <main id="main-content" tabindex="-1">
    ${body}
  </main>
${standalone ? "" : renderAppExperienceNavigation(lang, 4, "bottom", member)}
</body>
</html>`;
  return html(applyCspNonceToHtmlScripts(document, cspNonce), status, {
    ...browserSecurityHeaders(cspNonce, true),
    "cache-control": "no-store",
    "x-ikimon-cloudflare-native": nativeMarker
  });
}

export function renderObservationEventCreatePage(
  auth: SessionSnapshot | null,
  initialFieldId: string,
  template: ObservationEventTemplate | null = null,
  context: { templateKey?: CommonEventTemplateKey | null; returnPath?: string } = {},
): string {
  if (!auth || auth.banned) {
    const returnPath = safeRedirectPath(context.returnPath, "/community/events/new");
    return `<section class="card event-auth-required"><h1>観察会を作成</h1><p class="muted">招待された主催者が、参加する人と歩くためのページです。</p><p>観察会を作成するには、ZUKANにログインしてください。</p><div class="actions"><a class="btn" href="/login?redirect=${escapeHtml(encodeURIComponent(returnPath))}">ログイン</a><a class="btn secondary" href="/community/events">観察会を見る</a></div></section>`;
  }
  const eventTemplate = context.templateKey
    ? { contract_version: COMMON_EVENT_TEMPLATE_CONTRACT_VERSION, key: context.templateKey }
    : isCommonEventTemplateConfig(template?.config.event_template) ? template.config.event_template : null;
  const discoveryJournalEnabled = eventTemplate?.key === "ryuyo" || isEventDiscoveryProfile(template?.config ?? {});
  const eventTemplateJson = JSON.stringify(eventTemplate).replace(/</g, "\\u003c");
  const initialFieldIdJson = JSON.stringify(initialFieldId).replace(/</g, "\\u003c");
  const templateSourceSessionIdJson = JSON.stringify(template?.sessionId ?? null).replace(/</g, "\\u003c");
  const templateTitle = template?.title ? `${template.title}（再開催）` : discoveryJournalEnabled ? RYUYO_DISCOVERY_TITLE : "";
  const templateTargetSpecies = template?.targetSpecies?.join(", ") ?? "";
  const templateMode = template?.primaryMode ?? "discovery";
  const templateFieldId = template?.fieldId ?? initialFieldId;
  return `<section class="card"><h1>観察会を作成</h1><p class="muted">招待された主催者が、参加する人と歩くためのページです。</p><p>ログイン中: ${escapeHtml(auth.displayName)}</p><div class="actions"><a class="btn secondary" href="/community/events">観察会を見る</a><a class="btn secondary" href="/guide-programs">ガイド企画を見る</a></div></section>
<section class="card" data-observation-event-create>
  <h2>共同活動の基本情報</h2>
  ${eventTemplate ? `<p class="muted" data-common-event-template="${eventTemplate.key}">${escapeHtml(COMMON_EVENT_TEMPLATE_LABELS[eventTemplate.key])}の開催準備です。日時・条件は主催者が確認して入力してください。</p>` : ""}
  <p class="muted">参加コードでメンバーを招待し、記録・ガイド・振り返りを同じ観察会にまとめます。記録は参加者の設定を保ち、公開範囲は別途明示操作で決まります。</p>
  ${template ? `<p class="muted" data-template-rehost>前回の企画設定だけを再利用しています。参加者・同意・review・公開状態は引き継ぎません。</p>` : ""}
  <form data-observation-event-create-form style="display:grid;gap:12px;">
    <label>タイトル<input name="title" value="${escapeHtml(templateTitle)}" required maxlength="80" placeholder="例: 秋の里山観察会"></label>
    <label>開始日時（日本時間）<input name="started_at" required type="datetime-local"></label>
    <label>終了日時（日本時間）<input name="ended_at" type="datetime-local"></label>
    <label>フィールドID<input name="field_id" value="${escapeHtml(templateFieldId)}" maxlength="120" placeholder="例: aikan-renri-ikan-hq"></label>
    <label>緯度（フィールドIDがない場合）<input name="location_lat" type="number" step="any" min="-90" max="90" placeholder="34.7108"></label>
    <label>経度（フィールドIDがない場合）<input name="location_lng" type="number" step="any" min="-180" max="180" placeholder="137.7261"></label>
    <label>参加コード<input name="event_code" maxlength="8" pattern="[A-Z0-9]*" placeholder="空欄なら自動生成"></label>
    <label>観察モード<select name="primary_mode"><option value="discovery"${templateMode === "discovery" ? " selected" : ""}>見つける</option><option value="effort_maximize"${templateMode === "effort_maximize" ? " selected" : ""}>数える</option><option value="bingo"${templateMode === "bingo" ? " selected" : ""}>ビンゴ</option><option value="absence_confirm"${templateMode === "absence_confirm" ? " selected" : ""}>いないを確かめる</option><option value="ai_quest"${templateMode === "ai_quest" ? " selected" : ""}>AIクエスト</option></select></label>
    <label>観察したいもの<input name="target_species" value="${escapeHtml(templateTargetSpecies)}" maxlength="240" placeholder="例: ヤマセミ, エナガ"></label>
    ${discoveryJournalEnabled ? `<input name="plan" type="hidden" value="public"><p class="muted">参加コードを知っている人が参加できます。イベント一覧には掲載されません。写真や紙の発見は、本人の同意と主催者の確認後に、この会のアルバムにまとまります。</p>` : `<label style="display:flex;gap:8px;align-items:center;"><input name="plan" type="checkbox" value="public"> 公開用の観察会として扱う</label>`}
    <button class="btn" type="submit">観察会を作る</button>
    <p class="muted" data-observation-event-create-status role="status" aria-live="polite"></p>
    <a class="btn" data-observation-event-organizer-link hidden href="/community/events" style="min-height:44px;">主催者ページを開く</a>
    <a class="btn secondary" data-observation-event-join-link hidden href="/community/events" style="min-height:44px;">参加ページを開く</a>
  </form>
</section>
<script>
(() => {
  const form = document.querySelector("[data-observation-event-create-form]");
  const status = document.querySelector("[data-observation-event-create-status]");
  const joinLink = document.querySelector("[data-observation-event-join-link]");
  const organizerLink = document.querySelector("[data-observation-event-organizer-link]");
  const templateSourceSessionId = ${templateSourceSessionIdJson};
  const eventTemplate = ${eventTemplateJson};
  const discoveryJournalEnabled = ${JSON.stringify(discoveryJournalEnabled)};
  if (!(form instanceof HTMLFormElement)) return;
  const parseEventTokyoDateTime = (value) => {
    const match = /^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2})(?::(\\d{2})(?:\\.(\\d{1,3}))?)?$/.exec(String(value || "").trim());
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6] || "0");
    const millisecond = Number(String(match[7] || "").padEnd(3, "0") || "0");
    const wallClockAsUtc = new Date(0);
    wallClockAsUtc.setUTCFullYear(year, month - 1, day);
    wallClockAsUtc.setUTCHours(hour, minute, second, millisecond);
    if (wallClockAsUtc.getUTCFullYear() !== year || wallClockAsUtc.getUTCMonth() + 1 !== month
      || wallClockAsUtc.getUTCDate() !== day || wallClockAsUtc.getUTCHours() !== hour
      || wallClockAsUtc.getUTCMinutes() !== minute || wallClockAsUtc.getUTCSeconds() !== second
      || wallClockAsUtc.getUTCMilliseconds() !== millisecond) return null;
    return new Date(wallClockAsUtc.getTime() - 9 * 60 * 60 * 1000);
  };
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button[type=submit]");
    if (button instanceof HTMLButtonElement) button.disabled = true;
    if (status) status.textContent = "観察会を作成しています…";
    const data = new FormData(form);
    const startedAt = parseEventTokyoDateTime(data.get("started_at"));
    const endedAtValue = String(data.get("ended_at") || "").trim();
    const endedAt = endedAtValue ? parseEventTokyoDateTime(endedAtValue) : null;
    if (!startedAt || (endedAtValue && !endedAt) || (endedAt && endedAt <= startedAt)) {
      if (status) status.textContent = "開始日時と、それより後の終了日時を確認してください。";
      if (button instanceof HTMLButtonElement) button.disabled = false;
      return;
    }
    const codeInput = form.elements.namedItem("event_code");
    if (codeInput instanceof HTMLInputElement && !codeInput.value.trim()) {
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      codeInput.value = Array.from(crypto.getRandomValues(new Uint8Array(8)), (value) => alphabet[value % alphabet.length]).join("");
      data.set("event_code", codeInput.value);
    }
    const targetSpecies = String(data.get("target_species") || "").split(",").map((item) => item.trim()).filter(Boolean);
    const payload = {
      title: String(data.get("title") || "").trim(),
      started_at: startedAt.toISOString(),
      ended_at: endedAt ? endedAt.toISOString() : null,
      field_id: String(data.get("field_id") || "").trim() || null,
      location_lat: String(data.get("location_lat") || "").trim() ? Number(data.get("location_lat")) : null,
      location_lng: String(data.get("location_lng") || "").trim() ? Number(data.get("location_lng")) : null,
      event_code: String(data.get("event_code") || "").trim().toUpperCase() || null,
      primary_mode: String(data.get("primary_mode") || "discovery"),
      active_modes: [String(data.get("primary_mode") || "discovery"), "rally"],
      target_species: targetSpecies,
      plan: discoveryJournalEnabled || data.get("plan") === "public" ? "public" : "community",
      template_source_session_id: templateSourceSessionId,
      config: { collaboration_surface: "observation-event", public_list_visibility: discoveryJournalEnabled ? "hidden" : "private-until-explicit", rehost_mode: templateSourceSessionId ? "configuration-only" : null, ...(eventTemplate ? { event_template: eventTemplate } : {}), ...(discoveryJournalEnabled ? { guest_media_enabled: true, public_listed: false, discovery_journal: { version: "event-discovery-v1", enabled: true, max_photos: 3, gallery: "unlisted" } } : {}) }
    };
    try {
      const response = await fetch("/api/v1/observation-events", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      const session = result && typeof result.session === "object" ? result.session : result;
      const sessionId = session?.session_id || session?.sessionId || result?.session_id || result?.sessionId;
      const eventCode = session?.event_code || session?.eventCode || result?.event_code || result?.eventCode || payload.event_code;
      if (!response.ok || !sessionId || !eventCode) throw new Error(result?.error || "観察会を作成できませんでした");
      if (joinLink instanceof HTMLAnchorElement) {
        joinLink.href = "/community/events/" + encodeURIComponent(eventCode) + "/join";
        joinLink.hidden = false;
      }
      if (organizerLink instanceof HTMLAnchorElement) {
        organizerLink.href = "/events/" + encodeURIComponent(sessionId) + "/console";
        organizerLink.hidden = false;
      }
      if (status) status.textContent = discoveryJournalEnabled ? "開催ページを作成しました。主催者ページで受付を開始すると、参加コードから写真を残せます。"
        : eventTemplate
        ? "観察会を作成しました。主催者ページでミッションと受付の状態を確認できます。"
        : "観察会を作成しました。参加コードでメンバーを招待できます。";
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : "観察会を作成できませんでした";
      if (button instanceof HTMLButtonElement) button.disabled = false;
    }
  });
})();
</script>
<section class="card area-sketch-card" data-area-sketch-assist>
  <h2>歩く範囲を決める</h2>
  <p class="muted">地図でおおまかな範囲を決め、あとで見直せるメモを残します。正式な境界や申請を決めるものではありません。</p>
  <label class="area-sketch-label">フィールドID<input data-area-sketch-field-id value="${escapeHtml(initialFieldId)}" placeholder="例: renri-area-sketch-field"></label>
  <div class="area-sketch-map" data-area-sketch-map aria-label="開催エリアを指定する地図"></div>
  <div class="actions">
    <button type="button" class="btn" data-area-sketch-close>閉じて整える</button>
    <button type="button" class="btn secondary" data-area-sketch-undo>1点戻す</button>
    <button type="button" class="btn secondary" data-area-sketch-clear>クリア</button>
    <button type="button" class="btn secondary" data-area-sketch-load>保存済みを読み込み</button>
  </div>
  <p class="muted" data-area-sketch-status>地図をクリックして区域候補の点を追加してください。</p>
  <textarea data-area-sketch-polygon rows="5" aria-label="Area Sketch polygon GeoJSON"></textarea>
  <div class="grid area-sketch-cover">
    <label>農地<input type="number" min="0" max="100" step="1" value="0" data-cover-category="farmland"></label>
    <label>樹木・植栽<input type="number" min="0" max="100" step="1" value="40" data-cover-category="trees_planting"></label>
    <label>草地<input type="number" min="0" max="100" step="1" value="20" data-cover-category="grassland"></label>
    <label>水辺<input type="number" min="0" max="100" step="1" value="0" data-cover-category="water_edge"></label>
    <label>建物<input type="number" min="0" max="100" step="1" value="10" data-cover-category="building"></label>
    <label>舗装<input type="number" min="0" max="100" step="1" value="20" data-cover-category="pavement_parking"></label>
    <label>不明<input type="number" min="0" max="100" step="1" value="10" data-cover-category="unknown"></label>
  </div>
  <div class="actions"><button type="button" class="btn" data-area-sketch-save>下書き診断を保存</button></div>
  <pre data-area-sketch-preview>保存後に、範囲の見込みと追加で確認することをここに表示します。</pre>
</section>
<script>
(function(){
  var initialFieldId = ${initialFieldIdJson};
  var points = [];
  var map;
  var layer;
  var markerLayer;
  var status = document.querySelector("[data-area-sketch-status]");
  var polygonBox = document.querySelector("[data-area-sketch-polygon]");
  var preview = document.querySelector("[data-area-sketch-preview]");
  var fieldInput = document.querySelector("[data-area-sketch-field-id]");
  if (fieldInput && initialFieldId) fieldInput.value = initialFieldId;
  function setStatus(message) { if (status) status.textContent = message; }
  function polygonFromPoints() {
    if (points.length < 3) return null;
    var ring = points.map(function(point) { return [point.lng, point.lat]; });
    var first = ring[0];
    var last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
    return { type: "Polygon", coordinates: [ring] };
  }
  function updatePolygonBox() {
    var polygon = polygonFromPoints();
    if (polygonBox) polygonBox.value = polygon ? JSON.stringify(polygon, null, 2) : "";
    if (layer && map) {
      layer.clearLayers();
      if (polygon) layer.addData(polygon);
    }
    if (markerLayer && window.L) {
      markerLayer.clearLayers();
      points.forEach(function(point) { window.L.circleMarker([point.lat, point.lng], { radius: 5, color: "#0b6b54" }).addTo(markerLayer); });
    }
    setStatus(points.length + "点を指定中。3点以上で下書き診断を保存できます。");
  }
  function readPolygon() {
    if (!polygonBox || !polygonBox.value.trim()) return polygonFromPoints();
    try { return JSON.parse(polygonBox.value); } catch (_) { return null; }
  }
  function landCoverPayload() {
    return Array.from(document.querySelectorAll("[data-cover-category]")).map(function(input) {
      var percent = Math.max(0, Math.min(100, Number(input.value) || 0));
      return { category: input.getAttribute("data-cover-category"), ratio: percent / 100 };
    }).filter(function(item) { return item.ratio > 0; });
  }
  function renderAssessment(assessment) {
    var result = assessment && assessment.resultPayload ? assessment.resultPayload : {};
    var checklist = Array.isArray(result.evidenceChecklist) ? result.evidenceChecklist.map(function(item) { return "- " + item.label; }).join("\\n") : "";
    if (preview) preview.textContent = [
      "概算面積: " + (result.totalAreaHa || assessment.areaHa || 0) + " ha",
      "緑地割合: " + (result.greenRatioPercent || 0) + "%",
      "緑地候補面積: " + (result.greenCandidateAreaHa || assessment.greenCandidateAreaHa || 0) + " ha",
      "不足資料:",
      checklist || "- 追加確認なし"
    ].join("\\n");
    if (assessment.normalizedPolygon) {
      if (polygonBox) polygonBox.value = JSON.stringify(assessment.normalizedPolygon, null, 2);
      if (layer) {
        layer.clearLayers();
        layer.addData(assessment.normalizedPolygon);
        try { map.fitBounds(layer.getBounds(), { padding: [16, 16] }); } catch (_) {}
      }
    }
  }
  async function saveAssessment() {
    var fieldId = fieldInput ? fieldInput.value.trim() : "";
    var polygon = readPolygon();
    if (!fieldId) return setStatus("保存先のフィールドIDを入力してください。");
    if (!polygon) return setStatus("3点以上で区域候補を作成してください。");
    setStatus("下書き診断を保存しています。");
    var response = await fetch("/api/v1/fields/" + encodeURIComponent(fieldId) + "/area-sketch-assessments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sketch_polygon: polygon,
        land_cover: landCoverPayload(),
        policy_version: "tsunag_2026_current",
        visibility: "private",
        evidence_payload: { source: "worker_event_create_area_sketch_panel" }
      })
    });
    var payload = await response.json().catch(function() { return {}; });
    if (!response.ok) return setStatus(payload.error || "下書き診断を保存できませんでした。");
    renderAssessment(payload.assessment);
    setStatus("下書き診断を保存しました。");
  }
  async function loadLatestAssessment() {
    var fieldId = fieldInput ? fieldInput.value.trim() : "";
    if (!fieldId) return setStatus("読み込むフィールドIDを入力してください。");
    var response = await fetch("/api/v1/fields/" + encodeURIComponent(fieldId) + "/area-sketch-assessments?limit=1");
    var payload = await response.json().catch(function() { return {}; });
    if (!response.ok) return setStatus(payload.error || "保存済み下書き診断を読み込めませんでした。");
    if (!payload.assessments || !payload.assessments.length) return setStatus("保存済み下書き診断はまだありません。");
    renderAssessment(payload.assessments[0]);
    setStatus("保存済み下書き診断を読み込みました。");
  }
  function bootLeaflet() {
    if (!window.L) return setStatus("地図ライブラリを読み込めませんでした。GeoJSON欄へ直接入力できます。");
    map = window.L.map(document.querySelector("[data-area-sketch-map]")).setView([35.6812, 139.7671], 16);
    var streetLayer = window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" });
    var satelliteLayer = window.L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Tiles &copy; Esri" });
    streetLayer.addTo(map);
    window.L.control.layers({ "地図": streetLayer, "衛星画像": satelliteLayer }, {}, { collapsed: false, position: "topright" }).addTo(map);
    layer = window.L.geoJSON(null, { style: { color: "#0b6b54", weight: 3, fillOpacity: 0.22 } }).addTo(map);
    markerLayer = window.L.layerGroup().addTo(map);
    map.on("click", function(event) {
      points.push({ lat: event.latlng.lat, lng: event.latlng.lng });
      updatePolygonBox();
    });
  }
  function loadLeaflet() {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    var script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = bootLeaflet;
    script.onerror = function() { setStatus("地図ライブラリを読み込めませんでした。GeoJSON欄へ直接入力できます。"); };
    document.head.appendChild(script);
  }
  document.querySelector("[data-area-sketch-close]")?.addEventListener("click", updatePolygonBox);
  document.querySelector("[data-area-sketch-undo]")?.addEventListener("click", function() { points.pop(); updatePolygonBox(); });
  document.querySelector("[data-area-sketch-clear]")?.addEventListener("click", function() { points = []; if (polygonBox) polygonBox.value = ""; if (preview) preview.textContent = "保存後に、概算面積・緑地割合・不足資料リストをここに表示します。"; updatePolygonBox(); });
  document.querySelector("[data-area-sketch-save]")?.addEventListener("click", function() { saveAssessment().catch(function(error) { setStatus(error.message || "保存に失敗しました。"); }); });
  document.querySelector("[data-area-sketch-load]")?.addEventListener("click", function() { loadLatestAssessment().catch(function(error) { setStatus(error.message || "読み込みに失敗しました。"); }); });
  loadLeaflet();
})();
</script>`;
}

function renderObservationEventJoinPage(
  session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>,
  teams: Awaited<ReturnType<typeof listObservationEventTeams>>,
  isAuthenticated: boolean,
  options?: SyntheticObservationEventRenderOptions,
  applicationEnabled = false
): string {
  const eventCode = session.eventCode ?? "";
  const returnPath = `/community/events/${encodeURIComponent(eventCode)}/join`;
  const registerHref = `/register?redirect=${encodeURIComponent(returnPath)}`;
  const loginHref = `/login?redirect=${encodeURIComponent(returnPath)}`;
  const teamOptions = teams.map((team) =>
    `<option value="${escapeHtml(team.team_id)}">${escapeHtml(team.name)}</option>`
  ).join("");
  const accountCopy = options
    ? `<aside class="card" data-synthetic-account-boundary><p><strong>合成参加として操作します。</strong></p><p class="muted">アカウント、Cookie、位置情報、実データは使いません。入力はこのブラウザタブの sessionStorage にだけ残ります。</p></aside>`
    : isAuthenticated
    ? `<p class="muted">ログイン済みアカウントで参加します。このイベント用のゲストIDは作りません。</p>`
    : `<aside class="card"><p><strong>ゲストのまますぐ参加できます。</strong> ライブと終了後のふり返りは、この端末で開けます。</p><p class="muted">写真を自分の記録として残す方は、<a data-evt-register-link href="${escapeHtml(registerHref)}">無料アカウントを作る</a>か、<a data-evt-login-link href="${escapeHtml(loginHref)}">ログイン</a>してください。登録後はこの画面へ戻ります。</p></aside>`;
  const applicationLink = applicationEnabled
    ? `<p><a class="btn secondary ik-ui-action" data-event-application-link href="/community/events/${encodeURIComponent(eventCode)}/apply">参加を申し込む</a></p>`
    : "";
  return `<section class="card" data-renri-checkin-root data-session-id="${escapeHtml(session.sessionId)}" data-event-code="${escapeHtml(eventCode)}" data-authenticated="${isAuthenticated ? "true" : "false"}"${options ? ' data-synthetic="true"' : ""}>
    <p class="pill">観察会チェックイン</p>
    <h1>${escapeHtml(session.title)} に参加</h1>
    <p>家族・グループはスマートフォン1台で参加できます。代表者のニックネームや「○○家」で進めてください。</p>
    ${applicationLink}
    <aside class="card"><strong>名前が分からなくても大丈夫です</strong><p class="muted">位置情報を共有しなくても、参加・観察・投稿ができます。</p></aside>
    <form data-evt-checkin-form novalidate>
      <label>参加名（家族・グループ名でもOK）
        <input type="text" name="display_name" required maxlength="32" autocomplete="nickname" placeholder="例: やまき家" />
      </label>
      ${teamOptions ? `<label>班（任意）<select name="team_id"><option value="">選ばない</option>${teamOptions}</select></label>` : ""}
      <label class="evt-check-row">
        <input type="checkbox" name="share_location" />
        <span>開催中だけ、主催者におおよその現在地を共有<small>位置情報を共有しなくても同じように参加できます。終了後は自動で止まります。</small></span>
      </label>
      <label class="evt-check-row">
        <input type="checkbox" name="is_minor" />
        <span>参加者に未成年が含まれます</span>
      </label>
      <label class="evt-check-row" data-guardian-consent-row hidden>
        <input type="checkbox" name="guardian_location_consent" />
        <span>未成年の位置共有について、保護者または引率者が同意しています</span>
      </label>
      ${accountCopy}
      <p class="muted" data-evt-checkin-status role="status" aria-live="polite"></p>
      <button type="submit" class="btn" data-evt-checkin-submit>観察を始める</button>
      ${options ? `<button type="button" class="btn secondary" data-synthetic-checkin-error>合成通信エラー表示を確認</button><a class="btn secondary" data-synthetic-checkin-continue href="${escapeHtml(`${options.syntheticQaBasePath}/rally`)}" hidden>合成ラリーへ進む</a>` : ""}
    </form>
  </section>${options ? syntheticObservationEventJoinScript() : observationEventJoinScript()}`;
}

function renderObservationEventApplicationPage(
  session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>,
  participant: ObservationEventParticipantD1Row | null
): string {
  const joinHref = `/community/events/${encodeURIComponent(session.eventCode ?? "")}/join`;
  const continueLink = `<a class="btn secondary" data-event-application-continue href="${escapeHtml(joinHref)}">当日の参加方法を確認</a>`;
  if (participant?.role === "organizer") {
    return `<section class="card"><p class="pill">イベント申込み</p><h1>${escapeHtml(session.title)}</h1><p role="status">主催者アカウントでは参加申込みできません。</p></section>`;
  }
  if (participant?.status === "registered") {
    return `<section class="card" data-event-application-root><p class="pill">申込状況</p><h1>${escapeHtml(session.title)}</h1><p role="status" data-event-application-status><strong>申込みを受け付けました。</strong></p><p>これは申込の受領です。参加確定、定員確保、主催者からの連絡を意味しません。</p><p class="muted">同じ端末からこのページを開くと、申込の状態を再確認できます。</p>${continueLink}</section>`;
  }
  if (participant && ["checked_in", "offline", "left"].includes(participant.status)) {
    return `<section class="card" data-event-application-root><p class="pill">申込状況</p><h1>${escapeHtml(session.title)}</h1><p role="status" data-event-application-status><strong>この端末の参加記録を確認しました。</strong></p><p>新しい申込みは作成していません。</p><a class="btn secondary" href="/events/${encodeURIComponent(session.sessionId)}/rally">参加のページへ戻る</a></section>`;
  }
  return `<section class="card" data-event-application-root data-session-id="${escapeHtml(session.sessionId)}">
  <p class="pill">イベント申込み</p><h1>${escapeHtml(session.title)}</h1>
  <p>参加名を登録します。個人名・連絡先は入力しないでください。</p>
  <p class="muted">申込の受領は参加確定や定員確保ではありません。メール等の外部通知は送信しません。参加名はこのイベントの主催者が確認できます。</p>
  <form data-event-application-form>
    <label for="event-application-name">参加名（家族・グループ名でも可）</label>
    <input id="event-application-name" name="display_name" maxlength="32" autocomplete="nickname" required style="display:block;width:100%;margin-top:8px">
    <p class="muted" data-event-application-status role="status" aria-live="polite"></p>
    <button class="btn" type="submit">申込みを送る</button>
  </form>
  <div data-event-application-next hidden>${continueLink}</div>
</section>${observationEventApplicationScript()}`;
}

function observationEventApplicationScript(): string {
  return `<script>
(() => {
  const root = document.querySelector("[data-event-application-root]");
  const form = root?.querySelector("[data-event-application-form]");
  const status = root?.querySelector("[data-event-application-status]");
  const submit = form?.querySelector("button[type=submit]");
  if (!root || !form || !status || !submit) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const displayName = String(new FormData(form).get("display_name") || "").trim();
    submit.disabled = true;
    status.textContent = "申込みを保存しています。";
    try {
      const response = await fetch("/api/v1/observation-events/" + encodeURIComponent(root.dataset.sessionId || "") + "/application", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ display_name: displayName })
      });
      const result = await response.json();
      if (!response.ok || result.confirmed !== false || !result.participant) throw new Error("申込みを保存できませんでした。入力を確認して再度お試しください。");
      if (result.participant.status === "registered") {
        status.textContent = "申込みを受け付けました。参加確定や定員確保ではありません。";
      } else if (["checked_in", "offline", "left"].includes(result.participant.status)) {
        status.textContent = "この端末の参加記録を確認しました。新しい申込みは作成していません。";
      } else {
        throw new Error("申込みの状態を確認できませんでした。ページを再読み込みしてください。");
      }
      form.querySelectorAll("input,button").forEach((control) => { control.disabled = true; });
      const next = root.querySelector("[data-event-application-next]");
      if (next) next.hidden = false;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "申込みの状態を確認できませんでした。ページを再読み込みしてください。";
      submit.disabled = false;
    }
  });
})();
</script>`;
}

function syntheticObservationEventJoinScript(): string {
  return `<script>
(() => {
  const root = document.querySelector("[data-renri-checkin-root][data-synthetic='true']");
  if (!root) return;
  const form = root.querySelector("[data-evt-checkin-form]");
  const status = root.querySelector("[data-evt-checkin-status]");
  const submit = root.querySelector("[data-evt-checkin-submit]");
  const displayName = form?.querySelector('input[name="display_name"]');
  const teamId = form?.querySelector('[name="team_id"]');
  const shareLocation = form?.querySelector('input[name="share_location"]');
  const isMinor = form?.querySelector('input[name="is_minor"]');
  const guardianConsent = form?.querySelector('input[name="guardian_location_consent"]');
  const guardianRow = root.querySelector("[data-guardian-consent-row]");
  const errorButton = root.querySelector("[data-synthetic-checkin-error]");
  const continueLink = root.querySelector("[data-synthetic-checkin-continue]");
  const draftKey = "synthetic-renri-checkin-draft-v1";

  function setStatus(message, error) {
    if (!status) return;
    status.textContent = message || "";
    status.style.color = error ? "#b91c1c" : "#047857";
  }
  function syncGuardian() {
    const required = Boolean(isMinor?.checked && shareLocation?.checked);
    if (guardianRow) guardianRow.hidden = !required;
    if (!required && guardianConsent) guardianConsent.checked = false;
  }
  function draft() {
    return {
      displayName: String(displayName?.value || ""),
      teamId: String(teamId?.value || ""),
      shareLocation: Boolean(shareLocation?.checked),
      isMinor: Boolean(isMinor?.checked),
      guardianConsent: Boolean(guardianConsent?.checked)
    };
  }
  function saveDraft() {
    try { sessionStorage.setItem(draftKey, JSON.stringify(draft())); } catch {}
  }
  function restoreDraft() {
    try {
      const value = JSON.parse(sessionStorage.getItem(draftKey) || "null");
      if (!value || typeof value !== "object") return;
      if (displayName && typeof value.displayName === "string") displayName.value = value.displayName;
      if (teamId && typeof value.teamId === "string") teamId.value = value.teamId;
      if (shareLocation) shareLocation.checked = value.shareLocation === true;
      if (isMinor) isMinor.checked = value.isMinor === true;
      if (guardianConsent) guardianConsent.checked = value.guardianConsent === true;
    } catch {}
  }

  restoreDraft();
  syncGuardian();
  form?.addEventListener("input", saveDraft);
  isMinor?.addEventListener("change", syncGuardian);
  shareLocation?.addEventListener("change", syncGuardian);
  errorButton?.addEventListener("click", () => {
    saveDraft();
    setStatus("合成通信エラーです。入力内容はこのタブに残っています。実際の通信は行っていません。", true);
  });
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = String(displayName?.value || "").trim();
    if (!name) {
      setStatus("参加名を入力してください。", true);
      displayName?.focus();
      return;
    }
    if (isMinor?.checked && shareLocation?.checked && !guardianConsent?.checked) {
      setStatus("位置情報を共有する場合は、保護者または引率者の同意を確認してください。共有しない設定でも参加できます。", true);
      guardianConsent?.focus();
      return;
    }
    saveDraft();
    if (submit) submit.disabled = true;
    setStatus("合成参加の操作確認が完了しました。D1・R2・Queue・実APIへの送信はありません。", false);
    if (continueLink) continueLink.hidden = false;
  });
})();
</script>`;
}

function observationEventJoinScript(): string {
  return `<script>
(() => {
  const root = document.querySelector("[data-renri-checkin-root]");
  if (!root) return;
  const sessionId = String(root.dataset.sessionId || "");
  const eventCode = String(root.dataset.eventCode || "");
  const form = root.querySelector("[data-evt-checkin-form]");
  const status = root.querySelector("[data-evt-checkin-status]");
  const submit = root.querySelector("[data-evt-checkin-submit]");
  const displayName = form?.querySelector('input[name="display_name"]');
  const teamId = form?.querySelector('[name="team_id"]');
  const shareLocation = form?.querySelector('input[name="share_location"]');
  const isMinor = form?.querySelector('input[name="is_minor"]');
  const guardianConsent = form?.querySelector('input[name="guardian_location_consent"]');
  const guardianRow = root.querySelector("[data-guardian-consent-row]");
  const draftKey = "evt-checkin-draft:" + sessionId;

  function setStatus(message, error) {
    if (!status) return;
    status.textContent = message || "";
    status.style.color = error ? "#b91c1c" : "#047857";
  }
  function syncGuardian() {
    const required = Boolean(isMinor?.checked && shareLocation?.checked);
    if (guardianRow) guardianRow.hidden = !required;
    if (!required && guardianConsent) guardianConsent.checked = false;
  }
  function draft() {
    return {
      displayName: String(displayName?.value || ""),
      teamId: String(teamId?.value || ""),
      shareLocation: Boolean(shareLocation?.checked),
      isMinor: Boolean(isMinor?.checked),
      guardianConsent: Boolean(guardianConsent?.checked)
    };
  }
  function saveDraft() {
    try { sessionStorage.setItem(draftKey, JSON.stringify(draft())); } catch {}
  }
  function restoreDraft() {
    try {
      const value = JSON.parse(sessionStorage.getItem(draftKey) || "null");
      if (!value || typeof value !== "object") return;
      if (displayName && typeof value.displayName === "string") displayName.value = value.displayName;
      if (teamId && typeof value.teamId === "string") teamId.value = value.teamId;
      if (shareLocation) shareLocation.checked = value.shareLocation === true;
      if (isMinor) isMinor.checked = value.isMinor === true;
      if (guardianConsent) guardianConsent.checked = value.guardianConsent === true;
    } catch {}
  }

  restoreDraft();
  syncGuardian();
  form?.addEventListener("input", saveDraft);
  isMinor?.addEventListener("change", syncGuardian);
  shareLocation?.addEventListener("change", syncGuardian);
  root.querySelectorAll("[data-evt-register-link], [data-evt-login-link]").forEach((link) => link.addEventListener("click", saveDraft));

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submit?.disabled) return;
    const name = String(displayName?.value || "").trim();
    if (!name) {
      setStatus("参加名を入力してください。", true);
      displayName?.focus();
      return;
    }
    if (isMinor?.checked && shareLocation?.checked && !guardianConsent?.checked) {
      setStatus("位置情報を共有する場合は、保護者または引率者の同意を確認してください。共有しない設定でも参加できます。", true);
      guardianConsent?.focus();
      return;
    }
    saveDraft();
    if (submit) submit.disabled = true;
    setStatus("参加情報を確認しています…", false);
    try {
      const response = await fetch("/api/v1/observation-events/" + encodeURIComponent(sessionId) + "/checkin", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          display_name: name,
          team_id: String(teamId?.value || "") || null,
          share_location: Boolean(shareLocation?.checked),
          is_minor: Boolean(isMinor?.checked),
          guardian_location_consent: Boolean(guardianConsent?.checked)
        })
      });
      if (!response.ok) {
        setStatus("チェックインできませんでした。通信状況を確認して、同じボタンでもう一度お試しください。入力内容は残っています。", true);
        return;
      }
      try {
        sessionStorage.removeItem(draftKey);
        sessionStorage.setItem("evt-event-code:" + sessionId, eventCode);
      } catch {}
      setStatus("参加できました。観察画面を開きます。", false);
      window.setTimeout(() => {
        window.location.href = "/events/" + encodeURIComponent(sessionId) + "/rally";
      }, 250);
    } catch {
      setStatus("通信が途切れました。電波が戻ったら、同じボタンでもう一度お試しください。入力内容は残っています。", true);
    } finally {
      if (submit) submit.disabled = false;
    }
  });
})();
</script>`;
}

function renderObservationEventLivePage(
  session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>,
  teams: Awaited<ReturnType<typeof listObservationEventTeams>>,
  events: PublicObservationEventLiveEvent[],
  canManage: boolean
): string {
  const summary = summarizePublicObservationEventLive(events);
  return `<section><h1>${escapeHtml(session.title)} 参加者向けライブ</h1><p class="muted">チェックイン済みの参加者だけが見られる、観察会の最新情報です。</p>${canManage ? `<div class="actions"><a class="btn" href="/events/${encodeURIComponent(session.sessionId)}/console">管制塔</a></div>` : ""}<div class="grid"><article class="card"><h2>観察の更新</h2><p>${summary.observationCount}件</p></article><article class="card"><h2>最近の動き</h2><p>${summary.eventCount}件</p></article></div><article class="card"><h2>観察の手がかり</h2><p class="muted">記録の内容は個別の記録画面で確認できます。</p></article><h2>最近の動き</h2>${renderObservationEventTimeline(events)}</section>`;
}

function renderObservationEventConsolePage(
  session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>,
  teams: Awaited<ReturnType<typeof listObservationEventTeams>>,
  events: Awaited<ReturnType<typeof listObservationEventLiveEvents>>,
  effort: Awaited<ReturnType<typeof summarizeObservationEventEffort>> | null,
  dashboard: Awaited<ReturnType<typeof buildObservationEventOperationsDashboard>>
): string {
  const organizerPanel = renderObservationEventTemplateOrganizer({
    sessionId: session.sessionId,
    discoveryJournalEnabled: isEventDiscoveryProfile(session.config),
    sessionClosed: !isObservationEventCheckinOpen(session),
    templateKey: isCommonEventTemplateConfig(session.config.event_template) ? session.config.event_template.key : null
  });
  const funnelRows = dashboard.funnel.map((stage) => `<tr><th scope="row">${escapeHtml(stage.label)}</th><td>${stage.count}</td><td>${stage.conversionFromPreviousPct === null ? "—" : `${stage.conversionFromPreviousPct}%`}</td></tr>`).join("");
  const unsynced = dashboard.domain.unsynced.status === "not_measurable" ? "計測不可（durable queueなし）" : escapeHtml(dashboard.domain.unsynced.count ?? 0);
  const liveDelay = dashboard.domain.liveAggregationDelay.status === "not_measurable" ? "計測不可（反映時刻を別保持していません）" : `${escapeHtml(dashboard.domain.liveAggregationDelay.seconds ?? 0)}秒`;
  const reportLink = hasProfessionalReportEntitlement(session)
    ? `<a class="btn secondary" href="/events/${encodeURIComponent(session.sessionId)}/report">公式出力</a>`
    : "";
  return `<section><h1>${escapeHtml(session.title)} 管制塔</h1>${organizerPanel}<div class="grid"><article class="card"><h2>状態</h2><p>${escapeHtml(session.primaryMode)}</p><p class="muted">${escapeHtml(session.startedAt)} - ${escapeHtml(session.endedAt ?? "open")}</p></article><article class="card"><h2>努力量</h2><p>${escapeHtml(effort?.totalEffortPersonHours ?? 0)} person-hours</p><p>${escapeHtml(effort?.coveragePct ?? 0)}% coverage</p></article><article class="card"><h2>チーム</h2><p>${teams.length}</p></article></div><h2>当日ドメイン集計</h2><div class="grid"><article class="card"><h3>チェックイン済み家族・グループ</h3><p>${dashboard.domain.checkedInFamiliesOrGroups}</p></article><article class="card"><h3>観察件数</h3><p>${dashboard.domain.observationCount}</p></article><article class="card"><h3>投稿 成功 / 失敗シグナル</h3><p>${dashboard.domain.submissionSucceededCount} / ${dashboard.domain.submissionFailedSignalCount}</p></article><article class="card"><h3>未同期件数</h3><p>${unsynced}</p></article><article class="card"><h3>live集計の遅延</h3><p>${liveDelay}</p></article><article class="card"><h3>recap生成状態</h3><p>${escapeHtml(dashboard.domain.recapStatus)}</p></article></div><p class="muted">最終更新: ${escapeHtml(dashboard.domain.lastUpdatedAt)}</p><h2>Funnel</h2><div class="card"><table><thead><tr><th>段階</th><th>件数</th><th>直前比</th></tr></thead><tbody>${funnelRows}</tbody></table><p class="muted">check-in失敗 ${dashboard.failures.checkin}件 / 観察保存失敗 ${dashboard.failures.observation}件。失敗件数は参加者テレメトリ由来の参考信号であり、単独ではフォールバックを発動しません。スタッフ再現またはドメイン健全性の異常で照合してください。参加組数・観察件数はD1のdomain counterを正本とします。</p></div><div class="actions"><a class="btn" href="/api/v1/observation-events/${encodeURIComponent(session.sessionId)}/dashboard">dashboard API</a><a class="btn secondary" href="/api/v1/observation-events/${encodeURIComponent(session.sessionId)}/effort">effort API</a>${reportLink}</div><h2>運営イベント（個人情報なし）</h2>${renderObservationEventOperationalTimeline(events)}</section>`;
}

function renderObservationEventEditPage(session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>): string {
  return `<section class="card"><h1>${escapeHtml(session.title)} 編集</h1><p class="muted">Worker/D1 runtimeでは、更新は PATCH /api/v1/observation-events/:sessionId に集約します。</p><pre>${escapeHtml(JSON.stringify({ sessionId: session.sessionId, title: session.title, primaryMode: session.primaryMode, activeModes: session.activeModes, targetSpecies: session.targetSpecies }, null, 2))}</pre><div class="actions"><a class="btn" href="/events/${encodeURIComponent(session.sessionId)}/console">管制塔</a><a class="btn secondary" href="/api/v1/observation-events/${encodeURIComponent(session.sessionId)}">session API</a></div></section>`;
}

function renderObservationEventRallyPage(
  session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>,
  rally: Omit<Awaited<ReturnType<typeof getObservationRallySnapshot>>, "readOnly"> & { readOnly?: boolean },
  isAuthenticated: boolean,
  canManage: boolean,
  options?: SyntheticObservationEventRenderOptions,
  guestMediaEnabled = false,
  guestMediaCanReview = false,
  guestMediaCanSubmit = false
): string {
  if (!options) {
    const body = renderObservationRallyBody({
      session,
      isOrganizer: canManage,
      ...(guestMediaEnabled ? { recordHref: "#event-private-media" } : {})
    });
    const media = guestMediaEnabled
      ? `<div id="event-private-media">${renderObservationEventGuestMediaPanel(session.sessionId, guestMediaCanReview, guestMediaCanSubmit)}</div>`
      : "";
    return `${body}${media}<script>${observationRallyScript()}</script>`;
  }
  const recordParams = new URLSearchParams();
  if (session.eventCode) recordParams.set("event", session.eventCode);
  recordParams.set("eventSessionId", session.sessionId);
  recordParams.set("rally", "1");
  recordParams.set("activityIntent", "share");
  recordParams.set("start", "photo");
  const recordHref = `/record?${recordParams.toString()}`;
  const registerHref = `/register?redirect=${encodeURIComponent(recordHref)}`;
  const loginHref = `/login?redirect=${encodeURIComponent(recordHref)}`;
  const recordAction = options
    ? `<button type="button" class="btn rally-record-cta" data-synthetic-record-action disabled>実投稿なし（合成QA）</button>`
    : isAuthenticated
    ? `<a class="btn rally-record-cta" href="${escapeHtml(recordHref)}" data-rally-action="record">写真を記録する</a>`
    : `<a class="btn rally-record-cta" href="${escapeHtml(registerHref)}" data-rally-action="record" data-event-registration-start>無料アカウントを作って記録する</a><a class="btn secondary" href="${escapeHtml(loginHref)}" data-event-registration-start>ログインして記録する</a>`;
  const accountCopy = options
    ? "合成ミッションの表示とブラウザ内操作だけを確認します。写真、位置、アカウント情報は送信しません。"
    : isAuthenticated
    ? "写真はログイン中のアカウントへ保存され、この観察会の振り返りにつながります。"
    : "写真を自分の記録として安全に残すには、無料アカウント作成またはログインが必要です。ゲストの参加状態はこの端末に残ります。";
  const registrationAnalytics = options || isAuthenticated ? "" : observationEventRegistrationStartScript(session.sessionId);
  const progressHref = options
    ? `${options.syntheticQaBasePath}/live`
    : `/api/v1/observation-events/${encodeURIComponent(session.sessionId)}/rally`;
  const guestMedia = guestMediaEnabled
    ? renderObservationEventGuestMediaPanel(session.sessionId, guestMediaCanReview, guestMediaCanSubmit)
    : "";
  return `<section><h1>${escapeHtml(session.title)} 観察ラリー</h1><article class="card"><h2>見つけたものを記録しよう</h2><p>${escapeHtml(accountCopy)}</p><div class="actions">${recordAction}</div></article>${guestMedia}<div class="grid"><article class="card"><h2>${escapeHtml(rally.course?.title ?? "観察ラリー未作成")}</h2><p class="muted">${escapeHtml(rally.course?.status ?? "draft")}</p></article><article class="card"><h2>地点</h2><p>${rally.stations.length}</p></article><article class="card"><h2>ミッション</h2><p>${rally.missions.length}</p></article></div><div class="actions"><a class="btn secondary" href="${escapeHtml(progressHref)}">${options ? "合成ライブを見る" : "ラリーの進み具合"}</a>${!options && canManage ? `<a class="btn secondary" href="/events/${encodeURIComponent(session.sessionId)}/console">管制塔</a>` : ""}</div></section>${registrationAnalytics}`;
}

function renderObservationEventGuestMediaPanel(sessionId: string, canReview: boolean, canSubmit: boolean): string {
  const sessionIdJson = JSON.stringify(sessionId).replace(/</g, "\\u003c");
  const captureForm = canSubmit ? `<form data-guest-media-form><label>写真を撮る、または選ぶ<input name="media" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" capture="environment" required></label><label class="evt-check-row"><input name="private_storage_consent" type="checkbox" value="yes" required><span>写真・動画を非公開で保存し、このイベント内の権利確認に使うことに同意します。</span></label><label class="evt-check-row"><input name="creator_rights_attestation" type="checkbox" value="yes" required><span>自分で撮影した写真・動画、またはこの用途で使う許可を得たものです。人物・名札・車の番号など、見せたくないものが写っていないことを確認しました。</span></label><button class="btn" type="submit">非公開で保存する</button></form>` : "";
  return `<section class="card" data-guest-media-panel data-session-id="${escapeHtml(sessionId)}"><h2>写真と動画を非公開で残す</h2><p class="muted">保存した写真・動画はあなたと主催者だけが確認できます。動画の音声・位置情報を含め、主催者の確認が終わるまで結果や公開ページには表示しません。</p>${captureForm}<p class="muted" data-guest-media-status role="status" aria-live="polite"></p><h3>この端末の受取</h3><ul data-guest-media-receipts></ul><h3>イベント内の結果</h3><p data-guest-media-results role="status" aria-live="polite">権利確認が済んだメディアだけを集計します。公開には使いません。</p><p><a class="btn secondary" href="/events/${encodeURIComponent(sessionId)}/gallery">保存した写真・動画を見る</a></p>${canReview ? `<div data-guest-media-review><h3>権利確認が必要な写真・動画</h3><ul data-guest-media-review-list></ul></div>` : ""}</section><script>
(() => {
  const sessionId = ${sessionIdJson};
  const root = document.querySelector('[data-guest-media-panel]');
  if (!root) return;
  const endpoint = '/api/v1/observation-events/' + encodeURIComponent(sessionId) + '/guest-media';
  const form = root.querySelector('[data-guest-media-form]');
  const status = root.querySelector('[data-guest-media-status]');
  const receipts = root.querySelector('[data-guest-media-receipts]');
  const results = root.querySelector('[data-guest-media-results]');
  const reviewList = root.querySelector('[data-guest-media-review-list]');
  function node(tag, value) { const item = document.createElement(tag); if (value) item.textContent = value; return item; }
  function load() {
    return fetch(endpoint, { credentials: 'same-origin', cache: 'no-store' }).then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '保存済みメディアを読み込めませんでした。');
      receipts.replaceChildren();
      (data.receipts || []).forEach(receipt => {
        const item = node('li', '受取 ' + receipt.receiptId + ' / ' + receipt.mediaState + ' / 権利確認: ' + receipt.rightsReviewStatus + ' / 非公開');
        if (receipt.rightsReviewStatus === 'withdrawn') {
          if (receipt.cleanupPending) {
            const retry = node('button', '削除確認を再試行'); retry.type = 'button'; retry.className = 'btn secondary';
            retry.addEventListener('click', async () => { const result = await fetch(endpoint + '/' + encodeURIComponent(receipt.receiptId) + '/withdraw', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' }); const body = await result.json().catch(() => ({})); if (!result.ok) { status.textContent = body.error === 'withdrawal_cleanup_pending' ? '削除処理の完了を確認しています。少し待って再試行してください。' : 'メディアは非公開です。削除確認を再試行してください。'; await load(); return; } status.textContent = '非公開メディアの削除を確認しました。'; await load(); }); item.append(' ', retry);
          } else item.append(' ', node('span', '削除済み・非公開'));
        } else {
          const link = node('a', '保存したメディアを見る'); link.href = receipt.privateContentHref; link.rel = 'noreferrer'; item.append(' ', link);
          const withdraw = node('button', 'このメディアを取り下げる'); withdraw.type = 'button'; withdraw.className = 'btn secondary';
          withdraw.addEventListener('click', async () => { if (!confirm('このメディアを非公開保存から削除し、イベントの確認対象から外します。削除後は元に戻せません。続けますか。')) return; const result = await fetch(receipt.privateContentHref.slice(0, receipt.privateContentHref.lastIndexOf('/')) + '/withdraw', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' }); if (!result.ok) { status.textContent = '削除できませんでした。時間をおいてもう一度お試しください。'; return; } await load(); }); item.append(' ', withdraw);
        }
        receipts.append(item);
      });
      if (!receipts.childNodes.length) receipts.append(node('li', '保存したメディアはありません。'));
      results.textContent = '未確認 ' + (data.results?.pending || 0) + '件 / 権利確認済み ' + (data.results?.approved || 0) + '件 / 掲載 ' + (data.results?.publicProjection ? 'あり' : 'なし');
      if (reviewList) {
        reviewList.replaceChildren();
        (data.reviewQueue || []).forEach(receipt => {
          const item = node('li'); const heading = node('p', '参加者からの写真・動画 / 非公開 / 権利確認が必要'); item.append(heading);
          const preview = node(receipt.mime?.startsWith('video/') ? 'video' : 'img'); preview.src = receipt.privateContentHref; preview.style.maxWidth = '100%'; preview.style.maxHeight = '320px'; if (receipt.mime?.startsWith('video/')) { preview.controls = true; preview.preload = 'none'; } else { preview.alt = '権利確認のための非公開写真'; preview.loading = 'lazy'; } item.append(preview);
          const note = node('textarea'); note.required = true; note.maxLength = 500; note.minLength = 8; note.setAttribute('aria-label', '確認した権利と写り込みの理由'); note.placeholder = '写真・動画の利用権と写り込みを確認した理由（8〜500字）'; item.append(note);
          ['approved', 'rejected'].forEach(decision => { const button = node('button', decision === 'approved' ? '権利確認を記録' : '結果から除外'); button.type = 'button'; button.className = 'btn secondary'; button.addEventListener('click', async () => { if (note.value.trim().length < 8) { note.focus(); return; } const response = await fetch(endpoint + '/' + encodeURIComponent(receipt.receiptId) + '/review', { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ decision, note: note.value.trim() }) }); const body = await response.json().catch(() => ({})); if (!response.ok) { status.textContent = body.error || '権利確認を保存できませんでした。'; return; } await load(); }); item.append(' ', button); });
          reviewList.append(item);
        });
        if (!reviewList.childNodes.length) reviewList.append(node('li', '未確認のメディアはありません。'));
      }
    }).catch(error => { status.textContent = error.message || '受取を読み込めませんでした。'; });
  }
  if (form) form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type=submit]'); if (button) button.disabled = true;
    status.textContent = 'メディアを非公開で保存しています。';
    try {
      const response = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', headers: { 'idempotency-key': crypto.randomUUID() }, body: new FormData(form) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '保存に失敗しました。');
      form.reset(); status.textContent = '非公開で保存しました。受取番号: ' + data.receipt.receiptId + '。権利確認まで結果には含まれません。'; await load();
    } catch (error) { status.textContent = error.message || '保存できませんでした。'; }
    finally { if (button) button.disabled = false; }
  });
  void load();
})();
</script>`;
}

function observationEventGuestGalleryErrorPage(sessionId: string, message: string): string {
  return `<section class="card"><h1>写真・動画を表示できません</h1><p class="muted">${escapeHtml(message)}</p><div class="actions"><a class="btn secondary" href="/events/${encodeURIComponent(sessionId)}/rally">観察ラリーへ戻る</a></div></section>`;
}

function renderObservationEventGuestGalleryPage(
  session: ObservationEventTemplate,
  data: Record<string, unknown>,
  isOrganizer: boolean,
): string {
  const receipts = Array.isArray(data.receipts)
    ? data.receipts.map(asPlainObject).filter((receipt): receipt is Record<string, unknown> => Boolean(receipt))
    : [];
  const reviewQueue = Array.isArray(data.reviewQueue)
    ? data.reviewQueue.map(asPlainObject).filter((receipt): receipt is Record<string, unknown> => Boolean(receipt))
    : [];
  const mediaCard = (receipt: Record<string, unknown>, index: number, review = false) => {
    const href = typeof receipt.privateContentHref === "string" ? receipt.privateContentHref : "";
    const mediaType = typeof receipt.mediaType === "string" ? receipt.mediaType : typeof receipt.mime === "string" ? receipt.mime : "";
    const isVideo = mediaType.startsWith("video/");
    const status = String(receipt.rightsReviewStatus ?? "pending");
    const statusLabel: Record<string, string> = {
      pending: "権利確認待ち・非公開",
      approved: "権利確認済み・非公開",
      rejected: "掲載対象外・非公開",
      withdrawn: receipt.cleanupPending === true ? "取り下げ処理を確認中・非公開" : "取り下げ済み・非公開",
    };
    const statusCopy = statusLabel[status] ?? "状態を確認できません・非公開";
    const preview = href && status !== "withdrawn"
      ? isVideo
        ? `<video class="event-private-media" controls playsinline preload="metadata" src="${escapeHtml(href)}"></video>`
        : `<a href="${escapeHtml(href)}" rel="noreferrer"><img class="event-private-media" src="${escapeHtml(href)}" alt="保存した非公開写真" loading="lazy"></a>`
      : `<p class="muted">${status === "withdrawn" ? "取り下げたメディアは表示できません。" : "メディアの受取先がありません。再読み込みしてください。"}</p>`;
    const reviewControls = review && href
      ? `<form data-gallery-review data-media-id="${escapeHtml(receipt.receiptId ?? "")}"><label>権利確認の理由<textarea name="note" minlength="8" maxlength="500" required aria-label="確認した権利と写り込みの理由"></textarea></label><div class="actions"><button class="btn" name="decision" value="approved" type="submit">権利確認を記録</button><button class="btn secondary" name="decision" value="rejected" type="submit">掲載対象外にする</button></div></form>`
      : "";
    return `<article class="card event-private-gallery-card" data-private-gallery-item><h2>${isVideo ? "動画" : "写真"} ${index + 1}</h2><p>${escapeHtml(statusCopy)}</p>${preview}${reviewControls}</article>`;
  };
  const content = isOrganizer
    ? reviewQueue.length
      ? `<div class="event-photo-grid">${reviewQueue.map((receipt, index) => mediaCard(receipt, index, true)).join("")}</div>`
      : `<p class="muted" data-gallery-empty>権利確認待ちの写真・動画はありません。</p>`
    : receipts.length
      ? `<div class="event-photo-grid">${receipts.map((receipt, index) => mediaCard(receipt, index)).join("")}</div>`
      : `<p class="muted" data-gallery-empty>保存した写真・動画はありません。観察ラリーから記録できます。</p>`;
  const audience = isOrganizer ? "主催者には権利確認待ちのメディアだけを表示します。" : "ここにはご自身の写真・動画だけが表示されます。";
  return `<section data-private-gallery-endpoint="/api/v1/observation-events/${escapeHtml(encodeURIComponent(session.sessionId))}/guest-media"><h1>${escapeHtml(session.title)} 写真・動画</h1><p class="muted">${escapeHtml(audience)} すべて非公開で、公開ページやみんなの振り返りには表示されません。</p><p class="muted" role="status" aria-live="polite" data-gallery-status></p>${content}<div class="actions"><a class="btn secondary" href="/events/${encodeURIComponent(session.sessionId)}/rally">観察ラリーへ戻る</a></div></section><script>
(() => {
  const root = document.querySelector('[data-private-gallery-endpoint]');
  const status = document.querySelector('[data-gallery-status]');
  const endpoint = root?.getAttribute('data-private-gallery-endpoint');
  document.querySelectorAll('[data-gallery-review]').forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault();
    const submitter = event.submitter;
    const decision = submitter instanceof HTMLButtonElement ? submitter.value : '';
    const note = form.querySelector('textarea');
    const id = form.getAttribute('data-media-id');
    if (!note || note.value.trim().length < 8 || !id || !endpoint || !['approved', 'rejected'].includes(decision)) { note?.focus(); return; }
    for (const button of form.querySelectorAll('button')) button.disabled = true;
    try {
      const response = await fetch(endpoint + '/' + encodeURIComponent(id) + '/review', {
        method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, note: note.value.trim() })
      });
      if (!response.ok) throw new Error('権利確認を保存できませんでした。再読み込みして状態を確認してください。');
      location.reload();
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : '権利確認を保存できませんでした。';
      for (const button of form.querySelectorAll('button')) button.disabled = false;
    }
  }));
})();
</script>`;
}

function observationEventRegistrationStartScript(sessionId: string): string {
  return `<script>
(() => {
  const endpoint = "/api/v1/observation-events/${encodeURIComponent(sessionId)}/analytics";
  document.querySelectorAll("[data-event-registration-start]").forEach((link) => {
    link.addEventListener("click", () => {
      void fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event_name: "event_registration_started",
          page: "rally",
          auth_state: "guest",
          network_state: navigator.onLine === false ? "offline" : "online"
        })
      }).catch(() => {});
    }, { once: true });
  });
})();
</script>`;
}

export function renderObservationEventRecapPage(recap: Record<string, unknown>): string {
  const session = asPlainObject(recap.session) ?? {};
  const permissions = asPlainObject(recap.permissions) ?? {};
  const canManage = permissions.canManage === true;
  const highlights = asPlainObject(recap.highlights) ?? {};
  const photos = Array.isArray(recap.photos)
    ? recap.photos.map(asPlainObject).filter((photo): photo is Record<string, unknown> => Boolean(photo))
    : [];
  const photoGallery = photos.length > 0
    ? `<div class="event-photo-grid">${photos.map((photo) => `<figure class="card event-photo-card" data-event-recap-photo><img src="${escapeHtml(photo.photoUrl ?? "")}" alt="観察写真" loading="lazy"><figcaption>観察写真</figcaption></figure>`).join("")}</div>`
    : `<p class="muted">写真は安全な表示用データの準備ができ次第、ここに表示されます。</p>`;
  const rehost = canManage
    ? `<article class="card"><h2>次回の観察会</h2><p class="muted">企画設定だけを再利用します。参加者・同意・review・公開状態は引き継ぎません。</p><div class="actions"><a class="btn" href="/community/events/new?template_from=${encodeURIComponent(String(session.sessionId ?? ""))}">もう一度開催する</a></div></article>`
    : "";
  return `<section><h1>${escapeHtml(session.title ?? "観察会")} の振り返り</h1><div class="grid"><article class="card"><h2>観察記録</h2><p>${escapeHtml(highlights.observationCount ?? 0)}</p></article><article class="card"><h2>参加した家族・グループ</h2><p>${escapeHtml(highlights.participantsCount ?? 0)}</p></article></div><h2>みんなの観察写真</h2>${photoGallery}<article class="card"><h2>次に調べるヒント</h2><p>写真の形や色、見つけた場所の環境を見比べてみましょう。名前がまだ分からない記録も、大切な発見です。</p></article>${rehost}</section>`;
}

function renderObservationEventReportPage(report: Awaited<ReturnType<typeof buildObservationEventOfficialReport>> & Record<string, unknown>): string {
  const stats = asPlainObject(report.stats) ?? {};
  const records = Array.isArray(report.speciesRecords) ? report.speciesRecords : [];
  return `<section><h1>${escapeHtml((report.session as { title?: string } | undefined)?.title ?? "観察会")} 公式出力</h1><div class="grid"><article class="card"><h2>公式記録</h2><p>${escapeHtml(stats.officialObservationCount ?? 0)}</p></article><article class="card"><h2>分類群</h2><p>${escapeHtml(stats.uniqueTaxaCount ?? 0)}</p></article></div><pre>${escapeHtml(JSON.stringify(records.slice(0, 20), null, 2))}</pre></section>`;
}

function renderObservationEventTimeline(events: PublicObservationEventLiveEvent[]): string {
  return `<div class="grid">${events.slice(0, 20).map((event) => {
    const detail = observationEventLiveParticipantDetail(event);
    return `<article class="card"><strong>${escapeHtml(event.label)}</strong>${detail ? `<p>${escapeHtml(detail)}</p>` : ""}<p class="muted"><time datetime="${escapeHtml(event.createdAt)}">${escapeHtml(event.createdAt)}</time></p></article>`;
  }).join("") || "<p class=\"muted\">まだ新しい動きはありません。</p>"}</div>`;
}

function renderObservationEventOperationalTimeline(events: Awaited<ReturnType<typeof listObservationEventLiveEvents>>): string {
  return `<div class="grid">${events.filter((event) => event.type !== "funnel_metric").slice(0, 20).map((event) => `<article class="card"><strong>${escapeHtml(event.type)}</strong><p class="muted">${escapeHtml(event.createdAt)}</p></article>`).join("") || "<p class=\"muted\">まだイベントはありません。</p>"}</div>`;
}

function observationEventEmptyState(title: string, description: string): string {
  return `<article class="card"><h1>${escapeHtml(title)}</h1><p class="muted">${escapeHtml(description)}</p><div class="actions"><a class="btn" href="/community/events">観察会一覧</a></div></article>`;
}
