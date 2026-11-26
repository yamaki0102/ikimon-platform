import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import worker from "./index";
import { buildObservationAiDualWritePlan, guardObservationAiMutation } from "./cloudflareObservationAiDualWrite.js";
import type { ObservationAiCandidate } from "./cloudflareObservationAi.js";
import { sha256Hex, textToArrayBuffer } from "./core/http";
import { PROPOSAL_RATE_LIMIT } from "./recordProposals.js";
import { buildFeaturePlaceMutations } from "./recordReading.js";

const RECORD = "record-1";
const ORIGIN = "https://shadow.test";

const applyAll = (db: DatabaseSync, dir: string, only?: string[]) => {
  const root = path.join(process.cwd(), "migrations", dir);
  for (const file of readdirSync(root).filter((name) => name.endsWith(".sql") && (!only || only.some((prefix) => name.startsWith(prefix)))).sort()) db.exec(readFileSync(path.join(root, file), "utf8"));
};

function shim(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          const params = values as Array<string | number | null>;
          return {
            sql,
            values: params,
            first: async () => db.prepare(sql).get(...params) ?? null,
            all: async () => ({ results: db.prepare(sql).all(...params) }),
            run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...params).changes) } }),
          };
        },
      };
    },
    async batch(statements: Array<{ sql: string; values: Array<string | number | null> }>) {
      db.exec("BEGIN");
      try {
        const out = statements.map((statement) => ({ meta: { changes: Number(db.prepare(statement.sql).run(...statement.values).changes) } }));
        db.exec("COMMIT");
        return out;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

async function setup() {
  const obs = new DatabaseSync(":memory:");
  obs.exec("PRAGMA foreign_keys = ON;");
  applyAll(obs, "observations");
  const core = new DatabaseSync(":memory:");
  applyAll(core, "core", ["0002", "0003"]);
  obs.prepare("INSERT INTO observations (observation_id, draft_id, owner_user_id, observed_at, public_cell, visibility) VALUES (?, 'draft-1', 'owner-1', '2026-11-20T00:00:00Z', 'cell:35.00,139.00', 'public')").run(RECORD);
  obs.prepare("INSERT INTO record_observation_policies (record_runtime, record_id, owner_user_id, visibility, accepts_identification_proposals) VALUES ('cloudflare_d1', ?, 'owner-1', 'public', 1)").run(RECORD);
  obs.prepare("INSERT INTO asset_ledger (asset_id, draft_id, observation_id, owner_user_id, object_key, mime, bytes, processing_state, created_at) VALUES ('a1', 'draft-1', ?, 'owner-1', 'key/a1', 'image/jpeg', 10, 'uploaded', '2026-11-20T00:00:00Z')").run(RECORD);
  const mutations = await buildFeaturePlaceMutations({
    recordId: RECORD, requestId: "ai-run-1", aiRunId: "run-1", mediaIds: ["a1"], model: "test", promptVersion: "v1", organismCount: 0, features: [],
    place: [{ assetIndex: 0, scope: "photo", assessmentState: "informative", fields: { place_type: "water_edge", contact_surface: "artificial", surrounding_cover: "low_grass", environment_condition: "sunny", human_change: "none_visible" } }],
  });
  for (const mutation of mutations) obs.prepare(mutation.sql).run(...mutation.values);
  const candidate = {
    candidateKey: "heron", vernacularName: "コサギ", scientificName: null, rank: "species", confidence: 0.8, visualEvidence: [], needsMoreEvidence: [], subjectLocator: {},
    assetIndex: 0, nonBiological: false, coexistingSubjects: [],
  } as ObservationAiCandidate;
  const plan = await buildObservationAiDualWritePlan({ recordId: RECORD, ownerUserId: "owner-1", mediaIds: ["a1"], legacyOccurrenceId: `occ:${RECORD}:0`, requestId: "ai-run-2", aiRunId: "run-2", candidate, features: undefined, place: undefined });
  obs.prepare("INSERT OR REPLACE INTO observation_reassessment_requests (request_id, observation_id, request_kind, actor_user_id, request_state, source_payload_json) VALUES ('ai-run-2', 'record-1', 'standard', 'owner-1', 'completed', 'done')").run();
  const guard = "EXISTS (SELECT 1 FROM observation_reassessment_requests WHERE request_id = ? AND request_state = 'completed' AND source_payload_json = ?)";
  for (const mutation of plan.mutations) {
    const guarded = guardObservationAiMutation(mutation.sql, mutation.values, guard, "ai-run-2", "done");
    obs.prepare(guarded.sql).run(...guarded.values);
  }
  const cookies = new Map<string, string>();
  for (const [user, role] of [["user-a", "Observer"], ["owner-1", "Observer"], ["admin-1", "admin"]] as const) {
    const token = `token-${user}-with-enough-entropy-1234567890`;
    const hash = await sha256Hex(textToArrayBuffer(token));
    core.prepare("INSERT INTO auth_sessions (token_hash, user_id, display_name, role_name, expires_at) VALUES (?, ?, ?, ?, '2099-01-01T00:00:00Z')").run(hash, user, `${user}の名前`, role);
    core.prepare("INSERT OR IGNORE INTO auth_users (user_id, email, display_name, password_hash) VALUES (?, ?, ?, 'x')").run(user, `${user}@example.com`, `${user}の名前`);
    cookies.set(user, `ikimon_v2_session=${token}`);
  }
  const env = { OBS_DB: shim(obs), CORE_DB: shim(core), OBSERVATION_DUAL_WRITE_MODE: "on", OBSERVATION_READ_CUTOVER_MODE: "on" } as never;
  const call = (user: string | null, pathname: string, init: { method?: string; json?: unknown; form?: Record<string, string> } = {}) =>
    worker.fetch(new Request(`${ORIGIN}${pathname}`, {
      method: init.method ?? (init.json || init.form ? "POST" : "GET"),
      headers: { ...(user ? { cookie: cookies.get(user)! } : {}), origin: ORIGIN, ...(init.json ? { "content-type": "application/json" } : init.form ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
      body: init.json ? JSON.stringify(init.json) : init.form ? new URLSearchParams(init.form) : undefined,
    }), env);
  return { obs, core, call };
}

const count = (db: DatabaseSync, sql: string): number => Number((db.prepare(sql).get() as { c: number }).c);

test("real routes: proposal API, history, form identify and legacy identify share one limit and one history", async () => {
  const { obs, call } = await setup();
  const placeItem = (obs.prepare("SELECT item_id FROM record_reading_items WHERE slot = 'place_type'").get() as { item_id: string }).item_id;
  const organism = (obs.prepare("SELECT observation_id FROM record_observations WHERE record_id = ?").get(RECORD) as { observation_id: string }).observation_id;

  const proposed = await call("user-a", `/api/v1/records/${RECORD}/reading-proposals`, { json: { requestId: "request-0001-a", op: "propose", itemId: placeItem, valueCode: "wetland" } });
  assert.equal(proposed.status, 200, await proposed.clone().text());
  assert.equal(((await proposed.json()) as { current: { state: string; valueCode: string } }).current.valueCode, "wetland");

  const noSession = await call(null, `/api/v1/records/${RECORD}/reading-proposals`, { json: { requestId: "request-0002-a", op: "propose", itemId: placeItem, valueCode: "coast" } });
  assert.equal(noSession.status, 401);

  const history = await call(null, `/api/v1/records/${RECORD}/reading-history`);
  assert.equal(history.status, 200);
  const historyBody = (await history.json()) as { items: Array<{ slot: string; revisions: Array<{ action: string; fieldName: string | null }> }> };
  assert.deepEqual(historyBody.items.find((item) => item.slot === "place_type")!.revisions.map((revision) => [revision.action, revision.fieldName]), [["read", null], ["propose", "user-aの名前"]]);

  const identify = await call("user-a", `/api/v1/records/${RECORD}/observation-actions`, { form: { action: "identify", observation_id: organism, proposed_name: "アオサギ", operation_id: "identify-op-0001", note: "くちばしが黄色い" } });
  assert.equal(identify.status, 303, await identify.clone().text());
  assert.equal(count(obs, "SELECT COUNT(*) AS c FROM observation_identification_claims WHERE actor_id = 'user-a' AND proposed_name = 'アオサギ'"), 1);
  assert.equal(count(obs, "SELECT COUNT(*) AS c FROM record_reading_revisions WHERE actor_id = 'user-a' AND slot IS NULL"), 1);
  assert.equal(count(obs, "SELECT COUNT(*) AS c FROM record_reading_revisions WHERE value_json LIKE '%くちばし%'"), 0, "free notes are not stored");
  const retry = await call("user-a", `/api/v1/records/${RECORD}/observation-actions`, { form: { action: "identify", observation_id: organism, proposed_name: "アオサギ", operation_id: "identify-op-0001" } });
  assert.equal(retry.status, 303);
  assert.equal(count(obs, "SELECT COUNT(*) AS c FROM record_reading_revisions WHERE actor_id = 'user-a'"), 2, "a retried form post is not counted twice");

  for (let index = 0; index < PROPOSAL_RATE_LIMIT - 2; index += 1) {
    const result = await call("user-a", `/api/v1/records/${RECORD}/reading-proposals`, { json: { requestId: `request-fill-${String(index).padStart(3, "0")}`, op: "propose", add: { kind: "feature", valueCode: "bridge" } } });
    assert.equal(result.status, 200, `fill ${index}`);
  }
  const limitedForm = await call("user-a", `/api/v1/records/${RECORD}/observation-actions`, { form: { action: "identify", observation_id: organism, proposed_name: "ダイサギ", operation_id: "identify-op-0002" } });
  assert.equal(limitedForm.status, 429);
  assert.equal(((await limitedForm.json()) as { messageJa: string }).messageJa, "少し時間をおいてからもう一度どうぞ");
  const limitedLegacy = await call("user-a", `/api/v1/observations/${RECORD}/identifications`, { json: { proposedName: "ゴイサギ" } });
  assert.equal(limitedLegacy.status, 429);
  assert.equal(count(obs, "SELECT COUNT(*) AS c FROM observation_identification_claims WHERE proposed_name IN ('ダイサギ', 'ゴイサギ')"), 0);
  const ownerStillFree = await call("owner-1", `/api/v1/records/${RECORD}/reading-proposals`, { json: { requestId: "request-owner-0001", op: "set", itemId: placeItem, valueCode: "coast" } });
  assert.equal(ownerStillFree.status, 200);
});

test("real routes: legacy identification endpoint records one history row and still writes its own data", async () => {
  const { obs, call } = await setup();
  const legacy = await call("user-a", `/api/v1/observations/${RECORD}/identifications`, { json: { proposedName: "ゴイサギ" } });
  assert.equal(legacy.status, 200, await legacy.clone().text());
  assert.equal(count(obs, "SELECT COUNT(*) AS c FROM observation_identifications WHERE actor_user_id = 'user-a'"), 1);
  assert.equal(count(obs, "SELECT COUNT(*) AS c FROM record_reading_revisions WHERE actor_id = 'user-a'"), 1);
  const again = await call("user-a", `/api/v1/observations/${RECORD}/identifications`, { json: { proposedName: "ゴイサギ" } });
  assert.equal(again.status, 200);
  assert.equal(count(obs, "SELECT COUNT(*) AS c FROM record_reading_revisions WHERE actor_id = 'user-a'"), 1);
});

test("real routes: operator voids an account and the shown value is rebuilt; free comments are closed", async () => {
  const { obs, call } = await setup();
  const placeItem = (obs.prepare("SELECT item_id FROM record_reading_items WHERE slot = 'place_type'").get() as { item_id: string }).item_id;
  await call("user-a", `/api/v1/records/${RECORD}/reading-proposals`, { json: { requestId: "request-0001-a", op: "propose", itemId: placeItem, valueCode: "wetland" } });
  assert.equal((await call("user-a", "/api/v1/admin/reading-proposals/void-account", { json: { userId: "user-a" } })).status, 403);
  const voided = await call("admin-1", "/api/v1/admin/reading-proposals/void-account", { json: { userId: "user-a" } });
  assert.equal(voided.status, 200);
  const history = (await (await call(null, `/api/v1/records/${RECORD}/reading-history`)).json()) as { items: Array<{ slot: string; current: { state: string; valueCode: string }; revisions: Array<{ voided: boolean }> }> };
  const place = history.items.find((item) => item.slot === "place_type")!;
  assert.equal(place.current.valueCode, "water_edge");
  assert.equal(place.current.state, "ai_read");
  assert.equal(place.revisions.filter((revision) => revision.voided).length, 1);
  const closedComments = await call("owner-1", `/api/v1/observations/${RECORD}/comments`, { json: { body: "コメント" } });
  assert.equal(closedComments.status, 410);
});
