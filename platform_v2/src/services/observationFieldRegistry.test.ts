import assert from "node:assert/strict";
import test from "node:test";
import { __test__ } from "./observationFieldRegistry.js";

test("canonical and legacy product URLs are classified as field stories", () => {
  for (const officialUrl of [
    "https://zukan.earth/ja/fields/example",
    "https://staging.zukan.earth/ja/fields/example",
    "https://ikimon.life/ja/fields/example",
  ]) {
    const links = __test__.normalizeSourceLinks({ officialUrl });
    assert.equal(links.storyUrl, officialUrl);
    assert.equal(links.officialUrl, "");
  }
});

test("lookalike and evil-suffix hosts are never classified as product stories", () => {
  for (const officialUrl of [
    "https://zukan.earth.evil.example/fields/example",
    "https://ikimon.life.evil.example/fields/example",
    "https://zukan.earth@evil.example/fields/example",
  ]) {
    const links = __test__.normalizeSourceLinks({ officialUrl });
    assert.equal(links.storyUrl, "");
    assert.equal(links.officialUrl, officialUrl);
  }
});
