import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { buildApp } from "./app.js";
import { createContactProof } from "./services/contactSubmit.js";

async function withTestServer(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
  run: (origin: string) => Promise<void>,
): Promise<void> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function withShadowProxyEnv(origin: string, run: () => Promise<void>): Promise<void> {
  const previousEnabled = process.env.CLOUDFLARE_SHADOW_PROXY_ENABLED;
  const previousOrigin = process.env.CLOUDFLARE_SHADOW_PROXY_ORIGIN;
  process.env.CLOUDFLARE_SHADOW_PROXY_ENABLED = "1";
  process.env.CLOUDFLARE_SHADOW_PROXY_ORIGIN = origin;
  try {
    await run();
  } finally {
    if (previousEnabled === undefined) {
      delete process.env.CLOUDFLARE_SHADOW_PROXY_ENABLED;
    } else {
      process.env.CLOUDFLARE_SHADOW_PROXY_ENABLED = previousEnabled;
    }
    if (previousOrigin === undefined) {
      delete process.env.CLOUDFLARE_SHADOW_PROXY_ORIGIN;
    } else {
      process.env.CLOUDFLARE_SHADOW_PROXY_ORIGIN = previousOrigin;
    }
  }
}

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
    assert.match(csp, /script-src 'self' 'unsafe-inline' https:\/\/cdn\.jsdelivr\.net https:\/\/unpkg\.com/);
    assert.match(csp, /script-src[\s\S]*https:\/\/scripts\.clarity\.ms/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /form-action 'self'/);
    assert.match(csp, /connect-src 'self'[\s\S]*https:\/\/nominatim\.openstreetmap\.org/);
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

test("cloudflare shadow proxy is disabled unless explicitly configured", async () => {
  const previousEnabled = process.env.CLOUDFLARE_SHADOW_PROXY_ENABLED;
  const previousOrigin = process.env.CLOUDFLARE_SHADOW_PROXY_ORIGIN;
  delete process.env.CLOUDFLARE_SHADOW_PROXY_ENABLED;
  delete process.env.CLOUDFLARE_SHADOW_PROXY_ORIGIN;
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/cloudflare-shadow/health",
      headers: { host: "staging.ikimon.life", accept: "application/json" },
    });
    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.json(), { ok: false, error: "not_found" });
  } finally {
    await app.close();
    if (previousEnabled === undefined) {
      delete process.env.CLOUDFLARE_SHADOW_PROXY_ENABLED;
    } else {
      process.env.CLOUDFLARE_SHADOW_PROXY_ENABLED = previousEnabled;
    }
    if (previousOrigin === undefined) {
      delete process.env.CLOUDFLARE_SHADOW_PROXY_ORIGIN;
    } else {
      process.env.CLOUDFLARE_SHADOW_PROXY_ORIGIN = previousOrigin;
    }
  }
});

test("cloudflare shadow proxy forwards staging-base-path requests without leaking basic auth", async () => {
  await withTestServer((request, response) => {
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(JSON.stringify({
      ok: true,
      method: request.method,
      url: request.url,
      authorization: request.headers.authorization ?? null,
      marker: request.headers["x-ikimon-shadow-proxy"] ?? null,
      userAgent: request.headers["user-agent"] ?? null,
    }));
  }, async (origin) => {
    await withShadowProxyEnv(origin, async () => {
      const app = buildApp();
      try {
        const response = await app.inject({
          method: "GET",
          url: "/cloudflare-shadow/api/v1/map/cells?bbox=137.8,34.6,137.9,34.8",
          headers: {
            host: "staging.ikimon.life",
            accept: "application/json",
            authorization: "Basic should-not-forward",
            "user-agent": "Python-urllib/3.12",
          },
        });

        assert.equal(response.statusCode, 200);
        assert.equal(response.headers["x-ikimon-shadow-proxy"], "1");
        assert.deepEqual(response.json(), {
          ok: true,
          method: "GET",
          url: "/api/v1/map/cells?bbox=137.8,34.6,137.9,34.8",
          authorization: null,
          marker: "platform-v2-staging",
          userAgent: "ikimon-platform-v2-staging-shadow-proxy/1.0",
        });
      } finally {
        await app.close();
      }
    });
  });
});

test("cloudflare shadow proxy forwards JSON bodies and upstream cookies for contract rehearsal", async () => {
  await withTestServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.setHeader("set-cookie", "ikimon_shadow_session=abc; Path=/; HttpOnly; SameSite=Lax");
      response.end(JSON.stringify({
        ok: true,
        method: request.method,
        url: request.url,
        contentType: request.headers["content-type"] ?? null,
        body: JSON.parse(body),
      }));
    });
  }, async (origin) => {
    await withShadowProxyEnv(origin, async () => {
      const app = buildApp();
      try {
        const response = await app.inject({
          method: "POST",
          url: "/cloudflare-shadow/api/v1/auth/session/issue",
          headers: {
            host: "staging.ikimon.life",
            accept: "application/json",
            "content-type": "application/json",
          },
          payload: {
            userId: "shadow-staging-user",
            ttlHours: 1,
          },
        });

        assert.equal(response.statusCode, 200);
        assert.equal(response.headers["x-ikimon-shadow-proxy"], "1");
        assert.match(String(response.headers["set-cookie"] ?? ""), /ikimon_shadow_session=abc/);
        assert.deepEqual(response.json(), {
          ok: true,
          method: "POST",
          url: "/api/v1/auth/session/issue",
          contentType: "application/json",
          body: {
            userId: "shadow-staging-user",
            ttlHours: 1,
          },
        });
      } finally {
        await app.close();
      }
    });
  });
});

test("cloudflare shadow proxy forwards binary video bodies for staging upload rehearsal", async () => {
  await withTestServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    request.on("end", () => {
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.end(JSON.stringify({
        ok: true,
        method: request.method,
        url: request.url,
        contentType: request.headers["content-type"] ?? null,
        bytes: Buffer.concat(chunks).byteLength,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    });
  }, async (origin) => {
    await withShadowProxyEnv(origin, async () => {
      const app = buildApp();
      try {
        const response = await app.inject({
          method: "PUT",
          url: "/cloudflare-shadow/api/v1/videos/stream_test/body",
          headers: {
            host: "staging.ikimon.life",
            accept: "application/json",
            "content-type": "video/mp4",
          },
          payload: Buffer.from("staging-video-bytes"),
        });

        assert.equal(response.statusCode, 200);
        assert.equal(response.headers["x-ikimon-shadow-proxy"], "1");
        assert.deepEqual(response.json(), {
          ok: true,
          method: "PUT",
          url: "/api/v1/videos/stream_test/body",
          contentType: "video/mp4",
          bytes: 19,
          body: "staging-video-bytes",
        });
      } finally {
        await app.close();
      }
    });
  });
});

test("cloudflare shadow proxy stays disabled on public production hosts", async () => {
  await withTestServer((_request, response) => {
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ ok: true }));
  }, async (origin) => {
    await withShadowProxyEnv(origin, async () => {
      const app = buildApp();
      try {
        const response = await app.inject({
          method: "GET",
          url: "/cloudflare-shadow/health",
          headers: { host: "ikimon.life", accept: "application/json" },
        });
        assert.equal(response.statusCode, 404);
        assert.deepEqual(response.json(), { ok: false, error: "not_found" });
      } finally {
        await app.close();
      }
    });
  });
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

test("root route serves the landing HTML even for generic accept headers", async () => {
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
    assert.match(response.body, /ikimon\.life/);
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
