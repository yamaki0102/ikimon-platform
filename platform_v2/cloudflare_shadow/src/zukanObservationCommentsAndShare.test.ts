import assert from "node:assert/strict";
import test from "node:test";
import worker from "./index";
import {
  handleCreateObservationShareLink,
  handleGetObservationComments,
  handlePostObservationComment,
  handleResolveShareLinkPage,
  renderObservationCommentsHtml,
} from "./zukanObservationCommentsAndShare";

test("renderObservationCommentsHtml renders D5 comments and guest login prompt", () => {
  const html = renderObservationCommentsHtml({
    observationId: "obs_1",
    lang: "ja",
    prefix: "/ja",
    authenticated: false,
    comments: [
      {
        commentId: "cmt_1",
        observationId: "obs_1",
        authorUserId: "u1",
        authorName: "観察者A",
        body: "きれいな翅ですね",
        createdAt: "2026-11-25T10:00:00Z",
      },
    ],
  });
  assert.match(html, /data-detail-comments="d5"/);
  assert.match(html, /きれいな翅ですね/);
  assert.match(html, /href="\/ja\/login"/);
});

test("POST /api/v1/observations/:id/comments enforces 401/403 and ignores client author", async () => {
  const unauthRes = await worker.fetch(
    new Request("https://shadow.test/api/v1/observations/obs_1/comments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: "こんにちは" }),
    }),
    {} as any
  );
  assert.equal(unauthRes.status, 401);

  const r2Store = new Map<string, string>();
  const fakeEnv = {
    OBS_DB: {
      prepare() {
        return {
          bind() {
            return {
              async first() {
                return {
                  observation_id: "obs_priv",
                  user_id: "owner_1",
                  visibility: "private",
                  note: "メモ",
                  observed_at: "2026-11-25T10:00:00Z",
                };
              },
            };
          },
        };
      },
    },
    ASSET_BUCKET: {
      async get(key: string) {
        const val = r2Store.get(key);
        return val ? { body: new Response(val).body } : null;
      },
      async put(key: string, val: string) {
        r2Store.set(key, val);
      },
    },
  };

  const otherForbidden = await handlePostObservationComment(
    "obs_priv",
    new Request("https://shadow.test/api/v1/observations/obs_priv/comments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: "他人の非公開記録へ" }),
    }),
    { userId: "other_user", displayName: "他人", banned: false },
    fakeEnv as any
  );
  assert.equal(otherForbidden.status, 403);

  const ownerOk = await handlePostObservationComment(
    "obs_priv",
    new Request("https://shadow.test/api/v1/observations/obs_priv/comments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        authorUserId: "spoofed_id",
        authorName: "なりすまし",
        body: "自分のメモコメント",
      }),
    }),
    { userId: "owner_1", displayName: "本人", banned: false },
    fakeEnv as any
  );
  assert.equal(ownerOk.status, 201);
  const body = (await ownerOk.json()) as { ok: boolean; comment: { authorUserId: string; authorName: string } };
  assert.equal(body.ok, true);
  assert.equal(body.comment.authorUserId, "owner_1");
  assert.equal(body.comment.authorName, "本人");

  const getForbidden = await handleGetObservationComments(
    "obs_priv",
    { userId: "other_user", banned: false },
    fakeEnv as any
  );
  assert.equal(getForbidden.status, 403);
});

test("Share link creation (owner-only 401/403) and D8 guest resolution work for public records", async () => {
  const r2Store = new Map<string, string>();
  const fakeEnv = {
    OBS_DB: {
      prepare() {
        return {
          bind() {
            return {
              async first() {
                return {
                  observation_id: "obs_pub",
                  user_id: "owner_1",
                  visibility: "public",
                  note: "公開のアゲハ",
                  observed_at: "2026-11-25T10:00:00Z",
                };
              },
            };
          },
        };
      },
    },
    ASSET_BUCKET: {
      async get(key: string) {
        const val = r2Store.get(key);
        return val ? { body: new Response(val).body } : null;
      },
      async put(key: string, val: string) {
        r2Store.set(key, val);
      },
    },
  };

  const unauthShare = await handleCreateObservationShareLink("obs_pub", null, fakeEnv as any);
  assert.equal(unauthShare.status, 401);

  const otherShare = await handleCreateObservationShareLink(
    "obs_pub",
    { userId: "other_user", banned: false },
    fakeEnv as any
  );
  assert.equal(otherShare.status, 403);

  const okShare = await handleCreateObservationShareLink(
    "obs_pub",
    { userId: "owner_1", banned: false },
    fakeEnv as any
  );
  assert.equal(okShare.status, 201);
  const shareBody = (await okShare.json()) as { ok: boolean; token: string };
  assert.equal(shareBody.ok, true);

  const guestPage = await handleResolveShareLinkPage(
    shareBody.token,
    "ja",
    null,
    fakeEnv as any
  );
  assert.equal(guestPage.status, 200);
  const html = await guestPage.text();
  assert.match(html, /data-share-guest-view="d8"/);
  assert.match(html, /公開のアゲハ/);
  assert.match(html, /href="\/ja\/login"/);
});
