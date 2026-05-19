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
