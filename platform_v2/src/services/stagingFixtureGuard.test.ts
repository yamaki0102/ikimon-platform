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

test("public event exclusion catches QA flags, PR event codes, and leaked production rally fixtures", () => {
  const sql = buildStagingFixtureExclusionSql({
    eventCodeColumn: "event_code",
    titleColumn: "title",
    configColumn: "config::text",
  });

  assert.match(sql, /pr\[0-9\]\+/i);
  assert.match(sql, /prod\(uction\)\?/i);
  assert.match(sql, /qa_fixture/);
  assert.match(sql, /public_listed/);
  assert.match(sql, /public_list_visibility/);
});
