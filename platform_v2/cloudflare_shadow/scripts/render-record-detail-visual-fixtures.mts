import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ObservationFirstCard, ObservationFirstRecordDetail } from "../src/cloudflareObservationReadModel";
import { renderObservationFirstRecordDetailHtml } from "../src/observationFirstRecordDetailHtml";

const outputDirectory = resolve(process.argv[2] ?? ".visual-record-detail");
await mkdir(outputDirectory, { recursive: true });

const photoOne = "https://ikimon.life/derived/v1-compat/record-1784431188621/asset_28fd7254-9c20-4c8b-891f-6ad0198bf5b0-ikimon-photo-1784431184745.jpg/display.webp";
const photoTwo = "https://ikimon.life/derived/v1-compat/record-1784431188621/asset_82109a6c-f044-4af9-ab6f-805d9771516e-ikimon-photo-1784431177593.jpg/display.webp";
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

const fixtures = {
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
    media: [{ mediaId: "visual-photo-1", mediaKind: "photo", url: photoOne }],
    environment: { place_type: "grassland_urban_edge", contact_surface: "plant", surrounding_cover: "sparse", human_change: "road_building", place_type_source: "derived" },
    related: [{ recordId: "visual-related", title: "近くで見たコマドリ", observedLabel: "2026年7月20日", photoUrl: photoTwo }],
    actionNonce: "visual-owner",
    viewerAuthenticated: true,
  }),
  "multiple-ai-community.html": renderObservationFirstRecordDetailHtml(detail([
    observation({ communityIdentifications: [{ claimId: "community-1", actorType: "community_member", proposedName: "コマドリ", proposedScientificName: "Larvivora akahige", proposedRank: "species", stance: "support", accepted: false }] }),
    observation({ observationId: "visual-observation-2", subjectType: "organism", subjectLabel: "白い花", aiSuggestions: [{ suggestionId: "visual-ai-2", proposedName: "シロツメクサ", proposedScientificName: "Trifolium repens", proposedRank: "species", visualEvidence: ["白い小花が球状に集まっています。"], shootingAdvice: [], provisional: true }] }),
    observation({ observationId: "visual-observation-3", subjectType: "group", subjectLabel: "小鳥の群れ", aiSuggestions: [] }),
    observation({ observationId: "visual-observation-4", subjectType: "unknown", subjectLabel: "どの子か不明", aiSuggestions: [] }),
  ]), {
    title: "川沿いで見つけたもの",
    observedLabel: "2026年7月21日 08:15",
    note: null,
    publicLocationLabel: "天竜川周辺",
    media: [
      { mediaId: "visual-photo-1", mediaKind: "photo", url: photoOne },
      { mediaId: "visual-photo-2", mediaKind: "photo", url: photoTwo },
      { mediaId: "visual-video-1", mediaKind: "video", url: video },
    ],
    environment: { place_type: "river_edge", contact_surface: "grass", surrounding_cover: "dense", environment_condition: "moist", human_change: "road_building", place_type_source: "derived" },
    actionNonce: "visual-multiple",
    viewerAuthenticated: true,
  }),
  "private-owner-no-media.html": renderObservationFirstRecordDetailHtml(detail([
    observation({ observationId: "visual-pet", subjectType: "pet", subjectLabel: "白文鳥", aiSuggestions: [] }),
  ], { owner: true, visibility: "private", proposalPolicy: { identification: false, media: false, disabledReason: "private_record" } }), {
    title: "白文鳥の健康メモ",
    observedLabel: "2026年7月22日 09:10",
    note: "食欲はいつも通り。",
    publicLocationLabel: null,
    media: [],
    actionNonce: "visual-private",
    viewerAuthenticated: true,
  }),
};

for (const [filename, html] of Object.entries(fixtures)) {
  await writeFile(resolve(outputDirectory, filename), html, "utf8");
}

console.log(JSON.stringify({ outputDirectory, files: Object.keys(fixtures) }, null, 2));
