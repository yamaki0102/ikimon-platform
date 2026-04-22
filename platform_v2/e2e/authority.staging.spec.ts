import { test, expect } from "@playwright/test";
import {
  addSessionCookie,
  createStagingApiContext,
  newStagingContext,
  requireEnv,
  uniqueFixturePrefix,
} from "./support/staging.js";

type SessionPayload = {
  ok: boolean;
  error?: string;
};

type UpsertUserInput = {
  userId: string;
  displayName: string;
  email: string;
  roleName: string;
  rankLabel: string;
};

async function upsertUser(api: Awaited<ReturnType<typeof createStagingApiContext>>, writeKey: string, input: UpsertUserInput): Promise<void> {
  const response = await api.post("/api/v1/users/upsert", {
    headers: {
      "x-ikimon-write-key": writeKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    data: {
      ...input,
      authProvider: "playwright",
      banned: false,
    },
  });
  expect(response.ok()).toBeTruthy();
}

async function issueSessionCookie(
  api: Awaited<ReturnType<typeof createStagingApiContext>>,
  writeKey: string,
  userId: string,
): Promise<string> {
  const response = await api.post("/api/v1/auth/session/issue", {
    headers: {
      "x-ikimon-write-key": writeKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    data: {
      userId,
      ttlHours: 24,
    },
  });
  const payload = (await response.json()) as SessionPayload;
  expect(response.ok(), payload.error ?? "session_issue_failed").toBeTruthy();
  const rawCookie = response.headers()["set-cookie"];
  expect(rawCookie).toBeTruthy();
  return rawCookie;
}

test("authority admin grant/revoke gates expert lane", async ({ browser, playwright }) => {
  const writeKey = requireEnv("V2_PRIVILEGED_WRITE_API_KEY");
  const api = await createStagingApiContext(playwright);
  const fixturePrefix = uniqueFixturePrefix("authority-ui");
  const adminUserId = `${fixturePrefix}-admin`;
  const reviewerUserId = `${fixturePrefix}-reviewer`;
  const ownerUserId = `${fixturePrefix}-owner`;

  await upsertUser(api, writeKey, {
    userId: adminUserId,
    displayName: "Authority Admin",
    email: `${adminUserId}@example.invalid`,
    roleName: "Analyst",
    rankLabel: "分析担当",
  });
  await upsertUser(api, writeKey, {
    userId: reviewerUserId,
    displayName: "Authority Reviewer",
    email: `${reviewerUserId}@example.invalid`,
    roleName: "Observer",
    rankLabel: "観察者",
  });
  await upsertUser(api, writeKey, {
    userId: ownerUserId,
    displayName: "Authority Owner",
    email: `${ownerUserId}@example.invalid`,
    roleName: "Observer",
    rankLabel: "観察者",
  });

  const adminCookie = await issueSessionCookie(api, writeKey, adminUserId);
  const reviewerCookie = await issueSessionCookie(api, writeKey, reviewerUserId);
  await issueSessionCookie(api, writeKey, ownerUserId);

  const reviewerContext = await newStagingContext(browser, {
    slug: "authority-reviewer",
    viewport: { width: 1280, height: 800 },
  });
  await addSessionCookie(reviewerContext, reviewerCookie);
  const reviewerPage = await reviewerContext.newPage();

  const deniedResponse = await reviewerPage.goto("/specialist/id-workbench?lane=expert-lane", { waitUntil: "domcontentloaded" });
  expect(deniedResponse?.status()).toBe(403);
  await expect(reviewerPage.getByText("この画面は、確認権限が付与されている人向けです。", { exact: false })).toBeVisible();

  const adminContext = await newStagingContext(browser, {
    slug: "authority-admin",
    viewport: { width: 1280, height: 900 },
  });
  await addSessionCookie(adminContext, adminCookie);
  const adminPage = await adminContext.newPage();

  const adminResponse = await adminPage.goto("/specialist/authority-admin", { waitUntil: "domcontentloaded" });
  expect(adminResponse?.status()).toBe(200);
  await expect(adminPage.locator("#authority-grant-form")).toBeVisible();

  await adminPage.locator('#authority-grant-form [name="subjectUserId"]').fill(reviewerUserId);
  await adminPage.locator('#authority-grant-form [name="scopeTaxonName"]').fill("Taraxacum");
  await adminPage.locator('#authority-grant-form [name="scopeTaxonRank"]').fill("genus");
  await adminPage.locator('#authority-grant-form [name="reason"]').fill("playwright grant");
  await adminPage.locator('#authority-grant-form [name="evidenceType"]').selectOption("field_event");
  await adminPage.locator('#authority-grant-form [name="evidenceTitle"]').fill("Taraxacum field workshop");
  await adminPage.locator('#authority-grant-form [name="evidenceIssuer"]').fill("Playwright QA");
  await adminPage.locator('#authority-grant-form button[type="submit"]').click();

  await expect(adminPage.locator("#authority-admin-status")).toContainText("付与しました。");
  await adminPage.waitForLoadState("domcontentloaded");

  const authorityCard = adminPage.locator(".card.is-soft", { hasText: reviewerUserId }).first();
  await expect(authorityCard).toBeVisible();

  const grantedResponse = await reviewerPage.goto("/specialist/id-workbench?lane=expert-lane", { waitUntil: "domcontentloaded" });
  expect(grantedResponse?.status()).toBe(200);
  await expect(reviewerPage.getByRole("heading", { name: "専門確認レーン" })).toBeVisible();

  adminPage.once("dialog", async (dialog) => {
    await dialog.accept("playwright revoke");
  });
  await authorityCard.locator("[data-revoke-authority]").click();
  await expect(adminPage.locator("#authority-admin-status")).toContainText("取消しました。");
  await adminPage.waitForLoadState("domcontentloaded");

  const revokedResponse = await reviewerPage.goto("/specialist/id-workbench?lane=expert-lane", { waitUntil: "domcontentloaded" });
  expect(revokedResponse?.status()).toBe(403);
  await expect(reviewerPage.getByText("この画面は、確認権限が付与されている人向けです。", { exact: false })).toBeVisible();

  await api.dispose();
  await reviewerContext.close();
  await adminContext.close();
});
