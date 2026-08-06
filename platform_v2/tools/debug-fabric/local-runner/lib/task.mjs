import path from 'node:path';

const SHA40 = /^[0-9a-f]{40}$/u;
const ID = /^[a-z][a-z0-9._-]{2,95}$/u;
const BRANCH = /^[A-Za-z0-9][A-Za-z0-9._/-]{2,120}$/u;
const CHECK_ID = /^[a-z][a-z0-9._-]{1,63}$/u;
const EXECUTABLE = /^[A-Za-z0-9._+-]{1,64}$/u;
const SCOPES = new Set(['source_analysis','test_generation','fault_injection','fix_loop','full_control_plane']);
const RISKS = new Set(['p0','p1','p2','p3']);
const SCHEMA_V1 = 'ikimon.local-debug-task/v1';
const SCHEMA_V2 = 'ikimon.local-debug-task/v2';
const COMMON_KEYS = [
  'schema','task_id','repository_path','base_sha','branch_name','scope','risk','repository_count','objective',
  'acceptance_criteria','checks','max_luna_passes','max_terra_passes','allow_terra',
  'max_changed_files','allowed_path_prefixes','allow_no_changes','commit_message',
];
const V2_KEYS = [...COMMON_KEYS, 'interfaces', 'constraints', 'starting_state'];
const ALLOWED_EXECUTABLES = new Set([
  'node','npm','npm.cmd','npx','npx.cmd','pnpm','pnpm.cmd','yarn','yarn.cmd',
  'bash','sh','php','composer','python','python3','powershell','pwsh','git',
]);
const SAFE_NPX_BINARIES = new Set([
  'vitest','jest','tsc','eslint','prettier','playwright','tsx','mocha','ava','c8','nyc',
]);
const FORBIDDEN_SCRIPT_TOKEN = /(?:^|[._/-])(?:deploy|publish|rollback|production|prod|migrate|migration|secret|dns|access|permission|customer-send|external-send)(?:[._/-]|$)/u;

export function validateLocalDebugTask(raw) {
  object(raw, 'task');
  const schema = raw.schema;
  if (schema !== SCHEMA_V1 && schema !== SCHEMA_V2) throw new Error('unsupported task schema');
  keys(raw, schema === SCHEMA_V2 ? V2_KEYS : COMMON_KEYS, 'task');
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
  if (!Array.isArray(raw.allowed_path_prefixes ?? []) || (raw.allowed_path_prefixes ?? []).length > 40) throw new Error('invalid allowed_path_prefixes');
  const allowedPathPrefixes = (raw.allowed_path_prefixes ?? []).map(validateRelativePrefix);
  const commitMessage = text(raw.commit_message ?? `debug(${raw.task_id}): local candidate`, 5, 160, 'commit_message');
  if (/[\r\n]/u.test(commitMessage)) throw new Error('commit_message must be single line');
  const baseTask = {
    schema,
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
  };
  if (schema === SCHEMA_V1) return Object.freeze(baseTask);
  return Object.freeze({
    ...baseTask,
    interfaces: Object.freeze(textList(raw.interfaces, 1, 30, 3, 1000, 'interfaces')),
    constraints: Object.freeze(textList(raw.constraints, 1, 40, 3, 1000, 'constraints')),
    starting_state: text(raw.starting_state, 10, 4000, 'starting_state'),
  });
}

function validateCheck(raw, seen) {
  object(raw, 'check');
  keys(raw, ['id','argv','cwd','timeout_seconds','max_output_bytes'], 'check');
  if (!CHECK_ID.test(raw.id ?? '') || seen.has(raw.id)) throw new Error('invalid check id');
  seen.add(raw.id);
  if (!Array.isArray(raw.argv) || raw.argv.length < 1 || raw.argv.length > 32) throw new Error('invalid check argv');
  const argv = raw.argv.map((value) => text(value, 1, 2048, 'check arg'));
  if (argv[0] !== path.basename(argv[0]) || /[\\/]/u.test(argv[0])) throw new Error('check executable must be a command name');
  const executable = argv[0].toLowerCase();
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
    if (FORBIDDEN_SCRIPT_TOKEN.test(script)) throw new Error(`forbidden check script:${script}`);
    return;
  }
  if (['npx','npx.cmd'].includes(executable)) {
    const binary = lower.find((value) => !value.startsWith('-')) ?? '';
    if (!SAFE_NPX_BINARIES.has(binary)) throw new Error(`npx check binary not allowed:${binary || 'missing'}`);
    return;
  }
  if (executable === 'bash' || executable === 'sh') {
    if (args.length < 1 || args[0].startsWith('-')) throw new Error('shell check requires a relative script path');
    validateSafeScriptPath(args[0]);
    return;
  }
  if (executable === 'powershell' || executable === 'pwsh') {
    if (lower.some((value) => ['-command','-c','-encodedcommand','-enc'].includes(value))) throw new Error('inline powershell check forbidden');
    const fileIndex = lower.indexOf('-file');
    if (fileIndex < 0 || !args[fileIndex + 1]) throw new Error('powershell check requires -File');
    validateSafeScriptPath(args[fileIndex + 1]);
    return;
  }
  if (executable === 'node') {
    if (lower.some((value) => ['-e','--eval','-p','--print'].includes(value))) throw new Error('inline node check forbidden');
    return;
  }
  if (executable === 'python' || executable === 'python3') {
    if (lower.includes('-c')) throw new Error('inline python check forbidden');
    const moduleIndex = lower.indexOf('-m');
    if (moduleIndex >= 0 && !['pytest','unittest','compileall'].includes(lower[moduleIndex + 1] ?? '')) {
      throw new Error('python module check not allowed');
    }
    return;
  }
  if (executable === 'php' && lower.includes('-r')) throw new Error('inline php check forbidden');
}

function validateSafeScriptPath(value) {
  const normalized = validateRelativePath(value);
  if (normalized === '.' || FORBIDDEN_SCRIPT_TOKEN.test(normalized.toLowerCase())) throw new Error('unsafe check script path');
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
function textList(value, minItems, maxItems, minLength, maxLength, label) {
  if (!Array.isArray(value) || value.length < minItems || value.length > maxItems) throw new Error(`invalid ${label}`);
  return value.map((entry) => text(entry, minLength, maxLength, label.slice(0, -1)));
}
function text(value, min, max, label) {
  if (typeof value !== 'string' || value.length < min || value.length > max || value.includes('\0')) throw new Error(`invalid ${label}`);
  return value;
}
