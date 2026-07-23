import assert from "node:assert/strict";
import test from "node:test";
import { isUiKpiEventName } from "../services/uiKpi.js";

test("ui KPI validation accepts record funnel event names", () => {
  assert.equal(isUiKpiEventName("funnel_step"), true);
  assert.equal(isUiKpiEventName("funnel_error"), true);
});

test("ui KPI validation accepts map UX event names", () => {
  assert.equal(isUiKpiEventName("map_area_detail_open"), true);
  assert.equal(isUiKpiEventName("place_profile_open"), true);
  assert.equal(isUiKpiEventName("place_theme_open"), true);
  assert.equal(isUiKpiEventName("place_image_error"), true);
  assert.equal(isUiKpiEventName("place_search_complete"), true);
  assert.equal(isUiKpiEventName("selected_place_cta_click"), true);
});

test("ui KPI validation rejects unknown event names", () => {
  assert.equal(isUiKpiEventName("record_open"), false);
  assert.equal(isUiKpiEventName(""), false);
});
