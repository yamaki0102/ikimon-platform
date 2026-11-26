import type { PlaceAtlasProfile } from "../../src/services/placeAtlasContract";
import { APP_EXPERIENCE_STYLES, renderAppExperienceHeader, renderAppExperienceNavigation, renderAppExperienceQuickCamera } from "../../src/ui/appExperience";
import { MAP_PLACE_ATLAS_PROFILE_RUNTIME, MAP_PLACE_ATLAS_PROFILE_STYLES, renderMapPlaceAtlasProfile } from "../../src/ui/mapPlaceAtlasProfile";
import { escapeHtml } from "../../src/ui/siteShell";
import type { SavedItem } from "./savedItems";
import { PLACE_V3_STYLES, renderPlaceV3, type PlaceV3Event, type PlaceV3Nearby, type PlaceV3Steward } from "./placeDetailV3";
import { QUIET_HOME_STYLES, renderSavedControl, renderSavedItemsScript, type QuietHomeLang } from "./quietHome";
import { sizedImageUrl, sizedImgAttrs } from "./derivedImageUrl";

export type GlobalPlaceDetailLang = QuietHomeLang;

export function isPublicGlobalPlaceDetailProfile(
  profile: PlaceAtlasProfile | null | undefined,
  canonicalPlaceId: string,
): profile is PlaceAtlasProfile {
  return Boolean(
    profile
    && profile.place.canonicalPlaceId === canonicalPlaceId
    && profile.policy?.placeVisibility === "public"
  );
}

type PlaceProfileWithGlobalNames = PlaceAtlasProfile & {
  place: PlaceAtlasProfile["place"] & {
    canonicalPlaceId?: string | null;
    aliases?: string[];
    multilingualNames?: Record<string, string>;
    verificationStatus?: string;
    officialStatus?: string;
  };
  provenance: PlaceAtlasProfile["provenance"] & {
    sourceReferences?: Array<{
      sourceType?: string | null;
      sourceId?: string | null;
      sourceUrl?: string | null;
      verificationStatus?: string | null;
      lastCheckedAt?: string | null;
    }>;
  };
};

const DETAIL_COPY = {
  ja: {
    record: "この場所で記録する", share: "共有する", shareCopy: "リンクをコピーする", shareMail: "メールで送る", shareOther: "ほかのアプリで共有", shareNote: "リンクを知っている人は、このページを見られます。", close: "閉じる", moreAbout: "場所について詳しく見る", aboutHeading: "場所について", recordsHeading: "この場所の記録", seeAll: "すべて見る", statsLabel: "この場所の記録の数", statRecords: "記録", statSince: "記録の始まり", statLatest: "最新の記録", fromYear: "年から", confirmed: "確認済み", unnamed: "名前はこれから",
    pendingTitle: "記録が集まり始めています", pendingBody: "公開できる記録がそろうと、ここに表示されます。", emptyTitle: "この場所の記録は、まだありません", emptyBody: "最初に見つけたものを残すと、この場所の図鑑がここから始まります。",
    back: "地図に戻る", showLocally: "現地で見せる", localName: "現地名", localAddress: "場所",
    openMap: "外部地図で開く", saveLogin: "ログインして保存", saveUnavailable: "保存状態を確認できません", sources: "情報の確認",
    checked: "出典の最終確認", unknown: "確認時点は不明です", sourceCount: "出典",
    generated: "このページの生成", copy: "コピー", copied: "コピーしました", details: "この場所の図鑑",
    disclaimer: "営業時間・料金・アクセシビリティなど、確認できない情報は不明のまま扱います。",
    obsHeading: "この場所の公開記録", obsAll: "すべて", obsPhoto: "画像のみ", obsAudio: "音声のみ", obsVideo: "動画のみ", obsRecord: "メモ・記録のみ",
    obsFrom: "開始日", obsTo: "終了日", obsApply: "絞り込む", obsLoading: "記録を読み込んでいます…", obsEmpty: "条件に合う公開記録はまだありません。", obsError: "記録の読み込みに失敗しました。",
  },
  en: {
    record: "Record at this place", share: "Share", shareCopy: "Copy link", shareMail: "Send by email", shareOther: "Share with another app", shareNote: "Anyone with the link can view this page.", close: "Close", moreAbout: "More about this place", aboutHeading: "About this place", recordsHeading: "Records here", seeAll: "See all", statsLabel: "Records at this place", statRecords: "Records", statSince: "First record", statLatest: "Latest record", fromYear: "", confirmed: "Confirmed", unnamed: "Not named yet",
    pendingTitle: "Records are starting to come in", pendingBody: "They will appear here once enough can be shown publicly.", emptyTitle: "No records here yet", emptyBody: "Leave the first thing you find, and this place's field guide starts here.",
    back: "Back to map", showLocally: "Show locally", localName: "Local name", localAddress: "Place",
    openMap: "Open external map", saveLogin: "Sign in to save", saveUnavailable: "Saved state unavailable", sources: "Information status",
    checked: "Latest source check", unknown: "Check time unknown", sourceCount: "Sources",
    generated: "Page assembled", copy: "Copy", copied: "Copied", details: "Place atlas",
    disclaimer: "Hours, prices and accessibility stay unknown unless a source supports them.",
    obsHeading: "Public observations in this area", obsAll: "All", obsPhoto: "Photos only", obsAudio: "Audio only", obsVideo: "Videos only", obsRecord: "Notes only",
    obsFrom: "From", obsTo: "To", obsApply: "Filter", obsLoading: "Loading observations…", obsEmpty: "No public observations match this filter yet.", obsError: "Could not load observations.",
  },
  es: {
    record: "Registrar en este lugar", share: "Compartir", shareCopy: "Copiar enlace", shareMail: "Enviar por correo", shareOther: "Compartir con otra app", shareNote: "Quien tenga el enlace puede ver esta página.", close: "Cerrar", moreAbout: "Más sobre este lugar", aboutHeading: "Sobre este lugar", recordsHeading: "Registros aquí", seeAll: "Ver todo", statsLabel: "Registros de este lugar", statRecords: "Registros", statSince: "Primer registro", statLatest: "Último registro", fromYear: "", confirmed: "Confirmado", unnamed: "Sin nombre aún",
    pendingTitle: "Los registros empiezan a llegar", pendingBody: "Aparecerán aquí cuando haya suficientes para mostrar.", emptyTitle: "Todavía no hay registros aquí", emptyBody: "Guarda lo primero que encuentres y la guía de este lugar empezará aquí.",
    back: "Volver al mapa", showLocally: "Mostrar localmente", localName: "Nombre local", localAddress: "Lugar",
    openMap: "Abrir mapa externo", saveLogin: "Inicia sesión para guardar", saveUnavailable: "No se puede comprobar el estado guardado", sources: "Estado de la información",
    checked: "Última comprobación", unknown: "Fecha de comprobación desconocida", sourceCount: "Fuentes",
    generated: "Página generada", copy: "Copiar", copied: "Copiado", details: "Atlas del lugar",
    disclaimer: "Horarios, precios y accesibilidad permanecen desconocidos si no hay una fuente que los confirme.",
    obsHeading: "Registros públicos de esta zona", obsAll: "Todos", obsPhoto: "Solo fotos", obsAudio: "Solo audio", obsVideo: "Solo vídeo", obsRecord: "Solo notas",
    obsFrom: "Desde", obsTo: "Hasta", obsApply: "Filtrar", obsLoading: "Cargando registros…", obsEmpty: "No hay registros públicos que coincidan.", obsError: "No se pudieron cargar los registros.",
  },
  "pt-br": {
    record: "Registrar neste local", share: "Compartilhar", shareCopy: "Copiar link", shareMail: "Enviar por e-mail", shareOther: "Compartilhar com outro app", shareNote: "Quem tiver o link pode ver esta página.", close: "Fechar", moreAbout: "Mais sobre este local", aboutHeading: "Sobre este local", recordsHeading: "Registros aqui", seeAll: "Ver tudo", statsLabel: "Registros deste local", statRecords: "Registros", statSince: "Primeiro registro", statLatest: "Último registro", fromYear: "", confirmed: "Confirmado", unnamed: "Ainda sem nome",
    pendingTitle: "Os registros estão começando a chegar", pendingBody: "Eles aparecerão aqui quando houver o suficiente para exibir.", emptyTitle: "Ainda não há registros aqui", emptyBody: "Guarde a primeira coisa que encontrar e o guia deste local começa aqui.",
    back: "Voltar ao mapa", showLocally: "Mostrar no local", localName: "Nome local", localAddress: "Local",
    openMap: "Abrir mapa externo", saveLogin: "Entre para salvar", saveUnavailable: "Não foi possível verificar o estado salvo", sources: "Estado das informações",
    checked: "Última verificação da fonte", unknown: "Data de verificação desconhecida", sourceCount: "Fontes",
    generated: "Página montada", copy: "Copiar", copied: "Copiado", details: "Atlas do local",
    disclaimer: "Horários, preços e acessibilidade permanecem desconhecidos sem uma fonte que os confirme.",
    obsHeading: "Registros públicos desta área", obsAll: "Todos", obsPhoto: "Só fotos", obsAudio: "Só áudio", obsVideo: "Só vídeo", obsRecord: "Só notas",
    obsFrom: "De", obsTo: "Até", obsApply: "Filtrar", obsLoading: "Carregando registros…", obsEmpty: "Nenhum registro público encontrado.", obsError: "Não foi possível carregar os registros.",
  },
} as const;

function stripV3DuplicateAtlas(html: string): string {
  return html
    .replace(/<header class="me-place-atlas-hero">[\s\S]*?<\/header>/u, "")
    .replace(/<section class="[^"]*\bme-place-atlas-(?:summary|recent|empty)\b[^"]*"[^>]*>[\s\S]*?<\/section>/gu, "");
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function localName(profile: PlaceProfileWithGlobalNames): string {
  return clean(profile.place.name);
}

function selectedLanguageName(profile: PlaceProfileWithGlobalNames, lang: GlobalPlaceDetailLang): string {
  const names = profile.place.multilingualNames ?? {};
  const candidates = lang === "pt-br" ? ["pt-BR", "pt-br", "pt"] : [lang];
  for (const key of candidates) {
    const value = clean(names[key]);
    if (value) return value;
  }
  return localName(profile);
}

function latestSourceCheck(profile: PlaceProfileWithGlobalNames): string | null {
  const values = (profile.provenance.sourceReferences ?? [])
    .map((source) => clean(source.lastCheckedAt))
    .filter((value) => Number.isFinite(Date.parse(value)))
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  return values[0] ?? null;
}

function displayDate(value: string | null, lang: GlobalPlaceDetailLang): string | null {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  try {
    return new Intl.DateTimeFormat(lang === "pt-br" ? "pt-BR" : lang, { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value.slice(0, 10);
  }
}

function externalMapHref(profile: PlaceProfileWithGlobalNames): string {
  const query = [localName(profile), clean(profile.place.localityLabel)].filter(Boolean).join(" ");
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query);
}

export function renderGlobalPlaceDetailPage(input: {
  profile: PlaceAtlasProfile;
  lang: GlobalPlaceDetailLang;
  savedItem?: SavedItem | null;
  savedStateAvailable?: boolean;
  viewerAuthenticated?: boolean;
  nocosilUsageHtml?: string;
  paperArchiveTimelineHtml?: string;
  fixedPointTimelineHtml?: string;
  v3?: boolean;
  v3Extras?: { stewardIntro?: string | null; events?: PlaceV3Event[]; steward?: PlaceV3Steward | null; nearby?: PlaceV3Nearby[] };
  now?: Date;
}): string {
  const profile = input.profile as PlaceProfileWithGlobalNames;
  const lang = input.lang;
  const copy = DETAIL_COPY[lang];
  const canonicalPlaceId = clean(profile.place.canonicalPlaceId);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{1,159}$/u.test(canonicalPlaceId)) {
    throw new Error("canonical_place_id_required");
  }
  const siteLang = lang === "pt-br" ? "pt-BR" : lang;
  const prefix = "/" + lang;
  const path = "/places/" + canonicalPlaceId;
  const localizedPath = prefix + path;
  const local = localName(profile);
  const selected = selectedLanguageName(profile, lang);
  const publicLocationMode = profile.policy?.publicLocationMode ?? "hidden";
  const canExposePlaceLocation = publicLocationMode === "place";
  const locality = canExposePlaceLocation ? clean(profile.place.localityLabel) : "";
  const latest = displayDate(latestSourceCheck(profile), lang);
  const sourceCount = profile.provenance.sourceReferences?.length ?? 0;
  const generated = displayDate(clean(profile.provenance.generatedAt), lang);
  const save = input.viewerAuthenticated
    ? input.savedStateAvailable === false
      ? `<span class="gpd-secondary" role="status" aria-disabled="true">${escapeHtml(copy.saveUnavailable)}</span>`
      : renderSavedControl({ kind: "place", objectId: canonicalPlaceId, path, title: local || selected }, lang, input.savedItem ?? null)
    : `<a class="gpd-secondary" href="${prefix}/login?redirect=${encodeURIComponent(localizedPath)}">${escapeHtml(copy.saveLogin)}</a>`;
  const externalMap = canExposePlaceLocation ? externalMapHref(profile) : "";
  const displayProfile: PlaceAtlasProfile = canExposePlaceLocation
    ? profile
    : {
        ...profile,
        place: {
          ...profile.place,
          localityLabel: null,
        },
      };
  const mapProfileRaw = renderMapPlaceAtlasProfile(input.v3 === true ? { ...displayProfile, place: { ...displayProfile.place, description: clean(input.v3Extras?.stewardIntro) || null } } : displayProfile, {
    lang: siteLang,
    recordHref: prefix + "/record",
    recordsHref: prefix + "/records?view=public",
  });
  const mapProfile = input.v3 === true ? stripV3DuplicateAtlas(mapProfileRaw) : mapProfileRaw;
  const atlasScript = `<script>${MAP_PLACE_ATLAS_PROFILE_RUNTIME}\nMapPlaceAtlasProfile.bind(document.getElementById("global-place-detail"));</script>`;

  const areaObsHtml = `<section class="gpd-observations" data-area-observations-panel data-place-id="${escapeHtml(canonicalPlaceId)}" aria-labelledby="gpd-obs-title"><h2 id="gpd-obs-title">${escapeHtml(copy.obsHeading)}</h2><div class="gpd-obs-filters" role="group" aria-label="${escapeHtml(copy.obsHeading)}"><button type="button" class="gpd-obs-tab" data-media-kind="all" aria-pressed="true">${escapeHtml(copy.obsAll)}</button><button type="button" class="gpd-obs-tab" data-media-kind="photo" aria-pressed="false">${escapeHtml(copy.obsPhoto)}</button><button type="button" class="gpd-obs-tab" data-media-kind="audio" aria-pressed="false">${escapeHtml(copy.obsAudio)}</button><button type="button" class="gpd-obs-tab" data-media-kind="video" aria-pressed="false">${escapeHtml(copy.obsVideo)}</button><button type="button" class="gpd-obs-tab" data-media-kind="record" aria-pressed="false">${escapeHtml(copy.obsRecord)}</button></div><div class="gpd-obs-period"><label><span>${escapeHtml(copy.obsFrom)}</span><input type="date" data-area-obs-from></label><label><span>${escapeHtml(copy.obsTo)}</span><input type="date" data-area-obs-to></label><button type="button" class="gpd-secondary" data-area-obs-apply>${escapeHtml(copy.obsApply)}</button></div><p class="gpd-obs-meta" data-area-obs-status aria-live="polite">${escapeHtml(copy.obsLoading)}</p><div class="gpd-obs-grid" data-area-obs-list></div></section>`;
  const areaObsScript = `<script>(()=>{const panel=document.querySelector('[data-area-observations-panel]');if(!panel)return;const placeId=panel.getAttribute('data-place-id')||'';const list=panel.querySelector('[data-area-obs-list]');const status=panel.querySelector('[data-area-obs-status]');const fromEl=panel.querySelector('[data-area-obs-from]');const toEl=panel.querySelector('[data-area-obs-to]');const prefix=${JSON.stringify(prefix).replace(/</g,"\\u003c")};const emptyMsg=${JSON.stringify(copy.obsEmpty).replace(/</g,"\\u003c")};const errMsg=${JSON.stringify(copy.obsError).replace(/</g,"\\u003c")};const loadingMsg=${JSON.stringify(copy.obsLoading).replace(/</g,"\\u003c")};let kind='all';const load=async()=>{if(status)status.textContent=loadingMsg;const p=new URLSearchParams({place_id:placeId,media_kind:kind,limit:'24'});if(fromEl&&fromEl.value)p.set('from',fromEl.value);if(toEl&&toEl.value)p.set('to',toEl.value);try{const res=await fetch('/api/v1/areas/observations?'+p.toString());if(!res.ok)throw new Error('fetch_failed');const data=await res.json();const items=Array.isArray(data.items)?data.items:[];if(status)status.textContent=items.length?items.length+' ('+(data.stats&&typeof data.stats.durationMs==='number'?data.stats.durationMs+'ms':'')+')':emptyMsg;if(!list)return;list.replaceChildren();for(const item of items){const a=document.createElement('a');a.className='gpd-obs-card';a.href=prefix+'/observations/'+encodeURIComponent(item.visitId);if(item.photoUrl){const img=document.createElement('img');img.src=item.photoUrl;img.alt='';img.loading='lazy';a.append(img);}const body=document.createElement('div');const title=document.createElement('strong');title.textContent=item.displayName||'';const meta=document.createElement('small');meta.textContent=[item.mediaKind,String(item.observedAt||'').slice(0,10),item.localityLabel].filter(Boolean).join(' · ');body.append(title,meta);if(item.publicNote){const pNote=document.createElement('p');pNote.textContent=item.publicNote;body.append(pNote);}a.append(body);list.append(a);}}catch{if(status)status.textContent=errMsg;}};panel.querySelectorAll('.gpd-obs-tab').forEach((btn)=>btn.addEventListener('click',()=>{kind=btn.getAttribute('data-media-kind')||'all';panel.querySelectorAll('.gpd-obs-tab').forEach((b)=>b.setAttribute('aria-pressed',b===btn?'true':'false'));void load();}));panel.querySelector('[data-area-obs-apply]')?.addEventListener('click',()=>void load());void load();})();</script>`;

  const recordCount = typeof profile.summary?.recordCount === "number" ? profile.summary.recordCount : 0;
  const records = (displayProfile.recentRecords ?? []).filter((record) => record && record.recordId);
  const mediaRecords = records.filter((record) => record.mediaUrl && record.mediaKind !== "audio");
  const coverUrl = clean(displayProfile.place.representativeMedia?.[0]?.url) || clean(mediaRecords[0]?.mediaUrl);
  const hasRecords = recordCount > 0 || records.length > 0;
  const shownCount = recordCount > 0 ? recordCount : records.length;
  const recordHref = prefix + "/record?placeId=" + encodeURIComponent(canonicalPlaceId);
  const allRecordsHref = prefix + "/records?view=public";
  const startYear = clean(profile.summary?.firstRecordedAt).slice(0, 4);
  const latestRaw = clean(profile.summary?.latestRecordedAt);
  const latestRecord = Number.isFinite(Date.parse(latestRaw)) ? new Intl.DateTimeFormat(lang === "pt-br" ? "pt-BR" : lang, { month: lang === "ja" ? "long" : "short", day: "numeric", timeZone: "Asia/Tokyo" }).format(new Date(latestRaw)) : null;
  const recordHrefOf = (record: { recordId: string; href: string | null }) =>
    record.href && record.href.startsWith("/") ? record.href : prefix + "/observations/" + encodeURIComponent(record.recordId);
  const stats = hasRecords
    ? `<div class="gpd-stats" aria-label="${escapeHtml(copy.statsLabel)}"><div><strong>${shownCount}</strong><span>${escapeHtml(copy.statRecords)}</span></div>${startYear ? `<div><strong>${escapeHtml(startYear)}</strong><span>${escapeHtml(copy.statSince)}</span></div>` : ""}${latestRecord ? `<div><strong>${escapeHtml(latestRecord)}</strong><span>${escapeHtml(copy.statLatest)}</span></div>` : ""}</div>`
    : profile.publication?.status === "suppressed"
      ? `<section class="gpd-empty" aria-labelledby="gpd-empty-title"><h2 id="gpd-empty-title">${escapeHtml(copy.pendingTitle)}</h2><p>${escapeHtml(copy.pendingBody)}</p></section>`
      : `<section class="gpd-empty" aria-labelledby="gpd-empty-title"><h2 id="gpd-empty-title">${escapeHtml(copy.emptyTitle)}</h2><p>${escapeHtml(copy.emptyBody)}</p></section>`;
  const tiles = mediaRecords.slice(0, 3).map((record, index) =>
    `<a class="gpd-tile gpd-tile-${index + 1}" href="${escapeHtml(recordHrefOf(record))}"><img ${sizedImgAttrs(record.mediaUrl, 680, [360, 680, 1020], "(max-width: 899px) 50vw, 400px", escapeHtml)} alt="${escapeHtml(record.displayName ?? "")}" loading="${index === 0 ? "eager" : "lazy"}" decoding="async"></a>`).join("");
  const rows = records.slice(0, 2).map((record) => {
    const meta = [displayDate(record.observedAt, lang), record.identificationStatus === "confirmed" ? copy.confirmed : ""].filter(Boolean).join(" ・ ");
    const thumb = record.mediaUrl && record.mediaKind !== "audio"
      ? `<span class="gpd-row-thumb"><img src="${escapeHtml(sizedImageUrl(record.mediaUrl, 320))}" alt="" loading="lazy" decoding="async"></span>`
      : `<span class="gpd-row-thumb" aria-hidden="true"></span>`;
    return `<a class="gpd-row" href="${escapeHtml(recordHrefOf(record))}">${thumb}<span class="gpd-row-body"><strong>${escapeHtml(record.displayName || copy.unnamed)}</strong><small>${escapeHtml(meta)}</small></span><svg class="gpd-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></a>`;
  }).join("");
  const recordsSection = records.length > 0
    ? `<section class="gpd-records" aria-labelledby="gpd-records-title"><div class="gpd-section-head"><h2 id="gpd-records-title">${escapeHtml(copy.recordsHeading)}</h2><a href="${escapeHtml(allRecordsHref)}">${escapeHtml(copy.seeAll)}</a></div>${tiles ? `<div class="gpd-mosaic gpd-mosaic-${Math.min(3, mediaRecords.length)}">${tiles}</div>` : ""}${rows ? `<div class="gpd-rows">${rows}</div>` : ""}</section>`
    : "";
  const cameraIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 4h-5L8 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="12.5" r="3.5"/></svg>';
  const shareIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4M5 12v7h14v-7"/></svg>';
  const metaParts = [locality].filter(Boolean);
  const showLocalInMeta = Boolean(local && local !== selected);
  const hero = `<section class="gpd-hero${coverUrl ? " has-photo" : ""}" aria-labelledby="gpd-title">${coverUrl ? `<img class="gpd-hero-img" ${sizedImgAttrs(coverUrl, 1020, [680, 1020, 1360], "100vw", escapeHtml)} alt="" fetchpriority="high" decoding="async">` : ""}<a class="gpd-hero-btn gpd-back" href="${escapeHtml(prefix + "/map?tab=places")}" aria-label="${escapeHtml(copy.back)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></a><button type="button" class="gpd-hero-btn gpd-hero-share" data-gpd-share data-share-title="${escapeHtml(selected || local)}" data-share-copied="${escapeHtml(copy.copied)}" aria-label="${escapeHtml(copy.share)}">${shareIcon}</button><div class="gpd-hero-copy"><h1 id="gpd-title">${escapeHtml(selected || local)}</h1>${metaParts.length || showLocalInMeta ? `<p>${metaParts.map((part) => escapeHtml(part)).join(" ・ ")}${showLocalInMeta ? `${metaParts.length ? " ・ " : ""}<span lang="und">${escapeHtml(local)}</span>` : ""}</p>` : ""}</div></section>`;
  const side = `<aside class="gpd-side" aria-label="${escapeHtml(copy.aboutHeading)}"><h2>${escapeHtml(copy.aboutHeading)}</h2><dl>${locality ? `<div><dt>${escapeHtml(copy.localAddress)}</dt><dd>${escapeHtml(locality)}</dd></div>` : ""}<div><dt>${escapeHtml(copy.sourceCount)}</dt><dd>${sourceCount}</dd></div>${hasRecords ? `<div><dt>${escapeHtml(copy.statRecords)}</dt><dd>${shownCount}${startYear ? ` (${escapeHtml(startYear)}${escapeHtml(copy.fromYear)})` : ""}</dd></div>` : ""}</dl><a class="gpd-primary" href="${escapeHtml(recordHref)}">${cameraIcon}<span>${escapeHtml(copy.record)}</span></a><button type="button" class="gpd-secondary" data-gpd-share data-share-title="${escapeHtml(selected || local)}" data-share-copied="${escapeHtml(copy.copied)}">${shareIcon}<span>${escapeHtml(copy.share)}</span></button></aside>`;
  const linkIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/></svg>';
  const mailIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
  const sheetMeta = [locality, hasRecords ? `${copy.statRecords} ${shownCount}` : ""].filter(Boolean).join(" ・ ");
  const shareCoverUrl = input.v3 === true ? (hasRecords ? clean(mediaRecords[0]?.mediaUrl) : "") : coverUrl;
  const shareSheet = `<dialog class="gpd-sheet" id="gpd-share-sheet" aria-labelledby="gpd-share-title"><div class="gpd-sheet-grip" aria-hidden="true"></div><div class="gpd-sheet-place">${shareCoverUrl ? `<img src="${escapeHtml(shareCoverUrl)}" alt="" decoding="async">` : `<span class="gpd-sheet-noimg" aria-hidden="true"></span>`}<div><strong>${escapeHtml(selected || local)}</strong>${sheetMeta ? `<small>${escapeHtml(sheetMeta)}</small>` : ""}</div></div><h2 id="gpd-share-title">${escapeHtml(copy.share)}</h2><button type="button" class="gpd-sheet-row" data-share-copy data-share-copied="${escapeHtml(copy.copied)}">${linkIcon}<span>${escapeHtml(copy.shareCopy)}</span></button><a class="gpd-sheet-row" data-share-mail data-share-title="${escapeHtml(selected || local)}" href="mailto:">${mailIcon}<span>${escapeHtml(copy.shareMail)}</span></a><button type="button" class="gpd-sheet-row" data-share-native data-share-title="${escapeHtml(selected || local)}" hidden>${shareIcon}<span>${escapeHtml(copy.shareOther)}</span></button><p class="gpd-sheet-note">${escapeHtml(copy.shareNote)}</p><button type="button" class="gpd-secondary" data-share-close>${escapeHtml(copy.close)}</button></dialog>`;
  const shareScript = `<script>(()=>{const sheet=document.getElementById('gpd-share-sheet');if(!sheet)return;const url=()=>location.href.split('#')[0];const title=sheet.querySelector('[data-share-mail]')?.getAttribute('data-share-title')||document.title;document.querySelectorAll('[data-gpd-share]').forEach((button)=>button.addEventListener('click',()=>{const mail=sheet.querySelector('[data-share-mail]');if(mail)mail.setAttribute('href','mailto:?subject='+encodeURIComponent(title)+'&body='+encodeURIComponent(title+'\\n'+url()));const nativeButton=sheet.querySelector('[data-share-native]');if(nativeButton&&navigator.share)nativeButton.hidden=false;if(typeof sheet.showModal==='function')sheet.showModal();else sheet.setAttribute('open','');}));sheet.querySelector('[data-share-copy]')?.addEventListener('click',async(event)=>{const button=event.currentTarget;try{await navigator.clipboard.writeText(url());const label=button.querySelector('span');if(label)label.textContent=button.getAttribute('data-share-copied')||'';}catch{}});sheet.querySelector('[data-share-native]')?.addEventListener('click',async()=>{try{await navigator.share({title,url:url()});}catch{}});const close=()=>{if(sheet.close)sheet.close();else sheet.removeAttribute('open');};sheet.querySelector('[data-share-close]')?.addEventListener('click',close);sheet.addEventListener('click',(event)=>{if(event.target===sheet)close();});})();</script>`;

  const v3On = input.v3 === true;
  const v3Records = records.slice(0, 3).map((record) => ({
    id: record.recordId,
    href: recordHrefOf(record),
    name: clean(record.displayName),
    mediaUrl: record.mediaUrl && record.mediaKind !== "audio" ? record.mediaUrl : null,
    observedAt: record.observedAt,
    dateLabel: displayDate(record.observedAt, lang),
    confirmed: record.identificationStatus === "confirmed",
  }));
  const v3Main = v3On ? renderPlaceV3({
    lang,
    prefix,
    canonicalPlaceId,
    name: selected || local,
    localName: showLocalInMeta ? local : null,
    locality,
    hasRecords,
    suppressed: profile.publication?.status === "suppressed",
    shownCount,
    startYear,
    latestLabel: latestRecord,
    records: v3Records,
    photoUrls: mediaRecords.map((record) => clean(record.mediaUrl)).filter((url, index, all) => url && all.indexOf(url) === index),
    recordHref,
    allRecordsHref,
    backHref: prefix + "/map?tab=places",
    backLabel: copy.back,
    shareLabel: copy.share,
    copiedLabel: copy.copied,
    shareTitle: selected || local,
    saveHtml: input.viewerAuthenticated && input.savedStateAvailable === false ? "" : save,
    moreLabel: copy.moreAbout,
    moreHref: "#gpd-details",
    mapHref: canExposePlaceLocation ? prefix + "/map?tab=places" : "",
    externalMapHref: externalMap,
    externalMapLabel: copy.openMap,
    stewardIntro: clean(input.v3Extras?.stewardIntro) || null,
    events: input.v3Extras?.events ?? [],
    steward: input.v3Extras?.steward ?? null,
    nearby: input.v3Extras?.nearby ?? [],
    now: input.now ?? new Date(),
  }) : "";
  const v3Css = v3On ? PLACE_V3_STYLES : "";

  return `<!doctype html><html lang="${escapeHtml(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(selected || local)} | ZUKAN</title><style>
${APP_EXPERIENCE_STYLES}
${QUIET_HOME_STYLES}
${MAP_PLACE_ATLAS_PROFILE_STYLES}
:root{color-scheme:light;--gpd-brand:#143F2E;--gpd-text:#17211b;--gpd-sub:#55615a;--gpd-line:#dde2dc}.gpd{max-width:1120px;margin:0 auto;padding:0 0 110px;color:var(--gpd-text)}.gpd svg{width:22px;height:22px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.gpd-hero{position:relative;min-height:min(78vw,340px);display:flex;align-items:flex-end;overflow:hidden;background:linear-gradient(160deg,#1d5a40 0%,#143F2E 55%,#0c2a1e 100%);color:#fff}.gpd-hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.gpd-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,18,12,0) 38%,rgba(8,18,12,.78) 100%)}.gpd-hero-copy{position:relative;z-index:1;padding:20px 20px 18px;min-width:0}.gpd-hero h1{margin:0;font-size:clamp(1.65rem,6vw,2.25rem);line-height:1.25;font-weight:700;overflow-wrap:anywhere}.gpd-hero p{margin:6px 0 0;font-size:1rem;line-height:1.5;color:rgba(255,255,255,.92);overflow-wrap:anywhere}
.gpd-hero-btn{position:absolute;top:14px;z-index:2;display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border:0;border-radius:50%;background:rgba(255,255,255,.94);color:#17211b;cursor:pointer;text-decoration:none}.gpd-back,.gpd-back:visited{left:14px;color:#17211b}.gpd-hero-share{right:14px}
.gpd-body{display:grid;gap:20px;padding:20px 20px 0;min-width:0}.gpd-col{display:grid;gap:20px;min-width:0;align-content:start}.gpd-cta{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px}.gpd-primary,.gpd-secondary{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:52px;padding:10px 18px;border-radius:16px;font:inherit;font-size:1rem;font-weight:700;text-decoration:none;cursor:pointer}.gpd-primary,.gpd-primary:visited{border:1px solid var(--gpd-brand);background:var(--gpd-brand);color:#fff;box-shadow:0 2px 6px rgba(20,63,46,.25)}.gpd-secondary,.gpd-secondary:visited{border:1.5px solid var(--gpd-brand);background:#fff;color:var(--gpd-brand)}.gpd-cta .zs-control{min-height:52px;min-width:96px;border:1.5px solid var(--gpd-brand);border-radius:16px;background:#fff;color:var(--gpd-brand);font-weight:700;font-size:1rem}.gpd-cta .zs-control svg{width:18px;height:18px;stroke-width:1.7}
.gpd-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));padding:16px 8px;border:1px solid var(--gpd-line);border-radius:20px;background:#fff;text-align:center}.gpd-stats div{padding:0 6px;border-left:1px solid var(--gpd-line);min-width:0}.gpd-stats div:first-child{border-left:0}.gpd-stats strong{display:block;font-size:clamp(1.125rem,5.2vw,1.5rem);line-height:1.3;font-weight:700;white-space:nowrap}.gpd-stats span{display:block;font-size:.875rem;color:var(--gpd-sub);font-weight:600}
.gpd-empty{padding:24px 20px;border:1px solid var(--gpd-line);border-radius:20px;background:#fff;text-align:center}.gpd-empty h2{margin:0;font-size:1.25rem;line-height:1.5}.gpd-empty p{margin:8px 0 0;color:var(--gpd-sub)}
.gpd-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.gpd-section-head h2{margin:0;font-size:1.375rem;line-height:1.45}.gpd-section-head a,.gpd-section-head a:visited{display:inline-flex;align-items:center;min-height:44px;color:#0055AD;font-weight:700;text-underline-offset:4px}
.gpd-mosaic{display:grid;gap:4px;overflow:hidden;border-radius:20px;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));aspect-ratio:1.06/1}.gpd-mosaic .gpd-tile{display:block;min-width:0;min-height:0;overflow:hidden;background:#eef1ed}.gpd-mosaic img{display:block;width:100%;height:100%;object-fit:cover}.gpd-mosaic .gpd-tile-1{grid-row:1/3}.gpd-mosaic-1{grid-template-columns:1fr;grid-template-rows:1fr;aspect-ratio:4/3}.gpd-mosaic-1 .gpd-tile-1{grid-row:auto}.gpd-mosaic-2{grid-template-rows:1fr;aspect-ratio:2/1}.gpd-mosaic-2 .gpd-tile-1{grid-row:auto}
.gpd-rows{display:grid}.gpd-row,.gpd-row:visited{display:flex;align-items:center;gap:14px;padding:14px 0;min-width:0;border-bottom:1px solid var(--gpd-line);color:inherit;text-decoration:none}.gpd-row-thumb{flex:none;width:64px;height:64px;border-radius:14px;overflow:hidden;background:#eef1ed}.gpd-row-thumb img{display:block;width:100%;height:100%;object-fit:cover}.gpd-row-body{flex:1;min-width:0}.gpd-row-body strong{display:block;font-size:1.0625rem;line-height:1.4;overflow-wrap:anywhere}.gpd-row-body small{display:block;margin-top:2px;font-size:.9375rem;color:var(--gpd-sub);overflow-wrap:anywhere}.gpd-chev{width:20px;height:20px;color:#8a948d}
.gpd-more,.gpd-more:visited{display:flex;align-items:center;justify-content:center;min-height:52px;color:var(--gpd-brand);font-weight:700;font-size:1.0625rem;text-underline-offset:4px}.gpd-side{display:none}
.gpd-details{display:grid;gap:0;margin-top:8px;padding:0 20px}.gpd-utility{display:grid;gap:16px;padding:20px;border:1px solid #d7dfd8;border-radius:16px;background:#fbfcfa}.gpd-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.gpd-actions:empty{display:none}.gpd-actions .gpd-primary{min-height:44px;border-radius:8px;box-shadow:none}.gpd-show{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;padding:16px;border-radius:12px;background:#f3f6f2}.gpd-show h2,.gpd-status h2{margin:0;font-size:1rem}.gpd-show-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center}.gpd-show-row p{margin:0;min-width:0;overflow-wrap:anywhere}.gpd-copy{min-height:44px;padding:8px 12px;border:1px solid #68746c;border-radius:6px;background:#fff;color:#245c3a;font:inherit}.gpd-status{display:grid;gap:4px;padding-top:2px}.gpd-status p{margin:0;color:var(--gpd-sub)}.gpd-status small{color:#68746c}.gpd-atlas{margin-top:18px}.gpd-observations{margin-top:24px;display:grid;gap:12px;padding:18px;border:1px solid #d7dfd8;border-radius:16px;background:#fff}.gpd-observations h2{margin:0;font-size:1.2rem}.gpd-obs-filters,.gpd-obs-period{display:flex;flex-wrap:wrap;gap:8px;align-items:end}.gpd-obs-tab{min-height:44px;padding:8px 14px;border:1px solid #68746c;border-radius:999px;background:#fff;color:#17211b;font:inherit;font-weight:700;cursor:pointer}.gpd-obs-tab[aria-pressed="true"]{background:#245c3a;border-color:#245c3a;color:#fff}.gpd-obs-period label{display:grid;gap:4px;font-size:13px;color:var(--gpd-sub)}.gpd-obs-period input{min-height:44px;padding:6px 10px;border:1px solid #aebfb5;border-radius:6px}.gpd-obs-meta{margin:0;color:var(--gpd-sub);font-size:14px}.gpd-obs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}.gpd-obs-card{display:grid;gap:8px;padding:12px;border:1px solid #d7dfd8;border-radius:12px;color:inherit;text-decoration:none;background:#fbfcfa}.gpd-obs-card img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px}.gpd-obs-card small{display:block;color:var(--gpd-sub)}.gpd-obs-card p{margin:4px 0 0;font-size:14px;color:#33473c}.gpd :focus-visible{outline:3px solid currentColor;outline-offset:3px}
@media(min-width:768px){.gpd-hero{margin:20px 20px 0;border-radius:20px;min-height:280px}.gpd-utility{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
@media(min-width:960px){.gpd-body{grid-template-columns:minmax(0,1fr) 300px;gap:32px;align-items:start}.gpd-side{display:grid;gap:12px;padding-top:4px;border-left:1px solid var(--gpd-line);padding-left:24px}.gpd-side h2{margin:0;font-size:1.0625rem}.gpd-side dl{margin:0;display:grid}.gpd-side dl div{display:grid;grid-template-columns:5em minmax(0,1fr);gap:8px;padding:10px 0;border-bottom:1px solid var(--gpd-line)}.gpd-side dt{color:var(--gpd-sub)}.gpd-side dd{margin:0;font-weight:700;overflow-wrap:anywhere}.gpd-cta{max-width:640px}.gpd-stats{max-width:640px}.gpd-mosaic{aspect-ratio:2.4/1;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:1fr}.gpd-mosaic .gpd-tile-1{grid-row:auto}.gpd-mosaic-1{grid-template-columns:1fr}.gpd-mosaic-2{grid-template-columns:repeat(2,minmax(0,1fr))}}
.gpd-sheet{position:fixed;inset:auto 0 0 0;margin:0 auto;width:100%;max-width:640px;max-height:92vh;overflow:auto;padding:12px 20px 24px;border:0;border-radius:28px 28px 0 0;background:#fff;color:var(--gpd-text)}.gpd-sheet::backdrop{background:rgba(8,18,12,.5)}.gpd-sheet-grip{width:44px;height:5px;margin:0 auto 16px;border-radius:3px;background:#dde2dc}.gpd-sheet-place{display:flex;align-items:center;gap:16px;padding-bottom:16px;border-bottom:1px solid var(--gpd-line)}.gpd-sheet-place img,.gpd-sheet-noimg{flex:none;width:64px;height:64px;border-radius:14px;object-fit:cover;background:var(--gpd-brand)}.gpd-sheet-place strong{display:block;font-size:1.0625rem;overflow-wrap:anywhere}.gpd-sheet-place small{display:block;color:var(--gpd-sub);overflow-wrap:anywhere}.gpd-sheet h2{margin:14px 0 4px;font-size:1.25rem}.gpd-sheet-row,.gpd-sheet-row:visited{display:flex;align-items:center;gap:16px;width:100%;min-height:56px;padding:8px 4px;border:0;border-bottom:1px solid var(--gpd-line);background:none;color:var(--gpd-text);font:inherit;font-weight:700;text-align:left;text-decoration:none;cursor:pointer}.gpd-sheet-row[hidden]{display:none}.gpd-sheet-row svg{color:var(--gpd-brand)}.gpd-sheet-note{margin:16px 0;padding:14px 16px;border-radius:16px;background:#f7f7f3;color:var(--gpd-sub)}.gpd-sheet .gpd-secondary{width:100%}
@media(min-width:768px){.gpd-sheet{inset:50% auto auto 50%;transform:translate(-50%,-50%);border-radius:28px}}
@media(prefers-reduced-motion:reduce){.gpd *{scroll-behavior:auto!important;transition-duration:.01ms!important}}
${v3Css}</style></head><body data-zukan-app-experience="place-detail">${renderAppExperienceHeader(siteLang, 3, Boolean(input.viewerAuthenticated), "global-place-detail")}<main id="global-place-detail" tabindex="-1" class="gpd" data-global-place-detail="${escapeHtml(canonicalPlaceId)}">${v3Main}${v3On ? "" : `${hero}<div class="gpd-body"><div class="gpd-col"><div class="gpd-cta"><a class="gpd-primary" href="${escapeHtml(recordHref)}">${cameraIcon}<span>${escapeHtml(copy.record)}</span></a>${save}</div>${stats}${recordsSection}<a class="gpd-more" href="#gpd-details">${escapeHtml(copy.moreAbout)}</a></div>${side}</div>`}${v3On ? `<details class="pv3-details" id="gpd-details"><summary>${escapeHtml(copy.moreAbout)}</summary><div class="gpd-details">` : `<div class="gpd-details" id="gpd-details">`}<section class="gpd-utility" aria-label="${escapeHtml(copy.moreAbout)}"><div class="gpd-actions">${externalMap && !v3On ? `<a class="gpd-primary" href="${escapeHtml(externalMap)}" target="_blank" rel="noopener noreferrer">${escapeHtml(copy.openMap)}</a>` : ""}</div><section class="gpd-show" aria-labelledby="gpd-show-title"><h2 id="gpd-show-title">${escapeHtml(copy.showLocally)}</h2><div class="gpd-show-row"><p><strong>${escapeHtml(copy.localName)}:</strong> <span data-copy-value="${escapeHtml(local)}">${escapeHtml(local)}</span></p><button type="button" class="gpd-copy" data-copy-target="${escapeHtml(local)}">${escapeHtml(copy.copy)}</button></div>${locality ? `<div class="gpd-show-row"><p><strong>${escapeHtml(copy.localAddress)}:</strong> <span data-copy-value="${escapeHtml(locality)}">${escapeHtml(locality)}</span></p><button type="button" class="gpd-copy" data-copy-target="${escapeHtml(locality)}">${escapeHtml(copy.copy)}</button></div>` : ""}</section><section class="gpd-status" aria-labelledby="gpd-status-title"><h2 id="gpd-status-title">${escapeHtml(copy.sources)}</h2><p>${escapeHtml(copy.sourceCount)}: ${sourceCount}</p><p>${escapeHtml(copy.checked)}: ${escapeHtml(latest ?? copy.unknown)}</p>${generated ? `<small>${escapeHtml(copy.generated)}: ${escapeHtml(generated)}</small>` : ""}<small>${escapeHtml(copy.disclaimer)}</small><p class="zs-status" data-zukan-saved-status aria-live="polite"></p></section></section><section class="gpd-atlas" aria-label="${escapeHtml(copy.details)}">${mapProfile}</section>${areaObsHtml}${input.nocosilUsageHtml ?? ""}${input.fixedPointTimelineHtml ?? ""}${input.paperArchiveTimelineHtml ?? ""}</div>${v3On ? "</details>" : ""}</main>${renderAppExperienceNavigation(siteLang, 3, "bottom", Boolean(input.viewerAuthenticated))}${renderAppExperienceQuickCamera(siteLang)}${shareSheet}${atlasScript}${areaObsScript}${shareScript}${input.viewerAuthenticated ? renderSavedItemsScript(lang) : ""}<script>(()=>{const copied=${JSON.stringify(copy.copied).replace(/</g,"\\u003c")};document.querySelectorAll('[data-copy-target]').forEach(button=>button.addEventListener('click',async()=>{const value=button.getAttribute('data-copy-target')||'';try{await navigator.clipboard.writeText(value);button.textContent=copied;}catch{const range=document.createRange();const node=button.parentElement?.querySelector('[data-copy-value]');if(node){range.selectNodeContents(node);const selection=getSelection();selection?.removeAllRanges();selection?.addRange(range);}}}));})();</script></body></html>`;
}
