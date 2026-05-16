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

test("landing public feed keeps enough records for the content wall", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "landingSnapshot.ts"), "utf8");
  const feedAssembly = source.slice(
    source.indexOf("const selectedFeed"),
    source.indexOf("const combined"),
  );

  assert.match(feedAssembly, /const publicFeedPool = userId/);
  assert.match(feedAssembly, /\.\.\.publicFeedAll\.filter\(\(obs\) => obs\.observerUserId !== userId\)/);
  assert.match(feedAssembly, /const publicFeed = publicFeedPool\.slice\(0, 36\);/);
  assert.match(feedAssembly, /const storyFeed = selectedFeed\.length > 0 \? selectedFeed : publicFeed;/);
  assert.doesNotMatch(feedAssembly, /const publicFeed = selectedFeed\.length/);
});

test("landing nearby shelf uses named registered fields instead of municipality cells", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "landingSnapshot.ts"), "utf8");
  const nearbyQuery = source.slice(
    source.indexOf("const LANDING_NEARBY_FIELD_ACTIVITY_SQL"),
    source.indexOf("const AMBIENT_VISIT_FIXTURE_EXCLUSION_SQL"),
  );

  assert.match(nearbyQuery, /from observation_fields f/);
  assert.match(nearbyQuery, /resolved_field_ids/);
  assert.match(nearbyQuery, /source_payload->>'field_id'/);
  assert.match(nearbyQuery, /admin_municipality/);
  assert.match(nearbyQuery, /lower\(btrim\(f\.name\)\) <> lower\(btrim\(coalesce\(f\.city/);
  assert.doesNotMatch(nearbyQuery, /mapPreviewCells/);
});
