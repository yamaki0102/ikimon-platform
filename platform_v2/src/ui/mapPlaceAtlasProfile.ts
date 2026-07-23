import type { SiteLang } from "../i18n.js";
import type { PlaceAtlasProfile } from "../services/placeAtlasContract.js";

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
  next: string;
  record: string;
  browseRecords: string;
  privacy: string;
  privacySuppressed: string;
  loading: string;
  errorTitle: string;
  errorBody: string;
  emptyTitle: string;
  emptyBody: string;
  unknown: string;
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
    next: "これから記録できること",
    record: "この場所で記録する",
    browseRecords: "公開記録を見る",
    privacy: "公開位置を保護したRecordだけを集計しています。正確な位置や個人情報は表示しません。",
    privacySuppressed: "公開条件と安全基準により、一部の情報を表示していません。",
    loading: "この場所の地域図鑑を読み込んでいます",
    errorTitle: "地域図鑑を読み込めませんでした",
    errorBody: "地図はそのまま利用できます。時間をおいて場所を選び直してください。",
    emptyTitle: "この場所の図鑑はこれから",
    emptyBody: "公開できるRecordがまだ十分でないか、安全のため詳細を控えています。",
    unknown: "未確認",
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
    next: "What can be recorded next",
    record: "Record at this place",
    browseRecords: "Browse public records",
    privacy: "Only privacy-safe public records are aggregated. Exact locations and identities are not shown.",
    privacySuppressed: "Some information is withheld under publication and safety rules.",
    loading: "Loading this place atlas",
    errorTitle: "The place atlas could not be loaded",
    errorBody: "The map still works. Try selecting the place again later.",
    emptyTitle: "This place atlas is just beginning",
    emptyBody: "There are not enough publishable records yet, or details are withheld for safety.",
    unknown: "Unknown",
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
    next: "Qué registrar después",
    record: "Registrar en este lugar",
    browseRecords: "Ver registros públicos",
    privacy: "Solo agregamos registros públicos protegidos. No mostramos ubicaciones exactas ni identidades.",
    privacySuppressed: "Parte de la información se oculta por normas de publicación y seguridad.",
    loading: "Cargando el atlas del lugar",
    errorTitle: "No se pudo cargar el atlas",
    errorBody: "El mapa sigue disponible. Vuelve a seleccionar el lugar más tarde.",
    emptyTitle: "Este atlas apenas comienza",
    emptyBody: "Aún no hay suficientes registros publicables o se ocultan detalles por seguridad.",
    unknown: "Sin confirmar",
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
    next: "O que registrar depois",
    record: "Registrar neste lugar",
    browseRecords: "Ver registros públicos",
    privacy: "Somente registros públicos protegidos são agregados. Localizações exatas e identidades não aparecem.",
    privacySuppressed: "Algumas informações ficam ocultas pelas regras de publicação e segurança.",
    loading: "Carregando o atlas deste lugar",
    errorTitle: "Não foi possível carregar o atlas",
    errorBody: "O mapa continua disponível. Selecione o lugar novamente mais tarde.",
    emptyTitle: "Este atlas está só começando",
    emptyBody: "Ainda não há registros publicáveis suficientes ou os detalhes estão ocultos por segurança.",
    unknown: "Não confirmado",
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

function atlasSafeImageUrl(value: unknown, width: 360 | 680): string {
  if (typeof value !== "string") return "";
  const url = value.trim();
  if (!url || url.startsWith("//") || /[\u0000-\u001f\u007f]/.test(url)) return "";
  if (url.startsWith("/derived/")) {
    return `/derived-transform/w${width}/${url.replace(/^\/+/, "")}`;
  }
  if (url.startsWith("/")) return url;
  try {
    const parsed = new URL(url);
    const allowedHost = parsed.hostname === "ikimon.life" || parsed.hostname.endsWith(".ikimon.life");
    return parsed.protocol === "https:" && allowedHost ? parsed.toString() : "";
  } catch {
    return "";
  }
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

function renderAtlasImage(url: string, alt: string, width: 360 | 680, className: string): string {
  const src = atlasSafeImageUrl(url, width);
  if (!src) return "";
  return `<figure class="${className}"><img src="${atlasEscapeHtml(src)}" alt="${atlasEscapeHtml(alt)}" width="${width}" height="${width === 680 ? 420 : 240}" loading="lazy" decoding="async" data-place-atlas-image /></figure>`;
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
    return `<article class="me-place-atlas-facet is-${atlasEscapeHtml(key)}">${imageUrl
      ? `<img src="${atlasEscapeHtml(imageUrl)}" alt="" width="360" height="240" loading="lazy" decoding="async" data-place-atlas-image />`
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
    const image = renderAtlasImage(String(record.mediaUrl ?? ""), String(label), 360, "me-place-atlas-record-media");
    const status = record.identificationStatus === "ai_candidate"
      ? "AI candidate"
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
      `<li>${atlasEscapeHtml(facility.label || facility.kind || copy.unknown)}</li>`
    ).join("")}</ul></section>`);
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
  const publication = atlasPlainObject(profile.publication) ?? {};
  const suppressedSections = atlasArray(publication.suppressedSections).map(String);
  const recordAllowed = !suppressedSections.includes("contribution_cta") &&
    !suppressedSections.includes("direct_record_cta");
  const recordHref = atlasSafeHref(options.recordHref, "/record");
  const recordsHref = atlasSafeHref(options.recordsHref, "/records");
  return `<section class="me-place-atlas-actions" aria-label="${atlasEscapeHtml(copy.record)}">${recordAllowed
    ? `<a class="me-place-atlas-primary" href="${atlasEscapeHtml(recordHref)}" data-kpi-event="selected_place_cta_click" data-kpi-action="map:place_atlas:record_here" data-kpi-funnel="map_selected_place" data-kpi-target="${atlasEscapeHtml(recordHref)}">${atlasEscapeHtml(copy.record)}</a>`
    : ""}<a class="me-place-atlas-secondary" href="${atlasEscapeHtml(recordsHref)}" data-kpi-event="selected_place_cta_click" data-kpi-action="map:place_atlas:browse_records" data-kpi-funnel="map_selected_place" data-kpi-target="${atlasEscapeHtml(recordsHref)}">${atlasEscapeHtml(copy.browseRecords)}</a></section>`;
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
    ? renderAtlasImage(String(representative.url ?? ""), String(name), 680, "me-place-atlas-hero-media")
    : "";
  const recordCount = atlasPlainObject(profile.summary)?.recordCount;
  const suppressed = publication.status === "suppressed";
  const empty = recordCount === 0 && atlasArray(profile.facets).length === 0 &&
    !profile.guide && atlasArray(profile.memories).length === 0 &&
    atlasArray(profile.facilities).length === 0;
  const stateNotice = suppressed || empty
    ? `<section class="me-place-atlas-empty" data-place-atlas-state="${suppressed ? "suppressed" : "empty"}"><strong>${atlasEscapeHtml(copy.emptyTitle)}</strong><p>${atlasEscapeHtml(copy.emptyBody)}</p></section>`
    : "";
  return `<article class="me-place-atlas" data-place-atlas-profile data-place-atlas-status="${atlasEscapeHtml(publication.status || "partial")}"><header class="me-place-atlas-hero"><div class="me-place-atlas-hero-copy"><span>${atlasEscapeHtml(copy.eyebrow)}</span><h2>${atlasEscapeHtml(name)}</h2>${description ? `<p>${atlasEscapeHtml(description)}</p>` : ""}<small>${atlasEscapeHtml([locality, type].filter(Boolean).join(" · "))}</small></div>${heroImage}</header>${renderAtlasSummary(profile, copy)}${stateNotice}${renderAtlasHighlights(profile, copy)}${renderAtlasFacets(profile, options.lang, copy)}${renderAtlasRecent(profile, copy)}${renderAtlasRelated(profile, copy)}${renderAtlasGaps(profile, copy)}${renderAtlasActions(profile, options, copy)}<p class="me-place-atlas-privacy">${atlasEscapeHtml(suppressed ? copy.privacySuppressed : copy.privacy)}</p></article>`;
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
      const figure = image.closest("figure");
      if (figure) figure.classList.add("is-image-error");
      image.remove();
    }, { once: true });
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
    display: none;
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
  atlasSafeImageUrl,
  atlasDate,
  atlasPeriod,
  atlasArray,
  atlasPlainObject,
  renderAtlasImage,
  renderAtlasSummary,
  renderAtlasHighlights,
  renderAtlasFacets,
  renderAtlasRecent,
  renderAtlasRelated,
  renderAtlasGaps,
  renderAtlasActions,
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
