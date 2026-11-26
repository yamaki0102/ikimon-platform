import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test, { type TestContext } from "node:test";
import ts from "typescript";

const genScript = resolve("scripts/gen-flags.mjs");
const rolloutScript = resolve("scripts/rollout.mjs");
const outputs = ["src/flags/index.generated.ts", "wrangler.jsonc", "docs/PROTOTYPE_FLAGS.md"];
const runNode = (script: string, root: string, ...args: string[]) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
const gen = (root: string, ...args: string[]) => runNode(genScript, root, ...args);
const rollout = (root: string, ...args: string[]) => runNode(rolloutScript, root, ...args);
const parse = (text: string): any => {
  const result = ts.parseConfigFileTextToJson("config.jsonc", text);
  assert.equal(result.error, undefined);
  return result.config;
};
const definition = (flag: string, staging: boolean, production: boolean, extra = "") => `export const flag = ${JSON.stringify(flag)};\nexport const feature = "試作";\nexport const lane = "lane";\nexport const path = "/ja/";\nexport const staging = ${staging};\nexport const production = ${production};\n${extra}`;
const read = (root: string, path: string) => readFile(join(root, path), "utf8");
const readAll = (root: string) => Promise.all(outputs.map(path => read(root, path)));

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "zukan-flags-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of [...outputs, "src/flags/index.generated.ts"]) {
    await mkdir(join(root, path, ".."), { recursive: true });
    await cp(resolve(path), join(root, path));
  }
  return root;
}

test("generated flag outputs in the repository are current and idempotent", async t => {
  const current = gen(process.cwd(), "--check");
  assert.equal(current.status, 0, current.stdout + current.stderr);
  const root = await fixture(t);
  const before = await readAll(root);
  assert.equal(gen(root).status, 0);
  assert.equal(gen(root).status, 0);
  assert.deepEqual(await readAll(root), before);
});

test("an empty registry generates no flag variables and keeps the config intact", async t => {
  const root = await fixture(t);
  const config = parse(await read(root, "wrangler.jsonc"));
  assert.equal(config.env.production.vars.ZUKAN_FEATURE_ROLLOUTS, "{}");
  assert.equal(JSON.stringify(parse(await read(process.cwd(), "wrangler.jsonc"))), JSON.stringify(config));
  assert.match(await read(root, "src/flags/index.generated.ts"), /PROTOTYPE_FLAGS = \[\n\] as const/u);
});

test("adding flag files updates every projection deterministically and idempotently", async t => {
  const root = await fixture(t);
  const before = await readAll(root);
  await writeFile(join(root, "src/flags/zz_new_flag_v1.ts"), definition("zz_new_flag_v1", false, true));
  await writeFile(join(root, "src/flags/aa_new_flag_v1.ts"), definition("aa_new_flag_v1", true, false, "export const scopes = [\"wrangler.jsonc:env.staging.vars\"] as const;\n"));
  assert.notEqual(gen(root, "--check").status, 0);
  const generated = gen(root);
  assert.equal(generated.status, 0, generated.stdout + generated.stderr);
  const first = await readAll(root);
  assert.ok(first[0]!.indexOf("aa_new_flag_v1") < first[0]!.indexOf("zz_new_flag_v1"));
  assert.match(first[2]!, /\| aa_new_flag_v1 \| 試作 \| lane \| \/ja\/ \|\n\| zz_new_flag_v1 \|/u);
  const config = parse(first[1]!);
  const prior = parse(before[1]!);
  assert.equal(config.env.staging.vars.aa_new_flag_v1, "true");
  assert.equal(config.env.production.vars.zz_new_flag_v1, "true");
  assert.equal(config.env.staging.vars.zz_new_flag_v1, undefined);
  assert.equal(config.vars.zz_new_flag_v1, undefined);
  assert.equal(config.env.shadow.vars.aa_new_flag_v1, undefined);
  delete config.env.staging.vars.aa_new_flag_v1;
  delete config.env.production.vars.zz_new_flag_v1;
  assert.deepEqual(config, prior);
  assert.doesNotThrow(() => JSON.parse(first[1]!));
  assert.equal(gen(root).status, 0);
  assert.deepEqual(await readAll(root), first);
  assert.equal(gen(root, "--check").status, 0);
  for (const [index, path] of outputs.entries()) {
    const stale = path.endsWith(".jsonc") ? first[index]!.replace(/("(?:aa_new|zz_new)_flag_v1": )"true"/u, "$1\"stale\"") : path.endsWith(".md") ? first[index]!.replace("| aa_new_flag_v1 |", "| STALE |") : `${first[index]}\n`;
    await writeFile(join(root, path), stale);
    const check = gen(root, "--check");
    assert.notEqual(check.status, 0, path);
    assert.ok((check.stdout + check.stderr).includes(path), path);
    await writeFile(join(root, path), first[index]!);
  }
});

test("invalid definitions fail without partial writes", async t => {
  const root = await fixture(t);
  const before = await readAll(root);
  const file = join(root, "src/flags/invalid_flag_v1.ts");
  await writeFile(file, definition("other_name_v1", false, false));
  assert.match(gen(root).stderr, /flag must match filename/u);
  await writeFile(file, definition("invalid_flag_v1", false, false, "export const scopes = [\"wrangler.production.jsonc:vars\"] as const;\n"));
  assert.match(gen(root).stderr, /invalid scopes/u);
  await writeFile(file, definition("invalid_flag_v1", false, false).replace("staging = false", "staging = \"no\""));
  assert.match(gen(root).stderr, /invalid staging/u);
  await rm(file);
  const doc = join(root, "docs/PROTOTYPE_FLAGS.md");
  await writeFile(doc, "no markers\n");
  assert.match(gen(root).stderr, /expected one generated block/u);
  await writeFile(doc, before[2]!);
  assert.deepEqual(await readAll(root), before);
});

test("a flag variable placed elsewhere in vars is moved to the top", async t => {
  const root = await fixture(t);
  await writeFile(join(root, "src/flags/dup_flag_v1.ts"), definition("dup_flag_v1", false, true));
  const config = (await read(root, "wrangler.jsonc")).replace("\"ZUKAN_FEATURE_ROLLOUTS\": \"{}\",", "\"ZUKAN_FEATURE_ROLLOUTS\": \"{}\",\n        \"dup_flag_v1\": \"false\",");
  await writeFile(join(root, "wrangler.jsonc"), config);
  assert.equal(gen(root).status, 0);
  const text = await read(root, "wrangler.jsonc");
  assert.equal(text.split("dup_flag_v1").length, 2);
  assert.equal(parse(text).env.production.vars.dup_flag_v1, "true");
});

test("committed wrangler.jsonc is plain JSON", async () => {
  JSON.parse(await readFile(resolve("wrangler.jsonc"), "utf8"));
});

test("rollout.mjs allow/promote/rollback keep expiry fields and write an audit trail", async t => {
  const root = await fixture(t);
  await writeFile(join(root, "src/flags/zukan_test_v1.ts"), definition("zukan_test_v1", false, false));
  assert.equal(gen(root).status, 0);
  const audit = join(root, "docs/ops/feature-rollout-audit.jsonl");
  const run = (...args: string[]) => rollout(root, ...args, "--config", join(root, "wrangler.jsonc"), "--audit", audit, "--flags", join(root, "src/flags"));
  const list = () => JSON.parse(run("list").stdout) as Record<string, any>;
  const rolloutsInFile = async () => JSON.parse(parse(await read(root, "wrangler.jsonc")).env.production.vars.ZUKAN_FEATURE_ROLLOUTS);
  assert.deepEqual(list(), {});

  assert.notEqual(run("allow", "zukan_test_v1", "user_journey_synthetic").status, 0);
  assert.deepEqual(await rolloutsInFile(), {});
  assert.notEqual(run("allow", "unregistered_flag_v1", "user_journey_synthetic", "--expires", "2026-12-08").status, 0);
  assert.notEqual(run("allow", "zukan_test_v1", "bad principal!", "--expires", "2026-12-08").status, 0);
  assert.notEqual(run("allow", "zukan_test_v1", "user_x", "--expires", "2026-02-31").status, 0);
  assert.notEqual(run("allow", "zukan_test_v1", "user_x", "--expires", "2026-12-08", "--remove-by", "2026-12-01").status, 0);

  assert.equal(run("allow", "zukan_test_v1", "user_journey_synthetic", "--expires", "2026-12-08").status, 0);
  assert.deepEqual(await rolloutsInFile(), { zukan_test_v1: { state: "allowlist", allowlist: ["user_journey_synthetic"], expiresOn: "2026-12-08", removeBy: "2026-12-15" } });
  assert.equal(run("allow", "zukan_test_v1", "user_owner_1").status, 0);
  assert.deepEqual((await rolloutsInFile()).zukan_test_v1, { state: "allowlist", allowlist: ["user_journey_synthetic", "user_owner_1"], expiresOn: "2026-12-08", removeBy: "2026-12-15" });
  assert.equal(run("disallow", "zukan_test_v1", "user_owner_1").status, 0);
  assert.deepEqual((await rolloutsInFile()).zukan_test_v1.allowlist, ["user_journey_synthetic"]);
  assert.equal(run("promote", "zukan_test_v1").status, 0);
  assert.deepEqual((await rolloutsInFile()).zukan_test_v1, { state: "all", allowlist: ["user_journey_synthetic"], expiresOn: "2026-12-08", removeBy: "2026-12-15" });
  assert.equal(run("rollback", "zukan_test_v1").status, 0);
  assert.deepEqual((await rolloutsInFile()).zukan_test_v1, { state: "off", allowlist: ["user_journey_synthetic"], expiresOn: "2026-12-08", removeBy: "2026-12-15" });
  assert.equal(run("allow", "zukan_test_v1", "user_owner_1", "--expires", "2027-01-10", "--remove-by", "2027-01-12").status, 0);
  assert.deepEqual((await rolloutsInFile()).zukan_test_v1, { state: "allowlist", allowlist: ["user_journey_synthetic", "user_owner_1"], expiresOn: "2027-01-10", removeBy: "2027-01-12" });
  assert.notEqual(run("promote", "zukan_test_v1", "--expires", "2027-01-10").status, 0);

  const trail = (await readFile(audit, "utf8")).trim().split("\n").map(line => JSON.parse(line));
  assert.deepEqual(trail.map(entry => `${entry.from.state}>${entry.to.state}`), ["off>allowlist", "allowlist>allowlist", "allowlist>allowlist", "allowlist>all", "all>off", "off>allowlist"]);
  assert.ok(trail.every(entry => entry.flag === "zukan_test_v1" && typeof entry.who === "string" && !Number.isNaN(Date.parse(entry.when))));
  assert.equal(gen(root, "--check").status, 0);
  const configAfter = await read(root, "wrangler.jsonc");
  assert.equal(configAfter.match(/"ZUKAN_FEATURE_ROLLOUTS"/gu)?.length, 1);
  assert.equal(parse(configAfter).env.staging.vars.ZUKAN_FEATURE_ROLLOUTS, undefined);
});

test("rollout.mjs refuses a config without exactly one rollout variable", async t => {
  const root = await fixture(t);
  const config = join(root, "wrangler.jsonc");
  const original = await readFile(config, "utf8");
  await writeFile(config, original.replace("\"ZUKAN_FEATURE_ROLLOUTS\": \"{}\",", ""));
  assert.match(rollout(root, "list", "--config", config).stderr, /exactly once/u);
  await writeFile(config, original.replace("\"ZUKAN_FEATURE_ROLLOUTS\": \"{}\",", "\"ZUKAN_FEATURE_ROLLOUTS\": \"[]\","));
  assert.match(rollout(root, "list", "--config", config).stderr, /must be an object/u);
});
