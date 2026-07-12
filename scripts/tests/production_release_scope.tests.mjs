import assert from 'node:assert/strict';
import test from 'node:test';
import { planProductionReleaseScope } from '../plan_production_release_scope.mjs';

test('documentation changes do not deploy production', () => {
  const plan = planProductionReleaseScope(['docs/operations/new-plan.md']);
  assert.equal(plan.deploy_required, false);
  assert.equal(plan.run_guardrails, false);
});

test('test-only platform changes do not deploy production', () => {
  const plan = planProductionReleaseScope([
    'platform_v2/src/routes/read.test.ts',
    'platform_v2/e2e/record-funnel.staging.spec.ts',
  ]);
  assert.equal(plan.deploy_required, false);
});

test('workflow-only changes run guardrails without production mutation', () => {
  const plan = planProductionReleaseScope(['.github/workflows/deploy.yml']);
  assert.equal(plan.deploy_required, false);
  assert.equal(plan.run_guardrails, true);
  assert.equal(plan.reason, 'control_plane_only');
});

test('portable production runner changes run guardrails without mutation', () => {
  const plan = planProductionReleaseScope(['scripts/run_cloudflare_production_release.sh']);
  assert.equal(plan.deploy_required, false);
  assert.equal(plan.run_guardrails, true);
});

test('verification evidence and monitoring changes are control-plane only', () => {
  const plan = planProductionReleaseScope([
    'scripts/run_production_verification_watch.sh',
    'scripts/build_production_verification_report.mjs',
    'scripts/archive_production_verification_evidence.mjs',
    'scripts/publish_production_verification_status.mjs',
    'scripts/install_production_verification_service.sh',
    'scripts/doctor_production_verification_service.sh',
    'scripts/tests/production_verification_operations.tests.mjs',
    'ops/monitoring/production_verification_policy.json',
    'ops/monitoring/systemd/ikimon-production-verification.service',
  ]);
  assert.equal(plan.deploy_required, false);
  assert.equal(plan.run_guardrails, true);
  assert.equal(plan.reason, 'control_plane_only');
  assert.equal(plan.runtime_files.length, 0);
});

test('longform Markdown content requires production deploy', () => {
  const plan = planProductionReleaseScope(['platform_v2/src/content/longform/ja/privacy.md']);
  assert.equal(plan.deploy_required, true);
  assert.equal(plan.smoke_tier, 'full');
});

test('application route changes require full production deploy', () => {
  const plan = planProductionReleaseScope(['platform_v2/src/routes/read.ts']);
  assert.equal(plan.deploy_required, true);
  assert.equal(plan.smoke_tier, 'full');
});

test('worker source changes require full production deploy', () => {
  const plan = planProductionReleaseScope(['platform_v2/cloudflare_shadow/src/index.ts']);
  assert.equal(plan.deploy_required, true);
  assert.equal(plan.smoke_tier, 'full');
});

test('D1 migration changes require production deploy', () => {
  const plan = planProductionReleaseScope(['platform_v2/cloudflare_shadow/migrations/core/0012_new.sql']);
  assert.equal(plan.deploy_required, true);
  assert.equal(plan.smoke_tier, 'full');
});

test('materializer changes require production deploy', () => {
  const plan = planProductionReleaseScope(['platform_v2/cloudflare_shadow/scripts/materialize-original-ui-html.mjs']);
  assert.equal(plan.deploy_required, true);
});

test('deploy guard implementation changes are control-plane only', () => {
  const plan = planProductionReleaseScope(['platform_v2/cloudflare_shadow/scripts/deploy-production-guard.mjs']);
  assert.equal(plan.deploy_required, false);
  assert.equal(plan.run_guardrails, true);
});

test('force deploy overrides an otherwise irrelevant change', () => {
  const plan = planProductionReleaseScope(['docs/operations.md'], { forceDeploy: true });
  assert.equal(plan.deploy_required, true);
  assert.equal(plan.run_guardrails, true);
  assert.equal(plan.reason, 'forced_deploy');
});
