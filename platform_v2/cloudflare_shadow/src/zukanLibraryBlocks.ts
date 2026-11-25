import type { TopLibraryGroup, TopOneYearPair } from "./zukanTopPage";
import { ZUKAN_SHELL_ICONS } from "./zukanShellChrome";

const esc = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

export const ZUKAN_LIBRARY_CSS = `
    .zk-sec-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:0 0 12px}
    .zk-sec-head h2{margin:0;font-size:20px;font-weight:700;line-height:1.4}
    .zk-year{display:grid}
    .zk-more,.zk-more:visited{min-height:44px;display:inline-flex;align-items:center;font-size:14px;font-weight:700;color:var(--link);text-decoration:none}
    .zk-pair{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:2px;border-radius:20px;overflow:hidden;background:#17211b;aspect-ratio:1.72/1;border:1px solid var(--line)}
    .zk-pair.zk-pair-one{grid-template-columns:1fr}
    .zk-pair a{position:relative;display:block;min-width:0;overflow:hidden}
    .zk-pair img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover}
    .zk-pair-shade{position:absolute;inset:auto 0 0 0;height:62%;background:linear-gradient(180deg,rgba(8,18,12,0) 0%,rgba(8,18,12,.72) 78%);pointer-events:none}
    .zk-pair-copy{position:absolute;left:0;right:0;bottom:0;padding:0 18px 16px;color:#fff;pointer-events:none}
    .zk-pair-copy strong{display:block;font-size:20px;line-height:1.35;font-weight:700}
    .zk-pair-copy span{display:block;font-size:14px;line-height:1.5;margin-top:2px}
    .zk-pill{position:absolute;top:12px;left:12px;z-index:2;padding:5px 12px;border-radius:999px;background:rgba(23,33,27,.72);color:#fff;font-size:14px;font-weight:700;line-height:1.3}
    .zk-pill.is-now{left:auto;right:12px;background:#fff;color:var(--ink)}
    .zk-groups{display:grid;gap:32px}
    .zk-more-wrap{display:flex;justify-content:center;margin:28px 0 8px}
    .zk-more-btn,.zk-more-btn:visited{min-height:48px;padding:10px 28px;border-radius:999px;background:#fff;color:var(--green);border:2px solid var(--green);font-size:16px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
    .zk-more-btn[aria-busy=true]{opacity:.6}
    @media(min-width:960px){.zk-groups{grid-template-columns:repeat(2,minmax(0,1fr));gap:36px 28px;align-items:start}.zk-pair{aspect-ratio:2.7/1}.zk-mosaic{aspect-ratio:1.45/1}.zk-pair-copy strong{font-size:22px}}
    .zk-group{display:grid;gap:12px}
    .zk-group-head{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
    .zk-group-head h2{margin:0;display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;font-size:18px;line-height:1.4;font-weight:700;min-width:0;flex:1 1 auto}
    .zk-place{font-size:14px;font-weight:700;color:var(--muted)}
    .zk-count,.zk-count:visited{margin-left:auto;font-size:14px;color:var(--muted);text-decoration:none;white-space:nowrap}
    .zk-mosaic{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:4px;aspect-ratio:1.4/1;border-radius:20px;overflow:hidden;background:var(--surface)}
    .zk-mosaic a{position:relative;display:block;min-width:0;min-height:0;overflow:hidden;background:var(--surface-2);color:var(--ink);text-decoration:none}
    .zk-mosaic a:first-child{grid-row:1/3}
    .zk-mosaic.is-one{grid-template-columns:1fr;grid-template-rows:1fr}
    .zk-mosaic.is-two{grid-template-rows:1fr}
    .zk-mosaic.is-one a:first-child,.zk-mosaic.is-two a:first-child{grid-row:auto}
    .zk-mosaic img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover}
    .zk-mosaic .zk-fallback{display:flex;align-items:center;justify-content:center;height:100%;padding:8px;font-size:14px;text-align:center}
    .zk-foot{display:grid;gap:10px;justify-items:start}
    .zk-chip{display:inline-flex;align-items:center;gap:6px;min-height:28px;padding:0 12px;border-radius:999px;font-size:13px;font-weight:700;line-height:1;white-space:nowrap}
    .zk-chip.is-private{background:var(--surface-2);color:var(--muted)}
    .zk-chip.is-public{background:var(--green);color:#fff}
    .zk-chip.is-public::before{content:"";width:6px;height:10px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg) translate(-1px,-1px)}
    .zk-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    .zk-actions .zk-btn,.zk-actions .zk-btn:visited,.zk-actions .zk-btn:hover,.zk-actions .zk-btn:active{box-sizing:border-box;min-height:44px;min-width:44px;display:inline-flex;align-items:center;justify-content:center;padding:0 18px;border-radius:999px;border:1.5px solid var(--green);font:inherit;font-size:14px;font-weight:700;line-height:1.2;text-decoration:none;cursor:pointer;background:#fff;color:var(--green)}
    .zk-actions .zk-btn.is-primary,.zk-actions .zk-btn.is-primary:visited,.zk-actions .zk-btn.is-primary:hover,.zk-actions .zk-btn.is-primary:active{background:var(--green);color:#fff}
    .zk-actions .zk-btn.is-danger,.zk-actions .zk-btn.is-danger:visited,.zk-actions .zk-btn.is-danger:hover,.zk-actions .zk-btn.is-danger:active{border-color:#e3b9b5;color:#b3261e}
    .zk-empty{display:grid;gap:28px}
    .zk-empty-hero{display:grid;justify-items:center;gap:12px;text-align:center;padding-top:8px}
    .zk-empty-ic{width:76px;height:76px;border-radius:50%;background:var(--surface-2);color:var(--green);display:flex;align-items:center;justify-content:center;margin-bottom:8px}
    .zk-empty-ic svg{width:34px;height:34px}
    .zk-empty-hero h1{margin:0;font-size:24px;line-height:1.4}
    .zk-empty-hero p{margin:0;color:var(--muted);font-size:16px;line-height:1.8;max-width:30em}
    .zk-empty-cta{display:grid;gap:12px}
    .zk-empty-cta .zk-btn-big,.zk-empty-cta .zk-btn-big:visited{min-height:56px;display:flex;align-items:center;justify-content:center;gap:10px;border-radius:16px;background:var(--green);color:#fff;font-size:18px;font-weight:700;text-decoration:none;box-shadow:0 2px 8px rgba(20,63,46,.2)}
    .zk-empty-cta .zk-btn-big svg{width:22px;height:22px}
    .zk-empty-cta .zk-btn-ghost,.zk-empty-cta .zk-btn-ghost:visited{min-height:52px;display:flex;align-items:center;justify-content:center;border-radius:16px;background:#fff;color:var(--green);border:1.5px solid var(--green);font-size:16px;font-weight:700;text-decoration:none}
    .zk-steps{list-style:none;margin:0;padding:0;display:grid}
    .zk-steps li{border-bottom:1px solid var(--line)}
    .zk-step,.zk-step:visited{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:16px;align-items:center;padding:14px 0;color:var(--ink);text-decoration:none;min-height:72px}
    div.zk-step{grid-template-columns:48px minmax(0,1fr)}
    .zk-step-ic{width:48px;height:48px;border-radius:14px;background:var(--surface-2);color:var(--green);display:flex;align-items:center;justify-content:center}
    .zk-step-ic svg{width:24px;height:24px}
    .zk-step strong{display:block;font-size:17px;line-height:1.4}
    .zk-step span.zk-step-sub{display:block;font-size:14px;color:var(--muted);line-height:1.5}
    .zk-step-chev{color:var(--control);font-size:26px;line-height:1}
`;

function monthLabel(raw: string): string {
  const m = /^(\d{4})年(\d{1,2})月$/.exec(raw);
  if (!m) return raw;
  const diff = new Date().getUTCFullYear() - Number(m[1]);
  if (diff === 0) return `今年 ${m[2]}月`;
  if (diff === 1) return `去年 ${m[2]}月`;
  return raw;
}

export function renderYearPairCard(pair: TopOneYearPair, isEn: boolean, prefix = "/ja"): string {
  const heading = pair.kind === "year_ago" ? (isEn ? "This place, a year ago" : "1年前のこの場所") : (isEn ? "This place now" : "この場所の今");
  const caption = pair.kind === "year_ago" ? (isEn ? "Same place, last year and this year." : "同じ場所の、去年と今年。") : "";
  const photos = pair.photos.filter((p) => Boolean(p.photoUrl));
  if (photos.length === 0) return "";
  const cells = photos
    .map((p, i) => {
      const label = esc(monthLabel(p.monthLabel));
      const pillClass = photos.length > 1 && i === photos.length - 1 ? "zk-pill is-now" : "zk-pill";
      return `<a href="${esc(p.href)}"><img src="${esc(p.photoUrl)}" alt="${esc(`${pair.placeName} ${p.monthLabel}`)}" loading="lazy"><span class="${pillClass}">${label}</span></a>`;
    })
    .join("");
  return `<section class="zk-year" aria-labelledby="zt-year-heading" data-library-one-year-pair="1">
      <div class="zk-sec-head"><h2 id="zt-year-heading">${esc(heading)}</h2>${pair.kind === "year_ago" ? `<a class="zk-more" href="${esc(`${prefix}/library/year-ago`)}">${isEn ? "See all" : "すべて見る"}</a>` : ""}</div>
      <div class="zk-pair${photos.length === 1 ? " zk-pair-one" : ""}">${cells}<span class="zk-pair-shade"></span><div class="zk-pair-copy"><strong>${esc(pair.placeName)}</strong>${caption ? `<span>${esc(caption)}</span>` : ""}</div></div>
    </section>`;
}

export type LibraryGroupMode = "top" | "library";

export function renderLibraryGroup(
  group: TopLibraryGroup,
  options: { prefix: string; isEn: boolean; mode: LibraryGroupMode },
): string {
  const { prefix, isEn, mode } = options;
  const sep = group.headerLabel.indexOf("・");
  const dateLabel = sep >= 0 ? group.headerLabel.slice(0, sep) : group.headerLabel;
  const placeLabel = sep >= 0 ? group.headerLabel.slice(sep + 1) : "";
  const withPhoto = group.photos.filter((p) => Boolean(p.photoUrl));
  const shown = (withPhoto.length > 0 ? withPhoto : group.photos).slice(0, 3);
  const tiles = shown
    .map((ph) => {
      const href = `${prefix}/observations/${encodeURIComponent(ph.observationId)}`;
      const inner = ph.photoUrl
        ? `<img src="${esc(ph.photoUrl)}" alt="${esc(ph.title)}" loading="lazy">`
        : `<span class="zk-fallback">${esc(ph.title)}</span>`;
      return `<a class="zk-tile" href="${esc(href)}" data-obs-id="${esc(ph.observationId)}">${inner}</a>`;
    })
    .join("");
  const hiddenObs = group.photos
    .filter((p) => !shown.some((s) => s.observationId === p.observationId))
    .map((p) => `<span hidden data-obs-id="${esc(p.observationId)}"></span>`)
    .join("");
  const mosaicClass = shown.length >= 3 ? "" : shown.length === 2 ? " is-two" : " is-one";
  const statusText = group.published
    ? isEn ? `On the ${group.placeName} page in ZUKAN` : `${group.placeName}の図鑑に載っています`
    : isEn ? "Only me" : "自分のみ";
  const count = isEn ? `${group.photos.length}` : `${group.photos.length}枚`;
  let actions = "";
  if (mode === "top") {
    actions = group.published
      ? `<button type="button" class="zk-btn is-secondary zk-act" data-zukan-unpublish="${esc(group.groupKey)}">${isEn ? "In ZUKAN" : "図鑑に掲載中"}</button>`
      : `<button type="button" class="zk-btn is-primary zk-act" data-zukan-open-popover="${esc(group.groupKey)}" data-place-id="${esc(group.placeId ?? "")}" data-place-name="${esc(group.placeName)}">${isEn ? "Add to ZUKAN" : "図鑑に載せる"}</button>`;
  } else {
    const k = encodeURIComponent(group.groupKey);
    actions = `<a class="zk-btn ${group.published ? "is-secondary" : "is-primary"}" href="${esc(group.published ? `${prefix}/records?view=mine` : `${prefix}/library/link?group=${k}`)}">${group.published ? (isEn ? "Published" : "公開中・確認") : (isEn ? "Review & publish" : "まとめて確認・公開")}</a>
      <a class="zk-btn is-secondary" href="${esc(`${prefix}/library/link/album?group=${k}`)}">${isEn ? "Share by link" : "リンクで共有する"}</a>
      ${group.published ? `<a class="zk-btn is-danger" href="${esc(`${prefix}/library/link/cancel?group=${k}`)}">${isEn ? "Undo link" : "つなぎを取り消す"}</a>` : ""}`;
  }
  return `<section class="zk-group" data-group-key="${esc(group.groupKey)}" data-library-group="${esc(group.groupKey)}">
      <div class="zk-group-head">
        <h2><span>${esc(dateLabel)}</span>${placeLabel ? `<span class="zk-place">${esc(placeLabel)}</span>` : ""}</h2>
        <a class="zk-count" href="${esc(`${prefix}/library/group?group=${encodeURIComponent(group.groupKey)}`)}">${esc(count)}</a>
      </div>
      <div class="zk-mosaic${mosaicClass}">${tiles}</div>${hiddenObs}
      <div class="zk-foot">
        <span class="zk-chip ${group.published ? "is-public" : "is-private"}" data-library-status="${group.published ? "public" : "private"}">${esc(statusText)}</span>
        <div class="zk-actions">${actions}</div>
      </div>
    </section>`;
}

export function renderLibraryEmpty(options: { prefix: string; isEn: boolean }): string {
  const { prefix, isEn } = options;
  const I = ZUKAN_SHELL_ICONS;
  const step = (icon: string, title: string, sub: string) =>
    `<li><div class="zk-step"><span class="zk-step-ic">${icon}</span><span><strong>${esc(title)}</strong><span class="zk-step-sub">${esc(sub)}</span></span></div></li>`;
  return `<section class="zk-empty" data-library-empty="1">
      <div class="zk-empty-hero">
        <span class="zk-empty-ic" aria-hidden="true">${I.camera}</span>
        <h1>${isEn ? "No photos yet" : "まだ写真がありません"}</h1>
        <p>${isEn ? "Photos you take pile up here by place and date. Photos from events and festivals can be kept together too." : "撮った写真は、場所と日にちでここにたまります。観察会やお祭りで撮ったものも、まとめて残せます。"}</p>
      </div>
      <div class="zk-empty-cta">
        <a class="zk-btn-big" href="${esc(`${prefix}/record`)}" data-global-record-trigger="photo">${I.camera}${isEn ? "Capture" : "撮る"}</a>
        <a class="zk-btn-ghost" href="${esc(`${prefix}/record`)}">${isEn ? "Choose photos to add" : "写真を選んで入れる"}</a>
      </div>
      <div>
        <div class="zk-sec-head"><h2>${isEn ? "When you record, this happens" : "記録すると、こうなります"}</h2></div>
        <ul class="zk-steps">
          ${step(I.camera, isEn ? "Capture" : "撮る", isEn ? "Place and time are attached on the spot" : "その場で、場所と日時がつきます")}
          ${step(I.library, isEn ? "Pile up" : "たまる", isEn ? "Kept as bundles by day and event" : "日にちと催しごとに、束になって残ります")}
          ${step(I.book, isEn ? "Connect" : "つながる", isEn ? "Can join a place's ZUKAN or an event album" : "場所の図鑑や、催しのアルバムに載せられます")}
          <li><a class="zk-step" href="${esc(`${prefix}/welcome`)}"><span class="zk-step-ic">${I.book}</span><span><strong>${isEn ? "A quick tour" : "はじめの案内を見る"}</strong><span class="zk-step-sub">${isEn ? "3 short steps" : "3つのステップで使い方を見られます"}</span></span><span class="zk-step-chev" aria-hidden="true">›</span></a></li>
        </ul>
      </div>
      <div>
        <div class="zk-sec-head"><h2>${isEn ? "Joined an event?" : "観察会に参加しましたか"}</h2></div>
        <ul class="zk-steps">
          <li><a class="zk-step" href="${esc(`${prefix}/community/events`)}"><span class="zk-step-ic">${I.events}</span><span><strong>${isEn ? "See the event photos" : "イベントの写真を見る"}</strong><span class="zk-step-sub">${isEn ? "Photos everyone took are gathered here" : "みんなが撮った写真が集まっています"}</span></span><span class="zk-step-chev" aria-hidden="true">›</span></a></li>
        </ul>
      </div>
    </section>`;
}

export function renderLibraryGroups(
  groups: TopLibraryGroup[],
  options: { prefix: string; isEn: boolean; mode: LibraryGroupMode },
): string {
  return `<div class="zk-groups">${groups.filter((g) => g.photos.some((p) => Boolean(p.photoUrl))).map((g) => renderLibraryGroup(g, options)).join("")}</div>`;
}

export function renderLibraryMore(options: { href: string; isEn: boolean }): string {
  return `<div class="zk-more-wrap" data-library-more="1"><a class="zk-more-btn" data-load-more="1" href="${esc(options.href)}">${options.isEn ? "Show more" : "もっと見る"}</a></div>`;
}
