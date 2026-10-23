# ZUKAN → NOCOSIL selected observation export (Z2)

This is a **Node/PostgreSQL server-side service**, not an enabled public route or a
Cloudflare Worker deployment. `exportSelectedObservationsToNocosil` in
`src/services/nocosilExport.ts` composes the existing database with the source,
package builder, durable export repository, and signed delivery service.

The feature is OFF unless the caller passes `config.enabled === true`. The caller
must obtain `actorUserId` from the existing authenticated server session. Never
accept it from a browser request body. The request selects a site, observation IDs,
a start/end period, an idempotency key, and an explicit owner opt-in for exact
coordinates. Source authorization accepts the custom field owner or a current
`field_managers` **owner** grant; steward/viewer grants do not authorize exports.
No deployment, migration application, credential provisioning, or real delivery
is performed by this change.

## Package and privacy

The versioned JSON package contains `{site:{id}, period:{start,end}, observations,
provenanceDigest}`. Each observation contains `id`, `taxon`, `date`, `location`,
`photoUrl`, and `observerConsent:true`. Site names, geometry, observer identity,
raw rights source payloads, and location labels are not projected.

Eligibility reuses `normalizeObservationDataRights`: the record must explicitly
allow external export, have the required record/research consents and licenses,
be active, and originate from `user_selected` consent. Public visibility alone
does not qualify. The source loads all selected records; the builder filters
ineligible observations. Rights or source changes on a later retry reject the
old key rather than silently delivering an outdated package.

Coordinates default to a grid of at least 10 km (internally conservative 10.1 km
bins), including rare/protected species; all source records are conservatively
treated as sensitive. Only the authorized owner's explicit per-export opt-in
allows exact coordinates. Invalid coordinates remain unavailable. Photos require
a trusted metadata-stripped rendition; raw originals are never automatically
exported. A photo URL may be null when no verified rendition is available.

## Receiver contract (requires agreement before activation)

The provisional default endpoint is `https://nocosil.com/api/exports`. An override
must remain on the HTTPS `nocosil.com` origin. Redirects are rejected.

* `Idempotency-Key`: durable export UUID (the same value for every retry).
* `X-Nocosil-Timestamp`: Unix seconds, refreshed for each transport attempt.
* `X-Nocosil-Signature`: `sha256=<hex HMAC-SHA256>`.
* Signed UTF-8 input: `${timestamp}.${exportId}.${exactBody}`.

The receiver must enforce timestamp freshness, verify the signature in constant
time, and persist the export UUID before generating a report so a retry cannot
produce another report. The provenance digest is SHA-256 over the JSON package
without `provenanceDigest`, using the builder's fixed field/observation order.
The signature authenticates the exact bytes transmitted, including the digest.
An HTTP 2xx is recorded as delivery acceptance, not proof of report generation.

## Idempotency, retry, and recovery

Apply additive `db/migrations/0140_nocosil_export_jobs.sql` through the established
migration process before enabling the service. The table has a unique
`(site_id, idempotency_key)` constraint and stores the first package snapshot and
request digest. Changing the request while reusing its key is a conflict.

An atomic lease permits one sender at a time. The service uses at least a
120-second lease, exceeding the bounded transport budget. Success replays
without another send; a failed/expired lease can be reclaimed with the same
export UUID. Crashes after receiver acceptance still require receiver-side
idempotency, as with any HTTP delivery system.

Transport retries network failures, HTTP 429 and 5xx, at most five attempts,
with delays 250/500/1000/2000 ms. Each request times out after 10 seconds;
timeouts, other 4xx and redirects return failure. There is no new scheduler:
retrying the same service request resumes a failed export. Credentials and
receiver response bodies are never persisted or logged by this service.

## Local validation

```sh
node --import tsx --test --test-isolation=none src/services/nocosilExport*.test.ts src/services/observationDataRights.test.ts
npm run typecheck
```

Tests use local fixtures and mocked HTTP/database adapters. They do not prove a
live PostgreSQL migration or an implemented NOCOSIL receiver/report journey.
