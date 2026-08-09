import Fastify from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { loadConfig } from "./config.js";
import { getPool } from "./db.js";
import { registerSnapshotInvalidator } from "./services/snapshotInvalidation.js";
import { getForwardedBasePath, withBasePath } from "./httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, rewriteLangPrefixToQuery, type SiteLang } from "./i18n.js";
import { getShortCopy } from "./content/index.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerLegacyAssetRoutes } from "./routes/legacyAssets.js";
import { registerPwaRoutes } from "./routes/pwa.js";
import { registerLlmoRoutes } from "./routes/llmo.js";
import { registerInvasiveSpeciesRoutes } from "./routes/invasiveSpecies.js";
import { registerMapApiRoutes } from "./routes/mapApi.js";
import { registerMarketingRoutes } from "./routes/marketing.js";
import { registerOpsRoutes } from "./routes/ops.js";
import { registerPlotMonitoringApiRoutes } from "./routes/plotMonitoringApi.js";
import { registerReadRoutes } from "./routes/read.js";
import { registerWriteRoutes } from "./routes/write.js";
import { registerUiKpiRoutes } from "./routes/uiKpi.js";
import { registerGuideApiRoutes } from "./routes/guideApi.js";
import { registerGuideRecordsDebugRoutes } from "./routes/guideRecordsDebug.js";
import { registerWalkApiRoutes } from "./routes/walkApi.js";
import { registerResearchApiRoutes } from "./routes/researchApi.js";
import { registerFieldscanApiRoutes } from "./routes/fieldscanApi.js";
import { registerMobileFieldSessionsApiRoutes } from "./routes/mobileFieldSessionsApi.js";
import { registerPassiveAudioIngestApiRoutes } from "./routes/passiveAudioIngestApi.js";
import { registerAdminAudioApiRoutes } from "./routes/adminAudioApi.js";
import { registerAdminSoundReviewPagesRoutes } from "./routes/adminSoundReviewPages.js";
import { registerAdminDataHealthRoutes } from "./routes/adminDataHealth.js";
import { registerAdminMonitoringWorkspaceRoutes } from "./routes/adminMonitoringWorkspace.js";
import { registerAdminLenriAreaIntelligenceRoutes } from "./routes/adminLenriAreaIntelligence.js";
import { registerAdminSiteEvidenceRoutes } from "./routes/adminSiteEvidence.js";
import { registerAdminRegionalKnowledgeRoutes } from "./routes/adminRegionalKnowledge.js";
import { registerAdminGuidePromptImprovementRoutes } from "./routes/adminGuidePromptImprovements.js";
import { registerAdminGuideProgramRoutes } from "./routes/adminGuidePrograms.js";
import { registerKnowledgeNavigationApiRoutes } from "./routes/knowledgeNavigationApi.js";
import { registerCuratorProposalsRoutes } from "./routes/curatorProposalsApi.js";
import { registerObservationEventApiRoutes } from "./routes/observationEventApi.js";
import { registerMeSubscriptionsApiRoutes } from "./routes/meSubscriptionsApi.js";
import { registerObservationEventRecapRoutes } from "./routes/observationEventRecapApi.js";
import { registerObservationEventPagesRoutes } from "./routes/observationEventPages.js";
import { registerObservationFieldsApiRoutes } from "./routes/observationFieldsApi.js";
import { registerObservationPackageApiRoutes } from "./routes/observationPackageApi.js";
import { registerPlaceManagementPolicyApiRoutes } from "./routes/placeManagementPolicyApi.js";
import { registerPlaceMemoryApiRoutes } from "./routes/placeMemoryApi.js";
import { registerReferenceRoutes } from "./routes/references.js";
import { startQuestScheduler } from "./services/observationEventQuestEngine.js";
import { startPublicMapSnapshotScheduler } from "./services/publicMapSnapshotScheduler.js";
import { registerSiteMapRoutes } from "./routes/siteMapRoutes.js";
import { registerSampleReportRoute } from "./routes/sampleReport.js";
import { registerStewardshipActionRoutes } from "./routes/stewardshipActions.js";
import { registerMonitoringBusinessRoutes } from "./routes/monitoringBusiness.js";
import { registerMonitoringWorkspaceApiRoutes } from "./routes/monitoringWorkspaceApi.js";
import { createCspNonce, runWithCspNonce } from "./services/cspNonce.js";
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
import { DEMO_LOGIN_BANNER_STYLES, renderDemoLoginBanner } from "./ui/demoLoginBanner.js";
import { LANDING_TOP_STYLES, renderLandingTopSections } from "./ui/landingTop.js";
import { MAP_EXPLORER_STYLES, mapExplorerBootScript, renderMapExplorer } from "./ui/mapExplorer.js";
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

const LANDING_SNAPSHOT_CACHE_TTL_MS = 300_000;
const LANDING_SNAPSHOT_TIMEOUT_MS = 1_800;
const LANDING_PUBLIC_CACHE_KEY = "__public__";
const landingSnapshotCache = new Map<string, { expiresAt: number; snapshot: LandingSnapshot }>();
registerSnapshotInvalidator(() => landingSnapshotCache.clear());
const landingSnapshotInflight = new Map<string, Promise<LandingSnapshot>>();

function requestUrl(request: { url?: string; raw?: { url?: string; originalUrl?: string } }): string {
  return String(request.raw?.originalUrl ?? request.raw?.url ?? request.url ?? "");
}

function emptyLandingSnapshot(userId: string | null): LandingSnapshot {
  return {
    viewerUserId: userId,
    stats: { observationCount: 0, speciesCount: 0, placeCount: 0 },
    feed: [],
    myFeed: [],
    topShelves: [],
    guideOutcomes: [],
    guideOutcomeSummaries: [],
    overflowSummaries: [],
    myPlaces: [],
    nearbyFields: [],
    nearbyEvents: [],
    mapPreviewCells: [],
    ambient: [],
    habit: null,
    dailyDashboard: null,
    regionalStory: null,
  };
}

function emptyPreviewContext(basePath: string = ""): PreviewContext {
  return {
    basePath,
    userId: "",
    visitId: "",
    occurrenceId: "",
    usesDemoFixture: false,
    stats: { observationCount: 0, speciesCount: 0, placeCount: 0 },
  };
}

function timeoutAfter(ms: number): Promise<null> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(null), ms);
  });
}

function hasLandingVisibleData(snapshot: LandingSnapshot): boolean {
  return snapshot.feed.length > 0 ||
    snapshot.myFeed.length > 0 ||
    (snapshot.topShelves ?? []).some((shelf) => shelf.items.length > 0) ||
    snapshot.nearbyFields.length > 0 ||
    snapshot.mapPreviewCells.length > 0 ||
    snapshot.ambient.length > 0;
}

function hasLandingContentWallData(snapshot: LandingSnapshot, userId: string | null): boolean {
  return snapshot.myFeed.length > 0 ||
    snapshot.feed.some((obs) => !userId || obs.observerUserId !== userId);
}

function publicSnapshotForSignedInFallback(snapshot: LandingSnapshot, userId: string): LandingSnapshot {
  return {
    ...snapshot,
    viewerUserId: userId,
    myFeed: [],
    guideOutcomes: [],
    guideOutcomeSummaries: [],
    myPlaces: [],
    habit: null,
  };
}

function ensureLandingSnapshotInflight(
  cacheKey: string,
  userId: string | null,
  cached: { expiresAt: number; snapshot: LandingSnapshot } | undefined,
): Promise<LandingSnapshot> {
  let inflight = landingSnapshotInflight.get(cacheKey);
  if (!inflight) {
    inflight = getLandingSnapshot(userId)
      .then((snapshot) => {
        landingSnapshotCache.set(cacheKey, {
          expiresAt: Date.now() + LANDING_SNAPSHOT_CACHE_TTL_MS,
          snapshot,
        });
        return snapshot;
      })
      .catch(() => cached?.snapshot ?? emptyLandingSnapshot(userId))
      .finally(() => {
        landingSnapshotInflight.delete(cacheKey);
      });
    landingSnapshotInflight.set(cacheKey, inflight);
  }
  return inflight;
}

async function getPublicLandingFallbackForSignedIn(userId: string): Promise<LandingSnapshot | null> {
  const now = Date.now();
  const cached = landingSnapshotCache.get(LANDING_PUBLIC_CACHE_KEY);
  if (cached && cached.expiresAt > now && hasLandingContentWallData(cached.snapshot, null)) {
    return publicSnapshotForSignedInFallback(cached.snapshot, userId);
  }

  const inflight = ensureLandingSnapshotInflight(LANDING_PUBLIC_CACHE_KEY, null, cached);
  const snapshot = await Promise.race([inflight, timeoutAfter(LANDING_SNAPSHOT_TIMEOUT_MS)]);
  if (snapshot && hasLandingContentWallData(snapshot, null)) {
    return publicSnapshotForSignedInFallback(snapshot, userId);
  }
  if (cached && hasLandingContentWallData(cached.snapshot, null)) {
    return publicSnapshotForSignedInFallback(cached.snapshot, userId);
  }
  return null;
}

async function getLandingSnapshotForRoot(userId: string | null): Promise<LandingSnapshot> {
  const cacheKey = userId ?? LANDING_PUBLIC_CACHE_KEY;
  const now = Date.now();
  const cached = landingSnapshotCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    if (userId && !hasLandingContentWallData(cached.snapshot, userId)) {
      return await getPublicLandingFallbackForSignedIn(userId) ?? cached.snapshot;
    }
    return cached.snapshot;
  }

  const inflight = ensureLandingSnapshotInflight(cacheKey, userId, cached);

  if (cached) {
    if (userId && !hasLandingContentWallData(cached.snapshot, userId)) {
      return await getPublicLandingFallbackForSignedIn(userId) ?? cached.snapshot;
    }
    return cached.snapshot;
  }

  const snapshot = await Promise.race([inflight, timeoutAfter(LANDING_SNAPSHOT_TIMEOUT_MS)]);
  if (snapshot && (!userId || hasLandingContentWallData(snapshot, userId))) {
    return snapshot;
  }
  if (userId) {
    return await getPublicLandingFallbackForSignedIn(userId) ?? emptyLandingSnapshot(userId);
  }
  return snapshot ?? emptyLandingSnapshot(userId);
}

function canonicalHostRedirectUrl(request: { headers: Record<string, unknown>; url?: string; raw?: { url?: string; originalUrl?: string } }): string | null {
  const rawHost = Array.isArray(request.headers.host) ? request.headers.host[0] : request.headers.host;
  const host = typeof rawHost === "string" ? rawHost.split(",")[0]?.trim().toLowerCase().replace(/:\d+$/, "") : "";
  if (host !== "www.ikimon.life") {
    return null;
  }
  const url = requestUrl(request);
  const path = url.startsWith("/") ? url : `/${url}`;
  return `https://ikimon.life${path}`;
}

function setHeaderIfMissing(reply: { getHeader(name: string): unknown; header(name: string, value: string): unknown }, name: string, value: string): void {
  if (!reply.getHeader(name)) {
    reply.header(name, value);
  }
}

function applySecurityHeaders(
  reply: { getHeader(name: string): unknown; header(name: string, value: string): unknown },
  isProduction: boolean,
  cspNonce: string,
): void {
  const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${cspNonce}' https://cdn.jsdelivr.net https://unpkg.com https://www.googletagmanager.com https://www.clarity.ms https://scripts.clarity.ms`,
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "font-src 'self' data: https://cdn.jsdelivr.net https://unpkg.com https://demotiles.maplibre.org https://tiles.openfreemap.org",
    "connect-src 'self' https://zukan.earth https://ikimon.life https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.google.com https://www.googletagmanager.com https://www.clarity.ms https://*.clarity.ms https://tile.openstreetmap.org https://nominatim.openstreetmap.org https://overpass-api.de https://demotiles.maplibre.org https://tiles.openfreemap.org https://cyberjapandata.gsi.go.jp https://server.arcgisonline.com https://upload.videodelivery.net https://upload.cloudflarestream.com",
    "frame-src 'self' https://iframe.videodelivery.net",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  setHeaderIfMissing(reply, "X-Content-Type-Options", "nosniff");
  setHeaderIfMissing(reply, "X-Frame-Options", "SAMEORIGIN");
  setHeaderIfMissing(reply, "Referrer-Policy", "strict-origin-when-cross-origin");
  setHeaderIfMissing(reply, "X-Permitted-Cross-Domain-Policies", "none");
  setHeaderIfMissing(reply, "Origin-Agent-Cluster", "?1");
  setHeaderIfMissing(
    reply,
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), serial=(), bluetooth=(), browsing-topics=()",
  );
  setHeaderIfMissing(reply, "Content-Security-Policy", contentSecurityPolicy);
  if (isProduction) {
    setHeaderIfMissing(reply, "Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

function requestCurrentPath(request: { headers: Record<string, unknown>; url?: string; raw?: { url?: string; originalUrl?: string } }): string {
  return withBasePath(getForwardedBasePath(request.headers), requestUrl(request));
}

function requestHost(request: { headers: Record<string, unknown> }): string {
  const rawHost = Array.isArray(request.headers.host) ? request.headers.host[0] : request.headers.host;
  return typeof rawHost === "string" ? (rawHost.split(",", 1)[0] ?? "").trim().toLowerCase().replace(/:\d+$/, "") : "";
}

function isPublicProductionHost(request: { headers: Record<string, unknown> }): boolean {
  const host = requestHost(request);
  return host === "zukan.earth" || host === "ikimon.life" || host === "www.ikimon.life";
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
    lead: "トップから記録、地図、統合された記録ワークベンチ、詳細へ進む主導線。",
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
    return "/records";
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
    showLocalFollowups: false,
  });

  const extraStyles = [
    LANDING_TOP_STYLES,
    DEMO_LOGIN_BANNER_STYLES,
  ].join("\n");

  return renderSiteDocument({
    basePath: options.basePath,
    title: copy.title,
    description: copy.home.guest.heroLead,
    activeNav: localizedNavHome(lang),
    lang,
    currentPath,
    extraStyles,
    shellClassName: "shell-bleed prototype-shell",
    minimalChrome: false,
    homeChrome: isLoggedIn ? "member" : "guest",
    hideGlobalRecordLauncher: false,
    body: `${landingTop.heroHtml}
${landingTop.dailyDashboardHtml}
${renderDemoLoginBanner(options.basePath, lang, { demoUserId: options.userId, isDemoView })}`,
    footerNote: copy.footerNote,
  });
}

function buildMapHomeHtml(
  options: Pick<PreviewContext, "basePath">,
  lang: SiteLang,
  currentPath: string,
): string {
  const mapPageCopy = getShortCopy<{ title: string; footerNote: string }>(lang, "public", "read.map");
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let year = currentYear; year >= currentYear - 10; year -= 1) {
    years.push(year);
  }

  return renderSiteDocument({
    basePath: options.basePath,
    title: mapPageCopy.title,
    description: "近くの記録を、場所から見返す地図。",
    activeNav: localizedNavHome(lang),
    lang,
    currentPath,
    extraStyles: MAP_EXPLORER_STYLES,
    shellClassName: "shell-bleed shell-map",
    hideFooter: true,
    body: `${renderMapExplorer({ basePath: options.basePath, lang, years })}
${mapExplorerBootScript({ basePath: options.basePath, lang })}`,
    footerNote: mapPageCopy.footerNote,
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
    title: "サイトマップ (運用向け) | ZUKAN",
    description: "Canonical route registry から生成した、ステージング確認と公開面QAのためのサイトマップです。",
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
const LEGACY_CACHE_PREFIXES = ['ikimon-pwa-', 'ikimon-offline-', 'ikimon-static-', 'ikimon-app-'];

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
  const config = loadConfig();
  const app = Fastify({
    logger: true,
    bodyLimit: 40 * 1024 * 1024,
    rewriteUrl: (request) => rewriteLangPrefixToQuery(request.url ?? "/"),
  });

  void app.register(helmet, {
    contentSecurityPolicy: false,
    hsts: false,
    frameguard: false,
    noSniff: false,
    originAgentCluster: false,
    permittedCrossDomainPolicies: false,
    referrerPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  });

  app.addHook("onRequest", (request, reply, done) => {
    const cspNonce = createCspNonce();
    runWithCspNonce(cspNonce, () => {
      applySecurityHeaders(reply, config.nodeEnv === "production", cspNonce);
      const redirectUrl = canonicalHostRedirectUrl(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } });
      if (redirectUrl) {
        reply.code(308).header("location", redirectUrl).send();
        return;
      }
      done();
    });
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

  app.get<{ Params: { "*": string } }>("/__preview-media/*", async (request, reply) => {
    const enabled = !isPublicProductionHost(request as unknown as { headers: Record<string, unknown> }) &&
      (process.env.IKIMON_PUBLIC_MEDIA_ORIGIN || process.env.ALLOW_QUERY_USER_ID === "1" || process.env.PORT === "3203");
    const origin = (process.env.IKIMON_PUBLIC_MEDIA_ORIGIN || "https://ikimon.life").trim().replace(/\/+$/, "");
    const rel = request.params["*"] ?? "";
    if (!enabled || !rel || rel.includes("..") || !/^(?:thumb|uploads|data\/uploads)\//.test(rel)) {
      reply.code(404).type("text/plain").send("not found");
      return;
    }
    const upstream = await fetch(`${origin}/${rel}`);
    if (!upstream.ok) {
      reply.code(upstream.status).type("text/plain").send("not found");
      return;
    }
    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    if (!contentType.startsWith("image/")) {
      reply.code(404).type("text/plain").send("not found");
      return;
    }
    const bytes = Buffer.from(await upstream.arrayBuffer());
    reply
      .type(contentType)
      .header("Cache-Control", "public, max-age=300")
      .send(bytes);
  });

  app.get("/", async (request, reply) => {
    const basePath = getForwardedBasePath(request.headers as Record<string, unknown>);
    const lang = detectLangFromUrl(requestUrl(request));
    const session = await getSessionFromCookie(request.headers.cookie);
    const { viewerUserId } = resolveViewer(request.query, session);
    const context = emptyPreviewContext(basePath);
    context.basePath = basePath;
    reply.type("text/html; charset=utf-8");
    if (viewerUserId) {
      reply.header("Cache-Control", "private, no-cache, must-revalidate");
      reply.header("Vary", "Cookie");
    } else {
      reply.header("Cache-Control", "public, max-age=30, stale-while-revalidate=30");
    }
    const snapshot = await getLandingSnapshotForRoot(viewerUserId);
    return buildLandingRootHtml(
      context,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      snapshot,
      false,
    );
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
  void registerPwaRoutes(app);
  void registerLlmoRoutes(app);
  void registerSiteMapRoutes(app);
  void registerLegacyAssetRoutes(app);
  void registerInvasiveSpeciesRoutes(app);
  void registerMapApiRoutes(app);
  void registerMarketingRoutes(app);
  void registerSampleReportRoute(app);
  void registerMonitoringBusinessRoutes(app);
  void registerMonitoringWorkspaceApiRoutes(app);
  void registerStewardshipActionRoutes(app);
  void registerReferenceRoutes(app);
  void registerReadRoutes(app);
  void app.register(async (writeScope) => {
    await writeScope.register(rateLimit, {
      global: false,
    });
    await registerWriteRoutes(writeScope);
    await registerPlaceMemoryApiRoutes(writeScope);
  });
  void registerUiKpiRoutes(app);
  void registerOpsRoutes(app);
  void registerPlotMonitoringApiRoutes(app);
  void registerGuideApiRoutes(app);
  void registerGuideRecordsDebugRoutes(app);
  void registerWalkApiRoutes(app);
  void registerResearchApiRoutes(app);
  void registerFieldscanApiRoutes(app);
  void registerMobileFieldSessionsApiRoutes(app);
  void registerPassiveAudioIngestApiRoutes(app);
  void registerAdminAudioApiRoutes(app);
  void registerAdminSoundReviewPagesRoutes(app);
  void registerAdminDataHealthRoutes(app);
  void registerAdminMonitoringWorkspaceRoutes(app);
  void registerAdminLenriAreaIntelligenceRoutes(app);
  void registerAdminSiteEvidenceRoutes(app);
  void registerAdminRegionalKnowledgeRoutes(app);
  void registerAdminGuidePromptImprovementRoutes(app);
  void registerAdminGuideProgramRoutes(app);
  void registerKnowledgeNavigationApiRoutes(app);
  void registerCuratorProposalsRoutes(app);
  void registerObservationEventApiRoutes(app);
  void registerObservationEventRecapRoutes(app);
  void registerObservationEventPagesRoutes(app);
  void registerObservationFieldsApiRoutes(app);
  void registerObservationPackageApiRoutes(app);
  void registerPlaceManagementPolicyApiRoutes(app);
  void registerMeSubscriptionsApiRoutes(app);

  app.setNotFoundHandler(async (request, reply) => {
    const accept = String(request.headers.accept ?? "");
    const rawUrl = requestUrl(request);
    const wantsHtml = accept.includes("text/html");
    if (!wantsHtml || rawUrl.startsWith("/api/")) {
      reply.code(404);
      return { ok: false, error: "not_found" };
    }
    const basePath = getForwardedBasePath(request.headers as Record<string, unknown>);
    const lang = detectLangFromUrl(rawUrl);
    const title = lang === "en"
      ? "Page not found"
      : lang === "es"
        ? "Pagina no encontrada"
        : lang === "pt-BR"
          ? "Pagina nao encontrada"
          : "ページが見つかりません";
    const lead = lang === "en"
      ? "The page may have moved. Use search or return to your home."
      : lang === "es"
        ? "La pagina pudo haberse movido. Usa la busqueda o vuelve al inicio."
        : lang === "pt-BR"
          ? "A pagina pode ter mudado. Use a busca ou volte ao inicio."
          : "ページが移動した可能性があります。検索するか、ホームへ戻ってください。";
    reply.code(404).type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title,
      lang,
      currentPath: requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      noindex: true,
      shellClassName: "shell-layout-narrow",
      body: `<section class="section"><div class="section-header"><div><div class="eyebrow">404</div><h1>${escapeHtml(title)}</h1></div><p>${escapeHtml(lead)}</p></div><div class="section-actions"><a class="btn btn-solid" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/home"), lang))}">${escapeHtml(lang === "ja" ? "ホームへ戻る" : "Home")}</a><a class="btn btn-ghost" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/records"), lang))}">${escapeHtml(lang === "ja" ? "記録を探す" : "Search records")}</a></div></section>`,
    });
  });

  // 5 分周期の AI Quest cron(activity ありのセッションのみ)
  startQuestScheduler();
  startPublicMapSnapshotScheduler();

  return app;
}
