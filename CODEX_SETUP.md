# Codex Cloud — ZUKAN (current entry)

Use [AGENTS.md](AGENTS.md), section **Codex Cloud — P0 fast start**, as the current entry for “P0から開発して”, the highest priority Work, or resuming an existing Work.

- Product: ZUKAN / `zukan.earth`; current source `yamaki0102/ikimon-platform@main`. The physical `platform_v2` and `ikimon-life` identifiers remain valid technical names.
- The task's supplied Work ID / Factory receipt takes precedence. Otherwise an **authenticated current NOCOSIL/Factory selector** must resolve an eligible ZUKAN P0 Work. The repository itself cannot grant claims or reconstruct live Work from old plans.
- If Codex Cloud cannot access that selector, return `WORK_SELECTOR_UNAVAILABLE` promptly instead of browsing old tasks indefinitely. Preserve any known Work and provide the missing connection/re-entry.
- Once admitted, use `platform_v2/cloudflare_shadow/src/` for live Worker routes and `platform_v2/src/` for shared UI/services. Read `docs/START_HERE.md` and the affected feature/spec only as needed.
- Implement the current Work's `next_action`, run focused tests, use the registered release path, and store verified source/runtime state and Resume on the **same Work**. Don't confuse a PR or build with production success.
- Preserve rights, review, publication, identity, secrets, source protection and current claim/fencing limits; no owner-PC or external chat as a prerequisite.

The older Phase 6/SQLite/PHP-oriented Codex instructions previously here were historical; they are **not** today's default ZUKAN implementation, queue or release procedure. Git history retains them if compatibility work explicitly requires them.
