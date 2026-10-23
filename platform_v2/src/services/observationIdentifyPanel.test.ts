import assert from "node:assert/strict";
import { test } from "node:test";
import { Pool } from "pg";
import {
  buildObservationIdentifyPanelSnapshot,
  getObservationIdentifyPanelDisputes,
} from "./observationIdentifyPanel.js";

test("identify panel projection retains each subject's own identification and AI review state", () => {
  const first = buildObservationIdentifyPanelSnapshot({
    occurrenceId: "occ-1",
    visitId: "visit-1",
    displayName: "アゲハ",
    scientificName: "Papilio xuthus",
    vernacularName: "アゲハ",
    aiAssessmentStatus: "ai_judgement",
    aiReviewAgreeCount: 2,
    aiReviewDisagreeCount: 1,
    identifications: [{
      proposedName: "アゲハ",
      proposedRank: "species",
      acceptedRank: null,
      notes: null,
      actorName: "A",
      createdAt: "2026-01-01",
      references: [],
    }],
  }, [{
    disputeId: "dispute-1",
    kind: "alternative_id",
    proposedName: "別候補",
    proposedRank: null,
    reason: null,
    status: "open",
    actorName: "A",
    createdAt: "2026-01-02",
  }]);
  const second = buildObservationIdentifyPanelSnapshot({
    occurrenceId: "occ-2",
    visitId: "visit-1",
    displayName: "シオカラトンボ",
    scientificName: "Orthetrum albistylum",
    vernacularName: "シオカラトンボ",
    aiAssessmentStatus: null,
    aiReviewAgreeCount: 0,
    aiReviewDisagreeCount: 0,
    identifications: [],
  }, []);

  assert.equal(first.occurrenceId, "occ-1");
  assert.equal(first.aiReviewAgreeCount, 2);
  assert.equal(first.identifications[0]?.proposedName, "アゲハ");
  assert.equal(first.disputes[0]?.proposedName, "別候補");
  assert.equal(second.occurrenceId, "occ-2");
  assert.equal(second.aiAssessmentStatus, null);
  assert.equal(second.aiReviewAgreeCount, 0);
  assert.deepEqual(second.identifications, []);
  assert.deepEqual(second.disputes, []);
  assert.equal("photoAssets" in first, false);
});

test("dispute lookup batches unique subject IDs and groups each subject's own rows", async (t) => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
  t.after(() => {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  });

  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  t.mock.method(Pool.prototype, "query", async function (query: unknown, values?: unknown[]) {
    calls.push({ sql: String(query), values: values as unknown[] | undefined });
    return {
      rows: [
        {
          occurrence_id: "occ-1",
          dispute_id: "d-1",
          kind: "alternative_id",
          proposed_name: "A候補",
          proposed_rank: "species",
          reason: "斑紋",
          status: "open",
          actor_name: "Reviewer A",
          created_at: "2026-01-01",
        },
        {
          occurrence_id: "occ-2",
          dispute_id: "d-2",
          kind: "needs_more_evidence",
          proposed_name: null,
          proposed_rank: null,
          reason: "写真が不鮮明",
          status: "resolved",
          actor_name: "Reviewer B",
          created_at: "2026-01-02",
        },
      ],
    };
  } as never);

  const grouped = await getObservationIdentifyPanelDisputes(["occ-1", "occ-2", "occ-1", ""]);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]?.values, [["occ-1", "occ-2"]]);
  assert.match(calls[0]?.sql ?? "", /row_number\(\) over \(\s*partition by d\.occurrence_id/);
  assert.match(calls[0]?.sql ?? "", /where row_num <= 8/);
  assert.equal(grouped.get("occ-1")?.[0]?.proposedName, "A候補");
  assert.equal(grouped.get("occ-1")?.[0]?.actorName, "Reviewer A");
  assert.equal(grouped.get("occ-2")?.[0]?.status, "resolved");
  assert.equal(grouped.get("occ-2")?.[0]?.reason, "写真が不鮮明");

  const emptyResult = await getObservationIdentifyPanelDisputes(["", "", " "]);
  assert.equal(emptyResult.size, 0);
  assert.equal(calls.length, 1);
});
