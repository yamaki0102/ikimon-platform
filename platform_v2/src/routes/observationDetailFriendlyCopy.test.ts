import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { ObservationVisitBundle, ObservationVisitSubject } from "../services/observationVisitBundle.js";
import type { TaxonInsight } from "../services/taxonInsights.js";
import { buildVisibleRecordItems } from "../services/observationSceneReadModel.js";
import { renderHeroAiReadout, renderVisibleRecordItemsPanel } from "./read.js";

const routeSource = readFileSync(new URL("./read.ts", import.meta.url), "utf8");
const writeRouteSource = readFileSync(new URL("./write.ts", import.meta.url), "utf8");
const cardSource = readFileSync(new URL("../ui/observationCard.ts", import.meta.url), "utf8");
const mediaSource = readFileSync(new URL("../ui/observationMedia.ts", import.meta.url), "utf8");
const subjectProposalSource = readFileSync(new URL("../services/observationSubjectProposal.ts", import.meta.url), "utf8");
const candidateAdoptionSource = readFileSync(new URL("../services/observationCandidateAdoption.ts", import.meta.url), "utf8");
const identificationParticipationSource = readFileSync(new URL("../services/identificationParticipation.ts", import.meta.url), "utf8");
const observationVisitBundleSource = readFileSync(new URL("../services/observationVisitBundle.ts", import.meta.url), "utf8");

function sourceBetween(startMarker: string, endMarker: string): string {
  const start = routeSource.indexOf(startMarker);
  const end = routeSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing ${startMarker}`);
  assert.notEqual(end, -1, `missing ${endMarker}`);
  return routeSource.slice(start, end);
}

function visibleTextFromHtml(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[\s\S]*?<\/style>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function assertVisibleTermsInOrder(html: string, terms: string[]): void {
  const text = visibleTextFromHtml(html);
  let cursor = -1;
  for (const term of terms) {
    const index = text.indexOf(term, cursor + 1);
    assert.ok(index > cursor, `expected "${term}" after ${cursor} in: ${text}`);
    cursor = index;
  }
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

test("observation detail hero readout keeps scene candidates out of identification tabs", () => {
  const readoutSource = sourceBetween("function renderNoAssessmentCandidateReadout", "type ObservationMediaCopyContext");
  const registrationSource = sourceBetween("export async function registerReadRoutes", "const canonicalDetailPath");

  assert.match(readoutSource, /bundle: ObservationVisitBundle \| null = null/);
  assert.match(readoutSource, /renderHeroSceneCandidateTargets\(subject, bundle\)/);
  assert.match(readoutSource, /renderNoAssessmentCandidateReadout\(subject, hasOpenDispute, bundle\)/);
  assert.match(readoutSource, /obs-ai-detail-box/);
  assert.match(readoutSource, /candidateReadingMap\(bundle\)/);
  assert.match(readoutSource, /findCandidateReading\(readingMap/);
  assert.match(readoutSource, /fallbackCandidateReadingForSubject/);
  assert.match(readoutSource, /obs-ai-merged-row/);
  assert.match(readoutSource, /obs-ai-merged-label">根拠/);
  assert.match(readoutSource, /sourceReading\.visibleFeatures/);
  assert.match(readoutSource, /sourceReading\.weakPoints/);
  assert.match(readoutSource, /sourceReading\.shootingTips/);
  assert.match(readoutSource, /renderAiSizeSummary\(sourceReading\.sizeAssessment\)/);
  assert.match(readoutSource, /renderAiTaxonStory\(null, candidateName, sourceReading\.scientificName \|\| subject\.scientificName\)/);
  assert.match(readoutSource, /subjectIdentificationName\(subject\)/);
  assert.match(readoutSource, /isWeakIdentificationCandidateName\(directCandidateName\) && identificationName \? identificationName : directCandidateName/);
  assert.match(readoutSource, /lookupLocalTaxonName\(candidateName\)\?\.scientificName/);
  assert.match(readoutSource, /renderAiTaxonStory\(insight, candidateName, subject\.scientificName \|\| aiAssessment\.recommendedScientificName \|\| fallbackScientificName\)/);
  assert.match(readoutSource, /確かめる点/);
  assert.match(readoutSource, /追加で見る点/);
  assert.match(readoutSource, /sceneTargets \|\| currentTarget/);
  assert.match(readoutSource, /!localNameCandidates && isIdentificationTabSubject\(subject\)/);
  assert.match(readoutSource, /同じ場面内の名前候補として残っています/);
  assert.doesNotMatch(readoutSource, /<p class="obs-hint-eyebrow">名前のいま/);
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

test("hero AI readout surfaces concrete taxon candidates when the primary label is weak", () => {
  const subject = {
    occurrenceId: "occ:record-weak:0",
    visitId: "record-weak",
    subjectIndex: 0,
    displayName: "未同定の植栽低木",
    scientificName: null,
    vernacularName: null,
    rank: "lifeform",
    roleHint: "primary",
    confidence: null,
    identificationCount: 0,
    latestAssessmentBand: "low",
    latestAssessmentGeneratedAt: "2026-05-17T00:00:00.000Z",
    isPrimary: true,
    priorityScore: 40,
    focusReason: "つやのある葉",
    roleLabel: "主対象",
    evidenceTier: 0,
    aiAssessmentStatus: "ai_judgement",
    aiReviewAgreeCount: 0,
    aiReviewDisagreeCount: 0,
    aiCandidateName: "未同定の植栽低木",
    aiCandidateRank: "lifeform",
    adoptedFromAiCandidate: false,
    adoptedCandidateId: null,
    adoptedCandidateNote: null,
    subjectSource: null,
    proposedByUserId: null,
    isAiCandidate: true,
    hasSpecialistApproval: false,
    identifications: [],
    lineage: [],
    regions: [],
    previousAiAssessment: null,
    aiAssessment: {
      assessmentId: "assess-weak",
      aiRunId: "run-weak",
      pipelineVersion: "test",
      taxonomyVersion: "test",
      interpretationStatus: "completed",
      confidenceBand: "low",
      modelUsed: "fixture",
      recommendedRank: "lifeform",
      recommendedTaxonName: "未同定の植栽低木",
      recommendedScientificName: null,
      bestSpecificTaxonName: null,
      narrative: "",
      simpleSummary: "つやのある葉が見えます。",
      observerBoost: "",
      nextStepText: "",
      stopReason: "",
      funFact: "",
      funFactGrounded: false,
      diagnosticFeaturesSeen: ["つやのある緑色の葉"],
      missingEvidence: [],
      similarTaxa: [],
      distinguishingTips: [],
      confirmMore: [],
      geographicContext: "",
      seasonalContext: "",
      areaInference: {
        vegetationStructureCandidates: [],
        successionStageCandidates: [],
        humanInfluenceCandidates: [],
        moistureRegimeCandidates: [],
        managementHintCandidates: [],
      },
      managementActionCandidates: [],
      shotSuggestions: [],
      candidateReadings: [],
      sizeAssessment: null,
      noveltyHint: null,
      invasiveResponse: null,
      claimRefsUsed: [],
      navigableOs: null,
      generatedAt: "2026-05-17T00:00:00.000Z",
    },
  } as ObservationVisitSubject;
  const bundle = {
    visitId: "record-weak",
    canonicalSubjectId: subject.occurrenceId,
    featuredOccurrenceId: subject.occurrenceId,
    selectedReason: "fixture",
    selectionSource: "latest_ai_default",
    lockedByHuman: false,
    displayStability: "adaptive",
    selectedRun: null,
    previousRun: null,
    subjects: [subject],
    aiCandidates: [
      {
        candidateId: "candidate-ligustrum",
        suggestedOccurrenceId: null,
        displayName: "トウネズミモチ",
        scientificName: "Ligustrum lucidum",
        rank: "species",
        confidence: 0.45,
        candidateStatus: "proposed",
        note: "葉脈が候補",
        regions: [],
      },
      {
        candidateId: "candidate-tobira",
        suggestedOccurrenceId: null,
        displayName: "トベラ",
        scientificName: "Pittosporum tobira",
        rank: "species",
        confidence: 0.45,
        candidateStatus: "proposed",
        note: "葉のつやが候補",
        regions: [],
      },
    ],
  } as ObservationVisitBundle;

  const html = renderHeroAiReadout(subject, false, null, bundle);

  assert.match(html, /トウネズミモチ/);
  assert.match(html, /トベラ/);
  assert.match(html, /45%/);
  assert.match(html, /data-ai-target="candidate:candidate-ligustrum"/);
  assert.match(html, /data-ai-panel="candidate:candidate-ligustrum" hidden/);
  assert.match(html, /data-ai-candidate-index="2" data-ai-candidate-total="3"/);
  assert.match(html, /Ligustrum lucidum/);
});

test("AI candidate tabs have synchronized hero and identification targets", () => {
  const readoutSource = sourceBetween("function renderHeroAiCandidateTargets", "function renderNoAssessmentCandidateReadout");
  const identifySource = sourceBetween("function renderIdentificationCandidateSwitch", "function normalizeCandidateReadingKey");
  const heroSource = sourceBetween("function renderNoAssessmentCandidateReadout", "type ObservationMediaCopyContext");
  const polishSource = sourceBetween("function renderLocalObservationPolishScript", "const PUBLIC_ORIGIN");

  assert.match(readoutSource, /data-ai-target="\$\{escapeHtml\(aiCandidatePanelKey\(candidate\)\)\}"/);
  assert.match(heroSource, /renderAiCandidateDetailPanels\(bundle\)/);
  assert.match(identifySource, /panelKey: occurrenceHref \? candidate\.suggestedOccurrenceId : aiCandidatePanelKey\(candidate\)/);
  assert.match(identifySource, /data-ai-candidate-meter-value/);
  assert.match(identifySource, /obs-frame-candidate-current/);
  assert.match(identifySource, /aria-current="true"/);
  assert.match(polishSource, /function selectAiCandidateTarget/);
  assert.match(polishSource, /querySelectorAll\('\[data-ai-target\]'\)/);
  assert.match(polishSource, /querySelectorAll\('\[data-ai-panel\]'\)/);
  assert.match(polishSource, /setAttribute\('aria-current', 'true'\)/);
});

test("candidate tab status rank follows the visible candidate name", () => {
  const subject = {
    occurrenceId: "occ-millipede-class",
    displayName: "倍脚綱 (ヤスデ網)",
    vernacularName: null,
    scientificName: "Diplopoda",
    rank: "order",
    aiCandidateRank: null,
    identifications: [],
    identificationCount: 0,
    aiAssessment: null,
    focusReason: "丸まった小さなヤスデ",
  } as unknown as ObservationVisitSubject;
  const peer = {
    occurrenceId: "occ-polydesmida",
    displayName: "オビヤスデ目の一種",
    vernacularName: null,
    scientificName: null,
    rank: "order",
    aiCandidateRank: null,
    identifications: [],
    identificationCount: 0,
    aiAssessment: null,
    focusReason: "細長い体",
  } as unknown as ObservationVisitSubject;
  const bundle = {
    visitId: "record-1779074761133",
    canonicalSubjectId: subject.occurrenceId,
    featuredOccurrenceId: subject.occurrenceId,
    subjects: [subject, peer],
    aiCandidates: [],
  } as unknown as ObservationVisitBundle;

  const html = renderHeroAiReadout(subject, false, null, bundle);

  assert.match(html, /倍脚綱 \(ヤスデ綱\)<\/span><span class="obs-ai-target-status">綱 \/ 確認待ち<\/span>/);
  assert.match(html, /オビヤスデ目の一種<\/span><span class="obs-ai-target-status">目 \/ 確認待ち<\/span>/);
  assert.doesNotMatch(html, /倍脚綱 \(ヤスデ綱\)<\/span><span class="obs-ai-target-status">目 \/ 確認待ち<\/span>/);
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

test("dismissed AI subject candidates are not exposed in the observation bundle", () => {
  assert.match(observationVisitBundleSource, /candidate_status <> 'dismissed'/);
});

test("subject query parameters are treated as internal tabs, not canonical pages", () => {
  assert.match(routeSource, /Querystring: \{ subject\?: string; occurrence\?: string \}/);
  assert.match(routeSource, /request\.query\.subject \?\? request\.query\.occurrence \?\? null/);
  assert.match(routeSource, /request\.params\.id !== bundle\.visitId \|\| request\.query\.subject \|\| request\.query\.occurrence/);
  assert.match(routeSource, /const canonicalDetailPath = `\/observations\/\$\{encodeURIComponent\(bundle\.visitId\)\}`/);
  assert.match(routeSource, /history\.replaceState\(\{ subject: subjectId \}, '', canonicalRecordHref\)/);
  assert.match(routeSource, /event\.target[\s\S]*?closest\('\[data-subject-switch\]\[data-subject-id\]'\)/);
  assert.match(routeSource, /var getSubjectLinks = function\(\)/);
  assert.doesNotMatch(routeSource, /history\.pushState\(\{ subject: subjectId \}, '', active\.href\)/);
});

test("AI activity ledger exposes the model used for auditability", () => {
  assert.match(routeSource, /function aiModelAuditMeta/);
  assert.match(routeSource, /`モデル: \$\{model\}`/);
  assert.match(routeSource, /options\.subject\?\.aiAssessment/);
  assert.match(routeSource, /options\.subject\?\.previousAiAssessment/);
  assert.match(routeSource, /<time>\$\{escapeHtml\(aiActivityMeta\)\}<\/time>/);
});

test("AI readout tabs only expose taxon-like identification subjects", () => {
  const helperSource = sourceBetween("const IDENTIFICATION_TAB_RANKS", "function renderVisibleRecordCard");
  const targetSource = sourceBetween("function renderHeroSceneCandidateTargets", "function renderHeroAiReadout");
  const readoutSource = sourceBetween("function renderHeroAiReadout", "function renderSubjectHint");
  const identifySwitchSource = sourceBetween("function renderIdentificationCandidateSwitch", "function normalizeCandidateReadingKey");

  assert.match(helperSource, /new Set\(\["species", "subspecies", "variety", "form", "genus", "family", "order", "class"\]\)/);
  assert.match(helperSource, /未同定\|同定待ち\|名前待ち\|AI\\s\*候補\|他の植栽\|複数の低木\|植栽低木\|構成種\[:：\]\|不明\|群落\|グランドカバー\|背景\|周囲\|裸地\|踏圧/);
  assert.match(helperSource, /function isIdentificationCandidateLike/);
  assert.match(targetSource, /bundle\.subjects\.filter\(isIdentificationTabSubject\)\.slice\(0, 4\)/);
  assert.doesNotMatch(targetSource, /bundle\.subjects\.slice\(0, 4\)\.map/);
  assert.match(targetSource, /function renderHeroAiCandidateTargets/);
  assert.match(targetSource, /bundle\.aiCandidates/);
  assert.match(readoutSource, /localNameCandidates \? "" : \(renderHeroSceneCandidateTargets\(subject, bundle\) \|\| renderHeroAiCandidateTargets\(bundle\)\)/);
  assert.match(readoutSource, /!localNameCandidates && isIdentificationTabSubject\(subject\)/);
  assert.match(identifySwitchSource, /isIdentificationCandidateLike\(\{ name: label, rank: candidate\.rank, scientificName: candidate\.scientificName \}\)/);
  assert.doesNotMatch(identifySwitchSource, /candidates\.push\(\{[\s\S]*?isWeak: isWeakIdentificationCandidateName\(label\),[\s\S]*?\}\);\s*\n\s*\};\s*\n\s*\n\s*if \(options\.bundle\)/);
});

test("AI taxon story requires a real scientific name", () => {
  const storySource = sourceBetween("function renderAiTaxonStory", "function renderAiCompareList");
  const toolSource = sourceBetween("function renderLocalStoryTools", "function isLatinScientificName");
  const scriptSource = sourceBetween("function renderLocalObservationPolishScript", "const PUBLIC_ORIGIN");

  assert.match(storySource, /isWeakIdentificationCandidateName\(fallbackName\)/);
  assert.match(storySource, /isLatinScientificName\(insight\?\.scientificName\)/);
  assert.match(storySource, /insightScientificName \|\| fallbackScientificName/);
  assert.match(storySource, /isLatinScientificName\(scientificName\)/);
  assert.match(storySource, /scientificName === fallbackName/);
  assert.doesNotMatch(storySource, /!insight \|\| \(!insight\.etymology && !insight\.ecologyNote && !insight\.rarityNote\)/);
  assert.match(storySource, /fallbackScientificName/);
  assert.match(storySource, /is-minimal/);
  assert.match(storySource, /obs-local-story-title/);
  assert.doesNotMatch(storySource, /<em>\$\{escapeHtml\(scientificName\)\}<\/em>/);
  assert.match(storySource, /renderLocalStoryTools\(scientificName, readText\)/);
  assert.match(toolSource, /data-local-read-aloud-text/);
  assert.match(toolSource, /scientificNamePronunciation\(scientificName\)/);
  assert.match(routeSource, /\.obs-ai-story-head \{ display: grid; grid-template-columns: minmax\(0, 1fr\) auto;/);
  assert.match(routeSource, /\.obs-ai-story-head \.obs-local-story-title \{[^}]*flex-wrap: wrap;/);
  assert.match(routeSource, /@media \(max-width: 640px\) \{ \.obs-ai-story-head \{ grid-template-columns: 1fr; \}/);
  assert.match(scriptSource, /button\.getAttribute\('data-local-read-aloud-text'\)/);
  assert.doesNotMatch(scriptSource, /カワラヒワ。学名、クロリス・シニカ。/);
});

function buildObservationReadoutFixture(): {
  nawashiroSubject: ObservationVisitSubject;
  akamigashiwaSubject: ObservationVisitSubject;
  katabamiSubject: ObservationVisitSubject;
  bundle: ObservationVisitBundle;
  invalidInsight: TaxonInsight;
} {
  const nawashiroSubject = {
    occurrenceId: "occ:record-1778828697689:0",
    visitId: "record-1778828697689",
    subjectIndex: 0,
    displayName: "ナワシロイチゴ",
    scientificName: null,
    vernacularName: "ナワシロイチゴ",
    rank: "species",
    roleHint: "primary",
    confidence: null,
    identificationCount: 0,
    latestAssessmentBand: "high",
    latestAssessmentGeneratedAt: "2026-05-17T00:00:00.000Z",
    isPrimary: true,
    priorityScore: 100,
    focusReason: "鮮やかな赤色の集合果",
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
    regions: [],
    previousAiAssessment: null,
    aiAssessment: {
      assessmentId: "assess-nawashiro",
      aiRunId: "run-nawashiro",
      pipelineVersion: "test",
      taxonomyVersion: "test",
      interpretationStatus: "completed",
      confidenceBand: "high",
      modelUsed: "gemini-3.1-flash-image-preview+gemini-3.1-flash-lite",
      recommendedRank: "species",
      recommendedTaxonName: "ナワシロイチゴ",
      recommendedScientificName: "Rubus parvifolius",
      bestSpecificTaxonName: "ナワシロイチゴ",
      narrative: "",
      simpleSummary: "赤い実と3枚の葉っぱが特徴的な、ナワシロイチゴのようです。",
      observerBoost: "",
      nextStepText: "",
      stopReason: "",
      funFact: "",
      funFactGrounded: false,
      diagnosticFeaturesSeen: ["鮮やかな赤色の集合果", "葉のギザギザのある3出複葉", "5月の果実形成"],
      missingEvidence: [],
      similarTaxa: [],
      distinguishingTips: [],
      confirmMore: [],
      geographicContext: "",
      seasonalContext: "",
      areaInference: {
        vegetationStructureCandidates: [],
        successionStageCandidates: [],
        humanInfluenceCandidates: [],
        moistureRegimeCandidates: [],
        managementHintCandidates: [],
      },
      managementActionCandidates: [],
      shotSuggestions: [],
      candidateReadings: [
        {
          name: "ナワシロイチゴ",
          scientificName: "Rubus parvifolius",
          rank: "species",
          role: "赤い集合果",
          visibleFeatures: ["鮮やかな赤色の集合果", "葉のギザギザのある3出複葉", "5月の果実形成"],
          weakPoints: ["近縁種との比較には葉裏と茎の毛をもう少し見たいです。"],
          shootingTips: ["葉の表裏と茎の毛を近くで撮る"],
          regionalRead: "浜松市周辺で初夏に果実が目立つ場面として読めます。",
          sizeAssessment: null,
        },
        {
          name: "アカメガシワ",
          scientificName: "Mallotus japonicus",
          rank: "species",
          role: "同じ場面の樹木",
          visibleFeatures: ["大きな葉の形状", "特徴的な脈"],
          weakPoints: ["全景が不明瞭です。", "樹皮・花の集まりの未確認です。"],
          shootingTips: ["葉の全体像と枝の付き方を撮る"],
          regionalRead: "浜松市の二次林縁でよく見られるパイオニア種です。",
          sizeAssessment: null,
        },
        {
          name: "カタバミ属",
          scientificName: "Oxalis",
          rank: "genus",
          role: "地表の草本",
          visibleFeatures: ["地表の小さな3出複葉"],
          weakPoints: ["花や果実の未確認です。", "種レベルの同定に不足します。"],
          shootingTips: ["花の色彩と形を近くからで撮る"],
          regionalRead: "道端や管理地で一般的です。",
          sizeAssessment: null,
        },
      ],
      sizeAssessment: {
        typicalSizeCm: 1,
        observedSizeEstimateCm: 1.2,
        sizeClass: "typical",
        rankingHint: "この種としては平均的な果実サイズ",
        basis: "手指から推定のAI目測。",
        hedge: "誤差大です",
      },
      noveltyHint: null,
      invasiveResponse: null,
      claimRefsUsed: [],
      navigableOs: null,
      generatedAt: "2026-05-17T00:00:00.000Z",
    },
  } as ObservationVisitSubject;
  const akamigashiwaSubject = {
    ...nawashiroSubject,
    occurrenceId: "occ:record-1778828697689:1",
    subjectIndex: 1,
    displayName: "アカメガシワ",
    vernacularName: "アカメガシワ",
    scientificName: null,
    rank: "species",
    isPrimary: false,
    roleHint: "coexisting",
    aiAssessment: null,
  } as ObservationVisitSubject;
  const katabamiSubject = {
    ...nawashiroSubject,
    occurrenceId: "occ:record-1778828697689:2",
    subjectIndex: 2,
    displayName: "カタバミ属",
    vernacularName: "カタバミ属",
    scientificName: null,
    rank: "genus",
    isPrimary: false,
    roleHint: "coexisting",
    aiAssessment: null,
  } as ObservationVisitSubject;
  const bundle = {
    visitId: "record-1778828697689",
    canonicalSubjectId: nawashiroSubject.occurrenceId,
    featuredOccurrenceId: nawashiroSubject.occurrenceId,
    selectedReason: "fixture",
    selectionSource: "latest_ai_default",
    lockedByHuman: false,
    displayStability: "adaptive",
    selectedRun: null,
    previousRun: null,
    subjects: [nawashiroSubject, akamigashiwaSubject, katabamiSubject],
    aiCandidates: [],
  } as ObservationVisitBundle;
  const invalidInsight = {
    scientificName: "ナワシロイチゴ",
    vernacularName: "ナワシロイチゴ",
    etymology: "属名の Rubus は赤い実に関係します。",
    ecologyNote: "",
    lookAlikeNote: "",
    rarityNote: "",
    generatedAt: "2026-05-17T00:00:00.000Z",
    source: "cache",
  } as TaxonInsight;

  return { nawashiroSubject, akamigashiwaSubject, katabamiSubject, bundle, invalidInsight };
}

function buildKawarahiwaVideoReadoutFixture(): {
  kawarahiwaSubject: ObservationVisitSubject;
  bundle: ObservationVisitBundle;
  insight: TaxonInsight;
} {
  const kawarahiwaSubject = {
    occurrenceId: "occ:record-1778829649026:0",
    visitId: "record-1778829649026",
    subjectIndex: 0,
    displayName: "カワラヒワ",
    scientificName: "Chloris sinica",
    vernacularName: "カワラヒワ",
    rank: "species",
    roleHint: "primary",
    confidence: null,
    identificationCount: 0,
    latestAssessmentBand: "high",
    latestAssessmentGeneratedAt: "2026-05-17T00:00:00.000Z",
    isPrimary: true,
    priorityScore: 100,
    focusReason: "翼の黄色い帯と太い嘴が見える動画候補です。",
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
    regions: [],
    previousAiAssessment: null,
    aiAssessment: {
      assessmentId: "assess-kawarahiwa",
      aiRunId: "run-kawarahiwa",
      pipelineVersion: "test",
      taxonomyVersion: "test",
      interpretationStatus: "completed",
      confidenceBand: "high",
      modelUsed: "gemini-3.1-flash-image-preview+gemini-3.1-flash-lite",
      recommendedRank: "species",
      recommendedTaxonName: "カワラヒワ",
      recommendedScientificName: "Chloris sinica",
      bestSpecificTaxonName: "カワラヒワ",
      narrative: "",
      simpleSummary: "翼の黄色い帯と太い嘴から、カワラヒワにかなり近そうです。",
      observerBoost: "",
      nextStepText: "",
      stopReason: "",
      funFact: "",
      funFactGrounded: false,
      diagnosticFeaturesSeen: ["翼の黄色い帯", "太く円錐形の嘴", "小鳥らしい体型"],
      missingEvidence: [],
      similarTaxa: [],
      distinguishingTips: [],
      confirmMore: [],
      geographicContext: "",
      seasonalContext: "",
      areaInference: {
        vegetationStructureCandidates: [],
        successionStageCandidates: [],
        humanInfluenceCandidates: [],
        moistureRegimeCandidates: [],
        managementHintCandidates: [],
      },
      managementActionCandidates: [],
      shotSuggestions: [],
      candidateReadings: [],
      sizeAssessment: {
        typicalSizeCm: 15,
        observedSizeEstimateCm: null,
        sizeClass: "typical",
        rankingHint: "平均的サイズ",
        basis: "動画内の環境要素との相対比較。",
        hedge: "誤差大です",
      },
      noveltyHint: null,
      invasiveResponse: null,
      claimRefsUsed: [],
      navigableOs: null,
      generatedAt: "2026-05-17T00:00:00.000Z",
    },
  } as ObservationVisitSubject;
  const grassSubject = {
    ...kawarahiwaSubject,
    occurrenceId: "occ:record-1778829649026:3",
    subjectIndex: 3,
    displayName: "イネ科",
    vernacularName: "イネ科",
    scientificName: null,
    rank: "family",
    roleHint: "vegetation",
    isPrimary: false,
    aiAssessment: null,
  } as ObservationVisitSubject;
  const bundle = {
    visitId: "record-1778829649026",
    canonicalSubjectId: kawarahiwaSubject.occurrenceId,
    featuredOccurrenceId: kawarahiwaSubject.occurrenceId,
    selectedReason: "fixture",
    selectionSource: "latest_ai_default",
    lockedByHuman: false,
    displayStability: "adaptive",
    selectedRun: null,
    previousRun: null,
    subjects: [kawarahiwaSubject, grassSubject],
    aiCandidates: [],
  } as ObservationVisitBundle;
  const insight = {
    scientificName: "Chloris sinica",
    vernacularName: "カワラヒワ",
    etymology: "属名 Chloris はギリシャ語で緑を意味し、種小名 sinica は中国のという意味です。",
    ecologyNote: "春は独特の声でさえずり、木の実や草の種を食べます。",
    lookAlikeNote: "",
    rarityNote: "全国の平地から低山まで一年中見られます。",
    generatedAt: "2026-05-17T00:00:00.000Z",
    source: "cache",
  } as TaxonInsight;

  return { kawarahiwaSubject, bundle, insight };
}

test("AI readout keeps scientific-name fallback when cached insight has an invalid scientific name", () => {
  const { nawashiroSubject, bundle, invalidInsight } = buildObservationReadoutFixture();

  const html = renderHeroAiReadout(nawashiroSubject, false, invalidInsight, bundle);

  assert.match(html, /ナワシロイチゴを知る/);
  assert.match(html, /Rubus parvifolius/);
  assert.match(html, /端末の声で読む/);
  assert.match(html, /data-subject-id="occ:record-1778828697689:1"/);
  assert.match(html, /アカメガシワ/);
  assert.match(html, /カタバミ属/);
  assert.doesNotMatch(html, /ナワシロイチゴを知る[\s\S]{0,80}<i class="obs-local-scientific-name">ナワシロイチゴ<\/i>/);
});

test("AI readout rendered contract follows the snapshot-like candidate order", () => {
  const {
    nawashiroSubject,
    akamigashiwaSubject,
    katabamiSubject,
    bundle,
    invalidInsight,
  } = buildObservationReadoutFixture();

  const primaryHtml = renderHeroAiReadout(nawashiroSubject, false, invalidInsight, bundle);
  const akamigashiwaHtml = renderHeroAiReadout(akamigashiwaSubject, false, null, bundle);
  const katabamiHtml = renderHeroAiReadout(katabamiSubject, false, null, bundle);

  assertVisibleTermsInOrder(primaryHtml, [
    "ナワシロイチゴ",
    "確認待ち",
    "アカメガシワ",
    "確認待ち",
    "カタバミ属",
    "確認待ち",
    "根拠",
    "鮮やかな赤色の集合果",
    "大きさの目安",
    "平均サイズ",
    "ナワシロイチゴを知る",
    "Rubus parvifolius",
    "端末の声で読む",
  ]);
  assert.match(primaryHtml, /<button class="obs-ai-target-chip" type="button" data-ai-target="occ:record-1778828697689:0" aria-pressed="true">/);
  assert.match(primaryHtml, /<a class="obs-ai-target-chip" href="\?subject=occ%3Arecord-1778828697689%3A1" data-subject-switch="1" data-subject-id="occ:record-1778828697689:1" aria-pressed="false">/);
  assert.match(primaryHtml, /<a class="obs-ai-target-chip" href="\?subject=occ%3Arecord-1778828697689%3A2" data-subject-switch="1" data-subject-id="occ:record-1778828697689:2" aria-pressed="false">/);
  assert.match(primaryHtml, /data-local-read-aloud-text="ナワシロイチゴ。学名、Rubus parvifolius。/);
  assert.doesNotMatch(visibleTextFromHtml(primaryHtml), /Rubus parvifolius\s+Rubus parvifolius/);

  assertVisibleTermsInOrder(akamigashiwaHtml, [
    "ナワシロイチゴ",
    "確認待ち",
    "アカメガシワ",
    "確認待ち",
    "カタバミ属",
    "確認待ち",
    "根拠",
    "大きな葉の形状",
    "アカメガシワを知る",
    "Mallotus japonicus",
    "端末の声で読む",
    "確かめる点",
    "全景が不明瞭",
    "追加で見る点",
    "葉の全体像と枝の付き方を撮る",
  ]);
  assertVisibleTermsInOrder(katabamiHtml, [
    "ナワシロイチゴ",
    "確認待ち",
    "アカメガシワ",
    "確認待ち",
    "カタバミ属",
    "確認待ち",
    "根拠",
    "地表の小さな3出複葉",
    "カタバミ属を知る",
    "Oxalis",
    "端末の声で読む",
    "確かめる点",
    "花や果実の未確認",
    "追加で見る点",
    "花の色彩と形を近くからで撮る",
  ]);
});

test("AI readout rendered contract covers the kawarahiwa video classification lane", () => {
  const { kawarahiwaSubject, bundle, insight } = buildKawarahiwaVideoReadoutFixture();

  const html = renderHeroAiReadout(kawarahiwaSubject, false, insight, bundle);
  const visibleText = visibleTextFromHtml(html);

  assertVisibleTermsInOrder(html, [
    "カワラヒワ",
    "かなり近そう",
    "翼の黄色と太い嘴から読んだ候補",
    "イネ科",
    "分類候補",
    "科レベルの分類候補。種名ではない",
    "根拠",
    "翼の黄色い帯",
    "太く円錐形の嘴",
    "大きさの目安",
    "平均サイズ",
    "カワラヒワを知る",
    "Chloris sinica",
    "読み: クロリス・シニカ",
    "端末の声で読む",
    "名前の由来",
    "似た仲間との見分け",
    "アオジより翼の黄色い帯がはっきり出るか",
  ]);
  assert.match(html, /data-local-name-candidates="1"/);
  assert.match(html, /href="\?subject=occ%3Arecord-1778829649026%3A3" data-subject-switch="1" data-subject-id="occ:record-1778829649026:3"/);
  assert.equal((html.match(/class="obs-local-scientific-name">Chloris sinica<\/i>/gu) ?? []).length, 1);
  assert.match(html, /data-local-read-aloud-text="カワラヒワ。学名、クロリス・シニカ。/);
  assert.doesNotMatch(visibleText, /Chloris sinica\s+Chloris sinica/);
  assert.doesNotMatch(visibleText, /イネ科植物/);
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
