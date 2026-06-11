import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  SAFE_GUIDE_PROGRAM_POLICY,
  listAssignableGuideSpots,
  normalizeGuideProgramEditorInput,
} from "./guidePrograms.js";

test("guide program editor normalizes safe defaults and publishable spot assignments", () => {
  const spot = listAssignableGuideSpots().find((item) => item.id === "aikan-renri-lenri-tree");
  assert.ok(spot);

  const normalized = normalizeGuideProgramEditorInput({
    programId: "Miyakoda-Guide-Relay",
    slug: "Miyakoda-Guide-Relay",
    title: "都田ガイドリレー",
    ownerType: "community",
    participationMode: "ordered",
    status: "published",
    publicSummary: "地域のガイドを順に聞く企画",
    guideSpotIds: ["aikan-renri-lenri-tree", "aikan-renri-lenri-tree"],
  });

  assert.equal(normalized.programId, "miyakoda-guide-relay");
  assert.equal(normalized.slug, "miyakoda-guide-relay");
  assert.deepEqual(normalized.safetyPolicy, SAFE_GUIDE_PROGRAM_POLICY);
  assert.deepEqual(normalized.guideSpotIds, ["aikan-renri-lenri-tree"]);
});

test("guide program editor blocks direct unsafe spot ids and empty published programs", () => {
  assert.throws(
    () => normalizeGuideProgramEditorInput({
      programId: "empty-published-relay",
      slug: "empty-published-relay",
      title: "空の公開企画",
      status: "published",
      guideSpotIds: [],
    }),
    /invalid_guide_program_published_without_spots/,
  );

  assert.throws(
    () => normalizeGuideProgramEditorInput({
      programId: "unsafe-relay",
      slug: "unsafe-relay",
      title: "直接指定できない企画",
      status: "draft",
      guideSpotIds: ["unknown-or-unsafe-spot"],
    }),
    /invalid_guide_program_spot/,
  );
});

test("guide program editor migration records reversible admin audit", () => {
  const migration = readFileSync(join(process.cwd(), "db", "migrations", "0122_guide_program_editor_p1.sql"), "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS guide_program_audit/);
  assert.match(migration, /actor_user_id/);
  assert.match(migration, /before_payload JSONB NOT NULL/);
  assert.match(migration, /after_payload JSONB NOT NULL/);
  assert.match(migration, /idx_guide_program_audit_program_recent/);
});

test("guide program public detail reads progress without copying coordinates", () => {
  const source = readFileSync(join(process.cwd(), "src", "services", "guidePrograms.ts"), "utf8");
  assert.match(source, /getPublishedGuideProgramDetail/);
  assert.match(source, /listPublishedGuideProgramsForPublic/);
  assert.match(source, /loadUnlockedGuideSpotIds/);
  assert.match(source, /publicSpotIdsFromRows/);
  assert.match(source, /gp\.owner_type != 'school'/);
  assert.match(source, /totalRequired === 0/);
  assert.match(source, /displayLat: spot\.lat/);
  assert.match(source, /displayLng: spot\.lng/);
  assert.match(source, /locationPrecision: spot\.locationPrecision/);
  assert.match(source, /guide_unlocks/);
  assert.match(source, /state: "signed_out" \| "not_started" \| "in_progress" \| "complete"/);
  assert.doesNotMatch(source, /guide_programs[\s\S]*latitude/);
  assert.doesNotMatch(source, /guide_programs[\s\S]*longitude/);
});
