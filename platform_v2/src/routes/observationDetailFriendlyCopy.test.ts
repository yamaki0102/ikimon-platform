import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routeSource = readFileSync(new URL("./read.ts", import.meta.url), "utf8");
const cardSource = readFileSync(new URL("../ui/observationCard.ts", import.meta.url), "utf8");

function sourceBetween(startMarker: string, endMarker: string): string {
  const start = routeSource.indexOf(startMarker);
  const end = routeSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing ${startMarker}`);
  assert.notEqual(end, -1, `missing ${endMarker}`);
  return routeSource.slice(start, end);
}

const detailCopySource = [
  sourceBetween("function renderHeroAiReadout", "function renderSubjectHint"),
  sourceBetween("function renderAiCandidates", "function renderSubjectTaxonomy"),
  sourceBetween("function renderSubjectTaxonomy", "function renderIdentificationParticipation"),
  sourceBetween("function renderIdentificationParticipation", "function observationEvidenceLabel"),
  sourceBetween("function renderObservationRecordStory", "function observationLearningDoneText"),
  sourceBetween("function renderObservationLearningCards", "function renderObservationReadingHero"),
  sourceBetween("function renderObservationReadingHero", "function renderObservationReadProgress"),
].join("\n");

test("observation detail page keeps the friendly learning-first vocabulary", () => {
  for (const term of [
    "この日の記録",
    "この記録のストーリー",
    "写真・場所・地域",
    "AI判定の観察レコード",
    "観察レコードの信頼度",
    "見つけたもの",
    "わかったこと",
    "まだ知りたいこと",
    "次にできること",
    "写真・動画・音",
    "同定",
    "何の生きものかを見きわめる",
    "AI判定の候補",
    "みんなの記録に足されます",
  ]) {
    assert.match(detailCopySource, new RegExp(term));
  }

  assert.match(cardSource, /見つけたもの/);
});

test("observation detail primary copy does not expose internal record terms", () => {
  for (const term of [
    "観察詳細",
    "この記録ですでに助かるところ",
    "素晴らしい",
    "元の記録を見る",
    "対象ごとの記録",
    "同定に参加",
    "名前をたしかめる",
    "観察の要約",
    "対象と証拠",
  ]) {
    assert.doesNotMatch(detailCopySource, new RegExp(term));
  }
});
