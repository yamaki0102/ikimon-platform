import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("viewer own landing feed excludes staging smoke fixtures", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "landingSnapshot.ts"), "utf8");
  const ownFeedQuery = source.slice(
    source.indexOf("// Viewer own feed"),
    source.indexOf("// Viewer own identifications"),
  );

  assert.match(ownFeedQuery, /PUBLIC_READ_FIXTURE_EXCLUSION_SQL/);
  assert.match(ownFeedQuery, /PUBLIC_READ_SYNTHETIC_EXCLUSION_SQL/);
  assert.match(source, /smoke\[-_\]\?regression/);
});
