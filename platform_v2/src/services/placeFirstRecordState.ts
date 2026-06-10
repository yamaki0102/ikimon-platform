import {
  deriveDetectionSemantic,
  detectionSemanticAllowsNoDetectionClaim,
  type DetectionSemantic,
} from "./absenceSemantics.js";

export type PlaceFirstRecordState =
  | "present_occurrence"
  | "unknown_subject"
  | "place_note_only"
  | "media_no_subject"
  | "insufficient_coverage"
  | "valid_non_detection"
  | "absence_candidate"
  | "reviewed_absence"
  | "fieldscan_session_summary";

export type PlaceFirstRecordStateInput = {
  subjectCount?: number | null;
  hasTaxonName?: boolean | null;
  hasMedia?: boolean | null;
  hasNote?: boolean | null;
  hasPlaceMemory?: boolean | null;
  isFieldScanSession?: boolean | null;
  occurrenceStatus?: string | null;
  visitMode?: string | null;
  completeChecklistFlag?: boolean | null;
  targetTaxaScope?: string | null;
  effortMinutes?: number | null;
  distanceMeters?: number | null;
  repeatedNonDetectionCount?: number | null;
  reviewedAbsence?: boolean | null;
};

export type PlaceFirstRecordDisplayPolicy = {
  state: PlaceFirstRecordState;
  detectionSemantic: DetectionSemantic;
  publicLabel: string;
  ownerLabel: string;
  monitoringLabel: string;
  publicSurface: "standard_card" | "place_note" | "thin_coverage" | "hidden_from_public_feed";
  ownerSurface: "record_card" | "place_note" | "non_detection";
  monitoringSurface: "presence" | "candidate" | "coverage_gap" | "non_detection" | "absence_candidate";
  exportLane: "occurrence" | "scene_visit" | "monitoring_non_detection" | "not_export_ready";
  blockers: string[];
};

function positiveNumber(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function count(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function classifyPlaceFirstRecordState(input: PlaceFirstRecordStateInput): PlaceFirstRecordDisplayPolicy {
  const detectionSemantic = deriveDetectionSemantic({
    occurrenceStatus: input.occurrenceStatus,
    completeChecklistFlag: input.completeChecklistFlag,
    targetTaxaScope: input.targetTaxaScope,
    effortMinutes: input.effortMinutes,
    distanceMeters: input.distanceMeters,
    repeatedNonDetectionCount: input.repeatedNonDetectionCount,
    explicitAbsenceReviewed: input.reviewedAbsence,
  });
  const blockers: string[] = [];
  const subjectCount = count(input.subjectCount);
  const hasSubject = subjectCount > 0;
  const hasTaxonName = input.hasTaxonName === true;
  const hasMedia = input.hasMedia === true;
  const hasNote = input.hasNote === true;
  const hasPlaceMemory = input.hasPlaceMemory === true;

  if (input.isFieldScanSession === true) {
    return {
      state: "fieldscan_session_summary",
      detectionSemantic,
      publicLabel: "場所のセッション",
      ownerLabel: "この場所のセッション記録",
      monitoringLabel: "fieldscan_session",
      publicSurface: "place_note",
      ownerSurface: "place_note",
      monitoringSurface: detectionSemanticAllowsNoDetectionClaim(detectionSemantic) ? "non_detection" : "coverage_gap",
      exportLane: "scene_visit",
      blockers,
    };
  }

  if (detectionSemantic === "absence") {
    return {
      state: "reviewed_absence",
      detectionSemantic,
      publicLabel: "この条件での未確認",
      ownerLabel: "レビュー済みの限定的な未確認",
      monitoringLabel: "reviewed_absence",
      publicSurface: "hidden_from_public_feed",
      ownerSurface: "non_detection",
      monitoringSurface: "absence_candidate",
      exportLane: "monitoring_non_detection",
      blockers,
    };
  }

  if (detectionSemantic === "absence_candidate") {
    return {
      state: "absence_candidate",
      detectionSemantic,
      publicLabel: "継続的に未確認",
      ownerLabel: "継続的に確認されていない条件",
      monitoringLabel: "absence_candidate",
      publicSurface: "hidden_from_public_feed",
      ownerSurface: "non_detection",
      monitoringSurface: "absence_candidate",
      exportLane: "monitoring_non_detection",
      blockers,
    };
  }

  if (detectionSemantic === "non_detection") {
    return {
      state: "valid_non_detection",
      detectionSemantic,
      publicLabel: "この条件では確認されず",
      ownerLabel: "対象と努力量つきの未確認",
      monitoringLabel: "scoped_non_detection",
      publicSurface: "hidden_from_public_feed",
      ownerSurface: "non_detection",
      monitoringSurface: "non_detection",
      exportLane: "monitoring_non_detection",
      blockers,
    };
  }

  if ((input.occurrenceStatus ?? "").toLowerCase() === "absent") {
    blockers.push("target_scope_effort_and_checklist_required");
    return {
      state: "insufficient_coverage",
      detectionSemantic,
      publicLabel: "記録がまだ薄い",
      ownerLabel: "判断には対象範囲と努力量が必要",
      monitoringLabel: "insufficient_coverage",
      publicSurface: "thin_coverage",
      ownerSurface: "place_note",
      monitoringSurface: "coverage_gap",
      exportLane: "not_export_ready",
      blockers,
    };
  }

  if (hasSubject && hasTaxonName) {
    return {
      state: "present_occurrence",
      detectionSemantic,
      publicLabel: "見つけた記録",
      ownerLabel: "見つけた記録",
      monitoringLabel: "present_occurrence",
      publicSurface: "standard_card",
      ownerSurface: "record_card",
      monitoringSurface: "presence",
      exportLane: "occurrence",
      blockers,
    };
  }

  if (hasSubject) {
    blockers.push("taxon_name_pending");
    return {
      state: "unknown_subject",
      detectionSemantic,
      publicLabel: "名前を確認中",
      ownerLabel: "名前をあとで確認する記録",
      monitoringLabel: "subject_pending_review",
      publicSurface: "standard_card",
      ownerSurface: "record_card",
      monitoringSurface: "candidate",
      exportLane: "not_export_ready",
      blockers,
    };
  }

  if (hasMedia) {
    blockers.push("subject_not_detected_or_not_selected");
    return {
      state: "media_no_subject",
      detectionSemantic,
      publicLabel: "場所の手がかり",
      ownerLabel: "写真・音・動画だけの場所記録",
      monitoringLabel: "scene_media_without_subject",
      publicSurface: "place_note",
      ownerSurface: "place_note",
      monitoringSurface: "coverage_gap",
      exportLane: "scene_visit",
      blockers,
    };
  }

  if (hasNote || hasPlaceMemory || positiveNumber(input.effortMinutes) || positiveNumber(input.distanceMeters)) {
    return {
      state: "place_note_only",
      detectionSemantic,
      publicLabel: "場所の手がかり",
      ownerLabel: "メモだけの場所記録",
      monitoringLabel: "place_note_only",
      publicSurface: "place_note",
      ownerSurface: "place_note",
      monitoringSurface: "coverage_gap",
      exportLane: "scene_visit",
      blockers,
    };
  }

  blockers.push("record_body_missing");
  return {
    state: "insufficient_coverage",
    detectionSemantic,
    publicLabel: "記録がまだ薄い",
    ownerLabel: "写真・音・メモのいずれかが必要",
    monitoringLabel: "insufficient_record_body",
    publicSurface: "thin_coverage",
    ownerSurface: "place_note",
    monitoringSurface: "coverage_gap",
    exportLane: "not_export_ready",
    blockers,
  };
}
