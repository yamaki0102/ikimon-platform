import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const productionSmokeSpecUrl = new URL("../../e2e/production-smoke.spec.ts", import.meta.url);
const productionPackageUrl = new URL("../../package.json", import.meta.url);
const privatePostRunnerUrl = new URL("../../scripts/run-production-smoke-private-post.mjs", import.meta.url);
const privatePostUiRunnerUrl = new URL("../../scripts/run-production-smoke-private-post-ui.mjs", import.meta.url);
const observationUpsertPath = "\"/api/v1/observations/upsert\"";

function extractFunctionCall(source: string, callStart: number): string {
  let depth = 0;
  let quote: "\"" | "'" | "`" | null = null;
  let escaped = false;

  for (let index = callStart; index < source.length; index += 1) {
    const char = source[index];
    if (!char) break;

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }

    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return source.slice(callStart, index + 1);
    }
  }

  throw new Error(`unclosed function call at offset ${callStart}`);
}

function directObservationUpsertCalls(source: string): string[] {
  const calls: string[] = [];
  let markerIndex = 0;
  while ((markerIndex = source.indexOf(observationUpsertPath, markerIndex)) !== -1) {
    const callStart = source.lastIndexOf(".post(", markerIndex);
    assert.notEqual(callStart, -1, `upsert marker without direct .post() call at offset ${markerIndex}`);
    calls.push(extractFunctionCall(source, callStart));
    markerIndex += observationUpsertPath.length;
  }
  return calls;
}

test("production smoke direct observation upserts stay private", async () => {
  const source = await readFile(productionSmokeSpecUrl, "utf8");

  assert.match(
    source,
    /const productionSmokeObservationVisibility = "private" as const;/,
    "production smoke should single-source its observation visibility contract",
  );

  const calls = directObservationUpsertCalls(source);
  assert.ok(calls.length >= 3, "expected production smoke direct observation upsert coverage");

  for (const call of calls) {
    assert.match(
      call,
      /data:\s*{[\s\S]*visibility:\s*productionSmokeObservationVisibility/,
      "direct production smoke observation upserts must explicitly stay private",
    );
    assert.doesNotMatch(
      call,
      /visibility:\s*["']public["']/,
      "direct production smoke observation upserts must not publish public records",
    );
  }
});

test("production smoke write lanes require explicit opt-in scope", async () => {
  const source = await readFile(productionSmokeSpecUrl, "utf8");
  const packageJson = JSON.parse(await readFile(productionPackageUrl, "utf8")) as {
    scripts?: Record<string, string>;
  };
  const privatePostRunner = await readFile(privatePostRunnerUrl, "utf8");
  const privatePostUiRunner = await readFile(privatePostUiRunnerUrl, "utf8");

  assert.match(
    source,
    /function requireProductionSmokeWriteScope\(scope: ProductionSmokeWriteScope\): void/,
    "production smoke write tests should share one explicit scope gate",
  );

  for (const scope of [
    "auth-write",
    "private-post",
    "private-post-ui",
    "shared-production-write",
    "place-memory-write",
    "public-capsule-write",
  ]) {
    assert.match(source, new RegExp(`\\[${scope}\\]`), `write lane should be tagged: ${scope}`);
    assert.match(
      source,
      new RegExp(`requireProductionSmokeWriteScope\\("${scope}"\\)`),
      `write lane should require explicit scope: ${scope}`,
    );
  }

  assert.match(
    packageJson.scripts?.["e2e:production-smoke:read-only"] ?? "",
    /--grep-invert/,
    "read-only production smoke script should exclude write-tagged lanes",
  );
  assert.match(
    packageJson.scripts?.["e2e:production-smoke:private-post"] ?? "",
    /run-production-smoke-private-post\.mjs/,
    "private post production smoke script should set the write scope in one runner",
  );
  assert.match(
    packageJson.scripts?.["e2e:production-smoke:private-post-ui"] ?? "",
    /run-production-smoke-private-post-ui\.mjs/,
    "private post UI production smoke script should set the write scope in one runner",
  );
  assert.match(
    privatePostRunner,
    /PRODUCTION_SMOKE_WRITE_SCOPE:\s*"private-post"/,
    "private post runner must opt in only to the private-post write lane",
  );
  assert.match(
    privatePostUiRunner,
    /PRODUCTION_SMOKE_WRITE_SCOPE:\s*"private-post-ui"/,
    "private post UI runner must opt in only to the private-post-ui write lane",
  );
  assert.match(
    source,
    /test\("\[private-post-ui\][\s\S]*const account = await registerSmokeUser\(context\.request, baseUrl, prefix\);[\s\S]*await context\.setExtraHTTPHeaders\(\{ cookie: account\.sessionCookie \}\);[\s\S]*await addSessionCookieToContext\(context, baseUrl, account\.sessionCookie\);/,
    "private post UI smoke must install the registered session cookie before opening /record",
  );
  assert.match(
    source,
    /test\("\[private-post-ui\][\s\S]*const ownerMapItem = await pollOwnerMapRecord\(context\.request, baseUrl, account, \{[\s\S]*visitId: photoVisitId,/,
    "private post UI smoke should assert the owner map row by visit id without requiring thumbnail async completion",
  );
  assert.doesNotMatch(
    source,
    /decodeURIComponent\(sessionCookie\.slice\(separatorIndex \+ 1\)\)/,
    "production smoke should preserve the signed Set-Cookie value when injecting it into BrowserContext",
  );
});
