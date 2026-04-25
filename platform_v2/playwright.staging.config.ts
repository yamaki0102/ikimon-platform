import { defineConfig } from "@playwright/test";

const basicAuthUser = process.env.STAGING_BASIC_AUTH_USER ?? "";
const basicAuthPass = process.env.STAGING_BASIC_AUTH_PASS ?? "";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  timeout: 120_000,
  expect: {
    timeout: 20_000,
  },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/staging" }],
  ],
  use: {
    baseURL: process.env.STAGING_BASE_URL ?? "https://staging.ikimon.life",
    ignoreHTTPSErrors: true,
    httpCredentials: basicAuthUser && basicAuthPass
      ? {
          username: basicAuthUser,
          password: basicAuthPass,
        }
      : undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
});
