import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveScanPointRoute,
  type ScanPointBinding,
} from "./scanPointRouter.js";

const binding = (overrides: Partial<ScanPointBinding> = {}): ScanPointBinding => ({
  scanPointId: "sp-renri-tree-01",
  publicRoute: "/scan/sp-renri-tree-01",
  targetKind: "natural_feature",
  targetId: "tree-renri-01",
  visibility: "public",
  lifecycle: "active",
  contentRevision: "rev-1",
  ...overrides,
});

test("resolves one active public ScanPoint to its stable public route", () => {
  assert.deepEqual(
    resolveScanPointRoute({ scanPointId: "sp-renri-tree-01", bindings: [binding()] }),
    {
      status: "resolved",
      scanPointId: "sp-renri-tree-01",
      publicRoute: "/scan/sp-renri-tree-01",
      targetKind: "natural_feature",
      targetId: "tree-renri-01",
      contentRevision: "rev-1",
    },
  );
});

test("content can change without changing the physical ScanPoint route", () => {
  const before = resolveScanPointRoute({ scanPointId: "sp-renri-tree-01", bindings: [binding()] });
  const after = resolveScanPointRoute({
    scanPointId: "sp-renri-tree-01",
    bindings: [binding({ contentRevision: "rev-2" })],
  });
  assert.equal(before.status, "resolved");
  assert.equal(after.status, "resolved");
  if (before.status === "resolved" && after.status === "resolved") {
    assert.equal(before.publicRoute, after.publicRoute);
    assert.notEqual(before.contentRevision, after.contentRevision);
  }
});



test("invalid ScanPoint identifiers fail closed", () => {
  for (const scanPointId of [null, 42, "", "   "]) {
    assert.deepEqual(
      resolveScanPointRoute({ scanPointId, bindings: [binding()] }),
      { status: "not_found", scanPointId: "", reason: "invalid_scan_point_id" },
    );
  }
});

test("unknown ScanPoint fails closed as not_found", () => {
  assert.deepEqual(
    resolveScanPointRoute({ scanPointId: "missing", bindings: [binding()] }),
    { status: "not_found", scanPointId: "missing", reason: "scan_point_not_found" },
  );
});

test("stale ScanPoint never resolves to a public route", () => {
  assert.deepEqual(
    resolveScanPointRoute({
      scanPointId: "sp-renri-tree-01",
      bindings: [binding({ lifecycle: "stale" })],
    }),
    { status: "stale", scanPointId: "sp-renri-tree-01", reason: "scan_point_binding_stale" },
  );
});

test("non-public target is rejected without revealing its route or target", () => {
  const result = resolveScanPointRoute({
    scanPointId: "sp-renri-tree-01",
    bindings: [binding({ visibility: "non_public", publicRoute: "/private/staff-only" })],
  });
  assert.deepEqual(result, {
    status: "non_public",
    scanPointId: "sp-renri-tree-01",
    reason: "scan_point_target_not_public",
  });
  assert.equal("publicRoute" in result, false);
  assert.equal("targetId" in result, false);
});

test("private target is rejected without revealing its route or target", () => {
  const result = resolveScanPointRoute({
    scanPointId: "sp-renri-tree-01",
    bindings: [binding({ visibility: "private", publicRoute: "/private/staff-only" })],
  });
  assert.deepEqual(result, {
    status: "non_public",
    scanPointId: "sp-renri-tree-01",
    reason: "scan_point_target_not_public",
  });
  assert.equal("publicRoute" in result, false);
  assert.equal("targetId" in result, false);
});

test("ambiguous duplicate bindings fail closed", () => {
  assert.deepEqual(
    resolveScanPointRoute({
      scanPointId: "sp-renri-tree-01",
      bindings: [binding(), binding({ targetId: "tree-renri-02" })],
    }),
    {
      status: "not_found",
      scanPointId: "sp-renri-tree-01",
      reason: "ambiguous_scan_point_binding",
    },
  );
});

test("unsafe or incomplete route bindings are stale rather than publishable", () => {
  for (const invalid of [
    binding({ publicRoute: "https://example.com/scan" }),
    binding({ publicRoute: "//external.example/scan" }),
    binding({ publicRoute: "/\\evil.example/scan" }),
    binding({ publicRoute: "/scan\tredirect" }),
    binding({ targetId: " " }),
    binding({ contentRevision: "" }),
    { ...binding(), targetKind: "staff_internal" as never },
  ]) {
    assert.deepEqual(
      resolveScanPointRoute({ scanPointId: "sp-renri-tree-01", bindings: [invalid] }),
      {
        status: "stale",
        scanPointId: "sp-renri-tree-01",
        reason: "scan_point_binding_invalid",
      },
    );
  }
});
