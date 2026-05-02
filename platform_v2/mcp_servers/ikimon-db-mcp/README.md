# ikimon-db-mcp

MCP (Model Context Protocol) server that exposes the ikimon platform_v2
PostgreSQL database to historical Biodiversity Freshness OS curator agents
under a strict allowlist.

## Status

Archived. Sprint 7 v2.2 moved curator execution to the Node dispatcher at
`platform_v2/src/scripts/cron/runCurator.ts`. Node now owns source fetch,
snapshot checks, deterministic validation, SQL generation, and receiver POST.
LLMs are called directly by Node only for structured extraction.

## Why a separate MCP server

The old design ran curators as Claude Managed Agents. That path is retired;
this README remains only to document the previous allowlist model and to keep
old references from being mistaken for the current runtime.

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

Do not revive this MCP path without a fresh architecture review.
