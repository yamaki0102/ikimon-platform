import path from 'node:path';

const SHA40 = /^[0-9a-f]{40}$/u;
const ID = /^[a-z][a-z0-9._-]{2,95}$/u;
const BRANCH = /^[A-Za-z0-9][A-Za-z0-9._/-]{2,120}$/u;
const CHECK_ID = /^[a-z][a-z0-9._-]{1,63}$/u;
const EXECUTABLE = /^[A-Za-z0-9._+-]{1,64}$/u;
const SCOPES = new Set(['source_analysis','test_generation','fault_injection','fix_loop','full_control_plane']);
const RISKS = new Set(['p0','p1','p2','p3']);
const ALLOWED_EXECUTABLES = new Set([
  'node','npm','npm.cmd','npx','npx.cmd','pnpm','pnpm.cmd','yarn','yarn.cmd',
  'bash','sh','php','composer','python','python3','powershell','pwsh','git',
]);

export function validateLocalDebugTask(raw) {
  object(raw, 'task');
  keys(raw, [
    'schema','task_id','repository_path','base_sha','branch_name','scope','risk','repository_count','objective',
    'acceptance_criteria','checks','max_luna_passes','max_terra_passes','allow_terra',
    'max_changed_files','allowed_path_prefixes','allow_no_changes','commit_message',
  ], 'task');
  if (raw.schema !== 'ikimon.local-debug-task/v1') throw new Error('unsupported task schema');
  if (!ID.test(raw.task_id ?? '')) throw new Error('invalid task_id');
  if (typeof raw.repository_path !== 'string' || !path.isAbsolute(raw.repository_path)) throw new Error('repository_path must be absolute');
  if (!SHA40.test(raw.base_sha ?? '')) throw new Error('invalid base_sha');
  const branchName = raw.branch_name ?? `debug/${raw.task_id}-${raw.base_sha.slice(0, 8)}`;
  if (!BRANCH.test(branchName) || !branchName.startsWith('debug/') || branchName.includes('..') || branchName.endsWith('/') || branchName.startsWith('/')) throw new Error('invalid branch_name');
  if (!SCOPES.has(raw.scope)) throw new Error('invalid scope');
  if (!RISKS.has(raw.risk)) throw new Error('invalid risk');
  const repositoryCount = integer(raw.repository_count ?? 1, 1, 8, 'repository_count');
  const objective = text(raw.objective, 20, 12000, 'objective');
  if (!Array.isArray(raw.acceptance_criteria) || raw.acceptance_criteria.length < 1 || raw.acceptance_criteria.length > 30) {
    throw new Error('invalid acceptance_criteria');
  }
  const acceptanceCriteria = raw.acceptance_criteria.map((value) => text(value, 3, 1000, 'acceptance criterion'));
  if (!Array.isArray(raw.checks) || raw.checks.length < 1 || raw.checks.length > 20) throw new Error('invalid checks');
  const seen = new Set();
  const checks = raw.checks.map((value) => validateCheck(value, seen));
  const maxLunaPasses = integer(raw.max_luna_passes ?? 3, 1, 10, 'max_luna_passes');
  const maxTerraPasses = integer(raw.max_terra_passes ?? 1, 0, 3, 'max_terra_passes');
  const allowTerra = raw.allow_terra !== false;
  if (!allowTerra && maxTerraPasses !== 0 && raw.max_terra_passes !== undefined) throw new Error('max_terra_passes requires allow_terra');
  const maxChangedFiles = integer(raw.max_changed_files ?? 50, 1, 500, 'max_changed_files');
  if (!Array.isArray(raw.allowed_path_prefixes ?? [] ) || (raw.allowed_path_prefixes ?? []).length > 40) throw new Error('invalid allowed_path_prefixes');
  const allowedPathPrefixes = (raw.allowed_path_prefixes ?? []).map(validateRelativePrefix);
  const commitMessage = text(raw.commit_message ?? `debug(${raw.task_id}): local candidate`, 5, 160, 'commit_message');
  if (/[\r\n]/u.test(commitMessage)) throw new Error('commit_message must be single line');
  return Object.freeze({
    schema: raw.schema,
    task_id: raw.task_id,
    repository_path: path.resolve(raw.repository_path),
    base_sha: raw.base_sha,
    branch_name: branchName,
    scope: raw.scope,
    risk: raw.risk,
    repository_count: repositoryCount,
    objective,
    acceptance_criteria: Object.freeze(acceptanceCriteria),
    checks: Object.freeze(checks),
    max_luna_passes: maxLunaPasses,
    max_terra_passes: allowTerra ? maxTerraPasses : 0,
    allow_terra: allowTerra,
    max_changed_files: maxChangedFiles,
    allowed_path_prefixes: Object.freeze(allowedPathPrefixes),
    allow_no_changes: raw.allow_no_changes === true,
    commit_message: commitMessage,
  });
}

function validateCheck(raw, seen) {
  object(raw, 'check');
  keys(raw, ['id','argv','cwd','timeout_seconds','max_output_bytes'], 'check');
  if (!CHECK_ID.test(raw.id ?? '') || seen.has(raw.id)) throw new Error('invalid check id');
  seen.add(raw.id);
  if (!Array.isArray(raw.argv) || raw.argv.length < 1 || raw.argv.length > 32) throw new Error('invalid check argv');
  const argv = raw.argv.map((value) => text(value, 1, 2048, 'check arg'));
  const executable = path.basename(argv[0]).toLowerCase();
  if (!EXECUTABLE.test(executable) || !ALLOWED_EXECUTABLES.has(executable)) throw new Error('check executable not allowed');
  enforceCommandPolicy(executable, argv.slice(1));
  const cwd = validateRelativePath(raw.cwd ?? '.');
  return Object.freeze({
    id: raw.id,
    argv: Object.freeze(argv),
    cwd,
    timeout_seconds: integer(raw.timeout_seconds ?? 1800, 1, 7200, 'timeout_seconds'),
    max_output_bytes: integer(raw.max_output_bytes ?? 1048576, 4096, 8388608, 'max_output_bytes'),
  });
}

function enforceCommandPolicy(executable, args) {
  const lower = args.map((value) => value.toLowerCase());
  if (executable === 'git') {
    const allowed = new Set(['diff','status','rev-parse','ls-files','show','grep','log']);
    if (!allowed.has(lower[0] ?? '')) throw new Error('git check subcommand not allowed');
    return;
  }
  if (['npm','npm.cmd','pnpm','pnpm.cmd','yarn','yarn.cmd'].includes(executable)) {
    const command = lower[0] ?? '';
    const script = command === 'run' ? (lower[1] ?? '') : command;
    if (/^(?:deploy|publish|rollback|prod|production)(?::|$)/u.test(script)
        || /^(?:migrate|migration):(?:apply|up|run)(?::|$)/u.test(script)) {
      throw new Error(`forbidden check script:${script}`);
    }
  }
  if (['npx','npx.cmd'].includes(executable) && lower[0] === 'wrangler') {
    throw new Error('wrangler check executable forbidden');
  }
  if ((executable === 'bash' || executable === 'sh' || executable === 'powershell' || executable === 'pwsh') && args.length < 1) {
    throw new Error('shell check requires a script path');
  }
}

function validateRelativePath(value) {
  const textValue = text(value, 1, 1024, 'relative path').replaceAll('\\', '/');
  if (path.posix.isAbsolute(textValue) || textValue.includes('\0')) throw new Error('path must be relative');
  const normalized = path.posix.normalize(textValue);
  if (normalized === '..' || normalized.startsWith('../')) throw new Error('path traversal forbidden');
  return normalized;
}

function validateRelativePrefix(value) {
  const normalized = validateRelativePath(value).replace(/^\.\//u, '');
  return normalized.endsWith('/') ? normalized : `${normalized}/`;
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${label} must be object`);
  }
}
function keys(value, allowed, label) {
  const set = new Set(allowed);
  if (Object.keys(value).some((key) => !set.has(key))) throw new Error(`${label} contains unsupported key`);
}
function integer(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`invalid ${label}`);
  return value;
}
function text(value, min, max, label) {
  if (typeof value !== 'string' || value.length < min || value.length > max || value.includes('\0')) throw new Error(`invalid ${label}`);
  return value;
}
