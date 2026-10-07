# Ryuyo public program: introduction and private browser trial

This is the bounded public presentation slice of **ZUKAN-RYUYO-DISCOVERY-EVENT-P0-20261007**, not a second Work, participant database, admin application or control plane. It implements the owner's later instruction to publish something the host can see and try without waiting for organizer setup, database migration or NOCOSIL automation. The existing event implementation and its uncompleted storage/review/gallery acceptance remain separate and unchanged.

## Public contract

- Program: `https://zukan.earth/programs/ryuyo-discovery`.
- Private browser trial: the same path plus `/try`; printable sheet: `/print`.
- The trial accepts an optional nickname and one to three photographs with optional comments. Nothing entered is sent to a server, persisted to browser storage or exposed to other participants. Reloading loses the draft.
- A requested download is a self-contained UTF-8 HTML notebook with embedded metadata-free JPEG derivatives and a versioned JSON document. This is an explicit local export, not server publication. The file's recipient and subsequent distribution are the user's choice.
- The introduction is clearly a proposed experience, not an official park announcement or a dated event registration. No host approval, dates, fees, participant totals, votes or prizes are invented.
- Three existing generated illustrations are reused byte-for-byte from the pinned source in `build.mjs`. They depict conceptual nature scenes, not a geographical map, official character or the host's portrait. Original provenance remains in `platform_v2/public/assets/event-discovery/provenance.json` at that commit.

## Long-lived identity and portability

The public program has immutable UUID `37d4d7e8-f9ec-4539-951a-60bd6a9ab276`; `ryuyo-discovery` is its readable URL alias, not an identity derived from year, language, organizer or a provider. Preserve this URL and retain redirects if it is renamed; never reassign the alias to an unrelated program. Replacing this native adapter with ZUKAN's shared application must preserve the same URL and ID.

A real occurrence uses its own existing Event `session_id`, separate from the program, and retains `/events/{session_id}/...`. A second event in the same year receives a new occurrence ID. Date changes do not change its identity, and a later event must not overwrite earlier participants, consent or results. This trial deliberately has `occurrenceId: null` and `mode: trial`; it must never be imported as real attendance.

Notebook identities and entry identities are random UUIDs. Exported `createdAt` uses UTC, with an IANA time-zone identifier and a separate locale. Unicode text is normalized and length-limited by code points. The current UI is Japanese; translation, local event schedules and currencies are presentation/configuration concerns, not future changes to identity. The initial release neither claims worldwide legal readiness nor guarantees a century of operation.

The plain HTML/JSON/image export does not require a NOCOSIL subscription, this Worker, GitHub or an AI provider to read. Future schema changes must retain versioned readers or an explicit migration. Long retention does not override consent, correction or deletion obligations. Free/paid NOCOSIL access must not determine whether safety controls or user-owned portability are available. No billing or autonomous organizer product is added here.

## Isolated delivery boundary

Only this directory and the two content-only Worker names/routes in `wrangler.jsonc` belong to this slice. The earlier source writer's event modules, migration, images, claim and deployment of `ikimon-life-cloudflare-*` are not changed or taken over. The adapter has no database, storage, service, secret, AI or queue bindings. It adds no DNS/custom domain, subscription or permission. It serves only the exact program prefix; wildcard lookalikes fall through to the unchanged existing Custom Domain Worker. It is product delivery, not a new development orchestration route.

The owner explicitly requests production publication on the ZUKAN domain. Stage the source-bound static slice, validate it, then attach its narrowly scoped production route. The original backend Work is not closed by this release. The old `/events/ryuyo` compatibility redirect and integration into the shared program publisher remain outside this isolated slice; do not pretend they were deployed.

## Native build and verification

No dependencies or package installation are needed. At an independently verified source commit/tree:

```sh
node --test program.test.mjs
node build.mjs --source-sha <exact-commit> --source-tree <exact-tree>
```

`--asset-bundle <file>` can reuse an exact downloaded artifact in an authorized cloud executor. Every image is checked against the pinned SHA256 and byte length. The output is self-contained; no build-time URL becomes a runtime dependency. The deployment connector may package the same source and verified assets directly, provided the resulting module bytes and source identity are independently read back.

Use the existing authenticated Cloudflare native transport, preserving the exact module/configuration and deploying staging before production. Keep workers.dev and preview URLs disabled. The runtime `/_version` endpoint reports the source commit/tree, module and asset digests, explicit trial mode and absence of server uploads. Compare those values and actual downloaded Worker bytes with the build artifact; a successful upload alone is not acceptance.

Focused browser checks cover anonymous and named notes, one/two/three photos, fourth-photo rejection, invalid file/retry, removal and reset, inert HTML-looking comments, HTML export/reopen, no outgoing form/photo requests, and responsive/print layouts. Local synthetic tests are not production participant records. Inspect the actual three illustrations in native staging/production renders at smartphone, tablet and desktop widths. Verify primary ZUKAN pages and unrelated event paths remain unchanged.

Rollback removes only the exact newly recorded program route, returning traffic to the unchanged Custom Domain Worker; it must not delete records, buckets, primary Workers or unrelated routes. Retain the source-bound adapter version and verified artifact in the existing evidence store. Route IDs and actual release evidence belong in the current execution receipt, not this design document.
