import type { SiteLang } from "../i18n.js";
import type { PlaceAtlasProfile } from "../services/placeAtlasContract.js";
import type { PlaceAtlasTimelineProjection } from "../services/placeAtlasTimeline.js";

export type MapPlaceAtlasRenderOptions = {
  lang: SiteLang;
  recordHref: string;
  recordsHref: string;
};

type AtlasCopy = {
  eyebrow: string;
  summaryRecords: string;
  summaryPeriod: string;
  summaryContributors: string;
  highlights: string;
  themes: string;
  recent: string;
  guide: string;
  memories: string;
  facilities: string;
  activities: string;
  stories: string;
  next: string;
  record: string;
  checkRules: string;
  permissionRequired: string;
  prohibited: string;
  policy: string;
  official: string;
  unverified: string;
  imageFallback: string;
  browseRecords: string;
  privacy: string;
  privacySuppressed: string;
  loading: string;
  errorTitle: string;
  errorBody: string;
  emptyTitle: string;
  emptyBody: string;
  unknown: string;
  timeline: string;
  timelineSingle: string;
  timelineMultiple: string;
  timelineSampled: string;
  timelineRecord: string;
  verified: string;
  candidate: string;
};

const ATLAS_COPY: Record<SiteLang, AtlasCopy> = {
  ja: {
    eyebrow: "場所からひらく地域図鑑",
    summaryRecords: "公開Record",
    summaryPeriod: "記録期間",
    summaryContributors: "記録した人",
    highlights: "この場所で見えてきたこと",
    themes: "地域図鑑のテーマ",
    recent: "最近の記録",
    guide: "現地ガイド",
    memories: "この場所の思い出",
    facilities: "場所・施設",
    activities: "出来事・活動",
    stories: "歴史・物語",
    next: "これから記録できること",
    record: "この場所で記録する",
    checkRules: "撮影・記録の前に、施設の案内と現地ルールを確認してください。",
    permissionRequired: "許可された活動だけを記録できます。記録CTAは表示していません。",
    prohibited: "この場所では記録を促しません。",
    policy: "施設ルール・出典",
    official: "公式確認あり",
    unverified: "未確認の場所情報",
    imageFallback: "画像を表示できません",
    browseRecords: "公開記録を見る",
    privacy: "公開位置を保護したRecordだけを集計しています。正確な位置や個人情報は表示しません。",
    privacySuppressed: "公開条件と安全基準により、一部の情報を表示していません。",
    loading: "この場所の地域図鑑を読み込んでいます",
    errorTitle: "地域図鑑を読み込めませんでした",
    errorBody: "地図はそのまま利用できます。時間をおいて場所を選び直してください。",
    emptyTitle: "この場所の図鑑はこれから",
    emptyBody: "公開できるRecordがまだ十分でないか、安全のため詳細を控えています。",
    unknown: "未確認",
    timeline: "この場所のうつろい", timelineSingle: "一時期の記録", timelineMultiple: "複数の時期の記録", timelineSampled: "公開記録からの標本表示", timelineRecord: "今を撮る", verified: "確認済み", candidate: "候補",
  },
  en: {
    eyebrow: "A local atlas led by place",
    summaryRecords: "Public records",
    summaryPeriod: "Record period",
    summaryContributors: "Contributors",
    highlights: "What is emerging here",
    themes: "Atlas themes",
    recent: "Recent records",
    guide: "On-site guide",
    memories: "Place memories",
    facilities: "Place and facilities",
    activities: "Events and activity",
    stories: "History and stories",
    next: "What can be recorded next",
    record: "Record at this place",
    checkRules: "Check the venue guidance and on-site rules before recording.",
    permissionRequired: "Only permitted activities may be recorded. The contribution action is hidden.",
    prohibited: "Recording is not encouraged at this place.",
    policy: "Venue rules and sources",
    official: "Officially verified",
    unverified: "Unverified place information",
    imageFallback: "Image unavailable",
    browseRecords: "Browse public records",
    privacy: "Only privacy-safe public records are aggregated. Exact locations and identities are not shown.",
    privacySuppressed: "Some information is withheld under publication and safety rules.",
    loading: "Loading this place atlas",
    errorTitle: "The place atlas could not be loaded",
    errorBody: "The map still works. Try selecting the place again later.",
    emptyTitle: "This place atlas is just beginning",
    emptyBody: "There are not enough publishable records yet, or details are withheld for safety.",
    unknown: "Unknown",
    timeline: "This place over time", timelineSingle: "Records from one period", timelineMultiple: "Records from multiple periods", timelineSampled: "Sample of public records", timelineRecord: "Capture now", verified: "Verified", candidate: "Candidate",
  },
  es: {
    eyebrow: "Atlas local guiado por el lugar",
    summaryRecords: "Registros públicos",
    summaryPeriod: "Periodo",
    summaryContributors: "Colaboradores",
    highlights: "Lo que aparece aquí",
    themes: "Temas del atlas",
    recent: "Registros recientes",
    guide: "Guía de campo",
    memories: "Memorias del lugar",
    facilities: "Lugar e instalaciones",
    activities: "Eventos y actividades",
    stories: "Historia y relatos",
    next: "Qué registrar después",
    record: "Registrar en este lugar",
    checkRules: "Consulta las indicaciones y reglas del lugar antes de registrar.",
    permissionRequired: "Solo se pueden registrar actividades autorizadas.",
    prohibited: "No se promueve registrar en este lugar.",
    policy: "Reglas y fuentes",
    official: "Verificado oficialmente",
    unverified: "Información sin verificar",
    imageFallback: "Imagen no disponible",
    browseRecords: "Ver registros públicos",
    privacy: "Solo agregamos registros públicos protegidos. No mostramos ubicaciones exactas ni identidades.",
    privacySuppressed: "Parte de la información se oculta por normas de publicación y seguridad.",
    loading: "Cargando el atlas del lugar",
    errorTitle: "No se pudo cargar el atlas",
    errorBody: "El mapa sigue disponible. Vuelve a seleccionar el lugar más tarde.",
    emptyTitle: "Este atlas apenas comienza",
    emptyBody: "Aún no hay suficientes registros publicables o se ocultan detalles por seguridad.",
    unknown: "Sin confirmar",
    timeline: "Este lugar a través del tiempo", timelineSingle: "Registros de un periodo", timelineMultiple: "Registros de varios periodos", timelineSampled: "Muestra de registros públicos", timelineRecord: "Capturar ahora", verified: "Verificado", candidate: "Candidato",
  },
  "pt-BR": {
    eyebrow: "Atlas local guiado pelo lugar",
    summaryRecords: "Registros públicos",
    summaryPeriod: "Período",
    summaryContributors: "Colaboradores",
    highlights: "O que aparece aqui",
    themes: "Temas do atlas",
    recent: "Registros recentes",
    guide: "Guia no local",
    memories: "Memórias do lugar",
    facilities: "Local e instalações",
    activities: "Eventos e atividades",
    stories: "História e relatos",
    next: "O que registrar depois",
    record: "Registrar neste lugar",
    checkRules: "Confira as orientações e regras locais antes de registrar.",
    permissionRequired: "Somente atividades autorizadas podem ser registradas.",
    prohibited: "O registro não é incentivado neste local.",
    policy: "Regras e fontes",
    official: "Verificado oficialmente",
    unverified: "Informação não verificada",
    imageFallback: "Imagem indisponível",
    browseRecords: "Ver registros públicos",
    privacy: "Somente registros públicos protegidos são agregados. Localizações exatas e identidades não aparecem.",
    privacySuppressed: "Algumas informações ficam ocultas pelas regras de publicação e segurança.",
    loading: "Carregando o atlas deste lugar",
    errorTitle: "Não foi possível carregar o atlas",
    errorBody: "O mapa continua disponível. Selecione o lugar novamente mais tarde.",
    emptyTitle: "Este atlas está só começando",
    emptyBody: "Ainda não há registros publicáveis suficientes ou os detalhes estão ocultos por segurança.",
    unknown: "Não confirmado",
    timeline: "Este lugar ao longo do tempo", timelineSingle: "Registros de um período", timelineMultiple: "Registros de vários períodos", timelineSampled: "Amostra de registros públicos", timelineRecord: "Registrar agora", verified: "Verificado", candidate: "Candidato",
  },
};

const FACET_LABELS: Record<SiteLang, Record<string, string>> = {
  ja: {
    nature: "自然・生きもの",
    scenery: "風景・季節",
    daily_life: "過ごし方",
    facility: "場所・施設",
    activity: "出来事・活動",
    history: "歴史・物語",
    audio_visual: "音・映像",
    insight: "気づき",
    unclassified: "未分類",
  },
  en: {
    nature: "Nature and life",
    scenery: "Scenery and seasons",
    daily_life: "Ways to spend time",
    facility: "Place and facilities",
    activity: "Events and activity",
    history: "History and stories",
    audio_visual: "Audio and video",
    insight: "Insights",
    unclassified: "Unclassified",
  },
  es: {
    nature: "Naturaleza y vida",
    scenery: "Paisaje y estaciones",
    daily_life: "Cómo pasar el tiempo",
    facility: "Lugar e instalaciones",
    activity: "Eventos y actividades",
    history: "Historia y relatos",
    audio_visual: "Audio y vídeo",
    insight: "Hallazgos",
    unclassified: "Sin clasificar",
  },
  "pt-BR": {
    nature: "Natureza e vida",
    scenery: "Paisagem e estações",
    daily_life: "Formas de aproveitar",
    facility: "Local e instalações",
    activity: "Eventos e atividades",
    history: "História e relatos",
    audio_visual: "Áudio e vídeo",
    insight: "Percepções",
    unclassified: "Sem classificação",
  },
};

function atlasEscapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function atlasSafeHref(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const href = value.trim();
  if (!href || href.startsWith("//") || /[\u0000-\u001f\u007f]/.test(href)) return fallback;
  if (href.startsWith("/")) return href;
  return fallback;
}

function atlasSafeExternalHref(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

type AtlasImageWidth = 360 | 680 | 1020 | 1360;

function atlasSafeImageUrl(value: unknown, width: AtlasImageWidth): string {
  if (typeof value !== "string") return "";
  const url = value.trim();
  if (!url || url.startsWith("//") || /[\u0000-\u001f\u007f\\]/.test(url)) return "";
  const path = url.split(/[?#]/, 1)[0] ?? "";
  let decodedPath = "";
  try {
    decodedPath = decodeURIComponent(path);
  } catch {
    return "";
  }
  if (/(?:^|\/)\.\.(?:\/|$)/.test(decodedPath)) return "";
  const allowedLocalPath = [
    "/derived/",
    "/derived-transform/",
    "/thumb/",
    "/uploads/",
    "/data/uploads/",
  ].some((prefix) => decodedPath.startsWith(prefix));
  if (decodedPath.startsWith("/derived/")) {
    return `/derived-transform/w${width}/${url.replace(/^\/+/, "")}`;
  }
  if (url.startsWith("/")) return allowedLocalPath ? url : "";
  try {
    const parsed = new URL(url);
    const allowedHost = parsed.hostname === "zukan.earth" || parsed.hostname.endsWith(".zukan.earth") || parsed.hostname === "ikimon.life" || parsed.hostname.endsWith(".ikimon.life");
    return parsed.protocol === "https:" && allowedHost ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function atlasResponsiveImageSrcset(value: unknown): string {
  if (typeof value !== "string") return "";
  const url = value.trim();
  if (!url.startsWith("/derived/")) return "";
  return ([360, 680, 1020, 1360] as const)
    .map((width) => `${atlasSafeImageUrl(url, width)} ${width}w`)
    .join(", ");
}

function atlasDate(value: unknown): string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)
    ? value.slice(0, 10)
    : "";
}

function atlasPeriod(first: unknown, latest: unknown, unknownLabel: string): string {
  const firstDate = atlasDate(first);
  const latestDate = atlasDate(latest);
  if (!firstDate && !latestDate) return unknownLabel;
  if (!firstDate || firstDate === latestDate) return latestDate || firstDate;
  return `${firstDate} – ${latestDate}`;
}

function atlasArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function atlasPlainObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function renderAtlasImage(
  url: string,
  alt: string,
  width: 360 | 680,
  className: string,
  fallbackLabel = "Image unavailable",
): string {
  const src = atlasSafeImageUrl(url, width);
  if (!src) return "";
  const srcset = atlasResponsiveImageSrcset(url);
  const responsiveAttrs = srcset
    ? ` srcset="${atlasEscapeHtml(srcset)}" sizes="${width === 680 ? "(max-width: 767px) 100vw, 680px" : "(max-width: 767px) 44vw, 360px"}"`
    : "";
  return `<figure class="${className}"><img src="${atlasEscapeHtml(src)}"${responsiveAttrs} alt="${atlasEscapeHtml(alt)}" width="${width}" height="${width === 680 ? 420 : 240}" loading="lazy" decoding="async" data-place-atlas-image data-fallback-label="${atlasEscapeHtml(fallbackLabel)}" /><span class="me-place-atlas-image-fallback" aria-live="polite">${atlasEscapeHtml(fallbackLabel)}</span></figure>`;
}

function renderAtlasSummary(profile: Record<string, unknown>, copy: AtlasCopy): string {
  const summary = atlasPlainObject(profile.summary) ?? {};
  const recordCount = typeof summary.recordCount === "number" ? summary.recordCount : null;
  const contributorCount = typeof summary.contributorCount === "number" ? summary.contributorCount : null;
  const cards = [
    recordCount === null ? "" : `<div><span>${atlasEscapeHtml(copy.summaryRecords)}</span><strong>${recordCount}</strong></div>`,
    `<div><span>${atlasEscapeHtml(copy.summaryPeriod)}</span><strong>${atlasEscapeHtml(atlasPeriod(summary.firstRecordedAt, summary.latestRecordedAt, copy.unknown))}</strong></div>`,
    contributorCount === null ? "" : `<div><span>${atlasEscapeHtml(copy.summaryContributors)}</span><strong>${contributorCount}</strong></div>`,
  ].filter(Boolean);
  return cards.length > 0
    ? `<section class="me-place-atlas-summary" aria-label="${atlasEscapeHtml(copy.summaryRecords)}">${cards.join("")}</section>`
    : "";
}

function renderAtlasHighlights(profile: Record<string, unknown>, copy: AtlasCopy): string {
  const items = atlasArray(profile.highlights)
    .map(atlasPlainObject)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .filter((item) => typeof item.text === "string" && item.text.trim() !== "")
    .slice(0, 3);
  if (items.length === 0) return "";
  return `<section class="me-place-atlas-section me-place-atlas-highlights"><h3>${atlasEscapeHtml(copy.highlights)}</h3><ul>${items.map((item) =>
    `<li><span aria-hidden="true">✦</span><strong>${atlasEscapeHtml(item.text)}</strong><small>${atlasEscapeHtml(item.sourceLabel)}${typeof item.evidenceCount === "number" ? ` · ${item.evidenceCount}` : ""}</small></li>`
  ).join("")}</ul></section>`;
}

function atlasTimelineStatusLabel(value: unknown, copy: AtlasCopy): string {
  return value === "verified" ? copy.verified : value === "candidate" ? copy.candidate : copy.unverified;
}

function atlasCanRecordAtPlace(profile: Record<string, unknown>): boolean {
  const publication = atlasPlainObject(profile.publication) ?? {};
  const policy = atlasPlainObject(profile.policy) ?? {};
  const suppressedSections = atlasArray(publication.suppressedSections).map(String);
  return policy.recordingPolicy === "allowed"
    && policy.contributionCtaMode === "record"
    && !suppressedSections.includes("contribution_cta")
    && !suppressedSections.includes("direct_record_cta");
}

function atlasTimelineHasRecordCta(profile: Record<string, unknown>): boolean {
  const projection = atlasPlainObject(profile.timelineProjection);
  const publication = atlasPlainObject(profile.publication) ?? {};
  return Boolean(
    projection
    && (projection.state === "single_period" || projection.state === "timeline")
    && atlasArray(projection.periods).length > 0
    && projection.recordingSuggestion === "revisit"
    && projection.publicationStatus !== "suppressed"
    && publication.status !== "suppressed"
    && atlasCanRecordAtPlace(profile),
  );
}

function renderAtlasTimeline(
  profile: Record<string, unknown>,
  options: MapPlaceAtlasRenderOptions,
  copy: AtlasCopy,
): string {
  const projection = atlasPlainObject(profile.timelineProjection) as (Record<string, unknown> & Partial<PlaceAtlasTimelineProjection>) | null;
  const publication = atlasPlainObject(profile.publication) ?? {};
  if (
    !projection
    || publication.status === "suppressed"
    || projection.publicationStatus === "suppressed"
    || (projection.state !== "single_period" && projection.state !== "timeline")
  ) return "";
  const periods = atlasArray(projection.periods)
    .map(atlasPlainObject)
    .filter((period): period is Record<string, unknown> => Boolean(period));
  if (periods.length === 0) return "";
  const showCta = atlasTimelineHasRecordCta(profile);
  const periodHtml = periods.map((period) => {
    const items = atlasArray(period.items).map(atlasPlainObject)
      .filter((item): item is Record<string, unknown> => Boolean(item));
    return `<li class="me-place-atlas-timeline-period"><time>${atlasEscapeHtml(atlasDate(period.observedDate))}</time><div>${items.map((item) => {
      const label = typeof item.displayLabel === "string" && item.displayLabel.trim() ? item.displayLabel : copy.unknown;
      const image = renderAtlasImage(String(item.publicMediaUrl ?? ""), label, 360, "me-place-atlas-timeline-media", copy.imageFallback);
      const body = `${image}<span><strong>${atlasEscapeHtml(label)}</strong><small>${atlasEscapeHtml(atlasTimelineStatusLabel(item.verificationState, copy))}</small></span>`;
      const href = atlasSafeHref(item.href);
      return href ? `<a class="me-place-atlas-timeline-item" href="${atlasEscapeHtml(href)}">${body}</a>` : `<article class="me-place-atlas-timeline-item">${body}</article>`;
    }).join("")}</div></li>`;
  }).join("");
  const recordHref = atlasSafeHref(options.recordHref, "/record");
  return `<section class="me-place-atlas-section me-place-atlas-timeline"><h3>${atlasEscapeHtml(copy.timeline)}</h3><p>${atlasEscapeHtml(projection.state === "single_period" ? copy.timelineSingle : copy.timelineMultiple)}</p>${projection.sampled === true ? `<small class="me-place-atlas-timeline-sampled">${atlasEscapeHtml(copy.timelineSampled)}</small>` : ""}<ol>${periodHtml}</ol>${showCta ? `<a class="me-place-atlas-timeline-cta" href="${atlasEscapeHtml(recordHref)}" data-place-primary-action data-kpi-event="selected_place_cta_click" data-kpi-action="map:place_atlas:timeline_revisit" data-kpi-funnel="map_selected_place" data-kpi-target="${atlasEscapeHtml(recordHref)}">${atlasEscapeHtml(copy.timelineRecord)}</a>` : ""}</section>`;
}

function renderAtlasFacets(profile: Record<string, unknown>, lang: SiteLang, copy: AtlasCopy): string {
  const items = atlasArray(profile.facets)
    .map(atlasPlainObject)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .filter((item) => typeof item.key === "string" && item.key !== "unclassified")
    .slice(0, 7);
  if (items.length === 0) return "";
  const labels = FACET_LABELS[lang] ?? FACET_LABELS.ja;
  return `<section class="me-place-atlas-section me-place-atlas-facets"><h3>${atlasEscapeHtml(copy.themes)}</h3><div class="me-place-atlas-facet-grid">${items.map((item) => {
    const key = String(item.key);
    const label = labels[key] ?? item.label ?? key;
    const imageUrl = atlasSafeImageUrl(item.representativeMediaUrl, 360);
    const imageSrcset = atlasResponsiveImageSrcset(item.representativeMediaUrl);
    return `<article class="me-place-atlas-facet is-${atlasEscapeHtml(key)}" data-place-atlas-theme="${atlasEscapeHtml(key)}" role="button" tabindex="0" aria-pressed="false">${imageUrl
      ? `<img src="${atlasEscapeHtml(imageUrl)}"${imageSrcset ? ` srcset="${atlasEscapeHtml(imageSrcset)}" sizes="(max-width: 767px) 44vw, 360px"` : ""} alt="" width="360" height="240" loading="lazy" decoding="async" data-place-atlas-image />`
      : ""}<div><strong>${atlasEscapeHtml(label)}</strong>${typeof item.count === "number" ? `<span>${item.count}</span>` : ""}</div></article>`;
  }).join("")}</div></section>`;
}

function renderAtlasRecent(profile: Record<string, unknown>, copy: AtlasCopy): string {
  const records = atlasArray(profile.recentRecords)
    .map(atlasPlainObject)
    .filter((record): record is Record<string, unknown> => Boolean(record))
    .slice(0, 8);
  if (records.length === 0) return "";
  return `<section class="me-place-atlas-section me-place-atlas-recent"><h3>${atlasEscapeHtml(copy.recent)}</h3><div class="me-place-atlas-record-grid">${records.map((record) => {
    const href = atlasSafeHref(record.href);
    const label = typeof record.displayName === "string" && record.displayName.trim()
      ? record.displayName
      : copy.unknown;
    const image = renderAtlasImage(String(record.mediaUrl ?? ""), String(label), 360, "me-place-atlas-record-media", copy.imageFallback);
    const status = record.identificationStatus === "ai_candidate"
      ? copy.candidate
      : record.identificationStatus === "awaiting_identification"
        ? copy.unknown
        : "";
    const body = `${image}<div><strong>${atlasEscapeHtml(label)}</strong><small>${atlasEscapeHtml(atlasDate(record.observedAt))}${status ? ` · ${atlasEscapeHtml(status)}` : ""}</small></div>`;
    return href
      ? `<a class="me-place-atlas-record" href="${atlasEscapeHtml(href)}" data-kpi-event="selected_place_cta_click" data-kpi-action="map:place_atlas:record" data-kpi-funnel="map_selected_place" data-kpi-target="${atlasEscapeHtml(href)}">${body}</a>`
      : `<article class="me-place-atlas-record">${body}</article>`;
  }).join("")}</div></section>`;
}

function renderAtlasRelated(profile: Record<string, unknown>, copy: AtlasCopy): string {
  const guide = atlasPlainObject(profile.guide);
  const memories = atlasArray(profile.memories)
    .map(atlasPlainObject)
    .filter((memory): memory is Record<string, unknown> => Boolean(memory))
    .slice(0, 6);
  const facilities = atlasArray(profile.facilities)
    .map(atlasPlainObject)
    .filter((facility): facility is Record<string, unknown> => Boolean(facility))
    .slice(0, 8);
  const activities = atlasArray(profile.activities)
    .map(atlasPlainObject)
    .filter((activity): activity is Record<string, unknown> => Boolean(activity))
    .slice(0, 8);
  const stories = atlasArray(profile.stories)
    .map(atlasPlainObject)
    .filter((story): story is Record<string, unknown> => Boolean(story))
    .slice(0, 8);
  const sections: string[] = [];
  if (guide) {
    const sourceLinks = atlasArray(guide.sourceLinks)
      .map(atlasPlainObject)
      .filter((source): source is Record<string, unknown> =>
        Boolean(source && typeof source.url === "string" && source.url.startsWith("https://"))
      )
      .slice(0, 3);
    sections.push(`<section class="me-place-atlas-related-card"><h3>${atlasEscapeHtml(copy.guide)}</h3><strong>${atlasEscapeHtml(guide.title)}</strong>${guide.preview ? `<p>${atlasEscapeHtml(guide.preview)}</p>` : ""}${sourceLinks.map((source) =>
      `<a href="${atlasEscapeHtml(source.url)}" target="_blank" rel="noopener">${atlasEscapeHtml(source.label)} ↗</a>`
    ).join("")}</section>`);
  }
  if (memories.length > 0) {
    sections.push(`<section class="me-place-atlas-related-card"><h3>${atlasEscapeHtml(copy.memories)}</h3><ul>${memories.map((memory) =>
      `<li>${atlasEscapeHtml(memory.echoNote || atlasArray(memory.tags).join(" · ") || copy.unknown)}</li>`
    ).join("")}</ul></section>`);
  }
  if (facilities.length > 0) {
    sections.push(`<section class="me-place-atlas-related-card"><h3>${atlasEscapeHtml(copy.facilities)}</h3><ul>${facilities.map((facility) =>
      `<li>${atlasEscapeHtml(facility.label || facility.kind || copy.unknown)}${facility.lastCheckedAt ? `<small>${atlasEscapeHtml(atlasDate(facility.lastCheckedAt))}</small>` : ""}</li>`
    ).join("")}</ul></section>`);
  }
  if (activities.length > 0) {
    sections.push(`<section class="me-place-atlas-related-card"><h3>${atlasEscapeHtml(copy.activities)}</h3><ul>${activities.map((activity) => {
      const source = atlasPlainObject(activity.source);
      const sourceUrl = atlasSafeExternalHref(source?.url);
      return `<li><strong>${atlasEscapeHtml(activity.title || copy.unknown)}</strong>${activity.temporalState ? `<small>${atlasEscapeHtml(activity.temporalState)}</small>` : ""}${sourceUrl ? `<a href="${atlasEscapeHtml(sourceUrl)}" target="_blank" rel="noopener">source ↗</a>` : ""}</li>`;
    }).join("")}</ul></section>`);
  }
  if (stories.length > 0) {
    sections.push(`<section class="me-place-atlas-related-card"><h3>${atlasEscapeHtml(copy.stories)}</h3><ul>${stories.map((story) => {
      const source = atlasPlainObject(story.source);
      const sourceUrl = atlasSafeExternalHref(source?.url);
      return `<li><strong>${atlasEscapeHtml(story.title || copy.unknown)}</strong>${story.body ? `<span>${atlasEscapeHtml(story.body)}</span>` : ""}${sourceUrl ? `<a href="${atlasEscapeHtml(sourceUrl)}" target="_blank" rel="noopener">source ↗</a>` : ""}</li>`;
    }).join("")}</ul></section>`);
  }
  return sections.length > 0
    ? `<div class="me-place-atlas-related">${sections.join("")}</div>`
    : "";
}

function renderAtlasGaps(profile: Record<string, unknown>, copy: AtlasCopy): string {
  const gaps = atlasArray(profile.dataGaps)
    .map(atlasPlainObject)
    .filter((gap): gap is Record<string, unknown> => Boolean(gap))
    .filter((gap) => typeof gap.reason === "string" && gap.reason.trim() !== "")
    .slice(0, 5);
  if (gaps.length === 0) return "";
  return `<section class="me-place-atlas-section me-place-atlas-gaps"><h3>${atlasEscapeHtml(copy.next)}</h3><ul>${gaps.map((gap) =>
    `<li><strong>${atlasEscapeHtml(gap.label)}</strong><span>${atlasEscapeHtml(gap.reason)}</span></li>`
  ).join("")}</ul></section>`;
}

function renderAtlasActions(
  profile: Record<string, unknown>,
  options: MapPlaceAtlasRenderOptions,
  copy: AtlasCopy,
): string {
  const policy = atlasPlainObject(profile.policy) ?? {};
  const recordingPolicy = String(policy.recordingPolicy ?? "unknown");
  const contributionCtaMode = String(policy.contributionCtaMode ?? "check_rules");
  const recordAllowed = atlasCanRecordAtPlace(profile);
  const timelineOwnsPrimaryAction = atlasTimelineHasRecordCta(profile);
  const policyMessage = recordingPolicy === "prohibited"
    ? copy.prohibited
    : recordingPolicy === "permission_required" || contributionCtaMode === "suppressed"
      ? copy.permissionRequired
      : copy.checkRules;
  const recordHref = atlasSafeHref(options.recordHref, "/record");
  const recordsHref = atlasSafeHref(options.recordsHref, "/records");
  const primaryAction = recordAllowed
    ? timelineOwnsPrimaryAction
      ? ""
      : `<a class="me-place-atlas-primary" href="${atlasEscapeHtml(recordHref)}" data-place-primary-action data-kpi-event="selected_place_cta_click" data-kpi-action="map:place_atlas:record_here" data-kpi-funnel="map_selected_place" data-kpi-target="${atlasEscapeHtml(recordHref)}">${atlasEscapeHtml(copy.timelineRecord)}</a>`
    : `<p class="me-place-atlas-policy-notice">${atlasEscapeHtml(policyMessage)}</p>`;
  return `<section class="me-place-atlas-actions" aria-label="${atlasEscapeHtml(copy.record)}">${primaryAction}<a class="me-place-atlas-secondary" href="${atlasEscapeHtml(recordsHref)}" data-kpi-event="selected_place_cta_click" data-kpi-action="map:place_atlas:browse_records" data-kpi-funnel="map_selected_place" data-kpi-target="${atlasEscapeHtml(recordsHref)}">${atlasEscapeHtml(copy.browseRecords)}</a></section>`;
}

function renderAtlasPolicy(
  profile: Record<string, unknown>,
  place: Record<string, unknown>,
  copy: AtlasCopy,
): string {
  const policy = atlasPlainObject(profile.policy) ?? {};
  const verification = String(place.verificationStatus ?? "unverified");
  const official = place.officialStatus === "official" ||
    verification === "administrator_verified" ||
    verification === "source_verified";
  const ruleUrl = atlasSafeExternalHref(policy.ruleUrl);
  const source = String(policy.ruleSource ?? "default");
  const status = official ? copy.official : copy.unverified;
  return `<section class="me-place-atlas-policy"><h3>${atlasEscapeHtml(copy.policy)}</h3><p><strong>${atlasEscapeHtml(status)}</strong><span>${atlasEscapeHtml(source)}</span></p>${ruleUrl
    ? `<a href="${atlasEscapeHtml(ruleUrl)}" target="_blank" rel="noopener noreferrer">公式ルール ↗</a>`
    : ""}</section>`;
}

export function renderMapPlaceAtlasProfile(
  profileValue: PlaceAtlasProfile | Record<string, unknown>,
  options: MapPlaceAtlasRenderOptions,
): string {
  const profile = atlasPlainObject(profileValue) ?? {};
  const copy = ATLAS_COPY[options.lang] ?? ATLAS_COPY.ja;
  const place = atlasPlainObject(profile.place) ?? {};
  const publication = atlasPlainObject(profile.publication) ?? {};
  const representative = atlasArray(place.representativeMedia)
    .map(atlasPlainObject)
    .find((media) => media && atlasSafeImageUrl(media.url, 680));
  const name = typeof place.name === "string" && place.name.trim() ? place.name : copy.unknown;
  const type = typeof place.type === "string" ? place.type : "place";
  const locality = typeof place.localityLabel === "string" ? place.localityLabel : "";
  const description = typeof place.description === "string" ? place.description : "";
  const heroImage = representative
    ? renderAtlasImage(String(representative.url ?? ""), String(name), 680, "me-place-atlas-hero-media", copy.imageFallback)
    : "";
  const recordCount = atlasPlainObject(profile.summary)?.recordCount;
  const suppressed = publication.status === "suppressed";
  const empty = recordCount === 0 && atlasArray(profile.facets).length === 0 &&
    !profile.guide && atlasArray(profile.memories).length === 0 &&
    atlasArray(profile.facilities).length === 0;
  const stateNotice = suppressed || empty
    ? `<section class="me-place-atlas-empty" data-place-atlas-state="${suppressed ? "suppressed" : "empty"}"><strong>${atlasEscapeHtml(copy.emptyTitle)}</strong><p>${atlasEscapeHtml(copy.emptyBody)}</p></section>`
    : "";
  return `<article class="me-place-atlas" data-place-atlas-profile data-place-atlas-status="${atlasEscapeHtml(publication.status || "partial")}"><header class="me-place-atlas-hero"><div class="me-place-atlas-hero-copy"><span>${atlasEscapeHtml(copy.eyebrow)}</span><h2>${atlasEscapeHtml(name)}</h2>${description ? `<p>${atlasEscapeHtml(description)}</p>` : ""}<small>${atlasEscapeHtml([locality, type].filter(Boolean).join(" · "))}</small></div>${heroImage}</header>${renderAtlasSummary(profile, copy)}${stateNotice}${renderAtlasTimeline(profile, options, copy)}${renderAtlasHighlights(profile, copy)}${renderAtlasFacets(profile, options.lang, copy)}${renderAtlasRecent(profile, copy)}${renderAtlasRelated(profile, copy)}${renderAtlasGaps(profile, copy)}${renderAtlasActions(profile, options, copy)}${renderAtlasPolicy(profile, place, copy)}<p class="me-place-atlas-privacy">${atlasEscapeHtml(suppressed ? copy.privacySuppressed : copy.privacy)}</p></article>`;
}

export function renderMapPlaceAtlasLoading(lang: SiteLang, name = ""): string {
  const copy = ATLAS_COPY[lang] ?? ATLAS_COPY.ja;
  return `<section class="me-place-atlas-state is-loading" data-place-atlas-state="loading" aria-live="polite"><span aria-hidden="true"></span><strong>${atlasEscapeHtml(name || copy.loading)}</strong><p>${atlasEscapeHtml(copy.loading)}</p></section>`;
}

export function renderMapPlaceAtlasError(lang: SiteLang): string {
  const copy = ATLAS_COPY[lang] ?? ATLAS_COPY.ja;
  return `<section class="me-place-atlas-state is-error" data-place-atlas-state="error" role="status"><strong>${atlasEscapeHtml(copy.errorTitle)}</strong><p>${atlasEscapeHtml(copy.errorBody)}</p></section>`;
}

function bindMapPlaceAtlasImages(root: ParentNode | null): void {
  root?.querySelectorAll<HTMLImageElement>("[data-place-atlas-image]").forEach((image) => {
    image.addEventListener("error", () => {
      image.dispatchEvent(new CustomEvent("ikimon:place-atlas-image-error", {
        bubbles: true,
        detail: {
          src: image.currentSrc || image.src || "",
        },
      }));
      const figure = image.closest("figure");
      if (figure) figure.classList.add("is-image-error");
      image.remove();
    }, { once: true });
  });
  root?.querySelectorAll<HTMLElement>("[data-place-atlas-theme]").forEach((card) => {
    const activate = () => {
      const isOpen = card.getAttribute("aria-pressed") === "true";
      card.setAttribute("aria-pressed", isOpen ? "false" : "true");
      card.classList.toggle("is-selected", !isOpen);
      card.dispatchEvent(new CustomEvent("ikimon:place-atlas-theme-open", {
        bubbles: true,
        detail: {
          theme: card.getAttribute("data-place-atlas-theme") || "unknown",
          open: !isOpen,
        },
      }));
    };
    card.addEventListener("click", activate);
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      activate();
    });
  });
}

export const MAP_PLACE_ATLAS_PROFILE_STYLES = `
  .me-place-atlas,
  .me-place-atlas * {
    box-sizing: border-box;
  }
  .me-place-atlas {
    width: 100%;
    min-width: 0;
    color: #17211d;
    overflow-wrap: anywhere;
  }
  .me-place-atlas-facet[role="button"] {
    cursor: pointer;
  }
  .me-place-atlas-facet[role="button"].is-selected {
    outline: 2px solid #276447;
    outline-offset: 2px;
  }
  .me-place-atlas-facet[role="button"]:focus-visible {
    outline: 3px solid #1a6a49;
    outline-offset: 3px;
  }
  .me-place-atlas-hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    margin: 0 0 12px;
    padding: 14px;
    border: 1px solid rgba(27, 94, 67, .15);
    border-radius: 20px;
    background: linear-gradient(145deg, #f4fbf5 0%, #eef7f3 56%, #fff8e7 100%);
    overflow: hidden;
  }
  .me-place-atlas-hero-copy {
    min-width: 0;
  }
  .me-place-atlas-hero-copy > span {
    display: block;
    margin-bottom: 5px;
    color: #276447;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .08em;
  }
  .me-place-atlas-hero h2 {
    margin: 0;
    color: #17211d;
    font-size: clamp(21px, 3vw, 28px);
    line-height: 1.18;
  }
  .me-place-atlas-hero p {
    margin: 8px 0 0;
    color: #42534a;
    font-size: 13px;
    line-height: 1.65;
  }
  .me-place-atlas-hero small {
    display: block;
    margin-top: 8px;
    color: #66756d;
    font-size: 11px;
    font-weight: 700;
  }
  .me-place-atlas-hero-media {
    position: relative;
    width: 100%;
    margin: 0;
    aspect-ratio: 16 / 9;
    border-radius: 14px;
    overflow: hidden;
    background: #dfece4;
  }
  .me-place-atlas-hero-media img,
  .me-place-atlas-facet img,
  .me-place-atlas-record-media img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .me-place-atlas-hero-media.is-image-error,
  .me-place-atlas-record-media.is-image-error {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 96px;
    background: linear-gradient(145deg, #eef4f0, #dfe9e3);
  }
  .me-place-atlas-image-fallback {
    display: none;
    padding: 12px;
    color: #5f7066;
    font-size: 11px;
    font-weight: 800;
    text-align: center;
  }
  .is-image-error > .me-place-atlas-image-fallback {
    display: block;
  }
  .me-place-atlas-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 8px;
    margin: 0 0 16px;
  }
  .me-place-atlas-summary > div {
    min-width: 0;
    padding: 10px 12px;
    border: 1px solid rgba(71, 104, 88, .13);
    border-radius: 14px;
    background: #fff;
  }
  .me-place-atlas-summary span,
  .me-place-atlas-summary strong {
    display: block;
  }
  .me-place-atlas-summary span {
    margin-bottom: 3px;
    color: #6a786f;
    font-size: 10px;
    font-weight: 700;
  }
  .me-place-atlas-summary strong {
    color: #22372d;
    font-size: 14px;
    line-height: 1.35;
  }
  .me-place-atlas-section {
    margin: 18px 0;
  }
  /* Responsive QA contract: 375px, 390px, 768px, 1024px, 1280px, 1536px. */
  .me-place-atlas-timeline > p,
  .me-place-atlas-timeline-sampled {
    display: block;
    margin: 0 0 8px;
    color: #66756d;
    font-size: 11px;
  }
  .me-place-atlas-timeline ol {
    display: grid;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .me-place-atlas-timeline-period {
    min-width: 0;
    border-left: 2px solid #9bbcab;
    padding-left: 10px;
  }
  .me-place-atlas-timeline-period > time {
    display: block;
    margin-bottom: 6px;
    color: #52675b;
    font-size: 11px;
    font-weight: 800;
  }
  .me-place-atlas-timeline-period > div {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr));
    gap: 8px;
    min-width: 0;
  }
  .me-place-atlas-timeline-item {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    min-width: 0;
    overflow: hidden;
    border: 1px solid rgba(83, 112, 96, .14);
    border-radius: 12px;
    color: inherit;
    text-decoration: none;
  }
  .me-place-atlas-timeline-media { margin: 0; aspect-ratio: 1; background: #e7eee9; }
  .me-place-atlas-timeline-media img { width: 100%; height: 100%; object-fit: cover; }
  .me-place-atlas-timeline-item > span { display: grid; align-content: center; gap: 2px; min-width: 0; padding: 7px; }
  .me-place-atlas-timeline-item strong { font-size: 11px; }
  .me-place-atlas-timeline-item small { color: #6a786f; font-size: 10px; }
  .me-place-atlas-timeline-cta { display: inline-flex; align-items: center; justify-content: center; min-height: 56px; margin-top: 10px; padding: 10px 16px; border-radius: 13px; color: #fff !important; background: #236342; font-weight: 900; text-decoration: none; }
  .me-place-atlas-section > h3,
  .me-place-atlas-related-card > h3 {
    margin: 0 0 9px;
    color: #30483b;
    font-size: 13px;
    line-height: 1.4;
  }
  .me-place-atlas-highlights ul,
  .me-place-atlas-gaps ul,
  .me-place-atlas-related-card ul {
    display: grid;
    gap: 7px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .me-place-atlas-highlights li {
    display: grid;
    grid-template-columns: 22px minmax(0, 1fr);
    gap: 2px 8px;
    padding: 10px 12px;
    border-radius: 14px;
    background: #f1f8f3;
  }
  .me-place-atlas-highlights li > span {
    grid-row: 1 / 3;
    color: #bc7d23;
  }
  .me-place-atlas-highlights li strong {
    font-size: 12px;
    line-height: 1.5;
  }
  .me-place-atlas-highlights li small {
    color: #728078;
    font-size: 10px;
  }
  .me-place-atlas-facet-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .me-place-atlas-facet {
    position: relative;
    min-width: 0;
    min-height: 70px;
    border: 1px solid rgba(83, 112, 96, .14);
    border-radius: 14px;
    background: #f7faf8;
    overflow: hidden;
  }
  .me-place-atlas-facet img {
    position: absolute;
    inset: 0;
    opacity: .2;
  }
  .me-place-atlas-facet > div {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 8px;
    min-height: 70px;
    padding: 11px;
  }
  .me-place-atlas-facet strong {
    font-size: 12px;
    line-height: 1.35;
  }
  .me-place-atlas-facet span {
    flex: 0 0 auto;
    color: #276447;
    font-size: 12px;
    font-weight: 900;
  }
  .me-place-atlas-record-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 9px;
  }
  .me-place-atlas-record {
    display: block;
    min-width: 0;
    border: 1px solid rgba(83, 112, 96, .14);
    border-radius: 14px;
    color: inherit;
    background: #fff;
    text-decoration: none;
    overflow: hidden;
  }
  .me-place-atlas-record-media {
    width: 100%;
    margin: 0;
    aspect-ratio: 3 / 2;
    background: #e7eee9;
  }
  .me-place-atlas-record > div {
    display: grid;
    gap: 3px;
    padding: 9px 10px 11px;
  }
  .me-place-atlas-record strong {
    font-size: 12px;
    line-height: 1.35;
  }
  .me-place-atlas-record small {
    color: #748078;
    font-size: 10px;
  }
  .me-place-atlas-related {
    display: grid;
    gap: 9px;
    margin: 18px 0;
  }
  .me-place-atlas-related-card {
    padding: 12px;
    border: 1px solid rgba(83, 112, 96, .14);
    border-radius: 15px;
    background: #fcfdfc;
  }
  .me-place-atlas-related-card > strong {
    display: block;
    font-size: 13px;
  }
  .me-place-atlas-related-card p,
  .me-place-atlas-related-card li {
    margin: 6px 0 0;
    color: #54645b;
    font-size: 11px;
    line-height: 1.55;
  }
  .me-place-atlas-related-card a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: #276447;
    font-size: 11px;
    font-weight: 800;
  }
  .me-place-atlas-gaps li {
    display: grid;
    gap: 3px;
    padding: 9px 11px;
    border-left: 3px solid #d5a64a;
    border-radius: 0 10px 10px 0;
    background: #fffaf0;
  }
  .me-place-atlas-gaps strong {
    font-size: 11px;
  }
  .me-place-atlas-gaps span {
    color: #6e6451;
    font-size: 10px;
    line-height: 1.5;
  }
  .me-place-atlas-empty,
  .me-place-atlas-state {
    margin: 12px 0;
    padding: 14px;
    border: 1px dashed rgba(83, 112, 96, .28);
    border-radius: 15px;
    background: #f8fbf9;
  }
  .me-place-atlas-empty strong,
  .me-place-atlas-state strong {
    display: block;
    font-size: 13px;
  }
  .me-place-atlas-empty p,
  .me-place-atlas-state p {
    margin: 5px 0 0;
    color: #657269;
    font-size: 11px;
    line-height: 1.55;
  }
  .me-place-atlas-state.is-loading > span {
    display: block;
    width: 28px;
    height: 4px;
    margin-bottom: 10px;
    border-radius: 99px;
    background: #4c8a68;
    animation: me-place-atlas-pulse 1.2s ease-in-out infinite alternate;
  }
  .me-place-atlas-state.is-error {
    border-color: rgba(180, 83, 68, .25);
    background: #fff8f6;
  }
  .me-place-atlas-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 18px 0 12px;
  }
  .me-place-atlas-actions a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 46px;
    padding: 10px 14px;
    border-radius: 13px;
    font-size: 12px;
    font-weight: 900;
    text-align: center;
    text-decoration: none;
  }
  .me-place-atlas-policy-notice {
    flex: 1 1 100%;
    margin: 0;
    padding: 11px 12px;
    border: 1px solid rgba(180, 83, 9, .2);
    border-radius: 12px;
    color: #7c3d12;
    background: #fff8ed;
    font-size: 11px;
    line-height: 1.6;
  }
  .me-place-atlas-primary {
    flex: 1 1 170px;
    color: #fff !important;
    background: #236342;
  }
  .me-place-atlas-secondary {
    flex: 1 1 140px;
    border: 1px solid rgba(35, 99, 66, .24);
    color: #236342 !important;
    background: #fff;
  }
  .me-place-atlas a:focus-visible {
    outline: 3px solid #f5b842;
    outline-offset: 2px;
  }
  .me-place-atlas-policy {
    margin: 0 0 10px;
    padding: 12px;
    border: 1px solid rgba(71, 104, 88, .14);
    border-radius: 13px;
    background: #fff;
  }
  .me-place-atlas-policy h3 {
    margin: 0 0 7px;
    color: #24342c;
    font-size: 12px;
  }
  .me-place-atlas-policy p {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 10px;
    margin: 0;
    color: #5d6c64;
    font-size: 10px;
  }
  .me-place-atlas-policy a {
    display: inline-flex;
    margin-top: 8px;
    color: #236342;
    font-size: 10px;
    font-weight: 850;
  }
  .me-place-atlas-privacy {
    margin: 0;
    padding: 10px 11px;
    border-radius: 12px;
    color: #66736b;
    background: #f2f5f3;
    font-size: 10px;
    line-height: 1.55;
  }
  @keyframes me-place-atlas-pulse {
    from { opacity: .35; transform: scaleX(.55); transform-origin: left; }
    to { opacity: 1; transform: scaleX(1); transform-origin: left; }
  }
  @media (min-width: 1280px) {
    .me-place-atlas-hero {
      grid-template-columns: minmax(0, 1fr) minmax(120px, .72fr);
      align-items: stretch;
    }
    .me-place-atlas-hero-media {
      min-height: 140px;
      aspect-ratio: auto;
    }
  }
  @media (max-width: 900px) {
    .me-place-atlas-hero {
      padding: 12px;
    }
    .me-bottom-sheet--area[data-snap="peek"] .me-place-atlas-section,
    .me-bottom-sheet--area[data-snap="peek"] .me-place-atlas-related,
    .me-bottom-sheet--area[data-snap="peek"] .me-place-atlas-gaps,
    .me-bottom-sheet--area[data-snap="peek"] .me-place-atlas-privacy {
      display: none;
    }
    .me-bottom-sheet--area[data-snap="peek"] .me-place-atlas-hero {
      grid-template-columns: minmax(0, 1fr) 100px;
      align-items: stretch;
    }
    .me-bottom-sheet--area[data-snap="peek"] .me-place-atlas-hero-media {
      min-height: 92px;
      aspect-ratio: auto;
    }
    .me-bottom-sheet--area[data-snap="peek"] .me-place-atlas-hero p,
    .me-bottom-sheet--area[data-snap="peek"] .me-place-atlas-hero small {
      display: none;
    }
    .me-bottom-sheet--area[data-snap="peek"] .me-place-atlas-summary {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-bottom: 10px;
    }
    .me-bottom-sheet--area[data-snap="peek"] .me-place-atlas-summary > div:nth-child(n+3),
    .me-bottom-sheet--area[data-snap="peek"] .me-place-atlas-secondary {
      display: none;
    }
  }
  @media (max-width: 420px) {
    .me-place-atlas-record-grid,
    .me-place-atlas-facet-grid {
      grid-template-columns: minmax(0, 1fr);
    }
    .me-bottom-sheet--area[data-snap="peek"] .me-place-atlas-hero {
      grid-template-columns: minmax(0, 1fr) 88px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .me-place-atlas-state.is-loading > span {
      animation: none;
    }
    .me-place-atlas * {
      scroll-behavior: auto !important;
      transition-duration: .01ms !important;
    }
  }
`;

const MAP_PLACE_ATLAS_RUNTIME_HELPERS = [
  atlasEscapeHtml,
  atlasSafeHref,
  atlasSafeExternalHref,
  atlasSafeImageUrl,
  atlasResponsiveImageSrcset,
  atlasDate,
  atlasPeriod,
  atlasArray,
  atlasPlainObject,
  renderAtlasImage,
  renderAtlasSummary,
  atlasTimelineStatusLabel,
  atlasCanRecordAtPlace,
  atlasTimelineHasRecordCta,
  renderAtlasTimeline,
  renderAtlasHighlights,
  renderAtlasFacets,
  renderAtlasRecent,
  renderAtlasRelated,
  renderAtlasGaps,
  renderAtlasActions,
  renderAtlasPolicy,
  renderMapPlaceAtlasProfile,
  renderMapPlaceAtlasLoading,
  renderMapPlaceAtlasError,
  bindMapPlaceAtlasImages,
];

export const MAP_PLACE_ATLAS_PROFILE_RUNTIME = [
  "var MapPlaceAtlasProfile = (function () {",
  `var ATLAS_COPY = ${JSON.stringify(ATLAS_COPY)};`,
  `var FACET_LABELS = ${JSON.stringify(FACET_LABELS)};`,
  ...MAP_PLACE_ATLAS_RUNTIME_HELPERS.map((helper) => helper.toString()),
  "return {",
  "  render: renderMapPlaceAtlasProfile,",
  "  loading: renderMapPlaceAtlasLoading,",
  "  error: renderMapPlaceAtlasError,",
  "  bind: bindMapPlaceAtlasImages",
  "};",
  "})();",
].join("\n");
