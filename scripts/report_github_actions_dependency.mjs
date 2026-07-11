#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKFLOW_PATTERN = /\.ya?ml$/i;

function count(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

export function inspectWorkflowText(text) {
  const hostedRunnerJobs = count(text, /^\s*runs-on:\s*(?:ubuntu|windows|macos)-[^\s#]+/gm);
  const artifactUploads = count(text, /uses:\s*actions\/upload-artifact@/g);
  const artifactDownloads = count(text, /uses:\s*actions\/download-artifact@/g);
  const npmCi = count(text, /(?:^|\s)npm ci(?:\s|$)/gm);
  const playwrightInstalls = count(text, /playwright install/g);
  const browserCommands = count(text, /(?:playwright test|e2e:|browser QA|browser smoke)/gi);
  const wranglerCommands = count(text, /(?:npx\s+)?wrangler\s|deploy:(?:staging|production|shadow)/g);
  const sshCommands = count(text, /(?:ssh-action@|\bssh\s+-i\b|VPS_SSH_KEY)/g);
  const portableScriptCalls = count(text, /\.\/scripts\/[a-zA-Z0-9_.\/-]+/g);
  return {
    hostedRunnerJobs,
    artifactUploads,
    artifactDownloads,
    npmCi,
    playwrightInstalls,
    browserCommands,
    wranglerCommands,
    sshCommands,
    portableScriptCalls,
    workflowDispatch: /^\s*workflow_dispatch:/m.test(text),
    scheduled: /^\s*schedule:/m.test(text),
    likelyHeavy: hostedRunnerJobs > 0 && (playwrightInstalls > 0 || browserCommands > 1 || npmCi > 2),
    deployLane: wranglerCommands > 0 || sshCommands > 0,
  };
}

export function inspectWorkflowDirectory(root) {
  const workflowDir = path.join(root, '.github', 'workflows');
  if (!fs.existsSync(workflowDir)) throw new Error(`Workflow directory not found: ${workflowDir}`);
  const workflows = fs.readdirSync(workflowDir)
    .filter((name) => WORKFLOW_PATTERN.test(name))
    .sort()
    .map((name) => {
      const text = fs.readFileSync(path.join(workflowDir, name), 'utf8');
      return { name, ...inspectWorkflowText(text) };
    });

  const total = workflows.reduce((sum, workflow) => {
    for (const key of ['hostedRunnerJobs', 'artifactUploads', 'artifactDownloads', 'npmCi', 'playwrightInstalls', 'browserCommands', 'wranglerCommands', 'sshCommands', 'portableScriptCalls']) {
      sum[key] += workflow[key];
    }
    return sum;
  }, {
    hostedRunnerJobs: 0,
    artifactUploads: 0,
    artifactDownloads: 0,
    npmCi: 0,
    playwrightInstalls: 0,
    browserCommands: 0,
    wranglerCommands: 0,
    sshCommands: 0,
    portableScriptCalls: 0,
  });

  return {
    schemaVersion: 'github_actions_dependency_report/v1',
    generatedAt: new Date().toISOString(),
    workflowCount: workflows.length,
    likelyHeavyWorkflowCount: workflows.filter((item) => item.likelyHeavy).length,
    deployWorkflowCount: workflows.filter((item) => item.deployLane).length,
    totals: total,
    workflows,
  };
}

export function renderMarkdown(report) {
  const rows = report.workflows
    .filter((item) => item.likelyHeavy || item.deployLane || item.artifactUploads > 0)
    .map((item) => `| ${item.name} | ${item.hostedRunnerJobs} | ${item.npmCi} | ${item.browserCommands} | ${item.artifactUploads} | ${item.deployLane ? 'yes' : 'no'} |`);
  return [
    '# GitHub Actions dependency report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `- Workflows: ${report.workflowCount}`,
    `- Likely heavy workflows: ${report.likelyHeavyWorkflowCount}`,
    `- Deploy workflows: ${report.deployWorkflowCount}`,
    `- Hosted-runner jobs: ${report.totals.hostedRunnerJobs}`,
    `- Artifact upload steps: ${report.totals.artifactUploads}`,
    `- npm ci occurrences: ${report.totals.npmCi}`,
    '',
    '| Workflow | Hosted jobs | npm ci | Browser markers | Artifact uploads | Deploy lane |',
    '|---|---:|---:|---:|---:|---|',
    ...rows,
    '',
    'This is an inventory, not a billing estimate. Use it to find repeated setup, browser, artifact, and deployment logic that should move into portable scripts or provider-native execution.',
    '',
  ].join('\n');
}

function parseArgs(argv) {
  const args = { root: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--root') args.root = argv[++index];
    else if (value === '--json') args.json = argv[++index];
    else if (value === '--markdown') args.markdown = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

export function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const report = inspectWorkflowDirectory(path.resolve(args.root));
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const markdown = `${renderMarkdown(report)}\n`;
  if (args.json) {
    fs.mkdirSync(path.dirname(path.resolve(args.json)), { recursive: true });
    fs.writeFileSync(args.json, json);
  }
  if (args.markdown) {
    fs.mkdirSync(path.dirname(path.resolve(args.markdown)), { recursive: true });
    fs.writeFileSync(args.markdown, markdown);
  }
  if (!args.json && !args.markdown) process.stdout.write(json);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  }
}
