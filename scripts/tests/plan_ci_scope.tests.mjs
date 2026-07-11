import assert from 'node:assert/strict';
import test from 'node:test';
import { planCiScope } from '../plan_ci_scope.mjs';
import './production_release_scope.tests.mjs';

test('docs-only changes do not spend browser minutes', () => {
  const plan = planCiScope(['docs/operations.md']);
  assert.equal(plan.run_platform, false);
  assert.equal(plan.run_record_funnel_browser_qa, false);
  assert.equal(plan.run_map_performance_qa, false);
  assert.equal(plan.run_scene_read_smoke, false);
});

test('legacy PHP changes stay in the PHP lane', () => {
  const plan = planCiScope(['upload_package/index.php']);
  assert.equal(plan.run_php_lint, true);
  assert.equal(plan.run_php_tests, true);
  assert.equal(plan.run_platform, false);
});

test('pure platform unit test changes skip browser QA', () => {
  const plan = planCiScope(['platform_v2/src/services/pricing.test.ts']);
  assert.equal(plan.run_platform, true);
  assert.equal(plan.run_record_funnel_browser_qa, false);
  assert.equal(plan.run_map_performance_qa, false);
  assert.equal(plan.run_scene_read_smoke, false);
});

test('map changes select only map browser QA', () => {
  const plan = planCiScope(['platform_v2/src/ui/mapExplorer.ts']);
  assert.equal(plan.run_map_performance_qa, true);
  assert.equal(plan.run_record_funnel_browser_qa, false);
  assert.equal(plan.run_scene_read_smoke, false);
});

test('record changes select record and scene read coverage', () => {
  const plan = planCiScope(['platform_v2/src/routes/recordQuickForm.ts']);
  assert.equal(plan.run_record_funnel_browser_qa, true);
  assert.equal(plan.run_scene_read_smoke, true);
  assert.equal(plan.run_map_performance_qa, false);
});

test('observation changes select scene read coverage', () => {
  const plan = planCiScope(['platform_v2/src/services/observationScene.ts']);
  assert.equal(plan.run_scene_read_smoke, true);
  assert.equal(plan.run_record_funnel_browser_qa, false);
});

test('unit-test-only UI changes do not launch browser QA', () => {
  const plan = planCiScope(['platform_v2/src/ui/mapExplorer.test.ts']);
  assert.equal(plan.run_platform, true);
  assert.equal(plan.run_record_funnel_browser_qa, false);
  assert.equal(plan.run_map_performance_qa, false);
  assert.equal(plan.run_scene_read_smoke, false);
});

test('unclassified public route changes remain full-browser safety triggers', () => {
  const plan = planCiScope(['platform_v2/src/routes/read.ts']);
  assert.equal(plan.run_record_funnel_browser_qa, true);
  assert.equal(plan.run_map_performance_qa, true);
  assert.equal(plan.run_scene_read_smoke, true);
});

test('browser infrastructure changes keep every browser gate', () => {
  const plan = planCiScope(['platform_v2/package-lock.json']);
  assert.equal(plan.run_record_funnel_browser_qa, true);
  assert.equal(plan.run_map_performance_qa, true);
  assert.equal(plan.run_scene_read_smoke, true);
});

test('non-CI deploy workflow changes do not force browser suites', () => {
  const plan = planCiScope(['.github/workflows/deploy.yml']);
  assert.equal(plan.run_platform, true);
  assert.equal(plan.run_deploy_manifest_check, true);
  assert.equal(plan.run_record_funnel_browser_qa, false);
  assert.equal(plan.run_map_performance_qa, false);
  assert.equal(plan.run_scene_read_smoke, false);
});

test('portable staging runner changes are deploy-impacting', () => {
  const plan = planCiScope(['scripts/run_cloudflare_staging_release.sh']);
  assert.equal(plan.deploy_changed, true);
  assert.equal(plan.run_platform, true);
  assert.equal(plan.run_deploy_manifest_check, true);
});

test('portable production runner changes are deploy-impacting', () => {
  const plan = planCiScope(['scripts/run_cloudflare_production_release.sh']);
  assert.equal(plan.deploy_changed, true);
  assert.equal(plan.run_platform, true);
  assert.equal(plan.run_deploy_manifest_check, true);
});

test('production release planner changes are deploy-impacting', () => {
  const plan = planCiScope(['scripts/plan_production_release_scope.mjs']);
  assert.equal(plan.deploy_changed, true);
  assert.equal(plan.run_deploy_manifest_check, true);
});

test('CI workflow changes keep every browser gate', () => {
  const plan = planCiScope(['.github/workflows/ci.yml']);
  assert.equal(plan.run_record_funnel_browser_qa, true);
  assert.equal(plan.run_map_performance_qa, true);
  assert.equal(plan.run_scene_read_smoke, true);
});

test('manual forced run enables all verification lanes', () => {
  const plan = planCiScope(['docs/operations.md'], { forceFull: true });
  assert.equal(plan.run_php_lint, true);
  assert.equal(plan.run_php_tests, true);
  assert.equal(plan.run_platform, true);
  assert.equal(plan.run_record_funnel_browser_qa, true);
  assert.equal(plan.run_map_performance_qa, true);
  assert.equal(plan.run_scene_read_smoke, true);
  assert.equal(plan.run_deploy_manifest_check, true);
});
