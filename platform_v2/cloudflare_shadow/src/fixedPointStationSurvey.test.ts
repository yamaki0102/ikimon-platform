import assert from "node:assert/strict";
import test from "node:test";
import { renderFixedPointQrSignPage, renderFixedPointTimelineHtml } from "./fixedPointStationSurvey";

test("renderFixedPointQrSignPage and renderFixedPointTimelineHtml render overlay photo, 3 prompts, zero-observation, and on-site verification", () => {
  const station = {
    station_id: "fps_pond_east",
    place_id: "plc_e3293ec4bb9288a0",
    title: "池の東側ベンチ",
    prompt_1: "水の色",
    prompt_2: "花の数",
    prompt_3: "鳥の声の有無",
    reference_photo_url: "https://zukan.earth/derived/prev.webp",
    created_by_user_id: "u1",
    created_at: 1795417200000
  };
  const records = [
    {
      record_id: "fpr_1",
      station_id: "fps_pond_east",
      place_id: "plc_e3293ec4bb9288a0",
      answer_1: "澄んでいる",
      answer_2: "0本",
      answer_3: "2分間聞こえなかった",
      taxon_name: "",
      is_zero_observation: 1,
      on_site_verified: 1,
      verified_by_label: "山田案内人",
      photo_url: "https://zukan.earth/derived/prev.webp",
      observed_at: "2026-11-23T09:30:00.000Z",
      created_at: 1795417200000
    }
  ];

  const qrHtml = renderFixedPointQrSignPage({ station, records, lang: "ja", cspNonce: "n1" });
  assert.match(qrHtml, /定点QR標識/);
  assert.match(qrHtml, /池の東側ベンチ/);
  assert.match(qrHtml, /この定点の見本写真（半透明重ね）/);
  assert.match(qrHtml, /1\. 水の色/);
  assert.match(qrHtml, /2\. 花の数/);
  assert.match(qrHtml, /3\. 鳥の声の有無/);
  assert.match(qrHtml, /種名（任意）/);
  assert.match(qrHtml, /ゼロ記録・いないと断定しません/);
  assert.match(qrHtml, /その場で実物を確かめた（現地確認の印）/);
  assert.match(qrHtml, /data-global-record-trigger="photo"/);

  const timelineHtml = renderFixedPointTimelineHtml([station], records, "ja", "plc_e3293ec4bb9288a0");
  assert.match(timelineHtml, /定点の時系列記録/);
  assert.match(timelineHtml, /現地確認済み（写真判定より上位の証拠）: 山田案内人/);
  assert.match(timelineHtml, /ゼロ記録（確認できず・いないと断定しません）/);
});
