import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGitHubGitArgs,
  buildGitHubGitEnv,
} from "./curatorProposalReceiver.js";

test("curator git auth keeps GitHub PAT out of process arguments", () => {
  const token = "ghp_fixture_token_never_use_12345678901234567890";
  const args = buildGitHubGitArgs([
    "fetch",
    "--no-tags",
    "https://github.com/yamaki0102/ikimon-platform.git",
    "main:refs/remotes/origin/main",
  ]);

  assert.equal(args.join(" ").includes(token), false);
  assert.equal(args.some((arg) => arg.includes("x-access-token:")), false);
  assert.ok(args.includes("credential.https://github.com.helper="));
  assert.ok(args.includes("credential.https://github.com.helper=!gh auth git-credential"));

  const env = buildGitHubGitEnv(token);
  assert.equal(env.GH_TOKEN, token);
  assert.equal(env.GITHUB_TOKEN, token);
  assert.equal(env.GIT_TERMINAL_PROMPT, "0");
});