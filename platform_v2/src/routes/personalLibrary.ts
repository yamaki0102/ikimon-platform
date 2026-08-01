import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "../i18n.js";
import { getSessionFromCookie } from "../services/authSession.js";
import { buildObservationDetailPath } from "../services/observationDetailLink.js";
import { resolveViewer } from "../services/viewerIdentity.js";
import { getLandingOwnFeedPage, getLandingSnapshot, type LandingFeedPage } from "../services/landingSnapshot.js";
import { formatActorDisplay, formatIdentificationCount, formatPlaceDisplay, formatTaxonDisplayName } from "../services/localizedDisplay.js";
import { toThumbnailUrl } from "../services/thumbnailUrl.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";
import { RECORD_CARD_SIZING_TOKENS } from "../ui/recordCardSizing.js";
import { civicContextLabel, listCivicObservationContexts, type CivicObservationContext } from "../services/civicNatureContext.js";
import { getObservationListPage, getObservationListSnapshot, type ObservationListSnapshot, type LandingObservation, type LandingSnapshot } from "../services/readModels.js";
import { listReferenceCandidatesForIdentification, type ReferenceCandidate } from "../services/referenceLibrary.js";
import { listHeldIdentificationOccurrenceIds } from "../services/identificationWorkbenchHolds.js";
import { formatShortDate, pickPlaceFocus } from "../ui/placeRevisit.js";
import { type ProfileNoteDigest } from "../services/profileNoteDigest.js";
import {
  buildPlaceNextLine,
  formatNotesNumber,
  formatProfileNumber,
  notesItemCountLabel,
  notesPhotoAltIndex,
  notesPhotoCountLabel,
  notesLibraryCopy,
  observationIndexCopy,
  type RecordsWorkbenchCopy,
  type RecordsWorkbenchView,
} from "./personalLibraryCopy.js";

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

function isWeakIdentificationCandidateName(value: string | null | undefined): boolean {
  const text = String(value ?? "").trim();
  if (!text) return true;
  return /未同定|同定待ち|名前待ち|AI\s*候補|他の植栽|複数の低木|植栽低木|構成種[:：]|不明|群落|グランドカバー|背景|周囲|裸地|踏圧|芝生|芝地|lawn|turf|grassland/iu.test(text);
}

function notesEntryDate(obs: LandingObservation): string {
  return (obs.entryType === "identification" ? obs.identifiedAt : obs.observedAt) ?? obs.observedAt;
}

function notesEntryKind(obs: LandingObservation, lang: SiteLang = "ja"): string {
  if (lang === "ja") return obs.entryType === "identification" ? "同定メモ" : "観察ページ";
  if (lang === "es") return obs.entryType === "identification" ? "Nota de ID" : "Página de observación";
  if (lang === "pt-BR") return obs.entryType === "identification" ? "Nota de ID" : "Página de observação";
  return obs.entryType === "identification" ? "ID note" : "Observation page";
}

function notesDetailHref(basePath: string, lang: SiteLang, obs: LandingObservation): string {
  return appendLangToHref(
    withBasePath(
      basePath,
      buildObservationDetailPath(obs.detailId ?? obs.visitId ?? obs.occurrenceId, obs.featuredOccurrenceId ?? obs.occurrenceId),
    ),
    lang,
  );
}

function notesPlaceLine(obs: LandingObservation, lang: SiteLang, locationMode: "owner" | "public"): string {
  return formatPlaceDisplay({
    placeName: obs.placeName,
    municipality: obs.municipality,
    publicLocation: obs.publicLocation,
  }, lang, locationMode);
}

function notesPhotoUrls(obs: LandingObservation, preset: "sm" | "md"): string[] {
  const sourceUrls = Array.isArray(obs.photoUrls) && obs.photoUrls.length > 0
    ? obs.photoUrls
    : (obs.photoUrl ? [obs.photoUrl] : []);
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const sourceUrl of sourceUrls) {
    const url = toThumbnailUrl(sourceUrl, preset) ?? sourceUrl;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

function notesPhotoCount(obs: LandingObservation): number {
  const declared = Number(obs.photoCount ?? 0);
  if (Number.isFinite(declared) && declared > 0) return Math.round(declared);
  return notesPhotoUrls(obs, "sm").length;
}

function renderNotesMiniCard(
  basePath: string,
  lang: SiteLang,
  obs: LandingObservation,
  options: { locationMode: "owner" | "public" },
): string {
  const href = notesDetailHref(basePath, lang, obs);
  const displayName = formatTaxonDisplayName({
    vernacularName: obs.vernacularName,
    scientificName: obs.scientificName,
    displayName: obs.displayName,
    aiCandidateName: obs.aiCandidateName,
    fallback: obs.proposedName ?? "名前を確かめているページ",
  }, lang).primaryLabel;
  const dateLabel = formatShortDate(notesEntryDate(obs), lang === "ja" ? "ja-JP" : "en-US") || notesEntryDate(obs);
  const placeLine = notesPlaceLine(obs, lang, options.locationMode);
  const photoUrls = notesPhotoUrls(obs, "sm");
  const photoCount = notesPhotoCount(obs);
  const entryKind = notesEntryKind(obs, lang);
  const photo = photoUrls[0]
    ? `<span class="notes-thumb"><img src="${escapeHtml(photoUrls[0])}" alt="${escapeHtml(displayName)}" loading="lazy" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><span hidden>${escapeHtml(entryKind.slice(0, 1))}</span>${photoCount > 1 ? `<b class="notes-thumb-count">${escapeHtml(formatNotesNumber(photoCount, lang))}</b>` : ""}</span>`
    : `<span class="notes-thumb notes-thumb-empty">${escapeHtml(entryKind.slice(0, 1))}</span>`;
  const observerLine = obs.observerName ? `${formatActorDisplay(obs.observerName, lang)} · ` : "";
  const needsNameLine = lang === "ja" ? "名前を見返す余地あり" : lang === "es" ? "Nombre por revisar" : lang === "pt-BR" ? "Nome a revisar" : "Name to review";
  const supportLine = obs.entryType === "identification"
    ? `${observerLine}${obs.proposedName ? `${obs.proposedName} · ` : ""}${dateLabel}`
    : `${observerLine}${obs.identificationCount > 0 ? `${formatIdentificationCount(obs.identificationCount, lang)} · ` : `${needsNameLine} · `}${dateLabel}`;
  return `<a class="notes-page-card" href="${escapeHtml(href)}" data-entry-type="${escapeHtml(obs.entryType ?? "observation")}">
    ${photo}
    <span class="notes-page-copy">
      <span class="notes-page-kicker">${escapeHtml(entryKind)}</span>
      <strong>${escapeHtml(displayName)}</strong>
      <span>${escapeHtml(placeLine)}</span>
      <em>${escapeHtml(supportLine)}</em>
    </span>
  </a>`;
}

function notesLibraryMonthKey(obs: LandingObservation): string {
  const date = notesEntryDate(obs);
  return /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : "unknown";
}

function notesLibraryMonthLabel(key: string, lang: SiteLang): string {
  if (key === "unknown") return lang === "ja" ? "日付なし" : "Undated";
  const [year, month] = key.split("-");
  if (lang === "ja") return `${year}年${Number(month)}月`;
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long" }).format(new Date(`${key}-01T00:00:00Z`));
}

function notesLibraryDateLabel(obs: LandingObservation, lang: SiteLang): string {
  return formatShortDate(notesEntryDate(obs), lang === "ja" ? "ja-JP" : "en-US") || notesEntryDate(obs);
}

function recordsPublicCardMetaLine(
  lang: SiteLang,
  args: { observerLine: string; placeLine: string; sourceLabel: string; civicLabel: string; dateLabel: string },
): string {
  const fallbackPlace = notesLibraryCopy(lang).card.fallbackPlace;
  const placeContext = args.placeLine && args.placeLine !== fallbackPlace ? args.placeLine : "";
  const context = args.civicLabel || placeContext || args.sourceLabel;
  return `${args.observerLine}${[context, args.dateLabel].filter(Boolean).join(" · ")}`;
}

function notesLibraryIsUncertain(obs: LandingObservation): boolean {
  const name = (obs.displayName || obs.proposedName || "").trim();
  return obs.isAiCandidate === true
    || obs.identificationCount === 0
    || name === ""
    || name === "同定待ち"
    || /awaiting id|unknown|unresolved/i.test(name);
}

function notesLibrarySourceKind(obs: LandingObservation): NonNullable<LandingObservation["librarySourceKind"]> {
  if (obs.librarySourceKind) return obs.librarySourceKind;
  if (obs.hasVideo) return "video";
  if (notesPhotoCount(obs) > 0) return "photo";
  return "note";
}

function notesLibrarySourceLabel(kind: NonNullable<LandingObservation["librarySourceKind"]>, lang: SiteLang): string {
  return notesLibraryCopy(lang).sourceLabels[kind] ?? notesLibraryCopy(lang).sourceLabels.note;
}

function notesCivicContextLabel(context: CivicObservationContext, lang: SiteLang): string {
  if (context.activityLabel) return context.activityLabel;
  if (lang === "ja") return civicContextLabel(context);
  const labels: Record<Exclude<SiteLang, "ja">, Partial<Record<CivicObservationContext["contextKind"], string>> & { revisit: string; fallback: string }> = {
    en: {
      event: "Event record",
      school: "School/class nature note",
      satoyama: "Management and observation record",
      risk: "Record needing review",
      site_summary: "First nature summary for this place",
      revisit: "Revisit record for this place",
      fallback: "Field note",
    },
    es: {
      event: "Registro de evento",
      school: "Nota natural de escuela/clase",
      satoyama: "Registro de manejo y observación",
      risk: "Registro que necesita revisión",
      site_summary: "Primer resumen natural de este lugar",
      revisit: "Revisita de este lugar",
      fallback: "Nota de campo",
    },
    "pt-BR": {
      event: "Registro de evento",
      school: "Nota de natureza da escola/turma",
      satoyama: "Registro de manejo e observação",
      risk: "Registro que precisa de revisão",
      site_summary: "Primeiro resumo natural deste lugar",
      revisit: "Revisita deste lugar",
      fallback: "Nota de campo",
    },
  };
  const copy = labels[lang];
  if (context.activityIntent === "revisit") return copy.revisit;
  return copy[context.contextKind] ?? copy.fallback;
}

function renderNotesLibraryCard(
  basePath: string,
  lang: SiteLang,
  obs: LandingObservation,
  options: { locationMode: "owner" | "public"; civicContexts?: Map<string, CivicObservationContext> },
): string {
  const copy = notesLibraryCopy(lang);
  const href = notesDetailHref(basePath, lang, obs);
  const canOwnerHide = options.locationMode === "owner" && obs.entryType !== "identification";
  const hideEndpoint = withBasePath(basePath, `/api/v1/observations/${encodeURIComponent(obs.visitId)}/hide`);
  const displayName = formatTaxonDisplayName({
    vernacularName: obs.vernacularName,
    scientificName: obs.scientificName,
    displayName: obs.displayName,
    aiCandidateName: obs.aiCandidateName,
    fallback: obs.proposedName ?? copy.card.fallbackName,
  }, lang).primaryLabel;
  const placeLine = notesPlaceLine(obs, lang, options.locationMode);
  const observerLine = obs.observerName ? `${formatActorDisplay(obs.observerName, lang)} · ` : "";
  const photoUrls = notesPhotoUrls(obs, "md");
  const photoCount = notesPhotoCount(obs);
  const dateLabel = notesLibraryDateLabel(obs, lang);
  const isUncertain = notesLibraryIsUncertain(obs);
  const sourceKind = notesLibrarySourceKind(obs);
  const sourceLabel = notesLibrarySourceLabel(sourceKind, lang);
  const civicContext = options.civicContexts?.get(obs.visitId);
  const civicLabel = civicContext ? notesCivicContextLabel(civicContext, lang) : "";
  const filters = [
    "all",
    sourceKind,
    photoCount > 0 ? "photos" : "no-photo",
    isUncertain ? "uncertain" : "named",
    obs.identificationCount > 0 || obs.entryType === "identification" ? "identified" : "needs-id",
  ].join(" ");
  const searchable = `${displayName} ${placeLine} ${obs.observerName} ${dateLabel} ${sourceLabel} ${civicLabel}`.toLowerCase();
  const visiblePhotos = photoUrls.slice(0, 4);
  const photo = visiblePhotos.length > 1
    ? `<span class="notes-library-photo-stack">${visiblePhotos.map((url, index) => `<img src="${escapeHtml(url)}" alt="${escapeHtml(`${displayName} ${notesPhotoAltIndex(index + 1, lang)}`)}" loading="lazy" decoding="async" onerror="this.remove()" />`).join("")}</span><b class="notes-library-photo-count">${escapeHtml(notesPhotoCountLabel(photoCount, lang))}</b>`
    : visiblePhotos[0]
      ? `<img src="${escapeHtml(visiblePhotos[0])}" alt="${escapeHtml(displayName)}" loading="lazy" decoding="async" onerror="this.closest('.notes-library-card').classList.add('is-photo-missing');this.remove()" />${photoCount > 1 ? `<b class="notes-library-photo-count">${escapeHtml(notesPhotoCountLabel(photoCount, lang))}</b>` : ""}`
    : `<span class="notes-library-placeholder">${escapeHtml(sourceLabel.slice(0, 1))}</span>`;
  const ownerMenu = canOwnerHide
    ? `<details class="notes-library-card-menu">
        <summary aria-label="${escapeHtml(copy.card.menuAria)}"><span aria-hidden="true"></span></summary>
        <div class="notes-library-card-menu-panel">
          <a href="${escapeHtml(href)}">${escapeHtml(copy.card.detail)}</a>
          <button type="button" data-owner-hide-observation data-hide-endpoint="${escapeHtml(hideEndpoint)}">${escapeHtml(copy.card.delete)}</button>
        </div>
      </details>`
    : "";
  return `<article class="notes-library-card is-source-${escapeHtml(sourceKind)}${photoCount > 0 ? "" : " is-photo-missing"}" data-library-card data-filter="${escapeHtml(filters)}" data-search="${escapeHtml(searchable)}">
    <a class="notes-library-card-link" href="${escapeHtml(href)}" aria-label="${escapeHtml(displayName)}">
      <span class="notes-library-photo">${photo}</span>
      <span class="notes-library-overlay">
        <span class="notes-library-badges">
          <b class="notes-source-badge is-source-${escapeHtml(sourceKind)}">${escapeHtml(sourceLabel)}</b>
          ${civicLabel ? `<b class="notes-context-badge">${escapeHtml(civicLabel)}</b>` : ""}
          ${isUncertain ? `<b>${escapeHtml(copy.card.uncertainBadge)}</b>` : `<b>${escapeHtml(copy.card.namedBadge)}</b>`}
          ${obs.identificationCount > 0 ? `<b>${escapeHtml(formatIdentificationCount(obs.identificationCount, lang))}</b>` : ""}
        </span>
        <strong>${escapeHtml(displayName)}</strong>
        <em>${escapeHtml(`${observerLine}${placeLine || copy.card.fallbackPlace} · ${dateLabel}`)}</em>
      </span>
    </a>
    ${ownerMenu}
  </article>`;
}

function renderNotesLibraryMonths(
  basePath: string,
  lang: SiteLang,
  entries: LandingObservation[],
  options: { locationMode: "owner" | "public"; civicContexts?: Map<string, CivicObservationContext>; showMonthCount?: boolean },
): string {
  if (entries.length === 0) {
    return `<div class="notes-library-empty">${escapeHtml(notesLibraryCopy(lang).emptyLibrary)}</div>`;
  }
  const groups = new Map<string, LandingObservation[]>();
  for (const entry of entries) {
    const key = notesLibraryMonthKey(entry);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }
  return Array.from(groups.entries()).map(([key, items]) => `<section class="notes-library-month" data-library-month>
    <div class="notes-library-month-head">
      <h2>${escapeHtml(notesLibraryMonthLabel(key, lang))}</h2>
      ${options.showMonthCount === false ? "" : `<span>${escapeHtml(notesItemCountLabel(items.length, lang))}</span>`}
    </div>
    <div class="notes-library-grid">
      ${items.map((obs) => renderNotesLibraryCard(basePath, lang, obs, options)).join("")}
    </div>
  </section>`).join("");
}

function renderNotesLibraryControls(lang: SiteLang, initialSearch = ""): string {
  const copy = notesLibraryCopy(lang);
  const filterToggleLabel = lang === "ja" ? "絞る" : lang === "en" ? "Filter" : lang === "es" ? "Filtrar" : "Filtrar";
  return `<section class="notes-library-controls" aria-label="${escapeHtml(copy.controls.aria)}">
    <div class="notes-library-search">
      <span aria-hidden="true">⌕</span>
      <label class="sr-only" for="records-library-search">${escapeHtml(copy.controls.searchPlaceholder)}</label>
      <input id="records-library-search" type="search" placeholder="${escapeHtml(copy.controls.searchPlaceholder)}" value="${escapeHtml(initialSearch)}" data-library-search />
    </div>
    <input class="notes-library-filter-toggle" type="checkbox" id="notes-library-filter-toggle" aria-label="${escapeHtml(copy.controls.filterAria)}" />
    <label class="notes-library-filter-label" for="notes-library-filter-toggle">${escapeHtml(filterToggleLabel)}</label>
    <div class="notes-library-filters" role="group" aria-label="${escapeHtml(copy.controls.filterAria)}">
      <button type="button" class="is-active" data-library-filter="all">${escapeHtml(copy.controls.all)}</button>
      <button type="button" data-library-filter="photo">${escapeHtml(copy.controls.photo)}</button>
      <button type="button" data-library-filter="video">${escapeHtml(copy.controls.video)}</button>
      <button type="button" data-library-filter="guide">${escapeHtml(copy.controls.guide)}</button>
      <button type="button" data-library-filter="scan">${escapeHtml(copy.controls.scan)}</button>
      <button type="button" data-library-filter="uncertain">${escapeHtml(copy.controls.uncertain)}</button>
      <button type="button" data-library-filter="identified">${escapeHtml(copy.controls.identified)}</button>
    </div>
  </section>`;
}

function renderNotesLibrarySourceLanes(entries: LandingObservation[], lang: SiteLang): string {
  const counts = new Map<NonNullable<LandingObservation["librarySourceKind"]>, number>();
  for (const entry of entries) {
    const kind = notesLibrarySourceKind(entry);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const lanes: Array<NonNullable<LandingObservation["librarySourceKind"]>> = ["photo", "video", "guide", "scan", "note"];
  const copy = notesLibraryCopy(lang);
  return `<div class="notes-library-source-lanes" aria-label="${escapeHtml(copy.controls.sourceLanesAria)}">
    ${lanes.map((kind) => `<button type="button" class="notes-library-source-lane is-source-${escapeHtml(kind)}" data-library-filter="${escapeHtml(kind)}">
      <span>${escapeHtml(notesLibrarySourceLabel(kind, lang))}</span>
      <strong>${escapeHtml(formatNotesNumber(counts.get(kind) ?? 0, lang))}</strong>
    </button>`).join("")}
  </div>`;
}

function renderNotesLibraryPlaceAlbums(snapshot: LandingSnapshot, lang: SiteLang): string {
  const copy = notesLibraryCopy(lang);
  if (!snapshot.viewerUserId || snapshot.myPlaces.length === 0) {
    return `<section id="notes-places" class="section notes-library-albums" data-testid="notes-places">
      <div class="notes-library-section-head"><div><span>${escapeHtml(copy.sections.placesEyebrow)}</span><h2>${escapeHtml(copy.sections.placesTitle)}</h2></div></div>
      <div class="notes-library-empty">${escapeHtml(copy.sections.placesEmpty)}</div>
    </section>`;
  }
  const albums = snapshot.myPlaces.slice(0, 10).map((place) => {
    const focus = pickPlaceFocus(place);
    return `<button type="button" class="notes-library-album" data-library-place="${escapeHtml(place.placeName)}">
      <span>${escapeHtml(place.municipality || copy.card.fallbackPlace)}</span>
      <strong>${escapeHtml(place.placeName)}</strong>
      <em>${escapeHtml(notesItemCountLabel(place.visitCount, lang))}${focus ? ` · ${escapeHtml(focus)}` : ""}</em>
    </button>`;
  }).join("");
  return `<section id="notes-places" class="section notes-library-albums" data-testid="notes-places">
    <div class="notes-library-section-head"><div><span>${escapeHtml(copy.sections.placesEyebrow)}</span><h2>${escapeHtml(copy.sections.placesTitle)}</h2></div><p>${escapeHtml(copy.sections.placesLead)}</p></div>
    <div class="notes-library-album-row">${albums}</div>
  </section>`;
}

function renderNotesLibraryScript(lang: SiteLang): string {
  const copy = notesLibraryCopy(lang).card;
  return `<script>
(function () {
  const messages = ${JSON.stringify({
    deleteConfirm: copy.deleteConfirm,
    deleting: copy.deleting,
    delete: copy.delete,
    deleteFailedPrefix: copy.deleteFailedPrefix,
  })};
  const root = document.querySelector('[data-notes-library]');
  if (!root) return;
  const search = root.querySelector('[data-library-search]');
  const searchEmpty = root.querySelector('[data-library-search-empty]');
  const count = root.querySelector('[data-library-visible-count]');
  const filterButtons = Array.from(root.querySelectorAll('[data-library-filter]'));
  let activeFilter = 'all';
  function apply() {
    const cards = Array.from(root.querySelectorAll('[data-library-card]'));
    const months = Array.from(root.querySelectorAll('[data-library-month]'));
    const query = search ? String(search.value || '').trim().toLowerCase() : '';
    let visible = 0;
    cards.forEach(function (card) {
      const filters = String(card.getAttribute('data-filter') || '');
      const haystack = String(card.getAttribute('data-search') || '');
      const okFilter = activeFilter === 'all' || filters.split(/\\s+/).indexOf(activeFilter) >= 0;
      const okSearch = !query || haystack.indexOf(query) >= 0;
      const show = okFilter && okSearch && card.getAttribute('data-owner-hidden') !== 'true';
      card.hidden = !show;
      if (show) visible += 1;
    });
    months.forEach(function (month) {
      month.hidden = !month.querySelector('[data-library-card]:not([hidden])');
    });
    if (count) count.textContent = String(visible);
    if (searchEmpty) searchEmpty.hidden = !(query && visible === 0);
  }
  filterButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      activeFilter = button.getAttribute('data-library-filter') || 'all';
      filterButtons.forEach(function (b) { b.classList.toggle('is-active', b === button); });
      apply();
    });
  });
  if (search) search.addEventListener('input', apply);
  document.querySelectorAll('[data-library-place]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (!search) return;
      search.value = button.getAttribute('data-library-place') || '';
      activeFilter = 'all';
      filterButtons.forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-library-filter') === 'all'); });
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
      apply();
    });
  });
  root.addEventListener('toggle', function (event) {
    var target = event.target;
    if (!(target instanceof HTMLDetailsElement) || !target.classList.contains('notes-library-card-menu') || !target.open) return;
    root.querySelectorAll('.notes-library-card-menu[open]').forEach(function (details) {
      if (details !== target) details.removeAttribute('open');
    });
  }, true);
  document.addEventListener('click', function (event) {
    var target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest('.notes-library-card-menu')) return;
    root.querySelectorAll('.notes-library-card-menu[open]').forEach(function (details) {
      details.removeAttribute('open');
    });
  });
  root.addEventListener('click', function (event) {
    var button = event.target instanceof Element ? event.target.closest('[data-owner-hide-observation]') : null;
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    var endpoint = button.getAttribute('data-hide-endpoint') || '';
    var card = button.closest('[data-library-card]');
    if (!endpoint || !card) return;
    if (!window.confirm(messages.deleteConfirm)) return;
    button.disabled = true;
    button.textContent = messages.deleting;
    fetch(endpoint, {
      method: 'POST',
      headers: { accept: 'application/json' },
      credentials: 'same-origin'
    }).then(function (response) {
      return response.json().catch(function(){ return {}; }).then(function (json) {
        if (!response.ok || !json || json.ok === false) {
          throw new Error(String((json && json.error) || response.status || 'delete_failed'));
        }
        card.hidden = true;
        card.setAttribute('data-owner-hidden', 'true');
        apply();
      });
    }).catch(function (error) {
      button.disabled = false;
      button.textContent = messages.delete;
      window.alert(messages.deleteFailedPrefix + String(error && error.message || 'network'));
    });
  });
  apply();
})();
</script>`;
}

function renderNotesReadingBrief(basePath: string, lang: SiteLang, snapshot: LandingSnapshot, digest: ProfileNoteDigest | null = null): string {
  const latest = snapshot.myFeed[0] ?? snapshot.feed[0] ?? null;
  const firstPlace = snapshot.myPlaces[0] ?? null;
  const supportedCount = snapshot.myFeed.filter((obs) => obs.identificationCount > 0 || obs.entryType === "identification").length;
  const ownObservationPages = snapshot.myFeed.filter((obs) => obs.entryType !== "identification").length;
  const latestHref = latest ? notesDetailHref(basePath, lang, latest) : appendLangToHref(withBasePath(basePath, "/records?view=public"), lang);
  const latestName = latest?.displayName || "近くのページ";
  const latestPlace = latest ? notesPlaceLine(latest, lang, snapshot.viewerUserId ? "owner" : "public") : "この地域";
  const latestDate = latest ? (formatShortDate(notesEntryDate(latest), "ja-JP") || "最近") : "今日";
  const placeName = firstPlace?.placeName ?? "まだ章になっていない場所";
  const digestPlace = digest?.placeChapters[0] ?? null;
  const placeMemory = digestPlace?.readingAngle || (firstPlace
    ? `${firstPlace.visitCount} 回分の記憶があり、${buildPlaceNextLine(firstPlace)}。`
    : "場所の章はまだ薄い。でも近くのページを読むだけでも、同じ道を見返す感覚は先に掴める。");
  const learningLine = digest?.learningHighlight || (supportedCount > 0
    ? `${supportedCount} 件のページで、名前や同定の手がかりが育っています。`
    : "名前が揺れているページも、次に分かる楽しみとして残っています。");
  const contributionLine = digest?.localContribution || (snapshot.viewerUserId
    ? `${formatProfileNumber(ownObservationPages)} ページと ${formatProfileNumber(snapshot.myPlaces.length)} つの場所が、地域を読み返す材料になっています。`
    : `${formatProfileNumber(snapshot.stats.observationCount)} 件の公開ページが、地域の自然を読める形で残っています。`);
  const digestLead = digest?.todayReading
    || `${latestPlace} の ${latestDate} のページを起点に読むと、ただの一覧ではなく「前に何を見て、何が分かり、地域に何が残ったか」までつながって見えます。`;
  const digestQuote = digest?.growthStory || "記録は単なる保存履歴ではなく、同じ場所をもう一度おもしろくするための読み物です。";
  const readingOrder = [
    { label: "前回のページ", value: `${latestDate} の ${latestName}` },
    { label: "場所の章", value: placeName },
    { label: "学び", value: supportedCount > 0 ? "名前が育ったページ" : "まだ名前が揺れているページ" },
    { label: "地域への効き方", value: snapshot.viewerUserId ? "自分の足あとが残した手がかり" : "公開記録が残した手がかり" },
  ];
  return `<section id="notes-reading" class="section notes-reading" data-testid="notes-reading-brief">
    <div class="notes-section-head">
      <div><div class="notes-eyebrow">読むための記録</div><h2>今日読むページ</h2></div>
      <p>ここだけ読めば、前回のページ、場所の記憶、学び、地域への効き方までひと通り分かるようにします。</p>
    </div>
    <div class="notes-digest-shell">
      <article class="notes-digest-main">
        <div class="notes-digest-kicker">今日の読み筋</div>
        <h3>${escapeHtml(latestName)}から読む、今日の記録</h3>
        <p>${escapeHtml(digestLead)}</p>
        <blockquote>${escapeHtml(digestQuote)}</blockquote>
        <div class="notes-digest-story-grid">
          <div>
            <span>前回からの続き</span>
            <strong>${escapeHtml(placeName)}</strong>
            <p>${escapeHtml(placeMemory)}</p>
          </div>
          <div>
            <span>見えてきたこと</span>
            <strong>${escapeHtml(supportedCount > 0 ? "名前の手がかりが増えた" : "分からなさも残っている")}</strong>
            <p>${escapeHtml(learningLine)}</p>
          </div>
          <div>
            <span>世界や地域への効き方</span>
            <strong>この地域の観察レコードが少し厚くなった</strong>
            <p>${escapeHtml(contributionLine)}</p>
          </div>
        </div>
        <a class="notes-digest-link" href="${escapeHtml(latestHref)}">${escapeHtml(latest ? "このページを詳しく読む" : "近くのページを読む")}</a>
      </article>
      <aside class="notes-digest-rail" aria-label="今日の読み順">
        <div class="notes-digest-rail-head">今日の読み順</div>
        ${readingOrder.map((item, index) => `<div class="notes-reading-step">
          <b>${index + 1}</b>
          <span><em>${escapeHtml(item.label)}</em><strong>${escapeHtml(item.value)}</strong></span>
        </div>`).join("")}
        <div class="notes-digest-score">
          <strong>${escapeHtml(formatProfileNumber(snapshot.viewerUserId ? ownObservationPages : snapshot.stats.observationCount))}</strong>
          <span>${escapeHtml(snapshot.viewerUserId ? "自分のページ" : "公開ページ")}</span>
        </div>
      </aside>
    </div>
  </section>`;
}

function renderNotesLearningHighlights(snapshot: LandingSnapshot, digest: ProfileNoteDigest | null = null): string {
  const ownEntries = snapshot.myFeed;
  const uniqueNames = new Set(ownEntries.map((obs) => obs.displayName).filter(Boolean));
  const supportedCount = ownEntries.filter((obs) => obs.identificationCount > 0).length;
  const identificationMemos = ownEntries.filter((obs) => obs.entryType === "identification").length;
  const openQuestions = ownEntries.filter((obs) => obs.identificationCount === 0 && obs.entryType !== "identification").length;
  const cards = [
    {
      value: formatProfileNumber(uniqueNames.size),
      label: "よく見返せる生きもの",
      body: uniqueNames.size > 0 ? "名前の並びが、自分の観察テーマになっていきます。" : "近くのページを読むほど、見たい対象が見つかります。",
    },
    {
      value: formatProfileNumber(supportedCount),
      label: "同定が育ったページ",
      body: supportedCount > 0 ? "候補名や人の同定が、読み返す手がかりになります。" : "まだ揺れている名前も、学びの余白として残ります。",
    },
    {
      value: formatProfileNumber(openQuestions),
      label: "まだ名前が揺れている記録",
      body: "分からないまま残るページは、次に分かる楽しみを作ります。",
    },
    {
      value: formatProfileNumber(identificationMemos),
      label: "自分が残した同定メモ",
      body: "誰かのページに残した見立ても、自分の学びの履歴です。",
    },
  ];
  return `<section id="notes-learning" class="section notes-page" data-testid="notes-learning">
    <div class="notes-section-head">
      <div><div class="notes-eyebrow">学びのハイライト</div><h2>前より見えてきたこと</h2></div>
      <p>${escapeHtml(digest?.learningHighlight || "正解数ではなく、見返すたびに増える観点を並べます。")}</p>
    </div>
    <div class="notes-metric-grid">
      ${cards.map((card) => `<div class="notes-metric-card">
        <strong>${escapeHtml(card.value)}</strong>
        <span>${escapeHtml(card.label)}</span>
        <p>${escapeHtml(card.body)}</p>
      </div>`).join("")}
    </div>
  </section>`;
}

function renderNotesContributionSummary(snapshot: LandingSnapshot, digest: ProfileNoteDigest | null = null): string {
  const ownObservationPages = snapshot.myFeed.filter((obs) => obs.entryType !== "identification").length;
  const placeCount = snapshot.myPlaces.length;
  const weekCount = snapshot.habit?.thisWeekCount ?? 0;
  const supportedPages = snapshot.myFeed.filter((obs) => obs.identificationCount > 0 || obs.entryType === "identification").length;
  const cards = snapshot.viewerUserId
    ? [
      { value: formatProfileNumber(ownObservationPages), label: "地域に残したページ" },
      { value: formatProfileNumber(placeCount), label: "場所の章" },
      { value: formatProfileNumber(weekCount), label: "今週読める足あと" },
      { value: formatProfileNumber(supportedPages), label: "同定の手がかり" },
    ]
    : [
      { value: formatProfileNumber(snapshot.stats.observationCount), label: "公開されているページ" },
      { value: formatProfileNumber(snapshot.stats.speciesCount), label: "見えてきた生きもの" },
      { value: formatProfileNumber(snapshot.stats.placeCount), label: "場所の記憶" },
      { value: formatProfileNumber(snapshot.feed.filter((obs) => obs.identificationCount > 0).length), label: "同定の手がかり" },
    ];
  return `<section id="notes-impact" class="section notes-impact" data-testid="notes-impact">
    <div class="notes-impact-band">
      <div>
        <div class="notes-eyebrow">地域に残った手がかり</div>
        <h2>キミの記録で、この地域の観察レコードが少し厚くなった</h2>
        <p>${escapeHtml(digest?.contributionStory || "大げさに言い切らず、いま見えている観察・場所・同定の範囲で、役立ったことだけを返します。")}</p>
      </div>
      <div class="notes-impact-grid">
        ${cards.map((card) => `<div><strong>${escapeHtml(card.value)}</strong><span>${escapeHtml(card.label)}</span></div>`).join("")}
      </div>
    </div>
  </section>`;
}

function renderNotesPlaceChapters(basePath: string, lang: SiteLang, snapshot: LandingSnapshot, digest: ProfileNoteDigest | null = null): string {
  if (!snapshot.viewerUserId || snapshot.myPlaces.length === 0) {
    return `<section id="notes-places" class="section notes-page" data-testid="notes-places">
      <div class="notes-section-head"><div><div class="notes-eyebrow">場所の章</div><h2>読み返す場所</h2></div></div>
      <div class="notes-empty-reading">場所の章はまだありません。近くのページを読むと、同じ場所を何度も見返す面白さが分かります。</div>
    </section>`;
  }
  const digestByPlace = new Map((digest?.placeChapters ?? []).map((chapter) => [chapter.placeName, chapter]));
  const chapters = snapshot.myPlaces.map((place) => {
    const focus = pickPlaceFocus(place);
    const digestChapter = digestByPlace.get(place.placeName);
    const compared = place.previousObservedAt
      ? `前回 ${formatShortDate(place.previousObservedAt, "ja-JP")}`
      : "この場所の最初のページ";
    const href = appendLangToHref(withBasePath(basePath, "/records?view=mine"), lang);
    const localClue = digestChapter?.localClue
      || `${place.visitCount} 回分のページが、この場所をあとから読める手がかりになっています。`;
    return `<a class="notes-place-chapter" href="${escapeHtml(href)}">
      <span class="notes-place-topline">${escapeHtml(place.municipality || "地域")}</span>
      <strong>${escapeHtml(place.placeName)}</strong>
      <span>前回見たもの: ${escapeHtml(place.latestDisplayName || "まだ名前を確かめているページ")}</span>
      <span>${escapeHtml(compared)} · ${escapeHtml(String(place.visitCount))} 回分</span>
      <em>${escapeHtml(digestChapter?.readingAngle || (focus ? `次に読む観点: ${focus}` : "次に読む観点: 小さな変化"))}</em>
      <span>地域への手がかり: ${escapeHtml(localClue)}</span>
      <b>この場所を読む</b>
    </a>`;
  }).join("");
  return `<section id="notes-places" class="section notes-page" data-testid="notes-places">
    <div class="notes-section-head">
      <div><div class="notes-eyebrow">場所の章</div><h2>読み返す場所</h2></div>
      <p>よく歩く場所を、行き先ではなく読み返す章として並べます。</p>
    </div>
    <div class="notes-place-grid">${chapters}</div>
  </section>`;
}

const NOTES_READING_STYLES = `
  .notes-page { margin-top: 24px; }
  .notes-section-head { display: grid; grid-template-columns: minmax(0,.74fr) minmax(240px,.26fr); gap: 18px; align-items: end; margin-bottom: 18px; }
  .notes-section-head h2 { margin: 6px 0 0; color: #1a2e1f; font-size: clamp(27px,3vw,42px); line-height: 1.12; letter-spacing: 0; }
  .notes-section-head p { margin: 0; color: #64748b; line-height: 1.75; font-weight: 680; }
  .notes-eyebrow { color: #047857; font-size: 12px; font-weight: 950; }
  .notes-digest-shell {
    display: grid;
    grid-template-columns: minmax(0, .68fr) minmax(280px, .32fr);
    gap: 14px;
    align-items: stretch;
  }
  .notes-digest-main, .notes-digest-rail {
    border: 1px solid rgba(16,185,129,.16);
    border-radius: 8px;
    background: rgba(255,255,255,.84);
    box-shadow: 0 16px 38px rgba(15,23,42,.06);
  }
  .notes-digest-main {
    min-height: 360px;
    padding: clamp(20px, 3vw, 30px);
    display: grid;
    gap: 16px;
    align-content: start;
    background:
      linear-gradient(135deg, rgba(236,253,245,.74), rgba(255,255,255,.9) 45%, rgba(240,249,255,.72)),
      rgba(255,255,255,.86);
  }
  .notes-digest-kicker, .notes-digest-rail-head {
    color: #047857;
    font-size: 12px;
    font-weight: 950;
  }
  .notes-digest-main h3 {
    margin: 0;
    max-width: 16ch;
    color: #1a2e1f;
    font-size: clamp(30px, 4.1vw, 56px);
    line-height: 1.05;
    letter-spacing: 0;
  }
  .notes-digest-main > p {
    margin: 0;
    max-width: 58em;
    color: #374151;
    line-height: 1.85;
    font-weight: 720;
  }
  .notes-digest-main blockquote {
    margin: 0;
    padding: 14px 16px;
    border-left: 4px solid #10b981;
    border-radius: 8px;
    background: rgba(255,255,255,.72);
    color: #1a2e1f;
    font-size: 17px;
    line-height: 1.7;
    font-weight: 900;
  }
  .notes-digest-story-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  .notes-digest-story-grid div {
    min-height: 154px;
    padding: 14px;
    border: 1px solid rgba(16,185,129,.14);
    border-radius: 8px;
    background: rgba(255,255,255,.78);
  }
  .notes-digest-story-grid span {
    display: block;
    color: #047857;
    font-size: 12px;
    font-weight: 950;
  }
  .notes-digest-story-grid strong {
    display: block;
    margin-top: 8px;
    color: #1a2e1f;
    font-size: 16px;
    line-height: 1.35;
  }
  .notes-digest-story-grid p {
    margin: 8px 0 0;
    color: #64748b;
    font-size: 13px;
    line-height: 1.65;
    font-weight: 700;
  }
  .notes-digest-link {
    width: fit-content;
    min-height: 42px;
    display: inline-flex;
    align-items: center;
    padding: 10px 14px;
    border-radius: 999px;
    background: #10251a;
    color: #fff;
    text-decoration: none;
    font-size: 13px;
    font-weight: 900;
    box-shadow: 0 14px 30px rgba(16,37,26,.16);
  }
  .notes-digest-rail {
    padding: 16px;
    display: grid;
    gap: 10px;
    align-content: start;
  }
  .notes-reading-step {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    gap: 10px;
    align-items: start;
    padding: 10px;
    border-radius: 8px;
    background: rgba(236,253,245,.72);
  }
  .notes-reading-step b {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: #10b981;
    color: #fff;
    line-height: 1;
  }
  .notes-reading-step em {
    display: block;
    color: #047857;
    font-style: normal;
    font-size: 11px;
    font-weight: 950;
  }
  .notes-reading-step strong {
    display: block;
    margin-top: 3px;
    color: #1a2e1f;
    font-size: 13px;
    line-height: 1.45;
  }
  .notes-digest-score {
    margin-top: 4px;
    padding: 14px;
    border-radius: 8px;
    background: rgba(255,255,255,.82);
    border: 1px solid rgba(16,185,129,.14);
  }
  .notes-digest-score strong { display: block; color: #1a2e1f; font-size: 32px; line-height: 1; font-weight: 950; }
  .notes-digest-score span { display: block; margin-top: 7px; color: #64748b; font-size: 12px; font-weight: 850; }
  .notes-metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  .notes-metric-card, .notes-place-chapter {
    min-height: 138px;
    padding: 16px;
    border: 1px solid rgba(16,185,129,.16);
    border-radius: 8px;
    background: rgba(255,255,255,.82);
    box-shadow: 0 12px 30px rgba(15,23,42,.055);
    text-decoration: none;
    color: inherit;
  }
  .notes-place-chapter:hover { transform: translateY(-2px); box-shadow: 0 16px 34px rgba(16,185,129,.1); }
  .notes-page-kicker, .notes-place-topline { color: #047857; font-size: 12px; font-weight: 950; }
  .notes-metric-card strong { display: block; color: #1a2e1f; font-size: 30px; line-height: 1.05; font-weight: 950; }
  .notes-metric-card span { display: block; margin-top: 8px; color: #047857; font-size: 12px; font-weight: 900; }
  .notes-metric-card p { margin: 8px 0 0; color: #64748b; line-height: 1.65; font-size: 13px; }
  .notes-impact-band {
    display: grid;
    grid-template-columns: minmax(0,.62fr) minmax(320px,.38fr);
    gap: 18px;
    align-items: center;
    padding: 22px;
    border: 1px solid rgba(16,185,129,.16);
    border-radius: 8px;
    background: linear-gradient(135deg, rgba(236,253,245,.9), rgba(240,249,255,.88));
    box-shadow: 0 18px 42px rgba(16,185,129,.09);
  }
  .notes-impact-band h2 { margin: 8px 0 0; color: #1a2e1f; font-size: clamp(26px,3vw,40px); line-height: 1.14; letter-spacing: 0; }
  .notes-impact-band p { margin: 12px 0 0; color: #475569; line-height: 1.8; font-weight: 700; }
  .notes-impact-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .notes-impact-grid div { padding: 14px; border-radius: 8px; background: rgba(255,255,255,.78); border: 1px solid rgba(16,185,129,.14); }
  .notes-impact-grid strong { display: block; color: #1a2e1f; font-size: 25px; line-height: 1.05; font-weight: 950; }
  .notes-impact-grid span { display: block; margin-top: 6px; color: #64748b; font-size: 12px; font-weight: 850; }
  .notes-place-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .notes-place-chapter { display: grid; gap: 7px; min-height: 190px; }
  .notes-place-chapter strong { color: #1a2e1f; font-size: 19px; line-height: 1.32; }
  .notes-place-chapter span, .notes-place-chapter em { color: #64748b; font-style: normal; font-size: 13px; line-height: 1.55; }
  .notes-place-chapter b { width: fit-content; margin-top: 4px; color: #047857; font-size: 13px; }
  .notes-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
  .notes-grid.is-compact { grid-template-columns: 1fr; }
  .notes-page-card {
    display: grid;
    grid-template-columns: 58px minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: 1px solid rgba(16,185,129,.14);
    border-radius: 8px;
    background: rgba(255,255,255,.86);
    box-shadow: 0 10px 24px rgba(15,23,42,.045);
    color: inherit;
    text-decoration: none;
  }
  .notes-thumb { position: relative; width: 58px; height: 58px; border-radius: 6px; overflow: hidden; display: grid; place-items: center; background: #ecfdf5; color: #047857; font-weight: 950; }
  .notes-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .notes-thumb-count { position: absolute; right: 4px; bottom: 4px; min-width: 21px; height: 21px; display: grid; place-items: center; padding: 0 5px; border-radius: 999px; background: rgba(15,23,42,.78); color: #fff; font-size: 11px; line-height: 1; font-weight: 950; }
  .notes-page-copy { min-width: 0; display: grid; gap: 3px; }
  .notes-page-copy strong { color: #1a2e1f; font-size: 16px; line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .notes-page-copy span:not(.notes-page-kicker), .notes-page-copy em { color: #64748b; font-size: 12px; line-height: 1.45; font-style: normal; font-weight: 720; }
  .notes-empty-reading { padding: 18px; border-radius: 8px; border: 1px solid rgba(16,185,129,.14); background: rgba(255,255,255,.82); color: #64748b; font-weight: 720; line-height: 1.75; }
  @media (max-width: 980px) {
    .notes-digest-shell, .notes-impact-band, .notes-section-head { grid-template-columns: 1fr; }
    .notes-digest-story-grid, .notes-metric-grid, .notes-place-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 620px) {
    .notes-digest-story-grid, .notes-metric-grid, .notes-place-grid, .notes-impact-grid { grid-template-columns: 1fr; }
    .notes-section-head h2 { font-size: 28px; }
    .notes-digest-main h3 { font-size: 34px; max-width: 100%; }
  }
`;

const NOTES_LIBRARY_STYLES = `
  .shell.shell-notes-library {
    max-width: none;
    padding: 26px 0 28px;
  }
  .notes-library-shell { width: 100%; display: grid; gap: 24px; }
  .notes-library-hero {
    display: grid;
    grid-template-columns: minmax(0, .68fr) minmax(280px, .32fr);
    gap: 20px;
    align-items: center;
    padding: clamp(24px, 3vw, 36px);
    border-radius: 8px;
    background: linear-gradient(135deg, rgba(236,253,245,.92), rgba(240,249,255,.78));
    border: 1px solid rgba(16,185,129,.16);
  }
  .notes-library-hero span, .notes-library-section-head span { color: #047857; font-size: 12px; font-weight: 950; }
  .notes-library-hero h1 { margin: 8px 0 0; color: #10251a; font-size: clamp(34px, 5vw, 64px); line-height: 1.03; letter-spacing: 0; }
  .notes-library-hero p { margin: 14px 0 0; max-width: 50em; color: #475569; line-height: 1.8; font-weight: 720; }
  .notes-library-actions { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 16px; }
  .notes-library-actions a { min-height: 40px; display: inline-flex; align-items: center; justify-content: center; padding: 9px 12px; border-radius: 999px; background: #fff; border: 1px solid rgba(16,185,129,.16); color: #047857; font-size: 12px; font-weight: 950; text-decoration: none; }
  .notes-library-actions a:first-child { background: #10251a; color: #fff; border-color: #10251a; }
  .notes-experience-loop { display: grid; grid-template-columns: minmax(0, .32fr) minmax(0, .68fr); gap: 16px; align-items: stretch; padding: 18px; border-radius: 8px; background: #10251a; color: #fff; box-shadow: 0 18px 42px rgba(16,37,26,.13); }
  .notes-loop-head { display: grid; align-content: center; gap: 9px; }
  .notes-loop-head span { color: #86efac; font-size: 12px; font-weight: 950; }
  .notes-loop-head h2 { margin: 0; font-size: clamp(22px, 2.5vw, 34px); line-height: 1.16; letter-spacing: 0; }
  .notes-loop-head p { margin: 0; color: rgba(255,255,255,.76); line-height: 1.7; font-size: 13px; font-weight: 750; }
  .notes-loop-steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .notes-loop-step { min-height: 190px; display: grid; align-content: start; gap: 8px; padding: 12px; border-radius: 8px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); color: #fff; text-decoration: none; }
  .notes-loop-step:hover { background: rgba(255,255,255,.13); transform: translateY(-1px); }
  .notes-loop-step b { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 999px; background: #34d399; color: #10251a; font-size: 12px; font-weight: 950; }
  .notes-loop-step span { color: #86efac; font-size: 11px; font-weight: 950; }
  .notes-loop-step strong { color: #fff; font-size: 15px; line-height: 1.35; }
  .notes-loop-step em { color: rgba(255,255,255,.72); font-size: 12px; line-height: 1.55; font-style: normal; font-weight: 730; }
  .notes-loop-step i { align-self: end; width: fit-content; margin-top: 4px; padding: 5px 8px; border-radius: 999px; background: rgba(255,255,255,.12); color: #fff; font-size: 11px; line-height: 1; font-style: normal; font-weight: 950; }
  .notes-library-stats { align-self: center; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .notes-library-stats div { padding: 13px; border-radius: 8px; background: rgba(255,255,255,.82); border: 1px solid rgba(16,185,129,.13); }
  .notes-library-stats strong { display: block; color: #10251a; font-size: 24px; line-height: 1; font-weight: 950; }
  .notes-library-stats em { display: block; margin-top: 7px; color: #64748b; font-size: 12px; font-style: normal; font-weight: 850; }
  .notes-library-controls { position: sticky; top: 68px; z-index: 5; display: grid; grid-template-columns: minmax(220px, .34fr) minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 10px; border-radius: 8px; background: rgba(255,255,255,.9); border: 1px solid rgba(16,185,129,.14); box-shadow: 0 12px 30px rgba(15,23,42,.055); backdrop-filter: blur(16px); }
  .notes-library-search { min-height: 42px; display: flex; align-items: center; gap: 8px; padding: 0 12px; border-radius: 8px; background: #f8fafc; border: 1px solid rgba(15,23,42,.08); }
  .notes-library-search:focus-within { border-color: #0284c7; box-shadow: 0 0 0 3px rgba(2,132,199,.2); }
  .notes-library-search span { color: #047857; font-weight: 950; }
  .notes-library-search input { width: 100%; border: 0; outline: 0; background: transparent; color: #0f172a; font: inherit; font-weight: 750; }
  .notes-library-filter-toggle, .notes-library-filter-label { display: none; }
  .notes-library-filters { display: flex; flex-wrap: wrap; gap: 8px; }
  .notes-library-filters button { min-height: 38px; padding: 8px 12px; border-radius: 999px; border: 1px solid rgba(15,23,42,.08); background: #fff; color: #334155; font: inherit; font-size: 12px; font-weight: 900; cursor: pointer; }
  .notes-library-filters button.is-active { background: #10251a; color: #fff; border-color: #10251a; }
  .notes-library-count { min-height: 42px; display: flex; align-items: center; gap: 7px; padding: 0 12px; border-radius: 8px; background: #ecfdf5; color: #047857; font-size: 12px; font-weight: 900; white-space: nowrap; }
  .notes-library-count strong { color: #10251a; font-size: 18px; }
  .notes-library-source-lanes { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
  .notes-library-source-lane { min-height: 72px; display: grid; align-content: center; gap: 5px; text-align: left; padding: 11px; border-radius: 8px; border: 1px solid rgba(15,23,42,.08); background: rgba(255,255,255,.86); color: #334155; font: inherit; cursor: pointer; }
  .notes-library-source-lane span { font-size: 11px; line-height: 1; font-weight: 950; }
  .notes-library-source-lane strong { color: #10251a; font-size: 22px; line-height: 1; font-weight: 950; }
  .notes-library-source-lane.is-source-photo { border-color: rgba(16,185,129,.18); background: #ecfdf5; }
  .notes-library-source-lane.is-source-video { border-color: rgba(14,165,233,.18); background: #f0f9ff; }
  .notes-library-source-lane.is-source-guide { border-color: rgba(245,158,11,.2); background: #fffbeb; }
  .notes-library-source-lane.is-source-scan { border-color: rgba(20,184,166,.2); background: #f0fdfa; }
  .notes-library-source-lane.is-source-note { border-color: rgba(100,116,139,.16); background: #f8fafc; }
  .notes-library-section-head { display: grid; grid-template-columns: minmax(0, .7fr) minmax(220px, .3fr); gap: 16px; align-items: end; margin-bottom: 14px; }
  .notes-library-section-head h2, .notes-library-month-head h2 { margin: 5px 0 0; color: #10251a; font-size: clamp(24px, 2.6vw, 36px); line-height: 1.14; letter-spacing: 0; }
  .notes-library-section-head p { margin: 0; color: #64748b; line-height: 1.75; font-weight: 700; }
  .notes-library-album-row { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 3px; scroll-snap-type: x proximity; }
  .notes-library-album { flex: 0 0 240px; min-height: 112px; display: grid; gap: 6px; text-align: left; padding: 14px; border-radius: 8px; border: 1px solid rgba(16,185,129,.16); background: rgba(255,255,255,.86); color: inherit; font: inherit; cursor: pointer; scroll-snap-align: start; }
  .notes-library-album span { color: #047857; font-size: 11px; font-weight: 950; }
  .notes-library-album strong { color: #10251a; font-size: 16px; line-height: 1.35; }
  .notes-library-album em { color: #64748b; font-size: 12px; line-height: 1.45; font-style: normal; font-weight: 800; }
  .notes-library-month { display: grid; gap: 12px; }
  .notes-library-month[hidden], .notes-library-card[hidden] { display: none; }
  .notes-library-month-head { display: flex; justify-content: space-between; gap: 12px; align-items: end; }
  .notes-library-month-head span { color: #64748b; font-size: 12px; font-weight: 900; }
  .notes-library-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(158px, 1fr)); grid-auto-flow: dense; gap: 10px; }
  .notes-library-card { position: relative; min-height: 184px; aspect-ratio: 1 / 1.12; overflow: hidden; border-radius: 8px; background: #ecfdf5; color: #fff; text-decoration: none; border: 1px solid rgba(16,185,129,.14); box-shadow: 0 12px 28px rgba(15,23,42,.06); }
  .notes-library-card-link { position: absolute; inset: 0; display: block; color: inherit; text-decoration: none; }
  .notes-library-card:nth-child(7n + 1) { grid-row: span 2; aspect-ratio: 1 / 1.35; }
  .notes-library-card:hover { transform: translateY(-2px); box-shadow: 0 18px 36px rgba(16,185,129,.12); }
  .notes-library-photo { position: absolute; inset: 0; display: grid; place-items: center; background: linear-gradient(135deg, rgba(236,253,245,.96), rgba(219,234,254,.9)); color: #047857; font-size: 34px; font-weight: 950; }
  .notes-library-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .notes-library-photo-stack { width: 100%; height: 100%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: 1fr; gap: 2px; background: #0f172a; }
  .notes-library-photo-stack img { min-width: 0; min-height: 0; }
  .notes-library-photo-count { position: absolute; top: 9px; right: 9px; z-index: 1; padding: 5px 8px; border-radius: 999px; background: rgba(15,23,42,.78); color: #fff; font-size: 11px; line-height: 1; font-weight: 950; box-shadow: 0 6px 16px rgba(15,23,42,.2); }
  .notes-library-card::after { content: ""; position: absolute; inset: 34% 0 0; background: linear-gradient(180deg, transparent, rgba(15,23,42,.78)); pointer-events: none; }
  .notes-library-card.is-photo-missing::after { background: linear-gradient(180deg, rgba(255,255,255,0), rgba(16,37,26,.18)); }
  .notes-library-overlay { position: absolute; inset: auto 0 0; z-index: 1; display: grid; gap: 5px; padding: 12px; }
  .notes-library-overlay strong { color: #fff; font-size: 15px; line-height: 1.25; text-shadow: 0 1px 9px rgba(0,0,0,.34); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .notes-library-overlay em { color: rgba(255,255,255,.86); font-size: 11px; line-height: 1.35; font-style: normal; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .notes-library-card.is-photo-missing .notes-library-overlay strong { color: #10251a; text-shadow: none; }
  .notes-library-card.is-photo-missing .notes-library-overlay em { color: #475569; }
  .notes-library-card-menu { position: absolute; top: 8px; right: 8px; z-index: 3; }
  .notes-library-card-menu summary { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 999px; background: rgba(255,255,255,.92); border: 1px solid rgba(15,23,42,.12); box-shadow: 0 8px 20px rgba(15,23,42,.18); cursor: pointer; list-style: none; }
  .notes-library-card-menu summary::-webkit-details-marker { display: none; }
  .notes-library-card-menu summary span,
  .notes-library-card-menu summary span::before,
  .notes-library-card-menu summary span::after { width: 4px; height: 4px; border-radius: 999px; background: #10251a; display: block; content: ""; }
  .notes-library-card-menu summary span { position: relative; }
  .notes-library-card-menu summary span::before { position: absolute; left: -7px; top: 0; }
  .notes-library-card-menu summary span::after { position: absolute; right: -7px; top: 0; }
  .notes-library-card-menu-panel { position: absolute; top: 40px; right: 0; min-width: 132px; display: grid; gap: 4px; padding: 7px; border-radius: 8px; background: #fff; border: 1px solid rgba(15,23,42,.1); box-shadow: 0 18px 38px rgba(15,23,42,.18); }
  .notes-library-card-menu-panel a,
  .notes-library-card-menu-panel button { min-height: 38px; display: flex; align-items: center; justify-content: flex-start; padding: 8px 10px; border: 0; border-radius: 6px; background: transparent; color: #10251a; font: inherit; font-size: 12px; font-weight: 900; text-align: left; text-decoration: none; cursor: pointer; white-space: nowrap; }
  .notes-library-card-menu-panel a:hover,
  .notes-library-card-menu-panel button:hover { background: #f1f5f9; }
  .notes-library-card-menu-panel button { color: #b91c1c; }
  .notes-library-card-menu-panel button[disabled] { opacity: .65; cursor: progress; }
  .notes-library-badges { display: flex; flex-wrap: wrap; gap: 5px; }
  .notes-library-badges b { width: fit-content; padding: 4px 7px; border-radius: 999px; background: rgba(255,255,255,.86); color: #065f46; font-size: 10px; line-height: 1; font-weight: 950; }
  .notes-library-badges .notes-context-badge { background: rgba(236,253,245,.94); color: #047857; }
  .notes-source-badge.is-source-video { color: #0369a1; }
  .notes-source-badge.is-source-guide { color: #92400e; }
  .notes-source-badge.is-source-scan { color: #0f766e; }
  .notes-source-badge.is-source-note { color: #475569; }
  .notes-library-empty { padding: 20px; border-radius: 8px; border: 1px solid rgba(16,185,129,.14); background: rgba(255,255,255,.82); color: #64748b; font-weight: 720; line-height: 1.75; }
  .notes-library-empty-cta { display: inline-flex; align-items: center; margin-left: 10px; min-height: 36px; padding: 6px 16px; border-radius: 999px; background: #059669; color: #ffffff; font-weight: 850; font-size: 13px; }
  .notes-library-empty-cta:hover { background: #047857; }
  .notes-nearby-library { opacity: .9; }
  .notes-nearby-library .notes-library-grid { grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); }
  .notes-nearby-library .notes-library-card { min-height: 150px; }
  @media (max-width: 980px) {
    .shell.shell-notes-library { padding: 20px 16px 22px; }
    .notes-library-hero, .notes-library-controls, .notes-library-section-head { grid-template-columns: 1fr; }
    .notes-experience-loop { grid-template-columns: 1fr; }
    .notes-loop-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .notes-library-controls { position: static; }
  }
  @media (max-width: 620px) {
    .notes-library-hero { padding: 22px; }
    .notes-library-hero h1 { font-size: 38px; }
    .notes-experience-loop { padding: 14px; }
    .notes-loop-steps { grid-template-columns: 1fr; gap: 9px; }
    .notes-loop-step { min-height: 0; }
    .notes-library-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .notes-library-stats div { padding: 10px; }
    .notes-library-stats strong { font-size: 19px; }
    .notes-library-source-lanes { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .notes-library-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .notes-library-card, .notes-library-card:nth-child(7n + 1) { min-height: 168px; aspect-ratio: 1 / 1.18; grid-row: auto; }
    .notes-library-album { flex-basis: 210px; }
  }
`;

function recordsWorkbenchCopy(lang: SiteLang): RecordsWorkbenchCopy {
  const localized: Record<SiteLang, RecordsWorkbenchCopy> = {
    ja: {
      title: "記録を見る | ikimon",
      activeNav: "記録を見る",
      searchLabel: "記録を探す",
      mapLabel: "地図",
      recordLabel: "記録",
      empty: "表示できる記録がまだありません。",
      tabs: {
        mine: "自分",
        public: "みんな",
        identification_summary: "名前の流れ",
        needs_id: "名前待ち",
        media: "メディア",
        places: "場所",
      },
      side: {
        title: "この棚の状態",
        latest: "最新",
        places: "場所",
        needsId: "名前待ち",
        photos: "メディア",
      },
    },
    en: {
      title: "Records | ikimon",
      activeNav: "Records",
      searchLabel: "Search records",
      mapLabel: "Map",
      recordLabel: "Record",
      empty: "No records are ready to show yet.",
      tabs: {
        mine: "Mine",
        public: "Everyone",
        identification_summary: "ID summary",
        needs_id: "Needs ID",
        media: "Media",
        places: "Places",
      },
      side: {
        title: "Shelf",
        latest: "Latest",
        places: "Places",
        needsId: "Needs ID",
        photos: "Media",
      },
    },
    es: {
      title: "Registros | ikimon",
      activeNav: "Registros",
      searchLabel: "Buscar registros",
      mapLabel: "Mapa",
      recordLabel: "Registrar",
      empty: "Aun no hay registros listos para mostrar.",
      tabs: {
        mine: "Mios",
        public: "Todos",
        identification_summary: "Resumen ID",
        needs_id: "Por revisar",
        media: "Medios",
        places: "Lugares",
      },
      side: {
        title: "Estante",
        latest: "Ultimo",
        places: "Lugares",
        needsId: "Por revisar",
        photos: "Medios",
      },
    },
    "pt-BR": {
      title: "Registros | ikimon",
      activeNav: "Registros",
      searchLabel: "Buscar registros",
      mapLabel: "Mapa",
      recordLabel: "Registrar",
      empty: "Ainda nao ha registros prontos para mostrar.",
      tabs: {
        mine: "Meus",
        public: "Todos",
        identification_summary: "Resumo ID",
        needs_id: "Revisar",
        media: "Midia",
        places: "Lugares",
      },
      side: {
        title: "Estante",
        latest: "Ultimo",
        places: "Lugares",
        needsId: "Revisar",
        photos: "Midia",
      },
    },
  };
  return localized[lang] ?? localized.ja;
}

function normalizeRecordsView(raw: unknown, hasViewer: boolean): RecordsWorkbenchView {
  const view = typeof raw === "string" ? raw.trim() : "";
  if (view === "public" || view === "identification_summary" || view === "needs_id" || view === "media" || view === "places") return view;
  if (view === "mine") return hasViewer ? "mine" : "public";
  return hasViewer ? "mine" : "public";
}

type RecordsArrivalSource = "record_saved" | null;

function normalizeRecordsArrivalSource(raw: unknown): RecordsArrivalSource {
  return typeof raw === "string" && raw.trim() === "record_saved" ? "record_saved" : null;
}

function normalizeRecordsArrivalSavedId(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim().slice(0, 180) : "";
  return /^[A-Za-z0-9:_-]+$/.test(value) ? value : "";
}

function recordsCardMatchesSavedId(card: RecordsPostCard, savedId: string): boolean {
  return Boolean(savedId) && card.postRecordIds.includes(savedId);
}

function prioritizeSavedRecord(entries: LandingObservation[], savedId: string): LandingObservation[] {
  if (!savedId) return entries;
  const matches: LandingObservation[] = [];
  const others: LandingObservation[] = [];
  for (const entry of entries) {
    const ids = [entry.visitId, entry.detailId, entry.occurrenceId].filter(Boolean);
    (ids.includes(savedId) ? matches : others).push(entry);
  }
  return matches.length > 0 ? [...matches, ...others] : entries;
}

type RecordsArrivalCopy = {
  savedEyebrow: string;
  savedTitle: string;
  savedFound: string;
  savedPending: string;
  savedBadge: string;
  continueRecord: string;
  openMap: string;
  publicEyebrow: string;
  publicTitle: string;
  publicLead: string;
  mineEmptyTitle: string;
  mineEmptyLead: string;
  publicEmptyTitle: string;
  publicEmptyLead: string;
  openPublic: string;
  recordPhoto: string;
};

function recordsArrivalCopy(lang: SiteLang): RecordsArrivalCopy {
  if (lang === "en") return {
    savedEyebrow: "Saved",
    savedTitle: "Your record is saved.",
    savedFound: "The newest record is shown first.",
    savedPending: "It is saved. The list is catching up with the newest record.",
    savedBadge: "Just saved",
    continueRecord: "Record another",
    openMap: "Open map",
    publicEyebrow: "Public records",
    publicTitle: "See what people have recorded.",
    publicLead: "Browse public records first. Your own records appear after you sign in.",
    mineEmptyTitle: "No personal records yet",
    mineEmptyLead: "Start with one photo. You can add names and details later.",
    publicEmptyTitle: "No public records are ready yet",
    publicEmptyLead: "Explore the map or start a record from one photo.",
    openPublic: "View public records",
    recordPhoto: "Record from a photo",
  };
  if (lang === "es") return {
    savedEyebrow: "Guardado",
    savedTitle: "Tu registro se guardó.",
    savedFound: "El registro más reciente aparece primero.",
    savedPending: "Está guardado. La lista está actualizando el registro más reciente.",
    savedBadge: "Recién guardado",
    continueRecord: "Registrar otro",
    openMap: "Abrir mapa",
    publicEyebrow: "Registros públicos",
    publicTitle: "Mira lo que otras personas registraron.",
    publicLead: "Primero puedes explorar los registros públicos. Tus registros aparecen al iniciar sesión.",
    mineEmptyTitle: "Aún no tienes registros",
    mineEmptyLead: "Empieza con una foto. Puedes añadir el nombre y los detalles después.",
    publicEmptyTitle: "Aún no hay registros públicos listos",
    publicEmptyLead: "Explora el mapa o inicia un registro con una foto.",
    openPublic: "Ver registros públicos",
    recordPhoto: "Registrar con una foto",
  };
  if (lang === "pt-BR") return {
    savedEyebrow: "Salvo",
    savedTitle: "Seu registro foi salvo.",
    savedFound: "O registro mais recente aparece primeiro.",
    savedPending: "Ele foi salvo. A lista está atualizando o registro mais recente.",
    savedBadge: "Recém-salvo",
    continueRecord: "Registrar outro",
    openMap: "Abrir mapa",
    publicEyebrow: "Registros públicos",
    publicTitle: "Veja o que outras pessoas registraram.",
    publicLead: "Explore primeiro os registros públicos. Seus registros aparecem após entrar.",
    mineEmptyTitle: "Você ainda não tem registros",
    mineEmptyLead: "Comece com uma foto. Nome e detalhes podem ser adicionados depois.",
    publicEmptyTitle: "Ainda não há registros públicos prontos",
    publicEmptyLead: "Explore o mapa ou comece um registro com uma foto.",
    openPublic: "Ver registros públicos",
    recordPhoto: "Registrar com uma foto",
  };
  return {
    savedEyebrow: "保存完了",
    savedTitle: "記録しました。",
    savedFound: "いま保存した記録を、一覧の先頭に表示しています。",
    savedPending: "記録は保存済みです。最新の1件を一覧へ反映しています。",
    savedBadge: "いま保存した記録",
    continueRecord: "続けて撮る",
    openMap: "地図で見る",
    publicEyebrow: "みんなの公開記録",
    publicTitle: "まずは、みんなが残した記録を見る。",
    publicLead: "公開されている写真や場所を見られます。ログインすると、自分の記録を見返せます。",
    mineEmptyTitle: "自分の記録はまだありません",
    mineEmptyLead: "写真1枚から始められます。名前や詳しい内容はあとから足せます。",
    publicEmptyTitle: "公開できる記録はまだありません",
    publicEmptyLead: "地図から場所を見るか、写真1枚から最初の記録を残せます。",
    openPublic: "みんなの記録を見る",
    recordPhoto: "写真から記録する",
  };
}

function renderRecordsArrivalBanner(
  basePath: string,
  lang: SiteLang,
  source: RecordsArrivalSource,
  savedId: string,
  found: boolean,
): string {
  if (source !== "record_saved") return "";
  const copy = recordsArrivalCopy(lang);
  const recordHref = appendLangToHref(withBasePath(basePath, "/record?start=photo"), lang);
  const mapHref = appendLangToHref(withBasePath(basePath, "/map?tab=places&source=record_saved"), lang);
  return `<section class="records-arrival${found ? " is-found" : " is-pending"}" data-records-arrival data-saved-record-id="${escapeHtml(savedId)}">
    <div><span>${escapeHtml(copy.savedEyebrow)}</span><strong>${escapeHtml(copy.savedTitle)}</strong><p>${escapeHtml(found ? copy.savedFound : copy.savedPending)}</p></div>
    <div class="records-arrival-actions"><a class="is-primary" href="${escapeHtml(recordHref)}" data-global-record-trigger="photo">${escapeHtml(copy.continueRecord)}</a><a href="${escapeHtml(mapHref)}">${escapeHtml(copy.openMap)}</a></div>
  </section>`;
}

function renderRecordsPublicIntro(basePath: string, lang: SiteLang, isGuest: boolean): string {
  if (!isGuest) return "";
  const copy = recordsArrivalCopy(lang);
  const mapHref = appendLangToHref(withBasePath(basePath, "/map"), lang);
  return `<section class="records-view-intro" data-records-public-intro><div><span>${escapeHtml(copy.publicEyebrow)}</span><strong>${escapeHtml(copy.publicTitle)}</strong><p>${escapeHtml(copy.publicLead)}</p></div><a href="${escapeHtml(mapHref)}">${escapeHtml(copy.openMap)}</a></section>`;
}

function renderRecordsEmptyState(basePath: string, lang: SiteLang, view: RecordsWorkbenchView, hasViewer: boolean): string {
  const copy = recordsArrivalCopy(lang);
  const recordHref = appendLangToHref(withBasePath(basePath, "/record?start=photo"), lang);
  const publicHref = appendLangToHref(withBasePath(basePath, "/records?view=public"), lang);
  const mapHref = appendLangToHref(withBasePath(basePath, "/map"), lang);
  if (view === "mine" && hasViewer) {
    return `<div class="notes-library-empty records-empty-state"><strong>${escapeHtml(copy.mineEmptyTitle)}</strong><p>${escapeHtml(copy.mineEmptyLead)}</p><div><a class="is-primary" href="${escapeHtml(recordHref)}" data-global-record-trigger="photo">${escapeHtml(copy.recordPhoto)}</a><a href="${escapeHtml(publicHref)}">${escapeHtml(copy.openPublic)}</a></div></div>`;
  }
  if (view === "public") {
    return `<div class="notes-library-empty records-empty-state"><strong>${escapeHtml(copy.publicEmptyTitle)}</strong><p>${escapeHtml(copy.publicEmptyLead)}</p><div><a class="is-primary" href="${escapeHtml(mapHref)}">${escapeHtml(copy.openMap)}</a><a href="${escapeHtml(recordHref)}" data-global-record-trigger="photo">${escapeHtml(copy.recordPhoto)}</a></div></div>`;
  }
  return `<div class="notes-library-empty">${escapeHtml(recordsWorkbenchCopy(lang).empty)} <a class="notes-library-empty-cta" href="${escapeHtml(recordHref)}">${escapeHtml(recordsWorkbenchCopy(lang).recordLabel)}</a></div>`;
}

function renderRecordsArrivalScript(source: RecordsArrivalSource, savedId: string): string {
  if (source !== "record_saved" || !savedId) return "";
  return `<script>(function(){var card=document.querySelector('[data-record-highlight="true"]');if(!card)return;window.requestAnimationFrame(function(){card.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});});})();</script>`;
}

function uniqueRecords(entries: LandingObservation[]): LandingObservation[] {
  const seen = new Set<string>();
  const unique: LandingObservation[] = [];
  for (const entry of entries) {
    const key = `${entry.entryType ?? "observation"}:${entry.visitId}:${entry.occurrenceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(entry);
  }
  return unique;
}

function publicObservationToLandingObservation(item: ObservationListSnapshot["observations"][number]): LandingObservation {
  return {
    occurrenceId: item.occurrenceId,
    visitId: item.visitId,
    detailId: item.detailId,
    featuredOccurrenceId: item.featuredOccurrenceId,
    featuredSubjectName: item.featuredSubjectName,
    subjectCount: item.subjectCount,
    isMultiSubject: item.isMultiSubject,
    featuredConfidenceBand: item.featuredConfidenceBand,
    displayStability: item.displayStability,
    displayName: item.displayName,
    scientificName: item.scientificName,
    vernacularName: item.vernacularName,
    featuredTaxonRank: item.featuredTaxonRank,
    aiCandidateName: item.aiCandidateName,
    aiCandidateRank: item.aiCandidateRank,
    isAiCandidate: item.isAiCandidate,
    observedAt: item.observedAt,
    observerName: item.observerName,
    placeName: item.placeName,
    municipality: item.municipality,
    publicLocation: item.publicLocation,
    photoUrl: item.photoUrl,
    mediaUrl: item.mediaUrl,
    hasPhoto: item.hasPhoto,
    hasVideo: item.hasVideo,
    identificationCount: item.identificationCount,
    fieldRefs: item.fieldRefs,
    latitude: null,
    longitude: null,
    observerUserId: null,
    observerAvatarUrl: null,
    librarySourceKind: item.hasVideo ? "video" : item.photoUrl ? "photo" : "note",
    entryType: "observation",
  };
}

function recordsNeedsId(entry: LandingObservation): boolean {
  const name = (entry.displayName || entry.proposedName || "").trim();
  return entry.isAiCandidate === true
    || entry.identificationCount === 0
    || name === ""
    || name === "同定待ち"
    || /awaiting id|unknown|unresolved/i.test(name);
}

function recordsHasMedia(entry: LandingObservation): boolean {
  const kind = notesLibrarySourceKind(entry);
  return kind === "photo" || kind === "video" || kind === "guide" || kind === "scan";
}

function recordsViewHref(basePath: string, lang: SiteLang, view: RecordsWorkbenchView): string {
  return appendLangToHref(withBasePath(basePath, `/records?view=${view}`), lang);
}

export function recordsPostHrefForView(view: RecordsWorkbenchView, postNeedsId: boolean, detailHref: string): string {
  return view === "needs_id" && postNeedsId ? `${detailHref}#identify` : detailHref;
}

function renderRecordsViewTabs(
  basePath: string,
  lang: SiteLang,
  activeView: RecordsWorkbenchView,
  copy: RecordsWorkbenchCopy,
): string {
  const views: RecordsWorkbenchView[] = ["mine", "public", "identification_summary", "needs_id", "media", "places"];
  return `<nav class="records-view-tabs" aria-label="${escapeHtml(copy.searchLabel)}">
    ${views.map((view) => `<a class="${view === activeView ? "is-active" : ""}" href="${escapeHtml(recordsViewHref(basePath, lang, view))}">
      <span>${escapeHtml(copy.tabs[view])}</span>
    </a>`).join("")}
  </nav>`;
}

function renderRecordsSidePanel(
  lang: SiteLang,
  entries: LandingObservation[],
  snapshot: LandingSnapshot,
  copy: RecordsWorkbenchCopy,
): string {
  const latest = entries[0] ?? null;
  const latestLabel = latest
    ? `${notesLibraryDateLabel(latest, lang)} · ${latest.displayName || latest.proposedName || notesLibraryCopy(lang).card.fallbackName}`
    : copy.empty;
  const firstPlaces = snapshot.myPlaces.slice(0, 5);
  return `<aside class="records-side-panel">
    <div class="records-side-head">
      <span>${escapeHtml(copy.side.title)}</span>
    </div>
    <div class="records-side-metrics">
      <div><span>${escapeHtml(copy.side.latest)}</span><strong>${escapeHtml(latestLabel)}</strong></div>
    </div>
    ${firstPlaces.length > 0 ? `<div class="records-side-places">
      ${firstPlaces.map((place) => `<button type="button" data-library-place="${escapeHtml(place.placeName)}"><span>${escapeHtml(place.municipality ?? "")}</span><strong>${escapeHtml(place.placeName)}</strong></button>`).join("")}
    </div>` : ""}
  </aside>`;
}

type RecordWorkbenchEntriesForViewOptions = {
  heldOccurrenceIds?: Set<string>;
};

function recordWorkbenchEntriesForView(
  view: RecordsWorkbenchView,
  ownEntries: LandingObservation[],
  publicEntries: LandingObservation[],
  options: RecordWorkbenchEntriesForViewOptions = {},
): LandingObservation[] {
  const all = uniqueRecords([...ownEntries, ...publicEntries]);
  const heldOccurrenceIds = options.heldOccurrenceIds;
  const isHeld = (entry: LandingObservation) => heldOccurrenceIds?.has(entry.occurrenceId) ?? false;
  if (view === "mine") return ownEntries;
  if (view === "public") return publicEntries;
  if (view === "identification_summary") return all.filter(recordsNeedsId);
  if (view === "needs_id") return all.filter((entry) => recordsNeedsId(entry) && !isHeld(entry));
  if (view === "media") return all.filter(recordsHasMedia);
  return all;
}

type RecordsPostCard = LandingObservation & {
  postRecordCount: number;
  postRecordIds: string[];
  postSubjectNames: string[];
  postNeedsId: boolean;
  postCandidateName: string | null;
};

function recordsPostGroupKey(entry: LandingObservation): string {
  if ((entry.entryType ?? "observation") === "identification") {
    return `identification:${entry.occurrenceId}`;
  }
  return `observation:${entry.visitId || entry.detailId || entry.occurrenceId}`;
}

function recordsPostSubjectName(entry: LandingObservation, lang: SiteLang): string {
  return formatTaxonDisplayName({
    vernacularName: entry.vernacularName,
    scientificName: entry.scientificName,
    displayName: entry.displayName,
    aiCandidateName: entry.aiCandidateName,
    fallback: entry.proposedName ?? notesLibraryCopy(lang).card.fallbackName,
  }, lang).primaryLabel;
}

function recordsPendingRecordTitle(lang: SiteLang, sourceKind: NonNullable<LandingObservation["librarySourceKind"]>): string {
  if (lang === "en") {
    if (sourceKind === "video") return "Video record";
    if (sourceKind === "audio") return "Sound record";
    if (sourceKind === "guide") return "Guide record";
    if (sourceKind === "scan") return "Scan record";
    if (sourceKind === "photo") return "Photo record";
    return "Local record";
  }
  if (lang === "es") {
    if (sourceKind === "video") return "Registro de video";
    if (sourceKind === "audio") return "Registro de sonido";
    if (sourceKind === "guide") return "Registro de guía";
    if (sourceKind === "scan") return "Registro escaneado";
    if (sourceKind === "photo") return "Registro con foto";
    return "Registro local";
  }
  if (lang === "pt-BR") {
    if (sourceKind === "video") return "Registro em vídeo";
    if (sourceKind === "audio") return "Registro de som";
    if (sourceKind === "guide") return "Registro de guia";
    if (sourceKind === "scan") return "Registro escaneado";
    if (sourceKind === "photo") return "Registro com foto";
    return "Registro local";
  }
  if (sourceKind === "video") return "動画の記録";
  if (sourceKind === "audio") return "音の記録";
  if (sourceKind === "guide") return "ガイドの記録";
  if (sourceKind === "scan") return "スキャン記録";
  if (sourceKind === "photo") return "写真の記録";
  return "地域の記録";
}

function recordsPostDisplayName(
  lang: SiteLang,
  card: RecordsPostCard,
  sourceKind: NonNullable<LandingObservation["librarySourceKind"]>,
  rawDisplayName: string,
): string {
  if (!card.postNeedsId || !isWeakIdentificationCandidateName(rawDisplayName)) return rawDisplayName;
  return recordsPendingRecordTitle(lang, sourceKind);
}

function recordsPostDisplayOrder(cards: RecordsPostCard[], view: RecordsWorkbenchView): RecordsPostCard[] {
  if (view !== "public") return cards;
  const named = cards.filter((card) => !card.postNeedsId);
  if (named.length === 0) return cards;
  const pending = cards.filter((card) => card.postNeedsId);
  return [...named, ...pending];
}

function recordsEntryTimestamp(entry: LandingObservation): number {
  const time = new Date(notesEntryDate(entry)).getTime();
  return Number.isFinite(time) ? time : 0;
}

function recordsRepresentativeMediaUrl(entry: LandingObservation): string | null {
  const photoUrls = Array.isArray(entry.photoUrls) ? entry.photoUrls.filter(Boolean) : [];
  const latestPhoto = photoUrls.length > 0 ? photoUrls[photoUrls.length - 1] : entry.photoUrl;
  const sourceUrl = entry.mediaUrl || latestPhoto || null;
  return sourceUrl ? (toThumbnailUrl(sourceUrl, "md") ?? sourceUrl) : null;
}

function buildRecordsPostCards(entries: LandingObservation[], lang: SiteLang): RecordsPostCard[] {
  const groups = new Map<string, LandingObservation[]>();
  for (const entry of entries) {
    const key = recordsPostGroupKey(entry);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }
  return Array.from(groups.values()).map((group) => {
    const sorted = group.slice().sort((a, b) => recordsEntryTimestamp(b) - recordsEntryTimestamp(a));
    const representative = sorted.find((entry) => recordsRepresentativeMediaUrl(entry)) ?? sorted[0]!;
    const subjectNames = Array.from(new Set(sorted.map((entry) => recordsPostSubjectName(entry, lang)).filter(Boolean)));
    const candidateName = sorted.find((entry) => recordsNeedsId(entry))?.aiCandidateName
      ?? sorted.find((entry) => recordsNeedsId(entry))?.displayName
      ?? null;
    return {
      ...representative,
      displayName: subjectNames[0] ?? representative.displayName,
      postRecordCount: sorted.length,
      postRecordIds: Array.from(new Set(sorted.flatMap((entry) => [entry.visitId, entry.detailId, entry.occurrenceId]).filter((id): id is string => Boolean(id)))),
      postSubjectNames: subjectNames,
      postNeedsId: sorted.some(recordsNeedsId),
      postCandidateName: candidateName,
    };
  });
}

function recordsPostSourceKind(card: RecordsPostCard): NonNullable<LandingObservation["librarySourceKind"]> {
  if (card.hasVideo || card.mediaUrl) return "video";
  return notesLibrarySourceKind(card);
}

function recordsPostSubjectsHtml(card: RecordsPostCard): string {
  const second = card.postSubjectNames[1];
  if (!second) return "";
  const rest = Math.max(0, card.postRecordCount - 2);
  return `<span class="records-post-subjects"><span>${escapeHtml(second)}</span>${rest > 0 ? `<em>+${escapeHtml(String(rest))}</em>` : ""}</span>`;
}

function recordsNeedsIdBadge(lang: SiteLang, card: RecordsPostCard): string {
  if (!card.postNeedsId) return "";
  const label = lang === "ja" ? "名前はあとで確認" : lang === "es" ? "Revisar nombre luego" : lang === "pt-BR" ? "Rever nome depois" : "Name can be checked later";
  const candidate = card.postCandidateName?.trim();
  return `<span class="records-post-needs-id"><b>${escapeHtml(label)}</b>${candidate ? `<small>${escapeHtml(candidate)}</small>` : ""}</span>`;
}

function recordsPostEvidenceChips(lang: SiteLang, card: RecordsPostCard, context: {
  sourceLabel: string;
  placeLine: string;
  hasCandidate: boolean;
}): string {
  if (!card.postNeedsId) return "";
  const labels = lang === "ja"
    ? {
        place: "場所あり",
        candidate: "候補あり",
        media: context.sourceLabel,
        needMedia: "証拠追加",
      }
    : lang === "es"
      ? { place: "Lugar", candidate: "Candidato", media: context.sourceLabel, needMedia: "Falta evidencia" }
      : lang === "pt-BR"
        ? { place: "Local", candidate: "Candidato", media: context.sourceLabel, needMedia: "Falta evidencia" }
        : { place: "Place", candidate: "Candidate", media: context.sourceLabel, needMedia: "Need evidence" };
  const chips = [
    context.sourceLabel || labels.needMedia,
    context.placeLine ? labels.place : "",
    context.hasCandidate ? labels.candidate : "",
  ].filter(Boolean).slice(0, 3);
  if (chips.length === 0) chips.push(labels.needMedia);
  return `<span class="records-post-evidence" aria-label="${escapeHtml(lang === "ja" ? "名前確認の手がかり" : "Identification evidence")}">
    ${chips.map((chip) => `<small>${escapeHtml(chip)}</small>`).join("")}
  </span>`;
}

function recordsPostMemoryLine(options: { locationMode: "owner" | "public" }, dateLabel: string, placeLine: string): string {
  if (options.locationMode !== "owner") return "";
  return `<span class="records-post-memory-line">${escapeHtml([dateLabel, placeLine].filter(Boolean).join(" · "))}</span>`;
}

type RecordsMyPlace = {
  label: string;
  area: string;
  count: number;
  latest: string;
  href: string;
};

function recordsMyPlacesCopy(lang: SiteLang): {
  title: string;
  records: string;
  places: string;
  needsId: string;
  empty: string;
  latestFallback: string;
} {
  if (lang === "en") {
    return { title: "My places", records: "Records", places: "Places", needsId: "Needs ID", empty: "Start with one record.", latestFallback: "Latest record" };
  }
  if (lang === "es") {
    return { title: "Mis lugares", records: "Registros", places: "Lugares", needsId: "Revisar", empty: "Empieza con un registro.", latestFallback: "Registro reciente" };
  }
  if (lang === "pt-BR") {
    return { title: "Meus lugares", records: "Registros", places: "Lugares", needsId: "Revisar", empty: "Comece com um registro.", latestFallback: "Registro recente" };
  }
  return { title: "いつもの場所", records: "記録", places: "場所", needsId: "名前待ち", empty: "まず1件", latestFallback: "最近の記録" };
}

function recordsMyPlaces(
  basePath: string,
  lang: SiteLang,
  snapshot: LandingSnapshot,
  ownEntries: LandingObservation[],
): RecordsMyPlace[] {
  const fromPlaceMemory = snapshot.myPlaces.slice(0, 8).map((place) => {
    const visitId = place.latestVisitId || ownEntries.find((entry) => notesPlaceLine(entry, lang, "owner") === place.placeName)?.visitId || "";
    return {
      label: place.placeName,
      area: place.municipality ?? "",
      count: place.visitCount,
      latest: place.latestDisplayName ?? recordsMyPlacesCopy(lang).latestFallback,
      href: visitId
        ? appendLangToHref(withBasePath(basePath, `/record?start=gallery&revisitObservationId=${encodeURIComponent(visitId)}`), lang)
        : appendLangToHref(withBasePath(basePath, "/record"), lang),
    };
  }).filter((place) => place.label.trim() !== "");
  if (fromPlaceMemory.length > 0) return fromPlaceMemory;

  const grouped = new Map<string, { count: number; latest: LandingObservation }>();
  for (const entry of ownEntries) {
    const label = notesPlaceLine(entry, lang, "owner");
    if (!label) continue;
    const current = grouped.get(label);
    if (!current || recordsEntryTimestamp(entry) > recordsEntryTimestamp(current.latest)) {
      grouped.set(label, { count: (current?.count ?? 0) + 1, latest: entry });
    } else {
      current.count += 1;
    }
  }
  return Array.from(grouped.entries()).slice(0, 8).map(([label, item]) => ({
    label,
    area: "",
    count: item.count,
    latest: recordsPostSubjectName(item.latest, lang),
    href: appendLangToHref(withBasePath(basePath, `/record?start=gallery&revisitObservationId=${encodeURIComponent(item.latest.visitId || item.latest.detailId || item.latest.occurrenceId)}`), lang),
  }));
}

function renderRecordsMyPlacesLane(
  basePath: string,
  lang: SiteLang,
  snapshot: LandingSnapshot,
  ownEntries: LandingObservation[],
): string {
  if (!snapshot.viewerUserId) return "";
  const copy = recordsMyPlacesCopy(lang);
  const places = recordsMyPlaces(basePath, lang, snapshot, ownEntries);
  const placeCount = places.length || new Set(ownEntries.map((entry) => notesPlaceLine(entry, lang, "owner")).filter(Boolean)).size;
  const needsIdCount = ownEntries.filter(recordsNeedsId).length;
  const recordHref = appendLangToHref(withBasePath(basePath, "/record"), lang);
  return `<section class="records-my-places" data-testid="records-my-places" aria-label="${escapeHtml(copy.title)}">
    <div class="records-my-places-head">
      <strong>${escapeHtml(copy.title)}</strong>
      <span><b>${escapeHtml(formatNotesNumber(ownEntries.length, lang))}</b>${escapeHtml(copy.records)}</span>
      <span><b>${escapeHtml(formatNotesNumber(placeCount, lang))}</b>${escapeHtml(copy.places)}</span>
      <span><b>${escapeHtml(formatNotesNumber(needsIdCount, lang))}</b>${escapeHtml(copy.needsId)}</span>
    </div>
    <div class="records-my-places-list">
      ${places.length > 0
        ? places.map((place) => `<a href="${escapeHtml(place.href)}" data-my-place>
            <strong>${escapeHtml(place.label)}</strong>
            <span>${escapeHtml([place.area, place.latest].filter(Boolean).join(" · "))}</span>
            <b>${escapeHtml(formatNotesNumber(place.count, lang))}</b>
          </a>`).join("")
        : `<a class="is-empty" href="${escapeHtml(recordHref)}" data-my-place><strong>${escapeHtml(copy.empty)}</strong><span>${escapeHtml(copy.records)}</span><b>+</b></a>`}
    </div>
  </section>`;
}

function renderRecordsPostCard(
  basePath: string,
  lang: SiteLang,
  view: RecordsWorkbenchView,
  card: RecordsPostCard,
  options: { locationMode: "owner" | "public"; civicContexts?: Map<string, CivicObservationContext>; highlightId?: string },
): string {
  const copy = notesLibraryCopy(lang);
  const detailHref = notesDetailHref(basePath, lang, card);
  const href = recordsPostHrefForView(view, card.postNeedsId, detailHref);
  const sourceKind = recordsPostSourceKind(card);
  const sourceLabel = notesLibrarySourceLabel(sourceKind, lang);
  const mediaUrl = recordsRepresentativeMediaUrl(card);
  const isHighlighted = recordsCardMatchesSavedId(card, options.highlightId ?? "");
  const savedBadge = isHighlighted ? `<span class="records-post-saved-badge">${escapeHtml(recordsArrivalCopy(lang).savedBadge)}</span>` : "";
  const rawDisplayName = recordsPostSubjectName(card, lang);
  const displayName = recordsPostDisplayName(lang, card, sourceKind, rawDisplayName);
  const rawPlaceLine = notesPlaceLine(card, lang, options.locationMode);
  const placeLine = rawPlaceLine || copy.card.fallbackPlace;
  const dateLabel = notesLibraryDateLabel(card, lang);
  const isUncertain = card.postNeedsId || notesLibraryIsUncertain(card);
  const civicContext = options.civicContexts?.get(card.visitId);
  const civicLabel = civicContext ? notesCivicContextLabel(civicContext, lang) : "";
  const filters = [
    "all",
    sourceKind,
    notesPhotoCount(card) > 0 ? "photos" : "no-photo",
    isUncertain ? "uncertain" : "named",
    card.identificationCount > 0 || card.entryType === "identification" ? "identified" : "needs-id",
  ].join(" ");
  const observerLine = card.observerName ? `${formatActorDisplay(card.observerName, lang)} · ` : "";
  const metaLine = options.locationMode === "owner"
    ? [sourceLabel, civicLabel].filter(Boolean).join(" · ")
    : recordsPublicCardMetaLine(lang, { observerLine, placeLine, sourceLabel, civicLabel, dateLabel });
  const memoryLine = recordsPostMemoryLine(options, dateLabel, placeLine);
  const searchable = `${displayName} ${card.postSubjectNames.join(" ")} ${placeLine} ${card.observerName} ${dateLabel} ${sourceLabel} ${civicLabel}`.toLowerCase();
  const identifyActionLabel = lang === "ja" ? "名前を手伝う" : lang === "es" ? "Identificar" : lang === "pt-BR" ? "Identificar" : "Identify";
  const identifyAction = view === "needs_id" && card.postNeedsId
    ? `<span class="records-post-action">${escapeHtml(identifyActionLabel)}</span>`
    : "";
  const evidenceChips = view === "needs_id"
    ? recordsPostEvidenceChips(lang, card, {
        sourceLabel,
        placeLine,
        hasCandidate: Boolean(card.postCandidateName?.trim()),
      })
    : "";
  const identifyDefaultName = card.postCandidateName?.trim() || (isWeakIdentificationCandidateName(rawDisplayName) ? "" : rawDisplayName);
  const identifyEndpointId = encodeURIComponent(card.occurrenceId);
  const identifyEndpoint = withBasePath(basePath, `/api/v1/observations/${identifyEndpointId}/identifications`);
  const disputeEndpoint = withBasePath(basePath, `/api/v1/observations/${identifyEndpointId}/disputes`);
  const holdEndpoint = withBasePath(basePath, `/api/v1/observations/${identifyEndpointId}/identification-workbench-hold`);
  const referenceCandidatesEndpoint = withBasePath(basePath, `/api/v1/observations/${identifyEndpointId}/reference-candidates`);
  const identifyCardAttrs = view === "needs_id" && card.postNeedsId
    ? ` data-records-identify-card data-identify-title="${escapeHtml(displayName)}" data-identify-meta="${escapeHtml(metaLine)}" data-identify-source="${escapeHtml(sourceLabel)}" data-identify-candidate="${escapeHtml(card.postCandidateName ?? "")}" data-identify-default-name="${escapeHtml(identifyDefaultName)}" data-identify-default-rank="${escapeHtml(card.aiCandidateRank ?? card.featuredTaxonRank ?? "")}" data-identify-media="${escapeHtml(mediaUrl ?? "")}" data-identify-href="${escapeHtml(href)}" data-identify-endpoint="${escapeHtml(identifyEndpoint)}" data-dispute-endpoint="${escapeHtml(disputeEndpoint)}" data-hold-endpoint="${escapeHtml(holdEndpoint)}" data-reference-candidates-endpoint="${escapeHtml(referenceCandidatesEndpoint)}"`
    : "";
  const thumbHtml = mediaUrl
    ? `<img src="${escapeHtml(mediaUrl)}" alt="${escapeHtml(displayName)}" loading="lazy" decoding="async" onerror="this.closest('.records-post-card').classList.add('is-media-missing');this.remove()" />`
    : `<span class="records-post-empty-thumb" aria-hidden="true"></span>`;
  const canOwnerHide = options.locationMode === "owner" && card.entryType !== "identification";
  const hideEndpoint = withBasePath(basePath, `/api/v1/observations/${encodeURIComponent(card.visitId)}/hide`);
  const ownerMenu = canOwnerHide
    ? `<details class="notes-library-card-menu records-post-menu">
        <summary aria-label="${escapeHtml(copy.card.menuAria)}"><span aria-hidden="true"></span></summary>
        <div class="notes-library-card-menu-panel">
          <a href="${escapeHtml(href)}">${escapeHtml(copy.card.detail)}</a>
          <button type="button" data-owner-hide-observation data-hide-endpoint="${escapeHtml(hideEndpoint)}">${escapeHtml(copy.card.delete)}</button>
        </div>
      </details>`
    : "";
  const accessibleLabel = [displayName, dateLabel, placeLine].filter(Boolean).join(" · ");
  return `<article class="records-post-card is-source-${escapeHtml(sourceKind)}${mediaUrl ? "" : " is-media-missing"}${identifyCardAttrs ? " is-identify-selectable" : ""}${isHighlighted ? " is-just-saved" : ""}" data-library-card data-record-timeline-item data-record-grouping="visit" data-record-scene-count="${escapeHtml(String(card.postRecordCount))}"${identifyCardAttrs}${isHighlighted ? ` data-record-highlight="true"` : ""} data-filter="${escapeHtml(filters)}" data-search="${escapeHtml(searchable)}">
    ${savedBadge}
    <a class="records-post-card-link" href="${escapeHtml(href)}" aria-label="${escapeHtml(accessibleLabel)}">
      <span class="records-post-thumb">
        ${thumbHtml}
        <span class="records-post-icon is-${escapeHtml(sourceKind)}" aria-hidden="true"></span>
        ${recordsNeedsIdBadge(lang, card)}
      </span>
      <span class="records-post-body">
        <span class="records-post-title-line">
          <strong>${escapeHtml(displayName)}</strong>
          ${recordsPostSubjectsHtml(card)}
        </span>
        ${memoryLine}
        <span class="records-post-meta">${escapeHtml(metaLine)}</span>
        ${evidenceChips}
        ${identifyAction}
      </span>
    </a>
    ${ownerMenu}
  </article>`;
}

function renderRecordsPostMonths(
  basePath: string,
  lang: SiteLang,
  view: RecordsWorkbenchView,
  entries: LandingObservation[],
  options: { locationMode: "owner" | "public"; civicContexts?: Map<string, CivicObservationContext>; highlightId?: string },
): string {
  const cards = recordsPostDisplayOrder(buildRecordsPostCards(entries, lang), view);
  if (cards.length === 0) {
    return `<div class="notes-library-empty">${escapeHtml(notesLibraryCopy(lang).emptyLibrary)}</div>`;
  }
  const groups = new Map<string, RecordsPostCard[]>();
  for (const card of cards) {
    const key = notesLibraryMonthKey(card);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(card);
  }
  return Array.from(groups.entries()).map(([key, items]) => `<section class="records-post-month" data-library-month data-month-key="${escapeHtml(key)}">
    <div class="records-post-month-head">
      <span>${escapeHtml(notesLibraryMonthLabel(key, lang))}</span>
    </div>
    <div class="records-post-grid" data-library-grid>
      ${items.map((card) => renderRecordsPostCard(basePath, lang, view, card, options)).join("")}
    </div>
  </section>`).join("");
}

function recordsIdentifyPanelCopy(lang: SiteLang): {
  kicker: string;
  empty: string;
  emptyBody: string;
  emptyRecords: string;
  emptyMap: string;
  candidate: string;
  open: string;
  next: string;
  note: string;
  support: string;
  alternative: string;
  needsEvidence: string;
  hold: string;
  nameLabel: string;
  noteLabel: string;
  reference: string;
  login: string;
  noReferences: string;
  loadingReferences: string;
  locator: string;
  ready: string;
  saving: string;
  saved: string;
  held: string;
  restore: string;
  keepViewing: string;
  nameRequired: string;
} {
  if (lang === "en") return {
    kicker: "ID workbench",
    empty: "No records are waiting for names right now.",
    emptyBody: "That means the queue has moved forward. If you find something unnamed, save it first and review recent named records for the loop.",
    emptyRecords: "Record even without a name",
    emptyMap: "Review recent records",
    candidate: "Candidate",
    open: "Check details",
    next: "Next",
    note: "Review the media and candidate, then save the basis from the detail view.",
    support: "Looks right",
    alternative: "Other name",
    needsEvidence: "Need evidence",
    hold: "Hold",
    nameLabel: "Name",
    noteLabel: "Basis note",
    reference: "Use a reference",
    login: "Log in to save an ID.",
    noReferences: "No matching references yet.",
    loadingReferences: "Loading references...",
    locator: "Page / figure",
    ready: "Ready.",
    saving: "Saving...",
    saved: "Saved. Moved to the next record.",
    held: "Held locally. Moved to the next record.",
    restore: "Undo",
    keepViewing: "Keep viewing",
    nameRequired: "Add a name first, or use Need evidence.",
  };
  if (lang === "es") return {
    kicker: "Mesa de identificacion",
    empty: "Ahora no hay registros esperando nombre.",
    emptyBody: "La cola avanzó. Si encuentras algo sin nombre, guárdalo primero y revisa registros recientes.",
    emptyRecords: "Registrar sin nombre",
    emptyMap: "Ver registros recientes",
    candidate: "Candidato",
    open: "Revisar detalle",
    next: "Siguiente",
    note: "Revisa el medio y el candidato, y guarda la base desde el detalle.",
    support: "Parece correcto",
    alternative: "Otro nombre",
    needsEvidence: "Falta evidencia",
    hold: "Pausar",
    nameLabel: "Nombre",
    noteLabel: "Nota",
    reference: "Usar referencia",
    login: "Inicia sesion para guardar.",
    noReferences: "Aun no hay referencias.",
    loadingReferences: "Cargando referencias...",
    locator: "Pagina / figura",
    ready: "Listo.",
    saving: "Guardando...",
    saved: "Guardado. Pasamos al siguiente.",
    held: "Pausado aqui. Pasamos al siguiente.",
    restore: "Volver",
    keepViewing: "Seguir viendo",
    nameRequired: "Anade un nombre, o usa Falta evidencia.",
  };
  if (lang === "pt-BR") return {
    kicker: "Bancada de identificacao",
    empty: "Agora nao ha registros esperando nome.",
    emptyBody: "A fila avançou. Se encontrar algo sem nome, registre primeiro e revise registros recentes.",
    emptyRecords: "Registrar sem nome",
    emptyMap: "Ver registros recentes",
    candidate: "Candidato",
    open: "Ver detalhe",
    next: "Proximo",
    note: "Confira a midia e o candidato, depois salve a base no detalhe.",
    support: "Parece certo",
    alternative: "Outro nome",
    needsEvidence: "Falta evidencia",
    hold: "Segurar",
    nameLabel: "Nome",
    noteLabel: "Nota",
    reference: "Usar referencia",
    login: "Entre para salvar.",
    noReferences: "Ainda nao ha referencias.",
    loadingReferences: "Carregando referencias...",
    locator: "Pagina / figura",
    ready: "Pronto.",
    saving: "Salvando...",
    saved: "Salvo. Indo para o proximo.",
    held: "Segurado aqui. Indo para o proximo.",
    restore: "Voltar",
    keepViewing: "Continuar vendo",
    nameRequired: "Adicione um nome, ou use Falta evidencia.",
  };
  return {
    kicker: "名前を確かめる",
    empty: "名前待ちの記録は今はありません。",
    emptyBody: "今は名前を待つ公開記録が見つかりません。名前が分からない発見があれば、まず記録として残せます。",
    emptyRecords: "名前不明でも記録",
    emptyMap: "最近の記録を見る",
    candidate: "候補",
    open: "詳細で確認",
    next: "次へ",
    note: "画像と候補を見て、根拠を選んで記録します。",
    support: "この候補でよさそう",
    alternative: "別の名前",
    needsEvidence: "証拠不足",
    hold: "保留",
    nameLabel: "名前",
    noteLabel: "理由メモ",
    reference: "この資料で確認",
    login: "ログインすると名前確認メモを保存できます。",
    noReferences: "この分類群の参照資料はまだありません。",
    loadingReferences: "資料を確認しています...",
    locator: "ページ・図版番号",
    ready: "Ready.",
    saving: "保存中...",
    saved: "保存しました。次の記録へ移動しました。",
    held: "保留しました。次の記録へ移動しました。",
    restore: "戻す",
    keepViewing: "このまま見る",
    nameRequired: "名前を入れてください。証拠だけ足りない場合は「証拠不足」を使えます。",
  };
}

function renderRecordsIdentifyPanel(
  basePath: string,
  lang: SiteLang,
  entries: LandingObservation[],
  options: { locationMode: "owner" | "public"; canWrite: boolean; civicContexts?: Map<string, CivicObservationContext>; fallbackEntries?: LandingObservation[] },
): string {
  const copy = recordsIdentifyPanelCopy(lang);
  const card = buildRecordsPostCards(entries, lang).find((item) => item.postNeedsId) ?? null;
  if (!card) {
    const proofCopy = lang === "ja"
      ? {
          title: "最近名前がついた記録",
          emptyTitle: "名前がついた記録を見る",
          emptyBody: "最近の公開記録から、名前のつき方を見返せます。",
          panelTitle: "名前がつく流れを見返す",
          panelBody: "今は確認待ちのカードを出さず、最近の公開記録を手がかりにできます。",
        }
      : {
          title: "Recently named records",
          emptyTitle: "View named records",
          emptyBody: "Recent public records show how names get resolved.",
          panelTitle: "Review how names get resolved",
          panelBody: "No waiting card is shown now; recent public records can be used as examples.",
        };
    const namedCards = buildRecordsPostCards(options.fallbackEntries ?? [], lang)
      .filter((item) => !item.postNeedsId)
      .slice(0, 3);
    const proofItems = namedCards.length > 0
      ? namedCards.map((item) => {
          const href = notesDetailHref(basePath, lang, item);
          const name = recordsPostSubjectName(item, lang);
          const meta = [notesPlaceLine(item, lang, "public") || notesLibraryCopy(lang).card.fallbackPlace, notesLibraryDateLabel(item, lang)]
            .filter(Boolean)
            .join(" · ");
          return `<a href="${escapeHtml(href)}"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(meta)}</span></a>`;
        }).join("")
      : `<a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/records?view=public"), lang))}"><strong>${escapeHtml(proofCopy.emptyTitle)}</strong><span>${escapeHtml(proofCopy.emptyBody)}</span></a>`;
    return `<aside class="records-identify-panel is-empty" data-records-identify-panel>
      <div class="records-identify-head">
        <span>${escapeHtml(copy.kicker)}</span>
        <strong data-identify-panel-title>${escapeHtml(proofCopy.panelTitle)}</strong>
        <p>${escapeHtml(proofCopy.panelBody)}</p>
      </div>
      <div class="records-identify-proof">
        <strong>${escapeHtml(proofCopy.title)}</strong>
        ${proofItems}
      </div>
      <div class="records-identify-empty-actions">
        <a class="is-primary" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/record"), lang))}">${escapeHtml(copy.emptyRecords)}</a>
        <a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/records?view=public"), lang))}">${escapeHtml(copy.emptyMap)}</a>
      </div>
    </aside>`;
  }
  const href = recordsPostHrefForView("needs_id", card.postNeedsId, notesDetailHref(basePath, lang, card));
  const mediaUrl = recordsRepresentativeMediaUrl(card);
  const displayName = recordsPostSubjectName(card, lang);
  const sourceLabel = notesLibrarySourceLabel(recordsPostSourceKind(card), lang);
  const placeLine = notesPlaceLine(card, lang, options.locationMode) || notesLibraryCopy(lang).card.fallbackPlace;
  const dateLabel = notesLibraryDateLabel(card, lang);
  const observerLine = card.observerName ? `${formatActorDisplay(card.observerName, lang)} · ` : "";
  const metaLine = `${observerLine}${placeLine} · ${dateLabel}`;
  const candidate = card.postCandidateName?.trim() ?? "";
  const defaultName = candidate || (isWeakIdentificationCandidateName(displayName) ? "" : displayName);
  const detailLinkLabel = defaultName ? copy.reference : copy.open;
  return `<aside class="records-identify-panel" data-records-identify-panel>
    <div class="records-identify-head">
      <span>${escapeHtml(copy.kicker)}</span>
      <strong data-identify-panel-title>${escapeHtml(displayName)}</strong>
      <p data-identify-panel-meta>${escapeHtml(metaLine)}</p>
    </div>
    <a class="records-identify-media${mediaUrl ? "" : " is-empty"}" href="${escapeHtml(href)}" data-identify-panel-media-link>
      ${mediaUrl
        ? `<img src="${escapeHtml(mediaUrl)}" alt="${escapeHtml(displayName)}" data-identify-panel-media loading="lazy" decoding="async" />`
        : `<span data-identify-panel-empty-media aria-hidden="true"></span>`}
    </a>
    <div class="records-identify-facts">
      <span data-identify-panel-source>${escapeHtml(sourceLabel)}</span>
      <span data-identify-panel-candidate-row${candidate ? "" : " hidden"}>${escapeHtml(copy.candidate)}: <b data-identify-panel-candidate>${escapeHtml(candidate)}</b></span>
    </div>
    ${options.canWrite
      ? `<form class="records-identify-command" data-identify-panel-form>
          <div class="records-identify-fields">
            <label><span>${escapeHtml(copy.nameLabel)}</span><input name="proposedName" type="text" value="${escapeHtml(defaultName)}" data-identify-panel-name placeholder="${escapeHtml(copy.nameLabel)}" /></label>
            <input name="proposedRank" type="hidden" value="${escapeHtml(card.aiCandidateRank ?? card.featuredTaxonRank ?? "")}" data-identify-panel-rank />
            <label><span>${escapeHtml(copy.noteLabel)}</span><textarea name="notes" rows="2" data-identify-panel-notes placeholder="${escapeHtml(copy.noteLabel)}"></textarea></label>
          </div>
          <div class="records-identify-command-actions">
            <button type="button" class="is-primary" data-identify-panel-action="support">${escapeHtml(copy.support)}</button>
            <button type="button" data-identify-panel-action="alternative">${escapeHtml(copy.alternative)}</button>
            <button type="button" data-identify-panel-action="needs_more_evidence">${escapeHtml(copy.needsEvidence)}</button>
            <button type="button" data-identify-panel-action="hold">${escapeHtml(copy.hold)}</button>
          </div>
          <div class="records-identify-references" data-identify-panel-references hidden>
            <div class="records-identify-references-head">
              <strong>${escapeHtml(copy.reference)}</strong>
              <a href="${escapeHtml(withBasePath(basePath, "/references/capture?returnTo=%2Frecords%3Fview%3Dneeds_id"))}" data-identify-panel-reference-capture data-reference-capture-base="${escapeHtml(withBasePath(basePath, "/references/capture"))}">資料を登録</a>
            </div>
            <div class="records-identify-reference-options" data-identify-panel-reference-options></div>
            <label class="records-identify-reference-locator"><span>${escapeHtml(copy.locator)}</span><input name="referenceLocator" type="text" maxlength="160" data-identify-panel-reference-locator placeholder="${escapeHtml(copy.locator)}" /></label>
          </div>
        </form>`
      : `<div class="records-identify-login">${escapeHtml(copy.login)}</div>`}
    <div class="records-identify-followup" data-identify-panel-followup hidden>
      <span data-identify-panel-status>${escapeHtml(copy.ready)}</span>
      <button type="button" data-identify-panel-restore>${escapeHtml(copy.restore)}</button>
      <button type="button" data-identify-panel-keep>${escapeHtml(copy.keepViewing)}</button>
    </div>
    <div class="records-identify-actions">
      <a href="${escapeHtml(href)}" data-identify-panel-open>${escapeHtml(detailLinkLabel)}</a>
      <button type="button" data-identify-panel-next>${escapeHtml(copy.next)}</button>
    </div>
    <p>${escapeHtml(copy.note)}</p>
  </aside>`;
}

function renderRecordsIdentifyPanelScript(lang: SiteLang): string {
  const copy = recordsIdentifyPanelCopy(lang);
  return `<script>
(function () {
  var copy = ${JSON.stringify(copy)};
  var root = document.querySelector('[data-records-identify-workbench]');
  if (!root) return;
  var panel = root.querySelector('[data-records-identify-panel]');
  if (!panel) return;
  var cards = Array.prototype.slice.call(root.querySelectorAll('[data-records-identify-card]'));
  if (!cards.length) return;
  var title = panel.querySelector('[data-identify-panel-title]');
  var meta = panel.querySelector('[data-identify-panel-meta]');
  var source = panel.querySelector('[data-identify-panel-source]');
  var candidateRow = panel.querySelector('[data-identify-panel-candidate-row]');
  var candidate = panel.querySelector('[data-identify-panel-candidate]');
  var mediaLink = panel.querySelector('[data-identify-panel-media-link]');
  var media = panel.querySelector('[data-identify-panel-media]');
  var open = panel.querySelector('[data-identify-panel-open]');
  var next = panel.querySelector('[data-identify-panel-next]');
  var emptyMedia = panel.querySelector('[data-identify-panel-empty-media]');
  var form = panel.querySelector('[data-identify-panel-form]');
  var nameInput = panel.querySelector('[data-identify-panel-name]');
  var rankInput = panel.querySelector('[data-identify-panel-rank]');
  var notesInput = panel.querySelector('[data-identify-panel-notes]');
  var referenceBox = panel.querySelector('[data-identify-panel-references]');
  var referenceOptions = panel.querySelector('[data-identify-panel-reference-options]');
  var referenceLocator = panel.querySelector('[data-identify-panel-reference-locator]');
  var referenceCapture = panel.querySelector('[data-identify-panel-reference-capture]');
  var followup = panel.querySelector('[data-identify-panel-followup]');
  var status = panel.querySelector('[data-identify-panel-status]');
  var restore = panel.querySelector('[data-identify-panel-restore]');
  var keep = panel.querySelector('[data-identify-panel-keep]');
  var activeCard = null;
  var lastActionCard = null;
  var referenceRequestSerial = 0;
  function selectableCards() {
    return cards.filter(function (card) { return !card.hidden && card.getAttribute('data-identify-processed') !== '1'; });
  }
  function setStatus(message, isError) {
    if (!status) return;
    status.textContent = message || '';
    status.classList.toggle('is-error', Boolean(isError));
    if (followup) followup.hidden = false;
  }
  function ensureMediaElement() {
    if (media) return media;
    if (!mediaLink) return null;
    media = document.createElement('img');
    media.setAttribute('data-identify-panel-media', '');
    media.loading = 'lazy';
    media.decoding = 'async';
    mediaLink.textContent = '';
    mediaLink.appendChild(media);
    return media;
  }
  function selectCard(card) {
    if (!card) return;
    activeCard = card;
    cards.forEach(function (item) {
      item.classList.toggle('is-identify-active', item === card);
      if (item === card) item.setAttribute('aria-current', 'true');
      else item.removeAttribute('aria-current');
    });
    var cardTitle = card.getAttribute('data-identify-title') || '';
    var cardMeta = card.getAttribute('data-identify-meta') || '';
    var cardSource = card.getAttribute('data-identify-source') || '';
    var cardCandidate = card.getAttribute('data-identify-candidate') || '';
    var cardDefaultName = card.getAttribute('data-identify-default-name') || cardCandidate || '';
    var cardDefaultRank = card.getAttribute('data-identify-default-rank') || '';
    var cardMedia = card.getAttribute('data-identify-media') || '';
    var cardHref = card.getAttribute('data-identify-href') || '';
    var identifyEndpoint = card.getAttribute('data-identify-endpoint') || '';
    var disputeEndpoint = card.getAttribute('data-dispute-endpoint') || '';
    var holdEndpoint = card.getAttribute('data-hold-endpoint') || '';
    if (title) title.textContent = cardTitle;
    if (meta) meta.textContent = cardMeta;
    if (source) source.textContent = cardSource;
    if (candidate) candidate.textContent = cardCandidate;
    if (candidateRow) candidateRow.hidden = !cardCandidate;
    if (open && cardHref) open.setAttribute('href', cardHref);
    if (mediaLink && cardHref) mediaLink.setAttribute('href', cardHref);
    if (form) {
      form.setAttribute('data-identify-endpoint', identifyEndpoint);
      form.setAttribute('data-dispute-endpoint', disputeEndpoint);
      form.setAttribute('data-hold-endpoint', holdEndpoint);
    }
    if (nameInput) nameInput.value = cardDefaultName;
    if (rankInput) rankInput.value = cardDefaultRank;
    if (notesInput) notesInput.value = '';
    if (referenceLocator) referenceLocator.value = '';
    if (referenceCapture) {
      var captureBase = referenceCapture.getAttribute('data-reference-capture-base') || referenceCapture.getAttribute('href') || '/references/capture';
      var returnTo = window.location.pathname + window.location.search;
      var query = '?returnTo=' + encodeURIComponent(returnTo);
      if (cardDefaultName) query += '&taxonHint=' + encodeURIComponent(cardDefaultName);
      referenceCapture.setAttribute('href', captureBase + query);
    }
    if (followup) followup.hidden = true;
    loadReferencesForCard(card, cardDefaultName);
    if (cardMedia) {
      var image = ensureMediaElement();
      if (image) {
        image.src = cardMedia;
        image.alt = cardTitle;
      }
      if (mediaLink) mediaLink.classList.remove('is-empty');
      if (emptyMedia) emptyMedia.hidden = true;
    } else {
      if (media) media.removeAttribute('src');
      if (mediaLink) mediaLink.classList.add('is-empty');
      if (emptyMedia) emptyMedia.hidden = false;
    }
  }
  function selectNextAfter(card) {
    var list = selectableCards();
    if (!list.length) return;
    var current = list.indexOf(card);
    if (current < 0) {
      selectCard(list[0]);
      return;
    }
    selectCard(list[(current + 1) % list.length]);
  }
  function markProcessed(card) {
    if (!card) return;
    card.setAttribute('data-identify-processed', '1');
    card.classList.add('is-identify-processed');
    lastActionCard = card;
  }
  function restoreLastAction(selectOnly) {
    if (!lastActionCard) return;
    if (!selectOnly) {
      lastActionCard.removeAttribute('data-identify-processed');
      lastActionCard.classList.remove('is-identify-processed');
    }
    selectCard(lastActionCard);
  }
  function postJson(endpoint, body) {
    return fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (json) {
        if (!response.ok || !json || json.ok === false) throw new Error(String((json && json.error) || response.status || 'save_failed'));
        return json;
      });
    });
  }
  function clearReferences(message) {
    if (!referenceBox || !referenceOptions) return;
    referenceBox.hidden = false;
    referenceOptions.textContent = message || '';
    if (referenceLocator) referenceLocator.value = '';
  }
  function renderReferenceCandidates(candidates) {
    if (!referenceBox || !referenceOptions) return;
    referenceBox.hidden = false;
    referenceOptions.textContent = '';
    if (!Array.isArray(candidates) || candidates.length === 0) {
      referenceOptions.textContent = copy.noReferences;
      return;
    }
    candidates.slice(0, 6).forEach(function (candidate) {
      var label = document.createElement('label');
      label.className = 'records-identify-reference-option';
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.name = 'referenceSourceIds';
      input.value = String(candidate.sourceId || '');
      input.checked = Boolean(candidate.owned);
      var span = document.createElement('span');
      var strong = document.createElement('strong');
      strong.textContent = String(candidate.title || '');
      var small = document.createElement('small');
      small.textContent = [
        candidate.reason,
        candidate.owned ? '所有確認済み' : '共有カタログ',
        Array.isArray(candidate.taxonLabels) ? candidate.taxonLabels.slice(0, 3).join(' / ') : '',
        Number(candidate.usedCount || 0) > 0 ? '過去に' + String(candidate.usedCount) + '回使用' : ''
      ].filter(Boolean).join(' · ');
      span.appendChild(strong);
      span.appendChild(small);
      label.appendChild(input);
      label.appendChild(span);
      referenceOptions.appendChild(label);
    });
  }
  function loadReferencesForCard(card, proposedName) {
    if (!referenceBox || !referenceOptions) return;
    var endpoint = card.getAttribute('data-reference-candidates-endpoint') || '';
    if (!endpoint) {
      referenceBox.hidden = true;
      return;
    }
    var serial = ++referenceRequestSerial;
    clearReferences(copy.loadingReferences);
    var url = endpoint + '?limit=6&proposedName=' + encodeURIComponent(proposedName || '');
    fetch(url, { headers: { accept: 'application/json' }, credentials: 'same-origin' })
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (json) {
          if (!response.ok || !json || json.ok === false) throw new Error(String((json && json.error) || response.status || 'reference_load_failed'));
          return json;
        });
      })
      .then(function (json) {
        if (serial !== referenceRequestSerial) return;
        renderReferenceCandidates(json.candidates || []);
      })
      .catch(function () {
        if (serial !== referenceRequestSerial) return;
        renderReferenceCandidates([]);
      });
  }
  function selectedReferenceIds() {
    if (!referenceBox) return [];
    return Array.prototype.slice.call(referenceBox.querySelectorAll('input[name="referenceSourceIds"]:checked'))
      .map(function (input) { return String(input.value || '').trim(); })
      .filter(Boolean);
  }
  function submitAction(action) {
    if (!activeCard || !form) return;
    if (action === 'hold') {
      var holdEndpoint = form.getAttribute('data-hold-endpoint') || '';
      if (!holdEndpoint) {
        setStatus('保存できませんでした: hold_endpoint_missing', true);
        return;
      }
      var holdReason = notesInput ? String(notesInput.value || '').trim() : '';
      setStatus(copy.saving, false);
      postJson(holdEndpoint, { reason: holdReason })
        .then(function () {
          markProcessed(activeCard);
          selectNextAfter(activeCard);
          setStatus(copy.held, false);
        })
        .catch(function (error) {
          setStatus('保存できませんでした: ' + String(error && error.message || 'unknown_error'), true);
        });
      return;
    }
    var proposedName = nameInput ? String(nameInput.value || '').trim() : '';
    var proposedRank = rankInput ? String(rankInput.value || '').trim() : '';
    var notes = notesInput ? String(notesInput.value || '').trim() : '';
    var referenceSourceIds = selectedReferenceIds();
    var locator = referenceLocator ? String(referenceLocator.value || '').trim() : '';
    if (action !== 'needs_more_evidence' && !proposedName) {
      setStatus(copy.nameRequired, true);
      if (nameInput && typeof nameInput.focus === 'function') nameInput.focus({ preventScroll: true });
      return;
    }
    var identifyEndpoint = form.getAttribute('data-identify-endpoint') || '';
    var disputeEndpoint = form.getAttribute('data-dispute-endpoint') || '';
    var endpoint = action === 'support' ? identifyEndpoint : disputeEndpoint;
    if (!endpoint) return;
    var body = action === 'support'
      ? { proposedName: proposedName, proposedRank: proposedRank, notes: notes, stance: 'support', referenceSourceIds: referenceSourceIds, referenceLocator: locator }
      : action === 'alternative'
        ? { kind: 'alternative_id', proposedName: proposedName, proposedRank: proposedRank, reason: notes, referenceSourceIds: referenceSourceIds, referenceLocator: locator }
        : { kind: 'needs_more_evidence', reason: notes || copy.needsEvidence };
    setStatus(copy.saving, false);
    postJson(endpoint, body)
      .then(function () {
        markProcessed(activeCard);
        selectNextAfter(activeCard);
        setStatus(copy.saved, false);
      })
      .catch(function (error) {
        setStatus('保存できませんでした: ' + String(error && error.message || 'unknown_error'), true);
      });
  }
  cards.forEach(function (card) {
    var link = card.querySelector('.records-post-card-link');
    if (!link) return;
    link.addEventListener('click', function (event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      selectCard(card);
      if (window.matchMedia && window.matchMedia('(max-width: 980px)').matches) {
        panel.scrollIntoView({ block: 'end', behavior: 'smooth' });
      }
    });
  });
  if (next) {
    next.addEventListener('click', function () {
      var list = selectableCards();
      if (!list.length) return;
      var current = list.findIndex(function (card) { return card.classList.contains('is-identify-active'); });
      selectCard(list[(current + 1 + list.length) % list.length]);
    });
  }
  if (form) {
    Array.prototype.slice.call(form.querySelectorAll('[data-identify-panel-action]')).forEach(function (button) {
      button.addEventListener('click', function () {
        submitAction(button.getAttribute('data-identify-panel-action') || 'support');
      });
    });
  }
  if (restore) restore.addEventListener('click', function () { restoreLastAction(false); });
  if (keep) keep.addEventListener('click', function () { restoreLastAction(true); });
  selectCard(cards[0]);
})();
</script>`;
}

function renderRecordsPostMonthPayload(
  basePath: string,
  lang: SiteLang,
  view: RecordsWorkbenchView,
  entries: LandingObservation[],
  options: { locationMode: "owner" | "public"; civicContexts?: Map<string, CivicObservationContext> },
): Array<{ key: string; label: string; cardsHtml: string; sectionHtml: string }> {
  const cards = buildRecordsPostCards(entries, lang);
  const groups = new Map<string, RecordsPostCard[]>();
  for (const card of cards) {
    const key = notesLibraryMonthKey(card);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(card);
  }
  return Array.from(groups.entries()).map(([key, items]) => {
    const cardsHtml = items.map((card) => renderRecordsPostCard(basePath, lang, view, card, options)).join("");
    return {
      key,
      label: notesLibraryMonthLabel(key, lang),
      cardsHtml,
      sectionHtml: `<section class="records-post-month" data-library-month data-month-key="${escapeHtml(key)}">
        <div class="records-post-month-head">
          <span>${escapeHtml(notesLibraryMonthLabel(key, lang))}</span>
        </div>
        <div class="records-post-grid" data-library-grid>${cardsHtml}</div>
      </section>`,
    };
  });
}

function recordsLazyCopy(lang: SiteLang): { more: string; loading: string; done: string; error: string } {
  if (lang === "en") return { more: "Load more", loading: "Loading...", done: "All records loaded", error: "Could not load more. Try again." };
  if (lang === "es") return { more: "Cargar mas", loading: "Cargando...", done: "Todo cargado", error: "No se pudo cargar mas." };
  if (lang === "pt-BR") return { more: "Carregar mais", loading: "Carregando...", done: "Tudo carregado", error: "Nao foi possivel carregar mais." };
  return { more: "さらに読み込む", loading: "読み込み中...", done: "すべて読み込みました", error: "追加読み込みに失敗しました。もう一度試してください。" };
}

function renderRecordsLazyFooter(lang: SiteLang, nextCursor: string | null | undefined): string {
  const copy = recordsLazyCopy(lang);
  return `<div class="records-lazy-footer" data-records-lazy-footer${nextCursor ? "" : " hidden"}>
    <button type="button" data-records-load-more data-next-cursor="${escapeHtml(nextCursor ?? "")}">${escapeHtml(copy.more)}</button>
    <span data-records-lazy-status aria-live="polite"></span>
  </div>`;
}

function renderRecordsLazyScript(lang: SiteLang): string {
  const copy = recordsLazyCopy(lang);
  return `<script>
(function () {
  var copy = ${JSON.stringify(copy)};
  function detectRecordsScrollRoot(node) {
    var current = node && node.parentElement;
    while (current && current !== document.body && current !== document.documentElement) {
      var style = window.getComputedStyle ? window.getComputedStyle(current) : null;
      var overflowY = style ? style.overflowY : '';
      if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight + 8) return current;
      current = current.parentElement;
    }
    return null;
  }
  document.querySelectorAll('[data-records-lazy-root]').forEach(function (root) {
    var endpoint = root.getAttribute('data-records-lazy-endpoint') || '';
    var button = root.querySelector('[data-records-load-more]');
    var status = root.querySelector('[data-records-lazy-status]');
    var footer = root.querySelector('[data-records-lazy-footer]');
    var scroller = detectRecordsScrollRoot(root);
    var loading = false;
    var scheduled = false;
    if (!endpoint || !button) return;
    function setStatus(message) {
      if (status) status.textContent = message || '';
    }
    function appendMonth(month) {
      var months = Array.prototype.slice.call(root.querySelectorAll('[data-library-month]'));
      var existing = months.find(function (node) { return node.getAttribute('data-month-key') === month.key; });
      if (existing) {
        var grid = existing.querySelector('[data-library-grid]');
        if (grid) grid.insertAdjacentHTML('beforeend', month.cardsHtml || '');
        return;
      }
      if (footer) footer.insertAdjacentHTML('beforebegin', month.sectionHtml || '');
      else root.insertAdjacentHTML('beforeend', month.sectionHtml || '');
    }
    function loadMore() {
      var cursor = button.getAttribute('data-next-cursor') || '';
      if (!cursor || button.disabled || loading) return;
      loading = true;
      button.disabled = true;
      button.textContent = copy.loading;
      setStatus('');
      var url = endpoint + (endpoint.indexOf('?') >= 0 ? '&' : '?') + 'cursor=' + encodeURIComponent(cursor) + '&lang=${escapeHtml(lang)}';
      fetch(url, { headers: { accept: 'application/json' }, credentials: 'same-origin' })
        .then(function (response) {
          return response.json().catch(function () { return {}; }).then(function (json) {
            if (!response.ok || !json || json.ok === false) throw new Error(String((json && json.error) || response.status || 'load_failed'));
            return json;
          });
        })
        .then(function (json) {
          (json.months || []).forEach(appendMonth);
          if (json.nextCursor) {
            button.setAttribute('data-next-cursor', json.nextCursor);
            button.disabled = false;
            button.textContent = copy.more;
          } else {
            button.removeAttribute('data-next-cursor');
            if (footer) footer.hidden = true;
            setStatus(copy.done);
          }
          root.dispatchEvent(new Event('input', { bubbles: true }));
          var search = root.querySelector('[data-library-search]');
          if (search) search.dispatchEvent(new Event('input', { bubbles: true }));
        })
        .catch(function () {
          button.disabled = false;
          button.textContent = copy.more;
          setStatus(copy.error);
        })
        .finally(function () {
          loading = false;
          scheduleNearBottomCheck();
        });
    }
    function isFooterNearViewport() {
      if (!footer || footer.hidden || !button.getAttribute('data-next-cursor')) return false;
      var rect = footer.getBoundingClientRect();
      var viewportTop = 0;
      var viewportBottom = window.innerHeight || document.documentElement.clientHeight || 0;
      if (scroller) {
        var rootRect = scroller.getBoundingClientRect();
        viewportTop = rootRect.top;
        viewportBottom = rootRect.bottom;
      }
      return rect.top <= viewportBottom + 720 && rect.bottom >= viewportTop - 720;
    }
    function scheduleNearBottomCheck() {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(function () {
        scheduled = false;
        if (isFooterNearViewport()) loadMore();
      });
    }
    button.addEventListener('click', loadMore);
    if ('IntersectionObserver' in window && footer) {
      var observer = new IntersectionObserver(function (entries) {
        if (entries.some(function (entry) { return entry.isIntersecting; })) loadMore();
      }, { root: scroller, rootMargin: '640px 0px 640px 0px' });
      observer.observe(footer);
    }
    (scroller || window).addEventListener('scroll', scheduleNearBottomCheck, { passive: true });
    window.addEventListener('resize', scheduleNearBottomCheck);
    window.setTimeout(scheduleNearBottomCheck, 160);
  });
})();
</script>`;
}

function renderRecordsCollapsedControls(lang: SiteLang, initialSearch = ""): string {
  const label = lang === "ja" ? "探す/絞る" : lang === "es" ? "Buscar/filtrar" : lang === "pt-BR" ? "Buscar/filtrar" : "Search/filter";
  return `<details class="records-tools">
    <summary>${escapeHtml(label)}</summary>
    ${renderNotesLibraryControls(lang, initialSearch)}
  </details>`;
}

function recordsSearchEmptyCopy(lang: SiteLang, query: string): string {
  const safeQuery = query.trim();
  if (lang === "en") return safeQuery ? `No records match "${safeQuery}".` : "No matching records.";
  if (lang === "es") return safeQuery ? `No hay registros para "${safeQuery}".` : "No hay registros coincidentes.";
  if (lang === "pt-BR") return safeQuery ? `Nenhum registro corresponde a "${safeQuery}".` : "Nenhum registro correspondente.";
  return safeQuery ? `「${safeQuery}」に一致する記録はありません。` : "一致する記録はありません。";
}

function recordsStoryCopy(lang: SiteLang): {
  eyebrow: string;
  title: string;
  lead: string;
  latest: string;
  revisit: string;
  naming: string;
  openLatest: string;
  addRecord: string;
  emptyTitle: string;
  emptyLead: string;
} {
  if (lang === "en") {
    return {
      eyebrow: "My observation story",
      title: "Turn records into a trail, not a list.",
      lead: "Start from the last field note, revisit a place, and keep the naming work visible.",
      latest: "Latest chapter",
      revisit: "Place thread",
      naming: "Name thread",
      openLatest: "Open latest",
      addRecord: "Add the next record",
      emptyTitle: "Start the first chapter.",
      emptyLead: "One photo, video, sound, place, or note is enough to begin your nature story.",
    };
  }
  return {
    eyebrow: "自分の自然観察ストーリー",
    title: "記録を一覧ではなく、続きのある物語にする。",
    lead: "前回の発見、よく行く場所、名前を確かめる余地を、次の行動につなげます。",
    latest: "最新の章",
    revisit: "場所の続き",
    naming: "名前の続き",
    openLatest: "最新を見る",
    addRecord: "次の記録を足す",
    emptyTitle: "最初の章を始める。",
    emptyLead: "写真・動画・音・場所・ひとことのどれか1つで、自分の自然観察ストーリーが始まります。",
  };
}

function renderRecordsStoryStrip(
  basePath: string,
  lang: SiteLang,
  snapshot: LandingSnapshot,
  ownEntries: LandingObservation[],
): string {
  const copy = recordsStoryCopy(lang);
  const recordHref = appendLangToHref(withBasePath(basePath, "/record"), lang);
  if (ownEntries.length === 0) {
    return `<section class="records-story" aria-label="${escapeHtml(copy.eyebrow)}">
      <div class="records-story-head">
        <span>${escapeHtml(copy.eyebrow)}</span>
        <h1>${escapeHtml(copy.emptyTitle)}</h1>
        <p>${escapeHtml(copy.emptyLead)}</p>
      </div>
      <a class="records-story-primary" href="${escapeHtml(recordHref)}" data-kpi-action="records:story:first_record" data-kpi-event="primary_cta_click" data-kpi-funnel="landing_record" data-kpi-target="${escapeHtml(recordHref)}">${escapeHtml(copy.addRecord)}</a>
    </section>`;
  }

  const latest = ownEntries[0]!;
  const latestTitle = formatTaxonDisplayName({
    vernacularName: latest.vernacularName,
    scientificName: latest.scientificName,
    displayName: latest.displayName,
    aiCandidateName: latest.aiCandidateName,
    fallback: latest.proposedName ?? (lang === "ja" ? "名前を確かめている記録" : "Record to identify"),
  }, lang).primaryLabel;
  const latestHref = notesDetailHref(basePath, lang, latest);
  const revisitId = latest.visitId || latest.detailId || latest.occurrenceId;
  const revisitHref = appendLangToHref(withBasePath(basePath, `/record?start=gallery&revisitObservationId=${encodeURIComponent(revisitId)}`), lang);
  const latestPlace = notesPlaceLine(latest, lang, "owner") || (lang === "ja" ? "場所未設定" : "No place yet");
  const namedCount = ownEntries.filter((obs) => !notesLibraryIsUncertain(obs)).length;
  const needsNameCount = Math.max(0, ownEntries.length - namedCount);
  const placeCount = snapshot.myPlaces.length || new Set(ownEntries.map((obs) => notesPlaceLine(obs, lang, "owner")).filter(Boolean)).size;
  const activeDays = snapshot.habit?.activeDaysLast60 ?? 0;
  const latestLine = `${notesLibraryDateLabel(latest, lang)} · ${latestPlace}`;

  return `<section class="records-story" aria-label="${escapeHtml(copy.eyebrow)}">
    <div class="records-story-head">
      <span>${escapeHtml(copy.eyebrow)}</span>
      <h1>${escapeHtml(copy.title)}</h1>
      <p>${escapeHtml(copy.lead)}</p>
    </div>
    <div class="records-story-metrics" aria-label="${escapeHtml(copy.eyebrow)} metrics">
      <span><strong>${escapeHtml(formatNotesNumber(ownEntries.length, lang))}</strong>${escapeHtml(notesItemCountLabel(ownEntries.length, lang).replace(/^[\d,.]+\s*/, ""))}</span>
      <span><strong>${escapeHtml(formatNotesNumber(placeCount, lang))}</strong>${escapeHtml(lang === "ja" ? "場所" : "places")}</span>
      <span><strong>${escapeHtml(formatNotesNumber(activeDays, lang))}</strong>${escapeHtml(lang === "ja" ? "観察日" : "days")}</span>
    </div>
    <div class="records-story-cards">
      <a class="records-story-card is-featured" href="${escapeHtml(latestHref)}" data-kpi-action="records:story:latest">
        <small>${escapeHtml(copy.latest)}</small>
        <strong>${escapeHtml(latestTitle)}</strong>
        <span>${escapeHtml(latestLine)}</span>
        <em>${escapeHtml(copy.openLatest)}</em>
      </a>
      <a class="records-story-card" href="${escapeHtml(revisitHref)}" data-kpi-action="records:story:revisit" data-kpi-event="primary_cta_click" data-kpi-funnel="landing_record" data-kpi-target="${escapeHtml(revisitHref)}">
        <small>${escapeHtml(copy.revisit)}</small>
        <strong>${escapeHtml(latestPlace)}</strong>
        <span>${escapeHtml(lang === "ja" ? "同じ場所で季節や個体数の変化を足す" : "Add the next change at the same place")}</span>
        <em>${escapeHtml(copy.addRecord)}</em>
      </a>
      <a class="records-story-card" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/records?view=needs_id"), lang))}" data-kpi-action="records:story:naming">
        <small>${escapeHtml(copy.naming)}</small>
        <strong>${escapeHtml(formatNotesNumber(needsNameCount, lang))}</strong>
        <span>${escapeHtml(lang === "ja" ? "名前を確かめる余地がある記録" : "Records still open for naming")}</span>
        <em>${escapeHtml(lang === "ja" ? "名前待ちを見る" : "Open needs ID")}</em>
      </a>
    </div>
  </section>`;
}

type IdentificationSummaryReferenceMap = Map<string, ReferenceCandidate[]>;

type IdentificationSummaryCopy = {
  title: string;
  activeNav: string;
  lead: string;
  continueAction: string;
  libraryAction: string;
  metrics: {
    waiting: string;
    referenceReady: string;
    held: string;
    missingEvidence: string;
    doneToday: string;
  };
  metricNotes: {
    waiting: string;
    referenceReady: string;
    held: string;
    missingEvidence: string;
    doneToday: string;
  };
  lanes: {
    referenceReady: string;
    mediaReady: string;
    stalled: string;
  };
  laneLeads: {
    referenceReady: string;
    mediaReady: string;
    stalled: string;
  };
  preview: string;
  evidenceHealth: string;
  recentDecisions: string;
  teamStatus: string;
  open: string;
  openWorkbench: string;
  noRecords: string;
  emptyLane: string;
  sourceLabel: string;
  noReference: string;
};

function identificationSummaryCopy(lang: SiteLang): IdentificationSummaryCopy {
  if (lang === "ja") {
    return {
      title: "名前確認 | ikimon",
      activeNav: "名前確認",
      lead: "名前待ちの記録と、根拠が足りない記録を整理します。",
      continueAction: "名前確認を続ける",
      libraryAction: "資料ライブラリ",
      metrics: {
        waiting: "名前待ち",
        referenceReady: "資料候補あり",
        held: "保留中",
        missingEvidence: "追加写真が必要",
        doneToday: "今日処理した",
      },
      metricNotes: {
        waiting: "人の確認がまだ少ない対象",
        referenceReady: "登録済み資料で確認しやすい対象",
        held: "MVPでは作業台側で管理",
        missingEvidence: "写真・動画が足りない可能性",
        doneToday: "自分の同定メモから集計",
      },
      lanes: {
        referenceReady: "資料で確認できる記録",
        mediaReady: "写真を見れば進めやすい記録",
        stalled: "止まっている記録",
      },
      laneLeads: {
        referenceReady: "登録済み資料の候補が見つかった記録。",
        mediaReady: "写真・動画と候補名があり、作業台へ進めやすい記録。",
        stalled: "写真不足、候補名不足、または根拠補完が必要な記録。",
      },
      preview: "選択中の記録",
      evidenceHealth: "根拠の状態",
      recentDecisions: "最近の同定",
      teamStatus: "団体ステータス",
      open: "開く",
      openWorkbench: "作業台で開く",
      noRecords: "今は名前待ちの記録がありません。",
      emptyLane: "この条件の記録はまだありません。",
      sourceLabel: "この資料で確認",
      noReference: "資料なし",
    };
  }
  return {
    title: "Identification summary | ikimon",
    activeNav: "ID summary",
    lead: "Organize records waiting for names and evidence before opening the workbench.",
    continueAction: "Continue identifying",
    libraryAction: "Reference library",
    metrics: {
      waiting: "Waiting",
      referenceReady: "References",
      held: "On hold",
      missingEvidence: "Need media",
      doneToday: "Done today",
    },
    metricNotes: {
      waiting: "Records with little human confirmation",
      referenceReady: "Records with matching reference candidates",
      held: "Managed in the workbench MVP",
      missingEvidence: "May need more photos or video",
      doneToday: "From your ID notes",
    },
    lanes: {
      referenceReady: "Records ready for references",
      mediaReady: "Records easy to inspect",
      stalled: "Records that need evidence",
    },
    laneLeads: {
      referenceReady: "Registered references are available for these records.",
      mediaReady: "Media and a candidate name make these easier to review.",
      stalled: "These need more media, a candidate name, or evidence cleanup.",
    },
    preview: "Selected record",
    evidenceHealth: "Evidence health",
    recentDecisions: "Recent decisions",
    teamStatus: "Team status",
    open: "Open",
    openWorkbench: "Open workbench",
    noRecords: "No records are waiting for identification right now.",
    emptyLane: "No records match this lane yet.",
    sourceLabel: "Check with this reference",
    noReference: "No reference",
  };
}

async function loadIdentificationSummaryReferences(
  viewerUserId: string | null | undefined,
  entries: LandingObservation[],
  lang: SiteLang,
): Promise<IdentificationSummaryReferenceMap> {
  if (!viewerUserId) return new Map();
  const cards = buildRecordsPostCards(entries, lang).slice(0, 12);
  const pairs = await Promise.all(cards.map(async (card) => {
    const proposedName = card.aiCandidateName ?? card.displayName ?? card.proposedName ?? null;
    const references = await listReferenceCandidatesForIdentification({
      userId: viewerUserId,
      occurrenceId: card.occurrenceId,
      proposedName,
      limit: 3,
    }).catch(() => []);
    return [card.occurrenceId, references] as const;
  }));
  return new Map(pairs.filter(([, references]) => references.length > 0));
}

function identificationSummaryHasCandidate(card: RecordsPostCard): boolean {
  return Boolean((card.aiCandidateName || card.scientificName || card.vernacularName || card.displayName || card.proposedName || "").trim());
}

function identificationSummaryWorkHref(basePath: string, lang: SiteLang): string {
  return recordsViewHref(basePath, lang, "needs_id");
}

function identificationSummaryRecordHref(basePath: string, lang: SiteLang, card: RecordsPostCard): string {
  return `${notesDetailHref(basePath, lang, card)}#identify`;
}

function identificationSummaryCardTitle(card: RecordsPostCard, lang: SiteLang): string {
  return recordsPostSubjectName(card, lang) || (lang === "ja" ? "名前を確認中" : "Name pending");
}

function identificationSummaryChipHtml(labels: string[]): string {
  return labels.map((label) => `<span>${escapeHtml(label)}</span>`).join("");
}

function renderIdentificationSummaryMedia(card: RecordsPostCard, lang: SiteLang): string {
  const title = identificationSummaryCardTitle(card, lang);
  const mediaUrl = recordsRepresentativeMediaUrl(card);
  if (mediaUrl) {
    return `<span class="identification-summary-thumb"><img src="${escapeHtml(mediaUrl)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async" /></span>`;
  }
  return `<span class="identification-summary-thumb is-empty"><span>${escapeHtml(lang === "ja" ? "写真なし" : "No media")}</span></span>`;
}

function renderIdentificationSummaryQueueItem(
  basePath: string,
  lang: SiteLang,
  card: RecordsPostCard,
  references: ReferenceCandidate[],
  chips: string[],
  copy: IdentificationSummaryCopy,
): string {
  const title = identificationSummaryCardTitle(card, lang);
  const placeLine = notesPlaceLine(card, lang, "public") || (lang === "ja" ? "公開位置は丸め済み" : "Location rounded");
  const dateLabel = notesLibraryDateLabel(card, lang);
  const referenceTitle = references[0]?.title;
  return `<article class="identification-summary-item">
    <a class="identification-summary-item-main" href="${escapeHtml(identificationSummaryRecordHref(basePath, lang, card))}">
      ${renderIdentificationSummaryMedia(card, lang)}
      <span class="identification-summary-item-body">
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(`${placeLine} · ${dateLabel}`)}</small>
        <span class="identification-summary-chips">${identificationSummaryChipHtml(chips)}</span>
        ${referenceTitle ? `<em>${escapeHtml(`${copy.sourceLabel}: ${referenceTitle}`)}</em>` : ""}
      </span>
    </a>
    <a class="identification-summary-open" href="${escapeHtml(identificationSummaryWorkHref(basePath, lang))}">${escapeHtml(copy.open)}</a>
  </article>`;
}

function renderIdentificationSummaryLane(
  basePath: string,
  lang: SiteLang,
  title: string,
  lead: string,
  cards: RecordsPostCard[],
  referenceMap: IdentificationSummaryReferenceMap,
  copy: IdentificationSummaryCopy,
  chipBuilder: (card: RecordsPostCard, references: ReferenceCandidate[]) => string[],
): string {
  return `<section class="identification-summary-lane">
    <div class="identification-summary-lane-head">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(lead)}</p>
    </div>
    <div class="identification-summary-list">
      ${cards.length > 0
        ? cards.map((card) => {
          const references = referenceMap.get(card.occurrenceId) ?? [];
          return renderIdentificationSummaryQueueItem(basePath, lang, card, references, chipBuilder(card, references), copy);
        }).join("")
        : `<div class="identification-summary-empty">${escapeHtml(copy.emptyLane)}</div>`}
    </div>
  </section>`;
}

function renderIdentificationSummaryMetric(label: string, value: number, note: string): string {
  return `<div class="identification-summary-metric">
    <strong>${escapeHtml(String(value))}</strong>
    <span>${escapeHtml(label)}</span>
    <small>${escapeHtml(note)}</small>
  </div>`;
}

function renderIdentificationSummaryPreview(
  basePath: string,
  lang: SiteLang,
  card: RecordsPostCard | null,
  references: ReferenceCandidate[],
  copy: IdentificationSummaryCopy,
): string {
  if (!card) {
    return `<aside class="identification-summary-preview">
      <div class="identification-summary-panel-head"><span>${escapeHtml(copy.preview)}</span><h2>${escapeHtml(copy.noRecords)}</h2></div>
      <a class="identification-summary-primary" href="${escapeHtml(identificationSummaryWorkHref(basePath, lang))}">${escapeHtml(copy.openWorkbench)}</a>
    </aside>`;
  }
  const title = identificationSummaryCardTitle(card, lang);
  const placeLine = notesPlaceLine(card, lang, "public") || (lang === "ja" ? "公開位置は丸め済み" : "Location rounded");
  const dateLabel = notesLibraryDateLabel(card, lang);
  const referenceRows = references.length > 0
    ? references.slice(0, 3).map((reference) => `<li><strong>${escapeHtml(reference.title)}</strong><span>${escapeHtml(reference.reason)}</span></li>`).join("")
    : `<li><strong>${escapeHtml(copy.noReference)}</strong><span>${escapeHtml(lang === "ja" ? "作業台で資料を登録・選択できます。" : "Add or select references in the workbench.")}</span></li>`;
  return `<aside class="identification-summary-preview">
    <div class="identification-summary-panel-head"><span>${escapeHtml(copy.preview)}</span><h2>${escapeHtml(title)}</h2></div>
    ${renderIdentificationSummaryMedia(card, lang)}
    <p>${escapeHtml(`${placeLine} · ${dateLabel}`)}</p>
    <div class="identification-summary-preview-tags">
      ${identificationSummaryChipHtml([
        card.postNeedsId ? copy.metrics.waiting : lang === "ja" ? "確認あり" : "Has ID",
        recordsHasMedia(card) ? (lang === "ja" ? "写真あり" : "Has media") : copy.metrics.missingEvidence,
        references.length > 0 ? copy.metrics.referenceReady : copy.noReference,
      ])}
    </div>
    <div class="identification-summary-reference-box">
      <strong>${escapeHtml(copy.sourceLabel)}</strong>
      <ul>${referenceRows}</ul>
    </div>
    <a class="identification-summary-primary" href="${escapeHtml(identificationSummaryWorkHref(basePath, lang))}">${escapeHtml(copy.openWorkbench)}</a>
  </aside>`;
}

function renderIdentificationSummaryEvidenceHealth(copy: IdentificationSummaryCopy, referenceReadyCount: number, missingEvidenceCount: number): string {
  const rows = [
    { label: copy.metrics.referenceReady, value: referenceReadyCount, note: copy.metricNotes.referenceReady },
    { label: copy.metrics.missingEvidence, value: missingEvidenceCount, note: copy.metricNotes.missingEvidence },
    { label: copy.metrics.held, value: 0, note: copy.metricNotes.held },
    { label: "Tier 3", value: referenceReadyCount, note: "資料根拠がある候補から確認" },
  ];
  return `<section class="identification-summary-panel">
    <div class="identification-summary-panel-head"><span>${escapeHtml(copy.evidenceHealth)}</span><h2>${escapeHtml(copy.sourceLabel)}</h2></div>
    <div class="identification-summary-health-list">
      ${rows.map((row) => `<div><strong>${escapeHtml(row.label)}</strong><span>${escapeHtml(String(row.value))}</span><small>${escapeHtml(row.note)}</small></div>`).join("")}
    </div>
  </section>`;
}

function renderIdentificationSummaryRecentDecisions(lang: SiteLang, ownEntries: LandingObservation[], copy: IdentificationSummaryCopy): string {
  const decisions = ownEntries.filter((entry) => (entry.entryType ?? "observation") === "identification").slice(0, 5);
  return `<section class="identification-summary-panel">
    <div class="identification-summary-panel-head"><span>${escapeHtml(copy.recentDecisions)}</span><h2>${escapeHtml(lang === "ja" ? "直近の作業ログ" : "Latest activity")}</h2></div>
    <div class="identification-summary-decisions">
      ${decisions.length > 0
        ? decisions.map((entry) => `<div><strong>${escapeHtml(entry.proposedName || entry.displayName || (lang === "ja" ? "同定メモ" : "ID note"))}</strong><span>${escapeHtml(`${notesLibraryDateLabel(entry, lang)} · ${copy.noReference}`)}</span></div>`).join("")
        : `<div><strong>${escapeHtml(lang === "ja" ? "まだありません" : "No decisions yet")}</strong><span>${escapeHtml(copy.metricNotes.doneToday)}</span></div>`}
    </div>
  </section>`;
}

function renderIdentificationSummaryTeamStatus(copy: IdentificationSummaryCopy, waitingCount: number, doneToday: number): string {
  return `<section class="identification-summary-panel">
    <div class="identification-summary-panel-head"><span>${escapeHtml(copy.teamStatus)}</span><h2>${escapeHtml("MVP")}</h2></div>
    <div class="identification-summary-team-grid">
      <div><strong>${escapeHtml(String(waitingCount))}</strong><span>${escapeHtml(copy.metrics.waiting)}</span></div>
      <div><strong>${escapeHtml(String(doneToday))}</strong><span>${escapeHtml(copy.metrics.doneToday)}</span></div>
      <div><strong>0</strong><span>${escapeHtml(copy.metrics.held)}</span></div>
    </div>
  </section>`;
}

function renderIdentificationSummary(
  basePath: string,
  lang: SiteLang,
  snapshot: LandingSnapshot,
  publicEntries: LandingObservation[],
  referenceMap: IdentificationSummaryReferenceMap,
  options: { ownPage?: LandingFeedPage | null } = {},
): string {
  const copy = identificationSummaryCopy(lang);
  const ownEntries = snapshot.viewerUserId ? (options.ownPage?.entries ?? snapshot.myFeed) : [];
  const needsEntries = recordWorkbenchEntriesForView("needs_id", ownEntries, publicEntries);
  const cards = buildRecordsPostCards(needsEntries, lang);
  const referenceReadyCards = cards.filter((card) => (referenceMap.get(card.occurrenceId)?.length ?? 0) > 0);
  const mediaReadyCards = cards.filter((card) => recordsHasMedia(card) && identificationSummaryHasCandidate(card) && !referenceReadyCards.includes(card));
  const stalledCards = cards.filter((card) => !recordsHasMedia(card) || !identificationSummaryHasCandidate(card));
  const missingEvidenceCount = cards.filter((card) => !recordsHasMedia(card)).length;
  const todayKey = new Date().toISOString().slice(0, 10);
  const doneToday = ownEntries.filter((entry) => (entry.entryType ?? "observation") === "identification" && notesEntryDate(entry).slice(0, 10) === todayKey).length;
  const previewCard = referenceReadyCards[0] ?? mediaReadyCards[0] ?? stalledCards[0] ?? cards[0] ?? null;
  const previewReferences = previewCard ? (referenceMap.get(previewCard.occurrenceId) ?? []) : [];
  const workbenchHref = identificationSummaryWorkHref(basePath, lang);
  const libraryHref = appendLangToHref(withBasePath(basePath, "/references"), lang);

  return `<div class="records-workbench identification-summary" data-testid="identification-summary">
    <header class="records-topbar identification-summary-topbar">
      <div class="records-topbar-brand">
        <strong>${escapeHtml(copy.activeNav)}</strong>
      </div>
      ${renderRecordsViewTabs(basePath, lang, "identification_summary", recordsWorkbenchCopy(lang))}
      <div class="records-actions" aria-label="${escapeHtml(observationIndexCopy(lang).relatedActionsAria)}">
        <a href="${escapeHtml(libraryHref)}">${escapeHtml(copy.libraryAction)}</a>
        <a class="is-primary" href="${escapeHtml(workbenchHref)}">${escapeHtml(copy.continueAction)}</a>
      </div>
    </header>
    <div class="identification-summary-main">
      <section class="identification-summary-hero">
        <div>
          <span>${escapeHtml(copy.activeNav)}</span>
          <h1>${escapeHtml(copy.activeNav)}</h1>
          <p>${escapeHtml(copy.lead)}</p>
        </div>
        <a class="identification-summary-primary" href="${escapeHtml(workbenchHref)}">${escapeHtml(copy.continueAction)}</a>
      </section>
      <section class="identification-summary-scopes" aria-label="${escapeHtml(copy.activeNav)} filters">
        ${["すべて", "自分の担当", "団体", "近く"].map((label, index) => `<button type="button" class="${index === 0 ? "is-active" : ""}">${escapeHtml(label)}</button>`).join("")}
      </section>
      <section class="identification-summary-metrics" aria-label="${escapeHtml(copy.activeNav)} metrics">
        ${renderIdentificationSummaryMetric(copy.metrics.waiting, cards.length, copy.metricNotes.waiting)}
        ${renderIdentificationSummaryMetric(copy.metrics.referenceReady, referenceReadyCards.length, copy.metricNotes.referenceReady)}
        ${renderIdentificationSummaryMetric(copy.metrics.held, 0, copy.metricNotes.held)}
        ${renderIdentificationSummaryMetric(copy.metrics.missingEvidence, missingEvidenceCount, copy.metricNotes.missingEvidence)}
        ${renderIdentificationSummaryMetric(copy.metrics.doneToday, doneToday, copy.metricNotes.doneToday)}
      </section>
      <section class="identification-summary-work">
        <div class="identification-summary-lanes">
          ${renderIdentificationSummaryLane(basePath, lang, copy.lanes.referenceReady, copy.laneLeads.referenceReady, referenceReadyCards.slice(0, 5), referenceMap, copy, (_card, references) => [
            copy.sourceLabel,
            references[0]?.owned ? "所有確認済み" : "共有カタログ",
            recordsHasMedia(_card) ? "写真あり" : copy.metrics.missingEvidence,
          ])}
          ${renderIdentificationSummaryLane(basePath, lang, copy.lanes.mediaReady, copy.laneLeads.mediaReady, mediaReadyCards.slice(0, 5), referenceMap, copy, (card) => [
            recordsHasMedia(card) ? "写真あり" : copy.metrics.missingEvidence,
            identificationSummaryHasCandidate(card) ? "候補名あり" : "名前を確認中",
            copy.metrics.waiting,
          ])}
          ${renderIdentificationSummaryLane(basePath, lang, copy.lanes.stalled, copy.laneLeads.stalled, stalledCards.slice(0, 5), referenceMap, copy, (card) => [
            recordsHasMedia(card) ? "写真あり" : copy.metrics.missingEvidence,
            identificationSummaryHasCandidate(card) ? "候補名あり" : "名前を確認中",
            copy.noReference,
          ])}
        </div>
        ${renderIdentificationSummaryPreview(basePath, lang, previewCard, previewReferences, copy)}
      </section>
      <section class="identification-summary-bottom">
        ${renderIdentificationSummaryEvidenceHealth(copy, referenceReadyCards.length, missingEvidenceCount)}
        ${renderIdentificationSummaryRecentDecisions(lang, ownEntries, copy)}
        ${renderIdentificationSummaryTeamStatus(copy, cards.length, doneToday)}
      </section>
    </div>
  </div>`;
}

function renderRecordsIdentifyIntro(basePath: string, lang: SiteLang, entries: LandingObservation[], canWriteIdentification: boolean): string {
  const cards = buildRecordsPostCards(entries, lang).filter((card) => card.postNeedsId);
  const waitingCount = cards.length;
  const mediaReadyCount = cards.filter(recordsHasMedia).length;
  const candidateCount = cards.filter((card) => Boolean(card.postCandidateName?.trim())).length;
  const copy = lang === "ja"
    ? {
        eyebrow: "名前待ち",
        title: "名前待ちの記録を確かめる",
        lead: "写真・動画・場所・候補名を見比べて、確信できる根拠だけを残します。AI候補は確定名ではなく、確認の入口として扱います。",
        waiting: "名前待ち",
        media: "写真・動画あり",
        candidate: "候補あり",
        open: "カードを選ぶ",
        noWaitingTitle: "名前待ちの記録は今はありません",
        noWaitingLead: "今は名前を待つ公開記録が見つかりません。名前が分からない発見があれば、まず記録として残せます。",
        records: "名前不明でも記録",
        map: "最近の記録を見る",
        reference: "資料を登録",
        login: "ログインすると名前確認メモを保存できます。",
      }
    : {
        eyebrow: "Identification",
        title: "Help check names with evidence",
        lead: "Compare media, place, and candidate names, then save only the basis you can support. AI candidates stay as hints.",
        waiting: "Waiting",
        media: "Media ready",
        candidate: "Candidates",
        open: "Choose a card",
        noWaitingTitle: "No records are waiting for names right now",
        noWaitingLead: "The queue has moved forward. If you find something unnamed, save it first and review recent records for the loop.",
        records: "Record without a name",
        map: "Review recent records",
        reference: "Add reference",
        login: "Log in to save identification notes.",
      };
  if (waitingCount === 0) {
    return `<section class="records-identify-intro is-empty" data-testid="records-identify-intro">
      <div class="records-identify-intro-copy">
        <span>${escapeHtml(copy.eyebrow)}</span>
        <h1>${escapeHtml(copy.noWaitingTitle)}</h1>
        <p>${escapeHtml(copy.noWaitingLead)}</p>
        ${canWriteIdentification ? "" : `<em>${escapeHtml(copy.login)}</em>`}
      </div>
      <div class="records-identify-intro-actions">
        <a class="is-primary" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/record"), lang))}">${escapeHtml(copy.records)}</a>
        <a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/records?view=public"), lang))}">${escapeHtml(copy.map)}</a>
      </div>
    </section>`;
  }
  return `<section class="records-identify-intro" data-testid="records-identify-intro">
    <div class="records-identify-intro-copy">
      <span>${escapeHtml(copy.eyebrow)}</span>
      <h1>${escapeHtml(copy.title)}</h1>
      <p>${escapeHtml(copy.lead)}</p>
      ${canWriteIdentification ? "" : `<em>${escapeHtml(copy.login)}</em>`}
    </div>
    <div class="records-identify-intro-metrics" aria-label="${escapeHtml(copy.eyebrow)} metrics">
      <a href="#records-identify-list"><strong>${escapeHtml(formatNotesNumber(waitingCount, lang))}</strong><span>${escapeHtml(copy.waiting)}</span></a>
      <a href="#records-identify-list"><strong>${escapeHtml(formatNotesNumber(mediaReadyCount, lang))}</strong><span>${escapeHtml(copy.media)}</span></a>
      <a href="#records-identify-list"><strong>${escapeHtml(formatNotesNumber(candidateCount, lang))}</strong><span>${escapeHtml(copy.candidate)}</span></a>
    </div>
    <div class="records-identify-intro-actions">
      <a class="is-primary" href="#records-identify-list">${escapeHtml(copy.open)}</a>
      <a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/references/capture?returnTo=%2Frecords%3Fview%3Dneeds_id"), lang))}">${escapeHtml(copy.reference)}</a>
    </div>
  </section>`;
}

function renderRecordsWorkbench(
  basePath: string,
  lang: SiteLang,
  view: RecordsWorkbenchView,
  snapshot: LandingSnapshot,
  publicEntries: LandingObservation[],
  civicContexts: Map<string, CivicObservationContext>,
  options: {
    ownPage?: LandingFeedPage | null;
    publicPage?: { nextCursor: string | null } | null;
    canWriteIdentification?: boolean;
    heldOccurrenceIds?: Set<string>;
    searchQuery?: string;
    arrivalSource?: RecordsArrivalSource;
    savedId?: string;
  } = {},
): string {
  const copy = recordsWorkbenchCopy(lang);
  const ownEntries = snapshot.viewerUserId ? (options.ownPage?.entries ?? snapshot.myFeed) : [];
  const savedId = (options.savedId ?? "").trim();
  const entries = prioritizeSavedRecord(
    recordWorkbenchEntriesForView(view, ownEntries, publicEntries, {
      heldOccurrenceIds: options.heldOccurrenceIds,
    }),
    view === "mine" ? savedId : "",
  );
  const locationMode = view === "mine" && snapshot.viewerUserId ? "owner" : "public";
  const cardsForArrival = view === "mine" ? buildRecordsPostCards(entries, lang) : [];
  const savedRecordFound = cardsForArrival.some((card) => recordsCardMatchesSavedId(card, savedId));
  const searchQuery = (options.searchQuery ?? "").trim().slice(0, 80);
  const canLazyLoadMine = view === "mine" && Boolean(snapshot.viewerUserId);
  const canLazyLoadPublic = view === "public" && Boolean(options.publicPage);
  const lazyEndpoint = canLazyLoadPublic
    ? withBasePath(basePath, `/api/v1/records/public-page${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ""}`)
    : withBasePath(basePath, "/api/v1/records/mine-page");
  const canLazyLoad = canLazyLoadMine || canLazyLoadPublic;
  const lazyNextCursor = canLazyLoadPublic ? options.publicPage?.nextCursor ?? null : options.ownPage?.nextCursor ?? null;
  const isIdentifyView = view === "needs_id";
  const canWriteIdentification = Boolean(options.canWriteIdentification);
  const identifyEmpty = isIdentifyView && entries.length === 0;
  return `<div class="records-workbench${isIdentifyView ? " has-identify-panel" : ""}" data-testid="records-workbench"${isIdentifyView ? " data-records-identify-workbench" : ""}>
    <header class="records-topbar">
      <div class="records-topbar-brand">
        <strong>${escapeHtml(copy.activeNav)}</strong>
      </div>
      ${renderRecordsViewTabs(basePath, lang, view, copy)}
      <div class="records-actions" aria-label="${escapeHtml(observationIndexCopy(lang).relatedActionsAria)}">
        <a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/map"), lang))}">${escapeHtml(copy.mapLabel)}</a>
        <a class="is-primary" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/record"), lang))}" aria-label="${escapeHtml(observationIndexCopy(lang).recordActionAria)}">${escapeHtml(copy.recordLabel)}</a>
      </div>
    </header>
    <div class="records-main${isIdentifyView ? " is-identify" : ""}">
      ${view === "mine" && snapshot.viewerUserId ? renderRecordsArrivalBanner(basePath, lang, options.arrivalSource ?? null, savedId, savedRecordFound) : ""}
      ${view === "public" ? renderRecordsPublicIntro(basePath, lang, !snapshot.viewerUserId) : ""}
      ${view === "mine" ? renderRecordsMyPlacesLane(basePath, lang, snapshot, ownEntries) : ""}
      <section class="records-grid-panel" ${isIdentifyView ? `id="records-identify-list"` : ""} aria-label="${escapeHtml(copy.activeNav)}" data-notes-library data-record-timeline${canLazyLoad ? ` data-records-lazy-root data-records-lazy-endpoint="${escapeHtml(lazyEndpoint)}"` : ""}>
        ${isIdentifyView ? renderRecordsIdentifyIntro(basePath, lang, entries, canWriteIdentification) : ""}
        ${identifyEmpty ? "" : renderRecordsCollapsedControls(lang, searchQuery)}
        ${entries.length > 0
          ? renderRecordsPostMonths(basePath, lang, view, entries, { locationMode, civicContexts, highlightId: view === "mine" ? savedId : "" })
          : identifyEmpty
            ? ""
          : searchQuery
            ? `<div class="notes-library-empty">${escapeHtml(recordsSearchEmptyCopy(lang, searchQuery))}</div>`
            : renderRecordsEmptyState(basePath, lang, view, Boolean(snapshot.viewerUserId))}
        <div class="notes-library-empty notes-library-search-empty" data-library-search-empty hidden>${escapeHtml(recordsSearchEmptyCopy(lang, searchQuery))}</div>
        ${canLazyLoad ? renderRecordsLazyFooter(lang, lazyNextCursor) : ""}
      </section>
      ${isIdentifyView ? renderRecordsIdentifyPanel(basePath, lang, entries, { locationMode, canWrite: canWriteIdentification, civicContexts, fallbackEntries: publicEntries }) : ""}
    </div>
    ${renderNotesLibraryScript(lang)}
    ${canLazyLoad ? renderRecordsLazyScript(lang) : ""}
    ${isIdentifyView ? renderRecordsIdentifyPanelScript(lang) : ""}
    ${renderRecordsArrivalScript(options.arrivalSource ?? null, savedId)}
  </div>`;
}

const RECORDS_WORKBENCH_STYLES = `
  ${RECORD_CARD_SIZING_TOKENS}
  .shell.shell-records-workbench {
    width: min(100%, var(--ikimon-shell-effective-w, 100%), calc(100% - var(--ikimon-shell-margin-left, 0px) - var(--ikimon-shell-margin-right, 0px)));
    max-width: none;
    min-width: 0;
    padding: 0;
    overflow-x: clip;
  }
  .records-workbench {
    max-width: 100%;
    min-width: 0;
    min-height: calc(100dvh - 56px);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    background: #f8fafc;
  }
  .records-workbench [hidden] {
    display: none !important;
  }
  .records-topbar {
    position: sticky;
    top: 56px;
    z-index: 20;
    min-height: 58px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    padding: 8px 14px;
    background: rgba(255,255,255,.94);
    border-bottom: 1px solid rgba(15,23,42,.08);
    backdrop-filter: blur(18px);
  }
  .records-topbar-brand { display: flex; align-items: baseline; gap: 9px; min-width: 0; }
  .records-topbar-brand strong { color: #0f172a; font-size: 16px; line-height: 1; font-weight: 950; white-space: nowrap; }
  .records-view-tabs { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
  .records-view-tabs::-webkit-scrollbar { display: none; }
  .records-view-tabs a {
    min-height: 38px;
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
    padding: 0 13px;
    border-radius: 999px;
    background: #f8fafc;
    border: 1px solid rgba(15,23,42,.08);
    color: #334155;
    text-decoration: none;
    font-size: 13px;
    font-weight: 950;
  }
  .records-view-tabs a.is-active { background: #10251a; border-color: #10251a; color: #fff; }
  .records-actions { display: flex; gap: 8px; }
  .records-actions a {
    min-width: 40px;
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 14px;
    border-radius: 999px;
    background: #fff;
    border: 1px solid rgba(15,23,42,.1);
    color: #0f172a;
    text-decoration: none;
    font-size: 13px;
    font-weight: 950;
  }
  .records-actions a.is-primary { background: #064e3b; border-color: #064e3b; color: #fff; font-size: 24px; line-height: 1; }
  .records-main {
    max-width: 100%;
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
    min-height: 0;
    padding: 10px 14px 14px;
  }
  .records-arrival,
  .records-view-intro {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 16px;
    padding: 14px 16px;
    border: 1px solid rgba(5,150,105,.22);
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(236,253,245,.98), rgba(255,255,255,.98));
    color: #123226;
  }
  .records-arrival > div:first-child,
  .records-view-intro > div { min-width: 0; display: grid; gap: 3px; }
  .records-arrival span,
  .records-view-intro span { color: #047857; font-size: 11px; font-weight: 900; letter-spacing: .08em; }
  .records-arrival strong,
  .records-view-intro strong { color: #0f172a; font-size: 17px; line-height: 1.35; }
  .records-arrival p,
  .records-view-intro p { margin: 0; color: #475569; font-size: 13px; line-height: 1.65; }
  .records-arrival-actions { display: flex; align-items: center; gap: 8px; }
  .records-arrival-actions a,
  .records-view-intro > a,
  .records-empty-state > div a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    padding: 8px 14px;
    border: 1px solid rgba(5,150,105,.24);
    border-radius: 999px;
    background: #fff;
    color: #047857;
    font-size: 13px;
    font-weight: 900;
    white-space: nowrap;
  }
  .records-arrival-actions a.is-primary,
  .records-empty-state > div a.is-primary { background: #047857; border-color: #047857; color: #fff; }
  .records-empty-state { display: grid; gap: 8px; color: #475569; }
  .records-empty-state > strong { color: #0f172a; font-size: 18px; }
  .records-empty-state > p { margin: 0; }
  .records-empty-state > div { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 3px; }
  .records-post-card.is-just-saved { scroll-margin-top: 150px; }
  .records-post-card.is-just-saved .records-post-thumb {
    border-color: rgba(4,120,87,.9);
    box-shadow: 0 0 0 4px rgba(16,185,129,.2), var(--ikimon-record-card-thumb-shadow);
  }
  .records-post-saved-badge {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 5;
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 4px 9px;
    border-radius: 999px;
    background: rgba(4,120,87,.94);
    color: #fff;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .03em;
    box-shadow: 0 6px 18px rgba(4,120,87,.2);
  }
  .records-main.is-identify {
    grid-template-columns: minmax(0, 1fr) minmax(310px, 390px);
    align-items: start;
  }
  .records-my-places {
    align-self: start;
    min-width: 0;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 8px;
    align-items: center;
    padding: 8px;
    border: 1px solid rgba(15,23,42,.08);
    border-radius: 8px;
    background: #fff;
  }
  .records-my-places-head {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .records-my-places-head strong {
    color: #10251a;
    font-size: 13px;
    line-height: 1.2;
    font-weight: 950;
    white-space: nowrap;
  }
  .records-my-places-head span {
    min-height: 32px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0 8px;
    border-radius: 999px;
    background: #f0fdf4;
    color: #166534;
    font-size: 11px;
    line-height: 1;
    font-weight: 900;
    white-space: nowrap;
  }
  .records-my-places-head b {
    color: #10251a;
    font-size: 13px;
    font-weight: 950;
  }
  .records-my-places-list {
    min-width: 0;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(150px, 210px);
    gap: 7px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .records-my-places-list::-webkit-scrollbar { display: none; }
  .records-my-places-list a {
    min-width: 0;
    min-height: 50px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 3px 7px;
    align-content: center;
    padding: 7px 8px;
    border-radius: 8px;
    background: #f8fafc;
    border: 1px solid rgba(15,23,42,.08);
    color: #10251a;
    text-decoration: none;
  }
  .records-my-places-list a:hover,
  .records-my-places-list a:focus-visible {
    border-color: rgba(4,120,87,.32);
    background: #f0fdf4;
    outline: none;
  }
  .records-my-places-list strong,
  .records-my-places-list span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .records-my-places-list strong {
    color: #10251a;
    font-size: 12px;
    line-height: 1.25;
    font-weight: 950;
  }
  .records-my-places-list span {
    grid-column: 1;
    color: #475569;
    font-size: 10px;
    line-height: 1.2;
    font-weight: 850;
  }
  .records-my-places-list b {
    grid-column: 2;
    grid-row: 1 / span 2;
    align-self: center;
    min-width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: #dcfce7;
    color: #166534;
    font-size: 11px;
    line-height: 1;
    font-weight: 950;
  }
  .records-story {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: end;
    padding: 14px;
    border: 1px solid rgba(16,185,129,.16);
    border-radius: 14px;
    background:
      linear-gradient(135deg, rgba(236,253,245,.96), rgba(255,255,255,.96)),
      #fff;
    box-shadow: 0 16px 42px rgba(15,23,42,.07);
  }
  .records-story-head {
    min-width: 0;
    display: grid;
    gap: 5px;
  }
  .records-story-head span,
  .records-story-card small {
    color: #047857;
    font-size: 11px;
    font-weight: 950;
  }
  .records-story-head h1 {
    margin: 0;
    max-width: 22em;
    color: #10251a;
    font-size: clamp(22px, 2.6vw, 34px);
    line-height: 1.14;
    letter-spacing: 0;
    font-weight: 950;
  }
  .records-story-head p {
    margin: 0;
    max-width: 64em;
    color: #475569;
    font-size: 14px;
    line-height: 1.6;
    font-weight: 720;
  }
  .records-story-primary,
  .records-story-card em {
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 13px;
    border-radius: 999px;
    background: #047857;
    color: #fff;
    text-decoration: none;
    font-size: 13px;
    font-style: normal;
    font-weight: 950;
  }
  .records-story-metrics {
    display: flex;
    gap: 8px;
  }
  .records-story-metrics span {
    min-width: 74px;
    display: grid;
    gap: 3px;
    padding: 9px 10px;
    border-radius: 12px;
    background: rgba(255,255,255,.74);
    color: #64748b;
    font-size: 11px;
    font-weight: 850;
  }
  .records-story-metrics strong {
    color: #10251a;
    font-size: 20px;
    line-height: 1;
    font-weight: 950;
  }
  .records-story-cards {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: 1.25fr 1fr 1fr;
    gap: 10px;
  }
  .records-story-card {
    min-width: 0;
    min-height: 138px;
    display: grid;
    align-content: start;
    gap: 7px;
    padding: 13px;
    border: 1px solid rgba(15,23,42,.08);
    border-radius: 12px;
    background: #fff;
    color: #0f172a;
    text-decoration: none;
  }
  .records-story-card.is-featured {
    background: #10251a;
    color: #fff;
  }
  .records-story-card.is-featured small,
  .records-story-card.is-featured span {
    color: rgba(255,255,255,.72);
  }
  .records-story-card strong {
    color: inherit;
    font-size: 20px;
    line-height: 1.2;
    font-weight: 950;
  }
  .records-story-card span {
    color: #64748b;
    font-size: 12px;
    line-height: 1.45;
    font-weight: 760;
  }
  .records-story-card em {
    justify-self: start;
    margin-top: auto;
    background: #fff;
    color: #10251a;
    border: 1px solid rgba(15,23,42,.08);
  }
  .records-grid-panel {
    max-width: 100%;
    min-width: 0;
    display: grid;
    align-content: start;
    gap: 12px;
  }
  .records-identify-intro {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 12px;
    align-items: center;
    padding: 14px;
    border: 1px solid rgba(16,185,129,.18);
    border-radius: 8px;
    background:
      linear-gradient(135deg, rgba(236,253,245,.96), rgba(255,255,255,.96)),
      #fff;
    box-shadow: 0 14px 32px rgba(15,23,42,.055);
  }
  .records-identify-intro-copy {
    min-width: 0;
    display: grid;
    gap: 5px;
  }
  .records-identify-intro-copy span {
    color: #047857;
    font-size: 11px;
    line-height: 1.2;
    font-weight: 950;
  }
  .records-identify-intro-copy h1 {
    margin: 0;
    color: #10251a;
    font-size: 24px;
    line-height: 1.18;
    letter-spacing: 0;
    font-weight: 950;
  }
  .records-identify-intro-copy p,
  .records-identify-intro-copy em {
    margin: 0;
    color: #475569;
    font-size: 13px;
    line-height: 1.55;
    font-style: normal;
    font-weight: 760;
  }
  .records-identify-intro-metrics {
    display: grid;
    grid-template-columns: repeat(3, minmax(72px, 1fr));
    gap: 7px;
  }
  .records-identify-intro-metrics a {
    min-width: 0;
    min-height: 64px;
    display: grid;
    place-items: center;
    gap: 3px;
    padding: 8px;
    border-radius: 8px;
    background: #fff;
    border: 1px solid rgba(15,23,42,.08);
    color: #10251a;
    text-decoration: none;
  }
  .records-identify-intro-metrics strong {
    font-size: 21px;
    line-height: 1;
    font-weight: 950;
  }
  .records-identify-intro-metrics span {
    color: #64748b;
    font-size: 10px;
    line-height: 1.2;
    font-weight: 900;
    text-align: center;
  }
  .records-identify-intro-actions {
    display: grid;
    gap: 7px;
  }
  .records-identify-intro-actions a {
    min-height: 38px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid rgba(15,23,42,.1);
    background: #fff;
    color: #10251a;
    text-decoration: none;
    font-size: 12px;
    line-height: 1;
    font-weight: 950;
    white-space: nowrap;
  }
  .records-identify-intro-actions a.is-primary {
    background: #047857;
    border-color: #047857;
    color: #fff;
  }
  .records-identify-proof {
    display: grid;
    gap: 8px;
    padding: 12px;
    border-radius: 8px;
    background: #f8fafc;
    border: 1px solid rgba(15,23,42,.08);
  }
  .records-identify-proof > strong {
    color: #10251a;
    font-size: 13px;
    line-height: 1.3;
    font-weight: 950;
  }
  .records-identify-proof a {
    min-width: 0;
    display: grid;
    gap: 3px;
    padding: 9px 10px;
    border-radius: 8px;
    background: #fff;
    color: #10251a;
    text-decoration: none;
    border: 1px solid rgba(15,23,42,.06);
  }
  .records-identify-proof a strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    line-height: 1.25;
    font-weight: 950;
  }
  .records-identify-proof a span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #64748b;
    font-size: 11px;
    line-height: 1.35;
    font-weight: 750;
  }
  .records-tools {
    justify-self: start;
    position: sticky;
    top: 124px;
    z-index: 12;
  }
  .records-tools summary {
    min-height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 13px;
    border-radius: 999px;
    background: rgba(255,255,255,.94);
    border: 1px solid rgba(15,23,42,.1);
    color: #10251a;
    font-size: 13px;
    line-height: 1;
    font-weight: 950;
    cursor: pointer;
    box-shadow: 0 10px 24px rgba(15,23,42,.06);
    list-style: none;
  }
  .records-tools summary::-webkit-details-marker { display: none; }
  .records-tools[open] {
    width: min(100%, 860px);
    justify-self: stretch;
  }
  .records-post-month { display: grid; gap: 10px; }
  .records-post-month[hidden],
  .records-post-card[hidden] { display: none; }
  .records-post-month-head {
    min-height: 18px;
    display: flex;
    align-items: center;
    padding: 4px 2px 0;
    border-top: 1px solid rgba(15,23,42,.06);
  }
  .records-post-month:first-of-type .records-post-month-head { border-top: 0; padding-top: 0; }
  .records-post-month-head span {
    color: #64748b;
    font-size: 11px;
    line-height: 1;
    font-weight: 900;
  }
  .records-post-grid {
    max-width: 100%;
    min-width: 0;
    display: grid;
    grid-template-columns: var(--ikimon-record-card-grid-fluid);
    gap: var(--ikimon-record-card-grid-gap-fluid);
  }
  .records-post-card {
    position: relative;
    min-width: 0;
    display: grid;
    gap: var(--ikimon-record-card-inner-gap);
    color: inherit;
  }
  .records-post-card.is-identify-selectable { cursor: pointer; }
  .records-post-card.is-identify-active .records-post-thumb {
    border-color: rgba(4,120,87,.9);
    box-shadow: 0 0 0 3px rgba(16,185,129,.22), var(--ikimon-record-card-thumb-shadow);
  }
  .records-post-card.is-identify-processed {
    opacity: .48;
  }
  .records-post-card.is-identify-processed .records-post-action {
    background: #64748b;
  }
  .records-post-card-link {
    min-width: 0;
    display: grid;
    gap: var(--ikimon-record-card-inner-gap);
    color: inherit;
    text-decoration: none;
  }
  .records-post-thumb {
    position: relative;
    width: 100%;
    aspect-ratio: var(--ikimon-record-card-thumb-ratio);
    display: grid;
    place-items: center;
    overflow: hidden;
    border: 1px solid rgba(15,23,42,.08);
    border-radius: var(--ikimon-record-card-thumb-radius);
    background:
      linear-gradient(90deg, rgba(16,185,129,.1) 1px, transparent 1px),
      linear-gradient(0deg, rgba(14,165,233,.08) 1px, transparent 1px),
      #f8fffc;
    background-size: 22px 22px, 22px 22px, auto;
    box-shadow: var(--ikimon-record-card-thumb-shadow);
  }
  .records-post-thumb img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    object-position: center;
    transition: transform .18s ease;
  }
  .records-post-card:hover .records-post-thumb img { transform: scale(1.025); }
  .records-post-empty-thumb {
    width: 38px;
    height: 38px;
    border-radius: 999px;
    background: #e7f5ef;
  }
  .records-post-icon {
    position: absolute;
    left: 8px;
    top: 8px;
    width: 26px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: rgba(16,37,26,.86);
    color: #fff;
    box-shadow: 0 8px 18px rgba(15,23,42,.16);
  }
  .records-post-icon::before {
    content: "";
    width: 13px;
    height: 13px;
    display: block;
    background: currentColor;
    mask: var(--records-post-icon-mask) center / contain no-repeat;
    -webkit-mask: var(--records-post-icon-mask) center / contain no-repeat;
  }
  .records-post-icon.is-photo { --records-post-icon-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M5 5h14v14H5V5Zm2 2v8.6l3.2-3.2 2.6 2.6 1.7-1.7L17 15.8V7H7Zm2.5 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z'/%3E%3C/svg%3E"); }
  .records-post-icon.is-video { --records-post-icon-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M4 6h11v12H4V6Zm13 4.2 4-2.4v8.4l-4-2.4v-3.6Z'/%3E%3C/svg%3E"); }
  .records-post-icon.is-guide,
  .records-post-icon.is-scan,
  .records-post-icon.is-note { --records-post-icon-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm1 5v3h3v2h-3v3h-2v-3H8v-2h3V8h2Z'/%3E%3C/svg%3E"); }
  .records-post-needs-id {
    position: absolute;
    left: auto;
    right: 8px;
    top: 8px;
    bottom: auto;
    min-width: 0;
    max-width: calc(100% - 48px);
    display: flex;
    align-items: center;
    gap: 5px;
    min-height: 24px;
    padding: 5px 7px;
    border-radius: 999px;
    background: rgba(255,255,255,.9);
    color: #475569;
    border: 1px solid rgba(15,23,42,.1);
    box-shadow: 0 6px 14px rgba(15,23,42,.1);
    backdrop-filter: blur(8px);
  }
  .records-post-needs-id b {
    flex: 0 0 auto;
    color: #334155;
    font-size: 10px;
    line-height: 1;
    font-weight: 950;
  }
  .records-post-needs-id small {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #64748b;
    font-size: 9.5px;
    line-height: 1;
    font-weight: 850;
  }
  .records-post-body {
    min-width: 0;
    display: grid;
    gap: var(--ikimon-record-card-body-gap);
  }
  .records-post-title-line {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .records-post-title-line > strong {
    min-width: 0;
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #10251a;
    font-size: var(--ikimon-record-card-title-size);
    line-height: var(--ikimon-record-card-title-line-height);
    font-weight: 950;
  }
  .records-post-subjects {
    min-width: 0;
    max-width: 48%;
    flex: 0 1 auto;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #64748b;
    font-size: 10px;
    line-height: 1.2;
    font-weight: 850;
  }
  .records-post-subjects span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .records-post-subjects em {
    flex: 0 0 auto;
    min-width: 20px;
    height: 18px;
    display: inline-grid;
    place-items: center;
    padding: 0 5px;
    border-radius: 999px;
    background: rgba(15,23,42,.06);
    color: #475569;
    font-size: 10px;
    line-height: 1;
    font-style: normal;
    font-weight: 950;
  }
  .records-post-memory-line {
    min-width: 0;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #10251a;
    font-size: 11px;
    line-height: 1.25;
    font-weight: 900;
  }
  .records-post-meta {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #64748b;
    font-size: var(--ikimon-record-card-meta-size);
    line-height: var(--ikimon-record-card-meta-line-height);
    font-weight: 850;
  }
  .records-post-evidence {
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .records-post-evidence small {
    min-height: 22px;
    display: inline-flex;
    align-items: center;
    padding: 0 7px;
    border-radius: 999px;
    background: #f0fdf4;
    color: #166534;
    font-size: 10px;
    line-height: 1;
    font-weight: 900;
  }
  .records-post-action {
    justify-self: start;
    min-height: 28px;
    display: inline-flex;
    align-items: center;
    padding: 6px 10px;
    border-radius: 999px;
    background: #047857;
    color: #fff;
    font-size: 11px;
    line-height: 1;
    font-weight: 950;
    box-shadow: 0 8px 18px rgba(4,120,87,.16);
  }
  .records-lazy-footer {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    padding: 18px 0 8px;
  }
  .records-lazy-footer[hidden] { display: none; }
  .records-lazy-footer button {
    min-height: 42px;
    padding: 0 16px;
    border-radius: 999px;
    border: 1px solid rgba(15,23,42,.1);
    background: #fff;
    color: #10251a;
    font: inherit;
    font-size: 13px;
    font-weight: 950;
    cursor: pointer;
    box-shadow: 0 10px 22px rgba(15,23,42,.06);
  }
  .records-lazy-footer button:hover { background: #f8fafc; }
  .records-lazy-footer button[disabled] { cursor: progress; opacity: .72; }
  .records-lazy-footer span { color: #64748b; font-size: 12px; font-weight: 800; }
  .records-post-menu { top: 8px; right: 8px; }
  .records-identify-panel {
    position: sticky;
    top: 128px;
    min-width: 0;
    display: grid;
    gap: 12px;
    padding: 12px;
    border: 1px solid rgba(15,23,42,.1);
    border-radius: 14px;
    background: rgba(255,255,255,.96);
    box-shadow: 0 20px 48px rgba(15,23,42,.1);
  }
  .records-identify-panel.is-empty { min-height: 120px; align-content: center; }
  .records-identify-head {
    min-width: 0;
    display: grid;
    gap: 5px;
  }
  .records-identify-head span {
    color: #047857;
    font-size: 11px;
    line-height: 1;
    font-weight: 950;
  }
  .records-identify-head strong {
    min-width: 0;
    color: #10251a;
    font-size: 17px;
    line-height: 1.25;
    font-weight: 950;
  }
  .records-identify-head p,
  .records-identify-panel > p {
    margin: 0;
    color: #64748b;
    font-size: 12px;
    line-height: 1.5;
    font-weight: 780;
  }
  .records-identify-empty-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .records-identify-empty-actions a {
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 10px;
    border-radius: 999px;
    border: 1px solid rgba(15,23,42,.1);
    background: #fff;
    color: #10251a;
    text-decoration: none;
    font-size: 12px;
    line-height: 1.15;
    font-weight: 950;
    text-align: center;
  }
  .records-identify-empty-actions a.is-primary {
    background: #047857;
    border-color: #047857;
    color: #fff;
  }
  .records-identify-media {
    width: 100%;
    aspect-ratio: 4 / 3;
    display: grid;
    place-items: center;
    overflow: hidden;
    border-radius: 12px;
    border: 1px solid rgba(15,23,42,.08);
    background:
      linear-gradient(90deg, rgba(16,185,129,.1) 1px, transparent 1px),
      linear-gradient(0deg, rgba(14,165,233,.08) 1px, transparent 1px),
      #f8fffc;
    background-size: 22px 22px, 22px 22px, auto;
  }
  .records-identify-media img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;
    background: #0f172a;
  }
  .records-identify-media.is-empty span {
    width: 42px;
    height: 42px;
    border-radius: 999px;
    background: #e7f5ef;
  }
  .records-identify-facts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .records-identify-facts span {
    min-height: 25px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 8px;
    border-radius: 999px;
    background: #f1f5f9;
    color: #334155;
    font-size: 11px;
    line-height: 1;
    font-weight: 900;
  }
  .records-identify-facts span[hidden] { display: none; }
  .records-identify-facts b { color: #10251a; font-weight: 950; }
  .records-identify-command {
    display: grid;
    gap: 9px;
  }
  .records-identify-fields {
    display: grid;
    gap: 7px;
  }
  .records-identify-fields label {
    min-width: 0;
    display: grid;
    gap: 4px;
  }
  .records-identify-fields label span {
    color: #64748b;
    font-size: 10px;
    line-height: 1;
    font-weight: 950;
  }
  .records-identify-fields input,
  .records-identify-fields textarea {
    width: 100%;
    min-width: 0;
    border: 1px solid rgba(15,23,42,.12);
    border-radius: 10px;
    background: #fff;
    color: #0f172a;
    font: inherit;
    font-size: 12px;
    line-height: 1.4;
    font-weight: 780;
  }
  .records-identify-fields input { min-height: 35px; padding: 0 10px; }
  .records-identify-fields textarea {
    min-height: 58px;
    padding: 8px 10px;
    resize: vertical;
  }
  .records-identify-command-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px;
  }
  .records-identify-command-actions button {
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 8px;
    border-radius: 999px;
    border: 1px solid rgba(15,23,42,.1);
    background: #fff;
    color: #10251a;
    font: inherit;
    font-size: 11px;
    line-height: 1.15;
    font-weight: 950;
    cursor: pointer;
  }
  .records-identify-command-actions button.is-primary {
    background: #047857;
    border-color: #047857;
    color: #fff;
  }
  .records-identify-references {
    display: grid;
    gap: 7px;
    padding: 8px;
    border-radius: 10px;
    border: 1px solid rgba(14,165,233,.16);
    background: rgba(240,249,255,.72);
  }
  .records-identify-references[hidden] { display: none; }
  .records-identify-references-head {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: center;
  }
  .records-identify-references-head strong {
    color: #0f172a;
    font-size: 11px;
    line-height: 1.2;
    font-weight: 950;
  }
  .records-identify-references-head a {
    color: #0369a1;
    font-size: 10px;
    font-weight: 950;
    text-decoration: none;
    white-space: nowrap;
  }
  .records-identify-reference-options {
    display: grid;
    gap: 5px;
    color: #64748b;
    font-size: 11px;
    line-height: 1.35;
    font-weight: 820;
  }
  .records-identify-reference-option {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 7px;
    align-items: start;
    padding: 7px;
    border-radius: 8px;
    background: rgba(255,255,255,.78);
    border: 1px solid rgba(15,23,42,.06);
  }
  .records-identify-reference-option input { margin-top: 2px; }
  .records-identify-reference-option span {
    min-width: 0;
    display: grid;
    gap: 2px;
  }
  .records-identify-reference-option strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #10251a;
    font-size: 11px;
    line-height: 1.25;
    font-weight: 950;
  }
  .records-identify-reference-option small {
    min-width: 0;
    color: #64748b;
    font-size: 10px;
    line-height: 1.35;
    font-weight: 780;
  }
  .records-identify-reference-locator {
    display: grid;
    gap: 4px;
  }
  .records-identify-reference-locator span {
    color: #64748b;
    font-size: 10px;
    line-height: 1;
    font-weight: 950;
  }
  .records-identify-reference-locator input {
    min-height: 32px;
    width: 100%;
    border: 1px solid rgba(15,23,42,.12);
    border-radius: 9px;
    background: #fff;
    color: #0f172a;
    padding: 0 9px;
    font: inherit;
    font-size: 11px;
    font-weight: 780;
  }
  .records-identify-login {
    padding: 9px 10px;
    border-radius: 10px;
    background: #f8fafc;
    color: #475569;
    font-size: 12px;
    line-height: 1.5;
    font-weight: 820;
  }
  .records-identify-followup {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 6px;
    align-items: center;
    padding: 7px;
    border-radius: 10px;
    background: #f0fdf4;
    border: 1px solid rgba(16,185,129,.22);
  }
  .records-identify-followup[hidden] { display: none; }
  .records-identify-followup span {
    min-width: 0;
    color: #065f46;
    font-size: 11px;
    line-height: 1.35;
    font-weight: 900;
  }
  .records-identify-followup span.is-error {
    color: #b91c1c;
  }
  .records-identify-followup button {
    min-height: 29px;
    padding: 0 8px;
    border-radius: 999px;
    border: 1px solid rgba(15,23,42,.1);
    background: #fff;
    color: #10251a;
    font: inherit;
    font-size: 10px;
    font-weight: 950;
    cursor: pointer;
  }
  .records-identify-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
  }
  .records-identify-actions a,
  .records-identify-actions button {
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 13px;
    border-radius: 999px;
    border: 1px solid rgba(15,23,42,.1);
    background: #fff;
    color: #10251a;
    text-decoration: none;
    font: inherit;
    font-size: 13px;
    line-height: 1;
    font-weight: 950;
    cursor: pointer;
  }
  .records-identify-actions a {
    background: #047857;
    border-color: #047857;
    color: #fff;
  }
  .records-lazy-footer button:hover { background: #f8fafc; }
  .records-lazy-footer button[disabled] { cursor: progress; opacity: .72; }
  .records-lazy-footer span { color: #64748b; font-size: 12px; font-weight: 800; }
  .records-post-menu { top: 8px; right: 8px; }
  .identification-summary-topbar .records-actions a { border-radius: 8px; }
  .identification-summary-topbar .records-actions a.is-primary {
    min-width: 112px;
    padding: 0 14px;
    font-size: 13px;
    line-height: 1;
  }
  .identification-summary-main {
    width: min(100%, 1360px);
    min-width: 0;
    display: grid;
    gap: 12px;
    margin: 0 auto;
    padding: 14px;
  }
  .identification-summary-hero {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 16px;
    border: 1px solid rgba(15,23,42,.08);
    border-radius: 8px;
    background: #fff;
  }
  .identification-summary-hero div { min-width: 0; display: grid; gap: 5px; }
  .identification-summary-hero span,
  .identification-summary-panel-head span {
    color: #047857;
    font-size: 12px;
    line-height: 1;
    font-weight: 950;
  }
  .identification-summary-hero h1,
  .identification-summary-panel-head h2,
  .identification-summary-lane-head h2 {
    margin: 0;
    color: #10251a;
    font-size: 22px;
    line-height: 1.2;
    font-weight: 950;
    letter-spacing: 0;
  }
  .identification-summary-hero p,
  .identification-summary-lane-head p,
  .identification-summary-preview p {
    margin: 0;
    color: #475569;
    font-size: 15px;
    line-height: 1.6;
    font-weight: 760;
  }
  .identification-summary-primary {
    min-height: 56px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 18px;
    border-radius: 8px;
    background: #064e3b;
    color: #fff;
    text-decoration: none;
    font-size: 15px;
    line-height: 1.2;
    font-weight: 950;
    white-space: nowrap;
  }
  .identification-summary-scopes {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .identification-summary-scopes button {
    min-height: 48px;
    padding: 0 14px;
    border: 1px solid rgba(15,23,42,.1);
    border-radius: 8px;
    background: #fff;
    color: #334155;
    font: inherit;
    font-size: 14px;
    font-weight: 950;
    cursor: pointer;
  }
  .identification-summary-scopes button.is-active {
    background: #10251a;
    border-color: #10251a;
    color: #fff;
  }
  .identification-summary-metrics {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
  }
  .identification-summary-metric {
    min-width: 0;
    min-height: 112px;
    display: grid;
    align-content: start;
    gap: 5px;
    padding: 13px;
    border: 1px solid rgba(15,23,42,.08);
    border-radius: 8px;
    background: #fff;
  }
  .identification-summary-metric strong {
    color: #10251a;
    font-size: 28px;
    line-height: 1;
    font-weight: 950;
  }
  .identification-summary-metric span {
    color: #0f172a;
    font-size: 15px;
    line-height: 1.2;
    font-weight: 950;
  }
  .identification-summary-metric small,
  .identification-summary-item small,
  .identification-summary-item em,
  .identification-summary-reference-box li span,
  .identification-summary-health-list small,
  .identification-summary-decisions span,
  .identification-summary-team-grid span {
    color: #64748b;
    font-size: 13px;
    line-height: 1.45;
    font-weight: 760;
  }
  .identification-summary-work {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(320px, .65fr);
    gap: 12px;
    align-items: start;
  }
  .identification-summary-lanes {
    min-width: 0;
    display: grid;
    gap: 12px;
  }
  .identification-summary-lane,
  .identification-summary-preview,
  .identification-summary-panel {
    min-width: 0;
    display: grid;
    gap: 10px;
    padding: 12px;
    border: 1px solid rgba(15,23,42,.08);
    border-radius: 8px;
    background: #fff;
  }
  .identification-summary-lane-head,
  .identification-summary-panel-head {
    min-width: 0;
    display: grid;
    gap: 4px;
  }
  .identification-summary-list {
    min-width: 0;
    display: grid;
    gap: 8px;
  }
  .identification-summary-item {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
    padding: 8px;
    border: 1px solid rgba(15,23,42,.08);
    border-radius: 8px;
    background: #f8fafc;
  }
  .identification-summary-item-main {
    min-width: 0;
    display: grid;
    grid-template-columns: 88px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    color: inherit;
    text-decoration: none;
  }
  .identification-summary-thumb {
    width: 88px;
    aspect-ratio: 4 / 3;
    display: grid;
    place-items: center;
    overflow: hidden;
    border: 1px solid rgba(15,23,42,.08);
    border-radius: 8px;
    background: #ecfdf5;
  }
  .identification-summary-preview > .identification-summary-thumb {
    width: 100%;
    aspect-ratio: 16 / 10;
  }
  .identification-summary-thumb img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }
  .identification-summary-thumb.is-empty span {
    color: #047857;
    font-size: 13px;
    font-weight: 950;
  }
  .identification-summary-item-body {
    min-width: 0;
    display: grid;
    gap: 4px;
  }
  .identification-summary-item-body strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #10251a;
    font-size: 16px;
    line-height: 1.25;
    font-weight: 950;
  }
  .identification-summary-chips,
  .identification-summary-preview-tags {
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .identification-summary-chips span,
  .identification-summary-preview-tags span {
    min-height: 24px;
    display: inline-flex;
    align-items: center;
    padding: 0 7px;
    border-radius: 6px;
    background: #e0f2fe;
    color: #075985;
    font-size: 12px;
    line-height: 1;
    font-weight: 900;
  }
  .identification-summary-open {
    min-height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 12px;
    border-radius: 8px;
    background: #fff;
    border: 1px solid rgba(15,23,42,.12);
    color: #10251a;
    text-decoration: none;
    font-size: 14px;
    font-weight: 950;
  }
  .identification-summary-empty {
    min-height: 76px;
    display: grid;
    place-items: center;
    padding: 12px;
    border: 1px dashed rgba(15,23,42,.16);
    border-radius: 8px;
    color: #64748b;
    font-size: 14px;
    font-weight: 850;
  }
  .identification-summary-preview {
    position: sticky;
    top: 130px;
  }
  .identification-summary-reference-box {
    display: grid;
    gap: 8px;
    padding: 10px;
    border-radius: 8px;
    background: #f0f9ff;
  }
  .identification-summary-reference-box > strong {
    color: #075985;
    font-size: 14px;
    font-weight: 950;
  }
  .identification-summary-reference-box ul {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .identification-summary-reference-box li {
    display: grid;
    gap: 2px;
  }
  .identification-summary-reference-box li strong {
    color: #10251a;
    font-size: 14px;
    font-weight: 950;
  }
  .identification-summary-bottom {
    display: grid;
    grid-template-columns: 1.1fr 1fr .8fr;
    gap: 12px;
    align-items: start;
  }
  .identification-summary-health-list,
  .identification-summary-decisions,
  .identification-summary-team-grid {
    display: grid;
    gap: 8px;
  }
  .identification-summary-health-list div,
  .identification-summary-decisions div,
  .identification-summary-team-grid div {
    min-width: 0;
    display: grid;
    gap: 3px;
    padding: 9px;
    border-radius: 8px;
    background: #f8fafc;
  }
  .identification-summary-health-list div {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
  }
  .identification-summary-health-list strong,
  .identification-summary-decisions strong,
  .identification-summary-team-grid strong {
    color: #10251a;
    font-size: 15px;
    line-height: 1.25;
    font-weight: 950;
  }
  .identification-summary-health-list span {
    color: #047857;
    font-size: 18px;
    font-weight: 950;
  }
  .identification-summary-health-list small { grid-column: 1 / -1; }
  .records-workbench .notes-library-controls {
    margin-top: 8px;
    display: grid;
    grid-template-columns: minmax(180px, 260px) minmax(0, 1fr);
    gap: 6px;
    align-items: center;
    padding: 6px;
    border-radius: 10px;
    background: rgba(255,255,255,.94);
    border: 1px solid rgba(15,23,42,.06);
    backdrop-filter: blur(14px);
  }
  .records-workbench .notes-library-grid {
    grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  }
  .records-workbench .notes-library-card,
  .records-workbench .notes-library-card:nth-child(7n + 1) {
    min-height: 176px;
    aspect-ratio: 1 / 1.1;
    grid-row: auto;
    border-radius: 10px;
  }
  @media (min-width: 1161px) {
    .records-post-grid {
      grid-template-columns: var(--ikimon-record-card-grid-desktop);
      gap: var(--ikimon-record-card-grid-gap-desktop);
    }
  }
  @media (max-width: 1020px) {
    .records-post-grid {
      grid-template-columns: var(--ikimon-record-card-grid-tablet);
      gap: var(--ikimon-record-card-grid-gap-tablet);
    }
  }
  @media (max-width: 980px) {
    .records-topbar {
      top: 56px;
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto;
      min-height: 0;
      gap: 6px;
      padding: 6px 8px;
    }
    .records-topbar-brand { display: none; }
    .records-view-tabs { min-width: 0; flex-wrap: nowrap; overflow-x: auto; }
    .records-view-tabs a { min-height: 31px; padding: 0 10px; font-size: 12px; }
    .records-actions { display: none; }
    .records-actions a { min-width: 34px; min-height: 34px; padding: 0 11px; font-size: 12px; }
    .records-actions a.is-primary { font-size: 21px; }
    .records-main { grid-template-columns: 1fr; padding: 6px 8px calc(110px + env(safe-area-inset-bottom)); }
    .records-arrival,
    .records-view-intro { grid-template-columns: 1fr; gap: 10px; padding: 12px; }
    .records-arrival-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .records-arrival-actions a,
    .records-view-intro > a { width: 100%; white-space: normal; text-align: center; }
    .records-main.is-identify { grid-template-columns: 1fr; padding-bottom: 232px; }
    .records-identify-intro {
      grid-template-columns: 1fr;
      align-items: start;
      padding: 12px;
    }
    .records-identify-intro-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .records-identify-intro-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .records-identify-panel {
      position: fixed;
      left: max(8px, env(safe-area-inset-left));
      right: max(8px, env(safe-area-inset-right));
      bottom: calc(max(8px, env(safe-area-inset-bottom)) + 92px);
      top: auto;
      z-index: 30;
      gap: 8px;
      max-height: calc(100dvh - 184px);
      overflow-y: auto;
      padding: 10px;
      border-radius: 14px;
      box-shadow: 0 18px 48px rgba(15,23,42,.22);
    }
    .records-identify-media { display: none; }
    .records-identify-head { gap: 3px; }
    .records-identify-head span { font-size: 10px; }
    .records-identify-head strong { font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .records-identify-head p,
    .records-identify-panel > p { display: none; }
    .records-identify-actions { grid-template-columns: minmax(0, 1fr) auto; }
    .records-identify-command-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .records-identify-reference-options { max-height: 118px; overflow-y: auto; }
    .records-tools {
      position: static;
      justify-self: start;
    }
    .records-tools[open] { width: 100%; }
    .records-story {
      grid-template-columns: 1fr;
      align-items: start;
      padding: 12px;
      border-radius: 12px;
    }
    .records-story-head h1 { font-size: 22px; }
    .records-story-head p { font-size: 13px; }
    .records-story-metrics {
      overflow-x: auto;
      scrollbar-width: none;
    }
    .records-story-metrics::-webkit-scrollbar { display: none; }
    .records-story-cards {
      grid-template-columns: none;
      grid-auto-flow: column;
      grid-auto-columns: minmax(210px, 74vw);
      overflow-x: auto;
      padding-bottom: 4px;
      scrollbar-width: none;
    }
    .records-story-cards::-webkit-scrollbar { display: none; }
    .records-story-card { min-height: 130px; }
    .records-my-places {
      grid-template-columns: 1fr;
      gap: 7px;
      padding: 7px;
    }
    .records-my-places-head {
      overflow-x: auto;
      scrollbar-width: none;
    }
    .records-my-places-head::-webkit-scrollbar { display: none; }
    .records-my-places-list {
      grid-auto-columns: minmax(142px, 68vw);
    }
    .records-workbench .notes-library-controls {
      position: static;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 5px;
      padding: 5px;
    }
    .records-workbench .notes-library-search { min-height: 36px; padding: 0 9px; }
    .records-workbench .notes-library-search input { font-size: 13px; }
    .records-workbench .notes-library-filter-label {
      min-height: 36px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 11px;
      border-radius: 999px;
      background: #10251a;
      color: #fff;
      font-size: 12px;
      font-weight: 950;
      cursor: pointer;
      white-space: nowrap;
    }
    .records-workbench .notes-library-filters {
      grid-column: 1 / -1;
      display: none;
      gap: 5px;
      padding-top: 1px;
    }
    .records-workbench .notes-library-filter-toggle:checked + .notes-library-filter-label + .notes-library-filters { display: flex; }
    .records-workbench .notes-library-filters button { min-height: 31px; padding: 5px 9px; font-size: 11px; }
    .identification-summary-main { padding: 8px; }
    .identification-summary-hero,
    .identification-summary-work,
    .identification-summary-bottom {
      grid-template-columns: minmax(0, 1fr);
    }
    .identification-summary-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .identification-summary-metric:last-child { grid-column: 1 / -1; }
    .identification-summary-preview { position: static; }
    .identification-summary-primary { width: 100%; }
  }
  @media (max-width: 620px) {
    .records-topbar-brand strong { font-size: 14px; }
    .records-actions a { min-width: 34px; min-height: 34px; }
    .records-identify-intro-copy h1 { font-size: 21px; }
    .records-identify-intro-metrics,
    .records-identify-intro-actions { grid-template-columns: 1fr; }
    .records-post-grid { grid-template-columns: var(--ikimon-record-card-grid-mobile); gap: var(--ikimon-record-card-grid-gap-mobile); }
    .records-post-card,
    .records-post-card-link { gap: var(--ikimon-record-card-inner-gap-mobile); }
    .records-post-thumb {
      border-radius: var(--ikimon-record-card-thumb-radius-mobile);
      box-shadow: var(--ikimon-record-card-thumb-shadow-mobile);
    }
    .records-post-body { gap: var(--ikimon-record-card-body-gap-mobile); }
    .records-post-title-line > strong {
      font-size: var(--ikimon-record-card-title-size-mobile);
      line-height: var(--ikimon-record-card-title-line-height-mobile);
    }
    .records-post-meta {
      font-size: var(--ikimon-record-card-meta-size);
      line-height: var(--ikimon-record-card-meta-line-height);
    }
    .records-workbench .notes-library-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .identification-summary-scopes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .identification-summary-scopes button { min-height: 48px; padding: 0 8px; }
    .identification-summary-item { grid-template-columns: minmax(0, 1fr); }
    .identification-summary-item-main { grid-template-columns: 78px minmax(0, 1fr); }
    .identification-summary-thumb { width: 78px; }
    .identification-summary-open { width: 100%; }
  }
  @media (max-width: 480px) {
    .records-post-grid { grid-template-columns: var(--ikimon-record-card-grid-mobile); gap: var(--ikimon-record-card-grid-gap-compact); }
  }
`;

export async function registerPersonalLibraryReadRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { cursor?: string; limit?: string; lang?: string; userId?: string } }>("/api/v1/records/mine-page", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String(request.query.lang ? `?lang=${request.query.lang}` : (request as unknown as { url?: string }).url ?? ""));
    const session = await getSessionFromCookie(request.headers.cookie);
    const { viewerUserId } = resolveViewer(request.query, session);
    if (!viewerUserId) {
      reply.code(401);
      return { ok: false, error: "session_required" };
    }
    const limit = Number.parseInt(request.query.limit ?? "36", 10);
    const page = await getLandingOwnFeedPage(viewerUserId, { cursor: request.query.cursor, limit });
    const civicContexts = await listCivicObservationContexts(page.entries.map((obs) => obs.visitId));
    return {
      ok: true,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      months: renderRecordsPostMonthPayload(basePath, lang, "mine", page.entries, {
        locationMode: "owner",
        civicContexts,
      }),
    };
  });

  app.get<{ Querystring: { cursor?: string; limit?: string; lang?: string; q?: string } }>("/api/v1/records/public-page", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String(request.query.lang ? `?lang=${request.query.lang}` : (request as unknown as { url?: string }).url ?? ""));
    const parsedLimit = Number.parseInt(request.query.limit ?? "36", 10);
    const q = String(request.query.q ?? "").trim().slice(0, 80);
    try {
      const page = await getObservationListPage({
        limit: Number.isFinite(parsedLimit) ? parsedLimit : 36,
        q: q || null,
        cursor: request.query.cursor,
      });
      const entries = page.observations.map(publicObservationToLandingObservation);
      const civicContexts = await listCivicObservationContexts(entries.map((obs) => obs.visitId));
      return {
        ok: true,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
        months: renderRecordsPostMonthPayload(basePath, lang, "public", entries, {
          locationMode: "public",
          civicContexts,
        }),
      };
    } catch (error) {
      request.log.warn({ err: error }, "records public page failed");
      reply.code(500);
      return { ok: false, error: "public_page_failed" };
    }
  });

  app.get<{
    Params: { id: string };
    Querystring: { proposedName?: string; limit?: string };
  }>("/api/v1/observations/:id/reference-candidates", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie).catch(() => null);
    if (!session || session.banned) {
      reply.code(401);
      return { ok: false, error: "session_required" };
    }
    const limit = Number.parseInt(String(request.query.limit ?? "6"), 10);
    const candidates = await listReferenceCandidatesForIdentification({
      userId: session.userId,
      occurrenceId: request.params.id,
      proposedName: request.query.proposedName ?? null,
      limit: Number.isFinite(limit) ? limit : 6,
    }).catch(() => []);
    return { ok: true, candidates };
  });

  app.get<{ Querystring: { view?: string; filter?: string; userId?: string; q?: string; source?: string; saved?: string } }>("/records", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const session = await getSessionFromCookie(request.headers.cookie);
    const { viewerUserId } = resolveViewer(request.query, session);
    const view = normalizeRecordsView(request.query.view, Boolean(viewerUserId));
    const searchQuery = String(request.query.q ?? "").trim().slice(0, 80);
    const arrivalSource = view === "mine" && viewerUserId ? normalizeRecordsArrivalSource(request.query.source) : null;
    const savedId = arrivalSource === "record_saved" ? normalizeRecordsArrivalSavedId(request.query.saved) : "";
    const emptyObservationSnapshot = {
      observations: [],
      summary: {
        shownCount: 0,
        awaitingIdCount: 0,
        identifiedCount: 0,
        multiSubjectCount: 0,
      },
    } satisfies ObservationListSnapshot;
    const needsUnionSnapshot = view === "identification_summary" || view === "needs_id" || view === "media" || view === "places";
    const [snapshot, observationSnapshot, publicPage] = await Promise.all([
      getLandingSnapshot(viewerUserId),
      needsUnionSnapshot
        ? getObservationListSnapshot(96).catch(() => emptyObservationSnapshot)
        : Promise.resolve(emptyObservationSnapshot),
      view === "public"
        ? getObservationListPage({ limit: 36, q: searchQuery || null }).catch(() => null)
        : Promise.resolve(null),
    ]);
    const ownPage = view === "mine" && snapshot.viewerUserId
      ? await getLandingOwnFeedPage(snapshot.viewerUserId, { limit: 36 }).catch(() => null)
      : null;
    const publicEntries = (view === "public"
      ? (publicPage?.observations ?? [])
      : observationSnapshot.observations
    ).map(publicObservationToLandingObservation);
    const ownEntries = snapshot.viewerUserId ? (ownPage?.entries ?? snapshot.myFeed) : [];
    const heldOccurrenceIds = view === "needs_id" && session?.userId
      ? await listHeldIdentificationOccurrenceIds(session.userId).catch(() => new Set<string>())
      : new Set<string>();
    const activeEntries = recordWorkbenchEntriesForView(view, ownEntries, publicEntries, { heldOccurrenceIds });
    const [civicContexts, identificationSummaryReferences] = await Promise.all([
      listCivicObservationContexts(activeEntries.map((obs) => obs.visitId)),
      view === "identification_summary"
        ? loadIdentificationSummaryReferences(viewerUserId, activeEntries, lang)
        : Promise.resolve(new Map<string, ReferenceCandidate[]>()),
    ]);
    const copy = recordsWorkbenchCopy(lang);
    const summaryCopy = identificationSummaryCopy(lang);
    const isIdentificationSummary = view === "identification_summary";

    reply.type("text/html; charset=utf-8");
    if (viewerUserId) {
      reply.header("Cache-Control", arrivalSource === "record_saved" ? "private, no-store" : "private, no-cache, must-revalidate");
      reply.header("Vary", "Cookie");
    } else {
      reply.header("Cache-Control", "public, max-age=30, stale-while-revalidate=30");
    }
    const arrivalQuery = arrivalSource === "record_saved"
      ? `&source=record_saved${savedId ? `&saved=${encodeURIComponent(savedId)}` : ""}`
      : "";
    return renderSiteDocument({
      basePath,
      title: isIdentificationSummary ? summaryCopy.title : copy.title,
      activeNav: isIdentificationSummary ? summaryCopy.activeNav : copy.activeNav,
      lang,
      currentPath: appendLangToHref(withBasePath(basePath, `/records?view=${view}${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ""}${arrivalQuery}`), lang),
      shellClassName: "shell-bleed shell-records-workbench",
      extraStyles: `${NOTES_LIBRARY_STYLES}\n${RECORDS_WORKBENCH_STYLES}`,
      hideGlobalRecordLauncher: isIdentificationSummary,
      hideFooter: true,
      body: isIdentificationSummary
        ? renderIdentificationSummary(basePath, lang, snapshot, publicEntries, identificationSummaryReferences, { ownPage })
        : renderRecordsWorkbench(basePath, lang, view, snapshot, publicEntries, civicContexts, {
          ownPage,
          publicPage: publicPage ? { nextCursor: publicPage.nextCursor } : null,
          canWriteIdentification: Boolean(session),
          heldOccurrenceIds,
          searchQuery,
          arrivalSource,
          savedId,
        }),
      footerNote: notesLibraryCopy(lang).footerNote,
    });
  });
}
