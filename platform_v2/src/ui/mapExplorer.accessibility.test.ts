import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { mapExplorerBootScript, renderMapExplorer } from "./mapExplorer.js";

function section(script: string, start: string, end: string): string {
  const from = script.indexOf(start);
  const to = script.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `script section ${start}..${end} exists`);
  return script.slice(from, to);
}

function makeFixture() {
  const html = renderMapExplorer({ basePath: "", lang: "ja", years: [2026] });
  const close = { focusCalls: 0, focus() { this.focusCalls += 1; }, addEventListener() {} };
  const grip = { attrs: new Map<string, string>(), setAttribute(k: string, v: string) { this.attrs.set(k, v); } };
  const opener = { focusCalls: 0, focus() { this.focusCalls += 1; } };
  const inner = { querySelector: () => null };
  const classNames = new Set<string>();
  const attrs = new Map<string, string>([["aria-hidden", "true"]]);
  let keydown: ((event: any) => void) | undefined;
  const sheet: any = {
    classList: {
      add: (name: string) => classNames.add(name),
      remove: (name: string) => classNames.delete(name),
      contains: (name: string) => classNames.has(name),
    },
    style: { removeProperty() {} },
    setAttribute: (k: string, v: string) => attrs.set(k, v),
    getAttribute: (k: string) => attrs.get(k) ?? null,
    removeAttribute: (k: string) => attrs.delete(k),
    contains: (node: unknown) => node === sheet,
    addEventListener: (name: string, fn: (event: any) => void) => { if (name === "keydown") keydown = fn; },
    hasAttribute: (k: string) => attrs.has(k),
  };
  const document: any = {
    getElementById(id: string) {
      return ({ "me-bottom-sheet": sheet, "me-bottom-inner": inner, "me-bottom-close": close, "me-bottom-grip": grip } as any)[id] ?? null;
    },
    querySelector: () => null,
    activeElement: opener,
  };
  const context = vm.createContext({
    document,
    window: { localStorage: { getItem: () => null, setItem() {} }, addEventListener() {} },
    setTimeout, clearTimeout, URLSearchParams, URL, performance,
    requestAnimationFrame: (fn: () => void) => fn(),
    console,
    COPY: { bottomSheetCloseLabel: "Close", bottomSheetExpandLabel: "Expand", bottomSheetCollapseLabel: "Collapse" },
    resetAreaGuideStopSession() {}, setSelectedAreaPolygonFilter() {}, syncRainUi() {},
    closeFilterDrawer() {}, shouldKeepMapClearForRain: () => false,
    startPanelEl: null, dismissPurposeHint() {},
  });
  // Exercise the actual sheet handlers and lifecycle functions with only unrelated
  // module-level browser setup stubbed.
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const code = `var sheetEl = document.getElementById('me-bottom-sheet');
    var sheetInnerEl = document.getElementById('me-bottom-inner');
    var sheetCloseEl = document.getElementById('me-bottom-close');
    var sheetGripEl = document.getElementById('me-bottom-grip');
    var startPanelEl = null; var state = { selectedPoint: null };
    function resetAreaGuideStopSession(){} function setSelectedAreaPolygonFilter(){}
    function syncRainUi(){} function closeFilterDrawer(){} function shouldKeepMapClearForRain(){return false;}
    function dismissPurposeHint(){} function setStartPanelCollapsed(){}
    var sheetReturnFocusEl = null; var sheetFocusPending = false;
    ${section(script, "function sheetSupportsSnap()", "  function focusCellFeature(")}
    ${section(script, "function closeBottomSheet()", "  if (sheetGripEl) {")}`;
  new vm.Script(code).runInContext(context);
  return { html, context, sheet, close, opener, attrs, classNames, getKeydown: () => keydown };
}

test("closed map sheet is removed from keyboard focus order and opened sheet is labelled", () => {
  const f = makeFixture();
  assert.match(f.html, /id="me-bottom-sheet"[^>]*aria-hidden="true"/);
  assert.match(f.html, /id="me-bottom-sheet"[^>]*inert/);
  assert.match(f.html, /id="me-bottom-sheet"[^>]*role="dialog"/);
  f.context.showDetailBottomSheet();
  assert.equal(f.attrs.get("aria-hidden"), "false");
  assert.equal(f.attrs.has("inert"), false);
  assert.equal(f.close.focusCalls, 1, "opening moves keyboard focus into the sheet");
});

test("Escape closes the map sheet and returns focus to the opener", () => {
  const f = makeFixture();
  f.context.showDetailBottomSheet();
  const prevent = { prevented: false, preventDefault() { this.prevented = true; } };
  f.getKeydown()!({ key: "Escape", preventDefault: prevent.preventDefault.bind(prevent) });
  assert.equal(prevent.prevented, true);
  assert.equal(f.attrs.get("aria-hidden"), "true");
  assert.equal(f.attrs.has("inert"), true);
  assert.equal(f.opener.focusCalls, 1);
});


test("refreshing an open sheet preserves focus and area sheets share the keyboard lifecycle", () => {
  const f = makeFixture();
  f.context.showAreaBottomSheet();
  assert.equal(f.close.focusCalls, 1);
  f.context.showAreaBottomSheet();
  f.context.showDetailBottomSheet();
  assert.equal(f.close.focusCalls, 1, "refreshing content must not steal focus again");
  f.context.closeBottomSheet();
  assert.equal(f.opener.focusCalls, 1);
  assert.equal(f.attrs.has("inert"), true);
  f.getKeydown()!({ key: "Escape", preventDefault() { assert.fail("closed sheet ignores Escape"); } });
  assert.equal(f.opener.focusCalls, 1);
});
