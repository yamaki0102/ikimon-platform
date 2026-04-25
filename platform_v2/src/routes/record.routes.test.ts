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

test("record route exposes quick revisit fields in staging mode", async () => {
  await withEnv(
    {
      ALLOW_QUERY_USER_ID: "1",
    },
    async () => {
      const app = buildApp();
      try {
        const response = await app.inject({
          method: "GET",
          url: "/record?userId=staging-user",
        });

        assert.equal(response.statusCode, 200);
        assert.match(response.body, /あとで見返すためのメモ/);
        assert.match(response.body, /まだ分からないまま残す/);
        assert.match(response.body, /今日は見なかったメモを残す/);
        assert.match(response.body, /次に探すもの/);
      } finally {
        await app.close();
      }
    },
  );
});

test("record route gives unauthenticated visitors a start guide instead of a raw 401", async () => {
  await withEnv(
    {
      ALLOW_QUERY_USER_ID: undefined,
    },
    async () => {
      const app = buildApp();
      try {
        const response = await app.inject({
          method: "GET",
          url: "/record?lang=ja",
          headers: { accept: "text/html" },
        });

        assert.equal(response.statusCode, 200);
        assert.match(response.body, /記録を始める準備/);
        assert.match(response.body, /名前が分からなくても、記録は始められる/);
        assert.doesNotMatch(response.body, /Session required/);
      } finally {
        await app.close();
      }
    },
  );
});
