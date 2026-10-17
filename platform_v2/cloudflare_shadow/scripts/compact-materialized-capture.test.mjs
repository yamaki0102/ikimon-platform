import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext, Script } from "node:vm";
import { gzipSync } from "node:zlib";
import Fastify from "fastify";
import { renderSiteDocument } from "../../src/ui/siteShell.ts";
import { runWithCspNonce } from "../../src/services/cspNonce.ts";
import { registerGlobalRecordSourceChoiceHtmlPatch } from "../../src/services/globalRecordSourceChoiceHtmlPatch.ts";
import { applyPublicPresentationPipeline } from "../src/publicPresentationPipeline.ts";
import { compactMaterializedCapture } from "./compact-materialized-capture.mjs";

const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/giu;
function capture(html) {
  return [...html.matchAll(scriptPattern)].find((match) => match[2].includes("const CAMERA_START_TIMEOUT_MS"));
}

for (const lang of ["ja", "en", "es", "pt-BR"]) {
  test(`compaction follows actual inject/onSend patches and preserves ${lang} markup, CSP and Worker capture`, async () => {
    const app = Fastify();
    registerGlobalRecordSourceChoiceHtmlPatch(app);
    app.get("/capture-fixture", (_request, reply) => reply.type("text/html").send(runWithCspNonce("capture-test-nonce", () => renderSiteDocument({
      basePath: "", lang, title: "Capture", body: "<main>Capture</main>", currentPath: `/${lang}/learn/field-loop`,
    }))));
    try {
      const response = await app.inject({ method: "GET", url: "/capture-fixture" });
      assert.equal(response.statusCode, 200);
      const original = response.body;
      assert.match(capture(original)[2], /const REQUIRE_CLOSEUP_FOCUS = true;/u);
      assert.match(original, /data-global-record-input="photo"[^>]*capture="environment"/u);
      const compacted = compactMaterializedCapture(original);
      const before = capture(original);
      const after = capture(compacted);
      // All document bytes outside the selected script body, including every
      // other script, nonce, camera input and translated label, stay identical.
      assert.equal(compacted.replace(after[2], "CAPTURE"), original.replace(before[2], "CAPTURE"));
      assert.equal(after[1], before[1]);
      assert.match(after[1], /nonce="capture-test-nonce"/u);
      assert.match(after[2], /const REQUIRE_CLOSEUP_FOCUS=true;/u);
      assert.doesNotThrow(() => new Script(after[2]));
      assert.ok(Buffer.byteLength(after[2]) < Buffer.byteLength(before[2]) * 0.85);
      assert.ok(gzipSync(after[2]).length < gzipSync(before[2]).length * 0.92);
      assert.equal(compactMaterializedCapture(compacted), compacted);
      const delivered = await applyPublicPresentationPipeline(new Request(`https://zukan.earth/${lang}/learn/field-loop`), new Response(compacted, {
        headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": "script-src 'nonce-capture-test-nonce'" },
      }));
      assert.equal(capture(await delivered.text())[2], after[2]);
      assert.match(delivered.headers.get("content-security-policy"), /nonce-capture-test-nonce/u);
    } finally {
      await app.close();
    }
  });
}

test("non-capture, external and non-classic scripts stay unchanged; ambiguous capture fails closed", () => {
  const fixture = `<script nonce="fixed">const CAMERA_START_TIMEOUT_MS = 10000; const DB_NAME = 'ikimon-record-draft'; const a = '[data-global-record-camera-sheet]'; const b = '[data-global-record-trigger]';</script>`;
  for (const html of ["<p>No capture</p>", '<script>const CAMERA_START_TIMEOUT_MS = 10000;</script>', fixture.replace("<script ", '<script src="/external.js" '), fixture.replace("<script ", '<script type="application/json" ')]) {
    assert.equal(compactMaterializedCapture(html), html);
  }
  assert.throws(() => compactMaterializedCapture(fixture + fixture), /materialized_capture_script_ambiguous/u);
});

test("inline HTML script ends stay escaped without changing string values", () => {
  const source = `const CAMERA_START_TIMEOUT_MS = 10000; const DB_NAME = 'ikimon-record-draft'; const a = '[data-global-record-camera-sheet]'; const b = '[data-global-record-trigger]'; globalThis.result = '</ScRiPt';`;
  const html = compactMaterializedCapture(`<script nonce="fixed">${source}</script>`);
  const script = capture(html)[2];
  assert.doesNotMatch(script, /<\/script/iu);
  const context = {};
  runInNewContext(script, context);
  assert.equal(context.result, "</ScRiPt");
});

test("materializer hashes, stores and reports the final compacted bytes after inject", async () => {
  const source = await readFile(new URL("./materialize-original-ui-html.mjs", import.meta.url), "utf8");
  assert.ok(source.indexOf("const materializedHtml = compactMaterializedCapture(response.body)") > source.indexOf("const response = await app.inject({", source.indexOf("for (const pathname of targets)")));
  assert.match(source, /writeFile\(filePath, materializedHtml, "utf8"\)/u);
  for (const expression of ["Buffer.byteLength(materializedHtml)", "sha256(materializedHtml)", "stableHtmlSha256(materializedHtml)"]) assert.ok(source.includes(expression));
});
