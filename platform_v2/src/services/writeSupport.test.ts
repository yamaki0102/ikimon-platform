import assert from "node:assert/strict";
import test from "node:test";

import { buildPlaceName } from "./writeSupport.js";

test("buildPlaceName uses a neutral fallback instead of platform version copy", () => {
  assert.equal(buildPlaceName({}), "Unknown place");
});
