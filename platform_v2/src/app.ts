import Fastify from "fastify";
import helmet from "@fastify/helmet";
import { getPool } from "./db.js";
import { getForwardedBasePath, withBasePath } from "./httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "./i18n.js";
import { getShortCopy } from "./content/index.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerLegacyAssetRoutes } from "./routes/legacyAssets.js";
import { registerMapApiRoutes } from "./routes/mapApi.js";
import { registerMarketingRoutes } from "./routes/marketing.js";
import { registerOpsRoutes } from "./routes/ops.js";
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
import { formatStatLabel, getStrings } from "./i18n/index.js";
import type { LandingSnapshot } from "./services/readModels.js";
import { COMMUNITY_METER_STYLES, renderCommunityMeter } from "./ui/communityMeter.js";
import { DEMO_LOGIN_BANNER_STYLES, renderDemoLoginBanner } from "./ui/demoLoginBanner.js";
import { FIELD_NOTE_MAIN_STYLES, renderFieldNoteMain } from "./ui/fieldNoteMain.js";
import { MAP_MINI_STYLES, mapMiniBootScript, renderMapMini, toMapMiniCells } from "./ui/mapMini.js";
import { MENTOR_STRIP_STYLES, renderMentorStrip } from "./ui/mentorStrip.js";
import { OBSERVATION_CARD_STYLES } from "./ui/observationCard.js";
import { OFFICIAL_NOTICE_CARD_STYLES } from "./ui/officialNoticeCard.js";
import { QUICK_NAV_STYLES, renderQuickNav } from "./ui/quickNav.js";
import { REVISIT_FLOW_STYLES, renderRevisitFlow } from "./ui/revisitFlow.js";
import { TODAY_HABIT_STYLES, renderTodayHabit } from "./ui/todayHabit.js";
import { TOOL_CARD_STYLES, renderToolCard } from "./ui/toolCard.js";
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
  cardEyebrow: string;
  openLabel: string;
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


function buildFlowLink(basePath: string, href: string, label: string, note: string, cardEyebrow: string, openLabel: string): string {
  return `<a class="card" href="${escapeHtml(withBasePath(basePath, href))}">
    <div class="eyebrow">${escapeHtml(cardEyebrow)}</div>
    <h2>${escapeHtml(label)}</h2>
    <p>${escapeHtml(note)}</p>
    <span>${escapeHtml(openLabel)}</span>
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

  const stats = snapshot.stats;
  const statLine = stats.observationCount > 0
    ? formatStatLabel(lang, stats.observationCount, stats.speciesCount)
    : "";

  const mapHref = appendLangToHref(withBasePath(options.basePath, "/map"), lang);
  const mapCells = toMapMiniCells(snapshot.mapPreviewCells, mapHref);

  const toolCardsHtml = `<div class="tool-card-grid">
    ${renderToolCard(options.basePath, lang, {
      icon: "🔍",
      eyebrow: copy.tools.lens.eyebrow,
      title: copy.tools.lens.title,
      body: copy.tools.lens.body,
      ctaLabel: copy.tools.lens.cta,
      href: "/lens",
      badge: copy.tools.lens.badge,
    })}
    ${renderToolCard(options.basePath, lang, {
      icon: "📡",
      eyebrow: copy.tools.scan.eyebrow,
      title: copy.tools.scan.title,
      body: copy.tools.scan.body,
      ctaLabel: copy.tools.scan.cta,
      href: "/scan",
      badge: copy.tools.scan.badge,
    })}
  </div>`;

  const mapSectionHtml = `<section class="section landing-map" aria-labelledby="landing-map-heading">
    <div class="section-header">
      <div>
        <div class="eyebrow">${escapeHtml(copy.mapSectionEyebrow)}</div>
        <h2 id="landing-map-heading">${escapeHtml(copy.mapSectionTitle)}</h2>
        <p>${escapeHtml(copy.mapSectionLead)}</p>
      </div>
    </div>
    ${renderMapMini({
      cells: mapCells,
      mapHref,
      mapCtaLabel: copy.mapCta,
      emptyLabel: copy.mapEmpty,
      height: 280,
    })}
  </section>`;

  const toolsSectionHtml = `<section class="section landing-tools" aria-labelledby="landing-tools-heading">
    <div class="section-header">
      <div>
        <div class="eyebrow">${escapeHtml(copy.toolSectionEyebrow)}</div>
        <h2 id="landing-tools-heading">${escapeHtml(copy.toolSectionTitle)}</h2>
        <p>${escapeHtml(copy.toolSectionLead)}</p>
      </div>
    </div>
    ${toolCardsHtml}
  </section>`;

  const fieldLoopSectionHtml = `<section class="section field-loop-section" aria-labelledby="field-loop-heading">
    <div class="field-loop-copy">
      <div class="eyebrow">${escapeHtml(fieldLoop.eyebrow)}</div>
      <h2 id="field-loop-heading">${escapeHtml(fieldLoop.title)}</h2>
      <p>${escapeHtml(fieldLoop.lead)}</p>
      <div class="actions" style="margin-top:20px">
        <a class="btn btn-solid" href="${escapeHtml(appendLangToHref(withBasePath(options.basePath, "/learn/field-loop"), lang))}">${escapeHtml(fieldLoop.primaryCta)}</a>
      </div>
    </div>
  </section>`;

  const bizSectionHtml = `<section class="section">
    <div class="grid">
      <div class="card">
        <div class="eyebrow">${escapeHtml(copy.bizEyebrow)}</div>
        <h2>${escapeHtml(copy.bizTitle)}</h2>
        <p>${escapeHtml(copy.bizBody)}</p>
        <div class="actions" style="margin-top:14px">
          <a class="btn btn-ghost" href="${escapeHtml(appendLangToHref(withBasePath(options.basePath, "/for-business"), lang))}">${escapeHtml(copy.bizCta)}</a>
        </div>
      </div>
    </div>
  </section>`;

  const extraStyles = [
    OBSERVATION_CARD_STYLES,
    TOOL_CARD_STYLES,
    MAP_MINI_STYLES,
    FIELD_NOTE_MAIN_STYLES,
    OFFICIAL_NOTICE_CARD_STYLES,
    QUICK_NAV_STYLES,
    TODAY_HABIT_STYLES,
    REVISIT_FLOW_STYLES,
    COMMUNITY_METER_STYLES,
    MENTOR_STRIP_STYLES,
    DEMO_LOGIN_BANNER_STYLES,
    `
  .quick-nav-inner { grid-template-columns: repeat(4, minmax(0, 1fr)); max-width: none; }
  .field-loop-section { position: relative; overflow: hidden; }
  .field-loop-shell { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(280px, .95fr); gap: 18px; align-items: stretch; }
  .field-loop-copy, .field-loop-principles { border-radius: 28px; padding: 26px; }
  .field-loop-copy { background: radial-gradient(circle at top left, rgba(16,185,129,.18), transparent 44%), linear-gradient(180deg, #f8fffc 0%, #effaf4 100%); border: 1px solid rgba(16,185,129,.16); }
  .field-loop-copy h2 { margin-top: 8px; font-size: clamp(26px, 3vw, 38px); line-height: 1.18; letter-spacing: -.03em; }
  .field-loop-copy p { max-width: 58ch; }
  .field-loop-boundary-strip { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
  .field-loop-boundary-chip { display: inline-flex; align-items: center; min-height: 36px; padding: 8px 12px; border-radius: 999px; background: rgba(15,23,42,.06); color: #0f172a; font-size: 12px; font-weight: 800; letter-spacing: -.01em; }
  .field-loop-principles { background: linear-gradient(180deg, #0f172a 0%, #111827 100%); color: rgba(255,255,255,.92); border: 1px solid rgba(255,255,255,.08); }
  .field-loop-principles .eyebrow { color: rgba(167,243,208,.92); }
  .field-loop-principle-list { margin: 12px 0 0; padding-left: 18px; display: grid; gap: 12px; }
  .field-loop-principle-list li { margin: 0; }
  .field-loop-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-top: 14px; }
  .field-loop-card { min-height: 100%; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); border: 1px solid rgba(15,23,42,.08); }
  .field-loop-card h3 { margin: 0 0 10px; font-size: 17px; line-height: 1.35; letter-spacing: -.02em; }
  .tool-card-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; margin-top: 16px; max-width: none; }
  .landing-tools .section-header,
  .landing-map .section-header { flex-direction: row; justify-content: space-between; align-items: flex-end; gap: 16px; }
  .fn-main-head { flex-direction: row; flex-wrap: wrap; gap: 20px 28px; align-items: flex-end; justify-content: space-between; }
  .fn-main-head-actions { align-items: flex-end; min-width: 220px; width: auto; }
  .fn-grid { grid-template-columns: repeat(3, minmax(0,1fr)); }
  .fn-grid-compact { grid-template-columns: repeat(4, minmax(0,1fr)); }
  .fn-place-row { display: flex; flex-wrap: wrap; }
  .fn-ambient-row { display: flex; flex-wrap: wrap; }
  .fn-ambient-item { border-radius: 999px; padding: 8px 14px 8px 8px; }
  @media (max-width: 980px) {
    .quick-nav-inner { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
  .landing-hero-stat { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px; background: rgba(15,23,42,.06); color: #0f172a; font-size: 13px; font-weight: 800; letter-spacing: -.01em; }
  .landing-hero-stat::before { content: ""; display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 0 4px rgba(16,185,129,.18); }
  .landing-hero-promise-strip { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 16px; }
  .landing-hero-promise-chip { display: inline-flex; align-items: center; min-height: 38px; padding: 8px 14px; border-radius: 999px; background: rgba(255,255,255,.88); border: 1px solid rgba(15,23,42,.08); color: #0f172a; font-size: 12px; font-weight: 800; letter-spacing: -.01em; box-shadow: 0 10px 22px rgba(15,23,42,.05); }
  @media (max-width: 860px) {
    .field-loop-shell { grid-template-columns: 1fr; }
    .field-loop-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .fn-main-head { flex-direction: column; align-items: flex-start; justify-content: flex-start; }
    .fn-main-head-actions { align-items: flex-start; min-width: 0; width: 100%; }
    .fn-grid, .fn-grid-compact { grid-template-columns: repeat(2, minmax(0,1fr)); }
  }
  @media (max-width: 720px) {
    .tool-card-grid { grid-template-columns: 1fr; }
    .field-loop-copy, .field-loop-principles { padding: 22px; }
    .field-loop-grid { grid-template-columns: 1fr; }
    .landing-tools .section-header,
    .landing-map .section-header { flex-direction: column; align-items: flex-start; }
  }
  @media (max-width: 640px) {
    .quick-nav-inner { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 480px) {
    .fn-grid, .fn-grid-compact { grid-template-columns: 1fr; }
  }
    `,
  ].join("\n");

  const heroSupplementHtml = statLine
    ? `<div class="landing-hero-stat">${escapeHtml(statLine)}</div>`
    : "";

  const heroAfterActionsHtml = copy.heroPromiseChips.length > 0
    ? `<div class="landing-hero-promise-strip">${copy.heroPromiseChips.map((chip) => `<span class="landing-hero-promise-chip">${escapeHtml(chip)}</span>`).join("")}</div>`
    : "";

  const heroActionsFinal = isLoggedIn
    ? [
        { href: "/notes", label: copy.actionPrimaryLoggedIn },
        { href: "/map", label: copy.actionSecondary, variant: "secondary" as const },
      ]
    : [
        { href: "/record", label: copy.actionPrimaryGuest },
        { href: "/map", label: copy.actionSecondary, variant: "secondary" as const },
      ];

  return renderSiteDocument({
    basePath: options.basePath,
    title: copy.title,
    activeNav: localizedNavHome(lang),
    lang,
    currentPath,
    hero: {
      eyebrow: copy.heroEyebrow,
      heading: copy.heroHeadingPlain,
      headingHtml: copy.heroHeading,
      lead: copy.heroLead,
      tone: "light",
      align: "center",
      supplementHtml: heroSupplementHtml,
      actions: heroActionsFinal,
      afterActionsHtml: heroAfterActionsHtml,
    },
    belowHeroHtml: `${renderDemoLoginBanner(options.basePath, lang, { demoUserId: options.userId, isDemoView })}${renderQuickNav(options.basePath, lang)}`,
    extraStyles,
    body: `${renderFieldNoteMain(options.basePath, lang, snapshot)}
${fieldLoopSectionHtml}
${toolsSectionHtml}
${mapSectionHtml}
${bizSectionHtml}
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
    ? `/profile/${encodeURIComponent(options.userId)}`
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
        ${section.cards.map((card, cardIndex) => buildFlowLink(options.basePath, sectionHrefs[sectionIndex]?.[cardIndex] ?? card.href, card.label, card.note, copy.cardEyebrow, copy.openLabel)).join("")}
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

  void app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: null,
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: false },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
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
  void registerGuideApiRoutes(app);
  void registerWalkApiRoutes(app);
  void registerResearchApiRoutes(app);
  void registerFieldscanApiRoutes(app);

  return app;
}
