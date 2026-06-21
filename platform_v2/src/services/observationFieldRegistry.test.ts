import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { __test__ } from "./observationFieldRegistry.js";

const source = readFileSync(new URL("./observationFieldRegistry.ts", import.meta.url), "utf8");

test("field stats exclude staging fixture sessions from public area context", () => {
  const guard = __test__.FIELD_STATS_SESSION_FIXTURE_EXCLUSION_SQL;

  assert.match(guard, /s\.organizer_user_id/);
  assert.match(guard, /s\.session_id/);
  assert.match(guard, /s\.event_code/);
  assert.match(guard, /s\.title/);
  assert.match(guard, /s\.config::text/);
  assert.match(guard, /rally\[-_\]smoke/);

  assert.match(source, /FROM observation_event_sessions s\s+WHERE s\.field_id = \$1\s+AND \$\{FIELD_STATS_SESSION_FIXTURE_EXCLUSION_SQL\}/);
  assert.match(source, /JOIN observation_event_sessions s ON s\.session_id = e\.session_id[\s\S]*AND \$\{FIELD_STATS_SESSION_FIXTURE_EXCLUSION_SQL\}[\s\S]*AND e\.type = 'observation_added'/);
  assert.match(source, /JOIN observation_event_sessions s ON s\.session_id = a\.session_id[\s\S]*AND \$\{FIELD_STATS_SESSION_FIXTURE_EXCLUSION_SQL\}/);
  assert.match(source, /JOIN observation_event_sessions s ON s\.session_id = p\.session_id[\s\S]*AND \$\{FIELD_STATS_SESSION_FIXTURE_EXCLUSION_SQL\}/);
});
