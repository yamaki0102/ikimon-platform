import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
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

interface ProductionImportEvidenceAssetRow {
  asset_id: string;
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
  trigger_kind: string;
  channel: string;
  delivered_at: string | null;
  delivery_status: string;
  payload_json: string;
  acknowledged_at: string | null;
  created_at: string | null;
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

class FakeD1 {
  users = new Set<string>();
  authUsers = new Map<string, AuthUserRow>();
  oauthAccounts = new Map<string, OAuthAccountRow>();
  areaSubscriptions = new Map<string, AreaSubscriptionRow>();
  areaSubscriptionStats = new Map<string, AreaSubscriptionStatsRow>();
  alertDeliveries = new Map<string, AlertDeliveryRow>();
  taxonAlertSubscriptions = new Map<string, TaxonAlertSubscriptionRow>();
  drafts = new Map<string, DraftRow>();
  observations = new Map<string, ObservationRow>();
  assets = new Map<string, AssetRow>();
  outbox = new Map<string, OutboxRow>();
  rollbackLedger = new Map<string, RollbackLedgerRow>();
  readmodel = new Map<string, { observation_id: string; public_cell: string; observed_at: string; taxon_label: string | null; asset_count: number; partition_month: string | null }>();
  parityRuns = new Map<string, ParityRunRow>();
  parityMetrics: ParityMetricRow[] = [];
  operationAudit: OperationAuditRow[] = [];
  authSessions = new Map<string, AuthSessionRow>();
  videoUploads = new Map<string, VideoUploadRow>();
  legacyAssetImports: LegacyAssetImportRow[] = [];
  legacyR2Imports: LegacyR2ImportRow[] = [];
  legacyStreamInventory: LegacyStreamInventoryRow[] = [];
  productionPublicReadmodel = new Map<string, ProductionImportPublicReadmodelRow>();
  productionEvidenceAssets: ProductionImportEvidenceAssetRow[] = [];
  productionFieldDetails = new Map<string, ProductionFieldDetailReadmodelRow>();
  productionAreaPolygons = new Map<string, ProductionAreaPolygonReadmodelRow>();
  municipalWalkMaps = new Map<string, MunicipalWalkMapD1Row>();
  publicMapSnapshotRecords: PublicMapSnapshotRecordRow[] = [];
  publicMapSnapshotMeta: PublicMapSnapshotMetaRow | null = null;

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

    if (normalized.startsWith("UPDATE auth_users SET last_login_at")) {
      const userId = string(v[0]);
      const row = [...this.db.authUsers.values()].find((candidate) => candidate.user_id === userId);
      if (row) row.last_login_at = new Date().toISOString();
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
        operation_type: "origin_fallback",
        target_id: string(v[1]),
        payload_json: string(v[2]),
        created_at: new Date(Date.now() + this.db.operationAudit.length).toISOString()
      });
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

    throw new Error(`Unhandled SQL run: ${this.query}`);
  }

  async first<T>(): Promise<T | null> {
    const normalized = normalize(this.query);
    if (normalized === "SELECT 1 AS ok") {
      return ({ ok: 1 } as T);
    }

    const v = this.values;

    if (normalized.startsWith("SELECT object_key, mime FROM asset_ledger")) {
      const asset = this.db.assets.get(string(v[0]));
      return asset ? ({ object_key: asset.object_key, mime: asset.mime } as T) : null;
    }

    if (normalized.startsWith("SELECT user_id, email, password_hash, display_name, role_name, rank_label, banned FROM auth_users")) {
      return (this.db.authUsers.get(string(v[0]).toLowerCase()) as T | undefined) ?? null;
    }

    if (normalized.startsWith("SELECT user_id, provider, provider_user_id, provider_email, display_name, role_name, rank_label, banned FROM oauth_accounts")) {
      return (this.db.oauthAccounts.get(`${string(v[0])}:${string(v[1])}`) as T | undefined) ?? null;
    }

    if (normalized.startsWith("SELECT * FROM draft_observations")) {
      return (this.db.drafts.get(string(v[0])) as T | undefined) ?? null;
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

    if (normalized.startsWith("SELECT COUNT(*) AS unread_count FROM alert_deliveries")) {
      const count = [...this.db.alertDeliveries.values()]
        .filter((row) => row.user_id === string(v[0]) && row.acknowledged_at === null)
        .length;
      return ({ unread_count: count } as T);
    }

    throw new Error(`Unhandled SQL first: ${this.query}`);
  }

  async all<T>(): Promise<{ results: T[] }> {
    const normalized = normalize(this.query);
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
          asset.public_derivative_metadata_json
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
    if (normalized.startsWith("SELECT observation_id, public_derivative_key FROM asset_ledger")) {
      const rows = [...this.db.assets.values()]
        .filter((asset) =>
          asset.observation_id &&
          asset.processing_state === "uploaded" &&
          asset.public_derivative_key &&
          asset.exif_scrub_state === "scrubbed" &&
          asset.public_ready_at &&
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
    if (normalized.startsWith("SELECT field_id, source, admin_level, name, name_kana, summary, prefecture, city")) {
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
      PUBLIC_WRITE_MODE: "origin_fallback"
    },
    core,
    obs,
    queue
  };
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

test("production map area polygons use filtered origin geometry while guide spots stay native", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const originalFetch = globalThis.fetch;
  const seen: Array<{ url: string; method?: string; reason: string | null; resolveOverride?: string }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    seen.push({
      url: String(input),
      method: init?.method,
      reason: headers.get("x-ikimon-cloudflare-fallback-reason"),
      resolveOverride: (init as RequestInit & { cf?: { resolveOverride?: string } } | undefined)?.cf?.resolveOverride
    });
    return new Response(JSON.stringify({
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [[[137.70, 34.70], [137.71, 34.70], [137.71, 34.71], [137.70, 34.71], [137.70, 34.70]]] },
        properties: { field_id: "field-origin", name: "origin area", source: "osm_park" }
      }]
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const cellsResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/map/cells?bbox=137.70,34.70,137.82,34.72&zoom=13"), productionEnv);
    assert.equal(cellsResponse.ok, true);
    assert.equal(seen.length, 0);

    const areaResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/map/area-polygons?bbox=137.70,34.70,137.82,34.72&zoom=17.5"), productionEnv);
    const areaPayload = await areaResponse.json() as any;
    assert.equal(areaResponse.ok, true, JSON.stringify(areaPayload));
    assert.equal(areaPayload.features.length, 1);
    assert.equal(areaPayload.features[0].properties.name, "origin area");

    const guideResponse = await worker.fetch(new Request("https://ikimon.life/api/v1/map/guide-spots?bbox=137.70,34.70,137.82,34.72"), productionEnv);
    assert.equal(guideResponse.ok, true);

    assert.deepEqual(seen.map((item) => item.url), [
      "https://ikimon.life/api/v1/map/area-polygons?bbox=137.70%2C34.70%2C137.82%2C34.72&zoom=17.5&limit=72"
    ]);
    assert.deepEqual(seen.map((item) => item.reason), [
      "map_area_polygons_origin_geometry"
    ]);
    assert.deepEqual(seen.map((item) => item.resolveOverride), ["origin.ikimon.test"]);
    assert.equal(core.operationAudit.length, 1);
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
  assert.match(jsonPayload.observation.photoAssets[0].url, /^\/derived\/v1-compat\/visit-detail-contract\/asset_/);
  assert.doesNotMatch(JSON.stringify(jsonPayload), /ownerUserId|observerUserId|observerName|profile|34\.71234|137\.81234/);

  const localizedJsonResponse = await worker.fetch(new Request("https://shadow.test/ja/api/v1/observations/visit-detail-contract/public-detail"), env);
  const localizedJsonPayload = await localizedJsonResponse.json() as any;
  assert.equal(localizedJsonResponse.ok, true, JSON.stringify(localizedJsonPayload));
  assert.equal(localizedJsonPayload.observation.visitId, "visit-detail-contract");

  const imageResponse = await worker.fetch(new Request(`https://shadow.test${jsonPayload.observation.photoAssets[0].url}`), env);
  const imageBody = await imageResponse.text();
  assert.equal(imageResponse.ok, true, imageBody);
  assert.match(imageResponse.headers.get("content-type") ?? "", /image\/svg\+xml/);
  assert.match(imageBody, /shadow public derivative/);

  const pageResponse = await worker.fetch(new Request("https://shadow.test/observations/visit-detail-contract"), env);
  const pageHtml = await pageResponse.text();
  assert.equal(pageResponse.ok, true, pageHtml);
  assert.match(pageHtml, /data-cloudflare-observation-detail="1"/);
  assert.match(pageHtml, /obs-reading-hero/);
  assert.match(pageHtml, /obs-read-progress/);
  assert.match(pageHtml, /obs-media-ledger/);
  assert.match(pageHtml, /obs-action-rail/);
  assert.match(pageHtml, /obs-reading-flow/);
  assert.match(pageHtml, /obs-record-story/);
  assert.match(pageHtml, /obs-local-quality-inline is-full-width/);
  assert.match(pageHtml, /obs-area-records/);
  assert.match(pageHtml, /詳細テスト植物/);
  assert.match(pageHtml, /ぼかし表示/);
  assert.match(pageHtml, /精密な座標/);
  assert.doesNotMatch(pageHtml, /cell:34\.71,137\.81|公開セル|セル単位/);
  assert.doesNotMatch(pageHtml, /ikimon shadow|data-shadow-observation-detail|ownerUserId|observerUserId|profile\/detail-user|34\.71234|137\.81234/);

  const localizedPageResponse = await worker.fetch(new Request("https://shadow.test/ja/observations/visit-detail-contract"), env);
  const localizedPageHtml = await localizedPageResponse.text();
  assert.equal(localizedPageResponse.ok, true, localizedPageHtml);
  assert.match(localizedPageHtml, /data-cloudflare-observation-detail="1"/);
  assert.match(localizedPageHtml, /obs-reading-hero/);
  assert.match(localizedPageHtml, /obs-media-ledger/);
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

test("production auth login falls back to origin until auth users are fully imported", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    PUBLIC_WRITE_MODE: "cloudflare_native",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const originalFetch = globalThis.fetch;
  const seen: { url?: string; method?: string; resolveOverride?: string; body?: string; reason?: string | null } = {};
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.url = String(input);
    seen.method = init?.method;
    seen.resolveOverride = (init as RequestInit & { cf?: { resolveOverride?: string } } | undefined)?.cf?.resolveOverride;
    const headers = new Headers(init?.headers);
    seen.reason = headers.get("x-ikimon-cloudflare-fallback-reason");
    seen.body = init?.body ? await new Response(init.body).text() : undefined;
    return new Response(JSON.stringify({ ok: true, redirect: "/record", originFallback: true }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "set-cookie": "ikimon_v2_session=origin-token; Path=/; HttpOnly; SameSite=Lax"
      }
    });
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
    assert.equal(response.ok, true, JSON.stringify(payload));
    assert.equal(payload.originFallback, true);
    assert.equal(response.headers.get("set-cookie"), "ikimon_v2_session=origin-token; Path=/; HttpOnly; SameSite=Lax");
    assert.equal(seen.url, "https://ikimon.life/api/v1/auth/login");
    assert.equal(seen.method, "POST");
    assert.equal(seen.resolveOverride, "origin.ikimon.test");
    assert.equal(seen.reason, "auth_d1_miss_or_mismatch");
    assert.equal(seen.body, JSON.stringify(body));
    assert.equal(core.operationAudit.length, 1);
    const telemetry = JSON.parse(core.operationAudit[0]?.payload_json ?? "{}");
    assert.equal(telemetry.reason, "auth_d1_miss_or_mismatch");
    assert.equal(telemetry.routePattern, "/api/v1/auth/login");
    assert.equal(JSON.stringify(telemetry).includes("not-yet-imported@example.test"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
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

test("production runtime proxies unsupported observation API paths to the configured origin fallback", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const originalFetch = globalThis.fetch;
  const seen: { url?: string; method?: string; cookie?: string; marker?: string; reason?: string | null; body?: string; resolveOverride?: string } = {};
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.url = String(input);
    seen.method = init?.method;
    seen.resolveOverride = (init as RequestInit & { cf?: { resolveOverride?: string } } | undefined)?.cf?.resolveOverride;
    const headers = new Headers(init?.headers);
    seen.cookie = headers.get("cookie") ?? undefined;
    seen.marker = headers.get("x-ikimon-cloudflare-fallback") ?? undefined;
    seen.reason = headers.get("x-ikimon-cloudflare-fallback-reason");
    seen.body = init?.body ? await new Response(init.body).text() : undefined;
    return new Response(JSON.stringify({ ok: true, originFallback: true }), {
      status: 202,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/api/v1/observations/example/reactions/like?keep=1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "ikimon_v2_session=test"
      },
      body: JSON.stringify({ source: "unit" })
    }), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.status, 202);
    assert.equal(payload.originFallback, true);
    assert.equal(seen.url, "https://ikimon.life/api/v1/observations/example/reactions/like?keep=1");
    assert.equal(seen.method, "POST");
    assert.equal(seen.resolveOverride, "origin.ikimon.test");
    assert.equal(seen.cookie, "ikimon_v2_session=test");
    assert.equal(seen.marker, "origin");
    assert.equal(seen.reason, "unsupported_observation_api");
    assert.equal(seen.body, JSON.stringify({ source: "unit" }));
    assert.equal(core.operationAudit.length, 1);
    const telemetry = JSON.parse(core.operationAudit[0]?.payload_json ?? "{}");
    assert.equal(telemetry.reason, "unsupported_observation_api");
    assert.equal(telemetry.routePattern, "/api/v1/observations/:id/*");
    assert.equal(JSON.stringify(telemetry).includes("example"), false);
    assert.equal(JSON.stringify(telemetry).includes("keep=1"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }

  const summaryEnv = {
    ...env,
    CORE_DB: core
  };
  const summaryResponse = await worker.fetch(internalRequest("/internal/origin-fallback-telemetry"), summaryEnv);
  const summary = await summaryResponse.json() as any;
  assert.equal(summaryResponse.ok, true, JSON.stringify(summary));
  assert.equal(summary.count, 1);
  assert.equal(summary.byReason.unsupported_observation_api, 1);
  assert.equal(summary.byRoutePattern["/api/v1/observations/:id/*"], 1);
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

test("production oauth start falls back to origin until provider secrets are configured", async () => {
  const { env } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  const originalFetch = globalThis.fetch;
  const seen: { url?: string; reason?: string | null; resolveOverride?: string } = {};
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.url = String(input);
    seen.reason = new Headers(init?.headers).get("x-ikimon-cloudflare-fallback-reason");
    seen.resolveOverride = (init as RequestInit & { cf?: { resolveOverride?: string } } | undefined)?.cf?.resolveOverride;
    return new Response(null, { status: 303, headers: { location: "https://accounts.google.com/o/oauth2/v2/auth?origin=1" } });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/auth/oauth/google/start?redirect=/record"), productionEnv);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "https://accounts.google.com/o/oauth2/v2/auth?origin=1");
    assert.equal(seen.url, "https://ikimon.life/auth/oauth/google/start?redirect=/record");
    assert.equal(seen.reason, "oauth_provider_not_configured");
    assert.equal(seen.resolveOverride, "origin.ikimon.test");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production full-domain fallback preserves original public UI routes without exposing internal routes", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
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
      "/community/fields/535cccb1-c3d1-4a35-ab9f-2ed811f5abb5",
      "/places/hamamatsu"
    ];
    const expectedFallbackReasons = new Map([
      ["/", "html_materialized_miss"],
      ["/record", "html_materialized_miss"],
      ["/map", "html_materialized_miss"],
      ["/login", "html_materialized_miss"],
      ["/community/fields/535cccb1-c3d1-4a35-ab9f-2ed811f5abb5", "html_materialized_miss"],
      ["/places/hamamatsu", "public_custom_domain_path"]
    ]);

    for (const path of publicUiRoutes) {
      const response = await worker.fetch(new Request(`https://ikimon.life${path}`), productionEnv);
      const body = await response.text();
      assert.equal(response.status, 200, path);
      assert.equal(body, "<!doctype html><title>origin UI</title><meta name=\"x-origin-ui\" content=\"1\">", path);
      assert.equal(body.includes("data-cloudflare-public-shell"), false, path);
      assert.equal(seen.at(-1)?.url, `https://ikimon.life${path}`);
      assert.equal(seen.at(-1)?.method, "GET", path);
      assert.equal(seen.at(-1)?.resolveOverride, "origin.ikimon.test", path);
      assert.equal(seen.at(-1)?.reason, expectedFallbackReasons.get(path), path);
    }

    const latestTelemetry = JSON.parse(core.operationAudit.at(-1)?.payload_json ?? "{}");
    assert.equal(latestTelemetry.routePattern, "/places/hamamatsu");
    assert.equal(JSON.stringify(latestTelemetry).includes("535cccb1"), false);

    const internal = await worker.fetch(new Request("https://ikimon.life/internal/production-import-summary"), productionEnv);
    assert.equal(internal.status, 404);
    assert.equal(seen.length, publicUiRoutes.length);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production map area polygons fall back to origin geometry with bounded display limit", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test",
    PUBLIC_WRITE_MODE: "cloudflare_native"
  };
  const seen: Array<{ url: string; resolveOverride?: string; reason?: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const target = typeof input === "string" || input instanceof URL ? String(input) : input.url;
    seen.push({
      url: target,
      resolveOverride: (init as RequestInit & { cf?: { resolveOverride?: string } } | undefined)?.cf?.resolveOverride,
      reason: new Headers(init?.headers).get("x-ikimon-cloudflare-fallback-reason") ?? undefined
    });
    return Response.json({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { field_id: "origin-school", name: "origin polygon school" },
          geometry: { type: "Polygon", coordinates: [[[137.1, 34.1], [137.2, 34.1], [137.2, 34.2], [137.1, 34.1]]] }
        },
        {
          type: "Feature",
          properties: {
            field_id: "origin-approx-school",
            name: "代表点小学校",
            source: "school",
            approximate_boundary: true,
            boundary_approximation: "point_buffer",
            verification_label: "境界未確認・代表点からの仮範囲 / 学校台帳と一致"
          },
          geometry: { type: "Polygon", coordinates: [[[137.1, 34.1], [137.2, 34.1], [137.2, 34.2], [137.1, 34.1]]] }
        },
        {
          type: "Feature",
          properties: {
            field_id: "osm-live:way:603994619",
            name: "OSMの学校・キャンパス",
            source: "school",
            verification_label: "未確認",
            source_confidence: 0.45
          },
          geometry: { type: "Polygon", coordinates: [[[137.1, 34.1], [137.2, 34.1], [137.2, 34.2], [137.1, 34.1]]] }
        },
        {
          type: "Feature",
          properties: {
            field_id: "osm-live:way:603028580",
            name: "OSMの公園・緑地",
            source: "osm_park",
            verification_label: "未確認",
            source_confidence: 0.45
          },
          geometry: { type: "Polygon", coordinates: [[[137.1, 34.1], [137.2, 34.1], [137.2, 34.2], [137.1, 34.1]]] }
        }
      ],
      truncated: true,
      stats: { totalReturned: 4, totalAll: 4, source: "origin" }
    }, { headers: { "cache-control": "public, max-age=60" } });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request(
      "https://ikimon.life/api/v1/map/area-polygons?bbox=137.65%2C34.66%2C137.76%2C34.73&zoom=14&sources=school%2Cosm_park"
    ), productionEnv);
    const payload = await response.json() as any;

    assert.equal(response.status, 200);
    assert.equal(payload.features.length, 1);
    assert.equal(payload.features[0].properties.name, "origin polygon school");
    assert.equal(payload.features[0].geometry.coordinates[0].length, 4);
    assert.equal(payload.stats.totalReturned, 1);
    assert.equal(payload.stats.totalAll, 1);
    assert.equal(seen.length, 1);
    assert.equal(seen[0]?.url, "https://ikimon.life/api/v1/map/area-polygons?bbox=137.65%2C34.66%2C137.76%2C34.73&zoom=14&sources=school%2Cosm_park&limit=48");
    assert.equal(seen[0]?.resolveOverride, "origin.ikimon.test");
    assert.equal(seen[0]?.reason, "map_area_polygons_origin_geometry");
    const latestTelemetry = JSON.parse(core.operationAudit.at(-1)?.payload_json ?? "{}");
    assert.equal(latestTelemetry.reason, "map_area_polygons_origin_geometry");
    assert.equal(latestTelemetry.routePattern, "/api/v1/map/area-polygons");

    seen.length = 0;
    const localizedResponse = await worker.fetch(new Request(
      "https://ikimon.life/ja/api/v1/map/area-polygons?bbox=137.65%2C34.66%2C137.76%2C34.73&zoom=14&sources=school%2Cosm_park"
    ), productionEnv);
    const localizedPayload = await localizedResponse.json() as any;
    assert.equal(localizedResponse.status, 200);
    assert.equal(localizedPayload.features.length, 1);
    assert.equal(localizedPayload.features[0].properties.name, "origin polygon school");
    assert.equal(localizedPayload.stats.totalReturned, 1);
    assert.equal(localizedPayload.stats.totalAll, 1);
    assert.equal(seen.length, 1);
    assert.equal(seen[0]?.url, "https://ikimon.life/ja/api/v1/map/area-polygons?bbox=137.65%2C34.66%2C137.76%2C34.73&zoom=14&sources=school%2Cosm_park&limit=48");
    assert.equal(seen[0]?.resolveOverride, "origin.ikimon.test");
    assert.equal(seen[0]?.reason, "map_area_polygons_origin_geometry");
    assert.doesNotMatch(JSON.stringify(localizedPayload), /origin-approx-school|OSMの学校・キャンパス|OSMの公園・緑地|境界未確認/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production map area polygons use native polygon readmodel before origin fallback", async () => {
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

test("production map area polygons fall back when requested school polygons are missing from native readmodel", async () => {
  const { env } = createEnv();
  env.OBS_DB.productionAreaPolygons.set("native-park-only", {
    field_id: "native-park-only",
    source: "osm_park",
    admin_level: "osm_park",
    name: "ネイティブ公園",
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
    source_confidence: 0.8,
    verification_level: "unverified",
    verification_label: "未確認",
    official_url: null,
    owner_url: null,
    story_url: null,
    certification_url: null,
    entity_key: "osm:way:park-only",
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
    return new Response(JSON.stringify({
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: {
          field_id: "origin-school",
          name: "origin fallback school",
          source: "school",
          source_confidence: 0.45,
          verification_level: "unverified"
        },
        geometry: { type: "Polygon", coordinates: [[[137.7, 34.69], [137.71, 34.69], [137.71, 34.70], [137.7, 34.69]]] }
      }],
      truncated: false,
      stats: { source: "origin" }
    }), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request(
      "https://ikimon.life/api/v1/map/area-polygons?bbox=137.65%2C34.66%2C137.76%2C34.73&zoom=14&sources=school%2Cosm_park"
    ), productionEnv);
    const payload = await response.json() as any;

    assert.equal(response.status, 200);
    assert.equal(fallbackCalls, 1);
    assert.equal(payload.features.length, 1);
    assert.equal(payload.features[0].properties.field_id, "origin-school");
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

test("production area snapshot falls back to origin when not materialized and records redacted telemetry", async () => {
  const { env, core } = createEnv();
  const fieldId = "535cccb1-c3d1-4a35-ab9f-2ed811f5abb5";
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const originalFetch = globalThis.fetch;
  const seen: { url?: string; reason?: string | null; resolveOverride?: string } = {};
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.url = String(input);
    seen.resolveOverride = (init as RequestInit & { cf?: { resolveOverride?: string } } | undefined)?.cf?.resolveOverride;
    seen.reason = new Headers(init?.headers).get("x-ikimon-cloudflare-fallback-reason");
    return Response.json({ snapshot: { field: { fieldId }, source: "origin" } });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request(`https://ikimon.life/api/v1/fields/${fieldId}/area-snapshot?viewer=1`), productionEnv);
    const payload = await response.json() as any;
    assert.equal(response.status, 200);
    assert.equal(payload.snapshot.source, "origin");
    assert.equal(seen.url, `https://ikimon.life/api/v1/fields/${fieldId}/area-snapshot?viewer=1`);
    assert.equal(seen.resolveOverride, "origin.ikimon.test");
    assert.equal(seen.reason, "area_snapshot_materialized_miss");
    assert.equal(core.operationAudit.length, 1);
    const telemetry = JSON.parse(core.operationAudit[0]?.payload_json ?? "{}");
    assert.equal(telemetry.reason, "area_snapshot_materialized_miss");
    assert.equal(telemetry.routePattern, "/api/v1/fields/:id/area-snapshot");
    assert.equal(JSON.stringify(telemetry).includes(fieldId), false);
    assert.equal(JSON.stringify(telemetry).includes("viewer=1"), false);
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

    assert.equal(fallbackCalls, 0);
    assert.equal(core.operationAudit.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production original UI static asset misses fall back to origin with redacted telemetry", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const originalFetch = globalThis.fetch;
  const seen: { url?: string; reason?: string | null; resolveOverride?: string } = {};
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.url = String(input);
    seen.resolveOverride = (init as RequestInit & { cf?: { resolveOverride?: string } } | undefined)?.cf?.resolveOverride;
    seen.reason = new Headers(init?.headers).get("x-ikimon-cloudflare-fallback-reason");
    return new Response("origin-png", { headers: { "content-type": "image/png" } });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/assets/brand/missing-icon.png?v=1"), productionEnv);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "origin-png");
    assert.equal(seen.url, "https://ikimon.life/assets/brand/missing-icon.png?v=1");
    assert.equal(seen.resolveOverride, "origin.ikimon.test");
    assert.equal(seen.reason, "static_asset_materialized_miss");
    assert.equal(core.operationAudit.length, 1);
    const telemetry = JSON.parse(core.operationAudit[0]?.payload_json ?? "{}");
    assert.equal(telemetry.reason, "static_asset_materialized_miss");
    assert.equal(telemetry.routePattern, "/assets/brand/:asset");
    assert.equal(JSON.stringify(telemetry).includes("missing-icon"), false);
    assert.equal(JSON.stringify(telemetry).includes("v=1"), false);
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

test("production original UI thumbnail misses fall back to origin with redacted telemetry", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const originalFetch = globalThis.fetch;
  const seen: { url?: string; reason?: string | null; resolveOverride?: string } = {};
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.url = String(input);
    seen.resolveOverride = (init as RequestInit & { cf?: { resolveOverride?: string } } | undefined)?.cf?.resolveOverride;
    seen.reason = new Headers(init?.headers).get("x-ikimon-cloudflare-fallback-reason");
    return new Response("origin-jpg", { headers: { "content-type": "image/jpeg" } });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://ikimon.life/thumb/md/v2-observations/record-secret/photo-secret.jpg?size=md"), productionEnv);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "origin-jpg");
    assert.equal(seen.url, "https://ikimon.life/thumb/md/v2-observations/record-secret/photo-secret.jpg?size=md");
    assert.equal(seen.resolveOverride, "origin.ikimon.test");
    assert.equal(seen.reason, "thumb_materialized_miss");
    assert.equal(core.operationAudit.length, 1);
    const telemetry = JSON.parse(core.operationAudit[0]?.payload_json ?? "{}");
    assert.equal(telemetry.reason, "thumb_materialized_miss");
    assert.equal(telemetry.routePattern, "/thumb/:size/v2-observations/:record/:asset");
    assert.equal(JSON.stringify(telemetry).includes("record-secret"), false);
    assert.equal(JSON.stringify(telemetry).includes("photo-secret"), false);
    assert.equal(JSON.stringify(telemetry).includes("size=md"), false);
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
    assert.equal(response.headers.get("cache-control"), "no-store");
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

  const response = await worker.fetch(new Request("https://ikimon.life/ja/records"), productionEnv);
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.match(body, /data-cloudflare-records-live/);
  assert.match(body, /最近の投稿テスト/);
  assert.match(body, /record-live-materialized/);
  assert.match(body, /\/derived\/.+\/display\.webp/);
  assert.equal(response.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");
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
    assert.equal(response.headers.get("cache-control"), "no-store");
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
      "/data:image/jpeg;base64,/9j/secret"
    ]) {
      const response = await worker.fetch(new Request(`https://ikimon.life${path}`), productionEnv);
      assert.equal(response.status, 404, path);
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
  await env.ASSET_BUCKET.put("original-ui/html/ja/observations/record-native-public.html", "should-not-be-served", {
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };

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
    assert.match(body, /obs-reading-hero/);
    assert.match(body, /obs-read-progress/);
    assert.match(body, /obs-media-ledger/);
    assert.match(body, /obs-action-rail/);
    assert.match(body, /obs-record-story/);
    assert.match(body, /obs-local-quality-inline is-full-width/);
    assert.match(body, /obs-area-records/);
    assert.match(body, /record-native-public-peer-a|record-native-public-peer-b/);
    assert.match(body, /言語prefix記録/);
    assert.match(body, /ぼかし表示/);
    assert.match(body, /精密な座標/);
    assert.doesNotMatch(body, /cell:34\.71,137\.81|公開セル|セル単位/);
    assert.doesNotMatch(body, /data-shadow-observation-detail="1"|ikimon shadow|ownerUserId|observerUserId|profile\/detail-user|34\.71234|137\.81234|should-not-be-served|origin observation detail/);
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
  assert.match(body, /同じあたりで見えたもの/);
  assert.match(body, /近くの記録/);
  assert.match(body, /かなり近そう/);
  assert.match(body, /分類候補/);
  assert.match(body, /Chloris sinica/);
  assert.match(body, /端末の声で読む/);
  assert.match(body, /data-frame-zoom-in/);
  assert.match(body, /obs-frame-preview/);
  assert.match(body, /obs-nearby-nophoto|obs-area-thumb/);
  assert.doesNotMatch(body, /cell:34\.81,137\.73|公開セル|セル単位|公開範囲|記録情報|記録一覧|記録の手ざわり|次に見るなら|浜松市浜名区をもう少し見る/);
  assert.doesNotMatch(body, /この映像で読む対象を切り替える|この映像に写っているもの|候補を確かめる材料|名前の記録|現場アドバイス|確定前|イネ科植物|映像フレームから拾えている手がかり/);
  assert.doesNotMatch(body, /ownerUserId|observerUserId|profile\/detail-user|34\.81234|137\.73123|\/uploads\/|original-ui\/thumb/);
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

test("staging municipal walk map admin source draft serves materialized preview with session cookies", async () => {
  const { env } = createEnv();
  const stagingEnv = {
    ...env,
    ENVIRONMENT: "staging",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  await env.ASSET_BUCKET.put(
    "original-ui/html/admin/municipal-walk-maps/template/route_species_walk.html",
    "<!doctype html><title>散策マップ管理</title><main>参考元カタログ data-source-operational-model=\"official_walk_pdf\" 散策PDF</main>",
    { httpMetadata: { contentType: "text/html; charset=utf-8" } }
  );
  await env.ASSET_BUCKET.put(
    "original-ui/html/admin/municipal-walk-maps/source/funabashi-nature-walk-maps.html",
    "<!doctype html><title>散策マップ管理</title><main>自然散策マップ 下書き 下書きに入れる</main>",
    { httpMetadata: { contentType: "text/html; charset=utf-8" } }
  );
  await env.ASSET_BUCKET.put(
    "original-ui/html/admin/municipal-walk-maps/source/shizuoka-ikimono-walk-route.html",
    "<!doctype html><title>散策マップ管理</title><main>静岡市 いきもの散策マップ 下書き 立ち寄り先 6</main>",
    { httpMetadata: { contentType: "text/html; charset=utf-8" } }
  );
  await env.ASSET_BUCKET.put(
    "original-ui/html/admin/municipal-walk-map-reviews.html",
    "<!doctype html><title>散策マップ審査</title><main>散策マップ審査 DB適用後に一覧を表示できます。</main>",
    { httpMetadata: { contentType: "text/html; charset=utf-8" } }
  );
  await env.ASSET_BUCKET.put(
    "original-ui/html/walk-map-source-drafts/shizuoka-ikimono-walk-route.html",
    "<!doctype html><title>散策マップ下書き</title><main>source_draft_review 6. 公園の開けた場所</main>",
    { httpMetadata: { contentType: "text/html; charset=utf-8" } }
  );

  const originalFetch = globalThis.fetch;
  let fallbackCalls = 0;
  globalThis.fetch = (async () => {
    fallbackCalls += 1;
    return new Response("origin should not be used", { status: 599 });
  }) as typeof fetch;
  try {
    const templateResponse = await worker.fetch(new Request(
      "https://staging.ikimon.life/admin/municipal-walk-maps?templateId=route_species_walk",
      { headers: { cookie: "ikimon_v2_session=test-admin-token" } }
    ), stagingEnv);

    assert.equal(templateResponse.status, 200);
    assert.equal(templateResponse.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");
    const templateBody = await templateResponse.text();
    assert.match(templateBody, /参考元カタログ/);
    assert.match(templateBody, /data-source-operational-model="official_walk_pdf"/);
    assert.equal(fallbackCalls, 0);
    const anonymousTemplateResponse = await worker.fetch(new Request(
      "https://staging.ikimon.life/admin/municipal-walk-maps?templateId=route_species_walk"
    ), stagingEnv);
    assert.equal(anonymousTemplateResponse.status, 200);
    assert.equal(anonymousTemplateResponse.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");
    assert.match(await anonymousTemplateResponse.text(), /散策PDF/);
    assert.equal(fallbackCalls, 0);
    const response = await worker.fetch(new Request(
      "https://staging.ikimon.life/admin/municipal-walk-maps?sourceId=funabashi-nature-walk-maps",
      { headers: { cookie: "ikimon_v2_session=test-admin-token" } }
    ), stagingEnv);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");
    assert.match(await response.text(), /自然散策マップ 下書き/);
    assert.equal(fallbackCalls, 0);
    const shizuokaResponse = await worker.fetch(new Request(
      "https://staging.ikimon.life/admin/municipal-walk-maps?sourceId=shizuoka-ikimono-walk-route",
      { headers: { cookie: "ikimon_v2_session=test-admin-token" } }
    ), stagingEnv);

    assert.equal(shizuokaResponse.status, 200);
    assert.equal(shizuokaResponse.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");
    assert.match(await shizuokaResponse.text(), /立ち寄り先 6/);
    assert.equal(fallbackCalls, 0);
    const reviewQueueResponse = await worker.fetch(new Request(
      "https://staging.ikimon.life/admin/municipal-walk-map-reviews",
      { headers: { cookie: "ikimon_v2_session=test-admin-token" } }
    ), stagingEnv);

    assert.equal(reviewQueueResponse.status, 200);
    assert.equal(reviewQueueResponse.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");
    assert.match(await reviewQueueResponse.text(), /散策マップ審査/);
    assert.equal(fallbackCalls, 0);
    const reviewResponse = await worker.fetch(new Request(
      "https://staging.ikimon.life/walk-map-source-drafts/shizuoka-ikimono-walk-route"
    ), stagingEnv);

    assert.equal(reviewResponse.status, 200);
    assert.equal(reviewResponse.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html");
    assert.match(await reviewResponse.text(), /source_draft_review/);
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

test("production original UI html misses fall back to origin with redacted telemetry", async () => {
  const { env, core } = createEnv();
  const productionEnv = {
    ...env,
    ENVIRONMENT: "production",
    ORIGIN_FALLBACK_BASE_URL: "https://ikimon.life",
    ORIGIN_FALLBACK_RESOLVE_OVERRIDE: "origin.ikimon.test"
  };
  const fieldId = "535cccb1-c3d1-4a35-ab9f-2ed811f5abb5";
  const originalFetch = globalThis.fetch;
  const seen: { url?: string; reason?: string | null; resolveOverride?: string } = {};
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.url = String(input);
    seen.resolveOverride = (init as RequestInit & { cf?: { resolveOverride?: string } } | undefined)?.cf?.resolveOverride;
    seen.reason = new Headers(init?.headers).get("x-ikimon-cloudflare-fallback-reason");
    return new Response("<!doctype html><title>origin field</title>", {
      headers: { "content-type": "text/html; charset=utf-8" }
    });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request(`https://ikimon.life/ja/community/fields/${fieldId}?viewer=1`), productionEnv);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "<!doctype html><title>origin field</title>");
    assert.equal(seen.url, `https://ikimon.life/ja/community/fields/${fieldId}?viewer=1`);
    assert.equal(seen.resolveOverride, "origin.ikimon.test");
    assert.equal(seen.reason, "html_materialized_miss");
    assert.equal(core.operationAudit.length, 1);
    const telemetry = JSON.parse(core.operationAudit[0]?.payload_json ?? "{}");
    assert.equal(telemetry.reason, "html_materialized_miss");
    assert.equal(telemetry.routePattern, "/ja/community/fields/:id");
    assert.match(telemetry.pathHash, /^[0-9a-f]{16}$/);
    assert.match(telemetry.originalUiHtmlKeyHash, /^[0-9a-f]{16}$/);
    assert.equal(JSON.stringify(telemetry).includes(fieldId), false);
    assert.equal(JSON.stringify(telemetry).includes("viewer=1"), false);
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
    assert.equal(healthPayload.buildMarker, "map-shell-cookie-safe");

    const ready = await worker.fetch(new Request("https://ikimon.life/readyz"), productionEnv);
    assert.equal(ready.status, 200);
    const readyPayload = await ready.json() as any;
    assert.equal(readyPayload.ok, true);
    assert.equal(readyPayload.buildMarker, "map-shell-cookie-safe");
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
