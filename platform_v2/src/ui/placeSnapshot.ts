import type { PlaceSnapshot, PlaceSnapshotNextAction, PlaceSnapshotStewardshipComparison } from "../services/placeSnapshot.js";
import type { RelationshipAxis } from "../services/relationshipScore.js";
import { escapeHtml } from "./siteShell.js";

function fmtNumber(value: number): string {
  return new Intl.NumberFormat("ja-JP").format(value);
}

function fmtPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

const AXIS_LABEL: Record<RelationshipAxis, string> = {
  access: "触れられる",
  engagement: "続いている",
  learning: "学んでいる",
  stewardship: "手入れしている",
  evidence: "検証できる",
};

const ACTION_BADGE: Record<PlaceSnapshotNextAction["kind"], string> = {
  revisit: "再訪",
  evidence: "証拠",
  event: "観察会",
  stewardship: "手入れ",
  review: "レビュー",
};

function metric(label: string, value: string, note = ""): string {
  return `<div class="ps-metric">
    <strong>${escapeHtml(value)}</strong>
    <span>${escapeHtml(label)}</span>
    ${note ? `<small>${escapeHtml(note)}</small>` : ""}
  </div>`;
}

function progress(label: string, value: number, note: string): string {
  const width = Math.max(0, Math.min(100, value));
  return `<div class="ps-axis">
    <div class="ps-axis-head"><span>${escapeHtml(label)}</span><strong>${width}/20</strong></div>
    <div class="ps-bar"><i style="width:${width * 5}%"></i></div>
    <p>${escapeHtml(note)}</p>
  </div>`;
}

function actionCard(action: PlaceSnapshotNextAction): string {
  const inner = `<span class="ps-badge">${escapeHtml(ACTION_BADGE[action.kind])}</span>
    <h3>${escapeHtml(action.title)}</h3>
    <p>${escapeHtml(action.body)}</p>`;
  if (!action.href) {
    return `<article class="ps-card">${inner}</article>`;
  }
  return `<a class="ps-card ps-card-link" href="${escapeHtml(action.href)}">${inner}</a>`;
}

function actionKindLabel(kind: string): string {
  const labels: Record<string, string> = {
    cleanup: "清掃",
    mowing: "草刈り",
    invasive_removal: "撹乱種対応",
    patrol: "巡回",
    signage: "看板",
    monitoring: "モニタリング",
    external_program: "外部連携",
    restoration: "修復",
    community_engagement: "参加促進",
    other: "その他",
  };
  return labels[kind] ?? kind;
}

function limitationLabel(key: string): string {
  const labels: Record<string, string> = {
    baseline_missing: "事前観察が不足",
    followup_missing: "事後観察が不足",
    effort_not_aligned: "effort 未整列",
    small_sample: "サンプル小",
  };
  return labels[key] ?? key;
}

function signalLabel(key: string): string {
  const labels: Record<string, string> = {
    after_window_observed: "事後観察あり",
    before_after_comparable: "前後比較可能",
    taxa_seen_after_action: "事後に分類群記録あり",
    effort_recorded_after_action: "事後 effort あり",
    explicit_non_detection_after_action: "事後の非検出あり",
  };
  return labels[key] ?? key;
}

function stewardshipComparisonCard(comparison: PlaceSnapshotStewardshipComparison): string {
  const date = new Date(comparison.occurredAt);
  const dateText = Number.isNaN(date.getTime())
    ? comparison.occurredAt
    : date.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
  const signals = comparison.signals.length > 0
    ? comparison.signals.map((item) => `<span class="ps-chip">${escapeHtml(signalLabel(item))}</span>`).join("")
    : `<span class="ps-chip">観察待ち</span>`;
  const limitations = comparison.limitations.length > 0
    ? comparison.limitations.map((item) => `<span class="ps-chip ps-chip-muted">${escapeHtml(limitationLabel(item))}</span>`).join("")
    : `<span class="ps-chip">比較条件あり</span>`;
  return `<article class="ps-steward-card">
    <header>
      <span class="ps-badge">${escapeHtml(actionKindLabel(comparison.actionKind))}</span>
      <small>${escapeHtml(dateText)}</small>
    </header>
    <p>${escapeHtml(comparison.description ?? "活動メモは未入力です。")}</p>
    <div class="ps-before-after">
      <div><span>前30日</span><strong>${fmtNumber(comparison.before.visits)}</strong><small>訪問 / ${fmtNumber(comparison.before.uniqueTaxa)}分類群</small></div>
      <div><span>後30日</span><strong>${fmtNumber(comparison.after.visits)}</strong><small>訪問 / ${fmtNumber(comparison.after.uniqueTaxa)}分類群</small></div>
    </div>
    <div class="ps-chip-row">${signals}${limitations}</div>
  </article>`;
}

function renderStewardshipImpact(snapshot: PlaceSnapshot): string {
  const impact = snapshot.stewardshipImpact;
  const cards = impact.comparisons.length === 0
    ? `<article class="ps-card"><span class="ps-badge">施策評価</span><h3>手入れ記録を観察と結ぶ</h3><p>${escapeHtml(impact.summary)}</p></article>`
    : impact.comparisons.map(stewardshipComparisonCard).join("");
  return `<section class="ps-section">
    <div class="ps-section-head">
      <div>
        <div class="ps-eyebrow">Stewardship Impact</div>
        <h2>施策後の変化の兆し</h2>
      </div>
      <span class="ps-source">前後 ${impact.windowDays} 日</span>
    </div>
    <p class="ps-section-lead">${escapeHtml(impact.summary)}</p>
    <div class="ps-grid ps-grid-3">${cards}</div>
  </section>`;
}

export function renderPlaceSnapshotBody(snapshot: PlaceSnapshot): string {
  const s = snapshot.observationSummary;
  const seasonText = s.seasonLabels.length > 0 ? s.seasonLabels.join("・") : "これから";
  const areaText = snapshot.field.areaHa
    ? `${snapshot.field.areaHa.toFixed(2)} ha`
    : `半径 ${fmtNumber(snapshot.field.radiusM)} m`;
  const relationship = snapshot.relationshipScore.score;
  const hypotheses = snapshot.hypotheses.length === 0
    ? `<article class="ps-card"><span class="ps-badge">仮説</span><h3>まだ仮説は薄い</h3><p>まずは同じ範囲で観察を重ね、effort と季節をそろえる段階です。</p></article>`
    : snapshot.hypotheses.slice(0, 3).map((hypothesis) => `<article class="ps-card">
        <span class="ps-badge">${escapeHtml(hypothesis.claimType)}</span>
        <h3>${escapeHtml(hypothesis.hypothesisText)}</h3>
        <p>${escapeHtml(hypothesis.whatWeCanSay)}</p>
      </article>`).join("");

  const topTaxa = s.topTaxa.length === 0
    ? `<span class="ps-chip">観察待ち</span>`
    : s.topTaxa.slice(0, 8).map((taxon) => `<span class="ps-chip">${escapeHtml(taxon.name)} ×${fmtNumber(taxon.count)}</span>`).join("");

  return `<main class="ps-shell">
    <section class="ps-hero">
      <div>
        <div class="ps-eyebrow">${escapeHtml(snapshot.framing.publicLabel)} / ${escapeHtml(snapshot.field.sourceLabel)}</div>
        <h1>${escapeHtml(snapshot.field.name)}</h1>
        <p>${escapeHtml(snapshot.field.locationLabel)}。観察データ、季節、仮説、次の一手を1枚で読む場所のスナップショットです。</p>
      </div>
      <div class="ps-hero-side">
        <span>${escapeHtml(areaText)}</span>
        <strong>${relationship.totalScore}/100</strong>
        <small>${escapeHtml(snapshot.framing.monitoringLabel)}</small>
      </div>
    </section>

    <section class="ps-grid ps-grid-4" aria-label="summary metrics">
      ${metric("観察", fmtNumber(s.totalObservations))}
      ${metric("訪問・観察会", fmtNumber(s.totalVisits), `${fmtNumber(s.totalEvents)} events`)}
      ${metric("分類群", fmtNumber(s.uniqueTaxa))}
      ${metric("季節", seasonText)}
    </section>

    <section class="ps-section">
      <div class="ps-section-head">
        <div>
          <div class="ps-eyebrow">Relationship Score</div>
          <h2>人と自然の関係を見る</h2>
        </div>
        <span class="ps-source">${snapshot.relationshipScore.source === "relationship_score_snapshot" ? "live score" : "field fallback"}</span>
      </div>
      <div class="ps-grid ps-grid-5">
        ${(Object.keys(relationship.axes) as RelationshipAxis[]).map((axis) => progress(
          AXIS_LABEL[axis],
          relationship.axes[axis].score,
          relationship.axes[axis].reasons.join(" / "),
        )).join("")}
      </div>
    </section>

    ${renderStewardshipImpact(snapshot)}

    <section class="ps-section">
      <div class="ps-section-head">
        <div>
          <div class="ps-eyebrow">Monitoring Brief</div>
          <h2>団体運用で見るべき数字</h2>
        </div>
      </div>
      <div class="ps-grid ps-grid-4">
        ${metric("effort 充足", fmtPct(s.effortCompletionRate))}
        ${metric("レビュー受理", fmtPct(s.reviewAcceptedRate))}
        ${metric("在来 / 外来 / 不明", `${fmtNumber(s.nativeCount)} / ${fmtNumber(s.exoticCount)} / ${fmtNumber(s.unknownOriginCount)}`)}
        ${metric("非検出記録", fmtNumber(s.absentRecords))}
      </div>
      <div class="ps-chip-row">${topTaxa}</div>
    </section>

    <section class="ps-section">
      <div class="ps-section-head">
        <div>
          <div class="ps-eyebrow">Hypotheses</div>
          <h2>次に確認する仮説</h2>
        </div>
      </div>
      <div class="ps-grid ps-grid-3">${hypotheses}</div>
    </section>

    <section class="ps-section">
      <div class="ps-section-head">
        <div>
          <div class="ps-eyebrow">Next Actions</div>
          <h2>次に見ると面白いこと</h2>
        </div>
      </div>
      <div class="ps-grid ps-grid-4">${snapshot.nextActions.map(actionCard).join("")}</div>
    </section>

    <section class="ps-section ps-boundary">
      <div>
        <div class="ps-eyebrow">言えること</div>
        <ul>${snapshot.claimBoundary.canSay.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
      <div>
        <div class="ps-eyebrow">まだ言い切れないこと</div>
        <ul>${snapshot.claimBoundary.cannotSayYet.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
    </section>

    <section class="ps-footnote">
      <p>${escapeHtml(snapshot.framing.advancedLabel)}としての深部ビューです。表の入口は、これまで通り自然を楽しみ、また歩きたくなる体験に置きます。</p>
    </section>
  </main>`;
}

export function renderPlaceSnapshotTeaser(snapshot: PlaceSnapshot): string {
  const s = snapshot.observationSummary;
  const seasons = s.seasonLabels.length > 0 ? s.seasonLabels.join("・") : "これから";
  return `<section class="evt-card ps-teaser">
    <div>
      <span class="evt-eyebrow">この場所のいま</span>
      <h2 class="evt-heading">場所の状態を1枚で見る</h2>
      <p class="evt-lead">観察、季節、仮説、手入れ後の変化の兆しをまとめたスナップショットです。</p>
    </div>
    <div class="ps-teaser-metrics">
      <div><strong>${fmtNumber(s.totalObservations)}</strong><span>観察</span></div>
      <div><strong>${escapeHtml(seasons)}</strong><span>季節</span></div>
      <div><strong>${snapshot.relationshipScore.score.totalScore}</strong><span>関係指標</span></div>
    </div>
    <a class="evt-btn evt-btn-primary" href="/places/${encodeURIComponent(snapshot.field.fieldId)}/snapshot">この場所のいまを見る</a>
  </section>`;
}

export const PLACE_SNAPSHOT_STYLES = `
.ps-shell {
  max-width: 1160px;
  margin: 0 auto;
  padding: 28px 16px 64px;
  color: #0f172a;
}
.ps-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(180px, 260px);
  gap: 20px;
  align-items: stretch;
  padding: clamp(24px, 4vw, 42px);
  border-radius: 24px;
  background:
    linear-gradient(135deg, rgba(240,253,244,.96), rgba(240,249,255,.96)),
    #fff;
  border: 1px solid rgba(15,23,42,.08);
  box-shadow: 0 18px 42px rgba(15,23,42,.10);
}
.ps-eyebrow {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: #047857;
}
.ps-hero h1 {
  margin: 8px 0 10px;
  font-size: clamp(28px, 5vw, 48px);
  line-height: 1.12;
}
.ps-hero p {
  margin: 0;
  max-width: 64ch;
  color: #475569;
  line-height: 1.75;
}
.ps-hero-side {
  display: grid;
  align-content: center;
  gap: 6px;
  min-height: 160px;
  padding: 18px;
  border-radius: 18px;
  background: #0f172a;
  color: #ecfdf5;
}
.ps-hero-side span,
.ps-hero-side small {
  color: rgba(236,253,245,.78);
  font-size: 13px;
}
.ps-hero-side strong {
  font-size: clamp(34px, 5vw, 56px);
  line-height: 1;
}
.ps-section {
  margin-top: 28px;
}
.ps-section-lead {
  margin: -4px 0 12px;
  color: #64748b;
  line-height: 1.7;
}
.ps-section-head {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 16px;
  margin-bottom: 12px;
}
.ps-section h2 {
  margin: 4px 0 0;
  font-size: clamp(20px, 3vw, 28px);
}
.ps-source {
  border: 1px solid rgba(15,23,42,.10);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  color: #475569;
}
.ps-grid {
  display: grid;
  gap: 12px;
}
.ps-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.ps-grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.ps-grid-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.ps-metric,
.ps-card,
.ps-axis {
  border: 1px solid rgba(15,23,42,.08);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 22px rgba(15,23,42,.06);
}
.ps-metric {
  padding: 16px;
  min-height: 104px;
}
.ps-metric strong {
  display: block;
  font-size: clamp(24px, 4vw, 34px);
  line-height: 1.1;
}
.ps-metric span,
.ps-metric small {
  display: block;
  color: #64748b;
  margin-top: 4px;
}
.ps-axis {
  padding: 14px;
}
.ps-axis-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
  font-weight: 800;
}
.ps-bar {
  height: 8px;
  background: #e2e8f0;
  border-radius: 999px;
  overflow: hidden;
  margin: 10px 0;
}
.ps-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #10b981, #0ea5e9);
}
.ps-axis p,
.ps-card p {
  margin: 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}
.ps-card {
  display: block;
  padding: 16px;
  min-height: 150px;
  text-decoration: none;
  color: inherit;
}
.ps-card-link:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 30px rgba(15,23,42,.10);
}
.ps-card h3 {
  margin: 8px 0 8px;
  font-size: 16px;
  line-height: 1.45;
}
.ps-badge,
.ps-chip {
  display: inline-flex;
  border-radius: 999px;
  background: rgba(16,185,129,.10);
  border: 1px solid rgba(16,185,129,.20);
  color: #047857;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 800;
}
.ps-chip-muted {
  color: #475569;
  background: #f1f5f9;
  border-color: rgba(100,116,139,.20);
}
.ps-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}
.ps-steward-card {
  border: 1px solid rgba(15,23,42,.08);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 22px rgba(15,23,42,.06);
  padding: 16px;
}
.ps-steward-card header {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}
.ps-steward-card p {
  min-height: 42px;
  margin: 10px 0 12px;
  color: #475569;
  line-height: 1.6;
  font-size: 13px;
}
.ps-before-after {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.ps-before-after > div {
  border-radius: 12px;
  background: #f8fafc;
  padding: 10px;
}
.ps-before-after span,
.ps-before-after small {
  display: block;
  color: #64748b;
  font-size: 11px;
}
.ps-before-after strong {
  display: block;
  font-size: 24px;
}
.ps-teaser {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 360px) auto;
  align-items: center;
  gap: 14px;
  margin: 18px 0;
}
.ps-teaser-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.ps-teaser-metrics > div {
  border-radius: 12px;
  background: rgba(16,185,129,.08);
  padding: 10px;
}
.ps-teaser-metrics strong,
.ps-teaser-metrics span {
  display: block;
}
.ps-teaser-metrics strong {
  font-size: 20px;
  line-height: 1.2;
}
.ps-teaser-metrics span {
  color: #64748b;
  font-size: 11px;
}
.ps-boundary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.ps-boundary > div,
.ps-footnote {
  border-radius: 16px;
  padding: 18px;
  background: #f8fafc;
  border: 1px solid rgba(15,23,42,.08);
}
.ps-boundary ul {
  margin: 10px 0 0;
  padding-left: 18px;
  color: #475569;
  line-height: 1.75;
}
.ps-footnote {
  margin-top: 18px;
  color: #475569;
  line-height: 1.7;
}
.ps-footnote p { margin: 0; }
@media (max-width: 920px) {
  .ps-hero,
  .ps-boundary {
    grid-template-columns: 1fr;
  }
  .ps-grid-3,
  .ps-grid-4,
  .ps-grid-5 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .ps-teaser {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 560px) {
  .ps-shell { padding: 16px 12px 48px; }
  .ps-grid-3,
  .ps-grid-4,
  .ps-grid-5 {
    grid-template-columns: 1fr;
  }
  .ps-section-head {
    display: block;
  }
  .ps-source { display: inline-flex; margin-top: 8px; }
}
`;
