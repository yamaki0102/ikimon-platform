import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("photo upload route returns the shared ok contract on success", () => {
  const source = readFileSync(path.join(process.cwd(), "src/routes/write.ts"), "utf8");

  assert.match(source, /const result = await uploadObservationPhoto\(/);
  assert.match(source, /return \{\s+ok: true,\s+\.\.\.result,\s+\};/);
  assert.match(source, /return \{\s+ok: false,\s+error:/);
});

test("observation upsert returns contribution receipts with the ok contract", () => {
  const source = readFileSync(path.join(process.cwd(), "src/routes/write.ts"), "utf8");

  assert.match(source, /buildContributionReceipts/);
  assert.match(source, /buildRecordFeedbackLoop/);
  assert.match(source, /const contributionReceipts = buildContributionReceipts\(/);
  assert.match(source, /const feedbackLoop = buildRecordFeedbackLoop\(\{ result \}\)/);
  assert.match(source, /contributionReceiptKinds: contributionReceipts\.map/);
  assert.match(source, /feedbackLoopStatus: feedbackLoop\.status/);
  assert.match(source, /return \{\s+ok: true,\s+\.\.\.result,[\s\S]+contributionReceipts,[\s\S]+feedbackLoop,[\s\S]+\};/);
  assert.match(source, /placeMemorySample/);
});

test("auth write mutation gate keeps same-origin on write scope and privileged token issuance", () => {
  const writeSource = readFileSync(path.join(process.cwd(), "src/routes/write.ts"), "utf8");
  const authSource = readFileSync(path.join(process.cwd(), "src/routes/auth.ts"), "utf8");
  const handledRoutesStart = writeSource.indexOf("const AUTH_API_MUTATION_ROUTES_HANDLED_BY_AUTH_ROUTES");
  const handledRoutesEnd = writeSource.indexOf("] as const;", handledRoutesStart);
  const handledRoutesBlock = handledRoutesStart >= 0 && handledRoutesEnd > handledRoutesStart
    ? writeSource.slice(handledRoutesStart, handledRoutesEnd)
    : "";
  const privilegedRoutesStart = writeSource.indexOf("const PRIVILEGED_AUTH_WRITE_ROUTES");
  const privilegedRoutesEnd = writeSource.indexOf("] as const;", privilegedRoutesStart);
  const privilegedRoutesBlock = privilegedRoutesStart >= 0 && privilegedRoutesEnd > privilegedRoutesStart
    ? writeSource.slice(privilegedRoutesStart, privilegedRoutesEnd)
    : "";

  assert.match(writeSource, /AUTH_API_MUTATION_ROUTES_HANDLED_BY_AUTH_ROUTES/);
  assert.match(handledRoutesBlock, /"\/api\/v1\/auth\/login"/);
  assert.match(handledRoutesBlock, /"\/api\/v1\/auth\/register"/);
  assert.doesNotMatch(handledRoutesBlock, /"\/api\/v1\/auth\/session\/issue"/);
  assert.doesNotMatch(handledRoutesBlock, /"\/api\/v1\/auth\/remember-tokens\/issue"/);
  assert.match(writeSource, /if \(!isAuthApiMutationHandledByAuthRoutes\(request\.url\)\) \{\s*assertSameOriginRequest\(request\);/);

  assert.match(writeSource, /PRIVILEGED_AUTH_WRITE_ROUTES/);
  assert.match(privilegedRoutesBlock, /"\/api\/v1\/auth\/session\/issue"/);
  assert.match(privilegedRoutesBlock, /"\/api\/v1\/auth\/remember-tokens\/issue"/);
  assert.match(privilegedRoutesBlock, /"\/api\/v1\/auth\/remember-tokens\/revoke"/);
  assert.match(writeSource, /assertPrivilegedWriteAccess\(request\);/);
  assert.match(writeSource, /"\/api\/v1\/auth\/session\/issue"[\s\S]*assertPrivilegedWriteAccess\(request\);/);
  assert.match(writeSource, /"\/api\/v1\/auth\/remember-tokens\/issue"[\s\S]*assertPrivilegedWriteAccess\(request\);/);
  assert.match(writeSource, /"\/api\/v1\/auth\/remember-tokens\/revoke"[\s\S]*assertPrivilegedWriteAccess\(request\);/);

  assert.match(authSource, /"\/api\/v1\/auth\/login"[\s\S]*assertSameOriginRequest\(request\);[\s\S]*assertAuthRateLimit\(\["login", request\.ip, email \|\| "blank"\]/);
  assert.match(authSource, /"\/api\/v1\/auth\/register"[\s\S]*assertSameOriginRequest\(request\);[\s\S]*assertAuthRateLimit\(\["register", request\.ip, email \|\| "blank"\]/);
});
