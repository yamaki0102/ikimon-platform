import assert from "node:assert/strict";
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
