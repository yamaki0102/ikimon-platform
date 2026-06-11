# Biome型コラボキット 本番反映計画

作成日: 2026-06-12
対象: ikimon.life 現行PHP
目的: Biomeの企業・自治体コラボ事例から学び、ikimon.lifeで自治体・企業コラボをすぐ受けられる最小商品単位へ閉じる。

---

## 1. ゴール

Biomeが成立させているMVPは、単なるAI同定アプリではない。

`パートナー課題 -> 期間限定クエスト/観察会 -> 市民・社員参加 -> 結果可視化 -> 種リスト/報告書 -> 次回継続`

この一連を案件ごとに作り直さず回せることが、自治体・企業コラボの受け皿になっている。

ikimon.lifeは既に観察会、QR参加、ランキング、ビンゴ、サイトダッシュボード、企業ワークスペース、イベントレポート、種リストCSV/XLSX、TNFD/サイトレポート系の部品を持つ。今回の本番反映では、巨大な新機能追加ではなく、既存部品を「Biome型コラボキット」として壊れず使える状態へ閉じる。

---

## 2. 完了条件

### P0 完了条件

- 観察会ページから、主催者が一貫して `イベントレポート` と `種リストCSV/XLSX` に到達できる。
- イベント成果物系の観察抽出が、現行の `observations/YYYY-MM` 分割と整合している。
- イベントコード、手動リンク、サイト境界、緯度経度半径の順に、安全にイベント観察を集約できる。
- 無料側では簡易結果を見せ、`Public` だけで提出品質アウトプットを出す境界を維持する。
- 既存の希少種・位置配慮、法人プランゲート、XSS/JSONエンコード方針を壊さない。
- `php tools/lint.php` と関連PHP構文チェックが通る。
- stagingで観察会詳細、イベント結果、成果物リンクのsmokeが通る。

### 本番反映条件

ikimon.lifeの正本ルール上、Codexはmainへ直接pushしない。完了フローは以下。

1. `codex/biome-collab-kit` ブランチで実装する。
2. ローカル検証を通す。
3. 必要ならstagingへ反映してsmokeする。
4. PRを作成する。
5. mainマージ後、GitHub ActionsがVPSへ自動デプロイする。
6. production URLでsmokeする。

main protected branchにより、Codex権限だけでmain mergeできない場合は、PR作成とproduction到達不能理由を明示する。

---

## 3. Biome事例からの学び

| 事例型 | Biome側の代表例 | ikimonでの商品単位 |
|---|---|---|
| 自治体市民調査 | 東京都との基本協定、東京いきもの調査団 | 市町村・公園別の観察会/クエスト + 結果ページ |
| 生物台帳 | 東京いきもの台帳、標本・文献・専門家データ統合 | 地域台帳/サイト台帳 + DwC/CSV出力 |
| 外来種・獣害 | 神戸市外来カミキリ、千葉県外来水生植物、全国獣害調査 | 対象種キャンペーン + アラート + 集計CSV |
| 回遊・沿線 | JR/JTOS、いきものGO | QR参加 + ランキング + シェア画像 + 回遊導線 |
| 企業街区 | 丸の内いきものランド、TMIP | 社員・来街者参加イベント + 成果報告 |
| 開発/TNFD | 東急、大東建託、NTT自然資本モニタリング | 企業サイトモニタリング + 年次比較 + 補助レポート |

重要なのは、どの事例も `投稿を集めるだけ` で終わっていないこと。参加後に「提出・説明・次回改善」に使えるアウトプットがある。

---

## 4. 現行実装の棚卸し

### 既に使えるもの

- 観察会作成/編集: `upload_package/public_html/create_event.php`, `edit_event.php`
- 観察会詳細/QR参加/結果表示: `upload_package/public_html/event_detail.php`
- イベントコード連携: `upload_package/libs/EventManager.php`, `api/save_event.php`, `survey.php`
- ランキング/イベント統計: `upload_package/public_html/api/get_event_leaderboard.php`
- イベントレポート: `upload_package/public_html/generate_event_report.php`
- 種リストCSV/XLSX: `api/export_event_species_csv.php`, `api/export_event_species_xlsx.php`
- 法人プランゲート: `upload_package/libs/CorporatePlanGate.php`, `CorporateManager.php`
- サイト/法人レイヤ: `site_dashboard.php`, `corporate_dashboard.php`, `dashboard_municipality.php`
- 研究・提出系: `ReportEngine.php`, `DwcExportAdapter.php`, `api/v2/tnfd_leap_report.php`
- 外来種: `InvasiveAlertManager.php` と invasive assets

### 見つかったP0リスク

1. `generate_event_report.php`, `export_event_species_csv.php`, `export_event_species_xlsx.php` が `observations/YYYYMMDD` 風のpartitionを先に見に行く。現行正本は `observations/YYYY-MM` なので、過去イベントや大量データ時に抽出漏れしやすい。
2. `event_detail.php` の上部レポートボタンが旧 `generate_grant_report.php` を指している。ページ下部の成果物ボタンは `generate_event_report.php` を指しており、導線が割れている。
3. イベント観察抽出ロジックがAPI/レポート/CSV/XLSXで重複している。仕様ズレが起きやすい。

---

## 5. 実装方針

### P0-1. イベント観察抽出を共通化する

新規クラス候補:

- `upload_package/libs/EventObservationQuery.php`

責務:

- イベント期間を30分buffer込みで計算する。
- `observations/YYYY-MM` partitionを期間月だけ読む。
- 対象月partitionを上限なしで走査する。
- 月partitionが存在しない古い/壊れた環境だけ、互換fallbackとして `DataStore::fetchAll('observations')` を使う。
- `DataStore::getLatest('observations', 2000)` のような黙った件数打ち切りは、提出物系では使わない。
- 重複IDを除外する。
- イベント一致条件を一箇所に集約する。

一致条件:

1. `event_code` と `obs.event_tag` が一致
2. `linked_observations` に `obs.id` が含まれる
3. `location.site_id` または `site_id` がある場合、`obs.site_id` 一致または `SiteManager::isPointInSite()`
4. site未指定なら `location.lat/lng/radius_m` と `obs.lat/lng` の距離判定

使う側:

- `api/get_event_leaderboard.php`
- `generate_event_report.php`
- `api/export_event_species_csv.php`
- `api/export_event_species_xlsx.php`

抽出モード:

- `summary`: イベント詳細・ランキング・簡易結果用。`event_tag`, `linked`, `site`, `radius` を含める。
- `official`: レポート・CSV・XLSXなど提出物用。`event_tag`, `linked`, `site` のみ含め、`radius` 単独ヒットは除外する。

理由:

- `radius` 単独ヒットは、近くにいた第三者の投稿をイベント成果物へ混入させる可能性がある。
- 簡易結果では「この観察会の周辺で記録されたもの」として使えても、提出物では同意・所属の根拠が弱い。
- 主催者が提出物に含めたい観察は、イベントコード投稿、手動リンク、またはサイト境界に明示的に寄せる。

### P0-2. レポート導線を統一する

- `generate_grant_report.php` は現役の助成金向け出力なので削除しない。
- `event_detail.php` の上部導線は、助成金レポートだけに偏らないよう、通常イベントレポート導線を優先表示する。
- 助成金IDがあるイベントでは、助成金レポート導線も残す。

### P0-3. 無料/Public境界は変えない

- `CorporateManager::corporationHasFeature(null)` は既に `false` になっているため、この方針を維持する。
- 個人/無料/未紐づけイベントでは簡易結果を見せる。
- 正式レポート、CSV/XLSX出力は `Public` 権限を持つイベントだけに維持する。

---

## 6. 不採用範囲

今回やらない:

- 新しい課金プラン作成
- 抽選/クーポン/景品管理
- 自治体台帳の大規模CMS化
- BiomeViewer相当の予測モデル
- TNFD完全準拠をうたう文言
- 本番DB直接変更
- `upload_package/data/` の手編集

理由: 今回の目的は「コラボを受ける受け皿のP0閉鎖」。大きい商品拡張は、P0が本番で安定してからでよい。

---

## 7. 検証計画

### ローカル

- `php tools/lint.php`
- `php -l upload_package/libs/EventObservationQuery.php`
- `php -l upload_package/public_html/api/get_event_leaderboard.php`
- `php -l upload_package/public_html/generate_event_report.php`
- `php -l upload_package/public_html/api/export_event_species_csv.php`
- `php -l upload_package/public_html/api/export_event_species_xlsx.php`
- `php -l upload_package/tests/test_event_observation_query.php`
- `php upload_package/tests/test_event_observation_query.php`

### データ安全検証

- 月partitionイベント: `observations/YYYY-MM` から対象月全件を走査できる。
- 過去イベント: 新着2000件に依存せず、対象月partitionから抽出できる。
- summary/official分岐: `radius` 単独ヒットはsummaryに入り、officialには入らない。
- site境界: `SiteManager::isPointInSite()` 経由でsite内観察を拾える。
- 希少種fixture: CSV/XLSX/レポートで、希少種は公開可否または要配慮表示が維持される。座標列を追加する場合は丸め/非表示を必須にする。

### ブラウザ/HTTP smoke

- `php -S localhost:8899 -t upload_package/public_html`
- `event_detail.php?id=<fixture>` が200
- `api/get_event_leaderboard.php?event_id=<fixture>` がJSONで返る
- 過去/未来/サイト指定/半径指定のイベントでFatalが出ない

### staging

- stagingに反映可能な状態なら、観察会詳細、イベント結果、成果物リンクを確認する。
- staging dirtyやdeploy権限で止まる場合は、PR作成までを本番反映フロー上の到達点として記録する。

### production

- main merge後に `https://ikimon.life/events.php` と代表イベント詳細をsmokeする。
- GitHub Actionsのdeploy完了を確認する。

---

## 8. Claudeレビュー依頼ポイント

レビューで見てもらう論点:

1. P0範囲が広すぎないか。
2. EventObservationQuery共通化は安全か。
3. 既存の無料/Public境界を壊していないか。
4. 希少種・位置情報・個人参加者情報の扱いに漏れがないか。
5. 本番反映前に追加すべき検証があるか。

レビュー結果は `採用 / 不採用 / P1以降 / 未確認` に分けて、この計画へ反映する。

---

## 8.1 Claudeレビュー反映

レビュー取得:

- model_used: `claude-opus-4-8`
- review_path: `E:\Projects\_agent_scratch\claude-latest-review\biome-collab-kit\claude-review-20260612-075642.md`

### 採用

- P0スコープは「既存部品を壊れず閉じる」で維持する。
- EventObservationQuery共通化は採用する。
- `DataStore::getLatest(..., 2000)` fallbackは提出物系から外す。
- `radius` 単独ヒットは提出物に含めない。
- 希少種・位置配慮の検証をP0検証計画へ追加する。
- 30分bufferは定数化し、早着/遅延投稿を拾うための運用判断としてコメントを残す。

### 不採用

- `SiteManager::isPointInSite()` が存在しない可能性への懸念は、実体確認により不採用。現行 `upload_package/libs/SiteManager.php` に実装済み。
- `DataStore::getLatest()` が存在しない可能性への懸念は、実体確認により不採用。ただし提出物系では上限打ち切りを避けるため使わない。

### P1以降

- 外来種キャンペーンテンプレ
- effort / non-detection / revisit value の成果物化
- 地域台帳CMS化

### 未確認

- staging dirtyの状態。
- main merge後のGitHub Actions成功可否。

---

## 9. 次の進化

1. すぐやる価値: P0修正後、`観察会を1件作る -> QR参加 -> 投稿 -> 結果/種リスト` の営業デモ手順を1ページにする。
2. 中期的に効く: 外来種キャンペーンテンプレを `target_species + alert copy + export` として追加する。
3. 10x改善: Biome型の「発見数ゲーム」を超えて、ikimon独自の `effort / non-detection / revisit value` をイベント成果物へ入れる。
