import { getPool } from "../db.js";
import { rebuildGuideEnvironmentMesh } from "../services/guideEnvironmentMesh.js";

function parseArgs(): { dryRun: boolean; limit?: number } {
  const args = new Set(process.argv.slice(2));
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const parsedLimit = limitArg ? Number(limitArg.slice("--limit=".length)) : undefined;
  return {
    dryRun: args.has("--dry-run"),
    limit: Number.isFinite(parsedLimit) && parsedLimit && parsedLimit > 0 ? Math.round(parsedLimit) : undefined,
  };
}

async function main(): Promise<void> {
  const opts = parseArgs();
  const result = await rebuildGuideEnvironmentMesh(opts);
  console.log(JSON.stringify({ ok: true, ...opts, ...result }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => undefined);
  });
