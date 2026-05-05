import assert from "node:assert/strict";
import test from "node:test";
import { normalizeObservationDataRights } from "./observationDataRights.js";

test("data rights defaults keep external export disabled", () => {
  const rights = normalizeObservationDataRights({
    visitId: "visit-1",
    occurrenceId: "occ-1",
  });

  assert.equal(rights.recordConsent, "private");
  assert.equal(rights.externalExportAllowed, false);
  assert.equal(rights.datasetLicense, null);
});

test("data rights only allow export when consent, licenses, and active status align", () => {
  const rights = normalizeObservationDataRights({
    visitId: "visit-1",
    occurrenceId: "occ-1",
    recordConsent: "external_export",
    researchUseConsent: "public_export",
    datasetLicense: "CC-BY-4.0",
    mediaLicense: "CC-BY-4.0",
    externalExportAllowed: true,
    withdrawalStatus: "active",
  });

  assert.equal(rights.externalExportAllowed, true);

  const withdrawn = normalizeObservationDataRights({
    ...rights,
    withdrawalStatus: "withdrawn",
  });
  assert.equal(withdrawn.externalExportAllowed, false);
});
