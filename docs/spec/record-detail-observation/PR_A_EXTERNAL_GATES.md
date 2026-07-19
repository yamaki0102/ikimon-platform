# PR-A EXTERNAL GATES — Clean checkout and read-only evidence

## 1. Purpose

This runbook completes the checks that cannot be executed through the GitHub connector alone.

It must run from a fresh checkout or isolated worktree. It does not authorize production mutation, migration apply, deploy, secret access, or export of row-level private data.

Central execution: `yamaki0102/all-projects-management#435`

## 2. Required output

Create or update:

```text
docs/spec/record-detail-observation/PR_A_LOCAL_AUDIT_RESULTS.md
```

The result must contain:

- exact audited commit SHA;
- branch/worktree clean status;
- commands executed and PASS/FAIL;
- file/path inventories;
- counts only for approved database metrics;
- `confirmed / inferred / unknown` findings;
- active migration/PR conflicts;
- remaining P0/P1 blockers;
- no secret values, user identifiers, precise coordinates, raw records or customer data.

## 3. Clean checkout gate

```bash
git fetch origin main
git worktree add ../ikimon-record-observation-pr-a-audit origin/main
cd ../ikimon-record-observation-pr-a-audit

git status --short
git rev-parse HEAD
git rev-parse origin/main
```

PASS:

- `git status --short` is empty;
- `HEAD` equals the intended exact source SHA;
- no existing dirty worktree is reset, cleaned, overwritten or removed.

If the intended source moved after this runbook was prepared, record both SHAs and audit the newer exact source. Do not silently reuse evidence from an older commit.

## 4. Migration inventory

```bash
find platform_v2/db/migrations -maxdepth 1 -type f -print | sort
find platform_v2/cloudflare_shadow/migrations/observations -maxdepth 1 -type f -print | sort
```

Record:

- migration filename;
- responsibility;
- whether it writes or reads record/visit, occurrence, identification, media, AI review, environment, privacy, rights, monitoring or export data;
- whether a newer migration supersedes its behavior;
- whether the migration is additive or destructive;
- whether it is already represented in `PR_A_EVIDENCE_MATRIX.md`.

Stop if duplicate migration numbers, modified historical migrations or unclassified destructive statements are found.

## 5. PostgreSQL writer inventory

```bash
rg -n --hidden \
  --glob '!upload_package/**' \
  --glob '!docs/archive/**' \
  '(insert into|update|delete from)\s+(visits|occurrences|identifications|evidence_assets|field_context|observation_data_rights|observation_package_events)' \
  platform_v2/src platform_v2/db scripts
```

For each writer record:

- file and function;
- transaction boundary;
- source identity;
- idempotency key;
- current entity written;
- AI/human/import/system provenance;
- destructive behavior;
- post-commit side effects;
- compatibility/rollback path.

Explicitly confirm:

- every `delete from occurrences`;
- every evidence-tier update;
- every `is_current` identification write;
- every direct AI-created occurrence;
- every export/readiness update;
- every environment write with precise coordinates.

## 6. Cloudflare D1 writer inventory

```bash
rg -n --hidden \
  '(INSERT INTO|UPDATE|DELETE FROM|\.prepare\()' \
  platform_v2/cloudflare_shadow/src \
  platform_v2/cloudflare_shadow/migrations/observations

rg -n --hidden \
  '(observations|asset_ledger|observation_reassessment_requests|observation_ai_review_targets|observation_identifications|observation_specialist_reviews|observation_environment_records|civic_observation_contexts)' \
  platform_v2/cloudflare_shadow/src \
  platform_v2/cloudflare_shadow/migrations/observations
```

For each writer record:

- route/queue/scheduled entry;
- D1 transaction or batch boundary;
- R2 compensation behavior;
- source/owner validation;
- synthetic occurrence ID handling;
- public readmodel refresh;
- idempotency/dedupe contract;
- fallback behavior;
- migration dependency.

## 7. Read-path inventory

```bash
rg -n --hidden \
  --glob '!upload_package/**' \
  '(record detail|observation detail|/observations/|/records|visitId|occurrenceId|subject=|JSON-LD|application/ld\+json)' \
  platform_v2/src platform_v2/cloudflare_shadow/src platform_v2/e2e
```

Build a matrix for:

- public record detail;
- owner record detail;
- observation compatibility redirect;
- media/image detail;
- public home/feed cards;
- owner records list;
- identification workbench;
- public and owner map;
- search;
- JSON APIs;
- JSON-LD/metadata;
- field/area profiles;
- monitoring packages;
- research export.

Record for each:

- source tables/readmodel;
- record vs subject identity;
- support for 0/1/N subjects;
- media association;
- AI/human provenance;
- public precision decision;
- cache/materializer;
- fallback/rollback path.

## 8. Community and promotion inventory

```bash
rg -n --hidden \
  '(computeIdentificationConsensus|getIdentificationConsensus|tryAutoPromote|evidence_tier|actor_kind|is_current|accepted_rank|community|specialist|authority_backed|ai_judgement)' \
  platform_v2/src platform_v2/cloudflare_shadow/src
```

Confirm:

- AI/system sources are excluded from human supporter counts;
- community consensus thresholds and actor dedupe;
- open-dispute and taxonomy blockers;
- specialist/authority transitions;
- every path that changes evidence tier or export readiness;
- whether any current path can make AI-only data scientifically active without human provenance.

## 9. Environment and monitoring inventory

```bash
rg -n --hidden \
  '(field_context|environmentRecord|environment assessment|place_environment_snapshots|monitoringRecordContract|monitoring series|monitoringReady|indicatorReady|exportReady|trendAbundance|observation_package_events)' \
  platform_v2/src platform_v2/cloudflare_shadow/src platform_v2/db platform_v2/cloudflare_shadow/migrations
```

Confirm:

- all persistence locations;
- source kind and confidence;
- overwrite/merge behavior;
- rule/model/version provenance;
- missing-data and suppression rules;
- approval/publish state;
- whether one AI assessment can overwrite a monitoring value;
- PostgreSQL/D1 parity.

## 10. Privacy surface gate

### Source scan

```bash
rg -n --hidden \
  '(data-lat|data-lng|latitude|longitude|decimalLatitude|decimalLongitude|coordinates|geometry|polygon|EXIF|XMP|JSON-LD|application/ld\+json|publicPrecision|public_precision)' \
  platform_v2/src platform_v2/cloudflare_shadow/src platform_v2/e2e
```

### Required rendered surfaces

Use a local/staging environment that is approved for read-only verification. Check at minimum:

- public record detail;
- public observation detail/redirect;
- public home/feed;
- public map;
- public search;
- public JSON APIs;
- JSON-LD/metadata;
- public field/area profile;
- monitoring/public report;
- downloadable media and metadata;
- research/export preview.

PASS:

- no protected exact coordinate in HTML, DOM attributes, scripts, JSON, JSON-LD, map payload, media metadata or export;
- owner-only exact location is never returned through public cache/materialization;
- rare-sensitive and school/child-sensitive records are hidden or generalized by policy;
- public stream precision remains municipality/mesh only where required.

Do not paste actual protected values into the audit document. Record only presence/absence, policy level and reason code.

## 11. Active lane conflict gate

```bash
gh pr list --repo yamaki0102/ikimon-platform --state open --limit 200 \
  --json number,title,isDraft,headRefName,baseRefName,updatedAt,url

git branch -r --no-merged origin/main
```

Classify each overlapping lane as:

- current dependency;
- unique evidence only;
- superseded by merged work;
- unrelated;
- unsafe base/diverged;
- requires branch-hygiene decision.

Do not close, delete, force-update or rebase a branch in this gate.

## 12. Documentation and source validation

```bash
git diff --check origin/main...HEAD

# Repository-specific validators if present
powershell -ExecutionPolicy Bypass -File .\scripts\check_knowledge_os_overview_sync.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\check_deploy_guardrails.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\check_legacy_entrypoint_reason.ps1

npm --prefix platform_v2 run typecheck
npm --prefix platform_v2 run test:node
npm --prefix platform_v2 run build
npm --prefix platform_v2/cloudflare_shadow run check
npm --prefix platform_v2/cloudflare_shadow run test:quick
```

For docs-only PR-A, product tests are evidence that the exact source baseline remains green; they do not validate the future schema.

Run the repository’s current secret/local-path/link validators if their names differ. Record the exact commands actually executed.

## 13. Read-only metrics gate

Use the query templates in `CURRENT_INVENTORY.md` only after:

- confirming current column names against exact migrations;
- using a read-only role/session;
- confirming the output contains aggregate counts only;
- receiving any required production access approval.

Required aggregate evidence:

- records with 0 / 1 / N current occurrences;
- AI-only occurrence-shaped rows;
- media attachment shape;
- identification actor/source distribution;
- rights coverage;
- D1 synthetic occurrence-ID use;
- reassessment state distribution;
- ambiguous/quarantine candidate counts.

Do not export row IDs, user IDs, media paths, precise coordinates, notes, names or raw source payloads.

## 14. Independent review gate

Review at minimum:

- [`PR_A_EVIDENCE_MATRIX.md`](PR_A_EVIDENCE_MATRIX.md)
- [`PR_B_ADDITIVE_SCHEMA_DESIGN.md`](PR_B_ADDITIVE_SCHEMA_DESIGN.md)
- exact migration inventory
- writer/read-path matrix
- privacy surface results
- active-lane conflicts

Review questions:

1. Can any AI-only path produce a confirmed observation, accepted identification or active projection?
2. Can any split/merge/edit path delete source history?
3. Can any public surface expose protected location through a secondary representation?
4. Are `record`, `observation`, `identification`, `occurrence projection`, `environment assessment` and `monitoring series` distinct?
5. Is rollback additive and non-destructive?
6. Can the same input be replayed without duplicate child observations or projections?
7. Does D1 preserve equivalent constraints despite SQLite limitations?
8. Are existing record save, media, community, monitoring and export behaviors preserved until cutover?

## 15. Stop conditions

Stop and report without mutation when:

- exact source cannot be established;
- worktree is dirty or conflicting;
- migration number/history conflict exists;
- protected data would need to be copied into evidence;
- P0 privacy/promotion/history issue is found;
- production/D1/secret/DNS/permission/deploy approval is required;
- rollback requires destructive reverse migration;
- an open PR or migration lane owns the same physical schema.

## 16. Completion result

When all gates pass, update the central Issue with:

- exact audited SHA;
- `PR_A_COMPLETE` or `PR_A_BLOCKED`;
- PASS/FAIL for each section;
- final P0/P1 list;
- approved PR-B physical table names;
- whether additive migration implementation may begin.
