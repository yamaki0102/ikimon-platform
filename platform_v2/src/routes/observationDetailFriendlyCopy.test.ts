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
  sourceBetween("function renderAiCandidateLearningPanel", "function subjectSpecificityScore"),
  sourceBetween("function renderHeroAiReadout", "function renderSubjectHint"),
  sourceBetween("function renderAiCandidates", "function renderSubjectTaxonomy"),
  sourceBetween("function renderSubjectTaxonomy", "function renderIdentificationParticipation"),
  sourceBetween("function renderIdentificationParticipation", "function observationEvidenceLabel"),
  sourceBetween("function renderObservationRecordStory", "function observationLearningDoneText"),
  sourceBetween("function renderObservationLearningCards", "function renderObservationReadingHero"),
  sourceBetween("function renderObservationReadingHero", "function renderObservationReadProgress"),
  sourceBetween("function renderSubjectHint", "function renderCivicContextBlock"),
].join("\n");

test("observation detail page keeps the friendly learning-first vocabulary", () => {
  for (const term of [
    "この日の記録",
    "この記録のストーリー",
    "写真・場所・地域",
    "自動で作った候補",
    "観察レコードの信頼度",
    "見つけたもの",
    "わかったこと",
    "まだ知りたいこと",
    "次にできること",
    "写真・動画・音",
    "まず見えていること",
    "ほかにも写っていそうなもの",
    "自動候補",
    "名前をみんなで確かめる",
    "みんなの記録に足されます",
    "見分けるメモ",
    "次に撮るヒント",
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
    "AIのヒント",
    "AI判定",
    "species / genus / family",
    "run:",
    "taxonomy:",
    "マクロ",
    "花序",
    "鋸歯",
    "総苞",
    "植生構造",
    "遷移段階",
    "人為影響",
    "決定論",
    "エビデンス",
    "地域の見方が一段深くなる",
    "ところが面白い",
    "いっしょに絞るためのメモ",
  ]) {
    assert.doesNotMatch(detailCopySource, new RegExp(term));
  }
});

test("observation record story does not duplicate regional story lead", () => {
  const recordStorySource = sourceBetween("function renderObservationRecordStory", "function observationLearningDoneText");
  assert.doesNotMatch(recordStorySource, /regionalStory\?\.whyHere/);
});
