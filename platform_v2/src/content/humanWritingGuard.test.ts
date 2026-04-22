import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createContentStore } from "./index.js";

type HumanWritingPolicy = {
  allowedJaLatinTokens: string[];
  bannedJaPhrases: string[];
  productionBannedTransplants: string[];
};

const policy = JSON.parse(
  readFileSync(fileURLToPath(new URL("./humanWritingPolicy.json", import.meta.url)), "utf8"),
) as HumanWritingPolicy;

const store = createContentStore();
const ignoredLeafKeys = new Set([
  "href",
  "ctaHref",
  "variant",
  "bodyPageId",
  "activeNav",
  "value",
  "numberLocale",
  "statLabelTemplateId",
]);
const allowedLatinTokens = new Set(policy.allowedJaLatinTokens);

function collectVisibleStrings(value: unknown, path: string[] = [], out: Array<{ path: string; text: string }> = []): Array<{ path: string; text: string }> {
  if (typeof value === "string") {
    const leaf = path[path.length - 1] ?? "";
    if (!ignoredLeafKeys.has(leaf)) {
      out.push({ path: path.join("."), text: value });
    }
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectVisibleStrings(item, [...path, String(index)], out));
    return out;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      collectVisibleStrings(item, [...path, key], out);
    }
  }
  return out;
}

function sanitizeForLatinTokenScan(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, " ")
    .replace(/\b[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, " ")
    .replace(/\/[A-Za-z0-9._/?#&=%-]+/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
    .replace(/&[A-Za-z0-9#]+;/g, " ");
}

function extractLatinTokens(text: string): string[] {
  return sanitizeForLatinTokenScan(text).match(/[A-Za-z][A-Za-z0-9.-]*/g) ?? [];
}

test("canonical ja content avoids banned phrases and old production transplant copy", () => {
  const shortVisibleStrings = [
    ...collectVisibleStrings(store.short.ja.shared),
    ...collectVisibleStrings(store.short.ja.public),
    ...collectVisibleStrings(store.short.ja.ops),
    ...collectVisibleStrings(store.short.ja.specialist),
  ];

  for (const entry of shortVisibleStrings) {
    const sanitizedText = sanitizeForLatinTokenScan(entry.text);
    for (const phrase of [...policy.bannedJaPhrases, ...policy.productionBannedTransplants]) {
      assert.doesNotMatch(
        sanitizedText,
        new RegExp(phrase, "i"),
        `${entry.path} should not include banned phrase: ${phrase}`,
      );
    }
  }

  for (const [pageId, markdown] of Object.entries(store.longform.ja)) {
    const sanitizedMarkdown = sanitizeForLatinTokenScan(markdown);
    for (const phrase of [...policy.bannedJaPhrases, ...policy.productionBannedTransplants]) {
      assert.doesNotMatch(
        sanitizedMarkdown,
        new RegExp(phrase, "i"),
        `${pageId} should not include banned phrase: ${phrase}`,
      );
    }
  }
});

test("canonical ja visible text avoids unexplained latin tokens", () => {
  const visibleStrings = [
    ...collectVisibleStrings(store.short.ja.shared),
    ...collectVisibleStrings(store.short.ja.public),
    ...collectVisibleStrings(store.short.ja.ops),
    ...collectVisibleStrings(store.short.ja.specialist),
    ...Object.entries(store.longform.ja).map(([pageId, markdown]) => ({ path: `longform.${pageId}`, text: markdown })),
  ];

  for (const entry of visibleStrings) {
    for (const token of extractLatinTokens(entry.text)) {
      assert.ok(
        allowedLatinTokens.has(token),
        `${entry.path} should not include unexplained latin token: ${token}`,
      );
    }
  }
});
