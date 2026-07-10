import type { MonitoringReadiness } from "./monitoringReadiness.js";
import type { RecordSafetyProfileV0, RecordSafetyGate } from "./recordSafetyProfile.js";

export type MunicipalReadinessV0 = {
  schemaVersion: "municipal_readiness/v0";
  municipalReady: RecordSafetyGate;
  publicStoryReady: RecordSafetyGate;
  reviewQueueReady: RecordSafetyGate;
  recommendedLane: "public_story" | "local_review" | "municipal_report_candidate" | "private_memory";
  exportFormats: Array<"markdown" | "json" | "csv">;
};

export type AreaCivicReportStatus = "story_seed" | "local_review" | "report_candidate";

export type AreaCivicReportReadinessV0 = {
  schemaVersion: "area_civic_report_readiness/v0";
  status: AreaCivicReportStatus;
  publicStoryReady: RecordSafetyGate;
  municipalReportReady: RecordSafetyGate;
  surfaceLine: string;
  stewardLine: string;
  nextActions: string[];
  exportFormats: Array<"markdown" | "json" | "csv">;
};

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function gate(reasons: string[], blockers: string[]): RecordSafetyGate {
  const dedupedBlockers = unique(blockers);
  return {
    ready: dedupedBlockers.length === 0,
    reasons: unique(reasons),
    blockers: dedupedBlockers,
  };
}

function monitoringGateReasons(readiness: MonitoringReadiness | null | undefined): string[] {
  if (!readiness) return [];
  return [
    ...readiness.reviewReady.reasons.map((reason) => `review_${reason}`),
    ...readiness.reportReady.reasons.map((reason) => `report_${reason}`),
    ...readiness.exportReady.reasons.map((reason) => `export_${reason}`),
  ];
}

function monitoringGateBlockers(readiness: MonitoringReadiness | null | undefined): string[] {
  if (!readiness) return ["missing_monitoring_readiness"];
  return [
    ...readiness.reviewReady.blockers.map((reason) => `review_${reason}`),
    ...readiness.reportReady.blockers.map((reason) => `report_${reason}`),
    ...readiness.exportReady.blockers.map((reason) => `export_${reason}`),
  ];
}

export function buildMunicipalReadinessV0(input: {
  monitoringReadiness?: MonitoringReadiness | null;
  safetyProfile: RecordSafetyProfileV0;
}): MunicipalReadinessV0 {
  const monitoring = input.monitoringReadiness;
  const safety = input.safetyProfile;

  const publicStoryReady = gate(
    [
      ...safety.publicSummaryGate.reasons,
      ...(monitoring?.reviewReady.ready ? ["review_package_ready"] : []),
    ],
    [
      ...safety.publicSummaryGate.blockers,
      ...(monitoring?.reviewReady.blockers.map((reason) => `review_${reason}`) ?? ["missing_monitoring_readiness"]),
    ],
  );

  const reviewQueueReady = gate(
    [
      ...monitoringGateReasons(monitoring),
      ...safety.auditEvents,
    ],
    [
      ...(monitoring ? [] : ["missing_monitoring_readiness"]),
      ...(safety.sensitiveSubjectRisk !== "none" || safety.mediaPublicPolicy === "held_for_face_privacy_review"
        ? []
        : ["no_local_review_trigger"]),
    ],
  );

  const municipalReady = gate(
    [
      ...safety.municipalUseGate.reasons,
      ...monitoringGateReasons(monitoring),
      "export_format_markdown",
      "export_format_json",
      "export_format_csv",
    ],
    [
      ...safety.municipalUseGate.blockers,
      ...monitoringGateBlockers(monitoring),
    ],
  );

  const recommendedLane = municipalReady.ready
    ? "municipal_report_candidate"
    : publicStoryReady.ready
      ? "public_story"
      : reviewQueueReady.ready
        ? "local_review"
        : "private_memory";

  return {
    schemaVersion: "municipal_readiness/v0",
    municipalReady,
    publicStoryReady,
    reviewQueueReady,
    recommendedLane,
    exportFormats: ["markdown", "json", "csv"],
  };
}

export function buildAreaCivicReportReadinessV0(input: {
  totalObservations: number;
  totalVisits: number;
  uniqueTaxa: number;
  seasonsCovered: number;
  observerCount: number;
  areaWatchScore: number;
  maskedSpecies: number;
  hasRepresentativePhoto: boolean;
  galleryCount: number;
}): AreaCivicReportReadinessV0 {
  const totalObservations = Math.max(0, Math.floor(input.totalObservations || 0));
  const totalVisits = Math.max(0, Math.floor(input.totalVisits || 0));
  const uniqueTaxa = Math.max(0, Math.floor(input.uniqueTaxa || 0));
  const seasonsCovered = Math.max(0, Math.min(4, Math.floor(input.seasonsCovered || 0)));
  const observerCount = Math.max(0, Math.floor(input.observerCount || 0));
  const areaWatchScore = Math.max(0, Math.min(100, Math.round(input.areaWatchScore || 0)));
  const maskedSpecies = Math.max(0, Math.floor(input.maskedSpecies || 0));
  const galleryCount = Math.max(0, Math.floor(input.galleryCount || 0));

  const publicBlockers = [
    ...(totalObservations > 0 ? [] : ["missing_public_records"]),
    ...(input.hasRepresentativePhoto || galleryCount > 0 ? [] : ["missing_public_visual_clue"]),
  ];
  const municipalBlockers = [
    ...(totalObservations >= 8 ? [] : ["needs_more_public_records"]),
    ...(totalVisits >= 3 ? [] : ["needs_more_visits"]),
    ...(uniqueTaxa >= 3 ? [] : ["needs_more_subject_variety"]),
    ...(seasonsCovered >= 2 ? [] : ["needs_more_season_coverage"]),
    ...(observerCount >= 2 ? [] : ["needs_more_observer_diversity"]),
    ...(areaWatchScore >= 45 ? [] : ["needs_more_repeatable_context"]),
    ...(maskedSpecies > 0 ? ["sensitive_masking_review_required"] : []),
  ];

  const publicStoryReady = gate(
    [
      totalObservations > 0 ? "has_public_records" : "",
      input.hasRepresentativePhoto ? "has_representative_photo" : "",
      galleryCount > 0 ? "has_area_gallery" : "",
    ],
    publicBlockers,
  );
  const municipalReportReady = gate(
    [
      `public_records:${totalObservations}`,
      `visits:${totalVisits}`,
      `unique_taxa:${uniqueTaxa}`,
      `seasons:${seasonsCovered}`,
      `observers:${observerCount}`,
      `area_watch_score:${areaWatchScore}`,
      "export_format_markdown",
      "export_format_json",
      "export_format_csv",
    ],
    municipalBlockers,
  );

  const status: AreaCivicReportStatus = municipalReportReady.ready
    ? "report_candidate"
    : publicStoryReady.ready
      ? (maskedSpecies > 0 ? "local_review" : "story_seed")
      : "story_seed";

  const nextActions = municipalReportReady.ready
    ? ["地域資料として共有する前に、代表写真と公開範囲を確認する"]
    : [
        ...(totalObservations < 8 ? ["公開できる記録をもう少し集める"] : []),
        ...(seasonsCovered < 2 ? ["別の季節にも同じ場所を歩く"] : []),
        ...(observerCount < 2 ? ["複数人の視点を足す"] : []),
        ...(areaWatchScore < 45 ? ["写真だけでなく、見た範囲や時間の手がかりを足す"] : []),
        ...(maskedSpecies > 0 ? ["希少種や位置ぼかしの扱いを確認する"] : []),
      ].slice(0, 3);

  return {
    schemaVersion: "area_civic_report_readiness/v0",
    status,
    publicStoryReady,
    municipalReportReady,
    surfaceLine: municipalReportReady.ready
      ? "地域の散策資料に使える材料がそろっています。"
      : publicStoryReady.ready
        ? "地域図鑑や散策メモの材料になり始めています。"
        : "最初の公開記録が入ると、地域の手がかりとして残せます。",
    stewardLine: municipalReportReady.ready
      ? "Markdown / JSON / CSVで年度報告や散策マップ素材へ渡せる候補です。"
      : "自治体・主催者向けに使うには、季節、人数、公開範囲、確認状況をもう少し増やします。",
    nextActions,
    exportFormats: ["markdown", "json", "csv"],
  };
}
