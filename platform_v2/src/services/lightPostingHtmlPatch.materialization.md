# Lightweight posting materialization regression

Issue: #1350

The public root HTML is produced through Fastify `app.inject()` during Cloudflare original-UI materialization. The root route is registered before the lightweight-posting `onSend` hook, so the hook alone cannot alter that already-registered route.

The lightweight-posting module therefore applies the same idempotent transform to injected HTML responses while retaining the normal `onSend` hook for later routes. The dedicated `view=needs_id` lane remains excluded from passive-identification suppression.

This file is a temporary implementation note for review and may be removed before merge if the PR description contains the full rationale.
