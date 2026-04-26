import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

async function withEnv(
  overrides: Record<string, string | undefined>,
  run: () => Promise<void>,
): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    await run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("record route exposes quick revisit fields in staging mode", async () => {
  await withEnv(
    {
      ALLOW_QUERY_USER_ID: "1",
    },
    async () => {
      const app = buildApp();
      try {
        const response = await app.inject({
          method: "GET",
          url: "/record?userId=staging-user",
        });

        assert.equal(response.statusCode, 200);
        assert.match(response.body, /あとで見返すためのメモ/);
        assert.match(response.body, /まだ分からないまま残す/);
        assert.match(response.body, /今日は見なかったメモを残す/);
        assert.match(response.body, /次に探すもの/);
        assert.match(response.body, /data-capture-action="photo"/);
        assert.match(response.body, /data-capture-action="video"/);
        assert.match(response.body, /data-capture-action="gallery"/);
        assert.doesNotMatch(response.body, /メモだけ始める/);
      } finally {
        await app.close();
      }
    },
  );
});

test("record route gives unauthenticated visitors a start guide instead of a raw 401", async () => {
  await withEnv(
    {
      ALLOW_QUERY_USER_ID: undefined,
    },
    async () => {
      const app = buildApp();
      try {
        const response = await app.inject({
          method: "GET",
          url: "/record?lang=ja",
          headers: { accept: "text/html" },
        });

        assert.equal(response.statusCode, 200);
        assert.match(response.body, /記録を始める準備/);
        assert.match(response.body, /名前が分からなくても、記録は始められる/);
        assert.match(response.body, /ログインして記録する/);
        assert.match(response.body, /新しく登録して記録する/);
        assert.match(response.body, /redirect=%2Frecord%3Fstart%3Dphoto/);
        assert.doesNotMatch(response.body, /redirect=%2Frecord%3Fstart%3Dnote/);
        assert.doesNotMatch(response.body, /Session required/);
      } finally {
        await app.close();
      }
    },
  );
});

test("record start guide preserves a direct-capture draft through login", async () => {
  await withEnv(
    {
      ALLOW_QUERY_USER_ID: undefined,
    },
    async () => {
      const app = buildApp();
      try {
        const response = await app.inject({
          method: "GET",
          url: "/record?start=photo&draft=1&lang=ja",
          headers: { accept: "text/html" },
        });

        assert.equal(response.statusCode, 200);
        assert.match(response.body, /redirect=%2Frecord%3Fstart%3Dphoto%26draft%3D1%26lang%3Dja/);
      } finally {
        await app.close();
      }
    },
  );
});

test("login and register pages render v2 auth forms", async () => {
  const app = buildApp();
  try {
    const login = await app.inject({
      method: "GET",
      url: "/login?redirect=/record",
      headers: { accept: "text/html" },
    });
    assert.equal(login.statusCode, 200);
    assert.match(login.body, /ログインして記録する/);
    assert.match(login.body, /data-endpoint="\/api\/v1\/auth\/login"/);

    const register = await app.inject({
      method: "GET",
      url: "/register?redirect=/record",
      headers: { accept: "text/html" },
    });
    assert.equal(register.statusCode, 200);
    assert.match(register.body, /新しく登録して記録する/);
    assert.match(register.body, /data-endpoint="\/api\/v1\/auth\/register"/);
  } finally {
    await app.close();
  }
});

test("profile route gives unauthenticated visitors a mypage start guide", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/profile?lang=ja",
      headers: { accept: "text/html" },
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /ログインすると、自分の場所と記録をまとめて見られます/);
    assert.match(response.body, /ログインしてマイページへ/);
    assert.match(response.body, /\/login\?redirect=\/profile/);
  } finally {
    await app.close();
  }
});

test("profile settings route gives unauthenticated visitors a login guide", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/profile/settings?lang=ja",
      headers: { accept: "text/html" },
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /プロフィール編集にはログインが必要です/);
    assert.match(response.body, /\/login\?redirect=\/profile\/settings/);
  } finally {
    await app.close();
  }
});

test("guest profile urls still redirect to guest notebooks", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/profile/guest_route_test?lang=ja",
      headers: { accept: "text/html" },
    });

    assert.equal(response.statusCode, 302);
    assert.equal(response.headers.location, "/guest/guest_route_test?lang=ja");
  } finally {
    await app.close();
  }
});

test("profile self update API requires a signed-in session", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/profile/me",
      headers: {
        "content-type": "application/json",
      },
      payload: {
        displayName: "No Session",
        profileBio: "",
        expertise: "",
      },
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(JSON.parse(response.body), {
      ok: false,
      error: "session_required",
    });
  } finally {
    await app.close();
  }
});

test("www host redirects to apex before OAuth cookies are issued", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/auth/oauth/google/start?redirect=/record",
      headers: {
        host: "www.ikimon.life",
        accept: "text/html",
      },
    });

    assert.equal(response.statusCode, 308);
    assert.equal(response.headers.location, "https://ikimon.life/auth/oauth/google/start?redirect=/record");
    assert.equal(response.headers["set-cookie"], undefined);
  } finally {
    await app.close();
  }
});

test("failed OAuth callback clears OAuth state without logging out an existing session", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/oauth_callback.php?provider=google&state=bad&code=bad",
      headers: {
        cookie: "ikimon_v2_session=keep-me",
      },
    });

    const setCookies = Array.isArray(response.headers["set-cookie"])
      ? response.headers["set-cookie"]
      : [String(response.headers["set-cookie"] ?? "")];
    assert.equal(response.statusCode, 303);
    assert.equal(response.headers.location, "/login?error=oauth");
    assert.ok(setCookies.some((cookie) => cookie.startsWith("ikimon_oauth_state=;")));
    assert.ok(!setCookies.some((cookie) => cookie.startsWith("ikimon_v2_session=;")));
  } finally {
    await app.close();
  }
});

test("cross-site auth mutation returns a controlled 403", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: {
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site",
        "content-type": "application/json",
      },
      payload: {
        email: "nobody@example.invalid",
        password: "wrongwrong",
      },
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(JSON.parse(response.body), {
      ok: false,
      error: "same_origin_required",
    });
  } finally {
    await app.close();
  }
});
