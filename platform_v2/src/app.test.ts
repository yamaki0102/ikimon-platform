import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "./app.js";

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
    assert.equal(response.headers["content-security-policy"], "base-uri 'self'; object-src 'none'; frame-ancestors 'none'");
    assert.equal(response.headers["strict-transport-security"], undefined);
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
  } finally {
    await app.close();
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
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
