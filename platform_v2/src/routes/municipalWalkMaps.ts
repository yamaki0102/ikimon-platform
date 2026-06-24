import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "../i18n.js";
import {
  buildMunicipalWalkMapPublicReadModelV0,
  getStaticMunicipalWalkMapConfigV0,
  listStaticMunicipalWalkMapPublicSummariesV0,
  type MunicipalWalkMapMobilityModeV0,
  type MunicipalWalkMapPublicReadModelV0,
  type MunicipalWalkMapPublicSummaryV0,
  type MunicipalWalkMapThemeV0,
} from "../services/municipalWalkMap.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

function requestUrl(request: { url?: string; raw?: { url?: string } }): string {
  return String(request.raw?.url ?? request.url ?? "");
}

const WALK_MAP_STYLES = `
.wm-shell{max-width:1120px;margin:0 auto;padding:28px 18px 72px;color:#17211d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.wm-hero{display:grid;gap:12px;margin:8px 0 18px}
.wm-eyebrow{margin:0;color:#0f766e;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:0}
.wm-hero h1{margin:0;font-size:clamp(28px,4vw,44px);line-height:1.12;letter-spacing:0}
.wm-lead{margin:0;color:#46554f;font-size:16px;line-height:1.75;max-width:780px}
.wm-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.wm-meta span{padding:6px 10px;border-radius:999px;background:#ecfdf5;color:#0f766e;font-size:12px;font-weight:850}
.wm-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-top:16px}
.wm-card{border:1px solid #dbe7e2;border-radius:8px;background:#fff;padding:14px;display:grid;gap:10px;text-decoration:none;color:inherit;min-height:190px}
.wm-card:hover{border-color:#0f766e;box-shadow:0 14px 34px rgba(15,118,110,.12)}
.wm-card h2{margin:0;font-size:18px;line-height:1.35;color:#0f172a}
.wm-card p{margin:0;color:#475569;font-size:13px;line-height:1.7}
.wm-card-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:auto}
.wm-card-foot strong{color:#0f766e;font-size:13px;white-space:nowrap}
.wm-muted{color:#64748b;font-size:12px;font-weight:800}
.wm-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.45fr);gap:18px;align-items:start}
.wm-stops{display:grid;gap:12px}
.wm-stop{border:1px solid #dbe7e2;border-radius:8px;background:#fff;padding:14px;display:grid;gap:10px}
.wm-stop-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.wm-stop h2{margin:0;font-size:18px;line-height:1.3}
.wm-access{white-space:nowrap;font-size:11px;font-weight:900;padding:5px 8px;border-radius:999px;background:#eef6ff;color:#0369a1}
.wm-access.is-check_permission{background:#fff7ed;color:#9a3412}
.wm-access.is-not_for_route{background:#f1f5f9;color:#475569}
.wm-cues{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.wm-cue{border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:10px}
.wm-cue strong{display:block;color:#0f172a;font-size:12px;margin-bottom:6px}
.wm-cue ul{margin:0;padding-left:18px;color:#475569;font-size:12px;line-height:1.7}
.wm-panel{border:1px solid #dbe7e2;border-radius:8px;background:#fff;padding:14px;display:grid;gap:12px}
.wm-panel h2{margin:0;font-size:17px}
.wm-panel ul{margin:0;padding-left:18px;color:#475569;font-size:12px;line-height:1.75}
.wm-flex{border:1px solid #dbe7e2;border-radius:8px;background:#f8fafc;padding:12px;display:grid;gap:8px}
.wm-flex strong{font-size:13px;color:#0f172a}
.wm-flex p{margin:0;color:#475569;font-size:12px;line-height:1.7}
.wm-flex ul{margin:0;padding-left:18px;color:#475569;font-size:12px;line-height:1.7}
.wm-sources{display:grid;gap:8px}
.wm-sources li{display:grid;gap:3px}
.wm-sources a{color:#0f766e;font-weight:900;text-decoration:none}
.wm-sources small{color:#64748b;line-height:1.6}
.wm-record{display:inline-flex;align-items:center;justify-content:center;min-height:38px;border-radius:7px;background:#0f766e;color:#fff;text-decoration:none;font-weight:900;padding:0 12px;font-size:13px;justify-self:start}
@media(max-width:760px){.wm-grid,.wm-cues{grid-template-columns:1fr}.wm-shell{padding-top:18px;padding-bottom:132px}.wm-stop-head{display:grid}.wm-access{justify-self:start}}
`;

function themeText(theme: MunicipalWalkMapThemeV0, lang: SiteLang): string {
  const ja: Record<MunicipalWalkMapThemeV0, string> = {
    seasonal_walk: "季節の散策",
    waterfront: "水辺",
    park_walk: "公園・緑地",
    satoyama: "里山",
    city_nature: "まちなか自然",
  };
  const en: Record<MunicipalWalkMapThemeV0, string> = {
    seasonal_walk: "Seasonal walk",
    waterfront: "Waterfront",
    park_walk: "Park walk",
    satoyama: "Satoyama",
    city_nature: "Urban nature",
  };
  return lang === "en" ? en[theme] : ja[theme];
}

function mobilityText(mode: MunicipalWalkMapMobilityModeV0, lang: SiteLang): string {
  const ja: Record<MunicipalWalkMapMobilityModeV0, string> = {
    walk: "徒歩",
    bike: "自転車",
    car: "車",
    motorbike: "バイク",
    public_transport: "公共交通",
  };
  const en: Record<MunicipalWalkMapMobilityModeV0, string> = {
    walk: "Walk",
    bike: "Bike",
    car: "Car",
    motorbike: "Motorbike",
    public_transport: "Public transport",
  };
  return lang === "en" ? en[mode] : ja[mode];
}

function routeStyleText(style: MunicipalWalkMapPublicSummaryV0["routeStyle"], lang: SiteLang): string {
  if (style === "free_area") return lang === "en" ? "Public area" : "公開範囲";
  return lang === "en" ? "Walk cues" : "散策の手がかり";
}

function offRouteText(policy: MunicipalWalkMapPublicReadModelV0["routeFlexibility"]["offRoutePolicy"], lang: SiteLang): string {
  if (policy === "stay_near_public_path") return lang === "en" ? "Stay near public paths" : "公開された道の近くで";
  if (policy === "guide_only") return lang === "en" ? "Use as a guide" : "案内として使う";
  return lang === "en" ? "Use public areas" : "公開範囲で使う";
}

function areaKindText(areaKind: MunicipalWalkMapPublicReadModelV0["stops"][number]["areaKind"], lang: SiteLang): string {
  const ja: Record<string, string> = {
    park: "公園・緑地",
    waterfront: "水辺",
    satoyama: "里山",
    street_edge: "道沿い",
    other: "その他",
  };
  const en: Record<string, string> = {
    park: "Park",
    waterfront: "Waterfront",
    satoyama: "Satoyama",
    street_edge: "Street edge",
    other: "Other",
  };
  return lang === "en" ? en[areaKind] ?? areaKind : ja[areaKind] ?? areaKind;
}

function accessText(label: MunicipalWalkMapPublicReadModelV0["stops"][number]["accessLabel"], lang: SiteLang): string {
  if (label === "public_scope") return lang === "en" ? "Public scope" : "公開範囲";
  if (label === "check_permission") return lang === "en" ? "Check permission" : "許可確認";
  return lang === "en" ? "No record link" : "立入誘導なし";
}

function renderIndexBody(summaries: MunicipalWalkMapPublicSummaryV0[], basePath: string, lang: SiteLang): string {
  const cards = summaries.map((summary) => {
    const href = appendLangToHref(withBasePath(basePath, `/walk-maps/${encodeURIComponent(summary.walkMapId)}`), lang);
    const mobilityModes = summary.mobilityModes.map((mode) => mobilityText(mode, lang)).join(" / ");
    return `<a class="wm-card" href="${escapeHtml(href)}">
      <div class="wm-meta">
        <span>${escapeHtml(summary.municipality)}</span>
        <span>${escapeHtml(themeText(summary.theme, lang))}</span>
        <span>${escapeHtml(routeStyleText(summary.routeStyle, lang))}</span>
      </div>
      <h2>${escapeHtml(summary.title)}</h2>
      <p>${escapeHtml(summary.summary)}</p>
      <div class="wm-card-foot">
        <span class="wm-muted">${escapeHtml(lang === "en" ? `${summary.stopCount} stops / ${mobilityModes}` : `${summary.stopCount}か所 / ${mobilityModes}`)}</span>
        <strong>${escapeHtml(lang === "en" ? "Open" : "開く")}</strong>
      </div>
      <span class="wm-muted">${escapeHtml(lang === "en" ? `${summary.sourceReferences.length} source links` : `引用元 ${summary.sourceReferences.length}件`)}</span>
    </a>`;
  }).join("");
  return `<main class="wm-shell">
    <section class="wm-hero">
      <p class="wm-eyebrow">${escapeHtml(lang === "en" ? "Walk cues" : "散策の手がかり")}</p>
      <h1>${escapeHtml(lang === "en" ? "Public walk map samples" : "公開範囲で使う散策サンプル")}</h1>
      <p class="wm-lead">${escapeHtml(lang === "en"
        ? "Route materials from local governments are reorganized into public stops, source links, and recording entry points."
        : "自治体の散策資料を、公開範囲、出典リンク、記録の入口に分けて表示します。")}</p>
      <div class="wm-meta">
        <span>${escapeHtml(lang === "en" ? `${summaries.length} samples` : `${summaries.length}件`)}</span>
        <span>${escapeHtml(lang === "en" ? "Source links visible" : "出典リンク表示")}</span>
      </div>
    </section>
    <section class="wm-list" aria-label="${escapeHtml(lang === "en" ? "Walk map samples" : "散策サンプル一覧")}">${cards}</section>
  </main>`;
}

function renderDetailBody(publicMap: MunicipalWalkMapPublicReadModelV0, basePath: string, lang: SiteLang): string {
  const stops = publicMap.stops.map((stop) => {
    const cueList = (items: string[]) => items.length ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : `<li>${escapeHtml(lang === "en" ? "Unset" : "未設定")}</li>`;
    const recordHref = stop.recordHref ? appendLangToHref(withBasePath(basePath, stop.recordHref), lang) : "";
    return `<article class="wm-stop">
      <div class="wm-stop-head">
        <h2>${escapeHtml(stop.title)}</h2>
        <span class="wm-access is-${escapeHtml(stop.accessLabel)}">${escapeHtml(accessText(stop.accessLabel, lang))}</span>
      </div>
      <div class="wm-meta">
        <span>${escapeHtml(areaKindText(stop.areaKind, lang))}</span>
        ${stop.estimatedMinutes ? `<span>${escapeHtml(String(stop.estimatedMinutes))} min</span>` : ""}
      </div>
      <div class="wm-cues">
        <section class="wm-cue"><strong>${escapeHtml(lang === "en" ? "Notice" : "見るもの")}</strong><ul>${cueList(stop.noticeCues)}</ul></section>
        <section class="wm-cue"><strong>${escapeHtml(lang === "en" ? "Record" : "残すもの")}</strong><ul>${cueList(stop.recordCues)}</ul></section>
      </div>
      ${recordHref ? `<a class="wm-record" href="${escapeHtml(recordHref)}">${escapeHtml(lang === "en" ? "Record from here" : "この場所で記録する")}</a>` : `<span class="wm-muted">${escapeHtml(lang === "en" ? "Recording link appears after permission and public scope are clear." : "許可と公開範囲が確認できるまで記録ボタンは出しません。")}</span>`}
    </article>`;
  }).join("");
  const modes = publicMap.routeFlexibility.mobilityModes.map((mode) => mobilityText(mode, lang)).join(" / ");
  const sources = publicMap.sourceReferences.map((ref) => `<li><a href="${escapeHtml(ref.url)}" rel="noopener noreferrer" target="_blank">${escapeHtml(ref.label)}</a><small>${escapeHtml(ref.note)}</small></li>`).join("");
  return `<main class="wm-shell">
    <section class="wm-hero">
      <p class="wm-eyebrow">${escapeHtml(publicMap.municipality)} / ${escapeHtml(publicMap.creatorName ?? "")}</p>
      <h1>${escapeHtml(publicMap.title)}</h1>
      <p class="wm-lead">${escapeHtml(publicMap.summary)}</p>
      <div class="wm-meta">
        <span>${escapeHtml(themeText(publicMap.theme, lang))}</span>
        <span>${escapeHtml(publicMap.publishModeLabel)}</span>
        <span>${escapeHtml(routeStyleText(publicMap.routeFlexibility.routeStyle, lang))}</span>
      </div>
    </section>
    <section class="wm-grid">
      <div class="wm-stops">${stops}</div>
      <aside class="wm-panel">
        <section class="wm-flex">
          <strong>${escapeHtml(lang === "en" ? "How to use" : "使い方")}</strong>
          <p>${escapeHtml(offRouteText(publicMap.routeFlexibility.offRoutePolicy, lang))}</p>
          <p>${escapeHtml(lang === "en" ? "Modes" : "移動手段")}: ${escapeHtml(modes)}</p>
          <ul>${publicMap.routeFlexibility.returnCues.map((cue) => `<li>${escapeHtml(cue)}</li>`).join("")}</ul>
        </section>
        <h2>${escapeHtml(lang === "en" ? "Scope" : "扱いの範囲")}</h2>
        <ul>${publicMap.claimBoundary.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        <h2>${escapeHtml(lang === "en" ? "Sources" : "引用元")}</h2>
        <ul class="wm-sources">${sources}</ul>
      </aside>
    </section>
  </main>`;
}

export async function registerMunicipalWalkMapRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/municipal-walk-maps", async (_request, reply) => {
    reply.type("application/json; charset=utf-8");
    return { ok: true, source: "static", summaries: listStaticMunicipalWalkMapPublicSummariesV0() };
  });

  app.get<{ Params: { walkMapId: string } }>("/api/v1/municipal-walk-maps/:walkMapId", async (request, reply) => {
    const config = getStaticMunicipalWalkMapConfigV0(request.params.walkMapId);
    reply.type("application/json; charset=utf-8");
    if (!config) {
      reply.code(404);
      return { ok: false, error: "walk_map_not_found" };
    }
    return { ok: true, source: "static", publicMap: buildMunicipalWalkMapPublicReadModelV0(config) };
  });

  app.get("/walk-maps", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    const summaries = listStaticMunicipalWalkMapPublicSummariesV0();
    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      lang,
      activeNav: "地図",
      title: "散策サンプル | ikimon",
      description: "自治体の散策資料を、公開範囲、出典リンク、記録の入口に分けて表示します。",
      currentPath: "/walk-maps",
      canonicalPath: "/walk-maps",
      alternateLangs: ["ja"],
      extraStyles: WALK_MAP_STYLES,
      body: renderIndexBody(summaries, basePath, lang),
    });
  });

  app.get<{ Params: { walkMapId: string } }>("/walk-maps/:walkMapId", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    const config = getStaticMunicipalWalkMapConfigV0(request.params.walkMapId);
    reply.type("text/html; charset=utf-8");
    if (!config) {
      reply.code(404);
      return renderSiteDocument({
        basePath,
        lang,
        activeNav: "地図",
        title: "散策サンプルが見つかりません | ikimon",
        description: "指定された散策サンプルは見つかりませんでした。",
        currentPath: `/walk-maps/${request.params.walkMapId}`,
        canonicalPath: "/walk-maps",
        noindex: true,
        extraStyles: WALK_MAP_STYLES,
        body: `<main class="wm-shell"><p>指定された散策サンプルは見つかりませんでした。</p><a class="wm-record" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/walk-maps"), lang))}">一覧へ</a></main>`,
      });
    }
    const publicMap = buildMunicipalWalkMapPublicReadModelV0(config);
    return renderSiteDocument({
      basePath,
      lang,
      activeNav: "地図",
      title: `${publicMap.title} | ikimon`,
      description: publicMap.summary,
      currentPath: `/walk-maps/${publicMap.walkMapId}`,
      canonicalPath: `/walk-maps/${publicMap.walkMapId}`,
      alternateLangs: ["ja"],
      extraStyles: WALK_MAP_STYLES,
      body: renderDetailBody(publicMap, basePath, lang),
    });
  });
}
