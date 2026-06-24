import type { FastifyInstance, FastifyRequest } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "../i18n.js";
import { getSessionFromCookie } from "../services/authSession.js";
import { isAdminOrAnalystRole } from "../services/reviewerAuthorities.js";
import { assertPrivilegedWriteAccess } from "../services/writeGuards.js";
import {
  applyRegisteredCreatorProfileForWriteV0,
  buildMunicipalWalkMapConfigFromSourceCatalogV0,
  buildMunicipalWalkMapConfigFromTemplateV0,
  buildMunicipalWalkMapPublicReadModelV0,
  getMunicipalWalkMapCreatorV0,
  getMunicipalWalkMapConfigV0FromDb,
  getMunicipalWalkMapSourceCatalogEntryV0,
  getStaticMunicipalWalkMapConfigV0,
  listMunicipalWalkMapReviewQueueV0,
  listPublicMunicipalWalkMapSummariesV0,
  listMunicipalWalkMapCreatorsV0,
  listMunicipalWalkMapSourceCatalogV0,
  listStaticMunicipalWalkMapPublicSummariesV0,
  listMunicipalWalkMapTemplatesV0,
  reviewMunicipalWalkMapPublicationV0,
  upsertMunicipalWalkMapCreatorV0,
  upsertMunicipalWalkMapConfigV0,
  validateMunicipalWalkMapCreatorV0,
  validateMunicipalWalkMapConfigV0,
  type MunicipalWalkMapConfigV0,
  type MunicipalWalkMapCreatorRegistryEntryV0,
  type MunicipalWalkMapPublicationReviewV0,
  type MunicipalWalkMapPublicReadModelV0,
  type MunicipalWalkMapPublicSummaryV0,
  type MunicipalWalkMapReviewDecisionActionV0,
  type MunicipalWalkMapReviewQueueItemV0,
  type MunicipalWalkMapSourceCatalogEntryV0,
  type MunicipalWalkMapTemplateV0,
} from "../services/municipalWalkMap.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

function requestUrl(request: { url?: string; raw?: { url?: string } }): string {
  return String(request.raw?.url ?? request.url ?? "");
}

function adminErrorStatus(message: string): number {
  if (message === "forbidden" || message === "forbidden_privileged_write") return 403;
  if (message === "privileged_write_api_key_not_configured") return 503;
  if (message.endsWith("_required") || message.startsWith("invalid_") || message.startsWith("blocked_") || message.includes("_invalid:") || message.startsWith("municipal_walk_map_review_not_ready:")) return 400;
  return 500;
}

async function assertMunicipalWalkMapAdminAccess(request: FastifyRequest): Promise<{ actorUserId: string | null; via: "session" | "write_key" }> {
  const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
  if (session && !session.banned && isAdminOrAnalystRole(session.roleName, session.rankLabel)) {
    return { actorUserId: session.userId, via: "session" };
  }
  assertPrivilegedWriteAccess(request);
  return { actorUserId: null, via: "write_key" };
}

function extractConfigFromBody(body: unknown): unknown {
  if (!body || typeof body !== "object") return null;
  return (body as { config?: unknown }).config ?? body;
}

function extractCreatorFromBody(body: unknown): unknown {
  if (!body || typeof body !== "object") return null;
  return (body as { creator?: unknown }).creator ?? body;
}

function extractReviewDecisionFromBody(body: unknown): { action: MunicipalWalkMapReviewDecisionActionV0; note?: string | null } {
  if (!body || typeof body !== "object") throw new Error("municipal_walk_map_review_action_required");
  const input = body as { action?: unknown; note?: unknown };
  const action = String(input.action || "");
  if (
    action !== "approve_public_preview"
    && action !== "request_changes"
    && action !== "emergency_hide"
  ) {
    throw new Error("municipal_walk_map_review_action_invalid");
  }
  return {
    action,
    note: input.note == null ? null : String(input.note),
  };
}

function assertValidConfigForWrite(value: unknown): MunicipalWalkMapConfigV0 {
  if (!value || typeof value !== "object") throw new Error("config_required");
  const validation = validateMunicipalWalkMapConfigV0(value);
  if (!validation.ok) throw new Error(`invalid_walk_map:${validation.errors.join(",")}`);
  return value as MunicipalWalkMapConfigV0;
}

async function prepareConfigForWrite(value: unknown): Promise<MunicipalWalkMapConfigV0> {
  const config = assertValidConfigForWrite(value);
  const creatorId = String(config.creatorProfile.creatorId ?? "").trim();
  if (!creatorId) return config;
  const creator = await getMunicipalWalkMapCreatorV0(creatorId);
  return applyRegisteredCreatorProfileForWriteV0(config, creator);
}

function assertValidCreatorForWrite(value: unknown): MunicipalWalkMapCreatorRegistryEntryV0 {
  if (!value || typeof value !== "object") throw new Error("creator_required");
  const validation = validateMunicipalWalkMapCreatorV0(value);
  if (!validation.ok) throw new Error(`invalid_walk_map_creator:${validation.errors.join(",")}`);
  return value as MunicipalWalkMapCreatorRegistryEntryV0;
}

function isPublicDbVisible(config: MunicipalWalkMapConfigV0): boolean {
  return config.publishMode === "public";
}

function isPublicStaticVisible(config: MunicipalWalkMapConfigV0): boolean {
  return config.publishMode === "public" || config.publishMode === "public_preview";
}

async function loadWalkMapConfig(
  walkMapId: string,
  options: { allowDraft: boolean; allowStaticFallback: boolean },
): Promise<{ source: "db" | "static"; config: MunicipalWalkMapConfigV0 } | null> {
  const staticConfig = (() => {
    try { return getStaticMunicipalWalkMapConfigV0(walkMapId); } catch { return null; }
  })();
  if (!options.allowDraft && staticConfig && options.allowStaticFallback && isPublicStaticVisible(staticConfig)) {
    if (!validateMunicipalWalkMapConfigV0(staticConfig).ok) return null;
    return { source: "static", config: staticConfig };
  }
  if (!options.allowDraft && !dbWalkMapIndexEnabled()) return null;

  let dbConfig: MunicipalWalkMapConfigV0 | null = null;
  let dbError: unknown = null;
  try {
    dbConfig = await getMunicipalWalkMapConfigV0FromDb(walkMapId);
  } catch (error) {
    dbError = error;
  }
  if (dbConfig) {
    if (!options.allowDraft && !isPublicDbVisible(dbConfig)) return null;
    if (!options.allowDraft && !validateMunicipalWalkMapConfigV0(dbConfig).ok) return null;
    return { source: "db", config: dbConfig };
  }
  if (staticConfig && options.allowStaticFallback && (options.allowDraft || isPublicStaticVisible(staticConfig))) {
    if (!options.allowDraft && !validateMunicipalWalkMapConfigV0(staticConfig).ok) return null;
    return { source: "static", config: staticConfig };
  }
  if (dbError) throw dbError;
  return null;
}

async function loadWalkMapPublicReadModel(
  walkMapId: string,
  options: { allowDraft?: boolean; allowStaticFallback?: boolean } = {},
): Promise<{ source: "db" | "static"; publicMap: MunicipalWalkMapPublicReadModelV0; config: MunicipalWalkMapConfigV0 } | null> {
  const loaded = await loadWalkMapConfig(walkMapId, {
    allowDraft: Boolean(options.allowDraft),
    allowStaticFallback: options.allowStaticFallback !== false,
  });
  if (!loaded) return null;
  return { ...loaded, publicMap: buildMunicipalWalkMapPublicReadModelV0(loaded.config) };
}

const WALK_MAP_STYLES = `
.wm-shell{max-width:1120px;margin:0 auto;padding:28px 18px 72px;color:#17211d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.wm-hero{display:grid;gap:12px;margin:8px 0 18px}
.wm-eyebrow{margin:0;color:#0f766e;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:0}
.wm-hero h1{margin:0;font-size:clamp(28px,4vw,44px);line-height:1.12;letter-spacing:0}
.wm-lead{margin:0;color:#46554f;font-size:16px;line-height:1.75;max-width:780px}
.wm-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.wm-meta span{padding:6px 10px;border-radius:999px;background:#ecfdf5;color:#0f766e;font-size:12px;font-weight:850}
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
.wm-flex{border:1px solid #dbe7e2;border-radius:8px;background:#f8fafc;padding:12px;display:grid;gap:8px}
.wm-flex strong{font-size:13px;color:#0f172a}
.wm-flex p{margin:0;color:#475569;font-size:12px;line-height:1.7}
.wm-flex ul{margin:0;padding-left:18px;color:#475569;font-size:12px;line-height:1.7}
.wm-sources{display:grid;gap:8px}
.wm-sources li{display:grid;gap:3px}
.wm-sources a{color:#0f766e;font-weight:900;text-decoration:none}
.wm-sources small{color:#64748b;line-height:1.6}
.wm-record{display:inline-flex;align-items:center;justify-content:center;min-height:38px;border-radius:7px;background:#0f766e;color:#fff;text-decoration:none;font-weight:900;padding:0 12px;font-size:13px;justify-self:start}
.wm-muted{color:#64748b;font-size:12px;font-weight:800}
.wm-panel{border:1px solid #dbe7e2;border-radius:8px;background:#fff;padding:14px;display:grid;gap:12px}
.wm-panel h2{margin:0;font-size:17px}
.wm-panel ul{margin:0;padding-left:18px;color:#475569;font-size:12px;line-height:1.75}
.wm-warnings{border-color:#fed7aa;background:#fff7ed}
.wm-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-top:16px}
.wm-card{border:1px solid #dbe7e2;border-radius:8px;background:#fff;padding:14px;display:grid;gap:10px;text-decoration:none;color:inherit;min-height:190px}
.wm-card:hover{border-color:#0f766e;box-shadow:0 14px 34px rgba(15,118,110,.12)}
.wm-card h2{margin:0;font-size:18px;line-height:1.35;color:#0f172a}
.wm-card p{margin:0;color:#475569;font-size:13px;line-height:1.7}
.wm-card-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:auto}
.wm-card-foot strong{color:#0f766e;font-size:13px;white-space:nowrap}
@media(max-width:760px){.wm-grid,.wm-cues{grid-template-columns:1fr}.wm-shell{padding-top:18px;padding-bottom:132px}.wm-stop-head{display:grid}.wm-access{justify-self:start}}
`;

function accessText(label: MunicipalWalkMapPublicReadModelV0["stops"][number]["accessLabel"], lang: SiteLang): string {
  if (lang === "en") {
    if (label === "public_scope") return "Public scope";
    if (label === "check_permission") return "Check permission";
    return "No record CTA";
  }
  if (label === "public_scope") return "公開範囲";
  if (label === "check_permission") return "許可確認";
  return "立入誘導なし";
}

function mobilityText(mode: MunicipalWalkMapPublicReadModelV0["routeFlexibility"]["mobilityModes"][number], lang: SiteLang): string {
  const ja: Record<string, string> = {
    walk: "徒歩",
    bike: "自転車",
    car: "車",
    motorbike: "バイク",
    public_transport: "公共交通",
  };
  const en: Record<string, string> = {
    walk: "Walk",
    bike: "Bike",
    car: "Car",
    motorbike: "Motorbike",
    public_transport: "Public transport",
  };
  return lang === "en" ? en[mode] ?? mode : ja[mode] ?? mode;
}

function routeStyleText(style: MunicipalWalkMapPublicReadModelV0["routeFlexibility"]["routeStyle"], lang: SiteLang): string {
  if (lang === "en") {
    if (style === "suggested_order") return "Recommended";
    if (style === "free_area") return "Public area";
    return "Walk stops";
  }
  if (style === "suggested_order") return "おすすめ";
  if (style === "free_area") return "公開範囲";
  return "散策案内";
}

function offRoutePolicyText(policy: MunicipalWalkMapPublicReadModelV0["routeFlexibility"]["offRoutePolicy"], lang: SiteLang): string {
  if (lang === "en") {
    if (policy === "stay_near_public_path") return "Stay near public paths";
    if (policy === "guide_only") return "Guide only";
    return "Use public areas";
  }
  if (policy === "stay_near_public_path") return "公開された道の近くで";
  if (policy === "guide_only") return "案内として使う";
  return "公開範囲で使う";
}

function themeText(theme: MunicipalWalkMapPublicReadModelV0["theme"], lang: SiteLang): string {
  const ja: Record<string, string> = {
    seasonal_walk: "季節の散策",
    waterfront: "水辺",
    park_walk: "公園・緑地",
    satoyama: "里山",
    city_nature: "まちなか自然",
    school_learning: "学習利用",
  };
  const en: Record<string, string> = {
    seasonal_walk: "Seasonal walk",
    waterfront: "Waterfront",
    park_walk: "Park walk",
    satoyama: "Satoyama",
    city_nature: "Urban nature",
    school_learning: "Learning use",
  };
  return lang === "en" ? en[theme] ?? theme : ja[theme] ?? theme;
}

function publishModeText(mode: MunicipalWalkMapPublicReadModelV0["publishMode"], lang: SiteLang): string {
  if (lang === "en") {
    if (mode === "public") return "Published";
    if (mode === "public_preview") return "Public preview";
    return "Draft";
  }
  if (mode === "public") return "公開中";
  if (mode === "public_preview") return "公開プレビュー";
  return "下書き";
}

function areaKindText(areaKind: MunicipalWalkMapPublicReadModelV0["stops"][number]["areaKind"], lang: SiteLang): string {
  const ja: Record<string, string> = {
    park: "公園・緑地",
    waterfront: "水辺",
    satoyama: "里山",
    street_edge: "道沿い",
    school: "学校・教育施設",
    other: "その他",
  };
  const en: Record<string, string> = {
    park: "Park",
    waterfront: "Waterfront",
    satoyama: "Satoyama",
    street_edge: "Street edge",
    school: "School / learning site",
    other: "Other",
  };
  return lang === "en" ? en[areaKind] ?? areaKind : ja[areaKind] ?? areaKind;
}

function warningText(warning: string, lang: SiteLang): string {
  const code = warning.split(":")[0] ?? warning;
  const ja: Record<string, string> = {
    route_stop_count_high: "立ち寄り先が多いため、短い散策に分ける確認が必要です。",
    unknown_species_mode_missing: "名前が分からない生きものを扱う設定が入っていません。",
    memo_mode_missing: "メモだけで残す設定が入っていません。",
    public_stop_without_linked_field: "公開範囲と紐づいていない立ち寄り先があります。",
    stop_cues_missing: "見るもの・残すものが未設定の立ち寄り先があります。",
    site_precision_requires_public_place_review: "場所単位で出す前に、公開してよい範囲の確認が必要です。",
  };
  const en: Record<string, string> = {
    route_stop_count_high: "There are many stops; consider splitting this into shorter walks.",
    unknown_species_mode_missing: "Unknown-species mode is not enabled.",
    memo_mode_missing: "Memo mode is not enabled.",
    public_stop_without_linked_field: "A public stop is not linked to a confirmed public scope.",
    stop_cues_missing: "A stop is missing notice or record cues.",
    site_precision_requires_public_place_review: "Place-level display needs public-scope review.",
  };
  return lang === "en" ? en[code] ?? "This map needs an additional check." : ja[code] ?? "追加確認が必要な項目があります。";
}

function hiddenContextText(context: MunicipalWalkMapPublicReadModelV0["locationSafety"]["defaultHiddenContexts"][number], lang: SiteLang): string {
  const ja: Record<string, string> = {
    home_or_minor_context: "自宅付近や子どもが推測される情報は出さない",
    rare_species_context: "希少種につながる地点は出し方を落とす",
    school_or_private_land: "学校・私有地は許可と公開範囲を先に確認する",
  };
  const en: Record<string, string> = {
    home_or_minor_context: "Hide home-adjacent or child-identifying context",
    rare_species_context: "Reduce precision for rare-species context",
    school_or_private_land: "Check permission and public scope for schools or private land",
  };
  return lang === "en" ? en[context] ?? context : ja[context] ?? context;
}

function precisionPolicyText(policy: MunicipalWalkMapPublicReadModelV0["locationSafety"]["publicPrecisionPolicy"], lang: SiteLang): string {
  if (lang === "en") {
    if (policy === "site_or_coarser") return "Place scope or coarser";
    if (policy === "mesh_or_coarser") return "Mesh scope or coarser";
    return "Municipality scope or hidden";
  }
  if (policy === "site_or_coarser") return "場所単位まで";
  if (policy === "mesh_or_coarser") return "メッシュ単位まで";
  return "市区町村単位または非表示";
}

function renderWalkMapPreviewBody(
  publicMap: MunicipalWalkMapPublicReadModelV0,
  basePath: string,
  lang: SiteLang,
  source: string,
  options: { suppressRecordCtas?: boolean } = {},
): string {
  const stops = publicMap.stops.map((stop, index) => {
    const cueList = (items: string[]) => items.length ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : `<li>${escapeHtml(lang === "en" ? "To be set" : "未設定")}</li>`;
    const recordHref =
      !options.suppressRecordCtas && stop.recordHref ? appendLangToHref(withBasePath(basePath, stop.recordHref), lang) : "";
    return `<article class="wm-stop">
      <div class="wm-stop-head">
        <h2>${index + 1}. ${escapeHtml(stop.title)}</h2>
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
      ${recordHref ? `<a class="wm-record" href="${escapeHtml(recordHref)}">${escapeHtml(lang === "en" ? "Record from this stop" : "この場所で記録する")}</a>` : `<span class="wm-muted">${escapeHtml(lang === "en" ? "Recording starts after permission and public scope are clear." : "許可と公開範囲が確認できるまで記録ボタンは出しません。")}</span>`}
    </article>`;
  }).join("");
  const warnings = publicMap.validation.warnings.length
    ? `<aside class="wm-panel wm-warnings"><h2>${escapeHtml(lang === "en" ? "Checks" : "確認事項")}</h2><ul>${publicMap.validation.warnings.map((item) => `<li>${escapeHtml(warningText(item, lang))}</li>`).join("")}</ul></aside>`
    : "";
  const mobilityModes = publicMap.routeFlexibility.mobilityModes.map((mode) => mobilityText(mode, lang)).join(" / ");
  const returnCues = publicMap.routeFlexibility.returnCues.length
    ? publicMap.routeFlexibility.returnCues.map((cue) => `<li>${escapeHtml(cue)}</li>`).join("")
    : `<li>${escapeHtml(lang === "en" ? "Use visible signs, roads, and open entrances to return." : "案内板や大きな道を目印に戻る")}</li>`;
  const sourceReferences = publicMap.sourceReferences.length
    ? `<section><h2>${escapeHtml(lang === "en" ? "Sources" : "引用元")}</h2><ul class="wm-sources">${publicMap.sourceReferences.map((ref) => `<li><a href="${escapeHtml(ref.url)}" rel="noopener noreferrer" target="_blank">${escapeHtml(ref.label)}</a>${ref.note ? `<small>${escapeHtml(ref.note)}</small>` : ""}</li>`).join("")}</ul></section>`
    : "";
  const locationSafety = `<section class="wm-flex">
          <strong>${escapeHtml(lang === "en" ? "Location display" : "場所の出し方")}</strong>
          <p>${escapeHtml(lang === "en" ? "Exact stop locations are not published from this surface." : "正確な立入地点は、この画面では出しません。")}</p>
          <p>${escapeHtml(lang === "en" ? "Public precision" : "公開粒度")}: ${escapeHtml(precisionPolicyText(publicMap.locationSafety.publicPrecisionPolicy, lang))}</p>
          <ul>${publicMap.locationSafety.defaultHiddenContexts.map((context) => `<li>${escapeHtml(hiddenContextText(context, lang))}</li>`).join("")}</ul>
        </section>`;
  const looseRouteNotice = `<section class="wm-flex">
          <strong>${escapeHtml(lang === "en" ? "Field priority" : "歩くときの優先")}</strong>
          <p>${escapeHtml(lang === "en"
            ? "This is a loose set of stops. Use sidewalks, signs, site rules, weather, and your own judgment first."
            : "このルートは立ち寄り先をゆるく選ぶための案内です。歩道、標識、施設のルール、天候、現地の状況を優先してください。")}</p>
          <p>${escapeHtml(lang === "en"
            ? "Do not enter private land, schools, restricted areas, unsafe waterfronts, or places without public access."
            : "私有地、学校、管理区域、危ない水辺、立入が認められていない場所には入りません。")}</p>
        </section>`;
  return `<main class="wm-shell">
    <section class="wm-hero">
      <p class="wm-eyebrow">${escapeHtml(publicMap.municipality)} / ${escapeHtml(source)}</p>
      <h1>${escapeHtml(publicMap.title)}</h1>
      <p class="wm-lead">${escapeHtml(publicMap.summary)}</p>
      <div class="wm-meta">
        <span>${escapeHtml(themeText(publicMap.theme, lang))}</span>
        <span>${escapeHtml(publishModeText(publicMap.publishMode, lang))}</span>
        <span>${escapeHtml(routeStyleText(publicMap.routeFlexibility.routeStyle, lang))}</span>
      </div>
    </section>
    <section class="wm-grid">
      <div class="wm-stops">${stops}</div>
      <aside class="wm-panel">
        <section class="wm-flex">
          <strong>${escapeHtml(lang === "en" ? "How to use" : "立ち寄り方")}</strong>
          <p>${escapeHtml(routeStyleText(publicMap.routeFlexibility.routeStyle, lang))} / ${escapeHtml(offRoutePolicyText(publicMap.routeFlexibility.offRoutePolicy, lang))}</p>
          <p>${escapeHtml(lang === "en" ? "Modes" : "移動手段")}: ${escapeHtml(mobilityModes || (lang === "en" ? "Walk" : "徒歩"))}</p>
          <ul>${returnCues}</ul>
        </section>
        ${looseRouteNotice}
        ${locationSafety}
        <h2>${escapeHtml(lang === "en" ? "Boundary" : "扱いの範囲")}</h2>
        <ul>${publicMap.claimBoundary.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        ${sourceReferences}
      </aside>
      ${warnings}
    </section>
  </main>`;
}

function mergeWalkMapSummaries(dbSummaries: MunicipalWalkMapPublicSummaryV0[], staticSummaries: MunicipalWalkMapPublicSummaryV0[]): MunicipalWalkMapPublicSummaryV0[] {
  const seen = new Set<string>();
  const merged: MunicipalWalkMapPublicSummaryV0[] = [];
  for (const summary of [...dbSummaries, ...staticSummaries]) {
    if (seen.has(summary.walkMapId)) continue;
    seen.add(summary.walkMapId);
    merged.push(summary);
  }
  return merged;
}

function dbWalkMapIndexEnabled(): boolean {
  return process.env.IKIMON_ENABLE_DB_WALK_MAP_INDEX === "1";
}

async function loadWalkMapPublicSummaries(): Promise<{ source: "db" | "static" | "mixed"; summaries: MunicipalWalkMapPublicSummaryV0[] }> {
  const staticSummaries = listStaticMunicipalWalkMapPublicSummariesV0();
  if (!dbWalkMapIndexEnabled()) {
    return { source: "static", summaries: staticSummaries };
  }
  try {
    const dbSummaries = await listPublicMunicipalWalkMapSummariesV0();
    const summaries = mergeWalkMapSummaries(dbSummaries, staticSummaries);
    return { source: dbSummaries.length ? "mixed" : "static", summaries };
  } catch {
    return { source: "static", summaries: staticSummaries };
  }
}

const WALK_MAP_LOCATION_BBOXES = [
  { municipalityCode: "22100", label: "静岡市", bbox: [137.47, 34.57, 139.16, 35.65] as const },
];

function numberFromQuery(value: unknown): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function walkMapMunicipalityCodeForLocation(lat: number | null, lng: number | null): string | null {
  if (lat == null || lng == null) return null;
  const match = WALK_MAP_LOCATION_BBOXES.find((entry) => (
    lng >= entry.bbox[0] && lng <= entry.bbox[2]
    && lat >= entry.bbox[1] && lat <= entry.bbox[3]
  ));
  return match?.municipalityCode ?? null;
}

function walkMapSummaryMatchesMunicipality(summary: MunicipalWalkMapPublicSummaryV0, municipalityCode: string): boolean {
  if (municipalityCode === "22100") {
    return summary.municipality.includes("静岡");
  }
  return false;
}

function filterWalkMapSummariesForLocation(
  summaries: MunicipalWalkMapPublicSummaryV0[],
  query: { lat?: unknown; lng?: unknown; limit?: unknown },
): { summaries: MunicipalWalkMapPublicSummaryV0[]; matchedMunicipalityCode: string | null; locationFiltered: boolean } {
  const lat = numberFromQuery(query.lat);
  const lng = numberFromQuery(query.lng);
  const locationFiltered = lat != null && lng != null;
  const matchedMunicipalityCode = walkMapMunicipalityCodeForLocation(lat, lng);
  const limit = Math.max(1, Math.min(8, Number(query.limit) || 4));
  const scoped = locationFiltered
    ? summaries.filter((summary) => matchedMunicipalityCode && walkMapSummaryMatchesMunicipality(summary, matchedMunicipalityCode))
    : summaries;
  return { summaries: scoped.slice(0, limit), matchedMunicipalityCode, locationFiltered };
}

function renderWalkMapIndexBody(summaries: MunicipalWalkMapPublicSummaryV0[], basePath: string, lang: SiteLang, source: string): string {
  const cards = summaries.map((summary) => {
    const href = appendLangToHref(withBasePath(basePath, `/walk-maps/${encodeURIComponent(summary.walkMapId)}`), lang);
    const mobilityModes = summary.mobilityModes.map((mode) => mobilityText(mode, lang)).join(" / ");
    const sourceCount = summary.sourceReferences.length;
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
      ${sourceCount ? `<span class="wm-muted">${escapeHtml(lang === "en" ? `${sourceCount} source links` : `引用元 ${sourceCount}件`)}</span>` : ""}
    </a>`;
  }).join("");
  return `<main class="wm-shell">
    <section class="wm-hero">
      <p class="wm-eyebrow">${escapeHtml(lang === "en" ? "Walk routes" : "散策ルート")}</p>
      <h1>${escapeHtml(lang === "en" ? "Choose a public walk area" : "公開範囲で歩ける散策ルート")}</h1>
      <p class="wm-lead">${escapeHtml(lang === "en"
        ? "Photos, guides, route stops, and recording entry points are gathered here."
        : "写真、ガイド、立ち寄り先、記録の入口をまとめています。")}</p>
      <div class="wm-meta">
        <span>${escapeHtml(lang === "en" ? `${summaries.length} maps` : `${summaries.length}件`)}</span>
        <span>${escapeHtml(source)}</span>
      </div>
    </section>
    <section class="wm-list" aria-label="${escapeHtml(lang === "en" ? "Walk map list" : "散策ルート一覧")}">${cards}</section>
  </main>`;
}

function option(value: string, current: string, label: string): string {
  return `<option value="${escapeHtml(value)}" ${value === current ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function textareaValue(values: string[] | undefined): string {
  return (values ?? []).join("\n");
}

function sourceReferencesValue(values: MunicipalWalkMapConfigV0["sourceReferences"] | undefined): string {
  return (values ?? []).map((ref) => [ref.label, ref.url, ref.note].filter(Boolean).join(" | ")).join("\n");
}

function adminLoginGate(): string {
  return `
<div class="wm-admin-login">
  <h2>散策マップ管理</h2>
  <p>自治体・団体向けの散策マップを作成する管理画面です。</p>
  <p><a href="/login?next=${encodeURIComponent("/admin/municipal-walk-maps")}">ログインへ</a></p>
</div>`;
}

const ADMIN_WALK_MAP_STYLES = `${WALK_MAP_STYLES}
.wm-admin-login{max-width:560px;margin:64px auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;font-family:-apple-system,system-ui,sans-serif}
.wm-admin-wrap{max-width:1180px;margin:0 auto;padding:30px 18px 72px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17211d}
.wm-admin-top{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;margin-bottom:16px}
.wm-admin-top h1{margin:0;font-size:28px;line-height:1.22;color:#111827}
.wm-admin-top p{margin:6px 0 0;color:#475569;font-size:14px;line-height:1.7;max-width:760px}
.wm-admin-links{display:flex;gap:8px;flex-wrap:wrap}
.wm-admin-link{min-height:38px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#0f172a;padding:0 12px;font-size:12px;font-weight:900;text-decoration:none}
.wm-admin-template{border:1px solid #dbe7e2;background:#fff;border-radius:8px;padding:14px;display:grid;gap:12px;margin-bottom:14px}
.wm-admin-template h2{margin:0;color:#111827;font-size:17px;line-height:1.35}
.wm-admin-template p{margin:0;color:#475569;font-size:13px;line-height:1.7}
.wm-admin-template select{width:100%;max-width:520px;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#111827;min-height:38px;padding:8px 10px;font:inherit;font-size:14px}
.wm-admin-template-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px}
.wm-admin-template-card{border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:10px;display:grid;gap:7px;align-content:start}
.wm-admin-template-card.is-selected{border-color:#0f766e;background:#f0fdfa}
.wm-admin-template-card strong{font-size:13px;color:#0f172a;line-height:1.35}
.wm-admin-template-card span{font-size:12px;color:#64748b;line-height:1.6}
.wm-admin-template-meta{display:flex;gap:6px;flex-wrap:wrap}
.wm-admin-template-meta span{display:inline-flex;align-items:center;border:1px solid rgba(15,118,110,.16);border-radius:999px;background:rgba(255,255,255,.86);padding:3px 8px;color:#0f766e;font-weight:900;font-size:11px;line-height:1.35}
.wm-admin-template-examples{margin:0;padding-left:16px;color:#475569;font-size:12px;line-height:1.55}
.wm-admin-template-action{min-height:32px;display:inline-flex;align-items:center;justify-content:center;justify-self:start;border:1px solid #0f766e;border-radius:6px;background:#fff;color:#0f766e;padding:0 10px;font-size:12px;font-weight:900;text-decoration:none}
.wm-admin-source-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px}
.wm-admin-source-card{border:1px solid #dbe7e2;border-radius:8px;background:#fbfefc;padding:10px;display:grid;gap:6px}
.wm-admin-source-card.is-selected{border-color:#0f766e;background:#f0fdfa}
.wm-admin-source-card strong{font-size:13px;color:#0f172a;line-height:1.35}
.wm-admin-source-card span,.wm-admin-source-card small{font-size:12px;color:#64748b;line-height:1.55}
.wm-admin-source-card a{color:#0f766e;font-weight:900;text-decoration:none;font-size:12px}
.wm-admin-source-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.wm-admin-source-actions button{min-height:32px;border:1px solid #0f766e;border-radius:6px;background:#0f766e;color:#fff;padding:0 10px;font-size:12px;font-weight:900;cursor:pointer}
.wm-admin-source-actions .wm-admin-source-draft{display:inline-flex;align-items:center;justify-content:center;min-height:32px;border:1px solid #0f766e;border-radius:6px;background:#fff;color:#0f766e;padding:0 10px}
.wm-admin-source-meta{display:flex;gap:6px;flex-wrap:wrap}
.wm-admin-source-meta span{display:inline-flex;align-items:center;border:1px solid rgba(15,118,110,.16);border-radius:999px;background:rgba(240,253,250,.9);padding:3px 8px;color:#0f766e;font-weight:900;font-size:11px}
.wm-admin-gate{border:1px solid #dbe7e2;background:#fbfefc;border-radius:8px;padding:14px;display:grid;gap:12px;margin-bottom:14px}
.wm-admin-gate h2{margin:0;color:#111827;font-size:17px;line-height:1.35}
.wm-admin-gate p{margin:0;color:#475569;font-size:13px;line-height:1.7}
.wm-admin-gate-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px}
.wm-admin-gate-item{border:1px solid #fed7aa;border-radius:8px;background:#fff7ed;padding:10px;display:grid;gap:5px}
.wm-admin-gate-item.is-ready{border-color:#bbf7d0;background:#f0fdf4}
.wm-admin-gate-item strong{font-size:12px;color:#0f172a;line-height:1.35}
.wm-admin-gate-item span{font-size:12px;color:#475569;line-height:1.55}
.wm-admin-gate-errors{font-family:ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace;font-size:11px!important;color:#9a3412!important;overflow-wrap:anywhere}
.wm-admin-form{border:1px solid #dbe7e2;background:#fff;border-radius:8px;padding:16px;display:grid;gap:14px}
.wm-admin-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.wm-admin-wide{grid-column:1/-1}
.wm-admin-form label{display:grid;gap:5px;color:#475569;font-size:12px;font-weight:850;text-transform:uppercase}
.wm-admin-form input,.wm-admin-form select,.wm-admin-form textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#111827;min-height:38px;padding:8px 10px;font:inherit;font-size:14px}
.wm-admin-form textarea{line-height:1.55;resize:vertical}
.wm-admin-stop{border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:12px;display:grid;gap:10px}
.wm-admin-stop-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.wm-admin-stop h2{margin:0;font-size:15px;color:#111827}
.wm-admin-stop button{min-height:32px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#334155;padding:0 10px;font-size:12px;font-weight:900;cursor:pointer}
.wm-admin-stop-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.wm-admin-stop-actions{display:flex;align-items:center;justify-content:flex-start}
.wm-admin-stop-actions button{min-height:36px;border:1px solid #0f766e;border-radius:6px;background:#fff;color:#0f766e;padding:0 12px;font-weight:900;cursor:pointer}
.wm-admin-actions{display:flex;align-items:center;gap:10px;border-top:1px solid #eef2f7;padding-top:12px}
.wm-admin-actions button{min-height:40px;border:1px solid #0f766e;border-radius:6px;background:#0f766e;color:#fff;padding:0 14px;font-weight:900;cursor:pointer}
.wm-admin-result{font-size:12px;color:#475569;font-weight:800}
.wm-admin-draft-export{border:1px solid #dbe7e2;border-radius:8px;background:#fbfefc;padding:12px;display:grid;gap:9px}
.wm-admin-draft-export h2{margin:0;color:#0f172a;font-size:15px;line-height:1.35}
.wm-admin-draft-export p{margin:0;color:#475569;font-size:12px;line-height:1.7}
.wm-admin-draft-export textarea{min-height:150px;font-family:ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace;font-size:12px;line-height:1.55}
.wm-admin-draft-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.wm-admin-draft-tools button{min-height:34px;border:1px solid #0f766e;border-radius:6px;background:#fff;color:#0f766e;padding:0 10px;font-size:12px;font-weight:900;cursor:pointer}
.wm-admin-draft-tools button:first-child{background:#0f766e;color:#fff}
.wm-creator-list{display:grid;gap:8px;margin-top:12px}
.wm-creator-item{border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:10px;display:grid;gap:4px}
.wm-creator-item strong{font-size:13px;color:#0f172a}
.wm-creator-item span{font-size:12px;color:#64748b}
.wm-review-list{display:grid;gap:10px}
.wm-review-item{border:1px solid #e2e8f0;border-radius:8px;background:#fff;padding:12px;display:grid;gap:9px}
.wm-review-item.is-ready{border-color:#bbf7d0;background:#f0fdf4}
.wm-review-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.wm-review-head h2{margin:0;font-size:16px;line-height:1.35;color:#0f172a}
.wm-review-meta{display:flex;gap:6px;flex-wrap:wrap}
.wm-review-meta span{display:inline-flex;align-items:center;border-radius:999px;background:#f1f5f9;color:#475569;padding:4px 8px;font-size:11px;font-weight:900}
.wm-review-reasons{margin:0;padding-left:18px;color:#475569;font-size:12px;line-height:1.7}
.wm-review-actions{display:flex;gap:8px;flex-wrap:wrap}
.wm-review-actions a,.wm-review-actions button{min-height:32px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #0f766e;border-radius:6px;background:#fff;color:#0f766e;padding:0 10px;font-size:12px;font-weight:900;text-decoration:none;cursor:pointer}
.wm-review-actions button[data-review-action="approve_public_preview"]{background:#0f766e;color:#fff}
.wm-review-actions button[data-review-action="emergency_hide"]{border-color:#b91c1c;color:#b91c1c}
.wm-review-actions form{display:inline-flex}
.wm-review-result{font-size:12px;color:#475569;font-weight:800;min-height:18px}
@media(max-width:860px){.wm-admin-fields,.wm-admin-stop-grid{grid-template-columns:1fr}.wm-admin-top{display:grid}.wm-admin-wide{grid-column:auto}}
`;

function renderStopFields(stop: MunicipalWalkMapConfigV0["routeStops"][number] | undefined, index: number): string {
  const prefix = `stop${index}`;
  const areaKind = stop?.areaKind ?? (index === 0 ? "park" : "street_edge");
  const access = stop?.access ?? "public_access";
  const sensitiveContext = stop?.sensitiveContext ?? "none";
  return `
<section class="wm-admin-stop" data-stop-index="${index}">
  <div class="wm-admin-stop-head">
    <h2>立ち寄り先 ${index + 1}</h2>
    <button type="button" data-walk-map-remove-stop>削除</button>
  </div>
  <div class="wm-admin-stop-grid">
    <label>stop id<input name="${prefix}StopId" value="${escapeHtml(stop?.stopId ?? (index === 0 ? "start" : ""))}" placeholder="public-park-start"></label>
    <label>名称<input name="${prefix}Title" value="${escapeHtml(stop?.title ?? "")}" placeholder="公園入口"></label>
    <label>目安分数<input name="${prefix}EstimatedMinutes" type="number" min="1" max="180" step="1" value="${escapeHtml(stop?.estimatedMinutes == null ? "" : String(stop.estimatedMinutes))}"></label>
    <label>場所種別<select name="${prefix}AreaKind">
      ${option("park", areaKind, "公園・緑地")}
      ${option("waterfront", areaKind, "水辺")}
      ${option("satoyama", areaKind, "里山")}
      ${option("street_edge", areaKind, "道沿い")}
      ${option("school", areaKind, "学校・教育施設")}
      ${option("other", areaKind, "その他")}
    </select></label>
    <label>立入条件<select name="${prefix}Access">
      ${option("public_access", access, "公開範囲")}
      ${option("permission_required", access, "許可確認")}
      ${option("private_or_restricted", access, "私有地・制限あり")}
      ${option("unknown", access, "未確認")}
    </select></label>
    <label>場所注意<select name="${prefix}SensitiveContext">
      ${option("none", sensitiveContext, "通常")}
      ${option("school_or_minor", sensitiveContext, "学校・子ども文脈")}
      ${option("private_edge", sensitiveContext, "私有地に近い")}
      ${option("rare_species", sensitiveContext, "希少種文脈")}
    </select></label>
    <label>linked field id<input name="${prefix}LinkedFieldId" value="${escapeHtml(stop?.linkedFieldId ?? "")}" placeholder="osm_park:..."></label>
    <label class="wm-admin-wide">見るもの<textarea name="${prefix}NoticeCues" rows="3" placeholder="案内板&#10;木陰">${escapeHtml(textareaValue(stop?.noticeCues))}</textarea></label>
    <label class="wm-admin-wide">残すもの<textarea name="${prefix}RecordCues" rows="3" placeholder="花&#10;鳥の声">${escapeHtml(textareaValue(stop?.recordCues))}</textarea></label>
    <label class="wm-admin-wide">安全メモ<textarea name="${prefix}SafetyNotes" rows="2" placeholder="現地の案内を優先する">${escapeHtml(textareaValue(stop?.safetyNotes))}</textarea></label>
    <label class="wm-admin-wide">内部メモ<textarea name="${prefix}InternalMemo" rows="2">${escapeHtml(stop?.internalMemo ?? "")}</textarea></label>
  </div>
</section>`;
}

function renderTemplatePicker(
  templates: MunicipalWalkMapTemplateV0[],
  selectedTemplateId: string,
  sources: MunicipalWalkMapSourceCatalogEntryV0[],
): string {
  const options = [
    `<option value="">空のフォーム</option>`,
    ...templates.map((template) => option(template.templateId, selectedTemplateId, template.label)),
  ].join("");
  const cards = templates.map((template) => {
    const matchingSources = sources.filter((source) => source.templateId === template.templateId);
    const examples = matchingSources.length > 0
      ? matchingSources
        .sort((left, right) => (right.affinityScore - left.affinityScore) || left.sourceId.localeCompare(right.sourceId))
        .slice(0, 3)
        .map((source) => source.title)
      : template.exampleSources.slice(0, 3).map((source) => source.label);
    const mobilityModes = template.config.routeFlexibility.mobilityModes.map((mode) => mobilityText(mode, "ja")).join(" / ");
    return `
    <article class="wm-admin-template-card${template.templateId === selectedTemplateId ? " is-selected" : ""}" data-template-source-count="${matchingSources.length}" data-template-start-link="/admin/municipal-walk-maps?templateId=${encodeURIComponent(template.templateId)}">
      <strong>${escapeHtml(template.label)}</strong>
      <span>${escapeHtml(template.summary)}</span>
      <div class="wm-admin-template-meta">
        <span>事例 ${escapeHtml(String(matchingSources.length))}</span>
        <span>${escapeHtml(routeStyleText(template.config.routeFlexibility.routeStyle, "ja"))}</span>
        <span>${escapeHtml(mobilityModes)}</span>
      </div>
      <ul class="wm-admin-template-examples">
        ${examples.map((example) => `<li>${escapeHtml(example)}</li>`).join("")}
      </ul>
      <a class="wm-admin-template-action" href="/admin/municipal-walk-maps?templateId=${encodeURIComponent(template.templateId)}">この型で始める</a>
    </article>
  `;
  }).join("");
  return `
<section class="wm-admin-template" data-walk-map-template-picker>
  <div>
    <h2>テンプレート</h2>
    <p>調査済み自治体マップの型から初期値を選びます。出典PDFの再配布ではなく、作成時の型として使います。</p>
  </div>
  <select name="templateId" aria-label="散策マップテンプレート">
    ${options}
  </select>
  <div class="wm-admin-template-grid">${cards}</div>
</section>`;
}

function primaryTypeLabel(type: MunicipalWalkMapSourceCatalogEntryV0["primaryType"]): string {
  if (type === "walk_route_species_map") return "散策コース";
  if (type === "species_distribution_map") return "分布マップ";
  if (type === "citizen_science_report") return "市民参加";
  return "記入シート";
}

function renderSourceCatalogPanel(
  sources: MunicipalWalkMapSourceCatalogEntryV0[],
  selectedTemplateId: string,
  selectedSourceId: string,
): string {
  const scopeText = selectedTemplateId
    ? "選択中の型に近い自治体事例です。引用元として開き、PDF本文や図版は転載せず、立ち寄り先・安全メモ・記録項目へ置き換えます。"
    : "調査済みの自治体事例です。型を選ぶと関連する事例に絞れます。";
  const cards = sources.map((source) => `
    <article class="wm-admin-source-card${source.sourceId === selectedSourceId ? " is-selected" : ""}" data-source-template-id="${escapeHtml(source.templateId)}">
      <div class="wm-admin-source-meta">
        <span>${escapeHtml(primaryTypeLabel(source.primaryType))}</span>
        <span>${escapeHtml(source.municipality)}</span>
        <span>${escapeHtml(String(source.affinityScore))}</span>
      </div>
      <strong>${escapeHtml(source.title)}</strong>
      <small>${escapeHtml(source.cue)}</small>
      <div class="wm-admin-source-actions">
        <a class="wm-admin-source-draft" href="/admin/municipal-walk-maps?sourceId=${encodeURIComponent(source.sourceId)}">下書きに入れる</a>
        <button type="button" data-add-source-reference data-source-label="${escapeHtml(source.title)}" data-source-url="${escapeHtml(source.officialPageUrl)}" data-source-note="PDF本文や図版は転載しない">引用元へ</button>
        <a href="${escapeHtml(source.officialPageUrl)}" target="_blank" rel="noopener noreferrer">公式ページを開く</a>
      </div>
    </article>
  `).join("");
  return `
<section class="wm-admin-template" data-walk-map-source-catalog>
  <div>
    <h2>参考元カタログ</h2>
    <p>${escapeHtml(scopeText)}</p>
  </div>
  <div class="wm-admin-source-grid">${cards}</div>
</section>`;
}

function formVerificationStatusFromCreator(creator: MunicipalWalkMapCreatorRegistryEntryV0): MunicipalWalkMapConfigV0["creatorProfile"]["verificationStatus"] {
  return creator.verificationStatus === "verified" ? "verified" : "pending";
}

function renderCreatorPickerOptions(creators: MunicipalWalkMapCreatorRegistryEntryV0[], currentCreatorId: string | null | undefined): string {
  const current = currentCreatorId ?? "";
  return [
    `<option value="">未選択</option>`,
    ...creators.map((creator) => {
      const status = formVerificationStatusFromCreator(creator);
      return `<option value="${escapeHtml(creator.creatorId)}" ${creator.creatorId === current ? "selected" : ""} data-display-name="${escapeHtml(creator.displayName)}" data-registration-kind="${escapeHtml(creator.registrationKind)}" data-verification-status="${escapeHtml(status)}" data-commercial-intent="${escapeHtml(creator.commercialIntent)}">${escapeHtml(creator.displayName)} / ${escapeHtml(creator.creatorId)}</option>`;
    }),
  ].join("");
}

function isVerifiedRouteCreatorProfile(config: MunicipalWalkMapConfigV0): boolean {
  const profile = config.creatorProfile;
  return Boolean(profile.creatorId)
    && profile.verificationStatus === "verified"
    && (profile.registrationKind === "municipality"
      || profile.registrationKind === "registered_group"
      || profile.registrationKind === "registered_company")
    && profile.commercialIntent !== "primary";
}

function renderAdminPublicationGate(config: MunicipalWalkMapConfigV0): string {
  const validation = validateMunicipalWalkMapConfigV0(config);
  const review = config.publicationReview ?? {
    publicAccessAttested: false,
    sourceRightsAttested: false,
    permissionAttestedBy: null,
    permissionAttestedAt: null,
    publishApprovedByUserId: null,
    publishApprovedAt: null,
    emergencyHidden: false,
    takedownReason: null,
  };
  const verifiedCreator = isVerifiedRouteCreatorProfile(config);
  const sourceReady = config.sourceReferences.length > 0 && review.sourceRightsAttested;
  const accessReady = review.publicAccessAttested && !validation.blockedStopIds.length && !review.emergencyHidden;
  const approvalReady = Boolean(review.publishApprovedByUserId && review.publishApprovedAt);
  const items = [
    {
      ready: verifiedCreator,
      label: "作成者",
      text: "自治体・登録団体・登録会社の確認済み登録だけが公開できます。商業主目的は公開不可です。",
    },
    {
      ready: config.routeFlexibility.routeStyle !== "suggested_order" || verifiedCreator,
      label: "おすすめ表示",
      text: "確認済み登録者だけが使えます。外れて歩く使い方は止めません。",
    },
    {
      ready: sourceReady,
      label: "引用元",
      text: "公式ページURLを残し、PDF本文・図版・写真は転載しません。",
    },
    {
      ready: accessReady,
      label: "公開範囲",
      text: "学校、私有地、未確認、希少種文脈は公開前に止まります。",
    },
    {
      ready: approvalReady,
      label: "公開前レビュー",
      text: "公開承認者と日付が入るまで公開モードでは保存できません。",
    },
  ];
  const status = validation.ok ? "保存可能" : "確認が必要";
  return `
  <section class="wm-admin-gate" data-walk-map-publication-gate data-gate-status="${escapeHtml(validation.ok ? "ready" : "needs_review")}">
    <div>
      <h2>公開チェック</h2>
      <p>${escapeHtml(status)}。DB保存時も同じ条件で判定します。</p>
    </div>
    <div class="wm-admin-gate-grid">
      ${items.map((item) => `
        <div class="wm-admin-gate-item${item.ready ? " is-ready" : ""}">
          <strong>${escapeHtml(item.label)}</strong>
          <span>${escapeHtml(item.text)}</span>
        </div>
      `).join("")}
    </div>
    ${validation.errors.length ? `<p class="wm-admin-gate-errors">${escapeHtml(validation.errors.slice(0, 8).join(" / "))}</p>` : ""}
  </section>`;
}

function renderWalkMapAdminBody(
  config: MunicipalWalkMapConfigV0,
  source: "db" | "static" | "new" | "template" | "source_catalog",
  selectedTemplateId = "",
  selectedSourceId = "",
  creators: MunicipalWalkMapCreatorRegistryEntryV0[] = [],
  creatorLoadError = "",
): string {
  const claimBoundary = textareaValue(config.claimBoundary);
  const publicationReview: MunicipalWalkMapPublicationReviewV0 = config.publicationReview ?? {
    publicAccessAttested: false,
    sourceRightsAttested: false,
    permissionAttestedBy: null,
    permissionAttestedAt: null,
    publishApprovedByUserId: null,
    publishApprovedAt: null,
    emergencyHidden: false,
    takedownReason: null,
  };
  const stopCount = Math.max(3, config.routeStops.length);
  const stops = Array.from({ length: stopCount }, (_, index) => renderStopFields(config.routeStops[index], index)).join("");
  const templates = listMunicipalWalkMapTemplatesV0();
  const allSourceCatalog = listMunicipalWalkMapSourceCatalogV0();
  const sourceCatalog = listMunicipalWalkMapSourceCatalogV0({ templateId: selectedTemplateId || undefined });
  const creatorLoadWarning = creatorLoadError
    ? `<section class="wm-panel wm-warnings"><h2>作成者登録</h2><p class="wm-muted">作成者一覧を読み込めませんでした。登録IDの保存時確認はAPI側で行います。</p></section>`
    : "";
  return `
<main class="wm-admin-wrap">
  <header class="wm-admin-top">
    <div>
      <h1>散策マップ管理</h1>
      <p>公開範囲、立入条件、場所の出し方を確認しながら、地域の散策マップを作成します。学校、私有地、未確認の場所は公開前に止まります。</p>
    </div>
    <div class="wm-admin-links">
      <a class="wm-admin-link" href="/admin/municipal-walk-maps">新規</a>
      <a class="wm-admin-link" href="/admin/municipal-walk-map-creators">作成者登録</a>
      <a class="wm-admin-link" href="/admin/municipal-walk-map-reviews">審査</a>
      <a class="wm-admin-link" href="/walk-maps/${encodeURIComponent(config.walkMapId)}">プレビュー</a>
    </div>
  </header>
  ${renderTemplatePicker(templates, selectedTemplateId, allSourceCatalog)}
  ${renderSourceCatalogPanel(sourceCatalog, selectedTemplateId, selectedSourceId)}
  ${creatorLoadWarning}
  ${renderAdminPublicationGate(config)}
  <form class="wm-admin-form" data-walk-map-form data-source="${escapeHtml(source)}">
    <div class="wm-admin-fields">
      <label>walk map id<input name="walkMapId" value="${escapeHtml(config.walkMapId)}" placeholder="jp-shizuoka-park-walk-202606" required></label>
      <label>自治体・地域<input name="municipality" value="${escapeHtml(config.municipality)}" placeholder="静岡市" required></label>
      <label>登録済み作成者<select name="creatorRegistryPick" data-walk-map-creator-select>
        ${renderCreatorPickerOptions(creators, config.creatorProfile.creatorId)}
      </select></label>
      <label>作成者<input name="creatorName" value="${escapeHtml(config.creatorName)}" placeholder="環境政策課" required></label>
      <label>登録ID<input name="creatorId" value="${escapeHtml(config.creatorProfile.creatorId ?? "")}" placeholder="municipality:shizuoka-city"></label>
      <label>登録種別<select name="registrationKind">
        ${option("unknown", config.creatorProfile.registrationKind, "未確認")}
        ${option("municipality", config.creatorProfile.registrationKind, "自治体")}
        ${option("registered_group", config.creatorProfile.registrationKind, "登録団体")}
        ${option("registered_company", config.creatorProfile.registrationKind, "登録会社")}
        ${option("individual", config.creatorProfile.registrationKind, "個人")}
      </select></label>
      <label>確認状態<select name="verificationStatus">
        ${option("pending", config.creatorProfile.verificationStatus, "確認待ち")}
        ${option("verified", config.creatorProfile.verificationStatus, "確認済み")}
        ${option("self_declared", config.creatorProfile.verificationStatus, "自己申告")}
      </select></label>
      <label>商業色<select name="commercialIntent">
        ${option("none", config.creatorProfile.commercialIntent, "なし")}
        ${option("limited", config.creatorProfile.commercialIntent, "一部あり")}
        ${option("primary", config.creatorProfile.commercialIntent, "主目的")}
      </select></label>
      <label class="wm-admin-wide">タイトル<input name="title" value="${escapeHtml(config.title)}" placeholder="身近な自然を歩く散策マップ" required></label>
      <label class="wm-admin-wide">概要<textarea name="summary" rows="3" maxlength="240" required>${escapeHtml(config.summary)}</textarea></label>
      <label>テーマ<select name="theme">
        ${option("seasonal_walk", config.theme, "季節の散策")}
        ${option("waterfront", config.theme, "水辺")}
        ${option("park_walk", config.theme, "公園・緑地")}
        ${option("satoyama", config.theme, "里山")}
        ${option("city_nature", config.theme, "まちなか自然")}
        ${option("school_learning", config.theme, "学習利用")}
      </select></label>
      <label>公開状態<select name="publishMode">
        ${option("draft", config.publishMode, "下書き")}
        ${option("public_preview", config.publishMode, "公開プレビュー")}
        ${option("public", config.publishMode, "公開中")}
      </select></label>
      <label>立ち寄り方<select name="routeStyle">
        ${option("loose_stops", config.routeFlexibility.routeStyle, "立ち寄り先で作る")}
        ${option("suggested_order", config.routeFlexibility.routeStyle, "おすすめ表示")}
        ${option("free_area", config.routeFlexibility.routeStyle, "範囲内で自由")}
      </select></label>
      <label>移動手段<input name="mobilityModes" value="${escapeHtml(config.routeFlexibility.mobilityModes.join(", "))}" placeholder="walk, bike, car, motorbike"></label>
      <label>外れたとき<select name="offRoutePolicy">
        ${option("off_route_allowed", config.routeFlexibility.offRoutePolicy, "公開範囲で使う")}
        ${option("stay_near_public_path", config.routeFlexibility.offRoutePolicy, "公開された道の近くで")}
        ${option("guide_only", config.routeFlexibility.offRoutePolicy, "案内として使う")}
      </select></label>
      <label>場所の出し方<select name="publicPrecisionPolicy">
        ${option("site_or_coarser", config.publicPrecisionPolicy, "場所単位以上")}
        ${option("mesh_or_coarser", config.publicPrecisionPolicy, "メッシュ以上")}
        ${option("municipality_or_hidden", config.publicPrecisionPolicy, "自治体単位または非表示")}
      </select></label>
      <label>自治体コード<input name="municipalityCodes" value="${escapeHtml(config.areaScope.municipalityCodes.join(", "))}" placeholder="22100"></label>
      <label>place ids<input name="placeIds" value="${escapeHtml(config.areaScope.placeIds.join(", "))}" placeholder="place_..."></label>
      <label>polygon ids<input name="polygonIds" value="${escapeHtml(config.areaScope.polygonIds.join(", "))}" placeholder="poly_..."></label>
      <label class="wm-admin-wide">戻る手がかり<textarea name="returnCues" rows="3" placeholder="大きな通りへ戻る&#10;入口や案内板を目印にする">${escapeHtml(textareaValue(config.routeFlexibility.returnCues))}</textarea></label>
      <label class="wm-admin-wide">扱いの範囲<textarea name="claimBoundary" rows="4">${escapeHtml(claimBoundary)}</textarea></label>
      <label class="wm-admin-wide">引用元<textarea name="sourceReferences" rows="3" placeholder="静岡市 いきもの散策マップ | https://www.city.shizuoka.lg.jp/s6347/s001494.html | PDF本文や図版は転載しない">${escapeHtml(sourceReferencesValue(config.sourceReferences))}</textarea></label>
      <label><input type="checkbox" name="publicAccessAttested" ${publicationReview.publicAccessAttested ? "checked" : ""}> 公開範囲と立入条件を確認済み</label>
      <label><input type="checkbox" name="sourceRightsAttested" ${publicationReview.sourceRightsAttested ? "checked" : ""}> PDF本文・図版・写真を転載していない</label>
      <label>許可確認者<input name="permissionAttestedBy" value="${escapeHtml(publicationReview.permissionAttestedBy ?? "")}" placeholder="環境政策課 / 管理団体名"></label>
      <label>許可確認日<input name="permissionAttestedAt" value="${escapeHtml(publicationReview.permissionAttestedAt ?? "")}" placeholder="2026-06-24"></label>
      <label>公開承認者<input name="publishApprovedByUserId" value="${escapeHtml(publicationReview.publishApprovedByUserId ?? "")}" placeholder="admin-user-id"></label>
      <label>公開承認日<input name="publishApprovedAt" value="${escapeHtml(publicationReview.publishApprovedAt ?? "")}" placeholder="2026-06-24"></label>
      <label><input type="checkbox" name="emergencyHidden" ${publicationReview.emergencyHidden ? "checked" : ""}> 緊急非公開</label>
      <label class="wm-admin-wide">非公開理由<textarea name="takedownReason" rows="2" placeholder="公開範囲の再確認など">${escapeHtml(publicationReview.takedownReason ?? "")}</textarea></label>
    </div>
    <section data-walk-map-stops>
      ${stops}
    </section>
    <div class="wm-admin-stop-actions">
      <button type="button" data-walk-map-add-stop>立ち寄り先を追加</button>
    </div>
    <section class="wm-admin-draft-export">
      <div>
        <h2>下書きJSON</h2>
        <p>DBに保存する前に、作成中の内容を確認・レビューできます。公式PDFの本文や図版は入れず、引用元URLと作成内容だけを扱います。</p>
      </div>
      <div class="wm-admin-draft-tools">
        <button type="button" data-walk-map-refresh-draft-json>JSONを作る</button>
        <button type="button" data-walk-map-import-draft-json>JSONを読み込む</button>
        <button type="button" data-walk-map-preview-draft>保存せずプレビュー</button>
        <button type="button" data-walk-map-copy-draft-json>コピー</button>
        <span class="wm-admin-result" data-walk-map-draft-json-result></span>
      </div>
      <textarea name="draftJson" data-walk-map-draft-json spellcheck="false" aria-label="散策マップ下書きJSON"></textarea>
    </section>
    <div class="wm-admin-actions">
      <button type="submit">保存</button>
      <span class="wm-admin-result" data-walk-map-result></span>
    </div>
  </form>
</main>
<script>${ADMIN_WALK_MAP_SCRIPT}</script>`;
}

function renderCreatorRegistryAdminBody(creators: MunicipalWalkMapCreatorRegistryEntryV0[]): string {
  const creatorList = creators.length
    ? creators.map((creator) => `
      <article class="wm-creator-item">
        <strong>${escapeHtml(creator.displayName)}</strong>
        <span>${escapeHtml(creator.creatorId)} / ${escapeHtml(creator.registrationKind)} / ${escapeHtml(creator.verificationStatus)} / ${escapeHtml(creator.commercialIntent)}</span>
        ${creator.notes ? `<span>${escapeHtml(creator.notes)}</span>` : ""}
      </article>`).join("")
    : `<p class="wm-muted">登録済みの作成者はまだありません。</p>`;
  return `
<main class="wm-admin-wrap">
  <header class="wm-admin-top">
    <div>
      <h1>散策マップ作成者登録</h1>
      <p>おすすめ表示を使える作成者を、自治体・登録団体・登録会社に限定して管理します。商業主目的の登録は確認済みにしません。</p>
    </div>
    <div class="wm-admin-links">
      <a class="wm-admin-link" href="/admin/municipal-walk-maps">散策マップ管理</a>
    </div>
  </header>
  <form class="wm-admin-form" data-walk-map-creator-form>
    <div class="wm-admin-fields">
      <label>登録ID<input name="creatorId" placeholder="group:local-nature-club" required></label>
      <label>表示名<input name="displayName" placeholder="地域自然観察会" required></label>
      <label>登録種別<select name="registrationKind">
        ${option("registered_group", "registered_group", "登録団体")}
        ${option("municipality", "registered_group", "自治体")}
        ${option("registered_company", "registered_group", "登録会社")}
      </select></label>
      <label>確認状態<select name="verificationStatus">
        ${option("pending", "pending", "確認待ち")}
        ${option("verified", "pending", "確認済み")}
        ${option("revoked", "pending", "失効")}
      </select></label>
      <label>商業色<select name="commercialIntent">
        ${option("none", "none", "なし")}
        ${option("limited", "none", "一部あり")}
        ${option("primary", "none", "主目的")}
      </select></label>
      <label class="wm-admin-wide">メモ<textarea name="notes" rows="3" placeholder="確認元、担当者、範囲など"></textarea></label>
    </div>
    <div class="wm-admin-actions">
      <button type="submit">登録</button>
      <span class="wm-admin-result" data-walk-map-creator-result></span>
    </div>
  </form>
  <section class="wm-admin-template">
    <h2>登録済み</h2>
    <div class="wm-creator-list">${creatorList}</div>
  </section>
</main>
<script>${ADMIN_WALK_MAP_SCRIPT}</script>`;
}

function publishModeAdminLabel(mode: MunicipalWalkMapConfigV0["publishMode"]): string {
  if (mode === "public") return "公開中";
  if (mode === "public_preview") return "公開プレビュー";
  return "下書き";
}

function creatorKindAdminLabel(kind: MunicipalWalkMapConfigV0["creatorProfile"]["registrationKind"]): string {
  if (kind === "municipality") return "自治体";
  if (kind === "registered_group") return "登録団体";
  if (kind === "registered_company") return "登録会社";
  if (kind === "individual") return "個人";
  return "未確認";
}

function renderReviewQueueBody(items: MunicipalWalkMapReviewQueueItemV0[], error = ""): string {
  const list = error
    ? `<section class="wm-panel wm-warnings"><h2>審査キュー</h2><p class="wm-muted">DB適用後に一覧を表示できます。${escapeHtml(error)}</p></section>`
    : items.length
      ? `<div class="wm-review-list">${items.map((item) => {
        const reasons = item.reviewRequired.slice(0, 6);
        return `
        <article class="wm-review-item${item.readyForPublicMode ? " is-ready" : ""}">
          <div class="wm-review-head">
            <div>
              <h2>${escapeHtml(item.title)}</h2>
              <p class="wm-muted">${escapeHtml(item.municipality)} / ${escapeHtml(item.creatorName)}</p>
            </div>
            <strong>${escapeHtml(item.readyForPublicMode ? "公開確認済み" : "確認が必要")}</strong>
          </div>
          <div class="wm-review-meta">
            <span>${escapeHtml(publishModeAdminLabel(item.publishMode))}</span>
            <span>${escapeHtml(creatorKindAdminLabel(item.creatorProfile.registrationKind))}</span>
            <span>${escapeHtml(item.creatorProfile.verificationStatus)}</span>
            <span>立ち寄り先 ${escapeHtml(String(item.stopCount))}</span>
            <span>引用元 ${escapeHtml(String(item.sourceReferenceCount))}</span>
          </div>
          ${reasons.length ? `<ul class="wm-review-reasons">${reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>` : `<p class="wm-muted">公開モードへ進められる状態です。</p>`}
          <div class="wm-review-actions">
            <a href="${escapeHtml(item.editHref)}">編集</a>
            <a href="${escapeHtml(item.previewHref)}">プレビュー</a>
            <form data-walk-map-review-action-form data-walk-map-id="${escapeHtml(item.walkMapId)}">
              <input type="hidden" name="action" value="approve_public_preview">
              <button type="submit" data-review-action="approve_public_preview">公開プレビューへ</button>
            </form>
            <form data-walk-map-review-action-form data-walk-map-id="${escapeHtml(item.walkMapId)}">
              <input type="hidden" name="action" value="request_changes">
              <button type="submit" data-review-action="request_changes">修正待ち</button>
            </form>
            <form data-walk-map-review-action-form data-walk-map-id="${escapeHtml(item.walkMapId)}">
              <input type="hidden" name="action" value="emergency_hide">
              <button type="submit" data-review-action="emergency_hide">非公開</button>
            </form>
          </div>
          <div class="wm-review-result" data-walk-map-review-result></div>
        </article>`;
      }).join("")}</div>`
      : `<p class="wm-muted">審査待ちの散策マップはありません。</p>`;
  return `
<main class="wm-admin-wrap">
  <header class="wm-admin-top">
    <div>
      <h1>散策マップ審査</h1>
      <p>自治体・登録団体・登録会社が作る散策マップを、公開前に確認します。公開範囲、引用元、作成者登録、場所の出し方をここで見ます。</p>
    </div>
    <div class="wm-admin-links">
      <a class="wm-admin-link" href="/admin/municipal-walk-maps">散策マップ管理</a>
      <a class="wm-admin-link" href="/admin/municipal-walk-map-creators">作成者登録</a>
    </div>
  </header>
  ${list}
</main>`;
}

function blankWalkMapConfig(): MunicipalWalkMapConfigV0 {
  return {
    schemaVersion: "municipal_walk_map_config/v0",
    walkMapId: "",
    municipality: "",
    creatorName: "",
    creatorProfile: {
      creatorId: null,
      registrationKind: "unknown",
      verificationStatus: "pending",
      commercialIntent: "none",
    },
    title: "",
    summary: "",
    theme: "seasonal_walk",
    publishMode: "draft",
    areaScope: { municipalityCodes: [], placeIds: [], polygonIds: [] },
    routeStops: [
      {
        stopId: "start",
        title: "",
        areaKind: "park",
        linkedFieldId: null,
        access: "public_access",
        estimatedMinutes: 20,
        noticeCues: [],
        recordCues: [],
        safetyNotes: [],
      },
    ],
    recordModes: ["photo", "memo", "unknown_species"],
    routeFlexibility: {
      routeStyle: "loose_stops",
      mobilityModes: ["walk", "bike", "public_transport"],
      offRoutePolicy: "off_route_allowed",
      returnCues: ["案内板や大きな通りを目印に戻る"],
    },
    publicPrecisionPolicy: "mesh_or_coarser",
    claimBoundary: [
      "公式調査結果ではなく、散策マップとして扱います。",
      "学校、私有地、立入不明の場所は公開前に確認します。",
      "希少種、自宅付近、未成年が推測される情報は場所の出し方を落とします。",
    ],
    sourceReferences: [],
    publicationReview: {
      publicAccessAttested: false,
      sourceRightsAttested: false,
      permissionAttestedBy: null,
      permissionAttestedAt: null,
      publishApprovedByUserId: null,
      publishApprovedAt: null,
      emergencyHidden: false,
      takedownReason: null,
    },
  };
}

function newWalkMapConfigFromTemplate(
  templateId: string | undefined,
  sourceId?: string,
): { config: MunicipalWalkMapConfigV0; source: "new" | "template" | "source_catalog"; selectedTemplateId: string; selectedSourceId: string } {
  const selectedSourceId = String(sourceId ?? "").trim();
  if (selectedSourceId) {
    try {
      const config = buildMunicipalWalkMapConfigFromSourceCatalogV0(selectedSourceId);
      return {
        config,
        source: "source_catalog",
        selectedTemplateId: "",
        selectedSourceId,
      };
    } catch {
      return { config: blankWalkMapConfig(), source: "new", selectedTemplateId: "", selectedSourceId: "" };
    }
  }
  const selectedTemplateId = String(templateId ?? "").trim();
  if (!selectedTemplateId) return { config: blankWalkMapConfig(), source: "new", selectedTemplateId: "", selectedSourceId: "" };
  try {
    return {
      config: buildMunicipalWalkMapConfigFromTemplateV0(selectedTemplateId),
      source: "template",
      selectedTemplateId,
      selectedSourceId: "",
    };
  } catch {
    return { config: blankWalkMapConfig(), source: "new", selectedTemplateId: "", selectedSourceId: "" };
  }
}

const ADMIN_WALK_MAP_SCRIPT = `
document.addEventListener("change", function(event) {
  var select = event.target.closest("[data-walk-map-template-picker] select[name='templateId']");
  if (!select) return;
  var templateId = String(select.value || "").trim();
  var url = new URL(window.location.href);
  if (templateId) url.searchParams.set("templateId", templateId);
  else url.searchParams.delete("templateId");
  window.location.href = url.pathname + url.search;
});
document.addEventListener("change", function(event) {
  var select = event.target.closest("[data-walk-map-creator-select]");
  if (!select) return;
  var form = select.closest("[data-walk-map-form]");
  var option = select.selectedOptions && select.selectedOptions[0];
  if (!form || !option) return;
  var creatorId = String(option.value || "").trim();
  var setField = function(name, value) {
    var field = form.querySelector("[name='" + name + "']");
    if (field) field.value = value;
  };
  setField("creatorId", creatorId);
  if (!creatorId) return;
  setField("creatorName", option.dataset.displayName || "");
  setField("registrationKind", option.dataset.registrationKind || "unknown");
  setField("verificationStatus", option.dataset.verificationStatus || "pending");
  setField("commercialIntent", option.dataset.commercialIntent || "none");
});
document.addEventListener("click", function(event) {
  var button = event.target.closest("[data-add-source-reference]");
  if (!button) return;
  var form = document.querySelector("[data-walk-map-form]");
  var field = form && form.querySelector("textarea[name='sourceReferences']");
  if (!field) return;
  var label = String(button.dataset.sourceLabel || "").trim();
  var url = String(button.dataset.sourceUrl || "").trim();
  var note = String(button.dataset.sourceNote || "").trim();
  if (!label || !url) return;
  var current = String(field.value || "").trim();
  if (current.indexOf(url) >= 0) {
    field.focus();
    return;
  }
  var line = [label, url, note].filter(Boolean).join(" | ");
  field.value = current ? current + "\\n" + line : line;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.focus();
});
function wmLines(value) {
  return String(value || "").split(/\\r?\\n|,/).map(function(item){ return item.trim(); }).filter(Boolean);
}
function wmSourceReferences(value) {
  var text = String(value || "").trim();
  if (!text) return [];
  try {
    var parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.map(function(item) {
        return {
          label: String(item && item.label || "").trim(),
          url: String(item && item.url || "").trim(),
          note: String(item && item.note || "").trim()
        };
      }).filter(function(item) { return item.label && item.url; });
    }
  } catch (_) {}
  return text.split(/\\r?\\n/).map(function(line) {
    var parts = line.split("|").map(function(item) { return item.trim(); });
    return { label: parts[0] || "", url: parts[1] || "", note: parts.slice(2).join(" | ") };
  }).filter(function(item) { return item.label && item.url; });
}
function wmStopPayload(data, index) {
  var prefix = "stop" + index;
  var stopId = String(data.get(prefix + "StopId") || "").trim();
  var title = String(data.get(prefix + "Title") || "").trim();
  if (!stopId && !title) return null;
  return {
    stopId: stopId,
    title: title,
    areaKind: String(data.get(prefix + "AreaKind") || "other"),
    linkedFieldId: String(data.get(prefix + "LinkedFieldId") || "").trim() || null,
    access: String(data.get(prefix + "Access") || "unknown"),
    sensitiveContext: String(data.get(prefix + "SensitiveContext") || "none"),
    estimatedMinutes: Number(data.get(prefix + "EstimatedMinutes") || 0) || null,
    noticeCues: wmLines(data.get(prefix + "NoticeCues")),
    recordCues: wmLines(data.get(prefix + "RecordCues")),
    safetyNotes: wmLines(data.get(prefix + "SafetyNotes")),
    internalMemo: String(data.get(prefix + "InternalMemo") || "").trim() || null
  };
}
function wmVisibleStopIndexes(form) {
  return Array.from(form.querySelectorAll("[data-stop-index]")).map(function(section) {
    return Number(section.getAttribute("data-stop-index") || "0");
  }).filter(function(index) { return Number.isFinite(index); });
}
function wmBlankStopSection(section) {
  Array.from(section.querySelectorAll("input, textarea")).forEach(function(field) {
    field.value = "";
  });
  Array.from(section.querySelectorAll("select")).forEach(function(field) {
    if (field.name.indexOf("AreaKind") >= 0) field.value = "street_edge";
    else if (field.name.indexOf("Access") >= 0) field.value = "public_access";
    else if (field.name.indexOf("SensitiveContext") >= 0) field.value = "none";
  });
}
function wmRenumberStops(form) {
  Array.from(form.querySelectorAll("[data-stop-index]")).forEach(function(section, index) {
    section.setAttribute("data-stop-index", String(index));
    var heading = section.querySelector("h2");
    if (heading) heading.textContent = "立ち寄り先 " + (index + 1);
    Array.from(section.querySelectorAll("[name]")).forEach(function(field) {
      field.name = String(field.name || "").replace(/^stop\\d+/, "stop" + index);
    });
    if (index === 0) {
      var stopId = section.querySelector("[name='stop0StopId']");
      if (stopId && !String(stopId.value || "").trim()) stopId.value = "start";
    }
  });
}
function wmEnsureStopSections(form, count) {
  var container = form.querySelector("[data-walk-map-stops]");
  if (!container) return;
  var desiredCount = Math.max(3, Number(count || 0));
  while (container.querySelectorAll("[data-stop-index]").length < desiredCount) {
    var source = container.querySelector("[data-stop-index]:last-of-type") || container.querySelector("[data-stop-index]");
    if (!source) break;
    var next = source.cloneNode(true);
    wmBlankStopSection(next);
    container.appendChild(next);
    wmRenumberStops(form);
  }
  while (container.querySelectorAll("[data-stop-index]").length > desiredCount) {
    var last = container.querySelector("[data-stop-index]:last-of-type");
    if (!last) break;
    last.remove();
  }
  wmRenumberStops(form);
}
function wmPayload(form) {
  var data = new FormData(form);
  var routeStops = wmVisibleStopIndexes(form).map(function(index){ return wmStopPayload(data, index); }).filter(Boolean);
  return {
    schemaVersion: "municipal_walk_map_config/v0",
    walkMapId: String(data.get("walkMapId") || "").trim(),
    municipality: String(data.get("municipality") || "").trim(),
    creatorName: String(data.get("creatorName") || "").trim(),
    creatorProfile: {
      creatorId: String(data.get("creatorId") || "").trim() || null,
      registrationKind: String(data.get("registrationKind") || "unknown"),
      verificationStatus: String(data.get("verificationStatus") || "pending"),
      commercialIntent: String(data.get("commercialIntent") || "none")
    },
    title: String(data.get("title") || "").trim(),
    summary: String(data.get("summary") || "").trim(),
    theme: String(data.get("theme") || "seasonal_walk"),
    publishMode: String(data.get("publishMode") || "draft"),
    areaScope: {
      municipalityCodes: wmLines(data.get("municipalityCodes")),
      placeIds: wmLines(data.get("placeIds")),
      polygonIds: wmLines(data.get("polygonIds"))
    },
    routeStops: routeStops,
    recordModes: ["photo", "memo", "unknown_species"],
    routeFlexibility: {
      routeStyle: String(data.get("routeStyle") || "loose_stops"),
      mobilityModes: wmLines(data.get("mobilityModes")),
      offRoutePolicy: String(data.get("offRoutePolicy") || "off_route_allowed"),
      returnCues: wmLines(data.get("returnCues"))
    },
    publicPrecisionPolicy: String(data.get("publicPrecisionPolicy") || "mesh_or_coarser"),
    claimBoundary: wmLines(data.get("claimBoundary")),
    sourceReferences: wmSourceReferences(data.get("sourceReferences")),
    publicationReview: {
      publicAccessAttested: data.get("publicAccessAttested") === "on",
      sourceRightsAttested: data.get("sourceRightsAttested") === "on",
      permissionAttestedBy: String(data.get("permissionAttestedBy") || "").trim() || null,
      permissionAttestedAt: String(data.get("permissionAttestedAt") || "").trim() || null,
      publishApprovedByUserId: String(data.get("publishApprovedByUserId") || "").trim() || null,
      publishApprovedAt: String(data.get("publishApprovedAt") || "").trim() || null,
      emergencyHidden: data.get("emergencyHidden") === "on",
      takedownReason: String(data.get("takedownReason") || "").trim() || null
    }
  };
}
document.addEventListener("click", function(event) {
  var addButton = event.target.closest("[data-walk-map-add-stop]");
  var removeButton = event.target.closest("[data-walk-map-remove-stop]");
  if (!addButton && !removeButton) return;
  var form = event.target.closest("[data-walk-map-form]");
  if (!form) return;
  if (addButton) {
    wmEnsureStopSections(form, wmVisibleStopIndexes(form).length + 1);
    var last = form.querySelector("[data-stop-index]:last-of-type input, [data-stop-index]:last-of-type textarea");
    if (last) last.focus();
    return;
  }
  var section = removeButton.closest("[data-stop-index]");
  if (!section) return;
  if (wmVisibleStopIndexes(form).length <= 3) {
    wmBlankStopSection(section);
  } else {
    section.remove();
  }
  wmRenumberStops(form);
});
function wmCreatorPayload(form) {
  var data = new FormData(form);
  return {
    schemaVersion: "municipal_walk_map_creator/v0",
    creatorId: String(data.get("creatorId") || "").trim(),
    displayName: String(data.get("displayName") || "").trim(),
    registrationKind: String(data.get("registrationKind") || "registered_group"),
    verificationStatus: String(data.get("verificationStatus") || "pending"),
    commercialIntent: String(data.get("commercialIntent") || "none"),
    notes: String(data.get("notes") || "").trim()
  };
}
function wmDraftJsonText(form) {
  return JSON.stringify(wmPayload(form), null, 2);
}
function wmSetField(form, name, value) {
  var field = form.querySelector("[name='" + name + "']");
  if (!field) return;
  field.value = value == null ? "" : String(value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
}
function wmSetChecked(form, name, value) {
  var field = form.querySelector("[name='" + name + "']");
  if (!field) return;
  field.checked = Boolean(value);
  field.dispatchEvent(new Event("change", { bubbles: true }));
}
function wmJoinLines(items) {
  return Array.isArray(items) ? items.filter(Boolean).join("\\n") : "";
}
function wmSourceReferencesText(items) {
  return Array.isArray(items)
    ? items.map(function(ref) {
      return [ref && ref.label, ref && ref.url, ref && ref.note].filter(Boolean).join(" | ");
    }).filter(Boolean).join("\\n")
    : "";
}
function wmApplyDraftPayload(form, payload) {
  if (!payload || typeof payload !== "object") throw new Error("JSONの形式を確認してください");
  wmSetField(form, "walkMapId", payload.walkMapId || "");
  wmSetField(form, "municipality", payload.municipality || "");
  wmSetField(form, "creatorRegistryPick", "");
  wmSetField(form, "creatorName", payload.creatorName || "");
  wmSetField(form, "creatorId", payload.creatorProfile && payload.creatorProfile.creatorId || "");
  wmSetField(form, "registrationKind", payload.creatorProfile && payload.creatorProfile.registrationKind || "unknown");
  wmSetField(form, "verificationStatus", payload.creatorProfile && payload.creatorProfile.verificationStatus || "pending");
  wmSetField(form, "commercialIntent", payload.creatorProfile && payload.creatorProfile.commercialIntent || "none");
  wmSetField(form, "title", payload.title || "");
  wmSetField(form, "summary", payload.summary || "");
  wmSetField(form, "theme", payload.theme || "seasonal_walk");
  wmSetField(form, "publishMode", payload.publishMode || "draft");
  wmSetField(form, "routeStyle", payload.routeFlexibility && payload.routeFlexibility.routeStyle || "loose_stops");
  wmSetField(form, "mobilityModes", Array.isArray(payload.routeFlexibility && payload.routeFlexibility.mobilityModes) ? payload.routeFlexibility.mobilityModes.join(", ") : "");
  wmSetField(form, "offRoutePolicy", payload.routeFlexibility && payload.routeFlexibility.offRoutePolicy || "off_route_allowed");
  wmSetField(form, "returnCues", wmJoinLines(payload.routeFlexibility && payload.routeFlexibility.returnCues));
  wmSetField(form, "publicPrecisionPolicy", payload.publicPrecisionPolicy || "mesh_or_coarser");
  wmSetField(form, "municipalityCodes", Array.isArray(payload.areaScope && payload.areaScope.municipalityCodes) ? payload.areaScope.municipalityCodes.join(", ") : "");
  wmSetField(form, "placeIds", Array.isArray(payload.areaScope && payload.areaScope.placeIds) ? payload.areaScope.placeIds.join(", ") : "");
  wmSetField(form, "polygonIds", Array.isArray(payload.areaScope && payload.areaScope.polygonIds) ? payload.areaScope.polygonIds.join(", ") : "");
  wmSetField(form, "claimBoundary", wmJoinLines(payload.claimBoundary));
  wmSetField(form, "sourceReferences", wmSourceReferencesText(payload.sourceReferences));
  var review = payload.publicationReview || {};
  wmSetChecked(form, "publicAccessAttested", review.publicAccessAttested);
  wmSetChecked(form, "sourceRightsAttested", review.sourceRightsAttested);
  wmSetField(form, "permissionAttestedBy", review.permissionAttestedBy || "");
  wmSetField(form, "permissionAttestedAt", review.permissionAttestedAt || "");
  wmSetField(form, "publishApprovedByUserId", review.publishApprovedByUserId || "");
  wmSetField(form, "publishApprovedAt", review.publishApprovedAt || "");
  wmSetChecked(form, "emergencyHidden", review.emergencyHidden);
  wmSetField(form, "takedownReason", review.takedownReason || "");
  var stops = Array.isArray(payload.routeStops) ? payload.routeStops : [];
  wmEnsureStopSections(form, stops.length);
  for (var index = 0; index < Math.max(3, stops.length); index += 1) {
    var stop = stops[index] || null;
    var prefix = "stop" + index;
    wmSetField(form, prefix + "StopId", stop && stop.stopId || (index === 0 ? "start" : ""));
    wmSetField(form, prefix + "Title", stop && stop.title || "");
    wmSetField(form, prefix + "EstimatedMinutes", stop && stop.estimatedMinutes != null ? stop.estimatedMinutes : "");
    wmSetField(form, prefix + "AreaKind", stop && stop.areaKind || (index === 0 ? "park" : "street_edge"));
    wmSetField(form, prefix + "Access", stop && stop.access || "public_access");
    wmSetField(form, prefix + "SensitiveContext", stop && stop.sensitiveContext || "none");
    wmSetField(form, prefix + "LinkedFieldId", stop && stop.linkedFieldId || "");
    wmSetField(form, prefix + "NoticeCues", wmJoinLines(stop && stop.noticeCues));
    wmSetField(form, prefix + "RecordCues", wmJoinLines(stop && stop.recordCues));
    wmSetField(form, prefix + "SafetyNotes", wmJoinLines(stop && stop.safetyNotes));
    wmSetField(form, prefix + "InternalMemo", stop && stop.internalMemo || "");
  }
}
function wmEscapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function(ch) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] || ch;
  });
}
function wmDraftList(items) {
  return Array.isArray(items) && items.length
    ? items.map(function(item) { return "<li>" + wmEscapeHtml(item) + "</li>"; }).join("")
    : "<li>未設定</li>";
}
function wmDraftPreviewHtml(payload) {
  var stops = (Array.isArray(payload.routeStops) ? payload.routeStops : []).map(function(stop, index) {
    return '<article class="wm-stop">'
      + '<div class="wm-stop-head"><h2>' + (index + 1) + '. ' + wmEscapeHtml(stop.title || stop.stopId || "立ち寄り先") + '</h2>'
      + '<span class="wm-access">' + wmEscapeHtml(stop.access || "unknown") + '</span></div>'
      + '<div class="wm-cues"><section class="wm-cue"><strong>見るもの</strong><ul>' + wmDraftList(stop.noticeCues) + '</ul></section>'
      + '<section class="wm-cue"><strong>残すもの</strong><ul>' + wmDraftList(stop.recordCues) + '</ul></section></div>'
      + '</article>';
  }).join("");
  var sources = (Array.isArray(payload.sourceReferences) ? payload.sourceReferences : []).map(function(ref) {
    return '<li><a href="' + wmEscapeHtml(ref.url) + '" target="_blank" rel="noopener noreferrer">' + wmEscapeHtml(ref.label) + '</a>'
      + (ref.note ? '<small>' + wmEscapeHtml(ref.note) + '</small>' : '') + '</li>';
  }).join("");
  return '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>' + wmEscapeHtml(payload.title || "散策マップ下書き") + ' — ikimon.life</title>'
    + '<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;color:#17211d;background:#f8fafc}.wm-shell{max-width:1120px;margin:0 auto;padding:28px 18px 72px}.wm-hero{display:grid;gap:10px;margin-bottom:18px}.wm-eyebrow{margin:0;color:#0f766e;font-size:12px;font-weight:900}.wm-hero h1{margin:0;font-size:32px;line-height:1.15}.wm-lead{margin:0;color:#475569;line-height:1.7}.wm-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px}.wm-stops{display:grid;gap:12px}.wm-stop,.wm-panel{border:1px solid #dbe7e2;border-radius:8px;background:#fff;padding:14px}.wm-stop-head{display:flex;justify-content:space-between;gap:10px}.wm-stop h2,.wm-panel h2{margin:0 0 10px;color:#0f172a}.wm-access{font-size:11px;font-weight:900;color:#0f766e}.wm-cues{display:grid;grid-template-columns:1fr 1fr;gap:10px}.wm-cue{border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:10px}.wm-cue strong{font-size:12px}.wm-cue ul,.wm-panel ul{margin:6px 0 0;padding-left:18px;color:#475569;font-size:12px;line-height:1.7}.wm-sources a{color:#0f766e;font-weight:900;text-decoration:none}.wm-sources small{display:block;color:#64748b}@media(max-width:760px){.wm-grid,.wm-cues{grid-template-columns:1fr}}</style>'
    + '</head><body><main class="wm-shell"><section class="wm-hero"><p class="wm-eyebrow">' + wmEscapeHtml(payload.municipality || "") + ' / 下書き確認</p>'
    + '<h1>' + wmEscapeHtml(payload.title || "散策マップ下書き") + '</h1><p class="wm-lead">' + wmEscapeHtml(payload.summary || "") + '</p></section>'
    + '<section class="wm-grid"><div class="wm-stops">' + (stops || '<article class="wm-stop"><h2>立ち寄り先は未設定です</h2></article>') + '</div>'
    + '<aside class="wm-panel"><h2>確認事項</h2><ul><li>歩道、標識、施設のルール、天候、現地の状況を優先してください。</li><li>PDF本文、図版、写真は転載せず、公式ページURLを引用元として扱います。</li><li>学校、私有地、希少種、自宅付近の情報は公開前に出し方を確認します。</li></ul>'
    + (sources ? '<h2>引用元</h2><ul class="wm-sources">' + sources + '</ul>' : '') + '</aside></section></main></body></html>';
}
function wmRefreshDraftJson(form, message) {
  var field = form && form.querySelector("[data-walk-map-draft-json]");
  var result = form && form.querySelector("[data-walk-map-draft-json-result]");
  if (!field) return "";
  var text = wmDraftJsonText(form);
  field.value = text;
  if (message && result) result.textContent = message;
  return text;
}
document.addEventListener("click", async function(event) {
  var refreshButton = event.target.closest("[data-walk-map-refresh-draft-json]");
  var importButton = event.target.closest("[data-walk-map-import-draft-json]");
  var copyButton = event.target.closest("[data-walk-map-copy-draft-json]");
  var previewButton = event.target.closest("[data-walk-map-preview-draft]");
  if (!refreshButton && !importButton && !copyButton && !previewButton) return;
  var form = event.target.closest("[data-walk-map-form]");
  if (!form) return;
  var text = refreshButton ? wmRefreshDraftJson(form, "JSONを作りました") : String((form.querySelector("[data-walk-map-draft-json]") || {}).value || "");
  if (importButton) {
    var importResult = form.querySelector("[data-walk-map-draft-json-result]");
    try {
      wmApplyDraftPayload(form, JSON.parse(text));
      wmRefreshDraftJson(form, "JSONをフォームへ入れました");
    } catch (error) {
      if (importResult) importResult.textContent = error instanceof Error ? error.message : String(error);
    }
    return;
  }
  if (!text) text = wmRefreshDraftJson(form, "");
  if (previewButton) {
    var previewResult = form.querySelector("[data-walk-map-draft-json-result]");
    previewButton.disabled = true;
    if (previewResult) previewResult.textContent = "プレビューを作っています";
    try {
      var html = wmDraftPreviewHtml(JSON.parse(text));
      var blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      if (previewResult) previewResult.textContent = "プレビューを開きました";
      window.setTimeout(function(){ URL.revokeObjectURL(blobUrl); }, 60000);
    } catch (error) {
      if (previewResult) previewResult.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      previewButton.disabled = false;
    }
    return;
  }
  if (!copyButton) return;
  var field = form.querySelector("[data-walk-map-draft-json]");
  var result = form.querySelector("[data-walk-map-draft-json-result]");
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else if (field) {
      field.focus();
      field.select();
      document.execCommand("copy");
    }
    if (result) result.textContent = "コピーしました";
  } catch (error) {
    if (field) {
      field.focus();
      field.select();
    }
    if (result) result.textContent = "選択してコピーできます";
  }
});
document.addEventListener("submit", async function(event) {
  var reviewForm = event.target.closest("[data-walk-map-review-action-form]");
  if (reviewForm) {
    event.preventDefault();
    var reviewButton = reviewForm.querySelector("button[type='submit']");
    var reviewItem = reviewForm.closest(".wm-review-item");
    var reviewResult = reviewItem ? reviewItem.querySelector("[data-walk-map-review-result]") : null;
    var walkMapId = reviewForm.getAttribute("data-walk-map-id") || "";
    var actionField = reviewForm.querySelector("input[name='action']");
    var action = actionField ? actionField.value : "";
    reviewButton.disabled = true;
    if (reviewResult) reviewResult.textContent = "更新中...";
    try {
      var reviewRes = await fetch("/api/v1/admin/municipal-walk-map-reviews/" + encodeURIComponent(walkMapId) + "/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: action })
      });
      var reviewBody = await reviewRes.json().catch(function(){ return {}; });
      if (!reviewRes.ok || reviewBody.ok === false) throw new Error(reviewBody.error || "更新できませんでした");
      if (reviewResult) reviewResult.textContent = "更新しました";
      window.setTimeout(function(){ window.location.reload(); }, 350);
    } catch (error) {
      if (reviewResult) reviewResult.textContent = error instanceof Error ? error.message : String(error);
      reviewButton.disabled = false;
    }
    return;
  }
  var creatorForm = event.target.closest("[data-walk-map-creator-form]");
  if (creatorForm) {
    event.preventDefault();
    var creatorButton = creatorForm.querySelector("button[type='submit']");
    var creatorResult = creatorForm.querySelector("[data-walk-map-creator-result]");
    var creatorPayload = wmCreatorPayload(creatorForm);
    creatorButton.disabled = true;
    creatorResult.textContent = "登録中...";
    try {
      var creatorRes = await fetch("/api/v1/admin/municipal-walk-map-creators", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ creator: creatorPayload })
      });
      var creatorBody = await creatorRes.json().catch(function(){ return {}; });
      if (!creatorRes.ok || creatorBody.ok === false) throw new Error(creatorBody.error || "登録できませんでした");
      creatorResult.textContent = "登録しました";
      window.setTimeout(function(){ window.location.reload(); }, 350);
    } catch (error) {
      creatorResult.textContent = error instanceof Error ? error.message : String(error);
      creatorButton.disabled = false;
    }
    return;
  }
  var form = event.target.closest("[data-walk-map-form]");
  if (!form) return;
  event.preventDefault();
  var button = form.querySelector("button[type='submit']");
  var result = form.querySelector("[data-walk-map-result]");
  var payload = wmPayload(form);
  button.disabled = true;
  result.textContent = "保存中...";
  try {
    var endpoint = "/api/v1/admin/municipal-walk-maps";
    var res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ config: payload })
    });
    var body = await res.json().catch(function(){ return {}; });
    if (!res.ok || body.ok === false) throw new Error(body.error || "保存できませんでした");
    result.innerHTML = '保存しました <a href="/walk-maps/' + encodeURIComponent(payload.walkMapId) + '">プレビュー</a>';
  } catch (error) {
    result.textContent = error instanceof Error ? error.message : String(error);
    button.disabled = false;
  }
});
`;

export async function registerMunicipalWalkMapRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { templateId?: string; sourceId?: string } }>("/admin/municipal-walk-maps", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    reply.type("text/html; charset=utf-8");
    if (!session || session.banned || !isAdminOrAnalystRole(session.roleName, session.rankLabel)) {
      reply.code(403);
      return renderSiteDocument({
        basePath: "",
        title: "散策マップ管理 — ikimon.life",
        extraStyles: ADMIN_WALK_MAP_STYLES,
        body: adminLoginGate(),
      });
    }
    const templateConfig = newWalkMapConfigFromTemplate(request.query.templateId, request.query.sourceId);
    const creatorLoad = await listMunicipalWalkMapCreatorsV0()
      .then((creators) => ({ creators, error: "" }))
      .catch((error) => ({ creators: [] as MunicipalWalkMapCreatorRegistryEntryV0[], error: error instanceof Error ? error.message : "creator_list_failed" }));
    return renderSiteDocument({
      basePath: "",
      title: "散策マップ管理 — ikimon.life",
      extraStyles: ADMIN_WALK_MAP_STYLES,
      body: renderWalkMapAdminBody(
        templateConfig.config,
        templateConfig.source,
        templateConfig.selectedTemplateId,
        templateConfig.selectedSourceId,
        creatorLoad.creators,
        creatorLoad.error,
      ),
    });
  });

  app.get<{ Params: { walkMapId: string } }>("/admin/municipal-walk-maps/:walkMapId", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    reply.type("text/html; charset=utf-8");
    if (!session || session.banned || !isAdminOrAnalystRole(session.roleName, session.rankLabel)) {
      reply.code(403);
      return renderSiteDocument({
        basePath: "",
        title: "散策マップ管理 — ikimon.life",
        extraStyles: ADMIN_WALK_MAP_STYLES,
        body: adminLoginGate(),
      });
    }
    const loaded = await loadWalkMapConfig(request.params.walkMapId, { allowDraft: true, allowStaticFallback: true }).catch(() => null);
    if (!loaded) {
      reply.code(404);
      return renderSiteDocument({
        basePath: "",
        title: "散策マップ管理 — ikimon.life",
        extraStyles: ADMIN_WALK_MAP_STYLES,
        body: `<main class="wm-admin-wrap"><section class="wm-panel"><h1>散策マップが見つかりません</h1><p>マップIDを確認してください。</p></section></main>`,
      });
    }
    const creatorLoad = await listMunicipalWalkMapCreatorsV0()
      .then((creators) => ({ creators, error: "" }))
      .catch((error) => ({ creators: [] as MunicipalWalkMapCreatorRegistryEntryV0[], error: error instanceof Error ? error.message : "creator_list_failed" }));
    return renderSiteDocument({
      basePath: "",
      title: `${loaded.config.title || "散策マップ管理"} — ikimon.life`,
      extraStyles: ADMIN_WALK_MAP_STYLES,
      body: renderWalkMapAdminBody(loaded.config, loaded.source, "", "", creatorLoad.creators, creatorLoad.error),
    });
  });

  app.get("/admin/municipal-walk-map-creators", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    reply.type("text/html; charset=utf-8");
    if (!session || session.banned || !isAdminOrAnalystRole(session.roleName, session.rankLabel)) {
      reply.code(403);
      return renderSiteDocument({
        basePath: "",
        title: "散策マップ作成者登録 — ikimon.life",
        extraStyles: ADMIN_WALK_MAP_STYLES,
        body: adminLoginGate(),
      });
    }
    const creators = await listMunicipalWalkMapCreatorsV0();
    return renderSiteDocument({
      basePath: "",
      title: "散策マップ作成者登録 — ikimon.life",
      extraStyles: ADMIN_WALK_MAP_STYLES,
      body: renderCreatorRegistryAdminBody(creators),
    });
  });

  app.get("/admin/municipal-walk-map-reviews", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    reply.type("text/html; charset=utf-8");
    if (!session || session.banned || !isAdminOrAnalystRole(session.roleName, session.rankLabel)) {
      reply.code(403);
      return renderSiteDocument({
        basePath: "",
        title: "散策マップ審査 — ikimon.life",
        extraStyles: ADMIN_WALK_MAP_STYLES,
        body: adminLoginGate(),
      });
    }
    const queue = await listMunicipalWalkMapReviewQueueV0()
      .then((items) => ({ items, error: "" }))
      .catch((error) => ({ items: [] as MunicipalWalkMapReviewQueueItemV0[], error: error instanceof Error ? error.message : "review_queue_unavailable" }));
    return renderSiteDocument({
      basePath: "",
      title: "散策マップ審査 — ikimon.life",
      extraStyles: ADMIN_WALK_MAP_STYLES,
      body: renderReviewQueueBody(queue.items, queue.error),
    });
  });

  app.get("/api/v1/admin/municipal-walk-map-creators", async (request, reply) => {
    try {
      await assertMunicipalWalkMapAdminAccess(request);
      return { ok: true, creators: await listMunicipalWalkMapCreatorsV0() };
    } catch (error) {
      const message = error instanceof Error ? error.message : "municipal_walk_map_creator_list_failed";
      reply.code(adminErrorStatus(message));
      return { ok: false, error: message };
    }
  });

  app.post<{ Body: unknown }>("/api/v1/admin/municipal-walk-map-creators", async (request, reply) => {
    try {
      const access = await assertMunicipalWalkMapAdminAccess(request);
      const creator = assertValidCreatorForWrite(extractCreatorFromBody(request.body));
      const saved = await upsertMunicipalWalkMapCreatorV0(creator, access.actorUserId ?? "system_write_key");
      return reply.status(201).send({ ok: true, creator: saved });
    } catch (error) {
      const message = error instanceof Error ? error.message : "municipal_walk_map_creator_save_failed";
      reply.code(adminErrorStatus(message));
      return { ok: false, error: message };
    }
  });

  app.get("/api/v1/admin/municipal-walk-map-templates", async (request, reply) => {
    try {
      await assertMunicipalWalkMapAdminAccess(request);
      return { ok: true, templates: listMunicipalWalkMapTemplatesV0() };
    } catch (error) {
      const message = error instanceof Error ? error.message : "municipal_walk_map_template_read_failed";
      reply.code(adminErrorStatus(message));
      return { ok: false, error: message };
    }
  });

  app.get("/api/v1/admin/municipal-walk-map-reviews", async (request, reply) => {
    try {
      await assertMunicipalWalkMapAdminAccess(request);
      return { ok: true, items: await listMunicipalWalkMapReviewQueueV0() };
    } catch (error) {
      const message = error instanceof Error ? error.message : "municipal_walk_map_review_queue_failed";
      reply.code(adminErrorStatus(message));
      return { ok: false, error: message };
    }
  });

  app.post<{ Params: { walkMapId: string }; Body: unknown }>("/api/v1/admin/municipal-walk-map-reviews/:walkMapId/actions", async (request, reply) => {
    try {
      const access = await assertMunicipalWalkMapAdminAccess(request);
      const decision = extractReviewDecisionFromBody(request.body);
      const result = await reviewMunicipalWalkMapPublicationV0(
        request.params.walkMapId,
        decision,
        access.actorUserId ?? "system_write_key",
      );
      return { ok: true, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : "municipal_walk_map_review_action_failed";
      reply.code(adminErrorStatus(message));
      return { ok: false, error: message };
    }
  });

  app.get<{ Querystring: { templateId?: string } }>("/api/v1/admin/municipal-walk-map-source-catalog", async (request, reply) => {
    try {
      await assertMunicipalWalkMapAdminAccess(request);
      return { ok: true, sources: listMunicipalWalkMapSourceCatalogV0({ templateId: request.query.templateId }) };
    } catch (error) {
      const message = error instanceof Error ? error.message : "municipal_walk_map_source_catalog_read_failed";
      reply.code(adminErrorStatus(message));
      return { ok: false, error: message };
    }
  });

  app.post<{ Body: unknown }>("/api/v1/admin/municipal-walk-maps", async (request, reply) => {
    try {
      const access = await assertMunicipalWalkMapAdminAccess(request);
      const config = await prepareConfigForWrite(extractConfigFromBody(request.body));
      const saved = await upsertMunicipalWalkMapConfigV0(config, access.actorUserId ?? "system_write_key");
      return reply.status(201).send({ ok: true, config: saved, publicMap: buildMunicipalWalkMapPublicReadModelV0(saved) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "municipal_walk_map_admin_save_failed";
      reply.code(adminErrorStatus(message));
      return { ok: false, error: message };
    }
  });

  app.post<{ Body: unknown }>("/api/v1/admin/municipal-walk-maps/preview", async (request, reply) => {
    try {
      await assertMunicipalWalkMapAdminAccess(request);
      const config = assertValidConfigForWrite(extractConfigFromBody(request.body));
      const publicMap = buildMunicipalWalkMapPublicReadModelV0(config);
      reply.type("text/html; charset=utf-8");
      return renderSiteDocument({
        basePath: "",
        title: `${publicMap.title} — ikimon.life`,
        description: publicMap.summary,
        extraStyles: WALK_MAP_STYLES,
        body: renderWalkMapPreviewBody(publicMap, "", "ja", "admin_draft", { suppressRecordCtas: true }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "municipal_walk_map_admin_preview_failed";
      reply.code(adminErrorStatus(message));
      return `preview_failed:${escapeHtml(message)}`;
    }
  });

  app.post<{ Params: { walkMapId: string }; Body: unknown }>("/api/v1/admin/municipal-walk-maps/:walkMapId", async (request, reply) => {
    try {
      const access = await assertMunicipalWalkMapAdminAccess(request);
      const input = extractConfigFromBody(request.body);
      const config = await prepareConfigForWrite({
        ...(input && typeof input === "object" ? input as Record<string, unknown> : {}),
        walkMapId: request.params.walkMapId,
      });
      const saved = await upsertMunicipalWalkMapConfigV0(config, access.actorUserId ?? "system_write_key");
      return { ok: true, config: saved, publicMap: buildMunicipalWalkMapPublicReadModelV0(saved) };
    } catch (error) {
      const message = error instanceof Error ? error.message : "municipal_walk_map_admin_update_failed";
      reply.code(adminErrorStatus(message));
      return { ok: false, error: message };
    }
  });

  app.get<{ Params: { walkMapId: string } }>("/api/v1/municipal-walk-maps/:walkMapId", async (request, reply) => {
    const loaded = await loadWalkMapPublicReadModel(request.params.walkMapId);
    if (!loaded) return reply.status(404).send({ error: "walk map not found" });
    return reply.send(loaded);
  });

  app.get<{ Querystring: { lat?: string; lng?: string; limit?: string } }>("/api/v1/municipal-walk-maps", async (request, reply) => {
    const loaded = await loadWalkMapPublicSummaries();
    const filtered = filterWalkMapSummariesForLocation(loaded.summaries, request.query);
    return reply.send({
      ok: true,
      source: loaded.source,
      matchedMunicipalityCode: filtered.matchedMunicipalityCode,
      locationFiltered: filtered.locationFiltered,
      summaries: filtered.summaries,
    });
  });

  app.get("/walk-maps", async (request, reply) => {
    const lang = detectLangFromUrl(requestUrl(request));
    const basePath = requestBasePath(request as { headers: Record<string, unknown> });
    const loaded = await loadWalkMapPublicSummaries();
    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      lang,
      title: lang === "en" ? "Walk routes — ikimon.life" : "散策ルート — ikimon.life",
      description: lang === "en"
        ? "Choose public walk areas with photos, guides, route stops, and recording entry points."
        : "写真、ガイド、立ち寄り先、記録の入口がある公開範囲の散策ルートを選べます。",
      currentPath: "/walk-maps",
      extraStyles: WALK_MAP_STYLES,
      body: renderWalkMapIndexBody(loaded.summaries, basePath, lang, loaded.source),
    });
  });

  app.get<{ Params: { walkMapId: string } }>("/walk-maps/:walkMapId", async (request, reply) => {
    const loaded = await loadWalkMapPublicReadModel(request.params.walkMapId);
    const lang = detectLangFromUrl(requestUrl(request));
    const basePath = requestBasePath(request as { headers: Record<string, unknown> });
    if (!loaded) {
      reply.code(404);
      reply.type("text/html; charset=utf-8");
      return renderSiteDocument({
        basePath,
        lang,
        title: "散歩マップが見つかりません — ikimon.life",
        body: `<main class="wm-shell"><section class="wm-hero"><h1>散歩マップが見つかりません</h1><p class="wm-lead">公開中のマップIDを確認してください。</p></section></main>`,
        extraStyles: WALK_MAP_STYLES,
      });
    }
    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      lang,
      title: `${loaded.publicMap.title} — ikimon.life`,
      description: loaded.publicMap.summary,
      currentPath: `/walk-maps/${loaded.publicMap.walkMapId}`,
      extraStyles: WALK_MAP_STYLES,
      body: renderWalkMapPreviewBody(loaded.publicMap, basePath, lang, loaded.source),
    });
  });

  app.get<{ Params: { sourceId: string } }>("/walk-map-source-drafts/:sourceId", async (request, reply) => {
    const source = getMunicipalWalkMapSourceCatalogEntryV0(request.params.sourceId);
    const lang = detectLangFromUrl(requestUrl(request));
    const basePath = requestBasePath(request as { headers: Record<string, unknown> });
    if (!source) {
      reply.code(404);
      reply.type("text/html; charset=utf-8");
      return renderSiteDocument({
        basePath,
        lang,
        title: "散策マップ下書きが見つかりません — ikimon.life",
        body: `<main class="wm-shell"><section class="wm-hero"><h1>散策マップ下書きが見つかりません</h1><p class="wm-lead">公開レビュー用のsource IDを確認してください。</p></section></main>`,
        extraStyles: WALK_MAP_STYLES,
      });
    }
    const config = buildMunicipalWalkMapConfigFromSourceCatalogV0(source.sourceId);
    const publicMap = buildMunicipalWalkMapPublicReadModelV0(config);
    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      lang,
      title: `${publicMap.title} — ikimon.life`,
      description: publicMap.summary,
      currentPath: `/walk-map-source-drafts/${encodeURIComponent(source.sourceId)}`,
      extraStyles: WALK_MAP_STYLES,
      body: renderWalkMapPreviewBody(publicMap, basePath, lang, "source_draft_review", { suppressRecordCtas: true }),
    });
  });
}

export const municipalWalkMapRouteContract = {
  publicApiPath: "/api/v1/municipal-walk-maps/:walkMapId",
  publicListApiPath: "/api/v1/municipal-walk-maps",
  adminIndexPath: "/admin/municipal-walk-maps",
  adminEditPath: "/admin/municipal-walk-maps/:walkMapId",
  adminCreatorIndexPath: "/admin/municipal-walk-map-creators",
  adminCreatorApiPath: "/api/v1/admin/municipal-walk-map-creators",
  adminReviewIndexPath: "/admin/municipal-walk-map-reviews",
  adminReviewApiPath: "/api/v1/admin/municipal-walk-map-reviews",
  adminReviewActionApiPath: "/api/v1/admin/municipal-walk-map-reviews/:walkMapId/actions",
  adminTemplateApiPath: "/api/v1/admin/municipal-walk-map-templates",
  adminSourceCatalogApiPath: "/api/v1/admin/municipal-walk-map-source-catalog",
  adminCreateApiPath: "/api/v1/admin/municipal-walk-maps",
  adminPreviewApiPath: "/api/v1/admin/municipal-walk-maps/preview",
  adminUpdateApiPath: "/api/v1/admin/municipal-walk-maps/:walkMapId",
  indexPath: "/walk-maps",
  previewPath: "/walk-maps/:walkMapId",
  sourceDraftReviewPath: "/walk-map-source-drafts/:sourceId",
  staticFallbackId: "jp-shizuoka-light-nature-walk-v0",
} as const;
