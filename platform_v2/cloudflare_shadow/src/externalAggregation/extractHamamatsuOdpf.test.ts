import assert from "node:assert/strict";
import test from "node:test";
import { extractHamamatsuOdpf, HAMAMATSU_ODPF_URL } from "./extractHamamatsuOdpf";

export const HEADER = ["都道府県コード又は市区町村コード", "NO", "イベント名", "開始日", "終了日", "開始時間", "終了時間", "説明", "連絡先名称", "連絡先電話番号", "主催者", "場所名称", "住所", "緯度", "経度", "URL", "カテゴリー", "参加申込方法"];
const row = (no: string, title: string, start: string, end: string, st: string, cat: string, lat = "34.84", lng = "137.73", url = "https://ex.jp/a") =>
  ["221309", no, title, start, end, st, "", "説明本文", "秘密課", "(053)428-5211", end ? "" : "主催X", "会場A", "浜松市浜名区都田町1", lat, lng, url, cat, "電話で申込"];
export const SAMPLE = [
  HEADER,
  row("1", "通常", "2026-12-26", "", "", "イベント"),
  row("2", "曜日付き", "2027-2-24(水曜日)", "2027-2-25(木曜日)", "", "講座・教室"),
  row("3", "相談", "2026-12-26", "", "", "そうだん"),
  row("4", "緯度なし", "2026-12-27", "", "", "おんがく", "", ""),
  row("5", "時間あり", "2026-12-28", "", "10:00", "スポーツ", "34.8", "137.7", ""),
  row("6", "過去", "2026-11-01", "", "", "イベント"),
];

test("hamamatsu odpf extraction", async () => {
  const facts = await extractHamamatsuOdpf("﻿" + JSON.stringify(SAMPLE), "E1", "2026-11-28T00:00:00.000Z");
  assert.deepEqual(facts.map(f => f.external_ref), ["1", "2", "4", "5"]);
  assert.equal(facts[0]!.starts_at, "2026-12-26");
  assert.equal(facts[0]!.all_day, true);
  assert.equal(facts[0]!.organizer_name, "主催X");
  assert.equal(facts[1]!.starts_at, "2027-02-24");
  assert.equal(facts[1]!.ends_at, "2027-02-25");
  assert.equal(facts[2]!.lat, null);
  assert.equal(facts[2]!.lng, null);
  assert.equal(facts[3]!.starts_at, "2026-12-28T10:00:00+09:00");
  assert.equal(facts[3]!.all_day, false);
  assert.equal(facts[3]!.url, HAMAMATSU_ODPF_URL);
  assert.equal(facts[0]!.url, "https://ex.jp/a");
  const dump = JSON.stringify(facts);
  for (const s of ["説明本文", "秘密課", "428-5211", "電話で申込"]) assert.ok(!dump.includes(s));
  assert.deepEqual(await extractHamamatsuOdpf("not json", "E1", "2026-11-28T00:00:00.000Z"), []);
});
