import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const releaseAssets = JSON.parse(readFileSync(path.join(root, "src", "release-assets.json"), "utf8"));
const pairs = [
  ["assets/formal", releaseAssets.formal],
  ["assets/characters", releaseAssets.characters],
  ["assets/demo-bgm", releaseAssets.demoBgm],
  ["assets/narration", releaseAssets.rulesNarration],
  ["assets/demo-narration", releaseAssets.demoNarration]
];

function tree(rootDir) {
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) {
        const relative = path.relative(rootDir, absolute).replaceAll(path.sep, "/");
        const bytes = readFileSync(absolute);
        files.push(`${relative}\t${bytes.byteLength}\t${createHash("sha256").update(bytes).digest("hex")}`);
      }
    }
  }
  walk(rootDir);
  return files.sort();
}

for (const [sourceRelative, targetRelative] of pairs) {
  const source = path.join(root, "public", sourceRelative);
  const target = path.join(root, "public", targetRelative);
  if (!statSync(source).isDirectory()) throw new Error(`release asset source is not a directory: ${sourceRelative}`);
  if (!existsSync(target)) {
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(source, target, { recursive: true, errorOnExist: true });
  }
  const sourceTree = tree(source);
  const targetTree = tree(target);
  if (sourceTree.length !== targetTree.length || sourceTree.some((line, index) => line !== targetTree[index])) {
    throw new Error(`immutable release asset directory drifted: ${targetRelative}`);
  }
}

process.stdout.write(`versioned release assets ready: ${pairs.map(([, target]) => target).join(", ")}\n`);
