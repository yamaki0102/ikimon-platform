# invasive-law-curator (archived prompt)

Sprint 7 v2.2 retired the Claude Managed Agents / Sonnet prompt path.

Runtime is now Node-owned:

- dispatcher: `platform_v2/src/scripts/cron/runCurator.ts`
- workflow: `platform_v2/src/scripts/cron/curators/invasive-law.ts`
- model calls: Node calls Gemini 3.1 Flash-Lite Preview by default, or
  DeepSeek V4 Flash only when `CURATOR_LLM_PROVIDER=deepseek`
- trust boundary: Node performs source fetch, snapshot detection,
  deterministic validation, SQL generation, and receiver POST

Do not put `CURATOR_RECEIVER_SECRET`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`,
or any other secret into an LLM prompt. This file is kept only as a historical
placeholder so old references fail closed instead of reviving the v6 agent path.
