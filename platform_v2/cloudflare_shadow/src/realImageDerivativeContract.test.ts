import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readWorkerSourceSync } from "./workerSource.testSupport.js";

const source = readWorkerSourceSync();
const config = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");

test("image assets are re-encoded to verified WebP bytes", () => {
  assert.match(source, /cloudflare-images-public-derivative-v1/);
  assert.match(source, /asset\.mime\.startsWith\("image\/"\)/);
  assert.match(source, /images[\s\S]*\.output\(\{ format: "image\/webp", quality: 82, anim: false \}\)/);
  assert.match(source, /images\.info\(new Response\(originalBytes\.slice\(0\)\)\.body!\)/);
  assert.match(source, /\.input\(new Response\(originalBytes\.slice\(0\)\)\.body!\)/);
  assert.match(source, /contentType !== "image\/webp"/);
  assert.match(source, /persisted\.size !== derivativeBody\.byteLength/);
  assert.match(source, /public_ready_at = CURRENT_TIMESTAMP/);
});

test("image branch never publishes the SVG shadow derivative", () => {
  const imageStart = source.indexOf('if (asset.mime.startsWith("image/"))');
  const fallbackStart = source.indexOf('const publicDerivativeKey = `derived/', imageStart + 1);
  assert.ok(imageStart >= 0 && fallbackStart > imageStart);
  const imageBranch = source.slice(imageStart, fallbackStart);
  assert.doesNotMatch(imageBranch, /shadowDerivativeSvg/);
  assert.match(imageBranch, /createRealPublicImageDerivative/);
});

test("Images binding is configured for every deployed environment", () => {
  const parsed = JSON.parse(config);
  assert.equal(parsed.images.binding, "IMAGES");
  assert.equal(parsed.env.shadow.images.binding, "IMAGES");
  assert.equal(parsed.env.staging.images.binding, "IMAGES");
  assert.equal(parsed.env.production.images.binding, "IMAGES");
});
