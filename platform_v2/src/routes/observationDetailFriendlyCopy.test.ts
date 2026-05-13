import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { ObservationVisitBundle, ObservationVisitSubject } from "../services/observationVisitBundle.js";
import { buildVisibleRecordItems } from "../services/observationSceneReadModel.js";
import { renderVisibleRecordItemsPanel } from "./read.js";

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
  sourceBetween("function renderVisibleRecordItemsPanel", "function renderAiCandidateLearningPanel"),
  sourceBetween("function renderAiCandidateLearningPanel", "function subjectSpecificityScore"),
  sourceBetween("function renderHeroAiReadout", "function renderSubjectHint"),
  sourceBetween("function renderAiCandidates", "function renderSubjectTaxonomy"),
  sourceBetween("function renderSubjectTaxonomy", "function renderIdentificationParticipation"),
  sourceBetween("function renderIdentificationParticipation", "function observationEvidenceLabel"),
  sourceBetween("function renderObservationRecordStory", "function renderObservationNextActionRail"),
  sourceBetween("function renderVisualNextCaptureSuggestions", "function renderObservationReadingHero"),
  sourceBetween("function renderObservationReadingHero", "function renderObservationReadProgress"),
  sourceBetween("function renderSubjectHint", "function renderCivicContextBlock"),
  sourceBetween("const ctaBlock = `", "    // ===== Layer 6: 豆知識 ====="),
].join("\n");

test("observation detail page keeps the friendly observation vocabulary", () => {
  for (const term of [
    "この日の記録",
    "記録の読み取り",
    "写真・場所・地域",
    "自動で作った候補",
    "観察レコードの信頼度",
    "見つけたもの",
    "写真・動画・音",
    "写真の手がかり",
    "保留している点",
    "ほかにも写っていそうなもの",
    "自動候補",
    "名前を確かめる",
    "見分けるメモ",
    "写真を足すなら",
    "あると見やすい材料",
    "関連ページ",
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
    "次にできること",
    "みんなの記録に足されます",
    "次に撮るヒント",
    "次に見る",
    "見るポイント",
    "あると便利な写真",
    "名前をみんなで確かめる",
    "この場所の物語",
    "この記録のストーリー",
    "まず見えていること",
    "確認中のポイント",
    "記録の中身",
    "何が残っているか",
    "いま見ているもの",
    "もう一度見に行く理由",
    "次にほしい写真やメモ",
    "わかったこと",
    "まだ知りたいこと",
    "残ったこと",
    "確かめる余地",
    "機会があれば",
    "あとで比べやすくなります",
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
  const recordStorySource = sourceBetween("function renderObservationRecordStory", "function renderObservationNextActionRail");
  assert.doesNotMatch(recordStorySource, /regionalStory\?\.whyHere/);
});

test("observation detail hero treats the page as a multi-record scene", () => {
  const heroSource = sourceBetween("function renderObservationReadingHero", "function renderObservationReadProgress");
  const visibleItemsSource = sourceBetween("function renderVisibleRecordItemsPanel", "function renderAiCandidateLearningPanel");
  const visibleCardSource = sourceBetween("function renderVisibleRecordCard", "function renderVisibleRecordItemsPanel");
  const storySource = sourceBetween("function renderObservationRecordStory", "function renderObservationNextActionRail");

  assert.match(heroSource, /options\.recordTitle/);
  assert.doesNotMatch(heroSource, /obs-reading-title">\$\{escapeHtml\(options\.displayName\)\}/);
  assert.match(visibleItemsSource, /今日ここで見えたもの/);
  assert.match(visibleItemsSource, /主対象、訪花中の虫、周囲の草/);
  assert.match(visibleItemsSource, /参考候補/);
  assert.match(visibleCardSource, /見つけたものとして残す/);
  assert.match(storySource, /花・訪問者・足元をまとめて見返す記録/);
});

test("visible record fixture surfaces plant, bee, grass, and folds low-confidence candidates", () => {
  const region = {
    regionId: "region-bee",
    occurrenceId: null,
    candidateId: "cand-bee",
    assetId: "asset-1",
    rect: { x: 0.58, y: 0.24, width: 0.18, height: 0.12 },
    frameTimeMs: null,
    confidenceScore: 0.61,
    sourceKind: "ai",
    sourceModel: "fixture",
    note: "花の上にいる小さなハチ",
  };
  const plant = {
    occurrenceId: "occ:record-1778549526406:0",
    visitId: "record-1778549526406",
    subjectIndex: 0,
    displayName: "ヒメイワダレソウ",
    scientificName: "Phyla nodiflora",
    vernacularName: "ヒメイワダレソウ",
    rank: "species",
    roleHint: "primary",
    confidence: null,
    identificationCount: 0,
    latestAssessmentBand: "high",
    isPrimary: true,
    priorityScore: 131,
    focusReason: "地面をはう白い花の群落",
    roleLabel: "主対象",
    evidenceTier: 0,
    latestAssessmentGeneratedAt: null,
    aiAssessmentStatus: null,
    aiReviewAgreeCount: 0,
    aiReviewDisagreeCount: 0,
    aiCandidateName: null,
    aiCandidateRank: null,
    adoptedFromAiCandidate: false,
    adoptedCandidateId: null,
    adoptedCandidateNote: null,
    isAiCandidate: false,
    hasSpecialistApproval: false,
    identifications: [],
    lineage: [],
    aiAssessment: null,
    previousAiAssessment: null,
    regions: [],
  } as ObservationVisitSubject;
  const bundle = {
    visitId: "record-1778549526406",
    canonicalSubjectId: plant.occurrenceId,
    featuredOccurrenceId: plant.occurrenceId,
    selectedReason: "fixture",
    selectionSource: "latest_ai_default",
    lockedByHuman: false,
    displayStability: "adaptive",
    selectedRun: null,
    previousRun: null,
    subjects: [plant],
    aiCandidates: [
      {
        candidateId: "cand-bee",
        suggestedOccurrenceId: null,
        displayName: "セイヨウミツバチ",
        scientificName: "Apis mellifera",
        rank: "species",
        confidence: 0.68,
        candidateStatus: "proposed",
        note: "白い花で訪花中のハチ",
        regions: [region],
      },
      {
        candidateId: "cand-grass",
        suggestedOccurrenceId: null,
        displayName: "イネ科の一種",
        scientificName: null,
        rank: "lifeform",
        confidence: 0.56,
        candidateStatus: "proposed",
        note: "群落の周囲に細い葉の草が混じる",
        regions: [],
      },
      {
        candidateId: "cand-low",
        suggestedOccurrenceId: null,
        displayName: "小さな黒い点",
        scientificName: null,
        rank: null,
        confidence: 0.28,
        candidateStatus: "proposed",
        note: "位置と分類が弱い候補",
        regions: [],
      },
    ],
  } as ObservationVisitBundle;

  const anonymousItems = buildVisibleRecordItems({
    basePath: "",
    lang: "ja",
    bundle,
    currentSubject: plant,
    featuredSubject: plant,
    isOwner: false,
  });
  const ownerItems = buildVisibleRecordItems({
    basePath: "",
    lang: "ja",
    bundle,
    currentSubject: plant,
    featuredSubject: plant,
    isOwner: true,
  });

  assert.deepEqual(
    anonymousItems.map((item) => [item.displayName, item.trustLabel, item.bucket, item.roleLabel]),
    [
      ["ヒメイワダレソウ", "有力", "main", "主対象"],
      ["セイヨウミツバチ", "有力", "main", "訪花中の候補"],
      ["イネ科の一種", "手がかりあり", "main", "周囲の草"],
      ["小さな黒い点", "参考", "reference", "別の生きもの候補"],
    ],
  );

  const anonymousHtml = renderVisibleRecordItemsPanel(anonymousItems);
  const ownerHtml = renderVisibleRecordItemsPanel(ownerItems);

  assert.match(anonymousHtml, /今日ここで見えたもの/);
  assert.match(anonymousHtml, /ヒメイワダレソウ/);
  assert.match(anonymousHtml, /セイヨウミツバチ/);
  assert.match(anonymousHtml, /イネ科の一種/);
  assert.match(anonymousHtml, /参考候補 <span class="obs-fold-count">1<\/span>/);
  assert.match(anonymousHtml, /自動候補。確定名ではありません。/);
  assert.doesNotMatch(anonymousHtml, /見つけたものとして残す/);
  assert.match(ownerHtml, /見つけたものとして残す/);
});

test("visible record card keeps the history after an AI candidate is adopted", () => {
  const plant = {
    occurrenceId: "occ:scene-history:0",
    visitId: "scene-history",
    subjectIndex: 0,
    displayName: "白い花の群落",
    scientificName: null,
    vernacularName: "白い花の群落",
    rank: null,
    roleHint: "primary",
    confidence: null,
    identificationCount: 0,
    latestAssessmentBand: "high",
    latestAssessmentGeneratedAt: null,
    isPrimary: true,
    priorityScore: 40,
    focusReason: "最初に記録された対象です",
    roleLabel: "主対象",
    evidenceTier: 0,
    aiAssessmentStatus: null,
    aiReviewAgreeCount: 0,
    aiReviewDisagreeCount: 0,
    aiCandidateName: null,
    aiCandidateRank: null,
    adoptedFromAiCandidate: false,
    adoptedCandidateId: null,
    adoptedCandidateNote: null,
    isAiCandidate: false,
    hasSpecialistApproval: false,
    identifications: [],
    lineage: [],
    aiAssessment: null,
    previousAiAssessment: null,
    regions: [],
  } as ObservationVisitSubject;
  const adoptedBee = {
    ...plant,
    occurrenceId: "occ:scene-history:1",
    subjectIndex: 1,
    displayName: "セイヨウミツバチ",
    scientificName: "Apis mellifera",
    vernacularName: "セイヨウミツバチ",
    rank: "species",
    roleHint: "coexisting",
    latestAssessmentBand: "medium",
    focusReason: "同じ記録で一緒に写っている対象です",
    roleLabel: "別の生きもの",
    adoptedFromAiCandidate: true,
    adoptedCandidateId: "candidate-history",
    adoptedCandidateNote: "白い花で訪花中",
  } as ObservationVisitSubject;
  const bundle = {
    visitId: "scene-history",
    canonicalSubjectId: plant.occurrenceId,
    featuredOccurrenceId: plant.occurrenceId,
    selectedReason: "fixture",
    selectionSource: "latest_ai_default",
    lockedByHuman: false,
    displayStability: "adaptive",
    selectedRun: null,
    previousRun: null,
    subjects: [plant, adoptedBee],
    aiCandidates: [],
  } as ObservationVisitBundle;

  const html = renderVisibleRecordItemsPanel(buildVisibleRecordItems({
    basePath: "",
    lang: "ja",
    bundle,
    currentSubject: plant,
    featuredSubject: plant,
    isOwner: true,
  }));

  assert.match(html, /AI候補から残した見つけたもの/);
  assert.match(html, /候補を正式な見つけたものとして残した履歴があります/);
  assert.match(html, /セイヨウミツバチ/);
});
