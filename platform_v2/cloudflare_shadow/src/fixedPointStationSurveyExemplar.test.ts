import assert from "node:assert/strict";
import test from "node:test";
import { renderFixedPointQrSignPage } from "./fixedPointStationSurvey";

const EX = "https://zukan.earth/derived/exemplar.webp";
const LAST = "https://zukan.earth/derived/last-record.webp";

function station(ref: string) {
  return {
    station_id: "fps_a",
    place_id: "plc_a",
    title: "池の東側",
    prompt_1: "a",
    prompt_2: "b",
    prompt_3: "c",
    reference_photo_url: ref,
    created_by_user_id: "u1",
    created_at: 1
  };
}

function rec(photo: string) {
  return {
    record_id: "r1",
    station_id: "fps_a",
    place_id: "plc_a",
    answer_1: "x",
    answer_2: "y",
    answer_3: "z",
    taxon_name: "",
    is_zero_observation: 0,
    on_site_verified: 0,
    verified_by_label: "",
    photo_url: photo,
    observed_at: "2026-11-23T09:30:00.000Z",
    created_at: 1
  };
}

function render(ref: string, records: ReturnType<typeof rec>[]) {
  return renderFixedPointQrSignPage({ station: station(ref), records, lang: "ja", cspNonce: "n" });
}

test("overlay uses exemplar; previous record photo only in compare block", () => {
  const html = render(EX, [rec(LAST)]);
  assert.match(html, new RegExp(`id="fps-prev-photo"[^>]*src="${EX}"`));
  assert.equal(html.split(LAST).length - 1 >= 1, true);
  const overlay = html.slice(html.indexOf('class="fps-overlay-box"'), html.indexOf("fps-opacity\""));
  assert.equal(overlay.includes(LAST), false);
  const compare = html.slice(html.indexOf("data-fps-compare"));
  assert.match(compare, new RegExp(`src="${LAST}"`));
  assert.match(html, /前回/);
  assert.match(html, /重ね撮り透明度（見本写真）/);
});

test("empty exemplar shows placeholder and never uses previous photo as overlay", () => {
  const html = render("", [rec(LAST)]);
  assert.match(html, /この定点の見本写真がまだありません。最初に正しく撮れた1枚が見本になります/);
  assert.equal(html.includes('id="fps-prev-photo"'), false);
  const overlay = html.slice(html.indexOf('class="fps-overlay-box"'), html.indexOf("fps-opacity\""));
  assert.equal(overlay.includes(LAST), false);
});

test("no records shows no compare block", () => {
  const html = render(EX, []);
  assert.equal(html.includes("data-fps-compare"), false);
  assert.equal(html.includes('id="fps-last-photo"'), false);
});
