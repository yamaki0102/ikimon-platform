// Relationship Score v0.1 panel UI (SSR HTML 文字列生成)
// パターン: communityMeter.ts (CSS-in-TS、copyByLang)

import type { SiteLang } from "../i18n.js";
import { escapeHtml } from "./siteShell.js";
import {
  RELATIONSHIP_AXES,
  type RelationshipAxis,
  type AxisScore,
} from "../services/relationshipScore.js";
import type { RelationshipScoreSnapshot } from "../services/relationshipScoreSnapshot.js";

type PanelCopy = {
  eyebrow: string;
  heading: string;
  lead: string;
  totalLabel: string;
  axisLabels: Record<RelationshipAxis, string>;
  nextActionLabel: string;
  diffLabel: string;
  notice: string;
  demoBadge: string;
  fallbackHint: string;
};

const COPY_BY_LANG: Record<SiteLang, PanelCopy> = {
  ja: {
    eyebrow: "人と自然の関係",
    heading: "運用補助指標",
    lead:
      "この指標は、対象サイトで人が自然に触れ、学び、手入れし、検証可能な記録を積み上げているかを確認するための補助指標です。生態系の改善や制度適合を単独で示すものではありません。",
    totalLabel: "合計",
    axisLabels: {
      access: "Access",
      engagement: "Engagement",
      learning: "Learning",
      stewardship: "Stewardship",
      evidence: "Evidence",
    },
    nextActionLabel: "次に伸ばす1点",
    diffLabel: "前期間からの変化",
    notice:
      "このスコアは認証や順位ではありません。同じサイトでの時間の流れを見るための鏡として使ってください。",
    demoBadge: "サンプル / コンセプト",
    fallbackHint: "(自動生成テンプレート)",
  },
  en: {
    eyebrow: "Human-Nature Relationship",
    heading: "Operational Companion Indicator",
    lead:
      "This indicator helps you check whether people are touching, learning from, caring for, and verifying nature at this site. It does not by itself prove ecosystem improvement or compliance.",
    totalLabel: "Total",
    axisLabels: {
      access: "Access",
      engagement: "Engagement",
      learning: "Learning",
      stewardship: "Stewardship",
      evidence: "Evidence",
    },
    nextActionLabel: "One thing to grow next",
    diffLabel: "Change from previous period",
    notice:
      "This score is not a certification or ranking. Use it as a mirror to track change at the same site over time.",
    demoBadge: "Sample / Concept",
    fallbackHint: "(auto-generated template)",
  },
  es: {
    eyebrow: "Relación humano-naturaleza",
    heading: "Indicador operativo complementario",
    lead:
      "Este indicador ayuda a comprobar si las personas tocan, aprenden, cuidan y verifican la naturaleza en este sitio. No demuestra por sí solo la mejora del ecosistema ni el cumplimiento normativo.",
    totalLabel: "Total",
    axisLabels: {
      access: "Acceso",
      engagement: "Compromiso",
      learning: "Aprendizaje",
      stewardship: "Cuidado",
      evidence: "Evidencia",
    },
    nextActionLabel: "Lo siguiente que cultivar",
    diffLabel: "Cambio desde el período anterior",
    notice:
      "Esta puntuación no es una certificación ni un ranking. Úsela como un espejo para seguir los cambios en el mismo sitio con el tiempo.",
    demoBadge: "Muestra / Concepto",
    fallbackHint: "(plantilla generada automáticamente)",
  },
  "pt-BR": {
    eyebrow: "Relação humano-natureza",
    heading: "Indicador operacional complementar",
    lead:
      "Este indicador ajuda a verificar se as pessoas tocam, aprendem, cuidam e verificam a natureza neste local. Não comprova, por si só, melhoria do ecossistema ou conformidade.",
    totalLabel: "Total",
    axisLabels: {
      access: "Acesso",
      engagement: "Engajamento",
      learning: "Aprendizado",
      stewardship: "Cuidado",
      evidence: "Evidência",
    },
    nextActionLabel: "O próximo passo a cultivar",
    diffLabel: "Mudança em relação ao período anterior",
    notice:
      "Esta pontuação não é uma certificação nem um ranking. Use-a como um espelho para acompanhar mudanças no mesmo local ao longo do tempo.",
    demoBadge: "Amostra / Conceito",
    fallbackHint: "(modelo gerado automaticamente)",
  },
};

function arrowFor(diff: number): string {
  if (diff > 0) return "▲";
  if (diff < 0) return "▼";
  return "—";
}

function renderAxisBar(axisScore: AxisScore, label: string, diff: number | null): string {
  const pct = (axisScore.score / 20) * 100;
  const diffMarkup = diff != null && diff !== 0
    ? `<span class="rs-diff ${diff > 0 ? "rs-diff-up" : "rs-diff-down"}" aria-label="${escapeHtml(`${arrowFor(diff)} ${diff}`)}">${arrowFor(diff)} ${diff > 0 ? "+" : ""}${diff}</span>`
    : "";
  return `<li class="rs-axis-row">
    <div class="rs-axis-head">
      <span class="rs-axis-label">${escapeHtml(label)}</span>
      <span class="rs-axis-score">${axisScore.score} / 20</span>
      ${diffMarkup}
    </div>
    <div class="rs-axis-bar" role="progressbar" aria-valuenow="${axisScore.score}" aria-valuemin="0" aria-valuemax="20" aria-label="${escapeHtml(`${label}: ${axisScore.score}/20`)}">
      <span class="rs-axis-bar-fill" style="width:${pct}%"></span>
    </div>
  </li>`;
}

function renderGauge(total: number): string {
  const pct = Math.max(0, Math.min(1, total / 100));
  // SVG arc; radius 70, circumference ~ 2πr ≈ 440, half-circle = 220
  const circumference = Math.PI * 70;
  const dash = circumference * pct;
  const dashRest = circumference - dash;
  return `<svg class="rs-gauge" viewBox="0 0 200 110" role="img" aria-label="Total ${total}/100">
    <path d="M 20 100 A 80 80 0 0 1 180 100" stroke="#e5e7eb" stroke-width="14" fill="none" stroke-linecap="round" />
    <path d="M 20 100 A 80 80 0 0 1 180 100" stroke="url(#rsGaugeGrad)" stroke-width="14" fill="none" stroke-linecap="round" stroke-dasharray="${dash} ${dashRest}" pathLength="${circumference}" />
    <defs>
      <linearGradient id="rsGaugeGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#10b981" />
        <stop offset="100%" stop-color="#059669" />
      </linearGradient>
    </defs>
    <text x="100" y="92" text-anchor="middle" class="rs-gauge-value">${total}</text>
    <text x="100" y="106" text-anchor="middle" class="rs-gauge-unit">/ 100</text>
  </svg>`;
}

export function renderRelationshipScorePanel(
  snapshot: RelationshipScoreSnapshot,
  lang: SiteLang
): string {
  const copy = COPY_BY_LANG[lang];
  const { score, narrative, diffFromPrevious } = snapshot;

  const axesHtml = RELATIONSHIP_AXES
    .map((axis) =>
      renderAxisBar(score.axes[axis], copy.axisLabels[axis], diffFromPrevious?.[axis] ?? null)
    )
    .join("");

  const nextActionAxis = score.nextActionAxis;
  const nextActionText = narrative?.nextActionText ?? "";
  const fallbackHint = narrative?.fallbackUsed ? `<small class="rs-fallback-hint">${escapeHtml(copy.fallbackHint)}</small>` : "";
  const seasonalNote = narrative?.seasonalNote ?? "";
  const summaryCard = narrative?.summaryCard ?? "";

  const demoBadge = snapshot.source === "demo"
    ? `<span class="rs-demo-badge">${escapeHtml(copy.demoBadge)}</span>`
    : "";

  return `<section class="section rs-section" aria-labelledby="rs-heading">
    <div class="rs-card">
      <header class="rs-head">
        <span class="rs-eyebrow">${escapeHtml(copy.eyebrow)}</span>
        <h2 id="rs-heading" class="rs-heading">${escapeHtml(copy.heading)}</h2>
        ${demoBadge}
        <p class="rs-lead">${escapeHtml(copy.lead)}</p>
      </header>
      <div class="rs-body">
        <div class="rs-gauge-wrap">
          ${renderGauge(score.totalScore)}
          <span class="rs-total-label">${escapeHtml(copy.totalLabel)}</span>
        </div>
        <ul class="rs-axes">
          ${axesHtml}
        </ul>
      </div>
      ${nextActionText ? `<div class="rs-next-action">
        <h3 class="rs-next-title">${escapeHtml(copy.nextActionLabel)}</h3>
        <p class="rs-next-axis">${escapeHtml(copy.axisLabels[nextActionAxis])}</p>
        <p class="rs-next-text">${escapeHtml(nextActionText)} ${fallbackHint}</p>
      </div>` : ""}
      ${summaryCard ? `<p class="rs-summary">${escapeHtml(summaryCard)}</p>` : ""}
      ${seasonalNote ? `<p class="rs-seasonal">${escapeHtml(seasonalNote)}</p>` : ""}
      <p class="rs-notice" role="note">${escapeHtml(copy.notice)}</p>
    </div>
  </section>`;
}

export const RELATIONSHIP_SCORE_PANEL_STYLES = `
.rs-section { margin-top: 32px; }
.rs-card {
  padding: 28px 32px 24px;
  border-radius: 28px;
  background: #ffffff;
  box-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);
  border: 1px solid rgba(15, 23, 42, 0.06);
}
.rs-eyebrow {
  display: inline-block;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #047857;
  font-weight: 600;
}
.rs-heading {
  margin: 8px 0 4px;
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
}
.rs-demo-badge {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: #fef3c7;
  color: #92400e;
}
.rs-lead {
  margin: 8px 0 16px;
  color: #475569;
  font-size: 13px;
  line-height: 1.6;
}
.rs-body {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 24px;
  align-items: start;
}
@media (max-width: 720px) {
  .rs-body { grid-template-columns: 1fr; }
}
.rs-gauge-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.rs-gauge { width: 100%; max-width: 200px; height: auto; }
.rs-gauge-value {
  font-size: 28px;
  font-weight: 700;
  fill: #0f172a;
}
.rs-gauge-unit { font-size: 11px; fill: #64748b; }
.rs-total-label {
  margin-top: 4px;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
}
.rs-axes {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.rs-axis-row { display: flex; flex-direction: column; gap: 6px; }
.rs-axis-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  justify-content: space-between;
}
.rs-axis-label { font-weight: 600; color: #0f172a; font-size: 13px; }
.rs-axis-score { font-variant-numeric: tabular-nums; color: #475569; font-size: 12px; }
.rs-axis-bar {
  height: 8px;
  background: #f1f5f9;
  border-radius: 999px;
  overflow: hidden;
}
.rs-axis-bar-fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
  border-radius: 999px;
  transition: width 280ms ease;
}
.rs-diff {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 999px;
  font-weight: 600;
}
.rs-diff-up { background: #d1fae5; color: #065f46; }
.rs-diff-down { background: #fee2e2; color: #991b1b; }
.rs-next-action {
  margin-top: 20px;
  padding: 16px 18px;
  border-radius: 16px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}
.rs-next-title {
  margin: 0 0 4px;
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #047857;
  font-weight: 700;
}
.rs-next-axis {
  margin: 0 0 6px;
  font-size: 12px;
  color: #065f46;
  font-weight: 600;
}
.rs-next-text {
  margin: 0;
  color: #134e4a;
  font-size: 14px;
  line-height: 1.55;
}
.rs-fallback-hint {
  display: inline-block;
  margin-left: 8px;
  font-size: 11px;
  color: #94a3b8;
}
.rs-summary, .rs-seasonal {
  margin: 12px 0 0;
  color: #334155;
  font-size: 13px;
  line-height: 1.6;
}
.rs-notice {
  display: block !important;
  margin: 16px 0 0;
  padding: 10px 14px;
  border-radius: 12px;
  background: #fffbeb;
  border-left: 3px solid #f59e0b;
  color: #78350f;
  font-size: 12px;
  line-height: 1.55;
}
`;
