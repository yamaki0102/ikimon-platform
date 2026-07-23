import assert from "node:assert/strict";
import test from "node:test";
import {
  loadCloudflarePlaceAtlasProfile,
  placeAtlasGeometryWithinRuntimeBudget,
  pointInPlaceAtlasGeometry,
  type PlaceAtlasD1Database,
  type PlaceAtlasD1PreparedStatement,
} from "./placeAtlasProfileNative";

type FixtureData = {
  field?: Record<string, unknown> | null;
  policy?: Record<string, unknown> | null;
  area?: Record<string, unknown> | null;
  snapshots?: Array<Record<string, unknown>>;
  visits?: Array<Record<string, unknown>>;
  photos?: Array<Record<string, unknown>>;
  themes?: Array<Record<string, unknown>>;
  membershipRecords?: Array<Record<string, unknown>>;
  excludedMembershipRecordIds?: Array<Record<string, unknown>>;
  registeredPlace?: Record<string, unknown> | null;
  placeBoundary?: Record<string, unknown> | null;
  placeAliases?: Array<Record<string, unknown>>;
  placeSources?: Array<Record<string, unknown>>;
  placeFacilities?: Array<Record<string, unknown>>;
  placeContent?: Array<Record<string, unknown>>;
  memories?: Array<Record<string, unknown>>;
  snapshotBindCounts?: number[];
};

class FixtureStatement implements PlaceAtlasD1PreparedStatement {
  private values: Array<string | number | null> = [];

  constructor(
    private readonly query: string,
    private readonly data: FixtureData,
  ) {}

  bind(...values: Array<string | number | null>): PlaceAtlasD1PreparedStatement {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    if (this.query.includes("production_import_field_detail_readmodel")) {
      return (this.data.field ?? null) as T | null;
    }
    if (this.query.includes("field_public_profile_readmodel")) {
      return (this.data.policy ?? null) as T | null;
    }
    if (this.query.includes("production_import_area_polygon_readmodel")) {
      return (this.data.area ?? null) as T | null;
    }
    if (this.query.includes("FROM place_source_references ps") && this.query.includes("JOIN places p")) {
      return (this.data.registeredPlace ?? null) as T | null;
    }
    if (this.query.includes("FROM place_boundaries")) {
      return (this.data.placeBoundary ?? null) as T | null;
    }
    throw new Error(`Unhandled first query: ${this.query}`);
  }

  async all<T>(): Promise<{ results: T[] }> {
    if (this.query.includes("SELECT DISTINCT record_id") && this.query.includes("record_place_memberships")) {
      assert.match(this.query, /membership_state <> 'confirmed'/);
      assert.match(this.query, /removed_at IS NOT NULL/);
      return {
        results: (this.data.excludedMembershipRecordIds ?? []) as T[],
      };
    }
    if (this.query.includes("FROM record_place_memberships m")) {
      assert.doesNotMatch(this.query, /exact_lat|exact_lng|user_id/);
      assert.match(this.query, /public_precision = 'place'/);
      assert.match(this.query, /public_visibility/);
      assert.match(this.query, /observation_data_rights/);
      assert.match(this.query, /public_summary/);
      assert.match(this.query, /external_export/);
      assert.match(this.query, /AND EXISTS/);
      assert.doesNotMatch(this.query, /NOT EXISTS/);
      assert.match(this.query, /withdrawal_status = 'active'/);
      assert.match(this.query, /membership_state = 'confirmed'/);
      assert.match(this.query, /removed_at IS NULL/);
      const requestedPlaceId = String(this.values[0] ?? "");
      return {
        results: (this.data.membershipRecords ?? [])
          .filter((row) =>
            String(row.place_id ?? requestedPlaceId) === requestedPlaceId &&
            String(row.membership_state ?? "confirmed") === "confirmed" &&
            (row.removed_at ?? null) === null
          ) as T[],
      };
    }
    if (this.query.includes("public_map_snapshot_records_v1")) {
      this.data.snapshotBindCounts?.push(this.values.length);
      const requestedCells = new Set(this.values.slice(1, -1).map(String));
      const rows = (this.data.snapshots ?? []).filter((row) =>
        requestedCells.size === 0 || requestedCells.has(String(row.cell_1000))
      );
      return { results: rows as T[] };
    }
    if (this.query.includes("asset_ledger")) {
      const requested = new Set(this.values.map(String));
      return {
        results: (this.data.photos ?? [])
          .filter((row) => requested.has(String(row.observation_id))) as T[],
      };
    }
    if (this.query.includes("place_memory_entries")) {
      assert.match(this.query, /production_import_visits/);
      assert.match(this.query, /public_place_opt_in = 1/);
      assert.match(this.query, /public_place_moderation_status = 'approved'/);
      const visits = new Map((this.data.visits ?? []).map((row) => [String(row.visit_id), row]));
      return {
        results: (this.data.memories ?? []).filter((row) => {
          const visit = visits.get(String(row.visit_id));
          return visit &&
            (!visit.public_visibility || visit.public_visibility === "public") &&
            row.moderation_status === "visible" &&
            row.public_place_opt_in === 1 &&
            row.public_place_moderation_status === "approved";
        }) as T[],
      };
    }
    if (this.query.includes("record_theme_assertions")) {
      const requested = new Set(this.values.map(String));
      return {
        results: (this.data.themes ?? [])
          .filter((row) => requested.has(String(row.record_id))) as T[],
      };
    }
    if (this.query.includes("FROM place_aliases")) {
      return { results: (this.data.placeAliases ?? []) as T[] };
    }
    if (this.query.includes("FROM place_source_references") && !this.query.includes("JOIN places p")) {
      return { results: (this.data.placeSources ?? []) as T[] };
    }
    if (this.query.includes("FROM place_facilities")) {
      return { results: (this.data.placeFacilities ?? []) as T[] };
    }
    if (this.query.includes("FROM place_content_items")) {
      return { results: (this.data.placeContent ?? []) as T[] };
    }
    if (this.query.includes("production_import_visits")) {
      const requested = new Set(this.values.map(String));
      return {
        results: (this.data.visits ?? [])
          .filter((row) => requested.has(String(row.visit_id))) as T[],
      };
    }
    throw new Error(`Unhandled all query: ${this.query}`);
  }
}

class FixtureDb implements PlaceAtlasD1Database {
  constructor(private readonly data: FixtureData) {}

  prepare(query: string): PlaceAtlasD1PreparedStatement {
    return new FixtureStatement(query, this.data);
  }
}

const TOKIWA_FIELD_ID = "d50678d0-ba57-4d3d-a713-2fe441d646ab";
const TOKIWA_GEOMETRY = {
  type: "Polygon" as const,
  coordinates: [[
    [138.376, 34.966],
    [138.385, 34.966],
    [138.385, 34.975],
    [138.376, 34.975],
    [138.376, 34.966],
  ]],
};

function tokiwaFixtures(policyReason: string | null = "source_record_statistics_unavailable"): FixtureData {
  return {
    field: {
      field_id: TOKIWA_FIELD_ID,
      source: "osm_park",
      admin_level: "park",
      name: "常磐公園",
      summary: "まちなかで自然や季節を観察できる公園です。",
      prefecture: "静岡県",
      city: "静岡市",
      public_cell: "34.97,138.38",
      public_lat: 34.9701,
      public_lng: 138.3803,
      radius_m: 500,
      entity_key: "osm:way:125727939",
    },
    policy: {
      display_suppression_reason: policyReason,
      aggregation_gate_json: JSON.stringify({
        thresholds: { minObservationCount: 3 },
      }),
    },
    area: {
      field_id: TOKIWA_FIELD_ID,
      name: "常磐公園",
      bbox_min_lat: 34.966,
      bbox_max_lat: 34.975,
      bbox_min_lng: 138.376,
      bbox_max_lng: 138.385,
      geometry_json: JSON.stringify(TOKIWA_GEOMETRY),
    },
    snapshots: [
      {
        occurrence_id: "occ:record-1:0",
        visit_id: "record-1",
        observed_at: "2026-07-20T10:00:00.000Z",
        taxon_group: "bird",
        display_name: "スズメ",
        is_ai_candidate: 0,
        is_awaiting_id: 0,
        photo_url: "/derived/record-1/display.webp",
        cell_1000: "34.97,138.38",
        asset_count: 1,
      },
      {
        occurrence_id: "occ:record-1:1",
        visit_id: "record-1",
        observed_at: "2026-07-20T10:00:00.000Z",
        taxon_group: "insect",
        display_name: "アゲハ候補",
        is_ai_candidate: 1,
        is_awaiting_id: 0,
        photo_url: "/derived/record-1/display.webp",
        cell_1000: "34.97,138.38",
        asset_count: 1,
      },
      {
        occurrence_id: "occ:record-2:0",
        visit_id: "record-2",
        observed_at: "2026-06-15T09:00:00.000Z",
        taxon_group: "plant",
        display_name: "アジサイ",
        is_ai_candidate: 0,
        is_awaiting_id: 0,
        photo_url: "/derived/record-2/display.webp",
        cell_1000: "34.97,138.38",
        asset_count: 1,
      },
      {
        occurrence_id: "occ:record-3:0",
        visit_id: "record-3",
        observed_at: "2026-04-10T09:00:00.000Z",
        taxon_group: "plant",
        display_name: "サクラ",
        is_ai_candidate: 0,
        is_awaiting_id: 0,
        photo_url: null,
        cell_1000: "34.97,138.38",
        asset_count: 0,
      },
      {
        occurrence_id: "occ:outside:0",
        visit_id: "outside",
        observed_at: "2026-07-22T09:00:00.000Z",
        taxon_group: "bird",
        display_name: "区域外",
        is_ai_candidate: 0,
        is_awaiting_id: 0,
        photo_url: "/derived/outside/display.webp",
        cell_1000: "34.97,138.38",
        asset_count: 1,
      },
      {
        occurrence_id: "occ:private:0",
        visit_id: "private",
        observed_at: "2026-07-23T09:00:00.000Z",
        taxon_group: "bird",
        display_name: "非公開",
        is_ai_candidate: 0,
        is_awaiting_id: 0,
        photo_url: "/derived/private/display.webp",
        cell_1000: "34.97,138.38",
        asset_count: 1,
      },
    ],
    visits: [
      {
        visit_id: "record-1",
        place_id: null,
        user_id: "user-a",
        exact_lat: 34.9702,
        exact_lng: 138.3805,
        public_visibility: "public",
      },
      {
        visit_id: "record-2",
        place_id: null,
        user_id: "user-b",
        exact_lat: 34.971,
        exact_lng: 138.381,
        public_visibility: "public",
      },
      {
        visit_id: "record-3",
        place_id: TOKIWA_FIELD_ID,
        user_id: "user-c",
        exact_lat: 34.969,
        exact_lng: 138.379,
        public_visibility: "public",
      },
      {
        visit_id: "outside",
        place_id: null,
        user_id: "user-d",
        exact_lat: 35,
        exact_lng: 138.5,
        public_visibility: "public",
      },
      {
        visit_id: "private",
        place_id: TOKIWA_FIELD_ID,
        user_id: "user-e",
        exact_lat: 34.9703,
        exact_lng: 138.3806,
        public_visibility: "private",
      },
    ],
    photos: [],
    themes: [
      { record_id: "record-1", theme: "scenery" },
      { record_id: "record-2", theme: "daily_life" },
    ],
  };
}

test("field atlas intersects public snapshots with the canonical area and counts Records once", async () => {
  const profile = await loadCloudflarePlaceAtlasProfile({
    db: new FixtureDb(tokiwaFixtures()),
    placeRef: { kind: "field", fieldId: TOKIWA_FIELD_ID },
    guideSpots: [{
      id: "tokiwa-guide",
      title: "公園の歩き方",
      subtitle: "園内の季節を見る",
      preview: "公開情報をもとにした短いガイドです。",
      category: "nature",
      lat: 34.9705,
      lng: 138.3807,
      triggerRadiusM: 100,
      sensitiveReviewStatus: "cleared",
      visibilityStatus: "published",
      safetyStatus: "active",
      sourceLinks: [{ label: "公園案内", url: "https://example.test/tokiwa" }],
    }],
    generatedAt: "2026-07-23T00:00:00.000Z",
  });

  assert.ok(profile);
  assert.equal(profile.place.name, "常磐公園");
  assert.equal(profile.place.type, "park");
  assert.equal(profile.summary.recordCount, 3);
  assert.equal(profile.recentRecords.length, 3);
  assert.equal(profile.recentRecords.find((record) => record.recordId === "record-1")?.identificationStatus, "ai_candidate");
  assert.equal(profile.recentRecords.find((record) => record.recordId === "record-1")?.themes.includes("scenery"), true);
  assert.equal(profile.place.representativeMedia.length, 2);
  assert.equal(profile.summary.contributorCount, null);
  assert.equal(profile.publication.locationMode, "field");
  assert.equal(profile.publication.status, "partial");
  assert.deepEqual(profile.publication.suppressedSections, ["field_profile_narrative"]);
  assert.equal((profile.guide as { id: string }).id, "tokiwa-guide");
  assert.doesNotMatch(JSON.stringify(profile), /34\.9702|138\.3805|exact_lat|exact_lng|user-a/);
});

test("field atlas honors sensitive policy suppression even when public snapshot rows exist", async () => {
  const profile = await loadCloudflarePlaceAtlasProfile({
    db: new FixtureDb(tokiwaFixtures("sensitive_precheck_failed")),
    placeRef: { kind: "field", fieldId: TOKIWA_FIELD_ID },
  });

  assert.ok(profile);
  assert.equal(profile.publication.status, "suppressed");
  assert.equal(profile.summary.recordCount, null);
  assert.equal(profile.recentRecords.length, 0);
  assert.equal(profile.place.representativeMedia.length, 0);
  assert.ok(profile.publication.suppressedSections.includes("recent_records"));
  assert.ok(profile.publication.suppressedSections.includes("contribution_cta"));
});

test("field atlas suppresses direct contribution for schools", async () => {
  const fixtures = tokiwaFixtures(null);
  fixtures.field = {
    ...fixtures.field,
    source: "school",
    admin_level: "school",
    name: "公開範囲を限定する学校",
  };
  const profile = await loadCloudflarePlaceAtlasProfile({
    db: new FixtureDb(fixtures),
    placeRef: { kind: "field", fieldId: TOKIWA_FIELD_ID },
  });

  assert.ok(profile);
  assert.equal(profile.place.type, "school");
  assert.ok(profile.publication.suppressedSections.includes("contribution_cta"));
});

test("public cell atlas uses the same contract without exact-coordinate joins", async () => {
  const fixtures = tokiwaFixtures(null);
  fixtures.snapshots = fixtures.snapshots?.filter((row) =>
    ["record-1", "record-2", "record-3"].includes(String(row.visit_id))
  );
  fixtures.visits = [];
  const profile = await loadCloudflarePlaceAtlasProfile({
    db: new FixtureDb(fixtures),
    placeRef: { kind: "public_cell", cellId: "cell:34.97,138.38" },
  });

  assert.ok(profile);
  assert.equal(profile.place.name, "このあたりの地域図鑑");
  assert.equal(profile.publication.locationMode, "public_cell");
  assert.equal(profile.summary.recordCount, 3);
  assert.doesNotMatch(JSON.stringify(profile), /34\.9702|138\.3805|exact_lat|exact_lng/);
});

test("public cell atlas accepts the canonical Web Mercator grid cell id", async () => {
  const fixtures = tokiwaFixtures(null);
  fixtures.snapshots = fixtures.snapshots?.filter((row) =>
    ["record-1", "record-2", "record-3"].includes(String(row.visit_id))
  );
  fixtures.visits = [];
  const profile = await loadCloudflarePlaceAtlasProfile({
    db: new FixtureDb(fixtures),
    placeRef: { kind: "public_cell", cellId: "1000:15404:4159" },
  });

  assert.ok(profile);
  assert.equal(profile.place.type, "public_cell");
  assert.equal(profile.summary.recordCount, 3);
  assert.equal(profile.publication.locationMode, "public_cell");
  assert.doesNotMatch(JSON.stringify(profile), /34\.97|138\.38|exact_lat|exact_lng/);
});

test("generic OSM park resolution does not depend on a Tokiwa-specific branch", async () => {
  const fixtures = tokiwaFixtures(null);
  const fetchFn: typeof fetch = async () => new Response(JSON.stringify({
    elements: [{
      type: "way",
      id: 987654,
      tags: {
        name: "別のまちの公園",
        leisure: "park",
        toilets: "yes",
      },
      geometry: [
        { lat: 34.966, lon: 138.376 },
        { lat: 34.966, lon: 138.385 },
        { lat: 34.975, lon: 138.385 },
        { lat: 34.975, lon: 138.376 },
        { lat: 34.966, lon: 138.376 },
      ],
    }],
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  const profile = await loadCloudflarePlaceAtlasProfile({
    db: new FixtureDb(fixtures),
    placeRef: {
      kind: "osm_area",
      entityKey: "osm:way:987654",
      osmType: "way",
      osmId: 987654,
    },
    fetchFn,
  });

  assert.ok(profile);
  assert.equal(profile.place.name, "別のまちの公園");
  assert.equal(profile.publication.locationMode, "osm_area");
  assert.equal(profile.summary.recordCount, 3);
  assert.deepEqual(profile.facilities, [{
    kind: "toilet",
    label: "トイレ",
    source: "OpenStreetMap",
    confidence: "derived",
  }]);
});

test("generic OSM profile parity includes theme parks and shopping malls", async () => {
  const fixtures = tokiwaFixtures(null);
  const cases = [
    {
      id: 1281984233,
      tags: {
        name: "JUNGLIA OKINAWA",
        "name:ja": "ジャングリア沖縄",
        tourism: "theme_park",
      },
      expectedName: "ジャングリア沖縄",
      expectedType: "theme_park",
    },
    {
      id: 189307274,
      tags: {
        name: "イオンモール浜松市野",
        "name:ja": "イオン",
        brand: "イオン",
        shop: "mall",
      },
      expectedName: "イオンモール浜松市野",
      expectedType: "shopping_mall",
    },
  ] as const;

  for (const fixture of cases) {
    const fetchFn: typeof fetch = async () => new Response(JSON.stringify({
      elements: [{
        type: "way",
        id: fixture.id,
        tags: fixture.tags,
        geometry: [
          { lat: 34.966, lon: 138.376 },
          { lat: 34.966, lon: 138.385 },
          { lat: 34.975, lon: 138.385 },
          { lat: 34.975, lon: 138.376 },
          { lat: 34.966, lon: 138.376 },
        ],
      }],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    const profile = await loadCloudflarePlaceAtlasProfile({
      db: new FixtureDb(fixtures),
      placeRef: {
        kind: "osm_area",
        entityKey: `osm:way:${fixture.id}`,
        osmType: "way",
        osmId: fixture.id,
      },
      fetchFn,
    });
    assert.ok(profile);
    assert.equal(profile.place.name, fixture.expectedName);
    assert.equal(profile.place.type, fixture.expectedType);
    assert.ok(!profile.publication.suppressedSections.includes("contribution_cta"));
  }
});

test("verified registry overrides OSM display and policy while retaining both provenances", async () => {
  const fixtures = tokiwaFixtures(null);
  fixtures.registeredPlace = {
    place_id: "plc_1dac5b52233720ee",
    canonical_name: "JUNGLIA OKINAWA",
    locality_label: "沖縄県国頭郡今帰仁村",
    place_kind: "theme_park",
    verification_status: "verified",
    official_status: "official",
    public_summary: "公式情報と公開Recordを束ねた場所図鑑です。",
    recording_policy: "permission_required",
    public_location_mode: "place",
    contribution_cta_mode: "suppressed",
    official_rule_url: "https://junglia.jp/terms/park-termsofuse",
    policy_verification_status: "verified",
  };
  fixtures.placeAliases = [{ alias: "ジャングリア沖縄" }, { alias: "JUNGLIA" }];
  fixtures.placeSources = [{
    source_type: "facility_official",
    source_id: "junglia:official",
    source_url: "https://www.junglia.jp/en",
    source_confidence: 1,
    verification_status: "verified",
    last_checked_at: "2026-07-23T00:00:00Z",
  }, {
    source_type: "osm",
    source_id: "way:1281984233",
    source_url: "https://www.openstreetmap.org/way/1281984233",
    source_confidence: 0.9,
    verification_status: "source_verified",
    last_checked_at: "2026-07-23T00:00:00Z",
  }];
  fixtures.placeContent = [{
    content_kind: "activity",
    title: "開催中の活動",
    body: "公式出典付き",
    starts_at: "2026-07-01T00:00:00Z",
    ends_at: "2026-08-01T00:00:00Z",
    last_checked_at: "2026-07-23T00:00:00Z",
    source_type: "facility_official",
    source_url: "https://www.junglia.jp/en",
    verification_status: "verified",
  }];
  const fetchFn: typeof fetch = async () => new Response(JSON.stringify({
    elements: [{
      type: "way",
      id: 1281984233,
      tags: {
        name: "ジャングリア沖縄",
        tourism: "theme_park",
        access: "yes",
      },
      geometry: [
        { lat: 34.966, lon: 138.376 },
        { lat: 34.966, lon: 138.385 },
        { lat: 34.975, lon: 138.385 },
        { lat: 34.975, lon: 138.376 },
        { lat: 34.966, lon: 138.376 },
      ],
    }],
  }), { status: 200, headers: { "content-type": "application/json" } });
  const profile = await loadCloudflarePlaceAtlasProfile({
    db: new FixtureDb(fixtures),
    placeRef: {
      kind: "osm_area",
      entityKey: "osm:way:1281984233",
      osmType: "way",
      osmId: 1281984233,
    },
    fetchFn,
    generatedAt: "2026-07-23T00:00:00Z",
  });
  assert.ok(profile);
  assert.equal(profile.place.name, "JUNGLIA OKINAWA");
  assert.equal(profile.place.canonicalPlaceId, "plc_1dac5b52233720ee");
  assert.equal(profile.place.officialStatus, "official");
  assert.equal(profile.policy?.recordingPolicy, "permission_required");
  assert.equal(profile.policy?.contributionCtaMode, "suppressed");
  assert.ok(profile.publication.suppressedSections.includes("contribution_cta"));
  assert.equal(profile.activities?.[0] && (profile.activities[0] as { temporalState: string }).temporalState, "active");
  assert.equal(profile.provenance.sourceReferences?.length, 2);
});

test("verified registry boundary keeps the profile available during an Overpass outage", async () => {
  const fixtures = tokiwaFixtures(null);
  fixtures.registeredPlace = {
    place_id: "plc_1dac5b52233720ee",
    canonical_name: "JUNGLIA OKINAWA",
    locality_label: "沖縄県国頭郡今帰仁村",
    place_kind: "theme_park",
    verification_status: "verified",
    official_status: "official",
    public_summary: "公式情報と公開Recordを束ねた場所図鑑です。",
    recording_policy: "permission_required",
    public_location_mode: "place",
    contribution_cta_mode: "suppressed",
    official_rule_url: "https://junglia.jp/terms/park-termsofuse",
    policy_verification_status: "verified",
  };
  fixtures.placeAliases = [{ alias: "ジャングリア沖縄" }, { alias: "JUNGLIA" }];
  fixtures.placeSources = [{
    source_type: "osm",
    source_id: "way:1281984233",
    source_url: "https://www.openstreetmap.org/way/1281984233",
    source_confidence: 0.9,
    verification_status: "source_verified",
    last_checked_at: "2026-07-23T00:00:00Z",
  }];
  fixtures.placeBoundary = {
    boundary_geojson: JSON.stringify(TOKIWA_GEOMETRY),
    confidence: 0.9,
    precision_kind: "exact",
    bbox_west: 138.376,
    bbox_south: 34.966,
    bbox_east: 138.385,
    bbox_north: 34.975,
  };
  let fetchCalls = 0;
  const profile = await loadCloudflarePlaceAtlasProfile({
    db: new FixtureDb(fixtures),
    placeRef: {
      kind: "osm_area",
      entityKey: "osm:way:1281984233",
      osmType: "way",
      osmId: 1281984233,
    },
    fetchFn: async () => {
      fetchCalls += 1;
      throw new Error("overpass_unavailable");
    },
    generatedAt: "2026-07-23T00:00:00Z",
  });

  assert.ok(profile);
  assert.equal(fetchCalls, 0);
  assert.equal(profile.place.name, "JUNGLIA OKINAWA");
  assert.equal(profile.place.canonicalPlaceId, "plc_1dac5b52233720ee");
  assert.equal(profile.publication.locationMode, "osm_area");
  assert.ok(profile.publication.suppressedSections.includes("contribution_cta"));
  assert.doesNotMatch(JSON.stringify(profile), /exact_lat|exact_lng/);
});

test("registered Place reuses confirmed historic Records without Occurrence overcount or candidate leakage", async () => {
  const fixtures = tokiwaFixtures(null);
  fixtures.registeredPlace = {
    place_id: "plc_1dac5b52233720ee",
    canonical_name: "JUNGLIA OKINAWA",
    locality_label: "沖縄県国頭郡今帰仁村",
    place_kind: "theme_park",
    verification_status: "verified",
    official_status: "official",
    public_summary: "公式情報と公開Recordを束ねた場所図鑑です。",
    recording_policy: "permission_required",
    public_location_mode: "place",
    contribution_cta_mode: "suppressed",
    official_rule_url: "https://junglia.jp/terms/park-termsofuse",
    policy_verification_status: "verified",
  };
  fixtures.placeBoundary = {
    boundary_geojson: JSON.stringify(TOKIWA_GEOMETRY),
    confidence: 0.9,
    precision_kind: "exact",
    bbox_west: 138.376,
    bbox_south: 34.966,
    bbox_east: 138.385,
    bbox_north: 34.975,
  };
  fixtures.membershipRecords = [
    {
      place_id: "plc_1dac5b52233720ee",
      occurrence_id: "historic-1-a",
      visit_id: "historic-1",
      observed_at: "2026-07-19T00:00:00Z",
      taxon_group: "species",
      display_name: "過去Record 1",
      is_ai_candidate: 0,
      is_awaiting_id: 0,
      photo_url: null,
      cell_1000: "",
      asset_count: 2,
      membership_state: "confirmed",
      removed_at: null,
    },
    {
      place_id: "plc_1dac5b52233720ee",
      occurrence_id: "historic-1-b",
      visit_id: "historic-1",
      observed_at: "2026-07-19T00:00:00Z",
      taxon_group: "species",
      display_name: "同じRecord内の別Occurrence",
      is_ai_candidate: 0,
      is_awaiting_id: 0,
      photo_url: null,
      cell_1000: "",
      asset_count: 2,
      membership_state: "confirmed",
      removed_at: null,
    },
    {
      place_id: "plc_1dac5b52233720ee",
      occurrence_id: "historic-2-a",
      visit_id: "historic-2",
      observed_at: "2026-07-18T00:00:00Z",
      taxon_group: "species",
      display_name: "過去Record 2",
      is_ai_candidate: 0,
      is_awaiting_id: 0,
      photo_url: null,
      cell_1000: "",
      asset_count: 1,
      membership_state: "confirmed",
      removed_at: null,
    },
    {
      place_id: "plc_1dac5b52233720ee",
      occurrence_id: "historic-3-a",
      visit_id: "historic-3",
      observed_at: "2026-07-17T00:00:00Z",
      taxon_group: "species",
      display_name: "過去Record 3",
      is_ai_candidate: 0,
      is_awaiting_id: 0,
      photo_url: null,
      cell_1000: "",
      asset_count: 1,
      membership_state: "confirmed",
      removed_at: null,
    },
  ];
  fixtures.excludedMembershipRecordIds = [{ record_id: "record-1" }];

  const profile = await loadCloudflarePlaceAtlasProfile({
    db: new FixtureDb(fixtures),
    placeRef: {
      kind: "osm_area",
      entityKey: "osm:way:1281984233",
      osmType: "way",
      osmId: 1281984233,
    },
    fetchFn: async () => {
      throw new Error("registered boundary must avoid Overpass");
    },
    generatedAt: "2026-07-23T00:00:00Z",
  });

  assert.ok(profile);
  assert.equal(profile.summary.recordCount, 5);
  assert.match(JSON.stringify(profile), /過去Record 1/);
  assert.doesNotMatch(JSON.stringify(profile), /同じRecord内の別Occurrence/);
  assert.doesNotMatch(JSON.stringify(profile), /候補Record/);
  assert.ok(profile.provenance.sources.includes("record_place_memberships"));
  assert.doesNotMatch(JSON.stringify(profile), /exact_lat|exact_lng|user_id/);
});

test("merged geometry and membership overflow reports partial instead of an exact 500", async () => {
  const fixtures = tokiwaFixtures(null);
  fixtures.registeredPlace = {
    place_id: "plc_merged_overflow",
    canonical_name: "統合上限検証Place",
    locality_label: null,
    place_kind: "other_named_area",
    verification_status: "verified",
    official_status: "unknown",
    public_summary: null,
    recording_policy: "check_rules",
    public_location_mode: "place",
    contribution_cta_mode: "check_rules",
    official_rule_url: null,
    policy_verification_status: "source_verified",
  };
  fixtures.placeBoundary = {
    boundary_geojson: JSON.stringify(TOKIWA_GEOMETRY),
    confidence: 0.9,
    precision_kind: "exact",
    bbox_west: 138.376,
    bbox_south: 34.966,
    bbox_east: 138.385,
    bbox_north: 34.975,
  };
  fixtures.snapshots = Array.from({ length: 300 }, (_, index) => ({
    occurrence_id: `snapshot-occurrence-${index}`,
    visit_id: `snapshot-record-${index}`,
    observed_at: `2026-07-${String(20 - (index % 10)).padStart(2, "0")}T10:00:00Z`,
    taxon_group: "other",
    display_name: `snapshot-${index}`,
    is_ai_candidate: 0,
    is_awaiting_id: 0,
    photo_url: null,
    cell_1000: "34.97,138.38",
    asset_count: 0,
  }));
  fixtures.visits = fixtures.snapshots.map((row) => ({
    visit_id: row.visit_id,
    place_id: null,
    user_id: `private-test-id-${row.visit_id}`,
    exact_lat: 34.9702,
    exact_lng: 138.3805,
    public_visibility: "public",
  }));
  fixtures.membershipRecords = Array.from({ length: 300 }, (_, index) => ({
    place_id: "plc_merged_overflow",
    occurrence_id: `historic-occurrence-${index}`,
    visit_id: `historic-record-${index}`,
    observed_at: `2026-06-${String(20 - (index % 10)).padStart(2, "0")}T10:00:00Z`,
    taxon_group: "other",
    display_name: `historic-${index}`,
    is_ai_candidate: 0,
    is_awaiting_id: 0,
    photo_url: null,
    cell_1000: "",
    asset_count: 0,
    membership_state: "confirmed",
    removed_at: null,
  }));

  const profile = await loadCloudflarePlaceAtlasProfile({
    db: new FixtureDb(fixtures),
    placeRef: {
      kind: "osm_area",
      entityKey: "osm:way:999002",
      osmType: "way",
      osmId: 999002,
    },
    fetchFn: async () => {
      throw new Error("registered boundary must avoid Overpass");
    },
    generatedAt: "2026-07-23T00:00:00Z",
  });

  assert.ok(profile);
  assert.equal(profile.summary.recordCount, null);
  assert.equal(profile.publication.status, "partial");
  assert.equal(profile.recentRecords.length, 12);
});

test("membership exclusion overflow suppresses geometry fallback and reports partial", async () => {
  const fixtures = tokiwaFixtures(null);
  fixtures.registeredPlace = {
    place_id: "plc_overflow",
    canonical_name: "除外上限検証Place",
    locality_label: null,
    place_kind: "other_named_area",
    verification_status: "verified",
    official_status: "unknown",
    public_summary: null,
    recording_policy: "check_rules",
    public_location_mode: "place",
    contribution_cta_mode: "check_rules",
    official_rule_url: null,
    policy_verification_status: "source_verified",
  };
  fixtures.placeBoundary = {
    boundary_geojson: JSON.stringify(TOKIWA_GEOMETRY),
    confidence: 0.9,
    precision_kind: "exact",
    bbox_west: 138.376,
    bbox_south: 34.966,
    bbox_east: 138.385,
    bbox_north: 34.975,
  };
  fixtures.excludedMembershipRecordIds = Array.from(
    { length: 5_001 },
    (_, index) => ({ record_id: `excluded-${index}` }),
  );

  const profile = await loadCloudflarePlaceAtlasProfile({
    db: new FixtureDb(fixtures),
    placeRef: {
      kind: "osm_area",
      entityKey: "osm:way:999001",
      osmType: "way",
      osmId: 999001,
    },
    fetchFn: async () => {
      throw new Error("registered boundary must avoid Overpass");
    },
    generatedAt: "2026-07-23T00:00:00Z",
  });

  assert.ok(profile);
  assert.equal(profile.summary.recordCount, null);
  assert.equal(profile.publication.status, "partial");
  assert.doesNotMatch(JSON.stringify(profile), /スズメ|アジサイ|サクラ/);
  assert.ok(profile.provenance.sources.includes("record_place_memberships"));
});

test("generic OSM schools suppress direct contribution", async () => {
  const fixtures = tokiwaFixtures(null);
  const fetchFn: typeof fetch = async () => new Response(JSON.stringify({
    elements: [{
      type: "way",
      id: 987658,
      tags: {
        name: "公開範囲を限定する学校",
        amenity: "school",
      },
      geometry: [
        { lat: 34.966, lon: 138.376 },
        { lat: 34.966, lon: 138.385 },
        { lat: 34.975, lon: 138.385 },
        { lat: 34.975, lon: 138.376 },
        { lat: 34.966, lon: 138.376 },
      ],
    }],
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  const profile = await loadCloudflarePlaceAtlasProfile({
    db: new FixtureDb(fixtures),
    placeRef: {
      kind: "osm_area",
      entityKey: "osm:way:987658",
      osmType: "way",
      osmId: 987658,
    },
    fetchFn,
  });

  assert.ok(profile);
  assert.equal(profile.place.type, "school");
  assert.ok(profile.publication.suppressedSections.includes("contribution_cta"));
  assert.ok(profile.dataGaps.some((gap) => gap.key === "access"));
});

test("generic OSM restricted access suppresses direct contribution", async () => {
  const fixtures = tokiwaFixtures(null);
  const fetchFn: typeof fetch = async () => new Response(JSON.stringify({
    elements: [{
      type: "way",
      id: 987659,
      tags: {
        name: "立入制限のある公園",
        leisure: "park",
        access: "restricted",
      },
      geometry: [
        { lat: 34.966, lon: 138.376 },
        { lat: 34.966, lon: 138.385 },
        { lat: 34.975, lon: 138.385 },
        { lat: 34.975, lon: 138.376 },
        { lat: 34.966, lon: 138.376 },
      ],
    }],
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  const profile = await loadCloudflarePlaceAtlasProfile({
    db: new FixtureDb(fixtures),
    placeRef: {
      kind: "osm_area",
      entityKey: "osm:way:987659",
      osmType: "way",
      osmId: 987659,
    },
    fetchFn,
  });

  assert.ok(profile);
  assert.equal(profile.place.type, "park");
  assert.ok(profile.publication.suppressedSections.includes("contribution_cta"));
  assert.ok(profile.dataGaps.some((gap) => gap.key === "access"));
});

test("oversized OSM geometry does not fall back to an unbounded global snapshot scan", async () => {
  const fixtures = tokiwaFixtures(null);
  const fetchFn: typeof fetch = async () => new Response(JSON.stringify({
    elements: [{
      type: "way",
      id: 987655,
      tags: {
        name: "広すぎる森林",
        landuse: "forest",
      },
      geometry: [
        { lat: 20, lon: 120 },
        { lat: 20, lon: 150 },
        { lat: 45, lon: 150 },
        { lat: 45, lon: 120 },
        { lat: 20, lon: 120 },
      ],
    }],
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  const profile = await loadCloudflarePlaceAtlasProfile({
    db: new FixtureDb(fixtures),
    placeRef: {
      kind: "osm_area",
      entityKey: "osm:way:987655",
      osmType: "way",
      osmId: 987655,
    },
    fetchFn,
  });

  assert.ok(profile);
  assert.equal(profile.summary.recordCount, null);
  assert.equal(profile.recentRecords.length, 0);
});

test("vertex-heavy OSM geometry returns a partial profile without request-time point scans", async () => {
  const fixtures = tokiwaFixtures(null);
  fixtures.snapshotBindCounts = [];
  const geometry = Array.from({ length: 1_001 }, (_, index) => {
    const angle = index / 1_000 * Math.PI * 2;
    return {
      lat: 34.97 + Math.sin(angle) * 0.005,
      lon: 138.38 + Math.cos(angle) * 0.005,
    };
  });
  geometry.push({ ...geometry[0]! });
  const fetchFn: typeof fetch = async () => new Response(JSON.stringify({
    elements: [{
      type: "way",
      id: 987660,
      tags: {
        name: "頂点過多の公園",
        leisure: "park",
      },
      geometry,
    }],
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  const profile = await loadCloudflarePlaceAtlasProfile({
    db: new FixtureDb(fixtures),
    placeRef: {
      kind: "osm_area",
      entityKey: "osm:way:987660",
      osmType: "way",
      osmId: 987660,
    },
    fetchFn,
  });

  assert.ok(profile);
  assert.equal(profile.publication.status, "partial");
  assert.equal(profile.summary.recordCount, null);
  assert.deepEqual(fixtures.snapshotBindCounts, []);
  assert.equal(placeAtlasGeometryWithinRuntimeBudget({
    type: "Polygon",
    coordinates: [geometry.map((point) => [point.lon, point.lat])],
  }), false);
});

test("dense snapshots are capped and reported as partial instead of overstating totals", async () => {
  const fixtures = tokiwaFixtures(null);
  fixtures.snapshots = Array.from({ length: 600 }, (_, index) => ({
    occurrence_id: `occ:dense-${index}:0`,
    visit_id: `dense-${index}`,
    observed_at: `2026-07-${String(1 + index % 23).padStart(2, "0")}T10:00:00.000Z`,
    taxon_group: "plant",
    display_name: `密集記録${index}`,
    is_ai_candidate: 0,
    is_awaiting_id: 0,
    photo_url: null,
    cell_1000: "34.97,138.38",
    asset_count: 0,
  }));
  fixtures.visits = Array.from({ length: 600 }, (_, index) => ({
    visit_id: `dense-${index}`,
    place_id: null,
    user_id: `user-${index}`,
    exact_lat: 34.9702,
    exact_lng: 138.3805,
    public_visibility: "public",
  }));

  const profile = await loadCloudflarePlaceAtlasProfile({
    db: new FixtureDb(fixtures),
    placeRef: { kind: "field", fieldId: TOKIWA_FIELD_ID },
  });

  assert.ok(profile);
  assert.equal(profile.publication.status, "partial");
  assert.equal(profile.summary.recordCount, null);
  assert.ok(profile.recentRecords.length <= 24);
});

test("medium OSM geometry chunks public snapshot cells below the D1 bind limit", async () => {
  const fixtures = tokiwaFixtures(null);
  fixtures.snapshotBindCounts = [];
  const fetchFn: typeof fetch = async () => new Response(JSON.stringify({
    elements: [{
      type: "way",
      id: 987657,
      tags: {
        name: "複数セルにまたがる公園",
        leisure: "park",
      },
      geometry: [
        { lat: 34.92, lon: 138.33 },
        { lat: 34.92, lon: 138.43 },
        { lat: 35.02, lon: 138.43 },
        { lat: 35.02, lon: 138.33 },
        { lat: 34.92, lon: 138.33 },
      ],
    }],
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  const profile = await loadCloudflarePlaceAtlasProfile({
    db: new FixtureDb(fixtures),
    placeRef: {
      kind: "osm_area",
      entityKey: "osm:way:987657",
      osmType: "way",
      osmId: 987657,
    },
    fetchFn,
  });

  assert.ok(profile);
  assert.ok(fixtures.snapshotBindCounts.length > 1);
  assert.ok(fixtures.snapshotBindCounts.every((count) => count <= 82));
  assert.equal(profile.summary.recordCount, 3);
});

test("OSM relation inner rings stay excluded from the Record scope", async () => {
  const fixtures = tokiwaFixtures(null);
  const fetchFn: typeof fetch = async () => new Response(JSON.stringify({
    elements: [{
      type: "relation",
      id: 987656,
      tags: {
        name: "中抜きのある公園",
        leisure: "park",
      },
      members: [
        {
          type: "way",
          role: "outer",
          geometry: [
            { lat: 34.96, lon: 138.37 },
            { lat: 34.96, lon: 138.39 },
            { lat: 34.98, lon: 138.39 },
            { lat: 34.98, lon: 138.37 },
            { lat: 34.96, lon: 138.37 },
          ],
        },
        {
          type: "way",
          role: "inner",
          geometry: [
            { lat: 34.965, lon: 138.375 },
            { lat: 34.965, lon: 138.386 },
            { lat: 34.976, lon: 138.386 },
            { lat: 34.976, lon: 138.375 },
            { lat: 34.965, lon: 138.375 },
          ],
        },
      ],
    }],
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  const profile = await loadCloudflarePlaceAtlasProfile({
    db: new FixtureDb(fixtures),
    placeRef: {
      kind: "osm_area",
      entityKey: "osm:relation:987656",
      osmType: "relation",
      osmId: 987656,
    },
    fetchFn,
  });

  assert.ok(profile);
  assert.equal(profile.summary.recordCount, 0);
  assert.equal(profile.recentRecords.length, 0);
});

test("Place Atlas publishes only explicit opt-in, approved memories attached to public Records", async () => {
  const fixtures = tokiwaFixtures(null);
  fixtures.memories = [
    {
      entry_id: "memory-public",
      visit_id: "record-1",
      occurrence_id: "occ:record-1:0",
      user_id: "user-a",
      cell_id: "34.97,138.38",
      memory_tags_json: JSON.stringify(["season_change"]),
      tags_public: 1,
      echo_note: "公開できる思い出",
      photo_echo_visibility: "hidden_by_user",
      moderation_status: "visible",
      public_place_opt_in: 1,
      public_place_moderation_status: "approved",
      public_attribution_mode: "anonymous",
      updated_at: "2026-07-20T10:00:00.000Z",
    },
    {
      entry_id: "memory-private-record",
      visit_id: "private",
      occurrence_id: "occ:private:0",
      user_id: "user-e",
      cell_id: "34.97,138.38",
      memory_tags_json: JSON.stringify(["quiet_moment"]),
      tags_public: 1,
      echo_note: "非公開Record由来",
      photo_echo_visibility: "hidden_by_user",
      moderation_status: "visible",
      public_place_opt_in: 1,
      public_place_moderation_status: "approved",
      public_attribution_mode: "anonymous",
      updated_at: "2026-07-21T10:00:00.000Z",
    },
    {
      entry_id: "memory-hidden-by-viewer",
      visit_id: "record-2",
      occurrence_id: "occ:record-2:0",
      user_id: "user-b",
      cell_id: "34.97,138.38",
      memory_tags_json: JSON.stringify(["first_visit"]),
      tags_public: 1,
      echo_note: "opt-inされていない思い出",
      photo_echo_visibility: "hidden_by_user",
      moderation_status: "visible",
      public_place_opt_in: 0,
      public_place_moderation_status: "not_submitted",
      public_attribution_mode: "anonymous",
      updated_at: "2026-07-22T10:00:00.000Z",
    },
  ];

  const profile = await loadCloudflarePlaceAtlasProfile({
    db: new FixtureDb(fixtures),
    placeRef: { kind: "field", fieldId: TOKIWA_FIELD_ID },
    viewerUserId: "viewer-1",
  });

  assert.ok(profile);
  assert.deepEqual(profile.memories, [{
    entryId: "memory-public",
    recordId: "record-1",
    tags: ["season_change"],
    echoNote: "公開できる思い出",
    observedYearMonth: "2026-07",
    photoState: "hidden_by_user",
    sourceLabel: "利用者の地域記憶",
    moderationStatus: "approved",
    attributionMode: "anonymous",
  }]);
});

test("polygon holes stay excluded from exact internal scope checks", () => {
  const geometry = {
    type: "Polygon" as const,
    coordinates: [
      [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
      [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
    ],
  };
  assert.equal(pointInPlaceAtlasGeometry(2, 2, geometry), true);
  assert.equal(pointInPlaceAtlasGeometry(5, 5, geometry), false);
  assert.equal(pointInPlaceAtlasGeometry(12, 5, geometry), false);
});
