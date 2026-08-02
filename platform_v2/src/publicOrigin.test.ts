import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalPublicOriginForHost,
  canonicalPublicOriginFromHeaders,
  isSafeLegacyPagePath,
  requestOriginFromHeaders,
  resolveConfiguredPublicOrigin,
  ZUKAN_PUBLIC_ORIGIN_CONTRACT,
} from "./publicOrigin.js";

test("public host contract maps legacy and new hosts to the correct canonical origin", () => {
  assert.equal(canonicalPublicOriginForHost("ikimon.life"), "https://zukan.earth");
  assert.equal(canonicalPublicOriginForHost("zukan.earth"), "https://zukan.earth");
  assert.equal(canonicalPublicOriginForHost("staging.ikimon.life"), "https://staging.zukan.earth");
  assert.equal(canonicalPublicOriginForHost("staging.zukan.earth"), "https://staging.zukan.earth");
  assert.equal(
    canonicalPublicOriginFromHeaders({ host: "staging.ikimon.life", "x-forwarded-proto": "http" }),
    "https://staging.zukan.earth",
  );
  assert.equal(
    requestOriginFromHeaders({ host: "staging.ikimon.life", "x-forwarded-proto": "http" }),
    "https://staging.ikimon.life",
  );
  assert.equal(resolveConfiguredPublicOrigin("https://zukan.earth/"), "https://zukan.earth");
  assert.equal(resolveConfiguredPublicOrigin("https://attacker.example"), "https://ikimon.life");
  assert.deepEqual(ZUKAN_PUBLIC_ORIGIN_CONTRACT.productionHosts, ["zukan.earth", "ikimon.life", "www.ikimon.life"]);
});

test("legacy redirect contract accepts only navigable page paths", () => {
  assert.equal(isSafeLegacyPagePath("/ja/records"), true);
  assert.equal(isSafeLegacyPagePath("/community/events"), true);
  for (const path of [
    "/api/v1/auth/session",
    "/ja/login",
    "/ja/register",
    "/media/file.jpg",
    "/assets/brand/zukan-ogp-default.png",
    "/callback/provider",
    "/webhook/stream",
    "/ops/data-health",
    "/robots.txt",
    "/manifest.webmanifest",
    "/thumb/lg/record/photo.jpg",
    "/legacy.php",
  ]) {
    assert.equal(isSafeLegacyPagePath(path), false, path);
  }
});
