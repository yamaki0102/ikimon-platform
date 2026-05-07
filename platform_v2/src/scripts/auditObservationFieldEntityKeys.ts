import { getPool } from "../db.js";
import {
  classifyEntityKeyIssues,
  type EntityKeyAuditRow,
  type EntityKeyIssue,
} from "../services/observationFieldIdentity.js";

type DuplicateEntityKeyRow = {
  entity_key: string;
  count: string | number;
  field_ids: string[];
  names: string[];
};

type AuditFinding = EntityKeyAuditRow & {
  issues: EntityKeyIssue[];
};

function parseArgs(): { json: boolean; failOnError: boolean; limit: number } {
  const args = process.argv.slice(2);
  const limitArg = args.find((arg) => arg.startsWith("--limit="))?.split("=")[1];
  const parsedLimit = limitArg ? Number(limitArg) : 2000;
  return {
    json: args.includes("--json"),
    failOnError: args.includes("--fail-on-error"),
    limit: Number.isFinite(parsedLimit) ? Math.max(1, Math.min(10000, Math.floor(parsedLimit))) : 2000,
  };
}

function issueCounts(findings: AuditFinding[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const finding of findings) {
    for (const issue of finding.issues) {
      counts[issue.kind] = (counts[issue.kind] ?? 0) + 1;
    }
  }
  return counts;
}

async function loadAuditRows(limit: number): Promise<EntityKeyAuditRow[]> {
  const result = await getPool().query<EntityKeyAuditRow>(
    `select field_id::text, source, admin_level, name, certification_id,
            entity_key, owner_user_id::text, valid_to::text, payload
       from observation_fields
      where valid_to is null
         or coalesce(entity_key, '') = ''
         or entity_key not like '%:%'
      order by updated_at desc nulls last, field_id
      limit $1`,
    [limit],
  );
  return result.rows;
}

async function loadDuplicateEntityKeys(): Promise<DuplicateEntityKeyRow[]> {
  const result = await getPool().query<DuplicateEntityKeyRow>(
    `select entity_key,
            count(*)::int as count,
            array_agg(field_id::text order by field_id::text) as field_ids,
            array_agg(name order by field_id::text) as names
       from observation_fields
      where valid_to is null
        and coalesce(entity_key, '') <> ''
      group by entity_key
     having count(*) > 1
      order by count(*) desc, entity_key
      limit 100`,
  );
  return result.rows;
}

function printText(findings: AuditFinding[], duplicates: DuplicateEntityKeyRow[], limit: number): void {
  const counts = issueCounts(findings);
  const errors = findings.reduce((sum, finding) => sum + finding.issues.filter((issue) => issue.severity === "error").length, 0) + duplicates.length;
  const warnings = findings.reduce((sum, finding) => sum + finding.issues.filter((issue) => issue.severity === "warning").length, 0);

  console.log(`[field-entity-key-audit] scanned<=${limit} findings=${findings.length} duplicate_current_keys=${duplicates.length} errors=${errors} warnings=${warnings}`);
  for (const [kind, count] of Object.entries(counts).sort()) {
    console.log(`  ${kind}: ${count}`);
  }

  for (const finding of findings.slice(0, 50)) {
    const id = finding.field_id ?? "(no field_id)";
    const label = [finding.source, finding.admin_level].filter(Boolean).join("/") || "(unknown source)";
    const issueList = finding.issues.map((issue) => `${issue.severity}:${issue.kind}`).join(", ");
    console.log(`  - ${id} ${label} "${finding.name ?? ""}" entity_key="${finding.entity_key ?? ""}" certification_id="${finding.certification_id ?? ""}" issues=${issueList}`);
  }

  for (const duplicate of duplicates.slice(0, 20)) {
    console.log(`  - duplicate entity_key="${duplicate.entity_key}" count=${duplicate.count} fields=${duplicate.field_ids.join(", ")}`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs();
  const rows = await loadAuditRows(options.limit);
  const findings = rows
    .map((row) => ({ ...row, issues: classifyEntityKeyIssues(row) }))
    .filter((row) => row.issues.length > 0);
  const duplicates = await loadDuplicateEntityKeys();

  if (options.json) {
    console.log(JSON.stringify({
      scannedLimit: options.limit,
      issueCounts: issueCounts(findings),
      findings,
      duplicateCurrentEntityKeys: duplicates,
    }, null, 2));
  } else {
    printText(findings, duplicates, options.limit);
  }

  const hasError = findings.some((finding) => finding.issues.some((issue) => issue.severity === "error")) || duplicates.length > 0;
  if (options.failOnError && hasError) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error("[field-entity-key-audit] failed", error);
  process.exitCode = 1;
});
