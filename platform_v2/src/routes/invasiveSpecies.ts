import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "../i18n.js";
import {
  findInvasiveSpeciesBySlug,
  invasiveSpeciesDetailPath,
  INVASIVE_SPECIES_LIST_PATH,
  INVASIVE_SPECIES_OFFICIAL_SOURCES,
  listInvasiveSpecies,
  type InvasiveSpeciesCatalogItem,
} from "../services/invasiveSpeciesCatalog.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

function requestUrl(request: { url?: string; raw?: { url?: string; originalUrl?: string } }): string {
  return String(request.raw?.originalUrl ?? request.raw?.url ?? request.url ?? "");
}

function requestCurrentPath(request: { headers: Record<string, unknown>; url?: string; raw?: { url?: string; originalUrl?: string } }): string {
  return withBasePath(requestBasePath(request), requestUrl(request));
}

function speciesHref(basePath: string, lang: SiteLang, item: InvasiveSpeciesCatalogItem): string {
  return appendLangToHref(withBasePath(basePath, invasiveSpeciesDetailPath(item)), lang);
}

function renderOfficialSources(): string {
  return `<div class="invasive-official-sources">
    <strong>公式情報</strong>
    ${INVASIVE_SPECIES_OFFICIAL_SOURCES.map((source) =>
      `<a href="${escapeHtml(source.href)}" target="_blank" rel="noreferrer">${escapeHtml(source.label)}</a>`,
    ).join("")}
  </div>`;
}

function renderCommonSafety(): string {
  return `<section class="invasive-safety">
    <span>共通の注意</span>
    <h2>触らない、運ばない、捕獲しない。</h2>
    <p>名前が合っているか不確かな段階では、近づきすぎず、写真・場所・日時を記録するところで止めます。生きた個体、卵、種子、植物片を運ばず、捕獲や駆除は自治体、土地管理者、専門機関の指示に従ってください。</p>
  </section>`;
}

function renderListPage(basePath: string, lang: SiteLang): string {
  const species = listInvasiveSpecies();
  const groups = new Map<string, InvasiveSpeciesCatalogItem[]>();
  for (const item of species) {
    const existing = groups.get(item.groupLabel) ?? [];
    existing.push(item);
    groups.set(item.groupLabel, existing);
  }

  const groupHtml = Array.from(groups.entries()).map(([groupLabel, items]) => `<section class="invasive-group">
    <div class="invasive-group-head">
      <span>${escapeHtml(groupLabel)}</span>
      <strong>${escapeHtml(String(items.length))}件</strong>
    </div>
    <div class="invasive-grid">
      ${items.map((item) => `<a class="invasive-card" href="${escapeHtml(speciesHref(basePath, lang, item))}">
        <span>${escapeHtml(item.categoryLabel)}</span>
        <h2>${escapeHtml(item.vernacularName)}</h2>
        <i>${escapeHtml(item.scientificName)}</i>
        <p>${escapeHtml(item.actionLabel)}</p>
      </a>`).join("")}
    </div>
  </section>`).join("");

  return `<div class="invasive-page">
    ${renderCommonSafety()}
    <section class="invasive-summary">
      <strong class="invasive-total">全${escapeHtml(String(species.length))}件</strong>
      <p>この一覧は ikimon.life の外来種 seed を正本に、観察時の安全行動と公式情報への導線をまとめたものです。外来種かどうか、地域で何を求められるかは状況で変わるため、最終判断は公式情報と自治体・管理者の案内で確認してください。</p>
      ${renderOfficialSources()}
    </section>
    ${groupHtml}
  </div>`;
}

function renderDetailPage(basePath: string, lang: SiteLang, item: InvasiveSpeciesCatalogItem): string {
  const listHref = appendLangToHref(withBasePath(basePath, INVASIVE_SPECIES_LIST_PATH), lang);
  const sourceHref = item.sourceUrl || INVASIVE_SPECIES_OFFICIAL_SOURCES[0].href;
  return `<div class="invasive-page invasive-detail">
    <nav class="invasive-breadcrumb"><a href="${escapeHtml(listHref)}">外来種一覧へ戻る</a></nav>
    ${renderCommonSafety()}
    <section class="invasive-detail-card">
      <div class="invasive-detail-kicker">${escapeHtml(item.groupLabel)} / ${escapeHtml(item.categoryLabel)}</div>
      <h2>${escapeHtml(item.vernacularName)}</h2>
      <p class="invasive-scientific">${escapeHtml(item.scientificName)}</p>
      <div class="invasive-action-pill">${escapeHtml(item.actionLabel)}</div>
      <dl>
        <div><dt>記録時の注意</dt><dd>${escapeHtml(item.legalWarning || "触らず、運ばず、自治体や土地管理者に確認してください。")}</dd></div>
        <div><dt>なぜ注意するか</dt><dd>${escapeHtml(item.actionBasis)}</dd></div>
        <div><dt>地域差</dt><dd>${escapeHtml(item.regionalCaveat || "地域の分布や対応方針は自治体の案内で確認してください。")}</dd></div>
      </dl>
      <a class="invasive-source-link" href="${escapeHtml(sourceHref)}" target="_blank" rel="noreferrer">出典を開く</a>
    </section>
    ${renderOfficialSources()}
  </div>`;
}

const INVASIVE_SPECIES_STYLES = `
  .invasive-page { display: grid; gap: 20px; }
  .invasive-breadcrumb a { color: #047857; font-size: 13px; font-weight: 850; text-decoration: none; }
  .invasive-safety,
  .invasive-summary,
  .invasive-detail-card,
  .invasive-group { border: 1px solid rgba(15,23,42,.08); border-radius: 8px; background: #fff; box-shadow: 0 18px 44px rgba(15,23,42,.055); }
  .invasive-safety { padding: clamp(18px, 4vw, 32px); background: linear-gradient(135deg, #fff7ed, #ffffff 58%, #ecfdf5); }
  .invasive-safety span,
  .invasive-detail-kicker,
  .invasive-group-head span,
  .invasive-card span,
  .invasive-total,
  .invasive-official-sources strong { color: #047857; font-size: 12px; line-height: 1.35; font-weight: 950; }
  .invasive-safety h2 { margin: 6px 0 0; color: #10251a; font-size: clamp(25px, 4vw, 42px); line-height: 1.16; letter-spacing: 0; }
  .invasive-safety p,
  .invasive-summary p { margin: 10px 0 0; color: #475569; font-size: 15px; line-height: 1.8; font-weight: 680; }
  .invasive-summary { padding: 18px; }
  .invasive-official-sources { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 14px; }
  .invasive-official-sources a,
  .invasive-source-link,
  .invasive-action-pill { min-height: 38px; display: inline-flex; align-items: center; padding: 8px 12px; border-radius: 999px; font-size: 13px; font-weight: 900; text-decoration: none; }
  .invasive-official-sources a,
  .invasive-source-link { border: 1px solid rgba(16,185,129,.22); color: #047857; background: #f0fdf4; }
  .invasive-group { padding: 16px; }
  .invasive-group-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
  .invasive-group-head strong { color: #64748b; font-size: 12px; }
  .invasive-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
  .invasive-card { min-height: 160px; display: grid; align-content: start; gap: 7px; padding: 14px; border: 1px solid rgba(15,23,42,.08); border-radius: 8px; background: #f8fafc; color: inherit; text-decoration: none; }
  .invasive-card h2 { margin: 0; color: #10251a; font-size: 20px; line-height: 1.3; letter-spacing: 0; }
  .invasive-card i,
  .invasive-scientific { color: #64748b; font-size: 13px; font-style: italic; overflow-wrap: anywhere; }
  .invasive-card p { margin: 4px 0 0; color: #92400e; font-size: 13px; font-weight: 850; }
  .invasive-detail-card { display: grid; gap: 12px; padding: clamp(18px, 4vw, 32px); }
  .invasive-detail-card h2 { margin: 0; color: #10251a; font-size: clamp(30px, 5vw, 54px); line-height: 1.08; letter-spacing: 0; }
  .invasive-action-pill { width: fit-content; background: #fff7ed; color: #92400e; border: 1px solid rgba(217,119,6,.18); }
  .invasive-detail-card dl { display: grid; gap: 10px; margin: 6px 0 0; }
  .invasive-detail-card dl div { display: grid; gap: 4px; padding: 12px; border-radius: 8px; background: #f8fafc; }
  .invasive-detail-card dt { color: #10251a; font-size: 13px; font-weight: 950; }
  .invasive-detail-card dd { margin: 0; color: #475569; font-size: 14px; line-height: 1.75; font-weight: 680; }
  @media (max-width: 560px) {
    .invasive-grid { grid-template-columns: 1fr; }
    .invasive-official-sources { align-items: stretch; }
    .invasive-official-sources a { width: 100%; justify-content: center; }
  }
`;

function renderNotFound(basePath: string, lang: SiteLang, currentPath: string): string {
  return renderSiteDocument({
    basePath,
    lang,
    activeNav: "学ぶ",
    title: "外来種ページが見つかりません | ikimon",
    description: "指定された外来種ページは見つかりませんでした。",
    currentPath,
    canonicalPath: INVASIVE_SPECIES_LIST_PATH,
    noindex: true,
    extraStyles: INVASIVE_SPECIES_STYLES,
    body: `<div class="invasive-page"><section class="invasive-summary"><p>指定された外来種ページは見つかりませんでした。</p><a class="invasive-source-link" href="${escapeHtml(appendLangToHref(withBasePath(basePath, INVASIVE_SPECIES_LIST_PATH), lang))}">外来種一覧を見る</a></section></div>`,
  });
}

export async function registerInvasiveSpeciesRoutes(app: FastifyInstance): Promise<void> {
  app.get(INVASIVE_SPECIES_LIST_PATH, async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      lang,
      activeNav: "学ぶ",
      title: "外来種一覧 | ikimon",
      description: "外来種候補を見つけたときの安全行動と、公式情報への導線をまとめます。",
      currentPath: requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string; originalUrl?: string } }),
      canonicalPath: INVASIVE_SPECIES_LIST_PATH,
      alternateLangs: ["ja"],
      extraStyles: INVASIVE_SPECIES_STYLES,
      hero: {
        eyebrow: "INVASIVE SPECIES",
        heading: "外来種を見つけたときの安全メモ",
        lead: "触らず、運ばず、捕獲せず、写真・場所・日時を残して公式情報と地域の案内を確認するための一覧です。",
        tone: "light",
        align: "center",
      },
      body: renderListPage(basePath, lang),
    });
  });

  app.get<{ Params: { slug: string } }>(`${INVASIVE_SPECIES_LIST_PATH}/:slug`, async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    const item = findInvasiveSpeciesBySlug(request.params.slug);
    const currentPath = requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string; originalUrl?: string } });
    reply.type("text/html; charset=utf-8");
    if (!item) {
      reply.status(404);
      return renderNotFound(basePath, lang, currentPath);
    }
    const canonicalPath = invasiveSpeciesDetailPath(item);
    return renderSiteDocument({
      basePath,
      lang,
      activeNav: "学ぶ",
      title: `${item.vernacularName} | 外来種メモ | ikimon`,
      description: `${item.vernacularName}を見つけたときの安全行動、法的注意、公式情報への導線をまとめます。`,
      currentPath,
      canonicalPath,
      alternateLangs: ["ja"],
      extraStyles: INVASIVE_SPECIES_STYLES,
      hero: {
        eyebrow: item.categoryLabel,
        heading: item.vernacularName,
        lead: `${item.scientificName}。${item.actionLabel}を基本に、触らず、運ばず、自治体や管理者の案内を確認します。`,
        tone: "light",
        align: "center",
      },
      body: renderDetailPage(basePath, lang, item),
    });
  });
}
