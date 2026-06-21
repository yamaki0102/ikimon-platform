import assert from "node:assert/strict";
import test from "node:test";
import { listMapOwnObservations } from "./mapOwnObservations.js";

test("listMapOwnObservations returns exact owner records and defensively excludes other users", async () => {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    async query(sql: string, params: unknown[] = []) {
      queries.push({ sql, params });
      return {
        rows: [
          {
            user_id: "owner-user",
            occurrence_id: "occ-owner",
            visit_id: "visit-owner",
            scientific_name: "Pieris rapae",
            vernacular_name: "モンシロチョウ",
            display_name: "モンシロチョウ",
            ai_candidate_name: null,
            observed_at: "2026-06-21T09:00:00.000Z",
            point_latitude: "34.712345",
            point_longitude: "137.727891",
            place_latitude: null,
            place_longitude: null,
            photo_url: "uploads/owner.jpg",
            source_kind: "v2_observation",
            session_mode: "standard",
            visit_mode: "manual",
          },
          {
            user_id: "other-user",
            occurrence_id: "occ-other",
            visit_id: "visit-other",
            scientific_name: "Corvus macrorhynchos",
            vernacular_name: "ハシブトガラス",
            display_name: "ハシブトガラス",
            ai_candidate_name: null,
            observed_at: "2026-06-21T08:00:00.000Z",
            point_latitude: "35.1",
            point_longitude: "138.1",
            place_latitude: null,
            place_longitude: null,
            photo_url: "/uploads/other.jpg",
            source_kind: "v2_observation",
            session_mode: "standard",
            visit_mode: "manual",
          },
        ],
      };
    },
  };

  const items = await listMapOwnObservations("owner-user", {
    bbox: [137.7, 34.7, 137.8, 34.8],
    limit: 12,
    db,
  });

  assert.equal(items.length, 1);
  assert.deepEqual(items[0], {
    occurrenceId: "occ-owner",
    visitId: "visit-owner",
    displayName: "モンシロチョウ",
    observedAt: "2026-06-21T09:00:00.000Z",
    lat: 34.712345,
    lng: 137.727891,
    photoUrl: "/uploads/owner.jpg",
    source: "visit_point",
    recordSource: "manual",
  });
  assert.equal(queries.length, 1);
  assert.equal(queries[0]!.params[0], "owner-user");
  assert.match(queries[0]!.sql, /v\.user_id = \$1/);
  assert.match(queries[0]!.sql, /v\.point_longitude between \$2 and \$4/);
  assert.match(queries[0]!.sql, /v\.point_latitude between \$3 and \$5/);
  assert.match(queries[0]!.sql, /v\.source_kind = 'v2_observation'/);
  assert.match(queries[0]!.sql, /coalesce\(v\.session_mode, ''\) = 'standard'/);
  assert.match(queries[0]!.sql, /coalesce\(v\.visit_mode, 'manual'\) = 'manual'/);
  assert.match(queries[0]!.sql, /photo\.public_url is not null/);
});

test("listMapOwnObservations keeps the owner map to actual photo-backed shot points", async () => {
  const db = {
    async query() {
      return {
        rows: [
          {
            user_id: "owner-user",
            occurrence_id: "occ-real-shot",
            visit_id: "visit-real-shot",
            scientific_name: "Pieris rapae",
            vernacular_name: "モンシロチョウ",
            display_name: "モンシロチョウ",
            ai_candidate_name: null,
            observed_at: "2026-06-20T09:20:00.000Z",
            point_latitude: "34.713",
            point_longitude: "137.723",
            place_latitude: null,
            place_longitude: null,
            photo_url: "/uploads/owner-real-shot.jpg",
            source_kind: "v2_observation",
            session_mode: "standard",
            visit_mode: "manual",
            visit_source_payload_text: "{\"source\":\"v2_write_api\"}",
            occurrence_source_payload_text: "{\"source\":\"v2_write_api\"}",
            evidence_source_payload_text: "{\"source\":\"v2_write_api\"}",
            asset_source_payload_text: "{\"source\":\"v2_write_api\"}",
            locality_note: "佐鳴湖公園",
            note: "葉の上で撮影",
          },
          {
            user_id: "owner-user",
            occurrence_id: "occ-guide-center",
            visit_id: "visit-guide-center",
            scientific_name: null,
            vernacular_name: null,
            display_name: "同定待ち",
            ai_candidate_name: "キク科の花",
            observed_at: "2026-06-20T09:00:00.000Z",
            point_latitude: null,
            point_longitude: null,
            place_latitude: "34.71",
            place_longitude: "137.72",
            photo_url: null,
            source_kind: "guide_record_promotion",
            session_mode: "guide",
            visit_mode: "guide",
            visit_source_payload_text: "{\"source\":\"field_guide\"}",
          },
          {
            user_id: "owner-user",
            occurrence_id: "occ-guide-shot",
            visit_id: "visit-guide-shot",
            scientific_name: null,
            vernacular_name: null,
            display_name: "同定待ち",
            ai_candidate_name: "キク科の花",
            observed_at: "2026-06-20T09:10:00.000Z",
            point_latitude: "34.712",
            point_longitude: "137.722",
            place_latitude: "34.71",
            place_longitude: "137.72",
            photo_url: "/uploads/guide-shot.jpg",
            source_kind: "guide_record_promotion",
            session_mode: "guide",
            visit_mode: "guide",
            visit_source_payload_text: "{\"source\":\"field_guide\"}",
          },
          {
            user_id: "owner-user",
            occurrence_id: "occ-scan-shot",
            visit_id: "visit-scan-shot",
            scientific_name: null,
            vernacular_name: null,
            display_name: "同定待ち",
            ai_candidate_name: "鳥類",
            observed_at: "2026-06-20T09:11:00.000Z",
            point_latitude: "34.714",
            point_longitude: "137.724",
            place_latitude: null,
            place_longitude: null,
            photo_url: "/uploads/scan-shot.jpg",
            source_kind: "v2_observation",
            session_mode: "fieldscan",
            visit_mode: "track",
            visit_source_payload_text: "{\"source\":\"fieldscan\"}",
          },
          {
            user_id: "owner-user",
            occurrence_id: "occ-legacy-shot",
            visit_id: "visit-legacy-shot",
            scientific_name: "Passer montanus",
            vernacular_name: "スズメ",
            display_name: "スズメ",
            ai_candidate_name: null,
            observed_at: "2026-06-20T09:12:00.000Z",
            point_latitude: "34.715",
            point_longitude: "137.725",
            place_latitude: null,
            place_longitude: null,
            photo_url: "/uploads/legacy-shot.jpg",
            source_kind: "legacy_observation",
            session_mode: "standard",
            visit_mode: "manual",
            visit_source_payload_text: "{\"source\":\"legacy_import\"}",
          },
          {
            user_id: "owner-user",
            occurrence_id: "occ-smoke-shot",
            visit_id: "visit-smoke-shot",
            scientific_name: "Fringilla montifringilla",
            vernacular_name: "アトリ",
            display_name: "アトリ",
            ai_candidate_name: null,
            observed_at: "2026-06-20T09:13:00.000Z",
            point_latitude: "34.716",
            point_longitude: "137.726",
            place_latitude: null,
            place_longitude: null,
            photo_url: "/uploads/smoke-shot.jpg",
            source_kind: "v2_observation",
            session_mode: "standard",
            visit_mode: "manual",
            visit_source_payload_text: "{\"source\":\"smoke_regression_fixture\"}",
          },
          {
            user_id: "owner-user",
            occurrence_id: "occ-excluded-shot",
            visit_id: "visit-excluded-shot",
            scientific_name: "Corvus macrorhynchos",
            vernacular_name: "ハシブトガラス",
            display_name: "ハシブトガラス",
            ai_candidate_name: null,
            observed_at: "2026-06-20T09:14:00.000Z",
            point_latitude: "34.717",
            point_longitude: "137.727",
            place_latitude: null,
            place_longitude: null,
            photo_url: "/uploads/excluded-shot.jpg",
            source_kind: "v2_observation",
            session_mode: "standard",
            visit_mode: "manual",
            visit_source_payload_text: "{\"expectedVisibility\":\"excluded\"}",
          },
          {
            user_id: "owner-user",
            occurrence_id: "occ-placeholder-shot",
            visit_id: "visit-placeholder-shot",
            scientific_name: "Zosterops japonicus",
            vernacular_name: "メジロ",
            display_name: "メジロ",
            ai_candidate_name: null,
            observed_at: "2026-06-20T09:15:00.000Z",
            point_latitude: "34.718",
            point_longitude: "137.728",
            place_latitude: null,
            place_longitude: null,
            photo_url: "/assets/img/icon-192.png",
            source_kind: "v2_observation",
            session_mode: "standard",
            visit_mode: "manual",
          },
          {
            user_id: "owner-user",
            occurrence_id: "occ-regression-manual-shot",
            visit_id: "visit-regression-manual-shot",
            scientific_name: "Apis mellifera",
            vernacular_name: "セイヨウミツバチ",
            display_name: "セイヨウミツバチ",
            ai_candidate_name: null,
            observed_at: "2026-06-20T09:16:00.000Z",
            point_latitude: "34.719",
            point_longitude: "137.729",
            place_latitude: null,
            place_longitude: null,
            photo_url: "/uploads/regression-public/manual-valid.jpg",
            source_kind: "v2_observation",
            session_mode: "standard",
            visit_mode: "manual",
            visit_source_payload_text: "{\"source\":\"regression_seed_manual\",\"fixture_prefix\":\"c102\",\"scenario\":\"manual\"}",
            occurrence_source_payload_text: "{\"source\":\"regression_seed_manual\"}",
            evidence_source_payload_text: "{\"source\":\"regression_seed_manual\"}",
            asset_source_payload_text: "{\"source\":\"regression_seed_manual\"}",
            locality_note: "staging regression manual fixture",
            note: "manual regression fixture",
          },
        ],
      };
    },
  };

  const items = await listMapOwnObservations("owner-user", { db });

  assert.equal(items.length, 2);
  assert.equal(items[0]!.lat, 34.713);
  assert.equal(items[0]!.lng, 137.723);
  assert.equal(items[0]!.source, "visit_point");
  assert.equal(items[0]!.recordSource, "manual");
  assert.equal(items[0]!.displayName, "モンシロチョウ");
  assert.equal(items[0]!.photoUrl, "/uploads/owner-real-shot.jpg");
  assert.equal(items[1]!.recordSource, "manual");
  assert.equal(items[1]!.displayName, "セイヨウミツバチ");
  assert.equal(items[1]!.photoUrl, "/uploads/regression-public/manual-valid.jpg");
});
