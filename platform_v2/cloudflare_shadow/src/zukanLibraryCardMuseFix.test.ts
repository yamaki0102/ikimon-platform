import assert from "node:assert/strict";
import test from "node:test";
import { renderLibraryV2Page, type LibraryV2Visit } from "./zukanLibraryV2";

function visit(extra: Partial<LibraryV2Visit> = {}): LibraryV2Visit {
  return {
    visitKey: "v1",
    dateDay: "2026-11-01",
    dateLabel: "11月1日(日)",
    timeRangeLabel: "9:10〜10:40",
    headingTitle: "",
    placeId: null,
    placeName: "身近な場所",
    areaLabel: "",
    startedAt: "2026-11-01T00:10:00.000Z",
    endedAt: "2026-11-01T01:40:00.000Z",
    observationIds: ["o1"],
    zukanEligibleObservationIds: ["o1"],
    photos: [{ observationId: "o1", url: "/p/1.jpg", isVideo: false } as never],
    videos: [],
    audios: [],
    report: null,
    eventParticipation: null,
    isPublic: false,
    zukanPublished: false,
    matchedByCandidate: false,
    ...extra,
  };
}

const page = (v: LibraryV2Visit[]) => renderLibraryV2Page({ visits: v, lang: "ja", authenticated: true });

test("sort pills use palette colors only and never purple", () => {
  const html = page([visit()]);
  const css = html.split("\n").filter((l) => l.includes(".zv2l-sort")).join("\n");
  assert.ok(css.includes(":visited") && css.includes(":hover") && css.includes(":focus-visible"));
  const hexes = css.match(/#[0-9A-Fa-f]{3,6}\b/g) ?? [];
  const allowed = new Set(["#DDE2DC", "#fff", "#3C4A41", "#EFF3EE"]);
  for (const h of hexes) assert.ok(allowed.has(h), h);
  assert.ok(!/purple|#[89a-f][0-9a-f]?[0-9a-f]?[0-9a-f]?[0-9a-f]?[0-9a-f]?\b.*purple/i.test(css));
});

test("visit meta shows real place and time range; generic place is omitted", () => {
  const html = page([visit({ placeName: "連理の木の下で" })]);
  assert.match(html, /<div class="zv2l-vmeta[^"]*"><span class="nw">連理の木の下で<\/span> ・ <span class="nw">9:10〜10:40<\/span><\/div>/);
  const gen = page([visit()]);
  assert.ok(!gen.slice(gen.indexOf('data-library-visit="v1"')).includes("身近な場所"));
});

test("sort pills have no default link color and no purple", () => {
  const css = page([visit()]).split(String.fromCharCode(10)).filter((l) => l.includes(".zv2l-sort")).join(String.fromCharCode(10));
  assert.ok(css.includes(".zv2l-sort a:visited") && !/purple|#(6|7|8|9)[0-9a-f]{0,2}[0-9a-f]{0,2}[0-9a-f]{0,2}.*(purple)/i.test(css));
});

test("same-day same-place photos merge into one visit card", () => {
  const html = page([visit({ placeName: "連理の木の下で", photos: [1, 2, 3].map((i) => ({ observationId: `o${i}`, url: `/p/${i}.jpg`, isVideo: false }) as never) })]);
  assert.equal((html.match(/data-library-visit=/g) ?? []).length, 1);
  assert.ok(html.includes("連理の木の下で") && html.includes("9:10〜10:40"));
});

test("private card hides 自分のみ and public card shows 公開しています", () => {
  const priv = page([visit()]);
  const body = priv.slice(priv.indexOf('data-library-visit="v1"'));
  assert.ok(!body.includes("自分のみ"));
  const pub = page([visit({ isPublic: true })]);
  assert.ok(pub.includes("公開しています"));
});

test("single photo card has no 写真1枚 chip", () => {
  const html = page([visit()]);
  const body = html.slice(html.indexOf('data-library-visit="v1"'));
  assert.ok(!body.includes("写真1枚"));
});

test("same-day same-place photos group into one visit with place and time range", async () => {
  const { groupObservationsIntoVisitsV2 } = await import("./zukanLibraryV2");
  const o = (id: string, at: string) => ({ observationId: id, observedAt: at, placeId: "plc_a", placeName: "連理の木の下で", areaLabel: null, lat: null, lng: null, reportTitle: null, reportBody: null, mediaKind: "photo" as const, photoUrl: `/p/${id}.jpg`, durationMs: null, visibility: "private" as const, zukanPublished: false, eventSession: null });
  const visits = groupObservationsIntoVisitsV2([o("a", "2026-11-01T00:10:00.000Z"), o("b", "2026-11-01T00:48:00.000Z")]);
  assert.equal(visits.length, 1);
  assert.equal(visits[0]!.photos.length, 2);
  assert.equal(visits[0]!.timeRangeLabel, "9:10〜9:48");
  const html = page(visits);
  assert.ok(html.includes("連理の木の下で"));
  assert.ok(html.includes("9:10〜9:48"));
});

test("default statuses are not repeated on every card", () => {
  const html = page([visit({ visitKey: "v1" }), visit({ visitKey: "v2", observationIds: ["o2"] })]);
  const body = html.slice(html.indexOf('data-library-visit="v1"'));
  assert.ok(!body.includes("自分のみ") && !body.includes("写真1枚") && !body.includes("自分の記録"));
});
