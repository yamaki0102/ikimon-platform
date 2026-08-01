import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

function sourceBetween(start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex, `${start} must exist`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `${end} must exist after ${start}`).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe("ZUKAN Home Opus review closure", () => {
  it("does not query or replace the removed guest-public slot", () => {
    const injector = sourceBetween("export async function injectStateSplitHome", "function originalUiVersionPointerKey");
    expect(injector).not.toContain("recentPublicRecordCards");
    expect(injector).not.toContain("guest-public");
  });

  it("hardens materialized SVG responses", () => {
    const staticAssetRoute = sourceBetween("async function getOriginalUiStaticAsset", "async function getVersionedOriginalUiHtml");
    expect(staticAssetRoute).toContain('"x-content-type-options": "nosniff"');
    expect(staticAssetRoute).toContain("content-security-policy");
    expect(staticAssetRoute).toContain("default-src 'none'");
    expect(staticAssetRoute).toContain("sandbox");
  });
});
