import { defineConfig } from "@playwright/test";

process.env.PLACE_ATLAS_QA_LOCAL_SOURCE = "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: {
    timeout: 20_000,
  },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/place-atlas-local" }],
  ],
  outputDir: "test-results/place-atlas-local",
  use: {
    baseURL: "http://127.0.0.1:4322",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "node dist/server.js",
    url: "http://127.0.0.1:4322/healthz",
    timeout: 30_000,
    reuseExistingServer: false,
    env: {
      NODE_ENV: "development",
      PORT: "4322",
      DATABASE_URL: "postgres://ikimon:local-qa@127.0.0.1:54329/ikimon_v2",
    },
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
    { name: "firefox", use: { browserName: "firefox" } },
  ],
});
