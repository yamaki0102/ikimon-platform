import assert from "node:assert/strict";
import test from "node:test";
import { withBasePath } from "./httpBasePath.js";

test("withBasePath applies a mount exactly once", () => {
  assert.equal(withBasePath("/preview", "/en/home"), "/preview/en/home");
  assert.equal(withBasePath("/preview", "/preview/en/home"), "/preview/en/home");
  assert.equal(withBasePath("/preview/", "/preview?lang=en"), "/preview?lang=en");
  assert.equal(withBasePath("/preview", "/preview#records"), "/preview#records");
  assert.equal(withBasePath("/preview", "/previewed/en/home"), "/preview/previewed/en/home");
  assert.equal(withBasePath("", "/en/home"), "/en/home");
});
