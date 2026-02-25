---
description: Autonomous Sleep Mode Ingestion for Orthoptera Batch
---

// turbo-all

# Sleep Mode Ingestion Workflow

This workflow is designed to be run repeatedly to process the "Autonomous Ingestion Queue" without user intervention.

1. **Read the Queue**:
   - Read `g:\その他のパソコン\マイ ノートパソコン\antigravity\ikimon\ikimon.life\readme\Ingestion_Protocols\Books\Gakken_Konchu\autonomous_sleep_plan_orthoptera.md`.
   - Identify the first "Pending" File ID.

2. **Target Acquisition**:
   - Use the `Predicted Image` path from the queue.
   - **Do not** perform a file search. Trust the queue.

3. **High-Velocity Ingestion**:
   - **View** the image.
   - **Construct** the JSON entry for the File ID.
   - **Populate** all species *immediately* with Expert Diagnostics (skip the placeholder step if 100% confident, or do it in a single multi-step turn).
   - **Romaji Transcription** is mandatory.

4. **Update Trackers**:
   - Mark the row in `autonomous_sleep_plan_orthoptera.md` as `[x] Complete`.
   - Update `task.md`.

5. **Loop Signal**:
   - If successful, output "READY_FOR_NEXT_BATCH" to signal the auto-runner.
