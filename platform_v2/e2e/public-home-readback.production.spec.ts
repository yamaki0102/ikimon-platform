import { expect, test, type Page } from "@playwright/test";

const deployedBaseUrl = process.env.PRODUCTION_SMOKE_BASE_URL?.trim() ?? "";
const viewports = [
  { name: "mobile-320", width: 320, height: 568 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "desktop-1440", width: 1440, height: 900 },
] as const;

async function dispatchSyntheticInstallPrompt(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as Window & { __ikimonInstallPromptCalled?: boolean }).__ikimonInstallPromptCalled = false;
    const event = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted"; platform: string }>;
    };
    event.prompt = async () => {
      (window as Window & { __ikimonInstallPromptCalled?: boolean }).__ikimonInstallPromptCalled = true;
    };
    event.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });
    window.dispatchEvent(event);
  });
}

async function visibleUnnamedControls(page: Page): Promise<string[]> {
  return await page.locator("a,button,summary,[role='button'],input,select,textarea").evaluateAll((elements) => {
    return elements.flatMap((element, index) => {
      const node = element as HTMLElement;
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      const visible = rect.width > 0
        && rect.height > 0
        && style.display !== "none"
        && style.visibility !== "hidden"
        && style.opacity !== "0";
      if (!visible) return [];

      const input = node as HTMLInputElement;
      const name = [
        node.getAttribute("aria-label"),
        node.getAttribute("title"),
        node.textContent,
        input.value,
        node.querySelector("img")?.getAttribute("alt"),
      ].map((value) => String(value ?? "").trim()).find(Boolean);
      if (name) return [];
      return [`${node.tagName.toLowerCase()}#${index}.${node.className || "no-class"}`];
    });
  });
}

test.describe("[production-read-only] public home UX completion gate", () => {
  test.skip(!deployedBaseUrl, "set PRODUCTION_SMOKE_BASE_URL to a deployed staging or production runtime");

  for (const viewport of viewports) {
    test(`${viewport.name} has no orphan install controls and keeps one clear primary action`, async ({ browser }) => {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      await page.goto(`/ja/?ux_readback=${Date.now()}`, { waitUntil: "domcontentloaded" });
      await dispatchSyntheticInstallPrompt(page);

      await expect(page.locator("h1").filter({ hasText: "写真1枚から" })).toBeVisible();
      await expect(page.locator(".prototype-guest-home-primary")).toBeVisible();
      await expect(page.locator("[data-app-install-prompt]")).toBeHidden();
      await expect(page.locator("[data-app-install-action]")).toBeHidden();
      await expect(page.locator("[data-app-install-dismiss]")).toBeHidden();
      await expect(page.getByRole("button", { name: "追加", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "あとで", exact: true })).toHaveCount(0);

      const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        primaryCount: Array.from(document.querySelectorAll(".prototype-guest-home-actions.is-focused .prototype-guest-home-primary"))
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }).length,
      }));
      expect(layout.scrollWidth, `${viewport.name} has no horizontal overflow`).toBe(layout.clientWidth);
      expect(layout.primaryCount, `${viewport.name} exposes exactly one primary hero action`).toBe(1);
      expect(await visibleUnnamedControls(page), `${viewport.name} has no visible unnamed controls`).toEqual([]);

      await page.close();
    });
  }

  test("mobile primary photo action opens a real file chooser without writing data", async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await page.goto(`/ja/?ux_photo_readback=${Date.now()}`, { waitUntil: "domcontentloaded" });

    const chooserPromise = page.waitForEvent("filechooser");
    await page.locator(".prototype-guest-home-primary").click();
    const chooser = await chooserPromise;
    expect(chooser.isMultiple()).toBeTruthy();
    expect(page.url()).toContain("/ja/");

    await page.close();
  });

  test("secondary nearby action navigates and the mobile menu opens", async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await page.goto(`/ja/?ux_navigation_readback=${Date.now()}`, { waitUntil: "domcontentloaded" });

    const menu = page.locator("details.site-mobile-menu");
    await page.locator("summary.site-mobile-menu-toggle").click();
    await expect(menu).toHaveAttribute("open", "");

    await Promise.all([
      page.waitForURL(/\/ja\/map(?:\?|$)/u),
      page.locator(".prototype-guest-home-secondary").click(),
    ]);

    await page.close();
  });
});
