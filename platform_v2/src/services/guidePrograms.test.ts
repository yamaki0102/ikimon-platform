import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  SAFE_GUIDE_PROGRAM_POLICY,
  guideProgramRateBucket,
  listAssignableGuideSpots,
  normalizeGuideProgramEditorInput,
  roundedGuideParticipantCount,
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

test("guide program recap suppresses small cohorts and buckets rates", () => {
  assert.equal(roundedGuideParticipantCount(0), null);
  assert.equal(roundedGuideParticipantCount(2), null);
  assert.equal(roundedGuideParticipantCount(3), null);
  assert.equal(roundedGuideParticipantCount(5), 5);
  assert.equal(roundedGuideParticipantCount(9), 5);
  assert.equal(roundedGuideParticipantCount(12), 10);

  assert.equal(guideProgramRateBucket({ numerator: 1, denominator: 2, participants: 2 }), "suppressed");
  assert.equal(guideProgramRateBucket({ numerator: 0, denominator: 8, participants: 5 }), "none");
  assert.equal(guideProgramRateBucket({ numerator: 1, denominator: 8, participants: 5 }), "starting");
  assert.equal(guideProgramRateBucket({ numerator: 3, denominator: 8, participants: 5 }), "building");
  assert.equal(guideProgramRateBucket({ numerator: 7, denominator: 8, participants: 5 }), "strong");
  assert.equal(guideProgramRateBucket({ numerator: 1, denominator: 0, participants: 5 }), "not_applicable");
});

test("guide program recap read model avoids route, coordinate, and user-level output", () => {
  const source = readFileSync(join(process.cwd(), "src", "services", "guidePrograms.ts"), "utf8");
  assert.match(source, /buildGuideProgramRecap/);
  assert.match(source, /guide_program_recap\/v1/);
  assert.match(source, /exactCoordinatesIncluded: false/);
  assert.match(source, /userLevelRowsIncluded: false/);
  assert.match(source, /guideUnlockCount: smallCohortSuppressed \? null : guideUnlockCount/);
  assert.match(source, /guidePlayCount: smallCohortSuppressed \? null : guidePlayCount/);
  assert.match(source, /participant_count_below_k_anonymity_threshold/);
  assert.match(source, /spot_window_breakdown_disabled_in_p0/);
  assert.match(source, /\/community\/events\/new/);
  assert.doesNotMatch(source, /guide_unlocks[\s\S]*latitude/);
  assert.doesNotMatch(source, /guide_unlocks[\s\S]*longitude/);
  assert.doesNotMatch(source, /route_points|track_points|path_geometry/);
});
