import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("production deploy verification follows the current app service worker version", () => {
  const appInstall = readFileSync(path.join(process.cwd(), "src", "appInstall.ts"), "utf8");
  const releaseScript = readFileSync(path.join(process.cwd(), "..", "scripts", "run_cloudflare_production_release.sh"), "utf8");
  const watchScript = readFileSync(path.join(process.cwd(), "..", "scripts", "run_production_verification_watch.sh"), "utf8");
  const verificationScript = readFileSync(path.join(process.cwd(), "..", "scripts", "verify_cloudflare_production_release.sh"), "utf8");
  const releaseContract = `${releaseScript}\n${watchScript}\n${verificationScript}`;
  const version = appInstall.match(/const VERSION = '([^']+)'/)?.[1];

  assert.equal(version, "ikimon-app-v8");
  assert.match(releaseScript, /run_production_verification_watch\.sh/);
  assert.match(watchScript, /verify_cloudflare_production_release\.sh/);
  assert.match(releaseContract, new RegExp(version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(releaseContract, /ikimon-app-v6/);
});
