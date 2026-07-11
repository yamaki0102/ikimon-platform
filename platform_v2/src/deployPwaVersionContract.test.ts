import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("production deploy verification follows the current app service worker version", () => {
  const appInstall = readFileSync(path.join(process.cwd(), "src", "appInstall.ts"), "utf8");
  const deployWorkflow = readFileSync(path.join(process.cwd(), "..", ".github", "workflows", "deploy.yml"), "utf8");
  const version = appInstall.match(/const VERSION = '([^']+)'/)?.[1];

  assert.equal(version, "ikimon-app-v7");
  assert.match(deployWorkflow, new RegExp(version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(deployWorkflow, /ikimon-app-v6/);
});
