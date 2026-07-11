from pathlib import Path

root = Path(__file__).resolve().parents[1]
guard_path = root / "platform_v2/cloudflare_shadow/scripts/deploy-production-guard.mjs"
test_path = root / "platform_v2/cloudflare_shadow/src/productionReleaseScripts.test.ts"

guard = guard_path.read_text(encoding="utf-8")
start_marker = "async function smoke(baseUrl, expectedGitSha) {"
end_marker = "\nfunction isTolerableWranglerRouteUpdateFailure"
start = guard.index(start_marker)
end = guard.index(end_marker, start)
replacement = r'''const SMOKE_MAX_ATTEMPTS = 12;
const SMOKE_RETRY_DELAY_MS = 5_000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function smokeResponseOk(path, response, payload, expectedGitSha) {
  return path === "/qa/reflection-loop.json"
    ? response.ok
      && typeof payload === "object"
      && payload !== null
      && payload.ok === true
      && payload.service === "ikimon.life"
      && payload.runtime === "cloudflare-worker"
      && payload.loop_contract?.no_personal_data === true
    : path === "/api/v1/runtime/version"
      ? response.ok
        && typeof payload === "object"
        && payload !== null
        && payload.ok === true
        && payload.service === "ikimon.life"
        && payload.runtime === "cloudflare-worker"
        && payload.schemaVersion === "cloudflare_worker_runtime/v1"
        && payload.gitSha === expectedGitSha
        && payload.publicSafe === true
      : response.ok
        && typeof payload === "object"
        && payload !== null
        && payload.ok === true
        && payload.service === "ikimon-life-cloudflare-worker";
}

async function smoke(baseUrl, expectedGitSha) {
  for (const path of ["/healthz", "/readyz", "/api/v1/runtime/version", "/qa/reflection-loop.json"]) {
    let passed = false;
    let lastStatus = 0;
    let lastContentType = "";
    let lastPayload = {};
    let lastError = null;

    for (let attempt = 1; attempt <= SMOKE_MAX_ATTEMPTS; attempt += 1) {
      const separator = path.includes("?") ? "&" : "?";
      const url = `${baseUrl.replace(/\/$/, "")}${path}${separator}deploy_check=${Date.now()}-${attempt}`;
      try {
        const response = await fetch(url, {
          redirect: "manual",
          headers: { accept: "application/json", "cache-control": "no-store" }
        });
        const contentType = response.headers.get("content-type") ?? "";
        let payload = {};
        if (contentType.includes("application/json")) {
          payload = await response.json();
        }
        const ok = smokeResponseOk(path, response, payload, expectedGitSha);
        lastStatus = response.status;
        lastContentType = contentType;
        lastPayload = payload;
        lastError = null;
        events.push({
          command: `smoke ${baseUrl}${path}`,
          exitCode: ok ? 0 : 1,
          durationMs: 0,
          status: response.status,
          contentType,
          attempt,
          expectedGitSha: path === "/api/v1/runtime/version" ? expectedGitSha : undefined,
          actualGitSha: path === "/api/v1/runtime/version" ? payload?.gitSha ?? null : undefined
        });
        if (ok) {
          passed = true;
          break;
        }
      } catch (error) {
        lastError = error;
        events.push({
          command: `smoke ${baseUrl}${path}`,
          exitCode: 1,
          durationMs: 0,
          status: 0,
          contentType: "",
          attempt,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      if (attempt < SMOKE_MAX_ATTEMPTS) {
        await delay(SMOKE_RETRY_DELAY_MS);
      }
    }

    if (!passed) {
      const actualGitSha = typeof lastPayload === "object" && lastPayload !== null ? lastPayload.gitSha ?? null : null;
      const errorDetail = lastError instanceof Error ? lastError.message : "";
      throw new Error(
        `Smoke failed for ${baseUrl}${path}: ${lastStatus} ${lastContentType}; expectedGitSha=${expectedGitSha}; actualGitSha=${actualGitSha}; ${errorDetail}`
      );
    }
  }
}
'''
guard = guard[:start] + replacement + guard[end:]
guard_path.write_text(guard, encoding="utf-8")

test_source = test_path.read_text(encoding="utf-8")
needle = '  assert.match(guard, /payload\\.gitSha\\s*===\\s*expectedGitSha/);\n'
addition = (
    needle
    + '  assert.match(guard, /const SMOKE_MAX_ATTEMPTS = 12/);\n'
    + '  assert.match(guard, /const SMOKE_RETRY_DELAY_MS = 5_000/);\n'
    + '  assert.match(guard, /attempt < SMOKE_MAX_ATTEMPTS/);\n'
    + '  assert.match(guard, /await delay\\(SMOKE_RETRY_DELAY_MS\\)/);\n'
    + '  assert.match(guard, /actualGitSha/);\n'
)
if needle not in test_source:
    raise SystemExit("production smoke test insertion marker not found")
test_source = test_source.replace(needle, addition, 1)
test_path.write_text(test_source, encoding="utf-8")
