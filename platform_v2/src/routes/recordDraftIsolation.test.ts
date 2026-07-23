import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readRouteSource = readFileSync(new URL("./read.ts", import.meta.url), "utf8");
const shellSource = readFileSync(new URL("../ui/siteShell.ts", import.meta.url), "utf8");

test("record recovery partitions drafts by signed-in owner or guest continuation token", () => {
  assert.match(readRouteSource, /'latest:user:' \+ userId/);
  assert.match(readRouteSource, /'latest:guest:' \+ continuationToken/);
  assert.match(readRouteSource, /candidate\.ownerKey === context\.ownerKey/);
  assert.match(readRouteSource, /candidate\.continuationToken === context\.continuationToken/);
  assert.match(readRouteSource, /store\.put\(value, context\.claimDraftKey\)/);
  assert.match(readRouteSource, /store\.delete\(context\.draftKey\)/);
  assert.doesNotMatch(readRouteSource, /const RECORD_DRAFT_KEY = 'latest';/);
});

test("record recovery removes a consumed continuation token from the URL", () => {
  assert.match(readRouteSource, /url\.searchParams\.delete\('draft_token'\)/);
  assert.match(readRouteSource, /sessionStorage\.removeItem\(RECORD_DRAFT_GUEST_TOKEN_KEY\)/);
});

test("guest draft continuation tokens require browser cryptographic randomness", () => {
  const routeTokenSource = readRouteSource.slice(
    readRouteSource.indexOf("const secureRecordDraftToken"),
    readRouteSource.indexOf("const currentRecordSessionUserId"),
  );
  const shellTokenSource = shellSource.slice(
    shellSource.indexOf("const secureGuestDraftToken"),
    shellSource.indexOf("const saveDraft"),
  );

  for (const source of [routeTokenSource, shellTokenSource]) {
    assert.match(source, /crypto\.getRandomValues/);
    assert.match(source, /crypto\.randomUUID/);
    assert.doesNotMatch(source, /Math\.random|Date\.now/);
  }
});
