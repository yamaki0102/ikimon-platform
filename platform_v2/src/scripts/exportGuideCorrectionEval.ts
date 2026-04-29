import { loadGuideCorrectionEvalItems, summarizeGuideCorrectionEval } from "../services/guideCorrectionEval.js";

function parseArgs(): { limit: number; summary: boolean } {
  const args = new Set(process.argv.slice(2));
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 500;
  return {
    limit: Number.isFinite(limit) ? Math.max(1, Math.min(5000, Math.round(limit))) : 500,
    summary: args.has("--summary"),
  };
}

async function main(): Promise<void> {
  const opts = parseArgs();
  const items = await loadGuideCorrectionEvalItems(opts.limit);
  if (opts.summary) {
    console.log(JSON.stringify({ ok: true, ...summarizeGuideCorrectionEval(items) }, null, 2));
    return;
  }
  for (const item of items) {
    console.log(JSON.stringify(item));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
