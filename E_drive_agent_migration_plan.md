# E Drive Dev Migration Plan

最終方針: `E:\Projects` を開発の標準ルートにする。

## 1. フォルダ方針

### 標準配置

```text
E:\Projects\
  antigravity\
  aikan-drawing-tool\
  ikimon-platform\
  Playground\
  _staging\
  _archive_before_delete\
```

- `E:\Projects\<repo>` を正本にする
- 旧 `C:` 側は移行完了後もしばらく保持し、即削除しない
- 一時コピー先は `E:\Projects\_staging`
- 退避先は `E:\Projects\_archive_before_delete`

## 2. Claude Code / Codex 共存方針

### 共通にするもの

- Git リポジトリ本体
- ソースコード
- `README.md`
- `AGENTS.md`
- プロジェクト固有の設計メモ
- `docs/` 配下の運用文書

### 共通にしないもの

- `C:\Users\YAMAKI\.codex\`
- `C:\Users\YAMAKI\.claude\`
- 各エージェントの履歴、セッション、キャッシュ、認証情報

理由:
- ここを共有すると履歴DBやローカル状態が衝突しやすい
- 共通化すべきなのは「作業対象」であって「ツール内部状態」ではない

## 3. 共有ドキュメント方針

各リポジトリのルートに以下を置く:

- `AGENTS.md`: 共通ルールの正本
- `CLAUDE.md`: Claude 向けの薄い入口

推奨内容:

- `AGENTS.md` に共通ルールを集約
- `CLAUDE.md` は重複記述を避け、`AGENTS.md` を参照する最小構成にする

例:

```md
# Claude Project Guide

See `AGENTS.md` first.

Additional Claude-specific notes:
- Keep responses in Japanese
- Prefer repo-local docs over global memory
```

これで MD をある程度共通化しつつ、必要ならツール別メモも足せる。

## 4. 並行開発ルール

同じフォルダを同時に開くこと自体は可能。ただし「同じ worktree で同時編集」は事故率が高い。

安全ルール:

1. 調査だけなら同じフォルダで並行可
2. コード編集を両方で同時にやるなら、同一 repo 配下で branch を分ける
3. 本当に同時に編集するなら `git worktree` を使う

推奨:

```text
E:\Projects\ikimon-platform              ← main 用
E:\Projects\ikimon-platform_codex        ← Codex 作業用 worktree
E:\Projects\ikimon-platform_claude       ← Claude 作業用 worktree
```

これは「開発フォルダは同じ repo 系統」の条件を満たしつつ、index 競合を避けられる。

## 5. 今回の棚卸し結果

### 主な候補

- `C:\Projects\antigravity` 約 28.36 GB
- `C:\Projects\aikan-drawing-tool` 約 0.68 GB
- `C:\Users\YAMAKI\Documents\Playground` 約 1.64 GB

### 注意点

- `antigravity` は巨大。段階移行が必須
- `antigravity\.git` だけでも約 2.69 GB
- `antigravity\i-kan.co.jp` が約 21.04 GB で最大

## 6. 移行順

1. `Playground`
2. `aikan-drawing-tool`
3. `antigravity`

この順なら小さいものから動作確認できる。

## 7. 実行ルール

移行は常に以下の順序:

1. `git status` 確認
2. `robocopy` で `C:` → `E:` へコピー
3. 移行先で起動確認
4. エディタやツールの作業ルート更新
5. 旧フォルダを `.old` にリネーム
6. 数日運用後に削除

## 8. robocopy 方針

基本コマンド:

```powershell
robocopy "<src>" "<dst>" /E /COPY:DAT /DCOPY:DAT /R:2 /W:1 /XJ /MT:16
```

補足:

- `/XJ`: ジャンクション事故回避
- `/MT:16`: 並列コピー
- いきなり `/MOVE` は使わない

## 9. 次の実作業

次にやるべきこと:

1. `Playground` を `E:\Projects\Playground` にコピー
2. `Playground` に `CLAUDE.md` の薄い入口を置く
3. その運用が問題ないことを確認してから他 repo へ展開
