// Demo fixtures for Relationship Score v0.1 sample report
// 全世界スケール想定: 5地域・業種を網羅。?demo=<key> で切替

import type { RelationshipScoreInputs } from "./relationshipScore.js";

export type DemoFixtureKey =
  | "urban_park"          // 都市公園、温帯
  | "factory_biotope"     // 製造業ビオトープ、温帯
  | "rice_field"          // 無農薬田、暖温帯
  | "northern_wetland"    // 北海道湿原、亜寒帯
  | "okinawa_coast";      // 沖縄沿岸、亜熱帯

export type DemoFixture = {
  key: DemoFixtureKey;
  industry: string;
  placeName: string;
  inputs: RelationshipScoreInputs;
};

export const DEMO_FIXTURES: Record<DemoFixtureKey, DemoFixture> = {
  urban_park: {
    key: "urban_park",
    industry: "municipality",
    placeName: "Sample Urban Park",
    inputs: {
      accessStatus: "public",
      safetyNotesPresent: true,
      visitsCount: 45,
      seasonsCovered: 4,
      repeatObserverCount: 12,
      notesCompletionRate: 0.55,
      identificationAttemptRate: 0.65,
      taxonRankDistinctCount: 7,
      reviewReplyCount: 6,
      stewardshipActionCount: 18,
      stewardshipActionLinkedRate: 0.66,
      acceptedReviewRate: 0.52,
      effortCompletionRate: 0.48,
      auditTrailPresent: true,
      centerLatitude: 35.69,
    },
  },
  factory_biotope: {
    key: "factory_biotope",
    industry: "manufacturing",
    placeName: "Sample Factory Biotope",
    inputs: {
      accessStatus: "limited",
      safetyNotesPresent: true,
      visitsCount: 14,
      seasonsCovered: 3,
      repeatObserverCount: 4,
      notesCompletionRate: 0.42,
      identificationAttemptRate: 0.5,
      taxonRankDistinctCount: 5,
      reviewReplyCount: 2,
      stewardshipActionCount: 9,
      stewardshipActionLinkedRate: 0.55,
      acceptedReviewRate: 0.45,
      effortCompletionRate: 0.4,
      auditTrailPresent: true,
      centerLatitude: 36.1,
    },
  },
  rice_field: {
    key: "rice_field",
    industry: "agriculture",
    placeName: "Sample Organic Rice Field",
    inputs: {
      accessStatus: "limited",
      safetyNotesPresent: false,
      visitsCount: 22,
      seasonsCovered: 3,
      repeatObserverCount: 5,
      notesCompletionRate: 0.6,
      identificationAttemptRate: 0.55,
      taxonRankDistinctCount: 6,
      reviewReplyCount: 1,
      stewardshipActionCount: 12,
      stewardshipActionLinkedRate: 0.5,
      acceptedReviewRate: 0.35,
      effortCompletionRate: 0.55,
      auditTrailPresent: false,
      centerLatitude: 33.5,
    },
  },
  northern_wetland: {
    key: "northern_wetland",
    industry: "npo",
    placeName: "Sample Northern Wetland",
    inputs: {
      accessStatus: "limited",
      safetyNotesPresent: true,
      visitsCount: 8,
      seasonsCovered: 2,
      repeatObserverCount: 3,
      notesCompletionRate: 0.7,
      identificationAttemptRate: 0.7,
      taxonRankDistinctCount: 6,
      reviewReplyCount: 2,
      stewardshipActionCount: 4,
      stewardshipActionLinkedRate: 0.5,
      acceptedReviewRate: 0.6,
      effortCompletionRate: 0.7,
      auditTrailPresent: true,
      centerLatitude: 67.5, // subarctic_n; 季節カバー上限 3
    },
  },
  okinawa_coast: {
    key: "okinawa_coast",
    industry: "tourism",
    placeName: "Sample Subtropical Coast",
    inputs: {
      accessStatus: "public",
      safetyNotesPresent: true,
      visitsCount: 18,
      seasonsCovered: 2,
      repeatObserverCount: 4,
      notesCompletionRate: 0.5,
      identificationAttemptRate: 0.5,
      taxonRankDistinctCount: 5,
      reviewReplyCount: 1,
      stewardshipActionCount: 7,
      stewardshipActionLinkedRate: 0.42,
      acceptedReviewRate: 0.3,
      effortCompletionRate: 0.35,
      auditTrailPresent: false,
      centerLatitude: 26.3, // subtropical_n; 季節カバー上限 3
    },
  },
};

export function isDemoFixtureKey(value: string | null | undefined): value is DemoFixtureKey {
  return !!value && Object.prototype.hasOwnProperty.call(DEMO_FIXTURES, value);
}

export function listDemoFixtureKeys(): DemoFixtureKey[] {
  return Object.keys(DEMO_FIXTURES) as DemoFixtureKey[];
}
