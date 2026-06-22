import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { LocalMediaObjectStore } from "./mediaObjectStore.js";

test("local media store writes public and private objects with compatibility metadata", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ikimon-media-store-"));
  try {
    const store = new LocalMediaObjectStore({
      publicRoot: path.join(root, "public"),
      privateRoot: path.join(root, "private"),
    });

    const publicObject = await store.write({
      visibility: "public",
      storagePath: "uploads/v2-observations/record-1/photo.jpg",
      buffer: Buffer.from("public-bytes"),
    });
    const privateObject = await store.write({
      visibility: "private",
      storagePath: "photo-originals/v2-observations/record-1/photo.jpg",
      buffer: Buffer.from("private-bytes"),
    });

    assert.deepEqual(publicObject, {
      storageBackend: "local_fs",
      storagePath: "uploads/v2-observations/record-1/photo.jpg",
      publicUrl: "/uploads/v2-observations/record-1/photo.jpg",
    });
    assert.deepEqual(privateObject, {
      storageBackend: "local_private_fs",
      storagePath: "photo-originals/v2-observations/record-1/photo.jpg",
      publicUrl: null,
    });
    assert.equal(
      await readFile(path.join(root, "public", "uploads", "v2-observations", "record-1", "photo.jpg"), "utf8"),
      "public-bytes",
    );
    assert.equal(
      await readFile(path.join(root, "private", "photo-originals", "v2-observations", "record-1", "photo.jpg"), "utf8"),
      "private-bytes",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
