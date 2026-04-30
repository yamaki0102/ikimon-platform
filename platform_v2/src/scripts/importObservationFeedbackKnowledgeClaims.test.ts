import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  normalizeFeedbackClaimSeed,
  type ObservationFeedbackClaimSeed,
} from "./importObservationFeedbackKnowledgeClaims.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.resolve(here, "../../db/seeds/observation_feedback_claims.seed.json");

async function loadSeed(): Promise<ObservationFeedbackClaimSeed[]> {
  const data = JSON.parse(await readFile(seedPath, "utf8")) as unknown;
  assert.ok(Array.isArray(data), "seed must be an array");
  return data as ObservationFeedbackClaimSeed[];
}

test("observation feedback seed defaults to review-pending and Hot-path disabled", async () => {
  const records = await loadSeed();
  assert.ok(records.length >= 5);

  for (const record of records) {
    const normalized = normalizeFeedbackClaimSeed(record);
    assert.equal(normalized.human_review_status, "pending");
    assert.equal(normalized.use_in_feedback, false);
    assert.ok(normalized.claim_text.length > 0 && normalized.claim_text.length <= 260);
    assert.ok(normalized.citation_span.length <= 320);
    assert.ok(normalized.target_outputs.length > 0);
  }
});

test("observation feedback seed can preserve ready flags only with explicit allowReady", () => {
  const normalized = normalizeFeedbackClaimSeed(
    {
      claim_type: "missing_evidence",
      claim_text: "決め手形質が写っていない場合は、次回の撮影課題を返す。",
      citation_span: "contract test",
      human_review_status: "ready",
      use_in_feedback: true,
    },
    { allowReady: true },
  );

  assert.equal(normalized.human_review_status, "ready");
  assert.equal(normalized.use_in_feedback, true);
});

test("observation feedback seed rejects overlong copied spans", () => {
  assert.throws(
    () => normalizeFeedbackClaimSeed({
      claim_type: "missing_evidence",
      claim_text: "短い claim",
      citation_span: "x".repeat(321),
    }),
    /citation_span_length:321/,
  );
});
