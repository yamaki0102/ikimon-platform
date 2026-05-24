import test from "node:test";
import assert from "node:assert/strict";
import { renderFieldDetailBody } from "./observationFieldDetail.js";
import type { ObservationField, FieldStats } from "../services/observationFieldRegistry.js";
import type { AreaPlaceSnapshot } from "../services/areaPlaceSnapshot.js";

function field(): ObservationField {
  return {
    fieldId: "5133aea8-7b1d-49b2-950e-b3c9ac74bc79",
    source: "user_defined",
    adminLevel: "osm_park",
    name: "牧志公園",
    nameKana: "",
    summary: "",
    prefecture: "沖縄県",
    city: "那覇市",
    lat: 26.2179484,
    lng: 127.6918878,
    radiusM: 50,
    polygon: null,
    areaHa: null,
    certificationId: "",
    certifiedAt: null,
    officialUrl: "",
    ownerUrl: "",
    storyUrl: "",
    certificationUrl: "",
    sourceConfidence: 0.45,
    verificationLevel: "unverified",
    verificationMethod: "",
    verificationLabel: "",
    verificationUpdatedAt: null,
    ownerUserId: null,
    entityKey: "",
    validFrom: null,
    validTo: null,
    supersededBy: null,
    payload: {},
    createdAt: "2026-05-01",
    updatedAt: "2026-05-01",
  };
}

function sourcedField(): ObservationField {
  return {
    ...field(),
    source: "nature_symbiosis_site",
    ownerUrl: "https://example.com/owner",
    certificationUrl: "https://example.com/cert",
    storyUrl: "https://ikimon.life/stories/field",
    verificationLabel: "認定情報と一致",
  };
}

function stats(): FieldStats {
  return {
    fieldId: "5133aea8-7b1d-49b2-950e-b3c9ac74bc79",
    totalSessions: 0,
    liveSessions: 0,
    totalObservations: 0,
    uniqueSpeciesCount: 0,
    totalAbsences: 0,
    totalParticipants: 0,
    topTaxa: [],
    recentSessions: [],
  };
}

function snapshot(): AreaPlaceSnapshot {
  return {
    field: { fieldId: "5133aea8-7b1d-49b2-950e-b3c9ac74bc79" },
    observationSummary: {
      totalObservations: 50,
      totalVisits: 19,
      totalEvents: 0,
      liveEvents: 0,
      uniqueTaxa: 43,
      latestObservedAt: "2026-05-08T10:30:00.000Z",
      taxonRankCount: 4,
      seasonsCovered: 1,
      seasonCoverageCap: 4,
      seasonLabels: ["春"],
      effortCompletionRate: 0,
      reviewAcceptedRate: 1,
      nativeCount: 0,
      exoticCount: 0,
      unknownOriginCount: 50,
      absentRecords: 0,
      stewardshipActionCount: 0,
      topTaxa: [],
    },
    relationshipScore: { score: { totalScore: 20 } },
    observationGallery: [],
    seasonalCoverage: [],
  } as unknown as AreaPlaceSnapshot;
}

function snapshotWithAlbumRecord(): AreaPlaceSnapshot {
  const base = snapshot();
  return {
    ...base,
    observationGallery: [
      {
        occurrenceId: "occ:record-1778828354813:1",
        visitId: "record-1778828354813",
        displayName: "ツルニチニチソウ ほか1件",
        observedAt: "2026-05-20T10:30:00.000Z",
        photoUrl: "/uploads/photos/sample.jpg",
        localityLabel: "静岡市 / 静岡県",
        observationCount: 2,
        recentObservationCount: 2,
        likeCount: 0,
        season: "spring",
        seasonLabel: "春",
        isCurrentSeason: true,
        visibility: "public",
        privacyLabel: null,
        privacyReason: null,
        shareAllowed: true,
      },
    ],
  } as unknown as AreaPlaceSnapshot;
}

test("field detail metrics use place snapshot observations when event stats are empty", () => {
  const html = renderFieldDetailBody({ field: field(), stats: stats(), snapshot: snapshot() });

  assert.match(html, /<strong>19<\/strong><span>記録回数<\/span>/);
  assert.match(html, /<strong>43<\/strong><span>累計種数<\/span>/);
  assert.match(html, /<strong>50<\/strong><span>累計記録<\/span>/);
  assert.match(html, /<span>最終記録<\/span><strong>2026年5月8日<\/strong>/);
  assert.doesNotMatch(html, /観察レコード|観察記録はまだありません|累計観察|最終観察/);
  assert.doesNotMatch(html, /<strong>0<\/strong><span>開催回数<\/span>/);
});

test("field detail starts with the map hero before numeric record metrics", () => {
  const html = renderFieldDetailBody({ field: field(), stats: stats(), snapshot: snapshot() });

  const mapHeroIndex = html.indexOf('<article class="field-map-hero">');
  const mapCanvasIndex = html.indexOf("data-evt-field-map");
  const metricsIndex = html.indexOf('<section class="field-detail-metrics"');
  const numericIndex = html.indexOf("<span>記録回数</span>");

  assert.ok(mapHeroIndex >= 0);
  assert.ok(mapCanvasIndex > mapHeroIndex);
  assert.ok(metricsIndex > mapHeroIndex);
  assert.ok(numericIndex > metricsIndex);
});

test("field detail keeps the hero to two primary actions and moves trust links lower", () => {
  const html = renderFieldDetailBody({ field: sourcedField(), stats: stats(), snapshot: snapshot() });

  const heroStart = html.indexOf('<article class="field-map-hero">');
  const heroEnd = html.indexOf("</article>", heroStart);
  const metricsIndex = html.indexOf('<section class="field-detail-metrics"');
  const trustIndex = html.indexOf('<section class="field-trust-info"');
  const heroHtml = html.slice(heroStart, heroEnd);
  const heroButtonCount = (heroHtml.match(/class="evt-btn/g) ?? []).length;

  assert.equal(heroButtonCount, 2);
  assert.doesNotMatch(heroHtml, /公式 ↗|認定情報 ↗|事例 ↗|認定情報と一致/);
  assert.ok(trustIndex > metricsIndex);
  assert.match(html.slice(trustIndex), /公式 ↗/);
  assert.match(html.slice(trustIndex), /認定情報 ↗/);
  assert.match(html.slice(trustIndex), /事例 ↗/);
  assert.match(html.slice(trustIndex), /認定情報と一致/);
});

test("field album links cards to the record instead of the subject occurrence", () => {
  const html = renderFieldDetailBody({ field: field(), stats: stats(), snapshot: snapshotWithAlbumRecord() });

  assert.match(html, /href="\/observations\/record-1778828354813"/);
  assert.doesNotMatch(html, /href="\/observations\/occ%3Arecord-1778828354813%3A1"/);
  assert.match(html, /ツルニチニチソウ ほか1件/);
});
