import assert from "node:assert/strict";
import test from "node:test";
import { buildPlaceRecordHref, formatShortDate, pickPlaceFocus } from "./placeRevisit.js";

test("pickPlaceFocus prefers next-look guidance over older labels", () => {
  assert.equal(
    pickPlaceFocus({
      nextLookFor: "水辺の鳥",
      revisitReason: "同じ水路を比べたい",
      latestDisplayName: "カルガモ",
    }),
    "水辺の鳥",
  );
});

test("formatShortDate accepts PostgreSQL-style timezone offsets", () => {
  assert.equal(formatShortDate("2026-06-12 17:25:49+09", "ja-JP"), "6月12日");
});

test("buildPlaceRecordHref carries quick-mode revisit context", () => {
  const href = buildPlaceRecordHref("", "ja", "user-1", {
    placeId: "geo:34.710:137.720",
    latestVisitId: "visit-123",
    placeName: "浜松城公園",
    municipality: "浜松市",
    latitude: 34.71,
    longitude: 137.72,
    lastRecordMode: "manual",
    lastSurveyResult: null,
    revisitReason: null,
    nextLookFor: "先週いた水辺の鳥",
    latestDisplayName: "カルガモ",
    absenceSemantics: "casual_note_only",
  });

  assert.match(href, /\/record\?/);
  assert.match(href, /revisitObservationId=visit-123/);
  assert.match(href, /recordMode=quick/);
  assert.match(href, /quickCaptureState=no_detection_note/);
  assert.match(href, /nextLookFor=%E5%85%88%E9%80%B1%E3%81%84%E3%81%9F%E6%B0%B4%E8%BE%BA%E3%81%AE%E9%B3%A5/);
  assert.doesNotMatch(href, /latitude=/);
  assert.doesNotMatch(href, /longitude=/);
  assert.doesNotMatch(href, /placeId=geo/i);
  assert.doesNotMatch(href, /34\.710|137\.720/);
});

test("buildPlaceRecordHref keeps survey follow-up fields for survey places", () => {
  const href = buildPlaceRecordHref("", "ja", "user-1", {
    placeId: "site:sanaruko",
    placeName: "佐鳴湖",
    municipality: "浜松市",
    latitude: 34.70,
    longitude: 137.69,
    lastRecordMode: "survey",
    lastSurveyResult: "no_detection_note",
    revisitReason: "同じ水路の変化を見たい",
    nextLookFor: "水辺の鳥",
    latestDisplayName: "カルガモ",
    absenceSemantics: "protocol_note_only",
  });

  assert.match(href, /recordMode=survey/);
  assert.match(href, /targetTaxaScope=%E6%B0%B4%E8%BE%BA%E3%81%AE%E9%B3%A5/);
  assert.match(href, /revisitReason=/);
  assert.match(href, /surveyResult=no_detection_note/);
  assert.doesNotMatch(href, /latitude=/);
  assert.doesNotMatch(href, /longitude=/);
});

test("buildPlaceRecordHref keeps opaque place ids while omitting coordinate-derived ids", () => {
  const href = buildPlaceRecordHref("", "ja", "user-1", {
    placeId: "site:sanaruko",
    placeName: "佐鳴湖",
    municipality: "浜松市",
    latitude: 34.70,
    longitude: 137.69,
    lastRecordMode: "manual",
    lastSurveyResult: null,
    revisitReason: null,
    nextLookFor: null,
    latestDisplayName: "カルガモ",
    absenceSemantics: null,
  });

  assert.match(href, /placeId=site%3Asanaruko/);
  assert.doesNotMatch(href, /latitude=/);
  assert.doesNotMatch(href, /longitude=/);
});
