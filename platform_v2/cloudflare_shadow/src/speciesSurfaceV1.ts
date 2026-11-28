import { CHEV_ICON, SEO_DEFAULT_ORIGIN, canonicalSpeciesName, headBar, plural, scientificNameFromSlug, shareScript, shell, tr } from "./invasiveMapV1";
import { regionPath } from "./regionSlugs";
import { INVASIVE_LEARN_PATH, classifyInvasive } from "./mapInvasive";
import { isWeakTaxonLabel } from "./taxonNameResolver";
import { inferTaxonGroupForLabel, resolveTaxonGroups } from "./zukanMapTaxonGroup";
import { EXTRA_CSS, GROUP_LABELS, isHigherRankName, regionMapCardHtml, type RegionCell } from "./regionSurfaceV1";

export const SPECIES_SURFACE_V1_FLAG = "SPECIES_SURFACE_V1_ENABLED";

type Lang = "ja" | "en" | "es" | "pt-br";
type Row = { observation_id: string; observed_at: string; public_area_label: string | null; public_cell: string | null };
type Db = { prepare(sql: string): { bind(...v: unknown[]): { all<T>(): Promise<{ results?: T[] }> } } };

export type SpeciesRecent = { id: string; observedAt: string; area: string | null; photoUrl: string | null };
export type SpeciesArea = { area: string; count: number };
export type SpeciesSurfaceData = {
  name: string;
  group: string;
  total: number;
  areas: SpeciesArea[];
  cells: RegionCell[];
  recent: SpeciesRecent[];
  firstObservedAt: string | null;
  lastObservedAt: string | null;
  heroUrl: string | null;
  invasiveSlug: string | null;
  scientificName: string | null;
  higherRank: boolean;
};

const GROUP_LABELS_EN: Readonly<Record<string, string>> = { plant: "Plants", bird: "Birds", insect: "Insects", amphibian_reptile: "Amphibians and reptiles", mammal: "Mammals", fungi: "Fungi", other: "Other" };
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const esc = (v: unknown): string => String(v ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

export function canonicalSpeciesKey(raw: string): string {
  return String(raw ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

export type SpeciesKeyResolution = { kind: "ok"; name: string } | { kind: "redirect"; name: string } | { kind: "invalid" };

export function resolveSpeciesKey(rawSegment: string): SpeciesKeyResolution {
  let decoded = "";
  try { decoded = decodeURIComponent(rawSegment); } catch { return { kind: "invalid" }; }
  const canon = canonicalSpeciesKey(decoded);
  if (!canon || canon.length > 80 || /[\u0000-\u001f/\\<>]/u.test(canon) || isWeakTaxonLabel(canon)) return { kind: "invalid" };
  const slug = canon.toLowerCase().replace(/\s+/g, "-");
  if (/^[a-z-]{3,60}$/.test(slug)) {
    const jp = canonicalSpeciesName(slug);
    if (jp) return { kind: "redirect", name: jp };
  }
  return canon === decoded && encodeURIComponent(canon) === rawSegment ? { kind: "ok", name: canon } : { kind: "redirect", name: canon };
}

export async function loadSpeciesSurfaceData(
  db: Db,
  name: string,
  photoLoader: (ids: readonly string[]) => Promise<Map<string, string>>,
  normalizeArea: (v: string) => string | null = (v) => v,
): Promise<SpeciesSurfaceData | null> {
  let rows: Row[] = [];
  try {
    rows = (await db.prepare(
      `SELECT r.observation_id, r.observed_at, r.public_area_label, r.public_cell
         FROM readmodel_public_observations r
         JOIN observations o ON o.observation_id = r.observation_id
        WHERE r.taxon_label = ?1
          AND o.visibility = 'public'
          AND o.emergency_hidden = 0
          AND NOT EXISTS (
            SELECT 1 FROM observation_data_rights rights
             WHERE rights.visit_id = o.observation_id
               AND rights.withdrawal_status IS NOT NULL
               AND rights.withdrawal_status <> 'active'
          )
        ORDER BY r.observed_at DESC
        LIMIT 2000`,
    ).bind(name).all<Row>()).results ?? [];
  } catch { return null; }
  if (rows.length === 0) return null;
  const areaMap = new Map<string, number>();
  const cellMap = new Map<string, number>();
  const areaOf = new Map<string, string | null>();
  for (const r of rows) {
    const a = r.public_area_label ? normalizeArea(r.public_area_label) : null;
    areaOf.set(r.observation_id, a);
    if (a) areaMap.set(a, (areaMap.get(a) ?? 0) + 1);
    if (r.public_cell) cellMap.set(r.public_cell, (cellMap.get(r.public_cell) ?? 0) + 1);
  }
  const recentRows = rows.slice(0, 12);
  const photos = await photoLoader(recentRows.map((r) => r.observation_id)).catch(() => new Map<string, string>());
  const used = new Set<string>();
  const recent: SpeciesRecent[] = [];
  let heroUrl: string | null = null;
  for (const r of recentRows) {
    const p = photos.get(r.observation_id) ?? null;
    let photoUrl: string | null = null;
    if (p && !heroUrl) { heroUrl = p; used.add(p); }
    else if (p && !used.has(p)) { photoUrl = p; used.add(p); }
    recent.push({ id: r.observation_id, observedAt: r.observed_at, area: areaOf.get(r.observation_id) ?? null, photoUrl });
  }
  const invasive = classifyInvasive(name);
  const slugSci = invasive ? scientificNameFromSlug(invasive.learnSlug) : null;
  const latin = /^[A-Z][a-z]+(?: [a-z-]+)*$/.test(name) ? name : null;
  return {
    name,
    group: (await resolveTaxonGroups(db, [name]).catch(() => new Map<string, string>())).get(name) ?? inferTaxonGroupForLabel(name),
    total: rows.length,
    areas: [...areaMap.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja")).slice(0, 12).map(([area, count]) => ({ area, count })),
    cells: [...cellMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([cell, count]) => ({ cell, count })),
    recent: recent.slice(0, 6),
    firstObservedAt: rows[rows.length - 1]!.observed_at,
    lastObservedAt: rows[0]!.observed_at,
    heroUrl,
    invasiveSlug: invasive?.learnSlug ?? null,
    scientificName: slugSci ?? latin,
    higherRank: isHigherRankName(name),
  };
}

const dateLabel = (iso: string | null, lang: Lang): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return "";
  return lang === "ja" ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : `${EN_MONTHS[Number(m[2]) - 1] ?? ""} ${Number(m[3])}, ${m[1]}`;
};

const thumb = (url: string | null): string => url
  ? `<img class="iv-thumb" src="${esc(url)}" alt="" loading="lazy" width="56" height="56">`
  : `<span class="iv-thumb-ph" aria-hidden="true"></span>`;

export function renderSpeciesSurfacePage(options: {
  data: SpeciesSurfaceData;
  lang: Lang;
  authenticated: boolean;
  displayName?: string | null;
  cspNonce?: string | null;
  invasiveAvailable?: boolean;
  regionAvailable?: boolean;
  origin?: string;
}): string {
  const { data } = options;
  const L = options.lang;
  const prefix = L === "ja" ? "/ja" : `/${L}`;
  const groupName = L === "ja" ? GROUP_LABELS[data.group] ?? "その他" : GROUP_LABELS_EN[data.group] ?? "Other";
  const canonicalPath = `${prefix}/species/${encodeURIComponent(data.name)}`;
  const kv = (k: string, v: string): string => `<div class="iv-kv"><div class="iv-kk">${k}</div><div>${v}</div></div>`;
  const basic = [
    kv(tr(L, "分類", "Group"), esc(groupName) + (data.higherRank ? esc(tr(L, "（科・目などの大まかな名前）", " (broad name such as family or order)")) : "")),
    data.scientificName ? kv(tr(L, "学名", "Scientific name"), `<i>${esc(data.scientificName)}</i>`) : "",
    kv(tr(L, "記録", "Records"), L === "ja" ? `<span class="iv-nb">${data.total}件</span>` : `<span class="iv-nb">${plural(data.total, "record", "records")}</span>`),
    data.firstObservedAt ? kv(tr(L, "最初の記録", "First record"), esc(dateLabel(data.firstObservedAt, L))) : "",
  ].join("");
  const areaRows = data.areas.map((a) => {
    const meta = L === "ja" ? `記録 <span class="iv-nb">${a.count}件</span>` : `<span class="iv-nb">${plural(a.count, "record", "records")}</span>`;
    const inner = `<span class="rs-b"><span class="rs-n">${esc(a.area)}</span><span class="rs-m">${meta}</span></span>${options.regionAvailable ? CHEV_ICON : ""}`;
    return options.regionAvailable
      ? `<a class="rs-row" data-species-area="${esc(a.area)}" href="${esc(regionPath(L, a.area))}">${inner}</a>`
      : `<div class="rs-row" data-species-area="${esc(a.area)}">${inner}</div>`;
  }).join("");
  const mapCard = regionMapCardHtml(data.cells, `${prefix}/map`, L, {
    title: ["この種の記録がある範囲", "Where this species was recorded"],
    aria: ["この種の記録がある範囲（大まかな位置）", "Area with records of this species (approximate location)"],
    note: ["記録がある範囲を、大まかに表示しています。正確な場所は載せていません。", "The area with records is shown roughly. Exact places are not shown."],
  });
  const recentRows = data.recent.map((r) => `<a class="rs-row" data-species-record="${esc(r.id)}" href="${esc(`${prefix}/observations/${encodeURIComponent(r.id)}`)}">${thumb(r.photoUrl)}<span class="rs-b"><span class="rs-n">${esc(dateLabel(r.observedAt, L))}</span>${r.area ? `<span class="rs-m">${esc(r.area)}</span>` : ""}</span>${CHEV_ICON}</a>`).join("");
  const invasiveLink = data.invasiveSlug && options.invasiveAvailable
    ? `<a class="rs-callout" data-species-invasive="1" href="${esc(`${prefix}/invasive/${encodeURIComponent(data.invasiveSlug)}`)}"><span class="rs-ct">${tr(L, "外来種としての扱いを見る", "See how it is handled as an invasive species")}<span class="rs-cs">${tr(L, "区分と根拠、見つかっている場所", "Classification, sources and places found")}</span></span>${CHEV_ICON}</a>`
    : "";
  const learnHref = data.invasiveSlug ? (L === "ja" ? INVASIVE_LEARN_PATH : `/${L}/learn/invasive-species`) : `${prefix}/learn`;
  const tips = data.invasiveSlug
    ? tr(L, "外来種に当たる場合があります。見つけても持ち帰らず、他の場所へ動かさないでください。", "This may count as an invasive species. Do not take it home or move it elsewhere.")
    : tr(L, "観察するときは、生きものにも場所にも触れすぎず、そのままの姿を写真に残してください。", "When observing, avoid disturbing the animal, plant or place, and keep a photo of it as you found it.");
  const body = `<div class="iv-col rs-col" data-species-surface="${esc(data.name)}">
    ${headBar(`${prefix}/map`, L)}
    ${data.heroUrl ? `<div class="iv-hero"><img src="${esc(data.heroUrl)}" alt="" width="760" height="224"></div>` : ""}
    <div class="iv-crumb" style="margin-top:14px"><span>${esc(groupName)}</span></div>
    <h1 class="iv-title iv-nb" style="white-space:normal">${esc(data.name)}</h1>
    ${data.scientificName ? `<div class="iv-sci"><i>${esc(data.scientificName)}</i></div>` : ""}
    <section data-species-part="basic"><div class="iv-h"><span>${tr(L, "基本情報", "Basic information")}</span></div>${basic}</section>
    <section data-species-part="records"><div class="iv-h"><span>${tr(L, "記録と分布", "Records and distribution")}</span></div>${mapCard}
      ${areaRows ? `<div class="iv-h"><span>${tr(L, "記録がある地域", "Regions with records")}</span><span class="iv-cnt">${tr(L, `${data.areas.length}か所`, plural(data.areas.length, "area", "areas"))}</span></div><div>${areaRows}</div>` : ""}
      <div class="iv-h"><span>${tr(L, "最近の記録", "Recent records")}</span></div><div data-species-recent="1">${recentRows}</div>
    </section>
    <section data-species-part="tips"><div class="iv-h"><span>${tr(L, "見るときのヒント", "Tips and cautions")}</span></div><p class="iv-note">${esc(tips)}</p>${invasiveLink}</section>
    <section data-species-part="sources"><div class="iv-h"><span>${tr(L, "根拠と出典", "Basis and sources")}</span></div><p class="rs-foot" style="margin-top:0">${tr(L, "ZUKANに公開された記録から集めています。場所は大まかな範囲だけを使っています。", "Gathered from public records on ZUKAN. Only approximate areas are used for places.")}</p><a class="iv-link" href="${esc(learnHref)}"><span>${tr(L, "使い方と考え方を読む", "Read how ZUKAN works")}</span>${CHEV_ICON}</a></section>
  </div>`;
  const sciPart = data.scientificName ? `（${data.scientificName}）` : "";
  const description = L === "ja"
    ? `${data.name}${sciPart}の公開記録${data.total}件${data.areas.length ? `、記録がある地域${data.areas.length}か所` : ""}。ZUKANの公開記録から集めています。`
    : `${data.name}${data.scientificName ? ` (${data.scientificName})` : ""}: ${plural(data.total, "public record", "public records")}${data.areas.length ? ` in ${plural(data.areas.length, "area", "areas")}` : ""}. Gathered from public records on ZUKAN.`;
  return shell({
    seo: { title: tr(L, `${data.name}の記録と分布 | ZUKAN`, `${data.name}: records and distribution | ZUKAN`), description, origin: options.origin ?? SEO_DEFAULT_ORIGIN, suffix: `/species/${encodeURIComponent(data.name)}`, image: data.heroUrl },
    title: data.name,
    extraCss: EXTRA_CSS,
    lang: L,
    authenticated: options.authenticated,
    displayName: options.displayName,
    pathname: canonicalPath,
    body,
    cspNonce: options.cspNonce,
    script: shareScript(L),
  });
}
