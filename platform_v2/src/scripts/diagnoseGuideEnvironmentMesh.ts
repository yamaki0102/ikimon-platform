import { getPool } from "../db.js";
import { diagnoseGuideEnvironmentMesh, guideEnvironmentDiagnosisSql } from "../services/guideEnvironmentDiagnostics.js";

function parseArgs(): { date: string; sql: boolean } {
  const args = new Set(process.argv.slice(2));
  const dateArg = process.argv.find((arg) => arg.startsWith("--date="));
  return {
    date: dateArg?.slice("--date=".length) || "2026-04-30",
    sql: args.has("--sql"),
  };
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (args.sql) {
    console.log(guideEnvironmentDiagnosisSql());
    return;
  }
  const diagnosis = await diagnoseGuideEnvironmentMesh(args.date);
  console.log(JSON.stringify({ ok: true, ...diagnosis }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPool().end().catch(() => undefined);
    } catch {
      // --sql mode does not require DATABASE_URL.
    }
  });
