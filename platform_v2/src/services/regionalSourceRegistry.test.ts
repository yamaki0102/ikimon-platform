import assert from "node:assert/strict";
import test from "node:test";
import {
  REGIONAL_PUBLISHERS,
  REGIONAL_SOURCE_ASSETS,
  buildRegionalSourceRegistrySummary,
  findRegionalSourceAsset,
} from "./regionalSourceRegistry.js";

test("regional source registry keeps unique stable IDs and publisher references", () => {
  assert.equal(new Set(REGIONAL_PUBLISHERS.map((publisher) => publisher.publisherId)).size, REGIONAL_PUBLISHERS.length);
  assert.equal(new Set(REGIONAL_SOURCE_ASSETS.map((source) => source.sourceAssetId)).size, REGIONAL_SOURCE_ASSETS.length);

  const publisherIds = new Set(REGIONAL_PUBLISHERS.map((publisher) => publisher.publisherId));
  assert.ok(REGIONAL_SOURCE_ASSETS.every((source) => source.publisherIds.length > 0));
  assert.ok(REGIONAL_SOURCE_ASSETS.every((source) => source.publisherIds.every((publisherId) => publisherIds.has(publisherId))));
  assert.ok(REGIONAL_SOURCE_ASSETS.every((source) => source.canonicalUrl.startsWith("https://")));
});

test("registry includes municipal and non-municipal publishers in one schema", () => {
  const summary = buildRegionalSourceRegistrySummary();
  assert.ok(summary.municipalSourceCount > 0);
  assert.ok(summary.nonMunicipalSourceCount > 0);
  assert.equal(summary.sourceCount, summary.municipalSourceCount + summary.nonMunicipalSourceCount);
  assert.ok(REGIONAL_PUBLISHERS.some((publisher) => publisher.publisherId === "publisher:miyakoda"));
  assert.ok(REGIONAL_PUBLISHERS.some((publisher) => publisher.publisherId === "publisher:iwata-city"));
});

test("PDF map defaults to index-only until acquisition and republication rights are confirmed", () => {
  const source = findRegionalSourceAsset("source:miyakoda:wakuwaku-map:2025");
  assert.equal(source?.format, "pdf");
  assert.equal(source?.rightsClass, "INDEX_ONLY");
  assert.equal(source?.state, "DISCOVERED");
  assert.equal(source?.retrievedAt, null);
});

test("Inabe Green Map is registered as a rights-classified official PDF edition", () => {
  const source = findRegionalSourceAsset("source:inabe:green-map:2026");
  assert.equal(source?.format, "pdf");
  assert.equal(source?.rightsClass, "INDEX_ONLY");
  assert.equal(source?.state, "RIGHTS_CLASSIFIED");
  assert.equal(source?.issuedAt, "2026-03-01");
  assert.equal(source?.updatedAt, "2026-03-03");
  assert.deepEqual(source?.publisherIds, ["publisher:inabe-city"]);
  assert.deepEqual(source?.geographicScopes, ["place:jp-mie-inabe"]);
});

test("existing Iwata open-data sources remain published and attribution-aware", () => {
  const source = findRegionalSourceAsset("source:iwata:tourism-facilities-linkdata");
  assert.equal(source?.state, "PUBLISHED");
  assert.equal(source?.rightsClass, "ATTRIBUTION_REUSE");
  assert.match(source?.licenseLabel ?? "", /CC BY/);
});
