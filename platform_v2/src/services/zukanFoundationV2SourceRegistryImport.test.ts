import assert from "node:assert/strict";
import test from "node:test";
import {
  REGIONAL_PUBLISHERS,
  REGIONAL_SOURCE_ASSETS,
} from "./regionalSourceRegistry.js";
import {
  planRegionalSourceFoundationImport,
} from "./zukanFoundationV2SourceRegistryImport.js";

test("Source Registry dry-run is bounded, lossless, and stable across two runs", () => {
  const first = planRegionalSourceFoundationImport({ tenantId: "tenant-regional-source" });
  assert.equal(first.mode, "dry_run");
  assert.equal(first.counts.sourceAssets, REGIONAL_SOURCE_ASSETS.length);
  assert.equal(first.counts.entities, 54);
  assert.equal(first.counts.wouldInsert, 54);
  assert.equal(first.counts.conflicts, 0);
  assert.deepEqual(first.blockers, []);
  assert.deepEqual(first.batch.contentFixityEvents, []);
  assert.deepEqual(first.batch.contentObjects, []);
  assert.ok(first.unmapped.every((item) =>
    item.includes("rights_evaluation_not_materialized")
    || item.includes("content_object_requires_bytes_and_checksum")));
  assert.ok(first.batch.subjects.every((item) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(item.subjectId)));
  assert.ok(first.batch.publicIdentifiers.every((item) =>
    item.identifierUri.startsWith("https://zukan.earth/id/source-registry/")));

  const second = planRegionalSourceFoundationImport({
    tenantId: "tenant-regional-source",
    existing: {
      subjects: first.batch.subjects,
      sourceWorks: first.batch.sourceWorks,
      sourceEditions: first.batch.sourceEditions,
      contentFixityEvents: first.batch.contentFixityEvents,
      contentObjects: first.batch.contentObjects,
      publicIdentifiers: first.batch.publicIdentifiers,
    },
  });
  assert.equal(second.payloadSha256, first.payloadSha256);
  assert.equal(second.counts.wouldInsert, 0);
  assert.equal(second.counts.unchanged, 54);
  assert.equal(second.counts.conflicts, 0);

  const reordered = planRegionalSourceFoundationImport({
    tenantId: "tenant-regional-source",
    publishers: [...REGIONAL_PUBLISHERS].reverse(),
    sourceAssets: [...REGIONAL_SOURCE_ASSETS].reverse(),
  });
  assert.equal(reordered.payloadSha256, first.payloadSha256);
  assert.deepEqual(reordered.batch, first.batch);
});

test("Source Registry dry-run rejects multi-publisher and conflicting projections", () => {
  const source = REGIONAL_SOURCE_ASSETS[0];
  assert.ok(source);
  const multiPublisher = planRegionalSourceFoundationImport({
    tenantId: "tenant-regional-source",
    sourceAssets: [{
      ...source,
      publisherIds: [
        REGIONAL_PUBLISHERS[0]?.publisherId ?? "",
        REGIONAL_PUBLISHERS[1]?.publisherId ?? "",
      ],
    }],
  });
  assert.match(multiPublisher.blockers.join("\n"), /lossy_multi_publisher_mapping/);
  assert.equal(multiPublisher.counts.entities, 0);

  const original = planRegionalSourceFoundationImport({
    tenantId: "tenant-regional-source",
    sourceAssets: [source],
  });
  const conflictingWork = original.batch.sourceWorks[0];
  assert.ok(conflictingWork);
  const conflict = planRegionalSourceFoundationImport({
    tenantId: "tenant-regional-source",
    sourceAssets: [source],
    existing: {
      subjects: original.batch.subjects,
      sourceWorks: [{ ...conflictingWork, title: `${conflictingWork.title} conflict` }],
      sourceEditions: original.batch.sourceEditions,
      contentFixityEvents: original.batch.contentFixityEvents,
      contentObjects: original.batch.contentObjects,
      publicIdentifiers: original.batch.publicIdentifiers,
    },
  });
  assert.equal(conflict.counts.conflicts, 1);
  assert.match(conflict.blockers.join("\n"), /existing_row_conflict:source_work/);
});

test("Source Registry dry-run requires explicit tenant isolation", () => {
  assert.throws(
    () => planRegionalSourceFoundationImport({ tenantId: " " }),
    /foundation_tenant_required/,
  );
  const left = planRegionalSourceFoundationImport({ tenantId: "tenant-left" });
  const right = planRegionalSourceFoundationImport({ tenantId: "tenant-right" });
  assert.notEqual(left.payloadSha256, right.payloadSha256);
  assert.notEqual(left.batch.sourceWorks[0]?.sourceWorkId, right.batch.sourceWorks[0]?.sourceWorkId);
  assert.notEqual(
    left.batch.publicIdentifiers[0]?.identifierUri,
    right.batch.publicIdentifiers[0]?.identifierUri,
  );
  assert.match(
    left.batch.publicIdentifiers[0]?.identifierUri ?? "",
    /^https:\/\/zukan\.earth\/id\/source-registry\/tenant\/[0-9a-f]{20}\//u,
  );
});
