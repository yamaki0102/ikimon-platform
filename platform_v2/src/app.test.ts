import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "./app.js";
import { createContactProof } from "./services/contactSubmit.js";

test("app accepts photo upload JSON bodies up to the v2 photo preflight envelope", async () => {
  const app = buildApp();
  try {
    assert.equal(app.initialConfig.bodyLimit, 40 * 1024 * 1024);
  } finally {
    await app.close();
  }
});

test("app sends browser security headers on every response", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/sw.js" });
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.equal(response.headers["x-frame-options"], "SAMEORIGIN");
    assert.equal(response.headers["referrer-policy"], "strict-origin-when-cross-origin");
    assert.equal(response.headers["x-permitted-cross-domain-policies"], "none");
    assert.equal(response.headers["origin-agent-cluster"], "?1");
    assert.equal(
      response.headers["permissions-policy"],
      "camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), serial=(), bluetooth=(), browsing-topics=()",
    );
    const csp = String(response.headers["content-security-policy"] ?? "");
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /script-src 'self' 'nonce-[^']+' https:\/\/cdn\.jsdelivr\.net https:\/\/unpkg\.com/);
    assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
    assert.match(csp, /script-src[\s\S]*https:\/\/scripts\.clarity\.ms/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /form-action 'self'/);
    assert.match(csp, /connect-src 'self'[\s\S]*https:\/\/nominatim\.openstreetmap\.org/);
    assert.match(csp, /connect-src 'self'[\s\S]*https:\/\/tiles\.openfreemap\.org/);
    assert.match(csp, /font-src 'self'[\s\S]*https:\/\/tiles\.openfreemap\.org/);
    assert.match(csp, /connect-src 'self'[\s\S]*https:\/\/www\.google\.com/);
    assert.match(csp, /connect-src 'self'[\s\S]*https:\/\/\*\.google-analytics\.com/);
    assert.match(csp, /connect-src 'self'[\s\S]*https:\/\/\*\.analytics\.google\.com/);
    assert.match(csp, /connect-src 'self'[\s\S]*https:\/\/upload\.videodelivery\.net/);
    assert.match(csp, /connect-src 'self'[\s\S]*https:\/\/upload\.cloudflarestream\.com/);
    assert.match(csp, /frame-src 'self' https:\/\/iframe\.videodelivery\.net/);
    assert.equal(response.headers["strict-transport-security"], undefined);
  } finally {
    await app.close();
  }
});

test("root HTML scripts carry the CSP nonce from the response header", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/" });
    const csp = String(response.headers["content-security-policy"] ?? "");
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
    assert.ok(nonce);
    const escapedNonce = nonce.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const scriptTags = response.body.match(/<script\b[^>]*>/g) ?? [];
    assert.ok(scriptTags.length > 0);
    for (const tag of scriptTags) {
      assert.match(tag, new RegExp(`\\bnonce="${escapedNonce}"`));
    }
    assert.doesNotMatch(response.body, /<script\b(?![^>]*\bnonce=)/);
  } finally {
    await app.close();
  }
});

test("preview media proxy stays disabled on the public production host", async () => {
  const previousOrigin = process.env.IKIMON_PUBLIC_MEDIA_ORIGIN;
  process.env.IKIMON_PUBLIC_MEDIA_ORIGIN = "https://ikimon.life";
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/__preview-media/uploads/example.jpg",
      headers: { host: "ikimon.life" },
    });
    assert.equal(response.statusCode, 404);
  } finally {
    await app.close();
    if (previousOrigin === undefined) {
      delete process.env.IKIMON_PUBLIC_MEDIA_ORIGIN;
    } else {
      process.env.IKIMON_PUBLIC_MEDIA_ORIGIN = previousOrigin;
    }
  }
});

test("canonical www host redirect still short-circuits with security headers", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/records?view=public",
      headers: { host: "www.ikimon.life" },
    });
    assert.equal(response.statusCode, 308);
    assert.equal(response.headers.location, "https://ikimon.life/records?view=public");
    const csp = String(response.headers["content-security-policy"] ?? "");
    assert.match(csp, /script-src 'self' 'nonce-[^']+'/);
  } finally {
    await app.close();
  }
});

test("legacy service worker cleanup also clears app shell caches", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/sw.js" });
    assert.equal(response.statusCode, 200);
    assert.match(String(response.headers["cache-control"] ?? ""), /no-store/);
    assert.match(response.body, /registration\.unregister/);
    assert.match(response.body, /'ikimon-app-'/);
  } finally {
    await app.close();
  }
});

test("app returns the site shell 404 for browser navigations", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/settings",
      headers: { accept: "text/html" },
    });

    assert.equal(response.statusCode, 404);
    assert.match(String(response.headers["content-type"] ?? ""), /^text\/html/);
    assert.match(response.body, /ページが見つかりません/);
    assert.doesNotMatch(response.body, /"error":"not_found"/);
  } finally {
    await app.close();
  }
});

test("app keeps JSON 404 for API clients", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/not-a-route",
      headers: { accept: "application/json" },
    });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.json(), { ok: false, error: "not_found" });
  } finally {
    await app.close();
  }
});

test("app sends HSTS in production", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/sw.js" });
    assert.equal(response.headers["strict-transport-security"], "max-age=31536000; includeSubDomains");
    assert.match(String(response.headers["content-security-policy"] ?? ""), /upgrade-insecure-requests/);
  } finally {
    await app.close();
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});

test("root route serves the state-split guest home HTML even for generic accept headers", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/",
      headers: { accept: "*/*" },
    });
    assert.equal(response.statusCode, 200);
    assert.match(String(response.headers["content-type"] ?? ""), /^text\/html/);
    assert.doesNotMatch(response.body, /"status":"bootstrapping"/);
    assert.match(response.body, /<title>地域の記録から始める \| ZUKAN<\/title>/);
    assert.doesNotMatch(response.body, /<h1 id="prototype-topa-heading">みんなで作る地域図鑑<\/h1>/);
    assert.doesNotMatch(response.body, /class="me-enjoy-strip"/);
    assert.doesNotMatch(response.body, /landing:topA:primary:record/);
    assert.doesNotMatch(response.body, /ぽち/);
    assert.doesNotMatch(response.body, /写真、動画、音、短いメモ/);
    assert.doesNotMatch(response.body, /地域の記録を探す/);
    assert.doesNotMatch(response.body, /日常でいい/);
    assert.doesNotMatch(response.body, /分類は後でいい/);
    assert.doesNotMatch(response.body, /マップは道具/);
    assert.doesNotMatch(response.body, /prototype-topa-trust/);
    assert.doesNotMatch(response.body, /prototype-topa-metrics/);
    assert.doesNotMatch(response.body, /prototype-topa-actions/);
    assert.match(response.body, /data-home-contract="state-split-v1"/);
    assert.match(response.body, /data-home-auth-state="guest"/);
    assert.match(response.body, /撮ると、まちの今が図鑑になる。/);
    assert.doesNotMatch(response.body, /<section class="home-section home-(?:category|value)-section"/);
    assert.match(response.body, /場所から見る/);
    assert.match(response.body, /みんなの活動を見る/);
    assert.match(response.body, /正確な位置は公開しません/);
    assert.doesNotMatch(response.body, /<h1>記録を見る<\/h1>/);
    assert.match(response.body, /class="site-header site-header-home"/);
    assert.match(response.body, /class="global-record-launcher"/);
    assert.match(response.body, /data-global-record-trigger="photo"/);
    assert.doesNotMatch(response.body, /data-global-record-trigger="photo"[^>]*href="[^"]*\/record/);
    assert.doesNotMatch(response.body, /<nav class="desktop-side-nav-inner"/);
    assert.doesNotMatch(response.body, /使い方を見る/);
    assert.doesNotMatch(response.body, /公開前に安全側で確認します/);
    assert.doesNotMatch(response.body, /id="map-explorer"/);
    assert.doesNotMatch(response.body, /tile\.openstreetmap\.org/);
    assert.doesNotMatch(response.body, /ikimon-topa-map-mini/);
  } finally {
    await app.close();
  }
});

test("contact submit endpoint is rate-limited before mail or database work", async () => {
  const app = buildApp();
  try {
    for (let i = 0; i < 5; i += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/contact/submit",
        remoteAddress: "203.0.113.10",
        payload: { category: "invalid", message: "hello contact" },
      });
      assert.equal(response.statusCode, 400);
    }

    const limited = await app.inject({
      method: "POST",
      url: "/api/v1/contact/submit",
      remoteAddress: "203.0.113.10",
      payload: { category: "invalid", message: "hello contact" },
    });
    assert.equal(limited.statusCode, 429);
  } finally {
    await app.close();
  }
});

test("contact page renders bot traps and a signed contact proof", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/contact?lang=ja" });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.match(response.body, /name="website"/);
    assert.match(response.body, /name="spamTrap"/);
    assert.match(response.body, /name="contactProof" type="hidden" value="v1\./);
  } finally {
    await app.close();
  }
});

test("contact submit endpoint rejects direct posts without a contact proof", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/contact/submit",
      remoteAddress: "203.0.113.11",
      payload: { category: "question", message: "hello contact" },
    });
    assert.equal(response.statusCode, 400);
    assert.deepEqual(JSON.parse(response.body), { ok: false, error: "contact_antispam_failed" });
  } finally {
    await app.close();
  }
});

test("contact submit endpoint rejects freshly minted bot-speed contact proofs", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/contact/submit",
      remoteAddress: "203.0.113.12",
      payload: { category: "question", message: "hello contact", contactProof: createContactProof() },
    });
    assert.equal(response.statusCode, 400);
    assert.deepEqual(JSON.parse(response.body), { ok: false, error: "contact_antispam_failed" });
  } finally {
    await app.close();
  }
});

test("contact submit endpoint accepts aged contact proofs before normal validation", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/contact/submit",
      remoteAddress: "203.0.113.13",
      payload: {
        category: "invalid",
        message: "hello contact",
        contactProof: createContactProof(Date.now() - 3_000),
      },
    });
    assert.equal(response.statusCode, 400);
    assert.deepEqual(JSON.parse(response.body), { ok: false, error: "invalid_category" });
  } finally {
    await app.close();
  }
});

test("contact submit endpoint drops honeypot submissions before mail or database work", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/contact/submit",
      remoteAddress: "203.0.113.20",
      payload: {
        category: "partnership",
        organization: "Bot Organization",
        email: "bot@example.com",
        website: "https://spam.example",
        message: "外来種情報の受信連携相談",
      },
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), {
      ok: true,
      submissionId: "",
      notificationSent: false,
      autoReplySent: false,
    });
  } finally {
    await app.close();
  }
});
