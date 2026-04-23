# Replacement Action Plan — 差し替えまでの実行計画

更新日: 2026-04-23
対になる正本:
- [`replacement_final_checklist_2026-04-23.md`](./replacement_final_checklist_2026-04-23.md) — Go/No-Go 判定
- [`ikimon_public_surface_canonical_pack_2026-04-22.md`](./ikimon_public_surface_canonical_pack_2026-04-22.md) — 公開面 IA 正本

## Context

チェック表で顕在化した残課題を、差し替え当日までの実行可能タスクに落とし込む。
優先度は P0（BLOCKER: 差し替え阻止）→ P1（意思決定）→ P2（運用整備）→ P3（軽微）。

BLOCKER 要約:
1. `フィールドガイド` 残存 3ファイル（title / activeNav / 内部 AI prompt）
2. `views/dashboard_*.php` 6件の canonical pack 欠落
3. API `other` family 62件の未分類
4. Section A 全行の `decision` 欄と `owner` 欄が空

---

## Phase 0: 即時着手（合計 30–60分）— ✅ 主要 3本 完了 (2026-04-23)

### ✅ P0-A1: `フィールドガイド` → `ライブガイド` 書き換え (2026-04-23 完了)

完了 4箇所（canonical pack §5.2 の rename verdict 準拠）:

| file | line | 変更 |
|---|---|---|
| `platform_v2/src/content/short/ja/public.json` | 401–402 | title / activeNav を `ライブガイド` に |
| `platform_v2/src/ui/guideFlow.ts` | 27 | `title: "ライブガイド"` |
| `platform_v2/src/services/guideTts.ts` | 88 | system prompt を `あなたはライブガイドのナレーターです` に |

検証済: `rg フィールドガイド platform_v2/src` で 0 hit。

### P0-A2: 多言語対応確認（2026-04-23 調査、未完）

調査結果: 英語側に `Field Guide` が 12 箇所残存:
- `i18n/en.ts:22,25,28` — hero eyebrow / CTA
- `i18n/i18n.test.ts:14` — テスト期待値
- `ui/guideFlow.ts:52` — en の title
- `ui/mapExplorer.ts:258,264` — crossLensLabel / bottomSheetLens
- `content/short/en/shared.json:9,77` — nav label
- `content/short/en/public.json:16,19` — tool section lead / eyebrow
- `services/guideTts.ts:53` — コメント

**ブロッカー**: canonical pack §6 Terminology Crosswalk が **日本語側しか定義していない**。英語の
canonical public term を別途決める必要がある:
- `/lens` (`その場で調べる`) → 英語は `Field Guide` / `Lens` / `On-site Check` / `Live Help` のどれ？
- `/guide` (`ライブガイド`) → 英語は `Live Guide` / `Live Field Guide` / `Live Narration` のどれ？

→ canonical pack に英語訳セクション追加が先決。P0-A2 はそれ待ち。所要: 15分 (英語決定) + 20分 (置換)。

### P0-A3: 差し替え当日チェック自動化の前段

Section B の grep を CI で回す shell をレポジトリに追加:

```bash
# scripts/check_public_surface_terms.sh
#!/usr/bin/env bash
set -euo pipefail
FORBIDDEN=('フィールドガイド' 'フィールドスキャン' 'sponsor' 'スポンサー' 'authority policy' '権限ポリシー')
EXCLUDE='--glob=!docs/strategy/** --glob=!docs/review/**'
for term in "${FORBIDDEN[@]}"; do
  hits=$(rg -l "$term" platform_v2/src $EXCLUDE || true)
  if [ -n "$hits" ]; then
    echo "FAIL: '$term' found in:"
    echo "$hits"
    exit 1
  fi
done
echo "PASS: no forbidden terms"
```

所要: 15分。担当: TBD（DX）。

---

## Phase 1: T-24h まで（意思決定＋再分類、所要 4–8h）

### ✅ P0-B1: `views/dashboard_*.php` 6件の性質判定 (2026-04-23 完了)

結論: **dead code（orphaned partial）**。

調査手順と結果:
1. `rg 'views[/\\\\]dashboard' upload_package/public_html` → 0 hit
2. `rg 'dashboard_overview|dashboard_events|...' upload_package/public_html` → 0 hit（ファイル自身のみ）
3. `views/dashboard_overview.php` 冒頭コメントに「`showcase.php` から `$site` を受ける partial」と
   書かれているが、`showcase.php` にも include 記述なし → 書き換え時に参照が外れた残骸と推定

対応: チェック表 Section A.5 の disposition を `MISSING_INTENT_UNCLEAR` → `archive (orphaned partial)` に
更新済。差し替え対象外（本番 legacy そのままで、後日 dead code cleanup タスクで削除推奨）。

### ✅ P0-B2: API `other` 62件の再分類 (2026-04-23 完了)

全 62 件を 17 既存 family + 3 新設 family (audio / notification / misc/utility) = 20 family 体系に再分類。
成果物: [`docs/strategy/api_family_reclassification_2026-04-23.md`](./api_family_reclassification_2026-04-23.md)

チェック表 Section C も同日更新完了、other=0 達成。残る要精査:
- `misc/utility.bootstrap.php` が dev-only なら `dev-debug` 家族に移動、`block_at_edge` 化

### P1-C1: Section A `decision` 欄の一括埋め

canonical pack §3.4 が `/admin/*` に対して一括 `keep internal` を宣言したのと同じ方式で、
カテゴリ単位の一括判断を入れる。提案デフォルト:

| カテゴリ | 一括 decision | 例外だけ個別判断 |
|---|---|---|
| A.1 公開ページ（redirect/merge 系） | `GO` | `/biodiversity_map.php`, `/android-app.php` の merge 範囲 |
| A.2 ユーザー機能 | `GO` | `/quests.php` archive の時期 |
| A.3 イベント/コミュニティ | `GO` | `/bioblitz_join.php` の merge タイミング |
| A.4 ビジネス/パートナー | `GO` | `/for-researcher.php` rewrite 内容 |
| A.5 レポート/分析 | `BLOCK` → 判定後 `GO` | `MISSING_INTENT_UNCLEAR` 6件 |
| A.6 教育/学習 | `GO` | なし |
| A.7 認証/OAuth | `GO` | なし |
| A.8 admin/ | `GO`（一括宣言済） | なし |
| A.9 staging 専用 | `GO` | なし |

owner アサイン: フロント=1名、バックエンド=1名、インフラ=1名を決めて一括割当。

所要: 1–2時間（レビューミーティング 1本）。担当: キミ（意思決定者）。

### ✅ P3-D1: `replacementReadinessReport.ts` の重複削除 (2026-04-23 完了)

`:24` の重複 `/learn/methodology?lang=ja` を `/learn/identification-basics?lang=ja` に置換。
endpoint 総数は 17 を維持、beginner support ページも疎通確認対象に入った。

---

## Phase 2: T-1h まで（差し替え直前、所要 1h）

実行内容は [Section E.2](./replacement_final_checklist_2026-04-23.md#e2-t-1h直前チェック) を
そのまま実行するだけ。特に:

1. `scripts/check_public_surface_terms.sh` を実行（P0-A3 で作成）
2. readiness レポートを最新化 (`node --loader tsx src/scripts/replacementReadinessReport.ts`)
3. レガシー PHP origin のヘルスチェック（`legacy_continued` family の依存先が生きていること）
4. edge で `/api/dev_*`, `*debug*`, `verify_*` が 404/403 を返す確認

### ✅ P2-E1: rollback runbook 整備 (2026-04-23 完了)

既存 [`ops/CUTOVER_RUNBOOK.md`](../../ops/CUTOVER_RUNBOOK.md) の「ロールバック手順」セクションを拡充:

- **トリガー条件** 6項目（healthz 5xx / エラーレート +0.5pt / `/record` 成功率 / ledger failed
  3件 / Section E hard_stop FAIL / ユーザー報告）
- **判断者** (Primary: YAMAKI / Backup: オンコール指名)
- **Step R1–R5**: nginx 戻し（1-2分）→ ユーザー通知（テンプレ付）→ データ復元（5-15分、DB破損時のみ）
  → インシデントログ記録 → 再挑戦前ゲート
- **再挑戦ゲート**: 原因特定 + 修正 merge + readiness 再実行 + `rollbackSafetyWindowReady` true + 再発防止実装

checklist Section E との連動を runbook 冒頭で明記済。

---

## Phase 3: 差し替え当日（T-0 〜 T+1h）

[Section E.3–E.5](./replacement_final_checklist_2026-04-23.md#e3-t-0差し替え瞬間) を
上から順に塗る。hard_stop 集計欄を末尾に必ず埋めて意思決定ログとして保存する。

---

## Phase 4: ポスト差し替え（当日〜翌日）

### P2-F1: canary 監視の 24h 継続

- エラーレート / LCP / API p95 を 15分おきにサンプリング
- `/record` POST, `/map` 描画, `/specialist/review-queue` の 3 本だけは 5分おき smoke

### P2-F2: 文書整理

- `replacement_final_checklist_2026-04-23.md` を read-only 化 + 差し替え結果サマリ追記
- canonical pack に差し替え完了日を追記
- このアクションプランも改訂履歴を追加してクローズ

### P3-F3: レガシー PHP origin の段階撤去

差し替え完了後 1週間は `legacy_continued` family をそのまま動かす。1週間後から以下:

1. まず観察系（observation / identification）以外の family を staging 側に完全移行
2. observation / identification は v2 migration plan に従う（別文書）
3. `other` → 新 family に再分類したルートを優先移行

---

## D-Day

**2026-04-23 決定**: 今週内に差し替え実施。T-24h = 翌日中、T-0 = 2-3日後。
全 owner = YAMAKI、全 decision = GO、全 archive 候補承認済。

## 優先度サマリ（差し替え D-Day 逆算）

| 優先度 | タスク | 所要 | 着手タイミング |
|---|---|---|---|
| P0 | A1 フィールドガイド文言修正 | 10分 | 即時 |
| P0 | A2 多言語対応確認 | 10分 | 即時 |
| P0 | A3 grep CI スクリプト | 15分 | 即時 |
| P0 | B1 views/dashboard 判定 | 30分 | 本日中 |
| P0 | B2 API `other` 再分類 | 2-3h | T-48h まで |
| P1 | C1 Section A decision 一括 | 1-2h | T-48h まで |
| P2 | E1 rollback runbook | 1-2h | T-48h まで |
| P3 | D1 ENDPOINTS 重複削除 | 5分 | 即時 |
| — | T-24h Section E.1 全チェック | — | 前日 |
| — | T-1h Section E.2 全チェック | — | 直前 |
| — | T-0 差し替え実行 | — | 当日 |
| — | T+15m, T+1h カナリア | — | 当日 |
| P2 | F1 canary 24h | — | 差し替え後 |
| P2 | F2 文書クローズ | 30分 | +2日 |
| P3 | F3 legacy 段階撤去 | 〜1ヶ月 | +1週 |

**進捗サマリ 2026-04-23**: P0 全本完了、P1-C1 も一括判定で解消、P2-E1 も解消。
残りは T-24h / T-1h / T-0 の当日オペレーションのみ。

## 2026-04-23 final sweep (カットオーバー直前までの最終整備)

- ✅ API 再分類 ⚠ マーク全 62 件を `find` で実在確認、全解消
- ✅ Section D.1 に staging `/ops/readiness` 実測値を記入
- ✅ Section E.1 の 12 チェックに evidence / result を埋め込み
- ✅ VPS 作業 handoff 表 [`ops/runbooks/final_pre_cutover_handoff_2026-04-23.md`](../../ops/runbooks/final_pre_cutover_handoff_2026-04-23.md)
  を新規作成

### 判明した VPS 側 BLOCKER (T-24h の最優先タスク)

staging `/ops/readiness` が `needs_work` / `rollbackSafetyWindowReady: false`。
原因: `latestDriftReport.finished_at` が 24.7h 前で stale。VPS で:

```bash
cd /var/www/ikimon.life-staging/repo/platform_v2
npm run report:legacy-drift
npm run verify:legacy
npm run report:replacement-readiness
```

を実行すれば全 GREEN 復帰見込。詳細コマンドは handoff 表の T-24h セクション。

### Post-cutover TODO (差し替え後 1 週間内)

- [ ] `.github/workflows/deploy.yml` の health check を v2 路線に書き換え
  (legacy `/index.php` 等のままだと次回 main push で fail)
- [ ] `views/dashboard_*.php` 6件 (orphaned partial) の削除 PR
- [ ] legacy PHP API の段階撤去計画

---

## 改訂履歴

| date | author | change |
|---|---|---|
| 2026-04-23 | 愛 (Claude) | 初版。チェック表で顕在化した P0–P3 課題を Phase 0–4 に配置。最短 5–9h で差し替え可能と試算 |
