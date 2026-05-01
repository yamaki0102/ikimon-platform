import { getPool } from "../db.js";
import { diagnoseGuideEnvironmentMesh } from "../services/guideEnvironmentDiagnostics.js";
import { rebuildGuideEnvironmentMesh } from "../services/guideEnvironmentMesh.js";
import { generateAndStoreRegionalHypotheses } from "../services/regionalHypotheses.js";

type Args = {
  date: string;
  dryRun: boolean;
  rebuildLimit?: number;
  hypothesisLimit: number;
};

function isoDateDaysAgo(days: number): string {
  const d = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
  return d.toISOString().slice(0, 10);
}

function parseArgs(): Args {
  const raw = new Set(process.argv.slice(2));
  const dateArg = process.argv.find((arg) => arg.startsWith("--date="));
  const rebuildLimitArg = process.argv.find((arg) => arg.startsWith("--rebuild-limit="));
  const hypothesisLimitArg = process.argv.find((arg) => arg.startsWith("--hypothesis-limit="));
  const rebuildLimit = rebuildLimitArg ? Number.parseInt(rebuildLimitArg.slice("--rebuild-limit=".length), 10) : undefined;
  const hypothesisLimit = hypothesisLimitArg ? Number.parseInt(hypothesisLimitArg.slice("--hypothesis-limit=".length), 10) : 250;
  return {
    date: dateArg?.slice("--date=".length) || isoDateDaysAgo(1),
    dryRun: raw.has("--dry-run"),
    rebuildLimit: Number.isFinite(rebuildLimit) && rebuildLimit && rebuildLimit > 0 ? Math.round(rebuildLimit) : undefined,
    hypothesisLimit: Number.isFinite(hypothesisLimit) && hypothesisLimit > 0 ? Math.min(1000, Math.round(hypothesisLimit)) : 250,
  };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const before = await diagnoseGuideEnvironmentMesh(args.date);
  const shouldRebuild = before.likelyBlocker === "mesh_rebuild_needed";
  const rebuild = shouldRebuild
    ? await rebuildGuideEnvironmentMesh({ dryRun: args.dryRun, limit: args.rebuildLimit })
    : { scanned: 0, aggregatable: 0, written: 0 };
  const after = shouldRebuild && !args.dryRun
    ? await diagnoseGuideEnvironmentMesh(args.date)
    : before;
  const hypotheses = args.dryRun
    ? { scannedMeshes: 0, generated: 0, written: 0 }
    : await generateAndStoreRegionalHypotheses(args.hypothesisLimit);

  console.log(JSON.stringify({
    ok: true,
    date: args.date,
    dryRun: args.dryRun,
    before,
    action: {
      rebuildGuideEnvironmentMesh: shouldRebuild ? (args.dryRun ? "dry_run" : "executed") : "skipped",
      reason: shouldRebuild ? "mesh_rebuild_needed" : before.likelyBlocker,
    },
    rebuild,
    after,
    hypotheses,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => undefined);
  });
