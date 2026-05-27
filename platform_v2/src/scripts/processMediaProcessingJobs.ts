import { processMediaProcessingJobs } from "../services/mediaProcessingQueue.js";

function readNumberArg(name: string, fallback: number, envName?: string): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
    ?? (name === "limit" ? process.argv[2] : undefined)
    ?? (envName ? process.env[envName] : undefined);
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : fallback;
}

const result = await processMediaProcessingJobs(
  readNumberArg("limit", 10),
  readNumberArg("stale-seconds", 15 * 60),
  readNumberArg("photo-debounce-seconds", 45, "AI_PHOTO_REASSESS_DEBOUNCE_SECONDS"),
);
console.log(JSON.stringify(result));
if (result.stalePending > 0) {
  console.warn(`media_processing_jobs has ${result.stalePending} stale pending job(s)`);
}
