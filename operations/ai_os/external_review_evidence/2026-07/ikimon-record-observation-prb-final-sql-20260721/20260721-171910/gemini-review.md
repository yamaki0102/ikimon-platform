**Verdict: approve**

The migration script is exceptionally robust and adheres strictly to the requirements for an additive, high-integrity D1 schema. The use of rigorous `CHECK` constraints to enforce business logic at the database layer (AI promotion prohibition, consent-to-research mapping, and UUID formatting) is exemplary for a Cloudflare D1/SQLite environment.

### 1. Top findings

| Severity | Category | Finding |
| :--- | :--- | :--- |
| **P1** | **Integrity** | **Circular Dependency & Deferrability:** The `record_observations` table has a composite FK to `observation_identification_claims`, which in turn references `record_observations`. While `DEFERRABLE INITIALLY DEFERRED` is used, Cloudflare D1/SQLite behavior depends on `PRAGMA foreign_keys = ON`. In some D1 environments, deferred constraints are only validated at the end of a `batch()` operation. |
| **P1** | **Logic** | **AI-only Promotion Prohibition:** The `CHECK` constraint on `record_observations` correctly prevents `human_asserted` status or `accepted_identification_id` from being set without a valid `reviewed_by_actor_id`. This effectively blocks AI-only records from "promoting" themselves without human intervention. |
| **P2** | **Standards** | **JSON Bounds:** Every JSON column includes both `json_valid()` and a `length()` limit. This is critical for D1 to prevent unbounded row growth and ensure compatibility with the 1MB row limit in Workers/D1. |
| **P2** | **Parity** | **Partial Unique Indexes:** The use of `idx_observation_identification_claims_accepted` (WHERE `claim_status = 'accepted'`) correctly implements the "one accepted claim per observation" rule, providing parity with PostgreSQL's partial indexes. |

### 2. Missing assumptions or evidence
*   **Transaction Context:** The script assumes that the application layer (likely a Cloudflare Worker) will use the D1 `batch()` API or wrap the insertion of an Observation and its first Identification Claim in a single transaction to satisfy the circular FK.
*   **Timezone Standard:** `CURRENT_TIMESTAMP` is used. It is assumed the application layer and PG counterpart are synchronized on UTC.

### 3. Recommended changes

1.  **D1 FK Pragma:** Ensure the deployment manifest or initialization logic for D1 explicitly runs `PRAGMA foreign_keys = ON;`. SQLite defaults this to OFF in many environments, which would silently bypass your rigorous integrity checks.
2.  **Consistency Ledger Indexing:** In `record_observation_consistency_ledger`, consider adding an index on `operation_key` specifically (it is UNIQUE, but an explicit index can help with lookups if the PK isn't sufficient for the reconciliation worker).
3.  **Migration Documentation:** Add a comment at the top of the file noting that `record_observations` and `observation_identification_claims` must be populated within a single D1 `batch()` call due to the circular deferred foreign key.

### 4. Risk Analysis

*   **Circular FK Risk:** In standard SQLite, `DEFERRABLE` is accepted syntactically but only works if the connection is within a `BEGIN...COMMIT` block. If the application performs sequential `db.prepare().run()` calls for Observations then Claims, the first call will fail despite the `DEFERRED` keyword. This is the primary implementation risk.
*   **Promotion Logic:** The constraint `CHECK (NOT (assertion_status = 'human_asserted' ...))` is powerful. It ensures that even if a "buggy" AI worker tries to set a record as verified, the database will reject the write. This is a strong defensive safeguard for a consent-based service.
*   **Additive Boundary:** The schema is strictly additive (`CREATE TABLE IF NOT EXISTS`). It does not modify existing `record_v1` tables, maintaining a clean boundary for the PR-B migration.

**Final Note:** This is one of the most disciplined D1 migrations reviewed. The regex-based UUID validation and the cross-table consistency ledger demonstrate a high-maturity approach to shadow-database architecture. Proceed with the merge once the `batch()` insertion pattern is confirmed in the application code.
