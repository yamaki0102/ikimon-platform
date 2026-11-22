import { test, expect } from "@playwright/test";

const WIDTHS = [390, 768, 1440];
const STATES = ["/ja/", "/ja/?year=2008", "/en/?place=PLACE_ID"];

for (const width of WIDTHS) {
  for (const path of STATES) {
    test.skip(`place-year faces ${path} @${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      const fit = await page.evaluate(() => document.scrollingElement!.scrollWidth <= innerWidth);
      expect(fit).toBe(true);
      await expect(page.locator("[data-place-year-band]")).toHaveCount(1);
      const small = await page.evaluate(() => {
        let count = 0;
        const walker = document.createTreeWalker(document.querySelector("main")!, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const el = n.parentElement;
          if (!n.nodeValue!.trim() || !el) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width && rect.height && parseFloat(getComputedStyle(el).fontSize) < 14) count++;
        }
        return count;
      });
      expect(small).toBe(0);
    });
  }
}
