import assert from "node:assert/strict";
import test from "node:test";
import { chooseAdminLocalityForPoint, resolveAdminLocalityForPoint } from "./adminLocalityResolver.js";

test("chooseAdminLocalityForPoint picks the containing municipality polygon", () => {
  const locality = chooseAdminLocalityForPoint(26.2124, 127.6809, [
    {
      field_id: "naha",
      name: "沖縄県 那覇市",
      prefecture: "沖縄県",
      city: "那覇市",
      area_ha: "3900",
      polygon: {
        type: "Polygon",
        coordinates: [[
          [127.60, 26.15],
          [127.75, 26.15],
          [127.75, 26.28],
          [127.60, 26.28],
          [127.60, 26.15],
        ]],
      },
    },
  ]);

  assert.deepEqual(locality, {
    fieldId: "naha",
    prefecture: "沖縄県",
    municipality: "那覇市",
    name: "沖縄県 那覇市",
    validFrom: null,
    validTo: null,
    entityKey: null,
  });
});

test("chooseAdminLocalityForPoint prefers the smallest containing area", () => {
  const locality = chooseAdminLocalityForPoint(34.71, 137.72, [
    {
      field_id: "hamamatsu",
      name: "静岡県 浜松市",
      prefecture: "静岡県",
      city: "浜松市",
      area_ha: "155800",
      polygon: {
        type: "Polygon",
        coordinates: [[
          [137.40, 34.50],
          [138.20, 34.50],
          [138.20, 35.30],
          [137.40, 35.30],
          [137.40, 34.50],
        ]],
      },
    },
    {
      field_id: "chuo",
      name: "静岡県 浜松市中央区",
      prefecture: "静岡県",
      city: "浜松市中央区",
      area_ha: "27000",
      polygon: {
        type: "Polygon",
        coordinates: [[
          [137.60, 34.60],
          [137.85, 34.60],
          [137.85, 34.82],
          [137.60, 34.82],
          [137.60, 34.60],
        ]],
      },
    },
  ]);

  assert.equal(locality?.fieldId, "chuo");
  assert.equal(locality?.municipality, "浜松市中央区");
});

test("chooseAdminLocalityForPoint resolves the name that was valid at observation time", () => {
  const rows = [
    {
      field_id: "old-town",
      name: "静岡県 引佐郡細江町",
      prefecture: "静岡県",
      city: "引佐郡細江町",
      area_ha: "4500",
      valid_from: "1900-01-01",
      valid_to: "2005-06-30",
      entity_key: "n03:old-town",
      polygon: {
        type: "Polygon",
        coordinates: [[
          [137.60, 34.70],
          [137.80, 34.70],
          [137.80, 34.90],
          [137.60, 34.90],
          [137.60, 34.70],
        ]],
      },
    },
    {
      field_id: "new-ward",
      name: "静岡県 浜松市浜名区",
      prefecture: "静岡県",
      city: "浜松市浜名区",
      area_ha: "4500",
      valid_from: "2024-01-01",
      valid_to: null,
      entity_key: "n03:new-ward",
      polygon: {
        type: "Polygon",
        coordinates: [[
          [137.60, 34.70],
          [137.80, 34.70],
          [137.80, 34.90],
          [137.60, 34.90],
          [137.60, 34.70],
        ]],
      },
    },
  ];

  assert.equal(
    chooseAdminLocalityForPoint(34.8134, 137.7319, rows, { observedAt: "2000-05-01" })?.municipality,
    "引佐郡細江町",
  );
  assert.equal(
    chooseAdminLocalityForPoint(34.8134, 137.7319, rows, { observedAt: "2026-05-30" })?.municipality,
    "浜松市浜名区",
  );
});

test("resolveAdminLocalityForPoint queries the administrative boundary effective at observation time", async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const locality = await resolveAdminLocalityForPoint({
    async query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]) {
      calls.push({ sql, params });
      return {
        rows: [{
          field_id: "old-town",
          name: "静岡県 引佐郡細江町",
          prefecture: "静岡県",
          city: "引佐郡細江町",
          area_ha: "4500",
          valid_from: "1900-01-01",
          valid_to: "2005-06-30",
          entity_key: "n03:old-town",
          polygon: {
            type: "Polygon",
            coordinates: [[
              [137.60, 34.70],
              [137.80, 34.70],
              [137.80, 34.90],
              [137.60, 34.90],
              [137.60, 34.70],
            ]],
          },
        }] as unknown as T[],
      };
    },
  }, 34.8134, 137.7319, { observedAt: "2000-05-01T09:00:00+09:00" });

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /valid_from is null or valid_from <= \$3::date/);
  assert.match(calls[0]!.sql, /valid_to is null or valid_to >= \$3::date/);
  assert.deepEqual(calls[0]!.params, [34.8134, 137.7319, "2000-05-01", 120]);
  assert.equal(locality?.municipality, "引佐郡細江町");
  assert.equal(locality?.validTo, "2005-06-30");
  assert.equal(locality?.entityKey, "n03:old-town");
});

test("resolveAdminLocalityForPoint falls back to current boundaries when history is not loaded", async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const locality = await resolveAdminLocalityForPoint({
    async query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]) {
      calls.push({ sql, params });
      const isFallback = calls.length > 1;
      return {
        rows: (isFallback ? [{
          field_id: "current-ward",
          name: "静岡県 浜松市浜名区",
          prefecture: "静岡県",
          city: "浜松市浜名区",
          area_ha: "4500",
          valid_from: "2024-01-01",
          valid_to: null,
          entity_key: "n03:current-ward",
          polygon: {
            type: "Polygon",
            coordinates: [[
              [137.60, 34.70],
              [137.80, 34.70],
              [137.80, 34.90],
              [137.60, 34.90],
              [137.60, 34.70],
            ]],
          },
        }] : []) as unknown as T[],
      };
    },
  }, 34.8134, 137.7319, { observedAt: "1990-05-01" });

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0]!.params, [34.8134, 137.7319, "1990-05-01", 120]);
  assert.deepEqual(calls[1]!.params, [34.8134, 137.7319, 120]);
  assert.match(calls[1]!.sql, /valid_to is null/);
  assert.equal(locality?.municipality, "浜松市浜名区");
});
