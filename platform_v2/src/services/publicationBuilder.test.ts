import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildPublicationEdition,
  computePublicationOutputChecksum,
  serializePublicationEditionManifest,
  type PublicationBuilderInput,
} from "./publicationBuilder.js";

function inputFixture(): PublicationBuilderInput {
  return {
    selectedPlaceEntityClaimIds: {
      placeIds: ["place-b", "place-a"],
      entityIds: ["entity-b", "entity-a"],
      claimIds: ["claim-b", "claim-a"],
    },
    sourceEditionIds: ["edition-b", "edition-a"],
    queryAndFilters: {
      query: "  浜松 公園  ",
      filters: {
        prefecture: "静岡県",
        tags: ["湿地", "観察"],
      },
    },
    editorialChangesAndExclusions: {
      changes: [
        { targetId: "claim-b", description: "  表記を統一  " },
        { targetId: "claim-a", description: "補足を追加" },
      ],
      exclusions: [
        { targetId: "claim-b", reason: "権利確認待ち" },
        { targetId: "claim-a", reason: "根拠不足" },
      ],
    },
    editorAndReviewer: {
      editorIds: ["editor-b", "editor-a"],
      reviewerIds: ["reviewer-b", "reviewer-a"],
    },
    finalizedTime: "2026-09-15T12:34:56+09:00",
    output: {
      title: "浜松の観察ガイド",
      sections: ["place", "claims"],
    },
    editionDiff: {
      added: ["claim-b", "claim-a"],
      removed: [],
      changed: ["place-b", "place-a"],
    },
  };
}

test("builds a deterministic review-ready publication edition manifest", () => {
  const result = buildPublicationEdition(inputFixture());

  assert.equal(result.status, "READY_FOR_REVIEW");
  assert.deepEqual(result.blockers, []);
  assert.equal(result.manifest.schema_version, "zukan.publication-builder/v1");
  assert.deepEqual(result.manifest.selected_place_entity_claim_ids, {
    place_ids: ["place-a", "place-b"],
    entity_ids: ["entity-a", "entity-b"],
    claim_ids: ["claim-a", "claim-b"],
  });
  assert.deepEqual(result.manifest.source_edition_ids, ["edition-a", "edition-b"]);
  assert.deepEqual(result.manifest.query_and_filters, {
    query: "浜松 公園",
    filters: {
      prefecture: "静岡県",
      tags: ["湿地", "観察"],
    },
  });
  assert.deepEqual(result.manifest.editorial_changes_and_exclusions, {
    changes: [
      { targetId: "claim-a", description: "補足を追加" },
      { targetId: "claim-b", description: "表記を統一" },
    ],
    exclusions: [
      { targetId: "claim-a", reason: "根拠不足" },
      { targetId: "claim-b", reason: "権利確認待ち" },
    ],
  });
  assert.deepEqual(result.manifest.editor_and_reviewer, {
    editor_ids: ["editor-a", "editor-b"],
    reviewer_ids: ["reviewer-a", "reviewer-b"],
  });
  assert.equal(result.manifest.finalized_time, "2026-09-15T03:34:56.000Z");
  assert.match(result.manifest.output_checksum, /^[0-9a-f]{64}$/u);
  assert.deepEqual(result.manifest.edition_diff, {
    added: ["claim-a", "claim-b"],
    removed: [],
    changed: ["place-a", "place-b"],
  });
  assert.equal(result.outputChecksum, result.manifest.output_checksum);
  assert.equal(result.serializedManifest, serializePublicationEditionManifest(result.manifest));
  assert.deepEqual(result.effects, {
    databaseReads: 0,
    databaseWrites: 0,
    networkCalls: 0,
    publicationEffects: 0,
    runtimeMutations: 0,
  });
  assert.equal(result.serializedManifest.includes('"output"'), false);
});

test("same semantic input produces the same manifest and checksum", () => {
  const first = buildPublicationEdition(inputFixture());
  const reordered = inputFixture();
  reordered.selectedPlaceEntityClaimIds = {
    placeIds: ["place-a", "place-b"],
    entityIds: ["entity-a", "entity-b"],
    claimIds: ["claim-a", "claim-b"],
  };
  reordered.sourceEditionIds = ["edition-a", "edition-b"];
  reordered.editorialChangesAndExclusions = {
    changes: [...reordered.editorialChangesAndExclusions.changes].reverse(),
    exclusions: [...reordered.editorialChangesAndExclusions.exclusions].reverse(),
  };
  reordered.editorAndReviewer = {
    editorIds: ["editor-a", "editor-b"],
    reviewerIds: ["reviewer-a", "reviewer-b"],
  };
  reordered.editionDiff = {
    added: ["claim-a", "claim-b"],
    removed: [],
    changed: ["place-a", "place-b"],
  };
  reordered.output = { sections: ["place", "claims"], title: "浜松の観察ガイド" };

  const second = buildPublicationEdition(reordered);
  assert.equal(first.status, "READY_FOR_REVIEW");
  assert.equal(second.status, "READY_FOR_REVIEW");
  assert.equal(second.serializedManifest, first.serializedManifest);
  assert.equal(second.outputChecksum, first.outputChecksum);
});

test("hashes text, bytes, and canonical JSON without external effects", () => {
  assert.equal(
    computePublicationOutputChecksum("zukan"),
    "5ead3eb2de68e50f1a8ba5b5c793a3892f2ad6ea50207f018cc89d1a8cacdba6",
    "checksum should be a SHA-256 digest",
  );
  assert.equal(
    computePublicationOutputChecksum({ b: 2, a: 1 }),
    computePublicationOutputChecksum({ a: 1, b: 2 }),
  );
  assert.equal(
    computePublicationOutputChecksum(new TextEncoder().encode("zukan")),
    computePublicationOutputChecksum("zukan"),
  );
});

test("blocks malformed or incomplete edition inputs and never emits a partial manifest", () => {
  const invalid = inputFixture() as unknown as Record<string, unknown>;
  invalid.selectedPlaceEntityClaimIds = {
    placeIds: ["place-a", " place-a "],
    entityIds: [],
    claimIds: [],
  };
  invalid.sourceEditionIds = [];
  invalid.queryAndFilters = { query: 42, filters: { ok: true } };
  invalid.editorialChangesAndExclusions = {
    changes: [{ targetId: "claim-a", description: "" }],
    exclusions: [],
  };
  invalid.editorAndReviewer = { editorIds: ["editor-a"], reviewerIds: [] };
  invalid.finalizedTime = "not-a-time";
  invalid.output = { invalid: undefined };

  const result = buildPublicationEdition(invalid as never);
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.manifest, null);
  assert.equal(result.serializedManifest, null);
  assert.equal(result.outputChecksum, null);
  assert.ok(result.blockers.includes("duplicate_selected_place_ids:place-a"));
  assert.ok(result.blockers.includes("source_edition_ids_required"));
  assert.ok(result.blockers.includes("query_invalid"));
  assert.ok(result.blockers.includes("changes_0_description_invalid"));
  assert.ok(result.blockers.includes("reviewer_ids_required"));
  assert.ok(result.blockers.includes("finalized_time_invalid"));
  assert.ok(result.blockers.includes("output_not_serializable"));
  assert.deepEqual(result.effects, {
    databaseReads: 0,
    databaseWrites: 0,
    networkCalls: 0,
    publicationEffects: 0,
    runtimeMutations: 0,
  });
});

test("rejects cyclic JSON output rather than throwing from the builder", () => {
  const cyclic = { title: "cycle" } as { title: string; self?: unknown };
  cyclic.self = cyclic;
  const input = inputFixture() as unknown as Record<string, unknown>;
  input.output = cyclic;

  const result = buildPublicationEdition(input as never);
  assert.equal(result.status, "BLOCKED");
  assert.deepEqual(result.blockers, ["output_not_serializable"]);
});
