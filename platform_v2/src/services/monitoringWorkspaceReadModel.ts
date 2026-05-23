import { pointInGeoJsonPolygon } from "./pointInPolygon.js";
import type { MonitoringRecordContractV0, MonitoringVerificationState } from "./monitoringRecordContract.js";

export type MonitoringWorkspaceReportPurpose =
  | "formal_report"
  | "identification_strengthening"
  | "area_strengthening";

export type MonitoringWorkspaceQueueKey =
  | "identification_waiting"
  | "evidence_insufficient"
  | "area_coverage_attention"
  | "location_privacy_review"
  | "export_request";

export type MonitoringDetectionStatus =
  | "confirmed"
  | "candidate"
  | "observed_not_confirmed"
  | "insufficient_coverage"
  | "not_evaluated";

export type MonitoringWorkspaceBbox = [number, number, number, number];

export type MonitoringWorkspaceArea = {
  areaId: string;
  label: string;
  bbox: MonitoringWorkspaceBbox;
  polygon?: unknown;
};

export type MonitoringWorkspaceTerm = {
  start: string;
  end: string;
};

export type MonitoringWorkspacePoint = {
  lat: number;
  lng: number;
  locationPrecision?: string | null;
  publicPrecision?: string | null;
};

export type MonitoringWorkspaceRecordInput = {
  recordId: string;
  observedAt: string;
  point: MonitoringWorkspacePoint | null;
  tags?: string[];
  fieldIds?: string[];
  contract: MonitoringRecordContractV0;
};

export type MonitoringWorkspaceInput = {
  workspaceId: string;
  label: string;
  area: MonitoringWorkspaceArea;
  term: MonitoringWorkspaceTerm;
  records: MonitoringWorkspaceRecordInput[];
  gridStepDegrees?: number;
  reportPurpose?: MonitoringWorkspaceReportPurpose;
  targetTags?: string[];
};

export type MonitoringWorkspaceRecordSummary = {
  recordId: string;
  observedAt: string;
  month: string;
  point: MonitoringWorkspacePoint;
  detectionStatus: MonitoringDetectionStatus;
  verificationState: MonitoringVerificationState;
  monitoringReady: boolean;
  exportReady: boolean;
  tags: string[];
  fieldIds: string[];
  queueKeys: MonitoringWorkspaceQueueKey[];
  readinessBlockers: string[];
};

export type MonitoringWorkspaceExcludedRecord = {
  recordId: string;
  reason: "missing_point" | "outside_area" | "outside_term" | "invalid_observed_at";
};

export type MonitoringWorkspaceGridCell = {
  cellId: string;
  bbox: MonitoringWorkspaceBbox;
  recordCount: number;
  confirmedCount: number;
  candidateCount: number;
  monitoringReadyCount: number;
  exportReadyCount: number;
  effortMinutes: number;
  months: string[];
  seasonCoverage: {
    spring: boolean;
    summer: boolean;
    autumn: boolean;
    winter: boolean;
  };
  detectionStatus: MonitoringDetectionStatus;
  actionCue: "promote_success" | "review_candidates" | "observe_next" | "strengthen_effort";
};

export type MonitoringWorkspaceQueueItem = {
  key: MonitoringWorkspaceQueueKey;
  label: string;
  targetType: "record" | "cell" | "report";
  targetId: string;
  priority: number;
  reasons: string[];
};

export type MonitoringWorkspaceReportChecklistItem = {
  key: string;
  ready: boolean;
  label: string;
  blockers: string[];
};

export type MonitoringWorkspaceReportReadiness = {
  purpose: MonitoringWorkspaceReportPurpose;
  ready: boolean;
  checklist: MonitoringWorkspaceReportChecklistItem[];
};

export type MonitoringWorkspaceReadModel = {
  schemaVersion: "monitoring_workspace_read_model/v0";
  workspace: {
    workspaceId: string;
    label: string;
    areaId: string;
    areaLabel: string;
    term: MonitoringWorkspaceTerm;
  };
  summary: {
    scopedRecordCount: number;
    excludedRecordCount: number;
    confirmedCount: number;
    candidateCount: number;
    monitoringReadyCount: number;
    exportReadyCount: number;
    meshCoverageRate: number;
    seasonCoverageRate: number;
    outputPreparationReady: boolean;
  };
  records: MonitoringWorkspaceRecordSummary[];
  excludedRecords: MonitoringWorkspaceExcludedRecord[];
  grid: MonitoringWorkspaceGridCell[];
  operationQueues: Record<MonitoringWorkspaceQueueKey, MonitoringWorkspaceQueueItem[]>;
  reportReadiness: MonitoringWorkspaceReportReadiness;
};

const QUEUE_LABELS: Record<MonitoringWorkspaceQueueKey, string> = {
  identification_waiting: "同定待ち",
  evidence_insufficient: "根拠不足",
  area_coverage_attention: "エリア空白/努力量不足",
  location_privacy_review: "粗化確認",
  export_request: "出力依頼",
};

const SEASON_MONTHS = {
  spring: new Set(["03", "04", "05"]),
  summer: new Set(["06", "07", "08"]),
  autumn: new Set(["09", "10", "11"]),
  winter: new Set(["12", "01", "02"]),
};

function monthKey(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 7);
}

function inTerm(observedAt: string, term: MonitoringWorkspaceTerm): boolean {
  const observed = Date.parse(observedAt);
  const start = Date.parse(term.start);
  const end = Date.parse(term.end);
  if (!Number.isFinite(observed) || !Number.isFinite(start) || !Number.isFinite(end)) return false;
  return observed >= start && observed <= end;
}

function inBbox(point: MonitoringWorkspacePoint, bbox: MonitoringWorkspaceBbox): boolean {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return point.lng >= minLng && point.lng <= maxLng && point.lat >= minLat && point.lat <= maxLat;
}

function inArea(point: MonitoringWorkspacePoint, area: MonitoringWorkspaceArea): boolean {
  if (!inBbox(point, area.bbox)) return false;
  if (area.polygon) return pointInGeoJsonPolygon(point.lng, point.lat, area.polygon);
  return true;
}

function clampGridStep(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 0.01;
  return Math.max(0.001, Math.min(0.25, step));
}

function chooseGridStep(bbox: MonitoringWorkspaceBbox, requested?: number): number {
  if (requested) return clampGridStep(requested);
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const width = Math.max(0.001, maxLng - minLng);
  const height = Math.max(0.001, maxLat - minLat);
  return clampGridStep(Math.sqrt((width * height) / 36));
}

function gridDimensions(bbox: MonitoringWorkspaceBbox, step: number): { cols: number; rows: number } {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const epsilon = 1e-12;
  return {
    cols: Math.max(1, Math.ceil(((maxLng - minLng) - epsilon) / step)),
    rows: Math.max(1, Math.ceil(((maxLat - minLat) - epsilon) / step)),
  };
}

function cellIdForPoint(point: MonitoringWorkspacePoint, bbox: MonitoringWorkspaceBbox, step: number): string {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const { cols, rows } = gridDimensions(bbox, step);
  const col = Math.min(cols - 1, Math.max(0, Math.floor((point.lng - minLng) / step)));
  const row = Math.min(rows - 1, Math.max(0, Math.floor((point.lat - minLat) / step)));
  return `${row}:${col}`;
}

function emptyGrid(area: MonitoringWorkspaceArea, step: number): Map<string, MonitoringWorkspaceGridCell> {
  const [minLng, minLat, maxLng, maxLat] = area.bbox;
  const { cols, rows } = gridDimensions(area.bbox, step);
  const cells = new Map<string, MonitoringWorkspaceGridCell>();
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cellMinLng = minLng + (col * step);
      const cellMinLat = minLat + (row * step);
      const cellMaxLng = Math.min(maxLng, cellMinLng + step);
      const cellMaxLat = Math.min(maxLat, cellMinLat + step);
      const cellId = `${row}:${col}`;
      cells.set(cellId, {
        cellId,
        bbox: [cellMinLng, cellMinLat, cellMaxLng, cellMaxLat],
        recordCount: 0,
        confirmedCount: 0,
        candidateCount: 0,
        monitoringReadyCount: 0,
        exportReadyCount: 0,
        effortMinutes: 0,
        months: [],
        seasonCoverage: { spring: false, summer: false, autumn: false, winter: false },
        detectionStatus: "insufficient_coverage",
        actionCue: "observe_next",
      });
    }
  }
  return cells;
}

function isConfirmed(state: MonitoringVerificationState): boolean {
  return state === "expert_verified" || state === "community_reviewed";
}

function isCandidate(state: MonitoringVerificationState): boolean {
  return state === "ai_suggested" || state === "unverified";
}

function detectionStatus(record: MonitoringWorkspaceRecordInput): MonitoringDetectionStatus {
  const state = record.contract.verificationState.state;
  if (isConfirmed(state)) return "confirmed";
  if (isCandidate(state)) return "candidate";
  if (state === "needs_more_evidence") return "observed_not_confirmed";
  if (state === "sensitive_hidden" || state === "rejected") return "not_evaluated";
  return "observed_not_confirmed";
}

function recordEffortMinutes(contract: MonitoringRecordContractV0): number {
  const seconds = contract.effortDenominator.durationSeconds;
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0
    ? seconds / 60
    : 0;
}

function readinessBlockers(contract: MonitoringRecordContractV0): string[] {
  return contract.aggregationExport.readinessBlockers ?? [];
}

function needsLocationPrivacyReview(contract: MonitoringRecordContractV0, point: MonitoringWorkspacePoint): boolean {
  const precision = point.publicPrecision ?? contract.recordCore.place.publicPrecision;
  const riskLane = contract.recordCore.place.riskLane;
  return precision === "hidden"
    || precision === "exact_private"
    || precision === "not_set"
    || riskLane !== "normal";
}

function queueKeysForRecord(record: MonitoringWorkspaceRecordInput): MonitoringWorkspaceQueueKey[] {
  const keys: MonitoringWorkspaceQueueKey[] = [];
  const state = record.contract.verificationState.state;
  const blockers = readinessBlockers(record.contract);
  if (state === "ai_suggested" || state === "unverified") keys.push("identification_waiting");
  if (state === "needs_more_evidence" || blockers.some((item) => item.includes("evidence"))) keys.push("evidence_insufficient");
  if (record.point && needsLocationPrivacyReview(record.contract, record.point)) keys.push("location_privacy_review");
  return keys;
}

function queueItem(
  key: MonitoringWorkspaceQueueKey,
  targetType: MonitoringWorkspaceQueueItem["targetType"],
  targetId: string,
  priority: number,
  reasons: string[],
): MonitoringWorkspaceQueueItem {
  return { key, label: QUEUE_LABELS[key], targetType, targetId, priority, reasons };
}

function seasonCoverage(months: string[]): MonitoringWorkspaceGridCell["seasonCoverage"] {
  const covered = new Set(months.map((month) => month.slice(5, 7)));
  return {
    spring: Array.from(SEASON_MONTHS.spring).some((month) => covered.has(month)),
    summer: Array.from(SEASON_MONTHS.summer).some((month) => covered.has(month)),
    autumn: Array.from(SEASON_MONTHS.autumn).some((month) => covered.has(month)),
    winter: Array.from(SEASON_MONTHS.winter).some((month) => covered.has(month)),
  };
}

function finalizeCell(cell: MonitoringWorkspaceGridCell): MonitoringWorkspaceGridCell {
  const months = Array.from(new Set(cell.months)).sort();
  const season = seasonCoverage(months);
  let detection: MonitoringDetectionStatus = "insufficient_coverage";
  if (cell.confirmedCount > 0) detection = "confirmed";
  else if (cell.candidateCount > 0) detection = "candidate";
  else if (cell.recordCount > 0) detection = "observed_not_confirmed";

  const coveredSeasonCount = Object.values(season).filter(Boolean).length;
  const actionCue = cell.recordCount === 0
    ? "observe_next"
    : cell.candidateCount > 0 && cell.confirmedCount === 0
      ? "review_candidates"
      : cell.effortMinutes < 15 || coveredSeasonCount <= 1
        ? "strengthen_effort"
        : "promote_success";

  return {
    ...cell,
    months,
    seasonCoverage: season,
    detectionStatus: detection,
    actionCue,
  };
}

function checklistItem(
  key: string,
  ready: boolean,
  label: string,
  blockers: string[] = [],
): MonitoringWorkspaceReportChecklistItem {
  return { key, ready, label, blockers };
}

function buildReportReadiness(
  purpose: MonitoringWorkspaceReportPurpose,
  records: MonitoringWorkspaceRecordSummary[],
  grid: MonitoringWorkspaceGridCell[],
): MonitoringWorkspaceReportReadiness {
  const exportReadyCount = records.filter((record) => record.exportReady).length;
  const candidateCount = records.filter((record) => record.detectionStatus === "candidate").length;
  const activeCellCount = grid.filter((cell) => cell.recordCount > 0).length;
  const seasonCells = grid.filter((cell) => Object.values(cell.seasonCoverage).some(Boolean)).length;
  const locationReviewCount = records.filter((record) => record.queueKeys.includes("location_privacy_review")).length;

  const checklist = purpose === "formal_report"
    ? [
        checklistItem("has_export_ready_records", exportReadyCount > 0, "正式出力に使える記録がある", exportReadyCount > 0 ? [] : ["export_ready_record_missing"]),
        checklistItem("location_control_checked", locationReviewCount === 0, "位置制御の確認が済んでいる", locationReviewCount === 0 ? [] : ["location_privacy_review_pending"]),
        checklistItem("audit_snapshot_required", true, "出力時に監査ログスナップショットを残す"),
      ]
    : purpose === "identification_strengthening"
      ? [
          checklistItem("has_candidates", candidateCount > 0, "同定強化に回す候補がある", candidateCount > 0 ? [] : ["candidate_record_missing"]),
          checklistItem("has_record_context", records.length > 0, "候補の場所・期間・根拠を確認できる", records.length > 0 ? [] : ["scoped_record_missing"]),
        ]
      : [
          checklistItem("has_grid", grid.length > 0, "メッシュ単位で見られる"),
          checklistItem("has_active_cells", activeCellCount > 0, "観察済みメッシュがある", activeCellCount > 0 ? [] : ["active_cell_missing"]),
          checklistItem("has_season_signal", seasonCells > 0, "月/季節カバーを見られる", seasonCells > 0 ? [] : ["season_signal_missing"]),
        ];

  return {
    purpose,
    ready: checklist.every((item) => item.ready),
    checklist,
  };
}

function roundRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Number((numerator / denominator).toFixed(3));
}

export function buildMonitoringWorkspaceReadModel(input: MonitoringWorkspaceInput): MonitoringWorkspaceReadModel {
  const gridStep = chooseGridStep(input.area.bbox, input.gridStepDegrees);
  const cells = emptyGrid(input.area, gridStep);
  const excludedRecords: MonitoringWorkspaceExcludedRecord[] = [];
  const operationQueues: Record<MonitoringWorkspaceQueueKey, MonitoringWorkspaceQueueItem[]> = {
    identification_waiting: [],
    evidence_insufficient: [],
    area_coverage_attention: [],
    location_privacy_review: [],
    export_request: [],
  };
  const records: MonitoringWorkspaceRecordSummary[] = [];

  for (const record of input.records) {
    const month = monthKey(record.observedAt);
    if (!month) {
      excludedRecords.push({ recordId: record.recordId, reason: "invalid_observed_at" });
      continue;
    }
    if (!inTerm(record.observedAt, input.term)) {
      excludedRecords.push({ recordId: record.recordId, reason: "outside_term" });
      continue;
    }
    if (!record.point) {
      excludedRecords.push({ recordId: record.recordId, reason: "missing_point" });
      continue;
    }
    if (!inArea(record.point, input.area)) {
      excludedRecords.push({ recordId: record.recordId, reason: "outside_area" });
      continue;
    }

    const status = detectionStatus(record);
    const queueKeys = queueKeysForRecord(record);
    const summary: MonitoringWorkspaceRecordSummary = {
      recordId: record.recordId,
      observedAt: record.observedAt,
      month,
      point: record.point,
      detectionStatus: status,
      verificationState: record.contract.verificationState.state,
      monitoringReady: record.contract.aggregationExport.readinessBlockers.length === 0
        || record.contract.verificationState.state !== "rejected",
      exportReady: record.contract.aggregationExport.exportReady,
      tags: record.tags ?? [],
      fieldIds: record.fieldIds ?? [],
      queueKeys,
      readinessBlockers: readinessBlockers(record.contract),
    };
    records.push(summary);

    const cellId = cellIdForPoint(record.point, input.area.bbox, gridStep);
    const cell = cells.get(cellId);
    if (cell) {
      cell.recordCount += 1;
      if (status === "confirmed") cell.confirmedCount += 1;
      if (status === "candidate") cell.candidateCount += 1;
      if (summary.monitoringReady) cell.monitoringReadyCount += 1;
      if (summary.exportReady) cell.exportReadyCount += 1;
      cell.effortMinutes += recordEffortMinutes(record.contract);
      cell.months.push(month);
    }

    for (const key of queueKeys) {
      operationQueues[key].push(queueItem(key, "record", record.recordId, key === "location_privacy_review" ? 90 : 70, summary.readinessBlockers));
    }
  }

  const grid = Array.from(cells.values()).map(finalizeCell);
  for (const cell of grid) {
    if (cell.recordCount === 0 || cell.actionCue === "strengthen_effort") {
      operationQueues.area_coverage_attention.push(queueItem(
        "area_coverage_attention",
        "cell",
        cell.cellId,
        cell.recordCount === 0 ? 80 : 55,
        cell.recordCount === 0 ? ["cell_has_no_records"] : ["cell_needs_more_effort_or_season_coverage"],
      ));
    }
  }

  const purpose = input.reportPurpose ?? "formal_report";
  const reportReadiness = buildReportReadiness(purpose, records, grid);
  if (reportReadiness.ready) {
    operationQueues.export_request.push(queueItem("export_request", "report", purpose, 60, ["report_checklist_ready"]));
  }

  const confirmedCount = records.filter((record) => record.detectionStatus === "confirmed").length;
  const candidateCount = records.filter((record) => record.detectionStatus === "candidate").length;
  const monitoringReadyCount = records.filter((record) => record.monitoringReady).length;
  const exportReadyCount = records.filter((record) => record.exportReady).length;
  const activeCells = grid.filter((cell) => cell.recordCount > 0).length;
  const seasonSignals = new Set(records.map((record) => record.month.slice(5, 7)));

  return {
    schemaVersion: "monitoring_workspace_read_model/v0",
    workspace: {
      workspaceId: input.workspaceId,
      label: input.label,
      areaId: input.area.areaId,
      areaLabel: input.area.label,
      term: input.term,
    },
    summary: {
      scopedRecordCount: records.length,
      excludedRecordCount: excludedRecords.length,
      confirmedCount,
      candidateCount,
      monitoringReadyCount,
      exportReadyCount,
      meshCoverageRate: roundRatio(activeCells, grid.length),
      seasonCoverageRate: roundRatio(seasonSignals.size, 12),
      outputPreparationReady: reportReadiness.ready,
    },
    records,
    excludedRecords,
    grid,
    operationQueues,
    reportReadiness,
  };
}
