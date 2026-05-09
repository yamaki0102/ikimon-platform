import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("user upsert preserves existing privileged roles unless incoming role is privileged", async () => {
  const source = await readFile(path.join(process.cwd(), "src/services/userWrite.ts"), "utf8");

  assert.match(source, /role_name = case[\s\S]*lower\(coalesce\(excluded\.role_name, ''\)\) in \('admin', 'analyst'\)[\s\S]*then excluded\.role_name/);
  assert.match(source, /role_name = case[\s\S]*lower\(coalesce\(users\.role_name, ''\)\) in \('admin', 'analyst'\)[\s\S]*then users\.role_name/);
  assert.match(source, /rank_label = case[\s\S]*coalesce\(users\.rank_label, ''\) in \('管理者', '分析担当'\)[\s\S]*then users\.rank_label/);
});
