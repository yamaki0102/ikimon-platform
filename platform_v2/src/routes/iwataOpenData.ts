import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { detectLangFromUrl } from "../i18n.js";
import {
  IWATA_DATASETS,
  IWATA_OPEN_DATA_CITY_PAGE,
  IWATA_OPEN_DATA_ITEMS,
  IWATA_OPEN_DATA_LICENSE_LABEL,
  IWATA_OPEN_DATA_RETRIEVED_AT,
  buildIwataOpenDataSummary,
  filterIwataOpenDataItems,
  iwataDatasetLabel,
  type IwataOpenDataItem,
} from "../services/iwataOpenDataSnapshot.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";

const DATASET_COLORS: Record<string, string> = {
  tourism: "#d97706",
  park: "#16856b",
  community: "#2563eb",
  cultural: "#7c3aed",
};

function requestUrl(request: { url?: string; raw?: { url?: string; originalUrl?: string } }): string {
  return String(request.raw?.originalUrl ?? request.raw?.url ?? request.url ?? "");
}

function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

function datasetBadge(dataset: string): string {
  const color = DATASET_COLORS[dataset] ?? "#475569";
  return `<span class="iwata-badge" style="--badge-color:${escapeHtml(color)}">${escapeHtml(iwataDatasetLabel(dataset as never))}</span>`;
}

function renderFallbackCard(item: IwataOpenDataItem): string {
  const locationStatus = item.latitude !== null && item.longitude !== null
    ? "地図表示あり"
    : "位置情報を確認したい";
  const detailLink = item.detailUrl
    ? `<a href="${escapeHtml(item.detailUrl)}" target="_blank" rel="noreferrer">施設情報</a>`
    : "";
  return `<article class="iwata-card" data-dataset="${escapeHtml(item.dataset)}">
    <div class="iwata-card-top">${datasetBadge(item.dataset)}<span class="iwata-quality${item.latitude === null ? " is-gap" : ""}">${escapeHtml(locationStatus)}</span></div>
    <h3>${escapeHtml(item.name)}</h3>
    <p>${escapeHtml(item.address ?? "公開データに所在地なし")}</p>
    ${item.summary ? `<p class="iwata-card-summary">${escapeHtml(item.summary)}</p>` : ""}
    <div class="iwata-card-meta"><span>出典更新 ${escapeHtml(item.sourceUpdatedAt)}</span>${detailLink}</div>
  </article>`;
}

function buildPageHtml(basePath: string, currentPath: string): string {
  const summary = buildIwataOpenDataSummary();
  const sourceCards = IWATA_DATASETS.map((dataset) => `
    <a class="iwata-source" href="${escapeHtml(dataset.sourceUrl)}" target="_blank" rel="noreferrer">
      <span class="iwata-source-dot" style="--source-color:${escapeHtml(DATASET_COLORS[dataset.key] ?? "#475569")}"></span>
      <span><strong>${escapeHtml(dataset.label)}</strong><small>${escapeHtml(dataset.description)}</small></span>
      <time>${escapeHtml(dataset.sourceUpdatedAt)}</time>
    </a>`).join("");
  const filterButtons = [
    `<button class="iwata-filter is-active" type="button" data-filter="all">すべて <span>${summary.totalCount}</span></button>`,
    ...IWATA_DATASETS.map((dataset) => `<button class="iwata-filter" type="button" data-filter="${escapeHtml(dataset.key)}">${escapeHtml(dataset.label)} <span>${summary.byDataset[dataset.key]}</span></button>`),
    `<button class="iwata-filter" type="button" data-filter="gaps">確認候補 <span>${summary.missingLocationCount}</span></button>`,
  ].join("");
  const initialCards = IWATA_OPEN_DATA_ITEMS.slice(0, 12).map(renderFallbackCard).join("");
  const dataPayload = safeJson({
    items: IWATA_OPEN_DATA_ITEMS,
    datasets: IWATA_DATASETS,
    colors: DATASET_COLORS,
  });
  const apiHref = withBasePath(basePath, "/api/iwata/open-data");

  const body = `
    <section class="iwata-intro">
      <div class="iwata-intro-copy">
        <span class="iwata-live-label"><i></i>公開データ実装</span>
        <h1>いわた地域図鑑</h1>
        <p>磐田市が公開している施設・公園・交流拠点・文化財を、ひとつの地図と一覧で見られるようにしました。</p>
        <p class="iwata-intro-note">市公式情報そのものではなく、出典を保持したZUKANの二次利用ビューです。情報の空欄や古さも隠さず、次に確かめる場所として表示します。</p>
      </div>
      <div class="iwata-stats" aria-label="取り込み状況">
        <div><strong>${summary.totalCount}</strong><span>実データ</span></div>
        <div><strong>${summary.mappedCount}</strong><span>地図表示</span></div>
        <div><strong>${summary.missingLocationCount}</strong><span>確認候補</span></div>
        <div><strong>${summary.datasetCount}</strong><span>公開データ</span></div>
      </div>
    </section>

    <section class="iwata-toolbar" aria-label="絞り込み">
      <label class="iwata-search"><span aria-hidden="true">⌕</span><input id="iwata-search" type="search" placeholder="場所・住所・種類で探す" autocomplete="off" /></label>
      <div class="iwata-filters" id="iwata-filters">${filterButtons}</div>
    </section>

    <section class="iwata-workspace">
      <div class="iwata-map-shell">
        <div id="iwata-map" class="iwata-map" role="region" aria-label="磐田市公開データ地図"></div>
        <p id="iwata-map-status" class="iwata-map-status" aria-live="polite">地図を読み込んでいます</p>
      </div>
      <aside class="iwata-gap-panel">
        <span class="iwata-panel-eyebrow">ZUKANが見つけた次の仕事</span>
        <h2>空欄も、地域の問いになる</h2>
        <p>文化財データには、名称はあるものの位置や住所を地図へ直接置けない項目があります。推測で埋めず、公式資料・現地表示・担当者確認を根拠として足していきます。</p>
        <ul>
          <li><strong>${summary.missingLocationCount}件</strong> 位置情報の確認候補</li>
          <li><strong>1件</strong> 異なるデータセット間の同一Place候補</li>
          <li><strong>更新日を保持</strong> 古さを現地確認の入口にする</li>
        </ul>
      </aside>
    </section>

    <section class="iwata-results-section">
      <div class="iwata-results-head">
        <div><span class="iwata-panel-eyebrow">Place</span><h2 id="iwata-results-title">公開データ ${summary.totalCount}件</h2></div>
        <a href="${escapeHtml(apiHref)}" target="_blank" rel="noreferrer">JSONで見る</a>
      </div>
      <div id="iwata-list" class="iwata-list">${initialCards}</div>
      <p id="iwata-empty" class="iwata-empty" hidden>条件に合う場所がありません。</p>
    </section>

    <section class="iwata-provenance">
      <div>
        <span class="iwata-panel-eyebrow">Source &amp; provenance</span>
        <h2>どこから来た情報かを消さない</h2>
        <p>取得日 ${escapeHtml(IWATA_OPEN_DATA_RETRIEVED_AT)}。${escapeHtml(IWATA_OPEN_DATA_LICENSE_LABEL)}。外部公開・再利用時は各原典の最新条件を確認してください。</p>
        <a href="${escapeHtml(IWATA_OPEN_DATA_CITY_PAGE)}" target="_blank" rel="noreferrer">磐田市オープンデータの利用条件</a>
      </div>
      <div class="iwata-source-list">${sourceCards}</div>
    </section>

    <script src="https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js"></script>
    <script id="iwata-open-data" type="application/json">${dataPayload}</script>
    <script>
      (() => {
        const payloadNode = document.getElementById("iwata-open-data");
        const listNode = document.getElementById("iwata-list");
        const emptyNode = document.getElementById("iwata-empty");
        const titleNode = document.getElementById("iwata-results-title");
        const searchNode = document.getElementById("iwata-search");
        const filterNode = document.getElementById("iwata-filters");
        const mapStatus = document.getElementById("iwata-map-status");
        if (!payloadNode || !listNode || !searchNode || !filterNode) return;

        const payload = JSON.parse(payloadNode.textContent || "{}");
        const items = Array.isArray(payload.items) ? payload.items : [];
        const datasets = Array.isArray(payload.datasets) ? payload.datasets : [];
        const colors = payload.colors || {};
        const labelByKey = Object.fromEntries(datasets.map((dataset) => [dataset.key, dataset.label]));
        let activeFilter = "all";
        let map = null;
        let markers = [];

        const escape = (value) => String(value ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");

        const filteredItems = () => {
          const query = String(searchNode.value || "").trim().toLocaleLowerCase("ja-JP");
          return items.filter((item) => {
            if (activeFilter === "gaps" && item.latitude !== null && item.longitude !== null) return false;
            if (activeFilter !== "all" && activeFilter !== "gaps" && item.dataset !== activeFilter) return false;
            if (!query) return true;
            return [item.name, item.address, item.summary, labelByKey[item.dataset]]
              .filter(Boolean).join(" ").toLocaleLowerCase("ja-JP").includes(query);
          });
        };

        const renderCard = (item) => {
          const mapped = item.latitude !== null && item.longitude !== null;
          const detail = item.detailUrl
            ? '<a href="' + escape(item.detailUrl) + '" target="_blank" rel="noreferrer">施設情報</a>'
            : "";
          const source = '<a href="' + escape(item.sourceUrl) + '" target="_blank" rel="noreferrer">原典</a>';
          return '<article class="iwata-card" data-dataset="' + escape(item.dataset) + '">' +
            '<div class="iwata-card-top"><span class="iwata-badge" style="--badge-color:' + escape(colors[item.dataset] || "#475569") + '">' + escape(labelByKey[item.dataset] || item.dataset) + '</span>' +
            '<span class="iwata-quality' + (mapped ? "" : " is-gap") + '">' + (mapped ? "地図表示あり" : "位置情報を確認したい") + '</span></div>' +
            '<h3>' + escape(item.name) + '</h3>' +
            '<p>' + escape(item.address || "公開データに所在地なし") + '</p>' +
            (item.summary ? '<p class="iwata-card-summary">' + escape(item.summary) + '</p>' : "") +
            '<div class="iwata-card-meta"><span>出典更新 ' + escape(item.sourceUpdatedAt) + '</span><span>' + detail + source + '</span></div>' +
            '</article>';
        };

        const clearMarkers = () => {
          markers.forEach((marker) => marker.remove());
          markers = [];
        };

        const updateMarkers = (visible) => {
          if (!map || !window.maplibregl) return;
          clearMarkers();
          visible.filter((item) => item.latitude !== null && item.longitude !== null).forEach((item) => {
            const element = document.createElement("button");
            element.type = "button";
            element.className = "iwata-marker";
            element.style.setProperty("--marker-color", colors[item.dataset] || "#475569");
            element.setAttribute("aria-label", item.name);
            const popup = new window.maplibregl.Popup({ offset: 18, maxWidth: "280px" }).setHTML(
              '<div class="iwata-popup"><b>' + escape(item.name) + '</b><span>' + escape(labelByKey[item.dataset] || item.dataset) + '</span><p>' + escape(item.address || "所在地なし") + '</p><small>出典更新 ' + escape(item.sourceUpdatedAt) + '</small></div>'
            );
            const marker = new window.maplibregl.Marker({ element })
              .setLngLat([item.longitude, item.latitude])
              .setPopup(popup)
              .addTo(map);
            markers.push(marker);
          });
        };

        const render = () => {
          const visible = filteredItems();
          listNode.innerHTML = visible.map(renderCard).join("");
          emptyNode.hidden = visible.length !== 0;
          titleNode.textContent = "公開データ " + visible.length + "件";
          updateMarkers(visible);
        };

        filterNode.addEventListener("click", (event) => {
          const button = event.target.closest("button[data-filter]");
          if (!button) return;
          activeFilter = button.dataset.filter || "all";
          filterNode.querySelectorAll("button[data-filter]").forEach((candidate) => candidate.classList.toggle("is-active", candidate === button));
          render();
        });
        searchNode.addEventListener("input", render);

        if (!window.maplibregl) {
          mapStatus.textContent = "地図を読み込めませんでした。一覧は利用できます。";
          render();
          return;
        }
        try {
          map = new window.maplibregl.Map({
            container: "iwata-map",
            style: "https://tiles.openfreemap.org/styles/liberty",
            center: [137.856, 34.722],
            zoom: 10.7,
            attributionControl: true,
          });
          map.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), "top-right");
          map.on("load", () => {
            mapStatus.textContent = "地図上の点を押すと出典情報を確認できます";
            render();
          });
          map.on("error", () => {
            mapStatus.textContent = "地図の一部を読み込めませんでした。一覧は利用できます。";
          });
        } catch {
          mapStatus.textContent = "地図を読み込めませんでした。一覧は利用できます。";
          render();
        }
      })();
    </script>`;

  return renderSiteDocument({
    basePath,
    title: "いわた地域図鑑 | ZUKAN",
    description: "磐田市の公開オープンデータを、出典と確認状態付きで探索できるZUKANの地域ビュー。",
    body,
    lang: "ja",
    currentPath,
    canonicalPath: "/iwata",
    extraStyles: IWATA_OPEN_DATA_STYLES,
    activeNav: "map",
  });
}

export async function registerIwataOpenDataRoutes(app: FastifyInstance): Promise<void> {
  app.get("/iwata", async (request, reply) => {
    const basePath = getForwardedBasePath(request.headers as Record<string, unknown>);
    const lang = detectLangFromUrl(requestUrl(request));
    if (lang !== "ja") {
      reply.header("Content-Language", "ja");
    }
    reply
      .type("text/html; charset=utf-8")
      .header("Cache-Control", "public, max-age=120, stale-while-revalidate=600");
    return buildPageHtml(basePath, requestUrl(request));
  });

  app.get<{ Querystring: { dataset?: string; q?: string; limit?: string } }>("/api/iwata/open-data", async (request, reply) => {
    const parsedLimit = Number.parseInt(String(request.query?.limit ?? "200"), 10);
    const items = filterIwataOpenDataItems({
      dataset: request.query?.dataset,
      query: request.query?.q,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : 200,
    });
    reply
      .type("application/json; charset=utf-8")
      .header("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    return {
      schema: "zukan.iwata-open-data/v1",
      retrievedAt: IWATA_OPEN_DATA_RETRIEVED_AT,
      cityOpenDataPage: IWATA_OPEN_DATA_CITY_PAGE,
      license: IWATA_OPEN_DATA_LICENSE_LABEL,
      datasets: IWATA_DATASETS,
      summary: buildIwataOpenDataSummary(),
      resultCount: items.length,
      items,
    };
  });
}

const IWATA_OPEN_DATA_STYLES = `
@import url('https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.css');
.iwata-intro{margin:0 auto;padding:clamp(28px,6vw,76px) clamp(18px,5vw,72px) 28px;max-width:1440px;display:grid;grid-template-columns:minmax(0,1.25fr) minmax(300px,.75fr);gap:32px;align-items:end}
.iwata-live-label{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:900;letter-spacing:.08em;color:#176b55;text-transform:uppercase}.iwata-live-label i{width:9px;height:9px;border-radius:999px;background:#2ec98a;box-shadow:0 0 0 6px rgba(46,201,138,.14)}
.iwata-intro h1{font-size:clamp(42px,7vw,88px);letter-spacing:-.06em;line-height:.98;margin:18px 0 20px;color:#10231c}.iwata-intro-copy>p{font-size:clamp(17px,2vw,25px);line-height:1.65;max-width:820px;color:#233b32}.iwata-intro .iwata-intro-note{font-size:13px;line-height:1.8;color:#64736c;max-width:720px}
.iwata-stats{display:grid;grid-template-columns:1fr 1fr;border:1px solid #d7ded9;border-radius:24px;overflow:hidden;background:#fff;box-shadow:0 20px 60px rgba(24,52,42,.08)}.iwata-stats div{padding:22px;border-right:1px solid #e2e8e4;border-bottom:1px solid #e2e8e4}.iwata-stats div:nth-child(2n){border-right:0}.iwata-stats div:nth-child(n+3){border-bottom:0}.iwata-stats strong{display:block;font-size:36px;line-height:1;color:#10231c}.iwata-stats span{display:block;margin-top:8px;font-size:12px;font-weight:800;color:#65736d}
.iwata-toolbar{position:sticky;top:56px;z-index:30;margin:0 auto;padding:14px clamp(18px,5vw,72px);max-width:1440px;display:flex;gap:14px;align-items:center;background:rgba(247,249,247,.94);backdrop-filter:blur(18px);border-top:1px solid #dfe5e1;border-bottom:1px solid #dfe5e1}.iwata-search{min-width:260px;flex:1;display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #cfd9d3;border-radius:14px;padding:0 14px}.iwata-search input{width:100%;min-height:48px;border:0;outline:0;background:transparent;font-size:15px}.iwata-filters{display:flex;gap:8px;overflow:auto;padding-bottom:2px}.iwata-filter{white-space:nowrap;border:1px solid #cfd9d3;background:#fff;color:#34483f;border-radius:999px;min-height:42px;padding:0 13px;font-size:12px;font-weight:800}.iwata-filter span{opacity:.65}.iwata-filter.is-active{background:#10231c;color:#fff;border-color:#10231c}
.iwata-workspace{max-width:1440px;margin:0 auto;padding:24px clamp(18px,5vw,72px);display:grid;grid-template-columns:minmax(0,1.5fr) minmax(280px,.5fr);gap:20px}.iwata-map-shell{position:relative;min-height:560px;border:1px solid #d3ddd7;border-radius:24px;overflow:hidden;background:#dfe7e2}.iwata-map{position:absolute;inset:0}.iwata-map-status{position:absolute;z-index:3;left:16px;bottom:14px;margin:0;padding:8px 12px;border-radius:10px;background:rgba(16,35,28,.88);color:#fff;font-size:11px;pointer-events:none}.iwata-gap-panel{border-radius:24px;background:#10231c;color:#effaf4;padding:28px;align-self:stretch}.iwata-panel-eyebrow{font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#66d5ad}.iwata-gap-panel h2,.iwata-provenance h2,.iwata-results-head h2{font-size:clamp(25px,3vw,40px);letter-spacing:-.04em;line-height:1.15;margin:12px 0}.iwata-gap-panel p{color:#c9d8d1;line-height:1.8;font-size:14px}.iwata-gap-panel ul{padding:0;margin:28px 0 0;list-style:none;display:grid;gap:12px}.iwata-gap-panel li{border-top:1px solid rgba(255,255,255,.13);padding-top:12px;font-size:13px;color:#d8e6df}.iwata-gap-panel strong{font-size:21px;color:#d7f57a;margin-right:6px}
.iwata-results-section{max-width:1440px;margin:0 auto;padding:34px clamp(18px,5vw,72px) 72px}.iwata-results-head{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:18px}.iwata-results-head h2{margin-bottom:0}.iwata-results-head>a,.iwata-provenance>div>a{font-size:13px;font-weight:900;color:#176b55;text-decoration:underline;text-underline-offset:4px}.iwata-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.iwata-card{display:flex;flex-direction:column;min-height:230px;padding:20px;border:1px solid #d7ded9;border-radius:18px;background:#fff;box-shadow:0 8px 30px rgba(24,52,42,.045)}.iwata-card-top{display:flex;justify-content:space-between;gap:8px;align-items:center}.iwata-badge{display:inline-flex;align-items:center;min-height:26px;padding:0 9px;border-radius:999px;background:color-mix(in srgb,var(--badge-color) 14%,white);color:var(--badge-color);font-size:10px;font-weight:900}.iwata-quality{font-size:10px;font-weight:800;color:#35715c}.iwata-quality.is-gap{color:#a84d16}.iwata-card h3{font-size:21px;line-height:1.35;letter-spacing:-.025em;margin:18px 0 8px;color:#10231c}.iwata-card>p{font-size:13px;color:#56675f;margin:0;line-height:1.7}.iwata-card .iwata-card-summary{font-size:12px;margin-top:10px;color:#718078}.iwata-card-meta{display:flex;justify-content:space-between;gap:10px;align-items:end;margin-top:auto;padding-top:16px;font-size:10px;color:#79857f}.iwata-card-meta>span:last-child{display:flex;gap:10px}.iwata-card-meta a{color:#176b55;font-weight:900}.iwata-empty{padding:60px;text-align:center;color:#64736c;background:#fff;border-radius:18px;border:1px dashed #c9d4ce}
.iwata-provenance{max-width:1296px;margin:0 auto 72px;padding:34px;border-radius:24px;background:#eef3ef;display:grid;grid-template-columns:minmax(0,.7fr) minmax(0,1.3fr);gap:36px}.iwata-provenance p{font-size:13px;color:#5f7068;line-height:1.8}.iwata-source-list{display:grid;gap:8px}.iwata-source{display:grid;grid-template-columns:12px 1fr auto;gap:12px;align-items:center;padding:12px;border-radius:13px;background:#fff;border:1px solid #d8e0db;color:#20362d;text-decoration:none}.iwata-source-dot{width:10px;height:10px;border-radius:999px;background:var(--source-color)}.iwata-source strong,.iwata-source small{display:block}.iwata-source small{font-size:10px;color:#718078;margin-top:2px}.iwata-source time{font-size:10px;color:#68776f}
.iwata-marker{width:18px;height:18px;border-radius:999px;border:3px solid #fff;background:var(--marker-color);box-shadow:0 3px 10px rgba(0,0,0,.35);cursor:pointer}.iwata-marker:hover{transform:scale(1.25)}.iwata-popup{font-family:system-ui,-apple-system,sans-serif;color:#10231c}.iwata-popup b,.iwata-popup span{display:block}.iwata-popup b{font-size:14px}.iwata-popup span{font-size:10px;font-weight:800;color:#176b55;margin-top:2px}.iwata-popup p{font-size:11px;margin:8px 0}.iwata-popup small{color:#68776f}
@media(max-width:960px){.iwata-intro,.iwata-workspace,.iwata-provenance{grid-template-columns:1fr}.iwata-toolbar{align-items:stretch;flex-direction:column;top:54px}.iwata-search{min-width:0}.iwata-map-shell{min-height:480px}.iwata-list{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:640px){.iwata-intro{padding-top:34px}.iwata-stats div{padding:16px}.iwata-stats strong{font-size:30px}.iwata-workspace{padding-top:14px}.iwata-map-shell{min-height:440px;border-radius:18px}.iwata-gap-panel{border-radius:18px;padding:22px}.iwata-list{grid-template-columns:1fr}.iwata-card{min-height:210px}.iwata-provenance{margin-left:14px;margin-right:14px;padding:22px}.iwata-source{grid-template-columns:12px 1fr}.iwata-source time{grid-column:2}.iwata-results-section{padding-bottom:48px}}
`;
