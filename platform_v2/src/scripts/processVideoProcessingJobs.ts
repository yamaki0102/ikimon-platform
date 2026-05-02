import { processVideoProcessingJobs } from "../services/videoProcessingQueue.js";

function parseLimit(): number {
  const raw = process.argv.find((arg) => arg.startsWith("--limit="))?.slice("--limit=".length);
  const limit = Number(raw ?? "5");
  return Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : 5;
}

const result = await processVideoProcessingJobs(parseLimit());
console.log(JSON.stringify({ ok: true, ...result }));
