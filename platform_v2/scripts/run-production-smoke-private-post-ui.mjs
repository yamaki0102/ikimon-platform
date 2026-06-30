import { spawnSync } from "node:child_process";

const command = process.platform === "win32" ? "playwright.cmd" : "playwright";
const result = spawnSync(
  command,
  [
    "test",
    "-c",
    "playwright.production-smoke.config.ts",
    "--grep",
    "\\[private-post-ui\\]",
    ...process.argv.slice(2),
  ],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      PRODUCTION_SMOKE_WRITE_SCOPE: "private-post-ui",
    },
  },
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
