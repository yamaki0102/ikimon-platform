import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const shadowRoot = process.cwd();
const repoRoot = path.resolve(shadowRoot, "..", "..");
const platformRoot = path.join(repoRoot, "platform_v2");
const PG_DEPENDENCY_TABLE_LIMIT = 80;
const STOP_BLOCKER_TABLE_LIMIT = 120;

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

function parseWranglerConfig(wranglerText) {
  try {
    return JSON.parse(wranglerText);
  } catch {
    return {};
  }
}

function productionVarsFromWrangler(config) {
  const vars = config?.env?.production?.vars;
  return vars && typeof vars === "object" ? vars : {};
}

function classifyPg(text) {
  const flags = [];
  if (/\bST_[A-Za-z0-9_]+\s*\(|PostGIS|\bgeometry\b|\bgeography\b/i.test(text)) flags.push("postgis");
  if (/vector|embedding|pgvector|cosine|ivfflat/i.test(text)) flags.push("vector");
  if (/tsvector|to_tsvector|plainto_tsquery|websearch_to_tsquery/i.test(text)) flags.push("full_text");
  if (/(?:^|[^.\w])(?:LISTEN|NOTIFY)\s+[A-Za-z_"]|\bSKIP\s+LOCKED\b|\bFOR\s+UPDATE\b/i.test(text)) flags.push("job_locking");
  if (/DATABASE_URL|PGHOST|PGUSER|PGPASSWORD/i.test(text)) flags.push("pg_env");
  const hasPgArray = /\barray\s*\[/i.test(text) || /\barray\s*\(\s*select\b/i.test(text);
  if (/jsonb|::jsonb|unnest\(/i.test(text) || hasPgArray) flags.push("pg_types");
  if (/getPool|pool\.query|client\.query|getClient|withTransaction/i.test(text)) flags.push("runtime_query");
  return flags;
}

function classifySuppressedPgNoise(text) {
  const signals = [];
  if (/addEventListener|\.listen\s*\(|\bnotify\s*\(/i.test(text)) signals.push("js_listener_or_notify");
  if (/\bArray(?:\.isArray|\s*[<(])/.test(text)) signals.push("js_array_helper_or_type");
  return signals;
}

function lineForOffset(text, offset) {
  return text.slice(0, offset).split(/\r?\n/).length;
}

function classifyFallbackReason(reason) {
  if (/materialized_miss|html_personalized_request|static_asset|thumb|area_snapshot/i.test(reason)) return "materialized_origin_fallback";
  if (/auth|oauth|session/i.test(reason)) return "auth_origin_fallback";
  if (/unsupported_observation_api|legacy_observation_api|public_write_origin_mode/i.test(reason)) return "api_origin_fallback";
  if (/map_area_polygons/i.test(reason)) return "map_origin_fallback";
  if (/public_custom_domain_path/i.test(reason)) return "broad_public_origin_fallback";
  return "origin_fallback";
}

function extractOriginFallbackCalls(file, text) {
  const calls = [];
  const pattern = /fetchOriginFallback\s*\(/g;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    const lineStart = text.lastIndexOf("\n", start) + 1;
    const linePrefix = text.slice(lineStart, start);
    if (/\bfunction\s+$/.test(linePrefix)) continue;

    const openParen = start + match[0].length - 1;
    const args = extractBalancedCallArgs(text, openParen);
    if (!args) continue;
    const quoted = [...args.matchAll(/"([^"]+)"/g)].map((item) => item[1]);
    const reason = quoted.findLast((value) => /fallback|origin|auth|oauth|session|materialized|unsupported|polygon|path|miss|mode|personalized|html|thumb|asset/i.test(value))
      ?? "origin_fallback_default";
    calls.push({
      file: rel(file),
      line: lineForOffset(text, start),
      reason,
      category: classifyFallbackReason(reason)
    });
  }
  return calls;
}

function extractBalancedCallArgs(text, openParen) {
  let depth = 0;
  let inString = false;
  let quote = "";
  let escape = false;
  for (let i = openParen; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === quote) inString = false;
      continue;
    }
    if (ch === "\"" || ch === "'" || ch === "`") {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === "(") depth += 1;
    if (ch === ")") {
      depth -= 1;
      if (depth === 0) return text.slice(openParen + 1, i);
    }
  }
  return null;
}

function blockerSeverity(item) {
  if (item.type === "origin_fallback" && item.category === "api_origin_fallback") return "P0";
  if (item.type === "origin_fallback" && item.category === "auth_origin_fallback") return "P0";
  if (item.type === "origin_fallback" && item.category === "broad_public_origin_fallback") return "P0";
  if (item.type === "origin_fallback" && item.category === "materialized_origin_fallback") return "P1";
  if (item.type === "origin_fallback" && item.category === "map_origin_fallback") return "P1";
  if (item.type === "pg_dependency" && item.flags.includes("vector")) return "P0";
  if (item.type === "pg_dependency" && item.flags.includes("job_locking")) return "P0";
  if (item.type === "pg_dependency" && item.flags.includes("runtime_query")) return "P1";
  return "P2";
}

function configuredStateForFallback(item, productionVars) {
  const originFallbackConfigured = typeof productionVars.ORIGIN_FALLBACK_BASE_URL === "string"
    && productionVars.ORIGIN_FALLBACK_BASE_URL.trim() !== "";
  const publicWriteMode = String(productionVars.PUBLIC_WRITE_MODE ?? "");
  if (!originFallbackConfigured) {
    return { active: false, note: "origin_fallback_not_configured" };
  }
  if (item.reason === "public_write_origin_mode" && publicWriteMode !== "origin_fallback") {
    return { active: false, note: `inactive_public_write_mode_${publicWriteMode || "unset"}` };
  }
  if (item.reason === "oauth_provider_not_configured") {
    return { active: true, note: "active_if_oauth_secret_missing" };
  }
  return { active: true, note: "active_in_production_config" };
}

function configuredStateForBlocker(item, productionVars) {
  if (item.type !== "origin_fallback") return { active: true, note: "not_config_gated" };
  return configuredStateForFallback(item, productionVars);
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
const wranglerConfig = parseWranglerConfig(wrangler);
const productionVars = productionVarsFromWrangler(wranglerConfig);
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

const fallbackSourceRoots = [
  path.join(shadowRoot, "src"),
  path.join(platformRoot, "src", "routes"),
  path.join(platformRoot, "src", "services"),
  path.join(platformRoot, "src", "scripts")
].filter((dir) => statSync(dir, { throwIfNoEntry: false })?.isDirectory());

const pgSourceRoots = [
  path.join(platformRoot, "src", "routes"),
  path.join(platformRoot, "src", "services"),
  path.join(platformRoot, "src", "scripts")
].filter((dir) => statSync(dir, { throwIfNoEntry: false })?.isDirectory());

const pgFiles = [];
const suppressedPgSignalNoiseFiles = [];
const originFallbackCalls = [];
for (const dir of fallbackSourceRoots) {
  for (const file of walk(dir, (candidate) => /\.(ts|tsx|js|mjs)$/.test(candidate))) {
    const text = read(file);
    originFallbackCalls.push(...extractOriginFallbackCalls(file, text));
  }
}

for (const dir of pgSourceRoots) {
  for (const file of walk(dir, (candidate) => /\.(ts|tsx|js|mjs)$/.test(candidate))) {
    const text = read(file);
    const flags = classifyPg(text);
    const suppressedNoise = classifySuppressedPgNoise(text);
    if (flags.length === 0 && suppressedNoise.length > 0) {
      suppressedPgSignalNoiseFiles.push({
        file: rel(file),
        signals: suppressedNoise
      });
    }
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
originFallbackCalls.sort((a, b) => a.category.localeCompare(b.category) || a.reason.localeCompare(b.reason) || a.file.localeCompare(b.file) || a.line - b.line);

const fallbackCategoryCounts = new Map();
for (const item of originFallbackCalls) {
  fallbackCategoryCounts.set(item.category, (fallbackCategoryCounts.get(item.category) ?? 0) + 1);
}

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

const stopBlockers = [
  ...originFallbackCalls.map((item) => ({
    type: "origin_fallback",
    key: `${item.reason}@${item.file}:${item.line}`,
    reason: item.reason,
    category: item.category,
    severity: blockerSeverity({ type: "origin_fallback", category: item.category })
  })),
  ...pgFiles.map((item) => ({
    type: "pg_dependency",
    key: item.file,
    category: item.flags.join(","),
    severity: blockerSeverity({ type: "pg_dependency", flags: item.flags })
  })),
  ...vpsWorkflows.map((item) => ({
    type: "workflow_dependency",
    key: item.file,
    category: item.signals.join(","),
    severity: "P1"
  }))
];

const configuredStopBlockers = stopBlockers
  .map((item) => ({ ...item, configured: configuredStateForBlocker(item, productionVars) }))
  .filter((item) => item.configured.active);

const stopBlockerCounts = stopBlockers.reduce((acc, item) => {
  acc[item.severity] = (acc[item.severity] ?? 0) + 1;
  return acc;
}, {});

const vpsStopReady = stopBlockers.length === 0;
const configuredVpsStopReady = configuredStopBlockers.length === 0;

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
  `- displayed_pg_dependencies: ${Math.min(PG_DEPENDENCY_TABLE_LIMIT, pgFiles.length)} of ${pgFiles.length}`,
  "",
  "| score | file | flags | query_count |",
  "|---:|---|---|---:|",
  ...pgFiles.slice(0, PG_DEPENDENCY_TABLE_LIMIT).map((item) => `| ${item.score} | ${item.file} | ${item.flags.join(", ")} | ${item.queryCount} |`),
  "",
  ...section("PostgreSQL Signal Noise Suppression"),
  `- js_noise_suppressed_files: ${suppressedPgSignalNoiseFiles.length}`,
  "",
  "| file | suppressed_signals |",
  "|---|---|",
  ...suppressedPgSignalNoiseFiles.slice(0, 40).map((item) => `| ${item.file} | ${item.signals.join(", ")} |`),
  "",
  ...section("Origin Fallback Dependencies"),
  `- fallback_call_count: ${originFallbackCalls.length}`,
  `- categories: ${[...fallbackCategoryCounts.entries()].map(([category, value]) => `${category}=${value}`).join(", ") || "none"}`,
  "",
  "| category | reason | file | line |",
  "|---|---|---|---:|",
  ...originFallbackCalls.map((item) => `| ${item.category} | ${item.reason} | ${item.file} | ${item.line} |`),
  "",
  ...section("Production Fallback Configuration"),
  `- PUBLIC_WRITE_MODE: ${productionVars.PUBLIC_WRITE_MODE ?? "unset"}`,
  `- ORIGIN_FALLBACK_BASE_URL: ${productionVars.ORIGIN_FALLBACK_BASE_URL ? "configured" : "unset"}`,
  `- ORIGIN_FALLBACK_RESOLVE_OVERRIDE: ${productionVars.ORIGIN_FALLBACK_RESOLVE_OVERRIDE ? "configured" : "unset"}`,
  "",
  "| reason | configured_state | note |",
  "|---|---|---|",
  ...originFallbackCalls.map((item) => {
    const state = configuredStateForFallback(item, productionVars);
    return `| ${item.reason} | ${state.active ? "active" : "dormant"} | ${state.note} |`;
  }),
  "",
  ...section("VPS / PostgreSQL Workflow Dependencies"),
  ...vpsWorkflows.map((item) => `- ${item.file}: ${item.signals.join(", ")}`),
  "",
  ...section("VPS Stop Readiness Gate"),
  `- status: ${vpsStopReady ? "ready" : "blocked"}`,
  `- blocker_count: ${stopBlockers.length}`,
  `- p0_blockers: ${stopBlockerCounts.P0 ?? 0}`,
  `- p1_blockers: ${stopBlockerCounts.P1 ?? 0}`,
  `- p2_blockers: ${stopBlockerCounts.P2 ?? 0}`,
  "",
  "| severity | type | category | key |",
  "|---|---|---|---|",
  ...stopBlockers
    .sort((a, b) => a.severity.localeCompare(b.severity) || a.type.localeCompare(b.type) || a.key.localeCompare(b.key))
    .slice(0, STOP_BLOCKER_TABLE_LIMIT)
    .map((item) => `| ${item.severity} | ${item.type} | ${item.category} | ${item.key} |`),
  "",
  ...section("Configured Production VPS Stop Readiness Gate"),
  `- status: ${configuredVpsStopReady ? "ready" : "blocked"}`,
  `- blocker_count: ${configuredStopBlockers.length}`,
  `- p0_blockers: ${configuredStopBlockers.filter((item) => item.severity === "P0").length}`,
  `- p1_blockers: ${configuredStopBlockers.filter((item) => item.severity === "P1").length}`,
  `- p2_blockers: ${configuredStopBlockers.filter((item) => item.severity === "P2").length}`,
  "",
  "| severity | type | category | configured_note | key |",
  "|---|---|---|---|---|",
  ...configuredStopBlockers
    .sort((a, b) => a.severity.localeCompare(b.severity) || a.type.localeCompare(b.type) || a.key.localeCompare(b.key))
    .slice(0, STOP_BLOCKER_TABLE_LIMIT)
    .map((item) => `| ${item.severity} | ${item.type} | ${item.category} | ${item.configured.note} | ${item.key} |`),
  "",
  ...section("Migration Priority Heuristic"),
  "- P0: public Cloudflare-native routes with small readmodels and safe fallback.",
  "- P1: authenticated user read APIs that already have D1 canonical tables.",
  "- P2: admin/review workflows with PostgreSQL writes, after route-level D1 parity tests.",
  "- P3: PostGIS/vector/background-job heavy services; these need redesign, not mechanical SQL conversion.",
  ""
];

console.log(lines.join("\n"));

if (process.argv.includes("--fail-on-vps-blockers") && !configuredVpsStopReady) {
  process.exitCode = 2;
}
