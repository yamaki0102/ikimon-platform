---
description: Superpowers式 構造化デバッグ — 根本原因を特定してから修正する4フェーズプロセス
---


// turbo-all

# Systematic Debugging (Superpowers 準拠)

> 出典: [obra/superpowers](https://github.com/obra/superpowers) systematic-debugging skill
> Antigravity 用に適応

## 鉄則

```
根本原因の調査なしに修正を試みてはならない
3回以上の修正失敗は、アーキテクチャの問題を示す
```

## Phase 1: Root Cause Investigation (根本原因調査)

修正を**一切試みる前に**:

1. **エラーメッセージを最後まで読め**
   - スタックトレースを省略しない
   - 行番号、ファイルパス、エラーコードを記録
   
2. **再現を確認しろ**
   - 毎回再現できるか？
   - 正確な手順は何か？
   - 再現できないなら → もっとデータを集めろ、推測するな

3. **最近の変更をチェック**
   - `git diff` で何が変わったか
   - 設定変更、依存関係の変更
   - 環境の差異

4. **マルチコンポーネントなら境界ごとに調査**
   ```
   各コンポーネント境界で:
     - 何が入るかログ
     - 何が出るかログ
     - どこで壊れるか特定
   ```

## Phase 1.5: 本番サーバー用チェックリスト 🌐

> **本番で 500/403 が出たら、コードを疑う前にまずこれ。**

### Step 1: エラーログを見る (`/error-log` ワークフロー)
```powershell
# 重大エラーだけ表示（infraweb警告を除外）
ssh -i ~/.ssh/production.pem -p 8022 r1522484@www1070.onamae.ne.jp "grep -v 'infraweb' ~/logs/ikimon.life/error_log | tail -30"
```

### Step 2: よくある根本原因チェック

| 症状 | 原因 | 修正 |
|------|------|------|
| `AH00529: Permission denied .htaccess` | SCP後にディレクトリが 700 | `find ~/public_html/ikimon.life -type d -exec chmod 755 {} \;` |
| `PHP Fatal: require_once failed` | ファイル未アップロード or パスミス | SCP で該当ファイルを再アップ |
| HTTP 200 だが古い画面 | `public_html/` 配下でなくルート直下に配置 | `/deploy` Step 2/3 を確認 |
| `403 Forbidden` | ディレクトリの実行権限なし | `chmod 755` |

### Step 3: パーミッション一括修正（迷ったらとりあえず打て）
```powershell
ssh -i ~/.ssh/production.pem -p 8022 r1522484@www1070.onamae.ne.jp "find ~/public_html/ikimon.life -type d -exec chmod 755 {} \; && find ~/public_html/ikimon.life -name '.htaccess' -exec chmod 644 {} \; && echo FIXED"
```

### Step 4: 修正後の検証
```powershell
curl -s -o NUL -w "HTTP:%{http_code} TIME:%{time_total}s" https://ikimon.life/post.php
curl -s -o NUL -w "HTTP:%{http_code} TIME:%{time_total}s" https://ikimon.life/
```

> [!TIP]
> コードレベルの問題だと確信してから初めて Phase 2 に進め。
> インフラ（パーミッション・パス・.htaccess）が原因の 500 エラーは、コードデバッグを何時間やっても直らない。

### Phase 1.6: Blank Page Forensics (白画面フォレンジック) 🆕

> **教訓 (2026-02-18)**: 白画面の原因を「CSP」と推測して2回空振りした。
> **真の原因は `CSRF::generate()` の Class not found — `meta.php`にrequire_onceが欠落。**
> HTTP 200 + 白画面 = **PHP Fatal mid-render** (display_errors=0で何も表示されない)。
> CSPやJSの問題だと思い込む前に、**PHPが最後まで出力できているか**を確認せよ。

**白画面 = まずこのチェックリストを上から順に実行。推測禁止。**

#### Step 1: PHP出力が完結しているか確認（最重要）
```powershell
# ページの出力に </html> があるか？なければPHP Fatalで中断している
curl -s https://ikimon.life/ | Select-String "</html>"
# 結果が空 → PHP Fatal Error。Step 2 へ
# 結果あり → PHPは正常。CSP/JSの問題。Step 4 へ
```

#### Step 2: エラー出力付きでPHP実行（本番CLI）
```powershell
# デバッグスクリプトを作成してSCP
# display_errors=1でページのrequireチェーンを段階実行
# 各STEPで "OK" を出力し、どこで止まるか特定
scp -P 8022 -i ~/.ssh/production.pem debug_test.php r1522484@www1070.onamae.ne.jp:/tmp/
ssh -i ~/.ssh/production.pem -p 8022 r1522484@www1070.onamae.ne.jp "php /tmp/debug_test.php 2>&1"
```

#### Step 3: Class not found パターン
```powershell
# meta.php等の共通コンポーネントで使っているクラスが全てrequireされているか
# 特に CSRF, Auth, Lang, CspNonce — これらは「別のページで先に読まれてるから動く」罠がある
grep -rn "CSRF::\|Auth::\|Lang::\|CspNonce::" upload_package/public_html/components/ | grep -v require
```

#### Step 4: CSP/JSの問題（Step 1で `</html>` があった場合のみ）
```powershell
# ブラウザのコンソールエラーを確認（Puppeteer or DevTools）
# CSPヘッダーを確認
curl -s -D - https://ikimon.life/ -o NUL | Select-String "Content-Security-Policy"
```

> [!WARNING]
> **「CSPが原因かも」と思ったら、まず Step 1 に戻れ。**
> HTTP 200 + 白画面の95%は PHP Fatal mid-render であり CSP ではない。
> CSP違反ではページが「白」にはならない（スクリプトが動かないだけでHTML自体は表示される）。

## Phase 2: Pattern Analysis (パターン分析)

1. **動作する類似コードを見つける**
2. **壊れたコードと何が違うか比較する**
3. **「関係ないだろう」と思う差異も列挙する**

## Decision Log (判断ログ) — v7.0 追加

> 3-Strike Rule 発動時、またはアーキテクチャ判断が必要な場面で記録する。
> 全タスクに強制ではない。**判断が分岐する場面でのみ**使用。

```
📋 Decision Log
━━━━━━━━━━━━━━
🎯 Goal: [解決したい問題]
🔍 Hypothesis A: [仮説A] → [根拠]
🔍 Hypothesis B: [仮説B] → [根拠]
⚡ Selected: [選択した仮説] (evidence: [証拠])
❌ Rejected: [却下した仮説] (reason: [理由])
✅ Result: [結果]
━━━━━━━━━━━━━━
```

**使用タイミング**:
- Phase 3 で仮説が2つ以上ある場合
- 3-Strike Rule が発動した場合（必須）
- アーキテクチャレベルの方針変更時（必須）

## Phase 3: Hypothesis & Test (仮説と検証)

1. **仮説を1つだけ立てる** — 「XがYだから壊れている」
2. **最小限の変更で検証** — 一度に1変数だけ
3. **結果を確認** — ダメなら新しい仮説。修正を積み重ねるな

## Phase 4: Implementation (実装)

1. **失敗するテストケースを作る** (可能であれば)
2. **1つの修正だけ実装** — 「ついでに」は禁止
3. **検証** — テスト通過？他のテスト壊れてない？

## 3-Strike Rule ⚠️

```
修正を3回試みて失敗 → STOP
→ アーキテクチャそのものを疑え
→ human partner (キミ) に報告してから次のアクション
```

## Red Flags — 即座にPhase 1に戻れ

こう思った瞬間に STOP:
- 「たぶんXが原因、直してみよう」
- 「とりあえず変更して動くかテスト」
- 「複数の修正を同時に入れよう」
- 「テスト省略して手動確認でいい」
- 「もう1回だけ修正を試そう」(既に2回失敗してる場合)

## Verification Gate (完了前検証)

```
完了を宣言する前に:
1. 検証コマンドを実行 (php -l, curl, テスト等)
2. 出力を全文確認
3. 期待結果と一致するか確認
4. 一致した場合のみ「完了」と宣言

「動くはず」「たぶん大丈夫」 = 嘘
```

| 宣言 | 必要な証拠 | 不十分 |
|------|----------|--------|
| テスト通過 | テスト出力: 0 failures | 前回の結果、「通るはず」 |
| Lint 通過 | **全ファイル** lint 出力: 0 errors | 変更ファイルだけチェック |
| バグ修正 | 再現テスト: pass | コード変更した、たぶん直った |
| デプロイ成功 | HTTP 200 + **コンテンツ grep で新コード確認** | HTTP 200だけ (古いファイルが200を返す罠) |

## Anti-Patterns — 今日の開発で学んだ罠

### The "200 OK Illusion"
HTTP 200が返っても、古いファイルが配信されている場合がある。
`.htaccess` リライト、CDNキャッシュ、ディレクトリ階層ミスなど。
**対策**: `curl -s <url> | grep '<今回の変更に固有の文字列>'` で必ずコンテンツ検証。

### The "全ファイル vs 変更ファイル" Bias
大量のスロット作業後、変更したファイルだけ `php -l` しがち。
変更の副作用（require_once先の不整合等）は変更していないファイルに波及する。
**対策**: リリース前に必ず `Get-ChildItem -Recurse -Filter *.php | ForEach-Object { php -l $_.FullName }` で全ファイルチェック。

### The "CSP Reflex" 🆕

白画面を見た瞬間「CSPがスクリプトをブロックしてる」と仮定して修正に走る罠。
CSP違反ではページのHTML自体は表示される（スクリプトが動かないだけ）。
白画面の95%はPHP Fatal mid-render。
**対策**: Phase 1.6 の Step 1 (`curl | grep </html>`) を最初に実行。理論より証拠。

### The "Implicit Require" Trap 🆕

共通コンポーネント（meta.php等）が使うクラスを、呼び出し元ページの require に依存する罠。
ページAでは動くがページBでは Fatal Error。テストでページAだけ確認して「OK」と判断してしまう。
**対策**: 共通コンポーネントは使う全クラスを自分自身で `require_once` する。暗黙の依存禁止。
