import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const shadowRoot = process.cwd();
const repoRoot = path.resolve(shadowRoot, "..", "..");
const platformRoot = path.join(repoRoot, "platform_v2");

function walk(dir, predicate, output = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".wrangler" || entry.name === ".deploy") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, predicate, output);
    else if (predicate(fullPath)) output.push(fullPath);
  }
  return output;
}

function read(file) {
  return readFileSync(file, "utf8");
}

function rel(file) {
  return path.relative(repoRoot, file).replaceAll("\\", "/");
}

function count(pattern, text) {
  return [...text.matchAll(pattern)].length;
}

function extractSqlTables(sql) {
  const tables = new Set();
  for (const match of sql.matchAll(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/gi)) {
    tables.add(match[1]);
  }
  return [...tables].sort();
}

function extractD1Bindings(wranglerText) {
  const bindings = [];
  let searchFrom = 0;
  while (true) {
    const keyIndex = wranglerText.indexOf('"d1_databases"', searchFrom);
    if (keyIndex === -1) break;
    const arrayStart = wranglerText.indexOf("[", keyIndex);
    if (arrayStart === -1) break;
    let depth = 0;
    let inString = false;
    let escape = false;
    let objectStart = -1;
    for (let i = arrayStart; i < wranglerText.length; i += 1) {
      const ch = wranglerText[i];
      if (inString) {
        if (escape) escape = false;
        else if (ch === "\\") escape = true;
        else if (ch === "\"") inString = false;
        continue;
      }
      if (ch === "\"") {
        inString = true;
        continue;
      }
      if (ch === "[") depth += 1;
      if (ch === "]") {
        depth -= 1;
        if (depth === 0) {
          searchFrom = i + 1;
          break;
        }
      }
      if (ch === "{" && depth === 1) objectStart = i;
      if (ch === "}" && depth === 1 && objectStart !== -1) {
        const objectText = wranglerText.slice(objectStart, i + 1);
        const binding = objectText.match(/"binding"\s*:\s*"([^"]+)"/)?.[1];
        const database = objectText.match(/"database_name"\s*:\s*"([^"]+)"/)?.[1];
        const id = objectText.match(/"database_id"\s*:\s*"([^"]+)"/)?.[1];
        if (binding && database && id) bindings.push({ binding, database, id });
        objectStart = -1;
      }
    }
    if (searchFrom <= keyIndex) break;
  }
  return bindings;
}

function classifyPg(text) {
  const flags = [];
  if (/\bST_[A-Za-z0-9_]+\s*\(|PostGIS|\bgeometry\b|\bgeography\b/i.test(text)) flags.push("postgis");
  if (/vector|embedding|pgvector|cosine|ivfflat/i.test(text)) flags.push("vector");
  if (/tsvector|to_tsvector|plainto_tsquery|websearch_to_tsquery/i.test(text)) flags.push("full_text");
  if (/LISTEN|NOTIFY|SKIP LOCKED|FOR UPDATE/i.test(text)) flags.push("job_locking");
  if (/DATABASE_URL|PGHOST|PGUSER|PGPASSWORD/i.test(text)) flags.push("pg_env");
  if (/jsonb|::jsonb|\bARRAY\b|unnest\(/i.test(text)) flags.push("pg_types");
  if (/getPool|pool\.query|client\.query|getClient|withTransaction/i.test(text)) flags.push("runtime_query");
  return flags;
}

function scorePg(flags, text) {
  let score = flags.length;
  if (flags.includes("postgis")) score += 5;
  if (flags.includes("vector")) score += 5;
  if (flags.includes("job_locking")) score += 3;
  score += Math.min(count(/\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b/gi, text), 12);
  return score;
}

function section(title) {
  return [`## ${title}`, ""];
}

const wranglerPath = path.join(shadowRoot, "wrangler.jsonc");
const wrangler = read(wranglerPath);
const d1Bindings = [...new Map(
  extractD1Bindings(wrangler).map((item) => [`${item.binding}:${item.database}:${item.id}`, item])
).values()];

const migrationDirs = [
  path.join(shadowRoot, "migrations", "core"),
  path.join(shadowRoot, "migrations", "observations")
].filter((dir) => statSync(dir, { throwIfNoEntry: false })?.isDirectory());

const d1Tables = [];
for (const dir of migrationDirs) {
  for (const file of walk(dir, (candidate) => candidate.endsWith(".sql"))) {
    const sql = read(file);
    d1Tables.push({
      migration: rel(file),
      tables: extractSqlTables(sql)
    });
  }
}

const sourceRoots = [
  path.join(platformRoot, "src", "routes"),
  path.join(platformRoot, "src", "services"),
  path.join(platformRoot, "src", "scripts")
].filter((dir) => statSync(dir, { throwIfNoEntry: false })?.isDirectory());

const pgFiles = [];
for (const dir of sourceRoots) {
  for (const file of walk(dir, (candidate) => /\.(ts|tsx|js|mjs)$/.test(candidate))) {
    const text = read(file);
    const flags = classifyPg(text);
    if (flags.length === 0) continue;
    pgFiles.push({
      file: rel(file),
      flags,
      score: scorePg(flags, text),
      queryCount: count(/\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b/gi, text)
    });
  }
}

pgFiles.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file));

const workflowsRoot = path.join(repoRoot, ".github", "workflows");
const workflowFiles = statSync(workflowsRoot, { throwIfNoEntry: false })?.isDirectory()
  ? walk(workflowsRoot, (candidate) => candidate.endsWith(".yml") || candidate.endsWith(".yaml"))
  : [];
const vpsWorkflows = workflowFiles
  .map((file) => ({ file: rel(file), text: read(file) }))
  .filter(({ text }) => /VPS_|DATABASE_URL|ssh|scp|psql|applyMigrations/i.test(text))
  .map(({ file, text }) => ({
    file,
    signals: [
      /DATABASE_URL/i.test(text) ? "DATABASE_URL" : null,
      /VPS_/i.test(text) ? "VPS" : null,
      /\bpsql\b/i.test(text) ? "psql" : null,
      /ssh|scp/i.test(text) ? "ssh/scp" : null,
      /applyMigrations/i.test(text) ? "migrations" : null
    ].filter(Boolean)
  }));

const lines = [
  "# ikimon.life D1 / VPS PostgreSQL Migration Boundary Report",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  ...section("D1 Bindings"),
  ...d1Bindings.map((item) => `- ${item.binding}: ${item.database} (${item.id})`),
  "",
  ...section("D1 Migration Tables"),
  ...d1Tables.flatMap((item) => [
    `- ${item.migration}`,
    item.tables.length ? `  - tables: ${item.tables.join(", ")}` : "  - tables: none"
  ]),
  "",
  ...section("PostgreSQL Runtime Dependencies"),
  `- files_scanned_with_pg_signals: ${pgFiles.length}`,
  "",
  "| score | file | flags | query_count |",
  "|---:|---|---|---:|",
  ...pgFiles.slice(0, 80).map((item) => `| ${item.score} | ${item.file} | ${item.flags.join(", ")} | ${item.queryCount} |`),
  "",
  ...section("VPS / PostgreSQL Workflow Dependencies"),
  ...vpsWorkflows.map((item) => `- ${item.file}: ${item.signals.join(", ")}`),
  "",
  ...section("Migration Priority Heuristic"),
  "- P0: public Cloudflare-native routes with small readmodels and safe fallback.",
  "- P1: authenticated user read APIs that already have D1 canonical tables.",
  "- P2: admin/review workflows with PostgreSQL writes, after route-level D1 parity tests.",
  "- P3: PostGIS/vector/background-job heavy services; these need redesign, not mechanical SQL conversion.",
  ""
];

console.log(lines.join("\n"));
