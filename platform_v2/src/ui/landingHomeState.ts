import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, type SiteLang } from "../i18n.js";
import type { LandingStrings } from "../i18n/strings.js";
import { buildObservationDetailPath } from "../services/observationDetailLink.js";
import type { HomePlace, LandingObservation, LandingSnapshot } from "../services/readModels.js";
import { toThumbnailUrl } from "../services/thumbnailUrl.js";
import { buildPlaceRecordHref, formatShortDate, pickPlaceFocus } from "./placeRevisit.js";
import { escapeHtml } from "./siteShell.js";

export type LandingHomeStateOptions = {
  basePath: string;
  lang: SiteLang;
  copy: LandingStrings;
  snapshot: LandingSnapshot;
  isLoggedIn: boolean;
};

type HomeMediaKind = "photo" | "video" | "audio" | "memo";

const genericNames = new Set(["", "unknown", "unidentified"]);

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
  if (item.isAiCandidate && !item.vernacularName && !item.scientificName) {
    return copy.home.shared.unknownRecord;
  }
  const preferred = item.vernacularName || item.scientificName || item.displayName;
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
  const policy = homePreviewPolicy(item);
  const meta = [dateLabel(item, options.lang), policy === "photo" ? safePlace(item, options.copy) : ""].filter(Boolean).join(" · ");
  return `<a class="home-recent-card" href="${escapeHtml(detailHref(options, item))}" data-home-record-id="${escapeHtml(observationKey(item))}">
    ${renderMedia(item, options.copy, eager)}
    <span class="home-card-copy"><strong>${escapeHtml(displayName(item, options.copy))}</strong>${meta ? `<span>${escapeHtml(meta)}</span>` : ""}</span>
  </a>`;
}

function slot(name: string, content: string): string {
  return `<!-- ikimon-home-slot:${name}:start -->${content}<!-- ikimon-home-slot:${name}:end -->`;
}

function sectionSlot(name: string, content: string): string {
  return `<!-- ikimon-home-section:${name}:start -->${content}<!-- ikimon-home-section:${name}:end -->`;
}

function captureButton(label: string, className: string, action: string): string {
  return `<button type="button" class="${escapeHtml(className)}" data-global-record-trigger="photo" data-kpi-event="capture_nav_tap" data-kpi-action="${escapeHtml(action)}" aria-haspopup="dialog">${escapeHtml(label)}</button>`;
}

function galleryButton(label: string, className: string): string {
  return `<button type="button" class="${escapeHtml(className)}" data-global-record-gallery-select data-kpi-event="gallery_select_tap" data-kpi-action="home_gallery_select">${escapeHtml(label)}</button>`;
}

function renderHeroHeading(lang: SiteLang, value: string): string {
  if (lang !== "ja") return escapeHtml(value);
  const phraseBoundary = value.indexOf("、");
  if (phraseBoundary < 0 || phraseBoundary >= value.length - 1) return escapeHtml(value);
  return `<span class="home-hero-phrase">${escapeHtml(value.slice(0, phraseBoundary + 1))}</span><span class="home-hero-phrase">${escapeHtml(value.slice(phraseBoundary + 1))}</span>`;
}

function renderGuestPhotoTile(options: LandingHomeStateOptions, item: LandingObservation, index: number): string {
  const imageUrl = item.photoUrl ? toThumbnailUrl(item.photoUrl, index === 0 ? "lg" : "md") : null;
  if (!imageUrl) return "";
  const name = displayName(item, options.copy);
  const meta = [safePlace(item, options.copy), dateLabel(item, options.lang)].filter(Boolean).join(" · ");
  return `<a class="home-guest-proof-item is-item-${index + 1}" href="${escapeHtml(detailHref(options, item))}" data-home-public-record="${escapeHtml(observationKey(item))}">
    <img src="${escapeHtml(imageUrl)}" alt="" width="900" height="900" loading="${index === 0 ? "eager" : "lazy"}" decoding="async"${index === 0 ? ' fetchpriority="high"' : ""} />
    <span class="home-guest-proof-caption"><strong>${escapeHtml(name)}</strong>${meta ? `<small>${escapeHtml(meta)}</small>` : ""}</span>
  </a>`;
}

function isGuestVisibleRecord(item: LandingObservation): boolean {
  if (item.publicFeedEligible !== true || item.publicLocation?.scope === "blurred") return false;
  const status = item.publicFeedGateStatus;
  return status === "public_eligible" || status === "public_limited";
}

function renderGuestProof(options: LandingHomeStateOptions, publicItems: LandingObservation[]): string {
  const photos = publicItems.filter((item) => Boolean(item.photoUrl) && isGuestVisibleRecord(item)).slice(0, 5);
  if (photos.length === 0) {
    return `<div class="home-guest-proof is-count-0 is-empty">
      <img src="/assets/brand/zukan-icon.svg" alt="" width="220" height="220" />
      <p>${escapeHtml(options.copy.home.guest.proofEmpty)}</p>
    </div>`;
  }
  return `<div class="home-guest-proof is-count-${photos.length}">${photos.map((item, index) => renderGuestPhotoTile(options, item, index)).join("")}</div>`;
}

function renderGuest(options: LandingHomeStateOptions, publicItems: LandingObservation[]): string {
  const copy = options.copy.home.guest;
  const placeItem = publicItems.find((item) => Boolean(item.photoUrl) && isGuestVisibleRecord(item)) ?? null;
  const categoryItems = copy.categories
    .map((item, index) => `<li><span class="home-category-index">${String(index + 1).padStart(2, "0")}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.body)}</small></span></li>`)
    .join("");
  const flowItems = copy.flowItems.map((item, index) => `<li><span class="home-value-icon" aria-hidden="true">${index + 1}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.body)}</small></span></li>`).join("");
  const placeVisual = placeItem ? `<a class="home-place-visual" href="${escapeHtml(detailHref(options, placeItem))}">${renderMedia(placeItem, options.copy)}</a>` : `<div class="home-place-visual is-placeholder"><img src="/assets/brand/zukan-icon.svg" alt="" width="180" height="180" /></div>`;
  const placeHref = href(options, "/map?tab=places");
  return `<div class="home-state-view is-guest" data-home-view="guest"${options.isLoggedIn ? " hidden" : ""}>
    <section class="home-guest-hero has-visual">
      <div class="home-guest-hero-copy">
        <span class="home-product-kicker">ZUKAN</span>
        <h1>${renderHeroHeading(options.lang, copy.heroHeading)}</h1>
        <p>${escapeHtml(copy.heroLead)}</p>
        <div class="home-hero-actions">
          ${captureButton(copy.primaryCta, "home-primary-button", "top_capture")}
          <a class="home-secondary-link" href="${escapeHtml(placeHref)}" data-kpi-event="top_place_tap" data-kpi-action="top_place">${escapeHtml(copy.secondaryCta)}</a>
        </div>
      </div>
      ${slot("guest-hero", `<div class="home-guest-hero-visual">${renderGuestProof(options, publicItems)}</div>`)}
    </section>
    <section class="home-section home-category-section">
      <div class="home-section-heading"><h2>${escapeHtml(copy.categoriesTitle)}</h2></div>
      <ul>${categoryItems}</ul>
    </section>
    <section class="home-section home-value-section"><h2>${escapeHtml(copy.flowTitle)}</h2><ol>${flowItems}</ol></section>
    <section class="home-section home-place-section" id="home-places">
      ${placeVisual}
      <div><span class="home-product-kicker">PLACE</span><h2>${escapeHtml(copy.placesTitle)}</h2><p>${escapeHtml(copy.placesBody)}</p><a class="home-secondary-button" href="${escapeHtml(placeHref)}" data-kpi-event="top_place_tap" data-kpi-action="top_place_section">${escapeHtml(copy.secondaryCta)}</a></div>
    </section>
    <section class="home-section home-privacy-section"><span class="home-privacy-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span><div><h2>${escapeHtml(copy.privacyTitle)}</h2><p>${escapeHtml(copy.privacyBody)}</p></div></section>
    <section class="home-section home-final-section"><h2>${escapeHtml(copy.finalTitle)}</h2>${captureButton(copy.finalCta, "home-secondary-button", "top_capture_final")}</section>
    <p class="home-operator-statement">${escapeHtml(options.copy.home.shared.operatorStatement)}</p>
  </div>`;
}

type HomePreviewPolicy = "photo" | "photo_without_place" | "masked" | "excluded";

function homePreviewPolicy(item: LandingObservation): HomePreviewPolicy {
  if (item.publicFeedGateStatus === "blocked_public" || item.publicLocation?.scope === "blurred") return "excluded";
  if (!item.photoUrl) return "masked";
  if (item.publicFeedEligible === false) return "photo_without_place";
  const place = String(item.publicLocation?.label || item.municipality || "").trim();
  return place ? "photo" : "photo_without_place";
}

type MemberP0Copy = LandingStrings["home"]["member"]["p0"];

function fillHomeTemplate(template: string, key: "count" | "focus", value: string): string {
  return template.replace(`{${key}}`, value);
}

function homeDateLocale(lang: SiteLang): string {
  return ({ ja: "ja-JP", en: "en-US", es: "es-ES", "pt-BR": "pt-BR" } as const)[lang];
}

function homeSeasonKey(value: string): string {
  const calendarMonth = value.match(/^\d{4}-(\d{2})/u);
  if (calendarMonth) {
    const month = Number(calendarMonth[1]);
    if (month >= 1 && month <= 12) return String(Math.floor((month - 1) / 3));
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return String(Math.floor(date.getUTCMonth() / 3));
}

function homePlaceKey(item: LandingObservation): string {
  if (homePreviewPolicy(item) !== "photo") return "";
  const fieldId = item.fieldRefs?.find((field) => field.fieldId)?.fieldId;
  return fieldId ? `field:${fieldId}` : "";
}

function sameHomePlace(left: LandingObservation, right: LandingObservation): boolean {
  const leftKey = homePlaceKey(left);
  return Boolean(leftKey) && leftKey === homePlaceKey(right);
}

function observationMatchesPlace(item: LandingObservation, place: HomePlace): boolean {
  return item.fieldRefs?.some((field) => field.fieldId === place.placeId) === true;
}

function renderPlaceChangeCard(
  options: LandingHomeStateOptions,
  place: HomePlace,
  ownItems: LandingObservation[],
  p0: MemberP0Copy,
): string {
  const record = ownItems.find((item) => observationMatchesPlace(item, place) && homePreviewPolicy(item) !== "excluded") ?? null;
  const cardHref = record ? detailHref(options, record) : href(options, "/records?view=mine");
  const dates = [place.previousObservedAt, place.lastObservedAt]
    .map((value) => formatShortDate(value, homeDateLocale(options.lang)))
    .filter(Boolean);
  const comparison = dates.length >= 2
    ? dates.join(" → ")
    : fillHomeTemplate(p0.comparableRecordsTemplate, "count", String(place.visitCount));
  return `<a class="home-place-change-card" href="${escapeHtml(cardHref)}" data-home-place-change="${escapeHtml(place.placeId)}">
    ${record ? renderMedia(record, options.copy) : ""}
    <span class="home-place-change-copy"><strong>${escapeHtml(place.placeName)}</strong>${place.municipality ? `<span>${escapeHtml(place.municipality)}</span>` : ""}<small>${escapeHtml(comparison)}</small></span>
  </a>`;
}

function renderHomeContinuationScript(viewerUserId: string): string {
  return `<script>
(() => {
  const member = document.querySelector('[data-home-view="member"][data-home-draft-owner]');
  const draftState = member && member.querySelector('[data-home-primary-state="draft_resume"]');
  if (!member || !draftState || !('indexedDB' in window)) return;
  const ownerId = ${JSON.stringify(viewerUserId)};
  if (!ownerId || member.getAttribute('data-home-draft-owner') !== ownerId) return;
  try {
    const request = indexedDB.open('ikimon-record-draft', 1);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('drafts')) { db.close(); return; }
      const tx = db.transaction('drafts', 'readonly');
      const getRequest = tx.objectStore('drafts').get('latest:user:' + ownerId);
      getRequest.onsuccess = () => {
        const draft = getRequest.result;
        const files = draft && Array.isArray(draft.files) ? draft.files : [];
        const owned = draft && draft.ownerKey === 'user:' + ownerId;
        if (!owned || !(draft.file || files.length > 0 || (draft.metadata && draft.metadata.formValues))) return;
        member.querySelectorAll('[data-home-primary-state]').forEach((state) => {
          state.hidden = state !== draftState;
          state.setAttribute('data-home-primary-active', state === draftState ? 'true' : 'false');
        });
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
  const p0 = copy.p0;
  const safeItems = ownItems.filter((item) => homePreviewPolicy(item) !== "excluded");
  const memory = safeItems[0] ?? null;
  const hasPrivateHistory = !memory && ownItems.length > 0;
  const baseState = memory || hasPrivateHistory ? "recent_memory" : "first_record";
  const baseHero = (() => {
    if (memory) {
      const policy = homePreviewPolicy(memory);
      const meta = [dateLabel(memory, options.lang), policy === "photo" ? safePlace(memory, options.copy) : ""].filter(Boolean).join(" · ");
      return `<section class="home-member-primary is-memory${memory.photoUrl ? " has-photo" : ""}" data-home-primary-state="recent_memory" data-home-primary-active="true" data-home-record-id="${escapeHtml(observationKey(memory))}">
        <a class="home-member-primary-media" href="${escapeHtml(detailHref(options, memory))}" aria-label="${escapeHtml(copy.memoryCta)}">${renderMedia(memory, options.copy, true)}</a>
        <div class="home-member-primary-copy">
          <span class="home-member-eyebrow">${escapeHtml(copy.memoryEyebrow)}</span>
          <h1>${escapeHtml(displayName(memory, options.copy))}</h1>
          ${meta ? `<p class="home-member-meta">${escapeHtml(meta)}</p>` : ""}
          <p>${escapeHtml(copy.memoryLead)}</p>
          <a class="home-primary-button" href="${escapeHtml(detailHref(options, memory))}" data-kpi-action="home_memory_open">${escapeHtml(copy.memoryCta)}</a>
        </div>
      </section>`;
    }
    if (hasPrivateHistory) {
      return `<section class="home-member-primary is-private-memory" data-home-primary-state="recent_memory" data-home-primary-active="true">
        <div class="home-member-primary-copy">
          <span class="home-member-eyebrow">${escapeHtml(copy.memoryEyebrow)}</span>
          <h1>${escapeHtml(copy.recentTitle)}</h1>
          <p>${escapeHtml(copy.memoryLead)}</p>
          <a class="home-primary-button" href="${escapeHtml(href(options, "/records?view=mine"))}" data-kpi-action="home_memory_open">${escapeHtml(copy.memoryCta)}</a>
        </div>
      </section>`;
    }
    return `<section class="home-member-primary is-first" data-home-primary-state="first_record" data-home-primary-active="true">
      <div class="home-member-primary-copy">
        <span class="home-product-kicker">ZUKAN</span>
        <h1>${escapeHtml(copy.emptyTitle)}</h1>
        <p>${escapeHtml(copy.emptyBody)}</p>
        <div class="home-empty-actions">
          ${captureButton(copy.primaryCta, "home-primary-button", "home_empty_capture")}
          ${galleryButton(copy.galleryCta, "home-secondary-button")}
        </div>
        <a class="home-secondary-link" href="${escapeHtml(href(options, "/map?tab=places"))}" data-kpi-event="top_place_tap" data-kpi-action="home_empty_place">${escapeHtml(copy.emptyPlaceCta)}</a>
      </div>
    </section>`;
  })();
  const recentItems = memory ? safeItems.slice(1, 5) : safeItems.slice(0, 4);
  const recentSection = recentItems.length > 0
    ? `<section class="home-section home-recent-section"><div class="home-section-heading"><h2>${escapeHtml(copy.recentTitle)}</h2><a href="${escapeHtml(href(options, "/records?view=mine"))}">${escapeHtml(copy.recentCta)}</a></div><div class="home-recent-grid">${recentItems.map((item) => renderRecentCard(options, item)).join("")}</div></section>`
    : "";
  const recentKeys = new Set([memory, ...recentItems].filter((item): item is LandingObservation => Boolean(item)).map(observationKey));
  const pastPool = safeItems.filter((item) => !recentKeys.has(observationKey(item)));
  const samePlaceItems = memory ? pastPool.filter((item) => sameHomePlace(memory, item)) : [];
  const memorySeason = memory ? homeSeasonKey(memory.observedAt) : "";
  const sameSeasonItems = memorySeason
    ? pastPool.filter((item) => homeSeasonKey(item.observedAt) === memorySeason)
    : [];
  const pastItems = (samePlaceItems.length > 0 ? samePlaceItems : sameSeasonItems).slice(0, 4);
  const pastTitle = samePlaceItems.length > 0 ? p0.samePlaceTitle : p0.sameSeasonTitle;
  const pastSection = pastItems.length > 0
    ? `<section class="home-section home-past-section"><h2>${escapeHtml(pastTitle)}</h2><div class="home-recent-grid">${pastItems.map((item) => renderRecentCard(options, item)).join("")}</div></section>`
    : "";
  const changePlaces = options.snapshot.myPlaces
    .filter((place) => Boolean(place.previousObservedAt) || place.visitCount > 1)
    .slice(0, 4);
  const placesSection = changePlaces.length > 0
    ? `<section class="home-section home-places-section"><div class="home-section-heading"><h2>${escapeHtml(p0.placeChangesTitle)}</h2><a href="${escapeHtml(href(options, "/map?tab=places"))}">${escapeHtml(copy.placesCta)}</a></div><div class="home-place-change-grid">${changePlaces.map((place) => renderPlaceChangeCard(options, place, safeItems, p0)).join("")}</div></section>`
    : "";
  const nextPlace = options.snapshot.myPlaces.find((place) => Boolean(place.nextLookFor || place.revisitReason))
    ?? changePlaces[0]
    ?? null;
  const nextFocus = nextPlace ? pickPlaceFocus(nextPlace) : null;
  const nextSection = nextPlace
    ? `<section class="home-section home-next-section" data-home-next-action>
        <h2>${escapeHtml(p0.nextActionTitle)}</h2>
        <div class="home-next-action-card">
          <span><strong>${escapeHtml(nextPlace.placeName)}</strong><small>${escapeHtml(nextFocus ? fillHomeTemplate(p0.nextFocusTemplate, "focus", nextFocus) : p0.nextFallback)}</small></span>
          <a href="${escapeHtml(buildPlaceRecordHref(options.basePath, options.lang, options.snapshot.viewerUserId, nextPlace))}" data-kpi-event="capture_nav_tap" data-kpi-action="home_place_revisit">${escapeHtml(p0.captureNow)}</a>
        </div>
      </section>`
    : "";
  const viewerUserId = options.snapshot.viewerUserId ?? "";
  return `<div class="home-state-view is-member" data-home-view="member" data-home-draft-owner="${escapeHtml(viewerUserId)}" data-home-base-state="${baseState}"${options.isLoggedIn ? "" : " hidden"}>
    <section class="home-member-primary is-draft" data-home-primary-state="draft_resume" data-home-primary-active="false" hidden>
      <div class="home-member-primary-copy"><span class="home-member-eyebrow">${escapeHtml(copy.continuationTitle)}</span><h1>${escapeHtml(copy.continuationTitle)}</h1><p>${escapeHtml(copy.continuationBody)}</p><a class="home-primary-button" href="${escapeHtml(href(options, "/record?draft=1&source=home_continue"))}">${escapeHtml(copy.continuationCta)}</a></div>
    </section>
    ${sectionSlot("member-primary", baseHero)}
    ${renderHomeContinuationScript(viewerUserId)}
    ${sectionSlot("member-recent", recentSection)}
    ${sectionSlot("member-discovery", pastSection)}
    ${sectionSlot("member-place", placesSection)}
    ${sectionSlot("member-next", nextSection)}
    <p class="home-operator-statement">${escapeHtml(options.copy.home.shared.operatorStatement)}</p>
  </div>`;
}

export function renderLandingHomeState(options: LandingHomeStateOptions): { heroHtml: string; bodyHtml: string } {
  const ownItems = unique(options.snapshot.myFeed.filter((item) => item.entryType !== "identification"));
  const ownKeys = new Set(ownItems.map(observationKey));
  const publicItems = unique(
    [...(options.snapshot.publicProofFeed || []), ...options.snapshot.feed]
      .filter((item) => isGuestVisibleRecord(item) && !ownKeys.has(observationKey(item))),
  );
  return {
    heroHtml: `<div class="home-state-root" data-home-contract="state-split-v1" data-home-auth-state="${options.isLoggedIn ? "member" : "guest"}">${renderGuest(options, publicItems)}`,
    bodyHtml: `${renderMember(options, ownItems)}</div>`,
  };
}

export const LANDING_HOME_STATE_STYLES = `
body{background:#fff;color:#17211b}.shell.shell-bleed.prototype-shell{box-sizing:border-box;width:min(100%,1240px);min-width:0;max-width:none;margin:0 auto;padding:0 20px 80px;color:#17211b}.site-header-home{background:rgba(255,255,255,.88);border-bottom:1px solid rgba(20,63,46,.08)}.site-header-home .site-header-inner{min-height:64px}.site-header-home .brand-logo-lockup{background:transparent!important}.site-header-home .brand-mark{box-shadow:none}.site-header-home .brand-wordmark{height:18px;aspect-ratio:auto}.home-header-actions{margin-left:auto;align-items:center;gap:6px}.site-header-home[data-home-auth-state=guest] .home-header-actions.is-guest,.site-header-home[data-home-auth-state=member] .home-header-actions.is-member{display:flex}.site-header-home[data-home-auth-state=guest] .home-header-actions.is-member,.site-header-home[data-home-auth-state=member] .home-header-actions.is-guest{display:none}.home-header-login{min-width:72px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;color:#143f2e;font-weight:800;text-decoration:none}.site-header-home .site-account-icon,.site-header-home .site-notification-trigger{min-width:44px;min-height:44px}.home-state-root{min-width:0;--home-green:#143f2e;--home-green-dark:#0d3223;--home-leaf:#76a455;--home-yellow:#ebb72f;--home-border:#e6e9e6;--home-muted:#69716c}.home-state-root :where(p,small,.home-card-copy strong){overflow-wrap:anywhere}.home-state-view[hidden]{display:none!important}.home-state-view{display:grid;min-width:0;gap:64px;padding:24px 0 56px}.home-section{display:grid;gap:20px;min-width:0}.home-section h2,.home-member-primary h1{margin:0;font-size:clamp(1.3rem,4.8vw,2rem);line-height:1.28;letter-spacing:-.03em}.home-product-kicker{color:var(--home-green);font-size:.75rem;font-weight:900;letter-spacing:.18em}.home-guest-hero{display:grid;min-width:0;gap:30px;min-height:min(78svh,760px);align-content:center}.home-guest-hero-copy{display:grid;min-width:0;gap:20px}.home-guest-hero h1{min-width:0;max-width:11em;margin:0;font-size:clamp(2.4rem,9vw,5.25rem);line-height:1.08;letter-spacing:-.06em;text-wrap:balance;overflow-wrap:break-word;word-break:normal}.home-hero-phrase{display:inline-block;max-width:100%}.home-guest-hero p,.home-member-primary p,.home-place-section p{max-width:42rem;margin:0;color:var(--home-muted);font-size:1rem;line-height:1.8}.home-guest-hero-visual{min-width:0}.home-guest-proof{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-template-rows:repeat(2,minmax(150px,1fr));gap:8px;min-height:450px;overflow:hidden;border-radius:28px;background:#edf1ed}.home-guest-proof-item{position:relative;display:block;overflow:hidden;min-width:0;color:#fff;background:#dfe7e1}.home-guest-proof-item img{width:100%;height:100%;display:block;object-fit:cover;transition:transform .35s ease}.home-guest-proof-item:hover img{transform:scale(1.018)}.home-guest-proof-item.is-item-1{grid-column:span 7;grid-row:span 2}.home-guest-proof-item.is-item-2,.home-guest-proof-item.is-item-3{grid-column:span 5}.home-guest-proof-item.is-item-4,.home-guest-proof-item.is-item-5{display:none}.home-guest-proof-caption{position:absolute;inset:auto 0 0;display:grid;gap:3px;padding:34px 16px 14px;background:linear-gradient(180deg,transparent,rgba(7,24,16,.74));text-shadow:0 1px 3px rgba(0,0,0,.28)}.home-guest-proof-caption strong{font-size:.94rem}.home-guest-proof-caption small{font-size:.76rem;color:rgba(255,255,255,.84)}.home-guest-proof.is-empty{display:grid;place-items:center;align-content:center;gap:16px;background:radial-gradient(circle at 62% 42%,rgba(235,183,47,.17),transparent 18%),linear-gradient(145deg,#edf4ee,#f7f8f4)}.home-guest-proof.is-empty img{width:min(38%,220px);height:auto}.home-guest-proof.is-empty span{color:var(--home-green);font-weight:800}.home-card-media{position:relative;display:grid;place-items:center;overflow:hidden;aspect-ratio:4/3;border-radius:16px;background:#edf1ed;color:var(--home-green-dark)}.home-card-media img{width:100%;height:100%;object-fit:cover}.home-card-media.is-empty{gap:8px;align-content:center;min-height:174px}.home-empty-media-icon svg{width:42px;height:42px}.home-card-media svg{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.home-media-affordance,.home-media-count{position:absolute;display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border-radius:999px;background:rgba(18,28,22,.78);color:#fff;font-size:.75rem;font-weight:750}.home-media-affordance{inset:auto auto 10px 10px}.home-media-affordance svg{width:18px;height:18px}.home-media-count{inset:10px 10px auto auto}.home-card-copy{display:grid;gap:4px;padding:0 2px}.home-card-copy strong{font-size:.95rem;line-height:1.42}.home-card-copy span{color:var(--home-muted);font-size:.79rem;line-height:1.45}.home-hero-actions{display:flex;flex-wrap:wrap;align-items:center;gap:12px 20px}.home-primary-button,.home-secondary-button{min-height:52px;display:inline-flex;align-items:center;justify-content:center;padding:0 24px;border-radius:999px;text-decoration:none;font:inherit;font-size:.96rem;font-weight:850;cursor:pointer}.home-primary-button{border:0;background:var(--home-green);color:#fff}.home-primary-button:hover{background:var(--home-green-dark)}.home-secondary-button{min-height:48px;border:1px solid var(--home-green);color:var(--home-green);background:#fff}.home-secondary-link{min-height:44px;display:inline-flex;align-items:center;color:var(--home-green-dark);font-weight:750;text-underline-offset:4px}.home-category-section ul{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0;margin:0;padding:0;list-style:none;border-top:1px solid var(--home-border)}.home-category-section li{display:grid;grid-template-columns:42px minmax(0,1fr);gap:12px;padding:22px 12px 22px 0;border-bottom:1px solid var(--home-border)}.home-category-index{color:var(--home-leaf);font-size:.75rem;font-weight:900;letter-spacing:.08em}.home-category-section li>span:last-child{display:grid;gap:6px}.home-category-section small{color:var(--home-muted);font-size:.88rem;line-height:1.6}.home-value-section ol{display:grid;gap:0;margin:0;padding:0;list-style:none;border-top:1px solid var(--home-border)}.home-value-section li{display:grid;grid-template-columns:44px minmax(0,1fr);gap:12px;align-items:start;padding:21px 0;border-bottom:1px solid var(--home-border)}.home-value-icon{width:34px;height:34px;display:grid;place-items:center;border:1px solid rgba(20,63,46,.18);border-radius:50%;color:var(--home-green);font-weight:850}.home-value-section li span:last-child{display:grid;gap:5px}.home-value-section small{color:var(--home-muted);font-size:.875rem;line-height:1.65}.home-place-section{overflow:hidden;padding:0;border:1px solid var(--home-border);border-radius:26px;background:#fff}.home-place-visual{display:block;min-width:0}.home-place-visual .home-card-media{height:100%;min-height:260px;aspect-ratio:16/10;border-radius:0}.home-place-visual.is-placeholder{min-height:260px;display:grid;place-items:center;background:radial-gradient(circle at 60% 45%,rgba(235,183,47,.13),transparent 18%),#eef4ef}.home-place-visual.is-placeholder img{width:min(34%,180px);height:auto}.home-place-section>div:last-child{display:grid;align-content:center;justify-items:start;gap:13px;padding:26px}.home-privacy-section{grid-template-columns:44px minmax(0,1fr);gap:14px;padding:24px 0;border-top:1px solid var(--home-border);border-bottom:1px solid var(--home-border)}.home-privacy-icon{width:44px;height:44px;display:grid;place-items:center;color:var(--home-green-dark)}.home-privacy-icon svg{width:28px;fill:none;stroke:currentColor;stroke-width:1.8}.home-privacy-section div{display:grid;gap:8px}.home-privacy-section p{margin:0;color:var(--home-muted);font-size:.9375rem;line-height:1.7}.home-final-section{justify-items:start;padding:0 0 16px}.home-member-primary{display:grid;min-width:0;gap:0;overflow:hidden;border:1px solid var(--home-border);border-radius:28px;background:#fff}.home-member-primary[hidden]{display:none!important}.home-member-primary-media{display:block;min-width:0;color:inherit;text-decoration:none}.home-member-primary-media .home-card-media{aspect-ratio:16/10;border-radius:0}.home-member-primary-copy{display:grid;min-width:0;align-content:center;justify-items:start;gap:11px;padding:26px}.home-member-primary-copy .home-primary-button{margin-top:5px}.home-empty-actions{width:100%;display:grid;grid-template-columns:minmax(0,1fr);gap:10px;margin-top:5px}.home-empty-actions .home-primary-button,.home-empty-actions .home-secondary-button{width:100%;margin:0}.home-member-eyebrow{color:var(--home-green);font-size:.76rem;font-weight:900;letter-spacing:.1em}.home-member-meta{font-size:.84rem!important}.home-member-primary.is-draft{border-color:rgba(235,183,47,.45);background:#fffdf6}.home-member-primary.is-first,.home-member-primary.is-private-memory{padding:clamp(28px,6vw,64px);background:radial-gradient(circle at 82% 26%,rgba(118,164,85,.13),transparent 28%),#fafbf8}.home-member-primary.is-first .home-member-primary-copy,.home-member-primary.is-private-memory .home-member-primary-copy{padding:0;max-width:620px}.home-recent-grid,.home-place-change-grid{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(188px,72vw);gap:10px;overflow-x:auto;overscroll-behavior-inline:contain;scroll-snap-type:x proximity;padding:0 1px 10px;scrollbar-width:none}.home-recent-grid::-webkit-scrollbar,.home-place-change-grid::-webkit-scrollbar{display:none}.home-recent-card,.home-place-change-card{display:grid;align-content:start;gap:11px;min-width:0;color:inherit;text-decoration:none;scroll-snap-align:start}.home-recent-card .home-card-media{aspect-ratio:1/1;border-radius:15px}.home-place-change-card{overflow:hidden;border:1px solid var(--home-border);border-radius:17px;background:#fff}.home-place-change-card .home-card-media{aspect-ratio:4/3;border-radius:0}.home-place-change-copy{display:grid;gap:4px;padding:0 14px 14px}.home-place-change-copy span,.home-place-change-copy small{color:var(--home-muted);font-size:.79rem;line-height:1.45}.home-section-heading{display:flex;align-items:end;justify-content:space-between;gap:16px}.home-section-heading a{min-height:44px;display:inline-flex;align-items:center;color:var(--home-green-dark);font-weight:750}.home-next-action-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:center;padding:20px 0;border-top:1px solid var(--home-border);border-bottom:1px solid var(--home-border)}.home-next-action-card>span{display:grid;gap:5px}.home-next-action-card small{color:var(--home-muted);font-size:.875rem;line-height:1.5}.home-next-action-card a{min-height:46px;display:inline-flex;align-items:center;justify-content:center;padding:0 18px;border:1px solid var(--home-green);border-radius:999px;color:var(--home-green-dark);font-weight:850;text-decoration:none}.home-state-root :is(a,button):focus-visible{outline:3px solid var(--home-yellow);outline-offset:3px}.home-state-root :is(a,button){touch-action:manipulation}@supports(word-break:auto-phrase){html[lang=ja] .home-state-root :is(h1,h2,p,small){word-break:auto-phrase}}@media(prefers-reduced-motion:reduce){.home-state-root *{scroll-behavior:auto!important;transition:none!important}}@media(min-width:768px){.shell.shell-bleed.prototype-shell{padding-inline:32px}.home-state-view{gap:84px}.home-category-section ul{grid-template-columns:repeat(4,minmax(0,1fr))}.home-category-section li{grid-template-columns:1fr;gap:16px;padding:24px 22px 24px 0}.home-value-section ol{grid-template-columns:repeat(3,1fr);gap:28px;border:0}.home-value-section li{grid-template-columns:44px 1fr;border:0;padding:16px 0}.home-place-section{grid-template-columns:minmax(0,1.18fr) minmax(300px,.82fr)}.home-place-section>div:last-child{padding:36px}.home-member-primary.is-memory{grid-template-columns:minmax(380px,1.2fr) minmax(320px,.8fr);align-items:stretch}.home-member-primary-media .home-card-media{height:100%;min-height:430px}.home-member-primary-copy{padding:36px}.home-member-primary-copy .home-primary-button{width:auto;min-width:180px}.home-empty-actions{grid-template-columns:repeat(2,minmax(0,220px))}.home-empty-actions .home-primary-button,.home-empty-actions .home-secondary-button{width:100%;min-width:0}.home-recent-grid{grid-auto-flow:initial;grid-auto-columns:auto;grid-template-columns:repeat(4,minmax(0,1fr));overflow:visible;padding-bottom:0}.home-place-change-grid{grid-auto-flow:initial;grid-auto-columns:auto;grid-template-columns:repeat(4,minmax(0,1fr));overflow:visible;padding-bottom:0}}@media(min-width:960px){.home-guest-hero.has-visual{grid-template-columns:minmax(0,.78fr) minmax(520px,1.22fr);align-items:center;gap:58px}.home-guest-proof-item.is-item-1{grid-column:span 7}.home-guest-proof-item.is-item-2,.home-guest-proof-item.is-item-3{grid-column:span 5}.home-guest-proof.is-count-4 .is-item-2,.home-guest-proof.is-count-5 .is-item-2{grid-column:span 3}.home-guest-proof.is-count-4 .is-item-3,.home-guest-proof.is-count-5 .is-item-3{grid-column:span 2}.home-guest-proof-item.is-item-4,.home-guest-proof-item.is-item-5{display:block;grid-column:span 5}.home-guest-proof.is-count-5 .is-item-4,.home-guest-proof.is-count-5 .is-item-5{grid-column:span 2}}@media(min-width:1180px){.home-state-view{padding-top:38px}.home-guest-hero{min-height:720px}.home-privacy-section{padding:30px 8px}}@media(max-width:560px){.home-guest-proof{min-height:390px;grid-template-rows:repeat(2,minmax(120px,1fr))}.home-guest-proof-item.is-item-1{grid-column:span 8}.home-guest-proof-item.is-item-2,.home-guest-proof-item.is-item-3{grid-column:span 4}.home-next-action-card{grid-template-columns:1fr}.home-next-action-card a{width:100%}}@media(max-width:359px){.shell.shell-bleed.prototype-shell{padding-inline:14px}.home-guest-hero h1{font-size:2.05rem}.home-category-section ul{grid-template-columns:1fr}.home-privacy-section{grid-template-columns:1fr}.home-privacy-icon{width:36px;height:36px}.home-card-copy strong{font-size:.9rem}}
.home-guest-proof.is-count-0{grid-template-columns:1fr;grid-template-rows:1fr}.home-guest-proof.is-empty p{max-width:24rem;margin:0;padding:0 20px;color:var(--home-green);font-weight:800;text-align:center}.home-operator-statement{margin:0;color:var(--home-muted);font-size:.75rem;line-height:1.65}
@media(max-width:959px){.home-guest-proof-item.is-item-4,.home-guest-proof-item.is-item-5{display:block}.home-guest-proof.is-count-1,.home-guest-proof.is-count-2{grid-template-rows:minmax(260px,1fr)}.home-guest-proof.is-count-1 .is-item-1{grid-column:1/13;grid-row:1/2}.home-guest-proof.is-count-2 .is-item-1{grid-column:1/7;grid-row:1/2}.home-guest-proof.is-count-2 .is-item-2{grid-column:7/13;grid-row:1/2}.home-guest-proof.is-count-3{grid-template-rows:repeat(2,minmax(120px,1fr))}.home-guest-proof.is-count-3 .is-item-1{grid-column:1/9;grid-row:1/3}.home-guest-proof.is-count-3 .is-item-2{grid-column:9/13;grid-row:1/2}.home-guest-proof.is-count-3 .is-item-3{grid-column:9/13;grid-row:2/3}.home-guest-proof.is-count-4,.home-guest-proof.is-count-5{grid-template-rows:repeat(3,minmax(100px,1fr))}.home-guest-proof.is-count-4 .is-item-1,.home-guest-proof.is-count-5 .is-item-1{grid-column:1/9;grid-row:1/3}.home-guest-proof.is-count-4 .is-item-2,.home-guest-proof.is-count-5 .is-item-2{grid-column:9/13;grid-row:1/2}.home-guest-proof.is-count-4 .is-item-3,.home-guest-proof.is-count-5 .is-item-3{grid-column:9/13;grid-row:2/3}.home-guest-proof.is-count-4 .is-item-4{grid-column:1/13;grid-row:3/4}.home-guest-proof.is-count-5 .is-item-4{grid-column:1/7;grid-row:3/4}.home-guest-proof.is-count-5 .is-item-5{grid-column:7/13;grid-row:3/4}}
@media(min-width:960px){.home-guest-proof.is-count-1 .is-item-1{grid-column:1/13;grid-row:1/3}.home-guest-proof.is-count-2 .is-item-1{grid-column:1/7;grid-row:1/3}.home-guest-proof.is-count-2 .is-item-2{grid-column:7/13;grid-row:1/3}.home-guest-proof.is-count-3 .is-item-1{grid-column:1/8;grid-row:1/3}.home-guest-proof.is-count-3 .is-item-2{grid-column:8/13;grid-row:1/2}.home-guest-proof.is-count-3 .is-item-3{grid-column:8/13;grid-row:2/3}.home-guest-proof.is-count-4 .is-item-1,.home-guest-proof.is-count-5 .is-item-1{grid-column:1/7;grid-row:1/3}.home-guest-proof.is-count-4 .is-item-2,.home-guest-proof.is-count-5 .is-item-2{grid-column:7/10;grid-row:1/2}.home-guest-proof.is-count-4 .is-item-3,.home-guest-proof.is-count-5 .is-item-3{grid-column:10/13;grid-row:1/2}.home-guest-proof.is-count-4 .is-item-4{grid-column:7/13;grid-row:2/3}.home-guest-proof.is-count-5 .is-item-4{grid-column:7/10;grid-row:2/3}.home-guest-proof.is-count-5 .is-item-5{grid-column:10/13;grid-row:2/3}}
.site-header-home{border-bottom-color:rgba(15,74,47,.08)}.home-header-login{color:#0F4A2F}.home-state-root{--home-green:#0F4A2F;--home-green-dark:#0B3D27;--home-yellow:#C9A227}.home-value-icon{border-color:rgba(15,74,47,.18)}.home-guest-proof.is-empty{background:radial-gradient(circle at 62% 42%,rgba(201,162,39,.17),transparent 18%),linear-gradient(145deg,#edf4ee,#f7f8f4)}.home-place-visual.is-placeholder{background:radial-gradient(circle at 60% 45%,rgba(201,162,39,.13),transparent 18%),#eef4ef}.home-member-primary.is-draft{border-color:rgba(201,162,39,.45)}
`;
