const BROWSER_RUN_STAGING_USER_ID_PATTERN =
  /^staging-session-smoke-browser-run-[A-Za-z0-9_-]{6,80}$/;

function isStagingEnvironment(): boolean {
  return process.env.ENVIRONMENT?.trim().toLowerCase() === "staging";
}

export function browserRunStagingUserIdForEmail(email: string): string | null {
  if (!isStagingEnvironment()) return null;
  const normalized = email.trim().toLowerCase();
  const suffix = "@example.invalid";
  if (!normalized.endsWith(suffix)) return null;
  const localPart = normalized.slice(0, -suffix.length);
  return BROWSER_RUN_STAGING_USER_ID_PATTERN.test(localPart) ? localPart : null;
}

export function isBrowserRunStagingUserId(userId: string): boolean {
  return isStagingEnvironment() && BROWSER_RUN_STAGING_USER_ID_PATTERN.test(userId.trim());
}
