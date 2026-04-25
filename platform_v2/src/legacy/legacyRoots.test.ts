import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { resolveLegacyRoots } from "./legacyRoots.js";

test("resolveLegacyRoots defaults to sibling upload_package", () => {
  const baseRoot = path.resolve("/repo/platform_v2");
  assert.deepEqual(resolveLegacyRoots(baseRoot), {
    legacyDataRoot: path.resolve("/repo/upload_package/data"),
    uploadsRoot: path.resolve("/repo/upload_package/public_html/uploads"),
    publicRoot: path.resolve("/repo/upload_package/public_html"),
  });
});

test("resolveLegacyRoots maps mirror roots unless direct roots override them", () => {
  const baseRoot = path.resolve("/repo/platform_v2");
  const mirrorRoot = path.resolve("/mirror");
  assert.deepEqual(resolveLegacyRoots(baseRoot, { mirrorRoot }), {
    legacyDataRoot: path.resolve("/mirror/data"),
    uploadsRoot: path.resolve("/mirror/uploads"),
    publicRoot: path.resolve("/mirror/public"),
  });

  assert.deepEqual(resolveLegacyRoots(baseRoot, {
    mirrorRoot,
    legacyDataRoot: "/live/data",
    uploadsRoot: "/live/uploads",
    publicRoot: "/live/public",
  }), {
    legacyDataRoot: path.resolve("/live/data"),
    uploadsRoot: path.resolve("/live/uploads"),
    publicRoot: path.resolve("/live/public"),
  });
});
