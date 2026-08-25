import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";

const sourceRoot = fileURLToPath(new URL(".", import.meta.url));

function publicContentFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...publicContentFiles(path));
    else if (entry.isFile() && /\.(?:md|json)$/u.test(entry.name) && !/\\ops\.json$/u.test(path)) files.push(path);
  }
  return files;
}

function visibleText(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[\s\S]*?<\/style>/giu, " ")
    .replace(/<!--[\s\S]*?-->/gu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&(?:amp|lt|gt|quot|#39);/giu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

test("primary public surfaces expose ZUKAN without a visible legacy service name", async () => {
  const app = buildApp();
  try {
    for (const url of ["/", "/login?lang=ja", "/register?lang=ja", "/record?lang=ja", "/map?lang=ja", "/records?view=public&lang=ja", "/settings"]) {
      const response = await app.inject({ method: "GET", url, headers: { accept: "text/html" } });
      assert.ok(response.statusCode === 200 || response.statusCode === 404, `${url}: unexpected ${response.statusCode}`);
      const text = visibleText(response.body)
        .replace(/IKIMON株式会社/gu, "")
        .replace(/IKIMON Inc\.?/giu, "");
      assert.doesNotMatch(text, /\bikimon(?:\.life)?\b/iu, `${url}: visible legacy service name`);
      assert.match(response.body, /ZUKAN/iu, `${url}: canonical service name missing`);
    }
  } finally {
    await app.close();
  }
});

test("public content sources contain no lowercase legacy service presentation name", () => {
  const roots = [
    join(sourceRoot, "content", "longform"),
    join(sourceRoot, "content", "short"),
  ];
  const files = roots.flatMap(publicContentFiles);
  for (const path of files) {
    const source = readFileSync(path, "utf8").replaceAll("contact@ikimon.life", "");
    assert.doesNotMatch(source, /\bikimon(?:\.life)?\b/u, path);
  }
});
