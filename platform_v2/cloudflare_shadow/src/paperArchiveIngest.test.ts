import assert from "node:assert/strict";
import test from "node:test";
import {
  extractPaperArchivePageFields,
  redactPaperPersonalInfo,
  renderPaperArchiveTimelineHtml
} from "./paperArchiveIngest";

test("extractPaperArchivePageFields extracts date, place, species, count and redacts personal info", () => {
  const raw = "1985年5月12日\n場所: 常盤公園\n参加者: 18人\n生きもの: ヤツデ、カワセミ、メダカ\n記録者: 山田太郎 090-1234-5678";
  const parsed = extractPaperArchivePageFields(raw);
  assert.equal(parsed.observedYear, 1985);
  assert.equal(parsed.observedDate, "1985-05-12");
  assert.equal(parsed.placeName, "常盤公園");
  assert.equal(parsed.participantCount, 18);
  assert.deepEqual(parsed.speciesList, ["ヤツデ", "カワセミ", "メダカ"]);

  const redacted = redactPaperPersonalInfo(raw);
  assert.doesNotMatch(redacted, /090-1234-5678/);
  assert.match(redacted, /\[個人名保護\]/);
});

test("renderPaperArchiveTimelineHtml places original paper image alongside extracted place x year timeline and corrector name", () => {
  const html = renderPaperArchiveTimelineHtml([
    {
      page_id: "pap_1",
      place_id: "plc_e3293ec4bb9288a0",
      place_name: "常盤公園",
      observed_year: 1985,
      observed_date: "1985-05-12",
      source_image_url: "https://zukan.earth/archive/page1.webp",
      species_json: JSON.stringify(["ヤツデ", "カワセミ"]),
      participant_count: 18,
      is_rare_species: 0,
      face_redacted: 1,
      publish_status: "published",
      created_by_user_id: "u1",
      last_corrected_by: "鈴木会員",
      correction_count: 1,
      created_at: 1
    }
  ]);
  assert.match(html, /紙の記録・過去の年表（場所×年）/);
  assert.match(html, /src="https:\/\/zukan\.earth\/archive\/page1\.webp"/);
  assert.match(html, /1985年（1985-05-12） · 常盤公園/);
  assert.match(html, /ヤツデ、カワセミ/);
  assert.match(html, /参加人数: 18人/);
  assert.match(html, /声の修正: 鈴木会員/);
});
