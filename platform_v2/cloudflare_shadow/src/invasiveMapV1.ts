import { isLocationDelayed24Hours } from "./locationPrivacy";
import { INVASIVE_LEARN_PATH, classifyInvasive, INVASIVE_SEED_ROWS, type InvasiveCategory } from "./mapInvasive";
import { isWeakTaxonLabel } from "./taxonNameResolver";
import { ZUKAN_SHELL_CSS, renderZukanChrome } from "./zukanShellChrome";

export const INVASIVE_MAP_V1_FLAG = "INVASIVE_MAP_V1_ENABLED";

const OFFICIAL_SOURCES: readonly { label: string; href: string }[] = [
  { label: "環境省「特定外来生物等一覧」", href: "https://www.env.go.jp/nature/intro/2outline/list.html" },
  { label: "環境省「生態系被害防止外来種リスト」", href: "https://www.env.go.jp/nature/intro/2outline/iaslist.html" },
];

const esc = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

export type InvasiveSourceRow = {
  observation_id: string;
  public_cell: string;
  observed_at: string;
  taxon_label: string | null;
  public_area_label?: string | null;
};

export type InvasiveRecord = {
  visitId: string;
  slug: string;
  name: string;
  category: InvasiveCategory;
  categoryLabel: string;
  observedAt: string;
  cell: string;
  lat: number;
  lng: number;
  halfStep: number;
  area: string | null;
  photoUrl: string | null;
};

export type InvasiveSpeciesSummary = {
  slug: string;
  name: string;
  category: InvasiveCategory;
  categoryLabel: string;
  records: number;
  cells: number;
  first: string;
  last: string;
};

export type InvasiveCellSummary = {
  cellId: string;
  lat: number;
  lng: number;
  halfStep: number;
  count: number;
  species: InvasiveSpeciesSummary[];
};

export function parseCell(value: string): { lat: number; lng: number } | null {
  const [latRaw, lngRaw] = value.replace(/^cell:/, "").split(",");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!latRaw || !lngRaw || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function cellHalfStep(value: string): number {
  const latRaw = value.replace(/^cell:/, "").split(",")[0] ?? "";
  return /^-?\d+\.\d$/.test(latRaw) ? 0.05 : 0.005;
}

export function scientificNameFromSlug(slug: string): string {
  const text = slug.replaceAll("-", " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

export function invasiveSlugForLabel(label: string | null | undefined): string | null {
  return classifyInvasive(label)?.learnSlug ?? null;
}

export function buildInvasiveRecords(
  rows: readonly InvasiveSourceRow[],
  context: { areas?: ReadonlyMap<string, string | null>; photos?: ReadonlyMap<string, string>; nowMs: number },
): InvasiveRecord[] {
  const out: InvasiveRecord[] = [];
  for (const row of rows) {
    if (isWeakTaxonLabel(row.taxon_label)) continue;
    const hit = classifyInvasive(row.taxon_label);
    if (!hit) continue;
    if (!row.public_cell || row.public_cell === "hidden" || row.public_cell === "unknown") continue;
    if (isLocationDelayed24Hours(row.observed_at, context.nowMs)) continue;
    const parsed = parseCell(row.public_cell);
    if (!parsed) continue;
    out.push({
      visitId: row.observation_id,
      slug: hit.learnSlug,
      name: String(row.taxon_label).normalize("NFKC").trim(),
      category: hit.category,
      categoryLabel: hit.label,
      observedAt: row.observed_at,
      cell: row.public_cell.replace(/^cell:/, ""),
      lat: parsed.lat,
      lng: parsed.lng,
      halfStep: cellHalfStep(row.public_cell),
      area: context.areas?.get(row.observation_id) ?? row.public_area_label ?? null,
      photoUrl: context.photos?.get(row.observation_id) ?? null,
    });
  }
  return out;
}

export function canonicalSpeciesName(slug: string): string | null {
  const hit = INVASIVE_SEED_ROWS.find((row) => row[2] === slug);
  return hit ? hit[0] : null;
}

function monthLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  return m ? `${m[1]}年${Number(m[2])}月` : "";
}

function dayLabel(iso: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[1])}月${Number(m[2])}日` : "";
}

export function summarizeSpecies(records: readonly InvasiveRecord[]): InvasiveSpeciesSummary[] {
  const map = new Map<string, InvasiveRecord[]>();
  for (const r of records) {
    const list = map.get(r.slug) ?? [];
    list.push(r);
    map.set(r.slug, list);
  }
  return [...map.entries()]
    .map(([slug, list]) => {
      const sorted = [...list].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
      return {
        slug,
        name: canonicalSpeciesName(slug) ?? list[0]!.name,
        category: list[0]!.category,
        categoryLabel: list[0]!.categoryLabel,
        records: list.length,
        cells: new Set(list.map((r) => r.cell)).size,
        first: sorted[0]!.observedAt,
        last: sorted[sorted.length - 1]!.observedAt,
      };
    })
    .sort((a, b) => b.records - a.records || b.last.localeCompare(a.last) || a.slug.localeCompare(b.slug));
}

export function summarizeCells(records: readonly InvasiveRecord[]): InvasiveCellSummary[] {
  const map = new Map<string, InvasiveRecord[]>();
  for (const r of records) {
    const list = map.get(r.cell) ?? [];
    list.push(r);
    map.set(r.cell, list);
  }
  return [...map.entries()]
    .map(([cell, list]) => ({
      cellId: `cell:${cell}`,
      lat: list[0]!.lat,
      lng: list[0]!.lng,
      halfStep: list[0]!.halfStep,
      count: list.length,
      species: summarizeSpecies(list),
    }))
    .sort((a, b) => b.count - a.count || a.cellId.localeCompare(b.cellId))
    .slice(0, 1200);
}

export function filterBySpecies(records: readonly InvasiveRecord[], slug: string | null | undefined): InvasiveRecord[] {
  return slug ? records.filter((r) => r.slug === slug) : [...records];
}

export function mapCellsPayload(records: readonly InvasiveRecord[], slug?: string | null) {
  const cells = summarizeCells(filterBySpecies(records, slug));
  return {
    ok: true,
    cells: cells.map((c) => ({
      cellId: c.cellId,
      lat: c.lat,
      lng: c.lng,
      halfStep: c.halfStep,
      count: c.count,
      species: c.species.map((s) => ({
        slug: s.slug,
        name: s.name,
        category: s.category,
        categoryLabel: s.categoryLabel,
        records: s.records,
        first: monthLabel(s.first),
        last: monthLabel(s.last),
      })),
    })),
  };
}

export function recordsForRegion(records: readonly InvasiveRecord[], area: string): InvasiveRecord[] {
  return records.filter((r) => r.area === area);
}

function badgeClass(category: InvasiveCategory): string {
  return category === "iaspecified" || category === "conditional" ? "iv-badge-warn" : "iv-badge-pri";
}

const WARN_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3.5 21 19.5H3z"/><path d="M12 10v4.2M12 17h.01"/></svg>`;
export const CHEV_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m9 6 6 6-6 6"/></svg>`;

const badge = (category: InvasiveCategory, label: string): string =>
  `<span class="${badgeClass(category)}">${category === "iaspecified" || category === "conditional" ? WARN_ICON : ""}<span class="iv-nb">${esc(label)}</span></span>`;

function plotHtml(records: readonly InvasiveRecord[]): string {
  const cells = summarizeCells(records);
  if (cells.length === 0) return "";
  const W = 320;
  const H = 200;
  const pad = 36;
  const minLat = Math.min(...cells.map((c) => c.lat - c.halfStep));
  const maxLat = Math.max(...cells.map((c) => c.lat + c.halfStep));
  const minLng = Math.min(...cells.map((c) => c.lng - c.halfStep));
  const maxLng = Math.max(...cells.map((c) => c.lng + c.halfStep));
  const kx = Math.max(Math.cos(((minLat + maxLat) / 2) * Math.PI / 180), 0.1);
  const spanX = Math.max((maxLng - minLng) * kx, 1e-6);
  const spanY = Math.max(maxLat - minLat, 1e-6);
  const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY, 12000);
  const offX = (W - spanX * scale) / 2;
  const offY = (H - spanY * scale) / 2;
  const rects = cells.map((c) => {
    const w = Math.max(c.halfStep * 2 * kx * scale, 44);
    const h = Math.max(c.halfStep * 2 * scale, 30);
    const cx = offX + (c.lng - minLng) * kx * scale;
    const cy = offY + (maxLat - c.lat) * scale;
    const x = Math.min(Math.max(cx - w / 2, 4), W - w - 4);
    const y = Math.min(Math.max(cy - h / 2, 4), H - h - 4);
    return `<g><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="8" fill="#F3E3CF" fill-opacity=".82" stroke="#8A4B00" stroke-width="2"/><text x="${(x + w / 2).toFixed(1)}" y="${(y + h / 2 + 5).toFixed(1)}" text-anchor="middle" font-size="14" font-weight="800" fill="#6B3A00">${c.count}件</text></g>`;
  }).join("");
  return `<figure class="iv-plot" data-invasive-plot="1"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="外来種が確認されている範囲（大まかな位置）" preserveAspectRatio="xMidYMid meet"><rect width="${W}" height="${H}" rx="14" fill="#EEF2EC"/>${rects}</svg><figcaption class="iv-note">場所は大まかに表示しています。新しい記録は、名前の確認が済んでから出ます。</figcaption></figure>`;
}

function recentHtml(records: readonly InvasiveRecord[], prefix: string, limit: number, seen: Set<string> = new Set<string>()): string {
  const items: string[] = [];
  const sorted = [...records].sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  for (const r of sorted) {
    if (items.length >= limit) break;
    const photo = r.photoUrl && !seen.has(r.photoUrl) ? r.photoUrl : null;
    if (photo) seen.add(photo);
    items.push(`<a class="iv-rcard" href="${esc(`${prefix}/observations/${encodeURIComponent(r.visitId)}`)}">${photo ? `<img src="${esc(photo)}" alt="" loading="lazy" width="96" height="96">` : `<span class="iv-rph" aria-hidden="true"></span>`}<span class="iv-rb"><span class="iv-rt">${esc(r.name)}</span><span class="iv-rm">${esc(dayLabel(r.observedAt))}${r.area ? ` ・ ${esc(r.area)}` : ""}</span></span></a>`);
  }
  return items.join("");
}

const BACK_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m15 6-6 6 6 6"/></svg>`;
const SHARE_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 15V4"/><path d="m7.5 8 4.5-4 4.5 4"/><path d="M5 13.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-5.5"/></svg>`;

export const headBar = (backHref: string): string => `<div class="iv-bar"><a class="iv-ib" data-iv-back="1" href="${esc(backHref)}" aria-label="戻る">${BACK_ICON}</a><button type="button" class="iv-ib" data-iv-share="1" aria-label="共有">${SHARE_ICON}</button></div><p class="iv-tstate" id="iv-share-state" aria-live="polite" style="margin:0"></p>`;

const watchLink = (prefix: string): string => `<a class="iv-link" data-invasive-biosecurity="1" href="${esc(`${prefix}/biosecurity`)}"><span>外来種の見守りについて</span>${CHEV_ICON}</a>`;

const speciesLinks = (slug: string): string => `<div class="iv-sl"><a href="${esc(`${INVASIVE_LEARN_PATH}/${slug}`)}" data-invasive-about="1">この種について</a><a href="${esc(`${INVASIVE_LEARN_PATH}/${slug}#identify`)}" data-invasive-identify="1">見分けの助け</a></div>`;

export const SHARE_SCRIPT = `(function(){
  var back=document.querySelector('[data-iv-back]');var sh=document.querySelector('[data-iv-share]');var st=document.getElementById('iv-share-state');
  if(back)back.addEventListener('click',function(e){if(history.length>1&&document.referrer){e.preventDefault();history.back();}});
  if(sh)sh.addEventListener('click',function(){
    var url=location.href;var title=document.title;
    function note(t){if(st){st.textContent=t;setTimeout(function(){st.textContent='';},2500);}}
    function copy(){if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(url).then(function(){note('リンクをコピーしました。');}).catch(function(){note('コピーできませんでした。');});}else{note('コピーできませんでした。');}}
    if(navigator.share){navigator.share({title:title,url:url}).catch(function(e){if(!e||e.name!=='AbortError')copy();});}else{copy();}
  });
})();`;

const CAUTION_HTML = (category: InvasiveCategory | null): string => `<section class="iv-caution">
  <h2>${WARN_ICON}見つけたときは</h2>
  <ul>
    <li>持ち帰らないでください。${category === "iaspecified" ? "<span class=\"iv-nb\">特定外来生物</span>は、飼うこと・運ぶことが法律で禁止されています。" : "飼うことや運ぶことが制限されている場合があります。"}</li>
    <li>むやみに触らないでください。毒のあるものや、体の一部から増えるものがいます。</li>
    <li>写真で記録を残してください。記録が、広がりを知る手がかりになります。</li>
  </ul>
</section>`;

const BASE_CSS = `
${ZUKAN_SHELL_CSS}
.iv-col{max-width:760px;margin:0 auto;padding:6px 0 32px}
.iv-nb{white-space:nowrap}
.iv-bar{display:flex;align-items:center;justify-content:space-between;min-height:48px}
.iv-ib{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;border:1px solid var(--line);background:#fff;color:var(--ink);padding:0;cursor:pointer;text-decoration:none}
.iv-thumb,.iv-thumb-ph{width:56px;height:56px;border-radius:12px;object-fit:cover;background:#EEF2EC;flex:none;display:block}
.iv-sl{display:flex;flex-wrap:wrap;gap:0 20px;padding:0 0 12px}
.iv-sl a{display:inline-flex;align-items:center;min-height:44px;color:var(--green);font-weight:700;font-size:14.5px;text-decoration:none;white-space:nowrap}
.iv-sw-row{border-bottom:1px solid #EDF0EC}
.iv-sw-row .iv-sprow{border-bottom:0;padding-bottom:4px}
.iv-sw-row .iv-sl{padding-left:68px}
.iv-crumb{font-size:15px;font-weight:700;color:var(--muted);display:flex;gap:6px;align-items:center;min-height:32px}
.iv-title{margin:6px 0 0;font-size:24px;font-weight:800;line-height:1.35}
.iv-sci{font-size:14px;color:var(--muted);font-style:italic;margin-top:2px}
.iv-desc{margin:10px 0 0;font-size:15.5px;line-height:1.75;color:var(--ink)}
.iv-h{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:28px 0 10px;font-size:18px;font-weight:800}
.iv-h .iv-cnt{font-size:14px;font-weight:600;color:var(--muted)}
.iv-badge-warn,.iv-badge-pri{display:inline-flex;align-items:center;gap:4px;min-height:28px;padding:0 10px;border-radius:999px;font-size:13px;font-weight:800;white-space:nowrap}
.iv-badge-warn{background:#FBEBD6;color:#6B3A00;border:1px solid #E6C9A8}
.iv-badge-pri{background:#EEF2EC;color:#143F2E;border:1px solid #C9D6CC}
.iv-sprow{display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid #EDF0EC;text-decoration:none;color:inherit;min-height:44px}
.iv-sprow>span.iv-sb{flex:1;min-width:0}
.iv-sname{display:block;font-size:16.5px;font-weight:800;color:var(--ink)}
.iv-sstate{display:block;margin-top:4px;font-size:14px;color:var(--muted)}
.iv-sprow svg{flex:none;color:var(--control)}
.iv-plot{margin:0}
.iv-plot svg{display:block;width:100%;height:auto;max-height:260px}
.iv-note{margin:8px 0 0;font-size:13.5px;color:var(--muted);line-height:1.6}
.iv-link{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:48px;padding:0 2px;border-top:1px solid var(--line);color:var(--green);font-weight:700;font-size:15px;text-decoration:none}
.iv-rgrid{display:grid;grid-template-columns:1fr;gap:12px}
@media(min-width:640px){.iv-rgrid{grid-template-columns:1fr 1fr}}
.iv-rcard{display:flex;gap:12px;align-items:center;text-decoration:none;color:inherit;min-height:56px}
.iv-rcard img,.iv-rph{width:64px;height:64px;border-radius:12px;object-fit:cover;background:#EEF2EC;flex:none;display:block}
.iv-rb{display:block;min-width:0}
.iv-rt{display:block;font-weight:800;font-size:15.5px}
.iv-rm{display:block;font-size:13.5px;color:var(--muted);margin-top:2px}
.iv-caution{margin-top:28px;background:#FFF8EE;border:1px solid #E6C9A8;border-radius:16px;padding:16px}
.iv-caution h2{margin:0 0 8px;font-size:16px;font-weight:800;color:#6B3A00;display:flex;align-items:center;gap:6px}
.iv-caution ul{margin:0;padding-left:20px;font-size:15px;line-height:1.75}
.iv-src{margin-top:24px;border:1px solid var(--line);border-radius:16px;padding:16px;background:var(--surface)}
.iv-src h2{margin:0 0 8px;font-size:16px;font-weight:800}
.iv-src p{margin:0;font-size:14.5px;line-height:1.7;color:var(--muted)}
.iv-invite{margin-top:20px;background:var(--surface);border-radius:16px;padding:18px}
.iv-invite p{margin:0;font-size:15.5px;line-height:1.75}
.iv-btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 24px;margin-top:14px;border-radius:999px;background:var(--green);color:#fff!important;font-weight:800;font-size:16px;text-decoration:none;white-space:nowrap}
.iv-kv{display:grid;grid-template-columns:88px 1fr;gap:12px;padding:12px 0;border-bottom:1px solid #EDF0EC;font-size:15px;line-height:1.7}
.iv-kv .iv-kk{font-weight:800}
.iv-hero{margin:0 -20px;border-radius:0 0 18px 18px;overflow:hidden;background:#EEF2EC}
.iv-hero img{display:block;width:100%;height:224px;object-fit:cover}
.iv-toggle{display:flex;align-items:center;gap:12px;min-height:64px;padding:12px 16px;border:1px solid var(--line);border-radius:16px;margin-top:24px}
.iv-toggle .iv-tt{flex:1;min-width:0;font-weight:800;font-size:15.5px}
.iv-toggle .iv-ts{display:block;font-weight:500;font-size:13.5px;color:var(--muted);margin-top:2px}
.iv-sw{position:relative;flex:none;width:52px;height:32px;border-radius:999px;border:0;background:#C9D1CB;cursor:pointer;transition:background .12s}
.iv-sw::after{content:"";position:absolute;top:4px;left:4px;width:24px;height:24px;border-radius:50%;background:#fff;transition:transform .12s}
.iv-sw[aria-checked="true"]{background:var(--green)}
.iv-sw[aria-checked="true"]::after{transform:translateX(20px)}
.iv-sw:disabled{opacity:.5}
.iv-tstate{margin:8px 2px 0;font-size:13.5px;color:var(--muted);min-height:20px}
`;

export function shell(options: {
  extraCss?: string;
  title: string;
  lang: "ja" | "en" | "es" | "pt-br";
  authenticated: boolean;
  displayName?: string | null;
  pathname: string;
  body: string;
  cspNonce?: string | null;
  script?: string;
}): string {
  const prefix = options.lang === "ja" ? "/ja" : `/${options.lang}`;
  const nonceAttr = options.cspNonce ? ` nonce="${esc(options.cspNonce)}"` : "";
  const chrome = renderZukanChrome({
    lang: options.lang,
    activeNav: "places",
    authenticated: options.authenticated,
    displayName: options.displayName,
    pathname: options.pathname,
    homeHref: options.authenticated ? `${prefix}/library` : `${prefix}/`,
  });
  return `<!doctype html>
<html lang="${esc(options.lang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(options.title)} — ZUKAN</title>
  <style${nonceAttr}>${BASE_CSS}${options.extraCss ?? ""}</style>
</head>
<body>
  <div class="zt-shell">
    ${chrome.sidebarHtml}
    <div>
      ${chrome.topbarHtml}
      <main class="zt-main" data-invasive-map-v1="1">${options.body}${chrome.feedbackFootHtml}</main>
    </div>
  </div>
  ${chrome.bottomNavHtml}${options.script ? `\n  <script${nonceAttr}>${options.script}</script>` : ""}
</body>
</html>`;
}

export function renderRegionInvasivePage(options: {
  area: string;
  records: readonly InvasiveRecord[];
  lang: "ja" | "en" | "es" | "pt-br";
  authenticated: boolean;
  displayName?: string | null;
  cspNonce?: string | null;
  regionHref?: string | null;
}): string {
  const prefix = options.lang === "ja" ? "/ja" : `/${options.lang}`;
  const area = esc(options.area);
  const species = summarizeSpecies(options.records);
  const mapHref = `${prefix}/map?taxon_group=invasive`;
  let inner: string;
  if (species.length > 0) {
    const seen = new Set<string>();
    const thumbs = new Map<string, string>();
    for (const s of species) {
      const p = options.records.filter((r) => r.slug === s.slug && r.photoUrl && !seen.has(r.photoUrl)).sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0]?.photoUrl;
      if (p) { seen.add(p); thumbs.set(s.slug, p); }
    }
    const rows = species.map((s) => `<div class="iv-sw-row" data-invasive-species-row="${esc(s.slug)}"><a class="iv-sprow" href="${esc(`${prefix}/invasive/${encodeURIComponent(s.slug)}`)}">${thumbs.has(s.slug) ? `<img class="iv-thumb" src="${esc(thumbs.get(s.slug)!)}" alt="" loading="lazy" width="56" height="56">` : `<span class="iv-thumb-ph" aria-hidden="true"></span>`}
      <span class="iv-sb"><span class="iv-sname iv-nb">${esc(s.name)}</span><span style="display:block;margin-top:4px">${badge(s.category, s.categoryLabel)}</span><span class="iv-sstate">${s.cells}か所 ・ 記録 <span class="iv-nb">${s.records}件</span> ・ 最初は<span class="iv-nb">${esc(monthLabel(s.first))}</span></span></span>${CHEV_ICON}</a>${speciesLinks(s.slug)}</div>`).join("");
    const recent = recentHtml(options.records, prefix, 6, seen);
    inner = `<p class="iv-desc">${area}の生きものを、外来種の印で見た面です。この地域で見つかっている外来種を集めています。名前の確認が済んだ記録だけを表示しています。</p>
    <div class="iv-h"><span>見つかっている種</span><span class="iv-cnt">${species.length}種</span></div>
    <div data-invasive-species-list="1">${rows}</div>
    <div class="iv-h"><span>広がり</span></div>
    ${plotHtml(options.records)}
    <a class="iv-link" href="${esc(mapHref)}"><span>地図で広がりを見る</span>${CHEV_ICON}</a>
    ${watchLink(prefix)}
    <div class="iv-h"><span>最近の発見</span></div>
    <div class="iv-rgrid">${recent}</div>
    ${CAUTION_HTML(species.some((s) => s.category === "iaspecified") ? "iaspecified" : null)}`;
  } else {
    const nationwide = INVASIVE_SEED_ROWS.filter((row) => classifyInvasive(row[0])?.category === "iaspecified").slice(0, 6);
    const rows = nationwide.map((row) => `<a class="iv-sprow" href="${esc(`${INVASIVE_LEARN_PATH}/${row[2]}`)}"><span class="iv-sb"><span class="iv-sname iv-nb">${esc(row[0])}</span><span style="display:block;margin-top:4px">${badge("iaspecified", "特定外来生物")}</span></span>${CHEV_ICON}</a>`).join("");
    inner = `<p class="iv-desc">${area}の生きものを、外来種の印で見た面です。この地域では、名前の確認が済んだ外来種の記録は、まだ集まっていません。</p>
    <div class="iv-h"><span>全国で指定されている種</span></div>
    <div>${rows}</div>
    <p class="iv-note" style="margin-top:10px">区分は、環境省のリストに基づく種マスタから表示しています。</p>
    ${watchLink(prefix)}
    <div class="iv-h"><span>見つけたら</span></div>
    <div class="iv-invite"><p>外来種かもしれない生きものを見かけたら、写真で記録を残してください。名前がわからなくても大丈夫です。写真の記録から、名前の確認が進みます。</p><a class="iv-btn" href="${esc(`${prefix}/record`)}">この地域で記録する</a></div>
    ${CAUTION_HTML(null)}`;
  }
  const sources = `<section class="iv-src"><h2>区分と根拠</h2><p>この面の種と区分は、国のリストに基づく種マスタから表示しています。地域ごとの扱いは、お住まいの自治体の案内に従ってください。</p>${OFFICIAL_SOURCES.map((s) => `<a class="iv-link" href="${esc(s.href)}" target="_blank" rel="noreferrer noopener"><span>${esc(s.label)}</span>${CHEV_ICON}</a>`).join("")}</section>`;
  const body = `<div class="iv-col" data-invasive-region="${area}">
    ${headBar(mapHref)}
    <div class="iv-crumb">${area}</div>
    <h1 class="iv-title">外来種</h1>
    ${options.regionHref ? `<a class="iv-link" data-region-back="1" href="${esc(options.regionHref)}"><span>${area}の地域ページ</span>${CHEV_ICON}</a>` : ""}
    ${inner}
    ${sources}
  </div>`;
  return shell({
    title: `${options.area}の外来種`,
    lang: options.lang,
    authenticated: options.authenticated,
    displayName: options.displayName,
    pathname: `${prefix}/regions/${encodeURIComponent(options.area)}/invasive`,
    body,
    cspNonce: options.cspNonce,
    script: SHARE_SCRIPT,
  });
}

const CATEGORY_TEXT: Readonly<Record<InvasiveCategory, string>> = {
  iaspecified: "日本の「外来生物法」で、特定外来生物に指定されています。飼うこと・運ぶこと・野外に放すことが、法律で禁止されています。",
  conditional: "日本の「外来生物法」で、条件付特定外来生物に指定されています。販売や放すことなどが制限されています。",
  priority: "日本の「生態系被害防止外来種リスト」（環境省）で、重点対策外来種に区分されています。",
  prevention: "日本の「生態系被害防止外来種リスト」（環境省）で、生態系被害防止外来種に区分されています。",
};

export function renderInvasiveSpeciesPage(options: {
  slug: string;
  records: readonly InvasiveRecord[];
  lang: "ja" | "en" | "es" | "pt-br";
  authenticated: boolean;
  displayName?: string | null;
  cspNonce?: string | null;
}): string | null {
  const prefix = options.lang === "ja" ? "/ja" : `/${options.lang}`;
  const seed = INVASIVE_SEED_ROWS.find((row) => row[2] === options.slug);
  if (!seed) return null;
  const hit = classifyInvasive(seed[0])!;
  const name = seed[0];
  const sci = scientificNameFromSlug(options.slug);
  const own = options.records.filter((r) => r.slug === options.slug);
  const hero = own.find((r) => r.photoUrl)?.photoUrl ?? null;
  const seenPhotos = new Set<string>(hero ? [hero] : []);
  const areas = new Map<string, InvasiveRecord[]>();
  for (const r of own) {
    if (!r.area) continue;
    const list = areas.get(r.area) ?? [];
    list.push(r);
    areas.set(r.area, list);
  }
  const areaRows = [...areas.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).slice(0, 12).map(([area, list]) => {
    const first = [...list].sort((a, b) => a.observedAt.localeCompare(b.observedAt))[0]!;
    return `<a class="iv-sprow" href="${esc(`${prefix}/regions/${encodeURIComponent(area)}/invasive`)}"><span class="iv-sb"><span class="iv-sname">${esc(area)}</span><span class="iv-sstate">記録 <span class="iv-nb">${list.length}件</span> ・ ${esc(monthLabel(first.observedAt))}から</span></span>${CHEV_ICON}</a>`;
  }).join("");
  const cellCount = new Set(own.map((r) => r.cell)).size;
  const found = own.length > 0
    ? `<div class="iv-h"><span>見つかっている場所</span><span class="iv-cnt">${cellCount}か所</span></div>
    ${plotHtml(own)}
    ${areaRows ? `<div>${areaRows}</div>` : ""}
    <a class="iv-link" href="${esc(`${prefix}/map?taxon_group=invasive&species=${encodeURIComponent(options.slug)}${own[0] ? `&lat=${own[0].lat}&lng=${own[0].lng}&z=11` : ""}`)}"><span>地図で広がりを見る</span>${CHEV_ICON}</a>
    <div class="iv-h"><span>最近の発見</span></div>
    <div class="iv-rgrid">${recentHtml(own, prefix, 6, seenPhotos)}</div>`
    : "";
  const sci2 = sci.replaceAll('"', "");
  const toggle = options.authenticated
    ? `<div class="iv-toggle" data-invasive-alert="1" data-sci="${esc(sci2)}"><div class="iv-tt">この種が見つかったら知らせる<span class="iv-ts">新しく確認された記録があるとき、メールでお知らせします</span></div><button type="button" class="iv-sw" role="switch" aria-checked="false" aria-label="この種が見つかったら知らせる" id="iv-alert-sw" disabled></button></div><p class="iv-tstate" id="iv-alert-state" aria-live="polite"></p>`
    : `<div class="iv-toggle"><div class="iv-tt">この種が見つかったら知らせる<span class="iv-ts">ログインすると、メールで知らせを受け取れます</span></div><a class="iv-link" style="border:0;min-height:44px;white-space:nowrap" href="${esc(`${prefix}/login`)}">ログイン</a></div>`;
  const body = `<div class="iv-col" data-invasive-species="${esc(options.slug)}">
    ${headBar(`${prefix}/map?taxon_group=invasive`)}
    ${hero ? `<div class="iv-hero"><img src="${esc(hero)}" alt="" width="760" height="224"></div>` : ""}
    <div class="iv-crumb" style="margin-top:14px"><a href="${esc(`${prefix}/map?taxon_group=invasive`)}">外来種</a></div>
    <h1 class="iv-title iv-nb" style="white-space:normal">${esc(name)}</h1>
    <div class="iv-sci">${esc(sci)}</div>
    <div style="margin-top:10px">${badge(hit.category, hit.label)}</div>
    <section class="iv-src" style="margin-top:18px"><h2>区分と根拠</h2><p>${esc(CATEGORY_TEXT[hit.category])}</p>${OFFICIAL_SOURCES.map((s) => `<a class="iv-link" href="${esc(s.href)}" target="_blank" rel="noreferrer noopener"><span>${esc(s.label)}</span>${CHEV_ICON}</a>`).join("")}</section>
    <div style="margin-top:14px">${speciesLinks(options.slug)}</div>
    ${watchLink(prefix)}
    ${found}
    <div class="iv-h"><span>地域で変わる扱い</span></div>
    <div class="iv-kv"><div class="iv-kk">日本</div><div>${esc(CATEGORY_TEXT[hit.category])}</div></div>
    <p class="iv-note" style="margin-top:10px">同じ種でも、場所が変われば外来種かどうかが変わります。地域ごとの扱いは、その場所の自治体の案内に従ってください。</p>
    ${CAUTION_HTML(hit.category)}
    ${toggle}
  </div>`;
  const script = options.authenticated ? `${SHARE_SCRIPT}\n${ALERT_SCRIPT}` : SHARE_SCRIPT;
  return shell({
    title: `${name}（外来種）`,
    lang: options.lang,
    authenticated: options.authenticated,
    displayName: options.displayName,
    pathname: `${prefix}/invasive/${options.slug}`,
    body,
    cspNonce: options.cspNonce,
    script,
  });
}

const ALERT_SCRIPT = `(function(){
  var box=document.querySelector('[data-invasive-alert]');var sw=document.getElementById('iv-alert-sw');var st=document.getElementById('iv-alert-state');
  if(!box||!sw)return;var sci=box.getAttribute('data-sci')||'';var subId=null;
  function paint(on){sw.setAttribute('aria-checked',on?'true':'false');if(st)st.textContent=on?'知らせを入れています。':'';}
  function same(s){return String(s.scientificName||'').toLowerCase()===sci.toLowerCase()&&s.triggerInvasiveOnly;}
  fetch('/api/v1/me/subscriptions',{credentials:'same-origin',headers:{accept:'application/json'}}).then(function(r){return r.ok?r.json():null}).then(function(d){
    if(!d){if(st)st.textContent='いまは切り替えできません。';return;}
    var list=(d.subscriptions||[]).filter(same);if(list.length){subId=list[0].subscriptionId;}
    paint(Boolean(subId));sw.disabled=false;
  }).catch(function(){if(st)st.textContent='いまは切り替えできません。';});
  sw.addEventListener('click',function(){
    sw.disabled=true;
    if(subId){fetch('/api/v1/me/subscriptions/'+encodeURIComponent(subId),{method:'DELETE',credentials:'same-origin'}).then(function(r){if(r.ok){subId=null;paint(false);}else if(st){st.textContent='うまく切り替えられませんでした。';}}).catch(function(){if(st)st.textContent='うまく切り替えられませんでした。';}).then(function(){sw.disabled=false;});return;}
    fetch('/api/v1/me/subscriptions',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({scientificName:sci,matchField:'scientific_name',triggerInvasiveOnly:true,channel:'email',label:document.title})}).then(function(r){return r.ok?r.json():null}).then(function(d){if(d&&d.subscriptionId){subId=d.subscriptionId;paint(true);}else if(st){st.textContent='うまく切り替えられませんでした。';}}).catch(function(){if(st)st.textContent='うまく切り替えられませんでした。';}).then(function(){sw.disabled=false;});
  });
})();`;

export function parseInvasiveSlug(raw: string): string | null {
  const slug = decodeURIComponent(raw).trim().toLowerCase();
  return /^[a-z-]{3,60}$/.test(slug) && INVASIVE_SEED_ROWS.some((row) => row[2] === slug) ? slug : null;
}
