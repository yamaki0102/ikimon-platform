import assert from "node:assert/strict";
import test from "node:test";
import type { ObservationField } from "./observationFieldRegistry.js";
import type { PublicMapObservationList } from "./mapSnapshot.js";
import {
  getPlaceAtlasProfile,
  type PlaceAtlasProfileDependencies,
} from "./placeAtlasProfile.js";

const TOKIWA_FIELD_ID = "d50678d0-ba57-4d3d-a713-2fe441d646ab";

function fieldFixture(overrides: Partial<ObservationField> = {}): ObservationField {
  return {
    fieldId: TOKIWA_FIELD_ID,
    source: "user_defined",
    adminLevel: "osm_park",
    name: "常磐公園",
    nameKana: "",
    summary: "市街地にある公園です。",
    prefecture: "静岡県",
    city: "静岡市",
    lat: 34.9701378,
    lng: 138.38031545,
    radiusM: 600,
    polygon: {
      type: "Polygon",
      coordinates: [[
        [138.376, 34.967],
        [138.384, 34.967],
        [138.384, 34.973],
        [138.376, 34.973],
        [138.376, 34.967],
      ]],
    },
    areaHa: 13,
    certificationId: "",
    certifiedAt: null,
    officialUrl: "",
    ownerUrl: "",
    storyUrl: "",
    certificationUrl: "",
    sourceConfidence: 0.9,
    verificationLevel: "registry_matched",
    verificationMethod: "osm",
    verificationLabel: "OSM registry",
    verificationUpdatedAt: null,
    ownerUserId: null,
    entityKey: "osm:way:125727939",
    validFrom: null,
    validTo: null,
    supersededBy: null,
    profileStatus: "public_summary",
    defaultPublicLocationMode: "site",
    publicProfileEnabled: true,
    profilePolicyVersion: "site_intelligence_p0_v1",
    profileNotes: "",
    payload: {
      facilities: [
        { kind: "bench", label: "ベンチ" },
        { kind: "toilet", label: "トイレ" },
      ],
    },
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-22T00:00:00Z",
    ...overrides,
  };
}

function publicMapList(): PublicMapObservationList {
  return {
    items: [
      {
        occurrenceId: "occ:record-1:0",
        visitId: "record-1",
        displayName: "名前待ち",
        isAiCandidate: false,
        isAwaitingId: true,
        localityLabel: "位置をぼかしています",
        observedAt: "2026-05-25T14:44:44+09:00",
        photoUrl: "/derived/record-1/display.webp",
        taxonGroup: "other",
      },
      {
        occurrenceId: "occ:record-1:1",
        visitId: "record-1",
        displayName: "AI候補",
        isAiCandidate: true,
        isAwaitingId: false,
        localityLabel: "位置をぼかしています",
        observedAt: "2026-05-25T14:44:44+09:00",
        photoUrl: "/derived/record-1/display.webp",
        taxonGroup: "bird",
      },
      {
        occurrenceId: "occ:record-2:0",
        visitId: "record-2",
        displayName: "タンポポ",
        isAiCandidate: false,
        isAwaitingId: false,
        localityLabel: "位置をぼかしています",
        observedAt: "2026-04-15T10:00:00+09:00",
        photoUrl: "/derived/record-2/display.webp",
        taxonGroup: "plant",
      },
      {
        occurrenceId: "occ:record-3:0",
        visitId: "record-3",
        displayName: "同定待ち",
        isAiCandidate: false,
        isAwaitingId: true,
        localityLabel: "位置をぼかしています",
        observedAt: "2026-04-10T10:00:00+09:00",
        photoUrl: "/derived/record-3/display.webp",
        taxonGroup: "other",
      },
    ],
    stats: {
      totalReturned: 4,
      totalAll: 4,
      markerProfile: "all_research_artifacts",
      gridM: 1000,
      selectedCellId: null,
      provenance: {
        sampled: false,
        sampleSize: 4,
        visible: { manual: 4, legacy: 0, track: 0, other: 0 },
        excluded: { manual: 0, legacy: 0, track: 0, other: 0 },
      },
      privacy: {
        minCellRecords: 3,
        sensitiveMinCellMeters: 5000,
        municipalityMinCellMeters: 20000,
        bboxScope: "fixed_public_cell_cover",
        policy: "k_anonymous_cell_aggregate",
        exposesSuppressedCounts: false,
      },
    },
  };
}

function dependencies(overrides: Partial<PlaceAtlasProfileDependencies> = {}): PlaceAtlasProfileDependencies {
  return {
    getField: async () => fieldFixture(),
    getMapObservations: async () => publicMapList(),
    loadAreaVisitIds: async () => ["record-1", "record-2", "record-3"],
    resolveOsmArea: async () => ({
      entityKey: "osm:way:125727939",
      osmType: "way",
      osmId: 125727939,
      name: "常磐公園",
      source: "osm_park",
      sourceLabel: "公園・緑地 (OSM live)",
      access: "yes",
      center: { lat: 34.9701378, lng: 138.38031545 },
      geometry: fieldFixture().polygon!,
    }),
    listGuideSpots: () => ({
      type: "FeatureCollection",
      features: [],
    }),
    listMemories: async (input) => ({
      ok: true,
      cellId: input.cellId,
      unlocked: true,
      items: [{
        entryId: "memory-1",
        cellId: input.cellId,
        tags: ["quiet_moment"],
        echoNote: "朝の散歩",
        observedYearMonth: "2026-05",
        photoUrl: null,
        photoState: "hidden_by_user",
        likeCount: 0,
        likedByMe: false,
        ownEntry: true,
      }],
    }),
    now: () => "2026-07-23T00:00:00.000Z",
    ...overrides,
  };
}

test("builds a registered field profile from distinct public Records, not Occurrences", async () => {
  const profile = await getPlaceAtlasProfile(
    { kind: "field", fieldId: TOKIWA_FIELD_ID },
    { viewerUserId: "viewer-1" },
    dependencies(),
  );

  assert.ok(profile);
  assert.equal(profile.place.name, "常磐公園");
  assert.equal(profile.place.type, "park");
  assert.equal(profile.summary.recordCount, 3);
  assert.equal(profile.recentRecords.length, 3);
  assert.equal(profile.publication.locationMode, "field");
  assert.equal(profile.memories.length, 1);
  assert.deepEqual(profile.facilities.map((item) => (item as { kind: string }).kind), ["bench", "toilet"]);
  assert.ok(profile.facets.some((facet) => facet.key === "daily_life"));
  assert.ok(!JSON.stringify(profile).includes("latitude"));
  assert.ok(!JSON.stringify(profile).includes("longitude"));
});

test("falls back to public-cell-derived records when exact area scope is unavailable", async () => {
  const profile = await getPlaceAtlasProfile(
    { kind: "field", fieldId: TOKIWA_FIELD_ID },
    {},
    dependencies({
      loadAreaVisitIds: async () => {
        throw new Error("field_scope_unavailable");
      },
    }),
  );

  assert.ok(profile);
  assert.equal(profile.summary.recordCount, 3);
  assert.equal(profile.publication.locationMode, "public_cell_derived");
  assert.ok(profile.publication.suppressedSections.includes("field_exact_aggregation"));
  assert.ok(profile.dataGaps.some((gap) => gap.key === "field_exact_aggregation"));
});

test("registered school fields use the shared contribution suppression token", async () => {
  const profile = await getPlaceAtlasProfile(
    { kind: "field", fieldId: TOKIWA_FIELD_ID },
    {},
    dependencies({
      getField: async () => fieldFixture({
        source: "school",
        adminLevel: "school",
      }),
    }),
  );

  assert.ok(profile);
  assert.ok(profile.publication.suppressedSections.includes("contribution_cta"));
  assert.ok(!profile.publication.suppressedSections.includes("direct_record_cta"));
});

test("suppresses editorial field details when the field public profile policy is not public", async () => {
  const profile = await getPlaceAtlasProfile(
    { kind: "field", fieldId: TOKIWA_FIELD_ID },
    {},
    dependencies({
      getField: async () => fieldFixture({
        profileStatus: "draft",
        publicProfileEnabled: false,
      }),
    }),
  );

  assert.ok(profile);
  assert.equal(profile.place.description, "公開できる場所情報と地域の記録を束ねた場所図鑑です。");
  assert.ok(profile.publication.suppressedSections.includes("confirmed_life"));
  assert.ok(profile.dataGaps.some((gap) => gap.key === "field_public_profile"));
});

test("returns null for hidden and private fields", async () => {
  for (const profileStatus of ["hidden", "private"] as const) {
    const profile = await getPlaceAtlasProfile(
      { kind: "field", fieldId: TOKIWA_FIELD_ID },
      {},
      dependencies({ getField: async () => fieldFixture({ profileStatus }) }),
    );
    assert.equal(profile, null);
  }
});

test("builds the same public contract for a transient OSM park without hardcoding the park", async () => {
  const profile = await getPlaceAtlasProfile({
    kind: "osm_area",
    entityKey: "osm:way:125727939",
    osmType: "way",
    osmId: 125727939,
  }, {}, dependencies());

  assert.ok(profile);
  assert.equal(profile.placeRef.kind, "osm_area");
  assert.equal(profile.place.name, "常磐公園");
  assert.equal(profile.summary.recordCount, 3);
  assert.equal(profile.publication.locationMode, "osm_area");
  assert.ok(profile.provenance.sources.includes("openstreetmap"));
});

test("transient restricted OSM areas use the shared contribution suppression token", async () => {
  const profile = await getPlaceAtlasProfile({
    kind: "osm_area",
    entityKey: "osm:way:125727939",
    osmType: "way",
    osmId: 125727939,
  }, {}, dependencies({
    resolveOsmArea: async () => ({
      entityKey: "osm:way:125727939",
      osmType: "way",
      osmId: 125727939,
      name: "立入制限のある場所",
      source: "osm_park",
      sourceLabel: "公園・緑地 (OSM live)",
      access: "restricted",
      center: { lat: 34.9701378, lng: 138.38031545 },
      geometry: fieldFixture().polygon!,
    }),
  }));

  assert.ok(profile);
  assert.ok(profile.publication.suppressedSections.includes("contribution_cta"));
  assert.ok(!profile.publication.suppressedSections.includes("direct_record_cta"));
});

test("builds a public-cell profile and keeps AI candidates provisional", async () => {
  const profile = await getPlaceAtlasProfile({
    kind: "public_cell",
    cellId: "1000:15396:4160",
  }, {}, dependencies());

  assert.ok(profile);
  assert.equal(profile.place.type, "public_cell");
  assert.equal(profile.summary.recordCount, 3);
  assert.equal(profile.publication.locationMode, "public_cell");
  assert.ok(profile.publication.suppressedSections.includes("exact_location"));
  assert.ok(profile.recentRecords.some((record) => record.identificationStatus === "ai_candidate"));
  assert.equal(profile.summary.contributorCount, null);
});
