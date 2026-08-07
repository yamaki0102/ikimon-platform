import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildCodexPrompt } from '../lib/prompt.mjs';
import { validateLocalDebugTask } from '../lib/task.mjs';

function task() {
  return validateLocalDebugTask({
    schema: 'ikimon.local-debug-task/v1',
    task_id: 'output-hygiene-test',
    repository_path: path.join(os.tmpdir(), 'output-hygiene-test'),
    base_sha: '0123456789abcdef0123456789abcdef01234567',
    branch_name: 'debug/output-hygiene-test',
    scope: 'fix_loop',
    risk: 'p1',
    repository_count: 1,
    objective: 'Make one bounded source change.',
    acceptance_criteria: ['The deterministic check passes.'],
    checks: [{ id: 'check', argv: ['node', 'test.mjs'], cwd: '.', timeout_seconds: 30, max_output_bytes: 65536 }],
    max_luna_passes: 3,
    max_terra_passes: 1,
    allow_terra: true,
    max_changed_files: 5,
    allowed_path_prefixes: ['src'],
    allow_no_changes: false,
    commit_message: 'fix: output hygiene',
  });
}

test('Luna prompt keeps child work internal and forbids raw diff flooding', () => {
  const prompt = buildCodexPrompt(task(), { lane: 'local_codex_luna', previousFailure: null });
  assert.match(prompt, /do not create child Codex tasks or patch-only subagents/u);
  assert.match(prompt, /Do not request or return raw git diff/u);
  assert.match(prompt, /single consolidated report/u);
  assert.match(prompt, /normally no more than 20 lines/u);
  assert.match(prompt, /CHANGES: <compact changed-file names and summary; never paste diff bodies>/u);
  assert.doesNotMatch(prompt, /Response must contain ONLY one fenced diff block/u);
});
