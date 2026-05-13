export type ResearchExportRecord = {
  occurrenceID: string;
  eventID: string;
  scientificName: string | null;
  vernacularName: string | null;
  taxonRank: string | null;
  eventDate: string;
  decimalLatitude: number | null;
  decimalLongitude: number | null;
  locality: string | null;
  municipality: string | null;
  recordedBy: string | null;
  associatedMedia: string | null;
  basisOfRecord: string;
  datasetName: string;
  license: string | null;
  readiness: {
    exportReady: boolean;
    [key: string]: unknown;
  };
  dataGeneralizations: { location: string };
  informationWithheld: unknown[];
  licenseStatus: {
    recordConsent?: string;
    researchUseConsent?: string;
    datasetLicense: string | null;
    mediaLicense: string | null;
    externalExportAllowed: boolean;
    withdrawalStatus: string;
    [key: string]: unknown;
  };
};

export const DARWIN_CORE_CSV_V0_COLUMNS = [
  "occurrenceID",
  "eventID",
  "basisOfRecord",
  "eventDate",
  "scientificName",
  "vernacularName",
  "taxonRank",
  "decimalLatitude",
  "decimalLongitude",
  "locality",
  "municipality",
  "recordedBy",
  "associatedMedia",
  "datasetName",
  "license",
  "dataGeneralizations",
  "informationWithheld",
] as const;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) || typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

export function exportReadinessBlockers(record: ResearchExportRecord): string[] {
  const blockers: string[] = [];
  const verificationState = typeof record.readiness.verificationState === "string" ? record.readiness.verificationState : null;
  if (!record.licenseStatus.externalExportAllowed) blockers.push("external_export_not_allowed");
  if (record.licenseStatus.withdrawalStatus !== "active") blockers.push("rights_withdrawn_or_missing");
  if (!record.licenseStatus.datasetLicense) blockers.push("missing_dataset_license");
  if (!record.licenseStatus.mediaLicense) blockers.push("missing_media_license");
  if (!record.scientificName && !record.vernacularName && !record.taxonRank) blockers.push("missing_taxon_for_export");
  if (!record.dataGeneralizations.location || record.dataGeneralizations.location === "not_set" || record.dataGeneralizations.location === "exact_private") {
    blockers.push("missing_location_generalization");
  }
  if (record.readiness.methodReady === false) blockers.push("missing_method_contract");
  if (record.readiness.effortDenominatorReady === false) blockers.push("missing_effort_denominator");
  if (verificationState === "ai_suggested") blockers.push("ai_candidate_requires_human_review");
  if (verificationState === "unverified" || verificationState === "needs_more_evidence") blockers.push("verification_required_for_export");
  if (verificationState === "sensitive_hidden") blockers.push("sensitive_record_requires_policy_review");
  if (verificationState === "rejected") blockers.push("rejected_record_not_exportable");
  if (!record.readiness.exportReady) blockers.push("record_not_export_ready");
  return [...new Set(blockers)];
}

export function toDarwinCoreCsvV0(records: ResearchExportRecord[]): string {
  const lines = [
    DARWIN_CORE_CSV_V0_COLUMNS.join(","),
    ...records.filter((record) => record.readiness.exportReady).map((record) => [
      record.occurrenceID,
      record.eventID,
      record.basisOfRecord,
      record.eventDate,
      record.scientificName,
      record.vernacularName,
      record.taxonRank,
      record.decimalLatitude,
      record.decimalLongitude,
      record.locality,
      record.municipality,
      record.recordedBy,
      record.associatedMedia,
      record.datasetName,
      record.license,
      record.dataGeneralizations,
      record.informationWithheld,
    ].map(csvCell).join(",")),
  ];
  return `${lines.join("\n")}\n`;
}

export function buildResearchExportQaReport(records: ResearchExportRecord[], generatedAt = new Date().toISOString()) {
  const blockerCounts: Record<string, number> = {};
  const licenseCounts: Record<string, number> = {};
  let exportReady = 0;
  for (const record of records) {
    if (record.readiness.exportReady) exportReady += 1;
    const license = record.licenseStatus.datasetLicense ?? "missing";
    licenseCounts[license] = (licenseCounts[license] ?? 0) + 1;
    for (const blocker of exportReadinessBlockers(record)) {
      blockerCounts[blocker] = (blockerCounts[blocker] ?? 0) + 1;
    }
  }
  return {
    schemaVersion: "research_export_qa_report/v0",
    exportFormat: "darwin_core_csv_v0",
    generatedAt,
    checkedRecords: records.length,
    exportReadyRecords: exportReady,
    blockedRecords: records.length - exportReady,
    blockerCounts,
    licenseCounts,
    records: records.map((record) => ({
      occurrenceID: record.occurrenceID,
      eventID: record.eventID,
      exportReady: record.readiness.exportReady,
      blockers: exportReadinessBlockers(record),
      licenseStatus: record.licenseStatus,
      dataGeneralizations: record.dataGeneralizations,
      informationWithheld: record.informationWithheld,
    })),
  };
}
