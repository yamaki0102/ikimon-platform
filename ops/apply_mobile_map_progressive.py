from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(source: str, old: str, new: str, label: str, count: int = 1) -> str:
    found = source.count(old)
    if found != count:
        raise SystemExit(f"{label}: expected {count} matches, found {found}")
    return source.replace(old, new, count)


map_path = ROOT / "platform_v2/src/ui/mapExplorer.ts"
source = map_path.read_text(encoding="utf-8")

source = replace_once(
    source,
    '''  const filterToggleLabel = lang === "ja"
    ? "レイヤー"
    : lang === "es"
      ? "Filtros"
      : lang === "pt-BR"
        ? "Filtros"
        : "Filters";''',
    '''  const filterToggleLabel = lang === "ja"
    ? "詳しく絞る"
    : lang === "es"
      ? "Más filtros"
      : lang === "pt-BR"
        ? "Mais filtros"
        : "More filters";''',
    "filter toggle copy",
)
source = replace_once(
    source,
    '''        <div class="me-tabs" role="tablist" aria-label="${escapeHtml(copy.tabAriaLabel)}">
          ${renderMapLayerTab("markers", copy.tabMarkers, mobileTabLabels.markers)}
          ${renderMapLayerTab("heatmap", copy.tabHeatmap, mobileTabLabels.heatmap)}
          ${renderMapLayerTab("places", copy.tabPlaces, mobileTabLabels.places, true)}''',
    '''        <div class="me-tabs" role="tablist" aria-label="${escapeHtml(copy.tabAriaLabel)}" data-mobile-primary-map-controls>
          ${renderMapLayerTab("markers", copy.tabMarkers, mobileTabLabels.markers)}
          ${renderMapLayerTab("places", copy.tabPlaces, mobileTabLabels.places, true)}
          ${renderMapLayerTab("heatmap", copy.tabHeatmap, mobileTabLabels.heatmap)}''',
    "primary tab order and contract",
)
source = replace_once(
    source,
    """  var startPanelRoutesStaticHtml = startPanelRoutesEl && startPanelRoutesEl.querySelector('nav')
    ? startPanelRoutesEl.querySelector('nav').innerHTML
    : '';
  var sheetEl = document.getElementById('me-bottom-sheet');""",
    """  var startPanelRoutesStaticHtml = startPanelRoutesEl && startPanelRoutesEl.querySelector('nav')
    ? startPanelRoutesEl.querySelector('nav').innerHTML
    : '';
  var filterDrawerEl = document.querySelector('.me-filter-drawer');
  var sheetEl = document.getElementById('me-bottom-sheet');""",
    "filter drawer handle",
)
source = replace_once(
    source,
    """  function setStartPanelCollapsed(collapsed) {
    if (!startPanelEl) return;
    startPanelEl.classList.toggle('is-collapsed', !!collapsed);
    startPanelEl.setAttribute('aria-hidden', 'false');
    if (startPanelCloseEl) {
      startPanelCloseEl.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      var startPanelSymbolEl = startPanelCloseEl.querySelector('.me-start-panel-symbol');
      if (startPanelSymbolEl) {
        startPanelSymbolEl.textContent = collapsed ? '⌄' : '×';
      } else {
        startPanelCloseEl.textContent = collapsed ? '⌄' : '×';
      }
    }
  }
""",
    """  function setStartPanelCollapsed(collapsed) {
    if (!startPanelEl) return;
    startPanelEl.classList.toggle('is-collapsed', !!collapsed);
    startPanelEl.setAttribute('aria-hidden', 'false');
    if (startPanelCloseEl) {
      startPanelCloseEl.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      var startPanelSymbolEl = startPanelCloseEl.querySelector('.me-start-panel-symbol');
      if (startPanelSymbolEl) {
        startPanelSymbolEl.textContent = collapsed ? '⌄' : '×';
      } else {
        startPanelCloseEl.textContent = collapsed ? '⌄' : '×';
      }
    }
  }
  function closeFilterDrawer() {
    if (!filterDrawerEl) return;
    filterDrawerEl.removeAttribute('open');
    root.classList.remove('me-filter-open');
  }
""",
    "close filter drawer helper",
)
source = replace_once(
    source,
    """  function showDetailBottomSheet() {
    if (!sheetEl) return;
    if (shouldKeepMapClearForRain()) {""",
    """  function showDetailBottomSheet() {
    if (!sheetEl) return;
    closeFilterDrawer();
    if (startPanelEl && !startPanelEl.hidden) setStartPanelCollapsed(true);
    if (shouldKeepMapClearForRain()) {""",
    "detail sheet exclusion",
)
source = replace_once(
    source,
    """  function showAreaBottomSheet() {
    if (!sheetEl) return;
    if (shouldKeepMapClearForRain()) {""",
    """  function showAreaBottomSheet() {
    if (!sheetEl) return;
    closeFilterDrawer();
    if (startPanelEl && !startPanelEl.hidden) setStartPanelCollapsed(true);
    if (shouldKeepMapClearForRain()) {""",
    "area sheet exclusion",
)
source = replace_once(
    source,
    """      switchMapTab(t);
      var drawer = btn.closest && btn.closest('.me-filter-drawer');
      if (drawer) drawer.removeAttribute('open');
    });
  });
  if (layerHintJumpEl) {""",
    """      switchMapTab(t);
      closeFilterDrawer();
    });
  });
  if (filterDrawerEl) {
    filterDrawerEl.addEventListener('toggle', function () {
      var open = filterDrawerEl.hasAttribute('open');
      root.classList.toggle('me-filter-open', open);
      if (!open) return;
      closeBottomSheet();
      if (startPanelEl && !startPanelEl.hidden) setStartPanelCollapsed(true);
      hideLayerHint();
    });
  }
  if (layerHintJumpEl) {""",
    "filter drawer toggle exclusion",
)
source = replace_once(
    source,
    """      --me-topbar-h: 94px;
      --me-enjoy-h: 70px;""",
    """      --me-topbar-h: 94px;
      --me-enjoy-h: 38px;""",
    "mobile map height allocation",
)
source = replace_once(
    source,
    """    .me-map-role-strip {
      grid-template-columns: 1fr;
      align-content: center;
      gap: 4px;
      padding: 8px 12px;
    }
    .me-map-role-strip strong {
      white-space: normal;
      font-size: 12px;
    }
    .me-map-role-strip span {
      white-space: normal;
      display: block;
      font-size: 11px;
      line-height: 1.35;
    }
    .me-map-role-strip em {
      width: fit-content;
      font-size: 10px;
      white-space: normal;
    }""",
    """    .me-map-role-strip {
      grid-template-columns: 1fr;
      align-content: center;
      gap: 0;
      padding: 5px 12px;
    }
    .me-map-role-strip strong {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 12px;
    }
    .me-map-role-strip span,
    .me-map-role-strip em {
      display: none;
    }""",
    "compact map role strip",
)
source = replace_once(
    source,
    """      grid-template-columns: repeat(5, minmax(0, 1fr));
      width: 100%;""",
    """      grid-template-columns: repeat(3, minmax(0, 1fr));
      width: 100%;""",
    "three primary mobile tabs",
)
source = replace_once(
    source,
    """      grid-template-columns: repeat(5, minmax(0, 1fr));
      align-self: center;""",
    """      grid-template-columns: repeat(3, minmax(0, 1fr));
      align-self: center;""",
    "three rain mode exit tabs",
)
source = replace_once(
    source,
    """    .me-tabs::-webkit-scrollbar { display: none; }
    .me-tab {""",
    """    .me-tabs::-webkit-scrollbar { display: none; }
    .me-tab[data-tab="rain"],
    .me-tab[data-tab="frontier"] {
      display: none;
    }
    .me-tab {""",
    "hide advanced primary tabs on mobile",
)
source = replace_once(
    source,
    """    .me-filter-toggle {
      min-width: 76px;
      min-height: 38px;
      padding: 0 13px;
    }""",
    """    .me-filter-toggle {
      min-width: 96px;
      min-height: 38px;
      padding: 0 12px;
    }
    .me-filter-drawer[open] .me-filter-toggle {
      background: rgba(15,118,110,.12);
      border-color: rgba(15,118,110,.28);
      color: #0f766e;
    }""",
    "mobile filter control",
)
filter_panel = """    .me-filter-panel {
      position: fixed;
      top: auto;
      right: 8px;
      left: 8px;
      bottom: calc(var(--me-mobile-action-space) + 8px);
      z-index: 80;
      width: auto;
      max-width: none;
      max-height: min(560px, calc(100dvh - var(--me-header-h) - var(--me-topbar-h) - var(--me-mobile-action-space) - 20px));
      border-radius: 22px 22px 16px 16px;
      box-shadow: 0 18px 42px rgba(15,23,42,.22);
      backdrop-filter: blur(12px);
    }
"""
source = replace_once(
    source,
    filter_panel,
    filter_panel + """    .me-filter-open .me-rain-card,
    .me-filter-open .me-own-trail,
    .me-filter-open .me-layer-hint,
    .me-filter-open .me-locate-fab,
    .me-filter-open .me-legend {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
""",
    "filter drawer overlay exclusion",
)
source = replace_once(
    source,
    """    .me-start-panel.is-collapsed {
      max-width: min(286px, calc(100% - 82px));
      padding: 4px;
    }""",
    """    .me-start-panel.is-collapsed {
      max-width: min(286px, calc(100% - 82px));
      grid-template-columns: auto;
      padding: 4px;
    }""",
    "collapsed start panel columns",
)
source = replace_once(
    source,
    """    .me-start-panel.is-collapsed .me-start-panel-grid {
      grid-template-columns: 34px;
      gap: 0;
    }""",
    """    .me-start-panel.is-collapsed .me-start-panel-grid {
      display: none;
    }""",
    "remove duplicate locate control",
)
map_path.write_text(source, encoding="utf-8")


test_path = ROOT / "platform_v2/src/ui/mapExplorer.test.ts"
test_source = test_path.read_text(encoding="utf-8")
test_source = replace_once(
    test_source,
    '  assert.match(html, /<summary class="me-filter-toggle">レイヤー<\\/summary>/);',
    '  assert.match(html, /<summary class="me-filter-toggle">詳しく絞る<\\/summary>/);',
    "filter label test",
)
test_source = replace_once(
    test_source,
    '''  assert.match(styles, /\\.me-start-panel\\.is-collapsed \\{[\\s\\S]*grid-template-columns: auto auto;/);
  assert.doesNotMatch(styles, /\\.me-start-panel\\.is-collapsed \\.me-start-panel-grid \\{\\s*display: none;/);''',
    '''  assert.match(styles, /@media \\(max-width: 900px\\)[\\s\\S]*\\.me-start-panel\\.is-collapsed \\{[\\s\\S]*grid-template-columns: auto;/);
  assert.match(styles, /@media \\(max-width: 900px\\)[\\s\\S]*\\.me-start-panel\\.is-collapsed \\.me-start-panel-grid \\{\\s*display: none;/);''',
    "collapsed panel tests",
)
test_source = replace_once(
    test_source,
    '''test("mobile layer tabs fit within the topbar instead of clipping the final tab", () => {
  const styles = MAP_EXPLORER_STYLES;

  assert.match(styles, /@media \\(max-width: 900px\\)[\\s\\S]*\\.me-tabs \\{[\\s\\S]*display: grid;[\\s\\S]*grid-template-columns: repeat\\(5, minmax\\(0, 1fr\\)\\);[\\s\\S]*overflow: hidden;/);
  assert.doesNotMatch(styles, /@media \\(max-width: 900px\\)[\\s\\S]*\\.me-tab\\[data-tab="frontier"\\] \\{[\\s\\S]*display: none;/);
  assert.match(styles, /@media \\(max-width: 900px\\)[\\s\\S]*\\.me-tab \\{[\\s\\S]*min-width: 0;[\\s\\S]*text-overflow: ellipsis;/);
});''',
    '''test("mobile map keeps three primary tabs and moves advanced layers into the details drawer", () => {
  const html = renderMapExplorer({ basePath: "", lang: "ja", years: [2026, 2025] });
  const styles = MAP_EXPLORER_STYLES;

  assert.match(html, /data-mobile-primary-map-controls/);
  assert.match(html, /data-filter-tab="rain"/);
  assert.match(html, /data-filter-tab="frontier"/);
  assert.match(styles, /@media \\(max-width: 900px\\)[\\s\\S]*\\.me-tabs \\{[\\s\\S]*display: grid;[\\s\\S]*grid-template-columns: repeat\\(3, minmax\\(0, 1fr\\)\\);[\\s\\S]*overflow: hidden;/);
  assert.match(styles, /@media \\(max-width: 900px\\)[\\s\\S]*\\.me-tab\\[data-tab="rain"\\],[\\s\\S]*\\.me-tab\\[data-tab="frontier"\\] \\{[\\s\\S]*display: none;/);
  assert.match(styles, /@media \\(max-width: 900px\\)[\\s\\S]*--me-enjoy-h: 38px;/);
  assert.match(styles, /@media \\(max-width: 900px\\)[\\s\\S]*\\.me-map-role-strip span,[\\s\\S]*\\.me-map-role-strip em \\{[\\s\\S]*display: none;/);
  assert.match(styles, /@media \\(max-width: 900px\\)[\\s\\S]*\\.me-tab \\{[\\s\\S]*min-width: 0;[\\s\\S]*text-overflow: ellipsis;/);
});

test("mobile map panels are mutually exclusive", () => {
  const script = mapExplorerBootScript({ basePath: "", lang: "ja" });
  const styles = MAP_EXPLORER_STYLES;

  assert.match(script, /var filterDrawerEl = document\\.querySelector\\('\\.me-filter-drawer'\\)/);
  assert.match(script, /function closeFilterDrawer\\(\\)/);
  assert.match(script, /filterDrawerEl\\.addEventListener\\('toggle'[\\s\\S]*closeBottomSheet\\(\\);[\\s\\S]*setStartPanelCollapsed\\(true\\);[\\s\\S]*hideLayerHint\\(\\);/);
  assert.match(script, /function showDetailBottomSheet\\(\\) \\{[\\s\\S]*closeFilterDrawer\\(\\);[\\s\\S]*setStartPanelCollapsed\\(true\\);/);
  assert.match(script, /function showAreaBottomSheet\\(\\) \\{[\\s\\S]*closeFilterDrawer\\(\\);[\\s\\S]*setStartPanelCollapsed\\(true\\);/);
  assert.match(styles, /\\.me-filter-open \\.me-rain-card,[\\s\\S]*\\.me-filter-open \\.me-legend \\{[\\s\\S]*visibility: hidden;[\\s\\S]*pointer-events: none;/);
});''',
    "mobile progressive contract tests",
)
test_path.write_text(test_source, encoding="utf-8")


e2e_path = ROOT / "platform_v2/e2e/map.staging.spec.ts"
e2e_source = e2e_path.read_text(encoding="utf-8")
e2e_source = replace_once(
    e2e_source,
    '''async function expectRainNowcastGate(page: Page): Promise<void> {
  await expect(page.locator("#me-rain-card")).toBeHidden();
  const rainTab = page.locator('.me-tab[data-tab="rain"]');
  await rainTab.click();
  await expect(rainTab).toHaveAttribute("aria-selected", "true");''',
    '''async function openMapLayerTab(page: Page, tab: string): Promise<void> {
  const primaryTab = page.locator(`.me-tab[data-tab="${tab}"]`);
  if (await primaryTab.isVisible()) {
    await primaryTab.click();
    await expect(primaryTab).toHaveAttribute("aria-selected", "true");
    return;
  }
  const drawer = page.locator(".me-filter-drawer");
  if ((await drawer.getAttribute("open")) === null) {
    await page.locator(".me-filter-toggle").click();
  }
  const drawerTab = page.locator(`.me-filter-tab-chip[data-filter-tab="${tab}"]`);
  await drawerTab.click();
  await expect(drawerTab).toHaveAttribute("aria-pressed", "true");
  await expect(drawer).not.toHaveAttribute("open", "");
}

async function expectRainNowcastGate(page: Page): Promise<void> {
  await expect(page.locator("#me-rain-card")).toBeHidden();
  await openMapLayerTab(page, "rain");''',
    "rain layer helper",
)
e2e_source = replace_once(
    e2e_source,
    '''  await page.locator('.me-tab[data-tab="rain"]').click();
  await expect(page.locator('.me-tab[data-tab="rain"]')).toHaveAttribute("aria-selected", "true");''',
    '''  await openMapLayerTab(page, "rain");''',
    "signed-in rain transition",
)
loop_anchor = '''for (const profile of MAP_VIEWPORTS) {
  test(`map shell QA flow (${profile.slug})`, async ({ browser }) => {'''
mobile_test = '''test("mobile map exposes three primary actions and keeps advanced layers in the details drawer", async ({ browser }) => {
  const profile = MAP_VIEWPORTS.find((item) => item.slug === "mobile-390") ?? MAP_VIEWPORTS[0]!;
  const context = await newStagingContext(browser, profile, { serviceWorkers: "block" });
  const page = await context.newPage();
  await installMapApiStubs(page);
  await waitForMapReady(page, "/map");

  const primaryTabs = page.locator(".me-tabs .me-tab:visible");
  await expect(primaryTabs).toHaveCount(3);
  await expect(page.locator('.me-tab[data-tab="markers"]')).toBeVisible();
  await expect(page.locator('.me-tab[data-tab="places"]')).toBeVisible();
  await expect(page.locator('.me-tab[data-tab="heatmap"]')).toBeVisible();
  await expect(page.locator('.me-tab[data-tab="rain"]')).toBeHidden();
  await expect(page.locator('.me-tab[data-tab="frontier"]')).toBeHidden();
  await expect(page.locator(".me-filter-toggle")).toContainText("詳しく絞る");
  await expect(page.locator("#me-locate-fab")).toBeVisible();
  await expect(page.locator(".me-start-panel.is-collapsed .me-start-panel-grid")).toBeHidden();

  const ratio = await page.evaluate(() => {
    const map = document.querySelector<HTMLElement>(".me-map");
    return map ? map.getBoundingClientRect().height / window.innerHeight : 0;
  });
  expect(ratio).toBeGreaterThanOrEqual(0.55);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

  await page.locator(".me-filter-toggle").click();
  await expect(page.locator(".me-filter-drawer")).toHaveAttribute("open", "");
  await expect(page.locator('.me-filter-tab-chip[data-filter-tab="rain"]')).toBeVisible();
  await expect(page.locator('.me-filter-tab-chip[data-filter-tab="frontier"]')).toBeVisible();
  await expect(page.locator("#me-bottom-sheet")).not.toHaveClass(/is-open/);
  await expect(page.locator("#me-locate-fab")).toBeHidden();

  await openMapLayerTab(page, "rain");
  await expect(page.locator("#me-rain-card")).toBeVisible();
  await context.close();
});

''' + loop_anchor
e2e_source = replace_once(e2e_source, loop_anchor, mobile_test, "mobile browser contract")
e2e_path.write_text(e2e_source, encoding="utf-8")

print("mobile map progressive transform applied")
