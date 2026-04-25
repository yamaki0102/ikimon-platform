# ikimon.life Future Readiness Audit

更新日: 2026-04-11

## 目的

`ikimon.life` を、次の前提で再監査する。

- 半年から1年で AI エージェント活用が前提になる
- 音声・動画投稿が増える
- 浜松の多言語支援、特に `pt-BR` / `es` と `やさしい日本語` が重要になる
- 小中学校での試験運用に耐える必要がある
- AGI/ASI 時代でも、単なる AI ラッパーではなく現場価値が残るサービスを目指す

本メモは「今すぐ直すべきもの」と「将来の骨格」を混ぜずに整理するための監査結果。

## 現状の強み

- PHP 8.2 ベースで、投稿・同定・探索・レポート・B2B ダッシュボードまで広く実装されている
- AI キュー、Embedding、音声解析、音声ガイドなど、将来に伸びる機能の芽が既にある
- Canonical Schema の設計思想自体は存在する
- `php tools/lint.php` は 626 files / errors 0
- `php vendor/bin/phpunit` は 161 tests / 386 assertions で通過

## 現状の定量把握

- `upload_package/**/*.php` 内の `DataStore::` 参照: 222 files / 490 refs
- `upload_package/**/*.php` 内の `CanonicalStore::` 参照: 9 files / 29 refs
- `Lang::init` 利用: 15 files / 15 refs
- `__()` 利用: 11 files / 135 refs
- `move_uploaded_file()` 利用: 11 files / 13 refs
- `teacher` 参照: 0 files
- `classroom` 参照: 0 files
- `guardian` 参照: 2 files
- `transcript` 参照: 1 file
- `video` upload ハンドラ: なし

この数字が示すことは単純で、今の正本は依然として JSON ベースであり、多言語・教育・メディア運用は将来構想に対して薄い。

## 最重要診断

### 1. 言語は問題ではない。正本の分裂が問題

PHP を続けること自体は致命傷ではない。

いちばん危険なのは、以下が同時に存在していること。

- `DataStore` を中心にした JSON 正本
- `CanonicalStore` を中心にした SQLite 正規化構想
- `ikimon.db` に canonical table がまだ載っていない状態

設計思想と実データの正本が分裂しているため、今後の AI 運用、多言語運用、動画・音声運用、学校運用の全てで整合性問題が起きる。

### 2. 多言語は「翻訳機能」ではなく「運用基盤」

今の `Lang.php` は `ja/en` を前提としており、UI の大半は i18n 化されていない。

一方で `voice_guide.php` は `es` / `pt` まで即席で広げている。

つまり、

- UI 文言の多言語
- コンテンツ本文の多言語
- 音声ガイドの多言語
- 字幕・トランスクリプトの多言語

が別々に増え始めている。

このまま進めると、将来は「翻訳されたもの」と「されていないもの」が混在し、学校導入や保護者説明で事故る。

### 3. メディアは「ファイル」ではなく「資産」

現状の写真・音声は主に `PUBLIC_DIR/uploads/**` 配下に直保存されている。

この構成だと将来必要になる次の概念が不足する。

- variant
- transcript
- subtitle / caption
- moderation state
- publication state
- access control
- review history
- usage rights

音声や動画の投稿が増えた瞬間、`uploads/` 直保存では運用が詰まる。

### 4. 学校運用は「タグ」ではなく「組織モデル」が必要

`school_biotope` や `managed_context` はあるが、以下がない。

- teacher
- classroom
- roster
- parental consent
- school review
- child-safe publishing rule
- class summary / assignment / reflection

学校実証で必要なのは、学校っぽいラベルではなく、学校運用を壊さないデータモデル。

### 5. AI 時代に残る価値の核は、翻訳や要約ではない

AI コストが下がるほど薄くなるもの:

- 汎用翻訳
- 汎用要約
- 汎用検索
- 汎用 FAQ

逆に価値が残るもの:

- 地域・学校・家庭に結びついた一次データ
- AI が触れるが勝手に壊せない検証済み知識
- 支援履歴、承認履歴、公開責任のログ
- 現場ごとの言語運用ルールと表現レベル

`ikimon.life` は後者を積むべき。

## 重大ギャップ

### P0: すぐ直すべきもの

#### A. 正本戦略

- JSON を raw archive にするのか、SQLite / PostgreSQL を canonical source にするのか決める
- `CanonicalStore` を本番DBで本当に使う状態まで持っていく
- `CanonicalSync` を一時橋渡しにするのか恒久運用にするのか決める

#### B. 軽量投稿の整合性

- `post.php` は「写真なしでメモだけ残す」を出している
- しかし `post_observation.php` は `surveyor_official` 以外の写真なし投稿を拒否している

この不整合は、学校・日常・低負荷記録の入口を壊すので最優先で直すべき。

#### C. オフライン再送の完全性

- 現状は非 JSON / 500 / HTML エラー時に Outbox 退避しない
- ネットワーク例外に限定して退避するため、弱回線現場でデータ喪失の不安が残る

屋外観察プラットフォームとしては P0。

#### D. 位置秘匿の一貫性

- `PrivacyFilter` はある
- ただし公開表現全体が Ambient layer 中心に統一されているとは言い切れない

希少種・学校・子ども向けでは公開位置の説明責任が重要なので、表示・JSON-LD・地図・検索結果すべてで整合させる必要がある。

#### E. 多言語の status 管理

- 機械翻訳
- 人確認済み
- 学校利用可
- 公開中

の区別がまだない。

教育利用では、翻訳そのものより「この翻訳を使ってよいか」が重要。

### P1: 3か月以内に骨格を作るべきもの

#### F. 多言語コンテンツ基盤

最低限必要なテーブル:

- `contents`
- `content_localizations`
- `content_assets`
- `translation_jobs`
- `translation_reviews`
- `publication_releases`

最低限必要な状態:

- `draft`
- `machine_translated`
- `human_reviewed`
- `school_ready`
- `published`
- `archived`

#### G. メディア資産基盤

最低限必要なテーブル:

- `assets`
- `asset_variants`
- `asset_transcripts`
- `asset_captions`
- `asset_moderation_flags`
- `asset_jobs`

対象:

- image
- audio
- video
- waveform
- thumbnail
- subtitle
- transcript

#### H. 学校 workspace

最低限必要なテーブル:

- `workspaces`
- `workspace_members`
- `classrooms`
- `student_profiles`
- `guardian_consents`
- `school_review_queue`
- `school_reports`

最低限必要な役割:

- `student`
- `teacher`
- `school_admin`
- `guardian_viewer`

#### I. AI ジョブの永続化

現状の JSON queue は小規模には十分だが、動画・音声・翻訳が増えると厳しい。

必要なもの:

- queue table
- retry policy
- dead-letter
- cost ledger
- tenant / school 単位の budget

#### J. やさしい日本語レイヤー

`ja` と `pt-BR` / `es` の間に `easy_ja` を入れる。

理由:

- 子ども向け
- 保護者向け
- 学校現場での確認容易性
- 機械翻訳事故の低減

### P2: 半年〜1年スパンで伸ばすもの

#### K. 動画パイプライン

動画 upload 自体がまだ存在しないため、動画を前提に以下を設計する。

- upload session
- resumable upload
- transcoding
- thumbnail generation
- ASR
- subtitle generation
- moderation
- publish review

#### L. Agent-safe interface

将来の AI エージェント運用では、AI が直接ページを触るのではなく、次の境界を通すべき。

- `agent_tasks`
- `agent_outputs`
- `agent_logs`
- `human_approvals`
- `policy_checks`

#### M. API-first 化

いまは page-first だが、長期的には次の二層構造に寄せるべき。

- public/admin UI
- agent/mobile/external 向け API

#### N. 事業価値の再定義

今後の価値の中心は次のどれかに置くべき。

- 地域自然観察の一次データ基盤
- 多言語・音声・動画を含む学習支援基盤
- 学校・家庭・自治体をつなぐ環境理解基盤
- 企業/自治体向け生物多様性レポート基盤

全部を同時に最大化しようとすると設計が曖昧になる。主軸を決める必要がある。

## 推奨ターゲットアーキテクチャ

### 短中期

- Web / Admin: PHP
- Canonical DB: SQLite もしくは PostgreSQL へ移行前提
- Object storage: 画像・音声・動画本体
- Queue / Worker: 非同期処理
- AI worker: 翻訳、ASR、タグ付け、要約、モデレーション

### 長期

- Public UI
- Admin UI
- Mobile
- Agent interface

の全てが同じ canonical data model を読む構造に寄せる。

## 実行順

### Wave 0: 正本戦略の確定

決めること:

- canonical source は何か
- JSON は何として残すか
- `ikimon.db` を本番正本にするか
- PostgreSQL へ寄せる時期

### Wave 1: ユーザー信頼の回復

直すこと:

- 写真なし軽量投稿の API 整合
- オフライン退避条件の拡張
- 位置秘匿の表示一貫性
- 投稿前の公開粒度説明

### Wave 2: 多言語基盤

直すこと:

- locale registry
- `easy_ja`
- `pt-BR`
- `es-ES`
- translation status
- review workflow

### Wave 3: メディア基盤

直すこと:

- asset ledger
- transcript / caption
- moderation state
- object storage
- video upload path

### Wave 4: 学校基盤

直すこと:

- workspace
- classroom
- guardian consent
- teacher review
- school-safe publication
- class reflection report

### Wave 5: Agent-safe automation

直すこと:

- agent tasks
- approvals
- logs
- policy gates
- cost and safety controls

## 実装判断原則

### 採用する

- AI が賢くなるほど価値が増える構造
- 人と AI の両方が使えるデータ構造
- file ではなく asset として扱う設計
- 表示言語と意味情報を分離する設計
- 公開状態とレビュー状態を明示する設計

### 採用しない

- `title_pt`, `title_es` のようなカラム増殖
- `PUBLIC_DIR/uploads` を長期正本にする設計
- 機械翻訳を即公開する設計
- ページごとの個別翻訳ロジック
- AI が直接公開面を更新する設計

## 成功指標

### 30日

- 軽量投稿が本当に動く
- オフライン保存から再送まで成立する
- 多言語コンテンツの status が DB で管理される
- canonical source 方針が決まる

### 90日

- `easy_ja`, `pt-BR`, `es-ES` の公開運用が可能
- 音声 asset に transcript / caption / moderation が載る
- 学校 workspace の最小運用が成立する
- 翻訳コストと AI コストを tenant 単位で追える

### 6〜12か月

- 動画 upload と処理パイプラインが稼働する
- 学校・家庭・自治体の三者に意味のあるレポートが自動生成される
- AI エージェントが safe boundary 経由で運用に参加できる

## 結論

`ikimon.life` は「PHPだから弱い」のではない。

本当に危ないのは次の4つ。

- 正本の分裂
- 多言語の後付け
- メディアをファイルとしてしか扱っていないこと
- 学校運用を個人観察導線の延長で済ませようとしていること

逆に言えば、ここを早く直せば、AI 時代でも価値が伸びる。

このサービスが目指すべきなのは、AI の便利機能集ではなく、
`地域・学校・家庭・支援者・自治体が、AI と一緒に自然理解を積み上げる基盤`
である。
