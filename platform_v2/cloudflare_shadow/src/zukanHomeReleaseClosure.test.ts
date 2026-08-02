import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { applyStateSplitHomeResponsive } from "./stateSplitHomeResponsive";
import { hardenSvgResponse, SVG_RESPONSE_CSP } from "./svgResponseSecurity";

const workerSource = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

function sourceBetween(start: string, end: string): string {
  const startIndex = workerSource.indexOf(start);
  const endIndex = workerSource.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0, `${start} must exist`);
  assert.ok(endIndex > startIndex, `${end} must exist after ${start}`);
  return workerSource.slice(startIndex, endIndex);
}

describe("ZUKAN Home release closure", () => {
  test("does not query or replace the removed guest-public slot", () => {
    const injector = sourceBetween("export async function injectStateSplitHome", "async function injectHomeObservationRecords");
    assert.doesNotMatch(injector, /recentPublicRecordCards/);
    assert.doesNotMatch(injector, /guest-public/);
  });

  test("adds nosniff and a restrictive CSP to SVG responses", async () => {
    const original = new Response("<svg/>", { headers: { "content-type": "image/svg+xml; charset=utf-8" } });
    const secured = hardenSvgResponse(original);
    assert.equal(secured.headers.get("x-content-type-options"), "nosniff");
    assert.equal(secured.headers.get("content-security-policy"), SVG_RESPONSE_CSP);
    assert.match(SVG_RESPONSE_CSP, /default-src 'none'/);
    assert.match(SVG_RESPONSE_CSP, /sandbox/);
    assert.equal(await secured.text(), "<svg/>");
  });

  test("keeps non-SVG responses unchanged", () => {
    const original = new Response("ok", { headers: { "content-type": "text/plain" } });
    assert.equal(hardenSvgResponse(original), original);
  });

  for (const count of [0, 1, 2, 3, 5]) {
    test(`injects stable state-split layout rules for ${count} photos`, () => {
      const html = `<html><head></head><body><div data-home-contract="state-split-v1"><div class="home-guest-proof is-count-${count}"></div></div></body></html>`;
      const patched = applyStateSplitHomeResponsive(html);
      assert.match(patched, /id="zukan-home-state-split-release-closure"/);
      assert.ok(patched.includes(`home-guest-proof.is-count-${count}`));
      assert.match(patched, /home-guest-proof\.is-empty img\{display:none\}/);
      assert.match(patched, /home-category-index\{color:var\(--home-green\)\}/);
      assert.match(patched, /focus-visible\{outline:3px solid var\(--home-green\)/);
      assert.doesNotMatch(patched, /イメージ/);
    });
  }
});
