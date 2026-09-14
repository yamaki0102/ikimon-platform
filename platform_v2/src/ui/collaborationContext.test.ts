import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNocosilPublicContextHandoffUrl,
  getPublicContextActionModel,
  normalizeZukanPublicUrl,
  renderPublicContextActions,
} from "./collaborationContext.js";

test("normalizes an eligible canonical ZUKAN URL and strips fragments", () => {
  assert.equal(
    normalizeZukanPublicUrl("https://zukan.earth/ja/places/iwata?lang=JA#private-fragment"),
    "https://zukan.earth/ja/places/iwata?lang=ja",
  );
});

test("rejects unsafe origins, credentials, private views and internal routes", () => {
  for (const value of [
    "http://zukan.earth/ja/places/iwata",
    "https://evil.example/ja/places/iwata",
    "https://user:secret@zukan.earth/ja/places/iwata",
    "https://zukan.earth/ja/records?view=mine",
    "https://zukan.earth/api/v1/records",
    "https://zukan.earth/ja/places/iwata?redirect=https://evil.example",
  ]) assert.equal(normalizeZukanPublicUrl(value), null, value);
});

test("builds a registered NOCOSIL handoff from the public URL only", () => {
  const handoff = buildNocosilPublicContextHandoffUrl(
    "https://zukan.earth/ja/places/iwata",
    "https://nocosil.com",
  );
  assert.equal(handoff, "https://nocosil.com/#/new?source=https%3A%2F%2Fzukan.earth%2Fja%2Fplaces%2Fiwata");
  assert.equal(buildNocosilPublicContextHandoffUrl("https://zukan.earth/ja/places/iwata", "https://evil.example"), null);
});

test("requires current public rights and explicit handoff verification", () => {
  const unavailable = getPublicContextActionModel({
    publicUrl: "https://zukan.earth/ja/places/iwata",
    sourceState: "stale",
    rightsState: "public",
    handoff: { verified: true, registeredOrigin: "https://nocosil.com" },
  });
  assert.equal(unavailable.availability, "unavailable");
  assert.equal(unavailable.canonicalUrl, null);

  const copyOnly = renderPublicContextActions({
    publicUrl: "https://zukan.earth/ja/places/iwata",
    sourceState: "public",
    rightsState: "public",
    handoff: { verified: false, registeredOrigin: "https://nocosil.com" },
  });
  assert.match(copyOnly, /公開情報のリンクをコピー/);
  assert.doesNotMatch(copyOnly, /ノコシルで相談案をつくる/);
  assert.match(copyOnly, /相談案への移動は現在確認できません/);
});

test("escapes public source labels and never emits unsafe URLs", () => {
  const html = renderPublicContextActions({
    publicUrl: "https://zukan.earth/ja/places/iwata",
    title: '<script>alert("x")</script>',
    sourceState: "public",
    rightsState: "public",
    handoff: { verified: true, registeredOrigin: "https://nocosil.com" },
  });
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /data-public-url="https:\/\/zukan\.earth\/ja\/places\/iwata"/);
});
