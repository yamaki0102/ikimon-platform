import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { listInvasiveSpecies } from "../../src/services/invasiveSpeciesCatalog";
import { renderInvasiveDetailDocument, renderInvasiveListDocument, renderInvasiveNotFoundDocument } from "../../src/ui/invasiveSpeciesPages";

const KANA = /[぀-ヿ]/;
const CAPTURE_SHEET_MARKER = '<input class="global-record-input"';
const sha = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

const visibleText = (html: string): string => {
  const cut = html.indexOf(CAPTURE_SHEET_MARKER);
  assert.ok(cut > 0, "capture sheet marker present");
  let out = html.slice(0, cut).replace(/<style[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, "");
  const attrs = [...out.matchAll(/\b(?:aria-label|placeholder|title|alt)="([^"]*)"/g)].map((m) => m[1]).join(" ");
  out = out.replace(/<[^>]+>/g, " ");
  return `${out} ${attrs}`;
};

const assertNoJapanese = (html: string, label: string): void => {
  const text = visibleText(html);
  const m = KANA.exec(text);
  assert.equal(m, null, `${label}: kana near "${m ? text.slice(Math.max(0, m.index - 60), m.index + 40) : ""}"`);
  const k = /[㐀-鿿]/.exec(text);
  assert.equal(k, null, `${label}: kanji near "${k ? text.slice(Math.max(0, k.index - 60), k.index + 40) : ""}"`);
};

test("English invasive guide list and every detail page have no Japanese UI text", () => {
  for (const lang of ["en", "es", "pt-BR"] as const) {
    const list = renderInvasiveListDocument({ basePath: "", lang, currentPath: "/en/learn/invasive-species" });
    assertNoJapanese(list, `list ${lang}`);
    assert.match(list, /Safety notes for finding an invasive species/);
    assert.match(list, /Ministry of the Environment, List of Designated Invasive Alien Species \(Japanese\)/);
  }
  for (const item of listInvasiveSpecies()) {
    const detail = renderInvasiveDetailDocument({ basePath: "", lang: "en", item, currentPath: `/en/learn/invasive-species/${item.slug}` });
    assertNoJapanese(detail, `detail ${item.slug}`);
    assert.match(detail, new RegExp(`<h2>${item.scientificName}</h2>`));
    assert.match(detail, /Open the official source \(Japanese\)/);
    assert.match(detail, /Care when recording/);
    assert.match(detail, /Whom to follow/);
  }
  assertNoJapanese(renderInvasiveNotFoundDocument({ basePath: "", lang: "en", currentPath: "/en/learn/invasive-species/nope" }), "not found");
});

test("Japanese invasive guide output is byte-identical to the pre-change render", () => {
  const items = new Map(listInvasiveSpecies().map((i) => [i.slug, i]));
  const ja = (slug: string): string => renderInvasiveDetailDocument({ basePath: "", lang: "ja", item: items.get(slug)!, currentPath: `/learn/invasive-species/${slug}?lang=ja` });
  assert.equal(sha(renderInvasiveListDocument({ basePath: "", lang: "ja", currentPath: "/learn/invasive-species?lang=ja" })), "18f388af008caba581a77e445f5ad566e1f0cc16d0c2694ba2e2346b823b4465");
  assert.equal(sha(ja("bombus-terrestris")), "296baefc9d21f64b41a793c026ee8663cc4de26357873e167db29968be9f0b88");
  assert.equal(sha(ja("myocastor-coypus")), "493c2f12f0be54e28131c7a675af729137494dee324e5d07527ca00cf8a14904");
  assert.equal(sha(renderInvasiveNotFoundDocument({ basePath: "", lang: "ja", currentPath: "/learn/invasive-species/nope?lang=ja" })), "287da9144f57869a09bb7b2b96072376a2be563237c7c7932601f046d447f0fa");
});
