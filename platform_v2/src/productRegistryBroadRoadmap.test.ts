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
  assert.equal(
    navigation.implementation_tasks.some((task) => [M9, M10, M11, M12].includes(task.milestone_id) && task.implementation_allowed),
    false,
    "unpromoted frontier milestones must not expose an executor-eligible task",
  );
  assert.deepEqual(validateProductRegistryNavigation(navigation, new Set(registry.requirements.map((item) => item.id))), []);
});

test("execution roadmap v3 pins future delivery order without activating it", () => {
  const delivery = JSON.parse(repoText("platform_v2/product-registry/delivery.json")) as any;
  const product = JSON.parse(repoText("platform_v2/product-registry/product.json")) as any;
  assert.match(delivery.execution_roadmap.strategy_locator, /2026-09-02-zukan-development-execution-roadmap-v3\.md$/);
  assert.match(product.execution_roadmap.strategy_locator, /2026-09-02-zukan-development-execution-roadmap-v3\.md$/);
  assert.equal(delivery.execution_roadmap.selection_rule_is_executor_autonomous, false);
  assert.deepEqual(delivery.execution_roadmap.always_on_tracks, ["UX_QUALITY", "RIGHTS_SAFETY", "PRODUCT_REGISTRY_EVIDENCE", "DEMAND_LEARNING"]);
  assert.equal(delivery.roadmap.find((item: any) => item.id === "milestone.m7.program-continuity-handover")?.implementation_allowed, true);
  assert.equal(delivery.roadmap.find((item: any) => item.id === "milestone.m8.operational-summary-raw-portability")?.implementation_allowed, false);
  assert.equal(delivery.roadmap.find((item: any) => item.id === M9)?.implementation_allowed, false);
});

test("executor slot is filled by lane priority and promotion happens only at risk-class boundaries", () => {
  const delivery = JSON.parse(repoText("platform_v2/product-registry/delivery.json")) as any;
  const product = JSON.parse(repoText("platform_v2/product-registry/product.json")) as any;
  const plan = repoText("docs/spec/zukan-product-architecture/PLAN.md");
  assert.deepEqual(delivery.execution_roadmap.executor_slot_lanes, ["CORE_LOOP", "SELF_SERVE_FOUNDATION", "ROADMAP_FRONTIER"]);
  assert.equal(delivery.execution_roadmap.executor_slot_lane_rule_is_executor_autonomous, false);
  assert.deepEqual(delivery.execution_roadmap.promotion_boundaries, ["MILESTONE_DESIGN_EXIT", "FIRST_RUNTIME_MUTATION", "PRODUCTION"]);
  assert.equal(delivery.execution_roadmap.source_only_subslices_need_separate_promotion, false);
  assert.equal(delivery.execution_roadmap.m9_demand_probe_required_before_profile_code, true);
  assert.equal(delivery.execution_roadmap.m12_manual_paid_delivery_allowed_before_software, true);
  assert.match(delivery.execution_roadmap.m7_calendar_gate.m7_5_production_by, /^2027-0[1-3]$/);
  assert.ok(product.execution_roadmap.rules.includes("core_loop_defects_preempt_frontier_work"));
  assert.ok(product.execution_roadmap.rules.includes("m8a_does_not_wait_for_m7"));
  assert.match(delivery.roadmap.find((item: any) => item.id === "milestone.m8.operational-summary-raw-portability")?.decision_ref, /neither waits for M7/);
  assert.match(delivery.roadmap.find((item: any) => item.id === M10)?.existing_runtime_seed?.locator, /publicationFeedNative\.ts$/);
  assert.match(plan, /## Core Loop lane/);
  assert.match(plan, /## NEEDS_DECISION/);
  assert.doesNotMatch(plan, /`ACTIVE`: M7/, "PLAN.md must not carry a second copy of the rolling frontier");
  assert.doesNotMatch(repoText("docs/spec/zukan-product-architecture/PROFILE_HORIZON.md"), /`ACTIVE`: M7/);
  assert.doesNotMatch(repoText("docs/spec/zukan-product-architecture/SPEC.md"), /`ACTIVE`: M7/);
});

test("M9 default profile order starts with photo contest and reuses mission for stamp rally", () => {
  const delivery = JSON.parse(repoText("platform_v2/product-registry/delivery.json")) as any;
  const m9 = delivery.roadmap.find((item: any) => item.id === M9);
  assert.deepEqual(m9.default_priority_groups, [
    ["photo_contest"],
    ["mission_town_walk"],
    ["children_citizen_editorial", "sketch_drawing_event"],
    ["tourism_regional_engagement"],
  ]);
  assert.equal(m9.stamp_rally_initial_mode, "MISSION_TOWN_WALK_VARIATION");
  assert.ok(m9.promotion_conditions.includes("product authority records selected profile"));
});

test("M10 M11 and M12 keep the planned reusable order", () => {
  const delivery = JSON.parse(repoText("platform_v2/product-registry/delivery.json")) as any;
  const m10 = delivery.roadmap.find((item: any) => item.id === M10);
  const m11 = delivery.roadmap.find((item: any) => item.id === M11);
  const m12 = delivery.roadmap.find((item: any) => item.id === M12);
  assert.deepEqual(m10.default_priority, [
    "program_campaign_result",
    "regional_theme_encyclopedia",
    "history_culture_collection",
    "tourism_map_guide_route",
    "facility_shop_organization_collection",
    "consented_people_profile",
    "paper_pdf_manifest",
    "api_dataset_projection",
  ]);
  assert.deepEqual(m11.default_slice_order, [
    "M11-A_SOURCE_EXCHANGE_PACKAGE_V1",
    "M11-B_NOCOSIL_TO_ZUKAN",
    "M11-C_EXTERNAL_PUBLISHER_ADAPTERS",
    "M11-D_CORRECTION_REVOCATION_WRITEBACK",
  ]);
  assert.deepEqual(m12.outcome_families, ["PROFESSIONAL_REPORT", "PUBLICATION_PRODUCTION", "MANAGED_PROGRAM", "INTEGRATION_DATA_WORK"]);
});

test("planning metrics are baselines and privacy-minimized", () => {
  const delivery = JSON.parse(repoText("platform_v2/product-registry/delivery.json")) as any;
  assert.equal(delivery.planning_metrics.mode, "BASELINE_BEFORE_TARGETS");
  assert.deepEqual(delivery.planning_metrics.core_loop_baselines, [
    "first_record_completion",
    "ai_feedback_delivery_delay",
    "review_lead_time",
    "place_revisit_rate",
    "publication_feed_inclusion_count",
  ]);
  assert.deepEqual(delivery.planning_metrics.frontier_baselines, [
    "program_self_start_rate",
    "join_completion",
    "handover_completion",
    "raw_portability_success",
    "repeat_program_rate",
    "publication_reuse",
  ]);
  assert.deepEqual(delivery.planning_metrics.business_baselines_recorded_by_operations, [
    "support_minutes_per_program",
    "paid_outcome_conversion",
  ]);
  assert.equal(delivery.planning_metrics.privacy_minimization_required, true);
  assert.equal("metrics" in delivery.planning_metrics, false, "a single flat metric list hides measurement maturity");
});

test("delivery means production while blockers preserve independent source work", () => {
  const delivery = JSON.parse(repoText("platform_v2/product-registry/delivery.json")) as any;
  const product = JSON.parse(repoText("platform_v2/product-registry/product.json")) as any;
  const plan = repoText("docs/spec/zukan-product-architecture/PLAN.md");
  assert.match(delivery.execution_roadmap.delivered_definition, /running in production and observed working/);
  assert.match(delivery.execution_roadmap.landing_rule, /continue independent adopted source/);
  assert.match(delivery.execution_roadmap.landing_rule, /Never rename, replay, retarget/);
  assert.equal(delivery.execution_roadmap.core_loop_returns_something_to_contributor, true);
  assert.equal("current_executor_task_id" in delivery.execution_roadmap, false);
  assert.match(delivery.execution_roadmap.current_work_locator, /noah_current_work_queue/);
  assert.ok(product.execution_roadmap.rules.includes("delivered_means_running_in_production_and_observed_working"));
  assert.ok(product.execution_roadmap.rules.includes("scoped_blockers_preserve_identity_and_allow_independent_adopted_source_work"));
  assert.ok(product.execution_roadmap.rules.includes("implementation_allowed_never_authorizes_production_mutation"));
  assert.match(plan, /## Current execution frontier/);
  assert.doesNotMatch(plan, /mergeable, clean|59 pull requests|44 have not moved/);
  for (const requirementId of delivery.execution_roadmap.core_loop_requirements_requiring_operation_evidence) {
    const requirement = registry.requirements.find((item) => item.id === requirementId);
    assert.ok(requirement, `${requirementId} must exist`);
    assert.ok(
      requirement?.environments.includes("operation"),
      `${requirementId} is a Core Loop requirement and must be verified where real users are, not only in staging`,
    );
  }
});

test("the accumulation and review-return stages of the Core Loop are contracted", () => {
  const place = registry.requirements.find((item) => item.id === "quality.zukan.place.record-accumulation-visible");
  const review = registry.requirements.find((item) => item.id === "quality.zukan.review.contributor-return");
  assert.ok(place, "the Place accumulation stage needs a requirement, not only a design document");
  assert.ok(review, "the contributor must be told the outcome of a human Review of their own record");
  assert.ok(registry.surfaces.some((item) => item.id === "zukan.place.detail"), "the Area Encyclopedia needs a registered surface");
  const delivery = JSON.parse(repoText("platform_v2/product-registry/delivery.json")) as any;
  const quality = JSON.parse(repoText("platform_v2/product-registry/quality.json")) as any;
  const areaTask = delivery.implementation_tasks.find((item: any) => item.id === "task.zukan.core-loop.area-encyclopedia-shared-renderer");
  const loopTask = delivery.implementation_tasks.find((item: any) => item.id === "task.zukan.core-loop.capture-feedback-delivered");
  const publicationTask = delivery.implementation_tasks.find((item: any) => item.id === "task.zukan.core-loop.publication-return-syndication-hardening");
  assert.ok(areaTask && loopTask && publicationTask, "adopted Core Loop corrections need implementation tasks");
  assert.equal(loopTask.lane, "CORE_LOOP");
  assert.equal(loopTask.implementation_allowed, false, "a static registry must not reissue terminal capture work");
  assert.equal(loopTask.production_mutation_allowed, false);
  assert.equal(areaTask.implementation_allowed, false, "Area keeps its original acceptance Work and failed execution binding");
  assert.equal(areaTask.production_mutation_allowed, false);
  assert.equal(publicationTask.implementation_allowed, true, "independent adopted source does not wait for Area runtime acceptance");
  assert.ok(publicationTask.stage_dependencies.integrated_acceptance.includes("actual Area zero/one-record acceptance"));
  assert.equal(publicationTask.stage_dependencies.source.some((dependency: string) => /Area/.test(dependency)), false);
  assert.equal(publicationTask.production_mutation_allowed, false);
  assert.ok(publicationTask.requirement_ids.includes("quality.zukan.rights.minor-guardian-consent"));
  assert.ok(publicationTask.requirement_ids.includes("quality.zukan.rights.export-withdrawal-deletion"));
  const captureJourney = registry.journeys.find((item) => item.id === "journey.zukan.capture-to-personal-return");
  assert.equal(captureJourney?.success_surface, "zukan.record.detail");
  assert.ok(captureJourney?.steps.some((step) => step.surface === "zukan.record.detail" && /queued\/processing\/completed\|failed/.test(step.action)));
  assert.ok(registry.surfaces.some((item) => item.id === "zukan.record.detail" && item.route === "/observations/:id"));
  const captureMatrix = registry.capabilityMatrix.find((item) => item.domain === "capture");
  const placeMatrix = registry.capabilityMatrix.find((item) => item.domain === "place-accumulation");
  assert.equal(captureMatrix?.capability_refs.includes("zukan.place.view-accumulation"), false);
  assert.ok(placeMatrix?.capability_refs.includes("zukan.place.view-accumulation"));
  for (const id of ["prop.place.first-record-changes-page", "prop.place.nearby-never-counts-as-local", "prop.review.contributor-sees-decision"]) {
    assert.equal(quality.negative_property_tests.find((item: any) => item.id === id)?.current_test, "planned", `${id} must not claim unrelated test coverage`);
  }
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
  assert.match(horizon, /stamp_rally.*variation/);
  assert.match(horizon, /Executors do not select or reorder profiles autonomously/);
});

test("publication horizon includes people profiles without identification or tracking", () => {
  const horizon = repoText("docs/spec/zukan-product-architecture/PROFILE_HORIZON.md");
  assert.match(horizon, /people\/profile encyclopedia/i);
  assert.match(horizon, /face\/biometric identification/);
  assert.match(horizon, /correction\/withdrawal/);
});

test("NOCOSIL exchange remains an explicit public-safe projection boundary", () => {
  const horizon = repoText("docs/spec/zukan-product-architecture/PROFILE_HORIZON.md");
  assert.match(horizon, /NOCOSIL private\/source truth -> explicit selected public-safe projection/);
  assert.match(horizon, /no raw private auto-publication/);
  assert.match(horizon, /no shared giant database/);
  assert.match(horizon, /M11-A Source Exchange Package v1/);
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

test("product-level shell and Home copy stays regional-record first", () => {
  const forbiddenProductTerms = /\b(?:species|taxon|biodiversity|wildlife)\b|生きもの|生物多様性|観察会|observación|espécie|especie/iu;
  for (const lang of ["ja", "en", "es", "pt-BR"]) {
    const shared = JSON.parse(repoText(`platform_v2/src/content/short/${lang}/shared.json`)) as any;
    const shellText = [
      shared.shell.brandTagline,
      shared.shell.searchPlaceholder,
      shared.shell.searchLabel,
      shared.shell.nav.home,
      shared.shell.nav.explore,
      shared.shell.nav.places,
      shared.shell.nav.community,
      shared.shell.footer.tagline,
      shared.shell.footer.heading,
      shared.shell.footer.body,
      shared.footerNotes.landing,
      shared.footerNotes.public,
    ].join(" ");
    assert.doesNotMatch(shellText, forbiddenProductTerms, `${lang} shared shell must not define the product as a biodiversity or observation-only service`);
  }

  const content = JSON.parse(repoText("platform_v2/product-registry/content.json")) as any;
  const homeContracts = content.contracts.filter((contract: any) => ["content.zukan.home-public", "content.zukan.home-member"].includes(contract.id));
  assert.equal(homeContracts.length, 2);
  assert.doesNotMatch(homeContracts.map((contract: any) => `${contract.audience} ${contract.user_intent} ${contract.primary_message}`).join(" "), /生きもの|観察会|species|taxon|biodiversity/i);
});
