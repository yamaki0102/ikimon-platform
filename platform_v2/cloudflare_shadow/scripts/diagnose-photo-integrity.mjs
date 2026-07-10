import { spawnSync } from "node:child_process";
import { devNull } from "node:os";

const args = process.argv.slice(2);
const valueFor = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? "" : "";
};
const visitId = valueFor("--visit-id");
const userId = valueFor("--user-id");
if (!visitId || args.includes("--execute")) {
  throw new Error("Dry-run only. Pass --visit-id <id>; this diagnostic never mutates D1 or R2.");
}

const escapedVisitId = visitId.replaceAll("'", "''");
const ownerClause = userId ? ` AND o.owner_user_id = '${userId.replaceAll("'", "''")}'` : "";
const sql = `SELECT a.object_key, a.public_derivative_key
  FROM asset_ledger a JOIN observations o ON o.observation_id = a.observation_id
 WHERE o.observation_id = '${escapedVisitId}'${ownerClause}`;
const query = spawnSync("npx", ["wrangler", "d1", "execute", "ikimon_prod_observations_2026_06", "--remote", "--json", "--command", sql], {
  cwd: process.cwd(), encoding: "utf8"
});
if (query.status !== 0) throw new Error("D1 diagnostic query failed");
const rows = JSON.parse(query.stdout)[0]?.results ?? [];
let checked = 0;
let missing = 0;
for (const row of rows) {
  for (const key of [row.object_key, row.public_derivative_key].filter(Boolean)) {
    checked += 1;
    const head = spawnSync("npx", ["wrangler", "r2", "object", "get", `ikimon-prod-media/${key}`, "--remote", "--file", devNull], {
      cwd: process.cwd(), encoding: "utf8"
    });
    if (head.status !== 0) missing += 1;
  }
}
console.log(JSON.stringify({ mode: "dry-run", visitScoped: true, userScoped: Boolean(userId), assetRows: rows.length, r2ObjectsChecked: checked, r2Missing: missing }));
