const BROWSER_RUN_STAGING_EMAIL_PATTERN =
  /^staging-session-smoke-browser-run-[a-z0-9_-]{6,80}@example\.invalid$/i;

export const BROWSER_RUN_STAGING_DISPLAY_NAME = "Browser Run Staging QA";

export function isBrowserRunEphemeralStagingAccount(input: {
  environment: string | undefined;
  email: string | null | undefined;
  displayName: string | null | undefined;
}): boolean {
  if (input.environment?.trim().toLowerCase() !== "staging") return false;
  const email = input.email?.trim().toLowerCase() ?? "";
  const displayName = input.displayName?.trim() ?? "";
  return displayName === BROWSER_RUN_STAGING_DISPLAY_NAME
    && BROWSER_RUN_STAGING_EMAIL_PATTERN.test(email);
}
