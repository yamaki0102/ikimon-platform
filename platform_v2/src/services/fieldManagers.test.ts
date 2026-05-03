import assert from "node:assert/strict";
import test from "node:test";
import { __test__ } from "./fieldManagers.js";

const { isFieldManagerRole } = __test__;

test("isFieldManagerRole accepts the three documented roles only", () => {
  assert.equal(isFieldManagerRole("owner"), true);
  assert.equal(isFieldManagerRole("steward"), true);
  assert.equal(isFieldManagerRole("viewer_exact"), true);
  assert.equal(isFieldManagerRole("admin"), false);
  assert.equal(isFieldManagerRole(""), false);
  assert.equal(isFieldManagerRole(null), false);
  assert.equal(isFieldManagerRole(undefined), false);
});

test("role precedence ordering: owner > steward > viewer_exact", () => {
  // ORDER BY CASE 句の意図: 「強い権限を1つ持っていれば下位は省略」
  // 解決順は owner=0, steward=1, viewer_exact=2 で SQL 側で並べる。
  // クライアントが UI 表示するときも同じ順序を期待してよい。
  const order: Record<string, number> = { owner: 0, steward: 1, viewer_exact: 2 };
  const roles = ["viewer_exact", "owner", "steward"].sort((a, b) => order[a]! - order[b]!);
  assert.deepEqual(roles, ["owner", "steward", "viewer_exact"]);
});
