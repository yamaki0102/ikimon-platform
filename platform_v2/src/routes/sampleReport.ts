// Relationship Score v0.1 - sample report route
// /for-business/sample_report
// デフォルト: 連理の木の下 (legacy_site_id='ikan_hq') の live snapshot
// ?demo=<key> 指定時のみ fixture モック

import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { detectLangFromUrl, type SiteLang } from "../i18n.js";
import { renderSiteDocument, escapeHtml } from "../ui/siteShell.js";
import {
  RELATIONSHIP_SCORE_PANEL_STYLES,
  renderRelationshipScorePanel,
} from "../ui/relationshipScorePanel.js";
import {
  getRelationshipScoreSnapshot,
  resolvePlaceIdByLegacy,
} from "../services/relationshipScoreSnapshot.js";
import {
  listDemoFixtureKeys,
  isDemoFixtureKey,
} from "../services/relationshipScoreFixture.js";

const FEATURE_FLAG_ENV = "FEATURE_RELATIONSHIP_SCORE";
const DEFAULT_LIVE_LEGACY_KEY = "ikan_hq";

// 連理の木の下 (愛管 1.3ha エリア) の bbox。
// 出典: upload_package/libs/CorporateSites.php の 'ikan_hq' polygon
const IKAN_HQ_BBOX = {
  minLat: 34.8135,
  maxLat: 34.8152,
  minLng: 137.7318,
  maxLng: 137.7336,
};

function isFeatureEnabled(): boolean {
  return process.env[FEATURE_FLAG_ENV] === "1" || process.env[FEATURE_FLAG_ENV] === "true";
}

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

function requestUrl(request: { url?: string; raw?: { url?: string } }): string {
  return String(request.raw?.url ?? request.url ?? "");
}

function pageTitle(lang: SiteLang): string {
  switch (lang) {
    case "en": return "Sample Report — Relationship Score";
    case "es": return "Informe de muestra — Indicador de relación";
    case "pt-BR": return "Relatório de amostra — Indicador de relação";
    default: return "サンプルレポート — 地域の自然を読み解くレポート";
  }
}

function pageHeading(lang: SiteLang): { eyebrow: string; heading: string; lead: string } {
  switch (lang) {
    case "en":
      return {
        eyebrow: "B2B Sample Report",
        heading: "Human-Nature Relationship",
        lead: "Live snapshot of the operational state of how people and a site relate, alongside ecological observation data.",
      };
    case "es":
      return {
        eyebrow: "Informe de muestra B2B",
        heading: "Relación humano-naturaleza",
        lead: "Vista en vivo del estado operativo de cómo las personas y un sitio se relacionan, junto a los datos de observación.",
      };
    case "pt-BR":
      return {
        eyebrow: "Relatório de amostra B2B",
        heading: "Relação humano-natureza",
        lead: "Visão ao vivo do estado operacional de como pessoas e um local se relacionam, ao lado dos dados de observação.",
      };
    default:
      return {
        eyebrow: "企業・地域向けサンプルレポート",
        heading: "観察の記録を、次のアクションへ",
        lead: "生きものの発見を、地域の自然を読み解く手がかりへ。観察データと、人がそのサイトとどう関わっているかという運用状態を、補助指標として一緒に見るためのビューです。",
      };
  }
}

function notAvailableMessage(lang: SiteLang): string {
  switch (lang) {
    case "en": return "This sample report is not enabled in this environment.";
    case "es": return "Este informe de muestra no está habilitado en este entorno.";
    case "pt-BR": return "Este relatório de amostra não está habilitado neste ambiente.";
    default: return "このサンプルレポートはこの環境では有効になっていません。";
  }
}

function liveLinkText(lang: SiteLang): string {
  switch (lang) {
    case "en": return "Live: 連理の木の下 (default)";
    case "es": return "En vivo: 連理の木の下 (predeterminado)";
    case "pt-BR": return "Ao vivo: 連理の木の下 (padrão)";
    default: return "リアルタイム: 連理の木の下 (デフォルト)";
  }
}

function altSamplesHeading(lang: SiteLang): string {
  switch (lang) {
    case "en": return "Other concept samples (not live data)";
    case "es": return "Otras muestras conceptuales (sin datos en vivo)";
    case "pt-BR": return "Outras amostras conceituais (sem dados ao vivo)";
    default: return "他のコンセプトサンプル (実データではありません)";
  }
}

function demoSelector(basePath: string, lang: SiteLang, currentKey: string | null): string {
  const keys = listDemoFixtureKeys();
  const labels: Record<string, Record<SiteLang, string>> = {
    urban_park: { ja: "都市公園 (温帯)", en: "Urban park (temperate)", es: "Parque urbano (templado)", "pt-BR": "Parque urbano (temperado)" },
    factory_biotope: { ja: "工場ビオトープ (温帯)", en: "Factory biotope (temperate)", es: "Biotopo fabril (templado)", "pt-BR": "Biótopo fabril (temperado)" },
    rice_field: { ja: "無農薬田 (暖温帯)", en: "Organic rice field (warm temperate)", es: "Arrozal orgánico (templado cálido)", "pt-BR": "Arrozal orgânico (temperado quente)" },
    northern_wetland: { ja: "北方湿原 (亜寒帯)", en: "Northern wetland (subarctic)", es: "Humedal norteño (subártico)", "pt-BR": "Banhado nórdico (subártico)" },
    okinawa_coast: { ja: "亜熱帯沿岸", en: "Subtropical coast", es: "Costa subtropical", "pt-BR": "Costa subtropical" },
  };
  const liveActive = !currentKey;
  const liveHref = withBasePath(basePath, `/for-business/sample_report?lang=${lang}`);
  const liveItem = `<a class="rs-tab${liveActive ? " rs-tab-active" : ""}" href="${escapeHtml(liveHref)}">${escapeHtml(liveLinkText(lang))}</a>`;

  const items = keys.map((key) => {
    const label = labels[key]?.[lang] ?? key;
    const href = withBasePath(basePath, `/for-business/sample_report?demo=${encodeURIComponent(key)}&lang=${lang}`);
    const active = key === currentKey;
    return `<a class="rs-tab${active ? " rs-tab-active" : ""}" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
  });

  return `<nav class="rs-tabs" aria-label="sample selector">
    <div class="rs-tabs-primary">${liveItem}</div>
    <details class="rs-tabs-secondary">
      <summary>${escapeHtml(altSamplesHeading(lang))}</summary>
      <div class="rs-tabs-list">${items.join("")}</div>
    </details>
  </nav>`;
}

const TAB_STYLES = `
.rs-tabs {
  max-width: 920px;
  margin: 16px auto 0;
  padding: 0 8px;
}
.rs-tabs-primary {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}
.rs-tab {
  display: inline-block;
  padding: 8px 14px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #334155;
  font-size: 12px;
  text-decoration: none;
  border: 1px solid transparent;
}
.rs-tab:hover { background: #e2e8f0; }
.rs-tab-active {
  background: linear-gradient(135deg, #10b981 0%, #0284c7 100%);
  color: #ffffff;
  border-color: transparent;
  font-weight: 700;
}
.rs-tabs-secondary {
  margin-top: 6px;
  font-size: 11px;
  color: #64748b;
}
.rs-tabs-secondary summary {
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
}
.rs-tabs-secondary summary:hover { background: #f8fafc; }
.rs-tabs-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
  padding: 6px 4px;
}
.rs-tabs-list .rs-tab { font-size: 11px; padding: 5px 10px; }
@media print { .rs-tabs { display: none; } }
`;

export async function registerSampleReportRoute(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { place_id?: string; demo?: string; narrative?: string; lang?: string; window?: string } }>(
    "/for-business/sample_report",
    async (request, reply) => {
      const basePath = requestBasePath(request as { headers: Record<string, unknown> });
      const lang = detectLangFromUrl(requestUrl(request));
      const heading = pageHeading(lang);

      if (!isFeatureEnabled()) {
        reply.code(404);
        reply.type("text/html; charset=utf-8");
        return renderSiteDocument({
          basePath,
          title: pageTitle(lang),
          lang,
          extraStyles: RELATIONSHIP_SCORE_PANEL_STYLES,
          body: `<section class="section"><div class="rs-report"><p class="rs-notice">${escapeHtml(notAvailableMessage(lang))}</p></div></section>`,
        });
      }

      const demoKey = request.query?.demo ?? null;
      const explicitPlaceId = request.query?.place_id ?? null;
      const wantNarrative = request.query?.narrative === "1";
      const windowDays = (() => {
        const v = Number(request.query?.window);
        if (!Number.isFinite(v) || v <= 0) return undefined;
        return Math.min(Math.max(Math.round(v), 7), 1095);
      })();

      // Resolve target placeId: ?demo=key has precedence, then ?place_id, then default ikan_hq
      let placeId: string | undefined = explicitPlaceId ?? undefined;
      let demoActive: string | null = isDemoFixtureKey(demoKey) ? demoKey : null;
      let isDefaultIkanHq = false;

      if (!demoActive && !placeId) {
        const resolved = await resolvePlaceIdByLegacy(DEFAULT_LIVE_LEGACY_KEY);
        if (resolved) {
          placeId = resolved;
          isDefaultIkanHq = true;
        } else {
          // 旧データ未登録なら fallback として urban_park fixture
          demoActive = "urban_park";
        }
      }

      // 連理の木の下 (ikan_hq) の場合は CorporateSites.php 由来の bbox を必ず適用
      // (places.bbox_json が空でも legacy エリア境界で集計できる)
      const bboxOverride = isDefaultIkanHq ? IKAN_HQ_BBOX : undefined;

      let snapshot;
      try {
        snapshot = await getRelationshipScoreSnapshot({
          placeId,
          demoKey: demoActive ?? undefined,
          lang,
          generateNarrative: wantNarrative,
          persist: !demoActive,
          periodWindowDays: windowDays,
          bbox: bboxOverride,
        });
      } catch (error) {
        console.warn("[sampleReport] snapshot failed", error);
        reply.code(400);
        reply.type("text/html; charset=utf-8");
        return renderSiteDocument({
          basePath,
          title: pageTitle(lang),
          lang,
          extraStyles: RELATIONSHIP_SCORE_PANEL_STYLES,
          body: `<section class="section"><div class="rs-report"><p class="rs-notice">${escapeHtml((error as Error).message)}</p></div></section>`,
        });
      }

      const tabs = demoSelector(basePath, lang, demoActive);
      const panel = renderRelationshipScorePanel(snapshot, lang);

      reply.type("text/html; charset=utf-8");
      return renderSiteDocument({
        basePath,
        title: pageTitle(lang),
        lang,
        currentPath: requestUrl(request),
        extraStyles: RELATIONSHIP_SCORE_PANEL_STYLES + TAB_STYLES,
        hero: {
          eyebrow: heading.eyebrow,
          heading: heading.heading,
          lead: heading.lead,
          tone: "light",
          align: "center",
        },
        body: `<div class="lower-page">
          ${tabs}
          ${panel}
        </div>`,
      });
    }
  );
}
