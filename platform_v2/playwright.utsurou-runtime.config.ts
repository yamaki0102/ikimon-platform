import { defineConfig } from "@playwright/test";

const basicAuthUser = process.env.STAGING_BASIC_AUTH_USER ?? "";
const basicAuthPass = process.env.STAGING_BASIC_AUTH_PASS ?? "";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
const jsonReport = process.env.UTSUROU_RUNTIME_QA_PLAYWRIGHT_REPORT?.trim()
  || ".deploy/utsurou-runtime-playwright.json";

if (!executablePath) {
  throw new Error("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH is required for staging runtime QA");
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: {
    timeout: 20_000,
  },
  reporter: [
    ["list"],
    ["json", { outputFile: jsonReport }],
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
    serviceWorkers: "block",
    launchOptions: {
      executablePath,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
      },
    },
  ],
});
