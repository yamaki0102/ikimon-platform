import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, type SiteLang } from "../i18n.js";
import type { FieldLoopStrings, LandingStrings } from "../i18n/strings.js";
import { buildObservationDetailPath } from "../services/observationDetailLink.js";
import type {
  LandingObservation,
  LandingDailyCard,
  LandingDailyCardKind,
  LandingSnapshot,
  LandingTopGuideItem,
  LandingTopShelf,
  LandingTopShelfItem,
  LandingTopShelfKind,
} from "../services/readModels.js";
import { toThumbnailUrl, type ThumbnailPreset } from "../services/thumbnailUrl.js";
import { renderMapMini, toMapMiniCells } from "./mapMini.js";
import { escapeHtml } from "./siteShell.js";

export type LandingTopRenderOptions = {
  basePath: string;
  lang: SiteLang;
  copy: LandingStrings;
  fieldLoop: FieldLoopStrings;
  snapshot: LandingSnapshot;
  isLoggedIn: boolean;
};

export type LandingTopSections = {
  heroHtml: string;
  dailyDashboardHtml: string;
  linkBandHtml: string;
  flowSectionHtml: string;
  mapSectionHtml: string;
  librarySectionHtml: string;
  trustSectionHtml: string;
  communitySectionHtml: string;
  finalCtaHtml: string;
};

function localeForLang(lang: SiteLang): string {
  const localeMap: Record<SiteLang, string> = {
    ja: "ja-JP",
    en: "en-US",
    es: "es-ES",
    "pt-BR": "pt-BR",
  };
  return localeMap[lang];
}

function formatLandingObservedAt(lang: SiteLang, raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(localeForLang(lang), {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatLandingNumber(copy: LandingStrings, value: number): string {
  return new Intl.NumberFormat(copy.numberLocale).format(value);
}

function landingHref(basePath: string, lang: SiteLang, href: string): string {
  return appendLangToHref(withBasePath(basePath, href), lang);
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

function isLandingGuideItem(item: LandingTopShelfItem): item is LandingTopGuideItem {
  return item.topItemType === "guide";
}

function isLandingObservationItem(item: LandingTopShelfItem): item is LandingObservation {
  return "occurrenceId" in item;
}

function landingItemHref(basePath: string, lang: SiteLang, item: LandingTopShelfItem): string {
  if (isLandingGuideItem(item)) return landingHref(basePath, lang, item.href);
  return observationDetailHref(basePath, lang, item);
}

function landingItemPlaceLabel(item: Pick<LandingTopShelfItem, "publicLocation" | "placeName" | "municipality">): string {
  return item.publicLocation?.label || [item.placeName, item.municipality].filter(Boolean).join(" · ");
}

function landingItemMeta(lang: SiteLang, item: Pick<LandingTopShelfItem, "publicLocation" | "placeName" | "municipality" | "observedAt" | "observerName">): string {
  return [item.observerName, landingItemPlaceLabel(item), formatLandingObservedAt(lang, item.observedAt)].filter(Boolean).join(" · ");
}

function observationPlaceLabel(obs: LandingObservation): string {
  return landingItemPlaceLabel(obs);
}

function landingObservationMeta(lang: SiteLang, obs: LandingObservation): string {
  return landingItemMeta(lang, obs);
}

function landingObservationTimestamp(obs: LandingObservation): string {
  return (obs.entryType === "identification" ? obs.identifiedAt : obs.observedAt) ?? obs.observedAt;
}

function displayObservationName(obs: LandingObservation | null | undefined, fallback: string): string {
  return obs?.displayName || obs?.aiCandidateName || fallback;
}

function displayLandingItemName(item: LandingTopShelfItem | null | undefined, fallback: string): string {
  if (!item) return fallback;
  if (isLandingObservationItem(item)) return displayObservationName(item, fallback);
  return item.displayName || fallback;
}

function uniqueLandingObservations(snapshot: LandingSnapshot): LandingObservation[] {
  const featured = snapshot.dailyDashboard?.featuredObservation ?? null;
  const observations = [featured, ...snapshot.myFeed, ...snapshot.feed]
    .filter((obs): obs is LandingObservation => Boolean(obs));
  return Array.from(new Map(observations.map((obs) => [obs.occurrenceId, obs])).values());
}

function itemImageUrl(
  item: (Pick<LandingTopShelfItem, "photoUrl"> & { mediaUrl?: string | null }) | null | undefined,
  preset: ThumbnailPreset | "original",
): string | null {
  const sourceUrl = item?.photoUrl || item?.mediaUrl || null;
  if (!sourceUrl) return null;
  const mediaUrl = preset === "original" ? sourceUrl : (toThumbnailUrl(sourceUrl, preset) ?? sourceUrl);
  return landingPreviewMediaUrl(mediaUrl);
}

function observationImageUrl(obs: LandingObservation | null | undefined, preset: ThumbnailPreset | "original"): string | null {
  return itemImageUrl(obs, preset);
}

function landingPreviewMediaUrl(url: string | null): string | null {
  if (!url || /^https?:\/\//i.test(url)) return url;
  const origin = (
    process.env.IKIMON_PUBLIC_MEDIA_ORIGIN
    || (process.env.ALLOW_QUERY_USER_ID === "1" || process.env.PORT === "3203" ? "https://ikimon.life" : "")
  ).trim().replace(/\/+$/, "");
  if (!origin || !/^\/(?:thumb|uploads|data\/uploads)\//.test(url)) return url;
  if (process.env.PORT === "3203" || process.env.ALLOW_QUERY_USER_ID === "1") {
    return `/__preview-media${url}`;
  }
  return `${origin}${url}`;
}

function isSameLandingPhoto(left: LandingObservation | null | undefined, right: LandingObservation | null | undefined): boolean {
  if (!left || !right) return false;
  return left.occurrenceId === right.occurrenceId || Boolean(left.photoUrl && right.photoUrl && left.photoUrl === right.photoUrl);
}

function resolveDailyMainObservation(snapshot: LandingSnapshot): LandingObservation | null {
  const observations = uniqueLandingObservations(snapshot);
  return snapshot.dailyDashboard?.featuredObservation ?? observations[0] ?? null;
}

function resolveHeroPhotoObservation(snapshot: LandingSnapshot): LandingObservation | null {
  const dailyMainObservation = resolveDailyMainObservation(snapshot);
  return uniqueLandingObservations(snapshot)
    .find((obs) => Boolean(obs.photoUrl) && !isSameLandingPhoto(obs, dailyMainObservation)) ?? null;
}

type LandingDailyActionCopy = {
  icon: string;
  title: string;
  fallbackBody: string;
};

type LandingHeroText = {
  heading: string;
  lead: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchButton: string;
  stats: Array<{ key: "observationCount" | "speciesCount" | "placeCount"; label: string }>;
};

function landingHeroText(lang: SiteLang): LandingHeroText {
  const localized: Record<SiteLang, LandingHeroText> = {
    ja: {
      heading: "今日見つけた生きものを、名前が分からなくても残せる。",
      lead: "散歩中でも旅先でも、写真・動画・音・場所・ひとことを先に残せます。名前や根拠は、AI候補と人の確認であとから観察レコードへ育てます。",
      searchLabel: "場所や生きものを検索",
      searchPlaceholder: "場所・生きものを探す",
      searchButton: "検索",
      stats: [
        { key: "observationCount", label: "観察" },
        { key: "speciesCount", label: "種" },
        { key: "placeCount", label: "場所" },
      ],
    },
    en: {
      heading: "Save what you found today, even before you know the name.",
      lead: "On a walk or a trip, keep the photo, video, sound, place, and short note first. AI hints and human review can help the record grow later.",
      searchLabel: "Search species or places",
      searchPlaceholder: "Search species or places",
      searchButton: "Search",
      stats: [
        { key: "observationCount", label: "records" },
        { key: "speciesCount", label: "species" },
        { key: "placeCount", label: "places" },
      ],
    },
    es: {
      heading: "Guarda lo que encontraste hoy, aunque no sepas el nombre.",
      lead: "En un paseo o viaje, guarda primero foto, video, sonido, lugar y una nota breve. Las pistas de IA y la revision humana pueden hacerlo crecer despues.",
      searchLabel: "Buscar especies o lugares",
      searchPlaceholder: "Buscar especies o lugares",
      searchButton: "Buscar",
      stats: [
        { key: "observationCount", label: "registros" },
        { key: "speciesCount", label: "especies" },
        { key: "placeCount", label: "lugares" },
      ],
    },
    "pt-BR": {
      heading: "Salve o que encontrou hoje, mesmo antes de saber o nome.",
      lead: "Na caminhada ou viagem, guarde primeiro foto, video, som, lugar e uma nota curta. Dicas de IA e revisao humana ajudam o registro a crescer depois.",
      searchLabel: "Buscar especies ou lugares",
      searchPlaceholder: "Buscar especies ou lugares",
      searchButton: "Buscar",
      stats: [
        { key: "observationCount", label: "registros" },
        { key: "speciesCount", label: "especies" },
        { key: "placeCount", label: "lugares" },
      ],
    },
  };
  return localized[lang] ?? localized.ja;
}

function landingDailyActionCopy(lang: SiteLang, kind: LandingDailyCardKind): LandingDailyActionCopy {
  const localized: Record<SiteLang, Record<LandingDailyCardKind, LandingDailyActionCopy>> = {
    ja: {
      recordToday: { icon: "+", title: "記録する", fallbackBody: "名前が分からなくても始められます。" },
      revisitPlace: { icon: "↻", title: "前回の続き", fallbackBody: "同じ場所の変化を見る。" },
      nearbyPulse: { icon: "◎", title: "近くを見る", fallbackBody: "記録が増えた場所を開く。" },
      needsId: { icon: "?", title: "名前を確かめる", fallbackBody: "分からない記録を少し確かめる。" },
    },
    en: {
      recordToday: { icon: "+", title: "Post", fallbackBody: "A record can start before you know the name." },
      revisitPlace: { icon: "↻", title: "Revisit", fallbackBody: "Look for what changed in the same place." },
      nearbyPulse: { icon: "◎", title: "Nearby", fallbackBody: "Open places where records are growing." },
      needsId: { icon: "?", title: "Needs ID", fallbackBody: "Check one record that needs a name." },
    },
    es: {
      recordToday: { icon: "+", title: "Guardar foto", fallbackBody: "Puedes registrar antes de saber el nombre." },
      revisitPlace: { icon: "↻", title: "Volver", fallbackBody: "Mira que cambio en el mismo lugar." },
      nearbyPulse: { icon: "◎", title: "Cerca", fallbackBody: "Abre lugares con mas registros." },
      needsId: { icon: "?", title: "Ayudar a nombrar", fallbackBody: "Revisa un registro sin nombre claro." },
    },
    "pt-BR": {
      recordToday: { icon: "+", title: "Salvar foto", fallbackBody: "Voce pode registrar antes de saber o nome." },
      revisitPlace: { icon: "↻", title: "Voltar", fallbackBody: "Veja o que mudou no mesmo lugar." },
      nearbyPulse: { icon: "◎", title: "Perto", fallbackBody: "Abra lugares com mais registros." },
      needsId: { icon: "?", title: "Ajudar no nome", fallbackBody: "Revise um registro sem nome claro." },
    },
  };
  return localized[lang]?.[kind] ?? localized.ja[kind];
}

function fallbackHeroDailyCards(): LandingDailyCard[] {
  return [
    { kind: "recordToday", href: "/record", primaryText: null, secondaryText: null, metricValue: null },
    { kind: "nearbyPulse", href: "/map", primaryText: null, secondaryText: null, metricValue: null },
    { kind: "needsId", href: "/records?view=needs_id", primaryText: null, secondaryText: null, metricValue: null },
    { kind: "revisitPlace", href: "/records?view=places", primaryText: null, secondaryText: null, metricValue: null },
  ];
}

function prioritizeHeroDailyCards(cards: LandingDailyCard[], isLoggedIn: boolean): LandingDailyCard[] {
  const source = cards.length > 0 ? cards : fallbackHeroDailyCards();
  const fallback = fallbackHeroDailyCards();
  const priority: LandingDailyCardKind[] = isLoggedIn
    ? ["recordToday", "revisitPlace", "nearbyPulse", "needsId"]
    : ["recordToday", "nearbyPulse", "needsId"];
  return priority
    .map((kind) => source.find((card) => card.kind === kind) ?? fallback.find((card) => card.kind === kind))
    .filter((card): card is LandingDailyCard => Boolean(card));
}

function landingHeroTrustItems(lang: SiteLang): Array<{ title: string; body: string }> {
  const localized: Record<SiteLang, Array<{ title: string; body: string }>> = {
    ja: [
      { title: "名前は後でいい", body: "候補や根拠は、記録後に確かめられます。" },
      { title: "AIは候補まで", body: "確定名ではなく、見分ける手がかりとして扱います。" },
      { title: "位置は安全側", body: "公開位置は、自然と人を守る粒度で表示します。" },
    ],
    en: [
      { title: "Names can come later", body: "Hints and evidence can be checked after posting." },
      { title: "AI stays as a hint", body: "Suggestions support review; they are not final names." },
      { title: "Location is safer", body: "Public places use a protective level of detail." },
    ],
    es: [
      { title: "El nombre puede esperar", body: "Las pistas y evidencias se revisan despues." },
      { title: "La IA solo sugiere", body: "Ayuda a revisar; no decide el nombre final." },
      { title: "Ubicacion mas segura", body: "La vista publica usa un detalle protector." },
    ],
    "pt-BR": [
      { title: "O nome pode vir depois", body: "Pistas e evidencias podem ser revisadas apos postar." },
      { title: "IA fica como dica", body: "Ela apoia a revisao; nao define o nome final." },
      { title: "Localizacao mais segura", body: "A area publica usa detalhe protetor." },
    ],
  };
  return localized[lang] ?? localized.ja;
}

function dailyActionKpi(kind: LandingDailyCardKind): string {
  switch (kind) {
    case "recordToday":
      return "landing:topA:primary:record";
    case "revisitPlace":
      return "landing:topA:primary:revisit";
    case "nearbyPulse":
      return "landing:topA:primary:map";
    case "needsId":
      return "landing:topA:primary:identify";
  }
}

function renderDailyActionCard(basePath: string, lang: SiteLang, copy: LandingStrings, card: LandingDailyCard): string {
  const action = landingDailyActionCopy(lang, card.kind);
  const cardCopy = copy.dailyDashboard.cards[card.kind];
  const href = landingHref(basePath, lang, card.href);
  const metricHtml = card.metricValue && card.metricValue > 0
    ? `<em><strong>${escapeHtml(formatLandingNumber(copy, card.metricValue))}</strong>${escapeHtml(cardCopy.metricLabel)}</em>`
    : "";
  const primaryClass = card.kind === "recordToday" ? " is-primary" : "";
  const recordKpiAttrs = card.kind === "recordToday"
    ? ` data-kpi-event="primary_cta_click" data-kpi-funnel="landing_record" data-kpi-target="${escapeHtml(href)}"`
    : "";
  return `<a class="prototype-topa-action prototype-topa-action-${escapeHtml(card.kind)}${primaryClass}" href="${escapeHtml(href)}" data-kpi-action="${escapeHtml(dailyActionKpi(card.kind))}"${recordKpiAttrs}>
    <span class="prototype-topa-action-icon" aria-hidden="true">${escapeHtml(action.icon)}</span>
    <strong>${escapeHtml(action.title)}</strong>
    ${metricHtml}
  </a>`;
}

function renderLandingContinuation(basePath: string, lang: SiteLang, copy: LandingStrings, snapshot: LandingSnapshot): string {
  if (!snapshot.viewerUserId) return "";
  const latest = snapshot.myFeed[0] ?? null;
  if (!latest) return "";
  const title = displayObservationName(latest, copy.heroPhotoFallback);
  const meta = landingObservationMeta(lang, latest);
  const detailHref = observationDetailHref(basePath, lang, latest);
  const revisitSourceId = latest.visitId || latest.detailId || latest.occurrenceId;
  const revisitHref = landingHref(basePath, lang, `/record?start=gallery&revisitObservationId=${encodeURIComponent(revisitSourceId)}`);
  const photoUrl = observationImageUrl(latest, "sm");
  const imageHtml = photoUrl
    ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(title)}" loading="eager" />`
    : `<span aria-hidden="true">REC</span>`;
  const storyCopy = lang === "en"
    ? {
        eyebrow: "Continue from last time",
        titlePrefix: "Your latest find",
        openLabel: "Open last record",
        recordLabel: "Add one more nearby",
      }
    : {
        eyebrow: "前回の自分から続ける",
        titlePrefix: "直近の発見",
        openLabel: "前回の記録を見る",
        recordLabel: "同じ場所でもう1件",
      };
  const habitHtml = snapshot.habit
    ? `<div class="prototype-topa-story-stats">
        <span><strong>${escapeHtml(formatLandingNumber(copy, snapshot.habit.thisWeekCount))}</strong>${lang === "en" ? "this week" : "今週"}</span>
        <span><strong>${escapeHtml(formatLandingNumber(copy, snapshot.habit.activeDaysLast60))}</strong>${lang === "en" ? "active days" : "観察日"}</span>
      </div>`
    : "";
  return `<section class="prototype-topa-story" aria-label="${escapeHtml(storyCopy.eyebrow)}">
    <a class="prototype-topa-story-media" href="${escapeHtml(detailHref)}" data-kpi-action="landing:story:latest">${imageHtml}</a>
    <div class="prototype-topa-story-copy">
      <small>${escapeHtml(storyCopy.eyebrow)}</small>
      <h2><span>${escapeHtml(storyCopy.titlePrefix)}</span>${escapeHtml(title)}</h2>
      <em>${escapeHtml(meta)}</em>
      <div class="prototype-topa-story-actions">
        <a href="${escapeHtml(detailHref)}" data-kpi-action="landing:story:latest">${escapeHtml(storyCopy.openLabel)}</a>
        <a class="is-primary" href="${escapeHtml(revisitHref)}" data-kpi-action="landing:story:revisit_record" data-kpi-event="primary_cta_click" data-kpi-funnel="landing_record" data-kpi-target="${escapeHtml(revisitHref)}">${escapeHtml(storyCopy.recordLabel)}</a>
      </div>
    </div>
    ${habitHtml}
  </section>`;
}

type LandingContentWallCopy = {
  eyebrow: string;
  title: string;
  mineEyebrow: string;
  mineTitle: string;
  communityEyebrow: string;
  communityTitle: string;
  emptyTitle: string;
  emptyBody: string;
  mineEmptyTitle: string;
  communityEmptyTitle: string;
  emptyCta: string;
  allCta: string;
};

function landingContentWallCopy(lang: SiteLang): LandingContentWallCopy {
  const localized: Record<SiteLang, LandingContentWallCopy> = {
    ja: {
      eyebrow: "WATCH",
      title: "投稿一覧",
      mineEyebrow: "MY RECORDS",
      mineTitle: "自分の記録",
      communityEyebrow: "EVERYONE'S RECORDS",
      communityTitle: "みんなの記録",
      emptyTitle: "表示できる投稿を準備中です",
      emptyBody: "投稿が入ると、ここにサムネイルで並びます。",
      mineEmptyTitle: "自分の投稿はまだありません",
      communityEmptyTitle: "みんなの投稿を準備中です",
      emptyCta: "記録する",
      allCta: "すべて見る",
    },
    en: {
      eyebrow: "WATCH",
      title: "Posts",
      mineEyebrow: "MY RECORDS",
      mineTitle: "My records",
      communityEyebrow: "EVERYONE'S RECORDS",
      communityTitle: "Everyone's records",
      emptyTitle: "Posts are still warming up",
      emptyBody: "New posts will appear here as thumbnails.",
      mineEmptyTitle: "No posts from you yet",
      communityEmptyTitle: "Everyone's posts are still warming up",
      emptyCta: "Post a record",
      allCta: "See all",
    },
    es: {
      eyebrow: "WATCH",
      title: "Publicaciones",
      mineEyebrow: "MY RECORDS",
      mineTitle: "Mis registros",
      communityEyebrow: "EVERYONE'S RECORDS",
      communityTitle: "Registros de todos",
      emptyTitle: "Aun no hay publicaciones",
      emptyBody: "Los registros con foto o video apareceran aqui.",
      mineEmptyTitle: "Aun no tienes publicaciones",
      communityEmptyTitle: "Aun no hay publicaciones de todos",
      emptyCta: "Registrar",
      allCta: "Ver todo",
    },
    "pt-BR": {
      eyebrow: "WATCH",
      title: "Publicacoes",
      mineEyebrow: "MY RECORDS",
      mineTitle: "Meus registros",
      communityEyebrow: "EVERYONE'S RECORDS",
      communityTitle: "Registros de todos",
      emptyTitle: "Ainda nao ha publicacoes",
      emptyBody: "Registros com foto ou video aparecerao aqui.",
      mineEmptyTitle: "Ainda nao ha publicacoes suas",
      communityEmptyTitle: "Ainda nao ha publicacoes de todos",
      emptyCta: "Registrar",
      allCta: "Ver tudo",
    },
  };
  return localized[lang] ?? localized.ja;
}

type LandingContentWallItem = LandingObservation & {
  contentSource: "mine" | "community";
  contentRecordCount?: number;
  contentSubjects?: LandingContentWallSubject[];
};

type LandingContentWallSubject = {
  occurrenceId: string;
  name: string;
  confidence: number | null;
  identificationCount: number;
  evidenceTier: number | null;
};

function landingContentWallGroupKey(obs: LandingContentWallItem): string {
  return obs.visitId
    || obs.detailId
    || [
      obs.observerUserId,
      landingObservationTimestamp(obs),
      obs.photoUrl || obs.mediaUrl || obs.occurrenceId,
    ].filter(Boolean).join(":");
}

function landingContentWallSubject(obs: LandingContentWallItem): LandingContentWallSubject {
  const confidence = typeof obs.confidenceScore === "number" && Number.isFinite(obs.confidenceScore)
    ? obs.confidenceScore
    : typeof obs.evidenceTier === "number" && Number.isFinite(obs.evidenceTier)
      ? obs.evidenceTier / 3
      : null;
  return {
    occurrenceId: obs.occurrenceId,
    name: displayObservationName(obs, "同定待ち"),
    confidence,
    identificationCount: obs.identificationCount ?? 0,
    evidenceTier: obs.evidenceTier ?? null,
  };
}

function compareLandingContentSubjects(a: LandingContentWallSubject, b: LandingContentWallSubject): number {
  const confidenceDelta = (b.confidence ?? -1) - (a.confidence ?? -1);
  if (confidenceDelta !== 0) return confidenceDelta;
  const idDelta = b.identificationCount - a.identificationCount;
  if (idDelta !== 0) return idDelta;
  const tierDelta = (b.evidenceTier ?? -1) - (a.evidenceTier ?? -1);
  if (tierDelta !== 0) return tierDelta;
  return a.name.localeCompare(b.name, "ja");
}

function landingContentWallItems(snapshot: LandingSnapshot, source: LandingContentWallItem["contentSource"]): LandingContentWallItem[] {
  const items = (source === "mine"
    ? snapshot.myFeed.map((obs) => ({ ...obs, contentSource: "mine" as const }))
    : snapshot.feed
      .filter((obs) => !snapshot.viewerUserId || obs.observerUserId !== snapshot.viewerUserId)
      .map((obs) => ({ ...obs, contentSource: "community" as const }))
  ).sort((a, b) => landingObservationTimestamp(b).localeCompare(landingObservationTimestamp(a)));
  const counts = new Map<string, number>();
  const subjectsByKey = new Map<string, LandingContentWallSubject[]>();
  const subjectIdsByKey = new Map<string, Set<string>>();
  for (const obs of items) {
    const key = landingContentWallGroupKey(obs);
    const previous = counts.get(key) ?? 0;
    counts.set(key, obs.subjectCount && obs.subjectCount > 1 ? Math.max(previous, obs.subjectCount) : previous + 1);
    const subjectIds = subjectIdsByKey.get(key) ?? new Set<string>();
    if (!subjectIds.has(obs.occurrenceId)) {
      subjectIds.add(obs.occurrenceId);
      subjectIdsByKey.set(key, subjectIds);
      const subjects = subjectsByKey.get(key) ?? [];
      subjects.push(landingContentWallSubject(obs));
      subjectsByKey.set(key, subjects);
    }
  }
  const grouped: LandingContentWallItem[] = [];
  const seen = new Set<string>();
  for (const obs of items) {
    const key = landingContentWallGroupKey(obs);
    if (seen.has(key)) continue;
    seen.add(key);
    const contentSubjects = (subjectsByKey.get(key) ?? [landingContentWallSubject(obs)])
      .slice()
      .sort(compareLandingContentSubjects);
    grouped.push({
      ...obs,
      displayName: contentSubjects[0]?.name ?? obs.displayName,
      contentRecordCount: Math.max(contentSubjects.length, counts.get(key) ?? 1),
      contentSubjects,
    });
  }
  return grouped.slice(0, 18);
}

function renderLandingContentSubjects(obs: LandingContentWallItem): string {
  const subjects = obs.contentSubjects ?? [];
  if (subjects.length <= 1) return "";
  const second = subjects[1];
  if (!second) return "";
  const rest = Math.max(0, (obs.contentRecordCount ?? subjects.length) - 2);
  const restHtml = rest > 0 ? `<em>+${escapeHtml(String(rest))}</em>` : "";
  return `<span class="prototype-content-subjects" aria-label="${escapeHtml("確度順の観察対象")}"><span>${escapeHtml(second.name)}</span>${restHtml}</span>`;
}

function renderLandingContentAvatar(obs: LandingContentWallItem): string {
  const avatarUrl = itemImageUrl({ photoUrl: obs.observerAvatarUrl }, "sm");
  const fallback = `<span class="prototype-content-avatar-symbol"></span>`;
  const image = avatarUrl
    ? `<img src="${escapeHtml(avatarUrl)}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='block';" />`
    : "";
  return `<span class="prototype-content-avatar" aria-hidden="true">${image}${fallback}</span>`;
}

function renderLandingContentWallCard(
  basePath: string,
  lang: SiteLang,
  copy: LandingStrings,
  obs: LandingContentWallItem,
  index: number,
): string {
  const href = observationDetailHref(basePath, lang, obs);
  const title = obs.contentSubjects?.[0]?.name ?? displayObservationName(obs, copy.heroPhotoFallback);
  const placeLabel = observationPlaceLabel(obs) || copy.heroLatestLabel;
  const mediaIcon = obs.hasVideo ? "video" : obs.photoUrl ? "image" : obs.entryType === "identification" ? "id" : "record";
  const imageUrl = observationImageUrl(obs, "md");
  const observerName = obs.observerName || (lang === "ja" ? "観察者" : "Observer");
  const recordCount = Math.max(obs.contentRecordCount ?? 1, obs.subjectCount ?? 1);
  const thumbHtml = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" loading="${index < 4 ? "eager" : "lazy"}" decoding="async" />`
    : `<span class="prototype-content-empty-thumb" aria-hidden="true"></span>`;
  return `<a class="prototype-content-card is-${escapeHtml(obs.contentSource)}" href="${escapeHtml(href)}" data-kpi-action="landing:content_wall:${escapeHtml(obs.contentSource)}">
    <span class="prototype-content-thumb">
      ${thumbHtml}
      <span class="prototype-content-icon-row" aria-hidden="true">
        <span class="prototype-content-icon is-${escapeHtml(mediaIcon)}"></span>
      </span>
    </span>
    <span class="prototype-content-body">
      <span class="prototype-content-title-line">
        <strong>${escapeHtml(title)}</strong>
        ${renderLandingContentSubjects(obs)}
      </span>
      <span class="prototype-content-author">
        ${renderLandingContentAvatar(obs)}
        <span class="prototype-content-author-copy">
          <em>${escapeHtml(observerName)}</em>
          <small>${escapeHtml(placeLabel)}</small>
        </span>
      </span>
    </span>
  </a>`;
}

function renderLandingContentWallEmpty(title: string, body: string, href: string, cta: string): string {
  return `<a class="prototype-content-empty" href="${escapeHtml(href)}" data-kpi-action="landing:content_wall:empty">
    <strong>${escapeHtml(title)}</strong>
    <span>${escapeHtml(body)}</span>
    <em>${escapeHtml(cta)}</em>
  </a>`;
}

function renderLandingContentWallLane(
  basePath: string,
  lang: SiteLang,
  copy: LandingStrings,
  wallCopy: LandingContentWallCopy,
  source: LandingContentWallItem["contentSource"],
  items: LandingContentWallItem[],
): string {
  const recordHref = landingHref(basePath, lang, "/record");
  const title = source === "mine" ? wallCopy.mineTitle : wallCopy.communityTitle;
  const eyebrow = source === "mine" ? wallCopy.mineEyebrow : wallCopy.communityEyebrow;
  const emptyTitle = source === "mine" ? wallCopy.mineEmptyTitle : wallCopy.communityEmptyTitle;
  const moreHref = landingHref(basePath, lang, source === "mine" ? "/records?view=mine" : "/records?view=public");
  const moreLabel = lang === "ja" ? "もっと見る" : lang === "en" ? "View more" : lang === "es" ? "Ver mas" : "Ver mais";
  const moreAria = lang === "ja"
    ? `${title}の投稿をもっと見る`
    : source === "mine" ? "View more of your posts" : "View more community posts";
  const cardsHtml = items.length > 0
    ? items.map((obs, index) => renderLandingContentWallCard(basePath, lang, copy, obs, index)).join("")
    : renderLandingContentWallEmpty(emptyTitle, wallCopy.emptyBody, recordHref, wallCopy.emptyCta);
  return `<section class="prototype-content-lane is-${escapeHtml(source)}" aria-label="${escapeHtml(title)}">
      <div class="prototype-content-lane-head">
        <div class="prototype-content-lane-title">
          <span>${escapeHtml(eyebrow)}</span>
          <h3>${escapeHtml(title)}</h3>
        </div>
        <a class="prototype-content-lane-more" href="${escapeHtml(moreHref)}" aria-label="${escapeHtml(moreAria)}" data-kpi-action="landing:content_wall:${escapeHtml(source)}:more">${escapeHtml(moreLabel)}</a>
      </div>
      <div class="prototype-content-grid">${cardsHtml}</div>
    </section>`;
}

function renderLandingContentWall(options: LandingTopRenderOptions): string {
  const { basePath, lang, copy, snapshot } = options;
  const wallCopy = landingContentWallCopy(lang);
  const mineItems = snapshot.viewerUserId ? landingContentWallItems(snapshot, "mine") : [];
  const communityItems = landingContentWallItems(snapshot, "community");
  const mineLimit = Math.min(6, Math.max(4, communityItems.length));
  const communityLimit = 12;
  const laneHtml = [
    snapshot.viewerUserId ? renderLandingContentWallLane(basePath, lang, copy, wallCopy, "mine", mineItems.slice(0, mineLimit)) : "",
    renderLandingContentWallLane(basePath, lang, copy, wallCopy, "community", communityItems.slice(0, snapshot.viewerUserId ? communityLimit : 18)),
  ].filter(Boolean).join("");
  const splitClass = snapshot.viewerUserId ? " is-split" : "";

  return `<section class="prototype-content-wall" aria-label="${escapeHtml(wallCopy.title)}">
    <div class="prototype-content-lanes${splitClass}">${laneHtml}</div>
  </section>`;
}

type LandingNearbyCard = {
  title: string;
  meta: string;
  count: number;
  countLabel: string;
  speciesCount: number;
  observerCount: number;
  localityLabel: string;
  href: string;
  kind: "field" | "place";
  label: string;
  imageUrl: string | null;
  insight: string;
};

function compactNearbyLabel(value: string | null | undefined): string {
  const label = value?.trim() ?? "";
  return label
    .replace(/・発見の探索区$/u, "")
    .replace(/^愛管株式会社\s+/u, "")
    .replace(/\s*\/\s*[^/]+$/u, "")
    .trim() || "観察エリア";
}

function normalizedNearbyName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

function isMeaningfulNearbyPlace(place: LandingSnapshot["myPlaces"][number]): boolean {
  const placeName = compactNearbyLabel(place.placeName);
  if (!placeName || placeName === "観察エリア") return false;
  const normalizedPlace = normalizedNearbyName(placeName);
  return normalizedPlace !== normalizedNearbyName(place.municipality) &&
    normalizedPlace !== normalizedNearbyName(place.latestDisplayName) &&
    place.visitCount > 0;
}

function nearbyFieldLabel(source: string | null | undefined, adminLevel: string | null | undefined): string {
  const key = adminLevel || source || "";
  if (key === "school") return "学校";
  if (key === "osm_park" || key === "park") return "公園";
  if (key === "symbiosis" || source === "nature_symbiosis_site") return "自然共生サイト";
  if (key === "protected" || source === "protected_area") return "保全";
  if (key === "oecm" || source === "oecm") return "OECM";
  if (key === "tsunag" || source === "tsunag") return "TSUNAG";
  return "エリア";
}

function normalizeDisplaySubject(value: string | null | undefined): string {
  const subject = value?.trim() ?? "";
  if (!subject || subject === "同定待ち") return "";
  return subject;
}

function nearbyLocalityLabel(input: {
  localityLabel?: string | null;
  city?: string | null;
  prefecture?: string | null;
  title?: string | null;
}): string {
  if (normalizedNearbyName(input.title).includes("連理の木の下で")) return "浜松市浜名区";
  let label = (input.localityLabel || input.city || "").trim();
  const prefecture = input.prefecture?.trim() ?? "";
  const title = normalizedNearbyName(input.title);
  if (prefecture && label.startsWith(prefecture)) label = label.slice(prefecture.length).trim();
  label = label.replace(/\s+/g, "");
  if (!label) return "";
  if (normalizedNearbyName(label) === title) return "";
  return label;
}

function nearbyGrowthInsight(field: Pick<LandingSnapshot["nearbyFields"][number], "observationCount" | "speciesCount" | "observerCount" | "signatureDisplayName" | "latestDisplayName">): string {
  const observations = Math.max(0, field.observationCount || 0);
  const species = Math.max(0, field.speciesCount || 0);
  const observers = Math.max(0, field.observerCount || 0);
  const signature = normalizeDisplaySubject(field.signatureDisplayName || field.latestDisplayName || "");
  if (species >= 8 && observers >= 2) return "次の調査で増減を比べる基準が育っています";
  if (species >= 3) return "確認済みの種を基準に、次回の変化を見られます";
  if (signature && observations >= 3) return `${signature}を同じ場所で見返せます`;
  if (species >= 2) return "同じエリアの確認種として束ねられています";
  if (observers >= 2) return "複数人の記録を同じ場所で見返せます";
  return "次の記録が比較の起点になります";
}

function nearbySubjectEvidence(card: LandingNearbyCard): string {
  const subject = normalizeDisplaySubject(card.meta);
  const species = Math.max(0, card.speciesCount || 0);
  if (species >= 2) return subject ? `${subject}など${species}種を確認済み` : `${species}種を確認済み`;
  if (subject) return `${subject}を確認済み`;
  return "同じ場所の記録を蓄積中";
}

function nearbyMetricItems(copy: LandingStrings, card: LandingNearbyCard): string[] {
  const items = [`${formatLandingNumber(copy, card.count)}${card.countLabel}`];
  if (card.speciesCount > 0) items.push(`${formatLandingNumber(copy, card.speciesCount)}種`);
  if (card.observerCount > 1) items.push(`${formatLandingNumber(copy, card.observerCount)}人`);
  return items;
}

function nearbyMetricText(copy: LandingStrings, card: LandingNearbyCard): string {
  return nearbyMetricItems(copy, card).join(" ・ ");
}

function selectNearbyCards(candidates: LandingNearbyCard[], limit: number): LandingNearbyCard[] {
  const selected: LandingNearbyCard[] = [];
  const seenImages = new Set<string>();
  const seenTitles = new Set<string>();

  for (const card of candidates) {
    const imageKey = normalizedNearbyName(card.imageUrl);
    const titleKey = normalizedNearbyName(card.title);
    if ((imageKey && seenImages.has(imageKey)) || seenTitles.has(titleKey)) continue;
    selected.push(card);
    if (imageKey) seenImages.add(imageKey);
    seenTitles.add(titleKey);
    if (selected.length >= limit) return selected;
  }

  for (const card of candidates) {
    if (selected.includes(card)) continue;
    selected.push(card);
    if (selected.length >= limit) break;
  }
  return selected;
}

function buildLandingNearbyCards(snapshot: LandingSnapshot, basePath: string, lang: SiteLang, placesHref: string): LandingNearbyCard[] {
  const fieldCards = (snapshot.nearbyFields ?? [])
    .filter((field) => field.observationCount > 0 && compactNearbyLabel(field.name) !== "観察エリア")
    .map((field): LandingNearbyCard => ({
      title: compactNearbyLabel(field.name),
      meta: compactNearbyLabel(field.latestDisplayName || field.city || field.prefecture),
      count: field.observationCount,
      countLabel: "記録",
      speciesCount: field.speciesCount,
      observerCount: field.observerCount,
      localityLabel: nearbyLocalityLabel({
        localityLabel: field.localityLabel,
        city: field.city,
        prefecture: field.prefecture,
        title: field.name,
      }),
      href: landingHref(basePath, lang, `/places/${encodeURIComponent(field.fieldId)}/snapshot`),
      kind: "field",
      label: nearbyFieldLabel(field.source, field.adminLevel),
      imageUrl: field.latestPhotoUrl,
      insight: nearbyGrowthInsight(field),
    }));
  const placeCards = snapshot.viewerUserId
    ? snapshot.myPlaces
      .filter(isMeaningfulNearbyPlace)
      .slice(0, Math.max(0, 3 - fieldCards.length))
      .map((place): LandingNearbyCard => ({
        title: compactNearbyLabel(place.placeName),
        meta: compactNearbyLabel(place.latestDisplayName || place.nextLookFor || place.municipality),
        count: place.visitCount,
        countLabel: "記録",
        speciesCount: 0,
        observerCount: 1,
        localityLabel: nearbyLocalityLabel({
          localityLabel: place.municipality,
          city: place.municipality,
          title: place.placeName,
        }),
        href: placesHref,
        kind: "place",
        label: "場所",
        imageUrl: null,
        insight: place.latestDisplayName
          ? `${compactNearbyLabel(place.latestDisplayName)}を見返せる場所`
          : "次の記録で変化を比べられる場所",
      }))
    : [];
  return selectNearbyCards([...fieldCards, ...placeCards], 3);
}

function renderLandingNearbySection(options: LandingTopRenderOptions): string {
  const { basePath, lang, snapshot } = options;
  const mapHref = landingHref(basePath, lang, "/map");
  const placesHref = landingHref(basePath, lang, "/records?view=places");
  const cards = buildLandingNearbyCards(snapshot, basePath, lang, placesHref);
  const cardHtml = cards.length > 0
    ? cards.map((card, index) => {
      const variant = index === 0 ? "feature" : "compact";
      const thumbUrl = landingPreviewMediaUrl(toThumbnailUrl(card.imageUrl, "md") ?? card.imageUrl);
      const thumbHtml = thumbUrl
        ? `<i class="prototype-monitoring-thumb"><img src="${escapeHtml(thumbUrl)}" alt="" loading="lazy" decoding="async" /></i>`
        : `<i class="prototype-monitoring-thumb is-empty" aria-hidden="true"></i>`;
      return `<a class="prototype-monitoring-card is-${escapeHtml(variant)} is-${escapeHtml(card.kind)}" href="${escapeHtml(card.href)}" data-kpi-action="landing:nearby:${escapeHtml(card.kind)}">
        ${thumbHtml}
        <span class="prototype-monitoring-meta-row">
          <span class="prototype-monitoring-label">${escapeHtml(card.label)}</span>
          ${card.localityLabel ? `<span class="prototype-monitoring-locality">${escapeHtml(card.localityLabel)}</span>` : ""}
        </span>
        <strong>${escapeHtml(card.title)}</strong>
        <small>${escapeHtml(nearbySubjectEvidence(card))}</small>
        <p>${escapeHtml(card.insight)}</p>
        <em class="prototype-monitoring-metrics">${escapeHtml(nearbyMetricText(options.copy, card))}</em>
      </a>`;
    }).join("")
    : `<a class="prototype-monitoring-empty" href="${escapeHtml(mapHref)}" data-kpi-action="landing:nearby:empty">公開できるエリアを準備中です</a>`;

  return `<section class="prototype-monitoring-areas" id="topa-local-map" aria-label="育つ観察エリア">
    <div class="prototype-monitoring-head">
      <div class="prototype-monitoring-title"><span>MONITORING AREA</span><h2>育つ観察エリア</h2></div>
      <a href="${escapeHtml(mapHref)}" data-kpi-action="landing:topA:shelf:localMap">地図で見る</a>
    </div>
    <div class="prototype-monitoring-grid">${cardHtml}</div>
  </section>`;
}

type LandingInvasiveWatchItem = {
  category: string;
  title: string;
  body: string;
  impact: string;
  cue: string;
  motif: "plant" | "aquaticPlant" | "insect" | "spider" | "reptile" | "fish" | "mammal" | "bird";
};

function landingLocalityText(snapshot: LandingSnapshot): string {
  const values = [
    ...snapshot.nearbyFields.flatMap((field) => [
      field.name,
      field.city,
      field.prefecture,
      field.localityLabel,
    ]),
    ...snapshot.myPlaces.flatMap((place) => [
      place.placeName,
      place.municipality,
      place.latestDisplayName,
      place.nextLookFor,
    ]),
  ];
  return values.filter(Boolean).join(" ");
}

function buildLandingInvasiveWatchItems(snapshot: LandingSnapshot): LandingInvasiveWatchItem[] {
  const text = landingLocalityText(snapshot);
  const isHamamatsu = /浜松市|浜名区|中央区|天竜区|北区|西区|東区|南区/u.test(text);
  const isShizuoka = isHamamatsu || /静岡県|静岡市|磐田市|湖西市|掛川市|袋井市|藤枝市|焼津市|沼津市|富士市/u.test(text);
  if (!isShizuoka) return [];
  return [
    { category: "植物", title: "オオキンケイギク", body: "道路脇・空き地の黄色い群落", impact: "在来の野草の場所を奪う", cue: "生きたまま運ばない", motif: "plant" },
    { category: "水草", title: "ナガエツルノゲイトウ", body: "水路・湿地に広がる草のマット", impact: "水辺や農地へ切れ端から広がる", cue: "切れ端を流さない", motif: "aquaticPlant" },
    { category: "昆虫", title: "ヒアリ", body: "小さな赤褐色のアリ", impact: "刺される被害や定着リスク", cue: "毒針がある。触らない", motif: "insect" },
    { category: "哺乳類", title: "ヌートリア", body: "川沿い・水路の足あとや巣穴", impact: "農作物や希少植物を食べる", cue: "許可なく捕獲しない", motif: "mammal" },
  ];
}

const invasiveThumbByMotif: Record<LandingInvasiveWatchItem["motif"], string> = {
  plant: "/assets/img/invasive/invasive-plant.png",
  aquaticPlant: "/assets/img/invasive/invasive-aquatic-plant.png",
  insect: "/assets/img/invasive/invasive-insect.png",
  spider: "/assets/img/invasive/invasive-spider.png",
  reptile: "/assets/img/invasive/invasive-reptile.png",
  fish: "/assets/img/invasive/invasive-fish.png",
  mammal: "/assets/img/invasive/invasive-mammal.png",
  bird: "/assets/img/invasive/invasive-bird.png",
};

function renderInvasiveThumb(motif: LandingInvasiveWatchItem["motif"]): string {
  return `<i class="prototype-invasive-thumb is-${escapeHtml(motif)}"><img src="${escapeHtml(invasiveThumbByMotif[motif])}" alt="" loading="lazy" decoding="async" /></i>`;
}

function formatNearbyEventWhen(raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function renderLandingLocalFollowups(options: LandingTopRenderOptions): string {
  const { basePath, lang, snapshot } = options;
  const invasiveHref = landingHref(basePath, lang, "/learn/invasive-species-reporting");
  const eventsHref = landingHref(basePath, lang, "/community/events");
  const newEventHref = landingHref(basePath, lang, "/community/events/new");
  const invasiveItems = buildLandingInvasiveWatchItems(snapshot);
  const invasiveHtml = invasiveItems.map((item) => `<a class="prototype-local-watch-card is-${escapeHtml(item.motif)}" href="${escapeHtml(invasiveHref)}" data-kpi-action="landing:local:invasive">
        ${renderInvasiveThumb(item.motif)}
        <span class="prototype-invasive-meta"><em>${escapeHtml(item.category)}</em><mark>${escapeHtml(item.cue)}</mark></span>
        <strong class="prototype-invasive-name">${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.body)}</small>
        <small class="prototype-invasive-impact">${escapeHtml(item.impact)}</small>
      </a>`).join("");
  const nearbyEvents = (snapshot.nearbyEvents ?? [])
    .slice()
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
    .slice(0, 3);
  const eventsHtml = nearbyEvents.length > 0
    ? nearbyEvents.map((event) => {
      const href = event.eventCode
        ? landingHref(basePath, lang, `/community/events/${encodeURIComponent(event.eventCode)}/join`)
        : landingHref(basePath, lang, `/events/${encodeURIComponent(event.sessionId)}/live`);
      const place = event.fieldName || event.city || event.prefecture || "近くのエリア";
      const when = formatNearbyEventWhen(event.startedAt);
      return `<a class="prototype-local-event-row" href="${escapeHtml(href)}" data-kpi-action="landing:local:event">
        <span>${escapeHtml(when || "予定")}</span>
        <strong>${escapeHtml(event.title)}</strong>
        <small>${escapeHtml(place)}${event.participantCount > 0 ? ` ・ ${formatLandingNumber(options.copy, event.participantCount)}人` : ""}</small>
      </a>`;
    }).join("")
    : `<div class="prototype-local-event-empty">
        <strong>近くの予定はまだありません</strong>
        <small>エリアに観察会が入ったらここに出ます</small>
        <a href="${escapeHtml(newEventHref)}" data-kpi-action="landing:local:event:create">この近くで開く</a>
      </div>`;

  const invasivePanel = invasiveItems.length > 0
    ? `<article class="prototype-local-panel is-invasive">
      <div class="prototype-monitoring-head">
        <div class="prototype-monitoring-title"><span>INVASIVE SIGNALS</span><h2>近くの外来種メモ</h2></div>
        <a href="${escapeHtml(invasiveHref)}" data-kpi-action="landing:local:invasive:list">一覧を見る</a>
      </div>
      <div class="prototype-local-list">${invasiveHtml}</div>
    </article>`
    : "";

  return `<section class="prototype-local-followups${invasivePanel ? "" : " is-single"}" aria-label="近くの外来種と観察会">
    ${invasivePanel}
    <article class="prototype-local-panel is-events">
      <div class="prototype-monitoring-head">
        <div class="prototype-monitoring-title"><span>FIELD EVENTS</span><h2>近くの観察会</h2></div>
        <a href="${escapeHtml(eventsHref)}" data-kpi-action="landing:local:event:list">一覧を見る</a>
      </div>
      <div class="prototype-local-list">${eventsHtml}</div>
    </article>
  </section>`;
}

function landingGuideOutcomeItems(snapshot: LandingSnapshot): LandingTopGuideItem[] {
  const seen = new Set<string>();
  const items: LandingTopGuideItem[] = [];
  for (const item of snapshot.guideOutcomes ?? []) {
    if (!isLandingGuideItem(item) || seen.has(item.guideRecordId)) continue;
    seen.add(item.guideRecordId);
    items.push(item);
  }
  if (items.length > 0) return items;

  for (const shelf of snapshot.topShelves ?? []) {
    if (shelf.kind !== "guide") continue;
    for (const item of shelf.items) {
      if (!isLandingGuideItem(item) || seen.has(item.guideRecordId)) continue;
      seen.add(item.guideRecordId);
      items.push(item);
    }
  }
  return items;
}

type LandingGuideOutcomeGroup = {
  sessionId: string;
  observerName: string;
  href: string;
  photoUrl: string | null;
  items: LandingTopGuideItem[];
};

function landingGuideOutcomeGroups(snapshot: LandingSnapshot): LandingGuideOutcomeGroup[] {
  const groups = new Map<string, LandingGuideOutcomeGroup>();
  for (const item of landingGuideOutcomeItems(snapshot)) {
    const key = item.sessionId || item.guideRecordId;
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
      if (!existing.photoUrl && item.photoUrl) existing.photoUrl = item.photoUrl;
      continue;
    }
    groups.set(key, {
      sessionId: key,
      observerName: item.observerName || "誰か",
      href: item.href,
      photoUrl: item.photoUrl,
      items: [item],
    });
  }
  return Array.from(groups.values()).slice(0, 3);
}

function guideOutcomeSubject(item: LandingTopGuideItem): string {
  const detected = item.detectedSpecies.find((name) => name.trim());
  const raw = item.displayName || detected || "自然の気配";
  const text = [raw, item.summary, ...item.detectedSpecies].filter(Boolean).join(" ");
  if (/舗装路|道路|線路|鉄道|防音壁|コンクリート|住宅|架線|電柱/u.test(raw)) {
    if (/林|樹|竹|広葉|常緑|落葉/u.test(text)) return "沿線の緑";
    if (/草|雑草|植生|群落|つる植物/u.test(text)) return "道ばたの草地";
    return "場所の表情";
  }
  if (/常緑.*落葉|落葉.*常緑|二次林|竹林|広葉樹|幼樹/u.test(raw)) return "沿線の樹林";
  if (/雑草|草地|草本|群落|つる植物/u.test(raw)) return "道ばたの草地";
  if (/水辺|水路|湿地|川|池/u.test(raw)) return "水辺の気配";
  return raw.length > 18 ? `${raw.slice(0, 18)}…` : raw;
}

function guideOutcomeTheme(item: LandingTopGuideItem): "water" | "green" | "sound" | "place" {
  const text = [item.displayName, item.summary, ...item.detectedSpecies].filter(Boolean).join(" ");
  if (/鳥の声|鳴き声|音声|自然音/u.test(text)) return "sound";
  if (/水辺|水路|川|池|湿地/u.test(text) && !/期待できる|探る段階/u.test(text)) return "water";
  if (/草|雑草|樹|林|竹|葉|植生|群落|花/u.test(text)) return "green";
  return "place";
}

function guideOutcomeBody(item: LandingTopGuideItem): string {
  const theme = guideOutcomeTheme(item);
  if (theme === "water") return "水辺のまわりに、草と地形の表情が見えてきた";
  if (theme === "sound") return "姿だけでは残らない気配が、場面として残った";
  if (theme === "green") return "何気ない景色に、植生の重なりが見えてきた";
  return "いつもの場所の状態が成果になった";
}

function guideOutcomeFeeling(item: LandingTopGuideItem): string {
  const theme = guideOutcomeTheme(item);
  if (theme === "water") return "水辺が少し立体的に見える";
  if (theme === "sound") return "音も自然の輪郭になった";
  if (theme === "green") return "通りすぎる緑に顔つきが出た";
  return "名前の前に、場所の状態が成果になった";
}

function guideGroupTheme(group: LandingGuideOutcomeGroup): "water" | "green" | "sound" | "place" {
  const themes = group.items.map(guideOutcomeTheme);
  if (themes.includes("sound")) return "sound";
  if (themes.includes("water")) return "water";
  if (themes.includes("green")) return "green";
  return "place";
}

function guideGroupTitle(group: LandingGuideOutcomeGroup): string {
  const first = group.items[0];
  if (!first) return "ガイドで見えたことが残った";
  if (group.items.length === 1) return `${guideOutcomeSubject(first)}が見えてきた`;
  const theme = guideGroupTheme(group);
  if (theme === "water") return "水辺の気配がまとまって見えてきた";
  if (theme === "sound") return "音と景色がひとつの場面になった";
  if (theme === "green") return "緑の重なりがまとまって見えてきた";
  return "場所の表情がまとまって見えてきた";
}

function guideGroupBody(group: LandingGuideOutcomeGroup): string {
  const first = group.items[0];
  if (!first) return "いつもの場所の状態が成果になった";
  if (group.items.length === 1) return guideOutcomeBody(first);
  const subjects = Array.from(new Set(group.items.map(guideOutcomeSubject))).slice(0, 2);
  return `${group.items.length}シーンから、${subjects.join("と")}がひとつの流れとして残った`;
}

function guideGroupFeeling(group: LandingGuideOutcomeGroup): string {
  const first = group.items[0];
  if (!first) return "一回のガイドが、場所の成果になった";
  if (group.items.length === 1) return guideOutcomeFeeling(first);
  const theme = guideGroupTheme(group);
  if (theme === "green") return "一回のガイドが、場所の緑の表情になった";
  if (theme === "water") return "一回のガイドが、水辺の表情になった";
  if (theme === "sound") return "一回のガイドが、音のある場面になった";
  return "一回のガイドが、場所の成果になった";
}

function renderLandingGuideOutcomes(options: LandingTopRenderOptions): string {
  const { basePath, lang, snapshot } = options;
  const summaryCards = (snapshot.guideOutcomeSummaries ?? []).slice(0, 4).map((summary) => {
    const imageUrl = itemImageUrl({ photoUrl: summary.mediaThumbUrl }, "md");
    const avatarUrl = itemImageUrl({ photoUrl: summary.observerAvatarUrl }, "sm");
    const imageHtml = imageUrl
      ? `<img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" decoding="async" onerror="this.parentElement.classList.add('is-empty');this.remove();" />`
      : `<span aria-hidden="true">GUIDE</span>`;
    return `<a class="prototype-guide-outcome-card is-${escapeHtml(summary.primaryTheme)}" href="${escapeHtml(landingHref(basePath, lang, summary.href))}" data-kpi-action="landing:guide-outcomes:summary">
      <i class="prototype-guide-outcome-thumb">${imageHtml}</i>
      <span class="prototype-guide-outcome-user">
        <i>${avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="" loading="lazy" decoding="async" />` : escapeHtml(summary.observerName.slice(0, 1) || "G")}</i>
        <b>${escapeHtml(summary.observerName)}</b>
        ${summary.publicLocationLabel ? `<small>${escapeHtml(summary.publicLocationLabel)}</small>` : ""}
      </span>
      <strong>${escapeHtml(summary.headline)}</strong>
      <small>${escapeHtml(summary.body)}</small>
      <em>${escapeHtml(summary.evidenceLine)}</em>
    </a>`;
  });
  const groups = landingGuideOutcomeGroups(snapshot);
  if (summaryCards.length === 0 && groups.length === 0) return "";
  const href = landingHref(basePath, lang, "/guide/outcomes");
  const cards = groups.map((group) => {
    const imageUrl = itemImageUrl({ photoUrl: group.photoUrl }, "md");
    const actor = `${group.observerName} がガイドを使って`;
    const imageHtml = imageUrl
      ? `<img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" decoding="async" onerror="this.parentElement.classList.add('is-empty');this.remove();" />`
      : `<span aria-hidden="true">GUIDE</span>`;
    return `<a class="prototype-guide-outcome-card" href="${escapeHtml(landingHref(basePath, lang, group.href))}" data-kpi-action="landing:guide-outcomes:card">
      <i class="prototype-guide-outcome-thumb">${imageHtml}</i>
      <span>${escapeHtml(actor)}</span>
      <strong>${escapeHtml(guideGroupTitle(group))}</strong>
      <small>${escapeHtml(guideGroupBody(group))}</small>
      <em>${escapeHtml(guideGroupFeeling(group))}</em>
    </a>`;
  }).join("");

  return `<section class="prototype-guide-outcomes" aria-label="ガイドで見えたこと">
    <div class="prototype-monitoring-head">
      <div class="prototype-monitoring-title"><span>GUIDE OUTCOMES</span><h2>ガイドの記録</h2></div>
      <a href="${escapeHtml(href)}" data-kpi-action="landing:guide-outcomes:list">一覧を見る</a>
    </div>
    <div class="prototype-guide-outcome-grid">${summaryCards.join("") || cards}</div>
  </section>`;
}

function observationStatusLabel(lang: SiteLang, obs: LandingTopShelfItem): { label: string; tone: "green" | "blue" | "amber" } {
  const labels: Record<SiteLang, { guide: string; guidePromoted: string; ai: string; reviewing: string; needsId: string }> = {
    ja: { guide: "未検証候補", guidePromoted: "対象ごとの記録", ai: "AI候補", reviewing: "確認中", needsId: "同定待ち" },
    en: { guide: "Unverified lead", guidePromoted: "Observation made", ai: "AI hint", reviewing: "In review", needsId: "Needs ID" },
    es: { guide: "Candidato sin verificar", guidePromoted: "Observacion creada", ai: "Pista IA", reviewing: "En revision", needsId: "Sin nombre" },
    "pt-BR": { guide: "Candidato nao verificado", guidePromoted: "Observacao criada", ai: "Dica IA", reviewing: "Em revisao", needsId: "Sem nome" },
  };
  const copy = labels[lang] ?? labels.ja;
  if (isLandingGuideItem(obs)) {
    return obs.promotionAction === "view_observation"
      ? { label: copy.guidePromoted, tone: "green" }
      : { label: copy.guide, tone: "blue" };
  }
  if (obs.isAiCandidate) return { label: copy.ai, tone: "blue" };
  if (obs.identificationCount > 0) return { label: copy.reviewing, tone: "green" };
  return { label: copy.needsId, tone: "amber" };
}

function landingShelfAction(lang: SiteLang, kind: LandingTopShelfKind, item: LandingTopShelfItem): string {
  const labels: Record<SiteLang, {
    guideOutcome: string;
    evidence: string;
    name: string;
    motion: string;
    guide: string;
    scan: string;
    season: string;
    promote: string;
    addPhoto: string;
    viewObservation: string;
  }> = {
    ja: { guideOutcome: "ガイド成果を見る", evidence: "根拠を見に行く", name: "名前を確かめる", motion: "動きを見る", guide: "ガイドの流れを見る", scan: "現地の手がかりを見る", season: "同じ季節に探す", promote: "対象ごとの記録にする", addPhoto: "写真を追加して記録する", viewObservation: "観察レコードを見る" },
    en: { guideOutcome: "Open guide result", evidence: "Check evidence", name: "Help name it", motion: "Watch motion", guide: "Open guide flow", scan: "Open field clues", season: "Look in this season", promote: "Make observation record", addPhoto: "Add photo to record", viewObservation: "View observation" },
    es: { guideOutcome: "Ver resultado guia", evidence: "Ver evidencia", name: "Ayudar a nombrar", motion: "Ver movimiento", guide: "Abrir guia", scan: "Ver pistas del lugar", season: "Mirar en esta temporada", promote: "Crear registro", addPhoto: "Anadir foto", viewObservation: "Ver observacion" },
    "pt-BR": { guideOutcome: "Ver resultado guia", evidence: "Ver evidencia", name: "Ajudar no nome", motion: "Ver movimento", guide: "Abrir guia", scan: "Ver pistas do lugar", season: "Observar nesta estacao", promote: "Criar observacao", addPhoto: "Adicionar foto", viewObservation: "Ver observacao" },
  };
  const copy = labels[lang] ?? labels.ja;
  if (isLandingGuideItem(item)) {
    if (item.promotionAction === "view_observation") return copy.viewObservation;
    if (item.promotionAction === "add_photo") return copy.addPhoto;
    return copy.promote;
  }
  if (kind === "needsId") return item.identificationCount > 0 ? copy.evidence : copy.name;
  if (kind === "video") return copy.motion;
  if (kind === "guide") return copy.guide;
  if (kind === "scan") return copy.scan;
  if (item.identificationCount === 0 || item.isAiCandidate) return copy.name;
  return copy.season;
}

function landingShelfCardKpi(kind: LandingTopShelfKind): string {
  return `landing:topA:shelf:${kind}`;
}

function renderEvidenceBadge(lang: SiteLang, item: LandingTopShelfItem): string {
  if (!isLandingObservationItem(item)) return "";
  const labelsByLang: Record<SiteLang, { photo: string; video: string }> = {
    ja: { photo: "写真", video: "動画あり" },
    en: { photo: "Photo", video: "Video" },
    es: { photo: "Foto", video: "Video" },
    "pt-BR": { photo: "Foto", video: "Video" },
  };
  const labelCopy = labelsByLang[lang] ?? labelsByLang.ja;
  const labels = [
    item.photoUrl ? labelCopy.photo : "",
    item.hasVideo ? labelCopy.video : "",
  ].filter(Boolean);
  if (labels.length === 0) return "";
  return `<span class="prototype-topa-evidence-badge">${escapeHtml(labels.join(" + "))}</span>`;
}

function renderTopAObservationCard(
  basePath: string,
  lang: SiteLang,
  copy: LandingStrings,
  obs: LandingTopShelfItem,
  index: number,
  kpiAction: string,
  shelfKind: LandingTopShelfKind = "today",
): string {
  const href = landingItemHref(basePath, lang, obs);
  const imageUrl = itemImageUrl(obs, "md");
  const title = displayLandingItemName(obs, copy.heroPhotoFallback);
  const safeLocationCopy: Record<SiteLang, string> = {
    ja: "公開位置は安全側で表示",
    en: "Public location is shown safely",
    es: "La ubicacion publica se muestra con seguridad",
    "pt-BR": "A localizacao publica aparece com seguranca",
  };
  const baseMeta = landingItemMeta(lang, obs) || safeLocationCopy[lang] || safeLocationCopy.ja;
  const meta = isLandingGuideItem(obs) && obs.summary
    ? `${baseMeta} · ${obs.summary.slice(0, 42)}`
    : baseMeta;
  const status = observationStatusLabel(lang, obs);
  const mediaHtml = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" loading="${index === 0 ? "eager" : "lazy"}" decoding="async" />${renderEvidenceBadge(lang, obs)}`
    : `<span class="prototype-topa-empty-thumb" aria-hidden="true">${shelfKind === "video" ? "VIDEO" : isLandingGuideItem(obs) ? "GUIDE" : "PHOTO"}</span>`;

  return `<a class="prototype-topa-card" href="${escapeHtml(href)}" data-kpi-action="${escapeHtml(kpiAction)}">
    <span class="prototype-topa-thumb">${mediaHtml}</span>
    <span class="prototype-topa-card-body">
      <strong>${escapeHtml(title)}</strong>
      <small>${escapeHtml(meta)}</small>
      <em class="prototype-topa-status is-${status.tone}">${escapeHtml(status.label)}</em>
      <span class="prototype-topa-next">${escapeHtml(landingShelfAction(lang, shelfKind, obs))}</span>
    </span>
  </a>`;
}

function renderTopAEmptyCard(basePath: string, lang: SiteLang, title: string, body: string, href: string, kpiAction: string): string {
  return `<a class="prototype-topa-empty-card" href="${escapeHtml(landingHref(basePath, lang, href))}" data-kpi-action="${escapeHtml(kpiAction)}">
    <strong>${escapeHtml(title)}</strong>
    <span>${escapeHtml(body)}</span>
  </a>`;
}

function renderLandingShelfCta(basePath: string, lang: SiteLang, shelf: LandingTopShelf): string {
  if (!shelf.cta) return "";
  const localizedCta: Partial<Record<SiteLang, Partial<Record<LandingTopShelfKind, LandingTopShelf["cta"]>>>> = {
    en: {
      video: { title: "Add records with motion", body: "Calls, walking, and wingbeats are easier to keep as short videos.", href: "/record?start=video", actionLabel: "Record video" },
      guide: { title: "Walk with the guide", body: "Follow seasonal and place-based prompts when you want something to notice.", href: "/guide", actionLabel: "Open guide" },
      scan: { title: "Scan on site", body: "Bundle photo, sound, and place clues so people can check them later.", href: "/lens", actionLabel: "Start scan" },
    },
    es: {
      video: { title: "Anade registros con movimiento", body: "Cantos, pasos y aleteos se guardan mejor como videos cortos.", href: "/record?start=video", actionLabel: "Registrar video" },
      guide: { title: "Caminar con guia", body: "Sigue pistas de temporada y lugar cuando quieras notar algo.", href: "/guide", actionLabel: "Abrir guia" },
      scan: { title: "Escanear en el lugar", body: "Une foto, sonido y lugar para que otros puedan revisar despues.", href: "/lens", actionLabel: "Iniciar scan" },
    },
    "pt-BR": {
      video: { title: "Adicione registros com movimento", body: "Cantos, passos e asas ficam melhores em videos curtos.", href: "/record?start=video", actionLabel: "Registrar video" },
      guide: { title: "Caminhar com guia", body: "Siga pistas de estacao e lugar quando quiser notar algo.", href: "/guide", actionLabel: "Abrir guia" },
      scan: { title: "Escanear no local", body: "Junte foto, som e lugar para que outros possam revisar depois.", href: "/lens", actionLabel: "Iniciar scan" },
    },
  };
  const cta = localizedCta[lang]?.[shelf.kind] ?? shelf.cta;
  return renderTopAEmptyCard(
    basePath,
    lang,
    cta.title,
    cta.body,
    cta.href,
    `landing:topA:shelf:${shelf.kind}:cta`,
  );
}

function landingShelfUiCopy(lang: SiteLang, shelf: LandingTopShelf): { title: string; eyebrow: string; all: string } {
  const isPersonalGuideShelf = shelf.kind === "guide" && shelf.href === "/guide/outcomes";
  const localized: Record<SiteLang, Partial<Record<LandingTopShelfKind, { title: string; eyebrow: string }>> & { all: string }> = {
    ja: {
      today: { title: "みんなの発見", eyebrow: "LIVE FEED" },
      photo: { title: "写真と動画", eyebrow: "MEDIA" },
      video: { title: "動画", eyebrow: "VIDEO" },
      guide: { title: "ガイドで見つけたこと", eyebrow: "GUIDE" },
      scan: { title: "スキャンから見えたもの", eyebrow: "SCAN" },
      needsId: { title: "名前を待つ記録", eyebrow: "IDENTIFY" },
      all: "すべて見る",
    },
    en: {
      today: { title: "Everyone's finds", eyebrow: "LIVE FEED" },
      photo: { title: "Photos and videos", eyebrow: "MEDIA" },
      video: { title: "Videos", eyebrow: "VIDEO" },
      guide: { title: "Found with guides", eyebrow: "GUIDE" },
      scan: { title: "Seen from scans", eyebrow: "SCAN" },
      needsId: { title: "Records needing a name", eyebrow: "IDENTIFY" },
      all: "See all",
    },
    es: {
      today: { title: "Hallazgos de todos", eyebrow: "LIVE FEED" },
      photo: { title: "Fotos y videos", eyebrow: "MEDIA" },
      video: { title: "Videos", eyebrow: "VIDEO" },
      guide: { title: "Hallazgos con guia", eyebrow: "GUIDE" },
      scan: { title: "Visto en escaneos", eyebrow: "SCAN" },
      needsId: { title: "Registros sin nombre", eyebrow: "IDENTIFY" },
      all: "Ver todo",
    },
    "pt-BR": {
      today: { title: "Descobertas de todos", eyebrow: "LIVE FEED" },
      photo: { title: "Fotos e videos", eyebrow: "MEDIA" },
      video: { title: "Videos", eyebrow: "VIDEO" },
      guide: { title: "Encontrado com guias", eyebrow: "GUIDE" },
      scan: { title: "Visto em scans", eyebrow: "SCAN" },
      needsId: { title: "Registros sem nome", eyebrow: "IDENTIFY" },
      all: "Ver tudo",
    },
  };
  const copy = localized[lang] ?? localized.ja;
  const personalGuideCopy: Record<SiteLang, { title: string; eyebrow: string }> = {
    ja: { title: "自分のガイド成果", eyebrow: "MY GUIDE" },
    en: { title: "Your guide outcomes", eyebrow: "MY GUIDE" },
    es: { title: "Tus resultados de guia", eyebrow: "MY GUIDE" },
    "pt-BR": { title: "Seus resultados do guia", eyebrow: "MY GUIDE" },
  };
  const shelfCopy = isPersonalGuideShelf
    ? personalGuideCopy[lang] ?? personalGuideCopy.ja
    : copy[shelf.kind] ?? { title: shelf.title, eyebrow: shelf.eyebrow };
  return {
    title: shelfCopy.title,
    eyebrow: shelfCopy.eyebrow,
    all: copy.all,
  };
}

function landingShelfEmptyCopy(lang: SiteLang, kind: LandingTopShelfKind): { title: string; body: string; href: string } {
  const localized: Record<SiteLang, Record<LandingTopShelfKind, { title: string; body: string; href: string }>> = {
    ja: {
      today: { title: "最初の発見を残す", body: "名前が分からなくても、写真や動画から始められます。", href: "/record" },
      photo: { title: "写真や動画で始める", body: "形、動き、声をあとから見返せる記録にします。", href: "/record?start=gallery" },
      video: { title: "動きや声を残す", body: "短い動画なら、動き・鳴き声・周りの様子まで残せます。", href: "/record?start=video" },
      guide: { title: "ガイドから歩く", body: "季節と場所の見どころから、次に見るものを選べます。", href: "/guide" },
      scan: { title: "現地の手がかりを束ねる", body: "写真、音、場所の情報をまとめて残せます。", href: "/lens" },
      needsId: { title: "名前が分からなくても大丈夫", body: "AI候補とみんなの確認で、あとから記録が育ちます。", href: "/record" },
    },
    en: {
      today: { title: "Make the first find", body: "A photo or short video is enough before you know the name.", href: "/record" },
      photo: { title: "Start with media", body: "Keep shape, motion, and sound so you can revisit the record later.", href: "/record?start=gallery" },
      video: { title: "Keep motion and calls", body: "Short videos can hold behavior, voice, and the surrounding scene.", href: "/record?start=video" },
      guide: { title: "Walk from a guide", body: "Use season and place prompts when you want something to notice.", href: "/guide" },
      scan: { title: "Bundle field clues", body: "Keep photo, sound, and place clues together for later review.", href: "/lens" },
      needsId: { title: "Names can come later", body: "AI hints and community checks can help the record grow after posting.", href: "/record" },
    },
    es: {
      today: { title: "Haz el primer hallazgo", body: "Una foto o video corto basta antes de saber el nombre.", href: "/record" },
      photo: { title: "Empieza con medios", body: "Guarda forma, movimiento y sonido para volver al registro despues.", href: "/record?start=gallery" },
      video: { title: "Guarda movimiento y cantos", body: "Videos cortos conservan conducta, voz y el lugar alrededor.", href: "/record?start=video" },
      guide: { title: "Camina con una guia", body: "Usa pistas de temporada y lugar cuando quieras notar algo.", href: "/guide" },
      scan: { title: "Une pistas del lugar", body: "Guarda foto, sonido y lugar juntos para revisar despues.", href: "/lens" },
      needsId: { title: "El nombre puede venir despues", body: "La IA y la comunidad pueden ayudar tras publicar.", href: "/record" },
    },
    "pt-BR": {
      today: { title: "Faca a primeira descoberta", body: "Uma foto ou video curto basta antes de saber o nome.", href: "/record" },
      photo: { title: "Comece com midia", body: "Guarde forma, movimento e som para rever o registro depois.", href: "/record?start=gallery" },
      video: { title: "Guarde movimento e cantos", body: "Videos curtos mantem comportamento, voz e o ambiente ao redor.", href: "/record?start=video" },
      guide: { title: "Caminhe com um guia", body: "Use pistas de estacao e lugar quando quiser notar algo.", href: "/guide" },
      scan: { title: "Junte pistas do local", body: "Guarde foto, som e lugar juntos para revisar depois.", href: "/lens" },
      needsId: { title: "O nome pode vir depois", body: "Dicas de IA e revisao da comunidade ajudam apos publicar.", href: "/record" },
    },
  };
  return localized[lang]?.[kind] ?? localized.ja[kind];
}

function fallbackLandingShelves(snapshot: LandingSnapshot): LandingTopShelf[] {
  const observations = uniqueLandingObservations(snapshot);
  const videoItems = observations.filter((obs) => Boolean(obs.hasVideo) || obs.librarySourceKind === "video").slice(0, 4);
  const evidenceShelf = {
    kind: "photo" as const,
    title: "写真と動画",
    eyebrow: "MEDIA",
    href: "/records?view=media",
    items: Array.from(new Map([
      ...observations.filter((obs) => Boolean(obs.photoUrl)).slice(0, 6),
      ...videoItems,
    ].map((obs) => [obs.occurrenceId, obs])).values()).slice(0, 6),
  };
  const shelves: LandingTopShelf[] = [
    {
      kind: "today",
      title: "みんなの発見",
      eyebrow: "LIVE FEED",
      href: "/records?view=public",
      items: observations.slice(0, 8),
    },
    evidenceShelf,
  ];
  shelves.push(
    {
      kind: "guide",
      title: "ガイドで見つけたこと",
      eyebrow: "GUIDE",
      href: "/guide",
      items: observations.filter((obs) => obs.librarySourceKind === "guide").slice(0, 4),
      cta: { title: "観察ガイドから歩く", body: "場所や季節に合わせた見どころをたどれます。", href: "/guide", actionLabel: "ガイドを見る" },
    },
    {
      kind: "scan",
      title: "スキャンから見えたもの",
      eyebrow: "SCAN",
      href: "/lens",
      items: observations.filter((obs) => obs.librarySourceKind === "scan").slice(0, 4),
      cta: { title: "現地をスキャンする", body: "写真、音、場所の手がかりを束ねます。", href: "/lens", actionLabel: "スキャンを始める" },
    },
    {
      kind: "needsId",
      title: "名前を待つ記録",
      eyebrow: "IDENTIFY",
      href: "/records?view=needs_id",
      items: observations.filter((obs) => obs.identificationCount === 0 || obs.isAiCandidate).slice(0, 6),
    },
  );
  return shelves;
}

function renderLandingShelf(options: LandingTopRenderOptions, shelf: LandingTopShelf, index: number): string {
  const { basePath, lang, copy } = options;
  const shelfCopy = landingShelfUiCopy(lang, shelf);
  const itemsHtml = shelf.items.map((obs, itemIndex) =>
    renderTopAObservationCard(basePath, lang, copy, obs, itemIndex, landingShelfCardKpi(shelf.kind), shelf.kind),
  ).join("");
  const ctaHtml = shelf.cta && (shelf.kind === "video" || shelf.items.length < Math.min(2, 4))
    ? renderLandingShelfCta(basePath, lang, shelf)
    : "";
  const emptyCopy = landingShelfEmptyCopy(lang, shelf.kind);
  const emptyHtml = !itemsHtml && !ctaHtml
    ? renderTopAEmptyCard(basePath, lang, emptyCopy.title, emptyCopy.body, emptyCopy.href, `landing:topA:shelf:${shelf.kind}:empty`)
    : "";
  return `<div class="prototype-topa-shelf prototype-topa-shelf-${escapeHtml(shelf.kind)}" id="topa-${escapeHtml(shelf.kind)}">
    <div class="prototype-topa-shelf-head">
      <div>
        <small>${escapeHtml(shelfCopy.eyebrow)}</small>
        <h2>${escapeHtml(shelfCopy.title)}</h2>
      </div>
      <a href="${escapeHtml(landingHref(basePath, lang, shelf.href))}" data-kpi-action="landing:topA:shelf:${escapeHtml(shelf.kind)}:all">${escapeHtml(shelfCopy.all)}</a>
    </div>
    <div class="prototype-topa-card-grid${index === 0 ? " is-primary" : ""}">${itemsHtml}${ctaHtml}${emptyHtml}</div>
  </div>`;
}

function renderObservationThumb(obs: LandingObservation, copy: LandingStrings, preset: ThumbnailPreset, eager = false): string {
  const imageUrl = observationImageUrl(obs, preset);
  if (!imageUrl) {
    return `<span class="prototype-feed-thumb is-empty" aria-hidden="true">ID</span>`;
  }
  return `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(displayObservationName(obs, copy.heroPhotoFallback))}" loading="${eager ? "eager" : "lazy"}" decoding="async" />`;
}

function renderObservationEvidenceCard(
  basePath: string,
  lang: SiteLang,
  copy: LandingStrings,
  obs: LandingObservation,
  kpiAction: string | null,
  size: "large" | "small",
): string {
  const href = observationDetailHref(basePath, lang, obs);
  const kpiAttr = kpiAction ? ` data-kpi-action="${escapeHtml(kpiAction)}"` : "";
  return `<a class="prototype-evidence-card prototype-evidence-${size}" href="${escapeHtml(href)}"${kpiAttr}>
    <small>${escapeHtml(landingObservationMeta(lang, obs) || copy.heroLatestLabel)}</small>
    <strong>${escapeHtml(displayObservationName(obs, copy.heroPhotoFallback))}</strong>
    <p>写真なしの観察です。場所、日時、同定状態を手がかりに詳細を確認できます。</p>
    <span>${obs.identificationCount > 0 ? `${escapeHtml(formatLandingNumber(copy, obs.identificationCount))}件の同定` : "同定待ち"}</span>
  </a>`;
}

function renderPhotoTile(
  basePath: string,
  lang: SiteLang,
  copy: LandingStrings,
  obs: LandingObservation,
  index: number,
  size: "large" | "small",
  fallbackTitle: string,
  fallbackLabel: string,
  kpiAction: string | null,
): string {
  const imageUrl = observationImageUrl(obs, size === "large" ? "original" : "md");
  if (!imageUrl) return renderObservationEvidenceCard(basePath, lang, copy, obs, kpiAction, size);
  const href = observationDetailHref(basePath, lang, obs);
  const title = displayObservationName(obs, fallbackTitle);
  const label = landingObservationMeta(lang, obs) || fallbackLabel;
  const kpiAttr = kpiAction ? ` data-kpi-action="${escapeHtml(kpiAction)}"` : "";
  return `<a class="prototype-photo prototype-photo-${size}" href="${escapeHtml(href)}"${kpiAttr}>
    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" loading="${index === 0 ? "eager" : "lazy"}" decoding="async" />
    <span><small>${escapeHtml(label)}</small><strong>${escapeHtml(title)}</strong></span>
  </a>`;
}

function renderEmptyDailyState(basePath: string, lang: SiteLang, copy: LandingStrings): string {
  return `<div class="prototype-daily-empty" role="status">
    <small>${escapeHtml(copy.heroPhotoFallback)}</small>
    <strong>まだ公開できる観察がありません</strong>
    <p>トップではダミー写真を使いません。最初の記録が入るまでは、記録開始・地図・読み物への入口だけを表示します。</p>
    <div class="prototype-empty-actions">
      <a class="prototype-btn prototype-btn-primary" href="${escapeHtml(landingHref(basePath, lang, "/record"))}" data-kpi-action="landing:daily:card:recordToday">${escapeHtml(copy.actionPrimaryGuest)}</a>
      <a class="prototype-btn prototype-btn-secondary" href="${escapeHtml(landingHref(basePath, lang, "/map"))}" data-kpi-action="landing:daily:card:nearbyPulse">${escapeHtml(copy.actionSecondary)}</a>
      <a class="prototype-btn prototype-btn-secondary" href="${escapeHtml(landingHref(basePath, lang, "/learn"))}" data-kpi-action="landing:linkband:learn">読み物を見る</a>
    </div>
  </div>`;
}

function renderLandingHeroHtml(options: LandingTopRenderOptions): string {
  void options;
  return "";
}

function renderLandingDailyDashboard(options: LandingTopRenderOptions): string {
  return `<section class="prototype-topa-shelves" aria-label="トップページの観察棚">
    ${renderLandingContentWall(options)}
    ${renderLandingNearbySection(options)}
    ${renderLandingGuideOutcomes(options)}
    ${renderLandingLocalFollowups(options)}
  </section>`;
}

function renderSoundIntelligenceSection(basePath: string, lang: SiteLang): string {
  const stages = [
    {
      label: "Collect",
      title: "自然音だけを短く残す",
      body: "ライブガイドや定点レコーダーの音は、人声らしい部分を避け、時刻・場所・端末条件と一緒に記録候補へ入ります。",
    },
    {
      label: "Sort",
      title: "似た音を束ねて仕訳する",
      body: "音声 segment は bundle と cluster にまとまり、鳥・虫・水音・未知音のように、素人にも見返しやすい棚へ寄せます。",
    },
    {
      label: "Review",
      title: "AI候補を人が確かめる",
      body: "BirdNET-Go や Perch v2 由来の候補は確定名にせず、代表音、確信度、モデル情報、レビュー状態を分けて扱います。",
    },
    {
      label: "Research",
      title: "研究で読める形にする",
      body: "BioMonWeek 的な観測手法、sampling effort、公開範囲、Evidence Tier をそろえ、研究者が再利用条件を判断できます。",
    },
  ];
  return `<section class="prototype-sound-os" id="sound-intelligence" aria-labelledby="prototype-sound-heading">
    <div class="prototype-sound-copy">
      <small>音の標本棚</small>
      <h2 id="prototype-sound-heading">鳴き声と環境音を、楽しい記録から研究データへ。</h2>
      <p>写真や動画だけでは残らない「その場の音」を、短い自然音、似た音のまとまり、レビュー待ち、研究利用候補に分けて扱います。ユーザーには発見として戻し、研究者には条件つきデータとして渡せる設計です。</p>
      <div class="prototype-sound-actions">
        <a class="prototype-btn prototype-btn-primary" href="${escapeHtml(landingHref(basePath, lang, "/guide"))}" data-kpi-action="landing:sound:guide">音で歩く</a>
        <a class="prototype-btn prototype-btn-secondary" href="${escapeHtml(landingHref(basePath, lang, "/learn/technology"))}" data-kpi-action="landing:sound:technology">音声処理を見る</a>
        <a class="prototype-btn prototype-btn-secondary" href="${escapeHtml(landingHref(basePath, lang, "/for-researcher/apply"))}" data-kpi-action="landing:sound:research">研究利用へ</a>
      </div>
    </div>
    <div class="prototype-sound-flow" aria-label="音声データの流れ">
      ${stages.map((stage, index) => `<article>
        <span>${index + 1}</span>
        <i>${escapeHtml(stage.label)}</i>
        <h3>${escapeHtml(stage.title)}</h3>
        <p>${escapeHtml(stage.body)}</p>
      </article>`).join("")}
    </div>
  </section>`;
}

function renderLinkBand(basePath: string, lang: SiteLang): string {
  return `<aside class="prototype-link-band" aria-label="既存ページへの導線">
    <i>READ</i>
    <div>
      <strong>はじめてなら、Enjoy Life の考え方から読めます。</strong>
      <span>読み物、よくある質問、更新情報、企業・研究向けページへつながります。</span>
    </div>
    <a class="prototype-btn prototype-btn-secondary" href="${escapeHtml(landingHref(basePath, lang, "/learn"))}" data-kpi-action="landing:linkband:learn">読み物を見る</a>
  </aside>`;
}

function renderFlowSection(fieldLoop: FieldLoopStrings): string {
  return `<section class="prototype-section" aria-labelledby="prototype-flow-heading">
    <div class="prototype-section-head">
      <div>
        <div class="prototype-eyebrow">${escapeHtml(fieldLoop.eyebrow)}</div>
        <h2 id="prototype-flow-heading">${escapeHtml(fieldLoop.title)}</h2>
      </div>
      <p>${escapeHtml(fieldLoop.lead)}</p>
    </div>
    <div class="prototype-flow-grid">
      ${fieldLoop.steps.slice(0, 3).map((step, index) => `<article class="prototype-flow-card">
        <div class="prototype-flow-body">
          <i>${escapeHtml(["REC", "MAP", "ID"][index] ?? "GO")}</i>
          <h3>${escapeHtml(step.title.replace(/^\d+\.\s*/, ""))}</h3>
          <p>${escapeHtml(step.body)}</p>
        </div>
        <div class="prototype-flow-num">${String(index + 1).padStart(2, "0")}</div>
      </article>`).join("")}
    </div>
  </section>`;
}

function renderMapSection(options: LandingTopRenderOptions): string {
  const { basePath, lang, copy, snapshot } = options;
  const mapHref = landingHref(basePath, lang, "/map");
  const mapCells = toMapMiniCells(snapshot.mapPreviewCells, mapHref);

  return `<section class="prototype-map-section" id="map" aria-labelledby="prototype-map-heading">
    <div class="prototype-map-copy">
      <div class="prototype-map-step"><b>04</b><span class="prototype-eyebrow">${escapeHtml(copy.mapSectionEyebrow)}</span></div>
      <h2 id="prototype-map-heading">${escapeHtml(copy.mapSectionTitle)}</h2>
      <p>${escapeHtml(copy.mapSectionLead)}</p>
      <div class="prototype-map-points">
        <a href="${escapeHtml(landingHref(basePath, lang, "/map"))}" data-kpi-action="landing:map:open"><i>RT</i><span><strong>また同じ場所へ行く</strong><small>季節や個体数の変化を残す</small></span></a>
        <a href="${escapeHtml(landingHref(basePath, lang, "/records?view=places"))}"><i>LY</i><span><strong>場所ごとの発見を重ねる</strong><small>水辺、林、街路樹を比較できる</small></span></a>
        <a href="${escapeHtml(landingHref(basePath, lang, "/record"))}"><i>NX</i><span><strong>次の観察地点を見つける</strong><small>多い場所と少ない場所を見返せる</small></span></a>
      </div>
    </div>
    <div class="prototype-map-board">
      ${renderMapMini({
        cells: mapCells,
        mapHref,
        mapCtaLabel: copy.mapCta,
        mapCtaKpiAction: "landing:map:open",
        emptyLabel: copy.mapEmpty,
        height: 420,
      })}
    </div>
  </section>`;
}

function renderLibrarySection(basePath: string, lang: SiteLang): string {
  return `<section class="prototype-section" id="learn" aria-labelledby="prototype-learn-heading">
    <div class="prototype-section-head">
      <div>
        <div class="prototype-eyebrow">読み物と案内</div>
        <h2 id="prototype-learn-heading">迷った時に、すぐ深められる。</h2>
      </div>
      <p>観察の楽しみ方、記録の残し方、地域や企業で活かす前提をまとめています。迷ったときに、すぐ次の一歩へ戻れます。</p>
    </div>
    <div class="prototype-library-grid">
      <a class="prototype-library-card" href="${escapeHtml(landingHref(basePath, lang, "/learn"))}" data-kpi-action="landing:library:learn"><i>BK</i><h3>観察の始め方</h3><p>Enjoy Life の考え方、観察の流れ、用語、信頼性をまとめて読める入口。</p><span>読み物へ</span></a>
      <a class="prototype-library-card" href="${escapeHtml(landingHref(basePath, lang, "/learn/identification-basics"))}" data-kpi-action="landing:library:identification"><i>ID</i><h3>名前を確かめる基本</h3><p>名前の候補、似た種類、根拠の残し方を、はじめての人にも分かる形で案内する。</p><span>名前の調べ方へ</span></a>
      <a class="prototype-library-card" href="${escapeHtml(landingHref(basePath, lang, "/faq"))}" data-kpi-action="landing:library:faq"><i>QA</i><h3>よくある質問</h3><p>記録、公開範囲、位置情報、名前の確認、研究利用で迷いやすい点を先回りして解消する。</p><span>質問を見る</span></a>
      <a class="prototype-library-card" href="${escapeHtml(landingHref(basePath, lang, "/learn/updates"))}" data-kpi-action="landing:library:updates"><i>UP</i><h3>更新情報</h3><p>機能追加、見せ方の改善、公開範囲の変更など、サービスの変化を追える場所。</p><span>更新を見る</span></a>
    </div>
  </section>`;
}

function renderTrustSection(): string {
  return `<section class="prototype-section" aria-labelledby="prototype-trust-heading">
    <div class="prototype-section-head">
      <div>
        <div class="prototype-eyebrow">信頼と安全</div>
        <h2 id="prototype-trust-heading">自然も人も、守れる公開へ。</h2>
      </div>
      <p>地域のいのちの記録は、残すほど価値が出る。一方で、希少種や個人の行動履歴は扱いを間違えると危険になる。公開範囲は安全側で設計する。</p>
    </div>
    <div class="prototype-trust-grid">
      <article><i>SAFE</i><h3>希少種の位置をぼかす</h3><p>保護上配慮が必要な生きものは、詳しい位置をそのまま公開しない。発見の喜びと保全を両立する。</p></article>
      <article><i>PROOF</i><h3>名前の根拠を残す</h3><p>誰が、どの根拠で、どの程度の確信を持って名前を提案したかを分けて扱う。</p></article>
      <article><i>DATA</i><h3>研究やレポートに使いやすくする</h3><p>観察、場所、時刻、証拠写真を整理し、あとから地域調査、教育活動、企業レポートで参照しやすくする。</p></article>
    </div>
  </section>`;
}

function renderCommunitySection(basePath: string, lang: SiteLang): string {
  return `<section class="prototype-community" aria-labelledby="prototype-community-heading">
    <div>
      <div class="prototype-eyebrow">地域・企業で使う</div>
      <h2 id="prototype-community-heading">個人の発見を、地域のアクションへ。</h2>
      <p>ikimon.life は、記録を集めるだけの場所ではなく、地域の自然を見つけ、確かめ、残し、また歩くための基盤。個人、学校、研究者、自治体、企業が同じ記録を別の視点で参照しやすくする。</p>
      <div class="prototype-actions">
        <a class="prototype-btn prototype-btn-primary" href="${escapeHtml(landingHref(basePath, lang, "/community"))}" data-kpi-action="landing:community:community">みんなで観察する</a>
        <a class="prototype-btn prototype-btn-secondary" href="${escapeHtml(landingHref(basePath, lang, "/for-business"))}" data-kpi-action="landing:community:business">企業で活用する</a>
      </div>
    </div>
    <div class="prototype-use-grid">
      <article><strong>個人の図鑑</strong><span>自分が見つけた生きものを、場所と季節で見返す。</span></article>
      <article><strong>学校の観察</strong><span>校区や遠足先で見つけた自然を、授業後も残す。</span></article>
      <article><strong>研究の入口</strong><span>市民の記録を、地域調査の手がかりにする。</span></article>
      <article><strong>企業・地域の活動</strong><span>観察データを、レポートや次のアクションへつなげる。</span></article>
    </div>
  </section>`;
}

function renderFinalCta(basePath: string, lang: SiteLang): string {
  return `<section class="prototype-cta">
    <div>
      <h2>今日の発見を、地域の記録に。</h2>
      <p>特別な調査ではなく、いつもの道で見つけた生きものから。名前が分からなくても、記録はあとから育てられる。</p>
    </div>
    <a class="prototype-btn prototype-btn-dark" href="${escapeHtml(landingHref(basePath, lang, "/record"))}" data-kpi-action="landing:cta:record">記録する</a>
  </section>`;
}

export function renderLandingTopSections(options: LandingTopRenderOptions): LandingTopSections {
  return {
    heroHtml: renderLandingHeroHtml(options),
    dailyDashboardHtml: renderLandingDailyDashboard(options),
    linkBandHtml: "",
    flowSectionHtml: "",
    mapSectionHtml: "",
    librarySectionHtml: "",
    trustSectionHtml: "",
    communitySectionHtml: "",
    finalCtaHtml: "",
  };
}

export const LANDING_TOP_STYLES = `
  body {
    background:
      linear-gradient(90deg, rgba(16,185,129,.038) 1px, transparent 1px),
      linear-gradient(0deg, rgba(14,165,233,.032) 1px, transparent 1px),
      linear-gradient(180deg, #ffffff 0%, #f9fffe 48%, #f2fbf7 100%);
    background-size: 56px 56px, 56px 56px, auto;
  }
  .site-header { background: rgba(255,255,255,.84); border-bottom-color: rgba(26,46,31,.08); }
  .site-header-inner { min-height: 58px; }
  .shell.shell-bleed.prototype-shell {
    --ikimon-landing-sidebar-w: var(--ikimon-desktop-sidebar-w, 0px);
    --ikimon-landing-available-w: calc(100vw - var(--ikimon-landing-sidebar-w));
    --ikimon-landing-effective-w: min(var(--ikimon-page-max), calc(var(--ikimon-landing-available-w) - max(var(--ikimon-page-inline), 32px)));
    --ikimon-landing-side-space: max(16px, calc((var(--ikimon-landing-available-w) - var(--ikimon-landing-effective-w)) / 2));
    width: var(--ikimon-landing-effective-w);
    max-width: none;
    margin-left: calc(var(--ikimon-landing-sidebar-w) + var(--ikimon-landing-side-space));
    margin-right: var(--ikimon-landing-side-space);
    padding-top: clamp(18px, 3vw, 38px);
    color: #1a2e1f;
  }
  .prototype-btn {
    min-height: 52px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 12px 18px;
    border-radius: 999px;
    border: 1px solid transparent;
    font-size: 14px;
    font-weight: 900;
    white-space: nowrap;
  }
  .prototype-btn-primary { background: linear-gradient(135deg, #10b981, #059669); color: #fff; box-shadow: 0 18px 44px rgba(16,185,129,.18); }
  .prototype-btn-secondary { background: rgba(255,255,255,.78); color: #1a2e1f; border-color: rgba(16,185,129,.28); }
  .prototype-btn-dark { background: #10251a; color: #fff; box-shadow: 0 18px 44px rgba(16,37,26,.18); }
  .prototype-topa {
    padding: clamp(10px, 2vw, 22px) 0 10px;
    display: grid;
    gap: 10px;
  }
  .prototype-topa-intro {
    display: grid;
    gap: 8px;
    max-width: none;
  }
  .prototype-topa h1 {
    margin: 0;
    color: #10251a;
    max-width: 18em;
    font-size: clamp(32px, 3.35vw, 54px);
    line-height: 1.08;
    letter-spacing: 0;
    font-weight: 950;
    white-space: normal;
  }
  .prototype-topa p {
    margin: 0;
    max-width: 58em;
    color: #475569;
    font-size: clamp(15px, 1.35vw, 18px);
    line-height: 1.65;
    font-weight: 680;
  }
  .prototype-topa-story {
    display: grid;
    grid-template-columns: 112px minmax(0, 1fr) auto;
    gap: 14px;
    align-items: center;
    padding: 12px;
    border: 1px solid rgba(16,185,129,.18);
    border-radius: 16px;
    background:
      linear-gradient(135deg, rgba(240,253,244,.96), rgba(255,255,255,.94)),
      #fff;
    box-shadow: 0 18px 46px rgba(15,23,42,.08);
  }
  .prototype-topa-story-media {
    width: 112px;
    aspect-ratio: 1 / 1;
    display: grid;
    place-items: center;
    overflow: hidden;
    border-radius: 14px;
    background: #10251a;
    color: #fff;
    text-decoration: none;
    font-weight: 950;
  }
  .prototype-topa-story-media img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .prototype-topa-story-copy {
    min-width: 0;
    display: grid;
    gap: 5px;
  }
  .prototype-topa-story-copy small {
    color: #047857;
    font-size: 12px;
    font-weight: 950;
  }
  .prototype-topa-story-copy h2 {
    margin: 0;
    color: #10251a;
    font-size: clamp(21px, 2.1vw, 30px);
    line-height: 1.18;
    letter-spacing: 0;
    font-weight: 950;
  }
  .prototype-topa-story-copy h2 span {
    display: block;
    color: #64748b;
    font-size: 13px;
    line-height: 1.25;
  }
  .prototype-topa-story-copy p {
    max-width: 44em;
    font-size: 14px;
  }
  .prototype-topa-story-copy em {
    color: #64748b;
    font-size: 12px;
    font-style: normal;
    font-weight: 800;
  }
  .prototype-topa-story-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 4px;
  }
  .prototype-topa-story-actions a {
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 13px;
    border-radius: 999px;
    background: #fff;
    border: 1px solid rgba(16,185,129,.22);
    color: #10251a;
    text-decoration: none;
    font-size: 13px;
    font-weight: 950;
  }
  .prototype-topa-story-actions a.is-primary {
    background: #047857;
    border-color: #047857;
    color: #fff;
  }
  .prototype-topa-story-stats {
    display: flex;
    gap: 8px;
  }
  .prototype-topa-story-stats span {
    min-width: 78px;
    display: grid;
    gap: 2px;
    padding: 10px;
    border-radius: 14px;
    background: rgba(255,255,255,.72);
    color: #64748b;
    font-size: 11px;
    font-weight: 850;
  }
  .prototype-topa-story-stats strong {
    color: #10251a;
    font-size: 21px;
    line-height: 1;
    font-weight: 950;
  }
  .prototype-topa-search {
    min-height: 54px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    padding: 8px 10px 8px 16px;
    border: 1px solid rgba(16,185,129,.18);
    border-radius: 999px;
    background: #fff;
    box-shadow: 0 16px 42px rgba(15,23,42,.075);
  }
  .prototype-topa-search input {
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: #10251a;
    font-size: 15px;
    font-weight: 720;
  }
  .prototype-topa-search input::placeholder { color: #64748b; }
  .prototype-topa-search button {
    min-height: 40px;
    padding: 0 16px;
    border: 0;
    border-radius: 999px;
    background: #047857;
    color: #fff;
    font-size: 15px;
    font-weight: 900;
  }
  .prototype-topa-actions {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: none;
  }
  .prototype-topa-actions::-webkit-scrollbar {
    display: none;
  }
  .prototype-topa-action {
    min-height: 56px;
    flex: 0 0 auto;
    display: grid;
    grid-template-columns: 30px max-content;
    align-items: center;
    gap: 8px;
    padding: 8px 14px 8px 9px;
    border: 1px solid rgba(16,185,129,.16);
    border-radius: 999px;
    background: #fff;
    box-shadow: 0 12px 26px rgba(15,23,42,.06);
    text-align: left;
  }
  .prototype-topa-action.is-primary {
    border-color: #10251a;
    background: #10251a;
    color: #fff;
    box-shadow: 0 16px 38px rgba(16,37,26,.16);
  }
  .prototype-topa-action-icon {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: #e7f5ef;
    color: #047857;
    font-size: 12px;
    line-height: 1;
    font-weight: 950;
  }
  .prototype-topa-action.is-primary .prototype-topa-action-icon {
    background: rgba(255,255,255,.14);
    color: #fff;
  }
  .prototype-topa-action strong {
    color: #10251a;
    font-size: 15px;
    line-height: 1.35;
    font-weight: 950;
  }
  .prototype-topa-action.is-primary strong {
    color: #fff;
  }
  .prototype-topa-action small {
    min-width: 0;
    color: #64748b;
    font-size: 13px;
    line-height: 1.48;
    font-weight: 720;
    display: none;
  }
  .prototype-topa-action.is-primary small {
    color: rgba(255,255,255,.76);
  }
  .prototype-topa-action em {
    width: fit-content;
    min-height: 24px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 7px;
    border-radius: 999px;
    background: rgba(16,185,129,.1);
    color: #047857;
    font-size: 11px;
    line-height: 1.2;
    font-style: normal;
    font-weight: 900;
  }
  .prototype-topa-action em strong {
    font-size: 15px;
    line-height: 1;
  }
  .prototype-topa-trust {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .prototype-topa-trust span {
    min-height: 76px;
    display: grid;
    align-content: start;
    gap: 4px;
    padding: 12px 14px;
    border: 1px solid rgba(16,185,129,.14);
    border-radius: 8px;
    background: rgba(255,255,255,.74);
    box-shadow: 0 10px 28px rgba(15,23,42,.045);
  }
  .prototype-topa-trust strong {
    color: #10251a;
    font-size: 14px;
    line-height: 1.35;
    font-weight: 950;
  }
  .prototype-topa-trust small {
    color: #64748b;
    font-size: 12px;
    line-height: 1.55;
    font-weight: 720;
  }
  .prototype-topa-metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .prototype-topa-metrics span {
    min-height: 34px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 6px;
    padding: 4px 10px;
    border: 1px solid rgba(16,185,129,.14);
    border-radius: 8px;
    background: rgba(255,255,255,.82);
    color: #475569;
    font-size: 12px;
    font-weight: 850;
    box-shadow: none;
  }
  .prototype-topa-metrics strong {
    color: #10251a;
    font-size: 16px;
    line-height: 1;
    font-weight: 950;
  }
  .prototype-topa-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .prototype-topa-tabs a {
    min-height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 16px;
    border: 1px solid rgba(16,185,129,.18);
    border-radius: 999px;
    background: #fff;
    color: #10251a;
    font-size: 15px;
    font-weight: 900;
  }
  .prototype-topa-tabs a:first-child {
    background: #10251a;
    color: #fff;
    border-color: #10251a;
  }
  .prototype-content-wall {
    display: grid;
    gap: 18px;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }
  .prototype-content-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(176px, 1fr));
    gap: 18px 14px;
  }
  .prototype-content-lanes {
    display: grid;
    gap: 28px;
  }
  .prototype-content-lanes.is-split {
    grid-template-columns: 1fr;
    align-items: start;
  }
  .prototype-content-lane {
    min-width: 0;
    display: grid;
    gap: 14px;
  }
  .prototype-content-lane + .prototype-content-lane {
    padding-top: 22px;
    border-top: 1px solid rgba(15,23,42,.08);
  }
  .prototype-content-lane-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-block: 0 2px;
  }
  .prototype-content-lane-title {
    min-width: 0;
    display: grid;
    gap: 3px;
  }
  .prototype-content-lane-title span {
    min-width: 0;
    color: #0f766e;
    font-size: 10px;
    line-height: 1;
    font-weight: 950;
    letter-spacing: 0;
  }
  .prototype-content-lane.is-community .prototype-content-lane-title span {
    color: #0369a1;
  }
  .prototype-content-lane-head h3 {
    margin: 0;
    color: #10251a;
    font-size: 19px;
    line-height: 1.25;
    letter-spacing: 0;
    font-weight: 950;
  }
  .prototype-content-lane-more {
    min-height: 32px;
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 0 2px;
    border-radius: 0;
    background: transparent;
    border: 0;
    color: #0f766e;
    font-size: 12px;
    line-height: 1;
    font-weight: 950;
    box-shadow: none;
  }
  .prototype-content-lane-more::after {
    content: "";
    width: 11px;
    height: 11px;
    display: block;
    background: currentColor;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M13.3 5.3 20 12l-6.7 6.7-1.4-1.4 4.3-4.3H4v-2h12.2l-4.3-4.3 1.4-1.4Z'/%3E%3C/svg%3E") center / contain no-repeat;
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M13.3 5.3 20 12l-6.7 6.7-1.4-1.4 4.3-4.3H4v-2h12.2l-4.3-4.3 1.4-1.4Z'/%3E%3C/svg%3E") center / contain no-repeat;
  }
  .prototype-content-lane-more:hover {
    color: #047857;
    text-decoration: underline;
    text-underline-offset: 4px;
  }
  .prototype-content-card {
    min-width: 0;
    display: grid;
    gap: 9px;
    color: inherit;
    text-decoration: none;
  }
  .prototype-content-thumb {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 5;
    display: grid;
    place-items: center;
    overflow: hidden;
    border: 1px solid rgba(15,23,42,.08);
    border-radius: 8px;
    background:
      linear-gradient(90deg, rgba(16,185,129,.1) 1px, transparent 1px),
      linear-gradient(0deg, rgba(14,165,233,.08) 1px, transparent 1px),
      #f8fffc;
    background-size: 22px 22px, 22px 22px, auto;
    box-shadow: 0 10px 24px rgba(15,23,42,.07);
  }
  .prototype-content-thumb img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    object-position: center;
    transition: transform .18s ease;
  }
  .prototype-content-card:hover .prototype-content-thumb img {
    transform: scale(1.025);
  }
  .prototype-content-empty-thumb {
    width: 38px;
    height: 38px;
    border-radius: 999px;
    background: #e7f5ef;
    color: #047857;
    font-size: 14px;
    font-weight: 950;
  }
  .prototype-content-icon-row {
    position: absolute;
    left: 8px;
    top: 8px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .prototype-content-icon {
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
  .prototype-content-icon::before {
    content: "";
    width: 13px;
    height: 13px;
    display: block;
    background: currentColor;
    mask: var(--prototype-content-icon-mask) center / contain no-repeat;
    -webkit-mask: var(--prototype-content-icon-mask) center / contain no-repeat;
  }
  .prototype-content-icon.is-image { --prototype-content-icon-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M5 5h14v14H5V5Zm2 2v8.6l3.2-3.2 2.6 2.6 1.7-1.7L17 15.8V7H7Zm2.5 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z'/%3E%3C/svg%3E"); }
  .prototype-content-icon.is-video { --prototype-content-icon-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M4 6h11v12H4V6Zm13 4.2 4-2.4v8.4l-4-2.4v-3.6Z'/%3E%3C/svg%3E"); }
  .prototype-content-icon.is-id { --prototype-content-icon-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M4 5h16v14H4V5Zm3 3v2h10V8H7Zm0 4v2h6v-2H7Z'/%3E%3C/svg%3E"); }
  .prototype-content-icon.is-record { --prototype-content-icon-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm1 5v3h3v2h-3v3h-2v-3H8v-2h3V8h2Z'/%3E%3C/svg%3E"); }
  .prototype-content-body {
    min-width: 0;
    display: grid;
    gap: 7px;
  }
  .prototype-content-title-line {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .prototype-content-title-line > strong {
    min-width: 0;
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #10251a;
    font-size: 15px;
    line-height: 1.38;
    font-weight: 950;
  }
  .prototype-content-subjects {
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
  .prototype-content-subjects span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .prototype-content-subjects em {
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
  .prototype-content-author {
    min-width: 0;
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr) auto;
    gap: 6px;
    align-items: center;
  }
  .prototype-content-avatar {
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    overflow: hidden;
    border-radius: 999px;
    background: linear-gradient(135deg,#d1fae5,#bae6fd);
    color: #065f46;
  }
  .prototype-content-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .prototype-content-avatar-symbol {
    width: 11px;
    height: 11px;
    display: block;
    background: currentColor;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z'/%3E%3C/svg%3E") center / contain no-repeat;
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z'/%3E%3C/svg%3E") center / contain no-repeat;
  }
  .prototype-content-author-copy {
    min-width: 0;
    display: contents;
  }
  .prototype-content-author-copy em {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #334155;
    font-size: 12px;
    line-height: 1.25;
    font-style: normal;
    font-weight: 900;
  }
  .prototype-content-author-copy small {
    min-width: 0;
    justify-self: end;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #64748b;
    font-size: 10px;
    line-height: 1.25;
    font-weight: 850;
    text-align: right;
  }
  .prototype-content-empty {
    min-height: 160px;
    display: grid;
    align-content: center;
    gap: 7px;
    padding: 14px;
    border: 1px dashed rgba(15,23,42,.16);
    border-radius: 8px;
    background: rgba(248,250,252,.88);
  }
  .prototype-content-empty strong {
    color: #10251a;
    font-size: 15px;
    line-height: 1.35;
    font-weight: 950;
  }
  .prototype-content-empty span {
    color: #64748b;
    font-size: 13px;
    line-height: 1.55;
    font-weight: 720;
  }
  .prototype-content-empty em {
    width: fit-content;
    color: #047857;
    font-size: 12px;
    line-height: 1.25;
    font-style: normal;
    font-weight: 950;
  }
  .prototype-topa-shelves {
    display: grid;
    gap: 18px;
    padding: 4px 0 clamp(26px, 4vw, 46px);
  }
  .prototype-topa-board {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(280px, 340px);
    gap: 14px;
    align-items: start;
  }
  .prototype-topa-shelf {
    display: grid;
    gap: 12px;
    scroll-margin-top: 92px;
  }
  .prototype-topa-shelf-head {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 12px;
  }
  .prototype-topa-shelf-head h2 {
    margin: 0;
    color: #10251a;
    font-size: clamp(22px, 2.4vw, 32px);
    line-height: 1.25;
    font-weight: 950;
  }
  .prototype-topa-shelf-head small {
    display: block;
    margin-bottom: 4px;
    color: #047857;
    font-size: 12px;
    line-height: 1.2;
    font-weight: 950;
  }
  .prototype-topa-shelf-head a {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    padding: 8px 12px;
    border-radius: 999px;
    color: #047857;
    background: #e7f5ef;
    font-size: 14px;
    font-weight: 900;
  }
  .prototype-topa-card-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }
  .prototype-topa-card-grid.is-primary {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
  .prototype-topa-card,
  .prototype-topa-empty-card {
    min-height: 232px;
    overflow: hidden;
    border: 1px solid rgba(16,185,129,.14);
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 18px 44px rgba(15,23,42,.075);
  }
  .prototype-topa-thumb {
    height: 142px;
    position: relative;
    display: block;
    overflow: hidden;
    background:
      linear-gradient(90deg, rgba(16,185,129,.1) 1px, transparent 1px),
      linear-gradient(0deg, rgba(14,165,233,.08) 1px, transparent 1px),
      #f8fffc;
    background-size: 28px 28px, 28px 28px, auto;
  }
  .prototype-topa-thumb img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }
  .prototype-topa-evidence-badge {
    position: absolute;
    left: 10px;
    bottom: 10px;
    max-width: calc(100% - 20px);
    min-height: 30px;
    display: inline-flex;
    align-items: center;
    padding: 5px 9px;
    border-radius: 999px;
    background: rgba(16, 37, 26, .88);
    color: #fff;
    font-size: 12px;
    line-height: 1.2;
    font-weight: 950;
    box-shadow: 0 8px 18px rgba(15,23,42,.18);
  }
  .prototype-topa-empty-thumb {
    height: 100%;
    display: grid;
    place-items: center;
    color: #047857;
    font-size: 14px;
    font-weight: 950;
  }
  .prototype-topa-card-body {
    min-height: 90px;
    display: grid;
    gap: 6px;
    align-content: start;
    padding: 12px;
  }
  .prototype-topa-card-body strong {
    color: #10251a;
    font-size: 17px;
    line-height: 1.38;
    font-weight: 950;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .prototype-topa-card-body small {
    color: #64748b;
    font-size: 14px;
    line-height: 1.45;
    font-weight: 720;
  }
  .prototype-topa-status {
    width: fit-content;
    min-height: 32px;
    display: inline-flex;
    align-items: center;
    padding: 5px 10px;
    border-radius: 999px;
    font-size: 13px;
    font-style: normal;
    font-weight: 950;
  }
  .prototype-topa-status.is-green { color: #047857; background: #e7f5ef; }
  .prototype-topa-status.is-blue { color: #1d4ed8; background: #e8f0ff; }
  .prototype-topa-status.is-amber { color: #92400e; background: #fff2d7; }
  .prototype-topa-next {
    display: block;
    color: #047857;
    font-size: 12px;
    line-height: 1.35;
    font-weight: 950;
  }
  .prototype-topa-summary-card {
    min-height: 170px;
    grid-column: span 2;
    display: grid;
    align-content: center;
    gap: 8px;
    padding: 18px;
    border: 1px solid rgba(14,165,233,.18);
    border-radius: 8px;
    background: linear-gradient(135deg, #f0f9ff, #ffffff 54%, #ecfdf5);
    box-shadow: 0 18px 44px rgba(15,23,42,.065);
  }
  .prototype-topa-summary-card small { color: #0369a1; font-size: 12px; font-weight: 950; }
  .prototype-topa-summary-card strong { color: #10251a; font-size: 18px; line-height: 1.35; font-weight: 950; }
  .prototype-topa-summary-card span { color: #64748b; font-size: 13px; line-height: 1.6; font-weight: 720; }
  .prototype-topa-side {
    position: sticky;
    top: 86px;
    display: grid;
    gap: 12px;
    padding: 14px;
    border: 1px solid rgba(16,185,129,.15);
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 18px 44px rgba(15,23,42,.075);
  }
  .prototype-topa-side-head {
    display: grid;
    gap: 6px;
  }
  .prototype-topa-side-head small {
    width: fit-content;
    min-height: 30px;
    display: inline-flex;
    align-items: center;
    padding: 5px 10px;
    border-radius: 999px;
    background: #fff2d7;
    color: #92400e;
    font-size: 13px;
    font-weight: 950;
  }
  .prototype-topa-side-head h2 {
    margin: 0;
    color: #10251a;
    font-size: 26px;
    line-height: 1.22;
    font-weight: 950;
  }
  .prototype-topa-side-head a {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 12px;
    border-radius: 999px;
    background: #10251a;
    color: #fff;
    font-size: 14px;
    font-weight: 900;
  }
  .prototype-topa-identify-list {
    display: grid;
    gap: 8px;
  }
  .prototype-topa-identify-list a,
  .prototype-topa-side-empty {
    display: grid;
    gap: 3px;
    min-height: 58px;
    padding: 10px 11px;
    border: 1px solid rgba(15,23,42,.08);
    border-radius: 8px;
    background: #f8fafc;
  }
  .prototype-topa-identify-list strong {
    color: #10251a;
    font-size: 14px;
    line-height: 1.35;
    font-weight: 950;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .prototype-topa-identify-list span,
  .prototype-topa-side-empty {
    color: #64748b;
    font-size: 12px;
    line-height: 1.45;
    font-weight: 720;
  }
  .prototype-topa-empty-card {
    grid-column: 1 / -1;
    min-height: 170px;
    display: grid;
    align-content: center;
    gap: 8px;
    padding: 18px;
  }
  .prototype-topa-empty-card strong {
    color: #10251a;
    font-size: 19px;
    line-height: 1.35;
    font-weight: 950;
  }
  .prototype-topa-empty-card span {
    color: #64748b;
    font-size: 15px;
    line-height: 1.6;
    font-weight: 700;
  }
  .prototype-monitoring-areas {
    display: grid;
    gap: 12px;
    scroll-margin-top: 92px;
  }
  .prototype-monitoring-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 14px;
  }
  .prototype-monitoring-title {
    min-width: 0;
    display: grid;
    gap: 3px;
  }
  .prototype-monitoring-title span {
    width: fit-content;
    color: #0f766e;
    font-size: 10px;
    line-height: 1;
    font-weight: 950;
    letter-spacing: 0;
  }
  .prototype-monitoring-title h2 {
    margin: 0;
    color: #10251a;
    font-size: 20px;
    line-height: 1.15;
    font-weight: 950;
  }
  .prototype-monitoring-title small {
    min-width: 0;
    color: #64748b;
    font-size: 11px;
    line-height: 1.25;
    font-weight: 850;
  }
  .prototype-monitoring-head > a {
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #0f766e;
    font-size: 12px;
    line-height: 1;
    font-weight: 950;
    white-space: nowrap;
  }
  .prototype-monitoring-head > a::after {
    content: "";
    width: 11px;
    height: 11px;
    display: block;
    background: currentColor;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M13.3 5.3 20 12l-6.7 6.7-1.4-1.4 4.3-4.3H4v-2h12.2l-4.3-4.3 1.4-1.4Z'/%3E%3C/svg%3E") center / contain no-repeat;
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M13.3 5.3 20 12l-6.7 6.7-1.4-1.4 4.3-4.3H4v-2h12.2l-4.3-4.3 1.4-1.4Z'/%3E%3C/svg%3E") center / contain no-repeat;
  }
  .prototype-monitoring-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    align-items: stretch;
  }
  .prototype-monitoring-card {
    min-width: 0;
    display: grid;
    grid-template-rows: 168px auto auto auto 1fr auto;
    align-content: start;
    gap: 9px;
    padding: 12px;
    border: 1px solid rgba(15,23,42,.08);
    border-radius: 8px;
    background: rgba(255,255,255,.88);
    color: inherit;
    text-decoration: none;
    box-shadow: 0 14px 34px rgba(15,23,42,.06);
  }
  .prototype-monitoring-card.is-feature {
    min-height: 0;
    border-color: rgba(15,118,110,.15);
    background: linear-gradient(135deg, rgba(255,255,255,.94), rgba(240,253,250,.82));
  }
  .prototype-monitoring-card:not(.is-feature) {
    min-height: 0;
  }
  .prototype-monitoring-thumb {
    display: block;
    overflow: hidden;
    border-radius: 7px;
    background:
      linear-gradient(90deg, rgba(16,185,129,.11) 1px, transparent 1px),
      linear-gradient(0deg, rgba(14,165,233,.09) 1px, transparent 1px),
      #f8fffc;
    background-size: 20px 20px, 20px 20px, auto;
  }
  .prototype-monitoring-card.is-feature .prototype-monitoring-thumb {
    width: 100%;
    height: 168px;
    min-height: 0;
  }
  .prototype-monitoring-card:not(.is-feature) .prototype-monitoring-thumb {
    width: 100%;
    height: 168px;
  }
  .prototype-monitoring-thumb img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }
  .prototype-monitoring-thumb.is-empty::before {
    content: "";
    width: 30px;
    height: 30px;
    display: block;
    margin: 48px auto 0;
    background: #0f766e;
    opacity: .76;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Zm0 3.1 5 1.9v4c0 3.5-2 6.9-5 8-3-1.1-5-4.5-5-8V7l5-1.9Zm0 3.4a2.5 2.5 0 0 0-2.5 2.5c0 1.9 2.5 4.5 2.5 4.5s2.5-2.6 2.5-4.5A2.5 2.5 0 0 0 12 8.5Z'/%3E%3C/svg%3E") center / contain no-repeat;
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Zm0 3.1 5 1.9v4c0 3.5-2 6.9-5 8-3-1.1-5-4.5-5-8V7l5-1.9Zm0 3.4a2.5 2.5 0 0 0-2.5 2.5c0 1.9 2.5 4.5 2.5 4.5s2.5-2.6 2.5-4.5A2.5 2.5 0 0 0 12 8.5Z'/%3E%3C/svg%3E") center / contain no-repeat;
  }
  .prototype-monitoring-meta-row {
    min-width: 0;
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }
  .prototype-monitoring-label {
    width: fit-content;
    min-height: 22px;
    display: inline-flex;
    align-items: center;
    padding: 0 8px;
    border-radius: 999px;
    background: rgba(15,118,110,.09);
    color: #0f766e;
    font-size: 10px;
    line-height: 1;
    font-weight: 950;
  }
  .prototype-monitoring-locality {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #64748b;
    font-size: 11px;
    line-height: 1.2;
    font-weight: 850;
  }
  .prototype-monitoring-card strong {
    min-width: 0;
    overflow: hidden;
    color: #10251a;
    font-weight: 950;
  }
  .prototype-monitoring-card.is-feature strong {
    font-size: 17px;
    line-height: 1.32;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .prototype-monitoring-card:not(.is-feature) strong {
    font-size: 17px;
    line-height: 1.32;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .prototype-monitoring-card small {
    min-width: 0;
    overflow: hidden;
    color: #64748b;
    font-size: 12px;
    line-height: 1.35;
    font-weight: 850;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .prototype-monitoring-card p {
    min-width: 0;
    margin: 0;
    color: #10251a;
    font-size: 13px;
    line-height: 1.55;
    font-weight: 850;
  }
  .prototype-monitoring-card:not(.is-feature) p {
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .prototype-monitoring-metrics {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: auto;
    color: #64748b;
    font-size: 12px;
    line-height: 1.25;
    font-style: normal;
    font-weight: 800;
  }
  .prototype-monitoring-card:not(.is-feature) .prototype-monitoring-metrics {
    font-size: 11px;
  }
  .prototype-monitoring-empty {
    min-height: 76px;
    display: grid;
    place-items: center start;
    padding: 12px;
    border: 1px dashed rgba(15,23,42,.14);
    border-radius: 8px;
    color: #64748b;
    font-size: 13px;
    font-weight: 850;
  }
  .prototype-local-followups {
    display: grid;
    grid-template-columns: minmax(0, 1.42fr) minmax(320px, .58fr);
    gap: 12px;
    align-items: stretch;
  }
  .prototype-local-followups.is-single {
    grid-template-columns: minmax(0, 1fr);
  }
  .prototype-local-panel {
    min-width: 0;
    display: grid;
    grid-template-rows: auto 1fr;
    gap: 10px;
    padding: 13px;
    border: 1px solid rgba(15,23,42,.08);
    border-radius: 8px;
    background: rgba(255,255,255,.84);
    box-shadow: 0 14px 34px rgba(15,23,42,.045);
  }
  .prototype-local-panel.is-invasive {
    background:
      radial-gradient(circle at 14% 18%, rgba(251,191,36,.16), transparent 28%),
      radial-gradient(circle at 92% 8%, rgba(20,184,166,.13), transparent 28%),
      linear-gradient(135deg, rgba(255,255,255,.96), rgba(255,251,235,.78));
  }
  .prototype-local-panel.is-events {
    background: linear-gradient(135deg, rgba(255,255,255,.94), rgba(240,249,255,.76));
  }
  .prototype-guide-outcomes {
    display: grid;
    gap: 12px;
    padding: 14px;
    border: 1px solid rgba(15,118,110,.12);
    border-radius: 8px;
    background:
      radial-gradient(circle at 8% 12%, rgba(20,184,166,.12), transparent 30%),
      linear-gradient(135deg, rgba(255,255,255,.96), rgba(240,253,250,.78));
    box-shadow: 0 14px 34px rgba(15,23,42,.045);
  }
  .prototype-guide-outcome-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }
  .prototype-guide-outcome-card {
    min-width: 0;
    min-height: 218px;
    display: grid;
    grid-template-rows: 88px auto auto 1fr auto;
    gap: 6px;
    padding: 12px;
    border: 1px solid rgba(15,23,42,.08);
    border-radius: 8px;
    background: rgba(255,255,255,.9);
    color: inherit;
    text-decoration: none;
    box-shadow: 0 12px 28px rgba(15,23,42,.05);
  }
  .prototype-guide-outcome-thumb {
    width: 100%;
    height: 88px;
    display: grid;
    place-items: center;
    overflow: hidden;
    border-radius: 7px;
    background: linear-gradient(135deg, rgba(240,253,250,.98), rgba(255,255,255,.9));
    color: #0f766e;
    font-size: 11px;
    font-style: normal;
    font-weight: 950;
    box-shadow: inset 0 0 0 1px rgba(15,118,110,.08);
  }
  .prototype-guide-outcome-thumb.is-empty::before {
    content: "GUIDE";
    color: #0f766e;
    font-size: 10px;
    font-weight: 950;
  }
  .prototype-guide-outcome-thumb img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }
  .prototype-guide-outcome-card span {
    color: #0f766e;
    font-size: 10px;
    line-height: 1.25;
    font-weight: 950;
  }
  .prototype-guide-outcome-user {
    min-width: 0;
    display: grid;
    grid-template-columns: 24px minmax(0, auto) 1fr;
    gap: 7px;
    align-items: center;
  }
  .prototype-guide-outcome-user i {
    width: 24px;
    height: 24px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    overflow: hidden;
    background: #d1fae5;
    color: #047857;
    font-size: 10px;
    font-weight: 950;
    font-style: normal;
  }
  .prototype-guide-outcome-user i img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .prototype-guide-outcome-user b {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #0f172a;
    font-size: 12px;
    line-height: 1.1;
  }
  .prototype-guide-outcome-user small {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    justify-self: end;
    color: #64748b;
    font-size: 11px;
    line-height: 1.1;
    font-weight: 900;
  }
  .prototype-guide-outcome-card strong {
    min-width: 0;
    color: #10251a;
    font-size: 15px;
    line-height: 1.28;
    font-weight: 950;
  }
  .prototype-guide-outcome-card small {
    min-width: 0;
    color: #475569;
    font-size: 11.5px;
    line-height: 1.38;
    font-weight: 850;
  }
  .prototype-guide-outcome-card em {
    min-width: 0;
    color: #0f766e;
    font-size: 11.5px;
    line-height: 1.38;
    font-style: normal;
    font-weight: 950;
  }
  .prototype-local-list {
    min-width: 0;
    display: grid;
    gap: 8px;
  }
  .prototype-local-panel.is-invasive .prototype-local-list {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }
  .prototype-local-watch-card {
    min-width: 0;
    min-height: 234px;
    position: relative;
    overflow: hidden;
    display: grid;
    grid-template-rows: 88px auto auto auto 1fr;
    gap: 7px;
    padding: 12px;
    border: 1px solid rgba(15,23,42,.08);
    border-radius: 8px;
    background: rgba(255,255,255,.9);
    color: inherit;
    text-decoration: none;
    box-shadow: 0 12px 28px rgba(15,23,42,.05);
  }
  .prototype-local-watch-card::before {
    content: "";
    position: absolute;
    inset: auto -28px -36px auto;
    width: 118px;
    height: 118px;
    border-radius: 999px;
    background: rgba(15,118,110,.065);
  }
  .prototype-invasive-thumb {
    width: 100%;
    height: 88px;
    position: relative;
    z-index: 1;
    display: block;
    overflow: hidden;
    border-radius: 7px;
    background: #f8fffc;
    box-shadow: inset 0 0 0 1px rgba(15,118,110,.08);
  }
  .prototype-invasive-thumb img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;
  }
  .prototype-invasive-meta {
    min-width: 0;
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: space-between;
    gap: 7px;
    color: #64748b;
    font-size: 10px;
    line-height: 1.25;
    font-weight: 850;
  }
  .prototype-invasive-meta em {
    flex: 0 0 auto;
    min-height: 21px;
    display: inline-flex;
    align-items: center;
    padding: 0 7px;
    border-radius: 999px;
    background: rgba(15,118,110,.09);
    color: #0f766e;
    font-style: normal;
    font-weight: 950;
  }
  .prototype-local-watch-card.is-urgent .prototype-invasive-meta em {
    background: rgba(217,119,6,.12);
    color: #92400e;
  }
  .prototype-invasive-name {
    min-width: 0;
    color: #10251a;
    font-size: 16px;
    line-height: 1.28;
    font-weight: 950;
  }
  .prototype-local-watch-card small {
    min-width: 0;
    color: #475569;
    font-size: 12px;
    line-height: 1.35;
    font-weight: 850;
  }
  .prototype-local-watch-card .prototype-invasive-impact {
    color: #0f766e;
    font-weight: 950;
  }
  .prototype-local-watch-card mark {
    width: fit-content;
    min-height: 24px;
    display: inline-flex;
    align-items: center;
    justify-self: end;
    padding: 0 8px;
    border-radius: 999px;
    background: rgba(146,64,14,.08);
    color: #92400e;
    font-size: 10px;
    line-height: 1;
    font-weight: 950;
    box-shadow: inset 0 0 0 1px rgba(146,64,14,.08);
  }
  .prototype-local-watch-card.is-urgent mark {
    background: rgba(217,119,6,.1);
    color: #92400e;
  }
  .prototype-local-event-row,
  .prototype-local-watch-empty,
  .prototype-local-event-empty {
    min-width: 0;
    min-height: 62px;
    display: grid;
    grid-template-columns: minmax(54px, auto) minmax(0, 1fr);
    grid-template-rows: auto auto;
    align-content: center;
    gap: 3px 10px;
    padding: 10px;
    border: 1px solid rgba(15,23,42,.07);
    border-radius: 8px;
    background: rgba(255,255,255,.78);
    color: inherit;
    text-decoration: none;
  }
  .prototype-local-event-row span {
    grid-row: 1 / span 2;
    align-self: center;
    min-height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 8px;
    border-radius: 999px;
    background: rgba(15,118,110,.09);
    color: #0f766e;
    font-size: 10px;
    line-height: 1;
    font-weight: 950;
    white-space: nowrap;
  }
  .prototype-local-event-row strong,
  .prototype-local-event-empty strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #10251a;
    font-size: 14px;
    line-height: 1.25;
    font-weight: 950;
  }
  .prototype-local-event-row small,
  .prototype-local-event-empty small {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #64748b;
    font-size: 12px;
    line-height: 1.25;
    font-weight: 800;
  }
  .prototype-local-watch-empty {
    grid-template-columns: minmax(0, 1fr);
    color: #64748b;
    font-size: 13px;
    font-weight: 850;
  }
  .prototype-local-event-empty {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .prototype-local-event-empty strong,
  .prototype-local-event-empty small {
    grid-column: 1;
  }
  .prototype-local-event-empty a {
    grid-column: 2;
    grid-row: 1 / span 2;
    align-self: center;
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    padding: 0 12px;
    border-radius: 999px;
    background: #0f766e;
    color: #fff;
    font-size: 12px;
    line-height: 1;
    font-weight: 950;
    text-decoration: none;
    white-space: nowrap;
  }
  .prototype-topa-map-shelf {
    display: grid;
    grid-template-columns: minmax(260px, .34fr) minmax(0, .66fr);
    gap: 14px;
    align-items: stretch;
    scroll-margin-top: 92px;
    padding: 14px;
    border: 1px solid rgba(16,185,129,.16);
    border-radius: 8px;
    background: linear-gradient(135deg, #f8fffc, #f0f9ff);
    box-shadow: 0 18px 48px rgba(15,23,42,.065);
  }
  .prototype-topa-map-copy {
    display: grid;
    align-content: center;
    gap: 12px;
    padding: clamp(18px, 3vw, 28px);
    border: 1px solid rgba(16,185,129,.13);
    border-radius: 8px;
    background: rgba(255,255,255,.8);
  }
  .prototype-topa-map-copy small {
    color: #047857;
    font-size: 13px;
    font-weight: 950;
  }
  .prototype-topa-map-copy h2 {
    margin: 0;
    color: #10251a;
    font-size: clamp(24px, 3vw, 38px);
    line-height: 1.18;
    font-weight: 950;
  }
  .prototype-topa-map-copy p {
    margin: 0;
    color: #475569;
    font-size: 16px;
    line-height: 1.7;
    font-weight: 680;
  }
  .prototype-topa-map-note {
    display: grid;
    gap: 6px;
    padding: 12px;
    border-radius: 8px;
    background: #e7f5ef;
  }
  .prototype-topa-map-note strong { color: #10251a; font-size: 17px; line-height: 1.35; font-weight: 950; }
  .prototype-topa-map-note span { color: #475569; font-size: 14px; line-height: 1.55; font-weight: 720; }
  .prototype-topa-map-board {
    overflow: hidden;
    min-height: 360px;
    border: 1px solid rgba(16,185,129,.14);
    border-radius: 8px;
    background: #ecfdf5;
  }
  .prototype-sound-os {
    display: grid;
    grid-template-columns: minmax(260px, .42fr) minmax(0, .58fr);
    gap: 14px;
    align-items: stretch;
    padding: 14px;
    border: 1px solid rgba(15,23,42,.1);
    border-radius: 8px;
    background: linear-gradient(135deg, rgba(15,23,42,.96), rgba(8,47,73,.94) 58%, rgba(20,83,45,.92));
    box-shadow: 0 18px 48px rgba(15,23,42,.12);
    scroll-margin-top: 92px;
  }
  .prototype-sound-copy {
    display: grid;
    align-content: center;
    gap: 12px;
    padding: clamp(18px, 3vw, 28px);
    border-radius: 8px;
    background: rgba(255,255,255,.08);
    border: 1px solid rgba(255,255,255,.12);
  }
  .prototype-sound-copy small {
    color: #a7f3d0;
    font-size: 13px;
    line-height: 1.2;
    font-weight: 950;
  }
  .prototype-sound-copy h2 {
    margin: 0;
    color: #fff;
    font-size: clamp(24px, 3vw, 38px);
    line-height: 1.18;
    font-weight: 950;
    letter-spacing: 0;
  }
  .prototype-sound-copy p {
    margin: 0;
    color: #dbeafe;
    font-size: 15px;
    line-height: 1.7;
    font-weight: 720;
  }
  .prototype-sound-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .prototype-sound-actions .prototype-btn-secondary {
    background: rgba(255,255,255,.12);
    color: #eff6ff;
    border-color: rgba(255,255,255,.2);
  }
  .prototype-sound-flow {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .prototype-sound-flow article {
    min-height: 188px;
    display: grid;
    align-content: start;
    gap: 8px;
    padding: 16px;
    border-radius: 8px;
    background: rgba(255,255,255,.94);
    border: 1px solid rgba(255,255,255,.18);
  }
  .prototype-sound-flow span {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: #10251a;
    color: #fff;
    font-size: 13px;
    font-weight: 950;
  }
  .prototype-sound-flow i {
    color: #0369a1;
    font-size: 12px;
    line-height: 1.2;
    font-style: normal;
    font-weight: 950;
    text-transform: uppercase;
  }
  .prototype-sound-flow h3 {
    margin: 0;
    color: #10251a;
    font-size: 17px;
    line-height: 1.34;
    font-weight: 950;
  }
  .prototype-sound-flow p {
    margin: 0;
    color: #475569;
    font-size: 13px;
    line-height: 1.6;
    font-weight: 720;
  }
  .prototype-topa-learn {
    min-height: 72px;
    display: grid;
    grid-template-columns: minmax(0, auto) minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    padding: 14px;
    border: 1px solid rgba(16,185,129,.14);
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 14px 34px rgba(15,23,42,.055);
  }
  .prototype-topa-learn strong { color: #10251a; font-size: 17px; line-height: 1.35; font-weight: 950; }
  .prototype-topa-learn span { color: #64748b; font-size: 14px; line-height: 1.55; font-weight: 720; }
  .prototype-topa-learn a {
    min-height: 48px;
    display: inline-flex;
    align-items: center;
    padding: 8px 14px;
    border-radius: 999px;
    background: #10251a;
    color: #fff;
    font-size: 14px;
    font-weight: 900;
    white-space: nowrap;
  }
  .prototype-hero {
    min-height: min(820px, calc(100svh - 72px));
    display: grid;
    grid-template-columns: minmax(0, .98fr) minmax(420px, 1.02fr);
    align-items: center;
    gap: 24px;
  }
  .prototype-hero-copy { display: grid; gap: 25px; align-content: center; }
  .prototype-live-pill {
    width: fit-content;
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border: 1px solid rgba(16,185,129,.28);
    border-radius: 999px;
    background: rgba(16,185,129,.1);
    color: #047857;
    box-shadow: 0 8px 24px rgba(16,185,129,.08);
    font-size: 12px;
    font-weight: 900;
  }
  .prototype-live-pill span {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: #10b981;
    box-shadow: 0 0 0 7px rgba(16,185,129,.14);
  }
  .prototype-live-pill time { padding-left: 10px; border-left: 1px solid rgba(16,185,129,.24); color: #64748b; }
  .prototype-hero h1 {
    margin: 0;
    max-width: 13ch;
    font-size: clamp(44px, 5.5vw, 76px);
    line-height: 1.04;
    letter-spacing: 0;
    font-weight: 950;
  }
  .prototype-hero h1 .hero-emphasis { color: #10b981; white-space: normal; overflow-wrap: anywhere; }
  .prototype-hero p {
    margin: 0;
    max-width: 42em;
    color: #374151;
    font-size: clamp(15px, 1.35vw, 18px);
    font-weight: 680;
  }
  .prototype-actions { display: flex; flex-wrap: wrap; gap: 10px; }
  .prototype-stat-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; max-width: 640px; }
  .prototype-stat-card {
    min-height: 116px;
    padding: 16px;
    border: 1px solid rgba(16,185,129,.14);
    border-radius: 8px;
    background: rgba(255,255,255,.76);
    box-shadow: 0 12px 30px rgba(15,23,42,.055);
  }
  .prototype-stat-card strong { display: block; color: #1a2e1f; font-size: 29px; line-height: 1.05; font-weight: 950; }
  .prototype-stat-card span { display: block; margin-top: 8px; color: #64748b; font-size: 12px; font-weight: 780; }
  .prototype-hero-visual {
    min-height: 680px;
    position: relative;
    border: 1px solid rgba(16,185,129,.18);
    border-radius: 8px;
    background: #f9fffe;
    overflow: hidden;
    box-shadow: 0 30px 70px rgba(16,185,129,.14);
  }
  .prototype-hero-map {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(125deg, rgba(249,255,254,.42), rgba(236,253,245,.24) 42%, rgba(224,242,254,.3)),
      var(--hero-image);
    background-size: auto, cover;
    background-position: center;
    filter: saturate(1.06) contrast(1.04) brightness(.98);
    transform: scale(1.02);
  }
  .prototype-hero-map.is-empty {
    background:
      linear-gradient(90deg, rgba(16,185,129,.11) 1px, transparent 1px),
      linear-gradient(0deg, rgba(14,165,233,.08) 1px, transparent 1px),
      linear-gradient(135deg, rgba(236,253,245,.96), rgba(240,249,255,.94) 58%, rgba(255,247,237,.82));
    background-size: 54px 54px, 54px 54px, auto;
  }
  .prototype-hero-map::after {
    content: "";
    position: absolute;
    inset: 0;
    background:
      linear-gradient(90deg, rgba(16,185,129,.16) 1px, transparent 1px),
      linear-gradient(0deg, rgba(14,165,233,.12) 1px, transparent 1px);
    background-size: 72px 72px;
    mix-blend-mode: multiply;
    opacity: .62;
  }
  .prototype-scan-line {
    position: absolute;
    left: 0;
    right: 0;
    top: 31%;
    height: 2px;
    background: linear-gradient(90deg, transparent, #10b981, #0ea5e9, transparent);
    box-shadow: 0 0 26px rgba(16,185,129,.46);
    animation: prototype-scan 4.4s ease-in-out infinite alternate;
  }
  @keyframes prototype-scan {
    from { transform: translateY(-180px); }
    to { transform: translateY(260px); }
  }
  .prototype-signal-stack {
    position: absolute;
    top: 20px;
    right: 20px;
    display: grid;
    gap: 9px;
    width: min(288px, calc(100% - 40px));
  }
  .prototype-signal-card,
  .prototype-observation-panel,
  .prototype-identify-panel {
    border: 1px solid rgba(16,185,129,.16);
    border-radius: 8px;
    background: rgba(255,255,255,.88);
    box-shadow: 0 14px 34px rgba(15,23,42,.09);
    backdrop-filter: blur(16px);
  }
  .prototype-signal-card { min-height: 76px; display: grid; grid-template-columns: 38px minmax(0, 1fr); align-items: center; gap: 10px; padding: 10px; }
  .prototype-signal-card i,
  .prototype-library-card i,
  .prototype-flow-card i,
  .prototype-map-points i,
  .prototype-trust-grid i,
  .prototype-link-band i {
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: rgba(16,185,129,.12);
    color: #047857;
    font-style: normal;
    font-size: 11px;
    font-weight: 950;
  }
  .prototype-signal-card i { width: 38px; height: 38px; }
  .prototype-signal-card strong,
  .prototype-feed-row strong,
  .prototype-name-step strong { display: block; color: #1a2e1f; font-size: 13px; line-height: 1.3; }
  .prototype-signal-card span,
  .prototype-feed-row small,
  .prototype-name-step small { display: block; color: #64748b; font-size: 11px; font-weight: 740; }
  .prototype-hero-panel { position: absolute; left: 18px; right: 18px; bottom: 18px; display: grid; grid-template-columns: 1.1fr .9fr; gap: 12px; }
  .prototype-observation-panel,
  .prototype-identify-panel { min-height: 220px; padding: 14px; }
  .prototype-panel-head { display: flex; justify-content: space-between; gap: 10px; color: #64748b; font-size: 11px; font-weight: 920; }
  .prototype-feed-row {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px solid rgba(15,23,42,.08);
  }
  .prototype-feed-row:last-child { border-bottom: 0; }
  .prototype-feed-row img,
  .prototype-feed-thumb {
    width: 52px;
    height: 52px;
    border-radius: 6px;
  }
  .prototype-feed-row img { object-fit: cover; display: block; }
  .prototype-feed-thumb {
    display: grid;
    place-items: center;
    background:
      linear-gradient(90deg, rgba(16,185,129,.14) 1px, transparent 1px),
      linear-gradient(0deg, rgba(14,165,233,.1) 1px, transparent 1px),
      #f8fffc;
    background-size: 12px 12px, 12px 12px, auto;
    color: #047857;
    font-size: 12px;
    font-weight: 950;
  }
  .prototype-feed-row strong { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .prototype-feed-row em { color: #64748b; font-size: 11px; font-style: normal; font-weight: 760; }
  .prototype-feed-empty { display: grid; gap: 9px; padding: 16px 0; }
  .prototype-name-steps { display: grid; gap: 8px; margin-top: 14px; }
  .prototype-name-step { display: grid; grid-template-columns: 28px minmax(0, 1fr); align-items: start; gap: 9px; padding: 9px; border-radius: 8px; background: rgba(16,185,129,.08); }
  .prototype-name-step b { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 999px; background: #10b981; color: #fff; font-size: 12px; line-height: 1; }
  .prototype-link-band {
    padding: 16px;
    border: 1px solid rgba(16,185,129,.14);
    border-radius: 8px;
    background: rgba(255,255,255,.82);
    box-shadow: 0 12px 30px rgba(15,23,42,.055);
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 16px;
    margin: 18px 0 16px;
  }
  .prototype-link-band i { width: 44px; height: 44px; border-radius: 12px; }
  .prototype-link-band strong { display: block; font-size: 16px; line-height: 1.35; font-weight: 950; }
  .prototype-link-band span { display: block; margin-top: 3px; color: #64748b; font-size: 12px; font-weight: 680; }
  .prototype-link-band + .prototype-section { padding-top: clamp(28px, 4vw, 46px); }
  .prototype-section { padding: clamp(58px, 8vw, 104px) 0; scroll-margin-top: 92px; }
  .prototype-section-head { display: grid; grid-template-columns: minmax(0, .7fr) minmax(280px, .3fr); gap: 24px; align-items: end; margin-bottom: 24px; }
  .prototype-eyebrow { color: #047857; font-size: 12px; font-weight: 950; }
  .prototype-section h2,
  .prototype-map-copy h2,
  .prototype-community h2,
  .prototype-cta h2 {
    margin: 8px 0 0;
    max-width: min(760px, 100%);
    color: #1a2e1f;
    font-size: clamp(31px, 3.25vw, 50px);
    line-height: 1.1;
    letter-spacing: 0;
    font-weight: 950;
  }
  .prototype-section-head p,
  .prototype-map-copy p,
  .prototype-community p,
  .prototype-cta p { margin: 0; color: #475569; font-size: 15px; font-weight: 680; }
  .prototype-daily-grid { display: grid; grid-template-columns: 1.1fr .9fr; gap: 14px; }
  .prototype-photo,
  .prototype-evidence-card,
  .prototype-thought-card,
  .prototype-daily-card,
  .prototype-flow-card,
  .prototype-library-card,
  .prototype-trust-grid article,
  .prototype-use-grid article,
  .prototype-daily-empty {
    border-radius: 8px;
    background: #fff;
    border: 1px solid rgba(16,185,129,.12);
    box-shadow: 0 22px 60px rgba(15,23,42,.09);
  }
  .prototype-photo { position: relative; overflow: hidden; min-height: 210px; }
  .prototype-photo-large { min-height: 560px; }
  .prototype-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .prototype-photo::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 46%, rgba(0,0,0,.55)); }
  .prototype-photo span { position: absolute; left: 18px; right: 18px; bottom: 18px; z-index: 2; color: #fff; }
  .prototype-photo small { display: block; color: #d9f99d; font-size: 12px; font-weight: 950; }
  .prototype-photo strong { display: block; margin-top: 4px; font-size: 24px; line-height: 1.25; font-weight: 950; }
  .prototype-photo-small strong { font-size: 15px; }
  .prototype-evidence-card {
    min-height: 210px;
    padding: 18px;
    display: grid;
    align-content: end;
    gap: 10px;
    background:
      linear-gradient(90deg, rgba(16,185,129,.08) 1px, transparent 1px),
      linear-gradient(0deg, rgba(14,165,233,.06) 1px, transparent 1px),
      #fbfffe;
    background-size: 32px 32px, 32px 32px, auto;
  }
  .prototype-evidence-large { min-height: 560px; }
  .prototype-evidence-card small,
  .prototype-evidence-card span { color: #047857; font-size: 12px; font-weight: 950; }
  .prototype-evidence-card strong { color: #1a2e1f; font-size: 24px; line-height: 1.25; font-weight: 950; }
  .prototype-evidence-small strong { font-size: 15px; }
  .prototype-evidence-card p { margin: 0; color: #475569; font-size: 13px; font-weight: 650; }
  .prototype-daily-empty {
    min-height: 380px;
    padding: clamp(22px, 4vw, 42px);
    display: grid;
    align-content: center;
    gap: 14px;
    background:
      linear-gradient(90deg, rgba(16,185,129,.08) 1px, transparent 1px),
      linear-gradient(0deg, rgba(14,165,233,.06) 1px, transparent 1px),
      linear-gradient(135deg, #ffffff, #f0fdf4 62%, #f0f9ff);
    background-size: 42px 42px, 42px 42px, auto;
  }
  .prototype-daily-empty small { color: #047857; font-size: 12px; font-weight: 950; }
  .prototype-daily-empty strong { max-width: 19ch; color: #1a2e1f; font-size: clamp(28px, 4vw, 48px); line-height: 1.12; font-weight: 950; }
  .prototype-daily-empty p { max-width: 52ch; margin: 0; color: #475569; font-size: 15px; font-weight: 680; }
  .prototype-empty-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; }
  .prototype-daily-side { display: grid; gap: 14px; align-content: stretch; }
  .prototype-photo-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .prototype-thought-card { min-height: 192px; padding: 20px; display: grid; align-content: center; gap: 12px; background: #10251a; color: #fff; }
  .prototype-thought-card small { color: #a7f3d0; font-weight: 950; }
  .prototype-thought-card strong { max-width: 22ch; font-size: 26px; line-height: 1.25; font-weight: 950; }
  .prototype-thought-card p { margin: 0; color: rgba(255,255,255,.75); font-size: 13px; font-weight: 650; }
  .prototype-place-story { min-height: 178px; padding: 18px; display: grid; align-content: center; gap: 10px; border: 1px solid rgba(16,185,129,.2); background: #f8fff9; color: #14251b; }
  .prototype-place-story small { color: #047857; font-size: 11px; font-weight: 950; text-transform: uppercase; letter-spacing: .08em; }
  .prototype-place-story strong { font-size: 19px; line-height: 1.35; font-weight: 950; }
  .prototype-place-story p { margin: 0; color: #40564a; font-size: 13px; font-weight: 700; }
  .prototype-place-story a { color: #047857; font-size: 11px; font-weight: 850; text-decoration: none; }
  .prototype-daily-card-grid,
  .prototype-flow-grid,
  .prototype-library-grid,
  .prototype-trust-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-top: 14px; }
  .prototype-flow-grid,
  .prototype-trust-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .prototype-daily-card,
  .prototype-flow-card,
  .prototype-library-card,
  .prototype-trust-grid article { min-height: 210px; display: grid; align-content: start; gap: 12px; padding: 18px; }
  .prototype-daily-card small,
  .prototype-library-card span { color: #047857; font-size: 12px; font-weight: 950; }
  .prototype-daily-card strong,
  .prototype-flow-card h3,
  .prototype-library-card h3,
  .prototype-trust-grid h3 { margin: 0; color: #1a2e1f; font-size: 21px; line-height: 1.25; font-weight: 950; }
  .prototype-daily-card p,
  .prototype-flow-card p,
  .prototype-library-card p,
  .prototype-trust-grid p { margin: 0; color: #475569; font-size: 13px; font-weight: 650; }
  .prototype-daily-card span strong { display: inline; margin-right: 5px; font-size: 26px; }
  .prototype-daily-card em { align-self: end; color: #047857; font-size: 12px; font-style: normal; font-weight: 950; }
  .prototype-flow-card i,
  .prototype-library-card i,
  .prototype-trust-grid i { width: 48px; height: 48px; border-radius: 12px; }
  .prototype-flow-body { display: grid; gap: 12px; }
  .prototype-flow-num { order: -1; color: rgba(16,185,129,.36); font-size: 42px; line-height: 1; font-weight: 950; }
  .prototype-map-section {
    position: relative;
    display: grid;
    grid-template-columns: minmax(340px, .58fr) minmax(0, 1fr);
    gap: 18px;
    align-items: stretch;
    margin-top: 14px;
    scroll-margin-top: 92px;
    padding: 16px;
    border: 1px solid rgba(16,185,129,.16);
    border-radius: 8px;
    background:
      linear-gradient(90deg, rgba(16,185,129,.08) 1px, transparent 1px),
      linear-gradient(0deg, rgba(14,165,233,.06) 1px, transparent 1px),
      linear-gradient(135deg, rgba(236,253,245,.95) 0%, rgba(240,249,255,.9) 56%, rgba(255,247,237,.78) 100%);
    background-size: 48px 48px, 48px 48px, auto;
    box-shadow: 0 18px 52px rgba(15,23,42,.075);
  }
  .prototype-map-copy {
    padding: clamp(22px, 4vw, 38px);
    border: 1px solid rgba(16,185,129,.14);
    border-radius: 8px;
    background: rgba(255,255,255,.72);
    box-shadow: 0 16px 42px rgba(15,23,42,.06);
    display: grid;
    align-content: center;
    gap: 18px;
  }
  .prototype-map-step { display: flex; align-items: center; gap: 10px; color: #047857; font-weight: 950; }
  .prototype-map-step b { color: rgba(16,185,129,.44); font-size: clamp(42px, 5vw, 72px); line-height: 1; }
  .prototype-map-points { display: grid; gap: 9px; }
  .prototype-map-points a { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; align-items: center; padding: 10px; border: 1px solid rgba(16,185,129,.13); border-radius: 8px; background: rgba(255,255,255,.72); }
  .prototype-map-points i { width: 34px; height: 34px; border-radius: 9px; }
  .prototype-map-points strong { display: block; color: #1a2e1f; font-size: 14px; line-height: 1.35; }
  .prototype-map-points small { display: block; color: #64748b; font-size: 12px; font-weight: 650; }
  .prototype-map-board { min-height: 520px; position: relative; overflow: hidden; border: 1px solid rgba(16,185,129,.16); border-radius: 8px; background: #ecfdf5; box-shadow: 0 18px 46px rgba(15,23,42,.1); }
  .prototype-map-board .map-mini { height: 100%; min-height: 520px; border-radius: 0; border: 0; box-shadow: none; }
  .prototype-community {
    margin-top: clamp(58px, 8vw, 104px);
    padding: clamp(26px, 5vw, 44px);
    display: grid;
    grid-template-columns: minmax(0, .92fr) minmax(320px, 1.08fr);
    gap: 18px;
    border-radius: 8px;
    background: #10251a;
    color: #fff;
    box-shadow: 0 24px 64px rgba(16,37,26,.2);
  }
  .prototype-community h2 { color: #fff; }
  .prototype-community p { color: rgba(255,255,255,.78); margin-top: 14px; }
  .prototype-community .prototype-eyebrow { color: #a7f3d0; }
  .prototype-use-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .prototype-use-grid article { min-height: 154px; padding: 18px; background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.13); box-shadow: none; }
  .prototype-use-grid strong { display: block; color: #fff; font-size: 18px; font-weight: 950; }
  .prototype-use-grid span { display: block; margin-top: 8px; color: rgba(255,255,255,.72); font-size: 13px; font-weight: 650; }
  .prototype-cta {
    margin-top: clamp(58px, 8vw, 104px);
    padding: clamp(24px, 4vw, 38px);
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 18px;
    align-items: center;
    border-radius: 8px;
    background: linear-gradient(135deg, #10b981, #0ea5e9);
    color: #fff;
    box-shadow: 0 24px 64px rgba(16,185,129,.22);
  }
  .prototype-cta h2 { color: #fff; margin: 0; }
  .prototype-cta p { color: rgba(255,255,255,.84); margin-top: 10px; }
  @media (min-width: 1161px) {
    .shell.shell-bleed.prototype-shell {
      --ikimon-landing-effective-w: min(var(--ikimon-page-max), calc(100vw - var(--ikimon-shell-margin-left) - var(--ikimon-shell-margin-right)));
      width: var(--ikimon-landing-effective-w);
      margin-left: var(--ikimon-shell-margin-left);
      margin-right: var(--ikimon-shell-margin-right);
    }
    .prototype-content-grid {
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 20px 14px;
    }
    .prototype-content-lane-head h3 {
      font-size: 19px;
    }
  }
  @media (min-width: 1161px) and (max-width: 1380px) {
    .shell.shell-bleed.prototype-shell {
      padding-top: clamp(14px, 2vw, 24px);
    }
    .prototype-topa h1 {
      max-width: none;
      font-size: clamp(32px, 3vw, 46px);
      white-space: normal;
      text-wrap: balance;
    }
    .prototype-topa-search {
      min-height: 54px;
    }
    .prototype-topa-actions {
      gap: 10px;
    }
    .prototype-topa-action {
      min-height: 54px;
      grid-template-columns: 30px max-content;
      padding: 7px 12px 7px 8px;
    }
    .prototype-topa-action strong {
      font-size: 14px;
    }
    .prototype-topa-card-grid,
    .prototype-topa-card-grid.is-primary {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .prototype-topa-summary-card {
      grid-column: span 3;
    }
  }
  @media (max-width: 1020px) {
    .prototype-topa-story {
      grid-template-columns: 92px minmax(0, 1fr);
    }
    .prototype-topa-story-media {
      width: 92px;
    }
    .prototype-topa-story-stats {
      grid-column: 1 / -1;
    }
    .prototype-topa-board {
      grid-template-columns: 1fr;
    }
    .prototype-topa-side {
      position: static;
    }
    .prototype-topa-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .prototype-topa-trust { grid-template-columns: 1fr; }
    .prototype-content-lanes.is-split { grid-template-columns: 1fr; }
    .prototype-content-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px 12px; }
    .prototype-topa-map-shelf { grid-template-columns: 1fr; }
    .prototype-sound-os { grid-template-columns: 1fr; }
    .prototype-hero,
    .prototype-daily-grid,
    .prototype-map-section,
    .prototype-community { grid-template-columns: 1fr; }
    .prototype-hero-visual { min-height: 620px; }
    .prototype-section-head { grid-template-columns: 1fr; align-items: start; }
    .prototype-daily-card-grid,
    .prototype-library-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 720px) {
    .shell.shell-bleed.prototype-shell { padding-top: 14px; }
    .prototype-topa { padding-top: 12px; }
    .prototype-topa h1 { font-size: 34px; line-height: 1.1; white-space: normal; }
    .prototype-topa p { font-size: 14px; line-height: 1.55; }
    .prototype-topa-story {
      grid-template-columns: 72px minmax(0, 1fr);
      gap: 10px;
      padding: 10px;
      border-radius: 14px;
    }
    .prototype-topa-story-media {
      width: 72px;
      border-radius: 12px;
    }
    .prototype-topa-story-copy h2 {
      font-size: 19px;
    }
    .prototype-topa-story-copy p {
      display: none;
    }
    .prototype-topa-story-actions a {
      min-height: 36px;
      padding: 0 10px;
      font-size: 12px;
    }
    .prototype-topa-story-stats {
      display: none;
    }
    .prototype-topa-search { min-height: 52px; border-radius: 999px; grid-template-columns: auto minmax(0, 1fr) auto; }
    .prototype-topa-search button { grid-column: auto; width: auto; min-height: 38px; padding: 0 12px; }
    .prototype-topa-actions { display: flex; }
    .prototype-topa-action {
      min-height: 46px;
      grid-template-columns: 30px max-content;
      gap: 7px;
      padding: 7px 11px 7px 8px;
    }
    .prototype-topa-action-icon {
      width: 30px;
      height: 30px;
    }
    .prototype-topa-action strong { font-size: 13px; }
    .prototype-topa-action small { display: none; }
    .prototype-topa-trust {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 2px;
      scrollbar-width: none;
    }
    .prototype-topa-trust::-webkit-scrollbar { display: none; }
    .prototype-topa-trust span {
      min-height: 70px;
      flex: 0 0 76%;
      padding: 10px 12px;
    }
    .prototype-topa-metrics { gap: 8px; }
    .prototype-topa-metrics span { min-height: 32px; flex-direction: row; gap: 5px; }
    .prototype-topa-metrics strong { font-size: 15px; }
    .prototype-content-wall { padding: 0; gap: 14px; }
    .prototype-content-lanes { gap: 22px; }
    .prototype-content-lane { gap: 11px; }
    .prototype-content-lane + .prototype-content-lane {
      padding-top: 18px;
    }
    .prototype-content-lane-head {
      gap: 8px;
    }
    .prototype-content-lane-title {
      gap: 3px;
    }
    .prototype-content-lane-head h3 { font-size: 17px; }
    .prototype-content-lane-more {
      min-height: 31px;
      padding: 0 10px;
      font-size: 11px;
    }
    .prototype-content-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 20px 13px;
    }
    .prototype-content-card { gap: 8px; }
    .prototype-content-thumb {
      border-radius: 7px;
      box-shadow: 0 8px 18px rgba(15,23,42,.07);
    }
    .prototype-content-icon-row {
      left: 7px;
      top: 7px;
    }
    .prototype-content-icon {
      width: 24px;
      height: 24px;
    }
    .prototype-content-icon::before {
      width: 12px;
      height: 12px;
    }
    .prototype-content-body { gap: 8px; }
    .prototype-content-title-line {
      gap: 5px;
    }
    .prototype-content-title-line > strong {
      font-size: 13px;
      line-height: 1.34;
    }
    .prototype-content-subjects {
      max-width: 46%;
      gap: 4px;
      font-size: 9px;
    }
    .prototype-content-subjects em {
      min-width: 18px;
      height: 17px;
      padding: 0 4px;
      font-size: 9px;
    }
    .prototype-content-author {
      max-width: 100%;
      width: 100%;
      grid-template-columns: 22px minmax(0, 1fr) auto;
      column-gap: 5px;
      row-gap: 1px;
      justify-self: start;
    }
    .prototype-content-avatar { width: 22px; height: 22px; }
    .prototype-monitoring-areas { gap: 10px; }
    .prototype-monitoring-title h2 { font-size: 18px; }
    .prototype-monitoring-grid {
      grid-template-columns: none;
      gap: 12px;
    }
    .prototype-monitoring-card.is-feature,
    .prototype-monitoring-card:not(.is-feature) {
      min-height: 0;
      grid-template-columns: 84px minmax(0, 1fr);
      grid-template-rows: auto auto auto auto auto;
      align-content: start;
      gap: 5px 10px;
      padding: 10px;
    }
    .prototype-monitoring-card.is-feature .prototype-monitoring-thumb,
    .prototype-monitoring-card:not(.is-feature) .prototype-monitoring-thumb {
      grid-column: 1;
      grid-row: 1 / span 5;
      width: 84px;
      height: 108px;
      min-height: 0;
    }
    .prototype-monitoring-thumb.is-empty::before {
      width: 26px;
      height: 26px;
      margin-top: 48px;
    }
    .prototype-monitoring-card.is-feature strong,
    .prototype-monitoring-card:not(.is-feature) strong {
      font-size: 14px;
      line-height: 1.3;
      overflow: visible;
      white-space: normal;
      text-overflow: clip;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .prototype-monitoring-meta-row {
      flex-wrap: wrap;
      row-gap: 3px;
    }
    .prototype-monitoring-locality {
      overflow: visible;
      white-space: normal;
      text-overflow: clip;
    }
    .prototype-monitoring-card small {
      font-size: 11px;
      overflow: visible;
      white-space: normal;
      text-overflow: clip;
    }
    .prototype-monitoring-card p {
      font-size: 11px;
      line-height: 1.36;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .prototype-monitoring-metrics {
      grid-column: 2;
      overflow: visible;
      white-space: normal;
      text-overflow: clip;
      font-size: 10px;
    }
    .prototype-local-followups {
      grid-template-columns: none;
      gap: 10px;
    }
    .prototype-local-panel {
      gap: 9px;
      padding: 11px;
    }
    .prototype-guide-outcomes {
      gap: 10px;
      padding: 10px;
    }
    .prototype-guide-outcome-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 8px;
    }
    .prototype-guide-outcome-card {
      min-height: 158px;
      grid-template-columns: 44px minmax(0, 1fr);
      grid-template-rows: auto auto auto auto;
      align-content: start;
      gap: 4px 7px;
      padding: 10px 9px 9px;
    }
    .prototype-guide-outcome-thumb {
      grid-column: 1;
      grid-row: 1 / span 4;
      width: 44px;
      height: 44px;
      align-self: start;
      justify-self: center;
      margin-top: 38px;
      border-radius: 6px;
      font-size: 9px;
    }
    .prototype-guide-outcome-user {
      grid-template-columns: 22px minmax(0, auto) minmax(0, 1fr);
      gap: 5px;
    }
    .prototype-guide-outcome-user i {
      width: 22px;
      height: 22px;
    }
    .prototype-guide-outcome-user small {
      grid-column: auto;
      justify-self: end;
      padding-left: 0;
      font-size: 8.5px;
      line-height: 1.1;
      text-align: right;
    }
    .prototype-guide-outcome-card span,
    .prototype-guide-outcome-card strong,
    .prototype-guide-outcome-card small,
    .prototype-guide-outcome-card em {
      grid-column: 2;
    }
    .prototype-guide-outcome-card span {
      font-size: 9px;
      line-height: 1.2;
    }
    .prototype-guide-outcome-card strong {
      font-size: 12.5px;
      line-height: 1.24;
    }
    .prototype-guide-outcome-card small,
    .prototype-guide-outcome-card em {
      font-size: 9.5px;
      line-height: 1.32;
    }
    .prototype-guide-outcome-card .prototype-guide-outcome-user {
      grid-column: 2;
      display: grid;
      grid-template-columns: 18px minmax(30px, auto) minmax(0, 1fr);
      gap: 3px;
      align-items: center;
    }
    .prototype-guide-outcome-card .prototype-guide-outcome-user i {
      width: 18px;
      height: 18px;
    }
    .prototype-guide-outcome-card .prototype-guide-outcome-user b {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 10px;
      line-height: 1;
    }
    .prototype-guide-outcome-card .prototype-guide-outcome-user small {
      grid-column: auto;
      justify-self: end;
      min-width: 0;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding-left: 0;
      font-size: 8px;
      line-height: 1;
      text-align: right;
    }
    .prototype-local-panel.is-invasive .prototype-local-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .prototype-local-watch-card {
      min-height: 116px;
      grid-template-columns: 54px minmax(0, 1fr);
      grid-template-rows: auto auto auto auto;
      align-content: start;
      gap: 4px 8px;
      padding: 9px 10px;
    }
    .prototype-local-watch-card::before {
      display: none;
    }
    .prototype-invasive-thumb {
      grid-column: 1;
      grid-row: 1 / span 4;
      width: 54px;
      height: 58px;
      align-self: center;
      justify-self: center;
      border-radius: 6px;
    }
    .prototype-invasive-meta,
    .prototype-invasive-name,
    .prototype-local-watch-card small,
    .prototype-local-watch-card mark {
      grid-column: 2;
    }
    .prototype-invasive-name {
      font-size: 13px;
      line-height: 1.25;
    }
    .prototype-local-watch-card small {
      font-size: 10px;
      line-height: 1.28;
    }
    .prototype-local-watch-card mark {
      justify-self: start;
      align-self: start;
      width: max-content;
      max-width: 100%;
      height: 20px;
      min-height: 20px;
      padding: 0 6px;
      font-size: 8px;
      margin-top: 2px;
      border-radius: 6px;
    }
    .prototype-invasive-meta {
      flex-wrap: nowrap;
      gap: 4px 5px;
      font-size: 9px;
    }
    .prototype-invasive-meta em {
      min-height: 19px;
      padding: 0 6px;
    }
    .prototype-local-event-row,
    .prototype-local-watch-empty,
    .prototype-local-event-empty {
      min-height: 58px;
      gap: 3px 8px;
      padding: 9px;
    }
    .prototype-local-event-empty {
      grid-template-columns: minmax(0, 1fr);
    }
    .prototype-local-event-empty a {
      grid-column: 1;
      grid-row: auto;
      width: fit-content;
      min-height: 32px;
      margin-top: 4px;
    }
    .prototype-topa-tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .prototype-topa-tabs a { min-height: 52px; }
    .prototype-topa-card-grid,
    .prototype-topa-card-grid.is-primary {
      width: 100%;
      max-width: 100%;
      grid-template-columns: none;
      grid-auto-flow: column;
      grid-auto-columns: minmax(150px, 45vw);
      overflow-x: auto;
      overscroll-behavior-x: contain;
      scroll-snap-type: x proximity;
      padding-bottom: 8px;
      scrollbar-width: none;
    }
    .prototype-topa-card-grid::-webkit-scrollbar { display: none; }
    .prototype-topa-card { min-height: 210px; display: block; }
    .prototype-topa-card { scroll-snap-align: start; }
    .prototype-topa-thumb { height: 114px; min-height: 0; }
    .prototype-topa-card-body { min-height: 88px; gap: 5px; padding: 9px; }
    .prototype-topa-card-body strong { font-size: 14px; line-height: 1.32; }
    .prototype-topa-card-body small {
      font-size: 11px;
      line-height: 1.35;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .prototype-topa-status { min-height: 24px; padding: 3px 7px; font-size: 10px; }
    .prototype-topa-next { display: none; }
    .prototype-topa-summary-card { grid-column: auto; }
    .prototype-topa-map-board { min-height: 320px; }
    .prototype-sound-os { padding: 10px; }
    .prototype-sound-flow { grid-template-columns: 1fr; }
    .prototype-sound-flow article { min-height: auto; }
    .prototype-sound-actions .prototype-btn { width: 100%; white-space: normal; }
    .prototype-topa-learn { grid-template-columns: 1fr; }
    .prototype-topa-learn a { width: 100%; justify-content: center; }
    .prototype-hero { min-height: 0; gap: 20px; }
    .prototype-hero h1 { font-size: clamp(38px, 12vw, 52px); line-height: 1.08; }
    .prototype-stat-grid,
    .prototype-hero-panel,
    .prototype-flow-grid,
    .prototype-trust-grid,
    .prototype-use-grid,
    .prototype-cta { grid-template-columns: 1fr; }
    .prototype-hero-visual { min-height: 620px; }
    .prototype-signal-stack { left: 14px; right: 14px; top: 14px; width: auto; }
    .prototype-hero-panel { left: 14px; right: 14px; bottom: 14px; }
    .prototype-link-band { grid-template-columns: 1fr; }
    .prototype-flow-grid {
      position: relative;
      display: grid;
      grid-template-columns: 1fr;
      gap: 0;
      padding: 2px 0 0;
      margin-top: 14px;
    }
    .prototype-flow-grid::before {
      content: "";
      position: absolute;
      left: 28px;
      top: 18px;
      bottom: 94px;
      width: 2px;
      background: linear-gradient(180deg, rgba(16,185,129,.42), rgba(14,165,233,.24));
    }
    .prototype-flow-card {
      position: relative;
      min-height: auto;
      display: grid;
      grid-template-columns: 56px minmax(0, 1fr);
      grid-template-areas: "num body";
      gap: 12px;
      padding: 12px 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }
    .prototype-flow-body {
      grid-area: body;
      padding: 14px;
      border: 1px solid rgba(16,185,129,.14);
      border-radius: 8px;
      background: rgba(255,255,255,.82);
      box-shadow: 0 10px 28px rgba(15,23,42,.045);
    }
    .prototype-flow-card .prototype-flow-num {
      grid-area: num;
      order: 0;
      width: 52px;
      height: 52px;
      display: grid;
      place-items: center;
      position: relative;
      z-index: 1;
      border: 1px solid rgba(16,185,129,.18);
      border-radius: 999px;
      background: #ecfdf5;
      color: #10b981;
      font-size: 22px;
      box-shadow: 0 0 0 8px rgba(249,255,254,.92);
    }
    .prototype-flow-card i {
      width: 36px;
      height: 36px;
      border-radius: 10px;
    }
    .prototype-map-section {
      margin-top: 4px;
    }
    .prototype-map-copy h2 {
      max-width: 100%;
      font-size: 30px;
    }
    .prototype-map-board,
    .prototype-map-board .map-mini,
    .prototype-map-board .map-mini-canvas {
      min-height: 430px;
    }
    .prototype-photo-large,
    .prototype-evidence-large { min-height: 420px; }
    .prototype-photo-row { grid-template-columns: 1fr; }
    .prototype-daily-card-grid,
    .prototype-library-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 480px) {
    .prototype-actions,
    .prototype-empty-actions { display: grid; grid-template-columns: 1fr; }
    .prototype-btn { width: 100%; white-space: normal; text-align: center; }
    .prototype-hero-visual { min-height: 700px; }
    .prototype-content-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 21px 12px; }
    .prototype-content-author {
      grid-template-columns: 20px minmax(0, 1fr) auto;
      column-gap: 4px;
    }
    .prototype-content-avatar { width: 20px; height: 20px; }
    .prototype-content-avatar-symbol {
      width: 10px;
      height: 10px;
    }
    .prototype-content-author-copy em { font-size: 10px; }
    .prototype-content-author-copy small { font-size: 9px; }
    .prototype-feed-row { grid-template-columns: 46px minmax(0, 1fr); }
    .prototype-feed-row em { grid-column: 2; }
    .prototype-feed-row img,
    .prototype-feed-thumb { width: 46px; height: 46px; }
  }
`;
