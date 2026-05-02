import { getPool } from "../db.js";
import { diagnoseGuideEnvironmentMesh } from "../services/guideEnvironmentDiagnostics.js";
import { rebuildGuideEnvironmentMesh } from "../services/guideEnvironmentMesh.js";
import { recordGuideEnvironmentRefreshRun } from "../services/guideEnvironmentOps.js";
import { generateAndStoreGuideHypothesisPromptImprovements } from "../services/guideHypothesisPromptImprovements.js";
import { generateAndStoreRegionalHypotheses } from "../services/regionalHypotheses.js";

type Args = {
  date: string;
  dryRun: boolean;
  rebuildLimit?: number;
  hypothesisLimit: number;
  evalLimit: number;
  triggerSource: "postdeploy" | "timer" | "manual" | "staging";
};

function isoDateDaysAgo(days: number): string {
  const d = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
  return d.toISOString().slice(0, 10);
}

function normalizeDateArg(raw: string | undefined): string {
  if (!raw || raw === "today") return isoDateDaysAgo(0);
  if (raw === "yesterday") return isoDateDaysAgo(1);
  return raw;
}

function parseArgs(): Args {
  const raw = new Set(process.argv.slice(2));
  const dateArg = process.argv.find((arg) => arg.startsWith("--date="));
  const rebuildLimitArg = process.argv.find((arg) => arg.startsWith("--rebuild-limit="));
  const hypothesisLimitArg = process.argv.find((arg) => arg.startsWith("--hypothesis-limit="));
  const evalLimitArg = process.argv.find((arg) => arg.startsWith("--eval-limit="));
  const triggerArg = process.argv.find((arg) => arg.startsWith("--trigger="));
  const rebuildLimit = rebuildLimitArg ? Number.parseInt(rebuildLimitArg.slice("--rebuild-limit=".length), 10) : undefined;
  const hypothesisLimit = hypothesisLimitArg ? Number.parseInt(hypothesisLimitArg.slice("--hypothesis-limit=".length), 10) : 250;
  const evalLimit = evalLimitArg ? Number.parseInt(evalLimitArg.slice("--eval-limit=".length), 10) : 1000;
  const trigger = triggerArg?.slice("--trigger=".length) ?? "postdeploy";
  const triggerSource = ["postdeploy", "timer", "manual", "staging"].includes(trigger)
    ? trigger as Args["triggerSource"]
    : "manual";
  return {
    date: normalizeDateArg(dateArg?.slice("--date=".length)),
    dryRun: raw.has("--dry-run"),
    rebuildLimit: Number.isFinite(rebuildLimit) && rebuildLimit && rebuildLimit > 0 ? Math.round(rebuildLimit) : undefined,
    hypothesisLimit: Number.isFinite(hypothesisLimit) && hypothesisLimit > 0 ? Math.min(1000, Math.round(hypothesisLimit)) : 250,
    evalLimit: Number.isFinite(evalLimit) && evalLimit > 0 ? Math.min(5000, Math.round(evalLimit)) : 1000,
    triggerSource,
  };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const startedAt = new Date();
  try {
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
    const promptImprovements = args.dryRun
      ? { evalItems: 0, generated: 0, written: 0 }
      : await generateAndStoreGuideHypothesisPromptImprovements(args.evalLimit);

    const payload = {
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
      promptImprovements,
    };
    if (!args.dryRun) {
      await recordGuideEnvironmentRefreshRun({
        triggerSource: args.triggerSource,
        status: "success",
        diagnosisDate: args.date,
        startedAt,
        finishedAt: new Date(),
        meshRebuildNeeded: shouldRebuild,
        rebuildAction: shouldRebuild ? "executed" : "skipped",
        guideRecordCount: Number(after.guideRecordCount ?? 0),
        aggregatableGuideRecords: Number(after.aggregatableCount ?? 0),
        publicMeshCellCount: Number(after.publicMeshCellCount ?? 0),
        suppressedMeshCellCount: Number(after.suppressedByPublicThresholdCount ?? 0),
        hypothesesGenerated: hypotheses.generated,
        hypothesesWritten: hypotheses.written,
        evalItemsCount: promptImprovements.evalItems,
        promptImprovementsWritten: promptImprovements.written,
        runPayload: payload,
      });
    }
    console.log(JSON.stringify(payload, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!args.dryRun) {
      await recordGuideEnvironmentRefreshRun({
        triggerSource: args.triggerSource,
        status: "failure",
        diagnosisDate: args.date,
        startedAt,
        finishedAt: new Date(),
        meshRebuildNeeded: false,
        rebuildAction: "failed",
        guideRecordCount: 0,
        aggregatableGuideRecords: 0,
        publicMeshCellCount: 0,
        suppressedMeshCellCount: 0,
        hypothesesGenerated: 0,
        hypothesesWritten: 0,
        evalItemsCount: 0,
        promptImprovementsWritten: 0,
        runPayload: { ok: false, date: args.date, dryRun: args.dryRun, error: message },
        errorMessage: message,
      }).catch(() => null);
    }
    throw error;
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => undefined);
  });
