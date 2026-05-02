import { test } from "node:test";
import assert from "node:assert/strict";
import { toThumbnailUrl } from "./thumbnailUrl.js";

test("returns null for null/empty", () => {
  assert.equal(toThumbnailUrl(null, "sm"), null);
  assert.equal(toThumbnailUrl("", "sm"), null);
});

test("passes through external URLs", () => {
  assert.equal(toThumbnailUrl("https://cdn.example.com/x.jpg", "sm"), "https://cdn.example.com/x.jpg");
});

test("passes through non-image paths", () => {
  assert.equal(toThumbnailUrl("/uploads/notes/a.txt", "sm"), "/uploads/notes/a.txt");
});

test("rewrites /uploads/ image paths", () => {
  assert.equal(
    toThumbnailUrl("/uploads/photos/abc/photo_0.webp", "sm"),
    "/thumb/sm/photos/abc/photo_0.webp",
  );
});

test("rewrites /data/uploads/ image paths", () => {
  assert.equal(
    toThumbnailUrl("/data/uploads/photos/abc/photo_0.jpg", "md"),
    "/thumb/md/photos/abc/photo_0.jpg",
  );
});

test("supports all presets", () => {
  assert.equal(toThumbnailUrl("/uploads/x.png", "sm"), "/thumb/sm/x.png");
  assert.equal(toThumbnailUrl("/uploads/x.png", "md"), "/thumb/md/x.png");
  assert.equal(toThumbnailUrl("/uploads/x.png", "lg"), "/thumb/lg/x.png");
});
