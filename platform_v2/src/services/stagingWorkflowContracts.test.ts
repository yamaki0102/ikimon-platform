import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("deploy-staging can capture authenticated map owner history evidence on demand", async () => {
  const [workflowSource, specSource] = await Promise.all([
    readFile(new URL("../../../.github/workflows/deploy-staging.yml", import.meta.url), "utf8"),
    readFile(new URL("../../e2e/authenticated-map-own-observations.staging.spec.ts", import.meta.url), "utf8"),
  ]);

  assert.match(workflowSource, /capture_authenticated_map_own_observations/);
  assert.match(workflowSource, /Capture Authenticated Map Own Observation Evidence/);
  assert.match(workflowSource, /MAP_OWN_OBSERVATIONS_CAPTURE_DIR/);
  assert.match(workflowSource, /e2e\/authenticated-map-own-observations\.staging\.spec\.ts/);
  assert.match(workflowSource, /authenticated-map-own-observations/);

  assert.match(specSource, /seedRegressionFixtures/);
  assert.match(specSource, /issueSessionCookie/);
  assert.match(specSource, /addSessionCookie/);
  assert.match(specSource, /\/api\/v1\/me\/map-observations/);
  assert.match(specSource, /otherFixture/);
  assert.match(specSource, /me-own-observation-marker\.has-photo/);
});

test("authenticated map owner history evidence stays out of default full non-map shards", async () => {
  const shardPlannerSource = await readFile(
    new URL("../../scripts/planStagingNonMapShards.mjs", import.meta.url),
    "utf8",
  );

  assert.match(shardPlannerSource, /EXCLUDED_SPECS[\s\S]*e2e\/authenticated-map-own-observations\.staging\.spec\.ts/);
});
