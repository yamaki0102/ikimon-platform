#!/usr/bin/env node
import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index < 0 ? undefined : args.splice(index, 2)[1]; };
const configPath = option("--config") ?? "wrangler.jsonc";
const auditPath = option("--audit") ?? "docs/ops/feature-rollout-audit.jsonl";
const flagsDirectory = option("--flags") ?? "src/flags";
const expires = option("--expires");
const removeByOption = option("--remove-by");
const [command = "list", flag, principal] = args;
const validPrincipal = value => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9:_-]{1,255}$/u.test(value);
const validDate = value => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
};
const plusDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

const source = await readFile(configPath, "utf8");
const matches = [...source.matchAll(/^[ \t]*"ZUKAN_FEATURE_ROLLOUTS"[ \t]*:[ \t]*("(?:[^"\\]|\\.)*")[ \t]*,?[ \t]*$/gmu)];
if (matches.length !== 1) throw new Error(`ZUKAN_FEATURE_ROLLOUTS must appear exactly once in ${configPath}`);
const match = matches[0];
let rollouts;
try { rollouts = JSON.parse(JSON.parse(match[1])); } catch { throw new Error("ZUKAN_FEATURE_ROLLOUTS must be a JSON object encoded as a string"); }
if (typeof rollouts !== "object" || rollouts === null || Array.isArray(rollouts)) throw new Error("ZUKAN_FEATURE_ROLLOUTS must be an object");

if (command === "list") {
  process.stdout.write(`${JSON.stringify(rollouts, null, 2)}\n`);
  process.exit(0);
}
if (!["allow", "disallow", "promote", "rollback"].includes(command)) {
  throw new Error("usage: rollout.mjs list | allow <flag> <principal> [--expires YYYY-MM-DD [--remove-by YYYY-MM-DD]] | disallow <flag> <principal> | promote <flag> | rollback <flag>");
}
const registered = (await readdir(flagsDirectory)).filter(file => file.endsWith(".ts") && file !== "index.generated.ts").map(file => file.slice(0, -3));
if (typeof flag !== "string" || !registered.includes(flag)) throw new Error("flag must be registered in src/flags");
if ((command === "allow" || command === "disallow") && !validPrincipal(principal)) throw new Error(`${command} requires a principal id`);
if ((expires !== undefined || removeByOption !== undefined) && command !== "allow") throw new Error("--expires and --remove-by are only valid with allow");
if (expires !== undefined && !validDate(expires)) throw new Error("--expires must be YYYY-MM-DD");
if (removeByOption !== undefined && (expires === undefined || !validDate(removeByOption))) throw new Error("--remove-by must be YYYY-MM-DD and requires --expires");

const before = structuredClone(rollouts[flag] ?? { state: "off", allowlist: [] });
const allowlist = new Set(Array.isArray(before.allowlist) ? before.allowlist.filter(validPrincipal) : []);
if (command === "allow") allowlist.add(principal);
if (command === "disallow") allowlist.delete(principal);
const state = command === "promote" ? "all" : command === "rollback" ? "off" : "allowlist";
const expiresOn = expires ?? (validDate(before.expiresOn) ? before.expiresOn : undefined);
const removeBy = expires !== undefined ? (removeByOption ?? plusDays(expires, 7)) : (validDate(before.removeBy) ? before.removeBy : undefined);
if (state === "allowlist" && (expiresOn === undefined || removeBy === undefined || removeBy < expiresOn)) throw new Error("an allowlist needs --expires YYYY-MM-DD (removeBy defaults to expires + 7 days)");
const { state: _state, allowlist: _allowlist, expiresOn: _expiresOn, removeBy: _removeBy, ...rest } = before;
const after = { ...rest, state, allowlist: [...allowlist].sort(), ...(expiresOn === undefined ? {} : { expiresOn }), ...(removeBy === undefined ? {} : { removeBy }) };
rollouts[flag] = after;
const encoded = JSON.stringify(JSON.stringify(Object.fromEntries(Object.entries(rollouts).sort(([a], [b]) => a.localeCompare(b)))));
const line = match[0].replace(match[1], () => encoded);
await writeFile(configPath, source.slice(0, match.index) + line + source.slice(match.index + match[0].length));
const audit = { who: process.env.ZUKAN_ROLLOUT_ACTOR ?? process.env.USER ?? process.env.USERNAME ?? "unknown", when: new Date().toISOString(), flag, from: before, to: after };
await mkdir(dirname(auditPath), { recursive: true });
await appendFile(auditPath, `${JSON.stringify(audit)}\n`);
process.stdout.write(`${flag} ${before.state ?? "off"} -> ${after.state}\n`);
