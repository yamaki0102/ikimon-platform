import assert from "node:assert/strict";
import test from "node:test";
import type { PlaceAtlasProfile } from "../../src/services/placeAtlasContract";
import { buildPlaceAtlasProfile, type PlaceAtlasSourceRecord } from "../../src/services/placeAtlasContract";
import type { SavedItem } from "./savedItems";
import { isPublicGlobalPlaceDetailProfile, renderGlobalPlaceDetailPage } from "./placeDetailPage";

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
      verificationStatus: "source_verified",
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
  for (const lang of ["ja", "en", "es", "pt-br"] as const) {
    const html = renderGlobalPlaceDetailPage({ profile: fixture(), lang, viewerAuthenticated: false });
    const localizedPlacePath = `/${lang}/places/plc_e3293ec4bb9288a0`;
    assert.ok(html.includes(`href="/${lang}/login?redirect=${encodeURIComponent(localizedPlacePath)}"`));
    assert.doesNotMatch(html, /href="\/auth\?redirect=/);
    assert.doesNotMatch(html, /<button\b[^>]*data-zukan-save/);
    assert.doesNotMatch(html, /ZUKANに保存しました/);
  }
  assert.match(renderGlobalPlaceDetailPage({ profile: fixture(), lang: "ja", viewerAuthenticated: false }), /ログインして保存/);
});

test("detail rendering rejects a Place without a stable canonical identity", () => {
  const invalid = fixture();
  (invalid.place as PlaceAtlasProfile["place"] & { canonicalPlaceId?: string }).canonicalPlaceId = "";
  assert.throws(() => renderGlobalPlaceDetailPage({ profile: invalid, lang: "ja" }), /canonical_place_id_required/);
});

test("public Place detail stays available for 0–3 Records while suppressed summaries remain empty", () => {
  const states = ["published", "suppressed", "suppressed", "published"] as const;
  for (let count = 0; count <= 3; count += 1) {
    const records: PlaceAtlasSourceRecord[] = Array.from({ length: count }, (_, index) => ({
      recordId: `record-${index + 1}`,
      observedAt: `2026-09-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      contributorKey: `contributor-${index + 1}`,
      displayName: `Record ${index + 1}`,
      identificationStatus: "confirmed",
    }));
    const profile = buildPlaceAtlasProfile({
      placeRef: { kind: "osm_area", entityKey: "osm:way:125727939", osmType: "way", osmId: 125727939 },
      place: {
        name: "常磐公園", type: "park", localityLabel: "静岡県 静岡市", description: "まちなかの公園です。",
        canonicalPlaceId: "plc_e3293ec4bb9288a0", multilingualNames: { ja: "常磐公園", en: "Tokiwa Park" },
      },
      records,
      recordSetComplete: true,
      locationMode: "osm_area",
      minimumPublicRecords: 3,
      contributorCountAllowed: false,
      policy: {
        placeVisibility: "public", recordingPolicy: "check_rules", publicLocationMode: "place",
        contributionCtaMode: "check_rules", ruleSource: "official", ruleUrl: null, reason: "recording_rules_unverified",
      },
      sources: ["canonical_place_registry"],
      generatedAt: "2026-09-15T00:00:00.000Z",
    });
    assert.equal(profile.publication.status, states[count]);
    assert.equal(isPublicGlobalPlaceDetailProfile(profile, "plc_e3293ec4bb9288a0"), true);
    const html = renderGlobalPlaceDetailPage({ profile, lang: "en", viewerAuthenticated: false });
    assert.match(html, /<h1 id="gpd-title">Tokiwa Park<\/h1>/);
    assert.match(html, new RegExp(`data-place-atlas-status="${states[count]}"`));
    if (count === 0) assert.match(html, /data-place-atlas-state="empty"/);
    if (count === 1 || count === 2) {
      assert.match(html, /data-place-atlas-state="suppressed"/);
      assert.equal(profile.summary.recordCount, null);
      assert.equal(profile.recentRecords.length, 0);
      assert.doesNotMatch(html, /Record 1|Record 2/);
      const savedHtml = renderGlobalPlaceDetailPage({
        profile,
        lang: "en",
        viewerAuthenticated: true,
        savedItem: {
          kind: "place", objectId: "plc_e3293ec4bb9288a0", path: "/places/plc_e3293ec4bb9288a0", title: "常磐公園",
          state: "saved", revision: 3, savedAt: "2026-09-15T00:00:00Z", updatedAt: "2026-09-15T00:00:00Z",
        },
      });
      assert.match(savedHtml, /data-saved-revision="3"/);
    }
    if (count === 3) assert.equal(profile.summary.recordCount, 3);
  }
});

test("global Place detail continues to reject non-public registered policies", () => {
  for (const placeVisibility of ["limited", "hidden"] as const) {
    const profile = fixture();
    profile.policy = { ...profile.policy!, placeVisibility };
    assert.equal(isPublicGlobalPlaceDetailProfile(profile, "plc_e3293ec4bb9288a0"), false);
  }
});


test("authenticated detail never turns a Saved read failure into a false unsaved state", () => {
  const html = renderGlobalPlaceDetailPage({
    profile: fixture(), lang: "en", viewerAuthenticated: true, savedStateAvailable: false,
  });
  assert.match(html, /Saved state unavailable/);
  assert.doesNotMatch(html, /<button\b[^>]*data-zukan-save/);
  assert.match(html, /aria-disabled="true"/);
});


test("location-suppressed Place keeps its name but withholds locality and external directions", () => {
  const profile = fixture();
  profile.policy = {
    ...profile.policy!,
    publicLocationMode: "hidden",
  };
  const html = renderGlobalPlaceDetailPage({ profile, lang: "en", viewerAuthenticated: false });
  assert.match(html, /Tokiwa Park/);
  assert.match(html, /常磐公園/);
  assert.doesNotMatch(html, /Open external map/);
  assert.doesNotMatch(html, /静岡県 静岡市/);
  assert.doesNotMatch(html, /google\.com\/maps\/search/);
});

test("coarse public location mode never upgrades itself to a precise map handoff", () => {
  const profile = fixture();
  profile.policy = {
    ...profile.policy!,
    publicLocationMode: "public_cell",
  };
  const html = renderGlobalPlaceDetailPage({ profile, lang: "ja", viewerAuthenticated: false });
  assert.doesNotMatch(html, /外部地図で開く/);
  assert.doesNotMatch(html, /静岡県 静岡市/);
  assert.match(html, /現地名/);
});
