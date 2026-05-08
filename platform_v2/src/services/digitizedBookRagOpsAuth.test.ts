import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("digitized book ops routes are gated to admin sessions or privileged write key", () => {
  const source = readFileSync(path.join(process.cwd(), "src", "routes", "ops.ts"), "utf8");

  assert.match(source, /getSessionFromCookie/);
  assert.match(source, /isAdminOrAnalystRole/);
  assert.match(source, /assertPrivilegedWriteAccess/);
  assert.match(source, /assertDigitizedBooksOpsAccess\(request\)/);
  assert.match(source, /hasDigitizedBooksOpsSession\(request\)/);
  assert.match(source, /\/ops\/digitized-books\/data/);
  assert.match(source, /\/ops\/digitized-books\/rag-data/);
  assert.match(source, /\/ops\/digitized-books\/rag-answer/);
});
