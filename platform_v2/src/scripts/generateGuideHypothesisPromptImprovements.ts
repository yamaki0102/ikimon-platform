import { getPool } from "../db.js";
import {
  generateAndStoreGuideHypothesisPromptImprovements,
  listGuideHypothesisPromptImprovements,
} from "../services/guideHypothesisPromptImprovements.js";

function parseArgs(): { limit: number; pretty: boolean; dryRun: boolean } {
  const args = new Set(process.argv.slice(2));
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number.parseInt(limitArg.slice("--limit=".length), 10) : 1000;
  return {
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(5000, Math.round(limit)) : 1000,
    pretty: args.has("--pretty"),
    dryRun: args.has("--dry-run"),
  };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const result = args.dryRun
    ? { evalItems: 0, generated: 0, written: 0 }
    : await generateAndStoreGuideHypothesisPromptImprovements(args.limit);
  const improvements = args.dryRun ? [] : await listGuideHypothesisPromptImprovements(20);
  console.log(JSON.stringify({ ok: true, dryRun: args.dryRun, ...result, improvements }, null, args.pretty ? 2 : 0));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => undefined);
  });
