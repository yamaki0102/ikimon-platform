import { getPlaceSnapshot, type PlaceSnapshot } from "./placeSnapshot.js";

export type SiteEvidenceReportPeriod = {
  label: string;
  start: string;
  end: string;
};

export type SiteEvidenceReadinessBlocker =
  | "missing_human_evidence"
  | "missing_machine_evidence"
  | "missing_reviewer_verified_machine_evidence"
  | "missing_effort_metadata";

export type SiteEvidenceReport = {
  schemaVersion: "site_evidence_report/v0";
  generatedAt: string;
  reportUrl: string;
  printUrl: string;
  fieldSnapshotUrl: string;
  reportUse: "site_monitoring_supplementary_material";
  claimPolicy: {
    allowedUse: string[];
    prohibitedUse: string[];
  };
  field: {
    fieldId: string;
    name: string;
    locationLabel: string;
    areaHa: number | null;
    verificationLevel: string;
  };
  period: SiteEvidenceReportPeriod;
  evidenceLayers: {
    humanObservations: {
      observations: number;
      visits: number;
      uniqueTaxa: number;
      effortCompletionRate: number;
      reviewAcceptedRate: number;
    };
    machineObservations: {
      observations: number;
      aiCandidates: number;
      reviewerVerified: number;
      rejected: number;
      passiveAudio: number;
      effortMetadata: number;
      uniqueMachineTaxa: number;
      latestObservedAt: string | null;
      methods: Array<{ method: string; count: number }>;
      topTaxa: Array<{ name: string; count: number; reviewStatus: string }>;
      calibrationAudit: Array<{
        source: string;
        threshold: number;
        regionKey: string;
        taxonName: string;
        count: number;
      }>;
    };
    stewardship: {
      actionCount: number;
      summary: string;
    };
  };
  activityIndicators: {
    seasonsCovered: number;
    seasonCoverageCap: number;
    seasonLabels: string[];
    nativeCount: number;
    exoticCount: number;
    unknownOriginCount: number;
    absentRecords: number;
  };
  readiness: {
    hasHumanEvidence: boolean;
    hasMachineEvidence: boolean;
    hasReviewerVerifiedMachineEvidence: boolean;
    hasEffortMetadata: boolean;
    blockers: SiteEvidenceReadinessBlocker[];
    exportReadyMachineRecordsRequireReviewerVerification: true;
  };
  claimBoundary: PlaceSnapshot["claimBoundary"];
  nextActions: PlaceSnapshot["nextActions"];
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function monthPeriod(month: string | null | undefined, now: Date = new Date()): SiteEvidenceReportPeriod {
  const match = typeof month === "string" ? /^(\d{4})-(\d{2})$/.exec(month.trim()) : null;
  const year = match ? Number(match[1]) : now.getUTCFullYear();
  const monthIndex = match ? Number(match[2]) - 1 : now.getUTCMonth();
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0));
  return {
    label: `${start.getUTCFullYear()}-${pad2(start.getUTCMonth() + 1)}`,
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function reportUrlFields(fieldId: string, monthLabel: string): Pick<SiteEvidenceReport, "reportUrl" | "printUrl" | "fieldSnapshotUrl"> {
  const query = `field_id=${encodeURIComponent(fieldId)}&month=${encodeURIComponent(monthLabel)}`;
  return {
    reportUrl: `/admin/site-evidence?${query}`,
    printUrl: `/admin/site-evidence/print?${query}`,
    fieldSnapshotUrl: `/api/v1/fields/${encodeURIComponent(fieldId)}/place-snapshot`,
  };
}

function readinessBlockers(readiness: {
  hasHumanEvidence: boolean;
  hasMachineEvidence: boolean;
  hasReviewerVerifiedMachineEvidence: boolean;
  hasEffortMetadata: boolean;
}): SiteEvidenceReadinessBlocker[] {
  const blockers: SiteEvidenceReadinessBlocker[] = [];
  if (!readiness.hasHumanEvidence) blockers.push("missing_human_evidence");
  if (!readiness.hasMachineEvidence) blockers.push("missing_machine_evidence");
  if (!readiness.hasReviewerVerifiedMachineEvidence) blockers.push("missing_reviewer_verified_machine_evidence");
  if (!readiness.hasEffortMetadata) blockers.push("missing_effort_metadata");
  return blockers;
}

export function buildSiteEvidenceReport(snapshot: PlaceSnapshot, period: SiteEvidenceReportPeriod): SiteEvidenceReport {
  const human = snapshot.observationSummary;
  const machine = snapshot.machineObservationSummary;
  const readiness = {
    hasHumanEvidence: human.totalObservations > 0,
    hasMachineEvidence: machine.totalMachineObservations > 0,
    hasReviewerVerifiedMachineEvidence: machine.reviewerVerifiedCount > 0,
    hasEffortMetadata: human.effortCompletionRate > 0 || machine.effortMetadataCount > 0,
  };
  return {
    schemaVersion: "site_evidence_report/v0",
    generatedAt: snapshot.generatedAt,
    ...reportUrlFields(snapshot.field.fieldId, period.label),
    reportUse: "site_monitoring_supplementary_material",
    claimPolicy: {
      allowedUse: [
        "reviewed_record_summary",
        "activity_indicator",
        "monitoring_gap_check",
        "site_management_discussion_material",
      ],
      prohibitedUse: [
        "tnfd_compliance_proof",
        "nature_symbiosis_site_certification_proof",
        "biodiversity_improvement_proof",
        "automatic_species_confirmation_from_ai_candidates",
      ],
    },
    field: {
      fieldId: snapshot.field.fieldId,
      name: snapshot.field.name,
      locationLabel: snapshot.field.locationLabel,
      areaHa: snapshot.field.areaHa,
      verificationLevel: snapshot.field.verificationLevel,
    },
    period,
    evidenceLayers: {
      humanObservations: {
        observations: human.totalObservations,
        visits: human.totalVisits,
        uniqueTaxa: human.uniqueTaxa,
        effortCompletionRate: human.effortCompletionRate,
        reviewAcceptedRate: human.reviewAcceptedRate,
      },
      machineObservations: {
        observations: machine.totalMachineObservations,
        aiCandidates: machine.aiCandidateCount,
        reviewerVerified: machine.reviewerVerifiedCount,
        rejected: machine.rejectedCount,
        passiveAudio: machine.passiveAudioCount,
        effortMetadata: machine.effortMetadataCount,
        uniqueMachineTaxa: machine.uniqueMachineTaxa,
        latestObservedAt: machine.latestObservedAt,
        methods: machine.methodCounts,
        topTaxa: machine.topMachineTaxa,
        calibrationAudit: machine.calibrationDecisions,
      },
      stewardship: {
        actionCount: human.stewardshipActionCount,
        summary: snapshot.stewardshipImpact.summary,
      },
    },
    activityIndicators: {
      seasonsCovered: human.seasonsCovered,
      seasonCoverageCap: human.seasonCoverageCap,
      seasonLabels: human.seasonLabels,
      nativeCount: human.nativeCount,
      exoticCount: human.exoticCount,
      unknownOriginCount: human.unknownOriginCount,
      absentRecords: human.absentRecords,
    },
    readiness: {
      ...readiness,
      blockers: readinessBlockers(readiness),
      exportReadyMachineRecordsRequireReviewerVerification: true,
    },
    claimBoundary: snapshot.claimBoundary,
    nextActions: snapshot.nextActions,
  };
}

export async function getSiteEvidenceReport(
  fieldId: string,
  options: { month?: string | null; now?: Date } = {},
): Promise<SiteEvidenceReport | null> {
  const period = monthPeriod(options.month, options.now);
  const snapshot = await getPlaceSnapshot(fieldId, {
    observedFrom: period.start,
    observedTo: period.end,
  });
  return snapshot ? buildSiteEvidenceReport(snapshot, period) : null;
}
