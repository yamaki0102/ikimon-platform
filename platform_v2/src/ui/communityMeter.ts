import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, type SiteLang } from "../i18n.js";
import type { LandingSnapshot } from "../services/readModels.js";
import { escapeHtml } from "./siteShell.js";

type CommunityMeterCopy = {
  eyebrow: string;
  heading: string;
  lead: string;
  observationLabel: string;
  speciesLabel: string;
  placeLabel: string;
  exploreLabel: string;
};

const copyByLang: Record<SiteLang, CommunityMeterCopy> = {
  ja: {
    eyebrow: "記録が集まると",
    heading: "1 件ずつ増えると、場所と季節が読みやすくなる。",
    lead: "ひとつの観察だけでも意味があります。件数が増えると、どこで何が見つかりやすいか、いつ見返すとよいかが分かりやすくなります。",
    observationLabel: "観察",
    speciesLabel: "種",
    placeLabel: "場所",
    exploreLabel: "みんなのノートを開く",
  },
  en: {
    eyebrow: "What the notebook grows",
    heading: "Your one page feeds the map and the model.",
    lead: "One observation matters on its own. Together, they become a shared way to read places and seasons.",
    observationLabel: "observations",
    speciesLabel: "species",
    placeLabel: "places",
    exploreLabel: "Open the shared notebook",
  },
  es: {
    eyebrow: "Lo que el cuaderno cultiva",
    heading: "Tu página alimenta el mapa y el modelo.",
    lead: "Una sola observación tiene valor en sí misma. Juntas, se convierten en una forma compartida de leer lugares y estaciones.",
    observationLabel: "observaciones",
    speciesLabel: "especies",
    placeLabel: "lugares",
    exploreLabel: "Abrir el cuaderno compartido",
  },
  "pt-BR": {
    eyebrow: "O que o caderno cultiva",
    heading: "Sua página alimenta o mapa e o modelo.",
    lead: "Uma observação tem valor sozinha. Juntas, elas se tornam uma forma compartilhada de ler lugares e estações.",
    observationLabel: "observações",
    speciesLabel: "espécies",
    placeLabel: "lugares",
    exploreLabel: "Abrir o caderno compartilhado",
  },
};

function formatNumber(value: number, lang: SiteLang): string {
  const localeMap: Record<SiteLang, string> = {
    ja: "ja-JP",
    en: "en-US",
    es: "es-ES",
    "pt-BR": "pt-BR",
  };
  return value.toLocaleString(localeMap[lang]);
}

export function renderCommunityMeter(
  basePath: string,
  lang: SiteLang,
  snapshot: LandingSnapshot,
): string {
  const { stats } = snapshot;
  if (stats.observationCount === 0 && stats.speciesCount === 0 && stats.placeCount === 0) {
    return "";
  }

  const copy = copyByLang[lang];
  const exploreHref = appendLangToHref(withBasePath(basePath, "/explore"), lang);

  return `<section class="section cm-section" aria-labelledby="cm-heading">
    <div class="cm-card">
      <div class="cm-head">
        <span class="cm-eyebrow">${escapeHtml(copy.eyebrow)}</span>
        <h2 id="cm-heading" class="cm-heading">${escapeHtml(copy.heading)}</h2>
        <p class="cm-lead">${escapeHtml(copy.lead)}</p>
      </div>
      <div class="cm-stats">
        <div class="cm-stat">
          <strong>${escapeHtml(formatNumber(stats.observationCount, lang))}</strong>
          <span>${escapeHtml(copy.observationLabel)}</span>
        </div>
        <div class="cm-stat">
          <strong>${escapeHtml(formatNumber(stats.speciesCount, lang))}</strong>
          <span>${escapeHtml(copy.speciesLabel)}</span>
        </div>
        <div class="cm-stat">
          <strong>${escapeHtml(formatNumber(stats.placeCount, lang))}</strong>
          <span>${escapeHtml(copy.placeLabel)}</span>
        </div>
      </div>
      <div class="cm-actions">
        <a class="inline-link" href="${escapeHtml(exploreHref)}" data-kpi-action="communitymeter:explore">${escapeHtml(copy.exploreLabel)}</a>
      </div>
    </div>
  </section>`;
}

export const COMMUNITY_METER_STYLES = `
  .cm-section { margin-top: 24px; }
  .cm-card {
    padding: 28px 32px 24px;
    border-radius: 28px;
    background:
      radial-gradient(circle at 88% 20%, rgba(16,185,129,.08), transparent 42%),
      linear-gradient(180deg, #ffffff 0%, #f8fbf8 100%);
    border: 1px solid rgba(15,23,42,.05);
    box-shadow: 0 18px 38px rgba(15,23,42,.05);
  }
  .cm-head { display: flex; flex-direction: column; gap: 6px; max-width: 60ch; }
  .cm-eyebrow {
    align-self: flex-start;
    padding: 4px 12px;
    border-radius: 999px;
    background: rgba(16,185,129,.12);
    color: #047857;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .12em;
    text-transform: uppercase;
  }
  .cm-heading {
    margin: 8px 0 0;
    font-family: "Zen Kaku Gothic New", "Inter", "Noto Sans JP", sans-serif;
    font-size: clamp(20px, 2.4vw, 26px);
    line-height: 1.42;
    letter-spacing: -.01em;
    font-weight: 900;
    color: #0f172a;
  }
  .cm-lead { margin: 6px 0 0; color: #475569; font-size: 14px; line-height: 1.8; text-wrap: pretty; }
  .cm-stats {
    margin-top: 22px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
  .cm-stat {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 16px 18px;
    border-radius: 18px;
    background: rgba(255,255,255,.86);
    border: 1px solid rgba(15,23,42,.05);
  }
  .cm-stat strong {
    font-family: "Zen Kaku Gothic New", "Inter", "Noto Sans JP", sans-serif;
    font-size: clamp(24px, 3.2vw, 34px);
    font-weight: 900;
    color: #0f172a;
    letter-spacing: -.02em;
    line-height: 1.1;
  }
  .cm-stat span { font-size: 12px; font-weight: 700; color: #475569; letter-spacing: .04em; text-transform: lowercase; }
  .cm-actions { margin-top: 18px; }
  @media (max-width: 640px) {
    .cm-card { padding: 22px 20px 18px; }
    .cm-stats { grid-template-columns: 1fr; }
  }
`;
