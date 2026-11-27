import assert from "node:assert/strict";
import test from "node:test";
import { buildRecordPageSections, recordPageSectionsJson } from "./recordPageSections";
import type { ReadingFoundItem, ReadingPlaceFields, ReadingPlaceValue, RecordReading, RecordReadingMedia } from "./recordReading";

const noPlace = (): ReadingPlaceFields => ({ place_type: null, contact_surface: null, surrounding_cover: null, environment_condition: null, human_change: null });
const placeValue = (code: string, labelJa: string, state: ReadingPlaceValue["state"] = "ai_read"): ReadingPlaceValue => ({ itemId: `p-${code}`, code, labelJa, state, actorKind: "ai", locator: { kind: "full" } });
const feature = (code: string, labelJa: string, over: Partial<ReadingFoundItem> = {}): ReadingFoundItem => ({ itemId: `f-${code}`, kind: "feature", state: "ai_read", code, labelJa, observationId: null, name: null, locator: { kind: "full" }, ...over });
const organism = (name: string, over: Partial<ReadingFoundItem> = {}): ReadingFoundItem => ({ itemId: `o-${name}`, kind: "organism", state: "ai_read", code: null, labelJa: null, observationId: `obs-${name}`, name: { vernacular: name, scientific: null, rank: "species" }, locator: { kind: "full" }, ...over });
const mediaEntry = (assetId: string, over: Partial<RecordReadingMedia> = {}): RecordReadingMedia => ({ assetId, mediaKind: "photo", position: 0, durationMs: null, found: [], place: noPlace(), placeRead: false, ...over });
const reading = (media: RecordReadingMedia[], recordLevel: Partial<RecordReading["recordLevel"]> = {}): RecordReading => ({
  recordId: "r1", analyzed: true, media, recordLevel: { found: [], place: noPlace(), placeRead: false, ...recordLevel },
});
const ref = (mediaId: string, mediaKind: "photo" | "video" | "audio" = "photo") => ({ mediaId, mediaKind });

test("two photos get their own found items and place", () => {
  const sections = buildRecordPageSections({
    reading: reading([
      mediaEntry("a1", { found: [organism("スズメ")], place: { ...noPlace(), place_type: placeValue("urban", "まちなか") }, placeRead: true }),
      mediaEntry("a2", { position: 1, found: [feature("grass_patch", "草むら")] }),
    ]),
    media: [ref("a1"), ref("a2")],
  }).media;
  assert.deepEqual(sections[0]!.found.map((item) => [item.kind, item.label]), [["organism", "スズメ"]]);
  assert.deepEqual(sections[0]!.place, [{ slot: "place_type", code: "urban", label: "まちなか", state: "ai_read" }]);
  assert.equal(sections[0]!.placeState, "read");
  assert.deepEqual(sections[1]!.found.map((item) => [item.kind, item.label]), [["feature", "草むら"]]);
  assert.equal(sections[1]!.place, null);
  assert.equal(sections[1]!.placeState, "pending");
});

test("feature-only video keeps revetment and grass patch with time ranges", () => {
  const sections = buildRecordPageSections({
    reading: reading([mediaEntry("v1", {
      mediaKind: "video",
      found: [
        feature("revetment", "護岸", { locator: { kind: "time_range", startMs: 0, endMs: 5000 } }),
        feature("grass_patch", "草むら", { locator: { kind: "time_range", startMs: 5000, endMs: 9000 } }),
      ],
      place: { ...noPlace(), place_type: placeValue("water_edge", "水辺"), surrounding_cover: placeValue("low_grass", "低い草") },
      placeRead: true,
    })]),
    media: [ref("v1", "video")],
  }).media;
  assert.deepEqual(sections[0]!.found.map((item) => item.label), ["護岸", "草むら"]);
  assert.deepEqual(sections[0]!.found[0]!.timeRange, { startMs: 0, endMs: 5000 });
  assert.equal(sections[0]!.place!.length, 2);
  assert.equal(sections[0]!.kind, "video");
});

test("readings of assets outside the public media list are dropped without leaking", () => {
  const sections = buildRecordPageSections({
    reading: reading([
      mediaEntry("hidden", { found: [organism("ヒミツ")] }),
      mediaEntry("a1", { position: 1, found: [organism("スズメ")] }),
    ]),
    media: [ref("a1")],
  });
  assert.equal(sections.media.length, 1);
  assert.equal(sections.media[0]!.assetId, "a1");
  assert.doesNotMatch(JSON.stringify(recordPageSectionsJson(sections)), /hidden|ヒミツ/u);
});

test("protected record strips time detail from organisms but not features", () => {
  const locator = { kind: "time_range" as const, startMs: 1000, endMs: 3000 };
  const input = reading([mediaEntry("v1", { mediaKind: "video", found: [organism("希少種", { locator }), feature("revetment", "護岸", { locator })] })]);
  const blocked = buildRecordPageSections({ reading: input, media: [ref("v1", "video")], protectedRecord: true }).media[0]!;
  assert.equal(blocked.found.find((item) => item.kind === "organism")!.timeRange, undefined);
  assert.deepEqual(blocked.found.find((item) => item.kind === "feature")!.timeRange, { startMs: 1000, endMs: 3000 });
  const open = buildRecordPageSections({ reading: input, media: [ref("v1", "video")] }).media[0]!;
  assert.deepEqual(open.found.find((item) => item.kind === "organism")!.timeRange, { startMs: 1000, endMs: 3000 });
});

test("record without a reading falls back to unread sections", () => {
  for (const missing of [null, undefined, reading([])]) {
    const sections = buildRecordPageSections({ reading: missing, media: [ref("a1"), ref("a2")] }).media;
    assert.equal(sections.length, 2);
    for (const section of sections) {
      assert.deepEqual(section.found, []);
      assert.equal(section.place, null);
      assert.equal(section.fromReading, false);
    }
  }
});

test("record-level items fill media without their own, duplicates and unknown values are removed", () => {
  const sections = buildRecordPageSections({
    reading: reading(
      [mediaEntry("a1", { found: [organism("スズメ"), organism("スズメ")], place: { ...noPlace(), contact_surface: placeValue("unknown", "分からない") }, placeRead: true }), mediaEntry("a2", { position: 1 })],
      { found: [feature("building", "建物")], place: { ...noPlace(), place_type: placeValue("urban", "まちなか") }, placeRead: true },
    ),
    media: [ref("a1"), ref("a2")],
  }).media;
  assert.deepEqual(sections[0]!.found.map((item) => item.label), ["スズメ"]);
  assert.deepEqual(sections[0]!.place!.map((field) => field.slot), ["place_type"]);
  assert.deepEqual(sections[1]!.found.map((item) => item.label), ["建物"]);
  assert.deepEqual(sections[1]!.place!.map((field) => field.slot), ["place_type"]);
});
