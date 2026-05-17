import assert from "node:assert/strict";
import test from "node:test";
import type { ObservationDetailSnapshot } from "../services/readModels.js";
import type { ObservationVisitSubject } from "../services/observationVisitBundle.js";
import {
  OBSERVATION_MEDIA_STYLES,
  OBSERVATION_REGION_SUMMARY_TEXT,
  displayableRegionsForAsset,
  renderObservationMedia,
  type ObservationMediaAnnotationTarget,
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

  const { mediaBlock, galleryScript } = renderObservationMedia(snapshot, subject);
  assert.match(mediaBlock, /data-obs-image-frame/);
  assert.match(mediaBlock, /width="320" height="640"/);
  assert.doesNotMatch(mediaBlock, />主対象<\/span>/);
  assert.doesNotMatch(mediaBlock, /AI 主対象 92%/);
  assert.doesNotMatch(mediaBlock, /AI 主対象/);
  assert.doesNotMatch(galleryScript, /主役/);
  assert.doesNotMatch(galleryScript, /confidenceLabel/);
  assert.match(galleryScript, /suggestedRole !== actualRole/);
  assert.match(mediaBlock, /visible-region-fixture/);
  assert.doesNotMatch(mediaBlock, /low-confidence-hidden-fixture/);
  assert.doesNotMatch(mediaBlock, new RegExp(OBSERVATION_REGION_SUMMARY_TEXT));
});

test("observation media keeps annotation data out of the photo surface", () => {
  const annotationTargets: ObservationMediaAnnotationTarget[] = [
    {
      key: "subject:occ:media-regression:0",
      occurrenceId: "occ:media-regression:0",
      candidateId: null,
      displayName: "縦長fixture",
      roleLabel: "主役っぽい",
      trustLabel: "AI推定",
      proposalKind: "none",
      adoptEndpoint: null,
      regions: subject.regions,
    },
  ];
  const { mediaBlock, galleryScript } = renderObservationMedia(snapshot, subject, annotationTargets);

  assert.doesNotMatch(mediaBlock, /data-annotation-target="subject:occ:media-regression:0"/);
  assert.doesNotMatch(mediaBlock, /data-annotation-subject-id="occ:media-regression:0"/);
  assert.doesNotMatch(mediaBlock, /枠をタップすると対象を切り替えられます/);
  assert.match(galleryScript, /closest\('\[data-annotation-target\]'\)/);
});

test("observation media keeps thumb annotation templates outside thumb buttons", () => {
  const multiPhotoSnapshot = {
    ...snapshot,
    photoAssets: [
      snapshot.photoAssets[0]!,
      {
        ...snapshot.photoAssets[0]!,
        assetId: "asset-second",
        url: "/assets/regression/second-region-fixture.svg",
      },
    ],
  } as unknown as ObservationDetailSnapshot;
  const { mediaBlock, galleryScript } = renderObservationMedia(multiPhotoSnapshot, subject, [
    {
      key: "subject:occ:media-regression:0",
      occurrenceId: "occ:media-regression:0",
      candidateId: null,
      displayName: "縦長fixture",
      roleLabel: "主役っぽい",
      trustLabel: "AI推定",
      proposalKind: "none",
      adoptEndpoint: null,
      regions: subject.regions,
    },
  ]);

  assert.match(mediaBlock, /<template data-obs-thumb-annotations="asset-vertical">/);
  assert.doesNotMatch(mediaBlock, /<span hidden data-obs-thumb-annotations=/);
  for (const match of mediaBlock.matchAll(/<button type="button" class="obs-hero-thumb[\s\S]*?<\/button>/g)) {
    assert.doesNotMatch(match[0], /data-obs-thumb-annotations/);
    assert.doesNotMatch(match[0], /class="obs-annotation-target/);
  }
  assert.match(galleryScript, /templateFor\('data-obs-thumb-annotations'/);
});

test("observation media avoids strong blue fills on large current regions", () => {
  const fullFrameSubject = {
    ...subject,
    regions: [
      {
        ...subject.regions[0]!,
        rect: { x: 0, y: 0, width: 1, height: 1 },
        note: "画像全体に広がる群落",
      },
    ],
  } as ObservationVisitSubject;

  const { mediaBlock } = renderObservationMedia(snapshot, fullFrameSubject, [
    {
      key: "subject:occ:media-regression:0",
      occurrenceId: "occ:media-regression:0",
      candidateId: null,
      displayName: "縦長fixture",
      roleLabel: "主役っぽい",
      trustLabel: "AI推定",
      proposalKind: "none",
      adoptEndpoint: null,
      regions: fullFrameSubject.regions,
    },
  ]);

  assert.match(mediaBlock, /class="obs-region-box is-large-region"/);
  assert.doesNotMatch(mediaBlock, /class="obs-annotation-target is-current is-large-region"/);
  assert.doesNotMatch(OBSERVATION_MEDIA_STYLES, /rgba\(37,99,235,\.13\)/);
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
  assert.match(mediaBlock, /data-obs-full-src="\/uploads\/photos\/visit-1\/photo_0\.webp"/);
  assert.match(mediaBlock, /data-obs-thumb-src="\/thumb\/lg\/photos\/visit-1\/photo_1\.jpg"/);
  assert.match(mediaBlock, /data-obs-thumb-full-src="\/uploads\/photos\/visit-1\/photo_1\.jpg"/);
  assert.match(mediaBlock, /src="\/thumb\/sm\/photos\/visit-1\/photo_1\.jpg"/);
  assert.doesNotMatch(mediaBlock, />周囲<\/span>/);
  assert.doesNotMatch(mediaBlock, />別対象候補<\/span>/);
  assert.doesNotMatch(mediaBlock, /提案 周囲/);
  assert.doesNotMatch(mediaBlock, /AI 別対象候補/);
  assert.doesNotMatch(mediaBlock, /<img src="\/uploads\/photos\/visit-1\/photo_0\.webp"/);
});

test("observation lightbox opens the full uploaded image instead of the lg thumbnail", () => {
  const legacyUploadSnapshot = {
    ...snapshot,
    photoAssets: [
      {
        assetId: "asset-upload",
        url: "/uploads/v2-observations/visit-1/photo.jpg",
        widthPx: 2560,
        heightPx: 1920,
        roleTag: null,
        roleTagSource: null,
        organTarget: null,
        mediaRole: "primary_subject",
        suggestedMediaRole: null,
        suggestedMediaRoleConfidence: null,
        suggestedMediaRoleSource: null,
        suggestedMediaRoleReason: null,
      },
    ],
  } as unknown as ObservationDetailSnapshot;

  const { mediaBlock, galleryScript } = renderObservationMedia(legacyUploadSnapshot, subject);

  assert.match(mediaBlock, /src="\/thumb\/lg\/v2-observations\/visit-1\/photo\.jpg"/);
  assert.match(mediaBlock, /data-obs-full-src="\/uploads\/v2-observations\/visit-1\/photo\.jpg"/);
  assert.match(galleryScript, /getAttribute\('data-obs-full-src'\) \|\| previewImg\.src/);
});

test("observation media renders video media role badges", () => {
  const videoSnapshot = {
    ...snapshot,
    photoAssets: [],
    visualEvidence: [
      {
        mediaKind: "video_frame",
        assetId: "video-asset",
        frameTimeMs: 1300,
        selectionScore: 0.55,
      },
    ],
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
  assert.match(mediaBlock, /aria-label="1\.3秒 55%を拡大表示"/);
  assert.doesNotMatch(mediaBlock, /提案 音・動き/);
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

test("observation media renders privacy-safe audio evidence", () => {
  const audioSnapshot = {
    ...snapshot,
    photoAssets: [],
    videoAssets: [],
    audioAssets: [
      {
        assetId: "audio-asset",
        segmentId: "segment-1",
        playbackUrl: "/api/v1/fieldscan/audio/segment/segment-1",
        capturedAt: "2026-05-11T10:00:00.000Z",
        durationSec: 2.4,
        transcriptionStatus: "pending",
        privacyStatus: "clean",
        mediaRole: "sound_motion",
      },
    ],
  } as unknown as ObservationDetailSnapshot;

  const { mediaBlock } = renderObservationMedia(audioSnapshot, subject);

  assert.match(mediaBlock, /音声証拠/);
  assert.match(mediaBlock, /privacy-safe な録音だけ/);
  assert.match(mediaBlock, /<audio controls preload="none" src="\/api\/v1\/fieldscan\/audio\/segment\/segment-1"/);
  assert.doesNotMatch(mediaBlock, /写真も動画もまだありません/);
});
