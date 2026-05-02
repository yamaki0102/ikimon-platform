import { processMediaProcessingJobs } from "../services/mediaProcessingQueue.js";

function readNumberArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
    ?? (name === "limit" ? process.argv[2] : undefined);
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}

const result = await processMediaProcessingJobs(readNumberArg("limit", 10), readNumberArg("stale-seconds", 15 * 60));
console.log(JSON.stringify(result));
if (result.stalePending > 0) {
  console.warn(`media_processing_jobs has ${result.stalePending} stale pending job(s)`);
}
