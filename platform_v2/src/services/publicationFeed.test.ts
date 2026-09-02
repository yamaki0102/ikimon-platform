import assert from "node:assert/strict";
import test from "node:test";
import {
  definePublicationFeedConfig,
  decodePublicationFeedCursor,
  getPublicationFeedConfig,
  projectPublicationFeed,
  PUBLICATION_FEED_CONFIGS,
  PUBLICATION_FEED_SOURCE_SQL,
  type PublicationFeedCandidateRow,
  type PublicationFeedConfig,
} from "./publicationFeed.js";

const exportRights = {
  recordConsent: "external_export" as const,
  researchUseConsent: "public_export" as const,
  datasetLicense: "CC-BY-4.0" as const,
  mediaLicense: "CC-BY-4.0" as const,
  externalExportAllowed: true,
  withdrawalStatus: "active" as const,
};

const config = getPublicationFeedConfig("miyakoda-renri-area")!;

function row(overrides: Partial<PublicationFeedCandidateRow> = {}): PublicationFeedCandidateRow {
  return {
    recordId: "record-1",
    visitId: "visit-1",
    occurrenceId: "occurrence-1",
    channel: "living",
    observedAt: "2026-08-28T09:00:00.000Z",
    sourceUpdatedAt: "2026-08-28T09:00:00.000Z",
    placeLabel: "浜松市浜名区 / 静岡県",
    vernacularName: "アオスジアゲハ",
    scientificName: "Graphium sarpedon",
    taxonRank: "species",
    recordStatus: "reviewer_verified",
    recordConfidence: "0.96",
    humanName: "アオスジアゲハ",
    humanRank: "species",
    humanConfidence: "0.96",
    aiName: null,
    aiRank: null,
    aiConfidence: null,
    media: {
      url: "https://cdn.example.test/record-1.jpg",
      width: 1200,
      height: 900,
      role: "primary_subject",
      hasFace: false,
    },
    publicVisibility: "public",
    qualityReviewStatus: "accepted",
    contextPrecision: "site",
    riskLane: "normal",
    sensitiveSpecies: false,
    rights: exportRights,
    ...overrides,
  };
}

function withChannels(base: PublicationFeedConfig, channels = base.channels): PublicationFeedConfig {
  return definePublicationFeedConfig({
    ...base,
    channels,
  });
}

test("the first feed is config-driven and uses the stable Renri entity scope", () => {
  const firstConfig = PUBLICATION_FEED_CONFIGS["miyakoda-renri-area"]!;
  assert.equal(firstConfig.scopeKind, "area");
  assert.deepEqual(firstConfig.scope, [
    { kind: "entity", id: "ikimon:aikan:renri-no-ki" },
  ]);
  assert.deepEqual(config.channels.map((channel) => channel.key), ["living", "community_photo"]);
  assert.deepEqual(config.channels[0]!.label, { ja: "この場所の生きもの", en: "Living things here" });
  assert.deepEqual(config.channels[1]!.label, { ja: "みんなのフォト", en: "Community photos" });
  assert.equal(getPublicationFeedConfig("__proto__"), null);
});

test("Ryuyo uses the same publication engine with only scope and labels changed", () => {
  const ryuyo = PUBLICATION_FEED_CONFIGS["ryuyo-insect-park"]!;
  assert.equal(ryuyo.scopeKind, "area");
  assert.deepEqual(ryuyo.scope, [{ kind: "entity", id: "osm:way:530835577" }]);
  assert.deepEqual(ryuyo.channels.map((channel) => channel.key), ["living", "community_photo"]);
  assert.deepEqual(ryuyo.allowedConsumerOrigins, []);
  assert.equal(getPublicationFeedConfig("ryuyo-insect-park")?.feedKey, "ryuyo-insect-park");
});

test("projection is the privacy, rights, media, and sensitive-location boundary", () => {
  const rows = [
    row({ recordId: "verified-record" }),
    row({
      recordId: "ai-record",
      recordStatus: "ai_judgement",
      humanName: null,
      humanRank: null,
      humanConfidence: null,
      aiName: "キタテハ",
      aiRank: "species",
      aiConfidence: "0.71",
    }),
    row({ recordId: "private-record", rights: { recordConsent: "private" } }),
    row({ recordId: "no-republication", rights: { ...exportRights, externalExportAllowed: false } }),
    row({ recordId: "face-record", media: { ...row().media, hasFace: true } }),
    row({ recordId: "rare-record", sensitiveSpecies: true }),
    row({ recordId: "coarsened-record", contextPrecision: "mesh" }),
    row({ recordId: "storage-path-record", media: { ...row().media, url: "private/storage/photo.jpg" } }),
    row({ recordId: "signed-url-record", media: { ...row().media, url: "https://cdn.example.test/photo.jpg?X-Amz-Signature=secret" } }),
    row({ recordId: "weak-label-record", humanName: "未同定", vernacularName: "未同定", scientificName: null }),
  ];
  const projected = projectPublicationFeed(config, rows, { sensitiveSpeciesIndex: new Set(["graphium sarpedon"]) });
  const items = projected.channels.flatMap((channel) => channel.items);
  assert.deepEqual(items, []);
  const serialized = JSON.stringify(projected);
  assert.doesNotMatch(serialized, /private-record|no-republication|face-record|rare-record|coarsened-record|storage-path-record|signed-url-record/);
  assert.doesNotMatch(serialized, /observation_field|private\/storage|uploader@example|reviewer_note/);
});

test("verified and AI candidate states are explicit and never collapsed", () => {
  const projected = projectPublicationFeed(config, [
    row({ recordId: "verified-record" }),
    row({
      recordId: "candidate-record",
      recordStatus: "ai_judgement",
      humanName: null,
      humanRank: null,
      humanConfidence: null,
      aiName: "キタテハ",
      aiRank: "species",
      aiConfidence: "0.71",
    }),
  ], { sensitiveSpeciesIndex: new Set() });
  const items = projected.channels.find((channel) => channel.key === "living")!.items;
  assert.deepEqual(items.map((item) => item.classification.state), ["candidate", "verified"]);
  assert.equal(items[0]!.classification.source, "ai");
  assert.equal(items[1]!.classification.source, "human_review");
  assert.equal(items[0]!.subject.kind, "taxon");
  assert.equal(items[0]!.rights.republication_allowed, true);
});

test("ordering, limit, opaque cursor, and default one-channel assignment are deterministic", () => {
  const rows = [
    row({ recordId: "record-c", observedAt: "2026-08-28T10:00:00.000Z" }),
    row({ recordId: "record-a", observedAt: "2026-08-28T10:00:00.000Z" }),
    row({ recordId: "record-b", observedAt: "2026-08-27T10:00:00.000Z" }),
    row({ recordId: "record-context", channel: "community_photo", occurrenceId: null, visitId: "visit-context", vernacularName: null, scientificName: null, humanName: null, media: { ...row().media, role: "context" } }),
    row({ recordId: "record-c", channel: "community_photo", occurrenceId: null, visitId: "visit-c", vernacularName: null, scientificName: null, humanName: null, media: { ...row().media, role: "context" } }),
  ];
  const first = projectPublicationFeed(config, rows, { limit: 2, sensitiveSpeciesIndex: new Set() });
  const firstItems = first.channels.flatMap((channel) => channel.items);
  assert.deepEqual(firstItems.map((item) => item.record_id), ["record-a", "record-c"]);
  assert.ok(first.next_cursor);
  const cursor = decodePublicationFeedCursor(first.next_cursor);
  assert.ok(cursor);

  const second = projectPublicationFeed(config, rows, { limit: 2, cursor, sensitiveSpeciesIndex: new Set() });
  const secondItems = second.channels.flatMap((channel) => channel.items);
  assert.deepEqual(secondItems.map((item) => item.record_id), ["record-b", "record-context"]);
  assert.equal(second.next_cursor, null);
  assert.equal(first.channels.find((channel) => channel.key === "community_photo")!.items.some((item) => item.record_id === "record-c"), false);
});

test("empty channels remain valid and a channel filter does not change the contract", () => {
  const projected = projectPublicationFeed(config, [
    row({ recordId: "photo-record", channel: "community_photo", occurrenceId: null, visitId: "visit-photo", vernacularName: null, scientificName: null, humanName: null, media: { ...row().media, role: "context" } }),
  ], { sensitiveSpeciesIndex: new Set() });
  assert.deepEqual(projected.channels.map((channel) => [channel.key, channel.items.length]), [["living", 0], ["community_photo", 1]]);

  const livingOnly = projectPublicationFeed(config, [
    row({ recordId: "photo-record", channel: "community_photo", occurrenceId: null, visitId: "visit-photo", vernacularName: null, scientificName: null, humanName: null }),
  ], { channel: "living", sensitiveSpeciesIndex: new Set() });
  assert.deepEqual(livingOnly.channels.map((channel) => channel.key), ["living"]);
  assert.deepEqual(livingOnly.channels[0]!.items, []);
});

test("community photos require an independently publishable environment role", () => {
  const projected = projectPublicationFeed(config, [
    row({
      recordId: "subject-photo-record",
      channel: "community_photo",
      occurrenceId: null,
      visitId: "visit-subject-photo",
      vernacularName: null,
      scientificName: null,
      humanName: null,
      media: { ...row().media, role: "primary_subject" },
    }),
  ], { sensitiveSpeciesIndex: new Set() });
  assert.deepEqual(projected.channels.find((channel) => channel.key === "community_photo")!.items, []);
});

test("facility, school, and municipality feeds use the same schema without route changes", () => {
  for (const [scopeKind, scope] of [
    ["facility", { kind: "entity", id: "facility:example" }],
    ["school", { kind: "entity", id: "mext_school:example" }],
    ["municipality", { kind: "entity", id: "n03:22130" }],
  ] as const) {
    const fixture = withChannels(definePublicationFeedConfig({
      feedKey: `${scopeKind}-feed`,
      title: "汎用フィード",
      scopeLabel: "検証対象",
      locale: "ja",
      scopeKind,
      scope: [scope],
      channels: config.channels,
      updatedAt: "2026-08-28T00:00:00.000Z",
    }));
    const projected = projectPublicationFeed(fixture, [row({ recordId: `${scopeKind}-record` })], { sensitiveSpeciesIndex: new Set() });
    assert.equal(projected.feed.feed_key, `${scopeKind}-feed`);
    assert.deepEqual(projected.channels.map((channel) => channel.key), ["living", "community_photo"]);
  }
});

test("configured additive channels keep the same projection envelope", () => {
  const fixture = definePublicationFeedConfig({
    feedKey: "staff-pick-feed",
    title: "スタッフ選",
    scopeLabel: "検証対象",
    locale: "ja",
    scopeKind: "facility",
    scope: [{ kind: "entity", id: "facility:example" }],
    channels: [
      ...config.channels,
      { key: "staff_pick", label: { ja: "スタッフ選" } },
    ],
    updatedAt: "2026-08-28T00:00:00.000Z",
  });
  const projected = projectPublicationFeed(fixture, [
    row({ recordId: "staff-pick-record", channel: "staff_pick" }),
  ], { sensitiveSpeciesIndex: new Set() });
  assert.deepEqual(projected.channels.map((channel) => channel.key), ["living", "community_photo", "staff_pick"]);
  assert.equal(projected.channels[2]!.items[0]!.classification.state, "not_applicable");
});

test("source query reuses existing public quality, AI, media, rights, area, and sensitive gates", () => {
  assert.match(PUBLICATION_FEED_SOURCE_SQL, /v\.public_visibility = 'public'/);
  assert.match(PUBLICATION_FEED_SOURCE_SQL, /v\.quality_review_status = 'accepted'/);
  assert.match(PUBLICATION_FEED_SOURCE_SQL, /observation_data_rights/);
  assert.match(PUBLICATION_FEED_SOURCE_SQL, /rights\.external_export_allowed = true/);
  assert.match(PUBLICATION_FEED_SOURCE_SQL, /observation_ai_assessments/);
  assert.match(PUBLICATION_FEED_SOURCE_SQL, /identifications/);
  assert.match(PUBLICATION_FEED_SOURCE_SQL, /evidence_asset_media_roles/);
  assert.match(PUBLICATION_FEED_SOURCE_SQL, /risk_status_versions/);
  assert.match(PUBLICATION_FEED_SOURCE_SQL, /habitat_wide.*substrate.*scale_reference/s);
  assert.doesNotMatch(PUBLICATION_FEED_SOURCE_SQL, /storage_path\s+as\s+media_url/i);
  assert.doesNotMatch(PUBLICATION_FEED_SOURCE_SQL, /point_latitude\s+as|point_longitude\s+as/i);
});
