import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("production smoke cleanup monitor isolates observation residue and deletes smoke events", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "scripts", "monitorProductionSmokeCleanup.ts"), "utf8");
  const wrapper = await readFile(path.join(process.cwd(), "..", "ops", "cron", "run_production_media_smoke.sh"), "utf8");

  assert.match(source, /prod-media-smoke/);
  assert.match(source, /smoke-ui/);
  assert.match(source, /public_visibility = 'hidden'/);
  assert.match(source, /quality_review_status = 'archived'/);
  assert.match(source, /production_smoke_record/);
  assert.match(source, /moderation_status = 'hidden_by_admin'/);
  assert.match(source, /delete from observation_event_sessions/);
  assert.match(source, /production_smoke_residue_remaining/);

  assert.match(wrapper, /FIXTURE_PREFIX="prod-media-smoke-\$\(date -u \+%Y%m%d%H%M%S\)"/);
  assert.match(wrapper, /smokeProductionMediaUpload[\s\S]*--fixture-prefix="\$\{FIXTURE_PREFIX\}"/);
  assert.match(wrapper, /monitorProductionSmokeCleanup[\s\S]*--fixture-prefix="\$\{FIXTURE_PREFIX\}"/);
});
