import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
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
    const publicTarget = {
      visibility: "public" as const,
      storagePath: "uploads/v2-observations/record-1/photo.jpg",
    };
    const privateTarget = {
      visibility: "private" as const,
      storagePath: "photo-originals/v2-observations/record-1/photo.jpg",
    };

    assert.equal(await store.exists(publicTarget), false);
    assert.equal(await store.exists(privateTarget), false);

    const publicObject = await store.write({
      ...publicTarget,
      buffer: Buffer.from("public-bytes"),
    });
    const privateObject = await store.write({
      ...privateTarget,
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
    assert.equal(await store.exists(publicTarget), true);
    assert.equal(await store.exists(privateTarget), true);
    assert.deepEqual(store.reference(publicTarget), publicObject);
    assert.deepEqual(store.reference(privateTarget), privateObject);
    assert.equal(
      await readFile(path.join(root, "public", "uploads", "v2-observations", "record-1", "photo.jpg"), "utf8"),
      "public-bytes",
    );
    assert.equal(
      await readFile(path.join(root, "private", "photo-originals", "v2-observations", "record-1", "photo.jpg"), "utf8"),
      "private-bytes",
    );

    assert.equal(
      await store.read(privateTarget).then((buffer) => buffer.toString("utf8")),
      "private-bytes",
    );
    await store.delete(privateTarget);
    assert.equal(await store.exists(privateTarget), false);
    await store.delete(privateTarget);
    assert.throws(
      () => store.reference({
        visibility: "private",
        storagePath: "../escape.jpg",
      }),
      /media_object_path_escape/,
    );
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


test("local media store rejects symlink paths that escape the visibility root", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ikimon-media-store-symlink-"));
  try {
    const publicRoot = path.join(root, "public");
    const privateRoot = path.join(root, "private");
    const outside = path.join(root, "outside.jpg");
    await mkdir(publicRoot, { recursive: true });
    await writeFile(outside, "sensitive-bytes");
    await symlink(outside, path.join(publicRoot, "linked.jpg"));
    const store = new LocalMediaObjectStore({ publicRoot, privateRoot });

    await assert.rejects(
      () => store.read({ visibility: "public", storagePath: "linked.jpg" }),
      /media_object_path_escape/,
    );
    await assert.rejects(
      () => store.write({ visibility: "public", storagePath: "linked.jpg", buffer: Buffer.from("overwrite") }),
      /media_object_path_escape/,
    );
    assert.equal(await readFile(outside, "utf8"), "sensitive-bytes");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test("local media store rejects dangling symlink leaves before writing outside the root", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ikimon-media-store-dangling-link-"));
  try {
    const publicRoot = path.join(root, "public");
    const outside = path.join(root, "outside", "created.jpg");
    await mkdir(publicRoot, { recursive: true });
    await mkdir(path.dirname(outside), { recursive: true });
    await symlink(outside, path.join(publicRoot, "linked.jpg"));
    const store = new LocalMediaObjectStore({ publicRoot, privateRoot: path.join(root, "private") });

    await assert.rejects(
      () => store.write({ visibility: "public", storagePath: "linked.jpg", buffer: Buffer.from("outside-write") }),
      /media_object_path_escape/,
    );
    await assert.rejects(() => readFile(outside), { code: "ENOENT" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test("local media store does not create missing parent directories through an escaping symlink", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ikimon-media-store-parent-link-"));
  try {
    const publicRoot = path.join(root, "public");
    const outsideRoot = path.join(root, "outside");
    await mkdir(publicRoot, { recursive: true });
    await mkdir(outsideRoot, { recursive: true });
    await symlink(outsideRoot, path.join(publicRoot, "linked"));
    const store = new LocalMediaObjectStore({ publicRoot, privateRoot: path.join(root, "private") });

    await assert.rejects(
      () => store.write({ visibility: "public", storagePath: "linked/new/nested.jpg", buffer: Buffer.from("outside-write") }),
      /media_object_path_escape/,
    );
    await assert.rejects(() => readFile(path.join(outsideRoot, "new")), { code: "ENOENT" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("concurrent writes can create the same missing media directory", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ikimon-media-store-concurrent-"));
  try {
    const store = new LocalMediaObjectStore({
      publicRoot: path.join(root, "public"),
      privateRoot: path.join(root, "private"),
    });
    const writes = Array.from({ length: 32 }, (_, index) => store.write({
      visibility: "public",
      storagePath: `uploads/shared/nested/photo-${index}.jpg`,
      buffer: Buffer.from(`photo-${index}`),
    }));
    const results = await Promise.allSettled(writes);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 32);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("exists and delete preserve missing-root behavior", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ikimon-media-store-missing-root-"));
  try {
    const store = new LocalMediaObjectStore({
      publicRoot: path.join(root, "not-created-public"),
      privateRoot: path.join(root, "not-created-private"),
    });
    const target = { visibility: "private" as const, storagePath: "audio/file.webm" };
    assert.equal(await store.exists(target), false);
    await assert.doesNotReject(() => store.delete(target));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
