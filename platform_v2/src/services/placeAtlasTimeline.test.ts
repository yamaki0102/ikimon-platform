import assert from "node:assert/strict";
import test from "node:test";
import type { PlaceAtlasProfile } from "./placeAtlasContract.js";
import { buildPlaceAtlasTimelineProjection } from "./placeAtlasTimeline.js";

function fixture(overrides: Partial<PlaceAtlasProfile> = {}): PlaceAtlasProfile {
  return {
    version: 1,
    placeRef: { kind: "field", fieldId: "tokiwa-field" },
    place: {
      name: "常磐公園",
      type: "park",
      localityLabel: "静岡県 静岡市",
      description: null,
      representativeMedia: [],
    },
    summary: {
      recordCount: 3,
      contributorCount: null,
      firstRecordedAt: "2024-03-05T00:00:00.000Z",
      latestRecordedAt: "2026-07-01T01:00:00.000Z",
    },
    facets: [],
    highlights: [],
    recentRecords: [
      {
        recordId: "record-new",
        observedAt: "2026-07-01T10:00:00+09:00",
        displayName: "現在の記録",
        href: "/ja/observations/record-new",
        mediaUrl: "/derived/new/display.webp",
        mediaKind: "photo",
        taxonGroup: null,
        themes: [],
        identificationStatus: "confirmed",
      },
      {
        recordId: "record-old",
        observedAt: "2024-03-05",
        displayName: "以前の記録",
        href: "/ja/observations/record-old",
        mediaUrl: "/derived/old/display.webp",
        mediaKind: "photo",
        taxonGroup: null,
        themes: [],
        identificationStatus: "ai_candidate",
      },
    ],
    guide: null,
    memories: [],
    facilities: [],
    activities: [],
    stories: [],
    dataGaps: [],
    publication: {
      status: "partial",
      suppressedSections: [],
      locationMode: "field",
    },
    provenance: {
      generatedAt: "2026-07-26T00:00:00.000Z",
      profileVersion: "place_atlas_profile/v1",
      sources: ["public_map_snapshot"],
    },
    ...overrides,
  };
}

test("projects public recent Records into a chronological Place timeline", () => {
  const projection = buildPlaceAtlasTimelineProjection(fixture());
  assert.equal(projection.state, "timeline");
  assert.equal(projection.changeAssessment, "not_assessed");
  assert.deepEqual(projection.periods.map((period) => period.periodKey), ["2024-03-05", "2026-07-01"]);
  assert.equal(projection.periods[0]?.items[0]?.verificationState, "candidate");
  assert.equal(projection.periods[1]?.items[0]?.verificationState, "verified");
  assert.equal(projection.periods[1]?.items[0]?.sourceKind, "public_record");
});

test("one observation period never becomes a change claim", () => {
  const profile = fixture({ recentRecords: [fixture().recentRecords[0]!] });
  const projection = buildPlaceAtlasTimelineProjection(profile);
  assert.equal(projection.state, "single_period");
  assert.equal(projection.summaryKey, "one_observation_period");
  assert.equal(projection.changeAssessment, "not_assessed");
});

test("suppressed profiles do not expose hidden counts, Records, or recording suggestions", () => {
  const projection = buildPlaceAtlasTimelineProjection(fixture({
    publication: {
      status: "suppressed",
      suppressedSections: ["recent_records"],
      locationMode: "field",
    },
  }));
  assert.equal(projection.state, "suppressed");
  assert.equal(projection.totalRecordCount, null);
  assert.equal(projection.recordCount, 0);
  assert.deepEqual(projection.periods, []);
  assert.equal(projection.recordingSuggestion, "none");
});

test("partial profiles may expose the already-public recent Record projection", () => {
  const projection = buildPlaceAtlasTimelineProjection(fixture({
    publication: {
      status: "partial",
      suppressedSections: ["contributors"],
      locationMode: "field",
    },
  }));
  assert.equal(projection.state, "timeline");
  assert.equal(projection.publicationStatus, "partial");
});

test("unsafe href and media values fail closed even in manually constructed profiles", () => {
  const profile = fixture({
    recentRecords: [{
      ...fixture().recentRecords[0]!,
      href: "https://evil.test/record",
      mediaUrl: "https://ikimon.life/api/v1/auth/session",
    }],
  });
  const projection = buildPlaceAtlasTimelineProjection(profile);
  assert.equal(projection.periods[0]?.items[0]?.href, null);
  assert.equal(projection.periods[0]?.items[0]?.publicMediaUrl, null);
});

test("reports when the timeline is a bounded sample of the public Record total", () => {
  const projection = buildPlaceAtlasTimelineProjection(fixture({
    summary: {
      ...fixture().summary,
      recordCount: 20,
    },
  }));
  assert.equal(projection.recordCount, 2);
  assert.equal(projection.totalRecordCount, 20);
  assert.equal(projection.sampled, true);
});

test("invalid and future observations remain excluded by the canonical timeline contract", () => {
  const profile = fixture({
    recentRecords: [
      { ...fixture().recentRecords[0]!, recordId: "invalid", observedAt: "2026-02-30" },
      { ...fixture().recentRecords[1]!, recordId: "future", observedAt: "2027-01-01T00:00:00Z" },
    ],
  });
  const projection = buildPlaceAtlasTimelineProjection(profile, {
    now: new Date("2026-07-26T00:00:00.000Z"),
  });
  assert.equal(projection.state, "empty");
  assert.equal(projection.excluded.invalidObservedAt, 1);
  assert.equal(projection.excluded.futureObservedAt, 1);
});

test("extra exact coordinates and identities are never projected", () => {
  const profile = {
    ...fixture(),
    exactLat: 34.7,
    exactLng: 137.8,
    ownerId: "owner-secret",
    recentRecords: [{
      ...fixture().recentRecords[0]!,
      contributorKey: "user-secret",
    }],
  } as unknown as PlaceAtlasProfile;
  const serialized = JSON.stringify(buildPlaceAtlasTimelineProjection(profile));
  assert.doesNotMatch(serialized, /exactLat|exactLng|ownerId|contributorKey|owner-secret|user-secret/u);
});

test("stale and recent projections preserve the domain revisit suggestion", () => {
  const stale = buildPlaceAtlasTimelineProjection(fixture({
    recentRecords: [{ ...fixture().recentRecords[0]!, observedAt: "2025-01-01T00:00:00Z" }],
  }), { now: new Date("2026-07-26T00:00:00.000Z"), recentWindowDays: 180 });
  const recent = buildPlaceAtlasTimelineProjection(fixture({
    recentRecords: [{ ...fixture().recentRecords[0]!, observedAt: "2026-07-01T00:00:00Z" }],
  }), { now: new Date("2026-07-26T00:00:00.000Z"), recentWindowDays: 180 });
  assert.equal(stale.recordingSuggestion, "revisit");
  assert.equal(recent.recordingSuggestion, "none");
});
