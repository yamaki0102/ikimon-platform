import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { patchLightPostingHtml, registerLightPostingHtmlPatch } from "./lightPostingHtmlPatch.js";

test("light posting patch removes passive awaiting-ID pressure from normal cards", () => {
  const html = `<article class="obs-card">
    <a class="obs-card-media" href="/observations/1">
      <span class="obs-card-sketch-name">名前待ち</span>
      <div class="obs-card-species is-awaiting"><span class="obs-card-species-label">名前待ち</span></div>
    </a>
    <footer>
      <div class="obs-card-place"></div>
      <div class="obs-card-actions">
        <a href="/observations/1#identify">名前を手伝う</a>
      </div>
    </footer>
  </article>`;

  const patched = patchLightPostingHtml(html);

  assert.doesNotMatch(patched, /is-awaiting/);
  assert.doesNotMatch(patched, /名前待ち/);
  assert.doesNotMatch(patched, /名前を手伝う/);
  assert.doesNotMatch(patched, /obs-card-actions/);
  assert.doesNotMatch(patched, /obs-card-place/);
  assert.match(patched, /obs-card-media/);
});

test("light posting patch removes passive labels from the materialized root feed", () => {
  const html = `<section class="prototype-record-feed">
    <article class="prototype-record-feed-card">
      <span class="prototype-record-feed-copy"><strong>名前待ち</strong></span>
      <span class="prototype-record-feed-badge">名前待ちの写真</span>
    </article>
    <div class="prototype-guest-home-stats"><span><strong>12</strong><small>名前確認中</small></span></div>
    <div class="prototype-guest-home-notes"><span>名前は後で確かめる</span></div>
  </section>`;

  const patched = patchLightPostingHtml(html);

  assert.doesNotMatch(patched, /名前待ち/);
  assert.doesNotMatch(patched, /名前確認中/);
  assert.doesNotMatch(patched, /名前は後で確かめる/);
  assert.match(patched, /prototype-record-feed-card/);
});

test("light posting patch preserves identification cues when the caller keeps the dedicated lane", () => {
  const html = `<article class="obs-card">
    <div class="obs-card-species is-awaiting"><span>名前待ち</span></div>
    <div class="obs-card-actions"><a href="/observations/1#identify">名前を手伝う</a></div>
  </article>`;

  const patched = patchLightPostingHtml(html, { suppressPassiveIdentification: false });

  assert.match(patched, /is-awaiting/);
  assert.match(patched, /名前待ち/);
  assert.match(patched, /名前を手伝う/);
});

test("light posting hook suppresses passive identification on localized feeds but keeps needs-id review", async () => {
  const app = Fastify();
  registerLightPostingHtmlPatch(app);
  const card = `<article class="obs-card"><div class="obs-card-species is-awaiting"><span>名前待ち</span></div></article>`;
  app.get("/ja/records", async (_request, reply) => reply.type("text/html").send(card));

  try {
    const feed = await app.inject({ method: "GET", url: "/ja/records?view=public" });
    assert.equal(feed.statusCode, 200);
    assert.doesNotMatch(feed.body, /名前待ち/);

    const review = await app.inject({ method: "GET", url: "/ja/records?view=needs_id" });
    assert.equal(review.statusCode, 200);
    assert.match(review.body, /名前待ち/);
  } finally {
    await app.close();
  }
});

test("materialization injection patches routes registered before the hook", async () => {
  const app = Fastify();
  const rootHtml = `<article class="prototype-record-feed-card"><span class="prototype-record-feed-copy"><strong>名前待ち</strong></span></article>`;
  const card = `<article class="obs-card"><div class="obs-card-species is-awaiting"><span>名前待ち</span></div><div class="obs-card-actions"><a href="/observations/1#identify">名前を手伝う</a></div></article>`;
  app.get("/", async (_request, reply) => reply.type("text/html").send(rootHtml));
  app.get("/records", async (_request, reply) => reply.type("text/html").send(card));

  registerLightPostingHtmlPatch(app);

  try {
    const root = await app.inject({ method: "GET", url: "/" });
    assert.equal(root.statusCode, 200);
    assert.doesNotMatch(root.body, /名前待ち/);

    const publicFeed = await app.inject({ method: "GET", url: "/records?view=public" });
    assert.equal(publicFeed.statusCode, 200);
    assert.doesNotMatch(publicFeed.body, /名前待ち|名前を手伝う/);

    const review = await app.inject({ method: "GET", url: "/records?view=needs_id" });
    assert.equal(review.statusCode, 200);
    assert.match(review.body, /名前待ち/);
    assert.match(review.body, /名前を手伝う/);
  } finally {
    await app.close();
  }
});

test("light posting patch keeps specialist review while removing the passive identify link", () => {
  const html = `<div class="obs-card-actions">
    <a href="/observations/1#identify">Identify</a>
    <a href="/specialist/id-workbench?occurrenceId=1">専門レビュー</a>
  </div>`;

  const patched = patchLightPostingHtml(html);

  assert.doesNotMatch(patched, />Identify<\/a>/);
  assert.match(patched, /専門レビュー/);
  assert.match(patched, /obs-card-actions/);
});
