import assert from "node:assert/strict";
import test from "node:test";
import type { ObservationDetailSnapshot } from "../services/readModels.js";
import type { ObservationVisitSubject } from "../services/observationVisitBundle.js";
import {
  OBSERVATION_REGION_SUMMARY_TEXT,
  displayableRegionsForAsset,
  renderObservationMedia,
} from "./observationMedia.js";

const subject = {
  occurrenceId: "occ:media-regression:0",
  regions: [
    {
      regionId: "visible",
      occurrenceId: "occ:media-regression:0",
      candidateId: null,
      assetId: "asset-vertical",
      rect: { x: 0.35, y: 0.28, width: 0.3, height: 0.53 },
      frameTimeMs: null,
      confidenceScore: 0.92,
      sourceKind: "fixture",
      sourceModel: "fixture",
      note: "visible-region-fixture",
    },
    {
      regionId: "hidden",
      occurrenceId: "occ:media-regression:0",
      candidateId: null,
      assetId: "asset-vertical",
      rect: { x: 0.05, y: 0.05, width: 0.2, height: 0.2 },
      frameTimeMs: null,
      confidenceScore: 0.49,
      sourceKind: "fixture",
      sourceModel: "fixture",
      note: "low-confidence-hidden-fixture",
    },
  ],
} as ObservationVisitSubject;

const snapshot = {
  displayName: "縦長fixture",
  photoAssets: [
    {
      assetId: "asset-vertical",
      url: "/assets/regression/vertical-region-fixture.svg",
      widthPx: 320,
      heightPx: 640,
      roleTag: null,
      roleTagSource: null,
      organTarget: null,
    },
  ],
  videoAssets: [],
} as unknown as ObservationDetailSnapshot;

test("observation media renders boxes only for displayable regions", () => {
  assert.equal(displayableRegionsForAsset(subject, "asset-vertical").length, 1);

  const { mediaBlock } = renderObservationMedia(snapshot, subject);
  assert.match(mediaBlock, /data-obs-image-frame/);
  assert.match(mediaBlock, /width="320" height="640"/);
  assert.match(mediaBlock, /visible-region-fixture/);
  assert.doesNotMatch(mediaBlock, /low-confidence-hidden-fixture/);
  assert.match(mediaBlock, new RegExp(OBSERVATION_REGION_SUMMARY_TEXT));
});
