#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BOOLEAN_OUTPUTS = ['deploy_required', 'run_guardrails'];

function normalizeFiles(files) {
  return [...new Set(files.map((file) => file.trim().replaceAll('\\', '/')).filter(Boolean))].sort();
}

function isTestOrDocumentation(pathname) {
  return /(^|\/)(?:docs?|e2e)\//.test(pathname)
    || /\.(?:test|spec)\.(?:ts|tsx|js|mjs|cjs)$/.test(pathname)
    || /(?:^|\/)playwright(?:\.[^/]+)?\.config\.ts$/.test(pathname);
}

function isProductionRuntimePath(pathname) {
  if (isTestOrDocumentation(pathname)) return false;

  if (/^platform_v2\/cloudflare_shadow\/scripts\/materialize-original-ui-html\.mjs$/.test(pathname)) return true;
  if (/^platform_v2\/cloudflare_shadow\/(?:src|migrations)\//.test(pathname)) return true;
  if (/^platform_v2\/cloudflare_shadow\/(?:wrangler\.jsonc|package(?:-lock)?\.json|tsconfig\.json)$/.test(pathname)) return true;
  if (/^platform_v2\/src\//.test(pathname)) return true;
  if (/^platform_v2\/(?:package(?:-lock)?\.json|tsconfig\.json)$/.test(pathname)) return true;
  if (/^platform_v2\/scripts\/sync-face-privacy-assets\.mjs$/.test(pathname)) return true;
  if (/^platform_v2\/(?:public|assets|static)\//.test(pathname)) return true;

  return false;
}

function isProductionControlPath(pathname) {
  return /^\.github\/workflows\/deploy\.yml$/.test(pathname)
    || /^ops\/(?:deploy|monitoring)\//.test(pathname)
    || /^scripts\/(?:check_(?:deploy_guardrails|deploy_manifest_sync|staging_manifest_sync|platform_migration_guardrails|legacy_entrypoint_reason)|classify_deploy_smoke_tier|plan_production_release_scope|build_production_verification_report|archive_production_verification_evidence|publish_production_verification_status)\.(?:ps1|mjs)$/.test(pathname)
    || /^scripts\/(?:run_cloudflare_production_release|verify_cloudflare_production_release|run_production_verification_watch|install_production_verification_service|doctor_production_verification_service)\.sh$/.test(pathname)
    || /^scripts\/tests\/(?:production_release_scope\.tests\.mjs|production_verification_evidence\.tests\.mjs|production_verification_operations\.tests\.mjs|release_automation\.tests\.ps1)$/.test(pathname)
    || /^platform_v2\/cloudflare_shadow\/scripts\/(?:deploy-production-guard|production-deploy-clean-gate)\.mjs$/.test(pathname)
    || /^platform_v2\/cloudflare_shadow\/src\/productionReleaseScripts\.test\.ts$/.test(pathname);
}

export function planProductionReleaseScope(inputFiles, { forceDeploy = false } = {}) {
  const files = normalizeFiles(inputFiles);
  const runtimeFiles = files.filter(isProductionRuntimePath);
  const controlFiles = files.filter(isProductionControlPath);
  const deployRequired = forceDeploy || runtimeFiles.length > 0;
  const runGuardrails = deployRequired || controlFiles.length > 0;

  let reason = 'no_production_effect';
  if (forceDeploy) reason = 'forced_deploy';
  else if (runtimeFiles.length > 0) reason = 'production_runtime_changed';
  else if (controlFiles.length > 0) reason = 'control_plane_only';

  const fullSmoke = runtimeFiles.some((file) =>
    /^platform_v2\/(?:src|package(?:-lock)?\.json|tsconfig\.json)/.test(file)
      || /^platform_v2\/cloudflare_shadow\/(?:src|migrations|wrangler\.jsonc|package(?:-lock)?\.json)/.test(file)
      || /materialize-original-ui-html\.mjs$/.test(file),
  );

  return {
    deploy_required: deployRequired,
    run_guardrails: runGuardrails,
    smoke_tier: fullSmoke ? 'full' : 'targeted',
    reason,
    changed_count: files.length,
    runtime_files: runtimeFiles,
    control_files: controlFiles,
    files,
  };
}

function parseArgs(argv) {
  const args = { forceDeploy: false, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--force-deploy') args.forceDeploy = true;
    else if (value === '--json') args.json = true;
    else if (value === '--changed-files') args.changedFiles = argv[++index];
    else if (value === '--github-output') args.githubOutput = argv[++index];
    else if (value === '--summary') args.summary = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function appendLines(filePath, lines) {
  if (!filePath) return;
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.appendFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function renderSummary(plan) {
  return [
    '## Production release scope',
    '',
    `- Changed files: ${plan.changed_count}`,
    `- Production deploy required: ${plan.deploy_required ? 'yes' : 'no'}`,
    `- Guardrails required: ${plan.run_guardrails ? 'yes' : 'no'}`,
    `- Smoke tier: ${plan.smoke_tier}`,
    `- Reason: ${plan.reason}`,
    `- Runtime files: ${plan.runtime_files.length}`,
    `- Control-plane files: ${plan.control_files.length}`,
    '',
    plan.deploy_required
      ? 'The exact checked-out SHA may be promoted after guardrails and the production environment gate pass.'
      : 'No production Worker, D1, or R2 mutation will run for this main push.',
  ];
}

export function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const raw = args.changedFiles ? fs.readFileSync(args.changedFiles, 'utf8') : fs.readFileSync(0, 'utf8');
  const plan = planProductionReleaseScope(raw.split(/\r?\n/), { forceDeploy: args.forceDeploy });

  appendLines(args.githubOutput, [
    ...BOOLEAN_OUTPUTS.map((key) => `${key}=${String(plan[key])}`),
    `smoke_tier=${plan.smoke_tier}`,
    `reason=${plan.reason}`,
    `changed_count=${plan.changed_count}`,
  ]);
  appendLines(args.summary, renderSummary(plan));

  if (args.json || (!args.githubOutput && !args.summary)) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify({
      deploy_required: plan.deploy_required,
      run_guardrails: plan.run_guardrails,
      smoke_tier: plan.smoke_tier,
      reason: plan.reason,
      changed_count: plan.changed_count,
    })}\n`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  }
}
