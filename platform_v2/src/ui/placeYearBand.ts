import type { PlaceYearState } from "../services/placeYearState.js";
import { placeYearBandAsset } from "./placeYearBandScript.js";

export type PlaceYearBandLang = "ja" | "en" | "es" | "pt-br";

interface BandLabels {
  now: string;
  year: string;
  until: string;
  map: string;
  show: string;
  slider: string;
  place: string;
  loading: string;
  failed: string;
}

const LABELS: Record<PlaceYearBandLang, BandLabels> = {
  ja: { now: "いま", year: "年", until: "この年まで", map: "地図を重ねる", show: "表示", slider: "年", place: "場所を選ぶ", loading: "読み込み中", failed: "読み込めませんでした" },
  en: { now: "Now", year: "", until: "and earlier", map: "Overlay map", show: "Show", slider: "Year", place: "Choose place", loading: "Loading", failed: "Could not load" },
  es: { now: "Ahora", year: "", until: "y antes", map: "Superponer mapa", show: "Mostrar", slider: "Año", place: "Elegir lugar", loading: "Cargando", failed: "No se pudo cargar" },
  "pt-br": { now: "Agora", year: "", until: "e antes", map: "Sobrepor mapa", show: "Mostrar", slider: "Ano", place: "Escolher lugar", loading: "Carregando", failed: "Não foi possível carregar" },
};

export interface PlaceYearBandInput {
  lang: PlaceYearBandLang;
  basePath: string;
  currentPath: string;
  place: { id: string; label: string };
  years: number[];
  state: PlaceYearState;
  currentYear?: number;
}

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export const PLACE_YEAR_BAND_STYLES = `
.pyb{display:flex;align-items:center;gap:var(--zukan-space-4,16px);flex-wrap:wrap;max-width:var(--zukan-content-max,1200px);margin:0 auto;padding:var(--zukan-space-2,8px) var(--zukan-space-4,16px);background:var(--zukan-surface-base,#fff9ec);border-bottom:1px solid var(--zukan-border-decorative,#dde2dc);box-sizing:border-box;font-family:var(--zukan-font-sans,system-ui,sans-serif);color:var(--zukan-text-primary,#17251b)}
.pyb-place{display:inline-flex;align-items:center;gap:var(--zukan-space-2,8px);min-height:var(--zukan-control-min,44px);padding:0 var(--zukan-space-4,16px);border:1px solid var(--zukan-border-control,#52685a);border-radius:999px;background:#fff;color:var(--zukan-text-primary,#17251b);font-size:.9375rem;font-weight:700;line-height:1.3;text-decoration:none;max-width:100%;box-sizing:border-box}
.pyb-place::before{content:"";flex:none;width:10px;height:10px;border-radius:50%;background:var(--zukan-action-primary,#245c3a)}
.pyb-place span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pyb-year{display:flex;flex-direction:column;justify-content:center;min-width:5.5rem;min-height:var(--zukan-control-min,44px)}
.pyb-year strong{font-size:1rem;line-height:1.25}
.pyb-year small{font-size:.875rem;line-height:1.25;color:var(--zukan-text-secondary,#40564a)}
.pyb-range{flex:1 1 220px;min-width:0;min-height:var(--zukan-control-min,44px);display:flex;flex-direction:column;justify-content:center}
.pyb-range input[type=range]{width:100%;min-height:var(--zukan-control-min,44px);margin:0;accent-color:var(--zukan-action-primary,#245c3a);background:transparent;cursor:pointer}
.pyb-map{flex:none;min-height:var(--zukan-control-min,44px);padding:0 var(--zukan-space-4,16px);border:1px solid var(--zukan-text-primary,#17251b);border-radius:var(--zukan-radius-control,4px);background:#fff;color:var(--zukan-text-primary,#17251b);font:inherit;font-size:.9375rem;font-weight:700;cursor:pointer}
.pyb-map[aria-pressed=true]{background:#fff;border-color:var(--zukan-action-primary,#245c3a);color:var(--zukan-action-primary,#245c3a);box-shadow:inset 0 0 0 1px var(--zukan-action-primary,#245c3a)}
.pyb-submit{flex:none;min-height:var(--zukan-control-min,44px);padding:0 var(--zukan-space-4,16px);border:1px solid var(--zukan-border-control,#52685a);border-radius:var(--zukan-radius-control,4px);background:#fff;color:var(--zukan-text-primary,#17251b);font:inherit;font-size:.9375rem;font-weight:700}
.pyb-status{max-width:var(--zukan-content-max,1200px);margin:0 auto;padding:0 var(--zukan-space-4,16px);font-size:.875rem;color:var(--zukan-text-secondary,#40564a);min-height:0}
.pyb-status:empty{display:none}
@media (max-width:767px){.pyb{gap:var(--zukan-space-2,8px) var(--zukan-space-3,12px)}.pyb-place{flex:1 1 100%}.pyb-range{flex:1 1 100%;order:3}.pyb-year{flex:1 1 auto}}
`;

export function renderPlaceYearBand(input: PlaceYearBandInput): string {
  const { lang, basePath, currentPath, place, state } = input;
  const l = LABELS[lang] ?? LABELS.en;
  const currentYear = input.currentYear ?? new Date().getUTCFullYear();
  const years = [...new Set(input.years.filter((y) => Number.isInteger(y) && y >= 1900 && y <= currentYear))].sort((a, b) => a - b);
  const minYear = Math.min(years[0] ?? currentYear, state.year ?? currentYear);
  const value = state.year ?? currentYear;
  const prefix = basePath.replace(/\/+$/u, "");
  const action = `${prefix}/${lang}/`;
  const placeHref = `${prefix}/${lang}/map?tab=places&return=${encodeURIComponent(currentPath)}`;
  const yearText = state.year == null ? l.now : `${state.year}${l.year}`;
  const untilText = state.year == null ? "" : l.until;
  const mapOn = state.map;
  const options = years.map((y) => `<option value="${y}"></option>`).join("");
  const asset = placeYearBandAsset();
  return `<form class="pyb" method="get" action="${esc(action)}" data-place-year-band data-label-now="${esc(l.now)}" data-label-year="${esc(l.year)}" data-label-until="${esc(l.until)}" data-label-loading="${esc(l.loading)}" data-label-failed="${esc(l.failed)}">
<a class="pyb-place" href="${esc(placeHref)}" aria-label="${esc(l.place)}: ${esc(place.label)}"><span>${esc(place.label)}</span></a>
<input type="hidden" name="place" value="${esc(place.id)}">
<div class="pyb-year"><strong data-pyb-year>${esc(yearText)}</strong><small data-pyb-sub>${esc(untilText)}</small></div>
<div class="pyb-range"><input type="range" name="year" min="${minYear}" max="${currentYear}" step="1" value="${value}" list="pyb-years" aria-label="${esc(l.slider)}" aria-valuetext="${esc(`${yearText} ${untilText}`.trim())}"><datalist id="pyb-years">${options}</datalist></div>
<button class="pyb-map" type="submit" name="map" value="${mapOn ? "0" : "1"}" aria-pressed="${mapOn ? "true" : "false"}">${esc(l.map)}</button>
<noscript><button class="pyb-submit" type="submit">${esc(l.show)}</button></noscript>
</form>
<div class="pyb-status" role="status" aria-live="polite" data-pyb-status></div>
<script src="${esc(prefix + asset.path)}" defer></script>`;
}
