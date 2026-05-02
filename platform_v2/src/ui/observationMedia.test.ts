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
      mediaRole: "primary_subject",
      suggestedMediaRole: "primary_subject",
      suggestedMediaRoleConfidence: 0.92,
      suggestedMediaRoleSource: "ai_region",
      suggestedMediaRoleReason: "fixture",
    },
  ],
  videoAssets: [],
} as unknown as ObservationDetailSnapshot;

test("observation media renders boxes only for displayable regions", () => {
  assert.equal(displayableRegionsForAsset(subject, "asset-vertical").length, 1);

  const { mediaBlock } = renderObservationMedia(snapshot, subject);
  assert.match(mediaBlock, /data-obs-image-frame/);
  assert.match(mediaBlock, /width="320" height="640"/);
  assert.match(mediaBlock, />主役<\/span>/);
  assert.match(mediaBlock, /AI 主役 92%/);
  assert.match(mediaBlock, /visible-region-fixture/);
  assert.doesNotMatch(mediaBlock, /low-confidence-hidden-fixture/);
  assert.match(mediaBlock, new RegExp(OBSERVATION_REGION_SUMMARY_TEXT));
});

test("observation media uses v2 thumbnails for legacy upload photos", () => {
  const legacyUploadSnapshot = {
    ...snapshot,
    photoAssets: [
      {
        assetId: "asset-legacy-upload",
        url: "/uploads/photos/visit-1/photo_0.webp",
        widthPx: 1200,
        heightPx: 900,
        roleTag: null,
        roleTagSource: null,
        organTarget: null,
        mediaRole: "context",
        suggestedMediaRole: "context",
        suggestedMediaRoleConfidence: null,
        suggestedMediaRoleSource: "heuristic",
        suggestedMediaRoleReason: "fixture",
      },
      {
        assetId: "asset-legacy-upload-2",
        url: "/uploads/photos/visit-1/photo_1.jpg",
        widthPx: 1200,
        heightPx: 900,
        roleTag: null,
        roleTagSource: null,
        organTarget: null,
        mediaRole: "secondary_candidate",
        suggestedMediaRole: "secondary_candidate",
        suggestedMediaRoleConfidence: 0.68,
        suggestedMediaRoleSource: "ai_candidate",
        suggestedMediaRoleReason: "fixture",
      },
    ],
  } as unknown as ObservationDetailSnapshot;

  const { mediaBlock } = renderObservationMedia(legacyUploadSnapshot, subject);

  assert.match(mediaBlock, /src="\/thumb\/lg\/photos\/visit-1\/photo_0\.webp"/);
  assert.match(mediaBlock, /data-obs-thumb-src="\/thumb\/lg\/photos\/visit-1\/photo_1\.jpg"/);
  assert.match(mediaBlock, /src="\/thumb\/sm\/photos\/visit-1\/photo_1\.jpg"/);
  assert.match(mediaBlock, />周囲<\/span>/);
  assert.match(mediaBlock, />別対象候補<\/span>/);
  assert.doesNotMatch(mediaBlock, /src="\/uploads\/photos\/visit-1\/photo_0\.webp"/);
});

test("observation media renders video media role badges", () => {
  const videoSnapshot = {
    ...snapshot,
    photoAssets: [],
    videoAssets: [
      {
        assetId: "video-asset",
        iframeUrl: "https://iframe.videodelivery.net/video-asset",
        thumbnailUrl: "https://videodelivery.net/video-asset/thumbnails/thumbnail.jpg",
        watchUrl: "https://watch.cloudflarestream.com/video-asset",
        readyToStream: true,
        uploadStatus: "ready",
        createdAt: "2026-04-26T00:00:00.000Z",
        mediaRole: "sound_motion",
        suggestedMediaRole: "sound_motion",
        suggestedMediaRoleConfidence: null,
        suggestedMediaRoleSource: "heuristic",
        suggestedMediaRoleReason: "fixture",
      },
    ],
  } as unknown as ObservationDetailSnapshot;

  const { mediaBlock } = renderObservationMedia(videoSnapshot, subject);

  assert.match(mediaBlock, /<strong>動画<\/strong>/);
  assert.match(mediaBlock, />音・動き<\/span>/);
  assert.match(mediaBlock, /提案 音・動き/);
});

test("observation media explains when video is still processing", () => {
  const videoSnapshot = {
    ...snapshot,
    photoAssets: [],
    videoAssets: [
      {
        assetId: "video-asset",
        providerUid: "video-asset",
        iframeUrl: "https://iframe.videodelivery.net/video-asset",
        thumbnailUrl: "https://videodelivery.net/video-asset/thumbnails/thumbnail.jpg",
        watchUrl: "https://watch.cloudflarestream.com/video-asset",
        readyToStream: false,
        uploadStatus: "inprogress",
        createdAt: "2026-04-26T00:00:00.000Z",
        mediaRole: "sound_motion",
        suggestedMediaRole: "sound_motion",
        suggestedMediaRoleConfidence: null,
        suggestedMediaRoleSource: "heuristic",
        suggestedMediaRoleReason: "fixture",
      },
    ],
  } as unknown as ObservationDetailSnapshot;

  const { mediaBlock } = renderObservationMedia(videoSnapshot, subject);

  assert.match(mediaBlock, /動画を処理しています/);
  assert.match(mediaBlock, /記録は保存済みです/);
});
