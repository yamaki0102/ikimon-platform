# ikimon.life — サイトマップ（全ページ網羅）

> 自動生成: 2026-03-04 | ソース: ファイルシステムスキャン
> ページ数: 56 | APIエンドポイント: 92

## 凡例

- **Auth**: `●` = 要ログイン / `○` = 不要（ゲスト可） / `◐` = 一部制限
- **Mobile**: `📱` = モバイルナビに表示
- **Status**: `✅` 実装済 / `🚧` 実装中 / `📋` 計画中

---

## 1. メインナビゲーション

| # | ルート | ファイル | ページ名 | 機能概要 | Auth | Status |
|---|--------|---------|---------|---------|------|--------|
| 1 | `/` | `index.php` | ホームフィード | 最新観察一覧、デイリークエスト、トレンド種、フィルタ（all/unID/mine/follow） | ○ | ✅ |
| 2 | `/post.php` | `post.php` | 観察投稿 | 写真アップロード、EXIF抽出、GPS自動取得、WebP圧縮、オフラインキュー | ◐ | ✅ |
| 3 | `/explore.php` | `explore.php` | 探索グリッド | カテゴリフィルタ（鳥/虫/植物/菌/哺乳/爬虫）、検索、地域完了メーター | ○ | ✅ |
| 4 | `/map.php` | `map.php` | フィールドマップ | MapLibre GL、ヒートマップレイヤー、種分布 | ○ | ✅ |
| 5 | `/profile.php` | `profile.php` | プロフィール | ライフリスト、投資スコア、ランクバッジ、活動タイムライン | ● | ✅ |
| 6 | `/profile_edit.php` | `profile_edit.php` | プロフィール編集 | アバター、名前、専門分野 | ● | ✅ |
| 7 | `/ranking.php` | `ranking.php` | ランキング | 投稿数、同定数、有効性スコア | ○ | ✅ |
| 8 | `/dashboard.php` | `dashboard.php` | ダッシュボード | 個人統計、観察履歴、最近の活動 | ● | ✅ |

## 2. 認証

| # | ルート | ファイル | ページ名 | 機能概要 | Auth | Status |
|---|--------|---------|---------|---------|------|--------|
| 9 | `/login.php` | `login.php` | ログイン | メール/パスワード、ゲストアカウント作成 | ○ | ✅ |
| 10 | `/logout.php` | `logout.php` | ログアウト | セッション破棄 | ● | ✅ |
| 11 | `/oauth_login.php` | `oauth_login.php` | OAuth開始 | Google/X認証イニシエート | ○ | 📋 |
| 12 | `/oauth_callback.php` | `oauth_callback.php` | OAuthコールバック | プロバイダーリダイレクト処理 | ○ | 📋 |

## 3. 種同定 & リファレンス

| # | ルート | ファイル | ページ名 | 機能概要 | Auth | Status |
|---|--------|---------|---------|---------|------|--------|
| 13 | `/id_center.php` | `id_center.php` | IDセンター | 未同定観察キュー | ◐ | ✅ |
| 14 | `/id_form.php` | `id_form.php` | ID入力フォーム | 種同定追加（信頼度レベル4段階） | ● | ✅ |
| 15 | `/id_wizard.php` | `id_wizard.php` | IDウィザード | 34検索テーブル、分岐ロジック、ビジュアルキー | ○ | ✅ |
| 16 | `/id_workbench.php` | `id_workbench.php` | IDワークベンチ | プロ向け高速同定ワークスペース | ● | ✅ |
| 17 | `/species/{slug}` | `species.php` | 種ページ | 741引用、分布図、レッドリスト、写真 | ○ | ✅ |
| 18 | `/zukan.php` | `zukan.php` | いきもの図鑑 | 13冊+フィールドガイド、分類ツリー、検索 | ○ | ✅ |
| 19 | `/reference_layer.php` | `reference_layer.php` | 参考文献レイヤー | 1,248件学術論文、741統合引用 | ○ | ✅ |
| 20 | `/obs/{id}` | `observation_detail.php` | 観察詳細 | 写真、ID経緯、信頼度バッジ、地理情報 | ○ | ✅ |

## 4. B2B（企業向け）

| # | ルート | ファイル | ページ名 | 機能概要 | Auth | Status |
|---|--------|---------|---------|---------|------|--------|
| 21 | `/for-business.php` | `for-business.php` | 法人LP | サービス紹介、料金（¥298k/年）、ユースケース | ○ | ✅ |
| 22 | `/for-citizen.php` | `for-citizen.php` | 市民LP | 初心者向けオンボーディング | ○ | ✅ |
| 23 | `/for-researcher.php` | `for-researcher.php` | 研究者LP | Citation-First、DwCエクスポート | ○ | ✅ |
| 24 | `/showcase.php` | `showcase.php` | ショーケース | 生物多様性メトリクスダッシュボード | ○ | ✅ |
| 25 | `/csr_showcase.php` | `csr_showcase.php` | CSRショーケース | 企業レポーティング用 | ○ | ✅ |
| 26 | `/site/{id}` | `site_dashboard.php` | サイトダッシュボード | GeoJSON境界、レッドリスト、BIS、TNFD、DwC出力 | ● | ✅ |
| 27 | `/site_editor.php` | `site_editor.php` | サイトエディタ | MapLibre描画ツール、GeoJSONポリゴン保存 | ● | ✅ |

## 5. フィールド & ウェルネス

| # | ルート | ファイル | ページ名 | 機能概要 | Auth | Status |
|---|--------|---------|---------|---------|------|--------|
| 28 | `/field_research.php` | `field_research.php` | フィールドリサーチ | GPSトラッキング、セッション管理、歩数計 | ● | ✅ |
| 29 | `/ikimon_walk.php` | `ikimon_walk.php` | マイフィールド | 活動履歴、ルートマップ、遭遇種 | ● | ✅ |
| 30 | `/wellness.php` | `wellness.php` | ウェルネス | 歩数、距離、運動時間、気分トラッキング | ● | ✅ |
| 31 | `/heatmap.php` | `heatmap.php` | ヒートマップ | 種密度の地域別可視化 | ○ | ✅ |
| 32 | `/compass.php` | `compass.php` | コンパス | フィールドワーク用方位ナビ | ○ | ✅ |
| 33 | `/survey.php` | `survey.php` | 調査参加 | イベントベースの調査参加 | ◐ | ✅ |

## 6. イベント & コミュニティ

| # | ルート | ファイル | ページ名 | 機能概要 | Auth | Status |
|---|--------|---------|---------|---------|------|--------|
| 34 | `/events.php` | `events.php` | イベント一覧 | コミュニティカレンダー、チャレンジ | ○ | ✅ |
| 35 | `/event_detail.php` | `event_detail.php` | イベント詳細 | 日時、場所、説明、参加者 | ○ | ✅ |
| 36 | `/create_event.php` | `create_event.php` | イベント作成 | 新規イベントフォーム（要認証、CSRF） | ● | ✅ |
| 37 | `/edit_event.php` | `edit_event.php` | イベント編集 | 既存イベント更新 | ● | ✅ |
| 38 | `/widget.php` | `widget.php` | 埋め込みウィジェット | 外部サイトへのiframe埋め込み | ○ | ✅ |
| 39 | `/showcase_embed.php` | `showcase_embed.php` | ショーケース埋め込み | パートナーサイト用CSRダッシュボード | ○ | ✅ |

## 7. 情報ページ

| # | ルート | ファイル | ページ名 | 機能概要 | Auth | Status |
|---|--------|---------|---------|---------|------|--------|
| 40 | `/about.php` | `about.php` | About | プロジェクトミッション、30by30/TNFD LEAP | ○ | ✅ |
| 41 | `/pricing.php` | `pricing.php` | 料金 | Community（無料）/ Business（¥298k/年） | ○ | ✅ |
| 42 | `/guidelines.php` | `guidelines.php` | ガイドライン | コミュニティルール、モデレーション方針 | ○ | ✅ |
| 43 | `/terms.php` | `terms.php` | 利用規約 | データライセンス（CC BY）、制限事項 | ○ | ✅ |
| 44 | `/privacy.php` | `privacy.php` | プライバシー | 位置情報マスキング、データ取扱い | ○ | ✅ |
| 45 | `/offline.php` | `offline.php` | オフライン | PWAフォールバック、Service Workerエラー | ○ | ✅ |
| 46 | `/updates.php` | `updates.php` | 更新情報 | バージョン履歴、機能アナウンス | ○ | ✅ |
| 47 | `/team.php` | `team.php` | チーム | メンバープロフィール | ○ | ✅ |
| 48 | `/faq.php` | `faq.php` | FAQ | よくある質問 | ○ | ✅ |
| 49 | `/403.php` | `403.php` | 403エラー | アクセス拒否 | ○ | ✅ |
| 50 | `/404.php` | `404.php` | 404エラー | ページ未発見 | ○ | ✅ |

---

## API エンドポイント一覧（92件）

### 観察 & データ（8件）

| メソッド | エンドポイント | 機能 |
|---------|--------------|------|
| POST | `/api/post_observation.php` | 観察投稿（写真+位置+メタデータ） |
| GET | `/api/get_observations.php` | 観察取得（フィルタ・ページネーション） |
| GET | `/api/get_last_observation.php` | 最新観察取得 |
| POST | `/api/export_observations.php` | CSV出力 |
| POST | `/api/export_dwc.php` | Darwin Core形式出力 |
| POST | `/api/save_snapshot.php` | スナップショット保存 |
| GET | `/api/dev_obs_check.php` | [DEV] 観察デバッグ |
| GET | `/api/dev_obs_userId.php` | [DEV] ユーザー別観察 |

### 種同定（10件）

| メソッド | エンドポイント | 機能 |
|---------|--------------|------|
| POST | `/api/post_identification.php` | 種同定追加/更新 |
| POST | `/api/post_identification_v2.php` | 種同定v2 |
| GET | `/api/search_taxon.php` | 種名検索（和名/学名） |
| GET | `/api/taxon_suggest.php` | 種名オートコンプリート |
| GET | `/api/taxon_index.php` | 全分類群インデックス |
| GET | `/api/get_expert_comment.php` | 専門家コメント取得 |
| POST | `/api/post_dispute.php` | 同定異議 |
| GET | `/api/ai_suggest.php` | AI同定サジェスト |
| GET | `/api/freetext_review.php` | 自然言語レビュー |
| GET | `/api/dev_name_check.php` | [DEV] 名前検証 |

### サイト & レポート（12件）

| メソッド | エンドポイント | 機能 |
|---------|--------------|------|
| GET | `/api/list_sites.php` | サイト一覧 |
| GET | `/api/get_site_geojson.php` | GeoJSON境界取得 |
| GET | `/api/get_site_stats.php` | サイト統計 |
| POST | `/api/save_site.php` | サイト作成/更新 |
| POST | `/api/generate_site_report.php` | サイトレポートPDF |
| POST | `/api/generate_tnfd_report.php` | TNFD LEAPレポート |
| POST | `/api/generate_csr_report.php` | CSRレポート |
| POST | `/api/generate_pr.php` | プレスリリース |
| POST | `/api/generate_activity_report.php` | 活動サマリー |
| POST | `/api/generate_photo_digest.php` | フォトダイジェスト |
| POST | `/api/generate_executive_summary.php` | エグゼクティブサマリー |
| GET | `/api/export_site_csv.php` | サイトデータCSV |

### ユーザー & 認証（12件）

| メソッド | エンドポイント | 機能 |
|---------|--------------|------|
| POST | `/api/login_ajax.php` | ログイン認証 |
| POST | `/api/update_profile.php` | プロフィール更新 |
| POST | `/api/upload_avatar.php` | アバターアップロード |
| GET | `/api/get_notifications.php` | 通知取得 |
| POST | `/api/mark_notifications_read.php` | 通知既読 |
| POST | `/api/toggle_like.php` | いいね切替 |
| POST | `/api/toggle_follow.php` | フォロー切替 |
| GET | `/api/get_completeness.php` | 完了度（分類群） |
| GET | `/api/get_personal_report.php` | 個人レポート |
| POST | `/api/submit_nps.php` | NPSサーベイ |
| GET | `/api/dev_user_check.php` | [DEV] ユーザー検索 |
| GET | `/api/dev_mine_check.php` | [DEV] 自分の記録 |

### 地域 & 統計（11件）

| メソッド | エンドポイント | 機能 |
|---------|--------------|------|
| GET | `/api/region_list.php` | 地域一覧 |
| GET | `/api/region_stats.php` | 地域別統計 |
| GET | `/api/get_regional_stats.php` | 地域集計 |
| GET | `/api/get_impact_stats.php` | インパクト指標（CO2・健康） |
| GET | `/api/get_exploration_stats.php` | 探索進捗 |
| GET | `/api/get_wellness_summary.php` | ウェルネス集計 |
| GET | `/api/get_site_wellness.php` | サイト健康指標 |
| GET | `/api/get_analytics_summary.php` | 全体アナリティクス |
| POST | `/api/save_analytics.php` | アナリティクスイベント記録 |
| GET | `/api/heatmap_data.php` | ヒートマップデータ |
| GET | `/api/dev_count.php` | [DEV] グローバルカウント |

### 地図 & 地理空間（5件）

| メソッド | エンドポイント | 機能 |
|---------|--------------|------|
| GET | `/api/get_journey_map.php` | ジャーニーマップ |
| POST | `/api/save_track.php` | GPSトラック保存 |
| GET | `/api/get_tracks.php` | トラック取得 |
| GET | `/api/get_event_live.php` | ライブイベントヒートマップ |
| GET | `/api/get_field_sessions.php` | フィールドセッション |

### イベント（4件）

| メソッド | エンドポイント | 機能 |
|---------|--------------|------|
| GET | `/api/get_events.php` | イベント一覧 |
| POST | `/api/save_event.php` | イベント作成/更新 |
| POST | `/api/join_event.php` | イベント参加 |
| GET | `/api/get_event_log.php` | 参加ログ |

### ゲーミフィケーション（6件）

| メソッド | エンドポイント | 機能 |
|---------|--------------|------|
| GET | `/api/get_showcase_data.php` | ダッシュボードメトリクス |
| GET | `/api/get_time_capsule.php` | タイムカプセル |
| GET | `/api/get_ghost_data.php` | ゴースト通知 |
| GET | `/api/get_fog_data.php` | 霧の戦場（未探索エリア） |
| GET | `/api/get_strand_data.php` | ストランドイベント |
| GET | `/api/dev_profile.php` | [DEV] プロフィールデバッグ |

### 管理者（5件）

| メソッド | エンドポイント | 機能 |
|---------|--------------|------|
| GET | `/api/admin/get_users.php` | ユーザー一覧 |
| POST | `/api/admin/update_role.php` | ロール変更 |
| POST | `/api/admin/toggle_ban.php` | BAN切替 |
| GET | `/api/admin/get_queue.php` | 同定承認キュー |
| POST | `/api/admin/verify.php` | 同定承認/却下 |

### モデレーション（6件）

| メソッド | エンドポイント | 機能 |
|---------|--------------|------|
| POST | `/api/flag_content.php` | コンテンツ報告 |
| POST | `/api/report_content.php` | モデレーション報告 |
| POST | `/api/admin_action.php` | 管理者アクション |
| GET | `/api/dev_obs_show.php` | [DEV] 観察詳細表示 |
| GET | `/api/dev_login.php` | [DEV] 強制ログイン |
| GET | `/api/dev_photo_check.php` | [DEV] 写真検証 |

### エクスポート & 調査（7件）

| メソッド | エンドポイント | 機能 |
|---------|--------------|------|
| POST | `/api/export_dwca.php` | Darwin Core Archive |
| POST | `/api/survey.php` | 調査回答 |
| POST | `/api/export_surveys_dwc.php` | 調査データDwC出力 |
| POST | `/api/download_proof_package.php` | 観察証拠パッケージ |
| GET | `/api/health.php` | ヘルスチェック |
| GET | `/api/verify_config.php` | 設定検証 |
| POST | `/api/csp_report.php` | CSP違反レポート |

### v2 API（3件）

| メソッド | エンドポイント | 機能 |
|---------|--------------|------|
| POST | `/api/v2/30by30_report.php` | 30by30進捗レポート |
| POST | `/api/v2/bio-index.php` | Bio-Index計算 |
| POST | `/api/v2/tnfd_leap_report.php` | TNFD LEAPレポート |

---

## ナビゲーション構造

### デスクトップメニュー

```
[Logo → /]  [検索バー]  [探す ▼]  [共創する ▼]  [🔔]  [👤 ▼]
                         │                │              │
                         ├─ 探索           ├─ Missing     ├─ プロフィール
                         ├─ フィールドマップ ├─ IDセンター   ├─ サイト管理
                         ├─ いきもの図鑑    ├─ 共生サイト   ├─ ダッシュボード
                         └─ ランキング     ├─ イベント     ├─ 設定
                                          └─ 調査       └─ ログアウト
```

### モバイルボトムナビ

```
[ホーム] [探す] [＋投稿] [地図] [プロフィール]
```
