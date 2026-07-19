import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveObservationProcessingStatus,
  type ObservationProcessingFacts,
} from "./observationProcessingStatus.js";

const baseFacts: ObservationProcessingFacts = {
  occurrenceId: "occ:record-1:0",
  visitId: "record-1",
  originalPhotoCount: 1,
  displayPhotoCount: 1,
  latestMediaJobStatus: "completed",
  latestMediaJobError: null,
  aiRequestStatus: null,
  aiAssessmentStatus: null,
  candidateCount: 0,
  identificationCount: 0,
  providerAvailable: true,
  updatedAt: "2026-07-18T09:00:00.000Z",
};

test("processing status distinguishes saved media and an AI candidate", () => {
  const status = deriveObservationProcessingStatus({
    ...baseFacts,
    aiAssessmentStatus: "ai_judgement",
    candidateCount: 2,
  });

  assert.equal(status.recordState, "saved");
  assert.equal(status.mediaState, "ready");
  assert.equal(status.originalPhotoCount, 1);
  assert.equal(status.displayPhotoCount, 1);
  assert.equal(status.aiState, "candidate_ready");
  assert.equal(status.action?.label, "候補を確認");
  assert.match(status.action?.href ?? "", /#identify$/);
});

test("processing status does not claim AI completion when the provider is unavailable", () => {
  const status = deriveObservationProcessingStatus({
    ...baseFacts,
    displayPhotoCount: 0,
    latestMediaJobStatus: "pending",
    providerAvailable: false,
  });

  assert.equal(status.mediaState, "processing");
  assert.equal(status.aiState, "unavailable");
  assert.match(status.message, /写真1枚は保存済み/);
  assert.doesNotMatch(status.message, /完了しました/);
});

test("media processing does not masquerade as AI processing", () => {
  const status = deriveObservationProcessingStatus({
    ...baseFacts,
    displayPhotoCount: 0,
    latestMediaJobStatus: "processing",
    aiRequestStatus: null,
    aiAssessmentStatus: null,
    providerAvailable: true,
  });

  assert.equal(status.mediaState, "processing");
  assert.equal(status.aiState, "not_requested");
});

test("processing status exposes a photo retry without losing the record", () => {
  const status = deriveObservationProcessingStatus({
    ...baseFacts,
    displayPhotoCount: 0,
    latestMediaJobStatus: "failed",
    latestMediaJobError: "image_processing_failed",
  });

  assert.equal(status.mediaState, "retry_required");
  assert.equal(status.aiState, "not_requested");
  assert.equal(status.action?.label, "写真を再送");
  assert.match(status.message, /写真1枚は保存済み/);
});

test("a partial derivative set reports the saved total instead of claiming all photos are ready", () => {
  const status = deriveObservationProcessingStatus({
    ...baseFacts,
    originalPhotoCount: 4,
    displayPhotoCount: 2,
    latestMediaJobStatus: "processing",
  });

  assert.equal(status.mediaState, "processing");
  assert.match(status.message, /写真4枚は保存済み/);
  assert.match(status.message, /残り2枚/);
});

test("processing status treats a record with no photo separately from a failed photo", () => {
  const status = deriveObservationProcessingStatus({
    ...baseFacts,
    originalPhotoCount: 0,
    displayPhotoCount: 0,
    latestMediaJobStatus: null,
  });

  assert.equal(status.mediaState, "none");
  assert.equal(status.action?.label, "写真を追加");
  assert.match(status.message, /写真はまだ追加されていません/);
});
