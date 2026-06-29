import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";
import { deflateSync } from "node:zlib";
import * as bcrypt from "bcryptjs";
import { worker } from "./index";

type D1Value = string | number | null;
const INTERNAL_AUTH_TOKEN = "test-internal-token";

interface DraftRow {
  draft_id: string;
  owner_user_id: string;
  observed_at: string | null;
  partition_month: string | null;
  exact_lat: number | null;
  exact_lng: number | null;
  location_accuracy_m: number | null;
  public_cell: string;
  visibility: string;
  processing_state: string;
  finalized_at: string | null;
}

interface ObservationRow {
  observation_id: string;
  draft_id: string;
  owner_user_id: string;
  observed_at: string;
  partition_month: string | null;
  taxon_label: string | null;
  note: string | null;
  exact_lat: number | null;
  exact_lng: number | null;
  location_accuracy_m: number | null;
  public_cell: string;
  visibility: string;
  emergency_hidden: number;
  processing_state: string;
  organism_origin?: string | null;
}

interface ObservationDetailEditEventRow {
  edit_id: string;
  observation_id: string;
  actor_user_id: string;
  edit_kind: string;
  payload_json: string;
}

interface ObservationEnvironmentRecordRow {
  record_id: string;
  occurrence_id: string;
  lat: number;
  lng: number;
  structured_json: string;
  source_lang: string;
}

interface ObservationReactionRow {
  reaction_id: string;
  occurrence_id: string;
  user_id: string;
  reaction_type: string;
  created_at: string;
}

interface ObservationIdentificationRow {
  identification_id: string;
  occurrence_id: string;
  actor_user_id: string;
  proposed_name: string;
  proposed_rank: string | null;
  stance: string;
  notes: string | null;
  source_key: string;
  source_payload_json: string;
  is_current: number;
  created_at: string;
  updated_at: string;
}

interface ObservationIdentificationDisputeRow {
  dispute_id: string;
  occurrence_id: string;
  actor_user_id: string;
  kind: string;
  proposed_name: string | null;
  proposed_rank: string | null;
  reason: string | null;
  status: string;
  source_payload_json: string;
  resolved_by_user_id?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface ObservationAiReviewTargetRow {
  occurrence_id: string;
  ai_assessment_status: string | null;
  scientific_name: string | null;
  vernacular_name: string | null;
  taxon_rank: string | null;
  ai_run_id: string | null;
  candidate_id: string | null;
  candidate_scientific_name: string | null;
  candidate_vernacular_name: string | null;
  candidate_taxon_rank: string | null;
  ai_recommended_taxon_name: string | null;
  ai_recommended_rank: string | null;
}

interface ObservationRecordAiReviewRow {
  review_id: string;
  occurrence_id: string;
  ai_run_id: string | null;
  candidate_id: string | null;
  actor_user_id: string;
  review_state: string;
  source_payload_json: string;
  created_at: string;
  updated_at: string;
}

interface ObservationSpecialistReviewRow {
  review_id: string;
  occurrence_id: string;
  actor_user_id: string;
  lane: string;
  decision: string;
  proposed_name: string | null;
  proposed_rank: string | null;
  accepted_rank: string | null;
  notes: string | null;
  review_class: string;
  source_payload_json: string;
  created_at: string;
  updated_at: string;
}

interface PlaceManagementPolicyRow {
  place_id: string;
  user_id: string;
  management_goal: string;
  weed_tolerance: string;
  invasive_response: string;
  mowing_frequency: string;
  notes: string | null;
  policy_json: string;
  updated_at: string;
}

interface PlaceMemoryEntryTestRow {
  entry_id: string;
  visit_id: string;
  occurrence_id: string;
  user_id: string;
  cell_id: string;
  cell_grid_m: number;
  memory_tags_json: string;
  tags_public: number;
  echo_note: string;
  private_note: string;
  photo_echo_enabled: number;
  photo_echo_visibility: string;
  moderation_status: string;
  source_payload_json: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface PlaceMemoryPreferenceTestRow {
  user_id: string;
  default_photo_echo_enabled: number;
  default_tags_public: number;
  updated_at: string;
}

interface ReferenceSourceTestRow {
  source_id: string;
  title: string;
  author_text: string;
  publisher: string;
  publication_year: number | null;
  isbn: string;
  doi: string;
  url: string;
  source_kind: string;
  catalog_status: string;
  taxon_labels_json: string;
  commerce_links_json: string;
  created_by_user_id: string | null;
  source_payload_json: string;
  created_at: string;
  updated_at: string;
}

interface ReferenceAccessProofTestRow {
  proof_id: string;
  user_id: string;
  source_id: string;
  batch_id: string | null;
  proof_kind: string;
  verification_status: string;
  private_use_only: number;
  source_payload_json: string;
  created_at: string;
  updated_at: string;
}

interface ReferenceCorrectionTestRow {
  correction_id: string;
  source_id: string;
  locator: string;
  original_name: string;
  corrected_name: string;
  original_taxon_name: string;
  corrected_taxon_name: string;
  correction_kind: string;
  official_source_url: string;
  official_reference: string;
  verification_status: string;
  verified_by_user_id: string | null;
  applies_from: string | null;
  source_payload_json: string;
  created_at: string;
  updated_at: string;
}

interface AssetRow {
  asset_id: string;
  draft_id: string;
  observation_id: string | null;
  owner_user_id: string;
  object_key: string;
  partition_month: string | null;
  sha256: string | null;
  mime: string;
  bytes: number;
  processing_state: string;
  public_derivative_key: string | null;
  public_derivative_sha256: string | null;
  public_derivative_verified_at: string | null;
  public_derivative_metadata_json: string | null;
  exif_scrub_state: string;
  public_ready_at: string | null;
}

interface OutboxRow {
  outbox_id: string;
  topic: "media.process" | "readmodel.refresh";
  target_id: string;
  payload_json: string;
  partition_month: string | null;
  dispatch_state: "pending" | "dispatched";
  attempts: number;
  last_error: string | null;
}

interface RollbackLedgerRow {
  ledger_id: string;
  event_type: string;
  target_id: string;
  partition_month: string | null;
  source_endpoint: string;
  payload_json: string;
  replay_sql: string;
  replay_status: string;
  created_at: string;
}

interface ParityRunRow {
  run_id: string;
  source_db: string;
  collected_at: string;
  table_count: number;
  critical_json: string;
  orphan_json: string;
  note: string | null;
}

interface ParityMetricRow {
  run_id: string;
  metric_type: string;
  metric_key: string;
  metric_value: string;
  detail_json: string | null;
}

interface AuthSessionRow {
  token_hash: string;
  user_id: string;
  display_name: string;
  role_name: string;
  rank_label: string | null;
  banned: number;
  expires_at: string;
  last_used_at: string | null;
}

interface ContactSubmissionRow {
  submission_id: string;
  category: string;
  name: string | null;
  email: string | null;
  organization: string | null;
  message: string;
  ip_hash: string | null;
  user_id: string | null;
  notification_sent: number;
  auto_reply_sent: number;
  send_error: string | null;
  created_at: string;
}

interface UserProfileRow {
  user_id: string;
  display_name: string;
  profile_bio: string;
  expertise: string;
  avatar_object_key: string | null;
  avatar_mime: string | null;
  avatar_bytes: number | null;
  avatar_sha256: string | null;
}

interface RememberTokenRow {
  token_hash: string;
  user_id: string;
  token_family: string;
  user_agent: string | null;
  ip_address: string | null;
  expires_at: string;
}

interface ContactProofNonceRow {
  nonce_hash: string;
  issued_at_ms: number;
  ip_hash: string | null;
}

interface ObservationDataRightsRow {
  visit_id: string;
  occurrence_id: string | null;
  record_consent: string;
  research_use_consent: string;
  enterprise_report_consent: string;
  dataset_license: string | null;
  media_license: string | null;
  external_export_allowed: number;
  withdrawal_status: string;
  source_payload_json: string;
}

interface CivicObservationContextRow {
  context_id: string;
  visit_id: string;
  occurrence_id: string | null;
  context_kind: string;
  activity_label: string | null;
  activity_intent: string | null;
  participant_role: string | null;
  audience_scope: string;
  public_precision: string;
  risk_lane: string;
  report_consent: string;
  revisit_of_visit_id: string | null;
  field_id: string | null;
  route_id: string | null;
  plot_id: string | null;
  source_payload_json: string;
}

interface WaterbodyRow {
  ikimon_waterbody_id: string;
  waterbody_type: string;
  parent_waterbody_id: string | null;
  public_label: string;
  source: string;
  source_version: string;
  geometry_precision: string;
  source_payload_json: string;
}

interface WaterRecordExtensionRow {
  visit_id: string;
  occurrence_id: string | null;
  waterbody_id: string | null;
  catch_outcome: string;
  capture_method: string | null;
  participant_count: number | null;
  effort_minutes: number | null;
  target_taxa_scope: string | null;
  released_count: number | null;
  kept_count: number | null;
  public_waterbody_label: string | null;
  environment_snapshot_json: string;
  source_payload_json: string;
}

interface StewardshipActionRow {
  action_id: string;
  place_id: string;
  occurred_at: string;
  action_kind: string;
  actor_user_id: string;
  linked_visit_id: string | null;
  description: string | null;
  species_status: string | null;
  metadata_json: string;
}

interface OperationAuditRow {
  audit_id: string;
  operation_type: string;
  target_id: string;
  payload_json: string;
  created_at: string;
}

interface VideoUploadRow {
  stream_uid: string;
  actor_id: string;
  observation_id: string | null;
  upload_status: string;
  max_duration_seconds: number;
  filename: string | null;
  upload_protocol: string;
  object_key: string | null;
  bytes: number;
  duration_ms: number;
  ready_to_stream: number;
  created_at: string;
  uploaded_at: string | null;
}

interface LegacyAssetImportRow {
  asset_id: string | null;
  import_status: string;
  asset_role: string;
}

interface LegacyR2ImportRow {
  asset_id: string;
  import_status: string;
  uploaded_bytes?: number;
  expected_bytes?: number;
  verified_bytes?: number;
  uploaded_sha256?: string;
  expected_sha256?: string;
  verified_sha256?: string;
}

interface LegacyStreamInventoryRow {
  stream_uid: string;
  asset_id: string;
  visit_id: string;
  exists_on_stream: number;
  ready_to_stream: number;
  status_state: string | null;
  modified_at_stream: string | null;
}

interface ProductionImportPublicReadmodelRow {
  visit_id: string;
  asset_count: number;
  public_ready_asset_count: number;
  unresolved_asset_count: number;
}

interface ProductionImportVisitRow {
  visit_id: string;
  legacy_observation_id: string | null;
  place_id?: string | null;
  user_id: string | null;
  public_visibility: string | null;
  observed_at: string | null;
  coordinate_uncertainty_m?: number | null;
}

interface ProductionImportOccurrenceRow {
  occurrence_id: string;
  visit_id: string | null;
  scientific_name: string | null;
  vernacular_name: string | null;
  taxon_rank: string | null;
  confidence_score?: number | null;
  quality_grade?: string | null;
  created_at: string | null;
}

interface ProductionImportEvidenceAssetRow {
  asset_id: string;
  blob_id?: string | null;
  visit_id?: string | null;
  occurrence_id?: string | null;
  asset_role?: string | null;
  captured_at?: string | null;
  created_at?: string | null;
  legacy_relative_path?: string | null;
}

interface RecordReadingCardRow {
  card_id: string;
  visit_id: string;
  axis: string;
  title: string;
  body: string;
  sources_json: string;
  visibility: "owner_only" | "public" | "hidden";
  generation_condition_json: string;
  quality_gate_json: string;
  model_version: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ManagementCandidateConfirmationRow {
  confirmation_id: string;
  observation_id: string;
  candidate_index: number;
  confirm_state: string;
  actor_user_id: string;
  source_payload_json: string;
  created_at: string;
  updated_at: string;
}

interface ObservationReassessmentRequestRow {
  request_id: string;
  observation_id: string;
  request_kind: string;
  actor_user_id: string;
  request_state: string;
  source_payload_json: string;
  created_at: string;
  updated_at: string;
}

interface CandidateActionRequestRow {
  request_id: string;
  observation_id: string;
  candidate_id: string;
  action_kind: string;
  actor_user_id: string;
  request_state: string;
  source_payload_json: string;
  created_at: string;
  updated_at: string;
}

interface GuideRecordPromotionRequestRow {
  request_id: string;
  guide_record_id: string;
  actor_user_id: string;
  request_state: string;
  source_payload_json: string;
  created_at: string;
  updated_at: string;
}

interface ProductionFieldDetailReadmodelRow {
  field_id: string;
  source: string;
  admin_level: string | null;
  name: string;
  name_kana: string | null;
  summary: string | null;
  prefecture: string | null;
  city: string | null;
  public_cell: string;
  public_lat: number;
  public_lng: number;
  radius_m: number | null;
  area_ha: number | null;
  has_polygon: number;
  has_simplified_geometry: number;
  certification_id: string | null;
  certification_url: string | null;
  official_url: string | null;
  owner_url: string | null;
  story_url: string | null;
  verification_level: string | null;
  verification_method: string | null;
  verification_label: string | null;
  source_confidence: number | null;
  valid_from: string | null;
  valid_to: string | null;
  entity_key: string | null;
  updated_at: string | null;
}

interface UserObservationFieldTestRow {
  field_id: string;
  owner_user_id: string;
  source: string;
  name: string;
  name_kana: string;
  summary: string;
  prefecture: string;
  city: string;
  public_cell: string;
  public_lat: number;
  public_lng: number;
  radius_m: number;
  area_ha: number | null;
  payload_json: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface SourceSnapshotTestRow {
  snapshot_id: string;
  source_kind: string;
  source_url: string;
  content_sha256: string;
  content_bytes: number;
  storage_backend: string;
  storage_path: string;
  license: string;
  notes: string;
}

interface PlaceEnvironmentSnapshotTestRow {
  snapshot_id: string;
  place_id: string;
  metric_kind: string;
  metric_value: number;
  metric_unit: string;
  observed_on: string;
  source_snapshot_id: string;
  valid_from: string;
  valid_to: string | null;
  superseded_by: string | null;
  metadata: string;
}

interface FieldManagerGrantTestRow {
  manager_id: string;
  field_id: string;
  user_id: string;
  role: string;
  granted_at: string;
  granted_by: string | null;
  expires_at: string | null;
  note: string;
  updated_at: string;
}

interface ProductionAreaPolygonReadmodelRow {
  field_id: string;
  source: string;
  admin_level: string | null;
  name: string;
  prefecture: string | null;
  city: string | null;
  center_lat: number;
  center_lng: number;
  bbox_min_lat: number;
  bbox_max_lat: number;
  bbox_min_lng: number;
  bbox_max_lng: number;
  area_ha: number | null;
  geometry_json: string;
  approximate_boundary: number;
  boundary_approximation: string | null;
  source_confidence: number | null;
  verification_level: string | null;
  verification_label: string | null;
  official_url: string | null;
  owner_url: string | null;
  story_url: string | null;
  certification_url: string | null;
  entity_key: string | null;
  updated_at: string | null;
}

function productionAreaPolygonRow(
  fieldId: string,
  overrides: Partial<ProductionAreaPolygonReadmodelRow> = {}
): ProductionAreaPolygonReadmodelRow {
  return {
    field_id: fieldId,
    source: "school",
    admin_level: "school",
    name: fieldId,
    prefecture: "静岡県",
    city: "浜松市",
    center_lat: 34.695,
    center_lng: 137.705,
    bbox_min_lat: 34.69,
    bbox_max_lat: 34.70,
    bbox_min_lng: 137.70,
    bbox_max_lng: 137.71,
    area_ha: 1.1,
    geometry_json: JSON.stringify({
      type: "Polygon",
      coordinates: [[[137.700, 34.690], [137.710, 34.691], [137.709, 34.699], [137.700, 34.690]]]
    }),
    approximate_boundary: 0,
    boundary_approximation: null,
    source_confidence: 0.9,
    verification_level: "registry_matched",
    verification_label: "公開情報と一致",
    official_url: "https://example.test/field",
    owner_url: null,
    story_url: null,
    certification_url: null,
    entity_key: `field:${fieldId}`,
    updated_at: "2026-06-18T00:00:00.000Z",
    ...overrides
  };
}

interface AuthUserRow {
  user_id: string;
  email: string;
  password_hash: string | null;
  display_name: string;
  role_name: string | null;
  rank_label: string | null;
  banned: number;
  last_login_at: string | null;
}

interface OAuthAccountRow {
  user_id: string;
  provider: string;
  provider_user_id: string;
  provider_email: string | null;
  display_name: string;
  role_name: string | null;
  rank_label: string | null;
  banned: number;
  profile_json: string;
  linked_at: string | null;
}

interface AreaSubscriptionRow {
  subscription_id: string;
  user_id: string;
  target_type: string;
  target_id: string;
  label: string;
  href: string;
  is_active: number;
  created_at: string | null;
  updated_at: string | null;
}

interface AreaSubscriptionStatsRow {
  user_id: string;
  target_type: string;
  target_id: string;
  observation_count: number;
  needs_id_count: number;
}

interface AlertDeliveryRow {
  delivery_id: string;
  occurrence_id: string;
  user_id: string | null;
  recipient_id?: string | null;
  subscription_id?: string | null;
  trigger_kind: string;
  channel: string;
  delivered_at: string | null;
  delivery_status: string;
  error_message?: string | null;
  payload_json: string;
  acknowledged_at: string | null;
  created_at: string | null;
}

interface AlertRecipientRow {
  recipient_id: string;
  recipient_type: string;
  display_name: string;
  email: string | null;
  is_active: number;
  rate_limit_per_day: number;
}

interface UserNotificationPreferenceRow {
  user_id: string;
  email_enabled: number;
  digest_hour_local: number;
  unsubscribe_token: string;
  locale: string;
  updated_at: string | null;
}

interface InvasiveReportingEventRow {
  event_id: string;
  occurrence_id: string | null;
  recipient_id: string | null;
  delivery_id: string | null;
  event_status: string;
  trigger_source: string;
  payload_json: string;
  error_message: string | null;
  created_at: string;
}

interface TaxonAlertSubscriptionRow {
  subscription_id: string;
  user_id: string;
  scientific_name: string | null;
  taxon_rank: string | null;
  match_field: string;
  trigger_invasive_only: number;
  trigger_rare_only: number;
  channel: string;
  label: string;
  is_active: number;
  created_at: string | null;
}

interface MunicipalWalkMapD1Row {
  walk_map_id: string;
  municipality_code: string;
  municipality: string;
  title: string;
  summary: string;
  theme: string;
  publish_mode: string;
  route_style: string;
  mobility_modes_json: string;
  stop_count: number;
  source_references_json: string;
  area_hint_json: string;
  display_order: number;
  creator_name?: string | null;
  creator_profile_json?: string | null;
  route_flexibility_json?: string | null;
  public_precision_policy?: string | null;
  claim_boundary_json?: string | null;
  publication_review_json?: string | null;
  updated_at?: string | null;
}

interface MunicipalWalkMapCreatorRow {
  creator_id: string;
  display_name: string;
  registration_kind: string | null;
  verification_status: string;
  commercial_intent: string | null;
  notes: string | null;
  updated_at: string | null;
}

interface MunicipalWalkMapStopRow {
  stop_id: string;
  walk_map_id: string;
  display_order: number;
  title: string;
  note: string | null;
  area_hint_json: string;
  position: number;
  area_kind: string;
  access: string;
  estimated_minutes?: number | null;
  notice_cues_json?: string | null;
  record_cues_json?: string | null;
  safety_notes_json?: string | null;
  safety_note?: string | null;
}

interface MunicipalWalkMapAuditRow {
  audit_id: string;
  walk_map_id: string;
  action: string;
  actor_label: string;
  payload_json: string;
  actor_user_id: string | null;
  before_payload_json: string;
  after_payload_json: string;
}

interface WalkSessionRow {
  walk_session_id: string;
  external_id: string | null;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  distance_m: number | null;
  step_count: number | null;
  passive_detection_count: number;
  top_species_json: string;
  biome: string | null;
  source: string;
  raw_payload_json: string;
  created_at: string;
  updated_at: string;
}

interface TrackSessionRow {
  visit_id: string;
  session_id: string;
  user_id: string;
  field_id: string | null;
  place_id: string;
  started_at: string;
  updated_at: string;
  distance_meters: number | null;
  step_count: number | null;
  first_lat: number;
  first_lng: number;
  municipality: string | null;
  prefecture: string | null;
  source_payload_json: string;
  created_at: string;
}

interface TrackPointRow {
  point_id: string;
  visit_id: string;
  observed_at: string;
  sequence_no: number;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  altitude_m: number | null;
  raw_payload_json: string;
}

interface PublicMapSnapshotRecordRow {
  occurrence_id?: string;
  visit_id: string;
  cell_1000: string;
  observed_at: string;
  display_name: string | null;
  asset_count: number;
}

interface PublicMapSnapshotMetaRow {
  snapshot_key: string;
  generated_at: string;
  source_sample_size: number;
  public_record_count: number;
  refreshed_by: string | null;
  policy_json: string;
}

interface ObservationEventSessionTestRow {
  session_id: string;
  legacy_event_id: string | null;
  event_code: string | null;
  title: string;
  organizer_user_id: string;
  corporation_id: string | null;
  plan: string;
  primary_mode: string;
  active_modes_json: string;
  location_lat: number | null;
  location_lng: number | null;
  location_radius_m: number;
  started_at: string;
  ended_at: string | null;
  target_species_json: string;
  config_json: string;
  field_id: string | null;
  template_source_session_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ObservationEventParticipantTestRow {
  participant_id: string;
  session_id: string;
  user_id: string | null;
  guest_token: string | null;
  display_name: string;
  team_id: string | null;
  role: string;
  declared_job: string | null;
  status: string;
  checked_in_at: string | null;
  share_location: number;
  is_minor: number;
  location_share_until: string | null;
  location_share_consent_type: string | null;
  created_at: string;
  updated_at: string;
}

interface ObservationEventLiveTestRow {
  live_event_id: string;
  session_id: string;
  type: string;
  scope: string;
  actor_user_id: string | null;
  actor_guest_token: string | null;
  team_id: string | null;
  payload_json: string;
  created_at: string;
}

interface ObservationEventTeamTestRow {
  team_id: string;
  session_id: string;
  name: string;
  color: string;
  lead_user_id: string | null;
  target_taxa_json: string;
  created_at: string;
}

interface ObservationEventMeshTestRow {
  mesh_cell_id: string;
  session_id: string;
  mesh_key: string;
  center_lat: number;
  center_lng: number;
  visit_seconds: number;
  observation_count: number;
  absence_count: number;
  last_visited_at: string | null;
  visited_team_ids_json: string;
  updated_at: string;
}

interface ObservationEventCapsuleTestRow {
  capsule_id: string;
  session_id: string;
  source_counts_json: string;
  source_clusters_json: string;
  private_digest_json: string;
  public_story_draft_json: string;
  record_candidates_json: string;
  privacy_risk_queue_json: string;
  readiness_json: string;
  source_hash: string;
  model_metadata_json: string;
  review_status: string;
  generated_by: string | null;
  generated_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  updated_at: string;
}

interface ObservationEventQuestTestRow {
  quest_id: string;
  session_id: string;
  team_id: string | null;
  participant_id: string | null;
  status: string;
  payload_json: string;
  created_at: string;
  updated_at: string;
}

interface PassiveAudioIngestEventTestRow {
  ingest_event_id: string;
  dedupe_key: string;
  source_type: string;
  source_id: string;
  source_name: string;
  site_id: string;
  species_label: string;
  scientific_name: string | null;
  confidence: number;
  model_id: string | null;
  model_version: string | null;
  tier15_candidate: number;
  normalized_event_json: string;
  provenance_json: string;
  visit_id: string | null;
  occurrence_id: string | null;
  audio_segment_id: string | null;
}

interface FieldscanAudioSegmentTestRow {
  segment_id: string;
  external_id: string | null;
  session_id: string;
  user_id: string | null;
  visit_id: string | null;
  place_id: string | null;
  recorded_at: string;
  duration_sec: number;
  lat: number | null;
  lng: number | null;
  azimuth: number | null;
  storage_key: string | null;
  storage_provider: string;
  mime_type: string;
  bytes: number;
  privacy_status: string;
  voice_flag: number;
  fingerprint_json: string;
  meta_json: string;
  transcription_status: string;
  created_at: string;
  updated_at: string;
}

interface FieldscanAudioDetectionTestRow {
  detection_id: string;
  segment_id: string;
  detected_taxon: string;
  scientific_name: string | null;
  confidence: number;
  provider: string;
  offset_sec: number;
  duration_sec: number;
  dual_agree: number;
  raw_score_json: string;
  created_at: string;
}

interface ObservationRallyCourseTestRow {
  course_id: string;
  session_id: string;
  title: string;
  status: string;
  config_json: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface ObservationRallyStationTestRow {
  station_id: string;
  course_id: string;
  field_id: string | null;
  code: string;
  name: string;
  description: string;
  lat: number | null;
  lng: number | null;
  radius_m: number | null;
  polygon_json: string | null;
  route_geojson: string | null;
  is_private: number;
  access_note: string;
  danger_note: string;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface ObservationRallyMissionTestRow {
  mission_id: string;
  course_id: string;
  station_id: string | null;
  replacement_for_mission_id: string | null;
  scope: string;
  location_binding: string;
  title: string;
  target: string;
  count_unit: string;
  goal_count: number;
  counting_policy_json: string;
  verification_policy: string;
  weather_sensitivity: string;
  fallback_group: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface ObservationRallySubmissionTestRow {
  submission_id: string;
  session_id: string;
  course_id: string;
  mission_id: string;
  station_id: string | null;
  user_id: string | null;
  guest_token: string | null;
  team_id: string | null;
  source_type: string;
  source_ref: string | null;
  count_value: number;
  public_lat: number | null;
  public_lng: number | null;
  payload_json: string;
  review_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface ObservationRallyProgressTestRow {
  progress_id: string;
  course_id: string;
  mission_id: string;
  progress_scope: string;
  team_id: string | null;
  participant_key: string | null;
  station_id: string | null;
  actual_count: number;
  goal_count: number;
  percent: number;
  status: string;
  updated_at: string;
}

interface GuideUnlockTestRow {
  user_id: string;
  guide_spot_id: string;
  program_id: string | null;
  distance_band: string;
  first_unlocked_at: string;
  last_unlocked_at: string;
  last_listened_at: string | null;
}

interface GuideInteractionTestRow {
  interaction_id: string;
  guide_record_id: string | null;
  hypothesis_id: string | null;
  user_id: string | null;
  session_id: string;
  interaction_type: string;
  payload_json: string;
  occurred_at: string;
}

interface GuideRecordTestRow {
  guide_record_id: string;
  session_id: string;
  user_id: string | null;
  lat: number;
  lng: number;
  scene_summary: string;
  detected_species_json: string;
  detected_features_json: string;
  lang: string;
  created_at: string;
}

interface GuideRecordLatencyStateTestRow {
  guide_record_id: string;
  captured_at: string | null;
  returned_at: string | null;
  delivery_state: string;
  seen_state: string;
  frame_thumb: string | null;
  primary_subject_json: string;
  meta_json: string;
}

interface GuideRoutePointTestRow {
  point_id: string;
  session_id: string;
  user_id: string | null;
  client_point_id: string | null;
  point_kind: string;
  guide_mode: string;
  lat: number;
  lng: number;
  observed_at: string;
  accuracy_m: number | null;
  speed_mps: number | null;
}

interface GuideSessionPublicSummaryTestRow {
  summary_id: string;
  user_id: string;
  session_id: string;
  record_count: number;
  started_at: string | null;
  ended_at: string | null;
  representative_guide_record_id: string | null;
  headline: string;
  body: string;
  featured_subjects_json: string;
  public_location_label: string | null;
  media_thumb_url: string | null;
  updated_at: string;
}

interface MobileFieldSceneReceiptTestRow {
  receipt_id: string;
  install_id: string;
  client_scene_id: string;
  session_id: string;
  guide_record_id: string;
  movement_mode: string;
  scene_digest: string;
  payload_json: string;
  created_at: string;
}

interface GuideEnvironmentMeshTestRow {
  mesh_key: string;
  center_lat: number;
  center_lng: number;
  guide_record_count: number;
  contributor_count: number;
  vegetation_counts_json: string;
  landform_counts_json: string;
  structure_counts_json: string;
  sound_counts_json: string;
  first_seen_at: string | null;
  last_seen_at: string | null;
}

interface GuideProgramTestRow {
  program_id: string;
  slug: string;
  title: string;
  owner_type: string;
  participation_mode: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  public_summary: string | null;
  safety_policy_json: string;
  created_at: string;
  updated_at: string;
}

interface GuideProgramSpotTestRow {
  program_id: string;
  guide_spot_id: string;
  sort_order: number;
  required_for_completion: number;
  created_at: string;
}

interface RegionalHypothesisTestRow {
  hypothesis_id: string;
  mesh_key: string | null;
  place_id: string | null;
  claim_type: string;
  hypothesis_text: string;
  what_we_can_say: string;
  supporting_observation_ids_json: string;
  supporting_guide_record_ids_json: string;
  supporting_knowledge_card_ids_json: string;
  supporting_claim_ids_json: string;
  evidence_json: string;
  confidence: number;
  bias_warnings_json: string;
  missing_data_json: string;
  next_sampling_protocol: string;
  source_fingerprint: string;
  review_status: string;
  generated_at: string;
}

interface GuideEnvironmentRefreshRunTestRow {
  run_id: string;
  trigger_source: string;
  status: string;
  diagnosis_date: string;
  started_at: string;
  finished_at: string;
  mesh_rebuild_needed: number;
  rebuild_action: string;
  guide_record_count: number;
  public_mesh_cell_count: number;
  suppressed_mesh_cell_count: number;
  hypotheses_written: number;
  eval_items_count: number;
  prompt_improvements_written: number;
  error_message: string;
}

interface GuideRecordCorrectionTestRow {
  correction_id: string;
  guide_record_id: string;
  user_id: string | null;
  correction_kind: string;
  original_payload_json: string;
  corrected_payload_json: string;
  note: string | null;
  created_at: string;
}

interface GuidePromptImprovementTestRow {
  improvement_id: string;
  source_key: string;
  improvement_type: string;
  label: string;
  claim_type: string;
  trigger: string;
  recommendation: string;
  prompt_patch: string;
  evidence_json: string;
  support_count: number;
  review_status: string;
  generated_at: string;
}

interface GuidePromptQueueTestRow {
  queue_id: string;
  claim_type: string;
  trigger: string;
  wrong_count: number;
  threshold_count: number;
  queue_status: string;
  improvement_ids_json: string;
  evidence_json: string;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
}

interface SpecialistAuthorityTestRow {
  authority_id: string;
  subject_user_id: string;
  granted_by_user_id: string | null;
  status: string;
  authority_kind: string;
  scope_taxon_name: string;
  scope_taxon_rank: string | null;
  scope_taxon_key: string | null;
  scope_json: string;
  granted_at: string;
  revoked_at: string | null;
  expires_at: string | null;
  reason: string | null;
  source_payload_json: string;
  created_at: string;
  updated_at: string;
}

interface SpecialistAuthorityEvidenceTestRow {
  evidence_id: string;
  authority_id?: string;
  recommendation_id?: string;
  evidence_type: string;
  title: string;
  issuer_name: string | null;
  url: string | null;
  notes: string | null;
  source_payload_json: string;
  created_at: string;
}

interface SpecialistAuthorityAuditTestRow {
  audit_id: string;
  authority_id: string | null;
  actor_user_id: string | null;
  action: string;
  payload_json: string;
  created_at: string;
}

interface AuthorityRecommendationTestRow {
  recommendation_id: string;
  subject_user_id: string;
  source_kind: string;
  status: string;
  scope_taxon_name: string;
  scope_taxon_rank: string | null;
  scope_taxon_key: string | null;
  recommended_by_user_id: string | null;
  granted_authority_id: string | null;
  resolution_note: string | null;
  resolved_by_user_id: string | null;
  resolved_at: string | null;
  source_payload_json: string;
  created_at: string;
  updated_at: string;
}

class FakeD1 {
  users = new Set<string>();
  authUsers = new Map<string, AuthUserRow>();
  oauthAccounts = new Map<string, OAuthAccountRow>();
  areaSubscriptions = new Map<string, AreaSubscriptionRow>();
  areaSubscriptionStats = new Map<string, AreaSubscriptionStatsRow>();
  alertDeliveries = new Map<string, AlertDeliveryRow>();
  alertRecipients = new Map<string, AlertRecipientRow>();
  userNotificationPreferences = new Map<string, UserNotificationPreferenceRow>();
  invasiveReportingEvents: InvasiveReportingEventRow[] = [];
  taxonAlertSubscriptions = new Map<string, TaxonAlertSubscriptionRow>();
  drafts = new Map<string, DraftRow>();
  observations = new Map<string, ObservationRow>();
  observationReactions = new Map<string, ObservationReactionRow>();
  observationIdentifications = new Map<string, ObservationIdentificationRow>();
  observationIdentificationDisputes = new Map<string, ObservationIdentificationDisputeRow>();
  observationAiReviewTargets = new Map<string, ObservationAiReviewTargetRow>();
  observationRecordAiReviews = new Map<string, ObservationRecordAiReviewRow>();
  observationSpecialistReviews = new Map<string, ObservationSpecialistReviewRow>();
  observationDetailEditEvents: ObservationDetailEditEventRow[] = [];
  observationEnvironmentRecords: ObservationEnvironmentRecordRow[] = [];
  environmentRecordTablesAvailable = true;
  placeManagementPolicies = new Map<string, PlaceManagementPolicyRow>();
  placeMemoryEntries = new Map<string, PlaceMemoryEntryTestRow>();
  placeMemoryPreferences = new Map<string, PlaceMemoryPreferenceTestRow>();
  placeMemoryLikes = new Set<string>();
  placeMemoryHidden = new Set<string>();
  placeMemoryReports: Array<{ report_id: string; entry_id: string; user_id: string; reason_code: string; reason_note: string; created_at: string }> = [];
  referenceSources = new Map<string, ReferenceSourceTestRow>();
  referenceAccessProofs = new Map<string, ReferenceAccessProofTestRow>();
  referenceCaptureBatches = new Map<string, { batch_id: string; user_id: string; status: string; item_count: number; source_payload_json: string; created_at: string; updated_at: string }>();
  referenceCaptureItems = new Map<string, { item_id: string; batch_id: string; source_id: string; filename: string; mime_type: string; proof_kind: string; classification_note: string; created_at: string }>();
  referenceSelections: Array<{ selection_id: string; source_id: string; selected_by_user_id: string; locator: string }> = [];
  referenceCorrections = new Map<string, ReferenceCorrectionTestRow>();
  referenceDuplicateMerges = new Map<string, { merge_id: string; canonical_source_id: string; duplicate_source_id: string; actor_user_id: string; source_payload_json: string; created_at: string }>();
  assets = new Map<string, AssetRow>();
  outbox = new Map<string, OutboxRow>();
  rollbackLedger = new Map<string, RollbackLedgerRow>();
  readmodel = new Map<string, { observation_id: string; public_cell: string; observed_at: string; taxon_label: string | null; asset_count: number; partition_month: string | null }>();
  parityRuns = new Map<string, ParityRunRow>();
  parityMetrics: ParityMetricRow[] = [];
  operationAudit: OperationAuditRow[] = [];
  authSessions = new Map<string, AuthSessionRow>();
  contactSubmissions = new Map<string, ContactSubmissionRow>();
  contactProofNonces = new Map<string, ContactProofNonceRow>();
  userProfiles = new Map<string, UserProfileRow>();
  profileWriteAudit: Array<{ audit_id: string; user_id: string; payload_json: string }> = [];
  rememberTokens = new Map<string, RememberTokenRow>();
  waterbodies = new Map<string, WaterbodyRow>();
  waterRecordExtensions = new Map<string, WaterRecordExtensionRow>();
  civicObservationContexts = new Map<string, CivicObservationContextRow>();
  stewardshipActions = new Map<string, StewardshipActionRow>();
  videoUploads = new Map<string, VideoUploadRow>();
  legacyAssetImports: LegacyAssetImportRow[] = [];
  legacyR2Imports: LegacyR2ImportRow[] = [];
  legacyStreamInventory: LegacyStreamInventoryRow[] = [];
  productionPublicReadmodel = new Map<string, ProductionImportPublicReadmodelRow>();
  productionVisits = new Map<string, ProductionImportVisitRow>();
  productionOccurrences = new Map<string, ProductionImportOccurrenceRow>();
  productionEvidenceAssets: ProductionImportEvidenceAssetRow[] = [];
  recordReadingCards = new Map<string, RecordReadingCardRow>();
  managementCandidateConfirmations = new Map<string, ManagementCandidateConfirmationRow>();
  observationReassessmentRequests = new Map<string, ObservationReassessmentRequestRow>();
  candidateActionRequests = new Map<string, CandidateActionRequestRow>();
  productionFieldDetails = new Map<string, ProductionFieldDetailReadmodelRow>();
  userObservationFields = new Map<string, UserObservationFieldTestRow>();
  sourceSnapshots = new Map<string, SourceSnapshotTestRow>();
  placeEnvironmentSnapshots = new Map<string, PlaceEnvironmentSnapshotTestRow>();
  fieldManagers = new Map<string, FieldManagerGrantTestRow>();
  productionAreaPolygons = new Map<string, ProductionAreaPolygonReadmodelRow>();
  municipalWalkMapCreators = new Map<string, MunicipalWalkMapCreatorRow>();
  municipalWalkMaps = new Map<string, MunicipalWalkMapD1Row>();
  municipalWalkMapStops = new Map<string, MunicipalWalkMapStopRow>();
  municipalWalkMapAudit: MunicipalWalkMapAuditRow[] = [];
  walkSessions = new Map<string, WalkSessionRow>();
  trackSessions = new Map<string, TrackSessionRow>();
  trackPoints = new Map<string, TrackPointRow>();
  publicMapSnapshotRecords: PublicMapSnapshotRecordRow[] = [];
  publicMapSnapshotMeta: PublicMapSnapshotMetaRow | null = null;
  observationEventSessions = new Map<string, ObservationEventSessionTestRow>();
  observationEventParticipants = new Map<string, ObservationEventParticipantTestRow>();
  observationEventLiveEvents: ObservationEventLiveTestRow[] = [];
  observationEventTeams = new Map<string, ObservationEventTeamTestRow>();
  observationEventAbsences: Array<{ absence_id: string; session_id: string; user_id: string | null; guest_token: string | null; team_id: string | null; searched_taxon: string; public_lat: number; public_lng: number; created_at: string }> = [];
  observationEventMeshCells = new Map<string, ObservationEventMeshTestRow>();
  observationEventCapsules = new Map<string, ObservationEventCapsuleTestRow>();
  observationEventQuests = new Map<string, ObservationEventQuestTestRow>();
  passiveAudioIngestEvents = new Map<string, PassiveAudioIngestEventTestRow>();
  fieldscanAudioSegments = new Map<string, FieldscanAudioSegmentTestRow>();
  fieldscanAudioDetections: FieldscanAudioDetectionTestRow[] = [];
  observationDataRights = new Map<string, ObservationDataRightsRow>();
  observationRallyCourses = new Map<string, ObservationRallyCourseTestRow>();
  observationRallyStations = new Map<string, ObservationRallyStationTestRow>();
  observationRallyMissions = new Map<string, ObservationRallyMissionTestRow>();
  observationRallySubmissions = new Map<string, ObservationRallySubmissionTestRow>();
  observationRallyProgress = new Map<string, ObservationRallyProgressTestRow>();
  guideUnlocks = new Map<string, GuideUnlockTestRow>();
  guideInteractions = new Map<string, GuideInteractionTestRow>();
  guideRecords = new Map<string, GuideRecordTestRow>();
  guideRecordLatencyStates = new Map<string, GuideRecordLatencyStateTestRow>();
  guideRecordPromotionRequests = new Map<string, GuideRecordPromotionRequestRow>();
  guideRoutePoints = new Map<string, GuideRoutePointTestRow>();
  guideSessionPublicSummaries = new Map<string, GuideSessionPublicSummaryTestRow>();
  mobileFieldSceneReceipts = new Map<string, MobileFieldSceneReceiptTestRow>();
  guideEnvironmentMeshCells = new Map<string, GuideEnvironmentMeshTestRow>();
  regionalHypotheses = new Map<string, RegionalHypothesisTestRow>();
  guideEnvironmentRefreshRuns = new Map<string, GuideEnvironmentRefreshRunTestRow>();
  guideRecordCorrections = new Map<string, GuideRecordCorrectionTestRow>();
  guidePrograms = new Map<string, GuideProgramTestRow>();
  guideProgramSpots = new Map<string, GuideProgramSpotTestRow>();
  guideProgramAudit: Array<{ audit_id: string; program_id: string; actor_user_id: string | null; action: string }> = [];
  guidePromptImprovements = new Map<string, GuidePromptImprovementTestRow>();
  guidePromptQueues = new Map<string, GuidePromptQueueTestRow>();
  specialistAuthorities = new Map<string, SpecialistAuthorityTestRow>();
  specialistAuthorityEvidence: SpecialistAuthorityEvidenceTestRow[] = [];
  specialistAuthorityAudit: SpecialistAuthorityAuditTestRow[] = [];
  authorityRecommendations = new Map<string, AuthorityRecommendationTestRow>();
  authorityRecommendationEvidence: SpecialistAuthorityEvidenceTestRow[] = [];
  authorityRecommendationAudit: Array<{ audit_id: string; recommendation_id: string; actor_user_id: string | null; action: string; payload_json: string; created_at: string }> = [];

  prepare(query: string): FakeStatement {
    return new FakeStatement(this, query);
  }

  async batch(statements: FakeStatement[]): Promise<unknown[]> {
    const results: unknown[] = [];
    for (const statement of statements) {
      results.push(await statement.run());
    }
    return results;
  }
}

class FakeStatement {
  private values: D1Value[] = [];

  constructor(private readonly db: FakeD1, private readonly query: string) {}

  bind(...values: D1Value[]): FakeStatement {
    this.values = values;
    return this;
  }

  async run(): Promise<unknown> {
    const normalized = normalize(this.query);
    const v = this.values;

    if (normalized.startsWith("INSERT OR IGNORE INTO users")) {
      this.db.users.add(string(v[0]));
      return {};
    }

    if (normalized.startsWith("INSERT INTO place_memory_entries")) {
      const existing = [...this.db.placeMemoryEntries.values()].find((row) => row.visit_id === string(v[1]));
      const now = new Date().toISOString();
      const row: PlaceMemoryEntryTestRow = existing ?? {
        entry_id: string(v[0]),
        visit_id: string(v[1]),
        occurrence_id: string(v[2]),
        user_id: string(v[3]),
        cell_id: string(v[4]),
        cell_grid_m: number(v[5]),
        memory_tags_json: string(v[6]),
        tags_public: number(v[7]),
        echo_note: string(v[8]),
        private_note: string(v[9]),
        photo_echo_enabled: number(v[10]),
        photo_echo_visibility: string(v[11]),
        moderation_status: "visible",
        source_payload_json: string(v[12]),
        created_at: now,
        updated_at: now,
        deleted_at: null
      };
      row.occurrence_id = string(v[2]);
      row.user_id = string(v[3]);
      row.cell_id = string(v[4]);
      row.cell_grid_m = number(v[5]);
      row.memory_tags_json = string(v[6]);
      row.tags_public = number(v[7]);
      row.echo_note = string(v[8]);
      row.private_note = string(v[9]);
      row.photo_echo_enabled = number(v[10]);
      row.photo_echo_visibility = row.photo_echo_enabled === 0 ? "hidden_by_user" : (row.photo_echo_visibility === "ready" ? "ready" : string(v[11]));
      row.moderation_status = "visible";
      row.source_payload_json = string(v[12]);
      row.updated_at = now;
      row.deleted_at = null;
      this.db.placeMemoryEntries.set(row.entry_id, row);
      return {};
    }

    if (normalized.startsWith("INSERT INTO place_memory_user_preferences")) {
      this.db.placeMemoryPreferences.set(string(v[0]), {
        user_id: string(v[0]),
        default_photo_echo_enabled: number(v[1]),
        default_tags_public: number(v[2]),
        updated_at: new Date().toISOString()
      });
      return {};
    }

    if (normalized.startsWith("INSERT OR IGNORE INTO place_memory_likes")) {
      this.db.placeMemoryLikes.add(`${string(v[0])}:${string(v[1])}`);
      return {};
    }

    if (normalized.startsWith("DELETE FROM place_memory_likes")) {
      this.db.placeMemoryLikes.delete(`${string(v[0])}:${string(v[1])}`);
      return {};
    }

    if (normalized.startsWith("INSERT OR REPLACE INTO place_memory_hidden_entries")) {
      this.db.placeMemoryHidden.add(`${string(v[0])}:${string(v[1])}`);
      return {};
    }

    if (normalized.startsWith("INSERT INTO place_memory_reports")) {
      this.db.placeMemoryReports.push({
        report_id: string(v[0]),
        entry_id: string(v[1]),
        user_id: string(v[2]),
        reason_code: string(v[3]),
        reason_note: string(v[4]),
        created_at: new Date().toISOString()
      });
      return {};
    }

    if (normalized.startsWith("UPDATE place_memory_entries SET photo_echo_visibility")) {
      const row = this.db.placeMemoryEntries.get(string(v[0]));
      if (row) {
        row.photo_echo_visibility = "pending_review";
        row.updated_at = new Date().toISOString();
      }
      return {};
    }

    if (normalized.startsWith("UPDATE place_memory_entries SET moderation_status")) {
      const row = this.db.placeMemoryEntries.get(string(v[0]));
      if (row) {
        row.moderation_status = "hidden_by_reports";
        row.updated_at = new Date().toISOString();
      }
      return {};
    }

    if (normalized.startsWith("INSERT INTO reference_capture_batches")) {
      const now = new Date().toISOString();
      this.db.referenceCaptureBatches.set(string(v[0]), {
        batch_id: string(v[0]),
        user_id: string(v[1]),
        status: string(v[2]),
        item_count: number(v[3]),
        source_payload_json: string(v[4]),
        created_at: now,
        updated_at: now
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO reference_sources")) {
      const now = new Date().toISOString();
      this.db.referenceSources.set(string(v[0]), {
        source_id: string(v[0]),
        title: string(v[1]),
        author_text: string(v[2]),
        publisher: string(v[3]),
        publication_year: v[4] === null ? null : number(v[4]),
        isbn: string(v[5]),
        doi: string(v[6]),
        url: string(v[7]),
        source_kind: string(v[8]),
        catalog_status: string(v[9]),
        taxon_labels_json: string(v[10]),
        commerce_links_json: string(v[11]),
        created_by_user_id: nullableString(v[12]),
        source_payload_json: string(v[13]),
        created_at: now,
        updated_at: now
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO reference_access_proofs")) {
      const now = new Date().toISOString();
      this.db.referenceAccessProofs.set(string(v[0]), {
        proof_id: string(v[0]),
        user_id: string(v[1]),
        source_id: string(v[2]),
        batch_id: nullableString(v[3]),
        proof_kind: string(v[4]),
        verification_status: string(v[5]),
        private_use_only: number(v[6]),
        source_payload_json: string(v[7]),
        created_at: now,
        updated_at: now
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO reference_capture_items")) {
      this.db.referenceCaptureItems.set(string(v[0]), {
        item_id: string(v[0]),
        batch_id: string(v[1]),
        source_id: string(v[2]),
        filename: string(v[3]),
        mime_type: string(v[4]),
        proof_kind: string(v[5]),
        classification_note: string(v[6]),
        created_at: new Date().toISOString()
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO reference_duplicate_merges")) {
      this.db.referenceDuplicateMerges.set(string(v[2]), {
        merge_id: string(v[0]),
        canonical_source_id: string(v[1]),
        duplicate_source_id: string(v[2]),
        actor_user_id: string(v[3]),
        source_payload_json: string(v[4]),
        created_at: new Date().toISOString()
      });
      return {};
    }

    if (normalized.startsWith("UPDATE reference_sources SET catalog_status")) {
      const row = this.db.referenceSources.get(string(v[1]));
      if (row) {
        row.catalog_status = "duplicate";
        row.source_payload_json = string(v[0]);
        row.updated_at = new Date().toISOString();
      }
      return {};
    }

    if (normalized.startsWith("INSERT INTO reference_corrections")) {
      const now = new Date().toISOString();
      this.db.referenceCorrections.set(string(v[0]), {
        correction_id: string(v[0]),
        source_id: string(v[1]),
        locator: string(v[2]),
        original_name: string(v[3]),
        corrected_name: string(v[4]),
        original_taxon_name: string(v[5]),
        corrected_taxon_name: string(v[6]),
        correction_kind: string(v[7]),
        official_source_url: string(v[8]),
        official_reference: string(v[9]),
        verification_status: string(v[10]),
        verified_by_user_id: nullableString(v[11]),
        applies_from: nullableString(v[12]),
        source_payload_json: string(v[13]),
        created_at: now,
        updated_at: now
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO auth_users")) {
      const row = {
        user_id: string(v[0]),
        email: string(v[1]).toLowerCase(),
        password_hash: nullableString(v[2]),
        display_name: string(v[3]),
        role_name: nullableString(v[4]),
        rank_label: nullableString(v[5]),
        banned: number(v[6]),
        last_login_at: null
      };
      this.db.authUsers.set(row.email, row);
      return {};
    }

    if (normalized.startsWith("UPDATE auth_users SET display_name")) {
      const row = [...this.db.authUsers.values()].find((candidate) => candidate.user_id === string(v[1]));
      if (row) row.display_name = string(v[0]);
      return {};
    }

    if (normalized.startsWith("UPDATE auth_users SET last_login_at")) {
      const userId = string(v[0]);
      const row = [...this.db.authUsers.values()].find((candidate) => candidate.user_id === userId);
      if (row) row.last_login_at = new Date().toISOString();
      return {};
    }

    if (normalized.startsWith("INSERT INTO contact_submissions")) {
      this.db.contactSubmissions.set(string(v[0]), {
        submission_id: string(v[0]),
        category: string(v[1]),
        name: nullableString(v[2]),
        email: nullableString(v[3]),
        organization: nullableString(v[4]),
        message: string(v[5]),
        ip_hash: nullableString(v[8]),
        user_id: nullableString(v[9]),
        notification_sent: 0,
        auto_reply_sent: 0,
        send_error: null,
        created_at: string(v[10])
      });
      return {};
    }

    if (normalized.startsWith("UPDATE contact_submissions SET notification_sent")) {
      const row = requireRow(this.db.contactSubmissions, string(v[3]));
      row.notification_sent = number(v[0]);
      row.auto_reply_sent = number(v[1]);
      row.send_error = nullableString(v[2]);
      return {};
    }

    if (normalized.startsWith("INSERT INTO contact_proof_nonces")) {
      const nonceHash = string(v[0]);
      if (this.db.contactProofNonces.has(nonceHash)) {
        throw new Error("UNIQUE constraint failed: contact_proof_nonces.nonce_hash");
      }
      this.db.contactProofNonces.set(nonceHash, {
        nonce_hash: nonceHash,
        issued_at_ms: number(v[1]),
        ip_hash: nullableString(v[2])
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO user_profiles")) {
      this.db.userProfiles.set(string(v[0]), {
        user_id: string(v[0]),
        display_name: string(v[1]),
        profile_bio: string(v[2]),
        expertise: string(v[3]),
        avatar_object_key: nullableString(v[4]),
        avatar_mime: nullableString(v[5]),
        avatar_bytes: nullableNumber(v[6]),
        avatar_sha256: nullableString(v[7])
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO profile_write_audit")) {
      this.db.profileWriteAudit.push({
        audit_id: string(v[0]),
        user_id: string(v[1]),
        payload_json: string(v[2])
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO remember_tokens")) {
      this.db.rememberTokens.set(string(v[0]), {
        token_hash: string(v[0]),
        user_id: string(v[1]),
        token_family: string(v[2]),
        user_agent: nullableString(v[3]),
        ip_address: nullableString(v[4]),
        expires_at: string(v[5])
      });
      return {};
    }

    if (normalized.startsWith("DELETE FROM remember_tokens")) {
      this.db.rememberTokens.delete(string(v[0]));
      return {};
    }

    if (normalized.startsWith("INSERT INTO oauth_accounts")) {
      const key = `${string(v[1])}:${string(v[2])}`;
      this.db.oauthAccounts.set(key, {
        user_id: string(v[0]),
        provider: string(v[1]),
        provider_user_id: string(v[2]),
        provider_email: nullableString(v[3]),
        display_name: string(v[4]),
        role_name: nullableString(v[5]),
        rank_label: nullableString(v[6]),
        banned: number(v[7]),
        profile_json: string(v[8]),
        linked_at: new Date().toISOString()
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO operation_audit")) {
      this.db.operationAudit.push({
        audit_id: string(v[0]),
        operation_type: normalized.includes("'auth_login_failed'") ? "auth_login_failed" : "origin_fallback",
        target_id: string(v[1]),
        payload_json: string(v[2]),
        created_at: new Date(Date.now() + this.db.operationAudit.length).toISOString()
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO observation_event_sessions")) {
      const now = new Date().toISOString();
      this.db.observationEventSessions.set(string(v[0]), {
        session_id: string(v[0]),
        legacy_event_id: nullableString(v[1]),
        event_code: nullableString(v[2]),
        title: string(v[3]),
        organizer_user_id: string(v[4]),
        corporation_id: nullableString(v[5]),
        plan: string(v[6]),
        primary_mode: string(v[7]),
        active_modes_json: string(v[8]),
        location_lat: nullableNumber(v[9]),
        location_lng: nullableNumber(v[10]),
        location_radius_m: number(v[11]),
        started_at: string(v[12]),
        ended_at: nullableString(v[13]),
        target_species_json: string(v[14]),
        config_json: string(v[15]),
        field_id: nullableString(v[16]),
        template_source_session_id: nullableString(v[17]),
        created_at: now,
        updated_at: now
      });
      return {};
    }

    if (normalized.startsWith("UPDATE observation_event_sessions SET ended_at")) {
      const row = requireRow(this.db.observationEventSessions, string(v[0]));
      row.ended_at = row.ended_at ?? new Date().toISOString();
      row.updated_at = new Date().toISOString();
      return {};
    }

    if (normalized.startsWith("UPDATE observation_event_sessions SET primary_mode")) {
      const row = requireRow(this.db.observationEventSessions, string(v[2]));
      row.primary_mode = string(v[0]);
      row.active_modes_json = string(v[1]);
      row.updated_at = new Date().toISOString();
      return {};
    }

    if (normalized.startsWith("UPDATE observation_event_sessions SET title")) {
      const row = requireRow(this.db.observationEventSessions, string(v[12]));
      row.title = string(v[0]);
      row.event_code = nullableString(v[1]);
      row.primary_mode = string(v[2]);
      row.active_modes_json = string(v[3]);
      row.location_lat = nullableNumber(v[4]);
      row.location_lng = nullableNumber(v[5]);
      row.location_radius_m = number(v[6]);
      row.started_at = string(v[7]);
      row.target_species_json = string(v[8]);
      row.plan = string(v[9]);
      row.config_json = string(v[10]);
      row.field_id = nullableString(v[11]);
      row.updated_at = new Date().toISOString();
      return {};
    }

    if (normalized.startsWith("INSERT INTO observation_event_live_events")) {
      this.db.observationEventLiveEvents.push({
        live_event_id: string(v[0]),
        session_id: string(v[1]),
        type: string(v[2]),
        scope: string(v[3]),
        actor_user_id: nullableString(v[4]),
        actor_guest_token: nullableString(v[5]),
        team_id: nullableString(v[6]),
        payload_json: string(v[7]),
        created_at: new Date(Date.now() + this.db.observationEventLiveEvents.length).toISOString()
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO observation_event_teams")) {
      this.db.observationEventTeams.set(string(v[0]), {
        team_id: string(v[0]),
        session_id: string(v[1]),
        name: string(v[2]),
        color: string(v[3]),
        lead_user_id: nullableString(v[4]),
        target_taxa_json: string(v[5]),
        created_at: new Date().toISOString()
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO observation_event_participants")) {
      const now = new Date().toISOString();
      this.db.observationEventParticipants.set(string(v[0]), {
        participant_id: string(v[0]),
        session_id: string(v[1]),
        user_id: nullableString(v[2]),
        guest_token: nullableString(v[3]),
        display_name: string(v[4]),
        team_id: nullableString(v[5]),
        role: "participant",
        declared_job: null,
        status: "checked_in",
        checked_in_at: now,
        share_location: number(v[6]),
        is_minor: number(v[7]),
        location_share_until: nullableString(v[8]),
        location_share_consent_type: nullableString(v[9]),
        created_at: now,
        updated_at: now
      });
      return {};
    }

    if (normalized.startsWith("UPDATE observation_event_participants SET display_name")) {
      const row = requireRow(this.db.observationEventParticipants, string(v[3]));
      row.display_name = string(v[0]);
      row.team_id = nullableString(v[1]) ?? row.team_id;
      row.status = "checked_in";
      row.checked_in_at = new Date().toISOString();
      row.share_location = number(v[2]);
      row.is_minor = number(v[3]);
      row.location_share_until = nullableString(v[4]);
      row.location_share_consent_type = nullableString(v[5]);
      row.updated_at = new Date().toISOString();
      return {};
    }

    if (normalized.startsWith("UPDATE observation_event_participants SET declared_job")) {
      const row = requireRow(this.db.observationEventParticipants, string(v[1]));
      row.declared_job = string(v[0]);
      row.updated_at = new Date().toISOString();
      return {};
    }

    if (normalized.startsWith("INSERT INTO observation_rally_courses")) {
      const now = new Date().toISOString();
      this.db.observationRallyCourses.set(string(v[0]), {
        course_id: string(v[0]),
        session_id: string(v[1]),
        title: string(v[2]),
        status: string(v[3]),
        config_json: string(v[4]),
        created_by: nullableString(v[5]),
        created_at: now,
        updated_at: now
      });
      return {};
    }

    if (normalized.startsWith("UPDATE observation_rally_courses SET title")) {
      const row = requireRow(this.db.observationRallyCourses, string(v[3]));
      row.title = string(v[0]);
      row.status = string(v[1]);
      row.config_json = string(v[2]);
      row.updated_at = new Date().toISOString();
      return {};
    }

    if (normalized.startsWith("INSERT INTO observation_rally_stations")) {
      const now = new Date().toISOString();
      this.db.observationRallyStations.set(string(v[0]), {
        station_id: string(v[0]),
        course_id: string(v[1]),
        field_id: nullableString(v[2]),
        code: string(v[3]),
        name: string(v[4]),
        description: string(v[5]),
        lat: nullableNumber(v[6]),
        lng: nullableNumber(v[7]),
        radius_m: nullableNumber(v[8]),
        polygon_json: nullableString(v[9]),
        route_geojson: nullableString(v[10]),
        is_private: number(v[11]),
        access_note: string(v[12]),
        danger_note: string(v[13]),
        status: "open",
        sort_order: number(v[14]),
        created_at: now,
        updated_at: now
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO observation_rally_missions")) {
      const now = new Date().toISOString();
      this.db.observationRallyMissions.set(string(v[0]), {
        mission_id: string(v[0]),
        course_id: string(v[1]),
        station_id: nullableString(v[2]),
        replacement_for_mission_id: nullableString(v[3]),
        scope: string(v[4]),
        location_binding: string(v[5]),
        title: string(v[6]),
        target: string(v[7]),
        count_unit: string(v[8]),
        goal_count: number(v[9]),
        counting_policy_json: string(v[10]),
        verification_policy: string(v[11]),
        weather_sensitivity: string(v[12]),
        fallback_group: string(v[13]),
        status: string(v[14]),
        starts_at: nullableString(v[15]),
        ends_at: nullableString(v[16]),
        sort_order: number(v[17]),
        created_by: nullableString(v[18]),
        created_at: now,
        updated_at: now
      });
      return {};
    }

    if (normalized.startsWith("UPDATE observation_rally_missions SET status")) {
      const row = requireRow(this.db.observationRallyMissions, string(v[3]));
      row.status = string(v[0]);
      row.goal_count = number(v[1]);
      row.ends_at = nullableString(v[2]);
      row.updated_at = new Date().toISOString();
      return {};
    }

    if (normalized.startsWith("INSERT INTO observation_rally_submissions")) {
      this.db.observationRallySubmissions.set(string(v[0]), {
        submission_id: string(v[0]),
        session_id: string(v[1]),
        course_id: string(v[2]),
        mission_id: string(v[3]),
        station_id: nullableString(v[4]),
        user_id: nullableString(v[5]),
        guest_token: nullableString(v[6]),
        team_id: nullableString(v[7]),
        source_type: string(v[8]),
        source_ref: nullableString(v[9]),
        count_value: number(v[10]),
        public_lat: nullableNumber(v[11]),
        public_lng: nullableNumber(v[12]),
        payload_json: string(v[13]),
        review_status: string(v[14]),
        reviewed_by: null,
        reviewed_at: null,
        created_at: new Date().toISOString()
      });
      return {};
    }

    if (normalized.startsWith("UPDATE observation_rally_submissions SET review_status")) {
      const row = requireRow(this.db.observationRallySubmissions, string(v[2]));
      row.review_status = string(v[0]);
      row.reviewed_by = nullableString(v[1]);
      row.reviewed_at = new Date().toISOString();
      return {};
    }

    if (normalized.startsWith("UPDATE observation_rally_progress SET actual_count")) {
      const row = requireRow(this.db.observationRallyProgress, string(v[3]));
      row.actual_count = number(v[0]);
      row.percent = number(v[1]);
      row.status = string(v[2]);
      row.updated_at = new Date().toISOString();
      return {};
    }

    if (normalized.startsWith("INSERT INTO observation_rally_progress")) {
      this.db.observationRallyProgress.set(string(v[0]), {
        progress_id: string(v[0]),
        course_id: string(v[1]),
        mission_id: string(v[2]),
        progress_scope: string(v[3]),
        team_id: nullableString(v[4]),
        participant_key: nullableString(v[5]),
        station_id: nullableString(v[6]),
        actual_count: number(v[7]),
        goal_count: number(v[8]),
        percent: number(v[9]),
        status: string(v[10]),
        updated_at: new Date().toISOString()
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO observation_rally_revisions")) {
      return {};
    }

    if (normalized.startsWith("INSERT INTO observation_event_absences")) {
      this.db.observationEventAbsences.push({
        absence_id: string(v[0]),
        session_id: string(v[1]),
        user_id: nullableString(v[2]),
        guest_token: nullableString(v[3]),
        team_id: nullableString(v[4]),
        searched_taxon: string(v[5]),
        public_lat: number(v[7]),
        public_lng: number(v[8]),
        created_at: new Date().toISOString()
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO observation_event_recap_views")) {
      return {};
    }

    if (normalized.startsWith("INSERT INTO observation_event_capsules")) {
      const now = new Date().toISOString();
      const row: ObservationEventCapsuleTestRow = {
        capsule_id: string(v[0]),
        session_id: string(v[1]),
        source_counts_json: string(v[2]),
        source_clusters_json: string(v[3]),
        private_digest_json: string(v[4]),
        public_story_draft_json: string(v[5]),
        record_candidates_json: string(v[6]),
        privacy_risk_queue_json: string(v[7]),
        readiness_json: string(v[8]),
        source_hash: string(v[9]),
        model_metadata_json: string(v[10]),
        review_status: string(v[11]),
        generated_by: nullableString(v[12]),
        generated_at: string(v[13]),
        reviewed_by: null,
        reviewed_at: null,
        published_at: null,
        updated_at: string(v[14]) || now
      };
      this.db.observationEventCapsules.set(row.session_id, row);
      return {};
    }

    if (normalized.startsWith("INSERT INTO observation_event_quests")) {
      const now = new Date().toISOString();
      this.db.observationEventQuests.set(string(v[0]), {
        quest_id: string(v[0]),
        session_id: string(v[1]),
        team_id: nullableString(v[2]),
        participant_id: null,
        status: "offered",
        payload_json: string(v[3]),
        created_at: now,
        updated_at: now
      });
      return {};
    }

    if (normalized.startsWith("UPDATE observation_event_quests SET status")) {
      const row = requireRow(this.db.observationEventQuests, string(v[2]));
      if (row.session_id !== string(v[3])) throw new Error(`Quest ${string(v[2])} does not belong to session ${string(v[3])}`);
      row.status = string(v[0]);
      row.payload_json = string(v[1]);
      row.updated_at = new Date().toISOString();
      return {};
    }

    if (normalized.startsWith("INSERT INTO source_snapshots")) {
      this.db.sourceSnapshots.set(string(v[0]), {
        snapshot_id: string(v[0]),
        source_kind: string(v[1]),
        source_url: string(v[2]),
        content_sha256: string(v[3]),
        content_bytes: number(v[4]),
        storage_backend: "cloudflare_d1",
        storage_path: string(v[5]),
        license: string(v[6]),
        notes: string(v[7])
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO place_environment_snapshots")) {
      this.db.placeEnvironmentSnapshots.set(string(v[0]), {
        snapshot_id: string(v[0]),
        place_id: string(v[1]),
        metric_kind: string(v[2]),
        metric_value: number(v[3]),
        metric_unit: string(v[4]),
        observed_on: string(v[5]),
        source_snapshot_id: string(v[6]),
        valid_from: string(v[7]),
        valid_to: null,
        superseded_by: null,
        metadata: string(v[8])
      });
      return {};
    }

    if (normalized.startsWith("UPDATE place_environment_snapshots SET valid_to")) {
      const row = requireRow(this.db.placeEnvironmentSnapshots, string(v[2]));
      row.valid_to = string(v[0]);
      row.superseded_by = string(v[1]);
      return {};
    }

    if (normalized.startsWith("UPDATE observation_event_capsules")) {
      const row = requireRow(this.db.observationEventCapsules, string(v[3]));
      row.review_status = string(v[0]);
      row.reviewed_by = nullableString(v[1]);
      row.reviewed_at = new Date().toISOString();
      if (string(v[2]) === "published") row.published_at = new Date().toISOString();
      row.updated_at = new Date().toISOString();
      return {};
    }

    if (normalized.startsWith("INSERT INTO observation_event_mesh_cells")) {
      const key = `${string(v[1])}:${string(v[2])}`;
      const existing = this.db.observationEventMeshCells.get(key);
      if (existing) {
        existing.visit_seconds += number(v[5]);
        existing.observation_count += number(v[6]);
        existing.absence_count += number(v[7]);
        existing.updated_at = new Date().toISOString();
      } else {
        this.db.observationEventMeshCells.set(key, {
          mesh_cell_id: string(v[0]),
          session_id: string(v[1]),
          mesh_key: string(v[2]),
          center_lat: number(v[3]),
          center_lng: number(v[4]),
          visit_seconds: number(v[5]),
          observation_count: number(v[6]),
          absence_count: number(v[7]),
          last_visited_at: new Date().toISOString(),
          visited_team_ids_json: string(v[8]),
          updated_at: new Date().toISOString()
        });
      }
      return {};
    }

    if (normalized.startsWith("INSERT INTO draft_observations")) {
      this.db.drafts.set(string(v[0]), {
        draft_id: string(v[0]),
        owner_user_id: string(v[1]),
        observed_at: nullableString(v[2]),
        partition_month: nullableString(v[8]),
        exact_lat: nullableNumber(v[3]),
        exact_lng: nullableNumber(v[4]),
        location_accuracy_m: nullableNumber(v[5]),
        public_cell: string(v[6]),
        visibility: string(v[7]),
        processing_state: "draft",
        finalized_at: null
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO asset_ledger") && normalized.includes("(asset_id, draft_id, observation_id,")) {
      this.db.assets.set(string(v[0]), {
        asset_id: string(v[0]),
        draft_id: string(v[1]),
        observation_id: string(v[2]),
        owner_user_id: string(v[3]),
        object_key: string(v[4]),
        partition_month: nullableString(v[9]),
        sha256: nullableString(v[5]),
        mime: string(v[6]),
        bytes: number(v[7]),
        processing_state: "uploaded",
        public_derivative_key: null,
        public_derivative_sha256: null,
        public_derivative_verified_at: null,
        public_derivative_metadata_json: null,
        exif_scrub_state: "not_started",
        public_ready_at: null
      });
      return {};
    }

    if (normalized.startsWith("INSERT OR REPLACE INTO asset_ledger")) {
      this.db.assets.set(string(v[0]), {
        asset_id: string(v[0]),
        draft_id: string(v[1]),
        observation_id: string(v[2]),
        owner_user_id: string(v[3]),
        object_key: string(v[4]),
        partition_month: nullableString(v[11]),
        sha256: nullableString(v[5]),
        mime: string(v[6]),
        bytes: number(v[7]),
        processing_state: "uploaded",
        public_derivative_key: null,
        public_derivative_sha256: null,
        public_derivative_verified_at: null,
        public_derivative_metadata_json: null,
        exif_scrub_state: "not_started",
        public_ready_at: null
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO asset_ledger")) {
      this.db.assets.set(string(v[0]), {
        asset_id: string(v[0]),
        draft_id: string(v[1]),
        owner_user_id: string(v[2]),
        object_key: string(v[3]),
        partition_month: nullableString(v[11]),
        sha256: nullableString(v[4]),
        mime: string(v[5]),
        bytes: number(v[6]),
        processing_state: "awaiting_upload",
        observation_id: null,
        public_derivative_key: null,
        public_derivative_sha256: null,
        public_derivative_verified_at: null,
        public_derivative_metadata_json: null,
        exif_scrub_state: "not_started",
        public_ready_at: null
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO video_upload_requests")) {
      this.db.videoUploads.set(string(v[0]), {
        stream_uid: string(v[0]),
        actor_id: string(v[1]),
        observation_id: nullableString(v[2]),
        upload_status: "waiting_upload",
        max_duration_seconds: number(v[3]),
        filename: nullableString(v[4]),
        upload_protocol: string(v[5]),
        object_key: nullableString(v[6]),
        bytes: number(v[7]),
        duration_ms: 0,
        ready_to_stream: 0,
        created_at: "2026-06-15T00:00:00.000Z",
        uploaded_at: null
      });
      return {};
    }

    if (normalized.startsWith("UPDATE video_upload_requests SET upload_status = 'uploaded'")) {
      const row = requireRow(this.db.videoUploads, string(v[1]));
      row.upload_status = "uploaded";
      row.bytes = number(v[0]);
      row.uploaded_at = new Date().toISOString();
      return {};
    }

    if (normalized.startsWith("UPDATE video_upload_requests SET upload_status = ?")) {
      const row = requireRow(this.db.videoUploads, string(v[7]));
      row.upload_status = string(v[0]);
      row.bytes = number(v[1]);
      row.duration_ms = number(v[2]);
      row.ready_to_stream = number(v[3]);
      row.uploaded_at = nullableString(v[4]) ?? row.uploaded_at;
      return {};
    }

    if (normalized.startsWith("UPDATE video_upload_requests SET observation_id = ?")) {
      const row = requireRow(this.db.videoUploads, string(v[5]));
      row.observation_id = nullableString(v[0]);
      row.upload_status = string(v[1]);
      row.bytes = number(v[2]);
      row.duration_ms = number(v[3]);
      row.ready_to_stream = number(v[4]);
      return {};
    }

    if (normalized.startsWith("UPDATE asset_ledger SET processing_state = 'uploaded'")) {
      const asset = requireRow(this.db.assets, string(v[0]));
      asset.processing_state = "uploaded";
      return {};
    }

    if (normalized.startsWith("INSERT INTO observations")) {
      this.db.observations.set(string(v[0]), {
        observation_id: string(v[0]),
        draft_id: string(v[1]),
        owner_user_id: string(v[2]),
        observed_at: string(v[3]),
        partition_month: nullableString(v[11]),
        taxon_label: nullableString(v[4]),
        note: nullableString(v[5]),
        exact_lat: nullableNumber(v[6]),
        exact_lng: nullableNumber(v[7]),
        location_accuracy_m: nullableNumber(v[8]),
        public_cell: string(v[9]),
        visibility: string(v[10]),
        emergency_hidden: 0,
        processing_state: "accepted"
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO observation_data_rights")) {
      this.db.observationDataRights.set(string(v[0]), {
        visit_id: string(v[0]),
        occurrence_id: nullableString(v[1]),
        record_consent: string(v[2]),
        research_use_consent: string(v[3]),
        enterprise_report_consent: string(v[4]),
        dataset_license: nullableString(v[5]),
        media_license: nullableString(v[6]),
        external_export_allowed: number(v[7]),
        withdrawal_status: string(v[8]),
        source_payload_json: string(v[9])
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO civic_observation_contexts")) {
      this.db.civicObservationContexts.set(string(v[1]), {
        context_id: string(v[0]),
        visit_id: string(v[1]),
        occurrence_id: nullableString(v[2]),
        context_kind: string(v[3]),
        activity_label: nullableString(v[4]),
        activity_intent: nullableString(v[5]),
        participant_role: nullableString(v[6]),
        audience_scope: string(v[7]),
        public_precision: string(v[8]),
        risk_lane: string(v[9]),
        report_consent: string(v[10]),
        revisit_of_visit_id: nullableString(v[11]),
        field_id: nullableString(v[12]),
        route_id: nullableString(v[13]),
        plot_id: nullableString(v[14]),
        source_payload_json: string(v[15])
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO waterbodies")) {
      this.db.waterbodies.set(string(v[0]), {
        ikimon_waterbody_id: string(v[0]),
        waterbody_type: string(v[1]),
        parent_waterbody_id: nullableString(v[2]),
        public_label: string(v[3]),
        source: string(v[4]),
        source_version: string(v[5]),
        geometry_precision: string(v[6]),
        source_payload_json: string(v[7])
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO water_record_extensions")) {
      this.db.waterRecordExtensions.set(string(v[0]), {
        visit_id: string(v[0]),
        occurrence_id: nullableString(v[1]),
        waterbody_id: nullableString(v[2]),
        catch_outcome: string(v[3]),
        capture_method: nullableString(v[4]),
        participant_count: nullableNumber(v[5]),
        effort_minutes: nullableNumber(v[6]),
        target_taxa_scope: nullableString(v[7]),
        released_count: nullableNumber(v[8]),
        kept_count: nullableNumber(v[9]),
        public_waterbody_label: nullableString(v[10]),
        environment_snapshot_json: string(v[11]),
        source_payload_json: string(v[12])
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO stewardship_actions")) {
      this.db.stewardshipActions.set(string(v[0]), {
        action_id: string(v[0]),
        place_id: string(v[1]),
        occurred_at: string(v[2]),
        action_kind: string(v[3]),
        actor_user_id: string(v[4]),
        linked_visit_id: nullableString(v[5]),
        description: nullableString(v[6]),
        species_status: nullableString(v[7]),
        metadata_json: string(v[8])
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO observation_reactions")) {
      const duplicate = [...this.db.observationReactions.values()].find((candidate) =>
        candidate.occurrence_id === string(v[1])
        && candidate.user_id === string(v[2])
        && candidate.reaction_type === string(v[3])
      );
      if (duplicate) {
        throw new Error("UNIQUE constraint failed: observation_reactions.occurrence_id, observation_reactions.user_id, observation_reactions.reaction_type");
      }
      this.db.observationReactions.set(string(v[0]), {
        reaction_id: string(v[0]),
        occurrence_id: string(v[1]),
        user_id: string(v[2]),
        reaction_type: string(v[3]),
        created_at: new Date().toISOString()
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO observation_identifications")) {
      const now = new Date().toISOString();
      const literalAlternative = normalized.includes("'alternative'");
      const literalSupport = normalized.includes("'support'");
      const stance = literalAlternative ? "alternative" : literalSupport ? "support" : string(v[5]);
      const notes = nullableString(literalAlternative ? v[5] : literalSupport ? null : v[6]);
      const sourceKey = string(literalAlternative ? v[6] : literalSupport ? v[5] : v[7]);
      const sourcePayload = string(literalAlternative ? v[7] : literalSupport ? v[6] : v[8]);
      const existing = [...this.db.observationIdentifications.values()].find((candidate) => candidate.source_key === sourceKey);
      if (existing) {
        existing.proposed_name = string(v[3]);
        existing.proposed_rank = nullableString(v[4]);
        existing.stance = stance;
        existing.notes = notes;
        existing.source_payload_json = sourcePayload;
        existing.is_current = 1;
        existing.updated_at = now;
      } else {
        this.db.observationIdentifications.set(string(v[0]), {
          identification_id: string(v[0]),
          occurrence_id: string(v[1]),
          actor_user_id: string(v[2]),
          proposed_name: string(v[3]),
          proposed_rank: nullableString(v[4]),
          stance,
          notes,
          source_key: sourceKey,
          source_payload_json: sourcePayload,
          is_current: 1,
          created_at: now,
          updated_at: now
        });
      }
      return {};
    }

    if (normalized.startsWith("INSERT INTO observation_record_ai_reviews")) {
      const now = new Date().toISOString();
      const occurrenceId = string(v[1]);
      const actorUserId = string(v[4]);
      const existing = [...this.db.observationRecordAiReviews.values()].find((candidate) =>
        candidate.occurrence_id === occurrenceId && candidate.actor_user_id === actorUserId
      );
      if (existing) {
        existing.ai_run_id = nullableString(v[2]);
        existing.candidate_id = nullableString(v[3]);
        existing.review_state = string(v[5]);
        existing.source_payload_json = string(v[6]);
        existing.updated_at = string(v[8]);
      } else {
        this.db.observationRecordAiReviews.set(string(v[0]), {
          review_id: string(v[0]),
          occurrence_id: occurrenceId,
          ai_run_id: nullableString(v[2]),
          candidate_id: nullableString(v[3]),
          actor_user_id: actorUserId,
          review_state: string(v[5]),
          source_payload_json: string(v[6]),
          created_at: string(v[7]) || now,
          updated_at: string(v[8]) || now
        });
      }
      return {};
    }

    if (normalized.startsWith("INSERT INTO observation_specialist_reviews")) {
      const now = new Date().toISOString();
      const occurrenceId = string(v[1]);
      const actorUserId = string(v[2]);
      const lane = string(v[3]);
      const existing = [...this.db.observationSpecialistReviews.values()].find((candidate) =>
        candidate.occurrence_id === occurrenceId && candidate.actor_user_id === actorUserId && candidate.lane === lane
      );
      if (existing) {
        existing.decision = string(v[4]);
        existing.proposed_name = nullableString(v[5]);
        existing.proposed_rank = nullableString(v[6]);
        existing.accepted_rank = nullableString(v[7]);
        existing.notes = nullableString(v[8]);
        existing.review_class = string(v[9]);
        existing.source_payload_json = string(v[10]);
        existing.updated_at = string(v[12]) || now;
      } else {
        this.db.observationSpecialistReviews.set(string(v[0]), {
          review_id: string(v[0]),
          occurrence_id: occurrenceId,
          actor_user_id: actorUserId,
          lane,
          decision: string(v[4]),
          proposed_name: nullableString(v[5]),
          proposed_rank: nullableString(v[6]),
          accepted_rank: nullableString(v[7]),
          notes: nullableString(v[8]),
          review_class: string(v[9]),
          source_payload_json: string(v[10]),
          created_at: string(v[11]) || now,
          updated_at: string(v[12]) || now
        });
      }
      return {};
    }

    if (normalized.startsWith("INSERT INTO specialist_authorities")) {
      const now = new Date().toISOString();
      this.db.specialistAuthorities.set(string(v[0]), {
        authority_id: string(v[0]),
        subject_user_id: string(v[1]),
        granted_by_user_id: nullableString(v[2]),
        status: "active",
        authority_kind: "taxon_identification",
        scope_taxon_name: string(v[3]),
        scope_taxon_rank: nullableString(v[4]),
        scope_taxon_key: nullableString(v[5]),
        scope_json: string(v[6]),
        granted_at: string(v[7]) || now,
        revoked_at: null,
        expires_at: null,
        reason: nullableString(v[8]),
        source_payload_json: string(v[9]),
        created_at: string(v[10]) || now,
        updated_at: string(v[11]) || now
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO specialist_authority_evidence")) {
      const now = new Date().toISOString();
      this.db.specialistAuthorityEvidence.push({
        evidence_id: string(v[0]),
        authority_id: string(v[1]),
        evidence_type: string(v[2]),
        title: string(v[3]),
        issuer_name: nullableString(v[4]),
        url: nullableString(v[5]),
        notes: nullableString(v[6]),
        source_payload_json: string(v[7]),
        created_at: string(v[8]) || now
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO specialist_authority_audit")) {
      const now = new Date().toISOString();
      this.db.specialistAuthorityAudit.push({
        audit_id: string(v[0]),
        authority_id: nullableString(v[1]),
        actor_user_id: nullableString(v[2]),
        action: normalized.includes("'revoke'") ? "revoke" : normalized.includes("'update'") ? "update" : "grant",
        payload_json: string(v[3]),
        created_at: string(v[4]) || now
      });
      return {};
    }

    if (normalized.startsWith("UPDATE specialist_authorities")) {
      const row = requireRow(this.db.specialistAuthorities, string(v[3]));
      row.status = "revoked";
      row.revoked_at = string(v[0]);
      row.reason = nullableString(v[1]);
      row.updated_at = string(v[2]);
      return {};
    }

    if (normalized.startsWith("INSERT INTO authority_recommendations")) {
      const now = new Date().toISOString();
      this.db.authorityRecommendations.set(string(v[0]), {
        recommendation_id: string(v[0]),
        subject_user_id: string(v[1]),
        source_kind: string(v[2]),
        status: "pending",
        scope_taxon_name: string(v[3]),
        scope_taxon_rank: nullableString(v[4]),
        scope_taxon_key: nullableString(v[5]),
        recommended_by_user_id: nullableString(v[6]),
        granted_authority_id: null,
        resolution_note: null,
        resolved_by_user_id: null,
        resolved_at: null,
        source_payload_json: string(v[7]),
        created_at: string(v[8]) || now,
        updated_at: string(v[9]) || now
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO authority_recommendation_evidence")) {
      const now = new Date().toISOString();
      this.db.authorityRecommendationEvidence.push({
        evidence_id: string(v[0]),
        recommendation_id: string(v[1]),
        evidence_type: string(v[2]),
        title: string(v[3]),
        issuer_name: nullableString(v[4]),
        url: nullableString(v[5]),
        notes: nullableString(v[6]),
        source_payload_json: string(v[7]),
        created_at: string(v[8]) || now
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO authority_recommendation_audit")) {
      const now = new Date().toISOString();
      this.db.authorityRecommendationAudit.push({
        audit_id: string(v[0]),
        recommendation_id: string(v[1]),
        actor_user_id: nullableString(v[2]),
        action: normalized.includes("'grant'") ? "grant" : normalized.includes("'reject'") ? "reject" : "create",
        payload_json: string(v[3]),
        created_at: string(v[4]) || now
      });
      return {};
    }

    if (normalized.startsWith("UPDATE authority_recommendations") && normalized.includes("status = 'granted'")) {
      const row = requireRow(this.db.authorityRecommendations, string(v[5]));
      row.status = "granted";
      row.granted_authority_id = string(v[0]);
      row.resolution_note = nullableString(v[1]);
      row.resolved_by_user_id = nullableString(v[2]);
      row.resolved_at = string(v[3]);
      row.updated_at = string(v[4]);
      return {};
    }

    if (normalized.startsWith("UPDATE authority_recommendations") && normalized.includes("status = 'rejected'")) {
      const row = requireRow(this.db.authorityRecommendations, string(v[4]));
      row.status = "rejected";
      row.resolution_note = nullableString(v[0]);
      row.resolved_by_user_id = nullableString(v[1]);
      row.resolved_at = string(v[2]);
      row.updated_at = string(v[3]);
      return {};
    }

    if (normalized.startsWith("INSERT INTO observation_identification_disputes")) {
      const now = new Date().toISOString();
      this.db.observationIdentificationDisputes.set(string(v[0]), {
        dispute_id: string(v[0]),
        occurrence_id: string(v[1]),
        actor_user_id: string(v[2]),
        kind: string(v[3]),
        proposed_name: nullableString(v[4]),
        proposed_rank: nullableString(v[5]),
        reason: nullableString(v[6]),
        status: "open",
        source_payload_json: string(v[7]),
        created_at: now,
        updated_at: now
      });
      return {};
    }

    if (normalized.startsWith("UPDATE observation_identification_disputes")) {
      const dispute = requireRow(this.db.observationIdentificationDisputes, string(v[4]));
      dispute.status = string(v[0]);
      const note = nullableString(v[1]);
      if (note) dispute.reason = note;
      dispute.source_payload_json = string(v[3]);
      if (dispute.status === "resolved") {
        const payload = JSON.parse(dispute.source_payload_json) as { resolvedBy?: string; resolvedAt?: string };
        dispute.resolved_by_user_id = payload.resolvedBy ?? null;
        dispute.resolved_at = payload.resolvedAt ?? new Date().toISOString();
      }
      dispute.updated_at = new Date().toISOString();
      return {};
    }

    if (normalized.startsWith("INSERT INTO management_candidate_confirmations")) {
      const now = new Date().toISOString();
      const key = `${string(v[1])}:${number(v[2])}:${string(v[4])}`;
      const existing = this.db.managementCandidateConfirmations.get(key);
      this.db.managementCandidateConfirmations.set(key, {
        confirmation_id: existing?.confirmation_id ?? string(v[0]),
        observation_id: string(v[1]),
        candidate_index: number(v[2]),
        confirm_state: string(v[3]),
        actor_user_id: string(v[4]),
        source_payload_json: string(v[5]),
        created_at: existing?.created_at ?? now,
        updated_at: now
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO observation_reassessment_requests")) {
      const now = new Date().toISOString();
      const key = `${string(v[1])}:${string(v[2])}:${string(v[3])}`;
      const existing = this.db.observationReassessmentRequests.get(key);
      this.db.observationReassessmentRequests.set(key, {
        request_id: existing?.request_id ?? string(v[0]),
        observation_id: string(v[1]),
        request_kind: string(v[2]),
        actor_user_id: string(v[3]),
        request_state: "pending",
        source_payload_json: string(v[4]),
        created_at: existing?.created_at ?? now,
        updated_at: now
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO candidate_action_requests")) {
      const now = new Date().toISOString();
      const key = `${string(v[1])}:${string(v[2])}:${string(v[3])}:${string(v[4])}`;
      const existing = this.db.candidateActionRequests.get(key);
      this.db.candidateActionRequests.set(key, {
        request_id: existing?.request_id ?? string(v[0]),
        observation_id: string(v[1]),
        candidate_id: string(v[2]),
        action_kind: string(v[3]),
        actor_user_id: string(v[4]),
        request_state: "pending",
        source_payload_json: string(v[5]),
        created_at: existing?.created_at ?? now,
        updated_at: now
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO guide_record_promotion_requests")) {
      const now = new Date().toISOString();
      const key = `${string(v[1])}:${string(v[2])}`;
      const existing = this.db.guideRecordPromotionRequests.get(key);
      this.db.guideRecordPromotionRequests.set(key, {
        request_id: existing?.request_id ?? string(v[0]),
        guide_record_id: string(v[1]),
        actor_user_id: string(v[2]),
        request_state: "pending",
        source_payload_json: string(v[3]),
        created_at: existing?.created_at ?? now,
        updated_at: now
      });
      return {};
    }

    if (normalized.startsWith("DELETE FROM observation_reactions WHERE occurrence_id = ?")) {
      for (const [key, row] of [...this.db.observationReactions.entries()]) {
        if (row.occurrence_id === string(v[0]) && row.user_id === string(v[1]) && row.reaction_type === string(v[2])) {
          this.db.observationReactions.delete(key);
        }
      }
      return {};
    }

    if (normalized.startsWith("DELETE FROM observation_reactions")) {
      this.db.observationReactions.delete(string(v[0]));
      return {};
    }

    if (normalized.startsWith("UPDATE draft_observations SET processing_state = 'finalized'")) {
      const draft = requireRow(this.db.drafts, string(v[0]));
      draft.processing_state = "finalized";
      draft.finalized_at = new Date().toISOString();
      return {};
    }

    if (normalized.startsWith("UPDATE asset_ledger SET observation_id = ?")) {
      for (const asset of this.db.assets.values()) {
        if (asset.draft_id === string(v[1])) asset.observation_id = string(v[0]);
      }
      return {};
    }

    if (normalized.startsWith("INSERT INTO outbox")) {
      this.db.outbox.set(string(v[0]), {
        outbox_id: string(v[0]),
        topic: string(v[1]) as OutboxRow["topic"],
        target_id: string(v[2]),
        payload_json: string(v[3]),
        partition_month: nullableString(v[4]),
        dispatch_state: "pending",
        attempts: 0,
        last_error: null
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO rollback_write_ledger")) {
      this.db.rollbackLedger.set(string(v[0]), {
        ledger_id: string(v[0]),
        event_type: string(v[1]),
        target_id: string(v[2]),
        partition_month: nullableString(v[3]),
        source_endpoint: string(v[4]),
        payload_json: string(v[5]),
        replay_sql: string(v[6]),
        replay_status: "pending",
        created_at: new Date().toISOString()
      });
      return {};
    }

    if (normalized.startsWith("UPDATE outbox SET dispatch_state = 'dispatched'")) {
      const row = requireRow(this.db.outbox, string(v[0]));
      row.dispatch_state = "dispatched";
      return {};
    }

    if (normalized.startsWith("UPDATE outbox SET attempts = attempts + 1")) {
      const row = requireRow(this.db.outbox, string(v[1]));
      row.attempts += 1;
      row.last_error = nullableString(v[0]);
      return {};
    }

    if (normalized.startsWith("UPDATE asset_ledger SET public_derivative_key = ?") && normalized.includes("exif_scrub_state = 'failed'")) {
      const asset = requireRow(this.db.assets, string(v[3]));
      asset.public_derivative_key = string(v[0]);
      asset.public_derivative_sha256 = string(v[1]);
      asset.public_derivative_metadata_json = string(v[2]);
      asset.exif_scrub_state = "failed";
      return {};
    }

    if (normalized.startsWith("UPDATE asset_ledger SET public_derivative_key = ?")) {
      const asset = requireRow(this.db.assets, string(v[3]));
      asset.public_derivative_key = string(v[0]);
      asset.public_derivative_sha256 = string(v[1]);
      asset.public_derivative_verified_at = new Date().toISOString();
      asset.public_derivative_metadata_json = string(v[2]);
      asset.exif_scrub_state = "scrubbed";
      asset.public_ready_at = new Date().toISOString();
      return {};
    }

    if (normalized.startsWith("INSERT INTO readmodel_public_observations")) {
      this.db.readmodel.set(string(v[0]), {
        observation_id: string(v[0]),
        public_cell: string(v[1]),
        observed_at: string(v[2]),
        taxon_label: nullableString(v[3]),
        asset_count: number(v[4]),
        partition_month: nullableString(v[5])
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO public_map_snapshot_records_v1")) {
      const occurrenceId = string(v[0]);
      const row: PublicMapSnapshotRecordRow = {
        occurrence_id: occurrenceId,
        visit_id: string(v[1]),
        observed_at: string(v[2]),
        display_name: nullableString(v[5]),
        cell_1000: string(v[7]),
        asset_count: number(v[10])
      };
      const index = this.db.publicMapSnapshotRecords.findIndex((record) => record.occurrence_id === occurrenceId);
      if (index >= 0) {
        this.db.publicMapSnapshotRecords[index] = row;
      } else {
        this.db.publicMapSnapshotRecords.push(row);
      }
      return {};
    }

    if (normalized.startsWith("INSERT INTO public_map_snapshot_meta")) {
      this.db.publicMapSnapshotMeta = {
        snapshot_key: "public-map:v1:global",
        generated_at: new Date().toISOString(),
        source_sample_size: this.db.readmodel.size,
        public_record_count: this.db.publicMapSnapshotRecords.length,
        refreshed_by: nullableString(v[0]),
        policy_json: "{\"minCellRecords\":3,\"sensitiveMinCellMeters\":5000,\"municipalityMinCellMeters\":20000,\"bboxScope\":\"fixed_public_cell_cover\",\"policy\":\"k_anonymous_cell_aggregate\",\"exposesSuppressedCounts\":false}"
      };
      return {};
    }

    if (normalized.startsWith("UPDATE observations SET emergency_hidden = 1")) {
      const observation = requireRow(this.db.observations, string(v[0]));
      observation.emergency_hidden = 1;
      return {};
    }

    if (normalized.startsWith("UPDATE observations SET organism_origin = ?")) {
      const observation = requireRow(this.db.observations, string(v[1]));
      observation.organism_origin = string(v[0]);
      return {};
    }

    if (normalized.startsWith("UPDATE observations SET observed_at = ?, partition_month = ?")) {
      const observation = requireRow(this.db.observations, string(v[2]));
      observation.observed_at = string(v[0]);
      observation.partition_month = nullableString(v[1]);
      return {};
    }

    if (normalized.startsWith("UPDATE observations SET exact_lat = ?, exact_lng = ?, public_cell = ?")) {
      const observation = requireRow(this.db.observations, string(v[3]));
      observation.exact_lat = number(v[0]);
      observation.exact_lng = number(v[1]);
      observation.public_cell = string(v[2]);
      return {};
    }

    if (normalized.startsWith("UPDATE readmodel_public_observations SET observed_at = ?")) {
      const row = this.db.readmodel.get(string(v[1]));
      if (row) row.observed_at = string(v[0]);
      return {};
    }

    if (normalized.startsWith("UPDATE readmodel_public_observations SET public_cell = ?")) {
      const row = this.db.readmodel.get(string(v[1]));
      if (row) row.public_cell = string(v[0]);
      return {};
    }

    if (normalized.startsWith("INSERT INTO observation_detail_edit_events")) {
      this.db.observationDetailEditEvents.push({
        edit_id: string(v[0]),
        observation_id: string(v[1]),
        actor_user_id: string(v[2]),
        edit_kind: string(v[3]),
        payload_json: string(v[4])
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO observation_environment_records")) {
      this.db.observationEnvironmentRecords.push({
        record_id: string(v[0]),
        occurrence_id: string(v[1]),
        lat: number(v[2]),
        lng: number(v[3]),
        structured_json: string(v[4]),
        source_lang: "ja"
      });
      return {};
    }

    if (normalized.startsWith("DELETE FROM readmodel_public_observations")) {
      this.db.readmodel.delete(string(v[0]));
      return {};
    }

    if (normalized.startsWith("DELETE FROM public_map_snapshot_records_v1")) {
      const occurrenceId = string(v[0]);
      this.db.publicMapSnapshotRecords = this.db.publicMapSnapshotRecords.filter((row) => row.occurrence_id !== occurrenceId);
      return {};
    }

    if (normalized.startsWith("INSERT INTO production_restore_parity_runs")) {
      this.db.parityRuns.set(string(v[0]), {
        run_id: string(v[0]),
        source_db: string(v[1]),
        collected_at: string(v[2]),
        table_count: number(v[3]),
        critical_json: string(v[4]),
        orphan_json: string(v[5]),
        note: nullableString(v[6])
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO production_restore_parity_metrics")) {
      this.db.parityMetrics.push({
        run_id: string(v[0]),
        metric_type: string(v[1]),
        metric_key: string(v[2]),
        metric_value: string(v[3]),
        detail_json: nullableString(v[4])
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO auth_sessions")) {
      const hasExplicitBanned = normalized.includes("origin-session-lazy-import");
      this.db.authSessions.set(string(v[0]), {
        token_hash: string(v[0]),
        user_id: string(v[1]),
        display_name: string(v[2]),
        role_name: string(v[3]),
        rank_label: nullableString(v[4]),
        banned: hasExplicitBanned ? number(v[5]) : 0,
        expires_at: hasExplicitBanned ? string(v[6]) : string(v[5]),
        last_used_at: null
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO municipal_walk_map_creators")) {
      const creatorId = string(v[0]);
      this.db.municipalWalkMapCreators.set(creatorId, {
        creator_id: creatorId,
        display_name: string(v[2]),
        verification_status: string(v[5]),
        registration_kind: nullableString(v[7]),
        commercial_intent: nullableString(v[8]),
        notes: nullableString(v[11]),
        updated_at: new Date().toISOString()
      });
      return {};
    }

    if (normalized.startsWith("UPDATE municipal_walk_maps SET publish_mode = ?")) {
      const row = requireRow(this.db.municipalWalkMaps, string(v[3]));
      row.publish_mode = string(v[0]);
      row.publication_review_json = string(v[1]);
      row.updated_at = new Date().toISOString();
      return {};
    }

    if (normalized.startsWith("INSERT INTO municipal_walk_maps")) {
      const walkMapId = string(v[0]);
      this.db.municipalWalkMaps.set(walkMapId, {
        walk_map_id: walkMapId,
        municipality_code: string(v[2]),
        municipality: string(v[3]),
        title: string(v[4]),
        summary: string(v[5]),
        theme: string(v[6]),
        publish_mode: string(v[7]),
        route_style: string(v[8]),
        mobility_modes_json: string(v[9]),
        source_references_json: string(v[10]),
        area_hint_json: string(v[11]),
        stop_count: number(v[12]),
        display_order: number(v[13]),
        creator_name: nullableString(v[15]),
        creator_profile_json: string(v[16]),
        route_flexibility_json: string(v[19]),
        public_precision_policy: string(v[20]),
        claim_boundary_json: string(v[21]),
        publication_review_json: string(v[22]),
        updated_at: new Date().toISOString()
      });
      return {};
    }

    if (normalized.startsWith("DELETE FROM municipal_walk_map_stops")) {
      const walkMapId = string(v[0]);
      for (const [key, row] of [...this.db.municipalWalkMapStops.entries()]) {
        if (row.walk_map_id === walkMapId) this.db.municipalWalkMapStops.delete(key);
      }
      return {};
    }

    if (normalized.startsWith("INSERT INTO municipal_walk_map_stops")) {
      this.db.municipalWalkMapStops.set(string(v[0]), {
        stop_id: string(v[0]),
        walk_map_id: string(v[1]),
        display_order: number(v[2]),
        title: string(v[3]),
        note: nullableString(v[4]),
        area_hint_json: string(v[5]),
        safety_note: nullableString(v[6]),
        position: number(v[7]),
        area_kind: string(v[8]),
        access: string(v[10]),
        estimated_minutes: nullableNumber(v[12]),
        notice_cues_json: string(v[13]),
        record_cues_json: string(v[14]),
        safety_notes_json: string(v[15])
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO municipal_walk_map_audit")) {
      this.db.municipalWalkMapAudit.push({
        audit_id: string(v[0]),
        walk_map_id: string(v[1]),
        action: string(v[2]),
        actor_label: string(v[3]),
        payload_json: string(v[4]),
        actor_user_id: nullableString(v[5]),
        before_payload_json: string(v[6]),
        after_payload_json: string(v[7])
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO field_managers")) {
      const now = new Date().toISOString();
      const key = `${string(v[1])}:${string(v[2])}:${string(v[3])}`;
      const existing = this.db.fieldManagers.get(key);
      const row: FieldManagerGrantTestRow = {
        manager_id: existing?.manager_id ?? string(v[0]),
        field_id: string(v[1]),
        user_id: string(v[2]),
        role: string(v[3]),
        granted_at: now,
        granted_by: nullableString(v[4]) ?? existing?.granted_by ?? null,
        expires_at: nullableString(v[5]),
        note: string(v[6]),
        updated_at: now
      };
      this.db.fieldManagers.set(key, row);
      return {};
    }

    if (normalized.startsWith("DELETE FROM field_managers")) {
      this.db.fieldManagers.delete(`${string(v[0])}:${string(v[1])}:${string(v[2])}`);
      return {};
    }

    if (normalized.startsWith("INSERT INTO user_observation_fields")) {
      const now = new Date().toISOString();
      const row: UserObservationFieldTestRow = {
        field_id: string(v[0]),
        owner_user_id: string(v[1]),
        source: "user_defined",
        name: string(v[2]),
        name_kana: string(v[3]),
        summary: string(v[4]),
        prefecture: string(v[5]),
        city: string(v[6]),
        public_cell: string(v[7]),
        public_lat: number(v[8]),
        public_lng: number(v[9]),
        radius_m: number(v[10]),
        area_ha: nullableNumber(v[11]),
        payload_json: string(v[12]),
        created_at: now,
        updated_at: now,
        deleted_at: null
      };
      this.db.userObservationFields.set(row.field_id, row);
      return row as unknown as Record<string, unknown>;
    }

    if (normalized.startsWith("UPDATE user_observation_fields SET")) {
      const row = requireRow(this.db.userObservationFields, string(v[11]));
      if (row.owner_user_id !== string(v[12]) || row.deleted_at) return {};
      row.name = string(v[0]);
      row.name_kana = string(v[1]);
      row.summary = string(v[2]);
      row.prefecture = string(v[3]);
      row.city = string(v[4]);
      row.public_cell = string(v[5]);
      row.public_lat = number(v[6]);
      row.public_lng = number(v[7]);
      row.radius_m = number(v[8]);
      row.area_ha = nullableNumber(v[9]);
      row.payload_json = string(v[10]);
      row.updated_at = new Date().toISOString();
      return row as unknown as Record<string, unknown>;
    }

    if (normalized.startsWith("INSERT INTO walk_sessions")) {
      const existing = nullableString(v[1])
        ? [...this.db.walkSessions.values()].find((row) => row.external_id === nullableString(v[1]))
        : undefined;
      const now = new Date().toISOString();
      const row: WalkSessionRow = {
        walk_session_id: existing?.walk_session_id ?? string(v[0]),
        external_id: nullableString(v[1]),
        user_id: string(v[2]),
        started_at: existing?.started_at ?? string(v[3]),
        ended_at: nullableString(v[4]) ?? existing?.ended_at ?? null,
        distance_m: nullableNumber(v[5]) ?? existing?.distance_m ?? null,
        step_count: nullableNumber(v[6]) ?? existing?.step_count ?? null,
        passive_detection_count: number(v[7]),
        top_species_json: string(v[8]),
        biome: nullableString(v[9]) ?? existing?.biome ?? null,
        source: string(v[10]),
        raw_payload_json: string(v[11]),
        created_at: existing?.created_at ?? now,
        updated_at: now
      };
      this.db.walkSessions.set(row.walk_session_id, row);
      return {};
    }

    if (normalized.startsWith("INSERT INTO track_sessions")) {
      const now = new Date().toISOString();
      this.db.trackSessions.set(string(v[0]), {
        visit_id: string(v[0]),
        session_id: string(v[1]),
        user_id: string(v[2]),
        field_id: nullableString(v[3]),
        place_id: string(v[4]),
        started_at: string(v[5]),
        updated_at: string(v[6]),
        distance_meters: nullableNumber(v[7]),
        step_count: nullableNumber(v[8]),
        first_lat: number(v[9]),
        first_lng: number(v[10]),
        municipality: nullableString(v[11]),
        prefecture: nullableString(v[12]),
        source_payload_json: string(v[13]),
        created_at: this.db.trackSessions.get(string(v[0]))?.created_at ?? now
      });
      return {};
    }

    if (normalized.startsWith("DELETE FROM track_points WHERE visit_id = ?")) {
      const visitId = string(v[0]);
      for (const [key, row] of [...this.db.trackPoints.entries()]) {
        if (row.visit_id === visitId) this.db.trackPoints.delete(key);
      }
      return {};
    }

    if (normalized.startsWith("INSERT INTO track_points")) {
      this.db.trackPoints.set(string(v[0]), {
        point_id: string(v[0]),
        visit_id: string(v[1]),
        observed_at: string(v[2]),
        sequence_no: number(v[3]),
        lat: number(v[4]),
        lng: number(v[5]),
        accuracy_m: nullableNumber(v[6]),
        altitude_m: nullableNumber(v[7]),
        raw_payload_json: string(v[8])
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO passive_audio_ingest_events")) {
      this.db.passiveAudioIngestEvents.set(string(v[0]), {
        ingest_event_id: string(v[0]),
        dedupe_key: string(v[1]),
        source_type: string(v[2]),
        source_id: string(v[3]),
        source_name: string(v[4]),
        site_id: string(v[5]),
        species_label: string(v[15]),
        scientific_name: nullableString(v[16]),
        confidence: number(v[17]),
        model_id: nullableString(v[18]),
        model_version: nullableString(v[19]),
        tier15_candidate: number(v[21]),
        normalized_event_json: string(v[22]),
        provenance_json: string(v[23]),
        visit_id: nullableString(v[24]),
        occurrence_id: nullableString(v[25]),
        audio_segment_id: nullableString(v[26])
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO fieldscan_audio_segments")) {
      const now = new Date().toISOString();
      const segmentId = string(v[0]);
      const existing = this.db.fieldscanAudioSegments.get(segmentId);
      this.db.fieldscanAudioSegments.set(segmentId, {
        segment_id: segmentId,
        external_id: nullableString(v[1]),
        session_id: string(v[2]),
        user_id: nullableString(v[3]),
        visit_id: nullableString(v[4]),
        place_id: nullableString(v[5]),
        recorded_at: string(v[6]),
        duration_sec: number(v[7]),
        lat: nullableNumber(v[8]),
        lng: nullableNumber(v[9]),
        azimuth: nullableNumber(v[10]),
        storage_key: nullableString(v[11]),
        storage_provider: string(v[12]),
        mime_type: string(v[13]),
        bytes: number(v[14]),
        privacy_status: string(v[15]),
        voice_flag: number(v[16]),
        fingerprint_json: string(v[17]),
        meta_json: string(v[18]),
        transcription_status: "pending",
        created_at: existing?.created_at ?? now,
        updated_at: now
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO fieldscan_audio_detections")) {
      this.db.fieldscanAudioDetections.push({
        detection_id: string(v[0]),
        segment_id: string(v[1]),
        detected_taxon: string(v[2]),
        scientific_name: nullableString(v[3]),
        confidence: number(v[4]),
        provider: string(v[5]),
        offset_sec: number(v[6]),
        duration_sec: number(v[7]),
        dual_agree: number(v[8]),
        raw_score_json: string(v[9]),
        created_at: new Date().toISOString()
      });
      return {};
    }

    if (normalized.startsWith("UPDATE fieldscan_audio_segments SET transcription_status = 'skipped'")) {
      const row = requireRow(this.db.fieldscanAudioSegments, string(v[0]));
      row.transcription_status = "skipped";
      row.updated_at = new Date().toISOString();
      return {};
    }

    if (normalized.startsWith("UPDATE fieldscan_audio_segments SET transcription_status = 'done'")) {
      const row = requireRow(this.db.fieldscanAudioSegments, string(v[0]));
      row.transcription_status = "done";
      row.updated_at = new Date().toISOString();
      return {};
    }

    if (normalized.startsWith("UPDATE fieldscan_audio_segments SET privacy_status")) {
      const row = requireRow(this.db.fieldscanAudioSegments, string(v[6]));
      row.privacy_status = string(v[0]);
      row.voice_flag = number(v[1]);
      if (string(v[2]) === "deleted_human_voice") row.storage_key = null;
      if (string(v[3]) === "deleted_human_voice") row.storage_provider = "deleted";
      if (string(v[4]) === "deleted_human_voice") row.bytes = 0;
      row.meta_json = string(v[5]);
      row.updated_at = new Date().toISOString();
      return {};
    }

    if (normalized.startsWith("UPDATE auth_sessions SET last_used_at")) {
      const row = requireRow(this.db.authSessions, string(v[0]));
      row.last_used_at = new Date().toISOString();
      return {};
    }

    if (normalized.startsWith("DELETE FROM auth_sessions")) {
      this.db.authSessions.delete(string(v[0]));
      return {};
    }

    if (normalized.startsWith("INSERT INTO user_area_subscriptions")) {
      const proposedId = string(v[0]);
      const userId = string(v[1]);
      const targetType = string(v[2]);
      const targetId = string(v[3]);
      const existing = [...this.db.areaSubscriptions.values()]
        .find((row) => row.user_id === userId && row.target_type === targetType && row.target_id === targetId);
      const row = existing ?? {
        subscription_id: proposedId,
        user_id: userId,
        target_type: targetType,
        target_id: targetId,
        label: "",
        href: "",
        is_active: 1,
        created_at: "2026-06-16T00:00:00.000Z",
        updated_at: null
      };
      row.label = string(v[4]);
      row.href = string(v[5]);
      row.is_active = 1;
      row.updated_at = new Date().toISOString();
      this.db.areaSubscriptions.set(row.subscription_id, row);
      return {};
    }

    if (normalized.startsWith("DELETE FROM user_area_subscriptions")) {
      const subscriptionId = string(v[0]);
      const row = this.db.areaSubscriptions.get(subscriptionId);
      if (row?.user_id === string(v[1])) this.db.areaSubscriptions.delete(subscriptionId);
      return {};
    }

    if (normalized.startsWith("INSERT INTO taxon_alert_subscriptions")) {
      const row: TaxonAlertSubscriptionRow = {
        subscription_id: string(v[0]),
        user_id: string(v[1]),
        scientific_name: nullableString(v[2]),
        taxon_rank: nullableString(v[3]),
        match_field: string(v[4]),
        trigger_invasive_only: number(v[6]),
        trigger_rare_only: number(v[7]),
        channel: string(v[8]),
        label: string(v[9]),
        is_active: 1,
        created_at: new Date().toISOString()
      };
      this.db.taxonAlertSubscriptions.set(row.subscription_id, row);
      return {};
    }

    if (normalized.startsWith("DELETE FROM taxon_alert_subscriptions")) {
      const subscriptionId = string(v[0]);
      const row = this.db.taxonAlertSubscriptions.get(subscriptionId);
      if (row?.user_id === string(v[1])) this.db.taxonAlertSubscriptions.delete(subscriptionId);
      return {};
    }

    if (normalized.startsWith("UPDATE guide_unlocks SET last_listened_at")) {
      const row = this.db.guideUnlocks.get(`${string(v[0])}:${string(v[1])}`);
      if (row) row.last_listened_at = new Date().toISOString();
      return {};
    }

    if (normalized.startsWith("INSERT INTO guide_interactions")) {
      this.db.guideInteractions.set(string(v[0]), {
        interaction_id: string(v[0]),
        guide_record_id: nullableString(v[1]),
        hypothesis_id: nullableString(v[2]),
        user_id: nullableString(v[3]),
        session_id: string(v[4]),
        interaction_type: string(v[5]),
        payload_json: string(v[6]),
        occurred_at: nullableString(v[7]) ?? new Date().toISOString()
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO guide_records")) {
      const now = new Date().toISOString();
      this.db.guideRecords.set(string(v[0]), {
        guide_record_id: string(v[0]),
        session_id: string(v[1]),
        user_id: nullableString(v[2]),
        lat: number(v[4]),
        lng: number(v[5]),
        scene_summary: string(v[7]),
        detected_species_json: string(v[8]),
        detected_features_json: string(v[9]),
        lang: string(v[11]),
        created_at: now
      });
      return {};
    }

    if (normalized.startsWith("INSERT OR REPLACE INTO guide_record_latency_states")) {
      this.db.guideRecordLatencyStates.set(string(v[0]), {
        guide_record_id: string(v[0]),
        captured_at: nullableString(v[1]),
        returned_at: nullableString(v[2]),
        delivery_state: string(v[4]),
        seen_state: string(v[5]),
        frame_thumb: nullableString(v[6]),
        primary_subject_json: string(v[7]),
        meta_json: string(v[13])
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO guide_route_points")) {
      const key = `${string(v[1])}:${nullableString(v[3]) ?? ""}`;
      if (nullableString(v[3]) && [...this.db.guideRoutePoints.values()].some((row) => `${row.session_id}:${row.client_point_id ?? ""}` === key)) {
        throw new Error("UNIQUE constraint failed: guide_route_points.session_id, guide_route_points.client_point_id");
      }
      this.db.guideRoutePoints.set(string(v[0]), {
        point_id: string(v[0]),
        session_id: string(v[1]),
        user_id: nullableString(v[2]),
        client_point_id: nullableString(v[3]),
        point_kind: string(v[4]),
        guide_mode: string(v[5]),
        lat: number(v[6]),
        lng: number(v[7]),
        observed_at: string(v[8]),
        accuracy_m: nullableNumber(v[9]),
        speed_mps: nullableNumber(v[10])
      });
      return {};
    }

    if (normalized.startsWith("INSERT OR REPLACE INTO guide_session_public_summary")) {
      this.db.guideSessionPublicSummaries.set(`${string(v[1])}:${string(v[2])}`, {
        summary_id: string(v[0]),
        user_id: string(v[1]),
        session_id: string(v[2]),
        record_count: number(v[3]),
        started_at: nullableString(v[4]),
        ended_at: nullableString(v[5]),
        representative_guide_record_id: nullableString(v[6]),
        headline: string(v[7]),
        body: string(v[8]),
        featured_subjects_json: string(v[13]),
        public_location_label: nullableString(v[15]),
        media_thumb_url: nullableString(v[16]),
        updated_at: new Date().toISOString()
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO mobile_field_scene_receipts")) {
      const row: MobileFieldSceneReceiptTestRow = {
        receipt_id: string(v[0]),
        install_id: string(v[1]),
        client_scene_id: string(v[2]),
        session_id: string(v[3]),
        guide_record_id: string(v[4]),
        movement_mode: string(v[5]),
        scene_digest: string(v[6]),
        payload_json: string(v[7]),
        created_at: new Date().toISOString()
      };
      this.db.mobileFieldSceneReceipts.set(`${row.install_id}:${row.client_scene_id}`, row);
      return {};
    }

    if (normalized.startsWith("INSERT INTO guide_record_corrections")) {
      this.db.guideRecordCorrections.set(string(v[0]), {
        correction_id: string(v[0]),
        guide_record_id: string(v[1]),
        user_id: nullableString(v[2]),
        correction_kind: string(v[3]),
        original_payload_json: string(v[4]),
        corrected_payload_json: string(v[5]),
        note: nullableString(v[6]),
        created_at: new Date().toISOString()
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO guide_programs")) {
      const now = string(v[11]);
      const row: GuideProgramTestRow = {
        program_id: string(v[0]),
        slug: string(v[1]),
        title: string(v[2]),
        owner_type: string(v[3]),
        participation_mode: string(v[4]),
        status: string(v[5]),
        starts_at: nullableString(v[6]),
        ends_at: nullableString(v[7]),
        public_summary: nullableString(v[8]),
        safety_policy_json: string(v[9]),
        created_at: this.db.guidePrograms.get(string(v[0]))?.created_at ?? string(v[10]),
        updated_at: now
      };
      this.db.guidePrograms.set(row.program_id, row);
      return {};
    }

    if (normalized.startsWith("DELETE FROM guide_program_spots")) {
      const programId = string(v[0]);
      for (const [key, row] of [...this.db.guideProgramSpots.entries()]) {
        if (row.program_id === programId) this.db.guideProgramSpots.delete(key);
      }
      return {};
    }

    if (normalized.startsWith("INSERT INTO guide_program_spots")) {
      const row: GuideProgramSpotTestRow = {
        program_id: string(v[0]),
        guide_spot_id: string(v[1]),
        sort_order: number(v[2]),
        required_for_completion: 1,
        created_at: string(v[3])
      };
      this.db.guideProgramSpots.set(`${row.program_id}:${row.guide_spot_id}`, row);
      return {};
    }

    if (normalized.startsWith("INSERT INTO guide_program_audit")) {
      this.db.guideProgramAudit.push({
        audit_id: string(v[0]),
        program_id: string(v[1]),
        actor_user_id: nullableString(v[2]),
        action: string(v[3])
      });
      return {};
    }

    if (normalized.startsWith("UPDATE guide_hypothesis_prompt_improvements")) {
      const row = this.db.guidePromptImprovements.get(string(v[1]));
      if (row) row.review_status = string(v[0]);
      return {};
    }

    if (normalized.startsWith("UPDATE guide_hypothesis_prompt_improvement_queue")) {
      const row = this.db.guidePromptQueues.get(string(v[2]));
      if (row) {
        row.queue_status = string(v[0]);
        row.resolved_at = ["resolved", "dismissed"].includes(string(v[1])) ? new Date().toISOString() : null;
      }
      return {};
    }

    if (normalized.startsWith("UPDATE alert_deliveries SET delivery_status = 'pending'")) {
      const row = requireRow(this.db.alertDeliveries, string(v[1]));
      if (row.delivery_status === "sending") {
        row.delivery_status = "pending";
        row.error_message = nullableString(v[0]);
      }
      return {};
    }

    if (normalized.startsWith("UPDATE alert_deliveries SET delivery_status")) {
      const row = requireRow(this.db.alertDeliveries, string(v[3]));
      row.delivery_status = string(v[0]);
      row.delivered_at = nullableString(v[1]) ?? row.delivered_at;
      row.error_message = nullableString(v[2]);
      return {};
    }

    if (normalized.startsWith("UPDATE alert_deliveries")) {
      const now = string(v[0]);
      const userId = string(v[1]);
      const ids = v.slice(2).map((value) => string(value));
      for (const row of this.db.alertDeliveries.values()) {
        if (row.user_id !== userId) continue;
        if (ids.length > 0 && !ids.includes(row.delivery_id)) continue;
        if (ids.length === 0 && row.acknowledged_at) continue;
        row.acknowledged_at = row.acknowledged_at ?? now;
        if (row.delivery_status === "sent") row.delivery_status = "acknowledged";
      }
      return {};
    }

    if (normalized.startsWith("INSERT INTO invasive_reporting_events")) {
      this.db.invasiveReportingEvents.push({
        event_id: string(v[0]),
        occurrence_id: nullableString(v[1]),
        recipient_id: nullableString(v[2]),
        delivery_id: nullableString(v[3]),
        event_status: string(v[4]),
        trigger_source: "cloudflare_alert_delivery",
        payload_json: string(v[5]),
        error_message: nullableString(v[6]),
        created_at: string(v[7])
      });
      return {};
    }

    if (normalized.startsWith("INSERT INTO record_reading_cards")) {
      const visitId = string(v[1]);
      const axis = string(v[2]);
      const existing = [...this.db.recordReadingCards.values()].find((row) => row.visit_id === visitId && row.axis === axis);
      const now = new Date().toISOString();
      const row: RecordReadingCardRow = {
        card_id: existing?.card_id ?? string(v[0]),
        visit_id: visitId,
        axis,
        title: string(v[3]),
        body: string(v[4]),
        sources_json: string(v[5]),
        visibility: string(v[6]) as RecordReadingCardRow["visibility"],
        generation_condition_json: string(v[7]),
        quality_gate_json: string(v[8]),
        model_version: string(v[9]),
        created_by_user_id: nullableString(v[10]),
        created_at: existing?.created_at ?? now,
        updated_at: now
      };
      this.db.recordReadingCards.set(row.card_id, row);
      return {};
    }

    if (normalized.startsWith("UPDATE record_reading_cards SET visibility = 'hidden'")) {
      const card = this.db.recordReadingCards.get(string(v[0]));
      if (card) {
        card.visibility = "hidden";
        card.updated_at = new Date().toISOString();
      }
      return {};
    }

    throw new Error(`Unhandled SQL run: ${this.query}`);
  }

  async first<T>(): Promise<T | null> {
    const normalized = normalize(this.query);
    if (normalized === "SELECT 1 AS ok") {
      return ({ ok: 1 } as T);
    }

    const v = this.values;

    if (normalized.startsWith("SELECT user_id, default_photo_echo_enabled, default_tags_public")) {
      return (this.db.placeMemoryPreferences.get(string(v[0])) as T | undefined) ?? null;
    }

    if (normalized.startsWith("SELECT entry_id FROM place_memory_likes")) {
      return this.db.placeMemoryLikes.has(`${string(v[0])}:${string(v[1])}`) ? ({ entry_id: string(v[0]) } as T) : null;
    }

    if (normalized.startsWith("SELECT COUNT(*) AS count FROM place_memory_likes")) {
      const count = [...this.db.placeMemoryLikes].filter((key) => key.startsWith(`${string(v[0])}:`)).length;
      return ({ count } as T);
    }

    if (normalized.startsWith("SELECT COUNT(*) AS count FROM place_memory_reports")) {
      const count = this.db.placeMemoryReports.filter((row) => row.entry_id === string(v[0])).length;
      return ({ count } as T);
    }

    if (normalized.startsWith("SELECT entry_id, visit_id, occurrence_id, user_id, cell_id, cell_grid_m")) {
      const row = this.db.placeMemoryEntries.get(string(v[0]));
      return row && !row.deleted_at ? (row as T) : null;
    }

    if (normalized.startsWith("SELECT (SELECT COUNT(DISTINCT source_id) FROM reference_access_proofs")) {
      const userId = string(v[0]);
      const userIdNeedsReview = string(v[1]);
      const owned = new Set([...this.db.referenceAccessProofs.values()]
        .filter((row) => row.user_id === userId && ["ai_verified", "user_confirmed", "reviewer_confirmed"].includes(row.verification_status))
        .map((row) => row.source_id));
      const needsReview = new Set([...this.db.referenceAccessProofs.values()]
        .filter((row) => row.user_id === userIdNeedsReview && row.verification_status === "needs_review")
        .map((row) => row.source_id));
      return ({ owned_verified_count: owned.size, needs_review_count: needsReview.size } as T);
    }

    if (normalized.startsWith("SELECT source_id FROM reference_sources WHERE source_id = ?")) {
      const row = this.db.referenceSources.get(string(v[0]));
      return row && row.catalog_status !== "withdrawn" ? ({ source_id: row.source_id } as T) : null;
    }

    if (normalized.startsWith("INSERT INTO user_observation_fields")) {
      const now = new Date().toISOString();
      const row: UserObservationFieldTestRow = {
        field_id: string(v[0]),
        owner_user_id: string(v[1]),
        source: "user_defined",
        name: string(v[2]),
        name_kana: string(v[3]),
        summary: string(v[4]),
        prefecture: string(v[5]),
        city: string(v[6]),
        public_cell: string(v[7]),
        public_lat: number(v[8]),
        public_lng: number(v[9]),
        radius_m: number(v[10]),
        area_ha: nullableNumber(v[11]),
        payload_json: string(v[12]),
        created_at: now,
        updated_at: now,
        deleted_at: null
      };
      this.db.userObservationFields.set(row.field_id, row);
      return row as T;
    }

    if (normalized.startsWith("UPDATE user_observation_fields SET")) {
      const row = this.db.userObservationFields.get(string(v[11]));
      if (!row || row.owner_user_id !== string(v[12]) || row.deleted_at) return null;
      row.name = string(v[0]);
      row.name_kana = string(v[1]);
      row.summary = string(v[2]);
      row.prefecture = string(v[3]);
      row.city = string(v[4]);
      row.public_cell = string(v[5]);
      row.public_lat = number(v[6]);
      row.public_lng = number(v[7]);
      row.radius_m = number(v[8]);
      row.area_ha = nullableNumber(v[9]);
      row.payload_json = string(v[10]);
      row.updated_at = new Date().toISOString();
      return row as T;
    }

    if (normalized.startsWith("SELECT field_id, owner_user_id, source, name, name_kana, summary, prefecture, city")) {
      const row = this.db.userObservationFields.get(string(v[0]));
      return row && !row.deleted_at ? (row as T) : null;
    }

    if (normalized.startsWith("SELECT recommendation_id, subject_user_id, source_kind, status, scope_taxon_name")) {
      const row = this.db.authorityRecommendations.get(string(v[0]));
      return (row as T | undefined) ?? null;
    }

    if (normalized.startsWith("SELECT authority_id, subject_user_id, granted_by_user_id, status, authority_kind")) {
      if (normalized.includes("where subject_user_id = ?")) {
        const scopeTaxonName = string(v[1]).toLowerCase();
        const scopeTaxonRank = nullableString(v[2]) ?? "";
        const scopeTaxonKey = nullableString(v[3]) ?? "";
        const row = [...this.db.specialistAuthorities.values()].find((candidate) =>
          candidate.subject_user_id === string(v[0])
            && candidate.status === "active"
            && candidate.scope_taxon_name.toLowerCase() === scopeTaxonName
            && (candidate.scope_taxon_rank ?? "") === scopeTaxonRank
            && (candidate.scope_taxon_key ?? "") === scopeTaxonKey
        );
        return (row as T | undefined) ?? null;
      }
      const row = this.db.specialistAuthorities.get(string(v[0]));
      return (row as T | undefined) ?? null;
    }

    if (normalized.startsWith("SELECT object_key, mime FROM asset_ledger")) {
      const asset = this.db.assets.get(string(v[0]));
      return asset ? ({ object_key: asset.object_key, mime: asset.mime } as T) : null;
    }

    if (normalized.startsWith("INSERT INTO place_management_policies")) {
      const now = new Date().toISOString();
      const key = `${string(v[0])}:${string(v[1])}`;
      const row: PlaceManagementPolicyRow = {
        place_id: string(v[0]),
        user_id: string(v[1]),
        management_goal: string(v[2]),
        weed_tolerance: string(v[3]),
        invasive_response: string(v[4]),
        mowing_frequency: string(v[5]),
        notes: nullableString(v[6]),
        policy_json: string(v[7]),
        updated_at: now
      };
      this.db.placeManagementPolicies.set(key, row);
      return ({
        place_id: row.place_id,
        user_id: row.user_id,
        management_goal: row.management_goal,
        weed_tolerance: row.weed_tolerance,
        invasive_response: row.invasive_response,
        mowing_frequency: row.mowing_frequency,
        notes: row.notes,
        updated_at: row.updated_at
      } as T);
    }

    if (normalized.startsWith("SELECT user_id, email, password_hash, display_name, role_name, rank_label, banned FROM auth_users")) {
      if (normalized.includes("WHERE user_id = ?")) {
        return ([...this.db.authUsers.values()].find((candidate) => candidate.user_id === string(v[0])) as T | undefined) ?? null;
      }
      return (this.db.authUsers.get(string(v[0]).toLowerCase()) as T | undefined) ?? null;
    }

    if (normalized.startsWith("SELECT user_id, provider, provider_user_id, provider_email, display_name, role_name, rank_label, banned FROM oauth_accounts")) {
      return (this.db.oauthAccounts.get(`${string(v[0])}:${string(v[1])}`) as T | undefined) ?? null;
    }

    if (normalized.startsWith("SELECT * FROM draft_observations")) {
      return (this.db.drafts.get(string(v[0])) as T | undefined) ?? null;
    }

    if (normalized.startsWith("SELECT card_id, visit_id, visibility FROM record_reading_cards")) {
      const row = this.db.recordReadingCards.get(string(v[0]));
      return (row ? {
        card_id: row.card_id,
        visit_id: row.visit_id,
        visibility: row.visibility
      } : null) as T | null;
    }

    if (normalized.startsWith("SELECT ingest_event_id FROM passive_audio_ingest_events")) {
      const row = [...this.db.passiveAudioIngestEvents.values()].find((candidate) => candidate.dedupe_key === string(v[0]));
      return row ? ({ ingest_event_id: row.ingest_event_id } as T) : null;
    }

    if (normalized.startsWith("SELECT segment_id FROM fieldscan_audio_segments WHERE external_id")) {
      const row = [...this.db.fieldscanAudioSegments.values()].find((candidate) => candidate.external_id === string(v[0]));
      return row ? ({ segment_id: row.segment_id } as T) : null;
    }

    if (normalized.startsWith("SELECT segment_id, external_id, session_id, user_id, visit_id, place_id, recorded_at, duration_sec, lat, lng, storage_key, mime_type, bytes, privacy_status, fingerprint_json, meta_json FROM fieldscan_audio_segments WHERE segment_id = ? OR external_id = ?")) {
      const segmentId = nullableString(v[0]);
      const externalId = nullableString(v[1]);
      const row = [...this.db.fieldscanAudioSegments.values()].find((candidate) =>
        (segmentId && candidate.segment_id === segmentId) || (externalId && candidate.external_id === externalId)
      );
      return (row as T | undefined) ?? null;
    }

    if (normalized.startsWith("SELECT segment_id, external_id, session_id, user_id, visit_id, place_id, recorded_at, duration_sec, lat, lng, storage_key, mime_type, bytes, privacy_status, fingerprint_json, meta_json FROM fieldscan_audio_segments WHERE segment_id = ? LIMIT 1")) {
      return (this.db.fieldscanAudioSegments.get(string(v[0])) as T | undefined) ?? null;
    }

    if (normalized.startsWith("SELECT observation_id, public_cell, observed_at, taxon_label")) {
      const observation = this.db.observations.get(string(v[0]));
      if (!observation || observation.visibility !== "public" || observation.emergency_hidden) return null;
      return ({
        observation_id: observation.observation_id,
        public_cell: observation.public_cell,
        observed_at: observation.observed_at,
        taxon_label: observation.taxon_label,
        partition_month: observation.partition_month
      } as T);
    }

    if (normalized.startsWith("SELECT draft_id, owner_user_id, partition_month FROM observations")) {
      const observation = this.db.observations.get(string(v[0]));
      return observation ? ({
        draft_id: observation.draft_id,
        owner_user_id: observation.owner_user_id,
        partition_month: observation.partition_month
      } as T) : null;
    }

    if (normalized.startsWith("SELECT draft_id, owner_user_id FROM observations")) {
      const observation = this.db.observations.get(string(v[0]));
      return observation ? ({
        draft_id: observation.draft_id,
        owner_user_id: observation.owner_user_id
      } as T) : null;
    }

    if (normalized.startsWith("SELECT observation_id, exact_lat, exact_lng, public_cell FROM observations")) {
      const observation = this.db.observations.get(string(v[0]));
      return observation ? ({
        observation_id: observation.observation_id,
        exact_lat: observation.exact_lat,
        exact_lng: observation.exact_lng,
        public_cell: observation.public_cell
      } as T) : null;
    }

    if (normalized.startsWith("SELECT structured_json FROM observation_environment_records")) {
      const row = this.db.observationEnvironmentRecords
        .filter((candidate) => candidate.occurrence_id === string(v[0]))
        .at(-1);
      return row ? ({ structured_json: row.structured_json } as T) : null;
    }

    if (normalized.startsWith("SELECT owner_user_id FROM observations")) {
      const observation = this.db.observations.get(string(v[0]));
      return observation ? ({ owner_user_id: observation.owner_user_id } as T) : null;
    }

    if (normalized.startsWith("SELECT user_id FROM production_import_visits")) {
      const target = string(v[0]);
      const legacyTarget = string(v[1]);
      const visit = [...this.db.productionVisits.values()].find((row) =>
        row.visit_id === target || row.legacy_observation_id === legacyTarget
      );
      return visit ? ({ user_id: visit.user_id } as T) : null;
    }

    if (normalized.startsWith("SELECT v.user_id FROM production_import_occurrences")) {
      const occurrence = this.db.productionOccurrences.get(string(v[0]));
      const visit = occurrence?.visit_id ? this.db.productionVisits.get(occurrence.visit_id) : null;
      return visit ? ({ user_id: visit.user_id } as T) : null;
    }

    if (normalized.startsWith("SELECT 1 AS ok WHERE EXISTS (SELECT 1 FROM observations WHERE observation_id = ?)")) {
      const target = string(v[0]);
      const exists = this.db.observations.has(target)
        || this.db.readmodel.has(string(v[1]))
        || this.db.publicMapSnapshotRecords.some((row) => row.occurrence_id === string(v[2]) || row.visit_id === string(v[3]))
        || this.db.productionPublicReadmodel.has(string(v[5]));
      return exists ? ({ ok: 1 } as T) : null;
    }

    if (normalized.startsWith("SELECT reaction_id FROM observation_reactions")) {
      const row = [...this.db.observationReactions.values()].find((candidate) =>
        candidate.occurrence_id === string(v[0])
        && candidate.user_id === string(v[1])
        && candidate.reaction_type === string(v[2])
      );
      return row ? ({ reaction_id: row.reaction_id } as T) : null;
    }

    if (normalized.startsWith("SELECT COUNT(*) AS count FROM observation_identifications")) {
      const count = [...this.db.observationIdentifications.values()].filter((row) =>
        row.occurrence_id === string(v[0]) && row.is_current === 1
      ).length;
      return ({ count } as T);
    }

    if (normalized.startsWith("SELECT occurrence_id, ai_assessment_status, scientific_name, vernacular_name, taxon_rank")) {
      return (this.db.observationAiReviewTargets.get(string(v[0])) as T | undefined) ?? null;
    }

    if (normalized.startsWith("SELECT COUNT(*) AS count FROM observation_record_ai_reviews")) {
      const stateMatch = normalized.match(/review_state = '([^']+)'/);
      const reviewState = stateMatch?.[1] ?? "";
      const count = [...this.db.observationRecordAiReviews.values()].filter((row) =>
        row.occurrence_id === string(v[0]) && row.review_state === reviewState
      ).length;
      return ({ count } as T);
    }

    if (normalized.startsWith("SELECT COUNT(*) AS count FROM observation_identification_disputes")) {
      const count = [...this.db.observationIdentificationDisputes.values()].filter((row) =>
        row.occurrence_id === string(v[0]) && row.status === "open"
      ).length;
      return ({ count } as T);
    }

    if (normalized.startsWith("SELECT dispute_id, occurrence_id, actor_user_id, kind, proposed_name, proposed_rank")) {
      return (this.db.observationIdentificationDisputes.get(string(v[0])) as T | undefined) ?? null;
    }

    if (normalized.startsWith("SELECT occurrence_id, visit_id, scientific_name, vernacular_name, taxon_rank FROM production_import_occurrences")) {
      return (this.db.productionOccurrences.get(string(v[0])) as T | undefined) ?? null;
    }

    if (normalized.startsWith("SELECT visit_id, user_id, COALESCE(public_visibility, 'public') AS public_visibility, observed_at FROM production_import_visits")) {
      const primary = this.db.productionVisits.get(string(v[0]));
      const byLegacy = [...this.db.productionVisits.values()].find((row) => row.legacy_observation_id === string(v[1]));
      const visit = primary ?? byLegacy;
      return visit ? ({
        visit_id: visit.visit_id,
        user_id: visit.user_id,
        public_visibility: visit.public_visibility ?? "public",
        observed_at: visit.observed_at
      } as T) : null;
    }

    if (normalized.startsWith("SELECT visit_id, legacy_observation_id, place_id, user_id, observed_at,")) {
      if (normalized.includes("WHERE visit_id = ? OR legacy_observation_id = ?")) {
        const target = string(v[0]);
        const legacyTarget = string(v[1]);
        const visit = [...this.db.productionVisits.values()].find((row) =>
          row.visit_id === target || row.legacy_observation_id === legacyTarget
        );
        return visit ? ({
          visit_id: visit.visit_id,
          legacy_observation_id: visit.legacy_observation_id,
          place_id: visit.place_id ?? null,
          user_id: visit.user_id,
          observed_at: visit.observed_at,
          coordinate_uncertainty_m: visit.coordinate_uncertainty_m ?? null,
          public_visibility: visit.public_visibility ?? "public"
        } as T) : null;
      }
      const visit = this.db.productionVisits.get(string(v[0]));
      return visit ? ({
        visit_id: visit.visit_id,
        legacy_observation_id: visit.legacy_observation_id,
        place_id: visit.place_id ?? null,
        user_id: visit.user_id,
        observed_at: visit.observed_at,
        coordinate_uncertainty_m: visit.coordinate_uncertainty_m ?? null,
        public_visibility: visit.public_visibility ?? "public"
      } as T) : null;
    }

    if (normalized.startsWith("SELECT occurrence_id, visit_id FROM production_import_occurrences")) {
      const occurrence = this.db.productionOccurrences.get(string(v[0]));
      return occurrence ? ({
        occurrence_id: occurrence.occurrence_id,
        visit_id: occurrence.visit_id
      } as T) : null;
    }

    if (normalized.startsWith("SELECT COUNT(*) AS count FROM production_import_evidence_assets")) {
      const count = this.db.productionEvidenceAssets.filter((row) =>
        row.visit_id === string(v[0]) &&
        (row.asset_role === "observation_photo" || row.asset_role === "observation_video")
      ).length;
      return ({ count } as T);
    }

    if (normalized.startsWith("SELECT r.observation_id, r.public_cell, r.observed_at, r.taxon_label, r.asset_count")) {
      const read = this.db.readmodel.get(string(v[0]));
      const observation = this.db.observations.get(string(v[0]));
      return read && observation && observation.visibility === "public" && observation.emergency_hidden === 0 ? ({
        ...read,
        owner_user_id: observation.owner_user_id,
        note: observation.note,
        visibility: observation.visibility
      } as T) : null;
    }

    if (normalized.startsWith("SELECT COUNT(*) AS count FROM readmodel_public_observations")) {
      return ({ count: this.db.readmodel.has(string(v[0])) ? 1 : 0 } as T);
    }

    if (normalized.startsWith("SELECT snapshot_key, generated_at, source_sample_size, public_record_count, refreshed_by, policy_json")) {
      return (this.db.publicMapSnapshotMeta as T | null) ?? null;
    }

    if (normalized.startsWith("SELECT field_id, source, admin_level, name, name_kana, summary, prefecture, city")) {
      return (this.db.productionFieldDetails.get(string(v[0])) as T | undefined) ?? null;
    }

    if (normalized.startsWith("SELECT snapshot_id FROM source_snapshots")) {
      const row = [...this.db.sourceSnapshots.values()].find((candidate) =>
        candidate.source_kind === string(v[0]) && candidate.content_sha256 === string(v[1])
      );
      return (row ? { snapshot_id: row.snapshot_id } : null) as T | null;
    }

    if (normalized.startsWith("SELECT snapshot_id, valid_from FROM place_environment_snapshots")) {
      const row = [...this.db.placeEnvironmentSnapshots.values()].find((candidate) =>
        candidate.place_id === string(v[0]) && candidate.metric_kind === string(v[1]) && candidate.valid_to === null
      );
      return (row ? { snapshot_id: row.snapshot_id, valid_from: row.valid_from } : null) as T | null;
    }

    if (normalized.startsWith("SELECT role FROM field_managers")) {
      const userId = string(v[0]);
      const fieldId = string(v[1]);
      const rank = (role: string) => role === "owner" ? 0 : role === "steward" ? 1 : role === "viewer_exact" ? 2 : 3;
      const row = [...this.db.fieldManagers.values()]
        .filter((candidate) =>
          candidate.user_id === userId &&
          candidate.field_id === fieldId &&
          (!candidate.expires_at || candidate.expires_at > new Date().toISOString())
        )
        .sort((a, b) => rank(a.role) - rank(b.role))[0];
      return row ? ({ role: row.role } as T) : null;
    }

    if (normalized.startsWith("SELECT o.observation_id, o.emergency_hidden, COUNT(a.asset_id) AS asset_count")) {
      const observation = this.db.observations.get(string(v[0]));
      if (!observation) return null;
      const assetCount = [...this.db.assets.values()].filter((asset) => asset.observation_id === observation.observation_id).length;
      return ({
        observation_id: observation.observation_id,
        emergency_hidden: observation.emergency_hidden,
        asset_count: assetCount
      } as T);
    }

    if (normalized.startsWith("SELECT object_key FROM video_upload_requests")) {
      const row = this.db.videoUploads.get(string(v[0]));
      return row ? ({ object_key: row.object_key } as T) : null;
    }

    if (normalized.startsWith("SELECT stream_uid, actor_id, observation_id, upload_status")) {
      return (this.db.videoUploads.get(string(v[0])) as T | undefined) ?? null;
    }

    if (
      normalized.startsWith("SELECT COUNT(*) AS count FROM asset_ledger WHERE observation_id = ? AND processing_state = 'uploaded'") &&
      normalized.includes("public_derivative_key IS NULL")
    ) {
      let count = 0;
      for (const asset of this.db.assets.values()) {
        if (
          asset.observation_id === string(v[0]) &&
          asset.processing_state === "uploaded" &&
          (!asset.public_derivative_key ||
            asset.exif_scrub_state !== "scrubbed" ||
            !asset.public_ready_at ||
            !asset.public_derivative_verified_at ||
            !asset.public_derivative_metadata_json)
        ) {
          count++;
        }
      }
      return ({ count } as T);
    }

    if (
      normalized.startsWith("SELECT COUNT(*) AS count FROM asset_ledger WHERE observation_id = ? AND processing_state = 'uploaded'") &&
      normalized.includes("public_derivative_key IS NOT NULL")
    ) {
      let count = 0;
      for (const asset of this.db.assets.values()) {
        if (
          asset.observation_id === string(v[0]) &&
          asset.processing_state === "uploaded" &&
          asset.public_derivative_key &&
          asset.exif_scrub_state === "scrubbed" &&
          asset.public_ready_at &&
          asset.public_derivative_verified_at &&
          asset.public_derivative_metadata_json
        ) {
          count++;
        }
      }
      return ({ count } as T);
    }

    if (normalized.startsWith("SELECT COUNT(*) AS count FROM asset_ledger WHERE observation_id = ?")) {
      let count = 0;
      for (const asset of this.db.assets.values()) {
        if (asset.observation_id === string(v[0])) count++;
      }
      return ({ count } as T);
    }

    if (normalized.startsWith("SELECT partition_month, COUNT(*) AS count, MIN(observed_at) AS earliest_observed_at")) {
      const month = string(v[0]);
      const rows = [...this.db.observations.values()].filter((row) => row.partition_month === month);
      if (rows.length === 0) return null;
      const observed = rows.map((row) => row.observed_at).sort();
      return ({
        partition_month: month,
        count: rows.length,
        earliest_observed_at: observed[0],
        latest_observed_at: observed.at(-1) ?? observed[0]
      } as T);
    }

    if (normalized.startsWith("SELECT run_id, source_db, collected_at, table_count, critical_json, orphan_json, note FROM production_restore_parity_runs")) {
      const runs = [...this.db.parityRuns.values()].sort((a, b) => b.collected_at.localeCompare(a.collected_at));
      return (runs[0] as T | undefined) ?? null;
    }

    if (normalized.startsWith("SELECT token_hash, user_id, display_name, role_name, rank_label, banned, expires_at FROM auth_sessions")) {
      const row = this.db.authSessions.get(string(v[0]));
      if (!row || row.expires_at <= string(v[1])) return null;
      return (row as T);
    }

    if (normalized.startsWith("SELECT walk_session_id FROM walk_sessions WHERE external_id = ?")) {
      const row = [...this.db.walkSessions.values()].find((candidate) => candidate.external_id === string(v[0]));
      return (row ? { walk_session_id: row.walk_session_id } : null) as T | null;
    }

    if (normalized.startsWith("SELECT COUNT(*) AS count FROM contact_submissions")) {
      const value = string(v[0]);
      const count = [...this.db.contactSubmissions.values()].filter((row) => {
        if (normalized.includes("WHERE ip_hash = ?")) return row.ip_hash === value;
        if (normalized.includes("WHERE email = ?")) return row.email === value;
        if (normalized.includes("WHERE user_id = ?")) return row.user_id === value;
        return false;
      }).length;
      return ({ count } as T);
    }

    if (normalized.startsWith("SELECT session_id, legacy_event_id, event_code, title, organizer_user_id, corporation_id")) {
      if (normalized.includes("WHERE event_code = ?")) {
        const row = [...this.db.observationEventSessions.values()].find((candidate) => candidate.event_code === string(v[0]));
        return (row as T | undefined) ?? null;
      }
      return (this.db.observationEventSessions.get(string(v[0])) as T | undefined) ?? null;
    }

    if (normalized.startsWith("SELECT COUNT(*) AS recent FROM observation_event_quests")) {
      const sessionId = string(v[0]);
      const trigger = string(v[1]);
      const recent = [...this.db.observationEventQuests.values()].filter((row) => {
        const payload = JSON.parse(row.payload_json || "{}") as { trigger?: string };
        return row.session_id === sessionId && row.status === "offered" && payload.trigger === trigger;
      }).length;
      return ({ recent } as T);
    }

    if (normalized.startsWith("SELECT quest_id, session_id, team_id, status, payload_json FROM observation_event_quests")) {
      const row = this.db.observationEventQuests.get(string(v[0]));
      if (!row || row.session_id !== string(v[1])) return null;
      return ({
        quest_id: row.quest_id,
        session_id: row.session_id,
        team_id: row.team_id,
        status: row.status,
        payload_json: row.payload_json
      } as T);
    }

    if (normalized.startsWith("SELECT participant_id, user_id, guest_token")) {
      const sessionId = string(v[0]);
      const userId = nullableString(v[1]);
      const guestToken = nullableString(v[2]);
      const row = [...this.db.observationEventParticipants.values()].find((candidate) =>
        candidate.session_id === sessionId &&
        ((candidate.user_id !== null && candidate.user_id === userId) ||
          (candidate.guest_token !== null && candidate.guest_token === guestToken))
      );
      return (row as T | undefined) ?? null;
    }

    if (normalized.startsWith("SELECT COUNT(*) AS visited_cells")) {
      const sessionId = string(v[0]);
      const rows = [...this.db.observationEventMeshCells.values()].filter((row) => row.session_id === sessionId);
      return ({
        visited_cells: rows.length,
        visit_seconds_sum: rows.reduce((sum, row) => sum + row.visit_seconds, 0),
        observation_sum: rows.reduce((sum, row) => sum + row.observation_count, 0),
        absence_sum: rows.reduce((sum, row) => sum + row.absence_count, 0)
      } as T);
    }

    if (normalized.startsWith("SELECT COUNT(*) AS recent FROM observation_event_live_events")) {
      const sessionId = string(v[0]);
      const taxonName = string(v[1]);
      const count = this.db.observationEventLiveEvents.filter((row) => {
        if (row.session_id !== sessionId || row.type !== "observation_added") return false;
        const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
        return payload.taxon_name === taxonName;
      }).length;
      return ({ recent: count } as T);
    }

    if (normalized.startsWith("SELECT course_id, session_id, title, status, config_json, created_by, created_at, updated_at FROM observation_rally_courses")) {
      const row = [...this.db.observationRallyCourses.values()].find((candidate) => candidate.session_id === string(v[0]));
      return (row as T | undefined) ?? null;
    }

    if (normalized.startsWith("SELECT mission_id, course_id, station_id, replacement_for_mission_id")) {
      const row = this.db.observationRallyMissions.get(string(v[0]));
      return (row as T | undefined) ?? null;
    }

    if (normalized.startsWith("SELECT submission_id, session_id, course_id, mission_id")) {
      const row = this.db.observationRallySubmissions.get(string(v[0]));
      return (row as T | undefined) ?? null;
    }

    if (normalized.startsWith("SELECT progress_id, actual_count FROM observation_rally_progress")) {
      const missionId = string(v[0]);
      const scope = string(v[1]);
      const teamId = string(v[2]);
      const participantKey = string(v[3]);
      const stationId = string(v[4]);
      const row = [...this.db.observationRallyProgress.values()].find((candidate) =>
        candidate.mission_id === missionId &&
        candidate.progress_scope === scope &&
        (candidate.team_id ?? "") === teamId &&
        (candidate.participant_key ?? "") === participantKey &&
        (candidate.station_id ?? "") === stationId
      );
      return (row ? { progress_id: row.progress_id, actual_count: row.actual_count } : null) as T | null;
    }

    if (normalized.startsWith("SELECT session_id, source_counts_json")) {
      return (this.db.observationEventCapsules.get(string(v[0])) as T | undefined) ?? null;
    }

    if (normalized.startsWith("SELECT COUNT(*) AS uploaded_assets")) {
      const uploaded = [...this.db.assets.values()].filter((asset) => asset.processing_state === "uploaded");
      return ({
        uploaded_assets: uploaded.length,
        derivative_assets: uploaded.filter((asset) => asset.public_derivative_key).length,
        verified_assets: uploaded.filter((asset) => asset.public_derivative_verified_at).length,
        scrubbed_assets: uploaded.filter((asset) => asset.exif_scrub_state === "scrubbed").length,
        public_ready_assets: uploaded.filter((asset) => asset.public_ready_at).length,
        gps_exif_present: uploaded.filter((asset) => asset.public_derivative_metadata_json?.includes('"gpsExifPresent":true')).length
      } as T);
    }

    if (normalized === "SELECT COUNT(*) AS count FROM legacy_asset_import_ledger WHERE import_status = 'missing_legacy_asset'") {
      return ({ count: this.db.legacyAssetImports.filter((row) => row.import_status === "missing_legacy_asset").length } as T);
    }

    if (normalized === "SELECT COUNT(*) AS count FROM legacy_asset_import_ledger WHERE import_status = 'stream_inventory_pending'") {
      return ({ count: this.db.legacyAssetImports.filter((row) => row.import_status === "stream_inventory_pending").length } as T);
    }

    if (normalized.startsWith("SELECT COUNT(*) AS total, SUM(CASE WHEN exists_on_stream = 1")) {
      const rows = this.db.legacyStreamInventory;
      return ({
        total: rows.length,
        exists_count: rows.filter((row) => row.exists_on_stream === 1).length,
        ready_count: rows.filter((row) => row.ready_to_stream === 1).length,
        nonready_count: rows.filter((row) => row.exists_on_stream === 1 && row.ready_to_stream === 0).length
      } as T);
    }

    if (normalized.startsWith("SELECT COUNT(*) AS count FROM legacy_asset_import_ledger l JOIN legacy_r2_import_ledger r")) {
      const count = this.db.legacyAssetImports.filter((legacy) =>
        legacy.import_status === "missing_legacy_asset" &&
        legacy.asset_id &&
        this.db.legacyR2Imports.some((r2) => r2.asset_id === legacy.asset_id && r2.import_status === "uploaded_verified")
      ).length;
      return ({ count } as T);
    }

    if (normalized.startsWith("SELECT COUNT(*) AS count FROM legacy_stream_inventory s JOIN legacy_asset_import_ledger l")) {
      const count = this.db.legacyStreamInventory.filter((stream) =>
        stream.exists_on_stream === 1 &&
        stream.ready_to_stream === 0 &&
        this.db.legacyAssetImports.some((legacy) =>
          legacy.asset_id === stream.asset_id &&
          legacy.import_status === "stream_inventory_pending"
        )
      ).length;
      return ({ count } as T);
    }

    if (normalized.startsWith("SELECT COUNT(*) AS rows, SUM(asset_count) AS asset_count")) {
      const rows = [...this.db.productionPublicReadmodel.values()];
      return ({
        rows: rows.length,
        asset_count: rows.reduce((sum, row) => sum + row.asset_count, 0),
        public_ready_asset_count: rows.reduce((sum, row) => sum + row.public_ready_asset_count, 0),
        unresolved_asset_count: rows.reduce((sum, row) => sum + row.unresolved_asset_count, 0)
      } as T);
    }

    if (normalized.startsWith("SELECT SUM(asset_count) AS asset_count")) {
      const rows = [...this.db.productionPublicReadmodel.values()];
      return ({
        asset_count: rows.reduce((sum, row) => sum + row.asset_count, 0),
        public_ready_asset_count: rows.reduce((sum, row) => sum + row.public_ready_asset_count, 0),
        unresolved_asset_count: rows.reduce((sum, row) => sum + row.unresolved_asset_count, 0)
      } as T);
    }

    if (normalized.startsWith("SELECT COUNT(*) AS evidence_assets")) {
      const evidenceAssets = this.db.productionEvidenceAssets;
      return ({
        evidence_assets: evidenceAssets.length,
        r2_verified: evidenceAssets.filter((asset) =>
          this.db.legacyR2Imports.some((row) => row.asset_id === asset.asset_id && row.import_status === "uploaded_verified")
        ).length,
        legacy_ledgered: evidenceAssets.filter((asset) =>
          this.db.legacyAssetImports.some((row) => row.asset_id === asset.asset_id)
        ).length,
        stream_exists: evidenceAssets.filter((asset) =>
          this.db.legacyStreamInventory.some((row) => row.asset_id === asset.asset_id && row.exists_on_stream === 1)
        ).length
      } as T);
    }

    if (normalized.startsWith("SELECT COUNT(*) AS verified_count")) {
      const verified = this.db.legacyR2Imports.filter((row) => row.import_status === "uploaded_verified");
      return ({
        verified_count: verified.length,
        verified_bytes: verified.reduce((sum, row) => sum + (row.verified_bytes ?? row.uploaded_bytes ?? 0), 0),
        checksum_match_count: verified.filter((row) =>
          row.uploaded_sha256 === row.expected_sha256 &&
          row.verified_sha256 === row.expected_sha256 &&
          row.uploaded_bytes === row.expected_bytes &&
          row.verified_bytes === row.expected_bytes
        ).length
      } as T);
    }

    if (normalized.startsWith("SELECT COUNT(*) AS count FROM rollback_write_ledger WHERE target_id LIKE ? OR JSON_EXTRACT")) {
      const prefix = likePrefix(string(v[0]));
      const count = [...this.db.rollbackLedger.values()]
        .filter((row) => row.target_id.startsWith(prefix) || payloadObservationId(row)?.startsWith(prefix))
        .length;
      return ({ count } as T);
    }

    if (normalized.startsWith("SELECT COUNT(*) AS count FROM rollback_write_ledger WHERE event_type IN ('observation.upsert'")) {
      const prefix = this.values.length > 0 ? likePrefix(string(v[0])) : null;
      const count = [...this.db.rollbackLedger.values()]
        .filter((row) =>
          ["observation.upsert", "observation.finalize"].includes(row.event_type) &&
          (!prefix || row.target_id.startsWith(prefix))
        )
        .length;
      return ({ count } as T);
    }

    if (normalized.startsWith("SELECT COUNT(*) AS count FROM rollback_write_ledger WHERE event_type IN ('asset.photo.upload'")) {
      const prefix = this.values.length > 0 ? likePrefix(string(v[0])) : null;
      const count = [...this.db.rollbackLedger.values()]
        .filter((row) =>
          ["asset.photo.upload", "asset.video.finalize"].includes(row.event_type) &&
          (!prefix || payloadObservationId(row)?.startsWith(prefix))
        )
        .length;
      return ({ count } as T);
    }

    if (normalized.startsWith("SELECT COUNT(*) AS count FROM rollback_write_ledger")) {
      return ({ count: this.db.rollbackLedger.size } as T);
    }

    if (normalized.startsWith("SELECT COUNT(*) AS count FROM observations")) {
      const prefix = this.values.length > 0 ? likePrefix(string(v[0])) : null;
      const count = [...this.db.observations.values()]
        .filter((row) => !prefix || row.observation_id.startsWith(prefix))
        .length;
      return ({ count } as T);
    }

    if (normalized.startsWith("SELECT COUNT(*) AS count FROM asset_ledger WHERE observation_id")) {
      const prefix = this.values.length > 0 ? likePrefix(string(v[0])) : null;
      const count = [...this.db.assets.values()]
        .filter((row) => row.observation_id && (!prefix || row.observation_id.startsWith(prefix)))
        .length;
      return ({ count } as T);
    }

    if (normalized.startsWith("SELECT subscription_id FROM user_area_subscriptions WHERE user_id = ? AND target_type = ? AND target_id = ?")) {
      const row = [...this.db.areaSubscriptions.values()]
        .find((candidate) =>
          candidate.user_id === string(v[0]) &&
          candidate.target_type === string(v[1]) &&
          candidate.target_id === string(v[2])
        );
      return row ? ({ subscription_id: row.subscription_id } as T) : null;
    }

    if (normalized.startsWith("SELECT subscription_id FROM user_area_subscriptions WHERE subscription_id = ? AND user_id = ?")) {
      const row = this.db.areaSubscriptions.get(string(v[0]));
      return row?.user_id === string(v[1]) ? ({ subscription_id: row.subscription_id } as T) : null;
    }

    if (normalized.startsWith("SELECT subscription_id FROM taxon_alert_subscriptions WHERE subscription_id = ? AND user_id = ?")) {
      const row = this.db.taxonAlertSubscriptions.get(string(v[0]));
      return row?.user_id === string(v[1]) ? ({ subscription_id: row.subscription_id } as T) : null;
    }

    if (normalized.startsWith("SELECT guide_record_id FROM mobile_field_scene_receipts")) {
      const row = this.db.mobileFieldSceneReceipts.get(`${string(v[0])}:${string(v[1])}`);
      return row ? ({ guide_record_id: row.guide_record_id } as T) : null;
    }

    if (normalized.startsWith("SELECT gr.guide_record_id, gr.user_id, gr.occurrence_id")) {
      const row = this.db.guideRecords.get(string(v[0]));
      if (!row) return null;
      const latency = this.db.guideRecordLatencyStates.get(row.guide_record_id);
      return ({
        guide_record_id: row.guide_record_id,
        user_id: row.user_id,
        occurrence_id: null,
        lat: row.lat,
        lng: row.lng,
        frame_thumb: latency?.frame_thumb ?? null
      } as T);
    }

    if (normalized.startsWith("SELECT COUNT(*) AS unread_count FROM alert_deliveries")) {
      const count = [...this.db.alertDeliveries.values()]
        .filter((row) => row.user_id === string(v[0]) && row.acknowledged_at === null)
        .length;
      return ({ unread_count: count } as T);
    }

    if (normalized.startsWith("SELECT COUNT(*) AS count FROM alert_deliveries")) {
      const recipientId = nullableString(v[0]);
      const since = string(v[1]);
      const count = [...this.db.alertDeliveries.values()]
        .filter((row) =>
          row.recipient_id === recipientId &&
          (row.delivery_status === "sent" || row.delivery_status === "acknowledged") &&
          (row.delivered_at ?? "") >= since
        )
        .length;
      return ({ count } as T);
    }

    if (normalized.startsWith("UPDATE alert_deliveries SET delivery_status = 'sending'")) {
      const row = requireRow(this.db.alertDeliveries, string(v[0]));
      if (row.delivery_status !== "pending") return null;
      row.delivery_status = "sending";
      row.error_message = null;
      return ({ delivery_id: row.delivery_id } as T);
    }

    if (normalized.startsWith("SELECT m.walk_map_id, m.municipality_code, m.municipality, m.title, m.summary, m.theme, m.publish_mode")) {
      const row = this.db.municipalWalkMaps.get(string(v[0]));
      if (!row) return null;
      return ({
        walk_map_id: row.walk_map_id,
        municipality_code: row.municipality_code,
        municipality: row.municipality,
        title: row.title,
        summary: row.summary,
        theme: row.theme,
        publish_mode: row.publish_mode,
        creator_name: row.creator_name ?? null,
        creator_profile_json: row.creator_profile_json ?? "{}",
        route_flexibility_json: row.route_flexibility_json ?? "{}",
        source_references_json: row.source_references_json,
        publication_review_json: row.publication_review_json ?? "{}",
        updated_at: row.updated_at ?? null,
        stop_count: row.stop_count
      } as T);
    }

    if (normalized.startsWith("SELECT walk_map_id, municipality_code, municipality, title, summary, theme, publish_mode")) {
      const row = this.db.municipalWalkMaps.get(string(v[0]));
      if (!row || (row.publish_mode !== "public_preview" && row.publish_mode !== "public")) return null;
      return ({
        walk_map_id: row.walk_map_id,
        municipality_code: row.municipality_code,
        municipality: row.municipality,
        title: row.title,
        summary: row.summary,
        theme: row.theme,
        publish_mode: row.publish_mode,
        route_style: row.route_style,
        mobility_modes_json: row.mobility_modes_json,
        stop_count: row.stop_count,
        source_references_json: row.source_references_json,
        area_hint_json: row.area_hint_json,
        route_flexibility_json: row.route_flexibility_json ?? "{}",
        public_precision_policy: row.public_precision_policy ?? "mesh_or_coarser",
        claim_boundary_json: row.claim_boundary_json ?? "[]",
        updated_at: row.updated_at ?? null
      } as T);
    }

    if (normalized.startsWith("SELECT a.public_derivative_key, a.mime")) {
      const visitId = string(v[0]);
      const legacyRelativePath = string(v[1]);
      const row = this.db.productionEvidenceAssets
        .filter((asset) => asset.visit_id === visitId && asset.legacy_relative_path === legacyRelativePath)
        .map((evidenceAsset) => this.db.assets.get(evidenceAsset.asset_id))
        .find((asset): asset is AssetRow =>
          Boolean(
            asset &&
            asset.processing_state === "uploaded" &&
            asset.exif_scrub_state === "scrubbed" &&
            asset.public_ready_at &&
            asset.public_derivative_key
          )
        );
      return row ? ({ public_derivative_key: row.public_derivative_key, mime: row.mime } as T) : null;
    }

    if (normalized.startsWith("INSERT INTO field_managers")) {
      const now = new Date().toISOString();
      const key = `${string(v[1])}:${string(v[2])}:${string(v[3])}`;
      const existing = this.db.fieldManagers.get(key);
      const row: FieldManagerGrantTestRow = {
        manager_id: existing?.manager_id ?? string(v[0]),
        field_id: string(v[1]),
        user_id: string(v[2]),
        role: string(v[3]),
        granted_at: now,
        granted_by: nullableString(v[4]) ?? existing?.granted_by ?? null,
        expires_at: nullableString(v[5]),
        note: string(v[6]),
        updated_at: now
      };
      this.db.fieldManagers.set(key, row);
      return ({
        manager_id: row.manager_id,
        field_id: row.field_id,
        user_id: row.user_id,
        role: row.role,
        granted_at: row.granted_at,
        granted_by: row.granted_by,
        expires_at: row.expires_at,
        note: row.note
      } as T);
    }

    throw new Error(`Unhandled SQL first: ${this.query}`);
  }

  async all<T>(): Promise<{ results: T[] }> {
    const normalized = normalize(this.query);
    const v = this.values;
    if (normalized.startsWith("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN")) {
      const rows = this.db.environmentRecordTablesAvailable
        ? [{ name: "observation_environment_records" }, { name: "observation_detail_edit_events" }]
        : [];
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT pme.entry_id, pme.visit_id, pme.occurrence_id")) {
      const viewerUserId = string(v[0]);
      const cellId = string(v[2]);
      const limit = number(v[4]);
      const rows = [...this.db.placeMemoryEntries.values()]
        .filter((row) =>
          row.cell_id === cellId &&
          !row.deleted_at &&
          row.moderation_status === "visible" &&
          !this.db.placeMemoryHidden.has(`${row.entry_id}:${viewerUserId}`)
        )
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, limit)
        .map((row) => ({
          ...row,
          like_count: [...this.db.placeMemoryLikes].filter((key) => key.startsWith(`${row.entry_id}:`)).length,
          liked_by_me: this.db.placeMemoryLikes.has(`${row.entry_id}:${viewerUserId}`) ? 1 : 0,
          own_entry: row.user_id === viewerUserId ? 1 : 0
        }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT rs.source_id, rs.title, rs.author_text, rs.publisher, rs.publication_year")) {
      const userId = string(v[0]);
      const selectedByUserId = string(v[1]);
      const limit = v.length >= 5 ? 80 : number(v[v.length - 1]);
      const rows = [...this.db.referenceSources.values()]
        .filter((row) => !["withdrawn", "duplicate"].includes(row.catalog_status))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, limit)
        .map((row) => {
          const proofs = [...this.db.referenceAccessProofs.values()].filter((proof) => proof.source_id === row.source_id && proof.user_id === userId);
          const owned = proofs.some((proof) => ["ai_verified", "user_confirmed", "reviewer_confirmed"].includes(proof.verification_status));
          const needsReview = proofs.some((proof) => proof.verification_status === "needs_review");
          return {
            ...row,
            owned_status: owned ? "owned_verified" : needsReview ? "needs_review" : "not_owned",
            latest_proof_at: proofs.map((proof) => proof.updated_at).sort().at(-1) ?? null,
            used_count: this.db.referenceSelections.filter((selection) => selection.source_id === row.source_id && selection.selected_by_user_id === selectedByUserId).length,
            official_correction_count: [...this.db.referenceCorrections.values()].filter((correction) => correction.source_id === row.source_id && correction.verification_status === "official_confirmed").length
          };
        });
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT rs.source_id, rs.title, rs.taxon_labels_json")) {
      const userId = string(v[0]);
      const rows = [...this.db.referenceAccessProofs.values()]
        .filter((proof) => proof.user_id === userId)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, 5)
        .flatMap((proof) => {
          const source = this.db.referenceSources.get(proof.source_id);
          if (!source) return [];
          return [{
            source_id: source.source_id,
            title: source.title,
            taxon_labels_json: source.taxon_labels_json,
            status: proof.verification_status,
            used_count: this.db.referenceSelections.filter((selection) => selection.source_id === source.source_id && selection.selected_by_user_id === userId).length
          }];
        });
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT correction_id, source_id, locator, original_name, corrected_name")) {
      const rows = [...this.db.referenceCorrections.values()]
        .filter((row) => row.source_id === string(v[0]))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT authority_id, subject_user_id, granted_by_user_id, status, authority_kind")) {
      const rows = [...this.db.specialistAuthorities.values()]
        .filter((row) => normalized.includes("where subject_user_id = ?") ? row.subject_user_id === string(v[0]) && row.status === "active" : true)
        .sort((a, b) => b.granted_at.localeCompare(a.granted_at));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT evidence_id, authority_id, evidence_type")) {
      return { results: [...this.db.specialistAuthorityEvidence].sort((a, b) => b.created_at.localeCompare(a.created_at)) as T[] };
    }
    if (normalized.startsWith("SELECT audit_id, authority_id, actor_user_id, action")) {
      return { results: [...this.db.specialistAuthorityAudit].sort((a, b) => b.created_at.localeCompare(a.created_at)) as T[] };
    }
    if (normalized.startsWith("SELECT recommendation_id, subject_user_id, source_kind, status, scope_taxon_name")) {
      let rows = [...this.db.authorityRecommendations.values()];
      if (normalized.includes("where subject_user_id = ?")) rows = rows.filter((row) => row.subject_user_id === string(v[0]));
      if (normalized.includes("where status = 'pending'")) rows = rows.filter((row) => row.status === "pending");
      rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT evidence_id, recommendation_id, evidence_type")) {
      return { results: [...this.db.authorityRecommendationEvidence].sort((a, b) => b.created_at.localeCompare(a.created_at)) as T[] };
    }
    if (normalized.startsWith("SELECT segment_id, external_id, session_id, user_id, visit_id, place_id, recorded_at, duration_sec, lat, lng, storage_key, mime_type, bytes, privacy_status, fingerprint_json, meta_json FROM fieldscan_audio_segments WHERE session_id = ?")) {
      const rows = [...this.db.fieldscanAudioSegments.values()]
        .filter((row) => row.session_id === string(v[0]))
        .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at) || a.segment_id.localeCompare(b.segment_id));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT d.segment_id, d.detected_taxon, d.confidence, d.provider, d.dual_agree FROM fieldscan_audio_detections")) {
      const sessionId = string(v[0]);
      const rows = this.db.fieldscanAudioDetections
        .filter((row) => {
          const segment = this.db.fieldscanAudioSegments.get(row.segment_id);
          return segment?.session_id === sessionId && segment.privacy_status === "clean";
        })
        .map((row) => ({
          segment_id: row.segment_id,
          detected_taxon: row.detected_taxon,
          confidence: row.confidence,
          provider: row.provider,
          dual_agree: row.dual_agree
        }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT visit_id, observed_at FROM production_import_visits")) {
      const placeId = string(v[0]);
      const rows = [...this.db.productionVisits.values()]
        .filter((row) => row.place_id === placeId && (row.public_visibility ?? "public") !== "private")
        .sort((a, b) => (b.observed_at ?? "").localeCompare(a.observed_at ?? "") || b.visit_id.localeCompare(a.visit_id))
        .slice(0, 80)
        .map((row) => ({ visit_id: row.visit_id, observed_at: row.observed_at }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT occurrence_id, scientific_name, vernacular_name FROM production_import_occurrences")) {
      const visitId = string(v[0]);
      const rows = [...this.db.productionOccurrences.values()]
        .filter((row) => row.visit_id === visitId)
        .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.occurrence_id.localeCompare(b.occurrence_id))
        .slice(0, 8)
        .map((row) => ({
          occurrence_id: row.occurrence_id,
          scientific_name: row.scientific_name,
          vernacular_name: row.vernacular_name
        }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT action_id, occurred_at, action_kind, description FROM stewardship_actions")) {
      const placeId = string(v[0]);
      const rows = [...this.db.stewardshipActions.values()]
        .filter((row) => row.place_id === placeId)
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at) || b.action_id.localeCompare(a.action_id))
        .slice(0, 40)
        .map((row) => ({
          action_id: row.action_id,
          occurred_at: row.occurred_at,
          action_kind: row.action_kind,
          description: row.description
        }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT distance_m, passive_detection_count, top_species_json FROM walk_sessions")) {
      const userId = string(v[0]);
      const from = string(v[1]);
      const to = string(v[2]);
      const rows = [...this.db.walkSessions.values()]
        .filter((row) => row.user_id === userId && row.started_at >= from && row.started_at < to)
        .map((row) => ({
          distance_m: row.distance_m,
          passive_detection_count: row.passive_detection_count,
          top_species_json: row.top_species_json
        }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT identification_id, actor_user_id, proposed_name, proposed_rank, stance")) {
      const rows = [...this.db.observationIdentifications.values()]
        .filter((row) => row.occurrence_id === string(v[0]) && row.is_current === 1)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.created_at.localeCompare(a.created_at))
        .map((row) => ({
          identification_id: row.identification_id,
          actor_user_id: row.actor_user_id,
          proposed_name: row.proposed_name,
          proposed_rank: row.proposed_rank,
          stance: row.stance,
          source_payload_json: row.source_payload_json,
          created_at: row.created_at
        }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT dispute_id, actor_user_id, kind, proposed_name, proposed_rank, reason, status, created_at")) {
      const rows = [...this.db.observationIdentificationDisputes.values()]
        .filter((row) => row.occurrence_id === string(v[0]) && row.status === "open")
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((row) => ({
          dispute_id: row.dispute_id,
          actor_user_id: row.actor_user_id,
          kind: row.kind,
          proposed_name: row.proposed_name,
          proposed_rank: row.proposed_rank,
          reason: row.reason,
          status: row.status,
          created_at: row.created_at
        }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT guide_spot_id, program_id, distance_band, first_unlocked_at, last_unlocked_at, last_listened_at FROM guide_unlocks")) {
      const rows = [...this.db.guideUnlocks.values()]
        .filter((row) => row.user_id === string(v[0]))
        .sort((a, b) => b.last_unlocked_at.localeCompare(a.last_unlocked_at));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT scene_digest, payload_json, created_at FROM mobile_field_scene_receipts")) {
      const rows = [...this.db.mobileFieldSceneReceipts.values()]
        .filter((row) => row.session_id === string(v[0]))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 50)
        .map((row) => ({ scene_digest: row.scene_digest, payload_json: row.payload_json, created_at: row.created_at }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT gr.guide_record_id, gr.session_id, gr.user_id, gr.lat, gr.lng, gr.scene_summary")) {
      const userId = string(v[0]);
      const sessionId = string(v[1]);
      const rows = [...this.db.guideRecords.values()]
        .filter((row) => row.user_id === userId && row.session_id === sessionId)
        .map((row) => {
          const latency = this.db.guideRecordLatencyStates.get(row.guide_record_id);
          return {
            guide_record_id: row.guide_record_id,
            session_id: row.session_id,
            user_id: row.user_id,
            lat: row.lat,
            lng: row.lng,
            scene_summary: row.scene_summary,
            detected_species_json: row.detected_species_json,
            detected_features_json: row.detected_features_json,
            created_at: row.created_at,
            captured_at: latency?.captured_at ?? null,
            returned_at: latency?.returned_at ?? null,
            frame_thumb: latency?.frame_thumb ?? null,
            primary_subject_json: latency?.primary_subject_json ?? "{}"
          };
        })
        .sort((a, b) => (a.captured_at ?? a.returned_at ?? a.created_at).localeCompare(b.captured_at ?? b.returned_at ?? b.created_at));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT summary_id, user_id, session_id, record_count")) {
      const userId = nullableString(v[0]);
      const limit = number(v[2]);
      const rows = [...this.db.guideSessionPublicSummaries.values()]
        .filter((row) => !userId || row.user_id === userId)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, limit)
        .map((row) => ({
          summary_id: row.summary_id,
          user_id: row.user_id,
          session_id: row.session_id,
          record_count: row.record_count,
          started_at: row.started_at,
          ended_at: row.ended_at,
          representative_guide_record_id: row.representative_guide_record_id,
          headline: row.headline,
          body: row.body,
          featured_subjects_json: row.featured_subjects_json,
          public_location_label: row.public_location_label,
          media_thumb_url: row.media_thumb_url,
        }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT session_id, lat, lng, observed_at, point_kind, guide_mode")) {
      const userId = string(v[0]);
      const limit = number(v[1]);
      const rows = [...this.db.guideRoutePoints.values()]
        .filter((row) => row.user_id === userId)
        .sort((a, b) => b.observed_at.localeCompare(a.observed_at))
        .slice(0, limit)
        .map((row) => ({
          session_id: row.session_id,
          lat: row.lat,
          lng: row.lng,
          observed_at: row.observed_at,
          point_kind: row.point_kind,
          guide_mode: row.guide_mode,
          accuracy_m: row.accuracy_m,
          speed_mps: row.speed_mps
        }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT program_id, slug, title, owner_type, participation_mode, status")) {
      let rows = [...this.db.guidePrograms.values()];
      if (normalized.includes("WHERE status = 'published'")) {
        rows = rows.filter((row) => row.status === "published" && row.owner_type !== "school");
      } else if (normalized.includes("WHERE program_id = ?")) {
        rows = rows.filter((row) => row.program_id === string(v[0]));
      }
      rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.program_id.localeCompare(b.program_id));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT program_id, guide_spot_id, sort_order, required_for_completion FROM guide_program_spots")) {
      const rows = [...this.db.guideProgramSpots.values()]
        .sort((a, b) => a.program_id.localeCompare(b.program_id) || a.sort_order - b.sort_order || a.guide_spot_id.localeCompare(b.guide_spot_id));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT mesh_key, center_lat, center_lng, guide_record_count, contributor_count")) {
      const publicOnly = number(v[0]) === 1;
      const limit = number(v[1]);
      const rows = [...this.db.guideEnvironmentMeshCells.values()]
        .filter((row) => !publicOnly || row.guide_record_count >= 3 || row.contributor_count >= 2)
        .sort((a, b) => (b.last_seen_at ?? "").localeCompare(a.last_seen_at ?? "") || b.guide_record_count - a.guide_record_count)
        .slice(0, limit);
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT hypothesis_id, mesh_key, place_id, claim_type")) {
      const limit = number(v[0]);
      const rows = [...this.db.regionalHypotheses.values()]
        .filter((row) => row.review_status !== "rejected")
        .sort((a, b) => b.confidence - a.confidence || b.generated_at.localeCompare(a.generated_at))
        .slice(0, limit);
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT run_id, trigger_source, status, diagnosis_date")) {
      const rows = [...this.db.guideEnvironmentRefreshRuns.values()]
        .sort((a, b) => b.started_at.localeCompare(a.started_at))
        .slice(0, 1);
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT (SELECT COUNT(*) FROM guide_environment_mesh_cells) AS mesh_cells")) {
      const publicMeshCells = [...this.db.guideEnvironmentMeshCells.values()]
        .filter((row) => row.guide_record_count >= 3 || row.contributor_count >= 2).length;
      const result = {
        mesh_cells: this.db.guideEnvironmentMeshCells.size,
        public_mesh_cells: publicMeshCells,
        hypotheses: [...this.db.regionalHypotheses.values()].filter((row) => row.review_status !== "rejected").length,
        helpful_interactions: [...this.db.guideInteractions.values()].filter((row) => row.interaction_type === "helpful").length,
        wrong_interactions: [...this.db.guideInteractions.values()].filter((row) => row.interaction_type === "wrong").length,
        prompt_improvements: [...this.db.guidePromptImprovements.values()].filter((row) => row.review_status !== "rejected").length
      };
      return { results: [result as T] };
    }
    if (normalized.startsWith("SELECT COUNT(*) AS unlock_count")) {
      const rows = [...this.db.guideUnlocks.values()].filter((row) => row.program_id === string(v[0]));
      const result = {
        unlock_count: rows.length,
        play_count: rows.filter((row) => row.last_listened_at).length,
        participants: new Set(rows.map((row) => row.user_id)).size
      };
      return { results: [result as T] };
    }
    if (normalized.startsWith("SELECT improvement_id, source_key, improvement_type, label")) {
      const any = number(v[0]) === 1;
      const status = string(v[1]);
      const limit = number(v[2]);
      const rows = [...this.db.guidePromptImprovements.values()]
        .filter((row) => any || row.review_status === status)
        .sort((a, b) => b.support_count - a.support_count || b.generated_at.localeCompare(a.generated_at))
        .slice(0, limit);
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT queue_id, claim_type, trigger, wrong_count")) {
      const limit = number(v[0]);
      const rows = [...this.db.guidePromptQueues.values()]
        .filter((row) => ["open", "in_review"].includes(row.queue_status))
        .sort((a, b) => b.wrong_count - a.wrong_count || b.last_seen_at.localeCompare(a.last_seen_at))
        .slice(0, limit);
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT live_event_id, session_id, type, scope, team_id, payload_json, created_at")) {
      const sessionId = string(v[0]);
      const limit = number(v[1]);
      const rows = this.db.observationEventLiveEvents
        .filter((row) => row.session_id === sessionId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit)
        .map((row) => ({
          live_event_id: row.live_event_id,
          session_id: row.session_id,
          type: row.type,
          scope: row.scope,
          team_id: row.team_id,
          payload_json: row.payload_json,
          created_at: row.created_at
        }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT live_event_id, session_id, type, scope, actor_user_id")) {
      const sessionId = string(v[0]);
      const limit = number(v[1]);
      const rows = this.db.observationEventLiveEvents
        .filter((row) => row.session_id === sessionId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit)
        .map((row) => ({
          live_event_id: row.live_event_id,
          session_id: row.session_id,
          type: row.type,
          scope: row.scope,
          actor_user_id: row.actor_user_id,
          actor_guest_token: row.actor_guest_token,
          team_id: row.team_id,
          payload_json: row.payload_json,
          created_at: row.created_at
        }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT session_id, legacy_event_id, event_code, title, organizer_user_id, corporation_id")) {
      const rows = [...this.db.observationEventSessions.values()]
        .filter((row) => row.ended_at === null && row.started_at <= new Date().toISOString())
        .sort((a, b) => b.started_at.localeCompare(a.started_at))
        .slice(0, 50);
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT team_id, name, color, lead_user_id")) {
      const sessionId = string(v[0]);
      const rows = [...this.db.observationEventTeams.values()]
        .filter((row) => row.session_id === sessionId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT participant_id, user_id, guest_token, display_name")) {
      const sessionId = string(v[0]);
      const rows = [...this.db.observationEventParticipants.values()]
        .filter((row) => row.session_id === sessionId)
        .sort((a, b) => (a.checked_in_at ?? a.created_at).localeCompare(b.checked_in_at ?? b.created_at));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT absence_id, session_id, user_id, guest_token")) {
      const sessionId = string(v[0]);
      const rows = this.db.observationEventAbsences
        .filter((row) => row.session_id === sessionId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT station_id, course_id, field_id, code, name")) {
      const courseId = string(v[0]);
      const rows = [...this.db.observationRallyStations.values()]
        .filter((row) => row.course_id === courseId)
        .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT mission_id, course_id, station_id, replacement_for_mission_id")) {
      const courseId = string(v[0]);
      const rows = [...this.db.observationRallyMissions.values()]
        .filter((row) => row.course_id === courseId)
        .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT progress_id, course_id, mission_id, progress_scope")) {
      const courseId = string(v[0]);
      const rows = [...this.db.observationRallyProgress.values()]
        .filter((row) => row.course_id === courseId)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT occurrence_id, scientific_name, vernacular_name, taxon_rank FROM production_import_occurrences")) {
      const rows = [...this.db.productionOccurrences.values()]
        .filter((row) => row.visit_id === string(v[0]))
        .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.occurrence_id.localeCompare(b.occurrence_id))
        .slice(0, 8);
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT o.occurrence_id, o.visit_id, o.scientific_name")) {
      const tierGte = number(this.values[0]);
      let cursor = 1;
      const hasPlaceFilter = normalized.includes("v.place_id = ?");
      const placeId = hasPlaceFilter ? string(this.values[cursor++]) : null;
      const hasTaxonFilter = normalized.includes("LOWER(COALESCE(o.scientific_name");
      const taxonNeedle = hasTaxonFilter ? string(this.values[cursor++]).replaceAll("%", "").toLowerCase() : null;
      if (hasTaxonFilter) cursor++;
      const hasMediaRoleFilter = normalized.includes("ea_filter.asset_role = ?");
      const mediaRole = hasMediaRoleFilter ? string(this.values[cursor++]) : null;
      const limit = number(this.values[cursor++]);
      const offset = number(this.values[cursor++]);
      const rows = [...this.db.productionOccurrences.values()]
        .flatMap((occurrence) => {
          const visit = occurrence.visit_id ? this.db.productionVisits.get(occurrence.visit_id) : null;
          if (!visit || (visit.public_visibility ?? "public") !== "public") return [];
          if (placeId && visit.place_id !== placeId) return [];
          const qualityGrade = occurrence.quality_grade ?? "";
          const evidenceTier = qualityGrade === "research_grade" || qualityGrade === "verified" ? 3 : 1;
          if (!(evidenceTier >= 3 || tierGte <= 1)) return [];
          const taxonText = `${occurrence.scientific_name ?? ""} ${occurrence.vernacular_name ?? ""}`.toLowerCase();
          if (taxonNeedle && !taxonText.includes(taxonNeedle)) return [];
          const assets = this.db.productionEvidenceAssets
            .filter((asset) => asset.occurrence_id === occurrence.occurrence_id || asset.visit_id === occurrence.visit_id)
            .sort((a, b) => (a.captured_at ?? a.created_at ?? "").localeCompare(b.captured_at ?? b.created_at ?? "") || a.asset_id.localeCompare(b.asset_id));
          const firstAsset = assets[0] ?? null;
          if (mediaRole && !assets.some((asset) => asset.asset_role === mediaRole)) return [];
          const user = visit.user_id ? this.db.authUsers.get(visit.user_id) : null;
          return [{
            occurrence_id: occurrence.occurrence_id,
            visit_id: occurrence.visit_id,
            scientific_name: occurrence.scientific_name,
            vernacular_name: occurrence.vernacular_name,
            taxon_rank: occurrence.taxon_rank,
            evidence_tier: evidenceTier,
            quality_grade: occurrence.quality_grade ?? null,
            observed_at: visit.observed_at,
            place_id: visit.place_id ?? null,
            observer_name: user?.display_name ?? "Anonymous",
            public_visibility: visit.public_visibility ?? "public",
            media_ref: firstAsset?.legacy_relative_path ?? firstAsset?.asset_id ?? null,
            media_role: firstAsset?.asset_role ?? null
          }];
        })
        .sort((a, b) => (b.observed_at ?? "").localeCompare(a.observed_at ?? "") || a.occurrence_id.localeCompare(b.occurrence_id))
        .slice(offset, offset + limit);
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT COALESCE(asset_role, 'unknown') AS media_role")) {
      const counts = new Map<string, { media_role: string; asset_role: string; asset_count: number; occurrenceIds: Set<string> }>();
      for (const asset of this.db.productionEvidenceAssets) {
        const key = asset.asset_role ?? "unknown";
        const entry = counts.get(key) ?? { media_role: key, asset_role: key, asset_count: 0, occurrenceIds: new Set<string>() };
        entry.asset_count += 1;
        entry.occurrenceIds.add(asset.occurrence_id ?? asset.visit_id ?? asset.asset_id);
        counts.set(key, entry);
      }
      const rows = [...counts.values()]
        .sort((a, b) => a.media_role.localeCompare(b.media_role))
        .map((entry) => ({
          media_role: entry.media_role,
          asset_role: entry.asset_role,
          asset_count: entry.asset_count,
          occurrence_count: entry.occurrenceIds.size
        }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT occurrence_id, visit_id, scientific_name, vernacular_name, taxon_rank,")) {
      const visitId = string(v[0]);
      const preferredOccurrenceId = string(v[1]);
      const rows = [...this.db.productionOccurrences.values()]
        .filter((row) => row.visit_id === visitId)
        .sort((a, b) => {
          if (a.occurrence_id === preferredOccurrenceId) return -1;
          if (b.occurrence_id === preferredOccurrenceId) return 1;
          return (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.occurrence_id.localeCompare(b.occurrence_id);
        });
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT asset_id, blob_id, occurrence_id, visit_id, asset_role, captured_at, created_at")) {
      const rows = this.db.productionEvidenceAssets
        .filter((row) => row.visit_id === string(v[0]))
        .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.asset_id.localeCompare(b.asset_id));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT card_id, visit_id, axis, title, body, sources_json, visibility")) {
      const visitId = string(v[0]);
      const viewerUserId = string(v[1]);
      const rank = (axis: string) => axis === "organism" ? 1 : axis === "environment" ? 2 : axis === "human_relation" ? 3 : 9;
      const rows = [...this.db.recordReadingCards.values()]
        .filter((row) =>
          row.visit_id === visitId &&
          row.visibility !== "hidden" &&
          (row.visibility === "public" || row.created_by_user_id === viewerUserId)
        )
        .sort((a, b) => rank(a.axis) - rank(b.axis));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT outbox_id, topic, target_id FROM outbox")) {
      const rows = [...this.db.outbox.values()]
        .filter((row) => row.dispatch_state === "pending")
        .slice(0, 100)
        .map((row) => ({ outbox_id: row.outbox_id, topic: row.topic, target_id: row.target_id }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT asset_id, object_key FROM asset_ledger")) {
      const rows = [...this.db.assets.values()]
        .filter((asset) => asset.observation_id === string(this.values[0]) && asset.processing_state === "uploaded")
        .map((asset) => ({ asset_id: asset.asset_id, object_key: asset.object_key }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT asset_id, object_key, mime, bytes, duration_ms, public_derivative_key FROM asset_ledger")) {
      const rows = [...this.db.assets.values()]
        .filter((asset) =>
          asset.observation_id === string(this.values[0]) &&
          asset.processing_state === "uploaded" &&
          asset.public_derivative_key &&
          asset.exif_scrub_state === "scrubbed" &&
          asset.public_ready_at &&
          asset.public_derivative_verified_at &&
          asset.public_derivative_metadata_json &&
          !asset.public_derivative_metadata_json.includes('"scannedContainer":"svg+xml"') &&
          !asset.public_derivative_metadata_json.includes('"contentType":"image/svg')
        )
        .map((asset) => ({
          asset_id: asset.asset_id,
          object_key: asset.object_key,
          mime: asset.mime,
          bytes: asset.bytes,
          duration_ms: null,
          public_derivative_key: asset.public_derivative_key
        }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT o.observation_id, o.observed_at, o.taxon_label, o.note, o.visibility,")) {
      const ownerUserId = string(this.values[0]);
      const limit = number(this.values[1]);
      const rows = [...this.db.observations.values()]
        .filter((observation) =>
          observation.owner_user_id === ownerUserId &&
          observation.emergency_hidden === 0
        )
        .sort((a, b) => b.observed_at.localeCompare(a.observed_at))
        .slice(0, limit)
        .map((observation) => {
          const asset = [...this.db.assets.values()]
            .filter((candidate) =>
              candidate.observation_id === observation.observation_id &&
              candidate.processing_state === "uploaded" &&
              candidate.public_derivative_key &&
              candidate.public_derivative_verified_at &&
              candidate.public_derivative_metadata_json &&
              !candidate.public_derivative_metadata_json.includes('"scannedContainer":"svg+xml"') &&
              !candidate.public_derivative_metadata_json.includes('"contentType":"image/svg') &&
              candidate.exif_scrub_state === "scrubbed" &&
              candidate.mime.startsWith("image/")
            )
            .sort((a, b) => (b.public_ready_at ?? b.public_derivative_verified_at ?? "").localeCompare(a.public_ready_at ?? a.public_derivative_verified_at ?? ""))[0];
          return {
            observation_id: observation.observation_id,
            observed_at: observation.observed_at,
            taxon_label: observation.taxon_label,
            note: observation.note,
            visibility: observation.visibility,
            public_derivative_key: asset?.public_derivative_key ?? null
          };
        });
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT observation_id, public_derivative_key FROM asset_ledger")) {
      const rows = [...this.db.assets.values()]
        .filter((asset) =>
          asset.observation_id &&
          asset.processing_state === "uploaded" &&
          asset.public_derivative_key &&
          asset.exif_scrub_state === "scrubbed" &&
          asset.public_ready_at &&
          asset.public_derivative_verified_at &&
          asset.public_derivative_metadata_json &&
          !asset.public_derivative_metadata_json.includes('"scannedContainer":"svg+xml"') &&
          !asset.public_derivative_metadata_json.includes('"contentType":"image/svg') &&
          asset.mime.startsWith("image/")
        )
        .sort((a, b) => (b.public_ready_at ?? "").localeCompare(a.public_ready_at ?? ""))
        .map((asset) => ({
          observation_id: asset.observation_id,
          public_derivative_key: asset.public_derivative_key
        }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT o.observation_id, o.observed_at, o.taxon_label, o.note, o.exact_lat, o.exact_lng")) {
      const ownerUserId = string(this.values[0]);
      const limit = number(this.values[1]);
      const rows = [...this.db.observations.values()]
        .filter((observation) =>
          observation.owner_user_id === ownerUserId &&
          observation.exact_lat !== null &&
          observation.exact_lng !== null &&
          observation.emergency_hidden === 0
        )
        .flatMap((observation) =>
          [...this.db.assets.values()]
            .filter((asset) =>
              asset.observation_id === observation.observation_id &&
              asset.processing_state === "uploaded" &&
              asset.public_derivative_key &&
              asset.exif_scrub_state === "scrubbed" &&
              asset.public_ready_at &&
              asset.mime.startsWith("image/")
            )
            .map((asset) => ({
              observation_id: observation.observation_id,
              observed_at: observation.observed_at,
              taxon_label: observation.taxon_label,
              note: observation.note,
              exact_lat: observation.exact_lat,
              exact_lng: observation.exact_lng,
              public_derivative_key: asset.public_derivative_key
            }))
        )
        .sort((a, b) => b.observed_at.localeCompare(a.observed_at))
        .slice(0, limit);
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT metric_type, metric_key, metric_value, detail_json FROM production_restore_parity_metrics")) {
      const rows = this.db.parityMetrics
        .filter((row) => row.run_id === string(this.values[0]))
        .sort((a, b) => `${a.metric_type}:${a.metric_key}`.localeCompare(`${b.metric_type}:${b.metric_key}`));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT payload_json, created_at FROM operation_audit")) {
      const limit = number(this.values[0]);
      const rows = this.db.operationAudit
        .filter((row) => row.operation_type === "origin_fallback")
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit)
        .map(({ payload_json, created_at }) => ({ payload_json, created_at }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT observation_id, public_cell, observed_at, taxon_label, asset_count FROM readmodel_public_observations")) {
      const rows = [...this.db.readmodel.values()]
        .sort((a, b) => b.observed_at.localeCompare(a.observed_at));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT visit_id, cell_1000, observed_at, display_name, asset_count FROM public_map_snapshot_records_v1")) {
      const rows = [...this.db.publicMapSnapshotRecords]
        .sort((a, b) => b.observed_at.localeCompare(a.observed_at))
        .slice(0, 5000);
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT walk_map_id, municipality_code, municipality, title, summary, theme, publish_mode, route_style")) {
      const municipalityCode = nullableString(this.values[0]);
      const limit = number(this.values[2]);
      const rows = [...this.db.municipalWalkMaps.values()]
        .filter((row) =>
          (row.publish_mode === "public_preview" || row.publish_mode === "public") &&
          (!municipalityCode || row.municipality_code === municipalityCode)
        )
        .sort((a, b) => a.display_order - b.display_order || a.walk_map_id.localeCompare(b.walk_map_id))
        .slice(0, limit);
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT creator_id, display_name, registration_kind, verification_status, commercial_intent, notes, updated_at")) {
      const rows = [...this.db.municipalWalkMapCreators.values()]
        .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? "") || a.creator_id.localeCompare(b.creator_id))
        .slice(0, 200);
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT m.walk_map_id, m.municipality_code, m.municipality, m.title, m.summary, m.theme, m.publish_mode")) {
      const limit = number(this.values[0]);
      const rank = (publishMode: string) => publishMode === "draft" ? 0 : publishMode === "public_preview" ? 1 : 2;
      const rows = [...this.db.municipalWalkMaps.values()]
        .map((row) => ({
          walk_map_id: row.walk_map_id,
          municipality_code: row.municipality_code,
          municipality: row.municipality,
          title: row.title,
          summary: row.summary,
          theme: row.theme,
          publish_mode: row.publish_mode,
          creator_name: row.creator_name ?? null,
          creator_profile_json: row.creator_profile_json ?? "{}",
          route_flexibility_json: row.route_flexibility_json ?? "{}",
          source_references_json: row.source_references_json,
          publication_review_json: row.publication_review_json ?? "{}",
          updated_at: row.updated_at ?? null,
          stop_count: row.stop_count
        }))
        .sort((a, b) => rank(a.publish_mode) - rank(b.publish_mode)
          || (b.updated_at ?? "").localeCompare(a.updated_at ?? "")
          || a.walk_map_id.localeCompare(b.walk_map_id))
        .slice(0, limit);
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT stop_id, title, note, area_hint_json, safety_note, position, area_kind, access")) {
      const walkMapId = string(this.values[0]);
      const rows = [...this.db.municipalWalkMapStops.values()]
        .filter((row) => row.walk_map_id === walkMapId)
        .sort((a, b) => a.position - b.position || a.display_order - b.display_order || a.stop_id.localeCompare(b.stop_id))
        .map((row) => ({
          stop_id: row.stop_id,
          title: row.title,
          note: row.note,
          area_hint_json: row.area_hint_json,
          safety_note: row.safety_note ?? null,
          position: row.position,
          area_kind: row.area_kind,
          access: row.access,
          estimated_minutes: row.estimated_minutes ?? null,
          notice_cues_json: row.notice_cues_json ?? "[]",
          record_cues_json: row.record_cues_json ?? "[]",
          safety_notes_json: row.safety_notes_json ?? "[]"
        }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT field_id, source, admin_level, name, prefecture, city, center_lat, center_lng")) {
      const minLat = number(this.values[0]);
      const maxLat = number(this.values[1]);
      const minLng = number(this.values[2]);
      const maxLng = number(this.values[3]);
      const limit = number(this.values.at(-1));
      const sources = this.values.slice(4, -1).map((value) => string(value));
      const allowed = new Set(sources);
      const rows = [...this.db.productionAreaPolygons.values()]
        .filter((row) =>
          row.bbox_max_lat >= minLat &&
          row.bbox_min_lat <= maxLat &&
          row.bbox_max_lng >= minLng &&
          row.bbox_min_lng <= maxLng &&
          (sources.length === 0 || allowed.has(row.source))
        )
        .sort((a, b) => (a.area_ha ?? 999999) - (b.area_ha ?? 999999) || a.name.localeCompare(b.name, "ja"))
        .slice(0, limit);
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT field_id, owner_user_id, source, name, name_kana, summary, prefecture, city")) {
      if (normalized.includes("WHERE owner_user_id = ? AND deleted_at IS NULL AND public_lat BETWEEN")) {
        const ownerUserId = string(this.values[0]);
        const minLat = number(this.values[1]);
        const maxLat = number(this.values[2]);
        const minLng = number(this.values[3]);
        const maxLng = number(this.values[4]);
        const rows = [...this.db.userObservationFields.values()]
          .filter((row) =>
            row.owner_user_id === ownerUserId &&
            !row.deleted_at &&
            row.public_lat >= minLat &&
            row.public_lat <= maxLat &&
            row.public_lng >= minLng &&
            row.public_lng <= maxLng
          )
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
          .slice(0, 20);
        return { results: rows as T[] };
      }
      if (normalized.includes("WHERE owner_user_id = ? AND deleted_at IS NULL")) {
        const ownerUserId = string(this.values[0]);
        const limit = number(this.values[1]);
        const rows = [...this.db.userObservationFields.values()]
          .filter((row) => row.owner_user_id === ownerUserId && !row.deleted_at)
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
          .slice(0, limit);
        return { results: rows as T[] };
      }
      return { results: [] as T[] };
    }
    if (normalized.startsWith("SELECT field_id, source, admin_level, name, name_kana, summary, prefecture, city")) {
      if (normalized.includes("WHERE 1=1")) {
        let rows = [...this.db.productionFieldDetails.values()];
        const values = this.values;
        let cursor = 0;
        if (normalized.includes("LOWER(NAME) LIKE")) {
          const like = string(values[cursor++]).replace(/%/g, "").toLowerCase();
          cursor += 2;
          rows = rows.filter((row) =>
            row.name.toLowerCase().includes(like) ||
            String(row.prefecture ?? "").toLowerCase().includes(like) ||
            String(row.city ?? "").toLowerCase().includes(like)
          );
        }
        if (normalized.includes("SOURCE = ?")) {
          const source = string(values[cursor++]);
          rows = rows.filter((row) => row.source === source);
        }
        if (normalized.includes("PREFECTURE = ?")) {
          const prefecture = string(values[cursor++]);
          rows = rows.filter((row) => row.prefecture === prefecture);
        }
        if (normalized.includes("PUBLIC_LAT BETWEEN")) {
          const minLat = number(values[cursor++]);
          const maxLat = number(values[cursor++]);
          const minLng = number(values[cursor++]);
          const maxLng = number(values[cursor++]);
          rows = rows.filter((row) =>
            row.public_lat >= minLat &&
            row.public_lat <= maxLat &&
            row.public_lng >= minLng &&
            row.public_lng <= maxLng
          );
        }
        const limit = number(values.at(-1));
        return {
          results: rows
            .sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")))
            .slice(0, limit) as T[]
        };
      }
      if (normalized.includes("WHERE public_lat BETWEEN ? AND ? AND public_lng BETWEEN ? AND ?") && normalized.includes("LIMIT 20")) {
        const minLat = number(this.values[0]);
        const maxLat = number(this.values[1]);
        const minLng = number(this.values[2]);
        const maxLng = number(this.values[3]);
        const rows = [...this.db.productionFieldDetails.values()]
          .filter((row) =>
            row.public_lat >= minLat &&
            row.public_lat <= maxLat &&
            row.public_lng >= minLng &&
            row.public_lng <= maxLng
          )
          .sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")))
          .slice(0, 20);
        return { results: rows as T[] };
      }
      const minLat = number(this.values[0]);
      const maxLat = number(this.values[1]);
      const minLng = number(this.values[2]);
      const maxLng = number(this.values[3]);
      const limit = number(this.values[4]);
      const rows = [...this.db.productionFieldDetails.values()]
        .filter((row) =>
          row.public_lat >= minLat &&
          row.public_lat <= maxLat &&
          row.public_lng >= minLng &&
          row.public_lng <= maxLng
        )
        .sort((a, b) => (a.area_ha ?? 999999) - (b.area_ha ?? 999999) || a.name.localeCompare(b.name, "ja"))
        .slice(0, limit);
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT prefecture, COUNT(*) AS field_count")) {
      const counts = new Map<string, number>();
      for (const row of this.db.productionFieldDetails.values()) {
        if (!row.prefecture) continue;
        counts.set(row.prefecture, (counts.get(row.prefecture) ?? 0) + 1);
      }
      const rows = [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([prefecture, field_count]) => ({ prefecture, field_count }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT field_id, public_lat, public_lng, radius_m")) {
      const limit = number(this.values[0]);
      const rows = [...this.db.productionFieldDetails.values()]
        .filter((row) => Number.isFinite(row.public_lat) && Number.isFinite(row.public_lng))
        .sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")))
        .slice(0, limit)
        .map((row) => ({
          field_id: row.field_id,
          public_lat: row.public_lat,
          public_lng: row.public_lng,
          radius_m: row.radius_m
        }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT manager_id, field_id, user_id, role, granted_at, granted_by, expires_at, note")) {
      const fieldId = string(this.values[0]);
      const rows = [...this.db.fieldManagers.values()]
        .filter((row) => row.field_id === fieldId && (!row.expires_at || row.expires_at > new Date().toISOString()))
        .sort((a, b) => b.granted_at.localeCompare(a.granted_at))
        .map((row) => ({
          manager_id: row.manager_id,
          field_id: row.field_id,
          user_id: row.user_id,
          role: row.role,
          granted_at: row.granted_at,
          granted_by: row.granted_by,
          expires_at: row.expires_at,
          note: row.note
        }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT partition_month, COUNT(*) AS count, MIN(observed_at) AS earliest_observed_at")) {
      const grouped = new Map<string, ObservationRow[]>();
      for (const row of this.db.observations.values()) {
        const month = row.partition_month ?? "unknown";
        grouped.set(month, [...(grouped.get(month) ?? []), row]);
      }
      const rows = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, values]) => {
        const observed = values.map((row) => row.observed_at).sort();
        return {
          partition_month: month,
          count: values.length,
          earliest_observed_at: observed[0] ?? null,
          latest_observed_at: observed.at(-1) ?? null
        };
      });
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT asset_id, observation_id, public_derivative_key, public_derivative_sha256")) {
      const rows = [...this.db.assets.values()]
        .filter((asset) => asset.public_derivative_verified_at)
        .sort((a, b) => (b.public_derivative_verified_at ?? "").localeCompare(a.public_derivative_verified_at ?? ""))
        .slice(0, 10)
        .map((asset) => ({
          asset_id: asset.asset_id,
          observation_id: asset.observation_id,
          public_derivative_key: asset.public_derivative_key,
          public_derivative_sha256: asset.public_derivative_sha256,
          public_derivative_verified_at: asset.public_derivative_verified_at,
          public_derivative_metadata_json: asset.public_derivative_metadata_json
        }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT import_status, asset_role, COUNT(*) AS count FROM legacy_asset_import_ledger")) {
      const grouped = new Map<string, { import_status: string; asset_role: string; count: number }>();
      for (const row of this.db.legacyAssetImports) {
        const key = `${row.import_status}\u0000${row.asset_role}`;
        const current = grouped.get(key);
        if (current) current.count += 1;
        else grouped.set(key, { import_status: row.import_status, asset_role: row.asset_role, count: 1 });
      }
      const rows = [...grouped.values()].sort((a, b) =>
        `${a.import_status}:${a.asset_role}`.localeCompare(`${b.import_status}:${b.asset_role}`)
      );
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT stream_uid, asset_id, visit_id, ready_to_stream, status_state, modified_at_stream FROM legacy_stream_inventory")) {
      const rows = this.db.legacyStreamInventory
        .filter((row) => row.exists_on_stream === 1 && row.ready_to_stream === 0)
        .sort((a, b) => a.stream_uid.localeCompare(b.stream_uid))
        .map(({ stream_uid, asset_id, visit_id, ready_to_stream, status_state, modified_at_stream }) => ({
          stream_uid,
          asset_id,
          visit_id,
          ready_to_stream,
          status_state,
          modified_at_stream
        }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT ledger_id, event_type, target_id, partition_month, source_endpoint")) {
      const limit = number(this.values.at(-1));
      const prefix = this.values.length > 1 ? likePrefix(string(this.values[0])) : null;
      const rows = [...this.db.rollbackLedger.values()]
        .filter((row) => !prefix || row.target_id.startsWith(prefix) || payloadObservationId(row)?.startsWith(prefix))
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.ledger_id.localeCompare(b.ledger_id))
        .slice(0, limit);
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT subscription_id, target_type, target_id, label, href, is_active, created_at, updated_at FROM user_area_subscriptions")) {
      const rows = [...this.db.areaSubscriptions.values()]
        .filter((row) => row.user_id === string(this.values[0]))
        .sort((a, b) => b.is_active - a.is_active || (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
        .slice(0, 100);
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT s.subscription_id, s.target_type, s.target_id, s.label, s.href, s.is_active")) {
      const rows = [...this.db.areaSubscriptions.values()]
        .filter((row) => row.user_id === string(this.values[0]) && row.is_active === 1)
        .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
        .slice(0, 8)
        .map((row) => {
          const stats = this.db.areaSubscriptionStats.get(`${row.user_id}:${row.target_type}:${row.target_id}`);
          return {
            ...row,
            observation_count: stats?.observation_count ?? 0,
            needs_id_count: stats?.needs_id_count ?? 0
          };
        });
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT label, scientific_name, taxon_rank FROM taxon_alert_subscriptions")) {
      const rows = [...this.db.taxonAlertSubscriptions.values()]
        .filter((row) => row.user_id === string(this.values[0]) && row.is_active === 1)
        .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
        .slice(0, 8);
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT subscription_id, scientific_name, taxon_rank, match_field")) {
      const rows = [...this.db.taxonAlertSubscriptions.values()]
        .filter((row) => row.user_id === string(this.values[0]))
        .sort((a, b) => b.is_active - a.is_active || (b.created_at ?? "").localeCompare(a.created_at ?? ""))
        .slice(0, 200);
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT delivery_id, occurrence_id, trigger_kind, delivery_status, delivered_at, acknowledged_at, created_at, payload_json")) {
      const rows = [...this.db.alertDeliveries.values()]
        .filter((row) => row.user_id === string(this.values[0]))
        .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
        .slice(0, 100);
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT delivery_id FROM alert_deliveries WHERE user_id = ? AND delivery_id IN")) {
      const ids = this.values.slice(1).map((value) => string(value));
      const rows = [...this.db.alertDeliveries.values()]
        .filter((row) => row.user_id === string(this.values[0]) && ids.includes(row.delivery_id))
        .map((row) => ({ delivery_id: row.delivery_id }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT delivery_id FROM alert_deliveries WHERE user_id = ? AND acknowledged_at IS NULL")) {
      const rows = [...this.db.alertDeliveries.values()]
        .filter((row) => row.user_id === string(this.values[0]) && row.acknowledged_at === null)
        .map((row) => ({ delivery_id: row.delivery_id }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT delivery_id FROM alert_deliveries WHERE delivery_status = 'pending'")) {
      const limit = number(this.values[0]);
      const rows = [...this.db.alertDeliveries.values()]
        .filter((row) => row.delivery_status === "pending")
        .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.delivery_id.localeCompare(b.delivery_id))
        .slice(0, limit)
        .map((row) => ({ delivery_id: row.delivery_id }));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT d.delivery_id, d.occurrence_id, d.user_id")) {
      const ids = this.values.map((value) => string(value));
      const rows = [...this.db.alertDeliveries.values()]
        .filter((row) => row.delivery_status === "sending" && ids.includes(row.delivery_id))
        .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.delivery_id.localeCompare(b.delivery_id))
        .map((row) => {
          const recipient = row.recipient_id ? this.db.alertRecipients.get(row.recipient_id) : null;
          const authUser = row.user_id ? this.db.authUsers.get(row.user_id) : null;
          const preferences = row.user_id ? this.db.userNotificationPreferences.get(row.user_id) : null;
          return {
            delivery_id: row.delivery_id,
            occurrence_id: row.occurrence_id,
            user_id: row.user_id,
            recipient_id: row.recipient_id ?? null,
            trigger_kind: row.trigger_kind,
            channel: row.channel,
            payload_json: row.payload_json,
            created_at: row.created_at,
            recipient_email: recipient?.email ?? null,
            recipient_display_name: recipient?.display_name ?? null,
            recipient_active: recipient?.is_active ?? null,
            rate_limit_per_day: recipient?.rate_limit_per_day ?? null,
            user_email: authUser?.email ?? null,
            user_display_name: authUser?.display_name ?? null,
            user_email_enabled: preferences?.email_enabled ?? 1
          };
        });
      return { results: rows as T[] };
    }
    throw new Error(`Unhandled SQL all: ${this.query}`);
  }
}

class FakeQueue {
  messages: unknown[] = [];
  fail = false;

  async send(message: unknown): Promise<void> {
    if (this.fail) throw new Error("queue unavailable");
    this.messages.push(message);
  }
}

class FakeEmail {
  messages: Array<{ from: unknown; to: unknown; subject: string; text?: string; headers?: Record<string, string> }> = [];
  fail = false;

  async send(message: { from: unknown; to: unknown; subject: string; text?: string; headers?: Record<string, string> }): Promise<void> {
    if (this.fail) throw new Error("email unavailable");
    this.messages.push(message);
  }
}

class FakeBucket {
  objects = new Map<string, { value: unknown; size: number; uploaded: Date; contentType?: string }>();

  async put(key: string, value: unknown, options?: { httpMetadata?: { contentType?: string } }): Promise<void> {
    const size = typeof value === "string"
      ? value.length
      : value instanceof ArrayBuffer
        ? value.byteLength
        : ArrayBuffer.isView(value)
          ? value.byteLength
          : 0;
    this.objects.set(key, {
      value,
      size,
      uploaded: new Date("2026-06-15T00:00:00.000Z"),
      contentType: options?.httpMetadata?.contentType
    });
  }

  async get(key: string) {
    const object = this.objects.get(key);
    if (!object) return null;
    const body = typeof object.value === "string" || object.value instanceof ArrayBuffer || ArrayBuffer.isView(object.value)
      ? new Response(object.value as BodyInit).body
      : new Response("").body;
    return { body, httpMetadata: { contentType: object.contentType } };
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }

  async list(options?: { prefix?: string; limit?: number; cursor?: string }) {
    const prefix = options?.prefix ?? "";
    const limit = options?.limit ?? 100;
    const start = Number(options?.cursor ?? "0");
    const entries = [...this.objects.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .sort(([a], [b]) => a.localeCompare(b));
    const page = entries.slice(start, start + limit);
    const next = start + page.length;
    return {
      objects: page.map(([key, object]) => ({ key, size: object.size, uploaded: object.uploaded, etag: `etag-${key}` })),
      truncated: next < entries.length,
      cursor: next < entries.length ? String(next) : undefined
    };
  }
}

function createEnv(queue = new FakeQueue()) {
  const core = new FakeD1();
  const obs = new FakeD1();
  return {
    env: {
      CORE_DB: core,
      OBS_DB: obs,
      ASSET_BUCKET: new FakeBucket(),
      MEDIA_QUEUE: queue,
      ENVIRONMENT: "shadow",
      PUBLIC_LOCATION_CELL_PRECISION: "geohash6",
      INTERNAL_AUTH_TOKEN,
      OBSERVATION_DB_NAME: "ikimon_shadow_observations_2026_06",
      OBSERVATION_ARCHIVE_TARGET: "r2_sql_export_by_partition_month",
      PUBLIC_WRITE_MODE: "origin_fallback",
      CLOUDFLARE_STREAM_WEBHOOK_SECRET: undefined as string | undefined,
      MPC_DISABLED: undefined as string | undefined,
      MPC_STAC_API_URL: undefined as string | undefined,
      MPC_DATA_API_URL: undefined as string | undefined,
      SENTINEL_ENVIRONMENT_BATCH_SIZE: undefined as string | undefined,
      SENTINEL_ENVIRONMENT_DAYS_BACK: undefined as string | undefined,
      SENTINEL_ENVIRONMENT_MAX_CLOUD: undefined as string | undefined
    },
    core,
    obs,
    queue
  };
}

function streamWebhookSignature(body: string, secret: string, time = Math.floor(Date.now() / 1000)): string {
  const sig1 = createHmac("sha256", secret).update(`${time}.${body}`).digest("hex");
  return `time=${time},sig1=${sig1}`;
}

function contactProof(secret: string, issuedAt = Date.now() - 3000, nonce = "test-nonce"): string {
  const signature = createHmac("sha256", secret).update(`v1.${issuedAt}.${nonce}`).digest("base64url");
  return `v1.${issuedAt}.${nonce}.${signature}`;
}

function tinyPngBase64(): string {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = deflateSync(Buffer.from([0, 0, 0, 0, 0]));
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0))
  ]).toString("base64");
}

function malformedPngBase64(): string {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
    0x44, 0xae, 0x42, 0x60, 0x82
  ]).toString("base64");
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length, 0);
  typeBytes.copy(header, 4);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32Buffer(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([header, data, crc]);
}

function crc32Buffer(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function internalRequest(path: string, init?: RequestInit): Request {
  return new Request(`https://shadow.test${path}`, {
    ...(init ?? {}),
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${INTERNAL_AUTH_TOKEN}`
    }
  });
}

test("finalize preserves canonical row and pending outbox when queue dispatch fails", async () => {
  const queue = new FakeQueue();
  queue.fail = true;
  const { env, obs } = createEnv(queue);

  const draftResponse = await post("/api/v0/draft-observations", env, {
    userId: "user-1",
    observedAt: "2026-06-15T00:00:00.000Z",
    exactLat: 34.71234,
    exactLng: 137.81234,
    locationAccuracyM: 8,
    visibility: "public",
    media: [
      { mime: "image/jpeg", bytes: 1000, sha256: "a" },
      { mime: "image/jpeg", bytes: 1001, sha256: "b" },
      { mime: "image/jpeg", bytes: 1002, sha256: "c" }
    ]
  });

  const finalizeResponse = await post("/api/v0/observations/finalize", env, {
    draftId: draftResponse.draftId,
    taxonLabel: "test taxon"
  });

  assert.equal(finalizeResponse.processingState, "accepted");
  assert.equal(finalizeResponse.dispatch.sent, 0);
  assert.equal(finalizeResponse.dispatch.pending, 2);
  assert.equal(obs.observations.size, 1);
  assert.equal(obs.assets.size, 3);
  assert.equal([...obs.outbox.values()].filter((row) => row.dispatch_state === "pending").length, 2);
  assert.equal([...obs.outbox.values()].every((row) => row.attempts === 1), true);

  const observation = [...obs.observations.values()][0];
  assert.equal(observation?.exact_lat, 34.71234);
  assert.equal(observation?.public_cell, "34.71,137.81");
});

test("synthetic 10k daily profile creates one durable observation and three media ledger rows per record", async () => {
  const { env, obs, queue } = createEnv();
  const records = 10_000;
  const mediaPerRecord = 3;

  for (let i = 0; i < records; i++) {
    const draft = await post("/api/v0/draft-observations", env, {
      userId: `load-user-${i % 100}`,
      observedAt: "2026-06-15T00:00:00.000Z",
      exactLat: 34.7 + ((i % 100) / 1000),
      exactLng: 137.7 + ((i % 100) / 1000),
      locationAccuracyM: 12,
      visibility: i % 3 === 0 ? "public" : "private",
      media: Array.from({ length: mediaPerRecord }, (_, mediaIndex) => ({
        mime: "image/jpeg",
        bytes: 850000 + mediaIndex,
        sha256: `synthetic-${i}-${mediaIndex}`
      }))
    });
    await post("/api/v0/observations/finalize", env, {
      draftId: draft.draftId,
      taxonLabel: "synthetic field record"
    });
  }

  assert.equal(obs.drafts.size, records);
  assert.equal(obs.observations.size, records);
  assert.equal(obs.assets.size, records * mediaPerRecord);
  assert.equal(obs.outbox.size, records * 2);
  assert.equal(queue.messages.length, records * 2);
  assert.equal([...obs.outbox.values()].every((row) => row.dispatch_state === "dispatched"), true);
});

test("internal endpoints require an explicit bearer token in shadow", async () => {
  const { env, core } = createEnv();

  const missingHeader = await worker.fetch(new Request("https://shadow.test/internal/r2-inventory"), env);
  assert.equal(missingHeader.status, 401);
  assert.deepEqual(await missingHeader.json(), { error: "internal_auth_required" });

  const missingSecret = await worker.fetch(new Request("https://shadow.test/internal/r2-inventory"), {
    ...env,
    INTERNAL_AUTH_TOKEN: undefined
  });
  assert.equal(missingSecret.status, 403);
  assert.deepEqual(await missingSecret.json(), { error: "internal_auth_not_configured" });

  core.operationAudit.push({
    audit_id: "audit-1",
    operation_type: "origin_fallback",
    target_id: "unit",
    payload_json: JSON.stringify({
      reason: "unit_reason",
      method: "GET",
      host: "ikimon.life",
      routePattern: "/unit",
      publicWriteMode: "cloudflare_native",
      environment: "production"
    }),
    created_at: "2026-06-16T00:00:00.000Z"
  });
  const telemetry = await worker.fetch(internalRequest("/internal/origin-fallback-telemetry"), env);
  const telemetryPayload = await telemetry.json() as any;
  assert.equal(telemetry.ok, true, JSON.stringify(telemetryPayload));
  assert.equal(telemetryPayload.byReason.unit_reason, 1);
});

test("r2 inventory is limited to shadow environment and bounded prefixes", async () => {
  const { env } = createEnv();
  const draft = await post("/api/v0/draft-observations", env, {
    userId: "r2-user",
    media: [{ mime: "text/plain", bytes: 6, sha256: "r2" }]
  });
  await worker.fetch(new Request(`https://shadow.test${draft.assets[0].uploadUrl}`, {
    method: "PUT",
    body: "sample"
  }), env);

  const response = await worker.fetch(internalRequest("/internal/r2-inventory?prefix=original/&limit=10"), env);
  const payload = await response.json() as any;
  assert.equal(response.ok, true, JSON.stringify(payload));
  assert.equal(payload.objects.length, 1);
  assert.equal(payload.count, 1);
  assert.equal(payload.truncated, false);
  assert.match(payload.objects[0].key, /^original\//);

  const productionResponse = await worker.fetch(new Request("https://shadow.test/internal/r2-inventory"), {
    ...env,
    ENVIRONMENT: "production"
  });
  assert.equal(productionResponse.status, 404);
});

test("public read model waits until uploaded media has scrubbed public derivatives", async () => {
  const { env, obs } = createEnv();
  const draft = await post("/api/v0/draft-observations", env, {
    userId: "public-user",
    observedAt: "2026-06-15T00:00:00.000Z",
    exactLat: 34.71234,
    exactLng: 137.81234,
    visibility: "public",
    media: [{ mime: "image/jpeg", bytes: 1200, sha256: "asset-sha" }]
  });

  await worker.fetch(new Request(`https://shadow.test${draft.assets[0].uploadUrl}`, {
    method: "PUT",
    body: "sample"
  }), env);
  const finalized = await post("/api/v0/observations/finalize", env, {
    draftId: draft.draftId,
    taxonLabel: "public gated"
  });

  await worker.queue({ messages: [{ body: { outboxId: "manual-readmodel", topic: "readmodel.refresh", targetId: finalized.observationId } }] }, env);
  assert.equal(obs.readmodel.size, 0);

  await worker.queue({ messages: [{ body: { outboxId: "manual-media", topic: "media.process", targetId: finalized.observationId } }] }, env);
  await worker.queue({ messages: [{ body: { outboxId: "manual-readmodel-2", topic: "readmodel.refresh", targetId: finalized.observationId } }] }, env);

  assert.equal(obs.readmodel.size, 1);
  assert.equal([...obs.readmodel.values()][0]?.asset_count, 1);
  const asset = [...obs.assets.values()][0];
  assert.equal(asset?.exif_scrub_state, "scrubbed");
  assert.match(asset?.public_derivative_key ?? "", /^derived\/2026\/06\/asset_/);
  assert.match(asset?.public_derivative_sha256 ?? "", /^[a-f0-9]{64}$/);
  assert.ok(asset?.public_derivative_verified_at);
  const metadata = JSON.parse(asset?.public_derivative_metadata_json ?? "{}");
  assert.equal(metadata.tool, "shadow-public-derivative-byte-signature-scan-v1");
  assert.equal(metadata.gpsExifPresent, false);
  assert.equal(metadata.exifPresent, false);
  assert.equal(metadata.gpsPresent, false);
  assert.equal(metadata.xmpPresent, false);
  assert.equal(metadata.exactCoordinateLiteralPresent, false);

  const summaryResponse = await worker.fetch(internalRequest("/internal/public-derivative-verification-summary"), env);
  const summary = await summaryResponse.json() as any;
  assert.equal(summaryResponse.ok, true, JSON.stringify(summary));
  assert.equal(summary.gate, "public_derivative_binary_metadata_absence");
  assert.equal(summary.summary.verified_assets, 1);
  assert.equal(summary.summary.gps_exif_present, 0);
  assert.equal(summary.recent[0].metadata.gpsExifPresent, false);
});

test("media processing refreshes the public read model even when queue jobs run out of order", async () => {
  const { env, obs, queue } = createEnv();
  await post("/api/v1/observations/upsert", env, {
    observationId: "visit-out-of-order",
    userId: "queue-user",
    observedAt: "2026-06-15T02:30:00.000Z",
    latitude: 34.71234,
    longitude: 137.81234,
    taxon: { vernacularName: "順序テスト植物", rank: "species" }
  });
  await post("/api/v1/observations/visit-out-of-order/photos/upload", env, {
    filename: "queue.jpg",
    mimeType: "image/jpeg",
    base64Data: Buffer.from("queue-image").toString("base64")
  });

  const mediaJob = queue.messages.find((message: any) => message.topic === "media.process");
  assert.ok(mediaJob);
  await worker.queue({ messages: [{ body: mediaJob as any }] }, env);

  assert.equal(obs.readmodel.get("visit-out-of-order")?.asset_count, 1);
  const snapshot = obs.publicMapSnapshotRecords.find((row) => row.visit_id === "visit-out-of-order");
  assert.equal(snapshot?.asset_count, 1);
  assert.equal(snapshot?.cell_1000, "34.71,137.81");
  assert.equal(obs.publicMapSnapshotMeta?.public_record_count, 1);
  assert.equal(obs.publicMapSnapshotMeta?.refreshed_by, "readmodel_refresh");
});

test("v1 public map read routes expose current shell contracts without exact coordinates", async () => {
  const { env, queue } = createEnv();
  const schoolFieldId = "school-map-contract";
  env.OBS_DB.productionFieldDetails.set(schoolFieldId, {
    field_id: schoolFieldId,
    source: "school",
    admin_level: "school",
    name: "地図テスト小学校",
    name_kana: null,
    summary: "地域の観察フィールド",
    prefecture: "静岡県",
    city: "浜松市",
    public_cell: "34.71,137.81",
    public_lat: 34.712,
    public_lng: 137.812,
    radius_m: 180,
    area_ha: 1.2,
    has_polygon: 1,
    has_simplified_geometry: 1,
    certification_id: null,
    certification_url: null,
    official_url: "https://example.test/school",
    owner_url: null,
    story_url: null,
    verification_level: "registry_matched",
    verification_method: "public_registry",
    verification_label: "公開情報と一致",
    source_confidence: 0.92,
    valid_from: null,
    valid_to: null,
    entity_key: null,
    updated_at: "2026-06-18T00:00:00.000Z"
  });
  await post("/api/v1/observations/upsert", env, {
    observationId: "visit-map-contract",
    userId: "map-user",
    observedAt: "2026-06-15T02:00:00.000Z",
    latitude: 34.71234,
    longitude: 137.81234,
    taxon: { vernacularName: "地図テスト植物", rank: "species" }
  });
  await post("/api/v1/observations/visit-map-contract/photos/upload", env, {
    filename: "map.jpg",
    mimeType: "image/jpeg",
    base64Data: Buffer.from("map-image").toString("base64")
  });
  await worker.queue({ messages: queue.messages.map((body) => ({ body: body as any })) }, env);
  env.OBS_DB.assets.set("asset-map-contract-real-derivative", {
    asset_id: "asset-map-contract-real-derivative",
    draft_id: "draft-map-contract-real-derivative",
    observation_id: "visit-map-contract",
    owner_user_id: "map-user",
    object_key: "original/visit-map-contract/map-real.jpg",
    partition_month: "2026-06",
    sha256: "map-real-sha",
    mime: "image/jpeg",
    bytes: 1234,
    processing_state: "uploaded",
    public_derivative_key: "derived/import/20260615/observation_photo/asset-map-contract-real-derivative/display.webp",
    public_derivative_sha256: "map-real-derivative-sha",
    public_derivative_verified_at: "2026-06-15T02:30:00.000Z",
    public_derivative_metadata_json: "{\"gpsExifPresent\":false,\"contentType\":\"image/webp\",\"scannedContainer\":\"binary\"}",
    exif_scrub_state: "scrubbed",
    public_ready_at: "2026-06-15T02:30:00.000Z"
  });
  await env.ASSET_BUCKET.put(
    "derived/import/20260615/observation_photo/asset-map-contract-real-derivative/display.webp",
    "map-real-webp",
    { httpMetadata: { contentType: "image/webp" } }
  );

  const missingScope = await worker.fetch(new Request("https://shadow.test/api/v1/map/observations"), env);
  assert.equal(missingScope.status, 400);
  assert.deepEqual(await missingScope.json(), { error: "missing_scope" });

  const cellsResponse = await worker.fetch(new Request("https://shadow.test/api/v1/map/cells?bbox=137.70,34.70,137.82,34.72&zoom=13"), env);
  const cellsPayload = await cellsResponse.json() as any;
  assert.equal(cellsResponse.ok, true, JSON.stringify(cellsPayload));
  assert.equal(cellsPayload.type, "FeatureCollection");
  assert.ok(Array.isArray(cellsPayload.features));
  assert.equal(cellsPayload.features.length, 1);
  assert.equal(cellsPayload.features[0].properties.cellId, "cell:34.71,137.81");
  assert.equal(cellsPayload.features[0].properties.count, 1);
  assert.equal(cellsPayload.stats.totalRecords, 1);
  assert.doesNotMatch(JSON.stringify(cellsPayload), /34\.71234|137\.81234/);

  const coverageResponse = await worker.fetch(new Request("https://shadow.test/api/v1/map/coverage?year=2026"), env);
  const coveragePayload = await coverageResponse.json() as any;
  assert.equal(coverageResponse.ok, true, JSON.stringify(coveragePayload));
  assert.equal(coveragePayload.type, "FeatureCollection");
  assert.equal(coveragePayload.features.length, 1);
  assert.equal(coveragePayload.features[0].properties.mesh, "34.71,137.81");
  assert.equal(coveragePayload.features[0].properties.count, 1);
  assert.equal(coveragePayload.maxCount, 1);
  assert.equal(coveragePayload.compatibility.source, "cloudflare_readmodel_public_observations");
  assert.equal(coveragePayload.compatibility.exactLocationExposed, false);
  assert.doesNotMatch(JSON.stringify(coveragePayload), /34\.71234|137\.81234/);

  const observationsResponse = await worker.fetch(new Request("https://shadow.test/api/v1/map/observations?cell_id=cell%3A34.71%2C137.81"), env);
  const observationsPayload = await observationsResponse.json() as any;
  assert.equal(observationsResponse.ok, true, JSON.stringify(observationsPayload));
  assert.ok(Array.isArray(observationsPayload.items));
  assert.equal(observationsPayload.items.length, 1);
  assert.equal(observationsPayload.items[0].visitId, "visit-map-contract");
  assert.equal(observationsPayload.items[0].occurrenceId, "occ:visit-map-contract:0");
  assert.equal(observationsPayload.items[0].displayName, "地図テスト植物");
  assert.equal(observationsPayload.items[0].cellId, "cell:34.71,137.81");
  assert.match(observationsPayload.items[0].photoUrl, /^\/derived\/.+\/display\.webp$/);
  assert.equal(observationsPayload.stats.selectedCellId, "cell:34.71,137.81");
  assert.ok(!("features" in observationsPayload));
  assert.doesNotMatch(JSON.stringify(observationsPayload), /34\.71234|137\.81234/);

  env.OBS_DB.readmodel.set("visit-unidentified-contract", {
    observation_id: "visit-unidentified-contract",
    public_cell: "34.71,137.81",
    observed_at: "2026-06-15T01:00:00.000Z",
    taxon_label: "unidentified",
    asset_count: 0,
    partition_month: "2026-06"
  });
  env.OBS_DB.publicMapSnapshotRecords.push({
    occurrence_id: "occ:visit-unidentified-contract:0",
    visit_id: "visit-unidentified-contract",
    cell_1000: "34.71,137.81",
    observed_at: "2026-06-15T01:00:00.000Z",
    display_name: "unidentified",
    asset_count: 0
  });
  const unidentifiedResponse = await worker.fetch(new Request("https://shadow.test/api/v1/map/observations?cell_id=cell%3A34.71%2C137.81&limit=10"), env);
  const unidentifiedPayload = await unidentifiedResponse.json() as any;
  const unidentified = unidentifiedPayload.items.find((item: any) => item.visitId === "visit-unidentified-contract");
  assert.equal(unidentified.displayName, "同定待ち");
  assert.equal(unidentified.isAwaitingId, true);

  const areaResponse = await worker.fetch(new Request(
    "https://shadow.test/api/v1/map/area-polygons?bbox=137.70%2C34.70%2C137.82%2C34.72&sources=school"
  ), env);
  const areaPayload = await areaResponse.json() as any;
  assert.equal(areaResponse.ok, true, JSON.stringify(areaPayload));
  assert.equal(areaPayload.features.length, 1);
  assert.equal(areaPayload.features[0].properties.field_id, schoolFieldId);
  assert.equal(areaPayload.features[0].properties.name, "地図テスト小学校");
  assert.equal(areaPayload.features[0].properties.source, "school");
  assert.equal(areaPayload.stats.source, "cloudflare_field_detail_readmodel");
  assert.doesNotMatch(JSON.stringify(areaPayload), /34\.71234|137\.81234/);

  const myPlacesResponse = await worker.fetch(new Request("https://shadow.test/api/v1/map/my-places"), env);
  assert.equal(myPlacesResponse.ok, true);
  assert.deepEqual(await myPlacesResponse.json(), { signedIn: false, items: [] });

  for (const path of [
    "/api/v1/map/traces?limit=200",
    "/api/v1/map/frontier?bbox=137.70%2C34.70%2C137.82%2C34.72"
  ]) {
    const response = await worker.fetch(new Request(`https://shadow.test${path}`), env);
    const payload = await response.json() as any;
    assert.equal(response.ok, true, path);
    assert.equal(payload.type, "FeatureCollection");
    assert.deepEqual(payload.features, []);
    assert.doesNotMatch(JSON.stringify(payload), /34\.71234|137\.81234/);
  }

  const guideSpotsResponse = await worker.fetch(new Request(
    "https://shadow.test/api/v1/map/guide-spots?bbox=137.55%2C34.60%2C137.90%2C34.85&limit=20"
  ), env);
  const guideSpotsPayload = await guideSpotsResponse.json() as any;
  assert.equal(guideSpotsResponse.ok, true, JSON.stringify(guideSpotsPayload));
  assert.equal(guideSpotsPayload.type, "FeatureCollection");
  assert.equal(guideSpotsPayload.stats.source, "cloudflare_static_global_guide_spots");
  assert.equal(guideSpotsPayload.stats.coverage, "global_bbox");
  assert.ok(guideSpotsPayload.features.length >= 8);
  assert.equal(guideSpotsPayload.features[0].geometry.type, "Point");
  assert.ok(guideSpotsPayload.features.some((feature: any) => feature.properties.id === "hamamatsu-shijimizuka-site"));
  assert.ok(guideSpotsPayload.features.some((feature: any) => feature.properties.category === "heritage"));

  const effortResponse = await worker.fetch(new Request("https://shadow.test/api/v1/map/effort-summary?bbox=137.70%2C34.70%2C137.82%2C34.72"), env);
  const effortPayload = await effortResponse.json() as any;
  assert.equal(effortResponse.ok, true);
  assert.equal(effortPayload.actorLens.actorClass, "community");
  assert.equal(effortPayload.frontierRemaining.blankCount, 0);

  const siteBriefResponse = await worker.fetch(new Request("https://shadow.test/api/v1/map/site-brief?lat=34.71&lng=137.81&lang=ja"), env);
  const siteBriefPayload = await siteBriefResponse.json() as any;
  assert.equal(siteBriefResponse.ok, true);
  assert.equal(siteBriefPayload.hypothesis.label, "まだ見落としがありそうな場所");
  assert.match(siteBriefPayload.reasons[0], /身近な環境の境目/);
  assert.doesNotMatch(JSON.stringify(siteBriefPayload), /Cloudflare|互換表示|移行中/);
  assert.doesNotMatch(JSON.stringify(siteBriefPayload), /34\.71|137\.81/);

  const kpiResponse = await worker.fetch(new Request("https://shadow.test/api/v1/ui-kpi/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ eventName: "section_view", pagePath: "/map" })
  }), env);
  const kpiPayload = await kpiResponse.json() as any;
  assert.equal(kpiResponse.ok, true);
  assert.equal(kpiPayload.ok, true);
});

test("public map routes prefer D1 snapshot records when present", async () => {
  const { env, obs } = createEnv();
  obs.readmodel.set("legacy-readmodel-row", {
    observation_id: "legacy-readmodel-row",
    public_cell: "34.71,137.81",
    observed_at: "2026-06-15T01:00:00.000Z",
    taxon_label: "legacy fallback",
    asset_count: 1,
    partition_month: "2026-06"
  });
  obs.publicMapSnapshotMeta = {
    snapshot_key: "public-map:v1:global",
    generated_at: "2026-06-25T00:00:00.000Z",
    source_sample_size: 1,
    public_record_count: 1,
    refreshed_by: "test",
    policy_json: "{\"minCellRecords\":3,\"policy\":\"k_anonymous_cell_aggregate\"}"
  };
  obs.publicMapSnapshotRecords.push({
    visit_id: "snapshot-visit",
    cell_1000: "35.01,138.39",
    observed_at: "2026-06-25T00:00:00.000Z",
    display_name: "D1 snapshot plant",
    asset_count: 2
  });

  const cellsResponse = await worker.fetch(new Request("https://shadow.test/api/v1/map/cells"), env);
  const cellsPayload = await cellsResponse.json() as any;
  assert.equal(cellsResponse.ok, true, JSON.stringify(cellsPayload));
  assert.equal(cellsPayload.features.length, 1);
  assert.equal(cellsPayload.features[0].properties.cellId, "cell:35.01,138.39");
  assert.doesNotMatch(JSON.stringify(cellsPayload), /legacy-readmodel-row|34\.71,137\.81/);

  const observationsResponse = await worker.fetch(new Request("https://shadow.test/api/v1/map/observations?cell_id=cell%3A35.01%2C138.39"), env);
  const observationsPayload = await observationsResponse.json() as any;
  assert.equal(observationsResponse.ok, true, JSON.stringify(observationsPayload));
  assert.equal(observationsPayload.items.length, 1);
  assert.equal(observationsPayload.items[0].visitId, "snapshot-visit");
  assert.equal(observationsPayload.items[0].displayName, "D1 snapshot plant");

  const statusResponse = await worker.fetch(new Request("https://shadow.test/ops/public-map-snapshot"), env);
  const statusPayload = await statusResponse.json() as any;
  assert.equal(statusResponse.ok, true, JSON.stringify(statusPayload));
  assert.equal(statusPayload.status, "fresh");
  assert.equal(statusPayload.snapshotKey, "public-map:v1:global");
  assert.equal(statusPayload.publicRecordCount, 1);
  assert.equal(statusPayload.source, "cloudflare_public_map_snapshot_records_v1");
});

test("owner map observations route is native, guest-safe, and owner-scoped", async () => {
  const { env, obs } = createEnv();
  const guest = await worker.fetch(new Request("https://shadow.test/api/v1/map/my-observations?limit=48"), env);
  assert.equal(guest.ok, true);
  assert.deepEqual(await guest.json(), { signedIn: false, items: [] });

  await post("/api/v1/observations/upsert", env, {
    observationId: "owner-map-visit",
    userId: "owner-user",
    observedAt: "2026-06-22T10:00:00.000Z",
    latitude: 35.0104,
    longitude: 138.3929,
    taxon: { vernacularName: "モンシロチョウ" }
  });
  await post("/api/v1/observations/upsert", env, {
    observationId: "other-map-visit",
    userId: "other-user",
    observedAt: "2026-06-22T11:00:00.000Z",
    latitude: 36.0104,
    longitude: 139.3929,
    taxon: { vernacularName: "ヒヨドリ" }
  });

  const ownerAsset = {
    asset_id: "asset-owner-map",
    draft_id: "draft-owner-map",
    observation_id: "owner-map-visit",
    owner_user_id: "owner-user",
    object_key: "original/owner-map.jpg",
    partition_month: "2026-06",
    sha256: "sha-owner",
    mime: "image/jpeg",
    bytes: 1024,
    processing_state: "uploaded",
    public_derivative_key: "thumb/sm/owner-map.jpg",
    public_derivative_sha256: "sha-derivative",
    public_derivative_verified_at: "2026-06-22T10:01:00.000Z",
    public_derivative_metadata_json: "{\"gpsExifPresent\":false}",
    exif_scrub_state: "scrubbed",
    public_ready_at: "2026-06-22T10:01:00.000Z"
  };
  obs.assets.set(ownerAsset.asset_id, ownerAsset);
  obs.assets.set("asset-other-map", {
    ...ownerAsset,
    asset_id: "asset-other-map",
    observation_id: "other-map-visit",
    owner_user_id: "other-user",
    public_derivative_key: "thumb/sm/other-map.jpg"
  });

  const issueResponse = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "owner-user", ttlHours: 1 })
  }), env);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";
  const response = await worker.fetch(new Request("https://shadow.test/api/v1/map/my-observations?limit=48", {
    headers: { cookie }
  }), env);
  const payload = await response.json() as any;

  assert.equal(response.ok, true);
  assert.equal(payload.signedIn, true);
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0].visitId, "owner-map-visit");
  assert.equal(payload.items[0].photoUrl, "/thumb/sm/owner-map.jpg");
  assert.equal(payload.items[0].latitude, 35.0104);
  assert.equal(payload.items[0].longitude, 138.3929);
  assert.equal(payload.items[0].localityLabel, "自分だけに表示");
  assert.ok(!JSON.stringify(payload).includes("other-map-visit"));
});

test("v1 public map nowcast routes proxy fixed JMA targets without exposing a free URL fetcher", async () => {
  const { env } = createEnv();
  const originalFetch = globalThis.fetch;
  const fetchedUrls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    fetchedUrls.push(url);
    if (url.endsWith("/targetTimes_N1.json")) {
      return new Response(JSON.stringify([
        { basetime: "20260620030000", validtime: "20260620030000", elements: ["hrpns"] }
      ]), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/targetTimes_N2.json")) {
      return new Response(JSON.stringify([
        { basetime: "20260620030000", validtime: "20260620030500", elements: ["hrpns"] },
        { basetime: "20260620030000", validtime: "20260620031500", elements: ["hrpns"] },
        { basetime: "20260620030000", validtime: "20260620033000", elements: ["hrpns"] },
        { basetime: "20260620030000", validtime: "20260620040000", elements: ["hrpns"] }
      ]), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/rasrf/targetTimes.json")) {
      return new Response(JSON.stringify([
        { basetime: "20260620030000", validtime: "20260620050000", member: "immed", elements: ["rasrf"] },
        { basetime: "20260620030000", validtime: "20260620060000", member: "immed", elements: ["rasrf"] },
        { basetime: "20260620030000", validtime: "20260620070000", member: "immed", elements: ["rasrf"] },
        { basetime: "20260620030000", validtime: "20260620080000", member: "immed", elements: ["rasrf"] },
        { basetime: "20260620030000", validtime: "20260620090000", member: "immed", elements: ["rasrf"] }
      ]), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url === "https://www.jma.go.jp/bosai/jmatile/data/nowc/20260620030000/none/20260620031500/surf/hrpns/5/28/12.png") {
      return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200, headers: { "content-type": "image/png" } });
    }
    if (url === "https://www.jma.go.jp/bosai/jmatile/data/rasrf/20260620030000/immed/20260620090000/surf/rasrf/5/28/12.png") {
      return new Response(new Uint8Array([137, 80, 78, 72]), { status: 200, headers: { "content-type": "image/png" } });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  try {
    const timesResponse = await worker.fetch(new Request("https://shadow.test/api/v1/weather/jma-nowcast/times"), env);
    const timesPayload = await timesResponse.json() as any;
    assert.equal(timesResponse.ok, true, JSON.stringify(timesPayload));
    assert.equal(timesPayload.source, "jma_precipitation_map");
    assert.equal(timesPayload.times.length, 10);
    assert.equal(timesPayload.times[2].offsetMinutes, 15);
    assert.equal(timesPayload.times[5].product, "short_range");
    assert.equal(timesPayload.times[5].member, "immed");
    assert.equal(timesPayload.times.at(-1).offsetMinutes, 360);
    assert.match(timesPayload.tileUrlTemplate, /^\/api\/v1\/weather\/jma-nowcast\/tile/);
    assert.match(timesPayload.tileUrlTemplate, /product=\{product\}/);
    assert.match(timesPayload.tileUrlTemplate, /member=\{member\}/);

    const localizedTimesResponse = await worker.fetch(new Request("https://shadow.test/ja/api/v1/weather/jma-nowcast/times"), env);
    assert.equal(localizedTimesResponse.ok, true);

    const invalidTile = await worker.fetch(new Request("https://shadow.test/api/v1/weather/jma-nowcast/tile?basetime=https://evil.test&validtime=20260620031500&z=5&x=28&y=12"), env);
    assert.equal(invalidTile.status, 400);

    const overscaledTile = await worker.fetch(new Request("https://shadow.test/api/v1/weather/jma-nowcast/tile?basetime=20260620030000&validtime=20260620031500&z=11&x=1807&y=813"), env);
    assert.equal(overscaledTile.status, 400);
    assert.equal(fetchedUrls.some((url) => url.includes("/11/1807/813.png")), false);

    const tileResponse = await worker.fetch(new Request("https://shadow.test/api/v1/weather/jma-nowcast/tile?basetime=20260620030000&validtime=20260620031500&z=5&x=28&y=12"), env);
    assert.equal(tileResponse.ok, true);
    assert.equal(tileResponse.headers.get("content-type"), "image/png");
    assert.equal(tileResponse.headers.get("x-ikimon-weather-cache"), "miss");
    assert.deepEqual([...new Uint8Array(await tileResponse.arrayBuffer())], [137, 80, 78, 71]);

    const shortRangeTileResponse = await worker.fetch(new Request("https://shadow.test/api/v1/weather/jma-nowcast/tile?product=short_range&member=immed&basetime=20260620030000&validtime=20260620090000&z=5&x=28&y=12"), env);
    assert.equal(shortRangeTileResponse.ok, true);
    assert.equal(shortRangeTileResponse.headers.get("content-type"), "image/png");
    assert.equal(shortRangeTileResponse.headers.get("x-ikimon-weather-cache"), "miss");
    assert.deepEqual([...new Uint8Array(await shortRangeTileResponse.arrayBuffer())], [137, 80, 78, 72]);
    assert.equal(fetchedUrls.some((url) => url.includes("evil.test")), false);
    assert.equal(fetchedUrls.includes("https://www.jma.go.jp/bosai/jmatile/data/nowc/20260620030000/none/20260620031500/surf/hrpns/5/28/12.png"), true);
    assert.equal(fetchedUrls.includes("https://www.jma.go.jp/bosai/jmatile/data/rasrf/20260620030000/immed/20260620090000/surf/rasrf/5/28/12.png"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production map area polygons stay native while guide spots stay native", async () => {
  const { env, core } = createEnv();
  env.OBS_DB.productionAreaPolygons.set("native-area", productionAreaPolygonRow("native-area", {
    name: "native area",
    source: "osm_park",
    admin_level: "osm_park"
  }));
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const cellsResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/map/cells?bbox=137.70,34.70,137.82,34.72&zoom=13"), productionEnv);
    assert.equal(cellsResponse.ok, true);
    assert.equal(fallbackCalls, 0);

    const areaResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/map/area-polygons?bbox=137.70,34.70,137.82,34.72&zoom=17.5"), productionEnv);
    const areaPayload = await areaResponse.json() as any;
    assert.equal(areaResponse.ok, true, JSON.stringify(areaPayload));
    assert.equal(areaPayload.features.length, 1);
    assert.equal(areaPayload.features[0].properties.name, "native area");
    assert.equal(areaPayload.stats.source, "cloudflare_area_polygon_readmodel");

    const guideResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/map/guide-spots?bbox=137.70,34.70,137.82,34.72"), productionEnv);
    assert.equal(guideResponse.ok, true);

    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("shadow takedown proof removes public surfaces while preserving canonical evidence", async () => {
  const { env, obs } = createEnv();
  const response = await worker.fetch(new Request("https://shadow.test/shadow-smoke/takedown-proof?id=unit"), env);
  const payload = await response.json() as any;

  assert.equal(response.ok, true, JSON.stringify(payload));
  assert.equal(payload.ok, true, JSON.stringify(payload));
  assert.equal(payload.before.readmodelRows, 1);
  assert.equal(payload.before.publicDetailVisible, true);
  assert.equal(payload.before.mapVisible, true);
  assert.equal(payload.after.readmodelRows, 0);
  assert.equal(payload.after.publicDetailVisible, false);
  assert.equal(payload.after.mapVisible, false);
  assert.equal(payload.canonical.emergency_hidden, 1);
  assert.equal(payload.canonical.asset_count, 1);
  assert.equal(payload.invariants.canonicalDeleted, false);
  assert.equal(payload.invariants.readmodelHidden, true);
  assert.equal(obs.observations.has(payload.observationId), true);
  assert.equal([...obs.assets.values()].some((asset) => asset.observation_id === payload.observationId), true);

  const detailResponse = await worker.fetch(new Request(`https://shadow.test/api/v1/observations/${encodeURIComponent(payload.observationId)}/public-detail`), env);
  assert.equal(detailResponse.status, 404);

  const mapResponse = await worker.fetch(new Request("https://shadow.test/api/v1/map/observations?cell_id=cell%3A34.71%2C137.81"), env);
  const mapPayload = await mapResponse.json() as any;
  assert.equal(mapResponse.ok, true, JSON.stringify(mapPayload));
  assert.equal(mapPayload.items.some((item: any) => item.visitId === payload.observationId), false);

  const productionResponse = await worker.fetch(new Request("https://shadow.test/shadow-smoke/takedown-proof?id=prod"), {
    ...env,
    ENVIRONMENT: "production"
  });
  assert.equal(productionResponse.status, 404);
});

test("d1 partition routing uses one active binding with logical month partitions", async () => {
  const { env, obs } = createEnv();
  await post("/api/v1/observations/upsert", env, {
    observationId: "visit-partition-june",
    userId: "partition-user",
    observedAt: "2026-06-15T02:00:00.000Z",
    latitude: 34.71234,
    longitude: 137.81234,
    taxon: { vernacularName: "六月テスト植物", rank: "species" }
  });
  await post("/api/v1/observations/upsert", env, {
    observationId: "visit-partition-july",
    userId: "partition-user",
    observedAt: "2026-07-02T02:00:00.000Z",
    latitude: 34.72234,
    longitude: 137.82234,
    taxon: { vernacularName: "七月テスト植物", rank: "species" }
  });

  assert.equal(obs.observations.get("visit-partition-june")?.partition_month, "2026-06");
  assert.equal(obs.observations.get("visit-partition-july")?.partition_month, "2026-07");

  const response = await worker.fetch(internalRequest("/internal/d1-partition-routing-proof?observed_at=2026-07-20T00:00:00.000Z"), env);
  const payload = await response.json() as any;
  assert.equal(response.ok, true, JSON.stringify(payload));
  assert.equal(payload.proofStatus, "phase1_partition_routing_selected");
  assert.equal(payload.selected.strategy, "single_active_d1_logical_month");
  assert.equal(payload.selected.partitionMonth, "2026-07");
  assert.equal(payload.selected.selectedBinding, "OBS_DB");
  assert.equal(payload.selected.databaseName, "ikimon_shadow_observations_2026_06");
  assert.equal(payload.invariants.manualMonthlyBindingRequired, false);
  assert.equal(payload.invariants.crossD1TransactionRequired, false);
  assert.equal(payload.invariants.archiveCutoverUnit, "partition_month");
  assert.deepEqual(
    payload.allMonths.map((row: any) => [row.partition_month, row.count]),
    [["2026-06", 1], ["2026-07", 1]]
  );
});

test("public observation detail route exposes a safe read page and JSON without exact coordinates", async () => {
  const { env, queue } = createEnv();
  await post("/api/v1/observations/upsert", env, {
    observationId: "visit-detail-contract",
    userId: "detail-user",
    observedAt: "2026-06-15T03:00:00.000Z",
    latitude: 34.71234,
    longitude: 137.81234,
    note: "public detail note",
    taxon: { vernacularName: "詳細テスト植物", rank: "species" }
  });
  await post("/api/v1/observations/visit-detail-contract/photos/upload", env, {
    filename: "detail.jpg",
    mimeType: "image/jpeg",
    base64Data: Buffer.from("detail-image").toString("base64")
  });
  await worker.queue({ messages: queue.messages.map((body) => ({ body: body as any })) }, env);
  env.OBS_DB.assets.set("asset-detail-contract-real-derivative", {
    asset_id: "asset-detail-contract-real-derivative",
    draft_id: "draft-detail-contract-real-derivative",
    observation_id: "visit-detail-contract",
    owner_user_id: "detail-user",
    object_key: "original/visit-detail-contract/detail-real.jpg",
    partition_month: "2026-06",
    sha256: "detail-real-sha",
    mime: "image/jpeg",
    bytes: 1234,
    processing_state: "uploaded",
    public_derivative_key: "derived/import/20260615/observation_photo/asset-detail-contract-real-derivative/display.webp",
    public_derivative_sha256: "detail-real-derivative-sha",
    public_derivative_verified_at: "2026-06-15T03:30:00.000Z",
    public_derivative_metadata_json: "{\"gpsExifPresent\":false,\"contentType\":\"image/webp\",\"scannedContainer\":\"binary\"}",
    exif_scrub_state: "scrubbed",
    public_ready_at: "2026-06-15T03:30:00.000Z"
  });
  await env.ASSET_BUCKET.put(
    "derived/import/20260615/observation_photo/asset-detail-contract-real-derivative/display.webp",
    "detail-real-webp",
    { httpMetadata: { contentType: "image/webp" } }
  );

  const jsonResponse = await worker.fetch(new Request("https://shadow.test/api/v1/observations/occ%3Avisit-detail-contract%3A0/public-detail"), env);
  const jsonPayload = await jsonResponse.json() as any;
  assert.equal(jsonResponse.ok, true, JSON.stringify(jsonPayload));
  assert.equal(jsonPayload.ok, true);
  assert.equal(jsonPayload.observation.visitId, "visit-detail-contract");
  assert.equal(jsonPayload.observation.occurrenceId, "occ:visit-detail-contract:0");
  assert.equal(jsonPayload.observation.displayName, "詳細テスト植物");
  assert.equal(jsonPayload.observation.publicLocation.cellId, "cell:34.71,137.81");
  assert.equal(jsonPayload.observation.privacy.exactLocationExposed, false);
  assert.equal(jsonPayload.observation.photoAssets.length, 1);
  assert.match(jsonPayload.observation.photoAssets[0].url, /asset-detail-contract-real-derivative\/display\.webp$/);
  assert.doesNotMatch(JSON.stringify(jsonPayload), /ownerUserId|observerUserId|observerName|profile|34\.71234|137\.81234/);

  const localizedJsonResponse = await worker.fetch(new Request("https://shadow.test/ja/api/v1/observations/visit-detail-contract/public-detail"), env);
  const localizedJsonPayload = await localizedJsonResponse.json() as any;
  assert.equal(localizedJsonResponse.ok, true, JSON.stringify(localizedJsonPayload));
  assert.equal(localizedJsonPayload.observation.visitId, "visit-detail-contract");

  const imageResponse = await worker.fetch(new Request(`https://shadow.test${jsonPayload.observation.photoAssets[0].url}`), env);
  const imageBody = await imageResponse.text();
  assert.equal(imageResponse.ok, true, imageBody);
  assert.match(imageResponse.headers.get("content-type") ?? "", /image\/webp/);
  assert.equal(imageBody, "detail-real-webp");

  const pageResponse = await worker.fetch(new Request("https://shadow.test/observations/visit-detail-contract"), env);
  const pageHtml = await pageResponse.text();
  assert.equal(pageResponse.ok, true, pageHtml);
  assert.match(pageHtml, /data-cloudflare-observation-detail="1"/);
  assert.match(pageHtml, /obs-vps-image-detail-body/);
  assert.match(pageHtml, /\/assets\/brand\/app-icon-192\.png/);
  assert.match(pageHtml, /\/assets\/brand\/ikimon-wordmark-black\.png/);
  assert.match(pageHtml, /obs-reading-hero/);
  assert.match(pageHtml, /obs-read-progress/);
  assert.match(pageHtml, /obs-media-ledger/);
  assert.match(pageHtml, /obs-hero-media-stack is-photo-only/);
  assert.match(pageHtml, /data-obs-preview-img/);
  assert.match(pageHtml, /data-obs-preview-regions/);
  assert.match(pageHtml, /obs-region-guide is-context-guide/);
  assert.match(pageHtml, /obs-region-guide is-ground-guide/);
  assert.match(pageHtml, /obs-region-guide is-extra-guide/);
  assert.match(pageHtml, /obs-hero-thumb/);
  assert.match(pageHtml, /この記録で読む対象/);
  assert.match(pageHtml, /この記録から読めていること/);
  assert.match(pageHtml, /obs-feedback-chip/);
  assert.match(pageHtml, /公開記録・候補情報/);
  assert.match(pageHtml, /次の写真で増える情報/);
  assert.match(pageHtml, /名前の候補/);
  assert.match(pageHtml, /場所の手がかり/);
  assert.match(pageHtml, /足元の状態/);
  assert.match(pageHtml, /あとで分けられるもの/);
  assert.match(pageHtml, /data-section-code="identification"/);
  assert.match(pageHtml, /同定に参加する/);
  assert.match(pageHtml, /同意する/);
  assert.match(pageHtml, /別候補を提案/);
  assert.match(pageHtml, /保留する/);
  assert.match(pageHtml, /別レコードを追加/);
  assert.match(pageHtml, /提案・コメントの履歴/);
  assert.match(pageHtml, /現在の見方/);
  assert.match(pageHtml, /data-section-code="observation-quality"/);
  assert.match(pageHtml, /観察記録を整える/);
  assert.match(pageHtml, /環境情報の下書き/);
  assert.match(pageHtml, /編集履歴/);
  assert.match(pageHtml, /次に見るなら/);
  assert.match(pageHtml, /obs-reading-flow/);
  assert.match(pageHtml, /obs-local-quality-inline is-full-width/);
  assert.match(pageHtml, /obs-area-records/);
  assert.match(pageHtml, /詳細テスト植物/);
  assert.match(pageHtml, /位置ぼかし/);
  assert.doesNotMatch(pageHtml, /cell:34\.71,137\.81|公開セル|セル単位/);
  assert.doesNotMatch(pageHtml, /class="[^"]*obs-hero-video-frame|class="[^"]*obs-video-evidence-frame|この映像で読む対象を切り替える/);
  assert.doesNotMatch(pageHtml, /画像解析|検出しました|音声を解析/);
  assert.doesNotMatch(pageHtml, /IDENTIFICATION|OBSERVATION QUALITY|記録の質を育てる/);
  assert.doesNotMatch(pageHtml, new RegExp(`\\u91cd\\u306d|${"写真の" + "対象枠"}|${"同じ" + "ページで確認"}|驥阪|縺|蜀`));
  assert.doesNotMatch(pageHtml, /ikimon shadow|data-shadow-observation-detail|ownerUserId|observerUserId|profile\/detail-user|profile\/user_|YAMAKI|34\.71234|137\.81234|\/uploads\//);

  const localizedPageResponse = await worker.fetch(new Request("https://shadow.test/ja/observations/visit-detail-contract"), env);
  const localizedPageHtml = await localizedPageResponse.text();
  assert.equal(localizedPageResponse.ok, true, localizedPageHtml);
  assert.match(localizedPageHtml, /data-cloudflare-observation-detail="1"/);
  assert.match(localizedPageHtml, /obs-reading-hero/);
  assert.match(localizedPageHtml, /obs-media-ledger/);
  assert.match(localizedPageHtml, /obs-hero-media-stack is-photo-only/);
  assert.match(localizedPageHtml, /data-obs-preview-img/);
  assert.match(localizedPageHtml, /詳細テスト植物/);

  const missingResponse = await worker.fetch(new Request("https://shadow.test/observations/not-found"), env);
  assert.equal(missingResponse.status, 404);
});

test("shadow browser smoke pages are available for non-production flow checks", async () => {
  const { env } = createEnv();
  const recordResponse = await worker.fetch(new Request("https://shadow.test/shadow-smoke/record"), env);
  const recordHtml = await recordResponse.text();
  assert.equal(recordResponse.ok, true, recordHtml);
  assert.match(recordHtml, /data-shadow-flow="record"/);
  assert.match(recordHtml, /\/api\/v1\/observations\/upsert/);
  assert.match(recordHtml, /\/photos\/upload/);
  assert.match(recordHtml, /\/public-detail/);
  assert.match(recordHtml, /id="detail-link"/);
  assert.match(recordHtml, /id="map-link"/);

  const mapResponse = await worker.fetch(new Request("https://shadow.test/shadow-smoke/map?cell_id=cell%3A34.71%2C137.81"), env);
  const mapHtml = await mapResponse.text();
  assert.equal(mapResponse.ok, true, mapHtml);
  assert.match(mapHtml, /data-shadow-flow="map"/);
  assert.match(mapHtml, /\/api\/v1\/map\/cells/);
  assert.match(mapHtml, /\/api\/v1\/map\/observations/);
  assert.match(mapHtml, /cell:34\.71,137\.81/);
});

test("production restore parity summary is shadow-only", async () => {
  const { env } = createEnv();
  await env.OBS_DB.prepare(
    `INSERT INTO production_restore_parity_runs
     (run_id, source_db, collected_at, table_count, critical_json, orphan_json, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    "restore-parity-test",
    "ikimon_restore_rehearsal",
    "2026-06-15T00:00:00.000Z",
    2,
    JSON.stringify({ users: 1931 }),
    JSON.stringify({ evidence_assets_missing_blob: 0 }),
    "test"
  ).run();
  await env.OBS_DB.prepare(
    `INSERT INTO production_restore_parity_metrics
     (run_id, metric_type, metric_key, metric_value, detail_json)
     VALUES (?, ?, ?, ?, ?)`
  ).bind("restore-parity-test", "critical_count", "users", "1931", null).run();

  const response = await worker.fetch(internalRequest("/internal/production-restore-parity-summary"), env);
  const payload = await response.json() as any;
  assert.equal(response.ok, true, JSON.stringify(payload));
  assert.equal(payload.run.critical.users, 1931);
  assert.equal(payload.run.orphanChecks.evidence_assets_missing_blob, 0);
  assert.equal(payload.metrics.length, 1);

  const productionResponse = await worker.fetch(new Request("https://shadow.test/internal/production-restore-parity-summary"), {
    ...env,
    ENVIRONMENT: "production"
  });
  assert.equal(productionResponse.status, 404);
});

test("missing legacy media proof keeps backup gaps ledgered and out of public-ready counts", async () => {
  const { env, obs } = createEnv();
  obs.legacyAssetImports.push(
    { asset_id: "missing-photo-1", import_status: "missing_legacy_asset", asset_role: "observation_photo" },
    { asset_id: "missing-photo-2", import_status: "missing_legacy_asset", asset_role: "observation_photo" },
    { asset_id: "stream-video-1", import_status: "stream_inventory_pending", asset_role: "observation_video" }
  );
  obs.legacyR2Imports.push({ asset_id: "ready-photo-1", import_status: "uploaded_verified" });
  obs.productionPublicReadmodel.set("visit-missing-media", {
    visit_id: "visit-missing-media",
    asset_count: 3,
    public_ready_asset_count: 1,
    unresolved_asset_count: 2
  });

  const response = await worker.fetch(
    new Request("https://shadow.test/shadow-smoke/missing-media-ledger-proof?expected_missing=2&expected_stream_pending=1"),
    env
  );
  const payload = await response.json() as any;
  assert.equal(response.ok, true, JSON.stringify(payload));
  assert.equal(payload.gate, "missing_legacy_asset_degraded_public_readmodel");
  assert.equal(payload.publicReadmodel.assetCount, 3);
  assert.equal(payload.publicReadmodel.publicReadyAssetCount, 1);
  assert.equal(payload.publicReadmodel.unresolvedAssetCount, 2);
  assert.equal(payload.invariants.missingLegacyAssetsLedgered, true);
  assert.equal(payload.invariants.streamInventoryPendingLedgered, true);
  assert.equal(payload.invariants.missingLegacyAssetsNotUploadedVerified, true);
  assert.equal(payload.invariants.unresolvedAssetsRemainExplicit, true);
  assert.equal(payload.invariants.publicReadyDoesNotIncludeUnresolved, true);

  const productionResponse = await worker.fetch(
    new Request("https://shadow.test/shadow-smoke/missing-media-ledger-proof?expected_missing=2&expected_stream_pending=1"),
    { ...env, ENVIRONMENT: "production" }
  );
  assert.equal(productionResponse.status, 404);
});

test("stream non-ready proof keeps inprogress Stream assets out of public-ready counts", async () => {
  const { env, obs } = createEnv();
  obs.legacyAssetImports.push(
    { asset_id: "stream-ready-1", import_status: "stream_inventory_pending", asset_role: "observation_video" },
    { asset_id: "stream-ready-2", import_status: "stream_inventory_pending", asset_role: "observation_video" },
    { asset_id: "stream-nonready-1", import_status: "stream_inventory_pending", asset_role: "observation_video" },
    { asset_id: "stream-nonready-2", import_status: "stream_inventory_pending", asset_role: "observation_video" }
  );
  obs.legacyStreamInventory.push(
    {
      stream_uid: "uid-ready-1",
      asset_id: "stream-ready-1",
      visit_id: "visit-ready-1",
      exists_on_stream: 1,
      ready_to_stream: 1,
      status_state: "ready",
        modified_at_stream: "2026-06-15T00:00:00Z"
    },
    {
      stream_uid: "uid-ready-2",
      asset_id: "stream-ready-2",
      visit_id: "visit-ready-2",
      exists_on_stream: 1,
      ready_to_stream: 1,
      status_state: "ready",
        modified_at_stream: "2026-06-15T00:00:00Z"
    },
    {
      stream_uid: "uid-nonready-1",
      asset_id: "stream-nonready-1",
      visit_id: "visit-nonready-1",
      exists_on_stream: 1,
      ready_to_stream: 0,
      status_state: "inprogress",
        modified_at_stream: "2026-06-15T00:00:00Z"
    },
    {
      stream_uid: "uid-nonready-2",
      asset_id: "stream-nonready-2",
      visit_id: "visit-nonready-2",
      exists_on_stream: 1,
      ready_to_stream: 0,
      status_state: "inprogress",
        modified_at_stream: "2026-06-15T00:00:00Z"
    }
  );
  obs.productionPublicReadmodel.set("visit-stream-proof", {
    visit_id: "visit-stream-proof",
    asset_count: 4,
    public_ready_asset_count: 2,
    unresolved_asset_count: 2
  });

  const response = await worker.fetch(
    new Request("https://shadow.test/shadow-smoke/stream-nonready-exclusion-proof?expected_total=4&expected_ready=2&expected_nonready=2"),
    env
  );
  const payload = await response.json() as any;
  assert.equal(response.ok, true, JSON.stringify(payload));
  assert.equal(payload.gate, "stream_nonready_excluded_from_public_ready");
  assert.equal(payload.inventory.total, 4);
  assert.equal(payload.inventory.readyCount, 2);
  assert.equal(payload.inventory.nonReadyCount, 2);
  assert.equal(payload.nonReadyRows.length, 2);
  assert.equal(payload.invariants.allStreamRowsAccountedFor, true);
  assert.equal(payload.invariants.readyCountMatchesExpected, true);
  assert.equal(payload.invariants.nonReadyCountMatchesExpected, true);
  assert.equal(payload.invariants.nonReadyRowsLedgered, true);
  assert.equal(payload.invariants.publicReadyExcludesUnresolved, true);
  assert.equal(payload.invariants.unresolvedCoversNonReady, true);

  const productionResponse = await worker.fetch(
    new Request("https://shadow.test/shadow-smoke/stream-nonready-exclusion-proof?expected_total=4&expected_ready=2&expected_nonready=2"),
    { ...env, ENVIRONMENT: "production" }
  );
  assert.equal(productionResponse.status, 404);
});

test("production import dress rehearsal proof ties imported readmodel to R2 inventory", async () => {
  const { env, obs } = createEnv();
  obs.productionEvidenceAssets.push(
    { asset_id: "r2-photo-1" },
    { asset_id: "r2-photo-2" },
    { asset_id: "missing-photo-1" },
    { asset_id: "stream-video-1" }
  );
  obs.legacyR2Imports.push(
    {
      asset_id: "r2-photo-1",
      import_status: "uploaded_verified",
      expected_bytes: 5,
      uploaded_bytes: 5,
      verified_bytes: 5,
      expected_sha256: "sha-a",
      uploaded_sha256: "sha-a",
      verified_sha256: "sha-a"
    },
    {
      asset_id: "r2-photo-2",
      import_status: "uploaded_verified",
      expected_bytes: 7,
      uploaded_bytes: 7,
      verified_bytes: 7,
      expected_sha256: "sha-b",
      uploaded_sha256: "sha-b",
      verified_sha256: "sha-b"
    }
  );
  obs.legacyAssetImports.push(
    { asset_id: "missing-photo-1", import_status: "missing_legacy_asset", asset_role: "observation_photo" },
    { asset_id: "stream-video-1", import_status: "stream_inventory_pending", asset_role: "observation_video" }
  );
  obs.legacyStreamInventory.push({
    stream_uid: "stream-prod-1",
    asset_id: "stream-video-1",
    visit_id: "visit-prod-1",
    exists_on_stream: 1,
    ready_to_stream: 1,
    status_state: "ready",
    modified_at_stream: "2026-06-15T00:00:00Z"
  });
  obs.productionPublicReadmodel.set("visit-prod-1", {
    visit_id: "visit-prod-1",
    asset_count: 4,
    public_ready_asset_count: 2,
    unresolved_asset_count: 2
  });
  await env.ASSET_BUCKET.put("import-smoke/20260615/r2-photo-1.jpg", "12345");
  await env.ASSET_BUCKET.put("import-smoke/20260615-data/original/r2-photo-2.jpg", "1234567");

  const response = await worker.fetch(
    new Request("https://shadow.test/shadow-smoke/production-import-dress-rehearsal-proof?expected_public_rows=1&expected_evidence_assets=4&expected_r2_verified=2&expected_r2_objects=2&expected_r2_bytes=12&expected_legacy_ledgered=2&expected_unresolved_assets=2&expected_stream_exists=1"),
    env
  );
  const payload = await response.json() as any;
  assert.equal(response.ok, true, JSON.stringify(payload));
  assert.equal(payload.ok, true, JSON.stringify(payload));
  assert.equal(payload.gate, "production_imported_data_r2_inventory_dress_rehearsal");
  assert.equal(payload.publicReadmodel.rows, 1);
  assert.equal(payload.mediaCoverage.evidenceAssets, 4);
  assert.equal(payload.mediaCoverage.r2Verified, 2);
  assert.equal(payload.mediaCoverage.legacyLedgered, 2);
  assert.equal(payload.r2Ledger.checksumMatchCount, 2);
  assert.equal(payload.r2Inventory.totalObjects, 2);
  assert.equal(payload.r2Inventory.totalBytes, 12);
  assert.equal(payload.invariants.mediaCoverageComplete, true);
  assert.equal(payload.invariants.r2InventoryCountMatchesLedger, true);
  assert.equal(payload.invariants.r2InventoryBytesMatchLedger, true);
  assert.equal(payload.invariants.unresolvedAssetsRemainExplicit, true);
  assert.equal(payload.invariants.mutationPerformed, false);
  assert.equal(payload.invariants.productionTrafficAffected, false);

  const productionResponse = await worker.fetch(
    new Request("https://shadow.test/shadow-smoke/production-import-dress-rehearsal-proof"),
    { ...env, ENVIRONMENT: "production" }
  );
  assert.equal(productionResponse.status, 404);
});

test("research export APIs read Cloudflare D1 canonical import without origin fallback", async () => {
  const { env, obs } = createEnv();
  obs.authUsers.set("researcher-1", {
    user_id: "researcher-1",
    email: "researcher@example.test",
    password_hash: null,
    display_name: "Researcher One",
    role_name: "Observer",
    rank_label: null,
    banned: 0,
    last_login_at: null
  });
  obs.productionVisits.set("visit-research-1", {
    visit_id: "visit-research-1",
    legacy_observation_id: "legacy-research-1",
    place_id: "place-research",
    user_id: "researcher-1",
    public_visibility: "public",
    observed_at: "2026-06-20T10:00:00Z"
  });
  obs.productionOccurrences.set("occ-research-1", {
    occurrence_id: "occ-research-1",
    visit_id: "visit-research-1",
    scientific_name: "Papilio xuthus",
    vernacular_name: "ナミアゲハ",
    taxon_rank: "species",
    quality_grade: "research_grade",
    created_at: "2026-06-20T10:01:00Z"
  });
  obs.productionEvidenceAssets.push({
    asset_id: "asset-research-photo",
    visit_id: "visit-research-1",
    occurrence_id: "occ-research-1",
    asset_role: "observation_photo",
    legacy_relative_path: "legacy/photos/research.jpg",
    captured_at: "2026-06-20T10:00:30Z"
  });

  const listResponse = await worker.fetch(
    new Request("https://ikimon.life/api/v1/research/occurrences?taxon=Papilio&limit=10"),
    { ...env, ENVIRONMENT: "production" }
  );
  const listPayload = await listResponse.json() as any;
  assert.equal(listResponse.status, 200, JSON.stringify(listPayload));
  assert.equal(listResponse.headers.get("x-ikimon-cloudflare-native"), "research-export-runtime");
  assert.equal(listPayload.totalReturned, 1);
  assert.equal(listPayload.records[0].occurrenceID, "occ-research-1");
  assert.equal(listPayload.records[0].associatedMedia, "legacy/photos/research.jpg");
  assert.equal(listPayload.records[0].compatibility.source, "cloudflare_research_export_runtime");
  assert.equal(listPayload.records[0].compatibility.fullLegacyResearchParity, false);

  const csvResponse = await worker.fetch(
    new Request("https://ikimon.life/api/v1/research/darwin-core.csv"),
    { ...env, ENVIRONMENT: "production" }
  );
  const csv = await csvResponse.text();
  assert.equal(csvResponse.status, 200);
  assert.equal(csvResponse.headers.get("x-ikimon-cloudflare-native"), "research-export-runtime");
  assert.match(csv, /occurrenceID,eventID,scientificName/);
  assert.match(csv, /occ-research-1,visit-research-1,Papilio xuthus/);

  const summaryResponse = await worker.fetch(
    new Request("https://ikimon.life/api/v1/research/media-role-summary"),
    { ...env, ENVIRONMENT: "production" }
  );
  const summaryPayload = await summaryResponse.json() as any;
  assert.equal(summaryResponse.status, 200, JSON.stringify(summaryPayload));
  assert.equal(summaryResponse.headers.get("x-ikimon-cloudflare-native"), "research-export-runtime");
  assert.equal(summaryPayload.roles[0].mediaRole, "observation_photo");
  assert.equal(summaryPayload.roles[0].assetCount, 1);
});

test("v1 observation upsert returns the current Fastify-compatible ok contract", async () => {
  const { env, obs } = createEnv();
  const response = await post("/api/v1/observations/upsert", env, {
    observationId: "visit-shadow-contract",
    clientSubmissionId: "client-shadow-1",
    userId: "user-contract",
    observedAt: "2026-06-15T02:00:00.000Z",
    latitude: 34.71234,
    longitude: 137.81234,
    siteName: "浜名湖",
    taxon: { vernacularName: "テスト生物", rank: "species" },
    subjects: [
      { vernacularName: "テスト生物", rank: "species", isPrimary: true },
      { vernacularName: "背景の植物", rank: "genus" }
    ],
    waterRecord: {
      catchOutcome: "no_catch",
      publicWaterbodyLabel: " 浜名湖 ",
      waterbodyType: "lake",
      captureMethod: "visual survey",
      participantCount: 2,
      effortMinutes: 35.5,
      targetTaxaScope: "fish",
      releasedCount: 0,
      keptCount: 0,
      environmentSnapshot: { weather: "cloudy" },
      sourcePayload: { source: "unit" }
    },
    sourcePayload: { quick_capture_state: "unknown" }
  });

  assert.equal(response.ok, true);
  assert.equal(response.visitId, "visit-shadow-contract");
  assert.equal(response.occurrenceId, "occ:visit-shadow-contract:0");
  assert.deepEqual(response.occurrenceIds, ["occ:visit-shadow-contract:0", "occ:visit-shadow-contract:1"]);
  assert.equal(response.placeId, "place:34.71,137.81");
  assert.equal(response.impact.placeName, "浜名湖");
  assert.equal(response.impact.focusLabel, "テスト生物");
  assert.equal(response.compatibility.attempted, false);
  assert.equal(response.idempotency.clientSubmissionId, "client-shadow-1");
  assert.equal(Array.isArray(response.placeMemorySample), true);
  assert.equal(response.contributionReceipts.length, 3);
  assert.equal(response.contributionReceipts[0].kind, "record_body_saved");
  assert.equal(obs.observations.get("visit-shadow-contract")?.exact_lat, 34.71234);
  assert.equal(obs.observations.get("visit-shadow-contract")?.public_cell, "34.71,137.81");
  assert.equal(obs.waterRecordExtensions.size, 1);
  const waterRecord = obs.waterRecordExtensions.get("visit-shadow-contract");
  assert.equal(waterRecord?.occurrence_id, "occ:visit-shadow-contract:0");
  assert.equal(waterRecord?.catch_outcome, "no_catch");
  assert.equal(waterRecord?.public_waterbody_label, "浜名湖");
  assert.equal(waterRecord?.participant_count, 2);
  assert.equal(waterRecord?.effort_minutes, 35.5);
  assert.match(waterRecord?.environment_snapshot_json ?? "", /cloudy/);
  assert.equal(obs.waterbodies.size, 1);
  const waterbody = [...obs.waterbodies.values()][0];
  assert.equal(waterbody?.public_label, "浜名湖");
  assert.equal(waterbody?.waterbody_type, "lake");
  assert.equal(obs.civicObservationContexts.size, 0);
});

test("place memory runtime stores D1 entries and serves preferences list and moderation actions", async () => {
  const { env, obs } = createEnv();
  const issueResponse = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "place-memory-user", displayName: "Place Memory User" })
  }), env);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";

  const preferencesResponse = await worker.fetch(new Request("https://shadow.test/api/v1/place-memory/preferences", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ defaultPhotoEchoEnabled: true, defaultTagsPublic: true })
  }), env);
  assert.equal(preferencesResponse.status, 200);

  const upsertResponse = await worker.fetch(new Request("https://shadow.test/api/v1/observations/upsert", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      observationId: "visit-place-memory",
      userId: "place-memory-user",
      observedAt: "2026-06-15T02:00:00.000Z",
      latitude: 34.71234,
      longitude: 137.81234,
      siteName: "浜名湖",
      taxon: { vernacularName: "テスト生物", rank: "species" },
      placeMemory: {
        tags: ["refresh_walk", "first_visit", "unknown_tag"],
        echoNote: "  春の夕方に歩いた  ",
        privateNote: "自分だけのメモ",
        photoEchoEnabled: true
      }
    })
  }), env);
  const upsertPayload = await upsertResponse.json() as any;
  assert.equal(upsertResponse.status, 201, JSON.stringify(upsertPayload));
  assert.equal(upsertPayload.placeMemory.entryId, "pm:visit-place-memory");
  assert.deepEqual(upsertPayload.placeMemory.tags, ["refresh_walk", "first_visit"]);
  assert.equal(upsertPayload.placeMemory.echoNote, "春の夕方に歩いた");
  assert.equal(upsertPayload.placeMemory.photoEchoEnabled, true);
  assert.equal(upsertPayload.placeMemory.photoEchoVisibility, "pending_review");
  assert.equal(upsertPayload.placeMemorySample.length, 1);
  assert.equal(obs.placeMemoryEntries.size, 1);

  const listResponse = await worker.fetch(new Request("https://shadow.test/api/v1/place-memory?cellId=34.71,137.81", {
    headers: { cookie }
  }), env);
  const listPayload = await listResponse.json() as any;
  assert.equal(listResponse.status, 200, JSON.stringify(listPayload));
  assert.equal(listPayload.items.length, 1);
  assert.equal(listPayload.items[0].entryId, "pm:visit-place-memory");
  assert.equal(listPayload.items[0].echoNote, "春の夕方に歩いた");

  const likeResponse = await worker.fetch(new Request("https://shadow.test/api/v1/place-memory/pm%3Avisit-place-memory/like", {
    method: "POST",
    headers: { cookie }
  }), env);
  const likePayload = await likeResponse.json() as any;
  assert.equal(likeResponse.status, 200, JSON.stringify(likePayload));
  assert.equal(likePayload.liked, true);
  assert.equal(likePayload.likeCount, 1);

  const photoReviewResponse = await worker.fetch(new Request("https://shadow.test/api/v1/place-memory/pm%3Avisit-place-memory/photo-review", {
    method: "POST",
    headers: { cookie }
  }), env);
  assert.equal(photoReviewResponse.status, 200);

  const reportResponse = await worker.fetch(new Request("https://shadow.test/api/v1/place-memory/pm%3Avisit-place-memory/report", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ reasonCode: "privacy", reasonNote: "念のため" })
  }), env);
  const reportPayload = await reportResponse.json() as any;
  assert.equal(reportResponse.status, 200, JSON.stringify(reportPayload));
  assert.equal(reportPayload.hiddenForMe, true);
  assert.equal(obs.placeMemoryReports.length, 1);

  const hideResponse = await worker.fetch(new Request("https://shadow.test/api/v1/place-memory/pm%3Avisit-place-memory/hide", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ reason: "self" })
  }), env);
  assert.equal(hideResponse.status, 200);

  const hiddenListResponse = await worker.fetch(new Request("https://shadow.test/api/v1/place-memory?cellId=34.71,137.81", {
    headers: { cookie }
  }), env);
  const hiddenListPayload = await hiddenListResponse.json() as any;
  assert.equal(hiddenListPayload.items.length, 0);
});

test("v1 observation upsert persists civic context only for event, risk, or explicit context writes", async () => {
  const { env, obs } = createEnv();
  await post("/api/v1/observations/upsert", env, {
    observationId: "visit-civic-event",
    userId: "civic-user",
    observedAt: "2026-06-15T02:00:00.000Z",
    latitude: 34.71234,
    longitude: 137.81234,
    taxon: { vernacularName: "イベント植物", rank: "species" },
    eventCode: "EVT-2026"
  });
  const eventContext = obs.civicObservationContexts.get("visit-civic-event");
  assert.equal(eventContext?.context_kind, "event");
  assert.equal(eventContext?.activity_intent, "share");
  assert.equal(eventContext?.participant_role, "participant");
  assert.equal(eventContext?.public_precision, "municipality");
  assert.match(eventContext?.source_payload_json ?? "", /EVT-2026/);

  await post("/api/v1/observations/upsert", env, {
    observationId: "visit-civic-risk",
    userId: "civic-user",
    observedAt: "2026-06-15T02:05:00.000Z",
    latitude: 34.71234,
    longitude: 137.81234,
    taxon: { vernacularName: "希少種候補", rank: "species" },
    sourcePayload: { risk_lane: "rare_sensitive" }
  });
  const riskContext = obs.civicObservationContexts.get("visit-civic-risk");
  assert.equal(riskContext?.context_kind, "risk");
  assert.equal(riskContext?.risk_lane, "rare_sensitive");
  assert.equal(riskContext?.public_precision, "hidden");

  await post("/api/v1/observations/upsert", env, {
    observationId: "visit-civic-explicit",
    userId: "civic-user",
    observedAt: "2026-06-15T02:10:00.000Z",
    latitude: 34.71234,
    longitude: 137.81234,
    taxon: { vernacularName: "学校記録", rank: "species" },
    civicContext: {
      contextKind: "school",
      activityLabel: "校庭調査",
      activityIntent: "learn",
      participantRole: "student",
      audienceScope: "class_group",
      publicPrecision: "site",
      reportConsent: "internal",
      fieldId: "school-field-1",
      sourcePayload: { className: "5-A" }
    }
  });
  const explicitContext = obs.civicObservationContexts.get("visit-civic-explicit");
  assert.equal(explicitContext?.context_kind, "school");
  assert.equal(explicitContext?.activity_label, "校庭調査");
  assert.equal(explicitContext?.activity_intent, "learn");
  assert.equal(explicitContext?.participant_role, "student");
  assert.equal(explicitContext?.audience_scope, "class_group");
  assert.equal(explicitContext?.public_precision, "site");
  assert.equal(explicitContext?.report_consent, "internal");
  assert.equal(explicitContext?.field_id, "school-field-1");
  assert.match(explicitContext?.source_payload_json ?? "", /5-A/);
});

test("v1 photo upload stores base64 media in R2 and returns the shared ok contract", async () => {
  const { env, obs, queue } = createEnv();
  await post("/api/v1/observations/upsert", env, {
    observationId: "visit-photo-contract",
    userId: "user-photo",
    observedAt: "2026-06-15T02:00:00.000Z",
    latitude: 34.7,
    longitude: 137.8
  });

  const response = await post("/api/v1/observations/visit-photo-contract/photos/upload", env, {
    filename: "field photo.jpg",
    mimeType: "image/jpeg",
    base64Data: Buffer.from("image-bytes").toString("base64"),
    mediaRole: "primary",
    facePrivacy: "no_faces"
  });

  assert.equal(response.ok, true);
  assert.equal(response.visitId, "visit-photo-contract");
  assert.equal(response.occurrenceId, "occ:visit-photo-contract:0");
  assert.match(response.relativePath, /^original\/v1-compat\/visit-photo-contract\/asset_/);
  assert.equal(response.publicUrl, `/${response.relativePath}`);
  assert.equal(response.facePrivacy, "no_faces");
  assert.equal(obs.assets.size, 1);
  assert.equal([...obs.assets.values()][0]?.processing_state, "uploaded");
  assert.equal([...obs.assets.values()][0]?.bytes, 11);
  assert.equal(queue.messages.length, 2);
});

test("v1 video direct upload and finalize keep the current Cloudflare Stream-compatible contract", async () => {
  const { env, obs, queue } = createEnv();
  const guestResponse = await worker.fetch(new Request("https://shadow.test/api/v1/videos/direct-upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filename: "blocked.mp4" })
  }), env);
  assert.equal(guestResponse.status, 401);
  assert.deepEqual(await guestResponse.json(), { ok: false, error: "session_required" });

  await post("/api/v1/observations/upsert", env, {
    observationId: "visit-video-contract",
    userId: "video-user",
    observedAt: "2026-06-15T02:00:00.000Z",
    latitude: 34.7,
    longitude: 137.8
  });

  const issueResponse = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "video-user", ttlHours: 1 })
  }), env);
  assert.equal(issueResponse.ok, true);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";

  const tusMissingLength = await worker.fetch(new Request("https://shadow.test/api/v1/videos/direct-upload", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      filename: "missing-length.mp4",
      observationId: "visit-video-contract",
      uploadProtocol: "tus"
    })
  }), env);
  assert.equal(tusMissingLength.status, 400);
  assert.deepEqual(await tusMissingLength.json(), { ok: false, error: "video_tus_upload_length_required" });

  const directResponse = await worker.fetch(new Request("https://shadow.test/api/v1/videos/direct-upload", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      filename: "field video.mp4",
      observationId: "visit-video-contract",
      maxDurationSeconds: 120,
      fileSizeBytes: 11,
      uploadProtocol: "post"
    })
  }), env);
  const directPayload = await directResponse.json() as any;
  assert.equal(directResponse.ok, true, JSON.stringify(directPayload));
  assert.equal(directPayload.ok, true);
  assert.match(directPayload.uid, /^stream_/);
  assert.equal(directPayload.maxDurationSeconds, 60);
  assert.match(directPayload.uploadUrl, /^https:\/\/shadow\.test\/api\/v1\/videos\/stream_/);
  assert.match(directPayload.iframeUrl, /^\/shadow\/stream\/stream_/);

  const bodyResponse = await worker.fetch(new Request(directPayload.uploadUrl, {
    method: "PUT",
    headers: { "content-type": "video/mp4" },
    body: "video-bytes"
  }), env);
  const bodyPayload = await bodyResponse.json() as any;
  assert.equal(bodyResponse.ok, true, JSON.stringify(bodyPayload));
  assert.equal(bodyPayload.bytes, 11);

  const finalizeResponse = await worker.fetch(new Request(`https://shadow.test/api/v1/videos/${encodeURIComponent(directPayload.uid)}/finalize`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      observationId: "visit-video-contract",
      durationMs: 9000,
      readyToStream: true
    })
  }), env);
  const finalizePayload = await finalizeResponse.json() as any;
  assert.equal(finalizeResponse.ok, true, JSON.stringify(finalizePayload));
  assert.equal(finalizePayload.ok, true);
  assert.equal(finalizePayload.video.provider, "cloudflare_stream");
  assert.equal(finalizePayload.video.providerUid, directPayload.uid);
  assert.equal(finalizePayload.video.mediaType, "video");
  assert.equal(finalizePayload.video.assetRole, "observation_video");
  assert.equal(finalizePayload.video.uploadStatus, "ready");
  assert.equal(finalizePayload.video.durationMs, 9000);
  assert.equal(finalizePayload.video.bytes, 11);
  assert.equal(finalizePayload.video.readyToStream, true);
  assert.equal(finalizePayload.video.visitId, "visit-video-contract");
  assert.equal(finalizePayload.video.occurrenceId, "occ:visit-video-contract:0");
  assert.equal(finalizePayload.dispatch.sent, 2);
  assert.equal(queue.messages.length, 2);
  assert.equal(obs.videoUploads.get(directPayload.uid)?.upload_status, "ready");
  assert.equal(obs.assets.get(`video_asset_${directPayload.uid}`)?.processing_state, "uploaded");

  await worker.queue({ messages: queue.messages.map((body) => ({ body: body as any })) }, env);
  assert.equal(obs.readmodel.get("visit-video-contract")?.asset_count, 1);

  const streamResponse = await worker.fetch(new Request(`https://shadow.test/shadow/stream/${encodeURIComponent(directPayload.uid)}`), env);
  assert.equal(streamResponse.ok, true);
  assert.equal(streamResponse.headers.get("content-type"), "video/mp4");
  assert.match(await streamResponse.text(), /video-bytes/);

  const thumbnailResponse = await worker.fetch(new Request(`https://shadow.test/shadow/stream/${encodeURIComponent(directPayload.uid)}/thumbnail.jpg`), env);
  assert.equal(thumbnailResponse.ok, true);
  assert.equal(thumbnailResponse.headers.get("content-type"), "image/jpeg");

  const unknownFinalize = await worker.fetch(new Request("https://shadow.test/api/v1/videos/unknown-stream/finalize", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({})
  }), env);
  const unknownPayload = await unknownFinalize.json() as any;
  assert.equal(unknownFinalize.ok, true, JSON.stringify(unknownPayload));
  assert.equal(unknownPayload.video.pending, true);
  assert.equal(unknownPayload.video.providerUid, "unknown-stream");
  assert.equal(unknownPayload.video.readyToStream, false);
});

test("v1 video stream webhook verifies signature and marks D1 video ready", async () => {
  const { env, obs, queue } = createEnv();
  env.CLOUDFLARE_STREAM_WEBHOOK_SECRET = "test-stream-secret";

  await post("/api/v1/observations/upsert", env, {
    observationId: "visit-video-webhook",
    userId: "video-webhook-user",
    observedAt: "2026-06-15T02:00:00.000Z",
    latitude: 34.7,
    longitude: 137.8
  });

  const issueResponse = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "video-webhook-user", ttlHours: 1 })
  }), env);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";

  const directResponse = await worker.fetch(new Request("https://shadow.test/api/v1/videos/direct-upload", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      filename: "field webhook.mp4",
      observationId: "visit-video-webhook",
      fileSizeBytes: 12,
      uploadProtocol: "post"
    })
  }), env);
  const directPayload = await directResponse.json() as any;
  assert.equal(directResponse.ok, true, JSON.stringify(directPayload));

  const bodyResponse = await worker.fetch(new Request(directPayload.uploadUrl, {
    method: "PUT",
    headers: { "content-type": "video/mp4" },
    body: "video-webhook"
  }), env);
  assert.equal(bodyResponse.ok, true);

  const payload = JSON.stringify({
    uid: directPayload.uid,
    readyToStream: true,
    duration: 8.25,
    size: 13,
    uploaded: "2026-06-15T02:05:00.000Z",
    status: { state: "ready" }
  });
  const invalidResponse = await worker.fetch(new Request("https://shadow.test/api/v1/videos/stream-webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "webhook-signature": "time=1,sig1=bad" },
    body: payload
  }), env);
  assert.equal(invalidResponse.status, 401);

  const webhookResponse = await worker.fetch(new Request("https://shadow.test/api/v1/videos/stream-webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-signature": streamWebhookSignature(payload, env.CLOUDFLARE_STREAM_WEBHOOK_SECRET)
    },
    body: payload
  }), env);
  const webhookPayload = await webhookResponse.json() as any;
  assert.equal(webhookResponse.ok, true, JSON.stringify(webhookPayload));
  assert.equal(webhookPayload.ok, true);
  assert.equal(webhookPayload.known, true);
  assert.equal(webhookPayload.readyToStream, true);
  assert.equal(webhookPayload.video.providerUid, directPayload.uid);
  assert.equal(webhookPayload.video.uploadStatus, "ready");
  assert.equal(webhookPayload.video.durationMs, 8250);
  assert.equal(webhookPayload.dispatch.sent, 2);

  const row = obs.videoUploads.get(directPayload.uid);
  assert.equal(row?.upload_status, "ready");
  assert.equal(row?.ready_to_stream, 1);
  assert.equal(row?.duration_ms, 8250);
  assert.equal(row?.bytes, 13);
  assert.equal(obs.assets.get(`video_asset_${directPayload.uid}`)?.processing_state, "uploaded");
  assert.equal(queue.messages.length, 2);
});

test("shadow video metadata proof verifies served video and poster bytes without exposing exact location", async () => {
  const { env } = createEnv();

  const response = await worker.fetch(new Request("https://shadow.test/shadow-smoke/video-metadata-proof?id=unit"), env);
  const payload = await response.json() as any;
  assert.equal(response.ok, true, JSON.stringify(payload));
  assert.equal(payload.ok, true, JSON.stringify(payload));
  assert.match(payload.uid, /^stream_/);
  assert.equal(payload.served.videoStatus, 200);
  assert.equal(payload.served.videoContentType, "video/mp4");
  assert.equal(payload.served.posterStatus, 200);
  assert.equal(payload.served.posterContentType, "image/jpeg");
  assert.equal(payload.videoInspection.tool, "shadow-video-container-byte-signature-scan-v1");
  assert.equal(payload.videoInspection.scannedContainer, "mp4");
  assert.equal(payload.videoInspection.ftypPresent, true);
  assert.equal(payload.videoInspection.gpsExifPresent, false);
  assert.equal(payload.posterInspection.gpsExifPresent, false);
  assert.equal(payload.visibility.publicDetailVisible, true);
  assert.equal(payload.visibility.mapVisible, true);
  assert.equal(payload.invariants.exactLocationExposed, false);

  const productionResponse = await worker.fetch(new Request("https://shadow.test/shadow-smoke/video-metadata-proof?id=prod"), {
    ...env,
    ENVIRONMENT: "production"
  });
  assert.equal(productionResponse.status, 404);
});

test("reverse delta dry-run exports replayable write ledger with drift zero", async () => {
  const { env, obs } = createEnv();
  const prefix = "reverse-delta-contract";

  await post("/api/v1/observations/upsert", env, {
    observationId: `${prefix}-visit`,
    userId: "reverse-user",
    observedAt: "2026-06-15T04:00:00.000Z",
    latitude: 34.71234,
    longitude: 137.81234,
    taxon: { vernacularName: "復元テスト", rank: "species" }
  });
  await post(`/api/v1/observations/${prefix}-visit/photos/upload`, env, {
    filename: "reverse.jpg",
    mimeType: "image/jpeg",
    base64Data: Buffer.from("reverse-image").toString("base64")
  });

  const issueResponse = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "reverse-user", ttlHours: 1 })
  }), env);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";
  const directResponse = await worker.fetch(new Request("https://shadow.test/api/v1/videos/direct-upload", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      filename: "reverse.mp4",
      observationId: `${prefix}-visit`,
      fileSizeBytes: 12,
      uploadProtocol: "post"
    })
  }), env);
  const directPayload = await directResponse.json() as any;
  await worker.fetch(new Request(directPayload.uploadUrl, {
    method: "PUT",
    headers: { "content-type": "video/mp4" },
    body: "reversevideo"
  }), env);
  await worker.fetch(new Request(`https://shadow.test/api/v1/videos/${encodeURIComponent(directPayload.uid)}/finalize`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      observationId: `${prefix}-visit`,
      durationMs: 12000,
      readyToStream: true
    })
  }), env);

  assert.equal(obs.observations.size, 1);
  assert.equal([...obs.assets.values()].filter((asset) => asset.observation_id === `${prefix}-visit`).length, 2);
  assert.equal(obs.rollbackLedger.size, 3);

  const response = await worker.fetch(internalRequest(`/internal/reverse-delta-dry-run?target_prefix=${encodeURIComponent(prefix)}&limit=20`), env);
  const payload = await response.json() as any;
  assert.equal(response.ok, true, JSON.stringify(payload));
  assert.equal(payload.ok, true, JSON.stringify(payload));
  assert.equal(payload.mode, "dry_run_no_vps_mutation");
  assert.equal(payload.replay.mutationPerformed, false);
  assert.deepEqual(payload.counts, {
    rollbackLedger: 3,
    observations: 1,
    assets: 2,
    ledgerObservations: 1,
    ledgerAssets: 2
  });
  assert.deepEqual(payload.drift, {
    observationsWithoutLedger: 0,
    ledgerObservationsWithoutRows: 0,
    assetsWithoutLedger: 0,
    ledgerAssetsWithoutRows: 0
  });
  assert.deepEqual(
    payload.events.map((event: any) => event.event_type).sort(),
    ["asset.photo.upload", "asset.video.finalize", "observation.upsert"]
  );
  assert.match(payload.events[0].replay_sql, /INSERT INTO rollback_/);

  const proofResponse = await worker.fetch(new Request(`https://shadow.test/shadow-smoke/reverse-delta-proof?target_prefix=${encodeURIComponent(prefix)}&expected_observations=1&expected_assets=2&expected_ledger=3`), env);
  const proofPayload = await proofResponse.json() as any;
  assert.equal(proofResponse.ok, true, JSON.stringify(proofPayload));
  assert.equal(proofPayload.ok, true, JSON.stringify(proofPayload));
  assert.equal(proofPayload.gate, "integrated_staging_reverse_delta_write_drain");
  assert.equal(proofPayload.mode, "dry_run_no_vps_mutation");
  assert.deepEqual(proofPayload.counts, {
    rollbackLedger: 3,
    observations: 1,
    assets: 2,
    ledgerObservations: 1,
    ledgerAssets: 2
  });
  assert.deepEqual(proofPayload.drift, {
    observationsWithoutLedger: 0,
    ledgerObservationsWithoutRows: 0,
    assetsWithoutLedger: 0,
    ledgerAssetsWithoutRows: 0
  });
  assert.equal(proofPayload.invariants.mutationPerformed, false);
  assert.equal(proofPayload.invariants.productionTrafficAffected, false);

  const productionResponse = await worker.fetch(new Request("https://shadow.test/internal/reverse-delta-dry-run"), {
    ...env,
    ENVIRONMENT: "production"
  });
  assert.equal(productionResponse.status, 404);

  const productionProofResponse = await worker.fetch(new Request(`https://shadow.test/shadow-smoke/reverse-delta-proof?target_prefix=${encodeURIComponent(prefix)}`), {
    ...env,
    ENVIRONMENT: "production"
  });
  assert.equal(productionProofResponse.status, 404);
});

test("shadow update/delete proof replays ledger idempotently while preserving canonical data", async () => {
  const { env, obs } = createEnv();

  const response = await worker.fetch(new Request("https://shadow.test/shadow-smoke/update-delete-replay-proof?id=unit"), env);
  const payload = await response.json() as any;
  assert.equal(response.ok, true, JSON.stringify(payload));
  assert.equal(payload.ok, true, JSON.stringify(payload));
  assert.equal(payload.gate, "integrated_staging_update_delete_idempotent_replay");
  assert.equal(payload.mode, "dry_run_no_vps_mutation");
  assert.deepEqual(payload.counts.eventTypes, {
    "observation.upsert": 2,
    "asset.photo.upload": 1,
    "observation.hide": 1
  });
  assert.equal(payload.counts.rollbackLedger, 4);
  assert.equal(payload.counts.observations, 1);
  assert.equal(payload.counts.assets, 1);
  assert.equal(payload.beforeHide.publicDetailVisible, true);
  assert.equal(payload.beforeHide.mapVisible, true);
  assert.equal(payload.afterHide.publicDetailVisible, false);
  assert.equal(payload.afterHide.mapVisible, false);
  assert.equal(payload.canonical.emergency_hidden, 1);
  assert.equal(payload.replay.mutationPerformed, false);
  assert.equal(payload.replay.firstFingerprint, payload.replay.secondFingerprint);
  assert.equal(payload.replay.finalObservation.note, "shadow update/delete replay proof updated");
  assert.equal(payload.replay.finalObservation.emergencyHidden, true);
  assert.equal(payload.invariants.updateLedgered, true);
  assert.equal(payload.invariants.hideLedgered, true);
  assert.equal(payload.invariants.replayIdempotent, true);
  assert.equal(payload.invariants.mutationPerformed, false);
  assert.equal(payload.invariants.productionTrafficAffected, false);
  assert.equal(obs.observations.size, 1);
  assert.equal(obs.rollbackLedger.size, 4);

  const detailResponse = await worker.fetch(new Request(`https://shadow.test/api/v1/observations/${encodeURIComponent(payload.observationId)}/public-detail`), env);
  assert.equal(detailResponse.status, 404);

  const productionResponse = await worker.fetch(new Request("https://shadow.test/shadow-smoke/update-delete-replay-proof?id=prod"), {
    ...env,
    ENVIRONMENT: "production"
  });
  assert.equal(productionResponse.status, 404);
});

test("shadow rollback restore smoke restores observation, photo, video, and hide state from ledger", async () => {
  const { env, obs } = createEnv();

  const response = await worker.fetch(new Request("https://shadow.test/shadow-smoke/rollback-restore-smoke?id=unit"), env);
  const payload = await response.json() as any;
  assert.equal(response.ok, true, JSON.stringify(payload));
  assert.equal(payload.ok, true, JSON.stringify(payload));
  assert.equal(payload.gate, "integrated_staging_rollback_restore_smoke");
  assert.equal(payload.mode, "dry_run_no_vps_mutation");
  assert.deepEqual(payload.counts.eventTypes, {
    "observation.upsert": 1,
    "asset.photo.upload": 1,
    "asset.video.finalize": 1,
    "observation.hide": 1
  });
  assert.equal(payload.counts.rollbackLedger, 4);
  assert.equal(payload.counts.restoredObservations, 1);
  assert.equal(payload.counts.restoredAssets, 2);
  assert.equal(payload.counts.canonicalAssets, 2);
  assert.equal(payload.beforeHide.publicDetailVisible, true);
  assert.equal(payload.beforeHide.mapVisible, true);
  assert.equal(payload.afterHide.publicDetailVisible, false);
  assert.equal(payload.afterHide.mapVisible, false);
  assert.equal(payload.canonical.emergency_hidden, 1);
  assert.equal(payload.canonical.asset_count, 2);
  assert.equal(payload.restore.target, "rollback_restore_state_from_rollback_ledger");
  assert.equal(payload.restore.mutationPerformed, false);
  assert.equal(payload.restore.firstFingerprint, payload.restore.secondFingerprint);
  assert.equal(payload.restore.finalObservation.note, "shadow rollback restore smoke");
  assert.equal(payload.restore.finalObservation.emergencyHidden, true);
  assert.equal(payload.restore.assets.length, 2);
  assert.equal(payload.invariants.observationRestored, true);
  assert.equal(payload.invariants.hiddenStateRestored, true);
  assert.equal(payload.invariants.assetsRestored, true);
  assert.equal(payload.invariants.photoRestored, true);
  assert.equal(payload.invariants.videoRestored, true);
  assert.equal(payload.invariants.replaySqlReady, true);
  assert.equal(payload.invariants.replayIdempotent, true);
  assert.equal(payload.invariants.canonicalPreserved, true);
  assert.equal(payload.invariants.publicSurfacesHidden, true);
  assert.equal(payload.invariants.mutationPerformed, false);
  assert.equal(payload.invariants.productionTrafficAffected, false);
  assert.equal(obs.observations.size, 1);
  assert.equal(obs.rollbackLedger.size, 4);

  const productionResponse = await worker.fetch(new Request("https://shadow.test/shadow-smoke/rollback-restore-smoke?id=prod"), {
    ...env,
    ENVIRONMENT: "production"
  });
  assert.equal(productionResponse.status, 404);
});

test("shadow route-change rehearsal proves cutover matrix without mutating DNS or production routes", async () => {
  const { env } = createEnv();

  const response = await worker.fetch(new Request("https://shadow.test/shadow-smoke/route-change-rehearsal-proof?staging_host=staging.example.test"), env);
  const payload = await response.json() as any;
  assert.equal(response.ok, true, JSON.stringify(payload));
  assert.equal(payload.ok, true, JSON.stringify(payload));
  assert.equal(payload.gate, "staging_route_change_rehearsal");
  assert.equal(payload.mode, "dry_run_no_dns_or_route_mutation");
  assert.deepEqual(payload.hosts, {
    staging: "staging.example.test",
    production: ["ikimon.life", "www.ikimon.life"]
  });
  assert.equal(payload.routeMatrix.length, 5);
  assert.equal(payload.requiredStagingGates.length, 8);
  assert.equal(payload.rollback.productionDataMutation, false);
  assert.equal(payload.rollback.dnsMutationPerformed, false);
  assert.equal(payload.rollback.routeMutationPerformed, false);
  assert.equal(payload.invariants.dnsUnchanged, true);
  assert.equal(payload.invariants.workerRouteUnchanged, true);
  assert.equal(payload.invariants.maintenanceModeUnchanged, true);
  assert.equal(payload.invariants.mutationPerformed, false);
  assert.equal(payload.invariants.productionTrafficAffected, false);
  assert.equal(payload.invariants.stagingShadowProxyOnly, true);
  assert.equal(payload.invariants.productionShadowProxyClosed, true);
  assert.equal(payload.invariants.apexAndWwwPostCutoverDefined, true);
  assert.equal(payload.invariants.requiredGatesEnumerated, true);
  assert.equal(payload.invariants.rollbackRouteDocumented, true);
  assert.equal(payload.invariants.cutoverRequiresExplicitApproval, true);
  assert.deepEqual(payload.requiredStagingGates, [
    "health_internal_guard",
    "stream_nonready_exclusion",
    "missing_media_ledger",
    "video_metadata_privacy_and_takedown",
    "update_delete_idempotent_replay",
    "rollback_restore_smoke",
    "production_imported_data_r2_inventory",
    "auth_record_photo_video_map_detail"
  ]);
  assert.ok(payload.routeMatrix.some((route: any) =>
    route.host === "ikimon.life" &&
    route.path === "/cloudflare-shadow/health" &&
    route.postCutoverExpectedStatus === 404
  ));

  const productionResponse = await worker.fetch(new Request("https://shadow.test/shadow-smoke/route-change-rehearsal-proof"), {
    ...env,
    ENVIRONMENT: "production"
  });
  assert.equal(productionResponse.status, 404);
});

test("v1 auth session keeps current optional guest and cookie session contract", async () => {
  const { env, core } = createEnv();

  const requiredGuest = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session"), env);
  assert.equal(requiredGuest.status, 401);
  assert.deepEqual(await requiredGuest.json(), { ok: false, error: "session_not_found" });

  const optionalGuest = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session?optional=1"), env);
  assert.equal(optionalGuest.status, 200);
  assert.deepEqual(await optionalGuest.json(), { ok: false, error: "session_not_found", session: null });

  const issueResponse = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userId: "session-user",
      displayName: "Session User",
      roleName: "Observer",
      rankLabel: "Tester",
      ttlHours: 1
    })
  }), env);
  const issuePayload = await issueResponse.json() as any;
  assert.equal(issueResponse.ok, true, JSON.stringify(issuePayload));
  assert.equal(issuePayload.ok, true);
  assert.equal(issuePayload.session.userId, "session-user");
  assert.equal(issuePayload.session.displayName, "Session User");
  assert.equal(issuePayload.session.roleName, "Observer");
  assert.equal(issuePayload.session.rankLabel, "Tester");
  assert.equal(core.authSessions.size, 1);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";
  assert.match(cookie, /^ikimon_v2_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);

  const sessionResponse = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session", {
    headers: { cookie }
  }), env);
  const sessionPayload = await sessionResponse.json() as any;
  assert.equal(sessionResponse.ok, true, JSON.stringify(sessionPayload));
  assert.equal(sessionPayload.ok, true);
  assert.equal(sessionPayload.session.userId, "session-user");
  assert.equal(sessionPayload.session.tokenHash, issuePayload.tokenHash);

  const logoutResponse = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/logout", {
    method: "POST",
    headers: { cookie }
  }), env);
  const logoutPayload = await logoutResponse.json() as any;
  assert.equal(logoutResponse.ok, true, JSON.stringify(logoutPayload));
  assert.equal(logoutPayload.ok, true);
  assert.equal(logoutPayload.revoked, true);
  assert.equal(core.authSessions.size, 0);
  assert.match(logoutResponse.headers.get("set-cookie") ?? "", /Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
});

test("production occurrence detail edit APIs write to D1 without origin fallback", async () => {
  const { env, obs } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://origin.example.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  obs.observations.set("occ-edit-1", {
    observation_id: "occ-edit-1",
    draft_id: "draft-edit-1",
    owner_user_id: "detail-user",
    observed_at: "2026-06-01T00:00:00.000Z",
    partition_month: "2026-06",
    taxon_label: "テスト種",
    note: null,
    exact_lat: 35.123456,
    exact_lng: 139.123456,
    location_accuracy_m: null,
    public_cell: "35.12,139.12",
    visibility: "public",
    emergency_hidden: 0,
    processing_state: "accepted"
  });
  obs.readmodel.set("occ-edit-1", {
    observation_id: "occ-edit-1",
    public_cell: "35.12,139.12",
    observed_at: "2026-06-01T00:00:00.000Z",
    taxon_label: "テスト種",
    asset_count: 0,
    partition_month: "2026-06"
  });

  const issueResponse = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "detail-user", displayName: "Detail User", ttlHours: 1 })
  }), env);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";

  const originResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/occurrences/occ-edit-1/origin", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ organismOrigin: "wild" })
  }), productionEnv);
  const originPayload = await originResponse.json() as any;
  assert.equal(originResponse.status, 200, JSON.stringify(originPayload));
  assert.equal(originResponse.headers.get("x-ikimon-cloudflare-native"), "occurrence-detail-edit");
  assert.equal(originPayload.organismOrigin, "wild");
  assert.equal(obs.observations.get("occ-edit-1")?.organism_origin, "wild");

  const observedAtResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/occurrences/occ-edit-1/observed-at", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ observedAt: "2026-06-02T03:04:05.000Z" })
  }), productionEnv);
  const observedAtPayload = await observedAtResponse.json() as any;
  assert.equal(observedAtResponse.status, 200, JSON.stringify(observedAtPayload));
  assert.equal(obs.observations.get("occ-edit-1")?.observed_at, "2026-06-02T03:04:05.000Z");
  assert.equal(obs.readmodel.get("occ-edit-1")?.observed_at, "2026-06-02T03:04:05.000Z");

  const locationResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/occurrences/occ-edit-1/location", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ latitude: 35.6543214, longitude: 139.6543214 })
  }), productionEnv);
  const locationPayload = await locationResponse.json() as any;
  assert.equal(locationResponse.status, 200, JSON.stringify(locationPayload));
  assert.equal(locationPayload.label, "35.654321, 139.654321");
  assert.equal(obs.observations.get("occ-edit-1")?.exact_lat, 35.654321);
  assert.equal(obs.readmodel.get("occ-edit-1")?.public_cell, obs.observations.get("occ-edit-1")?.public_cell);

  const fieldResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/occurrences/occ-edit-1/environment-field", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ field: "place_type", value: "urban" })
  }), productionEnv);
  const fieldPayload = await fieldResponse.json() as any;
  assert.equal(fieldResponse.status, 200, JSON.stringify(fieldPayload));
  assert.equal(fieldPayload.label, "市街地");

  const recordResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/occurrences/occ-edit-1/environment-record", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ values: { contact_surface: "plant", human_change: "mowing" } })
  }), productionEnv);
  const recordPayload = await recordResponse.json() as any;
  assert.equal(recordResponse.status, 200, JSON.stringify(recordPayload));
  assert.equal(obs.observationEnvironmentRecords.length, 2);
  const structured = JSON.parse(obs.observationEnvironmentRecords.at(-1)?.structured_json ?? "{}") as Record<string, string>;
  assert.equal(structured.place_type, "urban");
  assert.equal(structured.contact_surface, "plant");
  assert.equal(structured.human_change, "mowing");
  assert.equal(structured.environment_record_location_source, "exact_observation");

  obs.observations.set("occ-edit-public-cell", {
    observation_id: "occ-edit-public-cell",
    draft_id: "draft-edit-public-cell",
    owner_user_id: "detail-user",
    observed_at: "2026-06-01T00:00:00.000Z",
    partition_month: "2026-06",
    taxon_label: "公開セル記録",
    note: null,
    exact_lat: null,
    exact_lng: null,
    location_accuracy_m: null,
    public_cell: "34.440000,137.550000",
    visibility: "public",
    emergency_hidden: 0,
    processing_state: "accepted"
  });
  const fallbackLocationResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/occurrences/occ-edit-public-cell/environment-record", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ values: { place_type: "water_edge" } })
  }), productionEnv);
  const fallbackLocationPayload = await fallbackLocationResponse.json() as any;
  assert.equal(fallbackLocationResponse.status, 200, JSON.stringify(fallbackLocationPayload));
  const fallbackRecord = obs.observationEnvironmentRecords.at(-1);
  assert.equal(fallbackRecord?.lat, 34.44);
  assert.equal(fallbackRecord?.lng, 137.55);
  const fallbackStructured = JSON.parse(fallbackRecord?.structured_json ?? "{}") as Record<string, string>;
  assert.equal(fallbackStructured.environment_record_location_source, "public_cell");
  assert.equal(obs.observationDetailEditEvents.some((row) => row.edit_kind === "location"), true);
  assert.equal([...obs.outbox.values()].some((row) => row.topic === "readmodel.refresh" && row.target_id === "occ-edit-1"), true);
});

test("production occurrence environment edits return a JSON 503 when storage migration is missing", async () => {
  const { env, obs } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://origin.example.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  obs.environmentRecordTablesAvailable = false;
  obs.observations.set("occ-edit-missing-storage", {
    observation_id: "occ-edit-missing-storage",
    draft_id: "draft-edit-missing-storage",
    owner_user_id: "detail-user",
    observed_at: "2026-06-01T00:00:00.000Z",
    partition_month: "2026-06",
    taxon_label: "テスト種",
    note: null,
    exact_lat: 35.123456,
    exact_lng: 139.123456,
    location_accuracy_m: null,
    public_cell: "35.12,139.12",
    visibility: "public",
    emergency_hidden: 0,
    processing_state: "accepted"
  });
  const issueResponse = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "detail-user", displayName: "Detail User", ttlHours: 1 })
  }), env);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";

  const response = await worker.fetch(new Request("https://ikimon.life/api/v1/occurrences/occ-edit-missing-storage/environment-record", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ values: { place_type: "urban" } })
  }), productionEnv);
  const payload = await response.json() as any;
  assert.equal(response.status, 503, JSON.stringify(payload));
  assert.equal(payload.ok, false);
  assert.equal(payload.error, "environment_record_storage_unavailable");
  assert.equal(obs.observationEnvironmentRecords.length, 0);
  assert.equal(obs.observationDetailEditEvents.length, 0);
});

test("native observation upsert persists photo feedback environment draft", async () => {
  const { env, obs, queue } = createEnv();
  const upsertResponse = await post("/api/v1/observations/upsert", env, {
    observationId: "record-auto-env-draft",
    userId: "detail-user",
    observedAt: "2026-06-15T03:00:00.000Z",
    latitude: 34.71234,
    longitude: 137.81234,
    taxon: { vernacularName: "環境下書きテスト", rank: "species" },
    environmentRecordDraft: {
      place_type: { value: "grassland_urban_edge", confidence: 0.61 },
      contact_surface: { value: "soil_gravel_litter", confidence: 0.58 },
      surrounding_cover: { value: "low_grass", confidence: 0.63 },
      human_change: { value: "mowing", confidence: 0.52 },
      environment_condition: { value: "not-allowed", confidence: 0.9 }
    }
  });
  assert.equal(upsertResponse.ok, true, JSON.stringify(upsertResponse));
  assert.equal(obs.observationEnvironmentRecords.length, 1);
  const structured = JSON.parse(obs.observationEnvironmentRecords[0]?.structured_json ?? "{}") as Record<string, string>;
  assert.equal(structured.place_type, "grassland_urban_edge");
  assert.equal(structured.place_type_source, "derived");
  assert.equal(structured.place_type_method, "record_photo_feedback_v1");
  assert.equal(structured.contact_surface, "soil_gravel_litter");
  assert.equal(structured.surrounding_cover, "low_grass");
  assert.equal(structured.human_change, "mowing");
  assert.equal(structured.environment_condition, undefined);
  assert.equal(structured.environment_record_status, "auto_draft");
  assert.equal(obs.observationDetailEditEvents.some((row) => row.edit_kind === "environment-record-auto-draft"), true);

  await post("/api/v1/observations/record-auto-env-draft/photos/upload", env, {
    filename: "detail.jpg",
    mimeType: "image/jpeg",
    base64Data: Buffer.from("auto-env-draft-image").toString("base64")
  });
  await worker.queue({ messages: queue.messages.map((body) => ({ body: body as any })) }, env);
  const uploadedAsset = [...obs.assets.values()].find((asset) => asset.observation_id === "record-auto-env-draft");
  assert.ok(uploadedAsset, "uploaded photo asset should exist");
  const derivativeKey = `derived/import/20260615/observation_photo/${uploadedAsset.asset_id}/display.webp`;
  uploadedAsset.public_derivative_key = derivativeKey;
  uploadedAsset.public_derivative_sha256 = `${uploadedAsset.asset_id}-display-sha`;
  uploadedAsset.public_derivative_verified_at = "2026-06-15T03:05:00.000Z";
  uploadedAsset.public_derivative_metadata_json = "{\"gpsExifPresent\":false,\"contentType\":\"image/webp\",\"scannedContainer\":\"binary\"}";
  uploadedAsset.exif_scrub_state = "scrubbed";
  uploadedAsset.public_ready_at = "2026-06-15T03:05:00.000Z";
  await env.ASSET_BUCKET.put(derivativeKey, "auto-env-draft-webp", {
    httpMetadata: { contentType: "image/webp" }
  });
  const response = await worker.fetch(new Request("https://ikimon.life/observations/record-auto-env-draft"), {
    ...env,
    ENVIRONMENT: "production",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  });
  const body = await response.text();
  assert.equal(response.status, 200, body);
  assert.match(body, /環境情報の下書き/);
  assert.match(body, /自動下書き/);
  assert.match(body, /草地と市街地の縁/);
  assert.match(body, /土・礫・枯れ草/);
  assert.match(body, /低い草地/);
  assert.match(body, /草刈り/);
});

test("production occurrence detail edit APIs reject non owners before mutation", async () => {
  const { env, obs } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://origin.example.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  obs.observations.set("occ-owned-1", {
    observation_id: "occ-owned-1",
    draft_id: "draft-owned-1",
    owner_user_id: "owner-user",
    observed_at: "2026-06-01T00:00:00.000Z",
    partition_month: "2026-06",
    taxon_label: null,
    note: null,
    exact_lat: 35,
    exact_lng: 139,
    location_accuracy_m: null,
    public_cell: "35.00,139.00",
    visibility: "public",
    emergency_hidden: 0,
    processing_state: "accepted"
  });
  const issueResponse = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "other-user", displayName: "Other User", ttlHours: 1 })
  }), env);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";
  const response = await worker.fetch(new Request("https://ikimon.life/api/v1/occurrences/occ-owned-1/origin", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ organismOrigin: "wild" })
  }), productionEnv);
  const payload = await response.json() as any;
  assert.equal(response.status, 403, JSON.stringify(payload));
  assert.equal(payload.error, "forbidden");
  assert.equal(obs.observations.get("occ-owned-1")?.organism_origin, undefined);
  assert.equal(obs.observationDetailEditEvents.length, 0);
});

test("production place management policy API writes to D1 without origin fallback", async () => {
  const { env, obs } = createEnv();
  const productionEnv = { ...env, ENVIRONMENT: "production", ORIGIN_FALLBACK_BASE_URL: "https://origin.example.test" };

  const guest = await worker.fetch(new Request("https://ikimon.life/api/v1/places/place%3Apolicy/management-policy", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ managementGoal: "invasive_watch" })
  }), productionEnv);
  assert.equal(guest.status, 401);
  assert.deepEqual(await guest.json(), { ok: false, error: "login_required" });

  const issueResponse = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userId: "policy-user",
      rawToken: "policy-token",
      displayName: "Policy User",
      expiresAt: "2099-01-01T00:00:00.000Z"
    })
  }), env);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";

  const response = await worker.fetch(new Request("https://ikimon.life/api/v1/places/place%3Apolicy/management-policy", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      managementGoal: "invasive_watch",
      weedTolerance: "high",
      invasiveResponse: "controlled_removal",
      mowingFrequency: "seasonal",
      notes: `  ${"a".repeat(620)}  `
    })
  }), productionEnv);
  const payload = await response.json() as any;
  assert.equal(response.status, 200, JSON.stringify(payload));
  assert.equal(response.headers.get("x-ikimon-cloudflare-native"), "place-management-policy-runtime");
  assert.equal(payload.ok, true);
  assert.equal(payload.policy.placeId, "place:policy");
  assert.equal(payload.policy.userId, "policy-user");
  assert.equal(payload.policy.managementGoal, "invasive_watch");
  assert.equal(payload.policy.weedTolerance, "high");
  assert.equal(payload.policy.invasiveResponse, "controlled_removal");
  assert.equal(payload.policy.mowingFrequency, "seasonal");
  assert.equal(payload.policy.notes.length, 600);

  const stored = obs.placeManagementPolicies.get("place:policy:policy-user");
  assert.equal(stored?.management_goal, "invasive_watch");
  assert.equal(stored?.policy_json, JSON.stringify({ source: "cloudflare_place_management_policy_runtime" }));
});

test("v1 auth login keeps original form contract with Cloudflare-native sessions", async () => {
  const { env, core } = createEnv();
  const passwordHash = await bcrypt.hash("correct-password", 10);
  await env.CORE_DB.prepare(
    `INSERT INTO auth_users
     (user_id, email, password_hash, display_name, role_name, rank_label, banned)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    "login-user",
    "user@example.test",
    passwordHash,
    "Login User",
    "Observer",
    "Tester",
    0
  ).run();

  const loginResponse = await worker.fetch(new Request("https://shadow.test/api/v1/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://shadow.test",
      "sec-fetch-site": "same-origin"
    },
    body: JSON.stringify({
      email: " USER@example.test ",
      password: "correct-password",
      redirect: "/record?draft=1"
    })
  }), env);
  const loginPayload = await loginResponse.json() as any;
  assert.equal(loginResponse.ok, true, JSON.stringify(loginPayload));
  assert.equal(loginPayload.ok, true);
  assert.equal(loginPayload.redirect, "/record?draft=1");
  assert.equal(loginPayload.session.userId, "login-user");
  assert.equal(loginPayload.session.displayName, "Login User");
  assert.equal(loginPayload.session.roleName, "Observer");
  assert.equal(loginPayload.session.rankLabel, "Tester");
  assert.equal(core.authSessions.size, 1);
  assert.equal(core.authUsers.get("user@example.test")?.last_login_at !== null, true);
  const cookie = loginResponse.headers.get("set-cookie") ?? "";
  assert.match(cookie, /^ikimon_v2_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);

  const sessionResponse = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session", {
    headers: { cookie }
  }), env);
  const sessionPayload = await sessionResponse.json() as any;
  assert.equal(sessionResponse.ok, true, JSON.stringify(sessionPayload));
  assert.equal(sessionPayload.ok, true);
  assert.equal(sessionPayload.session.userId, "login-user");
  assert.equal(sessionPayload.session.tokenHash, loginPayload.session.tokenHash);

  const bareRecordLoginResponse = await worker.fetch(new Request("https://shadow.test/api/v1/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://shadow.test",
      "sec-fetch-site": "same-origin"
    },
    body: JSON.stringify({
      email: "user@example.test",
      password: "correct-password",
      redirect: "/record"
    })
  }), env);
  const bareRecordLoginPayload = await bareRecordLoginResponse.json() as any;
  assert.equal(bareRecordLoginResponse.ok, true, JSON.stringify(bareRecordLoginPayload));
  assert.equal(bareRecordLoginPayload.redirect, "/record?start=photo");

  const invalidResponse = await worker.fetch(new Request("https://shadow.test/api/v1/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://shadow.test"
    },
    body: JSON.stringify({
      email: "user@example.test",
      password: "wrong-password"
    })
  }), env);
  assert.equal(invalidResponse.status, 401);
  assert.deepEqual(await invalidResponse.json(), { ok: false, error: "invalid_credentials" });

  const crossOriginResponse = await worker.fetch(new Request("https://shadow.test/api/v1/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://evil.example",
      "sec-fetch-site": "cross-site"
    },
    body: JSON.stringify({
      email: "user@example.test",
      password: "correct-password"
    })
  }), env);
  assert.equal(crossOriginResponse.status, 403);
  assert.deepEqual(await crossOriginResponse.json(), { ok: false, error: "same_origin_required" });
});

test("v1 auth login accepts legacy php bcrypt 2y hashes", async () => {
  const { env } = createEnv();
  const passwordHash = (await bcrypt.hash("legacy-password", 10)).replace("$2b$", "$2y$");
  await env.CORE_DB.prepare(
    `INSERT INTO auth_users
     (user_id, email, password_hash, display_name, role_name, rank_label, banned)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    "legacy-user",
    "legacy@example.test",
    passwordHash,
    "Legacy User",
    "Observer",
    null,
    0
  ).run();

  const loginResponse = await worker.fetch(new Request("https://shadow.test/api/v1/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://shadow.test"
    },
    body: JSON.stringify({
      email: "legacy@example.test",
      password: "legacy-password",
      redirect: "https://evil.example/"
    })
  }), env);
  const loginPayload = await loginResponse.json() as any;
  assert.equal(loginResponse.ok, true, JSON.stringify(loginPayload));
  assert.equal(loginPayload.ok, true);
  assert.equal(loginPayload.redirect, "/record?start=photo");
  assert.equal(loginPayload.session.userId, "legacy-user");
  assert.equal(loginPayload.session.rankLabel, "観察者");
});

test("production contact/profile/remember/data-rights writes stay Cloudflare-native", async () => {
  const { env, core, obs } = createEnv();
  const email = new FakeEmail();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    PUBLIC_WRITE_MODE: "cloudflare_native",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    V2_PRIVILEGED_WRITE_API_KEY: "write-key",
    CONTACT_FORM_SECRET: "contact-secret",
    ALERT_EMAIL: email,
    CONTACT_ADMIN_TO: "ops@example.test"
  };
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const badContact = await worker.fetch(new Request("https://ikimon.life/api/v1/contact/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category: "question", message: "hello", contactProof: "bad" })
    }), productionEnv);
    assert.equal(badContact.status, 400);
    assert.equal(core.contactSubmissions.size, 0);

    const validContactProof = contactProof("contact-secret");
    const contactResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/contact/submit", {
      method: "POST",
      headers: { "content-type": "application/json", referer: "https://ikimon.life/contact", "cf-connecting-ip": "203.0.113.10" },
      body: JSON.stringify({
        category: "question",
        name: "Contact User",
        email: "contact@example.test",
        message: "D1 contact message",
        userId: "spoofed-user",
        contactProof: validContactProof
      })
    }), productionEnv);
    const contactPayload = await contactResponse.json() as any;
    assert.equal(contactResponse.ok, true, JSON.stringify(contactPayload));
    assert.equal(core.contactSubmissions.size, 1);
    assert.equal(email.messages.length, 2);
    const contactRow = [...core.contactSubmissions.values()][0];
    assert.equal(contactRow?.notification_sent, 1);
    assert.equal(contactRow?.user_id, null);
    assert.match(contactRow?.ip_hash ?? "", /^[a-f0-9]{64}$/);
    assert.equal((contactRow?.ip_hash ?? "").includes("203.0.113.10"), false);

    const replayResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/contact/submit", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.10" },
      body: JSON.stringify({
        category: "question",
        email: "contact2@example.test",
        message: "replayed contact message",
        contactProof: validContactProof
      })
    }), productionEnv);
    assert.equal(replayResponse.status, 400);

    for (let i = 0; i < 5; i += 1) {
      core.contactSubmissions.set(`seed-contact-${i}`, {
        submission_id: `seed-contact-${i}`,
        category: "question",
        name: null,
        email: `seed-${i}@example.test`,
        organization: null,
        message: "seed",
        ip_hash: contactRow?.ip_hash ?? null,
        user_id: null,
        notification_sent: 0,
        auto_reply_sent: 0,
        send_error: null,
        created_at: new Date().toISOString()
      });
    }
    const rateLimitedContact = await worker.fetch(new Request("https://ikimon.life/api/v1/contact/submit", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.10" },
      body: JSON.stringify({
        category: "question",
        email: "rate@example.test",
        message: "rate limited contact message",
        contactProof: contactProof("contact-secret", Date.now() - 3000, "rate-nonce")
      })
    }), productionEnv);
    assert.equal(rateLimitedContact.status, 429);

    const unauthorizedUpsert = await worker.fetch(new Request("https://ikimon.life/api/v1/users/upsert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "profile-user" })
    }), productionEnv);
    assert.equal(unauthorizedUpsert.status, 403);

    core.authUsers.set("profile@example.test", {
      user_id: "profile-user",
      email: "profile@example.test",
      password_hash: null,
      display_name: "Profile User",
      role_name: "admin",
      rank_label: "管理者",
      banned: 0,
      last_login_at: null
    } as AuthUserRow);
    const upsertResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/users/upsert", {
      method: "POST",
      headers: { "content-type": "application/json", "x-ikimon-write-key": "write-key" },
      body: JSON.stringify({
        userId: "profile-user",
        email: "profile@example.test",
        displayName: "Updated Admin",
        roleName: "Observer",
        rankLabel: "観察者"
      })
    }), productionEnv);
    const upsertPayload = await upsertResponse.json() as any;
    assert.equal(upsertResponse.ok, true, JSON.stringify(upsertPayload));
    assert.equal(upsertPayload.roleName, "admin");
    assert.equal(core.authUsers.get("profile@example.test")?.rank_label, "管理者");

    const rawSessionToken = "profile-session-token";
    const sessionHash = createHash("sha256").update(rawSessionToken).digest("hex");
    core.authSessions.set(sessionHash, {
      token_hash: sessionHash,
      user_id: "profile-user",
      display_name: "Profile User",
      role_name: "admin",
      rank_label: "管理者",
      banned: 0,
      expires_at: "2026-07-01T00:00:00.000Z",
      last_used_at: null
    });
    const cookie = `ikimon_v2_session=${rawSessionToken}`;
    const profileResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/profile/me", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        displayName: "Field Name",
        profileBio: "local guide",
        expertise: "plants",
        avatar: {
          mimeType: "image/png",
          base64Data: tinyPngBase64()
        }
      })
    }), productionEnv);
    const profilePayload = await profileResponse.json() as any;
    assert.equal(profileResponse.ok, true, JSON.stringify(profilePayload));
    assert.equal(core.userProfiles.get("profile-user")?.profile_bio, "local guide");
    assert.equal(core.profileWriteAudit.length, 1);
    assert.equal((productionEnv.ASSET_BUCKET as FakeBucket).objects.size, 1);
    const unsafeAvatarResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/profile/me", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        displayName: "Field Name",
        avatar: {
          mimeType: "image/jpeg",
          base64Data: Buffer.from("not-a-sanitized-avatar").toString("base64")
        }
      })
    }), productionEnv);
    assert.equal(unsafeAvatarResponse.status, 400);
    const malformedPngResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/profile/me", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        displayName: "Field Name",
        avatar: {
          mimeType: "image/png",
          base64Data: malformedPngBase64()
        }
      })
    }), productionEnv);
    assert.equal(malformedPngResponse.status, 400);

    const rawToken = "remember-token-secret-with-enough-entropy-123";
    const rememberResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/auth/remember-tokens/issue", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer write-key" },
      body: JSON.stringify({ userId: "profile-user", rawToken, expiresAt: "2026-07-01T00:00:00.000Z" })
    }), productionEnv);
    const rememberPayload = await rememberResponse.json() as any;
    assert.equal(rememberResponse.ok, true, JSON.stringify(rememberPayload));
    assert.equal(core.rememberTokens.has(rawToken), false);
    assert.equal(core.rememberTokens.has(createHash("sha256").update(rawToken).digest("hex")), true);

    const revokeResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/auth/remember-tokens/revoke", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "write-key" },
      body: JSON.stringify({ token: rawToken })
    }), productionEnv);
    assert.equal(revokeResponse.ok, true);
    assert.equal(core.rememberTokens.size, 0);

    const observationResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/upsert", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        observationId: "obs-rights-1",
        userId: "profile-user",
        observedAt: "2026-06-27T00:00:00.000Z",
        latitude: 34.98,
        longitude: 138.38,
        note: "rights test",
        taxon: { vernacularName: "テスト植物" },
        dataRights: {
          recordConsent: "external_export",
          researchUseConsent: "public_export",
          enterpriseReportConsent: "aggregated",
          datasetLicense: "CC-BY-4.0",
          mediaLicense: "CC-BY-NC-4.0",
          externalExportAllowed: true,
          withdrawalStatus: "active"
        }
      })
    }), productionEnv);
    const observationPayload = await observationResponse.json() as any;
    assert.equal(observationResponse.ok, true, JSON.stringify(observationPayload));
    assert.equal(obs.observationDataRights.get("obs-rights-1")?.external_export_allowed, 1);
    assert.equal(obs.observationDataRights.get("obs-rights-1")?.record_consent, "external_export");
    const reservedRightsResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/upsert", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        observationId: "obs-rights-reserved",
        userId: "profile-user",
        observedAt: "2026-06-27T00:00:00.000Z",
        latitude: 34.98,
        longitude: 138.38,
        dataRights: {
          recordConsent: "external_export",
          researchUseConsent: "public_export",
          datasetLicense: "CC-BY-4.0",
          mediaLicense: "all_rights_reserved",
          externalExportAllowed: true,
          withdrawalStatus: "active"
        }
      })
    }), productionEnv);
    assert.equal(reservedRightsResponse.ok, true);
    assert.equal(obs.observationDataRights.get("obs-rights-reserved")?.external_export_allowed, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(fetchCalls, 0);
});

test("production auth login rejects D1 misses without origin fallback", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    PUBLIC_WRITE_MODE: "cloudflare_native",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const body = {
      email: "not-yet-imported@example.test",
      password: "origin-password",
      redirect: "/record"
    };
    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://ikimon.life",
        "sec-fetch-site": "same-origin"
      },
      body: JSON.stringify(body)
    }), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.status, 401);
    assert.deepEqual(payload, { ok: false, error: "invalid_credentials" });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(fetchCalls, 0);
  assert.equal(core.operationAudit.length, 1);
  assert.equal(core.operationAudit[0]?.operation_type, "auth_login_failed");
  assert.equal(core.operationAudit[0]?.target_id, "auth_login_user_missing");
  const telemetry = JSON.parse(core.operationAudit[0]?.payload_json ?? "{}");
  assert.equal(telemetry.reason, "auth_login_user_missing");
  assert.equal(telemetry.routePattern, "/api/v1/auth/login");
  assert.equal(JSON.stringify(telemetry).includes("not-yet-imported@example.test"), false);
});

test("production auth login fails closed when the D1 auth user store is unavailable", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    PUBLIC_WRITE_MODE: "cloudflare_native",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const brokenCore = {
    prepare(query: string) {
      if (normalize(query).startsWith("SELECT user_id, email, password_hash, display_name, role_name, rank_label, banned FROM auth_users")) {
        throw new Error("simulated auth store unavailable");
      }
      return core.prepare(query);
    },
    batch(statements: FakeStatement[]) {
      return core.batch(statements);
    }
  };
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://ikimon.life",
        "sec-fetch-site": "same-origin"
      },
      body: JSON.stringify({
        email: "user@example.test",
        password: "password"
      })
    }), { ...productionEnv, CORE_DB: brokenCore });
    const payload = await response.json() as any;
    assert.equal(response.status, 503);
    assert.deepEqual(payload, { ok: false, error: "auth_store_unavailable" });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(fetchCalls, 0);
  assert.equal(core.operationAudit.length, 1);
  assert.equal(core.operationAudit[0]?.operation_type, "auth_login_failed");
  assert.equal(core.operationAudit[0]?.target_id, "auth_login_store_unavailable");
  const telemetry = JSON.parse(core.operationAudit[0]?.payload_json ?? "{}");
  assert.equal(telemetry.reason, "auth_login_store_unavailable");
  assert.equal(telemetry.routePattern, "/api/v1/auth/login");
});

test("production personal runtime returns native guest auth boundary without origin fallback", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const checks: Array<{ path: string; init?: RequestInit }> = [
      { path: "/api/v1/me/alerts" },
      { path: "/api/v1/me/alerts/read", init: { method: "POST", headers: { "content-type": "application/json" }, body: "{}" } },
      { path: "/api/v1/me/subscriptions" },
      { path: "/api/v1/me/subscriptions", init: { method: "POST", headers: { "content-type": "application/json" }, body: "{}" } },
      { path: "/api/v1/me/area-subscriptions" },
      { path: "/api/v1/me/personalized-menu?limit=8" }
    ];
    for (const check of checks) {
      const response = await worker.fetch(new Request(`https://ikimon.life${check.path}`, check.init), productionEnv);
      const payload = await response.json() as any;
      assert.equal(response.status, 401, check.path);
      assert.deepEqual(payload, { ok: false, error: "auth_required" }, check.path);
    }
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);

    const observationsBase = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/"), productionEnv);
    assert.equal(observationsBase.status, 404);
    assert.deepEqual(await observationsBase.json(), { ok: false, error: "not_found" });
    assert.equal(fallbackCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production personal runtime serves signed-in data from Cloudflare D1 without origin fallback", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  const rawToken = "signed-in-cloudflare-token";
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  core.authSessions.set(tokenHash, {
    token_hash: tokenHash,
    user_id: "personal-user",
    display_name: "Personal User",
    role_name: "Observer",
    rank_label: null,
    banned: 0,
    expires_at: "2099-01-01T00:00:00.000Z",
    last_used_at: null
  });
  core.areaSubscriptions.set("area-sub-1", {
    subscription_id: "area-sub-1",
    user_id: "personal-user",
    target_type: "field",
    target_id: "field-1",
    label: "東金の観察地",
    href: "/map?field=field-1",
    is_active: 1,
    created_at: "2026-06-15T00:00:00.000Z",
    updated_at: "2026-06-16T00:00:00.000Z"
  });
  core.areaSubscriptionStats.set("personal-user:field:field-1", {
    user_id: "personal-user",
    target_type: "field",
    target_id: "field-1",
    observation_count: 12,
    needs_id_count: 3
  });
  core.taxonAlertSubscriptions.set("taxon-sub-1", {
    subscription_id: "taxon-sub-1",
    user_id: "personal-user",
    scientific_name: "Pica serica",
    taxon_rank: "species",
    match_field: "scientific_name",
    trigger_invasive_only: 0,
    trigger_rare_only: 1,
    channel: "email",
    label: "カササギ",
    is_active: 1,
    created_at: "2026-06-17T00:00:00.000Z"
  });
  core.alertDeliveries.set("alert-1", {
    delivery_id: "alert-1",
    occurrence_id: "occ-1",
    user_id: "personal-user",
    trigger_kind: "area_watch",
    channel: "none",
    delivered_at: null,
    delivery_status: "sent",
    payload_json: JSON.stringify({ title: "新しい記録", href: "/observations/occ-1" }),
    acknowledged_at: null,
    created_at: "2026-06-16T00:00:00.000Z"
  });
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/me/alerts", {
      headers: { cookie: `ikimon_v2_session=${rawToken}` }
    }), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.ok, true, JSON.stringify(payload));
    assert.equal(payload.alerts[0].deliveryId, "alert-1");
    assert.equal(payload.alerts[0].payload.title, "新しい記録");

    const menuResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/me/personalized-menu?limit=8", {
      headers: { cookie: `ikimon_v2_session=${rawToken}` }
    }), productionEnv);
    const menuPayload = await menuResponse.json() as any;
    assert.equal(menuResponse.ok, true, JSON.stringify(menuPayload));
    assert.equal(menuPayload.items[0].label, "東金の観察地");
    assert.equal(menuPayload.items[0].stats.observationCount, 12);
    assert.equal(menuPayload.summary.unreadAlertCount, 1);

    const areaResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/me/area-subscriptions", {
      headers: { cookie: `ikimon_v2_session=${rawToken}` }
    }), productionEnv);
    const areaPayload = await areaResponse.json() as any;
    assert.equal(areaResponse.ok, true, JSON.stringify(areaPayload));
    assert.equal(areaPayload.subscriptions[0].subscriptionId, "area-sub-1");

    const taxonResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/me/subscriptions", {
      headers: { cookie: `ikimon_v2_session=${rawToken}` }
    }), productionEnv);
    const taxonPayload = await taxonResponse.json() as any;
    assert.equal(taxonResponse.ok, true, JSON.stringify(taxonPayload));
    assert.equal(taxonPayload.subscriptions[0].subscriptionId, "taxon-sub-1");
    assert.equal(taxonPayload.subscriptions[0].triggerRareOnly, true);

    const createTaxonResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/me/subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `ikimon_v2_session=${rawToken}` },
      body: JSON.stringify({
        scientificName: "Haliaeetus albicilla",
        taxonRank: "species",
        matchField: "scientific_name",
        triggerRareOnly: true,
        label: "オジロワシ"
      })
    }), productionEnv);
    const createTaxonPayload = await createTaxonResponse.json() as any;
    assert.equal(createTaxonResponse.ok, true, JSON.stringify(createTaxonPayload));
    assert.equal(core.taxonAlertSubscriptions.get(createTaxonPayload.subscriptionId)?.label, "オジロワシ");

    const deleteTaxonResponse = await worker.fetch(new Request(`https://ikimon.life/api/v1/me/subscriptions/${createTaxonPayload.subscriptionId}`, {
      method: "DELETE",
      headers: { cookie: `ikimon_v2_session=${rawToken}` }
    }), productionEnv);
    assert.equal(deleteTaxonResponse.ok, true, await deleteTaxonResponse.text());
    assert.equal(core.taxonAlertSubscriptions.has(createTaxonPayload.subscriptionId), false);

    const readResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/me/alerts/read", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `ikimon_v2_session=${rawToken}` },
      body: JSON.stringify({ ids: ["alert-1"] })
    }), productionEnv);
    assert.equal(readResponse.ok, true, await readResponse.text());
    assert.equal(core.alertDeliveries.get("alert-1")?.delivery_status, "acknowledged");
    assert.equal(core.alertDeliveries.get("alert-1")?.acknowledged_at !== null, true);
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production guide outcome runtime uses Cloudflare D1 without origin fallback", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  const rawToken = "signed-in-guide-token";
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  core.authSessions.set(tokenHash, {
    token_hash: tokenHash,
    user_id: "guide-user",
    display_name: "Guide User",
    role_name: "Observer",
    rank_label: null,
    banned: 0,
    expires_at: "2099-01-01T00:00:00.000Z",
    last_used_at: null
  });
  env.OBS_DB.guidePrograms.set("hamamatsu-program", {
    program_id: "hamamatsu-program",
    slug: "hamamatsu-program",
    title: "浜松の現地ガイド",
    owner_type: "municipality",
    participation_mode: "any_order",
    status: "published",
    starts_at: null,
    ends_at: null,
    public_summary: "公開情報をもとにした現地ガイド企画",
    safety_policy_json: "{}",
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-20T00:00:00.000Z"
  });
  env.OBS_DB.guideProgramSpots.set("hamamatsu-program:hamamatsu-shijimizuka-site", {
    program_id: "hamamatsu-program",
    guide_spot_id: "hamamatsu-shijimizuka-site",
    sort_order: 10,
    required_for_completion: 1,
    created_at: "2026-06-01T00:00:00.000Z"
  });
  env.OBS_DB.guideUnlocks.set("guide-user:hamamatsu-shijimizuka-site", {
    user_id: "guide-user",
    guide_spot_id: "hamamatsu-shijimizuka-site",
    program_id: "hamamatsu-program",
    distance_band: "same_place",
    first_unlocked_at: "2026-06-20T00:00:00.000Z",
    last_unlocked_at: "2026-06-21T00:00:00.000Z",
    last_listened_at: null
  });
  env.OBS_DB.guideEnvironmentMeshCells.set("mesh-1", {
    mesh_key: "mesh-1",
    center_lat: 34.7133,
    center_lng: 137.7031,
    guide_record_count: 3,
    contributor_count: 2,
    vegetation_counts_json: "{\"草地\":2}",
    landform_counts_json: "{\"貝塚\":1}",
    structure_counts_json: "{\"公園\":2}",
    sound_counts_json: "{}",
    first_seen_at: "2026-06-20T00:00:00.000Z",
    last_seen_at: "2026-06-22T00:00:00.000Z"
  });
  env.OBS_DB.regionalHypotheses.set("hyp-1", {
    hypothesis_id: "hyp-1",
    mesh_key: "mesh-1",
    place_id: null,
    claim_type: "sampling_gap",
    hypothesis_text: "反復記録を増やすと、季節差を確認しやすい。",
    what_we_can_say: "現時点では次に記録する軸を示す材料。",
    supporting_observation_ids_json: "[]",
    supporting_guide_record_ids_json: "[\"guide-record-1\"]",
    supporting_knowledge_card_ids_json: "[]",
    supporting_claim_ids_json: "[]",
    evidence_json: "{\"guideRecordCount\":3}",
    confidence: 0.51,
    bias_warnings_json: "[\"small_sample\"]",
    missing_data_json: "[\"repeat_visits\"]",
    next_sampling_protocol: "同じ範囲で日時を変えて記録する。",
    source_fingerprint: "regional-hypothesis:mesh-1",
    review_status: "auto",
    generated_at: "2026-06-22T00:00:00.000Z"
  });
  await env.OBS_DB.prepare(
    `INSERT INTO observation_event_sessions (
       session_id, legacy_event_id, event_code, title, organizer_user_id, corporation_id,
       plan, primary_mode, active_modes_json, location_lat, location_lng, location_radius_m,
       started_at, ended_at, target_species_json, config_json, field_id, template_source_session_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    "guide-event-session-1",
    null,
    "guide-event-code",
    "Guide event",
    "guide-user",
    null,
    "community",
    "discovery",
    JSON.stringify(["discovery"]),
    34.7133,
    137.7031,
    1000,
    "2026-06-22T09:00:00.000Z",
    null,
    JSON.stringify([]),
    JSON.stringify({ source: "guide-runtime-test" }),
    null,
    null
  ).run();
  await env.OBS_DB.prepare(
    `INSERT INTO observation_event_teams (
       team_id, session_id, name, color, lead_user_id, target_taxa_json
     ) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind("guide-team-1", "guide-event-session-1", "Guide team", "#0f766e", "guide-user", JSON.stringify([])).run();
  await env.OBS_DB.prepare(
    `INSERT INTO observation_event_participants (
       participant_id, session_id, user_id, guest_token, display_name, team_id, role, status,
       checked_in_at, share_location, is_minor, location_share_until, location_share_consent_type
     ) VALUES (?, ?, ?, ?, ?, ?, 'participant', 'checked_in', CURRENT_TIMESTAMP, ?, ?, ?, ?)`
  ).bind("guide-participant-1", "guide-event-session-1", "guide-user", null, "Guide User", "guide-team-1", 1, 0, null, "signed_in").run();

  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const guest = await worker.fetch(new Request("https://ikimon.life/api/v1/guides/unlocks"), productionEnv);
    assert.equal(guest.status, 401);
    assert.equal(fallbackCalls, 0);

    const unlocks = await worker.fetch(new Request("https://ikimon.life/api/v1/guides/unlocks", {
      headers: { cookie: `ikimon_v2_session=${rawToken}` }
    }), productionEnv);
    assert.equal(unlocks.headers.get("x-ikimon-cloudflare-native"), "guide-unlocks-api");
    const unlockPayload = await unlocks.json() as any;
    assert.equal(unlocks.ok, true, JSON.stringify(unlockPayload));
    assert.equal(unlockPayload.unlocks[0].guideSpotId, "hamamatsu-shijimizuka-site");
    assert.equal(unlockPayload.unlocks[0].programTitle, "浜松の現地ガイド");

    const listened = await worker.fetch(new Request("https://ikimon.life/api/v1/guides/unlocks/hamamatsu-shijimizuka-site/listened", {
      method: "POST",
      headers: { cookie: `ikimon_v2_session=${rawToken}` }
    }), productionEnv);
    assert.equal(listened.ok, true);
    assert.equal(env.OBS_DB.guideUnlocks.get("guide-user:hamamatsu-shijimizuka-site")?.last_listened_at !== null, true);

    const interaction = await worker.fetch(new Request("https://ikimon.life/api/v1/guide/interaction", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `ikimon_v2_session=${rawToken}` },
      body: JSON.stringify({ hypothesisId: "hyp-1", interactionType: "helpful", sessionId: "guide-session-1" })
    }), productionEnv);
    const interactionPayload = await interaction.json() as any;
    assert.equal(interaction.ok, true, JSON.stringify(interactionPayload));
    assert.equal(env.OBS_DB.guideInteractions.size, 1);
    assert.equal([...env.OBS_DB.guideInteractions.values()][0]?.user_id, "guide-user");

    const guideRecord = await worker.fetch(new Request("https://ikimon.life/api/v1/guide/record", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `ikimon_v2_session=${rawToken}` },
      body: JSON.stringify({
        sessionId: "guide-session-1",
        lat: 34.7133,
        lng: 137.7031,
        eventCode: "guide-event-code",
        teamId: "guide-team-1",
        participantRole: "guide",
        capturedAt: "2026-06-22T09:10:00.000Z",
        sceneSummary: "草地の縁で小さな花が目立つ",
        detectedSpecies: ["シロツメクサ"],
        detectedFeatures: [{ type: "vegetation", name: "草地" }],
        primarySubject: { name: "シロツメクサ", rank: "species", confidence: 0.7 }
      })
    }), productionEnv);
    const guideRecordPayload = await guideRecord.json() as any;
    assert.equal(guideRecord.headers.get("x-ikimon-cloudflare-native"), "guide-record-api");
    assert.equal(guideRecord.ok, true, JSON.stringify(guideRecordPayload));
    assert.equal(env.OBS_DB.guideRecords.size, 1);
    assert.equal(env.OBS_DB.guideSessionPublicSummaries.size, 1);
    const firstGuideSceneEvent = env.OBS_DB.observationEventLiveEvents.find((event) => event.type === "guide_scene_added");
    assert.ok(firstGuideSceneEvent);
    assert.equal(firstGuideSceneEvent?.session_id, "guide-event-session-1");
    assert.equal(firstGuideSceneEvent?.team_id, "guide-team-1");
    const firstGuideScenePayload = JSON.parse(firstGuideSceneEvent?.payload_json ?? "{}") as Record<string, unknown>;
    assert.equal(firstGuideScenePayload.guide_record_id, guideRecordPayload.guideRecordId);
    assert.equal(firstGuideScenePayload.exact_location_stored, false);

    const secondGuideRecord = await worker.fetch(new Request("https://ikimon.life/api/v1/guide/record", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `ikimon_v2_session=${rawToken}` },
      body: JSON.stringify({
        sessionId: "guide-session-1",
        lat: 34.7136,
        lng: 137.7035,
        capturedAt: "2026-06-22T09:12:00.000Z",
        sceneSummary: "同じ草地で別の花も見える",
        detectedSpecies: ["カタバミ"],
        detectedFeatures: [{ type: "vegetation", name: "草地" }],
        primarySubject: { name: "カタバミ", rank: "species", confidence: 0.68 }
      })
    }), productionEnv);
    const secondGuideRecordPayload = await secondGuideRecord.json() as any;
    assert.equal(secondGuideRecord.ok, true, JSON.stringify(secondGuideRecordPayload));
    assert.equal(env.OBS_DB.guideRecords.size, 2);
    assert.equal(env.OBS_DB.guideSessionPublicSummaries.get("guide-user:guide-session-1")?.record_count, 2);

    const promotion = await worker.fetch(new Request(`https://ikimon.life/api/v1/guide/records/${encodeURIComponent(guideRecordPayload.guideRecordId)}/promote`, {
      method: "POST",
      headers: { cookie: `ikimon_v2_session=${rawToken}` }
    }), productionEnv);
    const promotionPayload = await promotion.json() as any;
    assert.equal(promotion.status, 202, JSON.stringify(promotionPayload));
    assert.equal(promotion.headers.get("x-ikimon-cloudflare-native"), "guide-record-promotion-api");
    assert.equal(promotionPayload.compatibility.source, "cloudflare_guide_record_promotion_request_ledger");
    assert.equal(env.OBS_DB.guideRecordPromotionRequests.get(`${guideRecordPayload.guideRecordId}:guide-user`)?.request_state, "pending");

    const telemetry = await worker.fetch(new Request("https://ikimon.life/api/v1/guide/telemetry", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `ikimon_v2_session=${rawToken}` },
      body: JSON.stringify({
        sessionId: "guide-session-1",
        guideMode: "vehicle",
        points: [
          { clientPointId: "p-1", lat: 34.7134, lng: 137.7032, observedAt: "2026-06-22T09:11:00.000Z", speedMps: 4.5 }
        ]
      })
    }), productionEnv);
    const telemetryPayload = await telemetry.json() as any;
    assert.equal(telemetry.headers.get("x-ikimon-cloudflare-native"), "guide-telemetry-api");
    assert.equal(telemetryPayload.inserted, 1);
    assert.equal(env.OBS_DB.guideRoutePoints.size, 1);

    const guideScene = await worker.fetch(new Request("https://ikimon.life/api/v1/guide/scene", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `ikimon_v2_session=${rawToken}` },
      body: JSON.stringify({
        clientSceneId: "static-scene-1",
        sessionId: "guide-session-1",
        lat: 34.7138,
        lng: 137.7036,
        eventCode: "guide-event-code",
        teamId: "guide-team-1",
        participantRole: "guide",
        capturedAt: "2026-06-22T09:14:00.000Z",
        frame: "ZmFrZS1mcmFtZQ==",
        frameThumb: "data:image/jpeg;base64,thumb",
        sceneSummary: "水路沿いに草本と湿った土が見える",
        detectedFeatures: [{ type: "vegetation", name: "水路沿いの草本", confidence: 0.52 }],
        visualCandidate: { reason: "水路と草本の境界" }
      })
    }), productionEnv);
    const guideScenePayload = await guideScene.json() as any;
    assert.equal(guideScene.status, 202, JSON.stringify(guideScenePayload));
    assert.equal(guideScene.headers.get("x-ikimon-cloudflare-native"), "guide-scene-static-runtime");
    assert.equal(guideScenePayload.sceneId, "static-scene-1");
    assert.equal(guideScenePayload.status, "ready");
    assert.equal(guideScenePayload.autoSave.state, "saved");
    assert.equal(guideScenePayload.visualExtractModel, "cloudflare_worker_static");
    assert.equal(env.OBS_DB.guideRecords.size, 3);
    assert.equal(env.OBS_DB.guideRoutePoints.size, 2);
    assert.equal(env.OBS_DB.observationEventLiveEvents.filter((event) => event.type === "guide_scene_added").length, 2);

    const guideSceneGet = await worker.fetch(new Request("https://ikimon.life/api/v1/guide/scene/static-scene-1?currentLat=34.7138&currentLng=137.7036"), productionEnv);
    const guideSceneGetPayload = await guideSceneGet.json() as any;
    assert.equal(guideSceneGet.headers.get("x-ikimon-cloudflare-native"), "guide-scene-static-runtime");
    assert.equal(guideSceneGetPayload.sceneId, "static-scene-1");
    assert.equal(guideSceneGetPayload.distanceFromCurrentM, 0);

    const guideSceneEvents = await worker.fetch(new Request("https://ikimon.life/api/v1/guide/scene/static-scene-1/events"), productionEnv);
    assert.equal(guideSceneEvents.headers.get("x-ikimon-cloudflare-native"), "guide-scene-static-runtime");
    assert.match(await guideSceneEvents.text(), /event: ready/);

    const mobileStart = await worker.fetch(new Request("https://ikimon.life/api/v1/mobile/field-sessions/start", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `ikimon_v2_session=${rawToken}` },
      body: JSON.stringify({ session_id: "mobile-session-1" })
    }), productionEnv);
    const mobileStartPayload = await mobileStart.json() as any;
    assert.equal(mobileStartPayload.sessionId, "mobile-session-1");

    const mobileDigest = await worker.fetch(new Request("https://ikimon.life/api/v1/mobile/field-sessions/mobile-session-1/scene-digest", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `ikimon_v2_session=${rawToken}` },
      body: JSON.stringify({
        install_id: "install-1",
        client_scene_id: "scene-1",
        lat: 34.7135,
        lng: 137.7033,
        eventCode: "guide-event-code",
        teamId: "guide-team-1",
        movement_mode: "vehicle",
        scene_digest: "道路沿いの樹木と草地が続く",
        detected_species: ["樹木"],
        area_resolution_signals: ["道路沿い", "草地"]
      })
    }), productionEnv);
    const mobileDigestPayload = await mobileDigest.json() as any;
    assert.equal(mobileDigest.headers.get("x-ikimon-cloudflare-native"), "mobile-scene-digest-api");
    assert.equal(mobileDigestPayload.duplicate, false);
    assert.equal(env.OBS_DB.mobileFieldSceneReceipts.size, 1);
    assert.equal(env.OBS_DB.observationEventLiveEvents.filter((event) => event.type === "guide_scene_added").length, 3);

    const mobileDuplicate = await worker.fetch(new Request("https://ikimon.life/api/v1/mobile/field-sessions/mobile-session-1/scene-digest", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `ikimon_v2_session=${rawToken}` },
      body: JSON.stringify({
        install_id: "install-1",
        client_scene_id: "scene-1",
        lat: 34.7135,
        lng: 137.7033,
        scene_digest: "道路沿いの樹木と草地が続く"
      })
    }), productionEnv);
    const mobileDuplicatePayload = await mobileDuplicate.json() as any;
    assert.equal(mobileDuplicatePayload.duplicate, true);

    const mobileAudio = await worker.fetch(new Request("https://ikimon.life/api/v1/mobile/field-sessions/mobile-session-1/audio-events", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `ikimon_v2_session=${rawToken}` },
      body: JSON.stringify({
        eventCode: "guide-event-code",
        teamId: "guide-team-1",
        events: [
          { segmentId: "audio-segment-1", lat: 34.7137, lng: 137.7034, recordedAt: "2026-06-22T09:13:00.000Z", durationSec: 8 }
        ]
      })
    }), productionEnv);
    const mobileAudioPayload = await mobileAudio.json() as any;
    assert.equal(mobileAudio.headers.get("x-ikimon-cloudflare-native"), "mobile-audio-events-api");
    assert.equal(mobileAudioPayload.liveEventCount, 1);
    const fieldScanEvent = env.OBS_DB.observationEventLiveEvents.find((event) => event.type === "field_scan_added");
    assert.ok(fieldScanEvent);
    const fieldScanPayload = JSON.parse(fieldScanEvent?.payload_json ?? "{}") as Record<string, unknown>;
    assert.equal(fieldScanPayload.segment_id, "audio-segment-1");
    assert.equal(fieldScanPayload.raw_audio_stored, false);

    const mobileRecap = await worker.fetch(new Request("https://ikimon.life/api/v1/mobile/field-sessions/mobile-session-1/recap", {
      headers: { cookie: `ikimon_v2_session=${rawToken}` }
    }), productionEnv);
    const mobileRecapPayload = await mobileRecap.json() as any;
    assert.equal(mobileRecapPayload.recap.sceneCount, 1);
    assert.equal(mobileRecapPayload.recap.latestDigest, "道路沿いの樹木と草地が続く");

    const outcomes = await worker.fetch(new Request("https://ikimon.life/guide/outcomes", {
      headers: { cookie: `ikimon_v2_session=${rawToken}` }
    }), productionEnv);
    assert.equal(outcomes.headers.get("x-ikimon-cloudflare-native"), "guide-outcomes-html");
    assert.match(await outcomes.text(), /ガイド成果/);

    const routeLayer = await worker.fetch(new Request("https://ikimon.life/api/v1/me/guide-records/route-layer.geojson", {
      headers: { cookie: `ikimon_v2_session=${rawToken}` }
    }), productionEnv);
    const routeLayerPayload = await routeLayer.json() as any;
    assert.equal(routeLayer.headers.get("x-ikimon-cloudflare-native"), "guide-route-layer-api");
    assert.ok(routeLayerPayload.features.length >= 1);

    const mesh = await worker.fetch(new Request("https://ikimon.life/api/v1/guide/environment-mesh.geojson"), productionEnv);
    const meshPayload = await mesh.json() as any;
    assert.equal(mesh.headers.get("x-ikimon-cloudflare-native"), "guide-environment-mesh-api");
    assert.equal(meshPayload.features[0].properties.meshKey, "mesh-1");

    const hypotheses = await worker.fetch(new Request("https://ikimon.life/api/v1/guide/regional-hypotheses"), productionEnv);
    const hypothesesPayload = await hypotheses.json() as any;
    assert.equal(hypothesesPayload.hypotheses[0].hypothesisId, "hyp-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(fallbackCalls, 0);
});

test("production passive audio ingest is D1-native and dedupes privileged event batches", async () => {
  const { env } = createEnv();
  const productionEnv = { ...env, ENVIRONMENT: "production", V2_PRIVILEGED_WRITE_API_KEY: "write-key" };
  const obs = productionEnv.OBS_DB as FakeD1;
  const event = {
    ingest_schema_version: "birdnet-go-event-only-v0.1",
    source_type: "birdnet_go_rest",
    source_id: "station-api-1",
    source_name: "Station API 1",
    site_id: "site-passive-1",
    observed_start_at: "2026-06-27T09:00:00.000Z",
    observed_end_at: "2026-06-27T09:00:12.000Z",
    timezone: "Asia/Tokyo",
    species_label: "Cettia diphone",
    scientific_name: "Cettia diphone",
    confidence: 0.94,
    detection_method: "ai_audio",
    basisOfRecord: "MachineObservation",
    samplingProtocol: "passive-audio",
    model_id: "birdnet",
    model_version: "2.4",
    provenance: {
      created_by: "passive_engine",
      imported_at: "2026-06-27T09:01:00.000Z",
      adapter_name: "birdnet_go_rest",
      adapter_version: "v0.1",
      raw_payload_hash: "hash-passive-1"
    }
  };

  const first = await worker.fetch(new Request("https://ikimon.life/api/v1/ingest/audio-detections", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": "write-key" },
    body: JSON.stringify({ events: [event] })
  }), productionEnv);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("x-ikimon-cloudflare-native"), "passive-audio-ingest-runtime");
  const firstPayload = await first.json() as any;
  assert.equal(firstPayload.accepted, 1);
  assert.equal(firstPayload.duplicates, 0);
  assert.equal(obs.passiveAudioIngestEvents.size, 1);
  const row = [...obs.passiveAudioIngestEvents.values()][0]!;
  assert.equal(row.dedupe_key, "raw_payload_hash:hash-passive-1");
  assert.equal(row.tier15_candidate, 1);
  assert.equal(row.species_label, "Cettia diphone");

  const second = await worker.fetch(new Request("https://ikimon.life/api/v1/ingest/audio-detections", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": "write-key" },
    body: JSON.stringify([event])
  }), productionEnv);
  assert.equal(second.status, 200);
  const secondPayload = await second.json() as any;
  assert.equal(secondPayload.accepted, 0);
  assert.equal(secondPayload.duplicates, 1);
  assert.equal(obs.passiveAudioIngestEvents.size, 1);
});

test("production passive audio ingest rejects non-privileged or invalid events before D1 writes", async () => {
  const { env } = createEnv();
  const productionEnv = { ...env, ENVIRONMENT: "production", V2_PRIVILEGED_WRITE_API_KEY: "write-key" };
  const obs = productionEnv.OBS_DB as FakeD1;
  const forbidden = await worker.fetch(new Request("https://ikimon.life/api/v1/ingest/audio-detections", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  }), productionEnv);
  assert.equal(forbidden.status, 403);
  assert.equal(obs.passiveAudioIngestEvents.size, 0);

  const invalid = await worker.fetch(new Request("https://ikimon.life/api/v1/ingest/audio-detections", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": "write-key" },
    body: JSON.stringify({ events: [{ ingest_schema_version: "birdnet-go-event-only-v0.1" }] })
  }), productionEnv);
  assert.equal(invalid.status, 207);
  const payload = await invalid.json() as any;
  assert.equal(payload.accepted, 0);
  assert.equal(payload.rejected, 1);
  assert.equal(payload.results[0].error, "source_type_required");
  assert.equal(obs.passiveAudioIngestEvents.size, 0);
});

test("production fieldscan audio runtime stores private R2 audio, detection callbacks, playback, and recap without origin fallback", async () => {
  const { env } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    PUBLIC_WRITE_MODE: "cloudflare_native",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    V2_PRIVILEGED_WRITE_API_KEY: "write-key"
  };
  const issueResponse = await worker.fetch(new Request("https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "fieldscan-user", ttlHours: 1 })
  }), productionEnv);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";
  assert.match(cookie, /^ikimon_v2_session=/);

  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const webmHeader = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x86]).toString("base64");
    const submit = await worker.fetch(new Request("https://ikimon.life/api/v1/fieldscan/audio/submit", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        externalId: "mobile-audio-1",
        sessionId: "fieldscan-session-1",
        visitId: "visit-1",
        placeId: "place-1",
        recordedAt: "2026-06-27T10:00:00.000Z",
        durationSec: 2.4,
        lat: 35.1,
        lng: 139.2,
        mimeType: "audio/webm",
        filename: "chunk.webm",
        base64Data: webmHeader,
        meta: {
          clientVadResult: { speechLikely: false, confidence: 0.92, voiceBandRatio: 0.12 },
          audioFingerprint: { energy: 0.7, peakHz: 3200 }
        }
      })
    }), productionEnv);
    const submitPayload = await submit.json() as any;
    assert.equal(submit.status, 200, JSON.stringify(submitPayload));
    assert.equal(submit.headers.get("x-ikimon-cloudflare-native"), "fieldscan-audio-runtime");
    assert.equal(submitPayload.created, true);
    assert.equal(submitPayload.privacyStatus, "clean");
    assert.equal((productionEnv.ASSET_BUCKET as FakeBucket).objects.size, 1);
    assert.equal((productionEnv.OBS_DB as FakeD1).fieldscanAudioSegments.get(submitPayload.segmentId)?.user_id, "fieldscan-user");

    const spoofed = await worker.fetch(new Request("https://ikimon.life/api/v1/fieldscan/audio/submit", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        sessionId: "fieldscan-session-1",
        userId: "other-user",
        recordedAt: "2026-06-27T10:01:00.000Z",
        storagePath: "external-only.webm"
      })
    }), productionEnv);
    assert.equal(spoofed.status, 403);

    const callback = await worker.fetch(new Request("https://ikimon.life/api/v1/fieldscan/audio/callback", {
      method: "POST",
      headers: { "content-type": "application/json", "x-ikimon-write-key": "write-key" },
      body: JSON.stringify({
        segmentId: submitPayload.segmentId,
        detections: [
          { detectedTaxon: "ヒヨドリ", scientificName: "Hypsipetes amaurotis", confidence: 0.88, provider: "perch_v2", dualAgree: true }
        ],
        embeddings: [{ vector: [0.1, 0.2] }]
      })
    }), productionEnv);
    const callbackPayload = await callback.json() as any;
    assert.equal(callback.status, 200, JSON.stringify(callbackPayload));
    assert.equal(callbackPayload.inserted, 1);
    assert.equal(callbackPayload.embeddingsSkipped, 1);
    assert.equal((productionEnv.OBS_DB as FakeD1).fieldscanAudioDetections.length, 1);

    const playback = await worker.fetch(new Request(`https://ikimon.life/api/v1/fieldscan/audio/segment/${encodeURIComponent(submitPayload.segmentId)}`, {
      headers: { cookie }
    }), productionEnv);
    assert.equal(playback.status, 200);
    assert.equal(playback.headers.get("content-type"), "audio/webm");
    assert.equal((await playback.arrayBuffer()).byteLength, 6);

    const recap = await worker.fetch(new Request("https://ikimon.life/api/v1/fieldscan/session/fieldscan-session-1/recap", {
      headers: { cookie }
    }), productionEnv);
    const recapPayload = await recap.json() as any;
    assert.equal(recap.status, 200, JSON.stringify(recapPayload));
    assert.equal(recapPayload.recap.cleanSegmentCount, 1);
    assert.equal(recapPayload.recap.uniqueTaxa[0].taxon, "ヒヨドリ");
    assert.equal(recapPayload.recap.soundBundles[0].representativeAudioUrl, `/api/v1/fieldscan/audio/segment/${encodeURIComponent(submitPayload.segmentId)}`);

    const speechSubmit = await worker.fetch(new Request("https://ikimon.life/api/v1/fieldscan/audio/submit", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        externalId: "mobile-audio-speech",
        sessionId: "fieldscan-session-1",
        recordedAt: "2026-06-27T10:02:00.000Z",
        mimeType: "audio/webm",
        base64Data: webmHeader,
        meta: { clientVadResult: { speechLikely: true, confidence: 0.94, voiceBandRatio: 0.9 } }
      })
    }), productionEnv);
    const speechPayload = await speechSubmit.json() as any;
    assert.equal(speechPayload.privacyStatus, "deleted_human_voice");
    assert.equal((productionEnv.OBS_DB as FakeD1).fieldscanAudioSegments.get(speechPayload.segmentId)?.storage_key, null);
    assert.equal((productionEnv.ASSET_BUCKET as FakeBucket).objects.size, 1);

    const similar = await worker.fetch(new Request(`https://ikimon.life/api/v1/fieldscan/audio/segment/${encodeURIComponent(submitPayload.segmentId)}/similar`, {
      headers: { "x-ikimon-write-key": "write-key" }
    }), productionEnv);
    assert.equal(similar.status, 410);
    assert.equal((await similar.json() as any).replacement, "cloudflare_vectorize_required_before_reenable");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(fallbackCalls, 0);
});

test("production guide admin runtime manages programs and prompt review in Cloudflare D1", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  const rawToken = "signed-in-guide-admin-token";
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  core.authSessions.set(tokenHash, {
    token_hash: tokenHash,
    user_id: "guide-admin",
    display_name: "Guide Admin",
    role_name: "Admin",
    rank_label: null,
    banned: 0,
    expires_at: "2099-01-01T00:00:00.000Z",
    last_used_at: null
  });
  env.OBS_DB.guidePromptImprovements.set("imp-1", {
    improvement_id: "imp-1",
    source_key: "source-1",
    improvement_type: "rewrite_pattern",
    label: "wrong",
    claim_type: "sampling_gap",
    trigger: "wrong_feedback_cluster",
    recommendation: "断定を弱め、次に記録する項目を先に出す。",
    prompt_patch: "Keep the claim as a hypothesis.",
    evidence_json: "{}",
    support_count: 4,
    review_status: "needs_review",
    generated_at: "2026-06-20T00:00:00.000Z"
  });
  env.OBS_DB.guidePromptQueues.set("queue-1", {
    queue_id: "queue-1",
    claim_type: "sampling_gap",
    trigger: "wrong_feedback_threshold",
    wrong_count: 4,
    threshold_count: 3,
    queue_status: "open",
    improvement_ids_json: "[\"imp-1\"]",
    evidence_json: "{}",
    first_seen_at: "2026-06-20T00:00:00.000Z",
    last_seen_at: "2026-06-21T00:00:00.000Z",
    resolved_at: null
  });

  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const create = await worker.fetch(new Request("https://ikimon.life/api/v1/admin/guide-programs", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `ikimon_v2_session=${rawToken}` },
      body: JSON.stringify({
        programId: "hamamatsu-admin-program",
        slug: "hamamatsu-admin-program",
        title: "浜松ガイド管理",
        ownerType: "municipality",
        participationMode: "any_order",
        status: "published",
        publicSummary: "公開情報と現地導線を束ねる企画",
        guideSpotIds: ["hamamatsu-shijimizuka-site"]
      })
    }), productionEnv);
    const createPayload = await create.json() as any;
    assert.equal(create.ok, true, JSON.stringify(createPayload));
    assert.equal(env.OBS_DB.guidePrograms.get("hamamatsu-admin-program")?.title, "浜松ガイド管理");
    assert.equal(env.OBS_DB.guideProgramSpots.has("hamamatsu-admin-program:hamamatsu-shijimizuka-site"), true);

    const state = await worker.fetch(new Request("https://ikimon.life/api/v1/admin/guide-programs", {
      headers: { cookie: `ikimon_v2_session=${rawToken}` }
    }), productionEnv);
    const statePayload = await state.json() as any;
    assert.equal(state.headers.get("x-ikimon-cloudflare-native"), "guide-programs-admin-api");
    assert.equal(statePayload.programs[0].programId, "hamamatsu-admin-program");

    env.OBS_DB.guideUnlocks.set("u1:hamamatsu-shijimizuka-site", {
      user_id: "u1",
      guide_spot_id: "hamamatsu-shijimizuka-site",
      program_id: "hamamatsu-admin-program",
      distance_band: "same_place",
      first_unlocked_at: "2026-06-21T00:00:00.000Z",
      last_unlocked_at: "2026-06-21T00:00:00.000Z",
      last_listened_at: "2026-06-21T00:10:00.000Z"
    });
    const recap = await worker.fetch(new Request("https://ikimon.life/api/v1/admin/guide-programs/hamamatsu-admin-program/recap", {
      headers: { cookie: `ikimon_v2_session=${rawToken}` }
    }), productionEnv);
    const recapPayload = await recap.json() as any;
    assert.equal(recap.ok, true, JSON.stringify(recapPayload));
    assert.equal(recapPayload.recap.privacyBoundary.exactCoordinatesIncluded, false);

    const updateImprovement = await worker.fetch(new Request("https://ikimon.life/api/v1/admin/guide-prompt-improvements/imp-1/status", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `ikimon_v2_session=${rawToken}` },
      body: JSON.stringify({ reviewStatus: "reviewed" })
    }), productionEnv);
    assert.equal(updateImprovement.ok, true);
    assert.equal(env.OBS_DB.guidePromptImprovements.get("imp-1")?.review_status, "reviewed");

    const updateQueue = await worker.fetch(new Request("https://ikimon.life/api/v1/admin/guide-prompt-improvement-queue/queue-1/status", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `ikimon_v2_session=${rawToken}` },
      body: JSON.stringify({ queueStatus: "resolved" })
    }), productionEnv);
    assert.equal(updateQueue.ok, true);
    assert.equal(env.OBS_DB.guidePromptQueues.get("queue-1")?.queue_status, "resolved");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(fallbackCalls, 0);
});

test("internal alert delivery drain sends pending email delivery from Cloudflare bindings", async () => {
  const { env, core } = createEnv();
  const email = new FakeEmail();
  core.alertRecipients.set("recipient-1", {
    recipient_id: "recipient-1",
    recipient_type: "municipality",
    display_name: "静岡市",
    email: "city@example.test",
    is_active: 1,
    rate_limit_per_day: 50
  });
  core.alertDeliveries.set("delivery-1", {
    delivery_id: "delivery-1",
    occurrence_id: "occ-1",
    user_id: null,
    recipient_id: "recipient-1",
    trigger_kind: "municipality_invasive",
    channel: "email",
    delivered_at: null,
    delivery_status: "pending",
    error_message: null,
    payload_json: JSON.stringify({ title: "外来種らしき記録", body: "確認対象の記録があります。", href: "/observations/occ-1" }),
    acknowledged_at: null,
    created_at: "2026-06-26T00:00:00.000Z"
  });

  const response = await worker.fetch(internalRequest("/internal/alert-deliveries/drain?limit=5", { method: "POST" }), {
    ...env,
    ALERT_EMAIL: email,
    ALERT_EMAIL_FROM: "notifications@ikimon.life",
    ALERT_EMAIL_ALLOWED_RECIPIENTS: "city@example.test"
  });
  const payload = await response.json() as any;
  assert.equal(response.ok, true, JSON.stringify(payload));
  assert.equal(payload.configured, true);
  assert.equal(payload.sent, 1);
  assert.equal(email.messages.length, 1);
  assert.equal(email.messages[0]?.to, "city@example.test");
  assert.equal(email.messages[0]?.headers?.["X-Ikimon-Alert-Delivery-Id"], "delivery-1");
  assert.equal(core.alertDeliveries.get("delivery-1")?.delivery_status, "sent");
  assert.equal(core.alertDeliveries.get("delivery-1")?.delivered_at !== null, true);
  assert.equal(core.invasiveReportingEvents.length, 1);
  assert.equal(core.invasiveReportingEvents[0]?.event_status, "sent");
});

test("scheduled alert delivery drain defers without mutating pending rows when email binding is absent", async () => {
  const { env, core } = createEnv();
  core.alertDeliveries.set("delivery-2", {
    delivery_id: "delivery-2",
    occurrence_id: "occ-2",
    user_id: "user-2",
    recipient_id: null,
    trigger_kind: "taxon_match",
    channel: "email",
    delivered_at: null,
    delivery_status: "pending",
    error_message: null,
    payload_json: JSON.stringify({ title: "フォロー中の記録" }),
    acknowledged_at: null,
    created_at: "2026-06-26T00:00:00.000Z"
  });
  const waitUntil: Promise<unknown>[] = [];
  await worker.scheduled?.({ cron: "*/5 * * * *" }, env, { waitUntil: (promise) => waitUntil.push(promise) });
  await Promise.all(waitUntil);
  assert.equal(core.alertDeliveries.get("delivery-2")?.delivery_status, "pending");
  assert.equal(core.alertDeliveries.get("delivery-2")?.delivered_at, null);
});

test("alert delivery drain does not send to non-allowlisted recipients outside production", async () => {
  const { env, core } = createEnv();
  const email = new FakeEmail();
  core.authUsers.set("user-allowlist", {
    user_id: "user-allowlist",
    email: "real-city@example.test",
    password_hash: null,
    display_name: "Recipient User",
    role_name: "Observer",
    rank_label: null,
    banned: 0,
    last_login_at: null
  });
  core.alertDeliveries.set("delivery-allowlist", {
    delivery_id: "delivery-allowlist",
    occurrence_id: "occ-allowlist",
    user_id: "user-allowlist",
    recipient_id: null,
    trigger_kind: "taxon_match",
    channel: "email",
    delivered_at: null,
    delivery_status: "pending",
    error_message: null,
    payload_json: JSON.stringify({ title: "非本番送信ガード" }),
    acknowledged_at: null,
    created_at: "2026-06-26T00:00:00.000Z"
  });

  const response = await worker.fetch(internalRequest("/internal/alert-deliveries/drain", { method: "POST" }), {
    ...env,
    ALERT_EMAIL: email,
    ALERT_EMAIL_ALLOWED_RECIPIENTS: "safe@example.test"
  });
  const payload = await response.json() as any;
  assert.equal(response.ok, true, JSON.stringify(payload));
  assert.equal(payload.deferred, 1);
  assert.equal(email.messages.length, 0);
  assert.equal(core.alertDeliveries.get("delivery-allowlist")?.delivery_status, "pending");
  assert.equal(core.alertDeliveries.get("delivery-allowlist")?.error_message, "nonproduction_recipient_not_allowed");
});

test("alert delivery drain fails pending row when recipient email is unavailable", async () => {
  const { env, core } = createEnv();
  const email = new FakeEmail();
  core.alertRecipients.set("recipient-no-email", {
    recipient_id: "recipient-no-email",
    recipient_type: "municipality",
    display_name: "メールなし自治体",
    email: null,
    is_active: 1,
    rate_limit_per_day: 50
  });
  core.alertDeliveries.set("delivery-3", {
    delivery_id: "delivery-3",
    occurrence_id: "occ-3",
    user_id: null,
    recipient_id: "recipient-no-email",
    trigger_kind: "municipality_invasive",
    channel: "email",
    delivered_at: null,
    delivery_status: "pending",
    error_message: null,
    payload_json: "{}",
    acknowledged_at: null,
    created_at: "2026-06-26T00:00:00.000Z"
  });

  const response = await worker.fetch(internalRequest("/internal/alert-deliveries/drain", { method: "POST" }), {
    ...env,
    ALERT_EMAIL: email
  });
  const payload = await response.json() as any;
  assert.equal(response.ok, true, JSON.stringify(payload));
  assert.equal(payload.failed, 1);
  assert.equal(email.messages.length, 0);
  assert.equal(core.alertDeliveries.get("delivery-3")?.delivery_status, "failed");
  assert.equal(core.alertDeliveries.get("delivery-3")?.error_message, "recipient_email_unavailable");
});

test("production runtime enables app-compatible write routes while keeping shadow smoke routes closed", async () => {
  const { env, obs, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production"
  };
  const workerOrigin = "https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev";

  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;

  try {
    for (const path of [
      "/shadow-smoke/record",
      "/shadow-smoke/map",
      "/shadow-smoke/takedown-proof",
      "/shadow-smoke/route-change-rehearsal-proof",
      "/shadow/stream/test-video",
      "/shadow/stream/test-video/thumbnail.jpg"
    ]) {
      const response = await worker.fetch(new Request(`https://ikimon.life${path}`), productionEnv);
      assert.equal(response.status, 404, path);
    }
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }

  const issueResponse = await worker.fetch(new Request(`${workerOrigin}/api/v1/auth/session/issue`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userId: "production-user",
      displayName: "Production User",
      roleName: "Observer",
      ttlHours: 1
    })
  }), productionEnv);
  const issuePayload = await issueResponse.json() as any;
  assert.equal(issueResponse.ok, true, JSON.stringify(issuePayload));
  assert.equal(issuePayload.ok, true);
  assert.match(issueResponse.headers.get("set-cookie") ?? "", /Secure/);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";

  const upsertResponse = await worker.fetch(new Request(`${workerOrigin}/api/v1/observations/upsert`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
    observationId: "production-runtime-observation",
    userId: "production-user",
    observedAt: "2026-06-16T00:00:00.000Z",
    latitude: 34.71234,
    longitude: 137.81234,
    locationAccuracyM: 12,
    note: "production runtime route compatibility",
    taxon: { vernacularName: "production runtime plant", rank: "species" }
    })
  }), productionEnv);
  const upsertPayload = await upsertResponse.json() as any;
  assert.equal(upsertResponse.ok, true, JSON.stringify(upsertPayload));
  assert.equal(upsertPayload.ok, true);

  const photoResponse = await worker.fetch(new Request(`${workerOrigin}/api/v1/observations/production-runtime-observation/photos/upload`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      filename: "production-runtime.jpg",
      mimeType: "image/jpeg",
      base64Data: Buffer.from("production-runtime-image").toString("base64"),
      facePrivacy: "no_faces"
    })
  }), productionEnv);
  const photoPayload = await photoResponse.json() as any;
  assert.equal(photoResponse.ok, true, JSON.stringify(photoPayload));
  assert.equal(photoPayload.ok, true);

  const directResponse = await worker.fetch(new Request(`${workerOrigin}/api/v1/videos/direct-upload`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      filename: "production-runtime.mp4",
      observationId: "production-runtime-observation",
      mediaRole: "observation_video",
      uploadProtocol: "post",
      fileSizeBytes: 18
    })
  }), productionEnv);
  const directPayload = await directResponse.json() as any;
  assert.equal(directResponse.ok, true, JSON.stringify(directPayload));
  assert.equal(directPayload.ok, true);

  const uid = String(directPayload.uid);
  const bodyResponse = await worker.fetch(new Request(`${workerOrigin}/api/v1/videos/${encodeURIComponent(uid)}/body`, {
    method: "PUT",
    headers: { "content-type": "video/mp4", cookie },
    body: "production-video-bytes"
  }), productionEnv);
  assert.equal(bodyResponse.ok, true, await bodyResponse.text());

  const finalizeResponse = await worker.fetch(new Request(`${workerOrigin}/api/v1/videos/${encodeURIComponent(uid)}/finalize`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      observationId: "production-runtime-observation",
      durationMs: 9000,
      readyToStream: true,
      bytes: 22
    })
  }), productionEnv);
  const finalizePayload = await finalizeResponse.json() as any;
  assert.equal(finalizeResponse.ok, true, JSON.stringify(finalizePayload));
  assert.equal(finalizePayload.ok, true);

  const hideResponse = await worker.fetch(new Request(`${workerOrigin}/api/v1/observations/production-runtime-observation/hide`, {
    method: "POST",
    headers: { cookie }
  }), productionEnv);
  const hidePayload = await hideResponse.json() as any;
  assert.equal(hideResponse.ok, true, JSON.stringify(hidePayload));
  assert.equal(hidePayload.ok, true);
  assert.equal(obs.observations.get("production-runtime-observation")?.emergency_hidden, 1);
  assert.equal(obs.rollbackLedger.size, 4);
});

test("staging runtime uses Cloudflare app shell without exposing shadow diagnostics", async () => {
  const { env, core } = createEnv();
  const stagingEnv = {
    ...env,
    ENVIRONMENT: "staging",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  await env.ASSET_BUCKET.put("original-ui/html/demo/place-feeling-tags.html", "<!doctype html><title>ひとことタグ デモ</title><main>実データではありません place_feeling_tags</main>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });

  const health = await worker.fetch(new Request("https://staging.ikimon.life/healthz"), stagingEnv);
  assert.equal(health.status, 200);
  assert.equal((await health.json() as any).environment, "staging");

  const demo = await worker.fetch(new Request("https://staging.ikimon.life/demo/place-feeling-tags"), stagingEnv);
  assert.equal(demo.status, 200);
  assert.match(await demo.text(), /実データではありません/);
  assert.equal(demo.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");

  const shadowRecord = await worker.fetch(new Request("https://staging.ikimon.life/shadow-smoke/record"), stagingEnv);
  assert.equal(shadowRecord.status, 404);

  const issueSession = await worker.fetch(new Request("https://staging.ikimon.life/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "staging-user", displayName: "Staging User" })
  }), stagingEnv);
  assert.equal(issueSession.status, 200);
  assert.match(issueSession.headers.get("set-cookie") ?? "", /Secure/);
  assert.equal(core.operationAudit.length, 0);
});

test("production stewardship action form and post are D1-native without origin fallback", async () => {
  const { env, core, obs } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    ORIGIN_SESSION_IMPORT_MODE: "disabled",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  const rawToken = "stewardship-action-token";
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  core.authSessions.set(tokenHash, {
    token_hash: tokenHash,
    user_id: "care-user",
    display_name: "Care User",
    role_name: "Observer",
    rank_label: null,
    banned: 0,
    expires_at: "2099-01-01T00:00:00.000Z",
    last_used_at: null
  });

  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const formResponse = await worker.fetch(new Request("https://ikimon.life/sites/place-care-1/stewardship/new?lang=ja", {
      headers: { cookie: `ikimon_v2_session=${rawToken}` }
    }), productionEnv);
    assert.equal(formResponse.status, 200);
    assert.equal(formResponse.headers.get("x-ikimon-cloudflare-native"), "stewardship-action-form");
    assert.match(await formResponse.text(), /手入れの記録/);

    const guestPost = await worker.fetch(new Request("https://ikimon.life/sites/place-care-1/stewardship_actions", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        occurred_at: "2026-06-27T09:30",
        action_kind: "cleanup",
        lang: "ja"
      }).toString()
    }), productionEnv);
    assert.equal(guestPost.status, 303);
    assert.match(guestPost.headers.get("location") ?? "", /error=login_required/);

    const postResponse = await worker.fetch(new Request("https://ikimon.life/sites/place-care-1/stewardship_actions", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: `ikimon_v2_session=${rawToken}`
      },
      body: new URLSearchParams({
        occurred_at: "2026-06-27T09:30",
        action_kind: "cleanup",
        species_status: "invasive",
        linked_visit_id: "visit-care-1",
        description: "河川敷のごみを拾った",
        lang: "ja"
      }).toString()
    }), productionEnv);
    assert.equal(postResponse.status, 303);
    assert.match(postResponse.headers.get("location") ?? "", /ok=1/);
    assert.equal(postResponse.headers.get("x-ikimon-cloudflare-native"), "stewardship-action-write");
    assert.equal(obs.stewardshipActions.size, 1);
    const row = [...obs.stewardshipActions.values()][0];
    assert.ok(row);
    assert.equal(row.place_id, "place-care-1");
    assert.equal(row.action_kind, "cleanup");
    assert.equal(row.actor_user_id, "care-user");
    assert.equal(row.linked_visit_id, "visit-care-1");
    assert.equal(row.species_status, "invasive");
    assert.match(row.metadata_json, /cloudflare_web_form/);
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production candidate action routes write D1 requests without origin fallback", async () => {
  const { env, core, obs } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  const rawOwnerToken = "candidate-action-owner-token";
  const ownerTokenHash = createHash("sha256").update(rawOwnerToken).digest("hex");
  core.authSessions.set(ownerTokenHash, {
    token_hash: ownerTokenHash,
    user_id: "owner-user",
    display_name: "Owner User",
    role_name: "Observer",
    rank_label: null,
    banned: 0,
    expires_at: "2099-01-01T00:00:00.000Z",
    last_used_at: null
  });
  const rawProposerToken = "candidate-action-proposer-token";
  const proposerTokenHash = createHash("sha256").update(rawProposerToken).digest("hex");
  core.authSessions.set(proposerTokenHash, {
    token_hash: proposerTokenHash,
    user_id: "proposer-user",
    display_name: "Proposer User",
    role_name: "Observer",
    rank_label: null,
    banned: 0,
    expires_at: "2099-01-01T00:00:00.000Z",
    last_used_at: null
  });
  obs.productionVisits.set("visit-candidate-imported", {
    visit_id: "visit-candidate-imported",
    legacy_observation_id: null,
    user_id: "owner-user",
    public_visibility: "public",
    observed_at: "2026-06-26T00:00:00.000Z"
  });
  obs.productionOccurrences.set("occ-candidate-imported", {
    occurrence_id: "occ-candidate-imported",
    visit_id: "visit-candidate-imported",
    scientific_name: "Test species",
    vernacular_name: "テスト種",
    taxon_rank: "species",
    created_at: "2026-06-26T00:00:00.000Z"
  });
  const originalFetch = globalThis.fetch;
  const seen: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push(String(input));
    return new Response(JSON.stringify({ ok: true, originFallback: true }), {
      status: 202,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  try {
    const proposeResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/occ-candidate-imported/candidates/candidate-propose/propose", {
      method: "POST",
      headers: { cookie: `ikimon_v2_session=${rawProposerToken}` }
    }), productionEnv);
    const proposePayload = await proposeResponse.json() as any;
    assert.equal(proposeResponse.status, 202);
    assert.equal(proposePayload.ok, true);
    assert.equal(proposePayload.candidateAction.state, "pending");
    assert.equal(proposePayload.candidateAction.actionKind, "propose");

    const adoptResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/occ-candidate-imported/candidates/candidate-adopt/adopt", {
      method: "POST",
      headers: { cookie: `ikimon_v2_session=${rawOwnerToken}` }
    }), productionEnv);
    const adoptPayload = await adoptResponse.json() as any;
    assert.equal(adoptResponse.status, 202);
    assert.equal(adoptPayload.ok, true);
    assert.equal(adoptPayload.candidateAction.state, "pending");
    assert.equal(adoptPayload.candidateAction.actionKind, "adopt");

    const rejectedAdopt = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/occ-candidate-imported/candidates/candidate-adopt/adopt", {
      method: "POST",
      headers: { cookie: `ikimon_v2_session=${rawProposerToken}` }
    }), productionEnv);
    assert.equal(rejectedAdopt.status, 403);
    assert.equal(seen.length, 0);
    assert.equal(core.operationAudit.length, 0);
    assert.equal(obs.candidateActionRequests.get("occ-candidate-imported:candidate-propose:propose:proposer-user")?.request_state, "pending");
    assert.equal(obs.candidateActionRequests.get("occ-candidate-imported:candidate-adopt:adopt:owner-user")?.request_state, "pending");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production management candidate confirmation is D1-native for Cloudflare-owned observations", async () => {
  const { env, core, obs } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  const rawToken = "management-confirm-token";
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  core.authSessions.set(tokenHash, {
    token_hash: tokenHash,
    user_id: "owner-user",
    display_name: "Owner User",
    role_name: "Observer",
    rank_label: null,
    banned: 0,
    expires_at: "2099-01-01T00:00:00.000Z",
    last_used_at: null
  });
  obs.observations.set("obs-management-1", {
    observation_id: "obs-management-1",
    draft_id: "draft-management-1",
    owner_user_id: "owner-user",
    observed_at: "2026-06-26T00:00:00.000Z",
    partition_month: "2026_06",
    taxon_label: "unknown",
    note: null,
    exact_lat: null,
    exact_lng: null,
    location_accuracy_m: null,
    public_cell: "35.000,138.000",
    visibility: "private",
    emergency_hidden: 0,
    processing_state: "accepted"
  });
  obs.productionVisits.set("visit-management-imported", {
    visit_id: "visit-management-imported",
    legacy_observation_id: "legacy-management-1",
    user_id: "owner-user",
    public_visibility: "private",
    observed_at: "2026-06-25T00:00:00.000Z"
  });
  obs.productionOccurrences.set("occ-management-imported", {
    occurrence_id: "occ-management-imported",
    visit_id: "visit-management-imported",
    scientific_name: null,
    vernacular_name: "unknown",
    taxon_rank: null,
    created_at: "2026-06-25T00:00:00.000Z"
  });

  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/obs-management-1/management-candidates/2/confirm", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `ikimon_v2_session=${rawToken}`
      },
      body: JSON.stringify({ confirmState: "confirmed" })
    }), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.ok, true, JSON.stringify(payload));
    assert.equal(payload.candidate.confirmState, "confirmed");
    assert.equal(payload.stewardshipActionId, null);
    assert.equal(payload.compatibility.source, "cloudflare_management_candidate_confirmation_ledger");
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
    const ledger = obs.managementCandidateConfirmations.get("obs-management-1:2:owner-user");
    assert.equal(ledger?.confirm_state, "confirmed");
    assert.equal(ledger?.actor_user_id, "owner-user");

    const importedResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/occ-management-imported/management-candidates/1/confirm", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `ikimon_v2_session=${rawToken}`
      },
      body: JSON.stringify({ confirmState: "rejected" })
    }), productionEnv);
    const importedPayload = await importedResponse.json() as any;
    assert.equal(importedResponse.ok, true, JSON.stringify(importedPayload));
    assert.equal(importedPayload.candidate.confirmState, "rejected");
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
    assert.equal(obs.managementCandidateConfirmations.get("occ-management-imported:1:owner-user")?.confirm_state, "rejected");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production observation reassess routes write D1 requests without origin fallback", async () => {
  const { env, core, obs } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  const rawToken = "reassess-request-token";
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  core.authSessions.set(tokenHash, {
    token_hash: tokenHash,
    user_id: "owner-user",
    display_name: "Owner User",
    role_name: "Observer",
    rank_label: null,
    banned: 0,
    expires_at: "2099-01-01T00:00:00.000Z",
    last_used_at: null
  });
  obs.productionVisits.set("visit-reassess-imported", {
    visit_id: "visit-reassess-imported",
    legacy_observation_id: null,
    user_id: "owner-user",
    public_visibility: "private",
    observed_at: "2026-06-25T00:00:00.000Z"
  });
  obs.productionOccurrences.set("occ-reassess-imported", {
    occurrence_id: "occ-reassess-imported",
    visit_id: "visit-reassess-imported",
    scientific_name: null,
    vernacular_name: "unknown",
    taxon_rank: null,
    created_at: "2026-06-25T00:00:00.000Z"
  });

  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const standard = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/occ-reassess-imported/reassess", {
      method: "POST",
      headers: { cookie: `ikimon_v2_session=${rawToken}` }
    }), productionEnv);
    const standardPayload = await standard.json() as any;
    assert.equal(standard.status, 202, JSON.stringify(standardPayload));
    assert.equal(standardPayload.ok, true);
    assert.equal(standardPayload.reassessment.state, "pending");
    assert.equal(standardPayload.reassessment.kind, "standard");

    const video = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/occ-reassess-imported/reassess-from-video", {
      method: "POST",
      headers: { cookie: `ikimon_v2_session=${rawToken}` }
    }), productionEnv);
    const videoPayload = await video.json() as any;
    assert.equal(video.status, 202, JSON.stringify(videoPayload));
    assert.equal(videoPayload.ok, true);
    assert.equal(videoPayload.reassessment.kind, "video");

    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
    assert.equal(obs.observationReassessmentRequests.get("occ-reassess-imported:standard:owner-user")?.request_state, "pending");
    assert.equal(obs.observationReassessmentRequests.get("occ-reassess-imported:video:owner-user")?.request_state, "pending");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production reference candidates route is native and never probes origin fallback", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    ORIGIN_SESSION_IMPORT_MODE: "disabled"
  };
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const guest = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/occ-1/reference-candidates"), productionEnv);
    assert.equal(guest.status, 401);
    assert.deepEqual(await guest.json(), { ok: false, error: "session_required" });
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);

    const rawToken = "reference-candidates-token";
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    core.authSessions.set(tokenHash, {
      token_hash: tokenHash,
      user_id: "reference-user",
      display_name: "Reference User",
      role_name: "Observer",
      rank_label: null,
      banned: 0,
      expires_at: "2099-01-01T00:00:00.000Z",
      last_used_at: null
    });
    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/occ-1/reference-candidates?proposedName=%E9%B3%A5", {
      headers: { cookie: `ikimon_v2_session=${rawToken}` }
    }), productionEnv);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      candidates: [],
      source: "cloudflare_reference_library_runtime",
      referenceCatalogStatus: "d1_native",
      occurrenceId: "occ-1"
    });
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reference library runtime stores D1 metadata and serves list candidates corrections and duplicate ledger", async () => {
  const { env, core, obs } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    ORIGIN_SESSION_IMPORT_MODE: "disabled"
  };
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const issueResponse = await worker.fetch(new Request("https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/api/v1/auth/session/issue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "reference-specialist", roleName: "Specialist Admin", ttlHours: 1 })
    }), productionEnv);
    const cookie = issueResponse.headers.get("set-cookie") ?? "";
    assert.match(cookie, /^ikimon_v2_session=/);

    const capture = await worker.fetch(new Request("https://ikimon.life/api/v1/references/capture-batches", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        items: [
          {
            filename: "birds-cover.jpg",
            mimeType: "image/jpeg",
            title: "静岡の鳥類図鑑",
            isbn: "978-4-0000-0000-1",
            authorText: "調査会",
            publisher: "ikimon",
            publicationYear: 2026,
            sourceKind: "field_guide",
            taxonHints: ["鳥", "Aves"],
            proofKind: "cover"
          },
          {
            title: "静岡の鳥類図鑑 改訂版",
            isbn: "978-4-0000-0000-2",
            taxonHints: ["鳥"]
          }
        ]
      })
    }), productionEnv);
    assert.equal(capture.status, 200);
    const capturePayload = await capture.json() as any;
    assert.equal(capturePayload.ok, true);
    assert.equal(capturePayload.items.length, 2);
    assert.equal(capturePayload.compatibility.aiCoverExtractionParity, false);
    const sourceId = capturePayload.items[0].sourceId;
    const duplicateSourceId = capturePayload.items[1].sourceId;
    assert.equal(obs.referenceSources.size, 2);
    assert.equal(obs.referenceAccessProofs.size, 2);

    const list = await worker.fetch(new Request("https://ikimon.life/api/v1/references?tab=catalog", {
      headers: { cookie }
    }), productionEnv);
    assert.equal(list.status, 200);
    const listPayload = await list.json() as any;
    assert.equal(listPayload.ok, true);
    assert.equal(listPayload.snapshot.cards.length, 2, JSON.stringify(listPayload));
    assert.equal(listPayload.snapshot.summary.needsReviewCount, 2);
    assert.equal(listPayload.compatibility.source, "cloudflare_reference_library_runtime");

    const candidates = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/occ-1/reference-candidates?proposedName=%E9%B3%A5", {
      headers: { cookie }
    }), productionEnv);
    assert.equal(candidates.status, 200);
    const candidatePayload = await candidates.json() as any;
    assert.equal(candidatePayload.referenceCatalogStatus, "d1_native");
    assert.ok(candidatePayload.candidates.length >= 1, JSON.stringify(candidatePayload));
    assert.equal(candidatePayload.candidates[0].reason, "共有カタログで分類群一致");

    const correction = await worker.fetch(new Request(`https://ikimon.life/api/v1/references/${sourceId}/corrections`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        locator: "p.12",
        originalName: "鳥",
        correctedName: "鳥類",
        correctionKind: "taxonomy_update",
        verificationStatus: "official_confirmed",
        officialReference: "自治体公開資料"
      })
    }), productionEnv);
    assert.equal(correction.status, 200);
    assert.equal((await correction.json() as any).ok, true);
    assert.equal(obs.referenceCorrections.size, 1);

    const corrections = await worker.fetch(new Request(`https://ikimon.life/api/v1/references/${sourceId}/corrections`, {
      headers: { cookie }
    }), productionEnv);
    assert.equal(corrections.status, 200);
    assert.equal((await corrections.json() as any).corrections[0].verificationStatus, "official_confirmed");

    const merge = await worker.fetch(new Request("https://ikimon.life/api/v1/references/duplicates/merge", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ canonicalSourceId: sourceId, duplicateSourceId })
    }), productionEnv);
    assert.equal(merge.status, 200);
    assert.equal((await merge.json() as any).result.duplicateSourceId, duplicateSourceId);
    assert.equal(obs.referenceSources.get(duplicateSourceId)?.catalog_status, "duplicate");
    assert.equal(obs.referenceDuplicateMerges.size, 1);
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production runtime handles observation reactions natively without origin fallback", async () => {
  const { env, core, obs } = createEnv();
  obs.readmodel.set("occ-1", {
    observation_id: "occ-1",
    public_cell: "34.97,138.38",
    observed_at: "2026-06-25T00:00:00.000Z",
    taxon_label: "reaction target",
    asset_count: 0,
    partition_month: "2026-06"
  });
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    PUBLIC_WRITE_MODE: "cloudflare_native",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const issueResponse = await worker.fetch(new Request("https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "reaction-user", ttlHours: 1 })
  }), productionEnv);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";
  assert.match(cookie, /^ikimon_v2_session=/);

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ ok: true, originFallback: true }), {
      status: 202,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  try {
    const first = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/occ-1/reactions/like", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ source: "unit", userId: "spoofed-user" })
    }), productionEnv);
    const firstPayload = await first.json() as any;
    assert.equal(first.status, 200, JSON.stringify(firstPayload));
    assert.equal(firstPayload.added, true);
    assert.equal(obs.observationReactions.size, 1);
    assert.equal([...obs.observationReactions.values()][0]?.user_id, "reaction-user");

    const second = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/occ-1/reactions/like", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ source: "unit" })
    }), productionEnv);
    const secondPayload = await second.json() as any;
    assert.equal(second.status, 200, JSON.stringify(secondPayload));
    assert.equal(secondPayload.added, false);
    assert.equal(obs.observationReactions.size, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(fetchCalls, 0);
  assert.equal(core.operationAudit.length, 0);
});

test("production runtime records observation identifications natively without origin fallback", async () => {
  const { env, core, obs } = createEnv();
  obs.readmodel.set("occ-1", {
    observation_id: "occ-1",
    public_cell: "34.97,138.38",
    observed_at: "2026-06-25T00:00:00.000Z",
    taxon_label: "identification target",
    asset_count: 0,
    partition_month: "2026-06"
  });
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    PUBLIC_WRITE_MODE: "cloudflare_native",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const issueResponse = await worker.fetch(new Request("https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "identification-user", ttlHours: 1 })
  }), productionEnv);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";
  assert.match(cookie, /^ikimon_v2_session=/);

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ ok: true, originFallback: true }), {
      status: 202,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/occ-1/identifications", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        proposedName: "アオスジアゲハ",
        proposedRank: "species",
        notes: "quality card confirmation",
        stance: "support",
        referenceSourceIds: ["ref-1"],
        referenceLocator: "p.12"
      })
    }), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.status, 200, JSON.stringify(payload));
    assert.equal(payload.ok, true);
    assert.equal(payload.occurrenceId, "occ-1");
    assert.equal(payload.compatibility.source, "cloudflare_observation_identifications");
    assert.equal(payload.consensus.communityTaxon.name, "アオスジアゲハ");
    assert.equal(obs.observationIdentifications.size, 1);
    const saved = [...obs.observationIdentifications.values()][0];
    assert.equal(saved?.actor_user_id, "identification-user");
    assert.equal(saved?.proposed_name, "アオスジアゲハ");
    assert.equal(saved?.proposed_rank, "species");
    assert.equal(saved?.stance, "support");
    assert.match(saved?.source_payload_json ?? "", /ref-1/);
    assert.equal([...obs.outbox.values()].some((row) => row.topic === "readmodel.refresh" && row.target_id === "occ-1"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(fetchCalls, 0);
  assert.equal(core.operationAudit.length, 0);
});

test("production runtime records observation AI reviews natively without origin fallback", async () => {
  const { env, core, obs } = createEnv();
  obs.observationAiReviewTargets.set("occ-ai-1", {
    occurrence_id: "occ-ai-1",
    ai_assessment_status: "ai_judgement",
    scientific_name: null,
    vernacular_name: null,
    taxon_rank: null,
    ai_run_id: "ai-run-1",
    candidate_id: "candidate-1",
    candidate_scientific_name: "Pieris rapae",
    candidate_vernacular_name: "モンシロチョウ",
    candidate_taxon_rank: "species",
    ai_recommended_taxon_name: "Pieris rapae",
    ai_recommended_rank: "species"
  });
  obs.observationAiReviewTargets.set("occ-human-1", {
    occurrence_id: "occ-human-1",
    ai_assessment_status: "human_reviewed",
    scientific_name: "Papilio xuthus",
    vernacular_name: "ナミアゲハ",
    taxon_rank: "species",
    ai_run_id: null,
    candidate_id: null,
    candidate_scientific_name: null,
    candidate_vernacular_name: null,
    candidate_taxon_rank: null,
    ai_recommended_taxon_name: null,
    ai_recommended_rank: null
  });
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    PUBLIC_WRITE_MODE: "cloudflare_native",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const issueResponse = await worker.fetch(new Request("https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "ai-review-user", ttlHours: 1 })
  }), productionEnv);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";
  assert.match(cookie, /^ikimon_v2_session=/);

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ ok: true, originFallback: true }), {
      status: 202,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/observation-records/occ-ai-1/ai-review", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ reviewState: "agree" })
    }), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.status, 200, JSON.stringify(payload));
    assert.equal(response.headers.get("x-ikimon-cloudflare-native"), "observation-record-ai-review");
    assert.equal(payload.ok, true);
    assert.equal(payload.occurrenceId, "occ-ai-1");
    assert.equal(payload.reviewState, "agree");
    assert.equal(payload.compatibility.source, "cloudflare_observation_record_ai_reviews");
    assert.equal(payload.consensus.communityTaxon.name, "Pieris rapae");
    assert.equal(payload.consensus.aiReviewAgreeCount, 1);
    assert.equal(obs.observationRecordAiReviews.size, 1);
    const savedReview = [...obs.observationRecordAiReviews.values()][0];
    assert.equal(savedReview?.actor_user_id, "ai-review-user");
    assert.equal(savedReview?.review_state, "agree");
    assert.equal(obs.observationIdentifications.size, 1);
    const savedIdentification = [...obs.observationIdentifications.values()][0];
    assert.equal(savedIdentification?.actor_user_id, "ai-review-user");
    assert.equal(savedIdentification?.proposed_name, "Pieris rapae");
    assert.equal(savedIdentification?.stance, "support");
    assert.match(savedIdentification?.source_payload_json ?? "", /cloudflare_ai_judgement_agree/);
    assert.equal([...obs.outbox.values()].some((row) => row.topic === "readmodel.refresh" && row.target_id === "occ-ai-1"), true);

    const rejected = await worker.fetch(new Request("https://ikimon.life/api/v1/observation-records/occ-human-1/ai-review", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ reviewState: "agree" })
    }), productionEnv);
    assert.equal(rejected.status, 422);
    assert.equal((await rejected.json() as any).error, "not_ai_judgement_record");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(fetchCalls, 0);
  assert.equal(core.operationAudit.length, 0);
});

test("production runtime records observation disputes natively without origin fallback", async () => {
  const { env, core, obs } = createEnv();
  obs.readmodel.set("occ-1", {
    observation_id: "occ-1",
    public_cell: "34.97,138.38",
    observed_at: "2026-06-25T00:00:00.000Z",
    taxon_label: "dispute target",
    asset_count: 0,
    partition_month: "2026-06"
  });
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    PUBLIC_WRITE_MODE: "cloudflare_native",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const issueResponse = await worker.fetch(new Request("https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "dispute-user", ttlHours: 1 })
  }), productionEnv);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";
  assert.match(cookie, /^ikimon_v2_session=/);

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ ok: true, originFallback: true }), {
      status: 202,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/occ-1/disputes", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        kind: "alternative_id",
        proposedName: "ナミアゲハ",
        proposedRank: "species",
        reason: "pattern differs",
        referenceSourceIds: ["ref-2"],
        referenceLocator: "p.18"
      })
    }), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.status, 200, JSON.stringify(payload));
    assert.equal(payload.ok, true);
    assert.equal(payload.occurrenceId, "occ-1");
    assert.match(payload.disputeId, /^dispute_/);
    assert.equal(payload.compatibility.source, "cloudflare_observation_identification_disputes");
    assert.equal(payload.compatibility.alternativeIdentificationStored, true);
    assert.equal(payload.consensus.hasOpenDispute, true);
    assert.equal(obs.observationIdentificationDisputes.size, 1);
    const dispute = [...obs.observationIdentificationDisputes.values()][0];
    assert.equal(dispute?.actor_user_id, "dispute-user");
    assert.equal(dispute?.kind, "alternative_id");
    assert.equal(dispute?.proposed_name, "ナミアゲハ");
    assert.match(dispute?.source_payload_json ?? "", /ref-2/);
    assert.equal(obs.observationIdentifications.size, 1);
    const identification = [...obs.observationIdentifications.values()][0];
    assert.equal(identification?.stance, "alternative");
    assert.equal(identification?.proposed_name, "ナミアゲハ");
    assert.equal([...obs.outbox.values()].some((row) => row.topic === "readmodel.refresh" && row.target_id === "occ-1"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(fetchCalls, 0);
  assert.equal(core.operationAudit.length, 0);
});

test("production runtime resolves identification disputes natively for specialists only", async () => {
  const { env, core, obs } = createEnv();
  obs.observationIdentificationDisputes.set("dispute-1", {
    dispute_id: "dispute-1",
    occurrence_id: "occ-resolve-1",
    actor_user_id: "dispute-user",
    kind: "alternative_id",
    proposed_name: "Papilio xuthus",
    proposed_rank: "species",
    reason: "wing pattern",
    status: "open",
    source_payload_json: JSON.stringify({ source: "unit" }),
    created_at: "2026-06-25T00:00:00.000Z",
    updated_at: "2026-06-25T00:00:00.000Z"
  });
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    PUBLIC_WRITE_MODE: "cloudflare_native",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const observerIssue = await worker.fetch(new Request("https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "ordinary-user", roleName: "Observer", ttlHours: 1 })
  }), productionEnv);
  const observerCookie = observerIssue.headers.get("set-cookie") ?? "";
  const specialistIssue = await worker.fetch(new Request("https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "specialist-user", roleName: "Specialist", ttlHours: 1 })
  }), productionEnv);
  const specialistCookie = specialistIssue.headers.get("set-cookie") ?? "";
  assert.match(observerCookie, /^ikimon_v2_session=/);
  assert.match(specialistCookie, /^ikimon_v2_session=/);

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ ok: true, originFallback: true }), {
      status: 202,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  try {
    const forbidden = await worker.fetch(new Request("https://ikimon.life/api/v1/specialist/disputes/dispute-1/resolve", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: observerCookie },
      body: JSON.stringify({ resolution: "accept_alternative", note: "not allowed" })
    }), productionEnv);
    assert.equal(forbidden.status, 403);
    assert.equal((await forbidden.json() as any).error, "specialist_required");
    assert.equal(obs.observationIdentificationDisputes.get("dispute-1")?.status, "open");

    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/specialist/disputes/dispute-1/resolve", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: specialistCookie },
      body: JSON.stringify({ resolution: "accept_alternative", note: "authority accepted" })
    }), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.status, 200, JSON.stringify(payload));
    assert.equal(response.headers.get("x-ikimon-cloudflare-native"), "identification-participation-runtime");
    assert.equal(payload.ok, true);
    assert.equal(payload.occurrenceId, "occ-resolve-1");
    assert.equal(payload.resolution, "accept_alternative");
    assert.equal(payload.compatibility.source, "cloudflare_identification_participation_runtime");
    assert.equal(payload.compatibility.alternativeIdentificationStored, true);
    assert.equal(payload.consensus.identificationVerificationStatus, "authority_reviewed");
    const dispute = obs.observationIdentificationDisputes.get("dispute-1");
    assert.equal(dispute?.status, "resolved");
    assert.equal(dispute?.reason, "authority accepted");
    assert.equal(dispute?.resolved_by_user_id, "specialist-user");
    assert.match(dispute?.source_payload_json ?? "", /cloudflare_specialist_dispute_resolution/);
    assert.equal(obs.observationIdentifications.size, 1);
    const identification = [...obs.observationIdentifications.values()][0];
    assert.equal(identification?.actor_user_id, "specialist-user");
    assert.equal(identification?.proposed_name, "Papilio xuthus");
    assert.equal(identification?.stance, "support");
    assert.match(identification?.source_payload_json ?? "", /authority_backed/);
    assert.equal([...obs.outbox.values()].some((row) => row.topic === "readmodel.refresh" && row.target_id === "occ-resolve-1"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(fetchCalls, 0);
  assert.equal(core.operationAudit.length, 0);
});

test("production runtime records specialist occurrence reviews natively for specialists only", async () => {
  const { env, core, obs } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    PUBLIC_WRITE_MODE: "cloudflare_native",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const observerIssue = await worker.fetch(new Request("https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "ordinary-user", roleName: "Observer", ttlHours: 1 })
  }), productionEnv);
  const observerCookie = observerIssue.headers.get("set-cookie") ?? "";
  const specialistIssue = await worker.fetch(new Request("https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "specialist-user", roleName: "Specialist", ttlHours: 1 })
  }), productionEnv);
  const specialistCookie = specialistIssue.headers.get("set-cookie") ?? "";
  assert.match(observerCookie, /^ikimon_v2_session=/);
  assert.match(specialistCookie, /^ikimon_v2_session=/);

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ ok: true, originFallback: true }), {
      status: 202,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  try {
    const forbidden = await worker.fetch(new Request("https://ikimon.life/api/v1/specialist/occurrences/occ-specialist-1/review", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: observerCookie },
      body: JSON.stringify({ decision: "approve", proposedName: "Papilio xuthus", proposedRank: "species" })
    }), productionEnv);
    assert.equal(forbidden.status, 403);
    assert.equal((await forbidden.json() as any).error, "specialist_required");
    assert.equal(obs.observationSpecialistReviews.size, 0);

    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/specialist/occurrences/occ-specialist-1/review", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: specialistCookie },
      body: JSON.stringify({
        lane: "public-claim",
        decision: "approve",
        proposedName: "Papilio xuthus",
        proposedRank: "species",
        notes: "authority checked"
      })
    }), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.status, 200, JSON.stringify(payload));
    assert.equal(response.headers.get("x-ikimon-cloudflare-native"), "specialist-review-runtime");
    assert.equal(payload.ok, true);
    assert.equal(payload.occurrenceId, "occ-specialist-1");
    assert.equal(payload.lane, "public-claim");
    assert.equal(payload.decision, "approve");
    assert.equal(payload.compatibility.source, "cloudflare_specialist_review_runtime");
    assert.equal(payload.compatibility.reviewStored, true);
    assert.equal(payload.compatibility.identificationStored, true);
    assert.equal(payload.consensus.identificationVerificationStatus, "authority_reviewed");
    assert.equal(payload.consensus.communityTaxon.name, "Papilio xuthus");

    assert.equal(obs.observationSpecialistReviews.size, 1);
    const review = [...obs.observationSpecialistReviews.values()][0];
    assert.equal(review?.actor_user_id, "specialist-user");
    assert.equal(review?.lane, "public-claim");
    assert.equal(review?.decision, "approve");
    assert.equal(review?.proposed_name, "Papilio xuthus");
    assert.equal(review?.review_class, "authority_backed");
    assert.match(review?.source_payload_json ?? "", /cloudflare_specialist_review_runtime/);

    assert.equal(obs.observationIdentifications.size, 1);
    const identification = [...obs.observationIdentifications.values()][0];
    assert.equal(identification?.actor_user_id, "specialist-user");
    assert.equal(identification?.proposed_name, "Papilio xuthus");
    assert.equal(identification?.proposed_rank, "species");
    assert.equal(identification?.stance, "support");
    assert.match(identification?.source_payload_json ?? "", /authority_backed/);
    assert.equal([...obs.outbox.values()].some((row) => row.topic === "readmodel.refresh" && row.target_id === "occ-specialist-1"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(fetchCalls, 0);
  assert.equal(core.operationAudit.length, 0);
});

test("production specialist authority runtime manages D1 authority and recommendation flows without origin fallback", async () => {
  const { env, core, obs } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const adminToken = "authority-admin-token";
  const specialistToken = "authority-specialist-token";
  const observerToken = "authority-observer-token";
  for (const [rawToken, userId, roleName] of [
    [adminToken, "authority-admin", "Admin"],
    [specialistToken, "bird-specialist", "Specialist"],
    [observerToken, "observer-user", "Observer"]
  ] as const) {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    core.authSessions.set(tokenHash, {
      token_hash: tokenHash,
      user_id: userId,
      display_name: userId,
      role_name: roleName,
      rank_label: null,
      banned: 0,
      expires_at: "2099-01-01T00:00:00.000Z",
      last_used_at: null
    });
  }
  const adminCookie = `ikimon_v2_session=${adminToken}`;
  const specialistCookie = `ikimon_v2_session=${specialistToken}`;
  const observerCookie = `ikimon_v2_session=${observerToken}`;

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ ok: true, originFallback: true }), {
      status: 202,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  try {
    const forbidden = await worker.fetch(new Request("https://ikimon.life/api/v1/specialist/authorities/grant", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: observerCookie },
      body: JSON.stringify({ subjectUserId: "bird-specialist", scopeTaxonName: "鳥類" })
    }), productionEnv);
    assert.equal(forbidden.status, 403);

    const grant = await worker.fetch(new Request("https://ikimon.life/api/v1/specialist/authorities/grant", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({
        subjectUserId: "bird-specialist",
        scopeTaxonName: "鳥類",
        scopeTaxonRank: "class",
        reason: "field expert",
        evidence: [{ evidenceType: "field_event", title: "Bird survey mentor" }]
      })
    }), productionEnv);
    const grantPayload = await grant.json() as any;
    assert.equal(grant.headers.get("x-ikimon-cloudflare-native"), "specialist-authority-runtime");
    assert.equal(grantPayload.ok, true, JSON.stringify(grantPayload));
    assert.equal(obs.specialistAuthorities.size, 1);
    assert.equal(obs.specialistAuthorityEvidence.length, 1);

    const mine = await worker.fetch(new Request("https://ikimon.life/api/v1/specialist/me/authorities", {
      headers: { cookie: specialistCookie }
    }), productionEnv);
    const minePayload = await mine.json() as any;
    assert.equal(mine.headers.get("x-ikimon-cloudflare-native"), "specialist-authority-runtime");
    assert.equal(minePayload.hasSpecialistAccess, true);
    assert.equal(minePayload.authorities[0].scopeTaxonName, "鳥類");

    const recommendation = await worker.fetch(new Request("https://ikimon.life/api/v1/authority/recommendations", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: observerCookie },
      body: JSON.stringify({
        sourceKind: "self_claim",
        scopeTaxonName: "鳥類",
        evidence: [{ evidenceType: "webinar", title: "Intro bird ID" }]
      })
    }), productionEnv);
    const recommendationPayload = await recommendation.json() as any;
    assert.equal(recommendationPayload.ok, true, JSON.stringify(recommendationPayload));
    assert.equal(obs.authorityRecommendations.size, 1);

    const pending = await worker.fetch(new Request("https://ikimon.life/api/v1/specialist/recommendations/pending", {
      headers: { cookie: specialistCookie }
    }), productionEnv);
    const pendingPayload = await pending.json() as any;
    assert.equal(pending.headers.get("x-ikimon-cloudflare-native"), "specialist-authority-runtime");
    assert.equal(pendingPayload.recommendations.length, 1);
    assert.equal(pendingPayload.recommendations[0].subjectUserId, "observer-user");

    const grantRecommendation = await worker.fetch(new Request(`https://ikimon.life/api/v1/specialist/recommendations/${encodeURIComponent(recommendationPayload.recommendation.recommendationId)}/grant`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: specialistCookie },
      body: JSON.stringify({ resolutionNote: "scope matched" })
    }), productionEnv);
    const grantRecommendationPayload = await grantRecommendation.json() as any;
    assert.equal(grantRecommendationPayload.ok, true, JSON.stringify(grantRecommendationPayload));
    assert.equal(grantRecommendationPayload.recommendation.status, "granted");
    assert.equal(obs.authorityRecommendations.get(recommendationPayload.recommendation.recommendationId)?.status, "granted");
    assert.equal(obs.specialistAuthorities.size, 2);

    const revoke = await worker.fetch(new Request(`https://ikimon.life/api/v1/specialist/authorities/${encodeURIComponent(grantPayload.authority.authorityId)}/revoke`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ reason: "test revoke" })
    }), productionEnv);
    const revokePayload = await revoke.json() as any;
    assert.equal(revokePayload.ok, true, JSON.stringify(revokePayload));
    assert.equal(obs.specialistAuthorities.get(grantPayload.authority.authorityId)?.status, "revoked");

    const audit = await worker.fetch(new Request("https://ikimon.life/api/v1/specialist/authorities/audit", {
      headers: { cookie: adminCookie }
    }), productionEnv);
    const auditPayload = await audit.json() as any;
    assert.equal(auditPayload.audit.length >= 2, true);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(fetchCalls, 0);
  assert.equal(core.operationAudit.length, 0);
});

test("production runtime records walk sessions natively without origin fallback", async () => {
  const { env, core, obs } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    PUBLIC_WRITE_MODE: "cloudflare_native",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const issueResponse = await worker.fetch(new Request("https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "walk-user", ttlHours: 1 })
  }), productionEnv);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";
  assert.match(cookie, /^ikimon_v2_session=/);

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ ok: true, originFallback: true }), {
      status: 202,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const startResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/walk/session/start", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        externalId: "walk-ext-1",
        startedAt: `${today}T00:10:00.000Z`,
        biome: "park",
        rawPayload: { source: "unit" }
      })
    }), productionEnv);
    const startPayload = await startResponse.json() as any;
    assert.equal(startResponse.status, 201, JSON.stringify(startPayload));
    assert.equal(startResponse.headers.get("x-ikimon-cloudflare-native"), "walk-session");
    assert.deepEqual(startPayload, { walkSessionId: "walk:walk-ext-1", created: true });
    assert.equal(obs.walkSessions.size, 1);
    assert.equal(obs.walkSessions.get("walk:walk-ext-1")?.user_id, "walk-user");

    const endResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/walk/session/end", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        externalId: "walk-ext-1",
        endedAt: `${today}T00:45:00.000Z`,
        distanceM: 1280.5,
        stepCount: 1700,
        passiveDetectionCount: 4,
        topSpecies: ["シロツメクサ", "アオスジアゲハ"],
        rawPayload: { source: "unit-end" }
      })
    }), productionEnv);
    const endPayload = await endResponse.json() as any;
    assert.equal(endResponse.status, 200, JSON.stringify(endPayload));
    assert.deepEqual(endPayload, { walkSessionId: "walk:walk-ext-1" });
    const saved = obs.walkSessions.get("walk:walk-ext-1");
    assert.equal(saved?.distance_m, 1280.5);
    assert.equal(saved?.step_count, 1700);
    assert.equal(saved?.passive_detection_count, 4);
    assert.equal(saved?.top_species_json, JSON.stringify(["シロツメクサ", "アオスジアゲハ"]));

    obs.walkSessions.set("walk:other-user", {
      walk_session_id: "walk:other-user",
      external_id: "other-user",
      user_id: "other-user",
      started_at: `${today}T00:20:00.000Z`,
      ended_at: null,
      distance_m: 999,
      step_count: 999,
      passive_detection_count: 99,
      top_species_json: JSON.stringify(["対象外"]),
      biome: null,
      source: "fieldscan",
      raw_payload_json: "{}",
      created_at: `${today}T00:20:00.000Z`,
      updated_at: `${today}T00:20:00.000Z`
    });
    const summaryResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/walk/today", {
      headers: { cookie }
    }), productionEnv);
    const summaryPayload = await summaryResponse.json() as any;
    assert.equal(summaryResponse.status, 200, JSON.stringify(summaryPayload));
    assert.equal(summaryResponse.headers.get("x-ikimon-cloudflare-native"), "walk-session");
    assert.deepEqual(summaryPayload, {
      sessionCount: 1,
      totalDistanceM: 1280.5,
      totalDetections: 4,
      topSpecies: ["シロツメクサ", "アオスジアゲハ"]
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(fetchCalls, 0);
  assert.equal(core.operationAudit.length, 0);
});

test("production runtime records track upserts natively without origin fallback", async () => {
  const { env, core, obs } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    PUBLIC_WRITE_MODE: "cloudflare_native",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const issueResponse = await worker.fetch(new Request("https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "track-user", ttlHours: 1 })
  }), productionEnv);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";
  assert.match(cookie, /^ikimon_v2_session=/);

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ ok: true, originFallback: true }), {
      status: 202,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/tracks/upsert", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        sessionId: "track-ext-1",
        userId: "track-user",
        fieldId: "field-1",
        startedAt: "2026-06-27T01:00:00.000Z",
        updatedAt: "2026-06-27T01:10:00.000Z",
        distanceMeters: 420.5,
        stepCount: 680,
        municipality: "静岡市",
        prefecture: "静岡県",
        sourcePayload: { source: "unit" },
        points: [
          { latitude: 34.9751, longitude: 138.3822, accuracyMeters: 8, timestamp: "2026-06-27T01:00:00.000Z" },
          { latitude: 34.9756, longitude: 138.3831, altitudeMeters: 14, timestamp: "2026-06-27T01:04:00.000Z" }
        ]
      })
    }), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.status, 200, JSON.stringify(payload));
    assert.equal(response.headers.get("x-ikimon-cloudflare-native"), "track-upsert");
    assert.deepEqual(payload, {
      visitId: "track:track-ext-1",
      placeId: "geo:34.975:138.382",
      pointCount: 2,
      compatibility: { attempted: false, succeeded: false }
    });
    assert.equal(obs.trackSessions.size, 1);
    assert.equal(obs.trackPoints.size, 2);
    const saved = obs.trackSessions.get("track:track-ext-1");
    assert.equal(saved?.user_id, "track-user");
    assert.equal(saved?.field_id, "field-1");
    assert.equal(saved?.distance_meters, 420.5);
    assert.equal(saved?.step_count, 680);
    assert.match(saved?.source_payload_json ?? "", /track-ext-1/);

    const mismatchResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/tracks/upsert", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        sessionId: "track-ext-2",
        userId: "other-user",
        points: [{ latitude: 34.97, longitude: 138.38, timestamp: "2026-06-27T01:00:00.000Z" }]
      })
    }), productionEnv);
    assert.equal(mismatchResponse.status, 403);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(fetchCalls, 0);
  assert.equal(core.operationAudit.length, 0);
});

test("production runtime generates record reading cards natively without origin fallback", async () => {
  const { env, core, obs } = createEnv();
  obs.productionVisits.set("visit-reading-1", {
    visit_id: "visit-reading-1",
    legacy_observation_id: "legacy-reading-1",
    user_id: "reading-user",
    public_visibility: "public",
    observed_at: "2026-06-25T00:00:00.000Z"
  });
  obs.productionOccurrences.set("occ-reading-1", {
    occurrence_id: "occ-reading-1",
    visit_id: "visit-reading-1",
    scientific_name: "Trifolium repens",
    vernacular_name: "シロツメクサ",
    taxon_rank: "species",
    created_at: "2026-06-25T00:00:01.000Z"
  });
  obs.productionEvidenceAssets.push({
    asset_id: "asset-reading-1",
    visit_id: "visit-reading-1",
    occurrence_id: "occ-reading-1",
    asset_role: "observation_photo"
  });
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    PUBLIC_WRITE_MODE: "cloudflare_native",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const issueResponse = await worker.fetch(new Request("https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "reading-user", ttlHours: 1 })
  }), productionEnv);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";
  assert.match(cookie, /^ikimon_v2_session=/);

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ ok: true, originFallback: true }), {
      status: 202,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/occ-reading-1/reading-cards", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({})
    }), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.status, 200, JSON.stringify(payload));
    assert.equal(payload.ok, true);
    assert.equal(payload.reason, "eligible");
    assert.equal(payload.compatibility.source, "cloudflare_record_reading_cards");
    assert.equal(payload.cards.length, 3);
    assert.equal(payload.cards[0].visitId, "visit-reading-1");
    assert.equal(payload.cards[0].axis, "organism");
    assert.equal(payload.cards[0].sources.length, 3);
    assert.doesNotMatch(JSON.stringify(payload), /見返せる|少し厚くなる/);
    assert.equal(obs.recordReadingCards.size, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(fetchCalls, 0);
  assert.equal(core.operationAudit.length, 0);
});

test("production runtime returns monitoring package blueprints natively without origin fallback", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ ok: true, originFallback: true }), {
      status: 202,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/monitoring/packages"), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.status, 200, JSON.stringify(payload));
    assert.equal(response.headers.get("x-ikimon-cloudflare-native"), "observation-package-runtime");
    assert.equal(payload.ok, true);
    assert.equal(payload.compatibility.source, "cloudflare_observation_package_runtime");
    assert.equal(payload.schemaVersion, "monitoring_packages/v1");
    assert.ok(payload.packages.some((item: any) => item.packageId === "guided_survey"));
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(fetchCalls, 0);
  assert.equal(core.operationAudit.length, 0);
});

test("production runtime returns owner observation package from D1 without origin fallback", async () => {
  const { env, core, obs } = createEnv();
  obs.productionVisits.set("visit-package-1", {
    visit_id: "visit-package-1",
    legacy_observation_id: "legacy-package-1",
    place_id: "place-package-1",
    user_id: "package-owner",
    public_visibility: "public",
    observed_at: "2026-06-26T01:00:00.000Z",
    coordinate_uncertainty_m: 45
  });
  obs.productionOccurrences.set("occ-package-1", {
    occurrence_id: "occ-package-1",
    visit_id: "visit-package-1",
    scientific_name: "Coccinella septempunctata",
    vernacular_name: "ナナホシテントウ",
    taxon_rank: "species",
    confidence_score: 0.91,
    quality_grade: "verified",
    created_at: "2026-06-26T01:00:02.000Z"
  });
  obs.productionEvidenceAssets.push({
    asset_id: "asset-package-1",
    blob_id: "blob-package-1",
    visit_id: "visit-package-1",
    occurrence_id: "occ-package-1",
    asset_role: "observation_photo",
    captured_at: "2026-06-26T01:00:00.000Z",
    created_at: "2026-06-26T01:00:03.000Z"
  });
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    PUBLIC_WRITE_MODE: "cloudflare_native",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const issueResponse = await worker.fetch(new Request("https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "package-owner", ttlHours: 1 })
  }), productionEnv);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";
  assert.match(cookie, /^ikimon_v2_session=/);

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ ok: true, originFallback: true }), {
      status: 202,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/occ-package-1/package", {
      headers: { cookie }
    }), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.status, 200, JSON.stringify(payload));
    assert.equal(response.headers.get("x-ikimon-cloudflare-native"), "observation-package-runtime");
    assert.equal(payload.ok, true);
    assert.equal(payload.compatibility.source, "cloudflare_observation_package_runtime");
    assert.equal(payload.compatibility.aiPackageReconstruction, "not_replayed");
    assert.equal(payload.package.packageVersion, "observation_package/v1.4");
    assert.equal(payload.package.visit.visitId, "visit-package-1");
    assert.equal(payload.package.occurrences[0].occurrenceId, "occ-package-1");
    assert.equal(payload.package.occurrences[0].evidenceTier, 3);
    assert.equal(payload.package.evidenceAssets[0].assetId, "asset-package-1");
    assert.equal(payload.package.trendAbundancePolicy.claimAllowed, false);
    assert.doesNotMatch(JSON.stringify(payload.package), /exact_lat|exact_lng|latitude|longitude/);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(fetchCalls, 0);
  assert.equal(core.operationAudit.length, 0);
});

test("production runtime rejects non-owner observation package reads", async () => {
  const { env, obs } = createEnv();
  obs.productionVisits.set("visit-package-private", {
    visit_id: "visit-package-private",
    legacy_observation_id: "legacy-package-private",
    place_id: "place-package-private",
    user_id: "package-owner",
    public_visibility: "public",
    observed_at: "2026-06-26T01:00:00.000Z"
  });
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    PUBLIC_WRITE_MODE: "cloudflare_native",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const issueResponse = await worker.fetch(new Request("https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "other-user", ttlHours: 1 })
  }), productionEnv);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";
  const response = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/visit-package-private/package", {
    headers: { cookie }
  }), productionEnv);
  const payload = await response.json() as any;
  assert.equal(response.status, 403, JSON.stringify(payload));
  assert.equal(payload.error, "observation_not_owned");
});

test("production runtime allows privileged observation package read without session", async () => {
  const { env, core, obs } = createEnv();
  obs.productionVisits.set("visit-package-privileged", {
    visit_id: "visit-package-privileged",
    legacy_observation_id: "legacy-package-privileged",
    place_id: "place-package-privileged",
    user_id: "package-owner",
    public_visibility: "private",
    observed_at: "2026-06-26T01:00:00.000Z"
  });
  obs.productionOccurrences.set("occ-package-privileged", {
    occurrence_id: "occ-package-privileged",
    visit_id: "visit-package-privileged",
    scientific_name: "Pieris rapae",
    vernacular_name: "モンシロチョウ",
    taxon_rank: "species",
    confidence_score: 0.7,
    quality_grade: null,
    created_at: "2026-06-26T01:00:02.000Z"
  });
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    PUBLIC_WRITE_MODE: "cloudflare_native",
    V2_PRIVILEGED_WRITE_API_KEY: "write-key",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ ok: true, originFallback: true }), {
      status: 202,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/visit-package-privileged/package", {
      headers: { "x-ikimon-write-key": "write-key" }
    }), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.status, 200, JSON.stringify(payload));
    assert.equal(payload.ok, true);
    assert.equal(payload.package.occurrences[0].occurrenceId, "occ-package-privileged");
    assert.equal(payload.package.reviewState.currentEvidenceTier, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(fetchCalls, 0);
  assert.equal(core.operationAudit.length, 0);
});

test("production runtime hides record reading cards natively without origin fallback", async () => {
  const { env, core, obs } = createEnv();
  obs.productionVisits.set("visit-reading-hide-1", {
    visit_id: "visit-reading-hide-1",
    legacy_observation_id: "legacy-reading-hide-1",
    user_id: "reading-owner",
    public_visibility: "public",
    observed_at: "2026-06-25T00:00:00.000Z"
  });
  obs.recordReadingCards.set("reading-card-hide-1", {
    card_id: "reading-card-hide-1",
    visit_id: "visit-reading-hide-1",
    axis: "organism",
    title: "低く広がる白い花",
    body: "シロツメクサは足元の草地の状態も伝える記録です。",
    sources_json: "[]",
    visibility: "public",
    generation_condition_json: "{}",
    quality_gate_json: "{}",
    model_version: "record_reading_cards_v0_1_cloudflare",
    created_by_user_id: "reading-owner",
    created_at: "2026-06-25T00:00:01.000Z",
    updated_at: "2026-06-25T00:00:01.000Z"
  });
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    PUBLIC_WRITE_MODE: "cloudflare_native",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const issueResponse = await worker.fetch(new Request("https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "reading-owner", ttlHours: 1 })
  }), productionEnv);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";
  assert.match(cookie, /^ikimon_v2_session=/);

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ ok: true, originFallback: true }), {
      status: 202,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/record-reading-cards/reading-card-hide-1", {
      method: "DELETE",
      headers: { cookie }
    }), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.status, 200, JSON.stringify(payload));
    assert.equal(payload.ok, true);
    assert.equal(payload.hidden, true);
    assert.equal(payload.compatibility.source, "cloudflare_record_reading_cards");
    assert.equal(obs.recordReadingCards.get("reading-card-hide-1")?.visibility, "hidden");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(fetchCalls, 0);
  assert.equal(core.operationAudit.length, 0);
});

test("production runtime rejects record reading card hide from non-owner before origin fallback", async () => {
  const { env, obs } = createEnv();
  obs.productionVisits.set("visit-reading-hide-2", {
    visit_id: "visit-reading-hide-2",
    legacy_observation_id: "legacy-reading-hide-2",
    user_id: "reading-owner",
    public_visibility: "public",
    observed_at: "2026-06-25T00:00:00.000Z"
  });
  obs.recordReadingCards.set("reading-card-hide-2", {
    card_id: "reading-card-hide-2",
    visit_id: "visit-reading-hide-2",
    axis: "organism",
    title: "低く広がる白い花",
    body: "シロツメクサは足元の草地の状態も伝える記録です。",
    sources_json: "[]",
    visibility: "public",
    generation_condition_json: "{}",
    quality_gate_json: "{}",
    model_version: "record_reading_cards_v0_1_cloudflare",
    created_by_user_id: "reading-owner",
    created_at: "2026-06-25T00:00:01.000Z",
    updated_at: "2026-06-25T00:00:01.000Z"
  });
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    PUBLIC_WRITE_MODE: "cloudflare_native",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const issueResponse = await worker.fetch(new Request("https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "other-user", ttlHours: 1 })
  }), productionEnv);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ ok: true, originFallback: true }), {
      status: 202,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/record-reading-cards/reading-card-hide-2", {
      method: "DELETE",
      headers: { cookie }
    }), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.status, 404, JSON.stringify(payload));
    assert.equal(payload.ok, false);
    assert.equal(payload.error, "record_reading_card_not_found");
    assert.equal(obs.recordReadingCards.get("reading-card-hide-2")?.visibility, "public");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(fetchCalls, 0);
});

test("production runtime rejects unknown observation reaction targets before origin fallback", async () => {
  const { env, obs } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    PUBLIC_WRITE_MODE: "cloudflare_native",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const issueResponse = await worker.fetch(new Request("https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "reaction-user", ttlHours: 1 })
  }), productionEnv);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ ok: true, originFallback: true }), {
      status: 202,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/missing-occ/reactions/like", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ source: "unit" })
    }), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.status, 404);
    assert.equal(payload.error, "not_found");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(fetchCalls, 0);
  assert.equal(obs.observationReactions.size, 0);
});

test("production observation reactions fail closed when the D1 session store is unavailable", async () => {
  const { env, core, obs } = createEnv();
  obs.readmodel.set("occ-1", {
    observation_id: "occ-1",
    public_cell: "34.97,138.38",
    observed_at: "2026-06-25T00:00:00.000Z",
    taxon_label: "reaction target",
    asset_count: 0,
    partition_month: "2026-06"
  });
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    PUBLIC_WRITE_MODE: "cloudflare_native",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const issueResponse = await worker.fetch(new Request("https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "reaction-user", ttlHours: 1 })
  }), productionEnv);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";
  const brokenCore = {
    prepare(query: string) {
      if (normalize(query).startsWith("SELECT token_hash, user_id, display_name, role_name, rank_label, banned, expires_at FROM auth_sessions")) {
        throw new Error("simulated auth store unavailable");
      }
      return core.prepare(query);
    },
    batch(statements: FakeStatement[]) {
      return core.batch(statements);
    }
  };
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ ok: true, originFallback: true }), {
      status: 202,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/occ-1/reactions/like", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ source: "unit" })
    }), { ...productionEnv, CORE_DB: brokenCore });
    const payload = await response.json() as any;
    assert.equal(response.status, 503);
    assert.equal(payload.error, "auth_store_unavailable");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(fetchCalls, 0);
  assert.equal(obs.observationReactions.size, 0);
});

test("production runtime rejects invalid observation reactions before origin fallback", async () => {
  const { env, obs } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ ok: true, originFallback: true }), {
      status: 202,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/occ-1/reactions/not-real", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "unit" })
    }), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.status, 400);
    assert.equal(payload.error, "invalid_reaction_type");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(fetchCalls, 0);
  assert.equal(obs.observationReactions.size, 0);
});

test("production runtime returns 404 for unknown observation API paths without origin fallback", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ ok: true, originFallback: true }), {
      status: 202,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/example/not-real?keep=1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "ikimon_v2_session=test"
      },
      body: JSON.stringify({ source: "unit" })
    }), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.status, 404);
    assert.equal(payload.error, "not_found");
    assert.equal(fetchCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production origin fallback protects observation write paths when broad public-detail routing is enabled", async () => {
  const { env, obs } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const originalFetch = globalThis.fetch;
  const seen: { url?: string; method?: string; resolveOverride?: string; body?: string } = {};
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.url = String(input);
    seen.method = init?.method;
    seen.resolveOverride = (init as RequestInit & { cf?: { resolveOverride?: string } } | undefined)?.cf?.resolveOverride;
    seen.body = init?.body ? await new Response(init.body).text() : undefined;
    return new Response(JSON.stringify({ ok: false, error: "origin_write_auth_required" }), {
      status: 401,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  try {
    const body = {
      observationId: "must-not-write-cloudflare",
      userId: "user",
      observedAt: "2026-06-16T00:00:00.000Z",
      latitude: 34.71234,
      longitude: 137.81234
    };
    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/upsert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }), productionEnv);
    assert.equal(response.status, 401);
    assert.equal(seen.url, "https://ikimon.life/api/v1/observations/upsert");
    assert.equal(seen.method, "POST");
    assert.equal(seen.resolveOverride, "origin.ikimon.test");
    assert.equal(seen.body, JSON.stringify(body));
    assert.equal(obs.observations.has("must-not-write-cloudflare"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production public write-disabled mode blocks mutating app writes without touching origin or D1", async () => {
  const { env, obs } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "write_disabled"
  };
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/upsert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        observationId: "write-disabled-must-not-write",
        userId: "user",
        observedAt: "2026-06-16T00:00:00.000Z",
        latitude: 34.71234,
        longitude: 137.81234
      })
    }), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.status, 503);
    assert.equal(payload.error, "write_temporarily_disabled");
    assert.equal(response.headers.get("x-ikimon-cloudflare-write-mode"), "write_disabled");
    assert.equal(fallbackCalls, 0);
    assert.equal(obs.observations.has("write-disabled-must-not-write"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production public cloudflare-native mode allows explicit custom-domain app writes", async () => {
  const { env, core, obs } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  const rawOriginToken = "origin-compatible-raw-token";
  const tokenHash = createHash("sha256").update(rawOriginToken).digest("hex");
  core.authSessions.set(tokenHash, {
    token_hash: tokenHash,
    user_id: "native-public-user",
    display_name: "Native Public User",
    role_name: "Observer",
    rank_label: null,
    banned: 0,
    expires_at: "2999-01-01T00:00:00.000Z",
    last_used_at: null
  });
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const upsertResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/upsert", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `ikimon_v2_session=${rawOriginToken}` },
      body: JSON.stringify({
        observationId: "native-public-observation",
        userId: "native-public-user",
        observedAt: "2026-06-16T00:00:00.000Z",
        latitude: 34.71234,
        longitude: 137.81234,
        locationAccuracyM: 12,
        note: "native public write gate",
        taxon: { vernacularName: "native public plant", rank: "species" }
      })
    }), productionEnv);
    const upsertPayload = await upsertResponse.json() as any;
    assert.equal(upsertResponse.status, 201);
    assert.equal(upsertPayload.ok, true);
    assert.equal(fallbackCalls, 0);
    assert.equal(core.users.has("native-public-user"), true);
    assert.equal(obs.observations.get("native-public-observation")?.owner_user_id, "native-public-user");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production public cloudflare-native mode rejects unauthenticated upserts before validating payload shape", async () => {
  const { env, obs } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  const response = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/upsert", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}"
  }), productionEnv);
  const payload = await response.json() as any;
  assert.equal(response.status, 401);
  assert.equal(payload.ok, false);
  assert.equal(payload.error, "session_required");
  assert.equal(obs.observations.size, 0);
});

test("production public cloudflare-native mode rejects photo upload auth failures before origin fallback", async () => {
  const { env, obs } = createEnv();
  obs.observations.set("photo-auth-target", {
    observation_id: "photo-auth-target",
    draft_id: "draft-photo-auth-target",
    owner_user_id: "photo-owner",
    observed_at: "2026-06-16T00:00:00.000Z",
    partition_month: "2026_06",
    taxon_label: "photo auth target",
    note: null,
    exact_lat: null,
    exact_lng: null,
    location_accuracy_m: null,
    public_cell: "34.700,137.800",
    visibility: "private",
    emergency_hidden: 0,
    processing_state: "accepted"
  });
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  const issueOtherResponse = await worker.fetch(new Request("https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "other-user", ttlHours: 1 })
  }), productionEnv);
  const otherCookie = issueOtherResponse.headers.get("set-cookie") ?? "";
  assert.match(otherCookie, /^ikimon_v2_session=/);
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  const requestBody = JSON.stringify({
    filename: "photo-auth.jpg",
    mimeType: "image/jpeg",
    base64Data: Buffer.from("photo-auth-image").toString("base64"),
    facePrivacy: "no_faces"
  });
  try {
    const guestResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/photo-auth-target/photos/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: requestBody
    }), productionEnv);
    const guestPayload = await guestResponse.json() as any;
    assert.equal(guestResponse.status, 401);
    assert.equal(guestPayload.ok, false);
    assert.equal(guestPayload.error, "session_required");

    const otherResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/photo-auth-target/photos/upload", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: otherCookie },
      body: requestBody
    }), productionEnv);
    const otherPayload = await otherResponse.json() as any;
    assert.equal(otherResponse.status, 403);
    assert.equal(otherPayload.ok, false);
    assert.equal(otherPayload.error, "forbidden");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(fallbackCalls, 0);
  assert.equal(obs.assets.size, 0);
  assert.equal(obs.outbox.size, 0);
  assert.equal(obs.rollbackLedger.size, 0);
});

test("production public cloudflare-native mode lazily imports valid origin sessions", async () => {
  const { env, core, obs } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  const rawOriginToken = "origin-login-raw-token";
  const tokenHash = createHash("sha256").update(rawOriginToken).digest("hex");
  const originalFetch = globalThis.fetch;
  const seen: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const request = input instanceof Request ? input : new Request(input);
    seen.push(new URL(request.url).pathname + new URL(request.url).search);
    return Response.json({
      ok: true,
      session: {
        userId: "lazy-origin-user",
        displayName: "Lazy Origin User",
        roleName: "Observer",
        rankLabel: null,
        banned: false,
        expiresAt: "2999-01-01T00:00:00.000Z",
        tokenHash
      }
    });
  }) as typeof fetch;
  try {
    const upsertResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/upsert", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `ikimon_v2_session=${rawOriginToken}` },
      body: JSON.stringify({
        observationId: "lazy-origin-session-observation",
        userId: "lazy-origin-user",
        observedAt: "2026-06-16T00:00:00.000Z",
        latitude: 34.71234,
        longitude: 137.81234,
        taxon: { vernacularName: "lazy origin plant", rank: "species" }
      })
    }), productionEnv);
    const payload = await upsertResponse.json() as any;
    assert.equal(upsertResponse.status, 201);
    assert.equal(payload.ok, true);
    assert.deepEqual(seen, ["/api/v1/auth/session?optional=1"]);
    assert.equal(core.authSessions.get(tokenHash)?.user_id, "lazy-origin-user");
    assert.equal(obs.observations.get("lazy-origin-session-observation")?.owner_user_id, "lazy-origin-user");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production origin session import mode disabled does not probe origin sessions", async () => {
  const { env, core, obs } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native",
    ORIGIN_SESSION_IMPORT_MODE: "disabled"
  };
  const rawOriginToken = "disabled-origin-import-token";
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return Response.json({
      ok: true,
      session: {
        userId: "disabled-origin-user",
        displayName: "Disabled Origin User",
        roleName: "Observer",
        rankLabel: null,
        banned: false,
        expiresAt: "2999-01-01T00:00:00.000Z"
      }
    });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/upsert", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `ikimon_v2_session=${rawOriginToken}` },
      body: JSON.stringify({
        observationId: "disabled-origin-session-observation",
        userId: "disabled-origin-user",
        observedAt: "2026-06-16T00:00:00.000Z",
        latitude: 34.71234,
        longitude: 137.81234
      })
    }), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.status, 401);
    assert.equal(payload.error, "session_required");
    assert.equal(fallbackCalls, 0);
    assert.equal(core.authSessions.size, 0);
    assert.equal(obs.observations.has("disabled-origin-session-observation"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production public cloudflare-native mode rejects mismatched origin session hashes", async () => {
  const { env, core, obs } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  const rawOriginToken = "origin-login-mismatch-token";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({
    ok: true,
    session: {
      userId: "mismatch-origin-user",
      displayName: "Mismatch Origin User",
      roleName: "Observer",
      rankLabel: null,
      banned: false,
      expiresAt: "2999-01-01T00:00:00.000Z",
      tokenHash: "not-the-cookie-token-hash"
    }
  })) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/upsert", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `ikimon_v2_session=${rawOriginToken}` },
      body: JSON.stringify({
        observationId: "mismatch-origin-session-observation",
        userId: "mismatch-origin-user",
        observedAt: "2026-06-16T00:00:00.000Z",
        latitude: 34.71234,
        longitude: 137.81234
      })
    }), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.status, 401);
    assert.equal(payload.error, "session_required");
    assert.equal(core.authSessions.size, 0);
    assert.equal(obs.observations.has("mismatch-origin-session-observation"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production public cloudflare-native mode rejects custom-domain session issue", async () => {
  const { env } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };

  const response = await worker.fetch(new Request("https://ikimon.life/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userId: "must-not-issue-public-session",
      ttlHours: 1
    })
  }), productionEnv);
  const payload = await response.json() as any;
  assert.equal(response.status, 404);
  assert.equal(payload.error, "not_available");
});

test("production oauth start keeps original provider redirect contracts without changing public UI", async () => {
  const { env } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native",
    GOOGLE_CLIENT_ID: "google-client",
    GOOGLE_CLIENT_SECRET: "google-secret",
    TWITTER_CLIENT_ID: "twitter-client",
    TWITTER_CLIENT_SECRET: "twitter-secret",
    V2_OAUTH_STATE_SECRET: "state-secret"
  };

  const google = await worker.fetch(new Request("https://ikimon.life/auth/oauth/google/start?redirect=/record"), productionEnv);
  assert.equal(google.status, 303);
  assert.match(google.headers.get("set-cookie") ?? "", /^ikimon_oauth_state=/);
  const googleLocation = new URL(google.headers.get("location") ?? "");
  assert.equal(googleLocation.origin + googleLocation.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(googleLocation.searchParams.get("client_id"), "google-client");
  assert.equal(googleLocation.searchParams.get("redirect_uri"), "https://ikimon.life/oauth_callback.php?provider=google");
  assert.equal(googleLocation.searchParams.get("scope"), "openid email profile");
  assert.equal(googleLocation.searchParams.get("prompt"), "select_account");

  const twitter = await worker.fetch(new Request("https://ikimon.life/auth/oauth/twitter/start?redirect=/map"), productionEnv);
  assert.equal(twitter.status, 303);
  assert.match(twitter.headers.get("set-cookie") ?? "", /^ikimon_oauth_state=/);
  const twitterLocation = new URL(twitter.headers.get("location") ?? "");
  assert.equal(twitterLocation.origin + twitterLocation.pathname, "https://twitter.com/i/oauth2/authorize");
  assert.equal(twitterLocation.searchParams.get("client_id"), "twitter-client");
  assert.equal(twitterLocation.searchParams.get("redirect_uri"), "https://ikimon.life/auth/oauth/twitter/callback");
  assert.equal(twitterLocation.searchParams.get("scope"), "tweet.read users.read offline.access");
  assert.equal(twitterLocation.searchParams.get("code_challenge_method"), "S256");
  assert.ok(twitterLocation.searchParams.get("code_challenge"));
});

test("production oauth callback creates Cloudflare-native session from provider profile", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native",
    GOOGLE_CLIENT_ID: "google-client",
    GOOGLE_CLIENT_SECRET: "google-secret",
    V2_OAUTH_STATE_SECRET: "state-secret"
  };

  const start = await worker.fetch(new Request("https://ikimon.life/auth/oauth/google/start?redirect=/record"), productionEnv);
  const stateCookie = start.headers.get("set-cookie") ?? "";
  const state = new URL(start.headers.get("location") ?? "").searchParams.get("state");
  assert.ok(state);

  const originalFetch = globalThis.fetch;
  const seen: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    seen.push(url);
    if (url === "https://oauth2.googleapis.com/token") {
      assert.equal(init?.method, "POST");
      const body = String(init?.body ?? "");
      assert.match(body, /client_id=google-client/);
      assert.match(body, /client_secret=google-secret/);
      assert.match(body, /redirect_uri=https%3A%2F%2Fikimon.life%2Foauth_callback.php%3Fprovider%3Dgoogle/);
      return Response.json({ access_token: "google-access-token" });
    }
    if (url === "https://www.googleapis.com/oauth2/v2/userinfo") {
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer google-access-token");
      return Response.json({
        id: "google-user-1",
        name: "Google User",
        email: "google-user@example.test",
        picture: "https://example.test/avatar.png"
      });
    }
    return new Response("unexpected fetch", { status: 599 });
  }) as typeof fetch;

  try {
    const callback = await worker.fetch(new Request(`https://ikimon.life/oauth_callback.php?provider=google&state=${encodeURIComponent(state)}&code=oauth-code`, {
      headers: { cookie: stateCookie }
    }), productionEnv);
    assert.equal(callback.status, 303);
    assert.equal(callback.headers.get("location"), "/record");
    const callbackCookie = callback.headers.get("set-cookie") ?? "";
    assert.match(callbackCookie, /ikimon_v2_session=/);
    assert.match(callbackCookie, /ikimon_oauth_state=;/);
    assert.deepEqual(seen, ["https://oauth2.googleapis.com/token", "https://www.googleapis.com/oauth2/v2/userinfo"]);
    const oauthAccount = core.oauthAccounts.get("google:google-user-1");
    assert.ok(oauthAccount?.user_id);
    assert.equal(core.users.has(oauthAccount.user_id), true);
    assert.equal(oauthAccount?.display_name, "Google User");
    assert.equal(oauthAccount?.provider_email, "google-user@example.test");
    assert.equal(core.authSessions.size, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production oauth start fails closed when provider secrets are not configured", async () => {
  const { env } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  let calledOrigin = false;
  const logs: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calledOrigin = true;
    return new Response(null, { status: 303, headers: { location: "https://accounts.google.com/o/oauth2/v2/auth?origin=1" } });
  }) as typeof fetch;
  console.error = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/auth/oauth/google/start?redirect=/record"), productionEnv);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/login?error=oauth");
    assert.equal(calledOrigin, false);
    assert.deepEqual(logs.map((entry) => JSON.parse(entry)), [{
      message: "oauth_provider_config_missing",
      provider: "google",
      phase: "start"
    }]);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});

test("production oauth callback fails closed when provider secrets are not configured", async () => {
  const { env } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  let calledOrigin = false;
  const logs: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calledOrigin = true;
    return new Response(null, { status: 303, headers: { location: "https://ikimon.life/login.php?origin=1" } });
  }) as typeof fetch;
  console.error = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/oauth_callback.php?provider=google&state=missing-config&code=oauth-code"), productionEnv);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/login?error=oauth");
    assert.match(response.headers.get("set-cookie") ?? "", /ikimon_oauth_state=;/);
    assert.equal(calledOrigin, false);
    assert.deepEqual(logs.map((entry) => JSON.parse(entry)), [{
      message: "oauth_provider_config_missing",
      provider: "google",
      phase: "callback"
    }]);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});

test("production public UI routes avoid origin fallback while broad custom-domain fallback is disabled", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native",
    PUBLIC_CUSTOM_DOMAIN_ORIGIN_FALLBACK_MODE: "disabled"
  };
  const originalFetch = globalThis.fetch;
  const seen: Array<{ url: string; method?: string; resolveOverride?: string; reason?: string | null }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push({
      url: String(input),
      method: init?.method,
      resolveOverride: (init as RequestInit & { cf?: { resolveOverride?: string } } | undefined)?.cf?.resolveOverride,
      reason: new Headers(init?.headers).get("x-ikimon-cloudflare-fallback-reason")
    });
    return new Response("<!doctype html><title>origin UI</title><meta name=\"x-origin-ui\" content=\"1\">", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" }
    });
  }) as typeof fetch;
  try {
    const publicUiRoutes = [
      "/",
      "/record",
      "/map",
      "/login",
      "/community/fields/535cccb1-c3d1-4a35-ab9f-2ed811f5abb5"
    ];
    for (const path of publicUiRoutes) {
      const response = await worker.fetch(new Request(`https://ikimon.life${path}`), productionEnv);
      assert.equal(response.status, 404, path);
      assert.deepEqual(await response.json(), { ok: false, error: "html_not_materialized" }, path);
      assert.equal(seen.length, 0, path);
    }

    assert.equal(core.operationAudit.length, 0);

    const place = await worker.fetch(new Request("https://ikimon.life/places/hamamatsu"), productionEnv);
    const placeBody = await place.text();
    assert.equal(place.status, 200);
    assert.equal(place.headers.get("x-ikimon-cloudflare-native"), "place-guide-list");
    assert.equal(placeBody.includes("浜松のガイド地点"), true);
    assert.equal(placeBody.includes("浜松地域遺産認定制度"), true);
    assert.equal(placeBody.includes("34.831"), false);
    assert.equal(placeBody.includes("137.72"), false);
    assert.equal(seen.length, 0);

    const localizedPlace = await worker.fetch(new Request("https://ikimon.life/ja/places/hamamatsu"), productionEnv);
    assert.equal(localizedPlace.status, 200);
    assert.equal(localizedPlace.headers.get("x-ikimon-cloudflare-native"), "place-guide-list");
    assert.equal(seen.length, 0);

    const placeSnapshot = await worker.fetch(new Request("https://ikimon.life/places/hamamatsu/snapshot"), productionEnv);
    assert.equal(placeSnapshot.status, 404);
    assert.deepEqual(await placeSnapshot.json(), { ok: false, error: "html_not_materialized" });
    assert.equal(seen.length, 0);

    const unknownPlace = await worker.fetch(new Request("https://ikimon.life/places/unknown-slug"), productionEnv);
    assert.equal(unknownPlace.status, 404);
    assert.equal(unknownPlace.headers.get("x-ikimon-cloudflare-native"), "not-found");
    assert.equal(seen.length, 0);

    const unknown = await worker.fetch(new Request("https://ikimon.life/some-old-unmapped-path"), productionEnv);
    assert.equal(unknown.status, 404);
    assert.equal(unknown.headers.get("x-ikimon-cloudflare-native"), "not-found");
    assert.equal(seen.length, 0);

    const localizedUnknown = await worker.fetch(new Request("https://ikimon.life/ja/some-old-unmapped-path"), productionEnv);
    assert.equal(localizedUnknown.status, 404);
    assert.equal(localizedUnknown.headers.get("x-ikimon-cloudflare-native"), "not-found");
    assert.equal(seen.length, 0);

    const eventPost = await worker.fetch(new Request("https://ikimon.life/es/community/events/new", {
      method: "POST",
      body: "title=origin",
      headers: { "content-type": "application/x-www-form-urlencoded" }
    }), productionEnv);
    assert.equal(eventPost.status, 404);
    assert.equal(seen.length, 0);
    assert.equal(eventPost.headers.get("x-ikimon-cloudflare-materialized"), null);

    const eventApiPost = await worker.fetch(new Request("https://ikimon.life/api/v1/observation-events", {
      method: "POST",
      body: JSON.stringify({ title: "origin event", started_at: "2026-06-25T10:00" }),
      headers: { "content-type": "application/json" }
    }), productionEnv);
    assert.equal(eventApiPost.status, 401);
    assert.deepEqual(await eventApiPost.json(), { error: "login required" });
    assert.equal(seen.length, 0);

    const eventCreatePage = await worker.fetch(new Request("https://ikimon.life/es/community/events/new"), productionEnv);
    assert.equal(eventCreatePage.status, 200);
    assert.equal(eventCreatePage.headers.get("x-ikimon-cloudflare-native"), "event-page-create");
    assert.match(await eventCreatePage.text(), /Worker\/D1 runtime/);
    assert.equal(seen.length, 0);

    const eventAreaSuggestion = await worker.fetch(new Request("https://ikimon.life/api/v1/observation-events/area-suggestions", {
      method: "POST",
      body: JSON.stringify({ center: { lat: 34.97, lng: 138.38 } }),
      headers: { "content-type": "application/json" }
    }), productionEnv);
    assert.equal(eventAreaSuggestion.status, 401);
    assert.deepEqual(await eventAreaSuggestion.json(), { error: "login required" });
    assert.equal(seen.length, 0);

    const internal = await worker.fetch(new Request("https://ikimon.life/internal/production-import-summary"), productionEnv);
    assert.equal(internal.status, 404);
    assert.equal(seen.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production observation event APIs run location and rally routes on D1 without origin fallback", async () => {
  const { env, obs } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native",
    PUBLIC_CUSTOM_DOMAIN_ORIGIN_FALLBACK_MODE: "disabled",
    ORIGIN_SESSION_IMPORT_MODE: "disabled"
  };
  const issueResponse = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "event-organizer", displayName: "Event Organizer", ttlHours: 1 })
  }), env);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";
  const otherIssueResponse = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "not-organizer", displayName: "Not Organizer", ttlHours: 1 })
  }), env);
  const otherCookie = otherIssueResponse.headers.get("set-cookie") ?? "";
  const originalFetch = globalThis.fetch;
  const seen: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    seen.push(String(input));
    return Response.json({ ok: true, origin: true });
  }) as typeof fetch;
  try {
    const create = await worker.fetch(new Request("https://ikimon.life/api/v1/observation-events", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        title: "D1観察会",
        event_code: "d1-core-event",
        plan: "public",
        started_at: "2026-06-25T10:00:00.000Z",
        location_lat: 34.9756,
        location_lng: 138.3828,
        target_species: ["セミ"]
      })
    }), productionEnv);
    assert.equal(create.status, 201);
    const created = await create.json() as any;
    assert.equal(created.title, "D1観察会");
    assert.equal(created.organizerUserId, "event-organizer");

    const byCode = await worker.fetch(new Request("https://ikimon.life/api/v1/observation-events/by-code/d1-core-event"), productionEnv);
    const byCodePayload = await byCode.json() as any;
    assert.equal(byCode.status, 200);
    assert.equal(byCodePayload.session.sessionId, created.sessionId);

    const eventListPage = await worker.fetch(new Request("https://ikimon.life/community/events"), productionEnv);
    const eventListPageText = await eventListPage.text();
    assert.equal(eventListPage.status, 200);
    assert.equal(eventListPage.headers.get("x-ikimon-cloudflare-native"), "event-page-list");
    assert.match(eventListPageText, /D1観察会/);

    const eventJoinPage = await worker.fetch(new Request("https://ikimon.life/community/events/d1-core-event/join"), productionEnv);
    const eventJoinPageText = await eventJoinPage.text();
    assert.equal(eventJoinPage.status, 200);
    assert.equal(eventJoinPage.headers.get("x-ikimon-cloudflare-native"), "event-page-join");
    assert.match(eventJoinPageText, /D1観察会/);

    const team = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/teams`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "水辺チーム", color: "#00897b", target_taxa: ["セミ"] })
    }), productionEnv);
    assert.equal(team.status, 201);
    const teamPayload = await team.json() as any;
    assert.equal(teamPayload.team.name, "水辺チーム");

    const checkin = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/checkin`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ guest_token: "guest-core-1", display_name: "Guest", team_id: teamPayload.team.team_id, is_minor: false, share_location: true })
    }), productionEnv);
    assert.equal(checkin.status, 200);
    const checkinPayload = await checkin.json() as any;
    assert.ok(checkinPayload.participant_id);

    const absence = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/absences`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ guest_token: "guest-core-1", searched_taxon: "セミ", lat: 34.97564, lng: 138.38284, effort_seconds: 120 })
    }), productionEnv);
    assert.equal(absence.status, 201);
    assert.equal(obs.observationEventAbsences[0]?.public_lat, 34.976);
    assert.equal(obs.observationEventAbsences[0]?.public_lng, 138.383);

    const eventObservation = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/upsert", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        observationId: "obs-event-dualwrite-1",
        userId: "event-organizer",
        observedAt: "2026-06-25T10:08:00.000Z",
        latitude: 34.97564,
        longitude: 138.38284,
        locationAccuracyM: 8,
        municipality: "静岡市",
        prefecture: "静岡県",
        taxon: { vernacularName: "セミ", scientificName: "Graptopsaltria nigrofuscata" },
        eventSessionId: created.sessionId,
        teamId: teamPayload.team.team_id,
        participantRole: "organizer_record"
      })
    }), productionEnv);
    const eventObservationPayload = await eventObservation.json() as any;
    assert.equal(eventObservation.status, 201, JSON.stringify(eventObservationPayload));
    assert.equal(eventObservationPayload.compatibility.attempted, false);
    const dualWriteEvent = obs.observationEventLiveEvents.find((event) => event.type === "observation_added");
    assert.ok(dualWriteEvent);
    assert.equal(dualWriteEvent?.actor_user_id, "event-organizer");
    assert.equal(dualWriteEvent?.team_id, teamPayload.team.team_id);
    const dualWritePayload = JSON.parse(dualWriteEvent?.payload_json ?? "{}") as Record<string, unknown>;
    assert.equal(dualWritePayload.taxon_name, "セミ");
    assert.equal(dualWritePayload.public_lat, 34.976);
    assert.equal(dualWritePayload.public_lng, 138.383);
    assert.equal(dualWritePayload.exact_location_stored, false);
    assert.equal("exact_lat" in dualWritePayload, false);
    assert.equal("exact_lng" in dualWritePayload, false);
    assert.equal(obs.observationEventQuests.size, 1);
    assert.equal(obs.observationEventLiveEvents.some((event) => event.type === "quest_offered"), true);

    const nonOrganizerRun = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/quests/run`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: otherCookie },
      body: JSON.stringify({ trigger: "manual" })
    }), productionEnv);
    assert.equal(nonOrganizerRun.status, 403);
    assert.equal(obs.observationEventQuests.size, 1);

    const manualQuestRun = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/quests/run`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ trigger: "manual" })
    }), productionEnv);
    const manualQuestRunPayload = await manualQuestRun.json() as any;
    assert.equal(manualQuestRun.status, 200, JSON.stringify(manualQuestRunPayload));
    assert.equal(manualQuestRunPayload.modelUsed, "cloudflare-d1-static-quest");
    assert.equal(manualQuestRunPayload.trigger, "manual");
    assert.equal(manualQuestRunPayload.quests > 0, true);
    assert.equal(obs.observationEventQuests.size > 1, true);

    const questId = [...obs.observationEventQuests.keys()][0] ?? "";
    for (const decision of ["accepted", "declined", "completed"]) {
      const decisionResponse = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/quests/${questId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ decision })
      }), productionEnv);
      const decisionPayload = await decisionResponse.json() as any;
      assert.equal(decisionResponse.status, 200, JSON.stringify(decisionPayload));
      assert.equal(obs.observationEventQuests.get(questId)?.status, decision);
      assert.equal(obs.observationEventLiveEvents.some((event) => event.type === `quest_${decision}`), true);
    }

    const eventLivePage = await worker.fetch(new Request(`https://ikimon.life/events/${created.sessionId}/live`), productionEnv);
    const eventLivePageText = await eventLivePage.text();
    assert.equal(eventLivePage.status, 200);
    assert.equal(eventLivePage.headers.get("x-ikimon-cloudflare-native"), "event-page-live");
    assert.match(eventLivePageText, /quest_offered/);

    const forbiddenConsolePage = await worker.fetch(new Request(`https://ikimon.life/events/${created.sessionId}/console`, {
      headers: { cookie: otherCookie }
    }), productionEnv);
    assert.equal(forbiddenConsolePage.status, 403);
    assert.equal(forbiddenConsolePage.headers.get("x-ikimon-cloudflare-native"), "event-page-forbidden");

    const organizerConsolePage = await worker.fetch(new Request(`https://ikimon.life/events/${created.sessionId}/console`, {
      headers: { cookie }
    }), productionEnv);
    const organizerConsolePageText = await organizerConsolePage.text();
    assert.equal(organizerConsolePage.status, 200);
    assert.equal(organizerConsolePage.headers.get("x-ikimon-cloudflare-native"), "event-page-console");
    assert.match(organizerConsolePageText, /person-hours/);

    const beforeScheduledQuests = obs.observationEventQuests.size;
    const waitUntil: Promise<unknown>[] = [];
    await worker.scheduled?.({ cron: "*/5 * * * *" }, productionEnv, { waitUntil: (promise) => waitUntil.push(promise) });
    await Promise.all(waitUntil);
    assert.equal(obs.observationEventQuests.size > beforeScheduledQuests, true);
    assert.equal([...obs.observationEventQuests.values()].some((row) => {
      const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
      return payload.trigger === "interval" && payload.generated_by === "cloudflare-d1-static-quest";
    }), true);

    const recent = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/recent?guest_token=guest-core-1`), productionEnv);
    const recentPayload = await recent.json() as any;
    assert.equal(recent.status, 200);
    assert.equal(recentPayload.events.some((event: any) => event.type === "absence_recorded"), true);
    assert.equal(recentPayload.events.some((event: any) => event.type === "observation_added"), true);

    const effort = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/effort`), productionEnv);
    const effortPayload = await effort.json() as any;
    assert.equal(effort.status, 200);
    assert.equal(effortPayload.effort.totalAbsences, 1);
    assert.equal(effortPayload.effort.totalObservations, 1);

    const recap = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/recap?guest_token=guest-core-1`), productionEnv);
    const recapPayload = await recap.json() as any;
    assert.equal(recap.status, 200);
    assert.equal(recapPayload.highlights.observationCount, 1);
    assert.equal(recapPayload.highlights.absencesCount, 1);
    assert.equal(recapPayload.highlights.topTaxa[0].name, "セミ");
    assert.equal(recapPayload.teams[0].name, "水辺チーム");
    assert.equal(recapPayload.teams[0].observationsCount, 1);
    assert.equal(recapPayload.timeline.some((event: any) => event.type === "observation_added"), true);

    const byCodeRecap = await worker.fetch(new Request("https://ikimon.life/api/v1/observation-events/by-code/d1-core-event/recap"), productionEnv);
    const byCodeRecapPayload = await byCodeRecap.json() as any;
    assert.equal(byCodeRecap.status, 200);
    assert.equal(byCodeRecapPayload.session.sessionId, created.sessionId);

    const speciesCsv = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/species.csv`), productionEnv);
    const speciesCsvText = await speciesCsv.text();
    assert.equal(speciesCsv.status, 200);
    assert.match(speciesCsvText, /taxon_name/);
    assert.match(speciesCsvText, /セミ/);
    assert.doesNotMatch(speciesCsvText, /34\.97564/);
    assert.doesNotMatch(speciesCsvText, /138\.38284/);

    const missingCapsule = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/capsule`), productionEnv);
    assert.equal(missingCapsule.status, 404);

    const generateCapsule = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/capsule/generate`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ useAi: false })
    }), productionEnv);
    const generateCapsulePayload = await generateCapsule.json() as any;
    assert.equal(generateCapsule.status, 201);
    assert.equal(generateCapsulePayload.capsule.sourceCounts.observations, 1);
    assert.equal(generateCapsulePayload.capsule.privacyRiskQueue.some((risk: any) => risk.riskType === "exact_location"), false);

    const publicCapsuleBeforeApproval = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/capsule`), productionEnv);
    assert.equal(publicCapsuleBeforeApproval.status, 403);

    const publicReview = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/capsule/review`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ reviewStatus: "approved_public" })
    }), productionEnv);
    assert.equal(publicReview.status, 200);

    const privateReview = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/capsule/review`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ reviewStatus: "approved_private" })
    }), productionEnv);
    const privateReviewPayload = await privateReview.json() as any;
    assert.equal(privateReview.status, 200);
    assert.equal(privateReviewPayload.capsule.reviewStatus, "approved_private");

    const live = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/live?guest_token=guest-core-1`), productionEnv);
    assert.equal(live.status, 200);
    assert.equal(live.headers.get("content-type"), "text/event-stream; charset=utf-8");
    assert.equal(live.headers.get("x-ikimon-observation-event-live-mode"), "snapshot-only");
    assert.match(await live.text(), /event: snapshot/);

    const areaSuggestion = await worker.fetch(new Request("https://ikimon.life/api/v1/observation-events/area-suggestions", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ center: { lat: 34.97564, lng: 138.38284 }, radius_m: 300, place_label: "静岡駅" })
    }), productionEnv);
    assert.equal(areaSuggestion.status, 200);
    const areaPayload = await areaSuggestion.json() as any;
    assert.equal(areaPayload.provider, "fallback");
    assert.equal(areaPayload.compatibility.source, "cloudflare_d1_native");
    assert.deepEqual(areaPayload.suggestions.map((suggestion: any) => suggestion.id), ["facility", "safe_walk", "nature_rich"]);
    assert.equal(seen.length, 0);

    const location = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/location`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ guest_token: "guest-core-1", lat: 34.97564, lng: 138.38284, visit_seconds: 30 })
    }), productionEnv);
    assert.equal(location.status, 200);
    const locationPayload = await location.json() as any;
    assert.equal(locationPayload.event.payload.public_lat, 34.976);
    assert.equal(locationPayload.event.payload.public_lng, 138.383);
    assert.equal(locationPayload.event.payload.exact_location_stored, false);
    assert.equal("lat" in locationPayload.event.payload, false);
    assert.equal("lng" in locationPayload.event.payload, false);

    const guestRecentAfterLocation = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/recent?guest_token=guest-core-1`), productionEnv);
    const guestRecentAfterLocationPayload = await guestRecentAfterLocation.json() as any;
    assert.equal(guestRecentAfterLocation.status, 200);
    assert.equal(guestRecentAfterLocationPayload.events.some((event: any) => event.type === "participant_location_ping"), false);

    const organizerRecentAfterLocation = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/recent`, {
      headers: { cookie }
    }), productionEnv);
    const organizerRecentAfterLocationPayload = await organizerRecentAfterLocation.json() as any;
    assert.equal(organizerRecentAfterLocation.status, 200);
    assert.equal(organizerRecentAfterLocationPayload.events.some((event: any) => event.type === "participant_location_ping"), true);

    const course = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/rally/course`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ title: "ゆるい観察ラリー", status: "live", config: { routeStrictness: "loose" } })
    }), productionEnv);
    assert.equal(course.status, 200);

    const forbiddenStation = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/rally/stations`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: otherCookie },
      body: JSON.stringify({ name: "他人の地点" })
    }), productionEnv);
    assert.equal(forbiddenStation.status, 403);

    const station = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/rally/stations`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "水辺", lat: 34.976, lng: 138.383, radius_m: 120, route_geojson: { type: "LineString", coordinates: [[138.382, 34.975], [138.383, 34.976]] } })
    }), productionEnv);
    assert.equal(station.status, 201);
    const stationPayload = await station.json() as any;

    const mission = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/rally/missions`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ station_id: stationPayload.station.stationId, scope: "team", location_binding: "near_route", title: "水辺で見つける", target: "水辺のいきもの", goal_count: 2, status: "published" })
    }), productionEnv);
    assert.equal(mission.status, 201);
    const missionPayload = await mission.json() as any;

    const submission = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/rally/submissions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ guest_token: "guest-core-1", mission_id: missionPayload.mission.missionId, station_id: stationPayload.station.stationId, count_value: 3, lat: 34.97564, lng: 138.38284 })
    }), productionEnv);
    assert.equal(submission.status, 201);

    const rally = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/rally`), productionEnv);
    assert.equal(rally.status, 200);
    const rallyPayload = await rally.json() as any;
    assert.equal(rallyPayload.rally.course.title, "ゆるい観察ラリー");
    assert.equal(rallyPayload.rally.stations.length, 1);
    assert.equal(rallyPayload.rally.missions.length, 1);
    assert.equal(rallyPayload.rally.progress[0].percent, 150);
    assert.equal(rallyPayload.rally.progress[0].status, "exceeded");

    const liveEventCountBeforeUnauthorized = obs.observationEventLiveEvents.length;
    const unauthorizedObservation = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/upsert", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: otherCookie },
      body: JSON.stringify({
        observationId: "obs-event-dualwrite-unauthorized",
        userId: "not-organizer",
        observedAt: "2026-06-25T10:18:00.000Z",
        latitude: 34.97564,
        longitude: 138.38284,
        municipality: "静岡市",
        prefecture: "静岡県",
        taxon: { vernacularName: "チョウ" },
        eventSessionId: created.sessionId,
        teamId: teamPayload.team.team_id
      })
    }), productionEnv);
    assert.equal(unauthorizedObservation.status, 201);
    assert.equal(obs.observationEventLiveEvents.length, liveEventCountBeforeUnauthorized);

    const fieldScanObservation = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/upsert", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        observationId: "obs-event-dualwrite-fieldscan-1",
        userId: "event-organizer",
        observedAt: "2026-06-25T10:22:00.000Z",
        latitude: 34.97564,
        longitude: 138.38284,
        municipality: "静岡市",
        prefecture: "静岡県",
        fieldScan: {
          scanMode: "sound",
          confidence: 0.76,
          labels: ["鳥", "水音"],
          exact_lat: 34.97564,
          exact_lng: 138.38284,
          nested: { lat: 34.97564, lng: 138.38284 }
        },
        eventSessionId: created.sessionId,
        teamId: teamPayload.team.team_id
      })
    }), productionEnv);
    assert.equal(fieldScanObservation.status, 201);
    const fieldScanEvent = obs.observationEventLiveEvents.find((event) => event.type === "field_scan_added");
    assert.ok(fieldScanEvent);
    const fieldScanPayload = JSON.parse(fieldScanEvent?.payload_json ?? "{}") as Record<string, unknown>;
    assert.deepEqual(fieldScanPayload.field_scan, { scan_mode: "sound", confidence: 0.76, labels: ["鳥", "水音"] });
    assert.doesNotMatch(JSON.stringify(fieldScanPayload), /34\.97564|138\.38284|exact_lat|exact_lng|nested/);
    assert.deepEqual(seen, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function withMockedSentinelFetch<T>(run: () => Promise<T>): Promise<T> {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/search")) {
      return new Response(JSON.stringify({
        features: [{
          id: "S2A_TEST_SCENE",
          collection: "sentinel-2-l2a",
          properties: { datetime: "2026-06-20T01:23:45Z", "eo:cloud_cover": 8 },
          assets: { visual: { href: "https://example.test/sentinel/visual.tif" } },
          links: [{ rel: "self", href: "https://example.test/stac/S2A_TEST_SCENE" }]
        }]
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/item/statistics")) {
      const isNdwi = url.includes("B03-B08");
      return new Response(JSON.stringify({
        properties: {
          statistics: {
            expression: isNdwi ? { mean: -0.2, max: 0.1 } : { mean: 0.42, max: 0.71 }
          }
        }
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("not mocked", { status: 404 });
  }) as typeof fetch;
  return run().finally(() => {
    globalThis.fetch = previousFetch;
  });
}

function seedSentinelField(obs: FakeD1, fieldId = "field-sentinel-1"): void {
  obs.productionFieldDetails.set(fieldId, {
    field_id: fieldId,
    source: "nature_symbiosis_site",
    admin_level: null,
    name: "Sentinel Field",
    name_kana: null,
    summary: null,
    prefecture: "静岡県",
    city: "浜松市",
    public_cell: `cell-${fieldId}`,
    public_lat: 34.7,
    public_lng: 137.7,
    radius_m: 400,
    area_ha: null,
    has_polygon: 0,
    has_simplified_geometry: 0,
    certification_id: null,
    certification_url: null,
    official_url: null,
    owner_url: null,
    story_url: null,
    verification_level: "public",
    verification_method: null,
    verification_label: null,
    source_confidence: 0.9,
    valid_from: null,
    valid_to: null,
    entity_key: null,
    updated_at: "2026-06-20T00:00:00.000Z"
  });
}

test("internal sentinel environment run writes D1 source and place environment snapshots", async () => {
  const { env, obs } = createEnv();
  seedSentinelField(obs);

  await withMockedSentinelFetch(async () => {
    const response = await worker.fetch(new Request("https://worker.test/internal/sentinel-environment/run?limit=1", {
      method: "POST",
      headers: { authorization: `Bearer ${INTERNAL_AUTH_TOKEN}` }
    }), env);
    assert.equal(response.status, 200);
    const payload = await response.json() as { written: number; scanned: number; missed: number; failed: number };
    assert.equal(payload.scanned, 1);
    assert.equal(payload.written, 3);
    assert.equal(payload.missed, 0);
    assert.equal(payload.failed, 0);
  });

  assert.equal(obs.sourceSnapshots.size, 1);
  assert.equal(obs.placeEnvironmentSnapshots.size, 3);
  assert.equal([...obs.placeEnvironmentSnapshots.values()].some((row) => row.place_id === "field-sentinel-1" && row.metric_kind === "ndvi_mean" && row.metric_value === 0.42), true);
  assert.equal([...obs.placeEnvironmentSnapshots.values()].some((row) => row.metric_kind === "water_pct" && row.metric_value === 40), true);
});

test("scheduled cron runs sentinel environment snapshots alongside other scheduled work", async () => {
  const { env, obs } = createEnv();
  env.MPC_STAC_API_URL = "https://mpc.example.test/stac";
  env.MPC_DATA_API_URL = "https://mpc.example.test/data";
  seedSentinelField(obs, "field-scheduled-sentinel");
  const waits: Promise<unknown>[] = [];

  await withMockedSentinelFetch(async () => {
    await worker.scheduled({ cron: "*/5 * * * *" }, env, { waitUntil: (promise) => waits.push(promise) });
    await Promise.all(waits);
  });

  assert.equal(obs.placeEnvironmentSnapshots.size, 3);
  assert.equal(obs.sourceSnapshots.size, 1);
});

test("production map area polygons filter D1 geometry without origin fallback", async () => {
  const { env, core } = createEnv();
  env.OBS_DB.productionAreaPolygons.set("native-school", productionAreaPolygonRow("native-school", {
    name: "native polygon school",
    source: "school",
    geometry_json: JSON.stringify({
      type: "Polygon",
      coordinates: [[[137.1, 34.1], [137.2, 34.1], [137.2, 34.2], [137.1, 34.1]]]
    })
  }));
  env.OBS_DB.productionAreaPolygons.set("native-approx-school", productionAreaPolygonRow("native-approx-school", {
    name: "代表点小学校",
    source: "school",
    approximate_boundary: 1,
    boundary_approximation: "point_buffer",
    verification_label: "境界未確認・代表点からの仮範囲 / 学校台帳と一致",
    source_confidence: 0.45
  }));
  env.OBS_DB.productionAreaPolygons.set("osm-live-school", productionAreaPolygonRow("osm-live:way:603994619", {
    field_id: "osm-live:way:603994619",
    name: "OSMの学校・キャンパス",
    source: "school",
    verification_label: "未確認",
    source_confidence: 0.45,
    official_url: null
  }));
  env.OBS_DB.productionAreaPolygons.set("osm-live-park", productionAreaPolygonRow("osm-live:way:603028580", {
    field_id: "osm-live:way:603028580",
    name: "OSMの公園・緑地",
    source: "osm_park",
    admin_level: "osm_park",
    verification_label: "未確認",
    source_confidence: 0.45,
    official_url: null
  }));
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request(
      "https://ikimon.life/api/v1/map/area-polygons?bbox=137.65%2C34.66%2C137.76%2C34.73&zoom=14&sources=school%2Cosm_park"
    ), productionEnv);
    const payload = await response.json() as any;

    assert.equal(response.status, 200);
    assert.equal(payload.features.length, 1);
    assert.equal(payload.features[0].properties.name, "native polygon school");
    assert.equal(payload.features[0].geometry.coordinates[0].length, 4);
    assert.equal(payload.stats.totalReturned, 1);
    assert.equal(payload.stats.totalAll, 1);
    assert.equal(payload.stats.source, "cloudflare_area_polygon_readmodel");
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);

    const localizedResponse = await worker.fetch(new Request(
      "https://ikimon.life/ja/api/v1/map/area-polygons?bbox=137.65%2C34.66%2C137.76%2C34.73&zoom=14&sources=school%2Cosm_park"
    ), productionEnv);
    const localizedPayload = await localizedResponse.json() as any;
    assert.equal(localizedResponse.status, 200);
    assert.equal(localizedPayload.features.length, 1);
    assert.equal(localizedPayload.features[0].properties.name, "native polygon school");
    assert.equal(localizedPayload.stats.totalReturned, 1);
    assert.equal(localizedPayload.stats.totalAll, 1);
    assert.equal(fallbackCalls, 0);
    assert.doesNotMatch(JSON.stringify(localizedPayload), /native-approx-school|OSMの学校・キャンパス|OSMの公園・緑地|境界未確認/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production map area polygons use native polygon readmodel without origin fallback", async () => {
  const { env } = createEnv();
  env.OBS_DB.productionAreaPolygons.set("native-approx-school", {
    field_id: "native-approx-school",
    source: "school",
    admin_level: "school",
    name: "代表点だけの小学校",
    prefecture: "静岡県",
    city: "浜松市",
    center_lat: 34.694,
    center_lng: 137.704,
    bbox_min_lat: 34.69,
    bbox_max_lat: 34.70,
    bbox_min_lng: 137.70,
    bbox_max_lng: 137.71,
    area_ha: 0.5,
    geometry_json: JSON.stringify({
      type: "Polygon",
      coordinates: [[
        [137.700, 34.690],
        [137.708, 34.690],
        [137.708, 34.698],
        [137.700, 34.698],
        [137.700, 34.690]
      ]]
    }),
    approximate_boundary: 1,
    boundary_approximation: "point_buffer",
    source_confidence: 0.35,
    verification_level: "registry_matched",
    verification_label: "境界未確認・代表点からの仮範囲 / 学校台帳と一致",
    official_url: "https://example.test/approx-school",
    owner_url: null,
    story_url: null,
    certification_url: null,
    entity_key: "school:approx",
    updated_at: "2026-06-18T00:00:00.000Z"
  });
  env.OBS_DB.productionAreaPolygons.set("native-school", {
    field_id: "native-school",
    source: "school",
    admin_level: "school",
    name: "ネイティブポリゴン小学校",
    prefecture: "静岡県",
    city: "浜松市",
    center_lat: 34.695,
    center_lng: 137.705,
    bbox_min_lat: 34.69,
    bbox_max_lat: 34.70,
    bbox_min_lng: 137.70,
    bbox_max_lng: 137.71,
    area_ha: 1.1,
    geometry_json: JSON.stringify({
      type: "Polygon",
      coordinates: [[
        [137.700, 34.690],
        [137.710, 34.691],
        [137.709, 34.699],
        [137.701, 34.700],
        [137.700, 34.690]
      ]]
    }),
    approximate_boundary: 0,
    boundary_approximation: null,
    source_confidence: 0.9,
    verification_level: "registry_matched",
    verification_label: "公開情報と一致",
    official_url: "https://example.test/native-school",
    owner_url: null,
    story_url: null,
    certification_url: null,
    entity_key: "school:native",
    updated_at: "2026-06-18T00:00:00.000Z"
  });
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request(
      "https://ikimon.life/api/v1/map/area-polygons?bbox=137.65%2C34.66%2C137.76%2C34.73&zoom=14&sources=school%2Cosm_park"
    ), productionEnv);
    const payload = await response.json() as any;

    assert.equal(response.status, 200);
    assert.equal(fallbackCalls, 0);
    assert.equal(payload.stats.source, "cloudflare_area_polygon_readmodel");
    assert.equal(payload.features.length, 1);
    assert.equal(payload.features[0].properties.field_id, "native-school");
    assert.doesNotMatch(JSON.stringify(payload), /native-approx-school|境界未確認/);
    assert.equal(payload.features[0].geometry.coordinates[0].length, 5);
    assert.deepEqual(payload.features[0].properties.center, [137.705, 34.695]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production map area polygons return available native features when requested school polygons are missing", async () => {
  const { env } = createEnv();
  env.OBS_DB.productionAreaPolygons.set("native-park-only", productionAreaPolygonRow("native-park-only", {
    source: "osm_park",
    admin_level: "osm_park",
    name: "ネイティブ公園",
    source_confidence: 0.8,
    verification_level: "unverified",
    verification_label: "未確認",
    official_url: null
  }));
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request(
      "https://ikimon.life/api/v1/map/area-polygons?bbox=137.65%2C34.66%2C137.76%2C34.73&zoom=14&sources=school%2Cosm_park"
    ), productionEnv);
    const payload = await response.json() as any;

    assert.equal(response.status, 200);
    assert.equal(fallbackCalls, 0);
    assert.equal(payload.features.length, 1);
    assert.equal(payload.features[0].properties.field_id, "native-park-only");
    assert.equal(payload.stats.source, "cloudflare_area_polygon_readmodel");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production UI KPI events stay native before public custom-domain origin fallback", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/ui-kpi/events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://ikimon.life",
        "sec-fetch-site": "same-origin"
      },
      body: JSON.stringify({ eventName: "map_area_detail_open", pagePath: "/map" })
    }), productionEnv);
    const payload = await response.json() as any;

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.compatibility.source, "cloudflare_compat_noop");
    assert.match(payload.eventId, /^cf-ui-kpi-/);
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production area snapshot serves materialized original UI payloads from R2 without origin fallback", async () => {
  const { env, core } = createEnv();
  const fieldId = "535cccb1-c3d1-4a35-ab9f-2ed811f5abb5";
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  await env.ASSET_BUCKET.put(`original-ui/area-snapshots/${fieldId}.json`, JSON.stringify({
    snapshot: {
      field: { fieldId, name: "千葉県 東金市" },
      observationSummary: { totalObservations: 0 },
      areaWatch: { schemaVersion: "area_watch/v0", score: 1 }
    }
  }), { httpMetadata: { contentType: "application/json; charset=utf-8" } });

  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request(`https://ikimon.life/api/v1/fields/${fieldId}/area-snapshot`), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.status, 200);
    assert.equal(payload.snapshot.field.fieldId, fieldId);
    assert.equal(payload.snapshot.areaWatch.schemaVersion, "area_watch/v0");
    assert.equal(response.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-area-snapshot");
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production area snapshot uses D1 field detail readmodel when not materialized without origin fallback", async () => {
  const { env, obs, core } = createEnv();
  const fieldId = "535cccb1-c3d1-4a35-ab9f-2ed811f5abb5";
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  obs.productionFieldDetails.set(fieldId, {
    field_id: fieldId,
    source: "nature_symbiosis_site",
    admin_level: null,
    name: "春のビオトープ",
    name_kana: null,
    summary: "公開フィールドの概要",
    prefecture: "静岡県",
    city: "静岡市",
    public_cell: "35.01,138.38",
    public_lat: 35.01,
    public_lng: 138.38,
    radius_m: 200,
    area_ha: 0.8,
    has_polygon: 1,
    has_simplified_geometry: 1,
    certification_id: "site-001",
    certification_url: "https://example.test/cert",
    official_url: "https://example.test/field",
    owner_url: "",
    story_url: "",
    verification_level: "registry_matched",
    verification_method: "public_registry",
    verification_label: "認定情報と一致",
    source_confidence: 0.95,
    valid_from: "",
    valid_to: "",
    entity_key: "",
    updated_at: "2026-06-26T00:00:00.000Z"
  });
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request(`https://ikimon.life/api/v1/fields/${fieldId}/area-snapshot?viewer=1`), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-ikimon-cloudflare-native"), "area-snapshot-field-detail-readmodel");
    assert.equal(payload.snapshot.field.fieldId, fieldId);
    assert.equal(payload.snapshot.field.name, "春のビオトープ");
    assert.equal(payload.snapshot.field.locationLabel, "静岡県 静岡市");
    assert.equal(payload.snapshot.observationSummary.totalObservations, 0);
    assert.equal(payload.snapshot.areaWatch.schemaVersion, "area_watch/v0");
    assert.equal(payload.snapshot.privacy.exactLocationExposed, false);
    assert.equal(payload.snapshot.compatibility.source, "cloudflare_field_detail_readmodel_lightweight_area_snapshot");
    assert.equal(payload.snapshot.source, undefined);
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production observation field registry runtime creates lists updates and checks conflicts in D1", async () => {
  const { env, obs, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  obs.productionFieldDetails.set("certified-near-field", {
    field_id: "certified-near-field",
    source: "nature_symbiosis_site",
    admin_level: null,
    name: "認定ビオトープ",
    name_kana: null,
    summary: "公開フィールド",
    prefecture: "静岡県",
    city: "静岡市",
    public_cell: "35.01,138.38",
    public_lat: 35.01,
    public_lng: 138.38,
    radius_m: 200,
    area_ha: 0.8,
    has_polygon: 1,
    has_simplified_geometry: 1,
    certification_id: "certified-near-field",
    certification_url: "",
    official_url: "",
    owner_url: "",
    story_url: "",
    verification_level: "registry_matched",
    verification_method: "public_registry",
    verification_label: "認定情報と一致",
    source_confidence: 0.95,
    valid_from: "",
    valid_to: "",
    entity_key: "",
    updated_at: "2026-06-27T00:00:00.000Z"
  });

  const issue = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "field-owner", displayName: "Field Owner", roleName: "Observer", ttlHours: 1 })
  }), env);
  const cookie = issue.headers.get("set-cookie") ?? "";
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const unauth = await worker.fetch(new Request("https://ikimon.life/api/v1/fields", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "未ログイン", lat: 35.02, lng: 138.39 })
    }), productionEnv);
    assert.equal(unauth.status, 401);

    const conflict = await worker.fetch(new Request("https://ikimon.life/api/v1/fields/conflicts", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "認定ビオトープ", lat: 35.0105, lng: 138.3805, radius_m: 1000 })
    }), productionEnv);
    const conflictPayload = await conflict.json() as any;
    assert.equal(conflict.status, 200);
    assert.equal(conflictPayload.conflicts[0].field.fieldId, "certified-near-field");

    const create = await worker.fetch(new Request("https://ikimon.life/api/v1/fields", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        name: "自分の小さな調査地",
        prefecture: "静岡県",
        city: "静岡市",
        lat: 35.2,
        lng: 138.5,
        radius_m: 300
      })
    }), productionEnv);
    const createPayload = await create.json() as any;
    assert.equal(create.status, 201);
    assert.equal(create.headers.get("x-ikimon-cloudflare-native"), "observation-field-registry-runtime");
    assert.equal(createPayload.field.name, "自分の小さな調査地");
    assert.equal(createPayload.field.ownerUserId, "field-owner");
    assert.equal(obs.userObservationFields.size, 1);
    const fieldId = createPayload.field.fieldId;

    const mine = await worker.fetch(new Request("https://ikimon.life/api/v1/fields?mine=1", {
      headers: { cookie }
    }), productionEnv);
    const minePayload = await mine.json() as any;
    assert.equal(mine.status, 200);
    assert.equal(minePayload.fields.length, 1);
    assert.equal(minePayload.fields[0].fieldId, fieldId);

    const patch = await worker.fetch(new Request(`https://ikimon.life/api/v1/fields/${encodeURIComponent(fieldId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "更新した調査地", radius_m: 450 })
    }), productionEnv);
    const patchPayload = await patch.json() as any;
    assert.equal(patch.status, 200);
    assert.equal(patchPayload.field.name, "更新した調査地");
    assert.equal(patchPayload.field.radiusM, 450);

    const list = await worker.fetch(new Request("https://ikimon.life/api/v1/fields?q=%E8%AA%8D%E5%AE%9A&limit=5"), productionEnv);
    const listPayload = await list.json() as any;
    assert.equal(list.status, 200);
    assert.equal(listPayload.fields[0].fieldId, "certified-near-field");

    const prefectures = await worker.fetch(new Request("https://ikimon.life/api/v1/fields/prefectures"), productionEnv);
    const prefecturesPayload = await prefectures.json() as any;
    assert.equal(prefectures.status, 200);
    assert.equal(prefecturesPayload.prefectures[0].prefecture, "静岡県");

    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("field manager runtime grants list and revokes D1 roles for admin sessions only", async () => {
  const { env, obs } = createEnv();
  const fieldId = "field-manager-runtime-1";
  obs.productionFieldDetails.set(fieldId, {
    field_id: fieldId,
    source: "nature_symbiosis_site",
    admin_level: null,
    name: "管理者テストフィールド",
    name_kana: null,
    summary: "field manager runtime test",
    prefecture: "静岡県",
    city: "静岡市",
    public_cell: "35.01,138.38",
    public_lat: 35.01,
    public_lng: 138.38,
    radius_m: 200,
    area_ha: 0.8,
    has_polygon: 1,
    has_simplified_geometry: 1,
    certification_id: "site-manager-001",
    certification_url: "",
    official_url: "",
    owner_url: "",
    story_url: "",
    verification_level: "registry_matched",
    verification_method: "public_registry",
    verification_label: "認定情報と一致",
    source_confidence: 0.95,
    valid_from: "",
    valid_to: "",
    entity_key: "",
    updated_at: "2026-06-27T00:00:00.000Z"
  });

  const userIssue = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "ordinary-user", roleName: "Observer", ttlHours: 1 })
  }), env);
  const userCookie = userIssue.headers.get("set-cookie") ?? "";
  const forbidden = await worker.fetch(new Request(`https://shadow.test/api/v1/fields/${fieldId}/managers`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: userCookie },
    body: JSON.stringify({ user_id: "viewer-user", role: "viewer_exact" })
  }), env);
  assert.equal(forbidden.status, 403);
  assert.equal(obs.fieldManagers.size, 0);

  const adminIssue = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "admin-user", displayName: "Admin User", roleName: "Admin", ttlHours: 1 })
  }), env);
  const adminCookie = adminIssue.headers.get("set-cookie") ?? "";
  const grant = await worker.fetch(new Request(`https://shadow.test/api/v1/fields/${fieldId}/managers`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: JSON.stringify({ user_id: "viewer-user", role: "viewer_exact", note: "research collaboration" })
  }), env);
  const grantPayload = await grant.json() as any;
  assert.equal(grant.status, 200);
  assert.equal(grant.headers.get("x-ikimon-cloudflare-native"), "field-manager-runtime");
  assert.equal(grantPayload.grant.fieldId, fieldId);
  assert.equal(grantPayload.grant.userId, "viewer-user");
  assert.equal(grantPayload.grant.role, "viewer_exact");
  assert.equal(grantPayload.grant.grantedBy, "admin-user");

  const list = await worker.fetch(new Request(`https://shadow.test/api/v1/fields/${fieldId}/managers`, {
    headers: { cookie: adminCookie }
  }), env);
  const listPayload = await list.json() as any;
  assert.equal(list.status, 200);
  assert.equal(listPayload.managers.length, 1);
  assert.equal(listPayload.managers[0].note, "research collaboration");

  const revoke = await worker.fetch(new Request(`https://shadow.test/api/v1/fields/${fieldId}/managers/viewer-user/viewer_exact`, {
    method: "DELETE",
    headers: { cookie: adminCookie }
  }), env);
  assert.equal(revoke.status, 200);
  assert.equal(obs.fieldManagers.size, 0);
});

test("field manager D1 role is reflected in area snapshot viewer context without origin fallback", async () => {
  const { env, obs, core } = createEnv();
  const fieldId = "field-manager-viewer-snapshot-1";
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  obs.productionFieldDetails.set(fieldId, {
    field_id: fieldId,
    source: "nature_symbiosis_site",
    admin_level: null,
    name: "閲覧者権限テストフィールド",
    name_kana: null,
    summary: "viewer context test",
    prefecture: "静岡県",
    city: "静岡市",
    public_cell: "35.01,138.38",
    public_lat: 35.01,
    public_lng: 138.38,
    radius_m: 200,
    area_ha: 0.8,
    has_polygon: 1,
    has_simplified_geometry: 1,
    certification_id: "site-viewer-001",
    certification_url: "",
    official_url: "",
    owner_url: "",
    story_url: "",
    verification_level: "registry_matched",
    verification_method: "public_registry",
    verification_label: "認定情報と一致",
    source_confidence: 0.95,
    valid_from: "",
    valid_to: "",
    entity_key: "",
    updated_at: "2026-06-27T00:00:00.000Z"
  });
  obs.fieldManagers.set(`${fieldId}:viewer-user:viewer_exact`, {
    manager_id: "grant-viewer",
    field_id: fieldId,
    user_id: "viewer-user",
    role: "viewer_exact",
    granted_at: "2026-06-27T00:00:00.000Z",
    granted_by: "admin-user",
    expires_at: null,
    note: "",
    updated_at: "2026-06-27T00:00:00.000Z"
  });
  const issue = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "viewer-user", displayName: "Viewer User", roleName: "Observer", ttlHours: 1 })
  }), env);
  const cookie = issue.headers.get("set-cookie") ?? "";
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request(`https://ikimon.life/api/v1/fields/${fieldId}/area-snapshot`, {
      headers: { cookie }
    }), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.status, 200);
    assert.equal(payload.snapshot.viewer.userId, "viewer-user");
    assert.equal(payload.snapshot.viewer.fieldRole, "viewer_exact");
    assert.equal(payload.snapshot.sensitiveMasking.viewerCanSeeExact, true);
    assert.equal(payload.snapshot.privacy.exactLocationExposed, false);
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production fixed point station page is D1-native without origin fallback", async () => {
  const { env, obs, core } = createEnv();
  const fieldId = "fixed-field-1";
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  obs.productionFieldDetails.set(fieldId, {
    field_id: fieldId,
    source: "nature_symbiosis_site",
    admin_level: null,
    name: "谷津山の観察地点",
    name_kana: null,
    summary: "公開フィールドの概要",
    prefecture: "静岡県",
    city: "静岡市",
    public_cell: "34.98,138.39",
    public_lat: 34.98,
    public_lng: 138.39,
    radius_m: 200,
    area_ha: 0.8,
    has_polygon: 1,
    has_simplified_geometry: 1,
    certification_id: "site-fixed-001",
    certification_url: "",
    official_url: "",
    owner_url: "",
    story_url: "",
    verification_level: "registry_matched",
    verification_method: "public_registry",
    verification_label: "認定情報と一致",
    source_confidence: 0.95,
    valid_from: "",
    valid_to: "",
    entity_key: "",
    updated_at: "2026-06-26T00:00:00.000Z"
  });
  obs.productionVisits.set("visit-fixed-2026", {
    visit_id: "visit-fixed-2026",
    legacy_observation_id: null,
    place_id: fieldId,
    user_id: "observer-1",
    public_visibility: "public",
    observed_at: "2026-06-20T09:00:00.000Z"
  });
  obs.productionVisits.set("visit-fixed-private", {
    visit_id: "visit-fixed-private",
    legacy_observation_id: null,
    place_id: fieldId,
    user_id: "observer-1",
    public_visibility: "private",
    observed_at: "2026-06-21T09:00:00.000Z"
  });
  obs.productionOccurrences.set("occ-fixed-1", {
    occurrence_id: "occ-fixed-1",
    visit_id: "visit-fixed-2026",
    scientific_name: "Butorides striata",
    vernacular_name: "ササゴイ",
    taxon_rank: "species",
    created_at: "2026-06-20T09:01:00.000Z"
  });
  obs.productionEvidenceAssets.push({
    asset_id: "asset-fixed-1",
    visit_id: "visit-fixed-2026",
    occurrence_id: "occ-fixed-1",
    asset_role: "observation_photo",
    legacy_relative_path: null
  });
  obs.stewardshipActions.set("action-fixed-1", {
    action_id: "action-fixed-1",
    place_id: fieldId,
    occurred_at: "2026-06-22T08:00:00.000Z",
    action_kind: "cleanup",
    actor_user_id: "observer-1",
    linked_visit_id: "visit-fixed-2026",
    description: "水辺のごみを拾った",
    species_status: null,
    metadata_json: "{}"
  });

  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request(`https://ikimon.life/places/${fieldId}/station`), productionEnv);
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-ikimon-cloudflare-native"), "fixed-point-station-readmodel");
    assert.match(body, /谷津山の観察地点/);
    assert.match(body, /ササゴイ/);
    assert.match(body, /水辺のごみを拾った/);
    assert.doesNotMatch(body, /visit-fixed-private/);
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production area snapshot returns 404 when neither R2 nor D1 readmodel has the field without origin fallback", async () => {
  const { env, core } = createEnv();
  const fieldId = "535cccb1-c3d1-4a35-ab9f-2ed811f5abb5";
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request(`https://ikimon.life/api/v1/fields/${fieldId}/area-snapshot?viewer=1`), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.status, 404);
    assert.equal(payload.ok, false);
    assert.equal(payload.error, "area_snapshot_not_materialized");
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production area snapshot marks school readmodel rows as permission required without exposing geometry", async () => {
  const { env, obs, core } = createEnv();
  const fieldId = "school-public-field-1";
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  obs.productionFieldDetails.set(fieldId, {
    field_id: fieldId,
    source: "school",
    admin_level: "school",
    name: "春の里小学校",
    name_kana: null,
    summary: "公開範囲だけで観察する学校フィールド",
    prefecture: "静岡県",
    city: "静岡市",
    public_cell: "35.02,138.40",
    public_lat: 35.02,
    public_lng: 138.40,
    radius_m: 200,
    area_ha: 1.2,
    has_polygon: 1,
    has_simplified_geometry: 1,
    certification_id: null,
    certification_url: null,
    official_url: "",
    owner_url: "",
    story_url: "",
    verification_level: "registry_matched",
    verification_method: "public_registry",
    verification_label: "公開情報と一致",
    source_confidence: 0.9,
    valid_from: "",
    valid_to: "",
    entity_key: "",
    updated_at: "2026-06-26T00:00:00.000Z"
  });
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request(`https://ikimon.life/api/v1/fields/${fieldId}/area-snapshot`), productionEnv);
    const payload = await response.json() as any;
    const text = JSON.stringify(payload);
    assert.equal(response.status, 200);
    assert.equal(payload.snapshot.field.sourceLabel, "学校・教育施設");
    assert.equal(payload.snapshot.field.accessGuidance.status, "permission_required");
    assert.equal(payload.snapshot.privacy.geometryExposed, false);
    assert.equal(text.includes("geom_simplified"), false);
    assert.equal(text.includes("polygon"), false);
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production original UI static assets serve materialized bytes from R2 without origin fallback", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  await env.ASSET_BUCKET.put("original-ui/static/assets/brand/app-icon-192.png", "png-bytes", {
    httpMetadata: { contentType: "image/png" }
  });
  await env.ASSET_BUCKET.put("original-ui/static/sitemap.xml", "<urlset></urlset>", {
    httpMetadata: { contentType: "application/xml; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/static/app-sw.js", "const VERSION = 'ikimon-app-v2';", {
    httpMetadata: { contentType: "application/javascript; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/static/offline.html", "<!doctype html><title>offline</title>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/static/manifest.webmanifest", "{\"name\":\"ikimon\"}", {
    httpMetadata: { contentType: "application/manifest+json; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/static/assets/img/invasive/invasive-plant-thumb.webp", "webp-bytes", {
    httpMetadata: { contentType: "image/webp" }
  });

  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/assets/brand/app-icon-192.png"), productionEnv);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "png-bytes");
    assert.equal(response.headers.get("content-type"), "image/png");
    assert.equal(response.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-static-asset");

    const sitemap = await worker.fetch(new Request("https://ikimon.life/sitemap.xml"), productionEnv);
    assert.equal(sitemap.status, 200);
    assert.equal(await sitemap.text(), "<urlset></urlset>");
    assert.equal(sitemap.headers.get("content-type"), "application/xml; charset=utf-8");
    assert.equal(sitemap.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-static-asset");

    const appSw = await worker.fetch(new Request("https://ikimon.life/app-sw.js"), productionEnv);
    assert.equal(appSw.status, 200);
    assert.equal(await appSw.text(), "const VERSION = 'ikimon-app-v2';");
    assert.equal(appSw.headers.get("content-type"), "application/javascript; charset=utf-8");
    assert.equal(appSw.headers.get("cache-control"), "no-cache, no-store, must-revalidate");
    assert.equal(appSw.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-static-asset");

    const offline = await worker.fetch(new Request("https://ikimon.life/offline.html"), productionEnv);
    assert.equal(offline.status, 200);
    assert.equal(await offline.text(), "<!doctype html><title>offline</title>");
    assert.equal(offline.headers.get("cache-control"), "no-cache, no-store, must-revalidate");
    assert.equal(offline.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-static-asset");

    const manifest = await worker.fetch(new Request("https://ikimon.life/manifest.webmanifest"), productionEnv);
    assert.equal(manifest.status, 200);
    assert.equal(await manifest.text(), "{\"name\":\"ikimon\"}");
    assert.equal(manifest.headers.get("content-type"), "application/manifest+json; charset=utf-8");
    assert.equal(manifest.headers.get("cache-control"), "public, max-age=300");
    assert.equal(manifest.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-static-asset");

    const invasive = await worker.fetch(new Request("https://ikimon.life/assets/img/invasive/invasive-plant-thumb.webp"), productionEnv);
    assert.equal(invasive.status, 200);
    assert.equal(await invasive.text(), "webp-bytes");
    assert.equal(invasive.headers.get("content-type"), "image/webp");
    assert.equal(invasive.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-static-asset");

    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production original UI static asset misses return 404 without origin fallback", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/assets/brand/missing-icon.png?v=1"), productionEnv);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { ok: false, error: "static_asset_not_materialized" });
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production original UI thumbnails serve materialized bytes from R2 without origin fallback", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  await env.ASSET_BUCKET.put("original-ui/thumb/md/v2-observations/record-1/photo.jpg", "jpg-bytes", {
    httpMetadata: { contentType: "image/jpeg" }
  });

  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/thumb/md/v2-observations/record-1/photo.jpg"), productionEnv);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "jpg-bytes");
    assert.equal(response.headers.get("content-type"), "image/jpeg");
    assert.equal(response.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-thumb");
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production legacy observation thumbnails resolve to public derivatives without origin fallback", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  env.OBS_DB.assets.set("asset-legacy-thumb", {
    asset_id: "asset-legacy-thumb",
    draft_id: "draft-legacy-thumb",
    observation_id: "record-legacy-thumb",
    owner_user_id: "legacy-user",
    object_key: "original/import/record-legacy-thumb/photo-legacy.jpg",
    partition_month: "2026-06",
    sha256: "legacy-thumb-sha",
    mime: "image/jpeg",
    bytes: 1234,
    processing_state: "uploaded",
    public_derivative_key: "derived/import/20260615/observation_photo/asset-legacy-thumb/display.webp",
    public_derivative_sha256: "legacy-thumb-derivative-sha",
    public_derivative_verified_at: "2026-06-15T00:00:00.000Z",
    public_derivative_metadata_json: "{\"gpsExifPresent\":false}",
    exif_scrub_state: "scrubbed",
    public_ready_at: "2026-06-15T00:00:00.000Z"
  });
  env.OBS_DB.productionEvidenceAssets.push({
    asset_id: "asset-legacy-thumb",
    visit_id: "record-legacy-thumb",
    asset_role: "observation_photo",
    legacy_relative_path: "uploads/v2-observations/record-legacy-thumb/photo-legacy.jpg"
  });
  await env.ASSET_BUCKET.put("derived/import/20260615/observation_photo/asset-legacy-thumb/display.webp", "webp-bytes", {
    httpMetadata: { contentType: "image/webp" }
  });
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("origin should not be used", { status: 500 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/thumb/md/v2-observations/record-legacy-thumb/photo-legacy.jpg?size=md"), productionEnv);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "webp-bytes");
    assert.equal(response.headers.get("content-type"), "image/webp");
    assert.equal(response.headers.get("x-ikimon-cloudflare-native"), "thumb-derivative-readmodel");
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production original UI thumbnail misses return 404 without origin fallback", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("origin should not be used", { status: 500 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/thumb/md/v2-observations/record-secret/photo-secret.jpg?size=md"), productionEnv);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { ok: false, error: "thumb_not_materialized" });
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production original UI html serves materialized anonymous pages from R2 without origin fallback", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  await env.ASSET_BUCKET.put("original-ui/html/root.html", "<!doctype html><title>ikimon / 生きものを手がかりに、この場所の今を残す</title><script>ikimon-app-outbox-v1</script>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/demo/place-feeling-tags.html", "<!doctype html><title>ひとことタグ デモ</title><main>実データではありません</main>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/ja/demo/place-feeling-tags.html", "<!doctype html><title>ひとことタグ デモ</title><main>place_feeling_tags</main>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });

  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/"), productionEnv);
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.equal(body.includes("ikimon-app-outbox-v1"), true);
    assert.equal(body.includes("data-cloudflare-public-shell"), false);
    assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
    assert.equal(response.headers.get("cache-control"), "no-store, no-cache, must-revalidate, proxy-revalidate");
    assert.equal(response.headers.get("pragma"), "no-cache");
    assert.equal(response.headers.get("expires"), "0");
    assert.equal(response.headers.get("vary"), "cookie, authorization");
    assert.equal(response.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");
    const demo = await worker.fetch(new Request("https://ikimon.life/demo/place-feeling-tags"), productionEnv);
    assert.equal(demo.status, 200);
    assert.match(await demo.text(), /実データではありません/);
    assert.equal(demo.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");

    const jaDemo = await worker.fetch(new Request("https://ikimon.life/ja/demo/place-feeling-tags"), productionEnv);
    assert.equal(jaDemo.status, 200);
    assert.match(await jaDemo.text(), /place_feeling_tags/);
    assert.equal(jaDemo.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production original UI html serves localized auth and guest profile shells from R2", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  await env.ASSET_BUCKET.put("original-ui/html/en/login.html", "<!doctype html><title>Log in | ikimon</title><h1>Log in to My page</h1>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/en/profile.html", "<!doctype html><title>My page | ikimon</title><a href=\"/en/login?redirect=%2Fprofile\">Log in</a>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/en/records.html", "<!doctype html><title>Records | ikimon</title><script>beforeinstallprompt</script>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });

  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const queryLogin = await worker.fetch(new Request("https://ikimon.life/login?redirect=/profile&lang=en"), productionEnv);
    assert.equal(queryLogin.status, 200);
    assert.equal(await queryLogin.text(), "<!doctype html><title>Log in | ikimon</title><h1>Log in to My page</h1>");
    assert.equal(queryLogin.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");

    const prefixedLogin = await worker.fetch(new Request("https://ikimon.life/en/login?redirect=/profile"), productionEnv);
    assert.equal(prefixedLogin.status, 200);
    assert.equal(await prefixedLogin.text(), "<!doctype html><title>Log in | ikimon</title><h1>Log in to My page</h1>");
    assert.equal(prefixedLogin.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");

    const queryProfile = await worker.fetch(new Request("https://ikimon.life/profile?lang=en"), productionEnv);
    assert.equal(queryProfile.status, 200);
    assert.match(await queryProfile.text(), /\/en\/login\?redirect=%2Fprofile/);
    assert.equal(queryProfile.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");

    const queryRecords = await worker.fetch(new Request("https://ikimon.life/records?lang=en"), productionEnv);
    assert.equal(queryRecords.status, 200);
    const queryRecordsBody = await queryRecords.text();
    assert.match(queryRecordsBody, /Records \| ikimon/);
    assert.match(queryRecordsBody, /data-cloudflare-records-live/);
    assert.match(queryRecordsBody, /No recent public records yet/);
    assert.match(queryRecordsBody, /beforeinstallprompt/);
    assert.equal(queryRecords.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");

    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production home collapses materialized header actions into a hamburger menu", async () => {
  const { env } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  await env.ASSET_BUCKET.put("original-ui/html/ja.html", [
    "<!doctype html><head></head><body>",
    "<header class=\"site-header site-header-minimal\"><div class=\"site-header-inner\">",
    "<a class=\"brand\" href=\"/ja/\">ikimon</a>",
    "<div class=\"site-header-actions site-header-actions-desktop\"><a class=\"site-record-link\" href=\"/ja/record\">記録する</a><a class=\"site-login-link\" href=\"/ja/login?redirect=%2Fprofile\">ログイン</a></div>",
    "<div class=\"site-header-actions site-header-actions-mobile\"><a class=\"site-record-link\" href=\"/ja/record\">記録する</a><a class=\"site-login-link\" href=\"/ja/login?redirect=%2Fprofile\">ログイン</a></div>",
    "</div></header><main>home</main></body>"
  ].join(""), { httpMetadata: { contentType: "text/html; charset=utf-8" } });

  const response = await worker.fetch(new Request("https://ikimon.life/ja/"), productionEnv);
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.match(body, /data-cloudflare-header-menu/);
  assert.match(body, /aria-label="メニュー"/);
  assert.match(body, /site-header-actions-desktop,.site-header \.site-header-actions-mobile\{display:none!important\}/);
  assert.match(body, /href="\/ja\/record"/);
  assert.match(body, /href="\/ja\/login\?redirect=%2Fprofile"/);
  assert.match(body, /href="\/ja\/records"/);
  assert.match(body, /href="\/ja\/map"/);
  assert.match(body, /href="\/en\/"/);
  assert.equal(response.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");
});

test("production materialized app shells collapse header actions and respect signed-in account links", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const shell = (body: string) => [
    "<!doctype html><head></head><body>",
    "<header class=\"site-header\"><div class=\"site-header-inner\">",
    "<a class=\"brand\" href=\"/ja/\">ikimon</a>",
    "<div class=\"site-header-actions site-header-actions-desktop\"><a class=\"site-record-link\" href=\"/ja/record\">記録する</a><a class=\"site-login-link\" href=\"/ja/login?redirect=%2Fprofile\">ログイン</a></div>",
    "<div class=\"site-header-actions site-header-actions-mobile\"><a class=\"site-record-link\" href=\"/ja/record\">記録する</a><a class=\"site-login-link\" href=\"/ja/login?redirect=%2Fprofile\">ログイン</a></div>",
    "</div></header>",
    body,
    "</body>"
  ].join("");
  await env.ASSET_BUCKET.put("original-ui/html/ja/records.html", shell("<main><h1>記録を見る</h1></main>"), {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/ja/login.html", shell("<main><span class=\"auth-social-disabled\">Google で続ける は設定中</span></main>"), {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  const issueResponse = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "header-menu-user", displayName: "Header Menu", ttlHours: 1 })
  }), env);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";

  const recordsResponse = await worker.fetch(new Request("https://ikimon.life/ja/records", {
    headers: { cookie }
  }), productionEnv);
  const recordsBody = await recordsResponse.text();
  assert.equal(recordsResponse.status, 200);
  assert.match(recordsBody, /data-cloudflare-header-menu/);
  assert.match(recordsBody, /site-header-actions-desktop,.site-header \.site-header-actions-mobile\{display:none!important\}/);
  assert.match(recordsBody, /href="\/ja\/profile"/);
  assert.match(recordsBody, /href="\/ja\/profile\/settings"/);
  assert.match(recordsBody, />マイページ</);
  assert.match(recordsBody, />設定</);
  assert.match(recordsBody, /data-cloudflare-records-live/);

  const loginResponse = await worker.fetch(new Request("https://ikimon.life/ja/login?redirect=%2Fprofile"), productionEnv);
  const loginBody = await loginResponse.text();
  assert.equal(loginResponse.status, 200);
  assert.match(loginBody, /data-cloudflare-header-menu/);
  assert.match(loginBody, /href="\/ja\/login\?redirect=%2Fprofile"/);
  assert.match(loginBody, />ログイン</);
  assert.match(loginBody, /\/auth\/oauth\/google\/start\?redirect=%2Fprofile/);
  assert.doesNotMatch(loginBody, /は設定中/);
  assert.equal(core.operationAudit.length, 0);
});

test("production records materialized html includes recent Cloudflare D1 records", async () => {
  const { env } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  await env.ASSET_BUCKET.put("original-ui/html/ja/records.html", "<!doctype html><body><main><h1>記録を見る</h1></main></body>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/ja.html", [
    "<!doctype html><head></head><body>",
    "<main><section class=\"prototype-record-feed\" data-record-feed>",
    "<div class=\"prototype-record-feed-head\"><div><h1>記録を見る</h1></div></div>",
    "<div class=\"prototype-record-feed-list\"><article class=\"prototype-record-feed-card is-preview\" data-record-feed-card>preview</article></div>",
    "<script>/* feed */</script></section></main>",
    "</body>"
  ].join(""), { httpMetadata: { contentType: "text/html; charset=utf-8" } });

  await post("/api/v1/observations/upsert", env, {
    observationId: "record-live-materialized",
    userId: "records-user",
    observedAt: "2026-06-22T09:38:45.358Z",
    latitude: 34.81234,
    longitude: 137.73234,
    taxon: { vernacularName: "最近の投稿テスト", rank: "species" }
  });
  await post("/api/v1/observations/record-live-materialized/photos/upload", env, {
    filename: "records.jpg",
    mimeType: "image/jpeg",
    base64Data: Buffer.from("records-image").toString("base64")
  });
  await worker.queue({ messages: env.MEDIA_QUEUE.messages.map((body) => ({ body: body as any })) }, env);
  env.OBS_DB.assets.set("asset-record-live-real-derivative", {
    asset_id: "asset-record-live-real-derivative",
    draft_id: "draft-record-live-real-derivative",
    observation_id: "record-live-materialized",
    owner_user_id: "records-user",
    object_key: "original/record-live-materialized/records-real.jpg",
    partition_month: "2026-06",
    sha256: "records-real-sha",
    mime: "image/jpeg",
    bytes: 1234,
    processing_state: "uploaded",
    public_derivative_key: "derived/import/20260622/observation_photo/asset-record-live-real-derivative/display.webp",
    public_derivative_sha256: "records-real-derivative-sha",
    public_derivative_verified_at: "2026-06-22T10:00:00.000Z",
    public_derivative_metadata_json: "{\"gpsExifPresent\":false,\"contentType\":\"image/webp\",\"scannedContainer\":\"binary\"}",
    exif_scrub_state: "scrubbed",
    public_ready_at: "2026-06-22T10:00:00.000Z"
  });
  await env.ASSET_BUCKET.put(
    "derived/import/20260622/observation_photo/asset-record-live-real-derivative/display.webp",
    "records-real-webp",
    { httpMetadata: { contentType: "image/webp" } }
  );
  env.OBS_DB.publicMapSnapshotRecords.push({
    occurrence_id: "occ:record-shadow-materialized:0",
    visit_id: "record-shadow-materialized",
    observed_at: "2026-06-23T09:38:45.358Z",
    display_name: "仮画像だけの投稿",
    cell_1000: "34.81,137.73",
    asset_count: 1
  });
  env.OBS_DB.assets.set("asset-record-shadow-derivative", {
    asset_id: "asset-record-shadow-derivative",
    draft_id: "draft-record-shadow-derivative",
    observation_id: "record-shadow-materialized",
    owner_user_id: "records-user",
    object_key: "original/record-shadow-materialized/shadow-only.jpg",
    partition_month: "2026-06",
    sha256: "records-shadow-sha",
    mime: "image/jpeg",
    bytes: 1234,
    processing_state: "uploaded",
    public_derivative_key: "derived/v1-compat/record-shadow-materialized/asset-record-shadow-derivative/display.webp",
    public_derivative_sha256: "records-shadow-derivative-sha",
    public_derivative_verified_at: "2026-06-23T10:00:00.000Z",
    public_derivative_metadata_json: "{\"gpsExifPresent\":false,\"contentType\":\"image/svg+xml; charset=utf-8\",\"scannedContainer\":\"svg+xml\"}",
    exif_scrub_state: "scrubbed",
    public_ready_at: "2026-06-23T10:00:00.000Z"
  });

  const response = await worker.fetch(new Request("https://ikimon.life/ja/records"), productionEnv);
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.match(body, /data-cloudflare-records-live/);
  assert.match(body, /最近の投稿テスト/);
  assert.match(body, /record-live-materialized/);
  assert.match(body, /\/derived\/.+\/display\.webp/);
  assert.match(body, /asset-record-live-real-derivative/);
  assert.match(body, /近くの記録/);
  assert.doesNotMatch(body, /record-shadow-materialized/);
  assert.doesNotMatch(body, /cell:34\.81,137\.73/);
  assert.equal(response.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");

  const homeResponse = await worker.fetch(new Request("https://ikimon.life/ja/"), productionEnv);
  const homeBody = await homeResponse.text();
  assert.equal(homeResponse.status, 200);
  assert.match(homeBody, /data-cloudflare-home-record/);
  assert.match(homeBody, /最近の投稿テスト/);
  assert.match(homeBody, /record-live-materialized/);
  assert.match(homeBody, /\/derived\/.+\/display\.webp/);
  assert.match(homeBody, /asset-record-live-real-derivative/);
  assert.doesNotMatch(homeBody, /record-shadow-materialized/);
  assert.match(homeBody, /prototype-record-feed is-guest/);
  assert.match(homeBody, /data-cloudflare-home-infinite-feed/);
  assert.match(homeBody, /data-cloudflare-home-record-id="record-live-materialized"/);
  assert.match(homeBody, /cf-home-record-feed-infinite-script/);
  assert.match(homeBody, /pickNextCard/);
  assert.doesNotMatch(homeBody, /<h1>記録を見る<\/h1>/);
  assert.doesNotMatch(homeBody, /is-preview/);
  assert.doesNotMatch(homeBody, /cell:34\.81,137\.73/);
});

test("production home prioritizes signed-in owner records over public feed records", async () => {
  const { env, core, obs } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  await env.ASSET_BUCKET.put("original-ui/html/ja.html", [
    "<!doctype html><head></head><body>",
    "<main><section class=\"prototype-record-feed\" data-record-feed>",
    "<div class=\"prototype-record-feed-head\"><div><h1>記録を見る</h1></div></div>",
    "<div class=\"prototype-record-feed-list\"><article class=\"prototype-record-feed-card is-preview\" data-record-feed-card>preview</article></div>",
    "<script>/* feed */</script></section></main>",
    "</body>"
  ].join(""), { httpMetadata: { contentType: "text/html; charset=utf-8" } });

  await post("/api/v1/observations/upsert", env, {
    observationId: "owner-private-home-record",
    userId: "owner-home-user",
    observedAt: "2026-06-24T09:00:00.000Z",
    latitude: 34.81234,
    longitude: 137.73234,
    taxon: { vernacularName: "自分だけの最新記録", rank: "species" }
  });
  const ownerObservation = obs.observations.get("owner-private-home-record");
  if (ownerObservation) ownerObservation.visibility = "private";
  obs.assets.set("asset-owner-home-real-derivative", {
    asset_id: "asset-owner-home-real-derivative",
    draft_id: "draft-owner-home-real-derivative",
    observation_id: "owner-private-home-record",
    owner_user_id: "owner-home-user",
    object_key: "original/owner-private-home-record/owner-real.jpg",
    partition_month: "2026-06",
    sha256: "owner-real-sha",
    mime: "image/jpeg",
    bytes: 1234,
    processing_state: "uploaded",
    public_derivative_key: "derived/import/20260624/observation_photo/asset-owner-home-real-derivative/display.webp",
    public_derivative_sha256: "owner-real-derivative-sha",
    public_derivative_verified_at: "2026-06-24T09:10:00.000Z",
    public_derivative_metadata_json: "{\"gpsExifPresent\":false,\"contentType\":\"image/webp\",\"scannedContainer\":\"binary\"}",
    exif_scrub_state: "scrubbed",
    public_ready_at: null
  });
  for (let index = 0; index < 11; index += 1) {
    const day = String(23 - index).padStart(2, "0");
    const observationId = `owner-private-home-record-${index}`;
    const assetId = `asset-owner-home-real-derivative-${index}`;
    await post("/api/v1/observations/upsert", env, {
      observationId,
      userId: "owner-home-user",
      observedAt: `2026-06-${day}T09:00:00.000Z`,
      latitude: 34.81234,
      longitude: 137.73234,
      taxon: { vernacularName: `自分の追加記録${index}`, rank: "species" }
    });
    const extraOwnerObservation = obs.observations.get(observationId);
    if (extraOwnerObservation) extraOwnerObservation.visibility = "private";
    obs.assets.set(assetId, {
      asset_id: assetId,
      draft_id: `draft-${assetId}`,
      observation_id: observationId,
      owner_user_id: "owner-home-user",
      object_key: `original/${observationId}/owner-real.jpg`,
      partition_month: "2026-06",
      sha256: `${assetId}-sha`,
      mime: "image/jpeg",
      bytes: 1234,
      processing_state: "uploaded",
      public_derivative_key: `derived/import/202606${day}/observation_photo/${assetId}/display.webp`,
      public_derivative_sha256: `${assetId}-derivative-sha`,
      public_derivative_verified_at: `2026-06-${day}T09:10:00.000Z`,
      public_derivative_metadata_json: "{\"gpsExifPresent\":false,\"contentType\":\"image/webp\",\"scannedContainer\":\"binary\"}",
      exif_scrub_state: "scrubbed",
      public_ready_at: null
    });
  }

  env.OBS_DB.publicMapSnapshotRecords.push({
    occurrence_id: "occ:public-home-record:0",
    visit_id: "public-home-record",
    observed_at: "2026-06-25T09:00:00.000Z",
    display_name: "他人の公開記録",
    cell_1000: "34.81,137.73",
    asset_count: 1
  });
  obs.assets.set("asset-public-home-real-derivative", {
    asset_id: "asset-public-home-real-derivative",
    draft_id: "draft-public-home-real-derivative",
    observation_id: "public-home-record",
    owner_user_id: "other-home-user",
    object_key: "original/public-home-record/public-real.jpg",
    partition_month: "2026-06",
    sha256: "public-real-sha",
    mime: "image/jpeg",
    bytes: 1234,
    processing_state: "uploaded",
    public_derivative_key: "derived/import/20260625/observation_photo/asset-public-home-real-derivative/display.webp",
    public_derivative_sha256: "public-real-derivative-sha",
    public_derivative_verified_at: "2026-06-25T09:10:00.000Z",
    public_derivative_metadata_json: "{\"gpsExifPresent\":false,\"contentType\":\"image/webp\",\"scannedContainer\":\"binary\"}",
    exif_scrub_state: "scrubbed",
    public_ready_at: "2026-06-25T09:10:00.000Z"
  });

  const sessionCookieValue = "owner-home-session-value";
  const sessionHash = createHash("sha256").update(sessionCookieValue).digest("hex");
  core.authSessions.set(sessionHash, {
    token_hash: sessionHash,
    user_id: "owner-home-user",
    display_name: "Owner Home",
    role_name: "Observer",
    rank_label: null,
    banned: 0,
    expires_at: "2099-01-01T00:00:00.000Z",
    last_used_at: null
  });
  const cookie = `ikimon_v2_session=${sessionCookieValue}`;
  const homeResponse = await worker.fetch(new Request("https://ikimon.life/ja/", {
    headers: { cookie }
  }), productionEnv);
  const homeBody = await homeResponse.text();

  assert.equal(homeResponse.status, 200);
  assert.match(homeBody, /data-cloudflare-owner-home-record/);
  assert.match(homeBody, /prototype-record-feed is-owner/);
  assert.match(homeBody, /自分だけの最新記録/);
  assert.match(homeBody, /自分の追加記録10/);
  assert.match(homeBody, /自分の記録/);
  assert.match(homeBody, /asset-owner-home-real-derivative/);
  assert.ok((homeBody.match(/data-cloudflare-owner-home-record/g) ?? []).length >= 12);
  assert.doesNotMatch(homeBody, /他人の公開記録/);
  assert.doesNotMatch(homeBody, /近くの記録/);
  assert.doesNotMatch(homeBody, /34\.81234|137\.73234|owner_user_id|ownerUserId/);
});

test("production app refresh page serves materialized reset shell from R2", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const appRefreshHtml = "<!doctype html><title>ikimon app refresh</title><script>new URLSearchParams(window.location.search);registration.unregister();caches.keys()</script>";
  await env.ASSET_BUCKET.put("original-ui/html/app-refresh.html", appRefreshHtml, {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });

  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/app-refresh?to=%2Fmap%3Flang%3Dja", {
      headers: { cookie: "ikimon_v2_session=deploy-smoke" }
    }), productionEnv);
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.equal(body, appRefreshHtml);
    assert.match(body, /<title>ikimon app refresh<\/title>/);
    assert.doesNotMatch(body, /404|ページが見つかりません|Cloudflare移行中|互換表示/);
    assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
    assert.equal(response.headers.get("cache-control"), "no-store, no-cache, must-revalidate, proxy-revalidate");
    assert.equal(response.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production original UI html serves whitelisted public reading routes from R2", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  await env.ASSET_BUCKET.put("original-ui/html/ja/learn/glossary.html", "<!doctype html><title>用語集 / ikimon</title><script>ikimon-app-outbox-v1</script>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/en/learn.html", "<!doctype html><title>Learn / ikimon</title><script>ikimon-app-outbox-v1</script>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/for-business/field-programs.html", "<!doctype html><title>Field programs / ikimon</title><script>ikimon-app-outbox-v1</script>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/ja/about.html", "<!doctype html><title>About / ikimon</title><script>ikimon-app-outbox-v1</script>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/ja/learn/invasive-species/procyon-lotor.html", "<!doctype html><title>Invasive species / ikimon</title><script>ikimon-app-outbox-v1</script>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/en/map.html", "<!doctype html><title>Map / ikimon</title><script>ikimon-app-outbox-v1</script>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/community/fields.html", "<!doctype html><title>Fields / ikimon</title><script>ikimon-app-outbox-v1</script>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/en/community/fields.html", "<!doctype html><title>Fields / ikimon</title><script>ikimon-app-outbox-v1</script>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/es/community/fields.html", "<!doctype html><title>Campos / ikimon</title><script>ikimon-app-outbox-v1</script>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/pt-br/community/fields.html", "<!doctype html><title>Campos / ikimon</title><script>ikimon-app-outbox-v1</script>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/en/community/events/new.html", "<!doctype html><title>New event / ikimon</title><script>ikimon-app-outbox-v1</script>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/es/community/events/new.html", "<!doctype html><title>Nuevo evento / ikimon</title><script>ikimon-app-outbox-v1</script>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/pt-br/community/events/new.html", "<!doctype html><title>Novo evento / ikimon</title><script>ikimon-app-outbox-v1</script>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });

  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const glossary = await worker.fetch(new Request("https://ikimon.life/ja/learn/glossary"), productionEnv);
    assert.equal(glossary.status, 200);
    assert.equal(await glossary.text(), "<!doctype html><title>用語集 / ikimon</title><script>ikimon-app-outbox-v1</script>");
    assert.equal(glossary.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");

    const englishLearn = await worker.fetch(new Request("https://ikimon.life/en/learn"), productionEnv);
    assert.equal(englishLearn.status, 200);
    assert.equal(await englishLearn.text(), "<!doctype html><title>Learn / ikimon</title><script>ikimon-app-outbox-v1</script>");
    assert.equal(englishLearn.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");

    const fieldPrograms = await worker.fetch(new Request("https://ikimon.life/for-business/field-programs"), productionEnv);
    assert.equal(fieldPrograms.status, 200);
    assert.equal(await fieldPrograms.text(), "<!doctype html><title>Field programs / ikimon</title><script>ikimon-app-outbox-v1</script>");
    assert.equal(fieldPrograms.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");

    const about = await worker.fetch(new Request("https://ikimon.life/ja/about"), productionEnv);
    assert.equal(about.status, 200);
    assert.equal(await about.text(), "<!doctype html><title>About / ikimon</title><script>ikimon-app-outbox-v1</script>");
    assert.equal(about.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");

    const invasiveDetail = await worker.fetch(new Request("https://ikimon.life/ja/learn/invasive-species/procyon-lotor"), productionEnv);
    assert.equal(invasiveDetail.status, 200);
    assert.equal(await invasiveDetail.text(), "<!doctype html><title>Invasive species / ikimon</title><script>ikimon-app-outbox-v1</script>");
    assert.equal(invasiveDetail.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");

    const englishMap = await worker.fetch(new Request("https://ikimon.life/en/map"), productionEnv);
    assert.equal(englishMap.status, 200);
    assert.equal(await englishMap.text(), "<!doctype html><title>Map / ikimon</title><script>ikimon-app-outbox-v1</script>");
    assert.equal(englishMap.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");

    for (const path of ["/community/fields", "/en/community/fields", "/es/community/fields", "/pt-br/community/fields"]) {
      const response = await worker.fetch(new Request(`https://ikimon.life${path}`), productionEnv);
      assert.equal(response.status, 200, path);
      assert.equal(response.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html", path);
      assert.equal((await response.text()).includes("ikimon-app-outbox-v1"), true, path);
    }

    const eventShells = ["/en/community/events/new", "/es/community/events/new", "/pt-br/community/events/new"];
    for (const path of eventShells) {
      const response = await worker.fetch(new Request(`https://ikimon.life${path}`), productionEnv);
      assert.equal(response.status, 200, path);
      assert.equal(response.headers.get("x-ikimon-cloudflare-native"), "event-page-create", path);
      assert.equal(response.headers.get("cache-control"), "no-store", path);
      assert.equal(response.headers.get("x-ikimon-cloudflare-materialized"), null, path);
      assert.equal(response.headers.get("set-cookie"), null, path);
      const body = await response.text();
      assert.equal(body.includes("Worker/D1 runtime"), true, path);
      assert.equal(/csrf/i.test(body), false, path);
      assert.equal(/ikimon_v2_session|data-user-id|current_user|viewerUserId/i.test(body), false, path);
    }

    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production public fallback blocks suspicious probe paths instead of forwarding to origin", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    for (const path of [
      "/.env",
      "/.git/config",
      "/wp-includes/wlwmanifest.xml",
      "/wp-json/gravitysmtp/v1/tests/mock-data",
      "/xampp/phpinfo.php",
      "/debug/default/view",
      "/updates.php",
      "/data:image/jpeg;base64,/9j/secret"
    ]) {
      const response = await worker.fetch(new Request(`https://ikimon.life${path}`), productionEnv);
      assert.equal(response.status, 404, path);
      assert.equal(response.headers.get("x-ikimon-cloudflare-native"), "not-found", path);
    }
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production language-prefixed observation detail stays native and public-safe", async () => {
  const { env, core, queue } = createEnv();
  await post("/api/v1/observations/upsert", env, {
    observationId: "record-native-public",
    userId: "detail-user",
    observedAt: "2026-06-15T03:00:00.000Z",
    latitude: 34.71234,
    longitude: 137.81234,
    note: "public detail note",
    taxon: { vernacularName: "言語prefix記録", rank: "species" }
  });
  await post("/api/v1/observations/record-native-public/photos/upload", env, {
    filename: "detail.jpg",
    mimeType: "image/jpeg",
    base64Data: Buffer.from("detail-image").toString("base64")
  });
  for (const suffix of ["peer-a", "peer-b"]) {
    await post("/api/v1/observations/upsert", env, {
      observationId: `record-native-public-${suffix}`,
      userId: "detail-user",
      observedAt: "2026-06-15T03:05:00.000Z",
      latitude: 34.71236,
      longitude: 137.81236,
      taxon: { vernacularName: "言語prefix記録", rank: "species" }
    });
    await post(`/api/v1/observations/record-native-public-${suffix}/photos/upload`, env, {
      filename: `${suffix}.jpg`,
      mimeType: "image/jpeg",
      base64Data: Buffer.from(`detail-image-${suffix}`).toString("base64")
    });
  }
  await worker.queue({ messages: queue.messages.map((body) => ({ body: body as any })) }, env);
  env.OBS_DB.assets.set("asset-record-native-public-real-derivative", {
    asset_id: "asset-record-native-public-real-derivative",
    draft_id: "draft-record-native-public-real-derivative",
    observation_id: "record-native-public",
    owner_user_id: "detail-user",
    object_key: "original/record-native-public/detail-real.jpg",
    partition_month: "2026-06",
    sha256: "record-native-public-real-sha",
    mime: "image/jpeg",
    bytes: 1234,
    processing_state: "uploaded",
    public_derivative_key: "derived/import/20260628/observation_photo/asset-record-native-public-real-derivative/display.webp",
    public_derivative_sha256: "record-native-public-real-derivative-sha",
    public_derivative_verified_at: "2026-06-28T12:00:00.000Z",
    public_derivative_metadata_json: "{\"gpsExifPresent\":false,\"contentType\":\"image/webp\",\"scannedContainer\":\"binary\"}",
    exif_scrub_state: "scrubbed",
    public_ready_at: "2026-06-28T12:00:00.000Z"
  });
  await env.ASSET_BUCKET.put(
    "derived/import/20260628/observation_photo/asset-record-native-public-real-derivative/display.webp",
    "record-native-public-real-webp",
    { httpMetadata: { contentType: "image/webp" } }
  );
  await env.ASSET_BUCKET.put("original-ui/html/ja/observations/record-native-public.html", "should-not-be-served", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };

  const issueResponse = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "detail-user", displayName: "Detail User", ttlHours: 1 })
  }), env);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";
  const environmentResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/occurrences/record-native-public/environment-record", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      values: {
        place_type: "urban",
        contact_surface: "plant",
        surrounding_cover: "built_surface",
        environment_condition: "wet",
        human_change: "mowing"
      }
    })
  }), productionEnv);
  const environmentPayload = await environmentResponse.json() as any;
  assert.equal(environmentResponse.status, 200, JSON.stringify(environmentPayload));

  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    void input;
    void init;
    fallbackCalls += 1;
    return new Response("<!doctype html><title>origin observation detail</title>", {
      headers: { "content-type": "text/html; charset=utf-8" }
    });
  }) as typeof fetch;
  try {
    const mapResponse = await worker.fetch(new Request("https://ikimon.life/ja/api/v1/map/observations?bbox=137.80,34.70,137.83,34.73&zoom=13&limit=20"), productionEnv);
    const mapPayload = await mapResponse.json() as any;
    assert.equal(mapResponse.ok, true, JSON.stringify(mapPayload));
    assert.equal(mapPayload.items.some((item: any) => item.visitId === "record-native-public"), true);

    const response = await worker.fetch(new Request("https://ikimon.life/ja/observations/record-native-public"), productionEnv);
    const body = await response.text();
    assert.equal(response.status, 200, body);
    assert.match(body, /data-cloudflare-observation-detail="1"/);
    assert.match(body, /obs-vps-image-detail-body/);
    assert.match(body, /\/assets\/brand\/app-icon-192\.png/);
    assert.match(body, /\/assets\/brand\/ikimon-wordmark-black\.png/);
    assert.match(body, /obs-reading-hero/);
    assert.match(body, /obs-read-progress/);
    assert.match(body, /obs-media-ledger/);
    assert.match(body, /obs-hero-media-stack is-photo-only/);
    assert.match(body, /data-obs-preview-img/);
    assert.match(body, /data-obs-preview-regions/);
    assert.match(body, /obs-hero-thumb/);
    assert.match(body, /この記録で読む対象/);
    assert.match(body, /data-section-code="identification"/);
    assert.match(body, /同定に参加する/);
    assert.match(body, /data-section-code="observation-quality"/);
    assert.match(body, /観察記録を整える/);
    assert.match(body, /環境情報の下書き/);
    assert.match(body, /data-environment-record-form/);
    assert.match(body, /\/api\/v1\/occurrences\/record-native-public\/environment-record/);
    assert.match(body, /name="place_type"/);
    assert.match(body, /name="contact_surface"/);
    assert.match(body, /name="surrounding_cover"/);
    assert.match(body, /name="environment_condition"/);
    assert.match(body, /name="human_change"/);
    assert.match(body, /保存する/);
    assert.match(body, /保存済み/);
    assert.match(body, /市街地/);
    assert.match(body, /植物上/);
    assert.match(body, /舗装・構造物/);
    assert.match(body, /湿り気あり/);
    assert.match(body, /草刈り/);
    assert.match(body, /次に見るなら/);
    assert.match(body, /obs-local-quality-inline is-full-width/);
    assert.match(body, /obs-area-records/);
    assert.match(body, /record-native-public-peer-a|record-native-public-peer-b/);
    assert.match(body, /言語prefix記録/);
    assert.match(body, /位置ぼかし/);
    assert.doesNotMatch(body, /cell:34\.71,137\.81|公開セル|セル単位/);
    assert.doesNotMatch(body, /class="[^"]*obs-hero-video-frame|class="[^"]*obs-video-evidence-frame|この映像で読む対象を切り替える/);
    assert.doesNotMatch(body, /IDENTIFICATION|OBSERVATION QUALITY|記録の質を育てる/);
    assert.doesNotMatch(body, /href="\/record-reading-cards"|data-shadow-observation-detail="1"|ikimon shadow|ownerUserId|observerUserId|profile\/detail-user|profile\/user_|YAMAKI|34\.71234|137\.81234|should-not-be-served|origin observation detail|\/uploads\//);
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production target observation detail restores lightweight feedback loop without privacy regressions", async () => {
  const { env, queue } = createEnv();
  await post("/api/v1/observations/upsert", env, {
    observationId: "record-1778829649026",
    userId: "detail-user",
    observedAt: "2026-05-15T07:20:00.000Z",
    latitude: 34.81234,
    longitude: 137.73123,
    taxon: { vernacularName: "unidentified", rank: "species" }
  });
  await post("/api/v1/observations/record-1778829649026/photos/upload", env, {
    filename: "target.jpg",
    mimeType: "image/jpeg",
    base64Data: Buffer.from("target-image").toString("base64")
  });
  for (const suffix of ["near-a", "near-b"]) {
    await post("/api/v1/observations/upsert", env, {
      observationId: `record-1778829649026-${suffix}`,
      userId: "nearby-user",
      observedAt: "2026-05-15T07:25:00.000Z",
      latitude: 34.81236,
      longitude: 137.73126,
      taxon: { vernacularName: suffix === "near-a" ? "セイヨウタンポポ" : "スズメ", rank: "species" }
    });
    await post(`/api/v1/observations/record-1778829649026-${suffix}/photos/upload`, env, {
      filename: `${suffix}.jpg`,
      mimeType: "image/jpeg",
      base64Data: Buffer.from(`nearby-${suffix}`).toString("base64")
    });
  }
  await worker.queue({ messages: queue.messages.map((body) => ({ body: body as any })) }, env);
  const productionEnv = { ...env, ENVIRONMENT: "production" };

  const response = await worker.fetch(new Request("https://ikimon.life/ja/observations/record-1778829649026?subject=occ%3Arecord-1778829649026%3A0"), productionEnv);
  const body = await response.text();
  assert.equal(response.status, 200, body);
  assert.match(body, /data-cloudflare-observation-detail="1"/);
  assert.match(body, /カワラヒワ/);
  assert.match(body, /浜松市浜名区周辺/);
  assert.match(body, /位置ぼかし/);
  assert.match(body, /obs-hero-video-frame/);
  assert.match(body, /obs-video-evidence-frame/);
  assert.match(body, /AIが見た動画フレーム/);
  assert.match(body, /obs-ai-readout/);
  assert.match(body, /obs-frame-identify-card/);
  assert.match(body, /同じ記録内/);
  assert.match(body, /同じ撮影記録の複数観察/);
  assert.match(body, /イネ科/);
  assert.match(body, /草本群落/);
  assert.match(body, /常緑つる植物/);
  assert.match(body, /環境/);
  assert.match(body, /草地の縁/);
  assert.match(body, /小石まじり/);
  assert.match(body, /開けた地面/);
  assert.match(body, /音あり/);
  assert.match(body, /候補を試す/);
  assert.match(body, /この記録で返ってきたこと/);
  assert.match(body, /もう一度記録する/);
  assert.match(body, /次に見るなら/);
  assert.match(body, /浜松市浜名区をもう少し見る/);
  assert.match(body, /近い投稿 2件/);
  assert.match(body, /かなり近そう/);
  assert.match(body, /分類候補/);
  assert.match(body, /Chloris sinica/);
  assert.match(body, /端末の声で読む/);
  assert.match(body, /data-frame-zoom-in/);
  assert.match(body, /obs-frame-preview/);
  assert.match(body, /obs-nearby-nophoto|obs-area-thumb/);
  assert.doesNotMatch(body, /cell:34\.81,137\.73|公開セル|セル単位|公開範囲|記録情報|記録一覧|記録の手ざわり/);
  assert.doesNotMatch(body, /この映像で読む対象を切り替える|この映像に写っているもの|候補を確かめる材料|名前の記録|現場アドバイス|確定前|イネ科植物|映像フレームから拾えている手がかり/);
  assert.doesNotMatch(body, /ownerUserId|observerUserId|profile\/detail-user|34\.81234|137\.73123|\/uploads\/|original-ui\/thumb/);
});

test("production image target observation details restore photo record controls without video frames", async () => {
  const { env, queue } = createEnv();
  const targets = [
    { id: "record-1781252770584", lat: 34.704, lng: 137.704, observedAt: "2026-06-12T08:25:49.000Z" },
    { id: "record-1780982506049", lat: 34.814, lng: 137.734, observedAt: "2026-06-09T05:21:21.000Z" },
    { id: "record-1780970378665", lat: 34.816, lng: 137.736, observedAt: "2026-06-09T01:59:23.000Z" },
  ];
  for (const target of targets) {
    await post("/api/v1/observations/upsert", env, {
      observationId: target.id,
      userId: "image-target-user",
      observedAt: target.observedAt,
      latitude: target.lat,
      longitude: target.lng,
      taxon: { vernacularName: "unidentified", rank: "species" }
    });
    await post(`/api/v1/observations/${target.id}/photos/upload`, env, {
      filename: `${target.id}.jpg`,
      mimeType: "image/jpeg",
      base64Data: Buffer.from(`image-target-${target.id}`).toString("base64")
    });
  }
  await worker.queue({ messages: queue.messages.map((body) => ({ body: body as any })) }, env);
  for (const target of targets) {
    const assetId = `asset-${target.id}-real-derivative`;
    const derivativeKey = `derived/import/20260628/observation_photo/${assetId}/display.webp`;
    env.OBS_DB.assets.set(assetId, {
      asset_id: assetId,
      draft_id: `draft-${target.id}-real-derivative`,
      observation_id: target.id,
      owner_user_id: "image-target-user",
      object_key: `original/${target.id}/image-target-real.jpg`,
      partition_month: "2026-06",
      sha256: `${target.id}-real-sha`,
      mime: "image/jpeg",
      bytes: 1234,
      processing_state: "uploaded",
      public_derivative_key: derivativeKey,
      public_derivative_sha256: `${target.id}-real-derivative-sha`,
      public_derivative_verified_at: "2026-06-28T12:00:00.000Z",
      public_derivative_metadata_json: "{\"gpsExifPresent\":false,\"contentType\":\"image/webp\",\"scannedContainer\":\"binary\"}",
      exif_scrub_state: "scrubbed",
      public_ready_at: "2026-06-28T12:00:00.000Z"
    });
    await env.ASSET_BUCKET.put(derivativeKey, `real-webp-${target.id}`, {
      httpMetadata: { contentType: "image/webp" }
    });
  }
  const productionEnv = { ...env, ENVIRONMENT: "production" };

  for (const target of targets) {
    const response = await worker.fetch(new Request(`https://ikimon.life/observations/${target.id}?subject=occ%3A${target.id}%3A0&lang=ja`), productionEnv);
    const body = await response.text();
    assert.equal(response.status, 200, body);
    assert.match(body, /data-cloudflare-observation-detail="1"/);
    assert.match(body, /obs-hero-media-stack is-photo-only/);
    assert.match(body, /data-obs-preview-img/);
    assert.match(body, /data-obs-preview-regions/);
    assert.match(body, /obs-hero-thumb/);
    assert.match(body, /この記録で読む対象/);
    assert.match(body, /obs-region-guide is-context-guide/);
    assert.match(body, /obs-region-guide is-ground-guide/);
    assert.match(body, /obs-region-guide is-extra-guide/);
    assert.match(body, /この記録から読めていること/);
    assert.match(body, /obs-feedback-chip/);
    assert.match(body, /公開記録・候補情報/);
    assert.match(body, /次の写真で増える情報/);
    assert.match(body, /名前の候補/);
    assert.match(body, /場所の手がかり/);
    assert.match(body, /足元の状態/);
    assert.match(body, /あとで分けられるもの/);
    assert.match(body, /data-section-code="identification"/);
    assert.match(body, /同定/);
    assert.match(body, /同定に参加する/);
    assert.match(body, /同意する/);
    assert.match(body, /別候補を提案/);
    assert.match(body, /保留する/);
    assert.match(body, /別レコードを追加/);
    assert.match(body, /提案・コメントの履歴/);
    assert.match(body, /AI候補レビュー/);
    assert.match(body, /現在の見方/);
    assert.match(body, /data-section-code="observation-quality"/);
    assert.match(body, /観察記録を整える/);
    assert.match(body, /環境情報の下書き/);
    assert.match(body, /data-environment-record-form/);
    assert.match(body, new RegExp(`/api/v1/occurrences/${target.id}/environment-record`));
    assert.match(body, /name="place_type"/);
    assert.match(body, /保存する/);
    assert.match(body, /編集履歴/);
    assert.match(body, /次に見るなら/);
    assert.match(body, /写真/);
    assert.match(body, /動画/);
    assert.doesNotMatch(body, /class="[^"]*obs-hero-video-frame|class="[^"]*obs-video-evidence-frame|この映像で読む対象を切り替える/);
    assert.doesNotMatch(body, /画像解析|検出しました|音声を解析/);
    assert.doesNotMatch(body, new RegExp(`\\u91cd\\u306d|${"写真の" + "対象枠"}|${"同じ" + "ページで確認"}|驥阪|縺|蜀`));
    assert.doesNotMatch(body, /href="\/record-reading-cards"|ownerUserId|observerUserId|profile\/image-target-user|34\.704|137\.704|34\.814|137\.734|34\.816|137\.736|\/uploads\/|original-ui\/thumb/);
  }
});

test("production original UI app shells serve materialized HTML even with session cookies", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  await env.ASSET_BUCKET.put("original-ui/html/root.html", "<!doctype html><title>materialized home</title>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/ja.html", "<!doctype html><title>materialized ja home</title>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/map.html", "<!doctype html><title>materialized map</title>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/ja/map.html", "<!doctype html><title>materialized ja map</title>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/guide.html", "<!doctype html><title>materialized guide</title>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/ja/guide.html", "<!doctype html><title>materialized ja guide</title>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/record.html", "<!doctype html><title>materialized record</title>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });

  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fallbackCalls += 1;
    return new Response(`fallback should not be called: ${String(input)} ${new Headers(init?.headers).get("x-ikimon-cloudflare-fallback-reason")}`, { status: 599 });
  }) as typeof fetch;
  try {
    const homeResponse = await worker.fetch(new Request("https://ikimon.life/?source=pwa", {
      headers: { cookie: "ikimon_v2_session=secret" }
    }), productionEnv);
    assert.equal(homeResponse.status, 200);
    assert.equal(await homeResponse.text(), "<!doctype html><title>materialized home</title>");
    assert.equal(homeResponse.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");

    const localizedHomeResponse = await worker.fetch(new Request("https://ikimon.life/ja/?source=pwa", {
      headers: { cookie: "ikimon_v2_session=secret" }
    }), productionEnv);
    assert.equal(localizedHomeResponse.status, 200);
    assert.equal(await localizedHomeResponse.text(), "<!doctype html><title>materialized ja home</title>");
    assert.equal(localizedHomeResponse.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");

    const localizedHomeNoSlashResponse = await worker.fetch(new Request("https://ikimon.life/ja?source=pwa", {
      headers: { cookie: "ikimon_v2_session=secret" }
    }), productionEnv);
    assert.equal(localizedHomeNoSlashResponse.status, 200);
    assert.equal(await localizedHomeNoSlashResponse.text(), "<!doctype html><title>materialized ja home</title>");
    assert.equal(localizedHomeNoSlashResponse.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");

    const mapResponse = await worker.fetch(new Request("https://ikimon.life/map", {
      headers: { cookie: "ikimon_v2_session=secret" }
    }), productionEnv);
    assert.equal(mapResponse.status, 200);
    assert.equal(await mapResponse.text(), "<!doctype html><title>materialized map</title>");
    assert.equal(mapResponse.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");

    const localizedMapResponse = await worker.fetch(new Request("https://ikimon.life/ja/map", {
      headers: { authorization: "Bearer secret" }
    }), productionEnv);
    assert.equal(localizedMapResponse.status, 200);
    assert.equal(await localizedMapResponse.text(), "<!doctype html><title>materialized ja map</title>");
    assert.equal(localizedMapResponse.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");

    const guideResponse = await worker.fetch(new Request("https://ikimon.life/guide", {
      headers: { cookie: "ikimon_v2_session=secret" }
    }), productionEnv);
    assert.equal(guideResponse.status, 200);
    assert.equal(await guideResponse.text(), "<!doctype html><title>materialized guide</title>");
    assert.equal(guideResponse.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");

    const localizedGuideResponse = await worker.fetch(new Request("https://ikimon.life/ja/guide", {
      headers: { authorization: "Bearer secret" }
    }), productionEnv);
    assert.equal(localizedGuideResponse.status, 200);
    assert.equal(await localizedGuideResponse.text(), "<!doctype html><title>materialized ja guide</title>");
    assert.equal(localizedGuideResponse.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");

    const recordResponse = await worker.fetch(new Request("https://ikimon.life/record", {
      headers: { cookie: "ikimon_v2_session=secret" }
    }), productionEnv);
    assert.equal(recordResponse.status, 200);
    assert.equal(await recordResponse.text(), "<!doctype html><title>materialized record</title>");
    assert.equal(recordResponse.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production profile shell renders signed-in Cloudflare page for valid session cookies", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  await env.ASSET_BUCKET.put("original-ui/html/ja/profile.html", "<!doctype html><title>materialized profile</title>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/ja/profile/settings.html", "<!doctype html><title>materialized settings</title>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/ja/records.html", "<!doctype html><main><title>materialized records</title></main>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  await env.ASSET_BUCKET.put("original-ui/html/ja/record.html", "<!doctype html><title>materialized record</title>", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  const issueResponse = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "profile-user", displayName: "八巻テスト", ttlHours: 1 })
  }), env);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";

  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    void input;
    void init;
    fallbackCalls += 1;
    return new Response("<!doctype html><title>personalized origin profile</title>", {
      headers: { "content-type": "text/html; charset=utf-8" }
    });
  }) as typeof fetch;
  try {
    for (const check of [
      { path: "/ja/profile", expected: "八巻テスト", native: true },
      { path: "/ja/profile/settings", expected: "プロフィール設定", native: true },
      { path: "/ja/records", expected: "materialized records" },
      { path: "/ja/record", expected: "materialized record" }
    ]) {
      const response = await worker.fetch(new Request(`https://ikimon.life${check.path}`, {
        headers: { cookie }
      }), productionEnv);
      const body = await response.text();
      assert.equal(response.status, 200, check.path);
      assert.match(body, new RegExp(check.expected), check.path);
      assert.doesNotMatch(body, /personalized origin profile/, check.path);
      if (check.native) {
        assert.equal(response.headers.get("x-ikimon-cloudflare-native"), "profile-session", check.path);
        assert.match(body, /data-cloudflare-profile="signed-in"/, check.path);
        assert.doesNotMatch(body, /ログインしてマイページへ/, check.path);
      }
    }
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("municipal walk map HTML pages are Worker-native and admin pages require sessions", async () => {
  const { env, obs } = createEnv();
  const stagingEnv = {
    ...env,
    ENVIRONMENT: "staging",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  obs.municipalWalkMapCreators.set("shizuoka-city", {
    creator_id: "shizuoka-city",
    display_name: "静岡市",
    registration_kind: "municipality",
    verification_status: "verified",
    commercial_intent: "none",
    notes: "出典確認済み",
    updated_at: "2026-06-25T00:00:00.000Z"
  });
  obs.municipalWalkMaps.set("jp-shizuoka-review-html-sample", {
    walk_map_id: "jp-shizuoka-review-html-sample",
    municipality_code: "22100",
    municipality: "静岡市",
    title: "HTML審査サンプル",
    summary: "Worker HTMLで見る審査サンプルです。",
    theme: "waterfront",
    publish_mode: "draft",
    route_style: "loose_stops",
    mobility_modes_json: "[\"walk\"]",
    stop_count: 1,
    source_references_json: "[{\"label\":\"静岡市 いきもの散策マップ\",\"url\":\"https://www.city.shizuoka.lg.jp/s6347/s001494.html\"}]",
    area_hint_json: "{\"lat\":35.015,\"lng\":138.389}",
    display_order: 1,
    creator_name: "静岡市",
    creator_profile_json: "{\"kind\":\"municipality\"}",
    route_flexibility_json: "{\"routeStyle\":\"loose_stops\"}",
    publication_review_json: "{\"status\":\"needs_review\"}",
    updated_at: "2026-06-25T00:00:00.000Z"
  });
  obs.municipalWalkMapStops.set("html-review-stop", {
    stop_id: "html-review-stop",
    walk_map_id: "jp-shizuoka-review-html-sample",
    display_order: 1,
    title: "水辺",
    note: "",
    area_hint_json: "{}",
    safety_note: "",
    position: 1,
    area_kind: "waterfront",
    access: "public_access",
    estimated_minutes: 10,
    notice_cues_json: "[]",
    record_cues_json: "[]",
    safety_notes_json: "[]"
  });
  const adminIssue = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "admin-user", displayName: "Admin User", roleName: "Admin", ttlHours: 1 })
  }), env);
  const adminCookie = adminIssue.headers.get("set-cookie") ?? "";

  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("origin should not be used", { status: 599 });
  }) as typeof fetch;
  try {
    const listResponse = await worker.fetch(new Request("https://staging.ikimon.life/ja/walk-maps"), stagingEnv);
    const listBody = await listResponse.text();
    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.headers.get("x-ikimon-cloudflare-native"), "municipal-walk-map-list");
    assert.match(listBody, /散策マップ/);
    assert.doesNotMatch(listBody, /見返せる|少し厚くなる/);
    assert.equal(fallbackCalls, 0);

    const templateResponse = await worker.fetch(new Request(
      "https://staging.ikimon.life/admin/municipal-walk-maps?templateId=route_species_walk",
      { headers: { cookie: adminCookie } }
    ), stagingEnv);

    assert.equal(templateResponse.status, 200);
    assert.equal(templateResponse.headers.get("x-ikimon-cloudflare-native"), "municipal-walk-map-admin-html");
    const templateBody = await templateResponse.text();
    assert.match(templateBody, /散策マップ管理/);
    assert.match(templateBody, /コース散策/);
    assert.equal(fallbackCalls, 0);
    const anonymousTemplateResponse = await worker.fetch(new Request(
      "https://staging.ikimon.life/admin/municipal-walk-maps?templateId=route_species_walk"
    ), stagingEnv);
    assert.equal(anonymousTemplateResponse.status, 401);
    assert.equal(fallbackCalls, 0);
    const response = await worker.fetch(new Request(
      "https://staging.ikimon.life/admin/municipal-walk-maps?sourceId=funabashi-nature-walk-maps",
      { headers: { cookie: adminCookie } }
    ), stagingEnv);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-ikimon-cloudflare-native"), "municipal-walk-map-admin-html");
    assert.match(await response.text(), /散策マップ管理/);
    assert.equal(fallbackCalls, 0);
    const shizuokaResponse = await worker.fetch(new Request(
      "https://staging.ikimon.life/admin/municipal-walk-maps?sourceId=shizuoka-ikimono-walk-route",
      { headers: { cookie: adminCookie } }
    ), stagingEnv);

    assert.equal(shizuokaResponse.status, 200);
    assert.equal(shizuokaResponse.headers.get("x-ikimon-cloudflare-native"), "municipal-walk-map-admin-html");
    assert.match(await shizuokaResponse.text(), /静岡市 いきもの散策マップ/);
    assert.equal(fallbackCalls, 0);
    const reviewQueueResponse = await worker.fetch(new Request(
      "https://staging.ikimon.life/admin/municipal-walk-map-reviews",
      { headers: { cookie: adminCookie } }
    ), stagingEnv);

    assert.equal(reviewQueueResponse.status, 200);
    assert.equal(reviewQueueResponse.headers.get("x-ikimon-cloudflare-native"), "municipal-walk-map-reviews-html");
    const reviewHtml = await reviewQueueResponse.text();
    assert.match(reviewHtml, /散策マップ審査/);
    assert.match(reviewHtml, /HTML審査サンプル/);
    assert.equal(fallbackCalls, 0);
    const creatorResponse = await worker.fetch(new Request(
      "https://staging.ikimon.life/admin/municipal-walk-map-creators",
      { headers: { cookie: adminCookie } }
    ), stagingEnv);

    assert.equal(creatorResponse.status, 200);
    assert.equal(creatorResponse.headers.get("x-ikimon-cloudflare-native"), "municipal-walk-map-creators-html");
    assert.match(await creatorResponse.text(), /静岡市/);
    assert.equal(fallbackCalls, 0);
    const reviewResponse = await worker.fetch(new Request(
      "https://staging.ikimon.life/walk-map-source-drafts/shizuoka-ikimono-walk-route"
    ), stagingEnv);

    assert.equal(reviewResponse.status, 200);
    assert.equal(reviewResponse.headers.get("x-ikimon-cloudflare-native"), "municipal-walk-map-source-draft");
    assert.match(await reviewResponse.text(), /静岡市 いきもの散策マップ/);
    assert.equal(fallbackCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Cloudflare public municipal walk map candidate API scopes static samples by map center", async () => {
  const { env } = createEnv();
  const stagingEnv = { ...env, ENVIRONMENT: "staging" };

  const shizuoka = await worker.fetch(new Request(
    "https://staging.ikimon.life/api/v1/municipal-walk-maps?lat=34.975&lng=138.383&limit=2"
  ), stagingEnv);
  assert.equal(shizuoka.status, 200);
  const shizuokaBody = await shizuoka.json() as {
    ok?: boolean;
    matchedMunicipalityCode?: string | null;
    locationFiltered?: boolean;
    summaries?: Array<{ walkMapId?: string; areaHint?: { precision?: string; source?: string; lat?: number; lng?: number } }>;
  };
  assert.equal(shizuokaBody.ok, true);
  assert.equal(shizuokaBody.locationFiltered, true);
  assert.equal(shizuokaBody.matchedMunicipalityCode, "22100");
  assert.equal(shizuokaBody.summaries?.length, 2);
  assert.match(JSON.stringify(shizuokaBody.summaries), /jp-shizuoka-/);
  assert.equal(shizuokaBody.summaries?.[0]?.areaHint?.precision, "area_hint");
  assert.equal(shizuokaBody.summaries?.[0]?.areaHint?.source, "official_source_sample");
  assert.match(String(shizuokaBody.summaries?.[0]?.areaHint?.lat), /^-?\d+(\.\d{1,3})?$/);
  assert.match(String(shizuokaBody.summaries?.[0]?.areaHint?.lng), /^-?\d+(\.\d{1,3})?$/);

  const tokyo = await worker.fetch(new Request(
    "https://staging.ikimon.life/api/v1/municipal-walk-maps?lat=35.681&lng=139.767&limit=2"
  ), stagingEnv);
  assert.equal(tokyo.status, 200);
  const tokyoBody = await tokyo.json() as {
    matchedMunicipalityCode?: string | null;
    locationFiltered?: boolean;
    summaries?: unknown[];
  };
  assert.equal(tokyoBody.locationFiltered, true);
  assert.equal(tokyoBody.matchedMunicipalityCode, null);
  assert.deepEqual(tokyoBody.summaries, []);
});

test("Cloudflare public municipal walk map candidate API prefers OBS_DB readmodel when seeded", async () => {
  const { env, obs } = createEnv();
  obs.municipalWalkMaps.set("jp-shizuoka-d1-sample", {
    walk_map_id: "jp-shizuoka-d1-sample",
    municipality_code: "22100",
    municipality: "静岡市",
    title: "D1散策サンプル",
    summary: "D1の公開候補から返すサンプルです。",
    theme: "waterfront",
    publish_mode: "public_preview",
    route_style: "loose_stops",
    mobility_modes_json: "[\"walk\",\"bike\"]",
    stop_count: 2,
    source_references_json: "[{\"label\":\"静岡市 いきもの散策マップ\",\"url\":\"https://www.city.shizuoka.lg.jp/s6347/s001494.html\"}]",
    area_hint_json: "{\"lat\":35.015,\"lng\":138.389,\"label\":\"麻機の水辺\",\"precision\":\"area_hint\",\"source\":\"official_source_sample\"}",
    display_order: 1
  });

  const response = await worker.fetch(new Request(
    "https://staging.ikimon.life/api/v1/municipal-walk-maps?lat=35.015&lng=138.389&limit=4"
  ), { ...env, ENVIRONMENT: "staging" });
  assert.equal(response.status, 200);
  const body = await response.json() as {
    source?: string;
    summaries?: Array<{ walkMapId?: string; mobilityModes?: string[]; areaHint?: { precision?: string } }>;
  };
  assert.equal(body.source, "d1_observations");
  assert.equal(body.summaries?.length, 1);
  assert.equal(body.summaries?.[0]?.walkMapId, "jp-shizuoka-d1-sample");
  assert.deepEqual(body.summaries?.[0]?.mobilityModes, ["walk", "bike"]);
  assert.equal(body.summaries?.[0]?.areaHint?.precision, "area_hint");
});

test("Cloudflare public municipal walk map detail API and page render D1 readmodel without origin fallback", async () => {
  const { env, obs } = createEnv();
  obs.municipalWalkMaps.set("jp-shizuoka-d1-detail-sample", {
    walk_map_id: "jp-shizuoka-d1-detail-sample",
    municipality_code: "22100",
    municipality: "静岡市",
    title: "D1散策ディテール",
    summary: "公開範囲で見る散策ディテールです。",
    theme: "waterfront",
    publish_mode: "public_preview",
    route_style: "loose_stops",
    mobility_modes_json: "[\"walk\",\"bike\"]",
    stop_count: 1,
    source_references_json: "[{\"label\":\"静岡市 いきもの散策マップ\",\"url\":\"https://www.city.shizuoka.lg.jp/s6347/s001494.html\"}]",
    area_hint_json: "{\"lat\":35.015,\"lng\":138.389,\"label\":\"麻機の水辺\",\"precision\":\"area_hint\",\"source\":\"official_source_sample\"}",
    display_order: 1,
    route_flexibility_json: "{\"routeStyle\":\"loose_stops\",\"mobilityModes\":[\"walk\",\"bike\"],\"offRoutePolicy\":\"off_route_allowed\",\"returnCues\":[\"案内板へ戻る\"]}",
    public_precision_policy: "mesh_or_coarser",
    claim_boundary_json: "[\"公式調査結果ではなく、散策マップとして扱います。\"]",
    updated_at: "2026-06-25T00:00:00.000Z"
  });
  obs.municipalWalkMapStops.set("detail-stop-1", {
    stop_id: "detail-stop-1",
    walk_map_id: "jp-shizuoka-d1-detail-sample",
    display_order: 1,
    title: "水辺の入口",
    note: "水面と草地を見ます。",
    area_hint_json: "{\"lat\":35.015,\"lng\":138.389,\"precision\":\"area_hint\",\"source\":\"official_source_sample\"}",
    safety_note: "水辺に近づきすぎない。",
    position: 1,
    area_kind: "waterfront",
    access: "public_access",
    estimated_minutes: 12,
    notice_cues_json: "[\"水面\",\"草地\"]",
    record_cues_json: "[\"写真\",\"メモ\"]",
    safety_notes_json: "[\"足元確認\"]"
  });

  const api = await worker.fetch(new Request(
    "https://staging.ikimon.life/ja/api/v1/municipal-walk-maps/jp-shizuoka-d1-detail-sample"
  ), { ...env, ENVIRONMENT: "staging" });
  const apiBody = await api.json() as {
    ok?: boolean;
    detail?: {
      source?: string;
      walkMapId?: string;
      stops?: Array<{ stopId?: string; areaHint?: { precision?: string }; noticeCues?: string[] }>;
      routeFlexibility?: { mobilityModes?: string[] };
    };
  };
  assert.equal(api.status, 200);
  assert.equal(apiBody.ok, true);
  assert.equal(apiBody.detail?.source, "d1_observations");
  assert.equal(apiBody.detail?.walkMapId, "jp-shizuoka-d1-detail-sample");
  assert.equal(apiBody.detail?.stops?.[0]?.stopId, "detail-stop-1");
  assert.equal(apiBody.detail?.stops?.[0]?.areaHint?.precision, "area_hint");
  assert.deepEqual(apiBody.detail?.stops?.[0]?.noticeCues, ["水面", "草地"]);
  assert.deepEqual(apiBody.detail?.routeFlexibility?.mobilityModes, ["walk", "bike"]);

  const page = await worker.fetch(new Request(
    "https://staging.ikimon.life/ja/walk-maps/jp-shizuoka-d1-detail-sample",
    { headers: { accept: "text/html" } }
  ), { ...env, ENVIRONMENT: "staging" });
  const pageHtml = await page.text();
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type") ?? "", /text\/html/);
  assert.match(pageHtml, /D1散策ディテール/);
  assert.match(pageHtml, /水辺の入口/);
  assert.match(pageHtml, /静岡市 いきもの散策マップ/);
  assert.doesNotMatch(pageHtml, /exact_lat|exact_lng|internalMemo|internal_memo/);
});

test("municipal walk map admin creator API requires an admin session before D1 writes", async () => {
  const { env, obs } = createEnv();

  const guestResponse = await worker.fetch(new Request("https://shadow.test/api/v1/admin/municipal-walk-map-creators", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ creatorId: "guest-group", displayName: "Guest Group" })
  }), env);
  const guestBody = await guestResponse.json() as { error?: string };
  assert.equal(guestResponse.status, 401);
  assert.equal(guestBody.error, "session_required");
  assert.equal(obs.municipalWalkMapCreators.size, 0);

  const userIssue = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "observer-user", roleName: "Observer", ttlHours: 1 })
  }), env);
  const userCookie = userIssue.headers.get("set-cookie") ?? "";
  const userResponse = await worker.fetch(new Request("https://shadow.test/api/v1/admin/municipal-walk-map-creators", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: userCookie },
    body: JSON.stringify({ creatorId: "observer-group", displayName: "Observer Group" })
  }), env);
  const userBody = await userResponse.json() as { error?: string };
  assert.equal(userResponse.status, 403);
  assert.equal(userBody.error, "admin_required");
  assert.equal(obs.municipalWalkMapCreators.size, 0);
});

test("municipal walk map admin creator API upserts and lists creators from D1", async () => {
  const { env } = createEnv();
  const issueResponse = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "admin-user", roleName: "Admin", ttlHours: 1 })
  }), env);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";

  const upsertResponse = await worker.fetch(new Request("https://shadow.test/api/v1/admin/municipal-walk-map-creators", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      creator: {
        creatorId: "shizuoka-city",
        displayName: "静岡市",
        registrationKind: "municipality",
        verificationStatus: "verified",
        commercialIntent: "none",
        notes: "公式散策マップの出典確認済み"
      }
    })
  }), env);
  const upsertBody = await upsertResponse.json() as {
    ok?: boolean;
    source?: string;
    creator?: { creatorId?: string; displayName?: string; registrationKind?: string; verificationStatus?: string };
  };
  assert.equal(upsertResponse.status, 201);
  assert.equal(upsertBody.ok, true);
  assert.equal(upsertBody.source, "d1_observations");
  assert.equal(upsertBody.creator?.creatorId, "shizuoka-city");
  assert.equal(upsertBody.creator?.registrationKind, "municipality");
  assert.equal(upsertBody.creator?.verificationStatus, "verified");

  const listResponse = await worker.fetch(new Request("https://shadow.test/api/v1/admin/municipal-walk-map-creators", {
    headers: { cookie }
  }), env);
  const listBody = await listResponse.json() as {
    ok?: boolean;
    creators?: Array<{ creatorId?: string; displayName?: string; commercialIntent?: string }>;
  };
  assert.equal(listResponse.status, 200);
  assert.equal(listBody.ok, true);
  assert.equal(listBody.creators?.length, 1);
  assert.equal(listBody.creators?.[0]?.creatorId, "shizuoka-city");
  assert.equal(listBody.creators?.[0]?.displayName, "静岡市");
  assert.equal(listBody.creators?.[0]?.commercialIntent, "none");
});

test("municipal walk map admin review queue reads review items from D1", async () => {
  const { env, obs } = createEnv();
  obs.municipalWalkMaps.set("jp-shizuoka-review-sample", {
    walk_map_id: "jp-shizuoka-review-sample",
    municipality_code: "22100",
    municipality: "静岡市",
    title: "静岡いきもの散策候補",
    summary: "出典付きで公開前確認する散策ルート候補です。",
    theme: "waterfront",
    publish_mode: "draft",
    route_style: "loose_stops",
    mobility_modes_json: "[\"walk\"]",
    stop_count: 3,
    source_references_json: "[{\"label\":\"静岡市 いきもの散策マップ\",\"url\":\"https://www.city.shizuoka.lg.jp/s6347/s001494.html\"}]",
    area_hint_json: "{\"lat\":35.015,\"lng\":138.389}",
    display_order: 1,
    creator_name: "静岡市",
    creator_profile_json: "{\"kind\":\"municipality\"}",
    route_flexibility_json: "{\"strictness\":\"loose\"}",
    publication_review_json: "{\"status\":\"needs_review\"}",
    updated_at: "2026-06-25T00:00:00.000Z"
  });
  const issueResponse = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "analyst-user", roleName: "Analyst", ttlHours: 1 })
  }), env);
  const cookie = issueResponse.headers.get("set-cookie") ?? "";

  const response = await worker.fetch(new Request("https://shadow.test/api/v1/admin/municipal-walk-map-reviews?limit=10", {
    headers: { cookie }
  }), env);
  const body = await response.json() as {
    ok?: boolean;
    source?: string;
    reviews?: Array<{
      walkMapId?: string;
      creatorName?: string | null;
      reviewRequired?: boolean;
      sourceReferenceCount?: number;
      stopCount?: number;
    }>;
  };
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.source, "d1_observations");
  assert.equal(body.reviews?.length, 1);
  assert.equal(body.reviews?.[0]?.walkMapId, "jp-shizuoka-review-sample");
  assert.equal(body.reviews?.[0]?.creatorName, "静岡市");
  assert.equal(body.reviews?.[0]?.reviewRequired, true);
  assert.equal(body.reviews?.[0]?.sourceReferenceCount, 1);
  assert.equal(body.reviews?.[0]?.stopCount, 3);
});

test("municipal walk map admin templates, source catalog, and preview are Worker-native", async () => {
  const { env, obs } = createEnv();
  const unauth = await worker.fetch(new Request("https://shadow.test/api/v1/admin/municipal-walk-map-templates"), env);
  const unauthBody = await unauth.json() as { error?: string };
  assert.equal(unauth.status, 401);
  assert.equal(unauthBody.error, "session_required");

  const adminIssue = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "admin-user", displayName: "Admin User", roleName: "Admin", ttlHours: 1 })
  }), env);
  const adminCookie = adminIssue.headers.get("set-cookie") ?? "";

  const templates = await worker.fetch(new Request("https://shadow.test/api/v1/admin/municipal-walk-map-templates", {
    headers: { cookie: adminCookie }
  }), env);
  const templatesBody = await templates.json() as { ok?: boolean; source?: string; templates?: Array<{ templateId?: string }> };
  assert.equal(templates.status, 200);
  assert.equal(templatesBody.ok, true);
  assert.equal(templatesBody.source, "cloudflare_static");
  assert.equal((templatesBody.templates ?? []).some((template) => template.templateId === "route_species_walk"), true);

  const catalog = await worker.fetch(new Request("https://shadow.test/api/v1/admin/municipal-walk-map-source-catalog?templateId=route_species_walk", {
    headers: { cookie: adminCookie }
  }), env);
  const catalogBody = await catalog.json() as { ok?: boolean; source?: string; sources?: Array<{ templateId?: string; accessModel?: { importPolicy?: string } }> };
  assert.equal(catalog.status, 200);
  assert.equal(catalogBody.ok, true);
  assert.equal(catalogBody.source, "cloudflare_static");
  assert.equal((catalogBody.sources ?? []).length > 0, true);
  assert.equal((catalogBody.sources ?? []).every((source) => source.templateId === "route_species_walk"), true);
  assert.equal(catalogBody.sources?.[0]?.accessModel?.importPolicy, "citation_only_no_body_copy");

  const preview = await worker.fetch(new Request("https://shadow.test/api/v1/admin/municipal-walk-maps/preview", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: JSON.stringify({
      config: {
        title: "Preview title",
        summary: "Preview summary",
        municipality: "Shizuoka city",
        routeStops: [{ stopId: "preview-stop", title: "Preview stop", noticeCues: ["Sign"], recordCues: ["Photo"] }],
        sourceReferences: [{ label: "Source", url: "https://www.city.shizuoka.lg.jp/s6347/s001494.html" }]
      }
    })
  }), env);
  const previewHtml = await preview.text();
  assert.equal(preview.status, 200);
  assert.match(preview.headers.get("content-type") ?? "", /text\/html/);
  assert.match(previewHtml, /Preview title/);
  assert.match(previewHtml, /Preview stop/);
  assert.equal(obs.municipalWalkMaps.size, 0);
  assert.equal(obs.municipalWalkMapAudit.length, 0);
});

test("municipal walk map review actions update D1 publish state and audit only for admins", async () => {
  const { env, obs } = createEnv();
  obs.municipalWalkMaps.set("jp-shizuoka-action-sample", {
    walk_map_id: "jp-shizuoka-action-sample",
    municipality_code: "22100",
    municipality: "静岡市",
    title: "審査アクション用サンプル",
    summary: "D1 review action smoke sample.",
    theme: "waterfront",
    publish_mode: "draft",
    route_style: "loose_stops",
    mobility_modes_json: "[\"walk\"]",
    stop_count: 2,
    source_references_json: "[{\"label\":\"静岡市 いきもの散策マップ\",\"url\":\"https://www.city.shizuoka.lg.jp/s6347/s001494.html\"}]",
    area_hint_json: "{\"lat\":35.015,\"lng\":138.389}",
    display_order: 1,
    creator_name: "静岡市",
    creator_profile_json: "{\"kind\":\"municipality\"}",
    route_flexibility_json: "{\"routeStyle\":\"loose_stops\",\"mobilityModes\":[\"walk\"],\"offRoutePolicy\":\"off_route_allowed\"}",
    publication_review_json: "{\"publicAccessAttested\":false,\"sourceRightsAttested\":false,\"emergencyHidden\":false}",
    updated_at: "2026-06-25T00:00:00.000Z"
  });

  const userIssue = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "observer-user", roleName: "Observer", ttlHours: 1 })
  }), env);
  const userCookie = userIssue.headers.get("set-cookie") ?? "";
  const forbidden = await worker.fetch(new Request(
    "https://shadow.test/api/v1/admin/municipal-walk-map-reviews/jp-shizuoka-action-sample/actions",
    {
      method: "POST",
      headers: { "content-type": "application/json", cookie: userCookie },
      body: JSON.stringify({ action: "approve_public_preview" })
    }
  ), env);
  const forbiddenBody = await forbidden.json() as { error?: string };
  assert.equal(forbidden.status, 403);
  assert.equal(forbiddenBody.error, "admin_required");
  assert.equal(obs.municipalWalkMaps.get("jp-shizuoka-action-sample")?.publish_mode, "draft");
  assert.equal(obs.municipalWalkMapAudit.length, 0);

  const adminIssue = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "admin-user", displayName: "Admin User", roleName: "Admin", ttlHours: 1 })
  }), env);
  const adminCookie = adminIssue.headers.get("set-cookie") ?? "";
  const approve = await worker.fetch(new Request(
    "https://shadow.test/api/v1/admin/municipal-walk-map-reviews/jp-shizuoka-action-sample/actions",
    {
      method: "POST",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ action: "approve_public_preview", note: "公開プレビュー確認" })
    }
  ), env);
  const approveBody = await approve.json() as {
    ok?: boolean;
    result?: { action?: string; publishMode?: string; publicationReview?: Record<string, unknown> };
  };
  assert.equal(approve.status, 200);
  assert.equal(approveBody.ok, true);
  assert.equal(approveBody.result?.action, "approve_public_preview");
  assert.equal(approveBody.result?.publishMode, "public_preview");
  assert.equal(approveBody.result?.publicationReview?.publicAccessAttested, true);
  assert.equal(approveBody.result?.publicationReview?.sourceRightsAttested, true);
  assert.equal(obs.municipalWalkMaps.get("jp-shizuoka-action-sample")?.publish_mode, "public_preview");
  assert.equal(obs.municipalWalkMapAudit.length, 1);
  assert.equal(obs.municipalWalkMapAudit[0]?.action, "review.approve_public_preview");
  assert.equal(obs.municipalWalkMapAudit[0]?.actor_user_id, "admin-user");

  const requestChanges = await worker.fetch(new Request(
    "https://shadow.test/api/v1/admin/municipal-walk-map-reviews/jp-shizuoka-action-sample/actions",
    {
      method: "POST",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ action: "request_changes", note: "出典リンクを確認" })
    }
  ), env);
  const requestChangesBody = await requestChanges.json() as {
    ok?: boolean;
    result?: { publishMode?: string; publicationReview?: Record<string, unknown> };
  };
  assert.equal(requestChanges.status, 200);
  assert.equal(requestChangesBody.ok, true);
  assert.equal(requestChangesBody.result?.publishMode, "draft");
  assert.equal(requestChangesBody.result?.publicationReview?.takedownReason, "出典リンクを確認");
  assert.equal(obs.municipalWalkMaps.get("jp-shizuoka-action-sample")?.publish_mode, "draft");
  assert.equal(obs.municipalWalkMapAudit.length, 2);
  assert.equal(obs.municipalWalkMapAudit[1]?.action, "review.request_changes");
});

test("municipal walk map admin create and update APIs persist config and stops to D1", async () => {
  const { env, obs } = createEnv();
  const observerIssue = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "observer-user", roleName: "Observer", ttlHours: 1 })
  }), env);
  const observerCookie = observerIssue.headers.get("set-cookie") ?? "";
  const baseConfig = {
    walkMapId: "jp-shizuoka-d1-write-sample",
    creatorProfile: {
      creatorId: "creator-shizuoka-city-official-sample",
      displayName: "静岡市",
      registrationKind: "municipality",
      verificationStatus: "verified",
      commercialIntent: "none"
    },
    municipalityCode: "22100",
    municipality: "静岡市",
    title: "D1保存サンプル",
    summary: "D1へ作成・更新する散策マップサンプルです。",
    theme: "waterfront",
    publishMode: "draft",
    areaScope: { municipalityCodes: ["22100"], placeIds: [], polygonIds: [] },
    recordModes: ["photo", "memo", "unknown_species"],
    routeFlexibility: {
      routeStyle: "loose_stops",
      mobilityModes: ["walk", "bike"],
      offRoutePolicy: "off_route_allowed"
    },
    sourceReferences: [
      { label: "静岡市 いきもの散策マップ", url: "https://www.city.shizuoka.lg.jp/s6347/s001494.html" }
    ],
    publicationReview: { publicAccessAttested: false, sourceRightsAttested: true, emergencyHidden: false },
    routeStops: [
      {
        stopId: "asahata-water",
        title: "麻機の水辺",
        areaKind: "waterfront",
        access: "public_access",
        areaHint: { lat: 35.015, lng: 138.389, label: "麻機" },
        noticeCues: ["水面", "鳥の声"],
        recordCues: ["写真", "メモ"]
      },
      {
        stopId: "yatsuyama-edge",
        title: "八ツ山の木陰",
        areaKind: "park",
        access: "public_access",
        areaHint: { lat: 34.98, lng: 138.39, label: "八ツ山" },
        noticeCues: ["木陰"],
        recordCues: ["写真"]
      }
    ]
  };

  const forbidden = await worker.fetch(new Request("https://shadow.test/api/v1/admin/municipal-walk-maps", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: observerCookie },
    body: JSON.stringify({ config: baseConfig })
  }), env);
  const forbiddenBody = await forbidden.json() as { error?: string };
  assert.equal(forbidden.status, 403);
  assert.equal(forbiddenBody.error, "admin_required");
  assert.equal(obs.municipalWalkMaps.has("jp-shizuoka-d1-write-sample"), false);

  const adminIssue = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "admin-user", displayName: "Admin User", roleName: "Admin", ttlHours: 1 })
  }), env);
  const adminCookie = adminIssue.headers.get("set-cookie") ?? "";
  const create = await worker.fetch(new Request("https://shadow.test/api/v1/admin/municipal-walk-maps", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: JSON.stringify({ config: baseConfig })
  }), env);
  const createBody = await create.json() as { ok?: boolean; action?: string; publicMap?: { stopCount?: number } };
  assert.equal(create.status, 201);
  assert.equal(createBody.ok, true);
  assert.equal(createBody.action, "create");
  assert.equal(createBody.publicMap?.stopCount, 2);
  assert.equal(obs.municipalWalkMapCreators.get("creator-shizuoka-city-official-sample")?.registration_kind, "municipality");
  assert.equal(obs.municipalWalkMaps.get("jp-shizuoka-d1-write-sample")?.title, "D1保存サンプル");
  assert.equal(obs.municipalWalkMaps.get("jp-shizuoka-d1-write-sample")?.stop_count, 2);
  assert.equal([...obs.municipalWalkMapStops.values()].filter((row) => row.walk_map_id === "jp-shizuoka-d1-write-sample").length, 2);
  assert.equal(obs.municipalWalkMapAudit[0]?.action, "map.create");

  const update = await worker.fetch(new Request("https://shadow.test/api/v1/admin/municipal-walk-maps/jp-shizuoka-d1-write-sample", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: JSON.stringify({
      config: {
        ...baseConfig,
        title: "D1更新サンプル",
        publishMode: "public_preview",
        routeStops: [baseConfig.routeStops[0]]
      }
    })
  }), env);
  const updateBody = await update.json() as { ok?: boolean; action?: string; publicMap?: { publishMode?: string; stopCount?: number } };
  assert.equal(update.status, 200);
  assert.equal(updateBody.ok, true);
  assert.equal(updateBody.action, "update");
  assert.equal(updateBody.publicMap?.publishMode, "public_preview");
  assert.equal(updateBody.publicMap?.stopCount, 1);
  assert.equal(obs.municipalWalkMaps.get("jp-shizuoka-d1-write-sample")?.title, "D1更新サンプル");
  assert.equal(obs.municipalWalkMaps.get("jp-shizuoka-d1-write-sample")?.stop_count, 1);
  assert.equal([...obs.municipalWalkMapStops.values()].filter((row) => row.walk_map_id === "jp-shizuoka-d1-write-sample").length, 1);
  assert.equal(obs.municipalWalkMapAudit[1]?.action, "map.update");
});

test("production field detail can render from Cloudflare public readmodel without origin fallback", async () => {
  const { env, obs, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const fieldId = "535cccb1-c3d1-4a35-ab9f-2ed811f5abb5";
  obs.productionFieldDetails.set(fieldId, {
    field_id: fieldId,
    source: "school",
    admin_level: "school",
    name: "春の里小学校",
    name_kana: null,
    summary: "地域の観察フィールド",
    prefecture: "愛知",
    city: "岡崎市",
    public_cell: "34.95,137.17",
    public_lat: 34.95,
    public_lng: 137.17,
    radius_m: 200,
    area_ha: 1.2,
    has_polygon: 1,
    has_simplified_geometry: 1,
    certification_id: null,
    certification_url: null,
    official_url: "https://example.test/field",
    owner_url: null,
    story_url: null,
    verification_level: "registry_matched",
    verification_method: "public_registry",
    verification_label: "認定情報と一致",
    source_confidence: 0.95,
    valid_from: null,
    valid_to: null,
    entity_key: null,
    updated_at: "2026-06-17T00:00:00.000Z"
  });
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request(`https://ikimon.life/ja/community/fields/${fieldId}`), productionEnv);
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-ikimon-cloudflare-native"), "field-detail-readmodel");
    assert.equal(body.includes("春の里小学校"), true);
    assert.equal(body.includes("34.95,137.17"), true);
    assert.equal(body.includes("data-cloudflare-source=\"field-detail-readmodel\""), true);
    assert.equal(body.includes("137.17123"), false);
    assert.equal(body.includes("geom_simplified"), false);
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production field detail public-detail API exposes public-safe readmodel only", async () => {
  const { env, obs } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const fieldId = "84577038-21e9-4d57-92bd-d48b5ff407c0";
  obs.productionFieldDetails.set(fieldId, {
    field_id: fieldId,
    source: "nature_symbiosis_site",
    admin_level: null,
    name: "ビオトープながおか",
    name_kana: null,
    summary: "申請者: NPO Longhill Net",
    prefecture: "愛知",
    city: "稲沢市",
    public_cell: "35.25,136.69",
    public_lat: 35.25,
    public_lng: 136.69,
    radius_m: 200,
    area_ha: 0.1,
    has_polygon: 0,
    has_simplified_geometry: 0,
    certification_id: "R5Early42_Biotope_Nagaoka",
    certification_url: "",
    official_url: "https://policies.env.go.jp/nature/biodiversity/30by30alliance/kyousei/nintei/index.html",
    owner_url: "",
    story_url: "",
    verification_level: "registry_matched",
    verification_method: "public_registry",
    verification_label: "認定情報と一致",
    source_confidence: 0.95,
    valid_from: "",
    valid_to: "",
    entity_key: "",
    updated_at: "2026-04-27 12:28:48.583595+09"
  });
  const response = await worker.fetch(new Request(`https://ikimon.life/api/v1/fields/${fieldId}/public-detail`), productionEnv);
  const payload = await response.json() as any;
  const text = JSON.stringify(payload);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-ikimon-cloudflare-native"), "field-detail-readmodel");
  assert.equal(payload.ok, true);
  assert.equal(payload.field.publicLocation.cell, "35.25,136.69");
  assert.equal(payload.privacy.exactLocationExposed, false);
  assert.equal(payload.privacy.geometryExposed, false);
  assert.equal(text.includes("\"publicLocation\""), true);
  assert.equal(text.includes("\"polygon\""), false);
  assert.equal(text.includes("\"geom_simplified\""), false);
});

test("production original UI html misses return 404 without origin fallback", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const fieldId = "535cccb1-c3d1-4a35-ab9f-2ed811f5abb5";
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("origin should not be used", { status: 500 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request(`https://ikimon.life/ja/community/fields/${fieldId}?viewer=1`), productionEnv);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { ok: false, error: "html_not_materialized" });
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production place snapshot renders from D1 readmodel without origin fallback", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const fieldId = "84577038-21e9-4d57-92bd-d48b5ff407c0";
  env.OBS_DB.productionFieldDetails.set(fieldId, {
    field_id: fieldId,
    source: "natural_symbiosis_site",
    admin_level: "certified_area",
    name: "ビオトープながおか",
    name_kana: null,
    summary: "公開情報から作成した場所の概要です。",
    prefecture: "岐阜県",
    city: "瑞穂市",
    public_cell: "35.25,136.69",
    public_lat: 35.25012,
    public_lng: 136.69098,
    radius_m: 200,
    area_ha: 0.1,
    has_polygon: 0,
    has_simplified_geometry: 0,
    certification_id: "R5Early42_Biotope_Nagaoka",
    certification_url: "https://example.test/certification",
    official_url: "https://example.test/official",
    owner_url: null,
    story_url: null,
    verification_level: "registry_matched",
    verification_method: "public_registry",
    verification_label: "認定情報と一致",
    source_confidence: 0.95,
    valid_from: null,
    valid_to: null,
    entity_key: null,
    updated_at: "2026-04-27T03:28:48.583Z"
  });
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("origin should not be used", { status: 500 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request(`https://ikimon.life/places/${fieldId}/snapshot`), productionEnv);
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-ikimon-cloudflare-native"), "place-snapshot-readmodel");
    assert.match(body, /data-ikimon-place-snapshot="1"/);
    assert.match(body, /ビオトープながおか/);
    assert.match(body, /35\.25,136\.69/);
    assert.doesNotMatch(body, /35\.25012|136\.69098/);
    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);

    const localized = await worker.fetch(new Request(`https://ikimon.life/en/places/${fieldId}/snapshot`), productionEnv);
    const localizedBody = await localized.text();
    assert.equal(localized.status, 200);
    assert.match(localizedBody, /Place snapshot/);
    assert.equal(fallbackCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production materialized auth html personalizes redirect query without origin fallback", async () => {
  const { env } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  await env.ASSET_BUCKET.put("original-ui/html/en/register.html", [
    "<!doctype html><title>Register</title>",
    "<form data-auth-form data-redirect=\"/record\"></form>",
    "<a href=\"/en/login?redirect=%2Frecord\">login</a>",
    "<a href=\"/auth/oauth/google/start?redirect=%2Frecord\">google</a>"
  ].join(""), { httpMetadata: { contentType: "text/html; charset=utf-8" } });
  await env.ASSET_BUCKET.put("original-ui/html/ja/login.html", [
    "<!doctype html><title>Login</title>",
    "<form data-auth-form data-redirect=\"/record\"></form>",
    "<span class=\"auth-social-disabled\">Google で続ける は設定中</span>",
    "<span class=\"auth-social-disabled\">X(Twitter) で続ける は設定中</span>"
  ].join(""), { httpMetadata: { contentType: "text/html; charset=utf-8" } });

  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("origin should not be used", { status: 500 });
  }) as typeof fetch;
  try {
    const explicitResponse = await worker.fetch(new Request("https://ikimon.life/register?redirect=%2Frecord%3Fstart%3Dnote&lang=en"), productionEnv);
    const explicitHtml = await explicitResponse.text();
    assert.equal(explicitResponse.status, 200);
    assert.equal(explicitResponse.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");
    assert.match(explicitHtml, /data-redirect="\/record\?start=note"/);
    assert.match(explicitHtml, /\/en\/login\?redirect=%2Frecord%3Fstart%3Dnote/);
    assert.match(explicitHtml, /\/auth\/oauth\/google\/start\?redirect=%2Frecord%3Fstart%3Dnote/);

    const bareResponse = await worker.fetch(new Request("https://ikimon.life/register?redirect=%2Frecord&lang=en"), productionEnv);
    const bareHtml = await bareResponse.text();
    assert.equal(bareResponse.status, 200);
    assert.match(bareHtml, /data-redirect="\/record\?start=photo"/);
    assert.match(bareHtml, /\/en\/login\?redirect=%2Frecord%3Fstart%3Dphoto/);

    const loginResponse = await worker.fetch(new Request("https://ikimon.life/ja/login?redirect=%2Fprofile"), productionEnv);
    const loginHtml = await loginResponse.text();
    assert.equal(loginResponse.status, 200);
    assert.match(loginHtml, /href="\/auth\/oauth\/google\/start\?redirect=%2Fprofile"/);
    assert.match(loginHtml, /href="\/auth\/oauth\/twitter\/start\?redirect=%2Fprofile"/);
    assert.doesNotMatch(loginHtml, /auth-social-disabled/);
    assert.doesNotMatch(loginHtml, /設定中/);

    const oauthStart = await worker.fetch(new Request("https://ikimon.life/auth/oauth/google/start?redirect=%2Fprofile"), {
      ...productionEnv,
      GOOGLE_CLIENT_ID: "google-client",
      GOOGLE_CLIENT_SECRET: "google-secret",
      V2_OAUTH_STATE_SECRET: "state-secret"
    });
    assert.equal(oauthStart.status, 303);
    assert.match(oauthStart.headers.get("location") ?? "", /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
    assert.match(oauthStart.headers.get("set-cookie") ?? "", /^ikimon_oauth_state=/);
    assert.equal(fallbackCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production public health endpoints are served by Cloudflare instead of origin fallback", async () => {
  const { env } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const health = await worker.fetch(new Request("https://ikimon.life/healthz"), productionEnv);
    assert.equal(health.status, 200);
    const healthPayload = await health.json() as any;
    assert.equal(healthPayload.ok, true);
    assert.equal(healthPayload.service, "ikimon-life-cloudflare-worker");
    assert.equal(healthPayload.buildMarker, "top-record-feed-20260628");

    const ready = await worker.fetch(new Request("https://ikimon.life/readyz"), productionEnv);
    assert.equal(ready.status, 200);
    const readyPayload = await ready.json() as any;
    assert.equal(readyPayload.ok, true);
    assert.equal(readyPayload.buildMarker, "top-record-feed-20260628");
    assert.equal(readyPayload.coreDb, "ok");
    assert.equal(readyPayload.observationDb, "ok");
    assert.equal(fallbackCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production reflection loop manifest is served by Cloudflare instead of origin fallback", async () => {
  const { env } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("fallback should not be called", { status: 599 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/qa/reflection-loop.json"), productionEnv);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    const payload = await response.json() as any;
    const text = JSON.stringify(payload);
    assert.equal(payload.ok, true);
    assert.equal(payload.service, "ikimon.life");
    assert.equal(payload.runtime, "cloudflare-worker");
    assert.equal(payload.manifest_path, "/qa/reflection-loop.json");
    assert.equal(payload.loop_contract.no_personal_data, true);
    assert.equal(payload.analytics.ga4_measurement_id, "G-NCL0M1VJZ2");
    assert.equal(payload.analytics.clarity_project_id, "wl2ezvfqbh");
    assert.equal(payload.coverage.cloudflare_worker.public_html_path_count > 50, true);
    assert.equal(payload.coverage.cloudflare_worker.smoke_paths.includes("/qa/reflection-loop.json"), true);
    assert.equal(payload.coverage.node_platform.registry_source, "platform_v2/src/siteMap.ts");
    assert.equal(payload.improvement_loop.priority_basis.continuously_updated, true);
    assert.equal(text.includes("GOOGLE_CLIENT_SECRET"), false);
    assert.equal(text.includes("TWITTER_CLIENT_SECRET"), false);
    assert.equal(text.includes("INTERNAL_AUTH_TOKEN"), false);
    assert.equal(fallbackCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

async function post(path: string, env: ReturnType<typeof createEnv>["env"], body: unknown): Promise<any> {
  const response = await worker.fetch(new Request(`https://shadow.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  }), env);
  const payload = await response.json() as any;
  assert.equal(response.ok, true, JSON.stringify(payload));
  return payload;
}

function normalize(query: string): string {
  return query.replace(/\s+/g, " ").trim();
}

function requireRow<T>(map: Map<string, T>, key: string): T {
  const value = map.get(key);
  if (!value) throw new Error(`missing row ${key}`);
  return value;
}

function string(value: D1Value | undefined): string {
  if (typeof value !== "string") throw new Error(`expected string: ${value}`);
  return value;
}

function number(value: D1Value | undefined): number {
  if (typeof value !== "number") throw new Error(`expected number: ${value}`);
  return value;
}

function nullableString(value: D1Value | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function nullableNumber(value: D1Value | undefined): number | null {
  return typeof value === "number" ? value : null;
}

function likePrefix(value: string): string {
  return value.endsWith("%") ? value.slice(0, -1) : value;
}

function payloadObservationId(row: RollbackLedgerRow): string | null {
  const payload = JSON.parse(row.payload_json) as { observationId?: string };
  return typeof payload.observationId === "string" ? payload.observationId : null;
}
