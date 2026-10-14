import assert from "node:assert/strict";
import test from "node:test";
import { PERSON_PUBLICATIONS, type PersonPublication } from "../../src/content/personPublications";
import { personPublicationPath, personPublicationResponse, renderPersonPublication } from "./personPublication";
import { publicPortraitBytes } from "./personPortrait";

// Synthetic 4x4 pixel fixtures, not a person's photograph or a production publication.
const images = [
  "UklGRi4AAABXRUJQVlA4ICIAAABwAQCdASoEAAQAAUAmJZQCdAFAAAD+8Gyar++p0HxXwAAA",
  "UklGRlIAAABXRUJQVlA4WAoAAAAQAAAAAwAAAwAAQUxQSAoAAAABB1CyiAhERP8DVlA4ICIAAABwAQCdASoEAAQAAUAmJZQCdAFAAAD+8Gyar++p0HxXwAAA",
  "UklGRh4AAABXRUJQVlA4TBEAAAAvA8AAAAdQrUKVrP+BiOh/AAA=",
  "UklGRh4AAABXRUJQVlA4TBEAAAAvA8AAEAdQrUKVrGSBiOh/AAA=",
].map(value => "data:image/webp;base64," + value);
const person = PERSON_PUBLICATIONS[0]!;
const production = { ENVIRONMENT: "production", IKIMON_GIT_SHA: "a".repeat(40) };
const request = (path: string, method = "GET", origin = "https://zukan.earth") => new Request(origin + path, { method });
const response = (p: PersonPublication, path = personPublicationPath(p), method = "GET") => personPublicationResponse(request(path, method), production, [p])!;

test("existing approved content remains public and no unimplemented offer action is advertised", async () => {
  const r = response(person), html = await r.text();
  assert.equal(r.status, 200);
  assert.match(html, /八巻 毅/u);
  assert.match(html, /本人の意思により公開/u);
  assert.equal((html.match(/<h1>/gu) ?? []).length, 1);
  assert.match(html, /name="robots" content="index,follow"/u);
  assert.doesNotMatch(html, /<form|<button|href="[^"]*(?:offer|login)|workspace_|security_domain_|PRIVATE_SOURCE/u);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.equal(r.headers.get("x-zukan-publication-edition"), person.edition);
});

test("anonymous and alias locators never redirect old name-bearing URLs or expose romanized names", async () => {
  for (const mode of ["anonymous", "alias"] as const) {
    const p = { ...person, identityMode: mode, name: mode === "anonymous" ? "HIDDEN_LEGAL_NAME" : "活動名", latinName: "HIDDEN_LATIN_NAME", discoverability: "unlisted" } as const;
    const path = personPublicationPath(p), r = response(p), html = await r.text();
    assert.equal(path, `/ja/people/person-${person.publicId}`);
    assert.equal(r.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.doesNotMatch(html, /HIDDEN_LEGAL_NAME|HIDDEN_LATIN_NAME/u);
    assert.equal(response(p, personPublicationPath(person)).status, 404);
    if (mode === "anonymous") {
      assert.match(html, /<h1>匿名<\/h1>/u);
      assert.doesNotMatch(html, /https:\/\/ikimon\.co\.jp/u);
    }
  }
});

test("withdrawn and unknown editions remain indistinguishable for page and portrait", async () => {
  const p = { ...person, portrait: { dataUrl: images[0]!, alt: "synthetic" } };
  for (const suffix of ["", "/portrait.webp"]) {
    const path = personPublicationPath(p) + suffix;
    const missing = personPublicationResponse(request(path), production, [])!;
    const withdrawn = response({ ...p, state: "withdrawn" }, path);
    assert.equal(withdrawn.status, 404);
    assert.deepEqual([...withdrawn.headers], [...missing.headers]);
    assert.equal(await withdrawn.text(), await missing.text());
    assert.equal(await response(p, path, "HEAD").text(), "");
  }
});

test("only valid optimized portraits render and their current public route supplies the same bytes", async () => {
  for (const dataUrl of images) {
    assert.ok(publicPortraitBytes(dataUrl));
    const p = { ...person, portrait: { dataUrl, alt: '合成画像 <script>' } };
    const html = await response(p).text();
    assert.match(html, /has-portrait/u);
    assert.match(html, /alt="合成画像 &lt;script&gt;"/u);
    const r = response(p, personPublicationPath(p) + "/portrait.webp");
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("content-type"), "image/webp");
    assert.equal(Buffer.from(await r.arrayBuffer()).toString("base64"), dataUrl.slice(23));
  }
  const p = { ...person, portrait: { dataUrl: "https://example.com/photo.jpg", alt: "" } };
  assert.doesNotMatch(renderPersonPublication(p, false), /<img/u);
  assert.equal(response(p, personPublicationPath(p) + "/portrait.webp").status, 404);
});

test("portrait rejects metadata, animation, trailing bytes, reserved flags and malformed containers", () => {
  const raw = Buffer.from(images[0]!.slice(23), "base64");
  const url = (value: Buffer) => "data:image/webp;base64," + value.toString("base64");
  for (const kind of ["EXIF", "XMP ", "ICCP", "ANIM", "JUNK"]) {
    const chunk = Buffer.concat([Buffer.from(kind), Buffer.from([6, 0, 0, 0]), Buffer.from("SECRET")]);
    const changed = Buffer.concat([raw, chunk]); changed.writeUInt32LE(changed.length - 8, 4);
    assert.equal(publicPortraitBytes(url(changed)), null, kind);
  }
  assert.equal(publicPortraitBytes(url(Buffer.concat([raw, Buffer.from("private tail")]))), null);
  const reserved = Buffer.from(images[1]!.slice(23), "base64"); reserved[20] = reserved[20]! | 1;
  assert.equal(publicPortraitBytes(url(reserved)), null);
  for (const value of [null, "", "data:image/svg+xml,<svg/>", "data:image/webp;base64,xxx", url(Buffer.alloc(300_001))]) assert.equal(publicPortraitBytes(value), null);
});

test("anonymous portrait and identifying portrait URLs are never exposed", async () => {
  const p = { ...person, identityMode: "anonymous", portrait: { dataUrl: images[0]!, alt: "SECRET_LEGAL_NAME" } } as const;
  const html = await response(p).text();
  assert.doesNotMatch(html, /SECRET_LEGAL_NAME|og:image|<img/u);
  assert.equal(response(p, personPublicationPath(p) + "/portrait.webp").status, 404);
});

test("organization publication shares the renderer without taking over legacy organization routes", async () => {
  const p = { ...person, subjectKind: "organization", name: "合成テスト団体" } as const;
  assert.equal(personPublicationPath(p), `/ja/organizations/${p.slug}-${p.publicId}`);
  const html = await response(p).text();
  assert.match(html, /団体の紹介|団体の意思により公開/u);
  assert.equal(personPublicationResponse(request("/ja/organizations/legacy"), production), null);
  assert.equal(response(p, personPublicationPath(person)).status, 404);
});

test("contact preferences preserve priority and explicitly describe tentative availability", async () => {
  const p: PersonPublication = { ...person, collaboration: { accepting: true, salesAccepted: false,
    interests: ["地域での共同企画", "農業とソフトウェア"], availabilityNote: "平日18時以降。土日祝は比較的調整しやすいです。",
    timeZone: "Asia/Tokyo", firstContact: ["email", "online", "in_person"], locationNote: "浜松周辺" } };
  const html = await response(p).text();
  assert.match(html, /メール・オンライン・直接会う/u);
  assert.match(html, /時間帯は目安です。日程・方法は相談して決めます。/u);
  assert.match(html, /営業・売り込みは受け付けていません/u);
  assert.doesNotMatch(html, /mailto:|tel:|zoom\.us|<form|<button/u);
  assert.doesNotMatch(renderPersonPublication({ ...p, collaboration: { ...p.collaboration!, accepting: false } }, false), /person-collaboration-body">/u);
});

test("all supported themes and missing optional content render without empty sections", () => {
  for (const appearance of ["earth", "ink", "blue"] as const) {
    const html = renderPersonPublication({ ...person, appearance, paragraphs: [], activities: [], links: [], latinName: "", headline: "" }, false);
    assert.ok(html.includes(`data-appearance="${appearance}"`));
    assert.doesNotMatch(html, /<section|person-latin"|person-headline"|<img/u);
  }
});

test("text and links remain escaped and only HTTPS links are allowed", () => {
  const p = { ...person, name: '<img src=x onerror="alert(1)">', paragraphs: ["<script>alert(1)</script>"],
    links: [{ label: "bad", href: "javascript:alert(1)" }, { label: "bad", href: "https://u:p@example.com/" }, { label: "<good>", href: "https://example.com/" }], privateSource: "PRIVATE_SOURCE" };
  const html = renderPersonPublication(p, false);
  assert.doesNotMatch(html, /<img|<script|javascript:|https:\/\/u:p|PRIVATE_SOURCE/u);
  assert.match(html, /&lt;img|&lt;script&gt;/u);
  assert.match(html, /&lt;good&gt;/u);
});

test("staging, alternate hosts and absent indexing consent cannot be indexed", async () => {
  for (const [origin, env, p] of [["https://staging.zukan.earth", production, person], ["https://zukan.earth", { ENVIRONMENT: "staging" }, person], ["https://zukan.earth", production, { ...person, discoverability: undefined }]] as const) {
    const r = personPublicationResponse(request(personPublicationPath(p), "GET", origin), env, [p])!;
    assert.equal(r.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.match(await r.text(), /name="robots" content="noindex,nofollow"/u);
  }
});

test("legacy real-name redirects, HTTP method boundaries and contributor routes stay intact", () => {
  const path = personPublicationPath(person);
  for (const suffix of [path + "/", `/ja/people/old-${person.publicId}`]) {
    const r = response(person, suffix); assert.equal(r.status, 308); assert.equal(r.headers.get("location"), path);
  }
  for (const method of ["POST", "PATCH", "PUT", "DELETE"]) assert.equal(response(person, path, method).status, 405);
  for (const path of ["/ja/profile", "/ja/learn", "/api/auth/me", "/ja"]) assert.equal(personPublicationResponse(request(path), production), null);
});
