import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["production-smoke.spec.ts"],
  fullyParallel: false,
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/production-smoke" }],
  ],
  use: {
    baseURL: process.env.PRODUCTION_SMOKE_BASE_URL ?? "http://127.0.0.1:13202",
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
});
