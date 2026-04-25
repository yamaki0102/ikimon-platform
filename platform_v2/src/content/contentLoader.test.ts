import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createContentStore, fallbackChain, getShortCopy, resolveContentRoots } from "./index.js";

function withFixture(mutator: (fixtureRoot: string) => void): void {
  const roots = resolveContentRoots();
  const fixtureRoot = mkdtempSync(join(tmpdir(), "ikimon-content-"));
  cpSync(roots.shortRoot, join(fixtureRoot, "short"), { recursive: true });
  cpSync(roots.longformRoot, join(fixtureRoot, "longform"), { recursive: true });
  try {
    mutator(fixtureRoot);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

test("fallbackChain keeps requested language before canonical ja", () => {
  assert.deepEqual(fallbackChain("ja"), ["ja"]);
  assert.deepEqual(fallbackChain("en"), ["en", "ja"]);
  assert.deepEqual(fallbackChain("es"), ["es", "ja"]);
  assert.deepEqual(fallbackChain("pt-BR"), ["pt-BR", "ja"]);
});

test("content store loads canonical ja and partial fallback languages", () => {
  const store = createContentStore();
  const jaPublic = store.short.ja.public as any;
  const enPublic = store.short.en.public as any;
  const enShared = store.short.en.shared as any;

  assert.equal(jaPublic.landing.title, "ikimon — ENJOY NATURE | 近くの自然が、もっと楽しくなる");
  assert.equal(enPublic.landing.title, "ikimon.life — Walk, find, write it in the notebook");
  assert.equal(enPublic.marketing.pages.about.heading, jaPublic.marketing.pages.about.heading);
  assert.equal(enShared.shell.skipToContent, "Skip to content");
  assert.ok(store.longform.en["learn-field-loop"]);
  assert.match(store.longform.en["learn-field-loop"]!, /place-first observatory/);
});

test("getShortCopy throws on unknown content key", () => {
  assert.throws(() => getShortCopy("ja", "public", "read.lens.missingKey"), /Unknown content key/);
});

test("content store rejects keys that are not defined in canonical content", () => {
  withFixture((fixtureRoot) => {
    const enPublicPath = join(fixtureRoot, "short", "en", "public.json");
    const enPublic = JSON.parse(readFileSync(enPublicPath, "utf8")) as Record<string, unknown>;
    enPublic.unexpected = true;
    writeFileSync(enPublicPath, `${JSON.stringify(enPublic, null, 2)}\n`, "utf8");

    assert.throws(
      () =>
        createContentStore({
          shortRoot: join(fixtureRoot, "short"),
          longformRoot: join(fixtureRoot, "longform"),
        }),
      /canonical content/,
    );
  });
});

test("content store rejects schema mismatches in partial locales", () => {
  withFixture((fixtureRoot) => {
    const enPublicPath = join(fixtureRoot, "short", "en", "public.json");
    const enPublic = JSON.parse(readFileSync(enPublicPath, "utf8")) as any;
    enPublic.landing.title = 42;
    writeFileSync(enPublicPath, `${JSON.stringify(enPublic, null, 2)}\n`, "utf8");

    assert.throws(
      () =>
        createContentStore({
          shortRoot: join(fixtureRoot, "short"),
          longformRoot: join(fixtureRoot, "longform"),
        }),
      /scalar type/,
    );
  });
});
