# paper-research-curator (archived prompt)

Sprint 7 v2.2 retired the Claude Managed Agents / Sonnet prompt path.

`runCurator.ts` currently exits `cancelled/not_migrated` for
`paper-research`. In PR3 this curator may allow DeepSeek provider failover,
but the call must still be made directly by Node. LLM prompts must never
receive `CURATOR_RECEIVER_SECRET`, `GEMINI_API_KEY`, or `DEEPSEEK_API_KEY`.

Future implementation belongs under `platform_v2/src/scripts/cron/curators/`.
