# ikimon-db-mcp

Historical MCP contract artifact for the former Biodiversity Freshness OS curator-agent design.

## Status

**Retired. Do not run or migrate this path in place.**

Sprint 7 v2.2 moved curator execution to the Node dispatcher at
`platform_v2/src/scripts/cron/runCurator.ts`. Node now owns source fetch,
snapshot checks, deterministic validation, SQL generation, and receiver POST.
LLMs are called directly by Node only for structured extraction.

The previous Claude Managed Agents path is retired. The remaining source is
kept only to document the old allowlist and trust boundary, and to prevent old
references from being mistaken for the current runtime.

The `startStdioMcp()` entry point fails closed. There is no active MCP
transport, package, service, or approved deployment path here.

## Historical permission model

`permissions.json` mapped `agent_id` to allowed operations:

```json
{
  "invasive-law": {
    "read": ["invasive_status_versions", "taxa_gbif_cache", "freshness_registry", "source_snapshots"],
    "write_proposal": ["invasive_status_versions", "source_snapshots"],
    "write_direct": ["freshness_registry", "ai_curator_runs"]
  }
}
```

Historical operations:

- `read` — `query_readonly` could SELECT from allowlisted tables only
- `write_proposal` — `propose_write` emitted SQL proposals and did not directly mutate the target data
- `write_direct` — limited operational status tables bypassed the proposal loop

The historical trust boundary forced proposed `knowledge_claims` rows to
`use_in_feedback=false` and `human_review_status='pending'`.

## Historical tools

| Tool | Historical purpose |
|---|---|
| `query_readonly` | Read allowlisted tables |
| `propose_write` | Emit a SQL proposal |
| `schema_introspect` | Return allowed table metadata |
| `record_run_status` | Record curator-run status |
| `register_snapshot` | Register an immutable source snapshot |

These functions are not an active MCP surface.

## Retirement enforcement

From `platform_v2`:

```bash
npm run test:archived-mcp-contract
```

The platform build runs this contract and verifies that:

- the path remains classified as retired
- the entry point refuses startup
- no Model Context Protocol SDK import is introduced
- in-place migration and a legacy lane remain forbidden

## Future MCP work

Any future MCP endpoint must begin with a fresh architecture review. It must
use the then-current portfolio-approved MCP SDK v2 profile and must not treat
this retired path as a migration base.
