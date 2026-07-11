import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MAP_EXPLORER_STYLES, mapExplorerBootScript, renderMapExplorer } from "./mapExplorer.js";

const html = renderMapExplorer({ basePath: "", lang: "ja", years: [2026, 2025] });
const styles = MAP_EXPLORER_STYLES;
const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
const stagingSpec = readFileSync(new URL("../../e2e/map.staging.spec.ts", import.meta.url), "utf8");

test("mobile map exposes three primary layers and preserves advanced layers in the drawer", () => {
  assert.match(html, /data-mobile-primary-map-controls/);
  assert.match(html, /<summary class="me-filter-toggle">詳しく絞る<\/summary>/);
  assert.match(html, /data-filter-tab="rain"/);
  assert.match(html, /data-filter-tab="frontier"/);
  assert.match(styles, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.me-tab\[data-tab="rain"\],[\s\S]*\.me-tab\[data-tab="frontier"\] \{\s*display: none;/);
});

test("mobile map keeps enough map area and removes the duplicate collapsed locate grid", () => {
  assert.match(styles, /--me-enjoy-h: 38px/);
  assert.match(styles, /\.me-start-panel\.is-collapsed \.me-start-panel-grid \{\s*display: none;/);
  assert.match(styles, /\.me-map-role-strip span,[\s\S]*\.me-map-role-strip em \{\s*display: none;/);
});

test("mobile map panels use one shared mutually-exclusive control path", () => {
  assert.match(script, /var filterDrawerEl = document\.querySelector\('\.me-filter-drawer'\)/);
  assert.match(script, /function closeFilterDrawer\(\)/);
  assert.match(script, /filterDrawerEl\.addEventListener\('toggle'/);
  assert.match(script, /closeBottomSheet\(\);[\s\S]*setStartPanelCollapsed\(true\);[\s\S]*hideLayerHint\(\);/);
  assert.match(styles, /\.me-filter-open \.me-rain-card,[\s\S]*\.me-filter-open \.me-legend \{[\s\S]*visibility: hidden;[\s\S]*pointer-events: none;/);
});

test("mobile map staging QA uses the existing deterministic helpers", () => {
  assert.doesNotMatch(stagingSpec, /installMapApiStubs|waitForMapReady/);
  assert.match(stagingSpec, /installMapLibreStubForSmoke\(page\)/);
  assert.match(stagingSpec, /installDeterministicMapApiFixtures\(page\)/);
  assert.match(stagingSpec, /waitForMapShellReady\(page, "\/map", true\)/);
});
