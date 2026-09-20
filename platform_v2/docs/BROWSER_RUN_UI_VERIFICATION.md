# Cloudflare Browser Run UI verification

This lane reuses the existing record-funnel.staging.spec.ts journey. It does not create a second journey suite or remove local Chromium/WebKit coverage.

## Runtime

Normal Playwright execution remains unchanged. The Browser Run runner sets BROWSER_RUNTIME=cloudflare; the shared browser-run.ts fixture then:

- acquires a new Cloudflare Browser Run session;
- connects the existing Playwright test through CDP;
- uses the normal /login form with an ephemeral self-cleaning staging account by default, or an explicitly supplied dedicated account;
- closes the session after the test;
- records checkpoint screenshots, console errors, page errors, failed requests, HTTP 4xx/5xx responses, and runtime identity.

A diagnostic run sets recording=true only when the session is created. It also writes a Playwright trace and, after session close, reads back the recording and redacted network HAR when Cloudflare exposes a target.

## Authentication and staging target

The runner prefers explicit environment credentials when they are supplied:

- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_BROWSER_RUN_API_TOKEN (preferred) or CLOUDFLARE_API_TOKEN

For an authorized local developer machine, the runner can instead reuse the current Wrangler OAuth login through `wrangler auth token --json`. The OAuth token is passed only to the child Playwright process and is not printed or persisted by the runner. When CLOUDFLARE_ACCOUNT_ID is absent, the runner discovers it only when the OAuth/API credential can see exactly one Cloudflare account; multiple accounts fail closed and require an explicit account ID.

Browser Run defaults to the fixed staging Worker endpoint:

    https://ikimon-life-cloudflare-staging.yamaki0102.workers.dev

This verifies the same staging Worker without requiring a Cloudflare Access service token for the custom domain. Set STAGING_BASE_URL explicitly when the custom-domain path itself must be verified. If that custom domain is Cloudflare Access protected, provide both CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET (the CLOUDFLARE_ACCESS_* aliases are also accepted). Existing staging Basic Auth variables remain supported.

By default the runner provisions a short-lived, staging-only login whose email uses the `staging-session-smoke-browser-run-` fixture namespace, uses the normal `/login` UI, and calls the Worker-native authenticated self-cleanup endpoint after the run. The generated email, password and session cookie remain process-local and are never printed or persisted. Cleanup deletes only the temporary D1 authentication rows (`auth_sessions`, `oauth_accounts`, `auth_users`, and the matching `users` stub) after the current session resolves to the strict Browser Run email and display-name contract while `ENVIRONMENT=staging`; production and ordinary accounts fail closed. The record/upload/KPI steps remain mocked in this Browser Run journey, so the ephemeral account does not create product records.

`BROWSER_RUN_TEST_EMAIL` and `BROWSER_RUN_TEST_PASSWORD` remain an explicit override and must be provided together. Discovery-only `--list` does not create a staging account.

BROWSER_RUN_EXPECTED_RUNTIME_SHA is optional but should be set for a deployment verification. When set, the test compares it to /api/v1/runtime/version.

## Commands

From platform_v2:

    npm run e2e:browser-run
    npm run e2e:browser-run:diagnostic

The normal command runs the same critical record funnel on desktop and mobile. The diagnostic command intentionally fails one desktop test and exits successfully only after the failure produced session/recording evidence. It is for bounded diagnostic validation, not a product pass.

Artifacts are under Playwright test-results/ and include browser-run-evidence.json, key checkpoint screenshots, runtime identity, and diagnostic-only trace/ARIA/network files. Cookies, authorization headers, passwords, tokens, and live-view URLs are not written.

Production is not mutated by this lane. The production smoke lane and the WebKit lane remain separate.
