import assert from "node:assert/strict";
import test from "node:test";
import {
  RECORD_1780552463658_REGRESSION,
  SYNTHETIC_NEAR_DUPLICATE_FIXTURE,
} from "./observationMediaDedup.fixtures.js";
import { buildObservationMediaDedupPlan } from "./observationMediaDedup.js";

test("record-1780552463658 keeps three public compositions and excludes three exact duplicates", () => {
  const plan = buildObservationMediaDedupPlan(RECORD_1780552463658_REGRESSION.media);
  assert.equal(plan.sourceCount, RECORD_1780552463658_REGRESSION.expected.sourceMediaCount);
  assert.equal(plan.representatives.length, RECORD_1780552463658_REGRESSION.expected.uniqueDisplayMediaCount);
  assert.equal(plan.excluded.length, 3);
  assert.equal(plan.clusters.filter((cluster) => cluster.kind === "exact").length, 3);
  assert.deepEqual(
    plan.representatives.map((item) => item.mediaId),
    RECORD_1780552463658_REGRESSION.expected.representativeMediaIds,
  );
});

test("near duplicate guard clusters compression, resize, and rotation variants only", () => {
  const plan = buildObservationMediaDedupPlan(SYNTHETIC_NEAR_DUPLICATE_FIXTURE);
  const firstCluster = plan.clusters.find((cluster) => cluster.memberMediaIds.includes("compressed-source"));
  assert.equal(firstCluster?.kind, "near_duplicate");
  assert.deepEqual(firstCluster?.memberMediaIds, [
    "compressed-source",
    "compressed-copy",
    "rotated-copy",
  ]);
  assert.equal(plan.excluded.some((item) => item.mediaId === "same-bird-different-moment"), false);
  assert.equal(plan.excluded.some((item) => item.mediaId === "same-bird-closeup"), false);
});

test("representative selection follows resolution, sharpness, target size, quality, then crop safety", () => {
  const plan = buildObservationMediaDedupPlan([
    {
      mediaId: "lower-quality",
      displayOrder: 0,
      contentSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      widthPx: 1200,
      heightPx: 900,
      sharpnessScore: 0.9,
      targetRegionRatio: 0.7,
      compressionQuality: 0.9,
      cropSafetyScore: 0.9,
    },
    {
      mediaId: "higher-resolution",
      displayOrder: 1,
      contentSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      widthPx: 1800,
      heightPx: 1200,
      sharpnessScore: 0.7,
      targetRegionRatio: 0.5,
      compressionQuality: 0.8,
      cropSafetyScore: 0.8,
    },
  ]);
  assert.equal(plan.representatives[0]?.mediaId, "higher-resolution");
  assert.equal(plan.clusters[0]?.representativeReason, "higher_resolution");
});
