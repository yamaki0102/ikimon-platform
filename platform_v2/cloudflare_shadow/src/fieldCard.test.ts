import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { chromium } from "@playwright/test";
import worker from "./index";
import type { PlaceAtlasProfile, PlaceAtlasProfileRecord } from "../../src/services/placeAtlasContract";
import { fieldCardRecordsFromProfile, fieldCardResponse, pickFieldCardRecords, renderFieldCardPage, type FieldCardRecord } from "./fieldCard";

const rec = (id: string, name: string | null, at: string, mediaUrl: string | null, extra: Partial<PlaceAtlasProfileRecord> = {}): PlaceAtlasProfileRecord => ({
  recordId: id, observedAt: at, displayName: name, href: null, mediaUrl, mediaKind: "photo", taxonGroup: null, themes: [], identificationStatus: "confirmed", ...extra,
});

const RECORDS = [
  rec("o1", "ナミアゲハ", "2026-06-10T03:00:00Z", "/derived/a/1.jpg", { taxonGroup: "insect" }),
  rec("o2", "不明", "2026-07-20T03:00:00Z", "/derived/a/2.jpg"),
  rec("o3", "ヤマボウシ", "2026-05-02T03:00:00Z", "/derived/a/3.jpg", { taxonGroup: "plant" }),
  rec("o4", "ツバメ", "2026-04-02T03:00:00Z", "/derived/a/4.jpg", { taxonGroup: "bird" }),
  rec("o5", "ナミアゲハ", "2026-03-02T03:00:00Z", "/derived/a/1.jpg"),
  rec("o6", "ホトトギス", "2026-08-02T03:00:00Z", "/derived/a/6.m4a", { mediaKind: "audio" }),
  rec("o7", "メジロ", "2026-08-03T03:00:00Z", null),
];

const profile = (recentRecords: PlaceAtlasProfileRecord[]): PlaceAtlasProfile => ({
  version: 1,
  placeRef: { kind: "osm_area", entityKey: "osm:way:125727939", osmType: "way", osmId: 125727939 },
  place: { name: "常磐公園", type: "park", localityLabel: "静岡県 静岡市", description: null, representativeMedia: [], canonicalPlaceId: "plc_e3293ec4bb9288a0", aliases: [], multilingualNames: { ja: "常磐公園" }, verificationStatus: "source_verified", officialStatus: "official" },
  summary: { recordCount: recentRecords.length, contributorCount: null, firstRecordedAt: null, latestRecordedAt: null },
  facets: [], highlights: [], recentRecords, guide: null, memories: [], facilities: [],
  policy: { placeVisibility: "public", recordingPolicy: "check_rules", publicLocationMode: "place", contributionCtaMode: "check_rules", ruleSource: "official", ruleUrl: null, reason: "recording_rules_unverified" },
  dataGaps: [], publication: { status: "partial", suppressedSections: [], locationMode: "osm_area" },
  provenance: { generatedAt: "2026-10-03T00:00:00Z", profileVersion: "place_atlas_profile/v1", sources: ["place_registry"], sourceReferences: [] },
} as unknown as PlaceAtlasProfile);

const render = async (records: PlaceAtlasProfileRecord[]) => fieldCardResponse(profile(records), null).text();

test("flag off: card route behaves like an unknown sub-route (404)", async () => {
  const res = await worker.fetch(new Request("https://shadow.test/ja/places/plc_e3293ec4bb9288a0/card"), { OBS_DB: {} } as any);
  assert.equal(res.status, 404);
  assert.ok(!(await res.text()).includes("出発前カード"));
});

test("non-ja card route is 404 even when flag is on", async () => {
  const res = await worker.fetch(new Request("https://shadow.test/en/places/plc_e3293ec4bb9288a0/card"), { OBS_DB: {}, FIELD_CARD_ENABLED: "true" } as any);
  assert.equal(res.status, 404);
});

test("cards come from profile.recentRecords: photo only, distinct, named first, groups, no coordinates, safety block", async () => {
  const res = fieldCardResponse(profile(RECORDS), null);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.equal((html.match(/data-fc-card/g) ?? []).length, 3);
  assert.match(html, /<h1>出発前カード<\/h1>/);
  assert.ok(html.includes("常磐公園で見つかった生きもの"));
  const names = [...html.matchAll(/<h2 class="fc-name">([^<]*)<\/h2>/g)].map((m) => m[1]);
  assert.deepEqual(names, ["ナミアゲハ", "ヤマボウシ", "ツバメ"]);
  assert.ok(!html.includes("ホトトギス") && !html.includes("メジロ"));
  for (const t of ["足は何本見える？もようはある？", "葉っぱはどんな形？ふちはギザギザ？", "くちばしは長い？短い？どんな色？", "6月の記録"]) assert.ok(html.includes(t), t);
  assert.ok(!/exact_lat|exact_lng|latitude|longitude|coordinate|lat=|lng=/i.test(html));
  for (const t of ["やくそく", "生きものは見るだけ。持ち帰らない", "さわる前に、おとなに聞く", "水辺や道路では、おとなと一緒に", "ZUKANの公開記録から作りました", "data-fc-print"]) assert.ok(html.includes(t), t);
  assert.ok(html.includes('href="/ja/places/plc_e3293ec4bb9288a0"'));
});

test("weak-only record omits the name heading and fewer than 3 shows what exists", async () => {
  const html = await render([RECORDS[1]!]);
  assert.equal((html.match(/data-fc-card/g) ?? []).length, 1);
  assert.ok(!html.includes("名前はこれから") && !html.includes(`class="fc-name"`) && html.includes("どんな色やもようが見える？") && html.includes("気づいたところを指さしてもらおう"));
});

test("0 photo records: empty state with record link", async () => {
  const html = await render([RECORDS[5]!, RECORDS[6]!]);
  assert.ok(html.includes("この場所の写真の記録がまだありません"));
  assert.ok(html.includes('href="/ja/record?placeId=plc_e3293ec4bb9288a0"'));
  assert.equal((html.match(/data-fc-card/g) ?? []).length, 0);
});

test("taxon group selects fixed question and prompt copy", () => {
  const r = (group: FieldCardRecord["group"], i: number): FieldCardRecord => ({ observationId: "o" + i, name: "ナミアゲハ", observedAt: "2026-06-10T03:00:00Z", mediaUrl: "/derived/a/" + i + ".jpg", group });
  const html = renderFieldCardPage({ placeId: "p", placeName: "場所", authenticated: false, records: pickFieldCardRecords([r("insect", 1), r("plant", 2), r("bird", 3)]) });
  for (const t of ["見つけたら、足やもようを指さしてもらおう", "同じ形の葉っぱを探してもらおう", "鳴き声が聞こえたら、まねしてもらおう"]) assert.ok(html.includes(t), t);
  assert.equal(fieldCardRecordsFromProfile(profile(RECORDS)).length, 5);
});

const findBrowserPath = (): string | null => {
  const candidates = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, chromium.executablePath()].filter((p): p is string => Boolean(p));
  for (const p of candidates) if (existsSync(p)) return p;
  const cacheDir = join(process.env.HOME || "", ".cache/ms-playwright");
  if (!existsSync(cacheDir)) return null;
  for (const entry of readdirSync(cacheDir)) {
    const bin = join(cacheDir, entry, "chrome-linux64/chrome");
    if (existsSync(bin)) return bin;
  }
  return null;
};

test("header avatar stays a square circle at 375px and 1280px even with long display names", async (t) => {
  const html = renderFieldCardPage({
    placeId: "plc_1",
    placeName: "常磐公園",
    authenticated: true,
    displayName: "とても長い表示名テストユーザーサンプル名前",
    records: [pickFieldCardRecords(fieldCardRecordsFromProfile(profile(RECORDS)))[0]!],
  });
  assert.match(html, /\.zt-avatar,\.zt-avatar:visited\{[^}]*flex:none[^}]*aspect-ratio:1\/1/);

  const browserPath = findBrowserPath();
  if (!browserPath) return t.skip("Playwright Chromium is unavailable");
  const browser = await chromium.launch({ executablePath: browserPath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } });
    await mobile.setContent(html);
    const mobileAvatar = await mobile.locator(".zt-topbar .zt-avatar").boundingBox();
    assert.ok(mobileAvatar && Math.round(mobileAvatar.width) === 44 && Math.round(mobileAvatar.height) === 44, JSON.stringify(mobileAvatar));
    await mobile.close();

    const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await desktop.setContent(html);
    const desktopTopbarDisplay = await desktop.locator(".zt-topbar.zt-topbar-member").evaluate((el) => getComputedStyle(el).display);
    assert.equal(desktopTopbarDisplay, "none");
    const sideAvatar = await desktop.locator(".zt-side-me .zt-avatar").boundingBox();
    assert.ok(sideAvatar && Math.round(sideAvatar.width) === 36 && Math.round(sideAvatar.height) === 36, JSON.stringify(sideAvatar));
    await desktop.close();
  } finally {
    await browser.close();
  }
});
