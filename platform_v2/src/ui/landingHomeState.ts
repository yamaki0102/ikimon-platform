import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, type SiteLang } from "../i18n.js";
import type { LandingStrings } from "../i18n/strings.js";
import { buildObservationDetailPath } from "../services/observationDetailLink.js";
import type { LandingObservation, LandingSnapshot } from "../services/readModels.js";
import { toThumbnailUrl } from "../services/thumbnailUrl.js";
import { escapeHtml } from "./siteShell.js";

export type LandingHomeStateOptions = {
  basePath: string;
  lang: SiteLang;
  copy: LandingStrings;
  snapshot: LandingSnapshot;
  isLoggedIn: boolean;
};

type HomeMediaKind = "photo" | "video" | "audio" | "memo";

const genericNames = new Set(["", "\u540c\u5b9a\u5f85\u3061", "\u540d\u524d\u5f85\u3061", "unknown", "unidentified"]);

function href(options: LandingHomeStateOptions, path: string): string {
  return appendLangToHref(withBasePath(options.basePath, path), options.lang);
}

function observationKey(item: LandingObservation): string {
  return item.visitId || item.detailId || item.occurrenceId;
}

function unique(items: LandingObservation[]): LandingObservation[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = observationKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mediaKind(item: LandingObservation): HomeMediaKind {
  if (item.librarySourceKind === "video" || item.hasVideo) return "video";
  if (item.librarySourceKind === "audio" || item.hasAudio) return "audio";
  if (item.librarySourceKind === "note" || (!item.photoUrl && !item.mediaUrl && !item.hasPhoto)) return "memo";
  return "photo";
}

function displayName(item: LandingObservation, copy: LandingStrings): string {
  const preferred = item.vernacularName || item.scientificName || item.aiCandidateName || item.displayName;
  return genericNames.has(String(preferred || "").trim().toLowerCase()) ? copy.home.shared.unknownRecord : String(preferred);
}

function discoveryText(item: LandingObservation, copy: LandingStrings): string | null {
  const candidate = String(item.aiCandidateName || "").trim();
  if (candidate) return `${candidate} ${copy.home.shared.aiCandidateSuffix}`;
  const accepted = String(item.vernacularName || item.scientificName || "").trim();
  if (accepted && !genericNames.has(accepted.toLowerCase()) && item.identificationCount > 0) return accepted;
  return null;
}

function dateLabel(item: LandingObservation, lang: SiteLang): string {
  if (item.publicLocation?.scope === "blurred") return "";
  const value = new Date(item.observedAt);
  if (Number.isNaN(value.getTime())) return "";
  const locale: Record<SiteLang, string> = { ja: "ja-JP", en: "en-US", es: "es-ES", "pt-BR": "pt-BR" };
  return new Intl.DateTimeFormat(locale[lang], { month: "short", day: "numeric" }).format(value);
}

function safePlace(item: LandingObservation, copy: LandingStrings): string {
  if (item.publicLocation?.scope === "blurred") return "";
  return String(item.publicLocation?.label || item.municipality || "").trim() || copy.home.shared.safePlaceFallback;
}

function detailHref(options: LandingHomeStateOptions, item: LandingObservation): string {
  return href(options, buildObservationDetailPath(item.detailId || item.visitId, item.featuredOccurrenceId));
}

function mediaIcon(kind: HomeMediaKind): string {
  const paths: Record<HomeMediaKind, string> = {
    photo: '<path d="M4 7h3l1.5-2h7L17 7h3v12H4z"/><circle cx="12" cy="13" r="3.2"/>',
    video: '<rect x="3.5" y="5" width="13" height="14" rx="2"/><path d="m16.5 10 4-2.3v8.6l-4-2.3z"/>',
    audio: '<path d="M6 10v4M10 7v10M14 4v16M18 8v8"/>',
    memo: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 11h6M9 15h6"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[kind]}</svg>`;
}

function navigationIcon(kind: "home" | "record" | "discover" | "profile"): string {
  const paths = {
    home: '<path d="m4 11 8-7 8 7v9h-6v-6h-4v6H4z"/>',
    record: '<path d="M4 7h3l1.5-2h7L17 7h3v12H4z"/><circle cx="12" cy="13" r="3.2"/>',
    discover: '<circle cx="11" cy="11" r="6"/><path d="m16 16 4 4M11 8v6M8 11h6"/>',
    profile: '<circle cx="12" cy="8" r="3.5"/><path d="M5 21c.6-4 3-6 7-6s6.4 2 7 6"/>',
  } as const;
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[kind]}</svg>`;
}

function renderMedia(item: LandingObservation, copy: LandingStrings, eager = false): string {
  const kind = mediaKind(item);
  const imageUrl = item.photoUrl ? toThumbnailUrl(item.photoUrl, "md") : null;
  const count = Math.max(0, Number(item.photoCount || item.photoUrls?.length || 0));
  const countBadge = count > 1 ? `<span class="home-media-count">${escapeHtml(String(count))} ${escapeHtml(copy.home.shared.multipleMedia)}</span>` : "";
  if (imageUrl) {
    return `<span class="home-card-media is-${kind}">
      <img src="${escapeHtml(imageUrl)}" alt="" width="680" height="510" loading="${eager ? "eager" : "lazy"}" decoding="async"${eager ? ' fetchpriority="high"' : ""} />
      ${kind === "video" ? `<span class="home-media-affordance">${mediaIcon("video")}<span>${escapeHtml(copy.home.shared.media.video)}</span></span>` : ""}
      ${countBadge}
    </span>`;
  }
  return `<span class="home-card-media is-empty is-${kind}"><span class="home-empty-media-icon">${mediaIcon(kind)}</span><span>${escapeHtml(copy.home.shared.media[kind])}</span>${countBadge}</span>`;
}

function renderPublicCard(options: LandingHomeStateOptions, item: LandingObservation, eager = false): string {
  const meta = [safePlace(item, options.copy), dateLabel(item, options.lang)].filter(Boolean).join(" · ");
  return `<a class="home-public-card" href="${escapeHtml(detailHref(options, item))}" data-home-record-id="${escapeHtml(observationKey(item))}">
    ${renderMedia(item, options.copy, eager)}
    <span class="home-card-copy"><strong>${escapeHtml(displayName(item, options.copy))}</strong>${meta ? `<span>${escapeHtml(meta)}</span>` : ""}</span>
  </a>`;
}

function renderRecentCard(options: LandingHomeStateOptions, item: LandingObservation, integratedDiscovery: string | null): string {
  const processing = item.aiAssessmentStatus === "queued" || item.aiAssessmentStatus === "processing";
  return `<article class="home-recent-card" data-home-record-id="${escapeHtml(observationKey(item))}">
    <a class="home-recent-media-link" href="${escapeHtml(detailHref(options, item))}">${renderMedia(item, options.copy, true)}</a>
    <div class="home-recent-copy">
      <h3>${escapeHtml(displayName(item, options.copy))}</h3>
      <p class="home-record-date">${escapeHtml(dateLabel(item, options.lang))}</p>
      ${integratedDiscovery ? `<p class="home-record-insight"><span>${escapeHtml(options.copy.home.shared.fromRecord)}</span><strong>${escapeHtml(integratedDiscovery)}</strong></p>` : ""}
      ${processing ? `<p class="home-record-processing" role="status">${escapeHtml(options.copy.home.member.processing)}</p>` : ""}
      <a class="home-text-link" href="${escapeHtml(detailHref(options, item))}">${escapeHtml(options.copy.home.shared.openRecord)}</a>
    </div>
  </article>`;
}

function renderDiscoveryCard(options: LandingHomeStateOptions, item: LandingObservation, text: string): string {
  return `<a class="home-discovery-card" href="${escapeHtml(detailHref(options, item))}" data-home-record-id="${escapeHtml(observationKey(item))}">
    ${renderMedia(item, options.copy)}
    <span class="home-card-copy"><strong>${escapeHtml(text)}</strong><span>${escapeHtml(options.copy.home.shared.fromRecord)}</span></span>
  </a>`;
}

function slot(name: string, content: string): string {
  return `<!-- ikimon-home-slot:${name}:start -->${content}<!-- ikimon-home-slot:${name}:end -->`;
}

function sectionSlot(name: string, content: string): string {
  return `<!-- ikimon-home-section:${name}:start -->${content}<!-- ikimon-home-section:${name}:end -->`;
}

function renderGuest(options: LandingHomeStateOptions, publicItems: LandingObservation[]): string {
  const copy = options.copy.home.guest;
  const heroItem = publicItems.find((item) => Boolean(item.photoUrl));
  const heroVisual = heroItem ? `<div class="home-guest-hero-visual">${renderMedia(heroItem, options.copy, true)}</div>` : "";
  const publicShelf = publicItems.length > 0
    ? `<div class="home-horizontal-list" role="region" aria-label="${escapeHtml(copy.publicRecordsTitle)}">${publicItems.slice(0, 8).map((item) => renderPublicCard(options, item)).join("")}</div>`
    : `<a class="home-quiet-link" href="${escapeHtml(href(options, "/records?view=public"))}">${escapeHtml(copy.secondaryCta)}</a>`;
  const valueItems = copy.valueItems.map((item, index) => `<li><span class="home-value-icon" aria-hidden="true">${index + 1}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.body)}</small></span></li>`).join("");
  return `<div class="home-state-view is-guest" data-home-view="guest"${options.isLoggedIn ? " hidden" : ""}>
    <section class="home-guest-hero${heroVisual ? " has-visual" : ""}">
      <div class="home-guest-hero-copy"><h1>${escapeHtml(copy.heroHeading)}</h1><p>${escapeHtml(copy.heroLead)}</p>
        <div class="home-hero-actions"><a class="home-primary-button" href="${escapeHtml(href(options, "/record"))}">${escapeHtml(copy.primaryCta)}</a><a class="home-secondary-link" href="#home-public-records">${escapeHtml(copy.secondaryCta)}</a></div>
      </div>${slot("guest-hero", heroVisual)}
    </section>
    <section class="home-section" id="home-public-records"><h2>${escapeHtml(copy.publicRecordsTitle)}</h2>${slot("guest-public", publicShelf)}</section>
    <section class="home-section home-value-section"><h2>${escapeHtml(copy.valueTitle)}</h2><ol>${valueItems}</ol></section>
    <section class="home-section home-privacy-section"><span class="home-privacy-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span><div><h2>${escapeHtml(copy.privacyTitle)}</h2><p>${escapeHtml(copy.privacyBody)}</p></div></section>
    <section class="home-section home-final-section"><h2>${escapeHtml(copy.finalTitle)}</h2><a class="home-secondary-button" href="${escapeHtml(href(options, "/record"))}">${escapeHtml(copy.finalCta)}</a></section>
  </div>`;
}

function renderMember(options: LandingHomeStateOptions, ownItems: LandingObservation[], publicItems: LandingObservation[]): string {
  const copy = options.copy.home.member;
  const recent = ownItems[0] || null;
  const recentDiscovery = recent ? discoveryText(recent, options.copy) : null;
  const separateDiscovery = ownItems.slice(1).find((item) => Boolean(discoveryText(item, options.copy))) || null;
  const excluded = new Set([recent, separateDiscovery].filter(Boolean).map((item) => observationKey(item as LandingObservation)));
  const nearby = publicItems.filter((item) => !excluded.has(observationKey(item))).slice(0, 8);
  const recentSection = recent
    ? `<section class="home-section home-recent-section"><h2>${escapeHtml(copy.recentTitle)}</h2>${slot("member-recent", renderRecentCard(options, recent, separateDiscovery ? null : recentDiscovery))}</section>`
    : "";
  const separateText = separateDiscovery ? discoveryText(separateDiscovery, options.copy) : null;
  const discoverySection = separateDiscovery && separateText
    ? `<section class="home-section home-discovery-section"><h2>${escapeHtml(copy.discoveriesTitle)}</h2>${slot("member-discovery", renderDiscoveryCard(options, separateDiscovery, separateText))}</section>`
    : "";
  const nearbySection = nearby.length > 0
    ? `<section class="home-section home-nearby-section"><h2>${escapeHtml(copy.nearbyTitle)}</h2>${slot("member-nearby", `<div class="home-horizontal-list" role="region" aria-label="${escapeHtml(copy.nearbyTitle)}">${nearby.map((item) => renderPublicCard(options, item)).join("")}</div>`)}</section>`
    : "";
  return `<div class="home-state-view is-member" data-home-view="member"${options.isLoggedIn ? "" : " hidden"}>
    <section class="home-member-action"><h1>${escapeHtml(copy.actionTitle)}</h1><p>${escapeHtml(copy.actionLead)}</p><a class="home-primary-button" href="${escapeHtml(href(options, "/record"))}">${escapeHtml(copy.primaryCta)}</a></section>
    ${sectionSlot("member-recent", recentSection)}
    ${sectionSlot("member-discovery", discoverySection)}
    ${sectionSlot("member-nearby", nearbySection)}
    ${renderMemberBottomNav(options)}
  </div>`;
}

function renderMemberBottomNav(options: LandingHomeStateOptions): string {
  const copy = options.copy.home.shared.navigation;
  const links: Array<[keyof typeof copy, string]> = [
    ["home", "/"], ["record", "/record"], ["discover", "/records?view=public"], ["profile", "/profile"],
  ];
  return `<nav class="home-bottom-nav" aria-label="${escapeHtml(copy.home)}">${links.map(([key, path], index) => `<a href="${escapeHtml(href(options, path))}"${index === 0 ? ' aria-current="page"' : ""}>${navigationIcon(key)}<span>${escapeHtml(copy[key])}</span></a>`).join("")}</nav>`;
}

export function renderLandingHomeState(options: LandingHomeStateOptions): { heroHtml: string; bodyHtml: string } {
  const ownItems = unique(options.snapshot.myFeed.filter((item) => item.entryType !== "identification"));
  const ownKeys = new Set(ownItems.map(observationKey));
  const publicItems = unique([...(options.snapshot.publicProofFeed || []), ...options.snapshot.feed])
    .filter((item) => item.publicFeedEligible !== false && !ownKeys.has(observationKey(item)));
  return {
    heroHtml: `<div class="home-state-root" data-home-contract="state-split-v1" data-home-auth-state="${options.isLoggedIn ? "member" : "guest"}">${renderGuest(options, publicItems)}`,
    bodyHtml: `${renderMember(options, ownItems, publicItems)}</div>`,
  };
}

export const LANDING_HOME_STATE_STYLES = `
  body{background:#f7faf7;color:#17211b}.shell.shell-bleed.prototype-shell{width:min(100%,1180px);max-width:none;margin:0 auto;padding:0 20px 112px;color:#17211b}
  .site-header-home .site-header-inner{min-height:60px}.home-header-actions{margin-left:auto;align-items:center;gap:6px}.site-header-home[data-home-auth-state=guest] .home-header-actions.is-guest,.site-header-home[data-home-auth-state=member] .home-header-actions.is-member{display:flex}.site-header-home[data-home-auth-state=guest] .home-header-actions.is-member,.site-header-home[data-home-auth-state=member] .home-header-actions.is-guest{display:none}.home-header-login{min-width:72px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;color:#105738;font-weight:800;text-decoration:none}.site-header-home .site-account-icon,.site-header-home .site-notification-trigger{min-width:44px;min-height:44px}
  .home-state-root{--home-green:#16734a;--home-green-dark:#105738;--home-border:#dce6df;--home-muted:#5b675f}.home-state-view[hidden]{display:none!important}
  .home-state-view{display:grid;gap:40px;padding:24px 0 48px}.home-section{display:grid;gap:16px;min-width:0}.home-section h2,.home-member-action h1{margin:0;font-size:clamp(1.25rem,4.8vw,1.75rem);line-height:1.35;letter-spacing:-.02em}
  .home-guest-hero{display:grid;gap:20px;min-height:min(68svh,620px);align-content:center}.home-guest-hero-copy{display:grid;gap:18px}.home-guest-hero h1{max-width:12em;margin:0;font-size:clamp(2rem,8.5vw,4.1rem);line-height:1.2;letter-spacing:-.045em}.home-guest-hero p,.home-member-action p{max-width:42rem;margin:0;color:var(--home-muted);font-size:1rem;line-height:1.75}
  .home-guest-hero-visual{min-width:0}.home-guest-hero-visual .home-card-media{aspect-ratio:16/10;border-radius:20px}.home-hero-actions{display:flex;flex-wrap:wrap;align-items:center;gap:12px 18px}.home-primary-button,.home-secondary-button{min-height:54px;display:inline-flex;align-items:center;justify-content:center;padding:0 24px;border-radius:999px;text-decoration:none;font-size:1rem;font-weight:800}.home-primary-button{background:var(--home-green);color:#fff}.home-primary-button:hover{background:var(--home-green-dark)}.home-secondary-button{min-height:48px;border:1px solid var(--home-green);color:var(--home-green);background:#fff}.home-secondary-link,.home-text-link,.home-quiet-link{min-height:44px;display:inline-flex;align-items:center;color:var(--home-green-dark);font-weight:750;text-underline-offset:4px}
  .home-horizontal-list{display:grid;grid-auto-flow:column;grid-auto-columns:min(78vw,310px);gap:14px;overflow-x:auto;overscroll-behavior-inline:contain;scroll-snap-type:inline mandatory;padding:2px 20px 12px 0;scrollbar-width:thin}.home-public-card{display:grid;align-content:start;gap:12px;min-width:0;color:inherit;text-decoration:none;scroll-snap-align:start}.home-card-media{position:relative;display:grid;place-items:center;overflow:hidden;aspect-ratio:4/3;border-radius:18px;background:#e5eee8;color:var(--home-green-dark)}.home-card-media img{width:100%;height:100%;object-fit:cover}.home-card-media.is-empty{gap:8px;align-content:center;min-height:174px}.home-empty-media-icon svg{width:42px;height:42px}.home-card-media svg{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.home-media-affordance,.home-media-count{position:absolute;display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border-radius:999px;background:rgba(18,28,22,.78);color:#fff;font-size:.8125rem;font-weight:750}.home-media-affordance{inset:auto auto 10px 10px}.home-media-affordance svg{width:18px;height:18px}.home-media-count{inset:10px 10px auto auto}.home-card-copy{display:grid;gap:5px;padding:0 2px}.home-card-copy strong{font-size:1rem;line-height:1.45}.home-card-copy span{color:var(--home-muted);font-size:.875rem;line-height:1.5}
  .home-value-section ol{display:grid;gap:0;margin:0;padding:0;list-style:none;border-top:1px solid var(--home-border)}.home-value-section li{display:grid;grid-template-columns:44px 1fr;gap:12px;align-items:start;padding:20px 0;border-bottom:1px solid var(--home-border)}.home-value-icon{width:36px;height:36px;display:grid;place-items:center;border-radius:50%;background:#e6f2eb;color:var(--home-green-dark);font-weight:850}.home-value-section li span:last-child{display:grid;gap:5px}.home-value-section strong{font-size:1rem}.home-value-section small{color:var(--home-muted);font-size:.875rem;line-height:1.65}
  .home-privacy-section{grid-template-columns:44px 1fr;gap:14px;padding:24px 20px;border-radius:20px;background:#eaf4ee}.home-privacy-icon{width:44px;height:44px;display:grid;place-items:center;color:var(--home-green-dark)}.home-privacy-icon svg{width:28px;fill:none;stroke:currentColor;stroke-width:1.8}.home-privacy-section div{display:grid;gap:8px}.home-privacy-section p{margin:0;color:var(--home-muted);font-size:.9375rem;line-height:1.7}.home-final-section{justify-items:start;padding:8px 0 16px}
  .home-member-action{display:grid;gap:14px;padding:24px 20px;border-radius:20px;background:#eaf4ee}.home-member-action .home-primary-button{width:100%;margin-top:4px}.home-recent-card{display:grid;overflow:hidden;border:1px solid var(--home-border);border-radius:20px;background:#fff}.home-recent-media-link{display:block}.home-recent-card .home-card-media{border-radius:0;aspect-ratio:16/11}.home-recent-copy{display:grid;gap:8px;padding:18px}.home-recent-copy h3,.home-recent-copy p{margin:0}.home-recent-copy h3{font-size:1.25rem;line-height:1.4}.home-record-date{color:var(--home-muted);font-size:.875rem}.home-record-insight{display:grid;gap:4px;margin-top:4px!important;padding-top:14px;border-top:1px solid var(--home-border)}.home-record-insight span,.home-record-processing{color:var(--home-muted);font-size:.875rem;line-height:1.5}.home-record-insight strong{font-size:1rem;line-height:1.5}.home-discovery-card{display:grid;grid-template-columns:112px 1fr;gap:14px;align-items:center;color:inherit;text-decoration:none}.home-discovery-card .home-card-media{aspect-ratio:1;border-radius:16px}.home-discovery-card .home-card-copy{padding:0}
  .home-bottom-nav{position:fixed;z-index:50;inset:auto 0 0;display:grid;grid-template-columns:repeat(4,1fr);padding:6px max(8px,env(safe-area-inset-right)) max(6px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));border-top:1px solid var(--home-border);background:rgba(255,255,255,.96);backdrop-filter:blur(16px)}.home-bottom-nav a{min-width:0;min-height:56px;display:grid;place-items:center;align-content:center;gap:3px;color:#526158;text-decoration:none;font-size:.8125rem;font-weight:700}.home-bottom-nav a[aria-current=page]{color:var(--home-green-dark)}.home-bottom-nav svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  .home-state-root a:focus-visible{outline:3px solid #1c7b52;outline-offset:3px}.home-state-root a{touch-action:manipulation}@media(prefers-reduced-motion:reduce){.home-state-root *{scroll-behavior:auto!important;transition:none!important}}
  @media(min-width:768px){.shell.shell-bleed.prototype-shell{padding-inline:32px}.home-state-view{gap:48px}.home-guest-hero.has-visual{grid-template-columns:minmax(0,1fr) minmax(340px,.95fr);align-items:center;gap:44px}.home-horizontal-list{grid-auto-columns:min(38vw,330px)}.home-member-action{grid-template-columns:minmax(0,1fr) auto;align-items:center;padding:28px 32px}.home-member-action p{grid-column:1}.home-member-action .home-primary-button{grid-column:2;grid-row:1/3;width:auto;min-width:190px}.home-recent-card{grid-template-columns:minmax(320px,1.15fr) minmax(260px,.85fr);align-items:stretch}.home-recent-copy{align-content:center;padding:28px}.home-bottom-nav{left:50%;right:auto;bottom:16px;width:min(560px,calc(100vw - 32px));transform:translateX(-50%);border:1px solid var(--home-border);border-radius:20px;padding:5px 8px;box-shadow:0 12px 38px rgba(25,46,33,.14)}}
  @media(min-width:1100px){.home-state-view{padding-top:36px}.home-horizontal-list{grid-auto-flow:initial;grid-template-columns:repeat(3,minmax(0,1fr));overflow:visible;padding-right:0}.home-public-card:nth-child(n+7){display:none}.home-guest-hero{min-height:600px}.home-value-section ol{grid-template-columns:repeat(3,1fr);gap:28px;border:0}.home-value-section li{grid-template-columns:44px 1fr;border:0;padding:16px 0}.home-privacy-section{padding:30px 32px}}
  @media(max-width:359px){.shell.shell-bleed.prototype-shell{padding-inline:14px}.home-guest-hero h1{font-size:1.9rem}.home-horizontal-list{grid-auto-columns:82vw}.home-card-copy strong{font-size:.9375rem}.home-bottom-nav a{font-size:.75rem}}
`;
