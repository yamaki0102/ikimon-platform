import assert from "node:assert/strict";
import test from "node:test";
import { getSchool45MinTemplate, renderGuidePublicPage } from "./guideBookingDesk";

test("getSchool45MinTemplate returns 45-min school structure and renderGuidePublicPage avoids association endorsement claims", () => {
  const tpl = getSchool45MinTemplate("4年", "季節と生きもの");
  assert.equal(tpl.grade, "4年");
  assert.equal(tpl.timeline.length, 4);

  const html = renderGuidePublicPage(
    {
      guide_id: "guide_1",
      user_id: "u_guide_1",
      display_name: "鈴木案内人",
      specialties_json: JSON.stringify(["水辺の生きもの", "野鳥"]),
      places_json: JSON.stringify(["常盤公園", "校庭"]),
      is_nacsj_instructor: 1,
      verified_expert_count: 14,
      publish_status: "published",
      updated_at: 1
    },
    {
      supportSeats: [{ sponsor_name: "みなと文具店", equipment_note: "双眼鏡3台" }],
      cspNonce: "n1"
    }
  );
  assert.match(html, /鈴木案内人/);
  assert.match(html, /属性: NACS-J自然観察指導員/);
  assert.match(html, /学校の45分の型/);
  assert.match(html, /みなと文具店/);
  assert.doesNotMatch(html, /公認/);
});
