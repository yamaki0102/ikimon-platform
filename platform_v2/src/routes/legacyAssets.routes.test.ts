import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { buildApp } from "../app.js";

async function withEnv(
  overrides: Record<string, string | undefined>,
  run: () => Promise<void>,
): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    await run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("legacy asset routes serve uploads from the legacy uploads root", async () => {
  const sandboxRoot = await mkdtemp(path.join(tmpdir(), "ikimon-legacy-assets-"));
  const publicRoot = path.join(sandboxRoot, "public");
  const uploadsRoot = path.join(sandboxRoot, "uploads");
  await mkdir(path.join(publicRoot, "assets"), { recursive: true });
  await mkdir(path.join(uploadsRoot, "photos"), { recursive: true });
  await writeFile(path.join(publicRoot, "assets", "brand.txt"), "brand");
  await writeFile(path.join(uploadsRoot, "photos", "sample.jpg"), "jpeg-bits");

  try {
    await withEnv(
      {
        LEGACY_PUBLIC_ROOT: publicRoot,
        LEGACY_UPLOADS_ROOT: uploadsRoot,
      },
      async () => {
        const app = buildApp();
        try {
          const assetResponse = await app.inject({
            method: "GET",
            url: "/assets/brand.txt",
          });
          assert.equal(assetResponse.statusCode, 200);
          assert.match(String(assetResponse.headers["content-type"] ?? ""), /^text\/plain/);
          assert.equal(assetResponse.body, "brand");

          const uploadResponse = await app.inject({
            method: "GET",
            url: "/uploads/photos/sample.jpg",
          });
          assert.equal(uploadResponse.statusCode, 200);
          assert.match(String(uploadResponse.headers["content-type"] ?? ""), /^image\/jpeg/);
          assert.equal(uploadResponse.body, "jpeg-bits");

          const legacyAliasResponse = await app.inject({
            method: "GET",
            url: "/data/uploads/photos/sample.jpg",
          });
          assert.equal(legacyAliasResponse.statusCode, 200);
          assert.match(String(legacyAliasResponse.headers["content-type"] ?? ""), /^image\/jpeg/);
          assert.equal(legacyAliasResponse.body, "jpeg-bits");
        } finally {
          await app.close();
        }
      },
    );
  } finally {
    await rm(sandboxRoot, { recursive: true, force: true });
  }
});
