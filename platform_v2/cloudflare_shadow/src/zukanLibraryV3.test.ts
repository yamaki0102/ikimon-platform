import assert from "node:assert/strict";
import test from "node:test";
import { groupObservationsIntoVisitsV2, renderLibraryV2Page, renderLibraryV2VisitDetailPage, type LibraryV2ObservationInput } from "./zukanLibraryV2";

const base: LibraryV2ObservationInput = {
  observationId: "x", observedAt: "2026-11-22T00:12:00Z", placeId: null, placeName: null, areaLabel: null, lat: null, lng: null,
  reportTitle: null, reportBody: null, mediaKind: "photo", photoUrl: null, durationMs: null, visibility: "private", zukanPublished: false, eventSession: null,
};
const obs = (o: Partial<LibraryV2ObservationInput>): LibraryV2ObservationInput => ({ ...base, ...o });

const fixture = (): LibraryV2ObservationInput[] => [
  ...Array.from({ length: 6 }, (_, i) => obs({
    observationId: `p${i}`, observedAt: `2026-11-22T00:${10 + i}:00Z`, placeId: "pl-1", placeName: "四日市少年自然の家", areaLabel: "四日市市",
    lat: 35.01, lng: 136.47, photoUrl: `/d/p${i}.webp`, reportTitle: i === 0 ? "池のまわりの観察記録" : null, reportBody: i === 0 ? "カワセミを見た。" : null,
  })),
  obs({ observationId: "v1", observedAt: "2026-11-22T00:30:00Z", placeId: "pl-1", placeName: "四日市少年自然の家", areaLabel: "四日市市", lat: 35.01, lng: 136.47, mediaKind: "video", photoUrl: "/d/v1.webp", durationMs: 38000 }),
  obs({ observationId: "q1", observedAt: "2026-11-22T06:05:00Z", placeId: "pl-1", placeName: "四日市少年自然の家", areaLabel: "四日市市", lat: 35.01, lng: 136.47, photoUrl: "/d/q1.webp", visibility: "public", zukanPublished: true, eventSession: { sessionId: "ev", title: "自然観察指導員講習会" } }),
  obs({ observationId: "a1", observedAt: "2026-11-16T07:12:00Z", placeId: "pl-2", placeName: "佐鳴湖", areaLabel: "浜松市", lat: 34.7, lng: 137.7, mediaKind: "audio", photoUrl: null, audioTitle: "鳥の声", durationMs: 42000 }),
  obs({ observationId: "r1", observedAt: "2026-10-03T08:05:00Z", placeName: "長久手市", areaLabel: "長久手市", mediaKind: null, reportBody: "夕方、池のまわりを歩いた。" }),
  obs({ observationId: "n1", observedAt: "2026-11-26T06:42:00Z", photoUrl: "/d/n1.webp" }),
];

const render = (lang: "ja" | "en" = "ja") => renderLibraryV2Page({ visits: groupObservationsIntoVisitsV2(fixture()), lang, authenticated: true, displayName: "t", nextCursor: null });

test("date dividers: one per day, visits under it, no date in visit heading", () => {
  const html = render();
  const dates = [...html.matchAll(/data-library-date="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(dates, ["2026-11-26", "2026-11-22", "2026-11-16", "2026-10-03"]);
  assert.equal([...html.matchAll(/<article class="zv2l-visit"/g)].length, 5);
  assert.doesNotMatch(html, /<h3 class="zv2l-vhead">[^<]*(\d+月\d+日)/);
});

test("face priority: report title, then place name, then none (photo-only)", () => {
  const html = render();
  assert.match(html, /<h3 class="zv2l-vhead">池のまわりの観察記録<\/h3>/);
  assert.match(html, /<h3 class="zv2l-vhead"><span class="nw">四日市少年自然の家<\/span><\/h3>/);
  assert.match(html, /<h3 class="zv2l-vhead"><span class="nw">佐鳴湖<\/span><\/h3>/);
  const noFace = html.split('data-library-visit="').find((c) => c.includes("/d/n1.webp"))!;
  assert.doesNotMatch(noFace.split("</article>")[0]!, /zv2l-vhead/);
  assert.match(noFace, /zv2l-vmeta first/);
});

test("counts appear only in kind rows with real numbers; grid caps at 4 cells with remaining tile", () => {
  const html = render();
  assert.match(html, /写真6枚/);
  assert.match(html, /動画1本/);
  assert.match(html, /音1つ/);
  assert.match(html, /イベントに参加/);
  assert.equal([...html.matchAll(/写真6枚/g)].length, 1);
  assert.match(html, /あと4枚/);
  assert.doesNotMatch(html, /class="zv2l-cnt"/);
});

test("status line shows only outside states; no unpublished sentence; no list publish button", () => {
  const html = render();
  assert.doesNotMatch(html, /まだ図鑑に載せていません/);
  assert.match(html, /<span class="zv2l-st pub">[\s\S]*?公開しています[\s\S]*?図鑑に載せています/);
  assert.doesNotMatch(html, /図鑑に載せる[^<]*</);
  assert.doesNotMatch(html, /zv2l-publish-btn|data-zukan-open-popover/);
});

test("no メモ and no same photo twice on one screen", () => {
  const html = render();
  assert.doesNotMatch(html, /メモ|ズカン/);
  const srcs = [...html.matchAll(/<img src="(\/d\/[^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(srcs).size, srcs.length);
  const search = renderLibraryV2Page({ visits: [], lang: "ja", authenticated: true, searchQuery: "あ", nextCursor: null });
  assert.doesNotMatch(search, /メモ/);
  assert.match(search, /フィールドレポート/);
});

test("zero state: one invitation and a single primary action", () => {
  const html = renderLibraryV2Page({ visits: [], lang: "ja", authenticated: true, displayName: "t", nextCursor: null });
  assert.match(html, /写真や動画、音、フィールドレポート、どれからでも始められます/);
  assert.match(html, /公開しなくても、自分だけの記録として残せます/);
  assert.equal([...html.matchAll(/class="zv2l-btn-main"/g)].length, 1);
  assert.doesNotMatch(html, /class="zv2l-btn-sub"/);
  assert.match(html, />記録をはじめる</);
});

test("en copy keeps working", () => {
  const html = render("en");
  assert.match(html, /6 photos/);
  assert.match(html, /\+4 more/);
  assert.match(html, /Joined an event/);
  assert.match(html, /Nov 22/);
  const zero = renderLibraryV2Page({ visits: [], lang: "en", authenticated: true, nextCursor: null });
  assert.match(zero, /Start a record/);
});

test("open visit keeps single primary publish action with description", () => {
  const v = groupObservationsIntoVisitsV2(fixture()).find((x) => x.observationIds.includes("p0"))!;
  const html = renderLibraryV2VisitDetailPage(v, { lang: "ja" });
  assert.equal([...html.matchAll(/id="zv2l-publish-btn"/g)].length, 1);
  assert.match(html, /まだ載せていません。載せると/);
  assert.doesNotMatch(html, /メモ/);
});
