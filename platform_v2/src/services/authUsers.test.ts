import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import { normalizeLegacyBcryptHash, verifyPasswordAgainstHash } from "./authUsers.js";

test("legacy $2y$ bcrypt hashes are verified as $2b$", async () => {
  const hash = await bcrypt.hash("correct horse battery staple", 12);
  const legacyHash = `$2y$${hash.slice(4)}`;
  assert.equal(normalizeLegacyBcryptHash(legacyHash).startsWith("$2b$"), true);
  assert.equal(await verifyPasswordAgainstHash("correct horse battery staple", legacyHash), true);
  assert.equal(await verifyPasswordAgainstHash("wrong password", legacyHash), false);
});
