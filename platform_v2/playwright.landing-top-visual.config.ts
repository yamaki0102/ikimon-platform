import { defineConfig } from "@playwright/test";

const port = Number.parseInt(process.env.LANDING_TOP_VISUAL_PORT ?? "3317", 10);
const baseURL = process.env.LANDING_TOP_VISUAL_BASE_URL ?? `http://127.0.0.1:${port}`;
const command = process.platform === "win32"
  ? `cmd /c "set PORT=${port}&& npm run dev"`
  : `PORT=${port} npm run dev`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["landing-top-visual.spec.ts"],
  fullyParallel: false,
  timeout: 120_000,
  expect: {
    timeout: 20_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
    },
  },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/landing-top-visual" }],
  ],
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
