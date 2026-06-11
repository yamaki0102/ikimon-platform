import test from "node:test";
import assert from "node:assert/strict";
import { buildStagingFixtureExclusionSql } from "./stagingFixtureGuard.js";

test("staging fixture SQL casts non-text identifiers before regex matching", () => {
  const sql = buildStagingFixtureExclusionSql({
    userIdColumn: "organizer_user_id",
    visitIdColumn: "session_id",
    configColumn: "config::text",
  });

  assert.match(sql, /coalesce\(\(session_id\)::text, ''\) ~/);
  assert.match(sql, /coalesce\(\(organizer_user_id\)::text, ''\) ~/);
  assert.match(sql, /coalesce\(\(config::text\)::text, ''\) ~\*/);
});
