import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { resolveLandingDisplayName } from "./landingSnapshot.js";

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

test("records workbench own feed uses cursor pagination by visit", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "landingSnapshot.ts"), "utf8");
  const pageSource = source.slice(
    source.indexOf("const LANDING_FEED_PAGE_DEFAULT_LIMIT"),
    source.indexOf("export async function getLandingSnapshot"),
  );
  const pageFunctionSource = source.slice(
    source.indexOf("export async function getLandingOwnFeedPage"),
    source.indexOf("export async function getLandingSnapshot"),
  );

  assert.match(pageSource, /LANDING_FEED_PAGE_DEFAULT_LIMIT = 36/);
  assert.match(pageFunctionSource, /select v\.visit_id::text as visit_id/);
  assert.match(pageFunctionSource, /and \(v\.observed_at, v\.visit_id\) < \(\$3::timestamptz, \$4::text\)/);
  assert.match(pageFunctionSource, /o\.visit_id = any\(\$2::text\[\]\)/);
  assert.doesNotMatch(pageFunctionSource, /visit_id\) < \(\$3::timestamptz, \$4::uuid\)/);
  assert.doesNotMatch(pageFunctionSource, /o\.visit_id = any\(\$2::uuid\[\]\)/);
  assert.doesNotMatch(pageFunctionSource, /limit 72/);
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

test("landing public feed ranks by observer so one active poster cannot monopolize everyone records", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "landingSnapshot.ts"), "utf8");
  const publicFeedQuery = source.slice(
    source.indexOf("const LANDING_PUBLIC_FEED_SQL"),
    source.indexOf("const LANDING_NEARBY_FIELD_ACTIVITY_SQL"),
  );

  assert.match(publicFeedQuery, /other_public_feed as materialized/);
  assert.match(publicFeedQuery, /\(\$1::text is null or v\.user_id is distinct from \$1::text\)/);
  assert.match(publicFeedQuery, /viewer_public_feed as materialized/);
  assert.match(publicFeedQuery, /v\.user_id = \$1::text/);
  assert.match(publicFeedQuery, /select other_public_feed\.\*, false as viewer_owned/);
  assert.match(publicFeedQuery, /row_number\(\) over \(/);
  assert.match(publicFeedQuery, /partition by coalesce\(/);
  assert.match(publicFeedQuery, /nullif\(observer_user_id::text, ''\)/);
  assert.match(publicFeedQuery, /where observer_rank <= 12/);
  assert.match(publicFeedQuery, /viewer_owned asc/);
  assert.match(publicFeedQuery, /case when observer_rank = 1 then 0 else 1 end/);
  assert.match(publicFeedQuery, /limit 180/);
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

test("landing display name does not promote non-taxon scene labels", () => {
  assert.equal(resolveLandingDisplayName("芝生", null, "芝生"), "同定待ち");
  assert.equal(resolveLandingDisplayName(null, null, "イネ科"), "イネ科");
});
