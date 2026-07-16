const DEFAULT_MAX_ATTEMPTS = 12;
const DEFAULT_DELAY_MS = 5_000;
const MAX_ATTEMPTS = 30;
const MAX_DELAY_MS = 60_000;
const DEFAULT_ATTEMPT_TIMEOUT_MS = 10_000;
const MAX_ATTEMPT_TIMEOUT_MS = 60_000;
const SHA_PATTERN = /^[a-f0-9]{40}$/u;

function defaultSleep(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function boundedPositiveInteger(value, fallback, maximum, name) {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < 1 || resolved > maximum) {
    throw new Error(`${name}_invalid`);
  }
  return resolved;
}

function safeObservedSha(value) {
  return SHA_PATTERN.test(String(value || "")) ? String(value) : "";
}

export async function waitForExactStagingRuntimeVersion(options) {
  const baseUrl = String(options?.baseUrl || "").replace(/\/$/u, "");
  const expectedSha = String(options?.expectedSha || "");
  const fetchImpl = options?.fetchImpl ?? globalThis.fetch;
  const sleep = options?.sleep ?? defaultSleep;
  const onAttempt = options?.onAttempt ?? (() => {});
  const maxAttempts = boundedPositiveInteger(options?.maxAttempts, DEFAULT_MAX_ATTEMPTS, MAX_ATTEMPTS, "staging_runtime_smoke_max_attempts");
  const delayMs = boundedPositiveInteger(options?.delayMs, DEFAULT_DELAY_MS, MAX_DELAY_MS, "staging_runtime_smoke_delay_ms");
  const attemptTimeoutMs = boundedPositiveInteger(options?.attemptTimeoutMs, DEFAULT_ATTEMPT_TIMEOUT_MS, MAX_ATTEMPT_TIMEOUT_MS, "staging_runtime_smoke_attempt_timeout_ms");
  if (!/^https:\/\//u.test(baseUrl)) throw new Error("staging_runtime_smoke_base_url_invalid");
  if (!SHA_PATTERN.test(expectedSha)) throw new Error("staging_runtime_smoke_expected_sha_invalid");
  if (typeof fetchImpl !== "function") throw new Error("staging_runtime_smoke_fetch_invalid");
  if (typeof sleep !== "function" || typeof onAttempt !== "function") throw new Error("staging_runtime_smoke_callback_invalid");

  const probeId = `${expectedSha.slice(0, 12)}-${Date.now().toString(36)}`;
  let last = { status: 0, contentType: "", observedSha: "" };
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const url = new URL("/api/v1/runtime/version", `${baseUrl}/`);
    url.searchParams.set("deploy_smoke", `${probeId}-${attempt}`);
    const startedAt = Date.now();
    let response;
    let payload = {};
    let contentType = "";
    let timedOut = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), attemptTimeoutMs);
    try {
      response = await fetchImpl(url, {
        redirect: "manual",
        headers: { accept: "application/json", "cache-control": "no-store" },
        signal: controller.signal
      });
      contentType = response.headers.get("content-type") ?? "";
      payload = contentType.includes("application/json") ? await response.json() : {};
    } catch {
      timedOut = controller.signal.aborted;
      response = null;
      payload = {};
    } finally {
      clearTimeout(timeoutId);
    }
    const observedSha = safeObservedSha(payload?.gitSha);
    const ok = Boolean(response?.ok)
      && payload?.ok === true
      && payload?.service === "ikimon.life"
      && payload?.environment === "staging"
      && payload?.runtime === "cloudflare-worker"
      && observedSha === expectedSha;
    last = { status: Number(response?.status || 0), contentType, observedSha };
    onAttempt({
      command: `smoke ${baseUrl}/api/v1/runtime/version attempt ${attempt}/${maxAttempts}`,
      exitCode: ok ? 0 : 1,
      status: last.status,
      contentType,
      durationMs: Date.now() - startedAt,
      attempt,
      expectedShaMatched: ok,
      observedGitSha: observedSha || "invalid",
      timedOut
    });
    if (ok) return { payload, attempts: attempt };
    if (attempt < maxAttempts) await sleep(delayMs);
  }

  throw new Error(`staging_runtime_version_not_converged:${baseUrl}:attempts=${maxAttempts}:status=${last.status}:observed_sha=${last.observedSha || "invalid"}`);
}
