import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  browserRunStagingUserIdForEmail,
  isBrowserRunStagingUserId,
} from "./browserRunStagingAccount.js";

function withEnvironment(value: string | undefined, run: () => void): void {
  const previous = process.env.ENVIRONMENT;
  try {
    if (value === undefined) delete process.env.ENVIRONMENT;
    else process.env.ENVIRONMENT = value;
    run();
  } finally {
    if (previous === undefined) delete process.env.ENVIRONMENT;
    else process.env.ENVIRONMENT = previous;
  }
}

test("Browser Run staging identity is accepted only for the isolated fixture prefix", () => {
  withEnvironment("staging", () => {
    const userId = "staging-session-smoke-browser-run-mk19abc-1a2b3c4d";
    assert.equal(
      browserRunStagingUserIdForEmail(userId + "@example.invalid"),
      userId,
    );
    assert.equal(isBrowserRunStagingUserId(userId), true);
    assert.equal(browserRunStagingUserIdForEmail("normal-user@example.invalid"), null);
    assert.equal(isBrowserRunStagingUserId("user_real"), false);
  });
});

test("Browser Run staging identity fails closed outside staging", () => {
  for (const environment of ["production", "shadow", undefined]) {
    withEnvironment(environment, () => {
      const userId = "staging-session-smoke-browser-run-mk19abc-1a2b3c4d";
      assert.equal(browserRunStagingUserIdForEmail(userId + "@example.invalid"), null);
      assert.equal(isBrowserRunStagingUserId(userId), false);
    });
  }
});

test("auth registration and cleanup routes stay bound to the isolated Browser Run identity", () => {
  const authUsers = readFileSync(path.join(process.cwd(), "src/services/authUsers.ts"), "utf8");
  const authRoutes = readFileSync(path.join(process.cwd(), "src/routes/auth.ts"), "utf8");

  assert.match(authUsers, /browserRunStagingUserIdForEmail\(email\) \?\?/);
  assert.match(authRoutes, /"\/api\/v1\/ops\/staging\/browser-run\/cleanup-self"/);
  assert.match(authRoutes, /isBrowserRunStagingUserId\(session\.userId\)/);
  assert.match(authRoutes, /cleanupStagingFixtures\([\s\S]*fixturePrefix: session\.userId[\s\S]*dryRun: false/);
  assert.doesNotMatch(authRoutes, /browser-run\/cleanup-self[\s\S]{0,600}assertPrivilegedWriteAccess/);
});
