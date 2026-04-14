# Shared Root Parallel Protocol

このリポジトリでは、Claude Code と Codex は `E:\Projects\Playground` を単一の正本として共有する。

## Current Decision

- 正本: `E:\Projects\Playground`
- `git worktree` は当面使わない
- 理由: Android / Kotlin 系を含む改行ポリシーを明示し、shared-root で安定運用する方が安全だから

## Safe Parallel Rule

- 同時に開くのは可
- 同時に調査するのも可
- 同時に編集するのは不可
- 編集担当は常に 1 エージェントだけにする

## Editing Ownership

編集を始める前に `scripts\claim_agent_lock.ps1` を実行する。

例:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\claim_agent_lock.ps1 -Agent codex -Task "species page fix"
```

編集を終えたら解放する。

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\claim_agent_lock.ps1 -Release
```

現在の担当確認:

```powershell
Get-Content .\.agent\runtime\active-editor.json
```

編集前チェック:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check_shared_root_hygiene.ps1
```

これが失敗したら、`CRLF` 混入、追跡済み `local.properties`、`git worktree` 残骸のどれかが残っている。

差分を commit 前に分類:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\classify_tracked_diffs.ps1
```

`Substantive diff files` が実変更、`Line-ending-only diff files` が改行だけの差分。

## Shared Documents

- 共通ルール: `AGENTS.md`
- Claude 入口: `CLAUDE.md`
- 移行方針: `E_drive_agent_migration_plan.md`
- 並行運用: `docs/agent_collaboration.md`
- 本ドキュメント: `docs/shared_root_parallel_protocol.md`

## Unfinished Work Policy

途中作業や未デプロイ修正は repo 内の文書を正本にする。

例:

- `checkpoints/`
- `docs/CLAUDE_HANDOVER_*`
- `.gstack/projects/.../checkpoints/...`

ローカル専用の履歴・キャッシュ・認証情報は共有しない。

## Future Re-enable Condition

`git worktree` を再開する条件:

1. `.gitattributes` と実ファイル改行を整合させる
2. `scripts/check_shared_root_hygiene.ps1` が通る
3. その状態を 1 repo で検証完了する
