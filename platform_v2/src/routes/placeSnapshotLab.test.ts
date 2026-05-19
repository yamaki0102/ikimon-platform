import assert from "node:assert/strict";
import test from "node:test";
import { __test__, renderPlaceSnapshotLabPage } from "./placeSnapshotLab.js";

test("place snapshot lab renders fixture cases and variant controls", () => {
  const snapshot = __test__.fixtureSnapshot("renri-empty");
  const html = renderPlaceSnapshotLabPage({
    snapshot,
    caseId: "renri-empty",
    source: "auto",
    variant: "story",
    sourceLabel: "fixture",
    currentPath: "/dev/place-snapshot-lab?case=renri-empty&variant=story",
  });

  assert.match(html, /Place Snapshot Lab/);
  assert.match(html, /Local UI Lab/);
  assert.match(html, /愛管株式会社 連理の木の下で/);
  assert.match(html, /case=renri-production-export&amp;variant=story&amp;source=auto/);
  assert.match(html, /case=renri-growing&amp;variant=story&amp;source=auto/);
  assert.match(html, /case=renri-empty&amp;variant=current&amp;source=auto/);
  assert.match(html, /case=renri-empty&amp;variant=story&amp;source=db/);
  assert.match(html, /この場所で記録する/);
});

test("place snapshot lab keeps the current renderer available", () => {
  const snapshot = __test__.fixtureSnapshot("park-photo");
  const html = renderPlaceSnapshotLabPage({
    snapshot,
    caseId: "park-photo",
    source: "fixture",
    variant: "current",
    sourceLabel: "fixture",
  });

  assert.match(html, /浜松城公園/);
  assert.match(html, /地域の生きものアルバム/);
  assert.doesNotMatch(html, /<section class="ps-lab-story-hero"/);
});

test("place snapshot lab includes the production Renri export fixture", () => {
  const snapshot = __test__.fixtureSnapshot("renri-production-export");

  assert.equal(snapshot.observationSummary.totalObservations, 24);
  assert.equal(snapshot.observationSummary.totalVisits, 6);
  assert.equal(snapshot.observationGallery.length, 4);
  assert.equal(snapshot.observationGallery[0]?.displayName, "コメツブツメクサ");
});
