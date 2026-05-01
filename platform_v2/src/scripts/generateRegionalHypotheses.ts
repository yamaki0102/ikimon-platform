import { getPool } from "../db.js";
import { generateAndStoreRegionalHypotheses, loadRegionalHypothesisSources, buildRegionalHypothesesForMesh } from "../services/regionalHypotheses.js";

function parseArgs(): { dryRun: boolean; limit: number } {
  const args = new Set(process.argv.slice(2));
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const parsedLimit = limitArg ? Number.parseInt(limitArg.slice("--limit=".length), 10) : 100;
  return {
    dryRun: args.has("--dry-run"),
    limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(500, parsedLimit) : 100,
  };
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (args.dryRun) {
    const sources = await loadRegionalHypothesisSources(args.limit);
    const drafts = sources.flatMap(buildRegionalHypothesesForMesh);
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      scannedMeshes: sources.length,
      generated: drafts.length,
      firstHypothesis: drafts[0] ?? null,
    }, null, 2));
    return;
  }
  const result = await generateAndStoreRegionalHypotheses(args.limit);
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => undefined);
  });
