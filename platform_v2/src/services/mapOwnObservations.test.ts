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
  assert.match(queries[0]!.sql, /photo\.public_url is not null/);
});

test("listMapOwnObservations keeps the owner map to actual photo-backed shot points", async () => {
  const db = {
    async query() {
      return {
        rows: [
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
          },
        ],
      };
    },
  };

  const items = await listMapOwnObservations("owner-user", { db });

  assert.equal(items.length, 1);
  assert.equal(items[0]!.lat, 34.712);
  assert.equal(items[0]!.lng, 137.722);
  assert.equal(items[0]!.source, "visit_point");
  assert.equal(items[0]!.recordSource, "guide");
  assert.equal(items[0]!.displayName, "キク科の花");
  assert.equal(items[0]!.photoUrl, "/uploads/guide-shot.jpg");
});
