# satellite-update-curator (archived prompt)

Sprint 7 v2.2 retired the Claude Managed Agents / Sonnet prompt path.

`runCurator.ts` currently exits `cancelled/not_migrated` for
`satellite-update`. When this curator is migrated, implement it as a
Node-owned workflow under `platform_v2/src/scripts/cron/curators/` and keep
LLM usage limited to structured extraction.

Do not put receiver secrets or provider API keys into LLM prompts.
