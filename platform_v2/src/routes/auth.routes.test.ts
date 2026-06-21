import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("register redirect moves a bare record redirect to photo start", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/register?redirect=/record",
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /data-redirect="\/record\?start=photo"/);
    assert.match(response.body, /\/login\?redirect=%2Frecord%3Fstart%3Dphoto/);
  } finally {
    await app.close();
  }
});

test("login redirect moves a bare record redirect to photo start", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/login?redirect=/record",
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /data-redirect="\/record\?start=photo"/);
    assert.match(response.body, /\/register\?redirect=%2Frecord%3Fstart%3Dphoto/);
  } finally {
    await app.close();
  }
});

test("register redirect preserves explicit record modes and non-record destinations", async () => {
  const cases = [
    {
      url: "/register?redirect=/record%3Fstart%3Dnote",
      redirect: "/record?start=note",
    },
    {
      url: "/register?redirect=/record%3Fstart%3Dphoto%26draft%3D1",
      redirect: "/record?start=photo&amp;draft=1",
    },
    {
      url: "/register?redirect=/records",
      redirect: "/records",
    },
    {
      url: "/register?redirect=/profile",
      redirect: "/profile",
    },
  ];

  for (const testCase of cases) {
    const app = buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: testCase.url,
      });

      assert.equal(response.statusCode, 200);
      assert.match(response.body, new RegExp(`data-redirect="${escapeRegex(testCase.redirect)}"`));
    } finally {
      await app.close();
    }
  }
});

test("register self-redirect protection still lands on the record photo start", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/register?redirect=/login",
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /data-redirect="\/record\?start=photo"/);
  } finally {
    await app.close();
  }
});
