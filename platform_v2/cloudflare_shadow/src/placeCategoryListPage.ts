import { CHEV_ICON, SEO_DEFAULT_ORIGIN, headBar, shell, tr } from "./invasiveMapV1";
import { placeCategoryDef, type PlaceCategoryId } from "./placeCategories";
import { PLACE_CATEGORY_CSS, type CategoryPlaceList } from "./placeCategoryRegion";
import { EXTRA_CSS } from "./regionSurfaceV1";
import { regionPath, regionPathNoLang } from "./regionSlugs";

type Lang = "ja" | "en" | "es" | "pt-br";

const esc = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

const PAGER_CSS = `.pc-pager{display:flex;justify-content:space-between;gap:12px;margin:20px 0 0}.pc-pager a,.pc-pager span{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;border-radius:999px;border:1px solid var(--line);font-size:15px;font-weight:700;white-space:nowrap;text-decoration:none;color:var(--ink);background:#fff}.pc-pager span{visibility:hidden}`;

export function renderRegionPlacesPage(options: {
  list: CategoryPlaceList;
  area: string;
  cat: PlaceCategoryId;
  lang: Lang;
  authenticated: boolean;
  displayName?: string | null;
  cspNonce?: string | null;
  origin?: string;
}): string {
  const { list, area, cat } = options;
  const L = options.lang;
  const def = placeCategoryDef(cat);
  const base = regionPath(L, area);
  const self = `${base}/places`;
  const prefix = `/${L}`;
  const link = (page: number): string => `${self}?cat=${cat}${page > 1 ? `&page=${page}` : ""}`;
  const rows = list.items.map((p) => `<a class="rs-row" data-region-place="${esc(p.id)}" href="${esc(`${prefix}/places/${encodeURIComponent(p.id)}`)}"><span class="rs-b"><span class="rs-n">${esc(p.name)}</span>${p.locality ? `<span class="rs-m">${esc(p.locality)}</span>` : ""}</span>${CHEV_ICON}</a>`).join("");
  const pager = list.pages > 1
    ? `<nav class="pc-pager" data-region-places-pager="1" aria-label="${tr(L, "ページ", "Pages")}">${list.page > 1 ? `<a rel="prev" href="${esc(link(list.page - 1))}">${tr(L, "前へ", "Previous")}</a>` : `<span aria-hidden="true">.</span>`}${list.page < list.pages ? `<a rel="next" href="${esc(link(list.page + 1))}">${tr(L, "次へ", "Next")}</a>` : ""}</nav>`
    : "";
  const content = rows
    ? `<div data-region-places-list="1">${rows}</div>${pager}`
    : `<p class="rs-foot" data-region-empty="1">${tr(L, "この目的の場所はまだありません", "No places for this purpose yet.")}</p>`;
  const title = tr(L, `${area}の${def.label}`, `${def.label} in ${area}`);
  const body = `<div class="iv-col rs-col" data-region-places-page="${esc(area)}" data-region-places-cat="${cat}">
    ${headBar(base, L)}
    <h1 class="iv-title">${esc(title)}</h1>
    <p class="iv-desc">${tr(L, `${list.total}か所`, `${list.total} ${list.total === 1 ? "place" : "places"}`)}</p>
    <a class="rs-all" data-region-places-back="1" href="${esc(base)}">${tr(L, `${area}のページへ戻る`, `Back to ${area}`)}</a>
    ${content}
  </div>`;
  return shell({
    seo: {
      title: `${title} | ZUKAN`,
      description: tr(L, `${area}の${def.label}の場所の一覧。`, `Places in ${area} for: ${def.label}.`),
      origin: options.origin ?? SEO_DEFAULT_ORIGIN,
      suffix: regionPathNoLang(area, "/places"),
      image: null,
    },
    title,
    extraCss: EXTRA_CSS + PLACE_CATEGORY_CSS + PAGER_CSS,
    lang: L,
    authenticated: options.authenticated,
    displayName: options.displayName,
    pathname: self,
    body,
    cspNonce: options.cspNonce,
  });
}
