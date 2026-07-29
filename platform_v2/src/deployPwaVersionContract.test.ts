import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("production command-bus verification follows the current app service worker version", () => {
  const repoRoot = path.join(process.cwd(), "..");
  const appInstall = readFileSync(path.join(process.cwd(), "src", "appInstall.ts"), "utf8");
  const deployManifest = JSON.parse(
    readFileSync(path.join(repoRoot, "ops", "deploy", "deploy_manifest.json"), "utf8"),
  ) as {
    strategy?: string;
    portableVerifyScript?: string;
    githubActionsDependency?: { required?: boolean; executionBackend?: boolean };
    executionLanes?: {
      primary?: { id?: string; actions?: string[]; immutableShaRequired?: boolean };
    };
  };
  const verificationScript = readFileSync(
    path.join(repoRoot, deployManifest.portableVerifyScript ?? ""),
    "utf8",
  );
  const version = appInstall.match(/const VERSION = '([^']+)'/)?.[1];

  assert.equal(version, "ikimon-app-v9");
  assert.equal(deployManifest.strategy, "cloudflare_executor_primary");
  assert.equal(deployManifest.portableVerifyScript, "scripts/verify_cloudflare_production_release.sh");
  assert.equal(deployManifest.githubActionsDependency?.required, false);
  assert.equal(deployManifest.githubActionsDependency?.executionBackend, false);
  assert.equal(deployManifest.executionLanes?.primary?.id, "cloudflare_executor");
  assert.equal(deployManifest.executionLanes?.primary?.immutableShaRequired, true);
  assert.ok(deployManifest.executionLanes?.primary?.actions?.includes("verify"));
  assert.match(verificationScript, new RegExp(version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(verificationScript, /ikimon-app-v8/);
  for (const retiredWorkflow of ["deploy.yml", "deploy-staging.yml"]) {
    assert.equal(
      existsSync(path.join(repoRoot, ".github", "workflows", retiredWorkflow)),
      false,
      `${retiredWorkflow} must not return as an execution backend`,
    );
  }
});
