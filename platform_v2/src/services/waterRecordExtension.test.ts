import assert from "node:assert/strict";
import test from "node:test";
import { normalizeWaterRecordExtension } from "./waterRecordExtension.js";

test("water record normalizes public waterbody label into a stable local id", () => {
  const first = normalizeWaterRecordExtension({
    visitId: "visit-1",
    occurrenceId: "occ-1",
    catchOutcome: "no_catch",
    publicWaterbodyLabel: " 市内の河川 ",
    captureMethod: "lure",
    participantCount: 1,
  });
  const second = normalizeWaterRecordExtension({
    visitId: "visit-2",
    occurrenceId: "occ-2",
    catchOutcome: "observed_only",
    publicWaterbodyLabel: "市内の河川",
  });

  assert.equal(first.waterbodyId, second.waterbodyId);
  assert.equal(first.catchOutcome, "no_catch");
  assert.equal(first.publicWaterbodyLabel, "市内の河川");
});

test("water record refuses missing catch outcome", () => {
  assert.throws(
    () => normalizeWaterRecordExtension({ visitId: "visit-1" }),
    /water_catch_outcome_required/,
  );
});
