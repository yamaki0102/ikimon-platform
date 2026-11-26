import type { Env } from "./core/env";
import type { TopLibraryGroup, TopOneYearPair } from "./zukanTopPage";
import { loadUserLibraryData, loadUserLibraryGroup } from "./zukanTopPage";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";

type Lang = "ja" | "en" | "es" | "pt-br";

const esc = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

const CHEVRON_LEFT = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>`;
const BOOK = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/></svg>`;
const SHARE = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4"/><path d="m8 8 4-4 4 4"/><path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6"/></svg>`;

export const ZUKAN_LIBRARY_DETAIL_CSS = `
    .zd-head{position:relative;display:flex;align-items:center;justify-content:center;min-height:52px;margin:0 0 8px}
    .zd-back,.zd-back:visited{position:absolute;left:-8px;top:50%;transform:translateY(-50%);width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;color:var(--ink);text-decoration:none}
    .zd-head h1{margin:0;font-size:18px;font-weight:700;line-height:1.4}
    .zd-lead{margin:0 0 20px;color:var(--muted);font-size:16px;line-height:1.7}
    .zd-title{margin:0 0 4px;font-size:22px;line-height:1.4}
    .zd-sub{margin:0 0 16px;color:var(--muted);font-size:16px}
    .zd-rest{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:8px}
    .zd-rest a{position:relative;display:block;aspect-ratio:1/1;border-radius:14px;overflow:hidden;background:var(--surface-2)}
    .zd-rest img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    .zd-rows{margin:20px 0;display:grid}
    .zd-row{display:grid;grid-template-columns:96px minmax(0,1fr);gap:12px;padding:14px 0;border-bottom:1px solid var(--line);font-size:16px}
    .zd-row dt{color:var(--muted);font-weight:700}
    .zd-row dd{margin:0;font-weight:700;overflow-wrap:anywhere}
    .zd-cta{display:grid;gap:12px;margin:0 0 24px}
    .zd-cta a,.zd-cta a:visited{min-height:52px;display:flex;align-items:center;justify-content:center;gap:10px;border-radius:16px;font-size:17px;font-weight:700;text-decoration:none}
    .zd-cta .is-main{background:var(--green);color:#fff}
    .zd-cta .is-ghost{background:#fff;color:var(--green);border:1.5px solid var(--green)}
    .zd-yrows{list-style:none;margin:0;padding:0;display:grid;gap:28px}
    .zd-yrow{display:grid;gap:10px}
    .zd-ypair{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .zd-ypair a{position:relative;display:block;aspect-ratio:1/0.95;border-radius:20px;overflow:hidden;background:var(--surface-2)}
    .zd-ypair img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    .zd-ypill{position:absolute;top:12px;left:12px;padding:5px 14px;border-radius:999px;background:rgba(255,255,255,.94);color:var(--ink);font-size:15px;font-weight:700}
    .zd-ymeta{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 4px 12px;border-bottom:1px solid var(--line);color:var(--ink);text-decoration:none}
    .zd-ymeta strong{display:block;font-size:18px;line-height:1.4}
    .zd-ymeta small{display:block;color:var(--muted);font-size:14px}
    .zd-ychev{color:var(--control,#8a948d);font-size:26px;line-height:1}
    .zd-empty{padding:32px 0;color:var(--muted);font-size:16px;line-height:1.8}
    @media(min-width:960px){.zd-yrows{grid-template-columns:repeat(2,minmax(0,1fr));gap:32px 28px}}
`;

function head(title: string, backHref: string, isEn: boolean): string {
  return `<div class="zd-head"><a class="zd-back" href="${esc(backHref)}" aria-label="${isEn ? "Back" : "もどる"}">${CHEVRON_LEFT}</a><h1>${esc(title)}</h1></div>`;
}

function dateOnly(headerLabel: string): string {
  const sep = headerLabel.indexOf("・");
  return sep >= 0 ? headerLabel.slice(0, sep) : headerLabel;
}

export function renderLibraryGroupDetailPage(
  group: TopLibraryGroup,
  options: { lang: Lang; displayName?: string | null },
): string {
  const isEn = options.lang === "en";
  const prefix = `/${options.lang}`;
  const k = encodeURIComponent(group.groupKey);
  const withPhoto = group.photos.filter((p) => Boolean(p.photoUrl));
  const ordered = withPhoto.length > 0 ? withPhoto : group.photos;
  const head3 = ordered.slice(0, 3);
  const rest = ordered.slice(3);
  const tile = (ph: TopLibraryGroup["photos"][number]) => {
    const href = `${prefix}/observations/${encodeURIComponent(ph.observationId)}`;
    return ph.photoUrl
      ? `<a class="zk-tile" href="${esc(href)}" data-obs-id="${esc(ph.observationId)}"><img src="${esc(ph.photoUrl)}" alt="${esc(ph.title)}" loading="lazy"></a>`
      : `<a class="zk-tile" href="${esc(href)}" data-obs-id="${esc(ph.observationId)}"><span class="zk-fallback">${esc(ph.title)}</span></a>`;
  };
  const mosaicClass = head3.length >= 3 ? "" : head3.length === 2 ? " is-two" : " is-one";
  const restHtml = rest.length > 0 ? `<div class="zd-rest">${rest.map(tile).join("")}</div>` : "";
  const status = group.published
    ? (isEn ? "On the place page in ZUKAN" : `${group.placeName}の図鑑に載っています`)
    : (isEn ? "Only you can see this for now" : "まだ自分だけに見えています");
  const body = `<section data-library-group-detail="${esc(group.groupKey)}">
    ${head(dateOnly(group.headerLabel), `${prefix}/library`, isEn)}
    <h2 class="zd-title">${esc(group.placeName)}</h2>
    <p class="zd-sub">${isEn ? `${group.photos.length} photos` : `写真 ${group.photos.length}枚`}・${esc(group.placeName)}</p>
    <div class="zk-mosaic${mosaicClass}">${head3.map(tile).join("")}</div>
    ${restHtml}
    <dl class="zd-rows">
      <div class="zd-row"><dt>${isEn ? "Status" : "状態"}</dt><dd>${esc(status)}</dd></div>
      <div class="zd-row"><dt>${isEn ? "Place" : "場所"}</dt><dd>${esc(group.placeName)}</dd></div>
    </dl>
    <div class="zd-cta">
      <a class="is-main" href="${esc(group.published ? `${prefix}/records?view=mine` : `${prefix}/library/link?group=${k}`)}">${BOOK}${group.published ? (isEn ? "Review" : "公開中・確認") : (isEn ? "Add to ZUKAN" : "図鑑に載せる")}</a>
      <a class="is-ghost" href="${esc(`${prefix}/library/link/album?group=${k}`)}">${SHARE}${isEn ? "Share" : "共有する"}</a>
    </div>
  </section>`;
  return renderZukanCommonShell({
    lang: options.lang,
    title: isEn ? "Photos of the day" : "この日の写真",
    activeNav: "library",
    authenticated: true,
    displayName: options.displayName,
    bodyHtml: body,
    pathname: `${prefix}/library/group`,
    extraCss: ZUKAN_LIBRARY_DETAIL_CSS,
  });
}

function lastDayLabel(iso: string | undefined, isEn: boolean): string {
  if (!iso) return "";
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return "";
  return isEn ? `Last record ${Number(m[1])}/${Number(m[2])}` : `最後の記録は${Number(m[1])}月${Number(m[2])}日`;
}

export function renderLibraryYearAgoListPage(
  pairs: TopOneYearPair[],
  options: { lang: Lang; displayName?: string | null },
): string {
  const isEn = options.lang === "en";
  const prefix = `/${options.lang}`;
  const rows = pairs
    .filter((p) => p.photos.length >= 2 && p.photos.every((ph) => Boolean(ph.photoUrl)))
    .map((p) => {
      const cells = p.photos
        .map((ph) => `<a href="${esc(ph.href)}"><img src="${esc(ph.photoUrl)}" alt="${esc(`${p.placeName} ${ph.monthLabel}`)}" loading="lazy"><span class="zd-ypill">${esc(ph.monthLabel)}</span></a>`)
        .join("");
      const meta = [typeof p.recordCount === "number" ? (isEn ? `${p.recordCount} records` : `記録 ${p.recordCount}件`) : "", lastDayLabel(p.lastObservedAt, isEn)]
        .filter(Boolean)
        .join(" ・ ");
      const href = p.placeId ? `${prefix}/places/${encodeURIComponent(p.placeId)}` : `${prefix}/library`;
      return `<li class="zd-yrow" data-year-ago-row="1"><div class="zd-ypair">${cells}</div><a class="zd-ymeta" href="${esc(href)}"><span><strong>${esc(p.placeName)}</strong>${meta ? `<small>${esc(meta)}</small>` : ""}</span><span class="zd-ychev" aria-hidden="true">›</span></a></li>`;
    })
    .join("");
  const body = `<section data-library-year-ago-list="1">
    ${head(isEn ? "This place, a year ago" : "1年前のこの場所", `${prefix}/library`, isEn)}
    <p class="zd-lead">${isEn ? "Same places, last year and this year." : "同じ場所の、去年と今年の写真です。場所に時間がたまっているのが分かります。"}</p>
    ${rows ? `<ul class="zd-yrows">${rows}</ul>` : `<p class="zd-empty">${isEn ? "A place appears here once you have photos from a year apart." : "1年あいだをあけて同じ場所で撮ると、ここに並びます。"}</p>`}
  </section>`;
  return renderZukanCommonShell({
    lang: options.lang,
    title: isEn ? "This place, a year ago" : "1年前のこの場所",
    activeNav: "library",
    authenticated: true,
    displayName: options.displayName,
    bodyHtml: body,
    pathname: `${prefix}/library/year-ago`,
    extraCss: ZUKAN_LIBRARY_DETAIL_CSS,
  });
}

export async function handleLibraryDetailRoute(
  env: Env,
  session: { userId: string; displayName?: string | null; banned?: boolean } | null,
  lang: Lang,
  nativePathname: string,
  searchParams: URLSearchParams,
): Promise<Response | null> {
  if (nativePathname !== "/library/group" && nativePathname !== "/library/year-ago") return null;
  const prefix = `/${lang}`;
  if (!session || session.banned) {
    const back = `${prefix}${nativePathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    return new Response(null, { status: 302, headers: { location: `${prefix}/login?redirect=${encodeURIComponent(back)}`, "cache-control": "no-store" } });
  }
  const headers = { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" };
  if (nativePathname === "/library/year-ago") {
    const data = await loadUserLibraryData(env, session.userId);
    return new Response(renderLibraryYearAgoListPage(data.yearPairs, { lang, displayName: session.displayName }), { status: 200, headers });
  }
  const key = (searchParams.get("group") ?? "").slice(0, 160);
  const group = await loadUserLibraryGroup(env, session.userId, key);
  if (!group) return new Response(null, { status: 302, headers: { location: `${prefix}/library`, "cache-control": "no-store" } });
  return new Response(renderLibraryGroupDetailPage(group, { lang, displayName: session.displayName }), { status: 200, headers });
}
