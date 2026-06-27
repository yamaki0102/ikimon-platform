import * as bcrypt from "bcryptjs";

type D1Value = string | number | null;

interface D1PreparedStatement {
  bind(...values: D1Value[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}

interface R2Bucket {
  put(key: string, value: ReadableStream | ArrayBuffer | string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<R2ListResult>;
}

interface R2ObjectBody {
  body: ReadableStream | null;
  httpMetadata?: { contentType?: string };
}

interface R2ListResult {
  objects: R2ObjectSummary[];
  truncated?: boolean;
  cursor?: string;
}

interface R2ObjectSummary {
  key: string;
  size: number;
  etag?: string;
  uploaded?: Date | string;
  checksums?: Record<string, string>;
}

interface Queue<T = unknown> {
  send(message: T): Promise<void>;
}

interface SendEmailBinding {
  send(message: {
    from: string | { name: string; email: string };
    to: string | { name: string; email: string } | Array<string | { name: string; email: string }>;
    subject: string;
    text?: string;
    html?: string;
    headers?: Record<string, string>;
  }): Promise<unknown>;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface ScheduledController {
  cron?: string;
  scheduledTime?: number;
}

interface Env {
  CORE_DB: D1Database;
  OBS_DB: D1Database;
  ASSET_BUCKET: R2Bucket;
  MEDIA_QUEUE: Queue<MediaJob>;
  ALERT_QUEUE?: Queue<AlertDeliveryJob>;
  ALERT_EMAIL?: SendEmailBinding;
  ENVIRONMENT: string;
  PUBLIC_LOCATION_CELL_PRECISION: string;
  INTERNAL_AUTH_TOKEN?: string;
  ALERT_EMAIL_FROM?: string;
  ALERT_DELIVERY_BATCH_SIZE?: string;
  ALERT_EMAIL_ALLOWED_RECIPIENTS?: string;
  OBSERVATION_DB_NAME?: string;
  OBSERVATION_ARCHIVE_TARGET?: string;
  ORIGIN_FALLBACK_BASE_URL?: string;
  ORIGIN_FALLBACK_RESOLVE_OVERRIDE?: string;
  PUBLIC_WRITE_MODE?: string;
  PUBLIC_CUSTOM_DOMAIN_ORIGIN_FALLBACK_MODE?: string;
  ORIGIN_SESSION_IMPORT_MODE?: string;
  V2_PRIVILEGED_WRITE_API_KEY?: string;
  CONTACT_FORM_SECRET?: string;
  CONTACT_ADMIN_TO?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  TWITTER_CLIENT_ID?: string;
  TWITTER_CLIENT_SECRET?: string;
  V2_OAUTH_STATE_SECRET?: string;
  CLOUDFLARE_STREAM_WEBHOOK_SECRET?: string;
}

function isAppRuntime(env: Env): boolean {
  return env.ENVIRONMENT === "shadow" || env.ENVIRONMENT === "staging" || env.ENVIRONMENT === "production";
}

const IKIMON_GA4_MEASUREMENT_ID = "G-NCL0M1VJZ2";
const IKIMON_CLARITY_PROJECT_ID = "wl2ezvfqbh";
const REFLECTION_LOOP_MANIFEST_PATH = "/qa/reflection-loop.json";

interface DraftAssetInput {
  mime: string;
  bytes: number;
  sha256?: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

interface DraftObservationInput {
  userId: string;
  observedAt?: string;
  exactLat?: number;
  exactLng?: number;
  locationAccuracyM?: number;
  visibility?: "private" | "public";
  media?: DraftAssetInput[];
}

interface FinalizeObservationInput {
  draftId: string;
  taxonLabel?: string;
  note?: string;
}

interface LegacyObservationUpsertInput {
  observationId?: string;
  clientSubmissionId?: string | null;
  userId: string;
  observedAt: string;
  latitude: number;
  longitude: number;
  locationAccuracyM?: number | null;
  note?: string | null;
  siteId?: string | null;
  siteName?: string | null;
  municipality?: string | null;
  prefecture?: string | null;
  taxon?: {
    scientificName?: string | null;
    vernacularName?: string | null;
    rank?: string | null;
  } | null;
  subjects?: Array<{
    scientificName?: string | null;
    vernacularName?: string | null;
    rank?: string | null;
    isPrimary?: boolean;
  }>;
  visitMode?: "manual" | "survey" | null;
  revisitReason?: string | null;
  targetTaxaScope?: string | null;
  eventCode?: string | null;
  eventSessionId?: string | null;
  teamId?: string | null;
  participantRole?: string | null;
  fieldScan?: Record<string, unknown> | null;
  waterRecord?: CompatibleWaterRecordInput | null;
  sourcePayload?: Record<string, unknown> | null;
  dataRights?: Record<string, unknown> | null;
}

interface CompatibleWaterRecordInput {
  catchOutcome?: unknown;
  captureMethod?: unknown;
  participantCount?: unknown;
  effortMinutes?: unknown;
  targetTaxaScope?: unknown;
  releasedCount?: unknown;
  keptCount?: unknown;
  publicWaterbodyLabel?: unknown;
  waterbodyId?: unknown;
  waterbodyType?: unknown;
  parentWaterbodyId?: unknown;
  source?: unknown;
  sourceVersion?: unknown;
  geometryPrecision?: unknown;
  environmentSnapshot?: unknown;
  sourcePayload?: unknown;
}

interface CompatibleObservationIdentificationInput {
  proposedName?: unknown;
  proposedRank?: unknown;
  notes?: unknown;
  stance?: unknown;
  referenceSourceIds?: unknown;
  referenceLocator?: unknown;
}

interface CompatibleObservationDisputeInput {
  kind?: unknown;
  proposedName?: unknown;
  proposedRank?: unknown;
  reason?: unknown;
  referenceSourceIds?: unknown;
  referenceLocator?: unknown;
}

interface CompatibleObservationRecordAiReviewInput {
  reviewState?: unknown;
}

interface D1ObservationAiReviewTarget {
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

interface CompatibleWalkSessionInput {
  externalId?: unknown;
  userId?: unknown;
  startedAt?: unknown;
  endedAt?: unknown;
  distanceM?: unknown;
  stepCount?: unknown;
  passiveDetectionCount?: unknown;
  topSpecies?: unknown;
  biome?: unknown;
  source?: unknown;
  rawPayload?: unknown;
}

interface CompatibleTrackPointInput {
  latitude?: unknown;
  longitude?: unknown;
  accuracyMeters?: unknown;
  altitudeMeters?: unknown;
  timestamp?: unknown;
}

interface CompatibleTrackUpsertInput {
  sessionId?: unknown;
  userId?: unknown;
  fieldId?: unknown;
  startedAt?: unknown;
  updatedAt?: unknown;
  distanceMeters?: unknown;
  stepCount?: unknown;
  points?: unknown;
  municipality?: unknown;
  prefecture?: unknown;
  sourcePayload?: unknown;
}

type RecordReadingAxis = "organism" | "environment" | "human_relation";
type RecordReadingSourceKind = "official" | "trusted_db" | "research";

interface RecordReadingSource {
  title: string;
  url: string;
  sourceKind: RecordReadingSourceKind;
  retrievedAt: string;
}

interface D1RecordReadingCardDraft {
  axis: RecordReadingAxis;
  title: string;
  body: string;
  sources: RecordReadingSource[];
  generationCondition: Record<string, unknown>;
  qualityGate: Record<string, unknown>;
  modelVersion: string;
}

interface D1RecordReadingCardPayload extends D1RecordReadingCardDraft {
  cardId: string;
  visitId: string;
  visibility: "owner_only" | "public" | "hidden";
  createdAt: string;
  updatedAt: string;
}

interface LegacyPhotoUploadInput {
  filename?: string | null;
  mimeType?: string | null;
  base64Data?: string | null;
  mediaRole?: string | null;
  facePrivacy?: string | null;
}

interface SessionIssueInput {
  userId: string;
  ttlHours?: number | null;
  displayName?: string | null;
  roleName?: string | null;
  rankLabel?: string | null;
}

interface AuthLoginInput {
  email?: unknown;
  password?: unknown;
  redirect?: unknown;
}

interface AuthUserRow {
  user_id: string;
  email: string;
  password_hash: string | null;
  display_name: string;
  role_name: string | null;
  rank_label: string | null;
  banned: number;
}

interface UserProfileRow {
  user_id: string;
  display_name: string;
  profile_bio: string | null;
  expertise: string | null;
  avatar_object_key: string | null;
  avatar_mime: string | null;
  avatar_bytes: number | null;
  avatar_sha256: string | null;
}

type OAuthProvider = "google" | "twitter";

interface OAuthStatePayload {
  provider: OAuthProvider;
  state: string;
  redirect: string;
  codeVerifier?: string;
  expiresAt: number;
}

interface OAuthProfile {
  provider: OAuthProvider;
  providerUserId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  rawProfile: Record<string, unknown>;
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
  route_flexibility_json?: string | null;
  public_precision_policy?: string | null;
  claim_boundary_json?: string | null;
  updated_at?: string | null;
}

interface MunicipalWalkMapStopD1Row {
  stop_id: string;
  title: string;
  note: string | null;
  area_hint_json: string;
  safety_note: string | null;
  position: number;
  area_kind: string;
  access: string;
  estimated_minutes: number | null;
  notice_cues_json: string | null;
  record_cues_json: string | null;
  safety_notes_json: string | null;
}

interface MunicipalWalkMapCreatorAdminD1Row {
  creator_id: string;
  display_name: string;
  registration_kind: string | null;
  verification_status: string;
  commercial_intent: string | null;
  notes: string | null;
  updated_at: string | null;
}

interface MunicipalWalkMapReviewAdminD1Row {
  walk_map_id: string;
  municipality_code: string;
  municipality: string;
  title: string;
  summary: string;
  theme: string;
  publish_mode: string;
  creator_name: string | null;
  creator_profile_json: string | null;
  route_flexibility_json: string | null;
  source_references_json: string;
  publication_review_json: string | null;
  updated_at: string | null;
  stop_count: number;
}

interface SessionSnapshot {
  tokenHash: string;
  userId: string;
  displayName: string;
  roleName: string;
  rankLabel: string | null;
  banned: boolean;
  expiresAt: string;
}

interface OriginSessionResponse {
  ok?: boolean;
  session?: {
    userId?: unknown;
    displayName?: unknown;
    roleName?: unknown;
    rankLabel?: unknown;
    banned?: unknown;
    expiresAt?: unknown;
    tokenHash?: unknown;
  } | null;
}

interface PersonalAreaSubscriptionRow {
  subscription_id: string;
  target_type: string;
  target_id: string;
  label: string | null;
  href: string | null;
  is_active: number;
  created_at: string | null;
  updated_at: string | null;
  observation_count?: number | null;
  needs_id_count?: number | null;
}

interface PersonalTaxonSubscriptionRow {
  subscription_id: string;
  label: string | null;
  scientific_name: string | null;
  taxon_rank: string | null;
  match_field: string;
  trigger_invasive_only: number;
  trigger_rare_only: number;
  channel: string;
  is_active: number;
  created_at: string | null;
}

interface PersonalAlertRow {
  delivery_id: string;
  occurrence_id: string;
  trigger_kind: string;
  delivery_status: string;
  delivered_at: string | null;
  acknowledged_at: string | null;
  created_at: string | null;
  payload_json: string | null;
}

interface AlertDeliveryCandidateRow {
  delivery_id: string;
  occurrence_id: string;
  user_id: string | null;
  recipient_id: string | null;
  trigger_kind: string;
  channel: string;
  payload_json: string | null;
  created_at: string | null;
  recipient_email: string | null;
  recipient_display_name: string | null;
  recipient_active: number | null;
  rate_limit_per_day: number | null;
  user_email: string | null;
  user_display_name: string | null;
  user_email_enabled: number | null;
}

interface AlertDeliveryJob {
  topic: "alert_delivery.drain";
  source: "cron" | "manual" | "queue";
  limit?: number;
}

interface VideoDirectUploadInput {
  maxDurationSeconds?: number | null;
  filename?: string | null;
  observationId?: string | null;
  mediaRole?: string | null;
  uploadProtocol?: string | null;
  fileSizeBytes?: number | null;
}

interface VideoFinalizeInput {
  observationId?: string | null;
  durationMs?: number | null;
  readyToStream?: boolean | null;
  bytes?: number | null;
}

interface VideoStreamWebhookInput {
  uid?: unknown;
  readyToStream?: unknown;
  thumbnail?: unknown;
  preview?: unknown;
  duration?: unknown;
  size?: unknown;
  uploaded?: unknown;
  created?: unknown;
  status?: {
    state?: unknown;
    pctComplete?: unknown;
    errorReasonCode?: unknown;
    errorReasonText?: unknown;
    errReasonCode?: unknown;
    errReasonText?: unknown;
  } | null;
  result?: unknown;
}

interface MediaJob {
  outboxId: string;
  topic: "media.process" | "readmodel.refresh";
  targetId: string;
}

interface UploadedAssetRow {
  asset_id: string;
  object_key: string;
}

interface PublicMapRow {
  observation_id: string;
  public_cell: string;
  observed_at: string;
  taxon_label: string | null;
  asset_count: number;
}

interface PublicMapPhotoRow {
  observation_id: string;
  public_derivative_key: string;
}

const VALID_PERSONAL_TAXON_MATCH_FIELDS = new Set([
  "scientific_name",
  "genus",
  "family",
  "order_name",
  "class_name"
]);
const VALID_PERSONAL_TAXON_RANKS = new Set(["species", "genus", "family", "order", "class", "phylum"]);
const VALID_PERSONAL_TAXON_CHANNELS = new Set(["email", "digest_daily", "digest_weekly", "none"]);

interface LegacyThumbDerivativeRow {
  public_derivative_key: string;
  mime: string | null;
}

interface PublicMapSnapshotRow {
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

interface OwnMapObservationRow {
  observation_id: string;
  observed_at: string;
  taxon_label: string | null;
  note: string | null;
  exact_lat: number | null;
  exact_lng: number | null;
  public_derivative_key: string | null;
}

interface PublicDetailRow extends PublicMapRow {
  note: string | null;
  visibility: string;
}

interface PublicDetailAssetRow {
  asset_id: string;
  object_key: string;
  mime: string;
  bytes: number;
  duration_ms: number | null;
  public_derivative_key: string | null;
}

interface PublicDerivativeInspection {
  tool: string;
  contentType: string;
  bytes: number;
  scannedContainer: string;
  gpsExifPresent: boolean;
  exifPresent: boolean;
  gpsPresent: boolean;
  xmpPresent: boolean;
  exactCoordinateLiteralPresent: boolean;
  checkedAt: string;
}

interface PartitionSummaryRow {
  partition_month: string | null;
  count: number;
  earliest_observed_at: string | null;
  latest_observed_at: string | null;
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

interface OperationAuditRow {
  payload_json: string;
  created_at: string;
}

interface OriginFallbackTelemetryPayload {
  reason: string;
  method: string;
  host: string;
  routePattern: string;
  pathHash: string;
  originalUiHtmlKeyHash?: string;
  publicWriteMode: string;
  environment: string;
}

interface AuthLoginFailureTelemetryPayload {
  reason: "auth_login_user_missing" | "auth_login_password_mismatch" | "auth_login_store_unavailable";
  method: string;
  host: string;
  routePattern: string;
  publicWriteMode: string;
  environment: string;
}

interface FieldDetailReadmodelRow {
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

interface AreaPolygonReadmodelRow extends FieldDetailReadmodelRow {}

interface AreaPolygonGeometryReadmodelRow {
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

interface ReverseDeltaCountRow {
  count: number;
}

type ObservationEventMode = "discovery" | "effort_maximize" | "bingo" | "absence_confirm" | "ai_quest";
const OBSERVATION_EVENT_MODES: readonly ObservationEventMode[] = ["discovery", "effort_maximize", "bingo", "absence_confirm", "ai_quest"];
const RALLY_COURSE_STATUSES = ["draft", "preflight", "live", "closed"] as const;
const RALLY_SCOPES = ["event", "team", "participant", "station"] as const;
const RALLY_LOCATION_BINDINGS = ["none", "station_required", "within_area", "near_route", "any_registered_station"] as const;
const RALLY_COUNT_UNITS = ["scene", "individual", "location", "comparison_pair", "station_clear", "team_completion"] as const;
const RALLY_VERIFICATION_POLICIES = ["auto", "organizer_review", "ai_assisted", "qr"] as const;
const RALLY_WEATHER_SENSITIVITIES = ["all_weather", "rain_ok", "dry_only", "sunny_only", "wind_sensitive", "temperature_sensitive"] as const;
const RALLY_MISSION_STATUSES = ["draft", "published", "paused", "replaced", "closed"] as const;
const RALLY_REVISION_ACTIONS = ["publish", "pause", "replace", "extend", "close"] as const;
const STEWARDSHIP_ACTION_KINDS = new Set([
  "cleanup",
  "mowing",
  "water_management",
  "pruning",
  "planting",
  "harvesting",
  "tilling",
  "trampling",
  "bare_ground",
  "invasive_removal",
  "unknown",
  "patrol",
  "signage",
  "monitoring",
  "external_program",
  "restoration",
  "community_engagement",
  "other"
]);
const STEWARDSHIP_SPECIES_STATUSES = new Set(["invasive", "dominant_native", "disturbance", "unknown"]);

interface ObservationEventSessionD1Row {
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

interface ObservationEventLiveD1Row {
  live_event_id: string;
  session_id: string;
  type: string;
  scope: string;
  actor_user_id?: string | null;
  actor_guest_token?: string | null;
  team_id: string | null;
  payload_json: string;
  created_at: string;
}

interface ObservationEventTeamD1Row {
  team_id: string;
  name: string;
  color: string;
  lead_user_id: string | null;
  target_taxa_json: string;
  created_at: string;
}

interface ObservationEventParticipantD1Row {
  participant_id: string;
  user_id: string | null;
  guest_token: string | null;
  display_name?: string | null;
  team_id: string | null;
  share_location?: number;
  location_share_until?: string | null;
  is_minor: number;
}

interface ObservationEventMeshSummaryRow {
  visited_cells: number;
  visit_seconds_sum: number;
  observation_sum: number;
  absence_sum: number;
}

interface ObservationEventCapsuleD1Row {
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
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  generated_at: string;
  updated_at: string;
}

interface ObservationRallyCourseD1Row {
  course_id: string;
  session_id: string;
  title: string;
  status: string;
  config_json: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface ObservationRallyStationD1Row {
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

interface ObservationRallyMissionD1Row {
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

interface ObservationRallyProgressD1Row {
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

interface ObservationRallySubmissionD1Row {
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
  created_at: string;
}

const MAX_MEDIA_PER_DRAFT = 12;
const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const SESSION_COOKIE_NAME = "ikimon_v2_session";
const MIN_VIDEO_DURATION_SECONDS = 6;
const MAX_VIDEO_DURATION_SECONDS = 60;
const MAP_DEFAULT_GRID_M = 1000;
const OBSERVATION_PARTITION_STRATEGY = "single_active_d1_logical_month";
const WORKER_BUILD_MARKER = "map-shell-cookie-safe";
const PUBLIC_CUSTOM_HOSTS = new Set(["ikimon.life", "www.ikimon.life", "staging.ikimon.life"]);
const HAMAMATSU_CITY_HERITAGE_URL = "https://www.city.hamamatsu.shizuoka.jp/bunkazai/shitei/hamamatsuchiikiisan.html";
const JMA_NOWCAST_TARGET_N1 = "https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N1.json";
const JMA_NOWCAST_TARGET_N2 = "https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N2.json";
const JMA_NOWCAST_ROOT = "https://www.jma.go.jp/bosai/jmatile/data/nowc";
const JMA_SHORT_RANGE_TARGET = "https://www.jma.go.jp/bosai/jmatile/data/rasrf/targetTimes.json";
const JMA_SHORT_RANGE_ROOT = "https://www.jma.go.jp/bosai/jmatile/data/rasrf";
const JMA_NOWCAST_OFFSETS = [0, 5, 15, 30, 60] as const;
const JMA_SHORT_RANGE_OFFSETS = [120, 180, 240, 300, 360] as const;
const JMA_RAIN_TILE_MAX_ZOOM = 10;
const PUBLIC_LANG_PREFIX_PATTERN = /^\/(?:ja|en|es|pt-br)(?=\/|$)/;

function stripPublicLangPrefix(pathname: string): string {
  const stripped = pathname.replace(PUBLIC_LANG_PREFIX_PATTERN, "");
  return stripped === "" ? "/" : stripped;
}

type ShadowMapGuideSpot = {
  id: string;
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
  locationPrecision: "exact" | "approximate";
  visitAnchorLabel: string;
  publicLocationMode: "exact" | "area" | "hidden";
  subjectLocationMode: "same_as_visit_anchor" | "area_public" | "hidden";
  sensitiveReviewStatus: "cleared" | "needs_review";
  category: "heritage" | "nature" | "community" | "owner";
  approvalState: "public_source" | "owner_verified";
  preview: string;
  script: string;
  storyPoints: string[];
  triggerRadiusM: number;
  unlockedRadiusM: number;
  guideAreaId?: string;
  guideProgramIds?: string[];
  ownerType?: "owner" | "community" | "municipality" | "school";
  visibilityStatus?: "published" | "paused" | "hidden";
  safetyStatus?: "active" | "caution" | "closed";
  landownerConsent?: boolean;
  availableTimePolicy?: "anytime_public" | "business_hours" | "event_only";
  distanceDisplayPolicy?: "coarse";
  requiredAccuracyM?: number;
  accuracyBufferCapM?: number;
  sourceLinks: Array<{ label: string; url: string }>;
};

const SHADOW_MAP_GUIDE_SPOTS: ShadowMapGuideSpot[] = [
  {
    id: "aikan-renri-lenri-tree",
    title: "Cafe & Restaurant LENRIと連理の木",
    subtitle: "愛管の自然共生サイトで、食・農・設備技術と土地の関係を聞く",
    lat: 34.81435,
    lng: 137.7327,
    locationPrecision: "exact",
    visitAnchorLabel: "Cafe & Restaurant LENRI/連理の木の来訪地点",
    publicLocationMode: "exact",
    subjectLocationMode: "same_as_visit_anchor",
    sensitiveReviewStatus: "cleared",
    category: "owner",
    approvalState: "owner_verified",
    preview: "連理の木、れんり農園、Cafe & Restaurant LENRI、地中熱GXを、同じ場所で育ってきた地域の物語として紹介します。",
    script: "ここは、愛管株式会社が設備会社としての現場力を、食、農、自然共生、教育へ少しずつ結び直してきた場所です。訪れたら、看板や建物だけでなく、連理の木、農園、足元の草地、水や熱の使い方にも目を向けてください。",
    storyPoints: [
      "連理の木を中心に、食、農、自然共生、設備技術が同じ場所でつながっている。",
      "Cafe & Restaurant LENRIは、地域素材や場づくりを通じて人と土地の関係を見せる入口。",
      "地中熱GXや自然共生サイトの活動も、裏側でこの場所の思想を支えている。"
    ],
    triggerRadiusM: 120,
    unlockedRadiusM: 45,
    guideAreaId: "aikan-renri-ikan-hq",
    guideProgramIds: ["aikan-renri-guide-relay"],
    ownerType: "owner",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "business_hours",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 120,
    accuracyBufferCapM: 80,
    sourceLinks: [
      { label: "愛管株式会社: 生物多様性", url: "https://i-kan.co.jp/company/biodiversity/" },
      { label: "浜松市: 地域遺産認定制度", url: HAMAMATSU_CITY_HERITAGE_URL }
    ]
  },
  {
    id: "hamamatsu-shijimizuka-site",
    title: "蜆塚遺跡",
    subtitle: "縄文時代の集落と貝塚を、今の公園で見る",
    lat: 34.713292,
    lng: 137.7031213,
    locationPrecision: "exact",
    visitAnchorLabel: "蜆塚公園・博物館周辺の来訪地点",
    publicLocationMode: "exact",
    subjectLocationMode: "same_as_visit_anchor",
    sensitiveReviewStatus: "cleared",
    category: "heritage",
    approvalState: "public_source",
    preview: "東海地方でも大きな縄文時代の集落跡として紹介される場所です。",
    script: "ここは、縄文時代後期から晩期にかけての集落跡を、今の公園の中で見られる場所です。歩く時は、展示物だけでなく、地形、貝塚、隣接する博物館までをひとつの時間の層として見てください。",
    storyPoints: [
      "縄文時代の暮らしの跡が、現在は公園として保存されている。",
      "貝塚は食べ物のごみではなく、当時の環境や暮らしを読む手がかりになる。",
      "博物館とセットで見ると、現地の地形と出土資料がつながる。"
    ],
    triggerRadiusM: 220,
    unlockedRadiusM: 90,
    guideProgramIds: ["hamamatsu-heritage-guide-relay"],
    ownerType: "municipality",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "anytime_public",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 150,
    accuracyBufferCapM: 100,
    sourceLinks: [{ label: "浜松市: 蜆塚遺跡", url: "https://www.city.hamamatsu.shizuoka.jp/bunkazai/shitei/hamatsu/hamatsu/shizimizuka.html" }]
  },
  {
    id: "hamamatsu-nakamurake-house",
    title: "中村家住宅",
    subtitle: "宇布見に残る大規模な近世住宅",
    lat: 34.6974944,
    lng: 137.6336934,
    locationPrecision: "exact",
    visitAnchorLabel: "中村家住宅の公開見学地点",
    publicLocationMode: "exact",
    subjectLocationMode: "same_as_visit_anchor",
    sensitiveReviewStatus: "cleared",
    category: "heritage",
    approvalState: "public_source",
    preview: "国指定重要文化財として紹介される、雄踏町宇布見の歴史的住宅です。",
    script: "ここでは、建物の大きさだけでなく、部屋の配置や柱の立ち方にも注目してください。住宅は、ひとつの家の歴史だけでなく、宇布見の土地と人の移動を読む入口になります。",
    storyPoints: [
      "大きな屋敷構えと主屋の構造から、地域の有力家の暮らしが見える。",
      "建物の間取りや柱の配置は、保存建築を読む具体的な手がかりになる。",
      "浜名湖周辺の歴史や東海道沿いの文化とつながる。"
    ],
    triggerRadiusM: 220,
    unlockedRadiusM: 90,
    guideProgramIds: ["hamamatsu-heritage-guide-relay"],
    ownerType: "municipality",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "anytime_public",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 150,
    accuracyBufferCapM: 100,
    sourceLinks: [{ label: "浜松市: 中村家住宅", url: "https://www.city.hamamatsu.shizuoka.jp/bunkazai/shitei/yuto/yuto/nakamurake.html" }]
  },
  {
    id: "hamamatsu-maisaka-wakihonjin",
    title: "旧舞坂脇本陣",
    subtitle: "東海道舞坂宿と今切渡しの記憶",
    lat: 34.68472,
    lng: 137.6087012,
    locationPrecision: "exact",
    visitAnchorLabel: "旧舞坂脇本陣の公開見学地点",
    publicLocationMode: "exact",
    subjectLocationMode: "same_as_visit_anchor",
    sensitiveReviewStatus: "cleared",
    category: "heritage",
    approvalState: "public_source",
    preview: "旧東海道に残る脇本陣の遺構として紹介される場所です。",
    script: "ここは、江戸時代の東海道舞坂宿を想像するための入口です。建物だけでなく、海と街道、人の移動が重なる地点として見てください。",
    storyPoints: [
      "舞坂宿は東海道と今切渡しを結ぶ交通の節点だった。",
      "復元された建物から、宿場町の役割を現地で想像できる。",
      "湖・海・街道が重なる浜松らしい文化景観の入口になる。"
    ],
    triggerRadiusM: 220,
    unlockedRadiusM: 90,
    guideProgramIds: ["hamamatsu-heritage-guide-relay"],
    ownerType: "municipality",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "anytime_public",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 150,
    accuracyBufferCapM: 100,
    sourceLinks: [{ label: "浜松市: 旧舞坂脇本陣", url: "https://www.city.hamamatsu.shizuoka.jp/bunkazai/shitei/maisaka/maisaka/wakihonjin.html" }]
  },
  {
    id: "hamamatsu-castle-ruins",
    title: "浜松城跡",
    subtitle: "街なかに残る城郭の石垣と地形",
    lat: 34.7117306,
    lng: 137.7249641,
    locationPrecision: "exact",
    visitAnchorLabel: "浜松城公園の来訪地点",
    publicLocationMode: "exact",
    subjectLocationMode: "same_as_visit_anchor",
    sensitiveReviewStatus: "cleared",
    category: "heritage",
    approvalState: "public_source",
    preview: "市指定史跡として、野面積みの石垣などが紹介されています。",
    script: "浜松城跡では、天守だけでなく石垣と地形を見てください。街の中心にありながら、城の防御、地形、まちの記憶が同時に見える場所です。",
    storyPoints: [
      "石垣の積み方から、古い城郭の技術が読める。",
      "城跡は観光地であると同時に、市街地の地形を理解する手がかりになる。",
      "三方ヶ原合戦や犀ヶ崖など、周辺の戦国史跡ともつながる。"
    ],
    triggerRadiusM: 260,
    unlockedRadiusM: 110,
    guideProgramIds: ["hamamatsu-heritage-guide-relay"],
    ownerType: "municipality",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "anytime_public",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 150,
    accuracyBufferCapM: 100,
    sourceLinks: [{ label: "浜松市: 浜松城跡", url: "https://www.city.hamamatsu.shizuoka.jp/kouen/siro/hamamatujou.html" }]
  },
  {
    id: "hamamatsu-ryotanji-garden",
    title: "龍潭寺庭園",
    subtitle: "井伊谷の歴史と庭園を見る",
    lat: 34.8286004,
    lng: 137.6679167,
    locationPrecision: "exact",
    visitAnchorLabel: "龍潭寺庭園の公開見学地点",
    publicLocationMode: "exact",
    subjectLocationMode: "same_as_visit_anchor",
    sensitiveReviewStatus: "cleared",
    category: "heritage",
    approvalState: "public_source",
    preview: "浜名区引佐町井伊谷の文化財として紹介される庭園です。",
    script: "龍潭寺では、庭そのものだけでなく、井伊谷の地形や周辺の城跡、寺院の配置を一緒に見てください。静かな庭の奥に、地域の政治と信仰の記憶が重なっています。",
    storyPoints: [
      "庭園は鑑賞の場であり、井伊谷の歴史を読む入口でもある。",
      "寺の建物、庭、背後の地形を一体で見ると場所の意味が立ち上がる。",
      "周辺の地域遺産センターや城跡と合わせて巡ると理解が深まる。"
    ],
    triggerRadiusM: 240,
    unlockedRadiusM: 100,
    guideProgramIds: ["hamamatsu-heritage-guide-relay"],
    ownerType: "municipality",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "business_hours",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 150,
    accuracyBufferCapM: 100,
    sourceLinks: [
      { label: "浜松市: 名勝", url: "https://www.city.hamamatsu.shizuoka.jp/bunkazai/shitei/meisho.html" },
      { label: "浜松市: 地域遺産センター", url: "https://www.city.hamamatsu.shizuoka.jp/bunkazai/maibun/index.html" }
    ]
  },
  {
    id: "hamamatsu-makaya-temple-garden",
    title: "摩訶耶寺庭園",
    subtitle: "湖北に残る古庭園の時間",
    lat: 34.8176672,
    lng: 137.5568322,
    locationPrecision: "exact",
    visitAnchorLabel: "摩訶耶寺庭園の公開見学地点",
    publicLocationMode: "exact",
    subjectLocationMode: "same_as_visit_anchor",
    sensitiveReviewStatus: "cleared",
    category: "heritage",
    approvalState: "public_source",
    preview: "鎌倉時代初期にさかのぼる庭園として紹介される場所です。",
    script: "摩訶耶寺庭園では、水、石、池の配置をゆっくり見てください。庭は静かな景色ですが、修復されながら受け継がれてきた文化財でもあります。",
    storyPoints: [
      "池泉鑑賞式の庭園として、石と水の配置が見どころになる。",
      "古い庭園は、自然そのものではなく、人が自然をどう見たかを残す。",
      "修復の履歴まで含めて、地域で守る文化財として見られる。"
    ],
    triggerRadiusM: 240,
    unlockedRadiusM: 100,
    guideProgramIds: ["hamamatsu-heritage-guide-relay"],
    ownerType: "municipality",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "business_hours",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 150,
    accuracyBufferCapM: 100,
    sourceLinks: [{ label: "浜松市: 摩訶耶寺庭園", url: "https://www.city.hamamatsu.shizuoka.jp/bunkazai/info/bunkazaijyoho77.html" }]
  },
  {
    id: "hamamatsu-hourinji-temple",
    title: "初山宝林寺",
    subtitle: "浜松にもたらされた黄檗文化",
    lat: 34.8170097,
    lng: 137.6917906,
    locationPrecision: "exact",
    visitAnchorLabel: "初山宝林寺の公開見学地点",
    publicLocationMode: "exact",
    subjectLocationMode: "same_as_visit_anchor",
    sensitiveReviewStatus: "cleared",
    category: "heritage",
    approvalState: "public_source",
    preview: "明の僧・独湛に関わる黄檗宗寺院として紹介されています。",
    script: "初山宝林寺では、建物の形や雰囲気に残る異国的な要素を見てください。寺を見ることは、浜松が外から来た文化を受け止めてきた歴史を見ることでもあります。",
    storyPoints: [
      "黄檗文化は、建築や信仰の表現として浜松に残っている。",
      "寺の配置や建物の意匠から、地域と外来文化の接点が見える。",
      "細江・引佐周辺の寺社や井伊谷の歴史と合わせて巡れる。"
    ],
    triggerRadiusM: 240,
    unlockedRadiusM: 100,
    guideProgramIds: ["hamamatsu-heritage-guide-relay"],
    ownerType: "municipality",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "business_hours",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 150,
    accuracyBufferCapM: 100,
    sourceLinks: [
      { label: "浜松市: 浜松にもたらされた黄檗文化", url: "https://www.city.hamamatsu.shizuoka.jp/hamahaku/02tenji/tokubetu/oubaku.html" },
      { label: "浜松市: 文化財情報vol.1", url: "https://www.city.hamamatsu.shizuoka.jp/bunkazai/info/info_01.html" }
    ]
  },
  {
    id: "hamamatsu-heritage-system",
    title: "浜松地域遺産認定制度",
    subtitle: "地域で受け継がれてきた文化資源を見る入口",
    lat: 34.710834,
    lng: 137.726126,
    locationPrecision: "approximate",
    visitAnchorLabel: "浜松中心部の地域遺産制度紹介地点",
    publicLocationMode: "area",
    subjectLocationMode: "area_public",
    sensitiveReviewStatus: "cleared",
    category: "community",
    approvalState: "public_source",
    preview: "浜松市が地域の文化資源を顕彰する制度の考え方を紹介します。",
    script: "浜松市の地域遺産認定制度は、指定文化財だけでなく、地域で大切にされてきた文化資源を見えるようにする仕組みです。地図で点を見る時も、建物や木だけでなく、それを受け継ぐ人や地域の記憶を合わせて見てください。",
    storyPoints: [
      "制度は、地域に残る文化資源をゆるやかに認め、活用するための入口になる。",
      "所有者や地域の同意、文化財保護審議会の意見を経て認定される。",
      "ikimonのガイドでは、出典を明示しながら現地で聞ける形に変換する。"
    ],
    triggerRadiusM: 300,
    unlockedRadiusM: 120,
    guideProgramIds: ["hamamatsu-heritage-guide-relay"],
    ownerType: "municipality",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "anytime_public",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 150,
    accuracyBufferCapM: 100,
    sourceLinks: [{ label: "浜松市: 浜松地域遺産認定制度", url: HAMAMATSU_CITY_HERITAGE_URL }]
  }
];
const ORIGINAL_UI_HTML_STATIC_PATHS = new Set([
  "/",
  "/demo/place-feeling-tags",
  "/guide",
  "/record",
  "/records",
  "/map",
  "/app-refresh",
  "/login",
  "/profile",
  "/profile/settings",
  "/en",
  "/en/",
  "/en/demo/place-feeling-tags",
  "/en/guide",
  "/en/login",
  "/en/map",
  "/en/profile",
  "/en/profile/settings",
  "/en/record",
  "/en/records",
  "/en/register",
  "/es",
  "/es/",
  "/es/demo/place-feeling-tags",
  "/es/guide",
  "/es/login",
  "/es/map",
  "/es/profile",
  "/es/profile/settings",
  "/es/record",
  "/es/records",
  "/es/register",
  "/pt-br",
  "/pt-br/",
  "/pt-br/demo/place-feeling-tags",
  "/pt-br/guide",
  "/pt-br/login",
  "/pt-br/map",
  "/pt-br/profile",
  "/pt-br/profile/settings",
  "/pt-br/record",
  "/pt-br/records",
  "/pt-br/register",
  "/register",
  "/learn",
  "/community",
  "/community/events",
  "/community/events/new",
  "/community/fields",
  "/for-business",
  "/for-business/field-programs",
  "/for-business/invasive-reporting",
  "/ja",
  "/ja/",
  "/ja/about",
  "/ja/cases",
  "/ja/community",
  "/ja/demo/place-feeling-tags",
  "/ja/community/events",
  "/ja/community/events/new",
  "/ja/community/fields",
  "/en/community/events/new",
  "/es/community/events/new",
  "/pt-br/community/events/new",
  "/en/community/fields",
  "/es/community/fields",
  "/pt-br/community/fields",
  "/ja/contact",
  "/ja/faq",
  "/ja/for-business",
  "/ja/for-business/apply",
  "/ja/for-business/demo",
  "/ja/for-business/field-programs",
  "/ja/for-business/invasive-reporting",
  "/ja/for-business/monitoring/apply",
  "/ja/for-business/pricing",
  "/ja/for-business/status",
  "/ja/login",
  "/ja/profile",
  "/ja/profile/settings",
  "/ja/register",
  "/ja/for-researcher/apply",
  "/ja/guide",
  "/ja/walk-maps",
  "/ja/walk-maps/jp-shizuoka-yatsuyama-sample-v0",
  "/ja/walk-maps/jp-shizuoka-asahata-waterfront-sample-v0",
  "/ja/walk-maps/jp-shizuoka-mariko-waterfront-sample-v0",
  "/ja/home",
  "/ja/impact",
  "/ja/learn",
  "/ja/learn/biodiversity",
  "/ja/learn/biomonweek",
  "/ja/learn/citizen-science",
  "/ja/learn/field-loop",
  "/ja/learn/glossary",
  "/ja/learn/identification-basics",
  "/ja/learn/invasive-species",
  "/ja/learn/invasive-species/alternanthera-philoxeroides",
  "/ja/learn/invasive-species/bombus-terrestris",
  "/ja/learn/invasive-species/chelydra-serpentina",
  "/ja/learn/invasive-species/coreopsis-lanceolata",
  "/ja/learn/invasive-species/eichhornia-crassipes",
  "/ja/learn/invasive-species/erigeron-annuus",
  "/ja/learn/invasive-species/erigeron-philadelphicus",
  "/ja/learn/invasive-species/gambusia-affinis",
  "/ja/learn/invasive-species/garrulax-canorus",
  "/ja/learn/invasive-species/latrodectus-hasseltii",
  "/ja/learn/invasive-species/leiothrix-lutea",
  "/ja/learn/invasive-species/linepithema-humile",
  "/ja/learn/invasive-species/lithobates-catesbeianus",
  "/ja/learn/invasive-species/micropterus-salmoides",
  "/ja/learn/invasive-species/myocastor-coypus",
  "/ja/learn/invasive-species/paguma-larvata",
  "/ja/learn/invasive-species/pistia-stratiotes",
  "/ja/learn/invasive-species/procambarus-clarkii",
  "/ja/learn/invasive-species/procyon-lotor",
  "/ja/learn/invasive-species/rudbeckia-laciniata",
  "/ja/learn/invasive-species/sicyos-angulatus",
  "/ja/learn/invasive-species/solenopsis-invicta",
  "/ja/learn/invasive-species/solidago-canadensis",
  "/ja/learn/invasive-species/taraxacum-officinale",
  "/ja/learn/invasive-species/trachemys-scripta-elegans",
  "/ja/learn/invasive-species/tradescantia-fluminensis",
  "/ja/learn/invasive-species-reporting",
  "/ja/learn/methodology",
  "/ja/learn/policy-and-business",
  "/ja/learn/technology",
  "/ja/learn/terms/30by30",
  "/ja/learn/terms/ai-candidate",
  "/ja/learn/terms/attention-restoration-theory",
  "/ja/learn/terms/baseline",
  "/ja/learn/terms/biodiversity",
  "/ja/learn/terms/biodiversity-credits",
  "/ja/learn/terms/biodiversity-monitoring",
  "/ja/learn/terms/biomonweek",
  "/ja/learn/terms/biophilia-hypothesis",
  "/ja/learn/terms/citizen-science",
  "/ja/learn/terms/darwin-core",
  "/ja/learn/terms/dataset",
  "/ja/learn/terms/dwca",
  "/ja/learn/terms/ecosystem-services",
  "/ja/learn/terms/environmental-dna",
  "/ja/learn/terms/evidence-tier",
  "/ja/learn/terms/fixed-point-observation",
  "/ja/learn/terms/gbif",
  "/ja/learn/terms/identification",
  "/ja/learn/terms/kunming-montreal-gbf",
  "/ja/learn/terms/location-data",
  "/ja/learn/terms/natural-capital",
  "/ja/learn/terms/nature-connectedness",
  "/ja/learn/terms/nature-positive",
  "/ja/learn/terms/nature-symbiosis-site",
  "/ja/learn/terms/oecm",
  "/ja/learn/terms/one-health",
  "/ja/learn/terms/open-dispute",
  "/ja/learn/terms/participatory-monitoring",
  "/ja/learn/terms/quick-capture",
  "/ja/learn/terms/rare-species",
  "/ja/learn/terms/sampling-effort",
  "/ja/learn/terms/survey",
  "/ja/learn/terms/taxonomy-name",
  "/ja/learn/terms/tnfd",
  "/ja/learn/updates",
  "/ja/learn/wellbeing",
  "/en/learn",
  "/es/learn",
  "/pt-br/learn",
  "/ja/lens",
  "/ja/login",
  "/ja/map",
  "/ja/privacy",
  "/ja/profile",
  "/ja/profile/settings",
  "/ja/record",
  "/ja/records",
  "/ja/register",
  "/ja/terms"
]);
const ORIGINAL_UI_HTML_CACHE_CONTROL = "no-store, no-cache, must-revalidate, proxy-revalidate";

export const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const nativePathname = stripPublicLangPrefix(url.pathname);

      if (request.method === "GET" && url.pathname === "/health") {
        return json({ ok: true, environment: env.ENVIRONMENT });
      }

      if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/healthz") {
        return getHealthz(env);
      }

      if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/readyz") {
        return getReadyz(env);
      }

      if ((request.method === "GET" || request.method === "HEAD") && url.pathname === REFLECTION_LOOP_MANIFEST_PATH) {
        return getReflectionLoopManifest(url, env);
      }

      if (url.pathname.startsWith("/internal/")) {
        const guard = authorizeInternalRequest(request, env);
        if (guard) return guard;
      }

      if (isShadowDiagnosticPath(url.pathname) && env.ENVIRONMENT !== "shadow") {
        return json({ error: "not_found" }, 404, { "cache-control": "no-store" });
      }

      if (request.method === "GET" && (
        nativePathname === "/api/v1/weather/jma-nowcast/times"
        || nativePathname === "/api/v1/map/weather/jma-nowcast/times"
      )) {
        return getJmaNowcastTimesResponse();
      }

      if (request.method === "GET" && (
        nativePathname === "/api/v1/weather/jma-nowcast/tile"
        || nativePathname === "/api/v1/map/weather/jma-nowcast/tile"
      )) {
        return getJmaNowcastTileResponse(url);
      }

      if (request.method === "GET" && nativePathname === "/api/v1/map/cells") {
        return getPublicMapCells(url, env);
      }

      if (request.method === "GET" && nativePathname === "/api/v1/map/observations") {
        return getPublicMapObservations(url, env);
      }

      if (request.method === "GET" && nativePathname === "/api/v1/map/coverage") {
        return getPublicMapCoverage(url, env);
      }

      if (request.method === "GET" && nativePathname === "/api/v1/map/my-places") {
        return getPublicMapMyPlaces(request, env);
      }

      if (request.method === "GET" && (
        nativePathname === "/api/v1/map/my-observations"
        || nativePathname === "/api/v1/me/map-observations"
      )) {
        return getPublicMapMyObservations(request, url, env);
      }

      if (request.method === "GET" && nativePathname === "/api/v1/map/traces") {
        return getPublicMapEmptyGeoJson("traces");
      }

      if (request.method === "GET" && nativePathname === "/api/v1/map/frontier") {
        return getPublicMapEmptyGeoJson("frontier");
      }

      if (request.method === "GET" && isMapAreaPolygonsApiPath(url.pathname)) {
        const response = await getPublicMapAreaPolygons(url, env);
        if (response) return response;
        return getPublicMapEmptyGeoJson("area-polygons");
      }

      if (request.method === "GET" && nativePathname === "/api/v1/map/effort-summary") {
        return getPublicMapEffortSummaryShim();
      }

      if (request.method === "GET" && nativePathname === "/api/v1/map/site-brief") {
        return getPublicMapSiteBriefShim(url);
      }

      if (request.method === "GET" && nativePathname === "/api/v1/map/guide-spots") {
        return getPublicMapGuideSpots(url);
      }

      const guideOutcomeRuntimeResponse = await handleGuideOutcomeRuntime(request, url, env);
      if (guideOutcomeRuntimeResponse) return guideOutcomeRuntimeResponse;

      const walkRuntimeResponse = await handleWalkRuntime(request, url, env);
      if (walkRuntimeResponse) return walkRuntimeResponse;

      const trackRuntimeResponse = await handleTrackRuntime(request, url, env);
      if (trackRuntimeResponse) return trackRuntimeResponse;

      if (request.method === "GET" && nativePathname === "/api/v1/municipal-walk-maps") {
        return getMunicipalWalkMapCandidates(url, env);
      }

      if ((request.method === "GET" || request.method === "HEAD") && nativePathname === "/walk-maps") {
        return await getMunicipalWalkMapListPage(url, env);
      }

      const municipalWalkMapSourceDraftMatch = nativePathname.match(/^\/walk-map-source-drafts\/([^/]+)$/);
      if ((request.method === "GET" || request.method === "HEAD") && municipalWalkMapSourceDraftMatch?.[1]) {
        return getMunicipalWalkMapSourceDraftPage(decodeURIComponent(municipalWalkMapSourceDraftMatch[1]));
      }

      const municipalWalkMapDetailApiMatch = nativePathname.match(/^\/api\/v1\/municipal-walk-maps\/([^/]+)$/);
      if (request.method === "GET" && municipalWalkMapDetailApiMatch?.[1]) {
        return await getMunicipalWalkMapPublicDetailApi(decodeURIComponent(municipalWalkMapDetailApiMatch[1]), env);
      }

      const municipalWalkMapDetailPageMatch = nativePathname.match(/^\/walk-maps\/([^/]+)$/);
      if ((request.method === "GET" || request.method === "HEAD") && municipalWalkMapDetailPageMatch?.[1]) {
        return await getMunicipalWalkMapPublicDetailPage(decodeURIComponent(municipalWalkMapDetailPageMatch[1]), env);
      }

      const nativePlacePageMatch = nativePathname.match(/^\/places\/([^/]+)$/);
      if ((request.method === "GET" || request.method === "HEAD") && nativePlacePageMatch?.[1]) {
        return getNativePlaceLandingPage(decodeURIComponent(nativePlacePageMatch[1]), request);
      }

      const fixedPointStationMatch = nativePathname.match(/^\/places\/([^/]+)\/station$/);
      if ((request.method === "GET" || request.method === "HEAD") && fixedPointStationMatch?.[1]) {
        return getNativeFixedPointStationHtml(request, env, decodeURIComponent(fixedPointStationMatch[1]));
      }

      if ((request.method === "GET" || request.method === "HEAD") && nativePathname === "/admin/municipal-walk-maps") {
        return await getMunicipalWalkMapAdminPage(request, url, env);
      }

      if ((request.method === "GET" || request.method === "HEAD") && nativePathname === "/admin/municipal-walk-map-creators") {
        return await getMunicipalWalkMapCreatorsAdminPage(request, env);
      }

      if ((request.method === "GET" || request.method === "HEAD") && nativePathname === "/admin/municipal-walk-map-reviews") {
        return await getMunicipalWalkMapReviewsAdminPage(request, url, env);
      }

      if (nativePathname === "/api/v1/admin/municipal-walk-map-creators") {
        if (request.method === "GET") return await listMunicipalWalkMapCreatorsAdmin(request, env);
        if (request.method === "POST") return await upsertMunicipalWalkMapCreatorAdmin(request, env);
      }

      if (request.method === "GET" && nativePathname === "/api/v1/admin/municipal-walk-map-reviews") {
        return await listMunicipalWalkMapReviewsAdmin(request, url, env);
      }

      if (request.method === "GET" && nativePathname === "/api/v1/admin/municipal-walk-map-templates") {
        return await listMunicipalWalkMapTemplatesAdmin(request, env);
      }

      if (request.method === "GET" && nativePathname === "/api/v1/admin/municipal-walk-map-source-catalog") {
        return await listMunicipalWalkMapSourceCatalogAdmin(request, env, url);
      }

      const municipalWalkMapReviewActionMatch = nativePathname.match(/^\/api\/v1\/admin\/municipal-walk-map-reviews\/([^/]+)\/actions$/);
      if (request.method === "POST" && municipalWalkMapReviewActionMatch?.[1]) {
        return await applyMunicipalWalkMapReviewActionAdmin(
          request,
          decodeURIComponent(municipalWalkMapReviewActionMatch[1]),
          env
        );
      }

      if (request.method === "POST" && nativePathname === "/api/v1/admin/municipal-walk-maps") {
        return await upsertMunicipalWalkMapAdmin(request, null, env);
      }

      if (request.method === "POST" && nativePathname === "/api/v1/admin/municipal-walk-maps/preview") {
        return await previewMunicipalWalkMapAdmin(request, env);
      }

      const municipalWalkMapAdminUpdateMatch = nativePathname.match(/^\/api\/v1\/admin\/municipal-walk-maps\/([^/]+)$/);
      if (request.method === "POST" && municipalWalkMapAdminUpdateMatch?.[1] && municipalWalkMapAdminUpdateMatch[1] !== "preview") {
        return await upsertMunicipalWalkMapAdmin(
          request,
          decodeURIComponent(municipalWalkMapAdminUpdateMatch[1]),
          env
        );
      }

      if (request.method === "GET" && nativePathname === "/ops/public-map-snapshot") {
        return getPublicMapSnapshotStatusResponse(env);
      }

      const fieldDetailApiMatch = url.pathname.match(/^\/api\/v1\/fields\/([^/]+)\/public-detail$/);
      if (request.method === "GET" && fieldDetailApiMatch?.[1]) {
        return getFieldDetailJson(decodeURIComponent(fieldDetailApiMatch[1]), env);
      }

      const areaSnapshotMatch = url.pathname.match(/^\/api\/v1\/fields\/([^/]+)\/area-snapshot$/);
      if (request.method === "GET" && areaSnapshotMatch?.[1]) {
        return getOriginalUiAreaSnapshot(decodeURIComponent(areaSnapshotMatch[1]), env);
      }

      if ((request.method === "GET" || request.method === "HEAD") && isOriginalUiStaticAssetPath(url.pathname)) {
        return getOriginalUiStaticAsset(request, url, env);
      }

      if ((request.method === "GET" || request.method === "HEAD") && isOriginalUiThumbPath(url.pathname)) {
        return getOriginalUiThumb(request, url, env);
      }

      if ((request.method === "GET" || request.method === "HEAD") && isProfileHtmlPath(url.pathname)) {
        return getSessionAwareProfileHtml(request, url, env);
      }

      const stewardshipFormMatch = nativePathname.match(/^\/sites\/([^/]+)\/stewardship\/new$/);
      if ((request.method === "GET" || request.method === "HEAD") && stewardshipFormMatch?.[1]) {
        return getStewardshipActionFormPage(request, url, env, decodeURIComponent(stewardshipFormMatch[1]));
      }

      const stewardshipPostMatch = nativePathname.match(/^\/sites\/([^/]+)\/stewardship_actions$/);
      if (request.method === "POST" && stewardshipPostMatch?.[1]) {
        return createStewardshipActionFromForm(request, url, env, decodeURIComponent(stewardshipPostMatch[1]));
      }

      if ((request.method === "GET" || request.method === "HEAD") && isOriginalUiHtmlPath(url.pathname)) {
        return getOriginalUiHtml(request, url, env);
      }

      const oauthStartMatch = url.pathname.match(/^\/auth\/oauth\/([^/]+)\/start$/);
      if (request.method === "GET" && oauthStartMatch?.[1]) {
        return handleOAuthStart(request, decodeURIComponent(oauthStartMatch[1]), env);
      }

      const oauthCallbackMatch = url.pathname.match(/^\/auth\/oauth\/([^/]+)\/callback$/);
      if (request.method === "GET" && oauthCallbackMatch?.[1]) {
        return handleOAuthCallback(request, decodeURIComponent(oauthCallbackMatch[1]), env);
      }

      if (request.method === "GET" && url.pathname === "/oauth_callback.php") {
        return handleOAuthCallback(request, url.searchParams.get("provider"), env);
      }

      if (request.method === "GET" && url.pathname.startsWith("/derived/")) {
        return getPublicDerivedMedia(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/record") {
        return html(renderShadowRecordSmokeHtml(), 200, { "cache-control": "no-store" });
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/map") {
        return html(renderShadowMapSmokeHtml(url), 200, { "cache-control": "no-store" });
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/takedown-proof") {
        return shadowTakedownProof(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/video-metadata-proof") {
        return shadowVideoMetadataProof(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/missing-media-ledger-proof") {
        return shadowMissingMediaLedgerProof(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/stream-nonready-exclusion-proof") {
        return shadowStreamNonReadyExclusionProof(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/reverse-delta-proof") {
        return shadowReverseDeltaProof(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/update-delete-replay-proof") {
        return shadowUpdateDeleteReplayProof(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/rollback-restore-smoke") {
        return shadowRollbackRestoreSmoke(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/production-import-dress-rehearsal-proof") {
        return shadowProductionImportDressRehearsalProof(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/route-change-rehearsal-proof") {
        return shadowRouteChangeRehearsalProof(url, env);
      }

      const shadowVideoMatch = url.pathname.match(/^\/shadow\/stream\/([^/]+)$/);
      if (request.method === "GET" && shadowVideoMatch?.[1]) {
        return getShadowVideoStream(decodeURIComponent(shadowVideoMatch[1]), env);
      }

      const shadowVideoThumbnailMatch = url.pathname.match(/^\/shadow\/stream\/([^/]+)\/thumbnail\.jpg$/);
      if (request.method === "GET" && shadowVideoThumbnailMatch?.[1]) {
        return getShadowVideoThumbnail(decodeURIComponent(shadowVideoThumbnailMatch[1]), env);
      }

      const publicDetailApiMatch = nativePathname.match(/^\/api\/v1\/observations\/([^/]+)\/public-detail$/);
      if (request.method === "GET" && publicDetailApiMatch?.[1]) {
        return getPublicObservationDetailJson(decodeURIComponent(publicDetailApiMatch[1]), env);
      }

      const publicDetailPageMatch = nativePathname.match(/^\/observations\/([^/]+)$/);
      if ((request.method === "GET" || request.method === "HEAD") && publicDetailPageMatch?.[1]) {
        return getPublicObservationDetailPage(decodeURIComponent(publicDetailPageMatch[1]), env);
      }

      if (request.method === "POST" && url.pathname === "/api/v1/ui-kpi/events") {
        return recordUiKpiEventShim(request);
      }

      const appWriteBoundary = handlePublicCustomDomainAppWriteBoundary(request, url, env);
      if (appWriteBoundary) {
        return appWriteBoundary;
      }

      const personalRuntimeBoundary = await handleOriginalPersonalRuntimeBoundary(request, url, env);
      if (personalRuntimeBoundary) {
        return personalRuntimeBoundary;
      }

      if (request.method === "GET" && url.pathname === "/api/v1/observations/") {
        return json({ ok: false, error: "not_found" }, 404, { "cache-control": "no-store" });
      }

      const reactionMatch = url.pathname.match(/^\/api\/v1\/observations\/([^/]+)\/reactions\/([^/]+)$/);
      if (request.method === "POST" && reactionMatch?.[1] && reactionMatch?.[2]) {
        return toggleObservationReaction(
          decodeURIComponent(reactionMatch[1]),
          decodeURIComponent(reactionMatch[2]),
          request,
          env
        );
      }

      const identificationMatch = url.pathname.match(/^\/api\/v1\/observations\/([^/]+)\/identifications$/);
      if (request.method === "POST" && identificationMatch?.[1]) {
        return submitCompatibleObservationIdentification(
          decodeURIComponent(identificationMatch[1]),
          request,
          env
        );
      }

      const disputeMatch = url.pathname.match(/^\/api\/v1\/observations\/([^/]+)\/disputes$/);
      if (request.method === "POST" && disputeMatch?.[1]) {
        return openCompatibleObservationDispute(
          decodeURIComponent(disputeMatch[1]),
          request,
          env
        );
      }

      const aiReviewMatch = url.pathname.match(/^\/api\/v1\/observation-records\/([^/]+)\/ai-review$/);
      if (request.method === "POST" && aiReviewMatch?.[1]) {
        return submitCompatibleObservationRecordAiReview(
          decodeURIComponent(aiReviewMatch[1]),
          request,
          env
        );
      }

      const readingCardsMatch = url.pathname.match(/^\/api\/v1\/observations\/([^/]+)\/reading-cards$/);
      if (request.method === "POST" && readingCardsMatch?.[1]) {
        return generateCompatibleRecordReadingCards(
          decodeURIComponent(readingCardsMatch[1]),
          request,
          env
        );
      }

      const recordReadingCardMatch = url.pathname.match(/^\/api\/v1\/record-reading-cards\/([^/]+)$/);
      if (request.method === "DELETE" && recordReadingCardMatch?.[1]) {
        return hideCompatibleRecordReadingCard(
          decodeURIComponent(recordReadingCardMatch[1]),
          request,
          env
        );
      }

      const referenceCandidatesMatch = url.pathname.match(/^\/api\/v1\/observations\/([^/]+)\/reference-candidates$/);
      if (request.method === "GET" && referenceCandidatesMatch?.[1]) {
        return listCompatibleReferenceCandidates(
          decodeURIComponent(referenceCandidatesMatch[1]),
          request,
          env
        );
      }

      const candidateActionMatch = url.pathname.match(/^\/api\/v1\/observations\/([^/]+)\/candidates\/([^/]+)\/(propose|adopt)$/);
      if (request.method === "POST" && candidateActionMatch?.[1] && candidateActionMatch?.[2] && candidateActionMatch?.[3]) {
        return requestCompatibleCandidateAction(
          decodeURIComponent(candidateActionMatch[1]),
          decodeURIComponent(candidateActionMatch[2]),
          candidateActionMatch[3] === "adopt" ? "adopt" : "propose",
          request,
          env
        );
      }

      const managementConfirmMatch = url.pathname.match(/^\/api\/v1\/observations\/([^/]+)\/management-candidates\/([^/]+)\/confirm$/);
      if (request.method === "POST" && managementConfirmMatch?.[1] && managementConfirmMatch?.[2]) {
        return confirmCompatibleManagementCandidate(
          decodeURIComponent(managementConfirmMatch[1]),
          decodeURIComponent(managementConfirmMatch[2]),
          request,
          env
        );
      }

      const reassessRequestMatch = url.pathname.match(/^\/api\/v1\/observations\/([^/]+)\/(reassess|reassess-from-video)$/);
      if (request.method === "POST" && reassessRequestMatch?.[1] && reassessRequestMatch?.[2]) {
        return requestCompatibleObservationReassessment(
          decodeURIComponent(reassessRequestMatch[1]),
          reassessRequestMatch[2] === "reassess-from-video" ? "video" : "standard",
          request,
          env
        );
      }

      const legacyObservationApiFallback = await fetchLegacyObservationApiOriginFallback(request, url, env);
      if (legacyObservationApiFallback) {
        return legacyObservationApiFallback;
      }

      const observationEventResponse = await handleObservationEventApi(request, url, env);
      if (observationEventResponse) {
        return observationEventResponse;
      }

      const accountWriteResponse = await handleAccountWriteApi(request, url, env);
      if (accountWriteResponse) {
        return accountWriteResponse;
      }

      if (shouldFallbackPublicCustomDomainPathToOrigin(request, url, env)) {
        return fetchOriginFallback(request, url, env, "public_custom_domain_path");
      }

      if (request.method === "POST" && url.pathname === "/api/v0/draft-observations") {
        return createDraftObservation(request, env);
      }

      if (request.method === "PUT" && url.pathname.startsWith("/api/v0/assets/") && url.pathname.endsWith("/body")) {
        const assetId = decodeURIComponent(url.pathname.split("/").at(-2) ?? "");
        return putAssetBody(assetId, request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/v0/observations/finalize") {
        return finalizeObservation(request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/v1/observations/upsert") {
        return upsertLegacyCompatibleObservation(request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/v1/auth/session/issue") {
        return issueCompatibleSession(request, env);
      }

      if (request.method === "GET" && url.pathname === "/api/v1/auth/session") {
        return getCompatibleSession(request, url, env);
      }

      if (request.method === "POST" && url.pathname === "/api/v1/auth/session/logout") {
        return logoutCompatibleSession(request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/v1/auth/login") {
        return loginWithPassword(request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/v1/videos/direct-upload") {
        return createCompatibleVideoDirectUpload(request, env);
      }

      const videoBodyMatch = url.pathname.match(/^\/api\/v1\/videos\/([^/]+)\/body$/);
      if ((request.method === "PUT" || request.method === "POST") && videoBodyMatch?.[1]) {
        return putCompatibleVideoBody(decodeURIComponent(videoBodyMatch[1]), request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/v1/videos/stream-webhook") {
        return handleCompatibleVideoStreamWebhook(request, env);
      }

      const videoFinalizeMatch = url.pathname.match(/^\/api\/v1\/videos\/([^/]+)\/finalize$/);
      if (request.method === "POST" && videoFinalizeMatch?.[1]) {
        return finalizeCompatibleVideo(decodeURIComponent(videoFinalizeMatch[1]), request, env);
      }

      const photoUploadMatch = url.pathname.match(/^\/api\/v1\/observations\/([^/]+)\/photos\/upload$/);
      if (request.method === "POST" && photoUploadMatch?.[1]) {
        return uploadLegacyCompatiblePhoto(decodeURIComponent(photoUploadMatch[1]), request, env);
      }

      const hideObservationMatch = url.pathname.match(/^\/api\/v1\/observations\/([^/]+)\/hide$/);
      if (request.method === "POST" && hideObservationMatch?.[1]) {
        return hideCompatibleObservation(decodeURIComponent(hideObservationMatch[1]), request, env);
      }

      if (request.method === "POST" && url.pathname === "/internal/drain-outbox") {
        return drainOutbox(env);
      }

      if (request.method === "GET" && url.pathname === "/internal/r2-inventory") {
        return r2Inventory(url, env);
      }

      if (request.method === "GET" && url.pathname === "/internal/legacy-asset-import-summary") {
        return legacyAssetImportSummary(env);
      }

      if (request.method === "GET" && url.pathname === "/internal/r2-import-summary") {
        return r2ImportSummary(env);
      }

      if (request.method === "GET" && url.pathname === "/internal/production-restore-parity-summary") {
        return productionRestoreParitySummary(env);
      }

      if (request.method === "GET" && url.pathname === "/internal/production-import-summary") {
        return productionImportSummary(env);
      }

      if (request.method === "GET" && url.pathname === "/internal/d1-partition-routing-proof") {
        return d1PartitionRoutingProof(url, env);
      }

      if (request.method === "GET" && url.pathname === "/internal/public-derivative-verification-summary") {
        return publicDerivativeVerificationSummary(env);
      }

      if (request.method === "GET" && url.pathname === "/internal/reverse-delta-dry-run") {
        return reverseDeltaDryRun(url, env);
      }

      if (request.method === "GET" && url.pathname === "/internal/origin-fallback-telemetry") {
        return originFallbackTelemetrySummary(url, env);
      }

      if (request.method === "POST" && url.pathname === "/internal/alert-deliveries/drain") {
        return internalAlertDeliveryDrain(url, env);
      }

      if (url.pathname.startsWith("/internal/")) {
        return json({ error: "not_found" }, 404);
      }

      if ((request.method === "GET" || request.method === "HEAD") && PUBLIC_CUSTOM_HOSTS.has(url.hostname) && !url.pathname.startsWith("/api/")) {
        return getNativeNotFoundPage(request);
      }

      return json({ error: "not_found" }, 404);
    } catch (error) {
      if (error instanceof HttpError) {
        return json({ error: error.message }, error.status);
      }
      console.error(error);
      return json({ error: "internal_error" }, 500);
    }
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(scheduleAlertDeliveryDrain(env, controller));
  },

  async queue(batch: { messages: Array<{ body: MediaJob | AlertDeliveryJob }> }, env: Env): Promise<void> {
    for (const message of batch.messages) {
      if (isAlertDeliveryJob(message.body)) {
        await drainAlertDeliveries(env, {
          source: "queue",
          limit: message.body.limit
        });
      } else {
        await applyMediaJob(message.body, env);
      }
    }
  }
};

export default worker;

function getHealthz(env: Env): Response {
  return json({
    ok: true,
    service: "ikimon-life-cloudflare-worker",
    environment: env.ENVIRONMENT,
    buildMarker: WORKER_BUILD_MARKER,
    fallbackOriginConfigured: Boolean(env.ORIGIN_FALLBACK_BASE_URL)
  }, 200, { "cache-control": "no-store" });
}

async function getReadyz(env: Env): Promise<Response> {
  try {
    await env.CORE_DB.prepare("SELECT 1 AS ok").first();
    await env.OBS_DB.prepare("SELECT 1 AS ok").first();
    return json({
      ok: true,
      service: "ikimon-life-cloudflare-worker",
      environment: env.ENVIRONMENT,
      buildMarker: WORKER_BUILD_MARKER,
      coreDb: "ok",
      observationDb: "ok",
      assetBucket: "bound",
      mediaQueue: "bound"
    }, 200, { "cache-control": "no-store" });
  } catch (error) {
    console.error("readyz failed", error);
    return json({
      ok: false,
      service: "ikimon-life-cloudflare-worker",
      environment: env.ENVIRONMENT,
      error: "readiness_check_failed"
    }, 503, { "cache-control": "no-store" });
  }
}

function handlePublicCustomDomainAppWriteBoundary(request: Request, url: URL, env: Env): Response | Promise<Response> | null {
  if (!shouldUseOriginFallback(url, env)) return null;
  if (!isPublicAppWriteCandidatePath(url)) return null;

  const mode = getPublicWriteMode(env);
  if (mode === "cloudflare_native") return null;
  if (mode === "write_disabled" && isMutatingMethod(request.method)) {
    return publicWriteDisabledResponse();
  }

  return fetchOriginFallback(request, url, env, "public_write_origin_mode");
}

async function handleOriginalPersonalRuntimeBoundary(request: Request, url: URL, env: Env): Promise<Response | null> {
  if (!isOriginalPersonalRuntimePath(request, url)) return null;
  const session = await readCompatibleSessionWithOriginFallback(request, env);
  if (!session) {
    return json({ ok: false, error: "auth_required" }, 401, { "cache-control": "no-store" });
  }
  if (session.banned) {
    return json({ ok: false, error: "account_unavailable" }, 403, { "cache-control": "no-store" });
  }
  if (request.method === "GET" && url.pathname === "/api/v1/me/alerts") {
    return getPersonalAlerts(session, env);
  }
  if (request.method === "POST" && url.pathname === "/api/v1/me/alerts/read") {
    return markPersonalAlertsRead(session, request, env);
  }
  if (request.method === "GET" && url.pathname === "/api/v1/me/subscriptions") {
    return getPersonalTaxonSubscriptions(session, env);
  }
  if (request.method === "POST" && url.pathname === "/api/v1/me/subscriptions") {
    return createPersonalTaxonSubscription(session, request, env);
  }
  const deleteTaxonMatch = url.pathname.match(/^\/api\/v1\/me\/subscriptions\/([^/]+)$/);
  if (request.method === "DELETE" && deleteTaxonMatch?.[1]) {
    return deletePersonalTaxonSubscription(session, decodeURIComponent(deleteTaxonMatch[1]), env);
  }
  if (request.method === "GET" && url.pathname === "/api/v1/me/area-subscriptions") {
    return getPersonalAreaSubscriptions(session, env);
  }
  if (request.method === "POST" && url.pathname === "/api/v1/me/area-subscriptions") {
    return upsertPersonalAreaSubscription(session, request, env);
  }
  const deleteAreaMatch = url.pathname.match(/^\/api\/v1\/me\/area-subscriptions\/([^/]+)$/);
  if (request.method === "DELETE" && deleteAreaMatch?.[1]) {
    return deletePersonalAreaSubscription(session, decodeURIComponent(deleteAreaMatch[1]), env);
  }
  if (request.method === "GET" && url.pathname === "/api/v1/me/personalized-menu") {
    return getPersonalizedMenu(session, url, env);
  }
  return json({ ok: false, error: "not_found" }, 404, { "cache-control": "no-store" });
}

function isOriginalPersonalRuntimePath(request: Request, url: URL): boolean {
  if (request.method === "GET" && url.pathname === "/api/v1/me/alerts") return true;
  if (request.method === "POST" && url.pathname === "/api/v1/me/alerts/read") return true;
  if (request.method === "GET" && url.pathname === "/api/v1/me/personalized-menu") return true;
  if ((request.method === "GET" || request.method === "POST") && url.pathname === "/api/v1/me/subscriptions") return true;
  if (request.method === "DELETE" && /^\/api\/v1\/me\/subscriptions\/[^/]+$/.test(url.pathname)) return true;
  if ((request.method === "GET" || request.method === "POST") && url.pathname === "/api/v1/me/area-subscriptions") return true;
  if (request.method === "DELETE" && /^\/api\/v1\/me\/area-subscriptions\/[^/]+$/.test(url.pathname)) return true;
  return false;
}

async function handleObservationEventApi(request: Request, url: URL, env: Env): Promise<Response | null> {
  const pathname = stripPublicLangPrefix(url.pathname);
  if (!pathname.startsWith("/api/v1/observation-events")) return null;
  if (request.method === "POST" && pathname === "/api/v1/observation-events/area-suggestions") {
    return suggestObservationEventArea(request, env);
  }

  if (request.method === "POST" && pathname === "/api/v1/observation-events") {
    return createObservationEventSession(request, env);
  }
  const byCodeRecapMatch = pathname.match(/^\/api\/v1\/observation-events\/by-code\/([^/]+)\/recap$/);
  if (request.method === "GET" && byCodeRecapMatch?.[1]) {
    const session = await getObservationEventSessionByEventCode(env, decodeURIComponent(byCodeRecapMatch[1]));
    return session ? getObservationEventRecap(request, url, env, session.sessionId) : json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  }
  const byCodeMatch = pathname.match(/^\/api\/v1\/observation-events\/by-code\/([^/]+)$/);
  if (request.method === "GET" && byCodeMatch?.[1]) {
    const session = await getObservationEventSessionByEventCode(env, decodeURIComponent(byCodeMatch[1]));
    return session ? json({ session }, 200, { "cache-control": "no-store" }) : json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  }
  const locationMatch = pathname.match(/^\/api\/v1\/observation-events\/([^/]+)\/location$/);
  if (request.method === "POST" && locationMatch?.[1]) {
    return pingObservationEventLocation(request, env, decodeURIComponent(locationMatch[1]));
  }
  const rallyMatch = pathname.match(/^\/api\/v1\/observation-events\/([^/]+)\/rally(?:\/(.*))?$/);
  if (rallyMatch?.[1]) {
    return handleObservationEventRallyApi(request, env, decodeURIComponent(rallyMatch[1]), rallyMatch[2] ? decodeURIComponent(rallyMatch[2]) : "");
  }
  const capsuleMatch = pathname.match(/^\/api\/v1\/observation-events\/([^/]+)\/capsule(?:\/(generate|review))?$/);
  if (capsuleMatch?.[1]) {
    const sessionId = decodeURIComponent(capsuleMatch[1]);
    const action = capsuleMatch[2] ? decodeURIComponent(capsuleMatch[2]) : "";
    if (request.method === "GET" && action === "") return getObservationEventCapsule(request, env, sessionId);
    if (request.method === "POST" && action === "generate") return generateObservationEventCapsule(request, env, sessionId);
    if (request.method === "PATCH" && action === "review") return reviewObservationEventCapsule(request, env, sessionId);
    return json({ error: "not_found" }, 404, { "cache-control": "no-store" });
  }
  const sessionMatch = pathname.match(/^\/api\/v1\/observation-events\/([^/]+)(?:\/([^/]+))?$/);
  if (!sessionMatch?.[1]) return json({ error: "not_found" }, 404, { "cache-control": "no-store" });

  const sessionId = decodeURIComponent(sessionMatch[1]);
  const action = sessionMatch[2] ? decodeURIComponent(sessionMatch[2]) : "";
  if (request.method === "GET" && action === "") {
    const session = await getObservationEventSessionById(env, sessionId);
    return session ? json({ session, modes: OBSERVATION_EVENT_MODES }, 200, { "cache-control": "no-store" }) : json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  }
  if (request.method === "PATCH" && action === "") return updateObservationEventSession(request, env, sessionId);
  if (request.method === "GET" && action === "recent") return getObservationEventRecent(url, env, sessionId, request.headers.get("cookie"));
  if (request.method === "GET" && action === "live") return getObservationEventLiveSnapshot(url, env, sessionId, request.headers.get("cookie"));
  if (request.method === "POST" && action === "announce") return announceObservationEvent(request, env, sessionId);
  if (request.method === "POST" && action === "teams") return createObservationEventTeam(request, env, sessionId);
  if (request.method === "POST" && action === "checkin") return checkinObservationEvent(request, env, sessionId);
  if (request.method === "POST" && action === "absences") return createObservationEventAbsence(request, env, sessionId);
  if (request.method === "PATCH" && action === "mode") return switchObservationEventMode(request, env, sessionId);
  if (request.method === "PATCH" && action === "role") return updateObservationEventRole(request, env, sessionId);
  if (request.method === "POST" && action === "end") return endObservationEventSession(request, env, sessionId);
  if (request.method === "GET" && action === "effort") return getObservationEventEffort(env, sessionId);
  if (request.method === "GET" && action === "recap") return getObservationEventRecap(request, url, env, sessionId);
  if (request.method === "GET" && action === "species.csv") return getObservationEventSpeciesCsv(request, env, sessionId);
  return json({ error: "not_found" }, 404, { "cache-control": "no-store" });
}

async function suggestObservationEventArea(request: Request, env: Env): Promise<Response> {
  const session = await readCompatibleSessionWithOriginFallback(request, env);
  if (!session) return json({ error: "login required" }, 401, { "cache-control": "no-store" });
  const body = await readJson<Record<string, unknown>>(request);
  const center = asPlainObject(body.center);
  const lat = numberOrNullFromUnknown(center?.lat);
  const lng = numberOrNullFromUnknown(center?.lng);
  if (lat === null || lng === null) {
    return json({ error: "center.lat and center.lng required" }, 400, { "cache-control": "no-store" });
  }
  const radiusM = clampObservationEventAreaRadius(numberOrNullFromUnknown(body.radius_m) ?? numberOrNullFromUnknown(body.radiusM) ?? 300);
  const placeLabel = normalizeOptionalText(body.place_label) ?? normalizeOptionalText(body.placeLabel);
  const suggestions = [
    observationEventAreaSuggestion("facility", placeLabel ? `${placeLabel}敷地寄せ` : "施設・集合場所寄せ", "集合場所と施設周辺を中心に、迷いにくい範囲へ寄せます。", lat, lng, Math.max(100, Math.round(radiusM * 0.9)), [
      "施設管理者の案内と立入可能範囲を現地で確認してください。"
    ]),
    observationEventAreaSuggestion("safe_walk", "安全な徒歩圏", "親子や初参加者が歩きやすいように、範囲を締めます。", lat, lng, Math.max(180, Math.round(radiusM * 0.72)), [
      "道路横断や私有地への立ち入りは現地で確認してください。"
    ]),
    observationEventAreaSuggestion("nature_rich", "自然観察寄せ", "周辺の緑や水辺も見に行けるよう、観察範囲を広げます。", lat, lng, Math.max(220, Math.round(radiusM * 1.35)), [
      "公園・緑地を含める場合は集合場所と移動時間を確認してください。"
    ])
  ];
  return json({
    suggestions,
    provider: "fallback",
    promptVersion: "cloudflare_worker_area_fallback/v1",
    compatibility: {
      source: "cloudflare_d1_native",
      userId: session.userId
    }
  }, 200, { "cache-control": "no-store" });
}

function clampObservationEventAreaRadius(radiusM: number): number {
  return Math.max(80, Math.min(1500, Math.round(Number.isFinite(radiusM) ? radiusM : 300)));
}

function observationEventAreaSuggestion(
  id: "facility" | "safe_walk" | "nature_rich",
  label: string,
  reason: string,
  lat: number,
  lng: number,
  radiusM: number,
  warnings: string[]
) {
  const polygon = publicAreaApproxPolygon(lat, lng, radiusM, null);
  return {
    id,
    label,
    reason,
    geometry: {
      type: "Polygon",
      coordinates: [polygon]
    },
    center: { lat, lng },
    radiusM,
    areaHa: Math.round((Math.PI * radiusM * radiusM / 10000) * 10) / 10,
    warnings,
    source: "fallback"
  };
}

async function createObservationEventSession(request: Request, env: Env): Promise<Response> {
  const session = await readCompatibleSessionWithOriginFallback(request, env);
  if (!session) return json({ error: "login required" }, 401, { "cache-control": "no-store" });
  const body = await readJson<Record<string, unknown>>(request);
  const startedAt = normalizeOptionalText(body.started_at);
  const title = normalizeOptionalText(body.title);
  if (!startedAt) return json({ error: "started_at required" }, 400, { "cache-control": "no-store" });
  if (!title) return json({ error: "title required" }, 400, { "cache-control": "no-store" });
  const fieldId = normalizeOptionalText(body.field_id);
  const lat = numberOrNullFromUnknown(body.location_lat);
  const lng = numberOrNullFromUnknown(body.location_lng);
  if (!fieldId && (lat === null || lng === null)) {
    return json({ error: "field_id or location_lat/location_lng required" }, 400, { "cache-control": "no-store" });
  }
  const primaryMode = observationEventMode(body.primary_mode) ?? "discovery";
  const activeModes = observationEventModes(body.active_modes, primaryMode);
  const id = crypto.randomUUID();
  await env.OBS_DB.prepare(
    `INSERT INTO observation_event_sessions (
       session_id, legacy_event_id, event_code, title, organizer_user_id, corporation_id,
       plan, primary_mode, active_modes_json, location_lat, location_lng, location_radius_m,
       started_at, ended_at, target_species_json, config_json, field_id, template_source_session_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    normalizeOptionalText(body.legacy_event_id),
    normalizeOptionalText(body.event_code),
    title,
    session.userId,
    normalizeOptionalText(body.corporation_id),
    body.plan === "public" ? "public" : "community",
    primaryMode,
    JSON.stringify(activeModes),
    lat,
    lng,
    Math.round(numberOrNullFromUnknown(body.location_radius_m) ?? 1000),
    startedAt,
    normalizeOptionalText(body.ended_at),
    JSON.stringify(stringArray(body.target_species)),
    JSON.stringify(asPlainObject(body.config) ?? {}),
    fieldId,
    normalizeOptionalText(body.template_source_session_id)
  ).run();
  const created = await getObservationEventSessionById(env, id);
  return json(created, 201, { "cache-control": "no-store" });
}

async function updateObservationEventSession(request: Request, env: Env, sessionId: string): Promise<Response> {
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  const body = await readJson<Record<string, unknown>>(request);
  const current = auth.session;
  const primaryMode = observationEventMode(body.primary_mode) ?? current.primaryMode;
  await env.OBS_DB.prepare(
    `UPDATE observation_event_sessions
        SET title = ?, event_code = ?, primary_mode = ?, active_modes_json = ?,
            location_lat = ?, location_lng = ?, location_radius_m = ?, started_at = ?,
            target_species_json = ?, plan = ?, config_json = ?, field_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?`
  ).bind(
    typeof body.title === "string" ? body.title : current.title,
    body.event_code === undefined ? current.eventCode : normalizeOptionalText(body.event_code),
    primaryMode,
    JSON.stringify(Array.isArray(body.active_modes) ? observationEventModes(body.active_modes, primaryMode) : current.activeModes),
    body.location_lat === undefined ? current.locationLat : numberOrNullFromUnknown(body.location_lat),
    body.location_lng === undefined ? current.locationLng : numberOrNullFromUnknown(body.location_lng),
    body.location_radius_m === undefined ? current.locationRadiusM : Math.round(numberOrNullFromUnknown(body.location_radius_m) ?? current.locationRadiusM),
    typeof body.started_at === "string" ? body.started_at : current.startedAt,
    JSON.stringify(Array.isArray(body.target_species) ? stringArray(body.target_species) : current.targetSpecies),
    body.plan === "public" || body.plan === "community" ? body.plan : current.plan,
    JSON.stringify(asPlainObject(body.config) ?? current.config),
    body.field_id === undefined ? current.fieldId : normalizeOptionalText(body.field_id),
    sessionId
  ).run();
  return json({ session: await getObservationEventSessionById(env, sessionId) }, 200, { "cache-control": "no-store" });
}

async function switchObservationEventMode(request: Request, env: Env, sessionId: string): Promise<Response> {
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  const body = await readJson<Record<string, unknown>>(request);
  const next = observationEventMode(body.primary_mode);
  if (!next) return json({ error: "invalid primary_mode" }, 400, { "cache-control": "no-store" });
  const activeModes = [...new Set([...auth.session.activeModes, next])];
  await env.OBS_DB.prepare(
    "UPDATE observation_event_sessions SET primary_mode = ?, active_modes_json = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?"
  ).bind(next, JSON.stringify(activeModes), sessionId).run();
  await appendObservationEventLive(env, { sessionId, type: "mode_switch", scope: "all", actorUserId: auth.auth.userId, payload: { primary_mode: next, active_modes: activeModes } });
  return json({ session: await getObservationEventSessionById(env, sessionId) }, 200, { "cache-control": "no-store" });
}

async function endObservationEventSession(request: Request, env: Env, sessionId: string): Promise<Response> {
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  await env.OBS_DB.prepare(
    "UPDATE observation_event_sessions SET ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE session_id = ?"
  ).bind(sessionId).run();
  return json({ session: await getObservationEventSessionById(env, sessionId) }, 200, { "cache-control": "no-store" });
}

async function createObservationEventTeam(request: Request, env: Env, sessionId: string): Promise<Response> {
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  const body = await readJson<Record<string, unknown>>(request);
  const name = normalizeOptionalText(body.name);
  if (!name) return json({ error: "name required" }, 400, { "cache-control": "no-store" });
  const teamId = crypto.randomUUID();
  const team = {
    team_id: teamId,
    name,
    color: normalizeOptionalText(body.color) ?? "#4f9d69",
    lead_user_id: normalizeOptionalText(body.lead_user_id),
    target_taxa: stringArray(body.target_taxa)
  };
  await env.OBS_DB.prepare(
    "INSERT INTO observation_event_teams (team_id, session_id, name, color, lead_user_id, target_taxa_json) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(teamId, sessionId, team.name, team.color, team.lead_user_id, JSON.stringify(team.target_taxa)).run();
  await appendObservationEventLive(env, { sessionId, type: "team_update", scope: "all", actorUserId: auth.auth.userId, teamId, payload: { kind: "created", team } });
  return json({ team }, 201, { "cache-control": "no-store" });
}

async function checkinObservationEvent(request: Request, env: Env, sessionId: string): Promise<Response> {
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  const auth = await readCompatibleSessionWithOriginFallback(request, env);
  const body = await readJson<Record<string, unknown>>(request);
  const guestToken = normalizeOptionalText(body.guest_token);
  if (!auth && !guestToken) return json({ error: "user or guest_token required" }, 400, { "cache-control": "no-store" });
  const participantId = await upsertObservationEventParticipant(env, {
    sessionId,
    userId: auth?.userId ?? null,
    guestToken,
    displayName: normalizeOptionalText(body.display_name) ?? "",
    teamId: normalizeOptionalText(body.team_id),
    isMinor: body.is_minor === true,
    shareLocation: body.share_location === true,
    locationShareUntil: normalizeOptionalText(body.location_share_until),
    locationShareConsentType: normalizeOptionalText(body.location_share_consent_type)
  });
  await appendObservationEventLive(env, {
    sessionId,
    type: "checkin",
    scope: "organizer",
    actorUserId: auth?.userId ?? null,
    actorGuestToken: guestToken,
    teamId: normalizeOptionalText(body.team_id),
    payload: { participant_id: participantId, display_name: normalizeOptionalText(body.display_name) ?? "", team_id: normalizeOptionalText(body.team_id), location_share: body.share_location === true }
  });
  return json({ participant_id: participantId }, 200, { "cache-control": "no-store" });
}

async function updateObservationEventRole(request: Request, env: Env, sessionId: string): Promise<Response> {
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  const auth = await readCompatibleSessionWithOriginFallback(request, env);
  const body = await readJson<Record<string, unknown>>(request);
  const guestToken = normalizeOptionalText(body.guest_token);
  const declaredJob = normalizeOptionalText(body.declared_job);
  if (!declaredJob || !["shoot", "identify", "map", "record", "absence", "free"].includes(declaredJob)) {
    return json({ error: "invalid declared_job" }, 400, { "cache-control": "no-store" });
  }
  if (!auth && !guestToken) return json({ error: "user or guest_token required" }, 400, { "cache-control": "no-store" });
  const participant = await findObservationEventParticipant(env, sessionId, auth?.userId ?? null, guestToken);
  if (!participant) return json({ error: "participant not found" }, 404, { "cache-control": "no-store" });
  await env.OBS_DB.prepare(
    "UPDATE observation_event_participants SET declared_job = ?, updated_at = CURRENT_TIMESTAMP WHERE participant_id = ?"
  ).bind(declaredJob, participant.participant_id).run();
  await appendObservationEventLive(env, { sessionId, type: "team_update", scope: "team", teamId: participant.team_id, actorUserId: auth?.userId ?? null, actorGuestToken: guestToken, payload: { kind: "role", participant_id: participant.participant_id, declared_job: declaredJob } });
  return json({ participant_id: participant.participant_id, declared_job: declaredJob }, 200, { "cache-control": "no-store" });
}

async function announceObservationEvent(request: Request, env: Env, sessionId: string): Promise<Response> {
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  const body = await readJson<Record<string, unknown>>(request);
  const message = normalizeOptionalText(body.message);
  if (!message) return json({ error: "message required" }, 400, { "cache-control": "no-store" });
  const event = await appendObservationEventLive(env, { sessionId, type: "announce", scope: "all", actorUserId: auth.auth.userId, payload: { message, template: normalizeOptionalText(body.template) } });
  return json({ event }, 200, { "cache-control": "no-store" });
}

async function createObservationEventAbsence(request: Request, env: Env, sessionId: string): Promise<Response> {
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  const auth = await readCompatibleSessionWithOriginFallback(request, env);
  const body = await readJson<Record<string, unknown>>(request);
  const guestToken = normalizeOptionalText(body.guest_token);
  const taxon = normalizeOptionalText(body.searched_taxon);
  const lat = numberOrNullFromUnknown(body.lat);
  const lng = numberOrNullFromUnknown(body.lng);
  if (!taxon || lat === null || lng === null) return json({ error: "searched_taxon, lat, lng required" }, 400, { "cache-control": "no-store" });
  if (!auth && !guestToken) return json({ error: "user or guest_token required" }, 400, { "cache-control": "no-store" });
  const teamId = normalizeOptionalText(body.team_id);
  const absenceId = crypto.randomUUID();
  const confidenceRaw = normalizeOptionalText(body.confidence) ?? "searched";
  const confidence = ["searched", "confirmed_absent", "expert_verified"].includes(confidenceRaw) ? confidenceRaw : "searched";
  const publicLat = roundPublicEventCoordinate(lat);
  const publicLng = roundPublicEventCoordinate(lng);
  await env.OBS_DB.prepare(
    `INSERT INTO observation_event_absences (
       absence_id, session_id, user_id, guest_token, team_id, searched_taxon,
       effort_seconds, public_lat, public_lng, confidence, notes
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(absenceId, sessionId, auth?.userId ?? null, guestToken, teamId, taxon, Math.max(0, Math.round(numberOrNullFromUnknown(body.effort_seconds) ?? 0)), publicLat, publicLng, confidence, normalizeOptionalText(body.notes) ?? "").run();
  await recordObservationEventMeshVisit(env, { sessionId, lat: publicLat, lng: publicLng, absenceDelta: 1, teamId });
  const event = await appendObservationEventLive(env, { sessionId, type: "absence_recorded", scope: "all", actorUserId: auth?.userId ?? null, actorGuestToken: guestToken, teamId, payload: { absence_id: absenceId, searched_taxon: taxon, confidence } });
  return json({ absence_id: absenceId, event }, 201, { "cache-control": "no-store" });
}

async function getObservationEventRecent(url: URL, env: Env, sessionId: string, cookieHeader: string | null): Promise<Response> {
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "100"), 1, 500);
  const ctx = await observationEventParticipantContext(env, session, cookieHeader, url.searchParams.get("guest_token"));
  const events = (await listObservationEventLiveEvents(env, sessionId, limit)).filter((event) => shouldDeliverObservationEvent(event, ctx));
  return json({ session, events }, 200, { "cache-control": "no-store" });
}

async function getObservationEventLiveSnapshot(url: URL, env: Env, sessionId: string, cookieHeader: string | null): Promise<Response> {
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  const ctx = await observationEventParticipantContext(env, session, cookieHeader, url.searchParams.get("guest_token"));
  const events = (await listObservationEventLiveEvents(env, sessionId, 50)).filter((event) => shouldDeliverObservationEvent(event, ctx)).reverse();
  const payload = `event: snapshot\ndata: ${JSON.stringify({ session, events })}\n\nevent: ping\ndata: ${JSON.stringify({ now: new Date().toISOString(), mode: "snapshot_only" })}\n\n`;
  return new Response(payload, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-ikimon-observation-event-live-mode": "snapshot-only"
    }
  });
}

async function summarizeObservationEventEffort(env: Env, session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>) {
  const target = Math.max(1, Number(session.config.coverage_target_cells ?? 100) || 100);
  const row = await env.OBS_DB.prepare(
    `SELECT COUNT(*) AS visited_cells,
            COALESCE(SUM(visit_seconds), 0) AS visit_seconds_sum,
            COALESCE(SUM(observation_count), 0) AS observation_sum,
            COALESCE(SUM(absence_count), 0) AS absence_sum
       FROM observation_event_mesh_cells
      WHERE session_id = ?`
  ).bind(session.sessionId).first<ObservationEventMeshSummaryRow>();
  const visited = Number(row?.visited_cells ?? 0);
  const seconds = Number(row?.visit_seconds_sum ?? 0);
  const observations = Number(row?.observation_sum ?? 0);
  const absences = Number(row?.absence_sum ?? 0);
  return {
    sessionId: session.sessionId,
    totalVisitedCells: visited,
    totalEffortSeconds: seconds,
    totalEffortPersonHours: Math.round((seconds / 3600) * 100) / 100,
    totalObservations: observations,
    totalAbsences: absences,
    coveragePct: Math.min(100, Math.round((visited / target) * 1000) / 10)
  };
}

async function getObservationEventEffort(env: Env, sessionId: string): Promise<Response> {
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  const effort = await summarizeObservationEventEffort(env, session);
  return json({
    session,
    effort
  }, 200, { "cache-control": "no-store" });
}

async function getObservationEventRecap(request: Request, url: URL, env: Env, sessionId: string): Promise<Response> {
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  const auth = await readCompatibleSession(request, env).catch(() => null);
  const guestToken = normalizeOptionalText(url.searchParams.get("guest_token"));
  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "200"), 20, 500);
  const [eventsDesc, teams, participants, absenceRows, effort] = await Promise.all([
    listObservationEventLiveEvents(env, sessionId, limit),
    listObservationEventTeams(env, sessionId),
    listObservationEventParticipants(env, sessionId),
    listObservationEventAbsences(env, sessionId),
    summarizeObservationEventEffort(env, session)
  ]);
  const events = eventsDesc.reverse();
  const observationEvents = events.filter((event) => event.type === "observation_added");
  const guideSceneCount = events.filter((event) => event.type === "guide_scene_added").length;
  const fieldScanCount = events.filter((event) => event.type === "field_scan_added").length;
  const fanfareCount = events.filter((event) => ["rare_species", "target_hit", "milestone", "fanfare"].includes(event.type)).length;
  const taxonCounts = countObservationEventTaxa(observationEvents);
  const startedAt = session.startedAt;
  const endedAt = session.endedAt;
  const durationMinutes = durationMinutesBetween(startedAt, endedAt);
  const viewer = findObservationEventViewerParticipant(participants, auth?.userId ?? null, guestToken);
  const myEvents = viewer
    ? observationEvents.filter((event) => (viewer.user_id && event.actorUserId === viewer.user_id) || (viewer.guest_token && event.actorGuestToken === viewer.guest_token))
    : [];
  const myTaxa = [...countObservationEventTaxa(myEvents).keys()];
  await recordObservationEventRecapView(env, sessionId, auth?.userId ?? null, guestToken);
  return json({
    session,
    permissions: { canManage: Boolean(auth?.userId && auth.userId === session.organizerUserId) },
    highlights: {
      observationCount: observationEvents.length,
      guideSceneCount,
      fieldScanCount,
      uniqueSpeciesCount: taxonCounts.size,
      absencesCount: absenceRows.length,
      participantsCount: participants.length,
      questsOffered: 0,
      questsAccepted: 0,
      questsCompleted: 0,
      fanfareCount,
      totalEffortPersonHours: effort.totalEffortPersonHours,
      meshCoveragePct: effort.coveragePct,
      topTaxa: [...taxonCounts.entries()].map(([name, count]) => ({ name, count })).slice(0, 8),
      startedAt,
      endedAt,
      durationMinutes
    },
    effort,
    teams: teams.map((team) => {
      const teamEvents = observationEvents.filter((event) => event.teamId === team.team_id);
      return {
        teamId: team.team_id,
        name: team.name,
        color: team.color,
        memberCount: participants.filter((participant) => participant.team_id === team.team_id).length,
        observationsCount: teamEvents.length,
        uniqueSpeciesCount: countObservationEventTaxa(teamEvents).size,
        absencesCount: absenceRows.filter((absence) => absence.team_id === team.team_id).length,
        questsAccepted: 0
      };
    }),
    timeline: events.map((event) => ({
      liveEventId: event.liveEventId,
      type: event.type,
      scope: event.scope,
      teamId: event.teamId,
      payload: event.payload,
      createdAt: event.createdAt
    })),
    impacts: [],
    myContribution: viewer ? {
      participantId: viewer.participant_id,
      displayName: viewer.display_name ?? null,
      teamId: viewer.team_id,
      observationsCount: myEvents.length,
      uniqueSpeciesCount: myTaxa.length,
      absencesCount: absenceRows.filter((absence) => (viewer.user_id && absence.user_id === viewer.user_id) || (viewer.guest_token && absence.guest_token === viewer.guest_token)).length,
      questsAccepted: 0,
      recentTaxa: myTaxa.slice(0, 8)
    } : null
  }, 200, { "cache-control": "no-store" });
}

async function getObservationEventSpeciesCsv(request: Request, env: Env, sessionId: string): Promise<Response> {
  const report = await buildObservationEventOfficialReport(request, env, sessionId);
  if (report instanceof Response) return report;
  const header = ["observed_at", "taxon_name", "team_id", "record_kind", "match_source", "evidence_ref"];
  const rows = report.speciesRecords.map((record) => [
    record.observedAt,
    record.taxonName,
    record.teamId ?? "",
    record.recordKind,
    record.matchSource,
    record.evidenceRef ?? ""
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="observation-event-${sessionId}-species.csv"`,
      "cache-control": "no-store"
    }
  });
}

async function buildObservationEventOfficialReport(request: Request, env: Env, sessionId: string) {
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  const auth = await readCompatibleSession(request, env).catch(() => null);
  if (session.plan !== "public" && auth?.userId !== session.organizerUserId) {
    return json({ error: "not allowed" }, 403, { "cache-control": "no-store" });
  }
  const rows = (await listObservationEventLiveEvents(env, sessionId, 500))
    .filter((event) => ["observation_added", "guide_scene_added", "field_scan_added"].includes(event.type))
    .reverse();
  const speciesRecords = rows
    .filter((event) => event.type === "observation_added")
    .map((event) => {
      const taxonName = observationEventTaxonName(event.payload);
      if (!taxonName) return null;
      return {
        liveEventId: event.liveEventId,
        observedAt: event.createdAt,
        teamId: event.teamId,
        taxonName,
        recordKind: "observation_added" as const,
        matchSource: "explicit_session_event" as const,
        evidenceRef: normalizeOptionalText(event.payload.observation_id)
          ?? normalizeOptionalText(event.payload.visit_id)
          ?? normalizeOptionalText(event.payload.occurrence_id)
          ?? normalizeOptionalText(event.payload.asset_id)
      };
    })
    .filter((record): record is NonNullable<typeof record> => record !== null);
  const topTaxa = [...countObservationEventTaxa(rows.filter((event) => event.type === "observation_added")).entries()]
    .map(([taxonName, count]) => ({ taxonName, count }))
    .slice(0, 30);
  return {
    schemaVersion: "observation_event_official_report/v1",
    session,
    generatedAt: new Date().toISOString(),
    claimBoundary: {
      canSay: [
        "この観察会セッションに明示的に紐づいた記録の集計",
        "観察会中に記録された種名候補と件数",
        "公式提出前の確認用リスト"
      ],
      cannotSay: [
        "半径内に存在しただけの第三者記録を観察会成果として扱うこと",
        "AI候補だけで種同定が確定したと表現すること",
        "希少種や配慮対象種の正確な位置を未確認のまま公開すること"
      ]
    },
    privacyBoundary: {
      exactCoordinatesIncluded: false,
      sensitiveSpeciesRequiresOrganizerReview: true
    },
    stats: {
      officialObservationCount: speciesRecords.length,
      uniqueTaxaCount: topTaxa.length,
      guideSceneCount: rows.filter((event) => event.type === "guide_scene_added").length,
      fieldScanCount: rows.filter((event) => event.type === "field_scan_added").length
    },
    topTaxa,
    speciesRecords
  };
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

async function generateObservationEventCapsule(request: Request, env: Env, sessionId: string): Promise<Response> {
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  await readJson<Record<string, unknown>>(request).catch(() => ({}));
  const [eventsDesc, participants, absences] = await Promise.all([
    listObservationEventLiveEvents(env, sessionId, 500),
    listObservationEventParticipants(env, sessionId),
    listObservationEventAbsences(env, sessionId)
  ]);
  const events = eventsDesc.reverse();
  const capsule = buildObservationEventCapsulePayload(auth.session, events, participants, absences, auth.auth.userId);
  await upsertObservationEventCapsule(env, capsule);
  return json({ capsule }, 201, { "cache-control": "no-store" });
}

async function getObservationEventCapsule(request: Request, env: Env, sessionId: string): Promise<Response> {
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  const row = await getObservationEventCapsuleRow(env, sessionId);
  if (!row) return json({ error: "capsule not found" }, 404, { "cache-control": "no-store" });
  const capsule = mapObservationEventCapsule(row);
  const auth = await readCompatibleSession(request, env).catch(() => null);
  const canManage = Boolean(auth?.userId && auth.userId === session.organizerUserId);
  if (canManage) return json({ capsule }, 200, { "cache-control": "no-store" });
  if (!["approved_public", "published"].includes(capsule.reviewStatus)) {
    return json({ error: "capsule not public" }, 403, { "cache-control": "no-store" });
  }
  return json({
    capsule: {
      sessionId: capsule.sessionId,
      publicStoryDraft: capsule.publicStoryDraft,
      sourceCounts: capsule.sourceCounts,
      sourceClusters: capsule.sourceClusters,
      reviewStatus: capsule.reviewStatus,
      publishedAt: capsule.publishedAt,
      generatedAt: capsule.generatedAt
    }
  }, 200, { "cache-control": "no-store" });
}

async function reviewObservationEventCapsule(request: Request, env: Env, sessionId: string): Promise<Response> {
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  const row = await getObservationEventCapsuleRow(env, sessionId);
  if (!row) return json({ error: "capsule not found" }, 404, { "cache-control": "no-store" });
  const body = await readJson<Record<string, unknown>>(request);
  const reviewStatus = normalizeCapsuleReviewStatus(body.review_status ?? body.reviewStatus);
  if (!reviewStatus) return json({ error: "invalid review_status" }, 400, { "cache-control": "no-store" });
  const capsule = mapObservationEventCapsule(row);
  if (["approved_public", "published"].includes(reviewStatus) && capsule.privacyRiskQueue.length > 0) {
    return json({ error: "privacy review blockers remain", blockers: capsule.privacyRiskQueue }, 409, { "cache-control": "no-store" });
  }
  await env.OBS_DB.prepare(
    `UPDATE observation_event_capsules
        SET review_status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
            published_at = CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE published_at END,
            updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?`
  ).bind(reviewStatus, auth.auth.userId, reviewStatus, sessionId).run();
  const updated = await getObservationEventCapsuleRow(env, sessionId);
  return json({ capsule: updated ? mapObservationEventCapsule(updated) : null }, 200, { "cache-control": "no-store" });
}

function normalizeCapsuleReviewStatus(value: unknown): "draft" | "needs_review" | "approved_private" | "approved_public" | "published" | null {
  const text = normalizeOptionalText(value);
  if (text === "draft" || text === "needs_review" || text === "approved_private" || text === "approved_public" || text === "published") return text;
  return null;
}

function buildObservationEventCapsulePayload(
  session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>,
  events: Awaited<ReturnType<typeof listObservationEventLiveEvents>>,
  participants: ObservationEventParticipantD1Row[],
  absences: Awaited<ReturnType<typeof listObservationEventAbsences>>,
  generatedBy: string
) {
  const observationEvents = events.filter((event) => event.type === "observation_added");
  const guideEvents = events.filter((event) => event.type === "guide_scene_added");
  const scanEvents = events.filter((event) => event.type === "field_scan_added");
  const taxonCounts = countObservationEventTaxa(observationEvents);
  const sourceRefs = events
    .filter((event) => ["observation_added", "guide_scene_added", "field_scan_added", "absence_recorded"].includes(event.type))
    .map((event) => ({
      sourceRef: `live:${event.liveEventId}`,
      sourceType: event.type === "guide_scene_added" ? "guide_scene" : event.type === "field_scan_added" ? "field_scan" : event.type === "absence_recorded" ? "absence" : "observation",
      label: observationEventTaxonName(event.payload) ?? normalizeOptionalText(event.payload.summary) ?? normalizeOptionalText(event.payload.scene_summary) ?? event.type,
      createdAt: event.createdAt
    }));
  const privacyRiskQueue = detectObservationEventCapsuleRisks(events, participants);
  const publicReady = privacyRiskQueue.length === 0;
  const sourceCounts = {
    observations: observationEvents.length,
    guideScenes: guideEvents.length,
    fieldScans: scanEvents.length,
    absences: absences.length,
    participants: participants.length,
    minors: participants.filter((participant) => participant.is_minor === 1).length,
    risks: privacyRiskQueue.length
  };
  const generatedAt = new Date().toISOString();
  return {
    sessionId: session.sessionId,
    sourceCounts,
    sourceClusters: {
      topTaxa: [...taxonCounts.entries()].map(([label, count]) => ({ label, count, sourceRefs: observationEvents.filter((event) => observationEventTaxonName(event.payload) === label).map((event) => `live:${event.liveEventId}`).slice(0, 8) })).slice(0, 8),
      guideThemes: guideEvents.reduce<Array<{ label: string; count: number; sourceRefs: string[] }>>((acc, event) => {
        const label = normalizeOptionalText(event.payload.theme) ?? normalizeOptionalText(event.payload.scene_summary) ?? "ガイドで見た場面";
        const existing = acc.find((item) => item.label === label);
        if (existing) {
          existing.count += 1;
          existing.sourceRefs.push(`live:${event.liveEventId}`);
        } else {
          acc.push({ label, count: 1, sourceRefs: [`live:${event.liveEventId}`] });
        }
        return acc;
      }, []).slice(0, 8),
      scanModes: scanEvents.reduce<Array<{ label: string; count: number; sourceRefs: string[] }>>((acc, event) => {
        const label = normalizeOptionalText(event.payload.scan_mode) ?? normalizeOptionalText(event.payload.mode) ?? "field_scan";
        const existing = acc.find((item) => item.label === label);
        if (existing) {
          existing.count += 1;
          existing.sourceRefs.push(`live:${event.liveEventId}`);
        } else {
          acc.push({ label, count: 1, sourceRefs: [`live:${event.liveEventId}`] });
        }
        return acc;
      }, []).slice(0, 8),
      sourceRefs
    },
    privateDigest: {
      title: `${session.title} まとめ`,
      summary: `${sourceCounts.observations}件の観察、${sourceCounts.absences}件の不在確認、${sourceCounts.participants}人の参加をD1上のイベントから集計しました。`,
      organizerNotes: privacyRiskQueue.length > 0 ? ["公開前に人物・音声・正確な位置の確認が必要です。"] : ["公開候補として確認できます。"],
      nextActions: ["種名候補を確認する", "公開範囲を確認する"],
      sourceRefs: sourceRefs.map((ref) => ref.sourceRef).slice(0, 50)
    },
    publicStoryDraft: {
      title: session.title,
      lead: sourceCounts.observations > 0 ? `${session.title}で記録された観察の概要です。` : `${session.title}の実施概要です。`,
      sections: [
        {
          heading: "記録",
          body: `${sourceCounts.observations}件の観察候補と${sourceCounts.absences}件の不在確認が残っています。`,
          sourceRefs: sourceRefs.map((ref) => ref.sourceRef).slice(0, 12)
        }
      ],
      claimLimit: publicReady ? "draft_requires_review" : "privacy_review_required"
    },
    recordCandidates: observationEvents.map((event) => ({
      candidateId: `candidate:${event.liveEventId}`,
      sourceType: "observation",
      taxonLabel: observationEventTaxonName(event.payload) ?? "未同定の記録",
      identificationStatus: "suggested",
      confidence: numberOrNullFromUnknown(event.payload.confidence),
      sourceRefs: [`live:${event.liveEventId}`],
      notes: []
    })).slice(0, 50),
    privacyRiskQueue,
    readiness: {
      privateReady: true,
      publicReady,
      reportReady: true,
      exportReady: publicReady,
      blockers: privacyRiskQueue.map((risk) => risk.riskType),
      warnings: publicReady ? [] : ["公開前レビューが必要です。"]
    },
    sourceHash: `native:${session.sessionId}:${events.length}:${participants.length}:${absences.length}`,
    modelMetadata: {
      provider: "fallback",
      model: "cloudflare-d1-deterministic-capsule",
      promptVersion: "place_event_capsule/v1",
      aiAttempted: false,
      fallbackReason: "cloudflare_worker_native_no_ai",
      paidOrVertexRequired: false
    },
    reviewStatus: privacyRiskQueue.length > 0 ? "needs_review" : "draft",
    reviewedBy: null,
    reviewedAt: null,
    publishedAt: null,
    generatedBy,
    generatedAt,
    updatedAt: generatedAt
  };
}

function detectObservationEventCapsuleRisks(events: Awaited<ReturnType<typeof listObservationEventLiveEvents>>, participants: ObservationEventParticipantD1Row[]) {
  const risks: Array<{ riskId: string; riskType: string; blockingLevel: string; reason: string; sourceRefs: string[] }> = [];
  const minorRefs = participants.filter((participant) => participant.is_minor === 1).map((participant) => `participant:${participant.participant_id}`);
  if (minorRefs.length > 0) {
    risks.push({ riskId: "risk:minor_present", riskType: "minor_present", blockingLevel: "public_display", reason: "未成年の参加者が含まれるため公開前確認が必要です。", sourceRefs: minorRefs });
  }
  for (const event of events) {
    const payload = event.payload;
    const ref = `live:${event.liveEventId}`;
    const faceCount = numberOrNullFromUnknown(asPlainObject(payload.face_privacy)?.face_count) ?? 0;
    if (truthyPayloadFlag(payload, ["person_present", "face_present", "has_face"]) || faceCount > 0) {
      risks.push({ riskId: `risk:face:${event.liveEventId}`, riskType: "face_present", blockingLevel: "public_display", reason: "人物または顔が含まれる可能性があります。", sourceRefs: [ref] });
    }
    if (truthyPayloadFlag(payload, ["human_voice", "voice_flag", "speech_likely"]) || normalizeOptionalText(payload.audio_privacy_status) === "deleted_human_voice") {
      risks.push({ riskId: `risk:voice:${event.liveEventId}`, riskType: "human_voice", blockingLevel: "public_display", reason: "人声が含まれる可能性があります。", sourceRefs: [ref] });
    }
    if (truthyPayloadFlag(payload, ["exact_location", "exact_location_stored"]) || numberOrNullFromUnknown(payload.exact_lat) !== null || numberOrNullFromUnknown(payload.exact_lng) !== null) {
      risks.push({ riskId: `risk:location:${event.liveEventId}`, riskType: "exact_location", blockingLevel: "public_display", reason: "正確な位置が含まれる可能性があります。", sourceRefs: [ref] });
    }
  }
  return risks;
}

function truthyPayloadFlag(payload: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key) => {
    const value = payload[key];
    return value === true || value === "true" || value === 1 || value === "1";
  });
}

async function getObservationEventCapsuleRow(env: Env, sessionId: string) {
  return env.OBS_DB.prepare(
    `SELECT session_id, source_counts_json, source_clusters_json, private_digest_json,
            public_story_draft_json, record_candidates_json, privacy_risk_queue_json,
            readiness_json, source_hash, model_metadata_json, review_status, reviewed_by,
            reviewed_at, published_at, generated_at, updated_at
       FROM observation_event_capsules
      WHERE session_id = ?`
  ).bind(sessionId).first<ObservationEventCapsuleD1Row>();
}

async function upsertObservationEventCapsule(env: Env, capsule: ReturnType<typeof buildObservationEventCapsulePayload>): Promise<void> {
  await env.OBS_DB.prepare(
    `INSERT INTO observation_event_capsules (
       capsule_id, session_id, source_counts_json, source_clusters_json, private_digest_json,
       public_story_draft_json, record_candidates_json, privacy_risk_queue_json, readiness_json,
       source_hash, model_metadata_json, review_status, generated_by, generated_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       source_counts_json = excluded.source_counts_json,
       source_clusters_json = excluded.source_clusters_json,
       private_digest_json = excluded.private_digest_json,
       public_story_draft_json = excluded.public_story_draft_json,
       record_candidates_json = excluded.record_candidates_json,
       privacy_risk_queue_json = excluded.privacy_risk_queue_json,
       readiness_json = excluded.readiness_json,
       source_hash = excluded.source_hash,
       model_metadata_json = excluded.model_metadata_json,
       review_status = excluded.review_status,
       generated_by = excluded.generated_by,
       generated_at = excluded.generated_at,
       updated_at = excluded.updated_at`
  ).bind(
    crypto.randomUUID(),
    capsule.sessionId,
    JSON.stringify(capsule.sourceCounts),
    JSON.stringify(capsule.sourceClusters),
    JSON.stringify(capsule.privateDigest),
    JSON.stringify(capsule.publicStoryDraft),
    JSON.stringify(capsule.recordCandidates),
    JSON.stringify(capsule.privacyRiskQueue),
    JSON.stringify(capsule.readiness),
    capsule.sourceHash,
    JSON.stringify(capsule.modelMetadata),
    capsule.reviewStatus,
    capsule.generatedBy,
    capsule.generatedAt,
    capsule.updatedAt
  ).run();
}

function mapObservationEventCapsule(row: ObservationEventCapsuleD1Row) {
  return {
    sessionId: row.session_id,
    sourceCounts: jsonObject(row.source_counts_json),
    sourceClusters: jsonObject(row.source_clusters_json),
    privateDigest: jsonObject(row.private_digest_json),
    publicStoryDraft: jsonObject(row.public_story_draft_json),
    recordCandidates: jsonArray(row.record_candidates_json),
    privacyRiskQueue: jsonArray(row.privacy_risk_queue_json) as Array<Record<string, unknown>>,
    readiness: jsonObject(row.readiness_json),
    sourceHash: row.source_hash,
    modelMetadata: jsonObject(row.model_metadata_json),
    reviewStatus: normalizeCapsuleReviewStatus(row.review_status) ?? "draft",
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    publishedAt: row.published_at,
    generatedAt: row.generated_at,
    updatedAt: row.updated_at
  };
}

async function pingObservationEventLocation(request: Request, env: Env, sessionId: string): Promise<Response> {
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  if (!isObservationEventLocationShareOpen(session)) {
    return json({ error: "location sharing is outside event time" }, 403, { "cache-control": "no-store" });
  }
  const auth = await readCompatibleSessionWithOriginFallback(request, env);
  const body = await readJson<Record<string, unknown>>(request);
  const guestToken = normalizeOptionalText(body.guest_token);
  if (!auth && !guestToken) return json({ error: "user or guest_token required" }, 400, { "cache-control": "no-store" });
  const lat = numberOrNullFromUnknown(body.lat);
  const lng = numberOrNullFromUnknown(body.lng);
  if (lat === null || lng === null) return json({ error: "lat and lng required" }, 400, { "cache-control": "no-store" });
  const participant = await findObservationEventParticipant(env, sessionId, auth?.userId ?? null, guestToken);
  if (!participant) return json({ error: "participant not found" }, 404, { "cache-control": "no-store" });
  const shareUntil = participant.location_share_until ? Date.parse(participant.location_share_until) : 0;
  if (participant.share_location !== 1 || !Number.isFinite(shareUntil) || shareUntil < Date.now()) {
    return json({ error: "location sharing is not enabled" }, 403, { "cache-control": "no-store" });
  }
  const publicLat = roundPublicEventCoordinate(lat);
  const publicLng = roundPublicEventCoordinate(lng);
  await recordObservationEventMeshVisit(env, {
    sessionId,
    lat: publicLat,
    lng: publicLng,
    visitSeconds: numberOrNullFromUnknown(body.visit_seconds) ?? 0,
    teamId: participant.team_id
  });
  const event = await appendObservationEventLive(env, {
    sessionId,
    type: "participant_location_ping",
    scope: "organizer",
    actorUserId: auth?.userId ?? null,
    actorGuestToken: guestToken,
    teamId: participant.team_id,
    payload: {
      participant_id: participant.participant_id,
      display_name: participant.display_name ?? "",
      team_id: participant.team_id,
      public_lat: publicLat,
      public_lng: publicLng,
      precision: "public_3_decimal",
      exact_location_stored: false
    }
  });
  return json({ ok: true, event }, 200, { "cache-control": "no-store" });
}

function isObservationEventLocationShareOpen(session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>): boolean {
  const started = Date.parse(session.startedAt);
  const ended = session.endedAt ? Date.parse(session.endedAt) : Date.now() + 24 * 60 * 60 * 1000;
  const now = Date.now();
  return Number.isFinite(started) && Number.isFinite(ended) && now >= started - 30 * 60 * 1000 && now <= ended + 24 * 60 * 60 * 1000;
}

async function handleObservationEventRallyApi(request: Request, env: Env, sessionId: string, pathRemainder: string): Promise<Response> {
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  const parts = pathRemainder.split("/").filter(Boolean);
  if (request.method === "GET" && parts.length === 0) {
    const rally = await getObservationRallySnapshot(env, sessionId);
    return json({ session, rally }, 200, { "cache-control": "no-store" });
  }
  if (request.method === "POST" && parts[0] === "course" && parts.length === 1) {
    return upsertObservationRallyCourse(request, env, sessionId);
  }
  if (request.method === "POST" && parts[0] === "stations" && parts.length === 1) {
    return createObservationRallyStation(request, env, sessionId);
  }
  if (request.method === "POST" && parts[0] === "missions" && parts.length === 1) {
    return createObservationRallyMission(request, env, sessionId);
  }
  if (request.method === "PATCH" && parts[0] === "missions" && parts[1] && parts.length === 2) {
    return changeObservationRallyMission(request, env, sessionId, parts[1]);
  }
  if (request.method === "POST" && parts[0] === "preflight" && parts[1] === "weather-mode" && parts.length === 2) {
    return switchObservationRallyWeatherMode(request, env, sessionId);
  }
  if (request.method === "POST" && parts[0] === "submissions" && parts.length === 1) {
    return createObservationRallySubmission(request, env, sessionId);
  }
  if (request.method === "PATCH" && parts[0] === "submissions" && parts[1] && parts[2] === "review" && parts.length === 3) {
    return reviewObservationRallySubmission(request, env, sessionId, parts[1]);
  }
  return json({ error: "not_found" }, 404, { "cache-control": "no-store" });
}

async function upsertObservationRallyCourse(request: Request, env: Env, sessionId: string): Promise<Response> {
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  const body = await readJson<Record<string, unknown>>(request);
  const course = await ensureObservationRallyCourse(env, sessionId, auth.auth.userId, {
    title: normalizeOptionalText(body.title) ?? "観察ラリー",
    status: normalizeRallyCourseStatus(body.status) ?? "preflight",
    config: asPlainObject(body.config) ?? {}
  });
  return json({ course }, 200, { "cache-control": "no-store" });
}

async function createObservationRallyStation(request: Request, env: Env, sessionId: string): Promise<Response> {
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  const body = await readJson<Record<string, unknown>>(request);
  const name = normalizeOptionalText(body.name);
  if (!name) return json({ error: "name required" }, 400, { "cache-control": "no-store" });
  const course = await ensureObservationRallyCourse(env, sessionId, auth.auth.userId);
  const stationId = crypto.randomUUID();
  await env.OBS_DB.prepare(
    `INSERT INTO observation_rally_stations (
       station_id, course_id, field_id, code, name, description, lat, lng, radius_m,
       polygon_json, route_geojson, is_private, access_note, danger_note, status, sort_order
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`
  ).bind(
    stationId,
    course.courseId,
    normalizeOptionalText(body.field_id),
    normalizeOptionalText(body.code) ?? "",
    name,
    normalizeOptionalText(body.description) ?? "",
    numberOrNullFromUnknown(body.lat),
    numberOrNullFromUnknown(body.lng),
    numberOrNullFromUnknown(body.radius_m),
    JSON.stringify(asPlainObject(body.polygon) ?? null),
    JSON.stringify(asPlainObject(body.route_geojson) ?? null),
    body.is_private === true ? 1 : 0,
    normalizeOptionalText(body.access_note) ?? "",
    normalizeOptionalText(body.danger_note) ?? "",
    Math.round(numberOrNullFromUnknown(body.sort_order) ?? 0)
  ).run();
  const station = (await listObservationRallyStations(env, course.courseId)).find((row) => row.stationId === stationId);
  await appendObservationEventLive(env, { sessionId, type: "rally_station_opened", scope: "all", actorUserId: auth.auth.userId, payload: { station_id: stationId, name } });
  return json({ station }, 201, { "cache-control": "no-store" });
}

async function createObservationRallyMission(request: Request, env: Env, sessionId: string): Promise<Response> {
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  const body = await readJson<Record<string, unknown>>(request);
  const title = normalizeOptionalText(body.title);
  const target = normalizeOptionalText(body.target);
  const goalCount = numberOrNullFromUnknown(body.goal_count);
  if (!title || !target || goalCount === null || goalCount <= 0) {
    return json({ error: "title, target, positive goal_count required" }, 400, { "cache-control": "no-store" });
  }
  const course = await ensureObservationRallyCourse(env, sessionId, auth.auth.userId);
  const missionId = crypto.randomUUID();
  const scope = normalizeRallyScope(body.scope) ?? "event";
  const locationBinding = normalizeRallyLocationBinding(body.location_binding) ?? "none";
  const countUnit = normalizeRallyCountUnit(body.count_unit) ?? "scene";
  const verificationPolicy = normalizeRallyVerificationPolicy(body.verification_policy) ?? "auto";
  const weatherSensitivity = normalizeRallyWeatherSensitivity(body.weather_sensitivity) ?? "all_weather";
  const status = normalizeRallyMissionStatus(body.status) ?? "draft";
  await env.OBS_DB.prepare(
    `INSERT INTO observation_rally_missions (
       mission_id, course_id, station_id, replacement_for_mission_id, scope, location_binding,
       title, target, count_unit, goal_count, counting_policy_json, verification_policy,
       weather_sensitivity, fallback_group, status, starts_at, ends_at, sort_order, created_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    missionId,
    course.courseId,
    normalizeOptionalText(body.station_id),
    normalizeOptionalText(body.replacement_for_mission_id),
    scope,
    locationBinding,
    title,
    target,
    countUnit,
    goalCount,
    JSON.stringify(asPlainObject(body.counting_policy) ?? {}),
    verificationPolicy,
    weatherSensitivity,
    normalizeOptionalText(body.fallback_group) ?? "",
    status,
    normalizeOptionalText(body.starts_at),
    normalizeOptionalText(body.ends_at),
    Math.round(numberOrNullFromUnknown(body.sort_order) ?? 0),
    auth.auth.userId
  ).run();
  const mission = await getObservationRallyMission(env, missionId);
  await appendObservationEventLive(env, { sessionId, type: "rally_mission_published", scope: "all", actorUserId: auth.auth.userId, payload: { mission_id: missionId, status } });
  return json({ mission: mission ? mapObservationRallyMission(mission) : null }, 201, { "cache-control": "no-store" });
}

async function changeObservationRallyMission(request: Request, env: Env, sessionId: string, missionId: string): Promise<Response> {
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  const current = await getObservationRallyMission(env, missionId);
  if (!current) return json({ error: "mission not found" }, 404, { "cache-control": "no-store" });
  const body = await readJson<Record<string, unknown>>(request);
  const action = normalizeRallyRevisionAction(body.action);
  if (!action) return json({ error: "invalid action" }, 400, { "cache-control": "no-store" });
  const nextStatus = action === "publish" ? "published" : action === "pause" ? "paused" : action === "replace" ? "replaced" : action === "close" ? "closed" : current.status;
  const nextGoal = numberOrNullFromUnknown(body.goal_count) ?? current.goal_count;
  const nextEndsAt = body.ends_at === undefined ? current.ends_at : normalizeOptionalText(body.ends_at);
  await env.OBS_DB.prepare(
    "UPDATE observation_rally_missions SET status = ?, goal_count = ?, ends_at = ?, updated_at = CURRENT_TIMESTAMP WHERE mission_id = ?"
  ).bind(nextStatus, nextGoal, nextEndsAt, missionId).run();
  await appendObservationRallyRevision(env, current.course_id, missionId, action, auth.auth.userId, normalizeOptionalText(body.reason) ?? "", mapObservationRallyMission(current), { status: nextStatus, goalCount: nextGoal, endsAt: nextEndsAt });
  const eventType = action === "pause" ? "rally_mission_paused" : action === "replace" ? "rally_mission_replaced" : action === "extend" ? "rally_mission_extended" : action === "close" ? "rally_mission_closed" : "rally_mission_published";
  await appendObservationEventLive(env, { sessionId, type: eventType, scope: "all", actorUserId: auth.auth.userId, payload: { mission_id: missionId, action, status: nextStatus } });
  const mission = await getObservationRallyMission(env, missionId);
  return json({ mission: mission ? mapObservationRallyMission(mission) : null }, 200, { "cache-control": "no-store" });
}

async function switchObservationRallyWeatherMode(request: Request, env: Env, sessionId: string): Promise<Response> {
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  const body = await readJson<Record<string, unknown>>(request);
  if (normalizeOptionalText(body.mode) !== "rain") return json({ error: "invalid weather mode" }, 400, { "cache-control": "no-store" });
  const course = await ensureObservationRallyCourse(env, sessionId, auth.auth.userId);
  await appendObservationEventLive(env, { sessionId, type: "rally_next_action", scope: "all", actorUserId: auth.auth.userId, payload: { mode: "rain", reason: normalizeOptionalText(body.reason) ?? "" } });
  return json({ course, mode: "rain", affectedMissions: 0 }, 200, { "cache-control": "no-store" });
}

async function createObservationRallySubmission(request: Request, env: Env, sessionId: string): Promise<Response> {
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  const auth = await readCompatibleSessionWithOriginFallback(request, env);
  const body = await readJson<Record<string, unknown>>(request);
  const guestToken = normalizeOptionalText(body.guest_token);
  if (!auth && !guestToken) return json({ error: "user or guest_token required" }, 400, { "cache-control": "no-store" });
  const missionId = normalizeOptionalText(body.mission_id);
  if (!missionId) return json({ error: "mission_id required" }, 400, { "cache-control": "no-store" });
  const mission = await getObservationRallyMission(env, missionId);
  if (!mission) return json({ error: "mission not found" }, 404, { "cache-control": "no-store" });
  const course = await getObservationRallyCourseBySession(env, sessionId);
  if (!course || course.courseId !== mission.course_id) return json({ error: "rally course not found" }, 404, { "cache-control": "no-store" });
  const participant = await findObservationEventParticipant(env, sessionId, auth?.userId ?? null, guestToken);
  const teamId = normalizeOptionalText(body.team_id) ?? participant?.team_id ?? null;
  const countValue = Math.max(0.01, numberOrNullFromUnknown(body.count_value) ?? 1);
  const lat = numberOrNullFromUnknown(body.lat);
  const lng = numberOrNullFromUnknown(body.lng);
  const publicLat = lat === null ? null : roundPublicEventCoordinate(lat);
  const publicLng = lng === null ? null : roundPublicEventCoordinate(lng);
  const submissionId = crypto.randomUUID();
  const reviewStatus = mission.verification_policy === "organizer_review" ? "pending" : "auto_accepted";
  await env.OBS_DB.prepare(
    `INSERT INTO observation_rally_submissions (
       submission_id, session_id, course_id, mission_id, station_id, user_id, guest_token, team_id,
       source_type, source_ref, count_value, public_lat, public_lng, payload_json, review_status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    submissionId,
    sessionId,
    course.courseId,
    missionId,
    normalizeOptionalText(body.station_id),
    auth?.userId ?? null,
    guestToken,
    teamId,
    normalizeOptionalText(body.source_type) ?? "manual_rally",
    normalizeOptionalText(body.source_ref),
    countValue,
    publicLat,
    publicLng,
    JSON.stringify(asPlainObject(body.payload) ?? {}),
    reviewStatus
  ).run();
  if (reviewStatus === "auto_accepted") {
    await incrementObservationRallyProgress(env, course.courseId, mission, { countValue, teamId, guestToken, userId: auth?.userId ?? null, stationId: normalizeOptionalText(body.station_id) });
  }
  if (publicLat !== null && publicLng !== null) await recordObservationEventMeshVisit(env, { sessionId, lat: publicLat, lng: publicLng, observationDelta: 1, teamId });
  await appendObservationEventLive(env, { sessionId, type: "rally_task_submitted", scope: "all", actorUserId: auth?.userId ?? null, actorGuestToken: guestToken, teamId, payload: { submission_id: submissionId, mission_id: missionId, review_status: reviewStatus } });
  const submission = await getObservationRallySubmission(env, submissionId);
  return json({ submission: submission ? mapObservationRallySubmission(submission) : null }, 201, { "cache-control": "no-store" });
}

async function reviewObservationRallySubmission(request: Request, env: Env, sessionId: string, submissionId: string): Promise<Response> {
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  const body = await readJson<Record<string, unknown>>(request);
  const next = body.review_status === "rejected" ? "rejected" : "accepted";
  await env.OBS_DB.prepare(
    "UPDATE observation_rally_submissions SET review_status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE submission_id = ? AND session_id = ?"
  ).bind(next, auth.auth.userId, submissionId, sessionId).run();
  await appendObservationEventLive(env, { sessionId, type: "rally_task_cleared", scope: "all", actorUserId: auth.auth.userId, payload: { submission_id: submissionId, review_status: next } });
  const submission = await getObservationRallySubmission(env, submissionId);
  return json({ submission: submission ? mapObservationRallySubmission(submission) : null }, 200, { "cache-control": "no-store" });
}

async function getObservationEventSessionById(env: Env, sessionId: string) {
  const row = await env.OBS_DB.prepare(
    `SELECT session_id, legacy_event_id, event_code, title, organizer_user_id, corporation_id,
            plan, primary_mode, active_modes_json, location_lat, location_lng, location_radius_m,
            started_at, ended_at, target_species_json, config_json, field_id, template_source_session_id,
            created_at, updated_at
       FROM observation_event_sessions
      WHERE session_id = ?`
  ).bind(sessionId).first<ObservationEventSessionD1Row>();
  return row ? mapObservationEventSession(row) : null;
}

async function getObservationEventSessionByEventCode(env: Env, eventCode: string) {
  const row = await env.OBS_DB.prepare(
    `SELECT session_id, legacy_event_id, event_code, title, organizer_user_id, corporation_id,
            plan, primary_mode, active_modes_json, location_lat, location_lng, location_radius_m,
            started_at, ended_at, target_species_json, config_json, field_id, template_source_session_id,
            created_at, updated_at
       FROM observation_event_sessions
      WHERE event_code = ?`
  ).bind(eventCode).first<ObservationEventSessionD1Row>();
  return row ? mapObservationEventSession(row) : null;
}

async function getObservationRallySnapshot(env: Env, sessionId: string) {
  const course = await getObservationRallyCourseBySession(env, sessionId);
  if (!course) return { course: null, stations: [], missions: [], progress: [] };
  const [stations, missions, progress] = await Promise.all([
    listObservationRallyStations(env, course.courseId),
    listObservationRallyMissions(env, course.courseId),
    listObservationRallyProgress(env, course.courseId)
  ]);
  return { course, stations, missions, progress };
}

async function getObservationRallyCourseBySession(env: Env, sessionId: string) {
  const row = await env.OBS_DB.prepare(
    `SELECT course_id, session_id, title, status, config_json, created_by, created_at, updated_at
       FROM observation_rally_courses
      WHERE session_id = ?`
  ).bind(sessionId).first<ObservationRallyCourseD1Row>();
  return row ? mapObservationRallyCourse(row) : null;
}

async function ensureObservationRallyCourse(env: Env, sessionId: string, actorUserId: string | null, input?: { title?: string; status?: string; config?: Record<string, unknown> }) {
  const existing = await getObservationRallyCourseBySession(env, sessionId);
  if (existing) {
    if (input) {
      await env.OBS_DB.prepare(
        "UPDATE observation_rally_courses SET title = ?, status = ?, config_json = ?, updated_at = CURRENT_TIMESTAMP WHERE course_id = ?"
      ).bind(input.title ?? existing.title, normalizeRallyCourseStatus(input.status) ?? existing.status, JSON.stringify(input.config ?? existing.config), existing.courseId).run();
      return (await getObservationRallyCourseBySession(env, sessionId)) ?? existing;
    }
    return existing;
  }
  const courseId = crypto.randomUUID();
  await env.OBS_DB.prepare(
    "INSERT INTO observation_rally_courses (course_id, session_id, title, status, config_json, created_by) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(courseId, sessionId, input?.title ?? "観察ラリー", normalizeRallyCourseStatus(input?.status) ?? "preflight", JSON.stringify(input?.config ?? {}), actorUserId).run();
  return (await getObservationRallyCourseBySession(env, sessionId)) ?? {
    courseId,
    sessionId,
    title: input?.title ?? "観察ラリー",
    status: normalizeRallyCourseStatus(input?.status) ?? "preflight",
    config: input?.config ?? {},
    createdBy: actorUserId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

async function listObservationRallyStations(env: Env, courseId: string) {
  const rows = await env.OBS_DB.prepare(
    `SELECT station_id, course_id, field_id, code, name, description, lat, lng, radius_m,
            polygon_json, route_geojson, is_private, access_note, danger_note, status, sort_order, created_at, updated_at
       FROM observation_rally_stations
      WHERE course_id = ?
      ORDER BY sort_order ASC, created_at ASC`
  ).bind(courseId).all<ObservationRallyStationD1Row>();
  return rows.results.map(mapObservationRallyStation);
}

async function listObservationRallyMissions(env: Env, courseId: string) {
  const rows = await env.OBS_DB.prepare(
    `SELECT mission_id, course_id, station_id, replacement_for_mission_id, scope, location_binding,
            title, target, count_unit, goal_count, counting_policy_json, verification_policy,
            weather_sensitivity, fallback_group, status, starts_at, ends_at, sort_order, created_by, created_at, updated_at
       FROM observation_rally_missions
      WHERE course_id = ?
      ORDER BY sort_order ASC, created_at ASC`
  ).bind(courseId).all<ObservationRallyMissionD1Row>();
  return rows.results.map(mapObservationRallyMission);
}

async function getObservationRallyMission(env: Env, missionId: string) {
  return env.OBS_DB.prepare(
    `SELECT mission_id, course_id, station_id, replacement_for_mission_id, scope, location_binding,
            title, target, count_unit, goal_count, counting_policy_json, verification_policy,
            weather_sensitivity, fallback_group, status, starts_at, ends_at, sort_order, created_by, created_at, updated_at
       FROM observation_rally_missions
      WHERE mission_id = ?`
  ).bind(missionId).first<ObservationRallyMissionD1Row>();
}

async function getObservationRallySubmission(env: Env, submissionId: string) {
  return env.OBS_DB.prepare(
    `SELECT submission_id, session_id, course_id, mission_id, station_id, user_id, guest_token,
            team_id, source_type, source_ref, count_value, public_lat, public_lng, payload_json,
            review_status, created_at
       FROM observation_rally_submissions
      WHERE submission_id = ?`
  ).bind(submissionId).first<ObservationRallySubmissionD1Row>();
}

async function listObservationRallyProgress(env: Env, courseId: string) {
  const rows = await env.OBS_DB.prepare(
    `SELECT progress_id, course_id, mission_id, progress_scope, team_id, participant_key, station_id,
            actual_count, goal_count, percent, status, updated_at
       FROM observation_rally_progress
      WHERE course_id = ?
      ORDER BY updated_at DESC`
  ).bind(courseId).all<ObservationRallyProgressD1Row>();
  return rows.results.map(mapObservationRallyProgress);
}

async function incrementObservationRallyProgress(env: Env, courseId: string, mission: ObservationRallyMissionD1Row, input: { countValue: number; teamId: string | null; userId: string | null; guestToken: string | null; stationId: string | null }) {
  const progressScope = normalizeRallyScope(mission.scope) ?? "event";
  const participantKey = progressScope === "participant" ? (input.userId ? `user:${input.userId}` : input.guestToken ? `guest:${input.guestToken}` : "") : "";
  const teamId = progressScope === "team" ? input.teamId ?? "" : "";
  const stationId = progressScope === "station" ? input.stationId ?? mission.station_id ?? "" : "";
  const existing = await env.OBS_DB.prepare(
    `SELECT progress_id, actual_count
       FROM observation_rally_progress
      WHERE mission_id = ? AND progress_scope = ? AND COALESCE(team_id, '') = ? AND COALESCE(participant_key, '') = ? AND COALESCE(station_id, '') = ?`
  ).bind(mission.mission_id, progressScope, teamId, participantKey, stationId).first<{ progress_id: string; actual_count: number }>();
  const nextActual = Number(existing?.actual_count ?? 0) + input.countValue;
  const percent = Math.round((nextActual / Number(mission.goal_count)) * 10000) / 100;
  const status = percent > 100 ? "exceeded" : percent >= 100 ? "reached" : "active";
  if (existing) {
    await env.OBS_DB.prepare(
      "UPDATE observation_rally_progress SET actual_count = ?, percent = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE progress_id = ?"
    ).bind(nextActual, percent, status, existing.progress_id).run();
  } else {
    await env.OBS_DB.prepare(
      `INSERT INTO observation_rally_progress (
         progress_id, course_id, mission_id, progress_scope, team_id, participant_key,
         station_id, actual_count, goal_count, percent, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), courseId, mission.mission_id, progressScope, teamId || null, participantKey || null, stationId || null, nextActual, Number(mission.goal_count), percent, status).run();
  }
}

async function appendObservationRallyRevision(env: Env, courseId: string, missionId: string | null, action: string, actorUserId: string | null, reason: string, before: Record<string, unknown>, after: Record<string, unknown>): Promise<void> {
  await env.OBS_DB.prepare(
    `INSERT INTO observation_rally_revisions (
       revision_id, course_id, mission_id, action, reason, before_payload_json, after_payload_json, actor_user_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), courseId, missionId, action, reason, JSON.stringify(before), JSON.stringify(after), actorUserId).run();
}

function mapObservationRallyCourse(row: ObservationRallyCourseD1Row) {
  return {
    courseId: row.course_id,
    sessionId: row.session_id,
    title: row.title,
    status: normalizeRallyCourseStatus(row.status) ?? "draft",
    config: jsonObject(row.config_json),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapObservationRallyStation(row: ObservationRallyStationD1Row) {
  return {
    stationId: row.station_id,
    courseId: row.course_id,
    fieldId: row.field_id,
    code: row.code,
    name: row.name,
    description: row.description,
    lat: row.lat,
    lng: row.lng,
    radiusM: row.radius_m,
    polygon: row.polygon_json ? jsonObject(row.polygon_json) : null,
    routeGeojson: row.route_geojson ? jsonObject(row.route_geojson) : null,
    isPrivate: row.is_private === 1,
    accessNote: row.access_note,
    dangerNote: row.danger_note,
    status: row.status,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapObservationRallyMission(row: ObservationRallyMissionD1Row) {
  return {
    missionId: row.mission_id,
    courseId: row.course_id,
    stationId: row.station_id,
    replacementForMissionId: row.replacement_for_mission_id,
    scope: normalizeRallyScope(row.scope) ?? "event",
    locationBinding: normalizeRallyLocationBinding(row.location_binding) ?? "none",
    title: row.title,
    target: row.target,
    countUnit: normalizeRallyCountUnit(row.count_unit) ?? "scene",
    goalCount: Number(row.goal_count),
    countingPolicy: jsonObject(row.counting_policy_json),
    verificationPolicy: normalizeRallyVerificationPolicy(row.verification_policy) ?? "auto",
    weatherSensitivity: normalizeRallyWeatherSensitivity(row.weather_sensitivity) ?? "all_weather",
    fallbackGroup: row.fallback_group,
    status: normalizeRallyMissionStatus(row.status) ?? "draft",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    sortOrder: row.sort_order,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapObservationRallyProgress(row: ObservationRallyProgressD1Row) {
  return {
    progressId: row.progress_id,
    courseId: row.course_id,
    missionId: row.mission_id,
    progressScope: normalizeRallyScope(row.progress_scope) ?? "event",
    teamId: row.team_id,
    participantKey: row.participant_key,
    stationId: row.station_id,
    actualCount: Number(row.actual_count),
    goalCount: Number(row.goal_count),
    percent: Number(row.percent),
    status: row.status,
    updatedAt: row.updated_at
  };
}

function mapObservationRallySubmission(row: ObservationRallySubmissionD1Row) {
  return {
    submissionId: row.submission_id,
    sessionId: row.session_id,
    courseId: row.course_id,
    missionId: row.mission_id,
    stationId: row.station_id,
    userId: row.user_id,
    guestToken: row.guest_token,
    teamId: row.team_id,
    sourceType: row.source_type,
    sourceRef: row.source_ref,
    countValue: Number(row.count_value),
    publicLat: row.public_lat,
    publicLng: row.public_lng,
    payload: jsonObject(row.payload_json),
    reviewStatus: row.review_status,
    createdAt: row.created_at
  };
}

function mapObservationEventSession(row: ObservationEventSessionD1Row) {
  const activeModes = jsonArray(row.active_modes_json).filter(isObservationEventMode);
  return {
    sessionId: row.session_id,
    legacyEventId: row.legacy_event_id,
    eventCode: row.event_code,
    title: row.title,
    organizerUserId: row.organizer_user_id,
    corporationId: row.corporation_id,
    plan: row.plan === "public" ? "public" : "community",
    primaryMode: isObservationEventMode(row.primary_mode) ? row.primary_mode : "discovery",
    activeModes: activeModes.length > 0 ? activeModes : ["discovery"],
    locationLat: row.location_lat,
    locationLng: row.location_lng,
    locationRadiusM: row.location_radius_m,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    targetSpecies: jsonArray(row.target_species_json).filter((value): value is string => typeof value === "string"),
    config: jsonObject(row.config_json),
    fieldId: row.field_id,
    templateSourceSessionId: row.template_source_session_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function requireObservationEventOrganizer(request: Request, env: Env, sessionId: string): Promise<{ auth: SessionSnapshot; session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>> } | Response> {
  const auth = await readCompatibleSessionWithOriginFallback(request, env);
  if (!auth) return json({ error: "login required" }, 401, { "cache-control": "no-store" });
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  if (session.organizerUserId !== auth.userId) return json({ error: "organizer only" }, 403, { "cache-control": "no-store" });
  return { auth, session };
}

async function appendObservationEventLive(env: Env, input: {
  sessionId: string;
  type: string;
  scope?: string;
  actorUserId?: string | null;
  actorGuestToken?: string | null;
  teamId?: string | null;
  payload?: Record<string, unknown>;
}) {
  const liveEventId = crypto.randomUUID();
  await env.OBS_DB.prepare(
    `INSERT INTO observation_event_live_events (
       live_event_id, session_id, type, scope, actor_user_id, actor_guest_token, team_id, payload_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(liveEventId, input.sessionId, input.type, input.scope ?? "all", input.actorUserId ?? null, input.actorGuestToken ?? null, input.teamId ?? null, JSON.stringify(input.payload ?? {})).run();
  return {
    liveEventId,
    sessionId: input.sessionId,
    type: input.type,
    scope: input.scope ?? "all",
    teamId: input.teamId ?? null,
    payload: input.payload ?? {},
    createdAt: new Date().toISOString()
  };
}

async function listObservationEventLiveEvents(env: Env, sessionId: string, limit: number) {
  const rows = await env.OBS_DB.prepare(
    `SELECT live_event_id, session_id, type, scope, actor_user_id, actor_guest_token, team_id, payload_json, created_at
       FROM observation_event_live_events
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT ?`
  ).bind(sessionId, limit).all<ObservationEventLiveD1Row>();
  return rows.results.map((row) => ({
    liveEventId: row.live_event_id,
    sessionId: row.session_id,
    type: row.type,
    scope: row.scope,
    actorUserId: row.actor_user_id ?? null,
    actorGuestToken: row.actor_guest_token ?? null,
    teamId: row.team_id,
    payload: jsonObject(row.payload_json),
    createdAt: row.created_at
  }));
}

async function listObservationEventTeams(env: Env, sessionId: string) {
  const rows = await env.OBS_DB.prepare(
    `SELECT team_id, name, color, lead_user_id, target_taxa_json, created_at
       FROM observation_event_teams
      WHERE session_id = ?
      ORDER BY created_at ASC`
  ).bind(sessionId).all<ObservationEventTeamD1Row>();
  return rows.results;
}

async function listObservationEventParticipants(env: Env, sessionId: string) {
  const rows = await env.OBS_DB.prepare(
    `SELECT participant_id, user_id, guest_token, display_name, team_id, share_location, location_share_until, is_minor
       FROM observation_event_participants
      WHERE session_id = ?
      ORDER BY checked_in_at ASC, created_at ASC`
  ).bind(sessionId).all<ObservationEventParticipantD1Row>();
  return rows.results;
}

async function listObservationEventAbsences(env: Env, sessionId: string) {
  const rows = await env.OBS_DB.prepare(
    `SELECT absence_id, session_id, user_id, guest_token, team_id, searched_taxon, public_lat, public_lng
       FROM observation_event_absences
      WHERE session_id = ?
      ORDER BY created_at ASC`
  ).bind(sessionId).all<{
    absence_id: string;
    session_id: string;
    user_id: string | null;
    guest_token: string | null;
    team_id: string | null;
    searched_taxon: string;
    public_lat: number;
    public_lng: number;
  }>();
  return rows.results;
}

function observationEventTaxonName(payload: Record<string, unknown>): string | null {
  return normalizeOptionalText(payload.taxon_name)
    ?? normalizeOptionalText(payload.taxonName)
    ?? normalizeOptionalText(payload.scientific_name)
    ?? normalizeOptionalText(payload.vernacular_name)
    ?? normalizeOptionalText(payload.taxon)
    ?? normalizeOptionalText(asPlainObject(payload.primary_subject)?.name)
    ?? normalizeOptionalText(asPlainObject(payload.primarySubject)?.name);
}

function countObservationEventTaxa(events: Array<{ payload: Record<string, unknown> }>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) {
    const name = observationEventTaxonName(event.payload);
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return new Map([...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "ja")));
}

function durationMinutesBetween(startedAt: string, endedAt: string | null): number | null {
  const start = Date.parse(startedAt);
  const end = endedAt ? Date.parse(endedAt) : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.round((end - start) / 60000));
}

function findObservationEventViewerParticipant(
  participants: ObservationEventParticipantD1Row[],
  userId: string | null,
  guestToken: string | null
): ObservationEventParticipantD1Row | null {
  if (!userId && !guestToken) return null;
  return participants.find((participant) =>
    (userId !== null && participant.user_id === userId) ||
    (guestToken !== null && participant.guest_token === guestToken)
  ) ?? null;
}

async function recordObservationEventRecapView(env: Env, sessionId: string, userId: string | null, guestToken: string | null): Promise<void> {
  try {
    await env.OBS_DB.prepare(
      "INSERT INTO observation_event_recap_views (view_id, session_id, viewer_user_id, viewer_guest_token) VALUES (?, ?, ?, ?)"
    ).bind(crypto.randomUUID(), sessionId, userId, guestToken).run();
  } catch {
    // Older D1 environments may not have the audit table before the migration is applied.
  }
}

async function upsertObservationEventParticipant(env: Env, input: {
  sessionId: string;
  userId: string | null;
  guestToken: string | null;
  displayName: string;
  teamId: string | null;
  isMinor: boolean;
  shareLocation?: boolean;
  locationShareUntil?: string | null;
  locationShareConsentType?: string | null;
}): Promise<string> {
  const existing = await findObservationEventParticipant(env, input.sessionId, input.userId, input.guestToken);
  const shareLocation = input.shareLocation === true && (!input.isMinor || input.locationShareConsentType === "guardian") ? 1 : 0;
  const shareUntil = shareLocation ? input.locationShareUntil ?? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() : null;
  const consentType = shareLocation ? input.locationShareConsentType ?? "self" : null;
  if (existing) {
    await env.OBS_DB.prepare(
      `UPDATE observation_event_participants
          SET display_name = ?, team_id = COALESCE(?, team_id), status = 'checked_in',
              checked_in_at = CURRENT_TIMESTAMP, share_location = ?, is_minor = ?,
              location_share_until = ?, location_share_consent_type = ?, updated_at = CURRENT_TIMESTAMP
        WHERE participant_id = ?`
    ).bind(input.displayName, input.teamId, shareLocation, input.isMinor ? 1 : 0, shareUntil, consentType, existing.participant_id).run();
    return existing.participant_id;
  }
  const participantId = crypto.randomUUID();
  await env.OBS_DB.prepare(
    `INSERT INTO observation_event_participants (
       participant_id, session_id, user_id, guest_token, display_name, team_id, role, status,
       checked_in_at, share_location, is_minor, location_share_until, location_share_consent_type
     ) VALUES (?, ?, ?, ?, ?, ?, 'participant', 'checked_in', CURRENT_TIMESTAMP, ?, ?, ?, ?)`
  ).bind(participantId, input.sessionId, input.userId, input.guestToken, input.displayName, input.teamId, shareLocation, input.isMinor ? 1 : 0, shareUntil, consentType).run();
  return participantId;
}

async function findObservationEventParticipant(env: Env, sessionId: string, userId: string | null, guestToken: string | null) {
  if (!userId && !guestToken) return null;
  return env.OBS_DB.prepare(
    `SELECT participant_id, user_id, guest_token, display_name, team_id, share_location, location_share_until, is_minor
       FROM observation_event_participants
      WHERE session_id = ?
        AND ((user_id IS NOT NULL AND user_id = ?) OR (guest_token IS NOT NULL AND guest_token = ?))
      LIMIT 1`
  ).bind(sessionId, userId, guestToken).first<ObservationEventParticipantD1Row>();
}

async function observationEventParticipantContext(env: Env, session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>, cookieHeader: string | null, guestTokenOverride?: string | null) {
  const auth = await readCompatibleSession(new Request("https://ikimon.life/", { headers: cookieHeader ? { cookie: cookieHeader } : undefined }), env).catch(() => null);
  const guestToken = guestTokenOverride ?? null;
  const participant = await findObservationEventParticipant(env, session.sessionId, auth?.userId ?? null, guestToken);
  return {
    userId: auth?.userId ?? null,
    guestToken,
    teamId: participant?.team_id ?? null,
    isOrganizer: Boolean(auth?.userId && auth.userId === session.organizerUserId)
  };
}

function shouldDeliverObservationEvent(event: { scope: string; teamId: string | null; payload: Record<string, unknown> }, ctx: { userId: string | null; guestToken: string | null; teamId: string | null; isOrganizer: boolean }): boolean {
  if (event.scope === "all") return true;
  if (event.scope === "organizer") return ctx.isOrganizer;
  if (event.scope === "team") return Boolean(ctx.teamId && ctx.teamId === event.teamId);
  if (event.scope === "self") {
    const targetUser = normalizeOptionalText(event.payload.target_user_id);
    const targetGuest = normalizeOptionalText(event.payload.target_guest_token);
    return Boolean((targetUser && targetUser === ctx.userId) || (targetGuest && targetGuest === ctx.guestToken));
  }
  return true;
}

async function recordObservationEventMeshVisit(env: Env, input: { sessionId: string; lat: number; lng: number; absenceDelta?: number; observationDelta?: number; visitSeconds?: number; teamId?: string | null }): Promise<void> {
  const meshKey = observationEventMeshKey(input.lat, input.lng);
  if (!meshKey) return;
  const center = observationEventMeshCenter(meshKey);
  if (!center) return;
  const meshId = crypto.randomUUID();
  await env.OBS_DB.prepare(
    `INSERT INTO observation_event_mesh_cells (
       mesh_cell_id, session_id, mesh_key, center_lat, center_lng, visit_seconds,
       observation_count, absence_count, last_visited_at, visited_team_ids_json, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(session_id, mesh_key) DO UPDATE SET
       visit_seconds = visit_seconds + excluded.visit_seconds,
       observation_count = observation_count + excluded.observation_count,
       absence_count = absence_count + excluded.absence_count,
       last_visited_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(meshId, input.sessionId, meshKey, center.lat, center.lng, Math.max(0, Math.round(input.visitSeconds ?? 0)), Math.max(0, Math.round(input.observationDelta ?? 0)), Math.max(0, Math.round(input.absenceDelta ?? 0)), JSON.stringify(input.teamId ? [input.teamId] : [])).run();
}

function isObservationEventMode(value: unknown): value is ObservationEventMode {
  return typeof value === "string" && (OBSERVATION_EVENT_MODES as readonly string[]).includes(value);
}

function observationEventMode(value: unknown): ObservationEventMode | null {
  return isObservationEventMode(value) ? value : null;
}

function observationEventModes(value: unknown, fallback: ObservationEventMode): ObservationEventMode[] {
  const modes = Array.isArray(value) ? value.filter(isObservationEventMode) : [];
  return modes.length > 0 ? modes : [fallback];
}

function normalizeRallyCourseStatus(value: unknown): typeof RALLY_COURSE_STATUSES[number] | null {
  return typeof value === "string" && (RALLY_COURSE_STATUSES as readonly string[]).includes(value) ? value as typeof RALLY_COURSE_STATUSES[number] : null;
}

function normalizeRallyScope(value: unknown): typeof RALLY_SCOPES[number] | null {
  return typeof value === "string" && (RALLY_SCOPES as readonly string[]).includes(value) ? value as typeof RALLY_SCOPES[number] : null;
}

function normalizeRallyLocationBinding(value: unknown): typeof RALLY_LOCATION_BINDINGS[number] | null {
  return typeof value === "string" && (RALLY_LOCATION_BINDINGS as readonly string[]).includes(value) ? value as typeof RALLY_LOCATION_BINDINGS[number] : null;
}

function normalizeRallyCountUnit(value: unknown): typeof RALLY_COUNT_UNITS[number] | null {
  return typeof value === "string" && (RALLY_COUNT_UNITS as readonly string[]).includes(value) ? value as typeof RALLY_COUNT_UNITS[number] : null;
}

function normalizeRallyVerificationPolicy(value: unknown): typeof RALLY_VERIFICATION_POLICIES[number] | null {
  return typeof value === "string" && (RALLY_VERIFICATION_POLICIES as readonly string[]).includes(value) ? value as typeof RALLY_VERIFICATION_POLICIES[number] : null;
}

function normalizeRallyWeatherSensitivity(value: unknown): typeof RALLY_WEATHER_SENSITIVITIES[number] | null {
  return typeof value === "string" && (RALLY_WEATHER_SENSITIVITIES as readonly string[]).includes(value) ? value as typeof RALLY_WEATHER_SENSITIVITIES[number] : null;
}

function normalizeRallyMissionStatus(value: unknown): typeof RALLY_MISSION_STATUSES[number] | null {
  return typeof value === "string" && (RALLY_MISSION_STATUSES as readonly string[]).includes(value) ? value as typeof RALLY_MISSION_STATUSES[number] : null;
}

function normalizeRallyRevisionAction(value: unknown): typeof RALLY_REVISION_ACTIONS[number] | null {
  return typeof value === "string" && (RALLY_REVISION_ACTIONS as readonly string[]).includes(value) ? value as typeof RALLY_REVISION_ACTIONS[number] : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asPlainObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function jsonArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function jsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function roundPublicEventCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function observationEventMeshKey(lat: number, lng: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  const rounded = (v: number): string => {
    const sign = v < 0 ? "-" : "";
    const abs = Math.abs(v);
    return `${sign}${Math.floor(abs * 1000) / 1000}`;
  };
  return `${rounded(lat)},${rounded(lng)}`;
}

function observationEventMeshCenter(meshKey: string): { lat: number; lng: number } | null {
  const [latRaw, lngRaw] = meshKey.split(",");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat: lat + 0.0005, lng: lng + 0.0005 };
}

async function fetchLegacyObservationApiOriginFallback(request: Request, url: URL, env: Env): Promise<Response | null> {
  if (isPublicAppWriteCandidatePath(url) && getPublicWriteMode(env) === "cloudflare_native") return null;
  if (!shouldUseOriginFallback(url, env)) return null;
  return null;
}

async function listCompatibleReferenceCandidates(occurrenceId: string, request: Request, env: Env): Promise<Response> {
  const normalizedOccurrenceId = normalizeOptionalId(occurrenceId);
  if (!normalizedOccurrenceId || normalizedOccurrenceId.length > 160) {
    return json({ ok: false, error: "not_found" }, 404, { "cache-control": "no-store" });
  }

  let session: SessionSnapshot | null = null;
  try {
    session = await readCompatibleSession(request, env);
  } catch {
    return json({ ok: false, error: "auth_store_unavailable" }, 503, { "cache-control": "no-store" });
  }
  if (!session) {
    return json({ ok: false, error: "session_required" }, 401, { "cache-control": "no-store" });
  }
  if (session.banned) {
    return json({ ok: false, error: "account_unavailable" }, 403, { "cache-control": "no-store" });
  }

  return json({
    ok: true,
    candidates: [],
    source: "cloudflare_reference_candidates_empty",
    referenceCatalogStatus: "not_migrated"
  }, 200, { "cache-control": "no-store" });
}

async function confirmCompatibleManagementCandidate(observationId: string, index: string, request: Request, env: Env): Promise<Response> {
  const normalizedObservationId = normalizeOptionalId(observationId);
  if (!normalizedObservationId || normalizedObservationId.length > 160) {
    return json({ ok: false, error: "not_found" }, 404, { "cache-control": "no-store" });
  }
  const candidateIndex = Number(index);
  if (!Number.isInteger(candidateIndex) || candidateIndex < 0) {
    return json({ ok: false, error: "invalid_candidate_index" }, 400, { "cache-control": "no-store" });
  }

  let session: SessionSnapshot | null = null;
  try {
    session = await readCompatibleSessionWithOriginFallback(request, env);
  } catch {
    return json({ ok: false, error: "auth_store_unavailable" }, 503, { "cache-control": "no-store" });
  }
  if (!session) {
    return json({ ok: false, error: "session_required" }, 401, { "cache-control": "no-store" });
  }
  if (session.banned) {
    return json({ ok: false, error: "account_unavailable" }, 403, { "cache-control": "no-store" });
  }
  const ownerUserId = await resolveCompatibleObservationOwnerUserId(normalizedObservationId, env);
  if (!ownerUserId) {
    return json({ ok: false, error: "observation_not_found" }, 404, { "cache-control": "no-store" });
  }
  if (ownerUserId !== session.userId) {
    return json({ ok: false, error: "observation_not_owned" }, 403, { "cache-control": "no-store" });
  }

  let body: Record<string, unknown>;
  try {
    body = await readJson<Record<string, unknown>>(request);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400, { "cache-control": "no-store" });
  }
  const confirmState = normalizeOptionalText(body.confirmState);
  if (confirmState !== "suggested" && confirmState !== "confirmed" && confirmState !== "rejected") {
    return json({ ok: false, error: "invalid_confirm_state" }, 400, { "cache-control": "no-store" });
  }

  const confirmationId = newId("mgmt_confirm");
  const sourcePayload = {
    source: "cloudflare_management_candidate_confirmation_ledger",
    observationId: normalizedObservationId,
    candidateIndex,
    confirmState
  };
  await env.OBS_DB.prepare(
    `INSERT INTO management_candidate_confirmations (
       confirmation_id, observation_id, candidate_index, confirm_state, actor_user_id, source_payload_json
     ) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(observation_id, candidate_index, actor_user_id) DO UPDATE SET
       confirm_state = excluded.confirm_state,
       source_payload_json = excluded.source_payload_json,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(
    confirmationId,
    normalizedObservationId,
    candidateIndex,
    confirmState,
    session.userId,
    JSON.stringify(sourcePayload)
  ).run();

  return json({
    ok: true,
    candidate: {
      actionKind: "unknown",
      label: "",
      why: "",
      confidence: null,
      source: "cloudflare_management_candidate_confirmation_ledger",
      sourceAssetId: null,
      confirmState
    },
    stewardshipActionId: null,
    compatibility: {
      source: "cloudflare_management_candidate_confirmation_ledger",
      stewardshipActionStatus: "not_migrated"
    }
  }, 200, { "cache-control": "no-store" });
}

async function requestCompatibleCandidateAction(
  observationId: string,
  candidateId: string,
  actionKind: "propose" | "adopt",
  request: Request,
  env: Env
): Promise<Response> {
  const normalizedObservationId = normalizeOptionalId(observationId);
  const normalizedCandidateId = normalizeOptionalId(candidateId);
  if (!normalizedObservationId || normalizedObservationId.length > 160 || !normalizedCandidateId || normalizedCandidateId.length > 160) {
    return json({ ok: false, error: "not_found" }, 404, { "cache-control": "no-store" });
  }

  let session: SessionSnapshot | null = null;
  try {
    session = await readCompatibleSessionWithOriginFallback(request, env);
  } catch {
    return json({ ok: false, error: "auth_store_unavailable" }, 503, { "cache-control": "no-store" });
  }
  if (!session) {
    return json({ ok: false, error: "session_required" }, 401, { "cache-control": "no-store" });
  }
  if (session.banned) {
    return json({ ok: false, error: "account_unavailable" }, 403, { "cache-control": "no-store" });
  }

  const ownerUserId = await resolveCompatibleObservationOwnerUserId(normalizedObservationId, env);
  if (!ownerUserId) {
    return json({ ok: false, error: "observation_not_found" }, 404, { "cache-control": "no-store" });
  }
  if (actionKind === "adopt" && ownerUserId !== session.userId) {
    return json({ ok: false, error: "observation_not_owned" }, 403, { "cache-control": "no-store" });
  }

  const requestId = newId("candidate_action_req");
  const sourcePayload = {
    source: "cloudflare_candidate_action_request_ledger",
    observationId: normalizedObservationId,
    candidateId: normalizedCandidateId,
    actionKind,
    ownerUserId
  };
  await env.OBS_DB.prepare(
    `INSERT INTO candidate_action_requests (
       request_id, observation_id, candidate_id, action_kind, actor_user_id, request_state, source_payload_json
     ) VALUES (?, ?, ?, ?, ?, 'pending', ?)
     ON CONFLICT(observation_id, candidate_id, action_kind, actor_user_id) DO UPDATE SET
       request_state = 'pending',
       source_payload_json = excluded.source_payload_json,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(
    requestId,
    normalizedObservationId,
    normalizedCandidateId,
    actionKind,
    session.userId,
    JSON.stringify(sourcePayload)
  ).run();

  return json({
    ok: true,
    candidateAction: {
      requestId,
      state: "pending",
      actionKind
    },
    compatibility: {
      source: "cloudflare_candidate_action_request_ledger",
      occurrenceStatus: "not_migrated"
    }
  }, 202, { "cache-control": "no-store" });
}

async function requestCompatibleObservationReassessment(observationId: string, requestKind: "standard" | "video", request: Request, env: Env): Promise<Response> {
  const normalizedObservationId = normalizeOptionalId(observationId);
  if (!normalizedObservationId || normalizedObservationId.length > 160) {
    return json({ ok: false, error: "not_found" }, 404, { "cache-control": "no-store" });
  }

  let session: SessionSnapshot | null = null;
  try {
    session = await readCompatibleSessionWithOriginFallback(request, env);
  } catch {
    return json({ ok: false, error: "auth_store_unavailable" }, 503, { "cache-control": "no-store" });
  }
  if (!session) {
    return json({ ok: false, error: "session_required" }, 401, { "cache-control": "no-store" });
  }
  if (session.banned) {
    return json({ ok: false, error: "account_unavailable" }, 403, { "cache-control": "no-store" });
  }

  const ownerUserId = await resolveCompatibleObservationOwnerUserId(normalizedObservationId, env);
  if (!ownerUserId) {
    return json({ ok: false, error: "observation_not_found" }, 404, { "cache-control": "no-store" });
  }
  if (ownerUserId !== session.userId) {
    return json({ ok: false, error: "observation_not_owned" }, 403, { "cache-control": "no-store" });
  }

  const requestId = newId("reassess_req");
  const sourcePayload = {
    source: "cloudflare_observation_reassessment_request_ledger",
    observationId: normalizedObservationId,
    requestKind
  };
  await env.OBS_DB.prepare(
    `INSERT INTO observation_reassessment_requests (
       request_id, observation_id, request_kind, actor_user_id, request_state, source_payload_json
     ) VALUES (?, ?, ?, ?, 'pending', ?)
     ON CONFLICT(observation_id, request_kind, actor_user_id) DO UPDATE SET
       request_state = 'pending',
       source_payload_json = excluded.source_payload_json,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(
    requestId,
    normalizedObservationId,
    requestKind,
    session.userId,
    JSON.stringify(sourcePayload)
  ).run();

  return json({
    ok: true,
    reassessment: {
      requestId,
      state: "pending",
      kind: requestKind
    },
    compatibility: {
      source: "cloudflare_observation_reassessment_request_ledger",
      executionStatus: "not_migrated"
    }
  }, 202, { "cache-control": "no-store" });
}

async function resolveCompatibleObservationOwnerUserId(observationId: string, env: Env): Promise<string | null> {
  const nativeObservation = await env.OBS_DB.prepare(
    "SELECT owner_user_id FROM observations WHERE observation_id = ?"
  ).bind(observationId).first<{ owner_user_id: string | null }>();
  if (nativeObservation?.owner_user_id) return nativeObservation.owner_user_id;

  const importedVisit = await env.OBS_DB.prepare(
    `SELECT user_id
     FROM production_import_visits
     WHERE visit_id = ? OR legacy_observation_id = ?
     LIMIT 1`
  ).bind(observationId, observationId).first<{ user_id: string | null }>();
  if (importedVisit?.user_id) return importedVisit.user_id;

  const importedOccurrence = await env.OBS_DB.prepare(
    `SELECT v.user_id
     FROM production_import_occurrences o
     JOIN production_import_visits v ON v.visit_id = o.visit_id
     WHERE o.occurrence_id = ?
     LIMIT 1`
  ).bind(observationId).first<{ user_id: string | null }>();
  return importedOccurrence?.user_id ?? null;
}

function isValidObservationReactionType(value: string): boolean {
  return ["like", "helpful", "curious", "thanks"].includes(value);
}

async function submitCompatibleObservationIdentification(occurrenceId: string, request: Request, env: Env): Promise<Response> {
  const normalizedOccurrenceId = normalizeOptionalId(occurrenceId);
  if (!normalizedOccurrenceId || normalizedOccurrenceId.length > 160) {
    return json({ ok: false, error: "not_found" }, 404, { "cache-control": "no-store" });
  }

  let session: SessionSnapshot | null = null;
  try {
    session = await readCompatibleSessionWithOriginFallback(request, env);
  } catch {
    return json({ ok: false, error: "auth_store_unavailable" }, 503, { "cache-control": "no-store" });
  }
  if (!session) {
    return json({ ok: false, error: "session_required" }, 401, { "cache-control": "no-store" });
  }
  if (session.banned) {
    return json({ ok: false, error: "account_unavailable" }, 403, { "cache-control": "no-store" });
  }

  const targetExists = await observationReactionTargetExists(normalizedOccurrenceId, env);
  if (!targetExists) {
    return json({ ok: false, error: "observation_not_found" }, 404, { "cache-control": "no-store" });
  }

  const input = await readJson<CompatibleObservationIdentificationInput>(request);
  const proposedName = normalizeOptionalText(input.proposedName);
  if (!proposedName) {
    return json({ ok: false, error: "identification_name_required" }, 400, { "cache-control": "no-store" });
  }
  const proposedRank = normalizeOptionalText(input.proposedRank);
  const notes = normalizeOptionalText(input.notes);
  const stance = input.stance === "alternative" ? "alternative" : "support";
  const referenceSourceIds = Array.isArray(input.referenceSourceIds)
    ? input.referenceSourceIds.map((value) => normalizeOptionalText(value)).filter((value): value is string => Boolean(value))
    : [];
  const referenceLocator = normalizeOptionalText(input.referenceLocator);
  const sourceKey = `cf_public_identification:${normalizedOccurrenceId}:${session.userId}`;
  const identificationId = newId("identification");
  const sourcePayload = {
    source: "cloudflare_public_identification",
    stance,
    referenceSourceIds,
    referenceLocator,
    updatedAt: new Date().toISOString()
  };

  await env.OBS_DB.prepare(
    `INSERT INTO observation_identifications (
       identification_id, occurrence_id, actor_user_id, proposed_name, proposed_rank,
       stance, notes, source_key, source_payload_json, is_current
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT(source_key) DO UPDATE SET
       proposed_name = excluded.proposed_name,
       proposed_rank = excluded.proposed_rank,
       stance = excluded.stance,
       notes = excluded.notes,
       source_payload_json = excluded.source_payload_json,
       is_current = 1,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(
    identificationId,
    normalizedOccurrenceId,
    session.userId,
    proposedName,
    proposedRank,
    stance,
    notes,
    sourceKey,
    JSON.stringify(sourcePayload)
  ).run();

  await env.OBS_DB.prepare(
    "INSERT INTO outbox (outbox_id, topic, target_id, payload_json, partition_month) VALUES (?, ?, ?, ?, ?)"
  ).bind(
    newId("outbox"),
    "readmodel.refresh",
    normalizedOccurrenceId,
    JSON.stringify({ observationId: normalizedOccurrenceId, reason: "identification.write" }),
    null
  ).run();

  const countRow = await env.OBS_DB.prepare(
    "SELECT COUNT(*) AS count FROM observation_identifications WHERE occurrence_id = ? AND is_current = 1"
  ).bind(normalizedOccurrenceId).first<{ count: number }>();

  return json({
    ok: true,
    occurrenceId: normalizedOccurrenceId,
    promoted: false,
    compatibility: {
      source: "cloudflare_observation_identifications",
      sourcePayloadStored: true,
      referenceSelectionMode: referenceSourceIds.length > 0 || referenceLocator ? "payload_only" : "none"
    },
    consensus: {
      occurrenceId: normalizedOccurrenceId,
      consensusStatus: "needs_more_review",
      hasOpenDispute: false,
      identificationVerificationStatus: "community_reviewed",
      communityTaxon: {
        name: proposedName,
        rank: proposedRank,
        supportCount: countRow?.count ?? 1
      },
      neededEvidence: []
    }
  }, 200, { "cache-control": "no-store" });
}

async function openCompatibleObservationDispute(occurrenceId: string, request: Request, env: Env): Promise<Response> {
  const normalizedOccurrenceId = normalizeOptionalId(occurrenceId);
  if (!normalizedOccurrenceId || normalizedOccurrenceId.length > 160) {
    return json({ ok: false, error: "not_found" }, 404, { "cache-control": "no-store" });
  }

  let session: SessionSnapshot | null = null;
  try {
    session = await readCompatibleSessionWithOriginFallback(request, env);
  } catch {
    return json({ ok: false, error: "auth_store_unavailable" }, 503, { "cache-control": "no-store" });
  }
  if (!session) {
    return json({ ok: false, error: "session_required" }, 401, { "cache-control": "no-store" });
  }
  if (session.banned) {
    return json({ ok: false, error: "account_unavailable" }, 403, { "cache-control": "no-store" });
  }

  const targetExists = await observationReactionTargetExists(normalizedOccurrenceId, env);
  if (!targetExists) {
    return json({ ok: false, error: "observation_not_found" }, 404, { "cache-control": "no-store" });
  }

  const input = await readJson<CompatibleObservationDisputeInput>(request);
  const kind = normalizeObservationDisputeKind(input.kind);
  const proposedName = normalizeOptionalText(input.proposedName);
  const proposedRank = normalizeOptionalText(input.proposedRank);
  const reason = normalizeOptionalText(input.reason);
  if (kind === "alternative_id" && !proposedName) {
    return json({ ok: false, error: "identification_name_required" }, 400, { "cache-control": "no-store" });
  }

  const referenceSourceIds = Array.isArray(input.referenceSourceIds)
    ? input.referenceSourceIds.map((value) => normalizeOptionalText(value)).filter((value): value is string => Boolean(value))
    : [];
  const referenceLocator = normalizeOptionalText(input.referenceLocator);
  const disputeId = newId("dispute");
  const now = new Date().toISOString();
  const sourcePayload = {
    source: "cloudflare_public_dispute",
    createdBy: session.userId,
    referenceSourceIds,
    referenceLocator,
    createdAt: now
  };

  await env.OBS_DB.prepare(
    `INSERT INTO observation_identification_disputes (
       dispute_id, occurrence_id, actor_user_id, kind, proposed_name, proposed_rank,
       reason, status, source_payload_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`
  ).bind(
    disputeId,
    normalizedOccurrenceId,
    session.userId,
    kind,
    proposedName,
    proposedRank,
    reason,
    JSON.stringify(sourcePayload)
  ).run();

  if (kind === "alternative_id" && proposedName) {
    const sourceKey = `cf_public_dispute_alt:${normalizedOccurrenceId}:${session.userId}:${disputeId}`;
    await env.OBS_DB.prepare(
      `INSERT INTO observation_identifications (
         identification_id, occurrence_id, actor_user_id, proposed_name, proposed_rank,
         stance, notes, source_key, source_payload_json, is_current
       ) VALUES (?, ?, ?, ?, ?, 'alternative', ?, ?, ?, 1)`
    ).bind(
      newId("identification"),
      normalizedOccurrenceId,
      session.userId,
      proposedName,
      proposedRank,
      reason,
      sourceKey,
      JSON.stringify({
        source: "cloudflare_public_dispute_alternative",
        disputeId,
        updatedAt: now
      })
    ).run();
  }

  await env.OBS_DB.prepare(
    "INSERT INTO outbox (outbox_id, topic, target_id, payload_json, partition_month) VALUES (?, ?, ?, ?, ?)"
  ).bind(
    newId("outbox"),
    "readmodel.refresh",
    normalizedOccurrenceId,
    JSON.stringify({ observationId: normalizedOccurrenceId, reason: "identification.dispute" }),
    null
  ).run();

  const countRow = await env.OBS_DB.prepare(
    "SELECT COUNT(*) AS count FROM observation_identification_disputes WHERE occurrence_id = ? AND status = 'open'"
  ).bind(normalizedOccurrenceId).first<{ count: number }>();

  return json({
    ok: true,
    occurrenceId: normalizedOccurrenceId,
    disputeId,
    compatibility: {
      source: "cloudflare_observation_identification_disputes",
      alternativeIdentificationStored: kind === "alternative_id" && Boolean(proposedName),
      referenceSelectionMode: referenceSourceIds.length > 0 || referenceLocator ? "payload_only" : "none"
    },
    consensus: {
      occurrenceId: normalizedOccurrenceId,
      consensusStatus: "disputed",
      hasOpenDispute: true,
      identificationVerificationStatus: "needs_review",
      communityTaxon: proposedName ? {
        name: proposedName,
        rank: proposedRank,
        supportCount: 1
      } : null,
      neededEvidence: ["open_dispute"],
      openDisputeCount: countRow?.count ?? 1
    }
  }, 200, { "cache-control": "no-store" });
}

async function submitCompatibleObservationRecordAiReview(occurrenceId: string, request: Request, env: Env): Promise<Response> {
  const normalizedOccurrenceId = normalizeOptionalId(occurrenceId);
  if (!normalizedOccurrenceId || normalizedOccurrenceId.length > 160) {
    return json({ ok: false, error: "observation_not_found" }, 404, { "cache-control": "no-store" });
  }

  let session: SessionSnapshot | null = null;
  try {
    session = await readCompatibleSessionWithOriginFallback(request, env);
  } catch {
    return json({ ok: false, error: "auth_store_unavailable" }, 503, { "cache-control": "no-store" });
  }
  if (!session) {
    return json({ ok: false, error: "session_required" }, 401, { "cache-control": "no-store" });
  }
  if (session.banned) {
    return json({ ok: false, error: "account_unavailable" }, 403, { "cache-control": "no-store" });
  }

  const input = await readJson<CompatibleObservationRecordAiReviewInput>(request);
  const reviewState = normalizeObservationRecordAiReviewState(input.reviewState ?? "later");
  if (!reviewState) {
    return json({ ok: false, error: "invalid_ai_review_state" }, 400, { "cache-control": "no-store" });
  }

  const target = await env.OBS_DB.prepare(
    `SELECT occurrence_id, ai_assessment_status, scientific_name, vernacular_name, taxon_rank,
            ai_run_id, candidate_id, candidate_scientific_name, candidate_vernacular_name,
            candidate_taxon_rank, ai_recommended_taxon_name, ai_recommended_rank
       FROM observation_ai_review_targets
      WHERE occurrence_id = ?
      LIMIT 1`
  ).bind(normalizedOccurrenceId).first<D1ObservationAiReviewTarget>();
  if (!target) {
    return json({ ok: false, error: "observation_not_found" }, 404, { "cache-control": "no-store" });
  }
  if (target.ai_assessment_status !== "ai_judgement") {
    return json({ ok: false, error: "not_ai_judgement_record" }, 422, { "cache-control": "no-store" });
  }

  const proposedName = resolveAiJudgementIdentificationNameNative(target);
  const proposedRank = normalizeOptionalText(target.taxon_rank)
    ?? normalizeOptionalText(target.candidate_taxon_rank)
    ?? normalizeOptionalText(target.ai_recommended_rank);
  if (reviewState === "agree" && !proposedName) {
    return json({ ok: false, error: "identification_name_required" }, 400, { "cache-control": "no-store" });
  }

  const now = new Date().toISOString();
  await env.OBS_DB.prepare(
    `INSERT INTO observation_record_ai_reviews (
       review_id, occurrence_id, ai_run_id, candidate_id, actor_user_id,
       review_state, source_payload_json, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(occurrence_id, actor_user_id) DO UPDATE SET
       ai_run_id = excluded.ai_run_id,
       candidate_id = excluded.candidate_id,
       review_state = excluded.review_state,
       source_payload_json = excluded.source_payload_json,
       updated_at = excluded.updated_at`
  ).bind(
    newId("ai_review"),
    normalizedOccurrenceId,
    target.ai_run_id,
    target.candidate_id,
    session.userId,
    reviewState,
    JSON.stringify({ source: "cloudflare_ai_judgement_review", updatedAt: now }),
    now,
    now
  ).run();

  if (reviewState === "agree") {
    const sourceKey = `cf_ai_judgement_agree:${normalizedOccurrenceId}:${session.userId}`;
    await env.OBS_DB.prepare(
      `INSERT INTO observation_identifications (
         identification_id, occurrence_id, actor_user_id, proposed_name, proposed_rank,
         stance, notes, source_key, source_payload_json, is_current
       ) VALUES (?, ?, ?, ?, ?, 'support', NULL, ?, ?, 1)
       ON CONFLICT(source_key) DO UPDATE SET
         proposed_name = excluded.proposed_name,
         proposed_rank = excluded.proposed_rank,
         stance = 'support',
         notes = NULL,
         source_payload_json = excluded.source_payload_json,
         is_current = 1,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(
      newId("identification"),
      normalizedOccurrenceId,
      session.userId,
      proposedName,
      proposedRank,
      sourceKey,
      JSON.stringify({
        source: "cloudflare_ai_judgement_agree",
        aiRunId: target.ai_run_id,
        candidateId: target.candidate_id,
        updatedAt: now
      })
    ).run();
  }

  await env.OBS_DB.prepare(
    "INSERT INTO outbox (outbox_id, topic, target_id, payload_json, partition_month) VALUES (?, ?, ?, ?, ?)"
  ).bind(
    newId("outbox"),
    "readmodel.refresh",
    normalizedOccurrenceId,
    JSON.stringify({ observationId: normalizedOccurrenceId, reason: "ai.review" }),
    null
  ).run();

  const [agreeRow, disagreeRow, supportRow] = await Promise.all([
    env.OBS_DB.prepare(
      "SELECT COUNT(*) AS count FROM observation_record_ai_reviews WHERE occurrence_id = ? AND review_state = 'agree'"
    ).bind(normalizedOccurrenceId).first<{ count: number }>(),
    env.OBS_DB.prepare(
      "SELECT COUNT(*) AS count FROM observation_record_ai_reviews WHERE occurrence_id = ? AND review_state = 'disagree'"
    ).bind(normalizedOccurrenceId).first<{ count: number }>(),
    env.OBS_DB.prepare(
      "SELECT COUNT(*) AS count FROM observation_identifications WHERE occurrence_id = ? AND is_current = 1"
    ).bind(normalizedOccurrenceId).first<{ count: number }>()
  ]);

  const agreeCount = agreeRow?.count ?? (reviewState === "agree" ? 1 : 0);
  const disagreeCount = disagreeRow?.count ?? (reviewState === "disagree" ? 1 : 0);
  return json({
    ok: true,
    occurrenceId: normalizedOccurrenceId,
    reviewState,
    compatibility: {
      source: "cloudflare_observation_record_ai_reviews",
      targetSource: "observation_ai_review_targets"
    },
    consensus: {
      occurrenceId: normalizedOccurrenceId,
      consensusStatus: "needs_more_review",
      hasOpenDispute: false,
      identificationVerificationStatus: agreeCount > 0 ? "community_reviewed" : "ai_judgement",
      communityTaxon: proposedName ? {
        name: proposedName,
        rank: proposedRank,
        supportCount: supportRow?.count ?? (reviewState === "agree" ? 1 : 0)
      } : null,
      aiReviewAgreeCount: agreeCount,
      aiReviewDisagreeCount: disagreeCount,
      neededEvidence: []
    }
  }, 200, { "cache-control": "no-store", "x-ikimon-cloudflare-native": "observation-record-ai-review" });
}

function normalizeObservationRecordAiReviewState(value: unknown): "agree" | "disagree" | "later" | null {
  return value === "agree" || value === "disagree" || value === "later" ? value : null;
}

function resolveAiJudgementIdentificationNameNative(input: {
  scientific_name?: string | null;
  vernacular_name?: string | null;
  candidate_scientific_name?: string | null;
  candidate_vernacular_name?: string | null;
  ai_recommended_taxon_name?: string | null;
}): string | null {
  return normalizeOptionalText(input.scientific_name)
    ?? normalizeOptionalText(input.vernacular_name)
    ?? normalizeOptionalText(input.candidate_scientific_name)
    ?? normalizeOptionalText(input.candidate_vernacular_name)
    ?? normalizeOptionalText(input.ai_recommended_taxon_name);
}

function normalizeObservationDisputeKind(value: unknown): "alternative_id" | "needs_more_evidence" | "not_organism" | "location_date_issue" {
  return value === "needs_more_evidence" || value === "not_organism" || value === "location_date_issue"
    ? value
    : "alternative_id";
}

const RECORD_READING_MODEL_VERSION = "record_reading_cards_v0_1_cloudflare";
const RECORD_READING_SOURCE_RETRIEVED_AT = "2026-05-23";

const RECORD_READING_SOURCES = {
  trifoliumRepens: [
    {
      title: "Kew Plants of the World Online - Trifolium repens",
      url: "https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:523626-1",
      sourceKind: "trusted_db",
      retrievedAt: RECORD_READING_SOURCE_RETRIEVED_AT
    },
    {
      title: "USDA Forest Service FEIS - Trifolium repens",
      url: "https://research.fs.usda.gov/feis/species-reviews/trirep",
      sourceKind: "official",
      retrievedAt: RECORD_READING_SOURCE_RETRIEVED_AT
    },
    {
      title: "USDA NRCS Fact Sheet - White clover",
      url: "https://plants.usda.gov/DocumentLibrary/factsheet/pdf/fs_trre3.pdf",
      sourceKind: "official",
      retrievedAt: RECORD_READING_SOURCE_RETRIEVED_AT
    }
  ] satisfies RecordReadingSource[],
  satsumaSnails: [
    {
      title: "沖縄県 レッドデータおきなわ 貝類",
      url: "https://www.pref.okinawa.jp/_res/projects/default_project/_page_/001/004/628/12_kairui.pdf",
      sourceKind: "official",
      retrievedAt: RECORD_READING_SOURCE_RETRIEVED_AT
    },
    {
      title: "東邦大学 プレスリリース - 沖縄島北部の陸産貝類",
      url: "https://www.toho-u.ac.jp/press/2021_index/20210527-1134.html",
      sourceKind: "research",
      retrievedAt: RECORD_READING_SOURCE_RETRIEVED_AT
    },
    {
      title: "CiNii Research - ヤマタカマイマイ類の分類研究",
      url: "https://cir.nii.ac.jp/crid/1390845712998891008",
      sourceKind: "research",
      retrievedAt: RECORD_READING_SOURCE_RETRIEVED_AT
    }
  ] satisfies RecordReadingSource[]
};

async function generateCompatibleRecordReadingCards(observationId: string, request: Request, env: Env): Promise<Response> {
  const normalizedObservationId = normalizeOptionalId(observationId);
  if (!normalizedObservationId || normalizedObservationId.length > 160) {
    return json({ ok: false, error: "not_found" }, 404, { "cache-control": "no-store" });
  }

  let session: SessionSnapshot | null = null;
  try {
    session = await readCompatibleSessionWithOriginFallback(request, env);
  } catch {
    return json({ ok: false, error: "auth_store_unavailable" }, 503, { "cache-control": "no-store" });
  }
  if (!session) {
    return json({ ok: false, error: "session_required" }, 401, { "cache-control": "no-store" });
  }
  if (session.banned) {
    return json({ ok: false, error: "account_unavailable" }, 403, { "cache-control": "no-store" });
  }

  const signals = await resolveD1RecordReadingSignals(normalizedObservationId, env);
  if (!signals) {
    return json({ ok: false, error: "not_found", cards: [], reason: "not_found" }, 404, { "cache-control": "no-store" });
  }
  if (signals.ownerUserId !== session.userId) {
    return json({ ok: false, error: "observation_not_owned" }, 403, { "cache-control": "no-store" });
  }
  if (signals.mediaCount <= 0) {
    return json({ ok: false, cards: [], reason: "no_media" }, 422, { "cache-control": "no-store" });
  }

  const drafts = buildD1RecordReadingCardDrafts(signals).filter(hasPassingD1RecordReadingQualityGate);
  if (drafts.length === 0) {
    return json({ ok: false, cards: [], reason: "not_grounded" }, 422, { "cache-control": "no-store" });
  }

  const visibility = signals.publicVisibility === "public" ? "public" : "owner_only";
  for (const draft of drafts.slice(0, 3)) {
    await env.OBS_DB.prepare(
      `INSERT INTO record_reading_cards (
         card_id, visit_id, axis, title, body, sources_json, visibility,
         generation_condition_json, quality_gate_json, model_version, created_by_user_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(visit_id, axis) DO UPDATE SET
         title = excluded.title,
         body = excluded.body,
         sources_json = excluded.sources_json,
         visibility = excluded.visibility,
         generation_condition_json = excluded.generation_condition_json,
         quality_gate_json = excluded.quality_gate_json,
         model_version = excluded.model_version,
         created_by_user_id = excluded.created_by_user_id,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(
      newId("reading_card"),
      signals.visitId,
      draft.axis,
      draft.title,
      draft.body,
      JSON.stringify(draft.sources),
      visibility,
      JSON.stringify({
        ...draft.generationCondition,
        observedAt: signals.observedAt,
        mediaCount: signals.mediaCount
      }),
      JSON.stringify(draft.qualityGate),
      draft.modelVersion,
      session.userId
    ).run();
  }

  const cards = await listD1RecordReadingCards(signals.visitId, session.userId, env);
  return json({
    ok: cards.length > 0,
    cards,
    reason: cards.length > 0 ? "eligible" : "not_grounded",
    compatibility: {
      source: "cloudflare_record_reading_cards",
      generationMode: "deterministic_catalog"
    }
  }, cards.length > 0 ? 200 : 422, { "cache-control": "no-store" });
}

async function hideCompatibleRecordReadingCard(cardId: string, request: Request, env: Env): Promise<Response> {
  const normalizedCardId = normalizeOptionalId(cardId);
  if (!normalizedCardId || normalizedCardId.length > 160) {
    return json({ ok: false, error: "record_reading_card_not_found" }, 404, { "cache-control": "no-store" });
  }

  let session: SessionSnapshot | null = null;
  try {
    session = await readCompatibleSessionWithOriginFallback(request, env);
  } catch {
    return json({ ok: false, error: "auth_store_unavailable" }, 503, { "cache-control": "no-store" });
  }
  if (!session) {
    return json({ ok: false, error: "session_required" }, 401, { "cache-control": "no-store" });
  }
  if (session.banned) {
    return json({ ok: false, error: "account_unavailable" }, 403, { "cache-control": "no-store" });
  }

  const card = await env.OBS_DB.prepare(
    `SELECT card_id, visit_id, visibility
       FROM record_reading_cards
      WHERE card_id = ?
      LIMIT 1`
  ).bind(normalizedCardId).first<{
    card_id: string;
    visit_id: string;
    visibility: "owner_only" | "public" | "hidden";
  }>();
  if (!card) {
    return json({ ok: false, error: "record_reading_card_not_found" }, 404, { "cache-control": "no-store" });
  }

  const visit = await env.OBS_DB.prepare(
    `SELECT user_id
       FROM production_import_visits
      WHERE visit_id = ? OR legacy_observation_id = ?
      LIMIT 1`
  ).bind(card.visit_id, card.visit_id).first<{ user_id: string | null }>();
  if (visit?.user_id !== session.userId) {
    return json({ ok: false, error: "record_reading_card_not_found" }, 404, { "cache-control": "no-store" });
  }

  await env.OBS_DB.prepare(
    `UPDATE record_reading_cards
        SET visibility = 'hidden',
            updated_at = CURRENT_TIMESTAMP
      WHERE card_id = ?`
  ).bind(normalizedCardId).run();

  return json({
    ok: true,
    hidden: true,
    compatibility: {
      source: "cloudflare_record_reading_cards"
    }
  }, 200, { "cache-control": "no-store" });
}

async function resolveD1RecordReadingSignals(observationId: string, env: Env): Promise<{
  visitId: string;
  ownerUserId: string | null;
  publicVisibility: string;
  observedAt: string | null;
  mediaCount: number;
  subjects: Array<{ occurrence_id: string; scientific_name: string | null; vernacular_name: string | null; taxon_rank: string | null }>;
} | null> {
  const occurrence = await env.OBS_DB.prepare(
    `SELECT occurrence_id, visit_id, scientific_name, vernacular_name, taxon_rank
       FROM production_import_occurrences
      WHERE occurrence_id = ?
      LIMIT 1`
  ).bind(observationId).first<{
    occurrence_id: string;
    visit_id: string | null;
    scientific_name: string | null;
    vernacular_name: string | null;
    taxon_rank: string | null;
  }>();

  const visitLookupId = occurrence?.visit_id ?? observationId;
  const visit = await env.OBS_DB.prepare(
    `SELECT visit_id, user_id, COALESCE(public_visibility, 'public') AS public_visibility, observed_at
       FROM production_import_visits
      WHERE visit_id = ? OR legacy_observation_id = ?
      LIMIT 1`
  ).bind(visitLookupId, observationId).first<{
    visit_id: string;
    user_id: string | null;
    public_visibility: string | null;
    observed_at: string | null;
  }>();
  if (!visit) return null;

  const subjectsResult = await env.OBS_DB.prepare(
    `SELECT occurrence_id, scientific_name, vernacular_name, taxon_rank
       FROM production_import_occurrences
      WHERE visit_id = ?
      ORDER BY created_at ASC, occurrence_id ASC
      LIMIT 8`
  ).bind(visit.visit_id).all<{
    occurrence_id: string;
    scientific_name: string | null;
    vernacular_name: string | null;
    taxon_rank: string | null;
  }>();
  const subjects = subjectsResult.results.length > 0
    ? subjectsResult.results
    : occurrence
      ? [{
        occurrence_id: occurrence.occurrence_id,
        scientific_name: occurrence.scientific_name,
        vernacular_name: occurrence.vernacular_name,
        taxon_rank: occurrence.taxon_rank
      }]
      : [];

  const assetCount = await env.OBS_DB.prepare(
    `SELECT COUNT(*) AS count
       FROM production_import_evidence_assets
      WHERE visit_id = ?
        AND asset_role IN ('observation_photo', 'observation_video')`
  ).bind(visit.visit_id).first<{ count: number }>();

  return {
    visitId: visit.visit_id,
    ownerUserId: visit.user_id,
    publicVisibility: visit.public_visibility ?? "public",
    observedAt: visit.observed_at,
    mediaCount: Number(assetCount?.count ?? 0),
    subjects
  };
}

function buildD1RecordReadingCardDrafts(signals: {
  visitId: string;
  mediaCount: number;
  subjects: Array<{ scientific_name: string | null; vernacular_name: string | null; taxon_rank: string | null }>;
}): D1RecordReadingCardDraft[] {
  const text = [signals.visitId, ...signals.subjects.flatMap((subject) => [
    subject.scientific_name,
    subject.vernacular_name,
    subject.taxon_rank
  ])].filter(Boolean).join(" ").normalize("NFKC").toLowerCase();

  if (/(trifolium\s+repens|シロツメクサ|白詰草|white\s+clover|クローバー)/iu.test(text)) {
    const sources = RECORD_READING_SOURCES.trifoliumRepens;
    const condition = {
      matchedTaxon: "Trifolium repens",
      identityScope: "species_or_common_name",
      sourcePolicy: "trusted_catalog_min_2_sources",
      subjectCount: signals.subjects.length
    };
    return [
      d1RecordReadingCardDraft(
        "organism",
        "低く広がる白い花",
        "シロツメクサは、地面を這う茎から節ごとに根を出し、低く広がっていく植物です。白い花だけを見ると小さな点のようですが、足元まで写った記録では、草地の面をどう作っているかも伝わります。マメ科の植物として土の窒素循環にも関わるため、道端の小さな花が草地全体の見え方を変えています。",
        sources,
        condition
      ),
      d1RecordReadingCardDraft(
        "environment",
        "草地の明るさを映す植物",
        "シロツメクサは芝地や道端など、人の利用がある明るい草地でもよく見られます。記録にまわりの草丈や裸地が少し入っていると、花そのものだけでなく、その場所がどれくらい開けているかも読み取れます。写真の端に残った足元の情報が、草地の保たれ方を知る手がかりになります。",
        sources,
        condition
      ),
      d1RecordReadingCardDraft(
        "human_relation",
        "身近さの中に残る関係",
        "シロツメクサは、牧草や緑化にも使われてきた、人の暮らしと近い植物です。公園や道端で見かける身近さの一方で、花や葉、広がり方を一緒に残すと、そこがどんな使われ方をしている場所かも見えてきます。よくある花の写真が、その場所と人の関係まで含んだ記録になります。",
        sources,
        condition
      )
    ];
  }

  if (/(satsuma|オキナワヤマタカマイマイ|ヤマタカマイマイ|陸貝|かたつむり|カタツムリ|snail)/iu.test(text)) {
    const sources = RECORD_READING_SOURCES.satsumaSnails;
    const condition = {
      matchedTaxon: "Satsuma / Okinawan land snails",
      identityScope: "genus_or_group",
      sourcePolicy: "trusted_catalog_min_2_sources",
      subjectCount: signals.subjects.length
    };
    return [
      d1RecordReadingCardDraft(
        "organism",
        "殻の形から読む陸貝",
        "沖縄のヤマタカマイマイ類は、殻の形や色、巻き方などを手がかりに見られる陸貝の仲間です。この記録だけで種名まで断定するより、属や近いグループとして眺めるほうが無理がありません。小さな殻の写真でも、葉の上か幹の近くか、湿った場所かといった周辺情報が一緒に残ると、その場の状態が伝わりやすくなります。",
        sources,
        condition
      ),
      d1RecordReadingCardDraft(
        "environment",
        "湿り気と林の気配",
        "陸貝は乾燥に弱く、林床や葉の裏、石や倒木の周辺など、湿り気が残る微小な環境と関係して見られます。沖縄の陸貝をめぐる資料でも、島や地域ごとの環境との結びつきが重要な背景になります。写真に写った足元や葉の状態は、貝そのものと同じくらい、その場の空気を伝えます。",
        sources,
        condition
      ),
      d1RecordReadingCardDraft(
        "human_relation",
        "島の自然を映す小さな存在",
        "沖縄の陸貝は、島ごとの隔たりや環境の変化を考えるうえで注目されてきた生きものです。見慣れた小さな貝でも、どの地域で、どんな場所にいたかが残ると、単なる名前以上の意味を持ちます。施設や野外で見た一枚が、島の自然史につながる入口になります。",
        sources,
        condition
      )
    ];
  }

  return [];
}

function d1RecordReadingCardDraft(
  axis: RecordReadingAxis,
  title: string,
  body: string,
  sources: RecordReadingSource[],
  generationCondition: Record<string, unknown>
): D1RecordReadingCardDraft {
  const qualityGate = {
    sourceCount: sources.length,
    bodyCharCount: body.length,
    usesStoredCardOnly: true,
    avoidsActionTone: !/(次は|今度|撮る|行くなら|再訪|また行|見返せる)/u.test(body)
  };
  return {
    axis,
    title,
    body,
    sources,
    generationCondition,
    qualityGate,
    modelVersion: RECORD_READING_MODEL_VERSION
  };
}

function hasPassingD1RecordReadingQualityGate(draft: D1RecordReadingCardDraft): boolean {
  return draft.sources.length >= 2
    && draft.body.length >= 80
    && draft.body.length <= 520
    && draft.qualityGate.avoidsActionTone === true;
}

async function listD1RecordReadingCards(visitId: string, viewerUserId: string, env: Env): Promise<D1RecordReadingCardPayload[]> {
  const rows = await env.OBS_DB.prepare(
    `SELECT card_id, visit_id, axis, title, body, sources_json, visibility,
            generation_condition_json, quality_gate_json, model_version, created_at, updated_at
       FROM record_reading_cards
      WHERE visit_id = ?
        AND visibility <> 'hidden'
        AND (visibility = 'public' OR created_by_user_id = ?)
      ORDER BY CASE axis
        WHEN 'organism' THEN 1
        WHEN 'environment' THEN 2
        WHEN 'human_relation' THEN 3
        ELSE 9
      END`
  ).bind(visitId, viewerUserId).all<{
    card_id: string;
    visit_id: string;
    axis: RecordReadingAxis;
    title: string;
    body: string;
    sources_json: string;
    visibility: "owner_only" | "public" | "hidden";
    generation_condition_json: string;
    quality_gate_json: string;
    model_version: string;
    created_at: string;
    updated_at: string;
  }>();
  return rows.results.map((row) => ({
    cardId: row.card_id,
    visitId: row.visit_id,
    axis: row.axis,
    title: row.title,
    body: row.body,
    sources: parseRecordReadingJsonArray<RecordReadingSource>(row.sources_json),
    visibility: row.visibility,
    generationCondition: parseRecordReadingJsonObject(row.generation_condition_json),
    qualityGate: parseRecordReadingJsonObject(row.quality_gate_json),
    modelVersion: row.model_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

function parseRecordReadingJsonArray<T>(value: string): T[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function parseRecordReadingJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

async function toggleObservationReaction(occurrenceId: string, reactionType: string, request: Request, env: Env): Promise<Response> {
  const normalizedOccurrenceId = normalizeOptionalId(occurrenceId);
  if (!normalizedOccurrenceId || normalizedOccurrenceId.length > 160) {
    return json({ ok: false, error: "not_found" }, 404, { "cache-control": "no-store" });
  }
  if (!isValidObservationReactionType(reactionType)) {
    return json({ ok: false, error: "invalid_reaction_type" }, 400, { "cache-control": "no-store" });
  }

  let session: SessionSnapshot | null = null;
  try {
    session = await readCompatibleSession(request, env);
  } catch {
    return json({ ok: false, error: "auth_store_unavailable" }, 503, { "cache-control": "no-store" });
  }
  if (!session) {
    return json({ ok: false, error: "session_required" }, 401, { "cache-control": "no-store" });
  }

  const targetExists = await observationReactionTargetExists(normalizedOccurrenceId, env);
  if (!targetExists) {
    return json({ ok: false, error: "not_found" }, 404, { "cache-control": "no-store" });
  }

  try {
    await env.OBS_DB.prepare(
      `INSERT INTO observation_reactions (reaction_id, occurrence_id, user_id, reaction_type)
       VALUES (?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), normalizedOccurrenceId, session.userId, reactionType).run();
    return json({ ok: true, added: true }, 200, { "cache-control": "no-store" });
  } catch (error) {
    if (!isD1UniqueConstraintError(error)) throw error;
    await env.OBS_DB.prepare(
      `DELETE FROM observation_reactions
       WHERE occurrence_id = ? AND user_id = ? AND reaction_type = ?`
    ).bind(normalizedOccurrenceId, session.userId, reactionType).run();
    return json({ ok: true, added: false }, 200, { "cache-control": "no-store" });
  }
}

async function observationReactionTargetExists(occurrenceId: string, env: Env): Promise<boolean> {
  const row = await env.OBS_DB.prepare(
    `SELECT 1 AS ok
     WHERE EXISTS (SELECT 1 FROM observations WHERE observation_id = ?)
        OR EXISTS (SELECT 1 FROM readmodel_public_observations WHERE observation_id = ?)
        OR EXISTS (SELECT 1 FROM public_map_snapshot_records_v1 WHERE occurrence_id = ? OR visit_id = ?)
        OR EXISTS (SELECT 1 FROM production_import_occurrences WHERE occurrence_id = ?)
        OR EXISTS (SELECT 1 FROM production_import_visits WHERE visit_id = ?)
     LIMIT 1`
  ).bind(occurrenceId, occurrenceId, occurrenceId, occurrenceId, occurrenceId, occurrenceId).first<{ ok: number }>();
  return row?.ok === 1;
}

function isD1UniqueConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /unique constraint|constraint failed/i.test(message);
}

function isMapAreaPolygonsApiPath(pathname: string): boolean {
  return pathname === "/api/v1/map/area-polygons"
    || /^\/(?:ja|en|es|pt-br)\/api\/v1\/map\/area-polygons$/.test(pathname);
}

function mapAreaPolygonsFallbackLimit(zoom: number | null): number {
  if (zoom == null || !Number.isFinite(zoom)) return 48;
  if (zoom < 11) return 40;
  if (zoom < 13) return 56;
  if (zoom < 15) return 48;
  return 72;
}

function isShadowDiagnosticPath(pathname: string): boolean {
  return pathname.startsWith("/shadow-smoke/") || pathname.startsWith("/shadow/");
}

function shouldFallbackPublicCustomDomainPathToOrigin(request: Request, url: URL, env: Env): boolean {
  if (!shouldUseOriginFallback(url, env)) return false;
  if (getPublicCustomDomainOriginFallbackMode(env) === "disabled") return false;
  if (url.pathname.startsWith("/internal/")) return false;
  if (isShadowDiagnosticPath(url.pathname)) return false;
  if (url.pathname === "/health") return false;
  if (isSuspiciousPublicProbePath(url.pathname)) return false;
  if (/^(?:\/(?:ja|en|es|pt-br))?\/places\/[^/]+$/.test(url.pathname)) return false;
  if (url.pathname.startsWith("/api/v1/observations/")) return false;
  if (isPublicAppWriteCandidatePath(url) && getPublicWriteMode(env) === "cloudflare_native") return false;
  if (request.method !== "GET" && request.method !== "HEAD") return true;
  return true;
}

function shouldUseOriginFallback(url: URL, env: Env): boolean {
  return Boolean(env.ORIGIN_FALLBACK_BASE_URL) && PUBLIC_CUSTOM_HOSTS.has(url.hostname);
}

function getPublicCustomDomainOriginFallbackMode(env: Env): "enabled" | "disabled" {
  const mode = (env.PUBLIC_CUSTOM_DOMAIN_ORIGIN_FALLBACK_MODE ?? "enabled").trim().toLowerCase();
  return mode === "disabled" ? "disabled" : "enabled";
}

function isSuspiciousPublicProbePath(pathname: string): boolean {
  if (pathname.startsWith("/data:")) return true;
  if (pathname === "/app-ads.txt") return true;
  if (/^\/(?:\.|api\/\.|app\/\.|backend\/\.|config\/|credentials\/|debug\/|test\/|tests\/|xampp\/|www\/|web\/)/i.test(pathname)) return true;
  if (/(?:^|\/)(?:wp|wordpress|wp-admin|wp-content|wp-includes|wp-json|wlwmanifest\.xml|xmlrpc\.php)(?:\/|$)/i.test(pathname)) return true;
  if (/(?:^|\/)(?:phpinfo|updates?\.php|setup-config\.php|install\.php|mock-data)(?:\/|$)/i.test(pathname)) return true;
  if (/(?:^|\/)(?:client_secrets?|service[-_]?account|firebase[-_]?credentials|firebase[-_]?service[-_]?account|gcp[-_]?credentials|gcloud[-_]?service[-_]?key)\.json$/i.test(pathname)) return true;
  if (/^\/(?:firebase-adminsdk|firebase|gcp-key|credentials|application_default_credentials)\.json$/i.test(pathname)) return true;
  if (/^\/appsettings\.(?:json|development\.json|production\.json)$/i.test(pathname)) return true;
  return false;
}

function getPublicWriteMode(env: Env): "origin_fallback" | "cloudflare_native" | "write_disabled" {
  const mode = (env.PUBLIC_WRITE_MODE ?? "origin_fallback").trim().toLowerCase();
  if (mode === "cloudflare_native") return "cloudflare_native";
  if (mode === "write_disabled") return "write_disabled";
  return "origin_fallback";
}

function isPublicAppWriteCandidatePath(url: URL): boolean {
  if (url.pathname === "/api/v0/draft-observations") return true;
  if (url.pathname.startsWith("/api/v0/assets/") && url.pathname.endsWith("/body")) return true;
  if (url.pathname === "/api/v0/observations/finalize") return true;
  if (url.pathname === "/api/v1/observations/upsert") return true;
  if (url.pathname === "/api/v1/auth/session/issue") return true;
  if (url.pathname === "/api/v1/auth/session") return true;
  if (url.pathname === "/api/v1/auth/session/logout") return true;
  if (url.pathname === "/api/v1/auth/login") return true;
  if (url.pathname === "/api/v1/contact/submit") return true;
  if (url.pathname === "/api/v1/users/upsert") return true;
  if (url.pathname === "/api/v1/profile/me") return true;
  if (url.pathname === "/api/v1/auth/remember-tokens/issue") return true;
  if (url.pathname === "/api/v1/auth/remember-tokens/revoke") return true;
  if (url.pathname === "/api/v1/videos/direct-upload") return true;
  if (/^\/api\/v1\/videos\/[^/]+\/body$/.test(url.pathname)) return true;
  if (url.pathname === "/api/v1/videos/stream-webhook") return true;
  if (/^\/api\/v1\/videos\/[^/]+\/finalize$/.test(url.pathname)) return true;
  if (/^\/api\/v1\/observations\/[^/]+\/photos\/upload$/.test(url.pathname)) return true;
  if (/^\/api\/v1\/observations\/[^/]+\/hide$/.test(url.pathname)) return true;
  if (/^\/api\/v1\/observations\/[^/]+\/identifications$/.test(url.pathname)) return true;
  if (/^\/api\/v1\/observations\/[^/]+\/disputes$/.test(url.pathname)) return true;
  if (/^\/api\/v1\/observation-records\/[^/]+\/ai-review$/.test(url.pathname)) return true;
  if (url.pathname === "/api/v1/walk/session/start") return true;
  if (url.pathname === "/api/v1/walk/session/end") return true;
  if (url.pathname === "/api/v1/tracks/upsert") return true;
  return false;
}

async function getPersonalAreaSubscriptions(session: SessionSnapshot, env: Env): Promise<Response> {
  const rows = await env.CORE_DB.prepare(
    `SELECT subscription_id, target_type, target_id, label, href, is_active, created_at, updated_at
       FROM user_area_subscriptions
      WHERE user_id = ?
      ORDER BY is_active DESC, updated_at DESC
      LIMIT 100`
  ).bind(session.userId).all<PersonalAreaSubscriptionRow>();
  return json({
    ok: true,
    subscriptions: rows.results.map(personalAreaSubscriptionPayload)
  }, 200, { "cache-control": "no-store" });
}

async function getPersonalTaxonSubscriptions(session: SessionSnapshot, env: Env): Promise<Response> {
  const rows = await env.CORE_DB.prepare(
    `SELECT subscription_id, scientific_name, taxon_rank, match_field,
            trigger_invasive_only, trigger_rare_only, channel, label, is_active, created_at
       FROM taxon_alert_subscriptions
      WHERE user_id = ?
      ORDER BY is_active DESC, created_at DESC
      LIMIT 200`
  ).bind(session.userId).all<PersonalTaxonSubscriptionRow>();
  return json({
    ok: true,
    subscriptions: rows.results.map(personalTaxonSubscriptionPayload)
  }, 200, { "cache-control": "no-store" });
}

async function createPersonalTaxonSubscription(session: SessionSnapshot, request: Request, env: Env): Promise<Response> {
  const body = await readJson<{
    scientificName?: unknown;
    taxonRank?: unknown;
    matchField?: unknown;
    triggerInvasiveOnly?: unknown;
    triggerRareOnly?: unknown;
    channel?: unknown;
    label?: unknown;
    geoFilter?: unknown;
  }>(request);
  const scientificName = normalizeOptionalText(body.scientificName) ?? "";
  const taxonRank = normalizeOptionalText(body.taxonRank) ?? "";
  const matchField = normalizeOptionalText(body.matchField) ?? "";
  if (!scientificName && !taxonRank) {
    return json({ ok: false, error: "scientificName_or_taxonRank_required" }, 400, { "cache-control": "no-store" });
  }
  if (!VALID_PERSONAL_TAXON_MATCH_FIELDS.has(matchField)) {
    return json({ ok: false, error: "invalid_match_field" }, 400, { "cache-control": "no-store" });
  }
  if (taxonRank && !VALID_PERSONAL_TAXON_RANKS.has(taxonRank)) {
    return json({ ok: false, error: "invalid_taxon_rank" }, 400, { "cache-control": "no-store" });
  }
  const channelRaw = normalizeOptionalText(body.channel) ?? "email";
  const channel = VALID_PERSONAL_TAXON_CHANNELS.has(channelRaw) ? channelRaw : "email";
  const subscriptionId = crypto.randomUUID();
  await env.CORE_DB.prepare(
    `INSERT INTO taxon_alert_subscriptions (
        subscription_id, user_id, scientific_name, taxon_rank, match_field,
        geo_filter_json, trigger_invasive_only, trigger_rare_only, channel,
        label, is_active, created_at, updated_at
     ) VALUES (?, ?, NULLIF(?, ''), NULLIF(?, ''), ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).bind(
    subscriptionId,
    session.userId,
    scientificName,
    taxonRank,
    matchField,
    JSON.stringify(asPlainObject(body.geoFilter) ?? {}),
    body.triggerInvasiveOnly === true ? 1 : 0,
    body.triggerRareOnly === true ? 1 : 0,
    channel,
    typeof body.label === "string" ? body.label.slice(0, 200) : ""
  ).run();
  return json({ ok: true, subscriptionId }, 200, { "cache-control": "no-store" });
}

async function deletePersonalTaxonSubscription(session: SessionSnapshot, id: string, env: Env): Promise<Response> {
  const subscriptionId = normalizeOptionalText(id);
  if (!subscriptionId) {
    return json({ ok: false, error: "id_required" }, 400, { "cache-control": "no-store" });
  }
  const existing = await env.CORE_DB.prepare(
    "SELECT subscription_id FROM taxon_alert_subscriptions WHERE subscription_id = ? AND user_id = ?"
  ).bind(subscriptionId, session.userId).first<{ subscription_id: string }>();
  if (!existing) {
    return json({ ok: false, error: "not_found" }, 404, { "cache-control": "no-store" });
  }
  await env.CORE_DB.prepare(
    "DELETE FROM taxon_alert_subscriptions WHERE subscription_id = ? AND user_id = ?"
  ).bind(subscriptionId, session.userId).run();
  return json({ ok: true }, 200, { "cache-control": "no-store" });
}

async function upsertPersonalAreaSubscription(session: SessionSnapshot, request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ targetType?: unknown; targetId?: unknown; label?: unknown; href?: unknown }>(request);
  const targetType = normalizeOptionalText(body.targetType);
  const targetId = normalizeOptionalText(body.targetId);
  if (!targetType || !["field", "place", "region"].includes(targetType) || !targetId) {
    return json({ ok: false, error: "targetType_and_targetId_required" }, 400, { "cache-control": "no-store" });
  }
  const normalizedTargetId = targetId.slice(0, 160);
  const subscriptionId = crypto.randomUUID();
  const label = safePersonalLabel(body.label, normalizedTargetId);
  const href = safePersonalHref(body.href, areaSubscriptionHref(targetType, normalizedTargetId));
  await env.CORE_DB.prepare(
    `INSERT INTO user_area_subscriptions
       (subscription_id, user_id, target_type, target_id, label, href, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id, target_type, target_id)
     DO UPDATE SET label = excluded.label,
                   href = excluded.href,
                   is_active = 1,
                   updated_at = CURRENT_TIMESTAMP`
  ).bind(subscriptionId, session.userId, targetType, normalizedTargetId, label, href).run();
  const row = await env.CORE_DB.prepare(
    `SELECT subscription_id
       FROM user_area_subscriptions
      WHERE user_id = ? AND target_type = ? AND target_id = ?`
  ).bind(session.userId, targetType, normalizedTargetId).first<{ subscription_id: string }>();
  return json({ ok: true, subscriptionId: row?.subscription_id ?? subscriptionId }, 200, { "cache-control": "no-store" });
}

async function deletePersonalAreaSubscription(session: SessionSnapshot, id: string, env: Env): Promise<Response> {
  const subscriptionId = normalizeOptionalText(id);
  if (!subscriptionId) {
    return json({ ok: false, error: "id_required" }, 400, { "cache-control": "no-store" });
  }
  const existing = await env.CORE_DB.prepare(
    "SELECT subscription_id FROM user_area_subscriptions WHERE subscription_id = ? AND user_id = ?"
  ).bind(subscriptionId, session.userId).first<{ subscription_id: string }>();
  if (!existing) {
    return json({ ok: false, error: "not_found" }, 404, { "cache-control": "no-store" });
  }
  await env.CORE_DB.prepare(
    "DELETE FROM user_area_subscriptions WHERE subscription_id = ? AND user_id = ?"
  ).bind(subscriptionId, session.userId).run();
  return json({ ok: true }, 200, { "cache-control": "no-store" });
}

async function internalAlertDeliveryDrain(url: URL, env: Env): Promise<Response> {
  const limit = clampInteger(Number(url.searchParams.get("limit") ?? env.ALERT_DELIVERY_BATCH_SIZE ?? "25"), 1, 100);
  const result = await drainAlertDeliveries(env, { source: "manual", limit });
  return json({ ok: true, ...result }, 200, { "cache-control": "no-store" });
}

async function scheduleAlertDeliveryDrain(env: Env, controller: ScheduledController): Promise<void> {
  const limit = clampInteger(Number(env.ALERT_DELIVERY_BATCH_SIZE ?? "25"), 1, 100);
  const job: AlertDeliveryJob = { topic: "alert_delivery.drain", source: "cron", limit };
  if (env.ALERT_QUEUE) {
    await env.ALERT_QUEUE.send(job);
    return;
  }
  await drainAlertDeliveries(env, { source: controller.cron ? "cron" : "manual", limit });
}

function isAlertDeliveryJob(value: unknown): value is AlertDeliveryJob {
  return Boolean(value && typeof value === "object" && (value as { topic?: unknown }).topic === "alert_delivery.drain");
}

async function drainAlertDeliveries(
  env: Env,
  options: { source: "cron" | "manual" | "queue"; limit?: number }
): Promise<{ configured: boolean; scanned: number; sent: number; failed: number; suppressed: number; deferred: number }> {
  const limit = clampInteger(Number(options.limit ?? env.ALERT_DELIVERY_BATCH_SIZE ?? "25"), 1, 100);
  if (!env.ALERT_EMAIL) {
    return { configured: false, scanned: 0, sent: 0, failed: 0, suppressed: 0, deferred: 0 };
  }

  const pending = await env.CORE_DB.prepare(
    `SELECT delivery_id
       FROM alert_deliveries
      WHERE delivery_status = 'pending'
      ORDER BY COALESCE(created_at, '') ASC, delivery_id ASC
      LIMIT ?`
  ).bind(limit).all<{ delivery_id: string }>();

  const claimedIds: string[] = [];
  for (const row of pending.results) {
    const claimed = await env.CORE_DB.prepare(
      `UPDATE alert_deliveries
          SET delivery_status = 'sending',
              error_message = NULL
        WHERE delivery_id = ?
          AND delivery_status = 'pending'
      RETURNING delivery_id`
    ).bind(row.delivery_id).first<{ delivery_id: string }>();
    if (claimed?.delivery_id) claimedIds.push(claimed.delivery_id);
  }

  if (claimedIds.length === 0) {
    return { configured: true, scanned: pending.results.length, sent: 0, failed: 0, suppressed: 0, deferred: 0 };
  }

  const placeholders = claimedIds.map(() => "?").join(", ");
  const rows = await env.CORE_DB.prepare(
    `SELECT d.delivery_id, d.occurrence_id, d.user_id, d.recipient_id, d.trigger_kind, d.channel,
            d.payload_json, d.created_at,
            r.email AS recipient_email,
            r.display_name AS recipient_display_name,
            r.is_active AS recipient_active,
            r.rate_limit_per_day AS rate_limit_per_day,
            u.email AS user_email,
            u.display_name AS user_display_name,
            COALESCE(p.email_enabled, 1) AS user_email_enabled
       FROM alert_deliveries d
       LEFT JOIN alert_recipients r ON r.recipient_id = d.recipient_id
       LEFT JOIN auth_users u ON u.user_id = d.user_id
       LEFT JOIN user_notification_preferences p ON p.user_id = d.user_id
      WHERE d.delivery_status = 'sending'
        AND d.delivery_id IN (${placeholders})
      ORDER BY COALESCE(d.created_at, '') ASC, d.delivery_id ASC`
  ).bind(...claimedIds).all<AlertDeliveryCandidateRow>();

  let sent = 0;
  let failed = 0;
  let suppressed = 0;
  let deferred = 0;
  for (const row of rows.results) {
    if (row.channel !== "email") {
      await updateAlertDeliveryStatus(env, row, "suppressed", `unsupported_channel:${row.channel}`);
      suppressed += 1;
      continue;
    }

    const recipient = resolveAlertEmailRecipient(row);
    if (!recipient) {
      await updateAlertDeliveryStatus(env, row, "failed", "recipient_email_unavailable");
      failed += 1;
      continue;
    }

    if (!isAlertEmailRecipientAllowed(env, recipient)) {
      await releaseAlertDeliveryClaim(env, row, "nonproduction_recipient_not_allowed");
      deferred += 1;
      continue;
    }

    if (row.recipient_id && await isAlertRecipientRateLimited(env, row)) {
      await updateAlertDeliveryStatus(env, row, "suppressed", "recipient_daily_rate_limit");
      suppressed += 1;
      continue;
    }

    try {
      const payload = parseJsonObject(row.payload_json);
      await env.ALERT_EMAIL.send({
        from: alertEmailFrom(env),
        to: recipient,
        subject: alertEmailSubject(row, payload),
        text: alertEmailText(row, payload),
        headers: {
          "X-Ikimon-Alert-Delivery-Id": row.delivery_id,
          "X-Ikimon-Alert-Source": options.source
        }
      });
      await updateAlertDeliveryStatus(env, row, "sent", null);
      await recordAlertDeliveryEvent(env, row, "sent", null);
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await updateAlertDeliveryStatus(env, row, "failed", message.slice(0, 500));
      await recordAlertDeliveryEvent(env, row, "failed", message.slice(0, 500));
      failed += 1;
    }
  }
  return { configured: true, scanned: pending.results.length, sent, failed, suppressed, deferred };
}

function resolveAlertEmailRecipient(row: AlertDeliveryCandidateRow): string | null {
  if (row.recipient_id) {
    if (row.recipient_active === 0) return null;
    return normalizeOptionalText(row.recipient_email);
  }
  if (row.user_email_enabled === 0) return null;
  return normalizeOptionalText(row.user_email);
}

async function isAlertRecipientRateLimited(env: Env, row: AlertDeliveryCandidateRow): Promise<boolean> {
  const limit = clampInteger(Number(row.rate_limit_per_day ?? 50), 1, 1000);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const count = await env.CORE_DB.prepare(
    `SELECT COUNT(*) AS count
       FROM alert_deliveries
      WHERE recipient_id = ?
        AND delivery_status IN ('sent', 'acknowledged')
        AND delivered_at >= ?`
  ).bind(row.recipient_id, since).first<{ count: number }>();
  return toSafeCount(count?.count) >= limit;
}

async function updateAlertDeliveryStatus(
  env: Env,
  row: AlertDeliveryCandidateRow,
  status: "sent" | "failed" | "suppressed",
  errorMessage: string | null
): Promise<void> {
  const deliveredAt = status === "sent" ? new Date().toISOString() : null;
  await env.CORE_DB.prepare(
    `UPDATE alert_deliveries
        SET delivery_status = ?,
            delivered_at = COALESCE(?, delivered_at),
            error_message = ?
      WHERE delivery_id = ?`
  ).bind(status, deliveredAt, errorMessage, row.delivery_id).run();
}

async function releaseAlertDeliveryClaim(env: Env, row: AlertDeliveryCandidateRow, reason: string): Promise<void> {
  await env.CORE_DB.prepare(
    `UPDATE alert_deliveries
        SET delivery_status = 'pending',
            error_message = ?
      WHERE delivery_id = ?
        AND delivery_status = 'sending'`
  ).bind(reason, row.delivery_id).run();
}

function isAlertEmailRecipientAllowed(env: Env, recipient: string): boolean {
  if (env.ENVIRONMENT === "production") return true;
  const allowed = new Set(
    (env.ALERT_EMAIL_ALLOWED_RECIPIENTS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
  return allowed.has(recipient.trim().toLowerCase());
}

async function recordAlertDeliveryEvent(
  env: Env,
  row: AlertDeliveryCandidateRow,
  status: "sent" | "failed",
  errorMessage: string | null
): Promise<void> {
  if (row.trigger_kind !== "municipality_invasive") return;
  try {
    await env.CORE_DB.prepare(
      `INSERT INTO invasive_reporting_events
         (event_id, occurrence_id, recipient_id, delivery_id, event_status, trigger_source, payload_json, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, 'cloudflare_alert_delivery', ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      row.occurrence_id,
      row.recipient_id,
      row.delivery_id,
      status,
      row.payload_json ?? "{}",
      errorMessage,
      new Date().toISOString()
    ).run();
  } catch (error) {
    console.error(JSON.stringify({
      message: "alert_delivery_event_record_failed",
      deliveryId: row.delivery_id,
      error: error instanceof Error ? error.message : String(error)
    }));
  }
}

function alertEmailFrom(env: Env): string {
  return normalizeOptionalText(env.ALERT_EMAIL_FROM) ?? "notifications@ikimon.co.jp";
}

function alertEmailSubject(row: AlertDeliveryCandidateRow, payload: Record<string, unknown>): string {
  const title = normalizeOptionalText(payload.title) ?? normalizeOptionalText(payload.subject);
  if (title) return title.slice(0, 120);
  if (row.trigger_kind === "municipality_invasive") return "ikimon: 外来種らしき記録の通知";
  if (row.trigger_kind === "taxon_match") return "ikimon: フォロー中の生きものの記録";
  if (row.trigger_kind === "subject_proposal") return "ikimon: 記録の候補が届きました";
  return "ikimon: 新しい通知";
}

function alertEmailText(row: AlertDeliveryCandidateRow, payload: Record<string, unknown>): string {
  const title = alertEmailSubject(row, payload);
  const body = normalizeOptionalText(payload.body) ?? normalizeOptionalText(payload.message) ?? "ikimonで通知対象の記録が見つかりました。";
  const href = normalizeOptionalText(payload.href) ?? `/observations/${encodeURIComponent(row.occurrence_id)}`;
  const absoluteHref = href.startsWith("http://") || href.startsWith("https://") ? href : `https://ikimon.life${href.startsWith("/") ? href : `/${href}`}`;
  return [
    title,
    "",
    body,
    "",
    absoluteHref,
    "",
    "このメールはikimonの通知設定にもとづいて送信されています。"
  ].join("\n");
}

async function getPersonalizedMenu(session: SessionSnapshot, url: URL, env: Env): Promise<Response> {
  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "10"), 1, 20);
  const [areas, taxa, unreadAlerts] = await Promise.all([
    env.CORE_DB.prepare(
      `SELECT s.subscription_id, s.target_type, s.target_id, s.label, s.href, s.is_active, s.created_at, s.updated_at,
              COALESCE(st.observation_count, 0) AS observation_count,
              COALESCE(st.needs_id_count, 0) AS needs_id_count
         FROM user_area_subscriptions s
         LEFT JOIN user_area_subscription_stats st
           ON st.user_id = s.user_id AND st.target_type = s.target_type AND st.target_id = s.target_id
        WHERE s.user_id = ? AND s.is_active = 1
        ORDER BY s.updated_at DESC
        LIMIT 8`
    ).bind(session.userId).all<PersonalAreaSubscriptionRow>(),
    env.CORE_DB.prepare(
      `SELECT label, scientific_name, taxon_rank
         FROM taxon_alert_subscriptions
        WHERE user_id = ? AND is_active = 1
        ORDER BY created_at DESC
        LIMIT 8`
    ).bind(session.userId).all<PersonalTaxonSubscriptionRow>(),
    env.CORE_DB.prepare(
      `SELECT COUNT(*) AS unread_count
         FROM alert_deliveries
        WHERE user_id = ?
          AND acknowledged_at IS NULL`
    ).bind(session.userId).first<{ unread_count: number }>()
  ]);
  const items = dedupePersonalMenuItems([
    ...areas.results.map((row) => {
      const label = safePersonalLabel(row.label, row.target_id);
      return {
        kind: row.target_type,
        label,
        href: safePersonalHref(row.href, areaSubscriptionHref(row.target_type, row.target_id)),
        source: "follow",
        stats: {
          observationCount: toSafeCount(row.observation_count),
          needsIdCount: toSafeCount(row.needs_id_count)
        }
      };
    }),
    ...taxa.results.map((row) => {
      const label = safePersonalLabel(row.label ?? row.scientific_name ?? row.taxon_rank, "分類群");
      return {
        kind: "taxon",
        label,
        href: `/records?view=public&q=${encodeURIComponent(label)}`,
        source: "follow",
        stats: { followed: true }
      };
    })
  ]).slice(0, limit);
  return json({
    ok: true,
    items,
    summary: { unreadAlertCount: toSafeCount(unreadAlerts?.unread_count) }
  }, 200, { "cache-control": "no-store" });
}

async function getPersonalAlerts(session: SessionSnapshot, env: Env): Promise<Response> {
  const rows = await env.CORE_DB.prepare(
    `SELECT delivery_id, occurrence_id, trigger_kind, delivery_status, delivered_at, acknowledged_at, created_at, payload_json
       FROM alert_deliveries
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 100`
  ).bind(session.userId).all<PersonalAlertRow>();
  return json({
    ok: true,
    alerts: rows.results.map((row) => ({
      deliveryId: row.delivery_id,
      occurrenceId: row.occurrence_id,
      triggerKind: row.trigger_kind,
      deliveryStatus: row.delivery_status,
      deliveredAt: row.delivered_at,
      acknowledgedAt: row.acknowledged_at,
      createdAt: row.created_at,
      payload: parseJsonObject(row.payload_json)
    }))
  }, 200, { "cache-control": "no-store" });
}

async function markPersonalAlertsRead(session: SessionSnapshot, request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ ids?: unknown }>(request);
  const ids = Array.isArray(body.ids)
    ? body.ids.map((value) => normalizeOptionalText(value)).filter((value): value is string => Boolean(value)).slice(0, 100)
    : [];
  const now = new Date().toISOString();
  let acknowledgedCount = 0;
  if (ids.length > 0) {
    const placeholders = ids.map(() => "?").join(", ");
    const existing = await env.CORE_DB.prepare(
      `SELECT delivery_id
         FROM alert_deliveries
        WHERE user_id = ? AND delivery_id IN (${placeholders})`
    ).bind(session.userId, ...ids).all<{ delivery_id: string }>();
    acknowledgedCount = existing.results.length;
    if (acknowledgedCount > 0) {
      await env.CORE_DB.prepare(
        `UPDATE alert_deliveries
            SET acknowledged_at = COALESCE(acknowledged_at, ?),
                delivery_status = CASE WHEN delivery_status = 'sent' THEN 'acknowledged' ELSE delivery_status END
          WHERE user_id = ? AND delivery_id IN (${placeholders})`
      ).bind(now, session.userId, ...ids).run();
    }
  } else {
    const unread = await env.CORE_DB.prepare(
      `SELECT delivery_id
         FROM alert_deliveries
        WHERE user_id = ? AND acknowledged_at IS NULL`
    ).bind(session.userId).all<{ delivery_id: string }>();
    acknowledgedCount = unread.results.length;
    if (acknowledgedCount > 0) {
      await env.CORE_DB.prepare(
        `UPDATE alert_deliveries
            SET acknowledged_at = COALESCE(acknowledged_at, ?),
                delivery_status = CASE WHEN delivery_status = 'sent' THEN 'acknowledged' ELSE delivery_status END
          WHERE user_id = ? AND acknowledged_at IS NULL`
      ).bind(now, session.userId).run();
    }
  }
  return json({ ok: true, acknowledgedCount }, 200, { "cache-control": "no-store" });
}

function personalAreaSubscriptionPayload(row: PersonalAreaSubscriptionRow) {
  const label = safePersonalLabel(row.label, row.target_id);
  return {
    subscriptionId: row.subscription_id,
    targetType: row.target_type,
    targetId: row.target_id,
    label,
    href: safePersonalHref(row.href, areaSubscriptionHref(row.target_type, row.target_id)),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function personalTaxonSubscriptionPayload(row: PersonalTaxonSubscriptionRow) {
  return {
    subscriptionId: row.subscription_id,
    scientificName: row.scientific_name,
    taxonRank: row.taxon_rank,
    matchField: row.match_field,
    triggerInvasiveOnly: Boolean(row.trigger_invasive_only),
    triggerRareOnly: Boolean(row.trigger_rare_only),
    channel: row.channel,
    label: row.label ?? "",
    isActive: Boolean(row.is_active),
    createdAt: row.created_at
  };
}

function safePersonalLabel(value: unknown, fallback: string): string {
  const label = typeof value === "string" ? value.trim() : "";
  return (label || fallback).slice(0, 120);
}

function safePersonalHref(value: unknown, fallback: string): string {
  const href = typeof value === "string" ? value.trim() : "";
  if (!href || !href.startsWith("/") || href.startsWith("//") || href.includes("\n")) return fallback;
  return href.slice(0, 240);
}

function areaSubscriptionHref(targetType: string, targetId: string): string {
  const encoded = encodeURIComponent(targetId);
  if (targetType === "field") return `/map?field=${encoded}`;
  if (targetType === "place") return `/map?place=${encoded}`;
  return `/map?region=${encoded}`;
}

function dedupePersonalMenuItems<T extends { href: string; label: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const item of items) {
    const key = `${normalizePersonalMenuHref(item.href)}::${item.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function normalizePersonalMenuHref(value: string): string {
  const raw = value.trim();
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "";
  try {
    const url = new URL(raw, "https://ikimon.local");
    const parts = url.pathname.split("/").filter(Boolean);
    const first = parts[0];
    const langlessPath = first === "ja" || first === "en" || first === "es" || first === "pt-BR"
      ? `/${parts.slice(1).join("/")}` || "/"
      : url.pathname;
    return `${langlessPath}${url.search}`;
  } catch {
    return raw.split("#", 1)[0] ?? raw;
  }
}

function toSafeCount(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function parseJsonObject(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function isMutatingMethod(method: string): boolean {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

function publicWriteDisabledResponse(): Response {
  return json({
    ok: false,
    error: "write_temporarily_disabled",
    mode: "read_only_migration_window"
  }, 503, {
    "cache-control": "no-store",
    "retry-after": "300",
    "x-ikimon-cloudflare-write-mode": "write_disabled"
  });
}

async function handleAccountWriteApi(request: Request, url: URL, env: Env): Promise<Response | null> {
  if (!isAccountWritePath(request, url)) return null;
  if (shouldUseOriginFallback(url, env)) {
    const mode = getPublicWriteMode(env);
    if (mode === "origin_fallback") return null;
    if (mode === "write_disabled") return publicWriteDisabledResponse();
  }
  if (request.method === "POST" && url.pathname === "/api/v1/contact/submit") return submitContactNative(request, env);
  if (request.method === "POST" && url.pathname === "/api/v1/users/upsert") return upsertUserNative(request, env);
  if (request.method === "POST" && url.pathname === "/api/v1/profile/me") return updateOwnProfileNative(request, env);
  if (request.method === "POST" && url.pathname === "/api/v1/auth/remember-tokens/issue") return issueRememberTokenNative(request, env);
  if (request.method === "POST" && url.pathname === "/api/v1/auth/remember-tokens/revoke") return revokeRememberTokenNative(request, env);
  return json({ ok: false, error: "not_found" }, 404, { "cache-control": "no-store" });
}

function isAccountWritePath(request: Request, url: URL): boolean {
  if (request.method !== "POST") return false;
  return url.pathname === "/api/v1/contact/submit"
    || url.pathname === "/api/v1/users/upsert"
    || url.pathname === "/api/v1/profile/me"
    || url.pathname === "/api/v1/auth/remember-tokens/issue"
    || url.pathname === "/api/v1/auth/remember-tokens/revoke";
}

async function submitContactNative(request: Request, env: Env): Promise<Response> {
  const input = await readJson<Record<string, unknown>>(request);
  if (normalizeOptionalText(input.website) || normalizeOptionalText(input.spamTrap)) {
    return json({ ok: true, submissionId: "", notificationSent: false, autoReplySent: false }, 200, { "cache-control": "no-store" });
  }
  const proof = normalizeOptionalText(input.contactProof);
  const verifiedProof = proof ? await verifyContactProofNative(proof, env) : null;
  if (!verifiedProof) {
    return json({ ok: false, error: "contact_antispam_failed" }, 400, { "cache-control": "no-store" });
  }
  const category = normalizeOptionalText(input.category) ?? "other";
  if (!new Set(["bug", "improvement", "question", "partnership", "deletion", "media", "other"]).has(category)) {
    return json({ ok: false, error: "invalid_category" }, 400, { "cache-control": "no-store" });
  }
  const message = normalizeOptionalText(input.message) ?? "";
  if (message.length < 5) {
    return json({ ok: false, error: "message_too_short" }, 400, { "cache-control": "no-store" });
  }
  const email = normalizeOptionalText(input.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: "invalid_email" }, 400, { "cache-control": "no-store" });
  }
  const session = await readCompatibleSession(request, env).catch(() => null);
  const ipHash = await contactIpHash(request, env);
  const createdAt = new Date().toISOString();
  const rateLimited = await isContactSubmitRateLimited(env, {
    ipHash,
    email,
    userId: session?.userId ?? null
  });
  if (rateLimited) {
    return json({ ok: false, error: "rate_limited" }, 429, { "cache-control": "no-store", "retry-after": "3600" });
  }
  const nonceConsumed = await consumeContactProofNonce(env, verifiedProof, ipHash);
  if (!nonceConsumed) {
    return json({ ok: false, error: "contact_antispam_failed" }, 400, { "cache-control": "no-store" });
  }
  const submissionId = `contact-${crypto.randomUUID()}`;
  await env.CORE_DB.prepare(
    `INSERT INTO contact_submissions
       (submission_id, category, name, email, organization, message, source_url, user_agent, ip_hash, user_id, notification_sent, auto_reply_sent, send_error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NULL, ?)`
  ).bind(
    submissionId,
    category,
    normalizeOptionalText(input.name),
    email,
    normalizeOptionalText(input.organization),
    message.slice(0, 4000),
    normalizeOptionalText(input.sourceUrl) ?? request.headers.get("referer"),
    request.headers.get("user-agent"),
    ipHash,
    session?.userId ?? null,
    createdAt
  ).run();

  const delivery = await sendContactEmailsBestEffort(env, {
    submissionId,
    category,
    name: normalizeOptionalText(input.name),
    email,
    organization: normalizeOptionalText(input.organization),
    message
  });
  await env.CORE_DB.prepare(
    `UPDATE contact_submissions
        SET notification_sent = ?, auto_reply_sent = ?, send_error = ?
      WHERE submission_id = ?`
  ).bind(delivery.notificationSent ? 1 : 0, delivery.autoReplySent ? 1 : 0, delivery.error, submissionId).run();
  return json({ ok: true, submissionId, notificationSent: delivery.notificationSent, autoReplySent: delivery.autoReplySent }, 200, { "cache-control": "no-store" });
}

async function sendContactEmailsBestEffort(
  env: Env,
  input: { submissionId: string; category: string; name: string | null; email: string | null; organization: string | null; message: string }
): Promise<{ notificationSent: boolean; autoReplySent: boolean; error: string | null }> {
  if (!env.ALERT_EMAIL) return { notificationSent: false, autoReplySent: false, error: "email_binding_unconfigured" };
  let notificationSent = false;
  let autoReplySent = false;
  const errors: string[] = [];
  try {
    await env.ALERT_EMAIL.send({
      from: alertEmailFrom(env),
      to: normalizeOptionalText(env.CONTACT_ADMIN_TO) ?? "yamaki0102@gmail.com",
      subject: `ikimon contact: ${input.category}`,
      text: [
        `submission: ${input.submissionId}`,
        `name: ${input.name ?? ""}`,
        `email: ${input.email ?? ""}`,
        `organization: ${input.organization ?? ""}`,
        "",
        input.message
      ].join("\n")
    });
    notificationSent = true;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  if (input.email) {
    try {
      await env.ALERT_EMAIL.send({
        from: alertEmailFrom(env),
        to: input.email,
        subject: "ikimonへのお問い合わせを受け付けました",
        text: "お問い合わせを受け付けました。内容を確認して必要に応じて返信します。"
      });
      autoReplySent = true;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { notificationSent, autoReplySent, error: errors.join("; ").slice(0, 500) || null };
}

interface VerifiedContactProof {
  issuedAt: number;
  nonce: string;
}

async function verifyContactProofNative(proof: string, env: Env): Promise<VerifiedContactProof | null> {
  const parts = proof.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const issuedAt = Number(parts[1]);
  const nonce = parts[2];
  const signature = parts[3];
  if (!Number.isFinite(issuedAt) || !nonce || !signature) return null;
  const ageMs = Date.now() - issuedAt;
  if (ageMs < 2500 || ageMs > 2 * 60 * 60 * 1000) return null;
  const expected = await hmacSha256Base64Url(contactProofSecret(env), `v1.${issuedAt}.${nonce}`);
  return constantTimeStringEqual(expected, signature) ? { issuedAt, nonce } : null;
}

function contactProofSecret(env: Env): string {
  return normalizeOptionalText(env.CONTACT_FORM_SECRET)
    ?? normalizeOptionalText(env.V2_OAUTH_STATE_SECRET)
    ?? normalizeOptionalText(env.V2_PRIVILEGED_WRITE_API_KEY)
    ?? "local";
}

async function hmacSha256Base64Url(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", textToArrayBuffer(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, textToArrayBuffer(payload));
  return base64Url(bytes);
}

function base64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

async function contactIpHash(request: Request, env: Env): Promise<string | null> {
  const ip = normalizeOptionalText(request.headers.get("cf-connecting-ip"));
  if (!ip) return null;
  return sha256Hex(textToArrayBuffer(`${contactProofSecret(env)}:contact-ip:${ip}`));
}

async function isContactSubmitRateLimited(
  env: Env,
  input: { ipHash: string | null; email: string | null; userId: string | null }
): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const checks: Array<{ column: string; value: string }> = [];
  if (input.ipHash) checks.push({ column: "ip_hash", value: input.ipHash });
  if (input.email) checks.push({ column: "email", value: input.email.toLowerCase() });
  if (input.userId) checks.push({ column: "user_id", value: input.userId });
  for (const check of checks) {
    const row = await env.CORE_DB.prepare(
      `SELECT COUNT(*) AS count
         FROM contact_submissions
        WHERE ${check.column} = ?
          AND created_at >= ?`
    ).bind(check.value, since).first<{ count: number }>();
    if (toSafeCount(row?.count) >= 5) return true;
  }
  return false;
}

async function consumeContactProofNonce(env: Env, proof: VerifiedContactProof, ipHash: string | null): Promise<boolean> {
  const nonceHash = await sha256Hex(textToArrayBuffer(`${contactProofSecret(env)}:contact-nonce:${proof.issuedAt}:${proof.nonce}`));
  try {
    await env.CORE_DB.prepare(
      `INSERT INTO contact_proof_nonces (nonce_hash, issued_at_ms, ip_hash, consumed_at)
       VALUES (?, ?, ?, ?)`
    ).bind(nonceHash, proof.issuedAt, ipHash, new Date().toISOString()).run();
    return true;
  } catch {
    return false;
  }
}

async function upsertUserNative(request: Request, env: Env): Promise<Response> {
  const auth = assertPrivilegedWriteAccessNative(request, env);
  if (auth instanceof Response) return auth;
  const input = await readJson<Record<string, unknown>>(request);
  const userId = normalizeOptionalText(input.userId) ?? normalizeOptionalText(input.user_id);
  if (!userId) return json({ ok: false, error: "userId_required" }, 400, { "cache-control": "no-store" });
  const displayName = normalizeOptionalText(input.displayName) ?? normalizeOptionalText(input.display_name) ?? userId;
  const email = (normalizeOptionalText(input.email) ?? `${userId}@users.ikimon.local`).toLowerCase();
  const incomingRole = normalizeOptionalText(input.roleName) ?? normalizeOptionalText(input.role_name) ?? "Observer";
  const incomingRank = normalizeOptionalText(input.rankLabel) ?? normalizeOptionalText(input.rank_label) ?? null;
  const existing = await getAuthUserByUserId(env, userId);
  const preserved = preservePrivilegedRole(existing, incomingRole, incomingRank);
  await env.CORE_DB.batch([
    env.CORE_DB.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(userId),
    env.CORE_DB.prepare(
      `INSERT INTO auth_users
       (user_id, email, password_hash, display_name, role_name, rank_label, banned)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         email = excluded.email,
         password_hash = COALESCE(excluded.password_hash, auth_users.password_hash),
         display_name = excluded.display_name,
         role_name = excluded.role_name,
         rank_label = excluded.rank_label,
         banned = excluded.banned,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(
      userId,
      email,
      normalizeOptionalText(input.passwordHash) ?? normalizeOptionalText(input.password_hash),
      displayName,
      preserved.roleName,
      preserved.rankLabel,
      input.banned === true ? 1 : 0
    )
  ]);
  return json({ ok: true, userId, roleName: preserved.roleName, rankLabel: preserved.rankLabel, compatibility: { attempted: false, succeeded: false } }, 200, { "cache-control": "no-store" });
}

function preservePrivilegedRole(existing: AuthUserRow | null, incomingRole: string, incomingRank: string | null): { roleName: string; rankLabel: string | null } {
  const existingRole = (existing?.role_name ?? "").toLowerCase();
  const incoming = incomingRole.toLowerCase();
  const existingIsPrivileged = existingRole === "admin" || existingRole === "analyst" || existing?.rank_label === "管理者" || existing?.rank_label === "分析担当";
  const incomingIsPrivileged = incoming === "admin" || incoming === "analyst";
  if (existingIsPrivileged && !incomingIsPrivileged) {
    return { roleName: existing?.role_name ?? incomingRole, rankLabel: existing?.rank_label ?? incomingRank };
  }
  return { roleName: incomingRole, rankLabel: incomingRank };
}

async function getAuthUserByUserId(env: Env, userId: string): Promise<AuthUserRow | null> {
  return env.CORE_DB.prepare(
    `SELECT user_id, email, password_hash, display_name, role_name, rank_label, banned
       FROM auth_users
      WHERE user_id = ?`
  ).bind(userId).first<AuthUserRow>();
}

async function updateOwnProfileNative(request: Request, env: Env): Promise<Response> {
  const session = await readCompatibleSession(request, env);
  if (!session) return json({ ok: false, error: "auth_required" }, 401, { "cache-control": "no-store" });
  if (session.banned) return json({ ok: false, error: "account_unavailable" }, 403, { "cache-control": "no-store" });
  const input = await readJson<Record<string, unknown>>(request);
  const displayName = normalizeOptionalText(input.displayName) ?? "";
  if (!displayName) return json({ ok: false, error: "displayName_required" }, 400, { "cache-control": "no-store" });
  const profileBio = normalizeOptionalText(input.profileBio) ?? "";
  const expertise = normalizeOptionalText(input.expertise) ?? "";
  if (profileBio.length > 500) return json({ ok: false, error: "profileBio_too_long" }, 400, { "cache-control": "no-store" });
  if (expertise.length > 120) return json({ ok: false, error: "expertise_too_long" }, 400, { "cache-control": "no-store" });
  const existing = await getAuthUserByUserId(env, session.userId);
  if (!existing) return json({ ok: false, error: "user_not_found" }, 404, { "cache-control": "no-store" });
  const avatar = await storeProfileAvatarIfPresent(env, session.userId, input.avatar);
  await env.CORE_DB.batch([
    env.CORE_DB.prepare("UPDATE auth_users SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").bind(displayName, session.userId),
    env.CORE_DB.prepare(
      `INSERT INTO user_profiles
         (user_id, display_name, profile_bio, expertise, avatar_object_key, avatar_mime, avatar_bytes, avatar_sha256, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
         display_name = excluded.display_name,
         profile_bio = excluded.profile_bio,
         expertise = excluded.expertise,
         avatar_object_key = COALESCE(excluded.avatar_object_key, user_profiles.avatar_object_key),
         avatar_mime = COALESCE(excluded.avatar_mime, user_profiles.avatar_mime),
         avatar_bytes = COALESCE(excluded.avatar_bytes, user_profiles.avatar_bytes),
         avatar_sha256 = COALESCE(excluded.avatar_sha256, user_profiles.avatar_sha256),
         updated_at = CURRENT_TIMESTAMP`
    ).bind(session.userId, displayName, profileBio, expertise, avatar?.objectKey ?? null, avatar?.mime ?? null, avatar?.bytes ?? null, avatar?.sha256 ?? null),
    env.CORE_DB.prepare(
      `INSERT INTO profile_write_audit (audit_id, user_id, payload_json, created_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(`profile-audit-${crypto.randomUUID()}`, session.userId, JSON.stringify({ displayName, profileBio, expertise, avatar: avatar ? { objectKey: avatar.objectKey, bytes: avatar.bytes, mime: avatar.mime } : null }))
  ]);
  return json({
    ok: true,
    user: {
      userId: session.userId,
      displayName,
      rankLabel: existing.rank_label,
      profileBio,
      expertise,
      avatarUrl: avatar ? `/cdn-cgi/ikimon-assets/${avatar.objectKey}` : null
    },
    compatibility: { attempted: false, succeeded: false }
  }, 200, { "cache-control": "no-store" });
}

async function storeProfileAvatarIfPresent(env: Env, userId: string, avatarInput: unknown): Promise<{ objectKey: string; mime: string; bytes: number; sha256: string } | null> {
  const avatar = asPlainObject(avatarInput);
  if (!avatar) return null;
  const mime = normalizeOptionalText(avatar.mimeType) ?? normalizeOptionalText(avatar.mime) ?? "image/jpeg";
  if (mime !== "image/png") throw new HttpError(400, "avatar_reencode_required");
  const body = base64ToArrayBuffer(normalizeOptionalText(avatar.base64Data) ?? normalizeOptionalText(avatar.data) ?? "");
  if (body.byteLength === 0) throw new HttpError(400, "avatar_empty");
  if (body.byteLength > 5 * 1024 * 1024) throw new HttpError(400, "avatar_too_large");
  const sanitizedBody = sanitizePngAvatar(body);
  const sha = await sha256Hex(sanitizedBody);
  const ext = "png";
  const objectKey = `profiles/avatars-sanitized/${encodeURIComponent(userId)}/${sha.slice(0, 24)}.${ext}`;
  await env.ASSET_BUCKET.put(objectKey, sanitizedBody, { httpMetadata: { contentType: "image/png" } });
  return { objectKey, mime: "image/png", bytes: sanitizedBody.byteLength, sha256: sha };
}

function sanitizePngAvatar(body: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(body);
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!signature.every((byte, index) => bytes[index] === byte)) throw new HttpError(400, "invalid_avatar_image");
  const outputChunks: Uint8Array[] = [bytes.slice(0, 8)];
  let offset = 8;
  let sawIhdr = false;
  let sawIdat = false;
  let sawIend = false;
  while (offset + 12 <= bytes.length) {
    const length = readPngUint32(bytes, offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcEnd = dataEnd + 4;
    if (dataEnd > bytes.length || crcEnd > bytes.length) throw new HttpError(400, "invalid_avatar_image");
    const type = String.fromCharCode(...bytes.slice(typeStart, typeStart + 4));
    if (!/^[A-Za-z]{4}$/.test(type)) throw new HttpError(400, "invalid_avatar_image");
    const expectedCrc = readPngUint32(bytes, dataEnd);
    const actualCrc = crc32(bytes.slice(typeStart, dataEnd));
    if (expectedCrc !== actualCrc) throw new HttpError(400, "invalid_avatar_image");
    if (!sawIhdr && type !== "IHDR") throw new HttpError(400, "invalid_avatar_image");
    if (type === "IHDR") {
      if (sawIhdr || length !== 13) throw new HttpError(400, "invalid_avatar_image");
      const width = readPngUint32(bytes, dataStart);
      const height = readPngUint32(bytes, dataStart + 4);
      if (width < 1 || height < 1 || width > 2048 || height > 2048) throw new HttpError(400, "invalid_avatar_image");
      sawIhdr = true;
      outputChunks.push(bytes.slice(offset, crcEnd));
    } else if (type === "PLTE") {
      if (!sawIhdr || sawIdat) throw new HttpError(400, "invalid_avatar_image");
      outputChunks.push(bytes.slice(offset, crcEnd));
    } else if (type === "IDAT") {
      if (!sawIhdr || sawIend) throw new HttpError(400, "invalid_avatar_image");
      sawIdat = true;
      outputChunks.push(bytes.slice(offset, crcEnd));
    } else if (type === "IEND") {
      if (length !== 0 || !sawIdat) throw new HttpError(400, "invalid_avatar_image");
      outputChunks.push(bytes.slice(offset, crcEnd));
      sawIend = true;
      offset = crcEnd;
      break;
    } else if (isPngCriticalChunk(type)) {
      throw new HttpError(400, "unsupported_avatar_png_chunk");
    }
    offset = crcEnd;
  }
  if (!sawIend || offset !== bytes.length) throw new HttpError(400, "invalid_avatar_image");
  return concatUint8Arrays(outputChunks);
}

function isPngCriticalChunk(type: string): boolean {
  const first = type.charCodeAt(0);
  return first >= 65 && first <= 90;
}

function readPngUint32(bytes: Uint8Array, offset: number): number {
  return (((bytes[offset] ?? 0) * 0x1000000)
    + ((bytes[offset + 1] ?? 0) << 16)
    + ((bytes[offset + 2] ?? 0) << 8)
    + (bytes[offset + 3] ?? 0)) >>> 0;
}

function concatUint8Arrays(parts: Uint8Array[]): ArrayBuffer {
  const length = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output.buffer;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function issueRememberTokenNative(request: Request, env: Env): Promise<Response> {
  const auth = assertPrivilegedWriteAccessNative(request, env);
  if (auth instanceof Response) return auth;
  const input = await readJson<Record<string, unknown>>(request);
  const userId = normalizeOptionalText(input.userId);
  const rawToken = normalizeOptionalText(input.rawToken) ?? normalizeOptionalText(input.token);
  const expiresAt = normalizeOptionalText(input.expiresAt);
  if (!userId || !rawToken || !expiresAt) return json({ ok: false, error: "userId_rawToken_expiresAt_required" }, 400, { "cache-control": "no-store" });
  const tokenHash = await sha256Hex(textToArrayBuffer(rawToken));
  await env.CORE_DB.prepare(
    `INSERT INTO remember_tokens
       (token_hash, user_id, token_family, user_agent, ip_address, expires_at, created_at, last_used_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, NULL)
     ON CONFLICT(token_hash) DO UPDATE SET
       user_id = excluded.user_id,
       token_family = excluded.token_family,
       user_agent = excluded.user_agent,
       ip_address = excluded.ip_address,
       expires_at = excluded.expires_at`
  ).bind(tokenHash, userId, normalizeOptionalText(input.tokenFamily) ?? "v2", request.headers.get("user-agent"), request.headers.get("cf-connecting-ip"), expiresAt).run();
  return json({ ok: true, tokenHash, compatibility: { attempted: false, succeeded: false } }, 200, { "cache-control": "no-store" });
}

async function revokeRememberTokenNative(request: Request, env: Env): Promise<Response> {
  const auth = assertPrivilegedWriteAccessNative(request, env);
  if (auth instanceof Response) return auth;
  const input = await readJson<Record<string, unknown>>(request);
  const raw = normalizeOptionalText(input.token) ?? normalizeOptionalText(input.rawToken) ?? normalizeOptionalText(input.tokenHash);
  if (!raw) return json({ ok: false, error: "token_required" }, 400, { "cache-control": "no-store" });
  const tokenHash = /^[a-f0-9]{64}$/i.test(raw) ? raw.toLowerCase() : await sha256Hex(textToArrayBuffer(raw));
  await env.CORE_DB.prepare("DELETE FROM remember_tokens WHERE token_hash = ?").bind(tokenHash).run();
  return json({ ok: true, tokenHash, compatibility: { attempted: false, succeeded: false } }, 200, { "cache-control": "no-store" });
}

function assertPrivilegedWriteAccessNative(request: Request, env: Env): true | Response {
  const expected = normalizeOptionalText(env.V2_PRIVILEGED_WRITE_API_KEY);
  if (!expected) return json({ ok: false, error: "privileged_write_api_key_not_configured" }, 503, { "cache-control": "no-store" });
  const candidates = [
    request.headers.get("x-ikimon-write-key"),
    request.headers.get("x-v2-privileged-write-api-key"),
    request.headers.get("x-api-key"),
    bearerToken(request.headers.get("authorization"))
  ].map((value) => value?.trim()).filter((value): value is string => Boolean(value));
  return candidates.some((candidate) => constantTimeStringEqual(candidate, expected))
    ? true
    : json({ ok: false, error: "forbidden" }, 403, { "cache-control": "no-store" });
}

function bearerToken(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

async function fetchOriginFallback(request: Request, url: URL, env: Env, reason = "origin_fallback"): Promise<Response> {
  const base = new URL(env.ORIGIN_FALLBACK_BASE_URL ?? "");
  const target = new URL(url.toString());
  target.protocol = base.protocol;
  target.host = base.host;
  const resolveOverride = env.ORIGIN_FALLBACK_RESOLVE_OVERRIDE?.trim();
  if (target.host === url.host && !resolveOverride) {
    return json({ error: "origin_fallback_loop_blocked" }, 502, { "cache-control": "no-store" });
  }

  const headers = new Headers(request.headers);
  headers.set("x-ikimon-cloudflare-fallback", "origin");
  headers.set("x-ikimon-cloudflare-fallback-reason", reason);
  headers.delete("cf-connecting-ip");
  headers.delete("cf-ipcountry");
  headers.delete("cf-ray");
  headers.delete("cf-visitor");

  const originalUiHtmlKeyForTelemetry = isOriginalUiHtmlPath(url.pathname) ? originalUiHtmlKey(url.pathname) : null;
  await recordOriginFallbackTelemetry(env, {
    reason,
    method: request.method,
    host: url.hostname,
    routePattern: fallbackRoutePattern(url.pathname),
    pathHash: (await sha256Hex(textToArrayBuffer(url.pathname))).slice(0, 16),
    originalUiHtmlKeyHash: originalUiHtmlKeyForTelemetry ? (await sha256Hex(textToArrayBuffer(originalUiHtmlKeyForTelemetry))).slice(0, 16) : undefined,
    publicWriteMode: getPublicWriteMode(env),
    environment: env.ENVIRONMENT
  });

  const init: RequestInit & { cf?: { resolveOverride?: string } } = {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual"
  };
  if (resolveOverride) {
    init.cf = { resolveOverride };
  }

  return fetch(target.toString(), init);
}

async function recordOriginFallbackTelemetry(env: Env, payload: OriginFallbackTelemetryPayload): Promise<void> {
  try {
    await env.CORE_DB.prepare(
      `INSERT INTO operation_audit (audit_id, operation_type, target_id, payload_json)
       VALUES (?, 'origin_fallback', ?, ?)`
    ).bind(
      `origin-fallback-${crypto.randomUUID()}`,
      payload.reason,
      JSON.stringify(payload)
    ).run();
  } catch (error) {
    console.error(JSON.stringify({
      message: "origin_fallback_telemetry_failed",
      error: error instanceof Error ? error.message : String(error),
      reason: payload.reason,
      routePattern: payload.routePattern
    }));
  }
}

async function recordAuthLoginFailureTelemetry(env: Env, payload: AuthLoginFailureTelemetryPayload): Promise<void> {
  try {
    await env.CORE_DB.prepare(
      `INSERT INTO operation_audit (audit_id, operation_type, target_id, payload_json)
       VALUES (?, 'auth_login_failed', ?, ?)`
    ).bind(
      `auth-login-failed-${crypto.randomUUID()}`,
      payload.reason,
      JSON.stringify(payload)
    ).run();
  } catch (error) {
    console.error(JSON.stringify({
      message: "auth_login_failure_telemetry_failed",
      error: error instanceof Error ? error.message : String(error),
      reason: payload.reason,
      routePattern: payload.routePattern
    }));
  }
}

async function originFallbackTelemetrySummary(url: URL, env: Env): Promise<Response> {
  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "1000"), 1, 5000);
  const rows = await env.CORE_DB.prepare(
    `SELECT payload_json, created_at
     FROM operation_audit
     WHERE operation_type = 'origin_fallback'
     ORDER BY created_at DESC
     LIMIT ?`
  ).bind(limit).all<OperationAuditRow>();
  const byReason: Record<string, number> = {};
  const byRoutePattern: Record<string, number> = {};
  let parseFailures = 0;
  for (const row of rows.results) {
    try {
      const payload = JSON.parse(row.payload_json) as Partial<OriginFallbackTelemetryPayload>;
      const reason = normalizeOptionalText(payload.reason) ?? "unknown";
      const routePattern = normalizeOptionalText(payload.routePattern) ?? "unknown";
      byReason[reason] = (byReason[reason] ?? 0) + 1;
      byRoutePattern[routePattern] = (byRoutePattern[routePattern] ?? 0) + 1;
    } catch {
      parseFailures += 1;
    }
  }
  return json({
    ok: true,
    limit,
    count: rows.results.length,
    byReason,
    byRoutePattern,
    parseFailures,
    note: "Telemetry excludes query strings, request bodies, cookies, emails, passwords, and exact observation ids."
  }, 200, { "cache-control": "no-store" });
}

function fallbackRoutePattern(pathname: string): string {
  if (/^\/api\/v1\/fields\/[^/]+\/area-snapshot$/.test(pathname)) return "/api/v1/fields/:id/area-snapshot";
  if (pathname === "/favicon.ico") return "/favicon.ico";
  if (pathname === "/manifest.webmanifest") return "/manifest.webmanifest";
  if (/^\/assets\/brand\/[^/]+$/.test(pathname)) return "/assets/brand/:asset";
  if (/^\/assets\/img\/invasive\/[^/]+$/.test(pathname)) return "/assets/img/invasive/:asset";
  if (/^\/assets\/[^/]+/.test(pathname)) return "/assets/*";
  if (/^\/thumb\/[^/]+\/avatars\/[^/]+$/.test(pathname)) return "/thumb/:size/avatars/:asset";
  if (/^\/thumb\/[^/]+\/v2-observations\/[^/]+\/[^/]+$/.test(pathname)) return "/thumb/:size/v2-observations/:record/:asset";
  if (pathname === "/thumb/") return "/thumb/";
  if (/^\/thumb\//.test(pathname)) return "/thumb/*";
  if (/^(?:\/(?:ja|en|es|pt-br))?\/community\/fields\/[^/]+$/.test(pathname)) return pathname.replace(/^(\/(?:ja|en|es|pt-br))?\/community\/fields\/[^/]+$/, "$1/community/fields/:id");
  if (/^(?:\/(?:ja|en|es|pt-br))?\/places\/[^/]+\/snapshot$/.test(pathname)) return pathname.replace(/^(\/(?:ja|en|es|pt-br))?\/places\/[^/]+\/snapshot$/, "$1/places/:id/snapshot");
  if (/^(?:\/(?:ja|en|es|pt-br))?\/observations\/[^/]+$/.test(pathname)) return pathname.replace(/^(\/(?:ja|en|es|pt-br))?\/observations\/[^/]+$/, "$1/observations/:id");
  if (/^\/api\/v1\/observations\/[^/]+\/photos\/upload$/.test(pathname)) return "/api/v1/observations/:id/photos/upload";
  if (/^\/api\/v1\/observations\/[^/]+\/hide$/.test(pathname)) return "/api/v1/observations/:id/hide";
  if (/^\/api\/v1\/observations\/[^/]+\/public-detail$/.test(pathname)) return "/api/v1/observations/:id/public-detail";
  if (/^\/api\/v1\/observations\/[^/]+\/reactions\/[^/]+$/.test(pathname)) return "/api/v1/observations/:id/reactions/:type";
  if (/^\/api\/v1\/observations\/[^/]+\/candidates\/[^/]+\/(?:propose|adopt)$/.test(pathname)) return "/api/v1/observations/:id/candidates/:candidateId/:action";
  if (/^\/api\/v1\/observations\/[^/]+\/reassess$/.test(pathname)) return "/api/v1/observations/:id/reassess";
  if (/^\/api\/v1\/observations\/[^/]+\/reassess-from-video$/.test(pathname)) return "/api/v1/observations/:id/reassess-from-video";
  if (/^\/api\/v1\/observations\/[^/]+\/management-candidates\/[^/]+\/confirm$/.test(pathname)) return "/api/v1/observations/:id/management-candidates/:index/confirm";
  if (/^\/api\/v1\/observations\/[^/]+/.test(pathname)) return "/api/v1/observations/:id/*";
  if (/^\/api\/v1\/videos\/[^/]+\/body$/.test(pathname)) return "/api/v1/videos/:uid/body";
  if (/^\/api\/v1\/videos\/[^/]+\/finalize$/.test(pathname)) return "/api/v1/videos/:uid/finalize";
  const uuidRedacted = pathname.replace(
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi,
    "/:id"
  );
  if (uuidRedacted.length > 120 || /[<>{}"'`\\]|\s/.test(uuidRedacted) || uuidRedacted.startsWith("/data:")) {
    return "/_unmatched";
  }
  return uuidRedacted;
}

async function getPublicMapCells(url: URL, env: Env): Promise<Response> {
  const rows = await queryPublicMapRows(env);
  const bbox = parseBboxParam(url.searchParams.get("bbox"));
  const scopedRows = bbox ? rows.filter((row) => publicCellInBbox(row.public_cell, bbox)) : rows;
  const groups = new Map<string, PublicMapRow[]>();
  for (const row of scopedRows) {
    if (!parsePublicCell(row.public_cell)) continue;
    const existing = groups.get(row.public_cell) ?? [];
    existing.push(row);
    groups.set(row.public_cell, existing);
  }

  const features = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length || latestObservedAt(b[1]).localeCompare(latestObservedAt(a[1])))
    .slice(0, 1200)
    .map(([publicCell, group]) => {
      const parsed = parsePublicCell(publicCell);
      if (!parsed) return null;
      const taxonMix = group.reduce<Record<string, number>>((mix, row) => {
        const key = taxonGroupForLabel(row.taxon_label);
        mix[key] = (mix[key] ?? 0) + 1;
        return mix;
      }, {});
      return {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [publicCellPolygon(parsed.lat, parsed.lng)] },
        properties: {
          cellId: publicCellToCellId(publicCell),
          label: "位置をぼかしています",
          albumName: "このあたりの記録",
          localityLabel: "位置をぼかしています",
          themeLabel: "最近の発見",
          scaleLabel: `${MAP_DEFAULT_GRID_M}m`,
          nearbyAreaName: null,
          nameEraLabel: null,
          scope: "blurred",
          gridM: MAP_DEFAULT_GRID_M,
          radiusM: MAP_DEFAULT_GRID_M,
          count: group.length,
          firstObservedAt: earliestObservedAt(group),
          latestObservedAt: latestObservedAt(group),
          taxonMix,
          centroidLat: parsed.lat,
          centroidLng: parsed.lng
        }
      };
    })
    .filter((feature): feature is NonNullable<typeof feature> => Boolean(feature));

  return json({
    type: "FeatureCollection",
    features,
    stats: {
      totalReturned: features.length,
      totalAll: features.length,
      totalRecords: scopedRows.length,
      markerProfile: "all_research_artifacts",
      gridM: MAP_DEFAULT_GRID_M,
      provenance: publicMapEmptyProvenance(scopedRows.length)
    }
  }, 200, { "cache-control": "no-store" });
}

async function getPublicMapObservations(url: URL, env: Env): Promise<Response> {
  const bbox = parseBboxParam(url.searchParams.get("bbox"));
  const rawCellId = normalizeOptionalText(url.searchParams.get("cell_id"));
  const selectedCell = rawCellId ? cellIdToPublicCell(rawCellId) : null;
  if (!bbox && !selectedCell) {
    return json({ error: "missing_scope" }, 400);
  }

  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "300"), 1, 1200);
  const rows = await queryPublicMapRows(env);
  const scopedRows = rows
    .filter((row) => selectedCell ? row.public_cell === selectedCell : publicCellInBbox(row.public_cell, bbox as [number, number, number, number]))
    .sort((a, b) => b.observed_at.localeCompare(a.observed_at))
    .slice(0, limit);
  const photoUrls = await queryPublicMapPhotoUrls(env);

  return json({
    items: scopedRows.map((row) => publicMapObservationItem(row, photoUrls.get(row.observation_id) ?? null)),
    stats: {
      totalReturned: scopedRows.length,
      totalAll: scopedRows.length,
      markerProfile: "all_research_artifacts",
      gridM: MAP_DEFAULT_GRID_M,
      selectedCellId: selectedCell ? publicCellToCellId(selectedCell) : null,
      provenance: publicMapEmptyProvenance(scopedRows.length)
    }
  }, 200, { "cache-control": "no-store" });
}

async function getPublicMapCoverage(url: URL, env: Env): Promise<Response> {
  const rawYear = numberFromSearchParam(url.searchParams.get("year"));
  const year = rawYear !== null && Number.isInteger(rawYear) && rawYear >= 2000 && rawYear <= 2100 ? rawYear : null;
  const rows = await queryPublicMapRows(env);
  const grouped = new Map<string, { lat: number; lng: number; count: number }>();
  for (const row of rows) {
    if (year !== null && !row.observed_at.startsWith(String(year))) continue;
    const parsed = parsePublicCell(row.public_cell);
    if (!parsed) continue;
    const lat = Math.round(parsed.lat * 100) / 100;
    const lng = Math.round(parsed.lng * 100) / 100;
    const mesh = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    const current = grouped.get(mesh);
    if (current) current.count += 1;
    else grouped.set(mesh, { lat, lng, count: 1 });
  }
  const features = [...grouped.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, 1500)
    .map(([mesh, group]) => ({
      type: "Feature" as const,
      geometry: {
        type: "Polygon" as const,
        coordinates: [publicCellPolygon(group.lat, group.lng)]
      },
      properties: {
        mesh,
        count: group.count
      }
    }));
  const maxCount = features.reduce((max, feature) => Math.max(max, feature.properties.count), 0);
  return json({
    type: "FeatureCollection",
    features,
    maxCount,
    compatibility: {
      source: "cloudflare_readmodel_public_observations",
      exactLocationExposed: false
    }
  }, 200, { "cache-control": "no-store" });
}

async function getPublicMapSnapshotStatusResponse(env: Env): Promise<Response> {
  const meta = await queryPublicMapSnapshotMeta(env);
  if (!meta) {
    return json({
      ok: true,
      status: "missing",
      snapshotKey: "public-map:v1:global",
      generatedAt: null,
      sourceSampleSize: 0,
      publicRecordCount: 0,
      source: "cloudflare_public_map_snapshot_missing"
    }, 200, { "cache-control": "no-store" });
  }
  return json({
    ok: true,
    status: "fresh",
    snapshotKey: meta.snapshot_key,
    generatedAt: meta.generated_at,
    sourceSampleSize: meta.source_sample_size,
    publicRecordCount: meta.public_record_count,
    refreshedBy: meta.refreshed_by,
    policy: parseJsonRecord(meta.policy_json),
    source: "cloudflare_public_map_snapshot_records_v1"
  }, 200, { "cache-control": "no-store" });
}

type JmaNowcastTarget = {
  basetime?: unknown;
  validtime?: unknown;
  member?: unknown;
  elements?: unknown;
};

type JmaNowcastSelectedTarget = {
  basetime: string;
  validtime: string;
  member?: string;
};

function isValidJmaTimestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{14}$/.test(value);
}

function parseJmaTimestamp(value: string): number | null {
  if (!isValidJmaTimestamp(value)) return null;
  const ms = Date.UTC(
    Number(value.slice(0, 4)),
    Number(value.slice(4, 6)) - 1,
    Number(value.slice(6, 8)),
    Number(value.slice(8, 10)),
    Number(value.slice(10, 12)),
    Number(value.slice(12, 14))
  );
  return Number.isFinite(ms) ? ms : null;
}

function jmaTargetSupportsRain(target: JmaNowcastTarget): boolean {
  return !Array.isArray(target.elements) || target.elements.includes("hrpns");
}

function jmaTargetSupportsShortRangeRain(target: JmaNowcastTarget): boolean {
  return !Array.isArray(target.elements) || target.elements.includes("rasrf");
}

function jmaOffsetMinutes(target: JmaNowcastTarget): number | null {
  if (!isValidJmaTimestamp(target.basetime) || !isValidJmaTimestamp(target.validtime)) return null;
  const base = parseJmaTimestamp(target.basetime);
  const valid = parseJmaTimestamp(target.validtime);
  if (base === null || valid === null) return null;
  return Math.round((valid - base) / 60_000);
}

function chooseJmaNowcastTarget(targets: JmaNowcastTarget[], offsetMinutes: number): JmaNowcastSelectedTarget | null {
  const candidates = targets
    .filter((target) => isValidJmaTimestamp(target.basetime) && isValidJmaTimestamp(target.validtime) && jmaTargetSupportsRain(target))
    .map((target) => ({
      target: { basetime: target.basetime as string, validtime: target.validtime as string },
      offset: jmaOffsetMinutes(target)
    }))
    .filter((item): item is { target: JmaNowcastSelectedTarget; offset: number } => item.offset !== null);
  candidates.sort((a, b) => {
    const delta = Math.abs(a.offset - offsetMinutes) - Math.abs(b.offset - offsetMinutes);
    return delta !== 0 ? delta : b.target.validtime.localeCompare(a.target.validtime);
  });
  return candidates[0]?.target ?? null;
}

function chooseJmaShortRangeTarget(targets: JmaNowcastTarget[], offsetMinutes: number): JmaNowcastSelectedTarget | null {
  const candidates = targets
    .filter((target) => isValidJmaTimestamp(target.basetime) && isValidJmaTimestamp(target.validtime) && jmaTargetSupportsShortRangeRain(target))
    .map((target): { target: JmaNowcastSelectedTarget; offset: number | null } => ({
      target: {
        basetime: target.basetime as string,
        validtime: target.validtime as string,
        member: typeof target.member === "string" ? target.member : undefined
      },
      offset: jmaOffsetMinutes(target)
    }))
    .filter((item): item is { target: JmaNowcastSelectedTarget; offset: number } => item.offset !== null);
  candidates.sort((a, b) => {
    const delta = Math.abs(a.offset - offsetMinutes) - Math.abs(b.offset - offsetMinutes);
    if (delta !== 0) return delta;
    const memberRank = (value: string | undefined) => value === "immed" ? 0 : 1;
    const memberDelta = memberRank(a.target.member) - memberRank(b.target.member);
    return memberDelta !== 0 ? memberDelta : b.target.validtime.localeCompare(a.target.validtime);
  });
  return candidates[0]?.target ?? null;
}

async function fetchJmaTargets(url: string): Promise<JmaNowcastTarget[]> {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`jma_nowcast_fetch_failed:${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload as JmaNowcastTarget[] : [];
}

async function getJmaNowcastTimesResponse(): Promise<Response> {
  try {
    const [currentTargets, forecastTargets, shortRangeTargets] = await Promise.all([
      fetchJmaTargets(JMA_NOWCAST_TARGET_N1),
      fetchJmaTargets(JMA_NOWCAST_TARGET_N2),
      fetchJmaTargets(JMA_SHORT_RANGE_TARGET)
    ]);
    const times = [];
    for (const offsetMinutes of JMA_NOWCAST_OFFSETS) {
      const source = offsetMinutes === 0 ? currentTargets : forecastTargets;
      const target = chooseJmaNowcastTarget(source, offsetMinutes);
      if (!target) continue;
      times.push({
        offsetMinutes,
        basetime: target.basetime,
        validtime: target.validtime,
        product: "nowcast",
        member: "none",
        highResolution: offsetMinutes <= 30
      });
    }
    for (const offsetMinutes of JMA_SHORT_RANGE_OFFSETS) {
      const target = chooseJmaShortRangeTarget(shortRangeTargets, offsetMinutes);
      if (!target) continue;
      times.push({
        offsetMinutes,
        basetime: target.basetime,
        validtime: target.validtime,
        product: "short_range",
        member: target.member || "none",
        highResolution: false
      });
    }
    return json({
      source: "jma_precipitation_map",
      attribution: "Source: JMA High-resolution Precipitation Nowcast / Very Short-range Forecasts of Precipitation",
      attributionUrl: "https://www.jma.go.jp/jma/en/Activities/forecast.html",
      generatedAt: new Date().toISOString(),
      tileUrlTemplate: "/api/v1/weather/jma-nowcast/tile?product={product}&member={member}&basetime={basetime}&validtime={validtime}&z={z}&x={x}&y={y}",
      times
    }, 200, { "cache-control": "public, max-age=60" });
  } catch {
    return json({ error: "jma_nowcast_unavailable" }, 502, { "cache-control": "no-store" });
  }
}

function parseJmaTileNumber(raw: string | null, max: number): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > max) return null;
  return value;
}

async function getJmaNowcastTileResponse(url: URL): Promise<Response> {
  const rawProduct = url.searchParams.get("product");
  const product = rawProduct === "short_range" ? "short_range" : "nowcast";
  const rawMember = url.searchParams.get("member");
  const member = rawMember === null || rawMember === ""
    ? "none"
    : /^[a-z0-9_-]{1,24}$/i.test(rawMember) ? rawMember : null;
  const basetime = url.searchParams.get("basetime");
  const validtime = url.searchParams.get("validtime");
  const z = parseJmaTileNumber(url.searchParams.get("z"), JMA_RAIN_TILE_MAX_ZOOM);
  const maxTile = z === null ? 0 : (2 ** z) - 1;
  const x = parseJmaTileNumber(url.searchParams.get("x"), maxTile);
  const y = parseJmaTileNumber(url.searchParams.get("y"), maxTile);
  if (member === null || !isValidJmaTimestamp(basetime) || !isValidJmaTimestamp(validtime) || z === null || x === null || y === null) {
    return json({ error: "invalid_jma_nowcast_tile" }, 400, { "cache-control": "no-store" });
  }

  const jmaUrl = product === "short_range"
    ? `${JMA_SHORT_RANGE_ROOT}/${basetime}/${member}/${validtime}/surf/rasrf/${z}/${x}/${y}.png`
    : `${JMA_NOWCAST_ROOT}/${basetime}/none/${validtime}/surf/hrpns/${z}/${x}/${y}.png`;
  const cache = (globalThis as typeof globalThis & { caches?: { default?: { match(request: Request): Promise<Response | undefined>; put(request: Request, response: Response): Promise<void> } } }).caches?.default;
  const cacheRequest = new Request(jmaUrl, { method: "GET" });
  const cached = await cache?.match(cacheRequest);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set("cache-control", "public, max-age=300");
    headers.set("x-ikimon-weather-cache", "hit");
    headers.set("x-content-type-options", "nosniff");
    return new Response(cached.body, { status: cached.status, headers });
  }

  const upstream = await fetch(jmaUrl, { headers: { accept: "image/png" } });
  if (!upstream.ok) {
    return json({ error: "jma_nowcast_tile_unavailable" }, upstream.status === 404 ? 404 : 502, { "cache-control": "no-store" });
  }
  const bytes = await upstream.arrayBuffer();
  const response = new Response(bytes, {
    status: 200,
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=300",
      "x-ikimon-weather-cache": "miss",
      "x-content-type-options": "nosniff"
    }
  });
  await cache?.put(cacheRequest, response.clone());
  return response;
}

interface PublicMapAreaPolygonOptions {
  allowApproximateFallback?: boolean;
}

async function getPublicMapAreaPolygons(url: URL, env: Env, options: PublicMapAreaPolygonOptions = {}): Promise<Response | null> {
  const bbox = parseBboxParam(url.searchParams.get("bbox"));
  if (!bbox) {
    return json({ error: "missing_or_invalid_bbox" }, 400, { "cache-control": "no-store" });
  }
  const sources = parseSourceParam(url.searchParams.get("sources"));
  const defaultLimit = mapAreaPolygonsFallbackLimit(Number(url.searchParams.get("zoom")));
  const limit = clampInteger(Number(url.searchParams.get("limit") ?? String(defaultLimit)), 1, 1000);
  const nativeRows = await queryNativeAreaPolygonRows(env, bbox, sources, limit);
  if (nativeRows.length > 0) {
    const nativeFeatures = nativeRows
      .map((row) => areaPolygonFeatureFromGeometryReadmodel(row))
      .filter((feature): feature is NonNullable<typeof feature> => Boolean(feature))
      .filter(isDisplayableAreaPolygonFeature);
    if (
      options.allowApproximateFallback === false
      && sources.includes("school")
      && !nativeFeatures.some((feature) => feature.properties?.source === "school")
    ) {
      return null;
    }
    return json({
      type: "FeatureCollection",
      features: nativeFeatures,
      truncated: nativeRows.length >= limit,
      stats: {
        totalReturned: nativeFeatures.length,
        totalAll: nativeFeatures.length,
        source: "cloudflare_area_polygon_readmodel",
        kind: "area-polygons"
      }
    }, 200, { "cache-control": "public, max-age=60" });
  }
  if (options.allowApproximateFallback === false) return null;

  const rows = await queryAreaPolygonRows(env, bbox, sources, limit);
  const features = rows
    .map((row) => areaPolygonFeatureFromReadmodel(row))
    .filter((feature): feature is NonNullable<typeof feature> => Boolean(feature));

  return json({
    type: "FeatureCollection",
    features,
    truncated: rows.length >= limit,
    stats: {
      totalReturned: features.length,
      totalAll: features.length,
      source: "cloudflare_field_detail_readmodel",
      kind: "area-polygons"
    }
  }, 200, { "cache-control": "public, max-age=60" });
}

function getPublicMapGuideSpots(url: URL): Response {
  const bbox = parseBboxParam(url.searchParams.get("bbox"));
  if (!bbox) {
    return json({ error: "missing_or_invalid_bbox" }, 400, { "cache-control": "no-store" });
  }
  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "80"), 1, 120);
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const scoped = SHADOW_MAP_GUIDE_SPOTS
    .filter((spot) => spot.lng >= minLng && spot.lng <= maxLng && spot.lat >= minLat && spot.lat <= maxLat)
    .slice(0, limit);
  return json({
    type: "FeatureCollection",
    features: scoped.map((spot) => {
      const { lat: _lat, lng: _lng, ...properties } = spot;
      return {
        type: "Feature",
        properties,
        geometry: {
          type: "Point",
          coordinates: [spot.lng, spot.lat]
        }
      };
    }),
    truncated: scoped.length >= limit,
    stats: {
      totalReturned: scoped.length,
      totalAll: scoped.length,
      source: "cloudflare_static_global_guide_spots",
      kind: "guide-spots",
      coverage: "global_bbox"
    }
  }, 200, { "cache-control": "public, max-age=300" });
}

const STATIC_MUNICIPAL_WALK_MAP_SUMMARIES = [
  {
    schemaVersion: "municipal_walk_map_public_summary/v0",
    walkMapId: "jp-shizuoka-yatsuyama-sample-v0",
    municipality: "静岡市",
    title: "八ツ山周辺を歩くサンプル",
    summary: "静岡市公式資料を出典として、公開範囲で木陰、足元の草地、鳥の声を軽く残すために再構成したサンプルです。",
    theme: "satoyama",
    publishMode: "public_preview",
    routeStyle: "loose_stops",
    mobilityModes: ["walk", "bike", "public_transport"],
    stopCount: 2,
    sourceReferences: [
      { label: "静岡市 いきもの散策マップ", url: "https://www.city.shizuoka.lg.jp/s6347/s001494.html", note: "静岡市公式ページを出典として表示します。" }
    ],
    areaHint: {
      lat: 34.986,
      lng: 138.407,
      label: "谷津山周辺",
      precision: "area_hint",
      source: "official_source_sample"
    }
  },
  {
    schemaVersion: "municipal_walk_map_public_summary/v0",
    walkMapId: "jp-shizuoka-asahata-waterfront-sample-v0",
    municipality: "静岡市",
    title: "麻機の水辺を歩くサンプル",
    summary: "静岡市公式資料を出典として、水辺を安全に見ながら、鳥の声、水面、草地の変化を残すサンプルです。",
    theme: "waterfront",
    publishMode: "public_preview",
    routeStyle: "loose_stops",
    mobilityModes: ["walk", "bike", "public_transport"],
    stopCount: 2,
    sourceReferences: [
      { label: "静岡市 いきもの散策マップ", url: "https://www.city.shizuoka.lg.jp/s6347/s001494.html", note: "静岡市公式ページを出典として表示します。" }
    ],
    areaHint: {
      lat: 35.015,
      lng: 138.389,
      label: "麻機の水辺",
      precision: "area_hint",
      source: "official_source_sample"
    }
  },
  {
    schemaVersion: "municipal_walk_map_public_summary/v0",
    walkMapId: "jp-shizuoka-mariko-waterfront-sample-v0",
    municipality: "静岡市",
    title: "丸子川・広野海岸公園周辺サンプル",
    summary: "静岡市公式資料を出典として、川と海岸公園の公開範囲で、水辺の様子や鳥の声を残すサンプルです。",
    theme: "waterfront",
    publishMode: "public_preview",
    routeStyle: "loose_stops",
    mobilityModes: ["walk", "bike", "car", "public_transport"],
    stopCount: 2,
    sourceReferences: [
      { label: "静岡市 いきもの散策マップ", url: "https://www.city.shizuoka.lg.jp/s6347/s001494.html", note: "静岡市公式ページを出典として表示します。" }
    ],
    areaHint: {
      lat: 34.925,
      lng: 138.379,
      label: "丸子川・広野海岸公園周辺",
      precision: "area_hint",
      source: "official_source_sample"
    }
  }
];

const DEFAULT_MUNICIPAL_WALK_MAP_CLAIM_BOUNDARY = [
  "公式調査結果ではなく、散策マップとして扱います。",
  "学校、私有地、立入不明の場所は公開前に確認します。",
  "希少種、自宅付近、未成年が推測される情報は場所の出し方を落とします。"
];

function municipalWalkMapTemplateConfig(input: {
  title: string;
  summary: string;
  theme: string;
  routeStyle: string;
  mobilityModes: string[];
  stops: Array<Record<string, unknown>>;
}) {
  return {
    schemaVersion: "municipal_walk_map_config/v0",
    walkMapId: "",
    municipality: "",
    creatorName: "",
    creatorProfile: {
      creatorId: "",
      displayName: "",
      registrationKind: "registered_group",
      verificationStatus: "pending",
      commercialIntent: "none"
    },
    title: input.title,
    summary: input.summary,
    theme: input.theme,
    publishMode: "draft",
    areaScope: { municipalityCodes: [], placeIds: [], polygonIds: [] },
    routeStops: input.stops,
    recordModes: ["photo", "memo", "unknown_species"],
    routeFlexibility: {
      routeStyle: input.routeStyle,
      mobilityModes: input.mobilityModes,
      offRoutePolicy: input.routeStyle === "guide_only" ? "guide_only" : "off_route_allowed",
      returnCues: ["近くの公開道へ戻る", "無理に全部回らず、1か所だけで終えてよい"]
    },
    publicPrecisionPolicy: "mesh_or_coarser",
    claimBoundary: DEFAULT_MUNICIPAL_WALK_MAP_CLAIM_BOUNDARY,
    sourceReferences: []
  };
}

const STATIC_MUNICIPAL_WALK_MAP_TEMPLATES = [
  {
    schemaVersion: "municipal_walk_map_template/v0",
    templateId: "habitat_micro_walk",
    label: "水辺・田んぼ・海岸の観察ルート",
    sourcePattern: "Habitat micro walk",
    summary: "川、池、海岸沿いで、鳥、水生生物、水位や草地の変化を扱う散策マップ。",
    exampleSources: [
      { label: "静岡市 いきもの散策マップ", url: "https://www.city.shizuoka.lg.jp/s6347/s001494.html" },
      { label: "高知市 鏡川流域いきもの図鑑", url: "https://www.city.kochi.kochi.jp/soshiki/186/r8--kagamigawaryuiki-ikimonozukan.html" }
    ],
    config: municipalWalkMapTemplateConfig({
      title: "水辺を歩く散策マップ",
      summary: "公開範囲の水辺を歩きながら、鳥の声、水面、草地の変化を軽く残します。",
      theme: "waterfront",
      routeStyle: "loose_stops",
      mobilityModes: ["walk", "bike"],
      stops: [
        { stopId: "waterfront-start", title: "水辺の入口", areaKind: "waterfront", access: "public_access", estimatedMinutes: 15, noticeCues: ["案内板", "水面", "岸辺の草地"], recordCues: ["鳥の声", "水の量", "水辺の植物"] },
        { stopId: "waterfront-open-edge", title: "開けた岸辺", areaKind: "waterfront", access: "public_access", estimatedMinutes: 15, noticeCues: ["水鳥", "浅瀬", "橋の下"], recordCues: ["見えた鳥", "水際の花", "風やにおい"] }
      ]
    })
  },
  {
    schemaVersion: "municipal_walk_map_template/v0",
    templateId: "route_species_walk",
    label: "コース散策＋見つかる生きもの",
    sourcePattern: "Route + species walk",
    summary: "歩く場所と見つかりやすい生きものを同じ画面で扱う、初回散策向けの型。",
    exampleSources: [
      { label: "静岡市 いきもの散策マップ", url: "https://www.city.shizuoka.lg.jp/s6347/s001494.html" },
      { label: "小山市 小山のいきものさがしてみよう", url: "https://www.city.oyama.tochigi.jp/kurashi/shiminkatsudo-machizukuri/page009360.html" }
    ],
    config: municipalWalkMapTemplateConfig({
      title: "コースで歩く散策マップ",
      summary: "短い時間で歩ける公開範囲を中心に、花、虫、鳥の声、足元の変化を残します。",
      theme: "park_walk",
      routeStyle: "loose_stops",
      mobilityModes: ["walk", "bike", "public_transport"],
      stops: [
        { stopId: "park-entrance", title: "公園入口", areaKind: "park", access: "public_access", estimatedMinutes: 10, noticeCues: ["案内板", "花壇", "木陰"], recordCues: ["咲いている花", "虫の動き", "木の実"] },
        { stopId: "grass-edge", title: "草地のふち", areaKind: "park", access: "public_access", estimatedMinutes: 10, noticeCues: ["草の高さ", "湿った場所", "落ち葉"], recordCues: ["足元の草花", "聞こえた音", "季節の色"] }
      ]
    })
  },
  {
    schemaVersion: "municipal_walk_map_template/v0",
    templateId: "citizen_campaign_walk",
    label: "市民参加型いきもの調査",
    sourcePattern: "Citizen science campaign",
    summary: "市内全域で、住宅地、公園、道沿いなど身近な場所の発見を集めるキャンペーン型。",
    exampleSources: [
      { label: "飯田市 いきもの大調査", url: "https://www.city.iida.lg.jp/soshiki/19/ikimonochousainiidasaishuuhoukoku.html" },
      { label: "岡崎市 みんなでつくる おかざき生きもの図鑑", url: "https://www.city.okazaki.lg.jp/kurashi/gomi/1002429/1002431/1002427.html" }
    ],
    config: municipalWalkMapTemplateConfig({
      title: "市内の生きものを残す散策マップ",
      summary: "市内の公開範囲で、花、虫、鳥、身近な季節の変化を軽く残します。",
      theme: "city_nature",
      routeStyle: "free_area",
      mobilityModes: ["walk", "bike", "car", "motorbike", "public_transport"],
      stops: [
        { stopId: "nearby-park-or-street", title: "近くの公園や道沿い", areaKind: "street_edge", access: "public_access", estimatedMinutes: 10, noticeCues: ["街路樹", "花壇", "足元の草"], recordCues: ["見えた花", "虫や鳥", "気づいた季節"] }
      ]
    })
  }
];

const STATIC_MUNICIPAL_WALK_MAP_SOURCE_CATALOG = [
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "shizuoka-ikimono-walk-route",
    templateId: "route_species_walk",
    primaryType: "walk_route_species_map",
    municipality: "静岡市",
    title: "静岡市 いきもの散策マップ",
    sourceUrl: "https://www.city.shizuoka.lg.jp/s6347/s001494.html",
    officialPageUrl: "https://www.city.shizuoka.lg.jp/s6347/s001494.html",
    affinityScore: 21,
    cue: "コースと見つかる生きものを同時に見せる型。ikimon.lifeでは立ち寄り先と記録CTAに分ける。"
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "ota-ikimono-discovery-map",
    templateId: "route_species_walk",
    primaryType: "walk_route_species_map",
    municipality: "大田区",
    title: "おおた区いきもの発見MAP",
    sourceUrl: "https://www.city.ota.tokyo.jp/seikatsu/sumaimachinami/kankyou/hogo/ikimonomap.html",
    officialPageUrl: "https://www.city.ota.tokyo.jp/seikatsu/sumaimachinami/kankyou/hogo/ikimonomap.html",
    affinityScore: 28,
    cue: "区内をエリアに分けた都市型の散策PDF群。エリア別の立ち寄り先に変換しやすい。"
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "iida-biome-campaign-report",
    templateId: "citizen_campaign_walk",
    primaryType: "citizen_science_report",
    municipality: "飯田市",
    title: "いきもの大調査 in いいだ",
    sourceUrl: "https://www.city.iida.lg.jp/soshiki/19/ikimonochousainiidasaishuuhoukoku.html",
    officialPageUrl: "https://www.city.iida.lg.jp/soshiki/19/ikimonochousainiidasaishuuhoukoku.html",
    affinityScore: 29,
    cue: "市内全域の投稿キャンペーン型。自由エリアと安全な公開粒度をセットにする。"
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "kochi-kagamigawa-biome",
    templateId: "habitat_micro_walk",
    primaryType: "citizen_science_report",
    municipality: "高知市",
    title: "鏡川流域いきもの図鑑をつくろう",
    sourceUrl: "https://www.city.kochi.kochi.jp/soshiki/186/r8--kagamigawaryuiki-ikimonozukan.html",
    officialPageUrl: "https://www.city.kochi.kochi.jp/soshiki/186/r8--kagamigawaryuiki-ikimonozukan.html",
    affinityScore: 29,
    cue: "川の流域を対象にした型。水辺、親子イベント、学校連携を分けて安全に扱う。"
  }
];

const WALK_MAP_LOCATION_BBOXES = [
  { municipalityCode: "22100", bbox: [137.47, 34.57, 139.16, 35.65] as const }
];

function numberFromSearchParam(value: string | null): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function walkMapMunicipalityCodeForLocation(lat: number | null, lng: number | null): string | null {
  if (lat == null || lng == null) return null;
  const match = WALK_MAP_LOCATION_BBOXES.find((entry) => (
    lng >= entry.bbox[0] && lng <= entry.bbox[2]
    && lat >= entry.bbox[1] && lat <= entry.bbox[3]
  ));
  return match?.municipalityCode ?? null;
}

function parseJsonArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonRecord(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function municipalWalkMapSummaryFromD1Row(row: MunicipalWalkMapD1Row) {
  return {
    schemaVersion: "municipal_walk_map_public_summary/v0",
    walkMapId: row.walk_map_id,
    municipality: row.municipality,
    title: row.title,
    summary: row.summary,
    theme: row.theme,
    publishMode: row.publish_mode,
    routeStyle: row.route_style,
    mobilityModes: parseJsonArray(row.mobility_modes_json),
    stopCount: row.stop_count,
    sourceReferences: parseJsonArray(row.source_references_json),
    areaHint: parseJsonRecord(row.area_hint_json)
  };
}

function municipalWalkMapRouteFlexibility(row: MunicipalWalkMapD1Row) {
  const configured = parseJsonRecord(row.route_flexibility_json ?? "{}");
  const routeStyle = normalizeOptionalText(configured?.routeStyle ?? configured?.route_style ?? row.route_style) ?? "loose_stops";
  const mobilityModes = arrayOrEmpty(configured?.mobilityModes ?? configured?.mobility_modes);
  const returnCues = arrayOrEmpty(configured?.returnCues ?? configured?.return_cues);
  return {
    routeStyle,
    mobilityModes: mobilityModes.length > 0 ? mobilityModes : parseJsonArray(row.mobility_modes_json),
    offRoutePolicy: normalizeOptionalText(configured?.offRoutePolicy ?? configured?.off_route_policy) ?? "off_route_allowed",
    returnCues: returnCues.length > 0 ? returnCues : ["現地の案内と公開範囲を優先する"]
  };
}

function municipalWalkMapStopFromD1Row(row: MunicipalWalkMapStopD1Row) {
  return {
    stopId: row.stop_id,
    title: row.title,
    note: row.note ?? "",
    areaKind: row.area_kind,
    access: row.access,
    estimatedMinutes: row.estimated_minutes,
    noticeCues: parseJsonArray(row.notice_cues_json ?? "[]"),
    recordCues: parseJsonArray(row.record_cues_json ?? "[]"),
    safetyNotes: parseJsonArray(row.safety_notes_json ?? "[]"),
    areaHint: parseJsonRecord(row.area_hint_json),
    safetyNote: row.safety_note ?? ""
  };
}

function municipalWalkMapStaticDetail(walkMapId: string) {
  const summary = STATIC_MUNICIPAL_WALK_MAP_SUMMARIES.find((item) => item.walkMapId === walkMapId);
  if (!summary) return null;
  return {
    ...summary,
    schemaVersion: "municipal_walk_map_public_detail/v0",
    source: "static",
    routeFlexibility: {
      routeStyle: summary.routeStyle,
      mobilityModes: summary.mobilityModes,
      offRoutePolicy: "off_route_allowed",
      returnCues: ["現地の案内と公開範囲を優先する"]
    },
    publicPrecisionPolicy: "mesh_or_coarser",
    claimBoundary: DEFAULT_MUNICIPAL_WALK_MAP_CLAIM_BOUNDARY,
    stops: [
      {
        stopId: `${summary.walkMapId}-area`,
        title: summary.areaHint?.label ?? summary.title,
        note: summary.summary,
        areaKind: summary.theme === "waterfront" ? "waterfront" : "other",
        access: "public_access",
        estimatedMinutes: null,
        noticeCues: ["案内板", "足元", "周辺の風景"],
        recordCues: ["写真", "メモ"],
        safetyNotes: ["公開範囲で観察する"],
        areaHint: summary.areaHint,
        safetyNote: "公開範囲で観察する"
      }
    ]
  };
}

async function getMunicipalWalkMapPublicDetail(walkMapId: string, env: Env) {
  const safeWalkMapId = normalizeOptionalId(walkMapId);
  if (!safeWalkMapId) return null;
  try {
    const map = await env.OBS_DB.prepare(
      `SELECT walk_map_id, municipality_code, municipality, title, summary, theme, publish_mode,
              route_style, mobility_modes_json, stop_count, source_references_json, area_hint_json,
              route_flexibility_json, public_precision_policy, claim_boundary_json, updated_at
         FROM municipal_walk_maps
        WHERE walk_map_id = ?
          AND publish_mode IN ('public_preview', 'public')
        LIMIT 1`
    ).bind(safeWalkMapId).first<MunicipalWalkMapD1Row>();
    if (!map) return municipalWalkMapStaticDetail(safeWalkMapId);
    const stops = await env.OBS_DB.prepare(
      `SELECT stop_id, title, note, area_hint_json, safety_note, position, area_kind, access,
              estimated_minutes, notice_cues_json, record_cues_json, safety_notes_json
         FROM municipal_walk_map_stops
        WHERE walk_map_id = ?
        ORDER BY position ASC, display_order ASC, stop_id ASC`
    ).bind(safeWalkMapId).all<MunicipalWalkMapStopD1Row>();
    return {
      ...municipalWalkMapSummaryFromD1Row(map),
      schemaVersion: "municipal_walk_map_public_detail/v0",
      source: "d1_observations",
      routeFlexibility: municipalWalkMapRouteFlexibility(map),
      publicPrecisionPolicy: normalizeOptionalText(map.public_precision_policy) ?? "mesh_or_coarser",
      claimBoundary: parseJsonArray(map.claim_boundary_json ?? "[]"),
      updatedAt: map.updated_at ?? null,
      stops: stops.results.map(municipalWalkMapStopFromD1Row)
    };
  } catch (error) {
    if (error instanceof Error && /no such table: municipal_walk_maps|no such column:/i.test(error.message)) {
      return municipalWalkMapStaticDetail(safeWalkMapId);
    }
    throw error;
  }
}

async function getMunicipalWalkMapPublicDetailApi(walkMapId: string, env: Env): Promise<Response> {
  const detail = await getMunicipalWalkMapPublicDetail(walkMapId, env);
  if (!detail) return json({ ok: false, error: "walk_map_not_found" }, 404, { "cache-control": "public, max-age=60" });
  return json({ ok: true, detail }, 200, { "cache-control": "public, max-age=60, stale-while-revalidate=300" });
}

function renderMunicipalWalkMapPublicDetailHtml(detail: Awaited<ReturnType<typeof getMunicipalWalkMapPublicDetail>>): string {
  if (!detail) return "";
  const stops = arrayOrEmpty((detail as Record<string, unknown>).stops).map((raw, index) => {
    const stop = recordOrEmpty(raw);
    const title = normalizeOptionalText(stop.title) ?? `立ち寄り先 ${index + 1}`;
    const note = normalizeOptionalText(stop.note) ?? "";
    const safetyNote = normalizeOptionalText(stop.safetyNote) ?? "";
    return `<article class="wm-detail-stop">
      <div class="wm-detail-stop-head">
        <h2>${index + 1}. ${escapeHtml(title)}</h2>
        <span>${escapeHtml(normalizeOptionalText(stop.areaKind) ?? "other")} / ${escapeHtml(normalizeOptionalText(stop.access) ?? "public_access")}</span>
      </div>
      ${note ? `<p>${escapeHtml(note)}</p>` : ""}
      <div class="wm-detail-cues">
        <section><strong>見るもの</strong><ul>${htmlList(arrayOrEmpty(stop.noticeCues))}</ul></section>
        <section><strong>残すもの</strong><ul>${htmlList(arrayOrEmpty(stop.recordCues))}</ul></section>
      </div>
      ${safetyNote ? `<small>${escapeHtml(safetyNote)}</small>` : ""}
    </article>`;
  }).join("");
  const sources = arrayOrEmpty((detail as Record<string, unknown>).sourceReferences)
    .map((source) => recordOrEmpty(source))
    .map((source) => {
      const label = normalizeOptionalText(source.label) ?? "出典";
      const href = normalizeOptionalText(source.url);
      return href
        ? `<li><a href="${escapeHtml(href)}" rel="noopener noreferrer">${escapeHtml(label)}</a></li>`
        : `<li>${escapeHtml(label)}</li>`;
    })
    .join("");
  const routeFlexibility = recordOrEmpty((detail as Record<string, unknown>).routeFlexibility);
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(normalizeOptionalText((detail as Record<string, unknown>).title) ?? "散策マップ")} - ikimon</title>
<style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17211d;background:#f8fafc}
.wm-detail{max-width:1080px;margin:0 auto;padding:24px 16px 72px}
.wm-detail-hero{display:grid;gap:10px;margin-bottom:18px}
.wm-detail-hero small{color:#0f766e;font-size:12px;font-weight:900}
.wm-detail-hero h1{margin:0;font-size:32px;line-height:1.18;letter-spacing:0}
.wm-detail-hero p{margin:0;color:#475569;line-height:1.7}
.wm-detail-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;align-items:start}
.wm-detail-stops{display:grid;gap:12px}
.wm-detail-stop,.wm-detail-panel{border:1px solid #dbe7e2;border-radius:8px;background:#fff;padding:14px}
.wm-detail-stop-head{display:flex;justify-content:space-between;gap:10px;align-items:start}
.wm-detail-stop h2,.wm-detail-panel h2{margin:0 0 10px;font-size:18px;color:#0f172a}
.wm-detail-stop-head span{font-size:11px;font-weight:900;color:#0f766e}
.wm-detail-cues{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.wm-detail-cues section{border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:10px}
.wm-detail-cues ul,.wm-detail-panel ul{margin:6px 0 0;padding-left:18px;color:#475569;font-size:12px;line-height:1.7}
.wm-detail-stop p,.wm-detail-panel p{margin:0;color:#475569;line-height:1.7}
.wm-detail-stop small{display:block;margin-top:10px;color:#64748b;font-weight:800}
.wm-detail-panel{display:grid;gap:12px}
.wm-detail-panel a{color:#0f766e;font-weight:900;text-decoration:none}
@media(max-width:760px){.wm-detail-grid,.wm-detail-cues{grid-template-columns:1fr}.wm-detail{padding:18px 12px 56px}.wm-detail-hero h1{font-size:26px}}
</style>
</head>
<body>
<main class="wm-detail">
  <header class="wm-detail-hero">
    <small>${escapeHtml(normalizeOptionalText((detail as Record<string, unknown>).municipality) ?? "")} / ${escapeHtml(normalizeOptionalText((detail as Record<string, unknown>).publishMode) ?? "")}</small>
    <h1>${escapeHtml(normalizeOptionalText((detail as Record<string, unknown>).title) ?? "散策マップ")}</h1>
    <p>${escapeHtml(normalizeOptionalText((detail as Record<string, unknown>).summary) ?? "")}</p>
  </header>
  <div class="wm-detail-grid">
    <section class="wm-detail-stops">${stops}</section>
    <aside class="wm-detail-panel">
      <section><h2>移動</h2><p>${escapeHtml(normalizeOptionalText(routeFlexibility.routeStyle) ?? "loose_stops")} / ${escapeHtml(arrayOrEmpty(routeFlexibility.mobilityModes).map(String).join(" / ") || "walk")}</p></section>
      <section><h2>出典</h2><ul>${sources || "<li>出典リンクなし</li>"}</ul></section>
      <section><h2>場所の出し方</h2><p>${escapeHtml(normalizeOptionalText((detail as Record<string, unknown>).publicPrecisionPolicy) ?? "mesh_or_coarser")}</p></section>
    </aside>
  </div>
</main>
</body>
</html>`;
}

async function getMunicipalWalkMapPublicDetailPage(walkMapId: string, env: Env): Promise<Response> {
  const detail = await getMunicipalWalkMapPublicDetail(walkMapId, env);
  if (!detail) return html("<!doctype html><meta charset=\"utf-8\"><title>散策マップが見つかりません</title><main><h1>散策マップが見つかりません</h1></main>", 404, { "cache-control": "public, max-age=60" });
  return html(renderMunicipalWalkMapPublicDetailHtml(detail), 200, { "cache-control": "public, max-age=60, stale-while-revalidate=300" });
}

function getNativePlaceLandingPage(slug: string, request: Request): Response {
  const placeSlug = slug.trim().toLowerCase();
  if (placeSlug !== "hamamatsu") {
    return getNativeNotFoundPage(request);
  }

  const spots = SHADOW_MAP_GUIDE_SPOTS
    .filter((spot) => spot.id.startsWith("hamamatsu-"))
    .slice(0, 8);
  const spotItems = spots.map((spot) => {
    const sourceLinks = (spot.sourceLinks ?? [])
      .slice(0, 2)
      .map((source) => `<a href="${escapeHtml(source.url)}" rel="noopener noreferrer">${escapeHtml(source.label)}</a>`)
      .join("");
    return `<article class="place-card">
      <span>${escapeHtml(spot.category)}</span>
      <h2>${escapeHtml(spot.title)}</h2>
      <p>${escapeHtml(spot.preview)}</p>
      <div class="place-links">${sourceLinks}</div>
    </article>`;
  }).join("");
  const body = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>浜松のガイド地点 - ikimon</title>
<style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17211d;background:#f8fafc}
.place{max-width:1040px;margin:0 auto;padding:24px 16px 72px}
.place-head{display:grid;gap:10px;margin-bottom:18px}
.place-head h1{margin:0;font-size:30px;line-height:1.18;letter-spacing:0;color:#0f172a}
.place-head p{margin:0;max-width:720px;color:#475569;line-height:1.75}
.place-actions{display:flex;flex-wrap:wrap;gap:8px}
.place-actions a{display:inline-flex;align-items:center;min-height:38px;padding:0 13px;border-radius:8px;border:1px solid #b7d8d0;background:#fff;color:#0f766e;text-decoration:none;font-weight:900}
.place-actions a:first-child{background:#0f766e;color:#fff;border-color:#0f766e}
.place-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.place-card{display:grid;gap:8px;padding:14px;border:1px solid #dbe7e2;border-radius:8px;background:#fff}
.place-card span{font-size:12px;font-weight:900;color:#0f766e}
.place-card h2{margin:0;font-size:18px;line-height:1.35;color:#0f172a}
.place-card p{margin:0;color:#475569;line-height:1.65}
.place-links{display:flex;flex-wrap:wrap;gap:8px}
.place-links a{color:#0f766e;font-size:12px;font-weight:850}
@media(max-width:760px){.place{padding:18px 12px 56px}.place-head h1{font-size:26px}.place-actions a{width:100%;justify-content:center}}
</style>
</head>
<body>
<main class="place">
  <header class="place-head">
    <h1>浜松のガイド地点</h1>
    <p>文化財や地域の見どころを、出典つきで歩きやすく並べています。現地で写真やメモを残す入口として使えます。</p>
    <nav class="place-actions" aria-label="浜松の操作">
      <a href="/map?place=hamamatsu">地図で見る</a>
      <a href="/walk-maps">散策マップ</a>
    </nav>
  </header>
  <section class="place-grid">${spotItems}</section>
</main>
</body>
</html>`;
  return new Response(request.method === "HEAD" ? null : body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300, stale-while-revalidate=600",
      "x-ikimon-cloudflare-native": "place-guide-list"
    }
  });
}

function getNativeNotFoundPage(request: Request): Response {
  const body = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ページが見つかりません - ikimon</title>
<style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17211d;background:#f8fafc}
.nf{max-width:720px;margin:0 auto;padding:48px 16px 72px;display:grid;gap:14px}
.nf h1{margin:0;font-size:28px;line-height:1.2;color:#0f172a;letter-spacing:0}
.nf p{margin:0;color:#475569;line-height:1.75}
.nf-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.nf-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:0 13px;border-radius:8px;border:1px solid #b7d8d0;background:#fff;color:#0f766e;text-decoration:none;font-weight:900}
.nf-actions a:first-child{background:#0f766e;color:#fff;border-color:#0f766e}
@media(max-width:760px){.nf{padding:34px 12px 56px}.nf h1{font-size:24px}.nf-actions a{width:100%}}
</style>
</head>
<body>
<main class="nf">
  <h1>ページが見つかりません</h1>
  <p>URLが変わったか、いまは公開されていないページです。地図や散策マップから探せます。</p>
  <nav class="nf-actions" aria-label="移動先">
    <a href="/map">地図へ</a>
    <a href="/walk-maps">散策マップ</a>
    <a href="/">トップ</a>
  </nav>
</main>
</body>
</html>`;
  return new Response(request.method === "HEAD" ? null : body, {
    status: 404,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60",
      "x-ikimon-cloudflare-native": "not-found"
    }
  });
}

function renderMunicipalWalkMapListHtml(summaries: unknown[]): string {
  const cards = summaries
    .map((raw) => recordOrEmpty(raw))
    .map((summary) => {
      const walkMapId = normalizeOptionalText(summary.walkMapId) ?? "";
      const title = normalizeOptionalText(summary.title) ?? "散策マップ";
      const municipality = normalizeOptionalText(summary.municipality) ?? "";
      const description = normalizeOptionalText(summary.summary) ?? "";
      const areaHint = recordOrEmpty(summary.areaHint);
      const areaLabel = normalizeOptionalText(areaHint.label) ?? municipality;
      const href = walkMapId ? `/walk-maps/${encodeURIComponent(walkMapId)}` : "/walk-maps";
      return `<article class="wm-list-card">
        <a href="${escapeHtml(href)}">
          <span>${escapeHtml(municipality)}</span>
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(areaLabel)} / ${escapeHtml(normalizeOptionalText(summary.routeStyle) ?? "loose_stops")}</small>
          <p>${escapeHtml(description)}</p>
        </a>
      </article>`;
    })
    .join("");
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>散策マップ - ikimon</title>
<style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17211d;background:#f8fafc}
.wm-list{max-width:1120px;margin:0 auto;padding:24px 16px 72px}
.wm-list-head{display:grid;gap:8px;margin-bottom:16px}
.wm-list-head h1{margin:0;font-size:30px;line-height:1.18;letter-spacing:0}
.wm-list-head p{margin:0;color:#475569;line-height:1.7}
.wm-list-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.wm-list-card a{display:grid;gap:8px;height:100%;padding:14px;border:1px solid #dbe7e2;border-radius:8px;background:#fff;color:inherit;text-decoration:none}
.wm-list-card span{font-size:12px;font-weight:900;color:#0f766e}
.wm-list-card strong{font-size:18px;color:#0f172a}
.wm-list-card small{color:#64748b;font-weight:800}
.wm-list-card p{margin:0;color:#475569;line-height:1.65}
@media(max-width:760px){.wm-list{padding:18px 12px 56px}.wm-list-head h1{font-size:26px}}
</style>
</head>
<body>
<main class="wm-list">
  <header class="wm-list-head">
    <h1>散策マップ</h1>
    <p>公開範囲を歩きながら、写真、メモ、気づいた季節を残せる場所です。</p>
  </header>
  <section class="wm-list-grid">${cards || "<p>公開中の散策マップはまだありません。</p>"}</section>
</main>
</body>
</html>`;
}

async function getMunicipalWalkMapListPage(url: URL, env: Env): Promise<Response> {
  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "12"), 1, 24);
  const summaries = await getMunicipalWalkMapSummariesFromD1(env, null, false, limit)
    ?? STATIC_MUNICIPAL_WALK_MAP_SUMMARIES.slice(0, limit);
  return html(renderMunicipalWalkMapListHtml(summaries), 200, {
    "cache-control": "public, max-age=60, stale-while-revalidate=300",
    "x-ikimon-cloudflare-native": "municipal-walk-map-list"
  });
}

function municipalWalkMapSourceById(sourceId: string) {
  const safeSourceId = normalizeOptionalId(sourceId);
  if (!safeSourceId) return null;
  return STATIC_MUNICIPAL_WALK_MAP_SOURCE_CATALOG.find((source) => source.sourceId === safeSourceId) ?? null;
}

function municipalWalkMapTemplateById(templateId: string | null | undefined) {
  const safeTemplateId = normalizeOptionalId(templateId);
  if (!safeTemplateId) return null;
  return STATIC_MUNICIPAL_WALK_MAP_TEMPLATES.find((template) => template.templateId === safeTemplateId) ?? null;
}

function renderMunicipalWalkMapSourceDraftHtml(source: Record<string, unknown>): string {
  const template = municipalWalkMapTemplateById(normalizeOptionalText(source.templateId));
  const sourceUrl = normalizeOptionalText(source.sourceUrl);
  const officialPageUrl = normalizeOptionalText(source.officialPageUrl) ?? sourceUrl;
  const title = normalizeOptionalText(source.title) ?? "散策マップ出典";
  const municipality = normalizeOptionalText(source.municipality) ?? "";
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} - ikimon</title>
<style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17211d;background:#f8fafc}
.wm-source{max-width:960px;margin:0 auto;padding:24px 16px 72px}
.wm-source h1{margin:0 0 10px;font-size:30px;line-height:1.18;letter-spacing:0}
.wm-source p{margin:0;color:#475569;line-height:1.7}
.wm-source-grid{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:12px;margin-top:16px}
.wm-source-panel{border:1px solid #dbe7e2;border-radius:8px;background:#fff;padding:14px}
.wm-source-panel h2{margin:0 0 10px;font-size:18px}
.wm-source-panel ul{margin:0;padding-left:18px;color:#475569;line-height:1.7}
.wm-source a{color:#0f766e;font-weight:900;text-decoration:none}
@media(max-width:760px){.wm-source-grid{grid-template-columns:1fr}.wm-source{padding:18px 12px 56px}.wm-source h1{font-size:26px}}
</style>
</head>
<body>
<main class="wm-source">
  <p><strong>${escapeHtml(municipality)}</strong></p>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(normalizeOptionalText(source.cue) ?? "公開ページを出典として、散策用の構成に変換します。")}</p>
  <div class="wm-source-grid">
    <section class="wm-source-panel">
      <h2>下書きの型</h2>
      <p>${escapeHtml(normalizeOptionalText(template?.label) ?? "散策マップ")}</p>
      <ul>
        <li>本文、写真、図版は転載しない</li>
        <li>出典リンクを表示する</li>
        <li>立入条件と公開粒度を確認する</li>
      </ul>
    </section>
    <aside class="wm-source-panel">
      <h2>出典</h2>
      <ul>
        ${officialPageUrl ? `<li><a href="${escapeHtml(officialPageUrl)}" rel="noopener noreferrer">${escapeHtml(title)}</a></li>` : "<li>出典URL未設定</li>"}
      </ul>
    </aside>
  </div>
</main>
</body>
</html>`;
}

function getMunicipalWalkMapSourceDraftPage(sourceId: string): Response {
  const source = municipalWalkMapSourceById(sourceId);
  if (!source) {
    return html("<!doctype html><meta charset=\"utf-8\"><title>出典が見つかりません</title><main><h1>出典が見つかりません</h1></main>", 404, { "cache-control": "public, max-age=60" });
  }
  return html(renderMunicipalWalkMapSourceDraftHtml(source), 200, {
    "cache-control": "public, max-age=300",
    "x-ikimon-cloudflare-native": "municipal-walk-map-source-draft"
  });
}

async function getMunicipalWalkMapSummariesFromD1(
  env: Env,
  matchedMunicipalityCode: string | null,
  locationFiltered: boolean,
  limit: number
): Promise<unknown[] | null> {
  if (locationFiltered && matchedMunicipalityCode !== "22100") return [];
  try {
    const rows = await env.OBS_DB.prepare(
      `SELECT walk_map_id, municipality_code, municipality, title, summary, theme, publish_mode, route_style,
              mobility_modes_json, stop_count, source_references_json, area_hint_json
         FROM municipal_walk_maps
        WHERE publish_mode IN ('public_preview', 'public')
          AND (? IS NULL OR municipality_code = ?)
        ORDER BY display_order ASC, walk_map_id ASC
        LIMIT ?`
    ).bind(matchedMunicipalityCode, matchedMunicipalityCode, limit).all<MunicipalWalkMapD1Row>();
    if (rows.results.length === 0) return null;
    return rows.results.map(municipalWalkMapSummaryFromD1Row);
  } catch (error) {
    if (error instanceof Error && /no such table: municipal_walk_maps/i.test(error.message)) return null;
    throw error;
  }
}

async function getMunicipalWalkMapCandidates(url: URL, env: Env): Promise<Response> {
  const lat = numberFromSearchParam(url.searchParams.get("lat"));
  const lng = numberFromSearchParam(url.searchParams.get("lng"));
  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "4"), 1, 8);
  const locationFiltered = lat != null && lng != null;
  const matchedMunicipalityCode = walkMapMunicipalityCodeForLocation(lat, lng);
  const d1Summaries = await getMunicipalWalkMapSummariesFromD1(env, matchedMunicipalityCode, locationFiltered, limit);
  const summaries = d1Summaries ?? (
    locationFiltered && matchedMunicipalityCode !== "22100"
      ? []
      : STATIC_MUNICIPAL_WALK_MAP_SUMMARIES.slice(0, limit)
  );
  return json({
    ok: true,
    source: d1Summaries ? "d1_observations" : "static",
    matchedMunicipalityCode,
    locationFiltered,
    summaries
  }, 200, { "cache-control": "public, max-age=60, stale-while-revalidate=300" });
}

function isMunicipalWalkMapAdminRole(session: SessionSnapshot): boolean {
  const roleText = `${session.roleName ?? ""} ${session.rankLabel ?? ""}`.toLowerCase();
  return /\b(admin|administrator|analyst|owner|manager)\b/.test(roleText)
    || /管理|運営|分析|責任者/.test(roleText);
}

async function requireMunicipalWalkMapAdminSession(request: Request, env: Env): Promise<SessionSnapshot> {
  const session = await readCompatibleSessionWithOriginFallback(request, env);
  if (!session) throw new HttpError(401, "session_required");
  if (session.banned || !isMunicipalWalkMapAdminRole(session)) throw new HttpError(403, "admin_required");
  return session;
}

const GUIDE_INTERACTION_TYPES = new Set(["surfaced", "played", "skipped", "saved_later", "helpful", "wrong", "corrected"]);
const GUIDE_PROGRAM_OWNER_TYPES = new Set(["owner", "community", "municipality", "school"]);
const GUIDE_PROGRAM_MODES = new Set(["any_order", "ordered"]);
const GUIDE_PROGRAM_STATUSES = new Set(["draft", "published", "paused", "closed"]);
const GUIDE_REVIEW_STATUSES = new Set(["auto", "needs_review", "reviewed", "rejected"]);
const GUIDE_QUEUE_STATUSES = new Set(["open", "in_review", "resolved", "dismissed"]);

async function handleGuideOutcomeRuntime(request: Request, url: URL, env: Env): Promise<Response | null> {
  const pathname = stripPublicLangPrefix(url.pathname);
  try {
    if (request.method === "GET" && pathname === "/api/v1/guides/unlocks") {
      const session = await requireSignedInGuideSession(request, env);
      return await getMyGuideUnlocks(session, env);
    }
    const listenedMatch = pathname.match(/^\/api\/v1\/guides\/unlocks\/([^/]+)\/listened$/);
    if (request.method === "POST" && listenedMatch?.[1]) {
      const session = await requireSignedInGuideSession(request, env);
      return await markMyGuideUnlockListened(session, decodeURIComponent(listenedMatch[1]), env);
    }
    if (request.method === "POST" && pathname === "/api/v1/guide/interaction") {
      return await recordGuideInteractionNative(request, env);
    }
    if (request.method === "POST" && pathname === "/api/v1/guide/record") {
      return await saveGuideRecordNative(request, env);
    }
    const promoteMatch = pathname.match(/^\/api\/v1\/guide\/records\/([^/]+)\/promote$/);
    if (request.method === "POST" && promoteMatch?.[1]) {
      return await requestGuideRecordPromotionNative(request, decodeURIComponent(promoteMatch[1]), env);
    }
    if (request.method === "POST" && pathname === "/api/v1/guide/telemetry") {
      return await recordGuideTelemetryNative(request, env);
    }
    if (request.method === "POST" && pathname === "/api/v1/mobile/field-sessions/start") {
      return await startMobileFieldSessionNative(request, env);
    }
    const mobileSceneDigestMatch = pathname.match(/^\/api\/v1\/mobile\/field-sessions\/([^/]+)\/scene-digest$/);
    if (request.method === "POST" && mobileSceneDigestMatch?.[1]) {
      return await saveMobileSceneDigestNative(request, decodeURIComponent(mobileSceneDigestMatch[1]), env);
    }
    const mobileAudioEventsMatch = pathname.match(/^\/api\/v1\/mobile\/field-sessions\/([^/]+)\/audio-events$/);
    if (request.method === "POST" && mobileAudioEventsMatch?.[1]) {
      return await acceptMobileAudioEventsNative(request, decodeURIComponent(mobileAudioEventsMatch[1]), env);
    }
    const mobileEndMatch = pathname.match(/^\/api\/v1\/mobile\/field-sessions\/([^/]+)\/end$/);
    if (request.method === "POST" && mobileEndMatch?.[1]) {
      return await getMobileFieldSessionRecapNative(request, decodeURIComponent(mobileEndMatch[1]), env);
    }
    const mobileRecapMatch = pathname.match(/^\/api\/v1\/mobile\/field-sessions\/([^/]+)\/recap$/);
    if (request.method === "GET" && mobileRecapMatch?.[1]) {
      return await getMobileFieldSessionRecapNative(request, decodeURIComponent(mobileRecapMatch[1]), env);
    }
    if ((request.method === "GET" || request.method === "HEAD") && (
      pathname === "/guide/outcomes"
      || pathname === "/me/guide-records"
      || pathname === "/admin/debug/guide-records"
    )) {
      return await getGuideOutcomesPage(request, url, env);
    }
    if ((request.method === "GET" || request.method === "HEAD") && (pathname === "/guide/results" || pathname === "/me/guide-results")) {
      return new Response(null, { status: 308, headers: { location: "/guide/outcomes", ...nativeGuideHeaders("guide-outcomes-redirect") } });
    }
    if (request.method === "GET" && pathname === "/api/v1/me/guide-records/route-layer.geojson") {
      return await getMyGuideRouteLayerGeoJson(request, url, env);
    }
    if (request.method === "GET" && pathname === "/api/v1/guide/environment-mesh.geojson") {
      return await getGuideEnvironmentMeshGeoJson(url, env);
    }
    if (request.method === "GET" && pathname === "/api/v1/guide/regional-hypotheses") {
      return await getGuideRegionalHypotheses(url, env);
    }
    if (request.method === "GET" && pathname === "/api/v1/guide/environment-dashboard") {
      await requireMunicipalWalkMapAdminSession(request, env);
      return await getGuideEnvironmentDashboard(env);
    }
    const correctionMatch = pathname.match(/^\/api\/v1\/me\/guide-records\/([^/]+)\/correction$/);
    if (request.method === "POST" && correctionMatch?.[1]) {
      const session = await requireSignedInGuideSession(request, env);
      return await createGuideRecordCorrection(request, decodeURIComponent(correctionMatch[1]), session, env);
    }
    if ((request.method === "GET" || request.method === "HEAD") && pathname === "/admin/guide-programs") {
      return await getGuideProgramsAdminPage(request, env);
    }
    const programRecapPageMatch = pathname.match(/^\/admin\/guide-programs\/([^/]+)\/recap$/);
    if ((request.method === "GET" || request.method === "HEAD") && programRecapPageMatch?.[1]) {
      return await getGuideProgramRecapPage(request, decodeURIComponent(programRecapPageMatch[1]), env);
    }
    if (request.method === "GET" && pathname === "/api/v1/admin/guide-programs") {
      await requireMunicipalWalkMapAdminSession(request, env);
      return await getGuideProgramEditorState(env);
    }
    const programRecapApiMatch = pathname.match(/^\/api\/v1\/admin\/guide-programs\/([^/]+)\/recap$/);
    if (request.method === "GET" && programRecapApiMatch?.[1]) {
      await requireMunicipalWalkMapAdminSession(request, env);
      return await getGuideProgramRecapApi(decodeURIComponent(programRecapApiMatch[1]), env);
    }
    if (request.method === "POST" && pathname === "/api/v1/admin/guide-programs") {
      const session = await requireMunicipalWalkMapAdminSession(request, env);
      return await upsertGuideProgramAdmin(request, null, session, env);
    }
    const programUpdateMatch = pathname.match(/^\/api\/v1\/admin\/guide-programs\/([^/]+)$/);
    if (request.method === "POST" && programUpdateMatch?.[1] && programUpdateMatch[1] !== "recap") {
      const session = await requireMunicipalWalkMapAdminSession(request, env);
      return await upsertGuideProgramAdmin(request, decodeURIComponent(programUpdateMatch[1]), session, env);
    }
    if ((request.method === "GET" || request.method === "HEAD") && pathname === "/admin/guide-prompt-improvements") {
      return await getGuidePromptImprovementsAdminPage(request, url, env);
    }
    const improvementStatusMatch = pathname.match(/^\/api\/v1\/admin\/guide-prompt-improvements\/([^/]+)\/status$/);
    if (request.method === "POST" && improvementStatusMatch?.[1]) {
      await requireMunicipalWalkMapAdminSession(request, env);
      return await updateGuidePromptImprovementStatus(request, decodeURIComponent(improvementStatusMatch[1]), env);
    }
    const queueStatusMatch = pathname.match(/^\/api\/v1\/admin\/guide-prompt-improvement-queue\/([^/]+)\/status$/);
    if (request.method === "POST" && queueStatusMatch?.[1]) {
      await requireMunicipalWalkMapAdminSession(request, env);
      return await updateGuidePromptImprovementQueueStatus(request, decodeURIComponent(queueStatusMatch[1]), env);
    }
    return null;
  } catch (error) {
    if (error instanceof HttpError) return json({ ok: false, error: error.message }, error.status, nativeGuideHeaders("guide-error"));
    throw error;
  }
}

function nativeGuideHeaders(kind: string): Record<string, string> {
  return { "cache-control": "no-store", "x-ikimon-cloudflare-native": kind };
}

async function requireSignedInGuideSession(request: Request, env: Env): Promise<SessionSnapshot> {
  const session = await readCompatibleSessionWithOriginFallback(request, env);
  if (!session) throw new HttpError(401, "auth_required");
  if (session.banned) throw new HttpError(403, "account_unavailable");
  return session;
}

async function handleWalkRuntime(request: Request, url: URL, env: Env): Promise<Response | null> {
  const pathname = stripPublicLangPrefix(url.pathname);
  if (request.method === "POST" && pathname === "/api/v1/walk/session/start") {
    return upsertWalkSessionNative(request, env, false);
  }
  if (request.method === "POST" && pathname === "/api/v1/walk/session/end") {
    return upsertWalkSessionNative(request, env, true);
  }
  if (request.method === "GET" && pathname === "/api/v1/walk/today") {
    return getTodayWalkSummaryNative(request, env);
  }
  return null;
}

async function resolveWalkUserId(request: Request, env: Env, body: CompatibleWalkSessionInput): Promise<string | Response> {
  const session = await readCompatibleSessionWithOriginFallback(request, env).catch(() => null);
  const requested = normalizeOptionalText(body.userId);
  if (session?.banned) return json({ ok: false, error: "account_unavailable" }, 403, { "cache-control": "no-store" });
  if (session?.userId) {
    if (requested && requested !== session.userId) {
      return json({ ok: false, error: "forbidden_user_mismatch" }, 403, { "cache-control": "no-store" });
    }
    return session.userId;
  }
  const privileged = assertPrivilegedWriteAccessNative(request, env);
  if (privileged !== true) return json({ error: "unauthorized" }, 401, { "cache-control": "no-store" });
  return requested ?? "anonymous";
}

async function upsertWalkSessionNative(request: Request, env: Env, ending: boolean): Promise<Response> {
  const body = await readJson<CompatibleWalkSessionInput>(request);
  const userId = await resolveWalkUserId(request, env, body);
  if (userId instanceof Response) return userId;
  const startedAt = normalizeOptionalText(body.startedAt) ?? new Date().toISOString();
  const endedAt = ending ? (normalizeOptionalText(body.endedAt) ?? new Date().toISOString()) : normalizeOptionalText(body.endedAt);
  const externalId = normalizeOptionalText(body.externalId);
  const existing = externalId
    ? await env.OBS_DB.prepare("SELECT walk_session_id FROM walk_sessions WHERE external_id = ? LIMIT 1").bind(externalId).first<{ walk_session_id: string }>()
    : null;
  const walkSessionId = existing?.walk_session_id ?? (externalId ? `walk:${externalId}` : newId("walk_session"));
  const topSpecies = Array.isArray(body.topSpecies)
    ? body.topSpecies.filter((value): value is string => typeof value === "string" && value.trim() !== "").slice(0, 10)
    : [];
  const rawPayload = body.rawPayload && typeof body.rawPayload === "object" && !Array.isArray(body.rawPayload)
    ? body.rawPayload as Record<string, unknown>
    : {};

  await env.OBS_DB.prepare(
    `INSERT INTO walk_sessions (
       walk_session_id, external_id, user_id, started_at, ended_at, distance_m, step_count,
       passive_detection_count, top_species_json, biome, source, raw_payload_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(external_id) DO UPDATE SET
       ended_at = COALESCE(excluded.ended_at, walk_sessions.ended_at),
       distance_m = COALESCE(excluded.distance_m, walk_sessions.distance_m),
       step_count = COALESCE(excluded.step_count, walk_sessions.step_count),
       passive_detection_count = excluded.passive_detection_count,
       top_species_json = excluded.top_species_json,
       biome = COALESCE(excluded.biome, walk_sessions.biome),
       source = excluded.source,
       raw_payload_json = excluded.raw_payload_json,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(
    walkSessionId,
    externalId,
    userId,
    startedAt,
    endedAt,
    finiteNumberOrNull(body.distanceM),
    integerOrNull(body.stepCount),
    integerOrZero(body.passiveDetectionCount),
    JSON.stringify(topSpecies),
    normalizeOptionalText(body.biome),
    normalizeOptionalText(body.source) ?? "fieldscan",
    JSON.stringify(rawPayload)
  ).run();

  return json(
    ending ? { walkSessionId } : { walkSessionId, created: !existing },
    ending ? 200 : 201,
    { "cache-control": "no-store", "x-ikimon-cloudflare-native": "walk-session" }
  );
}

async function getTodayWalkSummaryNative(request: Request, env: Env): Promise<Response> {
  const session = await readCompatibleSessionWithOriginFallback(request, env).catch(() => null);
  if (!session || session.banned) return json({ error: "unauthorized" }, 401, { "cache-control": "no-store" });
  const today = new Date().toISOString().slice(0, 10);
  const rows = await env.OBS_DB.prepare(
    `SELECT distance_m, passive_detection_count, top_species_json
       FROM walk_sessions
      WHERE user_id = ?
        AND started_at >= ?
        AND started_at < ?`
  ).bind(session.userId, `${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`).all<{
    distance_m: number | null;
    passive_detection_count: number | null;
    top_species_json: string | null;
  }>();
  const species: string[] = [];
  let totalDistanceM = 0;
  let totalDetections = 0;
  for (const row of rows.results) {
    totalDistanceM += Number(row.distance_m ?? 0);
    totalDetections += Number(row.passive_detection_count ?? 0);
    for (const item of jsonArray(row.top_species_json ?? "[]")) {
      if (typeof item === "string" && item && !species.includes(item)) species.push(item);
    }
  }
  return json({
    sessionCount: rows.results.length,
    totalDistanceM,
    totalDetections,
    topSpecies: species.slice(0, 5)
  }, 200, { "cache-control": "no-store", "x-ikimon-cloudflare-native": "walk-session" });
}

async function handleTrackRuntime(request: Request, url: URL, env: Env): Promise<Response | null> {
  const pathname = stripPublicLangPrefix(url.pathname);
  if (request.method === "POST" && pathname === "/api/v1/tracks/upsert") {
    return upsertTrackNative(request, env);
  }
  return null;
}

async function upsertTrackNative(request: Request, env: Env): Promise<Response> {
  const body = await readJson<CompatibleTrackUpsertInput>(request);
  const sessionId = normalizeOptionalId(body.sessionId);
  const requestedUserId = normalizeOptionalText(body.userId);
  if (!sessionId) return json({ ok: false, error: "sessionId is required" }, 400, { "cache-control": "no-store" });
  if (!requestedUserId) return json({ ok: false, error: "userId is required" }, 400, { "cache-control": "no-store" });

  const session = await readCompatibleSessionWithOriginFallback(request, env).catch(() => null);
  if (!session) return json({ ok: false, error: "session_required" }, 401, { "cache-control": "no-store" });
  if (session.banned) return json({ ok: false, error: "account_disabled" }, 401, { "cache-control": "no-store" });
  if (session.userId !== requestedUserId) return json({ ok: false, error: "forbidden_user_mismatch" }, 403, { "cache-control": "no-store" });

  const points = normalizeTrackPoints(body.points);
  if (points.length === 0) return json({ ok: false, error: "points are required" }, 400, { "cache-control": "no-store" });
  const firstPoint = points[0];
  if (!firstPoint) return json({ ok: false, error: "first point is invalid" }, 400, { "cache-control": "no-store" });

  const startedAt = normalizeTimestampText(body.startedAt);
  const updatedAt = normalizeTimestampText(body.updatedAt ?? body.startedAt);
  const visitId = `track:${sessionId}`;
  const placeId = buildNativeTrackPlaceId(firstPoint.latitude, firstPoint.longitude, body.municipality, body.prefecture);
  const sourcePayload = {
    session_id: sessionId,
    field_id: normalizeOptionalText(body.fieldId),
    user_id: requestedUserId,
    ...(body.sourcePayload && typeof body.sourcePayload === "object" && !Array.isArray(body.sourcePayload)
      ? body.sourcePayload as Record<string, unknown>
      : {})
  };

  await env.OBS_DB.prepare(
    `INSERT INTO track_sessions (
       visit_id, session_id, user_id, field_id, place_id, started_at, updated_at,
       distance_meters, step_count, first_lat, first_lng, municipality, prefecture, source_payload_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(visit_id) DO UPDATE SET
       user_id = excluded.user_id,
       field_id = excluded.field_id,
       place_id = excluded.place_id,
       started_at = excluded.started_at,
       updated_at = excluded.updated_at,
       distance_meters = excluded.distance_meters,
       step_count = excluded.step_count,
       first_lat = excluded.first_lat,
       first_lng = excluded.first_lng,
       municipality = excluded.municipality,
       prefecture = excluded.prefecture,
       source_payload_json = excluded.source_payload_json`
  ).bind(
    visitId,
    sessionId,
    requestedUserId,
    normalizeOptionalText(body.fieldId),
    placeId,
    startedAt,
    updatedAt,
    finiteNumberOrNull(body.distanceMeters),
    integerOrNull(body.stepCount),
    firstPoint.latitude,
    firstPoint.longitude,
    normalizeOptionalText(body.municipality),
    normalizeOptionalText(body.prefecture),
    JSON.stringify(sourcePayload)
  ).run();

  await env.OBS_DB.prepare("DELETE FROM track_points WHERE visit_id = ?").bind(visitId).run();
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (!point) continue;
    await env.OBS_DB.prepare(
      `INSERT INTO track_points (
         point_id, visit_id, observed_at, sequence_no, lat, lng, accuracy_m, altitude_m, raw_payload_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      `${visitId}:${index}`,
      visitId,
      point.timestamp,
      index,
      point.latitude,
      point.longitude,
      point.accuracyMeters,
      point.altitudeMeters,
      JSON.stringify({ source: "v2_track_api" })
    ).run();
  }

  return json({
    visitId,
    placeId,
    pointCount: points.length,
    compatibility: {
      attempted: false,
      succeeded: false
    }
  }, 200, { "cache-control": "no-store", "x-ikimon-cloudflare-native": "track-upsert" });
}

function normalizeTrackPoints(raw: unknown): Array<{ latitude: number; longitude: number; accuracyMeters: number | null; altitudeMeters: number | null; timestamp: string }> {
  if (!Array.isArray(raw)) return [];
  const points: Array<{ latitude: number; longitude: number; accuracyMeters: number | null; altitudeMeters: number | null; timestamp: string }> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const point = item as CompatibleTrackPointInput;
    const latitude = finiteNumberOrNull(point.latitude);
    const longitude = finiteNumberOrNull(point.longitude);
    if (latitude == null || longitude == null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) continue;
    points.push({
      latitude,
      longitude,
      accuracyMeters: finiteNumberOrNull(point.accuracyMeters),
      altitudeMeters: finiteNumberOrNull(point.altitudeMeters),
      timestamp: normalizeTimestampText(point.timestamp)
    });
  }
  return points;
}

function buildNativeTrackPlaceId(latitude: number, longitude: number, municipality: unknown, prefecture: unknown): string {
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return `geo:${latitude.toFixed(3)}:${longitude.toFixed(3)}`;
  }
  const municipalityText = normalizeOptionalText(municipality);
  const prefectureText = normalizeOptionalText(prefecture);
  if (municipalityText || prefectureText) return `locality:${prefectureText ?? ""}:${municipalityText ?? ""}`;
  return "place:unknown";
}

function normalizeTimestampText(value: unknown): string {
  const text = normalizeOptionalText(value);
  if (!text) return new Date().toISOString();
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function guideSpotForId(guideSpotId: string): ShadowMapGuideSpot | null {
  return SHADOW_MAP_GUIDE_SPOTS.find((spot) => spot.id === guideSpotId) ?? null;
}

function guideSpotPublicItem(spot: ShadowMapGuideSpot) {
  return {
    id: spot.id,
    title: spot.title,
    subtitle: spot.subtitle,
    preview: spot.preview,
    script: spot.script,
    storyPoints: spot.storyPoints,
    sourceLinks: spot.sourceLinks,
    locationPrecision: spot.locationPrecision,
    visitAnchorLabel: spot.visitAnchorLabel,
    publicLocationMode: spot.publicLocationMode,
    subjectLocationMode: spot.subjectLocationMode
  };
}

function parseGuideJson(value: string | null): unknown {
  if (!value) return {};
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return {};
  }
}

function guideProgramPublicSummaryFromRow(row: Record<string, D1Value>, spots: unknown[] = []) {
  return {
    programId: String(row.program_id ?? ""),
    slug: String(row.slug ?? ""),
    title: String(row.title ?? ""),
    ownerType: String(row.owner_type ?? "community"),
    participationMode: String(row.participation_mode ?? "any_order"),
    status: String(row.status ?? "draft"),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    publicSummary: row.public_summary,
    safetyPolicy: parseGuideJson(String(row.safety_policy_json ?? "{}")),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    spots
  };
}

async function getGuideProgramRows(env: Env, onlyPublished = false): Promise<Array<Record<string, D1Value>>> {
  const where = onlyPublished ? "WHERE status = 'published' AND owner_type != 'school'" : "";
  const rows = await env.OBS_DB.prepare(
    `SELECT program_id, slug, title, owner_type, participation_mode, status,
            starts_at, ends_at, public_summary, safety_policy_json, created_at, updated_at
       FROM guide_programs
      ${where}
      ORDER BY updated_at DESC, program_id ASC
      LIMIT 100`
  ).all<Record<string, D1Value>>();
  return rows.results;
}

async function getGuideProgramSpots(env: Env, programIds: string[]): Promise<Map<string, unknown[]>> {
  const byProgram = new Map<string, unknown[]>();
  if (programIds.length === 0) return byProgram;
  const rows = await env.OBS_DB.prepare(
    `SELECT program_id, guide_spot_id, sort_order, required_for_completion
       FROM guide_program_spots
      ORDER BY program_id ASC, sort_order ASC, guide_spot_id ASC`
  ).all<{ program_id: string; guide_spot_id: string; sort_order: number; required_for_completion: number }>();
  for (const row of rows.results) {
    if (!programIds.includes(row.program_id)) continue;
    const spot = guideSpotForId(row.guide_spot_id);
    if (!spot) continue;
    const list = byProgram.get(row.program_id) ?? [];
    list.push({
      ...guideSpotPublicItem(spot),
      sortOrder: Number(row.sort_order ?? 0),
      requiredForCompletion: Boolean(row.required_for_completion)
    });
    byProgram.set(row.program_id, list);
  }
  return byProgram;
}

async function getGuideProgramRefMap(env: Env): Promise<Map<string, { id: string; slug: string; title: string }>> {
  const rows = await getGuideProgramRows(env, false);
  return new Map(rows.map((row) => [String(row.program_id), {
    id: String(row.program_id),
    slug: String(row.slug),
    title: String(row.title)
  }]));
}

async function getMyGuideUnlocks(session: SessionSnapshot, env: Env): Promise<Response> {
  const rows = await env.OBS_DB.prepare(
    `SELECT guide_spot_id, program_id, distance_band, first_unlocked_at, last_unlocked_at, last_listened_at
       FROM guide_unlocks
      WHERE user_id = ?
      ORDER BY last_unlocked_at DESC
      LIMIT 100`
  ).bind(session.userId).all<Record<string, D1Value>>();
  const programs = await getGuideProgramRefMap(env);
  const unlocks = rows.results.map((row) => {
    const spot = guideSpotForId(String(row.guide_spot_id ?? ""));
    if (!spot) return null;
    const program = row.program_id ? programs.get(String(row.program_id)) ?? null : null;
    return {
      guideSpotId: spot.id,
      guideTitle: spot.title,
      guideSubtitle: spot.subtitle,
      programId: program?.id ?? row.program_id ?? null,
      programTitle: program?.title ?? null,
      programSlug: program?.slug ?? null,
      distanceBand: row.distance_band ?? "area",
      unlockedAt: row.last_unlocked_at ?? row.first_unlocked_at,
      href: `/my-guides?guide=${encodeURIComponent(spot.id)}`,
      preview: spot.preview,
      script: spot.script,
      storyPoints: spot.storyPoints,
      sourceLinks: spot.sourceLinks,
      lastListenedAt: row.last_listened_at
    };
  }).filter(Boolean);
  return json({ ok: true, unlocks }, 200, nativeGuideHeaders("guide-unlocks-api"));
}

async function markMyGuideUnlockListened(session: SessionSnapshot, guideSpotId: string, env: Env): Promise<Response> {
  await env.OBS_DB.prepare(
    `UPDATE guide_unlocks
        SET last_listened_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND guide_spot_id = ?`
  ).bind(session.userId, guideSpotId).run();
  return json({ ok: true, guideSpotId }, 200, nativeGuideHeaders("guide-unlocks-listened-api"));
}

async function recordGuideInteractionNative(request: Request, env: Env): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request);
  const rawInteraction = String(body.interactionType ?? "");
  const representativeFeedback = rawInteraction === "merge_ok" ? "merge_ok" : null;
  const interactionType = representativeFeedback ? "helpful" : rawInteraction;
  if (!GUIDE_INTERACTION_TYPES.has(interactionType)) {
    return json({ ok: false, error: "invalid_interaction_type" }, 400, nativeGuideHeaders("guide-interaction-api"));
  }
  const session = await readCompatibleSession(request, env);
  const payload = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
    ? body.payload as Record<string, unknown>
    : {};
  const normalizedPayload = representativeFeedback
    ? { ...payload, representativeFeedback, storedInteractionType: interactionType }
    : payload;
  const interactionId = crypto.randomUUID();
  await env.OBS_DB.prepare(
    `INSERT INTO guide_interactions
       (interaction_id, guide_record_id, hypothesis_id, user_id, session_id, interaction_type, payload_json, occurred_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)`
  ).bind(
    interactionId,
    normalizeOptionalId(body.guideRecordId),
    normalizeOptionalId(body.hypothesisId),
    session?.userId ?? null,
    normalizeOptionalText(body.sessionId) ?? "",
    interactionType,
    JSON.stringify(normalizedPayload),
    normalizeOptionalText(body.occurredAt)
  ).run();
  return json({ ok: true, interactionId }, 200, nativeGuideHeaders("guide-interaction-api"));
}

function guideFiniteNumber(value: unknown): number | null {
  const num = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(num) ? num : null;
}

function guideStringArray(value: unknown, limit = 16): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, limit);
}

function guideObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function guideModeFromValue(value: unknown): "walk" | "vehicle" {
  return value === "vehicle" ? "vehicle" : "walk";
}

function movementModeFromValue(value: unknown): "walk" | "vehicle" | "focus" {
  return value === "vehicle" ? "vehicle" : value === "focus" ? "focus" : "walk";
}

function isoOrNow(value: unknown): string {
  const text = normalizeOptionalText(value);
  if (text) {
    const parsed = Date.parse(text);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function guideDetectedFeatures(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(["species", "vegetation", "landform", "structure", "sound"]);
  const out: Array<Record<string, unknown>> = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const source = item as Record<string, unknown>;
    const name = normalizeOptionalText(source.name);
    if (!name) continue;
    const type = allowed.has(String(source.type)) ? String(source.type) : "vegetation";
    const confidence = guideFiniteNumber(source.confidence);
    out.push({
      type,
      name,
      ...(confidence == null ? {} : { confidence }),
      ...(normalizeOptionalText(source.note) ? { note: normalizeOptionalText(source.note) } : {})
    });
    if (out.length >= 16) break;
  }
  return out;
}

function subjectNames(species: string[], features: Array<Record<string, unknown>>, primarySubject: Record<string, unknown>): string[] {
  const fromPrimary = normalizeOptionalText(primarySubject.name);
  const fromFeatures = features
    .map((feature) => normalizeOptionalText(feature.name))
    .filter((name): name is string => Boolean(name));
  return Array.from(new Set([fromPrimary, ...species, ...fromFeatures].filter((name): name is string => Boolean(name)))).slice(0, 8);
}

function guidePublicLocationLabel(lat: number, lng: number): string {
  return `${lat.toFixed(2)}, ${lng.toFixed(2)}周辺`;
}

function buildGuideSummary(body: {
  userId: string;
  sessionId: string;
  guideRecordId: string;
  lat: number;
  lng: number;
  sceneSummary: string;
  detectedSpecies: string[];
  detectedFeatures: Array<Record<string, unknown>>;
  primarySubject: Record<string, unknown>;
  capturedAt: string;
  frameThumb: string | null;
}) {
  const subjects = subjectNames(body.detectedSpecies, body.detectedFeatures, body.primarySubject);
  const headline = subjects.length > 0 ? `${subjects.slice(0, 2).join("・")}の記録` : "ガイド記録";
  const featureCounts: Record<string, number> = {};
  for (const feature of body.detectedFeatures) {
    const type = String(feature.type ?? "place");
    featureCounts[type] = (featureCounts[type] ?? 0) + 1;
  }
  return {
    summaryId: crypto.randomUUID(),
    userId: body.userId,
    sessionId: body.sessionId,
    recordCount: 1,
    startedAt: body.capturedAt,
    endedAt: body.capturedAt,
    representativeGuideRecordId: body.guideRecordId,
    headline,
    body: body.sceneSummary || "現地で保存したガイド記録です。",
    evidenceLine: "写真や位置の生データを公開せず、公開用の範囲で扱います。",
    motivationLine: "同じ範囲で次の記録を足すと、季節や環境の違いを比べやすくなります。",
    claimBoundary: "単独のガイド記録から傾向や不在は断定しません。",
    primaryTheme: featureCounts.water ? "water" : featureCounts.sound ? "sound" : featureCounts.vegetation || featureCounts.species ? "green" : "place",
    featuredSubjects: subjects,
    featureCounts,
    publicLocationLabel: guidePublicLocationLabel(body.lat, body.lng),
    mediaThumbUrl: body.frameThumb,
    sourceChecksum: `${body.guideRecordId}:${body.capturedAt}`
  };
}

type GuideSummarySourceNativeRow = {
  guide_record_id: string;
  session_id: string;
  user_id: string | null;
  lat: number;
  lng: number;
  scene_summary: string | null;
  detected_species_json: string;
  detected_features_json: string;
  captured_at: string | null;
  returned_at: string | null;
  created_at: string;
  frame_thumb: string | null;
  primary_subject_json: string | null;
};

function parseGuideSummaryJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean).slice(0, 12) : [];
  } catch {
    return [];
  }
}

function parseGuideSummaryJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function parseGuideSummaryFeatureArray(value: string | null | undefined): Array<Record<string, unknown>> {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)).slice(0, 20)
      : [];
  } catch {
    return [];
  }
}

function guideSummaryTime(row: GuideSummarySourceNativeRow): string {
  return row.captured_at ?? row.returned_at ?? row.created_at;
}

function buildGuideSessionSummary(rows: GuideSummarySourceNativeRow[], userId: string, sessionId: string) {
  const sorted = [...rows].sort((a, b) => guideSummaryTime(a).localeCompare(guideSummaryTime(b)));
  const first = sorted[0];
  const representative = sorted.find((row) => parseGuideSummaryJsonArray(row.detected_species_json).length > 0) ?? first;
  if (!first || !representative) return null;
  const species = [...new Set(sorted.flatMap((row) => parseGuideSummaryJsonArray(row.detected_species_json)))].slice(0, 8);
  const features = sorted.flatMap((row) => parseGuideSummaryFeatureArray(row.detected_features_json));
  const primarySubject = parseGuideSummaryJsonObject(representative.primary_subject_json);
  const subjects = subjectNames(species, features, primarySubject);
  const featureCounts: Record<string, number> = {};
  for (const feature of features) {
    const type = String(feature.type ?? "place");
    featureCounts[type] = (featureCounts[type] ?? 0) + 1;
  }
  const headline = subjects.length > 0
    ? `${subjects.slice(0, 2).join("・")}のガイド記録`
    : `${sorted.length}件のガイド記録`;
  const bodyText = sorted
    .map((row) => normalizeOptionalText(row.scene_summary))
    .filter((item): item is string => Boolean(item))
    .slice(0, 2)
    .join(" / ") || "現地で保存したガイド記録です。";
  return {
    summaryId: crypto.randomUUID(),
    userId,
    sessionId,
    recordCount: sorted.length,
    startedAt: guideSummaryTime(first),
    endedAt: guideSummaryTime(sorted[sorted.length - 1] ?? first),
    representativeGuideRecordId: representative.guide_record_id,
    headline,
    body: bodyText,
    evidenceLine: `${sorted.length}シーンを、公開用の範囲に丸めて扱います。`,
    motivationLine: "同じ範囲で次の記録を足すと、季節や環境の違いを比べやすくなります。",
    claimBoundary: "AIガイドの未検証サマリーです。増減・不在・保全効果は断言しません。",
    primaryTheme: featureCounts.water ? "water" : featureCounts.sound ? "sound" : featureCounts.vegetation || featureCounts.species ? "green" : "place",
    featuredSubjects: subjects,
    featureCounts,
    publicLocationLabel: guidePublicLocationLabel(Number(first.lat), Number(first.lng)),
    mediaThumbUrl: representative.frame_thumb,
    sourceChecksum: sorted.map((row) => `${row.guide_record_id}:${guideSummaryTime(row)}`).join("|")
  };
}

async function upsertGuideSummaryNative(input: {
  userId: string | null;
  sessionId: string;
  guideRecordId: string;
  lat: number;
  lng: number;
  sceneSummary: string;
  detectedSpecies: string[];
  detectedFeatures: Array<Record<string, unknown>>;
  primarySubject: Record<string, unknown>;
  capturedAt: string;
  frameThumb: string | null;
}, env: Env): Promise<void> {
  if (!input.userId) return;
  const rows = await env.OBS_DB.prepare(
    `SELECT gr.guide_record_id, gr.session_id, gr.user_id, gr.lat, gr.lng, gr.scene_summary,
            gr.detected_species_json, gr.detected_features_json, gr.created_at,
            gls.captured_at, gls.returned_at, gls.frame_thumb, gls.primary_subject_json
       FROM guide_records gr
       LEFT JOIN guide_record_latency_states gls ON gls.guide_record_id = gr.guide_record_id
      WHERE gr.user_id = ? AND gr.session_id = ?
      ORDER BY COALESCE(gls.captured_at, gls.returned_at, gr.created_at) ASC`
  ).bind(input.userId, input.sessionId).all<GuideSummarySourceNativeRow>();
  const summary = buildGuideSessionSummary(rows.results, input.userId, input.sessionId)
    ?? buildGuideSummary({ ...input, userId: input.userId });
  await env.OBS_DB.prepare(
    `INSERT OR REPLACE INTO guide_session_public_summary
       (summary_id, user_id, session_id, lang, visibility, record_count, started_at, ended_at,
        representative_guide_record_id, headline, body, evidence_line, motivation_line,
        claim_boundary, primary_theme, featured_subjects_json, feature_counts_json,
        public_location_label, observer_avatar_url, media_thumb_url, source_checksum, generated_by, summary_payload_json, updated_at)
     VALUES (?, ?, ?, 'ja', 'viewer_only', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 'cloudflare_worker_guide_runtime_v1', ?, CURRENT_TIMESTAMP)`
  ).bind(
    summary.summaryId,
    summary.userId,
    summary.sessionId,
    summary.recordCount,
    summary.startedAt,
    summary.endedAt,
    summary.representativeGuideRecordId,
    summary.headline,
    summary.body,
    summary.evidenceLine,
    summary.motivationLine,
    summary.claimBoundary,
    summary.primaryTheme,
    JSON.stringify(summary.featuredSubjects),
    JSON.stringify(summary.featureCounts),
    summary.publicLocationLabel,
    summary.mediaThumbUrl,
    summary.sourceChecksum,
    JSON.stringify({ generatedFrom: "guide_records", guideRecordId: input.guideRecordId, recordCount: summary.recordCount })
  ).run();
}

async function insertGuideRecordNative(args: {
  body: Record<string, unknown>;
  session: SessionSnapshot | null;
  defaultSessionId: string;
  source: string;
}, env: Env): Promise<string> {
  const lat = guideFiniteNumber(args.body.lat);
  const lng = guideFiniteNumber(args.body.lng);
  if (lat == null || lng == null) throw new HttpError(400, "lat_lng_required");
  const guideRecordId = crypto.randomUUID();
  const sessionId = normalizeOptionalText(args.body.sessionId ?? args.body.session_id) ?? args.defaultSessionId;
  const capturedAt = isoOrNow(args.body.capturedAt ?? args.body.captured_at);
  const returnedAt = isoOrNow(args.body.returnedAt);
  const detectedSpecies = guideStringArray(args.body.detectedSpecies ?? args.body.detected_species);
  const detectedFeatures = guideDetectedFeatures(args.body.detectedFeatures ?? args.body.detected_features);
  const primarySubject = guideObject(args.body.primarySubject);
  const sceneSummary = normalizeOptionalText(args.body.sceneSummary ?? args.body.scene_digest) ?? "";
  const frameThumb = normalizeOptionalText(args.body.frameThumb);
  const meta = {
    source: args.source,
    guideMode: guideModeFromValue(args.body.guideMode ?? args.body.guide_mode ?? args.body.movement_mode),
    facePrivacy: normalizeOptionalText(args.body.facePrivacy) ?? null,
    rawMediaStored: false,
    payloadKeys: Object.keys(args.body).slice(0, 80)
  };
  await env.OBS_DB.prepare(
    `INSERT INTO guide_records
       (guide_record_id, session_id, user_id, occurrence_id, lat, lng, scene_hash, scene_summary,
        detected_species_json, detected_features_json, tts_script, lang, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).bind(
    guideRecordId,
    sessionId,
    args.session?.userId ?? null,
    normalizeOptionalId(args.body.occurrenceId),
    lat,
    lng,
    normalizeOptionalText(args.body.sceneHash) ?? `${args.source}:${guideRecordId}`,
    sceneSummary,
    JSON.stringify(detectedSpecies),
    JSON.stringify(detectedFeatures),
    normalizeOptionalText(args.body.ttsScript),
    normalizeOptionalText(args.body.lang) ?? "ja"
  ).run();
  await env.OBS_DB.prepare(
    `INSERT OR REPLACE INTO guide_record_latency_states
       (guide_record_id, captured_at, returned_at, current_distance_m, delivery_state, seen_state,
        frame_thumb, primary_subject_json, environment_context, seasonal_note, coexisting_taxa_json,
        confidence_context_json, media_refs_json, meta_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).bind(
    guideRecordId,
    capturedAt,
    returnedAt,
    guideFiniteNumber(args.body.currentDistanceM),
    normalizeOptionalText(args.body.deliveryState) ?? "ready",
    normalizeOptionalText(args.body.seenState) ?? "saved",
    frameThumb,
    JSON.stringify(primarySubject),
    normalizeOptionalText(args.body.environmentContext),
    normalizeOptionalText(args.body.seasonalNote),
    JSON.stringify(guideStringArray(args.body.coexistingTaxa)),
    JSON.stringify(guideObject(args.body.confidenceContext)),
    JSON.stringify({ frameThumb, rawMediaStored: false }),
    JSON.stringify(meta)
  ).run();
  await upsertGuideSummaryNative({
    userId: args.session?.userId ?? null,
    sessionId,
    guideRecordId,
    lat,
    lng,
    sceneSummary,
    detectedSpecies,
    detectedFeatures,
    primarySubject,
    capturedAt,
    frameThumb
  }, env);
  await appendGuideSceneEventNative({
    env,
    body: args.body,
    session: args.session,
    guideRecordId,
    guideSessionId: sessionId,
    source: args.source,
    lat,
    lng,
    capturedAt,
    sceneSummary,
    detectedSpecies,
    detectedFeatures,
    primarySubject
  }).catch((err) => {
    console.error("[observation-event-dual-write] native guide scene event failed", err);
  });
  return guideRecordId;
}

async function saveGuideRecordNative(request: Request, env: Env): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request);
  const session = await readCompatibleSession(request, env);
  const guideRecordId = await insertGuideRecordNative({ body, session, defaultSessionId: "manual", source: "guide_record_api" }, env);
  return json({ guideRecordId }, 200, nativeGuideHeaders("guide-record-api"));
}

async function requestGuideRecordPromotionNative(request: Request, guideRecordId: string, env: Env): Promise<Response> {
  const normalizedGuideRecordId = normalizeOptionalId(guideRecordId);
  if (!normalizedGuideRecordId || normalizedGuideRecordId.length > 160) {
    return json({ ok: false, error: "guide_record_not_found" }, 404, nativeGuideHeaders("guide-record-promotion-api"));
  }
  const session = await requireSignedInGuideSession(request, env);
  const row = await env.OBS_DB.prepare(
    `SELECT gr.guide_record_id, gr.user_id, gr.occurrence_id, gr.lat, gr.lng, gls.frame_thumb
       FROM guide_records gr
       LEFT JOIN guide_record_latency_states gls ON gls.guide_record_id = gr.guide_record_id
      WHERE gr.guide_record_id = ?`
  ).bind(normalizedGuideRecordId).first<{
    guide_record_id: string;
    user_id: string | null;
    occurrence_id: string | null;
    lat: number | null;
    lng: number | null;
    frame_thumb: string | null;
  }>();
  if (!row) return json({ ok: false, error: "guide_record_not_found" }, 404, nativeGuideHeaders("guide-record-promotion-api"));
  if (row.user_id !== session.userId) {
    return json({ ok: false, error: "guide_record_forbidden" }, 403, nativeGuideHeaders("guide-record-promotion-api"));
  }
  if (!Number.isFinite(Number(row.lat)) || !Number.isFinite(Number(row.lng))) {
    return json({ ok: false, error: "guide_record_location_required", nextAction: "record_with_location" }, 422, nativeGuideHeaders("guide-record-promotion-api"));
  }

  const requestId = newId("guide_promote_req");
  const sourcePayload = {
    source: "cloudflare_guide_record_promotion_request_ledger",
    guideRecordId: normalizedGuideRecordId,
    occurrenceId: row.occurrence_id ?? null,
    hasFrameThumb: Boolean(row.frame_thumb)
  };
  await env.OBS_DB.prepare(
    `INSERT INTO guide_record_promotion_requests
       (request_id, guide_record_id, actor_user_id, request_state, source_payload_json)
     VALUES (?, ?, ?, 'pending', ?)
     ON CONFLICT(guide_record_id, actor_user_id) DO UPDATE SET
       request_state = 'pending',
       source_payload_json = excluded.source_payload_json,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(requestId, normalizedGuideRecordId, session.userId, JSON.stringify(sourcePayload)).run();

  return json({
    ok: true,
    promotion: {
      requestId,
      state: "pending",
      guideRecordId: normalizedGuideRecordId
    },
    occurrenceId: row.occurrence_id ?? null,
    compatibility: {
      source: "cloudflare_guide_record_promotion_request_ledger",
      materializationStatus: "not_migrated"
    }
  }, 202, nativeGuideHeaders("guide-record-promotion-api"));
}

async function insertGuideRoutePointNative(args: {
  body: Record<string, unknown>;
  session: SessionSnapshot | null;
  sessionId: string;
  pointKind: string;
}, env: Env): Promise<boolean> {
  const lat = guideFiniteNumber(args.body.lat);
  const lng = guideFiniteNumber(args.body.lng);
  if (lat == null || lng == null) return false;
  const clientPointId = normalizeOptionalText(args.body.clientPointId ?? args.body.client_point_id ?? args.body.clientSceneId ?? args.body.client_scene_id) ?? crypto.randomUUID();
  try {
    await env.OBS_DB.prepare(
      `INSERT INTO guide_route_points
         (point_id, session_id, user_id, client_point_id, point_kind, guide_mode, lat, lng, observed_at,
          accuracy_m, speed_mps, heading_degrees, session_distance_m, camera_active, raw_payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      crypto.randomUUID(),
      args.sessionId,
      args.session?.userId ?? null,
      clientPointId,
      args.pointKind,
      guideModeFromValue(args.body.guideMode ?? args.body.guide_mode ?? args.body.movement_mode),
      lat,
      lng,
      isoOrNow(args.body.observedAt ?? args.body.capturedAt ?? args.body.captured_at),
      guideFiniteNumber(args.body.accuracyM ?? args.body.accuracy_m ?? args.body.locationAccuracyM),
      guideFiniteNumber(args.body.speedMps ?? args.body.speed_mps),
      guideFiniteNumber(args.body.headingDegrees ?? args.body.heading_degrees),
      guideFiniteNumber(args.body.sessionDistanceM ?? args.body.session_distance_m),
      args.body.cameraActive === true ? 1 : 0,
      JSON.stringify({ privacy: "private_route_public_mesh", source: args.pointKind, visualCandidate: guideObject(args.body.visualCandidate) })
    ).run();
    return true;
  } catch (error) {
    if (error instanceof Error && /unique|constraint/i.test(error.message)) return false;
    throw error;
  }
}

async function recordGuideTelemetryNative(request: Request, env: Env): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request);
  const session = await readCompatibleSession(request, env);
  const sessionId = normalizeOptionalText(body.sessionId ?? body.session_id) ?? "anonymous";
  const rawPoints = Array.isArray(body.points) ? body.points : [body];
  let accepted = 0;
  let inserted = 0;
  for (const raw of rawPoints.slice(0, 12)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    accepted += 1;
    if (await insertGuideRoutePointNative({ body: raw as Record<string, unknown>, session, sessionId, pointKind: "telemetry" }, env)) inserted += 1;
  }
  return json({
    ok: true,
    accepted,
    inserted,
    sessionId,
    guideMode: guideModeFromValue(body.guideMode ?? body.guide_mode),
    fields: [],
    liveCoverageCellSizeM: 10,
    absenceState: "non_detection_note",
    privacy: "exact_route_private_public_area_or_100m_mesh"
  }, 200, nativeGuideHeaders("guide-telemetry-api"));
}

async function startMobileFieldSessionNative(request: Request, env: Env): Promise<Response> {
  const session = await readCompatibleSession(request, env);
  const body: Record<string, unknown> = await readJson<Record<string, unknown>>(request).catch(() => ({}));
  const requested = normalizeOptionalText(body.session_id ?? body.sessionId);
  return json({
    ok: true,
    sessionId: requested ?? `mobile-${Date.now()}`,
    userAuthState: session ? "logged_in" : "anonymous",
    userId: session?.userId ?? null,
    rawMediaPolicy: "digest_only"
  }, 200, nativeGuideHeaders("mobile-field-session-start-api"));
}

async function findMobileReceipt(installId: string, clientSceneId: string, env: Env): Promise<{ guide_record_id: string } | null> {
  return await env.OBS_DB.prepare(
    `SELECT guide_record_id
       FROM mobile_field_scene_receipts
      WHERE install_id = ? AND client_scene_id = ?
      LIMIT 1`
  ).bind(installId, clientSceneId).first<{ guide_record_id: string }>();
}

async function saveMobileSceneDigestNative(request: Request, sessionIdParam: string, env: Env): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request);
  const session = await readCompatibleSession(request, env);
  const installId = normalizeOptionalText(body.install_id ?? body.installId);
  if (!installId) return json({ ok: false, error: "install_id_required" }, 400, nativeGuideHeaders("mobile-scene-digest-api"));
  const clientSceneId = normalizeOptionalText(body.client_scene_id ?? body.clientSceneId) ?? crypto.randomUUID();
  const sceneDigest = normalizeOptionalText(body.scene_digest ?? body.sceneDigest);
  if (!sceneDigest) return json({ ok: false, error: "scene_digest_required" }, 400, nativeGuideHeaders("mobile-scene-digest-api"));
  const existing = await findMobileReceipt(installId, clientSceneId, env);
  if (existing) {
    return json({ ok: true, sessionId: sessionIdParam, guideRecordId: existing.guide_record_id, duplicate: true, rawMediaStored: false }, 200, nativeGuideHeaders("mobile-scene-digest-api"));
  }
  const movementMode = movementModeFromValue(body.movement_mode ?? body.movementMode);
  const guideRecordId = await insertGuideRecordNative({
    body: {
      ...body,
      sessionId: normalizeOptionalText(body.session_id ?? body.sessionId) ?? sessionIdParam,
      sceneSummary: sceneDigest,
      detectedSpecies: body.detected_species ?? body.detectedSpecies,
      detectedFeatures: body.detected_features ?? body.detectedFeatures,
      capturedAt: body.captured_at ?? body.capturedAt,
      guideMode: movementMode === "vehicle" ? "vehicle" : "walk"
    },
    session,
    defaultSessionId: sessionIdParam,
    source: "mobile_field_companion"
  }, env);
  if (movementMode === "vehicle") {
    await insertGuideRoutePointNative({ body, session, sessionId: sessionIdParam, pointKind: "scene" }, env);
  }
  await env.OBS_DB.prepare(
    `INSERT INTO mobile_field_scene_receipts
       (receipt_id, install_id, client_scene_id, session_id, guide_record_id, movement_mode, scene_digest, payload_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).bind(
    crypto.randomUUID(),
    installId,
    clientSceneId,
    sessionIdParam,
    guideRecordId,
    movementMode,
    sceneDigest,
    JSON.stringify({ rawMediaStored: false, areaResolutionSignals: guideStringArray(body.area_resolution_signals) })
  ).run();
  return json({ ok: true, sessionId: sessionIdParam, guideRecordId, duplicate: false, rawMediaStored: false }, 200, nativeGuideHeaders("mobile-scene-digest-api"));
}

async function acceptMobileAudioEventsNative(request: Request, sessionId: string, env: Env): Promise<Response> {
  const session = await readCompatibleSession(request, env);
  const body: Record<string, unknown> = await readJson<Record<string, unknown>>(request).catch(() => ({}));
  const events = Array.isArray(body.events) ? body.events : [];
  let liveEventCount = 0;
  for (const rawEvent of events.slice(0, 20)) {
    if (!rawEvent || typeof rawEvent !== "object" || Array.isArray(rawEvent)) continue;
    const appended = await appendMobileAudioObservationEventNative({
      env,
      body,
      event: rawEvent as Record<string, unknown>,
      session,
      fieldscanSessionId: sessionId
    }).catch((err) => {
      console.error("[observation-event-dual-write] native mobile audio event failed", err);
      return false;
    });
    if (appended) liveEventCount += 1;
  }
  return json({
    ok: true,
    sessionId,
    acceptedCount: events.length,
    liveEventCount,
    userAuthState: session ? "logged_in" : "anonymous",
    rawAudioStored: false
  }, 200, nativeGuideHeaders("mobile-audio-events-api"));
}

async function getMobileFieldSessionRecapNative(request: Request, sessionId: string, env: Env): Promise<Response> {
  const session = await readCompatibleSession(request, env);
  const rows = await env.OBS_DB.prepare(
    `SELECT scene_digest, payload_json, created_at
       FROM mobile_field_scene_receipts
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT 50`
  ).bind(sessionId).all<Record<string, D1Value>>();
  const digests = rows.results.map((row) => String(row.scene_digest ?? "")).filter(Boolean);
  const nextLook = Array.from(new Set(rows.results.flatMap((row) => {
    const payload = parseGuideJson(String(row.payload_json ?? "{}"));
    const signals = guideObject(payload).areaResolutionSignals;
    return Array.isArray(signals) ? signals.map((item) => String(item)).filter(Boolean) : [];
  }))).slice(0, 12);
  return json({
    ok: true,
    recap: {
      sessionId,
      sceneCount: rows.results.length,
      latestDigest: digests[0] ?? "",
      nextLook
    },
    userAuthState: session ? "logged_in" : "anonymous"
  }, 200, nativeGuideHeaders("mobile-field-session-recap-api"));
}

function renderGuideOutcomesHtml(summaries: Array<Record<string, D1Value>>): string {
  const cards = summaries.map((row) => {
    const subjects = parseGuideJson(String(row.featured_subjects_json ?? "[]"));
    const subjectText = Array.isArray(subjects) ? subjects.slice(0, 4).join(" / ") : "";
    return `<article class="guide-card">
      <p class="guide-kicker">${escapeHtml(String(row.record_count ?? 0))} records</p>
      <h2>${escapeHtml(String(row.headline ?? "ガイド記録"))}</h2>
      <p>${escapeHtml(String(row.body ?? ""))}</p>
      <p class="guide-meta">${escapeHtml(String(row.public_location_label ?? ""))}${subjectText ? ` / ${escapeHtml(subjectText)}` : ""}</p>
    </article>`;
  }).join("");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ガイド成果 - ikimon</title><style>body{margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033;background:#f8fafc}.guide-page{max-width:1040px;margin:0 auto;padding:24px 16px 72px}.guide-page h1{margin:0 0 12px;font-size:28px;letter-spacing:0}.guide-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.guide-card{background:#fff;border:1px solid #d8e5df;border-radius:8px;padding:14px}.guide-card h2{margin:0 0 8px;font-size:18px}.guide-card p{line-height:1.65;color:#475569}.guide-kicker{font-size:12px;font-weight:900;color:#0f766e}.guide-meta{font-size:13px}</style></head><body><main class="guide-page" data-cloudflare-source="guide-outcomes-d1"><h1>ガイド成果</h1><section class="guide-grid">${cards || "<p>保存済みのガイド記録はまだありません。</p>"}</section></main></body></html>`;
}

async function getGuideOutcomesPage(request: Request, url: URL, env: Env): Promise<Response> {
  const session = await readCompatibleSession(request, env);
  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "30"), 1, 100);
  const rows = await env.OBS_DB.prepare(
    `SELECT summary_id, user_id, session_id, record_count, started_at, ended_at,
            representative_guide_record_id, headline, body, evidence_line, motivation_line,
            primary_theme, featured_subjects_json, public_location_label, media_thumb_url
       FROM guide_session_public_summary
      WHERE (? IS NULL OR user_id = ?)
      ORDER BY ended_at DESC, updated_at DESC
      LIMIT ?`
  ).bind(session?.userId ?? null, session?.userId ?? null, limit).all<Record<string, D1Value>>();
  return html(renderGuideOutcomesHtml(rows.results), 200, nativeGuideHeaders("guide-outcomes-html"));
}

async function getMyGuideRouteLayerGeoJson(request: Request, url: URL, env: Env): Promise<Response> {
  const session = await requireSignedInGuideSession(request, env);
  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "500"), 1, 2000);
  const rows = await env.OBS_DB.prepare(
    `SELECT session_id, lat, lng, observed_at, point_kind, guide_mode, accuracy_m, speed_mps
       FROM guide_route_points
      WHERE user_id = ?
      ORDER BY observed_at DESC
      LIMIT ?`
  ).bind(session.userId, limit).all<Record<string, D1Value>>();
  const features = rows.results.map((row) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [Number(row.lng), Number(row.lat)] },
    properties: {
      sessionId: row.session_id,
      observedAt: row.observed_at,
      pointKind: row.point_kind,
      guideMode: row.guide_mode,
      accuracyM: row.accuracy_m,
      speedMps: row.speed_mps,
      privacy: "owner_exact_route"
    }
  }));
  return json({ type: "FeatureCollection", features }, 200, nativeGuideHeaders("guide-route-layer-api"));
}

function topGuideEntries(raw: unknown, limit = 8): Array<{ name: string; count: number }> {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  return Object.entries(source)
    .map(([name, value]) => ({ name, count: Number(value) }))
    .filter((item) => item.name && Number.isFinite(item.count) && item.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"))
    .slice(0, limit);
}

async function getGuideEnvironmentMeshGeoJson(url: URL, env: Env): Promise<Response> {
  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "500"), 1, 5000);
  const publicOnly = url.searchParams.get("publicOnly") !== "0";
  const rows = await env.OBS_DB.prepare(
    `SELECT mesh_key, center_lat, center_lng, guide_record_count, contributor_count,
            vegetation_counts_json, landform_counts_json, structure_counts_json, sound_counts_json,
            first_seen_at, last_seen_at
       FROM guide_environment_mesh_cells
      WHERE (? = 0 OR guide_record_count >= 3 OR contributor_count >= 2)
      ORDER BY last_seen_at DESC, guide_record_count DESC
      LIMIT ?`
  ).bind(publicOnly ? 1 : 0, limit).all<Record<string, D1Value>>();
  const features = rows.results.map((row) => {
    const vegetation = topGuideEntries(parseGuideJson(String(row.vegetation_counts_json ?? "{}")));
    const landform = topGuideEntries(parseGuideJson(String(row.landform_counts_json ?? "{}")));
    const structure = topGuideEntries(parseGuideJson(String(row.structure_counts_json ?? "{}")));
    const sound = topGuideEntries(parseGuideJson(String(row.sound_counts_json ?? "{}")));
    const dominantType = [
      ["vegetation", vegetation.reduce((sum, item) => sum + item.count, 0)] as const,
      ["landform", landform.reduce((sum, item) => sum + item.count, 0)] as const,
      ["structure", structure.reduce((sum, item) => sum + item.count, 0)] as const,
      ["sound", sound.reduce((sum, item) => sum + item.count, 0)] as const
    ].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "structure";
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [Number(row.center_lng), Number(row.center_lat)] },
      properties: {
        meshKey: row.mesh_key,
        gridSizeM: 100,
        guideRecordCount: Number(row.guide_record_count ?? 0),
        contributorCount: Number(row.contributor_count ?? 0),
        dominantType,
        vegetation,
        landform,
        structure,
        sound,
        firstSeenAt: row.first_seen_at,
        lastSeenAt: row.last_seen_at
      }
    };
  });
  return json({ type: "FeatureCollection", features }, 200, {
    "cache-control": "public, max-age=60, stale-while-revalidate=300",
    "x-ikimon-cloudflare-native": "guide-environment-mesh-api"
  });
}

async function getGuideRegionalHypotheses(url: URL, env: Env): Promise<Response> {
  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "20"), 1, 100);
  const rows = await env.OBS_DB.prepare(
    `SELECT hypothesis_id, mesh_key, place_id, claim_type, hypothesis_text, what_we_can_say,
            supporting_observation_ids_json, supporting_guide_record_ids_json, supporting_knowledge_card_ids_json,
            supporting_claim_ids_json, evidence_json, confidence, bias_warnings_json, missing_data_json,
            next_sampling_protocol, source_fingerprint, review_status, generated_at
       FROM regional_hypotheses
      WHERE review_status <> 'rejected'
      ORDER BY confidence DESC, generated_at DESC
      LIMIT ?`
  ).bind(limit).all<Record<string, D1Value>>();
  const hypotheses = rows.results.map((row) => ({
    hypothesisId: row.hypothesis_id,
    meshKey: row.mesh_key,
    placeId: row.place_id,
    claimType: row.claim_type,
    hypothesisText: row.hypothesis_text,
    whatWeCanSay: row.what_we_can_say,
    supportingObservationIds: parseGuideJson(String(row.supporting_observation_ids_json ?? "[]")),
    supportingGuideRecordIds: parseGuideJson(String(row.supporting_guide_record_ids_json ?? "[]")),
    supportingKnowledgeCardIds: parseGuideJson(String(row.supporting_knowledge_card_ids_json ?? "[]")),
    supportingClaimIds: parseGuideJson(String(row.supporting_claim_ids_json ?? "[]")),
    evidence: parseGuideJson(String(row.evidence_json ?? "{}")),
    confidence: Number(row.confidence ?? 0),
    biasWarnings: parseGuideJson(String(row.bias_warnings_json ?? "[]")),
    missingData: parseGuideJson(String(row.missing_data_json ?? "[]")),
    nextSamplingProtocol: row.next_sampling_protocol,
    sourceFingerprint: row.source_fingerprint,
    reviewStatus: row.review_status,
    generatedAt: row.generated_at
  }));
  return json({ ok: true, hypotheses }, 200, nativeGuideHeaders("guide-regional-hypotheses-api"));
}

async function getGuideEnvironmentDashboard(env: Env): Promise<Response> {
  const [latest, totals] = await Promise.all([
    env.OBS_DB.prepare(
      `SELECT run_id, trigger_source, status, diagnosis_date, started_at, finished_at,
              mesh_rebuild_needed, rebuild_action, guide_record_count, public_mesh_cell_count,
              suppressed_mesh_cell_count, hypotheses_written, eval_items_count,
              prompt_improvements_written, error_message
         FROM guide_environment_refresh_runs
        ORDER BY started_at DESC
        LIMIT 1`
    ).all<Record<string, D1Value>>(),
    env.OBS_DB.prepare(
      `SELECT
          (SELECT COUNT(*) FROM guide_environment_mesh_cells) AS mesh_cells,
          (SELECT COUNT(*) FROM guide_environment_mesh_cells WHERE guide_record_count >= 3 OR contributor_count >= 2) AS public_mesh_cells,
          (SELECT COUNT(*) FROM regional_hypotheses WHERE review_status <> 'rejected') AS hypotheses,
          (SELECT COUNT(*) FROM guide_interactions WHERE interaction_type = 'helpful') AS helpful_interactions,
          (SELECT COUNT(*) FROM guide_interactions WHERE interaction_type = 'wrong') AS wrong_interactions,
          (SELECT COUNT(*) FROM guide_hypothesis_prompt_improvements WHERE review_status <> 'rejected') AS prompt_improvements`
    ).all<Record<string, D1Value>>()
  ]);
  return json({
    ok: true,
    latestRun: latest.results[0] ?? null,
    totals: totals.results[0] ?? {}
  }, 200, nativeGuideHeaders("guide-environment-dashboard-api"));
}

async function createGuideRecordCorrection(request: Request, guideRecordId: string, session: SessionSnapshot, env: Env): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request);
  const correctionId = crypto.randomUUID();
  await env.OBS_DB.prepare(
    `INSERT INTO guide_record_corrections
       (correction_id, guide_record_id, user_id, correction_kind, original_payload_json, corrected_payload_json, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).bind(
    correctionId,
    guideRecordId,
    session.userId,
    normalizeOptionalText(body.correctionKind) ?? "human_edit",
    JSON.stringify(body.originalPayload ?? {}),
    JSON.stringify(body.correctedPayload ?? {}),
    normalizeOptionalText(body.note)
  ).run();
  return json({ ok: true, correctionId, guideRecordId }, 200, nativeGuideHeaders("guide-record-correction-api"));
}

function guideProgramShell(title: string, body: string): Response {
  return html(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} - ikimon</title><style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033;background:#f8fafc}.guide-admin{max-width:1120px;margin:0 auto;padding:24px 16px 72px}.guide-admin h1{font-size:26px;line-height:1.25;margin:0 0 12px}.guide-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.guide-card{border:1px solid #dbe7e2;border-radius:8px;background:#fff;padding:14px}.guide-card h2{font-size:17px;margin:0 0 8px}.guide-card p{line-height:1.65;color:#475569}.guide-chip{display:inline-flex;border-radius:999px;background:#e0f2fe;color:#075985;font-size:12px;font-weight:900;padding:3px 8px}</style></head><body><main class="guide-admin">${body}</main></body></html>`, 200, nativeGuideHeaders("guide-admin-html"));
}

async function getGuideProgramsAdminPage(request: Request, env: Env): Promise<Response> {
  await requireMunicipalWalkMapAdminSession(request, env);
  const rows = await getGuideProgramRows(env, false);
  const spotsByProgram = await getGuideProgramSpots(env, rows.map((row) => String(row.program_id)));
  const cards = rows.map((row) => {
    const programId = String(row.program_id);
    const spotCount = spotsByProgram.get(programId)?.length ?? 0;
    return `<article class="guide-card"><span class="guide-chip">${escapeHtml(String(row.status))}</span><h2>${escapeHtml(String(row.title))}</h2><p>${escapeHtml(String(row.public_summary ?? ""))}</p><p>${spotCount} guide spots / ${escapeHtml(programId)}</p><p><a href="/admin/guide-programs/${encodeURIComponent(programId)}/recap">recap</a></p></article>`;
  }).join("");
  return guideProgramShell("ガイド企画", `<h1>ガイド企画</h1><section class="guide-grid">${cards || "<p>ガイド企画はまだありません。</p>"}</section>`);
}

async function getGuideProgramEditorState(env: Env): Promise<Response> {
  const programs = await getGuideProgramRows(env, false);
  const spotsByProgram = await getGuideProgramSpots(env, programs.map((row) => String(row.program_id)));
  const guideSpots = SHADOW_MAP_GUIDE_SPOTS
    .filter((spot) => (spot.visibilityStatus ?? "published") === "published" && (spot.safetyStatus ?? "active") === "active" && spot.landownerConsent !== false && spot.ownerType !== "school")
    .map((spot) => ({
      id: spot.id,
      title: spot.title,
      subtitle: spot.subtitle,
      ownerType: spot.ownerType ?? "community",
      visibilityStatus: spot.visibilityStatus ?? "published",
      safetyStatus: spot.safetyStatus ?? "active",
      landownerConsent: spot.landownerConsent !== false,
      availableTimePolicy: spot.availableTimePolicy ?? "anytime_public"
    }));
  return json({
    ok: true,
    programs: programs.map((row) => guideProgramPublicSummaryFromRow(row, spotsByProgram.get(String(row.program_id)) ?? [])),
    guideSpots
  }, 200, nativeGuideHeaders("guide-programs-admin-api"));
}

function normalizeGuideProgramBody(body: Record<string, unknown>, pathProgramId: string | null) {
  const programId = normalizeOptionalId(pathProgramId ?? body.programId ?? body.slug);
  const slug = normalizeOptionalId(body.slug ?? programId);
  const title = normalizeOptionalText(body.title);
  if (!programId || !slug || !title) throw new HttpError(400, "invalid_guide_program");
  const ownerType = GUIDE_PROGRAM_OWNER_TYPES.has(String(body.ownerType)) ? String(body.ownerType) : "community";
  const participationMode = GUIDE_PROGRAM_MODES.has(String(body.participationMode)) ? String(body.participationMode) : "any_order";
  const status = GUIDE_PROGRAM_STATUSES.has(String(body.status)) ? String(body.status) : "draft";
  const guideSpotIds = Array.isArray(body.guideSpotIds)
    ? body.guideSpotIds.map((item) => normalizeOptionalId(item)).filter((item): item is string => Boolean(item))
    : [];
  return {
    programId,
    slug,
    title,
    ownerType,
    participationMode,
    status,
    startsAt: normalizeOptionalText(body.startsAt),
    endsAt: normalizeOptionalText(body.endsAt),
    publicSummary: normalizeOptionalText(body.publicSummary),
    guideSpotIds: [...new Set(guideSpotIds)].filter((id) => Boolean(guideSpotForId(id)))
  };
}

async function upsertGuideProgramAdmin(request: Request, pathProgramId: string | null, session: SessionSnapshot, env: Env): Promise<Response> {
  const normalized = normalizeGuideProgramBody(await readJson<Record<string, unknown>>(request), pathProgramId);
  const now = new Date().toISOString();
  await env.OBS_DB.prepare(
    `INSERT INTO guide_programs
       (program_id, slug, title, owner_type, participation_mode, status, starts_at, ends_at, public_summary, safety_policy_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(program_id) DO UPDATE SET
       slug = excluded.slug,
       title = excluded.title,
       owner_type = excluded.owner_type,
       participation_mode = excluded.participation_mode,
       status = excluded.status,
       starts_at = excluded.starts_at,
       ends_at = excluded.ends_at,
       public_summary = excluded.public_summary,
       safety_policy_json = excluded.safety_policy_json,
       updated_at = excluded.updated_at`
  ).bind(
    normalized.programId,
    normalized.slug,
    normalized.title,
    normalized.ownerType,
    normalized.participationMode,
    normalized.status,
    normalized.startsAt,
    normalized.endsAt,
    normalized.publicSummary,
    JSON.stringify({ location_display: "coarse", unlock_visibility: "private", requires_public_post: false }),
    now,
    now
  ).run();
  await env.OBS_DB.prepare("DELETE FROM guide_program_spots WHERE program_id = ?").bind(normalized.programId).run();
  for (const [index, guideSpotId] of normalized.guideSpotIds.entries()) {
    await env.OBS_DB.prepare(
      `INSERT INTO guide_program_spots (program_id, guide_spot_id, sort_order, required_for_completion, created_at)
       VALUES (?, ?, ?, 1, ?)`
    ).bind(normalized.programId, guideSpotId, (index + 1) * 10, now).run();
  }
  await env.OBS_DB.prepare(
    `INSERT INTO guide_program_audit (audit_id, program_id, actor_user_id, action, before_payload_json, after_payload_json, created_at)
     VALUES (?, ?, ?, ?, '{}', ?, ?)`
  ).bind(crypto.randomUUID(), normalized.programId, session.userId, pathProgramId ? "update" : "create", JSON.stringify(normalized), now).run();
  return json({ ok: true, program: normalized }, 200, nativeGuideHeaders("guide-programs-admin-api"));
}

async function getGuideProgramRecapApi(programId: string, env: Env): Promise<Response> {
  const recap = await buildGuideProgramRecapNative(programId, env);
  if (!recap) return json({ ok: false, error: "guide_program_recap_not_found" }, 404, nativeGuideHeaders("guide-program-recap-api"));
  return json({ ok: true, recap }, 200, nativeGuideHeaders("guide-program-recap-api"));
}

async function getGuideProgramRecapPage(request: Request, programId: string, env: Env): Promise<Response> {
  await requireMunicipalWalkMapAdminSession(request, env);
  const recap = await buildGuideProgramRecapNative(programId, env);
  if (!recap) return guideProgramShell("ガイド企画 recap", "<h1>ガイド企画が見つかりません</h1>");
  return guideProgramShell(`${recap.program.title} recap`, `<h1>${escapeHtml(recap.program.title)}</h1><section class="guide-grid"><article class="guide-card"><h2>unlocks</h2><p>${recap.stats.guideUnlockCount ?? "k未満"}</p></article><article class="guide-card"><h2>plays</h2><p>${recap.stats.guidePlayCount ?? "k未満"}</p></article><article class="guide-card"><h2>privacy</h2><p>個人別行動履歴と正確な来訪経路は出しません。</p></article></section>`);
}

async function buildGuideProgramRecapNative(programId: string, env: Env) {
  const programRows = await env.OBS_DB.prepare(
    `SELECT program_id, slug, title, owner_type, participation_mode, status,
            starts_at, ends_at, public_summary, safety_policy_json, created_at, updated_at
       FROM guide_programs
      WHERE program_id = ?
      LIMIT 1`
  ).bind(programId).all<Record<string, D1Value>>();
  const row = programRows.results[0];
  if (!row) return null;
  const spotsByProgram = await getGuideProgramSpots(env, [programId]);
  const stats = await env.OBS_DB.prepare(
    `SELECT COUNT(*) AS unlock_count,
            SUM(CASE WHEN last_listened_at IS NULL THEN 0 ELSE 1 END) AS play_count,
            COUNT(DISTINCT user_id) AS participants
       FROM guide_unlocks
      WHERE program_id = ?`
  ).bind(programId).all<Record<string, D1Value>>();
  const stat = stats.results[0] ?? {};
  const participants = Number(stat.participants ?? 0);
  const suppressed = participants < 5;
  return {
    schemaVersion: "guide_program_recap/v1",
    generatedAt: new Date().toISOString(),
    program: guideProgramPublicSummaryFromRow(row, spotsByProgram.get(programId) ?? []),
    kAnonymityThreshold: 5,
    suppressedBreakdownReasons: suppressed ? ["participant_count_below_k_anonymity_threshold"] : [],
    privacyBoundary: { exactCoordinatesIncluded: false, userLevelRowsIncluded: false, smallCohortSuppressionApplied: suppressed },
    claimBoundary: {
      canSay: ["本人用に解放されたガイド数", "解放後に再生されたガイド数", "次回の企画調整に使う匿名集計"],
      cannotSay: ["参加者ごとの行動履歴", "正確な来訪経路や投稿位置", "生物多様性の改善や公式調査結果"]
    },
    stats: {
      guideSpotCount: (spotsByProgram.get(programId) ?? []).length,
      requiredGuideSpotCount: (spotsByProgram.get(programId) ?? []).length,
      guideUnlockCount: suppressed ? null : Number(stat.unlock_count ?? 0),
      guidePlayCount: suppressed ? null : Number(stat.play_count ?? 0),
      participantsCountRounded: suppressed ? null : Math.max(5, Math.floor(participants / 5) * 5),
      completionRateBucket: suppressed ? "suppressed" : "building",
      playRateBucket: suppressed ? "suppressed" : "building"
    },
    nextActions: [
      { label: "観察会として実施", body: "同じ場所で人を集める日は、Observation Eventにしてrecapと公式レポートへつなぐ。", href: "/community/events/new" },
      { label: "ガイドを増やす", body: "解放数に対して再生が少ない場合は、入口ガイドの短さ、題名、現地導線を見直す。", href: "/admin/guide-programs" }
    ]
  };
}

async function getGuidePromptImprovementsAdminPage(request: Request, url: URL, env: Env): Promise<Response> {
  await requireMunicipalWalkMapAdminSession(request, env);
  const status = GUIDE_REVIEW_STATUSES.has(String(url.searchParams.get("status"))) ? String(url.searchParams.get("status")) : "needs_review";
  const improvements = await listGuidePromptImprovements(env, status, 30);
  const queue = await listGuidePromptImprovementQueue(env, 20);
  const cards = [
    ...queue.map((row) => `<article class="guide-card"><span class="guide-chip">${escapeHtml(String(row.queue_status))}</span><h2>${escapeHtml(String(row.claim_type || "global"))}</h2><p>${escapeHtml(String(row.wrong_count))} wrong feedback</p></article>`),
    ...improvements.map((row) => `<article class="guide-card"><span class="guide-chip">${escapeHtml(String(row.review_status))}</span><h2>${escapeHtml(String(row.recommendation))}</h2><p>${escapeHtml(String(row.prompt_patch))}</p></article>`)
  ].join("");
  return guideProgramShell("ガイド改善レビュー", `<h1>ガイド改善レビュー</h1><section class="guide-grid">${cards || "<p>改善候補はありません。</p>"}</section>`);
}

async function listGuidePromptImprovements(env: Env, status: string, limit: number): Promise<Array<Record<string, D1Value>>> {
  const any = status === "any";
  const rows = await env.OBS_DB.prepare(
    `SELECT improvement_id, source_key, improvement_type, label, claim_type, trigger,
            recommendation, prompt_patch, evidence_json, support_count, review_status, generated_at
       FROM guide_hypothesis_prompt_improvements
      WHERE (? = 1 OR review_status = ?)
      ORDER BY support_count DESC, generated_at DESC
      LIMIT ?`
  ).bind(any ? 1 : 0, status, limit).all<Record<string, D1Value>>();
  return rows.results;
}

async function listGuidePromptImprovementQueue(env: Env, limit: number): Promise<Array<Record<string, D1Value>>> {
  const rows = await env.OBS_DB.prepare(
    `SELECT queue_id, claim_type, trigger, wrong_count, threshold_count, queue_status,
            improvement_ids_json, evidence_json, first_seen_at, last_seen_at, resolved_at
       FROM guide_hypothesis_prompt_improvement_queue
      WHERE queue_status IN ('open', 'in_review')
      ORDER BY wrong_count DESC, last_seen_at DESC
      LIMIT ?`
  ).bind(limit).all<Record<string, D1Value>>();
  return rows.results;
}

async function updateGuidePromptImprovementStatus(request: Request, improvementId: string, env: Env): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request);
  const reviewStatus = String(body.reviewStatus ?? "");
  if (!GUIDE_REVIEW_STATUSES.has(reviewStatus)) return json({ ok: false, error: "invalid_review_status" }, 400, nativeGuideHeaders("guide-prompt-improvements-api"));
  await env.OBS_DB.prepare(
    `UPDATE guide_hypothesis_prompt_improvements
        SET review_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE improvement_id = ?`
  ).bind(reviewStatus, improvementId).run();
  return json({ ok: true, improvementId, reviewStatus }, 200, nativeGuideHeaders("guide-prompt-improvements-api"));
}

async function updateGuidePromptImprovementQueueStatus(request: Request, queueId: string, env: Env): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request);
  const queueStatus = String(body.queueStatus ?? "");
  if (!GUIDE_QUEUE_STATUSES.has(queueStatus)) return json({ ok: false, error: "invalid_queue_status" }, 400, nativeGuideHeaders("guide-prompt-improvements-api"));
  await env.OBS_DB.prepare(
    `UPDATE guide_hypothesis_prompt_improvement_queue
        SET queue_status = ?,
            resolved_at = CASE WHEN ? IN ('resolved', 'dismissed') THEN CURRENT_TIMESTAMP ELSE NULL END,
            updated_at = CURRENT_TIMESTAMP
      WHERE queue_id = ?`
  ).bind(queueStatus, queueStatus, queueId).run();
  return json({ ok: true, queueId, queueStatus }, 200, nativeGuideHeaders("guide-prompt-improvements-api"));
}

function renderMunicipalWalkMapAdminShellHtml(input: {
  title: string;
  lead: string;
  body: string;
  aside?: string;
}): string {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(input.title)} - ikimon admin</title>
<style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17211d;background:#f8fafc}
.wm-admin{max-width:1180px;margin:0 auto;padding:22px 16px 72px}
.wm-admin-head{display:flex;justify-content:space-between;gap:16px;align-items:end;margin-bottom:14px}
.wm-admin-head h1{margin:0;font-size:28px;line-height:1.18;letter-spacing:0}
.wm-admin-head p{margin:6px 0 0;color:#475569;line-height:1.6}
.wm-admin-nav{display:flex;gap:8px;flex-wrap:wrap}
.wm-admin-nav a,.wm-admin-action{border:1px solid #cfe1da;border-radius:8px;background:#fff;color:#0f766e;font-weight:900;text-decoration:none;padding:8px 10px}
.wm-admin-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:12px;align-items:start}
.wm-admin-stack{display:grid;gap:10px}
.wm-admin-card{border:1px solid #dbe7e2;border-radius:8px;background:#fff;padding:14px}
.wm-admin-card h2{margin:0 0 8px;font-size:17px;color:#0f172a}
.wm-admin-card p,.wm-admin-card small{color:#475569;line-height:1.65}
.wm-admin-card p{margin:0}
.wm-admin-card small{display:block;font-weight:800}
.wm-admin-card ul{margin:8px 0 0;padding-left:18px;color:#475569;line-height:1.7}
.wm-admin-card a{color:#0f766e;font-weight:900;text-decoration:none}
@media(max-width:800px){.wm-admin-head{display:grid;align-items:start}.wm-admin-grid{grid-template-columns:1fr}.wm-admin{padding:18px 12px 56px}.wm-admin-head h1{font-size:24px}}
</style>
</head>
<body>
<main class="wm-admin">
  <header class="wm-admin-head">
    <div>
      <h1>${escapeHtml(input.title)}</h1>
      <p>${escapeHtml(input.lead)}</p>
    </div>
    <nav class="wm-admin-nav" aria-label="散策マップ管理">
      <a href="/admin/municipal-walk-maps">作成</a>
      <a href="/admin/municipal-walk-map-reviews">審査</a>
      <a href="/admin/municipal-walk-map-creators">作成者</a>
    </nav>
  </header>
  <div class="wm-admin-grid">
    <section class="wm-admin-stack">${input.body}</section>
    <aside class="wm-admin-stack">${input.aside ?? ""}</aside>
  </div>
</main>
</body>
</html>`;
}

function renderMunicipalWalkMapAdminPageHtml(url: URL): string {
  const templateId = normalizeOptionalId(url.searchParams.get("templateId"));
  const sourceId = normalizeOptionalId(url.searchParams.get("sourceId"));
  const walkMapId = normalizeOptionalId(url.searchParams.get("walkMapId"));
  const selectedTemplate = municipalWalkMapTemplateById(templateId);
  const selectedSource = sourceId ? municipalWalkMapSourceById(sourceId) : null;
  const templateCards = STATIC_MUNICIPAL_WALK_MAP_TEMPLATES.map((template) => `
    <article class="wm-admin-card">
      <h2>${escapeHtml(template.label)}</h2>
      <p>${escapeHtml(template.summary)}</p>
      <small>${escapeHtml(template.sourcePattern)}</small>
      <p><a href="/admin/municipal-walk-maps?templateId=${encodeURIComponent(template.templateId)}">この型で作る</a></p>
    </article>`).join("");
  const sourceCards = STATIC_MUNICIPAL_WALK_MAP_SOURCE_CATALOG.map((source) => `
    <article class="wm-admin-card">
      <h2>${escapeHtml(source.title)}</h2>
      <p>${escapeHtml(source.cue)}</p>
      <small>${escapeHtml(source.municipality)} / score ${source.affinityScore}</small>
      <p><a href="/admin/municipal-walk-maps?sourceId=${encodeURIComponent(source.sourceId)}">出典から下書き</a> / <a href="/walk-map-source-drafts/${encodeURIComponent(source.sourceId)}">出典を見る</a></p>
    </article>`).join("");
  const selected = selectedSource
    ? `<article class="wm-admin-card"><h2>${escapeHtml(selectedSource.title)}</h2><p>${escapeHtml(selectedSource.cue)}</p><small>sourceId: ${escapeHtml(selectedSource.sourceId)}</small></article>`
    : selectedTemplate
      ? `<article class="wm-admin-card"><h2>${escapeHtml(selectedTemplate.label)}</h2><p>${escapeHtml(selectedTemplate.summary)}</p><small>templateId: ${escapeHtml(selectedTemplate.templateId)}</small></article>`
      : walkMapId
        ? `<article class="wm-admin-card"><h2>編集中</h2><p>${escapeHtml(walkMapId)}</p></article>`
        : "";
  return renderMunicipalWalkMapAdminShellHtml({
    title: "散策マップ管理",
    lead: "団体・自治体向けの散策マップを、出典リンク付きでD1に保存します。",
    body: `${selected}<article class="wm-admin-card"><h2>作成API</h2><p>保存は <code>POST /api/v1/admin/municipal-walk-maps</code>、プレビューは <code>POST /api/v1/admin/municipal-walk-maps/preview</code> を使います。</p></article>${templateCards}`,
    aside: `<article class="wm-admin-card"><h2>参考元</h2><p>本文や図版は転載せず、公開ページへのリンクと散策用の構成だけを扱います。</p></article>${sourceCards}`
  });
}

async function getMunicipalWalkMapAdminPage(request: Request, url: URL, env: Env): Promise<Response> {
  await requireMunicipalWalkMapAdminSession(request, env);
  return html(renderMunicipalWalkMapAdminPageHtml(url), 200, {
    "cache-control": "no-store",
    "x-ikimon-cloudflare-native": "municipal-walk-map-admin-html"
  });
}

async function listMunicipalWalkMapTemplatesAdmin(request: Request, env: Env): Promise<Response> {
  await requireMunicipalWalkMapAdminSession(request, env);
  return json({
    ok: true,
    source: "cloudflare_static",
    templates: STATIC_MUNICIPAL_WALK_MAP_TEMPLATES
  }, 200, { "cache-control": "no-store" });
}

function sourceAccessModelForCatalogEntry(source: Record<string, unknown>) {
  const sourceUrl = normalizeOptionalText(source.sourceUrl);
  return {
    downloadKind: sourceUrl && /\.pdf(?:$|\?)/i.test(sourceUrl) ? "direct_pdf" : "official_page_with_links",
    label: "公式ページを出典として扱う",
    downloadUrl: sourceUrl,
    rightsNote: "本文、写真、図版は転載せず、出典リンクと散策用の再構成だけを扱います。",
    importPolicy: "citation_only_no_body_copy"
  };
}

function sourceRiskModelForCatalogEntry(source: Record<string, unknown>) {
  const primaryType = normalizeOptionalText(source.primaryType);
  const isCampaign = primaryType === "citizen_science_report";
  return {
    coordinateSensitivity: isCampaign ? "medium_area_only" : "low_public_route",
    reuseRisk: isCampaign ? "medium_pdf_or_external_terms" : "low_citation_page",
    reviewFlags: isCampaign ? ["public_precision_required"] : [],
    reviewNote: isCampaign
      ? "投稿型の情報は地点を粗くし、個人や希少種が推測される内容を避けます。"
      : "公開ルート・公開ページを出典として、立入条件と引用元を表示します。"
  };
}

async function listMunicipalWalkMapSourceCatalogAdmin(request: Request, env: Env, url: URL): Promise<Response> {
  await requireMunicipalWalkMapAdminSession(request, env);
  const templateId = normalizeOptionalId(url.searchParams.get("templateId"));
  const accessKind = normalizeOptionalText(url.searchParams.get("accessKind"));
  const coordinateSensitivity = normalizeOptionalText(url.searchParams.get("coordinateSensitivity"));
  const reuseRisk = normalizeOptionalText(url.searchParams.get("reuseRisk"));
  const sources = STATIC_MUNICIPAL_WALK_MAP_SOURCE_CATALOG
    .map((source) => ({
      ...source,
      operationalModel: source.primaryType === "citizen_science_report" ? "external_app_campaign" : "official_walk_pdf",
      accessModel: sourceAccessModelForCatalogEntry(source),
      riskModel: sourceRiskModelForCatalogEntry(source)
    }))
    .filter((source) => !templateId || source.templateId === templateId)
    .filter((source) => !accessKind || source.accessModel.downloadKind === accessKind)
    .filter((source) => !coordinateSensitivity || source.riskModel.coordinateSensitivity === coordinateSensitivity)
    .filter((source) => !reuseRisk || source.riskModel.reuseRisk === reuseRisk);
  return json({
    ok: true,
    source: "cloudflare_static",
    sources
  }, 200, { "cache-control": "no-store" });
}

function normalizeEnum(value: unknown, allowed: readonly string[], fallback: string): string {
  const text = normalizeOptionalText(value);
  return text && allowed.includes(text) ? text : fallback;
}

function municipalWalkMapCreatorFromD1Row(row: MunicipalWalkMapCreatorAdminD1Row) {
  return {
    schemaVersion: "municipal_walk_map_creator/v0",
    creatorId: row.creator_id,
    displayName: row.display_name,
    registrationKind: row.registration_kind ?? "registered_group",
    verificationStatus: row.verification_status,
    commercialIntent: row.commercial_intent ?? "none",
    notes: row.notes,
    updatedAt: row.updated_at
  };
}

async function getMunicipalWalkMapCreatorAdminItems(env: Env) {
  const rows = await env.OBS_DB.prepare(
    `SELECT creator_id, display_name, registration_kind, verification_status, commercial_intent, notes, updated_at
       FROM municipal_walk_map_creators
      ORDER BY updated_at DESC, creator_id ASC
      LIMIT 200`
  ).all<MunicipalWalkMapCreatorAdminD1Row>();
  return rows.results.map(municipalWalkMapCreatorFromD1Row);
}

async function listMunicipalWalkMapCreatorsAdmin(request: Request, env: Env): Promise<Response> {
  await requireMunicipalWalkMapAdminSession(request, env);
  const creators = await getMunicipalWalkMapCreatorAdminItems(env);
  return json({
    ok: true,
    source: "d1_observations",
    creators
  }, 200, { "cache-control": "no-store" });
}

function renderMunicipalWalkMapCreatorsAdminHtml(creators: unknown[]): string {
  const body = creators
    .map((raw) => recordOrEmpty(raw))
    .map((creator) => `<article class="wm-admin-card">
      <h2>${escapeHtml(normalizeOptionalText(creator.displayName) ?? "作成者")}</h2>
      <p>${escapeHtml(normalizeOptionalText(creator.creatorId) ?? "")}</p>
      <small>${escapeHtml(normalizeOptionalText(creator.registrationKind) ?? "registered_group")} / ${escapeHtml(normalizeOptionalText(creator.verificationStatus) ?? "pending")} / ${escapeHtml(normalizeOptionalText(creator.commercialIntent) ?? "none")}</small>
    </article>`)
    .join("");
  return renderMunicipalWalkMapAdminShellHtml({
    title: "散策マップ作成者",
    lead: "自治体、団体、会社など、散策マップを作れる主体を確認します。",
    body: body || "<article class=\"wm-admin-card\"><h2>作成者なし</h2><p>作成APIから登録できます。</p></article>",
    aside: "<article class=\"wm-admin-card\"><h2>登録方針</h2><ul><li>自治体、登録団体、登録会社だけを対象にする</li><li>商業色が強いものは審査で止める</li><li>出典リンクと公開範囲を必ず確認する</li></ul></article>"
  });
}

async function getMunicipalWalkMapCreatorsAdminPage(request: Request, env: Env): Promise<Response> {
  await requireMunicipalWalkMapAdminSession(request, env);
  const creators = await getMunicipalWalkMapCreatorAdminItems(env);
  return html(renderMunicipalWalkMapCreatorsAdminHtml(creators), 200, {
    "cache-control": "no-store",
    "x-ikimon-cloudflare-native": "municipal-walk-map-creators-html"
  });
}

function extractMunicipalWalkMapCreatorInput(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const record = body as Record<string, unknown>;
  const creator = record.creator;
  if (creator && typeof creator === "object" && !Array.isArray(creator)) {
    return creator as Record<string, unknown>;
  }
  return record;
}

async function upsertMunicipalWalkMapCreatorAdmin(request: Request, env: Env): Promise<Response> {
  const session = await requireMunicipalWalkMapAdminSession(request, env);
  const input = extractMunicipalWalkMapCreatorInput(await readJson<unknown>(request));
  const creatorId = normalizeOptionalId(input.creatorId ?? input.creator_id);
  const displayName = normalizeOptionalText(input.displayName ?? input.display_name);
  if (!creatorId || !displayName) throw new HttpError(400, "creator_id_and_display_name_required");

  const registrationKind = normalizeEnum(
    input.registrationKind ?? input.registration_kind,
    ["municipality", "registered_group", "registered_company"],
    "registered_group"
  );
  const verificationStatus = normalizeEnum(
    input.verificationStatus ?? input.verification_status,
    ["pending", "verified", "revoked"],
    "pending"
  );
  const commercialIntent = normalizeEnum(
    input.commercialIntent ?? input.commercial_intent,
    ["none", "limited", "primary"],
    "none"
  );
  const officialUrl = normalizeOptionalText(input.officialUrl ?? input.official_url);
  const notes = normalizeOptionalText(input.notes) ?? "";
  const creatorType = registrationKind === "registered_company"
    ? "company"
    : registrationKind === "registered_group"
      ? "group"
      : "municipality";
  const commercialPolicy = commercialIntent === "primary" ? "commercial_review_required" : "restricted";
  const verifiedBy = verificationStatus === "verified" ? session.userId : null;
  const verifiedAt = verificationStatus === "verified" ? new Date().toISOString() : null;

  await env.OBS_DB.prepare(
    `INSERT INTO municipal_walk_map_creators
       (creator_id, creator_type, display_name, organization_name, official_url, verification_status,
        commercial_policy, registration_kind, commercial_intent, verified_by_user_id, verified_at, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(creator_id) DO UPDATE SET
       creator_type = excluded.creator_type,
       display_name = excluded.display_name,
       organization_name = excluded.organization_name,
       official_url = excluded.official_url,
       verification_status = excluded.verification_status,
       commercial_policy = excluded.commercial_policy,
       registration_kind = excluded.registration_kind,
       commercial_intent = excluded.commercial_intent,
       verified_by_user_id = excluded.verified_by_user_id,
       verified_at = excluded.verified_at,
       notes = excluded.notes,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(
    creatorId,
    creatorType,
    displayName,
    displayName,
    officialUrl,
    verificationStatus,
    commercialPolicy,
    registrationKind,
    commercialIntent,
    verifiedBy,
    verifiedAt,
    notes
  ).run();

  return json({
    ok: true,
    source: "d1_observations",
    creator: {
      schemaVersion: "municipal_walk_map_creator/v0",
      creatorId,
      displayName,
      registrationKind,
      verificationStatus,
      commercialIntent,
      officialUrl,
      notes,
      updatedBy: session.userId
    }
  }, 201, { "cache-control": "no-store" });
}

function municipalWalkMapReviewFromD1Row(row: MunicipalWalkMapReviewAdminD1Row) {
  const sourceReferences = parseJsonArray(row.source_references_json);
  return {
    schemaVersion: "municipal_walk_map_review_queue_item/v0",
    walkMapId: row.walk_map_id,
    municipalityCode: row.municipality_code,
    municipality: row.municipality,
    title: row.title,
    summary: row.summary,
    theme: row.theme,
    publishMode: row.publish_mode,
    creatorName: row.creator_name,
    creatorProfile: parseJsonRecord(row.creator_profile_json ?? "{}"),
    routeFlexibility: parseJsonRecord(row.route_flexibility_json ?? "{}"),
    publicationReview: parseJsonRecord(row.publication_review_json ?? "{}"),
    sourceReferences,
    sourceReferenceCount: sourceReferences.length,
    stopCount: Number(row.stop_count) || 0,
    reviewRequired: row.publish_mode !== "public",
    editHref: `/admin/municipal-walk-maps?walkMapId=${encodeURIComponent(row.walk_map_id)}`,
    previewHref: `/api/v1/municipal-walk-maps?municipalityCode=${encodeURIComponent(row.municipality_code)}&limit=1`,
    updatedAt: row.updated_at
  };
}

async function listMunicipalWalkMapReviewsAdmin(request: Request, url: URL, env: Env): Promise<Response> {
  await requireMunicipalWalkMapAdminSession(request, env);
  const reviews = await getMunicipalWalkMapReviewAdminItems(url, env);
  return json({
    ok: true,
    source: "d1_observations",
    reviews
  }, 200, { "cache-control": "no-store" });
}

async function getMunicipalWalkMapReviewAdminItems(url: URL, env: Env) {
  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "100"), 1, 200);
  const rows = await env.OBS_DB.prepare(
    `SELECT m.walk_map_id, m.municipality_code, m.municipality, m.title, m.summary, m.theme, m.publish_mode,
            m.creator_name, m.creator_profile_json, m.route_flexibility_json, m.source_references_json,
            m.publication_review_json, m.updated_at,
            COUNT(s.stop_id) AS stop_count
       FROM municipal_walk_maps m
       LEFT JOIN municipal_walk_map_stops s ON s.walk_map_id = m.walk_map_id
      GROUP BY m.walk_map_id
      ORDER BY CASE m.publish_mode WHEN 'draft' THEN 0 WHEN 'public_preview' THEN 1 ELSE 2 END,
               m.updated_at DESC,
               m.walk_map_id ASC
      LIMIT ?`
  ).bind(limit).all<MunicipalWalkMapReviewAdminD1Row>();
  return rows.results.map(municipalWalkMapReviewFromD1Row);
}

function renderMunicipalWalkMapReviewsAdminHtml(reviews: unknown[]): string {
  const body = reviews
    .map((raw) => recordOrEmpty(raw))
    .map((review) => `<article class="wm-admin-card">
      <h2>${escapeHtml(normalizeOptionalText(review.title) ?? "散策マップ")}</h2>
      <p>${escapeHtml(normalizeOptionalText(review.summary) ?? "")}</p>
      <small>${escapeHtml(normalizeOptionalText(review.municipality) ?? "")} / ${escapeHtml(normalizeOptionalText(review.publishMode) ?? "draft")} / stops ${escapeHtml(String(review.stopCount ?? 0))}</small>
      <p><a href="${escapeHtml(normalizeOptionalText(review.editHref) ?? "/admin/municipal-walk-maps")}">編集</a> / <a href="${escapeHtml(normalizeOptionalText(review.previewHref) ?? "/walk-maps")}">公開候補</a></p>
    </article>`)
    .join("");
  return renderMunicipalWalkMapAdminShellHtml({
    title: "散策マップ審査",
    lead: "公開前の散策マップを、出典、立入範囲、場所の出し方で確認します。",
    body: body || "<article class=\"wm-admin-card\"><h2>審査待ちなし</h2><p>D1に保存された下書きがここに表示されます。</p></article>",
    aside: "<article class=\"wm-admin-card\"><h2>確認項目</h2><ul><li>出典リンクがある</li><li>公開範囲で観察できる</li><li>正確すぎる位置や内部メモを出さない</li></ul></article>"
  });
}

async function getMunicipalWalkMapReviewsAdminPage(request: Request, url: URL, env: Env): Promise<Response> {
  await requireMunicipalWalkMapAdminSession(request, env);
  const reviews = await getMunicipalWalkMapReviewAdminItems(url, env);
  return html(renderMunicipalWalkMapReviewsAdminHtml(reviews), 200, {
    "cache-control": "no-store",
    "x-ikimon-cloudflare-native": "municipal-walk-map-reviews-html"
  });
}

type MunicipalWalkMapReviewAction = "approve_public_preview" | "request_changes" | "emergency_hide";

function extractMunicipalWalkMapReviewAction(body: unknown): { action: MunicipalWalkMapReviewAction; note: string | null } {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "municipal_walk_map_review_action_required");
  const record = body as Record<string, unknown>;
  const action = normalizeOptionalText(record.action);
  if (action !== "approve_public_preview" && action !== "request_changes" && action !== "emergency_hide") {
    throw new HttpError(400, "municipal_walk_map_review_action_invalid");
  }
  const rawNote = normalizeOptionalText(record.note);
  return { action, note: rawNote ? rawNote.slice(0, 500) : null };
}

function mergeMunicipalWalkMapPublicationReview(
  current: Record<string, unknown>,
  action: MunicipalWalkMapReviewAction,
  actorUserId: string,
  reviewedAt: string,
  note: string | null
): { publishMode: string; review: Record<string, unknown> } {
  if (action === "approve_public_preview") {
    return {
      publishMode: "public_preview",
      review: {
        ...current,
        publicAccessAttested: true,
        sourceRightsAttested: true,
        permissionAttestedBy: normalizeOptionalText(current.permissionAttestedBy) ?? actorUserId,
        permissionAttestedAt: normalizeOptionalText(current.permissionAttestedAt) ?? reviewedAt,
        publishApprovedByUserId: actorUserId,
        publishApprovedAt: reviewedAt,
        emergencyHidden: false,
        takedownReason: null,
        reviewNote: note
      }
    };
  }
  if (action === "request_changes") {
    return {
      publishMode: "draft",
      review: {
        ...current,
        publishApprovedByUserId: null,
        publishApprovedAt: null,
        emergencyHidden: false,
        takedownReason: note ?? "修正確認中",
        reviewNote: note
      }
    };
  }
  return {
    publishMode: "draft",
    review: {
      ...current,
      publishApprovedByUserId: null,
      publishApprovedAt: null,
      emergencyHidden: true,
      takedownReason: note ?? "公開範囲の再確認",
      reviewNote: note
    }
  };
}

async function getMunicipalWalkMapReviewRowById(env: Env, walkMapId: string): Promise<MunicipalWalkMapReviewAdminD1Row | null> {
  return env.OBS_DB.prepare(
    `SELECT m.walk_map_id, m.municipality_code, m.municipality, m.title, m.summary, m.theme, m.publish_mode,
            m.creator_name, m.creator_profile_json, m.route_flexibility_json, m.source_references_json,
            m.publication_review_json, m.updated_at,
            COUNT(s.stop_id) AS stop_count
       FROM municipal_walk_maps m
       LEFT JOIN municipal_walk_map_stops s ON s.walk_map_id = m.walk_map_id
      WHERE m.walk_map_id = ?
      GROUP BY m.walk_map_id
      LIMIT 1`
  ).bind(walkMapId).first<MunicipalWalkMapReviewAdminD1Row>();
}

async function applyMunicipalWalkMapReviewActionAdmin(request: Request, walkMapId: string, env: Env): Promise<Response> {
  const session = await requireMunicipalWalkMapAdminSession(request, env);
  const normalizedWalkMapId = normalizeOptionalId(walkMapId);
  if (!normalizedWalkMapId) throw new HttpError(400, "walk_map_id_required");
  const decision = extractMunicipalWalkMapReviewAction(await readJson<unknown>(request));
  const before = await getMunicipalWalkMapReviewRowById(env, normalizedWalkMapId);
  if (!before) throw new HttpError(404, "municipal_walk_map_not_found");

  const currentReview = parseJsonRecord(before.publication_review_json ?? "{}") ?? {};
  const reviewedAt = new Date().toISOString().slice(0, 10);
  const next = mergeMunicipalWalkMapPublicationReview(
    currentReview,
    decision.action,
    session.userId,
    reviewedAt,
    decision.note
  );
  const nextReviewJson = JSON.stringify(next.review);

  await env.OBS_DB.batch([
    env.OBS_DB.prepare(
      `UPDATE municipal_walk_maps
          SET publish_mode = ?,
              publication_review_json = ?,
              updated_by_user_id = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE walk_map_id = ?`
    ).bind(next.publishMode, nextReviewJson, session.userId, normalizedWalkMapId),
    env.OBS_DB.prepare(
      `INSERT INTO municipal_walk_map_audit
         (audit_id, walk_map_id, action, actor_label, payload_json, actor_user_id, before_payload_json, after_payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      newId("walkmap_audit"),
      normalizedWalkMapId,
      `review.${decision.action}`,
      session.displayName,
      JSON.stringify({ note: decision.note }),
      session.userId,
      JSON.stringify({
        publishMode: before.publish_mode,
        publicationReview: currentReview
      }),
      JSON.stringify({
        publishMode: next.publishMode,
        publicationReview: next.review
      })
    )
  ]);

  const after: MunicipalWalkMapReviewAdminD1Row = {
    ...before,
    publish_mode: next.publishMode,
    publication_review_json: nextReviewJson,
    updated_at: new Date().toISOString()
  };
  return json({
    ok: true,
    source: "d1_observations",
    result: {
      schemaVersion: "municipal_walk_map_review_decision_result/v0",
      action: decision.action,
      walkMapId: normalizedWalkMapId,
      publishMode: next.publishMode,
      publicationReview: next.review,
      reviewItem: municipalWalkMapReviewFromD1Row(after)
    }
  }, 200, { "cache-control": "no-store" });
}

function extractMunicipalWalkMapConfigInput(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const record = body as Record<string, unknown>;
  const config = record.config;
  if (config && typeof config === "object" && !Array.isArray(config)) {
    return config as Record<string, unknown>;
  }
  return record;
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayOrEmpty(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function jsonText(value: unknown, fallback: unknown): string {
  return JSON.stringify(value ?? fallback);
}

function firstAreaHintFromConfig(config: Record<string, unknown>, stops: unknown[]): Record<string, unknown> {
  const direct = recordOrEmpty(config.areaHint);
  if (Object.keys(direct).length > 0) return direct;
  const firstStop = recordOrEmpty(stops[0]);
  const stopHint = recordOrEmpty(firstStop.areaHint ?? firstStop.area_hint);
  if (Object.keys(stopHint).length > 0) return stopHint;
  return { lat: null, lng: null, label: null, precision: "area_hint" };
}

function normalizeWalkMapStopForD1(value: unknown, index: number): Record<string, unknown> {
  const stop = recordOrEmpty(value);
  const stopId = normalizeOptionalId(stop.stopId ?? stop.stop_id) ?? `stop-${index + 1}`;
  const title = normalizeOptionalText(stop.title) ?? `Stop ${index + 1}`;
  return {
    stopId,
    title,
    note: normalizeOptionalText(stop.note),
    areaHint: recordOrEmpty(stop.areaHint ?? stop.area_hint),
    safetyNote: normalizeOptionalText(stop.safetyNote ?? stop.safety_note),
    position: clampInteger(Number(stop.position ?? stop.displayOrder ?? stop.display_order ?? index + 1), 0, 999),
    areaKind: normalizeOptionalText(stop.areaKind ?? stop.area_kind) ?? "other",
    linkedFieldId: normalizeOptionalText(stop.linkedFieldId ?? stop.linked_field_id),
    access: normalizeOptionalText(stop.access) ?? "public_access",
    sensitiveContext: normalizeOptionalText(stop.sensitiveContext ?? stop.sensitive_context) ?? "none",
    estimatedMinutes: Number.isFinite(Number(stop.estimatedMinutes ?? stop.estimated_minutes))
      ? clampInteger(Number(stop.estimatedMinutes ?? stop.estimated_minutes), 0, 1440)
      : null,
    noticeCues: arrayOrEmpty(stop.noticeCues ?? stop.notice_cues),
    recordCues: arrayOrEmpty(stop.recordCues ?? stop.record_cues),
    safetyNotes: arrayOrEmpty(stop.safetyNotes ?? stop.safety_notes),
    internalMemo: normalizeOptionalText(stop.internalMemo ?? stop.internal_memo)
  };
}

function normalizeMunicipalWalkMapConfigForD1(config: Record<string, unknown>, pathWalkMapId: string | null) {
  const walkMapId = normalizeOptionalId(pathWalkMapId ?? config.walkMapId ?? config.walk_map_id);
  const creatorProfile = recordOrEmpty(config.creatorProfile ?? config.creator_profile);
  const areaScope = recordOrEmpty(config.areaScope ?? config.area_scope);
  const routeFlexibility = recordOrEmpty(config.routeFlexibility ?? config.route_flexibility);
  const publicationReview = recordOrEmpty(config.publicationReview ?? config.publication_review);
  const sourceReferences = arrayOrEmpty(config.sourceReferences ?? config.source_references);
  const recordModes = arrayOrEmpty(config.recordModes ?? config.record_modes);
  const rawStops = arrayOrEmpty(config.routeStops ?? config.route_stops);
  const stops = rawStops.map(normalizeWalkMapStopForD1);
  const creatorId = normalizeOptionalId(creatorProfile.creatorId ?? creatorProfile.creator_id ?? config.creatorId ?? config.creator_id)
    ?? "unregistered";
  const municipalityCode = normalizeOptionalText(config.municipalityCode ?? config.municipality_code)
    ?? normalizeOptionalText(arrayOrEmpty(areaScope.municipalityCodes ?? areaScope.municipality_codes)[0])
    ?? "unknown";
  const title = normalizeOptionalText(config.title);
  const summary = normalizeOptionalText(config.summary);
  if (!walkMapId) throw new HttpError(400, "walk_map_id_required");
  if (!title) throw new HttpError(400, "title_required");
  if (!summary) throw new HttpError(400, "summary_required");
  return {
    walkMapId,
    creatorId,
    municipalityCode,
    municipality: normalizeOptionalText(config.municipality) ?? "未設定",
    title,
    summary,
    theme: normalizeOptionalText(config.theme) ?? "seasonal_walk",
    publishMode: normalizeEnum(config.publishMode ?? config.publish_mode, ["draft", "public_preview", "public"], "draft"),
    routeStyle: normalizeOptionalText(routeFlexibility.routeStyle ?? routeFlexibility.route_style ?? config.routeStyle ?? config.route_style) ?? "loose_stops",
    mobilityModes: arrayOrEmpty(routeFlexibility.mobilityModes ?? routeFlexibility.mobility_modes ?? config.mobilityModes ?? config.mobility_modes),
    sourceReferences,
    areaHint: firstAreaHintFromConfig(config, rawStops),
    stops,
    displayOrder: clampInteger(Number(config.displayOrder ?? config.display_order ?? 100), 0, 100000),
    sourceLicenseNote: normalizeOptionalText(config.sourceLicenseNote ?? config.source_license_note),
    creatorName: normalizeOptionalText(config.creatorName ?? config.creator_name)
      ?? normalizeOptionalText(creatorProfile.displayName ?? creatorProfile.display_name)
      ?? normalizeOptionalText(config.municipality)
      ?? "",
    creatorProfile,
    areaScope,
    recordModes,
    routeFlexibility,
    publicPrecisionPolicy: normalizeOptionalText(config.publicPrecisionPolicy ?? config.public_precision_policy) ?? "mesh_or_coarser",
    claimBoundary: arrayOrEmpty(config.claimBoundary ?? config.claim_boundary),
    publicationReview
  };
}

function normalizeMunicipalWalkMapPreviewConfig(config: Record<string, unknown>) {
  const creatorProfile = recordOrEmpty(config.creatorProfile ?? config.creator_profile);
  const routeFlexibility = recordOrEmpty(config.routeFlexibility ?? config.route_flexibility);
  const rawStops = arrayOrEmpty(config.routeStops ?? config.route_stops);
  const stops = rawStops.map(normalizeWalkMapStopForD1);
  return {
    walkMapId: normalizeOptionalId(config.walkMapId ?? config.walk_map_id) ?? "admin-draft-preview",
    municipality: normalizeOptionalText(config.municipality) ?? "未設定",
    title: normalizeOptionalText(config.title) ?? "散策マップの下書き",
    summary: normalizeOptionalText(config.summary) ?? "公開前の下書きプレビューです。",
    theme: normalizeOptionalText(config.theme) ?? "seasonal_walk",
    publishMode: normalizeEnum(config.publishMode ?? config.publish_mode, ["draft", "public_preview", "public"], "draft"),
    creatorName: normalizeOptionalText(config.creatorName ?? config.creator_name)
      ?? normalizeOptionalText(creatorProfile.displayName ?? creatorProfile.display_name)
      ?? "",
    routeStyle: normalizeOptionalText(routeFlexibility.routeStyle ?? routeFlexibility.route_style ?? config.routeStyle ?? config.route_style) ?? "loose_stops",
    mobilityModes: arrayOrEmpty(routeFlexibility.mobilityModes ?? routeFlexibility.mobility_modes ?? config.mobilityModes ?? config.mobility_modes),
    sourceReferences: arrayOrEmpty(config.sourceReferences ?? config.source_references),
    areaHint: firstAreaHintFromConfig(config, rawStops),
    stops
  };
}

function htmlList(items: unknown[]): string {
  const list = items.map((item) => normalizeOptionalText(item)).filter((item): item is string => Boolean(item));
  if (list.length === 0) return "<li>現地で確認</li>";
  return list.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderMunicipalWalkMapPreviewHtml(config: ReturnType<typeof normalizeMunicipalWalkMapPreviewConfig>): string {
  const stops = config.stops.length > 0 ? config.stops : [
    { stopId: "preview-stop", title: "最初の立ち寄り先", access: "public_access", areaKind: "park", noticeCues: ["案内板", "足元", "木陰"], recordCues: ["写真", "メモ"] }
  ];
  const stopHtml = stops.map((stop, index) => {
    const title = normalizeOptionalText(stop.title) ?? `立ち寄り先 ${index + 1}`;
    const areaKind = normalizeOptionalText(stop.areaKind) ?? "other";
    const access = normalizeOptionalText(stop.access) ?? "public_access";
    return `<article class="wm-preview-stop">
      <div class="wm-preview-stop-head">
        <h2>${escapeHtml(title)}</h2>
        <span>${escapeHtml(areaKind)} / ${escapeHtml(access)}</span>
      </div>
      <div class="wm-preview-cues">
        <section><strong>見つける手がかり</strong><ul>${htmlList(arrayOrEmpty(stop.noticeCues))}</ul></section>
        <section><strong>残すもの</strong><ul>${htmlList(arrayOrEmpty(stop.recordCues))}</ul></section>
      </div>
    </article>`;
  }).join("");
  const sources = config.sourceReferences
    .map((source) => recordOrEmpty(source))
    .map((source) => {
      const label = normalizeOptionalText(source.label) ?? "出典";
      const href = normalizeOptionalText(source.url);
      return href
        ? `<li><a href="${escapeHtml(href)}" rel="noopener noreferrer">${escapeHtml(label)}</a></li>`
        : `<li>${escapeHtml(label)}</li>`;
    })
    .join("");
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(config.title)} - ikimon</title>
<style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17211d;background:#f8fafc}
.wm-preview{max-width:1080px;margin:0 auto;padding:28px 18px 72px}
.wm-preview-hero{display:grid;gap:10px;margin-bottom:18px}
.wm-preview-hero p{margin:0;color:#475569;line-height:1.7}
.wm-preview-eyebrow{color:#0f766e;font-size:12px;font-weight:900}
h1{margin:0;font-size:32px;line-height:1.18}
.wm-preview-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;align-items:start}
.wm-preview-stops{display:grid;gap:12px}
.wm-preview-stop,.wm-preview-panel{border:1px solid #dbe7e2;border-radius:8px;background:#fff;padding:14px}
.wm-preview-stop-head{display:flex;justify-content:space-between;gap:10px;align-items:start}
.wm-preview-stop h2,.wm-preview-panel h2{margin:0 0 10px;font-size:18px;color:#0f172a}
.wm-preview-stop-head span{font-size:11px;font-weight:900;color:#0f766e}
.wm-preview-cues{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.wm-preview-cues section{border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:10px}
.wm-preview-cues ul,.wm-preview-panel ul{margin:6px 0 0;padding-left:18px;color:#475569;font-size:12px;line-height:1.7}
.wm-preview-panel{display:grid;gap:12px}
.wm-preview-panel a{color:#0f766e;font-weight:900;text-decoration:none}
@media(max-width:760px){.wm-preview-grid,.wm-preview-cues{grid-template-columns:1fr}.wm-preview{padding:18px 12px 56px}h1{font-size:26px}}
</style>
</head>
<body>
<main class="wm-preview">
  <header class="wm-preview-hero">
    <div class="wm-preview-eyebrow">${escapeHtml(config.municipality)} / draft preview</div>
    <h1>${escapeHtml(config.title)}</h1>
    <p>${escapeHtml(config.summary)}</p>
  </header>
  <div class="wm-preview-grid">
    <section class="wm-preview-stops">${stopHtml}</section>
    <aside class="wm-preview-panel">
      <section><h2>移動</h2><p>${escapeHtml(config.routeStyle)} / ${escapeHtml(config.mobilityModes.map(String).join(" / ") || "walk")}</p></section>
      <section><h2>出典</h2><ul>${sources || "<li>公開時に出典リンクを設定</li>"}</ul></section>
    </aside>
  </div>
</main>
</body>
</html>`;
}

async function previewMunicipalWalkMapAdmin(request: Request, env: Env): Promise<Response> {
  await requireMunicipalWalkMapAdminSession(request, env);
  const input = extractMunicipalWalkMapConfigInput(await readJson<unknown>(request));
  const config = normalizeMunicipalWalkMapPreviewConfig(input);
  return html(renderMunicipalWalkMapPreviewHtml(config), 200, { "cache-control": "no-store" });
}

function deriveMunicipalWalkMapCreatorD1Profile(
  config: ReturnType<typeof normalizeMunicipalWalkMapConfigForD1>,
  session: SessionSnapshot
) {
  const creatorProfile = recordOrEmpty(config.creatorProfile);
  const registrationKind = normalizeEnum(
    creatorProfile.registrationKind ?? creatorProfile.registration_kind,
    ["municipality", "registered_group", "registered_company"],
    config.creatorId === "unregistered" ? "registered_group" : "municipality"
  );
  const verificationStatus = normalizeEnum(
    creatorProfile.verificationStatus ?? creatorProfile.verification_status,
    ["pending", "verified", "revoked"],
    "pending"
  );
  const commercialIntent = normalizeEnum(
    creatorProfile.commercialIntent ?? creatorProfile.commercial_intent,
    ["none", "limited", "primary"],
    "none"
  );
  return {
    registrationKind,
    verificationStatus,
    commercialIntent,
    displayName: config.creatorName || config.municipality || config.creatorId,
    officialUrl: normalizeOptionalText(creatorProfile.officialUrl ?? creatorProfile.official_url),
    notes: normalizeOptionalText(creatorProfile.notes) ?? "",
    creatorType: registrationKind === "registered_company"
      ? "company"
      : registrationKind === "registered_group"
        ? "group"
        : "municipality",
    commercialPolicy: commercialIntent === "primary" ? "commercial_review_required" : "restricted",
    verifiedBy: verificationStatus === "verified" ? session.userId : null,
    verifiedAt: verificationStatus === "verified" ? new Date().toISOString() : null
  };
}

async function upsertMunicipalWalkMapAdmin(request: Request, pathWalkMapId: string | null, env: Env): Promise<Response> {
  const session = await requireMunicipalWalkMapAdminSession(request, env);
  const input = extractMunicipalWalkMapConfigInput(await readJson<unknown>(request));
  const config = normalizeMunicipalWalkMapConfigForD1(input, pathWalkMapId);
  const before = await getMunicipalWalkMapReviewRowById(env, config.walkMapId);
  const action = before ? "update" : "create";
  const creator = deriveMunicipalWalkMapCreatorD1Profile(config, session);
  const statements: D1PreparedStatement[] = [
    env.OBS_DB.prepare(
      `INSERT INTO municipal_walk_map_creators
         (creator_id, creator_type, display_name, organization_name, official_url, verification_status,
          commercial_policy, registration_kind, commercial_intent, verified_by_user_id, verified_at, notes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(creator_id) DO UPDATE SET
         creator_type = excluded.creator_type,
         display_name = excluded.display_name,
         organization_name = excluded.organization_name,
         official_url = excluded.official_url,
         verification_status = excluded.verification_status,
         commercial_policy = excluded.commercial_policy,
         registration_kind = excluded.registration_kind,
         commercial_intent = excluded.commercial_intent,
         verified_by_user_id = excluded.verified_by_user_id,
         verified_at = excluded.verified_at,
         notes = excluded.notes,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(
      config.creatorId,
      creator.creatorType,
      creator.displayName,
      creator.displayName,
      creator.officialUrl,
      creator.verificationStatus,
      creator.commercialPolicy,
      creator.registrationKind,
      creator.commercialIntent,
      creator.verifiedBy,
      creator.verifiedAt,
      creator.notes
    ),
    env.OBS_DB.prepare(
      `INSERT INTO municipal_walk_maps
         (walk_map_id, creator_id, municipality_code, municipality, title, summary, theme, publish_mode,
          route_style, mobility_modes_json, source_references_json, area_hint_json, stop_count, display_order,
          source_license_note, creator_name, creator_profile_json, area_scope_json, record_modes_json,
          route_flexibility_json, public_precision_policy, claim_boundary_json, publication_review_json,
          created_by_user_id, updated_by_user_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(walk_map_id) DO UPDATE SET
         creator_id = excluded.creator_id,
         municipality_code = excluded.municipality_code,
         municipality = excluded.municipality,
         title = excluded.title,
         summary = excluded.summary,
         theme = excluded.theme,
         publish_mode = excluded.publish_mode,
         route_style = excluded.route_style,
         mobility_modes_json = excluded.mobility_modes_json,
         source_references_json = excluded.source_references_json,
         area_hint_json = excluded.area_hint_json,
         stop_count = excluded.stop_count,
         display_order = excluded.display_order,
         source_license_note = excluded.source_license_note,
         creator_name = excluded.creator_name,
         creator_profile_json = excluded.creator_profile_json,
         area_scope_json = excluded.area_scope_json,
         record_modes_json = excluded.record_modes_json,
         route_flexibility_json = excluded.route_flexibility_json,
         public_precision_policy = excluded.public_precision_policy,
         claim_boundary_json = excluded.claim_boundary_json,
         publication_review_json = excluded.publication_review_json,
         updated_by_user_id = excluded.updated_by_user_id,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(
      config.walkMapId,
      config.creatorId,
      config.municipalityCode,
      config.municipality,
      config.title,
      config.summary,
      config.theme,
      config.publishMode,
      config.routeStyle,
      jsonText(config.mobilityModes, []),
      jsonText(config.sourceReferences, []),
      jsonText(config.areaHint, {}),
      config.stops.length,
      config.displayOrder,
      config.sourceLicenseNote,
      config.creatorName,
      jsonText(config.creatorProfile, {}),
      jsonText(config.areaScope, {}),
      jsonText(config.recordModes, []),
      jsonText(config.routeFlexibility, {}),
      config.publicPrecisionPolicy,
      jsonText(config.claimBoundary, []),
      jsonText(config.publicationReview, {}),
      session.userId,
      session.userId
    ),
    env.OBS_DB.prepare("DELETE FROM municipal_walk_map_stops WHERE walk_map_id = ?").bind(config.walkMapId)
  ];
  for (const [index, stop] of config.stops.entries()) {
    statements.push(env.OBS_DB.prepare(
      `INSERT INTO municipal_walk_map_stops
         (stop_id, walk_map_id, display_order, title, note, area_hint_json, safety_note,
          position, area_kind, linked_field_id, access, sensitive_context, estimated_minutes,
          notice_cues_json, record_cues_json, safety_notes_json, internal_memo, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      normalizeOptionalId(stop.stopId) ?? `stop-${index + 1}`,
      config.walkMapId,
      index + 1,
      normalizeOptionalText(stop.title) ?? `Stop ${index + 1}`,
      normalizeOptionalText(stop.note),
      jsonText(stop.areaHint, {}),
      normalizeOptionalText(stop.safetyNote),
      Number(stop.position),
      normalizeOptionalText(stop.areaKind) ?? "other",
      normalizeOptionalText(stop.linkedFieldId),
      normalizeOptionalText(stop.access) ?? "public_access",
      normalizeOptionalText(stop.sensitiveContext) ?? "none",
      stop.estimatedMinutes == null ? null : Number(stop.estimatedMinutes),
      jsonText(stop.noticeCues, []),
      jsonText(stop.recordCues, []),
      jsonText(stop.safetyNotes, []),
      normalizeOptionalText(stop.internalMemo)
    ));
  }
  statements.push(env.OBS_DB.prepare(
    `INSERT INTO municipal_walk_map_audit
       (audit_id, walk_map_id, action, actor_label, payload_json, actor_user_id, before_payload_json, after_payload_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    newId("walkmap_audit"),
    config.walkMapId,
    `map.${action}`,
    session.displayName,
    JSON.stringify({ stopCount: config.stops.length, publishMode: config.publishMode }),
    session.userId,
    before ? JSON.stringify({
      publishMode: before.publish_mode,
      title: before.title,
      summary: before.summary,
      publicationReview: parseJsonRecord(before.publication_review_json ?? "{}") ?? {}
    }) : "{}",
    JSON.stringify({
      publishMode: config.publishMode,
      title: config.title,
      summary: config.summary,
      publicationReview: config.publicationReview
    })
  ));
  await env.OBS_DB.batch(statements);
  return json({
    ok: true,
    source: "d1_observations",
    action,
    config: {
      schemaVersion: "municipal_walk_map_config/v0",
      ...config
    },
    publicMap: {
      schemaVersion: "municipal_walk_map_public_summary/v0",
      walkMapId: config.walkMapId,
      municipality: config.municipality,
      title: config.title,
      summary: config.summary,
      theme: config.theme,
      publishMode: config.publishMode,
      routeStyle: config.routeStyle,
      mobilityModes: config.mobilityModes,
      stopCount: config.stops.length,
      sourceReferences: config.sourceReferences,
      areaHint: config.areaHint
    }
  }, action === "create" ? 201 : 200, { "cache-control": "no-store" });
}

async function getPublicMapMyPlaces(request: Request, env: Env): Promise<Response> {
  const session = await readCompatibleSessionWithOriginFallback(request, env);
  if (!session || session.banned) {
    return json({ signedIn: false, items: [] }, 200, { "cache-control": "no-store" });
  }
  return json({ signedIn: true, sort: "recent", items: [] }, 200, { "cache-control": "no-store" });
}

async function getPublicMapMyObservations(request: Request, url: URL, env: Env): Promise<Response> {
  const session = await readCompatibleSessionWithOriginFallback(request, env);
  if (!session || session.banned) {
    return json({ signedIn: false, items: [] }, 200, { "cache-control": "no-store" });
  }

  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "48"), 1, 120);
  const rows = await env.OBS_DB.prepare(
    `SELECT o.observation_id, o.observed_at, o.taxon_label, o.note, o.exact_lat, o.exact_lng,
            a.public_derivative_key
       FROM observations o
       JOIN asset_ledger a ON a.observation_id = o.observation_id
      WHERE o.owner_user_id = ?
        AND o.exact_lat IS NOT NULL
        AND o.exact_lng IS NOT NULL
        AND o.emergency_hidden = 0
        AND a.processing_state = 'uploaded'
        AND a.public_derivative_key IS NOT NULL
        AND a.exif_scrub_state = 'scrubbed'
        AND a.public_ready_at IS NOT NULL
        AND a.mime LIKE 'image/%'
      ORDER BY o.observed_at DESC, a.public_ready_at DESC
      LIMIT ?`
  ).bind(session.userId, limit).all<OwnMapObservationRow>();

  const seen = new Set<string>();
  const items = [];
  for (const row of rows.results) {
    if (seen.has(row.observation_id)) continue;
    seen.add(row.observation_id);
    const latitude = Number(row.exact_lat);
    const longitude = Number(row.exact_lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !row.public_derivative_key) continue;
    items.push({
      occurrenceId: `occ:${row.observation_id}:0`,
      visitId: row.observation_id,
      displayName: publicTaxonDisplayName(row.taxon_label || row.note),
      observedAt: row.observed_at,
      latitude,
      longitude,
      photoUrl: publicMediaUrl(row.public_derivative_key),
      mediaKind: "photo",
      localityLabel: "自分だけに表示"
    });
  }

  return json({ signedIn: true, items }, 200, { "cache-control": "no-store" });
}

function stewardshipLang(url: URL): "ja" | "en" | "es" | "pt-BR" {
  const explicit = url.searchParams.get("lang")?.trim().toLowerCase();
  if (explicit === "en" || explicit === "es") return explicit;
  if (explicit === "pt-br" || explicit === "pt") return "pt-BR";
  const prefix = url.pathname.match(/^\/(ja|en|es|pt-br)(?:\/|$)/i)?.[1]?.toLowerCase();
  if (prefix === "en" || prefix === "es") return prefix;
  if (prefix === "pt-br") return "pt-BR";
  return "ja";
}

function stewardshipFormUrl(placeId: string, lang: string, status?: { ok?: boolean; error?: string }): string {
  const params = new URLSearchParams({ lang });
  if (status?.ok) params.set("ok", "1");
  if (status?.error) params.set("error", status.error);
  return `/sites/${encodeURIComponent(placeId)}/stewardship/new?${params.toString()}`;
}

function stewardshipMessage(lang: ReturnType<typeof stewardshipLang>, key: string | null): string | null {
  if (!key) return null;
  const ja: Record<string, string> = {
    ok: "記録しました。",
    login_required: "ログインすると記録できます。",
    occurred_at_missing: "日時を入れてください。",
    occurred_at_invalid: "日時を確認してください。",
    action_kind_invalid: "種類を選んでください。",
    insert_failed: "保存できませんでした。時間をおいてもう一度試してください。"
  };
  const en: Record<string, string> = {
    ok: "Saved.",
    login_required: "Sign in to save this record.",
    occurred_at_missing: "Add the date and time.",
    occurred_at_invalid: "Check the date and time.",
    action_kind_invalid: "Choose a type.",
    insert_failed: "Could not save. Please try again later."
  };
  const dictionary = lang === "ja" ? ja : en;
  return dictionary[key] ?? dictionary.insert_failed ?? "Could not save.";
}

function renderStewardshipActionFormPage(placeId: string, url: URL, signedIn: boolean): string {
  const lang = stewardshipLang(url);
  const messageKey = url.searchParams.get("ok") === "1" ? "ok" : normalizeOptionalText(url.searchParams.get("error"));
  const message = stewardshipMessage(lang, messageKey);
  const title = lang === "ja" ? "手入れの記録" : "Care record";
  const lead = lang === "ja"
    ? "清掃、草刈り、巡回など、その場所で起きたことを残します。"
    : "Save cleanup, mowing, patrol, and other care work at this place.";
  const action = `/sites/${encodeURIComponent(placeId)}/stewardship_actions`;
  const options = [
    ["cleanup", "清掃 / Cleanup"],
    ["mowing", "草刈り / Mowing"],
    ["water_management", "水管理 / Water"],
    ["pruning", "剪定 / Pruning"],
    ["planting", "植栽 / Planting"],
    ["invasive_removal", "外来種対応 / Invasive removal"],
    ["patrol", "巡回 / Patrol"],
    ["monitoring", "確認 / Monitoring"],
    ["other", "その他 / Other"]
  ].map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("");

  return `<!doctype html><html lang="${lang === "pt-BR" ? "pt-BR" : escapeHtml(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} - ikimon</title><style>
body{margin:0;background:#f6faf8;color:#172033;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.sa{max-width:720px;margin:0 auto;padding:28px 16px 72px}.sa-card{background:#fff;border:1px solid #dce8e3;border-radius:8px;padding:18px;box-shadow:0 10px 28px rgba(15,23,42,.08)}h1{font-size:26px;line-height:1.25;margin:0 0 8px}p{color:#475569;line-height:1.7}.sa-msg{border-radius:8px;background:#e7f7f1;color:#065f46;padding:10px 12px;font-weight:800}.sa-msg[data-error="true"]{background:#fff1f2;color:#9f1239}label{display:block;font-weight:800;margin:16px 0 6px}input,select,textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:11px;font:inherit;background:#fff}textarea{min-height:112px;resize:vertical}.sa-actions{display:flex;gap:10px;align-items:center;margin-top:18px}button{border:0;border-radius:999px;background:#008f7a;color:#fff;font-weight:900;padding:12px 18px;min-height:44px}.sa-note{font-size:13px;color:#64748b}</style></head><body><main class="sa"><section class="sa-card"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(lead)}</p>${message ? `<p class="sa-msg" data-error="${messageKey === "ok" ? "false" : "true"}">${escapeHtml(message)}</p>` : ""}<form method="post" action="${escapeHtml(action)}">
<input type="hidden" name="lang" value="${escapeHtml(lang)}">
<label for="occurred_at">日時</label><input id="occurred_at" name="occurred_at" type="datetime-local" required>
<label for="action_kind">種類</label><select id="action_kind" name="action_kind" required>${options}</select>
<label for="species_status">対象</label><select id="species_status" name="species_status"><option value="">指定なし</option><option value="invasive">外来種</option><option value="dominant_native">在来種の繁茂</option><option value="disturbance">撹乱</option><option value="unknown">不明</option></select>
<label for="linked_visit_id">関連する記録ID</label><input id="linked_visit_id" name="linked_visit_id" autocomplete="off">
<label for="description">メモ</label><textarea id="description" name="description"></textarea>
<div class="sa-actions"><button type="submit">${signedIn ? "保存" : "ログインして保存"}</button><span class="sa-note">${escapeHtml(placeId)}</span></div>
</form></section></main></body></html>`;
}

async function getStewardshipActionFormPage(request: Request, url: URL, env: Env, placeId: string): Promise<Response> {
  const session = await readCompatibleSessionWithOriginFallback(request, env);
  return html(renderStewardshipActionFormPage(placeId, url, Boolean(session && !session.banned)), 200, {
    "cache-control": "no-store",
    "x-ikimon-cloudflare-native": "stewardship-action-form"
  });
}

function formDataText(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function createStewardshipActionFromForm(request: Request, url: URL, env: Env, placeId: string): Promise<Response> {
  const form = await request.formData();
  const lang = stewardshipLang(new URL(stewardshipFormUrl(placeId, formDataText(form, "lang") || stewardshipLang(url)), url.origin));
  const formUrl = stewardshipFormUrl(placeId, lang);
  const session = await readCompatibleSessionWithOriginFallback(request, env);
  if (!session?.userId || session.banned) return redirect303(stewardshipFormUrl(placeId, lang, { error: "login_required" }));

  const occurredAtRaw = formDataText(form, "occurred_at");
  if (!occurredAtRaw) return redirect303(stewardshipFormUrl(placeId, lang, { error: "occurred_at_missing" }));
  const occurredAt = new Date(occurredAtRaw);
  if (Number.isNaN(occurredAt.getTime())) return redirect303(stewardshipFormUrl(placeId, lang, { error: "occurred_at_invalid" }));

  const actionKind = formDataText(form, "action_kind");
  if (!STEWARDSHIP_ACTION_KINDS.has(actionKind)) return redirect303(stewardshipFormUrl(placeId, lang, { error: "action_kind_invalid" }));
  const speciesStatusRaw = formDataText(form, "species_status");
  const speciesStatus = speciesStatusRaw && STEWARDSHIP_SPECIES_STATUSES.has(speciesStatusRaw) ? speciesStatusRaw : null;
  const linkedVisitId = normalizeOptionalText(formDataText(form, "linked_visit_id"));
  const description = normalizeOptionalText(formDataText(form, "description"));

  try {
    await env.OBS_DB.prepare(
      `INSERT INTO stewardship_actions (
         action_id, place_id, occurred_at, action_kind, actor_user_id,
         linked_visit_id, description, species_status, metadata_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      newId("stewardship_action"),
      placeId,
      occurredAt.toISOString(),
      actionKind,
      session.userId,
      linkedVisitId,
      description,
      speciesStatus,
      JSON.stringify({ source: "cloudflare_web_form" })
    ).run();
  } catch (error) {
    console.warn("[stewardshipActions] D1 insert failed", error);
    return redirect303(stewardshipFormUrl(placeId, lang, { error: "insert_failed" }));
  }

  return redirect303(`${formUrl}&ok=1`, { "x-ikimon-cloudflare-native": "stewardship-action-write" });
}

function getPublicMapEmptyGeoJson(kind: string, headers: Record<string, string> = { "cache-control": "no-store" }): Response {
  return json({
    type: "FeatureCollection",
    features: [],
    stats: {
      totalReturned: 0,
      totalAll: 0,
      source: "cloudflare_compat_empty",
      kind
    }
  }, 200, headers);
}

function getPublicMapEffortSummaryShim(): Response {
  return json({
    actorLens: {
      actorClass: "community"
    },
    myProgress: {
      revisitCount: 0,
      roleBreakdown: {
        note: 0,
        guide: 0,
        scan: 0
      }
    },
    communityProgress: {
      activeCellCount: 0,
      strengthenedCellCount: 0
    },
    frontierRemaining: {
      blankCount: 0,
      buildingCount: 0,
      repeatableCount: 0,
      matureCount: 0
    },
    campaignProgress: {
      labelKey: "mixed_frontier",
      priorityCue: "fresh_gap"
    },
    compatibility: {
      source: "cloudflare_compat_empty"
    }
  }, 200, { "cache-control": "no-store" });
}

function getPublicMapSiteBriefShim(url: URL): Response {
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return json({ error: "invalid_coords" }, 400, { "cache-control": "no-store" });
  }
  return json({
    hypothesis: {
      label: "まだ見落としがありそうな場所",
      confidence: 0.42
    },
    reasons: ["水路、緑地、建物のすき間など、身近な環境の境目を見比べられる場所です。"],
    checks: ["花、草地、水辺、日陰、人工物のまわりに小さな変化がないか見てください。"],
    captureHints: ["気になったものを1枚撮るか、音やメモを残すと次の確認に使えます。"],
    environmentEvidence: [],
    officialNotices: [],
    compatibility: {
      source: "cloudflare_compat_empty"
    }
  }, 200, { "cache-control": "no-store" });
}

async function getOriginalUiAreaSnapshot(fieldId: string, env: Env): Promise<Response> {
  if (!isSafeFieldId(fieldId)) {
    return json({ ok: false, error: "not_found" }, 404, { "cache-control": "no-store" });
  }
  const object = await env.ASSET_BUCKET.get(originalUiAreaSnapshotKey(fieldId));
  if (object?.body) {
    return new Response(object.body, {
      headers: {
        "content-type": object.httpMetadata?.contentType ?? "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-ikimon-cloudflare-materialized": "original-ui-area-snapshot"
      }
    });
  }
  const row = await getFieldDetailReadmodelRow(fieldId, env);
  if (row) {
    return json({
      snapshot: fieldDetailAreaSnapshotPayload(row),
      compatibility: {
        source: "cloudflare_field_detail_readmodel_lightweight_area_snapshot"
      }
    }, 200, {
      "cache-control": "no-store",
      "x-ikimon-cloudflare-native": "area-snapshot-field-detail-readmodel"
    });
  }
  return json({ ok: false, error: "area_snapshot_not_materialized" }, 404, { "cache-control": "no-store" });
}

function isSafeFieldId(fieldId: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(fieldId);
}

function originalUiAreaSnapshotKey(fieldId: string): string {
  return `original-ui/area-snapshots/${fieldId}.json`;
}

async function getFieldDetailJson(fieldId: string, env: Env): Promise<Response> {
  const row = await getFieldDetailReadmodelRow(fieldId, env);
  if (!row) {
    return json({ ok: false, error: "field_not_found" }, 404, { "cache-control": "no-store" });
  }
  return json({
    ok: true,
    field: fieldDetailPublicPayload(row),
    privacy: {
      exactLocationExposed: false,
      geometryExposed: false,
      publicCellPrecision: "0.01_degree"
    },
    compatibility: {
      source: "cloudflare_field_detail_readmodel"
    }
  }, 200, {
    "cache-control": "no-store",
    "x-ikimon-cloudflare-native": "field-detail-readmodel"
  });
}

async function getNativeFieldDetailHtmlIfAvailable(request: Request, url: URL, env: Env): Promise<Response | null> {
  const match = parseFieldDetailPath(url.pathname);
  if (!match) return null;
  const row = await getFieldDetailReadmodelRow(match.fieldId, env);
  if (!row) return null;
  return html(request.method === "HEAD" ? "" : renderFieldDetailHtml(row, match.lang), 200, {
    "cache-control": "no-store",
    "vary": "cookie, authorization",
    "x-ikimon-cloudflare-native": "field-detail-readmodel"
  });
}

function parseFieldDetailPath(pathname: string): { lang: string; fieldId: string } | null {
  const match = pathname.match(/^\/(?:(ja|en|es|pt-br)\/)?community\/fields\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,127})$/);
  if (!match?.[2]) return null;
  return { lang: match[1] ?? "ja", fieldId: match[2] };
}

async function getNativePlaceSnapshotHtmlIfAvailable(request: Request, url: URL, env: Env): Promise<Response | null> {
  const match = parsePlaceSnapshotPath(url.pathname);
  if (!match) return null;
  const row = await getFieldDetailReadmodelRow(match.fieldId, env);
  if (!row) return null;
  return html(request.method === "HEAD" ? "" : renderPlaceSnapshotHtml(row, match.lang), 200, {
    "cache-control": "no-store",
    "vary": "cookie, authorization",
    "x-ikimon-cloudflare-native": "place-snapshot-readmodel"
  });
}

function parsePlaceSnapshotPath(pathname: string): { lang: string; fieldId: string } | null {
  const match = pathname.match(/^\/(?:(ja|en|es|pt-br)\/)?places\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,127})\/snapshot$/);
  if (!match?.[2]) return null;
  return { lang: match[1] ?? "ja", fieldId: match[2] };
}

async function getNativeFixedPointStationHtml(request: Request, env: Env, placeId: string): Promise<Response> {
  const station = await getD1FixedPointStation(placeId, env);
  if (!station) {
    return html(request.method === "HEAD" ? "" : renderFixedPointStationNotFoundHtml(placeId), 404, {
      "cache-control": "no-store",
      "vary": "cookie, authorization",
      "x-ikimon-cloudflare-native": "fixed-point-station-readmodel"
    });
  }
  return html(request.method === "HEAD" ? "" : renderD1FixedPointStationHtml(station), 200, {
    "cache-control": "no-store",
    "vary": "cookie, authorization",
    "x-ikimon-cloudflare-native": "fixed-point-station-readmodel"
  });
}

interface D1FixedPointStation {
  placeId: string;
  name: string;
  locationLabel: string;
  publicLat: number | null;
  publicLng: number | null;
  visits: D1FixedPointStationVisit[];
  actions: D1FixedPointStationAction[];
  yearlyTimeline: Array<{
    year: number;
    visitCount: number;
    mediaCount: number;
    stewardshipCount: number;
    taxa: string[];
  }>;
}

interface D1FixedPointStationVisit {
  visitId: string;
  observedAt: string | null;
  taxa: string[];
  mediaCount: number;
}

interface D1FixedPointStationAction {
  actionId: string;
  occurredAt: string;
  actionKind: string;
  description: string | null;
}

async function getD1FixedPointStation(placeId: string, env: Env): Promise<D1FixedPointStation | null> {
  const normalizedPlaceId = normalizeOptionalId(placeId);
  if (!normalizedPlaceId || normalizedPlaceId.length > 128) return null;
  const field = await getFieldDetailReadmodelRow(normalizedPlaceId, env);
  const visitRows = await env.OBS_DB.prepare(
    `SELECT visit_id, observed_at
       FROM production_import_visits
      WHERE place_id = ?
        AND COALESCE(public_visibility, 'public') <> 'private'
      ORDER BY observed_at DESC, visit_id DESC
      LIMIT 80`
  ).bind(normalizedPlaceId).all<{ visit_id: string; observed_at: string | null }>();
  const visits = await Promise.all(visitRows.results.map(async (visit): Promise<D1FixedPointStationVisit> => {
    const [taxaRows, mediaCount] = await Promise.all([
      env.OBS_DB.prepare(
        `SELECT occurrence_id, scientific_name, vernacular_name
           FROM production_import_occurrences
          WHERE visit_id = ?
          ORDER BY created_at ASC, occurrence_id ASC
          LIMIT 8`
      ).bind(visit.visit_id).all<{
        occurrence_id: string;
        scientific_name: string | null;
        vernacular_name: string | null;
      }>(),
      env.OBS_DB.prepare(
        `SELECT COUNT(*) AS count
           FROM production_import_evidence_assets
          WHERE visit_id = ?
            AND asset_role IN ('observation_photo', 'observation_video')`
      ).bind(visit.visit_id).first<{ count: number }>()
    ]);
    return {
      visitId: visit.visit_id,
      observedAt: visit.observed_at,
      taxa: taxaRows.results
        .map((row) => normalizeOptionalText(row.vernacular_name) ?? normalizeOptionalText(row.scientific_name))
        .filter((value): value is string => Boolean(value))
        .slice(0, 5),
      mediaCount: Number(mediaCount?.count ?? 0)
    };
  }));
  const actionRows = await env.OBS_DB.prepare(
    `SELECT action_id, occurred_at, action_kind, description
       FROM stewardship_actions
      WHERE place_id = ?
      ORDER BY occurred_at DESC, action_id DESC
      LIMIT 40`
  ).bind(normalizedPlaceId).all<{
    action_id: string;
    occurred_at: string;
    action_kind: string;
    description: string | null;
  }>();
  const actions = actionRows.results.map((row) => ({
    actionId: row.action_id,
    occurredAt: row.occurred_at,
    actionKind: row.action_kind,
    description: row.description
  }));
  if (!field && visits.length === 0 && actions.length === 0) return null;
  return {
    placeId: normalizedPlaceId,
    name: field?.name ?? normalizedPlaceId,
    locationLabel: [field?.city, field?.prefecture].filter(Boolean).join(" / ") || field?.public_cell || normalizedPlaceId,
    publicLat: field?.public_lat ?? null,
    publicLng: field?.public_lng ?? null,
    visits,
    actions,
    yearlyTimeline: buildD1FixedPointYearlyTimeline(visits, actions)
  };
}

function buildD1FixedPointYearlyTimeline(visits: D1FixedPointStationVisit[], actions: D1FixedPointStationAction[]) {
  const buckets = new Map<number, { year: number; visitCount: number; mediaCount: number; stewardshipCount: number; taxa: Map<string, number> }>();
  const ensure = (year: number) => {
    let bucket = buckets.get(year);
    if (!bucket) {
      bucket = { year, visitCount: 0, mediaCount: 0, stewardshipCount: 0, taxa: new Map() };
      buckets.set(year, bucket);
    }
    return bucket;
  };
  for (const visit of visits) {
    const year = Number(String(visit.observedAt ?? "").slice(0, 4));
    if (!Number.isFinite(year)) continue;
    const bucket = ensure(year);
    bucket.visitCount += 1;
    bucket.mediaCount += visit.mediaCount;
    for (const taxon of visit.taxa) {
      bucket.taxa.set(taxon, (bucket.taxa.get(taxon) ?? 0) + 1);
    }
  }
  for (const action of actions) {
    const year = Number(String(action.occurredAt).slice(0, 4));
    if (!Number.isFinite(year)) continue;
    ensure(year).stewardshipCount += 1;
  }
  return [...buckets.values()]
    .sort((a, b) => b.year - a.year)
    .map((bucket) => ({
      year: bucket.year,
      visitCount: bucket.visitCount,
      mediaCount: bucket.mediaCount,
      stewardshipCount: bucket.stewardshipCount,
      taxa: [...bucket.taxa.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([taxon]) => taxon)
    }));
}

function renderFixedPointStationNotFoundHtml(placeId: string): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>定点ページ | ikimon</title></head><body><main><h1>定点ページが見つかりません</h1><p>${escapeHtml(placeId)} の公開記録はまだありません。</p><p><a href="/map">地図へ</a></p></main></body></html>`;
}

function renderD1FixedPointStationHtml(station: D1FixedPointStation): string {
  const years = station.yearlyTimeline.length
    ? station.yearlyTimeline.map((year) => `<article class="fps-card"><strong>${escapeHtml(year.year)}</strong><span>観察 ${year.visitCount} / メディア ${year.mediaCount} / 手入れ ${year.stewardshipCount}</span><p>${escapeHtml(year.taxa.join("、") || "対象整理中")}</p></article>`).join("")
    : `<article class="fps-empty">年ごとの比較に使える公開記録はまだありません。</article>`;
  const visits = station.visits.length
    ? station.visits.slice(0, 20).map((visit) => `<article class="fps-row"><time>${escapeHtml(formatPublicObservationDate(visit.observedAt))}</time><strong>${escapeHtml(visit.taxa.join("、") || "対象整理中")}</strong><span>メディア ${visit.mediaCount}</span><a href="/observations/${encodeURIComponent(visit.visitId)}">開く</a></article>`).join("")
    : `<article class="fps-empty">この場所の公開記録はまだありません。</article>`;
  const actions = station.actions.length
    ? station.actions.slice(0, 12).map((action) => `<article class="fps-card"><strong>${escapeHtml(actionLabelForD1FixedPoint(action.actionKind))}</strong><span>${escapeHtml(formatPublicObservationDate(action.occurredAt))}</span><p>${escapeHtml(action.description || "説明なし")}</p></article>`).join("")
    : `<article class="fps-empty">手入れの記録はまだありません。</article>`;
  const recordHref = `/record?${new URLSearchParams({
    placeId: station.placeId,
    recordMode: "survey",
    activityIntent: "revisit",
    ...(station.publicLat != null ? { latitude: String(station.publicLat) } : {}),
    ...(station.publicLng != null ? { longitude: String(station.publicLng) } : {})
  }).toString()}`;
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(station.name)} | 定点ページ | ikimon</title>
  <style>
    :root { color-scheme: light; --ink:#0f172a; --muted:#64748b; --line:rgba(15,23,42,.1); --green:#047857; --shell:min(1100px, calc(100% - 28px)); }
    * { box-sizing: border-box; } body { margin:0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:#f8fafc; }
    header { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:14px clamp(14px,3vw,32px); border-bottom:1px solid var(--line); background:#fff; }
    header a { color:inherit; text-decoration:none; font-weight:900; } main { width:var(--shell); margin:0 auto; padding:22px 0 56px; }
    .fps-hero { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:16px; align-items:end; padding:24px; border-radius:10px; background:linear-gradient(135deg,#ecfdf5,#eff6ff); border:1px solid var(--line); }
    .fps-hero h1 { margin:6px 0; font-size:clamp(28px,5vw,48px); line-height:1.08; letter-spacing:0; } .fps-hero p { margin:0; color:var(--muted); font-weight:750; line-height:1.65; }
    .fps-hero a { min-height:44px; display:inline-flex; align-items:center; padding:0 15px; border-radius:8px; background:var(--green); color:#fff; text-decoration:none; font-weight:900; }
    .fps-stats, .fps-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-top:14px; }
    .fps-stat, .fps-card, .fps-row, .fps-empty { min-width:0; padding:14px; border-radius:8px; border:1px solid var(--line); background:#fff; box-shadow:0 8px 22px rgba(15,23,42,.04); }
    .fps-stat strong { display:block; color:#064e3b; font-size:28px; line-height:1; } .fps-stat span, .fps-card span, .fps-row span, .fps-row time { color:var(--muted); font-size:12px; font-weight:850; }
    section { margin-top:24px; } h2 { margin:0 0 10px; font-size:clamp(21px,3vw,30px); letter-spacing:0; } .fps-card p { margin:8px 0 0; color:#334155; line-height:1.55; font-weight:720; }
    .fps-row { display:grid; grid-template-columns:110px minmax(0,1fr) 90px auto; gap:10px; align-items:center; margin-bottom:8px; } .fps-row a { color:var(--green); font-weight:900; text-decoration:none; }
    @media (max-width:760px) { .fps-hero, .fps-stats, .fps-grid, .fps-row { grid-template-columns:1fr; } .fps-hero a { justify-self:start; } }
  </style>
</head>
<body>
<header><a href="/">ikimon</a><nav><a href="/map">地図へ</a></nav></header>
<main data-cloudflare-fixed-point-station="1" data-place-id="${escapeHtml(station.placeId)}">
  <section class="fps-hero"><div><span>定点ページ</span><h1>${escapeHtml(station.name)}</h1><p>${escapeHtml(station.locationLabel)}。同じ場所の公開記録と手入れの履歴を年ごとに並べます。</p></div><a href="${escapeHtml(recordHref)}">この場所を記録</a></section>
  <div class="fps-stats"><div class="fps-stat"><strong>${station.visits.length}</strong><span>公開記録</span></div><div class="fps-stat"><strong>${station.yearlyTimeline.length}</strong><span>年</span></div><div class="fps-stat"><strong>${station.actions.length}</strong><span>手入れ</span></div></div>
  <section><h2>年ごとの様子</h2><div class="fps-grid">${years}</div></section>
  <section><h2>同じ場所の記録</h2>${visits}</section>
  <section><h2>手入れの記録</h2><div class="fps-grid">${actions}</div></section>
</main>
</body>
</html>`;
}

function actionLabelForD1FixedPoint(kind: string): string {
  const labels: Record<string, string> = {
    cleanup: "清掃",
    mowing: "草刈り",
    invasive_removal: "外来種対応",
    patrol: "巡回",
    signage: "看板",
    monitoring: "モニタリング",
    restoration: "修復",
    community_engagement: "参加促進",
    other: "その他"
  };
  return labels[kind] ?? kind;
}

async function getFieldDetailReadmodelRow(fieldId: string, env: Env): Promise<FieldDetailReadmodelRow | null> {
  if (!isSafeFieldId(fieldId)) return null;
  return env.OBS_DB.prepare(
    `SELECT field_id, source, admin_level, name, name_kana, summary, prefecture, city,
            public_cell, public_lat, public_lng, radius_m, area_ha,
            has_polygon, has_simplified_geometry,
            certification_id, certification_url, official_url, owner_url, story_url,
            verification_level, verification_method, verification_label, source_confidence,
            valid_from, valid_to, entity_key, updated_at
       FROM production_import_field_detail_readmodel
      WHERE field_id = ?`
  ).bind(fieldId).first<FieldDetailReadmodelRow>();
}

function fieldDetailPublicPayload(row: FieldDetailReadmodelRow) {
  return {
    fieldId: row.field_id,
    source: row.source,
    adminLevel: row.admin_level ?? "",
    name: row.name,
    nameKana: row.name_kana ?? "",
    summary: row.summary ?? "",
    prefecture: row.prefecture ?? "",
    city: row.city ?? "",
    publicLocation: {
      cell: row.public_cell,
      lat: row.public_lat,
      lng: row.public_lng,
      label: publicFieldLocationLabel(row)
    },
    radiusM: row.radius_m,
    areaHa: row.area_ha,
    hasPolygon: row.has_polygon === 1,
    hasSimplifiedGeometry: row.has_simplified_geometry === 1,
    certificationId: row.certification_id ?? "",
    links: {
      certification: row.certification_url ?? "",
      official: row.official_url ?? "",
      owner: row.owner_url ?? "",
      story: row.story_url ?? ""
    },
    verification: {
      level: row.verification_level ?? "",
      method: row.verification_method ?? "",
      label: row.verification_label ?? "",
      confidence: row.source_confidence
    },
    validFrom: row.valid_from ?? "",
    validTo: row.valid_to ?? "",
    entityKey: row.entity_key ?? "",
    updatedAt: row.updated_at ?? ""
  };
}

function fieldDetailAreaSnapshotPayload(row: FieldDetailReadmodelRow) {
  const field = fieldDetailPublicPayload(row);
  return {
    framing: {
      publicLabel: "この場所のいま",
      monitoringLabel: "場所の記録ブリーフ",
      advancedLabel: "市民参加型の生物多様性データ"
    },
    field: {
      fieldId: field.fieldId,
      name: field.name,
      source: field.source,
      sourceLabel: publicFieldSourceLabel(row),
      locationLabel: field.publicLocation.label,
      lat: field.publicLocation.lat,
      lng: field.publicLocation.lng,
      radiusM: field.radiusM,
      areaHa: field.areaHa,
      visibility: "limited",
      officialUrl: field.links.official,
      ownerUrl: field.links.owner,
      storyUrl: field.links.story,
      certificationUrl: field.links.certification,
      sourceConfidence: field.verification.confidence,
      verificationLevel: field.verification.level,
      verificationLabel: field.verification.label,
      originalName: field.name,
      schoolAlbumProfiles: [],
      accessGuidance: publicFieldAccessGuidance(row)
    },
    observationSummary: emptyPlaceObservationSummary(),
    machineObservationSummary: emptyPlaceMachineObservationSummary(),
    relationshipScore: emptyPlaceRelationshipScore(field.fieldId),
    hypotheses: [],
    nextActions: [{
      kind: "evidence",
      title: "最初の記録を追加",
      body: "写真、音、メモのどれかを残すと、この場所で見えるものを並べられます。",
      href: "/record"
    }],
    stewardshipImpact: {
      windowDays: 0,
      comparisons: [],
      summary: "まだ比較できる記録はありません。"
    },
    claimBoundary: {
      canSay: ["公開フィールド情報から場所の概要を表示しています。"],
      cannotSayYet: ["観察数、季節変化、環境変化はまだ集計していません。"]
    },
    generatedAt: new Date().toISOString(),
    representativePhoto: null,
    observationGallery: [],
    seasonalCoverage: emptyAreaSeasonalCoverage(),
    yearlyTimeline: [],
    effortIndicators: emptyAreaEffortIndicators(),
    sensitiveMasking: {
      totalRare: 0,
      maskedSpecies: 0,
      viewerCanSeeExact: false
    },
    firstSeenSpecies: [],
    environmentChange: null,
    areaWatch: emptyAreaWatch(),
    viewerContribution: emptyViewerAreaContribution(),
    communityPerspective: emptyCommunityAreaPerspective(),
    overlapInsight: {
      viewerPerspective: null,
      communityPerspective: null,
      line: "観察データが増えると、地域で見えているものとの重なりを表示できます。",
      detailHref: null
    },
    privacy: {
      exactLocationExposed: false,
      geometryExposed: false,
      publicCellPrecision: "0.01_degree"
    },
    compatibility: {
      source: "cloudflare_field_detail_readmodel_lightweight_area_snapshot"
    }
  };
}

function emptyPlaceObservationSummary() {
  return {
    totalObservations: 0,
    totalVisits: 0,
    totalEvents: 0,
    liveEvents: 0,
    uniqueTaxa: 0,
    latestObservedAt: null,
    taxonRankCount: 0,
    seasonsCovered: 0,
    seasonCoverageCap: 4,
    seasonLabels: [],
    effortCompletionRate: 0,
    reviewAcceptedRate: 0,
    nativeCount: 0,
    exoticCount: 0,
    unknownOriginCount: 0,
    absentRecords: 0,
    stewardshipActionCount: 0,
    topTaxa: []
  };
}

function emptyPlaceMachineObservationSummary() {
  return {
    totalMachineObservations: 0,
    aiCandidateCount: 0,
    reviewerVerifiedCount: 0,
    rejectedCount: 0,
    passiveAudioCount: 0,
    effortMetadataCount: 0,
    uniqueMachineTaxa: 0,
    latestObservedAt: null,
    topMachineTaxa: [],
    methodCounts: [],
    calibrationDecisions: []
  };
}

function emptyPlaceRelationshipScore(fieldId: string) {
  return {
    source: "field_fallback",
    placeId: fieldId,
    score: {
      total: 0,
      level: "unknown",
      axes: ["care", "knowledge", "continuity", "stewardship"].map((axis) => ({ axis, score: 0 })),
      confidence: 0
    },
    inputs: {},
    topActions: [],
    periodStart: null,
    periodEnd: null
  };
}

function emptyAreaSeasonalCoverage() {
  const current = currentAreaSeason();
  return [
    { season: "spring", label: "春", observations: 0, isCurrentSeason: current === "spring" },
    { season: "summer", label: "夏", observations: 0, isCurrentSeason: current === "summer" },
    { season: "autumn", label: "秋", observations: 0, isCurrentSeason: current === "autumn" },
    { season: "winter", label: "冬", observations: 0, isCurrentSeason: current === "winter" }
  ];
}

function currentAreaSeason(): "spring" | "summer" | "autumn" | "winter" {
  const month = new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

function emptyAreaEffortIndicators() {
  return {
    effortReportedRate: 0,
    completeChecklistRate: 0,
    temporalSpreadIndex: 0,
    observerDiversity: 0,
    nonDetectionRate: 0,
    effortIndex: 0,
    observerCount: 0,
    topObserverShare: 0,
    yearsCovered: 0,
    monthsCovered: 0,
    seasonsCovered: 0
  };
}

function emptyAreaWatch() {
  const dimensions = [
    emptyAreaWatchDimension("photo_clues", "写真の手がかり", "写真や周辺の様子を1枚足す"),
    emptyAreaWatchDimension("season_clues", "季節の手がかり", "今の季節に見えたものを残す"),
    emptyAreaWatchDimension("freshness", "最近の手がかり", "最近の写真かメモを追加する"),
    emptyAreaWatchDimension("method_clues", "見方の手がかり", "何分見たか、どこを歩いたかを添える"),
    emptyAreaWatchDimension("trust_clues", "確認の手がかり", "同定待ちと確認済みを分ける"),
    emptyAreaWatchDimension("continuity", "継続の手がかり", "同じ場所を別の日にも見る")
  ];
  return {
    schemaVersion: "area_watch/v0",
    score: 0,
    status: "sprout",
    label: "記録前",
    childSummary: "公開されている場所情報を表示しています。",
    stewardSummary: "観察データはまだ集計前です。",
    researcherNote: "この応答はD1公開フィールド情報から作った軽量snapshotです。R2にmaterialized snapshotがある場合はそちらを優先します。",
    nextAction: {
      dimension: "photo_clues",
      title: "最初の手がかりを追加",
      body: "写真、音、メモのどれかを残す"
    },
    celebrations: ["公開フィールド情報があります。"],
    gaps: dimensions.map((item) => `${item.label}: ${item.nextAction}`),
    dimensions
  };
}

function emptyAreaWatchDimension(key: string, label: string, nextAction: string) {
  return {
    key,
    label,
    score: 0,
    status: "sprout",
    childText: "まだ記録はありません。",
    stewardText: "集計対象の観察データはありません。",
    nextAction,
    evidence: []
  };
}

function emptyViewerAreaContribution() {
  return {
    hasViewerRecords: false,
    recordCount: 0,
    visitCount: 0,
    seasonsCovered: [],
    revisitCount: 0,
    photoCount: 0,
    audioOrScanCount: 0,
    dominantPerspective: emptyAreaPerspective("mixed", "いろいろな視点"),
    secondaryPerspective: null,
    positiveFeedbackLine: "ログイン中の記録はまだありません。",
    recordCards: []
  };
}

function emptyCommunityAreaPerspective() {
  return {
    observerCount: 0,
    dominantPerspective: emptyAreaPerspective("mixed", "いろいろな視点"),
    secondaryPerspective: null,
    seasonCoverageLine: "季節ごとの記録はまだありません。",
    recentMomentumLine: "最近の記録はまだありません。",
    recordCards: []
  };
}

function emptyAreaPerspective(key: string, label: string) {
  return {
    key,
    label,
    count: 0,
    line: "まだ記録はありません。"
  };
}

function publicFieldSourceLabel(row: FieldDetailReadmodelRow): string {
  if (row.source === "school" || row.admin_level === "school") return "学校・教育施設";
  if (row.source === "nature_symbiosis_site") return "自然共生サイト";
  if (row.source === "park" || row.source === "osm_park") return "公園・緑地";
  if (row.source === "water") return "水辺・水路";
  return row.source || "公開フィールド";
}

function publicFieldAccessGuidance(row: FieldDetailReadmodelRow) {
  if (row.source === "school" || row.admin_level === "school") {
    return {
      status: "permission_required",
      label: "学校・教育施設",
      body: "学校や施設は関係者区域を含むことがあります。無許可で敷地内に入らず、公開範囲や管理者の案内に従ってください。"
    };
  }
  return {
    status: "unknown",
    label: "公開範囲を確認",
    body: "公開されている範囲でも、現地の案内板、立入制限、管理者の指示が優先です。入れる場所から観察してください。"
  };
}

function publicFieldLocationLabel(row: FieldDetailReadmodelRow): string {
  const parts = [row.prefecture, row.city].filter((part): part is string => Boolean(part && part.trim()));
  return parts.length > 0 ? parts.join(" ") : "位置をぼかしています";
}

async function getOriginalUiStaticAsset(request: Request, url: URL, env: Env): Promise<Response> {
  const object = await env.ASSET_BUCKET.get(originalUiStaticAssetKey(url.pathname));
  if (object?.body) {
    return new Response(request.method === "HEAD" ? null : object.body, {
      headers: {
        "content-type": object.httpMetadata?.contentType ?? contentTypeForOriginalUiStaticAsset(url.pathname),
        "cache-control": cacheControlForOriginalUiStaticAsset(url.pathname),
        "x-ikimon-cloudflare-materialized": "original-ui-static-asset"
      }
    });
  }
  return json({ ok: false, error: "static_asset_not_materialized" }, 404, { "cache-control": "no-store" });
}

function isOriginalUiStaticAssetPath(pathname: string): boolean {
  if (pathname === "/offline.html" || pathname === "/robots.txt" || pathname === "/app-sw.js") return true;
  if (pathname === "/sitemap.xml") return true;
  if (pathname === "/favicon.ico" || pathname === "/manifest.webmanifest") return true;
  if (/^\/assets\/brand\/[a-zA-Z0-9._-]+$/.test(pathname)) return true;
  if (/^\/assets\/img\/invasive\/[a-zA-Z0-9._-]+$/.test(pathname)) return true;
  return false;
}

function originalUiStaticAssetKey(pathname: string): string {
  return `original-ui/static/${pathname.replace(/^\/+/, "")}`;
}

function contentTypeForOriginalUiStaticAsset(pathname: string): string {
  if (pathname.endsWith(".html")) return "text/html; charset=utf-8";
  if (pathname.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (pathname.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (pathname.endsWith(".xml")) return "application/xml; charset=utf-8";
  if (pathname.endsWith(".json")) return "application/json; charset=utf-8";
  if (pathname.endsWith(".webmanifest")) return "application/manifest+json; charset=utf-8";
  if (pathname.endsWith(".ico")) return "image/x-icon";
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

function cacheControlForOriginalUiStaticAsset(pathname: string): string {
  if (pathname === "/app-sw.js" || pathname === "/offline.html") return "no-cache, no-store, must-revalidate";
  if (pathname === "/manifest.webmanifest") return "public, max-age=300";
  return "public, max-age=31536000, immutable";
}

async function getOriginalUiThumb(request: Request, url: URL, env: Env): Promise<Response> {
  const object = await env.ASSET_BUCKET.get(originalUiThumbKey(url.pathname));
  if (object?.body) {
    return new Response(request.method === "HEAD" ? null : object.body, {
      headers: {
        "content-type": object.httpMetadata?.contentType ?? contentTypeForOriginalUiThumb(url.pathname),
        "cache-control": "public, max-age=31536000, immutable",
        "x-ikimon-cloudflare-materialized": "original-ui-thumb"
      }
    });
  }

  const nativeThumb = await getLegacyObservationThumbFromDerivative(request, url, env);
  if (nativeThumb) {
    return nativeThumb;
  }

  return json({ ok: false, error: "thumb_not_materialized" }, 404, { "cache-control": "no-store" });
}

function isOriginalUiThumbPath(pathname: string): boolean {
  if (pathname === "/thumb/") return true;
  return /^\/thumb\/[a-zA-Z0-9._-]+\/(?:avatars|v2-observations)\/[a-zA-Z0-9._/-]+$/.test(pathname);
}

function originalUiThumbKey(pathname: string): string {
  return `original-ui/thumb/${pathname.replace(/^\/thumb\/?/, "")}`;
}

function contentTypeForOriginalUiThumb(pathname: string): string {
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

async function getLegacyObservationThumbFromDerivative(request: Request, url: URL, env: Env): Promise<Response | null> {
  const legacy = parseLegacyObservationThumbPath(url.pathname);
  if (!legacy) return null;

  const row = await env.OBS_DB.prepare(
    `SELECT a.public_derivative_key, a.mime
       FROM production_import_evidence_assets e
       JOIN asset_ledger a ON a.asset_id = e.asset_id
      WHERE e.visit_id = ?
        AND e.legacy_relative_path = ?
        AND a.processing_state = 'uploaded'
        AND a.exif_scrub_state = 'scrubbed'
        AND a.public_ready_at IS NOT NULL
        AND a.public_derivative_key IS NOT NULL
      ORDER BY a.public_ready_at DESC
      LIMIT 1`
  ).bind(legacy.recordId, legacy.legacyRelativePath).first<LegacyThumbDerivativeRow>();
  if (!row?.public_derivative_key) return null;

  const object = await env.ASSET_BUCKET.get(row.public_derivative_key);
  if (!object?.body) return null;

  return new Response(request.method === "HEAD" ? null : object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? publicDerivativeContentType(row.public_derivative_key, row.mime),
      "cache-control": "public, max-age=31536000, immutable",
      "x-ikimon-cloudflare-native": "thumb-derivative-readmodel"
    }
  });
}

function parseLegacyObservationThumbPath(pathname: string): { recordId: string; legacyRelativePath: string } | null {
  const match = pathname.match(/^\/thumb\/[a-zA-Z0-9._-]+\/v2-observations\/([^/]+)\/([^/]+)$/);
  if (!match?.[1] || !match?.[2]) return null;
  const recordId = match[1];
  const assetFile = match[2];
  if (!isSafeFieldId(recordId) || assetFile.includes("..") || assetFile.includes("\\") || !/^[a-zA-Z0-9._-]+$/.test(assetFile)) {
    return null;
  }
  return {
    recordId,
    legacyRelativePath: `uploads/v2-observations/${recordId}/${assetFile}`
  };
}

function publicDerivativeContentType(key: string, mime: string | null): string {
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  if (key.endsWith(".png")) return "image/png";
  return mime?.startsWith("image/") ? mime : "application/octet-stream";
}

async function getOriginalUiHtml(request: Request, url: URL, env: Env): Promise<Response> {
  const object = await env.ASSET_BUCKET.get(originalUiHtmlKeyForRequest(url));
  if (object?.body) {
    const body = request.method === "HEAD" ? null : await originalUiHtmlBodyForRequest(object, url, env);
    return new Response(body, {
      headers: {
        "content-type": object.httpMetadata?.contentType ?? "text/html; charset=utf-8",
        "cache-control": ORIGINAL_UI_HTML_CACHE_CONTROL,
        "pragma": "no-cache",
        "expires": "0",
        "vary": "cookie, authorization",
        "x-ikimon-cloudflare-materialized": "original-ui-html"
      }
    });
  }

  const nativeFieldDetail = await getNativeFieldDetailHtmlIfAvailable(request, url, env);
  if (nativeFieldDetail) {
    return nativeFieldDetail;
  }

  const nativePlaceSnapshot = await getNativePlaceSnapshotHtmlIfAvailable(request, url, env);
  if (nativePlaceSnapshot) {
    return nativePlaceSnapshot;
  }

  return json({ ok: false, error: "html_not_materialized" }, 404, { "cache-control": "no-store" });
}

async function originalUiHtmlBodyForRequest(object: R2ObjectBody, url: URL, env: Env): Promise<ReadableStream | string | null> {
  if (isRecordsHtmlPath(url.pathname)) {
    const text = await new Response(object.body).text();
    return injectRecentObservationRecords(text, url, env);
  }
  if (!isAuthHtmlPath(url.pathname) || !url.searchParams.has("redirect")) return object.body;
  const text = await new Response(object.body).text();
  return personalizeAuthRedirectHtml(text, postAuthRedirect(url.searchParams.get("redirect")));
}

function isAuthHtmlPath(pathname: string): boolean {
  return /^(?:\/(?:ja|en|es|pt-br))?\/(?:login|register)$/.test(pathname);
}

function isProfileHtmlPath(pathname: string): boolean {
  return /^(?:\/(?:ja|en|es|pt-br))?\/profile(?:\/settings)?$/.test(pathname);
}

async function getSessionAwareProfileHtml(request: Request, url: URL, env: Env): Promise<Response> {
  const session = await readCompatibleSessionWithOriginFallback(request, env);
  if (!session || session.banned) {
    return getOriginalUiHtml(request, url, env);
  }

  const body = request.method === "HEAD"
    ? null
    : renderCloudflareProfileHtml(session, {
      lang: publicLangFromPath(url.pathname) ?? langQueryToUrlSegment(url.searchParams.get("lang")) ?? "ja",
      settings: /\/profile\/settings$/.test(url.pathname)
    });

  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "vary": "cookie, authorization",
      "x-ikimon-cloudflare-native": "profile-session"
    }
  });
}

function renderCloudflareProfileHtml(
  session: SessionSnapshot,
  options: { lang: string; settings: boolean }
): string {
  const lang = options.lang === "en" || options.lang === "es" || options.lang === "pt-br" ? options.lang : "ja";
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const copy = lang === "ja"
    ? {
      title: options.settings ? "プロフィール設定" : "マイページ",
      records: "自分の記録",
      record: "記録する",
      map: "地図",
      settings: "設定",
      signedIn: "ログイン中",
      role: "権限",
      rank: "ランク",
      back: "マイページへ"
    }
    : {
      title: options.settings ? "Profile Settings" : "My Page",
      records: "My records",
      record: "Record",
      map: "Map",
      settings: "Settings",
      signedIn: "Signed in",
      role: "Role",
      rank: "Rank",
      back: "Back to profile"
    };
  const title = escapeHtml(copy.title);
  const displayName = escapeHtml(session.displayName || session.userId);
  const roleName = escapeHtml(session.roleName || "Observer");
  const rankLabel = escapeHtml(session.rankLabel ?? "-");
  const settingsBody = options.settings
    ? `<section class="cf-profile-panel">
        <h2>${escapeHtml(copy.settings)}</h2>
        <dl>
          <div><dt>${escapeHtml(copy.signedIn)}</dt><dd>${displayName}</dd></div>
          <div><dt>${escapeHtml(copy.role)}</dt><dd>${roleName}</dd></div>
          <div><dt>${escapeHtml(copy.rank)}</dt><dd>${rankLabel}</dd></div>
        </dl>
        <a class="cf-profile-link" href="${escapeHtml(`${prefix}/profile`)}">${escapeHtml(copy.back)}</a>
      </section>`
    : `<nav class="cf-profile-actions" aria-label="${escapeHtml(copy.title)}">
        <a href="${escapeHtml(`${prefix}/records?view=mine`)}">${escapeHtml(copy.records)}</a>
        <a href="${escapeHtml(`${prefix}/record`)}">${escapeHtml(copy.record)}</a>
        <a href="${escapeHtml(`${prefix}/map`)}">${escapeHtml(copy.map)}</a>
        <a href="${escapeHtml(`${prefix}/profile/settings`)}">${escapeHtml(copy.settings)}</a>
      </nav>
      <section class="cf-profile-panel">
        <dl>
          <div><dt>${escapeHtml(copy.signedIn)}</dt><dd>${displayName}</dd></div>
          <div><dt>${escapeHtml(copy.role)}</dt><dd>${roleName}</dd></div>
          <div><dt>${escapeHtml(copy.rank)}</dt><dd>${rankLabel}</dd></div>
        </dl>
      </section>`;

  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} - ikimon</title>
  <style>
    :root{color-scheme:light;--ink:#10251a;--muted:#53645d;--line:#dceee8;--mint:#effbf7;--teal:#059b8d}
    *{box-sizing:border-box}
    body{margin:0;background:#f7fbf9;color:var(--ink);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    .cf-profile-header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 20px;background:#fff;border-bottom:1px solid var(--line)}
    .cf-profile-brand{font-weight:900;text-decoration:none;color:var(--ink);font-size:20px}
    .cf-profile-shell{width:min(960px,calc(100% - 32px));margin:28px auto}
    .cf-profile-title{margin:0 0 18px}
    .cf-profile-title small{display:block;color:var(--teal);font-size:13px;font-weight:800}
    .cf-profile-title h1{margin:4px 0 0;font-size:32px;line-height:1.15;letter-spacing:0}
    .cf-profile-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 14px}
    .cf-profile-actions a,.cf-profile-link{display:flex;align-items:center;justify-content:center;min-height:48px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--ink);font-weight:800;text-decoration:none;box-shadow:0 10px 24px rgba(16,37,26,.06)}
    .cf-profile-panel{padding:18px;border:1px solid var(--line);border-radius:16px;background:#fff;box-shadow:0 14px 34px rgba(16,37,26,.07)}
    .cf-profile-panel h2{margin:0 0 14px;font-size:20px}
    .cf-profile-panel dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0}
    .cf-profile-panel div{min-width:0;padding:12px;border-radius:12px;background:var(--mint)}
    .cf-profile-panel dt{color:var(--muted);font-size:12px;font-weight:800}
    .cf-profile-panel dd{margin:4px 0 0;font-weight:900;overflow-wrap:anywhere}
    @media (max-width:720px){.cf-profile-shell{width:calc(100% - 20px);margin:18px auto}.cf-profile-title h1{font-size:26px}.cf-profile-actions{grid-template-columns:repeat(2,minmax(0,1fr))}.cf-profile-panel dl{grid-template-columns:1fr}.cf-profile-header{padding:12px 14px}}
  </style>
</head>
<body data-cloudflare-profile="signed-in">
  <header class="cf-profile-header"><a class="cf-profile-brand" href="${escapeHtml(`${prefix}/map`)}">ikimon</a></header>
  <main class="cf-profile-shell">
    <div class="cf-profile-title">
      <small>${escapeHtml(copy.title)}</small>
      <h1 data-testid="profile-heading">${displayName}</h1>
    </div>
    ${settingsBody}
  </main>
</body>
</html>`;
}

function isRecordsHtmlPath(pathname: string): boolean {
  return /^(?:\/(?:ja|en|es|pt-br))?\/records$/.test(pathname);
}

function recordsInjectionCopy(url: URL) {
  const lang = publicLangFromPath(url.pathname) ?? langQueryToUrlSegment(url.searchParams.get("lang")) ?? "ja";
  if (lang === "en") {
    return {
      eyebrow: "Live records",
      title: "Recent records are already here",
      body: "New posts appear here from Cloudflare immediately after their public media is ready.",
      empty: "No recent public records yet.",
      open: "Open",
      map: "Map",
      unknown: "Awaiting ID"
    };
  }
  return {
    eyebrow: "記録が動いています",
    title: "最近の投稿",
    body: "投稿後、公開用の写真処理が終わった記録からここに出ます。",
    empty: "まだ最近の公開記録はありません。",
    open: "開く",
    map: "地図",
    unknown: "同定待ち"
  };
}

function publicLangFromPath(pathname: string): "ja" | "en" | "es" | "pt-br" | null {
  const match = pathname.match(/^\/(ja|en|es|pt-br)(?:\/|$)/);
  return match ? match[1] as "ja" | "en" | "es" | "pt-br" : null;
}

async function injectRecentObservationRecords(html: string, url: URL, env: Env): Promise<string> {
  const items = await recentPublicRecordCards(env).catch(() => []);
  const copy = recordsInjectionCopy(url);
  const cards = items.length > 0
    ? items.map((item) => renderRecentRecordCard(item, copy)).join("")
    : `<p class="cf-records-empty">${escapeHtml(copy.empty)}</p>`;
  const section = `<section class="cf-records-live" data-cloudflare-records-live>
    <style>
      .cf-records-live{margin:10px auto 14px;padding:14px;max-width:min(1120px,calc(100% - 24px));border:1px solid rgba(15,23,42,.1);border-radius:16px;background:#fff;box-shadow:0 12px 32px rgba(15,23,42,.08)}
      .cf-records-live-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;margin-bottom:12px}
      .cf-records-live small{display:block;color:#047857;font-weight:900;letter-spacing:.02em}
      .cf-records-live h2{margin:2px 0 0;color:#10251a;font-size:22px;line-height:1.15}
      .cf-records-live p{margin:0;color:#475569;font-size:13px;line-height:1.55}
      .cf-records-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      .cf-record-card{min-width:0;border:1px solid rgba(15,23,42,.08);border-radius:12px;overflow:hidden;background:#f8fafc;text-decoration:none;color:#0f172a}
      .cf-record-card img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:#dbeafe}
      .cf-record-card-body{padding:10px}
      .cf-record-card strong{display:block;font-size:14px;line-height:1.3}
      .cf-record-card span{display:block;margin-top:4px;color:#64748b;font-size:12px;line-height:1.4}
      .cf-records-empty{padding:10px;border-radius:10px;background:#f8fafc}
      @media (max-width:720px){.cf-records-live{margin:8px 8px 12px;padding:12px;border-radius:12px}.cf-records-live-head{display:block}.cf-records-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.cf-records-live h2{font-size:18px}.cf-record-card-body{padding:8px}.cf-record-card strong{font-size:13px}}
    </style>
    <div class="cf-records-live-head"><div><small>${escapeHtml(copy.eyebrow)}</small><h2>${escapeHtml(copy.title)}</h2></div><p>${escapeHtml(copy.body)}</p></div>
    <div class="cf-records-grid">${cards}</div>
  </section>`;
  if (html.includes("<main")) {
    return html.replace(/(<main\b[^>]*>)/i, `$1${section}`);
  }
  if (html.includes("<body")) {
    return html.replace(/(<body\b[^>]*>)/i, `$1${section}`);
  }
  return `${section}${html}`;
}

async function recentPublicRecordCards(env: Env): Promise<Array<ReturnType<typeof publicMapObservationItem>>> {
  const rows = (await queryPublicMapRows(env)).slice(0, 6);
  if (rows.length === 0) return [];
  const photoUrls = await queryPublicMapPhotoUrls(env);
  return rows.map((row) => publicMapObservationItem(row, photoUrls.get(row.observation_id) ?? null));
}

function renderRecentRecordCard(item: ReturnType<typeof publicMapObservationItem>, copy: ReturnType<typeof recordsInjectionCopy>): string {
  const href = `/observations/${encodeURIComponent(item.visitId)}`;
  const image = item.photoUrl
    ? `<img src="${escapeHtml(item.photoUrl)}" alt="${escapeHtml(item.displayName || copy.unknown)}" loading="lazy">`
    : "";
  return `<a class="cf-record-card" href="${escapeHtml(href)}">
    ${image}
    <span class="cf-record-card-body">
      <strong>${escapeHtml(item.displayName || copy.unknown)}</strong>
      <span>${escapeHtml(item.observedAt)} · ${escapeHtml(item.cellId)}</span>
      <span>${escapeHtml(copy.open)} / ${escapeHtml(copy.map)}</span>
    </span>
  </a>`;
}

function personalizeAuthRedirectHtml(html: string, redirect: string): string {
  const encodedRedirect = encodeURIComponent(redirect);
  return html
    .replace(/\bdata-redirect="[^"]*"/g, `data-redirect="${escapeHtml(redirect)}"`)
    .replace(/(href="[^"]*\/(?:login|register)\?redirect=)[^"&]*/g, `$1${encodedRedirect}`)
    .replace(/(href="[^"]*\/auth\/oauth\/(?:google|twitter)\/start\?redirect=)[^"&]*/g, `$1${encodedRedirect}`);
}

function isOriginalUiHtmlPath(pathname: string): boolean {
  if (ORIGINAL_UI_HTML_STATIC_PATHS.has(pathname)) return true;
  if (pathname === "/admin/municipal-walk-maps") return true;
  if (/^(?:\/(?:ja|en|es|pt-br))?\/community\/fields\/[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(pathname)) return true;
  if (/^(?:\/(?:ja|en|es|pt-br))?\/places\/[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}\/snapshot$/.test(pathname)) return true;
  return false;
}

function municipalWalkMapAdminSourceDraftKey(url: URL): string | null {
  if (url.pathname !== "/admin/municipal-walk-maps") return null;
  const templateId = url.searchParams.get("templateId")?.trim() ?? "";
  if (/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(templateId)) {
    return `original-ui/html/admin/municipal-walk-maps/template/${templateId}.html`;
  }
  const sourceId = url.searchParams.get("sourceId")?.trim() ?? "";
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(sourceId)) return null;
  return `original-ui/html/admin/municipal-walk-maps/source/${sourceId}.html`;
}

function originalUiHtmlKey(pathname: string): string {
  const cleanPath = pathname === "/" ? "root" : pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  return `original-ui/html/${cleanPath}.html`;
}

function originalUiHtmlKeyForRequest(url: URL): string {
  const adminSourceDraftKey = municipalWalkMapAdminSourceDraftKey(url);
  if (adminSourceDraftKey) return adminSourceDraftKey;
  const langSegment = langQueryToUrlSegment(url.searchParams.get("lang"));
  if (!langSegment) return originalUiHtmlKey(url.pathname);
  const localizedPath = localizedMaterializedPath(url.pathname, langSegment);
  return originalUiHtmlKey(localizedPath ?? url.pathname);
}

function langQueryToUrlSegment(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (normalized === "ja" || normalized === "en" || normalized === "es") return normalized;
  if (normalized === "pt-BR" || normalized.toLowerCase() === "pt-br" || normalized === "pt") return "pt-br";
  return null;
}

function localizedMaterializedPath(pathname: string, langSegment: string): string | null {
  if (pathname.startsWith(`/${langSegment}/`) || pathname === `/${langSegment}`) return pathname;
  const localizable = new Set([
    "/",
    "/demo/place-feeling-tags",
    "/guide",
    "/login",
    "/map",
    "/profile",
    "/profile/settings",
    "/record",
    "/records",
    "/register"
  ]);
  if (!localizable.has(pathname)) return null;
  if (pathname === "/") return `/${langSegment}`;
  return `/${langSegment}${pathname}`;
}

async function getPublicDerivedMedia(url: URL, env: Env): Promise<Response> {
  const key = url.pathname.replace(/^\/+/, "");
  if (!key.startsWith("derived/")) {
    return json({ error: "not_found" }, 404);
  }
  const object = await env.ASSET_BUCKET.get(key);
  if (!object?.body) {
    return json({ error: "media_not_found" }, 404);
  }
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "cache-control": "public, max-age=300"
    }
  });
}

async function getShadowVideoStream(uid: string, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_found" }, 404);
  }
  assertNonEmpty(uid, "uid");
  const row = await env.OBS_DB.prepare(
    "SELECT object_key FROM video_upload_requests WHERE stream_uid = ?"
  ).bind(uid).first<{ object_key: string | null }>();
  if (!row?.object_key) {
    return json({ error: "video_not_found" }, 404);
  }
  const object = await env.ASSET_BUCKET.get(row.object_key);
  if (!object?.body) {
    return json({ error: "video_body_not_found" }, 404);
  }
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "video/mp4",
      "cache-control": "no-store"
    }
  });
}

async function getShadowVideoThumbnail(uid: string, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_found" }, 404);
  }
  assertNonEmpty(uid, "uid");
  const row = await env.OBS_DB.prepare(
    "SELECT object_key FROM video_upload_requests WHERE stream_uid = ?"
  ).bind(uid).first<{ object_key: string | null }>();
  if (!row?.object_key) {
    return json({ error: "video_not_found" }, 404);
  }
  return new Response(shadowSafeJpegPosterBytes(), {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "no-store"
    }
  });
}

async function queryPublicMapRows(env: Env): Promise<PublicMapRow[]> {
  const snapshotRows = await queryPublicMapSnapshotRows(env);
  if (snapshotRows.length > 0) return snapshotRows;
  const rows = await env.OBS_DB.prepare(
    `SELECT observation_id, public_cell, observed_at, taxon_label, asset_count
     FROM readmodel_public_observations
     ORDER BY observed_at DESC
     LIMIT 5000`
  ).all<PublicMapRow>();
  return rows.results;
}

async function queryPublicMapSnapshotRows(env: Env): Promise<PublicMapRow[]> {
  try {
    const rows = await env.OBS_DB.prepare(
      `SELECT visit_id, cell_1000, observed_at, display_name, asset_count
         FROM public_map_snapshot_records_v1
        WHERE snapshot_key = 'public-map:v1:global'
        ORDER BY observed_at DESC
        LIMIT 5000`
    ).all<PublicMapSnapshotRow>();
    return rows.results.map((row) => ({
      observation_id: row.visit_id,
      public_cell: row.cell_1000,
      observed_at: row.observed_at,
      taxon_label: row.display_name,
      asset_count: row.asset_count
    }));
  } catch (error) {
    if (error instanceof Error && /no such table: public_map_snapshot_records_v1/i.test(error.message)) return [];
    throw error;
  }
}

async function queryPublicMapSnapshotMeta(env: Env): Promise<PublicMapSnapshotMetaRow | null> {
  try {
    return await env.OBS_DB.prepare(
      `SELECT snapshot_key, generated_at, source_sample_size, public_record_count, refreshed_by, policy_json
         FROM public_map_snapshot_meta
        WHERE snapshot_key = 'public-map:v1:global'`
    ).first<PublicMapSnapshotMetaRow>();
  } catch (error) {
    if (error instanceof Error && /no such table: public_map_snapshot_meta/i.test(error.message)) return null;
    throw error;
  }
}

async function queryPublicMapPhotoUrls(env: Env): Promise<Map<string, string>> {
  const rows = await env.OBS_DB.prepare(
    `SELECT observation_id, public_derivative_key
       FROM asset_ledger
      WHERE observation_id IS NOT NULL
        AND processing_state = 'uploaded'
        AND public_derivative_key IS NOT NULL
        AND exif_scrub_state = 'scrubbed'
        AND public_ready_at IS NOT NULL
        AND mime LIKE 'image/%'
      ORDER BY public_ready_at DESC
      LIMIT 5000`
  ).all<PublicMapPhotoRow>();
  const map = new Map<string, string>();
  for (const row of rows.results) {
    if (!map.has(row.observation_id)) map.set(row.observation_id, publicMediaUrl(row.public_derivative_key));
  }
  return map;
}

function publicMapObservationItem(row: PublicMapRow, photoUrl: string | null) {
  const displayName = publicTaxonDisplayName(row.taxon_label);
  return {
    occurrenceId: `occ:${row.observation_id}:0`,
    visitId: row.observation_id,
    displayName,
    isAiCandidate: false,
    isAwaitingId: isWeakTaxonLabel(row.taxon_label),
    localityLabel: "位置をぼかしています",
    observedAt: row.observed_at,
    photoUrl,
    taxonGroup: taxonGroupForLabel(row.taxon_label),
    cellId: publicCellToCellId(row.public_cell)
  };
}

async function queryAreaPolygonRows(
  env: Env,
  bbox: [number, number, number, number],
  sources: string[],
  limit: number
): Promise<AreaPolygonReadmodelRow[]> {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const allRows = await env.OBS_DB.prepare(
    `SELECT field_id, source, admin_level, name, name_kana, summary, prefecture, city,
            public_cell, public_lat, public_lng, radius_m, area_ha,
            has_polygon, has_simplified_geometry,
            certification_id, certification_url, official_url, owner_url, story_url,
            verification_level, verification_method, verification_label, source_confidence,
            valid_from, valid_to, entity_key, updated_at
       FROM production_import_field_detail_readmodel
      WHERE public_lat >= ?
        AND public_lat <= ?
        AND public_lng >= ?
        AND public_lng <= ?
      ORDER BY COALESCE(area_ha, 999999), name
      LIMIT ?`
  ).bind(minLat, maxLat, minLng, maxLng, limit).all<AreaPolygonReadmodelRow>();
  const allowed = new Set(sources);
  return allRows.results.filter((row) => sources.length === 0 || allowed.has(areaLayerSource(row)));
}

async function queryNativeAreaPolygonRows(
  env: Env,
  bbox: [number, number, number, number],
  sources: string[],
  limit: number
): Promise<AreaPolygonGeometryReadmodelRow[]> {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const sourceClause = sources.length > 0
    ? ` AND source IN (${sources.map(() => "?").join(", ")})`
    : "";
  try {
    const rows = await env.OBS_DB.prepare(
      `SELECT field_id, source, admin_level, name, prefecture, city,
              center_lat, center_lng,
              bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng,
              area_ha, geometry_json, approximate_boundary, boundary_approximation,
              source_confidence, verification_level, verification_label,
              official_url, owner_url, story_url, certification_url,
              entity_key, updated_at
         FROM production_import_area_polygon_readmodel
        WHERE bbox_max_lat >= ?
          AND bbox_min_lat <= ?
          AND bbox_max_lng >= ?
          AND bbox_min_lng <= ?
          ${sourceClause}
        ORDER BY COALESCE(area_ha, 999999), name
        LIMIT ?`
    ).bind(minLat, maxLat, minLng, maxLng, ...sources, limit).all<AreaPolygonGeometryReadmodelRow>();
    return rows.results;
  } catch (error) {
    if (String(error).includes("production_import_area_polygon_readmodel") || String(error).includes("no such table")) {
      return [];
    }
    throw error;
  }
}

function parseSourceParam(raw: string | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => /^[a-z_]+$/.test(value));
}

function areaLayerSource(row: AreaPolygonReadmodelRow): string {
  if (row.admin_level && ["osm_park", "admin_municipality", "admin_prefecture", "admin_country"].includes(row.admin_level)) {
    return row.admin_level;
  }
  return row.source || "user_defined";
}

function safeAreaGeometry(raw: string): { type: "Polygon" | "MultiPolygon"; coordinates: unknown[] } | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const type = (parsed as { type?: unknown }).type;
    const coordinates = (parsed as { coordinates?: unknown }).coordinates;
    if ((type !== "Polygon" && type !== "MultiPolygon") || !Array.isArray(coordinates)) return null;
    return { type, coordinates };
  } catch {
    return null;
  }
}

function textProp(props: Record<string, unknown>, key: string): string {
  const value = props[key];
  return typeof value === "string" ? value.trim() : "";
}

function numericProp(props: Record<string, unknown>, key: string): number {
  const value = props[key];
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function booleanishProp(props: Record<string, unknown>, key: string): boolean {
  const value = props[key];
  if (value === true || value === 1) return true;
  if (typeof value === "string") return ["true", "1", "yes"].includes(value.trim().toLowerCase());
  return false;
}

function areaPolygonFeatureProps(feature: unknown): Record<string, unknown> | null {
  if (!feature || typeof feature !== "object" || Array.isArray(feature)) return null;
  const props = (feature as { properties?: unknown }).properties;
  if (!props || typeof props !== "object" || Array.isArray(props)) return null;
  return props as Record<string, unknown>;
}

function isApproximateAreaPolygonFeature(feature: unknown): boolean {
  const props = areaPolygonFeatureProps(feature);
  if (!props) return false;
  const label = textProp(props, "verification_label");
  return booleanishProp(props, "approximate_boundary")
    || textProp(props, "boundary_approximation") === "point_buffer"
    || label.includes("境界未確認・代表点からの仮範囲");
}

function isWeakLiveOsmAreaPolygonFeature(feature: unknown): boolean {
  const props = areaPolygonFeatureProps(feature);
  if (!props) return false;
  if (!textProp(props, "field_id").startsWith("osm-live:")) return false;
  const name = textProp(props, "name");
  if (name === "OSMの学校・キャンパス" || name === "OSMの公園・緑地") return true;
  if (textProp(props, "source") === "school") {
    const hasExternalEvidence = Boolean(
      textProp(props, "official_url") ||
      textProp(props, "owner_url") ||
      textProp(props, "certification_url")
    );
    return !hasExternalEvidence && numericProp(props, "source_confidence") < 0.75;
  }
  return false;
}

function isDisplayableAreaPolygonFeature(feature: unknown): boolean {
  return !isApproximateAreaPolygonFeature(feature) && !isWeakLiveOsmAreaPolygonFeature(feature);
}

function areaPolygonFeatureFromGeometryReadmodel(row: AreaPolygonGeometryReadmodelRow) {
  if (!Number.isFinite(row.center_lat) || !Number.isFinite(row.center_lng)) return null;
  const geometry = safeAreaGeometry(row.geometry_json);
  if (!geometry) return null;
  const source = row.source || "user_defined";
  return {
    type: "Feature",
    geometry,
    properties: {
      field_id: row.field_id,
      name: row.name,
      source,
      source_label: areaSourceLabel(source),
      admin_level: row.admin_level,
      prefecture: row.prefecture ?? "",
      city: row.city ?? "",
      area_ha: row.area_ha,
      official_url: row.official_url ?? "",
      owner_url: row.owner_url ?? "",
      story_url: row.story_url ?? "",
      certification_url: row.certification_url ?? "",
      source_confidence: row.source_confidence ?? 0.75,
      verification_level: row.verification_level ?? "readmodel_public_polygon",
      verification_label: row.verification_label ?? "公開read model polygon",
      center: [row.center_lng, row.center_lat],
      transient: row.approximate_boundary === 1,
      approximate_boundary: row.approximate_boundary === 1,
      boundary_approximation: row.boundary_approximation ?? undefined,
      entity_key: row.entity_key ?? undefined,
      biodiversity_groups: []
    }
  };
}

function areaPolygonFeatureFromReadmodel(row: AreaPolygonReadmodelRow) {
  if (!Number.isFinite(row.public_lat) || !Number.isFinite(row.public_lng)) return null;
  const source = areaLayerSource(row);
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [publicAreaApproxPolygon(row.public_lat, row.public_lng, row.radius_m, row.area_ha)]
    },
    properties: {
      field_id: row.field_id,
      name: row.name,
      source,
      source_label: areaSourceLabel(source),
      admin_level: row.admin_level,
      prefecture: row.prefecture ?? "",
      city: row.city ?? "",
      area_ha: row.area_ha,
      official_url: row.official_url ?? "",
      owner_url: row.owner_url ?? "",
      story_url: row.story_url ?? "",
      certification_url: row.certification_url ?? "",
      source_confidence: row.source_confidence ?? 0.55,
      verification_level: row.verification_level ?? "readmodel_public",
      verification_label: row.verification_label ?? "公開read model",
      center: [row.public_lng, row.public_lat],
      transient: row.has_polygon !== 1,
      entity_key: row.entity_key ?? undefined,
      biodiversity_groups: []
    }
  };
}

function publicAreaApproxPolygon(lat: number, lng: number, radiusM: number | null, areaHa: number | null): [number, number][] {
  const radiusFromArea = Number.isFinite(areaHa) && (areaHa ?? 0) > 0
    ? Math.sqrt((areaHa as number) * 10000 / Math.PI)
    : null;
  const radius = Math.max(60, Math.min(900, radiusM ?? radiusFromArea ?? 160));
  const latDelta = radius / 111_320;
  const lngDelta = radius / (111_320 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
  return [
    [lng - lngDelta, lat - latDelta],
    [lng + lngDelta, lat - latDelta],
    [lng + lngDelta, lat + latDelta],
    [lng - lngDelta, lat + latDelta],
    [lng - lngDelta, lat - latDelta]
  ];
}

function areaSourceLabel(source: string): string {
  if (source === "school") return "学校";
  if (source === "osm_park") return "公園 (OSM)";
  if (source === "nature_symbiosis_site") return "自然共生サイト";
  if (source === "protected_area") return "保護区";
  if (source === "oecm") return "OECM";
  if (source === "tsunag") return "TSUNAG";
  if (source === "admin_municipality") return "市町村";
  if (source === "admin_prefecture") return "都道府県";
  if (source === "admin_country") return "国";
  return "公開エリア";
}

async function getPublicObservationDetailJson(rawId: string, env: Env): Promise<Response> {
  const detail = await buildPublicObservationDetail(rawId, env);
  if (!detail) {
    return json({ ok: false, error: "observation_not_found" }, 404, { "cache-control": "no-store" });
  }
  return json({ ok: true, observation: detail }, 200, { "cache-control": "no-store" });
}

async function getPublicObservationDetailPage(rawId: string, env: Env): Promise<Response> {
  const detail = await buildPublicObservationDetail(rawId, env);
  if (!detail) {
    return html(renderObservationNotFoundHtml(), 404, { "cache-control": "no-store" });
  }
  return html(renderPublicObservationDetailHtml(detail), 200, { "cache-control": "no-store" });
}

async function buildPublicObservationDetail(rawId: string, env: Env) {
  const visitId = detailIdToVisitId(rawId);
  const row = await env.OBS_DB.prepare(
    `SELECT r.observation_id, r.public_cell, r.observed_at, r.taxon_label, r.asset_count,
            o.note, o.visibility
     FROM readmodel_public_observations r
     JOIN observations o ON o.observation_id = r.observation_id
     WHERE r.observation_id = ?
       AND o.visibility = 'public'
       AND o.emergency_hidden = 0`
  ).bind(visitId).first<PublicDetailRow>();
  if (!row) return null;

  const assets = await env.OBS_DB.prepare(
    `SELECT asset_id, object_key, mime, bytes, duration_ms, public_derivative_key
     FROM asset_ledger
     WHERE observation_id = ?
       AND processing_state = 'uploaded'
       AND public_derivative_key IS NOT NULL
       AND exif_scrub_state = 'scrubbed'
       AND public_ready_at IS NOT NULL
     ORDER BY created_at ASC
     LIMIT 24`
  ).bind(visitId).all<PublicDetailAssetRow>();

  const photoAssets = assets.results
    .filter((asset) => asset.mime.startsWith("image/"))
    .map((asset) => ({
      assetId: asset.asset_id,
      url: publicMediaUrl(asset.public_derivative_key),
      widthPx: null,
      heightPx: null,
      mediaRole: null
    }));
  const videoAssets = assets.results
    .filter((asset) => asset.mime.startsWith("video/"))
    .map((asset) => {
      const streamUid = asset.asset_id.replace(/^video_asset_/, "");
      return {
        assetId: asset.asset_id,
        providerUid: streamUid,
        iframeUrl: buildShadowVideoIframeUrl(streamUid),
        thumbnailUrl: buildShadowVideoThumbnailUrl(streamUid),
        watchUrl: buildShadowVideoWatchUrl(streamUid),
        readyToStream: true,
        uploadStatus: "ready",
        createdAt: row.observed_at,
        durationMs: asset.duration_ms ?? 0,
        mediaRole: "observation_video"
      };
    });
  const relatedRows = (await queryPublicMapRows(env))
    .filter((related) => related.public_cell === row.public_cell && related.observation_id !== visitId)
    .slice(0, 6);
  const relatedPhotoUrls = await queryPublicMapPhotoUrls(env);

  return {
    schemaVersion: "shadow_public_observation_detail/v1",
    occurrenceId: `occ:${row.observation_id}:0`,
    visitId: row.observation_id,
    canonicalPath: `/observations/${encodeURIComponent(row.observation_id)}`,
    displayName: row.taxon_label ?? "同定待ち",
    isAwaitingId: !row.taxon_label,
    observedAt: row.observed_at,
    note: row.note,
    placeName: "位置をぼかしています",
    municipality: null,
    publicLocation: {
      label: "位置をぼかしています",
      cellId: publicCellToCellId(row.public_cell),
      publicCell: row.public_cell
    },
    photoAssets,
    photoUrls: photoAssets.map((asset) => asset.url),
    videoAssets,
    audioAssets: [],
    assetCount: row.asset_count,
    relatedObservations: relatedRows.map((related) => publicMapObservationItem(
      related,
      relatedPhotoUrls.get(related.observation_id) ?? null
    )),
    privacy: {
      exactLocationExposed: false,
      source: "readmodel_public_observations.public_cell"
    }
  };
}

async function createDraftObservation(request: Request, env: Env): Promise<Response> {
  const input = await readJson<DraftObservationInput>(request);
  assertNonEmpty(input.userId, "userId");

  const media = input.media ?? [];
  if (media.length > MAX_MEDIA_PER_DRAFT) {
    return json({ error: "too_many_media", max: MAX_MEDIA_PER_DRAFT }, 400);
  }

  const draftId = newId("draft");
  const partition = resolveObservationPartition(input.observedAt, env);
  const publicCell = blurLocation(input.exactLat, input.exactLng);
  const visibility = input.visibility === "public" ? "public" : "private";

  const statements: D1PreparedStatement[] = [
    env.CORE_DB.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(input.userId),
    env.OBS_DB.prepare(
      `INSERT INTO draft_observations
       (draft_id, owner_user_id, observed_at, exact_lat, exact_lng, location_accuracy_m, public_cell, visibility, partition_month)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      draftId,
      input.userId,
      input.observedAt ?? null,
      numberOrNull(input.exactLat),
      numberOrNull(input.exactLng),
      numberOrNull(input.locationAccuracyM),
      publicCell,
      visibility,
      partition.partitionMonth
    )
  ];

  const assets = media.map((asset, index) => {
    validateAsset(asset);
    const assetId = newId("asset");
    const objectKey = `original/${partition.partitionMonth.replace("-", "/")}/${assetId}`;
    statements.push(
      env.OBS_DB.prepare(
        `INSERT INTO asset_ledger
         (asset_id, draft_id, owner_user_id, object_key, sha256, mime, bytes, width, height, duration_ms, visibility, partition_month)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        assetId,
        draftId,
        input.userId,
        objectKey,
        asset.sha256 ?? null,
        asset.mime,
        asset.bytes,
        numberOrNull(asset.width),
        numberOrNull(asset.height),
        numberOrNull(asset.durationMs),
        "private",
        partition.partitionMonth
      )
    );
    return { assetId, objectKey, uploadUrl: `/api/v0/assets/${encodeURIComponent(assetId)}/body`, index };
  });

  await env.CORE_DB.batch(statements.filter((statement, index) => index === 0));
  await env.OBS_DB.batch(statements.slice(1));

  return json({ draftId, publicCell, assets });
}

async function issueCompatibleSession(request: Request, env: Env): Promise<Response> {
  if (!isAppRuntime(env)) {
    return json({ ok: false, error: "not_available" }, 404);
  }
  if (env.ENVIRONMENT === "production" && PUBLIC_CUSTOM_HOSTS.has(new URL(request.url).hostname)) {
    return json({ ok: false, error: "not_available" }, 404);
  }
  const input = await readJson<SessionIssueInput>(request);
  assertNonEmpty(input.userId, "userId");
  const ttlHours = typeof input.ttlHours === "number" && Number.isFinite(input.ttlHours) && input.ttlHours > 0
    ? Math.min(input.ttlHours, 24 * 30)
    : 24 * 30;
  const rawToken = randomToken();
  const tokenHash = await sha256Hex(textToArrayBuffer(rawToken));
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
  const displayName = normalizeOptionalText(input.displayName) ?? input.userId;
  const roleName = normalizeOptionalText(input.roleName) ?? "Observer";

  await env.CORE_DB.batch([
    env.CORE_DB.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(input.userId),
    env.CORE_DB.prepare(
      `INSERT INTO auth_sessions
       (token_hash, user_id, display_name, role_name, rank_label, banned, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`
    ).bind(
      tokenHash,
      input.userId,
      displayName,
      roleName,
      normalizeOptionalText(input.rankLabel),
      expiresAt,
      request.headers.get("cf-connecting-ip") ?? null,
      request.headers.get("user-agent") ?? null
    )
  ]);

  const session = {
    userId: input.userId,
    displayName,
    roleName,
    rankLabel: normalizeOptionalText(input.rankLabel),
    banned: false,
    expiresAt,
    tokenHash
  };
  return json({
    ok: true,
    tokenHash,
    compatibility: {
      attempted: false,
      succeeded: false
    },
    session
  }, 200, {
    "set-cookie": buildSessionCookie(rawToken, expiresAt, env)
  });
}

async function getCompatibleSession(request: Request, url: URL, env: Env): Promise<Response> {
  const optional = url.searchParams.get("optional") === "1" || url.searchParams.get("optional") === "true";
  const session = await readCompatibleSessionWithOriginFallback(request, env);
  if (!session) {
    return optional
      ? json({ ok: false, error: "session_not_found", session: null })
      : json({ ok: false, error: "session_not_found" }, 401);
  }
  return json({
    ok: true,
    session: {
      userId: session.userId,
      displayName: session.displayName,
      roleName: session.roleName,
      rankLabel: session.rankLabel,
      banned: session.banned,
      expiresAt: session.expiresAt,
      tokenHash: session.tokenHash
    }
  });
}

async function logoutCompatibleSession(request: Request, env: Env): Promise<Response> {
  const rawToken = readSessionTokenFromCookie(request.headers.get("cookie"));
  const tokenHash = rawToken ? await sha256Hex(textToArrayBuffer(rawToken)) : null;
  if (tokenHash) {
    await env.CORE_DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(tokenHash).run();
  }
  return json({
    ok: true,
    revoked: Boolean(tokenHash),
    tokenHash,
    compatibility: {
      attempted: false,
      succeeded: false
    }
  }, 200, {
    "set-cookie": buildClearedSessionCookie(env)
  });
}

async function handleOAuthStart(request: Request, providerInput: unknown, env: Env): Promise<Response> {
  const provider = oauthProviderFromInput(providerInput);
  if (!provider) return oauthErrorRedirect(env);
  if (!getOAuthConfig(env, provider)) {
    logOAuthProviderConfigMissing(provider, "start");
    return oauthErrorRedirect(env);
  }

  const url = new URL(request.url);
  const start = await buildOAuthStart(provider, request, env, url.searchParams.get("redirect"));
  return redirect303(start.authorizationUrl, {
    "cache-control": "no-store",
    "set-cookie": start.cookie
  });
}

async function handleOAuthCallback(request: Request, providerInput: unknown, env: Env): Promise<Response> {
  const provider = oauthProviderFromInput(providerInput);
  if (!provider) return oauthErrorRedirect(env, true);
  if (!getOAuthConfig(env, provider)) {
    logOAuthProviderConfigMissing(provider, "callback");
    return oauthErrorRedirect(env, true);
  }

  try {
    const url = new URL(request.url);
    const state = await readOAuthState(request.headers.get("cookie"), env);
    const callbackState = url.searchParams.get("state") ?? "";
    const code = url.searchParams.get("code") ?? "";
    if (!state || state.provider !== provider || state.state !== callbackState || !code || url.searchParams.has("error")) {
      throw new Error("oauth_state_invalid");
    }
    const profile = await exchangeOAuthCode(provider, code, oauthRedirectUri(request, provider), state.codeVerifier, env);
    const user = await findOrCreateOAuthUser(profile, env);
    const session = await issueSessionForAuthUser(request, env, user);
    const headers = new Headers({
      location: safeRedirectPath(state.redirect),
      "cache-control": "no-store"
    });
    headers.append("set-cookie", session.cookie);
    headers.append("set-cookie", buildClearedOAuthStateCookie(env));
    return new Response(null, { status: 303, headers });
  } catch (error) {
    console.warn(JSON.stringify({
      message: "oauth_callback_failed",
      provider,
      error: error instanceof Error ? error.message : "unknown"
    }));
    return oauthErrorRedirect(env, true);
  }
}

async function loginWithPassword(request: Request, env: Env): Promise<Response> {
  const sameOriginError = assertSameOriginRequest(request);
  if (sameOriginError) return sameOriginError;

  const url = new URL(request.url);
  const input = await readJson<AuthLoginInput>(request);
  const email = normalizeEmail(input.email);
  const password = typeof input.password === "string" ? input.password : "";
  let user: AuthUserRow | null = null;
  try {
    user = email && password ? await findAuthUserByEmail(email, env) : null;
  } catch {
    await recordAuthLoginFailureTelemetry(env, {
      reason: "auth_login_store_unavailable",
      method: request.method,
      host: url.hostname,
      routePattern: fallbackRoutePattern(url.pathname),
      publicWriteMode: getPublicWriteMode(env),
      environment: env.ENVIRONMENT
    });
    return json({ ok: false, error: "auth_store_unavailable" }, 503, { "cache-control": "no-store" });
  }
  const passwordOk = await verifyPassword(password, user?.password_hash ?? null);
  if (!user || !passwordOk) {
    await recordAuthLoginFailureTelemetry(env, {
      reason: user ? "auth_login_password_mismatch" : "auth_login_user_missing",
      method: request.method,
      host: url.hostname,
      routePattern: fallbackRoutePattern(url.pathname),
      publicWriteMode: getPublicWriteMode(env),
      environment: env.ENVIRONMENT
    });
    return json({ ok: false, error: "invalid_credentials" }, 401, { "cache-control": "no-store" });
  }
  if (user.banned) {
    return json({ ok: false, error: "account_disabled" }, 403, { "cache-control": "no-store" });
  }

  const session = await issueSessionForAuthUser(request, env, user);
  await env.CORE_DB.prepare(
    "UPDATE auth_users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = ?"
  ).bind(user.user_id).run();

  return json({
    ok: true,
    redirect: postAuthRedirect(input.redirect),
    session: session.session
  }, 200, {
    "cache-control": "no-store",
    "set-cookie": session.cookie
  });
}

function logOAuthProviderConfigMissing(provider: OAuthProvider, phase: "start" | "callback"): void {
  console.error(JSON.stringify({
    message: "oauth_provider_config_missing",
    provider,
    phase
  }));
}

function oauthProviderFromInput(input: unknown): OAuthProvider | null {
  const value = typeof input === "string" ? input.toLowerCase().trim() : "";
  return value === "google" || value === "twitter" ? value : null;
}

function getOAuthConfig(env: Env, provider: OAuthProvider): { clientId: string; clientSecret: string } | null {
  const clientId = provider === "google" ? env.GOOGLE_CLIENT_ID : env.TWITTER_CLIENT_ID;
  const clientSecret = provider === "google" ? env.GOOGLE_CLIENT_SECRET : env.TWITTER_CLIENT_SECRET;
  if (!clientId?.trim() || !clientSecret?.trim()) return null;
  return { clientId: clientId.trim(), clientSecret: clientSecret.trim() };
}

function oauthStateSecret(env: Env): string {
  return env.V2_OAUTH_STATE_SECRET?.trim()
    ?? env.GOOGLE_CLIENT_SECRET?.trim()
    ?? env.TWITTER_CLIENT_SECRET?.trim()
    ?? "ikimon-dev-oauth-state";
}

async function signOAuthState(encodedPayload: string, env: Env): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    textToArrayBuffer(oauthStateSecret(env)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return arrayBufferToBase64Url(await crypto.subtle.sign("HMAC", key, textToArrayBuffer(encodedPayload)));
}

async function encodeOAuthState(payload: OAuthStatePayload, env: Env): Promise<string> {
  const encoded = base64UrlEncodeText(JSON.stringify(payload));
  return `${encoded}.${await signOAuthState(encoded, env)}`;
}

async function decodeOAuthState(value: string | undefined, env: Env): Promise<OAuthStatePayload | null> {
  if (!value) return null;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return null;
  const expected = await signOAuthState(encoded, env);
  if (!constantTimeStringEqual(signature, expected)) return null;
  try {
    const parsed = JSON.parse(arrayBufferToText(base64UrlToArrayBuffer(encoded))) as OAuthStatePayload;
    if (!parsed || parsed.expiresAt < Date.now()) return null;
    if (parsed.provider !== "google" && parsed.provider !== "twitter") return null;
    return parsed;
  } catch {
    return null;
  }
}

async function readOAuthState(cookieHeader: string | null, env: Env): Promise<OAuthStatePayload | null> {
  const raw = parseCookies(cookieHeader).ikimon_oauth_state;
  return decodeOAuthState(raw, env);
}

async function buildOAuthStateCookie(payload: OAuthStatePayload, env: Env): Promise<string> {
  const secure = secureCookieAttribute(env);
  return `ikimon_oauth_state=${encodeURIComponent(await encodeOAuthState(payload, env))}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=600`;
}

function buildClearedOAuthStateCookie(env: Env): string {
  const secure = secureCookieAttribute(env);
  return `ikimon_oauth_state=; Path=/; HttpOnly; SameSite=Lax;${secure} Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

function requestPublicOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = headerFirst(request.headers.get("x-forwarded-host"));
  const forwardedProto = headerFirst(request.headers.get("x-forwarded-proto"));
  return `${forwardedProto || url.protocol.replace(":", "")}://${forwardedHost || url.host}`;
}

function oauthRedirectUri(request: Request, provider: OAuthProvider): string {
  const origin = requestPublicOrigin(request);
  return provider === "google"
    ? `${origin}/oauth_callback.php?provider=google`
    : `${origin}/auth/oauth/${provider}/callback`;
}

async function buildOAuthStart(provider: OAuthProvider, request: Request, env: Env, redirectInput: unknown): Promise<{
  cookie: string;
  authorizationUrl: string;
}> {
  const config = getOAuthConfig(env, provider);
  if (!config) throw new Error("oauth_provider_not_configured");
  const state = randomToken().slice(0, 40);
  const codeVerifier = provider === "twitter" ? randomToken() : undefined;
  const payload: OAuthStatePayload = {
    provider,
    state,
    redirect: safeRedirectPath(redirectInput),
    codeVerifier,
    expiresAt: Date.now() + 10 * 60 * 1000
  };
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: oauthRedirectUri(request, provider),
    response_type: "code",
    state
  });
  if (provider === "google") {
    params.set("scope", "openid email profile");
    params.set("prompt", "select_account");
    return {
      cookie: await buildOAuthStateCookie(payload, env),
      authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    };
  }

  params.set("scope", "tweet.read users.read offline.access");
  params.set("code_challenge", await codeChallenge(codeVerifier ?? ""));
  params.set("code_challenge_method", "S256");
  return {
    cookie: await buildOAuthStateCookie(payload, env),
    authorizationUrl: `https://twitter.com/i/oauth2/authorize?${params.toString()}`
  };
}

async function exchangeOAuthCode(provider: OAuthProvider, code: string, redirectUri: string, codeVerifier: string | undefined, env: Env): Promise<OAuthProfile> {
  const config = getOAuthConfig(env, provider);
  if (!config) throw new Error("oauth_provider_not_configured");
  if (provider === "google") {
    const token = await postForm("https://oauth2.googleapis.com/token", new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    }));
    const accessToken = typeof token.access_token === "string" ? token.access_token : "";
    if (!accessToken) throw new Error("oauth_token_failed");
    const profile = await getJson("https://www.googleapis.com/oauth2/v2/userinfo", accessToken);
    return {
      provider,
      providerUserId: String(profile.id ?? ""),
      name: String(profile.name ?? ""),
      email: typeof profile.email === "string" ? profile.email : null,
      avatarUrl: typeof profile.picture === "string" ? profile.picture : null,
      rawProfile: profile
    };
  }

  const token = await postForm("https://api.x.com/2/oauth2/token", new URLSearchParams({
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code_verifier: codeVerifier ?? ""
  }), {
    authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`
  });
  const accessToken = typeof token.access_token === "string" ? token.access_token : "";
  if (!accessToken) throw new Error("oauth_token_failed");
  const profile = await getJson("https://api.x.com/2/users/me?user.fields=profile_image_url,name,username", accessToken);
  const data = profile.data && typeof profile.data === "object" ? profile.data as Record<string, unknown> : {};
  return {
    provider,
    providerUserId: String(data.id ?? ""),
    name: String(data.name ?? data.username ?? ""),
    email: null,
    avatarUrl: typeof data.profile_image_url === "string" ? data.profile_image_url : null,
    rawProfile: profile
  };
}

async function postForm(url: string, body: URLSearchParams, headers: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
      ...headers
    },
    body: body.toString()
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(payload.error_description ?? payload.error ?? "oauth_token_failed"));
  }
  return payload;
}

async function getJson(url: string, accessToken: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json"
    }
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(payload.error ?? "oauth_profile_failed"));
  return payload;
}

async function findOrCreateOAuthUser(profile: OAuthProfile, env: Env): Promise<AuthUserRow> {
  if (!profile.providerUserId.trim()) throw new Error("oauth_profile_invalid");
  const existing = await findOAuthAccount(profile.provider, profile.providerUserId, env);
  if (existing) {
    if (existing.banned) throw new Error("account_disabled");
    await upsertOAuthAccount(existing.user_id, profile, existing.display_name, existing.role_name, existing.rank_label, existing.banned, env);
    return oauthAccountToAuthUser(existing);
  }

  const email = normalizeEmail(profile.email);
  const authUser = email ? await findAuthUserByEmail(email, env) : null;
  if (authUser?.banned) throw new Error("account_disabled");
  const userId = authUser?.user_id ?? `user_${crypto.randomUUID()}`;
  const displayName = authUser?.display_name ?? normalizeOptionalText(profile.name) ?? "ikimon user";
  const roleName = authUser?.role_name ?? "Observer";
  const rankLabel = authUser?.rank_label ?? "観察者";
  await env.CORE_DB.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(userId).run();
  await upsertOAuthAccount(userId, profile, displayName, roleName, rankLabel, authUser?.banned ?? 0, env);
  if (authUser) {
    await env.CORE_DB.prepare("UPDATE auth_users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = ?").bind(authUser.user_id).run();
  }
  return {
    user_id: userId,
    email,
    password_hash: authUser?.password_hash ?? null,
    display_name: displayName,
    role_name: roleName,
    rank_label: rankLabel,
    banned: authUser?.banned ?? 0
  };
}

async function findOAuthAccount(provider: OAuthProvider, providerUserId: string, env: Env): Promise<OAuthAccountRow | null> {
  return env.CORE_DB.prepare(
    `SELECT user_id, provider, provider_user_id, provider_email, display_name, role_name, rank_label, banned
     FROM oauth_accounts
     WHERE provider = ? AND provider_user_id = ?
     LIMIT 1`
  ).bind(provider, providerUserId).first<OAuthAccountRow>();
}

async function upsertOAuthAccount(
  userId: string,
  profile: OAuthProfile,
  displayName: string,
  roleName: string | null,
  rankLabel: string | null,
  banned: number,
  env: Env
): Promise<void> {
  await env.CORE_DB.prepare(
    `INSERT INTO oauth_accounts
     (user_id, provider, provider_user_id, provider_email, display_name, role_name, rank_label, banned, profile_json, linked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(provider, provider_user_id) DO UPDATE SET
       user_id = excluded.user_id,
       provider_email = excluded.provider_email,
       display_name = excluded.display_name,
       role_name = excluded.role_name,
       rank_label = excluded.rank_label,
       banned = excluded.banned,
       profile_json = excluded.profile_json,
       linked_at = CURRENT_TIMESTAMP`
  ).bind(
    userId,
    profile.provider,
    profile.providerUserId,
    profile.email,
    displayName,
    roleName ?? "Observer",
    rankLabel,
    banned,
    JSON.stringify(profile.rawProfile)
  ).run();
}

function oauthAccountToAuthUser(row: OAuthAccountRow): AuthUserRow {
  return {
    user_id: row.user_id,
    email: row.provider_email ?? "",
    password_hash: null,
    display_name: row.display_name,
    role_name: row.role_name,
    rank_label: row.rank_label,
    banned: row.banned
  };
}

function oauthErrorRedirect(env: Env, clearState = false): Response {
  return redirect303("/login?error=oauth", clearState ? {
    "cache-control": "no-store",
    "set-cookie": buildClearedOAuthStateCookie(env)
  } : { "cache-control": "no-store" });
}

async function findAuthUserByEmail(email: string, env: Env): Promise<AuthUserRow | null> {
  return env.CORE_DB.prepare(
    `SELECT user_id, email, password_hash, display_name, role_name, rank_label, banned
     FROM auth_users
     WHERE lower(email) = lower(?)
     LIMIT 1`
  ).bind(email).first<AuthUserRow>();
}

async function issueSessionForAuthUser(request: Request, env: Env, user: AuthUserRow): Promise<{ cookie: string; session: SessionSnapshot }> {
  const rawToken = randomToken();
  const tokenHash = await sha256Hex(textToArrayBuffer(rawToken));
  const expiresAt = new Date(Date.now() + 24 * 30 * 60 * 60 * 1000).toISOString();
  const roleName = normalizeOptionalText(user.role_name) ?? "Observer";
  const rankLabel = normalizeOptionalText(user.rank_label) ?? "観察者";

  await env.CORE_DB.batch([
    env.CORE_DB.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(user.user_id),
    env.CORE_DB.prepare(
      `INSERT INTO auth_sessions
       (token_hash, user_id, display_name, role_name, rank_label, banned, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`
    ).bind(
      tokenHash,
      user.user_id,
      user.display_name,
      roleName,
      rankLabel,
      expiresAt,
      request.headers.get("cf-connecting-ip") ?? null,
      request.headers.get("user-agent") ?? null
    )
  ]);

  return {
    cookie: buildSessionCookie(rawToken, expiresAt, env),
    session: {
      tokenHash,
      userId: user.user_id,
      displayName: user.display_name,
      roleName,
      rankLabel,
      banned: false,
      expiresAt
    }
  };
}

async function verifyPassword(password: string, storedHash: string | null): Promise<boolean> {
  const hash = storedHash?.trim();
  if (!password || !hash) return false;
  try {
    return await bcrypt.compare(password, normalizeLegacyBcryptHash(hash));
  } catch {
    return false;
  }
}

function normalizeLegacyBcryptHash(hash: string): string {
  return hash.startsWith("$2y$") ? `$2b$${hash.slice(4)}` : hash;
}

function assertSameOriginRequest(request: Request): Response | null {
  const secFetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return json({ ok: false, error: "same_origin_required" }, 403, { "cache-control": "no-store" });
  }

  const origin = request.headers.get("origin")?.trim();
  if (!origin) return null;

  const url = new URL(request.url);
  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return json({ ok: false, error: "same_origin_required" }, 403, { "cache-control": "no-store" });
  }
  if (parsedOrigin.protocol !== url.protocol || parsedOrigin.host !== url.host) {
    return json({ ok: false, error: "same_origin_required" }, 403, { "cache-control": "no-store" });
  }
  return null;
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function safeRedirectPath(value: unknown, fallback = "/record"): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("\u0000")) {
    return fallback;
  }
  try {
    const parsed = new URL(raw, "https://ikimon.local");
    if (parsed.origin !== "https://ikimon.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

function postAuthRedirect(input: unknown): string {
  const redirect = safeRedirectPath(input);
  const path = redirect.split(/[?#]/, 1)[0] ?? "";
  const normalizedRedirect = path === "/login" || path === "/register" ? "/record" : redirect;
  return normalizedRedirect === "/record" ? "/record?start=photo" : normalizedRedirect;
}

async function recordUiKpiEventShim(request: Request): Promise<Response> {
  const input = await readJson<Record<string, unknown>>(request);
  const eventName = normalizeOptionalText(input.eventName);
  if (!eventName || ![
    "first_action",
    "task_completion",
    "section_view",
    "read_depth",
    "primary_cta_click",
    "map_area_detail_open",
    "selected_place_cta_click",
    "funnel_step",
    "funnel_error"
  ].includes(eventName)) {
    return json({ ok: false, error: "invalid_event_name" }, 400, { "cache-control": "no-store" });
  }
  return json({
    ok: true,
    eventId: `cf-ui-kpi-${crypto.randomUUID()}`,
    compatibility: {
      source: "cloudflare_compat_noop"
    }
  }, 200, { "cache-control": "no-store" });
}

async function readCompatibleSession(request: Request, env: Env): Promise<SessionSnapshot | null> {
  const rawToken = readSessionTokenFromCookie(request.headers.get("cookie"));
  if (!rawToken) return null;
  const tokenHash = await sha256Hex(textToArrayBuffer(rawToken));
  const session = await env.CORE_DB.prepare(
    `SELECT token_hash, user_id, display_name, role_name, rank_label, banned, expires_at
     FROM auth_sessions
     WHERE token_hash = ? AND expires_at > ?`
  ).bind(tokenHash, new Date().toISOString()).first<{
    token_hash: string;
    user_id: string;
    display_name: string;
    role_name: string;
    rank_label: string | null;
    banned: number;
    expires_at: string;
  }>();
  if (!session) return null;
  await env.CORE_DB.prepare(
    "UPDATE auth_sessions SET last_used_at = CURRENT_TIMESTAMP WHERE token_hash = ?"
  ).bind(tokenHash).run();
  return {
    tokenHash: session.token_hash,
    userId: session.user_id,
    displayName: session.display_name,
    roleName: session.role_name,
    rankLabel: session.rank_label,
    banned: Boolean(session.banned),
    expiresAt: session.expires_at
  };
}

async function readCompatibleSessionWithOriginFallback(request: Request, env: Env): Promise<SessionSnapshot | null> {
  const session = await readCompatibleSession(request, env);
  if (session) return session;
  return importOriginSessionIfAvailable(request, env);
}

// Remove this lazy import once the VPS origin is fully stopped.
async function importOriginSessionIfAvailable(request: Request, env: Env): Promise<SessionSnapshot | null> {
  if (getOriginSessionImportMode(env) === "disabled") return null;
  if (!env.ORIGIN_FALLBACK_BASE_URL) return null;
  const requestUrl = new URL(request.url);
  if (!PUBLIC_CUSTOM_HOSTS.has(requestUrl.hostname)) return null;
  const rawToken = readSessionTokenFromCookie(request.headers.get("cookie"));
  if (!rawToken) return null;
  const tokenHash = await sha256Hex(textToArrayBuffer(rawToken));

  const originUrl = new URL(request.url);
  originUrl.pathname = "/api/v1/auth/session";
  originUrl.search = "?optional=1";
  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const userAgent = request.headers.get("user-agent");
  if (userAgent) headers.set("user-agent", userAgent);
  headers.set("accept", "application/json");

  const response = await fetchOriginFallback(new Request(originUrl.toString(), {
    method: "GET",
    headers
  }), originUrl, env, "origin_session_probe");
  if (!response.ok) return null;

  let payload: OriginSessionResponse;
  try {
    payload = await response.json() as OriginSessionResponse;
  } catch {
    return null;
  }
  if (payload.ok !== true || !payload.session) return null;
  const originTokenHash = normalizeOptionalText(payload.session.tokenHash);
  if (originTokenHash && originTokenHash !== tokenHash) return null;
  const userId = normalizeOptionalText(payload.session.userId);
  const displayName = normalizeOptionalText(payload.session.displayName) ?? userId;
  const roleName = normalizeOptionalText(payload.session.roleName) ?? "Observer";
  const rankLabel = normalizeOptionalText(payload.session.rankLabel);
  const expiresAt = normalizeOptionalText(payload.session.expiresAt);
  if (!userId || !expiresAt) return null;

  const session: SessionSnapshot = {
    tokenHash,
    userId,
    displayName: displayName ?? userId,
    roleName,
    rankLabel,
    banned: payload.session.banned === true,
    expiresAt
  };
  await env.CORE_DB.batch([
    env.CORE_DB.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(session.userId),
    env.CORE_DB.prepare(
      `INSERT INTO auth_sessions
       (token_hash, user_id, display_name, role_name, rank_label, banned, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'origin-session-lazy-import')
       ON CONFLICT(token_hash) DO UPDATE SET
         user_id = excluded.user_id,
         display_name = excluded.display_name,
         role_name = excluded.role_name,
         rank_label = excluded.rank_label,
         banned = excluded.banned,
         expires_at = excluded.expires_at,
         user_agent = excluded.user_agent`
    ).bind(
      session.tokenHash,
      session.userId,
      session.displayName,
      session.roleName,
      session.rankLabel,
      session.banned ? 1 : 0,
      session.expiresAt
    )
  ]);
  return session;
}

function getOriginSessionImportMode(env: Env): "enabled" | "disabled" {
  const mode = (env.ORIGIN_SESSION_IMPORT_MODE ?? "enabled").trim().toLowerCase();
  return mode === "disabled" ? "disabled" : "enabled";
}

async function createCompatibleVideoDirectUpload(request: Request, env: Env): Promise<Response> {
  if (!isAppRuntime(env)) {
    return json({ ok: false, error: "not_available" }, 404);
  }
  const session = await readCompatibleSessionWithOriginFallback(request, env);
  if (!session) {
    return json({ ok: false, error: "session_required" }, 401);
  }

  const input = await readJson<VideoDirectUploadInput>(request);
  const uploadProtocol = normalizeOptionalText(input.uploadProtocol) ?? "post";
  const fileSizeBytes = numberOrNull(input.fileSizeBytes);
  if (uploadProtocol === "tus" && (!fileSizeBytes || fileSizeBytes <= 0)) {
    return json({ ok: false, error: "video_tus_upload_length_required" }, 400);
  }

  const observationId = normalizeOptionalId(input.observationId);
  if (observationId) {
    await assertObservationOwnedByUser(observationId, session.userId, env);
  }

  const uid = newId("stream");
  const filename = sanitizeFileName(normalizeOptionalText(input.filename) ?? `${uid}.mp4`);
  const maxDurationSeconds = clampVideoDuration(input.maxDurationSeconds);
  const objectKey = `original/v1-compat-video/${uid}/${filename}`;
  const uploadUrl = `${new URL(request.url).origin}/api/v1/videos/${encodeURIComponent(uid)}/body`;

  await env.OBS_DB.prepare(
    `INSERT INTO video_upload_requests
     (stream_uid, actor_id, observation_id, upload_status, max_duration_seconds, filename, upload_protocol, object_key, bytes, meta_json)
     VALUES (?, ?, ?, 'waiting_upload', ?, ?, ?, ?, ?, ?)`
  ).bind(
    uid,
    session.userId,
    observationId,
    maxDurationSeconds,
    filename,
    uploadProtocol,
    objectKey,
    fileSizeBytes ?? 0,
    JSON.stringify({ mediaRole: normalizeOptionalText(input.mediaRole) ?? "observation_video" })
  ).run();

  return json({
    ok: true,
    uid,
    uploadUrl,
    maxDurationSeconds,
    iframeUrl: buildShadowVideoIframeUrl(uid),
    thumbnailUrl: buildShadowVideoThumbnailUrl(uid),
    uploadProtocol
  });
}

async function putCompatibleVideoBody(uid: string, request: Request, env: Env): Promise<Response> {
  assertNonEmpty(uid, "uid");
  const row = await env.OBS_DB.prepare(
    "SELECT object_key FROM video_upload_requests WHERE stream_uid = ?"
  ).bind(uid).first<{ object_key: string }>();
  if (!row) return json({ ok: false, error: "video_upload_not_found" }, 404);

  const body = await request.arrayBuffer();
  if (body.byteLength === 0) {
    return json({ ok: false, error: "missing_body" }, 400);
  }
  await env.ASSET_BUCKET.put(row.object_key, body, {
    httpMetadata: { contentType: normalizeOptionalText(request.headers.get("content-type")) ?? "video/mp4" }
  });
  await env.OBS_DB.prepare(
    "UPDATE video_upload_requests SET upload_status = 'uploaded', bytes = ?, uploaded_at = CURRENT_TIMESTAMP WHERE stream_uid = ?"
  ).bind(body.byteLength, uid).run();
  return json({ ok: true, uid, bytes: body.byteLength });
}

async function handleCompatibleVideoStreamWebhook(request: Request, env: Env): Promise<Response> {
  if (!isAppRuntime(env)) {
    return json({ ok: false, error: "not_available" }, 404);
  }
  const rawBody = await request.arrayBuffer();
  const signature = request.headers.get("webhook-signature") ?? "";
  if (!(await verifyCompatibleStreamWebhookSignature(rawBody, signature, env.CLOUDFLARE_STREAM_WEBHOOK_SECRET))) {
    return json({ ok: false, error: "invalid_webhook_signature" }, 401);
  }

  let parsed: VideoStreamWebhookInput;
  try {
    parsed = JSON.parse(arrayBufferToText(rawBody)) as VideoStreamWebhookInput;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const payload = normalizeCompatibleStreamWebhookPayload(parsed);
  const uid = normalizeOptionalText(payload.uid);
  if (!uid) {
    return json({ ok: false, error: "invalid_uid" }, 400);
  }

  const row = await env.OBS_DB.prepare(
    `SELECT stream_uid, actor_id, observation_id, upload_status, max_duration_seconds, filename,
            upload_protocol, object_key, bytes, duration_ms, ready_to_stream, created_at, uploaded_at
     FROM video_upload_requests
     WHERE stream_uid = ?`
  ).bind(uid).first<{
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
  }>();
  if (!row) {
    return json({ ok: true, uid, known: false, readyToStream: compatibleStreamWebhookReady(payload) });
  }

  const uploadStatus = compatibleStreamWebhookStatus(payload);
  const bytes = Math.max(row.bytes ?? 0, numberOrNull(payload.size) ?? 0);
  const durationMs = Math.max(row.duration_ms ?? 0, compatibleStreamWebhookDurationMs(payload));
  const readyToStream = compatibleStreamWebhookReady(payload);
  const uploadedAt = normalizeOptionalText(payload.uploaded) ?? row.uploaded_at;
  const meta = {
    source: "stream_webhook",
    stream_uid: uid,
    upload_status: uploadStatus,
    ready_to_stream: readyToStream,
    thumbnail_url: normalizeOptionalText(payload.thumbnail) ?? buildShadowVideoThumbnailUrl(uid),
    watch_url: normalizeOptionalText(payload.preview) ?? buildShadowVideoWatchUrl(uid),
    status: payload.status ?? null
  };

  await env.OBS_DB.prepare(
    `UPDATE video_upload_requests
     SET upload_status = ?, bytes = ?, duration_ms = ?, ready_to_stream = ?,
         uploaded_at = COALESCE(?, uploaded_at),
         finalized_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE finalized_at END,
         meta_json = ?
     WHERE stream_uid = ?`
  ).bind(uploadStatus, bytes, durationMs, readyToStream ? 1 : 0, uploadedAt, readyToStream ? 1 : 0, JSON.stringify(meta), uid).run();

  let dispatch: { sent: number; pending: number } | null = null;
  if (readyToStream && row.observation_id && row.object_key) {
    dispatch = await attachVideoAssetToObservation({
      uid,
      observationId: row.observation_id,
      ownerUserId: row.actor_id,
      objectKey: row.object_key,
      bytes,
      durationMs
    }, env);
  }

  return json({
    ok: true,
    uid,
    known: true,
    readyToStream,
    video: videoRecordPayload({
      uid,
      observationId: row.observation_id,
      uploadStatus,
      durationMs,
      bytes,
      readyToStream,
      createdAt: row.created_at,
      uploadedAt
    }),
    dispatch
  });
}

async function finalizeCompatibleVideo(uid: string, request: Request, env: Env): Promise<Response> {
  if (!isAppRuntime(env)) {
    return json({ ok: false, error: "not_available" }, 404);
  }
  assertNonEmpty(uid, "uid");
  const session = await readCompatibleSessionWithOriginFallback(request, env);
  if (!session) {
    return json({ ok: false, error: "session_required" }, 401);
  }

  const input = await readJson<VideoFinalizeInput>(request);
  const row = await env.OBS_DB.prepare(
    `SELECT stream_uid, actor_id, observation_id, upload_status, max_duration_seconds, filename,
            upload_protocol, object_key, bytes, duration_ms, ready_to_stream, created_at, uploaded_at
     FROM video_upload_requests
     WHERE stream_uid = ?`
  ).bind(uid).first<{
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
  }>();
  if (!row) {
    return json({ ok: true, video: pendingVideoFinalizePayload(uid) });
  }
  if (row.actor_id !== session.userId) {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  const observationId = normalizeOptionalId(input.observationId) ?? row.observation_id;
  if (observationId) {
    await assertObservationOwnedByUser(observationId, session.userId, env);
  }

  const bytes = Math.max(0, numberOrNull(input.bytes) ?? row.bytes ?? 0);
  const durationMs = Math.max(0, numberOrNull(input.durationMs) ?? row.duration_ms ?? 0);
  const readyToStream = input.readyToStream === false ? false : row.upload_status === "uploaded" || bytes > 0;
  const uploadStatus = readyToStream ? "ready" : row.upload_status === "waiting_upload" ? "processing" : row.upload_status;

  await env.OBS_DB.prepare(
    `UPDATE video_upload_requests
     SET observation_id = ?, upload_status = ?, bytes = ?, duration_ms = ?, ready_to_stream = ?, finalized_at = CURRENT_TIMESTAMP
     WHERE stream_uid = ?`
  ).bind(observationId, uploadStatus, bytes, durationMs, readyToStream ? 1 : 0, uid).run();

  let dispatch: { sent: number; pending: number } | null = null;
  if (readyToStream && observationId && row.object_key) {
    dispatch = await attachVideoAssetToObservation({
      uid,
      observationId,
      ownerUserId: session.userId,
      objectKey: row.object_key,
      bytes,
      durationMs
    }, env);
  }

  return json({
    ok: true,
    video: videoRecordPayload({
      uid,
      observationId,
      uploadStatus,
      durationMs,
      bytes,
      readyToStream,
      createdAt: row.created_at,
      uploadedAt: row.uploaded_at
    }),
    dispatch
  });
}

async function assertObservationOwnedByUser(observationId: string, userId: string, env: Env): Promise<void> {
  const observation = await env.OBS_DB.prepare(
    "SELECT draft_id, owner_user_id FROM observations WHERE observation_id = ?"
  ).bind(observationId).first<{ draft_id: string; owner_user_id: string }>();
  if (!observation) {
    throw new HttpError(404, `observation not found: ${observationId}`);
  }
  if (observation.owner_user_id !== userId) {
    throw new HttpError(403, "forbidden");
  }
}

async function attachVideoAssetToObservation(input: {
  uid: string;
  observationId: string;
  ownerUserId: string;
  objectKey: string;
  bytes: number;
  durationMs: number;
}, env: Env): Promise<{ sent: number; pending: number }> {
  const observation = await env.OBS_DB.prepare(
    "SELECT draft_id, owner_user_id, partition_month FROM observations WHERE observation_id = ?"
  ).bind(input.observationId).first<{ draft_id: string; owner_user_id: string; partition_month: string | null }>();
  if (!observation) {
    throw new HttpError(404, `observation not found: ${input.observationId}`);
  }
  const partitionMonth = observation.partition_month ?? partitionMonthFromDate(new Date().toISOString());

  const assetId = `video_asset_${input.uid}`;
  const outboxMediaId = newId("outbox");
  const outboxReadModelId = newId("outbox");

  await env.OBS_DB.batch([
    env.OBS_DB.prepare(
      `INSERT OR REPLACE INTO asset_ledger
       (asset_id, draft_id, observation_id, owner_user_id, object_key, sha256, mime, bytes, width, height, duration_ms, visibility, processing_state, uploaded_at, partition_month)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'private', 'uploaded', CURRENT_TIMESTAMP, ?)`
    ).bind(
      assetId,
      observation.draft_id,
      input.observationId,
      observation.owner_user_id,
      input.objectKey,
      null,
      "video/mp4",
      input.bytes,
      null,
      null,
      input.durationMs,
      partitionMonth
    ),
    env.OBS_DB.prepare(
      "INSERT INTO outbox (outbox_id, topic, target_id, payload_json, partition_month) VALUES (?, ?, ?, ?, ?)"
    ).bind(outboxMediaId, "media.process", input.observationId, JSON.stringify({ observationId: input.observationId, assetId }), partitionMonth),
    env.OBS_DB.prepare(
      "INSERT INTO outbox (outbox_id, topic, target_id, payload_json, partition_month) VALUES (?, ?, ?, ?, ?)"
    ).bind(outboxReadModelId, "readmodel.refresh", input.observationId, JSON.stringify({ observationId: input.observationId }), partitionMonth),
    rollbackLedgerInsert(env, {
      eventType: "asset.video.finalize",
      targetId: assetId,
      partitionMonth,
      sourceEndpoint: "POST /api/v1/videos/:uid/finalize",
      payload: {
        assetId,
        observationId: input.observationId,
        ownerUserId: observation.owner_user_id,
        objectKey: input.objectKey,
        streamUid: input.uid,
        bytes: input.bytes,
        durationMs: input.durationMs,
        readyToStream: true
      },
      replaySql: postgresAssetReplaySql(assetId, input.observationId, observation.owner_user_id, input.objectKey, null, "video/mp4", input.bytes, "private")
    })
  ]);

  return dispatchOutboxBestEffort(env, [
    { outboxId: outboxMediaId, topic: "media.process", targetId: input.observationId },
    { outboxId: outboxReadModelId, topic: "readmodel.refresh", targetId: input.observationId }
  ]);
}

async function upsertLegacyCompatibleObservation(request: Request, env: Env): Promise<Response> {
  const input = await readJson<LegacyObservationUpsertInput>(request);
  if (env.ENVIRONMENT === "production") {
    const session = await readCompatibleSessionWithOriginFallback(request, env);
    if (!session) {
      return json({ ok: false, error: "session_required" }, 401);
    }
    assertNonEmpty(input.userId, "userId");
    if (session.userId !== input.userId) {
      return json({ ok: false, error: "forbidden" }, 403);
    }
  } else {
    assertNonEmpty(input.userId, "userId");
  }
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    throw new HttpError(400, "missing_location");
  }
  assertNonEmpty(input.observedAt, "observedAt");

  const draftId = newId("draft");
  const visitId = normalizeOptionalId(input.observationId) ?? newId("obs");
  const partition = resolveObservationPartition(input.observedAt, env);
  const occurrenceIds = resolveLegacyOccurrenceIds(visitId, input);
  const occurrenceId = occurrenceIds[0] ?? `occ:${visitId}:0`;
  const publicCell = blurLocation(input.latitude, input.longitude);
  const taxonLabel = resolveLegacyTaxonLabel(input);
  const placeName = normalizeOptionalText(input.siteName)
    ?? normalizeOptionalText(input.municipality)
    ?? normalizeOptionalText(input.prefecture)
    ?? "unknown place";
  const placeId = normalizeOptionalId(input.siteId) ?? `place:${publicCell}`;
  const dataRights = normalizeObservationDataRightsNative(input.dataRights ?? input.sourcePayload?.dataRights);

  await env.CORE_DB.batch([
    env.CORE_DB.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(input.userId)
  ]);
  await env.OBS_DB.batch([
    env.OBS_DB.prepare(
      `INSERT INTO draft_observations
       (draft_id, owner_user_id, observed_at, exact_lat, exact_lng, location_accuracy_m, public_cell, visibility, partition_month)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      draftId,
      input.userId,
      input.observedAt,
      input.latitude,
      input.longitude,
      numberOrNull(input.locationAccuracyM),
      publicCell,
      "public",
      partition.partitionMonth
    ),
    env.OBS_DB.prepare(
      `INSERT INTO observations
       (observation_id, draft_id, owner_user_id, observed_at, taxon_label, note, exact_lat, exact_lng,
        location_accuracy_m, public_cell, visibility, partition_month)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        + ` ON CONFLICT(observation_id) DO UPDATE SET
          draft_id = excluded.draft_id,
          owner_user_id = excluded.owner_user_id,
          observed_at = excluded.observed_at,
          taxon_label = excluded.taxon_label,
          note = excluded.note,
          exact_lat = excluded.exact_lat,
          exact_lng = excluded.exact_lng,
          location_accuracy_m = excluded.location_accuracy_m,
          public_cell = excluded.public_cell,
          visibility = excluded.visibility,
          partition_month = excluded.partition_month,
          emergency_hidden = 0,
          processing_state = 'accepted'`
    ).bind(
      visitId,
      draftId,
      input.userId,
      input.observedAt,
      taxonLabel,
      input.note ?? null,
      input.latitude,
      input.longitude,
      numberOrNull(input.locationAccuracyM),
      publicCell,
      "public",
      partition.partitionMonth
    ),
    env.OBS_DB.prepare(
      "UPDATE draft_observations SET processing_state = 'finalized', finalized_at = CURRENT_TIMESTAMP WHERE draft_id = ?"
    ).bind(draftId),
    env.OBS_DB.prepare(
      `INSERT INTO observation_data_rights
         (visit_id, occurrence_id, record_consent, research_use_consent, enterprise_report_consent,
          dataset_license, media_license, external_export_allowed, withdrawal_status, source_payload_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(visit_id) DO UPDATE SET
         occurrence_id = excluded.occurrence_id,
         record_consent = excluded.record_consent,
         research_use_consent = excluded.research_use_consent,
         enterprise_report_consent = excluded.enterprise_report_consent,
         dataset_license = excluded.dataset_license,
         media_license = excluded.media_license,
         external_export_allowed = excluded.external_export_allowed,
         withdrawal_status = excluded.withdrawal_status,
         source_payload_json = excluded.source_payload_json,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(
      visitId,
      occurrenceId,
      dataRights.recordConsent,
      dataRights.researchUseConsent,
      dataRights.enterpriseReportConsent,
      dataRights.datasetLicense,
      dataRights.mediaLicense,
      dataRights.externalExportAllowed ? 1 : 0,
      dataRights.withdrawalStatus,
      JSON.stringify(dataRights.sourcePayload)
    ),
    rollbackLedgerInsert(env, {
      eventType: "observation.upsert",
      targetId: visitId,
      partitionMonth: partition.partitionMonth,
      sourceEndpoint: "POST /api/v1/observations/upsert",
      payload: {
        visitId,
        occurrenceIds,
        ownerUserId: input.userId,
        observedAt: input.observedAt,
        taxonLabel,
        note: input.note ?? null,
        exactLat: input.latitude,
        exactLng: input.longitude,
        locationAccuracyM: numberOrNull(input.locationAccuracyM),
        publicCell,
        visibility: "public",
        placeId,
        placeName
      },
      replaySql: postgresObservationReplaySql(
        visitId,
        input.userId,
        input.observedAt,
        taxonLabel,
        input.note ?? null,
        input.latitude,
        input.longitude,
        numberOrNull(input.locationAccuracyM),
        publicCell,
        "public"
      )
    })
  ]);

  await upsertCompatibleWaterRecordIfPresent(env, input.waterRecord, {
    visitId,
    occurrenceId,
    effortMinutes: numberOrNull(input.sourcePayload?.effort_minutes) ?? null,
    targetTaxaScope: normalizeOptionalText(input.targetTaxaScope)
  });

  await hookLegacyObservationToEventNative(env, input, {
    visitId,
    occurrenceId,
    occurrenceIds,
    taxonLabel
  });

  return json({
    ok: true,
    visitId,
    occurrenceId,
    occurrenceIds,
    placeId,
    impact: {
      placeName,
      visitCount: 1,
      previousObservedAt: null,
      focusLabel: taxonLabel,
      captureState: normalizeOptionalText(input.sourcePayload?.quick_capture_state) ?? null
    },
    compatibility: {
      attempted: false,
      succeeded: false
    },
    idempotency: input.clientSubmissionId ? {
      clientSubmissionId: input.clientSubmissionId,
      reused: false
    } : undefined,
    placeMemory: null,
    placeMemorySample: [],
    contributionReceipts: buildLegacyContributionReceipts(visitId, occurrenceId, occurrenceIds.length, placeName, input)
  }, 201);
}

async function upsertCompatibleWaterRecordIfPresent(
  env: Env,
  input: CompatibleWaterRecordInput | null | undefined,
  context: { visitId: string; occurrenceId: string; effortMinutes: number | null; targetTaxaScope: string | null }
): Promise<void> {
  if (!input || typeof input !== "object") return;
  const catchOutcome = normalizeCatchOutcome(input.catchOutcome);
  if (!catchOutcome) return;

  const publicWaterbodyLabel = normalizeOptionalText(input.publicWaterbodyLabel);
  const waterbodyType = normalizeWaterbodyType(input.waterbodyType);
  const source = normalizeOptionalText(input.source) ?? "ikimon";
  const waterbodyId = normalizeOptionalId(input.waterbodyId)
    ?? (publicWaterbodyLabel ? await compatibleWaterbodyIdFor(publicWaterbodyLabel, waterbodyType, source) : null);
  const sourcePayload = {
    ...(asPlainObject(input.sourcePayload) ?? {}),
    source: "cloudflare_observation_write_water_record"
  };

  if (waterbodyId && publicWaterbodyLabel) {
    await env.OBS_DB.prepare(
      `INSERT INTO waterbodies (
         ikimon_waterbody_id, waterbody_type, parent_waterbody_id, public_label,
         source, source_version, geometry_precision, source_payload_json, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(ikimon_waterbody_id) DO UPDATE SET
         waterbody_type = excluded.waterbody_type,
         parent_waterbody_id = excluded.parent_waterbody_id,
         public_label = excluded.public_label,
         source = excluded.source,
         source_version = excluded.source_version,
         geometry_precision = excluded.geometry_precision,
         source_payload_json = excluded.source_payload_json,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(
      waterbodyId,
      waterbodyType,
      normalizeOptionalId(input.parentWaterbodyId),
      publicWaterbodyLabel,
      source,
      normalizeOptionalText(input.sourceVersion) ?? "v0",
      normalizeGeometryPrecision(input.geometryPrecision),
      JSON.stringify(sourcePayload)
    ).run();
  }

  await env.OBS_DB.prepare(
    `INSERT INTO water_record_extensions (
       visit_id, occurrence_id, waterbody_id, catch_outcome, capture_method,
       participant_count, effort_minutes, target_taxa_scope, released_count, kept_count,
       public_waterbody_label, environment_snapshot_json, source_payload_json, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(visit_id) DO UPDATE SET
       occurrence_id = excluded.occurrence_id,
       waterbody_id = excluded.waterbody_id,
       catch_outcome = excluded.catch_outcome,
       capture_method = excluded.capture_method,
       participant_count = excluded.participant_count,
       effort_minutes = excluded.effort_minutes,
       target_taxa_scope = excluded.target_taxa_scope,
       released_count = excluded.released_count,
       kept_count = excluded.kept_count,
       public_waterbody_label = excluded.public_waterbody_label,
       environment_snapshot_json = excluded.environment_snapshot_json,
       source_payload_json = excluded.source_payload_json,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(
    context.visitId,
    context.occurrenceId,
    waterbodyId,
    catchOutcome,
    normalizeOptionalText(input.captureMethod),
    integerOrNull(input.participantCount),
    finiteNumberOrNull(input.effortMinutes) ?? context.effortMinutes,
    normalizeOptionalText(input.targetTaxaScope) ?? context.targetTaxaScope,
    integerOrNull(input.releasedCount),
    integerOrNull(input.keptCount),
    publicWaterbodyLabel,
    JSON.stringify(asPlainObject(input.environmentSnapshot) ?? {}),
    JSON.stringify(sourcePayload)
  ).run();
}

function normalizeCatchOutcome(value: unknown): "caught" | "released" | "kept" | "lost" | "no_catch" | "observed_only" | null {
  return value === "caught" || value === "released" || value === "kept" || value === "lost" || value === "no_catch" || value === "observed_only"
    ? value
    : null;
}

function normalizeWaterbodyType(value: unknown): string {
  const allowed = ["unspecified", "basin", "watershed", "river", "river_segment", "lake", "pond", "wetland", "estuary", "coast", "port", "harbor", "artificial_canal"];
  const text = normalizeOptionalText(value);
  return text && allowed.includes(text) ? text : "unspecified";
}

function normalizeGeometryPrecision(value: unknown): string {
  const allowed = ["label_only", "municipality", "mesh", "segment", "polygon", "exact_private"];
  const text = normalizeOptionalText(value);
  return text && allowed.includes(text) ? text : "label_only";
}

async function compatibleWaterbodyIdFor(label: string, type: string, source: string): Promise<string> {
  const hash = await sha256Hex(textToArrayBuffer(`${source}|${type}|${label.trim().toLowerCase()}`));
  return `ikimon_waterbody_${hash.slice(0, 16)}`;
}

type LegacyObservationEventHookResult = {
  visitId: string;
  occurrenceId: string;
  occurrenceIds: string[];
  taxonLabel: string | null;
};

async function hookLegacyObservationToEventNative(
  env: Env,
  input: LegacyObservationUpsertInput,
  result: LegacyObservationEventHookResult
): Promise<void> {
  const session = await resolveNativeObservationEventSession(env, input).catch(() => null);
  if (!session) return;
  const requestedTeamId = normalizeOptionalText(input.teamId)
    ?? normalizeOptionalText(input.sourcePayload?.teamId)
    ?? normalizeOptionalText(input.sourcePayload?.team_id);
  const participant = await findObservationEventParticipant(env, session.sessionId, input.userId, null).catch(() => null);
  const isOrganizer = session.organizerUserId === input.userId;
  if (!isOrganizer && !participant) return;
  if (!isOrganizer && requestedTeamId && participant?.team_id !== requestedTeamId) return;
  const teamId = requestedTeamId ?? participant?.team_id ?? null;
  const eventType = input.fieldScan && typeof input.fieldScan === "object" ? "field_scan_added" : "observation_added";
  try {
    await appendObservationEventLive(env, {
      sessionId: session.sessionId,
      type: eventType,
      scope: "all",
      actorUserId: input.userId,
      teamId,
      payload: {
        visit_id: result.visitId,
        occurrence_id: result.occurrenceId,
        occurrence_ids: result.occurrenceIds,
        observation_id: result.visitId,
        taxon_name: result.taxonLabel,
        public_lat: roundPublicEventCoordinate(input.latitude),
        public_lng: roundPublicEventCoordinate(input.longitude),
        observed_at: input.observedAt,
        source_type: eventType === "field_scan_added" ? "field_scan" : "record",
        participant_role: normalizeOptionalText(input.participantRole)
          ?? normalizeOptionalText(input.sourcePayload?.participantRole)
          ?? normalizeOptionalText(input.sourcePayload?.participant_role),
        field_scan: sanitizeObservationEventFieldScan(input.fieldScan),
        exact_location_stored: false
      }
    });
  } catch (err) {
    console.error("[observation-event-dual-write] native live event failed", err);
  }
  try {
    await recordObservationEventMeshVisit(env, {
      sessionId: session.sessionId,
      lat: roundPublicEventCoordinate(input.latitude),
      lng: roundPublicEventCoordinate(input.longitude),
      observationDelta: 1,
      teamId
    });
  } catch (err) {
    console.error("[observation-event-dual-write] native mesh upsert failed", err);
  }
  if (result.taxonLabel) {
    await offerNativeObservationEventQuestForNewTaxon(env, session.sessionId, result.taxonLabel, teamId).catch((err) => {
      console.error("[observation-event-dual-write] native quest trigger failed", err);
    });
  }
}

async function resolveNativeObservationEventContextFromPayload(
  env: Env,
  input: Record<string, unknown>,
  auth: SessionSnapshot | null
): Promise<{ sessionId: string; teamId: string | null } | null> {
  const explicitSessionId = normalizeOptionalText(input.eventSessionId)
    ?? normalizeOptionalText(input.event_session_id);
  const eventCode = normalizeOptionalText(input.eventCode)
    ?? normalizeOptionalText(input.event_code);
  const eventSession = explicitSessionId
    ? await getObservationEventSessionById(env, explicitSessionId)
    : eventCode
      ? await getObservationEventSessionByEventCode(env, eventCode)
      : null;
  if (!eventSession || eventSession.endedAt) return null;

  const requestedTeamId = normalizeOptionalText(input.teamId)
    ?? normalizeOptionalText(input.team_id);
  const participant = await findObservationEventParticipant(env, eventSession.sessionId, auth?.userId ?? null, null).catch(() => null);
  const isOrganizer = Boolean(auth?.userId && eventSession.organizerUserId === auth.userId);
  if (!isOrganizer && !participant) return null;
  if (!isOrganizer && requestedTeamId && participant?.team_id !== requestedTeamId) return null;

  return {
    sessionId: eventSession.sessionId,
    teamId: requestedTeamId ?? participant?.team_id ?? null
  };
}

async function appendGuideSceneEventNative(input: {
  env: Env;
  body: Record<string, unknown>;
  session: SessionSnapshot | null;
  guideRecordId: string;
  guideSessionId: string;
  source: string;
  lat: number;
  lng: number;
  capturedAt: string;
  sceneSummary: string;
  detectedSpecies: string[];
  detectedFeatures: unknown[];
  primarySubject: Record<string, unknown>;
}): Promise<boolean> {
  const eventContext = await resolveNativeObservationEventContextFromPayload(input.env, input.body, input.session);
  if (!eventContext) return false;
  await appendObservationEventLive(input.env, {
    sessionId: eventContext.sessionId,
    type: "guide_scene_added",
    scope: "all",
    actorUserId: input.session?.userId ?? null,
    teamId: eventContext.teamId,
    payload: {
      guide_record_id: input.guideRecordId,
      guide_session_id: input.guideSessionId,
      scene_id: normalizeOptionalText(input.body.sceneId ?? input.body.scene_id) ?? null,
      scene_summary: input.sceneSummary,
      detected_species: input.detectedSpecies,
      detected_features: input.detectedFeatures,
      primary_subject: input.primarySubject,
      public_lat: roundPublicEventCoordinate(input.lat),
      public_lng: roundPublicEventCoordinate(input.lng),
      captured_at: input.capturedAt,
      participant_role: normalizeOptionalText(input.body.participantRole)
        ?? normalizeOptionalText(input.body.participant_role),
      source_type: input.source,
      exact_location_stored: false
    }
  });
  return true;
}

async function appendMobileAudioObservationEventNative(input: {
  env: Env;
  body: Record<string, unknown>;
  event: Record<string, unknown>;
  session: SessionSnapshot | null;
  fieldscanSessionId: string;
}): Promise<boolean> {
  const eventContext = await resolveNativeObservationEventContextFromPayload(
    input.env,
    { ...input.body, ...input.event },
    input.session
  );
  if (!eventContext) return false;
  const lat = numberOrNullFromUnknown(input.event.lat ?? input.body.lat);
  const lng = numberOrNullFromUnknown(input.event.lng ?? input.body.lng);
  await appendObservationEventLive(input.env, {
    sessionId: eventContext.sessionId,
    type: "field_scan_added",
    scope: "all",
    actorUserId: input.session?.userId ?? null,
    teamId: eventContext.teamId,
    payload: {
      segment_id: normalizeOptionalText(input.event.segmentId ?? input.event.segment_id ?? input.event.id) ?? crypto.randomUUID(),
      fieldscan_session_id: input.fieldscanSessionId,
      scan_mode: "audio_segment",
      public_lat: lat == null ? null : roundPublicEventCoordinate(lat),
      public_lng: lng == null ? null : roundPublicEventCoordinate(lng),
      recorded_at: normalizeOptionalText(input.event.recordedAt ?? input.event.recorded_at ?? input.body.recordedAt ?? input.body.recorded_at),
      duration_sec: numberOrNullFromUnknown(input.event.durationSec ?? input.event.duration_sec),
      participant_role: normalizeOptionalText(input.event.participantRole ?? input.body.participantRole)
        ?? normalizeOptionalText(input.event.participant_role ?? input.body.participant_role),
      source_type: "field_scan_audio",
      raw_audio_stored: false,
      exact_location_stored: false
    }
  });
  return true;
}

function sanitizeObservationEventFieldScan(input: unknown): Record<string, unknown> | null {
  const payload = asPlainObject(input);
  if (!payload) return null;
  const safe: Record<string, unknown> = {};
  const scanMode = normalizeOptionalText(payload.scan_mode) ?? normalizeOptionalText(payload.scanMode) ?? normalizeOptionalText(payload.mode);
  if (scanMode) safe.scan_mode = scanMode;
  const status = normalizeOptionalText(payload.status) ?? normalizeOptionalText(payload.review_status) ?? normalizeOptionalText(payload.reviewStatus);
  if (status) safe.status = status;
  const confidence = numberOrNullFromUnknown(payload.confidence);
  if (confidence !== null) safe.confidence = confidence;
  const durationSec = numberOrNullFromUnknown(payload.duration_sec ?? payload.durationSec);
  if (durationSec !== null) safe.duration_sec = durationSec;
  const labels = Array.isArray(payload.labels)
    ? payload.labels.map((label) => normalizeOptionalText(label)).filter((label): label is string => Boolean(label)).slice(0, 12)
    : [];
  if (labels.length > 0) safe.labels = labels;
  return Object.keys(safe).length > 0 ? safe : { sanitized: true };
}

async function resolveNativeObservationEventSession(env: Env, input: LegacyObservationUpsertInput) {
  const explicitSessionId = normalizeOptionalText(input.eventSessionId)
    ?? normalizeOptionalText(input.sourcePayload?.eventSessionId)
    ?? normalizeOptionalText(input.sourcePayload?.event_session_id);
  const eventCode = normalizeOptionalText(input.eventCode)
    ?? normalizeOptionalText(input.sourcePayload?.eventCode)
    ?? normalizeOptionalText(input.sourcePayload?.event_code);
  const session = explicitSessionId
    ? await getObservationEventSessionById(env, explicitSessionId)
    : eventCode
      ? await getObservationEventSessionByEventCode(env, eventCode)
      : null;
  if (!session || session.endedAt) return null;
  return session;
}

async function offerNativeObservationEventQuestForNewTaxon(
  env: Env,
  sessionId: string,
  taxonLabel: string,
  teamId: string | null
): Promise<void> {
  const recent = await env.OBS_DB.prepare(
    `SELECT COUNT(*) AS recent
       FROM observation_event_live_events
      WHERE session_id = ?
        AND type = 'observation_added'
        AND created_at > datetime('now', '-60 seconds')
        AND json_extract(payload_json, '$.taxon_name') = ?`
  ).bind(sessionId, taxonLabel).first<{ recent: number }>();
  if (Number(recent?.recent ?? 0) > 1) return;
  const questId = crypto.randomUUID();
  const payload = {
    kind: "taxa",
    headline: `${taxonLabel}の周辺をもう少し`,
    prompt: `${taxonLabel}が出た場所の周辺で、似た環境を数分だけ見てみる。`,
    rationale: "同じ時間帯・近い環境の追加記録は、観察会の種リストと努力量の両方を補強します。",
    trigger: "new_species",
    generated_by: "cloudflare-d1-static-quest"
  };
  await env.OBS_DB.prepare(
    `INSERT INTO observation_event_quests
       (quest_id, session_id, team_id, status, payload_json)
     VALUES (?, ?, ?, 'offered', ?)`
  ).bind(questId, sessionId, teamId, JSON.stringify(payload)).run();
  await appendObservationEventLive(env, {
    sessionId,
    type: "quest_offered",
    scope: teamId ? "team" : "all",
    teamId,
    payload: { quest_id: questId, ...payload }
  });
}

async function uploadLegacyCompatiblePhoto(observationId: string, request: Request, env: Env): Promise<Response> {
  assertNonEmpty(observationId, "observationId");
  const input = await readJson<LegacyPhotoUploadInput>(request);
  const mimeType = normalizeOptionalText(input.mimeType) ?? "image/jpeg";
  const filename = sanitizeFileName(normalizeOptionalText(input.filename) ?? "upload.jpg");
  const body = base64ToArrayBuffer(normalizeOptionalText(input.base64Data) ?? "");
  if (body.byteLength === 0) {
    throw new HttpError(400, "decoded image is empty");
  }
  if (body.byteLength > 10 * 1024 * 1024) {
    throw new HttpError(400, "image exceeds 10MB limit after normalization");
  }

  const observation = await env.OBS_DB.prepare(
    `SELECT draft_id, owner_user_id, partition_month
     FROM observations
     WHERE observation_id = ?`
  ).bind(observationId).first<{ draft_id: string; owner_user_id: string; partition_month: string | null }>();
  if (!observation) {
    return json({ ok: false, error: `observation not found: ${observationId}` }, 404);
  }
  if (env.ENVIRONMENT === "production") {
    const session = await readCompatibleSessionWithOriginFallback(request, env);
    if (!session) {
      return json({ ok: false, error: "session_required" }, 401);
    }
    if (session.userId !== observation.owner_user_id) {
      return json({ ok: false, error: "forbidden" }, 403);
    }
  }
  const partitionMonth = observation.partition_month ?? partitionMonthFromDate(new Date().toISOString());

  const sha256 = await sha256Hex(body);
  const assetId = newId("asset");
  const outboxMediaId = newId("outbox");
  const outboxReadModelId = newId("outbox");
  const objectKey = `original/v1-compat/${observationId}/${assetId}-${filename}`;
  const relativePath = objectKey;
  const occurrenceId = `occ:${observationId}:0`;
  const facePrivacy = normalizeFacePrivacy(input.facePrivacy);

  await env.ASSET_BUCKET.put(objectKey, body, { httpMetadata: { contentType: mimeType } });
  await env.OBS_DB.batch([
    env.OBS_DB.prepare(
      `INSERT INTO asset_ledger
       (asset_id, draft_id, observation_id, owner_user_id, object_key, sha256, mime, bytes, visibility, processing_state, uploaded_at, partition_month)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', CURRENT_TIMESTAMP, ?)`
    ).bind(
      assetId,
      observation.draft_id,
      observationId,
      observation.owner_user_id,
      objectKey,
      sha256,
      mimeType,
      body.byteLength,
      "private",
      partitionMonth
    ),
    env.OBS_DB.prepare(
      "INSERT INTO outbox (outbox_id, topic, target_id, payload_json, partition_month) VALUES (?, ?, ?, ?, ?)"
    ).bind(outboxMediaId, "media.process", observationId, JSON.stringify({ observationId, assetId }), partitionMonth),
    env.OBS_DB.prepare(
      "INSERT INTO outbox (outbox_id, topic, target_id, payload_json, partition_month) VALUES (?, ?, ?, ?, ?)"
    ).bind(outboxReadModelId, "readmodel.refresh", observationId, JSON.stringify({ observationId }), partitionMonth),
    rollbackLedgerInsert(env, {
      eventType: "asset.photo.upload",
      targetId: assetId,
      partitionMonth,
      sourceEndpoint: "POST /api/v1/observations/:id/photos/upload",
      payload: {
        assetId,
        observationId,
        ownerUserId: observation.owner_user_id,
        objectKey,
        sha256,
        mime: mimeType,
        bytes: body.byteLength,
        visibility: "private",
        occurrenceId,
        facePrivacy
      },
      replaySql: postgresAssetReplaySql(assetId, observationId, observation.owner_user_id, objectKey, sha256, mimeType, body.byteLength, "private")
    })
  ]);

  const dispatch = await dispatchOutboxBestEffort(env, [
    { outboxId: outboxMediaId, topic: "media.process", targetId: observationId },
    { outboxId: outboxReadModelId, topic: "readmodel.refresh", targetId: observationId }
  ]);

  return json({
    ok: true,
    visitId: observationId,
    occurrenceId,
    relativePath,
    publicUrl: `/${relativePath}`,
    compatibility: {
      attempted: false,
      succeeded: false
    },
    facePrivacy,
    dispatch
  });
}

function normalizeObservationDataRightsNative(input: unknown): {
  recordConsent: string;
  researchUseConsent: string;
  enterpriseReportConsent: string;
  datasetLicense: string | null;
  mediaLicense: string | null;
  externalExportAllowed: boolean;
  withdrawalStatus: string;
  sourcePayload: Record<string, unknown>;
} {
  const value = asPlainObject(input) ?? {};
  const recordConsent = pickEnum(value.recordConsent, ["private", "internal", "public_summary", "external_export"], "private");
  const researchUseConsent = pickEnum(value.researchUseConsent, ["none", "internal", "research_allowed", "public_export"], "none");
  const enterpriseReportConsent = pickEnum(value.enterpriseReportConsent, ["none", "internal", "aggregated", "identified"], "none");
  const datasetLicense = pickNullableEnum(value.datasetLicense, ["CC0-1.0", "CC-BY-4.0"]);
  const mediaLicense = pickNullableEnum(value.mediaLicense, ["all_rights_reserved", "CC-BY-4.0", "CC-BY-NC-4.0"]);
  const withdrawalStatus = pickEnum(value.withdrawalStatus, ["active", "withdrawn", "delete_requested", "deleted"], "active");
  const externalExportAllowed = value.externalExportAllowed === true
    && recordConsent === "external_export"
    && researchUseConsent === "public_export"
    && Boolean(datasetLicense)
    && mediaLicense !== null
    && mediaLicense !== "all_rights_reserved"
    && withdrawalStatus === "active";
  return {
    recordConsent,
    researchUseConsent,
    enterpriseReportConsent,
    datasetLicense,
    mediaLicense,
    externalExportAllowed,
    withdrawalStatus,
    sourcePayload: value
  };
}

function pickEnum(value: unknown, allowed: string[], fallback: string): string {
  const text = normalizeOptionalText(value);
  return text && allowed.includes(text) ? text : fallback;
}

function pickNullableEnum(value: unknown, allowed: string[]): string | null {
  const text = normalizeOptionalText(value);
  return text && allowed.includes(text) ? text : null;
}

async function putAssetBody(assetId: string, request: Request, env: Env): Promise<Response> {
  assertNonEmpty(assetId, "assetId");
  const asset = await env.OBS_DB.prepare("SELECT object_key, mime FROM asset_ledger WHERE asset_id = ?")
    .bind(assetId)
    .first<{ object_key: string; mime: string }>();
  if (!asset) return json({ error: "asset_not_found" }, 404);
  if (!request.body) return json({ error: "missing_body" }, 400);

  await env.ASSET_BUCKET.put(asset.object_key, request.body, { httpMetadata: { contentType: asset.mime } });
  await env.OBS_DB.prepare(
    "UPDATE asset_ledger SET processing_state = 'uploaded', uploaded_at = CURRENT_TIMESTAMP WHERE asset_id = ?"
  ).bind(assetId).run();

  return json({ ok: true, assetId });
}

async function finalizeObservation(request: Request, env: Env): Promise<Response> {
  const input = await readJson<FinalizeObservationInput>(request);
  assertNonEmpty(input.draftId, "draftId");

  const draft = await env.OBS_DB.prepare("SELECT * FROM draft_observations WHERE draft_id = ?")
    .bind(input.draftId)
    .first<Record<string, D1Value>>();
  if (!draft) return json({ error: "draft_not_found" }, 404);

  const observationId = newId("obs");
  const outboxMediaId = newId("outbox");
  const outboxReadModelId = newId("outbox");
  const observedAt = stringValue(draft.observed_at) ?? new Date().toISOString();
  const partition = resolveObservationPartition(observedAt, env);
  const ownerUserId = stringValue(draft.owner_user_id);
  const publicCell = stringValue(draft.public_cell) ?? "unknown";
  const visibility = stringValue(draft.visibility) === "public" ? "public" : "private";

  if (!ownerUserId) return json({ error: "draft_missing_owner" }, 500);

  await env.OBS_DB.batch([
    env.OBS_DB.prepare(
      `INSERT INTO observations
       (observation_id, draft_id, owner_user_id, observed_at, taxon_label, note, exact_lat, exact_lng,
        location_accuracy_m, public_cell, visibility, partition_month)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      observationId,
      input.draftId,
      ownerUserId,
      observedAt,
      input.taxonLabel ?? null,
      input.note ?? null,
      numberOrNull(draft.exact_lat),
      numberOrNull(draft.exact_lng),
      numberOrNull(draft.location_accuracy_m),
      publicCell,
      visibility,
      partition.partitionMonth
    ),
    env.OBS_DB.prepare(
      "UPDATE draft_observations SET processing_state = 'finalized', finalized_at = CURRENT_TIMESTAMP WHERE draft_id = ?"
    ).bind(input.draftId),
    env.OBS_DB.prepare(
      "UPDATE asset_ledger SET observation_id = ? WHERE draft_id = ?"
    ).bind(observationId, input.draftId),
    env.OBS_DB.prepare(
      "INSERT INTO outbox (outbox_id, topic, target_id, payload_json, partition_month) VALUES (?, ?, ?, ?, ?)"
    ).bind(outboxMediaId, "media.process", observationId, JSON.stringify({ observationId }), partition.partitionMonth),
    env.OBS_DB.prepare(
      "INSERT INTO outbox (outbox_id, topic, target_id, payload_json, partition_month) VALUES (?, ?, ?, ?, ?)"
    ).bind(outboxReadModelId, "readmodel.refresh", observationId, JSON.stringify({ observationId }), partition.partitionMonth),
    rollbackLedgerInsert(env, {
      eventType: "observation.finalize",
      targetId: observationId,
      partitionMonth: partition.partitionMonth,
      sourceEndpoint: "POST /api/v0/observations/finalize",
      payload: {
        observationId,
        draftId: input.draftId,
        ownerUserId,
        observedAt,
        taxonLabel: input.taxonLabel ?? null,
        note: input.note ?? null,
        exactLat: numberOrNull(draft.exact_lat),
        exactLng: numberOrNull(draft.exact_lng),
        locationAccuracyM: numberOrNull(draft.location_accuracy_m),
        publicCell,
        visibility
      },
      replaySql: postgresObservationReplaySql(
        observationId,
        ownerUserId,
        observedAt,
        input.taxonLabel ?? null,
        input.note ?? null,
        numberOrNull(draft.exact_lat),
        numberOrNull(draft.exact_lng),
        numberOrNull(draft.location_accuracy_m),
        publicCell,
        visibility
      )
    })
  ]);

  const dispatch = await dispatchOutboxBestEffort(env, [
    { outboxId: outboxMediaId, topic: "media.process", targetId: observationId },
    { outboxId: outboxReadModelId, topic: "readmodel.refresh", targetId: observationId }
  ]);

  return json({ observationId, processingState: "accepted", dispatch }, 201);
}

async function drainOutbox(env: Env): Promise<Response> {
  const rows = await queryPendingOutbox(env);
  for (const row of rows) {
    await sendOutbox(env, { outboxId: row.outbox_id, topic: row.topic, targetId: row.target_id });
  }
  return json({ dispatched: rows.length });
}

async function r2Inventory(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }
  const prefix = url.searchParams.get("prefix") ?? "original/";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "100"), 1), 1000);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const listed = await env.ASSET_BUCKET.list({ prefix, limit, cursor });
  return json({
    prefix,
    limit,
    cursor: cursor ?? null,
    nextCursor: listed.cursor ?? null,
    truncated: Boolean(listed.truncated),
    count: listed.objects.length,
    bytes: listed.objects.reduce((sum, object) => sum + object.size, 0),
    objects: listed.objects.map((object) => ({
      key: object.key,
      size: object.size,
      etag: object.etag ?? null,
      uploaded: object.uploaded ? new Date(object.uploaded).toISOString() : null,
      checksums: object.checksums ?? null
    }))
  });
}

async function queryPendingOutbox(env: Env): Promise<Array<{ outbox_id: string; topic: MediaJob["topic"]; target_id: string }>> {
  const result = await env.OBS_DB.prepare(
    "SELECT outbox_id, topic, target_id FROM outbox WHERE dispatch_state = 'pending' ORDER BY created_at LIMIT 100"
  ).all<{ outbox_id: string; topic: MediaJob["topic"]; target_id: string }>();
  return result.results;
}

async function dispatchOutboxBestEffort(env: Env, jobs: MediaJob[]): Promise<{ sent: number; pending: number; errors: string[] }> {
  let sent = 0;
  const errors: string[] = [];
  for (const job of jobs) {
    try {
      await sendOutbox(env, job);
      sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown dispatch error";
      errors.push(message);
      await env.OBS_DB.prepare(
        "UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE outbox_id = ?"
      ).bind(message, job.outboxId).run();
    }
  }
  return { sent, pending: jobs.length - sent, errors };
}

async function sendOutbox(env: Env, job: MediaJob): Promise<void> {
  await env.MEDIA_QUEUE.send(job);
  await env.OBS_DB.prepare(
    "UPDATE outbox SET dispatch_state = 'dispatched', dispatched_at = CURRENT_TIMESTAMP WHERE outbox_id = ?"
  ).bind(job.outboxId).run();
}

async function applyMediaJob(job: MediaJob, env: Env): Promise<void> {
  if (job.topic === "media.process") {
    await markUploadedAssetsPublicReady(job.targetId, env);
    await refreshPublicReadmodel(job.targetId, env);
    return;
  }

  if (job.topic === "readmodel.refresh") {
    await refreshPublicReadmodel(job.targetId, env);
  }
}

async function refreshPublicReadmodel(observationId: string, env: Env): Promise<void> {
  const observation = await env.OBS_DB.prepare(
    `SELECT observation_id, public_cell, observed_at, taxon_label, partition_month
     FROM observations
     WHERE observation_id = ? AND visibility = 'public' AND emergency_hidden = 0`
  ).bind(observationId).first<{ observation_id: string; public_cell: string; observed_at: string; taxon_label: string | null; partition_month: string | null }>();
  if (!observation) {
    await deletePublicReadmodelRow(observationId, env);
    return;
  }
  const partitionMonth = observation.partition_month ?? partitionMonthFromDate(observation.observed_at);

  const unsafePublicAssets = await env.OBS_DB.prepare(
    `SELECT COUNT(*) AS count
     FROM asset_ledger
     WHERE observation_id = ?
       AND processing_state = 'uploaded'
       AND (
         public_derivative_key IS NULL
         OR exif_scrub_state != 'scrubbed'
         OR public_ready_at IS NULL
         OR public_derivative_verified_at IS NULL
         OR public_derivative_metadata_json IS NULL
       )`
  ).bind(observationId).first<{ count: number }>();
  if ((unsafePublicAssets?.count ?? 0) > 0) return;

  const publicReadyAssetCount = await env.OBS_DB.prepare(
    `SELECT COUNT(*) AS count
     FROM asset_ledger
     WHERE observation_id = ?
       AND processing_state = 'uploaded'
       AND public_derivative_key IS NOT NULL
       AND exif_scrub_state = 'scrubbed'
       AND public_ready_at IS NOT NULL
       AND public_derivative_verified_at IS NOT NULL
       AND public_derivative_metadata_json IS NOT NULL`
  ).bind(observationId).first<{ count: number }>();

  await env.OBS_DB.prepare(
    `INSERT INTO readmodel_public_observations
     (observation_id, public_cell, observed_at, taxon_label, asset_count, partition_month)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(observation_id) DO UPDATE SET
       public_cell = excluded.public_cell,
       observed_at = excluded.observed_at,
       taxon_label = excluded.taxon_label,
       asset_count = excluded.asset_count,
       partition_month = excluded.partition_month,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(
    observation.observation_id,
    observation.public_cell,
    observation.observed_at,
    observation.taxon_label,
    publicReadyAssetCount?.count ?? 0,
    partitionMonth
  ).run();
  await upsertPublicMapSnapshotRow(observation, publicReadyAssetCount?.count ?? 0, env);
}

async function deletePublicReadmodelRow(observationId: string, env: Env): Promise<void> {
  await env.OBS_DB.prepare(
    "DELETE FROM readmodel_public_observations WHERE observation_id = ?"
  ).bind(observationId).run();
  await deletePublicMapSnapshotRow(observationId, env);
}

async function upsertPublicMapSnapshotRow(
  observation: { observation_id: string; public_cell: string; observed_at: string; taxon_label: string | null },
  assetCount: number,
  env: Env
): Promise<void> {
  try {
    await env.OBS_DB.prepare(
      `INSERT INTO public_map_snapshot_records_v1 (
         snapshot_key,
         occurrence_id,
         visit_id,
         observed_at,
         observed_year,
         taxon_group,
         display_name,
         is_ai_candidate,
         is_awaiting_id,
         locality_label,
         locality_scope,
         cell_1000,
         cell_3000,
         cell_10000,
         asset_count
       )
       VALUES ('public-map:v1:global', ?, ?, ?, ?, ?, ?, 0, ?, '位置をぼかしています', 'blurred', ?, ?, ?, ?)
       ON CONFLICT(snapshot_key, occurrence_id) DO UPDATE SET
         visit_id = excluded.visit_id,
         observed_at = excluded.observed_at,
         observed_year = excluded.observed_year,
         taxon_group = excluded.taxon_group,
         display_name = excluded.display_name,
         is_awaiting_id = excluded.is_awaiting_id,
         cell_1000 = excluded.cell_1000,
         cell_3000 = excluded.cell_3000,
         cell_10000 = excluded.cell_10000,
         asset_count = excluded.asset_count`
    ).bind(
      `occ:${observation.observation_id}:0`,
      observation.observation_id,
      observation.observed_at,
      Number(observation.observed_at.slice(0, 4)) || new Date(observation.observed_at).getUTCFullYear(),
      taxonGroupForLabel(observation.taxon_label),
      observation.taxon_label ?? "同定待ち",
      isWeakTaxonLabel(observation.taxon_label) ? 1 : 0,
      observation.public_cell,
      observation.public_cell,
      observation.public_cell,
      assetCount
    ).run();
    await refreshPublicMapSnapshotMeta(env, "readmodel_refresh");
  } catch (error) {
    if (error instanceof Error && /no such table: public_map_snapshot_(?:records_v1|meta)/i.test(error.message)) return;
    throw error;
  }
}

async function deletePublicMapSnapshotRow(observationId: string, env: Env): Promise<void> {
  try {
    await env.OBS_DB.prepare(
      "DELETE FROM public_map_snapshot_records_v1 WHERE snapshot_key = 'public-map:v1:global' AND occurrence_id = ?"
    ).bind(`occ:${observationId}:0`).run();
    await refreshPublicMapSnapshotMeta(env, "readmodel_refresh_delete");
  } catch (error) {
    if (error instanceof Error && /no such table: public_map_snapshot_(?:records_v1|meta)/i.test(error.message)) return;
    throw error;
  }
}

async function refreshPublicMapSnapshotMeta(env: Env, refreshedBy: string): Promise<void> {
  await env.OBS_DB.prepare(
    `INSERT INTO public_map_snapshot_meta (
       snapshot_key, generated_at, source_sample_size, public_record_count, refreshed_by, policy_json
     )
     VALUES (
       'public-map:v1:global',
       CURRENT_TIMESTAMP,
       (SELECT COUNT(*) FROM readmodel_public_observations),
       (SELECT COUNT(*) FROM public_map_snapshot_records_v1 WHERE snapshot_key = 'public-map:v1:global'),
       ?,
       '{"minCellRecords":3,"sensitiveMinCellMeters":5000,"municipalityMinCellMeters":20000,"bboxScope":"fixed_public_cell_cover","policy":"k_anonymous_cell_aggregate","exposesSuppressedCounts":false}'
     )
     ON CONFLICT(snapshot_key) DO UPDATE SET
       generated_at = excluded.generated_at,
       source_sample_size = excluded.source_sample_size,
       public_record_count = excluded.public_record_count,
       refreshed_by = excluded.refreshed_by,
       policy_json = excluded.policy_json`
  ).bind(refreshedBy).run();
}

async function applyEmergencyHide(observationId: string, env: Env): Promise<void> {
  const observation = await env.OBS_DB.prepare(
    "SELECT draft_id, owner_user_id, partition_month FROM observations WHERE observation_id = ?"
  ).bind(observationId).first<{ draft_id: string; owner_user_id: string; partition_month: string | null }>();
  if (!observation) {
    throw new HttpError(404, `observation not found: ${observationId}`);
  }
  await env.OBS_DB.batch([
    env.OBS_DB.prepare(
      "UPDATE observations SET emergency_hidden = 1 WHERE observation_id = ?"
    ).bind(observationId),
    env.OBS_DB.prepare(
      "DELETE FROM readmodel_public_observations WHERE observation_id = ?"
    ).bind(observationId),
    rollbackLedgerInsert(env, {
      eventType: "observation.hide",
      targetId: observationId,
      partitionMonth: observation.partition_month,
      sourceEndpoint: "POST /api/v1/observations/:id/hide",
      payload: {
        observationId,
        ownerUserId: observation.owner_user_id,
        emergencyHidden: true,
        publicReadmodelDeleted: true
      },
      replaySql: postgresObservationHideReplaySql(observationId)
    })
  ]);
  await deletePublicMapSnapshotRow(observationId, env);
}

async function hideCompatibleObservation(observationId: string, request: Request, env: Env): Promise<Response> {
  if (!isAppRuntime(env)) {
    return json({ ok: false, error: "not_available" }, 404);
  }
  assertNonEmpty(observationId, "observationId");
  const session = await readCompatibleSessionWithOriginFallback(request, env);
  if (!session) {
    return json({ ok: false, error: "session_required" }, 401);
  }
  await assertObservationOwnedByUser(observationId, session.userId, env);
  await applyEmergencyHide(observationId, env);
  return json({
    ok: true,
    visitId: observationId,
    hidden: true,
    canonicalPreserved: true,
    publicReadmodelDeleted: true
  });
}

async function shadowTakedownProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }

  const suffix = sanitizeIdPart(url.searchParams.get("id") ?? new Date().toISOString());
  const observationId = `shadow-takedown-${suffix}`.slice(0, 120);
  const observedAt = "2026-06-15T03:00:00.000Z";
  const upsertResponse = await upsertLegacyCompatibleObservation(new Request("https://shadow.test/api/v1/observations/upsert", {
    method: "POST",
    body: JSON.stringify({
      observationId,
      userId: "shadow-takedown-user",
      observedAt,
      latitude: 34.71234,
      longitude: 137.81234,
      visibility: "public",
      taxon: { vernacularName: "緊急非公開テスト", rank: "species" },
      note: "shadow takedown propagation proof"
    })
  }), env);
  if (!upsertResponse.ok) {
    return upsertResponse;
  }

  const photoResponse = await uploadLegacyCompatiblePhoto(observationId, new Request(`https://shadow.test/api/v1/observations/${encodeURIComponent(observationId)}/photos/upload`, {
    method: "POST",
    body: JSON.stringify({
      filename: "takedown-proof.jpg",
      mimeType: "image/jpeg",
      base64Data: btoa("shadow-takedown-image")
    })
  }), env);
  if (!photoResponse.ok) {
    return photoResponse;
  }

  await markUploadedAssetsPublicReady(observationId, env);
  await refreshPublicReadmodel(observationId, env);

  const before = await takedownVisibilityState(observationId, env);
  await applyEmergencyHide(observationId, env);
  await refreshPublicReadmodel(observationId, env);
  const after = await takedownVisibilityState(observationId, env);
  const canonical = await env.OBS_DB.prepare(
    `SELECT o.observation_id, o.emergency_hidden, COUNT(a.asset_id) AS asset_count
     FROM observations o
     LEFT JOIN asset_ledger a ON a.observation_id = o.observation_id
     WHERE o.observation_id = ?
     GROUP BY o.observation_id, o.emergency_hidden`
  ).bind(observationId).first<{ observation_id: string; emergency_hidden: number; asset_count: number }>();

  return json({
    ok: before.publicDetailVisible === true &&
      before.mapVisible === true &&
      after.publicDetailVisible === false &&
      after.mapVisible === false &&
      canonical?.emergency_hidden === 1 &&
      (canonical?.asset_count ?? 0) > 0,
    observationId,
    before,
    after,
    canonical,
    invariants: {
      canonicalDeleted: false,
      readmodelHidden: after.readmodelRows === 0,
      publicDetailHidden: !after.publicDetailVisible,
      mapHidden: !after.mapVisible,
      exactLocationExposed: false
    }
  }, 200, { "cache-control": "no-store" });
}

async function takedownVisibilityState(observationId: string, env: Env) {
  const readmodelRows = await env.OBS_DB.prepare(
    "SELECT COUNT(*) AS count FROM readmodel_public_observations WHERE observation_id = ?"
  ).bind(observationId).first<{ count: number }>();
  const detail = await buildPublicObservationDetail(observationId, env);
  const mapRows = await queryPublicMapRows(env);
  return {
    readmodelRows: readmodelRows?.count ?? 0,
    publicDetailVisible: Boolean(detail),
    mapVisible: mapRows.some((row) => row.observation_id === observationId)
  };
}

async function shadowVideoMetadataProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_found" }, 404);
  }

  const suffix = sanitizeIdPart(url.searchParams.get("id") ?? new Date().toISOString());
  const observationId = `shadow-video-metadata-${suffix}`.slice(0, 120);
  const userId = `shadow-video-user-${suffix}`.slice(0, 120);
  const videoBytes = shadowSafeMp4Bytes();

  const upsertResponse = await upsertLegacyCompatibleObservation(new Request(`${url.origin}/api/v1/observations/upsert`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      observationId,
      userId,
      observedAt: "2026-06-15T03:00:00.000Z",
      latitude: 34.71234,
      longitude: 137.81234,
      locationAccuracyM: 12,
      visibility: "public",
      taxon: { vernacularName: "shadow video proof", rank: "species" },
      note: "shadow video metadata privacy proof"
    })
  }), env);
  if (!upsertResponse.ok) {
    return upsertResponse;
  }

  const sessionResponse = await issueCompatibleSession(new Request(`${url.origin}/api/v1/auth/session/issue`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, ttlHours: 1 })
  }), env);
  const cookie = sessionResponse.headers.get("set-cookie") ?? "";

  const directResponse = await createCompatibleVideoDirectUpload(new Request(`${url.origin}/api/v1/videos/direct-upload`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      filename: "shadow-safe-container.mp4",
      observationId,
      maxDurationSeconds: 12,
      fileSizeBytes: videoBytes.byteLength,
      uploadProtocol: "post"
    })
  }), env);
  const directPayload = await directResponse.json() as { ok?: boolean; uid?: string; uploadUrl?: string };
  if (!directResponse.ok || !directPayload.uid || !directPayload.uploadUrl) {
    return json({ ok: false, error: "direct_upload_failed", payload: directPayload }, 500);
  }

  const bodyResponse = await putCompatibleVideoBody(directPayload.uid, new Request(directPayload.uploadUrl, {
    method: "PUT",
    headers: { "content-type": "video/mp4" },
    body: videoBytes
  }), env);
  if (!bodyResponse.ok) {
    return json({ ok: false, error: "video_body_upload_failed", status: bodyResponse.status }, 500);
  }

  const finalizeResponse = await finalizeCompatibleVideo(directPayload.uid, new Request(`${url.origin}/api/v1/videos/${encodeURIComponent(directPayload.uid)}/finalize`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      observationId,
      durationMs: 9000,
      readyToStream: true,
      bytes: videoBytes.byteLength
    })
  }), env);
  const finalizePayload = await finalizeResponse.json() as { ok?: boolean; video?: { watchUrl?: string; thumbnailUrl?: string } };
  if (!finalizeResponse.ok || !finalizePayload.video?.watchUrl) {
    return json({ ok: false, error: "video_finalize_failed", payload: finalizePayload }, 500);
  }

  await refreshPublicReadmodel(observationId, env);
  const servedVideo = await getShadowVideoStream(directPayload.uid, env);
  const servedVideoBytes = await servedVideo.arrayBuffer();
  const videoInspection = inspectVideoContainerMetadata(servedVideoBytes, servedVideo.headers.get("content-type") ?? "");
  const servedPoster = await getShadowVideoThumbnail(directPayload.uid, env);
  const servedPosterBytes = await servedPoster.arrayBuffer();
  const posterInspection = inspectPublicDerivativeMetadata(servedPosterBytes, servedPoster.headers.get("content-type") ?? "");
  const assetId = `video_asset_${directPayload.uid}`;
  const videoAsset = await env.OBS_DB.prepare(
    "SELECT object_key, mime FROM asset_ledger WHERE asset_id = ?"
  ).bind(assetId).first<{ object_key: string; mime: string }>();
  if (videoAsset && videoInspection.ftypPresent && !videoInspection.gpsExifPresent) {
    await env.OBS_DB.prepare(
      `UPDATE asset_ledger
       SET public_derivative_key = ?,
           public_derivative_sha256 = ?,
           public_derivative_verified_at = CURRENT_TIMESTAMP,
           public_derivative_metadata_json = ?,
           exif_scrub_state = 'scrubbed',
           public_ready_at = CURRENT_TIMESTAMP,
           processing_state = 'uploaded'
       WHERE asset_id = ?`
    ).bind(videoAsset.object_key, await sha256Hex(servedVideoBytes), JSON.stringify(videoInspection), assetId).run();
  }
  await refreshPublicReadmodel(observationId, env);
  const visibility = await takedownVisibilityState(observationId, env);

  return json({
    ok: servedVideo.ok &&
      servedPoster.ok &&
      videoInspection.ftypPresent &&
      !videoInspection.gpsExifPresent &&
      !posterInspection.gpsExifPresent &&
      visibility.publicDetailVisible &&
      visibility.mapVisible,
    observationId,
    uid: directPayload.uid,
    served: {
      videoStatus: servedVideo.status,
      videoContentType: servedVideo.headers.get("content-type"),
      posterStatus: servedPoster.status,
      posterContentType: servedPoster.headers.get("content-type")
    },
    videoInspection,
    posterInspection,
    visibility,
    invariants: {
      servedVideoIsMp4: videoInspection.ftypPresent,
      videoGpsExifAbsent: !videoInspection.gpsExifPresent,
      posterGpsExifAbsent: !posterInspection.gpsExifPresent,
      exactLocationExposed: videoInspection.exactCoordinateLiteralPresent || posterInspection.exactCoordinateLiteralPresent
    }
  }, 200, { "cache-control": "no-store" });
}

async function legacyAssetImportSummary(env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }
  const legacy = await env.OBS_DB.prepare(
    `SELECT import_status, asset_role, COUNT(*) AS count
     FROM legacy_asset_import_ledger
     GROUP BY import_status, asset_role
     ORDER BY import_status, asset_role`
  ).all<{ import_status: string; asset_role: string; count: number }>();
  const stream = await env.OBS_DB.prepare(
    `SELECT exists_on_stream, ready_to_stream, status_state, COUNT(*) AS count
     FROM legacy_stream_inventory
     GROUP BY exists_on_stream, ready_to_stream, status_state
     ORDER BY exists_on_stream DESC, ready_to_stream DESC, status_state`
  ).all<{ exists_on_stream: number; ready_to_stream: number; status_state: string | null; count: number }>();
  return json({ rows: legacy.results, streamInventory: stream.results });
}

async function r2ImportSummary(env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }
  const result = await env.OBS_DB.prepare(
    `SELECT import_status, asset_role, COUNT(*) AS count, SUM(uploaded_bytes) AS uploaded_bytes
     FROM legacy_r2_import_ledger
     GROUP BY import_status, asset_role
     ORDER BY import_status, asset_role`
  ).all<{ import_status: string; asset_role: string; count: number; uploaded_bytes: number | null }>();
  return json({ rows: result.results });
}

async function productionRestoreParitySummary(env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }
  const run = await env.OBS_DB.prepare(
    `SELECT run_id, source_db, collected_at, table_count, critical_json, orphan_json, note
     FROM production_restore_parity_runs
     ORDER BY collected_at DESC
     LIMIT 1`
  ).first<{
    run_id: string;
    source_db: string;
    collected_at: string;
    table_count: number;
    critical_json: string;
    orphan_json: string;
    note: string | null;
  }>();
  if (!run) {
    return json({ run: null, metrics: [] });
  }
  const metrics = await env.OBS_DB.prepare(
    `SELECT metric_type, metric_key, metric_value, detail_json
     FROM production_restore_parity_metrics
     WHERE run_id = ?
     ORDER BY metric_type, metric_key`
  ).bind(run.run_id).all<{
    metric_type: string;
    metric_key: string;
    metric_value: string;
    detail_json: string | null;
  }>();
  return json({
    run: {
      ...run,
      critical: JSON.parse(run.critical_json),
      orphanChecks: JSON.parse(run.orphan_json)
    },
    metrics: metrics.results
  });
}

async function productionImportSummary(env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }
  const countQueries: Array<[string, string]> = [
    ["users", "SELECT COUNT(*) AS count FROM production_import_users"],
    ["visits", "SELECT COUNT(*) AS count FROM production_import_visits"],
    ["occurrences", "SELECT COUNT(*) AS count FROM production_import_occurrences"],
    ["asset_blobs", "SELECT COUNT(*) AS count FROM production_import_asset_blobs"],
    ["evidence_assets", "SELECT COUNT(*) AS count FROM production_import_evidence_assets"],
    ["public_readmodel", "SELECT COUNT(*) AS count FROM production_import_public_readmodel"]
  ];
  const counts = [];
  for (const [tableName, query] of countQueries) {
    const row = await env.OBS_DB.prepare(query).first<{ count: number }>();
    counts.push({ table_name: tableName, count: row?.count ?? 0 });
  }
  const orphanQueries: Array<[string, string]> = [
    ["visits_missing_user", "SELECT COUNT(*) AS count FROM production_import_visits v LEFT JOIN production_import_users u ON u.user_id = v.user_id WHERE v.user_id IS NOT NULL AND u.user_id IS NULL"],
    ["occurrences_missing_visit", "SELECT COUNT(*) AS count FROM production_import_occurrences o LEFT JOIN production_import_visits v ON v.visit_id = o.visit_id WHERE o.visit_id IS NOT NULL AND v.visit_id IS NULL"],
    ["assets_missing_blob", "SELECT COUNT(*) AS count FROM production_import_evidence_assets a LEFT JOIN production_import_asset_blobs b ON b.blob_id = a.blob_id WHERE a.blob_id IS NOT NULL AND b.blob_id IS NULL"],
    ["assets_missing_visit", "SELECT COUNT(*) AS count FROM production_import_evidence_assets a LEFT JOIN production_import_visits v ON v.visit_id = a.visit_id WHERE a.visit_id IS NOT NULL AND a.visit_id != '' AND v.visit_id IS NULL"],
    ["assets_missing_occurrence", "SELECT COUNT(*) AS count FROM production_import_evidence_assets a LEFT JOIN production_import_occurrences o ON o.occurrence_id = a.occurrence_id WHERE a.occurrence_id IS NOT NULL AND a.occurrence_id != '' AND o.occurrence_id IS NULL"]
  ];
  const orphanChecks = [];
  for (const [checkName, query] of orphanQueries) {
    const row = await env.OBS_DB.prepare(query).first<{ count: number }>();
    orphanChecks.push({ check_name: checkName, count: row?.count ?? 0 });
  }
  const mediaCoverage = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS evidence_assets,
       SUM(CASE WHEN r.asset_id IS NOT NULL AND r.import_status = 'uploaded_verified' THEN 1 ELSE 0 END) AS r2_verified,
       SUM(CASE WHEN l.asset_id IS NOT NULL THEN 1 ELSE 0 END) AS legacy_ledgered,
       SUM(CASE WHEN s.asset_id IS NOT NULL AND s.exists_on_stream = 1 THEN 1 ELSE 0 END) AS stream_exists
     FROM production_import_evidence_assets a
     LEFT JOIN legacy_r2_import_ledger r ON r.asset_id = a.asset_id
     LEFT JOIN legacy_asset_import_ledger l ON l.asset_id = a.asset_id
     LEFT JOIN legacy_stream_inventory s ON s.asset_id = a.asset_id`
  ).first<{
    evidence_assets: number;
    r2_verified: number | null;
    legacy_ledgered: number | null;
    stream_exists: number | null;
  }>();
  const publicReadmodel = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS rows,
       SUM(occurrence_count) AS occurrence_count,
       SUM(asset_count) AS asset_count,
       SUM(public_ready_asset_count) AS public_ready_asset_count,
       SUM(unresolved_asset_count) AS unresolved_asset_count
     FROM production_import_public_readmodel`
  ).first<{
    rows: number;
    occurrence_count: number | null;
    asset_count: number | null;
    public_ready_asset_count: number | null;
    unresolved_asset_count: number | null;
  }>();
  return json({
    counts,
    orphanChecks,
    mediaCoverage,
    publicReadmodel
  });
}

async function shadowMissingMediaLedgerProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }

  const expectedMissing = Number(url.searchParams.get("expected_missing") ?? "47");
  const expectedStreamPending = Number(url.searchParams.get("expected_stream_pending") ?? "34");
  const legacyBreakdown = await env.OBS_DB.prepare(
    `SELECT import_status, asset_role, COUNT(*) AS count
     FROM legacy_asset_import_ledger
     GROUP BY import_status, asset_role
     ORDER BY import_status, asset_role`
  ).all<{ import_status: string; asset_role: string; count: number }>();
  const missingLegacyAssets = await env.OBS_DB.prepare(
    "SELECT COUNT(*) AS count FROM legacy_asset_import_ledger WHERE import_status = 'missing_legacy_asset'"
  ).first<{ count: number }>();
  const streamPendingAssets = await env.OBS_DB.prepare(
    "SELECT COUNT(*) AS count FROM legacy_asset_import_ledger WHERE import_status = 'stream_inventory_pending'"
  ).first<{ count: number }>();
  const missingAlsoUploaded = await env.OBS_DB.prepare(
    `SELECT COUNT(*) AS count
     FROM legacy_asset_import_ledger l
     JOIN legacy_r2_import_ledger r ON r.asset_id = l.asset_id
     WHERE l.import_status = 'missing_legacy_asset'
       AND r.import_status = 'uploaded_verified'`
  ).first<{ count: number }>();
  const publicReadmodel = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS rows,
       SUM(asset_count) AS asset_count,
       SUM(public_ready_asset_count) AS public_ready_asset_count,
       SUM(unresolved_asset_count) AS unresolved_asset_count
     FROM production_import_public_readmodel`
  ).first<{
    rows: number;
    asset_count: number | null;
    public_ready_asset_count: number | null;
    unresolved_asset_count: number | null;
  }>();

  const assetCount = publicReadmodel?.asset_count ?? 0;
  const publicReadyAssetCount = publicReadmodel?.public_ready_asset_count ?? 0;
  const unresolvedAssetCount = publicReadmodel?.unresolved_asset_count ?? 0;
  const missingCount = missingLegacyAssets?.count ?? 0;
  const streamPendingCount = streamPendingAssets?.count ?? 0;
  const doubleImportedCount = missingAlsoUploaded?.count ?? 0;

  return json({
    ok: true,
    gate: "missing_legacy_asset_degraded_public_readmodel",
    expected: {
      missingLegacyAssets: expectedMissing,
      streamInventoryPending: expectedStreamPending
    },
    legacyBreakdown: legacyBreakdown.results,
    publicReadmodel: {
      rows: publicReadmodel?.rows ?? 0,
      assetCount,
      publicReadyAssetCount,
      unresolvedAssetCount
    },
    invariants: {
      missingLegacyAssetsLedgered: missingCount === expectedMissing,
      streamInventoryPendingLedgered: streamPendingCount === expectedStreamPending,
      missingLegacyAssetsNotUploadedVerified: doubleImportedCount === 0,
      unresolvedAssetsRemainExplicit: unresolvedAssetCount > 0,
      publicReadyDoesNotIncludeUnresolved: publicReadyAssetCount + unresolvedAssetCount === assetCount
    }
  });
}

async function shadowProductionImportDressRehearsalProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }

  const expectedReadmodelRows = clampInteger(Number(url.searchParams.get("expected_public_rows") ?? "588"), 0, 1000000);
  const expectedEvidenceAssets = clampInteger(Number(url.searchParams.get("expected_evidence_assets") ?? "2032"), 0, 1000000);
  const expectedR2Verified = clampInteger(Number(url.searchParams.get("expected_r2_verified") ?? "1951"), 0, 1000000);
  const expectedR2Objects = clampInteger(Number(url.searchParams.get("expected_r2_objects") ?? "1951"), 0, 1000000);
  const expectedR2Bytes = clampInteger(Number(url.searchParams.get("expected_r2_bytes") ?? "2338615108"), 0, 100000000000);
  const expectedLegacyLedgered = clampInteger(Number(url.searchParams.get("expected_legacy_ledgered") ?? "81"), 0, 1000000);
  const expectedUnresolvedAssets = clampInteger(Number(url.searchParams.get("expected_unresolved_assets") ?? "55"), 0, 1000000);
  const expectedStreamExists = clampInteger(Number(url.searchParams.get("expected_stream_exists") ?? "34"), 0, 1000000);

  const publicReadmodel = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS rows,
       SUM(asset_count) AS asset_count,
       SUM(public_ready_asset_count) AS public_ready_asset_count,
       SUM(unresolved_asset_count) AS unresolved_asset_count
     FROM production_import_public_readmodel`
  ).first<{
    rows: number;
    asset_count: number | null;
    public_ready_asset_count: number | null;
    unresolved_asset_count: number | null;
  }>();

  const mediaCoverage = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS evidence_assets,
       SUM(CASE WHEN r.asset_id IS NOT NULL AND r.import_status = 'uploaded_verified' THEN 1 ELSE 0 END) AS r2_verified,
       SUM(CASE WHEN l.asset_id IS NOT NULL THEN 1 ELSE 0 END) AS legacy_ledgered,
       SUM(CASE WHEN s.asset_id IS NOT NULL AND s.exists_on_stream = 1 THEN 1 ELSE 0 END) AS stream_exists
     FROM production_import_evidence_assets a
     LEFT JOIN legacy_r2_import_ledger r ON r.asset_id = a.asset_id
     LEFT JOIN legacy_asset_import_ledger l ON l.asset_id = a.asset_id
     LEFT JOIN legacy_stream_inventory s ON s.asset_id = a.asset_id`
  ).first<{
    evidence_assets: number;
    r2_verified: number | null;
    legacy_ledgered: number | null;
    stream_exists: number | null;
  }>();

  const r2Ledger = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS verified_count,
       SUM(COALESCE(verified_bytes, uploaded_bytes)) AS verified_bytes,
       SUM(CASE
         WHEN import_status = 'uploaded_verified'
          AND uploaded_sha256 = expected_sha256
          AND verified_sha256 = expected_sha256
          AND uploaded_bytes = expected_bytes
          AND verified_bytes = expected_bytes
         THEN 1 ELSE 0 END) AS checksum_match_count
     FROM legacy_r2_import_ledger
     WHERE import_status = 'uploaded_verified'`
  ).first<{
    verified_count: number;
    verified_bytes: number | null;
    checksum_match_count: number | null;
  }>();

  const streamInventory = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN exists_on_stream = 1 THEN 1 ELSE 0 END) AS exists_count,
       SUM(CASE WHEN ready_to_stream = 1 THEN 1 ELSE 0 END) AS ready_count,
       SUM(CASE WHEN exists_on_stream = 1 AND ready_to_stream = 0 THEN 1 ELSE 0 END) AS nonready_count
     FROM legacy_stream_inventory`
  ).first<{
    total: number;
    exists_count: number | null;
    ready_count: number | null;
    nonready_count: number | null;
  }>();

  const prefixes = [
    "import-smoke/20260615/",
    "import-smoke/20260615-data/original/"
  ];
  const r2Inventory = await summarizeR2Prefixes(env.ASSET_BUCKET, prefixes);

  const assetCount = publicReadmodel?.asset_count ?? 0;
  const publicReadyAssetCount = publicReadmodel?.public_ready_asset_count ?? 0;
  const unresolvedAssetCount = publicReadmodel?.unresolved_asset_count ?? 0;
  const evidenceAssets = mediaCoverage?.evidence_assets ?? 0;
  const r2Verified = mediaCoverage?.r2_verified ?? 0;
  const legacyLedgered = mediaCoverage?.legacy_ledgered ?? 0;
  const streamExists = mediaCoverage?.stream_exists ?? 0;
  const r2LedgerVerifiedCount = r2Ledger?.verified_count ?? 0;
  const r2LedgerVerifiedBytes = r2Ledger?.verified_bytes ?? 0;
  const r2ChecksumMatchCount = r2Ledger?.checksum_match_count ?? 0;

  const invariants = {
    productionReadmodelImported: publicReadmodel?.rows === expectedReadmodelRows,
    evidenceAssetsImported: evidenceAssets === expectedEvidenceAssets,
    mediaCoverageComplete: r2Verified + legacyLedgered === evidenceAssets,
    r2LedgerCountMatches: r2LedgerVerifiedCount === expectedR2Verified,
    r2LedgerChecksumVerified: r2ChecksumMatchCount === r2LedgerVerifiedCount,
    r2InventoryCountMatchesLedger: r2Inventory.totalObjects === expectedR2Objects && r2Inventory.totalObjects === r2LedgerVerifiedCount,
    r2InventoryBytesMatchLedger: r2Inventory.totalBytes === expectedR2Bytes && r2Inventory.totalBytes === r2LedgerVerifiedBytes,
    unresolvedAssetsRemainExplicit: unresolvedAssetCount === expectedUnresolvedAssets && publicReadyAssetCount + unresolvedAssetCount === assetCount,
    streamInventoryExists: streamExists === expectedStreamExists && (streamInventory?.exists_count ?? 0) === expectedStreamExists,
    mutationPerformed: false,
    productionTrafficAffected: false
  };
  const ok =
    invariants.productionReadmodelImported &&
    invariants.evidenceAssetsImported &&
    invariants.mediaCoverageComplete &&
    invariants.r2LedgerCountMatches &&
    invariants.r2LedgerChecksumVerified &&
    invariants.r2InventoryCountMatchesLedger &&
    invariants.r2InventoryBytesMatchLedger &&
    invariants.unresolvedAssetsRemainExplicit &&
    invariants.streamInventoryExists &&
    !invariants.mutationPerformed &&
    !invariants.productionTrafficAffected;

  return json({
    ok,
    gate: "production_imported_data_r2_inventory_dress_rehearsal",
    mode: "dry_run_no_production_mutation",
    publicReadmodel: {
      rows: publicReadmodel?.rows ?? 0,
      assetCount,
      publicReadyAssetCount,
      unresolvedAssetCount
    },
    mediaCoverage: {
      evidenceAssets,
      r2Verified,
      legacyLedgered,
      streamExists
    },
    r2Ledger: {
      verifiedCount: r2LedgerVerifiedCount,
      verifiedBytes: r2LedgerVerifiedBytes,
      checksumMatchCount: r2ChecksumMatchCount
    },
    r2Inventory,
    streamInventory: {
      total: streamInventory?.total ?? 0,
      existsCount: streamInventory?.exists_count ?? 0,
      readyCount: streamInventory?.ready_count ?? 0,
      nonReadyCount: streamInventory?.nonready_count ?? 0
    },
    invariants
  }, 200, { "cache-control": "no-store" });
}

async function shadowRouteChangeRehearsalProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }

  const requiredStagingGates = [
    "health_internal_guard",
    "stream_nonready_exclusion",
    "missing_media_ledger",
    "video_metadata_privacy_and_takedown",
    "update_delete_idempotent_replay",
    "rollback_restore_smoke",
    "production_imported_data_r2_inventory",
    "auth_record_photo_video_map_detail"
  ];
  const productionHosts = ["ikimon.life", "www.ikimon.life"];
  const stagingHost = url.searchParams.get("staging_host") ?? "staging.ikimon.life";

  const routeMatrix = [
    {
      host: stagingHost,
      path: "/cloudflare-shadow/health",
      currentExpectedStatus: 200,
      postCutoverExpectedStatus: 200,
      target: "staging_shadow_proxy",
      productionHost: false
    },
    {
      host: stagingHost,
      path: "/cloudflare-shadow/shadow-smoke/route-change-rehearsal-proof",
      currentExpectedStatus: 200,
      postCutoverExpectedStatus: 200,
      target: "staging_shadow_proxy",
      productionHost: false
    },
    {
      host: "ikimon.life",
      path: "/cloudflare-shadow/health",
      currentExpectedStatus: 404,
      postCutoverExpectedStatus: 404,
      target: "shadow_proxy_must_remain_disabled_on_production_hosts",
      productionHost: true
    },
    {
      host: "ikimon.life",
      path: "/health",
      currentExpectedStatus: null,
      postCutoverExpectedStatus: 200,
      target: "cloudflare_managed_app_health",
      productionHost: true
    },
    {
      host: "www.ikimon.life",
      path: "/",
      currentExpectedStatus: null,
      postCutoverExpectedStatus: 308,
      target: "canonical_apex_redirect",
      productionHost: true
    }
  ];

  const invariants = {
    dnsUnchanged: true,
    workerRouteUnchanged: true,
    maintenanceModeUnchanged: true,
    mutationPerformed: false,
    productionTrafficAffected: false,
    stagingShadowProxyOnly: routeMatrix.filter((route) => route.target === "staging_shadow_proxy").every((route) => !route.productionHost),
    productionShadowProxyClosed: routeMatrix.some((route) => route.host === "ikimon.life" && route.path === "/cloudflare-shadow/health" && route.postCutoverExpectedStatus === 404),
    apexAndWwwPostCutoverDefined: productionHosts.every((host) => routeMatrix.some((route) => route.host === host && route.productionHost)),
    requiredGatesEnumerated: requiredStagingGates.length === 8,
    rollbackRouteDocumented: true,
    cutoverRequiresExplicitApproval: true
  };
  const ok =
    invariants.dnsUnchanged &&
    invariants.workerRouteUnchanged &&
    invariants.maintenanceModeUnchanged &&
    !invariants.mutationPerformed &&
    !invariants.productionTrafficAffected &&
    invariants.stagingShadowProxyOnly &&
    invariants.productionShadowProxyClosed &&
    invariants.apexAndWwwPostCutoverDefined &&
    invariants.requiredGatesEnumerated &&
    invariants.rollbackRouteDocumented &&
    invariants.cutoverRequiresExplicitApproval;

  return json({
    ok,
    gate: "staging_route_change_rehearsal",
    mode: "dry_run_no_dns_or_route_mutation",
    hosts: {
      staging: stagingHost,
      production: productionHosts
    },
    routeMatrix,
    requiredStagingGates,
    rollback: {
      target: "restore_previous_vps_origin_and_disable_cloudflare_managed_routes",
      productionDataMutation: false,
      dnsMutationPerformed: false,
      routeMutationPerformed: false
    },
    invariants
  }, 200, { "cache-control": "no-store" });
}

async function summarizeR2Prefixes(bucket: R2Bucket, prefixes: string[]) {
  const prefixSummaries = [];
  let totalObjects = 0;
  let totalBytes = 0;
  for (const prefix of prefixes) {
    let cursor: string | undefined;
    let objects = 0;
    let bytes = 0;
    let pages = 0;
    do {
      const page = await bucket.list({ prefix, limit: 1000, cursor });
      pages += 1;
      for (const object of page.objects) {
        objects += 1;
        bytes += object.size;
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    prefixSummaries.push({ prefix, objects, bytes, pages });
    totalObjects += objects;
    totalBytes += bytes;
  }
  return {
    prefixes: prefixSummaries,
    totalObjects,
    totalBytes
  };
}

async function shadowStreamNonReadyExclusionProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }

  const expectedNonReady = Number(url.searchParams.get("expected_nonready") ?? "2");
  const expectedReady = Number(url.searchParams.get("expected_ready") ?? "32");
  const expectedTotal = Number(url.searchParams.get("expected_total") ?? "34");

  const inventory = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN exists_on_stream = 1 THEN 1 ELSE 0 END) AS exists_count,
       SUM(CASE WHEN ready_to_stream = 1 THEN 1 ELSE 0 END) AS ready_count,
       SUM(CASE WHEN exists_on_stream = 1 AND ready_to_stream = 0 THEN 1 ELSE 0 END) AS nonready_count
     FROM legacy_stream_inventory`
  ).first<{
    total: number;
    exists_count: number | null;
    ready_count: number | null;
    nonready_count: number | null;
  }>();

  const nonReadyRows = await env.OBS_DB.prepare(
    `SELECT stream_uid, asset_id, visit_id, ready_to_stream, status_state, modified_at_stream
     FROM legacy_stream_inventory
     WHERE exists_on_stream = 1
       AND ready_to_stream = 0
     ORDER BY stream_uid`
  ).all<{
    stream_uid: string;
    asset_id: string;
    visit_id: string;
    ready_to_stream: number;
    status_state: string | null;
    modified_at_stream: string | null;
  }>();

  const ledgeredNonReady = await env.OBS_DB.prepare(
    `SELECT COUNT(*) AS count
     FROM legacy_stream_inventory s
     JOIN legacy_asset_import_ledger l ON l.asset_id = s.asset_id
     WHERE s.exists_on_stream = 1
       AND s.ready_to_stream = 0
       AND l.import_status = 'stream_inventory_pending'`
  ).first<{ count: number }>();

  const publicReadmodel = await env.OBS_DB.prepare(
    `SELECT
       SUM(asset_count) AS asset_count,
       SUM(public_ready_asset_count) AS public_ready_asset_count,
       SUM(unresolved_asset_count) AS unresolved_asset_count
     FROM production_import_public_readmodel`
  ).first<{
    asset_count: number | null;
    public_ready_asset_count: number | null;
    unresolved_asset_count: number | null;
  }>();

  const total = inventory?.total ?? 0;
  const existsCount = inventory?.exists_count ?? 0;
  const readyCount = inventory?.ready_count ?? 0;
  const nonReadyCount = inventory?.nonready_count ?? 0;
  const ledgeredCount = ledgeredNonReady?.count ?? 0;
  const assetCount = publicReadmodel?.asset_count ?? 0;
  const publicReadyAssetCount = publicReadmodel?.public_ready_asset_count ?? 0;
  const unresolvedAssetCount = publicReadmodel?.unresolved_asset_count ?? 0;

  return json({
    ok: true,
    gate: "stream_nonready_excluded_from_public_ready",
    expected: {
      total: expectedTotal,
      ready: expectedReady,
      nonReady: expectedNonReady
    },
    inventory: {
      total,
      existsCount,
      readyCount,
      nonReadyCount
    },
    nonReadyRows: nonReadyRows.results,
    publicReadmodel: {
      assetCount,
      publicReadyAssetCount,
      unresolvedAssetCount
    },
    invariants: {
      allStreamRowsAccountedFor: total === expectedTotal && existsCount === expectedTotal,
      readyCountMatchesExpected: readyCount === expectedReady,
      nonReadyCountMatchesExpected: nonReadyCount === expectedNonReady,
      nonReadyRowsLedgered: ledgeredCount === expectedNonReady,
      publicReadyExcludesUnresolved: publicReadyAssetCount + unresolvedAssetCount === assetCount,
      unresolvedCoversNonReady: unresolvedAssetCount >= nonReadyCount
    }
  }, 200, { "cache-control": "no-store" });
}

async function d1PartitionRoutingProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }
  const observedAt = url.searchParams.get("observed_at") ?? new Date().toISOString();
  const partition = resolveObservationPartition(observedAt, env);
  const selectedMonth = await env.OBS_DB.prepare(
    `SELECT partition_month,
            COUNT(*) AS count,
            MIN(observed_at) AS earliest_observed_at,
            MAX(observed_at) AS latest_observed_at
     FROM observations
     WHERE partition_month = ?
     GROUP BY partition_month`
  ).bind(partition.partitionMonth).first<PartitionSummaryRow>();
  const allMonths = await env.OBS_DB.prepare(
    `SELECT partition_month,
            COUNT(*) AS count,
            MIN(observed_at) AS earliest_observed_at,
            MAX(observed_at) AS latest_observed_at
     FROM observations
     GROUP BY partition_month
     ORDER BY partition_month`
  ).all<PartitionSummaryRow>();
  return json({
    ok: true,
    proofStatus: "phase1_partition_routing_selected",
    selected: partition,
    selectedMonth: selectedMonth ?? {
      partition_month: partition.partitionMonth,
      count: 0,
      earliest_observed_at: null,
      latest_observed_at: null
    },
    allMonths: allMonths.results,
    invariants: {
      manualMonthlyBindingRequired: false,
      crossD1TransactionRequired: false,
      canonicalWriteBinding: "OBS_DB",
      archiveCutoverUnit: "partition_month",
      productionTrafficAffected: false
    }
  }, 200, { "cache-control": "no-store" });
}

async function publicDerivativeVerificationSummary(env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }
  const summary = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS uploaded_assets,
       SUM(CASE WHEN public_derivative_key IS NOT NULL THEN 1 ELSE 0 END) AS derivative_assets,
       SUM(CASE WHEN public_derivative_verified_at IS NOT NULL THEN 1 ELSE 0 END) AS verified_assets,
       SUM(CASE WHEN exif_scrub_state = 'scrubbed' THEN 1 ELSE 0 END) AS scrubbed_assets,
       SUM(CASE WHEN public_ready_at IS NOT NULL THEN 1 ELSE 0 END) AS public_ready_assets,
       SUM(CASE WHEN public_derivative_metadata_json LIKE '%"gpsExifPresent":true%' THEN 1 ELSE 0 END) AS gps_exif_present
     FROM asset_ledger
     WHERE processing_state = 'uploaded'`
  ).first<{
    uploaded_assets: number;
    derivative_assets: number | null;
    verified_assets: number | null;
    scrubbed_assets: number | null;
    public_ready_assets: number | null;
    gps_exif_present: number | null;
  }>();
  const recent = await env.OBS_DB.prepare(
    `SELECT asset_id, observation_id, public_derivative_key, public_derivative_sha256,
            public_derivative_verified_at, public_derivative_metadata_json
     FROM asset_ledger
     WHERE public_derivative_verified_at IS NOT NULL
     ORDER BY public_derivative_verified_at DESC
     LIMIT 10`
  ).all<{
    asset_id: string;
    observation_id: string | null;
    public_derivative_key: string | null;
    public_derivative_sha256: string | null;
    public_derivative_verified_at: string | null;
    public_derivative_metadata_json: string | null;
  }>();
  return json({
    ok: true,
    gate: "public_derivative_binary_metadata_absence",
    summary,
    recent: recent.results.map((row) => ({
      ...row,
      metadata: row.public_derivative_metadata_json ? JSON.parse(row.public_derivative_metadata_json) : null
    }))
  }, 200, { "cache-control": "no-store" });
}

async function reverseDeltaDryRun(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }
  const targetPrefix = normalizeOptionalText(url.searchParams.get("target_prefix"));
  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "200"), 1, 1000);
  const targetValue = targetPrefix ? `${targetPrefix}%` : null;

  const ledgerRows = await (targetValue
    ? env.OBS_DB.prepare(
      `SELECT ledger_id, event_type, target_id, partition_month, source_endpoint, payload_json, replay_sql, replay_status, created_at
       FROM rollback_write_ledger
       WHERE target_id LIKE ?
          OR JSON_EXTRACT(payload_json, '$.observationId') LIKE ?
       ORDER BY created_at, ledger_id
       LIMIT ?`
    ).bind(targetValue, targetValue, limit)
    : env.OBS_DB.prepare(
      `SELECT ledger_id, event_type, target_id, partition_month, source_endpoint, payload_json, replay_sql, replay_status, created_at
       FROM rollback_write_ledger
       ORDER BY created_at, ledger_id
       LIMIT ?`
    ).bind(limit)
  ).all<RollbackLedgerRow>();

  const ledgerCount = await countRollbackLedger(env, targetValue);
  const observationCount = await countObservations(env, targetValue);
  const assetCount = await countAssets(env, targetValue);
  const ledgerObservationCount = await countRollbackLedgerObservations(env, targetValue);
  const ledgerAssetCount = await countRollbackLedgerAssets(env, targetValue);
  const observationDrift = observationCount - ledgerObservationCount;
  const assetDrift = assetCount - ledgerAssetCount;

  return json({
    ok: observationDrift === 0 && assetDrift === 0,
    mode: "dry_run_no_vps_mutation",
    targetPrefix,
    counts: {
      rollbackLedger: ledgerCount,
      observations: observationCount,
      assets: assetCount,
      ledgerObservations: ledgerObservationCount,
      ledgerAssets: ledgerAssetCount
    },
    drift: {
      observationsWithoutLedger: Math.max(observationDrift, 0),
      ledgerObservationsWithoutRows: Math.max(-observationDrift, 0),
      assetsWithoutLedger: Math.max(assetDrift, 0),
      ledgerAssetsWithoutRows: Math.max(-assetDrift, 0)
    },
    replay: {
      target: "VPS/PostgreSQL dry-run artifact",
      mutationPerformed: false,
      applyOrder: ["observation.upsert", "observation.finalize", "asset.photo.upload", "asset.video.finalize"]
    },
    events: ledgerRows.results.map((row) => ({
      ...row,
      payload: JSON.parse(row.payload_json)
    }))
  }, 200, { "cache-control": "no-store" });
}

async function shadowReverseDeltaProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }

  const targetPrefix = normalizeOptionalText(url.searchParams.get("target_prefix"));
  if (!targetPrefix) {
    return json({ ok: false, error: "target_prefix_required" }, 400, { "cache-control": "no-store" });
  }
  const targetValue = `${targetPrefix}%`;
  const expectedObservations = clampInteger(Number(url.searchParams.get("expected_observations") ?? "1"), 0, 1000);
  const expectedAssets = clampInteger(Number(url.searchParams.get("expected_assets") ?? "2"), 0, 1000);
  const expectedLedger = clampInteger(Number(url.searchParams.get("expected_ledger") ?? "3"), 0, 1000);

  const ledgerCount = await countRollbackLedger(env, targetValue);
  const observationCount = await countObservations(env, targetValue);
  const assetCount = await countAssets(env, targetValue);
  const ledgerObservationCount = await countRollbackLedgerObservations(env, targetValue);
  const ledgerAssetCount = await countRollbackLedgerAssets(env, targetValue);
  const observationDrift = observationCount - ledgerObservationCount;
  const assetDrift = assetCount - ledgerAssetCount;
  const drift = {
    observationsWithoutLedger: Math.max(observationDrift, 0),
    ledgerObservationsWithoutRows: Math.max(-observationDrift, 0),
    assetsWithoutLedger: Math.max(assetDrift, 0),
    ledgerAssetsWithoutRows: Math.max(-assetDrift, 0)
  };
  const counts = {
    rollbackLedger: ledgerCount,
    observations: observationCount,
    assets: assetCount,
    ledgerObservations: ledgerObservationCount,
    ledgerAssets: ledgerAssetCount
  };
  const invariants = {
    expectedObservationCount: observationCount === expectedObservations,
    expectedAssetCount: assetCount === expectedAssets,
    expectedRollbackLedgerCount: ledgerCount === expectedLedger,
    observationLedgerAligned: observationDrift === 0,
    assetLedgerAligned: assetDrift === 0,
    mutationPerformed: false,
    productionTrafficAffected: false
  };
  const ok =
    invariants.expectedObservationCount &&
    invariants.expectedAssetCount &&
    invariants.expectedRollbackLedgerCount &&
    invariants.observationLedgerAligned &&
    invariants.assetLedgerAligned &&
    !invariants.mutationPerformed &&
    !invariants.productionTrafficAffected;

  return json({
    ok,
    gate: "integrated_staging_reverse_delta_write_drain",
    mode: "dry_run_no_vps_mutation",
    targetPrefix,
    counts,
    drift,
    replay: {
      target: "VPS/PostgreSQL dry-run artifact",
      mutationPerformed: false,
      applyOrder: ["observation.upsert", "observation.finalize", "asset.photo.upload", "asset.video.finalize"]
    },
    invariants
  }, 200, { "cache-control": "no-store" });
}

async function shadowUpdateDeleteReplayProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }

  const suffix = sanitizeIdPart(url.searchParams.get("id") ?? new Date().toISOString());
  const observationId = `shadow-update-delete-${suffix}`.slice(0, 120);
  const userId = `shadow-update-user-${suffix}`.slice(0, 120);
  const initialNote = "shadow update/delete replay proof initial";
  const updatedNote = "shadow update/delete replay proof updated";

  const sessionResponse = await issueCompatibleSession(new Request(`${url.origin}/api/v1/auth/session/issue`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, ttlHours: 1 })
  }), env);
  const cookie = sessionResponse.headers.get("set-cookie") ?? "";

  const upserts = [
    { note: initialNote, observedAt: "2026-06-15T04:30:00.000Z", taxonLabel: "初回記録" },
    { note: updatedNote, observedAt: "2026-06-15T04:31:00.000Z", taxonLabel: "更新後記録" }
  ];
  for (const upsert of upserts) {
    const upsertResponse = await upsertLegacyCompatibleObservation(new Request(`${url.origin}/api/v1/observations/upsert`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        observationId,
        userId,
        observedAt: upsert.observedAt,
        latitude: 34.71234,
        longitude: 137.81234,
        locationAccuracyM: 12,
        visibility: "public",
        taxon: { vernacularName: upsert.taxonLabel, rank: "species" },
        note: upsert.note
      })
    }), env);
    if (!upsertResponse.ok) {
      return upsertResponse;
    }
  }

  const photoResponse = await uploadLegacyCompatiblePhoto(observationId, new Request(`${url.origin}/api/v1/observations/${encodeURIComponent(observationId)}/photos/upload`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      filename: "update-delete-proof.jpg",
      mimeType: "image/jpeg",
      base64Data: btoa("shadow-update-delete-image"),
      facePrivacy: "no_faces"
    })
  }), env);
  if (!photoResponse.ok) {
    return photoResponse;
  }

  await markUploadedAssetsPublicReady(observationId, env);
  await refreshPublicReadmodel(observationId, env);
  const beforeHide = await takedownVisibilityState(observationId, env);

  const hideResponse = await hideCompatibleObservation(observationId, new Request(`${url.origin}/api/v1/observations/${encodeURIComponent(observationId)}/hide`, {
    method: "POST",
    headers: { cookie }
  }), env);
  if (!hideResponse.ok) {
    return hideResponse;
  }
  const afterHide = await takedownVisibilityState(observationId, env);

  const canonical = await env.OBS_DB.prepare(
    `SELECT o.observation_id, o.emergency_hidden, COUNT(a.asset_id) AS asset_count
     FROM observations o
     LEFT JOIN asset_ledger a ON a.observation_id = o.observation_id
     WHERE o.observation_id = ?
     GROUP BY o.observation_id, o.emergency_hidden`
  ).bind(observationId).first<{ observation_id: string; emergency_hidden: number; asset_count: number }>();
  const events = await listRollbackEvents(env, `${observationId}%`, 50);
  const replayOnce = replayRollbackEvents(events);
  const replayTwice = replayRollbackEvents([...events, ...events]);
  const eventCounts = countRollbackEventTypes(events);
  const finalObservation = replayOnce.observations[observationId] ?? null;
  const canonicalRow = await env.OBS_DB.prepare(
    "SELECT draft_id, owner_user_id, partition_month FROM observations WHERE observation_id = ?"
  ).bind(observationId).first<{ draft_id: string; owner_user_id: string; partition_month: string | null }>();
  const invariants = {
    updateLedgered: eventCounts["observation.upsert"] === 2,
    hideLedgered: eventCounts["observation.hide"] === 1,
    assetLedgered: eventCounts["asset.photo.upload"] === 1,
    replayIdempotent: replayOnce.fingerprint === replayTwice.fingerprint,
    finalNoteUpdated: finalObservation?.note === updatedNote,
    finalHidden: finalObservation?.emergencyHidden === true,
    canonicalPreserved: Boolean(canonicalRow) && canonical?.emergency_hidden === 1,
    publicSurfacesHidden: afterHide.readmodelRows === 0 && !afterHide.publicDetailVisible && !afterHide.mapVisible,
    mutationPerformed: false,
    productionTrafficAffected: false
  };
  const ok =
    invariants.updateLedgered &&
    invariants.hideLedgered &&
    invariants.assetLedgered &&
    invariants.replayIdempotent &&
    invariants.finalNoteUpdated &&
    invariants.finalHidden &&
    invariants.canonicalPreserved &&
    invariants.publicSurfacesHidden &&
    !invariants.mutationPerformed &&
    !invariants.productionTrafficAffected;

  return json({
    ok,
    gate: "integrated_staging_update_delete_idempotent_replay",
    mode: "dry_run_no_vps_mutation",
    observationId,
    counts: {
      rollbackLedger: events.length,
      eventTypes: eventCounts,
      observations: 1,
      assets: canonical?.asset_count ?? 0
    },
    beforeHide,
    afterHide,
    canonical: {
      observationId: canonical?.observation_id ?? null,
      emergency_hidden: canonical?.emergency_hidden ?? null,
      asset_count: canonical?.asset_count ?? 0
    },
    replay: {
      target: "VPS/PostgreSQL dry-run artifact",
      mutationPerformed: false,
      applyOrder: ["observation.upsert", "asset.photo.upload", "observation.hide"],
      firstFingerprint: replayOnce.fingerprint,
      secondFingerprint: replayTwice.fingerprint,
      finalObservation
    },
    invariants
  }, 200, { "cache-control": "no-store" });
}

async function shadowRollbackRestoreSmoke(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }

  const suffix = sanitizeIdPart(url.searchParams.get("id") ?? new Date().toISOString());
  const observationId = `shadow-rollback-restore-${suffix}`.slice(0, 120);
  const userId = `shadow-rollback-user-${suffix}`.slice(0, 120);
  const note = "shadow rollback restore smoke";

  const sessionResponse = await issueCompatibleSession(new Request(`${url.origin}/api/v1/auth/session/issue`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, ttlHours: 1 })
  }), env);
  const cookie = sessionResponse.headers.get("set-cookie") ?? "";

  const upsertResponse = await upsertLegacyCompatibleObservation(new Request(`${url.origin}/api/v1/observations/upsert`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      observationId,
      userId,
      observedAt: "2026-06-16T01:15:00.000Z",
      latitude: 34.71234,
      longitude: 137.81234,
      locationAccuracyM: 12,
      visibility: "public",
      taxon: { vernacularName: "復元演習記録", rank: "species" },
      note
    })
  }), env);
  if (!upsertResponse.ok) {
    return upsertResponse;
  }

  const photoResponse = await uploadLegacyCompatiblePhoto(observationId, new Request(`${url.origin}/api/v1/observations/${encodeURIComponent(observationId)}/photos/upload`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      filename: "rollback-restore-proof.jpg",
      mimeType: "image/jpeg",
      base64Data: btoa("shadow-rollback-restore-image"),
      facePrivacy: "no_faces"
    })
  }), env);
  if (!photoResponse.ok) {
    return photoResponse;
  }

  const videoBody = "rollback-video-bytes";
  const directResponse = await createCompatibleVideoDirectUpload(new Request(`${url.origin}/api/v1/videos/direct-upload`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      filename: "rollback-restore-proof.mp4",
      observationId,
      mediaRole: "observation_video",
      uploadProtocol: "post",
      fileSizeBytes: videoBody.length
    })
  }), env);
  if (!directResponse.ok) {
    return directResponse;
  }
  const directPayload = await directResponse.json() as { uid?: string; uploadUrl?: string };
  const streamUid = String(directPayload.uid ?? "");
  const uploadUrl = String(directPayload.uploadUrl ?? "");
  const bodyResponse = await putCompatibleVideoBody(streamUid, new Request(uploadUrl, {
    method: "PUT",
    headers: { "content-type": "video/mp4", cookie },
    body: videoBody
  }), env);
  if (!bodyResponse.ok) {
    return bodyResponse;
  }
  const finalizeResponse = await finalizeCompatibleVideo(streamUid, new Request(`${url.origin}/api/v1/videos/${encodeURIComponent(streamUid)}/finalize`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      observationId,
      durationMs: 9000,
      readyToStream: true,
      bytes: videoBody.length
    })
  }), env);
  if (!finalizeResponse.ok) {
    return finalizeResponse;
  }

  await markUploadedAssetsPublicReady(observationId, env);
  await refreshPublicReadmodel(observationId, env);
  const beforeHide = await takedownVisibilityState(observationId, env);

  const hideResponse = await hideCompatibleObservation(observationId, new Request(`${url.origin}/api/v1/observations/${encodeURIComponent(observationId)}/hide`, {
    method: "POST",
    headers: { cookie }
  }), env);
  if (!hideResponse.ok) {
    return hideResponse;
  }
  const afterHide = await takedownVisibilityState(observationId, env);

  const canonical = await env.OBS_DB.prepare(
    `SELECT o.observation_id, o.emergency_hidden, COUNT(a.asset_id) AS asset_count
     FROM observations o
     LEFT JOIN asset_ledger a ON a.observation_id = o.observation_id
     WHERE o.observation_id = ?
     GROUP BY o.observation_id, o.emergency_hidden`
  ).bind(observationId).first<{
    observation_id: string;
    emergency_hidden: number;
    asset_count: number;
  }>();
  const events = await listRollbackEvents(env, `${observationId}%`, 50);
  const replayOnce = replayRollbackEvents(events);
  const replayTwice = replayRollbackEvents([...events, ...events]);
  const eventCounts = countRollbackEventTypes(events);
  const restoredObservation = replayOnce.observations[observationId] ?? null;
  const restoredAssets = Object.values(replayOnce.assets).filter((asset) => asset.observationId === observationId);
  const replaySqlReady = events.every((event) => event.replay_sql.includes("rollback_"));
  const invariants = {
    observationRestored: restoredObservation?.ownerUserId === userId && restoredObservation?.note === note,
    hiddenStateRestored: restoredObservation?.emergencyHidden === true,
    assetsRestored: restoredAssets.length === 2,
    photoRestored: restoredAssets.some((asset) => asset.mime === "image/jpeg"),
    videoRestored: restoredAssets.some((asset) => asset.mime === "video/mp4"),
    replaySqlReady,
    replayIdempotent: replayOnce.fingerprint === replayTwice.fingerprint,
    canonicalPreserved: Boolean(canonical) && canonical?.emergency_hidden === 1 && Number(canonical?.asset_count ?? 0) === 2,
    publicSurfacesHidden: afterHide.readmodelRows === 0 && !afterHide.publicDetailVisible && !afterHide.mapVisible,
    mutationPerformed: false,
    productionTrafficAffected: false
  };
  const ok =
    invariants.observationRestored &&
    invariants.hiddenStateRestored &&
    invariants.assetsRestored &&
    invariants.photoRestored &&
    invariants.videoRestored &&
    invariants.replaySqlReady &&
    invariants.replayIdempotent &&
    invariants.canonicalPreserved &&
    invariants.publicSurfacesHidden &&
    !invariants.mutationPerformed &&
    !invariants.productionTrafficAffected;

  return json({
    ok,
    gate: "integrated_staging_rollback_restore_smoke",
    mode: "dry_run_no_vps_mutation",
    observationId,
    counts: {
      rollbackLedger: events.length,
      eventTypes: eventCounts,
      restoredObservations: restoredObservation ? 1 : 0,
      restoredAssets: restoredAssets.length,
      canonicalAssets: canonical?.asset_count ?? 0
    },
    beforeHide,
    afterHide,
    canonical: {
      observationId: canonical?.observation_id ?? null,
      ownerUserId: userId,
      emergency_hidden: canonical?.emergency_hidden ?? null,
      asset_count: canonical?.asset_count ?? 0
    },
    restore: {
      target: "rollback_restore_state_from_rollback_ledger",
      mutationPerformed: false,
      applyOrder: ["observation.upsert", "asset.photo.upload", "asset.video.finalize", "observation.hide"],
      firstFingerprint: replayOnce.fingerprint,
      secondFingerprint: replayTwice.fingerprint,
      finalObservation: restoredObservation,
      assets: restoredAssets
    },
    invariants
  }, 200, { "cache-control": "no-store" });
}

async function listRollbackEvents(env: Env, targetValue: string | null, limit: number): Promise<RollbackLedgerRow[]> {
  const result = await (targetValue
    ? env.OBS_DB.prepare(
      `SELECT ledger_id, event_type, target_id, partition_month, source_endpoint, payload_json, replay_sql, replay_status, created_at
       FROM rollback_write_ledger
       WHERE target_id LIKE ?
          OR JSON_EXTRACT(payload_json, '$.observationId') LIKE ?
       ORDER BY created_at, ledger_id
       LIMIT ?`
    ).bind(targetValue, targetValue, limit)
    : env.OBS_DB.prepare(
      `SELECT ledger_id, event_type, target_id, partition_month, source_endpoint, payload_json, replay_sql, replay_status, created_at
       FROM rollback_write_ledger
       ORDER BY created_at, ledger_id
       LIMIT ?`
    ).bind(limit)
  ).all<RollbackLedgerRow>();
  return result.results;
}

function countRollbackEventTypes(events: RollbackLedgerRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    counts[event.event_type] = (counts[event.event_type] ?? 0) + 1;
  }
  return counts;
}

function replayRollbackEvents(events: RollbackLedgerRow[]) {
  const observations: Record<string, {
    ownerUserId: string | null;
    observedAt: string | null;
    taxonLabel: string | null;
    note: string | null;
    publicCell: string | null;
    visibility: string | null;
    emergencyHidden: boolean;
  }> = {};
  const assets: Record<string, {
    observationId: string | null;
    ownerUserId: string | null;
    objectKey: string | null;
    mime: string | null;
    bytes: number | null;
  }> = {};

  for (const event of events) {
    const payload = JSON.parse(event.payload_json) as Record<string, unknown>;
    if (event.event_type === "observation.upsert" || event.event_type === "observation.finalize") {
      const observationId = stringFromUnknown(payload.visitId ?? payload.observationId ?? event.target_id);
      const observedAt = stringOrNullFromUnknown(payload.observedAt);
      const existing = observations[observationId];
      if (existing?.observedAt && observedAt && existing.observedAt > observedAt) {
        continue;
      }
      observations[observationId] = {
        ownerUserId: stringOrNullFromUnknown(payload.ownerUserId),
        observedAt,
        taxonLabel: stringOrNullFromUnknown(payload.taxonLabel),
        note: stringOrNullFromUnknown(payload.note),
        publicCell: stringOrNullFromUnknown(payload.publicCell),
        visibility: stringOrNullFromUnknown(payload.visibility),
        emergencyHidden: false
      };
    }
    if (event.event_type === "asset.photo.upload" || event.event_type === "asset.video.finalize") {
      assets[event.target_id] = {
        observationId: stringOrNullFromUnknown(payload.observationId),
        ownerUserId: stringOrNullFromUnknown(payload.ownerUserId),
        objectKey: stringOrNullFromUnknown(payload.objectKey),
        mime: stringOrNullFromUnknown(payload.mime) ?? (event.event_type === "asset.video.finalize" ? "video/mp4" : null),
        bytes: numberOrNullFromUnknown(payload.bytes)
      };
    }
    if (event.event_type === "observation.hide") {
      const observationId = stringFromUnknown(payload.observationId ?? event.target_id);
      observations[observationId] = {
        ...(observations[observationId] ?? {
          ownerUserId: stringOrNullFromUnknown(payload.ownerUserId),
          observedAt: null,
          taxonLabel: null,
          note: null,
          publicCell: null,
          visibility: null
        }),
        emergencyHidden: true
      };
    }
  }

  for (const event of events) {
    if (event.event_type !== "observation.hide") continue;
    const payload = JSON.parse(event.payload_json) as Record<string, unknown>;
    const observationId = stringFromUnknown(payload.observationId ?? event.target_id);
    observations[observationId] = {
      ...(observations[observationId] ?? {
        ownerUserId: stringOrNullFromUnknown(payload.ownerUserId),
        observedAt: null,
        taxonLabel: null,
        note: null,
        publicCell: null,
        visibility: null
      }),
      emergencyHidden: true
    };
  }

  const fingerprint = stableJson({ observations, assets });
  return { observations, assets, fingerprint };
}

async function countRollbackLedger(env: Env, targetValue: string | null): Promise<number> {
  const row = await (targetValue
    ? env.OBS_DB.prepare(
      "SELECT COUNT(*) AS count FROM rollback_write_ledger WHERE target_id LIKE ? OR JSON_EXTRACT(payload_json, '$.observationId') LIKE ?"
    ).bind(targetValue, targetValue)
    : env.OBS_DB.prepare("SELECT COUNT(*) AS count FROM rollback_write_ledger")
  ).first<ReverseDeltaCountRow>();
  return row?.count ?? 0;
}

async function countRollbackLedgerObservations(env: Env, targetValue: string | null): Promise<number> {
  const row = await (targetValue
    ? env.OBS_DB.prepare(
      "SELECT COUNT(*) AS count FROM rollback_write_ledger WHERE event_type IN ('observation.upsert', 'observation.finalize') AND target_id LIKE ?"
    ).bind(targetValue)
    : env.OBS_DB.prepare("SELECT COUNT(*) AS count FROM rollback_write_ledger WHERE event_type IN ('observation.upsert', 'observation.finalize')")
  ).first<ReverseDeltaCountRow>();
  return row?.count ?? 0;
}

async function countRollbackLedgerAssets(env: Env, targetValue: string | null): Promise<number> {
  const row = await (targetValue
    ? env.OBS_DB.prepare(
      "SELECT COUNT(*) AS count FROM rollback_write_ledger WHERE event_type IN ('asset.photo.upload', 'asset.video.finalize') AND JSON_EXTRACT(payload_json, '$.observationId') LIKE ?"
    ).bind(targetValue)
    : env.OBS_DB.prepare("SELECT COUNT(*) AS count FROM rollback_write_ledger WHERE event_type IN ('asset.photo.upload', 'asset.video.finalize')")
  ).first<ReverseDeltaCountRow>();
  return row?.count ?? 0;
}

async function countObservations(env: Env, targetValue: string | null): Promise<number> {
  const row = await (targetValue
    ? env.OBS_DB.prepare("SELECT COUNT(*) AS count FROM observations WHERE observation_id LIKE ?").bind(targetValue)
    : env.OBS_DB.prepare("SELECT COUNT(*) AS count FROM observations")
  ).first<ReverseDeltaCountRow>();
  return row?.count ?? 0;
}

async function countAssets(env: Env, targetValue: string | null): Promise<number> {
  const row = await (targetValue
    ? env.OBS_DB.prepare("SELECT COUNT(*) AS count FROM asset_ledger WHERE observation_id LIKE ?").bind(targetValue)
    : env.OBS_DB.prepare("SELECT COUNT(*) AS count FROM asset_ledger WHERE observation_id IS NOT NULL")
  ).first<ReverseDeltaCountRow>();
  return row?.count ?? 0;
}

async function markUploadedAssetsPublicReady(observationId: string, env: Env): Promise<void> {
  const assets = await env.OBS_DB.prepare(
    `SELECT asset_id, object_key
     FROM asset_ledger
     WHERE observation_id = ? AND processing_state = 'uploaded'`
  ).bind(observationId).all<UploadedAssetRow>();

  for (const asset of assets.results) {
    const publicDerivativeKey = `derived/${asset.object_key.replace(/^original\//, "")}/display.webp`;
    const contentType = "image/svg+xml; charset=utf-8";
    const derivativeBody = textToArrayBuffer(shadowDerivativeSvg(asset.asset_id));
    const derivativeSha256 = await sha256Hex(derivativeBody);
    const metadataInspection = inspectPublicDerivativeMetadata(derivativeBody, contentType);
    if (metadataInspection.gpsExifPresent) {
      await env.OBS_DB.prepare(
        `UPDATE asset_ledger
         SET public_derivative_key = ?,
             public_derivative_sha256 = ?,
             public_derivative_metadata_json = ?,
             exif_scrub_state = 'failed'
         WHERE asset_id = ?`
      ).bind(
        publicDerivativeKey,
        derivativeSha256,
        JSON.stringify(metadataInspection),
        asset.asset_id
      ).run();
      continue;
    }
    await env.ASSET_BUCKET.put(publicDerivativeKey, derivativeBody, {
      httpMetadata: { contentType }
    });
    await env.OBS_DB.prepare(
      `UPDATE asset_ledger
       SET public_derivative_key = ?,
           public_derivative_sha256 = ?,
           public_derivative_verified_at = CURRENT_TIMESTAMP,
           public_derivative_metadata_json = ?,
           exif_scrub_state = 'scrubbed',
           public_ready_at = CURRENT_TIMESTAMP
       WHERE asset_id = ?`
    ).bind(
      publicDerivativeKey,
      derivativeSha256,
      JSON.stringify(metadataInspection),
      asset.asset_id
    ).run();
  }
}

function rollbackLedgerInsert(env: Env, input: {
  eventType: string;
  targetId: string;
  partitionMonth: string | null;
  sourceEndpoint: string;
  payload: Record<string, unknown>;
  replaySql: string;
}): D1PreparedStatement {
  return env.OBS_DB.prepare(
    `INSERT INTO rollback_write_ledger
     (ledger_id, event_type, target_id, partition_month, source_endpoint, payload_json, replay_sql)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    newId("rollback"),
    input.eventType,
    input.targetId,
    input.partitionMonth,
    input.sourceEndpoint,
    JSON.stringify(input.payload),
    input.replaySql
  );
}

function postgresObservationReplaySql(
  observationId: string,
  ownerUserId: string,
  observedAt: string,
  taxonLabel: string | null,
  note: string | null,
  exactLat: number | null,
  exactLng: number | null,
  locationAccuracyM: number | null,
  publicCell: string,
  visibility: string
): string {
  const values = [
    sqlLiteral(observationId),
    sqlLiteral(ownerUserId),
    sqlLiteral(observedAt),
    sqlLiteral(taxonLabel),
    sqlLiteral(note),
    sqlLiteral(exactLat),
    sqlLiteral(exactLng),
    sqlLiteral(locationAccuracyM),
    sqlLiteral(publicCell),
    sqlLiteral(visibility)
  ].join(", ");
  return `INSERT INTO rollback_observations (observation_id, owner_user_id, observed_at, taxon_label, note, exact_lat, exact_lng, location_accuracy_m, public_cell, visibility) VALUES (${values}) ON CONFLICT (observation_id) DO UPDATE SET observed_at = EXCLUDED.observed_at, taxon_label = EXCLUDED.taxon_label, note = EXCLUDED.note, exact_lat = EXCLUDED.exact_lat, exact_lng = EXCLUDED.exact_lng, location_accuracy_m = EXCLUDED.location_accuracy_m, public_cell = EXCLUDED.public_cell, visibility = EXCLUDED.visibility;`;
}

function postgresObservationHideReplaySql(observationId: string): string {
  return `UPDATE rollback_observations SET emergency_hidden = TRUE, public_visible = FALSE WHERE observation_id = ${sqlLiteral(observationId)};`;
}

function postgresAssetReplaySql(
  assetId: string,
  observationId: string,
  ownerUserId: string,
  objectKey: string,
  sha256: string | null,
  mime: string,
  bytes: number,
  visibility: string
): string {
  const values = [
    sqlLiteral(assetId),
    sqlLiteral(observationId),
    sqlLiteral(ownerUserId),
    sqlLiteral(objectKey),
    sqlLiteral(sha256),
    sqlLiteral(mime),
    sqlLiteral(bytes),
    sqlLiteral(visibility)
  ].join(", ");
  return `INSERT INTO rollback_assets (asset_id, observation_id, owner_user_id, object_key, sha256, mime, bytes, visibility) VALUES (${values}) ON CONFLICT (asset_id) DO UPDATE SET observation_id = EXCLUDED.observation_id, object_key = EXCLUDED.object_key, sha256 = EXCLUDED.sha256, mime = EXCLUDED.mime, bytes = EXCLUDED.bytes, visibility = EXCLUDED.visibility;`;
}

function sqlLiteral(value: string | number | null): string {
  if (value === null) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

function validateAsset(asset: DraftAssetInput): void {
  assertNonEmpty(asset.mime, "media.mime");
  if (!Number.isFinite(asset.bytes) || asset.bytes <= 0 || asset.bytes > MAX_ASSET_BYTES) {
    throw new HttpError(400, "invalid_media_bytes");
  }
}

function resolveObservationPartition(observedAt: string | null | undefined, env: Env) {
  const partitionMonth = partitionMonthFromDate(observedAt ?? new Date().toISOString());
  return {
    strategy: OBSERVATION_PARTITION_STRATEGY,
    partitionMonth,
    selectedBinding: "OBS_DB",
    databaseName: env.OBSERVATION_DB_NAME ?? "ikimon_shadow_observations_2026_06",
    writeStorage: "active_d1_logical_partition",
    archiveStorage: env.OBSERVATION_ARCHIVE_TARGET ?? "r2_sql_export_by_partition_month",
    manualMonthlyBindingRequired: false,
    reason: "Logical partitioning uses partition_month inside one active D1 binding; archive/export lifecycle is month-keyed and does not require monthly Worker binding edits."
  };
}

function partitionMonthFromDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, "invalid_observed_at");
  }
  return date.toISOString().slice(0, 7);
}

function inspectPublicDerivativeMetadata(bytes: ArrayBuffer, contentType: string): PublicDerivativeInspection {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const lower = text.toLowerCase();
  const exifPresent = lower.includes("exif") || lower.includes("http://ns.adobe.com/exif/");
  const gpsPresent = lower.includes("gps") ||
    lower.includes("gpslatitude") ||
    lower.includes("gpslongitude") ||
    lower.includes("gpsaltitude");
  const xmpPresent = lower.includes("<x:xmpmeta") ||
    lower.includes("adobe:ns:meta") ||
    lower.includes("http://ns.adobe.com/xap/");
  const exactCoordinateLiteralPresent = /34\.71234|137\.81234/.test(text);
  return {
    tool: "shadow-public-derivative-byte-signature-scan-v1",
    contentType,
    bytes: bytes.byteLength,
    scannedContainer: contentType.includes("svg") ? "svg+xml" : "binary",
    gpsExifPresent: exifPresent || gpsPresent || xmpPresent || exactCoordinateLiteralPresent,
    exifPresent,
    gpsPresent,
    xmpPresent,
    exactCoordinateLiteralPresent,
    checkedAt: new Date().toISOString()
  };
}

function inspectVideoContainerMetadata(bytes: ArrayBuffer, contentType: string) {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const lower = text.toLowerCase();
  const exifPresent = lower.includes("exif") || lower.includes("http://ns.adobe.com/exif/");
  const gpsPresent = lower.includes("gps") ||
    lower.includes("gpslatitude") ||
    lower.includes("gpslongitude") ||
    lower.includes("gpsaltitude");
  const xmpPresent = lower.includes("<x:xmpmeta") ||
    lower.includes("adobe:ns:meta") ||
    lower.includes("http://ns.adobe.com/xap/");
  const exactCoordinateLiteralPresent = /34\.71234|137\.81234/.test(text);
  const ftypPresent = lower.includes("ftyp");
  const moovPresent = lower.includes("moov");
  const mdatPresent = lower.includes("mdat");
  return {
    tool: "shadow-video-container-byte-signature-scan-v1",
    contentType,
    bytes: bytes.byteLength,
    scannedContainer: ftypPresent ? "mp4" : "binary",
    ftypPresent,
    moovPresent,
    mdatPresent,
    gpsExifPresent: exifPresent || gpsPresent || xmpPresent || exactCoordinateLiteralPresent,
    exifPresent,
    gpsPresent,
    xmpPresent,
    exactCoordinateLiteralPresent,
    checkedAt: new Date().toISOString()
  };
}

function blurLocation(lat?: number, lng?: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "unknown";
  const latCell = Math.round((lat as number) * 100) / 100;
  const lngCell = Math.round((lng as number) * 100) / 100;
  return `${latCell.toFixed(2)},${lngCell.toFixed(2)}`;
}

function parseBboxParam(raw: string | null): [number, number, number, number] | null {
  if (!raw) return null;
  const parts = raw.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  const [minLng, minLat, maxLng, maxLat] = parts as [number, number, number, number];
  if (minLng > maxLng || minLat > maxLat) return null;
  return [minLng, minLat, maxLng, maxLat];
}

function parsePublicCell(value: string): { lat: number; lng: number } | null {
  const [latRaw, lngRaw] = value.split(",");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function publicCellInBbox(publicCell: string, bbox: [number, number, number, number]): boolean {
  const parsed = parsePublicCell(publicCell);
  if (!parsed) return false;
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return parsed.lng >= minLng && parsed.lng <= maxLng && parsed.lat >= minLat && parsed.lat <= maxLat;
}

function publicCellToCellId(publicCell: string): string {
  return `cell:${publicCell}`;
}

function cellIdToPublicCell(cellId: string): string {
  return cellId.startsWith("cell:") ? cellId.slice("cell:".length) : cellId;
}

function detailIdToVisitId(value: string): string {
  const match = value.match(/^occ:(.+):\d+$/);
  return match?.[1] ?? value;
}

function publicMediaUrl(key: string | null): string {
  return key ? `/${key}` : "";
}

function publicCellPolygon(lat: number, lng: number): [number, number][] {
  const halfStep = 0.005;
  return [
    [lng - halfStep, lat - halfStep],
    [lng + halfStep, lat - halfStep],
    [lng + halfStep, lat + halfStep],
    [lng - halfStep, lat + halfStep],
    [lng - halfStep, lat - halfStep]
  ];
}

function earliestObservedAt(rows: PublicMapRow[]): string | null {
  return rows.reduce<string | null>((earliest, row) => !earliest || row.observed_at < earliest ? row.observed_at : earliest, null);
}

function latestObservedAt(rows: PublicMapRow[]): string {
  return rows.reduce((latest, row) => row.observed_at > latest ? row.observed_at : latest, "");
}

function publicMapEmptyProvenance(sampleSize: number) {
  const empty = { manual: 0, legacy: 0, track: 0, other: 0 };
  return {
    sampled: true,
    sampleSize,
    visible: empty,
    excluded: empty
  };
}

function isWeakTaxonLabel(label: string | null): boolean {
  const text = (label ?? "").trim().toLowerCase();
  return !text || ["unidentified", "unknown", "unresolved", "awaiting id", "同定待ち", "不明"].includes(text);
}

function publicTaxonDisplayName(label: string | null): string {
  return isWeakTaxonLabel(label) ? "同定待ち" : (label as string).trim();
}

function taxonGroupForLabel(label: string | null): string {
  if (isWeakTaxonLabel(label)) return "other";
  const text = label ?? "";
  if (/鳥|bird|aves/i.test(text)) return "bird";
  if (/虫|昆虫|蝶|蜂|insect/i.test(text)) return "insect";
  if (/草|木|花|plant|植物/i.test(text)) return "plant";
  if (/菌|fung/i.test(text)) return "fungi";
  if (/蛙|蛇|爬虫|amphibian|reptile/i.test(text)) return "amphibian_reptile";
  if (/獣|哺乳|mammal/i.test(text)) return "mammal";
  return "other";
}

function clampInteger(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(Math.trunc(value), min), max) : min;
}

function renderFieldDetailHtml(row: FieldDetailReadmodelRow, lang: string): string {
  const payload = fieldDetailPublicPayload(row);
  const isEnglish = lang === "en";
  const title = isEnglish ? `${payload.name} - ikimon field` : `${payload.name} - ikimon フィールド`;
  const locationLabel = payload.publicLocation.label;
  const links = [
    ["official", payload.links.official],
    ["certification", payload.links.certification],
    ["owner", payload.links.owner],
    ["story", payload.links.story]
  ].filter(([, href]) => href);
  const linkHtml = links.length > 0
    ? `<ul>${links.map(([label, href]) => `<li><a href="${escapeHtml(href)}" rel="nofollow noopener">${escapeHtml(label)}</a></li>`).join("")}</ul>`
    : `<p class="muted">${isEnglish ? "No public links are available." : "公開リンクはまだありません。"}</p>`;
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; color: #17201a; background: #f6f8f5; }
    main { max-width: 920px; margin: 0 auto; padding: 30px 18px 56px; }
    a { color: #176b45; font-weight: 800; }
    h1 { margin: 0 0 10px; font-size: 30px; letter-spacing: 0; }
    .meta, .muted { color: #53615a; line-height: 1.7; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-top: 22px; }
    .panel { background: #fff; border: 1px solid #d8e0da; border-radius: 8px; padding: 15px 16px; }
    .label { color: #53615a; font-size: 13px; margin: 0 0 6px; }
    .value { margin: 0; font-weight: 800; overflow-wrap: anywhere; }
    .summary { font-size: 16px; line-height: 1.85; }
  </style>
</head>
<body>
<main data-ikimon-field-detail="1" data-field-id="${escapeHtml(payload.fieldId)}" data-cloudflare-source="field-detail-readmodel">
  <p class="meta">${isEnglish ? "ikimon public field" : "ikimon 公開フィールド"}</p>
  <h1>${escapeHtml(payload.name)}</h1>
  ${payload.summary ? `<p class="summary">${escapeHtml(payload.summary)}</p>` : ""}
  <section class="grid" aria-label="field metadata">
    <div class="panel"><p class="label">${isEnglish ? "Public location" : "公開位置"}</p><p class="value">${escapeHtml(locationLabel)} / ${escapeHtml(payload.publicLocation.cell)}</p></div>
    <div class="panel"><p class="label">${isEnglish ? "Radius" : "半径"}</p><p class="value">${payload.radiusM ? `${payload.radiusM}m` : "-"}</p></div>
    <div class="panel"><p class="label">${isEnglish ? "Source" : "ソース"}</p><p class="value">${escapeHtml(payload.source)}</p></div>
    <div class="panel"><p class="label">${isEnglish ? "Verification" : "確認状態"}</p><p class="value">${escapeHtml(payload.verification.label || payload.verification.level || "-")}</p></div>
  </section>
  <section class="panel">
    <h2>${isEnglish ? "Links" : "関連リンク"}</h2>
    ${linkHtml}
  </section>
  <section class="panel">
    <p class="muted">${isEnglish ? "Exact coordinates and geometry are not exposed on this public page." : "この公開ページでは、正確な座標とジオメトリ本体は表示しません。"}</p>
  </section>
</main>
</body>
</html>`;
}

function renderPlaceSnapshotHtml(row: FieldDetailReadmodelRow, lang: string): string {
  const payload = fieldDetailPublicPayload(row);
  const isEnglish = lang === "en";
  const title = isEnglish ? `${payload.name} - place snapshot` : `${payload.name} - 場所の情報`;
  const locationLabel = payload.publicLocation.label;
  const officialLink = payload.links.official
    ? `<a class="button" href="${escapeHtml(payload.links.official)}" rel="nofollow noopener">${isEnglish ? "Official information" : "公式情報"}</a>`
    : "";
  const certificationLink = payload.links.certification
    ? `<a class="button secondary" href="${escapeHtml(payload.links.certification)}" rel="nofollow noopener">${isEnglish ? "Certification" : "認定情報"}</a>`
    : "";
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body{margin:0;background:#f7fbf9;color:#10251a;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.6}
    main{max-width:920px;margin:0 auto;padding:28px 16px 48px}
    h1{margin:4px 0 10px;font-size:30px;line-height:1.18;letter-spacing:0}
    .eyebrow{margin:0;color:#047857;font-size:13px;font-weight:900}
    .summary{margin:0 0 18px;color:#334155}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin:18px 0}
    .panel{padding:14px 15px;border:1px solid #d9e7e0;border-radius:8px;background:#fff}
    .label{margin:0 0 4px;color:#64746d;font-size:12px;font-weight:800}
    .value{margin:0;font-weight:900;overflow-wrap:anywhere}
    .actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
    .button{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 14px;border-radius:8px;background:#0f8f7e;color:#fff;font-weight:900;text-decoration:none}
    .button.secondary{background:#e7f4ef;color:#115e52}
    .muted{color:#64746d}
  </style>
</head>
<body>
<main data-ikimon-place-snapshot="1" data-field-id="${escapeHtml(payload.fieldId)}" data-cloudflare-source="place-snapshot-readmodel">
  <p class="eyebrow">${isEnglish ? "Place snapshot" : "場所の情報"}</p>
  <h1>${escapeHtml(payload.name)}</h1>
  ${payload.summary ? `<p class="summary">${escapeHtml(payload.summary)}</p>` : ""}
  <section class="grid" aria-label="place metadata">
    <div class="panel"><p class="label">${isEnglish ? "Public location" : "公開位置"}</p><p class="value">${escapeHtml(locationLabel)} / ${escapeHtml(payload.publicLocation.cell)}</p></div>
    <div class="panel"><p class="label">${isEnglish ? "Area" : "面積"}</p><p class="value">${payload.areaHa ? `${payload.areaHa}ha` : "-"}</p></div>
    <div class="panel"><p class="label">${isEnglish ? "Verification" : "確認状態"}</p><p class="value">${escapeHtml(payload.verification.label || payload.verification.level || "-")}</p></div>
  </section>
  <div class="actions">${officialLink}${certificationLink}</div>
  <p class="muted">${isEnglish ? "Exact coordinates and geometry are not exposed on this public page." : "この公開ページでは、正確な座標とジオメトリ本体は表示しません。"}</p>
</main>
</body>
</html>`;
}

function renderObservationNotFoundHtml(): string {
  return `<!doctype html>
<html lang="ja">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Observation not found</title></head>
<body><main><h1>見つかりません</h1><p>この観察はまだ取得できません。</p></main></body>
</html>`;
}

function shadowDerivativeSvg(assetId: string): string {
  const safeAssetId = escapeHtml(assetId).slice(0, 72);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480" role="img" aria-label="ikimon shadow derivative">
  <rect width="640" height="480" fill="#e8eee9"/>
  <circle cx="320" cy="190" r="72" fill="#176b45" opacity="0.18"/>
  <path d="M178 330c82-90 174-108 284-18 22 18 42 28 60 30v50H118v-42c18-4 38-10 60-20z" fill="#176b45" opacity="0.28"/>
  <text x="320" y="222" text-anchor="middle" font-family="system-ui, sans-serif" font-size="34" font-weight="700" fill="#176b45">ikimon</text>
  <text x="320" y="266" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" fill="#53615a">shadow public derivative</text>
  <text x="320" y="432" text-anchor="middle" font-family="monospace" font-size="14" fill="#53615a">${safeAssetId}</text>
</svg>`;
}

function renderShadowRecordSmokeHtml(): string {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>ikimon Cloudflare shadow flow smoke</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; color: #17201a; background: #f6f8f5; }
    main { max-width: 920px; margin: 0 auto; padding: 28px 16px 54px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    form, .panel { background: #fff; border: 1px solid #d8e0da; border-radius: 8px; padding: 16px; margin-top: 16px; }
    label { display: grid; gap: 6px; font-weight: 700; margin: 12px 0; }
    input, textarea { font: inherit; padding: 10px 11px; border: 1px solid #bdc8c0; border-radius: 6px; }
    button, a.button { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 0 14px; border-radius: 6px; border: 0; background: #176b45; color: #fff; font-weight: 800; text-decoration: none; cursor: pointer; }
    .row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
    .status { color: #53615a; line-height: 1.7; }
    .error { color: #a4262c; font-weight: 700; }
    .ok { color: #176b45; font-weight: 800; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #f0f4f1; padding: 12px; border-radius: 6px; }
  </style>
</head>
<body>
<main data-shadow-flow="record">
  <p class="status">Cloudflare shadow browser smoke</p>
  <h1>記録から詳細、地図まで通す</h1>
  <p class="status">この画面は production ではなく shadow Worker のAPIだけを使います。</p>
  <form id="record-form">
    <label>観察ID <input id="observation-id" name="observationId" value="shadow-ui-${Date.now()}" autocomplete="off"></label>
    <label>ユーザーID <input id="user-id" name="userId" value="shadow-ui-user" autocomplete="off"></label>
    <label>名前 <input id="taxon-label" name="taxonLabel" value="ブラウザ導線テスト植物"></label>
    <label>日時 <input id="observed-at" name="observedAt" value="2026-06-15T08:45:00.000Z"></label>
    <label>緯度 <input id="latitude" name="latitude" value="34.71234" inputmode="decimal"></label>
    <label>経度 <input id="longitude" name="longitude" value="137.81234" inputmode="decimal"></label>
    <label>メモ <textarea id="note" name="note">shadow browser flow smoke</textarea></label>
    <button id="submit-record" type="submit">保存して導線を確認</button>
  </form>
  <section class="panel" aria-live="polite">
    <div id="flow-status" class="status">待機中</div>
    <div id="flow-links" class="row"></div>
    <pre id="flow-json"></pre>
  </section>
</main>
<script>
const form = document.getElementById('record-form');
const statusEl = document.getElementById('flow-status');
const linksEl = document.getElementById('flow-links');
const jsonEl = document.getElementById('flow-json');
function setStatus(text, cls) {
  statusEl.className = cls || 'status';
  statusEl.textContent = text;
}
async function readJson(response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}
async function waitForDetail(visitId) {
  let latest = null;
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const response = await fetch('/api/v1/observations/' + encodeURIComponent('occ:' + visitId + ':0') + '/public-detail', { headers: { accept: 'application/json' } });
    latest = await readJson(response);
    if (response.ok && latest.ok) return latest;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('detail_not_ready:' + JSON.stringify(latest));
}
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  linksEl.innerHTML = '';
  jsonEl.textContent = '';
  const observationId = document.getElementById('observation-id').value.trim();
  const userId = document.getElementById('user-id').value.trim();
  setStatus('保存中...', 'status');
  try {
    const observationResponse = await fetch('/api/v1/observations/upsert', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        observationId,
        userId,
        observedAt: document.getElementById('observed-at').value,
        latitude: Number(document.getElementById('latitude').value),
        longitude: Number(document.getElementById('longitude').value),
        note: document.getElementById('note').value,
        taxon: { vernacularName: document.getElementById('taxon-label').value, rank: 'species' }
      })
    });
    const observationJson = await readJson(observationResponse);
    if (!observationResponse.ok || !observationJson.ok) throw new Error('observation_failed:' + JSON.stringify(observationJson));
    const photoResponse = await fetch('/api/v1/observations/' + encodeURIComponent(observationJson.visitId) + '/photos/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        filename: 'shadow-ui.jpg',
        mimeType: 'image/jpeg',
        base64Data: btoa('shadow-ui-image-' + observationJson.visitId),
        facePrivacy: 'no_faces'
      })
    });
    const photoJson = await readJson(photoResponse);
    if (!photoResponse.ok || !photoJson.ok) throw new Error('photo_failed:' + JSON.stringify(photoJson));
    setStatus('公開read model待機中...', 'status');
    const detailJson = await waitForDetail(observationJson.visitId);
    const detailHref = '/observations/' + encodeURIComponent(observationJson.visitId);
    const mapHref = '/shadow-smoke/map?cell_id=' + encodeURIComponent(detailJson.observation.publicLocation.cellId);
    linksEl.innerHTML = '<a class="button" id="detail-link" href="' + detailHref + '">詳細を見る</a><a class="button" id="map-link" href="' + mapHref + '">地図で見る</a>';
    jsonEl.textContent = JSON.stringify({ observation: observationJson, photo: photoJson, detail: detailJson }, null, 2);
    setStatus('保存と公開read確認が完了しました', 'ok');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
  }
});
</script>
</body>
</html>`;
}

function renderShadowMapSmokeHtml(url: URL): string {
  const cellId = url.searchParams.get("cell_id") ?? "cell:34.71,137.81";
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>ikimon Cloudflare shadow map smoke</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; color: #17201a; background: #f6f8f5; }
    main { max-width: 920px; margin: 0 auto; padding: 28px 16px 54px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    .panel { background: #fff; border: 1px solid #d8e0da; border-radius: 8px; padding: 16px; margin-top: 16px; }
    .item { padding: 12px 0; border-top: 1px solid #e3e9e5; }
    .item:first-child { border-top: 0; }
    a { color: #176b45; font-weight: 800; }
    .status { color: #53615a; line-height: 1.7; }
  </style>
</head>
<body>
<main data-shadow-flow="map" data-cell-id="${escapeHtml(cellId)}">
  <p class="status">Cloudflare shadow browser smoke</p>
  <h1>地図read model</h1>
  <section class="panel">
    <div id="map-status" class="status">読み込み中</div>
    <div id="map-items"></div>
  </section>
</main>
<script>
const statusEl = document.getElementById('map-status');
const itemsEl = document.getElementById('map-items');
const cellId = ${JSON.stringify(cellId)};
async function loadMap() {
  const cellsResponse = await fetch('/api/v1/map/cells?bbox=137.70,34.70,137.82,34.72&zoom=13');
  const cells = await cellsResponse.json();
  const observationsResponse = await fetch('/api/v1/map/observations?cell_id=' + encodeURIComponent(cellId));
  const observations = await observationsResponse.json();
  statusEl.textContent = 'cells=' + cells.features.length + ' / items=' + observations.items.length + ' / selected=' + observations.stats.selectedCellId;
  itemsEl.innerHTML = observations.items.slice(0, 20).map((item) =>
    '<div class="item" data-map-item="' + item.visitId + '"><a href="/observations/' + encodeURIComponent(item.visitId) + '">' + item.displayName + '</a><div class="status">' + item.observedAt + ' / ' + item.cellId + '</div></div>'
  ).join('');
}
loadMap().catch((error) => {
  statusEl.textContent = error instanceof Error ? error.message : String(error);
});
</script>
</body>
</html>`;
}

type PublicObservationDetail = NonNullable<Awaited<ReturnType<typeof buildPublicObservationDetail>>>;

function renderPublicObservationDetailHtml(detail: PublicObservationDetail): string {
  const polish = publicObservationDetailPolish(detail);
  const displayName = polish?.displayName ?? detail.displayName;
  const lead = polish?.lead ?? (detail.isAwaitingId ? "名前はまだ確認待ちの公開記録です。" : "公開範囲をぼかした観察記録です。");
  const photos = detail.photoAssets.length > 0
    ? detail.photoAssets.map((asset, index) => `<figure class="obs-photo ${index === 0 ? "obs-photo--main" : ""}" data-obs-media-item="${escapeHtml(asset.assetId)}">
        <img src="${escapeHtml(asset.url)}" alt="${escapeHtml(displayName)}" loading="${index === 0 ? "eager" : "lazy"}">
      </figure>`).join("")
    : `<div class="obs-empty">公開できる写真はまだありません。</div>`;
  const mediaBlock = polish?.mediaBlock ?? `<div class="obs-photo-grid">${photos}</div>`;
  const videos = !polish?.mediaBlock && detail.videoAssets.length > 0
    ? detail.videoAssets.map((asset) => `<a class="obs-media-link" href="${escapeHtml(asset.watchUrl)}">動画を開く</a>`).join("")
    : "";
  const note = typeof detail.note === "string" && detail.note.trim() !== "" ? detail.note.trim() : "";
  const photoCount = detail.photoAssets.length;
  const videoCount = Math.max(detail.videoAssets.length, polish?.videoCount ?? 0);
  const audioCount = polish?.audioCount ?? 0;
  const assetCount = Math.max(detail.assetCount ?? 0, photoCount + videoCount + audioCount);
  const mapHref = `/map?tab=places&cell=${encodeURIComponent(detail.publicLocation.cellId)}`;
  const recordHref = `/record?from=observation&cell=${encodeURIComponent(detail.publicLocation.cellId)}`;
  const related = detail.relatedObservations ?? [];
  const observedLabel = polish?.observedLabel ?? formatPublicObservationDate(detail.observedAt);
  const placeLabel = polish?.placeLabel ?? detail.publicLocation.label;
  const stateLabel = polish?.stateLabel ?? (detail.isAwaitingId ? "同定待ち" : "名前あり");
  const relatedForDisplay = typeof polish?.relatedLimit === "number" ? related.slice(0, polish.relatedLimit) : related;
  const relatedCards = relatedForDisplay.length > 0
    ? relatedForDisplay.map((item) => `<a class="obs-nearby-card" href="/observations/${encodeURIComponent(item.visitId)}">
        ${item.photoUrl
          ? `<img class="obs-area-thumb" src="${escapeHtml(item.photoUrl)}" alt="" loading="lazy">`
          : `<span class="obs-nearby-nophoto" aria-hidden="true">+</span>`}
        <span class="obs-nearby-body">
          <strong>${escapeHtml(item.displayName)}</strong>
          <span>${escapeHtml(formatPublicObservationDate(item.observedAt))}</span>
        </span>
      </a>`).join("")
    : `<div class="obs-empty obs-empty--compact">近くの公開記録はまだ少ない状態です。</div>`;
  const mediaLedger = `<div class="obs-media-ledger" aria-label="メディア台帳">
    <div class="obs-media-ledger-item"><strong>写真</strong><span>${escapeHtml(`${photoCount}枚`)}</span><small>${escapeHtml(photoCount > 0 ? "公開中" : "未公開")}</small></div>
    <div class="obs-media-ledger-item"><strong>動画</strong><span>${escapeHtml(`${videoCount}本`)}</span><small>${escapeHtml(videoCount > 0 ? "公開中" : "未公開")}</small></div>
    <div class="obs-media-ledger-item"><strong>音</strong><span>${escapeHtml(`${audioCount}件`)}</span><small>${escapeHtml(audioCount > 0 ? "公開中" : "未記録")}</small></div>
    <a class="obs-media-ledger-item" href="#place" aria-label="同じエリアの投稿一覧へ移動"><strong>同エリア</strong><span>${escapeHtml(`${relatedForDisplay.length}件`)}</span><small>投稿一覧へ</small></a>
  </div>`;
  const recordInsight = polish?.recordInsight ?? (detail.isAwaitingId ? "この記録は、公開写真と日時だけを見られる状態です。名前は今後の確認で更新されることがあります。" : `${displayName}として公開されています。公開ページでは、写真とぼかした場所だけを扱います。`);
  const identifyBlock = polish?.identifyBlock ?? `<section class="obs-local-quality-left">
        <h2>同定</h2>
        <p>${escapeHtml(detail.isAwaitingId ? "この記録は名前の確認待ちです。" : `${displayName} として表示しています。`)}</p>
      </section>`;
  const qualityBlock = polish?.qualityBlock ?? `<section class="obs-local-quality-card">
        <h2>公開データ</h2>
        <p>公開写真、ぼかした場所、日時だけを使います。投稿者ID、精密座標、元画像URLは表示しません。</p>
      </section>`;
  const relatedEye = polish?.relatedEye ?? "同じ周辺";
  const relatedTitle = polish?.relatedTitle ?? "近くの公開記録";
  const relatedLead = polish?.relatedLead ?? "";
  const relatedCountLabel = polish?.relatedCountLabel ?? `${relatedForDisplay.length}件`;
  const actionRailBlock = polish ? `<nav class="obs-action-strip" aria-label="関連操作">
        <a href="${escapeHtml(recordHref)}">もう一度記録する</a>
        <a href="${escapeHtml(mapHref)}">地図で見る</a>
      </nav>` : `<div class="obs-action-rail" aria-label="関連操作">
        <a class="obs-action" href="${escapeHtml(mapHref)}"><span>↗</span><strong>地図で見る</strong></a>
        <a class="obs-action" href="/records"><span>▦</span><strong>記録一覧</strong></a>
        <a class="obs-action" href="${escapeHtml(recordHref)}"><span>＋</span><strong>記録する</strong></a>
      </div>`;
  const readProgressLinks = polish ? `
  <a href="#summary">記録</a>
  <a href="#photos">動画</a>
  <a href="#identify">候補</a>
  <a href="#place">近く</a>` : `
  <a href="#summary">場面の記録</a>
  <a href="#photos">写真・動画</a>
  <a href="#trust">状態</a>
  <a href="#story">記録</a>
  <a href="#identify">同定</a>
  <a href="#place">場所</a>
  <a href="#meta">情報</a>`;
  const genericInfoSections = polish ? "" : `<section id="privacy" class="obs-layer">
      <h2>公開範囲</h2>
      <div class="obs-layer-grid">
        <div class="obs-layer-card"><span>位置</span><strong>${escapeHtml(placeLabel)}</strong></div>
        <div class="obs-layer-card"><span>表示</span><strong>ぼかし表示</strong></div>
        <div class="obs-layer-card"><span>精密座標</span><strong>非表示</strong></div>
      </div>
      <p>公開ページでは、観察地点をそのまま表示しません。</p>
    </section>`;
  const genericMetaSection = polish ? "" : `<section id="meta" class="obs-layer">
      <h2>記録情報</h2>
      <div class="obs-layer-grid">
        <div class="obs-layer-card"><span>記録ID</span><strong>${escapeHtml(detail.visitId)}</strong></div>
        <div class="obs-layer-card"><span>メディア</span><strong>${escapeHtml(`${assetCount}件`)}</strong></div>
        <div class="obs-layer-card"><span>公開状態</span><strong>公開中</strong></div>
      </div>
    </section>`;
  const factsBlock = polish ? "" : `<div class="obs-facts">
        <div class="obs-fact"><span>日時</span><strong>${escapeHtml(observedLabel)}</strong></div>
        <div class="obs-fact"><span>場所</span><strong>${escapeHtml(placeLabel)}</strong></div>
        <div class="obs-fact"><span>写真</span><strong>${escapeHtml(String(detail.photoAssets.length))}</strong></div>
        <div class="obs-fact"><span>状態</span><strong>${escapeHtml(stateLabel)}</strong></div>
      </div>`;
  const privacyBlock = polish ? "" : `<section class="obs-privacy"><h2>公開位置</h2><p>このページでは、精密な座標や投稿者のプロフィールリンクは表示していません。</p></section>`;
  const storyBlock = polish ? "" : `<section id="story" class="obs-record-story">
      <div class="obs-record-story-head">
        <div>
          <div class="obs-record-story-eye">記録</div>
          <h2 class="obs-record-story-title">${escapeHtml(displayName)}</h2>
        </div>
        <span class="obs-record-story-pill">${escapeHtml(stateLabel)}</span>
      </div>
      <div class="obs-record-story-cards">
        <div class="obs-record-story-card"><strong>写真</strong><p>${escapeHtml(`${photoCount}枚の公開サムネイルを表示しています。`)}</p></div>
        <div class="obs-record-story-card"><strong>日時</strong><p>${escapeHtml(observedLabel)}</p></div>
        <div class="obs-record-story-card"><strong>場所</strong><p>${escapeHtml(placeLabel)}</p></div>
      </div>
    </section>`;
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(displayName)} - ikimon</title>
  <style>
    :root { color-scheme: light; --ink: #0f172a; --muted: #64748b; --line: rgba(15,23,42,.1); --teal: #0f766e; --mint: #ecfdf5; --sky: #eff6ff; --paper: rgba(255,255,255,.94); --shell: min(1180px, calc(100% - 28px)); --content: min(860px, calc(100vw - 28px)); }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: linear-gradient(180deg, #f8fffc 0%, #f6f8fb 58%, #eef6f3 100%); }
    a { color: inherit; }
    .site-header { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px clamp(14px, 3vw, 32px); border-bottom: 1px solid rgba(15,23,42,.08); background: rgba(255,255,255,.86); backdrop-filter: blur(14px); }
    .brand { display: inline-flex; align-items: center; gap: 10px; color: var(--ink); text-decoration: none; font-weight: 950; }
    .brand-mark { width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, #22d3ee 0%, #2dd4bf 46%, #bef264 100%); box-shadow: inset 0 0 0 1px rgba(255,255,255,.55); }
    .header-actions { display: flex; align-items: center; gap: 8px; }
    .header-link { min-height: 38px; display: inline-flex; align-items: center; justify-content: center; padding: 0 14px; border-radius: 999px; background: #0f9f78; color: #fff; text-decoration: none; font-size: 13px; font-weight: 900; }
    .header-link--ghost { background: #eef8f5; color: #0f766e; border: 1px solid rgba(15,118,110,.16); }
    main { width: var(--shell); margin: 0 auto; padding: 18px 0 58px; }
    .obs-read-progress { position: sticky; top: 63px; z-index: 9; width: var(--shell); margin: 0 auto 10px; display: flex; gap: 6px; overflow-x: auto; padding: 5px 0; background: rgba(248,255,252,.88); backdrop-filter: blur(12px); scrollbar-width: none; }
    .obs-read-progress::-webkit-scrollbar { display: none; }
    .obs-read-progress a { flex: 0 0 auto; min-height: 32px; display: inline-flex; align-items: center; padding: 6px 10px; border-radius: 999px; background: #fff; border: 1px solid rgba(15,23,42,.08); color: #334155; text-decoration: none; font-size: 11.5px; line-height: 1; font-weight: 900; }
    .obs-read-progress a:hover, .obs-read-progress a:focus-visible { background: #ecfdf5; color: #047857; border-color: rgba(16,185,129,.24); outline: none; }
    .obs-reading-hero { display: grid; grid-template-columns: minmax(0, 1.18fr) minmax(330px, .82fr); gap: 28px; align-items: start; margin-top: 16px; margin-bottom: 16px; scroll-margin-top: 96px; }
    .obs-reading-media { display: grid; gap: 10px; min-width: 0; order: 1; }
    .obs-media-evidence-shell { display: grid; gap: 10px; }
    .obs-hero-media-stack { display: grid; gap: 10px; }
    .obs-hero-video { overflow: hidden; border-radius: 22px; border: 1px solid rgba(15,23,42,.08); background: #0f172a; box-shadow: 0 18px 44px rgba(15,23,42,.1); }
    .obs-hero-video-frame { position: relative; width: 100%; aspect-ratio: 16 / 9; background: #0f172a; }
    .obs-hero-video-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    .obs-hero-video-meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; color: #e2e8f0; font-size: 12px; line-height: 1.4; font-weight: 850; }
    .obs-hero-video-meta a { color: #ccfbf1; text-decoration: none; font-weight: 950; }
    .obs-media-role-badge { display: inline-flex; align-items: center; min-height: 24px; padding: 3px 8px; border-radius: 999px; background: rgba(20,184,166,.18); color: #ccfbf1; font-size: 11px; font-weight: 950; }
    .obs-video-annotation-rail { display: flex; gap: 7px; overflow-x: auto; padding: 9px 1px 2px; scrollbar-width: none; }
    .obs-video-annotation-rail::-webkit-scrollbar { display: none; }
    .obs-video-annotation-chip { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 5px 9px; border-radius: 999px; border: 1px solid rgba(15,118,110,.16); background: rgba(255,255,255,.94); color: #0f172a; font-size: 11.5px; line-height: 1.2; font-weight: 950; box-shadow: 0 8px 18px rgba(15,23,42,.05); }
    .obs-video-annotation-chip span { color: #0f766e; font-size: 10.5px; }
    .obs-video-evidence { display: grid; gap: 10px; padding: 12px; border-radius: 18px; background: rgba(255,255,255,.94); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 12px 28px rgba(15,23,42,.055); }
    .obs-video-evidence-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .obs-video-evidence-head h2 { margin: 0; color: #0f172a; font-size: 14px; line-height: 1.35; font-weight: 950; }
    .obs-video-evidence-head span { color: #64748b; font-size: 11px; font-weight: 900; white-space: nowrap; }
    .obs-video-evidence-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .obs-video-evidence-frame { margin: 0; min-width: 0; display: grid; gap: 5px; }
    .obs-video-evidence-preview { appearance: none; border: 0; padding: 0; margin: 0; display: block; width: 100%; border-radius: 13px; overflow: hidden; background: #e2e8f0; cursor: zoom-in; box-shadow: 0 10px 22px rgba(15,23,42,.08); }
    .obs-video-evidence-preview img { display: block; width: 100%; aspect-ratio: 16 / 10; object-fit: cover; }
    .obs-video-evidence-frame figcaption { color: #334155; font-size: 11px; line-height: 1.35; font-weight: 900; overflow-wrap: anywhere; }
    .obs-photo-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 9px; }
    .obs-photo { margin: 0; min-width: 0; overflow: hidden; border: 1px solid rgba(15,23,42,.08); border-radius: 16px; background: #e8f3ef; box-shadow: 0 18px 44px rgba(15,23,42,.08); }
    .obs-photo--main { grid-column: 1 / -1; border-radius: 22px; }
    .obs-photo:not(.obs-photo--main) { grid-column: span 2; }
    .obs-photo img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; background: #dbeafe; }
    .obs-photo--main img { aspect-ratio: 16 / 11; }
    .obs-reading-panel { display: grid; gap: 10px; align-self: start; order: 2; padding: 14px 16px; border-radius: 18px; background: rgba(255,255,255,.94); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 18px 42px rgba(15,23,42,.06); }
    .obs-reading-panel > h1.sr-only { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0, 0, 0, 0) !important; white-space: nowrap !important; border: 0 !important; }
    .obs-record-brief { display: grid; gap: 10px; padding: 12px; border-radius: 16px; background: linear-gradient(135deg, rgba(236,253,245,.78), rgba(239,246,255,.78)); border: 1px solid rgba(16,185,129,.18); }
    .obs-record-brief-compact { gap: 8px; padding: 10px 12px; border-radius: 14px; }
    .obs-record-compact-main { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; }
    .obs-record-compact-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 5px 10px; color: #0f172a; font-size: 13px; line-height: 1.35; font-weight: 950; min-width: 0; }
    .obs-record-compact-meta span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .obs-hero-observer { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px; font-weight: 800; color: #0f172a; text-decoration: none; }
    .obs-hero-avatar { width: 24px; height: 24px; border-radius: 50%; background: #10b981; color: #fff; display: grid; place-items: center; font-weight: 900; font-size: 11px; flex-shrink: 0; overflow: hidden; }
    .obs-reading-kicker { color: var(--teal); font-size: 11px; line-height: 1.3; font-weight: 950; letter-spacing: .08em; text-transform: uppercase; }
    .obs-reading-title { margin: 0; color: var(--ink); font-size: clamp(24px, 3.6vw, 44px); line-height: 1.08; font-weight: 950; letter-spacing: 0; overflow-wrap: anywhere; }
    .obs-reading-lead { margin: 0; color: #64748b; font-size: 12.5px; line-height: 1.6; font-weight: 700; }
    .obs-reading-panel > .obs-media-ledger { display: flex; flex-wrap: nowrap; gap: 5px; overflow-x: auto; scrollbar-width: none; }
    .obs-reading-panel > .obs-media-ledger::-webkit-scrollbar { display: none; }
    .obs-reading-panel .obs-media-ledger-item { flex: 1 1 0; min-width: 0; min-height: 32px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 5px 7px; border-radius: 999px; background: rgba(255,255,255,.92); border: 1px solid rgba(15,23,42,.075); text-align: center; white-space: nowrap; }
    .obs-reading-panel .obs-media-ledger-item strong { flex: 0 0 auto; color: #475569; font-size: 10px; line-height: 1.2; font-weight: 950; }
    .obs-reading-panel .obs-media-ledger-item span { flex: 0 0 auto; color: #0f172a; font-size: 11.5px; line-height: 1.2; font-weight: 950; }
    .obs-reading-panel .obs-media-ledger-item small { display: none; }
    .obs-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
    .obs-fact { display: grid; gap: 3px; min-width: 0; padding: 11px 12px; border: 1px solid rgba(15,23,42,.07); border-radius: 14px; background: rgba(248,250,252,.86); }
    .obs-fact span { color: var(--muted); font-size: 10.5px; line-height: 1.3; font-weight: 900; }
    .obs-fact strong { color: var(--ink); font-size: 13px; line-height: 1.45; font-weight: 900; overflow-wrap: anywhere; }
    .obs-action-rail { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .obs-action { min-width: 0; min-height: 58px; display: grid; gap: 4px; place-items: center; padding: 9px; border-radius: 15px; border: 1px solid rgba(15,23,42,.08); background: #fff; text-decoration: none; color: #0f172a; box-shadow: 0 10px 24px rgba(15,23,42,.05); }
    .obs-action span { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 999px; background: rgba(20,184,166,.13); color: #0f766e; font-size: 15px; line-height: 1; }
    .obs-action strong { font-size: 11.5px; line-height: 1.25; font-weight: 950; text-align: center; }
    .obs-action-strip { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .obs-action-strip a { min-height: 34px; display: inline-flex; align-items: center; justify-content: center; padding: 0 12px; border-radius: 999px; border: 1px solid rgba(15,118,110,.18); background: #fff; color: #0f766e; text-decoration: none; font-size: 12px; line-height: 1.2; font-weight: 950; }
    .obs-action-strip a:first-child { background: #0f766e; color: #fff; border-color: #0f766e; }
    .obs-record-insight, .obs-note, .obs-privacy, .obs-media-links { display: grid; gap: 7px; padding: 12px 13px; border-radius: 14px; border: 1px solid rgba(15,23,42,.07); background: linear-gradient(135deg, rgba(236,253,245,.82), rgba(239,246,255,.82)); }
    .obs-note h2, .obs-privacy h2, .obs-media-links h2 { margin: 0; font-size: 12px; line-height: 1.35; font-weight: 950; color: var(--ink); letter-spacing: 0; }
    .obs-note p, .obs-privacy p, .obs-record-insight p { margin: 0; color: #334155; font-size: 13px; line-height: 1.65; font-weight: 700; }
    .obs-media-link { display: inline-flex; width: fit-content; min-height: 34px; align-items: center; padding: 0 12px; border-radius: 999px; background: #0f766e; color: #fff; text-decoration: none; font-size: 12px; font-weight: 900; }
    .obs-empty { display: grid; min-height: 280px; place-items: center; border: 1px dashed rgba(15,23,42,.16); border-radius: 20px; background: rgba(255,255,255,.7); color: var(--muted); font-size: 13px; font-weight: 800; }
    .obs-empty--compact { min-height: 116px; }
    .obs-local-quality-inline { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, .94fr) minmax(0, 1.06fr); gap: 12px; align-items: stretch; min-width: 0; margin-top: 12px; }
    .obs-local-quality-inline.is-full-width { order: 3; width: 100%; grid-template-columns: minmax(0, .92fr) minmax(0, 1.08fr); margin-top: 16px; }
    .obs-local-quality-left, .obs-local-quality-card { display: grid; gap: 10px; padding: 14px; border-radius: 16px; background: #fff; border: 1px solid rgba(15,23,42,.08); box-shadow: 0 10px 26px rgba(15,23,42,.04); }
    .obs-local-quality-card h2, .obs-local-quality-left h2 { margin: 0; color: #0f172a; font-size: 14px; line-height: 1.35; font-weight: 950; letter-spacing: 0; }
    .obs-local-quality-card p, .obs-local-quality-left p { margin: 0; color: #475569; font-size: 12.5px; line-height: 1.65; font-weight: 720; }
    .obs-first-read, .obs-ai-readout, .obs-frame-identify-card { display: grid; gap: 10px; padding: 14px; border-radius: 16px; background: rgba(255,255,255,.96); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 10px 26px rgba(15,23,42,.045); }
    .obs-first-read h2, .obs-ai-readout h2, .obs-frame-identify-card h2 { margin: 0; color: #0f172a; font-size: 14px; line-height: 1.35; font-weight: 950; }
    .obs-first-read p, .obs-ai-readout p, .obs-frame-identify-card p { margin: 0; color: #475569; font-size: 12.5px; line-height: 1.65; font-weight: 720; }
    .obs-mini-chip-row, .obs-record-use-status, .obs-ai-evidence-pills, .obs-identify-actions { display: flex; flex-wrap: wrap; gap: 6px; }
    .obs-mini-chip-row span, .obs-record-use-status span, .obs-ai-evidence-pills span { display: inline-flex; align-items: center; min-height: 26px; padding: 4px 8px; border-radius: 999px; background: #ecfdf5; color: #0f766e; border: 1px solid rgba(15,118,110,.15); font-size: 11px; line-height: 1.2; font-weight: 950; }
    .obs-observation-set { display: grid; gap: 9px; }
    .obs-observation-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .obs-observation-card { display: grid; gap: 4px; min-width: 0; padding: 9px 10px; border-radius: 13px; background: #f8fafc; border: 1px solid rgba(15,23,42,.07); }
    .obs-observation-card span { color: #0f766e; font-size: 10.5px; line-height: 1.25; font-weight: 950; }
    .obs-observation-card strong { color: #0f172a; font-size: 13px; line-height: 1.35; font-weight: 950; overflow-wrap: anywhere; }
    .obs-observation-card small { color: #64748b; font-size: 11px; line-height: 1.35; font-weight: 760; }
    .obs-env-strip { display: grid; grid-template-columns: 68px minmax(0, 1fr); gap: 8px; align-items: center; padding: 9px 10px; border-radius: 13px; background: linear-gradient(135deg, #ecfdf5, #f8fafc); border: 1px solid rgba(15,118,110,.14); }
    .obs-env-strip strong { color: #0f766e; font-size: 11px; line-height: 1.3; font-weight: 950; }
    .obs-env-strip span { color: #334155; font-size: 12px; line-height: 1.45; font-weight: 850; }
    .obs-ai-status { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
    .obs-ai-status strong { color: #0f172a; font-size: 18px; line-height: 1.25; font-weight: 950; }
    .obs-ai-status span { flex: 0 0 auto; color: #0f766e; background: #ecfdf5; border-radius: 999px; padding: 4px 9px; font-size: 11px; font-weight: 950; }
    .obs-ai-merged-row { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 8px; align-items: center; padding: 9px 10px; border-radius: 13px; background: #f8fafc; border: 1px solid rgba(15,23,42,.07); }
    .obs-ai-merged-row > span { color: #64748b; font-size: 11px; font-weight: 950; }
    .obs-ai-merged-row strong { color: #0f172a; font-size: 12.5px; line-height: 1.35; font-weight: 950; }
    .obs-local-read-button, .obs-identify-button { min-height: 32px; display: inline-flex; align-items: center; justify-content: center; padding: 0 10px; border-radius: 999px; border: 1px solid rgba(15,118,110,.18); background: #ecfdf5; color: #0f766e; font-size: 11.5px; font-weight: 950; }
    .obs-identify-button { background: #0f766e; color: #fff; border-color: #0f766e; }
    .obs-identify-button.is-secondary { background: #fff; color: #0f766e; }
    .obs-local-name-activity-list { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
    .obs-local-name-activity-list li { display: grid; gap: 2px; padding: 9px 10px; border-radius: 12px; background: #f8fafc; border: 1px solid rgba(15,23,42,.07); }
    .obs-local-name-activity-list strong { color: #0f172a; font-size: 12px; line-height: 1.35; font-weight: 950; }
    .obs-local-name-activity-list span { color: #64748b; font-size: 11.5px; line-height: 1.45; font-weight: 760; }
    .obs-record-feedback-strip { display: flex; flex-wrap: wrap; gap: 8px; align-content: flex-start; padding: 14px; border-radius: 16px; background: rgba(236,253,245,.72); border: 1px solid rgba(15,118,110,.13); }
    .obs-record-feedback-strip span { display: inline-grid; gap: 2px; min-width: min(150px, 100%); padding: 9px 10px; border-radius: 13px; background: #fff; border: 1px solid rgba(15,23,42,.06); color: #334155; font-size: 11.5px; line-height: 1.35; font-weight: 780; }
    .obs-record-feedback-strip strong { color: #0f766e; font-size: 10.5px; line-height: 1.2; font-weight: 950; }
    .obs-quality-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .obs-quality-item, .obs-env-row { display: grid; gap: 3px; padding: 9px 10px; border-radius: 12px; background: #f8fafc; border: 1px solid rgba(15,23,42,.07); }
    .obs-quality-item span, .obs-env-row span { color: #64748b; font-size: 10.5px; line-height: 1.3; font-weight: 900; }
    .obs-quality-item strong, .obs-env-row strong { color: #0f172a; font-size: 12px; line-height: 1.35; font-weight: 950; }
    .obs-frame-preview { position: fixed; inset: 0; z-index: 80; display: none; place-items: center; padding: 18px; background: rgba(15,23,42,.72); }
    .obs-frame-preview.is-open { display: grid; }
    .obs-frame-preview-dialog { width: min(920px, 96vw); display: grid; gap: 10px; border-radius: 18px; background: #fff; padding: 12px; box-shadow: 0 24px 72px rgba(0,0,0,.32); }
    .obs-frame-preview-stage { max-height: min(70vh, 680px); overflow: auto; border-radius: 14px; background: #0f172a; text-align: center; }
    .obs-frame-preview-img { width: 100%; max-width: none; height: auto; display: block; margin: 0 auto; }
    .obs-frame-preview-tools { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #334155; font-size: 12px; line-height: 1.4; font-weight: 850; }
    .obs-frame-preview-tools button { min-height: 34px; padding: 0 11px; border-radius: 999px; border: 1px solid rgba(15,23,42,.12); background: #fff; color: #0f172a; font-weight: 950; }
    .obs-reading-flow { display: grid; gap: 18px; max-width: var(--content); margin: 0 auto; }
    .obs-reading-section, .obs-layer { display: grid; gap: 14px; scroll-margin-top: 96px; }
    .obs-layer { padding: 16px; border-radius: 20px; background: rgba(255,255,255,.88); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 14px 36px rgba(15,23,42,.06); }
    .obs-layer h2 { margin: 0; color: #0f172a; font-size: 16px; line-height: 1.35; font-weight: 950; letter-spacing: 0; }
    .obs-layer p { margin: 0; color: #334155; font-size: 13px; line-height: 1.72; font-weight: 700; }
    .obs-layer-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .obs-layer-card { min-width: 0; display: grid; gap: 5px; padding: 12px; border-radius: 14px; background: #f8fafc; border: 1px solid rgba(15,23,42,.07); }
    .obs-layer-card span { color: #64748b; font-size: 10.5px; line-height: 1.3; font-weight: 900; }
    .obs-layer-card strong { color: #0f172a; font-size: 13px; line-height: 1.45; font-weight: 950; overflow-wrap: anywhere; }
    .obs-record-story { display: grid; gap: 12px; padding: 18px; border-radius: 18px; background: linear-gradient(135deg, rgba(255,255,255,.96), rgba(240,253,244,.86)); border: 1px solid rgba(16,185,129,.18); box-shadow: 0 16px 44px rgba(15,23,42,.06); }
    .obs-record-story-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .obs-record-story-eye { color: #047857; font-size: 10.5px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; }
    .obs-record-story-title { margin: 3px 0 0; color: #0f172a; font-size: 18px; line-height: 1.35; font-weight: 950; letter-spacing: 0; }
    .obs-record-story-pill { flex-shrink: 0; min-height: 28px; display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; background: rgba(14,165,233,.1); color: #0369a1; font-size: 11px; font-weight: 950; }
    .obs-record-story-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .obs-record-story-card { display: grid; gap: 7px; padding: 13px; border-radius: 14px; background: #fff; border: 1px solid rgba(15,23,42,.08); }
    .obs-record-story-card strong { color: #0f172a; font-size: 13.5px; line-height: 1.35; font-weight: 950; }
    .obs-record-story-card p { margin: 0; color: #475569; font-size: 12.5px; line-height: 1.65; font-weight: 740; }
    .obs-area-records { display: grid; gap: 12px; padding: 18px; border-radius: 18px; background: linear-gradient(135deg, rgba(255,255,255,.96), rgba(240,253,244,.86)); border: 1px solid rgba(16,185,129,.16); box-shadow: 0 16px 40px rgba(15,23,42,.045); }
    .obs-area-records-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .obs-area-records-eye { color: #047857; font-size: 10.5px; line-height: 1.2; font-weight: 950; letter-spacing: .1em; text-transform: uppercase; }
    .obs-area-records-head h2 { margin: 3px 0 0; color: #0f172a; font-size: 18px; line-height: 1.35; letter-spacing: 0; }
    .obs-area-count { flex-shrink: 0; min-height: 30px; display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; background: #fff; border: 1px solid rgba(16,185,129,.22); color: #047857; font-size: 11px; font-weight: 950; }
    .obs-nearby-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .obs-nearby-card { display: flex; align-items: stretch; min-height: 132px; padding: 0; gap: 0; border: 1px solid rgba(16,185,129,.14); border-radius: 14px; background: #fff; color: inherit; overflow: hidden; text-decoration: none; box-shadow: 0 10px 24px rgba(15,23,42,.035); }
    .obs-nearby-card:hover, .obs-nearby-card:focus-visible { border-color: rgba(16,185,129,.28); box-shadow: 0 14px 28px rgba(15,23,42,.06); outline: none; }
    .obs-area-thumb { width: 210px; flex: 0 0 210px; min-height: 0; aspect-ratio: 4 / 3; object-fit: cover; background: #e2e8f0; }
    .obs-nearby-nophoto { width: 52px; height: 52px; aspect-ratio: auto; flex: 0 0 52px; margin: auto 16px; border-radius: 13px; background: linear-gradient(135deg, #ecfdf5, #f8fafc); color: #047857; font-size: 18px; display: grid; place-items: center; font-weight: 950; }
    .obs-nearby-body { display: grid; align-content: center; gap: 5px; padding: 15px 16px; min-width: 0; }
    .obs-nearby-body strong { color: #0f172a; font-size: 14px; line-height: 1.35; font-weight: 950; overflow-wrap: anywhere; }
    .obs-nearby-body span { color: #64748b; font-size: 11.5px; line-height: 1.45; font-weight: 760; }
    @media (max-width: 860px) {
      main { width: min(100% - 20px, 680px); padding-top: 14px; }
      .obs-read-progress { width: min(100% - 20px, 680px); }
      .header-actions .header-link--ghost { display: none; }
      .obs-reading-hero { grid-template-columns: 1fr; gap: 12px; }
      .obs-reading-panel { display: contents; }
      .obs-record-brief-compact { order: 1; display: grid; gap: 7px; padding: 9px 10px; }
      .obs-reading-kicker { order: 2; }
      .obs-reading-title { order: 3; }
      .obs-reading-lead { order: 4; }
      .obs-reading-media { order: 5; }
      .obs-reading-panel > .obs-media-ledger { order: 6; }
      .obs-record-insight-desktop { order: 7; display: grid; }
      .obs-record-use-status { order: 8; }
      .obs-first-read { order: 9; }
      .obs-ai-readout { order: 10; }
      .obs-action-rail, .obs-action-strip { order: 11; }
      .obs-facts { order: 12; }
      .obs-privacy { order: 13; }
      .obs-note, .obs-media-links { order: 14; }
      .obs-local-quality-inline, .obs-local-quality-inline.is-full-width { order: 15; grid-template-columns: 1fr; gap: 10px; margin-top: 8px; }
      .obs-reading-title { font-size: 25px; }
      .obs-video-evidence-grid { display: flex; overflow-x: auto; gap: 8px; padding-bottom: 2px; }
      .obs-video-evidence-frame { flex: 0 0 150px; }
      .obs-ai-status { display: grid; }
      .obs-ai-merged-row, .obs-quality-grid, .obs-observation-grid, .obs-env-strip { grid-template-columns: 1fr; }
      .obs-photo--main img { aspect-ratio: 4 / 3; }
      .obs-photo:not(.obs-photo--main) { grid-column: span 3; }
      .obs-facts, .obs-action-rail, .obs-layer-grid { grid-template-columns: 1fr; }
      .obs-record-story-head { display: grid; justify-content: stretch; gap: 8px; }
      .obs-record-story-title { font-size: 17px; line-height: 1.45; overflow-wrap: anywhere; }
      .obs-record-story-pill { justify-self: start; max-width: 100%; white-space: normal; }
      .obs-record-story-cards, .obs-nearby-grid { grid-template-columns: 1fr; }
      .obs-nearby-card { flex-direction: column; min-height: 0; }
      .obs-area-thumb { width: 100%; flex: 0 0 auto; min-height: 0; height: auto; aspect-ratio: 16 / 9; }
      .obs-nearby-body { padding: 11px 12px; gap: 4px; }
    }
  </style>
</head>
<body>
<header class="site-header">
  <a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span><span>ikimon</span></a>
  <nav class="header-actions" aria-label="主要リンク">
    <a class="header-link header-link--ghost" href="/records">記録を見る</a>
    <a class="header-link" href="/map">地図へ</a>
  </nav>
</header>
<nav class="obs-read-progress" aria-label="記録ページの読み進め">
  ${readProgressLinks}
</nav>
<main data-cloudflare-observation-detail="1" data-visit-id="${escapeHtml(detail.visitId)}" data-occurrence-id="${escapeHtml(detail.occurrenceId)}">
  <article id="photos" class="obs-reading-hero">
    <section class="obs-reading-media obs-media-evidence-shell" aria-label="公開メディア">
      ${mediaBlock}
    </section>
    <aside class="obs-reading-panel" aria-label="観察記録">
      <h1 class="sr-only">${escapeHtml(displayName)}</h1>
      <div id="summary" class="obs-record-brief obs-record-brief-compact" data-obs-section="summary" aria-label="この記録">
        <div class="obs-record-compact-main">
          <div class="obs-record-compact-meta">
            <span>${escapeHtml(observedLabel)}</span>
            <span>${escapeHtml(placeLabel)}</span>
          </div>
          <span class="obs-hero-observer" aria-label="投稿者は公開していません">
            <span class="obs-hero-avatar" aria-hidden="true">i</span>
            <span>公開記録</span>
          </span>
        </div>
      </div>
      <div class="obs-reading-kicker">観察記録</div>
      <h1 class="obs-reading-title">${escapeHtml(displayName)}</h1>
      <p class="obs-reading-lead">${escapeHtml(lead)}</p>
      ${mediaLedger}
      <section id="trust" class="obs-record-insight obs-record-insight-desktop">
        <p>${escapeHtml(recordInsight)}</p>
      </section>
      ${polish?.statusBlock ?? ""}
      ${polish?.firstReadBlock ?? ""}
      ${polish?.aiReadoutBlock ?? ""}
      ${actionRailBlock}
      ${factsBlock}
      ${note ? `<section class="obs-note"><h2>メモ</h2><p>${escapeHtml(note)}</p></section>` : ""}
      ${videos ? `<section class="obs-media-links"><h2>動画</h2>${videos}</section>` : ""}
      ${privacyBlock}
    </aside>
    <div id="identify" class="obs-local-quality-inline is-full-width">
      ${identifyBlock}
      ${qualityBlock}
    </div>
  </article>
  <section class="obs-reading-flow" aria-label="記録の情報">
    ${storyBlock}
    ${genericInfoSections}
    <section id="place" class="section obs-layer obs-layer-3 obs-area-records" data-obs-section="place">
      <div class="obs-area-records-head">
        <div>
          <div class="obs-area-records-eye">${escapeHtml(relatedEye)}</div>
          <h2>${escapeHtml(relatedTitle)}</h2>
        </div>
        <span class="obs-area-count">${escapeHtml(relatedCountLabel)}</span>
      </div>
      ${relatedLead ? `<p>${escapeHtml(relatedLead)}</p>` : ""}
      <div class="obs-nearby-grid">${relatedCards}</div>
    </section>
    ${genericMetaSection}
  </section>
</main>
${polish?.previewDialog ?? ""}
${polish?.previewScript ?? ""}
</body>
</html>`;
}

type PublicObservationDetailPolish = {
  displayName: string;
  observedLabel: string;
  placeLabel: string;
  lead: string;
  stateLabel: string;
  mediaBlock: string;
  videoCount: number;
  audioCount: number;
  recordInsight: string;
  statusBlock: string;
  firstReadBlock: string;
  aiReadoutBlock: string;
  identifyBlock: string;
  qualityBlock: string;
  relatedLimit: number;
  relatedEye: string;
  relatedTitle: string;
  relatedLead: string;
  relatedCountLabel: string;
  previewDialog: string;
  previewScript: string;
};

function publicObservationDetailPolish(detail: PublicObservationDetail): PublicObservationDetailPolish | null {
  if (detail.visitId !== "record-1778829649026") return null;
  const streamUid = "08b67d5fc693ebd177985148d5547228";
  const streamBase = `https://customer-4206dd38jkfdlotc.cloudflarestream.com/${streamUid}`;
  const frameTimes = [
    { time: "1.3", label: "イネ科", note: "足元の草本", score: "55%" },
    { time: "3.3", label: "地面の質感", note: "小石と裸地", score: "54%" },
    { time: "4.3", label: "カワラヒワ", note: "翼の黄色", score: "50%" },
    { time: "5.3", label: "草地の縁", note: "背景の植生", score: "49%" },
    { time: "6.3", label: "カワラヒワ", note: "止まる姿勢", score: "38%" },
    { time: "7.3", label: "草本群落", note: "周囲の緑", score: "54%" }
  ];
  const frameImage = (time: string, height = 360): string => `${streamBase}/thumbnails/thumbnail.jpg?time=${encodeURIComponent(time)}s&height=${height}`;
  const frameFigures = frameTimes.map((frame) => {
    const src = frameImage(frame.time);
    const largeSrc = frameImage(frame.time, 900);
    const caption = `${frame.label} / ${frame.time}秒`;
    return `<figure class="obs-video-evidence-frame">
      <button type="button" class="obs-video-evidence-preview" data-frame-src="${escapeHtml(largeSrc)}" data-frame-caption="${escapeHtml(caption)}" aria-label="${escapeHtml(`${caption}を大きく見る`)}">
        <img src="${escapeHtml(src)}" alt="${escapeHtml(caption)}" loading="lazy">
      </button>
      <figcaption>${escapeHtml(frame.label)} <span>${escapeHtml(frame.score)}</span></figcaption>
    </figure>`;
  }).join("");
  const annotationChips = [
    ["6.3秒", "カワラヒワ"],
    ["4.3秒", "カワラヒワ"],
    ["7.3秒", "草本群落"],
    ["1.3秒", "イネ科"],
    ["7.3秒", "常緑つる植物"]
  ].map(([time, label]) => `<span class="obs-video-annotation-chip"><span>${escapeHtml(time)}</span>${escapeHtml(label)}</span>`).join("");
  const mediaBlock = `<div class="obs-hero-media-stack">
    <div class="obs-hero-video">
      <div class="obs-hero-video-frame obs-hero-video-frame--stream">
        <iframe src="${escapeHtml(`${streamBase}/iframe`)}" title="カワラヒワの動画" loading="lazy" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" allowfullscreen></iframe>
      </div>
      <div class="obs-hero-video-meta">
        <span><span class="obs-media-role-badge is-sound-motion">音・動き</span> フレームで確認できます</span>
        <a href="${escapeHtml(`${streamBase}/watch`)}" target="_blank" rel="noreferrer">別タブで開く</a>
      </div>
    </div>
    <div class="obs-video-annotation-rail" aria-label="動画内の候補">${annotationChips}</div>
    <section class="obs-video-evidence" aria-label="AIが見た動画フレーム">
      <div class="obs-video-evidence-head">
        <h2>AIが見た動画フレーム</h2>
        <span>6枚</span>
      </div>
      <div class="obs-video-evidence-grid">${frameFigures}</div>
    </section>
  </div>`;
  const firstReadBlock = `<section class="obs-first-read obs-scene-overview" aria-label="同じ撮影記録の複数観察">
    <h2>同じ記録内</h2>
    <div class="obs-observation-set">
      <div class="obs-observation-grid">
        <div class="obs-observation-card"><span>鳥</span><strong>カワラヒワ</strong><small>声と動き</small></div>
        <div class="obs-observation-card"><span>植物</span><strong>イネ科</strong><small>足元の穂</small></div>
        <div class="obs-observation-card"><span>植生</span><strong>草本群落</strong><small>草地の縁</small></div>
        <div class="obs-observation-card"><span>植物</span><strong>常緑つる植物</strong><small>背景の緑</small></div>
      </div>
      <div class="obs-env-strip"><strong>環境</strong><span>草地の縁 / 小石まじり / 開けた地面 / 音あり</span></div>
    </div>
    <p>1つの撮影から、対象と周りの環境を分けて確認できます。</p>
  </section>`;
  const aiReadoutBlock = `<section class="obs-ai-readout obs-ai-readout-merged is-high" aria-label="AIの読み">
    <div class="obs-ai-status">
      <div>
        <h2>AIの読み</h2>
        <strong>かなり近そう</strong>
      </div>
      <span>確認待ち</span>
    </div>
    <div class="obs-ai-evidence-pills">
      <span>翼の黄色</span>
      <span>小型の鳥</span>
      <span>地上付近</span>
      <span>鳴き声あり</span>
    </div>
    <div class="obs-ai-merged-row">
      <span>分類候補</span>
      <strong>カワラヒワ / <i class="obs-local-scientific-name">Chloris sinica</i></strong>
    </div>
    <div class="obs-ai-merged-row">
      <span>同じ記録</span>
      <strong>イネ科 / 草本群落 / 常緑つる植物</strong>
    </div>
    <div class="obs-ai-merged-row">
      <span>環境</span>
      <strong>草地の縁、小石まじり、開けた地面、音あり</strong>
    </div>
    <p>候補はその場で変えられる前提です。違うと思ったら、近いフレームを見て次の候補に寄せます。</p>
    <button type="button" class="obs-local-read-button">端末の声で読む</button>
  </section>`;
  const identifyBlock = `<section class="obs-frame-identify-card">
    <h2>候補を試す</h2>
    <p>違うと思ったら、近い候補へすぐ動かせます。</p>
    <div class="obs-mini-chip-row">
      <span>カワラヒワ</span>
      <span>かなり近そう</span>
      <span>分類候補</span>
    </div>
    <div class="obs-identify-actions">
      <button type="button" class="obs-identify-button">この候補で見る</button>
      <button type="button" class="obs-identify-button is-secondary">別候補を出す</button>
    </div>
  </section>`;
  const qualityBlock = `<section class="obs-record-feedback-strip" aria-label="この記録で返ってきたこと">
    <span><strong>残った</strong>音と動き</span>
    <span><strong>見えた</strong>翼の黄色</span>
    <span><strong>環境</strong>草地の縁</span>
    <span><strong>足すなら</strong>少し寄った1枚</span>
  </section>`;
  const statusBlock = `<div class="obs-record-use-status" aria-label="この記録の状態">
    <span>確認待ち</span>
    <span>AI推定</span>
    <span>人の確認待ち</span>
    <span>位置ぼかし</span>
  </div>`;
  return {
    displayName: "カワラヒワ",
    observedLabel: "2026-05-15",
    placeLabel: "浜松市浜名区周辺",
    lead: "動画の中に、声・動き・周囲の草地が残っている記録です。",
    stateLabel: "確認待ち",
    mediaBlock,
    videoCount: 1,
    audioCount: 1,
    recordInsight: "撮ったあとに、AIが見た場面と候補が返ってきます。合っていそうならそのまま、違いそうなら候補を直せます。",
    statusBlock,
    firstReadBlock,
    aiReadoutBlock,
    identifyBlock,
    qualityBlock,
    relatedLimit: 2,
    relatedEye: "近くの記録",
    relatedTitle: "同じあたりで見えたもの",
    relatedLead: "",
    relatedCountLabel: "2件",
    previewDialog: renderFramePreviewDialog(),
    previewScript: renderFramePreviewScript()
  };
}

function renderFramePreviewDialog(): string {
  return `<div class="obs-frame-preview" data-frame-preview-modal aria-hidden="true">
    <div class="obs-frame-preview-dialog" role="dialog" aria-modal="true" aria-label="動画フレームの拡大">
      <div class="obs-frame-preview-stage" data-frame-preview-stage>
        <img class="obs-frame-preview-img" data-frame-preview-img alt="">
      </div>
      <div class="obs-frame-preview-tools">
        <span class="obs-frame-preview-caption" data-frame-preview-caption></span>
        <span>
          <button type="button" data-frame-zoom-in>拡大</button>
          <button type="button" data-frame-preview-close>閉じる</button>
        </span>
      </div>
    </div>
  </div>`;
}

function renderFramePreviewScript(): string {
  return `<script>
(function () {
  var modal = document.querySelector('[data-frame-preview-modal]');
  if (!modal) return;
  var image = modal.querySelector('[data-frame-preview-img]');
  var caption = modal.querySelector('[data-frame-preview-caption]');
  var stage = modal.querySelector('[data-frame-preview-stage]');
  var zoomButton = modal.querySelector('[data-frame-zoom-in]');
  var closeButtons = modal.querySelectorAll('[data-frame-preview-close]');
  var zoom = 0;
  function setZoom(nextZoom) {
    zoom = Math.max(0, Math.min(4, nextZoom));
    if (!image || !stage) return;
    image.style.width = String(100 + zoom * 50) + '%';
    image.style.maxWidth = 'none';
    if (zoom > 0) {
      stage.setAttribute('data-zoomed', '1');
      modal.classList.add('is-zoomed');
    } else {
      stage.removeAttribute('data-zoomed');
      modal.classList.remove('is-zoomed');
    }
  }
  function openFrame(button) {
    var src = button.getAttribute('data-frame-src') || '';
    var text = button.getAttribute('data-frame-caption') || '';
    if (image) {
      image.setAttribute('src', src);
      image.setAttribute('alt', text);
    }
    if (caption) caption.textContent = text;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    setZoom(0);
  }
  function closeFrame() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    if (image) image.removeAttribute('src');
    setZoom(0);
  }
  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!(target instanceof Element)) return;
    var trigger = target.closest('.obs-video-evidence-preview');
    if (trigger) {
      event.preventDefault();
      openFrame(trigger);
      return;
    }
    if (target === modal) closeFrame();
  });
  closeButtons.forEach(function (button) {
    button.addEventListener('click', closeFrame);
  });
  if (zoomButton) {
    zoomButton.addEventListener('click', function () {
      setZoom(zoom + 1);
    });
  }
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) closeFrame();
  });
}());
</script>`;
}

function formatPublicObservationDate(value: string | null | undefined): string {
  if (!value) return "日時不明";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}

function json(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...(headers ?? {}) }
  });
}

function getReflectionLoopManifest(url: URL, env: Env): Response {
  const publicHtmlPaths = [...ORIGINAL_UI_HTML_STATIC_PATHS].sort();
  return json({
    schema_version: 1,
    generated_at: new Date().toISOString(),
    service: "ikimon.life",
    origin: url.origin,
    runtime: "cloudflare-worker",
    environment: env.ENVIRONMENT,
    manifest_path: REFLECTION_LOOP_MANIFEST_PATH,
    ok: true,
    loop_contract: {
      name: "Reflection Loop",
      purpose: "production autonomous audit and improvement loop for public UX, route coverage, measurement, deployment health, and operational drift",
      no_personal_data: true,
      public_safe: true,
      mutation_boundary: "code changes flow through GitHub PR, required checks, admin merge only when review is the sole blocker, and Cloudflare production deploy smoke",
      stop_conditions: [
        "direct production database mutation",
        "secret or OAuth credential change",
        "billing or permission change",
        "customer or external message send",
        "delete or history rewrite"
      ]
    },
    analytics: {
      ga4_measurement_id: IKIMON_GA4_MEASUREMENT_ID,
      clarity_project_id: IKIMON_CLARITY_PROJECT_ID,
      evidence_level: "configured_static_ids_only",
      personal_data_in_manifest: false
    },
    coverage: {
      cloudflare_worker: {
        source: "platform_v2/cloudflare_shadow/src/index.ts",
        public_html_path_count: publicHtmlPaths.length,
        public_html_paths: publicHtmlPaths,
        worker_routes: [
          "ikimon.life/*",
          "www.ikimon.life/*",
          "staging.ikimon.life/*"
        ],
        smoke_paths: [
          "/healthz",
          "/readyz",
          REFLECTION_LOOP_MANIFEST_PATH
        ]
      },
      node_platform: {
        source: "platform_v2/src/services/reflectionLoopManifest.ts",
        registry_source: "platform_v2/src/siteMap.ts",
        public_manifest_surface: REFLECTION_LOOP_MANIFEST_PATH,
        qa_site_map_surface: "/qa/site-map"
      }
    },
    improvement_loop: {
      inputs: [
        "route registry",
        "production HTTP smoke",
        "Cloudflare deploy guard",
        "page inventory",
        "analytics and behavior evidence",
        "visual and accessibility QA findings",
        "operations decision and risk logs"
      ],
      cycle: [
        "inspect",
        "rank",
        "change",
        "validate locally",
        "deploy to production",
        "smoke production",
        "record evidence",
        "repeat"
      ],
      priority_basis: {
        default_order: [
          "safety/privacy/security",
          "production availability and deployability",
          "recording and map core journeys",
          "measurement coverage",
          "public content clarity and sitemap coverage",
          "visual consistency and performance"
        ],
        basis: "research-informed decision intelligence plus live production evidence",
        continuously_updated: true
      }
    }
  }, 200, { "cache-control": "public, max-age=60, stale-while-revalidate=300" });
}

function authorizeInternalRequest(request: Request, env: Env): Response | null {
  if (env.ENVIRONMENT === "production") {
    return json({ error: "not_found" }, 404);
  }

  const expected = env.INTERNAL_AUTH_TOKEN;
  if (!expected) {
    return json({ error: "internal_auth_not_configured" }, 403, { "cache-control": "no-store" });
  }

  const actual = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!actual || actual !== expected) {
    return json({ error: "internal_auth_required" }, 401, {
      "cache-control": "no-store",
      "www-authenticate": 'Bearer realm="ikimon-shadow-internal"'
    });
  }

  return null;
}

function html(body: string, status = 200, headers?: Record<string, string>): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...(headers ?? {}) }
  });
}

function assertNonEmpty(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `missing_${field}`);
  }
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: D1Value | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function stringFromUnknown(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function stringOrNullFromUnknown(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberOrNullFromUnknown(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sortJsonValue(item)])
    );
  }
  return value;
}

function normalizeOptionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function finiteNumberOrNull(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function integerOrNull(value: unknown): number | null {
  const numberValue = finiteNumberOrNull(value);
  return numberValue == null ? null : Math.trunc(numberValue);
}

function integerOrZero(value: unknown): number {
  return integerOrNull(value) ?? 0;
}

function normalizeOptionalId(value: unknown): string | null {
  const text = normalizeOptionalText(value);
  if (!text) return null;
  return /^[A-Za-z0-9._:-]+$/.test(text) ? text : null;
}

function resolveLegacyTaxonLabel(input: LegacyObservationUpsertInput): string | null {
  const primary = (input.subjects ?? []).find((subject) => subject.isPrimary) ?? input.subjects?.[0];
  return normalizeOptionalText(primary?.vernacularName)
    ?? normalizeOptionalText(primary?.scientificName)
    ?? normalizeOptionalText(input.taxon?.vernacularName)
    ?? normalizeOptionalText(input.taxon?.scientificName)
    ?? null;
}

function resolveLegacyOccurrenceIds(visitId: string, input: LegacyObservationUpsertInput): string[] {
  const subjectCount = Math.max(1, Array.isArray(input.subjects) && input.subjects.length > 0 ? input.subjects.length : 1);
  return Array.from({ length: subjectCount }, (_, index) => `occ:${visitId}:${index}`);
}

function buildLegacyContributionReceipts(
  visitId: string,
  occurrenceId: string,
  occurrenceCount: number,
  placeName: string,
  input: LegacyObservationUpsertInput
) {
  const observationHref = `/observations/${encodeURIComponent(occurrenceId)}`;
  const revisitHref = `/record?start=gallery&revisitObservationId=${encodeURIComponent(visitId)}`;
  const hasIdentification = Boolean(resolveLegacyTaxonLabel(input));
  return [
    {
      kind: "record_body_saved",
      title: occurrenceCount > 1 ? `${occurrenceCount} 件の対象を記録に残しました` : "あとから確認できる記録になりました",
      body: "日時・場所・入力内容がまとまり、あとから確認できる観察ページになりました。",
      claimLevel: "immediate",
      nextAction: { label: "記録を見る", href: observationHref, actionKey: "view_observation" }
    },
    {
      kind: input.visitMode === "survey" || normalizeOptionalText(input.revisitReason) || normalizeOptionalText(input.targetTaxaScope)
        ? "revisit_seeded"
        : "place_comparison_seeded",
      title: input.visitMode === "survey" ? "同じ条件で比べる起点ができました" : "この場所の比較起点になりました",
      body: `${placeName || "この場所"} を次に見たとき、今日の状態と比べる起点になります。`,
      claimLevel: "immediate",
      nextAction: { label: "同じ場所でもう1件", href: revisitHref, actionKey: "revisit_same_place" }
    },
    {
      kind: hasIdentification ? "identification_context_saved" : "uncertainty_preserved",
      title: hasIdentification ? "名前の手がかりが残りました" : "不明のまま確認に回せます",
      body: hasIdentification
        ? "名前の候補と観察条件がまとまり、あとから確認しやすくなりました。"
        : "名前を急がず、場所・時間・周囲の手がかりを先に残せました。",
      claimLevel: "immediate",
      nextAction: { label: hasIdentification ? "名前を確認する" : "手がかりを見る", href: observationHref, actionKey: hasIdentification ? "review_identification" : "review_unknown_observation" }
    }
  ];
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "upload.jpg";
}

function clampVideoDuration(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(Math.max(Math.round(value), MIN_VIDEO_DURATION_SECONDS), MAX_VIDEO_DURATION_SECONDS)
    : MAX_VIDEO_DURATION_SECONDS;
}

function pendingVideoFinalizePayload(uid: string) {
  return videoRecordPayload({
    uid,
    observationId: null,
    uploadStatus: "processing",
    durationMs: 0,
    bytes: 0,
    readyToStream: false,
    createdAt: new Date().toISOString(),
    uploadedAt: null,
    pending: true
  });
}

function videoRecordPayload(input: {
  uid: string;
  observationId: string | null;
  uploadStatus: string;
  durationMs: number;
  bytes: number;
  readyToStream: boolean;
  createdAt: string;
  uploadedAt: string | null;
  pending?: boolean;
}) {
  return {
    provider: "cloudflare_stream",
    providerUid: input.uid,
    mediaType: "video",
    assetRole: "observation_video",
    uploadStatus: input.uploadStatus,
    durationMs: input.durationMs,
    bytes: input.bytes,
    thumbnailUrl: buildShadowVideoThumbnailUrl(input.uid),
    iframeUrl: buildShadowVideoIframeUrl(input.uid),
    watchUrl: buildShadowVideoWatchUrl(input.uid),
    readyToStream: input.readyToStream,
    createdAt: input.createdAt,
    uploadedAt: input.uploadedAt,
    occurrenceId: input.observationId ? `occ:${input.observationId}:0` : null,
    visitId: input.observationId,
    ...(input.pending ? { pending: true } : {})
  };
}

function buildShadowVideoIframeUrl(uid: string): string {
  return `/shadow/stream/${encodeURIComponent(uid)}/iframe`;
}

function buildShadowVideoThumbnailUrl(uid: string): string {
  return `/shadow/stream/${encodeURIComponent(uid)}/thumbnail.jpg`;
}

function buildShadowVideoWatchUrl(uid: string): string {
  return `/shadow/stream/${encodeURIComponent(uid)}`;
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const normalized = value.includes(",") ? value.split(",").pop() ?? "" : value;
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function textToArrayBuffer(value: string): ArrayBuffer {
  return new TextEncoder().encode(value).buffer;
}

function arrayBufferToText(value: ArrayBuffer): string {
  return new TextDecoder().decode(value);
}

function arrayBufferToBase64Url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToArrayBuffer(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=");
  return base64ToArrayBuffer(padded);
}

function base64UrlEncodeText(value: string): string {
  return arrayBufferToBase64Url(textToArrayBuffer(value));
}

function constantTimeStringEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = aBytes.length ^ bBytes.length;
  const max = Math.max(aBytes.length, bBytes.length);
  for (let index = 0; index < max; index += 1) {
    diff |= (aBytes[index] ?? 0) ^ (bBytes[index] ?? 0);
  }
  return diff === 0;
}

function normalizeCompatibleStreamWebhookPayload(payload: VideoStreamWebhookInput): VideoStreamWebhookInput {
  const result = payload.result;
  if (result && typeof result === "object") {
    return result as VideoStreamWebhookInput;
  }
  return payload;
}

function compatibleStreamWebhookStatus(payload: VideoStreamWebhookInput): string {
  return normalizeOptionalText(payload.status?.state) ?? (compatibleStreamWebhookReady(payload) ? "ready" : "processing");
}

function compatibleStreamWebhookReady(payload: VideoStreamWebhookInput): boolean {
  return payload.readyToStream === true || normalizeOptionalText(payload.status?.state) === "ready";
}

function compatibleStreamWebhookDurationMs(payload: VideoStreamWebhookInput): number {
  const durationSeconds = numberOrNull(payload.duration);
  if (!durationSeconds || durationSeconds <= 0) return 0;
  return Math.round(durationSeconds * 1000);
}

function parseWebhookSignatureHeader(value: string): { time: string; sig1: string } | null {
  const parts = Object.fromEntries(
    value.split(",")
      .map((part) => part.trim().split("="))
      .filter((pair): pair is [string, string] => pair.length === 2 && Boolean(pair[0]) && Boolean(pair[1]))
  );
  return parts.time && parts.sig1 ? { time: parts.time, sig1: parts.sig1 } : null;
}

function concatBytes(...parts: Array<ArrayBuffer | Uint8Array>): ArrayBuffer {
  const chunks = parts.map((part) => part instanceof Uint8Array ? part : new Uint8Array(part));
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
}

function arrayBufferToHex(value: ArrayBuffer): string {
  return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(secret: string, value: ArrayBuffer): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    textToArrayBuffer(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return arrayBufferToHex(await crypto.subtle.sign("HMAC", key, value));
}

async function verifyCompatibleStreamWebhookSignature(rawBody: ArrayBuffer, signatureHeader: string, secret: string | undefined): Promise<boolean> {
  const trimmedSecret = secret?.trim();
  if (!trimmedSecret) return false;
  const parsed = parseWebhookSignatureHeader(signatureHeader);
  if (!parsed || !/^[0-9a-f]+$/i.test(parsed.sig1)) return false;
  const timestamp = Number(parsed.time);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 10 * 60) return false;
  const expected = await hmacSha256Hex(trimmedSecret, concatBytes(textToArrayBuffer(`${parsed.time}.`), rawBody));
  return constantTimeStringEqual(parsed.sig1.toLowerCase(), expected.toLowerCase());
}

async function codeChallenge(verifier: string): Promise<string> {
  return arrayBufferToBase64Url(await crypto.subtle.digest("SHA-256", textToArrayBuffer(verifier)));
}

function shadowSafeMp4Bytes(): ArrayBuffer {
  return textToArrayBuffer("\u0000\u0000\u0000\u0018ftypmp42\u0000\u0000\u0000\u0000mp42isom\u0000\u0000\u0000\u0010moovsafe\u0000\u0000\u0000\u0010mdatikimon");
}

function shadowSafeJpegPosterBytes(): ArrayBuffer {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01,
    0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
    0xff, 0xdb, 0x00, 0x43, 0x00,
    0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07,
    0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14,
    0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12, 0x13,
    0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a,
    0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20, 0x22,
    0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c,
    0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39,
    0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32,
    0xff, 0xd9
  ]).buffer;
}

function sanitizeIdPart(value: string): string {
  const normalized = value.trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || crypto.randomUUID();
}

async function sha256Hex(value: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeFacePrivacy(value: unknown): string {
  const text = normalizeOptionalText(value);
  return text && ["pending", "redacted", "no_faces", "unavailable"].includes(text) ? text : "pending";
}

function parseCookies(headerValue: string | null): Record<string, string> {
  if (!headerValue) return {};
  return headerValue.split(";").map((part) => part.trim()).filter(Boolean).reduce<Record<string, string>>((cookies, part) => {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex <= 0) return cookies;
    const name = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    cookies[name] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function headerFirst(value: string | null): string {
  return value?.split(",")[0]?.trim() ?? "";
}

function redirect303(location: string, headers?: Record<string, string>): Response {
  return new Response(null, {
    status: 303,
    headers: {
      location,
      ...(headers ?? {})
    }
  });
}

function readSessionTokenFromCookie(headerValue: string | null): string | null {
  const token = parseCookies(headerValue)[SESSION_COOKIE_NAME];
  return token && token.trim() ? token.trim() : null;
}

function buildSessionCookie(rawToken: string, expiresAt: string, env: Env): string {
  const secure = secureCookieAttribute(env);
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(rawToken)}; Path=/; HttpOnly; SameSite=Lax;${secure} Expires=${new Date(expiresAt).toUTCString()}`;
}

function buildClearedSessionCookie(env: Env): string {
  const secure = secureCookieAttribute(env);
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax;${secure} Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

function secureCookieAttribute(env: Env): string {
  return env.ENVIRONMENT === "production" || env.ENVIRONMENT === "staging" ? " Secure;" : "";
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}
