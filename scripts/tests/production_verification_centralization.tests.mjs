import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));

test('product repo exposes an adapter-only immutable contract', () => {
  const contract = readJson('ops/monitoring/production_verification_adapter.json');
  assert.equal(contract.schemaVersion, 'ikimon_production_verification_adapter/v1');
  assert.equal(contract.commandId, 'ikimon-production-verification-v1');
  assert.equal(contract.entrypoint, 'scripts/run_production_verification_watch.sh');
  assert.match(contract.entrypointSha256, /^[0-9a-f]{64}$/);
  assert.equal(contract.resultSchema, 'ikimon_production_verification/v1');
  assert.equal(contract.productionMutation, false);
  assert.equal(contract.safety.personalDataInOutput, false);
  assert.deepEqual(contract.dynamicArguments, []);
  assert.equal(contract.owner.scheduler, 'yamaki0102/all-projects-management');
  assert.equal(contract.owner.evidence, 'yamaki0102/all-projects-management');
  assert.equal(contract.owner.alerting, 'yamaki0102/all-projects-management');
});

test('legacy host installers are deprecated and new installation is blocked', () => {
  const policy = readJson('ops/monitoring/production_verification_policy.json');
  assert.equal(policy.schemaVersion, 'ikimon_production_verification_policy/v4');
  assert.equal(policy.ownership.productRepo, 'verification-adapter');
  assert.equal(policy.ownership.scheduler, 'yamaki0102/all-projects-management');
  assert.equal(policy.activation.newHostInstallationsAllowed, false);
  assert.equal(policy.activation.legacyHostIntegration, 'deprecated-shadow-migration');
  assert.equal(policy.activation.cleanupRequiresCentralShadowEvidence, true);
  assert.equal(policy.activation.automaticUninstallAllowed, false);
});

test('phase 4 and phase 5 runbooks visibly stop new host activation', () => {
  for (const relative of [
    'docs/operations/github-actions-dependency-reduction-phase4-2026-07-12.md',
    'docs/operations/github-actions-dependency-reduction-phase5-2026-07-12.md',
  ]) {
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    assert.match(source, /SUPERSEDED FOR NEW INSTALLATIONS/);
    assert.match(source, /all-projects-management/);
    assert.match(source, /自動アンインストールしない/);
  }
});
