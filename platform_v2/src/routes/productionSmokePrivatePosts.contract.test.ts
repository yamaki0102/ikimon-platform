import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const productionSmokeSpecUrl = new URL("../../e2e/production-smoke.spec.ts", import.meta.url);
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
