import assert from "node:assert/strict";
import test from "node:test";
import {
  isCanonicalOrLegacyHttpsUrl,
  isCanonicalOrLegacyProductionHost,
  isCanonicalOrLegacyPublicHost,
} from "./zukanPublicHost.js";

test("public host allowlist accepts canonical ZUKAN and legacy rollback hosts", () => {
  for (const hostname of [
    "zukan.earth",
    "staging.zukan.earth",
    "media.zukan.earth",
    "ikimon.life",
    "www.ikimon.life",
    "media.ikimon.life",
  ]) {
    assert.equal(isCanonicalOrLegacyPublicHost(hostname), true, hostname);
  }
});

test("public host allowlist rejects evil suffixes and lookalikes", () => {
  for (const hostname of [
    "zukan.earth.evil.example",
    "ikimon.life.evil.example",
    "evilzukan.earth",
    "evilikimon.life",
    "zukan-earth.example",
  ]) {
    assert.equal(isCanonicalOrLegacyPublicHost(hostname), false, hostname);
  }
});

test("public URL allowlist requires HTTPS and rejects userinfo host confusion", () => {
  assert.equal(isCanonicalOrLegacyHttpsUrl("https://zukan.earth/derived/photo.webp"), true);
  assert.equal(isCanonicalOrLegacyHttpsUrl("https://media.ikimon.life/uploads/photo.webp"), true);
  assert.equal(isCanonicalOrLegacyHttpsUrl("http://zukan.earth/derived/photo.webp"), false);
  assert.equal(isCanonicalOrLegacyHttpsUrl("https://zukan.earth@evil.example/photo.webp"), false);
  assert.equal(isCanonicalOrLegacyHttpsUrl("https://zukan.earth.evil.example/photo.webp"), false);
});

test("production host allowlist is exact and keeps only canonical plus rollback hosts", () => {
  for (const hostname of ["zukan.earth", "ikimon.life", "www.ikimon.life"]) {
    assert.equal(isCanonicalOrLegacyProductionHost(hostname), true, hostname);
  }
  for (const hostname of [
    "staging.zukan.earth",
    "www.zukan.earth",
    "media.ikimon.life",
    "zukan.earth.evil.example",
    "ikimon.life.evil.example",
  ]) {
    assert.equal(isCanonicalOrLegacyProductionHost(hostname), false, hostname);
  }
});
