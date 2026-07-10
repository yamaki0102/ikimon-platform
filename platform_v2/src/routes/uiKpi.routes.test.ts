import assert from "node:assert/strict";
import test from "node:test";
import { isUiKpiEventName } from "../services/uiKpi.js";

test("ui KPI validation accepts record funnel event names", () => {
  assert.equal(isUiKpiEventName("funnel_step"), true);
  assert.equal(isUiKpiEventName("funnel_error"), true);
  assert.equal(isUiKpiEventName("record_start_from_area_route"), true);
  assert.equal(isUiKpiEventName("record_context_media_added"), true);
  assert.equal(isUiKpiEventName("record_context_unknown_name_selected"), true);
  assert.equal(isUiKpiEventName("record_context_note_only_selected"), true);
  assert.equal(isUiKpiEventName("record_abandon_from_area_route"), true);
  assert.equal(isUiKpiEventName("location_permission_declined_from_area_route"), true);
  assert.equal(isUiKpiEventName("sensitive_location_warning_view"), true);
  assert.equal(isUiKpiEventName("record_complete_from_area_route"), true);
  assert.equal(isUiKpiEventName("post_record_local_return_view"), true);
  assert.equal(isUiKpiEventName("post_record_area_guide_click"), true);
  assert.equal(isUiKpiEventName("post_record_next_place_click"), true);
  assert.equal(isUiKpiEventName("post_record_revisit_click"), true);
  assert.equal(isUiKpiEventName("post_record_return_bounce"), true);
  assert.equal(isUiKpiEventName("record_start_from_municipal_walk_map"), true);
  assert.equal(isUiKpiEventName("record_context_walk_map_media_added"), true);
  assert.equal(isUiKpiEventName("record_context_walk_map_unknown_name_selected"), true);
  assert.equal(isUiKpiEventName("record_context_walk_map_note_only_selected"), true);
  assert.equal(isUiKpiEventName("record_abandon_from_municipal_walk_map"), true);
  assert.equal(isUiKpiEventName("location_permission_declined_from_municipal_walk_map"), true);
  assert.equal(isUiKpiEventName("record_complete_from_municipal_walk_map"), true);
});

test("ui KPI validation accepts map UX event names", () => {
  assert.equal(isUiKpiEventName("map_area_detail_open"), true);
  assert.equal(isUiKpiEventName("map_area_route_sheet_open"), true);
  assert.equal(isUiKpiEventName("map_area_route_sheet_error"), true);
  assert.equal(isUiKpiEventName("area_route_sheet_cta_click"), true);
  assert.equal(isUiKpiEventName("unsafe_area_cta_suppressed"), true);
  assert.equal(isUiKpiEventName("selected_place_cta_click"), true);
});

test("ui KPI validation rejects unknown event names", () => {
  assert.equal(isUiKpiEventName("record_open"), false);
  assert.equal(isUiKpiEventName(""), false);
});
