const esc = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

const ICON_BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>';
const ICON_SEARCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>';
const ICON_MIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/></svg>';
export const SEARCH_ICON_CALENDAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/></svg>';
const ICON_CHEV = '<svg class="zs-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';

export const ZUKAN_SEARCH_CSS = `
.zs{display:grid;gap:16px;min-width:0;max-width:720px;margin:0 auto;color:#17251b}
.zs svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
.zs-head{display:grid;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center;min-height:56px}
.zs-head h1{margin:0;text-align:center;font-size:1.25rem;line-height:1.4}
.zs-back,.zs-back:visited{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;color:#17251b}
.zs-bar{display:flex;align-items:center;gap:10px;min-height:52px;padding:0 8px 0 16px;border-radius:999px;border:1px solid #dde2dc;background:#f6f7f3;box-shadow:0 1px 4px rgba(20,30,24,.08)}
.zs-bar input{flex:1;min-width:0;border:0;background:transparent;font:inherit;font-size:1.0625rem;color:#17251b;min-height:48px;outline:none}
.zs-bar:focus-within{outline:3px solid #143F2E;outline-offset:2px}
.zs-mic{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border:0;border-radius:50%;background:transparent;color:#143F2E;cursor:pointer}
.zs-h2{margin:8px 0 0;font-size:1.25rem;line-height:1.4}
.zs-chips{display:flex;flex-wrap:wrap;gap:10px}
.zs-chip,.zs-chip:visited{display:inline-flex;align-items:center;min-height:44px;padding:0 18px;border:1px solid #dde2dc;border-radius:999px;background:#fff;color:#17251b;font-weight:700;text-decoration:none}
.zs-chip.is-active,.zs-chip.is-active:visited{background:#143F2E;border-color:#143F2E;color:#fff}
.zs-tabs{flex-wrap:nowrap;overflow-x:auto;gap:8px;scrollbar-width:none}.zs-tabs .zs-chip{padding:0 16px;white-space:nowrap}
.zs-list{margin:0;padding:0;list-style:none;display:grid}
.zs-row,.zs-row:visited{display:flex;align-items:center;gap:14px;min-height:84px;padding:12px 0;border-bottom:1px solid #dde2dc;color:#17251b;text-decoration:none}
.zs-thumb{flex:none;width:64px;height:64px;border-radius:14px;overflow:hidden;background:#e8f0ea}.zs-thumb img{display:block;width:100%;height:100%;object-fit:cover}
.zs-body{flex:1;min-width:0}.zs-body strong{display:block;font-size:1.0625rem;line-height:1.4;overflow-wrap:anywhere}.zs-body small{display:block;margin-top:2px;font-size:.9375rem;color:#55615a;overflow-wrap:anywhere}
.zs-badge{flex:none;padding:6px 14px;border-radius:999px;background:#f1f3ee;color:#3d4a42;font-weight:700;font-size:.9375rem}
.zs-chev{width:20px!important;height:20px!important;color:#8a948d}
mark{background:#f6d90f;color:inherit;border-radius:3px;padding:0 1px}
.zs-count{margin:0;color:#55615a}
.zs-empty{display:grid;justify-items:center;gap:10px;text-align:center;padding:24px 0 8px}
.zs-empty-icon{display:grid;place-items:center;width:112px;height:112px;border-radius:50%;background:#edf2ee;color:#143F2E}.zs-empty-icon svg{width:44px;height:44px}
.zs-empty h2{margin:6px 0 0;font-size:1.25rem}.zs-empty p{margin:0;color:#55615a}
.zs-btn,.zs-btn:visited{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:52px;padding:10px 18px;border:1.5px solid #143F2E;border-radius:16px;background:#fff;color:#143F2E;font:inherit;font-weight:700;text-decoration:none}
.zs-seasons{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.zs-season,.zs-season:visited{display:grid;gap:2px;justify-items:center;padding:12px 6px;border:1px solid #dde2dc;border-radius:16px;background:#fff;color:#17251b;text-decoration:none}
.zs-season span{font-size:.8125rem;color:#55615a}
.zs-season.is-active,.zs-season.is-active:visited{background:#143F2E;border-color:#143F2E;color:#fff}.zs-season.is-active span{color:rgba(255,255,255,.85)}
.zs :focus-visible{outline:3px solid currentColor;outline-offset:3px}
@media(prefers-reduced-motion:reduce){.zs,.zs *{transition:none!important;animation:none!important}}
`;

export function highlightMatch(text: string, query: string): string {
  const q = query.trim();
  if (!q) return esc(text);
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  let out = "";
  let from = 0;
  for (let idx = lower.indexOf(needle, from); idx >= 0; idx = lower.indexOf(needle, from)) {
    out += esc(text.slice(from, idx)) + "<mark>" + esc(text.slice(idx, idx + q.length)) + "</mark>";
    from = idx + q.length;
  }
  return out + esc(text.slice(from));
}

export function renderSearchHead(title: string, backHref: string, backLabel: string): string {
  return `<header class="zs-head"><a class="zs-back" href="${esc(backHref)}" aria-label="${esc(backLabel)}">${ICON_BACK}</a><h1>${esc(title)}</h1><span></span></header>`;
}

export function renderSearchBar(options: { action: string; q: string; placeholder: string; label: string; micLabel: string; hidden?: Record<string, string> }): string {
  const hidden = Object.entries(options.hidden ?? {})
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join("");
  return `<form class="zs-bar" method="get" action="${esc(options.action)}" role="search">${ICON_SEARCH}<input id="zs-input" type="search" name="q" value="${esc(options.q)}" placeholder="${esc(options.placeholder)}" aria-label="${esc(options.label)}" enterkeyhint="search">${hidden}<button type="button" class="zs-mic" data-search-mic-btn="1" id="zs-mic-btn" aria-label="${esc(options.micLabel)}">${ICON_MIC}</button></form>
<script>(()=>{const b=document.getElementById("zs-mic-btn"),i=document.getElementById("zs-input");if(!b||!i)return;const R=window.SpeechRecognition||window.webkitSpeechRecognition;if(!R){b.hidden=true;return;}b.addEventListener("click",()=>{const r=new R();r.lang=document.documentElement.lang==="en"?"en-US":"ja-JP";r.interimResults=false;r.onresult=(e)=>{const t=e.results&&e.results[0]&&e.results[0][0]?e.results[0][0].transcript:"";if(t){i.value=t;i.form&&i.form.submit();}};try{r.start();}catch{}});})();</script>`;
}

export function renderSearchRow(options: { href: string; title: string; meta?: string; badge?: string; thumbUrl?: string | null; titleHtml?: string }): string {
  const thumb = `<span class="zs-thumb" aria-hidden="true">${options.thumbUrl ? `<img src="${esc(options.thumbUrl)}" alt="" loading="lazy" decoding="async">` : ""}</span>`;
  return `<li><a class="zs-row" href="${esc(options.href)}">${thumb}<span class="zs-body"><strong>${options.titleHtml ?? esc(options.title)}</strong>${options.meta ? `<small class="zt-search-meta">${esc(options.meta)}</small>` : ""}</span>${options.badge ? `<span class="zs-badge">${esc(options.badge)}</span>` : ICON_CHEV}</a></li>`;
}

export function renderSearchEmptyIcon(): string {
  return `<span class="zs-empty-icon">${ICON_SEARCH}</span>`;
}

const PUBLIC_MEMBERSHIP = `m.membership_state = 'confirmed' AND m.public_precision = 'place' AND m.removed_at IS NULL AND o.visibility = 'public' AND COALESCE(o.emergency_hidden, 0) = 0`;

export const PLACE_SEARCH_SELECT = `SELECT p.place_id AS place_id, p.canonical_name AS name, p.locality_label AS locality_label,
  (SELECT COUNT(*) FROM record_place_memberships m JOIN observations o ON o.observation_id = m.record_id WHERE m.place_id = p.place_id AND ${PUBLIC_MEMBERSHIP}) AS record_count,
  (SELECT a.asset_id FROM record_place_memberships m JOIN observations o ON o.observation_id = m.record_id JOIN asset_ledger a ON a.observation_id = o.observation_id AND a.exif_scrub_state = 'scrubbed' WHERE m.place_id = p.place_id AND ${PUBLIC_MEMBERSHIP} ORDER BY o.observed_at DESC LIMIT 1) AS thumb_asset_id
  FROM places p`;

export const RECORD_THUMB_SQL = `(SELECT a.asset_id FROM asset_ledger a WHERE a.observation_id = o.observation_id AND a.exif_scrub_state = 'scrubbed' LIMIT 1)`;

export type PlaceSearchInfo = { placeId: string; name: string; locality: string | null; recordCount: number | null; thumbAssetId: string | null };

type PlaceSearchRaw = { place_id: string; name: string; locality_label?: string | null; record_count?: number | null; thumb_asset_id?: string | null };

export function mapPlaceSearchRow(row: PlaceSearchRaw): PlaceSearchInfo {
  return {
    placeId: row.place_id,
    name: row.name,
    locality: row.locality_label ?? null,
    recordCount: typeof row.record_count === "number" ? row.record_count : null,
    thumbAssetId: row.thumb_asset_id ?? null,
  };
}

export const thumbUrlOf = (assetId: string | null | undefined): string | null => (assetId ? `/thumb/400/${encodeURIComponent(assetId)}` : null);

export function formatShortDate(value: string | null | undefined, isEn: boolean): string {
  const time = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(time)) return "";
  return new Intl.DateTimeFormat(isEn ? "en" : "ja", { month: isEn ? "short" : "long", day: "numeric", timeZone: "Asia/Tokyo" }).format(new Date(time));
}
