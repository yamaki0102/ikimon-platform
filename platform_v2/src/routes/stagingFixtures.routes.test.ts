import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildApp } from "../app.js";

async function withEnv(
  overrides: Record<string, string | undefined>,
  run: () => Promise<void>,
): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    await run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("staging fixture routes enforce staging gate and privileged key", async () => {
  await withEnv(
    {
      V2_PRIVILEGED_WRITE_API_KEY: "test-write-key",
      ALLOW_QUERY_USER_ID: undefined,
    },
    async () => {
      const app = buildApp();
      try {
        const disabledSeed = await app.inject({
          method: "POST",
          url: "/api/v1/ops/staging/fixtures/seed-regression",
          headers: {
            "x-ikimon-write-key": "test-write-key",
          },
          payload: {
            fixturePrefix: "notes-map-regression-test",
          },
        });
        assert.equal(disabledSeed.statusCode, 404);
        assert.equal(disabledSeed.json().error, "staging_regression_seed_disabled");

        const disabledRallySeed = await app.inject({
          method: "POST",
          url: "/api/v1/ops/staging/fixtures/seed-rally",
          headers: {
            "x-ikimon-write-key": "test-write-key",
          },
          payload: {
            fixturePrefix: "rally-smoke-test",
          },
        });
        assert.equal(disabledRallySeed.statusCode, 404);
        assert.equal(disabledRallySeed.json().error, "staging_rally_seed_disabled");

        const disabledCleanup = await app.inject({
          method: "POST",
          url: "/api/v1/ops/staging/fixtures/cleanup",
          headers: {
            "x-ikimon-write-key": "test-write-key",
          },
          payload: {
            fixturePrefix: "notes-map-regression-test",
          },
        });
        assert.equal(disabledCleanup.statusCode, 404);
        assert.equal(disabledCleanup.json().error, "staging_fixture_cleanup_disabled");
      } finally {
        await app.close();
      }
    },
  );

  await withEnv(
    {
      V2_PRIVILEGED_WRITE_API_KEY: "test-write-key",
      ALLOW_QUERY_USER_ID: "1",
    },
    async () => {
      const app = buildApp();
      try {
        const missingKeySeed = await app.inject({
          method: "POST",
          url: "/api/v1/ops/staging/fixtures/seed-regression",
          payload: {
            fixturePrefix: "notes-map-regression-test",
          },
        });
        assert.equal(missingKeySeed.statusCode, 403);
        assert.equal(missingKeySeed.json().error, "forbidden_privileged_write");

        const missingKeyRallySeed = await app.inject({
          method: "POST",
          url: "/api/v1/ops/staging/fixtures/seed-rally",
          payload: {
            fixturePrefix: "rally-smoke-test",
          },
        });
        assert.equal(missingKeyRallySeed.statusCode, 403);
        assert.equal(missingKeyRallySeed.json().error, "forbidden_privileged_write");

        const missingKeyCleanup = await app.inject({
          method: "POST",
          url: "/api/v1/ops/staging/fixtures/cleanup",
          payload: {
            fixturePrefix: "notes-map-regression-test",
          },
        });
        assert.equal(missingKeyCleanup.statusCode, 403);
        assert.equal(missingKeyCleanup.json().error, "forbidden_privileged_write");
      } finally {
        await app.close();
      }
    },
  );
});

test("staging fixture routes refresh the public map snapshot after seed and cleanup", async () => {
  const source = await readFile(new URL("./write.ts", import.meta.url), "utf8");

  assert.match(source, /refreshPublicMapSnapshot/);
  assert.match(source, /refreshedBy: "staging-fixture:seed-regression"/);
  assert.match(source, /refreshedBy: "staging-fixture:cleanup"/);
  assert.match(source, /if \(!cleanup\.dryRun\)/);
});

test("staging map regression fixtures stay public-map safe while smoke remains excluded", async () => {
  const source = await readFile(new URL("../services/stagingRegressionFixtures.ts", import.meta.url), "utf8");

  assert.match(source, /publicUrl: "\/assets\/regression\/vertical-region-public\.svg"/);
  assert.doesNotMatch(source, /publicUrl: "\/assets\/regression\/vertical-region-fixture\.svg"/);
  assert.match(source, /const storageBase = publicMapFixture \? "uploads\/regression-public" : "uploads\/staging-regression"/);
  assert.doesNotMatch(source, /data_quality[^]*'regression_fixture'/);
  assert.match(source, /'\["qa_public"\]'::jsonb/);
  assert.match(source, /"manual_companion_a"/);
  assert.match(source, /"manual_companion_b"/);
  assert.match(source, /"historical_companion_a"/);
  assert.match(source, /"historical_companion_b"/);
  assert.match(source, /sourcePayload: \{ source: "smoke_regression_fixture" \}/);
});
