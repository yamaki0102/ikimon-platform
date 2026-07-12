import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { archiveProductionVerificationEvidence } from '../archive_production_verification_evidence.mjs';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const sha = 'b'.repeat(40);

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

test('verification evidence archive stores immutable SHA-bound copies and a latest pointer', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ikimon-verification-archive-'));
  const reportPath = path.join(root, 'latest.json');
  const logPath = path.join(root, 'latest.log');
  const runtimePath = path.join(root, 'runtime.json');
  const archiveDir = path.join(root, 'history');
  writeJson(reportPath, {
    schemaVersion: 'ikimon_production_verification/v1',
    status: 'success',
    expectedGitSha: sha,
    finishedAt: '2026-07-12T01:02:03Z',
    smokeTier: 'targeted',
  });
  fs.writeFileSync(logPath, '== Health ==\nOK https://ikimon.life/healthz -> 200\n');
  writeJson(runtimePath, { gitSha: sha });

  const result = archiveProductionVerificationEvidence({
    reportPath,
    logPath,
    runtimePath,
    archiveDir,
    retentionDays: 14,
    now: new Date('2026-07-12T01:03:00Z'),
  });

  assert.ok(fs.existsSync(result.reportPath));
  assert.ok(fs.existsSync(result.logPath));
  assert.ok(fs.existsSync(result.runtimePath));
  assert.match(path.basename(result.reportPath), /^20260712T010203Z-b{12}-targeted-success\.json$/);
  const pointer = JSON.parse(fs.readFileSync(path.join(archiveDir, 'latest.json'), 'utf8'));
  assert.equal(pointer.expectedGitSha, sha);
  assert.equal(pointer.status, 'success');
  assert.ok(!path.isAbsolute(pointer.report));
});

test('verification evidence archive removes expired day directories without touching recent evidence', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ikimon-verification-prune-'));
  const reportPath = path.join(root, 'report.json');
  const archiveDir = path.join(root, 'history');
  writeJson(reportPath, {
    schemaVersion: 'ikimon_production_verification/v1',
    status: 'failure',
    expectedGitSha: sha,
    finishedAt: '2026-07-20T00:00:00Z',
    smokeTier: 'targeted',
  });
  fs.mkdirSync(path.join(archiveDir, '2026-06-01'), { recursive: true });
  fs.writeFileSync(path.join(archiveDir, '2026-06-01', 'old.json'), '{}');

  const result = archiveProductionVerificationEvidence({
    reportPath,
    archiveDir,
    retentionDays: 14,
    now: new Date('2026-07-20T00:01:00Z'),
  });

  assert.ok(result.removedFiles >= 1);
  assert.equal(fs.existsSync(path.join(archiveDir, '2026-06-01')), false);
  assert.equal(fs.existsSync(path.join(archiveDir, '2026-07-20')), true);
});

test('verification evidence archive rejects unsupported or unbound reports', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ikimon-verification-invalid-'));
  const reportPath = path.join(root, 'report.json');
  writeJson(reportPath, { schemaVersion: 'other/v1', expectedGitSha: sha });
  assert.throws(() => archiveProductionVerificationEvidence({ reportPath, archiveDir: path.join(root, 'archive') }), /Unsupported/);
  writeJson(reportPath, { schemaVersion: 'ikimon_production_verification/v1', expectedGitSha: 'short' });
  assert.throws(() => archiveProductionVerificationEvidence({ reportPath, archiveDir: path.join(root, 'archive') }), /expectedGitSha/);
});

test('installer is secret-safe, idempotent, dry-runnable, and verifies rendered systemd units', () => {
  const installer = read('scripts/install_production_verification_service.sh');
  assert.match(installer, /--dry-run/);
  assert.match(installer, /--uninstall/);
  assert.match(installer, /Preserving existing environment file/);
  assert.match(installer, /systemd-analyze verify/);
  assert.match(installer, /runuser -u/);
  assert.match(installer, /systemctl start "\$\{SERVICE_NAME\}"[\s\S]*systemctl enable --now "\$\{TIMER_NAME\}"/);
  assert.doesNotMatch(installer, /--(?:github|cloudflare)-token/);
  assert.doesNotMatch(installer, /GITHUB_TOKEN=.*\$2/);
});

test('doctor validates dependencies, secret permissions, exact runtime SHA, report freshness, and timer state', () => {
  const doctor = read('scripts/doctor_production_verification_service.sh');
  for (const marker of [
    'Node.js 22+',
    "stat -c '%a'",
    'PUBLISH_GITHUB_STATUS=true',
    'api/v1/runtime/version',
    '40}$',
    'maxAgeMinutes',
    'noPersonalData',
    'productionMutation',
    'systemctl is-enabled',
    'systemctl is-active',
  ]) {
    assert.match(doctor, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('systemd service uses a private state directory, archive retention, and hardened read-only execution', () => {
  const service = read('ops/monitoring/systemd/ikimon-production-verification.service');
  const timer = read('ops/monitoring/systemd/ikimon-production-verification.timer');
  const envExample = read('ops/monitoring/systemd/production-verification.env.example');
  for (const marker of [
    'StateDirectory=ikimon-production-verification',
    'UMask=0077',
    'ProtectSystem=strict',
    'NoNewPrivileges=true',
    'PrivateDevices=true',
    'IKIMON_VERIFICATION_ARCHIVE_DIR=/var/lib/ikimon-production-verification/history',
    'IKIMON_VERIFICATION_ARCHIVE_RETENTION_DAYS=14',
  ]) assert.match(service, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(service, /^Environment=PUBLISH_GITHUB_STATUS=true$/m);
  assert.match(timer, /OnCalendar=\*:0\/15/);
  assert.match(envExample, /^PUBLISH_GITHUB_STATUS=false$/m);
  assert.doesNotMatch(envExample, /^(?:GITHUB_TOKEN|GH_TOKEN)=\S+/m);
});

test('watcher archives evidence best-effort without changing verification exit semantics', () => {
  const watcher = read('scripts/run_production_verification_watch.sh');
  assert.match(watcher, /archive_production_verification_evidence\.mjs/);
  assert.match(watcher, /evidence archival failed; preserving verification exit code/);
  assert.match(watcher, /exit "\$\{VERIFY_EXIT\}"/);
  assert.match(watcher, /umask 0077/);
});
