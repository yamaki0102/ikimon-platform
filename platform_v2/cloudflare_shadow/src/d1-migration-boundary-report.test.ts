import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

function loadClassifyPg(script: string): (text: string) => string[] {
  const match = script.match(/function classifyPg\(text\) \{[\s\S]*?\n\}/);
  const vectorMatch = script.match(/function hasPgVectorSignal\(text\) \{[\s\S]*?\n\}/);
  assert.ok(match, "classifyPg function is present");
  assert.ok(vectorMatch, "hasPgVectorSignal function is present");
  return new Function(`${vectorMatch[0]}; ${match[0]}; return classifyPg;`)() as (text: string) => string[];
}

function loadIsNoRuntimeQueryPgInventoryOnly(script: string): (item: { flags: string[] }) => boolean {
  const flagsMatch = script.match(/const PG_INVENTORY_ONLY_FLAGS = new Set\(\[[\s\S]*?\]\);/);
  const match = script.match(/function isNoRuntimeQueryPgInventoryOnly\(item\) \{[\s\S]*?\n\}/);
  assert.ok(flagsMatch, "PG_INVENTORY_ONLY_FLAGS constant is present");
  assert.ok(match, "isNoRuntimeQueryPgInventoryOnly function is present");
  return new Function(`${flagsMatch[0]}; ${match[0]}; return isNoRuntimeQueryPgInventoryOnly;`)() as (item: { flags: string[] }) => boolean;
}

function loadIsTestSourceFile(script: string): (relativeFile: string) => boolean {
  const match = script.match(/function isTestSourceFile\(relativeFile\) \{[\s\S]*?\n\}/);
  assert.ok(match, "isTestSourceFile function is present");
  return new Function(`${match[0]}; return isTestSourceFile;`)() as (relativeFile: string) => boolean;
}

function loadMaintenancePgDependencyReason(script: string): (relativeFile: string) => string | null {
  const match = script.match(/function maintenancePgDependencyReason\(relativeFile\) \{[\s\S]*?\n\}/);
  assert.ok(match, "maintenancePgDependencyReason function is present");
  return new Function(`${match[0]}; return maintenancePgDependencyReason;`)() as (relativeFile: string) => string | null;
}

function loadReplacedProductionRuntimePgDependencyReason(script: string): (relativeFile: string) => string | null {
  const match = script.match(/function replacedProductionRuntimePgDependencyReason\(relativeFile\) \{[\s\S]*?\n\}/);
  assert.ok(match, "replacedProductionRuntimePgDependencyReason function is present");
  return new Function(`${match[0]}; return replacedProductionRuntimePgDependencyReason;`)() as (relativeFile: string) => string | null;
}

async function findTsFilesContaining(root: string, needle: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const matches: string[] = [];
  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      matches.push(...await findTsFilesContaining(absolutePath, needle));
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".ts")) {
      continue;
    }
    const content = await readFile(absolutePath, "utf8");
    if (content.includes(needle)) {
      matches.push(absolutePath);
    }
  }
  return matches;
}

function loadOptionalRuntimePgDependencyReason(script: string): (relativeFile: string) => string | null {
  const match = script.match(/function optionalRuntimePgDependencyReason\(relativeFile\) \{[\s\S]*?\n\}/);
  assert.ok(match, "optionalRuntimePgDependencyReason function is present");
  return new Function(`${match[0]}; return optionalRuntimePgDependencyReason;`)() as (relativeFile: string) => string | null;
}

function loadMaintenanceWorkflowDependencyReason(script: string): (relativeFile: string) => string | null {
  const match = script.match(/function maintenanceWorkflowDependencyReason\(relativeFile\) \{[\s\S]*?\n\}/);
  assert.ok(match, "maintenanceWorkflowDependencyReason function is present");
  return new Function(`${match[0]}; return maintenanceWorkflowDependencyReason;`)() as (relativeFile: string) => string | null;
}

function loadWorkflowDependencySignals(script: string): (text: string) => string[] {
  const match = script.match(/function workflowDependencySignals\(text\) \{[\s\S]*?\n\}/);
  assert.ok(match, "workflowDependencySignals function is present");
  return new Function(`${match[0]}; return workflowDependencySignals;`)() as (text: string) => string[];
}

function loadExclusiveMaintenancePgDependencyReason(script: string): (
  relativeFile: string,
  importersByTarget: Map<string, Set<string>>,
) => string | null {
  const isTestMatch = script.match(/function isTestSourceFile\(relativeFile\) \{[\s\S]*?\n\}/);
  const maintenanceMatch = script.match(/function maintenancePgDependencyReason\(relativeFile\) \{[\s\S]*?\n\}/);
  const forcedRuntimeMatch = script.match(/function forcedRuntimePgDependency\(relativeFile\) \{[\s\S]*?\n\}/);
  const exclusiveMatch = script.match(/function exclusiveMaintenancePgDependencyReason\(relativeFile, importersByTarget, seen = new Set\(\)\) \{[\s\S]*?\n\}/);
  assert.ok(isTestMatch, "isTestSourceFile function is present");
  assert.ok(maintenanceMatch, "maintenancePgDependencyReason function is present");
  assert.ok(forcedRuntimeMatch, "forcedRuntimePgDependency function is present");
  assert.ok(exclusiveMatch, "exclusiveMaintenancePgDependencyReason function is present");
  return new Function(
    `${isTestMatch[0]}; ${maintenanceMatch[0]}; ${forcedRuntimeMatch[0]}; ${exclusiveMatch[0]}; return exclusiveMaintenancePgDependencyReason;`,
  )() as (relativeFile: string, importersByTarget: Map<string, Set<string>>) => string | null;
}

function loadClassifyFallbackReason(script: string): (reason: string) => string {
  const match = script.match(/function classifyFallbackReason\(reason\) \{[\s\S]*?\n\}/);
  assert.ok(match, "classifyFallbackReason function is present");
  return new Function(`${match[0]}; return classifyFallbackReason;`)() as (reason: string) => string;
}

function assertCurrentVpsBlockerBaseline(stdout: string): void {
  const gate = stdout.match(/## Configured Production VPS Stop Readiness Gate[\s\S]*?(?=\n## Migration Priority Heuristic)/)?.[0];
  assert.ok(gate, "configured VPS stop readiness gate is present");
  assert.match(gate, /- blocker_count: 0/);
  assert.match(gate, /- p1_blockers: 0/);
  for (const file of [
    "platform_v2/src/routes/kubiakaFocusedExperience.ts",
    "platform_v2/src/routes/kubiakaPrivateUploadGuard.ts",
    "platform_v2/src/services/kubiakaPrivateRecordsReadModel.ts",
    "platform_v2/src/services/notificationEligibility.ts",
  ]) {
    assert.ok(!gate.includes(file), `configured blocker baseline excludes ${file}`);
  }
  assert.doesNotMatch(gate, /health\.ts|read\.ts|placeRegistryContract\.ts/);
}

test("VPS stop readiness counts every runtime PostgreSQL dependency, not only displayed rows", async () => {
  const script = await readFile(path.join(process.cwd(), "scripts", "d1-migration-boundary-report.mjs"), "utf8");

  assert.match(script, /const PG_DEPENDENCY_TABLE_LIMIT = 80;/);
  assert.match(script, /const runtimePgFiles = pgFiles\.filter/);
  assert.match(script, /const noRuntimeQueryPgInventoryFiles = pgFiles\.filter/);
  assert.match(script, /\.\.\.runtimePgFiles\.map\(\(item\) => \(\{/);
  assert.match(script, /PostgreSQL Test Source Dependencies/);
  assert.match(script, /PostgreSQL No-Runtime-Query Inventory/);
  assert.match(script, /runtimeImportedTestSourceFiles\.has\(item\.file\)/);
  assert.match(script, /runtime_imported_test_pg_dependency_files/);
  assert.match(script, /no_runtime_query_pg_inventory_files/);
  assert.match(script, /exclusiveMaintenancePgDependencyReason\(item\.file, importersByTarget\)/);
  assert.match(script, /PostgreSQL Maintenance Dependencies/);
  assert.match(script, /PostgreSQL Cloudflare-Replaced Production Runtime/);
  assert.match(script, /replacedProductionRuntimePgDependencyReason\(item\.file\)/);
  assert.match(script, /replaced_production_runtime_pg_dependency_files/);
  assert.match(script, /PostgreSQL Optional Runtime Dependencies/);
  assert.match(script, /optionalRuntimePgDependencyReason\(item\.file\)/);
  assert.match(script, /optional_runtime_pg_dependency_files/);
  assert.match(script, /const maintenanceVpsWorkflows = vpsWorkflows/);
  assert.match(script, /const runtimeVpsWorkflows = vpsWorkflows\.filter/);
  assert.match(script, /workflowDependencySignals\(text\)/);
  assert.match(script, /VPS Workflow Runtime Dependencies/);
  assert.match(script, /VPS Workflow Maintenance Dependencies/);
  assert.match(script, /blocker_scope: files with PostgreSQL runtime query APIs, vector\/full-text signals, or locking signals/);
  assert.match(script, /displayed_pg_dependencies/);
  assert.doesNotMatch(script, /\.\.\.runtimePgFiles\.slice\(0,\s*80\)\.map\(\(item\) => \(\{/);
});

test("VPS stop readiness keeps no-runtime-query PostgreSQL signals as inventory, not blockers", async () => {
  const script = await readFile(path.join(process.cwd(), "scripts", "d1-migration-boundary-report.mjs"), "utf8");
  const isNoRuntimeQueryPgInventoryOnly = loadIsNoRuntimeQueryPgInventoryOnly(script);
  const replacedProductionRuntimePgDependencyReason = loadReplacedProductionRuntimePgDependencyReason(script);

  assert.equal(isNoRuntimeQueryPgInventoryOnly({ flags: ["postgis"] }), true);
  assert.equal(isNoRuntimeQueryPgInventoryOnly({ flags: ["postgis", "pg_types"] }), true);
  assert.equal(isNoRuntimeQueryPgInventoryOnly({ flags: ["pg_types"] }), true);
  assert.equal(isNoRuntimeQueryPgInventoryOnly({ flags: ["pg_env"] }), true);
  assert.equal(isNoRuntimeQueryPgInventoryOnly({ flags: ["postgis", "runtime_query"] }), false);
  assert.equal(isNoRuntimeQueryPgInventoryOnly({ flags: ["pg_env", "runtime_query"] }), false);
  assert.equal(isNoRuntimeQueryPgInventoryOnly({ flags: ["vector"] }), false);
  assert.equal(isNoRuntimeQueryPgInventoryOnly({ flags: ["row_locking", "pg_types"] }), false);

  const result = spawnSync(process.execPath, ["scripts/d1-migration-boundary-report.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /## PostgreSQL No-Runtime-Query Inventory/);
  const inventoryCount = Number(
    result.stdout.match(/- no_runtime_query_pg_inventory_files: (\d+)/)?.[1] ?? "0",
  );
  assert.ok(inventoryCount >= 15, `expected at least the established 15 inventory files, got ${inventoryCount}`);
  assert.match(result.stdout, /platform_v2\/src\/routes\/health\.ts/);
  assert.match(result.stdout, /platform_v2\/src\/routes\/read\.ts/);
  assert.match(result.stdout, /platform_v2\/src\/services\/placeRegistryContract\.ts/);
  assert.match(result.stdout, /platform_v2\/src\/scripts\/backfillUniversalPlaceAtlas\.ts/);
  assert.equal(
    replacedProductionRuntimePgDependencyReason("platform_v2/src/services/placeAtlasProfile.ts"),
    "cloudflare_place_atlas_profile_native",
  );
  assert.equal(
    replacedProductionRuntimePgDependencyReason("platform_v2/src/services/placeRegistry.ts"),
    "cloudflare_place_registry_native",
  );
  assertCurrentVpsBlockerBaseline(result.stdout);
});

test("VPS stop readiness separates runtime deploy workflows from maintenance workflows", async () => {
  const script = await readFile(path.join(process.cwd(), "scripts", "d1-migration-boundary-report.mjs"), "utf8");
  const maintenanceWorkflowDependencyReason = loadMaintenanceWorkflowDependencyReason(script);
  const workflowDependencySignals = loadWorkflowDependencySignals(script);

  assert.equal(maintenanceWorkflowDependencyReason(".github/workflows/ci.yml"), "ci_local_postgres_service");
  assert.equal(maintenanceWorkflowDependencyReason(".github/workflows/curator-staging-wet-run.yml"), "manual_staging_wet_run");
  assert.equal(maintenanceWorkflowDependencyReason(".github/workflows/enhance-school-boundaries.yml"), "manual_import_or_repair_workflow");
  assert.equal(maintenanceWorkflowDependencyReason(".github/workflows/import-n03-admin.yml"), "manual_import_or_repair_workflow");
  assert.equal(maintenanceWorkflowDependencyReason(".github/workflows/import-osm-area-parks.yml"), "manual_import_or_repair_workflow");
  assert.equal(maintenanceWorkflowDependencyReason(".github/workflows/import-school-fields.yml"), "manual_import_or_repair_workflow");
  assert.equal(maintenanceWorkflowDependencyReason(".github/workflows/refresh-observation-ai.yml"), "manual_ai_batch_workflow");
  assert.deepEqual(workflowDependencySignals("- VPS SSH/deploy: `not used`"), []);
  assert.deepEqual(workflowDependencySignals("uses: appleboy/ssh-action@v1"), ["ssh/scp"]);
  assert.deepEqual(workflowDependencySignals("ssh -i ~/.ssh/ikimon_vps root@162.43.44.131"), ["ssh/scp"]);
  assert.deepEqual(workflowDependencySignals("DATABASE_URL=\"$V2_STAGING_DATABASE_URL\" npm run migrate"), ["DATABASE_URL"]);

  const result = spawnSync(process.execPath, ["scripts/d1-migration-boundary-report.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /## VPS Workflow Runtime Dependencies/);
  assert.match(result.stdout, /- runtime_vps_workflow_files: 0/);
  assert.doesNotMatch(result.stdout, /## VPS Workflow Runtime Dependencies[\s\S]*\.github\/workflows\/deploy-staging\.yml[\s\S]*## VPS Workflow Maintenance Dependencies/);
  assert.doesNotMatch(result.stdout, /## VPS Workflow Runtime Dependencies[\s\S]*\.github\/workflows\/cloudflare-shadow-release\.yml[\s\S]*## VPS Workflow Maintenance Dependencies/);
  assert.doesNotMatch(result.stdout, /## VPS Workflow Runtime Dependencies[\s\S]*\.github\/workflows\/deploy-cloudflare-staging\.yml[\s\S]*## VPS Workflow Maintenance Dependencies/);
  assert.doesNotMatch(result.stdout, /## VPS Workflow Runtime Dependencies[\s\S]*\.github\/workflows\/deploy\.yml[\s\S]*## VPS Workflow Maintenance Dependencies/);
  assert.match(result.stdout, /## VPS Workflow Maintenance Dependencies/);
  assert.match(result.stdout, /- maintenance_vps_workflow_files: 0/);
  assert.doesNotMatch(result.stdout, /\| \.github\/workflows\//);
  assert.doesNotMatch(result.stdout, /legacy_vps_staging_replaced_by_cloudflare_staging/);
  assert.doesNotMatch(result.stdout, /manual_import_or_repair_workflow/);
  assertCurrentVpsBlockerBaseline(result.stdout);
});

test("VPS stop readiness classifies test source paths conservatively", async () => {
  const script = await readFile(path.join(process.cwd(), "scripts", "d1-migration-boundary-report.mjs"), "utf8");
  const isTestSourceFile = loadIsTestSourceFile(script);

  assert.equal(isTestSourceFile("platform_v2/src/services/mapSnapshot.test.ts"), true);
  assert.equal(isTestSourceFile("platform_v2/src/scripts/applyMigrations.source.test.ts"), true);
  assert.equal(isTestSourceFile("platform_v2/src/routes/__tests__/guideApi.ts"), true);
  assert.equal(isTestSourceFile("platform_v2/tests/helpers/db-setup.ts"), true);
  assert.equal(isTestSourceFile("platform_v2/src/__mocks__/pg.ts"), true);

  assert.equal(isTestSourceFile("platform_v2/src/services/mapSnapshot.ts"), false);
  assert.equal(isTestSourceFile("platform_v2/src/services/latestObservations.ts"), false);
  assert.equal(isTestSourceFile("platform_v2/src/services/contestEntry.ts"), false);
});

test("VPS stop readiness excludes explicit maintenance-only PostgreSQL scripts from runtime blockers", async () => {
  const script = await readFile(path.join(process.cwd(), "scripts", "d1-migration-boundary-report.mjs"), "utf8");
  const maintenancePgDependencyReason = loadMaintenancePgDependencyReason(script);
  const replacedProductionRuntimePgDependencyReason = loadReplacedProductionRuntimePgDependencyReason(script);
  const optionalRuntimePgDependencyReason = loadOptionalRuntimePgDependencyReason(script);
  const exclusiveMaintenancePgDependencyReason = loadExclusiveMaintenancePgDependencyReason(script);

  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/applyMigrations.ts"), "migration_cli_tool");
  assert.equal(
    maintenancePgDependencyReason(
      "platform_v2/src/scripts/applyZukanFoundationV2SourceRegistryImport.ts",
    ),
    "foundation_v2_operator_apply_tool",
  );
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/embedRegionalKnowledgeCards.ts"), "manual_embedding_batch");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/reportMissingObservationPhotos.ts"), "manual_integrity_report");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/importObservationFields.ts"), "manual_field_import");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/ingestPlaceEnvironmentSnapshots.ts"), "manual_environment_ingest");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/importN03Administrative.ts"), "manual_import_or_legacy_sync_tool");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/syncLegacyDelta.ts"), "manual_import_or_legacy_sync_tool");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/smokeProductionMediaUpload.ts"), "manual_verification_or_smoke_tool");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/verifyProductionShadowParity.ts"), "manual_verification_or_smoke_tool");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/reportLegacyDrift.ts"), "manual_audit_report_tool");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/reportMigrationBaseline.ts"), "manual_audit_report_tool");
  assert.equal(
    maintenancePgDependencyReason(
      "platform_v2/src/scripts/runZukanFoundationV2PostgresDatabaseFixtures.ts",
    ),
    "foundation_v2_scratch_fixture_tool",
  );
  assert.equal(
    maintenancePgDependencyReason(
      "platform_v2/src/scripts/runZukanFoundationV2PostgresReadOnlyEvidence.ts",
    ),
    "foundation_v2_read_only_evidence_tool",
  );
  assert.equal(
    maintenancePgDependencyReason(
      "platform_v2/src/services/zukanFoundationV2PostgresRepository.ts",
    ),
    null,
  );
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/repairObservationLocationLabels.ts"), "manual_repair_or_admin_tool");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/compileKnowledgeNavigation.ts"), "deploy_or_postdeploy_tool");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/runGuideEnvironmentPostDeploy.ts"), "deploy_or_postdeploy_tool");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/auditObservationLocations.ts"), "manual_audit_report_tool");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/backfillObservationLocalityFromAdminAreas.ts"), "manual_repair_or_admin_tool");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/cleanupStagingSmokeFixtures.ts"), "manual_verification_or_smoke_tool");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/diagnoseGuideEnvironmentMesh.ts"), "manual_audit_report_tool");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/materializeLegacyVerifySnapshot.ts"), "manual_verification_or_smoke_tool");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/processPlaceMemoryPhotos.ts"), "manual_media_batch_tool");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/refreshPublicMapSnapshot.ts"), "manual_materialization_tool");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/refreshRecentObservationAi.ts"), "manual_ai_batch_tool");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/repairObservationFieldSourcePolicy.ts"), "deploy_or_postdeploy_tool");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/runAiForMissing.ts"), "manual_ai_batch_tool");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/smokePlatformReadLane.ts"), "manual_verification_or_smoke_tool");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/writeLegacyCompatibility.ts"), "manual_import_or_legacy_sync_tool");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/services/stagingFixtureCleanup.ts"), "gated_staging_fixture_ops");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/services/stagingRallyFixtures.ts"), "gated_staging_fixture_ops");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/services/stagingRegressionFixtures.ts"), "gated_staging_fixture_ops");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/routes/adminDataHealth.ts"), "admin_ops_diagnostic_dashboard");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/routes/adminMonitoringWorkspace.ts"), "admin_monitoring_diagnostic_readonly");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/routes/adminRegionalKnowledge.ts"), "admin_regional_knowledge_review_dashboard");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/routes/adminSiteEvidence.ts"), "admin_evidence_report");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/routes/knowledgeNavigationApi.ts"), "internal_knowledge_navigation_admin_api");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/routes/curatorProposalsApi.ts"), "internal_curator_proposal_receiver");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/services/audioPropagation.ts"), "admin_audio_review_residual_after_vector_retirement");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/services/audioReview.ts"), "admin_audio_review_residual_after_vector_retirement");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/services/alertDispatcher.ts"), "manual_ai_reassessment_alert_dispatcher");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/services/monitoringWorkspaceData.ts"), "admin_monitoring_diagnostic_readmodel");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/services/plotMonitoring.ts"), "admin_plot_monitoring_backstage_api");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/services/readiness.ts"), "legacy_cutover_readiness_report");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/services/regionalKnowledgeEmbedding.ts"), null);
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/processAudioSegments.ts"), "manual_audio_detection_batch_tool");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/services/observationMediaIntegrity.ts"), null);
  assert.equal(maintenancePgDependencyReason("platform_v2/src/services/fieldVerification.ts"), null);
  assert.equal(maintenancePgDependencyReason("platform_v2/src/services/placeEnvironmentIngest.ts"), null);
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/runSentinelEnvironmentWorker.ts"), null);
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/cron/runCacheInvalidate.ts"), "scheduled_legacy_cache_and_freshness_maintenance");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/cron/runCurator.ts"), "scheduled_curator_proposal_batch");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/cron/curators/invasive-law.ts"), "scheduled_curator_proposal_batch");
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/importantDaemon.ts"), null);
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/reporterDaemon.ts"), null);
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/verify.ts"), null);
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/importFutureRuntime.ts"), null);
  assert.equal(maintenancePgDependencyReason("platform_v2/src/scripts/smokeScheduledWorker.ts"), null);
  assert.equal(maintenancePgDependencyReason("platform_v2/src/services/importObservationFields.ts"), null);
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/mapSnapshot.ts"), "cloudflare_public_map_snapshot_readmodel");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/areaPolygons.ts"), "cloudflare_area_polygon_readmodel");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/fieldManagers.ts"), "cloudflare_field_manager_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/mapOwnObservations.ts"), "cloudflare_owner_map_observations_native");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/mapEffort.ts"), "cloudflare_public_map_effort_shim");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/publicMapSnapshotOpsAlerts.ts"), "cloudflare_public_map_snapshot_ops_inventory");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/routes/observationEventApi.ts"), "cloudflare_observation_event_core_api");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/observationRally.ts"), "cloudflare_observation_rally_api");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/authSession.ts"), "cloudflare_auth_session_api");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/authUsers.ts"), "cloudflare_auth_user_account_api");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/observationWrite.ts"), "cloudflare_observation_write_api");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/observationPhotoUpload.ts"), "cloudflare_observation_photo_upload_api");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/observationReactions.ts"), "cloudflare_observation_reactions_api");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/recordReadingCards.ts"), "cloudflare_record_reading_cards_api");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/uiKpi.ts"), "cloudflare_ui_kpi_event_api");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/observationVisitBundle.ts"), "cloudflare_observation_detail_readmodel");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/observationEventLive.ts"), "cloudflare_observation_event_live_api");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/observationEventDualWrite.ts"), "cloudflare_observation_event_dual_write_side_effects");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/observationEventEffort.ts"), "cloudflare_observation_event_effort_api");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/observationEventModeManager.ts"), "cloudflare_observation_event_mode_api");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/observationEventRecap.ts"), "cloudflare_observation_event_recap_api");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/observationEventParticipantAccess.ts"), "cloudflare_observation_event_participant_identity_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/observationEventContext.ts"), "cloudflare_observation_event_static_quest_context_dependency");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/observationEventQuestEngine.ts"), "cloudflare_observation_event_static_quest_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/observationEventCapsule.ts"), "cloudflare_observation_event_capsule_api");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/observationEventOfficialReport.ts"), "cloudflare_observation_event_official_report_api");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/areaSketchAssessments.ts"), "cloudflare_area_sketch_assessment_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/routes/meSubscriptionsApi.ts"), "cloudflare_personal_subscription_alert_api");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/routes/guideRecordsDebug.ts"), "cloudflare_guide_outcomes_and_route_layer_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/routes/researchApi.ts"), "cloudflare_research_export_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/guideRouteTrack.ts"), "cloudflare_guide_telemetry_route_points_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/resolveFieldsForPoint.ts"), "cloudflare_replaced_field_resolution_helper_dependency");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/guideTransectQuality.ts"), "cloudflare_guide_route_layer_quality_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/mobileFieldSessions.ts"), "cloudflare_mobile_field_session_digest_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/landingSnapshot.ts"), "cloudflare_materialized_landing_and_home_readmodel");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/readModels.ts"), "cloudflare_materialized_public_readmodels");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/referenceLibrary.ts"), "cloudflare_reference_library_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/observationFieldRegistry.ts"), "cloudflare_observation_field_registry_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/areaSnapshotVisitScope.ts"), "cloudflare_area_and_place_snapshot_visit_scope_readmodel");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/areaPlaceSnapshot.ts"), "cloudflare_area_snapshot_field_detail_readmodel");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/placeSnapshot.ts"), "cloudflare_place_snapshot_readmodel");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/fixedPointStation.ts"), "cloudflare_fixed_point_station_readmodel");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/observationDataRights.ts"), "cloudflare_observation_data_rights_api");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/publicationFeed.ts"), "cloudflare_publication_feed_native_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/civicNatureContext.ts"), "cloudflare_civic_observation_context_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/scripts/runSentinelEnvironmentWorker.ts"), "cloudflare_sentinel_environment_snapshot_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/environmentSnapshotWriter.ts"), "cloudflare_sentinel_environment_snapshot_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/writeSupport.ts"), null);
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/writeSupportPg.ts"), "cloudflare_replaced_or_residual_write_support_pg_helper");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/writeGuards.ts"), null);
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/writeGuardsPg.ts"), "cloudflare_replaced_or_residual_write_guard_pg_helper");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/guideSession.ts"), "cloudflare_guide_scene_static_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/guideSessionPublicSummary.ts"), "cloudflare_guide_session_public_summary_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/guideRecordPromotion.ts"), "cloudflare_guide_record_promotion_request_ledger");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/walkWrite.ts"), "cloudflare_walk_session_api");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/fieldscanAudio.ts"), "cloudflare_fieldscan_audio_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/passiveAudioIngest.ts"), "cloudflare_passive_audio_ingest_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/trackWrite.ts"), "cloudflare_track_upsert_api");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/observationRecordAiReview.ts"), "cloudflare_observation_record_ai_review_api");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/waterRecordExtension.ts"), "cloudflare_observation_water_record_extension_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/placeManagementPolicy.ts"), "cloudflare_place_management_policy_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/identificationParticipation.ts"), "cloudflare_identification_participation_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/identificationConsensus.ts"), "cloudflare_identification_consensus_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/identificationWorkbenchHolds.ts"), "cloudflare_identification_workbench_hold_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/specialistReview.ts"), "cloudflare_specialist_review_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/reviewerAuthorities.ts"), "cloudflare_specialist_authority_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/authorityRecommendations.ts"), "cloudflare_specialist_authority_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/visitSubjects.ts"), "cloudflare_visit_subject_summary_replaced_dependency");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/contactSubmit.ts"), "cloudflare_contact_submit_api");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/userWrite.ts"), "cloudflare_user_profile_write_api");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/rememberTokenWrite.ts"), "cloudflare_remember_token_api");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/evidenceAssetMediaRole.ts"), "cloudflare_observation_media_role_dependency");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/mediaProcessingJobs.ts"), "cloudflare_media_processing_queue_dependency");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/observationAiAssessment.ts"), "cloudflare_observation_detail_readmodel_dependency");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/observationPackage.ts"), "cloudflare_observation_package_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/observationPackageDataChain.ts"), "cloudflare_observation_package_data_chain_replaced_dependency");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/sensitiveSpeciesMasking.ts"), "cloudflare_public_map_and_area_snapshot_masking_readmodels");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/routes/observationEventPages.ts"), "cloudflare_observation_event_pages_runtime");
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/siteSignalsCache.ts"), "optional_site_signals_cache_falls_back_without_database");
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/gbifBackboneMatch.ts"), "optional_gbif_match_cache_falls_back_to_remote_api");
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/officialNoticeCache.ts"), "optional_official_notice_cache_falls_back_to_remote_or_stale_snapshot");
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/runtimeVersion.ts"), "optional_runtime_version_migration_head");
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/glossaryTerms.ts"), "optional_glossary_terms_builtin_fallback_and_nonfatal_candidate_log");
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/routes/invasiveSpecies.ts"), "optional_invasive_reporting_visibility_falls_back_unavailable");
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/invasiveReporting.ts"), "optional_invasive_reporting_delivery_falls_back_empty");
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/placeEnvironmentSignals.ts"), "optional_place_environment_evidence_falls_back_empty");
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/observationContext.ts"), "optional_observation_detail_context_falls_back_empty");
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/observationDetailHeavy.ts"), "optional_observation_detail_heavy_falls_back_empty");
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/observerStats.ts"), "optional_observation_detail_observer_stats_card");
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/placeVegetationTrend.ts"), "optional_place_vegetation_trend_card_falls_back_null");
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/regionalStory.ts"), "optional_regional_story_seed_fallback_and_nonfatal_exposure_log");
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/taxonInsights.ts"), "optional_observation_detail_taxon_insight_card");
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/aiCostLogger.ts"), "optional_ops_ai_cost_logging_and_budget_health");
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/areaWatchNotifications.ts"), "optional_area_watch_notification_enrichment");
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/profileNoteDigest.ts"), "optional_profile_note_digest_enrichment");
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/relationshipScore.queries.ts"), "optional_relationship_score_readonly_queries");
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/relationshipScoreSnapshot.ts"), "optional_relationship_score_report_snapshot");
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/tierPromotion.ts"), "optional_evidence_tier_enrichment");
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/landingSnapshot.ts"), null);
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/readModels.ts"), null);
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/taxonPrecisionPolicy.ts"), null);
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/sensitiveSpeciesMasking.ts"), null);
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/writeSupport.ts"), null);
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/authorityRecommendations.ts"), null);
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/reviewerAuthorities.ts"), null);
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/specialistReview.ts"), null);
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/identificationConsensus.ts"), null);
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/identificationParticipation.ts"), null);
  assert.equal(optionalRuntimePgDependencyReason("platform_v2/src/services/visitSubjects.ts"), null);
  assert.equal(existsSync(path.join(process.cwd(), "..", "src", "services", "videoProcessingQueue.ts")), false);
  assert.equal(existsSync(path.join(process.cwd(), "..", "src", "scripts", "processVideoProcessingJobs.ts")), false);

  assert.equal(
    exclusiveMaintenancePgDependencyReason(
      "platform_v2/src/services/regionalKnowledgeEmbedding.ts",
      new Map([
        [
          "platform_v2/src/services/regionalKnowledgeEmbedding.ts",
          new Set(["platform_v2/src/scripts/embedRegionalKnowledgeCards.ts"]),
        ],
      ]),
    ),
    "manual_embedding_batch_dependency",
  );
  assert.equal(
    exclusiveMaintenancePgDependencyReason(
      "platform_v2/src/services/regionalKnowledgeEmbedding.ts",
      new Map([
        [
          "platform_v2/src/services/regionalKnowledgeEmbedding.ts",
          new Set([
            "platform_v2/src/scripts/embedRegionalKnowledgeCards.ts",
            "platform_v2/src/routes/guideApi.ts",
          ]),
        ],
      ]),
    ),
    null,
  );
  assert.equal(
    exclusiveMaintenancePgDependencyReason(
      "platform_v2/src/services/zukanFoundationV2PostgresRepository.ts",
      new Map([
        [
          "platform_v2/src/services/zukanFoundationV2PostgresRepository.ts",
          new Set([
            "platform_v2/src/scripts/runZukanFoundationV2PostgresDatabaseFixtures.ts",
            "platform_v2/src/scripts/runZukanFoundationV2PostgresReadOnlyEvidence.ts",
          ]),
        ],
      ]),
    ),
    "foundation_v2_read_only_evidence_tool+foundation_v2_scratch_fixture_tool_dependency",
  );
  assert.equal(
    exclusiveMaintenancePgDependencyReason(
      "platform_v2/src/services/zukanFoundationV2PostgresRepository.ts",
      new Map([
        [
          "platform_v2/src/services/zukanFoundationV2PostgresRepository.ts",
          new Set([
            "platform_v2/src/scripts/runZukanFoundationV2PostgresReadOnlyEvidence.ts",
            "platform_v2/src/server.ts",
          ]),
        ],
      ]),
    ),
    null,
  );
  assert.equal(
    exclusiveMaintenancePgDependencyReason(
      "platform_v2/src/services/observationMediaIntegrity.ts",
      new Map([
        [
          "platform_v2/src/services/observationMediaIntegrity.ts",
          new Set(["platform_v2/src/scripts/reportMissingObservationPhotos.ts"]),
        ],
      ]),
    ),
    "manual_integrity_report_dependency",
  );
  assert.equal(
    exclusiveMaintenancePgDependencyReason(
      "platform_v2/src/scripts/cron/runCacheInvalidate.ts",
      new Map([
        [
          "platform_v2/src/scripts/cron/runCacheInvalidate.ts",
          new Set(["platform_v2/src/scripts/smokePublicMapSnapshotAlert.ts"]),
        ],
      ]),
    ),
    "scheduled_legacy_cache_and_freshness_maintenance",
  );
  assert.equal(
    exclusiveMaintenancePgDependencyReason(
      "platform_v2/src/services/fieldVerification.ts",
      new Map([
        [
          "platform_v2/src/services/fieldVerification.ts",
          new Set(["platform_v2/src/scripts/importObservationFields.ts"]),
        ],
      ]),
    ),
    "manual_field_import_dependency",
  );
  assert.equal(
    exclusiveMaintenancePgDependencyReason(
      "platform_v2/src/services/placeEnvironmentIngest.ts",
      new Map([
        [
          "platform_v2/src/services/placeEnvironmentIngest.ts",
          new Set(["platform_v2/src/scripts/ingestPlaceEnvironmentSnapshots.ts"]),
        ],
      ]),
    ),
    "manual_environment_ingest_dependency",
  );
  assert.equal(
    exclusiveMaintenancePgDependencyReason(
      "platform_v2/src/services/fieldVerification.ts",
      new Map([
        [
          "platform_v2/src/services/fieldVerification.ts",
          new Set([
            "platform_v2/src/scripts/importObservationFields.ts",
            "platform_v2/src/routes/observationFieldsApi.ts",
          ]),
        ],
      ]),
    ),
    null,
  );
  assert.equal(
    exclusiveMaintenancePgDependencyReason(
      "platform_v2/src/services/knowledgeNavigation.ts",
      new Map([
        [
          "platform_v2/src/services/knowledgeNavigation.ts",
          new Set([
            "platform_v2/src/routes/knowledgeNavigationApi.ts",
            "platform_v2/src/scripts/compileKnowledgeNavigation.ts",
          ]),
        ],
      ]),
    ),
    "deploy_or_postdeploy_tool+internal_knowledge_navigation_admin_api_dependency",
  );
  assert.equal(
    exclusiveMaintenancePgDependencyReason(
      "platform_v2/src/services/knowledgeNavigation.ts",
      new Map([
        [
          "platform_v2/src/services/knowledgeNavigation.ts",
          new Set([
            "platform_v2/src/routes/knowledgeNavigationApi.ts",
            "platform_v2/src/routes/read.ts",
          ]),
        ],
      ]),
    ),
    null,
  );
  const knowledgeClaimRetrievalReason = exclusiveMaintenancePgDependencyReason(
    "platform_v2/src/services/knowledgeClaimRetrieval.ts",
    new Map([
      [
        "platform_v2/src/services/knowledgeClaimRetrieval.ts",
        new Set([
          "platform_v2/src/services/knowledgeNavigation.ts",
          "platform_v2/src/services/observationReassess.ts",
        ]),
      ],
      [
        "platform_v2/src/services/knowledgeNavigation.ts",
        new Set([
          "platform_v2/src/routes/knowledgeNavigationApi.ts",
          "platform_v2/src/scripts/compileKnowledgeNavigation.ts",
        ]),
      ],
      [
        "platform_v2/src/services/observationReassess.ts",
        new Set([
          "platform_v2/src/scripts/refreshRecentObservationAi.ts",
          "platform_v2/src/scripts/runAiForMissing.ts",
        ]),
      ],
    ]),
  );
  assert.ok(knowledgeClaimRetrievalReason);
  assert.match(knowledgeClaimRetrievalReason, /internal_knowledge_navigation_admin_api/);
  assert.match(knowledgeClaimRetrievalReason, /manual_ai_batch_tool/);

  assert.match(script, /const maintenancePgFiles = pgFiles/);
  assert.match(script, /const replacedProductionRuntimePgFiles = pgFiles/);
  assert.match(script, /const importersByTarget = new Map\(\)/);
  assert.match(script, /const extensionlessTarget = path\.join\(parsed\.dir, parsed\.name\)/);
  assert.match(script, /exclusiveMaintenancePgDependencyReason\(item\.file, importersByTarget\)/);
  assert.match(script, /maintenance_pg_dependency_files/);
  assert.match(script, /explicitly gated staging fixture ops only/);
  assert.match(script, /gated_staging_fixture_ops/);
  assert.match(script, /Cloudflare-replaced production runtime files/);
  assert.match(script, /cloudflare_public_map_snapshot_readmodel/);
  assert.match(script, /cloudflare_observation_event_core_api/);
  assert.match(script, /cloudflare_observation_rally_api/);
  assert.match(script, /cloudflare_auth_session_api/);
  assert.match(script, /cloudflare_auth_user_account_api/);
  assert.match(script, /cloudflare_observation_write_api/);
  assert.match(script, /cloudflare_observation_photo_upload_api/);
  assert.match(script, /cloudflare_observation_reactions_api/);
  assert.match(script, /cloudflare_record_reading_cards_api/);
  assert.match(script, /cloudflare_ui_kpi_event_api/);
  assert.match(script, /cloudflare_observation_detail_readmodel/);
  assert.match(script, /cloudflare_observation_event_live_api/);
  assert.match(script, /cloudflare_observation_event_recap_api/);
  assert.match(script, /cloudflare_observation_event_participant_identity_runtime/);
  assert.match(script, /cloudflare_observation_event_capsule_api/);
  assert.match(script, /cloudflare_observation_event_official_report_api/);
  assert.match(script, /cloudflare_area_sketch_assessment_runtime/);
  assert.match(script, /cloudflare_guide_outcomes_and_route_layer_runtime/);
  assert.match(script, /cloudflare_guide_telemetry_route_points_runtime/);
  assert.match(script, /cloudflare_guide_route_layer_quality_runtime/);
  assert.match(script, /cloudflare_mobile_field_session_digest_runtime/);
  assert.match(script, /admin_ops_diagnostic_dashboard/);
  assert.match(script, /admin_monitoring_diagnostic_readonly/);
  assert.match(script, /admin_regional_knowledge_review_dashboard/);
  assert.match(script, /internal_curator_proposal_receiver/);
  assert.match(script, /manual_ai_reassessment_alert_dispatcher/);
  assert.match(script, /admin_evidence_report/);
  assert.match(script, /admin_monitoring_diagnostic_readmodel/);
  assert.match(script, /legacy_cutover_readiness_report/);
  assert.match(script, /optional_site_signals_cache_falls_back_without_database/);
  assert.match(script, /optional_gbif_match_cache_falls_back_to_remote_api/);
  assert.match(script, /optional_official_notice_cache_falls_back_to_remote_or_stale_snapshot/);
  assert.match(script, /optional_runtime_version_migration_head/);
  assert.match(script, /optional_glossary_terms_builtin_fallback_and_nonfatal_candidate_log/);
  assert.match(script, /optional_invasive_reporting_visibility_falls_back_unavailable/);
  assert.match(script, /optional_invasive_reporting_delivery_falls_back_empty/);
  assert.match(script, /optional_place_environment_evidence_falls_back_empty/);
  assert.match(script, /optional_observation_detail_context_falls_back_empty/);
  assert.match(script, /optional_observation_detail_heavy_falls_back_empty/);
  assert.match(script, /optional_observation_detail_observer_stats_card/);
  assert.match(script, /optional_place_vegetation_trend_card_falls_back_null/);
  assert.match(script, /optional_observation_detail_taxon_insight_card/);
});

test("readModels runtime is covered by Cloudflare materialized and native read lanes", async () => {
  const workerSource = await readFile(path.join(process.cwd(), "src", "index.ts"), "utf8");
  const workerTests = await readFile(path.join(process.cwd(), "src", "index.test.ts"), "utf8");
  const script = await readFile(path.join(process.cwd(), "scripts", "d1-migration-boundary-report.mjs"), "utf8");
  const replacedProductionRuntimePgDependencyReason = loadReplacedProductionRuntimePgDependencyReason(script);

  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/readModels.ts"), "cloudflare_materialized_public_readmodels");
  assert.match(workerSource, /getOriginalUiHtml\(request, url, env\)/);
  assert.match(workerSource, /getSessionAwareProfileHtml\(request, url, env\)/);
  assert.match(workerSource, /getPublicObservationDetailJson\(decodeURIComponent\(publicDetailApiMatch\[1\]\), env\)/);
  assert.match(workerSource, /getPublicObservationDetailPage\(decodeURIComponent\(publicDetailPageMatch\[1\]\), request, url, env\)/);
  assert.match(workerSource, /listCompatibleSpecialistAuthorities\(request, env\)/);
  assert.match(workerSource, /listCompatiblePendingAuthorityRecommendations\(request, env\)/);
  assert.match(workerTests, /production records materialized html includes recent Cloudflare D1 records/);
  assert.match(workerTests, /production original UI app shells serve materialized HTML even with session cookies/);
  assert.match(workerTests, /production profile shell renders signed-in Cloudflare page for valid session cookies/);
  assert.match(workerTests, /production language-prefixed observation detail stays native and public-safe/);
  assert.match(workerTests, /production area sketch assessment runtime stores draft diagnostics in D1 without origin fallback/);
  assert.match(workerTests, /production specialist authority runtime manages D1 authority and recommendation flows without origin fallback/);
});

test("production area sketch public release gate blocks school children home-nearby private-land rare-species and sensitive-place contexts", async () => {
  const workerSource = await readFile(path.join(process.cwd(), "src", "index.ts"), "utf8");
  const workerTests = await readFile(path.join(process.cwd(), "src", "index.test.ts"), "utf8");

  assert.match(workerSource, /function areaSketchPublicReleaseGate\(/);
  assert.match(workerSource, /AREA_SKETCH_SENSITIVE_CONTEXT_PATTERNS/);
  assert.match(workerSource, /"school_or_children"/);
  assert.match(workerSource, /"home_nearby"/);
  assert.match(workerSource, /"private_land"/);
  assert.match(workerSource, /"rare_species"/);
  assert.match(workerSource, /"sensitive_place"/);
  assert.match(workerSource, /小学校\|中学校\|高校\|幼稚園\|保育園\|こども園\|学校\|児童\|園児\|生徒\|子ども\|子供\|未成年/);
  assert.match(workerSource, /個人宅\|自宅\|住宅地\|住所/);
  assert.match(workerSource, /私有地\|民有地\|地番\|所有者/);
  assert.match(workerSource, /希少種\|絶滅危惧\|営巣\|繁殖地/);
  assert.match(workerSource, /保護区\|避難所\|医療機関\|福祉施設/);
  assert.match(workerSource, /status:\s*sensitive\s*\?\s*"blocked_sensitive_context"\s*:\s*"draft_requires_review"/);
  assert.match(workerSource, /publicClaimAllowed:\s*false/);
  assert.match(workerSource, /publicSummaryAllowed:\s*sensitive\s*\?\s*"blocked_until_redacted_review"\s*:\s*"review_required"/);
  assert.match(workerSource, /public_release_gate_status:\s*publicReleaseGate\.status/);
  assert.match(workerSource, /public_release_contexts:\s*publicReleaseGate\.matchedContexts/);
  assert.match(workerTests, /production area sketch public release gate blocks school children home-nearby private-land rare-species and sensitive-place contexts/);
  assert.match(workerTests, /自宅近辺/);
  assert.match(workerTests, /絶滅危惧種/);
  assert.match(workerTests, /new Set\(\["school_or_children", "home_nearby", "private_land", "rare_species", "sensitive_place"\]\)/);
});

test("write support PostgreSQL helper is separated from pure write helpers", async () => {
  const repoRoot = path.resolve(process.cwd(), "..", "..");
  const pureSupport = await readFile(path.join(repoRoot, "platform_v2", "src", "services", "writeSupport.ts"), "utf8");
  const pgSupport = await readFile(path.join(repoRoot, "platform_v2", "src", "services", "writeSupportPg.ts"), "utf8");
  const importers = (await findTsFilesContaining(path.join(repoRoot, "platform_v2", "src"), "writeSupportPg.js"))
    .map((file) => path.relative(repoRoot, file).replaceAll("\\", "/"))
    .filter((file) => !file.endsWith(".test.ts"))
    .sort();

  assert.doesNotMatch(pureSupport, /\bPoolClient\b|from ["']pg["']|client\.query|getPool\(/);
  assert.doesNotMatch(pureSupport, /upsertAssetBlob|recordCompatibilityFailure/);
  assert.match(pureSupport, /export function buildPlaceId/);
  assert.match(pureSupport, /export function makeOccurrenceId/);
  assert.match(pgSupport, /export async function upsertAssetBlob/);
  assert.match(pgSupport, /export async function recordCompatibilityFailure/);
  assert.match(pgSupport, /from "pg"/);
  assert.deepEqual(importers, [
    "platform_v2/src/services/fieldscanAudio.ts",
    "platform_v2/src/services/observationPhotoUpload.ts",
    "platform_v2/src/services/observationWrite.ts",
    "platform_v2/src/services/placeMemory.ts",
    "platform_v2/src/services/referenceLibrary.ts",
    "platform_v2/src/services/rememberTokenWrite.ts",
    "platform_v2/src/services/stagingRegressionFixtures.ts",
    "platform_v2/src/services/trackWrite.ts",
    "platform_v2/src/services/userWrite.ts",
  ]);
});

test("legacy write route boundary is covered by Cloudflare app write runtimes", async () => {
  const workerSource = await readFile(path.join(process.cwd(), "src", "index.ts"), "utf8");
  const workerTests = await readFile(path.join(process.cwd(), "src", "index.test.ts"), "utf8");
  const script = await readFile(path.join(process.cwd(), "scripts", "d1-migration-boundary-report.mjs"), "utf8");
  const replacedProductionRuntimePgDependencyReason = loadReplacedProductionRuntimePgDependencyReason(script);

  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/routes/write.ts"), "cloudflare_app_write_route_boundary");
  assert.match(workerSource, /updateCompatibleOccurrenceDetail/);
  assert.match(workerSource, /occurrenceDetailEditMatch/);
  assert.match(workerSource, /environment-record/);
  assert.doesNotMatch(workerSource, /isPublicAppWriteCandidatePath\(url\)|fetchOriginFallback\s*\(/);
  assert.match(workerTests, /production occurrence detail edit APIs write to D1 without origin fallback/);
  assert.match(workerTests, /production occurrence detail edit APIs reject non owners before mutation/);
});

test("write guard PostgreSQL ownership helper is separated from pure request and session guards", async () => {
  const repoRoot = path.resolve(process.cwd(), "..", "..");
  const pureGuards = await readFile(path.join(repoRoot, "platform_v2", "src", "services", "writeGuards.ts"), "utf8");
  const pgGuards = await readFile(path.join(repoRoot, "platform_v2", "src", "services", "writeGuardsPg.ts"), "utf8");
  const importers = (await findTsFilesContaining(path.join(repoRoot, "platform_v2", "src"), "writeGuardsPg.js"))
    .map((file) => path.relative(repoRoot, file).replaceAll("\\", "/"))
    .filter((file) => !file.endsWith(".test.ts"))
    .sort();

  assert.doesNotMatch(pureGuards, /from ["']\.\.\/db\.js["']|getPool\(|pool\.query|assertObservationOwnedByUser/);
  assert.match(pureGuards, /export function assertPrivilegedWriteAccess/);
  assert.match(pureGuards, /export function assertSessionUser/);
  assert.match(pureGuards, /export async function assertSpecialistSession/);
  assert.match(pureGuards, /export function assertSpecialistAdminSession/);
  assert.match(pgGuards, /export async function assertObservationOwnedByUser/);
  assert.match(pgGuards, /getPool\(\)/);
  assert.match(pgGuards, /pool\.query/);
  assert.deepEqual(importers, [
    "platform_v2/src/routes/observationPackageApi.ts",
    "platform_v2/src/routes/write.ts",
  ]);
});

test("observation package data chain is only imported by replaced runtime or type-only consumers", async () => {
  const script = await readFile(path.join(process.cwd(), "scripts", "d1-migration-boundary-report.mjs"), "utf8");
  const replacedProductionRuntimePgDependencyReason = loadReplacedProductionRuntimePgDependencyReason(script);
  const repoRoot = path.resolve(process.cwd(), "..", "..");
  const importers = (await findTsFilesContaining(path.join(repoRoot, "platform_v2", "src"), "observationPackageDataChain.js"))
    .map((file) => path.relative(repoRoot, file).replaceAll("\\", "/"))
    .filter((file) => !file.endsWith(".test.ts"))
    .sort();

  assert.deepEqual(importers, [
    "platform_v2/src/services/monitoringReadiness.ts",
    "platform_v2/src/services/observationPackage.ts",
    "platform_v2/src/services/observationWrite.ts",
  ]);

  const monitoringReadiness = await readFile(path.join(repoRoot, "platform_v2", "src", "services", "monitoringReadiness.ts"), "utf8");
  assert.match(monitoringReadiness, /import type \{[\s\S]*\} from "\.\/observationPackageDataChain\.js";/);
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/observationPackage.ts"), "cloudflare_observation_package_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/observationWrite.ts"), "cloudflare_observation_write_api");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/observationPackageDataChain.ts"), "cloudflare_observation_package_data_chain_replaced_dependency");
});

test("observation event context remains exclusively tied to the replaced quest engine", async () => {
  const importers = (await findTsFilesContaining(path.resolve(process.cwd(), "../src"), "observationEventContext.js"))
    .map((line) => path.relative(path.resolve(process.cwd(), ".."), line))
    .map((line) => `platform_v2/${line}`)
    .map((line) => line.replace(/\\/g, "/"))
    .sort();
  assert.deepEqual(importers, ["platform_v2/src/services/observationEventQuestEngine.ts"]);
});

test("visit subject summaries are only imported by replaced runtime or maintenance consumers", async () => {
  const script = await readFile(path.join(process.cwd(), "scripts", "d1-migration-boundary-report.mjs"), "utf8");
  const replacedProductionRuntimePgDependencyReason = loadReplacedProductionRuntimePgDependencyReason(script);
  const maintenancePgDependencyReason = loadMaintenancePgDependencyReason(script);
  const repoRoot = path.resolve(process.cwd(), "..", "..");
  const importers = (await findTsFilesContaining(path.join(repoRoot, "platform_v2", "src"), "visitSubjects.js"))
    .map((file) => path.relative(repoRoot, file).replaceAll("\\", "/"))
    .filter((file) => !file.endsWith(".test.ts"))
    .sort();

  assert.deepEqual(importers, [
    "platform_v2/src/scripts/cleanupObservationSameSubjectAiCandidates.ts",
    "platform_v2/src/services/identificationParticipation.ts",
    "platform_v2/src/services/observationReassess.ts",
    "platform_v2/src/services/observationVisitBundle.ts",
    "platform_v2/src/services/specialistReview.ts",
  ]);
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/identificationParticipation.ts"), "cloudflare_identification_participation_runtime");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/observationVisitBundle.ts"), "cloudflare_observation_detail_readmodel");
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/specialistReview.ts"), "cloudflare_specialist_review_runtime");
  assert.match(maintenancePgDependencyReason("platform_v2/src/scripts/cleanupObservationSameSubjectAiCandidates.ts") ?? "", /manual_/);
  assert.equal(replacedProductionRuntimePgDependencyReason("platform_v2/src/services/visitSubjects.ts"), "cloudflare_visit_subject_summary_replaced_dependency");

  const result = spawnSync(process.execPath, ["scripts/d1-migration-boundary-report.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /## PostgreSQL Maintenance Dependencies[\s\S]*platform_v2\/src\/services\/observationReassess\.ts[\s\S]*manual_ai_batch_tool/);
  assert.doesNotMatch(result.stdout, /## PostgreSQL Runtime Dependencies[\s\S]*platform_v2\/src\/services\/visitSubjects\.ts[\s\S]*## PostgreSQL Maintenance Dependencies/);
});

test("VPS stop readiness reports ready P0 capability dispositions", async () => {
  const result = spawnSync(process.execPath, ["scripts/d1-migration-boundary-report.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /P0 Capability Disposition Gate/);
  assert.match(result.stdout, /- status: ready/);
  assert.match(result.stdout, /- p0_capability_items: 11/);
  assert.match(result.stdout, /- p0_open_capabilities: 0/);
  assert.match(result.stdout, /- p0_terminal_capabilities: 11/);
  assert.match(result.stdout, /- configured_p0_blockers_without_disposition: 0/);
  assert.match(result.stdout, /legacy_observation_candidate_propose_origin_fallback/);
  assert.match(result.stdout, /legacy_observation_management_confirm_origin_fallback/);
  assert.match(result.stdout, /alert_delivery_worker/);
  assert.match(result.stdout, /video_upload_lifecycle/);
  assert.match(result.stdout, /p0_disposition_gate: ready/);
  assert.match(result.stdout, /p0_blockers: 0/);
});

test("Cloudflare-only runtime has no origin fallback calls or configured legacy bindings", async () => {
  const workerSource = await readFile(path.join(process.cwd(), "src", "index.ts"), "utf8");
  const wranglerConfig = await readFile(path.join(process.cwd(), "wrangler.jsonc"), "utf8");
  const deployGuards = await Promise.all([
    "deploy-shadow-guard.mjs",
    "deploy-staging-guard.mjs",
    "deploy-production-guard.mjs",
  ].map((file) => readFile(path.join(process.cwd(), "scripts", file), "utf8")));
  const result = spawnSync(process.execPath, ["scripts/d1-migration-boundary-report.mjs", "--fail-on-vps-blockers"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.doesNotMatch(workerSource, /fetchOriginFallback\s*\(/);
  assert.doesNotMatch(workerSource, /readCompatibleSessionWithOriginFallback/);
  assert.doesNotMatch(workerSource, /importOriginSessionIfAvailable/);
  assert.doesNotMatch(wranglerConfig, /"(?:ORIGIN_FALLBACK_BASE_URL|ORIGIN_FALLBACK_RESOLVE_OVERRIDE|PUBLIC_CUSTOM_DOMAIN_ORIGIN_FALLBACK_MODE|ORIGIN_SESSION_IMPORT_MODE|PUBLIC_WRITE_MODE)"\s*:/);
  for (const guard of deployGuards) {
    assert.match(guard, /retiredOriginFallbackVars/);
    assert.match(guard, /retired_origin_fallback_var_present/);
  }
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /- fallback_call_count: 0/);
  assert.match(result.stdout, /- retired_origin_fallback_var_count: 0/);
  assert.match(result.stdout, /## VPS Stop Readiness Gate[\s\S]*- status: ready[\s\S]*- blocker_count: 0/);
  assert.match(result.stdout, /## Configured Production VPS Stop Readiness Gate[\s\S]*- status: ready[\s\S]*- blocker_count: 0/);
});

test("production legacy PHP public entrypoints cannot use origin fallback", async () => {
  const workerSource = await readFile(path.join(process.cwd(), "src", "index.ts"), "utf8");
  const workerTests = await readFile(path.join(process.cwd(), "src", "index.test.ts"), "utf8");

  assert.doesNotMatch(workerSource, /fetchOriginFallback\s*\(/);
  assert.match(workerSource, /nativePathname === "\/app_oauth_start\.php"/);
  assert.match(workerSource, /nativePathname === "\/oauth_callback\.php"/);
  assert.match(workerTests, /production legacy PHP public entrypoints cannot use origin fallback/);
});

test("legacy observation event API fallback is retired from Worker source", async () => {
  const workerSource = await readFile(path.join(process.cwd(), "src", "index.ts"), "utf8");
  const script = await readFile(path.join(process.cwd(), "scripts", "d1-migration-boundary-report.mjs"), "utf8");
  const classifyFallbackReason = loadClassifyFallbackReason(script);

  assert.equal(classifyFallbackReason("legacy_observation_event_api_origin_fallback"), "api_origin_fallback");
  assert.doesNotMatch(workerSource, /legacy_observation_event_api_origin_fallback/);
});

test("map area polygon origin geometry fallback is retired from Worker source", async () => {
  const workerSource = await readFile(path.join(process.cwd(), "src", "index.ts"), "utf8");
  const script = await readFile(path.join(process.cwd(), "scripts", "d1-migration-boundary-report.mjs"), "utf8");
  const classifyFallbackReason = loadClassifyFallbackReason(script);

  assert.equal(classifyFallbackReason("map_area_polygons_origin_geometry"), "map_origin_fallback");
  assert.doesNotMatch(workerSource, /map_area_polygons_origin_geometry/);
});

test("static asset materialized miss origin fallback is retired from Worker source", async () => {
  const workerSource = await readFile(path.join(process.cwd(), "src", "index.ts"), "utf8");
  const script = await readFile(path.join(process.cwd(), "scripts", "d1-migration-boundary-report.mjs"), "utf8");
  const classifyFallbackReason = loadClassifyFallbackReason(script);

  assert.equal(classifyFallbackReason("static_asset_materialized_miss"), "materialized_origin_fallback");
  assert.doesNotMatch(workerSource, /static_asset_materialized_miss/);
});

test("area snapshot materialized miss origin fallback is retired from Worker source", async () => {
  const workerSource = await readFile(path.join(process.cwd(), "src", "index.ts"), "utf8");
  const script = await readFile(path.join(process.cwd(), "scripts", "d1-migration-boundary-report.mjs"), "utf8");
  const classifyFallbackReason = loadClassifyFallbackReason(script);

  assert.equal(classifyFallbackReason("area_snapshot_materialized_miss"), "materialized_origin_fallback");
  assert.doesNotMatch(workerSource, /area_snapshot_materialized_miss/);
});

test("personalized html request origin fallback is retired from Worker source", async () => {
  const workerSource = await readFile(path.join(process.cwd(), "src", "index.ts"), "utf8");
  const script = await readFile(path.join(process.cwd(), "scripts", "d1-migration-boundary-report.mjs"), "utf8");
  const classifyFallbackReason = loadClassifyFallbackReason(script);

  assert.equal(classifyFallbackReason("html_personalized_request"), "materialized_origin_fallback");
  assert.doesNotMatch(workerSource, /html_personalized_request/);
});

test("html materialized miss origin fallback is retired from Worker source", async () => {
  const workerSource = await readFile(path.join(process.cwd(), "src", "index.ts"), "utf8");
  const script = await readFile(path.join(process.cwd(), "scripts", "d1-migration-boundary-report.mjs"), "utf8");
  const classifyFallbackReason = loadClassifyFallbackReason(script);

  assert.equal(classifyFallbackReason("html_materialized_miss"), "materialized_origin_fallback");
  assert.doesNotMatch(workerSource, /html_materialized_miss/);
});

test("thumb materialized miss origin fallback is retired from Worker source", async () => {
  const workerSource = await readFile(path.join(process.cwd(), "src", "index.ts"), "utf8");
  const script = await readFile(path.join(process.cwd(), "scripts", "d1-migration-boundary-report.mjs"), "utf8");
  const classifyFallbackReason = loadClassifyFallbackReason(script);

  assert.equal(classifyFallbackReason("thumb_materialized_miss"), "materialized_origin_fallback");
  assert.doesNotMatch(workerSource, /thumb_materialized_miss/);
});

test("production origin session probe is fully retired", async () => {
  const workerSource = await readFile(path.join(process.cwd(), "src", "index.ts"), "utf8");
  const workerTests = await readFile(path.join(process.cwd(), "src", "index.test.ts"), "utf8");

  assert.doesNotMatch(workerSource, /origin_session_probe|OriginSessionResponse|origin-session-lazy-import/);
  assert.doesNotMatch(workerSource, /ORIGIN_SESSION_IMPORT_MODE|ORIGIN_FALLBACK_BASE_URL/);
  assert.doesNotMatch(workerTests, /production origin session probe is opt-in and disabled by default/);
});

test("PostgreSQL signal classifier does not count JavaScript listener or Array helpers", async () => {
  const script = await readFile(path.join(process.cwd(), "scripts", "d1-migration-boundary-report.mjs"), "utf8");
  const classifyPg = loadClassifyPg(script);

  assert.equal(classifyPg("window.addEventListener('click', () => {});").includes("job_locking"), false);
  assert.equal(classifyPg("const server = app.listen(3000);").includes("job_locking"), false);
  assert.equal(classifyPg("notify('saved');").includes("job_locking"), false);
  assert.equal(classifyPg("function getClient() { return new GoogleGenAI({ key }); } const ai = getClient();").includes("runtime_query"), false);
  assert.equal(classifyPg("import { getClient } from '../db.js'; const client = getClient();").includes("runtime_query"), true);
  assert.equal(classifyPg("const list = Array(10);").includes("pg_types"), false);
  assert.equal(classifyPg("const ok = Array.isArray(value);").includes("pg_types"), false);
  assert.equal(classifyPg("type Items = Array<string>;").includes("pg_types"), false);
  assert.equal(classifyPg("export function normalizeEmbeddingVector(vector: number[]) { return vector; }").includes("vector"), false);
  assert.equal(classifyPg("const results = await env.VECTOR_INDEX.query(vector, { topK: 3 });").includes("vector"), false);
  assert.equal(classifyPg("await openai.embeddings.create({ model: 'text-embedding-3-small', input });").includes("vector"), false);

  assert.equal(classifyPg("await client.query('LISTEN observation_events');").includes("job_locking"), true);
  assert.equal(classifyPg("await client.query('notify observation_events');").includes("job_locking"), true);
  assert.equal(classifyPg("SELECT * FROM jobs FOR UPDATE SKIP LOCKED").includes("job_locking"), true);
  assert.equal(classifyPg("SELECT * FROM visits WHERE visit_id = $1 FOR UPDATE").includes("job_locking"), false);
  assert.equal(classifyPg("SELECT * FROM visits WHERE visit_id = $1 FOR UPDATE").includes("row_locking"), true);
  assert.equal(classifyPg("SELECT array[1, 2, 3] AS ids").includes("pg_types"), true);
  assert.equal(classifyPg("SELECT ARRAY(SELECT id FROM users)").includes("pg_types"), true);
  assert.equal(classifyPg("SELECT unnest(tags)").includes("pg_types"), true);
  assert.equal(classifyPg("SELECT embedding <=> $1::vector FROM audio_embeddings").includes("vector"), true);
  assert.equal(classifyPg("SELECT * FROM items ORDER BY embedding <-> $1 LIMIT 5").includes("vector"), true);
  assert.equal(classifyPg("SELECT * FROM items ORDER BY embedding <#> $1 LIMIT 5").includes("vector"), true);
  assert.equal(classifyPg("SELECT * FROM items ORDER BY embedding <+> $1 LIMIT 5").includes("vector"), true);
  assert.equal(classifyPg("CREATE EXTENSION IF NOT EXISTS vector;").includes("vector"), true);
  assert.equal(classifyPg("CREATE INDEX ON items USING hnsw (embedding vector_cosine_ops)").includes("vector"), true);
  assert.equal(classifyPg("SELECT CAST(my_array AS vector)").includes("vector"), true);
  assert.equal(classifyPg("CREATE INDEX ON cards USING ivfflat (retrieval_embedding vector_cosine_ops)").includes("vector"), true);

  assert.match(script, /PostgreSQL Signal Noise Suppression/);
  assert.match(script, /js_noise_suppressed_files/);
  assert.match(script, /non_pg_embedding_or_vector_text/);
  assert.doesNotMatch(script, /LISTEN\|NOTIFY\|SKIP LOCKED\|FOR UPDATE\/i/);
  assert.doesNotMatch(script, /\\bARRAY\\b\|unnest\\\(\//);
});
