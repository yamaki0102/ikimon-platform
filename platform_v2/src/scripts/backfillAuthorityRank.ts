import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "../db.js";
import { matchTaxon } from "../services/gbifBackboneMatch.js";
import { normalizeRank } from "../services/taxonRank.js";

type Options = {
  dryRun: boolean;
  limit: number | null;
};

type PendingRow = {
  authority_id: string;
  scope_taxon_name: string;
  scope_taxon_key: string | null;
};

type BackfillResultEntry = {
  authorityId: string;
  scopeTaxonName: string;
  rank: string | null;
  action: "updated" | "skipped_unknown_rank" | "skipped_no_match" | "dry_run_would_update";
  note?: string;
};

function parseArgs(argv: string[]): Options {
  const options: Options = { dryRun: false, limit: null };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--limit" && argv[i + 1]) {
      const value = Number.parseInt(argv[i + 1] ?? "", 10);
      if (!Number.isNaN(value) && value > 0) options.limit = value;
      i += 1;
    }
  }
  return options;
}

async function writeReport(entries: BackfillResultEntry[], dryRun: boolean): Promise<string> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "..", "..", "..");
  const reportsDir = path.resolve(repoRoot, "platform_v2", "ops", "reports");
  await mkdir(reportsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  const suffix = dryRun ? "dry-run" : "applied";
  const filePath = path.join(reportsDir, `authority-rank-backfill-${stamp}-${suffix}.json`);
  const body = {
    generatedAt: new Date().toISOString(),
    dryRun,
    totalCandidates: entries.length,
    updated: entries.filter((e) => e.action === "updated" || e.action === "dry_run_would_update").length,
    skippedUnknownRank: entries.filter((e) => e.action === "skipped_unknown_rank").length,
    skippedNoMatch: entries.filter((e) => e.action === "skipped_no_match").length,
    entries,
  };
  await writeFile(filePath, JSON.stringify(body, null, 2), "utf8");
  return filePath;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  const pool = getPool();
  try {
    const { rows } = await pool.query<PendingRow>(
      `select authority_id, scope_taxon_name, scope_taxon_key
         from specialist_authorities
        where status = 'active'
          and scope_taxon_rank is null
        order by granted_at asc
        limit $1`,
      [options.limit ?? 10_000],
    );
    const entries: BackfillResultEntry[] = [];
    for (const row of rows) {
      if (!row.scope_taxon_name) {
        entries.push({
          authorityId: row.authority_id,
          scopeTaxonName: "",
          rank: null,
          action: "skipped_no_match",
          note: "empty scope_taxon_name",
        });
        continue;
      }
      let matched: Awaited<ReturnType<typeof matchTaxon>> | null = null;
      try {
        matched = await matchTaxon({ name: row.scope_taxon_name });
      } catch (err) {
        entries.push({
          authorityId: row.authority_id,
          scopeTaxonName: row.scope_taxon_name,
          rank: null,
          action: "skipped_no_match",
          note: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
      const canonicalRank = normalizeRank(matched?.rank ?? null);
      if (!canonicalRank) {
        entries.push({
          authorityId: row.authority_id,
          scopeTaxonName: row.scope_taxon_name,
          rank: matched?.rank ?? null,
          action: "skipped_unknown_rank",
          note: "GBIF returned a rank we do not recognise",
        });
        continue;
      }
      if (options.dryRun) {
        entries.push({
          authorityId: row.authority_id,
          scopeTaxonName: row.scope_taxon_name,
          rank: canonicalRank,
          action: "dry_run_would_update",
        });
      } else {
        await pool.query(
          `update specialist_authorities
              set scope_taxon_rank = $2,
                  updated_at = now()
            where authority_id = $1`,
          [row.authority_id, canonicalRank],
        );
        entries.push({
          authorityId: row.authority_id,
          scopeTaxonName: row.scope_taxon_name,
          rank: canonicalRank,
          action: "updated",
        });
      }
    }
    const reportPath = await writeReport(entries, options.dryRun);
    const summary = {
      totalCandidates: entries.length,
      updated: entries.filter((e) => e.action === "updated" || e.action === "dry_run_would_update").length,
      skippedUnknownRank: entries.filter((e) => e.action === "skipped_unknown_rank").length,
      skippedNoMatch: entries.filter((e) => e.action === "skipped_no_match").length,
      dryRun: options.dryRun,
      reportPath,
    };
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await pool.end();
  }
}

void main();
