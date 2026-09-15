import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { MAP_EXPLORER_STATE_RUNTIME } from "./mapExplorerState.js";

test("browser runtime serializes a safe viewport without missing helper references", () => {
  const context = vm.createContext({ result: "" });
  new vm.Script(
    MAP_EXPLORER_STATE_RUNTIME
      + "\nresult = MapExplorerStateHelpers.serializeSharedMapState({ center: { lng: 137.8589, lat: 34.7219 }, zoom: 13.6 });",
  ).runInContext(context);
  const params = new URLSearchParams(String(context.result));
  assert.equal(params.get("lng"), "137.8589");
  assert.equal(params.get("lat"), "34.7219");
  assert.equal(params.get("z"), "13.6");
});
