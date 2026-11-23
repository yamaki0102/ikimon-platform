import type { PlaceAtlasProfile } from "../../src/services/placeAtlasContract";
import { APP_EXPERIENCE_STYLES, renderAppExperienceHeader, renderAppExperienceNavigation, renderAppExperienceQuickCamera } from "../../src/ui/appExperience";
import { MAP_PLACE_ATLAS_PROFILE_RUNTIME, MAP_PLACE_ATLAS_PROFILE_STYLES, renderMapPlaceAtlasProfile } from "../../src/ui/mapPlaceAtlasProfile";
import { escapeHtml } from "../../src/ui/siteShell";
import type { SavedItem } from "./savedItems";
import { QUIET_HOME_STYLES, renderSavedControl, renderSavedItemsScript, type QuietHomeLang } from "./quietHome";

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
    back: "地図に戻る", showLocally: "現地で見せる", localName: "現地名", localAddress: "場所",
    openMap: "外部地図で開く", saveLogin: "ログインして保存", saveUnavailable: "保存状態を確認できません", sources: "情報の確認",
    checked: "出典の最終確認", unknown: "確認時点は不明です", sourceCount: "出典",
    generated: "このページの生成", copy: "コピー", copied: "コピーしました", details: "この場所の図鑑",
    disclaimer: "営業時間・料金・アクセシビリティなど、確認できない情報は不明のまま扱います。",
    obsHeading: "この場所の公開記録", obsAll: "すべて", obsPhoto: "画像のみ", obsAudio: "音声のみ", obsVideo: "動画のみ", obsRecord: "メモ・記録のみ",
    obsFrom: "開始日", obsTo: "終了日", obsApply: "絞り込む", obsLoading: "記録を読み込んでいます…", obsEmpty: "条件に合う公開記録はまだありません。", obsError: "記録の読み込みに失敗しました。",
  },
  en: {
    back: "Back to map", showLocally: "Show locally", localName: "Local name", localAddress: "Place",
    openMap: "Open external map", saveLogin: "Sign in to save", saveUnavailable: "Saved state unavailable", sources: "Information status",
    checked: "Latest source check", unknown: "Check time unknown", sourceCount: "Sources",
    generated: "Page assembled", copy: "Copy", copied: "Copied", details: "Place atlas",
    disclaimer: "Hours, prices and accessibility stay unknown unless a source supports them.",
    obsHeading: "Public observations in this area", obsAll: "All", obsPhoto: "Photos only", obsAudio: "Audio only", obsVideo: "Videos only", obsRecord: "Notes only",
    obsFrom: "From", obsTo: "To", obsApply: "Filter", obsLoading: "Loading observations…", obsEmpty: "No public observations match this filter yet.", obsError: "Could not load observations.",
  },
  es: {
    back: "Volver al mapa", showLocally: "Mostrar localmente", localName: "Nombre local", localAddress: "Lugar",
    openMap: "Abrir mapa externo", saveLogin: "Inicia sesión para guardar", saveUnavailable: "No se puede comprobar el estado guardado", sources: "Estado de la información",
    checked: "Última comprobación", unknown: "Fecha de comprobación desconocida", sourceCount: "Fuentes",
    generated: "Página generada", copy: "Copiar", copied: "Copiado", details: "Atlas del lugar",
    disclaimer: "Horarios, precios y accesibilidad permanecen desconocidos si no hay una fuente que los confirme.",
    obsHeading: "Registros públicos de esta zona", obsAll: "Todos", obsPhoto: "Solo fotos", obsAudio: "Solo audio", obsVideo: "Solo vídeo", obsRecord: "Solo notas",
    obsFrom: "Desde", obsTo: "Hasta", obsApply: "Filtrar", obsLoading: "Cargando registros…", obsEmpty: "No hay registros públicos que coincidan.", obsError: "No se pudieron cargar los registros.",
  },
  "pt-br": {
    back: "Voltar ao mapa", showLocally: "Mostrar no local", localName: "Nome local", localAddress: "Local",
    openMap: "Abrir mapa externo", saveLogin: "Entre para salvar", saveUnavailable: "Não foi possível verificar o estado salvo", sources: "Estado das informações",
    checked: "Última verificação da fonte", unknown: "Data de verificação desconhecida", sourceCount: "Fontes",
    generated: "Página montada", copy: "Copiar", copied: "Copiado", details: "Atlas do local",
    disclaimer: "Horários, preços e acessibilidade permanecem desconhecidos sem uma fonte que os confirme.",
    obsHeading: "Registros públicos desta área", obsAll: "Todos", obsPhoto: "Só fotos", obsAudio: "Só áudio", obsVideo: "Só vídeo", obsRecord: "Só notas",
    obsFrom: "De", obsTo: "Até", obsApply: "Filtrar", obsLoading: "Carregando registros…", obsEmpty: "Nenhum registro público encontrado.", obsError: "Não foi possível carregar os registros.",
  },
} as const;

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
  const mapProfile = renderMapPlaceAtlasProfile(displayProfile, {
    lang: siteLang,
    recordHref: prefix + "/record",
    recordsHref: prefix + "/records?view=public",
  });
  const atlasScript = `<script>${MAP_PLACE_ATLAS_PROFILE_RUNTIME}\nMapPlaceAtlasProfile.bind(document.getElementById("global-place-detail"));</script>`;

  const areaObsHtml = `<section class="gpd-observations" data-area-observations-panel data-place-id="${escapeHtml(canonicalPlaceId)}" aria-labelledby="gpd-obs-title"><h2 id="gpd-obs-title">${escapeHtml(copy.obsHeading)}</h2><div class="gpd-obs-filters" role="group" aria-label="${escapeHtml(copy.obsHeading)}"><button type="button" class="gpd-obs-tab" data-media-kind="all" aria-pressed="true">${escapeHtml(copy.obsAll)}</button><button type="button" class="gpd-obs-tab" data-media-kind="photo" aria-pressed="false">${escapeHtml(copy.obsPhoto)}</button><button type="button" class="gpd-obs-tab" data-media-kind="audio" aria-pressed="false">${escapeHtml(copy.obsAudio)}</button><button type="button" class="gpd-obs-tab" data-media-kind="video" aria-pressed="false">${escapeHtml(copy.obsVideo)}</button><button type="button" class="gpd-obs-tab" data-media-kind="record" aria-pressed="false">${escapeHtml(copy.obsRecord)}</button></div><div class="gpd-obs-period"><label><span>${escapeHtml(copy.obsFrom)}</span><input type="date" data-area-obs-from></label><label><span>${escapeHtml(copy.obsTo)}</span><input type="date" data-area-obs-to></label><button type="button" class="gpd-secondary" data-area-obs-apply>${escapeHtml(copy.obsApply)}</button></div><p class="gpd-obs-meta" data-area-obs-status aria-live="polite">${escapeHtml(copy.obsLoading)}</p><div class="gpd-obs-grid" data-area-obs-list></div></section>`;
  const areaObsScript = `<script>(()=>{const panel=document.querySelector('[data-area-observations-panel]');if(!panel)return;const placeId=panel.getAttribute('data-place-id')||'';const list=panel.querySelector('[data-area-obs-list]');const status=panel.querySelector('[data-area-obs-status]');const fromEl=panel.querySelector('[data-area-obs-from]');const toEl=panel.querySelector('[data-area-obs-to]');const prefix=${JSON.stringify(prefix).replace(/</g,"\\u003c")};const emptyMsg=${JSON.stringify(copy.obsEmpty).replace(/</g,"\\u003c")};const errMsg=${JSON.stringify(copy.obsError).replace(/</g,"\\u003c")};const loadingMsg=${JSON.stringify(copy.obsLoading).replace(/</g,"\\u003c")};let kind='all';const load=async()=>{if(status)status.textContent=loadingMsg;const p=new URLSearchParams({place_id:placeId,media_kind:kind,limit:'24'});if(fromEl&&fromEl.value)p.set('from',fromEl.value);if(toEl&&toEl.value)p.set('to',toEl.value);try{const res=await fetch('/api/v1/areas/observations?'+p.toString());if(!res.ok)throw new Error('fetch_failed');const data=await res.json();const items=Array.isArray(data.items)?data.items:[];if(status)status.textContent=items.length?items.length+' ('+(data.stats&&typeof data.stats.durationMs==='number'?data.stats.durationMs+'ms':'')+')':emptyMsg;if(!list)return;list.replaceChildren();for(const item of items){const a=document.createElement('a');a.className='gpd-obs-card';a.href=prefix+'/observations/'+encodeURIComponent(item.visitId);if(item.photoUrl){const img=document.createElement('img');img.src=item.photoUrl;img.alt='';img.loading='lazy';a.append(img);}const body=document.createElement('div');const title=document.createElement('strong');title.textContent=item.displayName||'';const meta=document.createElement('small');meta.textContent=[item.mediaKind,String(item.observedAt||'').slice(0,10),item.localityLabel].filter(Boolean).join(' · ');body.append(title,meta);if(item.publicNote){const pNote=document.createElement('p');pNote.textContent=item.publicNote;body.append(pNote);}a.append(body);list.append(a);}}catch{if(status)status.textContent=errMsg;}};panel.querySelectorAll('.gpd-obs-tab').forEach((btn)=>btn.addEventListener('click',()=>{kind=btn.getAttribute('data-media-kind')||'all';panel.querySelectorAll('.gpd-obs-tab').forEach((b)=>b.setAttribute('aria-pressed',b===btn?'true':'false'));void load();}));panel.querySelector('[data-area-obs-apply]')?.addEventListener('click',()=>void load());void load();})();</script>`;

  return `<!doctype html><html lang="${escapeHtml(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(selected || local)} | ZUKAN</title><style>
${APP_EXPERIENCE_STYLES}
${QUIET_HOME_STYLES}
${MAP_PLACE_ATLAS_PROFILE_STYLES}
:root{color-scheme:light}.gpd{max-width:1120px;margin:0 auto;padding:20px 20px 110px;color:#17211b}.gpd-back{display:inline-flex;align-items:center;min-height:44px;margin-bottom:16px;color:#245c3a;font-weight:700;text-underline-offset:4px}.gpd-utility{display:grid;gap:16px;padding:20px;border:1px solid #d7dfd8;border-radius:16px;background:#fbfcfa}.gpd-heading{min-width:0}.gpd-heading h1{margin:0;font-size:clamp(1.65rem,5vw,2.5rem);line-height:1.2;overflow-wrap:anywhere}.gpd-heading .gpd-local{margin:8px 0 0;color:#55615a;font-size:1rem;overflow-wrap:anywhere}.gpd-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.gpd-primary,.gpd-secondary{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:9px 14px;border-radius:6px;font:inherit;font-weight:700;text-decoration:none}.gpd-primary{border:1px solid #245c3a;background:#245c3a;color:#fff}.gpd-secondary{border:1px solid #68746c;background:#fff;color:#245c3a}.gpd-show{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;padding:16px;border-radius:12px;background:#f3f6f2}.gpd-show h2,.gpd-status h2{margin:0;font-size:1rem}.gpd-show-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center}.gpd-show-row p{margin:0;min-width:0;overflow-wrap:anywhere}.gpd-copy{min-height:44px;padding:8px 12px;border:1px solid #68746c;border-radius:6px;background:#fff;color:#245c3a;font:inherit}.gpd-status{display:grid;gap:4px;padding-top:2px}.gpd-status p{margin:0;color:#55615a}.gpd-status small{color:#68746c}.gpd-atlas{margin-top:18px}.gpd-observations{margin-top:24px;display:grid;gap:12px;padding:18px;border:1px solid #d7dfd8;border-radius:16px;background:#fff}.gpd-observations h2{margin:0;font-size:1.2rem}.gpd-obs-filters,.gpd-obs-period{display:flex;flex-wrap:wrap;gap:8px;align-items:end}.gpd-obs-tab{min-height:44px;padding:8px 14px;border:1px solid #68746c;border-radius:999px;background:#fff;color:#17211b;font:inherit;font-weight:700;cursor:pointer}.gpd-obs-tab[aria-pressed="true"]{background:#245c3a;border-color:#245c3a;color:#fff}.gpd-obs-period label{display:grid;gap:4px;font-size:13px;color:#55615a}.gpd-obs-period input{min-height:44px;padding:6px 10px;border:1px solid #aebfb5;border-radius:6px}.gpd-obs-meta{margin:0;color:#55615a;font-size:14px}.gpd-obs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}.gpd-obs-card{display:grid;gap:8px;padding:12px;border:1px solid #d7dfd8;border-radius:12px;color:inherit;text-decoration:none;background:#fbfcfa}.gpd-obs-card img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px}.gpd-obs-card small{display:block;color:#55615a}.gpd-obs-card p{margin:4px 0 0;font-size:14px;color:#33473c}.gpd :focus-visible{outline:3px solid currentColor;outline-offset:3px}@media(min-width:768px){.gpd-utility{grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr)}.gpd-heading,.gpd-actions{grid-column:1}.gpd-show,.gpd-status{grid-column:2}.gpd-show{grid-row:1 / span 2}.gpd-status{grid-row:3}.gpd-actions{align-self:end}}@media(prefers-reduced-motion:reduce){.gpd *{scroll-behavior:auto!important;transition-duration:.01ms!important}}
</style></head><body data-zukan-app-experience="place-detail">${renderAppExperienceHeader(siteLang, 3, Boolean(input.viewerAuthenticated), "global-place-detail")}<main id="global-place-detail" tabindex="-1" class="gpd" data-global-place-detail="${escapeHtml(canonicalPlaceId)}"><a class="gpd-back" href="${escapeHtml(prefix + "/map?tab=places")}">← ${escapeHtml(copy.back)}</a><section class="gpd-utility" aria-labelledby="gpd-title"><div class="gpd-heading"><h1 id="gpd-title">${escapeHtml(selected || local)}</h1>${local && local !== selected ? `<p class="gpd-local" lang="und">${escapeHtml(local)}</p>` : ""}${locality ? `<p class="gpd-local">${escapeHtml(locality)}</p>` : ""}</div><div class="gpd-actions">${externalMap ? `<a class="gpd-primary" href="${escapeHtml(externalMap)}" target="_blank" rel="noopener noreferrer">${escapeHtml(copy.openMap)}</a>` : ""}${save}</div><section class="gpd-show" aria-labelledby="gpd-show-title"><h2 id="gpd-show-title">${escapeHtml(copy.showLocally)}</h2><div class="gpd-show-row"><p><strong>${escapeHtml(copy.localName)}:</strong> <span data-copy-value="${escapeHtml(local)}">${escapeHtml(local)}</span></p><button type="button" class="gpd-copy" data-copy-target="${escapeHtml(local)}">${escapeHtml(copy.copy)}</button></div>${locality ? `<div class="gpd-show-row"><p><strong>${escapeHtml(copy.localAddress)}:</strong> <span data-copy-value="${escapeHtml(locality)}">${escapeHtml(locality)}</span></p><button type="button" class="gpd-copy" data-copy-target="${escapeHtml(locality)}">${escapeHtml(copy.copy)}</button></div>` : ""}</section><section class="gpd-status" aria-labelledby="gpd-status-title"><h2 id="gpd-status-title">${escapeHtml(copy.sources)}</h2><p>${escapeHtml(copy.sourceCount)}: ${sourceCount}</p><p>${escapeHtml(copy.checked)}: ${escapeHtml(latest ?? copy.unknown)}</p>${generated ? `<small>${escapeHtml(copy.generated)}: ${escapeHtml(generated)}</small>` : ""}<small>${escapeHtml(copy.disclaimer)}</small><p class="zs-status" data-zukan-saved-status aria-live="polite"></p></section></section><section class="gpd-atlas" aria-label="${escapeHtml(copy.details)}">${mapProfile}</section>${areaObsHtml}${input.nocosilUsageHtml ?? ""}</main>${renderAppExperienceNavigation(siteLang, 3, "bottom", Boolean(input.viewerAuthenticated))}${renderAppExperienceQuickCamera(siteLang)}${atlasScript}${areaObsScript}${input.viewerAuthenticated ? renderSavedItemsScript(lang) : ""}<script>(()=>{const copied=${JSON.stringify(copy.copied).replace(/</g,"\\u003c")};document.querySelectorAll('[data-copy-target]').forEach(button=>button.addEventListener('click',async()=>{const value=button.getAttribute('data-copy-target')||'';try{await navigator.clipboard.writeText(value);button.textContent=copied;}catch{const range=document.createRange();const node=button.parentElement?.querySelector('[data-copy-value]');if(node){range.selectNodeContents(node);const selection=getSelection();selection?.removeAllRanges();selection?.addRange(range);}}}));})();</script></body></html>`;
}
