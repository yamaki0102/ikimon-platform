// Relationship Score v0.1 - sample report route
// /for-business/sample_report (feature flag + ?demo=<key>)

import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { detectLangFromUrl, type SiteLang } from "../i18n.js";
import { renderSiteDocument, escapeHtml } from "../ui/siteShell.js";
import {
  RELATIONSHIP_SCORE_PANEL_STYLES,
  renderRelationshipScorePanel,
} from "../ui/relationshipScorePanel.js";
import { getRelationshipScoreSnapshot } from "../services/relationshipScoreSnapshot.js";
import { listDemoFixtureKeys, isDemoFixtureKey } from "../services/relationshipScoreFixture.js";

const FEATURE_FLAG_ENV = "FEATURE_RELATIONSHIP_SCORE";

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
    default: return "サンプルレポート — 自然との関係指標";
  }
}

function pageHeading(lang: SiteLang): { eyebrow: string; heading: string; lead: string } {
  switch (lang) {
    case "en":
      return {
        eyebrow: "B2B Sample Report",
        heading: "Human-Nature Relationship",
        lead: "A companion view that focuses on the operational state of how people and a site relate, alongside ecological observation data.",
      };
    case "es":
      return {
        eyebrow: "Informe de muestra B2B",
        heading: "Relación humano-naturaleza",
        lead: "Una vista complementaria que se enfoca en el estado operativo de cómo las personas y un sitio se relacionan, junto a los datos de observación ecológica.",
      };
    case "pt-BR":
      return {
        eyebrow: "Relatório de amostra B2B",
        heading: "Relação humano-natureza",
        lead: "Uma visão complementar focada no estado operacional de como pessoas e um local se relacionam, ao lado dos dados de observação ecológica.",
      };
    default:
      return {
        eyebrow: "B2B サンプルレポート",
        heading: "人と自然の関係",
        lead: "観察データだけでなく、人がそのサイトとどう関わっているかという運用状態を、補助指標として一緒に見るためのビューです。",
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

function demoSelector(basePath: string, lang: SiteLang, currentKey: string | null): string {
  const keys = listDemoFixtureKeys();
  const labels: Record<string, Record<SiteLang, string>> = {
    urban_park: { ja: "都市公園 (温帯)", en: "Urban park (temperate)", es: "Parque urbano (templado)", "pt-BR": "Parque urbano (temperado)" },
    factory_biotope: { ja: "工場ビオトープ (温帯)", en: "Factory biotope (temperate)", es: "Biotopo fabril (templado)", "pt-BR": "Biótopo fabril (temperado)" },
    rice_field: { ja: "無農薬田 (暖温帯)", en: "Organic rice field (warm temperate)", es: "Arrozal orgánico (templado cálido)", "pt-BR": "Arrozal orgânico (temperado quente)" },
    northern_wetland: { ja: "北方湿原 (亜寒帯)", en: "Northern wetland (subarctic)", es: "Humedal norteño (subártico)", "pt-BR": "Banhado nórdico (subártico)" },
    okinawa_coast: { ja: "亜熱帯沿岸", en: "Subtropical coast", es: "Costa subtropical", "pt-BR": "Costa subtropical" },
  };
  const items = keys.map((key) => {
    const label = labels[key]?.[lang] ?? key;
    const href = withBasePath(basePath, `/for-business/sample_report?demo=${encodeURIComponent(key)}&lang=${lang}`);
    const active = key === currentKey;
    return `<a class="rs-demo-link${active ? " rs-demo-link-active" : ""}" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
  });
  return `<nav class="rs-demo-nav" aria-label="demo selector">
    ${items.join("")}
  </nav>`;
}

const DEMO_NAV_STYLES = `
.rs-demo-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0 8px;
}
.rs-demo-link {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #334155;
  font-size: 12px;
  text-decoration: none;
  border: 1px solid transparent;
}
.rs-demo-link:hover { background: #e2e8f0; }
.rs-demo-link-active {
  background: #ecfdf5;
  color: #065f46;
  border-color: #6ee7b7;
  font-weight: 600;
}
`;

export async function registerSampleReportRoute(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { place_id?: string; demo?: string; narrative?: string; lang?: string } }>(
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
          body: `<section class="section"><div class="rs-card"><p class="rs-notice">${escapeHtml(notAvailableMessage(lang))}</p></div></section>`,
        });
      }

      const demoKey = request.query?.demo ?? null;
      const placeId = request.query?.place_id ?? null;
      const wantNarrative = request.query?.narrative === "1";

      let snapshot;
      try {
        snapshot = await getRelationshipScoreSnapshot({
          placeId: placeId ?? undefined,
          demoKey: demoKey ?? undefined,
          lang,
          generateNarrative: wantNarrative,
          persist: !demoKey, // demo は永続化しない
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
          body: `<section class="section"><div class="rs-card"><p class="rs-notice">${escapeHtml((error as Error).message)}</p></div></section>`,
        });
      }

      const demoNav = isDemoFixtureKey(demoKey)
        ? demoSelector(basePath, lang, demoKey)
        : (demoKey === null && !placeId ? demoSelector(basePath, lang, null) : "");

      const panel = renderRelationshipScorePanel(snapshot, lang);

      reply.type("text/html; charset=utf-8");
      return renderSiteDocument({
        basePath,
        title: pageTitle(lang),
        lang,
        currentPath: requestUrl(request),
        extraStyles: RELATIONSHIP_SCORE_PANEL_STYLES + DEMO_NAV_STYLES,
        hero: {
          eyebrow: heading.eyebrow,
          heading: heading.heading,
          lead: heading.lead,
          tone: "light",
          align: "center",
        },
        body: `<div class="lower-page">
          ${demoNav}
          ${panel}
        </div>`,
      });
    }
  );
}
