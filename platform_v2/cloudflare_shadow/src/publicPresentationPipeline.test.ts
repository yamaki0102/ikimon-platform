import assert from "node:assert/strict";
import test from "node:test";
import { renderSiteDocument } from "../../src/ui/siteShell";
import { enforceCameraFirstHomeCta } from "./cameraFirstHomeCta";
import { enforcePostCaptureValueLoopCompatibility } from "./postCaptureValueLoopCompatibilityPatch";
import { enhancePostCaptureValueLoop } from "./postCaptureValueLoopPatch";
import { ensurePublicDesignFoundation } from "./publicDesignFoundation";
import { polishPublicHomeUx } from "./publicHomeUxPolish";
import { patchPublicHomePresentation } from "./publicPresentationPatch";
import { applyPublicPresentationPipeline } from "./publicPresentationPipeline";
import { ensureStateSplitHomeResponsive } from "./stateSplitHomeResponsive";

async function previousPipeline(request: Request, response: Response): Promise<Response> {
  const presented = await patchPublicHomePresentation(request, response);
  const camera = await enforceCameraFirstHomeCta(request, presented);
  const polished = await polishPublicHomeUx(request, camera);
  const responsive = await ensureStateSplitHomeResponsive(polished);
  const valueLoop = await enhancePostCaptureValueLoop(request, responsive);
  const compatible = await enforcePostCaptureValueLoopCompatibility(request, valueLoop);
  return ensurePublicDesignFoundation(request, compatible);
}

const documents = [
  '<!doctype html><html lang="ja"><head></head><body><main data-home-contract="state-split-v1"><h1>地域の記録</h1></main></body></html>',
  '<!doctype html><html lang="en"><head></head><body><main data-observation-first-record-detail><h1>Record</h1><script nonce="old">void 0;</script></main></body></html>',
  renderSiteDocument({ basePath: "", title: "ZUKAN", body: "<h1>地域の文化と記録</h1>" }),
];
const headers = { "content-type": "text/html; charset=utf-8", "content-length": "123", etag: '"before"',
  "last-modified": "Tue, 13 Oct 2026 00:00:00 GMT", "cache-control": "private, no-store",
  "content-security-policy": "default-src 'self'; script-src 'nonce-current'", "vary": "cookie, authorization" };

test("one-read presentation preserves the existing pipeline bytes, status and headers", async () => {
  for (const path of ["/", "/ja/", "/en/home", "/es/", "/pt-br/", "/records", "/record", "/map", "/observations/example", "/community/events", "/profile", "/api/debug"]) {
    for (const status of [200, 404, 503]) {
      for (const body of documents) {
        const request = new Request(`https://zukan.earth${path}`);
        const expected = await previousPipeline(request, new Response(body, { status, headers }));
        const actual = await applyPublicPresentationPipeline(request, new Response(body, { status, headers }));
        assert.equal(actual.status, expected.status, path);
        assert.deepEqual([...actual.headers], [...expected.headers], `${path} ${status}`);
        assert.equal(await actual.text(), await expected.text(), `${path} ${status}`);
      }
    }
  }
});

test("HEAD and POST preserve the former method and nonce boundaries", async () => {
  for (const method of ["HEAD", "POST"]) {
    const request = new Request("https://zukan.earth/", { method });
    const body = method === "HEAD" ? null : documents[0];
    const expected = await previousPipeline(request, new Response(body, { headers }));
    const actual = await applyPublicPresentationPipeline(request, new Response(body, { headers }));
    assert.deepEqual([...actual.headers], [...expected.headers]);
    assert.equal(await actual.text(), await expected.text());
  }
});

test("a public home response is decoded once instead of seven times", async () => {
  const read = Response.prototype.text;
  let reads = 0;
  Response.prototype.text = function () { reads += 1; return read.call(this); };
  try {
    const request = new Request("https://zukan.earth/");
    await previousPipeline(request, new Response(documents[0], { headers }));
    assert.equal(reads, 7);
    reads = 0;
    await applyPublicPresentationPipeline(request, new Response(documents[0], { headers }));
    assert.equal(reads, 1);
  } finally { Response.prototype.text = read; }
});

test("non-HTML and server failures keep their original streaming response", async () => {
  for (const response of [Response.json({ ok: true }), new Response("unavailable", { status: 503, headers }), new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } })]) {
    const actual = await applyPublicPresentationPipeline(new Request("https://zukan.earth/"), response);
    assert.equal(actual, response);
    assert.equal(response.bodyUsed, false);
  }
});
