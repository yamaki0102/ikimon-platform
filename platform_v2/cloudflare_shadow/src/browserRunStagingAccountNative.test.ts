import assert from "node:assert/strict";
import test from "node:test";
import {
  BROWSER_RUN_STAGING_DISPLAY_NAME,
  isBrowserRunEphemeralStagingAccount,
} from "./browserRunStagingAccountNative";

test("Browser Run ephemeral account is accepted only in staging", () => {
  const email = "staging-session-smoke-browser-run-mabc123-1a2b3c4d@example.invalid";
  assert.equal(isBrowserRunEphemeralStagingAccount({
    environment: "staging",
    email,
    displayName: BROWSER_RUN_STAGING_DISPLAY_NAME,
  }), true);
  for (const environment of ["production", "shadow", "development", undefined]) {
    assert.equal(isBrowserRunEphemeralStagingAccount({
      environment,
      email,
      displayName: BROWSER_RUN_STAGING_DISPLAY_NAME,
    }), false);
  }
});

test("Browser Run cleanup identity rejects ordinary or lookalike accounts", () => {
  assert.equal(isBrowserRunEphemeralStagingAccount({
    environment: "staging",
    email: "normal-user@example.invalid",
    displayName: BROWSER_RUN_STAGING_DISPLAY_NAME,
  }), false);
  assert.equal(isBrowserRunEphemeralStagingAccount({
    environment: "staging",
    email: "staging-session-smoke-browser-run-mabc123-1a2b3c4d@example.invalid",
    displayName: "Someone else",
  }), false);
  assert.equal(isBrowserRunEphemeralStagingAccount({
    environment: "staging",
    email: "staging-session-smoke-browser-run-x@example.invalid",
    displayName: BROWSER_RUN_STAGING_DISPLAY_NAME,
  }), false);
});
