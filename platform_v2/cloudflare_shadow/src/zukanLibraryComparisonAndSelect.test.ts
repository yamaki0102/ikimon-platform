import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import {
  computeYearAgoWindow,
  findYearAgoSamePlaceObservations,
  renderZukanLibraryYearAgoAndSelectPage,
} from "./zukanLibraryComparisonAndSelect";

function sqliteObsDb(sqlite: DatabaseSync): Env["OBS_DB"] {
  return {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          values = args;
          return stmt;
        },
        async all<T>() {
          return { results: sqlite.prepare(query).all(...(values as never[])) as T[] };
        },
      };
      return stmt as unknown as ReturnType<Env["OBS_DB"]["prepare"]>;
    },
  } as unknown as Env["OBS_DB"];
}

test("findYearAgoSamePlaceObservations returns only owner's observations at the same place ~1 year ago", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(`
    CREATE TABLE observations (observation_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, taxon_label TEXT, observed_at TEXT NOT NULL);
    CREATE TABLE civic_observation_contexts (visit_id TEXT PRIMARY KEY, field_id TEXT NOT NULL);
    CREATE TABLE places (place_id TEXT PRIMARY KEY, canonical_name TEXT NOT NULL);
  `);
  sqlite.prepare("INSERT INTO places (place_id, canonical_name) VALUES (?, ?)").run("place-sanaru", "佐鳴湖公園");

  const refDate = new Date("2026-11-25T10:00:00Z");
  const { startIso } = computeYearAgoWindow(refDate);
  const targetYearAgo = new Date(new Date(startIso).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

  // Owner's observation 1 year ago at place-sanaru -> included
  sqlite.prepare("INSERT INTO observations VALUES (?, ?, ?, ?)").run("obs-mine-last-year", "u-1", "アオサギ", targetYearAgo);
  sqlite.prepare("INSERT INTO civic_observation_contexts VALUES (?, ?)").run("obs-mine-last-year", "place-sanaru");

  // Other user's observation 1 year ago at place-sanaru -> excluded
  sqlite.prepare("INSERT INTO observations VALUES (?, ?, ?, ?)").run("obs-other-last-year", "u-2", "カワセミ", targetYearAgo);
  sqlite.prepare("INSERT INTO civic_observation_contexts VALUES (?, ?)").run("obs-other-last-year", "place-sanaru");

  // Owner's observation today -> excluded
  sqlite.prepare("INSERT INTO observations VALUES (?, ?, ?, ?)").run("obs-mine-today", "u-1", "スズメ", refDate.toISOString());
  sqlite.prepare("INSERT INTO civic_observation_contexts VALUES (?, ?)").run("obs-mine-today", "place-sanaru");

  const db = sqliteObsDb(sqlite);
  const items = await findYearAgoSamePlaceObservations(db, {
    userId: "u-1",
    placeId: "place-sanaru",
    referenceDate: refDate,
  });

  assert.equal(items.length, 1);
  assert.equal(items[0]?.observationId, "obs-mine-last-year");
  assert.equal(items[0]?.title, "アオサギ");
  assert.equal(items[0]?.placeName, "佐鳴湖公園");
});

test("B8/B9 library year-ago card and multi-select render check + count without dimming unselected cards", () => {
  const html = renderZukanLibraryYearAgoAndSelectPage({
    lang: "ja",
    placeName: "佐鳴湖公園",
    yearAgoItems: [
      { observationId: "obs-1", title: "アオサギ", observedAt: "2025-11-25T10:00:00Z", placeId: "place-sanaru", placeName: "佐鳴湖公園", photoUrl: null },
    ],
    items: [
      { observationId: "obs-2", title: "カワセミ", observedAt: "2026-11-25T10:00:00Z", photoUrl: null },
    ],
  });

  assert.match(html, /data-library-year-ago-card="1"/);
  assert.match(html, /1年前のこの場所（佐鳴湖公園）/);
  assert.match(html, /data-library-multiselect="1"/);
  assert.match(html, /data-multiselect-count="0">0件選択中/);
  assert.match(html, /\.zb-item\{[^}]*opacity:1/);
});
