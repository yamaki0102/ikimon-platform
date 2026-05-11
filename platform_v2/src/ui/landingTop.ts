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
  if (preset === "original") return sourceUrl;
  return toThumbnailUrl(sourceUrl, preset) ?? sourceUrl;
}

function observationImageUrl(obs: LandingObservation | null | undefined, preset: ThumbnailPreset | "original"): string | null {
  return itemImageUrl(obs, preset);
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
      heading: "いま見えている自然",
      lead: "みんなが残した写真、動画、ガイド、同定待ちから、次に見たいものが自然に見えてくる。",
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
      heading: "Nature people are finding now",
      lead: "Photos, videos, guides, and records needing a name make the next thing to notice feel close.",
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
      heading: "Naturaleza que la gente encuentra",
      lead: "Fotos, videos, guias y registros sin nombre acercan lo proximo que quieres mirar.",
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
      heading: "A natureza que as pessoas encontram",
      lead: "Fotos, videos, guias e registros sem nome aproximam o proximo detalhe para observar.",
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
      recordToday: { icon: "+", title: "記録する", fallbackBody: "名前が分からなくても記録できます。" },
      revisitPlace: { icon: "↻", title: "再訪", fallbackBody: "同じ場所の変化を見る。" },
      nearbyPulse: { icon: "◎", title: "近く", fallbackBody: "記録が増えた場所を開く。" },
      needsId: { icon: "ID", title: "同定待ち", fallbackBody: "分からない記録を少し確かめる。" },
    },
    en: {
      recordToday: { icon: "+", title: "Post", fallbackBody: "A record can start before you know the name." },
      revisitPlace: { icon: "↻", title: "Revisit", fallbackBody: "Look for what changed in the same place." },
      nearbyPulse: { icon: "◎", title: "Nearby", fallbackBody: "Open places where records are growing." },
      needsId: { icon: "ID", title: "Needs ID", fallbackBody: "Check one record that needs a name." },
    },
    es: {
      recordToday: { icon: "+", title: "Guardar foto", fallbackBody: "Puedes registrar antes de saber el nombre." },
      revisitPlace: { icon: "↻", title: "Volver", fallbackBody: "Mira que cambio en el mismo lugar." },
      nearbyPulse: { icon: "◎", title: "Cerca", fallbackBody: "Abre lugares con mas registros." },
      needsId: { icon: "ID", title: "Ayudar a nombrar", fallbackBody: "Revisa un registro sin nombre claro." },
    },
    "pt-BR": {
      recordToday: { icon: "+", title: "Salvar foto", fallbackBody: "Voce pode registrar antes de saber o nome." },
      revisitPlace: { icon: "↻", title: "Voltar", fallbackBody: "Veja o que mudou no mesmo lugar." },
      nearbyPulse: { icon: "◎", title: "Perto", fallbackBody: "Abra lugares com mais registros." },
      needsId: { icon: "ID", title: "Ajudar no nome", fallbackBody: "Revise um registro sem nome claro." },
    },
  };
  return localized[lang]?.[kind] ?? localized.ja[kind];
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
  const body = [card.primaryText, card.secondaryText].filter(Boolean).join(" · ") || action.fallbackBody;
  const metricHtml = card.metricValue && card.metricValue > 0
    ? `<em><strong>${escapeHtml(formatLandingNumber(copy, card.metricValue))}</strong>${escapeHtml(cardCopy.metricLabel)}</em>`
    : "";
  return `<a class="prototype-topa-action prototype-topa-action-${escapeHtml(card.kind)}" href="${escapeHtml(landingHref(basePath, lang, card.href))}" data-kpi-action="${escapeHtml(dailyActionKpi(card.kind))}">
    <span class="prototype-topa-action-icon" aria-hidden="true">${escapeHtml(action.icon)}</span>
    <strong>${escapeHtml(action.title)}</strong>
    <small>${escapeHtml(body)}</small>
    ${metricHtml}
  </a>`;
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
  const { basePath, lang, copy, snapshot } = options;
  const hero = landingHeroText(lang);
  const stats = hero.stats.map((stat) => ({
    label: stat.label,
    value: snapshot.stats[stat.key],
  }));
  const statsHtml = stats
    .map((stat) => `<span><strong>${escapeHtml(formatLandingNumber(copy, stat.value))}</strong>${escapeHtml(stat.label)}</span>`)
    .join("");
  const dailyCards = snapshot.dailyDashboard?.dailyCards ?? [];
  const dailyActionsHtml = dailyCards.length > 0
    ? dailyCards.map((card) => renderDailyActionCard(basePath, lang, copy, card)).join("")
    : [
        { kind: "recordToday" as const, href: "/record", primaryText: null, secondaryText: null, metricValue: null },
        { kind: "nearbyPulse" as const, href: "/map", primaryText: null, secondaryText: null, metricValue: null },
        { kind: "needsId" as const, href: "/records?view=needs_id", primaryText: null, secondaryText: null, metricValue: null },
        { kind: "revisitPlace" as const, href: "/records?view=places", primaryText: null, secondaryText: null, metricValue: null },
      ].map((card) => renderDailyActionCard(basePath, lang, copy, card)).join("");

  return `<section class="prototype-topa" aria-labelledby="landing-hero-heading">
    <div class="prototype-topa-intro">
      <h1 id="landing-hero-heading">${escapeHtml(hero.heading)}</h1>
      <p>${escapeHtml(hero.lead)}</p>
    </div>
    <form class="prototype-topa-search" role="search" action="${escapeHtml(landingHref(basePath, lang, "/records"))}" method="get" aria-label="${escapeHtml(hero.searchLabel)}">
      <span aria-hidden="true">🔍</span>
      <input type="search" name="q" placeholder="${escapeHtml(hero.searchPlaceholder)}" aria-label="${escapeHtml(hero.searchLabel)}" />
      <button type="submit">${escapeHtml(hero.searchButton)}</button>
    </form>
    <nav class="prototype-topa-actions" aria-label="${escapeHtml(copy.dailyDashboard.eyebrow)}">
      ${dailyActionsHtml}
    </nav>
    <div class="prototype-topa-metrics" aria-label="ikimon.lifeの公開記録数">${statsHtml}</div>
  </section>`;
}

function renderLandingDailyDashboard(options: LandingTopRenderOptions): string {
  const { basePath, lang, copy, snapshot } = options;
  const shelves = (snapshot.topShelves && snapshot.topShelves.length > 0)
    ? snapshot.topShelves
    : fallbackLandingShelves(snapshot);
  const contentShelvesHtml = shelves.map((shelf, index) => renderLandingShelf(options, shelf, index)).join("");

  const regionalStory = snapshot.regionalStory ?? null;
  const mapHref = landingHref(basePath, lang, "/map");
  const mapCells = toMapMiniCells(snapshot.mapPreviewCells, mapHref);
  const mapHtml = renderMapMini({
    id: "ikimon-topa-map-mini",
    cells: mapCells,
    mapHref,
    mapCtaLabel: "地図で見る",
    mapCtaKpiAction: "landing:topA:shelf:localMap",
    emptyLabel: "公開できる地図データを準備中です",
    height: 320,
  });
  const regionalStoryHtml = regionalStory
    ? `<div class="prototype-topa-map-note">
        <strong>${escapeHtml(regionalStory.placeHook)}</strong>
        <span>${escapeHtml(regionalStory.nextObservationAngle)}</span>
      </div>`
    : `<div class="prototype-topa-map-note">
        <strong>近くで記録が増えた場所</strong>
        <span>再訪問を頼むのではなく、地域の変化が見える場所として表示します。</span>
      </div>`;

  return `<section class="prototype-topa-shelves" aria-label="トップページの観察棚">
    ${contentShelvesHtml}
    ${renderSoundIntelligenceSection(basePath, lang)}

    <div class="prototype-topa-map-shelf" id="topa-local-map">
      <div class="prototype-topa-map-copy">
        <small>地域マップ</small>
        <h2>地図から探す。</h2>
        ${regionalStoryHtml}
      </div>
      <div class="prototype-topa-map-board">${mapHtml}</div>
    </div>
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
      linear-gradient(90deg, rgba(16,185,129,.07) 1px, transparent 1px),
      linear-gradient(0deg, rgba(14,165,233,.055) 1px, transparent 1px),
      linear-gradient(180deg, #ffffff 0%, #f9fffe 48%, #f2fbf7 100%);
    background-size: 48px 48px, 48px 48px, auto;
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
    font-size: clamp(28px, 2.65vw, 42px);
    line-height: 1.16;
    letter-spacing: 0;
    font-weight: 950;
    white-space: normal;
  }
  .prototype-topa p {
    margin: 0;
    max-width: 62em;
    color: #475569;
    font-size: 15px;
    line-height: 1.65;
    font-weight: 680;
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
    min-height: 48px;
    flex: 0 0 auto;
    display: grid;
    grid-template-columns: 30px max-content;
    align-items: center;
    gap: 8px;
    padding: 7px 12px 7px 8px;
    border: 1px solid rgba(16,185,129,.16);
    border-radius: 999px;
    background: #fff;
    box-shadow: 0 12px 26px rgba(15,23,42,.06);
    text-align: left;
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
  .prototype-topa-action strong {
    color: #10251a;
    font-size: 14px;
    line-height: 1.35;
    font-weight: 950;
  }
  .prototype-topa-action small {
    min-width: 0;
    color: #64748b;
    font-size: 13px;
    line-height: 1.48;
    font-weight: 720;
    display: none;
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
  }
  @media (min-width: 1161px) and (max-width: 1380px) {
    .shell.shell-bleed.prototype-shell {
      padding-top: clamp(14px, 2vw, 24px);
    }
    .prototype-topa h1 {
      max-width: none;
      font-size: clamp(28px, 2.8vw, 40px);
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
      min-height: 48px;
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
    .prototype-topa-board {
      grid-template-columns: 1fr;
    }
    .prototype-topa-side {
      position: static;
    }
    .prototype-topa-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
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
    .shell.shell-bleed.prototype-shell { padding-top: 18px; }
    .prototype-topa { padding-top: 12px; }
    .prototype-topa h1 { font-size: 30px; white-space: normal; }
    .prototype-topa p { font-size: 14px; line-height: 1.55; }
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
    .prototype-topa-metrics { gap: 8px; }
    .prototype-topa-metrics span { min-height: 32px; flex-direction: row; gap: 5px; }
    .prototype-topa-metrics strong { font-size: 15px; }
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
    .prototype-feed-row { grid-template-columns: 46px minmax(0, 1fr); }
    .prototype-feed-row em { grid-column: 2; }
    .prototype-feed-row img,
    .prototype-feed-thumb { width: 46px; height: 46px; }
  }
`;
