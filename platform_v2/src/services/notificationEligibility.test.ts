import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluatePersistedNotificationIdentity,
  readCanonicalNotificationEligibility,
} from "./notificationEligibility.js";

test("D1-equivalent identity evaluation denies when any persisted identity is managed", () => {
  assert.deepEqual(evaluatePersistedNotificationIdentity({
    scientific_name: "Procyon lotor",
    occurrence_scientific_name: "Procyon lotor",
    persisted_scientific_names: ["Aromia bungii", "Procyon lotor"],
  }), {
    allowed: false,
    reason: "managed_taxon_gate_denied",
    managedTaxonScopeKey: "kubiaka-watch",
    normalizedScientificName: "aromia bungii",
  });
});

test("D1-equivalent identity evaluation allows persisted unmanaged identity", () => {
  assert.deepEqual(evaluatePersistedNotificationIdentity({
    scientific_name: "Procyon lotor",
    occurrence_scientific_name: null,
    persisted_scientific_names: ["Procyon lotor"],
  }), {
    allowed: true,
    reason: null,
    managedTaxonScopeKey: null,
    normalizedScientificName: "procyon lotor",
  });
});

test("retired PostgreSQL notification reader fails closed", async () => {
  assert.deepEqual(await readCanonicalNotificationEligibility({}, {
    occurrenceId: "occ-1",
    visitId: "visit-1",
  }), {
    allowed: false,
    reason: "notification_gate_unavailable",
    managedTaxonScopeKey: null,
    normalizedScientificName: null,
  });
});
