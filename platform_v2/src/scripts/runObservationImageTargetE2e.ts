import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolveObservationImageTargets, targetPathsJson } from "./resolveObservationImageTargets.js";

const require = createRequire(import.meta.url);

async function main(): Promise<void> {
  const env = { ...process.env };
  if (!env.OBSERVATION_DETAIL_IMAGE_TARGETS?.trim()) {
    const result = await resolveObservationImageTargets();
    env.OBSERVATION_DETAIL_IMAGE_TARGETS = targetPathsJson(result.targets);
    console.error(`Resolved ${result.targets.length} dynamic observation image targets from ${result.photoCandidates}/${result.totalMapItems} public map records.`);
    for (const target of result.targets) {
      console.error(`- ${target.visitId} ${target.source} ${target.path}`);
    }
  }

  const child = spawn(
    process.execPath,
    [require.resolve("@playwright/test/cli"), "test", "-c", "playwright.observation-image-target.config.ts", ...process.argv.slice(2)],
    {
      stdio: "inherit",
      env,
      cwd: fileURLToPath(new URL("../../", import.meta.url)),
    },
  );
  child.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      console.error(`playwright exited by signal ${signal}`);
      process.exitCode = 1;
      return;
    }
    process.exitCode = code ?? 1;
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
