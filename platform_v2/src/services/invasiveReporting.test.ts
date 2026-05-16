import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";
import {
  buildInvasiveReportingPayload,
  emitInvasiveReportingForOccurrence,
} from "./invasiveReporting.js";

type Query = { text: string; values: unknown[] };

function ruleRow(overrides: Record<string, unknown> = {}) {
  return {
    rule_id: "11111111-1111-1111-1111-111111111111",
    contact_id: "22222222-2222-2222-2222-222222222222",
    jurisdiction_id: "33333333-3333-3333-3333-333333333333",
    alert_recipient_id: "44444444-4444-4444-4444-444444444444",
    organization_name: "静岡県",
    department_name: "自然保護課",
    contact_role: "prefecture",
    delivery_mode: "email",
    email: "shizenhogo@example.test",
    phone: null,
    form_url: null,
    api_endpoint: null,
    send_permission_status: "approved",
    supported_languages: ["ja", "en"],
    official_url: "https://example.test/invasive",
    reporting_category: "emergency_biosecurity",
    urgency: "urgent",
    taxon_names: ["ヒアリ"],
    mhlw_categories: ["iaspecified"],
    required_fields: ["写真", "発見場所", "発見日時", "個体数"],
    handling_warnings: ["素手で触らない", "生きたまま運ばない"],
    user_guidance_ja: "安全な距離から写真と場所を残してください。",
    authority_guidance_ja: "AI候補として詳細位置と写真URLを共有します。",
    country_code: "JP",
    admin_area_1: "静岡県",
    admin_area_2: null,
    municipality: null,
    locality_label: "静岡県",
    languages: ["ja"],
    timezone: "Asia/Tokyo",
    ...overrides,
  };
}

function detailRow() {
  return {
    occurrence_id: "occ-1",
    visit_id: "visit-1",
    observed_at: "2026-05-16T10:00:00.000Z",
    latitude: 34.9756,
    longitude: 138.3828,
    coordinate_uncertainty_m: "8.0",
    locality_note: "港湾近くの舗装面",
    note: "赤いアリが数匹いた",
    individual_count: 4,
    photo_urls: ["https://ikimon.life/media/fire-ant.jpg"],
  };
}

function makeMockClient(history: Query[], rows: ReturnType<typeof ruleRow>[]) {
  return {
    query: async (text: string, values?: unknown[]) => {
      history.push({ text, values: values ?? [] });
      if (/FROM invasive_reporting_rules/.test(text)) return { rows };
      if (/FROM occurrences/.test(text)) return { rows: [detailRow()] };
      if (/INSERT INTO alert_deliveries/.test(text)) return { rows: [{ delivery_id: "55555555-5555-5555-5555-555555555555" }] };
      return { rows: [] };
    },
  } as unknown as PoolClient;
}

const ctx = {
  occurrenceId: "occ-1",
  visitId: "visit-1",
  invasiveStatus: "iaspecified",
  scientificName: "Solenopsis invicta",
  vernacularName: "ヒアリ",
  genus: "Solenopsis",
  family: "Formicidae",
  orderName: "Hymenoptera",
  className: "Insecta",
  prefecture: "静岡県",
  municipality: "静岡市",
};

test("emitInvasiveReportingForOccurrence creates pending delivery for approved email contact", async () => {
  const history: Query[] = [];
  const client = makeMockClient(history, [ruleRow()]);
  const summary = await emitInvasiveReportingForOccurrence(client, ctx);

  assert.equal(summary.matchedRules, 1);
  assert.equal(summary.pendingDeliveries, 1);
  assert.equal(summary.suppressedNoPermission, 0);
  assert.ok(history.some((q) => /INSERT INTO alert_deliveries/.test(q.text)));
  assert.ok(history.some((q) => q.values.includes("candidate")));
  assert.ok(history.some((q) => q.values.includes("pending_delivery")));
});

test("emitInvasiveReportingForOccurrence suppresses unapproved contacts", async () => {
  const history: Query[] = [];
  const client = makeMockClient(history, [
    ruleRow({ send_permission_status: "not_requested", alert_recipient_id: null }),
  ]);
  const summary = await emitInvasiveReportingForOccurrence(client, ctx);

  assert.equal(summary.matchedRules, 1);
  assert.equal(summary.pendingDeliveries, 0);
  assert.equal(summary.suppressedNoPermission, 1);
  assert.equal(history.some((q) => /INSERT INTO alert_deliveries/.test(q.text)), false);
  assert.ok(history.some((q) => q.values.includes("suppressed_no_permission")));
});

test("emitInvasiveReportingForOccurrence does not report native or out-of-region records", async () => {
  const nativeHistory: Query[] = [];
  const nativeClient = makeMockClient(nativeHistory, [ruleRow()]);
  const nativeSummary = await emitInvasiveReportingForOccurrence(nativeClient, { ...ctx, invasiveStatus: "native" });
  assert.deepEqual(nativeSummary, { matchedRules: 0, pendingDeliveries: 0, suppressedNoPermission: 0 });
  assert.equal(nativeHistory.length, 0);

  const noPlaceHistory: Query[] = [];
  const noPlaceClient = makeMockClient(noPlaceHistory, [ruleRow()]);
  const noPlaceSummary = await emitInvasiveReportingForOccurrence(noPlaceClient, {
    ...ctx,
    prefecture: null,
    municipality: null,
  });
  assert.deepEqual(noPlaceSummary, { matchedRules: 0, pendingDeliveries: 0, suppressedNoPermission: 0 });
  assert.equal(noPlaceHistory.length, 0);
});

test("buildInvasiveReportingPayload keeps multilingual rule guidance and detailed evidence", () => {
  const payload = buildInvasiveReportingPayload(ctx, {
    occurrenceId: "occ-1",
    visitId: "visit-1",
    observedAt: "2026-05-16T10:00:00.000Z",
    latitude: 34.9756,
    longitude: 138.3828,
    coordinateUncertaintyM: "8.0",
    localityNote: "港湾近くの舗装面",
    note: "赤いアリが数匹いた",
    individualCount: 4,
    photoUrls: ["https://ikimon.life/media/fire-ant.jpg"],
  }, ruleRow());

  assert.deepEqual((payload.reporting as Record<string, unknown>).supportedLanguages, ["ja", "en"]);
  assert.deepEqual((payload.reporting as Record<string, unknown>).requiredFields, ["写真", "発見場所", "発見日時", "個体数"]);
  assert.match(JSON.stringify(payload), /AI候補であり、確定同定ではありません/);
  assert.match(JSON.stringify(payload), /34\.9756/);
  assert.match(JSON.stringify(payload), /fire-ant\.jpg/);
});
