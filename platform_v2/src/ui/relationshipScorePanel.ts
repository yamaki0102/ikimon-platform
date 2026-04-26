// Relationship Score v0.1 panel UI - A4 1枚密度
// 仕様書 §5 UI要素: 100点ゲージ + 5軸横棒 + 次の1点 + 根拠データ + 注意書き

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
  totalLabel: string;
  axisLabels: Record<RelationshipAxis, string>;
  axisHints: Record<RelationshipAxis, string>;
  reasonLabels: Record<string, string>;
  metricsHeading: string;
  metricsLabels: {
    visits: string;
    seasons: string;
    repeatObservers: string;
    notes: string;
    identifications: string;
    taxonRanks: string;
    stewardship: string;
    accepted: string;
    effort: string;
    audit: string;
    auditYes: string;
    auditNo: string;
  };
  topActionsHeading: string;
  topActionsLead: string;
  evidenceHeading: string;
  metaPeriod: string;
  metaSite: string;
  metaIndustry: string;
  metaClimate: string;
  metaSource: { live: string; demo: string };
  fallbackHint: string;
  notice: string;
  printButton: string;
  diffLabel: string;
};

const COPY: Record<SiteLang, PanelCopy> = {
  ja: {
    eyebrow: "人と自然の関係 / 運用補助指標",
    totalLabel: "総合 / 100",
    axisLabels: {
      access: "Access — 触れられるか",
      engagement: "Engagement — 続いているか",
      learning: "Learning — 学んでいるか",
      stewardship: "Stewardship — 手入れしているか",
      evidence: "Evidence — 検証できるか",
    },
    axisHints: {
      access: "公開性、安全導線、観察可能範囲",
      engagement: "観察セッション、季節カバー、再訪者、effort",
      learning: "メモ、同定、レビュー返信、分類群の幅",
      stewardship: "草刈り・清掃・撹乱種対応・巡回・看板など",
      evidence: "T2/T3 相当の検証、effort 充足、監査履歴",
    },
    reasonLabels: {
      access_private_or_unset: "立入不可または未登録",
      access_limited: "限定公開",
      access_public_no_safety: "公開だが安全配慮の記述なし",
      access_public_with_safety: "公開かつ安全配慮あり",
      visits_lt_3: "観察セッションが 3 件未満",
      engagement_thin: "観察が単発寄り",
      engagement_partial: "複数月の観察あり",
      engagement_full: "複数季節・再訪者・effort いずれも揃う",
      learning_minimal: "写真・位置のみ",
      learning_partial: "メモまたは同定挑戦あり",
      learning_full: "同定・分類群・レビュー返信が揃う",
      stewardship_none: "保全行動の記録なし",
      stewardship_partial: "保全行動あり、観察紐付けは未充分",
      stewardship_full: "保全行動 6 件以上、観察と紐付き",
      evidence_minimal: "検証履歴が薄い",
      evidence_partial: "一部にレビューまたは effort 情報あり",
      evidence_full: "T2/T3 相当・effort 充足・監査ログ揃う",
    },
    metricsHeading: "根拠データ",
    metricsLabels: {
      visits: "観察セッション",
      seasons: "季節カバー",
      repeatObservers: "再訪者",
      notes: "メモ入力率",
      identifications: "同定挑戦率",
      taxonRanks: "分類群の幅",
      stewardship: "保全行動",
      accepted: "レビュー受理率",
      effort: "effort 充足率",
      audit: "監査履歴",
      auditYes: "あり",
      auditNo: "なし",
    },
    topActionsHeading: "次に伸ばす — 上位3軸",
    topActionsLead: "ギャップ × 実行コスト × 達成可能性で並べ替え。",
    evidenceHeading: "見え方の補足",
    metaPeriod: "期間",
    metaSite: "サイト",
    metaIndustry: "業種",
    metaClimate: "気候帯",
    metaSource: { live: "実データ", demo: "サンプル / コンセプト" },
    fallbackHint: "(自動生成テンプレート)",
    notice: "認証ではなく、サイトの運用を確認するための補助指標。スコアの高低が企業の優劣を意味するものではなく、次に取り組む 1 点を見つけるための鏡として使ってください。",
    printButton: "A4 で印刷",
    diffLabel: "前期間比",
  },
  en: {
    eyebrow: "Human-Nature Relationship / Companion Indicator",
    totalLabel: "Total / 100",
    axisLabels: {
      access: "Access — can people reach it",
      engagement: "Engagement — is it continuing",
      learning: "Learning — are people learning",
      stewardship: "Stewardship — is it being cared for",
      evidence: "Evidence — is it verifiable",
    },
    axisHints: {
      access: "Openness, safety pathways, observable area",
      engagement: "Sessions, seasons, repeat observers, effort",
      learning: "Notes, identification attempts, review replies",
      stewardship: "Cleanup, mowing, disturbance response, patrol",
      evidence: "Tier 2/3 review, effort completion, audit trail",
    },
    reasonLabels: {
      access_private_or_unset: "Private or not registered",
      access_limited: "Limited access",
      access_public_no_safety: "Public but no safety note",
      access_public_with_safety: "Public with safety note",
      visits_lt_3: "Fewer than 3 sessions",
      engagement_thin: "Mostly single observations",
      engagement_partial: "Multi-month observation",
      engagement_full: "Multi-season + repeats + effort all present",
      learning_minimal: "Photos / location only",
      learning_partial: "Some notes or identification attempts",
      learning_full: "Identification + ranks + review replies",
      stewardship_none: "No stewardship records",
      stewardship_partial: "Stewardship logged, weak observation linkage",
      stewardship_full: "6+ actions linked to observations",
      evidence_minimal: "Thin verification history",
      evidence_partial: "Partial review or effort info",
      evidence_full: "Tier 2/3 review + effort + audit trail all present",
    },
    metricsHeading: "Underlying data",
    metricsLabels: {
      visits: "Sessions",
      seasons: "Seasons covered",
      repeatObservers: "Repeat observers",
      notes: "Notes completion",
      identifications: "Identification rate",
      taxonRanks: "Taxonomic ranks",
      stewardship: "Stewardship actions",
      accepted: "Review accept rate",
      effort: "Effort completion",
      audit: "Audit trail",
      auditYes: "yes",
      auditNo: "no",
    },
    topActionsHeading: "Next to grow — top 3 axes",
    topActionsLead: "Sorted by gap × cost × headroom.",
    evidenceHeading: "Reading notes",
    metaPeriod: "Period",
    metaSite: "Site",
    metaIndustry: "Industry",
    metaClimate: "Climate zone",
    metaSource: { live: "Live data", demo: "Sample / concept" },
    fallbackHint: "(auto-generated template)",
    notice: "This is not a certification but a companion indicator. A higher score does not mean a better company; use it as a mirror to find the next concrete step.",
    printButton: "Print A4",
    diffLabel: "vs previous",
  },
  es: {
    eyebrow: "Relación humano-naturaleza / Indicador complementario",
    totalLabel: "Total / 100",
    axisLabels: {
      access: "Acceso — ¿se puede llegar?",
      engagement: "Compromiso — ¿continúa?",
      learning: "Aprendizaje — ¿se aprende?",
      stewardship: "Cuidado — ¿se mantiene?",
      evidence: "Evidencia — ¿se puede verificar?",
    },
    axisHints: {
      access: "Apertura, rutas seguras, área observable",
      engagement: "Sesiones, estaciones, repetidores, esfuerzo",
      learning: "Notas, identificación, respuestas de revisión",
      stewardship: "Limpieza, siega, respuesta a disturbios, patrullaje",
      evidence: "Revisión Tier 2/3, esfuerzo, auditoría",
    },
    reasonLabels: {
      access_private_or_unset: "Privado o sin registro",
      access_limited: "Acceso limitado",
      access_public_no_safety: "Público pero sin nota de seguridad",
      access_public_with_safety: "Público con nota de seguridad",
      visits_lt_3: "Menos de 3 sesiones",
      engagement_thin: "Observaciones puntuales",
      engagement_partial: "Observación de varios meses",
      engagement_full: "Multi-estación, repetidores y esfuerzo presentes",
      learning_minimal: "Solo fotos / ubicación",
      learning_partial: "Notas o intentos de identificación",
      learning_full: "Identificación + rangos + respuestas",
      stewardship_none: "Sin registros de cuidado",
      stewardship_partial: "Acciones registradas, vínculo débil con observaciones",
      stewardship_full: "6+ acciones vinculadas a observaciones",
      evidence_minimal: "Historial de verificación escaso",
      evidence_partial: "Revisión parcial o información de esfuerzo",
      evidence_full: "Tier 2/3 + esfuerzo + auditoría presentes",
    },
    metricsHeading: "Datos subyacentes",
    metricsLabels: {
      visits: "Sesiones",
      seasons: "Estaciones cubiertas",
      repeatObservers: "Observadores recurrentes",
      notes: "Tasa de notas",
      identifications: "Tasa de identificación",
      taxonRanks: "Rangos taxonómicos",
      stewardship: "Acciones de cuidado",
      accepted: "Tasa de aceptación",
      effort: "Esfuerzo registrado",
      audit: "Auditoría",
      auditYes: "sí",
      auditNo: "no",
    },
    topActionsHeading: "Siguiente — top 3 ejes",
    topActionsLead: "Ordenado por brecha × costo × margen.",
    evidenceHeading: "Notas de lectura",
    metaPeriod: "Período",
    metaSite: "Sitio",
    metaIndustry: "Industria",
    metaClimate: "Zona climática",
    metaSource: { live: "Datos en vivo", demo: "Muestra / concepto" },
    fallbackHint: "(plantilla generada automáticamente)",
    notice: "No es una certificación, es un indicador complementario. Una puntuación más alta no significa una mejor empresa; úsela como un espejo para encontrar el siguiente paso concreto.",
    printButton: "Imprimir A4",
    diffLabel: "vs anterior",
  },
  "pt-BR": {
    eyebrow: "Relação humano-natureza / Indicador complementar",
    totalLabel: "Total / 100",
    axisLabels: {
      access: "Acesso — é alcançável?",
      engagement: "Engajamento — está continuando?",
      learning: "Aprendizado — está se aprendendo?",
      stewardship: "Cuidado — está sendo mantido?",
      evidence: "Evidência — é verificável?",
    },
    axisHints: {
      access: "Abertura, rotas seguras, área observável",
      engagement: "Sessões, estações, repetidores, esforço",
      learning: "Notas, identificação, respostas de revisão",
      stewardship: "Limpeza, roçada, resposta a distúrbios, patrulha",
      evidence: "Revisão Tier 2/3, esforço, auditoria",
    },
    reasonLabels: {
      access_private_or_unset: "Privado ou não registrado",
      access_limited: "Acesso limitado",
      access_public_no_safety: "Público mas sem nota de segurança",
      access_public_with_safety: "Público com nota de segurança",
      visits_lt_3: "Menos de 3 sessões",
      engagement_thin: "Observações pontuais",
      engagement_partial: "Observação de vários meses",
      engagement_full: "Multi-estação + repetidores + esforço presentes",
      learning_minimal: "Apenas fotos / localização",
      learning_partial: "Notas ou tentativas de identificação",
      learning_full: "Identificação + classes + respostas",
      stewardship_none: "Sem registros de cuidado",
      stewardship_partial: "Ações registradas, vínculo fraco com observações",
      stewardship_full: "6+ ações vinculadas a observações",
      evidence_minimal: "Histórico de verificação escasso",
      evidence_partial: "Revisão parcial ou informação de esforço",
      evidence_full: "Tier 2/3 + esforço + auditoria presentes",
    },
    metricsHeading: "Dados subjacentes",
    metricsLabels: {
      visits: "Sessões",
      seasons: "Estações cobertas",
      repeatObservers: "Observadores recorrentes",
      notes: "Taxa de notas",
      identifications: "Taxa de identificação",
      taxonRanks: "Rangos taxonômicos",
      stewardship: "Ações de cuidado",
      accepted: "Taxa de aceite",
      effort: "Esforço registrado",
      audit: "Auditoria",
      auditYes: "sim",
      auditNo: "não",
    },
    topActionsHeading: "Próximo — top 3 eixos",
    topActionsLead: "Ordenado por lacuna × custo × margem.",
    evidenceHeading: "Notas de leitura",
    metaPeriod: "Período",
    metaSite: "Local",
    metaIndustry: "Setor",
    metaClimate: "Zona climática",
    metaSource: { live: "Dados ao vivo", demo: "Amostra / conceito" },
    fallbackHint: "(modelo gerado automaticamente)",
    notice: "Não é uma certificação, é um indicador complementar. Uma pontuação mais alta não significa uma empresa melhor; use-o como um espelho para encontrar o próximo passo concreto.",
    printButton: "Imprimir A4",
    diffLabel: "vs anterior",
  },
};

const CLIMATE_LABELS: Record<string, Record<SiteLang, string>> = {
  temperate_n: { ja: "北半球温帯", en: "Northern temperate", es: "Templado norte", "pt-BR": "Temperado norte" },
  temperate_s: { ja: "南半球温帯", en: "Southern temperate", es: "Templado sur", "pt-BR": "Temperado sul" },
  subtropical_n: { ja: "北半球亜熱帯", en: "Northern subtropical", es: "Subtropical norte", "pt-BR": "Subtropical norte" },
  subtropical_s: { ja: "南半球亜熱帯", en: "Southern subtropical", es: "Subtropical sur", "pt-BR": "Subtropical sul" },
  subarctic_n: { ja: "北半球亜寒帯", en: "Northern subarctic", es: "Subártico norte", "pt-BR": "Subártico norte" },
  subarctic_s: { ja: "南半球亜寒帯", en: "Southern subarctic", es: "Subártico sur", "pt-BR": "Subártico sul" },
  tropical: { ja: "熱帯", en: "Tropical", es: "Tropical", "pt-BR": "Tropical" },
};

function arrowFor(diff: number): string {
  if (diff > 0) return "▲";
  if (diff < 0) return "▼";
  return "—";
}

function fmtPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function fmtNumber(value: number): string {
  return value.toLocaleString("en-US");
}

function renderAxisRow(
  axisScore: AxisScore,
  copy: PanelCopy,
  diff: number | null
): string {
  const pct = (axisScore.score / 20) * 100;
  const reason = axisScore.reasons[0] ?? "";
  const reasonText = copy.reasonLabels[reason] ?? "";
  const diffMarkup = diff != null && diff !== 0
    ? ` <span class="rs-diff ${diff > 0 ? "rs-diff-up" : "rs-diff-down"}">${arrowFor(diff)}${diff > 0 ? "+" : ""}${diff}</span>`
    : "";
  return `<li class="rs-axis-row">
    <div class="rs-axis-head">
      <span class="rs-axis-label">${escapeHtml(copy.axisLabels[axisScore.axis])}</span>
      <span class="rs-axis-score">${axisScore.score}/20${diffMarkup}</span>
    </div>
    <div class="rs-axis-bar" role="progressbar" aria-valuenow="${axisScore.score}" aria-valuemin="0" aria-valuemax="20">
      <span class="rs-axis-bar-fill" style="width:${pct}%"></span>
    </div>
    <p class="rs-axis-hint">${escapeHtml(copy.axisHints[axisScore.axis])}</p>
    ${reasonText ? `<p class="rs-axis-reason">${escapeHtml(reasonText)}</p>` : ""}
  </li>`;
}

function renderGauge(total: number, copy: PanelCopy): string {
  const pct = Math.max(0, Math.min(1, total / 100));
  const circumference = Math.PI * 80;
  const dash = circumference * pct;
  const dashRest = circumference - dash;
  return `<svg class="rs-gauge" viewBox="0 0 220 130" role="img" aria-label="Total ${total}/100">
    <path d="M 20 110 A 90 90 0 0 1 200 110" stroke="#e5e7eb" stroke-width="14" fill="none" stroke-linecap="round" />
    <path d="M 20 110 A 90 90 0 0 1 200 110" stroke="url(#rsGaugeGrad)" stroke-width="14" fill="none" stroke-linecap="round" stroke-dasharray="${dash} ${dashRest}" pathLength="${circumference}" />
    <defs>
      <linearGradient id="rsGaugeGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#10b981" />
        <stop offset="100%" stop-color="#0284c7" />
      </linearGradient>
    </defs>
    <text x="110" y="98" text-anchor="middle" class="rs-gauge-value">${total}</text>
    <text x="110" y="120" text-anchor="middle" class="rs-gauge-unit">${escapeHtml(copy.totalLabel)}</text>
  </svg>`;
}

function renderMetricsTable(snapshot: RelationshipScoreSnapshot, copy: PanelCopy): string {
  const i = snapshot.inputs;
  const m = copy.metricsLabels;
  const items: Array<{ label: string; value: string }> = [
    { label: m.visits, value: fmtNumber(i.visitsCount) },
    { label: m.seasons, value: `${i.seasonsCovered} / ${snapshot.score.seasonCoverageCap}` },
    { label: m.repeatObservers, value: fmtNumber(i.repeatObserverCount) },
    { label: m.notes, value: fmtPct(i.notesCompletionRate) },
    { label: m.identifications, value: fmtPct(i.identificationAttemptRate) },
    { label: m.taxonRanks, value: fmtNumber(i.taxonRankDistinctCount) },
    { label: m.stewardship, value: fmtNumber(i.stewardshipActionCount) },
    { label: m.accepted, value: fmtPct(i.acceptedReviewRate) },
    { label: m.effort, value: fmtPct(i.effortCompletionRate) },
    { label: m.audit, value: i.auditTrailPresent ? m.auditYes : m.auditNo },
  ];
  return `<dl class="rs-metrics">
    ${items.map((it) =>
      `<div class="rs-metric">
        <dt>${escapeHtml(it.label)}</dt>
        <dd>${escapeHtml(it.value)}</dd>
      </div>`
    ).join("")}
  </dl>`;
}

function renderTopActions(snapshot: RelationshipScoreSnapshot, copy: PanelCopy): string {
  if (snapshot.topActions.length === 0) {
    return "";
  }
  const items = snapshot.topActions.map((it, idx) => {
    return `<li class="rs-top-action">
      <span class="rs-top-rank">${idx + 1}</span>
      <div class="rs-top-body">
        <p class="rs-top-axis">${escapeHtml(copy.axisLabels[it.axis])}</p>
        <p class="rs-top-score">${it.score}/20</p>
      </div>
    </li>`;
  }).join("");
  return `<ol class="rs-top-actions">${items}</ol>`;
}

function periodLabel(snapshot: RelationshipScoreSnapshot): string {
  return `${snapshot.periodStart} — ${snapshot.periodEnd}`;
}

function climateLabel(snapshot: RelationshipScoreSnapshot, lang: SiteLang): string {
  const code = snapshot.score.climate;
  return CLIMATE_LABELS[code]?.[lang] ?? code;
}

export function renderRelationshipScorePanel(
  snapshot: RelationshipScoreSnapshot,
  lang: SiteLang
): string {
  const copy = COPY[lang];
  const { score, narrative, diffFromPrevious } = snapshot;
  const sourceLabel = snapshot.source === "live" ? copy.metaSource.live : copy.metaSource.demo;

  const axesHtml = RELATIONSHIP_AXES
    .map((axis) => renderAxisRow(score.axes[axis], copy, diffFromPrevious?.[axis] ?? null))
    .join("");

  const fallbackHint = narrative?.fallbackUsed ? `<small class="rs-fallback-hint">${escapeHtml(copy.fallbackHint)}</small>` : "";
  const nextActionText = narrative?.nextActionText ?? "";
  const summaryCard = narrative?.summaryCard ?? "";
  const seasonalNote = narrative?.seasonalNote ?? "";

  const siteLabel = snapshot.placeName ?? snapshot.placeId;
  const localityHtml = snapshot.localityLabel
    ? ` <span class="rs-meta-locality">(${escapeHtml(snapshot.localityLabel)})</span>`
    : "";

  return `<article class="rs-report" data-source="${escapeHtml(snapshot.source)}">
    <header class="rs-report-head">
      <div class="rs-report-eyebrow">
        <span class="rs-eyebrow-label">${escapeHtml(copy.eyebrow)}</span>
        <span class="rs-source-badge rs-source-${escapeHtml(snapshot.source)}">${escapeHtml(sourceLabel)}</span>
      </div>
      <h2 class="rs-site-name">${escapeHtml(siteLabel)}${localityHtml}</h2>
      <dl class="rs-meta">
        <div><dt>${escapeHtml(copy.metaPeriod)}</dt><dd>${escapeHtml(periodLabel(snapshot))}</dd></div>
        ${snapshot.industry ? `<div><dt>${escapeHtml(copy.metaIndustry)}</dt><dd>${escapeHtml(snapshot.industry)}</dd></div>` : ""}
        <div><dt>${escapeHtml(copy.metaClimate)}</dt><dd>${escapeHtml(climateLabel(snapshot, lang))}</dd></div>
      </dl>
    </header>
    <section class="rs-grid">
      <div class="rs-col rs-col-score">
        <div class="rs-gauge-wrap">${renderGauge(score.totalScore, copy)}</div>
        <ul class="rs-axes">${axesHtml}</ul>
      </div>
      <div class="rs-col rs-col-side">
        <section class="rs-side-section">
          <h3 class="rs-side-heading">${escapeHtml(copy.metricsHeading)}</h3>
          ${renderMetricsTable(snapshot, copy)}
        </section>
        <section class="rs-side-section">
          <h3 class="rs-side-heading">${escapeHtml(copy.topActionsHeading)}</h3>
          <p class="rs-side-lead">${escapeHtml(copy.topActionsLead)}</p>
          ${renderTopActions(snapshot, copy)}
          ${nextActionText ? `<p class="rs-narrative-action">${escapeHtml(nextActionText)} ${fallbackHint}</p>` : ""}
        </section>
        ${(summaryCard || seasonalNote) ? `<section class="rs-side-section">
          <h3 class="rs-side-heading">${escapeHtml(copy.evidenceHeading)}</h3>
          ${summaryCard ? `<p class="rs-narrative-summary">${escapeHtml(summaryCard)}</p>` : ""}
          ${seasonalNote ? `<p class="rs-narrative-seasonal">${escapeHtml(seasonalNote)}</p>` : ""}
        </section>` : ""}
      </div>
    </section>
    <footer class="rs-report-foot">
      <p class="rs-notice">${escapeHtml(copy.notice)}</p>
      <button type="button" class="rs-print-button" onclick="window.print()">${escapeHtml(copy.printButton)}</button>
    </footer>
  </article>`;
}

export const RELATIONSHIP_SCORE_PANEL_STYLES = `
.rs-report {
  margin: 24px auto;
  max-width: 920px;
  padding: 28px 32px 24px;
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 4px 18px rgba(15, 23, 42, 0.06);
  border: 1px solid rgba(15, 23, 42, 0.08);
  font-size: 13px;
  color: #0f172a;
}
.rs-report-head { border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; }
.rs-report-eyebrow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
}
.rs-eyebrow-label {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #047857;
  font-weight: 700;
}
.rs-source-badge {
  font-size: 10px;
  padding: 2px 10px;
  border-radius: 999px;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.rs-source-live { background: #dcfce7; color: #14532d; }
.rs-source-demo { background: #fef3c7; color: #92400e; }
.rs-site-name {
  margin: 4px 0 8px;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.25;
  color: #0f172a;
}
.rs-meta-locality { font-size: 13px; color: #64748b; font-weight: 500; }
.rs-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin: 0;
}
.rs-meta div { display: flex; gap: 6px; font-size: 12px; color: #475569; }
.rs-meta dt { font-weight: 600; color: #1e293b; }
.rs-meta dd { margin: 0; }

.rs-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
@media (max-width: 800px) { .rs-grid { grid-template-columns: 1fr; } }

.rs-col-score { display: flex; flex-direction: column; gap: 16px; }
.rs-gauge-wrap { display: flex; justify-content: center; }
.rs-gauge { width: 100%; max-width: 220px; height: auto; }
.rs-gauge-value { font-size: 36px; font-weight: 800; fill: #0f172a; }
.rs-gauge-unit { font-size: 11px; fill: #64748b; }

.rs-axes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.rs-axis-row { display: flex; flex-direction: column; gap: 4px; }
.rs-axis-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.rs-axis-label { font-weight: 600; font-size: 12px; color: #0f172a; }
.rs-axis-score { font-variant-numeric: tabular-nums; color: #475569; font-size: 11px; font-weight: 600; }
.rs-axis-bar { height: 7px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
.rs-axis-bar-fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #0284c7 100%);
  border-radius: 999px;
}
.rs-axis-hint { margin: 1px 0 0; font-size: 10px; color: #64748b; line-height: 1.4; }
.rs-axis-reason { margin: 1px 0 0; font-size: 10px; color: #0f172a; font-weight: 500; }
.rs-diff { font-size: 10px; padding: 1px 6px; border-radius: 999px; font-weight: 700; margin-left: 4px; }
.rs-diff-up { background: #d1fae5; color: #065f46; }
.rs-diff-down { background: #fee2e2; color: #991b1b; }

.rs-col-side { display: flex; flex-direction: column; gap: 14px; }
.rs-side-section { padding: 14px 16px; border-radius: 14px; background: #f8fafc; border: 1px solid #e2e8f0; }
.rs-side-heading {
  margin: 0 0 8px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #0f172a;
  font-weight: 700;
}
.rs-side-lead { margin: 0 0 8px; font-size: 11px; color: #475569; line-height: 1.5; }

.rs-metrics {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 14px;
}
.rs-metric { display: flex; justify-content: space-between; gap: 6px; font-size: 11px; color: #1e293b; padding: 4px 0; border-bottom: 1px dotted #e2e8f0; }
.rs-metric dt { color: #64748b; font-weight: 500; }
.rs-metric dd { margin: 0; font-weight: 700; font-variant-numeric: tabular-nums; }

.rs-top-actions { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.rs-top-action {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 8px 10px;
  background: #ffffff;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
}
.rs-top-rank {
  flex: 0 0 22px;
  width: 22px; height: 22px;
  border-radius: 50%;
  background: linear-gradient(135deg, #10b981 0%, #0284c7 100%);
  color: #ffffff;
  font-weight: 800;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.rs-top-body { flex: 1; min-width: 0; }
.rs-top-axis { margin: 0; font-size: 12px; font-weight: 600; color: #0f172a; }
.rs-top-score { margin: 0; font-size: 10px; color: #64748b; font-variant-numeric: tabular-nums; }
.rs-narrative-action { margin: 8px 0 0; padding: 8px 10px; background: #ecfdf5; border-radius: 8px; font-size: 12px; color: #065f46; line-height: 1.55; }
.rs-narrative-summary, .rs-narrative-seasonal { margin: 0 0 6px; font-size: 12px; color: #1e293b; line-height: 1.55; }
.rs-fallback-hint { display: inline-block; margin-left: 4px; font-size: 9px; color: #94a3b8; font-weight: 400; }

.rs-report-foot { margin-top: 18px; padding-top: 14px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.rs-notice {
  flex: 1;
  margin: 0;
  padding: 8px 12px;
  border-radius: 10px;
  background: #fffbeb;
  border-left: 3px solid #f59e0b;
  color: #78350f;
  font-size: 11px;
  line-height: 1.5;
}
.rs-print-button {
  flex: 0 0 auto;
  padding: 8px 16px;
  border: 0;
  border-radius: 999px;
  background: #0f172a;
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.rs-print-button:hover { background: #1e293b; }

@media print {
  .rs-print-button { display: none; }
  .rs-report {
    margin: 0;
    box-shadow: none;
    border: none;
    max-width: none;
    padding: 12mm;
    font-size: 10pt;
  }
  body { background: #ffffff; }
  .rs-grid { grid-template-columns: 1fr 1fr; }
  .rs-side-section { background: transparent; border: 1px solid #cbd5e1; }
  .rs-notice { background: transparent; border-left: 2px solid #f59e0b; }
}

@page { size: A4; margin: 10mm; }
`;
