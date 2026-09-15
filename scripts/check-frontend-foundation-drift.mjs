#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(repoRoot, "platform_v2/src/ui/frontendFoundation.ts");
const source = await readFile(sourcePath, "utf8");
const required = [
  "--ik-motion-fast",
  "--ik-motion-normal",
  "--ik-motion-slow",
  "--ik-ease-standard",
  "--ik-space-xs",
  "--ik-space-md",
  "--ik-space-xl",
  "--ik-tap-target",
  "--ik-focus-ring",
  "prefers-reduced-motion",
  '"action"',
  '"async-action"',
  '"modal"',
  '"sheet"',
  '"search"',
  '"validation"',
  '"skeleton"',
  '"confirmation"',
];
const missing = required.filter((token) => !source.includes(token));
if (missing.length) {
  console.error(`Frontend Foundation drift: missing ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`Frontend Foundation contract OK (${required.length} checks)`);
