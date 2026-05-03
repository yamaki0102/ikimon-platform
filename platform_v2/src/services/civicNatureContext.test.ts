import assert from "node:assert/strict";
import test from "node:test";
import { civicContextLabel, deriveDefaultCivicContext, normalizeCivicObservationContext } from "./civicNatureContext.js";

test("normalizeCivicObservationContext clamps invalid values and protects sensitive risk precision", () => {
  const context = normalizeCivicObservationContext({
    visitId: "visit-1",
    contextKind: "nonsense" as any,
    activityIntent: "bad" as any,
    participantRole: "bad" as any,
    publicPrecision: "exact_private",
    riskLane: "rare_sensitive",
  });

  assert.equal(context.contextKind, "risk");
  assert.equal(context.activityIntent, null);
  assert.equal(context.participantRole, null);
  assert.equal(context.publicPrecision, "hidden");
});

test("deriveDefaultCivicContext treats event writes as event participant records", () => {
  const context = deriveDefaultCivicContext({
    visitId: "visit-2",
    occurrenceId: "occ:visit-2:0",
    eventCode: "ABC123",
  });

  assert.equal(context.contextKind, "event");
  assert.equal(context.activityIntent, "share");
  assert.equal(context.participantRole, "participant");
  assert.equal(civicContextLabel(context), "観察会の記録");
});

test("civicContextLabel keeps explicit activity labels first", () => {
  const context = normalizeCivicObservationContext({
    visitId: "visit-3",
    contextKind: "satoyama",
    activityLabel: "南区画の草刈り後",
  });

  assert.equal(civicContextLabel(context), "南区画の草刈り後");
});
