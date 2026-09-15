import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  listD1PublicPlaceChildren,
  searchD1PublicPlaces,
  type PlaceRegistryD1Database,
} from "./placeRegistryD1";

const placeMigrationSql = readFileSync(
  new URL("../migrations/observations/0068_universal_place_atlas.sql", import.meta.url),
  "utf8",
);
const tokiwaImportSql = readFileSync(
  new URL("../../../ops/data/generated/universal_place_atlas_tokiwa_20260905.d1.sql", import.meta.url),
  "utf8",
);
type TokiwaAdoption = {
  source: {
    sourceDocumentSha256: string;
    selectedPlaceId: string;
    selectedPlaceCount: number;
  };
  importArtifactSha256: string;
  scope: { publicPlaces: number; records: number; privateRows: number };
  expectedIdentity: { canonicalName: string; aliases: string[] };
};

const tokiwaAdoption = JSON.parse(readFileSync(
  new URL("../../../ops/data/adopted/universal_place_atlas_tokiwa_20260905.json", import.meta.url),
  "utf8",
)) as TokiwaAdoption;
const canarySeed = readFileSync(
  new URL("../../../ops/data/universal_place_atlas_canary.json", import.meta.url),
);

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function realPlaceDatabase(): { sqlite: DatabaseSync; db: PlaceRegistryD1Database } {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE place_memory_entries (entry_id TEXT PRIMARY KEY, cell_id TEXT, updated_at TEXT)");
  sqlite.exec(placeMigrationSql);
  sqlite.exec(tokiwaImportSql);
  return {
    sqlite,
    db: {
      prepare(sql) {
        let values: Array<string | number | null> = [];
        return {
          bind(...next) { values = next; return this; },
          async all<T>() { return { results: sqlite.prepare(sql).all(...values) as T[] }; },
        };
      },
    },
  };
}

function databaseWithRows(rows: Array<Record<string, unknown>>): PlaceRegistryD1Database {
  return {
    prepare(sql: string) {
      let values: Array<string | number | null> = [];
      return {
        bind(...bound) {
          values = bound;
          return this;
        },
        async all<T>() {
          assert.match(sql, /public_profile_status = 'published'/);
          assert.ok(values.length >= 3);
          return { results: rows as T[] };
        },
      };
    },
  };
}

const tokiwa = {
  place_id: "place_tokiwa",
  canonical_name: "常磐公園",
  canonical_name_normalized: "常磐公園",
  place_kind: "park",
  locality_label: "静岡市葵区",
  verification_status: "verified",
  official_status: "official",
  aliases_json: "常盤公園\u001fTokiwa Park",
  matched_alias_normalized: "常盤公園",
  bbox_west: 138.38,
  bbox_south: 34.97,
  bbox_east: 138.39,
  bbox_north: 34.98,
  boundary_precision: "exact",
  boundary_confidence: 0.97,
  source_type: "municipality_official",
  source_id: "shizuoka:s0000240",
  source_url: "https://www.city.shizuoka.lg.jp/shisetsu/s0000240.html",
  source_confidence: 1,
  source_verification_status: "verified",
  source_last_checked_at: "2026-07-23T00:00:00Z",
};

test("D1 place search preserves canonical identity for orthographic alias", async () => {
  const response = await searchD1PublicPlaces({
    db: databaseWithRows([tokiwa]),
    query: "常盤公園",
  });
  assert.equal(response.results[0]?.canonicalName, "常磐公園");
  assert.equal(response.results[0]?.matchKind, "alias");
  assert.equal(response.privacy, "boundary_bbox_only");
  assert.equal(JSON.stringify(response).includes("center_latitude"), false);
});

test("D1 place children query is recursive-ready and boundary-only", async () => {
  const results = await listD1PublicPlaceChildren({
    db: databaseWithRows([{ ...tokiwa, place_id: "place_tokiwa_zone" }]),
    parentPlaceId: "place_tokiwa",
  });
  assert.equal(results.length, 1);
  assert.deepEqual(results[0]?.boundary.bbox, [138.38, 34.97, 138.39, 34.98]);
});

test("public Place adoption binds one selected source and one exact import artifact", () => {
  assert.equal(tokiwaAdoption.source.sourceDocumentSha256, sha256(canarySeed));
  assert.equal(tokiwaAdoption.importArtifactSha256, sha256(tokiwaImportSql));
  assert.equal(tokiwaAdoption.source.selectedPlaceCount, 1);
  assert.equal(tokiwaAdoption.scope.publicPlaces, 1);
  assert.equal(tokiwaAdoption.scope.records, 0);
  assert.equal(tokiwaAdoption.scope.privateRows, 0);
  const source = JSON.parse(canarySeed.toString("utf8")) as {
    places: Array<{
      placeId: string;
      canonicalName: string;
      aliases: Array<{ value: string }>;
    }>;
  };
  const selected = source.places.filter(
    (place) => place.placeId === tokiwaAdoption.source.selectedPlaceId,
  );
  assert.equal(selected.length, 1);
  assert.equal(selected[0]?.canonicalName, tokiwaAdoption.expectedIdentity.canonicalName);
  assert.deepEqual(
    selected[0]?.aliases.map((alias) => alias.value),
    tokiwaAdoption.expectedIdentity.aliases,
  );
});

test("adopted Place import resolves name and aliases to one canonical safe-bounds result", async () => {
  const { sqlite, db } = realPlaceDatabase();
  try {
    for (const [query, matchKind] of [
      ["常磐公園", "canonical_name"],
      ["常盤公園", "alias"],
      ["Tokiwa Park", "alias"],
      ["plc_e3293ec4bb9288a0", "place_id"],
    ] as const) {
      const response = await searchD1PublicPlaces({ db, query });
      assert.equal(response.state, "complete", query);
      assert.equal(response.results.length, 1, query);
      assert.equal(response.results[0]?.canonicalPlaceId, "plc_e3293ec4bb9288a0", query);
      assert.equal(response.results[0]?.canonicalName, "常磐公園", query);
      assert.equal(response.results[0]?.matchKind, matchKind, query);
      assert.deepEqual(
        response.results[0]?.boundary.bbox,
        [138.3793901, 34.9695006, 138.3812408, 34.970775],
        query,
      );
      assert.equal(JSON.stringify(response).includes("coordinates"), false, query);
      assert.equal(JSON.stringify(response).includes("boundary_geojson"), false, query);
    }
    assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM places").get() as { count: number }).count, 1);
    assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM record_place_memberships").get() as { count: number }).count, 0);
  } finally {
    sqlite.close();
  }
});

test("real Place SQL excludes withdrawn places and invalid or retired boundary sources", async () => {
  const { sqlite, db } = realPlaceDatabase();
  try {
    const search = () => searchD1PublicPlaces({ db, query: "常盤公園" });
    for (const sql of [
      "UPDATE places SET public_profile_status='draft'",
      "UPDATE places SET valid_to='2026-09-01T00:00:00Z'",
      "UPDATE places SET superseded_by_place_id='retired-place'",
      "UPDATE place_boundaries SET validation_state='rejected'",
      "UPDATE place_boundaries SET valid_to='2026-09-01T00:00:00Z'",
      "UPDATE place_source_references SET valid_to='2026-09-01T00:00:00Z' WHERE source_type='osm'",
      "UPDATE place_source_references SET superseded_by_source_reference_id='retired-source' WHERE source_type='osm'",
      "UPDATE place_source_references SET verification_status='rejected' WHERE source_type='osm'",
      "UPDATE place_aliases SET valid_to='2026-09-01T00:00:00Z'",
      "UPDATE place_policies SET place_visibility='private'",
      "UPDATE place_policies SET valid_to='2026-09-01T00:00:00Z'",
    ]) {
      sqlite.exec("SAVEPOINT eligibility_case");
      sqlite.exec(sql);
      assert.equal((await search()).results.length, 0, sql);
      sqlite.exec("ROLLBACK TO eligibility_case; RELEASE eligibility_case");
    }
    assert.equal((await search()).results.length, 1);
    assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    sqlite.close();
  }
});

test("adopted Place import is idempotent and aborts before overwriting a conflicting identity", () => {
  const { sqlite } = realPlaceDatabase();
  try {
    sqlite.exec(tokiwaImportSql);
    const counts = Object.fromEntries([
      "places",
      "place_aliases",
      "place_boundaries",
      "place_source_references",
      "place_policies",
    ].map((table) => [
      table,
      (sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count,
    ]));
    assert.deepEqual(counts, {
      places: 1,
      place_aliases: 2,
      place_boundaries: 1,
      place_source_references: 2,
      place_policies: 1,
    });
    assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    sqlite.close();
  }

  const conflicting = new DatabaseSync(":memory:");
  try {
    conflicting.exec("CREATE TABLE place_memory_entries (entry_id TEXT PRIMARY KEY, cell_id TEXT, updated_at TEXT)");
    conflicting.exec(placeMigrationSql);
    conflicting.prepare(`
      INSERT INTO places (
        place_id, canonical_name, canonical_name_normalized, place_kind,
        public_profile_status, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      "plc_e3293ec4bb9288a0",
      "別の場所",
      "別の場所",
      "park",
      "published",
      "{}",
    );
    assert.throws(() => conflicting.exec(tokiwaImportSql), /CHECK constraint failed/);
    assert.equal(
      (conflicting.prepare("SELECT canonical_name FROM places WHERE place_id = ?").get("plc_e3293ec4bb9288a0") as { canonical_name: string }).canonical_name,
      "別の場所",
    );
    assert.equal(
      (conflicting.prepare("SELECT COUNT(*) AS count FROM place_source_references").get() as { count: number }).count,
      0,
    );
  } finally {
    conflicting.close();
  }
});

test("adopted Place import rejects all nullable expected-row drift under an atomic caller transaction", () => {
  const nullableDriftCases = [
    "UPDATE places SET public_summary=NULL",
    "UPDATE places SET locality_label=NULL",
    "UPDATE place_source_references SET source_url=NULL WHERE source_type='osm'",
    "UPDATE place_boundaries SET bbox_west=NULL",
    "UPDATE place_boundaries SET source_reference_id=NULL",
    "UPDATE place_aliases SET language_code=NULL WHERE alias_kind='multilingual'",
    "UPDATE place_aliases SET source_reference_id=NULL WHERE alias_kind='multilingual'",
  ];

  for (const mutation of nullableDriftCases) {
    const { sqlite } = realPlaceDatabase();
    try {
      sqlite.exec(mutation);
      sqlite.exec("BEGIN");
      assert.throws(() => sqlite.exec(tokiwaImportSql), /CHECK constraint failed/, mutation);
      sqlite.exec("ROLLBACK");
      const guard = sqlite.prepare(`
        SELECT COUNT(*) AS count
        FROM sqlite_master
        WHERE type = 'table' AND name = 'zukan_tokiwa_import_guard_20260905'
      `).get() as { count: number };
      assert.equal(guard.count, 0, `${mutation}: guard must roll back atomically`);
    } finally {
      sqlite.close();
    }
  }
});
