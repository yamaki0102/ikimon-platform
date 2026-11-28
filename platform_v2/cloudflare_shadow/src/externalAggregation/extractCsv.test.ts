import assert from "node:assert/strict";
import test from "node:test";
import { extractCsv, parseCsv } from "./extractCsv";

const csv = `﻿識別番号,イベント名,開始日,開始時間,終了日,場所,住所,緯度,経度,主催,電話番号,メール
1,"観察会, 冬",2026/12/05,09:30,2026/12/05,佐鳴湖,浜松市中央区,34.7,137.7,浜松市,053-000,a@b.c
2,"引用""付き""",2026-12-06,,,図書館,,,,,,
,,2026-12-07,,,,,,,,,
3,日付不正,あした,,,,,,,,,
`;

test("CSV maps headers by name and ignores contact columns", async () => {
  const facts = await extractCsv(csv, "E1", "https://opendata.example.jp/events.csv", "2026-11-28T00:00:00.000Z");
  assert.equal(facts.length, 2);
  assert.equal(facts[0]!.external_ref, "1");
  assert.equal(facts[0]!.title, "観察会, 冬");
  assert.equal(facts[0]!.starts_at, "2026-12-05T09:30:00+09:00");
  assert.equal(facts[0]!.ends_at, "2026-12-05");
  assert.equal(facts[0]!.all_day, false);
  assert.equal(facts[0]!.lat, 34.7);
  assert.equal(facts[0]!.organizer_name, "浜松市");
  assert.equal(facts[1]!.title, '引用"付き"');
  assert.equal(facts[1]!.all_day, true);
  assert.equal(facts[1]!.lat, null);
  assert.ok(!JSON.stringify(facts).includes("053-000") && !JSON.stringify(facts).includes("a@b.c"));
});

test("CSV without title/start columns yields nothing; parser handles CRLF", async () => {
  assert.deepEqual(await extractCsv("a,b\n1,2\n", "E1", "https://x.jp/", "t"), []);
  assert.deepEqual(parseCsv("a,b\r\n1,\"x\r\ny\"\r\n"), [["a", "b"], ["1", "x\r\ny"]]);
});
