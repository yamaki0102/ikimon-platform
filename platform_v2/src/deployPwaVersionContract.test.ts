import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("production deploy verification follows the current app service worker version", () => {
  const appInstall = readFileSync(path.join(process.cwd(), "src", "appInstall.ts"), "utf8");
  const deployWorkflow = readFileSync(path.join(process.cwd(), "..", ".github", "workflows", "deploy.yml"), "utf8");
  const verificationScript = readFileSync(path.join(process.cwd(), "..", "scripts", "verify_cloudflare_production_release.sh"), "utf8");
  const releaseContract = `${deployWorkflow}\n${verificationScript}`;
  const version = appInstall.match(/const VERSION = '([^']+)'/)?.[1];

  assert.equal(version, "ikimon-app-v7");
  assert.match(deployWorkflow, /verify_cloudflare_production_release\.sh/);
  assert.match(releaseContract, new RegExp(version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(releaseContract, /ikimon-app-v6/);
});
