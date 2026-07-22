import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { buildRecordObservationBackfillPlan } from "./cloudflareObservationBackfill";

const record = {
  observation_id: "record-1",
  owner_user_id: "owner-1",
  taxon_label: "ニホンアマガエル",
  visibility: "public",
  processing_state: "accepted",
  created_at: "2026-07-20T00:00:00Z",
  record_consent: "private",
  withdrawal_status: "active",
};

test("backfill is deterministic, idempotent and does not infer an accepted identification", async () => {
  const input = {
    observations: [record],
    assets: [{ asset_id: "asset-1", observation_id: "record-1", owner_user_id: "owner-1", mime: "image/jpeg", processing_state: "ready" }],
    identifications: [{ identification_id: "ident-1", occurrence_id: "occ:record-1:0", actor_user_id: "community-1", actor_provenance: "community_member" as const, proposed_name: "アマガエル", proposed_rank: "species", stance: "support", source_key: "source-ident-1", source_payload_json: "{}", is_current: 1 }],
    aiTargets: [{ occurrence_id: "occ:record-1:0", ai_assessment_status: "ai_judgement", scientific_name: "Dryophytes japonicus", vernacular_name: "ニホンアマガエル", taxon_rank: "species", ai_run_id: "run-1", candidate_id: "candidate-1", candidate_scientific_name: null, candidate_vernacular_name: null, candidate_taxon_rank: null, ai_recommended_taxon_name: null, ai_recommended_rank: null, updated_at: "2026-07-20T00:00:00Z" }],
  };
  const first = await buildRecordObservationBackfillPlan(input);
  const second = await buildRecordObservationBackfillPlan(input);
  assert.deepEqual(first, second);
  assert.deepEqual(first.report.plannedCounts, { ownerObservations: 1, mediaLinks: 1, identificationClaims: 1, aiProvisionalObservations: 1 });
  assert.equal(first.report.quarantineCounts.asset_record_missing, undefined);
  const sql = first.mutations.map((mutation) => mutation.sql).join("\n");
  assert.match(sql, /ON CONFLICT/);
  assert.match(sql, /'candidate'/);
  assert.match(sql, /'ai', 'provisional', 'unreviewed'/);
  assert.doesNotMatch(sql, /'accepted'.*is_current/is);
  assert.doesNotMatch(sql, /SET\s+accepted_identification_id\s*=\s*(?!NULL)/i);
  const policyMutation = first.mutations.find((mutation) => mutation.sql.includes("record_observation_policies"));
  assert.equal(policyMutation?.values[2], "public");
  assert.equal(policyMutation?.values[3], 1);
});

test("ambiguous ownership and missing parents are quarantined without provenance promotion", async () => {
  const plan = await buildRecordObservationBackfillPlan({
    observations: [record],
    assets: [
      { asset_id: "asset-mismatch", observation_id: "record-1", owner_user_id: "other-owner", mime: "image/jpeg", processing_state: "ready" },
      { asset_id: "asset-orphan", observation_id: "missing", owner_user_id: "owner-1", mime: "image/jpeg", processing_state: "ready" },
    ],
    identifications: [
      { identification_id: "ident-orphan", occurrence_id: "occ:missing:0", actor_user_id: "user-1", actor_provenance: null, proposed_name: "不明", proposed_rank: null, stance: "support", source_key: "orphan", source_payload_json: "{}", is_current: 1 },
      { identification_id: "ident-ambiguous", occurrence_id: "occ:record-1:0", actor_user_id: "unknown-user", actor_provenance: null, proposed_name: "不明", proposed_rank: null, stance: "support", source_key: "ambiguous", source_payload_json: "{}", is_current: 1 },
    ],
    aiTargets: [{ occurrence_id: "occ:missing:0", ai_assessment_status: "ai_judgement", scientific_name: null, vernacular_name: null, taxon_rank: null, ai_run_id: null, candidate_id: null, candidate_scientific_name: null, candidate_vernacular_name: null, candidate_taxon_rank: null, ai_recommended_taxon_name: null, ai_recommended_rank: null, updated_at: "2026-07-20T00:00:00Z" }],
  });
  assert.deepEqual(plan.report.quarantineCounts, {
    asset_owner_mismatch: 1,
    asset_record_missing: 1,
    identification_record_missing: 1,
    identification_provenance_ambiguous: 1,
    ai_target_record_missing: 1,
  });
  const quarantines = plan.mutations.filter((mutation) => mutation.sql.includes("'quarantined'"));
  assert.equal(quarantines.length, 5);
});

test("explicit curator provenance is preserved and can repair a candidate-only backfill replay", async () => {
  const plan = await buildRecordObservationBackfillPlan({
    observations: [record],
    assets: [],
    identifications: [{ identification_id: "ident-curator", occurrence_id: "occ:record-1:0", actor_user_id: "curator-1", actor_provenance: "curator", proposed_name: "ニホンアマガエル", proposed_rank: "species", stance: "support", source_key: "curator-source", source_payload_json: "{}", is_current: 1 }],
    aiTargets: [],
  });
  assert.equal(plan.report.plannedCounts.identificationClaims, 1);
  assert.deepEqual(plan.report.quarantineCounts, {});
  const claim = plan.mutations.find((mutation) => mutation.sql.includes("INSERT INTO observation_identification_claims"));
  assert.equal(claim?.values[2], "curator-1");
  assert.equal(claim?.values[3], "curator");
  assert.match(claim?.sql ?? "", /actor_id = excluded\.actor_id, actor_kind = excluded\.actor_kind/);
});

test("withdrawal remains private while consent is only a fallback for missing legacy visibility", async () => {
  const withdrawn = await buildRecordObservationBackfillPlan({ observations: [{ ...record, observation_id: "record-withdrawn", withdrawal_status: "withdrawn" }], assets: [], identifications: [], aiTargets: [] });
  const fallback = await buildRecordObservationBackfillPlan({ observations: [{ ...record, observation_id: "record-fallback", visibility: "unknown", record_consent: "private" }], assets: [], identifications: [], aiTargets: [] });
  assert.equal(withdrawn.mutations.find((mutation) => mutation.sql.includes("record_observation_policies"))?.values[2], "private");
  assert.equal(fallback.mutations.find((mutation) => mutation.sql.includes("record_observation_policies"))?.values[2], "private");
});

test("fresh D1 apply and replay keep counts stable and foreign keys valid", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(readFileSync(path.join(process.cwd(), "migrations", "observations", "0067_record_observation_foundation.sql"), "utf8"));
  const plan = await buildRecordObservationBackfillPlan({
    observations: [record],
    assets: [{ asset_id: "asset-1", observation_id: "record-1", owner_user_id: "owner-1", mime: "image/jpeg", processing_state: "ready" }],
    identifications: [{ identification_id: "ident-1", occurrence_id: "occ:record-1:0", actor_user_id: "community-1", actor_provenance: "community_member" as const, proposed_name: "アマガエル", proposed_rank: "species", stance: "support", source_key: "source-ident-1", source_payload_json: "{}", is_current: 1 }],
    aiTargets: [{ occurrence_id: "occ:record-1:0", ai_assessment_status: "ai_judgement", scientific_name: "Dryophytes japonicus", vernacular_name: "ニホンアマガエル", taxon_rank: "species", ai_run_id: "run-1", candidate_id: "candidate-1", candidate_scientific_name: null, candidate_vernacular_name: null, candidate_taxon_rank: null, ai_recommended_taxon_name: null, ai_recommended_rank: null, updated_at: "2026-07-20T00:00:00Z" }],
  });
  for (let replay = 0; replay < 2; replay += 1) {
    for (const mutation of plan.mutations) db.prepare(mutation.sql).run(...mutation.values);
  }
  assert.equal(db.prepare("SELECT COUNT(*) count FROM record_observations").get()?.count, 2);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM record_observation_media WHERE active = 1").get()?.count, 2);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM observation_identification_claims WHERE claim_status = 'candidate'").get()?.count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM observation_ai_suggestions WHERE suggestion_status = 'active'").get()?.count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM record_observation_consistency_ledger").get()?.count, 4);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM record_observations WHERE accepted_identification_id IS NOT NULL").get()?.count, 0);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM occurrence_projection_versions WHERE projection_state = 'active'").get()?.count, 0);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  db.close();
});
