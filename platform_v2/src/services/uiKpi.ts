import { getPool } from "../db.js";

const EVENT_NAMES = new Set([
  "first_action",
  "task_completion",
  "section_view",
  "read_depth",
  "primary_cta_click",
  "map_area_detail_open",
  "map_area_route_sheet_open",
  "map_area_route_sheet_error",
  "area_route_sheet_cta_click",
  "unsafe_area_cta_suppressed",
  "record_start_from_area_route",
  "record_context_media_added",
  "record_context_unknown_name_selected",
  "record_context_note_only_selected",
  "record_abandon_from_area_route",
  "location_permission_declined_from_area_route",
  "sensitive_location_warning_view",
  "record_complete_from_area_route",
  "post_record_local_return_view",
  "post_record_area_guide_click",
  "post_record_next_place_click",
  "post_record_revisit_click",
  "post_record_return_bounce",
  "record_start_from_municipal_walk_map",
  "record_context_walk_map_media_added",
  "record_context_walk_map_unknown_name_selected",
  "record_context_walk_map_note_only_selected",
  "record_abandon_from_municipal_walk_map",
  "location_permission_declined_from_municipal_walk_map",
  "record_complete_from_municipal_walk_map",
  "selected_place_cta_click",
  "funnel_step",
  "funnel_error",
] as const);
const OBSERVATION_EVENT_NAMES = new Set([
  "section_view",
  "read_depth",
  "primary_cta_click",
  "map_area_detail_open",
  "map_area_route_sheet_open",
  "map_area_route_sheet_error",
  "area_route_sheet_cta_click",
  "unsafe_area_cta_suppressed",
  "selected_place_cta_click",
] as const);
const RECORD_FUNNEL_EVENT_NAMES = new Set(["funnel_step", "funnel_error"] as const);
const AREA_ROUTE_RECORD_EVENT_NAMES = new Set([
  "record_start_from_area_route",
  "record_context_media_added",
  "record_context_unknown_name_selected",
  "record_context_note_only_selected",
  "record_abandon_from_area_route",
  "location_permission_declined_from_area_route",
  "sensitive_location_warning_view",
  "record_complete_from_area_route",
  "post_record_local_return_view",
  "post_record_area_guide_click",
  "post_record_next_place_click",
  "post_record_revisit_click",
  "post_record_return_bounce",
  "record_start_from_municipal_walk_map",
  "record_context_walk_map_media_added",
  "record_context_walk_map_unknown_name_selected",
  "record_context_walk_map_note_only_selected",
  "record_abandon_from_municipal_walk_map",
  "location_permission_declined_from_municipal_walk_map",
  "record_complete_from_municipal_walk_map",
]);

type UiKpiEventName =
  | "first_action"
  | "task_completion"
  | "section_view"
  | "read_depth"
  | "primary_cta_click"
  | "map_area_detail_open"
  | "map_area_route_sheet_open"
  | "map_area_route_sheet_error"
  | "area_route_sheet_cta_click"
  | "unsafe_area_cta_suppressed"
  | "record_start_from_area_route"
  | "record_context_media_added"
  | "record_context_unknown_name_selected"
  | "record_context_note_only_selected"
  | "record_abandon_from_area_route"
  | "location_permission_declined_from_area_route"
  | "sensitive_location_warning_view"
  | "record_complete_from_area_route"
  | "post_record_local_return_view"
  | "post_record_area_guide_click"
  | "post_record_next_place_click"
  | "post_record_revisit_click"
  | "post_record_return_bounce"
  | "record_start_from_municipal_walk_map"
  | "record_context_walk_map_media_added"
  | "record_context_walk_map_unknown_name_selected"
  | "record_context_walk_map_note_only_selected"
  | "record_abandon_from_municipal_walk_map"
  | "location_permission_declined_from_municipal_walk_map"
  | "record_complete_from_municipal_walk_map"
  | "selected_place_cta_click"
  | "funnel_step"
  | "funnel_error";

type RecordUiKpiEventInput = {
  eventName: UiKpiEventName;
  eventSource: "web" | "api";
  pagePath?: string | null;
  routeKey?: string | null;
  actionKey?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown>;
};

type RecordUiKpiEventResult = {
  eventId: string;
};

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, maxLength);
}

export function isUiKpiEventName(value: unknown): value is UiKpiEventName {
  return typeof value === "string" && EVENT_NAMES.has(value as UiKpiEventName);
}

export async function recordUiKpiEvent(input: RecordUiKpiEventInput): Promise<RecordUiKpiEventResult> {
  const pool = getPool();
  const tableName = RECORD_FUNNEL_EVENT_NAMES.has(input.eventName as "funnel_step" | "funnel_error")
    || AREA_ROUTE_RECORD_EVENT_NAMES.has(input.eventName)
    ? "record_ui_kpi_events"
    : OBSERVATION_EVENT_NAMES.has(input.eventName as "section_view" | "read_depth" | "primary_cta_click")
      ? "observation_ui_kpi_events"
      : "ui_kpi_events";
  const result = await pool.query<{ event_id: string }>(
    `insert into ${tableName} (
       event_name,
       event_source,
       page_path,
       route_key,
       action_key,
       user_id,
       metadata
     )
     values ($1, $2, $3, $4, $5, $6, $7::jsonb)
     returning event_id`,
    [
      input.eventName,
      input.eventSource,
      normalizeText(input.pagePath, 256),
      normalizeText(input.routeKey, 256),
      normalizeText(input.actionKey, 128),
      normalizeText(input.userId, 128),
      JSON.stringify(input.metadata ?? {}),
    ],
  );

  return {
    eventId: result.rows[0]?.event_id ?? "",
  };
}
