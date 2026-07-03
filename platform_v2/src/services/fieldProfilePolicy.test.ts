import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  FIELD_PROFILE_POLICY_VERSION,
  normalizeFieldProfilePolicy,
  resolveFieldProfileView,
} from "./fieldProfilePolicy.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));

test("field profile policy defaults keep area profiles private and site-level", () => {
  const policy = normalizeFieldProfilePolicy({});

  assert.equal(policy.profileStatus, "draft");
  assert.equal(policy.defaultPublicLocationMode, "site");
  assert.equal(policy.publicProfileEnabled, false);
  assert.equal(policy.profilePolicyVersion, FIELD_PROFILE_POLICY_VERSION);
  assert.equal(policy.profileNotes, "");
});

test("public view only exposes enabled public summaries and clamps exact location", () => {
  const policy = normalizeFieldProfilePolicy({
    profileStatus: "public_summary",
    defaultPublicLocationMode: "exact",
    publicProfileEnabled: true,
    profileNotes: "manager-only note",
  });

  const publicView = resolveFieldProfileView(policy, "public");
  const managerView = resolveFieldProfileView(policy, "manager");

  assert.equal(publicView.publicProfileEnabled, true);
  assert.equal(publicView.publicLocationMode, "site");
  assert.equal(publicView.profileNotes, undefined);
  assert.equal(managerView.publicLocationMode, "exact");
  assert.equal(managerView.profileNotes, "manager-only note");
});

test("public view stays suppressed until the profile reaches public summary", () => {
  const policy = normalizeFieldProfilePolicy({
    profileStatus: "manager_review",
    defaultPublicLocationMode: "grid_250m",
    publicProfileEnabled: true,
  });

  const publicView = resolveFieldProfileView(policy, "public");
  const internalView = resolveFieldProfileView(policy, "internal");

  assert.equal(publicView.publicProfileEnabled, false);
  assert.equal(publicView.suppressionReason, "profile_not_public");
  assert.equal(internalView.publicProfileEnabled, true);
  assert.equal(internalView.publicLocationMode, "grid_250m");
});

test("field profile policy rejects unknown enum values and trims notes", () => {
  const policy = normalizeFieldProfilePolicy({
    profileStatus: "published",
    defaultPublicLocationMode: "gps",
    publicProfileEnabled: "yes",
    profilePolicyVersion: "",
    profileNotes: `  ${"x".repeat(700)}  `,
  });

  assert.equal(policy.profileStatus, "draft");
  assert.equal(policy.defaultPublicLocationMode, "site");
  assert.equal(policy.publicProfileEnabled, false);
  assert.equal(policy.profilePolicyVersion, FIELD_PROFILE_POLICY_VERSION);
  assert.equal(policy.profileNotes.length, 600);
});

test("field profile migration is additive and fail-closed by default", () => {
  const sql = readFileSync(
    path.join(dirname, "..", "..", "db", "migrations", "0125_site_intelligence_field_profile_foundation.sql"),
    "utf8",
  );

  assert.match(sql, /ADD COLUMN IF NOT EXISTS profile_status TEXT NOT NULL DEFAULT 'draft'/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS default_public_location_mode TEXT NOT NULL DEFAULT 'site'/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS public_profile_enabled BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(sql, /profile_status IN \('draft', 'private', 'public_summary', 'manager_review', 'hidden'\)/);
  assert.match(sql, /default_public_location_mode IN \('exact', 'site', 'grid_250m', 'grid_1km', 'municipality', 'hidden'\)/);
  assert.doesNotMatch(sql, /^\s*(DROP|TRUNCATE|DELETE)\b/im);
});
