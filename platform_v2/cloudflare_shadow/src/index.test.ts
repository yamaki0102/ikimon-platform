import assert from "node:assert/strict";
import test from "node:test";
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

class FakeD1 {
  users = new Set<string>();
  drafts = new Map<string, DraftRow>();
  observations = new Map<string, ObservationRow>();
  assets = new Map<string, AssetRow>();
  outbox = new Map<string, OutboxRow>();
  rollbackLedger = new Map<string, RollbackLedgerRow>();
  readmodel = new Map<string, { observation_id: string; public_cell: string; observed_at: string; taxon_label: string | null; asset_count: number; partition_month: string | null }>();
  parityRuns = new Map<string, ParityRunRow>();
  parityMetrics: ParityMetricRow[] = [];
  authSessions = new Map<string, AuthSessionRow>();
  videoUploads = new Map<string, VideoUploadRow>();
  legacyAssetImports: LegacyAssetImportRow[] = [];
  legacyR2Imports: LegacyR2ImportRow[] = [];
  legacyStreamInventory: LegacyStreamInventoryRow[] = [];
  productionPublicReadmodel = new Map<string, ProductionImportPublicReadmodelRow>();

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

    if (normalized.startsWith("UPDATE observations SET emergency_hidden = 1")) {
      const observation = requireRow(this.db.observations, string(v[0]));
      observation.emergency_hidden = 1;
      return {};
    }

    if (normalized.startsWith("DELETE FROM readmodel_public_observations")) {
      this.db.readmodel.delete(string(v[0]));
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
      this.db.authSessions.set(string(v[0]), {
        token_hash: string(v[0]),
        user_id: string(v[1]),
        display_name: string(v[2]),
        role_name: string(v[3]),
        rank_label: nullableString(v[4]),
        banned: 0,
        expires_at: string(v[5]),
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

    throw new Error(`Unhandled SQL run: ${this.query}`);
  }

  async first<T>(): Promise<T | null> {
    const normalized = normalize(this.query);
    const v = this.values;

    if (normalized.startsWith("SELECT object_key, mime FROM asset_ledger")) {
      const asset = this.db.assets.get(string(v[0]));
      return asset ? ({ object_key: asset.object_key, mime: asset.mime } as T) : null;
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
    if (normalized.startsWith("SELECT metric_type, metric_key, metric_value, detail_json FROM production_restore_parity_metrics")) {
      const rows = this.db.parityMetrics
        .filter((row) => row.run_id === string(this.values[0]))
        .sort((a, b) => `${a.metric_type}:${a.metric_key}`.localeCompare(`${b.metric_type}:${b.metric_key}`));
      return { results: rows as T[] };
    }
    if (normalized.startsWith("SELECT observation_id, public_cell, observed_at, taxon_label, asset_count FROM readmodel_public_observations")) {
      const rows = [...this.db.readmodel.values()]
        .sort((a, b) => b.observed_at.localeCompare(a.observed_at));
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
      OBSERVATION_ARCHIVE_TARGET: "r2_sql_export_by_partition_month"
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
  const { env } = createEnv();

  const missingHeader = await worker.fetch(new Request("https://shadow.test/internal/r2-inventory"), env);
  assert.equal(missingHeader.status, 401);
  assert.deepEqual(await missingHeader.json(), { error: "internal_auth_required" });

  const missingSecret = await worker.fetch(new Request("https://shadow.test/internal/r2-inventory"), {
    ...env,
    INTERNAL_AUTH_TOKEN: undefined
  });
  assert.equal(missingSecret.status, 403);
  assert.deepEqual(await missingSecret.json(), { error: "internal_auth_not_configured" });
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
});

test("v1 public map read routes expose current shell contracts without exact coordinates", async () => {
  const { env, queue } = createEnv();
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

  const observationsResponse = await worker.fetch(new Request("https://shadow.test/api/v1/map/observations?cell_id=cell%3A34.71%2C137.81"), env);
  const observationsPayload = await observationsResponse.json() as any;
  assert.equal(observationsResponse.ok, true, JSON.stringify(observationsPayload));
  assert.ok(Array.isArray(observationsPayload.items));
  assert.equal(observationsPayload.items.length, 1);
  assert.equal(observationsPayload.items[0].visitId, "visit-map-contract");
  assert.equal(observationsPayload.items[0].occurrenceId, "occ:visit-map-contract:0");
  assert.equal(observationsPayload.items[0].displayName, "地図テスト植物");
  assert.equal(observationsPayload.items[0].cellId, "cell:34.71,137.81");
  assert.equal(observationsPayload.stats.selectedCellId, "cell:34.71,137.81");
  assert.ok(!("features" in observationsPayload));
  assert.doesNotMatch(JSON.stringify(observationsPayload), /34\.71234|137\.81234/);

  const myPlacesResponse = await worker.fetch(new Request("https://shadow.test/api/v1/map/my-places"), env);
  assert.equal(myPlacesResponse.ok, true);
  assert.deepEqual(await myPlacesResponse.json(), { signedIn: false, items: [] });
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
  assert.doesNotMatch(JSON.stringify(jsonPayload), /34\.71234|137\.81234/);

  const imageResponse = await worker.fetch(new Request(`https://shadow.test${jsonPayload.observation.photoAssets[0].url}`), env);
  const imageBody = await imageResponse.text();
  assert.equal(imageResponse.ok, true, imageBody);
  assert.match(imageResponse.headers.get("content-type") ?? "", /image\/svg\+xml/);
  assert.match(imageBody, /shadow public derivative/);

  const pageResponse = await worker.fetch(new Request("https://shadow.test/observations/visit-detail-contract"), env);
  const pageHtml = await pageResponse.text();
  assert.equal(pageResponse.ok, true, pageHtml);
  assert.match(pageHtml, /data-shadow-observation-detail="1"/);
  assert.match(pageHtml, /詳細テスト植物/);
  assert.match(pageHtml, /cell:34\.71,137\.81/);
  assert.match(pageHtml, /exact location is not exposed/);
  assert.doesNotMatch(pageHtml, /34\.71234|137\.81234/);

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
