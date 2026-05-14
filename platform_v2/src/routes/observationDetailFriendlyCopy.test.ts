import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { ObservationVisitBundle, ObservationVisitSubject } from "../services/observationVisitBundle.js";
import { buildVisibleRecordItems } from "../services/observationSceneReadModel.js";
import { renderVisibleRecordItemsPanel } from "./read.js";

const routeSource = readFileSync(new URL("./read.ts", import.meta.url), "utf8");
const writeRouteSource = readFileSync(new URL("./write.ts", import.meta.url), "utf8");
const cardSource = readFileSync(new URL("../ui/observationCard.ts", import.meta.url), "utf8");
const mediaSource = readFileSync(new URL("../ui/observationMedia.ts", import.meta.url), "utf8");
const subjectProposalSource = readFileSync(new URL("../services/observationSubjectProposal.ts", import.meta.url), "utf8");
const candidateAdoptionSource = readFileSync(new URL("../services/observationCandidateAdoption.ts", import.meta.url), "utf8");
const identificationParticipationSource = readFileSync(new URL("../services/identificationParticipation.ts", import.meta.url), "utf8");

function sourceBetween(startMarker: string, endMarker: string): string {
  const start = routeSource.indexOf(startMarker);
  const end = routeSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing ${startMarker}`);
  assert.notEqual(end, -1, `missing ${endMarker}`);
  return routeSource.slice(start, end);
}

const detailCopySource = [
  sourceBetween("function mediaSceneNoun", "function renderAiCandidateLearningPanel"),
  sourceBetween("function renderVisibleRecordCard", "export function renderVisibleRecordItemsPanel"),
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
  sourceBetween("const layer1 =", "    // ===== Layer 2: 同定 ====="),
  sourceBetween("const ctaBlock = `", "    // ===== Layer 6: 豆知識 ====="),
].join("\n");

test("observation detail page keeps the friendly observation vocabulary", () => {
  for (const term of [
    "この写真に写っているもの",
    "からの自動候補",
    "名前のいま",
    "そう見える理由",
    "まだ決めきらない理由",
    "見つけたもの",
    "写真・動画・音",
    "写っているもの",
    "この組み合わせから読む",
    "同定の根拠",
    "AIが写真から拾った仮説です",
    "この候補を支持",
    "この候補は保留",
    "この候補は違うかも",
    "未検出を追加",
    "足元に咲く花",
    "花を使う虫",
    "人の手が入る草地",
    "小さな季節の物語",
    "ほかにも写っていそうなもの",
    "観測レコードにする",
    "写っている対象として知らせる",
    "投稿者の正式な主張ではありません",
    "投稿者には通知され",
    "自動候補",
    "名前を確かめる",
    "からの提案",
    "見分けるメモ",
    "次に見つけるなら",
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
    "あとから見返す",
    "あとで見返",
    "見返せ",
    "記録を育てる",
    "地域に貢献",
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
    "完成案",
    "Photo First",
    "自己効力感",
    "ジョブ・クラフティング",
    "Autonomy",
    "Relatedness",
    "写真を見たら、すぐ動ける",
    "候補名だけで終わらせず",
    "主役っぽいもの、一緒に写ってるかもしれないもの、周りの草",
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
  assert.match(visibleItemsSource, /mediaVisibleSurfaceLabel/);
  assert.match(visibleItemsSource, /obs-focus-title">写っているもの/);
  assert.match(visibleItemsSource, /この組み合わせから読む/);
  assert.match(visibleItemsSource, /名前だけでなく、その場を使うものと草地の状態/);
  assert.match(visibleItemsSource, /参考候補/);
  assert.match(visibleCardSource, /観測レコードにする/);
  assert.match(storySource, /小さな季節の物語/);
  assert.match(storySource, /足元に咲く花/);
  assert.match(storySource, /花を使う虫/);
  assert.match(storySource, /人の手が入る草地/);
  assert.match(detailCopySource, /同定の根拠/);
  assert.match(detailCopySource, /AIが写真から拾った仮説です/);
  assert.match(detailCopySource, /この候補を支持/);
  assert.match(detailCopySource, /未検出を追加/);
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
    subjectSource: null,
    proposedByUserId: null,
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
  const loggedInNonOwnerItems = buildVisibleRecordItems({
    basePath: "",
    lang: "ja",
    bundle,
    currentSubject: plant,
    featuredSubject: plant,
    isOwner: false,
    canProposeSubject: true,
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
      ["ヒメイワダレソウ", "AI推定", "main", "主役っぽい"],
      ["セイヨウミツバチ", "AI推定", "main", "一緒に写ってるかも"],
      ["イネ科の一種", "AI推定", "main", "周りの草"],
      ["小さな黒い点", "参考", "reference", "一緒に写ってるかも"],
    ],
  );

  const anonymousHtml = renderVisibleRecordItemsPanel(anonymousItems);
  const loggedInNonOwnerHtml = renderVisibleRecordItemsPanel(loggedInNonOwnerItems);
  const ownerHtml = renderVisibleRecordItemsPanel(ownerItems);

  assert.match(anonymousHtml, /この写真に写っているもの/);
  assert.match(anonymousHtml, /ヒメイワダレソウ/);
  assert.match(anonymousHtml, /セイヨウミツバチ/);
  assert.match(anonymousHtml, /イネ科の一種/);
  assert.match(anonymousHtml, /参考候補 <span class="obs-fold-count">1<\/span>/);
  assert.match(anonymousHtml, /この写真からの自動候補。確定名ではありません。/);
  assert.doesNotMatch(anonymousHtml, /観測レコードにする/);
  assert.doesNotMatch(anonymousHtml, /写っている対象として知らせる/);
  assert.match(loggedInNonOwnerHtml, /写っている対象として知らせる/);
  assert.match(ownerHtml, /観測レコードにする/);

  const videoHtml = renderVisibleRecordItemsPanel(anonymousItems, { hasPhotos: false, hasVideos: true });
  assert.match(videoHtml, /この映像に写っているもの/);
  assert.match(videoHtml, /写っているもの/);
  assert.match(videoHtml, /この映像からの自動候補。確定名ではありません。/);
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
    subjectSource: null,
    proposedByUserId: null,
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
    subjectSource: "ai_candidate_adoption",
    proposedByUserId: null,
  } as ObservationVisitSubject;
  const aiGrass = {
    ...plant,
    occurrenceId: "occ:scene-history:2",
    subjectIndex: 2,
    displayName: "イネ科の一種",
    scientificName: null,
    vernacularName: "イネ科の一種",
    rank: "lifeform",
    roleHint: "vegetation",
    confidence: 0.62,
    latestAssessmentBand: null,
    focusReason: "同じ記録で一緒に写っている対象です",
    roleLabel: "植生",
    adoptedFromAiCandidate: false,
    adoptedCandidateId: "candidate-grass",
    adoptedCandidateNote: "周囲の細い葉",
    subjectSource: "ai_judgement_observation_record",
    proposedByUserId: null,
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
    subjects: [plant, adoptedBee, aiGrass],
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

  assert.match(html, /AI候補から見つけたもの/);
  assert.match(html, /AI候補を、同じ場面に写る対象として分けています/);
  assert.match(html, /セイヨウミツバチ/);
  assert.match(html, /AIが写真から分けた観測レコード/);
  assert.match(html, /最初から同じ場面に写っている対象として分けています/);
  assert.match(html, /周りの草/);
});

test("community subject proposal is separated from owner-only candidate adoption", () => {
  assert.match(writeRouteSource, /\/api\/v1\/observations\/:id\/candidates\/:candidateId\/propose/);
  assert.match(writeRouteSource, /\/api\/v1\/observations\/:id\/candidates\/:candidateId\/adopt/);
  assert.match(writeRouteSource, /adoptObservationCandidate/);
  assert.match(writeRouteSource, /handleCandidateAdoption/);
  assert.match(candidateAdoptionSource, /observation_not_owned/);
  assert.match(candidateAdoptionSource, /ai_candidate_adoption/);
  assert.match(subjectProposalSource, /community_subject_proposal/);
  assert.match(subjectProposalSource, /proposed_by_user_id/);
  assert.match(subjectProposalSource, /subject_proposal/);
  assert.match(subjectProposalSource, /alert_deliveries/);
  assert.match(subjectProposalSource, /channel,\s+delivery_status, delivered_at, payload_json/);
  assert.match(subjectProposalSource, /proposal_status: "proposed"/);
  assert.doesNotMatch(subjectProposalSource, /observation_not_owned/);
  assert.doesNotMatch(subjectProposalSource, /candidate\.user_id\s*!==\s*input\.actorUserId/);
});

test("media annotations let visitors choose subjects from the photo or video surface", () => {
  assert.match(mediaSource, /ObservationMediaAnnotationTarget/);
  assert.match(mediaSource, /data-annotation-target/);
  assert.match(mediaSource, /data-annotation-subject-id/);
  assert.match(mediaSource, /data-annotation-candidate-id/);
  assert.match(mediaSource, /obs-video-annotation-rail/);
  assert.match(mediaSource, /枠をタップすると対象を切り替えられます。位置はAIの参考です。/);
  assert.match(routeSource, /buildObservationMediaAnnotationTargets/);
  assert.match(routeSource, /renderObservationMedia\(snapshot, currentSubject, mediaAnnotationTargets\)/);
  assert.match(routeSource, /data-proposal-focus/);
});

test("identification and dispute writes refresh the visit display state", () => {
  assert.match(identificationParticipationSource, /refreshVisitDisplayStateAfterIdentification/);
  assert.match(identificationParticipationSource, /deriveVisitDisplayState/);
  assert.match(identificationParticipationSource, /upsertVisitDisplayState/);
  assert.match(identificationParticipationSource, /await refreshVisitDisplayStateAfterIdentification\(client, visitId\);/);
});

test("occurrence query parameter is accepted and canonicalized to subject", () => {
  assert.match(routeSource, /Querystring: \{ subject\?: string; occurrence\?: string \}/);
  assert.match(routeSource, /request\.query\.subject \?\? request\.query\.occurrence \?\? null/);
  assert.match(routeSource, /buildObservationDetailPath\(bundle\.visitId, bundle\.canonicalSubjectId\)/);
});

test("open disputes pause assertive more-about copy", () => {
  assert.match(routeSource, /hasOpenNameDispute/);
  assert.match(routeSource, /名前の見方が割れているため、候補が固まったら詳しく読めます。/);
  assert.match(routeSource, /renderHeroAiReadout\(currentSubject, consensus\?\.hasOpenDispute === true\)/);
});
