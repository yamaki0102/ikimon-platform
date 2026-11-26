import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { FLAG_DEFINITIONS } from "./flags/index.generated";
import {
  PROTOTYPE_FLAGS,
  prototypeEnabled,
  prototypeEnabledForPrincipal,
  prototypeEnabledForViewer,
  prototypeFlagInventoryMarkdown,
  viewAsGuest,
  viewerFromSession,
} from "./prototype-flags";

const registry: readonly { flag: string }[] = PROTOTYPE_FLAGS;
const definitions: readonly { flag: string }[] = FLAG_DEFINITIONS;
const flag = "zukan_test_flag_v1";
const now = new Date("2026-12-01T12:00:00Z");
const dated = { expiresOn: "2026-12-08", removeBy: "2026-12-15" };
const names = ["user_journey_synthetic", "user_owner_1"];
const env = (entry: unknown) => ({ ZUKAN_FEATURE_ROLLOUTS: JSON.stringify({ [flag]: entry }) });
const allowlist = (extra: Record<string, unknown> = {}) => env({ state: "allowlist", allowlist: names, ...dated, ...extra });
const parseJsonc = (path: string): any => {
  const result = ts.parseConfigFileTextToJson(path, readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
  assert.equal(result.error, undefined);
  return result.config;
};

test("principal evaluation: allowlist enables listed principals only, anonymous never", () => {
  assert.equal(prototypeEnabledForPrincipal(allowlist(), flag, "user_journey_synthetic", null, now), true);
  assert.equal(prototypeEnabledForPrincipal(allowlist(), flag, "user_owner_1", null, now), true);
  assert.equal(prototypeEnabledForPrincipal(allowlist(), flag, "user_other", null, now), false);
  assert.equal(prototypeEnabledForPrincipal(allowlist(), flag, null, null, now), false);
  assert.equal(prototypeEnabledForPrincipal(allowlist(), flag, "", null, now), false);
});

test("principal evaluation: all enables every authenticated principal but not anonymous; off disables", () => {
  assert.equal(prototypeEnabledForPrincipal(env({ state: "all" }), flag, "user_other", null, now), true);
  assert.equal(prototypeEnabledForPrincipal(env({ state: "all" }), flag, null, null, now), false);
  assert.equal(prototypeEnabledForPrincipal(env({ state: "off", allowlist: names, ...dated }), flag, "user_owner_1", null, now), false);
});

test("role tokens match the viewer role exactly", () => {
  const config = env({ state: "allowlist", allowlist: ["role:owner"], ...dated });
  assert.equal(prototypeEnabledForPrincipal(config, flag, "user_x", "owner", now), true);
  assert.equal(prototypeEnabledForPrincipal(config, flag, "user_x", "owner2", now), false);
  assert.equal(prototypeEnabledForPrincipal(config, flag, "user_x", "member", now), false);
  assert.equal(prototypeEnabledForPrincipal(config, flag, null, "owner", now), false);
  assert.equal(prototypeEnabledForViewer(config, flag, "user_x", "owner", now), true);
});

test("viewer evaluation: all is on for logged-out viewers, allowlist and off are not", () => {
  assert.equal(prototypeEnabledForViewer(env({ state: "all" }), flag, null, null, now), true);
  assert.equal(prototypeEnabledForViewer(env({ state: "all" }), flag, undefined, undefined, now), true);
  assert.equal(prototypeEnabledForViewer(allowlist(), flag, null, null, now), false);
  assert.equal(prototypeEnabledForViewer(allowlist(), flag, "user_owner_1", null, now), true);
  assert.equal(prototypeEnabledForViewer(allowlist(), flag, "user_other", null, now), false);
  assert.equal(prototypeEnabledForViewer(env({ state: "off" }), flag, null, null, now), false);
  assert.equal(prototypeEnabledForViewer(env({ state: "off" }), flag, "user_owner_1", null, now), false);
});

test("expired allowlist entries are off, the last day still counts", () => {
  assert.equal(prototypeEnabledForViewer(allowlist(), flag, "user_owner_1", null, new Date("2026-12-08T23:59:59Z")), true);
  assert.equal(prototypeEnabledForViewer(allowlist(), flag, "user_owner_1", null, new Date("2026-12-09T00:00:00Z")), false);
  assert.equal(prototypeEnabledForPrincipal(allowlist(), flag, "user_owner_1", null, new Date("2027-01-01T00:00:00Z")), false);
});

test("allowlist entries without valid dates are off", () => {
  for (const bad of [{ expiresOn: undefined }, { removeBy: undefined }, { expiresOn: "2026-02-31" }, { expiresOn: "12/08/2026" }, { removeBy: "2026-12-01" }, { expiresOn: 20261208 }]) {
    assert.equal(prototypeEnabledForViewer(allowlist(bad), flag, "user_owner_1", null, now), false, JSON.stringify(bad));
  }
});

test("state all ignores dates and a legacy allowlist", () => {
  assert.equal(prototypeEnabledForViewer(env({ state: "all", allowlist: names, expiresOn: "2020-01-01", removeBy: "2020-01-02" }), flag, null, null, now), true);
});

test("malformed or unknown rollout data fails closed", () => {
  const raws = ["not-json", "[]", "null", "1", JSON.stringify({ [flag]: null }), JSON.stringify({ [flag]: [] }), JSON.stringify({ [flag]: "all" }), JSON.stringify({ [flag]: { state: "surprise" } }), JSON.stringify({ [flag]: { state: "allowlist", allowlist: "user_owner_1", ...dated } }), JSON.stringify({ [flag]: { state: "allowlist", allowlist: [1], ...dated } })];
  for (const raw of raws) {
    const config = { [flag]: "true", ZUKAN_FEATURE_ROLLOUTS: raw };
    assert.equal(prototypeEnabledForViewer(config, flag, "user_owner_1", null, now), false, raw);
    assert.equal(prototypeEnabledForPrincipal(config, flag, "user_owner_1", null, now), false, raw);
  }
});

test("no rollout entry falls back to the legacy boolean", () => {
  assert.equal(prototypeEnabledForViewer({}, flag, null, null, now), false);
  assert.equal(prototypeEnabledForViewer({ ZUKAN_FEATURE_ROLLOUTS: "{}" }, flag, null, null, now), false);
  assert.equal(prototypeEnabledForViewer({ ZUKAN_FEATURE_ROLLOUTS: "{}", [flag]: "true" } as never, flag, null, null, now), true);
  assert.equal(prototypeEnabledForPrincipal({ [flag]: "true" } as never, flag, null, null, now), true);
  for (const value of ["false", "1", "TRUE", " true "]) assert.equal(prototypeEnabled({ [flag]: value }, flag), false);
  assert.equal(prototypeEnabled({}, flag), false);
});

test("a rollout entry replaces the legacy boolean", () => {
  assert.equal(prototypeEnabledForViewer({ [flag]: "true", ...env({ state: "off" }) } as never, flag, "user_owner_1", null, now), false);
  assert.equal(prototypeEnabledForViewer({ [flag]: "true", ...allowlist() } as never, flag, "user_other", null, now), false);
});

test("cookies, headers and query strings are never rollout input", () => {
  const request = new Request("https://zukan.example/ja/?zukan_feature_rollouts=all&flag=on", { headers: { cookie: `ZUKAN_FEATURE_ROLLOUTS=all; ${flag}=on`, "x-feature-flag": flag } });
  assert.equal(request.headers.get("x-feature-flag"), flag);
  assert.equal(prototypeEnabledForViewer(allowlist(), flag, null, null, now), false);
  assert.equal(prototypeEnabledForViewer(allowlist(), flag, "user_other", null, now), false);
  assert.equal(viewAsGuest(request, allowlist(), flag, { userId: "user_other", roleName: "member" }, now), false);
});

test("viewAsGuest needs as=guest and a rolled-in logged-in viewer", () => {
  const guest = new Request("https://zukan.example/ja/?as=guest");
  const plain = new Request("https://zukan.example/ja/");
  const owner = { userId: "user_owner_1", roleName: "member" };
  assert.equal(viewAsGuest(guest, allowlist(), flag, owner, now), true);
  assert.equal(viewAsGuest(guest, allowlist(), flag, { userId: "user_journey_synthetic", roleName: "member" }, now), true);
  assert.equal(viewAsGuest(plain, allowlist(), flag, owner, now), false);
  assert.equal(viewAsGuest(new Request("https://zukan.example/ja/?as=Guest"), allowlist(), flag, owner, now), false);
  assert.equal(viewAsGuest(new Request("https://zukan.example/ja/?as=user"), allowlist(), flag, owner, now), false);
  assert.equal(viewAsGuest(guest, allowlist(), flag, { userId: "user_other", roleName: "member" }, now), false);
  assert.equal(viewAsGuest(guest, allowlist(), flag, null, now), false);
  assert.equal(viewAsGuest(guest, allowlist(), flag, { userId: "user_owner_1", banned: true }, now), false);
  assert.equal(viewAsGuest(guest, env({ state: "off" }), flag, owner, now), false);
  assert.equal(viewAsGuest(guest, {}, flag, owner, now), false);
  assert.equal(viewAsGuest(guest, allowlist(), flag, owner, new Date("2026-12-09T00:00:00Z")), false);
});

test("viewerFromSession normalises identity", () => {
  assert.deepEqual(viewerFromSession(null), { principalId: null, role: null });
  assert.deepEqual(viewerFromSession({ userId: "" }), { principalId: null, role: null });
  assert.deepEqual(viewerFromSession({ userId: "u", banned: true }), { principalId: null, role: null });
  assert.deepEqual(viewerFromSession({ userId: "u", roleName: "" }), { principalId: "u", role: null });
  assert.deepEqual(viewerFromSession({ userId: "u", roleName: "owner" }), { principalId: "u", role: "owner" });
});

test("generated registry matches the inventory document and has unique names", () => {
  const doc = readFileSync(new URL("../docs/PROTOTYPE_FLAGS.md", import.meta.url), "utf8").replace(/\r\n/gu, "\n");
  assert.equal(doc.split("<!-- BEGIN GENERATED FLAGS -->\n")[1]?.split("<!-- END GENERATED FLAGS -->")[0], prototypeFlagInventoryMarkdown());
  assert.equal(new Set(registry.map(entry => entry.flag)).size, registry.length);
  assert.deepEqual(definitions.map(entry => entry.flag), registry.map(entry => entry.flag));
});

test("wrangler config holds the rollout only in production and keeps allowlists dated", () => {
  const config = parseJsonc("wrangler.jsonc");
  const scopes: [string, Record<string, unknown>][] = [["vars", config.vars], ...Object.entries<any>(config.env).map(([name, value]): [string, Record<string, unknown>] => [`env.${name}.vars`, value.vars])];
  const frozenAllowVars = ["ALERT_EMAIL_ALLOWED_RECIPIENTS", "ZUKAN_FOUNDATION_V2_ALLOWED_TENANTS", "ZUKAN_FOUNDATION_V2_ALLOWED_OPERATIONS"];
  for (const [scope, vars] of scopes) {
    assert.equal(Object.hasOwn(vars, "ZUKAN_FEATURE_ROLLOUTS"), scope === "env.production.vars", scope);
    for (const key of Object.keys(vars)) assert.ok(!/ALLOW|WHITELIST/iu.test(key) || frozenAllowVars.includes(key), `${scope}:${key}`);
  }
  const rollouts = JSON.parse(config.env.production.vars.ZUKAN_FEATURE_ROLLOUTS) as Record<string, { state: string; allowlist?: string[]; expiresOn?: string; removeBy?: string }>;
  const registered = new Set<string>(registry.map(entry => entry.flag));
  const today = new Date().toISOString().slice(0, 10);
  for (const [name, entry] of Object.entries(rollouts)) {
    assert.ok(registered.has(name), `${name} is not registered in src/flags`);
    assert.ok(["off", "allowlist", "all"].includes(entry.state), name);
    if (entry.state !== "allowlist") continue;
    assert.match(entry.expiresOn ?? "", /^\d{4}-\d{2}-\d{2}$/u, `${name} expiresOn`);
    assert.match(entry.removeBy ?? "", /^\d{4}-\d{2}-\d{2}$/u, `${name} removeBy`);
    assert.ok((entry.removeBy as string) >= (entry.expiresOn as string), `${name} removeBy before expiresOn`);
    assert.ok((entry.removeBy as string) >= today, `${name} allowlist is past removeBy ${entry.removeBy}`);
  }
});
