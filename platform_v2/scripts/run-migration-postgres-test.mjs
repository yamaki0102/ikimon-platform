import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", "src/scripts/applyMigration.postgres.test.ts"],
  {
    cwd: process.cwd(),
    env: { ...process.env, IKIMON_RUN_POSTGRES_MIGRATION_TEST: "1" },
    stdio: "inherit",
    windowsHide: true,
  },
);

process.exitCode = result.status ?? 1;
