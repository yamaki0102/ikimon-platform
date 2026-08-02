import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const debugPolicy = JSON.parse(readFileSync(
  new URL('../policy/execution-policy.v1.json', import.meta.url),
  'utf8',
));
const developmentContract = JSON.parse(readFileSync(
  new URL('../../../../.ikimon/development-contract.json', import.meta.url),
  'utf8',
));

test('ChatGPT self-review is the default review provider', () => {
  assert.equal(debugPolicy.review.default_provider, 'chatgpt_self_review');
  assert.equal(debugPolicy.review.exact_sha_required, true);
  assert.equal(debugPolicy.review.full_diff_required, true);
  assert.equal(developmentContract.review.provider, 'chatgpt_self_review');
  assert.equal(developmentContract.review.exact_sha_required, true);
  assert.equal(developmentContract.review.full_diff_required, true);
  assert.equal(developmentContract.review.record_surface, 'pull_request_comment');
});

test('Pixel Review requires an explicit owner instruction and is not a default release gate', () => {
  for (const policy of [
    debugPolicy.review.pixel_review,
    developmentContract.review.pixel_review,
  ]) {
    assert.equal(policy.mode, 'owner_explicit_only');
    assert.equal(policy.enabled_by_default, false);
    assert.equal(policy.release_gate_by_default, false);
  }

  assert.equal(debugPolicy.lanes.pixel_review_opt_in.owner_explicit_instruction_required, true);
  assert.equal(debugPolicy.lanes.pixel_review_opt_in.enabled_by_default, false);
  assert.equal(debugPolicy.lanes.pixel_review_opt_in.release_gate_by_default, false);
  assert.ok(!debugPolicy.decision_order.includes('pixel_review_opt_in'));
  assert.ok(debugPolicy.forbidden_defaults.includes('pixel_review_without_owner_instruction'));
});
