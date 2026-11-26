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

test("free comments are closed: nothing is rendered, nothing is accepted, old data is not deleted", async () => {
  const html = renderObservationCommentsHtml({
    observationId: "obs_1",
    lang: "ja",
    prefix: "/ja",
    authenticated: true,
    comments: [{ commentId: "cmt_1", observationId: "obs_1", authorUserId: "u1", authorName: "観察者A", body: "きれいな翅ですね", createdAt: "2026-11-25T10:00:00Z" }],
  });
  assert.equal(html, "");

  const unauthRes = await worker.fetch(
    new Request("https://shadow.test/api/v1/observations/obs_1/comments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: "こんにちは" }),
    }),
    {} as any
  );
  assert.equal(unauthRes.status, 401);

  const r2Store = new Map<string, string>([["observation-comments/obs_pub.json", JSON.stringify([{ commentId: "old" }])]]);
  const fakeEnv = {
    OBS_DB: {
      prepare() {
        return { bind() { return { async first() { return { observation_id: "obs_pub", user_id: "owner_1", visibility: "public" }; } }; } };
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
  const closed = await handlePostObservationComment(
    "obs_pub",
    new Request("https://shadow.test/api/v1/observations/obs_pub/comments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: "新しいコメント" }) }),
    { userId: "owner_1", displayName: "本人", banned: false },
    fakeEnv as any
  );
  assert.equal(closed.status, 410);
  assert.equal(((await closed.json()) as { error: string }).error, "comments_closed");
  assert.equal(r2Store.size, 1);
  assert.equal(r2Store.get("observation-comments/obs_pub.json"), JSON.stringify([{ commentId: "old" }]));

  const listed = await handleGetObservationComments("obs_pub", null, fakeEnv as any);
  assert.deepEqual(await listed.json(), { ok: true, comments: [], closed: true });
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

test("handleResolveShareLinkPage redacts note containing phone/personal info and clamps to first line 24 chars", async () => {
  const r2Store = new Map<string, string>();
  const fakeEnv = {
    OBS_DB: {
      prepare() {
        return {
          bind() {
            return {
              async first() {
                return {
                  observation_id: "obs_pii",
                  user_id: "owner_1",
                  visibility: "public",
                  note: "連絡先 090-1234-5678 までお願いします",
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

  const okShare = await handleCreateObservationShareLink(
    "obs_pii",
    { userId: "owner_1", banned: false },
    fakeEnv as any
  );
  const shareBody = (await okShare.json()) as { ok: boolean; token: string };
  const guestPage = await handleResolveShareLinkPage(shareBody.token, "ja", null, fakeEnv as any);
  assert.equal(guestPage.status, 200);
  const html = await guestPage.text();
  assert.doesNotMatch(html, /090-1234-5678/);
  assert.match(html, /生きものの観察記録/);
});
