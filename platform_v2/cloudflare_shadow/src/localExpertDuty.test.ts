import assert from "node:assert/strict";
import test from "node:test";
import { renderHumanExpertCommentHtml, shouldRouteToExpertDuty } from "./localExpertDuty";

test("shouldRouteToExpertDuty routes only rare, AI-uncertain, or suspected-invasive records", () => {
  assert.deepEqual(shouldRouteToExpertDuty({}), { route: false, reasonKind: null });
  assert.deepEqual(shouldRouteToExpertDuty({ isRareSpecies: true }), { route: true, reasonKind: "rare_species" });
  assert.deepEqual(shouldRouteToExpertDuty({ isAiUncertain: true }), { route: true, reasonKind: "ai_uncertain" });
  assert.deepEqual(shouldRouteToExpertDuty({ isSuspectedInvasive: true }), { route: true, reasonKind: "suspected_invasive" });
});

test("renderHumanExpertCommentHtml displays expert voice comment under 人のコメント", () => {
  const html = renderHumanExpertCommentHtml([
    {
      duty_id: "duty_1",
      record_id: "rec_1",
      place_id: "plc_1",
      reason_kind: "rare_species",
      is_rare_species: 1,
      exact_lat: 34.7,
      exact_lng: 137.7,
      status: "answered",
      due_at: 2,
      expert_user_id: "exp_u1",
      expert_name: "佐藤学芸員",
      human_comment: "冬の湿地で見られる在来の希少種です。場所は伏せて見守りましょう。",
      responded_at: 1,
      created_at: 0
    }
  ]);
  assert.match(html, /人のコメント/);
  assert.match(html, /佐藤学芸員/);
  assert.match(html, /冬の湿地で見られる在来の希少種です/);
});
