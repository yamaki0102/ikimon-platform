import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./mapExplorer.ts", import.meta.url), "utf8");

test("mobile map exposes three primary layers and preserves advanced layers in the drawer", () => {
  assert.match(source, /data-mobile-primary-map-controls/);
  assert.match(source, /詳しく絞る/);
  assert.match(source, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(source, /\.me-tab\[data-tab="rain"\],[\s\S]*\.me-tab\[data-tab="frontier"\] \{\s*display: none;/);
  assert.match(source, /data-filter-tab="rain"/);
  assert.match(source, /data-filter-tab="frontier"/);
});

test("mobile map keeps enough map area and removes the duplicate collapsed locate grid", () => {
  assert.match(source, /--me-enjoy-h: 38px/);
  assert.match(source, /\.me-start-panel\.is-collapsed \.me-start-panel-grid \{\s*display: none;/);
  assert.match(source, /\.me-map-role-strip span,[\s\S]*\.me-map-role-strip em \{\s*display: none;/);
});

test("mobile map panels use one shared mutually-exclusive control path", () => {
  assert.match(source, /var filterDrawerEl = document\.querySelector\('\.me-filter-drawer'\)/);
  assert.match(source, /function closeFilterDrawer\(\)/);
  assert.match(source, /filterDrawerEl\.addEventListener\('toggle'/);
  assert.match(source, /closeBottomSheet\(\);[\s\S]*setStartPanelCollapsed\(true\);[\s\S]*hideLayerHint\(\);/);
  assert.match(source, /\.me-filter-open \.me-rain-card,[\s\S]*\.me-filter-open \.me-legend \{[\s\S]*visibility: hidden;[\s\S]*pointer-events: none;/);
});
