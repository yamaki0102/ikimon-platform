import assert from "node:assert/strict";
import test from "node:test";
import { buildContributionReceipts } from "./contributionReceipts.js";
import type { ObservationUpsertInput, ObservationWriteResult } from "./observationWrite.js";

function baseInput(overrides: Partial<ObservationUpsertInput> = {}): ObservationUpsertInput {
  return {
    observationId: "visit-1",
    userId: "user-1",
    observedAt: "2026-05-19T10:00:00.000Z",
    latitude: 35.1,
    longitude: 137.1,
    municipality: "浜松市",
    prefecture: "静岡県",
    sourcePayload: {
      source: "test",
      quick_capture_state: "unknown",
    },
    ...overrides,
  };
}

function baseResult(overrides: Partial<ObservationWriteResult> = {}): ObservationWriteResult {
  return {
    visitId: "visit-1",
    occurrenceId: "occ:visit-1:0",
    occurrenceIds: ["occ:visit-1:0"],
    placeId: "place-1",
    impact: {
      placeName: "天竜川",
      visitCount: 1,
      previousObservedAt: null,
      focusLabel: null,
      captureState: "unknown",
    },
    compatibility: {
      attempted: false,
      succeeded: false,
    },
    ...overrides,
  };
}

test("contribution receipts are immediate, bounded, and safe to show after posting", () => {
  const receipts = buildContributionReceipts({
    input: baseInput(),
    result: baseResult(),
  });

  assert.equal(receipts.length, 3);
  assert.ok(receipts.every((receipt) => receipt.claimLevel === "immediate"));
  assert.ok(receipts.every((receipt) => receipt.nextAction.href.startsWith("/")));
  assert.deepEqual(
    receipts.map((receipt) => receipt.kind),
    ["record_body_saved", "place_comparison_seeded", "uncertainty_preserved"],
  );
  assert.doesNotMatch(JSON.stringify(receipts), /保全|研究成果|行政|確定|ポイント|ランキング/);
});

test("survey and absence observations receive follow-up receipts without overclaiming", () => {
  const receipts = buildContributionReceipts({
    input: baseInput({
      visitMode: "survey",
      targetTaxaScope: "トンボ",
      revisitReason: "同じ水辺を確認する",
      sourcePayload: {
        source: "test",
        survey_result: "no_detection_note",
      },
    }),
    result: baseResult({
      impact: {
        placeName: "天竜川",
        visitCount: 2,
        previousObservedAt: "2026-05-01T10:00:00.000Z",
        focusLabel: "トンボ",
        captureState: "no_detection_note",
      },
    }),
  });

  assert.deepEqual(
    receipts.map((receipt) => receipt.kind),
    ["record_body_saved", "revisit_seeded", "absence_context_saved"],
  );
  assert.match(receipts[1]!.body, /次回の観察と比べやすく/);
  assert.match(receipts[2]!.body, /見なかったこと/);
});
