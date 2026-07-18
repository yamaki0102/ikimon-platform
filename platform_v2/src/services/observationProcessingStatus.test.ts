import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import {
  deriveObservationProcessingStatus,
  patchObservationProcessingStatusHtml,
  registerObservationProcessingStatusHtmlPatch,
  type ObservationProcessingFacts,
  type ObservationProcessingStatus,
} from "./observationProcessingStatus.js";

const baseFacts: ObservationProcessingFacts = {
  occurrenceId: "occ:record-1:0",
  visitId: "record-1",
  originalPhotoCount: 1,
  displayPhotoCount: 1,
  latestMediaJobStatus: "completed",
  latestMediaJobError: null,
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
  assert.match(status.message, /写真と記録は保存されています|写真は保存されています/);
  assert.doesNotMatch(status.message, /完了しました/);
});

test("processing status exposes a photo retry without losing the record", () => {
  const status = deriveObservationProcessingStatus({
    ...baseFacts,
    displayPhotoCount: 0,
    latestMediaJobStatus: "failed",
    latestMediaJobError: "image_processing_failed",
  });

  assert.equal(status.mediaState, "retry_required");
  assert.equal(status.aiState, "failed_retryable");
  assert.equal(status.action?.label, "写真を再送");
  assert.match(status.message, /記録本体は保存されています/);
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

test("detail status patch is owner-scoped and idempotent", async () => {
  const app = Fastify();
  const ownerStatus: ObservationProcessingStatus = deriveObservationProcessingStatus(baseFacts);
  registerObservationProcessingStatusHtmlPatch(app, {
    loadStatus: async (_id, cookie) => cookie?.includes("owner=1") ? ownerStatus : null,
  });
  app.get("/observations/:id", async (_request, reply) => reply.type("text/html").send(
    `<main><section class="obs-reading-panel"><h1>記録</h1></section></main>`,
  ));

  try {
    const owner = await app.inject({ method: "GET", url: "/observations/record-1", headers: { cookie: "owner=1" } });
    assert.equal(owner.statusCode, 200);
    assert.match(owner.body, /data-observation-processing-status/);
    assert.match(owner.body, /この記録の状態/);
    assert.match(owner.body, /写真/);
    assert.match(owner.body, /AI/);

    const publicView = await app.inject({ method: "GET", url: "/observations/record-1" });
    assert.equal(publicView.statusCode, 200);
    assert.doesNotMatch(publicView.body, /data-observation-processing-status/);
  } finally {
    await app.close();
  }
});

test("processing status HTML patch does not duplicate the panel", () => {
  const status = deriveObservationProcessingStatus(baseFacts);
  const html = `<main><section class="obs-reading-panel"><h1>記録</h1></section></main>`;
  const once = patchObservationProcessingStatusHtml(html, status);
  assert.equal(patchObservationProcessingStatusHtml(once, status), once);
});
