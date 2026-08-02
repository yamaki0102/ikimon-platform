import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyStateSplitHomeResponsive } from "./stateSplitHomeResponsive";
import { hardenSvgResponse, SVG_RESPONSE_CSP } from "./svgResponseSecurity";

const workerSource = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

function sourceBetween(start: string, end: string): string {
  const startIndex = workerSource.indexOf(start);
  const endIndex = workerSource.indexOf(end, startIndex + start.length);
  expect(startIndex, `${start} must exist`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `${end} must exist after ${start}`).toBeGreaterThan(startIndex);
  return workerSource.slice(startIndex, endIndex);
}

describe("ZUKAN Home release closure", () => {
  it("does not query or replace the removed guest-public slot", () => {
    const injector = sourceBetween("export async function injectStateSplitHome", "function originalUiVersionPointerKey");
    expect(injector).not.toContain("recentPublicRecordCards");
    expect(injector).not.toContain("guest-public");
  });

  it("adds nosniff and a restrictive CSP to SVG responses", async () => {
    const original = new Response("<svg/>", { headers: { "content-type": "image/svg+xml; charset=utf-8" } });
    const secured = hardenSvgResponse(original);
    expect(secured.headers.get("x-content-type-options")).toBe("nosniff");
    expect(secured.headers.get("content-security-policy")).toBe(SVG_RESPONSE_CSP);
    expect(SVG_RESPONSE_CSP).toContain("default-src 'none'");
    expect(SVG_RESPONSE_CSP).toContain("sandbox");
    expect(await secured.text()).toBe("<svg/>");
  });

  it("keeps non-SVG responses unchanged", () => {
    const original = new Response("ok", { headers: { "content-type": "text/plain" } });
    expect(hardenSvgResponse(original)).toBe(original);
  });

  it.each([0, 1, 2, 3, 5])("injects stable state-split layout rules for %i photos", (count) => {
    const html = `<html><head></head><body><div data-home-contract="state-split-v1"><div class="home-guest-proof is-count-${count}"></div></div></body></html>`;
    const patched = applyStateSplitHomeResponsive(html);
    expect(patched).toContain('id="zukan-home-state-split-release-closure"');
    expect(patched).toContain(`home-guest-proof.is-count-${count}`);
    expect(patched).toContain("home-guest-proof.is-empty img{display:none}");
    expect(patched).not.toContain("イメージ");
  });
});
