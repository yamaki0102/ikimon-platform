import assert from "node:assert/strict";
import test from "node:test";
import { REGIONAL_SOURCE_ASSETS } from "./regionalSourceRegistry.js";
import {
  buildRegionalSourceRegistryEntries,
  buildRegionalSourceRegistrySummaryV2,
  filterRegionalSourceRegistryEntries,
} from "./regionalSourceRegistryV2.js";

test("regional source v2 preserves every current main source and creates one explicit edition", () => {
  const entries = buildRegionalSourceRegistryEntries();
  assert.equal(entries.length, REGIONAL_SOURCE_ASSETS.length);
  assert.ok(entries.some((entry) => entry.source.sourceAssetId === "source:inabe:green-map:2026"));
  for (const entry of entries) {
    assert.equal(entry.editions.length, 1);
    assert.ok(entry.currentEdition);
    assert.equal(entry.currentEdition?.sourceAssetId, entry.source.sourceAssetId);
    assert.equal(entry.currentEdition?.checksumSha256, null);
  }
});

test("Miyakoda map remains fail closed until acquisition and rights review", () => {
  const entry = buildRegionalSourceRegistryEntries().find(
    (candidate) => candidate.source.sourceAssetId === "source:miyakoda:wakuwaku-map:2025",
  );
  assert.ok(entry);
  assert.equal(entry.source.rightsClass, "INDEX_ONLY");
  assert.equal(entry.source.state, "DISCOVERED");
  assert.equal(entry.currentEdition?.sourceEditionId, "edition:miyakoda:wakuwaku-map:2025");
  assert.equal(entry.currentEdition?.acquisitionState, "NOT_ACQUIRED");
  assert.equal(entry.currentEdition?.lifecycle, "ACTIVE");
  assert.equal(entry.currentEdition?.checksumSha256, null);
});

test("registry filters combine without promoting source state", () => {
  const entries = filterRegionalSourceRegistryEntries({
    publisherKind: "municipality",
    format: "rdf",
    rightsClass: "ATTRIBUTION_REUSE",
    acquisitionState: "METADATA_ONLY",
    updatedAfter: "2024-01-01",
  });
  assert.deepEqual(
    entries.map((entry) => entry.source.sourceAssetId).sort(),
    [
      "source:iwata:cultural-properties-linkdata",
      "source:iwata:tourism-facilities-linkdata",
    ],
  );
  assert.ok(entries.every((entry) => entry.source.state === "PUBLISHED"));
  assert.ok(entries.every((entry) => entry.currentEdition?.acquisitionState === "METADATA_ONLY"));
});

test("registry v2 summary counts sources and editions independently", () => {
  const entries = buildRegionalSourceRegistryEntries();
  const summary = buildRegionalSourceRegistrySummaryV2(entries);
  assert.equal(summary.sourceCount, entries.length);
  assert.equal(summary.editionCount, entries.flatMap((entry) => entry.editions).length);
  assert.equal(summary.municipalSourceCount + summary.nonMunicipalSourceCount, summary.sourceCount);
  assert.equal(summary.byAcquisitionState.NOT_ACQUIRED, 1);
});

test("invalid updatedAfter fails closed", () => {
  assert.throws(
    () => filterRegionalSourceRegistryEntries({ updatedAfter: "not-a-date" }),
    /invalid_updated_after/,
  );
});
