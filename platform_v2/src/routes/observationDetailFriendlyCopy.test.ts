import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { ObservationVisitBundle, ObservationVisitSubject } from "../services/observationVisitBundle.js";
import type { TaxonInsight } from "../services/taxonInsights.js";
import { buildVisibleRecordItems, type VisibleRecordItem } from "../services/observationSceneReadModel.js";
import {
  classifyObservationDetailAiState,
  observationDetailP0Copy,
  observationDetailAiStateLabel,
  observationOwnerCoordinate,
  observationOwnerNoteValue,
  observationQualityLocationLabel,
  renderHeroAiReadout,
  renderIdentificationCandidateSwitch,
  renderObservationRecordInsightText,
  renderVisibleRecordItemsPanel,
} from "./read.js";

const routeSource = readFileSync(new URL("./read.ts", import.meta.url), "utf8");
const writeRouteSource = readFileSync(new URL("./write.ts", import.meta.url), "utf8");
const cardSource = readFileSync(new URL("../ui/observationCard.ts", import.meta.url), "utf8");
const mediaSource = readFileSync(new URL("../ui/observationMedia.ts", import.meta.url), "utf8");
const identificationParticipationSource = readFileSync(new URL("../services/identificationParticipation.ts", import.meta.url), "utf8");
const observationVisitBundleSource = readFileSync(new URL("../services/observationVisitBundle.ts", import.meta.url), "utf8");
const siteContributionSource = readFileSync(new URL("../services/observationSiteContribution.ts", import.meta.url), "utf8");
const cloudflareWorkerSource = readFileSync(new URL("../../cloudflare_shadow/src/index.ts", import.meta.url), "utf8");

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
    "AI解説を作成中です",
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
    "記録の土台",
    "日時・場所・環境を土台にする",
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
    "この記録のいいところ",
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
  assert.match(visibleItemsSource, /data-scene-overview-target/);
  assert.match(visibleItemsSource, /data-annotation-subject-id/);
  assert.match(visibleItemsSource, /data-annotation-candidate-id/);
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
  assert.match(routeSource, /hasAnnotationSwitchTargets/);
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

test("observation detail keeps one dominant enrichment action and owner-only private fields", () => {
  const qualitySource = sourceBetween("function renderObservationQualityCard", "type ObservationNextAction");
  const heroSource = sourceBetween("function renderObservationReadingHero", "function renderObservationReadProgress");
  const registrationSource = sourceBetween("export async function registerReadRoutes", "const canonicalDetailPath");

  const jaP0 = observationDetailP0Copy("ja");
  assert.equal(observationQualityLocationLabel({ latitude: 35.123456, longitude: 137.654321 }, false, "公開エリア", jaP0), "公開エリア");
  assert.equal(observationQualityLocationLabel({ latitude: 35.123456, longitude: 137.654321 }, true, "公開エリア", jaP0), "35.123456, 137.654321");
  assert.equal(observationOwnerCoordinate(35.123456, false), "");
  assert.equal(observationOwnerCoordinate(35.123456, true), "35.123456");
  assert.equal(observationOwnerNoteValue("非公開メモ", false), "");
  assert.equal(observationOwnerNoteValue("非公開メモ", true), "非公開メモ");

  assert.match(routeSource, /function observationQualityLocationLabel\([\s\S]*canSeeCanonicalLocation[\s\S]*publicPlaceLabel/);
  assert.match(routeSource, /if \(canSeeCanonicalLocation && typeof snapshot\.latitude === "number" && typeof snapshot\.longitude === "number"\)/);
  assert.match(qualitySource, /observationQualityLocationLabel\(options\.snapshot, options\.canEditOrigin, options\.placeLabel, options\.p0Copy\)/);
  assert.match(qualitySource, /const ownerLatitude = observationOwnerCoordinate\(options\.snapshot\.latitude, options\.canEditOrigin\)/);
  assert.match(qualitySource, /const ownerLongitude = observationOwnerCoordinate\(options\.snapshot\.longitude, options\.canEditOrigin\)/);
  assert.match(qualitySource, /data-location-lat="\$\{escapeHtml\(ownerLatitude\)\}" data-location-lng="\$\{escapeHtml\(ownerLongitude\)\}"/);
  assert.match(qualitySource, /data-location-lat-input value="\$\{escapeHtml\(ownerLatitude\)\}"/);
  assert.match(qualitySource, /data-location-lng-input value="\$\{escapeHtml\(ownerLongitude\)\}"/);
  assert.match(qualitySource, /options\.p0Copy\.mediaEvidenceAvailable/);
  assert.doesNotMatch(qualitySource, /isGreenfinchSnapshot|AI確認済み/);
  assert.match(registrationSource, /const ownerNoteValue = observationOwnerNoteValue\(snapshot\.note, isOwner\)/);

  assert.match(heroSource, /<details id="record-details" class="obs-record-details">/);
  assert.match(heroSource, /<summary data-observation-primary-cta="enrich_record">/);
  assert.match(heroSource, /options\.p0Copy\.enrichTitle/);
  assert.match(heroSource, /options\.p0Copy\.enrichHelp/);
  assert.match(heroSource, /options\.p0Copy\.saved/);
  assert.match(routeSource, /return copy\.aiProcessedCandidate/);
  assert.equal((heroSource.match(/data-observation-primary-cta=/g) || []).length, 1);
  assert.match(registrationSource, /const nextActionRail = ""/);
});

test("observation detail P0 status and enrichment copy stays localized", () => {
  const expected = {
    en: { saved: "Saved", enrichTitle: "Add record details", candidate: "candidate unverified", reviewed: "human-reviewed", media: "Media evidence available" },
    es: { saved: "Guardado", enrichTitle: "Completar el registro", candidate: "candidato sin verificar", reviewed: "revisado por una persona", media: "Evidencia multimedia disponible" },
    "pt-BR": { saved: "Salvo", enrichTitle: "Completar o registro", candidate: "candidato não verificado", reviewed: "revisado por uma pessoa", media: "Evidência de mídia disponível" },
  } as const;

  for (const [lang, terms] of Object.entries(expected) as Array<[keyof typeof expected, typeof expected[keyof typeof expected]]>) {
    const copy = observationDetailP0Copy(lang);
    assert.equal(copy.saved, terms.saved);
    assert.equal(copy.enrichTitle, terms.enrichTitle);
    assert.match(copy.aiProcessedCandidate, new RegExp(terms.candidate));
    assert.match(copy.aiVerified, new RegExp(terms.reviewed));
    assert.equal(copy.mediaEvidenceAvailable, terms.media);
    assert.doesNotMatch(JSON.stringify(copy), /保存済み|記録を詳しくする|候補は未確認|地点未入力/);
  }
  assert.equal(observationDetailP0Copy("ja").aiVerified, "AI処理済み・人が確認済み");
  assert.equal(observationDetailP0Copy("ja").mediaEvidenceAvailable, "メディア証拠あり");
});

test("observation detail AI state classifier preserves durable processing and review semantics", () => {
  const cases = [
    { label: "queued request", facts: { aiRequestStatus: "queued" }, expected: "processing" },
    { label: "processing request", facts: { aiRequestStatus: "processing" }, expected: "processing" },
    { label: "AI judgement candidate", facts: { aiAssessmentStatus: "ai_judgement" }, expected: "candidate_unverified" },
    { label: "audio candidate", facts: { aiAssessmentStatus: "ai_audio_candidate" }, expected: "candidate_unverified" },
    { label: "candidate ready", facts: { aiAssessmentStatus: "candidate_ready" }, expected: "candidate_unverified" },
    { label: "failed request", facts: { aiRequestStatus: "failed" }, expected: "retry" },
    { label: "retry required", facts: { aiAssessmentStatus: "retry_required" }, expected: "retry" },
    { label: "unavailable request", facts: { aiRequestStatus: "unavailable" }, expected: "unavailable" },
    { label: "provider unavailable", facts: { providerAvailable: false }, expected: "unavailable" },
    { label: "reviewer verified", facts: { aiAssessmentStatus: "reviewer_verified" }, expected: "verified" },
    { label: "reviewer rejected", facts: { aiAssessmentStatus: "reviewer_rejected" }, expected: "rejected" },
    {
      label: "new processing run supersedes a stale candidate",
      facts: { aiRequestStatus: "processing", aiAssessmentStatus: "ai_judgement" },
      expected: "processing",
    },
    {
      label: "new failed run supersedes a stale human review",
      facts: { aiRequestStatus: "failed", aiAssessmentStatus: "reviewer_verified" },
      expected: "retry",
    },
    {
      label: "new unavailable run supersedes a stale human review",
      facts: { aiRequestStatus: "unavailable", aiAssessmentStatus: "reviewer_verified" },
      expected: "unavailable",
    },
    {
      label: "completed run delegates to the current human review",
      facts: { aiRequestStatus: "completed", aiAssessmentStatus: "reviewer_verified" },
      expected: "verified",
    },
    { label: "legacy accepted is not reviewer verified", facts: { aiAssessmentStatus: "accepted" }, expected: "completed" },
    { label: "legacy reviewed is not reviewer verified", facts: { aiAssessmentStatus: "reviewed" }, expected: "completed" },
    { label: "legacy identified is not reviewer verified", facts: { aiAssessmentStatus: "identified" }, expected: "completed" },
    { label: "missing durable state", facts: { aiRequestStatus: null, aiAssessmentStatus: null }, expected: "unknown" },
  ] as const;

  for (const item of cases) {
    assert.equal(classifyObservationDetailAiState(item.facts), item.expected, item.label);
  }

  const copy = observationDetailP0Copy("ja");
  assert.equal(
    observationDetailAiStateLabel(
      { aiRequestStatus: null, aiAssessmentStatus: null },
      { aiAssessment: null },
      copy,
    ),
    copy.aiUnknown,
  );
  assert.notEqual(copy.aiUnknown, copy.aiNone);
  for (const status of ["accepted", "reviewed", "identified"]) {
    assert.notEqual(classifyObservationDetailAiState({ aiAssessmentStatus: status }), "verified");
  }
});

test("observation detail keeps nearby guide cards owner-scoped and capped", () => {
  const registrationSource = sourceBetween("export async function registerReadRoutes", "const canonicalDetailPath");

  assert.match(routeSource, /function renderRecordPageNearbyGuideShelf/);
  assert.match(routeSource, /この記録の近くに現地ガイドがあります/);
  assert.match(routeSource, /最大2件表示/);
  assert.match(registrationSource, /canSeeCanonicalLocation && snapshot\.latitude != null && snapshot\.longitude != null/);
  assert.match(registrationSource, /maxCards: 2/);
  assert.match(registrationSource, /heroBlock\}\$\{recordPageNearbyGuideBlock\}/);
});

test("observation detail exposes owner-only site contribution state through policy services", () => {
  const contributionSource = sourceBetween("function renderObservationSiteContributionPanel", "function renderObservationOwnerDeleteScript");
  const registrationSource = sourceBetween("export async function registerReadRoutes", "const canonicalDetailPath");

  assert.match(routeSource, /buildObservationSiteContribution/);
  assert.match(routeSource, /decideObservationPublicationPolicy/);
  assert.match(routeSource, /getObservationDataRights/);
  assert.match(routeSource, /getField\(options\.snapshot\.placeId\)/);
  assert.match(contributionSource, /data-site-contribution/);
  assert.match(contributionSource, /この記録が場所のプロフィールにどう使われるか/);
  assert.match(contributionSource, /data-site-contribution-action/);
  assert.match(siteContributionSource, /違う/);
  assert.match(siteContributionSource, /非公開/);
  assert.match(siteContributionSource, /追加で撮る/);
  assert.doesNotMatch(contributionSource, /latitude|longitude|正確な座標|exact/);
  assert.match(registrationSource, /const siteContributionBlock = await buildObservationDetailSiteContribution/);
  assert.match(registrationSource, /ownerPublicStateBlock\}\$\{siteContributionBlock\}\$\{ownerToolsBlock/);
});

test("observation detail hero readout keeps scene candidates out of identification tabs", () => {
  const readoutSource = sourceBetween("function renderNoAssessmentCandidateReadout", "type ObservationMediaCopyContext");
  const registrationSource = sourceBetween("export async function registerReadRoutes", "const canonicalDetailPath");

  assert.match(readoutSource, /bundle: ObservationVisitBundle \| null = null/);
  assert.match(readoutSource, /renderNoAssessmentCandidateReadout\(subject, hasOpenDispute, bundle, groundingAssets, glossaryTerms\)/);
  assert.match(readoutSource, /AI解説を作成中です/);
  assert.match(readoutSource, /写真・動画を読み込んでいます/);
  assert.doesNotMatch(readoutSource, /candidateReadingMap\(bundle\)/);
  assert.doesNotMatch(readoutSource, /findCandidateReading\(readingMap/);
  assert.doesNotMatch(readoutSource, /fallbackCandidateReadingForSubject/);
  assert.doesNotMatch(readoutSource, /obs-ai-detail-box/);
  assert.doesNotMatch(readoutSource, /同じ場面内の名前候補として残っています/);
  assert.match(readoutSource, /subjectIdentificationName\(subject\)/);
  assert.match(readoutSource, /isWeakIdentificationCandidateName\(directCandidateName\) && identificationName \? identificationName : directCandidateName/);
  assert.match(readoutSource, /lookupLocalTaxonName\(candidateName\)\?\.scientificName/);
  assert.match(readoutSource, /renderAiTaxonStory\(insight, candidateName, subject\.scientificName \|\| aiAssessment\.recommendedScientificName \|\| fallbackScientificName\)/);
  assert.match(readoutSource, /sceneTargets \|\| currentTarget/);
  assert.match(readoutSource, /!localNameCandidates && isIdentificationTabSubject\(subject\)/);
  assert.doesNotMatch(readoutSource, /<p class="obs-hint-eyebrow">名前のいま/);
  assert.match(registrationSource, /nameStatusBlock: renderHeroAiReadout\(currentSubject,[\s\S]*?insight, bundle, groundingAssets, glossaryTerms\)/);
  assert.match(registrationSource, /data-subject-ai-readout-template=[\s\S]*?renderHeroAiReadout\(subject,[\s\S]*?bundle, groundingAssets, glossaryTerms\)/);
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

test("stored AI geographic hints are sanitized with the verified public place label", () => {
  const sanitizeSource = sourceBetween("function sanitizeAiGeographicContext", "function observationMediaCopy");
  const subjectHintSource = sourceBetween("function renderSubjectHint", "function renderCivicContextBlock");
  const registrationSource = sourceBetween("export async function registerReadRoutes", "const canonicalDetailPath");

  assert.match(sanitizeSource, /静岡県静岡市/);
  assert.match(sanitizeSource, /静岡市/);
  assert.match(subjectHintSource, /sanitizeAiGeographicContext\(aiAssessment\.geographicContext, verifiedPlaceLabel\)/);
  assert.match(registrationSource, /renderSubjectHint\(subject, siteBriefResult \?\? null, snapshot\.photoAssets, basePath, mediaContext, glossaryTerms, fieldAdviceContext, heroPlaceLabel\)/);
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
        regions: [{
          regionId: "region-ligustrum",
          occurrenceId: null,
          candidateId: "candidate-ligustrum",
          assetId: "asset-main-photo",
          rect: { x: 0.08, y: 0.12, width: 0.24, height: 0.22 },
          frameTimeMs: null,
          confidenceScore: 0.86,
          sourceKind: "vision",
          sourceModel: "fixture",
          note: null,
        }],
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

  const html = renderHeroAiReadout(subject, false, null, bundle, [{ assetId: "asset-main-photo", label: "画像1" }]);

  assert.match(html, /トウネズミモチ/);
  assert.match(html, /トベラ/);
  assert.match(html, /45%/);
  assert.match(html, /data-ai-target="candidate:candidate-ligustrum"/);
  assert.match(html, /data-ai-panel="candidate:candidate-ligustrum" hidden/);
  assert.match(html, /data-ai-candidate-index="2" data-ai-candidate-total="3"/);
  assert.match(html, /Ligustrum lucidum/);
  assert.match(html, /AIが主に見たところ/);
  assert.doesNotMatch(html, /この記録のいいところ/);
  assert.match(html, /つやのある緑色の葉が見えていて、次に比べる手がかりになります。/);
  assert.match(html, /data-ai-grounding-asset="asset-main-photo"/);
  assert.match(html, /画像1/);
  assert.match(html, /左上/);
  assert.match(html, /枠の確度 86%/);

  const twoClueSubject = {
    ...subject,
    aiAssessment: {
      ...(subject.aiAssessment as NonNullable<ObservationVisitSubject["aiAssessment"]>),
      assessmentId: "assess-weak-two-clues",
      diagnosticFeaturesSeen: ["つやのある緑色の葉", "明るい葉脈"],
    },
  } as ObservationVisitSubject;
  const twoClueHtml = renderHeroAiReadout(twoClueSubject, false, null, bundle, [{ assetId: "asset-main-photo", label: "画像1" }]);

  assert.match(twoClueHtml, /つやのある緑色の葉、明るい葉脈が写っていて、あとで比べる手がかりが残っています。/);
  assert.doesNotMatch(twoClueHtml, /候補を確かめる材料/);

  const mergedInsight = renderObservationRecordInsightText({
    snapshot: {
      observedAt: "2026-05-29T19:12:00.000Z",
      municipality: "浜松市浜名区",
      publicLocation: null,
    } as never,
    subject: twoClueSubject,
    recordItems: [],
    placeLabel: "浜松市浜名区",
  });

  assert.match(mergedInsight, /つやのある緑色の葉、明るい葉脈が写っていて、あとで比べる手がかりが残っています。/);
  assert.doesNotMatch(mergedInsight, /この記録のいいところ/);
});

test("AI candidate tabs have synchronized hero and identification targets", () => {
  const readoutSource = sourceBetween("function renderHeroAiCandidateTargets", "function renderNoAssessmentCandidateReadout");
  const identifySource = sourceBetween("function renderIdentificationCandidateSwitch", "function normalizeCandidateReadingKey");
  const heroSource = sourceBetween("function renderNoAssessmentCandidateReadout", "type ObservationMediaCopyContext");
  const polishSource = sourceBetween("function renderLocalObservationPolishScript", "const PUBLIC_ORIGIN");

  assert.match(readoutSource, /data-ai-target="\$\{escapeHtml\(aiCandidatePanelKey\(candidate\)\)\}"/);
  assert.match(heroSource, /renderAiCandidateDetailPanels\(bundle, groundingAssets, glossaryTerms\)/);
  assert.match(identifySource, /panelKey: occurrenceHref \? candidate\.suggestedOccurrenceId : aiCandidatePanelKey\(candidate\)/);
  assert.match(identifySource, /data-ai-candidate-meter-value/);
  assert.match(identifySource, /obs-frame-candidate-current/);
  assert.match(identifySource, /aria-current="true"/);
  assert.doesNotMatch(identifySource, /splice\(initialCurrentIndex/);
  assert.doesNotMatch(identifySource, /candidates\.unshift\(currentCandidate\)/);
  assert.match(identifySource, /isDenseCandidateList = candidates\.length >= 5/);
  assert.match(identifySource, /data-ai-candidate-list="1"/);
  assert.match(identifySource, /data-ai-candidate-search/);
  assert.match(identifySource, /data-ai-candidate-chip="1"/);
  assert.match(identifySource, /data-ai-candidate-search-text/);
  assert.match(routeSource, /\.obs-frame-candidate-switch\.is-dense \.obs-frame-identify-candidates/);
  assert.match(routeSource, /max-height: 156px !important/);
  assert.match(routeSource, /overflow-y: auto !important/);
  assert.match(routeSource, /\.obs-frame-candidate-search/);
  assert.match(routeSource, /text-overflow: clip !important/);
  assert.match(routeSource, /overflow-wrap: anywhere !important/);
  assert.match(polishSource, /function selectAiCandidateTarget/);
  assert.match(polishSource, /function filterAiCandidateList/);
  assert.match(polishSource, /querySelectorAll\('\[data-ai-target\]'\)/);
  assert.match(polishSource, /querySelectorAll\('\[data-ai-panel\]'\)/);
  assert.match(polishSource, /closest\('\[data-ai-candidate-search\]'\)/);
  assert.match(polishSource, /setAttribute\('aria-current', 'true'\)/);
});

test("observation quality change buttons are wired to real page targets", () => {
  const qualitySource = sourceBetween("function renderObservationQualityCard", "type ObservationNextAction");
  const polishSource = sourceBetween("function renderLocalObservationPolishScript", "const PUBLIC_ORIGIN");

  assert.doesNotMatch(qualitySource, /data-quality-action="date_place"/);
  assert.match(qualitySource, /data-quality-action="date"/);
  assert.match(qualitySource, /data-quality-action="location"/);
  assert.match(qualitySource, /写真を追加/);
  assert.match(qualitySource, /: "evidence"/);
  assert.match(qualitySource, /data-quality-action="\$\{isNoDetectionRecord \? "environment" : "evidence"\}"/);
  assert.match(qualitySource, /不在メモとして有効/);
  assert.match(qualitySource, /data-quality-action="identification"/);
  assert.match(qualitySource, /data-name-sheet/);
  assert.match(qualitySource, /data-name-choice="\$\{escapeHtml\(candidate\.name\)\}"/);
  assert.match(qualitySource, /data-name-save/);
  assert.match(qualitySource, /data-date-sheet/);
  assert.match(qualitySource, /data-date-save/);
  assert.match(qualitySource, /data-location-sheet/);
  assert.match(qualitySource, /data-location-map/);
  assert.match(qualitySource, /data-location-save/);
  assert.match(qualitySource, /data-quality-action="origin"/);
  assert.match(qualitySource, /data-origin-sheet/);
  assert.match(qualitySource, /data-origin-choice="\$\{escapeHtml\(option\.value\)\}"/);
  assert.match(qualitySource, /data-origin-save/);
  assert.match(qualitySource, /data-origin-toast/);
  assert.match(qualitySource, /data-quality-action="media"/);
  assert.match(qualitySource, /data-quality-action-status/);
  assert.match(qualitySource, /環境・イベントレコード/);
  assert.match(qualitySource, /data-env-edit-all/);
  assert.match(qualitySource, /obs-local-quality-field-edit/);
  assert.match(qualitySource, /data-env-edit="\$\{escapeHtml\(field\.field\)\}"/);
  assert.match(qualitySource, /data-env-sheet/);
  assert.match(qualitySource, /data-env-input="\$\{escapeHtml\(field\.field\)\}"/);
  assert.match(qualitySource, /data-env-save/);
  assert.match(qualitySource, /data-env-toast/);
  assert.match(polishSource, /function handleQualityAction/);
  assert.match(polishSource, /event\.target[\s\S]*?closest\('\.obs-local-quality-change\[data-quality-action\]'\)/);
  assert.match(polishSource, /function openNameSheet/);
  assert.match(polishSource, /function postName/);
  assert.match(polishSource, /\/identifications/);
  assert.match(polishSource, /function openDateSheet/);
  assert.match(polishSource, /occurrenceEndpoint\('\/observed-at'\)/);
  assert.match(polishSource, /function openLocationSheet/);
  assert.match(polishSource, /function setLocationFromMap/);
  assert.match(polishSource, /occurrenceEndpoint\('\/location'\)/);
  assert.match(polishSource, /function openOriginSheet/);
  assert.match(polishSource, /\/origin/);
  assert.match(polishSource, /function openEnvSheet/);
  assert.match(polishSource, /occurrenceEndpoint\('\/environment-record'\)/);
  assert.doesNotMatch(polishSource, /\/environment-field/);
  assert.match(polishSource, /data-name-undo/);
  assert.match(polishSource, /data-date-undo/);
  assert.match(polishSource, /data-location-undo/);
  assert.match(polishSource, /data-env-undo/);
  assert.match(polishSource, /data-origin-undo/);
  assert.match(polishSource, /querySelector\('\[data-photo-recovery\]'\)/);
  assert.doesNotMatch(polishSource, /由来メモ: /);
});

test("AI readout stays simple while the assessment is still being created", () => {
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

  assert.match(html, /写真を追加すると解説を作れます/);
  assert.match(html, /メモは保存済みです/);
  assert.doesNotMatch(html, /同じ場面内の名前候補として残っています/);
  assert.doesNotMatch(html, /data-ai-target/);
  assert.doesNotMatch(html, /obs-ai-detail-box/);
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

test("candidate action writes are retired from Fastify and handled by the Worker D1 ledger", () => {
  assert.doesNotMatch(writeRouteSource, /\/api\/v1\/observations\/:id\/candidates\/:candidateId\/propose/);
  assert.doesNotMatch(writeRouteSource, /\/api\/v1\/observations\/:id\/candidates\/:candidateId\/adopt/);
  assert.doesNotMatch(writeRouteSource, /adoptObservationCandidate/);
  assert.doesNotMatch(writeRouteSource, /handleCandidateAdoption/);
  assert.match(cloudflareWorkerSource, /requestCompatibleCandidateAction/);
  assert.match(cloudflareWorkerSource, /candidate_action_requests/);
  assert.match(cloudflareWorkerSource, /actionKind === "adopt" && ownerUserId !== session\.userId/);
  assert.match(routeSource, /candidateAction/);
});

test("reassessment request writes are retired from Fastify and handled by the Worker D1 ledger", () => {
  assert.doesNotMatch(writeRouteSource, /\/api\/v1\/observations\/:id\/reassess/);
  assert.doesNotMatch(writeRouteSource, /\/api\/v1\/observations\/:id\/reassess-from-video/);
  assert.doesNotMatch(writeRouteSource, /reassessObservation/);
  assert.doesNotMatch(writeRouteSource, /reassessFromVideoThumb/);
  assert.match(cloudflareWorkerSource, /requestCompatibleObservationReassessment/);
  assert.match(cloudflareWorkerSource, /observation_reassessment_requests/);
  assert.match(cloudflareWorkerSource, /source: "cloudflare_observation_reassessment_request_ledger"/);
  assert.match(cloudflareWorkerSource, /requestKind/);
});

test("management candidate confirmations are retired from Fastify and handled by the Worker D1 ledger", () => {
  assert.doesNotMatch(writeRouteSource, /\/api\/v1\/observations\/:id\/management-candidates\/:index\/confirm/);
  assert.doesNotMatch(writeRouteSource, /confirmManagementActionCandidate/);
  assert.match(cloudflareWorkerSource, /confirmCompatibleManagementCandidate/);
  assert.match(cloudflareWorkerSource, /management_candidate_confirmations/);
  assert.match(cloudflareWorkerSource, /source: "cloudflare_management_candidate_confirmation_ledger"/);
});

test("identification and dispute writes are retired from Fastify and handled by the Worker D1 ledger", () => {
  assert.doesNotMatch(writeRouteSource, /\/api\/v1\/observations\/:id\/identifications/);
  assert.doesNotMatch(writeRouteSource, /\/api\/v1\/observations\/:id\/disputes/);
  assert.doesNotMatch(writeRouteSource, /submitObservationIdentification/);
  assert.doesNotMatch(writeRouteSource, /openObservationDispute/);
  assert.match(cloudflareWorkerSource, /submitCompatibleObservationIdentification/);
  assert.match(cloudflareWorkerSource, /openCompatibleObservationDispute/);
  assert.match(cloudflareWorkerSource, /observation_identifications/);
  assert.match(cloudflareWorkerSource, /observation_identification_disputes/);
  assert.match(cloudflareWorkerSource, /source: "cloudflare_observation_identifications"/);
  assert.match(cloudflareWorkerSource, /source: "cloudflare_observation_identification_disputes"/);
});

test("observation reaction writes are retired from Fastify and handled by the Worker D1 table", () => {
  assert.doesNotMatch(writeRouteSource, /\/api\/v1\/observations\/:id\/reactions\/:type/);
  assert.doesNotMatch(writeRouteSource, /toggleReaction/);
  assert.doesNotMatch(writeRouteSource, /isValidReactionType/);
  assert.match(cloudflareWorkerSource, /toggleObservationReaction/);
  assert.match(cloudflareWorkerSource, /observation_reactions/);
});

test("media annotations can be focused from AI evidence without taking over the photo surface", () => {
  assert.match(mediaSource, /ObservationMediaAnnotationTarget/);
  assert.match(mediaSource, /data-annotation-target/);
  assert.match(mediaSource, /data-annotation-subject-id/);
  assert.match(mediaSource, /data-annotation-candidate-id/);
  assert.match(mediaSource, /obs-video-annotation-rail/);
  assert.match(mediaSource, /summary\.hidden = true/);
  assert.match(mediaSource, /templatesHtml/);
  assert.match(mediaSource, /setPreviewAnnotations/);
  assert.match(mediaSource, /previewAnnotations\.hidden = !annotationHtml/);
  assert.match(routeSource, /buildObservationMediaAnnotationTargets/);
  assert.match(routeSource, /renderObservationMedia\(snapshot,\s*currentSubject,\s*mediaAnnotationTargets/s);
  assert.match(routeSource, /data-ai-grounding-asset/);
  assert.match(routeSource, /focusGrounding/);
  assert.match(routeSource, /ikimon:focus-media-annotation/);
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

test("subject switching reserves panel height before replacing candidate content", () => {
  assert.match(routeSource, /var switchRegions = \[/);
  assert.match(routeSource, /templateAttr: 'data-subject-ai-readout-template'/);
  assert.match(routeSource, /templateAttr: 'data-subject-identify-template'/);
  assert.match(routeSource, /measureSwitchTemplateHeight/);
  assert.match(routeSource, /captureCandidateListScroll/);
  assert.match(routeSource, /restoreCandidateListScroll\(candidateListScroll\)/);
  assert.match(routeSource, /root\.style\.minHeight = maxHeight \+ 'px'/);
  assert.match(routeSource, /stabilizeSwitchHeights\(\);\s*renderSubject\(currentSubjectId, false\)/);
  assert.doesNotMatch(routeSource, /templateAttr: 'data-subject-shot-feedback-template'/);
});

test("observation detail surfaces shot feedback outside hidden subject hints", () => {
  assert.match(routeSource, /function renderObservationShotFeedbackSurface/);
  assert.match(routeSource, /function collectObservationShotFeedbackGroups/);
  assert.match(routeSource, /function shotFeedbackBenefitText/);
  assert.match(routeSource, /obs-shot-group-list/);
  assert.match(routeSource, /getGlossaryTermsForScope\(\{ lang, scopeTags: \["observation"\] \}\)/);
  assert.match(routeSource, /renderGlossaryText/);
  assert.match(routeSource, /term-hint-pop/);
  assert.match(routeSource, /function renderGlossaryHintScript/);
  assert.match(routeSource, /closeHints\(null\)/);
  assert.match(routeSource, /term-hint\.is-open \.term-hint-pop/);
  assert.doesNotMatch(routeSource, /term-hint:hover \.term-hint-pop/);
  assert.match(routeSource, /candidateReadings/);
  assert.match(routeSource, /renderObservationShotFeedbackSurface\(bundle,\s*mediaContext,\s*glossaryTerms\)/);
  assert.match(routeSource, /季節や別地点の記録と比べやすくなります/);
  assert.match(routeSource, /似た花との違いや季節ごとの姿を説明しやすくなります/);
  assert.doesNotMatch(routeSource, /data-obs-switch-shot-feedback/);
  assert.doesNotMatch(routeSource, /data-subject-shot-feedback-template/);
  assert.match(routeSource, /\$\{heroBlock\}\$\{recordPageNearbyGuideBlock\}\$\{shotFeedbackBlock\}/);
});

test("AI activity ledger exposes the model used for auditability", () => {
  assert.match(routeSource, /function aiModelAuditMeta/);
  assert.match(routeSource, /`モデル: \$\{model\}`/);
  assert.match(routeSource, /options\.subject\?\.aiAssessment/);
  assert.match(routeSource, /options\.subject\?\.previousAiAssessment/);
  assert.match(routeSource, /<time>\$\{escapeHtml\(aiActivityMeta\)\}<\/time>/);
});

function visibleRecordItemFixture(overrides: Partial<VisibleRecordItem>): VisibleRecordItem {
  return {
    key: "item:test",
    source: "candidate",
    occurrenceId: null,
    candidateId: "candidate:test",
    displayName: "周囲の草地",
    roleLabel: "周囲の草地",
    rankLabel: null,
    confidence: null,
    trustLevel: "reference",
    trustLabel: "参考",
    bucket: "reference",
    href: null,
    note: "草地と裸地が一緒に写る",
    historyLabel: null,
    historyDetail: null,
    isCurrent: false,
    isFeatured: false,
    adoptEndpoint: null,
    adoptLabel: null,
    proposalKind: "none",
    ...overrides,
  };
}

test("record insight does not turn arthropods into plants because surrounding grass is visible", () => {
  const text = renderObservationRecordInsightText({
    snapshot: {
      observedAt: "2026-05-18T03:25:00.000Z",
      municipality: "浜松市浜名区",
      publicLocation: { label: "浜松市浜名区" },
    } as any,
    subject: {
      displayName: "同定待ち",
      scientificName: null,
      vernacularName: null,
      rank: "class",
      aiCandidateName: null,
      aiCandidateRank: null,
      aiAssessment: {
        recommendedTaxonName: "ヤスデ綱（またはムカデ綱）",
        recommendedScientificName: "Diplopoda or Chilopoda",
        recommendedRank: "class",
      },
    } as any,
    recordItems: [
      visibleRecordItemFixture({
        displayName: "周囲の草地",
        roleLabel: "周囲の草地",
        note: "裸地と草地、踏圧が見える",
      }),
    ],
    placeLabel: "浜松市浜名区",
  });

  assert.match(text, /ヤスデ綱/);
  assert.match(text, /小さな動物/);
  assert.match(text, /足元/);
  assert.doesNotMatch(text, /植物|どこに生え|花の量/);
});

test("record insight uses a concrete AI candidate instead of unresolved subject wording", () => {
  const text = renderObservationRecordInsightText({
    snapshot: {
      observedAt: "2026-05-18T03:25:00.000Z",
      municipality: "浜松市浜名区",
      publicLocation: { label: "浜松市浜名区" },
    } as any,
    subject: {
      displayName: "同定待ち",
      scientificName: null,
      vernacularName: null,
      rank: null,
      aiCandidateName: null,
      aiCandidateRank: null,
      aiAssessment: null,
    } as any,
    recordItems: [
      visibleRecordItemFixture({
        displayName: "シロツメクサ",
        roleLabel: "AI候補",
        rankLabel: "種",
        confidence: 0.86,
        trustLevel: "strong",
        trustLabel: "かなり近そう",
        bucket: "main",
        note: "白い花と三小葉が見える",
        isFeatured: true,
        proposalKind: "ai_candidate",
      }),
    ],
    placeLabel: "浜松市浜名区",
  });

  assert.match(text, /シロツメクサらしい植物/);
  assert.doesNotMatch(text, /同定待ちらしい/);
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

test("identification candidate switch keeps canonical order when another candidate is selected", () => {
  const { akamigashiwaSubject, bundle } = buildObservationReadoutFixture();

  const html = renderIdentificationCandidateSwitch({
    basePath: "",
    lang: "ja",
    bundle,
    currentSubject: akamigashiwaSubject,
    targetLabel: "アカメガシワ",
    candidateStatus: "確認待ち",
  });

  assertVisibleTermsInOrder(html, [
    "ナワシロイチゴ",
    "確認待ち",
    "アカメガシワ",
    "確認待ち",
    "選択中",
    "カタバミ属",
    "確認待ち",
  ]);
  assert.match(html, /class="obs-frame-candidate is-current"/);
  assert.match(html, /data-ai-candidate-list="1"/);
});

test("identification candidate switch adds lightweight search for dense candidate lists", () => {
  const { nawashiroSubject, bundle } = buildObservationReadoutFixture();
  const denseBundle = {
    ...bundle,
    aiCandidates: [
      {
        candidateId: "candidate-clover",
        suggestedOccurrenceId: null,
        displayName: "シロツメクサ",
        scientificName: "Trifolium repens",
        rank: "species",
        confidence: 0.42,
        candidateStatus: "proposed",
        note: "白い花の候補",
        regions: [],
      },
      {
        candidateId: "candidate-gnaphalium",
        suggestedOccurrenceId: null,
        displayName: "チチコグサモドキ属",
        scientificName: "Gamochaeta",
        rank: "genus",
        confidence: 0.38,
        candidateStatus: "proposed",
        note: "綿毛のある葉の候補",
        regions: [],
      },
    ],
  } as ObservationVisitBundle;

  const html = renderIdentificationCandidateSwitch({
    basePath: "",
    lang: "ja",
    bundle: denseBundle,
    currentSubject: nawashiroSubject,
    targetLabel: "ナワシロイチゴ",
    candidateStatus: "確認待ち",
  });

  assert.match(html, /class="obs-frame-candidate-switch is-dense"/);
  assert.match(html, /placeholder="候補名で絞り込み"/);
  assert.match(html, /data-ai-candidate-search/);
  assert.match(html, /data-ai-candidate-empty hidden>該当する候補がありません/);
  assert.match(html, /data-ai-candidate-search-text="シロツメクサ 種 \/ 42%"/);
  assertVisibleTermsInOrder(html, [
    "ナワシロイチゴ",
    "確認待ち",
    "アカメガシワ",
    "確認待ち",
    "カタバミ属",
    "確認待ち",
    "シロツメクサ",
    "42%",
    "チチコグサモドキ属",
    "38%",
  ]);
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
    "写真を追加すると解説を作れます",
    "メモは保存済みです",
  ]);
  assertVisibleTermsInOrder(katabamiHtml, [
    "写真を追加すると解説を作れます",
    "メモは保存済みです",
  ]);
  assert.doesNotMatch(akamigashiwaHtml, /同じ場面内の名前候補として残っています|確かめる点|追加で見る点/);
  assert.doesNotMatch(katabamiHtml, /同じ場面内の名前候補として残っています|確かめる点|追加で見る点/);
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
  assert.match(routeSource, /renderHeroAiReadout\(currentSubject,\s*consensus\?\.hasOpenDispute === true,\s*insight,\s*bundle,\s*groundingAssets,\s*glossaryTerms\)/s);
});
