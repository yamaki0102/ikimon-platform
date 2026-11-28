import assert from "node:assert/strict";
import test from "node:test";
import { extractJsonLd } from "./extractJsonLd";

const html = `<html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
 {"@type":"WebSite","name":"x"},
 {"@type":"Event","name":" 野鳥観察会 ","startDate":"2026-12-05T09:30:00+09:00","endDate":"2026-12-05T12:00:00+09:00",
  "url":"/events/1","description":"長い説明は保存しない","image":"https://x/a.jpg",
  "location":{"@type":"Place","name":"佐鳴湖公園","address":{"@type":"PostalAddress","addressRegion":"静岡県","addressLocality":"浜松市","streetAddress":"1-1"},"geo":{"latitude":"34.7","longitude":137.7}},
  "organizer":{"@type":"Organization","name":"浜松市","email":"a@b.c","telephone":"053-000"}}]}</script>
<script type="application/ld+json">[{"@type":"EducationEvent","name":"星空教室","startDate":"2026-12-10","location":"科学館","organizer":[{"name":"財団"}]},
 {"@type":"Event","name":"入れ子","startDate":"2026-12-11","subEvent":{"@type":"Event","name":"子","startDate":"2026-12-11T10:00"}}]</script>
<script type="application/ld+json">{broken</script>
</head></html>`;

test("JSON-LD events are flattened to facts only", async () => {
  const facts = await extractJsonLd(html, "E1", "https://example.jp/list", "2026-11-28T00:00:00.000Z");
  assert.equal(facts.length, 4);
  const a = facts[0]!;
  assert.equal(a.title, "野鳥観察会");
  assert.equal(a.url, "https://example.jp/events/1");
  assert.equal(a.external_ref, "https://example.jp/events/1");
  assert.equal(a.starts_at, "2026-12-05T00:30:00.000Z");
  assert.equal(a.ends_at, "2026-12-05T03:00:00.000Z");
  assert.equal(a.all_day, false);
  assert.equal(a.venue_name, "佐鳴湖公園");
  assert.equal(a.venue_address, "静岡県浜松市1-1");
  assert.equal(a.lat, 34.7);
  assert.equal(a.lng, 137.7);
  assert.equal(a.organizer_name, "浜松市");
  const json = JSON.stringify(facts);
  assert.ok(!json.includes("a@b.c") && !json.includes("053-000") && !json.includes("長い説明"));
  const b = facts[1]!;
  assert.equal(b.all_day, true);
  assert.equal(b.starts_at, "2026-12-10");
  assert.equal(b.venue_name, "科学館");
  assert.equal(b.organizer_name, "財団");
  assert.equal(facts[3]!.starts_at, "2026-12-11T10:00:00+09:00");
});

test("no events yields empty list", async () => {
  assert.deepEqual(await extractJsonLd("<html></html>", "E1", "https://example.jp/", "t"), []);
});
