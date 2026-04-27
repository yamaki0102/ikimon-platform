import type { ObservationField, PrefectureBucket } from "../services/observationFieldRegistry.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const SOURCE_LABEL: Record<string, string> = {
  user_defined: "マイ",
  nature_symbiosis_site: "自然共生サイト",
  tsunag: "TSUNAG",
  protected_area: "保護区",
  oecm: "OECM",
};

const SOURCE_BADGE: Record<string, string> = {
  user_defined: "evt-mode-discovery",
  nature_symbiosis_site: "evt-mode-effort",
  tsunag: "evt-mode-quest",
  protected_area: "evt-mode-absence",
  oecm: "evt-mode-bingo",
};

export interface RenderFieldListArgs {
  fields: ObservationField[];
  prefectures: PrefectureBucket[];
  filter: { prefecture?: string; source?: string; query?: string };
  totalCount?: number;
}

export function renderFieldListBody(args: RenderFieldListArgs): string {
  const { fields, prefectures, filter } = args;

  const prefHref = (pref: string | null): string =>
    pref ? `/community/fields?prefecture=${encodeURIComponent(pref)}` : "/community/fields";

  const prefChips = prefectures.slice(0, 24).map((p) => {
    const isActive = filter.prefecture === p.prefecture;
    return `<a href="${escapeHtml(prefHref(p.prefecture))}"
              class="evt-mode-pill${isActive ? " is-active" : ""}"
              style="text-decoration:none;">
              ${escapeHtml(p.prefecture)}<span class="evt-eyebrow" style="margin-left:6px;">${p.total}</span>
            </a>`;
  }).join("");

  const sources: Array<{ key: string; label: string }> = [
    { key: "any", label: "すべて" },
    { key: "nature_symbiosis_site", label: "自然共生サイト" },
    { key: "tsunag", label: "TSUNAG" },
    { key: "user_defined", label: "マイ" },
  ];
  const sourceChips = sources.map((s) => {
    const cur = filter.source ?? "any";
    const isActive = cur === s.key;
    const params = new URLSearchParams();
    if (filter.prefecture) params.set("prefecture", filter.prefecture);
    if (s.key !== "any") params.set("source", s.key);
    const href = `/community/fields${params.toString() ? `?${params.toString()}` : ""}`;
    return `<a href="${escapeHtml(href)}" class="evt-mode-pill${isActive ? " is-active" : ""}" style="text-decoration:none;">
      ${escapeHtml(s.label)}
    </a>`;
  }).join("");

  const cards = fields.length === 0
    ? `<p class="evt-lead">条件に合うフィールドはまだありません。</p>`
    : fields.map((f) => {
        const badgeCls = SOURCE_BADGE[f.source] ?? "evt-mode-discovery";
        const sourceLabel = SOURCE_LABEL[f.source] ?? f.source;
        return `<article class="evt-card" style="display:grid; gap:6px;">
          <header style="display:flex; gap:6px; align-items:center; justify-content:space-between;">
            <span class="evt-badge ${badgeCls}">${escapeHtml(sourceLabel)}</span>
            <span class="evt-eyebrow">${f.areaHa ? `${f.areaHa.toFixed(1)} ha` : `${f.radiusM} m`}</span>
          </header>
          <h3 class="evt-heading" style="margin:0; font-size:17px;">${escapeHtml(f.name)}</h3>
          <p class="evt-lead" style="font-size:13px;">${escapeHtml([f.prefecture, f.city].filter(Boolean).join(" / "))}</p>
          ${f.summary ? `<p class="evt-lead" style="font-size:12px;">${escapeHtml(f.summary)}</p>` : ""}
          <div style="display:flex; gap:6px;">
            <a class="evt-btn evt-btn-ghost" href="/community/fields/${escapeHtml(f.fieldId)}" style="flex:1; min-height:36px; padding:6px 10px;">詳細</a>
            <a class="evt-btn evt-btn-primary" href="/community/events/new?field_id=${encodeURIComponent(f.fieldId)}" style="flex:1; min-height:36px; padding:6px 10px;" title="このフィールドで観察会を作る">観察会</a>
          </div>
        </article>`;
      }).join("");

  return `
<section class="evt-recap-shell">
  <article class="evt-hero">
    <span class="evt-hero-eyebrow">フィールド DB</span>
    <h1>「いつもの場所」を、観察会のひな型として残す。</h1>
    <p>環境省「自然共生サイト」、国交省 TSUNAG、自分で登録した観察フィールド。すべてここから検索して、次の観察会を 1 タップで開ける。</p>
  </article>

  <section style="display:grid; gap:8px;">
    <span class="evt-eyebrow">都道府県で絞り込み</span>
    <div style="display:flex; flex-wrap:wrap; gap:6px;">
      <a href="/community/fields" class="evt-mode-pill${filter.prefecture ? "" : " is-active"}" style="text-decoration:none;">全国</a>
      ${prefChips}
    </div>
  </section>

  <section style="display:grid; gap:8px;">
    <span class="evt-eyebrow">種別</span>
    <div style="display:flex; flex-wrap:wrap; gap:6px;">${sourceChips}</div>
  </section>

  <form action="/community/fields" method="get" style="display:flex; gap:8px;">
    ${filter.source ? `<input type="hidden" name="source" value="${escapeHtml(filter.source)}" />` : ""}
    ${filter.prefecture ? `<input type="hidden" name="prefecture" value="${escapeHtml(filter.prefecture)}" />` : ""}
    <input type="search" name="q" value="${escapeHtml(filter.query ?? "")}"
           placeholder="名前・市町村・都道府県で検索"
           style="flex:1; min-height:48px; padding:10px 14px; border-radius:14px; border:1px solid var(--evt-line);" />
    <button type="submit" class="evt-btn evt-btn-primary">検索</button>
  </form>

  <section>
    <header style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
      <h2 class="evt-heading" style="margin:0;">${escapeHtml(filter.prefecture ?? "全国")}のフィールド</h2>
      <span class="evt-eyebrow">${fields.length} 件</span>
    </header>
    <div class="evt-stagger" style="display:grid; gap:12px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));">
      ${cards}
    </div>
  </section>
</section>
`;
}
