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

    assert.equal(
      await store.read({
        visibility: "private",
        storagePath: "photo-originals/v2-observations/record-1/photo.jpg",
      }).then((buffer) => buffer.toString("utf8")),
      "private-bytes",
    );
    await store.delete({
      visibility: "private",
      storagePath: "photo-originals/v2-observations/record-1/photo.jpg",
    });
    await store.delete({
      visibility: "private",
      storagePath: "photo-originals/v2-observations/record-1/photo.jpg",
    });
    await assert.rejects(
      () => store.write({
        visibility: "private",
        storagePath: "../escape.jpg",
        buffer: Buffer.from("escape"),
      }),
      /media_object_path_escape/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("local media store can preserve a legacy private audio backend name", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ikimon-media-store-audio-"));
  try {
    const store = new LocalMediaObjectStore({
      publicRoot: path.join(root, "public"),
      privateRoot: path.join(root, "private"),
      privateStorageBackend: "private_audio_fs",
    });

    const privateObject = await store.write({
      visibility: "private",
      storagePath: "v2-audio/2026-06/session/chunk.webm",
      buffer: Buffer.from("audio-bytes"),
    });

    assert.deepEqual(privateObject, {
      storageBackend: "private_audio_fs",
      storagePath: "v2-audio/2026-06/session/chunk.webm",
      publicUrl: null,
    });
    assert.equal(
      await store.read({
        visibility: "private",
        storagePath: "v2-audio/2026-06/session/chunk.webm",
      }).then((buffer) => buffer.toString("utf8")),
      "audio-bytes",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
