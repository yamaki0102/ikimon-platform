import assert from "node:assert/strict";
import test from "node:test";
import type { PlaceAtlasProfile } from "../../src/services/placeAtlasContract";
import { renderGlobalPlaceDetailPage } from "./placeDetailPage";
import { renderRecordPlaceAndTimeHtml } from "./zukanRecordPlaceAndTime";

const NOW = new Date("2026-11-27T03:00:00Z");

function record(n: number, name: string, mediaUrl: string | null = `https://img.example/${n}.jpg`) {
  return { recordId: `rec_${n}`, observedAt: `2026-11-${10 + n}T01:00:00Z`, displayName: name, href: `/ja/observations/rec_${n}`, mediaUrl, mediaKind: "photo" as const, taxonGroup: null, themes: [], identificationStatus: "confirmed" as const };
}

function profile(over: Partial<PlaceAtlasProfile> = {}): PlaceAtlasProfile {
  return {
    version: 1,
    placeRef: { kind: "osm_area", entityKey: "osm:way:1", osmType: "way", osmId: 1 },
    place: { name: "連理の木の下で", type: "park", localityLabel: "浜松市中央区", description: null, representativeMedia: [{ url: "https://img.example/rep.jpg" }], canonicalPlaceId: "plc_etest" },
    summary: { recordCount: 128, contributorCount: null, firstRecordedAt: "2024-04-01T00:00:00Z", latestRecordedAt: "2026-11-24T00:00:00Z" },
    facets: [], highlights: [],
    recentRecords: [1, 2, 3, 4, 5, 6].map((n) => record(n, `クスノキ${n}`)),
    guide: null, memories: [], facilities: [],
    policy: { placeVisibility: "public", recordingPolicy: "check_rules", publicLocationMode: "place", contributionCtaMode: "check_rules", ruleSource: "official", ruleUrl: null, reason: "recording_rule" },
    dataGaps: [],
    publication: { status: "published", suppressedSections: [], locationMode: "osm_area" },
    provenance: { generatedAt: "2026-11-01T00:00:00Z", profileVersion: "place_atlas_profile/v1", sources: ["place_registry"], sourceReferences: [{ sourceType: "osm_way", sourceId: "1" }, { sourceType: "hamamatsu_cultural_property", sourceId: "x" }] },
    ...over,
  } as unknown as PlaceAtlasProfile;
}

function empty(): PlaceAtlasProfile {
  return profile({ summary: { recordCount: 0, contributorCount: null, firstRecordedAt: null, latestRecordedAt: null }, recentRecords: [] });
}

const render = (p: PlaceAtlasProfile, extra: Record<string, unknown> = {}) =>
  renderGlobalPlaceDetailPage({ profile: p, lang: "ja", viewerAuthenticated: true, savedStateAvailable: false, now: NOW, ...extra });

const mainOf = (html: string) => html.slice(html.indexOf("data-place-e-v2"), html.indexOf('id="gpd-details"'));

test("switch off and e2:false render identical legacy page", () => {
  assert.equal(render(profile()), render(profile(), { e2: false }));
  assert.doesNotMatch(render(profile()), /data-place-e-v2/);
});

test("E1: hero, name, chips, strip, rows, one primary, more button", () => {
  const html = render(profile(), { e2: true });
  const main = mainOf(html);
  assert.match(main, /data-pe-hero/);
  assert.match(main, /<h1 id="gpd-title" class="pe-name">連理の木の下で<\/h1>/);
  assert.match(main, /記録 128件/);
  assert.match(main, /data-pe-strip/);
  assert.equal((main.match(/class="pe-row"/g) ?? []).length, 2);
  assert.equal((main.match(/data-pe-record[ >]/g) ?? []).length, 1);
  assert.match(main, /この場所で記録する/);
  assert.match(main, /data-pe-more[^>]*>[^<]*詳しく/);
  assert.match(main, /placeId=plc_etest&amp;placeName=/);
  assert.doesNotMatch(main, /rep\.jpg/);
});

test("E1: no photo appears twice on the page main", () => {
  const main = mainOf(render(profile(), { e2: true }));
  const urls = [...main.matchAll(/https:\/\/img\.example\/(\d+)\.jpg/g)].map((m) => m[1]);
  const base = new Set(urls);
  const byImg = [...main.matchAll(/<img [^>]*?(?:src|srcset)="[^"]*?img\.example\/(\d+)\.jpg/g)].map((m) => m[1]);
  assert.equal(new Set(byImg).size, byImg.length);
  assert.ok(base.size >= 4);
});

test("E1: with few photos no strip, still no duplicates", () => {
  const p = profile({ recentRecords: [record(1, "クスノキ1"), record(2, "池の鯉")] });
  const main = mainOf(render(p, { e2: true }));
  assert.doesNotMatch(main, /data-pe-strip/);
  const byImg = [...main.matchAll(/<img [^>]*?(?:src|srcset)="[^"]*?img\.example\/(\d+)\.jpg/g)].map((m) => m[1]);
  assert.equal(new Set(byImg).size, byImg.length);
});

test("E3: zero records shows clear first step, no image", () => {
  const main = mainOf(render(empty(), { e2: true }));
  assert.match(main, /data-pe-empty/);
  assert.match(main, /まだ記録がありません/);
  assert.match(main, /この場所で最初の記録を残す/);
  assert.match(main, /記録 0件/);
  assert.match(main, /href="\/ja\/record\?placeId=plc_etest&amp;placeName=/);
  assert.doesNotMatch(main, /<img |data-pe-strip|data-pe-records/);
  assert.equal((main.match(/data-pe-record[ >]/g) ?? []).length, 1);
});

test("events only when supplied; credits kept", () => {
  assert.doesNotMatch(mainOf(render(profile(), { e2: true })), /data-pe-events/);
  const html = render(profile(), { e2: true, e2Events: [{ title: "冬の自然観察会", href: "/ja/events/e1", whenLabel: "12月20日（日）10:00〜" }] });
  assert.match(mainOf(html), /data-pe-events[\s\S]*冬の自然観察会/);
  assert.match(html, /data-osm-attribution/);
  assert.match(html, /出典：浜松市オープンデータ/);
});

test("E8: record page keeps the place and shows its name", () => {
  const html = renderRecordPlaceAndTimeHtml({ lang: "ja", initialPlaceId: "plc_etest", initialPlaceName: "連理の木の下で", defaultObservedAtLocal: "" });
  assert.match(html, /name="placeId" id="record-place-id" value="plc_etest"/);
  assert.match(html, /選んだ場所: 連理の木の下で/);
});

test("escapes dynamic text", () => {
  const p = profile({ place: { name: '<script>x</script>', type: "park", localityLabel: "<b>y</b>", description: null, representativeMedia: [], canonicalPlaceId: "plc_etest" } as never });
  const main = mainOf(render(p, { e2: true }));
  assert.doesNotMatch(main, /<script>x|<b>y/);
});

test("invasive section only for confirmed invasive names; omitted otherwise", () => {
  const none = mainOf(render(profile(), { e2: true }));
  assert.doesNotMatch(none, /data-pe-invasive|外来種/);
  const recs = [record(1, "ナガエツルノゲイトウ"), record(2, "クスノキ")];
  const html = mainOf(render(profile({ recentRecords: recs }), { e2: true }));
  assert.match(html, /data-pe-invasive[\s\S]*ナガエツルノゲイトウ[\s\S]*名前が確認されています/);
  assert.doesNotMatch(html, /いません/);
  const unconfirmed = [{ ...record(1, "ナガエツルノゲイトウ"), identificationStatus: "unconfirmed" }];
  assert.doesNotMatch(mainOf(render(profile({ recentRecords: unconfirmed as never }), { e2: true })), /data-pe-invasive/);
});

test("loadPlaceLinkedEvents maps rows by field_id and tolerates failure", async () => {
  const { loadPlaceLinkedEvents } = await import("./placeInvasive");
  let bound: unknown;
  const db = { prepare: () => ({ bind: (v: unknown) => { bound = v; return { all: async () => ({ results: [{ session_id: "s1", title: "観察会", started_at: "2026-12-20T01:00:00Z", ended_at: null }] }) }; } }) };
  const out = await loadPlaceLinkedEvents(db as never, "plc_etest", "ja", () => ({ whenLabel: "12月20日" }));
  assert.equal(bound, "plc_etest");
  assert.deepEqual(out, [{ title: "観察会", href: "/ja/events/s1/preview", whenLabel: "12月20日" }]);
  const bad = { prepare: () => { throw new Error("x"); } };
  assert.deepEqual(await loadPlaceLinkedEvents(bad as never, "p", "ja", () => ({ whenLabel: "" })), []);
});
