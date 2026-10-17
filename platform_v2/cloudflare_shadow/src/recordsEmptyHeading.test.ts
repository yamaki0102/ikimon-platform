import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { chromium } from "@playwright/test";
import { renderSiteDocument } from "../../src/ui/siteShell";
import { renderRecordsProductSection } from "./index";

const browserPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath();

test("Records headings, member tabs and search controls use the selected language without changing search context", () => {
  for (const [lang, mine, community, label, submit] of [
    ["ja", "自分の記録", "みんなの記録", "記録を検索", "探す"],
    ["en", "Your records", "Community records", "Search records", "Search"],
    ["es", "Tus registros", "Registros de la comunidad", "Buscar registros", "Buscar"],
    ["pt-br", "Seus registros", "Registros da comunidade", "Buscar registros", "Buscar"],
  ] as const) for (const mode of ["mine", "public"] as const) {
    const html = renderRecordsProductSection([], new URL(`https://zukan.earth/${lang}/records?view=${mode}&q=ceramics`),
      mode, { userId: "fixture", banned: false } as never);
    assert.ok(html.includes(`<h1>${mode === "mine" ? mine : community}</h1>`));
    assert.ok(html.includes(`>${mine}</a>`) && html.includes(`>${community}</a>`));
    assert.ok(html.includes(`placeholder="${label}" aria-label="${label}"`));
    assert.ok(html.includes(`>${submit}</button>`));
    assert.ok(html.includes(`name="view" value="${mode}"`));
    assert.ok(html.includes('value="ceramics"'));
    assert.ok(html.includes(`action="/${lang}/records"`));
  }
});

test("long empty-search headings wrap within Records and preserve usable recovery actions", {
  skip: !existsSync(browserPath) && "Playwright Chromium is unavailable",
}, async () => {
  const browser = await chromium.launch({ executablePath: browserPath, headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const page = await browser.newPage();
    await page.route("**/*", route => route.abort());
    for (const lang of ["ja", "en", "es", "pt-br"] as const) {
      for (const query of [`zukan-empty-${"0123456789abcdef".repeat(2)}01234567`, "a".repeat(80)]) {
        const path = `/${lang}/records`;
        const section = renderRecordsProductSection([], new URL(`https://zukan.earth${path}?view=public&q=${query}`), "public", null);
        const html = renderSiteDocument({ basePath: "", currentPath: path, canonicalPath: path,
          lang: lang === "pt-br" ? "pt-BR" : lang, title: "Records fixture", description: "Local fixture",
          activeNav: "records", body: section });
        for (const width of [320, 375, 768, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          await page.setContent(html, { waitUntil: "domcontentloaded" });
          const heading = page.locator(".cf-records-native-empty > strong");
          assert.ok((await heading.textContent())!.includes(query), "search text is preserved in full");
          const measure = await heading.evaluate(element => {
            const rect = element.getBoundingClientRect();
            const parent = element.parentElement!.getBoundingClientRect();
            const style = getComputedStyle(element.parentElement!);
            const left = parent.left + parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth);
            const right = parent.right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth);
            const range = document.createRange();
            range.selectNodeContents(element);
            const headingClip = Math.max(0, ...[...range.getClientRects()].flatMap(box => [left - box.left, box.right - right]));
            return { left: rect.left, right: rect.right, parentLeft: parent.left, parentRight: parent.right,
              scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth, headingClip };
          });
          assert.ok(measure.left >= measure.parentLeft && measure.right <= measure.parentRight + 1,
            `${lang}/${width}/${query.length}: heading exceeds empty state ${JSON.stringify(measure)}`);
          assert.ok(measure.scrollWidth <= measure.viewport, `${lang}/${width}: horizontal overflow`);
          assert.ok(measure.headingClip <= 1, `${lang}/${width}: search text exceeds content bounds`);
          for (const action of await page.locator(".cf-records-native-empty a").all()) {
            const bounds = await action.boundingBox();
            assert.ok(bounds && bounds.height >= 44 && bounds.width >= 44, `${lang}/${width}: recovery target below 44px`);
            assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, `${lang}/${width}: recovery action exceeds viewport`);
          }
        }
      }
    }
  } finally { await browser.close(); }
});
