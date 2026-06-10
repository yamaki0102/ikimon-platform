import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const options = {
    baseUrl: process.env.PRODUCTION_SMOKE_BASE_URL || "http://127.0.0.1:13202",
    outputPath: "platform_v2/test-results/production-targeted-smoke.json",
    summaryPath: process.env.GITHUB_STEP_SUMMARY || "",
    reason: process.env.DEPLOY_SMOKE_TIER_REASON || "unknown",
    changedCount: Number(process.env.DEPLOY_SMOKE_CHANGED_COUNT || 0),
  };

  for (const arg of argv) {
    if (arg.startsWith("--base-url=")) {
      options.baseUrl = arg.slice("--base-url=".length);
    } else if (arg.startsWith("--output=")) {
      options.outputPath = arg.slice("--output=".length);
    } else if (arg.startsWith("--summary=")) {
      options.summaryPath = arg.slice("--summary=".length);
    } else if (arg.startsWith("--reason=")) {
      options.reason = arg.slice("--reason=".length);
    } else if (arg.startsWith("--changed-count=")) {
      options.changedCount = Number(arg.slice("--changed-count=".length));
    }
  }

  options.baseUrl = options.baseUrl.replace(/\/+$/, "");
  return options;
}

const checks = [
  {
    name: "healthz",
    path: "/healthz",
    parse: "json",
    validate: (payload) => (payload?.ok === true ? null : "healthz is not ok"),
  },
  {
    name: "readyz",
    path: "/readyz",
    parse: "json",
    validate: (payload) =>
      payload?.ok === true && typeof payload.now === "string"
        ? null
        : "readyz did not confirm database readiness",
  },
  {
    name: "ops/readiness",
    path: "/ops/readiness",
    parse: "json",
    validate: (payload) => {
      if (!payload || typeof payload.status !== "string") {
        return "ops/readiness missing status";
      }
      const gates = payload.gates || {};
      return gates.parityVerified === true && gates.deltaSyncHealthy === true
        ? null
        : "ops/readiness gates are not healthy enough";
    },
  },
  {
    name: "root",
    path: "/",
    parse: "text",
    validate: (payload) => {
      const normalized = String(payload || "").toLowerCase();
      if (!normalized.includes("<!doctype html") || !normalized.includes("ikimon.life")) {
        return "root landing HTML marker mismatch";
      }
      if (normalized.includes('"status":"bootstrapping"')) {
        return "root returned bootstrapping JSON";
      }
      return null;
    },
  },
  { name: "explore", path: "/explore", parse: "text", validate: () => null },
  { name: "map", path: "/map", parse: "text", validate: () => null },
  { name: "learn", path: "/learn", parse: "text", validate: () => null },
  { name: "contact", path: "/contact", parse: "text", validate: () => null },
];

async function runCheck(baseUrl, check) {
  const response = await fetch(`${baseUrl}${check.path}`, {
    headers: { accept: check.parse === "json" ? "application/json" : "text/html" },
  });
  if (!response.ok) {
    return { name: check.name, path: check.path, ok: false, error: `HTTP ${response.status}` };
  }
  const payload = check.parse === "json" ? await response.json() : await response.text();
  const error = check.validate(payload);
  return { name: check.name, path: check.path, ok: !error, error: error || undefined };
}

function writeSummary(summaryPath, payload) {
  if (!summaryPath) {
    return;
  }

  const rows = payload.checks.map((row) => `| ${row.name} | ${row.ok ? "PASS" : `FAIL: ${row.error}`} |`);
  fs.appendFileSync(
    summaryPath,
    [
      "## Production Candidate Targeted Smoke",
      "",
      `Tier reason: \`${payload.reason}\``,
      `Changed files: \`${payload.changedCount}\``,
      "",
      "| Check | Result |",
      "| --- | --- |",
      ...rows,
      "",
    ].join("\n"),
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const results = [];
  for (const check of checks) {
    try {
      results.push(await runCheck(options.baseUrl, check));
    } catch (error) {
      results.push({
        name: check.name,
        path: check.path,
        ok: false,
        error: error instanceof Error ? error.message : "unknown_targeted_smoke_failure",
      });
    }
  }

  const failed = results.filter((row) => !row.ok);
  const payload = {
    tier: "targeted",
    reason: options.reason,
    changedCount: options.changedCount,
    baseUrl: options.baseUrl,
    checks: results,
    status: failed.length === 0 ? "passed" : "failed",
  };

  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify(payload, null, 2));
  writeSummary(options.summaryPath, payload);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

await main();
