import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { buildObservationAiDualWritePlan, guardObservationAiMutation } from "./cloudflareObservationAiDualWrite.js";
import { buildIdentificationClaimDualWritePlan } from "./cloudflareObservationDualWrite.js";
import type { ObservationAiCandidate } from "./cloudflareObservationAi.js";
import {
  PROPOSAL_RATE_LIMIT,
  handleRecordProposalRoute,
  readReadingHistory,
  releaseProposer,
  submitReadingProposal,
  voidProposerAccount,
  type ProposalDb,
  type ProposalDeps,
} from "./recordProposals.js";
import { buildFeaturePlaceMutations, computeReadingState, d1ReadingQuery, deterministicUuid, readRecordReading, revisionLikeFromRow } from "./recordReading.js";

const RECORD = "record-1";
const OWNER = "owner-1";
const migration = (name: string) => readFileSync(path.join(process.cwd(), "migrations", "observations", name), "utf8");

function d1(db: DatabaseSync): ProposalDb & { readonly raw: DatabaseSync } {
  const prepare = (sql: string) => ({
    bind(...values: unknown[]) {
      const params = values as Array<string | number | null>;
      return {
        sql,
        values: params,
        first: async <T,>() => (db.prepare(sql).get(...params) as T | undefined) ?? null,
        all: async <T,>() => ({ results: db.prepare(sql).all(...params) as T[] }),
        run: () => db.prepare(sql).run(...params),
      };
    },
  });
  return {
    raw: db,
    prepare,
    batch: async (statements) => {
      db.exec("BEGIN");
      try {
        const results = (statements as Array<{ run(): { changes: number | bigint } }>).map((statement) => ({ meta: { changes: Number(statement.run().changes) } }));
        db.exec("COMMIT");
        return results;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

type Fixture = { db: DatabaseSync; d1: ReturnType<typeof d1>; clock: { ms: number }; deps: ProposalDeps };

async function openFixture(options: { visibility?: string; accepts?: number; withOrganism?: boolean } = {}): Promise<Fixture> {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of ["0001_observation_write_contract.sql", "0067_record_observation_foundation.sql", "0081_record_reading_items.sql", "0084_record_proposals.sql"]) db.exec(migration(file));
  db.exec("CREATE TABLE observation_reassessment_requests (request_id TEXT PRIMARY KEY, request_state TEXT, source_payload_json TEXT)");
  const visibility = options.visibility ?? "public";
  db.prepare("INSERT INTO observations (observation_id, draft_id, owner_user_id, observed_at, public_cell, visibility) VALUES (?, 'draft-1', ?, '2026-11-20T00:00:00Z', 'cell:35.00,139.00', ?)").run(RECORD, OWNER, visibility);
  db.prepare("INSERT INTO record_observation_policies (record_runtime, record_id, owner_user_id, visibility, accepts_identification_proposals) VALUES ('cloudflare_d1', ?, ?, ?, ?)").run(RECORD, OWNER, visibility, options.accepts ?? 1);
  db.prepare(`INSERT INTO asset_ledger (asset_id, draft_id, observation_id, owner_user_id, object_key, mime, bytes, processing_state, created_at)
    VALUES ('a1', 'draft-1', ?, ?, 'key/a1', 'image/jpeg', 10, 'uploaded', '2026-11-20T00:00:00Z')`).run(RECORD, OWNER);
  const mutations = await buildFeaturePlaceMutations({
    recordId: RECORD, requestId: "ai-run-1", aiRunId: "run-1", mediaIds: ["a1"], model: "test", promptVersion: "v1", organismCount: 0,
    features: [{ kind: "revetment", assetIndex: 0 }],
    place: [{ assetIndex: 0, scope: "photo", assessmentState: "informative", fields: { place_type: "water_edge", contact_surface: "artificial", surrounding_cover: "low_grass", environment_condition: "sunny", human_change: "none_visible" } }],
  });
  for (const mutation of mutations) db.prepare(mutation.sql).run(...mutation.values);
  if (options.withOrganism) {
    const candidate: ObservationAiCandidate = {
      candidateKey: "heron", vernacularName: "コサギ", scientificName: null, rank: "species", confidence: 0.8, visualEvidence: [], needsMoreEvidence: [], subjectLocator: {},
      assetIndex: 0, nonBiological: false, coexistingSubjects: [],
    } as ObservationAiCandidate;
    const plan = await buildObservationAiDualWritePlan({ recordId: RECORD, ownerUserId: OWNER, mediaIds: ["a1"], legacyOccurrenceId: `occ:${RECORD}:0`, requestId: "ai-run-2", aiRunId: "run-2", candidate, features: undefined, place: undefined });
    db.prepare("INSERT INTO observation_reassessment_requests VALUES ('ai-run-2', 'completed', 'done')").run();
    const guard = "EXISTS (SELECT 1 FROM observation_reassessment_requests WHERE request_id = ? AND request_state = 'completed' AND source_payload_json = ?)";
    for (const mutation of plan.mutations) {
      const guarded = guardObservationAiMutation(mutation.sql, mutation.values, guard, "ai-run-2", "done");
      db.prepare(guarded.sql).run(...guarded.values);
    }
  }
  const clock = { ms: Date.parse("2026-11-25T10:00:00Z") };
  const handle = d1(db);
  return {
    db, d1: handle, clock,
    deps: {
      db: handle,
      now: () => new Date(clock.ms),
      organismClaim: async (input) => (await buildIdentificationClaimDualWritePlan({
        recordId: input.recordId, targetObservationId: input.observationId, legacyIdentificationId: `record-ui:${input.requestId}`,
        actorUserId: input.actorUserId, actorKind: input.owner ? "owner" : "community_member", proposedName: input.name, sourcePayload: { source: "test" },
      })).mutations,
    },
  };
}

const itemId = (fixture: Fixture, slot: string): string => (fixture.db.prepare("SELECT item_id FROM record_reading_items WHERE slot = ? AND status = 'active'").get(slot) as { item_id: string }).item_id;
const revisionCount = (fixture: Fixture): number => Number((fixture.db.prepare("SELECT COUNT(*) AS c FROM record_reading_revisions").get() as { c: number }).c);
const go = (fixture: Fixture, user: string | null, body: Record<string, unknown>) => submitReadingProposal(fixture.deps, { recordId: RECORD, actor: user ? { userId: user } : null, body });
let seq = 0;
const rid = (): string => `request-${String(++seq).padStart(6, "0")}`;
const current = (result: { body: Record<string, unknown> }) => result.body.current as { state: string; valueCode: string | null; otherViewCount: number; contested: boolean; disputed: boolean; ownerPinned: boolean; labelJa: string | null };

test("another user's proposal is applied at once while the owner is absent, and is shown as proposed", async () => {
  const f = await openFixture();
  const item = itemId(f, "place_type");
  const result = await go(f, "user-a", { requestId: rid(), op: "propose", itemId: item, valueCode: "wetland" });
  assert.equal(result.status, 200);
  assert.equal(current(result).valueCode, "wetland");
  assert.equal(current(result).state, "proposed");
  assert.equal(current(result).labelJa, "湿地");
  const reading = await readRecordReading(d1ReadingQuery(f.d1 as never), RECORD);
  const place = reading.media[0]!.place.place_type!;
  assert.equal(place.code, "wetland");
  assert.equal(place.state, "proposed");
  assert.equal(place.ownerPinned, false);
  const revisions = f.db.prepare("SELECT action, actor_kind, value_code FROM record_reading_revisions WHERE item_id = ? ORDER BY seq").all(item);
  assert.deepEqual(revisions.map((row) => [row.action, row.actor_kind, row.value_code]), [["read", "ai", "water_edge"], ["propose", "community", "wetland"]]);
});

test("two competing proposals both stay in history; the shown value does not flip on a tie; a third user decides", async () => {
  const f = await openFixture();
  const item = itemId(f, "place_type");
  await go(f, "user-a", { requestId: rid(), op: "propose", itemId: item, valueCode: "wetland" });
  const second = await go(f, "user-b", { requestId: rid(), op: "propose", itemId: item, valueCode: "coast" });
  assert.equal(current(second).valueCode, "wetland");
  assert.equal(current(second).state, "proposed");
  assert.equal(current(second).contested, true);
  assert.equal(current(second).otherViewCount, 1);
  const third = await go(f, "user-c", { requestId: rid(), op: "agree", itemId: item, valueCode: "coast" });
  assert.equal(current(third).valueCode, "coast");
  assert.equal(current(third).state, "confirmed");
  assert.equal(current(third).otherViewCount, 1);
  assert.equal(revisionCount(f), 6 + 3, "no row is lost");
});

test("confirmation needs two independent users, two thirds, and no open dispute", async () => {
  const f = await openFixture();
  const item = itemId(f, "surrounding_cover");
  assert.equal(current(await go(f, "user-a", { requestId: rid(), op: "propose", itemId: item, valueCode: "trees_shrubs" })).state, "proposed");
  assert.equal(current(await go(f, "user-a", { requestId: rid(), op: "agree", itemId: item, valueCode: "trees_shrubs" })).state, "proposed", "one person twice is still one vote");
  const objected = await go(f, "user-d", { requestId: rid(), op: "object", itemId: item });
  assert.equal(current(objected).disputed, true);
  const second = await go(f, "user-b", { requestId: rid(), op: "agree", itemId: item, valueCode: "trees_shrubs" });
  assert.equal(current(second).state, "proposed", "an open dispute blocks confirmation");
  const resolved = await go(f, "user-d", { requestId: rid(), op: "agree", itemId: item, valueCode: "trees_shrubs" });
  assert.equal(current(resolved).state, "confirmed");
  assert.equal(current(resolved).disputed, false);
  const dissent = await go(f, "user-e", { requestId: rid(), op: "propose", itemId: item, valueCode: "mixed_cover" });
  assert.equal(current(dissent).state, "confirmed", "3 of 4 is at least two thirds");
  const dissent2 = await go(f, "user-f", { requestId: rid(), op: "propose", itemId: item, valueCode: "low_grass" });
  assert.equal(current(dissent2).state, "proposed", "3 of 5 is below two thirds");
});

test("a retry with the same request id writes nothing and is not counted", async () => {
  const f = await openFixture();
  const item = itemId(f, "place_type");
  const body = { requestId: "request-retry-0001", op: "propose", itemId: item, valueCode: "coast" };
  const first = await go(f, "user-a", body);
  const before = revisionCount(f);
  const again = await go(f, "user-a", body);
  assert.equal(again.body.replayed, true);
  assert.equal(again.body.revisionId, first.body.revisionId);
  assert.equal(revisionCount(f), before);
  const otherUser = await go(f, "user-b", body);
  assert.equal(otherUser.body.replayed, false, "the request id is per account");
  assert.equal(revisionCount(f), before + 1);
});

test("the owner reverts with one tap: the earlier value returns, later proposals do not move it, history keeps everything", async () => {
  const f = await openFixture();
  const item = itemId(f, "place_type");
  const proposed = await go(f, "user-a", { requestId: rid(), op: "propose", itemId: item, valueCode: "coast" });
  assert.equal((await go(f, "user-b", { requestId: rid(), op: "revert", itemId: item, targetRevisionId: proposed.body.revisionId })).status, 403);
  const reverted = await go(f, OWNER, { requestId: rid(), op: "revert", itemId: item, targetRevisionId: proposed.body.revisionId });
  assert.equal(reverted.status, 200);
  assert.equal(current(reverted).valueCode, "water_edge");
  assert.equal(current(reverted).state, "confirmed");
  assert.equal(current(reverted).ownerPinned, true);
  assert.equal((await go(f, OWNER, { requestId: rid(), op: "revert", itemId: item, targetRevisionId: proposed.body.revisionId })).status, 409);
  const later = await go(f, "user-c", { requestId: rid(), op: "propose", itemId: item, valueCode: "coast" });
  assert.equal(current(later).valueCode, "water_edge", "the pinned value is not moved by later proposals");
  assert.equal(current(later).otherViewCount, 1);
  const retry = await go(f, "user-a", { requestId: "request-retry-again", op: "propose", itemId: item, valueCode: "coast" });
  assert.equal(current(retry).valueCode, "water_edge");
  const history = f.db.prepare("SELECT action, actor_kind FROM record_reading_revisions WHERE item_id = ? ORDER BY seq").all(item);
  assert.deepEqual(history.map((row) => `${row.actor_kind}:${row.action}`), ["ai:read", "community:propose", "owner:revert", "community:propose", "community:propose"]);
  const owner = await go(f, OWNER, { requestId: rid(), op: "set", itemId: item, valueCode: "wetland" });
  assert.equal(current(owner).valueCode, "wetland");
  assert.equal(current(owner).state, "confirmed");
});

test("reverting a proposal that removed an item brings the earlier value back", async () => {
  const f = await openFixture();
  const item = itemId(f, "feature_kind");
  const first = await go(f, "user-a", { requestId: rid(), op: "propose", itemId: item, valueCode: "bridge" });
  const second = await go(f, "user-a", { requestId: rid(), op: "remove", itemId: item });
  assert.equal(current(second).state, "proposed");
  const reverted = await go(f, OWNER, { requestId: rid(), op: "revert", itemId: item, targetRevisionId: second.body.revisionId });
  assert.equal(current(reverted).valueCode, "bridge", "value before the reverted change");
  assert.ok(first.body.revisionId);
  const reading = await readRecordReading(d1ReadingQuery(f.d1 as never), RECORD);
  assert.ok(reading.media[0]!.found.some((found) => found.code === "bridge"));
});

test("votes are invalidated by account: the shown value is rebuilt from the remaining history", async () => {
  const f = await openFixture();
  const item = itemId(f, "place_type");
  await go(f, "user-a", { requestId: rid(), op: "propose", itemId: item, valueCode: "coast" });
  const confirmed = await go(f, "user-b", { requestId: rid(), op: "agree", itemId: item, valueCode: "coast" });
  assert.equal(current(confirmed).state, "confirmed");
  const before = revisionCount(f);
  const voided = await voidProposerAccount(f.deps as never, { adminUserId: "admin-1", userId: "user-a" });
  assert.equal(voided.body.voidedRevisions, 1);
  assert.equal(revisionCount(f), before, "rows are not deleted");
  const reading = await readRecordReading(d1ReadingQuery(f.d1 as never), RECORD);
  const place = reading.media[0]!.place.place_type!;
  assert.equal(place.code, "coast");
  assert.equal(place.state, "proposed", "one valid supporter is left");
  const blocked = await go(f, "user-a", { requestId: rid(), op: "propose", itemId: item, valueCode: "woodland" });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.error, "proposer_suspended");
  const again = await voidProposerAccount(f.deps as never, { adminUserId: "admin-1", userId: "user-b" });
  assert.equal(again.body.voidedRevisions, 1);
  const rebuilt = await readRecordReading(d1ReadingQuery(f.d1 as never), RECORD);
  assert.equal(rebuilt.media[0]!.place.place_type!.code, "water_edge");
  assert.equal(rebuilt.media[0]!.place.place_type!.state, "ai_read");
  const released = await releaseProposer(f.deps as never, { adminUserId: "admin-1", userId: "user-a" });
  assert.equal(released.body.released, true);
  assert.equal((await go(f, "user-a", { requestId: rid(), op: "propose", itemId: item, valueCode: "woodland" })).status, 200);
});

test("the shown value is a pure function of the history: replaying the stored revisions gives the same answer", async () => {
  const f = await openFixture();
  const item = itemId(f, "contact_surface");
  await go(f, "user-a", { requestId: rid(), op: "propose", itemId: item, valueCode: "rock" });
  await go(f, "user-b", { requestId: rid(), op: "propose", itemId: item, valueCode: "gravel" });
  await go(f, "user-c", { requestId: rid(), op: "agree", itemId: item, valueCode: "gravel" });
  const last = await go(f, "user-d", { requestId: rid(), op: "propose", itemId: item, valueCode: "sand" });
  const rows = f.db.prepare("SELECT revision_id, seq, action, actor_kind, actor_id, value_code, value_json, reverts_revision_id FROM record_reading_revisions WHERE item_id = ? ORDER BY seq").all(item) as Array<Record<string, unknown>>;
  const rebuilt = computeReadingState(rows.map(revisionLikeFromRow), { kind: "place_field" });
  assert.equal(rebuilt.valueCode, current(last).valueCode);
  assert.equal(rebuilt.state, current(last).state);
  assert.equal(rebuilt.valueCode, "gravel");
  assert.equal(rebuilt.state, "proposed", "2 of 4 votes is below two thirds");
  const shuffled = computeReadingState([...rows].reverse().map(revisionLikeFromRow), { kind: "place_field" });
  assert.equal(shuffled.valueCode, rebuilt.valueCode);
  f.db.prepare("UPDATE record_reading_items SET row_version = 99 WHERE item_id = ?").run(item);
  const reading = await readRecordReading(d1ReadingQuery(f.d1 as never), RECORD);
  assert.equal(reading.media[0]!.place.contact_surface!.code, "gravel");
});

test("one rate limit: 30 writes per 60 minutes on other people's records; own edits are exempt; retries are free", async () => {
  const f = await openFixture();
  const placeItem = itemId(f, "place_type");
  const requests: string[] = [];
  for (let index = 0; index < PROPOSAL_RATE_LIMIT; index += 1) {
    const requestId = `request-rate-${String(index).padStart(3, "0")}`;
    requests.push(requestId);
    const result = await go(f, "user-a", { requestId, op: "propose", add: { kind: "feature", valueCode: "bridge" } });
    assert.equal(result.status, 200, `write ${index + 1}`);
    f.clock.ms += 1000;
  }
  const blocked = await go(f, "user-a", { requestId: "request-rate-over", op: "propose", itemId: placeItem, valueCode: "coast" });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error, "proposal_rate_limited");
  assert.equal(blocked.body.messageJa, "少し時間をおいてからもう一度どうぞ");
  assert.ok(Number(blocked.headers?.["retry-after"]) > 0);
  const replay = await go(f, "user-a", { requestId: requests[5], op: "propose", add: { kind: "feature", valueCode: "bridge" } });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.replayed, true);
  assert.equal((await go(f, "user-b", { requestId: "request-rate-b", op: "propose", itemId: placeItem, valueCode: "coast" })).status, 200, "the limit is per account");
  for (let index = 0; index < 35; index += 1) {
    assert.equal((await go(f, OWNER, { requestId: `request-owner-${String(index).padStart(3, "0")}`, op: "set", itemId: placeItem, valueCode: index % 2 ? "woodland" : "urban" })).status, 200);
  }
  f.clock.ms += 61 * 60_000;
  assert.equal((await go(f, "user-a", { requestId: "request-rate-after", op: "propose", itemId: placeItem, valueCode: "coast" })).status, 200, "the window slides");
});

test("choice-only: free text, other slots' codes and unknown codes are rejected; 分からない is a normal choice", async () => {
  const f = await openFixture();
  const item = itemId(f, "place_type");
  const before = revisionCount(f);
  for (const valueCode of ["ここは公園の入口", "sunny", "WATER_EDGE", "", "water_edge; drop table", null, 5]) {
    const result = await go(f, "user-a", { requestId: rid(), op: "propose", itemId: item, valueCode });
    assert.equal(result.status, 400, String(valueCode));
    assert.equal(result.body.error, "value_not_allowed");
  }
  assert.equal((await go(f, "user-a", { requestId: rid(), op: "propose", add: { kind: "feature", valueCode: "garden_gnome" } })).status, 400);
  assert.equal((await go(f, "user-a", { requestId: rid(), op: "propose", add: { kind: "feature", valueCode: "bridge", assetId: "not-this-record" } })).status, 400);
  assert.equal((await go(f, "user-a", { requestId: rid(), op: "propose", itemId: item, valueCode: "coast", reasonCode: "free text here" })).status, 400);
  assert.equal(revisionCount(f), before);
  const unknown = await go(f, "user-a", { requestId: rid(), op: "propose", itemId: item, valueCode: "unknown" });
  assert.equal(unknown.status, 200);
  assert.equal(current(unknown).labelJa, "分からない");
  const none = await go(f, "user-b", { requestId: rid(), op: "propose", itemId: itemId(f, "human_change"), valueCode: "none_visible", comment: "表札 山田", name: "山田" });
  assert.equal(current(none).labelJa, "写っている範囲では見当たらない");
  const stored = f.db.prepare("SELECT value_json, reason_code FROM record_reading_revisions WHERE actor_id = 'user-b'").all() as Array<{ value_json: string; reason_code: string | null }>;
  assert.deepEqual(stored.map((row) => row.value_json), ["{}"]);
  const reason = await go(f, "user-b", { requestId: rid(), op: "propose", itemId: item, valueCode: "coast", reasonCode: "beak_shape" });
  assert.equal(reason.status, 200);
});

test("who may do what: private or closed records, banned or signed-out users, owner-only operations", async () => {
  const closed = await openFixture({ accepts: 0 });
  assert.equal((await go(closed, "user-a", { requestId: rid(), op: "propose", itemId: itemId(closed, "place_type"), valueCode: "coast" })).status, 403);
  assert.equal((await go(closed, OWNER, { requestId: rid(), op: "propose", itemId: itemId(closed, "place_type"), valueCode: "coast" })).status, 200, "the owner can always fix");
  const priv = await openFixture({ visibility: "private" });
  assert.equal((await go(priv, "user-a", { requestId: rid(), op: "propose", itemId: itemId(priv, "place_type"), valueCode: "coast" })).status, 403);
  const open = await openFixture();
  const item = itemId(open, "place_type");
  assert.equal((await go(open, null, { requestId: rid(), op: "propose", itemId: item, valueCode: "coast" })).status, 401);
  assert.equal((await submitReadingProposal(open.deps, { recordId: RECORD, actor: { userId: "x", banned: true }, body: { requestId: rid(), op: "propose", itemId: item, valueCode: "coast" } })).status, 401);
  assert.equal((await go(open, "user-a", { requestId: rid(), op: "set", itemId: item, valueCode: "coast" })).status, 403);
  assert.equal((await go(open, OWNER, { requestId: rid(), op: "object", itemId: item })).status, 400);
  assert.equal((await go(open, "user-a", { requestId: rid(), op: "propose", itemId: "00000000-0000-4000-8000-000000000000", valueCode: "coast" })).status, 404);
  assert.equal((await go(open, "user-a", { requestId: rid(), op: "agree", itemId: item, valueCode: "coast" })).body.error, "nothing_to_agree");
  assert.equal((await submitReadingProposal(open.deps, { recordId: "nope", actor: { userId: "u" }, body: { requestId: rid(), op: "propose", itemId: item, valueCode: "coast" } })).status, 404);
  const own = await go(open, OWNER, { requestId: rid(), op: "propose", itemId: item, valueCode: "coast" });
  assert.equal(current(own).state, "confirmed");
});

test("an owner who reverts the same person often suspends that person's proposals; only an operator releases", async () => {
  const f = await openFixture();
  const slots = ["place_type", "contact_surface", "surrounding_cover", "environment_condition", "human_change"];
  const values = ["coast", "rock", "snow", "windy", "mowing"];
  for (let index = 0; index < 4; index += 1) {
    const item = itemId(f, slots[index]!);
    const proposed = await go(f, "user-bad", { requestId: rid(), op: "propose", itemId: item, valueCode: values[index] });
    const reverted = await go(f, OWNER, { requestId: rid(), op: "revert", itemId: item, targetRevisionId: proposed.body.revisionId });
    assert.equal(reverted.body.proposerSuspended, false);
  }
  const last = itemId(f, slots[4]!);
  const proposed = await go(f, "user-bad", { requestId: rid(), op: "propose", itemId: last, valueCode: values[4] });
  const reverted = await go(f, OWNER, { requestId: rid(), op: "revert", itemId: last, targetRevisionId: proposed.body.revisionId });
  assert.equal(reverted.body.proposerSuspended, true);
  const stopped = await go(f, "user-bad", { requestId: rid(), op: "propose", itemId: last, valueCode: "unknown" });
  assert.equal(stopped.status, 403);
  assert.equal(stopped.body.error, "proposer_suspended");
  assert.equal((await go(f, "user-good", { requestId: rid(), op: "propose", itemId: last, valueCode: "unknown" })).status, 200);
  assert.equal(f.db.prepare("SELECT status FROM record_proposer_standing WHERE user_id = 'user-bad'").get()?.status, "suspended");
  await releaseProposer(f.deps as never, { adminUserId: "admin-1", userId: "user-bad" });
  assert.equal((await go(f, "user-bad", { requestId: rid(), op: "propose", itemId: last, valueCode: "unknown" })).status, 200);
});

test("a person who is reverted by three different owners is suspended", async () => {
  const f = await openFixture();
  const item = itemId(f, "place_type");
  const reverts: string[] = [];
  for (const owner of ["o1", "o2", "o3"]) {
    const proposed = await go(f, "user-bad", { requestId: rid(), op: "propose", itemId: item, valueCode: "coast" });
    reverts.push(String(proposed.body.revisionId));
    f.db.prepare("INSERT INTO record_reading_revisions (revision_id, item_id, seq, action, actor_kind, actor_id, request_id, created_at, reverts_revision_id, vocab_version, slot) VALUES (?, ?, (SELECT MAX(seq) + 1 FROM record_reading_revisions WHERE item_id = ?), 'revert', 'owner', ?, ?, ?, ?, 'place-state/1', 'place_type')")
      .run(`${owner}-revert-`.padEnd(36, "0"), item, item, owner, `${owner}-r`, "2026-11-25 10:00:00", String(proposed.body.revisionId));
  }
  const probe = await go(f, OWNER, { requestId: rid(), op: "revert", itemId: item, targetRevisionId: reverts[0] });
  assert.equal(probe.status, 409, "already reverted");
  const extra = await go(f, "user-bad", { requestId: rid(), op: "propose", itemId: item, valueCode: "coast" });
  const fourth = await go(f, OWNER, { requestId: rid(), op: "revert", itemId: item, targetRevisionId: extra.body.revisionId });
  assert.equal(fourth.body.proposerSuspended, true);
});

test("organism names go through the same handler: shared limit, candidate claim kept, never confirmed by the owner alone", async () => {
  const f = await openFixture({ withOrganism: true });
  const organism = f.db.prepare("SELECT observation_id FROM record_observations WHERE record_id = ?").get(RECORD) as { observation_id: string };
  const proposed = await go(f, "user-a", { requestId: rid(), op: "propose", observationId: organism.observation_id, name: "アオサギ" });
  assert.equal(proposed.status, 200);
  assert.equal(current(proposed).state, "proposed");
  assert.equal(f.db.prepare("SELECT COUNT(*) AS c FROM observation_identification_claims WHERE actor_id = 'user-a' AND proposed_name = 'アオサギ'").get()?.c, 1);
  const retried = await go(f, "user-a", { requestId: "request-organism-retry", op: "propose", observationId: organism.observation_id, name: "アオサギ" });
  const retriedAgain = await go(f, "user-a", { requestId: "request-organism-retry", op: "propose", observationId: organism.observation_id, name: "アオサギ" });
  assert.equal(retriedAgain.body.replayed, true);
  assert.equal(retried.body.revisionId, retriedAgain.body.revisionId);
  const ownerFix = await go(f, OWNER, { requestId: rid(), op: "set", observationId: organism.observation_id, name: "ダイサギ" });
  assert.equal(current(ownerFix).state, "proposed", "an owner-only name never becomes confirmed by this path");
  const reading = await readRecordReading(d1ReadingQuery(f.d1 as never), RECORD);
  assert.notEqual(reading.media[0]!.found.find((item) => item.kind === "organism")?.state, "confirmed");
  assert.equal((await go(f, "user-a", { requestId: rid(), op: "propose", observationId: organism.observation_id, name: "x".repeat(161) })).status, 400);
  assert.equal((await go(f, "user-a", { requestId: rid(), op: "propose", observationId: "no-such-observation", name: "アオサギ" })).status, 404);
  for (let index = 0; index < PROPOSAL_RATE_LIMIT; index += 1) {
    assert.equal((await go(f, "user-z", { requestId: rid(), op: "propose", observationId: organism.observation_id, name: `候補${index}` })).status, 200);
  }
  const over = await go(f, "user-z", { requestId: rid(), op: "propose", observationId: organism.observation_id, name: "あふれ" });
  assert.equal(over.status, 429);
});

test("history route: shows every revision with field names, hides private records, never exposes account ids", async () => {
  const f = await openFixture();
  const item = itemId(f, "place_type");
  const proposed = await go(f, "user-a", { requestId: rid(), op: "propose", itemId: item, valueCode: "coast" });
  await go(f, OWNER, { requestId: rid(), op: "revert", itemId: item, targetRevisionId: proposed.body.revisionId });
  const fieldNames = async (ids: string[]) => new Map(ids.map((id) => [id, id === "user-a" ? "きたかぜ" : "持ち主さん"]));
  const result = await readReadingHistory({ db: f.d1, fieldNames }, RECORD, { userId: "user-z" });
  const place = (result.body.items as Array<{ slot: string; revisions: Array<Record<string, unknown>>; current: { state: string } }>).find((entry) => entry.slot === "place_type")!;
  assert.deepEqual(place.revisions.map((revision) => [revision.action, revision.fieldName]), [["read", null], ["propose", "きたかぜ"], ["revert", "持ち主さん"]]);
  assert.equal(place.current.state, "confirmed");
  assert.equal(JSON.stringify(result.body).includes("user-a"), false);
  f.db.prepare("UPDATE observations SET visibility = 'private'").run();
  f.db.prepare("UPDATE record_observation_policies SET visibility = 'private'").run();
  assert.equal((await readReadingHistory({ db: f.d1 }, RECORD, { userId: "user-z" })).status, 404);
  assert.equal((await readReadingHistory({ db: f.d1 }, RECORD, { userId: OWNER })).status, 200);
});

test("routes: same origin only, session required, admin-only account void", async () => {
  const f = await openFixture();
  const item = itemId(f, "place_type");
  const session = { current: { userId: "user-a" } as { userId: string; roleName?: string } | null };
  const deps = { ...f.deps, readSession: async () => session.current, isAdmin: (value: { roleName?: string | null }) => value.roleName === "admin" };
  const post = (pathname: string, body: unknown, origin: string | null = "https://zukan.example") =>
    handleRecordProposalRoute(deps, new Request(`https://zukan.example${pathname}`, { method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify(body) }), pathname);
  assert.equal(await handleRecordProposalRoute(deps, new Request("https://zukan.example/api/v1/other"), "/api/v1/other"), null);
  const path = `/api/v1/records/${RECORD}/reading-proposals`;
  assert.equal((await post(path, { requestId: rid(), op: "propose", itemId: item, valueCode: "coast" }, "https://evil.example"))!.status, 403);
  assert.equal((await post(path, { requestId: rid(), op: "propose", itemId: item, valueCode: "coast" }, null))!.status, 403);
  const ok = await post(path, { requestId: rid(), op: "propose", itemId: item, valueCode: "coast" });
  assert.equal(ok!.status, 200);
  assert.equal(((await ok!.json()) as { current: { valueCode: string } }).current.valueCode, "coast");
  assert.equal((await post("/api/v1/admin/reading-proposals/void-account", { userId: "user-a" }))!.status, 403);
  session.current = { userId: "admin-1", roleName: "admin" };
  const voided = await post("/api/v1/admin/reading-proposals/void-account", { userId: "user-a" });
  assert.equal(((await voided!.json()) as { voidedRevisions: number }).voidedRevisions, 1);
  session.current = null;
  assert.equal((await post(path, { requestId: rid(), op: "propose", itemId: item, valueCode: "coast" }))!.status, 401);
  const history = await handleRecordProposalRoute(deps, new Request(`https://zukan.example/api/v1/records/${RECORD}/reading-history`), `/api/v1/records/${RECORD}/reading-history`);
  assert.equal(history!.status, 200);
  assert.equal((await handleRecordProposalRoute(deps, new Request(`https://zukan.example${path}`), path))!.status, 405);
});

test("a new feature can be added by anyone, anchored to a photo of this record; ids are stable across retries", async () => {
  const f = await openFixture();
  const body = { requestId: "request-add-0001", op: "propose", add: { kind: "feature", valueCode: "fence", assetId: "a1" } };
  const added = await go(f, "user-a", body);
  assert.equal(added.status, 200);
  assert.equal(current(added).valueCode, "fence");
  assert.equal(current(added).state, "proposed");
  const again = await go(f, "user-a", body);
  assert.equal(again.body.replayed, true);
  assert.equal(again.body.itemId, added.body.itemId);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS c FROM record_reading_items WHERE kind = 'feature'").get()?.c, 2);
  const reading = await readRecordReading(d1ReadingQuery(f.d1 as never), RECORD);
  assert.deepEqual(reading.media[0]!.found.map((item) => [item.code, item.state]), [["revetment", "ai_read"], ["fence", "proposed"]]);
  assert.equal(await deterministicUuid("x"), await deterministicUuid("x"));
});

test("the limit also holds inside the write itself when two requests race past the pre-check", async () => {
  const f = await openFixture();
  const item = itemId(f, "place_type");
  for (let index = 0; index < PROPOSAL_RATE_LIMIT; index += 1) assert.equal((await go(f, "user-a", { requestId: `request-race-${String(index).padStart(3, "0")}`, op: "propose", add: { kind: "feature", valueCode: "bridge" } })).status, 200);
  const lying: ProposalDb = {
    ...f.d1,
    prepare: (sql: string) => (sql.includes("MIN(created_at)") ? { bind: () => ({ first: async () => ({ c: 0, oldest: null }), all: async () => ({ results: [] }) }) } : f.d1.prepare(sql)) as ReturnType<ProposalDb["prepare"]>,
    batch: (statements) => f.d1.batch(statements),
  };
  const before = revisionCount(f);
  const result = await submitReadingProposal({ ...f.deps, db: lying }, { recordId: RECORD, actor: { userId: "user-a" }, body: { requestId: "request-race-over", op: "propose", itemId: item, valueCode: "coast" } });
  assert.equal(result.status, 429);
  assert.equal(revisionCount(f), before);
});
