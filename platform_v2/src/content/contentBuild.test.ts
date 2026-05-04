import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const platformRootPath = fileURLToPath(new URL("../../", import.meta.url));

test("build copies content files into dist and the built loader can read them", async () => {
  if (process.platform === "win32") {
    execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npm run build"], {
      cwd: platformRootPath,
      stdio: "pipe",
    });
  } else {
    execFileSync("sh", ["-lc", "npm run build"], {
      cwd: platformRootPath,
      stdio: "pipe",
    });
  }

  const distPublicJson = join(platformRootPath, "dist", "content", "short", "ja", "public.json");
  const distAboutMarkdown = join(platformRootPath, "dist", "content", "longform", "ja", "about.md");

  assert.equal(existsSync(distPublicJson), true);
  assert.equal(existsSync(distAboutMarkdown), true);

  const builtModule = await import(`${pathToFileURL(join(platformRootPath, "dist", "content", "index.js")).href}?t=${Date.now()}`);
  assert.equal(builtModule.getShortCopy("ja", "public", "landing.title"), "ikimon.life | Enjoy Life - 生きものを楽しみ、地域の自然を記録する");
  assert.match(builtModule.renderLongformPage("ja", "about"), /Enjoy Life から始める理由/);
});
