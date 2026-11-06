import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ZUKAN staging and production Wrangler environments disable version preview URLs", async () => {
  const config = JSON.parse(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  assert.equal(config.env.staging.preview_urls, false);
  assert.equal(config.env.production.preview_urls, false);
});
