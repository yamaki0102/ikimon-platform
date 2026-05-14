import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  buildIdentificationTaxonSearchTerms,
  inferReferenceTaxonLinks,
  resolveCommerceCountryCode,
} from "./referenceLibrary.js";

test("reference taxon inference makes crow books reusable for crow and bird identifications", () => {
  const links = inferReferenceTaxonLinks({
    title: "日本のカラス類と野鳥図鑑",
    taxonHints: [],
    sourceKind: "field_guide",
  });
  const names = links.map((link) => link.taxonName);
  assert.ok(names.includes("カラス類"));
  assert.ok(names.includes("鳥類"));
  assert.ok(names.includes("日本産鳥類"));
});

test("identification taxon search terms expand ハシブトガラス to reusable reference groups", () => {
  const terms = buildIdentificationTaxonSearchTerms({
    proposedName: "ハシブトガラス",
    vernacularName: null,
    scientificName: "Corvus macrorhynchos",
  });
  assert.ok(terms.includes("ハシブトガラス"));
  assert.ok(terms.includes("カラス類"));
  assert.ok(terms.includes("鳥類"));
  assert.ok(terms.includes("日本産鳥類"));
});

test("commerce country resolution uses explicit user setting before locale and accept-language", () => {
  assert.equal(resolveCommerceCountryCode({ userCountryCode: "US", locale: "ja-JP", acceptLanguage: "ja-JP,ja;q=0.9" }), "US");
  assert.equal(resolveCommerceCountryCode({ locale: "pt-BR" }), "BR");
  assert.equal(resolveCommerceCountryCode({ acceptLanguage: "en-US,en;q=0.8" }), "US");
  assert.equal(resolveCommerceCountryCode({}), "JP");
});

test("reference library schema enforces private proofs, official corrections, and affiliate disclosure", async () => {
  const migration = await readFile(path.join(process.cwd(), "db", "migrations", "0104_reference_library_and_commerce.sql"), "utf8");
  const service = await readFile(path.join(process.cwd(), "src", "services", "referenceLibrary.ts"), "utf8");
  const writeRoutes = await readFile(path.join(process.cwd(), "src", "routes", "write.ts"), "utf8");
  const app = await readFile(path.join(process.cwd(), "src", "app.ts"), "utf8");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS user_reference_access_proofs/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS knowledge_source_reference_metadata/);
  assert.doesNotMatch(migration, /ALTER TABLE knowledge_sources/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS identification_references/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS knowledge_source_corrections/);
  assert.match(migration, /official_confirmed[^;]*official_source_url/s);
  assert.match(migration, /source_commerce_links_affiliate_disclosure_chk/);
  assert.match(migration, /requires_product_advertising_api/);

  assert.match(service, /publicUrl: null/);
  assert.match(service, /public_url_forbidden/);
  assert.match(service, /rag_prompt_forbidden/);
  assert.match(service, /ocr_full_text_forbidden/);
  assert.match(service, /affiliate_disclosure_required is true/);

  assert.match(writeRoutes, /\/api\/v1\/references\/capture-batches/);
  assert.match(writeRoutes, /\/api\/v1\/references\/:sourceId\/corrections/);
  assert.match(app, /registerReferenceRoutes/);
});
