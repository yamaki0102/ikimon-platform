import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ObservationFirstCard, ObservationFirstRecordDetail } from "../src/cloudflareObservationReadModel";
import { renderObservationFirstRecordDetailHtml } from "../src/observationFirstRecordDetailHtml";

const outputDirectory = resolve(process.argv[2] ?? ".visual-record-detail");
await mkdir(outputDirectory, { recursive: true });

const photoOne = "https://ikimon.life/derived/v1-compat/record-1784431188621/asset_28fd7254-9c20-4c8b-891f-6ad0198bf5b0-ikimon-photo-1784431184745.jpg/display.webp";
const photoTwo = "https://ikimon.life/derived/v1-compat/record-1784431188621/asset_82109a6c-f044-4af9-ab6f-805d9771516e-ikimon-photo-1784431177593.jpg/display.webp";
const birdCloseup = "https://ikimon.life/derived/import/20260615/observation_photo/36e7dba9-9e6e-4e1b-8ddd-5a26076ba9ea/display.webp";
const birdPerch = "https://ikimon.life/derived/import/20260615/observation_photo/8ed39677-0959-44d5-a58e-6c4a8502f1c8/display.webp";
const birdEnvironment = "https://ikimon.life/derived/import/20260615/observation_photo/9f0eb001-0c30-46b7-8e29-6c0b0e45d4a9/display.webp";
const video = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const audio = "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3";

const observation = (overrides: Partial<ObservationFirstCard> = {}): ObservationFirstCard => ({
  observationId: "visual-observation-1",
  state: "active",
  subjectType: "organism",
  subjectLabel: "観察した生きもの",
  assertionStatus: "provisional",
  verificationStatus: "unreviewed",
  acceptedIdentification: null,
  communityIdentifications: [],
  aiSuggestions: [{
    suggestionId: "visual-ai-1",
    proposedName: "コマドリ",
    proposedScientificName: "Larvivora akahige",
    proposedRank: "species",
    visualEvidence: ["顔から胸にかけて橙色に見えます。"],
    shootingAdvice: ["横から全身が入るように撮ると、翼と尾を比べやすくなります。"],
    provisional: true,
  }],
  media: [{ mediaId: "visual-photo-1", mediaKind: "photo", displayOrder: 0 }],
  provenance: { owner: false, ai: true, community: false, curator: false, imported: false },
  ...overrides,
});

const detail = (observations: ObservationFirstCard[], overrides: Partial<ObservationFirstRecordDetail> = {}): ObservationFirstRecordDetail => ({
  schema: "ikimon.observation-first-record-detail/v1",
  recordId: "visual-record-detail",
  owner: false,
  visibility: "public",
  observationCount: observations.length,
  proposalPolicy: { identification: true, media: true, disabledReason: null },
  observations,
  privacy: { exactLocationExposed: false, publicLocationLabel: "位置をぼかしています" },
  ...overrides,
});

const fixtures: Record<string, string> = {
  "dedup-bird-candidates-owner.html": renderObservationFirstRecordDetailHtml(detail([
    observation({
      subjectLabel: "鳥",
      aiSuggestions: [{
        suggestionId: "visual-bird-ai",
        proposedName: "イソヒヨドリ",
        proposedScientificName: "Monticola solitarius",
        proposedRank: "species",
        visualEvidence: ["全身に鱗状の羽衣が見えます。", "冠羽は目立ちません。"],
        shootingAdvice: ["顔の横から耳の後ろが分かる写真", "尾全体が入る横向き写真"],
        provisional: true,
      }],
    }),
  ], { owner: true }), {
    title: "鳥の記録",
    observedLabel: "2026年6月15日 10:48",
    note: "同じ鳥を接写と周辺を含む写真で記録。",
    publicLocationLabel: "浜松市周辺",
    locationProtectionLabel: "位置はぼかして表示",
    detectionState: "detected",
    media: [
      { mediaId: "bird-closeup", mediaKind: "photo", url: birdCloseup },
      { mediaId: "bird-perch", mediaKind: "photo", url: birdPerch },
      { mediaId: "bird-environment", mediaKind: "photo", url: birdEnvironment },
    ],
    mediaDedup: { sourcePhotoCount: 6, representativePhotoCount: 3, excludedPhotoCount: 3 },
    aiCandidateInsights: [
      { name: "イソヒヨドリ", scientificName: "Monticola solitarius", supportingFeatures: ["全身の鱗状模様", "冠羽が目立たない"], missingFeatures: ["幼鳥か雌成鳥かは未確認"], contradictions: [] },
      { name: "ヒヨドリ", scientificName: "Hypsipetes amaurotis", supportingFeatures: ["中型の鳥の体形"], missingFeatures: [], contradictions: ["冠羽と耳斑を確認できない"] },
      { name: "ムクドリ", scientificName: "Spodiopsar cineraceus", supportingFeatures: ["嘴と尾の形を比較する余地"], missingFeatures: ["頭部の模様が不鮮明"], contradictions: [] },
    ],
    environment: { place_type: "urban", contact_surface: "artificial", surrounding_cover: "built_surface", place_type_source: "derived", contact_surface_source: "derived", surrounding_cover_source: "derived", environment_record_status: "auto_draft" },
    actionNonce: "visual-dedup-bird",
    processingMessage: "写真からわかることを調べています。写真と記録は保存されています。",
    viewerAuthenticated: true,
  }),
  "zero-observations-guest.html": renderObservationFirstRecordDetailHtml(detail([]), {
    title: "夕方の空と鳥の声",
    observedLabel: "2026年7月22日 18:30",
    note: "雲の切れ間から夕日が見えました。",
    publicLocationLabel: "浜松市周辺",
    media: [
      { mediaId: "visual-photo-1", mediaKind: "photo", url: photoOne },
      { mediaId: "visual-audio-1", mediaKind: "audio", url: audio },
    ],
    actionNonce: "visual-zero",
    viewerAuthenticated: false,
  }),
  "one-accepted-owner.html": renderObservationFirstRecordDetailHtml(detail([
    observation({
      acceptedIdentification: { claimId: "accepted-1", actorType: "owner", actorId: "visual-owner", proposalActorType: "owner", proposedName: "コマドリ", proposedScientificName: "Larvivora akahige", proposedRank: "species", humanDecision: true },
      assertionStatus: "human_asserted",
      verificationStatus: "owner_confirmed",
    }),
  ], { owner: true }), {
    title: "森で見つけた鳥",
    observedLabel: "2026年7月22日 17:48",
    note: "何度も同じ軒下へ戻っていました。",
    publicLocationLabel: "浜松市周辺",
    locationProtectionLabel: "位置はぼかして表示",
    detectionState: "detected",
    media: [{ mediaId: "visual-photo-1", mediaKind: "photo", url: photoOne }],
    environment: { place_type: "grassland_urban_edge", contact_surface: "plant", surrounding_cover: "low_grass", human_change: "mowing", place_type_source: "derived", contact_surface_source: "derived", surrounding_cover_source: "derived", human_change_source: "derived", environment_record_status: "auto_draft" },
    related: [{ recordId: "visual-related", title: "近くで見たコマドリ", observedLabel: "2026年7月20日", photoUrl: photoTwo }],
    actionNonce: "visual-owner",
    viewerAuthenticated: true,
  }),
  "multiple-ai-community.html": renderObservationFirstRecordDetailHtml(detail([
    observation({ communityIdentifications: [{ claimId: "community-1", actorType: "community_member", proposedName: "コマドリ", proposedScientificName: "Larvivora akahige", proposedRank: "species", stance: "support", accepted: false }] }),
    observation({ observationId: "visual-observation-2", subjectType: "organism", subjectLabel: "白い花", aiSuggestions: [{ suggestionId: "visual-ai-2", proposedName: "シロツメクサ", proposedScientificName: "Trifolium repens", proposedRank: "species", visualEvidence: ["白い小花が球状に集まっています。"], shootingAdvice: [], provisional: true }] }),
    observation({ observationId: "visual-observation-3", subjectType: "group", subjectLabel: "小鳥の群れ", aiSuggestions: [] }),
    observation({ observationId: "visual-observation-4", subjectType: "unknown_subject", subjectLabel: "どの子か不明", aiSuggestions: [] }),
  ]), {
    title: "川沿いで見つけたもの",
    observedLabel: "2026年7月21日 08:15",
    note: null,
    publicLocationLabel: "天竜川周辺",
    detectionState: "detected",
    media: [
      { mediaId: "visual-photo-1", mediaKind: "photo", url: photoOne },
      { mediaId: "visual-photo-2", mediaKind: "photo", url: photoTwo },
      { mediaId: "visual-video-1", mediaKind: "video", url: video },
    ],
    environment: { place_type: "water_edge", contact_surface: "plant", surrounding_cover: "low_grass", environment_condition: "wet", human_change: "construction", place_type_source: "derived", contact_surface_source: "derived", surrounding_cover_source: "derived", environment_condition_source: "derived", human_change_source: "derived", environment_record_status: "auto_draft" },
    actionNonce: "visual-multiple",
    viewerAuthenticated: true,
  }),
  "private-owner-no-media.html": renderObservationFirstRecordDetailHtml(detail([
    observation({ observationId: "visual-pet", subjectType: "pet", subjectLabel: "白文鳥", aiSuggestions: [] }),
  ], { owner: true, visibility: "private", proposalPolicy: { identification: false, media: false, disabledReason: "record_private" } }), {
    title: "白文鳥の健康メモ",
    observedLabel: "2026年7月22日 09:10",
    note: "食欲はいつも通り。",
    publicLocationLabel: null,
    media: [],
    actionNonce: "visual-private",
    viewerAuthenticated: true,
  }),
  "scene-not-detected-guest.html": renderObservationFirstRecordDetailHtml(detail([]), {
    title: "川沿いの夕景と、暮らしのそばに残る水辺の記録",
    observedLabel: "2026年7月19日 18:42",
    note: "夕日が水面に反射していました。遊歩道の草は前に来たときより高く見え、住宅の明かりがつき始めていました。",
    publicLocationLabel: "静岡県浜松市",
    locationProtectionLabel: "位置はぼかして表示",
    detectionState: "not_detected",
    sceneElements: ["water", "low_grass", "trees_shrubs", "built_surface", "urban"],
    media: [{ mediaId: "scene-wide", mediaKind: "photo", url: "https://picsum.photos/id/1015/1200/650" }],
    environment: { place_type: "water_edge", contact_surface: "artificial", surrounding_cover: "low_grass", environment_condition: "flowing", human_change: "construction", place_type_source: "derived", contact_surface_source: "derived", surrounding_cover_source: "derived", environment_condition_source: "derived", human_change_source: "derived", environment_record_status: "auto_draft" },
    comparison: { summary: "前回より草がよく茂って見えます。", comparedRecordId: "visual-previous-safe", comparedObservedLabel: "2026年7月12日" },
    related: [
      { recordId: "visual-related-a", title: "同じ季節の水辺", observedLabel: "2026年7月18日", photoUrl: photoTwo },
      { recordId: "visual-related-b", title: "近くの遊歩道", observedLabel: "2026年7月14日", photoUrl: photoOne },
      { recordId: "visual-related-c", title: "過去の河原", observedLabel: "2026年6月30日", photoUrl: null },
    ],
    actionNonce: "visual-not-detected",
    viewerAuthenticated: false,
  }),
  "scene-not-assessable-nonowner.html": renderObservationFirstRecordDetailHtml(detail([]), {
    title: "暗い林の記録",
    observedLabel: "2026年7月22日 21:30",
    note: null,
    publicLocationLabel: "浜松市周辺",
    locationProtectionLabel: "おおよその場所を表示",
    detectionState: "not_assessable",
    sceneElements: ["trees_shrubs"],
    media: [{ mediaId: "scene-dark", mediaKind: "photo", url: "https://picsum.photos/id/1022/800/1200" }],
    actionNonce: "visual-not-assessable",
    viewerAuthenticated: true,
  }),
  "scene-square-no-environment.html": renderObservationFirstRecordDetailHtml(detail([]), {
    title: "まち角の記録",
    observedLabel: "2026年7月20日 12:10",
    note: null,
    detectionState: null,
    media: [{ mediaId: "scene-square", mediaKind: "photo", url: "https://picsum.photos/id/1043/900/900" }],
    actionNonce: "visual-square",
    viewerAuthenticated: false,
  }),
  "limited-owner-video-audio.html": renderObservationFirstRecordDetailHtml(detail([], { owner: true, visibility: "limited" }), {
    title: "雨上がりの音と流れ",
    observedLabel: "2026年7月18日 06:55",
    note: "水の音がいつもより大きく聞こえました。",
    publicLocationLabel: "共有相手にだけ表示",
    locationProtectionLabel: "正確な場所は非公開",
    detectionState: "not_detected",
    sceneElements: ["water"],
    media: [
      { mediaId: "visual-video", mediaKind: "video", url: video },
      { mediaId: "visual-audio", mediaKind: "audio", url: audio },
    ],
    actionNonce: "visual-limited",
    viewerAuthenticated: true,
  }),
};

const localizedSceneLabels = {
  ja: "川辺の景色",
  en: "Riverside scene",
  es: "Paisaje junto al río",
  "pt-br": "Paisagem à beira do rio",
} as const;

for (const [lang, title] of Object.entries(localizedSceneLabels)) {
  fixtures[`scene-not-detected-${lang}.html`] = renderObservationFirstRecordDetailHtml(detail([]), {
    lang: lang as keyof typeof localizedSceneLabels,
    title,
    observedLabel: "2026-07-19 18:42",
    note: null,
    detectionState: "not_detected",
    sceneElements: ["water", "low_grass", "built_surface"],
    media: [{ mediaId: `localized-${lang}`, mediaKind: "photo", url: "https://picsum.photos/id/1015/1200/650" }],
    environment: { place_type: "water_edge", surrounding_cover: "low_grass", surrounding_cover_source: "derived", place_type_source: "derived", environment_record_status: "auto_draft" },
    actionNonce: `visual-locale-${lang}`,
    viewerAuthenticated: false,
  });
}

for (const [filename, html] of Object.entries(fixtures)) {
  await writeFile(resolve(outputDirectory, filename), html, "utf8");
}

console.log(JSON.stringify({ outputDirectory, files: Object.keys(fixtures) }, null, 2));
