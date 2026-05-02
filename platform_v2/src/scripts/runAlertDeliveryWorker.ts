/**
 * runAlertDeliveryWorker.ts
 *
 * cron / systemd timer から起動する pending 配信処理。
 *
 * Usage:
 *   npx tsx src/scripts/runAlertDeliveryWorker.ts --once
 *
 *   --once     一回だけ走らせて終了 (cron / systemd 用)
 *   --batch=N  1 ループあたりの最大件数 (default 25)
 */

import { runAlertDeliveryWorker } from "../services/alertDeliveryWorker.js";
import { getPool } from "../db.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const once = args.includes("--once");
  const batchArg = args.find((a) => a.startsWith("--batch="));
  const batchSize = batchArg ? Number(batchArg.slice("--batch=".length)) : 25;

  if (!once) {
    console.error("Currently --once is required. Continuous mode is not implemented yet.");
    process.exitCode = 1;
    return;
  }
  const summary = await runAlertDeliveryWorker({ batchSize });
  console.log(JSON.stringify(summary, null, 2));
  await getPool().end();
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
