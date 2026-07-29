import assert from "node:assert/strict";
import test from "node:test";
import { buildRegionalSourceRegistryEntries } from "./regionalSourceRegistryV2.js";
import { planRegionalSourceFoundationImport } from "./zukanFoundationV2SourceRegistryImport.js";

test("Source Registry v2 binds to the canonical Foundation import planner", () => {
  const entries = buildRegionalSourceRegistryEntries();
  const first = planRegionalSourceFoundationImport({ tenantId: "zukan-regional-source-binding-test" });
  const second = planRegionalSourceFoundationImport({ tenantId: "zukan-regional-source-binding-test" });

  assert.deepEqual(first.blockers, []);
  assert.equal(first.counts.sourceAssets, entries.length);
  assert.equal(first.batch.sourceWorks.length, entries.length);
  assert.equal(first.batch.sourceEditions.length, entries.length);
  assert.equal(first.payloadSha256, second.payloadSha256);

  const sourceAssetId = "source:miyakoda:wakuwaku-map:2025";
  const registryEntry = entries.find((entry) => entry.source.sourceAssetId === sourceAssetId);
  assert.ok(registryEntry);
  assert.equal(registryEntry.currentEdition?.acquisitionState, "NOT_ACQUIRED");
  assert.equal(registryEntry.currentEdition?.checksumSha256, null);

  const work = first.batch.sourceWorks.find((candidate) => {
    const metadata = JSON.parse(candidate.metadataJson) as {
      sourceRegistry?: { externalSourceAssetId?: string };
    };
    return metadata.sourceRegistry?.externalSourceAssetId === sourceAssetId;
  });
  assert.ok(work);

  const edition = first.batch.sourceEditions.find((candidate) => candidate.sourceWorkId === work.sourceWorkId);
  assert.ok(edition);
  const editionMetadata = JSON.parse(edition.metadataJson) as {
    sourceRegistry?: {
      externalSourceAssetId?: string;
      bytesAcquired?: boolean;
      checksumSha256?: string | null;
    };
  };
  assert.equal(editionMetadata.sourceRegistry?.externalSourceAssetId, sourceAssetId);
  assert.equal(editionMetadata.sourceRegistry?.bytesAcquired, false);
  assert.equal(editionMetadata.sourceRegistry?.checksumSha256, null);
  assert.equal(first.batch.contentObjects.length, 0);
});
