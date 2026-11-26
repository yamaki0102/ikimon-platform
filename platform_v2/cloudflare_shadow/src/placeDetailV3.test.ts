import assert from "node:assert/strict";
import test from "node:test";
import type { PlaceAtlasProfile } from "../../src/services/placeAtlasContract";
import { renderGlobalPlaceDetailPage } from "./placeDetailPage";

const NOW = new Date("2026-11-27T03:00:00Z");

function record(n: number, observedAt: string, name = `記録${n}`, mediaUrl: string | null = `https://img.example/${n}.jpg`) {
  return {
    recordId: `rec_${n}`,
    observedAt,
    displayName: name,
    href: `/ja/observations/rec_${n}`,
    mediaUrl,
    mediaKind: "photo" as const,
    taxonGroup: null,
    themes: [],
    identificationStatus: "confirmed" as const,
  };
}

function profile(over: Partial<PlaceAtlasProfile> = {}): PlaceAtlasProfile {
  return {
    version: 1,
    placeRef: { kind: "osm_area", entityKey: "osm:way:1", osmType: "way", osmId: 1 },
    place: {
      name: "連理の木の下で",
      type: "park",
      localityLabel: "浜松市中央区",
      description: "OSM由来の説明文です。",
      representativeMedia: [{ url: "https://img.example/rep.jpg" }],
      canonicalPlaceId: "plc_v3test",
    },
    summary: { recordCount: 128, contributorCount: null, firstRecordedAt: "2024-04-01T00:00:00Z", latestRecordedAt: "2026-11-24T00:00:00Z" },
    facets: [],
    highlights: [],
    recentRecords: [
      record(1, "2026-11-24T01:00:00Z", "クスノキの剪定"),
      record(2, "2026-11-20T01:00:00Z", "池の鯉と睡蓮の葉"),
      record(3, "2026-09-18T01:00:00Z", "カワセミが池に来た"),
      record(4, "2026-08-18T01:00:00Z", "audio", null),
    ],
    guide: null,
    memories: [],
    facilities: [],
    policy: { placeVisibility: "public", recordingPolicy: "check_rules", publicLocationMode: "place", contributionCtaMode: "check_rules", ruleSource: "official", ruleUrl: null, reason: "recording_rules_unverified" },
    dataGaps: [],
    publication: { status: "published", suppressedSections: [], locationMode: "osm_area" },
    provenance: { generatedAt: "2026-11-01T00:00:00Z", profileVersion: "place_atlas_profile/v1", sources: ["place_registry"], sourceReferences: [] },
    ...over,
  } as PlaceAtlasProfile;
}

function empty(): PlaceAtlasProfile {
  return profile({
    place: { name: "東川の河川敷", type: "park", localityLabel: "浜松市東区", description: "生成された説明文", representativeMedia: [{ url: "https://img.example/rep.jpg" }], canonicalPlaceId: "plc_v3empty" },
    summary: { recordCount: 0, contributorCount: null, firstRecordedAt: null, latestRecordedAt: null },
    recentRecords: [],
  });
}

const render = (p: PlaceAtlasProfile, extra: Record<string, unknown> = {}) =>
  renderGlobalPlaceDetailPage({ profile: p, lang: "ja", viewerAuthenticated: true, savedStateAvailable: false, now: NOW, ...extra });

test("switch off and v3:false render the same legacy page without v3 markers", () => {
  const a = render(profile());
  const b = render(profile(), { v3: false });
  assert.equal(a, b);
  assert.doesNotMatch(a, /data-place-page-v3|pv3-/);
  assert.match(a, /class="gpd-hero has-photo"/);
});

test("v3 with records: band 1+2, name on white ground, strip, no boxed stats", () => {
  const html = render(profile(), { v3: true });
  assert.match(html, /data-place-page-v3/);
  assert.match(html, /data-pv3-band="3"/);
  const band = html.match(/<div class="pv3-band[^"]*"[^>]*>([\s\S]*?)<\/div><\/div>/)?.[0] ?? "";
  assert.equal((band.match(/<img /g) ?? []).length, 3);
  assert.match(band, /1\.jpg/);
  assert.doesNotMatch(band, /rep\.jpg/);
  const bandIndex = html.indexOf("data-pv3-band");
  const h1Index = html.indexOf('<h1 id="gpd-title" class="pv3-name">連理の木の下で</h1>');
  assert.ok(h1Index > bandIndex);
  assert.doesNotMatch(html.slice(bandIndex, h1Index), /<h1/);
  assert.doesNotMatch(html, /class="gpd-hero[ "]|class="gpd-stats/);
  assert.match(html, /data-pv3-strip><div><div class="n">128<\/div><div class="k">この場所の記録<\/div><\/div><div><div class="n">2024<\/div>/);
  assert.match(html, /data-pv3-recent/);
  assert.match(html, /data-pv3-around/);
  assert.doesNotMatch(html, /data-pv3-events|data-pv3-steward/);
  assert.doesNotMatch(html.slice(html.indexOf("data-place-page-v3"), html.indexOf("id=\"gpd-details\"")), /記録した人/);
  assert.doesNotMatch(html, /OSM由来の説明文です/);
  assert.doesNotMatch(html, /data-pv3-intro/);
  assert.match(html, /data-pv3-season[\s\S]*11月の記録[\s\S]*クスノキの剪定/);
});

test("v3 band adapts to 1 and 2 photos", () => {
  const one = render(profile({ recentRecords: [record(1, "2026-11-24T01:00:00Z")] }), { v3: true });
  assert.match(one, /data-pv3-band="1"/);
  const two = render(profile({ recentRecords: [record(1, "2026-11-24T01:00:00Z"), record(2, "2026-11-20T01:00:00Z")] }), { v3: true });
  assert.match(two, /data-pv3-band="2"/);
});

test("v3 with 0 records: no hero image, only grounded text, invitation", () => {
  const html = render(empty(), { v3: true });
  const main = html.slice(html.indexOf("data-place-page-v3"), html.indexOf('id="gpd-details"'));
  assert.doesNotMatch(main, /<img /);
  assert.doesNotMatch(main, /rep\.jpg/);
  assert.match(main, /<h1 id="gpd-title" class="pv3-name">東川の河川敷<\/h1>/);
  assert.match(main, /浜松市東区/);
  assert.match(main, /まだ記録がありません/);
  assert.match(main, /最初に記録する/);
  assert.doesNotMatch(main, /生成された説明文|data-pv3-intro|data-pv3-strip|data-pv3-season|data-pv3-recent|data-pv3-events|data-pv3-steward/);
});

test("v3 renders steward-written intro, events and steward only when supplied, with field names only", () => {
  const html = render(profile(), {
    v3: true,
    v3Extras: {
      stewardIntro: "担当が書いた紹介",
      events: [{ title: "冬の自然観察会", href: "/ja/events/e1", whenLabel: "12月20日（日）10:00〜" }],
      steward: { fieldName: "はまっこ" },
      nearby: [{ name: "みなと川の土手", href: "/ja/places/plc_x", distanceLabel: "約0.8km" }],
    },
  });
  assert.match(html, /data-pv3-intro>担当が書いた紹介/);
  assert.match(html, /data-pv3-events[\s\S]*冬の自然観察会/);
  assert.match(html, /data-pv3-steward[\s\S]*はまっこ さん/);
  assert.match(html, /みなと川の土手/);
  assert.doesNotMatch(html, /フォロー|follow/i);
});

test("v3 escapes all dynamic text and attributes", () => {
  const p = profile({
    place: { name: '<script>alert(1)</script>"', type: "park", localityLabel: "<b>x</b>", description: null, representativeMedia: [], canonicalPlaceId: "plc_v3test" },
    recentRecords: [record(1, "2026-11-24T01:00:00Z", '<img src=x onerror=1>', 'https://img.example/a.jpg" onerror="1')],
  });
  const html = render(p, { v3: true, v3Extras: { stewardIntro: "<i>intro</i>", steward: { fieldName: "<u>n</u>" } } });
  const main = html.slice(html.indexOf("data-place-page-v3"), html.indexOf('id="gpd-details"'));
  assert.doesNotMatch(main, /<script>alert|<b>x|<i>intro|<u>n|<img src=x/);
  assert.doesNotMatch(main, /" onerror="1/);
  assert.match(main, /&lt;script&gt;/);
});

test("v3 has no follow-people UI and honors reduced motion", () => {
  const html = render(profile(), { v3: true });
  assert.doesNotMatch(html.slice(html.indexOf("data-place-page-v3"), html.indexOf('id="gpd-details"')), /フォロー|follow/i);
  assert.match(html, /prefers-reduced-motion:reduce\)\{\.pv3 \*\{animation:none!important/);
});

test("v3 drops duplicated legacy cards, collapses details, hides unknown save state", () => {
  const html = render(profile(), { v3: true });
  const tail = html.slice(html.indexOf('<details class="pv3-details" id="gpd-details">'));
  assert.ok(tail.length > 0);
  assert.match(tail, /^<details class="pv3-details" id="gpd-details"><summary>場所について詳しく見る<\/summary>/);
  assert.doesNotMatch(html, /<details[^>]*\sopen/);
  assert.equal((html.match(/<details class="pv3-details"/g) ?? []).length, 1);
  assert.doesNotMatch(html.slice(html.indexOf("<main"), html.indexOf("</main>")), /me-place-atlas-hero|me-place-atlas-summary|me-place-atlas-recent|me-place-atlas-empty/);
  assert.doesNotMatch(html, /class="gpd-primary" href="https:\/\/www\.google\.com\/maps/);
  assert.match(html, /data-pv3-around[\s\S]*google\.com\/maps/);
  assert.match(tail, /現地で見せる/);
  assert.match(tail, /data-area-observations-panel/);
  assert.match(tail, /me-place-atlas-policy/);
  assert.doesNotMatch(html, /保存状態を確認できません/);
  const empty0 = render(empty(), { v3: true });
  assert.doesNotMatch(empty0.slice(empty0.indexOf("<main"), empty0.indexOf("</main>")), /me-place-atlas-hero|me-place-atlas-empty/);
  assert.doesNotMatch(empty0.slice(empty0.indexOf("data-place-page-v3")), /rep\.jpg/);
  const legacy = render(profile());
  assert.match(legacy, /保存状態を確認できません/);
  assert.match(legacy.slice(legacy.indexOf("<main"), legacy.indexOf("</main>")), /me-place-atlas-hero/);
});
