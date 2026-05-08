import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.resolve(here, "data", "nature_symbiosis_sites.seed.json");
const projectRoot = path.resolve(here, "..", "..");

async function listSeedFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...await listSeedFiles(fullPath));
      continue;
    }
    if (/\.(seed|ja)\.json$/i.test(entry.name)) out.push(fullPath);
  }
  return out;
}

function collectOfficialUrls(value: unknown, filePath: string, trail = "$"): Array<{ filePath: string; path: string; url: string }> {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectOfficialUrls(item, filePath, `${trail}[${index}]`));
  }
  const out: Array<{ filePath: string; path: string; url: string }> = [];
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = `${trail}.${key}`;
    if (key === "official_url" && typeof item === "string" && item.trim()) {
      out.push({ filePath, path: nextPath, url: item.trim() });
      continue;
    }
    out.push(...collectOfficialUrls(item, filePath, nextPath));
  }
  return out;
}

test("aikan renri official URL points to the owner primary source, not an ikimon article", async () => {
  const seed = JSON.parse(await readFile(seedPath, "utf8")) as {
    sites?: Array<{ certification_id?: string; official_url?: string }>;
  };
  const site = seed.sites?.find((entry) => entry.certification_id === "aikan-renri-ikan-hq");

  assert.ok(site, "aikan renri seed must exist");
  assert.equal(site.official_url, "https://i-kan.co.jp/company/biodiversity/");
  assert.doesNotMatch(site.official_url ?? "", /^https:\/\/ikimon\.life\//);
});

test("all seed official_url values must point outside ikimon.life", async () => {
  const seedFiles = [
    ...await listSeedFiles(path.resolve(here, "data")),
    ...await listSeedFiles(path.resolve(projectRoot, "db", "seeds")),
  ];
  const violations: string[] = [];
  for (const filePath of seedFiles) {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const officialUrls = collectOfficialUrls(parsed, filePath);
    for (const item of officialUrls) {
      assert.doesNotMatch(
        item.url,
        /^https?:\/\/(?:[^/]+\.)?ikimon\.life(?:[/:?#]|$)/i,
        `${path.relative(projectRoot, item.filePath)} ${item.path} must not use ikimon.life as official_url`,
      );
      if (/^https?:\/\/(?:[^/]+\.)?ikimon\.life(?:[/:?#]|$)/i.test(item.url)) {
        violations.push(`${path.relative(projectRoot, item.filePath)} ${item.path} ${item.url}`);
      }
    }
  }
  assert.deepEqual(violations, []);
});
