import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

async function withQueryUserId(run: () => Promise<void>): Promise<void> {
  const previous = process.env.ALLOW_QUERY_USER_ID;
  process.env.ALLOW_QUERY_USER_ID = "1";
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env.ALLOW_QUERY_USER_ID;
    else process.env.ALLOW_QUERY_USER_ID = previous;
  }
}

test("records saved arrival does not reflect an unsafe saved id", async () => {
  await withQueryUserId(async () => {
    const app = buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/records?view=mine&userId=story-user&source=record_saved&saved=%3Cscript%3Ealert(1)%3C%2Fscript%3E&lang=ja",
        headers: { accept: "text/html" },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(response.headers["cache-control"], "private, no-store");
      assert.doesNotMatch(response.body, /<script>alert\(1\)<\/script>/);
      assert.doesNotMatch(response.body, /data-saved-record-id="[^"]*script/i);
      assert.doesNotMatch(response.body, /data-record-highlight="true"/);
    } finally {
      await app.close();
    }
  });
});
