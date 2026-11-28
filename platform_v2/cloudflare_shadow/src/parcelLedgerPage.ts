import { SEO_DEFAULT_ORIGIN, headBar, shell, tr } from "./invasiveMapV1";
import type { Parcel, ParcelRecord } from "./parcelLookup";
import { REGION_SEASON_CSS } from "./regionSeason";
import { EXTRA_CSS } from "./regionSurfaceV1";

type Lang = "ja" | "en" | "es" | "pt-br";

export const PARCEL_LEDGER_FLAG = "PARCEL_LEDGER_ENABLED";

const esc = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

export const parcelPath = (lang: Lang, pid: string): string => `/${lang}/parcels/${encodeURIComponent(pid)}`;

export function parcelLedgerLinkHtml(lang: Lang, pid: string): string {
  return `<p class="sn-sub" data-parcel-ledger-link-wrap="1"><a class="sn-go" data-parcel-ledger-link="1" href="${esc(parcelPath(lang, pid))}">${tr(lang, "この土地の台帳", "Ledger of this land")}</a></p>`;
}

const dateText = (iso: string, lang: Lang): string => {
  const x = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!x) return "";
  return lang === "ja" ? `${x[1]}年${Number(x[2])}月${Number(x[3])}日` : `${x[1]}-${x[2]}-${x[3]}`;
};

export function renderParcelLedgerPage(options: {
  parcel: Parcel;
  records: readonly ParcelRecord[];
  lang: Lang;
  authenticated: boolean;
  displayName?: string | null;
  cspNonce?: string | null;
  origin?: string;
}): string {
  const { parcel, records } = options;
  const L = options.lang;
  const prefix = `/${L}`;
  const label = parcel.label || parcel.pid;
  const rows = records.map((r) => {
    const name = r.label ?? tr(L, "生きものの記録", "A wildlife record");
    return `<a class="sn-row" data-parcel-record="${esc(r.id)}" href="${esc(`${prefix}/observations/${encodeURIComponent(r.id)}`)}">${r.photoUrl ? `<img src="${esc(r.photoUrl)}" alt="" loading="lazy" width="56" height="56">` : `<span class="sn-ph" aria-hidden="true"></span>`}<span><div class="sn-t">${esc(name)}</div><div class="sn-d">${esc(dateText(r.observedAt, L))}</div></span></a>`;
  }).join("");
  const empty = records.length === 0
    ? `<p class="rs-foot" data-parcel-empty="1">${tr(L, "この土地で見られた記録はまだありません", "No records have been seen on this land yet.")}</p>`
    : "";
  const attribution = parcel.attribution ? `<p class="rs-foot" data-parcel-attribution="1">${esc(parcel.attribution)}</p>` : "";
  const body = `<div class="iv-col rs-col" data-parcel-ledger="${esc(parcel.pid)}">
    ${headBar(`${prefix}/`, L)}
    <h1 class="iv-title">${esc(label)}</h1>
    <p class="iv-desc">${tr(L, "この土地で見られた記録", "Records seen on this land")}</p>
    ${rows}${empty}${attribution}
  </div>`;
  const title = tr(L, `${label}の台帳`, `Ledger of ${label}`);
  return shell({
    seo: {
      title: `${title} | ZUKAN`,
      description: tr(L, `${label}で見られた、ZUKANの公開記録。`, `Public records on ZUKAN seen at ${label}.`),
      origin: options.origin ?? SEO_DEFAULT_ORIGIN,
      suffix: `/parcels/${encodeURIComponent(parcel.pid)}`,
      image: records.find((r) => r.photoUrl)?.photoUrl ?? null,
    },
    title,
    extraCss: EXTRA_CSS + REGION_SEASON_CSS,
    lang: L,
    authenticated: options.authenticated,
    displayName: options.displayName,
    pathname: parcelPath(L, parcel.pid),
    body,
    cspNonce: options.cspNonce,
  });
}
