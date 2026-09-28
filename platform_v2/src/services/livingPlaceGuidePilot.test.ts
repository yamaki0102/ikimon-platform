import assert from "node:assert/strict";
import test from "node:test";
import {
  compileAreaPlacePublicContracts,
  type AreaPlacePublicContractsInput,
} from "./areaPlacePublicContracts.js";
import { assessDerivedGuideFreshness } from "./derivedGuideFreshness.js";
import { IWATA_OPEN_DATA_ITEMS } from "./iwataOpenDataSnapshot.js";
import { buildPlaceAtlasProfile } from "./placeAtlasContract.js";
import { buildPlaceAtlasProfileV2 } from "./placeAtlasV2Contract.js";
import { defaultPlacePolicy } from "./placeDomain.js";
import { resolveScanPointRoute, type ScanPointBinding } from "./scanPointRouter.js";

type Season = "summer" | "autumn";
type SeasonalState = "present" | "absent";

function publicSource(input: {
  version: string;
  observedAt: string;
  effectiveFrom: string;
  effectiveUntil: string;
}) {
  return {
    sourceId: "source:synthetic-renri-pilot",
    version: input.version,
    observedAt: input.observedAt,
    effectiveFrom: input.effectiveFrom,
    effectiveUntil: input.effectiveUntil,
    freshness: "CURRENT" as const,
    authority: "SOURCE_VERIFIED" as const,
    rights: "PUBLIC" as const,
  };
}

function areaFixture(input: {
  asOf: string;
  version: string;
  observedAt: string;
  effectiveFrom: string;
  effectiveUntil: string;
  season: Season;
  forestState: SeasonalState;
}): AreaPlacePublicContractsInput {
  const source = publicSource(input);
  return {
    fixtureClass: "synthetic",
    asOf: input.asOf,
    area: {
      id: "area:renri-pilot",
      name: "連理エリア（合成fixture）",
      source,
      publicProjection: "AUTHORIZED",
    },
    places: [
      {
        id: "place:forest",
        areaId: "area:renri-pilot",
        name: "森の場所（合成fixture）",
        source,
        sensitiveLocation: false,
      },
      {
        id: "place:pond",
        areaId: "area:renri-pilot",
        name: "水辺の場所（合成fixture）",
        source,
        sensitiveLocation: false,
      },
    ],
    naturalFeatures: [
      { id: "feature:tree", placeId: "place:forest", name: "木（合成fixture）", source },
      { id: "feature:water", placeId: "place:pond", name: "水辺（合成fixture）", source },
    ],
    seasonalStates: [
      { placeId: "place:forest", season: input.season, state: input.forestState, source },
      { placeId: "place:pond", season: input.season, state: "present", source },
    ],
    scanPoints: [
      {
        id: "place:forest:main",
        placeId: "place:forest",
        routeKey: "main",
        source,
        status: "ACTIVE",
      },
      {
        id: "place:pond:main",
        placeId: "place:pond",
        routeKey: "main",
        source,
        status: "ACTIVE",
      },
    ],
  };
}

const scanBinding = (revision: string): ScanPointBinding => ({
  scanPointId: "sp-renri-pilot-forest",
  publicRoute: "/scan/sp-renri-pilot-forest",
  targetKind: "place",
  targetId: "place:forest",
  visibility: "public",
  lifecycle: "active",
  contentRevision: revision,
});

const RYUYO_PILOT_PLACES = ["iwata:tourism:5", "iwata:tourism:6"] as const;

function ryuyoPilotFixture(input: {
  asOf: string;
  version: string;
  season: Season;
  marineParkState: SeasonalState;
}): AreaPlacePublicContractsInput {
  const source = publicSource({
    version: input.version,
    observedAt: input.asOf,
    effectiveFrom: input.season === "summer" ? "2026-06-01T00:00:00.000Z" : "2026-09-01T00:00:00.000Z",
    effectiveUntil: input.season === "summer" ? "2026-08-31T23:59:59.999Z" : "2026-11-30T23:59:59.999Z",
  });
  const places = RYUYO_PILOT_PLACES.map((id) => {
    const place = IWATA_OPEN_DATA_ITEMS.find((item) => item.id === id);
    assert.ok(place, `adopted Iwata source item ${id} must remain available`);
    return {
      id: place.id,
      areaId: "area:iwata:ryuyo",
      name: place.name,
      source: { ...source, sourceId: place.sourceUrl },
      sensitiveLocation: false,
    };
  });
  return {
    fixtureClass: "synthetic",
    asOf: input.asOf,
    area: {
      id: "area:iwata:ryuyo",
      name: "磐田市竜洋エリア（検証fixture）",
      source,
      publicProjection: "AUTHORIZED",
    },
    places,
    naturalFeatures: [],
    seasonalStates: places.map((place) => ({
      placeId: place.id,
      season: input.season,
      state: place.id === "iwata:tourism:5" ? input.marineParkState : "present",
      source,
    })),
    scanPoints: places.map((place) => ({
      id: `${place.id}:main`,
      placeId: place.id,
      routeKey: "main",
      source,
      status: "ACTIVE",
    })),
  };
}

test("synthetic multi-place pilot keeps place identity stable while seasonal content changes", () => {
  const summer = compileAreaPlacePublicContracts(areaFixture({
    asOf: "2026-08-15T12:00:00.000Z",
    version: "public-v1",
    observedAt: "2026-08-01T00:00:00.000Z",
    effectiveFrom: "2026-06-01T00:00:00.000Z",
    effectiveUntil: "2026-08-31T23:59:59.999Z",
    season: "summer",
    forestState: "present",
  }));
  const autumn = compileAreaPlacePublicContracts(areaFixture({
    asOf: "2026-09-15T12:00:00.000Z",
    version: "public-v2",
    observedAt: "2026-09-01T00:00:00.000Z",
    effectiveFrom: "2026-09-01T00:00:00.000Z",
    effectiveUntil: "2026-11-30T23:59:59.999Z",
    season: "autumn",
    forestState: "absent",
  }));

  assert.equal(summer.decision, "ALLOW");
  assert.equal(autumn.decision, "ALLOW");
  assert.equal(summer.contracts?.places.length, 2);
  assert.deepEqual(
    summer.contracts?.places.map(({ id }) => id),
    autumn.contracts?.places.map(({ id }) => id),
  );
  assert.deepEqual(
    summer.contracts?.scanPoints.map(({ id }) => id),
    autumn.contracts?.scanPoints.map(({ id }) => id),
  );
  assert.equal(summer.contracts?.seasonalStates.find(({ placeId }) => placeId === "place:forest")?.state, "present");
  assert.equal(autumn.contracts?.seasonalStates.find(({ placeId }) => placeId === "place:forest")?.state, "absent");
  assert.deepEqual(autumn.effects, {
    databaseReads: 0,
    databaseWrites: 0,
    networkCalls: 0,
    publicationEffects: 0,
    runtimeMutations: 0,
  });
});

test("stable ScanPoint and source-bound language derivatives survive content revision without widening publication", () => {
  const before = resolveScanPointRoute({
    scanPointId: "sp-renri-pilot-forest",
    bindings: [scanBinding("public-v1")],
  });
  const after = resolveScanPointRoute({
    scanPointId: "sp-renri-pilot-forest",
    bindings: [scanBinding("public-v2")],
  });
  assert.equal(before.status, "resolved");
  assert.equal(after.status, "resolved");
  if (before.status === "resolved" && after.status === "resolved") {
    assert.equal(before.publicRoute, after.publicRoute);
    assert.equal(before.targetId, after.targetId);
    assert.notEqual(before.contentRevision, after.contentRevision);
  }

  const source = {
    sourceId: "place:forest",
    sourceVersion: "public-v2",
    visibility: "PUBLIC" as const,
    approved: true,
  };
  const easyJapanese = assessDerivedGuideFreshness({
    source,
    derivative: {
      sourceId: "place:forest",
      sourceVersion: "public-v2",
      language: "ja",
      format: "EASY_JAPANESE",
      visibility: "PUBLIC",
    },
  });
  const english = assessDerivedGuideFreshness({
    source,
    derivative: {
      sourceId: "place:forest",
      sourceVersion: "public-v2",
      language: "en",
      format: "TEXT",
      visibility: "PUBLIC",
    },
  });
  const staleEnglish = assessDerivedGuideFreshness({
    source,
    derivative: {
      sourceId: "place:forest",
      sourceVersion: "public-v1",
      language: "en",
      format: "TEXT",
      visibility: "PUBLIC",
    },
  });
  assert.equal(easyJapanese.status, "CURRENT");
  assert.equal(english.status, "CURRENT");
  assert.equal(staleEnglish.status, "STALE");
  assert.equal(easyJapanese.publication, "NOT_DECIDED");
});

test("pilot links nearby and route Places through existing Place Atlas relations without coordinates", () => {
  const v1 = buildPlaceAtlasProfile({
    placeRef: { kind: "field", fieldId: "synthetic-field-forest" },
    place: {
      name: "森の場所（合成fixture）",
      type: "park",
      multilingualNames: { ja: "森の場所（合成fixture）", en: "Synthetic Forest Place" },
    },
    records: [],
    recordSetComplete: true,
    locationMode: "field",
    sources: ["synthetic-pilot"],
  });
  const atlas = buildPlaceAtlasProfileV2(v1, {
    canonicalPlaceId: "place:forest",
    canonicalPlaceIds: ["place:pond"],
    relationships: [
      {
        relationshipType: "next_to",
        placeId: "place:pond",
        name: "水辺の場所（合成fixture）",
        placeKind: "park",
        verificationStatus: "source_verified",
      },
      {
        relationshipType: "route_to",
        placeId: "place:pond",
        name: "水辺の場所（合成fixture）",
        placeKind: "park",
        verificationStatus: "source_verified",
      },
    ],
    currentSeason: {
      season: "autumn",
      effectiveFrom: "2026-09-01T00:00:00.000Z",
      effectiveTo: "2026-12-01T00:00:00.000Z",
      sourceStatus: "fresh",
      publicationStatus: "public",
      items: [{
        recordId: "record:synthetic-autumn",
        observedAt: "2026-09-15T00:00:00.000Z",
        displayLabel: "秋の記録",
        publicMediaUrl: null,
        href: "/ja/records/synthetic-autumn",
        verificationState: "candidate",
      }],
    },
  });

  assert.deepEqual(
    atlas.hierarchy.relationships.map(({ relationshipType, placeId }) => [relationshipType, placeId]),
    [["next_to", "place:pond"], ["route_to", "place:pond"]],
  );
  assert.equal(atlas.currentSeason?.state, "current");
  assert.doesNotMatch(JSON.stringify(atlas), /exact_lat|exact_lng|latitude|longitude/iu);
});

test("pilot fails closed for private, sensitive, stale-child-shaped or unapproved derived material", () => {
  const current = areaFixture({
    asOf: "2026-09-15T12:00:00.000Z",
    version: "public-v2",
    observedAt: "2026-09-01T00:00:00.000Z",
    effectiveFrom: "2026-09-01T00:00:00.000Z",
    effectiveUntil: "2026-11-30T23:59:59.999Z",
    season: "autumn",
    forestState: "present",
  });
  assert.equal(compileAreaPlacePublicContracts({
    ...current,
    places: [{ ...current.places[0]!, source: { ...current.places[0]!.source, rights: "PRIVATE" } }, current.places[1]!],
  }).reasonCode, "SOURCE_NOT_PUBLIC");
  assert.equal(compileAreaPlacePublicContracts({
    ...current,
    places: [{ ...current.places[0]!, sensitiveLocation: true }, current.places[1]!],
  }).reasonCode, "SENSITIVE_LOCATION_EXCLUDED");

  const childShaped = {
    ...current,
    places: [{ ...current.places[0]!, childName: "synthetic-child-data-must-not-pass" }, current.places[1]!],
  };
  assert.equal(compileAreaPlacePublicContracts(childShaped).reasonCode, "INVALID_INPUT");

  assert.equal(assessDerivedGuideFreshness({
    source: { sourceId: "place:forest", sourceVersion: "public-v2", visibility: "PUBLIC", approved: false },
    derivative: { sourceId: "place:forest", sourceVersion: "public-v2", language: "en", format: "TEXT", visibility: "PUBLIC" },
  }).status, "REJECTED");

  const base = buildPlaceAtlasProfile({
    placeRef: { kind: "field", fieldId: "synthetic-field-forest" },
    place: { name: "森の場所（合成fixture）", type: "park" },
    records: [],
    recordSetComplete: true,
    locationMode: "field",
    sources: ["synthetic-pilot"],
  });
  const sensitiveAtlas = buildPlaceAtlasProfileV2(base, {
    policy: defaultPlacePolicy({ placeKind: "park", sensitiveLocation: true }),
    currentSeason: {
      season: "autumn",
      effectiveFrom: "2026-09-01T00:00:00.000Z",
      effectiveTo: "2026-12-01T00:00:00.000Z",
      sourceStatus: "fresh",
      publicationStatus: "public",
      items: [{
        recordId: "record:synthetic-autumn",
        observedAt: "2026-09-15T00:00:00.000Z",
        displayLabel: null,
        publicMediaUrl: null,
        href: null,
        verificationState: "verified",
      }],
    },
  });
  assert.equal(sensitiveAtlas.currentSeason?.state, "suppressed");
  assert.deepEqual(sensitiveAtlas.currentSeason?.items, []);
});

test("exact Ryuyo pilot carries two real Places through seasonal revisions and multilingual scan pages", () => {
  const summer = compileAreaPlacePublicContracts(ryuyoPilotFixture({
    asOf: "2026-08-15T12:00:00.000Z",
    version: "ryuyo-summer-v1",
    season: "summer",
    marineParkState: "present",
  }));
  const autumn = compileAreaPlacePublicContracts(ryuyoPilotFixture({
    asOf: "2026-09-15T12:00:00.000Z",
    version: "ryuyo-autumn-v2",
    season: "autumn",
    marineParkState: "absent",
  }));

  assert.equal(summer.decision, "ALLOW");
  assert.equal(autumn.decision, "ALLOW");
  assert.deepEqual(
    autumn.contracts?.places.map(({ id, name }) => [id, name]),
    [
      ["iwata:tourism:5", "竜洋海洋公園"],
      ["iwata:tourism:6", "竜洋昆虫自然観察公園"],
    ],
  );
  assert.deepEqual(
    summer.contracts?.places.map(({ id }) => id),
    autumn.contracts?.places.map(({ id }) => id),
  );
  assert.deepEqual(
    summer.contracts?.scanPoints.map(({ id }) => id),
    autumn.contracts?.scanPoints.map(({ id }) => id),
  );
  assert.equal(
    summer.contracts?.seasonalStates.find(({ placeId }) => placeId === "iwata:tourism:5")?.state,
    "present",
  );
  assert.equal(
    autumn.contracts?.seasonalStates.find(({ placeId }) => placeId === "iwata:tourism:5")?.state,
    "absent",
  );

  for (const place of autumn.contracts?.places ?? []) {
    const scanPointId = `${place.id}:main`;
    const route = resolveScanPointRoute({
      scanPointId,
      bindings: [{
        scanPointId,
        publicRoute: `/scan/${encodeURIComponent(scanPointId)}`,
        targetKind: "place",
        targetId: place.id,
        visibility: "public",
        lifecycle: "active",
        contentRevision: "ryuyo-autumn-v2",
      }],
    });
    assert.equal(route.status, "resolved");
    if (route.status !== "resolved") continue;

    const pages = [
      { language: "ja", format: "EASY_JAPANESE" as const },
      { language: "en", format: "TEXT" as const },
    ].map((page) => ({
      route: route.publicRoute,
      targetId: route.targetId,
      freshness: assessDerivedGuideFreshness({
        source: {
          sourceId: place.id,
          sourceVersion: route.contentRevision,
          visibility: "PUBLIC",
          approved: true,
        },
        derivative: {
          sourceId: place.id,
          sourceVersion: route.contentRevision,
          language: page.language,
          format: page.format,
          visibility: "PUBLIC",
        },
      }),
    }));

    assert.deepEqual(pages.map(({ route: pageRoute }) => pageRoute), [route.publicRoute, route.publicRoute]);
    assert.deepEqual(pages.map(({ targetId }) => targetId), [place.id, place.id]);
    assert.deepEqual(pages.map(({ freshness }) => freshness.status), ["CURRENT", "CURRENT"]);
    assert.deepEqual(pages.map(({ freshness }) => freshness.derivative?.language), ["ja", "en"]);
    assert.ok(pages.every(({ freshness }) => freshness.publication === "NOT_DECIDED"));
  }
});
