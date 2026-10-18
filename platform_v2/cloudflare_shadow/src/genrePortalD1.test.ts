import assert from "node:assert/strict";
import test from "node:test";
import { createD1PublicParticipationSource } from "./genrePortalD1";

type FakeRow = {
  participation_id: string;
  participation_kind: "event" | "site" | "record";
  payload_json: string;
};

function fakeDatabase(rows: FakeRow[], captureSql: (sql: string) => void) {
  return {
    prepare(sql: string) {
      captureSql(sql);
      return {
        bind(...values: string[]) {
          assert.deepEqual(values, []);
          return { async all<T>() { return { results: rows as T[] }; } };
        },
      };
    },
  };
}

test("D1 source reads the Z1 payload schema, filters by exact slugs, and skips malformed payloads", async () => {
  let sql = "";
  const rows: FakeRow[] = [
    {
      participation_id: "event-1",
      participation_kind: "event",
      payload_json: JSON.stringify({ genre: "nature", region: "shizuoka", title: "森の観察会", description: "川辺で観察", url: "/events/1", startsAt: "2027-04-10T09:00:00+09:00", locationName: "都田の森", publisherName: "森の会" }),
    },
    { participation_id: "record-1", participation_kind: "record", payload_json: JSON.stringify({ genre: "nature-study", region: "shizuoka", title: "別ジャンル" }) },
    { participation_id: "site-1", participation_kind: "site", payload_json: JSON.stringify({ genre: "nature", region: "nagano", title: "別地域" }) },
    { participation_id: "broken", participation_kind: "record", payload_json: "{not-json" },
  ];
  const source = createD1PublicParticipationSource(fakeDatabase(rows, (value) => { sql = value; }));

  assert.deepEqual(await source.listPublic({ genre: "nature", region: "shizuoka" }), [{
    id: "event-1",
    kind: "event",
    genre: "nature",
    region: "shizuoka",
    name: "森の観察会",
    description: "川辺で観察",
    url: "/events/1",
    startDate: "2027-04-10T09:00:00+09:00",
    location: "都田の森",
    publisher: "森の会",
  }]);
  assert.match(sql, /WHERE withdrawn_at IS NULL/);
  assert.match(sql, /ORDER BY published_at DESC/);
  assert.doesNotMatch(sql, /genre_slug|region_slug|publication_status|starts_at/);
});

test("D1 source returns an empty list only when the Z1 table is missing", async () => {
  const missing = createD1PublicParticipationSource({
    prepare() { throw new Error("D1_ERROR: no such table: zukan_public_participations: SQLITE_ERROR"); },
  });
  assert.deepEqual(await missing.listPublic({}), []);

  const failure = new Error("D1_ERROR: database is unavailable");
  const unavailable = createD1PublicParticipationSource({ prepare() { throw failure; } });
  await assert.rejects(unavailable.listPublic({}), (error) => error === failure);
});
