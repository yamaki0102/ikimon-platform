import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadProductRegistry } from "./productRegistry.js";
import { loadProductRegistryNavigation, validateProductRegistryNavigation } from "./productRegistryNavigation.js";

const registry = loadProductRegistry();
const navigation = loadProductRegistryNavigation();
const repoText = (path: string): string => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const M9 = "milestone.m9.regional-program-profiles";
const M10 = "milestone.m10.regional-publication-profiles";
const M11 = "milestone.m11.source-public-projection-exchange";
const M12 = "milestone.m12.professional-managed-outcomes";

test("roadmap preserves broad ZUKAN scope after M6", () => {
  const ids = navigation.roadmap.map((item) => item.id);
  assert.deepEqual(ids.slice(-4), [M9, M10, M11, M12]);
  assert.equal(navigation.rolling_frontier.active, "milestone.m7.program-continuity-handover");
  assert.equal(navigation.rolling_frontier.ready_next, "milestone.m8.operational-summary-raw-portability");
  assert.equal(navigation.rolling_frontier.shaped_next, M9);
  assert.deepEqual(navigation.rolling_frontier.deferred, ["milestone.m5.live-camera-poc"]);
  assert.equal(navigation.rolling_frontier.max_executor_implementation_tasks, 1);
  assert.equal(navigation.implementation_tasks.some((task) => [M9, M10, M11, M12].includes(task.milestone_id)), false);
  assert.deepEqual(validateProductRegistryNavigation(navigation, new Set(registry.requirements.map((item) => item.id))), []);
});

test("M9 profile horizon includes non-biological civic and tourism programs", () => {
  const horizon = repoText("docs/spec/zukan-product-architecture/PROFILE_HORIZON.md");
  for (const profile of [
    "photo_contest",
    "sketch_drawing_event",
    "mission_town_walk",
    "stamp_rally",
    "children_citizen_editorial",
    "tourism_regional_engagement",
  ]) {
    assert.match(horizon, new RegExp(`\\b${profile}\\b`));
  }
  assert.match(horizon, /Biodiversity is one Domain Pack/);
  assert.match(horizon, /観察会.*one Program profile/);
});

test("publication horizon includes people profiles without identification or tracking", () => {
  const horizon = repoText("docs/spec/zukan-product-architecture/PROFILE_HORIZON.md");
  assert.match(horizon, /people encyclopedia|person profile publication/i);
  assert.match(horizon, /face\/biometric identification/);
  assert.match(horizon, /correction\/withdrawal/);
});

test("NOCOSIL exchange remains an explicit public-safe projection boundary", () => {
  const horizon = repoText("docs/spec/zukan-product-architecture/PROFILE_HORIZON.md");
  assert.match(horizon, /NOCOSIL private\/source truth -> explicit selected public-safe projection/);
  assert.match(horizon, /no raw private auto-publication/);
  assert.match(horizon, /no shared giant database/);
});

test("App Experience uses stable participation IA without pretending future profiles are live", () => {
  const experience = repoText("docs/spec/zukan-app-experience/ZUKAN_APP_EXPERIENCE_V1.md");
  assert.match(experience, /ホーム`\n2\. `記録`\n3\. `場所`\n4\. `参加`\n5\. `自分`/);
  assert.match(experience, /観察会.*one.*Program profile/);
  assert.match(experience, /Do not expose planned M9\+ profiles as usable/);
  assert.match(experience, /current truthful capability/);
});

test("product root and north star reject biodiversity-only framing", () => {
  const product = JSON.parse(repoText("platform_v2/product-registry/product.json")) as any;
  const outcomes = JSON.parse(repoText("platform_v2/product-registry/outcomes.json")) as any;
  assert.match(product.primary_outcome, /Source.*写真.*文書.*活動/);
  assert.match(outcomes.north_star.statement, /写真.*文書.*活動/);
  assert.ok(outcomes.north_star.non_goals.includes("ZUKANを生物多様性・種観察だけの製品に固定する"));
  assert.ok(outcomes.north_star.non_goals.includes("観察会を唯一のProgram profileにする"));
});
