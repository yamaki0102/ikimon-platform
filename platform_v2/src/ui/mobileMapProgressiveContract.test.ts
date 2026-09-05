import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MAP_EXPLORER_STYLES, mapExplorerBootScript, renderMapExplorer } from "./mapExplorer.js";

const html = renderMapExplorer({ basePath: "", lang: "ja", years: [2026, 2025] });
const styles = MAP_EXPLORER_STYLES;
const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
const stagingSpec = readFileSync(new URL("../../e2e/map.staging.spec.ts", import.meta.url), "utf8");

test("mobile map exposes two primary layers and one advanced-layer selector in the drawer", () => {
  assert.match(html, /data-mobile-primary-map-controls/);
  assert.match(html, /<summary class="me-filter-toggle">詳しく絞る<\/summary>/);
  assert.match(html, /data-filter-tab="rain"/);
  assert.match(html, /data-filter-tab="frontier"/);
  const primary = html.match(/data-mobile-primary-map-controls>([\s\S]*?)<\/div>/)?.[1] ?? "";
  assert.equal((primary.match(/role="tab"/g) ?? []).length, 2);
  assert.match(styles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  for (const layer of ["heatmap", "rain", "frontier"]) {
    assert.equal((html.match(new RegExp(`data-filter-tab="${layer}"`, "g")) ?? []).length, 1);
    assert.doesNotMatch(html, new RegExp(`data-tab="${layer}"`));
  }
});

test("mobile map keeps enough map area and removes the duplicate collapsed locate grid", () => {
  assert.match(styles, /--me-enjoy-h: 38px/);
  assert.match(styles, /\.me-start-panel\.is-collapsed \.me-start-panel-grid \{\s*display: none;/);
  assert.match(styles, /\.me-map-role-strip span,[\s\S]*\.me-map-role-strip em \{\s*display: none;/);
});

test("mobile map panels use one shared mutually-exclusive control path", () => {
  assert.match(script, /var filterDrawerEl = document\.querySelector\('\.me-filter-drawer'\)/);
  assert.match(script, /var mapShellEl = root\.closest\('\.me-section'\) \|\| root\.parentElement/);
  assert.match(script, /function closeFilterDrawer\(\)/);
  assert.match(script, /if \(mapShellEl\) mapShellEl\.classList\.remove\('me-filter-open'\)/);
  assert.match(script, /filterDrawerEl\.addEventListener\('toggle'/);
  assert.match(script, /if \(mapShellEl\) mapShellEl\.classList\.toggle\('me-filter-open', open\)/);
  assert.doesNotMatch(script, /root\.classList\.(?:toggle|remove)\('me-filter-open'/);
  assert.match(script, /closeBottomSheet\(\);[\s\S]*setStartPanelCollapsed\(true\);[\s\S]*hideLayerHint\(\);/);
  assert.match(styles, /\.me-filter-open \.me-rain-card,[\s\S]*\.me-filter-open \.me-legend \{[\s\S]*visibility: hidden;[\s\S]*pointer-events: none;/);
});

test("mobile map staging QA uses the existing deterministic helpers", () => {
  assert.doesNotMatch(stagingSpec, /installMapApiStubs|waitForMapReady/);
  assert.match(stagingSpec, /installMapLibreStubForSmoke\(page\)/);
  assert.match(stagingSpec, /installDeterministicMapApiFixtures\(page\)/);
  assert.match(stagingSpec, /waitForMapShellReady\(page, "\/map", true\)/);
});
