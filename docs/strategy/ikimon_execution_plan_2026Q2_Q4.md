# ikimon.life 実行開発計画 2026 Q2-Q4

更新日: 2026-04-11

参照元:

- `docs/strategy/DEVELOPMENT_PLAN.md`
- `docs/strategy/development_plan_2026Q2.md`
- `docs/strategy/refactoring_roadmap.md`
- `docs/strategy/ikimon_future_readiness_audit_2026-04-11.md`

対象期間:

- 即時着手から約 24 週間

対象前提:

- `ikimon.life` は半年から 1 年後に AI エージェント、多言語、音声・動画、学校運用が本格化する前提で進める
- PHP を捨てることは目的ではない
- 目的は「AI が強くなるほど価値が増える基盤」を先に作ること

---

## 0. この計画の位置づけ

既存の `DEVELOPMENT_PLAN.md` は、観察体験の拡張と音声AI接続に強い。
今回の計画は、それを否定するものではなく、その上に次の不足を埋めるものとして定義する。

- 正本データの分裂
- 多言語の後付け運用
- 音声・動画を asset として扱う基盤不足
- 学校運用の組織モデル不足
- AI エージェントが安全に介入する境界不足

この文書は `次の開発からそのまま着手できる順序付きの実行計画` である。

---

## 1. 北極星

### 1.1 サービス定義

`ikimon.life` は単なる観察投稿サイトではなく、次を実現する基盤を目指す。

- 子ども、家庭、学校、地域、研究者、自治体が同じ事実を異なる深さで使える
- AI が翻訳、整理、要約、字幕生成、同定補助を担う
- ただし AI は公開権限を直接持たず、人間の責任境界を超えない
- 音声・動画・写真・テキストが同じ知識基盤に着地する
- 多言語化しても「使ってよい品質か」が状態管理される

### 1.2 6か月後の状態

6か月後に最低でも次が成立している状態を目標にする。

- 写真なし軽量投稿、通常写真投稿、音声投稿が安定して動く
- `easy_ja / pt-BR / es-ES` を運用状態付きで扱える
- 学校 workspace 単位で教師レビューと公開制御ができる
- 音声 asset に transcript / caption / moderation が紐づく
- canonical source が明確になっている
- AI の翻訳・字幕・要約・分類は全て job と log を通る

### 1.3 非目標

この 24 週間では、以下は主目標にしない。

- 全ページの一斉フルリニューアル
- フレームワーク総入れ替え
- フロントエンドの React 化
- 動画の大規模ソーシャルフィード化
- 全自治体向けの重営業機能

---

## 2. まず固定すべき設計原則

### 2.1 正本は 1 つ

- JSON を raw archive にするか
- SQLite / PostgreSQL を canonical source にするか

を最初に決める。二重正本のまま進めない。

### 2.2 ファイル本体と意味情報を分離する

- 本体: object storage もしくは現在の uploads
- 意味情報: DB

写真、音声、動画、字幕、翻訳、公開状態は全て DB 管理する。

### 2.3 翻訳は text 変換ではなく stateful operation

翻訳には最低でも次の状態を持たせる。

- `draft`
- `machine_translated`
- `human_reviewed`
- `school_ready`
- `published`

### 2.4 AI は task 境界を越えない

AI 出力は常に次を残す。

- input
- output
- model
- cost
- actor
- review_status
- publish_eligibility

### 2.5 学校は organization model として扱う

`school_biotope` のような文脈タグだけでは不十分。最低限、workspace, classroom, teacher, student, guardian consent が必要。

---

## 3. 現状から見た最重要ギャップ

### Gap A. 正本データの分裂

現状:

- `DataStore` が広範囲に使われている
- `CanonicalStore` は設計されているが主流ではない
- `ikimon.db` に canonical table がまだ実装されきっていない

影響:

- 多言語、音声、動画、AI task を積んでも整合が崩れる

### Gap B. 軽量投稿と実装の不整合

現状:

- UI には写真なしモードがある
- API は通常ユーザーの写真なし投稿を受けない

影響:

- 子ども、日常利用、学校現場の導線が詰まる

### Gap C. 多言語の split-brain

現状:

- `Lang.php` は `ja/en`
- `voice_guide.php` は `pt/es` を個別対応
- コンテンツ自体の locale state はない

影響:

- 学校導入時に「どれが確認済み翻訳か」が不明になる

### Gap D. メディアが asset になっていない

現状:

- 写真、音声は主に public 配下に直置き
- transcript / caption / moderation / variant 管理がない
- 動画 upload path がない

影響:

- 将来の動画運用で必ず詰まる

### Gap E. 学校組織モデル不足

現状:

- teacher / classroom の実体がない
- guardian consent がない
- 学校向け review queue がない

影響:

- 学校実証が都度手運用になる

### Gap F. AI task 境界不足

現状:

- AI queue はあるが job テーブル・tenant budget・human approval が弱い

影響:

- 翻訳、字幕、要約、運用自動化が増えた時に監査が効かない

---

## 4. 全体ロードマップ

24 週間を次の 6 Release に分ける。

| Release | 期間 | 目的 | 絶対成果 |
|---|---:|---|---|
| R0 | 2週 | 土台の意思決定と信頼回復 | 正本方針、軽量投稿整合、オフライン救済 |
| R1 | 4週 | Canonical Foundation | canonical schema 稼働、JSON との責任分離 |
| R2 | 4週 | Multilingual Core | `easy_ja / pt-BR / es-ES` と translation state |
| R3 | 4週 | School Workspace MVP | teacher review, classroom, guardian consent 最小版 |
| R4 | 5週 | Media Asset Pipeline | audio/video asset, transcript/caption, moderation |
| R5 | 5週 | Agent-safe Ops | AI task ledger, approval, policy gate, cost control |

---

## 5. Workstream 定義

全 Release をまたぐ 8 本の workstream を固定する。

### WS1. Source of Truth

対象:

- `upload_package/libs/DataStore.php`
- `upload_package/libs/CanonicalStore.php`
- `upload_package/libs/CanonicalSync.php`
- `upload_package/scripts/migration/*`
- `upload_package/data/ikimon.db`

ゴール:

- 正本の責任分離を明文化し、コードにも反映する

### WS2. Trust UX / Field Reliability

対象:

- `public_html/post.php`
- `public_html/js/post-uploader.js`
- `public_html/js/OfflineManager.js`
- `public_html/api/post_observation.php`
- `public_html/observation_detail.php`
- `libs/PrivacyFilter.php`

ゴール:

- 失われない、漏れない、迷わない投稿体験

### WS3. Localization Platform

対象:

- `upload_package/lang/*`
- `upload_package/libs/Lang.php`
- 新規 `Localization*`, `Translation*` 系
- 公開コンテンツ管理層

ゴール:

- 文言翻訳ではなく locale 運用基盤を作る

### WS4. Media Asset System

対象:

- `uploads/`
- 音声API群
- 将来の動画 upload / transcode / subtitle

ゴール:

- media file を asset として管理する

### WS5. School Workspace

対象:

- 新規 workspace / classroom / consent / review モデル
- `events.php`, `review_queue.php`, school 向けダッシュボード

ゴール:

- 学校実証を手運用でなく product flow に乗せる

### WS6. AI Job Runtime

対象:

- `AiAssessmentQueue.php`
- `EmbeddingQueue.php`
- `JobRunner.php`
- 翻訳・字幕・モデレーション queue

ゴール:

- AI 処理を観測可能で差し替え可能な runtime にする

### WS7. Public Content OS

対象:

- 公開ページ群
- guide/article/explainer コンテンツ

ゴール:

- ページ直書きから構造化公開コンテンツへ寄せる

### WS8. QA / Observability

対象:

- `tests/Unit`
- `tests/Feature`
- health check
- job metrics
- rollout checklist

ゴール:

- 「作った」ではなく「運用できる」を満たす

---

## 6. Release 0: 土台の意思決定と信頼回復

期間:

- 2週間

目的:

- 今後の実装を始めても壊れにくい最低限の前提を固める

### 6.1 スコープ

#### R0-A. 正本方針の固定

決めること:

- `ikimon.db` を canonical source に育てるか
- JSON を read/write 継続するか、raw archive に寄せるか
- PostgreSQL 移行を今期やるか後段にするか

成果物:

- ADR 1本
- migration policy 1本

#### R0-B. 写真なし軽量投稿の整合

修正対象:

- `post.php`
- `post-uploader.js`
- `api/post_observation.php`

達成条件:

- `lightMode` が本当に通常ユーザーで通る
- location + text のみで保存できる
- 後から写真追加できる

#### R0-C. オフライン退避の強化

修正対象:

- `post-uploader.js`
- `OfflineManager.js`

達成条件:

- non-JSON response
- HTTP 5xx
- validation 以外のサーバー異常

でも下書き退避される

#### R0-D. 位置秘匿の見直し

修正対象:

- `observation_detail.php`
- `PrivacyFilter.php`
- 位置説明 UI

達成条件:

- 公開 JSON-LD
- ミニマップ
- reverse geocode

が Ambient layer に揃う

#### R0-E. 計測基盤

追加対象:

- outbox count
- post failure reason
- translation cost placeholder
- queue health

### 6.2 R0 の受け入れ基準

- 正本ポリシーが文章とコードコメントに反映されている
- 写真なし投稿が UI/API 両方で一致する
- オフライン保留中件数を確認できる
- 希少種・学校向けの公開粒度説明が投稿前に読める
- Feature test を最低 5 本追加する

### 6.3 R0 をやらないと起こること

- 次の release で DB 設計がやり直しになる
- 学校導線が壊れたまま進む
- 多言語や動画を載せても trust がない

---

## 7. Release 1: Canonical Foundation

期間:

- 4週間

目的:

- `DataStore 中心の現状` から `canonical source への移行開始` に入る

### 7.1 R1 の主要成果

#### R1-A. Canonical Schema 実DB化

最低限実装するテーブル:

- `events`
- `occurrences`
- `assets`
- `identifications`
- `privacy_access`
- `audit_log`
- `schema_migrations`

注記:

- `evidence` という名前より将来を見て `assets` を推奨

#### R1-B. JSON と canonical の責任分離

方針:

- JSON は raw ingest / legacy read / export fallback
- canonical DB は new feature の正本

#### R1-C. Canonical Write Path

新規投稿時に最低限以下を canonical に書く。

- event
- occurrence
- photo asset
- identification history entry
- privacy policy snapshot

#### R1-D. Canonical Read Pilot

read path を一気に全部変えず、まず以下で pilot する。

- `observation_detail.php`
- `review_queue.php`
- `api/get_observations.php` の一部

### 7.2 R1 の非目標

- JSON の全面廃止
- DB 完全移行
- Postgres 導入

### 7.3 R1 の受け入れ基準

- canonical table が実DBに存在する
- 新規投稿の canonical write が走る
- audit log が残る
- 観察1件について JSON と canonical の整合確認コマンドがある
- rollback 手順が文書化されている

---

## 8. Release 2: Multilingual Core

期間:

- 4週間

目的:

- `ja/en` と `voice_guide の多言語` を分断したまま増やさず、locale platform を入れる

### 8.1 新規データモデル

#### `content_localizations`

主要カラム:

- `content_id`
- `locale`
- `variant` (`original`, `easy_ja`, `public`, `school`)
- `title`
- `body`
- `summary`
- `translation_status`
- `review_status`
- `reviewed_by`
- `published_at`

#### `translation_jobs`

主要カラム:

- `job_id`
- `source_locale`
- `target_locale`
- `provider`
- `model`
- `input_hash`
- `status`
- `cost_usd`
- `output_ref`

#### `translation_reviews`

主要カラム:

- `localization_id`
- `review_type`
- `reviewer_id`
- `decision`
- `notes`

### 8.2 対応 locale

R2 で本当に運用に乗せる対象:

- `ja`
- `easy-ja`
- `pt-BR`
- `es-ES`

### 8.3 Gemini 組み込み方針

- `TranslationProviderInterface`
- `GeminiTranslationProvider`
- `TranslationJobRunner`

の 3 層で実装し、モデル名をビジネスロジックへ直書きしない

### 8.4 R2 の受け入れ基準

- locale registry がある
- `easy-ja` が first-class locale として扱われる
- `pt-BR` / `es-ES` を machine translation できる
- human review を経ないと `school_ready` にならない
- 翻訳コストが記録される

---

## 9. Release 3: School Workspace MVP

期間:

- 4週間

目的:

- 学校向け試験運用をプロダクトで支えられる最小組織モデルを作る

### 9.1 新規データモデル

#### `workspaces`

- school 単位

#### `workspace_members`

- `student`
- `teacher`
- `school_admin`
- `guardian_viewer`

#### `classrooms`

- workspace 配下

#### `student_profiles`

- 表示名
- 学年
- 公開名ポリシー

#### `guardian_consents`

- media
- public display
- AI processing
- translation

#### `school_review_queue`

- review target
- locale completeness
- privacy check
- publication decision

### 9.2 プロダクト面

最低限必要な画面:

- school dashboard
- teacher review queue
- class summary
- student submission list
- consent status list

### 9.3 公開ルール

学校投稿は原則として次を通る。

- student submits
- teacher reviews
- locale completeness check
- privacy check
- publish decision

### 9.4 R3 の受け入れ基準

- classroom 単位で観察を束ねられる
- teacher が review できる
- guardian consent の欠落が UI で見える
- `school_ready` と `published` を分けられる
- 学校向けの簡易ふりかえりレポートを出せる

---

## 10. Release 4: Media Asset Pipeline

期間:

- 5週間

目的:

- 音声と将来の動画を同じ asset pipeline に乗せる

### 10.1 新規データモデル

#### `assets`

- `asset_id`
- `owner_type`
- `owner_id`
- `kind` (`image`, `audio`, `video`, `subtitle`, `transcript`, `thumbnail`)
- `storage_key`
- `mime_type`
- `duration_ms`
- `visibility`
- `moderation_status`

#### `asset_variants`

- `variant_type`
- `codec`
- `width`
- `height`
- `bitrate`

#### `asset_transcripts`

- locale
- transcript text
- status
- source job id

#### `asset_captions`

- locale
- vtt / srt path
- review status

#### `asset_jobs`

- upload
- transcode
- waveform
- asr
- translation
- moderation

### 10.2 実装順

#### Step 1

- 既存音声 upload を asset ledger に接続

#### Step 2

- transcript / caption を追加

#### Step 3

- 動画 upload session を追加

#### Step 4

- transcoding と thumbnail

### 10.3 保管方針

R4 で決めること:

- 現行 `PUBLIC_DIR/uploads` のまま ledger 化だけ先にやるか
- object storage へ移すか

推奨:

- ledger 先行
- storage migration は asset abstraction 後

### 10.4 R4 の受け入れ基準

- 音声 asset が DB で追える
- transcript と caption が locale 単位で紐づく
- 動画 upload の最小パスがある
- moderation 状態が UI に出る
- public page は asset metadata を経由して読む

---

## 11. Release 5: Agent-safe Ops

期間:

- 5週間

目的:

- AI エージェントを安全に運用フローへ入れる

### 11.1 新規データモデル

#### `agent_tasks`

- task type
- subject
- requested_by
- policy scope
- status

#### `agent_outputs`

- output payload
- model
- cost
- confidence
- artifact refs

#### `human_approvals`

- approver
- decision
- notes
- approved scope

#### `policy_checks`

- locale completeness
- child safety
- privacy compliance
- moderation
- citation presence

### 11.2 対象 AI task

R5 で productize する対象:

- translation
- easy-ja rewrite
- transcript cleanup
- caption generation
- content summary
- school report draft

### 11.3 対象外

- AI による直接公開
- AI による権限昇格
- AI による consent bypass

### 11.4 R5 の受け入れ基準

- AI 出力が task と結びつく
- approval なしで publish されない
- locale / school / workspace 単位のコストが取れる
- 失敗 job と dead-letter が見える

---

## 12. 依存関係とクリティカルパス

### 12.1 クリティカルパス

1. `R0-A` 正本方針
2. `R1-A` canonical schema 実DB化
3. `R2-A` localization state 導入
4. `R3-A` school workspace
5. `R4-A` asset ledger
6. `R5-A` agent task ledger

### 12.2 先にやらないと後で詰むもの

- canonical source
- translation status
- asset ledger
- guardian consent model

### 12.3 後からでも足せるもの

- 高度な route recommendation
- 重い B2B レポート拡張
- UI の大規模刷新

---

## 13. テスト計画

### 13.1 自動テスト

毎 Release で増やすべき Feature test:

- 投稿成功
- 写真なし軽量投稿
- オフライン退避
- location granularity
- translation state transition
- teacher review publish gate
- asset transcript attach
- AI approval gate

### 13.2 手動検証

毎 Release で必須の手動シナリオ:

- 浜松のポルトガル語話者想定
- スペイン語話者想定
- 日本語が苦手な子ども想定
- 教師レビュー想定
- 弱回線屋外観察想定

### 13.3 品質ゲート

各 Release の merge 条件:

- lint green
- phpunit green
- 新規 Feature test green
- rollback 手順あり
- 実データまたは staging データで 1 回通し確認

---

## 14. 指標

### プロダクト指標

- 軽量投稿完了率
- オフライン保存成功率
- 多言語ページ閲覧率
- translation review lead time
- teacher review lead time
- school publish approval rate
- 音声 asset の transcript completion rate
- AI task approval rate

### 技術指標

- queue oldest age
- translation cost / locale
- asset processing latency
- canonical write success rate
- JSON / canonical divergence count
- publish blocked by policy count

---

## 15. リスク登録簿

| リスク | 影響 | 発生確率 | 対応 |
|---|---|---:|---|
| 正本方針が決まらない | 全工程遅延 | 高 | R0 の最優先議題に固定 |
| 翻訳レビュー運用が回らない | 学校利用不可 | 中 | `school_ready` を明確に分離 |
| 動画ストレージ費が読めない | コスト超過 | 中 | asset ledger 先行、storage abstraction |
| 学校同意フローが複雑化 | 実証停滞 | 中 | MVP は consent scope を 4 種に絞る |
| JSON と canonical の不整合 | データ事故 | 高 | divergence check CLI を持つ |
| AI cost が急増 | 運用停止 | 中 | locale / workspace / task 別 budget |

---

## 16. 直近 4 週間の具体タスク

### Week 1

- 正本方針 ADR 作成
- `lightMode` 投稿の UI/API 整合修正
- Outbox 退避条件修正
- 位置秘匿の公開表現監査を再実施

### Week 2

- canonical schema migration 実装
- new observation の dual write 開始
- divergence check コマンド追加
- Feature test 追加

### Week 3

- locale registry
- `easy-ja` 設計
- translation job table
- Gemini translation provider 抽象化

### Week 4

- `pt-BR` / `es-ES` 初回 pipeline
- review status UI 最小版
- 翻訳コスト記録
- 手動レビュー運用テスト

---

## 17. この計画の使い方

実装時は、毎回この順で判断する。

1. その変更は `正本を強くする` か
2. その変更は `多言語運用を stateful にする` か
3. その変更は `asset 化` に寄与するか
4. その変更は `学校運用を product flow に乗せる` か
5. その変更は `AI を安全に介入させる境界` を作るか

5つのどれにも効かない変更は、今期の主戦場ではない可能性が高い。

---

## 18. 結論

今期の本質は機能追加ではない。

`ikimon.life` を

- AI が安く強くなっても価値が増え続ける
- 子どもと学校で本当に使える
- 音声・動画・翻訳を無理なく抱えられる
- 人と AI の責任境界が明確

という基盤へ変えることが本題である。

そのために、次の順番を崩さない。

1. 正本
2. 信頼
3. 多言語
4. 学校
5. メディア
6. エージェント運用

この順なら、PHP のままでも十分に伸ばせる。
