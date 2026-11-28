import assert from "node:assert/strict";
import test from "node:test";
import { extractRss } from "./extractRss";

const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>feed</title>
<item><title><![CDATA[里山の生きもの観察会]]></title><link>https://www.kokuchpro.com/event/abc/</link><guid>kp-abc</guid>
<pubDate>Mon, 01 Dec 2026 00:00:00 +0900</pubDate>
<description><![CDATA[<p>開催日時：2026/12/20(日) 10:00 ～ 12:30</p><p>開催場所：浜松市 ○○公園</p><p>主催者：自然の会</p><p>とても長い本文です。</p>]]></description></item>
<item><title>日付なし</title><link>https://www.kokuchpro.com/event/none/</link><description>本文だけ</description></item>
<item><title>終日</title><link>https://www.kokuchpro.com/event/day/</link><description>日時：2026年12月24日 場所：どこか</description></item>
</channel></rss>`;

const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom行事</title><link href="https://ex.jp/a"/><id>urn:a</id>
<summary>開催日時：2027-01-05 13:00</summary></entry></feed>`;

test("RSS items keep title/link/guid and date/venue/organizer, drop the body", async () => {
  const facts = await extractRss(xml, "E4", "https://www.kokuchpro.com/s/q.rss", "2026-11-28T00:00:00.000Z");
  assert.equal(facts.length, 2);
  const a = facts[0]!;
  assert.equal(a.title, "里山の生きもの観察会");
  assert.equal(a.external_ref, "kp-abc");
  assert.equal(a.url, "https://www.kokuchpro.com/event/abc/");
  assert.equal(a.starts_at, "2026-12-20T10:00:00+09:00");
  assert.equal(a.ends_at, "2026-12-20T12:30:00+09:00");
  assert.equal(a.all_day, false);
  assert.equal(a.venue_name, "浜松市 ○○公園");
  assert.equal(a.organizer_name, "自然の会");
  assert.ok(!JSON.stringify(facts).includes("とても長い本文"));
  assert.equal(facts[1]!.starts_at, "2026-12-24");
  assert.equal(facts[1]!.all_day, true);
});

test("Atom entries are supported", async () => {
  const facts = await extractRss(atom, "E4", "https://ex.jp/feed", "t");
  assert.equal(facts.length, 1);
  assert.equal(facts[0]!.url, "https://ex.jp/a");
  assert.equal(facts[0]!.external_ref, "urn:a");
  assert.equal(facts[0]!.starts_at, "2027-01-05T13:00:00+09:00");
});
