import assert from "node:assert/strict";
import test from "node:test";
import { withBasePath } from "./httpBasePath.js";

test("withBasePath applies a mount exactly once", () => {
  assert.equal(withBasePath("/preview", "/en/kubiaka/me"), "/preview/en/kubiaka/me");
  assert.equal(withBasePath("/preview", "/preview/en/kubiaka/me"), "/preview/en/kubiaka/me");
  assert.equal(withBasePath("/preview/", "/preview?lang=en"), "/preview?lang=en");
  assert.equal(withBasePath("/preview", "/preview#records"), "/preview#records");
  assert.equal(withBasePath("/preview", "/previewed/en/kubiaka/me"), "/preview/previewed/en/kubiaka/me");
  assert.equal(withBasePath("", "/en/kubiaka/me"), "/en/kubiaka/me");
});
