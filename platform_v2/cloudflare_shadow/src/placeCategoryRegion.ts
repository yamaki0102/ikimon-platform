import { tr } from "./invasiveMapV1";
import {
  HIDDEN_CATEGORY, PENDING_CATEGORY, PLACE_CATEGORIES, PLACE_CATEGORY_IDS, classifyPlace, isPlaceCategoryId, placeCategoryDef,
  type PlaceCategoryId,
} from "./placeCategories";
import { PLACE_AREA_SQL } from "./regionCounts";

type Lang = "ja" | "en" | "es" | "pt-br";
type Stmt = { bind(...v: unknown[]): Stmt; all<T>(): Promise<{ results?: T[] }>; first<T>(): Promise<T | null>; run?(): Promise<unknown> };
export type CategoryDb = { prepare(sql: string): Stmt; batch?(statements: Stmt[]): Promise<unknown> };

export const PLACE_CATEGORIES_FLAG = "PLACE_CATEGORIES_ENABLED";
export const BACKFILL_LIMIT = 200;
export const CATEGORY_LIST_PAGE_SIZE = 30;

const ID_LIST = PLACE_CATEGORY_IDS.map((id) => `'${id}'`).join(",");

export async function runPlaceCategoryBackfill(
  env: { PLACE_CATEGORY_BACKFILL?: string; OBS_DB: CategoryDb },
  now: Date = new Date(),
): Promise<{ scanned: number; classified: number; hidden: number; pending: number }> {
  const result = { scanned: 0, classified: 0, hidden: 0, pending: 0 };
  if (env.PLACE_CATEGORY_BACKFILL !== "on") return result;
  try {
    const rows = (await env.OBS_DB.prepare(
      `SELECT p.place_id AS place_id, p.canonical_name AS canonical_name, p.place_kind AS place_kind, p.metadata_json AS metadata_json
         FROM places p LEFT JOIN place_category_assignments a ON a.place_id = p.place_id
        WHERE p.public_profile_status = 'published' AND p.superseded_by_place_id IS NULL AND a.place_id IS NULL
        ORDER BY p.place_id LIMIT ?1`,
    ).bind(BACKFILL_LIMIT).all<{ place_id: string; canonical_name: string | null; place_kind: string | null; metadata_json: string | null }>()).results ?? [];
    const decidedAt = now.toISOString();
    const statements: Stmt[] = [];
    for (const row of rows) {
      result.scanned += 1;
      const c = classifyPlace(row);
      const primary = c?.primary ?? PENDING_CATEGORY;
      const status = c ? "confirmed" : "candidate";
      if (!c) result.pending += 1; else if (c.primary === HIDDEN_CATEGORY) result.hidden += 1; else result.classified += 1;
      statements.push(env.OBS_DB.prepare(
        `INSERT OR IGNORE INTO place_category_assignments (place_id, primary_category, status, source, rule_id, confidence, decided_at) VALUES (?1, ?2, ?3, 'rule', ?4, NULL, ?5)`,
      ).bind(row.place_id, primary, status, c?.rule_id ?? "none", decidedAt));
      for (const tag of c?.tags ?? []) {
        statements.push(env.OBS_DB.prepare(`INSERT OR IGNORE INTO place_category_tags (place_id, tag, source) VALUES (?1, ?2, 'rule')`).bind(row.place_id, tag));
      }
    }
    if (statements.length === 0) return result;
    if (env.OBS_DB.batch) await env.OBS_DB.batch(statements);
    else for (const s of statements) await s.run?.();
  } catch (error) {
    console.error("[place-category-backfill] failed", error);
  }
  return result;
}

export type RegionCategoryEntry = { id: PlaceCategoryId; count: number };
export type RegionCategories = { total: number; primaryTotal: number; pending: number; entries: RegionCategoryEntry[] };

const AREA_IDS = `SELECT place_id FROM places WHERE ${PLACE_AREA_SQL}`;

export async function loadRegionCategories(db: CategoryDb, area: string): Promise<RegionCategories | null> {
  try {
    const total = Number((await db.prepare(`SELECT COUNT(*) AS n FROM places WHERE ${PLACE_AREA_SQL}`).bind(area).first<{ n: number }>())?.n ?? 0);
    const primaryTotal = Number((await db.prepare(
      `SELECT COUNT(*) AS n FROM place_category_assignments WHERE status = 'confirmed' AND primary_category IN (${ID_LIST}) AND place_id IN (${AREA_IDS})`,
    ).bind(area).first<{ n: number }>())?.n ?? 0);
    const pending = Number((await db.prepare(
      `SELECT COUNT(*) AS n FROM places WHERE ${PLACE_AREA_SQL} AND place_id NOT IN (SELECT place_id FROM place_category_assignments WHERE status = 'confirmed' AND primary_category IN (${ID_LIST}))`,
    ).bind(area).first<{ n: number }>())?.n ?? 0);
    if (total !== primaryTotal + pending) return null;
    const rows = (await db.prepare(
      `SELECT c AS cat, COUNT(DISTINCT place_id) AS n FROM (
         SELECT place_id, primary_category AS c FROM place_category_assignments WHERE status = 'confirmed' AND place_id IN (${AREA_IDS})
         UNION SELECT place_id, tag AS c FROM place_category_tags WHERE place_id IN (${AREA_IDS})
       ) GROUP BY c`,
    ).bind(area).all<{ cat: string; n: number }>()).results ?? [];
    const counts = new Map<PlaceCategoryId, number>();
    for (const r of rows) if (isPlaceCategoryId(r.cat)) counts.set(r.cat, Number(r.n) || 0);
    const entries = PLACE_CATEGORIES.map((d) => ({ id: d.id, count: counts.get(d.id) ?? 0 })).filter((e) => e.count > 0);
    return { total, primaryTotal, pending, entries };
  } catch {
    return null;
  }
}

export type CategoryPlace = { id: string; name: string; locality: string | null; kind: string };
export type CategoryPlaceList = { items: CategoryPlace[]; total: number; page: number; pages: number };

export async function loadRegionCategoryPlaces(db: CategoryDb, area: string, cat: PlaceCategoryId, page: number): Promise<CategoryPlaceList> {
  const page0 = Math.max(1, Math.floor(Number(page)) || 1);
  try {
    const scope = `${PLACE_AREA_SQL} AND place_id IN (
      SELECT place_id FROM place_category_assignments WHERE status = 'confirmed' AND primary_category = ?2
      UNION SELECT place_id FROM place_category_tags WHERE tag = ?2)`;
    const total = Number((await db.prepare(`SELECT COUNT(*) AS n FROM places WHERE ${scope}`).bind(area, cat).first<{ n: number }>())?.n ?? 0);
    const pages = Math.max(1, Math.ceil(total / CATEGORY_LIST_PAGE_SIZE));
    const p = Math.min(page0, pages);
    if (total === 0) return { items: [], total: 0, page: p, pages };
    const rows = (await db.prepare(
      `SELECT place_id, canonical_name, locality_label, place_kind FROM places WHERE ${scope} ORDER BY canonical_name, place_id LIMIT ${CATEGORY_LIST_PAGE_SIZE} OFFSET ${(p - 1) * CATEGORY_LIST_PAGE_SIZE}`,
    ).bind(area, cat).all<{ place_id: string; canonical_name: string; locality_label: string | null; place_kind: string }>()).results ?? [];
    return { items: rows.map((r) => ({ id: r.place_id, name: r.canonical_name, locality: r.locality_label, kind: r.place_kind })), total, page: p, pages };
  } catch {
    return { items: [], total: 0, page: page0, pages: 1 };
  }
}

const esc = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

export const PLACE_CATEGORY_CSS = `
.pc-feat{display:block;margin-top:12px;padding:18px;border-radius:16px;background:linear-gradient(135deg,#7FA8A0,#3E6B5A 55%,#274E3E);color:#fff;text-decoration:none;min-height:44px}
.pc-feat .pc-nm{font-size:21px;font-weight:900}
.pc-feat .pc-ex{font-size:13.5px;font-weight:600;opacity:.92;margin-top:3px}
.pc-feat .pc-ct{font-size:13.5px;font-weight:800;margin-top:8px}
.pc-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
@media(min-width:1024px){.pc-grid{grid-template-columns:repeat(3,1fr)}}
.pc-cat{display:block;padding:13px 14px;border-radius:14px;background:#fff;border:1px solid var(--line);color:var(--ink);text-decoration:none;min-height:44px}
.pc-cat .pc-nm{font-size:16px;font-weight:800}
.pc-cat .pc-ex{margin-top:3px;font-size:12.5px;font-weight:600;line-height:1.55;color:var(--muted)}
.pc-cat .pc-ct{margin-top:6px;font-size:13px;font-weight:800;color:var(--green)}
.pc-nb{white-space:nowrap}
.pc-note{margin:2px 0 0;font-size:14px;color:var(--muted)}
`;

const exampleSpans = (examples: readonly string[], sep: string): string => examples.map((e) => `<span class="pc-nb">${esc(e)}</span>`).join(sep);

export function renderRegionCategoryEntrances(L: Lang, base: string, categories: RegionCategories | null | undefined, recordTotal = 0): string {
  if (!categories || categories.entries.length === 0) return "";
  const href = (id: PlaceCategoryId): string => `${base}/places?cat=${id}`;
  const countText = (n: number): string => (L === "ja" ? `${n}か所` : `${n} ${n === 1 ? "place" : "places"}`);
  const nature = categories.entries.find((e) => e.id === "nature");
  const rest = categories.entries.filter((e) => e.id !== "nature");
  const featDef = placeCategoryDef("nature");
  const feat = nature
    ? `<a class="pc-feat" data-region-category="nature" data-region-category-featured="1" href="${esc(href("nature"))}"><div class="pc-nm">${featDef.glyph} ${esc(featDef.label)}</div><div class="pc-ex">${exampleSpans(featDef.examples, "／")}</div><div class="pc-ct">${esc(countText(nature.count))}${recordTotal > 0 ? (L === "ja" ? `・記録 ${recordTotal}件` : ` · ${recordTotal} records`) : ""}</div></a>`
    : "";
  const cards = rest.map((e) => {
    const d = placeCategoryDef(e.id);
    return `<a class="pc-cat" data-region-category="${e.id}" href="${esc(href(e.id))}"><div class="pc-nm">${esc(d.label)}</div><div class="pc-ex">${exampleSpans(d.examples, "・")}</div><div class="pc-ct">${esc(countText(e.count))}</div></a>`;
  }).join("");
  return `<section data-region-shelf="categories" data-region-category-total="${categories.total}" data-region-category-pending="${categories.pending}"><div class="rs-shelf-h"><h2>${tr(L, "目的から探す", "Find by purpose")}</h2></div><p class="pc-note">${tr(L, "行きたい理由から、場所を探せます", "Find places by why you want to go")}</p>${feat}${cards ? `<div class="pc-grid">${cards}</div>` : ""}</section>`;
}
