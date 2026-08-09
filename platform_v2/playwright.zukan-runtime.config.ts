import path from "node:path";
import { defineConfig } from "@playwright/test";

const platformRoot = process.cwd();
const deployRoot = path.resolve(platformRoot, ".deploy");
const basicAuthUser = process.env.STAGING_BASIC_AUTH_USER ?? "";
const basicAuthPass = process.env.STAGING_BASIC_AUTH_PASS ?? "";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
const baseURL = (process.env.STAGING_BASE_URL ?? "https://staging.zukan.earth").replace(/\/+$/u, "");
const jsonReport = path.resolve(
  platformRoot,
  process.env.ZUKAN_RUNTIME_QA_PLAYWRIGHT_REPORT?.trim()
    || ".deploy/zukan-runtime-playwright.json",
);

if (!executablePath) {
  throw new Error("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH is required for staging runtime QA");
}
if (baseURL !== "https://staging.zukan.earth") {
  throw new Error("ZUKAN runtime Playwright is pinned to https://staging.zukan.earth");
}
if (jsonReport !== deployRoot && !jsonReport.startsWith(`${deployRoot}${path.sep}`)) {
  throw new Error("ZUKAN runtime Playwright report must stay under platform_v2/.deploy");
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
    baseURL,
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
    trace: "off",
    screenshot: "only-on-failure",
    video: "off",
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
