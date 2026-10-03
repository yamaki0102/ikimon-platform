import type { PlaceAtlasProfile } from "../../src/services/placeAtlasContract";
import { APP_EXPERIENCE_STYLES, renderAppExperienceHeader, renderAppExperienceNavigation } from "../../src/ui/appExperience";
import { MAP_PLACE_ATLAS_PROFILE_STYLES, renderMapPlaceAtlasProfile } from "../../src/ui/mapPlaceAtlasProfile";
import { escapeHtml } from "../../src/ui/siteShell";
import type { SavedItem } from "./savedItems";
import { QUIET_HOME_STYLES, renderSavedControl, renderSavedItemsScript, type QuietHomeLang } from "./quietHome";

export type GlobalPlaceDetailLang = QuietHomeLang;

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
    openMap: "外部地図で開く", saveLogin: "ログインして保存", sources: "情報の確認",
    checked: "出典の最終確認", unknown: "確認時点は不明です", sourceCount: "出典",
    generated: "このページの生成", copy: "コピー", copied: "コピーしました", details: "この場所の図鑑",
    disclaimer: "営業時間・料金・アクセシビリティなど、確認できない情報は不明のまま扱います。",
  },
  en: {
    back: "Back to map", showLocally: "Show locally", localName: "Local name", localAddress: "Place",
    openMap: "Open external map", saveLogin: "Sign in to save", sources: "Information status",
    checked: "Latest source check", unknown: "Check time unknown", sourceCount: "Sources",
    generated: "Page assembled", copy: "Copy", copied: "Copied", details: "Place atlas",
    disclaimer: "Hours, prices and accessibility stay unknown unless a source supports them.",
  },
  es: {
    back: "Volver al mapa", showLocally: "Mostrar localmente", localName: "Nombre local", localAddress: "Lugar",
    openMap: "Abrir mapa externo", saveLogin: "Inicia sesión para guardar", sources: "Estado de la información",
    checked: "Última comprobación", unknown: "Fecha de comprobación desconocida", sourceCount: "Fuentes",
    generated: "Página generada", copy: "Copiar", copied: "Copiado", details: "Atlas del lugar",
    disclaimer: "Horarios, precios y accesibilidad permanecen desconocidos si no hay una fuente que los confirme.",
  },
  "pt-br": {
    back: "Voltar ao mapa", showLocally: "Mostrar no local", localName: "Nome local", localAddress: "Local",
    openMap: "Abrir mapa externo", saveLogin: "Entre para salvar", sources: "Estado das informações",
    checked: "Última verificação da fonte", unknown: "Data de verificação desconhecida", sourceCount: "Fontes",
    generated: "Página montada", copy: "Copiar", copied: "Copiado", details: "Atlas do local",
    disclaimer: "Horários, preços e acessibilidade permanecem desconhecidos sem uma fonte que os confirme.",
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
  viewerAuthenticated?: boolean;
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
  const locality = clean(profile.place.localityLabel);
  const latest = displayDate(latestSourceCheck(profile), lang);
  const sourceCount = profile.provenance.sourceReferences?.length ?? 0;
  const generated = displayDate(clean(profile.provenance.generatedAt), lang);
  const save = input.viewerAuthenticated
    ? renderSavedControl({ kind: "place", objectId: canonicalPlaceId, path, title: local || selected }, lang, input.savedItem ?? null)
    : `<a class="gpd-secondary" href="/auth?redirect=${encodeURIComponent(localizedPath)}">${escapeHtml(copy.saveLogin)}</a>`;
  const externalMap = externalMapHref(profile);
  const mapProfile = renderMapPlaceAtlasProfile(profile, {
    lang: siteLang,
    recordHref: prefix + "/record",
    recordsHref: prefix + "/records?view=public",
  });

  return `<!doctype html><html lang="${escapeHtml(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(selected || local)} | ZUKAN</title><style>
${APP_EXPERIENCE_STYLES}
${QUIET_HOME_STYLES}
${MAP_PLACE_ATLAS_PROFILE_STYLES}
:root{color-scheme:light}.gpd{max-width:1120px;margin:0 auto;padding:20px 20px 110px;color:#17211b}.gpd-back{display:inline-flex;align-items:center;min-height:44px;margin-bottom:16px;color:#143f2e;font-weight:700;text-underline-offset:4px}.gpd-utility{display:grid;gap:16px;padding:20px;border:1px solid #d7dfd8;border-radius:16px;background:#fbfcfa}.gpd-heading{min-width:0}.gpd-heading h1{margin:0;font-size:clamp(1.65rem,5vw,2.5rem);line-height:1.2;overflow-wrap:anywhere}.gpd-heading .gpd-local{margin:8px 0 0;color:#55615a;font-size:1rem;overflow-wrap:anywhere}.gpd-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.gpd-primary,.gpd-secondary{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:9px 14px;border-radius:6px;font:inherit;font-weight:700;text-decoration:none}.gpd-primary{border:1px solid #143f2e;background:#143f2e;color:#fff}.gpd-secondary{border:1px solid #68746c;background:#fff;color:#143f2e}.gpd-show{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;padding:16px;border-radius:12px;background:#f3f6f2}.gpd-show h2,.gpd-status h2{margin:0;font-size:1rem}.gpd-show-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center}.gpd-show-row p{margin:0;min-width:0;overflow-wrap:anywhere}.gpd-copy{min-height:44px;padding:8px 12px;border:1px solid #68746c;border-radius:6px;background:#fff;color:#143f2e;font:inherit}.gpd-status{display:grid;gap:4px;padding-top:2px}.gpd-status p{margin:0;color:#55615a}.gpd-status small{color:#68746c}.gpd-atlas{margin-top:18px}.gpd :focus-visible{outline:3px solid currentColor;outline-offset:3px}@media(min-width:768px){.gpd-utility{grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr)}.gpd-heading,.gpd-actions{grid-column:1}.gpd-show,.gpd-status{grid-column:2}.gpd-show{grid-row:1 / span 2}.gpd-status{grid-row:3}.gpd-actions{align-self:end}}@media(prefers-reduced-motion:reduce){.gpd *{scroll-behavior:auto!important;transition-duration:.01ms!important}}
</style></head><body data-zukan-app-experience="place-detail">${renderAppExperienceHeader(siteLang, 3, Boolean(input.viewerAuthenticated), "global-place-detail")}<main id="global-place-detail" tabindex="-1" class="gpd" data-global-place-detail="${escapeHtml(canonicalPlaceId)}"><a class="gpd-back" href="${escapeHtml(prefix + "/map?tab=places")}">← ${escapeHtml(copy.back)}</a><section class="gpd-utility" aria-labelledby="gpd-title"><div class="gpd-heading"><h1 id="gpd-title">${escapeHtml(selected || local)}</h1>${local && local !== selected ? `<p class="gpd-local" lang="und">${escapeHtml(local)}</p>` : ""}${locality ? `<p class="gpd-local">${escapeHtml(locality)}</p>` : ""}</div><div class="gpd-actions"><a class="gpd-primary" href="${escapeHtml(externalMap)}" target="_blank" rel="noopener noreferrer">${escapeHtml(copy.openMap)}</a>${save}</div><section class="gpd-show" aria-labelledby="gpd-show-title"><h2 id="gpd-show-title">${escapeHtml(copy.showLocally)}</h2><div class="gpd-show-row"><p><strong>${escapeHtml(copy.localName)}:</strong> <span data-copy-value="${escapeHtml(local)}">${escapeHtml(local)}</span></p><button type="button" class="gpd-copy" data-copy-target="${escapeHtml(local)}">${escapeHtml(copy.copy)}</button></div>${locality ? `<div class="gpd-show-row"><p><strong>${escapeHtml(copy.localAddress)}:</strong> <span data-copy-value="${escapeHtml(locality)}">${escapeHtml(locality)}</span></p><button type="button" class="gpd-copy" data-copy-target="${escapeHtml(locality)}">${escapeHtml(copy.copy)}</button></div>` : ""}</section><section class="gpd-status" aria-labelledby="gpd-status-title"><h2 id="gpd-status-title">${escapeHtml(copy.sources)}</h2><p>${escapeHtml(copy.sourceCount)}: ${sourceCount}</p><p>${escapeHtml(copy.checked)}: ${escapeHtml(latest ?? copy.unknown)}</p>${generated ? `<small>${escapeHtml(copy.generated)}: ${escapeHtml(generated)}</small>` : ""}<small>${escapeHtml(copy.disclaimer)}</small><p class="zs-status" data-zukan-saved-status aria-live="polite"></p></section></section><section class="gpd-atlas" aria-label="${escapeHtml(copy.details)}">${mapProfile}</section></main>${renderAppExperienceNavigation(siteLang, 3, "bottom", Boolean(input.viewerAuthenticated))}${input.viewerAuthenticated ? renderSavedItemsScript(lang) : ""}<script>(()=>{const copied=${JSON.stringify(copy.copied).replace(/</g,"\\u003c")};document.querySelectorAll('[data-copy-target]').forEach(button=>button.addEventListener('click',async()=>{const value=button.getAttribute('data-copy-target')||'';try{await navigator.clipboard.writeText(value);button.textContent=copied;}catch{const range=document.createRange();const node=button.parentElement?.querySelector('[data-copy-value]');if(node){range.selectNodeContents(node);const selection=getSelection();selection?.removeAllRanges();selection?.addRange(range);}}}));})();</script></body></html>`;
}
