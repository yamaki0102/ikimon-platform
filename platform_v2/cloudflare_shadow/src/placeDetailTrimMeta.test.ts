import assert from "node:assert/strict";
import test from "node:test";
import { renderGlobalPlaceDetailPage } from "./placeDetailPage";
import { renderMapPlaceAtlasProfile } from "../../src/ui/mapPlaceAtlasProfile";

function fixture(): any {
  return {
    version: 1,
    placeRef: { kind: "osm_area", entityKey: "osm:way:1", osmType: "way", osmId: 1 },
    place: { name: "西伊場第1公園", type: "park", localityLabel: "静岡県 浜松市", description: "", representativeMedia: [], canonicalPlaceId: "plc_0123456789abcdef", aliases: [], multilingualNames: { ja: "西伊場第1公園", en: "Nishiiba Park" }, verificationStatus: "source_verified", officialStatus: "official" },
    summary: { recordCount: 0, contributorCount: null, firstRecordedAt: null, latestRecordedAt: null },
    facets: [], highlights: [], recentRecords: [], guide: null, memories: [], facilities: [],
    policy: { placeVisibility: "public", recordingPolicy: "check_rules", publicLocationMode: "place", contributionCtaMode: "check_rules", ruleSource: "official", ruleUrl: null, reason: "recording_rules_unverified" },
    dataGaps: [
      { key: "contributors", label: "記録した人の広がり", reason: "個人を特定せず安全に集計できる条件がそろっていないため表示していません。" },
      { key: "public_threshold", label: "公開記録", reason: "公開閾値を満たすまで詳細を控えています。" },
    ],
    publication: { status: "partial", suppressedSections: [], locationMode: "osm_area" },
    provenance: { generatedAt: "2026-10-03T00:00:00Z", profileVersion: "place_atlas_profile/v1", sources: ["place_registry"], sourceReferences: [{ sourceType: "osm", sourceId: "way:1", sourceUrl: "https://www.openstreetmap.org/way/1", confidence: 0.9, verificationStatus: "source_verified", lastCheckedAt: "2026-10-02T00:00:00Z" }] },
  };
}

test("ja place detail drops system boxes", () => {
  const html = renderGlobalPlaceDetailPage({ profile: fixture(), lang: "ja", viewerAuthenticated: false });
  assert.doesNotMatch(html, /現地で見せる/);
  assert.doesNotMatch(html, /出典:/);
  assert.doesNotMatch(html, /公開閾値/);
  assert.doesNotMatch(html, /個人を特定せず/);
  assert.doesNotMatch(html, /営業時間・料金/);
  assert.match(html, /情報の最終確認：2026\/10\/02/);
});

test("en place detail keeps Show locally and uses the one-line check date", () => {
  const html = renderGlobalPlaceDetailPage({ profile: fixture(), lang: "en", viewerAuthenticated: false });
  assert.match(html, /Show locally/);
  assert.match(html, /Last checked: 2026\/10\/02/);
  assert.doesNotMatch(html, /Page assembled/);
});

test("atlas gaps render only the access guidance", () => {
  const p = fixture();
  const none = renderMapPlaceAtlasProfile(p as never, {} as never);
  assert.doesNotMatch(none, /これから記録できること/);
  p.dataGaps.push({ key: "access", label: "アクセス", reason: "現地のルールを優先してください。" });
  const some = renderMapPlaceAtlasProfile(p as never, {} as never);
  assert.match(some, /これから記録できること/);
  assert.doesNotMatch(some, /公開閾値/);
});
