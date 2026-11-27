import assert from "node:assert/strict";
import test from "node:test";
import type { PlaceAtlasProfile } from "../../src/services/placeAtlasContract";
import { renderGlobalPlaceDetailPage } from "./placeDetailPage";

const profile = {
  version: 1,
  placeRef: { kind: "osm_area", entityKey: "osm:way:1", osmType: "way", osmId: 1 },
  place: { name: "東川の河川敷", type: "park", localityLabel: "浜松市東区", description: null, representativeMedia: [], canonicalPlaceId: "plc_cleanup" },
  summary: { recordCount: 0, contributorCount: null, firstRecordedAt: null, latestRecordedAt: null },
  facets: [], highlights: [], recentRecords: [], guide: null, memories: [], facilities: [], dataGaps: [],
  policy: { placeVisibility: "public", recordingPolicy: "check_rules", publicLocationMode: "place", contributionCtaMode: "check_rules", ruleSource: "official", ruleUrl: null, reason: "recording_rules_unverified" },
  publication: { status: "published", suppressedSections: [], locationMode: "osm_area" },
  provenance: { generatedAt: "2026-11-01T00:00:00Z", profileVersion: "place_atlas_profile/v1", sources: ["place_registry"], sourceReferences: [] },
} as unknown as PlaceAtlasProfile;

const shop = `<section class="spp-sec-setup" data-shop-photo-perks="setup"><details class="spp-setup"><summary>この場所を店として登録する（管理者のみ）</summary></details></section>`;
const base = { profile, lang: "ja" as const, now: new Date("2026-11-27T03:00:00Z"), regionLink: { href: "/ja/regions/x", label: "浜松市の地域ページ" }, shopPhotoPerkHtml: shop };

for (const mode of [{ v3: true }, { e2: true }, { v3: true, viewerAuthenticated: true }]) {
  test(`place cleanup ${JSON.stringify(mode)}`, () => {
    const html = renderGlobalPlaceDetailPage({ ...base, ...mode } as never);
    assert.equal((html.replace(/aria-label="場所について詳しく見る"/g, "").match(/場所について詳しく見る/g) ?? []).length, 1);
    assert.doesNotMatch(html, /<a[^>]*>場所について詳しく見る<\/a>/);
    assert.match(html, /<summary>場所について詳しく見る<\/summary>/);
    assert.doesNotMatch(html, /<div class="gpd-actions"><\/div>/);
    assert.match(html, /\.gpd a:visited\{color:#143F2E\}/);
    assert.ok(html.indexOf('class="spp-setup"') > html.indexOf("</details>"));
    assert.ok(html.indexOf('class="spp-setup"') > html.indexOf('id="gpd-details"'));
  });
}
