import assert from "node:assert/strict";
import test from "node:test";
import {
  handlePublicationFeedNativeRequest,
  type PublicationFeedNativeDatabase,
  type PublicationFeedNativeRow,
} from "./publicationFeedNative";

const boundary = JSON.stringify({
  type: "Polygon",
  coordinates: [[[137.732, 34.813], [137.735, 34.813], [137.735, 34.816], [137.732, 34.816], [137.732, 34.813]]],
});

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
  consent_source: "default",
  rights_policy_version: "site_intelligence_p0_v1",
  withdrawal_status: "active",
  audience_scope: "public",
  public_precision: "municipality",
  risk_lane: "normal",
  living_derivative_key: "derived/visit-public-1/display.webp",
  living_width: 1600,
  living_height: 1200,
  living_metadata_json: JSON.stringify({ facePrivacy: { status: "no_faces" } }),
  community_derivative_key: "derived/visit-public-1/context.webp",
  community_width: 1600,
  community_height: 1200,
  community_metadata_json: JSON.stringify({ facePrivacy: "no_faces" }),
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
      assert.match(sql, /rights\.consent_source/);
      assert.match(sql, /rights\.rights_policy_version/);
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
    feed: { feed_key: string };
    channels: Array<{ key: string; items: Array<{ title: string; media: { url: string }; classification: { state: string } }> }>;
  };
  assert.equal(payload.api_version, "1");
  assert.equal(payload.feed.feed_key, "miyakoda-renri-area");
  assert.deepEqual(payload.channels.map((channel) => channel.key), ["living", "community_photo"]);
  assert.equal(payload.channels[0]?.items[0]?.title, "ニホンアマガエル");
  assert.equal(payload.channels[0]?.items[0]?.classification.state, "accepted");
  assert.equal(payload.channels[0]?.items[0]?.media.url, "https://staging.zukan.earth/derived/visit-public-1/display.webp");
  assert.equal(payload.channels[1]?.items.length, 1);
});

test("Ryuyo feed keeps the shared rights gate and uses its configured scope label", async () => {
  const response = await handlePublicationFeedNativeRequest(
    new Request("https://zukan.earth/api/v1/publication-feeds/ryuyo-insect-park?channel=living"),
    database([{
      ...baseRow,
      public_area_label: null,
      exact_lat: 34.6695,
      exact_lng: 137.8400,
      boundary_name: "竜洋昆虫自然観察公園",
      boundary_geometry_json: JSON.stringify({
        type: "Polygon",
        coordinates: [[[137.839, 34.668], [137.841, 34.668], [137.841, 34.672], [137.839, 34.672], [137.839, 34.668]]],
      }),
    }]),
  );
  assert.ok(response);
  const payload = await response.json() as { feed: { feed_key: string; scope_label: string }; channels: Array<{ items: Array<{ subtitle: string }> }> };
  assert.equal(payload.feed.feed_key, "ryuyo-insect-park");
  assert.equal(payload.feed.scope_label, "磐田・竜洋昆虫自然観察公園");
  assert.equal(payload.channels[0]?.items[0]?.subtitle, "磐田・竜洋昆虫自然観察公園");
});

test("direct explicit external consent is eligible without open-license or research consent", async () => {
  const response = await handlePublicationFeedNativeRequest(
    new Request("https://zukan.earth/api/v1/publication-feeds/ryuyo-insect-park?channel=living"),
    database([{
      ...baseRow,
      consent_source: "user_selected",
      rights_policy_version: "site_intelligence_p0_v2",
      research_use_consent: "none",
      dataset_license: null,
      media_license: null,
      exact_lat: 34.6695,
      exact_lng: 137.8400,
      boundary_name: "竜洋昆虫自然観察公園",
      boundary_geometry_json: JSON.stringify({
        type: "Polygon",
        coordinates: [[[137.839, 34.668], [137.841, 34.668], [137.841, 34.672], [137.839, 34.672], [137.839, 34.668]]],
      }),
    }]),
  );
  assert.ok(response);
  const payload = await response.json() as { channels: Array<{ items: Array<{ id: string }> }> };
  assert.deepEqual(payload.channels[0]?.items.map((item) => item.id), ["living:visit-public-1"]);
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
    living_metadata_json: JSON.stringify({ facePrivacy: { hasFace: true } }),
  } satisfies PublicationFeedNativeRow;
  const uncheckedFaceRow = {
    ...baseRow,
    observation_id: "visit-face-unchecked",
    living_derivative_key: "derived/visit-face-unchecked/display.webp",
    living_metadata_json: "{}",
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
