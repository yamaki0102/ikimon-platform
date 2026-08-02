import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

test("native URL-encoded logout clears the session cookie and redirects", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/logout",
      headers: {
        host: "localhost:80",
        origin: "http://localhost",
        "sec-fetch-site": "same-origin",
        "content-type": "application/x-www-form-urlencoded",
      },
      payload: "",
    });

    assert.equal(response.statusCode, 303);
    assert.equal(response.headers.location, "/");
    const setCookie = String(response.headers["set-cookie"] ?? "");
    assert.match(setCookie, /ikimon_v2_session=/);
    assert.match(setCookie, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/i);
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Lax/);
  } finally {
    await app.close();
  }
});

test("cross-site logout is rejected without clearing the cookie", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/logout",
      headers: {
        host: "localhost:80",
        origin: "https://attacker.example",
        "sec-fetch-site": "cross-site",
        "content-type": "application/x-www-form-urlencoded",
      },
      payload: "",
    });

    assert.equal(response.statusCode, 403);
    assert.match(response.body, /same_origin_required|Forbidden/i);
    assert.equal(response.headers["set-cookie"], undefined);
  } finally {
    await app.close();
  }
});

test("GET logout stays unavailable and cannot revoke a session", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/logout" });
    assert.equal(response.statusCode, 404);
    assert.equal(response.headers["set-cookie"], undefined);
  } finally {
    await app.close();
  }
});
