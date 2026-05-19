import { test, expect, type Page } from "@playwright/test";

function candidateTabsTargetPath(): string {
  const explicitPath = process.env.OBSERVATION_CANDIDATE_TABS_TARGET_PATH?.trim();
  if (explicitPath) return explicitPath;

  const visitId = process.env.IKIMON_SCENE_READ_VISIT_ID?.trim() || "scene-read-local-scene";
  const subjectId = process.env.IKIMON_SCENE_READ_SUBJECT_ID?.trim() || `occ:${visitId}:0`;
  return `/ja/observations/${encodeURIComponent(visitId)}?subject=${encodeURIComponent(subjectId)}`;
}

function envText(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

async function expectCandidateSelection(page: Page, label: string, expectedMeter: string): Promise<void> {
  const candidate = page.locator("[data-ai-target]", { hasText: label }).first();
  await expect(candidate, `${label} candidate tab should be present`).toBeVisible();

  const key = await candidate.getAttribute("data-ai-target");
  expect(key, `${label} candidate tab should expose data-ai-target`).toBeTruthy();
  expect(key, `${label} should use an AI candidate panel key`).toContain("candidate:");

  await candidate.click();

  await expect
    .poll(async () => {
      return page.evaluate((candidateKey) => {
        const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-ai-target]"));
        const panels = Array.from(document.querySelectorAll<HTMLElement>("[data-ai-panel]"));
        const matchingTargets = targets.filter((item) => item.getAttribute("data-ai-target") === candidateKey);
        const activeTargets = targets.filter((item) => item.getAttribute("aria-pressed") === "true");
        const visiblePanels = panels.filter((panel) => !panel.hasAttribute("hidden"));
        return {
          matchingPressed: matchingTargets.length > 0 && matchingTargets.every((item) => item.getAttribute("aria-pressed") === "true"),
          noOtherPressed: activeTargets.every((item) => item.getAttribute("data-ai-target") === candidateKey),
          visiblePanelKeys: visiblePanels.map((panel) => panel.getAttribute("data-ai-panel")),
          meterText: document.querySelector<HTMLElement>("[data-ai-candidate-meter-value]")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        };
      }, key);
    }, { message: `${label} should synchronize target buttons, visible panel, and candidate meter` })
    .toEqual({
      matchingPressed: true,
      noOtherPressed: true,
      visiblePanelKeys: [key],
      meterText: expectedMeter,
    });
}

test.describe("observation detail candidate tabs", () => {
  test("clicking AI candidate chips keeps readout and identification panels synchronized", async ({ page }) => {
    const hasExplicitTarget = Boolean(
      process.env.OBSERVATION_CANDIDATE_TABS_TARGET_PATH?.trim() ||
      process.env.IKIMON_SCENE_READ_VISIT_ID?.trim(),
    );
    test.skip(
      Boolean(process.env.CI) && !hasExplicitTarget,
      "local candidate-tab fixture is not seeded in staging full E2E by default",
    );

    await page.setViewportSize({ width: 1440, height: 900 });
    const response = await page.goto(candidateTabsTargetPath(), { waitUntil: "domcontentloaded" });
    expect(response?.status(), "candidate tab target status").toBeLessThan(500);

    await expect(page.locator("body")).toContainText("同定に参加する");
    await expect(page.locator("[data-ai-target]", { hasText: envText("OBSERVATION_CANDIDATE_TABS_PRIMARY_LABEL", "ヒメイワダレソウ") }).first()).toBeVisible();

    await expectCandidateSelection(
      page,
      envText("OBSERVATION_CANDIDATE_TABS_FIRST_LABEL", "セイヨウミツバチ"),
      envText("OBSERVATION_CANDIDATE_TABS_FIRST_METER", "2/3"),
    );
    await expectCandidateSelection(
      page,
      envText("OBSERVATION_CANDIDATE_TABS_SECOND_LABEL", "イネ科の一種"),
      envText("OBSERVATION_CANDIDATE_TABS_SECOND_METER", "3/3"),
    );
  });
});
