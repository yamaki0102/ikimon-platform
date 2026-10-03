import assert from "node:assert/strict";
import test from "node:test";
import type { PlaceAtlasProfile } from "../../src/services/placeAtlasContract";
import type { SavedItem } from "./savedItems";
import { renderGlobalPlaceDetailPage } from "./placeDetailPage";

function fixture(): PlaceAtlasProfile {
  return {
    version: 1,
    placeRef: { kind: "osm_area", entityKey: "osm:way:125727939", osmType: "way", osmId: 125727939 },
    place: {
      name: "常磐公園",
      type: "park",
      localityLabel: "静岡県 静岡市",
      description: "まちなかの公園です。",
      representativeMedia: [],
      canonicalPlaceId: "plc_e3293ec4bb9288a0",
      aliases: ["Tokiwa Park"],
      multilingualNames: { ja: "常磐公園", en: "Tokiwa Park" },
      verificationStatus: "verified",
      officialStatus: "official",
    },
    summary: { recordCount: 1, contributorCount: null, firstRecordedAt: "2026-01-01T00:00:00Z", latestRecordedAt: "2026-09-01T00:00:00Z" },
    facets: [],
    highlights: [],
    recentRecords: [],
    guide: null,
    memories: [],
    facilities: [],
    policy: { placeVisibility: "public", recordingPolicy: "check_rules", publicLocationMode: "place", contributionCtaMode: "check_rules", ruleSource: "official", ruleUrl: null, reason: "recording_rules_unverified" },
    dataGaps: [],
    publication: { status: "partial", suppressedSections: [], locationMode: "osm_area" },
    provenance: {
      generatedAt: "2026-10-03T00:00:00Z",
      profileVersion: "place_atlas_profile/v1",
      sources: ["place_registry"],
      sourceReferences: [
        { sourceType: "osm", sourceId: "way:125727939", sourceUrl: "https://www.openstreetmap.org/way/125727939", confidence: 0.9, verificationStatus: "source_verified", lastCheckedAt: "2026-10-02T00:00:00Z" },
      ],
    },
  };
}

test("global Place detail keeps local script visible while rendering selected-language identity", () => {
  const html = renderGlobalPlaceDetailPage({ profile: fixture(), lang: "en", viewerAuthenticated: false });
  assert.match(html, /<h1 id="gpd-title">Tokiwa Park<\/h1>/);
  assert.match(html, /lang="und">常磐公園/);
  assert.match(html, /Show locally/);
  assert.match(html, /Local name:<\/strong> <span[^>]*>常磐公園/);
  assert.match(html, /Open external map/);
  assert.match(html, /query=%E5%B8%B8%E7%A3%90%E5%85%AC%E5%9C%92%20%E9%9D%99%E5%B2%A1%E7%9C%8C%20%E9%9D%99%E5%B2%A1%E5%B8%82/);
  assert.match(html, /Latest source check/);
  assert.doesNotMatch(html, /exactLat|exactLng|exact_lat|exact_lng/);
});

test("authenticated Place detail binds the existing Saved control to the stable canonical path", () => {
  const saved: SavedItem = {
    kind: "place", objectId: "plc_e3293ec4bb9288a0", path: "/places/plc_e3293ec4bb9288a0", title: "常磐公園",
    state: "saved", revision: 3, savedAt: "2026-10-03T00:00:00Z", updatedAt: "2026-10-03T00:00:00Z",
  };
  const html = renderGlobalPlaceDetailPage({ profile: fixture(), lang: "ja", savedItem: saved, viewerAuthenticated: true });
  assert.match(html, /data-zukan-save/);
  assert.match(html, /data-saved-revision="3"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /\/places\/plc_e3293ec4bb9288a0/);
  assert.match(html, /保存済み/);
  assert.match(html, /\/api\/v1\/me\/saved/);
});

test("guest Place detail never claims a private Save succeeded", () => {
  const html = renderGlobalPlaceDetailPage({ profile: fixture(), lang: "ja", viewerAuthenticated: false });
  assert.match(html, /ログインして保存/);
  assert.doesNotMatch(html, /data-zukan-save/);
  assert.doesNotMatch(html, /ZUKANに保存しました/);
});

test("detail rendering rejects a Place without a stable canonical identity", () => {
  const invalid = fixture();
  (invalid.place as PlaceAtlasProfile["place"] & { canonicalPlaceId?: string }).canonicalPlaceId = "";
  assert.throws(() => renderGlobalPlaceDetailPage({ profile: invalid, lang: "ja" }), /canonical_place_id_required/);
});
