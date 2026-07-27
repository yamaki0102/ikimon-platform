import assert from "node:assert/strict";
import test from "node:test";
import { MCP_TRANSPORT_POLICY } from "./server.js";

test("DB MCP transport activation is pinned to v2 stateless", () => {
  assert.deepEqual(MCP_TRANSPORT_POLICY, {
    implementationStatus: "skeleton",
    activationTarget: "v2_stateless",
    legacyLane: "forbidden",
    agentsVersion: "0.20.0",
    serverPackage: "@modelcontextprotocol/server@2.0.0-beta.5",
    stateBoundary: "application_database",
  });

  assert.doesNotMatch(MCP_TRANSPORT_POLICY.serverPackage, /@modelcontextprotocol\/sdk/);
});
