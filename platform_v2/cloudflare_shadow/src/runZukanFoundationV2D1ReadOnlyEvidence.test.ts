import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  parseFoundationD1EvidenceCli,
  verifyFoundationD1SnapshotExportSha256,
  verifyWranglerD1DatabaseIdentity,
  WranglerRemoteReadOnlyD1Database,
} from "./runZukanFoundationV2D1ReadOnlyEvidence.js";

const databaseId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sourceSha = "b".repeat(40);

test("D1 evidence CLI requires exact source and remote target identity", () => {
  assert.throws(
    () => parseFoundationD1EvidenceCli([]),
    /remote_identity_required/,
  );
  assert.throws(
    () => parseFoundationD1EvidenceCli([
      "--remote-database=one",
      "--remote-database=two",
      `--remote-database-id=${databaseId}`,
      `--source-sha=${sourceSha}`,
    ]),
    /remote_database_duplicate/,
  );
});

test("D1 remote mode names an actual remote target, never a local basename", () => {
  const parsed = parseFoundationD1EvidenceCli([
    "--remote-database=ikimon_shadow_core",
    `--remote-database-id=${databaseId}`,
    "--wrangler-bin=node_modules/wrangler/bin/wrangler.js",
    "--wrangler-config=wrangler.jsonc",
    "--tenant=fixture-tenant",
    `--source-sha=${sourceSha}`,
  ]);
  assert.equal(parsed.mode, "remote");
  assert.equal(parsed.remoteDatabaseName, "ikimon_shadow_core");
  assert.equal(parsed.remoteDatabaseId, databaseId);
  assert.equal(parsed.sourceSha, sourceSha);
});

test("D1 snapshot mode requires remote export digest and bookmark provenance", () => {
  assert.throws(() => parseFoundationD1EvidenceCli([
    "--remote-database=ikimon_shadow_core",
    `--remote-database-id=${databaseId}`,
    "--snapshot-database-path=work/export.sqlite",
    `--source-sha=${sourceSha}`,
  ]), /snapshot_provenance_required/);
  const parsed = parseFoundationD1EvidenceCli([
    "--remote-database=ikimon_shadow_core",
    `--remote-database-id=${databaseId}`,
    "--snapshot-database-path=work/export.sqlite",
    `--remote-export-sha256=${"c".repeat(64)}`,
    "--remote-bookmark=bookmark-123",
    `--source-sha=${sourceSha}`,
  ]);
  assert.equal(parsed.mode, "snapshot");
});

test("D1 snapshot mode hashes the actual file and rejects claimed digest mismatch", async () => {
  const databasePath = path.join(
    tmpdir(),
    `zukan-foundation-evidence-${process.pid}-${Date.now()}.sqlite`,
  );
  const content = Buffer.from("remote D1 export fixture");
  const expectedSha256 = createHash("sha256").update(content).digest("hex");
  writeFileSync(databasePath, content, { flag: "wx" });
  try {
    assert.equal(await verifyFoundationD1SnapshotExportSha256({
      databasePath,
      expectedSha256,
    }), expectedSha256);
    await assert.rejects(verifyFoundationD1SnapshotExportSha256({
      databasePath,
      expectedSha256: "0".repeat(64),
    }), /snapshot_sha256_mismatch/);
  } finally {
    unlinkSync(databasePath);
  }
});

test("Wrangler D1 driver only accepts SELECT-family queries and blocks writes", async () => {
  const calls: string[] = [];
  const database = new WranglerRemoteReadOnlyD1Database({
    wranglerBin: "wrangler.js",
    wranglerConfig: "wrangler.jsonc",
    databaseName: "ikimon_shadow_core",
  }, (input) => {
    calls.push(input.sql);
    return JSON.stringify([{ success: true, results: [{ value: 7 }] }]);
  });
  await assert.rejects(database.prepare("SELECT 1").run(), /write_forbidden/);
  await assert.rejects(database.batch(), /batch_forbidden/);
  assert.throws(() => database.prepare("UPDATE anything SET value = 1"), /query_not_read_only/);
  const result = await database.prepare("SELECT ? AS value").bind(7).first<{ value: number }>();
  assert.deepEqual(result, { value: 7 });
  assert.deepEqual(calls, ["SELECT 7 AS value"]);
});

test("Wrangler D1 inventory must bind the configured name to the claimed UUID", () => {
  assert.doesNotThrow(() => verifyWranglerD1DatabaseIdentity({
    rawInfoJson: JSON.stringify({
      uuid: databaseId,
      name: "ikimon_shadow_core",
    }),
    expectedId: databaseId,
    expectedName: "ikimon_shadow_core",
  }));
  assert.throws(() => verifyWranglerD1DatabaseIdentity({
    rawInfoJson: JSON.stringify({
      uuid: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      name: "ikimon_shadow_core",
    }),
    expectedId: databaseId,
    expectedName: "ikimon_shadow_core",
  }), /remote_identity_mismatch/);
  assert.throws(() => verifyWranglerD1DatabaseIdentity({
    rawInfoJson: JSON.stringify({
      uuid: databaseId,
      name: "ikimon_prod_core",
    }),
    expectedId: databaseId,
    expectedName: "ikimon_shadow_core",
  }), /remote_identity_mismatch/);
});
