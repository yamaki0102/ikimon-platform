# ikimon-db-mcp

MCP (Model Context Protocol) server that exposes the ikimon platform_v2
PostgreSQL database to the four Biodiversity Freshness OS curator agents
under a strict allowlist.

## Why a separate MCP server

Curators run on Claude Managed Agents in Anthropic's cloud. They cannot
reach the staging Postgres directly. This server runs on the VPS, accepts
stdio MCP requests over an SSH tunnel, and exposes only the operations
each curator is allowed to perform — read certain tables, propose writes
to certain tables (which become PRs, never direct DB writes), and
introspect schemas.

## Permission model

`permissions.json` maps `agent_id` → allowed operations:

```json
{
  "invasive-law": {
    "read":            ["invasive_status_versions", "taxa_gbif_cache", "freshness_registry", "source_snapshots"],
    "write_proposal":  ["invasive_status_versions", "source_snapshots"],
    "write_direct":    ["freshness_registry", "ai_curator_runs"]
  }
  ...
}
```

Operations:

- `read` — `query_readonly` tool may SELECT from these tables only.
- `write_proposal` — `propose_write` tool emits SQL files to
  `out/proposals/<run_id>.sql`. **Never touches the database.**
  GitHub Action `agent-curator-pr.yml` picks them up and opens a PR.
- `write_direct` — limited tables that bypass the PR loop
  (`freshness_registry` status, `ai_curator_runs` log, etc.).

Trust boundary §1.5 is enforced in code: any proposed `knowledge_claims`
INSERT is rewritten with `use_in_feedback=false` and
`human_review_status='pending'` regardless of what the agent asked for.

## Tools exposed (MCP)

| Tool | Purpose |
|---|---|
| `query_readonly` | `SELECT … FROM <allowed table> WHERE …` (no joins to denied tables) |
| `propose_write` | Append a row spec to `out/proposals/<run_id>.sql` |
| `schema_introspect` | Returns column list + constraints for an allowed table |
| `record_run_status` | UPSERT into `ai_curator_runs` (status, cost_jpy, error) |
| `register_snapshot` | INSERT into `source_snapshots` (raw artifact ledger) |

## Running

Local dev:

```bash
cd platform_v2/mcp_servers/ikimon-db-mcp
npm install
DATABASE_URL=postgres://... AGENT_ID=invasive-law npm run dev
```

Production (per-curator systemd):

```bash
# /etc/systemd/system/ikimon-mcp-invasive-law.service
ExecStart=/usr/bin/env AGENT_ID=invasive-law node dist/server.js
```

## Status

**Skeleton only.** Sprint 4 lands the protocol shape, permissions
allowlist, and PR-emission contract. Actual MCP wire format integration
with `@modelcontextprotocol/sdk` is intentionally deferred until the
first real curator run scheduled by the operator.
