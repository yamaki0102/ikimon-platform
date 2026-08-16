import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativeUrl: string): Promise<string> {
  return readFile(new URL(relativeUrl, import.meta.url), "utf8");
}

test("production candidate upload creates an unserved Worker Version", async () => {
  const script = await source("../../../scripts/run_cloudflare_production_worker_candidate.sh");
  assert.match(script, /wrangler versions upload --env production/);
  assert.match(script, /production_traffic_mutation:\s*false/);
  assert.match(script, /customer_traffic_percent:\s*0/);
  assert.doesNotMatch(script, /wrangler deploy --env production/);
  assert.doesNotMatch(script, /versions deploy/);
});

test("production promotion discovers rollback version and automatically restores it on failed readback", async () => {
  const script = await source("../../../scripts/run_cloudflare_production_worker_promote.sh");
  assert.match(script, /deployments list --name "\$\{WORKER_NAME\}" --json/);
  assert.match(script, /ROLLBACK_VERSION_ID/);
  assert.match(script, /versions view "\$\{IKIMON_PRODUCTION_CANDIDATE_VERSION_ID\}"/);
  assert.match(script, /production_candidate_source_mismatch/);
  assert.match(script, /versions deploy "\$\{IKIMON_PRODUCTION_CANDIDATE_VERSION_ID\}"/);
  assert.match(script, /versions deploy "\$\{ROLLBACK_VERSION_ID\}"/);
  assert.match(script, /automatic_rollback_verified/);
  assert.match(script, /api\/v1\/runtime\/version/);
  assert.match(script, /APPROVE_IKIMON_CF_PRODUCTION_WORKER_DEPLOY/);
});
