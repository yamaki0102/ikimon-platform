import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA_VERSION = "platform_migration_baseline_rehearsal/v0" as const;

type MigrationRisk =
  | "destructive_approved"
  | "destructive_unapproved"
  | "owner_sensitive_approved"
  | "owner_sensitive_unapproved";

type MigrationApproval = "destructive-ok" | "owner-sensitive-ok";

export type MigrationBaselineEntry = {
  filename: string;
  sequence: string;
  checksum: string;
  byteLength: number;
  lineCount: number;
  risks: MigrationRisk[];
  approvals: MigrationApproval[];
  destructiveLabels: string[];
  ownerSensitiveTargets: string[];
  extensionRequirements: string[];
};

export type MigrationBaselineReport = {
  schemaVersion: typeof SCHEMA_VERSION;
  generatedAt: string;
  migrationDir: string;
  totalMigrations: number;
  firstMigration: string | null;
  headMigration: string | null;
  duplicateSequences: Array<{ sequence: string; filenames: string[] }>;
  missingSequences: string[];
  riskSummary: {
    destructiveApproved: number;
    destructiveUnapproved: number;
    ownerSensitiveApproved: number;
    ownerSensitiveUnapproved: number;
  };
  extensionRequirements: string[];
  stopConditions: string[];
  rehearsalCommands: string[];
  entries: MigrationBaselineEntry[];
};

const DESTRUCTIVE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bdrop\s+table\b/i, label: "DROP TABLE" },
  { pattern: /\bdrop\s+column\b/i, label: "DROP COLUMN" },
  { pattern: /\btruncate\b/i, label: "TRUNCATE" },
  { pattern: /\bdelete\s+from\b/i, label: "DELETE FROM" },
  { pattern: /^\s*update\b/im, label: "UPDATE" },
];

const EXPLICIT_DESTRUCTIVE_APPROVAL = /destructive-ok:\s*.{12,}/i;
const OWNER_SENSITIVE_APPROVAL = /owner-sensitive-ok:\s*.{12,}/i;

function checksumFor(content: string): string {
  let hash = 0;
  for (let index = 0; index < content.length; index += 1) {
    hash = (hash * 31 + content.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

function normalizeTableName(raw: string): string {
  const trimmed = raw.trim().replace(/^"+|"+$/g, "");
  const unqualified = trimmed.includes(".") ? trimmed.split(".").at(-1) ?? trimmed : trimmed;
  return unqualified.replace(/^"+|"+$/g, "").toLowerCase();
}

function regexMatches(text: string, pattern: RegExp): RegExpMatchArray[] {
  return Array.from(text.matchAll(pattern));
}

function capture(match: RegExpMatchArray, index: number): string | null {
  const value = match[index];
  return value && value.trim() ? value : null;
}

function sequenceFor(filename: string): string {
  return filename.match(/^(\d{4})_/)?.[1] ?? "none";
}

function extensionRequirementsFor(sql: string): string[] {
  const requirements = new Set<string>();
  for (const match of regexMatches(sql, /\bCREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+([A-Za-z0-9_."-]+)/gim)) {
    const extensionName = capture(match, 1);
    if (extensionName) {
      requirements.add(normalizeTableName(extensionName));
    }
  }
  if (/\bcreate_hypertable\s*\(/i.test(sql)) {
    requirements.add("timescaledb");
  }
  return Array.from(requirements).sort();
}

function ownerSensitiveTargetsFor(sql: string): string[] {
  const targets = new Set<string>();
  const createdTables = new Set(
    regexMatches(sql, /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?([A-Za-z0-9_."-]+)/gim)
      .map((match) => capture(match, 1))
      .filter((tableName): tableName is string => Boolean(tableName))
      .map((tableName) => normalizeTableName(tableName)),
  );

  for (const match of regexMatches(sql, /^\s*alter\s+table\s+(?:if\s+exists\s+)?([A-Za-z0-9_."-]+)/gim)) {
    const rawTableName = capture(match, 1);
    if (!rawTableName) {
      continue;
    }
    const tableName = normalizeTableName(rawTableName);
    if (!createdTables.has(tableName)) {
      targets.add(tableName);
    }
  }

  for (const match of regexMatches(
    sql,
    /^\s*(?:execute\s+['"])?create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?[A-Za-z0-9_."-]+\s+on\s+(?:only\s+)?([A-Za-z0-9_."-]+)/gim,
  )) {
    const rawTableName = capture(match, 1);
    if (!rawTableName) {
      continue;
    }
    const tableName = normalizeTableName(rawTableName);
    if (!createdTables.has(tableName)) {
      targets.add(tableName);
    }
  }

  return Array.from(targets).sort();
}

function buildEntry(filename: string, sql: string): MigrationBaselineEntry {
  const hasDestructiveApproval = EXPLICIT_DESTRUCTIVE_APPROVAL.test(sql);
  const hasOwnerSensitiveApproval = OWNER_SENSITIVE_APPROVAL.test(sql);
  const destructiveLabels = DESTRUCTIVE_PATTERNS
    .filter(({ pattern }) => pattern.test(sql))
    .map(({ label }) => label);
  const ownerSensitiveTargets = ownerSensitiveTargetsFor(sql);
  const risks: MigrationRisk[] = [];
  const approvals: MigrationApproval[] = [];

  if (hasDestructiveApproval) {
    approvals.push("destructive-ok");
  }
  if (hasOwnerSensitiveApproval) {
    approvals.push("owner-sensitive-ok");
  }
  if (destructiveLabels.length > 0) {
    risks.push(hasDestructiveApproval ? "destructive_approved" : "destructive_unapproved");
  }
  if (ownerSensitiveTargets.length > 0) {
    risks.push(hasOwnerSensitiveApproval ? "owner_sensitive_approved" : "owner_sensitive_unapproved");
  }

  return {
    filename,
    sequence: sequenceFor(filename),
    checksum: checksumFor(sql),
    byteLength: Buffer.byteLength(sql, "utf8"),
    lineCount: sql.split(/\r?\n/).length,
    risks,
    approvals,
    destructiveLabels,
    ownerSensitiveTargets,
    extensionRequirements: extensionRequirementsFor(sql),
  };
}

function duplicateSequencesFor(entries: MigrationBaselineEntry[]): Array<{ sequence: string; filenames: string[] }> {
  const bySequence = new Map<string, string[]>();
  for (const entry of entries) {
    if (entry.sequence === "none") {
      continue;
    }
    const filenames = bySequence.get(entry.sequence) ?? [];
    filenames.push(entry.filename);
    bySequence.set(entry.sequence, filenames);
  }
  return Array.from(bySequence.entries())
    .filter(([, filenames]) => filenames.length > 1)
    .map(([sequence, filenames]) => ({ sequence, filenames }));
}

function missingSequencesFor(entries: MigrationBaselineEntry[]): string[] {
  const numericSequences = entries
    .map((entry) => Number(entry.sequence))
    .filter((sequence) => Number.isInteger(sequence) && sequence > 0);
  if (numericSequences.length === 0) {
    return [];
  }
  const present = new Set(numericSequences);
  const first = Math.min(...numericSequences);
  const last = Math.max(...numericSequences);
  const missing: string[] = [];
  for (let sequence = first; sequence <= last; sequence += 1) {
    if (!present.has(sequence)) {
      missing.push(sequence.toString().padStart(4, "0"));
    }
  }
  return missing;
}

export async function buildMigrationBaselineReport(options: {
  migrationDir?: string;
  generatedAt?: string;
} = {}): Promise<MigrationBaselineReport> {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const platformRoot = path.resolve(currentDir, "../..");
  const migrationDir = options.migrationDir ?? path.resolve(currentDir, "../../db/migrations");
  const migrationDirLabel = path.relative(platformRoot, migrationDir).replaceAll(path.sep, "/");
  const migrationFiles = (await readdir(migrationDir)).filter((filename) => filename.endsWith(".sql")).sort();
  const entries = await Promise.all(
    migrationFiles.map(async (filename) => buildEntry(filename, await readFile(path.join(migrationDir, filename), "utf8"))),
  );
  const extensionRequirements = Array.from(
    new Set(entries.flatMap((entry) => entry.extensionRequirements)),
  ).sort();

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    migrationDir: migrationDirLabel || ".",
    totalMigrations: entries.length,
    firstMigration: entries[0]?.filename ?? null,
    headMigration: entries.at(-1)?.filename ?? null,
    duplicateSequences: duplicateSequencesFor(entries),
    missingSequences: missingSequencesFor(entries),
    riskSummary: {
      destructiveApproved: entries.filter((entry) => entry.risks.includes("destructive_approved")).length,
      destructiveUnapproved: entries.filter((entry) => entry.risks.includes("destructive_unapproved")).length,
      ownerSensitiveApproved: entries.filter((entry) => entry.risks.includes("owner_sensitive_approved")).length,
      ownerSensitiveUnapproved: entries.filter((entry) => entry.risks.includes("owner_sensitive_unapproved")).length,
    },
    extensionRequirements,
    stopConditions: [
      "This report is DB-less and must not be used as proof that production DB has been migrated.",
      "Any production or staging DATABASE_URL migration rehearsal remains a separate L4 operation.",
      "New migrations must update this baseline report when sequence head, risk summary, or extension requirements change.",
    ],
    rehearsalCommands: [
      "npx tsx src/scripts/reportMigrationBaseline.ts --format=markdown",
      "npx tsx src/scripts/reportMigrationBaseline.ts --format=json",
      "npm run migrate -- --allow-destructive",
    ],
    entries,
  };
}

function renderRiskRows(entries: MigrationBaselineEntry[], risk: MigrationRisk): string[] {
  return entries
    .filter((entry) => entry.risks.includes(risk))
    .map((entry) => {
      const detail = [
        ...entry.destructiveLabels,
        ...entry.ownerSensitiveTargets.map((target) => `target:${target}`),
      ].join(", ");
      return `| ${entry.filename} | ${entry.checksum} | ${detail || "-"} |`;
    });
}

export function renderMarkdown(report: MigrationBaselineReport): string {
  const lines = [
    "# DB Migration Baseline Rehearsal",
    "",
    `Generated: ${report.generatedAt}`,
    `Schema version: ${report.schemaVersion}`,
    `Migration dir: ${report.migrationDir}`,
    "",
    "## Summary",
    "",
    `- Total migrations: ${report.totalMigrations}`,
    `- First migration: ${report.firstMigration ?? "-"}`,
    `- Head migration: ${report.headMigration ?? "-"}`,
    `- Extension requirements: ${report.extensionRequirements.join(", ") || "-"}`,
    `- Duplicate sequences: ${report.duplicateSequences.length}`,
    `- Missing sequences: ${report.missingSequences.join(", ") || "-"}`,
    "",
    "## Risk Summary",
    "",
    `- Destructive approved: ${report.riskSummary.destructiveApproved}`,
    `- Destructive unapproved historical debt: ${report.riskSummary.destructiveUnapproved}`,
    `- Owner-sensitive approved: ${report.riskSummary.ownerSensitiveApproved}`,
    `- Owner-sensitive unapproved historical debt: ${report.riskSummary.ownerSensitiveUnapproved}`,
    "",
    "## Stop Conditions",
    "",
    ...report.stopConditions.map((condition) => `- ${condition}`),
    "",
    "## Rehearsal Commands",
    "",
    ...report.rehearsalCommands.map((command) => `- \`${command}\``),
    "",
    "## Duplicate Sequences",
    "",
    "| Sequence | Files |",
    "|---|---|",
    ...report.duplicateSequences.map((entry) => `| ${entry.sequence} | ${entry.filenames.join(", ")} |`),
    "",
    "## Unapproved Destructive Historical Debt",
    "",
    "| File | Checksum | Detail |",
    "|---|---|---|",
    ...renderRiskRows(report.entries, "destructive_unapproved"),
    "",
    "## Unapproved Owner-sensitive Historical Debt",
    "",
    "| File | Checksum | Detail |",
    "|---|---|---|",
    ...renderRiskRows(report.entries, "owner_sensitive_unapproved"),
  ];
  return `${lines.join("\n")}\n`;
}

function parseCli(argv: string[]): { format: "json" | "markdown"; outPath: string | null } {
  const formatArg = argv.find((arg) => arg.startsWith("--format="));
  const outArg = argv.find((arg) => arg.startsWith("--out="));
  return {
    format: formatArg?.slice("--format=".length) === "json" || argv.includes("--json") ? "json" : "markdown",
    outPath: outArg ? outArg.slice("--out=".length) : null,
  };
}

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2));
  const report = await buildMigrationBaselineReport();
  const output = options.format === "json" ? `${JSON.stringify(report, null, 2)}\n` : renderMarkdown(report);
  if (options.outPath) {
    await mkdir(path.dirname(options.outPath), { recursive: true });
    await writeFile(options.outPath, output, "utf8");
    console.log(`wrote ${options.outPath}`);
    return;
  }
  process.stdout.write(output);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void main();
}
