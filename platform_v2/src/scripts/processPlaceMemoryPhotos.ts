import { getPool } from "../db.js";
import { processPlaceMemoryPhoto } from "../services/placeMemory.js";

async function main(): Promise<void> {
  const limitArg = Number(process.argv.find((arg) => arg.startsWith("--limit="))?.split("=", 2)[1] ?? 20);
  const limit = Number.isFinite(limitArg) ? Math.max(1, Math.min(100, Math.floor(limitArg))) : 20;
  const pool = getPool();
  const result = await pool.query<{ entry_id: string }>(
    `select entry_id::text
       from place_memory_photo_derivatives
      where processing_status in ('pending','failed_retryable')
        and coalesce(next_retry_at, now()) <= now()
      order by coalesce(next_retry_at, created_at), created_at
      limit $1`,
    [limit],
  );
  let ready = 0;
  let blocked = 0;
  let retryable = 0;
  let failedFinal = 0;
  for (const row of result.rows) {
    const processed = await processPlaceMemoryPhoto(row.entry_id);
    if (processed.status === "ready") ready += 1;
    else if (processed.status === "sensitive_blocked") blocked += 1;
    else if (processed.status === "failed_retryable") retryable += 1;
    else if (processed.status === "failed_final") failedFinal += 1;
  }
  console.log(JSON.stringify({
    ok: true,
    checked: result.rows.length,
    ready,
    sensitiveBlocked: blocked,
    retryable,
    failedFinal,
  }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => undefined);
  });
