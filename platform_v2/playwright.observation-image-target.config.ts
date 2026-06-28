import { defineConfig } from "@playwright/test";

const basicAuthUser = process.env.STAGING_BASIC_AUTH_USER ?? "";
const basicAuthPass = process.env.STAGING_BASIC_AUTH_PASS ?? "";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["observation-detail-image-target.spec.ts"],
  fullyParallel: false,
  timeout: 75_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/observation-image-target" }],
  ],
  use: {
    baseURL: process.env.OBSERVATION_DETAIL_BASE_URL ?? process.env.STAGING_BASE_URL ?? "https://ikimon.life",
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
