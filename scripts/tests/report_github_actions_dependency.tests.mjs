import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectWorkflowDirectory, inspectWorkflowText, renderMarkdown } from '../report_github_actions_dependency.mjs';

test('detects repeated hosted setup, browser, artifact and deploy markers', () => {
  const result = inspectWorkflowText(`
jobs:
  qa:
    runs-on: ubuntu-latest
    steps:
      - run: npm ci
      - run: npm ci
      - run: npm ci
      - run: npx playwright install chromium
      - run: npm run e2e:staging
      - uses: actions/upload-artifact@v6
      - run: npx wrangler deploy
`);
  assert.equal(result.hostedRunnerJobs, 1);
  assert.equal(result.npmCi, 3);
  assert.equal(result.playwrightInstalls, 1);
  assert.equal(result.artifactUploads, 1);
  assert.equal(result.deployLane, true);
  assert.equal(result.likelyHeavy, true);
});

test('inspects a workflow directory and renders a compact report', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'actions-report-'));
  const workflows = path.join(root, '.github', 'workflows');
  fs.mkdirSync(workflows, { recursive: true });
  fs.writeFileSync(path.join(workflows, 'light.yml'), 'jobs:\n  lint:\n    runs-on: ubuntu-latest\n    steps:\n      - run: ./scripts/check.sh\n');
  fs.writeFileSync(path.join(workflows, 'heavy.yaml'), 'jobs:\n  qa:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm ci\n      - run: npm ci\n      - run: npm ci\n      - run: npm run e2e:staging\n      - uses: actions/upload-artifact@v6\n');
  const report = inspectWorkflowDirectory(root);
  assert.equal(report.workflowCount, 2);
  assert.equal(report.likelyHeavyWorkflowCount, 1);
  assert.equal(report.totals.artifactUploads, 1);
  assert.match(renderMarkdown(report), /heavy\.yaml/);
});
