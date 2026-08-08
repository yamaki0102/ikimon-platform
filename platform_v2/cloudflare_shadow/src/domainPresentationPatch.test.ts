import assert from "node:assert/strict";
import test from "node:test";
import { patchCanonicalDomainPresentation } from "./domainPresentationPatch";

function htmlResponse(body: string, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", ...headers },
  });
}

test("production presentation rewrites only canonical SEO surfaces to zukan.earth", async () => {
  const body = `<!doctype html><html><head>
<link rel="canonical" href="https://ikimon.life/ja/map" />
<link rel="alternate" hreflang="ja" href="https://www.ikimon.life/ja/map" />
<meta property="og:url" content="https://ikimon.life/ja/map" />
<meta property="og:image" content="https://ikimon.life/assets/og.png" />
<meta name="twitter:image" content="https://ikimon.life/assets/og.png" />
<script type="application/ld+json">{"url":"https://ikimon.life/ja/map","image":"https://ikimon.life/assets/og.png"}</script>
</head><body>
<a href="https://ikimon.life/login">legacy auth link stays host-bound</a>
<script>window.endpoint = "https://ikimon.life/api/v1/session";</script>
</body></html>`;
  const response = await patchCanonicalDomainPresentation(
    new Request("https://ikimon.life/ja/map", { headers: { host: "ikimon.life" } }),
    htmlResponse(body, { link: '<https://ikimon.life/ja/map>; rel="canonical"' }),
    { ENVIRONMENT: "production" },
  );
  const patched = await response.text();

  assert.match(patched, /rel="canonical" href="https:\/\/zukan\.earth\/ja\/map"/);
  assert.match(patched, /rel="alternate" hreflang="ja" href="https:\/\/zukan\.earth\/ja\/map"/);
  assert.match(patched, /property="og:url" content="https:\/\/zukan\.earth\/ja\/map"/);
  assert.match(patched, /property="og:image" content="https:\/\/zukan\.earth\/assets\/og\.png"/);
  assert.match(patched, /"url":"https:\/\/zukan\.earth\/ja\/map"/);
  assert.match(patched, /href="https:\/\/ikimon\.life\/login"/);
  assert.match(patched, /window\.endpoint = "https:\/\/ikimon\.life\/api\/v1\/session"/);
  assert.equal(response.headers.get("link"), '<https://zukan.earth/ja/map>; rel="canonical"');
});

test("staging presentation rewrites recognized SEO origins to staging.zukan.earth", async () => {
  const response = await patchCanonicalDomainPresentation(
    new Request("https://staging.ikimon.life/ja/learn", { headers: { host: "staging.ikimon.life" } }),
    htmlResponse(`
      <link rel="canonical" href="https://ikimon.life/ja/learn" />
      <meta property="og:url" content="https://zukan.earth/ja/learn" />
      <script type="application/ld+json">{"url":"https://staging.ikimon.life/ja/learn"}</script>
    `),
    { ENVIRONMENT: "staging" },
  );
  const patched = await response.text();
  assert.match(patched, /canonical" href="https:\/\/staging\.zukan\.earth\/ja\/learn"/);
  assert.match(patched, /og:url" content="https:\/\/staging\.zukan\.earth\/ja\/learn"/);
  assert.match(patched, /"url":"https:\/\/staging\.zukan\.earth\/ja\/learn"/);
});

test("unknown environments and non-SEO body links fail closed", async () => {
  const source = htmlResponse('<a href="https://ikimon.life/ja/map">map</a>');
  const response = await patchCanonicalDomainPresentation(
    new Request("https://internal-origin.invalid/ja/map"),
    source,
    { ENVIRONMENT: "shadow" },
  );
  assert.strictEqual(response, source);
});

test("non-HTML bodies are preserved while canonical Link headers can be corrected", async () => {
  const response = await patchCanonicalDomainPresentation(
    new Request("https://zukan.earth/robots.txt"),
    new Response("User-agent: *", {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        link: '<https://ikimon.life/sitemap.xml>; rel="canonical"',
      },
    }),
    { ENVIRONMENT: "production" },
  );
  assert.equal(await response.text(), "User-agent: *");
  assert.equal(response.headers.get("link"), '<https://zukan.earth/sitemap.xml>; rel="canonical"');
});
