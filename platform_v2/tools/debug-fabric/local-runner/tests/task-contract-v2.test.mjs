import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCodexPrompt } from '../lib/prompt.mjs';
import { validateLocalDebugTask } from '../lib/task.mjs';

const base = {
  task_id: 'contract-v2-test',
  repository_path: '/tmp/example-repository',
  base_sha: '0123456789abcdef0123456789abcdef01234567',
  branch_name: 'debug/contract-v2-test',
  scope: 'fix_loop',
  risk: 'p1',
  repository_count: 1,
  objective: 'Repair the bounded local defect while preserving every declared interface and safety boundary.',
  acceptance_criteria: ['The deterministic contract test exits with status zero.'],
  checks: [{ id: 'contract', argv: ['node', 'test.mjs'], cwd: '.', timeout_seconds: 30, max_output_bytes: 65536 }],
  max_luna_passes: 3,
  max_terra_passes: 1,
  allow_terra: true,
  max_changed_files: 5,
  allowed_path_prefixes: ['src'],
  allow_no_changes: false,
  commit_message: 'fix: validate task contract v2',
};

test('v1 remains backward compatible without changing the normalized task shape', () => {
  const task = validateLocalDebugTask({ schema: 'ikimon.local-debug-task/v1', ...base });
  assert.equal(task.schema, 'ikimon.local-debug-task/v1');
  assert.equal(Object.hasOwn(task, 'interfaces'), false);
  assert.equal(Object.hasOwn(task, 'constraints'), false);
  assert.equal(Object.hasOwn(task, 'starting_state'), false);
});

test('v2 requires and freezes explicit interfaces, constraints, and starting state', () => {
  const task = validateLocalDebugTask({
    schema: 'ikimon.local-debug-task/v2',
    ...base,
    interfaces: ['Keep the existing command and JSON evidence schemas backward compatible.'],
    constraints: ['Do not change model routing, deployment, production, secrets, or remote Git state.'],
    starting_state: 'Begin from the exact base SHA with a clean isolated worktree and preserve valid edits across repair passes.',
  });
  assert.deepEqual(task.allowed_path_prefixes, ['src/']);
  assert.deepEqual(task.interfaces, ['Keep the existing command and JSON evidence schemas backward compatible.']);
  assert.deepEqual(task.constraints, ['Do not change model routing, deployment, production, secrets, or remote Git state.']);
  assert.equal(Object.isFrozen(task.interfaces), true);
  assert.equal(Object.isFrozen(task.constraints), true);
});

test('v2 fails closed when a required architecture field is missing', () => {
  const v2 = {
    schema: 'ikimon.local-debug-task/v2',
    ...base,
    interfaces: ['Preserve the current interface.'],
    constraints: ['Keep the change local and bounded.'],
    starting_state: 'Start from the exact base SHA in the existing isolated worktree.',
  };
  for (const field of ['interfaces', 'constraints', 'starting_state']) {
    const invalid = { ...v2 };
    delete invalid[field];
    assert.throws(() => validateLocalDebugTask(invalid), new RegExp(`invalid ${field}`, 'u'));
  }
});

test('prompt carries the complete contract and same-task correction context', () => {
  const task = validateLocalDebugTask({
    schema: 'ikimon.local-debug-task/v2',
    ...base,
    interfaces: ['Preserve evidence schema compatibility.'],
    constraints: ['Do not create a pull request or modify remote state.'],
    starting_state: 'Continue from the exact base and the current isolated worktree state.',
  });
  const prompt = buildCodexPrompt(task, {
    lane: 'local_codex_luna',
    previousFailure: { signature: 'abc123', summary: 'contract check failed' },
  });
  for (const heading of [
    '## Objective', '## Files and ownership', '## Interfaces', '## Constraints',
    '## Starting state / base', '## Acceptance criteria', '## Verification', '## Correction context',
  ]) assert.match(prompt, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  assert.match(prompt, /src\//u);
  assert.match(prompt, /same task in the same isolated worktree/u);
  assert.match(prompt, /Preserve valid prior work/u);
  assert.match(prompt, /IMPLEMENTATION REPORT/u);
  assert.match(prompt, /STATUS: complete \| partial \| blocked/u);
  assert.match(prompt, /NEXT PASS: needed \| not-needed/u);
});

test('v1 prompt receives safe derived defaults', () => {
  const task = validateLocalDebugTask({ schema: 'ikimon.local-debug-task/v1', ...base });
  const prompt = buildCodexPrompt(task, { lane: 'local_codex_luna', previousFailure: null });
  assert.match(prompt, new RegExp(task.base_sha, 'u'));
  assert.match(prompt, /Preserve every existing public and internal interface/u);
  assert.match(prompt, /fixed runner safety controls/u);
});
