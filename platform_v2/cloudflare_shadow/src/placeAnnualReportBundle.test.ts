import assert from "node:assert/strict";
import test from "node:test";
import { buildPortableTakeawayBundle, renderPlaceAnnualReportHtml } from "./placeAnnualReportBundle";

test("renderPlaceAnnualReportHtml and buildPortableTakeawayBundle produce standalone printable report and standard CSV bundle", () => {
  const report = {
    placeId: "plc_e3293ec4bb9288a0",
    placeName: "常盤公園",
    year: 2026,
    generatedAt: "2026-11-23",
    observations: [
      { id: "fpr_1", observedDate: "2026-05-10", taxonLabel: "ヤツデ", note: "澄んでいる / 0本", photoUrl: "https://zukan.earth/derived/1.webp" }
    ],
    stewardship: [
      { logId: "log_1", occurredDate: "2026-05-10", participantLabel: "浜松自然を守る会", sessionCount: 3, hours: 6.5, workSummary: "外来植物の抜き取りと池の掃除" }
    ],
    archives: [
      { pageId: "pap_1", observedYear: 1985, observedDate: "1985-05-12", placeName: "常盤公園", species: ["カワセミ", "メダカ"], sourceImageUrl: "https://zukan.earth/archive/1.webp" }
    ],
    totals: { observationCount: 1, stewardshipSessions: 3, stewardshipHours: 6.5, archiveCount: 1 }
  };

  const html = renderPlaceAnnualReportHtml(report);
  assert.match(html, /常盤公園 — 2026年 年報/);
  assert.match(html, /3回/);
  assert.match(html, /6\.5時間/);
  assert.match(html, /外来植物の抜き取りと池の掃除/);
  assert.match(html, /1985年（1985-05-12）/);
  assert.doesNotMatch(html, /<script/); // Standalone, opens cleanly anywhere without IKIMON

  const bundle = buildPortableTakeawayBundle(report);
  assert.equal(bundle.format, "zukan-portable-bundle/v1");
  assert.match(bundle.files["observations.csv"], /taxon_label/);
  assert.match(bundle.files["observations.csv"], /ヤツデ/);
  assert.match(bundle.files["stewardship.csv"], /浜松自然を守る会/);
  assert.match(bundle.files["manifest.json"], /"standaloneReadableWithoutIkimon": true/);
});
