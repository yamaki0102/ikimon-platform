import Fastify from "fastify";
import { getPool } from "./db.js";
import { getForwardedBasePath, withBasePath } from "./httpBasePath.js";
import { detectLangFromUrl, type SiteLang } from "./i18n.js";
import { getShortCopy } from "./content/index.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerLegacyAssetRoutes } from "./routes/legacyAssets.js";
import { registerMapApiRoutes } from "./routes/mapApi.js";
import { registerMarketingRoutes } from "./routes/marketing.js";
import { registerOpsRoutes } from "./routes/ops.js";
import { registerPlotMonitoringApiRoutes } from "./routes/plotMonitoringApi.js";
import { registerReadRoutes } from "./routes/read.js";
import { registerWriteRoutes } from "./routes/write.js";
import { registerUiKpiRoutes } from "./routes/uiKpi.js";
import { registerGuideApiRoutes } from "./routes/guideApi.js";
import { registerWalkApiRoutes } from "./routes/walkApi.js";
import { registerResearchApiRoutes } from "./routes/researchApi.js";
import { registerFieldscanApiRoutes } from "./routes/fieldscanApi.js";
import { registerSiteMapRoutes } from "./routes/siteMapRoutes.js";
import { registerSampleReportRoute } from "./routes/sampleReport.js";
import { registerStewardshipActionRoutes } from "./routes/stewardshipActions.js";
import {
  listPagesByLane,
  listPagesByVisibility,
  materializeSitePagePath,
  sitePageLabel,
  sitePageSummary,
  type RouteLane,
  type SitePageDefinition,
} from "./siteMap.js";
import { getSessionFromCookie } from "./services/authSession.js";
import { resolveViewer } from "./services/viewerIdentity.js";
import { getLandingSnapshot } from "./services/landingSnapshot.js";
import { buildObserverProfileHref } from "./services/observerProfileLink.js";
import { getStrings } from "./i18n/index.js";
import type { LandingSnapshot } from "./services/readModels.js";
import { COMMUNITY_METER_STYLES, renderCommunityMeter } from "./ui/communityMeter.js";
import { DEMO_LOGIN_BANNER_STYLES, renderDemoLoginBanner } from "./ui/demoLoginBanner.js";
import { FIELD_NOTE_MAIN_STYLES, renderFieldNoteMain } from "./ui/fieldNoteMain.js";
import { LANDING_TOP_STYLES, renderLandingTopSections } from "./ui/landingTop.js";
import { MAP_MINI_STYLES, mapMiniBootScript } from "./ui/mapMini.js";
import { MENTOR_STRIP_STYLES, renderMentorStrip } from "./ui/mentorStrip.js";
import { OBSERVATION_CARD_STYLES } from "./ui/observationCard.js";
import { OFFICIAL_NOTICE_CARD_STYLES } from "./ui/officialNoticeCard.js";
import { QUICK_NAV_STYLES, renderQuickNav } from "./ui/quickNav.js";
import { REVISIT_FLOW_STYLES, renderRevisitFlow } from "./ui/revisitFlow.js";
import { TODAY_HABIT_STYLES, renderTodayHabit } from "./ui/todayHabit.js";
import { escapeHtml, renderSiteDocument } from "./ui/siteShell.js";

type PreviewContext = {
  basePath: string;
  userId: string;
  visitId: string;
  occurrenceId: string;
  usesDemoFixture: boolean;
  stats: {
    observationCount: number;
    speciesCount: number;
    placeCount: number;
  };
};

type QASiteMapCopy = {
  title: string;
  hero: {
    eyebrow: string;
    heading: string;
    lead: string;
    actions: Array<{ href: string; label: string; variant?: "primary" | "secondary" }>;
  };
  sections: Array<{
    eyebrow: string;
    title: string;
    lead: string;
    cards: Array<{ href: string; label: string; note: string }>;
    note?: string;
  }>;
  checklist: {
    eyebrow: string;
    title: string;
    lead: string;
    items: Array<{ title: string; body: string }>;
  };
  footerNote: string;
};

function requestUrl(request: { url?: string; raw?: { url?: string } }): string {
  return String(request.raw?.url ?? request.url ?? "");
}

function canonicalHostRedirectUrl(request: { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }): string | null {
  const rawHost = Array.isArray(request.headers.host) ? request.headers.host[0] : request.headers.host;
  const host = typeof rawHost === "string" ? rawHost.split(",")[0]?.trim().toLowerCase().replace(/:\d+$/, "") : "";
  if (host !== "www.ikimon.life") {
    return null;
  }
  const url = requestUrl(request);
  const path = url.startsWith("/") ? url : `/${url}`;
  return `https://ikimon.life${path}`;
}

function requestCurrentPath(request: { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }): string {
  return withBasePath(getForwardedBasePath(request.headers), requestUrl(request));
}

function localizedNavHome(lang: SiteLang): string {
  return getShortCopy<string>(lang, "shared", "shell.nav.home");
}


function buildFlowLink(basePath: string, href: string, label: string, note: string): string {
  return `<a class="card" href="${escapeHtml(withBasePath(basePath, href))}">
    <div class="eyebrow">qa lane</div>
    <h2>${escapeHtml(label)}</h2>
    <p>${escapeHtml(note)}</p>
    <span>Open</span>
  </a>`;
}

const QA_LANE_ORDER: RouteLane[] = ["start", "learn", "trust", "group", "business", "research", "specialist", "ops"];

const QA_LANE_META: Record<RouteLane, { eyebrow: string; title: string; lead: string }> = {
  start: {
    eyebrow: "start",
    title: "Start / Core Journey",
    lead: "トップから記録、地図、探索、ノート、詳細へ進む主導線。",
  },
  learn: {
    eyebrow: "learn",
    title: "Learn / About",
    lead: "使い方、名前の調べ方、研究と信頼性を読むための公開ページ。",
  },
  trust: {
    eyebrow: "trust",
    title: "Trust / Legal / Contact",
    lead: "FAQ、公開範囲、規約、問い合わせまでの信頼形成ページ。",
  },
  group: {
    eyebrow: "group",
    title: "Community",
    lead: "一人の観察を主役にした、薄いつながりの入口。",
  },
  business: {
    eyebrow: "business",
    title: "Group / Business",
    lead: "学校・地域・団体利用の相談導線。",
  },
  research: {
    eyebrow: "research",
    title: "Research",
    lead: "研究利用の目的とデータ粒度を相談する入口。",
  },
  specialist: {
    eyebrow: "specialist",
    title: "Specialist Review",
    lead: "同定レビューと authority 周りの権限付き画面。",
  },
  ops: {
    eyebrow: "ops",
    title: "Ops / Release Gate",
    lead: "ステージング確認、health、ready を見る運用導線。",
  },
};

function materializeQaHref(page: SitePageDefinition, options: PreviewContext): string {
  if (page.path === "/profile/:userId" && options.userId) {
    return buildObserverProfileHref("", options.userId) ?? materializeSitePagePath(page, options);
  }
  if (page.path === "/observations/:id" && !options.visitId && !options.occurrenceId) {
    return "/explore";
  }
  return materializeSitePagePath(page, options);
}

function qaStatusNote(page: SitePageDefinition, lang: SiteLang): string {
  const note = sitePageSummary(page, lang);
  switch (page.auth) {
    case "session":
      return `${note} / 未セッション時は案内画面か 401 想定。`;
    case "specialist":
      return `${note} / 権限なしは案内つき 403 想定。`;
    case "admin":
      return `${note} / 管理権限なしは案内つき 403 想定。`;
    case "system":
      return `${note} / JSON health endpoint。`;
    default:
      return note;
  }
}

function buildLandingRootHtml(
  options: PreviewContext,
  lang: SiteLang,
  currentPath: string,
  snapshot: LandingSnapshot,
  isDemoView: boolean,
): string {
  const strings = getStrings(lang);
  const copy = strings.landing;
  const fieldLoop = strings.fieldLoop;
  const isLoggedIn = Boolean(snapshot.viewerUserId);

  const landingTop = renderLandingTopSections({
    basePath: options.basePath,
    lang,
    copy,
    fieldLoop,
    snapshot,
    isLoggedIn,
  });

  const extraStyles = [
    OBSERVATION_CARD_STYLES,
    MAP_MINI_STYLES,
    FIELD_NOTE_MAIN_STYLES,
    OFFICIAL_NOTICE_CARD_STYLES,
    QUICK_NAV_STYLES,
    TODAY_HABIT_STYLES,
    REVISIT_FLOW_STYLES,
    COMMUNITY_METER_STYLES,
    MENTOR_STRIP_STYLES,
    LANDING_TOP_STYLES,
    DEMO_LOGIN_BANNER_STYLES,
  ].join("\n");

  return renderSiteDocument({
    basePath: options.basePath,
    title: copy.title,
    activeNav: localizedNavHome(lang),
    lang,
    currentPath,
    extraStyles,
    shellClassName: "shell-bleed prototype-shell",
    body: `${landingTop.heroHtml}
${landingTop.dailyDashboardHtml}
${renderDemoLoginBanner(options.basePath, lang, { demoUserId: options.userId, isDemoView })}
${renderQuickNav(options.basePath, lang)}
${landingTop.linkBandHtml}
${landingTop.flowSectionHtml}
${landingTop.mapSectionHtml}
${renderTodayHabit(options.basePath, lang, snapshot)}
${renderFieldNoteMain(options.basePath, lang, snapshot)}
${renderRevisitFlow(options.basePath, lang, snapshot)}
${renderCommunityMeter(options.basePath, lang, snapshot)}
${landingTop.librarySectionHtml}
${landingTop.trustSectionHtml}
${landingTop.communitySectionHtml}
${renderMentorStrip(options.basePath, lang)}
${landingTop.finalCtaHtml}
${mapMiniBootScript()}`,
    footerNote: copy.footerNote,
  });
}

function buildQASiteMapHtml(options: PreviewContext, lang: SiteLang, currentPath: string): string {
  const recordPage = listPagesByVisibility("qa").find((page) => page.path === "/record");
  const recordHref = recordPage ? materializeQaHref(recordPage, options) : "/record";
  const sectionsHtml = QA_LANE_ORDER.map((lane) => {
    const pages = listPagesByLane(lane, "qa");
    if (pages.length === 0) {
      return "";
    }
    const meta = QA_LANE_META[lane];
    return `<section class="section">
      <div class="section-header">
        <div>
          <div class="eyebrow">${escapeHtml(meta.eyebrow)}</div>
          <h2>${escapeHtml(meta.title)}</h2>
          <p>${escapeHtml(meta.lead)}</p>
        </div>
      </div>
      <div class="grid">
        ${pages.map((page) => buildFlowLink(
          options.basePath,
          materializeQaHref(page, options),
          sitePageLabel(page, lang),
          qaStatusNote(page, lang),
        )).join("")}
      </div>
    </section>`;
  })
    .join("");
  const checklistHtml = `<section class="section">
      <div class="section-header">
        <div>
          <div class="eyebrow">checklist</div>
          <h2>人間確認で見るべきこと</h2>
          <p>トップ基準の画面品質にそろっているかを、導線・状態・文体の3つで見る。</p>
        </div>
      </div>
      <div class="list">
        <div class="row"><strong>Visual</strong><div class="meta">hero・card・button の崩れ、英日混在、CTA 密度、モバイル幅での詰まり。</div></div>
        <div class="row"><strong>Transition</strong><div class="meta">主要導線が 200 / redirect / 401 / 403 の想定どおりか。迷子導線や dead end がないか。</div></div>
        <div class="row"><strong>State</strong><div class="meta">未ログイン・権限不足・空状態が、雑なエラーではなく案内として読めるか。</div></div>
        <div class="row"><strong>Legacy drift</strong><div class="meta">旧 PHP URL が v2 の正規ページへ 308 redirect されるか。</div></div>
      </div>
    </section>`;

  return renderSiteDocument({
    basePath: options.basePath,
    title: "サイトマップ (運用向け) | ikimon",
    activeNav: localizedNavHome(lang),
    lang,
    currentPath,
    hero: {
      eyebrow: "staging qa",
      heading: "ページ遷移と確認面を、1枚で把握する。",
      lead: "Canonical sitemap から生成した人間確認用マップです。存在すべきページ、認証状態、旧 URL の寄せ先を同じ基準で確認できます。",
      actions: [
        { href: "/", label: "Preview top" },
        { href: recordHref, label: "Start at record", variant: "secondary" },
        { href: "/sitemap.xml", label: "XML sitemap", variant: "secondary" },
      ],
    },
    body: `${sectionsHtml}${checklistHtml}`,
    footerNote: "Canonical route registry drives this QA sitemap, XML sitemap, robots.txt, and shared navigation.",
  });
}

async function getPreviewContext(): Promise<PreviewContext> {
  const empty: PreviewContext = {
    basePath: "",
    userId: "",
    visitId: "",
    occurrenceId: "",
    usesDemoFixture: false,
    stats: { observationCount: 0, speciesCount: 0, placeCount: 0 },
  };
  let pool;
  try {
    pool = getPool();
  } catch {
    return empty;
  }
  const demoUserQuery = `
    select user_id
    from users
    where user_id like 'sample-cadence-%-user'
       or user_id like 'staging-session-smoke-%-user'
       or user_id like 'staging-write-smoke-%-user'
    order by created_at desc
    limit 1
  `;
  const demoOccurrenceQuery = `
    select occurrence_id, visit_id
    from occurrences
    where occurrence_id like 'occ:sample-cadence-%'
       or occurrence_id like 'occ:staging-session-smoke-%'
       or occurrence_id like 'occ:staging-write-smoke-%'
       or occurrence_id like 'occ:authority-%'
    order by created_at desc
    limit 1
  `;
  const latestUserQuery = `
    select user_id
    from users
    order by created_at desc
    limit 1
  `;
  const latestOccurrenceQuery = `
    select occurrence_id, visit_id
    from occurrences
    order by created_at desc
    limit 1
  `;
  const statsQuery = `
    select
      (select count(*) from occurrences)::int as observation_count,
      (select count(distinct scientific_name) from occurrences where scientific_name is not null and scientific_name <> '')::int as species_count,
      (select count(*) from places)::int as place_count
  `;

  let demoUser: { rows: Array<{ user_id: string }> } = { rows: [] };
  let demoOccurrence: { rows: Array<{ occurrence_id: string; visit_id: string }> } = { rows: [] };
  let latestUser: { rows: Array<{ user_id: string }> } = { rows: [] };
  let latestOccurrence: { rows: Array<{ occurrence_id: string; visit_id: string }> } = { rows: [] };
  let statsResult: { rows: Array<{ observation_count: number; species_count: number; place_count: number }> } = { rows: [] };
  try {
    [demoUser, demoOccurrence, latestUser, latestOccurrence, statsResult] = await Promise.all([
      pool.query<{ user_id: string }>(demoUserQuery),
      pool.query<{ occurrence_id: string; visit_id: string }>(demoOccurrenceQuery),
      pool.query<{ user_id: string }>(latestUserQuery),
      pool.query<{ occurrence_id: string; visit_id: string }>(latestOccurrenceQuery),
      pool.query<{ observation_count: number; species_count: number; place_count: number }>(statsQuery),
    ]);
  } catch {
    return empty;
  }

  const userId = demoUser.rows[0]?.user_id ?? latestUser.rows[0]?.user_id ?? "";
  const occurrenceRow = demoOccurrence.rows[0] ?? latestOccurrence.rows[0];
  const visitId = occurrenceRow?.visit_id ?? "";
  const occurrenceId = occurrenceRow?.occurrence_id ?? "";

  const row = statsResult.rows[0];
  return {
    basePath: "",
    userId,
    visitId,
    occurrenceId,
    usesDemoFixture: Boolean(demoUser.rows[0]?.user_id || demoOccurrence.rows[0]?.occurrence_id),
    stats: {
      observationCount: row?.observation_count ?? 0,
      speciesCount: row?.species_count ?? 0,
      placeCount: row?.place_count ?? 0,
    },
  };
}

const LEGACY_SERVICE_WORKER_CLEANUP_SCRIPT = `// ikimon.life v2 intentionally does not use the legacy PHP Service Worker.
// Returning this script from the old SW URLs lets browsers update the old
// registration, clear its shell caches, and then unregister it.
const LEGACY_CACHE_PREFIXES = ['ikimon-pwa-', 'ikimon-offline-', 'ikimon-static-'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    if ('caches' in self) {
      const keys = await caches.keys();
      await Promise.all(keys
        .filter((key) => LEGACY_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)))
        .map((key) => caches.delete(key)));
    }
    await self.clients.claim();
    await self.registration.unregister();
  })());
});

self.addEventListener('fetch', () => {
  // No respondWith: every request falls through to the network.
});
`;

export function buildApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: 25 * 1024 * 1024,
  });

  app.addHook("onRequest", async (request, reply) => {
    const redirectUrl = canonicalHostRedirectUrl(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } });
    if (redirectUrl) {
      reply.code(308).header("location", redirectUrl).send();
    }
  });

  // SSR HTML responses must never be heuristically cached by the browser.
  // Without an explicit Cache-Control header, browsers fall back to the
  // RFC 7234 "heuristic freshness" rule and serve stale HTML on a normal
  // reload — stranding users on a pre-deploy bundle until a hard reload.
  app.addHook("onSend", async (_request, reply, payload) => {
    const contentType = String(reply.getHeader("content-type") ?? "");
    if (contentType.startsWith("text/html") && !reply.getHeader("cache-control")) {
      reply.header("Cache-Control", "no-cache, no-store, must-revalidate");
    }
    return payload;
  });

  for (const path of ["/sw.php", "/sw.js"]) {
    app.get(path, async (_request, reply) => {
      reply
        .type("application/javascript; charset=utf-8")
        .header("Cache-Control", "no-cache, no-store, must-revalidate")
        .header("Service-Worker-Allowed", "/");
      return LEGACY_SERVICE_WORKER_CLEANUP_SCRIPT;
    });
  }

  app.get("/", async (request, reply) => {
    const accept = String(request.headers.accept ?? "");
    if (accept.includes("text/html")) {
      const context = await getPreviewContext();
      context.basePath = getForwardedBasePath(request.headers as Record<string, unknown>);
      const lang = detectLangFromUrl(requestUrl(request));
      const session = await getSessionFromCookie(request.headers.cookie);
      const { viewerUserId, queryOverrideHonored } = resolveViewer(request.query, session);
      const snapshot = await getLandingSnapshot(viewerUserId);
      reply.type("text/html; charset=utf-8");
      reply.header("Cache-Control", "no-cache, no-store, must-revalidate");
      return buildLandingRootHtml(
        context,
        lang,
        requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
        snapshot,
        queryOverrideHonored,
      );
    }

    return {
      service: "ikimon-platform-v2",
      status: "bootstrapping",
    };
  });

  app.get("/qa/site-map", async (request, reply) => {
    const context = await getPreviewContext();
    context.basePath = getForwardedBasePath(request.headers as Record<string, unknown>);
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return buildQASiteMapHtml(context, lang, requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }));
  });

  void registerHealthRoutes(app);
  void registerAuthRoutes(app);
  void registerSiteMapRoutes(app);
  void registerLegacyAssetRoutes(app);
  void registerMapApiRoutes(app);
  void registerMarketingRoutes(app);
  void registerSampleReportRoute(app);
  void registerStewardshipActionRoutes(app);
  void registerReadRoutes(app);
  void registerWriteRoutes(app);
  void registerUiKpiRoutes(app);
  void registerOpsRoutes(app);
  void registerPlotMonitoringApiRoutes(app);
  void registerGuideApiRoutes(app);
  void registerWalkApiRoutes(app);
  void registerResearchApiRoutes(app);
  void registerFieldscanApiRoutes(app);

  return app;
}
