import assert from "node:assert/strict";
import test from "node:test";
import {
  buildResearchExportQaReport,
  toDarwinCoreCsvV0,
  type ResearchExportRecord,
} from "./researchExport.js";

function record(overrides: Partial<ResearchExportRecord> = {}): ResearchExportRecord {
  return {
    occurrenceID: "occ-1",
    eventID: "visit-1",
    scientificName: "Taraxacum officinale",
    vernacularName: "セイヨウタンポポ",
    taxonRank: "species",
    eventDate: "2026-05-06T00:00:00.000Z",
    decimalLatitude: 35.1,
    decimalLongitude: 139.1,
    locality: "Tokyo",
    municipality: "Tokyo",
    recordedBy: "Observer",
    associatedMedia: "https://example.invalid/photo.jpg",
    basisOfRecord: "HumanObservation",
    datasetName: "ikimon Field Loop",
    license: "CC-BY-4.0",
    readiness: { exportReady: true },
    dataGeneralizations: { location: "municipality" },
    informationWithheld: ["precise_coordinates"],
    licenseStatus: {
      datasetLicense: "CC-BY-4.0",
      mediaLicense: "CC-BY-4.0",
      externalExportAllowed: true,
      withdrawalStatus: "active",
    },
    ...overrides,
  };
}

test("Darwin Core CSV v0 only emits export-ready records", () => {
  const csv = toDarwinCoreCsvV0([
    record(),
    record({ occurrenceID: "blocked", readiness: { exportReady: false } }),
  ]);

  assert.match(csv, /^occurrenceID,eventID,basisOfRecord/);
  assert.match(csv, /occ-1/);
  assert.doesNotMatch(csv, /blocked/);
  assert.match(csv, /セイヨウタンポポ/);
});

test("QA report keeps exportReady blockers visible", () => {
  const report = buildResearchExportQaReport([
    record(),
    record({
      occurrenceID: "blocked",
      readiness: { exportReady: false },
      license: "not_export_ready",
      dataGeneralizations: { location: "not_set" },
      licenseStatus: {
        datasetLicense: null,
        mediaLicense: null,
        externalExportAllowed: false,
        withdrawalStatus: "missing",
      },
    }),
  ], "2026-05-06T00:00:00.000Z");

  assert.equal(report.exportReadyRecords, 1);
  assert.equal(report.blockedRecords, 1);
  assert.equal(report.blockerCounts.missing_dataset_license, 1);
  assert.equal(report.blockerCounts.external_export_not_allowed, 1);
  assert.equal(report.records.find((item) => item.occurrenceID === "blocked")?.exportReady, false);
});

test("QA report blocks AI-only and method-incomplete export candidates", () => {
  const report = buildResearchExportQaReport([
    record({
      occurrenceID: "ai-only",
      readiness: {
        exportReady: false,
        verificationState: "ai_suggested",
        methodReady: false,
        effortDenominatorReady: false,
      },
    }),
  ], "2026-05-14T00:00:00.000Z");

  const blockers = report.records[0]?.blockers ?? [];
  assert.match(blockers.join(","), /ai_candidate_requires_human_review/);
  assert.match(blockers.join(","), /missing_method_contract/);
  assert.match(blockers.join(","), /missing_effort_denominator/);
});
