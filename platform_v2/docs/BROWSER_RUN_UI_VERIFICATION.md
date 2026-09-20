# Cloudflare Browser Run UI verification

This lane reuses the existing record-funnel.staging.spec.ts journey. It does not create a second journey suite or remove local Chromium/WebKit coverage.

## Runtime

Normal Playwright execution remains unchanged. The Browser Run runner sets BROWSER_RUNTIME=cloudflare; the shared browser-run.ts fixture then:

- acquires a new Cloudflare Browser Run session;
- connects the existing Playwright test through CDP;
- uses the normal /login form with a dedicated test account;
- closes the session after the test;
- records checkpoint screenshots, console errors, page errors, failed requests, HTTP 4xx/5xx responses, and runtime identity.

A diagnostic run sets recording=true only when the session is created. It also writes a Playwright trace and, after session close, reads back the recording and redacted network HAR when Cloudflare exposes a target.

## Authentication and staging account

The default lane no longer requires a separately copied Browser Run token, account ID, or a human-maintained test-account password.

Cloudflare authentication resolves in this order:

1. `CLOUDFLARE_BROWSER_RUN_API_TOKEN`, when an explicitly scoped Browser Rendering token is already available;
2. `CLOUDFLARE_API_TOKEN`, when an existing authorized executor supplies it;
3. the current Wrangler authentication via `wrangler auth token --json`.

If `CLOUDFLARE_ACCOUNT_ID` is absent, the lane resolves the single current account through `wrangler whoami --json`. The token is held in process memory only and is never written into Browser Run evidence.

For UI login, explicit `BROWSER_RUN_TEST_EMAIL` / `BROWSER_RUN_TEST_PASSWORD` remain supported as an override. Otherwise the lane uses the existing `V2_PRIVILEGED_WRITE_API_KEY` staging authority to create a bounded `browser-run-*` QA account with a random password, logs in through the normal `/login` form, and removes the fixture in `afterAll`.

By default Browser Run targets the same staging Worker through
`https://ikimon-life-cloudflare-staging.yamaki0102.workers.dev`. This avoids making Cloudflare Access service-token IAM a prerequisite for automated UI verification. Set `STAGING_BASE_URL` explicitly when the Access-protected custom domain itself is the subject under test.

`BROWSER_RUN_EXPECTED_RUNTIME_SHA` is optional but should be set for a deployment verification. When set, the test compares it to `/api/v1/runtime/version`.

## Commands

From platform_v2:

    npm run e2e:browser-run
    npm run e2e:browser-run:diagnostic

The normal command runs the same critical record funnel on desktop and mobile. The diagnostic command intentionally fails one desktop test and exits successfully only after the failure produced session/recording evidence. It is for bounded diagnostic validation, not a product pass.

Artifacts are under Playwright test-results/ and include browser-run-evidence.json, key checkpoint screenshots, runtime identity, and diagnostic-only trace/ARIA/network files. Cookies, authorization headers, passwords, tokens, and live-view URLs are not written.

Production is not mutated by this lane. The production smoke lane and the WebKit lane remain separate.
