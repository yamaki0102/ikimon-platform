import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workerSource = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

test("observation-first cutover fails closed for policy-forbidden and unavailable records", () => {
  assert.match(workerSource, /observationFirst\.state === "forbidden"/);
  assert.match(workerSource, /renderObservationNotFoundHtml\(\), 404/);
  assert.match(workerSource, /observationFirst\.state === "unavailable"/);
  assert.match(workerSource, /renderObservationUnavailableHtml\(\), 503/);
  assert.match(workerSource, /一時的に取得できません/);
  assert.match(workerSource, /retry-after": "30"/);
});

test("legacy detail fallback remains available only when the observation-first record is missing", () => {
  assert.match(workerSource, /if \(observationFirst\.state === "ready"\)/);
  assert.match(workerSource, /if \(!container\) return \{ state: "missing" as const, detail: null \}/);
  assert.match(workerSource, /renderPublicObservationDetailHtml\(detail, ownerStatus, cspNonce\)/);
  assert.match(workerSource, /browserSecurityHeaders\(cspNonce, env\.ENVIRONMENT === "production"\)/);
});

test("accepted identification reader preserves the human decider and accepted value", () => {
  assert.match(workerSource, /SELECT observation_id, source_key, record_id/);
  assert.match(workerSource, /c\.accepted_name, c\.accepted_rank/);
  assert.match(workerSource, /c\.decided_by_actor_kind, c\.decided_by_actor_id, c\.decided_at/);
  assert.match(workerSource, /s\.rationale_json/);
});

test("an awaiting-identification AI candidate cannot become the unlabelled record title", () => {
  assert.match(workerSource, /titleIsFallback: detail\.isAwaitingId,/);
  assert.doesNotMatch(workerSource, /titleIsFallback: detail\.isAwaitingId && !detail\.aiCandidateLabel/);
});

test("record-detail media remains a verified EXIF-scrubbed public derivative", () => {
  assert.match(workerSource, /public_derivative_key IS NOT NULL/);
  assert.match(workerSource, /public_derivative_verified_at IS NOT NULL/);
  assert.match(workerSource, /exif_scrub_state = 'scrubbed'/);
  assert.match(workerSource, /public_ready_at IS NOT NULL/);
});

test("observation-first owner and community actions are wired without JavaScript", () => {
  for (const action of ["add", "split", "merge", "exclude", "restore", "media_reassign", "identify", "accept_identification", "set_proposal_policy", "set_visibility"]) {
    assert.ok(workerSource.includes(`"${action}"`), `missing action route: ${action}`);
  }
  assert.match(workerSource, /candidate\.proposed_name/);
  assert.match(workerSource, /viewerAuthenticated: Boolean\(session/);
  assert.match(workerSource, /return_lang/);
  assert.match(workerSource, /\/\$\{returnLang\}\/observations\//);
  assert.match(workerSource, /if \(refreshVisibility\) await refreshPublicReadmodel\(recordId, env\)/);
});
