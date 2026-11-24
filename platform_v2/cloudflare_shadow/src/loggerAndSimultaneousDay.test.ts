import assert from "node:assert/strict";
import test from "node:test";
import { renderSimultaneousDayMapHtml } from "./loggerAndSimultaneousDay";

test("renderSimultaneousDayMapHtml renders national map entries and hides rare species locations", () => {
  const html = renderSimultaneousDayMapHtml(
    "2026-11-23",
    [
      {
        entry_id: "sde_1",
        day_key: "2026-11-23",
        place_id: "plc_1",
        place_label: "常盤公園",
        coarse_cell: "34.7,137.7",
        answer_1: "澄んでいる",
        answer_2: "12輪",
        answer_3: "あり",
        is_rare_species: 0,
        created_by_user_id: "u1",
        created_at: 1
      },
      {
        entry_id: "sde_2",
        day_key: "2026-11-23",
        place_id: "",
        place_label: "広域（希少種保護のため位置非公開）",
        coarse_cell: "hidden",
        answer_1: "澄んでいる",
        answer_2: "2輪",
        answer_3: "あり",
        is_rare_species: 1,
        created_by_user_id: "u2",
        created_at: 2
      }
    ],
    "n1"
  );
  assert.match(html, /全国一斉の日（2026-11-23）· 参加地点 2件/);
  assert.match(html, /常盤公園/);
  assert.match(html, /広域（希少種保護のため位置非公開）/);
});
