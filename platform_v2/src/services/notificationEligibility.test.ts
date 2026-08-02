import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalNotificationEligibility } from "./notificationEligibility.js";

type Query = { text: string; values: unknown[] };

test("readCanonicalNotificationEligibility denies when any persisted primary identity is managed", async () => {
  const history: Query[] = [];
  const client = {
    query: async (text: string, values?: unknown[]) => {
      history.push({ text, values: values ?? [] });
      if (text.includes("notification_gate_canonical_taxon")) {
        return {
          rows: [{
            scientific_name: "Procyon lotor",
            occurrence_scientific_name: "Procyon lotor",
            persisted_scientific_names: ["Aromia bungii", "Procyon lotor"],
          }],
        };
      }
      return { rows: [] };
    },
  } as unknown as import("pg").PoolClient;

  const result = await readCanonicalNotificationEligibility(client, {
    occurrenceId: "occ-multiple-primary",
    visitId: "visit-multiple-primary",
  });

  assert.deepEqual(result, {
    allowed: false,
    reason: "managed_taxon_gate_denied",
    managedTaxonScopeKey: "kubiaka-watch",
    normalizedScientificName: "aromia bungii",
  });
  const gateSql = history.find((query) => query.text.includes("notification_gate_canonical_taxon"))?.text ?? "";
  assert.match(gateSql, /array_agg\(distinct/i);
  assert.doesNotMatch(gateSql, /max\(nullif\(btrim\(c\.scientific_name\)/i);
});

test("readCanonicalNotificationEligibility allows a persisted unmanaged identity when original is unresolved", async () => {
  const client = {
    query: async (text: string) => {
      if (text.includes("notification_gate_canonical_taxon")) {
        return {
          rows: [{
            scientific_name: "Procyon lotor",
            occurrence_scientific_name: null,
            persisted_scientific_names: ["Procyon lotor"],
          }],
        };
      }
      return { rows: [] };
    },
  } as unknown as import("pg").PoolClient;

  const result = await readCanonicalNotificationEligibility(client, {
    occurrenceId: "occ-persisted-unmanaged",
    visitId: "visit-persisted-unmanaged",
  });

  assert.deepEqual(result, {
    allowed: true,
    reason: null,
    managedTaxonScopeKey: null,
    normalizedScientificName: "procyon lotor",
  });
});
