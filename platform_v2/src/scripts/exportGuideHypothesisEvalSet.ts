import { getPool } from "../db.js";
import { loadGuideHypothesisEvalItems, toJsonl } from "../services/guideHypothesisEvalSet.js";

function parseArgs(): { limit: number; pretty: boolean } {
  const args = new Set(process.argv.slice(2));
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number.parseInt(limitArg.slice("--limit=".length), 10) : 500;
  return {
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(5000, Math.round(limit)) : 500,
    pretty: args.has("--pretty"),
  };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const items = await loadGuideHypothesisEvalItems(args.limit);
  if (args.pretty) {
    console.log(JSON.stringify({ ok: true, count: items.length, items }, null, 2));
    return;
  }
  console.log(toJsonl(items));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => undefined);
  });
