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

test("visit without areaLabel shows place and time in one meta line", () => {
  const html = page([visit()]);
  assert.match(html, /<div class="zv2l-vmeta[^"]*"><span class="nw">身近な場所<\/span> ・ <span class="nw">9:10〜10:40<\/span><\/div>/);
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
