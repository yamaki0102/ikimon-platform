import Fastify from "fastify";
import { getPool } from "./db.js";
import { getForwardedBasePath, withBasePath } from "./httpBasePath.js";
import { detectLangFromUrl, type SiteLang } from "./i18n.js";
import { getShortCopy } from "./content/index.js";
import { registerHealthRoutes } from "./routes/health.js";
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
  const copy = getShortCopy<QASiteMapCopy>(lang, "ops", "qaSiteMap");
  const recordHref = options.userId
    ? `/record?userId=${encodeURIComponent(options.userId)}`
    : "/record";
  const homeHref = options.userId
    ? `/home?userId=${encodeURIComponent(options.userId)}`
    : "/home";
  const profileHref = options.userId
    ? buildObserverProfileHref("", options.userId) ?? "/profile"
    : "/profile";
  const detailHref = options.occurrenceId
    ? `/observations/${encodeURIComponent(options.occurrenceId)}`
    : "/explore";
  const sectionHrefs: string[][] = [
    [recordHref, detailHref, homeHref, profileHref, "/explore"],
    copy.sections[1]?.cards.map((card) => card.href) ?? [],
    copy.sections[2]?.cards.map((card) => card.href) ?? [],
    copy.sections[3]?.cards.map((card) => card.href) ?? [],
  ];
  const heroActions = copy.hero.actions.map((action, index) => ({
    href: index === 1 ? recordHref : action.href,
    label: action.label,
    variant: action.variant,
  }));
  const sectionsHtml = copy.sections
    .map((section, sectionIndex) => `<section class="section">
      <div class="section-header">
        <div>
          <div class="eyebrow">${escapeHtml(section.eyebrow)}</div>
          <h2>${escapeHtml(section.title)}</h2>
          <p>${escapeHtml(section.lead)}</p>
        </div>
      </div>
      <div class="grid">
        ${section.cards.map((card, cardIndex) => buildFlowLink(options.basePath, sectionHrefs[sectionIndex]?.[cardIndex] ?? card.href, card.label, card.note)).join("")}
      </div>
      ${section.note ? `<div class="note">${escapeHtml(section.note)}</div>` : ""}
    </section>`)
    .join("");
  const checklistHtml = `<section class="section">
      <div class="section-header">
        <div>
          <div class="eyebrow">${escapeHtml(copy.checklist.eyebrow)}</div>
          <h2>${escapeHtml(copy.checklist.title)}</h2>
          <p>${escapeHtml(copy.checklist.lead)}</p>
        </div>
      </div>
      <div class="list">
        ${copy.checklist.items.map((item) => `<div class="row"><strong>${escapeHtml(item.title)}</strong><div class="meta">${escapeHtml(item.body)}</div></div>`).join("")}
      </div>
    </section>`;

  return renderSiteDocument({
    basePath: options.basePath,
    title: copy.title,
    activeNav: localizedNavHome(lang),
    lang,
    currentPath,
    hero: {
      eyebrow: copy.hero.eyebrow,
      heading: copy.hero.heading,
      lead: copy.hero.lead,
      actions: heroActions,
    },
    body: `${sectionsHtml}${checklistHtml}`,
    footerNote: copy.footerNote,
  });
}

async function getPreviewContext(): Promise<PreviewContext> {
  const empty: PreviewContext = {
    basePath: "",
    userId: "",
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
    select occurrence_id
    from occurrences
    where occurrence_id like 'occ:sample-cadence-%'
       or occurrence_id like 'occ:staging-session-smoke-%'
       or occurrence_id like 'occ:staging-write-smoke-%'
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
    select occurrence_id
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
  let demoOccurrence: { rows: Array<{ occurrence_id: string }> } = { rows: [] };
  let latestUser: { rows: Array<{ user_id: string }> } = { rows: [] };
  let latestOccurrence: { rows: Array<{ occurrence_id: string }> } = { rows: [] };
  let statsResult: { rows: Array<{ observation_count: number; species_count: number; place_count: number }> } = { rows: [] };
  try {
    [demoUser, demoOccurrence, latestUser, latestOccurrence, statsResult] = await Promise.all([
      pool.query<{ user_id: string }>(demoUserQuery),
      pool.query<{ occurrence_id: string }>(demoOccurrenceQuery),
      pool.query<{ user_id: string }>(latestUserQuery),
      pool.query<{ occurrence_id: string }>(latestOccurrenceQuery),
      pool.query<{ observation_count: number; species_count: number; place_count: number }>(statsQuery),
    ]);
  } catch {
    return empty;
  }

  const userId = demoUser.rows[0]?.user_id ?? latestUser.rows[0]?.user_id ?? "";
  const occurrenceId = demoOccurrence.rows[0]?.occurrence_id ?? latestOccurrence.rows[0]?.occurrence_id ?? "";

  const row = statsResult.rows[0];
  return {
    basePath: "",
    userId,
    occurrenceId,
    usesDemoFixture: Boolean(demoUser.rows[0]?.user_id || demoOccurrence.rows[0]?.occurrence_id),
    stats: {
      observationCount: row?.observation_count ?? 0,
      speciesCount: row?.species_count ?? 0,
      placeCount: row?.place_count ?? 0,
    },
  };
}

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

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
  void registerLegacyAssetRoutes(app);
  void registerMapApiRoutes(app);
  void registerMarketingRoutes(app);
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
