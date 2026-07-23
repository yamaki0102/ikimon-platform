import assert from "node:assert/strict";
import test from "node:test";
import {
  loadCloudflarePlaceAtlasProfile,
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
  memories?: Array<Record<string, unknown>>;
  memoryAccess?: boolean;
  hiddenMemoryEntryIds?: string[];
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
    if (this.query.includes("SELECT EXISTS") && this.query.includes("place_memory_entries")) {
      return ({ has_access: this.data.memoryAccess ? 1 : 0 }) as T;
    }
    throw new Error(`Unhandled first query: ${this.query}`);
  }

  async all<T>(): Promise<{ results: T[] }> {
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
      assert.match(this.query, /place_memory_hidden_entries/);
      const hidden = new Set(this.data.hiddenMemoryEntryIds ?? []);
      const visits = new Map((this.data.visits ?? []).map((row) => [String(row.visit_id), row]));
      return {
        results: (this.data.memories ?? []).filter((row) => {
          const visit = visits.get(String(row.visit_id));
          return visit &&
            (!visit.public_visibility || visit.public_visibility === "public") &&
            !hidden.has(String(row.entry_id));
        }) as T[],
      };
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

test("Place Memory excludes hidden entries and memories attached to private Records", async () => {
  const fixtures = tokiwaFixtures(null);
  fixtures.memoryAccess = true;
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
      echo_note: "閲覧者が非表示にした思い出",
      photo_echo_visibility: "hidden_by_user",
      moderation_status: "visible",
      updated_at: "2026-07-22T10:00:00.000Z",
    },
  ];
  fixtures.hiddenMemoryEntryIds = ["memory-hidden-by-viewer"];

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
    ownEntry: false,
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
