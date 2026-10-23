import assert from "node:assert/strict";
import test from "node:test";
import {
  NocosilExportPostgresSource,
  type NocosilExportPostgresQueryable,
} from "./nocosilExportPostgresSource.js";

const siteId = "11111111-1111-4111-8111-111111111111";
const actorUserId = "owner-1";

function fieldRow(overrides: Record<string, unknown> = {}) {
  return {
    field_id: siteId,
    source: "nature_symbiosis_site",
    owner_user_id: null,
    name: "Sensitive site name",
    lat: 35,
    lng: 139,
    radius_m: 1000,
    polygon: null,
    ...overrides,
  };
}

function observationRow(overrides: Record<string, unknown> = {}) {
  return {
    observation_id: "visit-1",
    visit_id: "visit-1",
    occurrence_id: "occurrence-1",
    taxon_name: "Rana japonica",
    observed_at: "2026-05-01T12:00:00.000Z",
    latitude: 35.12345,
    longitude: 138.98765,
    record_consent: "external_export",
    research_use_consent: "public_export",
    dataset_license: "CC-BY-4.0",
    media_license: "CC-BY-4.0",
    external_export_allowed: true,
    withdrawal_status: "active",
    consent_source: "user_selected",
    rights_policy_version: "site_intelligence_p0_v1",
    source_payload: { privateLabel: "must not pass through" },
    photo_url: "https://raw.example.org/original.jpg",
    photo_thumbnail_url: "https://cdn.example.org/photo.webp",
    photo_metadata: { facePrivacy: { status: "no_faces" }, exif_stripped: true },
    ...overrides,
  };
}

function database(options: {
  field?: Record<string, unknown> | null;
  authorized?: boolean;
  observationRows?: Array<Record<string, unknown>>;
  visitRow?: Record<string, unknown>;
} = {}) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.includes("SELECT field.field_id::text AS field_id")) {
      const field = options.field === undefined ? fieldRow() : options.field;
      const authorized = options.authorized !== false;
      return { rows: field && authorized ? [field as never] : [], rowCount: field && authorized ? 1 : 0 };
    }
    if (sql.toLowerCase().includes("from visits v") && sql.includes("resolved_field_ids")) {
      return { rows: [{
        visit_id: "visit-1",
        point_latitude: options.visitRow?.point_latitude ?? "35",
        point_longitude: options.visitRow?.point_longitude ?? "139",
        source_field_id: siteId,
        resolved_match: true,
      }] as never[], rowCount: 1 };
    }
    if (sql.includes("FROM requested_observations")) {
      return { rows: (options.observationRows ?? [observationRow()]) as never[], rowCount: (options.observationRows ?? [observationRow()]).length };
    }
    throw new Error(`unexpected SQL: ${sql}`);
  };
  return { query: query as unknown as NocosilExportPostgresQueryable["query"], calls };
}

test("site lookup authorizes custom owner or active field manager owner and returns minimal identity", async () => {
  const db = database({ field: fieldRow({ source: "user_defined", owner_user_id: actorUserId }) });
  const source = new NocosilExportPostgresSource(db);

  assert.deepEqual(await source.getSite(siteId, actorUserId), { id: siteId, ownerUserId: actorUserId });
  const sql = db.calls[0]?.sql ?? "";
  assert.match(sql, /field_managers/);
  assert.match(sql, /role\s*=\s*'owner'/);
  assert.match(sql, /expires_at\s+IS\s+NULL\s+OR\s+.*expires_at\s*>\s*NOW\(\)/);
  assert.doesNotMatch(JSON.stringify(await source.getSite(siteId, actorUserId)), /Sensitive site name/);
});

test("site lookup denies a steward, expired manager, or unrelated user", async () => {
  const db = database({ authorized: false });
  const source = new NocosilExportPostgresSource(db);
  assert.equal(await source.getSite(siteId, "unrelated-user"), null);
});

test("observation load is scoped to authenticated owner, selected IDs, site geometry, and period", async () => {
  const db = database();
  const source = new NocosilExportPostgresSource(db);
  const rows = await source.loadObservations({
    siteId,
    actorUserId,
    observationIds: ["visit-1"],
    period: { start: "2026-05-01T00:00:00.000Z", end: "2026-06-01T00:00:00.000Z" },
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.id, "visit-1");
  assert.equal(rows[0]?.taxon, "Rana japonica");
  assert.equal(rows[0]?.sensitive, true);
  assert.equal(rows[0]?.photoUrl, null, "unverified original URLs must not be exported");
  assert.equal(rows[0]?.rights.withdrawalStatus, "active");
  assert.equal("sourcePayload" in rows[0]!.rights, false);
  assert.equal(rows[0]?.photoUrlIsSanitizedRendition, false);

  const observationQuery = db.calls.find((call) => call.sql.includes("FROM requested_observations"));
  assert.ok(observationQuery);
  assert.match(observationQuery.sql, /observation_data_rights/);
  assert.match(observationQuery.sql, /external_export_allowed/);
  assert.match(observationQuery.sql, /requested_observations/);
  assert.deepEqual(observationQuery.params.slice(0, 3), [siteId, actorUserId, ["visit-1"]]);
  assert.ok(observationQuery.params.includes("2026-05-01T00:00:00.000Z"));
  assert.ok(observationQuery.params.includes("2026-06-01T00:00:00.000Z"));
});

test("load reauthorizes on every request and returns nonconsented or withdrawn records for policy filtering", async () => {
  const db = database({
    authorized: false,
    observationRows: [observationRow({
      record_consent: "private",
      external_export_allowed: false,
      withdrawal_status: "withdrawn",
      consent_source: "default",
    })],
  });
  const source = new NocosilExportPostgresSource(db);
  await assert.rejects(() => source.loadObservations({
    siteId,
    actorUserId,
    observationIds: ["visit-1"],
    period: { start: "2026-05-01T00:00:00.000Z", end: "2026-06-01T00:00:00.000Z" },
  }), /site_owner_required/);
  assert.equal(db.calls.filter((call) => call.sql.includes("FROM requested_observations")).length, 0);
});

test("missing rights fail closed without dropping the selected record", async () => {
  const db = database({ observationRows: [observationRow({
    record_consent: null,
    research_use_consent: null,
    dataset_license: null,
    media_license: null,
    external_export_allowed: false,
    withdrawal_status: null,
    consent_source: null,
  })] });
  const source = new NocosilExportPostgresSource(db);
  const rows = await source.loadObservations({
    siteId,
    actorUserId,
    observationIds: ["visit-1"],
    period: { start: "2026-05-01T00:00:00.000Z", end: "2026-06-01T00:00:00.000Z" },
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.rights.recordConsent, "private");
  assert.equal(rows[0]?.rights.externalExportAllowed, false);
  assert.equal(rows[0]?.rights.consentSource, "default");
});

test("null geometry uses the site's radius, while a supplied polygon is enforced exactly", async () => {
  const radiusDb = database({
    field: fieldRow({ lat: 35, lng: 139, radius_m: 1000, polygon: null }),
    visitRow: { point_latitude: "35", point_longitude: "139" },
  });
  const radiusRows = await new NocosilExportPostgresSource(radiusDb).loadObservations({
    siteId,
    actorUserId,
    observationIds: ["visit-1"],
    period: { start: "2026-05-01", end: "2026-06-01" },
  });
  assert.equal(radiusRows.length, 1);

  const polygonDb = database({
    field: fieldRow({
      lat: 35,
      lng: 139,
      radius_m: 1000,
      polygon: { type: "Polygon", coordinates: [[[138.9, 34.9], [139.1, 34.9], [139.1, 35.1], [138.9, 35.1], [138.9, 34.9]]] },
    }),
    visitRow: { point_latitude: "35", point_longitude: "139.2" },
  });
  const polygonRows = await new NocosilExportPostgresSource(polygonDb).loadObservations({
    siteId,
    actorUserId,
    observationIds: ["visit-1"],
    period: { start: "2026-05-01", end: "2026-06-01" },
  });
  assert.deepEqual(polygonRows, []);
  assert.equal(polygonDb.calls.some((call) => call.sql.includes("FROM requested_observations")), false);
});
