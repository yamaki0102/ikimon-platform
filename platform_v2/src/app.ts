import Fastify from "fastify";
import { getPool } from "./db.js";
import { getForwardedBasePath, withBasePath } from "./httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "./i18n.js";
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
import { formatStatLabel, getStrings } from "./i18n/index.js";
import type { LandingStrings } from "./i18n/strings.js";
import { buildObservationDetailPath } from "./services/observationDetailLink.js";
import type { LandingDailyCardKind, LandingObservation, LandingSnapshot } from "./services/readModels.js";
import { toThumbnailUrl } from "./services/thumbnailUrl.js";
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

function localeForLang(lang: SiteLang): string {
  const localeMap: Record<SiteLang, string> = {
    ja: "ja-JP",
    en: "en-US",
    es: "es-ES",
    "pt-BR": "pt-BR",
  };
  return localeMap[lang];
}

function formatLandingDate(lang: SiteLang, value: Date): string {
  return new Intl.DateTimeFormat(localeForLang(lang), {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(value);
}

function formatLandingObservedAt(lang: SiteLang, raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(localeForLang(lang), {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatLandingNumber(lang: SiteLang, value: number): string {
  return new Intl.NumberFormat(localeForLang(lang)).format(value);
}

function observationDetailHref(basePath: string, lang: SiteLang, obs: LandingObservation): string {
  return appendLangToHref(
    withBasePath(
      basePath,
      buildObservationDetailPath(obs.detailId ?? obs.visitId ?? obs.occurrenceId, obs.featuredOccurrenceId ?? obs.occurrenceId),
    ),
    lang,
  );
}

function observationPlaceLabel(obs: LandingObservation): string {
  return obs.publicLocation?.label || [obs.placeName, obs.municipality].filter(Boolean).join(" · ");
}

function buildLandingHeroHtml(
  options: PreviewContext,
  lang: SiteLang,
  copy: LandingStrings,
  snapshot: LandingSnapshot,
  statLine: string,
  isLoggedIn: boolean,
): string {
  const featuredObservation = snapshot.dailyDashboard?.featuredObservation ?? null;
  const heroPool = [featuredObservation, ...snapshot.myFeed, ...snapshot.feed].filter((obs): obs is LandingObservation => Boolean(obs));
  const uniqueHeroPool = Array.from(new Map(heroPool.map((obs) => [obs.occurrenceId, obs])).values());
  const photoObservation = featuredObservation?.photoUrl ? featuredObservation : uniqueHeroPool.find((obs) => Boolean(obs.photoUrl)) ?? null;
  const primaryObservation = featuredObservation ?? photoObservation ?? uniqueHeroPool[0] ?? null;
  const photoUrl = photoObservation?.photoUrl
    ? (toThumbnailUrl(photoObservation.photoUrl, "lg") ?? photoObservation.photoUrl)
    : null;
  const todayLabel = formatLandingDate(lang, new Date());
  const actionPrimaryHref = isLoggedIn ? "/notes" : "/record";
  const heroActions = [
    { href: actionPrimaryHref, label: isLoggedIn ? copy.actionPrimaryLoggedIn : copy.actionPrimaryGuest, modifier: "is-primary" },
    { href: "/map", label: copy.actionSecondary, modifier: "is-secondary" },
  ];

  const actionsHtml = heroActions
    .map((action) => `<a class="landing-hero-action ${action.modifier}" href="${escapeHtml(appendLangToHref(withBasePath(options.basePath, action.href), lang))}">${escapeHtml(action.label)}</a>`)
    .join("");

  const chipsHtml = copy.heroPromiseChips
    .slice(0, 4)
    .map((chip) => `<span>${escapeHtml(chip)}</span>`)
    .join("");

  const visualHtml = photoUrl
    ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(photoObservation?.displayName ?? copy.heroPhotoFallback)}" loading="eager" decoding="async" fetchpriority="high" />`
    : `<div class="landing-hero-fallback" aria-label="${escapeHtml(copy.heroPhotoFallback)}"></div>`;

  const latestHref = primaryObservation ? observationDetailHref(options.basePath, lang, primaryObservation) : "";
  const latestPlace = primaryObservation ? observationPlaceLabel(primaryObservation) : "";
  const latestHtml = primaryObservation
    ? `<a class="landing-hero-latest-main" href="${escapeHtml(latestHref)}">
        <span>${escapeHtml(featuredObservation ? copy.heroReasonLabels[featuredObservation.reasonKey] : copy.heroLatestLabel)}</span>
        <strong>${escapeHtml(primaryObservation.displayName)}</strong>
        <small>${escapeHtml([latestPlace, formatLandingObservedAt(lang, primaryObservation.observedAt)].filter(Boolean).join(" · "))}</small>
      </a>`
    : `<div class="landing-hero-latest-main">
        <span>${escapeHtml(copy.heroLatestLabel)}</span>
        <strong>${escapeHtml(copy.heroPhotoFallback)}</strong>
      </div>`;

  const statHtml = featuredObservation
    ? `<div class="landing-hero-stat-block">
        <span>${escapeHtml(copy.dailyDashboard.scoreLabel)}</span>
        <strong>${escapeHtml(`${copy.heroReasonLabels[featuredObservation.reasonKey]} · ${formatLandingNumber(lang, featuredObservation.score)}`)}</strong>
      </div>`
    : statLine
    ? `<div class="landing-hero-stat-block">
        <span>${escapeHtml(copy.heroStatsLabel)}</span>
        <strong>${escapeHtml(statLine)}</strong>
      </div>`
    : "";

  return `<section class="landing-daily-hero" aria-labelledby="landing-hero-heading">
    <div class="landing-hero-visual${photoUrl ? "" : " is-fallback"}">${visualHtml}</div>
    <div class="landing-hero-shade"></div>
    <div class="landing-hero-inner">
      <div class="landing-hero-copy">
        <div class="landing-hero-kicker"><span>${escapeHtml(copy.heroDailyLabel)}</span><time>${escapeHtml(todayLabel)}</time></div>
        <h1 id="landing-hero-heading">${copy.heroHeading}</h1>
        <p>${escapeHtml(copy.heroLead)}</p>
        <div class="landing-hero-actions">${actionsHtml}</div>
        ${chipsHtml ? `<div class="landing-hero-chips">${chipsHtml}</div>` : ""}
      </div>
      <div class="landing-hero-live">
        ${latestHtml}
        ${statHtml}
      </div>
    </div>
  </section>`;
}

function renderLandingDailyDashboard(
  options: PreviewContext,
  lang: SiteLang,
  copy: LandingStrings,
  snapshot: LandingSnapshot,
): string {
  const dashboard = snapshot.dailyDashboard;
  if (!dashboard) return "";
  const cardOrder: LandingDailyCardKind[] = ["recordToday", "revisitPlace", "nearbyPulse", "needsId"];
  const cardsByKind = new Map(dashboard.dailyCards.map((card) => [card.kind, card]));
  const cardsHtml = cardOrder
    .map((kind) => {
      const card = cardsByKind.get(kind);
      const cardCopy = copy.dailyDashboard.cards[kind];
      const href = card?.observation
        ? observationDetailHref(options.basePath, lang, card.observation)
        : appendLangToHref(withBasePath(options.basePath, card?.href ?? "/map"), lang);
      const primary = card?.primaryText ?? null;
      const secondary = card?.secondaryText ?? cardCopy.body;
      const metricHtml = card?.metricValue !== null && card?.metricValue !== undefined
        ? `<span class="dd-card-metric"><strong>${escapeHtml(formatLandingNumber(lang, card.metricValue))}</strong>${escapeHtml(cardCopy.metricLabel)}</span>`
        : "";
      return `<a class="dd-card dd-card-${kind}" href="${escapeHtml(href)}">
        <span class="dd-card-eyebrow">${escapeHtml(cardCopy.eyebrow)}</span>
        <h3>${escapeHtml(cardCopy.title)}</h3>
        ${primary ? `<p>${escapeHtml(primary)}</p>` : ""}
        <small>${escapeHtml(secondary)}</small>
        <span class="dd-card-foot">${metricHtml}<span>${escapeHtml(cardCopy.cta)}</span></span>
      </a>`;
    })
    .join("");

  const seasonalHtml = dashboard.seasonalStrip.length
    ? dashboard.seasonalStrip
        .map((item) => {
          const href = observationDetailHref(options.basePath, lang, item.observation);
          const photoUrl = item.observation.photoUrl ? (toThumbnailUrl(item.observation.photoUrl, "sm") ?? item.observation.photoUrl) : null;
          const location = observationPlaceLabel(item.observation);
          return `<a class="dd-seasonal-item" href="${escapeHtml(href)}">
            ${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(item.observation.displayName)}" loading="lazy" decoding="async" />` : ""}
            <span>${escapeHtml(copy.heroReasonLabels[item.reasonKey])}</span>
            <strong>${escapeHtml(item.observation.displayName)}</strong>
            <small>${escapeHtml([location, formatLandingObservedAt(lang, item.observation.observedAt)].filter(Boolean).join(" · "))}</small>
          </a>`;
        })
        .join("")
    : `<div class="dd-seasonal-empty">${escapeHtml(copy.dailyDashboard.seasonalEmpty)}</div>`;

  return `<section class="daily-dashboard" aria-labelledby="daily-dashboard-heading">
    <div class="dd-head">
      <span>${escapeHtml(copy.dailyDashboard.eyebrow)}</span>
      <div>
        <h2 id="daily-dashboard-heading">${escapeHtml(copy.dailyDashboard.title)}</h2>
        <p>${escapeHtml(copy.dailyDashboard.lead)}</p>
      </div>
    </div>
    <div class="dd-card-grid">${cardsHtml}</div>
    <div class="dd-seasonal">
      <div class="dd-seasonal-head">
        <h3>${escapeHtml(copy.dailyDashboard.seasonalTitle)}</h3>
        <time datetime="${escapeHtml(dashboard.dateKey)}">${escapeHtml(formatLandingDate(lang, new Date(`${dashboard.dateKey}T00:00:00Z`)))}</time>
      </div>
      <div class="dd-seasonal-strip">${seasonalHtml}</div>
    </div>
  </section>`;
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
      icon: "AI",
      eyebrow: copy.tools.lens.eyebrow,
      title: copy.tools.lens.title,
      body: copy.tools.lens.body,
      ctaLabel: copy.tools.lens.cta,
      href: "/lens",
      badge: copy.tools.lens.badge,
    })}
    ${renderToolCard(options.basePath, lang, {
      icon: "MAP",
      eyebrow: copy.tools.scan.eyebrow,
      title: copy.tools.scan.title,
      body: copy.tools.scan.body,
      ctaLabel: copy.tools.scan.cta,
      href: "/map",
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

  const fieldLoopStepsHtml = `<div class="field-loop-grid">${fieldLoop.steps
    .map((step) => `<div class="field-loop-card"><span></span><strong>${escapeHtml(step.title)}</strong><small>${escapeHtml(step.body)}</small></div>`)
    .join("")}</div>`;

  const fieldLoopPrinciplesHtml = fieldLoop.principles.length > 0
    ? `<div class="field-loop-principles">${fieldLoop.principles.slice(0, 4).map((principle) => `<span>${escapeHtml(principle)}</span>`).join("")}</div>`
    : "";

  const fieldLoopSectionHtml = `<section class="section field-loop-section" aria-labelledby="field-loop-heading">
    <div class="field-loop-shell">
      <div class="field-loop-copy">
        <div class="eyebrow">${escapeHtml(fieldLoop.eyebrow)}</div>
        <h2 id="field-loop-heading">${escapeHtml(fieldLoop.title)}</h2>
        <p>${escapeHtml(fieldLoop.lead)}</p>
        ${fieldLoopPrinciplesHtml}
        <div class="actions" style="margin-top:20px">
          <a class="btn btn-solid" href="${escapeHtml(appendLangToHref(withBasePath(options.basePath, "/about"), lang))}">${escapeHtml(fieldLoop.primaryCta)}</a>
        </div>
      </div>
      ${fieldLoopStepsHtml}
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
  .landing-daily-hero {
    position: relative;
    min-height: clamp(500px, 64svh, 640px);
    margin-top: 10px;
    border-radius: 28px;
    overflow: hidden;
    background: #0f172a;
    color: #ffffff;
    box-shadow: 0 22px 54px rgba(15, 23, 42, .14);
    isolation: isolate;
  }
  .landing-hero-visual,
  .landing-hero-shade {
    position: absolute;
    inset: 0;
  }
  .landing-hero-visual img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    filter: saturate(1.08) contrast(1.03) brightness(1.06);
  }
  .landing-hero-visual.is-fallback {
    background:
      linear-gradient(120deg, rgba(8,47,73,.95), rgba(6,78,59,.86)),
      repeating-linear-gradient(90deg, rgba(255,255,255,.08) 0 1px, transparent 1px 42px);
  }
  .landing-hero-fallback {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    background:
      linear-gradient(135deg, rgba(34,211,238,.16), transparent 28%),
      linear-gradient(315deg, rgba(132,204,22,.16), transparent 34%),
      linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px),
      linear-gradient(0deg, rgba(255,255,255,.04) 1px, transparent 1px),
      linear-gradient(145deg, rgba(255,255,255,.1), rgba(255,255,255,.03));
    background-size: auto, auto, 64px 64px, 64px 64px, auto;
  }
  .landing-hero-shade {
    z-index: 1;
    background:
      linear-gradient(90deg, rgba(3, 7, 18, .54) 0%, rgba(3, 7, 18, .34) 48%, rgba(3, 7, 18, .08) 100%),
      linear-gradient(180deg, rgba(3, 7, 18, .02) 0%, rgba(3, 7, 18, .36) 100%);
  }
  .landing-hero-inner {
    position: relative;
    z-index: 2;
    min-height: inherit;
    display: grid;
    grid-template-columns: minmax(0, 1.08fr) minmax(260px, .48fr);
    align-items: end;
    gap: clamp(22px, 4vw, 44px);
    padding: clamp(30px, 5vw, 56px);
  }
  .landing-hero-copy {
    max-width: 720px;
    text-shadow: 0 14px 34px rgba(0,0,0,.24);
  }
  .landing-hero-kicker {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 38px;
    padding: 6px 12px;
    border-radius: 999px;
    background: rgba(255,255,255,.18);
    border: 1px solid rgba(255,255,255,.28);
    backdrop-filter: blur(12px);
    color: rgba(255,255,255,.92);
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0;
  }
  .landing-hero-kicker time {
    padding-left: 10px;
    border-left: 1px solid rgba(255,255,255,.28);
    color: rgba(255,255,255,.76);
  }
  .landing-hero-copy h1 {
    margin: 18px 0 0;
    max-width: 12ch;
    font-family: "Zen Kaku Gothic New", "Inter", "Noto Sans JP", sans-serif;
    font-size: clamp(40px, 5.3vw, 68px);
    line-height: 1.08;
    letter-spacing: 0;
    font-weight: 950;
  }
  .landing-hero-copy .hero-emphasis { color: #d9f99d; }
  .landing-hero-copy p {
    margin: 20px 0 0;
    max-width: 31em;
    color: rgba(255,255,255,.92);
    font-size: clamp(15px, 1.45vw, 19px);
    line-height: 1.78;
  }
  .landing-hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 26px;
  }
  .landing-hero-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 50px;
    padding: 12px 22px;
    border-radius: 999px;
    font-size: 14px;
    font-weight: 900;
    letter-spacing: 0;
    border: 1px solid rgba(255,255,255,.28);
    box-shadow: 0 14px 28px rgba(0,0,0,.16);
  }
  .landing-hero-action.is-primary {
    background: #ffffff;
    color: #0f172a;
  }
  .landing-hero-action.is-secondary {
    background: rgba(255,255,255,.16);
    color: #ffffff;
    backdrop-filter: blur(12px);
  }
  .landing-hero-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
    max-width: 720px;
  }
  .landing-hero-chips span {
    display: inline-flex;
    align-items: center;
    min-height: 32px;
    padding: 6px 11px;
    border-radius: 999px;
    background: rgba(255,255,255,.13);
    border: 1px solid rgba(255,255,255,.2);
    color: rgba(255,255,255,.88);
    backdrop-filter: blur(10px);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0;
  }
  .landing-hero-live {
    display: grid;
    gap: 10px;
    align-self: end;
  }
  .landing-hero-latest-main,
  .landing-hero-stat-block {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 15px 17px;
    border-radius: 20px;
    background: rgba(255,255,255,.88);
    border: 1px solid rgba(255,255,255,.42);
    color: #0f172a;
    box-shadow: 0 12px 28px rgba(0,0,0,.1);
    backdrop-filter: blur(18px);
  }
  .landing-hero-latest-main span,
  .landing-hero-stat-block span {
    color: #047857;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0;
  }
  .landing-hero-latest-main strong,
  .landing-hero-stat-block strong {
    color: #0f172a;
    font-size: 16px;
    line-height: 1.35;
    font-weight: 900;
  }
  .landing-hero-latest-main small {
    color: #64748b;
    font-size: 12px;
    line-height: 1.55;
    font-weight: 700;
  }
  .landing-hero-stat-block {
    background: rgba(240,253,244,.9);
  }
  .daily-dashboard {
    margin-top: 22px;
    padding: clamp(20px, 3.5vw, 30px);
    border-radius: 24px;
    background: rgba(255,255,255,.92);
    border: 1px solid rgba(15,23,42,.06);
    box-shadow: 0 12px 32px rgba(15,23,42,.06);
  }
  .dd-head {
    display: grid;
    grid-template-columns: minmax(120px, .28fr) minmax(0, 1fr);
    gap: 18px;
    align-items: start;
  }
  .dd-head > span {
    display: inline-flex;
    width: fit-content;
    min-height: 32px;
    align-items: center;
    padding: 7px 12px;
    border-radius: 999px;
    background: #ecfdf5;
    color: #047857;
    font-size: 12px;
    font-weight: 900;
  }
  .dd-head h2 {
    margin: 0;
    max-width: 18ch;
    color: #0f172a;
    font-size: clamp(26px, 3vw, 40px);
    line-height: 1.14;
    letter-spacing: 0;
  }
  .dd-head p {
    margin: 12px 0 0;
    max-width: 54ch;
    color: #475569;
    font-size: 14px;
    line-height: 1.8;
    font-weight: 700;
  }
  .dd-card-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin-top: 20px;
  }
  .dd-card {
    min-height: 188px;
    display: grid;
    align-content: start;
    gap: 8px;
    padding: 16px;
    border-radius: 20px;
    background: #ffffff;
    border: 1px solid rgba(15,23,42,.07);
    color: #0f172a;
    box-shadow: 0 8px 20px rgba(15,23,42,.045);
  }
  .dd-card-eyebrow {
    color: #047857;
    font-size: 11px;
    font-weight: 950;
    letter-spacing: 0;
  }
  .dd-card h3 {
    margin: 0;
    font-size: 15px;
    line-height: 1.35;
    letter-spacing: 0;
  }
  .dd-card p {
    margin: 0;
    color: #0f172a;
    font-size: 13px;
    line-height: 1.45;
    font-weight: 850;
  }
  .dd-card small {
    color: #64748b;
    font-size: 12px;
    line-height: 1.62;
    font-weight: 700;
  }
  .dd-card-foot {
    align-self: end;
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: center;
    margin-top: 6px;
    color: #0f766e;
    font-size: 12px;
    font-weight: 900;
  }
  .dd-card-metric {
    display: inline-flex;
    align-items: baseline;
    gap: 5px;
    color: #0f172a;
  }
  .dd-card-metric strong { font-size: 22px; line-height: 1; }
  .dd-seasonal {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid rgba(15,23,42,.08);
  }
  .dd-seasonal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .dd-seasonal-head h3 {
    margin: 0;
    font-size: 16px;
    line-height: 1.35;
    color: #0f172a;
  }
  .dd-seasonal-head time {
    color: #64748b;
    font-size: 12px;
    font-weight: 800;
  }
  .dd-seasonal-strip {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
    margin-top: 12px;
  }
  .dd-seasonal-item {
    min-width: 0;
    display: grid;
    gap: 5px;
    padding: 9px;
    border-radius: 16px;
    background: #f8fafc;
    border: 1px solid rgba(15,23,42,.06);
    color: #0f172a;
  }
  .dd-seasonal-item img {
    width: 100%;
    aspect-ratio: 1.4 / 1;
    object-fit: cover;
    border-radius: 12px;
    background: #e2e8f0;
  }
  .dd-seasonal-item span {
    color: #0f766e;
    font-size: 10px;
    font-weight: 950;
  }
  .dd-seasonal-item strong {
    min-width: 0;
    color: #0f172a;
    font-size: 13px;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dd-seasonal-item small,
  .dd-seasonal-empty {
    color: #64748b;
    font-size: 11px;
    line-height: 1.5;
    font-weight: 700;
  }
  .landing-discovery-grid {
    display: grid;
    grid-template-columns: minmax(0, .88fr) minmax(0, 1.12fr);
    gap: 24px;
    align-items: start;
  }
  .landing-discovery-grid > .section { margin-top: 24px; }
  @media (min-width: 1120px) {
    .site-header-inner { flex-wrap: nowrap; gap: 12px; }
    .brand { min-width: 245px; }
    .brand small { white-space: nowrap; }
    .site-nav { gap: 4px; flex-wrap: nowrap; }
    .site-nav-link { padding-left: 8px; padding-right: 8px; white-space: nowrap; }
    .site-header-actions { flex-wrap: nowrap; }
    .site-search { flex: 0 1 230px; max-width: 230px; }
    .lang-switch-link { min-width: 38px; padding: 0 10px; }
  }
  .quick-nav-inner { grid-template-columns: repeat(4, minmax(0, 1fr)); max-width: none; }
  .field-loop-section { position: relative; overflow: hidden; }
  .field-loop-shell { display: grid; gap: 12px; }
  .field-loop-copy { border-radius: 22px; padding: 24px; }
  .field-loop-copy { background: #ffffff; border: 1px solid rgba(15,23,42,.06); box-shadow: 0 8px 22px rgba(15,23,42,.045); }
  .field-loop-copy h2 { margin-top: 8px; font-size: clamp(26px, 3vw, 38px); line-height: 1.18; letter-spacing: 0; }
  .field-loop-copy p { max-width: 58ch; }
  .field-loop-principles { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; max-width: 760px; }
  .field-loop-principles span { display: inline-flex; align-items: center; min-height: 32px; padding: 6px 11px; border-radius: 999px; background: #f8fafc; border: 1px solid rgba(15,23,42,.06); color: #0f172a; font-size: 12px; font-weight: 800; }
  .field-loop-boundary-strip { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
  .field-loop-boundary-chip { display: inline-flex; align-items: center; min-height: 36px; padding: 8px 12px; border-radius: 999px; background: rgba(15,23,42,.06); color: #0f172a; font-size: 12px; font-weight: 800; letter-spacing: 0; }
  .field-loop-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 4px; }
  .field-loop-card { min-height: 100%; padding: 14px 16px; border-radius: 18px; background: #ffffff; border: 1px solid rgba(15,23,42,.06); display: grid; gap: 6px; box-shadow: 0 6px 16px rgba(15,23,42,.04); }
  .field-loop-card span { width: 8px; height: 8px; border-radius: 999px; background: #10b981; box-shadow: 0 0 0 4px rgba(16,185,129,.12); }
  .field-loop-card strong { font-size: 14px; line-height: 1.35; letter-spacing: 0; color: #0f172a; }
  .field-loop-card small { font-size: 12px; line-height: 1.65; color: #64748b; font-weight: 700; }
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
  .landing-hero-stat { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px; background: rgba(15,23,42,.06); color: #0f172a; font-size: 13px; font-weight: 800; letter-spacing: 0; }
  .landing-hero-stat::before { content: ""; display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 0 4px rgba(16,185,129,.18); }
  @media (max-width: 860px) {
    .landing-hero-inner { grid-template-columns: 1fr; align-items: end; padding: 28px; }
    .landing-hero-live { grid-template-columns: 1fr 1fr; }
    .dd-head { grid-template-columns: 1fr; gap: 12px; }
    .dd-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .dd-seasonal-strip { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .landing-discovery-grid { grid-template-columns: 1fr; gap: 0; }
    .field-loop-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .fn-main-head { flex-direction: column; align-items: flex-start; justify-content: flex-start; }
    .fn-main-head-actions { align-items: flex-start; min-width: 0; width: 100%; }
    .fn-grid, .fn-grid-compact { grid-template-columns: repeat(2, minmax(0,1fr)); }
  }
  @media (max-width: 720px) {
    .landing-daily-hero { min-height: 0; border-radius: 24px; }
    .landing-hero-inner { min-height: 0; padding: 22px; gap: 18px; }
    .landing-hero-copy h1 { max-width: 10ch; font-size: clamp(34px, 9vw, 46px); line-height: 1.12; margin-top: 14px; }
    .landing-hero-copy p { max-width: 24em; font-size: 14px; line-height: 1.76; margin-top: 16px; }
    .landing-hero-actions { margin-top: 22px; }
    .landing-hero-live { grid-template-columns: 1fr; }
    .tool-card-grid { grid-template-columns: 1fr; }
    .field-loop-copy { padding: 22px; }
    .field-loop-grid { grid-template-columns: 1fr; }
    .landing-tools .section-header,
    .landing-map .section-header { flex-direction: column; align-items: flex-start; }
  }
  @media (max-width: 640px) {
    .quick-nav-inner { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 520px) {
    .daily-dashboard { border-radius: 22px; padding: 18px; }
    .dd-head { gap: 8px; }
    .dd-head h2 { font-size: 24px; }
    .dd-head p { display: none; }
    .dd-card-grid { grid-template-columns: 1fr; gap: 10px; margin-top: 14px; }
    .dd-card { min-height: 0; }
    .dd-seasonal-strip { grid-template-columns: 1fr; }
    .dd-seasonal-item { grid-template-columns: 72px minmax(0, 1fr); align-items: center; }
    .dd-seasonal-item img { grid-row: span 3; aspect-ratio: 1 / 1; }
    .landing-hero-actions { display: grid; grid-template-columns: 1fr; gap: 8px; }
    .landing-hero-action { width: 100%; min-height: 46px; padding-left: 10px; padding-right: 10px; font-size: 13px; white-space: normal; text-align: center; }
    .landing-hero-chips { display: none; }
    .landing-hero-chips span { min-height: 30px; padding: 6px 10px; font-size: 11px; }
    .landing-hero-latest-main,
    .landing-hero-stat-block { border-radius: 18px; padding: 13px 14px; }
  }
  @media (max-width: 520px) and (max-height: 700px) {
    .landing-hero-inner { padding: 18px; }
    .landing-hero-copy p { display: none; }
    .landing-hero-actions { margin-top: 18px; }
  }
  @media (max-width: 480px) {
    .fn-grid, .fn-grid-compact { grid-template-columns: 1fr; }
  }
    `,
  ].join("\n");

  const landingHeroHtml = buildLandingHeroHtml(options, lang, copy, snapshot, statLine, isLoggedIn);
  const dailyDashboardHtml = renderLandingDailyDashboard(options, lang, copy, snapshot);

  return renderSiteDocument({
    basePath: options.basePath,
    title: copy.title,
    activeNav: localizedNavHome(lang),
    lang,
    currentPath,
    extraStyles,
    body: `${landingHeroHtml}
${dailyDashboardHtml}
${renderDemoLoginBanner(options.basePath, lang, { demoUserId: options.userId, isDemoView })}
${renderQuickNav(options.basePath, lang)}
${renderTodayHabit(options.basePath, lang, snapshot)}
${renderFieldNoteMain(options.basePath, lang, snapshot)}
${renderRevisitFlow(options.basePath, lang, snapshot)}
<div class="landing-discovery-grid">${toolsSectionHtml}${mapSectionHtml}</div>
${renderCommunityMeter(options.basePath, lang, snapshot)}
${fieldLoopSectionHtml}
${renderMentorStrip(options.basePath, lang)}
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
