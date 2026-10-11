import assert from "node:assert/strict";
import test from "node:test";
import { PERSON_PUBLICATIONS, type PersonPublication } from "../../src/content/personPublications";
import { personPublicationPath, personPublicationResponse, renderPersonPublication } from "./personPublication";

const person = PERSON_PUBLICATIONS[0]!;
const path = personPublicationPath(person);
const production = { ENVIRONMENT: "production", IKIMON_GIT_SHA: "a".repeat(40) };
const req = (suffix = path, method = "GET", origin = "https://zukan.earth") => new Request(`${origin}${suffix}`, { method });

test("explicit person edition is anonymously readable without account or database lookups", async () => {
  const r = personPublicationResponse(req(), production)!;
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("x-zukan-publication-id"), person.publicId);
  assert.equal(r.headers.get("x-zukan-publication-edition"), person.edition);
  assert.equal(r.headers.get("x-ikimon-deploy-sha"), production.IKIMON_GIT_SHA);
  assert.equal(r.headers.get("cache-control"), "no-store");
  const html = await r.text();
  assert.match(html, /八巻 毅/u);
  assert.match(html, /本人の意思により公開/u);
  assert.match(html, /<html lang="ja">/u);
  assert.match(html, /name="robots" content="index,follow"/u);
  assert.ok(html.includes(`rel="canonical" href="https://zukan.earth${path}"`));
  assert.doesNotMatch(html, /workspace_|security_domain_|root_identity_|mailto:|PRIVATE_SOURCE/u);
});

test("private and absent editions are indistinguishable; HEAD never includes content", async () => {
  const hidden = { ...person, state: "withdrawn" } as const;
  const missing = personPublicationResponse(req(), production, [])!;
  const withdrawn = personPublicationResponse(req(), production, [hidden])!;
  assert.equal(missing.status, 404);
  assert.equal(withdrawn.status, missing.status);
  assert.equal(await withdrawn.text(), await missing.text());
  assert.equal(personPublicationResponse(req(), production, [{ ...person, authority: "unknown" } as unknown as PersonPublication])!.status, 404);
  for (const collection of [[person], []]) assert.equal(await personPublicationResponse(req(path, "HEAD"), production, collection)!.text(), "");
});

test("known ID resolves current slug while contributor and API paths remain unchanged", () => {
  for (const suffix of ["/ja/profile/owner", "/ja/learn", "/api/auth/me", "/ja/organizations/owner", "/ja"]) assert.equal(personPublicationResponse(req(suffix), production), null);
  for (const suffix of [path + "/", `/ja/people/old-slug-${person.publicId}`]) {
    const r = personPublicationResponse(req(suffix), production)!;
    assert.equal(r.status, 308);
    assert.equal(r.headers.get("location"), path);
  }
  for (const suffix of ["/ja/people/unknown", path + "/private", `/ja/people/a-${"0".repeat(32)}`]) assert.equal(personPublicationResponse(req(suffix), production)!.status, 404);
  for (const method of ["POST", "PUT", "DELETE", "PATCH"]) assert.equal(personPublicationResponse(req(path, method), production)!.status, 405);
});

test("staging and alternate origins cannot be indexed", async () => {
  for (const [origin, env] of [["https://staging.zukan.earth", production], ["https://zukan.earth", { ENVIRONMENT: "staging" }], ["https://ikimon-life-cloudflare-staging.yamaki0102.workers.dev", { ENVIRONMENT: "staging" }]] as const) {
    const r = personPublicationResponse(req(path, "GET", origin), env)!;
    assert.equal(r.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.match(await r.text(), /content="noindex,nofollow"/u);
  }
});

test("public rendering escapes text, drops unsafe links, and does not spread private fields", () => {
  const malicious = { ...person, name: '<img src=x onerror="alert(1)">', privateSource: "PRIVATE_SOURCE", paragraphs: ["<script>alert(1)</script>"], links: [{ label: "bad", href: "javascript:alert(1)" }, { label: "credentials", href: "https://user:pass@example.com/" }, { label: "safe", href: "https://ikimon.co.jp/" }] };
  const html = renderPersonPublication(malicious, false);
  assert.doesNotMatch(html, /<script|<img|javascript:|user:pass|PRIVATE_SOURCE/u);
  assert.match(html, /&lt;img/u);
  assert.match(html, /href="https:\/\/ikimon.co.jp\/"/u);
});
