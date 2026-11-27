import assert from "node:assert/strict";
import test from "node:test";
import {
  groupObservationsIntoVisitsV2,
  renderLibraryV2Page,
  type LibraryV2ObservationInput,
} from "./zukanLibraryV2";

function obs(over: Partial<LibraryV2ObservationInput> & { observationId: string }): LibraryV2ObservationInput {
  return {
    observedAt: "2026-11-23T00:12:00Z",
    placeId: "place-a",
    placeName: "テスト公園",
    areaLabel: "四日市市",
    lat: 35.01,
    lng: 136.47,
    reportTitle: null,
    reportBody: null,
    mediaKind: "photo",
    photoUrl: `/derived-transform/w360/derived/${over.observationId}/display.webp`,
    durationMs: null,
    visibility: "public",
    zukanPublished: false,
    eventSession: null,
    ...over,
  };
}

function cardHrefFor(items: LibraryV2ObservationInput[]): { href: string; groupHref: string } {
  const visits = groupObservationsIntoVisitsV2(items);
  assert.equal(visits.length, 1);
  const html = renderLibraryV2Page({ visits, lang: "ja", authenticated: true, nextCursor: null });
  const m = /<a class="zv2l-visit-link" href="([^"]+)"/.exec(html);
  assert.ok(m, "visit card link must exist");
  return {
    href: m[1]!,
    groupHref: `/ja/library/group?group=${encodeURIComponent(visits[0]!.visitKey)}`,
  };
}

test("single-photo visit card links straight to the observation record", () => {
  const { href } = cardHrefFor([obs({ observationId: "obs-solo" })]);
  assert.equal(href, "/ja/observations/obs-solo");
});

test("single-video visit card links straight to the observation record", () => {
  const { href } = cardHrefFor([obs({ observationId: "obs-vid", mediaKind: "video", durationMs: 38000 })]);
  assert.equal(href, "/ja/observations/obs-vid");
});

test("two-photo visit card keeps the group href", () => {
  const { href, groupHref } = cardHrefFor([
    obs({ observationId: "obs-p1" }),
    obs({ observationId: "obs-p2", observedAt: "2026-11-23T00:20:00Z" }),
  ]);
  assert.equal(href, groupHref);
  assert.match(href, /^\/ja\/library\/group\?group=/);
});

test("single photo with a field report keeps the group href", () => {
  const { href, groupHref } = cardHrefFor([
    obs({ observationId: "obs-r1", reportTitle: "池のまわり", reportBody: "カワセミを見た。" }),
  ]);
  assert.equal(href, groupHref);
});
