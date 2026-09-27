import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const materializerSource = await readFile(
  fileURLToPath(new URL("../scripts/materialize-original-ui-html.mjs", import.meta.url)),
  "utf8",
);

test("materialization report exposes the exact source SHA at the top level", () => {
  assert.match(materializerSource, /const result = \{[\s\S]*sourceSha: materializationSourceSha,/u);
});

test("staging signed gateway requires durable exact pointer prewrite and finalize readback", () => {
  const stateIndex = materializerSource.indexOf('await gatewayRequest({ op: "state" })');
  const prewriteIndex = materializerSource.indexOf('op: "prewrite"', stateIndex);
  const prewriteStateIndex = materializerSource.indexOf('op: "prewrite-state"', prewriteIndex);
  const putIndex = materializerSource.indexOf('op: "put"', prewriteStateIndex);
  assert.ok(stateIndex >= 0 && stateIndex < prewriteIndex && prewriteIndex < prewriteStateIndex && prewriteStateIndex < putIndex);
  assert.match(materializerSource, /source_sha: materializationSourceSha/u);
  assert.match(materializerSource, /validateStagingPointerSnapshot\(state\.current_pointer\)/u);
  assert.match(materializerSource, /validateStagingPrewriteResponse\(prewrite, expectedPreviousPointer\)/u);
  assert.match(materializerSource, /validateStagingPrewriteResponse\(prewriteState, expectedPreviousPointer\)/u);
  assert.match(materializerSource, /prewrite_receipt:/u);
  assert.match(materializerSource, /persistPrewriteEvidence\(`\$\{outputPath\}\.prewrite\.json`, stagingPrewrite\)/u);
  assert.match(materializerSource, /expected_previous_pointer:/u);
  assert.match(materializerSource, /require_pointer_readback: true/u);
  assert.match(materializerSource, /validateStagingPointerReadback\(manifestUpload\.pointer_readback/u);
  assert.match(materializerSource, /persistPostwriteEvidence\(`\$\{outputPath\}\.postwrite\.json`/u);
  assert.doesNotMatch(materializerSource, /open\(`\$\{outputPath\}\.prewrite\.json`, "w"\)/u);
  assert.match(materializerSource, /open\(path, "wx", 0o600\)/u);
  assert.match(materializerSource, /staging_pointer_snapshot_digest_mismatch/u);
  assert.match(materializerSource, /staging_prewrite_evidence_output_required/u);
  assert.match(materializerSource, /error\.kind = errorCode\.endsWith\("_cas_mismatch"\) \? "cas_mismatch"/u);
  assert.match(materializerSource, /error\.retryable = response\.status === 429 \|\| response\.status >= 500/u);
});

test("staging materializer sends state, prewrite, readback, then PUT and finalize receipt to a mock gateway", async () => {
  const calls: Array<Record<string, any>> = [];
  const sourceSha = "a".repeat(40);
  const accountId = "089a2d3bdee8858689ae8de1e8232899";
  const currentPointer = {
    account_id: accountId,
    bucket: "ikimon-shadow-media",
    key: "original-ui/current/staging.json",
    exists: false,
    body_base64: null,
    sha256: null,
  };
  let receipt: Record<string, any> | null = null;
  let receiptSha256 = "";
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    calls.push(body);
    let payload: Record<string, any>;
    if (body.op === "state") {
      payload = { ok: true, current_manifest_hash: "", same_manifest: false, completed: [], current_pointer: currentPointer };
    } else if (body.op === "prewrite") {
      receipt = {
        schema: "ikimon.r2-pointer-prewrite/v1",
        job_id: body.job_id,
        run_id: body.run_id,
        target_env: "staging",
        source_sha: body.source_sha,
        manifest_hash: body.manifest_hash,
        pointer: body.expected_previous_pointer,
      };
      receiptSha256 = createHash("sha256").update(JSON.stringify(receipt)).digest("hex");
      payload = { ok: true, status: "recorded", receipt_key: `original-ui/prewrite/${body.run_id}.json`, receipt_sha256: receiptSha256, receipt };
    } else if (body.op === "prewrite-state") {
      payload = { ok: true, status: "readback", receipt_key: `original-ui/prewrite/${body.run_id}.json`, receipt_sha256: receiptSha256, receipt };
    } else if (body.op === "put") {
      payload = { ok: true, status: "updated", key: body.key, sha256: body.sha256 };
    } else if (body.op === "checkpoint") {
      payload = { ok: true, checkpoint_count: body.completed.length };
    } else if (body.op === "finalize") {
      const pointerBody = JSON.stringify({
        schema: "ikimon.r2-materialization/v1",
        manifest_hash: body.manifest_hash,
        version_prefix: `original-ui/versions/${body.manifest_hash}`,
        item_count: body.items.length,
        materialization_summary: body.summary,
      });
      const pointerBytes = Buffer.from(pointerBody, "utf8");
      payload = {
        ok: true,
        status: "finalized",
        version_prefix: `original-ui/versions/${body.manifest_hash}`,
        item_count: body.items.length,
        pointer_readback: {
          ...currentPointer,
          exists: true,
          body_base64: pointerBytes.toString("base64"),
          sha256: createHash("sha256").update(pointerBytes).digest("hex"),
          manifest_hash: body.manifest_hash,
        },
      };
    } else {
      payload = { ok: false, error: "unexpected_operation" };
      response.statusCode = 400;
    }
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(payload));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const tempDir = await mkdtemp(join(tmpdir(), "zukan-prewrite-contract-"));
  const outputPath = join(tempDir, "materialize.json");
  const scriptPath = fileURLToPath(new URL("../scripts/materialize-original-ui-html.mjs", import.meta.url));
  const tsxPath = fileURLToPath(new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url));
  try {
    await execFileAsync(process.execPath, [
      tsxPath,
      scriptPath,
      "--execute",
      "--approval",
      "APPROVE_IKIMON_CF_STAGING_WORKER_DEPLOY",
      "--target-env",
      "staging",
      "--scope",
      "core",
      "--concurrency",
      "1",
      "--output",
      outputPath,
    ], {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      env: {
        ...process.env,
        IKIMON_OPS_JOB_ID: "ops-aaaaaaaaaaaaaaaa",
        IKIMON_EXPECTED_GIT_SHA: sourceSha,
        IKIMON_STAGING_MATERIALIZATION_JOB_SECRET: "mock-secret",
        IKIMON_R2_MATERIALIZATION_API_URL: `http://127.0.0.1:${address.port}`,
      },
      maxBuffer: 20 * 1024 * 1024,
    });
    const report = JSON.parse(await readFile(outputPath, "utf8"));
    assert.equal(report.ok, true);
    assert.deepEqual(calls.slice(0, 4).map((call) => call.op), ["state", "prewrite", "prewrite-state", "put"]);
    assert.ok(calls.some((call) => call.op === "finalize"));
    assert.ok(calls.every((call) => call.source_sha === sourceSha));
    const finalize = calls.find((call) => call.op === "finalize");
    assert.deepEqual(finalize.prewrite_receipt, { run_id: "ops-aaaaaaaaaaaaaaaa", receipt_sha256: receiptSha256 });
    assert.deepEqual(finalize.expected_previous_pointer, currentPointer);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
