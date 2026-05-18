import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { getPool } from "../db.js";
import { getSessionFromCookie } from "../services/authSession.js";
import { loadGuideCorrectionEvalItems, summarizeGuideCorrectionEval } from "../services/guideCorrectionEval.js";
import { loadGuideEnvironmentMeshGeoJson, upsertGuideEnvironmentMeshFromRecord } from "../services/guideEnvironmentMesh.js";
import { loadGuideEnvironmentDashboardMetrics, type GuideEnvironmentDashboardMetrics } from "../services/guideEnvironmentOps.js";
import { recordGuideInteraction } from "../services/guideInteractions.js";
import { listGuideHypothesisPromptImprovements } from "../services/guideHypothesisPromptImprovements.js";
import { loadGuideTransectQualityForSessions, type GuideTransectQuality } from "../services/guideTransectQuality.js";
import {
  bundleGuideRecords,
  canonicalizeTaxonList,
  type GuideRecordBundle,
  type GuideRecordInsightRow,
} from "../services/guideRecordInsights.js";
import { listRegionalHypotheses, type RegionalHypothesisRecord } from "../services/regionalHypotheses.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";

type GuideRecordDebugRow = GuideRecordInsightRow;

type EditableFeature = { type: "species" | "vegetation" | "landform" | "structure" | "sound"; name: string; confidence?: number; note?: string };
type GuideOutcomeFilter = "all" | "saved" | "non_detection" | "not_retained" | "audio";

type CorrectionBody = {
  detectedSpecies?: unknown;
  detectedFeatures?: unknown;
  environmentContext?: unknown;
  seasonalNote?: unknown;
  note?: unknown;
  correctionKind?: unknown;
};

function parseOutcomeFilter(raw: unknown): GuideOutcomeFilter {
  return raw === "saved" || raw === "non_detection" || raw === "not_retained" || raw === "audio" ? raw : "all";
}

function rowAutoSave(row: GuideRecordDebugRow): Record<string, unknown> | null {
  const raw = row.meta?.autoSave;
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
}

function rowReasonCodes(row: GuideRecordDebugRow): string[] {
  const codes = rowAutoSave(row)?.reasonCodes;
  return Array.isArray(codes) ? codes.map(String) : [];
}

function rowAbsenceState(row: GuideRecordDebugRow): string {
  const guideSignals = row.meta?.guideSignals;
  if (!guideSignals || typeof guideSignals !== "object" || Array.isArray(guideSignals)) return "";
  const absenceBoundary = (guideSignals as Record<string, unknown>).absenceBoundary;
  if (!absenceBoundary || typeof absenceBoundary !== "object" || Array.isArray(absenceBoundary)) return "";
  return String((absenceBoundary as Record<string, unknown>).state ?? "");
}

function isNotRetainedGuideRow(row: GuideRecordDebugRow): boolean {
  return rowAutoSave(row)?.decision === "skip" || row.delivery_state === "archived" || row.seen_state === "dismissed";
}

function isNonDetectionGuideRow(row: GuideRecordDebugRow): boolean {
  const absenceState = rowAbsenceState(row);
  return rowReasonCodes(row).includes("non_detection_record")
    || absenceState === "searched_not_found"
    || absenceState === "absence_candidate";
}

function isSavedGuideRow(row: GuideRecordDebugRow): boolean {
  return !isNotRetainedGuideRow(row);
}

function filterGuideRows(rows: GuideRecordDebugRow[], filter: GuideOutcomeFilter): GuideRecordDebugRow[] {
  if (filter === "saved") return rows.filter(isSavedGuideRow);
  if (filter === "non_detection") return rows.filter(isNonDetectionGuideRow);
  if (filter === "not_retained") return rows.filter(isNotRetainedGuideRow);
  if (filter === "audio") return rows.filter((row) => Boolean(row.has_promotable_audio));
  return rows;
}

function loginGate(nextPath = "/me/guide-records"): string {
  return `
<div class="grd-wrap">
  <section class="grd-empty">
    <h1>ガイド成果を見るにはログインが必要です</h1>
    <p>歩いて見つけたことを、あとで見返せる自分の成果としてまとめます。</p>
    <div class="grd-actions">
      <a class="grd-primary-link" href="/login?redirect=${encodeURIComponent(nextPath)}">ログインして確認する</a>
      <a class="grd-secondary-link" href="/guide">ライブガイドへ</a>
    </div>
    <div class="grd-loop-mini" aria-label="ガイド成果までの流れ">
      <span><b>1</b>歩いて見つける</span>
      <span><b>2</b>今日できたことを見る</span>
      <span><b>3</b>次に1つだけ足す</span>
    </div>
  </section>
</div>`;
}

function featureTypeLabel(type: string): string {
  switch (type) {
    case "species": return "種";
    case "vegetation": return "植生";
    case "landform": return "地形・土地";
    case "structure": return "人工物・管理";
    case "sound": return "音";
    default: return "手がかり";
  }
}

function featureClass(type: string): string {
  if (type === "vegetation") return "is-vegetation";
  if (type === "landform") return "is-landform";
  if (type === "structure") return "is-structure";
  if (type === "sound") return "is-sound";
  return "is-species";
}

function formatTime(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function renderRegionalHypothesisPanel(rows: RegionalHypothesisRecord[]): string {
  const cards = rows.length === 0
    ? `<p class="grd-muted">まだ地域仮説は生成されていません。npm run generate:regional-hypotheses で deterministic な候補を作成できます。</p>`
    : rows.slice(0, 6).map((row) => `
      <article class="grd-hypothesis-card">
        <div class="grd-card-meta">
          <span>${escapeHtml(row.claimType)}</span>
          <span>confidence ${Math.round(row.confidence * 100)}%</span>
        </div>
        <h3>${escapeHtml(row.hypothesisText)}</h3>
        <p>${escapeHtml(row.whatWeCanSay)}</p>
        <div class="grd-chip-row">
          ${row.missingData.slice(0, 5).map((item) => `<span class="grd-chip">${escapeHtml(item)}</span>`).join("")}
        </div>
        <p class="grd-muted">${escapeHtml(row.nextSamplingProtocol)}</p>
        <div class="grd-feedback-row" data-feedback-status>
          <button type="button" data-guide-hypothesis-feedback="helpful" data-hypothesis-id="${escapeHtml(row.hypothesisId)}">役に立った</button>
          <button type="button" data-guide-hypothesis-feedback="wrong" data-hypothesis-id="${escapeHtml(row.hypothesisId)}">違う</button>
        </div>
      </article>
    `).join("");
  return `
    <section class="grd-panel grd-hypotheses">
      <h2>見え始めている地域仮説</h2>
      <p class="grd-muted">ここでは断言ではなく、根拠・バイアス・不足データ・次の観察指示をセットで出します。</p>
      <div class="grd-hypothesis-grid">${cards}</div>
    </section>`;
}

function renderGuideEnvironmentOpsPanel(metrics: GuideEnvironmentDashboardMetrics): string {
  const latest = metrics.latestRun;
  const latestRows = latest ? [
    ["status", latest.status],
    ["trigger", latest.triggerSource],
    ["diagnosis", latest.diagnosisDate],
    ["rebuild", latest.rebuildAction],
    ["guide_records", String(latest.guideRecordCount)],
    ["public_mesh", String(latest.publicMeshCellCount)],
    ["threshold_suppressed", String(latest.suppressedMeshCellCount)],
    ["hypotheses_written", String(latest.hypothesesWritten)],
    ["eval_items", String(latest.evalItemsCount)],
    ["prompt_improvements", String(latest.promptImprovementsWritten)],
  ].map(([label, value]) => `<div class="grd-eval-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")
    : `<p class="grd-muted">まだ refresh run は記録されていません。次の deploy/timer 実行後にここへ残ります。</p>`;
  const totals = metrics.totals;
  return `
    <section class="grd-panel grd-eval">
      <h2>地域仮説オペレーション</h2>
      <div class="grd-ops-grid">
        <div class="grd-ops-stack">
          <h3>最新実行</h3>
          ${latestRows}
          ${latest?.errorMessage ? `<p class="grd-error">${escapeHtml(latest.errorMessage)}</p>` : ""}
        </div>
        <div class="grd-ops-stack">
          <h3>蓄積状況</h3>
          <div class="grd-eval-row"><span>mesh_cells</span><strong>${totals.meshCells}</strong></div>
          <div class="grd-eval-row"><span>public_mesh_cells</span><strong>${totals.publicMeshCells}</strong></div>
          <div class="grd-eval-row"><span>regional_hypotheses</span><strong>${totals.hypotheses}</strong></div>
          <div class="grd-eval-row"><span>helpful</span><strong>${totals.helpfulInteractions}</strong></div>
          <div class="grd-eval-row"><span>wrong</span><strong>${totals.wrongInteractions}</strong></div>
          <div class="grd-eval-row"><span>prompt_improvements</span><strong>${totals.promptImprovements}</strong></div>
        </div>
      </div>
      <p class="grd-muted">helpful/wrong は生態学的証拠ではなく、次回観察指示の改善だけに使います。</p>
    </section>`;
}

function renderPromptImprovementPanel(rows: Array<{ recommendation: string; promptPatch: string; supportCount: number; label: string; claimType: string }>): string {
  const cards = rows.length === 0
    ? `<p class="grd-muted">まだ helpful/wrong 由来の prompt 改善候補はありません。</p>`
    : rows.slice(0, 4).map((row) => `
      <article class="grd-improvement-card">
        <div class="grd-card-meta">
          <span>${escapeHtml(row.label)}</span>
          <span>${escapeHtml(row.claimType || "global")}</span>
          <span>${row.supportCount}件</span>
        </div>
        <p>${escapeHtml(row.recommendation)}</p>
        <pre>${escapeHtml(row.promptPatch)}</pre>
      </article>`).join("");
  return `
    <section class="grd-panel">
      <h2>次回観察指示の改善候補</h2>
      <div class="grd-improvement-grid">${cards}</div>
    </section>`;
}

function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 24);
  }
  if (typeof value !== "string") return [];
  return value.split(/[,\n、]/).map((item) => item.trim()).filter(Boolean).slice(0, 24);
}

function parseEditableFeatures(value: unknown): EditableFeature[] {
  const rows = Array.isArray(value) ? value : [];
  return rows
    .map((item) => item && typeof item === "object" ? item as Record<string, unknown> : null)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => {
      const rawType = String(item.type ?? "");
      const type = ["species", "vegetation", "landform", "structure", "sound"].includes(rawType)
        ? rawType as EditableFeature["type"]
        : "structure";
      const confidence = Number(item.confidence);
      return {
        type,
        name: String(item.name ?? "").trim(),
        confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : undefined,
        note: typeof item.note === "string" && item.note.trim() ? item.note.trim().slice(0, 180) : undefined,
      };
    })
    .filter((item) => item.name)
    .slice(0, 40);
}

async function loadGuideRecords(userId: string, limit: number): Promise<GuideRecordDebugRow[]> {
  const result = await getPool().query<GuideRecordDebugRow>(
    `select gr.guide_record_id::text as guide_record_id,
            gr.session_id,
            gr.occurrence_id,
            gr.lat,
            gr.lng,
            gr.scene_summary,
            gr.detected_species,
            gr.detected_features,
            gr.created_at::text as created_at,
            gls.captured_at::text as captured_at,
            gls.returned_at::text as returned_at,
            gls.delivery_state,
            gls.seen_state,
            gls.environment_context,
            gls.seasonal_note,
            gls.primary_subject,
            gls.meta,
            exists (
              select 1
                from audio_segments audio
               where audio.session_id = gr.session_id
                 and audio.user_id = gr.user_id
                 and audio.blob_id is not null
                 and audio.privacy_status = 'clean'
                 and coalesce(audio.voice_flag, false) = false
                 and coalesce(audio.transcription_status, 'pending') <> 'skipped'
                 and abs(extract(epoch from (audio.recorded_at - coalesce(gls.captured_at, gls.returned_at, gr.created_at)))) <= 120
               limit 1
            ) as has_promotable_audio
       from guide_records gr
       left join guide_record_latency_states gls on gls.guide_record_id = gr.guide_record_id
      where gr.user_id = $1
      order by gr.created_at desc
      limit $2`,
    [userId, limit],
  );
  return result.rows;
}

type GuideCommunityContributionSummary = {
  personalPublicMeshCells: number;
  communityPublicMeshCells: number;
  communityGuideRecordCount: number;
  communityContributorCount: number;
  communityTopFeatures: Array<{ name: string; count: number; type: string }>;
};

function normalizeCountMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    const count = Number(value);
    if (key && Number.isFinite(count) && count > 0) out[key] = Math.round(count * 1000) / 1000;
  }
  return out;
}

function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function mergeFeatureCounts(target: Map<string, { name: string; type: string; count: number }>, raw: unknown, type: string): void {
  for (const [name, count] of Object.entries(normalizeCountMap(raw))) {
    const key = `${type}:${name}`;
    const existing = target.get(key);
    if (existing) {
      existing.count = Math.round((existing.count + count) * 1000) / 1000;
    } else {
      target.set(key, { name, type, count });
    }
  }
}

function guideContributorHash(userId: string): string {
  return createHash("sha256").update(`guide-env:${userId}`).digest("hex").slice(0, 16);
}

async function loadGuideCommunityContributionSummary(userId: string, meshKeys: string[]): Promise<GuideCommunityContributionSummary> {
  const personalMeshKeys = new Set(meshKeys.filter(Boolean));
  const ownContributorHash = guideContributorHash(userId);
  const result = await getPool().query<{
    mesh_key: string;
    guide_record_count: number;
    contributor_hashes: unknown;
    vegetation_counts: unknown;
    landform_counts: unknown;
    structure_counts: unknown;
    sound_counts: unknown;
  }>(
    `select mesh_key,
            guide_record_count,
            contributor_hashes,
            vegetation_counts,
            landform_counts,
            structure_counts,
            sound_counts
       from guide_environment_mesh_cells
      where guide_record_count >= 3 or contributor_count >= 2
      order by last_seen_at desc nulls last, guide_record_count desc
      limit 1000`,
  );
  const contributorHashes = new Set<string>();
  const featureCounts = new Map<string, { name: string; type: string; count: number }>();
  let communityGuideRecordCount = 0;
  let personalPublicMeshCells = 0;
  let communityPublicMeshCells = 0;
  for (const row of result.rows) {
    const rowContributorHashes = normalizeStringArray(row.contributor_hashes);
    const includesOwnContribution = rowContributorHashes.includes(ownContributorHash);
    if (personalMeshKeys.has(row.mesh_key)) personalPublicMeshCells += 1;
    if (includesOwnContribution) continue;
    communityPublicMeshCells += 1;
    communityGuideRecordCount += Number(row.guide_record_count) || 0;
    for (const hash of rowContributorHashes) contributorHashes.add(hash);
    mergeFeatureCounts(featureCounts, row.vegetation_counts, "vegetation");
    mergeFeatureCounts(featureCounts, row.landform_counts, "landform");
    mergeFeatureCounts(featureCounts, row.structure_counts, "structure");
    mergeFeatureCounts(featureCounts, row.sound_counts, "sound");
  }
  return {
    personalPublicMeshCells,
    communityPublicMeshCells,
    communityGuideRecordCount,
    communityContributorCount: contributorHashes.size,
    communityTopFeatures: Array.from(featureCounts.values())
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"))
      .slice(0, 8),
  };
}

async function addNextSamplingToBundles(bundles: GuideRecordBundle[]): Promise<GuideRecordBundle[]> {
  const meshKeys = Array.from(new Set(bundles.map((bundle) => bundle.meshKey).filter((meshKey): meshKey is string => Boolean(meshKey))));
  const byMesh = new Map<string, RegionalHypothesisRecord>();
  await Promise.all(meshKeys.map(async (meshKey) => {
    const rows = await listRegionalHypotheses({ meshKey, limit: 3, publicOnly: true }).catch(() => []);
    const hypothesis = rows.find((row) => row.nextSamplingProtocol.trim().length > 0);
    if (hypothesis) byMesh.set(meshKey, hypothesis);
  }));
  return bundles.map((bundle) => ({
    ...bundle,
    regionalHypothesisId: bundle.meshKey ? byMesh.get(bundle.meshKey)?.hypothesisId : undefined,
    regionalHypothesisClaimType: bundle.meshKey ? byMesh.get(bundle.meshKey)?.claimType : undefined,
    nextSamplingProtocol: bundle.meshKey ? byMesh.get(bundle.meshKey)?.nextSamplingProtocol : undefined,
  }));
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatMeters(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}km`;
  return `${Math.round(value)}m`;
}

type OwnGuideFeatureCounts = Record<"vegetation" | "landform" | "sound" | "species", number>;

function countOwnFeatures(rows: GuideRecordDebugRow[]): OwnGuideFeatureCounts {
  const counts: OwnGuideFeatureCounts = { vegetation: 0, landform: 0, sound: 0, species: 0 };
  for (const row of rows) {
    for (const feature of row.detected_features ?? []) {
      const type = String(feature.type ?? "");
      if (type === "vegetation" || type === "landform" || type === "sound" || type === "species") counts[type] += 1;
    }
    counts.species += (row.detected_species ?? []).filter(Boolean).length;
  }
  return counts;
}

function renderFeatureContributionChips(features: Array<{ name: string; count: number; type: string }>): string {
  if (features.length === 0) return `<span class="grd-muted">公開条件を満たした集計はまだありません</span>`;
  return features.map((feature) => `<span class="grd-chip">${escapeHtml(featureTypeLabel(feature.type))}: ${escapeHtml(feature.name)} ${Math.round(feature.count)}</span>`).join("");
}

function renderOutcomeContributionPanel(
  rows: GuideRecordDebugRow[],
  bundles: GuideRecordBundle[],
  qualityBySession: Map<string, GuideTransectQuality>,
  community: GuideCommunityContributionSummary | null,
): string {
  const sessions = new Set(rows.map((row) => row.session_id).filter(Boolean));
  const ownFeatures = countOwnFeatures(rows);
  const totalDistance = Array.from(qualityBySession.values()).reduce((sum, item) => sum + item.distanceM, 0);
  const personalPublicMeshCells = community?.personalPublicMeshCells ?? 0;
  const communityPublicMeshCells = community?.communityPublicMeshCells ?? 0;
  const communityGuideRecordCount = community?.communityGuideRecordCount ?? 0;
  const communityContributorCount = community?.communityContributorCount ?? 0;
  return `
<section class="grd-panel grd-outcome-impact">
  <div class="grd-outcome-head">
    <div>
      <h2>今回のガイドの成果</h2>
      <p class="grd-muted">自分には記録・代表カード・走行距離を見せます。公開側は100mメッシュ以上の集計だけを使い、通勤ルートや個人の移動線は出しません。</p>
    </div>
    <a class="grd-secondary-link" href="/community/guide-environment">匿名コミュニティ成果を見る</a>
  </div>
  <div class="grd-outcome-grid">
    <article>
      <span>自分の成果</span>
      <strong>${rows.length}</strong>
      <p>ガイド記録 / ${bundles.length}代表カード / ${sessions.size}セッション</p>
    </article>
    <article>
      <span>拾えた手がかり</span>
      <strong>${ownFeatures.vegetation + ownFeatures.landform + ownFeatures.sound + ownFeatures.species}</strong>
      <p>植生${ownFeatures.vegetation}・地形${ownFeatures.landform}・音${ownFeatures.sound}・種候補${ownFeatures.species}</p>
    </article>
    <article>
      <span>車窓ガイド距離</span>
      <strong>${formatMeters(totalDistance)}</strong>
      <p>本人向けの非公開ルート点から算出。公開地図には出しません。</p>
    </article>
    <article>
      <span>地域レイヤー反映</span>
      <strong>${personalPublicMeshCells}</strong>
      <p>低件数を抑制した公開メッシュに入った自分の周辺セル</p>
    </article>
  </div>
  <div class="grd-community-impact">
    <div>
      <h3>他の人のガイド成果から見えること</h3>
      <p class="grd-muted">他ユーザーの成果は、公開条件を満たしたメッシュだけで表示します。個別の出発地・到着地・通勤ルートは復元できません。</p>
    </div>
    <div class="grd-community-stats">
      <span><b>${communityPublicMeshCells}</b>公開メッシュ</span>
      <span><b>${communityGuideRecordCount}</b>集計済み記録</span>
      <span><b>${communityContributorCount}</b>匿名寄与者</span>
    </div>
    <div class="grd-chip-row">${renderFeatureContributionChips(community?.communityTopFeatures ?? [])}</div>
  </div>
</section>`;
}

function renderSummaryStats(rows: GuideRecordDebugRow[], bundles: GuideRecordBundle[], qualityBySession: Map<string, GuideTransectQuality>): string {
  const featureCounts = new Map<string, number>();
  let withLatLng = 0;
  for (const row of rows) {
    if (row.lat != null && row.lng != null) withLatLng += 1;
    for (const feature of row.detected_features ?? []) {
      const type = String(feature.type ?? "unknown");
      featureCounts.set(type, (featureCounts.get(type) ?? 0) + 1);
    }
  }
  const featureHtml = ["vegetation", "landform", "structure", "species", "sound"]
    .map((type) => `<span class="grd-stat"><strong>${featureCounts.get(type) ?? 0}</strong>${escapeHtml(featureTypeLabel(type))}</span>`)
    .join("");
  const qualities = Array.from(qualityBySession.values());
  const totalDistance = qualities.reduce((sum, item) => sum + item.distanceM, 0);
  const avgAccuracy = qualities
    .map((item) => item.avgAccuracyM)
    .filter((value): value is number => value != null)
    .reduce((sum, value, _index, arr) => sum + (value / Math.max(1, arr.length)), 0);
  const coverageSlots = new Set(qualities.flatMap((item) => item.coverageSlots)).size;
  return `
<section class="grd-stats">
  <span class="grd-stat"><strong>${rows.length}</strong>最新記録</span>
  <span class="grd-stat"><strong>${bundles.length}</strong>代表カード</span>
  <span class="grd-stat"><strong>${withLatLng}</strong>位置つき</span>
  <span class="grd-stat"><strong>${formatMeters(totalDistance)}</strong>車ガイド距離</span>
  <span class="grd-stat"><strong>${avgAccuracy ? `${Math.round(avgAccuracy)}m` : "-"}</strong>平均位置精度</span>
  <span class="grd-stat"><strong>${coverageSlots}</strong>coverage slots</span>
  ${featureHtml}
</section>`;
}

function topCountEntries(values: Record<string, number>, labels: Record<string, string>): string {
  return Object.entries(values)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([key, count]) => `<span class="grd-chip">${escapeHtml(labels[key] ?? key)} ${count}</span>`)
    .join("");
}

function renderGuideQualityPanel(qualityBySession: Map<string, GuideTransectQuality>): string {
  const qualities = Array.from(qualityBySession.values()).sort((a, b) => b.pointCount - a.pointCount).slice(0, 6);
  if (qualities.length === 0) {
    return `<section class="grd-panel"><h2>車ガイド品質</h2><p class="grd-muted">車ガイドの非公開ルート点はまだありません。次回の車モード利用から、位置精度・距離・速度帯・Coverage Cube スロットを確認できます。</p></section>`;
  }
  const speedLabels: Record<string, string> = {
    slow: "低速",
    urban_slow: "市街地低速",
    vehicle_transect: "車窓調査",
    fast_vehicle: "高速移動",
    unknown_speed: "速度不明",
  };
  const timeLabels: Record<string, string> = {
    morning: "朝",
    daytime: "昼",
    evening: "夕方",
    night: "夜",
    unknown_time: "時刻不明",
  };
  const cards = qualities.map((quality) => `
    <article class="grd-quality-card">
      <header>
        <h3>${escapeHtml(quality.sessionId)}</h3>
        <strong>${quality.effortQualityScore}</strong>
      </header>
      <div class="grd-quality-grid">
        <span><b>${quality.pointCount}</b> route points</span>
        <span><b>${formatMeters(quality.distanceM)}</b> distance</span>
        <span><b>${quality.effortMinutes.toFixed(1)}分</b> effort</span>
        <span><b>${quality.avgAccuracyM != null ? `${quality.avgAccuracyM}m` : "-"}</b> accuracy</span>
        <span><b>${pct(quality.goodAccuracyRate)}</b> good GPS</span>
        <span><b>${pct(quality.duplicateCellRate)}</b> duplicate cells</span>
        <span><b>${quality.distinctCellCount}</b> mesh cells</span>
        <span><b>${quality.coverageSlotCount}</b> coverage slots</span>
      </div>
      <div class="grd-chip-row">${topCountEntries(quality.speedBands, speedLabels)}${topCountEntries(quality.timeBands, timeLabels)}</div>
      <p class="grd-muted">Sampling protocol: guide_vehicle_transect_v1。生ルートは本人/管理用、公開面はメッシュ集計のみ。</p>
    </article>`).join("");
  return `<section class="grd-panel"><h2>車ガイド品質・Coverage Cube</h2><p class="grd-muted">距離、時間、位置精度、重複セル率、速度帯、時間帯を使い、車窓ガイドを走行調査セッションとして評価します。</p><div class="grd-quality-list">${cards}</div></section>`;
}

function renderFeaturePills(features: GuideRecordDebugRow["detected_features"]): string {
  const items = (features ?? []).slice(0, 12);
  if (items.length === 0) return `<span class="grd-muted">特徴なし</span>`;
  return items.map((feature) => {
    const type = String(feature.type ?? "unknown");
    const confidence = typeof feature.confidence === "number" ? ` ${(feature.confidence * 100).toFixed(0)}%` : "";
    const note = feature.note ? ` / ${feature.note}` : "";
    return `<span class="grd-pill ${featureClass(type)}"><b>${escapeHtml(featureTypeLabel(type))}</b>${escapeHtml(feature.name ?? "")}${escapeHtml(confidence)}${escapeHtml(note)}</span>`;
  }).join("");
}

function featuresToTextarea(features: GuideRecordDebugRow["detected_features"]): string {
  return (features ?? []).map((feature) => {
    const confidence = typeof feature.confidence === "number" ? feature.confidence.toFixed(2) : "";
    return [feature.type ?? "structure", feature.name ?? "", confidence, feature.note ?? ""].join(" | ");
  }).join("\n");
}

function renderRouteTransect(bundles: GuideRecordBundle[], qualityBySession: Map<string, GuideTransectQuality>): string {
  const bySession = new Map<string, GuideRecordBundle[]>();
  for (const bundle of bundles) {
    if (!bundle.sessionId) continue;
    const list = bySession.get(bundle.sessionId) ?? [];
    list.push(bundle);
    bySession.set(bundle.sessionId, list);
  }
  const sessions = Array.from(bySession.entries())
    .map(([sessionId, items]) => [sessionId, items.slice().reverse()] as const)
    .filter(([, items]) => items.some((item) => item.representative.lat != null && item.representative.lng != null))
    .slice(0, 4);
  if (sessions.length === 0) {
    return `<section class="grd-panel"><h2>ルート断面</h2><p class="grd-muted">位置つきのガイド記録がまだありません。</p></section>`;
  }
  const sessionHtml = sessions.map(([sessionId, items]) => {
    let totalM = 0;
    let prev: { lat: number; lng: number } | null = null;
    const segments = items.map((bundle, index) => {
      const item = bundle.representative;
      if (item.lat != null && item.lng != null) {
        const current = { lat: item.lat, lng: item.lng };
        if (prev) totalM += metersBetween(prev, current);
        prev = current;
      }
      const features = bundle.features.filter((feature) => ["vegetation", "landform", "structure"].includes(String(feature.type)));
      const primary = features[0]?.name ?? item.environment_context ?? item.scene_summary ?? "環境手がかり";
      return `<li class="grd-transect-step">
        <span class="grd-step-dot">${index + 1}</span>
        <div>
          <div class="grd-step-title">${escapeHtml(primary)}</div>
          <div class="grd-step-meta">${escapeHtml(formatTime(bundle.startAt))} / ${bundle.recordCount}件を代表 ${item.lat != null && item.lng != null ? ` / ${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}` : ""}</div>
          <div class="grd-step-pills">${renderFeaturePills(features)}</div>
        </div>
      </li>`;
    }).join("");
    return `<article class="grd-session">
      <header><h3>${escapeHtml(sessionId)}</h3><span>${items.length} points / 約${Math.round(totalM)}m${qualityBySession.get(sessionId) ? ` / GPS ${qualityBySession.get(sessionId)?.pointCount}点 / quality ${qualityBySession.get(sessionId)?.effortQualityScore}` : ""}</span></header>
      <ol class="grd-transect">${segments}</ol>
    </article>`;
  }).join("");
  return `<section class="grd-panel"><h2>植生・土地利用のルート断面</h2>${sessionHtml}</section>`;
}

function renderRouteMap(): string {
  return `<section class="grd-panel">
    <div class="grd-map-head">
      <div>
        <h2>地図レイヤー</h2>
        <p>自分のガイド記録から、植生・土地利用の点とルート線をGeoJSONで重ねます。集計済みメッシュは個人ルートを出さず地域レイヤーに使えます。</p>
      </div>
      <div class="grd-map-links">
        <a href="/api/v1/me/guide-records/route-layer.geojson?limit=500" target="_blank" rel="noreferrer">個人GeoJSON</a>
        <a href="/api/v1/guide/environment-mesh.geojson?limit=500" target="_blank" rel="noreferrer">地域メッシュ</a>
      </div>
    </div>
    <div class="grd-map" id="grd-map"><span>地図を読み込み中</span></div>
  </section>`;
}

function renderEnvironmentMeshMap(): string {
  return `<section class="grd-panel">
    <div class="grd-map-head">
      <div>
        <h2>地域メッシュ</h2>
        <p>公開表示では、低件数セルを抑制し、個人ルートではなく集計済みの植生・土地利用手がかりだけを表示します。</p>
      </div>
      <div class="grd-map-links">
        <a href="/api/v1/guide/environment-mesh.geojson?limit=1000&public=1" target="_blank" rel="noreferrer">公開GeoJSON</a>
      </div>
    </div>
    <div class="grd-map" id="grd-map"><span>地域メッシュを読み込み中</span></div>
  </section>`;
}

function renderRecordCards(bundles: GuideRecordBundle[]): string {
  if (bundles.length === 0) {
    return `<section class="grd-empty"><h1>ガイド記録はまだありません</h1><p>ライブガイドで解析が完了した記録がここに出ます。</p></section>`;
  }
  return `<section class="grd-grid">${bundles.map((bundle) => {
    const row = bundle.representative;
    const guideMode = typeof row.meta?.guideMode === "string" ? row.meta.guideMode : "walk";
    const species = bundle.canonicalTaxa.length > 0 ? bundle.canonicalTaxa : canonicalizeTaxonList(row.detected_species ?? []);
    const promotedOccurrenceId = typeof row.occurrence_id === "string" && row.occurrence_id.trim() ? row.occurrence_id.trim() : "";
    const promotedVisitId = promotedOccurrenceId.replace(/^occ:/, "").replace(/:0$/, "");
    const promotionAction = promotedOccurrenceId
      ? `<a class="grd-primary-action" href="/observations/${escapeHtml(encodeURIComponent(promotedVisitId))}?occurrence=${escapeHtml(encodeURIComponent(promotedOccurrenceId))}">観察を見る</a>`
      : row.has_promotable_audio
        ? `<button class="grd-primary-action" type="button" data-guide-promote-id="${escapeHtml(row.guide_record_id)}">観察レコードにする</button>`
        : `<a class="grd-primary-action" href="/record?source=guide&guideRecordId=${escapeHtml(row.guide_record_id)}">写真を追加して観察にする</a>`;
    return `<article class="grd-card">
      <div class="grd-card-head">
        <span>${escapeHtml(formatTime(bundle.startAt))}${bundle.recordCount > 1 ? ` - ${escapeHtml(formatTime(bundle.endAt))}` : ""}</span>
        <span>${escapeHtml(guideMode === "vehicle" ? "車・自転車" : "徒歩")}</span>
      </div>
      <div class="grd-bundle-meta"><span>代表カード</span><strong>${bundle.recordCount}</strong>件 / ${bundle.durationSec}秒</div>
      <h2>${escapeHtml(row.scene_summary ?? "記録要約なし")}</h2>
      ${row.environment_context ? `<p class="grd-env">${escapeHtml(row.environment_context)}</p>` : ""}
      ${row.seasonal_note ? `<p class="grd-season">${escapeHtml(row.seasonal_note)}</p>` : ""}
      <div class="grd-species">${species.length ? species.map((item) => `<span title="${escapeHtml(item.sourceNames.join(", "))}">${escapeHtml(item.canonicalName)}<small>${escapeHtml(item.rank)}</small></span>`).join("") : `<span class="grd-muted">種名なし</span>`}</div>
      <div class="grd-features">${renderFeaturePills(bundle.features)}</div>
      ${bundle.nextSamplingProtocol ? `<section class="grd-next-sampling"><b>次に見る</b><p>${escapeHtml(bundle.nextSamplingProtocol)}</p></section>` : ""}
      <p class="grd-claim-limit">AIガイド成果は未検証候補です。通常観察にするには、写真または privacy-safe な音声証拠が必要です。</p>
      <nav class="grd-card-actions" aria-label="このガイド成果の次の行動">
        ${promotionAction}
        <a href="/guide">同じ場所でもう一度ガイド</a>
        <a href="/map">地図で見る</a>
      </nav>
      <div class="grd-promote-status" data-guide-promote-status="${escapeHtml(row.guide_record_id)}"></div>
      <div class="grd-feedback-row" data-feedback-status>
        <button type="button"
          data-guide-bundle-feedback="helpful"
          data-guide-record-id="${escapeHtml(row.guide_record_id)}"
          data-session-id="${escapeHtml(bundle.sessionId)}"
          data-bundle-id="${escapeHtml(bundle.bundleId)}"
          data-bundle-record-count="${bundle.recordCount}"
          data-hypothesis-id="${escapeHtml(bundle.regionalHypothesisId ?? "")}">役に立つ</button>
        <button type="button"
          data-guide-bundle-feedback="merge_ok"
          data-guide-record-id="${escapeHtml(row.guide_record_id)}"
          data-session-id="${escapeHtml(bundle.sessionId)}"
          data-bundle-id="${escapeHtml(bundle.bundleId)}"
          data-bundle-record-count="${bundle.recordCount}"
          data-hypothesis-id="${escapeHtml(bundle.regionalHypothesisId ?? "")}">束ね方OK</button>
        <button type="button"
          data-guide-bundle-feedback="wrong"
          data-guide-record-id="${escapeHtml(row.guide_record_id)}"
          data-session-id="${escapeHtml(bundle.sessionId)}"
          data-bundle-id="${escapeHtml(bundle.bundleId)}"
          data-bundle-record-count="${bundle.recordCount}"
          data-hypothesis-id="${escapeHtml(bundle.regionalHypothesisId ?? "")}">違う</button>
      </div>
      <details class="grd-edit">
        <summary>誤判定を修正</summary>
        <div class="grd-one-taps" aria-label="ワンタップ分類">
          <button type="button" data-one-tap-correction="signage" data-correction-id="${escapeHtml(row.guide_record_id)}">これは看板</button>
          <button type="button" data-one-tap-correction="vegetation" data-correction-id="${escapeHtml(row.guide_record_id)}">これは植生</button>
          <button type="button" data-one-tap-correction="landform" data-correction-id="${escapeHtml(row.guide_record_id)}">これは地形・土地</button>
        </div>
        <label>種名（カンマ区切り）
          <input data-edit-field="species" value="${escapeHtml(species.map((item) => item.canonicalName).join(", "))}">
        </label>
        <label>環境文脈
          <textarea data-edit-field="environment">${escapeHtml(row.environment_context ?? "")}</textarea>
        </label>
        <label>特徴（type | name | confidence | note）
          <textarea data-edit-field="features">${escapeHtml(featuresToTextarea(bundle.features))}</textarea>
        </label>
        <label>修正メモ
          <input data-edit-field="note" placeholder="例: 看板のスズキを除外">
        </label>
        <button type="button" data-correction-id="${escapeHtml(row.guide_record_id)}">保存</button>
        <span class="grd-edit-status" data-edit-status></span>
      </details>
      <footer>
        <span>${escapeHtml(row.delivery_state ?? "ready")} / ${escapeHtml(row.seen_state ?? "unseen")}</span>
        <span>${bundle.meshKey ? `${escapeHtml(bundle.meshKey)} / ` : ""}${row.lat != null && row.lng != null ? `${row.lat.toFixed(5)}, ${row.lng.toFixed(5)}` : "位置なし"}</span>
      </footer>
    </article>`;
  }).join("")}</section>`;
}

function countBundleFeatures(bundles: GuideRecordBundle[]): OwnGuideFeatureCounts {
  const counts: OwnGuideFeatureCounts = { vegetation: 0, landform: 0, sound: 0, species: 0 };
  for (const bundle of bundles) {
    counts.species += bundle.canonicalTaxa.length;
    for (const feature of bundle.features) {
      const type = String(feature.type ?? "");
      if (type === "vegetation" || type === "landform" || type === "sound" || type === "species") counts[type] += 1;
    }
  }
  return counts;
}

function firstUsefulNextStep(bundles: GuideRecordBundle[]): string {
  for (const bundle of bundles) {
    const next = bundle.nextSamplingProtocol?.trim();
    if (next) return next;
  }
  const hasPhotoAction = bundles.some((bundle) => !bundle.representative.occurrence_id);
  return hasPhotoAction
    ? "気になったカードを1つ選んで、写真を足して通常の観察記録にします。"
    : "同じ場所をもう一度歩いて、前回と違う手がかりを1つ足します。";
}

function renderSimpleOutcomeHero(rows: GuideRecordDebugRow[], bundles: GuideRecordBundle[]): string {
  const sessions = new Set(rows.map((row) => row.session_id).filter(Boolean));
  const counts = countBundleFeatures(bundles);
  const hintTotal = counts.vegetation + counts.landform + counts.sound + counts.species;
  if (rows.length === 0) {
    return `<section class="grd-panel grd-simple-outcome">
      <div class="grd-simple-main">
        <span class="grd-simple-eyebrow">まだ成果はありません</span>
        <h2>まず1回、ガイドを使って歩けばOKです。</h2>
        <p>名前が分からなくても大丈夫。場所・時間・気づきが残れば、次に見返せる入口になります。</p>
      </div>
      <a class="grd-primary-link" href="/guide">ガイドを開始する</a>
    </section>`;
  }
  return `<section class="grd-panel grd-simple-outcome" data-testid="guide-outcomes-simple">
    <div class="grd-simple-main">
      <span class="grd-simple-eyebrow">今日できていること</span>
      <h2>${bundles.length}個の発見が、見返せる形になりました。</h2>
      <p>${sessions.size}回のガイドで、${hintTotal}個の手がかりが残っています。完璧な同定より、次に確かめる材料ができたことを見ます。</p>
    </div>
    <div class="grd-simple-metrics" aria-label="ガイド成果の要約">
      <span><b>${bundles.length}</b>発見</span>
      <span><b>${hintTotal}</b>手がかり</span>
      <span><b>${sessions.size}</b>回分</span>
    </div>
    <div class="grd-next-one">
      <span>次はこれだけ</span>
      <p>${escapeHtml(firstUsefulNextStep(bundles))}</p>
    </div>
  </section>`;
}

function filterLabel(filter: GuideOutcomeFilter): string {
  switch (filter) {
    case "saved": return "保存済み";
    case "non_detection": return "未検出";
    case "not_retained": return "保存対象外";
    case "audio": return "音声あり";
    default: return "すべて";
  }
}

function renderOutcomeFilterBar(rows: GuideRecordDebugRow[], active: GuideOutcomeFilter): string {
  const counts: Record<GuideOutcomeFilter, number> = {
    all: rows.length,
    saved: rows.filter(isSavedGuideRow).length,
    non_detection: rows.filter(isNonDetectionGuideRow).length,
    not_retained: rows.filter(isNotRetainedGuideRow).length,
    audio: rows.filter((row) => Boolean(row.has_promotable_audio)).length,
  };
  const filters: GuideOutcomeFilter[] = ["all", "saved", "non_detection", "not_retained", "audio"];
  const links = filters.map((filter) => {
    const href = filter === "all" ? "/guide/outcomes" : `/guide/outcomes?filter=${filter}`;
    const cls = filter === active ? " is-active" : "";
    return `<a class="grd-filter-chip${cls}" href="${escapeHtml(href)}" aria-current="${filter === active ? "page" : "false"}">${escapeHtml(filterLabel(filter))}<b>${counts[filter]}</b></a>`;
  }).join("");
  const note = active === "not_retained"
    ? "人物・室内・重複など保存すべきでないものはここにも残しません。ここに出るのは、安全に確認できる低情報量の除外ログだけです。"
    : active === "non_detection"
      ? "何も確認できなかった記録も、探した範囲や通過環境が分かる場合は調査データとして残します。"
      : "サムネイル、保存理由、未検出、音声の有無で、ガイド結果が妥当か確認できます。";
  return `<section class="grd-filter-panel" aria-label="ガイド成果フィルタ"><div class="grd-filter-row">${links}</div><p>${escapeHtml(note)}</p></section>`;
}

function rowStateBadges(row: GuideRecordDebugRow): string {
  const badges: string[] = [];
  badges.push(isNotRetainedGuideRow(row) ? "保存対象外" : "保存済み");
  if (isNonDetectionGuideRow(row)) badges.push("未検出");
  if (row.has_promotable_audio) badges.push("音声あり");
  return `<div class="grd-state-badges">${badges.map((badge) => `<span>${escapeHtml(badge)}</span>`).join("")}</div>`;
}

function renderSimpleOutcomeCards(bundles: GuideRecordBundle[]): string {
  if (bundles.length === 0) return "";
  const cards = bundles.slice(0, 6).map((bundle) => {
    const row = bundle.representative;
    const species = bundle.canonicalTaxa.length > 0 ? bundle.canonicalTaxa : canonicalizeTaxonList(row.detected_species ?? []);
    const promotedOccurrenceId = typeof row.occurrence_id === "string" && row.occurrence_id.trim() ? row.occurrence_id.trim() : "";
    const promotedVisitId = promotedOccurrenceId.replace(/^occ:/, "").replace(/:0$/, "");
    const primaryAction = promotedOccurrenceId
      ? `<a class="grd-primary-action" href="/observations/${escapeHtml(encodeURIComponent(promotedVisitId))}?occurrence=${escapeHtml(encodeURIComponent(promotedOccurrenceId))}">観察を見る</a>`
      : row.has_promotable_audio
        ? `<button class="grd-primary-action" type="button" data-guide-promote-id="${escapeHtml(row.guide_record_id)}">観察にする</button>`
        : `<a class="grd-primary-action" href="/record?source=guide&guideRecordId=${escapeHtml(row.guide_record_id)}">写真を足す</a>`;
    const topFeatures = bundle.features.slice(0, 4);
    return `<article class="grd-simple-card">
      <div class="grd-card-head">
        <span>${escapeHtml(formatTime(bundle.startAt))}</span>
        <span>${bundle.recordCount}件から要約</span>
      </div>
      ${rowStateBadges(row)}
      <h2>${escapeHtml(row.scene_summary ?? "見つけたこと")}</h2>
      ${row.environment_context ? `<p>${escapeHtml(row.environment_context)}</p>` : ""}
      <div class="grd-species">${species.length ? species.slice(0, 4).map((item) => `<span title="${escapeHtml(item.sourceNames.join(", "))}">${escapeHtml(item.canonicalName)}<small>${escapeHtml(item.rank)}</small></span>`).join("") : `<span class="grd-muted">名前未確定でもOK</span>`}</div>
      <div class="grd-features">${topFeatures.length ? renderFeaturePills(topFeatures) : `<span class="grd-muted">手がかりは次回追加できます</span>`}</div>
      ${bundle.nextSamplingProtocol ? `<section class="grd-next-sampling"><b>次に見る</b><p>${escapeHtml(bundle.nextSamplingProtocol)}</p></section>` : ""}
      <nav class="grd-card-actions" aria-label="この成果の次の行動">
        ${primaryAction}
        <a href="/guide">もう一度見る</a>
      </nav>
      <div class="grd-promote-status" data-guide-promote-status="${escapeHtml(row.guide_record_id)}"></div>
    </article>`;
  }).join("");
  const more = bundles.length > 6
    ? `<p class="grd-simple-more">残り${bundles.length - 6}件は、詳しい記録画面で確認できます。</p>`
    : "";
  return `<section class="grd-simple-list"><h2>見返す発見</h2><div class="grd-simple-grid">${cards}</div>${more}</section>`;
}

const STYLES = `
.grd-wrap{max-width:1160px;margin:0 auto;padding:clamp(24px,4vw,48px) 16px 72px;color:#172033;}
.grd-wrap,.grd-empty,.grd-card,.grd-panel{overflow-wrap:anywhere;}
.grd-hero{display:grid;gap:12px;margin-bottom:24px;padding:clamp(20px,3vw,28px);border:1px solid rgba(16,185,129,.16);background:linear-gradient(135deg,rgba(236,253,245,.9),rgba(240,249,255,.76));border-radius:24px;box-shadow:0 16px 36px rgba(15,23,42,.06);}
.grd-hero-top{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;flex-wrap:wrap;}
.grd-hero h1{font-size:clamp(26px,3vw,36px);line-height:1.25;margin:0;color:#0f172a;letter-spacing:0;}
.grd-hero p{margin:0;color:#475569;font-size:14px;line-height:1.7;}
.grd-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;}
.grd-primary-link,.grd-secondary-link{min-height:44px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:10px 16px;font-size:13px;line-height:1.2;font-weight:950;text-align:center;text-decoration:none;}
.grd-primary-link{background:#0f172a;color:#fff;box-shadow:0 12px 24px rgba(15,23,42,.16);}
.grd-secondary-link{border:1px solid rgba(15,23,42,.12);background:#fff;color:#334155;}
.grd-loop-mini{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:18px;}
.grd-loop-mini span{display:grid;gap:8px;border:1px solid rgba(16,185,129,.16);background:#f8fffb;border-radius:14px;padding:12px;color:#334155;font-size:12px;line-height:1.45;font-weight:850;}
.grd-loop-mini b{width:24px;height:24px;display:grid;place-items:center;border-radius:999px;background:#0f766e;color:#fff;font-size:11px;}
.grd-stats{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 18px;}
.grd-stat{display:inline-flex;align-items:baseline;gap:5px;border:1px solid #dbe7e2;background:#f8fffb;border-radius:999px;padding:7px 10px;font-size:12px;color:#446055;font-weight:800;}
.grd-stat strong{font-size:18px;color:#0f766e;}
.grd-panel{border:1px solid #dbe7e2;background:#fff;border-radius:16px;padding:18px;margin-bottom:18px;box-shadow:0 10px 24px rgba(15,23,42,.04);}
.grd-panel h2{font-size:18px;margin:0 0 12px;color:#0f172a;}
.grd-simple-outcome{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center;border-color:rgba(14,116,144,.18);background:linear-gradient(135deg,#ffffff,#ecfdf5);}
.grd-simple-main{display:grid;gap:8px;}
.grd-simple-eyebrow{width:max-content;max-width:100%;display:inline-flex;align-items:center;min-height:26px;border-radius:999px;background:#0f766e;color:#fff;padding:0 10px;font-size:11px;font-weight:950;}
.grd-simple-main h2{font-size:clamp(20px,2.5vw,28px);line-height:1.28;margin:0;color:#0f172a;}
.grd-simple-main p{margin:0;color:#475569;font-size:14px;line-height:1.75;font-weight:800;}
.grd-simple-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;grid-column:1/-1;}
.grd-simple-metrics span{min-width:0;display:grid;gap:2px;border:1px solid rgba(15,23,42,.08);background:rgba(255,255,255,.82);border-radius:12px;padding:10px;color:#475569;font-size:12px;font-weight:900;}
.grd-simple-metrics b{font-size:24px;line-height:1;color:#0f766e;}
.grd-next-one{grid-column:1/-1;border:1px solid #fde68a;background:#fffbeb;border-radius:12px;padding:12px;display:grid;gap:4px;}
.grd-next-one span{color:#a16207;font-size:11px;font-weight:950;text-transform:uppercase;}
.grd-next-one p{margin:0;color:#713f12;font-size:14px;line-height:1.65;font-weight:900;}
.grd-filter-panel{display:grid;gap:8px;border:1px solid #dbe7e2;background:#fff;border-radius:16px;padding:12px;margin:0 0 16px;box-shadow:0 10px 24px rgba(15,23,42,.04);}
.grd-filter-row{display:flex;gap:8px;flex-wrap:wrap;}
.grd-filter-chip{min-height:38px;display:inline-flex;align-items:center;gap:7px;border:1px solid #cbd5e1;background:#f8fafc;color:#334155;border-radius:999px;padding:7px 11px;text-decoration:none;font-size:12px;font-weight:950;}
.grd-filter-chip b{min-width:22px;height:22px;display:inline-grid;place-items:center;border-radius:999px;background:#e2e8f0;color:#0f172a;font-size:11px;}
.grd-filter-chip.is-active{border-color:#0f766e;background:#ecfdf5;color:#065f46;}
.grd-filter-chip.is-active b{background:#0f766e;color:#fff;}
.grd-filter-panel p{margin:0;color:#475569;font-size:12px;line-height:1.65;font-weight:800;}
.grd-state-badges{display:flex;gap:6px;flex-wrap:wrap;}
.grd-state-badges span{display:inline-flex;align-items:center;min-height:24px;border:1px solid #cbd5e1;background:#f8fafc;color:#334155;border-radius:999px;padding:3px 8px;font-size:10px;font-weight:950;}
.grd-simple-list{display:grid;gap:12px;margin-top:18px;}
.grd-simple-list h2{font-size:18px;margin:0;color:#0f172a;}
.grd-simple-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;}
.grd-simple-card{display:grid;gap:10px;border:1px solid #dbe7e2;background:#fff;border-radius:16px;padding:16px;box-shadow:0 10px 24px rgba(15,23,42,.04);}
.grd-simple-card h2{font-size:16px;line-height:1.55;margin:0;color:#111827;}
.grd-simple-card p{margin:0;font-size:13px;line-height:1.65;color:#334155;background:#f8fafc;border-radius:12px;padding:10px;}
.grd-simple-more{margin:0;color:#64748b;font-size:12px;font-weight:900;}
.grd-outcome-impact{display:grid;gap:14px;border-color:rgba(14,116,144,.18);background:linear-gradient(135deg,#ffffff,#f0fdfa);}
.grd-outcome-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap;}
.grd-outcome-head h2{margin-bottom:5px;}
.grd-outcome-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;}
.grd-outcome-grid article{min-width:0;border:1px solid rgba(15,23,42,.08);background:rgba(255,255,255,.82);border-radius:12px;padding:12px;display:grid;gap:5px;}
.grd-outcome-grid span{color:#0f766e;font-size:11px;font-weight:950;text-transform:uppercase;}
.grd-outcome-grid strong{color:#0f172a;font-size:26px;line-height:1;font-weight:950;}
.grd-outcome-grid p{margin:0;color:#475569;font-size:12px;line-height:1.55;font-weight:800;}
.grd-community-impact{display:grid;gap:9px;border-top:1px solid rgba(15,23,42,.08);padding-top:13px;}
.grd-community-impact h3{margin:0 0 4px;color:#0f172a;font-size:15px;line-height:1.35;}
.grd-community-stats{display:flex;gap:8px;flex-wrap:wrap;}
.grd-community-stats span{display:inline-flex;align-items:baseline;gap:5px;border:1px solid #99f6e4;background:#f0fdfa;color:#0f766e;border-radius:999px;padding:6px 9px;font-size:11px;font-weight:900;}
.grd-community-stats b{font-size:17px;color:#0f172a;}
.grd-quality-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;}
.grd-quality-card{border:1px solid #dbe7e2;background:#fbfefc;border-radius:12px;padding:13px;display:grid;gap:10px;}
.grd-quality-card header{display:flex;justify-content:space-between;gap:12px;align-items:center;}
.grd-quality-card h3{font-size:12px;margin:0;color:#334155;font-family:ui-monospace,monospace;word-break:break-all;}
.grd-quality-card header strong{width:42px;height:42px;border-radius:999px;background:#0f766e;color:#fff;display:grid;place-items:center;font-size:17px;}
.grd-quality-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;}
.grd-quality-grid span{border:1px solid #e2e8f0;background:#fff;border-radius:8px;padding:7px;color:#64748b;font-size:10px;font-weight:900;text-transform:uppercase;}
.grd-quality-grid b{display:block;color:#0f172a;font-size:14px;text-transform:none;}
.grd-session{border-top:1px solid #eef4f1;padding-top:12px;margin-top:12px;}
.grd-session:first-of-type{border-top:0;padding-top:0;margin-top:0;}
.grd-session header{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px;}
.grd-session h3{font-size:13px;margin:0;color:#334155;font-family:ui-monospace,monospace;word-break:break-all;}
.grd-session header span{font-size:12px;color:#64748b;font-weight:800;}
.grd-transect{list-style:none;margin:0;padding:0;display:grid;gap:10px;}
.grd-transect-step{display:grid;grid-template-columns:28px 1fr;gap:10px;align-items:flex-start;}
.grd-step-dot{display:grid;place-items:center;width:24px;height:24px;border-radius:999px;background:#0f766e;color:#fff;font-size:12px;font-weight:900;}
.grd-step-title{font-size:14px;font-weight:900;color:#0f172a;}
.grd-step-meta{font-size:11px;color:#64748b;margin-top:2px;}
.grd-step-pills{margin-top:6px;display:flex;gap:5px;flex-wrap:wrap;}
.grd-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;}
.grd-card{display:grid;gap:10px;border:1px solid #dbe7e2;background:#fff;border-radius:16px;padding:16px;box-shadow:0 10px 24px rgba(15,23,42,.04);}
.grd-card-head,.grd-card footer{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:11px;color:#64748b;font-weight:800;}
.grd-card h2{font-size:15px;line-height:1.65;margin:0;color:#111827;}
.grd-claim-limit{margin:2px 0 0;color:#64748b;font-size:12px;line-height:1.55;font-weight:800;}
.grd-bundle-meta{display:inline-flex;width:max-content;max-width:100%;align-items:center;gap:6px;border:1px solid #99f6e4;background:#f0fdfa;color:#0f766e;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:950;}
.grd-bundle-meta strong{font-size:15px;color:#0f172a;}
.grd-env,.grd-season{margin:0;font-size:13px;line-height:1.65;color:#334155;background:#f8fafc;border-radius:12px;padding:10px;}
.grd-season{background:#fff7ed;color:#7c2d12;}
.grd-species,.grd-features{display:flex;gap:6px;flex-wrap:wrap;}
.grd-species span{display:inline-flex;align-items:center;gap:5px;border-radius:999px;background:#eef2ff;color:#3730a3;padding:4px 8px;font-size:12px;font-weight:900;}
.grd-species small{font-size:10px;color:#6366f1;text-transform:uppercase;}
.grd-pill{display:inline-flex;gap:5px;align-items:center;border-radius:999px;padding:5px 8px;font-size:11px;font-weight:850;background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;}
.grd-pill b{font-size:10px;text-transform:uppercase;color:#64748b;}
.grd-pill.is-vegetation{background:#ecfdf5;color:#065f46;border-color:#bbf7d0;}
.grd-pill.is-landform{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe;}
.grd-pill.is-structure{background:#f8fafc;color:#475569;border-color:#cbd5e1;}
.grd-pill.is-sound{background:#fdf4ff;color:#86198f;border-color:#f5d0fe;}
.grd-muted{color:#94a3b8;font-size:12px;font-weight:800;}
.grd-empty{max-width:620px;margin:clamp(44px,8vw,96px) auto;border:1px solid rgba(16,185,129,.18);background:linear-gradient(135deg,rgba(255,255,255,.96),rgba(240,253,250,.9));border-radius:24px;padding:clamp(22px,4vw,32px);box-shadow:0 16px 36px rgba(15,23,42,.06);}
.grd-empty h1{font-size:clamp(23px,3vw,30px);line-height:1.35;margin:0 0 12px;letter-spacing:0;color:#0f172a;}
.grd-empty p{color:#475569;line-height:1.8;margin:0;}
@media(max-width:620px){.grd-loop-mini{grid-template-columns:1fr;}.grd-empty{margin:36px auto;}.grd-actions{display:grid;grid-template-columns:1fr;}.grd-primary-link,.grd-secondary-link{width:100%;}}
.grd-map-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px;}
.grd-map-head h2{margin-bottom:4px;}
.grd-map-head p{margin:0;color:#64748b;font-size:13px;line-height:1.6;}
.grd-map-links{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;}
.grd-map-links a{font-size:12px;font-weight:900;color:#0f766e;border:1px solid #99f6e4;border-radius:999px;padding:5px 9px;text-decoration:none;background:#f0fdfa;}
.grd-map{height:420px;border:1px solid #dbe7e2;border-radius:16px;overflow:hidden;background:#eef6f2;display:grid;place-items:center;color:#64748b;font-weight:900;}
.grd-next-sampling{border:1px solid #fde68a;background:#fffbeb;color:#713f12;border-radius:12px;padding:10px 12px;display:grid;gap:4px;}
.grd-next-sampling b{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#a16207;}
.grd-next-sampling p{margin:0;font-size:12px;line-height:1.65;font-weight:800;}
.grd-card-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;}
.grd-card-actions a,.grd-card-actions button{min-height:36px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:7px 11px;background:#fff;color:#334155;border:1px solid rgba(15,23,42,.12);font-size:12px;font-weight:950;text-decoration:none;cursor:pointer;}
.grd-card-actions .grd-primary-action{background:#0f172a;color:#fff;border-color:#0f172a;}
.grd-card-actions button:disabled{opacity:.62;cursor:wait;}
.grd-promote-status{min-height:18px;color:#0f766e;font-size:12px;font-weight:900;}
.grd-edit{border-top:1px solid #eef4f1;padding-top:8px;}
.grd-edit summary{cursor:pointer;font-size:12px;font-weight:950;color:#0f766e;}
.grd-one-taps{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;}
.grd-one-taps button{margin:0;min-height:32px;border:1px solid #99f6e4;border-radius:999px;background:#f0fdfa;color:#0f766e;font-size:12px;font-weight:950;padding:0 10px;cursor:pointer;}
.grd-edit label{display:grid;gap:4px;margin-top:8px;font-size:11px;color:#475569;font-weight:900;}
.grd-edit input,.grd-edit textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:6px;padding:8px;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:#fff;}
.grd-edit textarea{min-height:66px;resize:vertical;}
.grd-edit button{margin-top:8px;min-height:34px;border:0;border-radius:6px;background:#0f766e;color:#fff;font-weight:950;padding:0 12px;cursor:pointer;}
.grd-edit-status{margin-left:8px;font-size:12px;color:#64748b;font-weight:900;}
.grd-dashboard-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:16px;align-items:start;}
.grd-dashboard-copy{display:grid;gap:12px;}
.grd-dashboard-copy h1{font-size:30px;line-height:1.2;margin:0;color:#0f172a;}
.grd-dashboard-copy p{margin:0;color:#475569;font-size:14px;line-height:1.75;font-weight:750;}
.grd-dashboard-copy ul{margin:0;padding-left:20px;color:#334155;font-size:13px;line-height:1.75;}
.grd-eval{display:grid;gap:8px;}
.grd-eval-row{display:flex;justify-content:space-between;gap:12px;border:1px solid #e2e8f0;border-radius:8px;padding:9px 10px;background:#f8fafc;font-size:12px;font-weight:900;color:#334155;}
.grd-eval-row strong{color:#0f766e;}
.grd-ops-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}
.grd-ops-stack{display:grid;gap:7px;align-content:start;}
.grd-ops-stack h3{font-size:13px;margin:0;color:#334155;}
.grd-error{border:1px solid #fecaca;background:#fff1f2;color:#be123c;border-radius:8px;padding:8px;margin:0;font-size:12px;font-weight:900;}
.grd-improvement-grid{display:grid;gap:10px;}
.grd-improvement-card{border:1px solid #dbe7e2;border-radius:8px;padding:12px;background:#fbfefc;display:grid;gap:8px;}
.grd-improvement-card p{margin:0;color:#334155;font-size:13px;line-height:1.65;font-weight:800;}
.grd-improvement-card pre{margin:0;white-space:pre-wrap;word-break:break-word;border:1px solid #e2e8f0;background:#0f172a;color:#e2e8f0;border-radius:8px;padding:10px;font-size:11px;line-height:1.55;}
.grd-hypotheses{display:grid;gap:10px;}
.grd-hypothesis-grid{display:grid;gap:10px;}
.grd-hypothesis-card{border:1px solid #dbe7e2;border-radius:8px;background:#fbfefc;padding:12px;display:grid;gap:8px;}
.grd-hypothesis-card h3{font-size:14px;line-height:1.55;margin:0;color:#0f172a;}
.grd-hypothesis-card p{margin:0;color:#475569;font-size:12px;line-height:1.65;}
.grd-card-meta{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;color:#0f766e;font-size:11px;font-weight:950;text-transform:uppercase;}
.grd-chip-row{display:flex;gap:5px;flex-wrap:wrap;}
.grd-chip{border:1px solid #cbd5e1;background:#f8fafc;color:#475569;border-radius:999px;padding:4px 7px;font-size:10px;font-weight:900;}
.grd-feedback-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.grd-feedback-row button{min-height:34px;border:1px solid #99f6e4;border-radius:999px;background:#f0fdfa;color:#0f766e;font-size:12px;font-weight:950;padding:0 10px;cursor:pointer;}
.grd-feedback-row button[data-guide-bundle-feedback="merge_ok"]{border-color:#bfdbfe;background:#eff6ff;color:#1d4ed8;}
.grd-feedback-row button[data-guide-bundle-feedback="wrong"],.grd-feedback-row button[data-guide-hypothesis-feedback="wrong"]{border-color:#fecaca;background:#fff1f2;color:#be123c;}
@media(max-width:900px){.grd-outcome-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media(max-width:760px){.grd-dashboard-grid,.grd-ops-grid{grid-template-columns:1fr}.grd-map-head{display:grid}.grd-map-links{justify-content:flex-start}.grd-outcome-grid{grid-template-columns:1fr}.grd-simple-outcome{grid-template-columns:1fr}.grd-simple-metrics{grid-template-columns:1fr}}
`;

const SCRIPT = `
(function(){
  function parseFeatures(text) {
    return String(text || '').split('\\n').map(function(line){
      var parts = line.split('|').map(function(part){ return part.trim(); });
      if (!parts[1]) return null;
      var conf = Number(parts[2]);
      return {
        type: ['species','vegetation','landform','structure','sound'].indexOf(parts[0]) >= 0 ? parts[0] : 'structure',
        name: parts[1],
        confidence: Number.isFinite(conf) ? conf : undefined,
        note: parts[3] || undefined
      };
    }).filter(Boolean);
  }
  function serializeFeatures(features) {
    return features.map(function(feature){
      return [feature.type || 'structure', feature.name || '', feature.confidence == null ? '' : Number(feature.confidence).toFixed(2), feature.note || ''].join(' | ');
    }).join('\\n');
  }
  function firstSpeciesName(card) {
    var species = card.querySelector('[data-edit-field="species"]');
    var value = species ? String(species.value || '') : '';
    return value.split(/[,、\\n]/).map(function(x){ return x.trim(); }).filter(Boolean)[0] || '';
  }
  function applyOneTap(card, kind) {
    var species = card.querySelector('[data-edit-field="species"]');
    var env = card.querySelector('[data-edit-field="environment"]');
    var features = card.querySelector('[data-edit-field="features"]');
    var note = card.querySelector('[data-edit-field="note"]');
    var currentFeatures = parseFeatures(features ? features.value : '');
    var mistakenName = firstSpeciesName(card);
    if (kind === 'signage') {
      if (species) species.value = '';
      currentFeatures = currentFeatures.filter(function(feature){ return feature.type !== 'species'; });
      currentFeatures.unshift({ type: 'structure', name: mistakenName || '看板・ロゴ', confidence: 0.88, note: '人間補正: 生きものではなく看板' });
      if (env && !env.value) env.value = '看板・店舗名などの人工物が写っています。生きものの種名ではなく、土地利用・道路沿いの手がかりとして扱います。';
      if (note) note.value = 'ワンタップ補正: 看板';
    } else if (kind === 'vegetation') {
      currentFeatures.unshift({ type: 'vegetation', name: mistakenName || '植生・草地', confidence: 0.82, note: '人間補正: 植生として扱う' });
      if (env && !env.value) env.value = '種名の確定より、草丈・樹木の並び・刈り込み跡などの植生状態として残します。';
      if (note) note.value = 'ワンタップ補正: 植生';
    } else if (kind === 'landform') {
      currentFeatures.unshift({ type: 'landform', name: '地形・土地利用', confidence: 0.76, note: '人間補正: 場所の状態として扱う' });
      if (env && !env.value) env.value = '道路際・水辺・畑・公園管理など、場所の状態を読む手がかりとして残します。';
      if (note) note.value = 'ワンタップ補正: 地形・土地';
    }
    if (features) features.value = serializeFeatures(currentFeatures.slice(0, 40));
  }
  async function submitCorrection(button, card) {
    var status = card.querySelector('[data-edit-status]');
    var species = card.querySelector('[data-edit-field="species"]');
    var env = card.querySelector('[data-edit-field="environment"]');
    var features = card.querySelector('[data-edit-field="features"]');
    var note = card.querySelector('[data-edit-field="note"]');
    var correctionKind = button.getAttribute('data-one-tap-correction') || 'human_edit';
    button.disabled = true;
    if (status) status.textContent = '保存中';
    try {
      var res = await fetch('/api/v1/me/guide-records/' + encodeURIComponent(button.dataset.correctionId) + '/correction', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          detectedSpecies: String(species.value || '').split(/[,、\\n]/).map(function(x){ return x.trim(); }).filter(Boolean),
          detectedFeatures: parseFeatures(features.value),
          environmentContext: env.value || '',
          note: note.value || '',
          correctionKind: correctionKind
        })
      });
      if (!res.ok) throw new Error(await res.text());
      if (status) status.textContent = '保存済み';
      setTimeout(function(){ location.reload(); }, 500);
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : String(error);
      button.disabled = false;
    }
  }
  document.addEventListener('click', async function(event){
    var promoteButton = event.target.closest('[data-guide-promote-id]');
    if (promoteButton) {
      var guideRecordId = promoteButton.getAttribute('data-guide-promote-id') || '';
      var promoteStatus = document.querySelector('[data-guide-promote-status="' + guideRecordId + '"]');
      promoteButton.disabled = true;
      if (promoteStatus) promoteStatus.textContent = '観察レコードを作成中';
      try {
        var promoteRes = await fetch('/api/v1/guide/records/' + encodeURIComponent(guideRecordId) + '/promote', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({})
        });
        var promoteJson = await promoteRes.json().catch(function(){ return {}; });
        if (!promoteRes.ok || !promoteJson.ok) {
          if (promoteJson && promoteJson.nextAction === 'add_photo') {
            location.href = '/record?source=guide&guideRecordId=' + encodeURIComponent(guideRecordId);
            return;
          }
          throw new Error((promoteJson && promoteJson.error) || 'promotion_failed');
        }
        if (promoteStatus) promoteStatus.textContent = '作成済み。観察へ移動します';
        location.href = promoteJson.observationHref || '/observations';
      } catch (error) {
        if (promoteStatus) promoteStatus.textContent = error instanceof Error ? error.message : String(error);
        promoteButton.disabled = false;
      }
      return;
    }
    var feedbackButton = event.target.closest('[data-guide-hypothesis-feedback]');
    if (feedbackButton) {
      var row = feedbackButton.closest('[data-feedback-status]');
      var status = row || feedbackButton.parentElement;
      feedbackButton.disabled = true;
      try {
        var feedbackRes = await fetch('/api/v1/guide/interaction', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            hypothesisId: feedbackButton.getAttribute('data-hypothesis-id') || '',
            interactionType: feedbackButton.getAttribute('data-guide-hypothesis-feedback') || '',
            payload: { surface: 'community_guide_environment' }
          })
        });
        if (!feedbackRes.ok) throw new Error(await feedbackRes.text());
        if (status) status.setAttribute('data-feedback-saved', 'true');
        feedbackButton.textContent = '記録済み';
      } catch (error) {
        feedbackButton.disabled = false;
        feedbackButton.textContent = error instanceof Error ? error.message.slice(0, 18) : '失敗';
      }
      return;
    }
    var bundleFeedbackButton = event.target.closest('[data-guide-bundle-feedback]');
    if (bundleFeedbackButton) {
      var bundleRow = bundleFeedbackButton.closest('[data-feedback-status]');
      var bundleStatus = bundleRow || bundleFeedbackButton.parentElement;
      var bundleFeedback = bundleFeedbackButton.getAttribute('data-guide-bundle-feedback') || '';
      bundleFeedbackButton.disabled = true;
      try {
        var bundleFeedbackRes = await fetch('/api/v1/guide/interaction', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            guideRecordId: bundleFeedbackButton.getAttribute('data-guide-record-id') || '',
            hypothesisId: bundleFeedbackButton.getAttribute('data-hypothesis-id') || '',
            sessionId: bundleFeedbackButton.getAttribute('data-session-id') || '',
            interactionType: bundleFeedback,
            payload: {
              surface: 'me_guide_records_bundle',
              bundleId: bundleFeedbackButton.getAttribute('data-bundle-id') || '',
              bundleRecordCount: Number(bundleFeedbackButton.getAttribute('data-bundle-record-count') || '1'),
              representativeFeedback: bundleFeedback,
              feedsRegionalHypothesisQueue: Boolean(bundleFeedbackButton.getAttribute('data-hypothesis-id')),
              feedsPromptImprovementQueue: true
            }
          })
        });
        if (!bundleFeedbackRes.ok) throw new Error(await bundleFeedbackRes.text());
        if (bundleStatus) bundleStatus.setAttribute('data-feedback-saved', 'true');
        bundleFeedbackButton.textContent = '記録済み';
      } catch (error) {
        bundleFeedbackButton.disabled = false;
        bundleFeedbackButton.textContent = error instanceof Error ? error.message.slice(0, 18) : '失敗';
      }
      return;
    }
    var button = event.target.closest('[data-correction-id]');
    if (!button) return;
    var card = button.closest('.grd-card');
    if (!card) return;
    var oneTap = button.getAttribute('data-one-tap-correction');
    if (oneTap) applyOneTap(card, oneTap);
    await submitCorrection(button, card);
  });
  function loadMapLibre(callback) {
    if (window.maplibregl) { callback(); return; }
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css';
    document.head.appendChild(css);
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js';
    script.onload = callback;
    script.onerror = function(){ var el = document.getElementById('grd-map'); if (el) el.textContent = '地図ライブラリを読み込めませんでした'; };
    document.head.appendChild(script);
  }
  function hydrateMap(){
    var el = document.getElementById('grd-map');
    if (!el || !window.maplibregl) return;
    fetch('/api/v1/me/guide-records/route-layer.geojson?limit=500', { credentials: 'same-origin' })
      .then(function(res){ return res.json(); })
      .then(function(data){
        el.innerHTML = '';
        var points = (data.features || []).filter(function(f){ return f.geometry && f.geometry.type === 'Point'; });
        var center = points[0] ? points[0].geometry.coordinates : [137.734, 34.710];
        var map = new window.maplibregl.Map({
          container: el,
          style: { version: 8, sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors' } }, layers: [{ id: 'osm', type: 'raster', source: 'osm' }] },
          center: center,
          zoom: points.length ? 13 : 10
        });
        map.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        map.on('load', function(){
          map.addSource('guide-route-layer', { type: 'geojson', data: data });
          map.addLayer({ id: 'guide-routes', type: 'line', source: 'guide-route-layer', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': '#0f766e', 'line-width': 4, 'line-opacity': 0.72 } });
          map.addLayer({ id: 'guide-points', type: 'circle', source: 'guide-route-layer', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-color': ['match', ['get', 'dominantType'], 'vegetation', '#16a34a', 'landform', '#2563eb', 'structure', '#64748b', '#0f766e'], 'circle-radius': 7, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
          var bounds = new window.maplibregl.LngLatBounds();
          points.forEach(function(point){ bounds.extend(point.geometry.coordinates); });
          if (points.length > 1) map.fitBounds(bounds, { padding: 48, maxZoom: 15 });
        });
      })
      .catch(function(error){ el.textContent = error instanceof Error ? error.message : String(error); });
  }
  loadMapLibre(hydrateMap);
})();
`;

async function renderEnvironmentDashboard(reply: { type: (value: string) => void }): Promise<string> {
  reply.type("text/html; charset=utf-8");
  const evalItems = await loadGuideCorrectionEvalItems(500).catch(() => []);
  const evalSummary = summarizeGuideCorrectionEval(evalItems);
  const regionalHypotheses = await listRegionalHypotheses({ limit: 6, publicOnly: true }).catch(() => []);
  const opsMetrics = await loadGuideEnvironmentDashboardMetrics().catch(() => ({
    latestRun: null,
    totals: { meshCells: 0, publicMeshCells: 0, hypotheses: 0, helpfulInteractions: 0, wrongInteractions: 0, promptImprovements: 0 },
  }));
  const promptImprovements = await listGuideHypothesisPromptImprovements(4).catch(() => []);
  const evalRows = Object.entries(evalSummary.byLabel)
    .map(([label, count]) => `<div class="grd-eval-row"><span>${escapeHtml(label)}</span><strong>${count}</strong></div>`)
    .join("");
  const body = `
<div class="grd-wrap">
  <section class="grd-dashboard-grid">
    <div class="grd-dashboard-copy">
      <div class="grd-hero">
        <h1>地域の植生・土地利用レイヤー</h1>
        <p>ライブガイドの足跡を、個人の記録だけで終わらせず、100m メッシュ単位の地域データとして育てます。公開側は低件数セルを抑制し、個人ルートではなく集計された環境手がかりだけを表示します。</p>
      </div>
      <section class="grd-panel">
        <h2>このレイヤーで見るもの</h2>
        <ul>
          <li>種名が分からない場面でも、草地・街路樹・水路・農地・道路際・管理痕跡を残す。</li>
          <li>衛星画像では粗く見える変化を、現地の移動ログから細かく補う。</li>
          <li>ワンタップ補正を評価データにし、看板や車名を生きもの扱いしないモデル改善につなげる。</li>
        </ul>
      </section>
      <section class="grd-panel grd-eval">
        <h2>補正データから作る評価セット</h2>
        <div class="grd-eval-row"><span>total</span><strong>${evalSummary.total}</strong></div>
        ${evalRows}
        <p class="grd-muted">JSONL は npm run export:guide-correction-eval で出力できます。</p>
      </section>
      ${renderGuideEnvironmentOpsPanel(opsMetrics)}
      ${renderRegionalHypothesisPanel(regionalHypotheses)}
      ${renderPromptImprovementPanel(promptImprovements)}
    </div>
    ${renderEnvironmentMeshMap()}
  </section>
</div><script>${SCRIPT.replace("/api/v1/me/guide-records/route-layer.geojson?limit=500", "/api/v1/guide/environment-mesh.geojson?limit=1000&public=1").replace("guide-route-layer", "guide-route-layer")}</script>`;
  return renderSiteDocument({
    basePath: "",
    title: "地域環境メッシュ — ikimon.life",
    extraStyles: STYLES,
    body,
  });
}

async function renderPage(
  request: { headers: Record<string, unknown>; query?: { limit?: string; filter?: string } },
  reply: { type: (value: string) => void; code: (value: number) => void },
  options: { nextPath?: string; title?: string; heading?: string; lead?: string; simpleOutcomes?: boolean } = {},
): Promise<string> {
  reply.type("text/html; charset=utf-8");
  const rawCookie = request.headers.cookie;
  const cookie = Array.isArray(rawCookie) ? String(rawCookie[0] ?? "") : typeof rawCookie === "string" ? rawCookie : "";
  const session = await getSessionFromCookie(cookie).catch(() => null);
  if (!session?.userId || session.banned) {
    reply.code(401);
    return renderSiteDocument({
      basePath: "",
      title: options.title ?? "ガイド記録 — ikimon.life",
      activeNav: "記録",
      currentPath: options.nextPath ?? "/me/guide-records",
      extraStyles: STYLES,
      body: loginGate(options.nextPath),
    });
  }
  const limit = Math.max(1, Math.min(100, Number.parseInt(request.query?.limit ?? "50", 10) || 50));
  let allRows: GuideRecordDebugRow[] = [];
  let errorHtml = "";
  try {
    allRows = await loadGuideRecords(session.userId, limit);
  } catch (error) {
    errorHtml = `<section class="grd-empty"><h1>DBから取得できませんでした</h1><p>${escapeHtml(error instanceof Error ? error.message : String(error))}</p></section>`;
  }
  const activeFilter = parseOutcomeFilter(request.query?.filter);
  const rows = options.simpleOutcomes ? filterGuideRows(allRows, activeFilter) : allRows;
  const bundles = await addNextSamplingToBundles(bundleGuideRecords(rows));
  const qualityBySession = options.simpleOutcomes
    ? new Map<string, GuideTransectQuality>()
    : await loadGuideTransectQualityForSessions(session.userId, bundles.map((bundle) => bundle.sessionId)).catch(() => new Map<string, GuideTransectQuality>());
  const communitySummary = options.simpleOutcomes
    ? null
    : await loadGuideCommunityContributionSummary(
      session.userId,
      bundles.map((bundle) => bundle.meshKey).filter((meshKey): meshKey is string => Boolean(meshKey)),
    ).catch(() => null);
  const heading = options.heading ?? "自分のガイド記録";
  const lead = options.lead ?? "ログイン中の user_id に紐づく guide_records 最新件を30秒前後の代表カードに束ねます。種名だけでなく、植生・土地利用・水辺・道路際の手がかりを確認できます。";
  const body = `
<div class="grd-wrap">
  <header class="grd-hero">
    <div class="grd-hero-top">
      <div>
        <h1>${escapeHtml(heading)}</h1>
        <p>${escapeHtml(lead.replace("最新件", `最新${limit}件`))}</p>
      </div>
      <nav class="grd-actions" aria-label="ガイド成果の次の行動">
        <a class="grd-primary-link" href="/guide">またガイドを使う</a>
        <a class="grd-secondary-link" href="/records?view=mine">記録を見る</a>
        <a class="grd-secondary-link" href="/map">地図で見る</a>
      </nav>
    </div>
  </header>
  ${errorHtml || (options.simpleOutcomes
    ? `${renderOutcomeFilterBar(allRows, activeFilter)}${renderSimpleOutcomeHero(rows, bundles)}${renderSimpleOutcomeCards(bundles)}`
    : `${renderOutcomeContributionPanel(rows, bundles, qualityBySession, communitySummary)}${renderSummaryStats(rows, bundles, qualityBySession)}${renderGuideQualityPanel(qualityBySession)}${renderRouteMap()}${renderRouteTransect(bundles, qualityBySession)}${renderRecordCards(bundles)}`)}
</div><script>${SCRIPT}</script>`;
  return renderSiteDocument({
    basePath: "",
    title: options.title ?? "自分のガイド記録 — ikimon.life",
    activeNav: "記録",
    currentPath: options.nextPath ?? "/me/guide-records",
    extraStyles: STYLES,
    body,
  });
}

export async function registerGuideRecordsDebugRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { limit?: string } }>("/me/guide-records", async (request, reply) => renderPage(request, reply));
  app.get<{ Querystring: { limit?: string } }>("/admin/debug/guide-records", async (request, reply) => renderPage(request, reply));
  app.get<{ Querystring: { limit?: string; filter?: string } }>("/guide/outcomes", async (request, reply) => renderPage(request, reply, {
    nextPath: "/guide/outcomes",
    title: "ガイド成果 — ikimon.life",
    heading: "ガイド成果",
    lead: "ライブガイドで見つけたことを、今日できたことと次の一歩だけに絞って見返します。",
    simpleOutcomes: true,
  }));
  app.get("/guide/results", async (_request, reply) => reply.redirect("/guide/outcomes", 308));
  app.get("/me/guide-results", async (_request, reply) => reply.redirect("/guide/outcomes", 308));
  app.get("/community/guide-environment", async (_request, reply) => renderEnvironmentDashboard(reply));
  app.get<{ Querystring: { limit?: string } }>("/api/v1/me/guide-records/route-layer.geojson", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    if (!session?.userId || session.banned) {
      reply.code(401);
      return { type: "FeatureCollection", features: [] };
    }
    const limit = Math.max(1, Math.min(1000, Number.parseInt(request.query.limit ?? "500", 10) || 500));
    const rows = await loadGuideRecords(session.userId, limit);
    const bundles = bundleGuideRecords(rows);
    const qualityBySession = await loadGuideTransectQualityForSessions(session.userId, bundles.map((bundle) => bundle.sessionId)).catch(() => new Map<string, GuideTransectQuality>());
    const pointBundles = bundles.filter((bundle) => bundle.representative.lat != null && bundle.representative.lng != null).slice().reverse();
    const features: Array<Record<string, unknown>> = [];
    for (const bundle of pointBundles) {
      const row = bundle.representative;
      if (row.lat == null || row.lng == null) continue;
      const envFeatures = bundle.features.filter((feature) => ["vegetation", "landform", "structure"].includes(String(feature.type)));
      const dominantType = String(envFeatures[0]?.type ?? "structure");
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [row.lng, row.lat] },
        properties: {
          kind: "guide_bundle",
          bundleId: bundle.bundleId,
          bundleRecordCount: bundle.recordCount,
          guideRecordId: row.guide_record_id,
          sessionId: row.session_id,
          capturedAt: bundle.startAt,
          endedAt: bundle.endAt,
          guideMode: typeof row.meta?.guideMode === "string" ? row.meta.guideMode : "walk",
          dominantType,
          summary: row.scene_summary,
          environmentContext: row.environment_context,
          canonicalTaxa: bundle.canonicalTaxa.map((item) => item.canonicalName),
          vegetation: envFeatures.filter((feature) => feature.type === "vegetation").map((feature) => feature.name),
          landform: envFeatures.filter((feature) => feature.type === "landform").map((feature) => feature.name),
          structure: envFeatures.filter((feature) => feature.type === "structure").map((feature) => feature.name),
          transectQuality: qualityBySession.get(row.session_id) ?? null,
        },
      });
    }
    const bySession = new Map<string, GuideRecordBundle[]>();
    for (const bundle of pointBundles) {
      const list = bySession.get(bundle.sessionId) ?? [];
      list.push(bundle);
      bySession.set(bundle.sessionId, list);
    }
    for (const [sessionId, items] of bySession) {
      const coords = items
        .map((item) => item.representative)
        .filter((item) => item.lat != null && item.lng != null)
        .map((item) => [item.lng as number, item.lat as number]);
      if (coords.length < 2) continue;
      features.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: coords },
        properties: {
          kind: "guide_route",
          sessionId,
          pointCount: coords.length,
          bundled: true,
          transectQuality: qualityBySession.get(sessionId) ?? null,
        },
      });
    }
    reply.type("application/geo+json; charset=utf-8");
    return { type: "FeatureCollection", features };
  });
  app.get<{ Querystring: { limit?: string; public?: string } }>("/api/v1/guide/environment-mesh.geojson", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    const publicMode = request.query && "public" in request.query;
    if (!publicMode && (!session?.userId || session.banned)) {
      reply.code(401);
      return { type: "FeatureCollection", features: [] };
    }
    const limit = Math.max(1, Math.min(5000, Number.parseInt(request.query.limit ?? "500", 10) || 500));
    reply.type("application/geo+json; charset=utf-8");
    return loadGuideEnvironmentMeshGeoJson(limit, publicMode ? { publicOnly: true, minRecords: 3, minContributors: 2 } : {});
  });
  app.get<{ Querystring: { limit?: string; meshKey?: string } }>("/api/v1/guide/regional-hypotheses", async (request, reply) => {
    const limit = Math.max(1, Math.min(100, Number.parseInt(request.query.limit ?? "20", 10) || 20));
    const meshKey = typeof request.query.meshKey === "string" && request.query.meshKey.trim()
      ? request.query.meshKey.trim()
      : undefined;
    reply.type("application/json; charset=utf-8");
    const hypotheses = await listRegionalHypotheses({ limit, meshKey, publicOnly: true }).catch(() => []);
    return {
      purpose: "regional_hypothesis_generation_not_assertion",
      guardrails: [
        "no_trend_claim_without_effort_correction",
        "no_absence_claim_without_complete_checklist_and_scope",
        "no_rare_species_claim_from_ai_only",
      ],
      hypotheses,
    };
  });
  app.get("/api/v1/guide/environment-dashboard", async (_request, reply) => {
    reply.type("application/json; charset=utf-8");
    const [metrics, promptImprovements] = await Promise.all([
      loadGuideEnvironmentDashboardMetrics(),
      listGuideHypothesisPromptImprovements(10).catch(() => []),
    ]);
    return {
      purpose: "regional_hypothesis_operations_dashboard",
      metrics,
      promptImprovements,
    };
  });
  app.post<{ Params: { id: string }; Body: CorrectionBody }>("/api/v1/me/guide-records/:id/correction", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    if (!session?.userId || session.banned) {
      reply.code(401);
      return { ok: false, error: "login_required" };
    }
    const current = await getPool().query<{
      guide_record_id: string;
      user_id: string | null;
      lat: number | null;
      lng: number | null;
      detected_species: string[];
      detected_features: unknown;
      environment_context: string | null;
      seasonal_note: string | null;
      primary_subject: unknown;
      created_at: string;
    }>(
      `select gr.guide_record_id::text,
              gr.user_id,
              gr.lat,
              gr.lng,
              gr.detected_species,
              gr.detected_features,
              gls.environment_context,
              gls.seasonal_note,
              gls.primary_subject,
              gr.created_at::text as created_at
         from guide_records gr
         left join guide_record_latency_states gls on gls.guide_record_id = gr.guide_record_id
        where gr.guide_record_id = $1
          and gr.user_id = $2`,
      [request.params.id, session.userId],
    );
    const row = current.rows[0];
    if (!row) {
      reply.code(404);
      return { ok: false, error: "guide_record_not_found" };
    }
    const nextSpecies = parseStringList(request.body?.detectedSpecies);
    const nextFeatures = parseEditableFeatures(request.body?.detectedFeatures);
    const nextEnvironment = typeof request.body?.environmentContext === "string" ? request.body.environmentContext.trim().slice(0, 600) : "";
    const nextSeasonal = typeof request.body?.seasonalNote === "string" ? request.body.seasonalNote.trim().slice(0, 400) : "";
    const note = typeof request.body?.note === "string" ? request.body.note.trim().slice(0, 500) : "";
    const rawCorrectionKind = typeof request.body?.correctionKind === "string" ? request.body.correctionKind : "human_edit";
    const correctionKind = ["signage", "vegetation", "landform", "human_edit"].includes(rawCorrectionKind)
      ? rawCorrectionKind
      : "human_edit";
    const originalPayload = {
      detectedSpecies: row.detected_species ?? [],
      detectedFeatures: row.detected_features ?? [],
      environmentContext: row.environment_context,
      seasonalNote: row.seasonal_note,
      primarySubject: row.primary_subject,
    };
    const correctedPayload = {
      detectedSpecies: nextSpecies,
      detectedFeatures: nextFeatures,
      environmentContext: nextEnvironment,
      seasonalNote: nextSeasonal,
    };
    const client = await getPool().connect();
    try {
      await client.query("begin");
      await client.query(
        `update guide_records
            set detected_species = $2,
                detected_features = $3::jsonb
          where guide_record_id = $1`,
        [request.params.id, nextSpecies, JSON.stringify(nextFeatures)],
      );
      await client.query(
        `insert into guide_record_latency_states
           (guide_record_id, environment_context, seasonal_note, seen_state, meta)
         values ($1, $2, $3, 'saved', $4::jsonb)
         on conflict (guide_record_id) do update set
           environment_context = excluded.environment_context,
           seasonal_note = excluded.seasonal_note,
           seen_state = 'saved',
           meta = guide_record_latency_states.meta || excluded.meta`,
        [request.params.id, nextEnvironment || null, nextSeasonal || null, JSON.stringify({ lastHumanCorrectionAt: new Date().toISOString() })],
      );
      await client.query(
        `insert into guide_record_corrections
         (guide_record_id, user_id, correction_kind, original_payload, corrected_payload, note)
         values ($1, $2, $3, $4::jsonb, $5::jsonb, $6)`,
        [request.params.id, session.userId, correctionKind, JSON.stringify(originalPayload), JSON.stringify(correctedPayload), note],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    await upsertGuideEnvironmentMeshFromRecord({
      guideRecordId: request.params.id,
      userId: row.user_id,
      lat: row.lat,
      lng: row.lng,
      detectedFeatures: nextFeatures,
      seenAt: row.created_at,
    }).catch((error) => app.log.warn({ error, guideRecordId: request.params.id }, "guide environment mesh update failed"));
    await recordGuideInteraction({
      guideRecordId: request.params.id,
      userId: session.userId,
      sessionId: "",
      interactionType: "corrected",
      payload: { correctionKind, missingDataUse: "evaluation_loop_not_ecological_evidence" },
    }).catch((error) => app.log.warn({ error, guideRecordId: request.params.id }, "guide interaction correction log failed"));
    return { ok: true, guideRecordId: request.params.id };
  });
}
