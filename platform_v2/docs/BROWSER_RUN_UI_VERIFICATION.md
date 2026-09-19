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

## Required secret names

Values must come from the existing secret manager or CI secret store; never commit them or print them.

- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_BROWSER_RUN_API_TOKEN (preferred) or CLOUDFLARE_API_TOKEN
- BROWSER_RUN_TEST_EMAIL
- BROWSER_RUN_TEST_PASSWORD

The API token must be scoped to the Cloudflare Browser Rendering Edit permission. If staging is Cloudflare Access protected, provide both CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET (the CLOUDFLARE_ACCESS_* aliases are also accepted). Access headers are added only to the staging origin. Existing staging Basic Auth variables remain supported.

BROWSER_RUN_EXPECTED_RUNTIME_SHA is optional but should be set for a deployment verification. When set, the test compares it to /api/v1/runtime/version.

## Commands

From platform_v2:

    npm run e2e:browser-run
    npm run e2e:browser-run:diagnostic

The normal command runs the same critical record funnel on desktop and mobile. The diagnostic command intentionally fails one desktop test and exits successfully only after the failure produced session/recording evidence. It is for bounded diagnostic validation, not a product pass.

Artifacts are under Playwright test-results/ and include browser-run-evidence.json, key checkpoint screenshots, runtime identity, and diagnostic-only trace/ARIA/network files. Cookies, authorization headers, passwords, tokens, and live-view URLs are not written.

Production is not mutated by this lane. The production smoke lane and the WebKit lane remain separate.
