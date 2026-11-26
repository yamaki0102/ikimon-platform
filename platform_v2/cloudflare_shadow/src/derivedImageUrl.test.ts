import { test } from "node:test";
import assert from "node:assert/strict";
import { sizedImageUrl, sizedImgAttrs } from "./derivedImageUrl";

const raw = "/derived/import-smoke/20260615/observation_photo/abc/display.webp";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

test("derived display images route through the transform", () => {
  assert.equal(sizedImageUrl(raw, 680), "/derived-transform/w680/derived/import-smoke/20260615/observation_photo/abc/display.webp");
  const a = sizedImgAttrs(raw, 680, [360, 680, 1020], "100vw", esc);
  assert.match(a, /src="\/derived-transform\/w680\//);
  assert.match(a, /srcset="\/derived-transform\/w360\/[^"]+ 360w, [^"]+ 680w, [^"]+ 1020w" sizes="100vw"/);
});

test("non-derived, unsafe or empty urls pass through unchanged", () => {
  assert.equal(sizedImageUrl("/assets/img/x.webp", 680), "/assets/img/x.webp");
  assert.equal(sizedImageUrl("/derived/a/../b/display.webp", 680), "/derived/a/../b/display.webp");
  assert.equal(sizedImageUrl("/derived/a/original.jpg", 680), "/derived/a/original.jpg");
  assert.equal(sizedImageUrl("https://example.com/derived/a/display.webp", 680), "https://example.com/derived/a/display.webp");
  assert.equal(sizedImageUrl(null, 680), "");
  assert.equal(sizedImgAttrs("/assets/x.png", 680, [360], "1px", esc), 'src="/assets/x.png"');
});
