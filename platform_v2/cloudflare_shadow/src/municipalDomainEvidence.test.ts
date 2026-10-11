import assert from "node:assert/strict";
import test from "node:test";
import { findMunicipality } from "../../src/services/municipalityDirectory";
import {
  MUNICIPAL_DOMAIN_EVIDENCE_LIMITS,
  officialMailboxDomain,
  resolveOfficialMailboxDomain,
} from "./municipalDomainEvidence";

const rumoi = findMunicipality("012122")!;
const hamamatsu = findMunicipality("221309")!;
const html = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, { headers: { "content-type": "text/html; charset=utf-8", ...headers } });
function fixture(pages: Record<string, Response | (() => Response)>) {
  const requests: { url: string; init: RequestInit | undefined }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    requests.push({ url, init });
    const page = pages[url];
    return typeof page === "function" ? page() : page?.clone() ?? new Response(null, { status: 404 });
  };
  return { fetcher, requests };
}

test("custom official site publishes exact mailbox domain through its own contact page", async () => {
  const f = fixture({
    [rumoi.website]: html('<a href="/contact.html">お問い合わせ</a>'),
    "https://www.e-rumoi.jp/contact.html": html('<p>留萌市</p><a href="mailto:info@e-rumoi.jp">担当窓口</a>'),
  });
  const before = Date.now();
  const evidence = await resolveOfficialMailboxDomain(rumoi, "person@E-RUMOI.JP", f.fetcher);
  assert.equal(evidence?.domain, "e-rumoi.jp");
  assert.equal(evidence?.sourceUrl, "https://www.e-rumoi.jp/contact.html");
  assert.ok(Date.parse(evidence!.verifiedAt) >= before);
  assert.equal(f.requests.length, 2);
  for (const request of f.requests) {
    assert.equal(request.init?.method, "GET");
    assert.equal(request.init?.redirect, "manual");
    assert.equal(request.init?.credentials, "omit");
    assert.equal(request.init?.referrerPolicy, "no-referrer");
    assert.ok(request.init?.signal);
    assert.ok(!JSON.stringify(request).includes("person@"));
  }
});

test("an exact published government namespace alias is eligible; other local-government domains are not", async () => {
  const f = fixture({
    [rumoi.website]: html('<a href="/soshiki/">組織案内</a>'),
    "https://www.e-rumoi.jp/soshiki/": html('<a href="mailto:info@city.rumoi.lg.jp?subject=contact">留萌市</a>'),
  });
  assert.equal((await resolveOfficialMailboxDomain(rumoi, "office@city.rumoi.lg.jp", f.fetcher))?.domain, "city.rumoi.lg.jp");
  const other = fixture({ [rumoi.website]: html('<a href="mailto:info@city.hamamatsu.shizuoka.jp">外部窓口</a>') });
  assert.equal(await resolveOfficialMailboxDomain(rumoi, "office@city.hamamatsu.shizuoka.jp", other.fetcher), null);
  assert.equal(other.requests.length, 0);
  // Miyagi's catalog website uses pref.miyagi.jp; its .lg.jp mail alias must
  // not be treated as an unknown government domain belonging to another city.
  const crossFamily = fixture({ [rumoi.website]: html('<a href="mailto:desk@pref.miyagi.lg.jp">県の問い合わせ先</a>') });
  assert.equal(await resolveOfficialMailboxDomain(rumoi, "employee@pref.miyagi.lg.jp", crossFamily.fetcher), null);
  assert.equal(crossFamily.requests.length, 0);
  const invented = fixture({ [rumoi.website]: html('<a href="mailto:desk@city.unrelated.lg.jp">外部窓口</a>') });
  assert.equal(await resolveOfficialMailboxDomain(rumoi, "employee@city.unrelated.lg.jp", invented.fetcher), null);
  assert.equal(invented.requests.length, 0);
});

test("published department subdomain is exact evidence and does not grant arbitrary sibling domains", async () => {
  const f = fixture({
    [hamamatsu.website]: () => html('<a href="mailto:desk@environment.city.hamamatsu.shizuoka.jp">担当課</a>'),
  });
  assert.ok(await resolveOfficialMailboxDomain(hamamatsu, "employee@environment.city.hamamatsu.shizuoka.jp", f.fetcher));
  assert.equal(await resolveOfficialMailboxDomain(hamamatsu, "employee@unpublished.city.hamamatsu.shizuoka.jp", f.fetcher), null);
  assert.equal(await resolveOfficialMailboxDomain(hamamatsu, "employee@environment.city.hamamatsu.shizuoka.jp.evil.com", f.fetcher), null);
});

test("only normal www-equivalent redirects and HTTPS upgrades can be followed", async () => {
  const f = fixture({
    [rumoi.website]: new Response(null, { status: 301, headers: { location: "http://e-rumoi.jp/contact" } }),
    "https://e-rumoi.jp/contact": html('<a href="mailto:info@e-rumoi.jp">留萌市</a>'),
  });
  assert.ok(await resolveOfficialMailboxDomain(rumoi, "person@e-rumoi.jp", f.fetcher));
  assert.deepEqual(f.requests.map(r => r.url), [rumoi.website, "https://e-rumoi.jp/contact"]);
  for (const target of ["https://evil.com/contact", "https://mail.e-rumoi.jp/contact", "http://127.0.0.1/contact", "https://www.e-rumoi.jp.evil.com", "https://www.e-rumoi.jp:8443/contact"]) {
    const denied = fixture({ [rumoi.website]: new Response(null, { status: 302, headers: { location: target } }) });
    assert.equal(await resolveOfficialMailboxDomain(rumoi, "a@e-rumoi.jp", denied.fetcher), null);
    assert.equal(denied.requests.length, 1, target);
  }
});

test("external, internal IP, credential, alternate-scheme and arbitrary-subdomain contact links are ignored", async () => {
  const links = [
    "https://127.0.0.1/contact", "https://[::1]/contact", "https://2130706433/contact",
    "https://169.254.169.254/contact", "https://localhost/contact", "//evil.com/contact",
    "https://www.e-rumoi.jp@evil.com/contact", "https://www.e-rumoi.jp/contact@evil.com",
    "https://other.e-rumoi.jp/contact", "javascript:alert(1)", "data:text/html,contact",
    "file:///contact", "https://www.e-rumoi.jp:8443/contact", "https://www.e-rumoi.jp\\@evil.com/contact",
  ];
  const f = fixture({
    [rumoi.website]: html(links.map(url => '<a href="' + url + '">お問い合わせ</a>').join("") +
      '<a href="/real-contact">お問い合わせ</a>'),
    "https://www.e-rumoi.jp/real-contact": html('<a href="mailto:info@e-rumoi.jp">連絡先</a>'),
  });
  assert.ok(await resolveOfficialMailboxDomain(rumoi, "a@e-rumoi.jp", f.fetcher));
  assert.ok(f.requests.every(request => new URL(request.url).hostname === "www.e-rumoi.jp"));
  assert.ok(f.requests.length <= 4);
});

test("applicant-supplied website objects cannot redirect the authority lookup", async () => {
  const f = fixture({});
  assert.equal(await resolveOfficialMailboxDomain({ ...rumoi, website: "https://attacker.com/" }, "a@e-rumoi.jp", f.fetcher), null);
  assert.equal(await resolveOfficialMailboxDomain({ ...rumoi, code: "999999" }, "a@e-rumoi.jp", f.fetcher), null);
  assert.equal(f.requests.length, 0);
});

test("shared mail providers, detached hosting, ISP and company domains never become municipal domain grants", async () => {
  const f = fixture({ [rumoi.website]: () => html('<a href="mailto:anything@gmail.com">留萌市</a>') });
  for (const domain of ["gmail.com", "outlook.jp", "yahoo.co.jp", "tenant.github.io", "town.pages.dev", "company.co.jp", "town.ne.jp", "town.gr.jp", "localhost", "127.0.0.1"]) {
    assert.equal(await resolveOfficialMailboxDomain(rumoi, "person@" + domain, f.fetcher), null, domain);
  }
  assert.equal(f.requests.length, 0);
});

test("literal mailto target is required; body text, query headers, attributes, scripts, comments and foreign content are not evidence", async () => {
  const content = [
    "info@e-rumoi.jp",
    '<a href="mailto:?to=info@e-rumoi.jp">mail</a>',
    '<a href="mailto:other@unrelated.com?body=info@e-rumoi.jp">mail</a>',
    '<div data-mailto="info@e-rumoi.jp">留萌市</div>',
    '<!-- <a href="mailto:info@e-rumoi.jp">fake</a> -->',
    '<script>const x = \'<a href="mailto:info@e-rumoi.jp">fake</a>\';</script>',
    '<style>x::after {content:\'<a href="mailto:info@e-rumoi.jp">\';}</style>',
    '<textarea><a href="mailto:info@e-rumoi.jp">fake</a></textarea>',
    '<template><a href="mailto:info@e-rumoi.jp">fake</a></template>',
    '<svg><a href="mailto:info@e-rumoi.jp">fake</a></svg>',
    '<math><a href="mailto:info@e-rumoi.jp">fake</a></math>',
    '<div title=\'<a href="mailto:info@e-rumoi.jp">\'>quoted</div>',
    '<a href="mailto:other@unrelated.com" href="mailto:info@e-rumoi.jp">ambiguous</a>',
    '<a href="mailto:info%40e-rumoi.jp">encoded</a>',
    '<a href="mailto:info@e-rumoi.jp,another@e-rumoi.jp">multiple</a>',
  ];
  for (const body of content) {
    const f = fixture({ [rumoi.website]: html(body) });
    assert.equal(await resolveOfficialMailboxDomain(rumoi, "person@e-rumoi.jp", f.fetcher), null, body);
  }
});

test("strict ASCII mailbox parsing rejects spoofing, controls, homographs and ambiguous forms before any fetch", async () => {
  const f = fixture({});
  for (const email of [
    "person@e-rumoi.jp.evil.com", "person@ｅ-rumoi.jp", "person@e-rumoі.jp",
    "person@xn--e-rumoi.jp", "person@e-rumoi。jp", "person＠e-rumoi.jp",
    "person@e-rumoi.jp\n", "person@e-rumoi.jp\r\nBcc:other@evil.com",
    "person\u0000@e-rumoi.jp", " person@e-rumoi.jp", "person@e-rumoi.jp ",
    '"person"@e-rumoi.jp', "Name <person@e-rumoi.jp>", "person@e-rumoi.jp.",
    "person@@e-rumoi.jp", "person@e-rumoi.jp@evil.com", ".person@e-rumoi.jp",
  ]) assert.equal(await resolveOfficialMailboxDomain(rumoi, email, f.fetcher), null, email);
  assert.equal(officialMailboxDomain("Office+local@E-RUMOI.JP"), "e-rumoi.jp");
  assert.equal(f.requests.length, 0);
});

test("request budget includes redirects and does not crawl an unbounded organization directory", async () => {
  const f = fixture({
    [rumoi.website]: html(Array.from({ length: 20 }, (_, i) => '<a href="/contact/' + i + '">お問い合わせ</a>').join("")),
    ...Object.fromEntries(Array.from({ length: 20 }, (_, i) => ["https://www.e-rumoi.jp/contact/" + i, () => html('<a href="/department/' + i + '">組織</a>')])),
  });
  assert.equal(await resolveOfficialMailboxDomain(rumoi, "person@e-rumoi.jp", f.fetcher), null);
  assert.equal(f.requests.length, MUNICIPAL_DOMAIN_EVIDENCE_LIMITS.requests);
  const redirects = fixture(Object.fromEntries(Array.from({ length: 10 }, (_, i) => [
    i === 0 ? rumoi.website : "https://www.e-rumoi.jp/redirect/" + i,
    () => new Response(null, { status: 302, headers: { location: "/redirect/" + (i + 1) } }),
  ])));
  assert.equal(await resolveOfficialMailboxDomain(rumoi, "person@e-rumoi.jp", redirects.fetcher), null);
  assert.equal(redirects.requests.length, 4);
});

test("oversize advertised or streamed pages and non-HTML responses yield no evidence", async () => {
  const huge = '<a href="mailto:info@e-rumoi.jp">mail</a>' + " ".repeat(MUNICIPAL_DOMAIN_EVIDENCE_LIMITS.pageBytes);
  for (const response of [
    html('<a href="mailto:info@e-rumoi.jp">mail</a>', { "content-length": String(MUNICIPAL_DOMAIN_EVIDENCE_LIMITS.pageBytes + 1) }),
    html(huge),
    new Response('<a href="mailto:info@e-rumoi.jp">mail</a>', { headers: { "content-type": "text/plain" } }),
    new Response('<a href="mailto:info@e-rumoi.jp">mail</a>', { status: 500, headers: { "content-type": "text/html" } }),
  ]) {
    const f = fixture({ [rumoi.website]: response });
    assert.equal(await resolveOfficialMailboxDomain(rumoi, "person@e-rumoi.jp", f.fetcher), null);
  }
});

test("timeout aborts stalled network or body and fails closed even if the fetch adapter ignores AbortSignal", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signal: AbortSignal | null | undefined;
  const stalled: typeof fetch = async (_input, init) => { signal = init?.signal; return new Promise<Response>(() => undefined); };
  const pending = resolveOfficialMailboxDomain(rumoi, "a@e-rumoi.jp", stalled);
  t.mock.timers.tick(MUNICIPAL_DOMAIN_EVIDENCE_LIMITS.timeoutMilliseconds);
  assert.equal(await pending, null);
  assert.equal(signal?.aborted, true);
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({ pull: () => new Promise<void>(() => undefined), cancel() { cancelled = true; } });
  const fetching: typeof fetch = async () => new Response(body, { headers: { "content-type": "text/html" } });
  const reading = resolveOfficialMailboxDomain(rumoi, "a@e-rumoi.jp", fetching);
  await Promise.resolve(); await Promise.resolve();
  t.mock.timers.tick(MUNICIPAL_DOMAIN_EVIDENCE_LIMITS.timeoutMilliseconds);
  assert.equal(await reading, null);
  assert.equal(cancelled, true);
});

test("network failure and a fetch adapter that silently followed redirects return no evidence", async () => {
  const rejected: typeof fetch = async () => { throw new Error("network unavailable"); };
  assert.equal(await resolveOfficialMailboxDomain(rumoi, "a@e-rumoi.jp", rejected), null);
  const response = html('<a href="mailto:info@e-rumoi.jp">mail</a>');
  Object.defineProperty(response, "redirected", { value: true });
  const redirected: typeof fetch = async () => response;
  assert.equal(await resolveOfficialMailboxDomain(rumoi, "a@e-rumoi.jp", redirected), null);
});
