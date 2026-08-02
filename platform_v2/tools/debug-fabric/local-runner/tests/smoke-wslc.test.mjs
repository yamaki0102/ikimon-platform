import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runWslcSmoke } from '../smoke-wslc.mjs';

test('WSLC smoke creates a candidate and reads back immutable evidence', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'wslc-smoke-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await runWslcSmoke({
    root,
    id: '20260802test',
    invokeCodex: async ({ lane, worktree }) => {
      await writeFile(path.join(worktree, 'src', 'result.txt'), 'fixed\n');
      return {
        lane,
        model: 'luna-test',
        exit_code: 0,
        timed_out: false,
        output_truncated: false,
        duration_ms: 1,
        stdout_tail: '',
        stderr_tail: '',
      };
    },
  });
  assert.equal(result.status, 'pass');
  assert.match(result.candidate_sha, /^[0-9a-f]{40}$/u);
  assert.ok(result.evidence_path);
  const evidence = JSON.parse(await readFile(result.evidence_path, 'utf8'));
  assert.equal(evidence.candidate_sha, result.candidate_sha);
  assert.deepEqual(evidence.changed_files.map((entry) => entry.path), ['src/result.txt']);
  assert.equal(evidence.luna_passes, 1);
  assert.equal(evidence.terra_passes, 0);
  assert.equal(evidence.protected_mutations, 0);
});
