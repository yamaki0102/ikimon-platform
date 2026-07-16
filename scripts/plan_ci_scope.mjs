#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BOOLEAN_OUTPUTS = [
  'php_changed',
  'platform_changed',
  'migration_changed',
  'deploy_changed',
  'run_php_lint',
  'run_php_tests',
  'run_platform',
  'run_record_funnel_browser_qa',
  'run_map_performance_qa',
  'run_scene_read_smoke',
  'run_deploy_manifest_check',
];

function normalizeFiles(files) {
  return [...new Set(files.map((file) => file.trim().replaceAll('\\', '/')).filter(Boolean))].sort();
}

function anyMatch(files, patterns) {
  return files.some((file) => patterns.some((pattern) => pattern.test(file)));
}

export function planCiScope(inputFiles, { forceFull = false } = {}) {
  const files = normalizeFiles(inputFiles);

  const phpChanged = anyMatch(files, [
    /^(upload_package|tests)\//,
    /^tools\/(lint|check_marketing_copy)\.php$/,
    /^composer\.(json|lock)$/,
    /^phpunit\.xml$/,
  ]);
  const platformChanged = anyMatch(files, [/^platform_v2\//]);
  const migrationChanged = anyMatch(files, [
    /^platform_v2\/(migrations|db\/migrations)\//,
    /^platform_v2\/cloudflare_shadow\/migrations\//,
    /^platform_v2\/src\/scripts\/applyMigrations\.ts$/,
  ]);
  const deployChanged = anyMatch(files, [
    /^\.github\/workflows\//,
    /^\.github\/actions\//,
    /^ops\/(deploy|monitoring)\//,
    /^scripts\/(check_(deploy_guardrails|deploy_manifest_sync|platform_migration_guardrails|staging_manifest_sync|release_candidate)|plan_ci_scope|plan_production_release_scope|build_production_verification_report|archive_production_verification_evidence|publish_production_verification_status)\.(ps1|mjs)$/,
    /^scripts\/(run_cloudflare_staging_release|run_cloudflare_production_release|verify_cloudflare_production_release|run_production_verification_watch|install_production_verification_service|doctor_production_verification_service)\.sh$/,
    /^scripts\/(Invoke-ProductionVerificationWatch|Install-ProductionVerificationScheduledTask|Test-ProductionVerificationWindows)\.ps1$/,
    /^scripts\/tests\/(plan_ci_scope|production_release_scope|production_verification_evidence|production_verification_operations)\.tests\.mjs$/,
  ]);

  const browserInfrastructureChanged = anyMatch(files, [
    /^\.github\/workflows\/ci\.yml$/,
    /^\.github\/actions\/setup-platform-browser\//,
    /^scripts\/plan_ci_scope\.mjs$/,
    /^scripts\/tests\/plan_ci_scope\.tests\.mjs$/,
    /^platform_v2\/package(-lock)?\.json$/,
    /^platform_v2\/playwright(?:\.[^/]+)?\.config\.ts$/,
    /^platform_v2\/src\/appInstall\.ts$/,
    /^platform_v2\/src\/(server|config)\.ts$/,
  ]);

  const browserRelevantFiles = files.filter((file) =>
    /^platform_v2\/e2e\//.test(file) || !/\.(?:test|spec)\.(?:ts|tsx|js|mjs|cjs)$/.test(file),
  );

  const cloudflareRuntimeChanged = anyMatch(browserRelevantFiles, [
    /^platform_v2\/cloudflare_shadow\/(src|migrations)\//,
    /^platform_v2\/cloudflare_shadow\/(package(-lock)?\.json|wrangler\.jsonc)$/,
  ]);

  const recordSurfaceChanged = anyMatch(browserRelevantFiles, [
    /^platform_v2\/e2e\/.*(record|upload|photo|camera|media|auth|session)/i,
    /^platform_v2\/src\/.*(record|upload|photo|camera|media|auth|session|quickForm|write)/i,
  ]);

  const mapSurfaceChanged = anyMatch(browserRelevantFiles, [
    /^platform_v2\/e2e\/.*(map|place|location|geo|walk)/i,
    /^platform_v2\/src\/.*(map|place|location|geo|tile|walkMap|areaExplorer)/i,
  ]);

  const sceneSurfaceChanged = anyMatch(browserRelevantFiles, [
    /^platform_v2\/e2e\/.*(observation|scene|candidate|identification|occurrence|visit)/i,
    /^platform_v2\/src\/.*(observation|scene|candidate|identification|occurrence|visit|subject)/i,
  ]);

  const sharedPublicSurfaceChanged = anyMatch(browserRelevantFiles, [
    /^platform_v2\/src\/(routes|ui|content)\/.*(layout|shell|navigation|header|footer|app|landing|home|global)/i,
  ]);

  const publicSurfaceChanged = anyMatch(browserRelevantFiles, [
    /^platform_v2\/src\/(routes|ui|content)\//,
    /^platform_v2\/e2e\//,
  ]);
  const unknownPublicSurfaceChanged = publicSurfaceChanged && !recordSurfaceChanged && !mapSurfaceChanged && !sceneSurfaceChanged;

  const runAllBrowser = forceFull || browserInfrastructureChanged || cloudflareRuntimeChanged || migrationChanged || sharedPublicSurfaceChanged || unknownPublicSurfaceChanged;

  const result = {
    php_changed: forceFull || phpChanged,
    platform_changed: forceFull || platformChanged,
    migration_changed: migrationChanged,
    deploy_changed: deployChanged,
    run_php_lint: forceFull || phpChanged || deployChanged,
    run_php_tests: forceFull || phpChanged,
    run_platform: forceFull || platformChanged || deployChanged,
    run_record_funnel_browser_qa: runAllBrowser || recordSurfaceChanged,
    run_map_performance_qa: runAllBrowser || mapSurfaceChanged,
    run_scene_read_smoke: runAllBrowser || sceneSurfaceChanged || recordSurfaceChanged,
    run_deploy_manifest_check: forceFull || deployChanged,
    changed_count: files.length,
    force_full: forceFull,
    files,
    reasons: {
      browser_infrastructure_changed: browserInfrastructureChanged,
      cloudflare_runtime_changed: cloudflareRuntimeChanged,
      shared_public_surface_changed: sharedPublicSurfaceChanged,
      unknown_public_surface_changed: unknownPublicSurfaceChanged,
      record_surface_changed: recordSurfaceChanged,
      map_surface_changed: mapSurfaceChanged,
      scene_surface_changed: sceneSurfaceChanged,
    },
  };

  return result;
}

function parseArgs(argv) {
  const args = { forceFull: false, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--force-full') args.forceFull = true;
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
  const enabled = (key) => (plan[key] ? 'yes' : 'no');
  return [
    '## CI scope',
    '',
    `- Changed files: ${plan.changed_count}`,
    `- Forced full run: ${enabled('force_full')}`,
    `- PHP lint: ${enabled('run_php_lint')}`,
    `- PHPUnit: ${enabled('run_php_tests')}`,
    `- Platform checks: ${enabled('run_platform')}`,
    `- /record funnel browser QA: ${enabled('run_record_funnel_browser_qa')}`,
    `- /map performance browser QA: ${enabled('run_map_performance_qa')}`,
    `- Scene read local smoke: ${enabled('run_scene_read_smoke')}`,
    `- Deploy manifest sync: ${enabled('run_deploy_manifest_check')}`,
    '',
    'Browser jobs are selected by affected surface. Shared shell, browser infrastructure, migrations, and Cloudflare runtime changes remain full-browser triggers.',
  ];
}

export function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const raw = args.changedFiles ? fs.readFileSync(args.changedFiles, 'utf8') : fs.readFileSync(0, 'utf8');
  const plan = planCiScope(raw.split(/\r?\n/), { forceFull: args.forceFull });

  appendLines(args.githubOutput, BOOLEAN_OUTPUTS.map((key) => `${key}=${String(plan[key])}`));
  appendLines(args.summary, renderSummary(plan));

  if (args.json || (!args.githubOutput && !args.summary)) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  } else {
    const compact = { changed_count: plan.changed_count, ...Object.fromEntries(BOOLEAN_OUTPUTS.map((key) => [key, plan[key]])) };
    process.stdout.write(`${JSON.stringify(compact)}\n`);
  }
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
