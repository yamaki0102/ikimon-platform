import test from "node:test";
import assert from "node:assert/strict";
import { encodeJisMesh1km, encodeJisMesh250m, encodeJisMeshCodes } from "./jisMesh.js";

test("encodeJisMesh1km returns a standard third mesh code", () => {
  assert.equal(encodeJisMesh1km(35.6586, 139.7454), "53393599");
});

test("encodeJisMesh250m appends two divided-mesh quadrant digits", () => {
  assert.equal(encodeJisMesh250m(35.6586, 139.7454), "5339359921");
});

test("encodeJisMeshCodes returns nulls outside the supported JIS mesh longitude range", () => {
  assert.deepEqual(encodeJisMeshCodes(35.0, 99.999), {
    mesh1km: null,
    mesh250m: null,
  });
});
