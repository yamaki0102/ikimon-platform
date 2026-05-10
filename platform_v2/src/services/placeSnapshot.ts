import { getPool } from "../db.js";
import type { ObservationField, FieldStats } from "./observationFieldRegistry.js";
import { getField, getFieldStats } from "./observationFieldRegistry.js";
import {
  calculateRelationshipScore,
  type RelationshipAxis,
  type RelationshipScoreInputs,
  type RelationshipScoreResult,
} from "./relationshipScore.js";
import { getRelationshipScoreSnapshot, type RelationshipScoreSnapshot } from "./relationshipScoreSnapshot.js";
import { listRegionalHypotheses, type RegionalHypothesisRecord } from "./regionalHypotheses.js";
import { loadAreaSnapshotVisitIds } from "./areaSnapshotVisitScope.js";
import { buildPublicMapCellName, isGenericMeshAlbumName } from "./publicMapCellNaming.js";
import { buildSchoolAlbumProfiles, type SchoolAlbumProfile } from "./schoolAlbumProfiles.js";
import { buildAreaAccessGuidance, type AreaAccessGuidance } from "./areaAccessGuidance.js";

export type PlaceSnapshotField = {
  fieldId: string;
  name: string;
  source: ObservationField["source"];
  sourceLabel: string;
  locationLabel: string;
  lat: number;
  lng: number;
  radiusM: number;
  areaHa: number | null;
  visibility: "public" | "limited" | "private";
  officialUrl: string;
  ownerUrl: string;
  storyUrl: string;
  certificationUrl: string;
  sourceConfidence: number;
  verificationLevel: string;
  verificationLabel: string;
  originalName: string;
  schoolAlbumProfiles: SchoolAlbumProfile[];
  accessGuidance: AreaAccessGuidance;
};

export type PlaceSnapshotObservationSummary = {
  totalObservations: number;
  totalVisits: number;
  totalEvents: number;
  liveEvents: number;
  uniqueTaxa: number;
  taxonRankCount: number;
  seasonsCovered: number;
  seasonCoverageCap: number;
  seasonLabels: string[];
  effortCompletionRate: number;
  reviewAcceptedRate: number;
  nativeCount: number;
  exoticCount: number;
  unknownOriginCount: number;
  absentRecords: number;
  stewardshipActionCount: number;
  topTaxa: Array<{ name: string; count: number }>;
};

export type PlaceSnapshotMachineObservationSummary = {
  totalMachineObservations: number;
  aiCandidateCount: number;
  reviewerVerifiedCount: number;
  rejectedCount: number;
  passiveAudioCount: number;
  effortMetadataCount: number;
  uniqueMachineTaxa: number;
  latestObservedAt: string | null;
  topMachineTaxa: Array<{ name: string; count: number; reviewStatus: string }>;
  methodCounts: Array<{ method: string; count: number }>;
  calibrationDecisions: Array<{
    source: string;
    threshold: number;
    regionKey: string;
    taxonName: string;
    count: number;
  }>;
};

export type PlaceSnapshotRelationship = {
  source: "relationship_score_snapshot" | "field_fallback";
  placeId: string | null;
  score: RelationshipScoreResult;
  inputs: RelationshipScoreInputs;
  topActions: Array<{ axis: RelationshipAxis; score: number; priority: number }>;
  periodStart: string | null;
  periodEnd: string | null;
};

export type PlaceSnapshotNextAction = {
  kind: "revisit" | "evidence" | "event" | "stewardship" | "review";
  title: string;
  body: string;
  href: string | null;
};

export type PlaceSnapshotStewardshipWindow = {
  visits: number;
  observations: number;
  uniqueTaxa: number;
  effortVisits: number;
  absentRecords: number;
};

export type PlaceSnapshotStewardshipComparison = {
  actionId: string;
  actionKind: string;
  occurredAt: string;
  description: string | null;
  speciesStatus: string | null;
  linkedVisitId: string | null;
  before: PlaceSnapshotStewardshipWindow;
  after: PlaceSnapshotStewardshipWindow;
  signals: string[];
  limitations: string[];
};

export type PlaceSnapshotStewardshipImpact = {
  windowDays: number;
  comparisons: PlaceSnapshotStewardshipComparison[];
  summary: string;
};

export type PlaceSnapshotClaimBoundary = {
  canSay: string[];
  cannotSayYet: string[];
};

export type PlaceSnapshot = {
  framing: {
    publicLabel: "この場所のいま";
    monitoringLabel: "場所のモニタリングブリーフ";
    advancedLabel: "市民参加型の生物多様性データツイン";
  };
  field: PlaceSnapshotField;
  observationSummary: PlaceSnapshotObservationSummary;
  machineObservationSummary: PlaceSnapshotMachineObservationSummary;
  relationshipScore: PlaceSnapshotRelationship;
  hypotheses: RegionalHypothesisRecord[];
  nextActions: PlaceSnapshotNextAction[];
  stewardshipImpact: PlaceSnapshotStewardshipImpact;
  claimBoundary: PlaceSnapshotClaimBoundary;
  generatedAt: string;
};

type CanonicalAgg = {
  totalObservations: number;
  totalVisits: number;
  uniqueTaxa: number;
  taxonRankCount: number;
  months: number[];
  effortFilled: number;
  effortTotal: number;
  acceptedCount: number;
  reviewTotal: number;
  nativeCount: number;
  exoticCount: number;
  unknownOriginCount: number;
  stewardshipActionCount: number;
};

const EMPTY_MACHINE_OBSERVATION_SUMMARY: PlaceSnapshotMachineObservationSummary = {
  totalMachineObservations: 0,
  aiCandidateCount: 0,
  reviewerVerifiedCount: 0,
  rejectedCount: 0,
  passiveAudioCount: 0,
  effortMetadataCount: 0,
  uniqueMachineTaxa: 0,
  latestObservedAt: null,
  topMachineTaxa: [],
  methodCounts: [],
  calibrationDecisions: [],
};

const SOURCE_LABEL: Record<ObservationField["source"], string> = {
  user_defined: "マイフィールド",
  nature_symbiosis_site: "自然共生サイト",
  tsunag: "TSUNAG",
  protected_area: "保護区",
  oecm: "OECM",
  school: "学校",
  osm_park: "公園 (OSM)",
  admin_municipality: "市町村",
  admin_prefecture: "都道府県",
  admin_country: "国",
};

const ADMIN_LEVEL_LABEL: Record<string, string> = {
  school: "学校",
  osm_park: "公園 (OSM)",
  admin_municipality: "市町村",
  admin_prefecture: "都道府県",
  admin_country: "国",
};

/** OSM/N03 importer は CHECK 制約回避で source='user_defined' で書くため、
 *  そのままだと「マイフィールド」と誤表示される。admin_level を優先して
 *  適切なラベルに解決する。 */
function resolveSourceLabel(field: { source: ObservationField["source"]; adminLevel: string | null }): string {
  if (field.adminLevel && ADMIN_LEVEL_LABEL[field.adminLevel]) {
    return ADMIN_LEVEL_LABEL[field.adminLevel]!;
  }
  return SOURCE_LABEL[field.source];
}

const SEASON_LABELS = ["春", "夏", "秋", "冬"];

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? clamp01(numerator / denominator) : 0;
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function fieldVisibility(field: ObservationField): PlaceSnapshotField["visibility"] {
  if (field.source === "user_defined") {
    return field.ownerUserId ? "limited" : "public";
  }
  return "public";
}

function locationLabel(field: ObservationField): string {
  const parts = [field.prefecture, field.city].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : `${field.lat.toFixed(4)}, ${field.lng.toFixed(4)}`;
}

function friendlyAlbumName(field: ObservationField, localityHint?: { municipality?: string | null; prefecture?: string | null } | null): string {
  if (!isGenericMeshAlbumName(field.name)) return field.name;
  const municipality = (localityHint?.municipality || field.city || "").trim();
  if (municipality) {
    return buildPublicMapCellName({
      localityLabel: municipality,
      localityScope: "municipality",
      gridM: field.radiusM <= 1200 ? 1000 : field.radiusM <= 3500 ? 3000 : 10000,
      count: 0,
    }).albumName;
  }
  const prefecture = (localityHint?.prefecture || field.prefecture || "").trim();
  if (prefecture) {
    return buildPublicMapCellName({
      localityLabel: prefecture,
      localityScope: "prefecture",
      gridM: field.radiusM <= 3500 ? 3000 : 10000,
      count: 0,
    }).albumName;
  }
  return buildPublicMapCellName({
    localityLabel: "このあたり",
    localityScope: "blurred",
    gridM: field.radiusM <= 1200 ? 1000 : 3000,
    count: 0,
  }).albumName;
}

function monthToSeason(month: number): number {
  if (month >= 3 && month <= 5) return 0;
  if (month >= 6 && month <= 8) return 1;
  if (month >= 9 && month <= 11) return 2;
  return 3;
}

function seasonLabelsFromMonths(months: number[]): string[] {
  const seasons = new Set<number>();
  for (const month of months) {
    if (Number.isFinite(month) && month >= 1 && month <= 12) {
      seasons.add(monthToSeason(month));
    }
  }
  return Array.from(seasons)
    .sort((a, b) => a - b)
    .map((idx) => SEASON_LABELS[idx] ?? "季節不明");
}

function fieldBbox(field: ObservationField): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const radius = Math.max(50, Math.min(field.radiusM || 1000, 200000));
  const latPad = radius / 111_000;
  const lngPad = radius / (111_000 * Math.max(0.05, Math.cos((field.lat * Math.PI) / 180)));
  return {
    minLat: field.lat - latPad,
    maxLat: field.lat + latPad,
    minLng: field.lng - lngPad,
    maxLng: field.lng + lngPad,
  };
}

function meshKeyForField(field: ObservationField): string {
  return `${field.lat.toFixed(4)}:${field.lng.toFixed(4)}`;
}

function deriveTopActions(
  result: RelationshipScoreResult,
): Array<{ axis: RelationshipAxis; score: number; priority: number }> {
  const cost: Record<RelationshipAxis, number> = {
    access: 0.4,
    engagement: 0.7,
    learning: 0.8,
    stewardship: 0.6,
    evidence: 0.5,
  };
  return (Object.keys(result.axes) as RelationshipAxis[])
    .map((axis) => {
      const score = result.axes[axis].score;
      const gap = (20 - score) / 20;
      const headroom = score === 0 ? 0.5 : score === 10 ? 1 : 0;
      return { axis, score, priority: gap * 0.5 + cost[axis] * 0.3 + headroom * 0.2 };
    })
    .filter((item) => item.score < 20)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);
}

export function buildFieldRelationshipInputs(
  field: ObservationField,
  summary: PlaceSnapshotObservationSummary,
): RelationshipScoreInputs {
  const observationDenominator = Math.max(1, summary.totalObservations);
  return {
    accessStatus: fieldVisibility(field) === "public" ? "public" : "limited",
    safetyNotesPresent: Boolean(field.summary || field.officialUrl || field.ownerUrl || field.certificationUrl),
    visitsCount: summary.totalVisits,
    seasonsCovered: summary.seasonsCovered,
    repeatObserverCount: summary.totalEvents >= 2 ? 1 : 0,
    notesCompletionRate: summary.totalVisits > 0 ? 0.3 : 0,
    identificationAttemptRate: summary.uniqueTaxa > 0 ? Math.min(1, summary.uniqueTaxa / observationDenominator) : 0,
    taxonRankDistinctCount: summary.taxonRankCount,
    reviewReplyCount: summary.reviewAcceptedRate > 0 ? 1 : 0,
    stewardshipActionCount: summary.stewardshipActionCount,
    stewardshipActionLinkedRate: summary.stewardshipActionCount > 0 ? 0.5 : 0,
    acceptedReviewRate: summary.reviewAcceptedRate,
    effortCompletionRate: summary.effortCompletionRate,
    auditTrailPresent: summary.reviewAcceptedRate > 0,
    centerLatitude: field.lat,
  };
}

function buildObservationSummary(args: {
  field: ObservationField;
  stats: FieldStats;
  canonical: CanonicalAgg;
}): PlaceSnapshotObservationSummary {
  const { stats, canonical } = args;
  const totalObservations = Math.max(stats.totalObservations, canonical.totalObservations);
  const uniqueTaxa = Math.max(stats.uniqueSpeciesCount, canonical.uniqueTaxa);
  const totalVisits = Math.max(stats.totalSessions, canonical.totalVisits);
  const seasonLabels = seasonLabelsFromMonths(canonical.months);
  return {
    totalObservations,
    totalVisits,
    totalEvents: stats.totalSessions,
    liveEvents: stats.liveSessions,
    uniqueTaxa,
    taxonRankCount: canonical.taxonRankCount,
    seasonsCovered: seasonLabels.length,
    seasonCoverageCap: 4,
    seasonLabels,
    effortCompletionRate: pct(canonical.effortFilled, canonical.effortTotal),
    reviewAcceptedRate: pct(canonical.acceptedCount, canonical.reviewTotal),
    nativeCount: canonical.nativeCount,
    exoticCount: canonical.exoticCount,
    unknownOriginCount: totalObservations > 0
      ? Math.max(canonical.unknownOriginCount, totalObservations - canonical.nativeCount - canonical.exoticCount)
      : 0,
    absentRecords: stats.totalAbsences,
    stewardshipActionCount: canonical.stewardshipActionCount,
    topTaxa: stats.topTaxa,
  };
}

function emptyStewardshipImpact(): PlaceSnapshotStewardshipImpact {
  return {
    windowDays: 30,
    comparisons: [],
    summary: "まだ前後比較できる手入れ記録はありません。草刈り・清掃・水辺管理などを観察と結びつけると、変化の兆しを読めます。",
  };
}

function stewardshipSignals(
  before: PlaceSnapshotStewardshipWindow,
  after: PlaceSnapshotStewardshipWindow,
): string[] {
  const signals: string[] = [];
  if (after.visits > 0) signals.push("after_window_observed");
  if (before.visits > 0 && after.visits > 0) signals.push("before_after_comparable");
  if (after.uniqueTaxa > before.uniqueTaxa) signals.push("taxa_seen_after_action");
  if (after.effortVisits > 0) signals.push("effort_recorded_after_action");
  if (after.absentRecords > 0) signals.push("explicit_non_detection_after_action");
  return signals;
}

function stewardshipLimitations(
  before: PlaceSnapshotStewardshipWindow,
  after: PlaceSnapshotStewardshipWindow,
): string[] {
  const limitations: string[] = [];
  if (before.visits === 0) limitations.push("baseline_missing");
  if (after.visits === 0) limitations.push("followup_missing");
  if (before.effortVisits === 0 || after.effortVisits === 0) limitations.push("effort_not_aligned");
  if (before.visits < 2 || after.visits < 2) limitations.push("small_sample");
  return limitations;
}

function buildStewardshipSummary(comparisons: PlaceSnapshotStewardshipComparison[]): string {
  if (comparisons.length === 0) return emptyStewardshipImpact().summary;
  const comparable = comparisons.filter((item) => item.signals.includes("before_after_comparable")).length;
  const followup = comparisons.filter((item) => item.after.visits > 0).length;
  if (comparable > 0) {
    return `${comparisons.length}件の手入れ記録のうち${comparable}件で前後の観察窓があり、施策評価の入口ができています。`;
  }
  if (followup > 0) {
    return `${comparisons.length}件の手入れ記録に対して事後観察はあります。次は事前条件をそろえると比較しやすくなります。`;
  }
  return `${comparisons.length}件の手入れ記録があります。次回は実施後30日以内の再訪を作ると変化の兆しを読めます。`;
}

function axisAction(axis: RelationshipAxis, fieldId: string): PlaceSnapshotNextAction {
  switch (axis) {
    case "access":
      return {
        kind: "evidence",
        title: "安全に歩ける範囲を明確にする",
        body: "公開範囲、立入条件、注意点を先に整えると、観察会と再訪の土台が強くなります。",
        href: `/community/fields/${encodeURIComponent(fieldId)}`,
      };
    case "engagement":
      return {
        kind: "revisit",
        title: "同じ場所をもう一度見る",
        body: "同じ範囲を別の季節や時間帯で歩くと、単発の発見が場所の記憶に変わります。",
        href: `/community/events/new?field_id=${encodeURIComponent(fieldId)}`,
      };
    case "learning":
      return {
        kind: "review",
        title: "分からないまま残せる証拠を増やす",
        body: "種名を急がず、写真・メモ・周囲の手がかりを残すと、後からレビューしやすくなります。",
        href: `/community/events/new?field_id=${encodeURIComponent(fieldId)}`,
      };
    case "stewardship":
      return {
        kind: "stewardship",
        title: "手入れと観察を結びつける",
        body: "草刈り、清掃、水辺管理の前後を同じ構図で残すと、変化の兆しを読めます。",
        href: null,
      };
    case "evidence":
      return {
        kind: "evidence",
        title: "effort とレビューを残す",
        body: "探索時間、対象分類群、見つからなかった記録を残すと、言える範囲がはっきりします。",
        href: `/community/events/new?field_id=${encodeURIComponent(fieldId)}`,
      };
  }
}

export function buildNextActions(args: {
  fieldId: string;
  relationship: PlaceSnapshotRelationship;
  summary: PlaceSnapshotObservationSummary;
  hypotheses: RegionalHypothesisRecord[];
}): PlaceSnapshotNextAction[] {
  const actions: PlaceSnapshotNextAction[] = [];
  if (args.summary.totalObservations === 0) {
    actions.push({
      kind: "event",
      title: "最初の観察会を作る",
      body: "まずは30分で、広角の環境写真と気になった生きものを数件残すところから始めます。",
      href: `/community/events/new?field_id=${encodeURIComponent(args.fieldId)}`,
    });
  }
  for (const item of args.relationship.topActions) {
    actions.push(axisAction(item.axis, args.fieldId));
    if (actions.length >= 3) break;
  }
  const hypothesis = args.hypotheses.find((item) => item.nextSamplingProtocol.trim().length > 0);
  if (hypothesis && actions.length < 4) {
    actions.push({
      kind: "evidence",
      title: "仮説を1つだけ確かめる",
      body: hypothesis.nextSamplingProtocol,
      href: `/community/events/new?field_id=${encodeURIComponent(args.fieldId)}`,
    });
  }
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.kind}:${action.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
}

export function buildClaimBoundary(args: {
  summary: PlaceSnapshotObservationSummary;
  machineSummary?: PlaceSnapshotMachineObservationSummary;
  hypotheses: RegionalHypothesisRecord[];
}): PlaceSnapshotClaimBoundary {
  const { summary, machineSummary = EMPTY_MACHINE_OBSERVATION_SUMMARY, hypotheses } = args;
  const canSay: string[] = [];
  const cannotSayYet: string[] = [
    "この画面だけで TNFD 準拠、自然共生サイト認定、保全成果を保証することはできません。",
  ];
  if (summary.totalObservations > 0) {
    canSay.push(`${summary.totalObservations}件の観察と${summary.totalVisits}回相当の訪問から、この場所で見え始めた生きものと季節の手がかりを読めます。`);
  } else {
    canSay.push("場所の範囲と観察会の入口は用意されています。生物相や変化は、これから記録を重ねて読む段階です。");
  }
  if (summary.seasonsCovered > 0) {
    canSay.push(`${summary.seasonLabels.join("・")}の記録があり、季節比較の入口があります。`);
  }
  if (hypotheses.length > 0) {
    canSay.push("地域仮説は断定ではなく、次に現地で確認する観察プロトコルとして使えます。");
  }
  if (machineSummary.totalMachineObservations > 0) {
    canSay.push(`${machineSummary.totalMachineObservations}件の機械観測を、AI候補・reviewer検証済み・却下の状態に分けて活動指標として読めます。`);
  }
  if (machineSummary.reviewerVerifiedCount > 0) {
    canSay.push(`${machineSummary.reviewerVerifiedCount}件の機械観測は reviewer検証済み記録として扱えます。`);
  }
  if (machineSummary.aiCandidateCount > 0) {
    cannotSayYet.push("AI候補は reviewer検証済み記録と混同せず、確定的な種リストや外部報告の根拠には使いません。");
  }
  if (summary.effortCompletionRate < 0.4) {
    cannotSayYet.push("探索時間や対象範囲が薄いため、増減や不在はまだ判断できません。");
  }
  if (summary.reviewAcceptedRate <= 0) {
    cannotSayYet.push("レビュー済みの根拠が少ないため、強い研究主張や確定的な種リストには使いません。");
  }
  if (summary.seasonsCovered < 2) {
    cannotSayYet.push("複数季節の比較が不足しているため、年変化や季節性は仮説段階です。");
  }
  return { canSay, cannotSayYet };
}

export function composePlaceSnapshot(args: {
  field: ObservationField;
  stats: FieldStats;
  canonical: CanonicalAgg;
  machineObservationSummary?: PlaceSnapshotMachineObservationSummary;
  localityHint?: { municipality?: string | null; prefecture?: string | null } | null;
  relationshipSnapshot?: RelationshipScoreSnapshot | null;
  placeId?: string | null;
  hypotheses?: RegionalHypothesisRecord[];
  stewardshipImpact?: PlaceSnapshotStewardshipImpact;
  now?: Date;
}): PlaceSnapshot {
  const summary = buildObservationSummary({
    field: args.field,
    stats: args.stats,
    canonical: args.canonical,
  });
  const fallbackInputs = buildFieldRelationshipInputs(args.field, summary);
  const fallbackScore = calculateRelationshipScore(fallbackInputs);
  const relationship: PlaceSnapshotRelationship = args.relationshipSnapshot
    ? {
        source: "relationship_score_snapshot",
        placeId: args.relationshipSnapshot.placeId,
        score: args.relationshipSnapshot.score,
        inputs: args.relationshipSnapshot.inputs,
        topActions: args.relationshipSnapshot.topActions,
        periodStart: args.relationshipSnapshot.periodStart,
        periodEnd: args.relationshipSnapshot.periodEnd,
      }
    : {
        source: "field_fallback",
        placeId: args.placeId ?? null,
        score: fallbackScore,
        inputs: fallbackInputs,
        topActions: deriveTopActions(fallbackScore),
        periodStart: null,
        periodEnd: null,
      };
  const hypotheses = args.hypotheses ?? [];
  const stewardshipImpact = args.stewardshipImpact ?? emptyStewardshipImpact();
  const machineObservationSummary = args.machineObservationSummary ?? EMPTY_MACHINE_OBSERVATION_SUMMARY;
  return {
    framing: {
      publicLabel: "この場所のいま",
      monitoringLabel: "場所のモニタリングブリーフ",
      advancedLabel: "市民参加型の生物多様性データツイン",
    },
    field: {
      fieldId: args.field.fieldId,
      name: friendlyAlbumName(args.field, args.localityHint),
      source: args.field.source,
      sourceLabel: resolveSourceLabel(args.field),
      locationLabel: locationLabel(args.field),
      lat: args.field.lat,
      lng: args.field.lng,
      radiusM: args.field.radiusM,
      areaHa: args.field.areaHa,
      visibility: fieldVisibility(args.field),
      officialUrl: args.field.officialUrl,
      ownerUrl: args.field.ownerUrl,
      storyUrl: args.field.storyUrl,
      certificationUrl: args.field.certificationUrl,
      sourceConfidence: args.field.sourceConfidence,
      verificationLevel: args.field.verificationLevel,
      verificationLabel: args.field.verificationLabel,
      originalName: args.field.name,
      schoolAlbumProfiles: buildSchoolAlbumProfiles(args.field),
      accessGuidance: buildAreaAccessGuidance(args.field),
    },
    observationSummary: summary,
    machineObservationSummary,
    relationshipScore: relationship,
    hypotheses,
    nextActions: buildNextActions({
      fieldId: args.field.fieldId,
      relationship,
      summary,
      hypotheses,
    }),
    stewardshipImpact,
    claimBoundary: buildClaimBoundary({ summary, machineSummary: machineObservationSummary, hypotheses }),
    generatedAt: (args.now ?? new Date()).toISOString(),
  };
}

async function loadStewardshipWindow(
  scopedVisitIds: string[],
  start: Date,
  end: Date,
): Promise<PlaceSnapshotStewardshipWindow> {
  const pool = getPool();
  return safeQuery(
    "stewardship_window",
    async () => {
      const result = await pool.query<{
        visits: string;
        observations: string;
        unique_taxa: string;
        effort_visits: string;
        absent_records: string;
      }>(
        `with field_visits as (
            select v.*
              from visits v
             where v.observed_at >= $1
               and v.observed_at < $2
               and v.visit_id = any($3::uuid[])
          ),
          field_occ as (
            select o.*
              from occurrences o
              join field_visits fv on fv.visit_id = o.visit_id
          )
          select
            (select count(distinct visit_id)::text from field_visits) as visits,
            (select count(*)::text from field_occ) as observations,
            (select count(distinct coalesce(nullif(scientific_name, ''), nullif(vernacular_name, ''), occurrence_id))::text from field_occ) as unique_taxa,
            (select count(*) filter (where effort_minutes is not null or distance_meters is not null)::text from field_visits) as effort_visits,
            (select count(*) filter (where occurrence_status = 'absent')::text from field_occ) as absent_records`,
        [start, end, scopedVisitIds],
      );
      const row = result.rows[0];
      return {
        visits: Number(row?.visits ?? 0),
        observations: Number(row?.observations ?? 0),
        uniqueTaxa: Number(row?.unique_taxa ?? 0),
        effortVisits: Number(row?.effort_visits ?? 0),
        absentRecords: Number(row?.absent_records ?? 0),
      };
    },
    { visits: 0, observations: 0, uniqueTaxa: 0, effortVisits: 0, absentRecords: 0 },
  );
}

async function loadStewardshipImpact(placeId: string | null, scopedVisitIds: string[]): Promise<PlaceSnapshotStewardshipImpact> {
  if (!placeId) return emptyStewardshipImpact();
  const pool = getPool();
  const actions = await safeQuery(
    "stewardship_actions",
    async () => {
      const result = await pool.query<{
        action_id: string;
        action_kind: string;
        occurred_at: string;
        description: string | null;
        species_status: string | null;
        linked_visit_id: string | null;
      }>(
        `select action_id,
                action_kind,
                occurred_at::text as occurred_at,
                description,
                species_status,
                linked_visit_id
           from stewardship_actions
          where place_id = $1
          order by occurred_at desc
          limit 3`,
        [placeId],
      );
      return result.rows;
    },
    [] as Array<{
      action_id: string;
      action_kind: string;
      occurred_at: string;
      description: string | null;
      species_status: string | null;
      linked_visit_id: string | null;
    }>,
  );
  const comparisons: PlaceSnapshotStewardshipComparison[] = [];
  for (const action of actions) {
    const occurredAt = new Date(action.occurred_at);
    if (Number.isNaN(occurredAt.getTime())) continue;
    const beforeStart = new Date(occurredAt);
    beforeStart.setUTCDate(beforeStart.getUTCDate() - 30);
    const afterEnd = new Date(occurredAt);
    afterEnd.setUTCDate(afterEnd.getUTCDate() + 30);
    const [before, after] = await Promise.all([
      loadStewardshipWindow(scopedVisitIds, beforeStart, occurredAt),
      loadStewardshipWindow(scopedVisitIds, occurredAt, afterEnd),
    ]);
    comparisons.push({
      actionId: action.action_id,
      actionKind: action.action_kind,
      occurredAt: action.occurred_at,
      description: action.description,
      speciesStatus: action.species_status,
      linkedVisitId: action.linked_visit_id,
      before,
      after,
      signals: stewardshipSignals(before, after),
      limitations: stewardshipLimitations(before, after),
    });
  }
  return {
    windowDays: 30,
    comparisons,
    summary: buildStewardshipSummary(comparisons),
  };
}

async function safeQuery<T>(label: string, runner: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await runner();
  } catch (error) {
    console.warn(`[placeSnapshot] ${label} failed`, error);
    return fallback;
  }
}

async function resolvePlaceIdForField(field: ObservationField): Promise<string | null> {
  const pool = getPool();
  const direct = await safeQuery(
    "resolve_place_direct",
    async () => {
      const result = await pool.query<{ place_id: string }>(
        `select place_id
           from places
          where place_id = $1
             or legacy_place_key = $1
             or metadata->>'field_id' = $1
             or ($2 <> '' and legacy_site_id = $2)
             or ($3 <> '' and canonical_name = $3)
          order by visit_count desc nulls last, updated_at desc
          limit 1`,
        [field.fieldId, field.certificationId, field.name],
      );
      return result.rows[0]?.place_id ?? null;
    },
    null as string | null,
  );
  if (direct) return direct;

  const bbox = fieldBbox(field);
  return safeQuery(
    "resolve_place_nearest",
    async () => {
      const result = await pool.query<{ place_id: string }>(
        `select place_id
           from places
          where center_latitude between $1 and $2
            and center_longitude between $3 and $4
          order by (
            power(center_latitude - $5, 2) + power(center_longitude - $6, 2)
          ) asc, visit_count desc nulls last
          limit 1`,
        [bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng, field.lat, field.lng],
      );
      return result.rows[0]?.place_id ?? null;
    },
    null as string | null,
  );
}

async function loadCanonicalAgg(scopedVisitIds: string[], placeId: string | null): Promise<CanonicalAgg> {
  const empty: CanonicalAgg = {
    totalObservations: 0,
    totalVisits: 0,
    uniqueTaxa: 0,
    taxonRankCount: 0,
    months: [],
    effortFilled: 0,
    effortTotal: 0,
    acceptedCount: 0,
    reviewTotal: 0,
    nativeCount: 0,
    exoticCount: 0,
    unknownOriginCount: 0,
    stewardshipActionCount: 0,
  };
  const pool = getPool();
  return safeQuery(
    "canonical_agg",
    async () => {
      const result = await pool.query<{
        visit_count: string;
        occurrence_count: string;
        unique_taxa: string;
        taxon_rank_count: string;
        months: number[] | null;
        effort_filled: string;
        effort_total: string;
        accepted_count: string;
        review_total: string;
        native_count: string;
        exotic_count: string;
        unknown_origin_count: string;
        stewardship_count: string;
      }>(
        `with field_visits as (
            select v.*
              from visits v
             where v.visit_id = any($1::uuid[])
          ),
          field_occ as (
            select o.*
              from occurrences o
              join field_visits fv on fv.visit_id = o.visit_id
          ),
          stewardship as (
            select count(*)::text as count
              from stewardship_actions
             where ($2::text is not null and place_id = $2)
          )
          select
            (select count(distinct visit_id)::text from field_visits) as visit_count,
            (select count(*)::text from field_occ) as occurrence_count,
            (select count(distinct coalesce(nullif(scientific_name, ''), nullif(vernacular_name, ''), occurrence_id))::text from field_occ) as unique_taxa,
            (select count(distinct taxon_rank)::text from field_occ where taxon_rank is not null and taxon_rank <> '') as taxon_rank_count,
            (select array(select distinct extract(month from observed_at)::int from field_visits order by 1)) as months,
            (select count(*) filter (where effort_minutes is not null or distance_meters is not null)::text from field_visits) as effort_filled,
            (select count(*)::text from field_visits) as effort_total,
            (select count(*) filter (where quality_review_status = 'accepted')::text from field_visits) as accepted_count,
            (select count(*)::text from field_visits) as review_total,
            (select count(*) filter (where lower(coalesce(organism_origin, source_payload->>'native_exotic_status', source_payload->>'origin', '')) in ('native', '在来'))::text from field_occ) as native_count,
            (select count(*) filter (where lower(coalesce(organism_origin, source_payload->>'native_exotic_status', source_payload->>'origin', '')) in ('exotic', 'introduced', '外来'))::text from field_occ) as exotic_count,
            (select count(*) filter (where coalesce(organism_origin, source_payload->>'native_exotic_status', source_payload->>'origin', '') = '')::text from field_occ) as unknown_origin_count,
            (select count from stewardship) as stewardship_count`,
        [scopedVisitIds, placeId],
      );
      const row = result.rows[0];
      if (!row) return empty;
      return {
        totalObservations: Number(row.occurrence_count ?? 0),
        totalVisits: Number(row.visit_count ?? 0),
        uniqueTaxa: Number(row.unique_taxa ?? 0),
        taxonRankCount: Number(row.taxon_rank_count ?? 0),
        months: row.months ?? [],
        effortFilled: Number(row.effort_filled ?? 0),
        effortTotal: Number(row.effort_total ?? 0),
        acceptedCount: Number(row.accepted_count ?? 0),
        reviewTotal: Number(row.review_total ?? 0),
        nativeCount: Number(row.native_count ?? 0),
        exoticCount: Number(row.exotic_count ?? 0),
        unknownOriginCount: Number(row.unknown_origin_count ?? 0),
        stewardshipActionCount: Number(row.stewardship_count ?? 0),
      };
    },
    empty,
  );
}

async function loadMachineObservationSummary(scopedVisitIds: string[]): Promise<PlaceSnapshotMachineObservationSummary> {
  if (scopedVisitIds.length === 0) return EMPTY_MACHINE_OBSERVATION_SUMMARY;
  const pool = getPool();
  return safeQuery(
    "machine_observation_summary",
    async () => {
      const result = await pool.query<{
        total_machine_observations: string;
        ai_candidate_count: string;
        reviewer_verified_count: string;
        rejected_count: string;
        passive_audio_count: string;
        effort_metadata_count: string;
        unique_machine_taxa: string;
        latest_observed_at: string | null;
        top_machine_taxa: Array<{ name: string; count: number; reviewStatus: string }> | null;
        method_counts: Array<{ method: string; count: number }> | null;
        calibration_decisions: Array<{
          source: string;
          threshold: number;
          regionKey: string;
          taxonName: string;
          count: number;
        }> | null;
      }>(
        `with field_visits as (
            select v.*
              from visits v
             where v.visit_id = any($1::uuid[])
          ),
          machine_occ as (
            select o.*,
                   fv.observed_at,
                   coalesce(omc.sampling_effort, '{}'::jsonb) as method_sampling_effort,
                   coalesce(omc.sensor_status, '{}'::jsonb) as method_sensor_status,
                   coalesce(nullif(omc.observation_method, ''), nullif(fv.visit_mode, ''), nullif(fv.session_mode, ''), fv.source_kind, 'machine_observation') as method
              from occurrences o
              join field_visits fv on fv.visit_id = o.visit_id
              left join observation_method_contexts omc on omc.visit_id = o.visit_id
             where coalesce(o.basis_of_record, 'HumanObservation') = 'MachineObservation'
          ),
          top_taxa as (
            select coalesce(nullif(scientific_name, ''), nullif(vernacular_name, ''), nullif(taxon_rank, ''), 'AI候補') as name,
                   count(*)::int as count,
                   case
                     when bool_or(coalesce(ai_assessment_status, data_quality, '') = 'reviewer_verified') then 'reviewer_verified'
                     when bool_or(coalesce(ai_assessment_status, data_quality, '') = 'reviewer_rejected') then 'reviewer_rejected'
                     else 'ai_candidate'
                   end as review_status
              from machine_occ
             group by 1
             order by count(*) desc, name asc
             limit 8
          ),
          methods as (
            select method, count(*)::int as count
              from machine_occ
             group by method
             order by count(*) desc, method asc
          ),
          calibration_decisions as (
            select coalesce(nullif(source_payload->'calibration'->>'source', ''), 'default') as source,
                   case
                     when coalesce(source_payload->'calibration'->>'threshold', '') ~ '^[0-9]+(\\.[0-9]+)?$'
                       then (source_payload->'calibration'->>'threshold')::numeric::float
                     else 0.9
                   end as threshold,
                   coalesce(nullif(source_payload->'calibration'->>'regionKey', ''), 'global') as region_key,
                   coalesce(
                     nullif(source_payload->'calibration'->>'taxonName', ''),
                     nullif(scientific_name, ''),
                     nullif(vernacular_name, ''),
                     nullif(taxon_rank, ''),
                     'AI候補'
                   ) as taxon_name,
                   count(*)::int as count
              from machine_occ
             group by 1, 2, 3, 4
             order by count(*) desc, taxon_name asc
          )
          select
            (select count(*)::text from machine_occ) as total_machine_observations,
            (select count(*) filter (
              where coalesce(ai_assessment_status, data_quality, '') in ('ai_audio_candidate', 'ai_candidate', 'unreviewed')
                 or (coalesce(ai_assessment_status, data_quality, '') = '' and evidence_tier <= 1)
            )::text from machine_occ) as ai_candidate_count,
            (select count(*) filter (
              where coalesce(ai_assessment_status, data_quality, '') = 'reviewer_verified'
                 or evidence_tier >= 2
            )::text from machine_occ) as reviewer_verified_count,
            (select count(*) filter (
              where coalesce(ai_assessment_status, data_quality, '') in ('reviewer_rejected', 'rejected')
            )::text from machine_occ) as rejected_count,
            (select count(*) filter (
              where method in ('passive_audio', 'passive_audio_ingest')
            )::text from machine_occ) as passive_audio_count,
            (select count(*) filter (
              where method_sampling_effort <> '{}'::jsonb
                 or method_sensor_status <> '{}'::jsonb
                 or coalesce(source_payload->'sampling_effort', '{}'::jsonb) <> '{}'::jsonb
                 or coalesce(source_payload->'sensor_status', '{}'::jsonb) <> '{}'::jsonb
            )::text from machine_occ) as effort_metadata_count,
            (select count(distinct coalesce(nullif(scientific_name, ''), nullif(vernacular_name, ''), nullif(taxon_rank, ''), occurrence_id))::text from machine_occ) as unique_machine_taxa,
            (select max(observed_at)::text from machine_occ) as latest_observed_at,
            (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'count', count, 'reviewStatus', review_status)), '[]'::jsonb) from top_taxa) as top_machine_taxa,
            (select coalesce(jsonb_agg(jsonb_build_object('method', method, 'count', count)), '[]'::jsonb) from methods) as method_counts,
            (select coalesce(jsonb_agg(jsonb_build_object('source', source, 'threshold', threshold, 'regionKey', region_key, 'taxonName', taxon_name, 'count', count)), '[]'::jsonb) from calibration_decisions) as calibration_decisions`,
        [scopedVisitIds],
      );
      const row = result.rows[0];
      if (!row) return EMPTY_MACHINE_OBSERVATION_SUMMARY;
      return {
        totalMachineObservations: Number(row.total_machine_observations ?? 0),
        aiCandidateCount: Number(row.ai_candidate_count ?? 0),
        reviewerVerifiedCount: Number(row.reviewer_verified_count ?? 0),
        rejectedCount: Number(row.rejected_count ?? 0),
        passiveAudioCount: Number(row.passive_audio_count ?? 0),
        effortMetadataCount: Number(row.effort_metadata_count ?? 0),
        uniqueMachineTaxa: Number(row.unique_machine_taxa ?? 0),
        latestObservedAt: row.latest_observed_at,
        topMachineTaxa: row.top_machine_taxa ?? [],
        methodCounts: row.method_counts ?? [],
        calibrationDecisions: row.calibration_decisions ?? [],
      };
    },
    EMPTY_MACHINE_OBSERVATION_SUMMARY,
  );
}

async function loadLocalityHint(scopedVisitIds: string[]): Promise<{ municipality: string | null; prefecture: string | null } | null> {
  if (scopedVisitIds.length === 0) return null;
  const pool = getPool();
  return safeQuery(
    "locality_hint",
    async () => {
      const result = await pool.query<{ municipality: string | null; prefecture: string | null }>(
        `select nullif(observed_municipality, '') as municipality,
                nullif(observed_prefecture, '') as prefecture
           from visits
          where visit_id = any($1::uuid[])
            and (nullif(observed_municipality, '') is not null or nullif(observed_prefecture, '') is not null)
          group by nullif(observed_municipality, ''), nullif(observed_prefecture, '')
          order by count(*) desc, municipality asc nulls last, prefecture asc nulls last
          limit 1`,
        [scopedVisitIds],
      );
      return result.rows[0] ?? null;
    },
    null,
  );
}

async function loadFieldHypotheses(field: ObservationField, placeId: string | null): Promise<RegionalHypothesisRecord[]> {
  const byPlace = placeId
    ? await listRegionalHypotheses({ placeId, publicOnly: true, limit: 6 }).catch(() => [])
    : [];
  if (byPlace.length > 0) return byPlace;
  return listRegionalHypotheses({
    meshKey: meshKeyForField(field),
    publicOnly: true,
    limit: 6,
  }).catch(() => []);
}

export async function getPlaceSnapshot(
  fieldId: string,
  options: { observedFrom?: string | null; observedTo?: string | null } = {},
): Promise<PlaceSnapshot | null> {
  const field = await getField(fieldId);
  if (!field) return null;
  const [stats, placeId] = await Promise.all([
    getFieldStats(fieldId),
    resolvePlaceIdForField(field),
  ]);
  if (!stats) return null;
  const scopedVisitIds = await loadAreaSnapshotVisitIds(field, placeId, {
    observedFrom: options.observedFrom ?? null,
    observedTo: options.observedTo ?? null,
  });
  const [canonical, machineObservationSummary, hypotheses, localityHint] = await Promise.all([
    loadCanonicalAgg(scopedVisitIds, placeId),
    loadMachineObservationSummary(scopedVisitIds),
    loadFieldHypotheses(field, placeId),
    loadLocalityHint(scopedVisitIds),
  ]);
  const stewardshipImpact = await loadStewardshipImpact(placeId, scopedVisitIds);
  const relationshipSnapshot = placeId
    ? await getRelationshipScoreSnapshot({
        placeId,
        lang: "ja",
        persist: false,
        generateNarrative: false,
        bbox: fieldBbox(field),
      }).catch(() => null)
    : null;
  return composePlaceSnapshot({
    field,
    stats,
    canonical,
    machineObservationSummary,
    localityHint,
    relationshipSnapshot,
    placeId,
    hypotheses,
    stewardshipImpact,
  });
}

export const __test__ = {
  buildObservationSummary,
  loadMachineObservationSummary,
  fieldBbox,
  fieldVisibility,
  meshKeyForField,
  friendlyAlbumName,
  isGenericMeshAlbumName,
  seasonLabelsFromMonths,
};
