import assert from "node:assert/strict";
import { test } from "node:test";

import { findPromptSchemaExampleLeakage } from "./checkPromptSchemaExampleLeakage.js";

test("flags concrete taxon names inside prompt JSON examples", () => {
  const source = [
    "## 出力 JSON スキーマ",
    "```json",
    "{",
    "  \"recommended_taxon_name\": \"カラスノエンドウ\",",
    "  \"recommended_scientific_name\": \"Vicia sativa subsp. nigra\"",
    "}",
    "```",
  ].join("\n");

  const failures = findPromptSchemaExampleLeakage(source, "prompt.md");

  assert.equal(failures.length, 2);
  assert.deepEqual(
    failures.map((failure) => failure.value),
    ["カラスノエンドウ", "Vicia sativa subsp. nigra"],
  );
});

test("allows placeholder-only prompt JSON examples", () => {
  const source = [
    "## 出力 JSON スキーマ",
    "```json",
    "{",
    "  \"recommended_taxon_name\": \"<主対象の表示名>\",",
    "  \"recommended_scientific_name\": \"<主対象の学名>\",",
    "  \"note\": \"...\"",
    "}",
    "```",
  ].join("\n");

  assert.deepEqual(findPromptSchemaExampleLeakage(source, "prompt.md"), []);
});

test("does not reject concrete prompt prose outside JSON examples", () => {
  const source = [
    "- 季節例: 4月中旬ならカラスノエンドウが花期。",
    "## 出力 JSON スキーマ",
    "```json",
    "{",
    "  \"seasonalNote\": \"季節・日時・位置から推論できる観察上のヒント\"",
    "}",
    "```",
  ].join("\n");

  assert.deepEqual(findPromptSchemaExampleLeakage(source, "prompt.md"), []);
});

test("flags unfenced output schema blocks", () => {
  const source = [
    "出力スキーマ:",
    "{",
    "  \"species\": \"Apis mellifera\"",
    "}",
    "",
    "制約:",
    "- JSON のみ",
  ].join("\n");

  const failures = findPromptSchemaExampleLeakage(source, "prompt.md");

  assert.equal(failures.length, 1);
  assert.equal(failures[0]?.value, "Apis mellifera");
});
