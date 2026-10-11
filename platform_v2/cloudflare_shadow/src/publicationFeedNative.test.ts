import assert from "node:assert/strict";
import test from "node:test";
import {
  handlePublicationFeedNativeRequest,
  type PublicationFeedNativeDatabase,
  type PublicationFeedNativeRow,
} from "./publicationFeedNative";
import {
  PUBLICATION_SYNDICATION_POLICY_VERSION,
  PUBLICATION_SYNDICATION_PURPOSE,
} from "../../src/services/publicationSyndication";
import { renderOwnerPublicationReturn } from "../../src/ui/ownerPublicationReturn";
import { inspectPublicDerivativeMetadata } from "./publicDerivativeMetadata";

const boundary = JSON.stringify({
  type: "Polygon",
  coordinates: [[[137.732, 34.813], [137.735, 34.813], [137.735, 34.816], [137.732, 34.816], [137.732, 34.813]]],
});

function publicWebpMetadata(facePrivacy: unknown = { status: "no_faces" }): string {
  // A structurally parsed RIFF/WEBP inspector fixture, not a decoded image or
  // evidence that the production writer emits face approval metadata.
  const bytes = new Uint8Array(24);
  bytes.set(new TextEncoder().encode("RIFF"), 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(4, 16, true);
  bytes.set(new TextEncoder().encode("WEBP"), 8);
  bytes.set(new TextEncoder().encode("VP8 "), 12);
  view.setUint32(16, 3, true);
  bytes.set([1, 2, 3], 20);
  const inspection = inspectPublicDerivativeMetadata(bytes.buffer, "image/webp");
  // The derivative writer adds these fields after binary inspection. Face
  // approval is the feed's existing independent contract; current writer
  // metadata does not itself persist it.
  return JSON.stringify({
    ...inspection,
    tool: "cloudflare-images-public-derivative-v1",
    derivativeFormat: "webp",
    derivativeBytes: bytes.byteLength,
    facePrivacy,
  });
}

const baseRow = {
  observation_id: "visit-public-1",
  observed_at: "2026-08-29T03:00:00.000Z",
  source_updated_at: "2026-08-29T04:00:00.000Z",
  taxon_label: "ニホンアマガエル",
  public_area_label: "浜松・都田",
  exact_lat: 34.8144,
  exact_lng: 137.7332,
  boundary_name: "愛管株式会社 連理の木の下で",
  boundary_geometry_json: boundary,
  record_consent: "external_export",
  research_use_consent: "public_export",
  dataset_license: "CC-BY-4.0",
  media_license: "CC-BY-4.0",
  external_export_allowed: 1,
  withdrawal_status: "active",
  source_payload_json: JSON.stringify({
    syndicationConsent: {
      status: "active",
      purpose: PUBLICATION_SYNDICATION_PURPOSE,
      policyVersion: PUBLICATION_SYNDICATION_POLICY_VERSION,
      grantedAt: "2026-08-01T00:00:00.000Z",
      validUntil: "2027-08-01T00:00:00.000Z",
      subjectStatus: "adult",
      destinationFeedKeys: ["miyakoda-renri-area"],
      guardian: { status: "not_required" },
    },
  }),
  audience_scope: "public",
  public_precision: "municipality",
  risk_lane: "normal",
  living_derivative_key: "derived/visit-public-1/display.webp",
  living_width: 1600,
  living_height: 1200,
  living_metadata_json: publicWebpMetadata(),
  community_derivative_key: "derived/visit-public-1/context.webp",
  community_width: 1600,
  community_height: 1200,
  community_metadata_json: publicWebpMetadata("no_faces"),
  ai_assessment_status: null,
  ai_candidate_label: null,
  ai_confidence: null,
  human_label: null,
} satisfies PublicationFeedNativeRow;

function database(rows: PublicationFeedNativeRow[]): PublicationFeedNativeDatabase {
  return {
    prepare(sql) {
      assert.match(sql, /observation_data_rights/);
      assert.match(sql, /production_import_area_polygon_readmodel/);
      assert.match(sql, /media\.role = 'context'/);
      assert.match(sql, /civic\.risk_lane = 'normal'/);
      assert.match(sql, /publication_source\.ambiguity_state = 'clear'/);
      assert.match(sql, /publication_record\.verification_status IN/);
      return {
        bind() {
          return this;
        },
        async all<T>() {
          return { results: rows as T[] };
        },
      };
    },
  };
}

test("returns the existing v1 contract with living and community-photo channels", async () => {
  const response = await handlePublicationFeedNativeRequest(
    new Request("https://staging.zukan.earth/api/v1/publication-feeds/miyakoda-renri-area?limit=8&locale=ja", {
      headers: { origin: "https://lenrinokinoshitade-top-staging.pages.dev" },
    }),
    database([baseRow]),
  );
  assert.ok(response);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://lenrinokinoshitade-top-staging.pages.dev");
  assert.match(response.headers.get("etag") ?? "", /^"[a-f0-9]{64}"$/);
  assert.equal(response.headers.get("cache-control"), "public, max-age=30, must-revalidate");
  assert.equal(response.headers.get("vary"), "Origin");
  const payload = await response.json() as {
    api_version: string;
    feed: { feed_key: string; source_environment: string; read_only: boolean };
    channels: Array<{ key: string; items: Array<{ title: string; media: { url: string }; classification: { state: string } }> }>;
  };
  assert.equal(payload.api_version, "1");
  assert.equal(payload.feed.feed_key, "miyakoda-renri-area");
  assert.equal(payload.feed.source_environment, "production");
  assert.equal(payload.feed.read_only, true);
  assert.deepEqual(payload.channels.map((channel) => channel.key), ["living", "community_photo"]);
  assert.equal(payload.channels[0]?.items[0]?.title, "ニホンアマガエル");
  assert.equal(payload.channels[0]?.items[0]?.classification.state, "accepted");
  assert.equal(payload.channels[0]?.items[0]?.media.url, "https://staging.zukan.earth/derived/visit-public-1/display.webp");
  assert.equal(payload.channels[1]?.items.length, 1);
});

test("keeps AI candidate machine-readable and excludes rights/privacy unsafe rows", async () => {
  const candidate = {
    ...baseRow,
    observation_id: "visit-candidate",
    taxon_label: null,
    ai_assessment_status: "ai_judgement",
    ai_candidate_label: "アカネ属の一種",
    ai_confidence: 0.72,
    living_derivative_key: "derived/visit-candidate/display.webp",
    community_derivative_key: null,
    community_width: null,
    community_height: null,
    community_metadata_json: null,
  } satisfies PublicationFeedNativeRow;
  const privateRow = {
    ...baseRow,
    observation_id: "visit-private",
    public_precision: "exact_private",
    living_derivative_key: "derived/visit-private/display.webp",
  } satisfies PublicationFeedNativeRow;
  const withdrawnRow = {
    ...baseRow,
    observation_id: "visit-withdrawn",
    withdrawal_status: "withdrawn",
    living_derivative_key: "derived/visit-withdrawn/display.webp",
  } satisfies PublicationFeedNativeRow;
  const faceRow = {
    ...baseRow,
    observation_id: "visit-face",
    living_derivative_key: "derived/visit-face/display.webp",
    living_metadata_json: publicWebpMetadata({ hasFace: true }),
  } satisfies PublicationFeedNativeRow;
  const uncheckedFaceMetadata = JSON.parse(publicWebpMetadata()) as Record<string, unknown>;
  delete uncheckedFaceMetadata.facePrivacy;
  const uncheckedFaceRow = {
    ...baseRow,
    observation_id: "visit-face-unchecked",
    living_derivative_key: "derived/visit-face-unchecked/display.webp",
    living_metadata_json: JSON.stringify(uncheckedFaceMetadata),
  } satisfies PublicationFeedNativeRow;
  const unprovenRiskRow = {
    ...baseRow,
    observation_id: "visit-risk-unproven",
    risk_lane: null,
    living_derivative_key: "derived/visit-risk-unproven/display.webp",
  } satisfies PublicationFeedNativeRow;

  const response = await handlePublicationFeedNativeRequest(
    new Request("https://staging.zukan.earth/api/v1/publication-feeds/miyakoda-renri-area?channel=living"),
    database([candidate, privateRow, withdrawnRow, faceRow, uncheckedFaceRow, unprovenRiskRow]),
  );
  assert.ok(response);
  assert.equal(response.status, 200);
  const payload = await response.json() as { channels: Array<{ items: Array<{ id: string; classification: { state: string; source: string } }> }> };
  assert.deepEqual(payload.channels[0]?.items.map((item) => item.id), ["living:visit-candidate"]);
  assert.deepEqual(payload.channels[0]?.items[0]?.classification, { state: "candidate", source: "ai", confidence: 0.72 });
});

test("owner return does not claim feed eligibility when the native feed excludes an out-of-area record", async () => {
  const outsideBoundary = { ...baseRow, exact_lng: 138.2 } satisfies PublicationFeedNativeRow;
  const response = await handlePublicationFeedNativeRequest(
    new Request("https://staging.zukan.earth/api/v1/publication-feeds/miyakoda-renri-area?channel=living"),
    database([outsideBoundary]),
  );
  assert.ok(response);
  const payload = await response.json() as { channels: Array<{ items: unknown[] }> };
  assert.deepEqual(payload.channels.map((channel) => channel.items), [[]]);

  const ownerHtml = renderOwnerPublicationReturn({
    owner: true,
    recordVisibility: "public",
    reviewDecision: { state: "approved", source: "human_review" },
    rights: {
      recordConsent: baseRow.record_consent,
      researchUseConsent: baseRow.research_use_consent,
      datasetLicense: baseRow.dataset_license,
      mediaLicense: baseRow.media_license,
      externalExportAllowed: baseRow.external_export_allowed,
      withdrawalStatus: baseRow.withdrawal_status,
      sourcePayload: JSON.parse(baseRow.source_payload_json!) as Record<string, unknown>,
    },
    now: new Date("2026-09-15T00:00:00.000Z"),
    lang: "en",
  });
  assert.match(ownerHtml, /data-publication-state="eligible"/);
  assert.match(ownerHtml, /Rights allow sharing \(feed inclusion unverified\)/);
  assert.match(ownerHtml, /Feed configured \(this record.*inclusion unverified\)/);
  assert.doesNotMatch(ownerHtml, /Eligible \(not published\)|Configured \(not published\)/);
});

test("public feed omits both image URLs when derivative metadata is unsafe or unproved", async () => {
  const unsafeMetadata = [
    ...["gpsExifPresent", "exifPresent", "gpsPresent", "xmpPresent", "exactCoordinateLiteralPresent"].map((flag) => {
      const metadata = JSON.parse(publicWebpMetadata()) as Record<string, unknown>;
      metadata[flag] = true;
      return JSON.stringify(metadata);
    }),
    // A contradictory summary must not be hidden by a false detailed flag.
    JSON.stringify({ ...JSON.parse(publicWebpMetadata()) as Record<string, unknown>, gpsExifPresent: true, gpsPresent: false }),
    JSON.stringify({ ...JSON.parse(publicWebpMetadata()) as Record<string, unknown>, contentType: "image/jpeg" }),
    JSON.stringify({ ...JSON.parse(publicWebpMetadata()) as Record<string, unknown>, scannedContainer: "binary" }),
    JSON.stringify({ ...JSON.parse(publicWebpMetadata()) as Record<string, unknown>, scannedContainer: "svg+xml" }),
    JSON.stringify({ ...JSON.parse(publicWebpMetadata()) as Record<string, unknown>, inspectionVersion: "unknown" }),
    JSON.stringify({ ...JSON.parse(publicWebpMetadata()) as Record<string, unknown>, checkedAt: "not-a-timestamp" }),
    JSON.stringify({ ...JSON.parse(publicWebpMetadata()) as Record<string, unknown>, derivativeBytes: 13 }),
    (() => {
      const metadata = JSON.parse(publicWebpMetadata()) as Record<string, unknown>;
      delete metadata.xmpPresent;
      return JSON.stringify(metadata);
    })(),
    publicWebpMetadata({ status: "no_faces", hasFace: true }),
    "{malformed-json",
  ];

  for (const [index, metadata] of unsafeMetadata.entries()) {
    const row = {
      ...baseRow,
      observation_id: `visit-unsafe-image-${index}`,
      living_metadata_json: metadata,
      community_metadata_json: metadata,
    } satisfies PublicationFeedNativeRow;
    const response = await handlePublicationFeedNativeRequest(
      new Request("https://staging.zukan.earth/api/v1/publication-feeds/miyakoda-renri-area"),
      database([row]),
    );
    assert.ok(response);
    const payload = await response.json() as { channels: Array<{ items: Array<{ media: { url: string } }> }> };
    assert.deepEqual(payload.channels.map((channel) => channel.items), [[], []], `unsafe metadata case ${index}`);
  }
});

test("uses the accepted human label and reports a verified identification", async () => {
  const verified = {
    ...baseRow,
    taxon_label: "アマガエルの仲間",
    human_label: "ニホンアマガエル",
  } satisfies PublicationFeedNativeRow;
  const response = await handlePublicationFeedNativeRequest(
    new Request("https://staging.zukan.earth/api/v1/publication-feeds/miyakoda-renri-area?channel=living"),
    database([verified]),
  );
  assert.ok(response);
  const payload = await response.json() as { channels: Array<{ items: Array<{ title: string; classification: { state: string; source: string } }> }> };
  assert.equal(payload.channels[0]?.items[0]?.title, "ニホンアマガエル");
  assert.deepEqual(payload.channels[0]?.items[0]?.classification, { state: "verified", source: "human_review", confidence: null });
});

test("preserves 404, 400, 304 and fail-closed 503 behavior", async () => {
  const missing = await handlePublicationFeedNativeRequest(
    new Request("https://staging.zukan.earth/api/v1/publication-feeds/not-configured"),
    database([]),
  );
  assert.equal(missing?.status, 404);

  const invalid = await handlePublicationFeedNativeRequest(
    new Request("https://staging.zukan.earth/api/v1/publication-feeds/miyakoda-renri-area?limit=999"),
    database([]),
  );
  assert.equal(invalid?.status, 400);

  const malformedKey = await handlePublicationFeedNativeRequest(
    new Request("https://staging.zukan.earth/api/v1/publication-feeds/%E0%A4%A"),
    database([]),
  );
  assert.equal(malformedKey?.status, 400);

  const first = await handlePublicationFeedNativeRequest(
    new Request("https://staging.zukan.earth/api/v1/publication-feeds/miyakoda-renri-area"),
    database([baseRow]),
  );
  assert.ok(first);
  const cached = await handlePublicationFeedNativeRequest(
    new Request("https://staging.zukan.earth/api/v1/publication-feeds/miyakoda-renri-area", {
      headers: { "if-none-match": first.headers.get("etag") ?? "" },
    }),
    database([baseRow]),
  );
  assert.equal(cached?.status, 304);

  const unavailable = await handlePublicationFeedNativeRequest(
    new Request("https://staging.zukan.earth/api/v1/publication-feeds/miyakoda-renri-area"),
    {
      prepare() {
        throw new Error("D1 unavailable");
      },
    },
  );
  assert.equal(unavailable?.status, 503);
  assert.deepEqual(await unavailable?.json(), { ok: false, error: "publication_feed_unavailable" });
});

test("native projection fails closed for missing, unresolved-minor, and withdrawn syndication state", async () => {
  const missing = { ...baseRow, observation_id: "visit-missing", source_payload_json: "{}" } satisfies PublicationFeedNativeRow;
  const minor = {
    ...baseRow,
    observation_id: "visit-minor",
    source_payload_json: JSON.stringify({ syndicationConsent: {
      status: "active",
      purpose: PUBLICATION_SYNDICATION_PURPOSE,
      policyVersion: PUBLICATION_SYNDICATION_POLICY_VERSION,
      grantedAt: "2026-08-01T00:00:00.000Z",
      validUntil: "2027-08-01T00:00:00.000Z",
      subjectStatus: "minor",
      destinationFeedKeys: ["miyakoda-renri-area"],
      guardian: { status: "unknown" },
    } }),
  } satisfies PublicationFeedNativeRow;
  const withdrawn = { ...baseRow, observation_id: "visit-withdrawn-consent", withdrawal_status: "withdrawn" } satisfies PublicationFeedNativeRow;
  const response = await handlePublicationFeedNativeRequest(
    new Request("https://staging.zukan.earth/api/v1/publication-feeds/miyakoda-renri-area?channel=living"),
    database([missing, minor, withdrawn]),
  );
  assert.ok(response);
  const payload = await response.json() as { channels: Array<{ items: Array<{ id: string }> }> };
  assert.deepEqual(payload.channels[0]?.items, []);
});
