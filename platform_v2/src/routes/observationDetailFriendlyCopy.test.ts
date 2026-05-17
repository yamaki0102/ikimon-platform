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
  sourceBetween("function renderLocalNameCandidatePanel", "function renderAiTaxonStory"),
  sourceBetween("function renderAiCompareList", "function renderHeroAiReadout"),
  sourceBetween("function renderHeroAiReadout", "function renderSubjectHint"),
  sourceBetween("function selectOption", "function renderSizeCard"),
  sourceBetween("function renderAiCandidates", "function renderSubjectTaxonomy"),
  sourceBetween("function renderSubjectEvidenceTabs", "function renderSubjectTaxonomy"),
  sourceBetween("function renderSubjectTaxonomy", "function renderIdentificationParticipation"),
  sourceBetween("function renderIdentificationParticipation", "function observationEvidenceLabel"),
  sourceBetween("function renderObservationRecordInsightText", "function aiJudgementStateLabel"),
  sourceBetween("function renderNearbyAreaRecords", "function renderLocalObservationPolishScript"),
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
    "花に来た虫",
    "草地と裸地",
    "見つけたもの",
    "写真・動画",
    "写っているもの",
    "候補を確かめる材料",
    "見えている特徴",
    "弱い点",
    "地域との読み",
    "観測レコードにする",
    "写っている対象として知らせる",
    "同定に参加する",
    "同意する",
    "別候補を提案",
    "保留する",
    "別レコードを追加",
    "OBSERVATION QUALITY",
    "観察レコードとして育てる",
    "この映像で読む対象を切り替える",
    "かなり近そう",
    "分類候補",
    "Chloris sinica",
    "端末の声で読む",
    "近い投稿",
    "浜松市浜名区",
    "確認待ち",
    "AI推定",
    "次に見るなら",
    "同じエリア",
    "似た仲間との見分け",
    "手入れメモ",
    "会社敷地の管理方針",
    "同じ場所から読む優先順位",
    "避けること",
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
    "関連ページ",
    "完成案",
    "Photo First",
    "自己効力感",
    "ジョブ・クラフティング",
    "Autonomy",
    "Relatedness",
    "写真を見たら、すぐ動ける",
    "候補名だけで終わらせず",
    "主役っぽいもの、一緒に写ってるかもしれないもの、周りの草",
    "確定前",
    "イネ科植物",
    "映像フレームから拾えている手がかり",
    "名前の記録",
    "現場アドバイス",
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
  assert.match(visibleItemsSource, /この映像で読む対象を切り替える/);
  assert.match(visibleItemsSource, /sceneReadTextForVisibleItems/);
  assert.match(visibleItemsSource, /参考候補/);
  assert.match(visibleCardSource, /観測レコードにする/);
  assert.match(storySource, /小さな季節の物語/);
  assert.match(storySource, /足元に咲く花/);
  assert.match(storySource, /花を使う虫/);
  assert.match(storySource, /人の手が入る草地/);
  assert.match(detailCopySource, /候補を確かめる材料/);
  assert.match(detailCopySource, /AIが写真・動画から拾った候補です/);
  assert.match(detailCopySource, /保留する/);
  assert.match(detailCopySource, /別レコードを追加/);
  assert.doesNotMatch(detailCopySource, /同定の根拠/);
  assert.doesNotMatch(detailCopySource, /AIが写真から拾った仮説です/);
  assert.doesNotMatch(detailCopySource, /証拠不足で保留/);
  assert.doesNotMatch(detailCopySource, /別の写り込みを追加/);
  assert.doesNotMatch(detailCopySource, /obs-ai-readout-note[^}]*-webkit-line-clamp/);
});

test("observation detail visible order stays aligned with the canonical snapshot", () => {
  const styleSource = sourceBetween("const OBSERVATION_DETAIL_STYLES", "function aiJudgementStateLabel");
  const registrationSource = sourceBetween("export async function registerReadRoutes", "const canonicalDetailPath");

  assert.match(styleSource, /obs-reading-panel > h1\.sr-only[^}]*clip: rect/);
  assert.match(styleSource, /obs-reading-panel \[data-obs-switch-ai-readout\] \{ order: 5;/);
  assert.match(styleSource, /obs-local-quality-inline\.is-full-width \{ order: 7;/);
  assert.match(styleSource, /\.site-shell main \{ padding-top: 8px !important; \}/);
  assert.match(styleSource, /\.obs-ai-detail-lead \{ display: none !important; \}/);
  assert.match(styleSource, /\.obs-frame-candidate-meter \{ display: none !important; \}/);
  assert.match(styleSource, /\.obs-reading-media \.obs-video-evidence-frame \{ flex: 0 0 clamp\(86px, 15\.2vw, 104px\) !important;/);
  assert.match(styleSource, /#place\.obs-area-records \{ width: auto !important; max-width: none !important; justify-self: stretch !important; margin-left: 0 !important; \}/);
  assert.match(registrationSource, /switchGuideBlock: ""/);
  assert.match(registrationSource, /focusRailBlock: ""/);
  assert.match(registrationSource, /useStatusBlock: ""/);
  assert.match(registrationSource, /summaryStrip: ""/);
  assert.match(registrationSource, /sceneOverviewBlock: ""/);
  assert.match(registrationSource, /const hintBlock = ""/);
  assert.match(registrationSource, /const aiCandidateLearningBlock = ""/);
  assert.match(registrationSource, /const layer2 = ""/);
});

test("observation detail hero readout surfaces scene candidates for weak current subjects", () => {
  const readoutSource = sourceBetween("function renderHeroAiReadout", "type ObservationMediaCopyContext");
  const registrationSource = sourceBetween("export async function registerReadRoutes", "const canonicalDetailPath");

  assert.match(readoutSource, /bundle: ObservationVisitBundle \| null = null/);
  assert.match(readoutSource, /renderHeroSceneCandidateTargets\(subject, bundle\)/);
  assert.match(readoutSource, /sceneTargets \|\| `<div class="obs-ai-target-list obs-ai-primary-targets"/);
  assert.match(readoutSource, /この場面の候補を見ています/);
  assert.match(readoutSource, /同じ場面内の候補も確認できます/);
  assert.match(registrationSource, /nameStatusBlock: renderHeroAiReadout\(currentSubject,[\s\S]*?insight, bundle\)/);
  assert.match(registrationSource, /data-subject-ai-readout-template=[\s\S]*?renderHeroAiReadout\(subject,[\s\S]*?bundle\)/);
});

test("vegetation care advice is cautious and grounded in management context", () => {
  const careSource = sourceBetween("function selectOption", "function renderSizeCard");
  assert.match(careSource, /手入れメモ/);
  assert.match(careSource, /managementActionCandidates/);
  assert.match(careSource, /managementHintCandidates/);
  assert.match(careSource, /写真AIの読取/);
  assert.match(careSource, /場所の管理目的/);
  assert.match(careSource, /区画を決めて抑える/);
  assert.match(careSource, /PlaceManagementPolicy/);
  assert.match(careSource, /PlaceVegetationTrend/);
  assert.match(careSource, /会社敷地の管理方針/);
  assert.match(careSource, /同じ場所から読む優先順位/);
  assert.match(careSource, /抜く前に、管理者か自治体へ確認/);
  assert.match(careSource, /生きたまま別の場所へ動かさない/);
  assert.match(careSource, /通路・排水・植栽への影響/);
  assert.match(careSource, /最終判断は同定、敷地の目的、安全、現地ルール/);
  assert.doesNotMatch(careSource, /どんどん抜/);
  assert.doesNotMatch(careSource, /必ず抜/);
});

test("no-ai plant detail can still surface site management policy controls", () => {
  const subjectHintSource = sourceBetween("function renderSubjectHint", "function renderCivicContextBlock");
  const noAiStart = subjectHintSource.indexOf("if (!aiAssessment)");
  const noAiEnd = subjectHintSource.indexOf("const band =", noAiStart);
  assert.notEqual(noAiStart, -1, "missing no-ai subject hint branch");
  assert.notEqual(noAiEnd, -1, "missing ai subject hint branch after no-ai branch");
  const noAiSource = subjectHintSource.slice(noAiStart, noAiEnd);

  assert.match(noAiSource, /renderVegetationCareAdviceCard/);
  assert.match(noAiSource, /fieldAdviceContext/);
  assert.match(noAiSource, /basePath/);
});

test("identification candidate switch uses real bundle candidates instead of hardcoded 1 of 1", () => {
  const identifySource = sourceBetween("function renderIdentificationCandidateSwitch", "function normalizeCandidateReadingKey");
  const participationSource = sourceBetween("function renderIdentificationParticipation", "function observationEvidenceLabel");
  const registrationSource = sourceBetween("export async function registerReadRoutes", "const canonicalDetailPath");

  assert.match(identifySource, /usefulCount/);
  assert.match(identifySource, /候補名が弱い/);
  assert.match(identifySource, /bundle\.aiCandidates/);
  assert.doesNotMatch(participationSource, /<strong>1\/1<\/strong>/);
  assert.match(registrationSource, /bundle,\s+mediaContext/);
});

test("owner-only controls stay compact and avoid support-card copy", () => {
  const ownerSource = [
    sourceBetween("function renderObservationPhotoRecoveryPanel", "function renderObservationPhotoRecoveryScript"),
    sourceBetween("function renderObservationOwnerDeletePanel", "function renderObservationOwnerDeleteScript"),
    sourceBetween("const reassessBlock =", "const ownerToolsBlock ="),
  ].join("\n");
  assert.match(ownerSource, /obs-owner-tool/);
  assert.match(ownerSource, /obs-owner-tool-label/);
  assert.match(ownerSource, /data-photo-recovery-status/);
  assert.match(ownerSource, /data-owner-delete-status/);
  assert.doesNotMatch(ownerSource, /obs-owner-tool-details/);
  assert.doesNotMatch(ownerSource, /obs-owner-tool-body/);
  assert.doesNotMatch(routeSource, /Photo recovery/);
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
        candidateId: "cand-vetch",
        suggestedOccurrenceId: null,
        displayName: "カラスノエンドウ",
        scientificName: "Vicia sativa",
        rank: "species",
        confidence: 0.52,
        candidateStatus: "proposed",
        note: "マメ科の植物らしい葉が端に写る",
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
      ["ヒメイワダレソウ", "AI推定", "main", "代表候補"],
      ["セイヨウミツバチ", "AI推定", "main", "花に来た虫"],
      ["イネ科の一種", "AI推定", "main", "草地と裸地"],
      ["カラスノエンドウ", "AI推定", "main", "写っている植物"],
      ["小さな黒い点", "参考", "reference", "一緒に写るもの"],
    ],
  );

  const anonymousHtml = renderVisibleRecordItemsPanel(anonymousItems);
  const loggedInNonOwnerHtml = renderVisibleRecordItemsPanel(loggedInNonOwnerItems);
  const ownerHtml = renderVisibleRecordItemsPanel(ownerItems);

  assert.match(anonymousHtml, /この写真に写っているもの/);
  assert.match(anonymousHtml, /ヒメイワダレソウ/);
  assert.match(anonymousHtml, /セイヨウミツバチ/);
  assert.match(anonymousHtml, /イネ科の一種/);
  assert.match(anonymousHtml, /カラスノエンドウ/);
  assert.match(anonymousHtml, /写っている植物/);
  assert.match(anonymousHtml, /参考候補 <span class="obs-fold-count">1<\/span>/);
  assert.match(anonymousHtml, /花資源としての役割/);
  assert.match(anonymousHtml, /刈られ方、踏まれ方、乾きやすさ/);
  assert.doesNotMatch(anonymousHtml, /カラスノエンドウ[\s\S]{0,160}この場所を使う鳥/);
  assert.doesNotMatch(anonymousHtml, /一緒に写ってるかも/);
  assert.doesNotMatch(anonymousHtml, /周りの草/);
  assert.doesNotMatch(anonymousHtml, /この写真からの自動候補。確定名ではありません。/);
  assert.doesNotMatch(anonymousHtml, /観測レコードにする/);
  assert.doesNotMatch(anonymousHtml, /写っている対象として知らせる/);
  assert.match(loggedInNonOwnerHtml, /写っている対象として知らせる/);
  assert.match(ownerHtml, /観測レコードにする/);

  const videoHtml = renderVisibleRecordItemsPanel(anonymousItems, { hasPhotos: false, hasVideos: true });
  assert.match(videoHtml, /この映像に写っているもの/);
  assert.match(videoHtml, /写っているもの/);
  assert.match(videoHtml, /この場所でのふるまい/);
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

  assert.match(html, /セイヨウミツバチ/);
  assert.match(html, /花に来た虫/);
  assert.match(html, /草地と裸地/);
  assert.match(html, /どの花に来ていたか/);
  assert.doesNotMatch(html, /AI候補から見つけたもの/);
  assert.doesNotMatch(html, /AIが写真から分けた観測レコード/);
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

test("media annotations are moved out of the photo surface", () => {
  assert.match(mediaSource, /ObservationMediaAnnotationTarget/);
  assert.match(mediaSource, /data-annotation-target/);
  assert.match(mediaSource, /data-annotation-subject-id/);
  assert.match(mediaSource, /data-annotation-candidate-id/);
  assert.match(mediaSource, /obs-video-annotation-rail/);
  assert.match(mediaSource, /summary\.hidden = true/);
  assert.match(mediaSource, /<span class="obs-annotation-layer" data-obs-preview-annotations hidden><\/span>/);
  assert.match(routeSource, /buildObservationMediaAnnotationTargets/);
  assert.match(routeSource, /renderObservationMedia\(snapshot,\s*currentSubject,\s*mediaAnnotationTargets/s);
  assert.match(routeSource, /data-proposal-focus/);
  assert.match(routeSource, /regionSummary\.hidden = true/);
});

test("identification and dispute writes refresh the visit display state", () => {
  assert.match(identificationParticipationSource, /refreshVisitDisplayStateAfterIdentification/);
  assert.match(identificationParticipationSource, /deriveVisitDisplayState/);
  assert.match(identificationParticipationSource, /upsertVisitDisplayState/);
  assert.match(identificationParticipationSource, /await refreshVisitDisplayStateAfterIdentification\(client, visitId\);/);
});

test("subject query parameters are treated as internal tabs, not canonical pages", () => {
  assert.match(routeSource, /Querystring: \{ subject\?: string; occurrence\?: string \}/);
  assert.match(routeSource, /request\.query\.subject \?\? request\.query\.occurrence \?\? null/);
  assert.match(routeSource, /request\.params\.id !== bundle\.visitId \|\| request\.query\.subject \|\| request\.query\.occurrence/);
  assert.match(routeSource, /const canonicalDetailPath = `\/observations\/\$\{encodeURIComponent\(bundle\.visitId\)\}`/);
  assert.match(routeSource, /history\.replaceState\(\{ subject: subjectId \}, '', canonicalRecordHref\)/);
  assert.doesNotMatch(routeSource, /history\.pushState\(\{ subject: subjectId \}, '', active\.href\)/);
});

test("identity evidence stays usable when AI returns many candidates", () => {
  const evidenceSource = sourceBetween("function renderSubjectEvidenceTabs", "function renderSubjectTaxonomy");

  assert.match(evidenceSource, /MAX_IDENTITY_EVIDENCE_TARGETS/);
  assert.match(evidenceSource, /IDENTITY_EVIDENCE_SEARCH_THRESHOLD/);
  assert.match(evidenceSource, /候補名で絞り込み/);
  assert.match(evidenceSource, /data-obs-id-search-text/);
  assert.match(evidenceSource, /該当する候補がありません/);
});

test("identity evidence fallback keeps common planted-scene subjects specific", () => {
  const fallbackSource = sourceBetween("function fallbackCandidateReadingForSubject", "const MAX_IDENTITY_EVIDENCE_TARGETS");

  assert.match(fallbackSource, /アメリカシャクナゲ/);
  assert.match(fallbackSource, /皿形の花冠/);
  assert.match(fallbackSource, /ツルニチニチソウ/);
  assert.match(fallbackSource, /紫色の5裂花/);
  assert.match(fallbackSource, /雑草群落/);
  assert.match(fallbackSource, /背景の樹木/);
});

test("open disputes pause assertive more-about copy", () => {
  assert.match(routeSource, /hasOpenNameDispute/);
  assert.match(routeSource, /確認中/);
  assert.match(routeSource, /renderHeroAiReadout\(currentSubject,\s*consensus\?\.hasOpenDispute === true,\s*insight,\s*bundle\)/s);
});
