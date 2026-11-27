import type { PlaceAtlasProfile } from "../../src/services/placeAtlasContract";
import { isWeakTaxonLabel } from "./taxonNameResolver";
import { sizedImgAttrs } from "./derivedImageUrl";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";
import { ZUKAN_SUBPAGE_CSS } from "./zukanSubpageUi";

export const FIELD_CARD_FLAG = "FIELD_CARD_ENABLED";

export type FieldCardGroup = "insect" | "plant" | "bird" | "generic";

export type FieldCardRecord = {
  observationId: string;
  name: string;
  observedAt: string | null;
  mediaUrl: string;
  group: FieldCardGroup;
};

const esc = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

const QUESTION: Record<FieldCardGroup, string> = {
  insect: "足は何本見える？もようはある？",
  plant: "葉っぱはどんな形？ふちはギザギザ？",
  bird: "くちばしは長い？短い？どんな色？",
  generic: "どんな色やもようが見える？",
};

const PROMPT: Record<FieldCardGroup, string> = {
  insect: "見つけたら、足やもようを指さしてもらおう",
  plant: "同じ形の葉っぱを探してもらおう",
  bird: "鳴き声が聞こえたら、まねしてもらおう",
  generic: "気づいたところを指さしてもらおう",
};

const CSS = `${ZUKAN_SUBPAGE_CSS}
.fc{max-width:720px}
.fc h1{margin:0;font-size:1.5rem;line-height:1.4}
.fc-cards{display:grid;gap:16px}
.fc-card{display:grid;gap:10px;padding:12px;border:1px solid #dde2dc;border-radius:16px;background:#fff;break-inside:avoid;page-break-inside:avoid}
.fc-photo{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px;background:#eef1ed}
.fc-name{margin:0;font-size:1.25rem;line-height:1.4;font-weight:800;overflow-wrap:anywhere}
.fc-month{margin:0;color:#55615a;font-size:.9375rem}
.fc-q,.fc-a{margin:0;font-size:1.0625rem;line-height:1.7}
.fc-q b,.fc-a b{display:block;color:#143F2E;font-size:.9375rem}
.fc-safe{padding:16px;border:2px solid #143F2E;border-radius:16px;background:#f7f7f3;break-inside:avoid}
.fc-safe h2{margin:0 0 8px;font-size:1.125rem}
.fc-safe ul{margin:0;padding-left:1.2em;line-height:1.9;font-size:1.0625rem}
.fc-src{margin:0;font-size:.875rem;color:#55615a}
.fc-print{min-height:44px;padding:10px 18px;border:1.5px solid #143F2E;border-radius:12px;background:#fff;color:#143F2E;font:inherit;font-weight:700;cursor:pointer}
@media print{header,nav,footer,.fc-print,.fc-actions{display:none!important}.fc-cards{gap:8px}.fc-card{padding:8px;gap:6px}.fc-photo{aspect-ratio:auto;height:6.2cm}.fc-name{font-size:1.05rem}.fc-q,.fc-a{font-size:.95rem;line-height:1.5}.fc-safe{padding:10px}.fc-safe ul{line-height:1.6}}
`;

function monthLabelJst(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "記録";
  const month = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", month: "numeric" }).formatToParts(new Date(value)).find((p) => p.type === "month")?.value;
  return month ? `${Number(month)}月の記録` : "記録";
}

const isNamed = (name: string): boolean => name.length > 0 && !isWeakTaxonLabel(name);

export function pickFieldCardRecords(rows: FieldCardRecord[], limit = 3): FieldCardRecord[] {
  const seen = new Set<string>();
  const distinct = rows.filter((r) => {
    if (!r.mediaUrl || seen.has(r.mediaUrl)) return false;
    seen.add(r.mediaUrl);
    return true;
  });
  const time = (r: FieldCardRecord): number => (r.observedAt ? Date.parse(r.observedAt) || 0 : 0);
  return distinct
    .map((r, i) => ({ r, i }))
    .sort((a, b) => Number(isNamed(b.r.name)) - Number(isNamed(a.r.name)) || time(b.r) - time(a.r) || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.r);
}

const GROUPS: Record<string, FieldCardGroup> = { insect: "insect", plant: "plant", bird: "bird" };

export function fieldCardRecordsFromProfile(profile: PlaceAtlasProfile): FieldCardRecord[] {
  return (profile.recentRecords ?? [])
    .filter((r) => r && r.recordId && r.mediaUrl && r.mediaKind !== "audio")
    .map((r) => ({
      observationId: r.recordId,
      name: (r.displayName ?? "").trim(),
      observedAt: r.observedAt,
      mediaUrl: r.mediaUrl as string,
      group: GROUPS[(r.taxonGroup ?? "").trim().toLowerCase()] ?? "generic",
    }));
}

export function renderFieldCardPage(options: {
  placeId: string;
  placeName: string;
  records: FieldCardRecord[];
  authenticated: boolean;
  displayName?: string | null;
}): string {
  const encodedPlace = encodeURIComponent(options.placeId);
  const placeHref = `/ja/places/${encodedPlace}`;
  const cards = options.records.map((r) => {
    const named = isNamed(r.name);
    return `<article class="fc-card" data-fc-card><img class="fc-photo" ${sizedImgAttrs(r.mediaUrl, 680, [360, 680, 1020], "(max-width: 720px) 100vw, 680px", esc)} alt="${named ? esc(r.name) : ""}" loading="lazy" decoding="async">${named ? `<h2 class="fc-name">${esc(r.name)}</h2>` : ""}<p class="fc-month">${esc(monthLabelJst(r.observedAt))}</p><p class="fc-q"><b>こどもに</b>${esc(QUESTION[r.group])}</p><p class="fc-a"><b>おとなから</b>${esc(PROMPT[r.group])}</p></article>`;
  });
  const body = cards.length > 0
    ? `<div class="fc-cards">${cards.join("")}</div>`
    : `<p class="zt-sp-empty" data-fc-empty>この場所の写真の記録がまだありません</p><a class="zt-sp-primary" href="${esc(`/ja/record?placeId=${encodedPlace}`)}">この場所で記録する</a>`;
  const bodyHtml = `<section class="zt-sp fc" data-field-card>
<style>${CSS}</style>
<h1>出発前カード</h1>
<p class="zt-sp-lead">${esc(options.placeName)}で見つかった生きもの</p>
${body}
<section class="fc-safe" data-fc-safety><h2>やくそく</h2><ul><li>生きものは見るだけ。持ち帰らない</li><li>さわる前に、おとなに聞く</li><li>水辺や道路では、おとなと一緒に</li></ul></section>
<p class="fc-src">ZUKANの公開記録から作りました ・ <a href="${esc(placeHref)}">${esc(options.placeName)}のページ</a></p>
<div class="fc-actions"><button type="button" class="fc-print" data-fc-print>印刷する</button></div>
<script>document.querySelector('[data-fc-print]').addEventListener('click',function(){window.print()});</script>
</section>`;
  return renderZukanCommonShell({
    lang: "ja",
    title: `出発前カード — ${options.placeName}`,
    activeNav: "places",
    authenticated: options.authenticated,
    displayName: options.displayName ?? null,
    bodyHtml,
    pathname: `/ja/places/${encodedPlace}/card`,
  });
}

export function fieldCardResponse(
  profile: PlaceAtlasProfile,
  session: { userId: string; displayName?: string | null; banned?: boolean } | null
): Response {
  const names = (profile.place as { multilingualNames?: Record<string, string> }).multilingualNames ?? {};
  const placeName = (names.ja ?? "").trim() || (profile.place.name ?? "").trim();
  const records = pickFieldCardRecords(fieldCardRecordsFromProfile(profile));
  const authenticated = Boolean(session && !session.banned);
  return new Response(
    renderFieldCardPage({ placeId: (profile.place as { canonicalPlaceId?: string | null }).canonicalPlaceId ?? "", placeName, records, authenticated, displayName: session?.displayName ?? null }),
    {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": authenticated ? "private, no-store" : "public, max-age=60, stale-while-revalidate=300",
      },
    }
  );
}
