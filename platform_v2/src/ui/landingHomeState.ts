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

function renderRecentCard(options: LandingHomeStateOptions, item: LandingObservation, eager = false): string {
  const meta = [dateLabel(item, options.lang), safePlace(item, options.copy)].filter(Boolean).join(" · ");
  return `<a class="home-recent-card" href="${escapeHtml(detailHref(options, item))}" data-home-record-id="${escapeHtml(observationKey(item))}">
    ${renderMedia(item, options.copy, eager)}
    <span class="home-card-copy"><strong>${escapeHtml(displayName(item, options.copy))}</strong>${meta ? `<span>${escapeHtml(meta)}</span>` : ""}</span>
  </a>`;
}

function slot(name: string, content: string): string {
  return `<!-- ikimon-home-slot:${name}:start -->${content}<!-- ikimon-home-slot:${name}:end -->`;
}

function captureButton(label: string, className: string, action: string): string {
  return `<button type="button" class="${escapeHtml(className)}" data-global-record-trigger="photo" data-kpi-event="capture_nav_tap" data-kpi-action="${escapeHtml(action)}" aria-haspopup="dialog">${escapeHtml(label)}</button>`;
}

function renderHeroHeading(lang: SiteLang, value: string): string {
  if (lang !== "ja") return escapeHtml(value);
  const phraseBoundary = value.indexOf("、");
  if (phraseBoundary < 0 || phraseBoundary >= value.length - 1) return escapeHtml(value);
  return `<span class="home-hero-phrase">${escapeHtml(value.slice(0, phraseBoundary + 1))}</span><span class="home-hero-phrase">${escapeHtml(value.slice(phraseBoundary + 1))}</span>`;
}

function renderGuest(options: LandingHomeStateOptions, publicItems: LandingObservation[]): string {
  const copy = options.copy.home.guest;
  const heroItem = publicItems.find((item) => Boolean(item.photoUrl));
  const heroVisual = heroItem ? `<div class="home-guest-hero-visual">${renderMedia(heroItem, options.copy, true)}</div>` : "";
  const categoryItems = copy.categories.map((item, index) => `<li class="is-category-${index + 1}"><span class="home-category-photo" aria-hidden="true"></span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.body)}</small></span></li>`).join("");
  const flowItems = copy.flowItems.map((item, index) => `<li><span class="home-value-icon" aria-hidden="true">${index + 1}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.body)}</small></span></li>`).join("");
  const placeVisual = heroItem ? `<div class="home-place-visual">${renderMedia(heroItem, options.copy)}</div>` : `<div class="home-place-visual is-placeholder" aria-hidden="true"><span></span><span></span><span></span></div>`;
  const placeHref = href(options, "/map?tab=places");
  return `<div class="home-state-view is-guest" data-home-view="guest"${options.isLoggedIn ? " hidden" : ""}>
    <section class="home-guest-hero${heroVisual ? " has-visual" : ""}">
      <div class="home-guest-hero-copy"><h1>${renderHeroHeading(options.lang, copy.heroHeading)}</h1><p>${escapeHtml(copy.heroLead)}</p>
        <div class="home-hero-actions">${captureButton(copy.primaryCta, "home-primary-button", "top_capture")}${`<a class="home-secondary-link" href="${escapeHtml(placeHref)}" data-kpi-event="top_place_tap" data-kpi-action="top_place">${escapeHtml(copy.secondaryCta)}</a>`}</div>
      </div>${slot("guest-hero", heroVisual)}
    </section>
    <section class="home-section home-category-section"><h2>${escapeHtml(copy.categoriesTitle)}</h2><ul>${categoryItems}</ul></section>
    <section class="home-section home-value-section"><h2>${escapeHtml(copy.flowTitle)}</h2><ol>${flowItems}</ol></section>
    <section class="home-section home-place-section" id="home-places">
      ${placeVisual}
      <div><h2>${escapeHtml(copy.placesTitle)}</h2><p>${escapeHtml(copy.placesBody)}</p><a class="home-secondary-button" href="${escapeHtml(placeHref)}" data-kpi-event="top_place_tap" data-kpi-action="top_place_section">${escapeHtml(copy.secondaryCta)}</a></div>
    </section>
    <section class="home-section home-privacy-section"><span class="home-privacy-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span><div><h2>${escapeHtml(copy.privacyTitle)}</h2><p>${escapeHtml(copy.privacyBody)}</p></div></section>
    <section class="home-section home-final-section"><h2>${escapeHtml(copy.finalTitle)}</h2>${captureButton(copy.finalCta, "home-secondary-button", "top_capture_final")}</section>
  </div>`;
}

function formatEventDate(value: string, lang: SiteLang): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const locale: Record<SiteLang, string> = { ja: "ja-JP", en: "en-US", es: "es-ES", "pt-BR": "pt-BR" };
  return new Intl.DateTimeFormat(locale[lang], { month: "short", day: "numeric" }).format(date);
}

function renderHomeContinuationScript(): string {
  return `<script>
(() => {
  const section = document.querySelector('[data-home-continuation]');
  if (!section || !('indexedDB' in window)) return;
  try {
    const request = indexedDB.open('ikimon-record-draft', 1);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('drafts')) { db.close(); return; }
      const tx = db.transaction('drafts', 'readonly');
      const getRequest = tx.objectStore('drafts').get('latest');
      getRequest.onsuccess = () => {
        const draft = getRequest.result;
        const files = draft && Array.isArray(draft.files) ? draft.files : [];
        if (draft && (draft.file || files.length > 0)) section.hidden = false;
      };
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
    };
  } catch (_) {}
})();
</script>`;
}

function renderMember(options: LandingHomeStateOptions, ownItems: LandingObservation[]): string {
  const copy = options.copy.home.member;
  const recentSection = ownItems.length > 0
    ? `<section class="home-section home-recent-section"><h2>${escapeHtml(copy.recentTitle)}</h2><div class="home-recent-grid">${ownItems.slice(0, 6).map((item, index) => renderRecentCard(options, item, index === 0)).join("")}</div></section>`
    : "";
  const placesSection = options.snapshot.myPlaces.length > 0
    ? `<section class="home-section home-places-section"><div class="home-section-heading"><h2>${escapeHtml(copy.placesTitle)}</h2><a href="${escapeHtml(href(options, "/records?view=places"))}">${escapeHtml(options.copy.home.guest.secondaryCta)}</a></div><div class="home-place-grid">${options.snapshot.myPlaces.slice(0, 4).map((place) => `<a class="home-place-card" href="${escapeHtml(href(options, "/records?view=places"))}"><strong>${escapeHtml(place.placeName)}</strong>${place.municipality ? `<span>${escapeHtml(place.municipality)}</span>` : ""}${place.latestDisplayName ? `<small>${escapeHtml(place.latestDisplayName)}</small>` : ""}</a>`).join("")}</div></section>`
    : "";
  const nextSection = options.snapshot.nearbyEvents.length > 0
    ? `<section class="home-section home-next-section"><h2>${escapeHtml(copy.nextTitle)}</h2><div class="home-next-list">${options.snapshot.nearbyEvents.slice(0, 3).map((event) => {
      const eventHref = event.eventCode
        ? href(options, `/community/events/${encodeURIComponent(event.eventCode)}/join`)
        : href(options, `/events/${encodeURIComponent(event.sessionId)}/live`);
      const meta = [formatEventDate(event.startedAt, options.lang), event.fieldName || event.city || event.prefecture || ""].filter(Boolean).join(" · ");
      return `<a href="${escapeHtml(eventHref)}"><strong>${escapeHtml(event.title)}</strong>${meta ? `<span>${escapeHtml(meta)}</span>` : ""}</a>`;
    }).join("")}</div></section>`
    : "";
  const emptyState = ownItems.length === 0
    ? `<section class="home-empty-state"><h2>${escapeHtml(copy.emptyTitle)}</h2><p>${escapeHtml(copy.emptyBody)}</p>${captureButton(copy.primaryCta, "home-primary-button", "home_empty_capture")}</section>`
    : "";
  return `<div class="home-state-view is-member" data-home-view="member"${options.isLoggedIn ? "" : " hidden"}>
    <section class="home-member-action"><h1>${escapeHtml(copy.actionTitle)}</h1><p>${escapeHtml(copy.actionLead)}</p>${captureButton(copy.primaryCta, "home-primary-button", "home_capture")}</section>
    <section class="home-continuation" data-home-continuation hidden><div><h2>${escapeHtml(copy.continuationTitle)}</h2><p>${escapeHtml(copy.continuationBody)}</p></div><a class="home-secondary-button" href="${escapeHtml(href(options, "/record?draft=1&source=home_continue"))}">${escapeHtml(copy.continuationCta)}</a></section>
    ${renderHomeContinuationScript()}
    ${emptyState}
    ${recentSection}
    ${placesSection}
    ${nextSection}
  </div>`;
}

export function renderLandingHomeState(options: LandingHomeStateOptions): { heroHtml: string; bodyHtml: string } {
  const ownItems = unique(options.snapshot.myFeed.filter((item) => item.entryType !== "identification"));
  const ownKeys = new Set(ownItems.map(observationKey));
  const publicItems = unique([...(options.snapshot.publicProofFeed || []), ...options.snapshot.feed])
    .filter((item) => item.publicFeedEligible !== false && !ownKeys.has(observationKey(item)));
  return {
    heroHtml: `<div class="home-state-root" data-home-contract="state-split-v1" data-home-auth-state="${options.isLoggedIn ? "member" : "guest"}">${renderGuest(options, publicItems)}`,
    bodyHtml: `${renderMember(options, ownItems)}</div>`,
  };
}

export const LANDING_HOME_STATE_STYLES = `
  body{background:#f7faf7;color:#17211b}.shell.shell-bleed.prototype-shell{box-sizing:border-box;width:min(100%,1180px);min-width:0;max-width:none;margin:0 auto;padding:0 20px 72px;color:#17211b}
  .site-header-home .site-header-inner{min-height:60px}.home-header-actions{margin-left:auto;align-items:center;gap:6px}.site-header-home[data-home-auth-state=guest] .home-header-actions.is-guest,.site-header-home[data-home-auth-state=member] .home-header-actions.is-member{display:flex}.site-header-home[data-home-auth-state=guest] .home-header-actions.is-member,.site-header-home[data-home-auth-state=member] .home-header-actions.is-guest{display:none}.home-header-login{min-width:72px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;color:#105738;font-weight:800;text-decoration:none}.site-header-home .site-account-icon,.site-header-home .site-notification-trigger{min-width:44px;min-height:44px}
  .home-state-root{min-width:0;--home-green:#16734a;--home-green-dark:#105738;--home-border:#dce6df;--home-muted:#5b675f}.home-state-root :where(p,small,.home-card-copy strong){overflow-wrap:anywhere}.home-state-view[hidden]{display:none!important}.home-state-view{display:grid;min-width:0;gap:44px;padding:24px 0 48px}.home-section{display:grid;gap:16px;min-width:0}.home-section h2,.home-member-action h1,.home-empty-state h2,.home-continuation h2{margin:0;font-size:clamp(1.25rem,4.8vw,1.8rem);line-height:1.35;letter-spacing:-.02em}
  .home-guest-hero{display:grid;min-width:0;gap:22px;min-height:min(70svh,640px);align-content:center}.home-guest-hero-copy{display:grid;min-width:0;gap:18px}.home-guest-hero h1{min-width:0;max-width:12em;margin:0;font-size:clamp(2.15rem,9vw,4.35rem);line-height:1.16;letter-spacing:-.045em;text-wrap:balance;overflow-wrap:break-word;word-break:normal}.home-hero-phrase{display:inline-block;max-width:100%}.home-guest-hero p,.home-member-action p,.home-place-section p,.home-empty-state p,.home-continuation p{max-width:44rem;margin:0;color:var(--home-muted);font-size:1rem;line-height:1.75}
  .home-guest-hero-visual{min-width:0}.home-card-media{position:relative;display:grid;place-items:center;overflow:hidden;aspect-ratio:4/3;border-radius:18px;background:#e5eee8;color:var(--home-green-dark)}.home-card-media img{width:100%;height:100%;object-fit:cover}.home-guest-hero-visual .home-card-media{aspect-ratio:16/10;border-radius:22px}.home-card-media.is-empty{gap:8px;align-content:center;min-height:174px}.home-empty-media-icon svg{width:42px;height:42px}.home-card-media svg{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.home-media-affordance,.home-media-count{position:absolute;display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border-radius:999px;background:rgba(18,28,22,.78);color:#fff;font-size:.8125rem;font-weight:750}.home-media-affordance{inset:auto auto 10px 10px}.home-media-affordance svg{width:18px;height:18px}.home-media-count{inset:10px 10px auto auto}.home-card-copy{display:grid;gap:5px;padding:0 2px}.home-card-copy strong{font-size:1rem;line-height:1.45}.home-card-copy span{color:var(--home-muted);font-size:.875rem;line-height:1.5}
  .home-hero-actions{display:flex;flex-wrap:wrap;align-items:center;gap:12px 18px}.home-primary-button,.home-secondary-button{min-height:54px;display:inline-flex;align-items:center;justify-content:center;padding:0 24px;border-radius:999px;text-decoration:none;font:inherit;font-size:1rem;font-weight:850;cursor:pointer}.home-primary-button{border:0;background:var(--home-green);color:#fff}.home-primary-button:hover{background:var(--home-green-dark)}.home-secondary-button{min-height:48px;border:1px solid var(--home-green);color:var(--home-green);background:#fff}.home-secondary-link{min-height:44px;display:inline-flex;align-items:center;color:var(--home-green-dark);font-weight:750;text-underline-offset:4px}
  .home-category-section ul{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:0;padding:0;list-style:none}.home-category-section li{display:grid;overflow:hidden;border:1px solid var(--home-border);border-radius:18px;background:#fff}.home-category-photo{display:block;aspect-ratio:16/9;background:linear-gradient(135deg,#e9b96e,#8b4d2d)}.home-category-section .is-category-2 .home-category-photo{background:linear-gradient(135deg,#d7424b,#f2bf60)}.home-category-section .is-category-3 .home-category-photo{background:linear-gradient(135deg,#506f7d,#d2a76b)}.home-category-section .is-category-4 .home-category-photo{background:linear-gradient(135deg,#70a977,#5479a7)}.home-category-section li>span:last-child{display:grid;gap:5px;padding:14px}.home-category-section small{color:var(--home-muted);font-size:.85rem;line-height:1.55}
  .home-value-section ol{display:grid;gap:0;margin:0;padding:0;list-style:none;border-top:1px solid var(--home-border)}.home-value-section li{display:grid;grid-template-columns:44px minmax(0,1fr);gap:12px;align-items:start;padding:20px 0;border-bottom:1px solid var(--home-border)}.home-value-icon{width:36px;height:36px;display:grid;place-items:center;border-radius:50%;background:#e6f2eb;color:var(--home-green-dark);font-weight:850}.home-value-section li span:last-child{display:grid;gap:5px}.home-value-section small{color:var(--home-muted);font-size:.875rem;line-height:1.65}
  .home-place-section{padding:20px;border-radius:22px;background:#edf4ef}.home-place-visual .home-card-media{aspect-ratio:16/9}.home-place-visual.is-placeholder{min-height:180px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:16px;border-radius:18px;background:#dfeae2}.home-place-visual.is-placeholder span{border-radius:14px;background:linear-gradient(160deg,#89a990,#d8a96c)}.home-place-section>div:last-child{display:grid;align-content:center;justify-items:start;gap:12px}
  .home-privacy-section{grid-template-columns:44px minmax(0,1fr);gap:14px;padding:24px 20px;border-radius:20px;background:#eaf4ee}.home-privacy-icon{width:44px;height:44px;display:grid;place-items:center;color:var(--home-green-dark)}.home-privacy-icon svg{width:28px;fill:none;stroke:currentColor;stroke-width:1.8}.home-privacy-section div{display:grid;gap:8px}.home-privacy-section p{margin:0;color:var(--home-muted);font-size:.9375rem;line-height:1.7}.home-final-section{justify-items:start;padding:8px 0 16px}
  .home-member-action,.home-empty-state,.home-continuation{display:grid;gap:14px;padding:24px 20px;border-radius:20px;background:#eaf4ee}.home-member-action .home-primary-button,.home-empty-state .home-primary-button{width:100%;margin-top:4px}.home-continuation{background:#fff;border:1px solid var(--home-border)}.home-continuation[hidden]{display:none}.home-continuation>div{display:grid;gap:6px}
  .home-recent-grid,.home-place-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.home-recent-card{display:grid;align-content:start;gap:12px;min-width:0;color:inherit;text-decoration:none}.home-recent-card .home-card-media{aspect-ratio:4/3}.home-place-card,.home-next-list a{min-height:88px;display:grid;align-content:center;gap:5px;padding:16px;border:1px solid var(--home-border);border-radius:16px;background:#fff;color:inherit;text-decoration:none}.home-place-card span,.home-place-card small,.home-next-list span{color:var(--home-muted);font-size:.875rem;line-height:1.45}.home-section-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}.home-section-heading a{min-height:44px;display:inline-flex;align-items:center;color:var(--home-green-dark);font-weight:750}.home-next-list{display:grid;gap:10px}
  .home-state-root :is(a,button):focus-visible{outline:3px solid #1c7b52;outline-offset:3px}.home-state-root :is(a,button){touch-action:manipulation}@supports(word-break:auto-phrase){html[lang=ja] .home-state-root :is(h1,h2,p,small){word-break:auto-phrase}}@media(prefers-reduced-motion:reduce){.home-state-root *{scroll-behavior:auto!important;transition:none!important}}
  @media(min-width:768px){.shell.shell-bleed.prototype-shell{padding-inline:32px}.home-state-view{gap:56px}.home-guest-hero.has-visual{grid-template-columns:minmax(0,1fr) minmax(340px,.95fr);align-items:center;gap:44px}.home-category-section ul{grid-template-columns:repeat(4,minmax(0,1fr))}.home-place-section{grid-template-columns:minmax(0,1.1fr) minmax(280px,.9fr);gap:28px;padding:28px}.home-member-action,.home-continuation{grid-template-columns:minmax(0,1fr) auto;align-items:center;padding:28px 32px}.home-member-action p{grid-column:1}.home-member-action .home-primary-button{grid-column:2;grid-row:1/3;width:auto;min-width:190px}.home-recent-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.home-place-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
  @media(min-width:1100px){.home-state-view{padding-top:36px}.home-guest-hero{min-height:620px}.home-value-section ol{grid-template-columns:repeat(3,1fr);gap:28px;border:0}.home-value-section li{grid-template-columns:44px 1fr;border:0;padding:16px 0}.home-privacy-section{padding:30px 32px}}
  @media(max-width:359px){.shell.shell-bleed.prototype-shell{padding-inline:14px}.home-guest-hero h1{font-size:1.95rem}.home-category-section ul,.home-recent-grid,.home-place-grid{grid-template-columns:1fr}.home-privacy-section{grid-template-columns:1fr;padding:18px 14px}.home-privacy-icon{width:36px;height:36px}.home-card-copy strong{font-size:.9375rem}}
`;
