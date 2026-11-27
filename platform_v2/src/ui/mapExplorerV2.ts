import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, type SiteLang } from "../i18n.js";
import { MAPLIBRE_SELF_HOSTED_CSS_PATH, MAPLIBRE_SELF_HOSTED_JS_PATH } from "./mapExplorerAssetPaths.js";

const MAP_STANDARD_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export type MapV2TaxonChip = {
  value: "" | "plant" | "bird" | "insect" | "water" | "invasive";
  label: string;
};

export const MAP_V2_CHIP_ITEMS: readonly MapV2TaxonChip[] = [
  { value: "", label: "すべて" },
  { value: "plant", label: "植物" },
  { value: "bird", label: "鳥" },
  { value: "insect", label: "虫" },
  { value: "water", label: "水の生きもの" },
  { value: "invasive", label: "外来種" },
] as const;

export type MapV2SummaryCopyInput = {
  recordedCount: number;
  zeroCount: number;
  taxonGroup: string;
  lang?: SiteLang;
};

export function buildMapV2PlaceSummaryCopy(input: MapV2SummaryCopyInput): string {
  const isEn = input.lang === "en";
  if (input.taxonGroup) {
    return isEn ? `${input.recordedCount} matches` : `該当 ${input.recordedCount}件`;
  }
  if (input.recordedCount === 0) {
    return isEn
      ? `${input.zeroCount} places with no records yet`
      : `まだ記録のない場所 ${input.zeroCount}件`;
  }
  return isEn
    ? `${input.recordedCount} recorded · ${input.zeroCount} unrecorded`
    : `記録あり ${input.recordedCount}件 ・ まだ ${input.zeroCount}件`;
}

export type PanOnSelectionInput = {
  pinX: number;
  pinY: number;
  viewportWidth: number;
  viewportHeight: number;
  isDesktop: boolean;
  leftPanelRight: number;
  topbarBottom: number;
  sheetTop: number;
};

/** Move viewport on pin selection only if pin would be covered by sheet/panel or offscreen. */
export function shouldPanOnSelection(input: PanOnSelectionInput): boolean {
  const margin = 24;
  if (input.isDesktop) {
    return (
      input.pinX < input.leftPanelRight + margin ||
      input.pinX > input.viewportWidth - margin ||
      input.pinY < input.topbarBottom + margin ||
      input.pinY > input.viewportHeight - margin
    );
  }
  return (
    input.pinX < margin ||
    input.pinX > input.viewportWidth - margin ||
    input.pinY < input.topbarBottom + margin ||
    input.pinY > input.sheetTop - margin
  );
}

export type MapExplorerV2Options = {
  lang: SiteLang | "pt-br";
  authenticated: boolean;
  displayName?: string | null;
  basePath: string;
  cspNonce?: string | null;
  initialPlaceId?: string | null;
  invasiveCellsApi?: string | null;
};

const ICON_SEARCH =
  '<svg class="zv2-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.8-3.8"/></svg>';
const ICON_LOCATE =
  '<svg class="zv2-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/></svg>';
const ICON_CHEV =
  '<svg class="zv2-ic zv2-ic-sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const ICON_BACK =
  '<svg class="zv2-ic zv2-ic-sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const ICON_PIN =
  '<svg class="zv2-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>';
const ICON_LOGO =
  '<svg class="zv2-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 1 2-2h13M12 3v16M12 8c-1.8-.4-3-1.6-3.4-3.4C10.4 4.9 11.6 6.1 12 8zM12 8c1.8-.4 3-1.6 3.4-3.4C13.6 4.9 12.4 6.1 12 8z"/></svg>';

const TAB_ICONS = {
  home: '<svg class="zv2-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="3"/><circle cx="9" cy="9.5" r="1.6"/><path d="m4 17 5-4.5 3.5 3L15 13.5l5 4.5"/></svg>',
  events: '<svg class="zv2-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>',
  camera: '<svg class="zv2-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5h-5L8 7H5.5A2.5 2.5 0 0 0 3 9.5v8A2.5 2.5 0 0 0 5.5 20h13a2.5 2.5 0 0 0 2.5-2.5v-8A2.5 2.5 0 0 0 18.5 7H16z"/><circle cx="12" cy="13" r="3.4"/></svg>',
  places: '<svg class="zv2-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 10.2c0 5-7 10.8-7 10.8S5 15.2 5 10.2a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.4"/></svg>',
  profile: '<svg class="zv2-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.2" r="3.6"/><path d="M5 20c.6-3.7 3.4-5.6 7-5.6s6.4 1.9 7 5.6"/></svg>',
};

const MAP_V2_CSS = `
*{box-sizing:border-box}
html,body{height:100%;margin:0;padding:0;font-family:"Hiragino Kaku Gothic ProN","Hiragino Sans","Noto Sans JP",system-ui,-apple-system,sans-serif;background:#fff;color:#17211B;font-size:16px;-webkit-font-smoothing:antialiased}
.zv2-app{position:relative;width:100%;height:100vh;height:100dvh;overflow:hidden;background:#eff2ea}
svg.zv2-ic{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
svg.zv2-ic-sm{width:17px;height:17px}
a,button{font:inherit;color:inherit}

/* Header (PC) */
.zv2-pchead{display:none}

/* Full-bleed Map Canvas */
.zv2-mapwrap{position:absolute;top:0;left:0;right:0;bottom:calc(70px + env(safe-area-inset-bottom));z-index:1;background:#eff2ea}
#zv2-map-canvas{position:absolute;inset:0;width:100%;height:100%}
.zv2-locating{position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;color:#55615A;font-size:15px;font-weight:600;pointer-events:none}
.zv2-locating[hidden]{display:none}
.zv2-pin-photo{display:flex;flex-direction:column;align-items:center;pointer-events:auto;cursor:pointer}
.zv2-pin-photo img{width:52px;height:52px;border-radius:50%;border:3px solid #143F2E;object-fit:cover;background:#e8efea;box-shadow:0 2px 8px rgba(9,25,16,.4)}
.zv2-pin-photo::after{content:"";border:7px solid transparent;border-top:9px solid #143F2E;margin-top:-2px}

/* Mobile Top Search + Chips Overlay */
.zv2-topbar{position:absolute;top:0;left:0;right:0;z-index:20;padding:10px 12px 0;pointer-events:none}
.zv2-topbar>*{pointer-events:auto}
.zv2-sfield{display:flex;align-items:center;gap:8px;min-height:48px;background:#fff;border-radius:999px;padding:6px 14px;box-shadow:0 2px 10px rgba(9,25,16,.22)}
.zv2-sfield svg{color:#55615A}
.zv2-sinput{flex:1;min-width:0;border:0;outline:none;background:transparent;color:#17211B;font:inherit;font-size:16px}
.zv2-sinput::placeholder{color:#55615A;opacity:1}
.zv2-chips{display:flex;gap:7px;margin-top:9px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}
.zv2-chips::-webkit-scrollbar{display:none}
.zv2-fchip{flex:none;display:inline-flex;align-items:center;gap:5px;min-height:44px;padding:0 14px;border:0;border-radius:999px;background:#fff;color:#17211B;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap;box-shadow:0 1px 6px rgba(9,25,16,.2)}
.zv2-fchip.on{background:#143F2E;color:#fff}
.zv2-fchip[data-taxon="invasive"]{color:#8A4B00}
.zv2-fchip[data-taxon="invasive"].on{background:#8A4B00;color:#fff}

/* Map controls */
.zv2-mapbtns{position:absolute;right:12px;bottom:calc(168px + env(safe-area-inset-bottom));z-index:20;display:flex;flex-direction:column;gap:9px;align-items:flex-end;transition:bottom 240ms cubic-bezier(.2,.8,.2,1)}
.zv2-mbtn{width:46px;height:46px;border-radius:50%;border:0;background:#fff;color:#143F2E;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(9,25,16,.28)}
.zv2-zoombox{display:none;background:#fff;border-radius:14px;box-shadow:0 2px 8px rgba(9,25,16,.28);overflow:hidden;flex-direction:column}
.zv2-zb{width:46px;height:44px;border:0;background:#fff;color:#143F2E;font-size:20px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center}
.zv2-zb+.zv2-zb{border-top:1px solid #E4E9E4}
.zv2-inv-legend{position:absolute;left:12px;top:116px;z-index:18;background:rgba(255,255,255,.96);color:#8A4B00;border:1px solid #e6c9a8;border-radius:12px;padding:8px 12px;font-size:14px;font-weight:700;box-shadow:0 2px 8px rgba(9,25,16,.18)}
.zv2-inv-legend[hidden]{display:none}
.zv2-inv-sheet{padding:4px 16px 20px}
.zv2-inv-h{font-size:13px;font-weight:800;letter-spacing:.08em;color:#8A4B00;margin:4px 0 10px}
.zv2-inv-sp{padding:12px 0;border-top:1px solid #E4E9E4}
.zv2-inv-sp:first-of-type{border-top:0}
.zv2-inv-n{font-size:17px;font-weight:800;color:#17211B}
.zv2-inv-b{display:inline-flex;align-items:center;min-height:26px;padding:0 10px;margin-top:6px;border-radius:999px;background:#FBEBD6;color:#6B3A00;border:1px solid #E6C9A8;font-size:13px;font-weight:800;white-space:nowrap}
.zv2-inv-p{margin:8px 0 0;font-size:15px;line-height:1.7;color:#17211B}
.zv2-inv-a{display:flex;align-items:center;min-height:44px;margin-top:6px;color:#143F2E;font-weight:700;font-size:15px;text-decoration:none;border-top:1px solid #E4E9E4;padding-top:2px}
.zv2-inv-note{margin:10px 0 0;font-size:13.5px;color:#55615A;line-height:1.6}
.zv2-inv-close{min-height:44px;padding:0 20px;margin-top:12px;border-radius:999px;border:1.5px solid #143F2E;background:#fff;color:#143F2E;font-weight:800;font-size:15px;white-space:nowrap;cursor:pointer}
.zv2-inv-legend a{display:block;margin-top:2px;font-size:14px;color:#143F2E;text-decoration:underline}
.zv2-attrib{position:absolute;left:10px;bottom:calc(168px + env(safe-area-inset-bottom));z-index:15;font-size:12px;color:#3d4a42;background:rgba(255,255,255,.88);border-radius:6px;padding:2px 8px;pointer-events:none}

/* Desktop left panel */
.zv2-panel{display:none}

/* Mobile bottom sheet: collapsed -> half (<=45vh) -> full */
.zv2-sheet{position:absolute;left:0;right:0;bottom:calc(70px + env(safe-area-inset-bottom));z-index:30;background:#fff;border-radius:20px 20px 0 0;box-shadow:0 -3px 18px rgba(9,25,16,.22);display:flex;flex-direction:column;overflow:hidden;max-height:84px;transition:max-height 240ms cubic-bezier(.2,.8,.2,1)}
.zv2-sheet[data-sheet-state="half"]{max-height:44vh}
.zv2-sheet[data-sheet-state="full"]{max-height:calc(100vh - 144px);transition-duration:360ms}
.zv2-sheet-head{touch-action:none;user-select:none;-webkit-user-select:none;width:100%;border:0;background:#fff;text-align:left;padding:10px 18px 8px;cursor:pointer;display:grid;gap:6px;flex:none}
.zv2-grab{width:44px;height:5px;border-radius:3px;background:#DDE2DC;margin:0 auto 2px}
.zv2-peek{display:flex;align-items:center;gap:10px;min-height:28px}
.zv2-peek-ttl{font-size:16px;font-weight:800;white-space:nowrap}
.zv2-peek-sub{margin-left:auto;font-size:14px;font-weight:600;color:#55615A;text-align:right}
.zv2-sheet-body{flex:1;min-height:0;overflow-y:auto;padding:4px 18px 18px}
.zv2-sheet[data-sheet-state="collapsed"] .zv2-sheet-body{display:none}
.zv2-sheet[data-sheet-state="selected-low"]{max-height:280px}
.zv2-sheet[data-dragging="1"] .zv2-sheet-body{display:block}
@media (prefers-reduced-motion:reduce){.zv2-sheet{transition:none}}
.zv2-sheet[data-sheet-state="selected-low"] .zv2-sheet-body{display:block;overflow:hidden;padding:0 18px 14px}

/* Shared list & selected card */
.zv2-st{margin:4px 0 2px;font-size:18px;font-weight:800}
.zv2-note{font-size:14px;color:#55615A;line-height:1.55;margin-bottom:8px}
.zv2-prow{width:100%;border:0;background:transparent;text-align:left;display:flex;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid #EDF0EC;cursor:pointer;min-height:44px}
.zv2-prow img,.zv2-thumb-ph{width:56px;height:56px;border-radius:10px;object-fit:cover;background:#e8efea;flex:none;display:block}
.zv2-pmain{flex:1;min-width:0}
.zv2-pn{font-size:16px;font-weight:800;line-height:1.35;color:#17211B}
.zv2-pm{font-size:14px;color:#55615A;margin-top:2px}
.zv2-chev{margin-left:auto;color:#9DB4A6}
.zv2-zero-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;min-height:48px;padding:10px 14px;margin-top:10px;border:1px solid #DDE2DC;border-radius:12px;background:#F7F7F3;color:#17211B;font-size:14px;font-weight:700;cursor:pointer}
.zv2-zmark{width:34px;height:34px;border-radius:50%;border:2px solid #DDE2DC;display:flex;align-items:center;justify-content:center;color:#9DB4A6;flex:none}
.zv2-zero-nearest .zv2-pn{font-size:15px;font-weight:700}

/* Filter accordion inside full list (never on map) */
.zv2-refine{margin-top:16px;padding-top:12px;border-top:1px solid #EDF0EC}
.zv2-refine-btn{width:100%;min-height:44px;border:1.5px solid #DDE2DC;border-radius:12px;background:#fff;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:0 14px}
.zv2-refine-panel{margin-top:10px;display:grid;gap:10px;padding:12px;border-radius:12px;background:#F7F7F3}
.zv2-refine-panel[hidden]{display:none}
.zv2-refine-row{display:flex;gap:8px;flex-wrap:wrap}

/* Selected detail (replaces list completely) */
.zv2-backrow{display:inline-flex;align-items:center;gap:5px;min-height:44px;border:0;background:transparent;padding:0;font-size:14px;font-weight:700;color:#143F2E;cursor:pointer}
.zv2-pname{margin:2px 0 0;font-size:21px;font-weight:800;line-height:1.35}
.zv2-pmeta{font-size:14px;color:#55615A;margin-top:4px;line-height:1.5}
.zv2-pphotos{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:14px}
.zv2-pphotos img{width:100%;height:88px;object-fit:cover;border-radius:8px;background:#e8efea}
.zv2-btnrow{display:flex;gap:9px;margin-top:12px;flex-wrap:wrap}
.zv2-btn-main{flex:1;min-height:46px;padding:10px 14px;border-radius:999px;background:#143F2E;color:#fff;font-size:15px;font-weight:800;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;border:0;cursor:pointer}
.zv2-btn-sub{flex:1;min-height:46px;padding:10px 14px;border-radius:999px;background:#fff;color:#143F2E;border:1.5px solid #143F2E;font-size:15px;font-weight:800;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
.zv2-ownrow{display:flex;gap:10px;align-items:center;background:#F7F7F3;border-radius:12px;padding:11px 13px;margin-top:14px;font-size:14px;font-weight:700}
.zv2-zerobox{background:#F7F7F3;border-radius:14px;padding:14px;margin-top:12px;font-size:14px;line-height:1.65;color:#17211B}

/* Mobile bottom nav */
.zv2-tabbar{position:fixed;left:0;right:0;bottom:0;z-index:40;background:#fff;border-top:1px solid #E4E9E4;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:end;padding:6px 4px calc(6px + env(safe-area-inset-bottom))}
.zv2-tab{min-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:3px;text-decoration:none;color:#55615A;font-size:12px;line-height:1.2;font-weight:600;padding:4px 1px;white-space:nowrap}
.zv2-tab span{white-space:nowrap}
.zv2-tab svg{width:24px;height:24px}
.zv2-tab[aria-current="page"]{color:#143F2E;font-weight:800}
.zv2-tab-cap .zv2-shutter{width:46px;height:46px;border-radius:50%;background:#143F2E;color:#fff;display:flex;align-items:center;justify-content:center;margin-top:-18px;border:3px solid #fff;box-shadow:0 2px 8px rgba(9,25,16,.28)}

/* Desktop (>= 960px): single 372px left panel + full remaining canvas */
@media(min-width:960px){
  .zv2-pchead{position:absolute;top:0;left:0;right:0;height:64px;z-index:40;background:#fff;border-bottom:1px solid #E4E9E4;display:flex;align-items:center;gap:22px;padding:0 22px}
  .zv2-logo{display:flex;align-items:center;gap:8px;font-size:20px;font-weight:800;color:#143F2E;text-decoration:none}
  .zv2-pcnav{display:flex;gap:6px;margin-left:8px}
  .zv2-pcnav a{font-size:15px;font-weight:700;color:#55615A;padding:8px 14px;border-radius:999px;text-decoration:none}
  .zv2-pcnav a[aria-current="page"]{background:#EFF3EE;color:#143F2E}
  .zv2-grow{flex:1}
  .zv2-login{font-size:15px;font-weight:700;color:#143F2E;text-decoration:none;padding:8px 14px;border-radius:999px}
  .zv2-shoot{background:#143F2E;color:#fff;font-size:15px;font-weight:800;border-radius:999px;padding:10px 20px;text-decoration:none}
  .zv2-panel{display:flex;flex-direction:column;position:absolute;top:64px;left:0;bottom:0;width:372px;z-index:30;background:#fff;border-right:1px solid #E4E9E4;padding:18px 20px;overflow-y:auto}
  .zv2-pc-search{margin-bottom:12px}
  .zv2-pc-search .zv2-sfield{box-shadow:none;border:1.5px solid #DDE2DC;background:#F7F7F3}
  .zv2-pc-chips{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:8px}
  .zv2-pc-chips .zv2-fchip{box-shadow:none;border:1.5px solid #DDE2DC}
  .zv2-pc-chips .zv2-fchip.on{border-color:#143F2E}
  .zv2-mapwrap{top:64px;left:372px;right:0;bottom:0}
  .zv2-topbar,.zv2-sheet,.zv2-tabbar{display:none}
  .zv2-zoombox{display:flex}
  .zv2-mapbtns{bottom:18px;right:18px}
  .zv2-attrib{left:384px;bottom:14px}
  .zv2-inv-legend{top:16px;left:16px}
}
`;

export function renderMapExplorerV2Document(options: MapExplorerV2Options): string {
  const prefix = options.lang === "ja" ? "/ja" : `/${options.lang}`;
  const isEn = options.lang === "en";
  const nonceAttr = options.cspNonce ? ` nonce="${escapeHtml(options.cspNonce)}"` : "";
  const homeHref = options.authenticated ? `${prefix}/library` : `${prefix}/`;
  const homeLabel = options.authenticated ? (isEn ? "Library" : "ライブラリ") : (isEn ? "ホーム" : "ホーム");
  const meHref = `${prefix}/profile`;
  const meLabel = isEn ? "Me" : "自分";
  const eventsHref = `${prefix}/community/events`;
  const eventsLabel = isEn ? "Events" : "イベント";
  const recordHref = `${prefix}/record`;
  const recordLabel = isEn ? "Capture" : "撮る";
  const mapHref = `${prefix}/map`;
  const placesLabel = isEn ? "Places" : "場所";

  const chipsHtml = MAP_V2_CHIP_ITEMS.map(
    (c, idx) =>
      `<button type="button" class="zv2-fchip${idx === 0 ? " on" : ""}" data-taxon="${escapeHtml(c.value)}" aria-pressed="${idx === 0 ? "true" : "false"}">${escapeHtml(c.label)}</button>`,
  ).join("");

  const authControl = options.authenticated
    ? `<a class="zv2-login" href="${escapeHtml(meHref)}">${escapeHtml(options.displayName || meLabel)}</a>`
    : `<a class="zv2-login" href="${escapeHtml(`${prefix}/login`)}">${isEn ? "Sign in" : "ログイン"}</a>`;

  const clientConfig = JSON.stringify({
    placesApi: withBasePath(options.basePath, "/api/v1/map/places"),
    placeHrefTemplate: appendLangToHref(withBasePath(options.basePath, "/places/__ID__"), options.lang as SiteLang),
    recordHref,
    invasiveLearnHref: "/ja/learn/invasive-species",
    invasiveCellsApi: options.invasiveCellsApi ?? null,
    maplibreCss: withBasePath(options.basePath, MAPLIBRE_SELF_HOSTED_CSS_PATH),
    maplibreJs: withBasePath(options.basePath, MAPLIBRE_SELF_HOSTED_JS_PATH),
    styleUrl: MAP_STANDARD_STYLE_URL,
    authenticated: options.authenticated,
    lang: options.lang,
    initialPlaceId: options.initialPlaceId ?? null,
    defaultCenter: [137.7347, 34.7038],
    defaultZoom: 13,
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="${escapeHtml(options.lang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${isEn ? "Places" : "場所"} — ZUKAN</title>
  <link rel="stylesheet" href="${escapeHtml(withBasePath(options.basePath, MAPLIBRE_SELF_HOSTED_CSS_PATH))}" data-maplibre="1" />
  <style${nonceAttr}>${MAP_V2_CSS}</style>
</head>
<body>
<div class="zv2-app" data-map-v2="1">
  <header class="zv2-pchead">
    <a class="zv2-logo" href="${escapeHtml(`${prefix}/`)}">${ICON_LOGO}<span>ZUKAN</span></a>
    <nav class="zv2-pcnav" aria-label="${isEn ? "Primary" : "メインナビ"}">
      <a href="${escapeHtml(homeHref)}">${escapeHtml(homeLabel)}</a>
      <a href="${escapeHtml(eventsHref)}">${escapeHtml(eventsLabel)}</a>
      <a href="${escapeHtml(mapHref)}" aria-current="page">${escapeHtml(placesLabel)}</a>
      <a href="${escapeHtml(meHref)}">${escapeHtml(meLabel)}</a>
    </nav>
    <div class="zv2-grow"></div>
    ${authControl}
    <a class="zv2-shoot" href="${escapeHtml(recordHref)}">${escapeHtml(recordLabel)}</a>
  </header>

  <aside class="zv2-panel" id="zv2-panel" aria-label="${isEn ? "Nearby places" : "近くの場所"}">
    <div class="zv2-pc-search">
      <label class="zv2-sfield">
        ${ICON_SEARCH}
        <input id="zv2-search-pc" class="zv2-sinput" type="search" placeholder="場所や記録を探す" aria-label="場所や記録を探す" />
      </label>
    </div>
    <div class="zv2-pc-chips" role="group" aria-label="分類で絞る">${chipsHtml}</div>
    <div id="zv2-panel-content"></div>
  </aside>

  <div class="zv2-mapwrap" id="zv2-mapwrap">
    <div id="zv2-map-canvas" aria-label="生きものマップ"></div>
    <div class="zv2-locating" id="zv2-locating" hidden>現在地を確認中…</div>
    <div class="zv2-inv-legend" id="zv2-inv-legend" hidden>
      <div>特定外来生物を含む記録（持ち帰らない・動かさない）</div>
      <a href="/ja/learn/invasive-species">外来種の見分け方と注意点</a>
    </div>
  </div>

  <div class="zv2-topbar" id="zv2-topbar">
    <label class="zv2-sfield">
      ${ICON_SEARCH}
      <input id="zv2-search-m" class="zv2-sinput" type="search" placeholder="場所や記録を探す" aria-label="場所や記録を探す" />
    </label>
    <div class="zv2-chips" role="group" aria-label="分類で絞る">${chipsHtml}</div>
  </div>

  <div class="zv2-mapbtns" id="zv2-mapbtns">
    <div class="zv2-zoombox">
      <button type="button" class="zv2-zb" id="zv2-zoom-in" aria-label="拡大">＋</button>
      <button type="button" class="zv2-zb" id="zv2-zoom-out" aria-label="縮小">−</button>
    </div>
    <button type="button" class="zv2-mbtn" id="zv2-geoloc-btn" aria-label="現在地へ移動">${ICON_LOCATE}</button>
  </div>

  <div class="zv2-attrib">OpenFreeMap © OpenStreetMap contributors</div>

  <section class="zv2-sheet" id="zv2-sheet" data-sheet-state="collapsed" aria-label="近くの場所">
    <button type="button" class="zv2-sheet-head" id="zv2-sheet-head" aria-expanded="false">
      <span class="zv2-grab" aria-hidden="true"></span>
      <span class="zv2-peek">
        <span class="zv2-peek-ttl" id="zv2-peek-ttl">近くの場所</span>
        <span class="zv2-peek-sub" id="zv2-peek-sub">読み込み中…</span>
      </span>
    </button>
    <div class="zv2-sheet-body" id="zv2-sheet-body"></div>
  </section>

  <nav class="zv2-tabbar" aria-label="メニュー">
    <a class="zv2-tab" href="${escapeHtml(homeHref)}">${TAB_ICONS.home}<span>${escapeHtml(homeLabel)}</span></a>
    <a class="zv2-tab" href="${escapeHtml(eventsHref)}">${TAB_ICONS.events}<span>${escapeHtml(eventsLabel)}</span></a>
    <a class="zv2-tab zv2-tab-cap" href="${escapeHtml(recordHref)}"><span class="zv2-shutter">${TAB_ICONS.camera}</span><span>${escapeHtml(recordLabel)}</span></a>
    <a class="zv2-tab" href="${escapeHtml(mapHref)}" aria-current="page">${TAB_ICONS.places}<span>${escapeHtml(placesLabel)}</span></a>
    <a class="zv2-tab" href="${escapeHtml(meHref)}">${TAB_ICONS.profile}<span>${escapeHtml(meLabel)}</span></a>
  </nav>
</div>

<script${nonceAttr} id="zv2-config" type="application/json">${clientConfig}</script>
<script${nonceAttr}>
(function () {
  var cfgEl = document.getElementById('zv2-config');
  var CFG = {};
  try { CFG = cfgEl ? JSON.parse(cfgEl.textContent || '{}') : {}; } catch (_) {}

  var appEl = document.querySelector('.zv2-app');
  var sheetEl = document.getElementById('zv2-sheet');
  var locatingEl = document.getElementById('zv2-locating');
  var sheetHeadEl = document.getElementById('zv2-sheet-head');
  var peekTtlEl = document.getElementById('zv2-peek-ttl');
  var peekSubEl = document.getElementById('zv2-peek-sub');
  var sheetBodyEl = document.getElementById('zv2-sheet-body');
  var panelContentEl = document.getElementById('zv2-panel-content');
  var invLegendEl = document.getElementById('zv2-inv-legend');
  var searchM = document.getElementById('zv2-search-m');
  var searchPc = document.getElementById('zv2-search-pc');
  var zoomInBtn = document.getElementById('zv2-zoom-in');
  var zoomOutBtn = document.getElementById('zv2-zoom-out');
  var geoBtn = document.getElementById('zv2-geoloc-btn');

  var state = {
    places: [],
    nearestRecorded: null,
    selectedId: CFG.initialPlaceId || null,
    selectedExpanded: false,
    sheetState: 'collapsed',
    showZeroRows: false,
    refineOpen: false,
    placeKindFilter: '',
    onlyRecordedFilter: false,
    taxonGroup: '',
    invCells: [],
    invSel: null,
    invSpecies: '',
    invSeq: 0,
    searchQuery: '',
    userCenter: null,
    map: null,
    selectedMarker: null,
    moveTimer: null,
    fetchSeq: 0,
    lazyObserver: null
  };

  function syncChipUi() {
    document.querySelectorAll('[data-taxon]').forEach(function (btn) {
      var on = btn.getAttribute('data-taxon') === state.taxonGroup;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function isDesktop() {
    return window.innerWidth >= 960;
  }

  function placeHref(id) {
    return (CFG.placeHrefTemplate || '/ja/places/__ID__').replace('__ID__', encodeURIComponent(id));
  }

  function kindLabel(k) {
    var labels = { park: '公園', school: '学校', temple_shrine: '神社・お寺', nature_area: '自然エリア', museum: '博物館' };
    return labels[k] || 'スポット';
  }

  function haversineSq(aLat, aLng, bLat, bLng) {
    var dLat = aLat - bLat;
    var dLng = (aLng - bLng) * Math.max(Math.cos(aLat * Math.PI / 180), 0.1);
    return dLat * dLat + dLng * dLng;
  }

  function rcOf(p) { return typeof p.recordCount === 'number' ? p.recordCount : null; }

  function filteredPlaces() {
    var q = (state.searchQuery || '').trim().toLowerCase();
    return state.places.filter(function (p) {
      var rc = rcOf(p);
      if (state.placeKindFilter && p.placeKind !== state.placeKindFilter) return false;
      if (state.onlyRecordedFilter && rc === 0) return false;
      if (state.taxonGroup && !rc && !q) return false;
      if (q && String(p.name || '').toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  function summaryCopy(recLen, zeroLen) {
    if (state.taxonGroup) return '該当 ' + recLen + '件';
    if (recLen === 0) return 'まだ記録のない場所 ' + zeroLen + '件';
    return '記録あり ' + recLen + '件 ・ まだ ' + zeroLen + '件';
  }

  function setupLazyImages(rootEl) {
    if (!rootEl) return;
    var imgs = rootEl.querySelectorAll('img[data-src]');
    if (!imgs.length) return;
    if (typeof IntersectionObserver !== 'function') {
      imgs.forEach(function (img) {
        img.src = img.getAttribute('data-src');
        img.removeAttribute('data-src');
      });
      return;
    }
    if (state.lazyObserver) state.lazyObserver.disconnect();
    state.lazyObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var im = entry.target;
        var s = im.getAttribute('data-src');
        if (s) {
          im.setAttribute('src', s);
          im.removeAttribute('data-src');
        }
        state.lazyObserver.unobserve(im);
      });
    }, { root: isDesktop() ? document.getElementById('zv2-panel') : sheetBodyEl, rootMargin: '80px' });
    imgs.forEach(function (img) { state.lazyObserver.observe(img); });
  }

  function renderSelectedHtml(p, mobileLow) {
    var rc = rcOf(p);
    var isZero = rc === 0;
    var isUnk = rc === null;
    var own = CFG.authenticated && typeof p.ownCount === 'number' && p.ownCount > 0 ? p.ownCount : 0;
    var h = '<button type="button" class="zv2-backrow" data-zv2-back="1">' + ${JSON.stringify(ICON_BACK)} + '<span>近くの場所へ戻る</span></button>';
    h += '<h2 class="zv2-pname">' + esc(p.name) + '</h2>';
    if (isZero) {
      h += '<div class="zv2-pmeta">' + esc(kindLabel(p.placeKind)) + ' ・ まだ記録がありません</div>';
      if (!mobileLow) {
        h += '<div class="zv2-zerobox">まだ記録がありません。最初の記録を残すと、この場所の図鑑が始まります。</div>';
      }
      h += '<div class="zv2-btnrow">';
      h += '<a class="zv2-btn-main" href="' + esc(CFG.recordHref + '?placeId=' + encodeURIComponent(p.placeId)) + '">ここで最初の記録を</a>';
      if (!mobileLow) {
        h += '<a class="zv2-btn-sub" href="' + esc(placeHref(p.placeId)) + '">この場所を見る</a>';
      }
      h += '</div>';
      return h;
    }

    var spText = typeof p.speciesCount === 'number' && p.speciesCount > 0 ? ' ・ ' + p.speciesCount + '種類' : '';
    h += '<div class="zv2-pmeta">' + (isUnk ? esc(kindLabel(p.placeKind)) : '記録 ' + rc + '件' + esc(spText)) + '</div>';
    if (!mobileLow) {
      var photos = Array.isArray(p.photos) && p.photos.length ? p.photos.slice(0, 3) : (p.photoUrl ? [p.photoUrl] : []);
      if (photos.length) {
        h += '<div class="zv2-pphotos">' + photos.map(function (u) {
          return '<img src="' + esc(u) + '" alt="" loading="lazy" decoding="async" />';
        }).join('') + '</div>';
      }
    }
    h += '<div class="zv2-btnrow">';
    h += '<a class="zv2-btn-main" href="' + esc(placeHref(p.placeId)) + '">この場所を見る</a>';
    if (!mobileLow) {
      h += '<a class="zv2-btn-sub" href="' + esc(CFG.recordHref + '?placeId=' + encodeURIComponent(p.placeId)) + '">ここで記録する</a>';
    }
    h += '</div>';
    if (!mobileLow && own > 0) {
      h += '<div class="zv2-ownrow">あなたの撮影 ' + own + '件（自分だけに表示）</div>';
    }
    return h;
  }

  function renderListHtml(rec, zero) {
    var h = '<h2 class="zv2-st">近くの場所</h2>';
    if (rec.length === 0) {
      h += '<div class="zv2-note">この範囲にはまだ記録のある場所がありません。</div>';
      if (state.nearestRecorded) {
        h += '<div class="zv2-btnrow" style="margin:6px 0 12px;"><button type="button" class="zv2-btn-main" data-zv2-nearest-recorded="1">記録のある最寄りへ</button></div>';
      }
      var refCenter = state.userCenter || (state.map ? state.map.getCenter() : { lat: CFG.defaultCenter[1], lng: CFG.defaultCenter[0] });
      var nearZeros = zero.slice().sort(function (a, b) {
        return haversineSq(refCenter.lat, refCenter.lng, a.lat, a.lng) - haversineSq(refCenter.lat, refCenter.lng, b.lat, b.lng);
      }).slice(0, 5);
      h += nearZeros.map(function (p) {
        return '<button type="button" class="zv2-prow zv2-zero-nearest" data-zv2-select-place="' + esc(p.placeId) + '">'
          + '<span class="zv2-zmark">' + ${JSON.stringify(ICON_PIN)} + '</span>'
          + '<span class="zv2-pmain"><span class="zv2-pn">' + esc(p.name) + '</span><br><span class="zv2-pm">' + esc(kindLabel(p.placeKind)) + ' ・ まだ記録がありません</span></span>'
          + '<span class="zv2-chev">' + ${JSON.stringify(ICON_CHEV)} + '</span></button>';
      }).join('');
      return h;
    }

    h += '<div class="zv2-note">地図に出ている場所です。近い順に並んでいます。</div>';
    h += rec.map(function (p) {
      var imgHtml = p.photoUrl
        ? '<img data-src="' + esc(p.photoUrl) + '" alt="" loading="lazy" decoding="async" />'
        : '<span class="zv2-thumb-ph" aria-hidden="true"></span>';
      return '<button type="button" class="zv2-prow" data-zv2-select-place="' + esc(p.placeId) + '">'
        + imgHtml
        + '<span class="zv2-pmain"><span class="zv2-pn">' + esc(p.name) + '</span><br><span class="zv2-pm">' + (rcOf(p) === null ? esc(kindLabel(p.placeKind)) : '記録 ' + p.recordCount + '件') + '</span></span>'
        + '<span class="zv2-chev">' + ${JSON.stringify(ICON_CHEV)} + '</span></button>';
    }).join('');

    if (zero.length > 0 && !state.taxonGroup) {
      h += '<button type="button" class="zv2-zero-toggle" data-zv2-zero-toggle="1" aria-expanded="' + (state.showZeroRows ? 'true' : 'false') + '">'
        + '<span>まだ記録のない場所 ' + zero.length + 'か所</span>'
        + '<span>' + (state.showZeroRows ? '閉じる' : '開く') + '</span></button>';
      if (state.showZeroRows) {
        h += zero.slice(0, 30).map(function (p) {
          return '<button type="button" class="zv2-prow zv2-zero-nearest" data-zv2-select-place="' + esc(p.placeId) + '">'
            + '<span class="zv2-zmark">' + ${JSON.stringify(ICON_PIN)} + '</span>'
            + '<span class="zv2-pmain"><span class="zv2-pn">' + esc(p.name) + '</span><br><span class="zv2-pm">' + esc(kindLabel(p.placeKind)) + ' ・ まだ記録がありません</span></span>'
            + '<span class="zv2-chev">' + ${JSON.stringify(ICON_CHEV)} + '</span></button>';
        }).join('');
      }
    }

    if (state.sheetState === 'full' || isDesktop()) {
      h += '<div class="zv2-refine"><button type="button" class="zv2-refine-btn" data-zv2-refine-toggle="1" aria-expanded="' + (state.refineOpen ? 'true' : 'false') + '"><span>詳しく絞り込む</span><span>' + (state.refineOpen ? '−' : '＋') + '</span></button>'
        + '<div class="zv2-refine-panel"' + (state.refineOpen ? '' : ' hidden') + '>'
        + '<div class="zv2-refine-row">'
        + '<button type="button" class="zv2-fchip' + (state.placeKindFilter === '' ? ' on' : '') + '" data-zv2-kind="">すべて</button>'
        + '<button type="button" class="zv2-fchip' + (state.placeKindFilter === 'park' ? ' on' : '') + '" data-zv2-kind="park">公園</button>'
        + '<button type="button" class="zv2-fchip' + (state.placeKindFilter === 'temple_shrine' ? ' on' : '') + '" data-zv2-kind="temple_shrine">神社・お寺</button>'
        + '</div>'
        + '<div class="zv2-refine-row">'
        + '<button type="button" class="zv2-fchip' + (state.onlyRecordedFilter ? ' on' : '') + '" data-zv2-only-recorded="1">記録ありのみ</button>'
        + '</div></div></div>';
    }
    return h;
  }

  function invActive() { return Boolean(CFG.invasiveCellsApi) && state.taxonGroup === 'invasive'; }

  function invCellById(id) {
    for (var i = 0; i < state.invCells.length; i++) { if (state.invCells[i].cellId === id) return state.invCells[i]; }
    return null;
  }

  function renderInvCellHtml(cell) {
    var h = '<div class="zv2-inv-sheet" data-zv2-inv-sheet="1"><div class="zv2-inv-h">この範囲で見つかっている外来種</div>';
    cell.species.forEach(function (sp) {
      var range = sp.first && sp.last ? (sp.first === sp.last ? sp.first : sp.first + '〜' + sp.last) : '';
      h += '<div class="zv2-inv-sp"><div class="zv2-inv-n">' + esc(sp.name) + '</div><span class="zv2-inv-b">' + esc(sp.categoryLabel) + '</span>'
        + '<p class="zv2-inv-p">この範囲の記録 ' + sp.records + '件で確認されています' + (range ? '（' + esc(range) + '）' : '') + '。</p>'
        + '<a class="zv2-inv-a" href="' + esc('/ja/invasive/' + encodeURIComponent(sp.slug)) + '">この種について見る</a></div>';
    });
    h += '<p class="zv2-inv-note">場所は大まかに表示しています。新しい記録は、名前の確認が済んでから出ます。</p>'
      + '<button type="button" class="zv2-inv-close" data-zv2-inv-close="1">閉じる</button></div>';
    return h;
  }

  function invCellPolygon(c) {
    var d = c.halfStep;
    return [[c.lng - d, c.lat - d], [c.lng + d, c.lat - d], [c.lng + d, c.lat + d], [c.lng - d, c.lat + d], [c.lng - d, c.lat - d]];
  }

  function syncInvLayers() {
    var m = state.map;
    if (!m || typeof m.getSource !== 'function') return;
    var src = m.getSource('zv2-inv');
    if (!src) return;
    var cells = invActive() ? state.invCells : [];
    src.setData({
      type: 'FeatureCollection',
      features: cells.map(function (c) {
        return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [invCellPolygon(c)] }, properties: { cellId: c.cellId, count: c.count, label: '外来種 ' + c.count + '件' } };
      })
    });
    if (m.getLayer('zv2-inv-sel')) m.setFilter('zv2-inv-sel', ['==', ['get', 'cellId'], state.invSel || '']);
  }

  function fetchInvCells() {
    if (!invActive()) {
      state.invCells = [];
      state.invSel = null;
      syncInvLayers();
      return;
    }
    var seq = ++state.invSeq;
    var q = state.invSpecies ? '?species=' + encodeURIComponent(state.invSpecies) : '';
    fetch(CFG.invasiveCellsApi + q, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (seq !== state.invSeq || !d || !Array.isArray(d.cells)) return;
        state.invCells = d.cells;
        if (state.invSel && !invCellById(state.invSel)) state.invSel = null;
        renderUI();
      })
      .catch(function () {});
  }

  function selectInvCell(id) {
    state.invSel = id;
    state.selectedId = null;
    state.selectedExpanded = false;
    renderUI();
  }

  function renderUI() {
    var list = filteredPlaces();
    var rec = list.filter(function (p) { return rcOf(p) !== 0; });
    var zero = list.filter(function (p) { return rcOf(p) === 0; });
    var sel = state.selectedId ? state.places.find(function (p) { return p.placeId === state.selectedId; }) || null : null;

    if (invLegendEl) invLegendEl.hidden = state.taxonGroup !== 'invasive';

    var invCell = invActive() && state.invSel && !sel ? invCellById(state.invSel) : null;
    if (invCell) {
      var invState = state.sheetState === 'collapsed' ? 'half' : state.sheetState;
      if (sheetEl) sheetEl.setAttribute('data-sheet-state', invState);
      if (peekTtlEl) peekTtlEl.textContent = '外来種 ' + invCell.count + '件';
      if (peekSubEl) peekSubEl.textContent = 'この範囲で見つかっている外来種';
      if (sheetHeadEl) sheetHeadEl.setAttribute('aria-expanded', 'true');
      var invHtml = renderInvCellHtml(invCell);
      if (sheetBodyEl) sheetBodyEl.innerHTML = invHtml;
      if (panelContentEl) panelContentEl.innerHTML = invHtml;
      syncMapData(rec, zero, null);
      return;
    }

    if (sel) {
      var mobileLow = !state.selectedExpanded;
      if (sheetEl) {
        sheetEl.setAttribute('data-sheet-state', mobileLow ? 'selected-low' : 'half');
      }
      if (peekTtlEl) peekTtlEl.textContent = sel.name;
      if (peekSubEl) peekSubEl.textContent = mobileLow ? '引き上げて詳しく見る' : '閉じて一覧へ';
      if (sheetHeadEl) sheetHeadEl.setAttribute('aria-expanded', mobileLow ? 'false' : 'true');
      if (sheetBodyEl) sheetBodyEl.innerHTML = renderSelectedHtml(sel, mobileLow);
      if (panelContentEl) panelContentEl.innerHTML = renderSelectedHtml(sel, false);
    } else {
      if (sheetEl) sheetEl.setAttribute('data-sheet-state', state.sheetState);
      if (peekTtlEl) peekTtlEl.textContent = '近くの場所';
      if (peekSubEl) peekSubEl.textContent = summaryCopy(rec.length, zero.length);
      if (sheetHeadEl) sheetHeadEl.setAttribute('aria-expanded', state.sheetState === 'collapsed' ? 'false' : 'true');
      var listHtml = renderListHtml(rec, zero);
      if (sheetBodyEl) sheetBodyEl.innerHTML = listHtml;
      if (panelContentEl) panelContentEl.innerHTML = listHtml;
    }

    setupLazyImages(isDesktop() ? panelContentEl : sheetBodyEl);
    syncMapData(rec, zero, sel);
  }

  function syncSelectedMarker(sel) {
    if (state.selectedMarker) {
      state.selectedMarker.remove();
      state.selectedMarker = null;
    }
    if (!sel || !sel.photoUrl || !state.map || !window.maplibregl) return;
    var el = document.createElement('div');
    el.className = 'zv2-pin-photo';
    el.setAttribute('data-zv2-photo-pin', sel.placeId);
    var im = document.createElement('img');
    im.src = sel.photoUrl;
    im.alt = sel.name || '';
    el.appendChild(im);
    state.selectedMarker = new window.maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([sel.lng, sel.lat])
      .addTo(state.map);
  }

  function syncMapData(rec, zero, sel) {
    syncSelectedMarker(sel);
    syncInvLayers();
    if (!state.map) return;
    var recSrc = state.map.getSource('zv2-recorded');
    if (recSrc) {
      recSrc.setData({
        type: 'FeatureCollection',
        features: rec.map(function (p) {
          return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
            properties: {
              placeId: p.placeId,
              name: p.name,
              recordCount: rcOf(p) === null ? '' : p.recordCount,
              sortKey: -(p.recordCount || 0)
            }
          };
        })
      });
    }
    var zeroSrc = state.map.getSource('zv2-zero');
    if (zeroSrc) {
      zeroSrc.setData({
        type: 'FeatureCollection',
        features: zero.map(function (p) {
          return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
            properties: { placeId: p.placeId, name: p.name }
          };
        })
      });
    }
    var selId = sel ? sel.placeId : '';
    if (state.map.getLayer('zv2-zero-sel')) state.map.setFilter('zv2-zero-sel', ['==', ['get', 'placeId'], selId]);
    if (state.map.getLayer('zv2-sel-label')) state.map.setFilter('zv2-sel-label', ['==', ['get', 'placeId'], selId]);
  }

  function enrichPlace(sel) {
    sel.enrichTried = true;
    var params = new URLSearchParams();
    params.set('v2', '1');
    params.set('limit', '3');
    params.set('radiusKm', '0.05');
    params.set('lat', Number(sel.lat).toFixed(6));
    params.set('lng', Number(sel.lng).toFixed(6));
    fetch(CFG.placesApi + '?' + params.toString(), { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !Array.isArray(d.places)) return;
        var got = d.places.find(function (p) { return p.placeId === sel.placeId; });
        if (!got || typeof got.recordCount !== 'number') return;
        var cur = state.places.find(function (p) { return p.placeId === sel.placeId; });
        if (!cur) return;
        cur.recordCount = got.recordCount;
        cur.photoUrl = got.photoUrl || cur.photoUrl || null;
        cur.photos = got.photos && got.photos.length ? got.photos : (cur.photos || []);
        cur.latestRecord = got.latestRecord || cur.latestRecord || null;
        renderUI();
      })
      .catch(function () {});
  }

  function selectPlace(placeId) {
    state.selectedId = placeId;
    state.selectedExpanded = false;
    var sel = state.places.find(function (p) { return p.placeId === placeId; });
    renderUI();
    if (sel && rcOf(sel) === null && !sel.enrichTried) enrichPlace(sel);
    if (sel && state.map && typeof state.map.project === 'function') {
      var pt = state.map.project([sel.lng, sel.lat]);
      var sheetRect = sheetEl ? sheetEl.getBoundingClientRect() : { top: window.innerHeight };
      var topRect = document.getElementById('zv2-topbar') ? document.getElementById('zv2-topbar').getBoundingClientRect() : { bottom: 64 };
      var pan = (function () {
        if (isDesktop()) {
          return pt.x < 396 || pt.x > window.innerWidth - 24 || pt.y < 88 || pt.y > window.innerHeight - 24;
        }
        var lowTop = sheetRect.bottom - 280;
        return pt.x < 24 || pt.x > window.innerWidth - 24 || pt.y < topRect.bottom + 24 || pt.y > Math.max(sheetRect.top, lowTop) - 24;
      })();
      if (pan) {
        state.map.easeTo({ center: [sel.lng, sel.lat] });
      }
    }
  }

  function fetchPlaces() {
    var center = state.map ? state.map.getCenter() : { lat: CFG.defaultCenter[1], lng: CFG.defaultCenter[0] };
    var seq = ++state.fetchSeq;
    var params = new URLSearchParams();
    params.set('v2', '1');
    params.set('limit', '400');
    params.set('lat', Number(center.lat).toFixed(5));
    params.set('lng', Number(center.lng).toFixed(5));
    params.set('radiusKm', '15');
    if (state.taxonGroup) params.set('taxon_group', state.taxonGroup);
    if (state.searchQuery.trim()) params.set('q', state.searchQuery.trim());
    fetch(CFG.placesApi + '?' + params.toString(), { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (seq !== state.fetchSeq || !d || !Array.isArray(d.places)) return;
        state.places = d.places;
        state.nearestRecorded = d.nearestRecorded || null;
        if (appEl) appEl.setAttribute('data-zv2-loaded', '1');
        renderUI();
      })
      .catch(function () {});
  }

  function bindUiEvents() {
    if (sheetHeadEl) {
      var drag = null;
      function snapTargets() {
        var headH = sheetHeadEl.offsetHeight;
        var vh = window.innerHeight;
        if (state.selectedId) {
          var lowH = Math.min(280, headH + sheetBodyEl.scrollHeight);
          return { cur: state.selectedExpanded ? 2 : 1, list: [{ h: headH, act: 'close' }, { h: lowH, act: 'low' }, { h: Math.max(lowH + 40, vh * 0.44), act: 'expanded' }] };
        }
        return { cur: Math.max(0, ['collapsed', 'half', 'full'].indexOf(state.sheetState)), list: [{ h: headH, act: 'collapsed' }, { h: vh * 0.44, act: 'half' }, { h: vh - 144, act: 'full' }] };
      }
      function applySnap(act) {
        if (act === 'close') {
          state.selectedId = null;
          state.selectedExpanded = false;
          state.sheetState = 'collapsed';
        } else if (act === 'low') {
          state.selectedExpanded = false;
        } else if (act === 'expanded') {
          state.selectedExpanded = true;
        } else {
          state.sheetState = act;
        }
        renderUI();
      }
      function beginDrag(y) {
        drag = { y0: y, h0: sheetEl.getBoundingClientRect().height, active: false, dy: 0, last: [{ t: Date.now(), y: y }] };
      }
      function moveDrag(y) {
        if (!drag) return false;
        var dy = y - drag.y0;
        if (!drag.active) {
          if (Math.abs(dy) < 8) return false;
          drag.active = true;
          sheetEl.setAttribute('data-dragging', '1');
          sheetEl.style.transition = 'none';
        }
        drag.dy = dy;
        drag.last.push({ t: Date.now(), y: y });
        if (drag.last.length > 6) drag.last.shift();
        var h = Math.max(sheetHeadEl.offsetHeight, Math.min(window.innerHeight - 144, drag.h0 - dy));
        sheetEl.style.maxHeight = h + 'px';
        return true;
      }
      function finishDrag(cancel) {
        if (!drag) return;
        var d = drag;
        drag = null;
        if (!d.active) return;
        state.dragEndAt = Date.now();
        var curH = sheetEl.getBoundingClientRect().height;
        var first = d.last[0];
        var lastS = d.last[d.last.length - 1];
        var vel = lastS.t > first.t ? (lastS.y - first.y) / (lastS.t - first.t) : 0;
        var snaps = snapTargets();
        var idx = snaps.cur;
        if (!cancel) {
          var bestD = Infinity;
          snaps.list.forEach(function (sp, i) {
            var dd = Math.abs(sp.h - curH);
            if (dd < bestD) { bestD = dd; idx = i; }
          });
          if (Math.abs(vel) > 0.35 && Math.abs(d.dy) >= 8) {
            var dir = vel < 0 ? 1 : -1;
            if ((idx - snaps.cur) * dir <= 0) idx = Math.max(0, Math.min(snaps.list.length - 1, snaps.cur + dir));
          }
        }
        sheetEl.removeAttribute('data-dragging');
        sheetEl.style.transition = '';
        sheetEl.style.maxHeight = '';
        applySnap(snaps.list[idx].act);
      }
      sheetHeadEl.addEventListener('pointerdown', function (ev) {
        if (!sheetEl || (typeof ev.button === 'number' && ev.button > 0)) return;
        beginDrag(ev.clientY);
        drag.id = ev.pointerId;
        try { sheetHeadEl.setPointerCapture(ev.pointerId); } catch (_) {}
      });
      sheetHeadEl.addEventListener('pointermove', function (ev) {
        if (!drag || ev.pointerId !== drag.id) return;
        if (moveDrag(ev.clientY)) ev.preventDefault();
      });
      function endPointer(ev, cancel) {
        if (drag && drag.id === ev.pointerId) {
          try { sheetHeadEl.releasePointerCapture(ev.pointerId); } catch (_) {}
          finishDrag(cancel);
        }
      }
      sheetHeadEl.addEventListener('pointerup', function (ev) { endPointer(ev, false); });
      sheetHeadEl.addEventListener('pointercancel', function (ev) { endPointer(ev, true); });
      if (sheetBodyEl) {
        var bodyTouch = false;
        sheetBodyEl.addEventListener('touchstart', function (ev) {
          if (!ev.touches || ev.touches.length !== 1) { bodyTouch = false; return; }
          bodyTouch = true;
          beginDrag(ev.touches[0].clientY);
          drag.id = 'body';
        }, { passive: true });
        sheetBodyEl.addEventListener('touchmove', function (ev) {
          if (!bodyTouch || !drag || drag.id !== 'body' || !ev.touches || !ev.touches.length) return;
          var y = ev.touches[0].clientY;
          if (!drag.active) {
            var dy0 = y - drag.y0;
            if (Math.abs(dy0) < 8) return;
            var snaps0 = snapTargets();
            var downAtTop = dy0 > 0 && sheetBodyEl.scrollTop <= 0;
            var upToExpand = dy0 < 0 && snaps0.cur < snaps0.list.length - 1;
            if (!downAtTop && !upToExpand) { drag = null; bodyTouch = false; return; }
          }
          if (moveDrag(y) && ev.cancelable) ev.preventDefault();
        }, { passive: false });
        var endBody = function (cancel) {
          if (bodyTouch && drag && drag.id === 'body') finishDrag(cancel);
          bodyTouch = false;
        };
        sheetBodyEl.addEventListener('touchend', function () { endBody(false); });
        sheetBodyEl.addEventListener('touchcancel', function () { endBody(true); });
      }
      sheetHeadEl.addEventListener('click', function () {
        if (Date.now() - (state.dragEndAt || 0) < 400) return;
        if (state.selectedId) {
          state.selectedExpanded = !state.selectedExpanded;
        } else {
          state.sheetState = state.sheetState === 'collapsed' ? 'half' : (state.sheetState === 'half' ? 'full' : 'collapsed');
        }
        renderUI();
      });
    }

    document.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('button') : null;
      if (!t) return;
      if (t.hasAttribute('data-zv2-inv-close')) {
        state.invSel = null;
        renderUI();
        return;
      }
      if (t.hasAttribute('data-zv2-back')) {
        state.selectedId = null;
        state.selectedExpanded = false;
        state.sheetState = 'half';
        renderUI();
        return;
      }
      var selId = t.getAttribute('data-zv2-select-place');
      if (selId) { selectPlace(selId); return; }
      if (t.hasAttribute('data-zv2-zero-toggle')) {
        state.showZeroRows = !state.showZeroRows;
        renderUI();
        return;
      }
      if (t.hasAttribute('data-zv2-refine-toggle')) {
        state.refineOpen = !state.refineOpen;
        renderUI();
        return;
      }
      if (t.hasAttribute('data-zv2-kind')) {
        state.placeKindFilter = t.getAttribute('data-zv2-kind') || '';
        renderUI();
        return;
      }
      if (t.hasAttribute('data-zv2-only-recorded')) {
        state.onlyRecordedFilter = !state.onlyRecordedFilter;
        renderUI();
        return;
      }
      if (t.hasAttribute('data-zv2-nearest-recorded') && state.nearestRecorded) {
        if (state.map) state.map.easeTo({ center: [state.nearestRecorded.lng, state.nearestRecorded.lat], zoom: 14 });
        selectPlace(state.nearestRecorded.placeId);
        return;
      }
      if (t.hasAttribute('data-taxon')) {
        var next = t.getAttribute('data-taxon') || '';
        state.taxonGroup = next;
        state.invSel = null;
        state.invSpecies = '';
        syncChipUi();
        fetchPlaces();
        fetchInvCells();
      }
    });

    function onSearch(val) {
      state.searchQuery = val;
      if (searchM && searchM.value !== val) searchM.value = val;
      if (searchPc && searchPc.value !== val) searchPc.value = val;
      clearTimeout(state.moveTimer);
      state.moveTimer = setTimeout(fetchPlaces, 250);
    }
    if (searchM) searchM.addEventListener('input', function () { onSearch(searchM.value); });
    if (searchPc) searchPc.addEventListener('input', function () { onSearch(searchPc.value); });

    if (zoomInBtn) zoomInBtn.addEventListener('click', function () { if (state.map) state.map.zoomIn(); });
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', function () { if (state.map) state.map.zoomOut(); });
    if (geoBtn) {
      geoBtn.addEventListener('click', function () {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(function (pos) {
          state.userCenter = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (state.map) state.map.easeTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14 });
        });
      });
    }
  }

  var GEO_KEY = 'zv2-last-fix';
  function readStoredFix() {
    try {
      var o = JSON.parse(window.localStorage.getItem(GEO_KEY) || 'null');
      if (!o || !isFinite(o.lat) || !isFinite(o.lng) || !o.t || Date.now() - o.t > 86400000) return null;
      return o;
    } catch (_) { return null; }
  }
  function storeFix(lat, lng) {
    try { window.localStorage.setItem(GEO_KEY, JSON.stringify({ lat: lat, lng: lng, t: Date.now() })); } catch (_) {}
  }
  function distMeters(aLat, aLng, bLat, bLng) {
    var dy = (aLat - bLat) * 111320;
    var dx = (aLng - bLng) * 111320 * Math.cos(aLat * Math.PI / 180);
    return Math.sqrt(dx * dx + dy * dy);
  }

  function initMap() {
    if (!window.maplibregl) return;
    var sp = new URLSearchParams(window.location.search);
    var qLat = parseFloat(sp.get('lat') || '');
    var qLng = parseFloat(sp.get('lng') || '');
    var qZoom = parseFloat(sp.get('z') || '');
    var hasUrlCenter = isFinite(qLat) && isFinite(qLng) && Math.abs(qLat) <= 90 && Math.abs(qLng) <= 180;
    var zoomParam = isFinite(qZoom) && qZoom >= 0 && qZoom <= 22 ? qZoom : null;
    var created = false;
    function build(center, zoom) {
      if (created) return;
      created = true;
      if (locatingEl) locatingEl.hidden = true;
      createMap(center, zoom);
    }
    if (hasUrlCenter) {
      build([qLng, qLat], zoomParam !== null ? zoomParam : CFG.defaultZoom);
      return;
    }
    function applyFix(pos) {
      var lat = pos.coords.latitude;
      var lng = pos.coords.longitude;
      if (!isFinite(lat) || !isFinite(lng)) return;
      storeFix(lat, lng);
      state.userCenter = { lat: lat, lng: lng };
      if (!created) {
        build([lng, lat], zoomParam !== null ? zoomParam : 15);
        return;
      }
      var m = state.map;
      if (!m || state.userMoved) return;
      var c = m.getCenter();
      if (distMeters(c.lat, c.lng, lat, lng) > 150) m.jumpTo({ center: [lng, lat] });
    }
    var stored = readStoredFix();
    if (stored) {
      state.userCenter = { lat: stored.lat, lng: stored.lng };
      build([stored.lng, stored.lat], zoomParam !== null ? zoomParam : 15);
    } else if (navigator.geolocation) {
      if (locatingEl) locatingEl.hidden = false;
      setTimeout(function () { build(CFG.defaultCenter, zoomParam !== null ? zoomParam : CFG.defaultZoom); }, 1500);
    } else {
      build(CFG.defaultCenter, zoomParam !== null ? zoomParam : CFG.defaultZoom);
    }
    if (navigator.geolocation) {
      var onErr = function () { if (!created) build(CFG.defaultCenter, zoomParam !== null ? zoomParam : CFG.defaultZoom); };
      navigator.geolocation.getCurrentPosition(applyFix, onErr, { enableHighAccuracy: false, maximumAge: 60000, timeout: 4000 });
      try {
        var wid = navigator.geolocation.watchPosition(function (pos) {
          navigator.geolocation.clearWatch(wid);
          applyFix(pos);
        }, function () {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 });
        setTimeout(function () { navigator.geolocation.clearWatch(wid); }, 9000);
      } catch (_) {}
    }
  }

  function applyJapaneseMapLabels(targetMap) {
    if (!targetMap || typeof targetMap.getStyle !== 'function' || typeof targetMap.setLayoutProperty !== 'function') return;
    var style = targetMap.getStyle();
    var layers = style && Array.isArray(style.layers) ? style.layers : [];
    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];
      if (!layer || !layer.id || layer.id.indexOf('zv2-') === 0) continue;
      if (layer.type !== 'symbol') continue;
      if (!layer.layout || !layer.layout['text-field']) continue;
      try {
        targetMap.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:ja'], ['get', 'name']]);
      } catch (_) {}
    }
  }

  function createMap(startCenter, startZoom) {
    var map = new window.maplibregl.Map({
      container: 'zv2-map-canvas',
      style: CFG.styleUrl,
      center: startCenter,
      zoom: startZoom,
      attributionControl: false
    });
    state.map = map;
    map.on('dragstart', function () { state.userMoved = true; });
    map.on('load', function () {
      applyJapaneseMapLabels(map);
      try {
        var cv = document.createElement('canvas');
        cv.width = 58; cv.height = 34;
        var ctx = cv.getContext && cv.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#2E6B4C';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') { ctx.roundRect(2, 2, 54, 30, 12); } else { ctx.rect(2, 2, 54, 30); }
          ctx.fill();
          ctx.stroke();
          var imgData = ctx.getImageData(0, 0, 58, 34);
          if (imgData && typeof map.addImage === 'function') map.addImage('zv2-cluster-badge', imgData);
        }
      } catch (_) {}
      map.addSource('zv2-recorded', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 48
      });
      map.addSource('zv2-zero', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: false
      });
      map.addSource('zv2-inv', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'zv2-inv-fill', type: 'fill', source: 'zv2-inv', paint: { 'fill-color': '#C9731A', 'fill-opacity': 0.3, 'fill-opacity-transition': { duration: 240 } } });
      map.addLayer({ id: 'zv2-inv-line', type: 'line', source: 'zv2-inv', paint: { 'line-color': '#8A4B00', 'line-width': 1.5 } });
      map.addLayer({ id: 'zv2-inv-sel', type: 'line', source: 'zv2-inv', filter: ['==', ['get', 'cellId'], ''], paint: { 'line-color': '#8A4B00', 'line-width': 4 } });
      map.addLayer({ id: 'zv2-inv-label', type: 'symbol', source: 'zv2-inv', layout: { 'text-field': ['get', 'label'], 'text-size': 13, 'text-allow-overlap': true }, paint: { 'text-color': '#6B3A00', 'text-halo-color': '#ffffff', 'text-halo-width': 2 } });
      map.addLayer({
        id: 'zv2-clusters',
        type: 'symbol',
        source: 'zv2-recorded',
        filter: ['has', 'point_count'],
        layout: {
          'icon-image': 'zv2-cluster-badge',
          'icon-allow-overlap': true,
          'text-field': ['concat', ['to-string', ['get', 'point_count']], 'か所'],
          'text-size': 13,
          'text-allow-overlap': true
        },
        paint: { 'text-color': '#ffffff' }
      });
      map.addLayer({
        id: 'zv2-rec-pin',
        type: 'circle',
        source: 'zv2-recorded',
        filter: ['!', ['has', 'point_count']],
        paint: { 'circle-color': '#143F2E', 'circle-radius': 17, 'circle-stroke-width': 2.5, 'circle-stroke-color': '#ffffff' }
      });
      map.addLayer({
        id: 'zv2-rec-count',
        type: 'symbol',
        source: 'zv2-recorded',
        filter: ['!', ['has', 'point_count']],
        layout: { 'text-field': ['to-string', ['get', 'recordCount']], 'text-size': 13, 'text-allow-overlap': true },
        paint: { 'text-color': '#ffffff' }
      });
      map.addLayer({
        id: 'zv2-rec-label',
        type: 'symbol',
        source: 'zv2-recorded',
        filter: ['!', ['has', 'point_count']],
        layout: { 'text-field': ['get', 'name'], 'text-size': 13, 'text-offset': [0, 1.8], 'symbol-sort-key': ['get', 'sortKey'], 'text-allow-overlap': false },
        paint: { 'text-color': '#17211B', 'text-halo-color': '#ffffff', 'text-halo-width': 2 }
      });
      map.addLayer({
        id: 'zv2-zero-hit',
        type: 'circle',
        source: 'zv2-zero',
        paint: { 'circle-radius': 22, 'circle-opacity': 0.001 }
      });
      map.addLayer({
        id: 'zv2-zero-dot',
        type: 'circle',
        source: 'zv2-zero',
        minzoom: 12,
        paint: { 'circle-color': '#ffffff', 'circle-radius': 6, 'circle-stroke-width': 2.5, 'circle-stroke-color': '#9DB4A6' }
      });
      map.addLayer({
        id: 'zv2-zero-sel',
        type: 'circle',
        source: 'zv2-zero',
        filter: ['==', ['get', 'placeId'], ''],
        paint: { 'circle-color': '#ffffff', 'circle-radius': 9, 'circle-stroke-width': 3.5, 'circle-stroke-color': '#143F2E' }
      });
      map.addLayer({
        id: 'zv2-sel-label',
        type: 'symbol',
        source: 'zv2-zero',
        filter: ['==', ['get', 'placeId'], ''],
        layout: { 'text-field': ['get', 'name'], 'text-size': 13, 'text-offset': [0, 1.4], 'text-allow-overlap': true }
      });
      map.on('click', function (e) {
        var rad = 24;
        var fs = map.queryRenderedFeatures([[e.point.x - rad, e.point.y - rad], [e.point.x + rad, e.point.y + rad]], { layers: ['zv2-clusters', 'zv2-rec-pin', 'zv2-zero-hit'] });
        var best = null;
        var bestD = Infinity;
        fs.forEach(function (f) {
          var c = f.geometry && f.geometry.coordinates;
          if (!c) return;
          var pp = map.project(c);
          var d = Math.hypot(pp.x - e.point.x, pp.y - e.point.y);
          var w = f.layer.id === 'zv2-zero-hit' ? d + 6 : d;
          if (w < bestD) { bestD = w; best = f; }
        });
        if (!best || !best.properties) {
          if (invActive()) {
            var invHits = map.queryRenderedFeatures(e.point, { layers: ['zv2-inv-fill'] });
            if (invHits.length > 0 && invHits[0].properties && invHits[0].properties.cellId) selectInvCell(invHits[0].properties.cellId);
          }
          return;
        }
        if (best.layer.id === 'zv2-clusters') {
          var cid = best.properties.cluster_id;
          var src = map.getSource('zv2-recorded');
          if (cid == null || !src || typeof src.getClusterExpansionZoom !== 'function') return;
          src.getClusterExpansionZoom(cid, function (err, zoom) {
            if (err) return;
            map.easeTo({ center: best.geometry.coordinates, zoom: zoom });
          });
          return;
        }
        if (best.properties.placeId) selectPlace(best.properties.placeId);
      });
      fetchPlaces();
      fetchInvCells();
    });
    map.on('moveend', function () {
      clearTimeout(state.moveTimer);
      state.moveTimer = setTimeout(function () {
        var c = map.getCenter();
        var k = c.lat.toFixed(4) + ',' + c.lng.toFixed(4) + '|' + state.taxonGroup + '|' + state.searchQuery;
        if (k === state.lastMoveFetchKey) return;
        state.lastMoveFetchKey = k;
        fetchPlaces();
      }, 300);
    });
  }

  if (CFG.invasiveCellsApi) {
    var initParams = new URLSearchParams(window.location.search);
    if (initParams.get('taxon_group') === 'invasive') {
      state.taxonGroup = 'invasive';
      var initSp = initParams.get('species') || '';
      state.invSpecies = /^[a-z-]{3,60}$/.test(initSp) ? initSp : '';
      syncChipUi();
    }
  }

  bindUiEvents();
  if (window.maplibregl) {
    initMap();
  } else {
    var sc = document.createElement('script');
    sc.src = CFG.maplibreJs;
    sc.async = true;
    sc.onload = initMap;
    document.head.appendChild(sc);
  }
})();
</script>
</body>
</html>`;
}
