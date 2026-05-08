import assert from "node:assert/strict";
import test from "node:test";
import { mapExplorerBootScript } from "./mapExplorer.js";

test("area polygon outline width keeps zoom expression at MapLibre-compatible top level", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });

  assert.match(
    script,
    /'line-width': \[\s+'interpolate', \['linear'\], \['zoom'\],\s+8,/,
  );
  assert.doesNotMatch(
    script,
    /'line-width': \[\s+'\*',\s+\['interpolate', \['linear'\], \['zoom'\]/,
  );
});
