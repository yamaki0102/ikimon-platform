import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Wrangler uses the final public presentation entry", async () => {
  const config = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.match(config, /"main"\s*:\s*"src\/publicPresentationEntry\.ts"/u);
  assert.doesNotMatch(config, /"main"\s*:\s*"src\/index\.ts"/u);
});
