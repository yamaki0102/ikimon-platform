import { getPool } from "../db.js";
import { refreshPublicMapSnapshot } from "../services/mapSnapshot.js";

function parseLimit(argv: string[]): number | undefined {
  const arg = argv.find((item) => item.startsWith("--limit="));
  if (!arg) return undefined;
  const value = Number(arg.slice("--limit=".length));
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : undefined;
}

async function main(): Promise<void> {
  const result = await refreshPublicMapSnapshot({
    limit: parseLimit(process.argv.slice(2)),
    refreshedBy: "script:refreshPublicMapSnapshot",
  });
  console.log(JSON.stringify(result, null, 2));
  await getPool().end();
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
