import assert from "node:assert/strict";
import test from "node:test";
import {
  REGIONAL_SOURCE_ASSETS,
  type RegionalPublisher,
  type RegionalSourceAsset,
} from "./regionalSourceRegistry.js";
import {
  buildRegionalSourceRegistryEntries,
  buildRegionalSourceRegistrySummaryV2,
  filterRegionalSourceRegistryEntries,
  type RegionalSourceEdition,
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

test("custom source input derives its own edition set", () => {
  const publisher: RegionalPublisher = {
    publisherId: "publisher:test",
    name: "Test Publisher",
    kind: "citizen-group",
    officialUrl: "https://example.test/",
  };
  const source: RegionalSourceAsset = {
    sourceAssetId: "source:test:field-guide",
    title: "Test Field Guide",
    publisherIds: [publisher.publisherId],
    geographicScopes: ["place:test"],
    canonicalUrl: "https://example.test/guide",
    format: "html",
    rightsClass: "FACTS_ONLY",
    state: "PUBLISHED",
    issuedAt: "2026-01-01",
    updatedAt: null,
    retrievedAt: "2026-01-02",
    language: "ja",
    licenseLabel: null,
    notes: "fixture",
  };

  const [entry] = buildRegionalSourceRegistryEntries([source], [publisher]);
  assert.ok(entry);
  assert.equal(entry.source.sourceAssetId, source.sourceAssetId);
  assert.equal(entry.editions.length, 1);
  assert.equal(entry.currentEdition?.sourceEditionId, "edition:test:field-guide:2026-01-01");
});

test("explicit lifecycle selects one active edition and rejects multiple active editions", () => {
  const publisher: RegionalPublisher = {
    publisherId: "publisher:test",
    name: "Test Publisher",
    kind: "citizen-group",
    officialUrl: "https://example.test/",
  };
  const source: RegionalSourceAsset = {
    sourceAssetId: "source:test:field-guide",
    title: "Test Field Guide",
    publisherIds: [publisher.publisherId],
    geographicScopes: ["place:test"],
    canonicalUrl: "https://example.test/guide",
    format: "html",
    rightsClass: "FACTS_ONLY",
    state: "PUBLISHED",
    issuedAt: "2026-01-01",
    updatedAt: null,
    retrievedAt: "2026-01-02",
    language: "ja",
    licenseLabel: null,
    notes: "fixture",
  };
  const superseded: RegionalSourceEdition = {
    sourceEditionId: "edition:test:field-guide:2025",
    sourceAssetId: source.sourceAssetId,
    editionLabel: "2025",
    canonicalUrl: source.canonicalUrl,
    issuedAt: "2025-01-01",
    updatedAt: null,
    retrievedAt: "2025-01-02",
    language: "ja",
    checksumSha256: null,
    acquisitionState: "METADATA_ONLY",
    lifecycle: "SUPERSEDED",
    previousEditionId: null,
    nextEditionId: "edition:test:field-guide:2026",
  };
  const active: RegionalSourceEdition = {
    ...superseded,
    sourceEditionId: "edition:test:field-guide:2026",
    editionLabel: "2026",
    issuedAt: "2026-01-01",
    retrievedAt: "2026-01-02",
    lifecycle: "ACTIVE",
    previousEditionId: superseded.sourceEditionId,
    nextEditionId: null,
  };

  const [entry] = buildRegionalSourceRegistryEntries([source], [publisher], [superseded, active]);
  assert.ok(entry);
  assert.equal(entry.currentEdition?.sourceEditionId, active.sourceEditionId);
  assert.equal(entry.editions.length, 2);

  assert.throws(
    () => buildRegionalSourceRegistryEntries([source], [publisher], [active, { ...active, sourceEditionId: "edition:test:field-guide:2026b" }]),
    /multiple_active_regional_source_editions/,
  );
});

test("invalid updatedAfter fails closed", () => {
  assert.throws(
    () => filterRegionalSourceRegistryEntries({ updatedAfter: "not-a-date" }),
    /invalid_updated_after/,
  );
});
