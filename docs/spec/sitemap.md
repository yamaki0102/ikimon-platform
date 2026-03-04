# ikimon.life — サイトマップ（全ページ網羅）

> 更新: 2026-03-04 | ソース: ファイルシステムスキャン（全ディレクトリ対象）
> ページ数: 90 | APIエンドポイント: 99（うちDEV系: 11、テスト系: 2）

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
| 11 | `/oauth_login.php` | `oauth_login.php` | OAuth開始 | Google/X認証イニシエート | ○ | ✅ |
| 12 | `/oauth_callback.php` | `oauth_callback.php` | OAuthコールバック | プロバイダーリダイレクト処理 | ○ | ✅ |

## 3. 種同定 & リファレンス

| # | ルート | ファイル | ページ名 | 機能概要 | Auth | Status |
|---|--------|---------|---------|---------|------|--------|
| 13 | `/id_center.php` | `id_center.php` | IDセンター | 未同定観察キュー | ◐ | ✅ |
| 14 | `/needs_id.php` | `needs_id.php` | 未同定リスト | 未同定・意見分かれ観察の一覧と同定依頼フロー | ◐ | ✅ |
| 15 | `/id_form.php` | `id_form.php` | ID入力フォーム | 種同定追加（信頼度レベル4段階） | ● | ✅ |
| 16 | `/id_wizard.php` | `id_wizard.php` | IDウィザード | 34検索テーブル、分岐ロジック、ビジュアルキー | ○ | ✅ |
| 17 | `/id_workbench.php` | `id_workbench.php` | IDワークベンチ | プロ向け高速同定ワークスペース | ● | ✅ |
| 18 | `/species/{slug}` | `species.php` | 種ページ | 741引用、分布図、レッドリスト、写真 | ○ | ✅ |
| 19 | `/compare.php` | `compare.php` | 種の比較ビュー | 2種をOmoikane＋観察データで並列比較 | ○ | ✅ |
| 20 | `/zukan.php` | `zukan.php` | いきもの図鑑 | 13冊+フィールドガイド、分類ツリー、検索 | ○ | ✅ |
| 21 | `/reference_layer.php` | `reference_layer.php` | 参考文献レイヤー | 1,248件学術論文、741統合引用 | ○ | ✅ |
| 22 | `/obs/{id}` | `observation_detail.php` | 観察詳細 | 写真、ID経緯、信頼度バッジ、地理情報 | ○ | ✅ |

## 4. B2B（企業向け）— メインページ

| # | ルート | ファイル | ページ名 | 機能概要 | Auth | Status |
|---|--------|---------|---------|---------|------|--------|
| 23 | `/for-business.php` | `for-business.php` | 法人LP | サービス紹介、料金（¥298k/年）、ユースケース | ○ | ✅ |
| 24 | `/for-citizen.php` | `for-citizen.php` | 市民LP | 初心者向けオンボーディング | ○ | ✅ |
| 25 | `/for-researcher.php` | `for-researcher.php` | 研究者LP | Citation-First、DwCエクスポート | ○ | ✅ |
| 26 | `/showcase.php` | `showcase.php` | ショーケース | 生物多様性メトリクスダッシュボード | ○ | ✅ |
| 27 | `/csr_showcase.php` | `csr_showcase.php` | CSRショーケース | 企業レポーティング用 | ○ | ✅ |
| 28 | `/site/{id}` | `site_dashboard.php` | サイトダッシュボード | GeoJSON境界、レッドリスト、BIS、TNFD、DwC出力 | ● | ✅ |
| 29 | `/site_editor.php` | `site_editor.php` | サイトエディタ | MapLibre描画ツール、GeoJSONポリゴン保存 | ● | ✅ |
| 30 | `/corporate_dashboard.php` | `corporate_dashboard.php` | 法人ダッシュボード | 企業サイトの生物多様性スコア・観察集計 | ○ | 🚧 |
| 31 | `/dashboard_municipality.php` | `dashboard_municipality.php` | 自治体ダッシュボード | 30by30進捗とBISスコアの自治体向け分析 | ○ | 🚧 |
| 32 | `/dashboard_portfolio.php` | `dashboard_portfolio.php` | エンタープライズ本社ダッシュボード | 複数サイトの環境KPIをポートフォリオ集計 | ○ | 🚧 |

## 5. B2B（企業向け）— for-business/ サブディレクトリ

| # | ルート | ファイル | ページ名 | 機能概要 | Auth | Status |
|---|--------|---------|---------|---------|------|--------|
| 33 | `/for-business/` | `for-business/index.php` | ikimon for Business LP | B2B営業用ランディングページ・環境投資見える化訴求 | ○ | ✅ |
| 34 | `/for-business/apply.php` | `for-business/apply.php` | 導入申込フォーム | B2B問い合わせ・セルフサービス導入申込 | ○ | ✅ |
| 35 | `/for-business/pricing.php` | `for-business/pricing.php` | 料金プラン（B2B詳細） | Community無料プランとBusinessプランの比較表 | ○ | ✅ |
| 36 | `/for-business/demo.php` | `for-business/demo.php` | デモリダイレクト | アクティブサイトのダッシュボードへデモモードで転送 | ○ | ✅ |
| 37 | `/for-business/sample_report.php` | `for-business/sample_report.php` | 営業用サンプルレポート | 架空サイトのTNFD LEAPレポートを静的描画（営業資料） | ○ | ✅ |

## 6. サイトダッシュボード — views/ ビューパーシャル

> `site_dashboard.php` (#28) からAjax/インクルードで呼ばれるビューコンポーネント。直接アクセス可だがAuth制御は親ページ依存。

| # | ルート | ファイル | ページ名 | 機能概要 | Auth | Status |
|---|--------|---------|---------|---------|------|--------|
| 38 | `/views/dashboard_overview.php` | `views/dashboard_overview.php` | 概要ビュー | マップファーストのサイト統計・最近の観察一覧 | ◐ | ✅ |
| 39 | `/views/dashboard_reports.php` | `views/dashboard_reports.php` | レポート出力ビュー | 環境省様式・BISクレジット・PDFのレポート生成UI | ◐ | ✅ |
| 40 | `/views/dashboard_system.php` | `views/dashboard_system.php` | システムアーキテクチャビュー | デジタルツイン構成・環境価値算出ロジック説明 | ◐ | ✅ |
| 41 | `/views/dashboard_events.php` | `views/dashboard_events.php` | イベント・ミッション管理ビュー | サイト内の観察ミッションとイベント一覧・作成UI | ◐ | 🚧 |
| 42 | `/views/dashboard_settings.php` | `views/dashboard_settings.php` | エリア設定ビュー | 登録済みモニタリングエリアの一覧・編集・追加 | ◐ | 🚧 |
| 43 | `/views/dashboard_map_3d.php` | `views/dashboard_map_3d.php` | 3Dボクセル解析エンジン | 点群データアップロードと3D生態解析（Pro β） | ◐ | 🚧 |

## 7. フィールド & ウェルネス

| # | ルート | ファイル | ページ名 | 機能概要 | Auth | Status |
|---|--------|---------|---------|---------|------|--------|
| 44 | `/field_research.php` | `field_research.php` | フィールドリサーチ | GPSトラッキング、セッション管理、歩数計 | ● | ✅ |
| 45 | `/ikimon_walk.php` | `ikimon_walk.php` | マイフィールド | 活動履歴、ルートマップ、遭遇種 | ● | ✅ |
| 46 | `/wellness.php` | `wellness.php` | ウェルネス | 歩数、距離、運動時間、気分トラッキング | ● | ✅ |
| 47 | `/heatmap.php` | `heatmap.php` | ヒートマップ | 種密度の地域別可視化 | ○ | ✅ |
| 48 | `/compass.php` | `compass.php` | コンパス | フィールドワーク用方位ナビ | ○ | ✅ |
| 49 | `/survey.php` | `survey.php` | 調査参加 | イベントベースの調査参加 | ◐ | ✅ |

## 8. イベント & コミュニティ

| # | ルート | ファイル | ページ名 | 機能概要 | Auth | Status |
|---|--------|---------|---------|---------|------|--------|
| 50 | `/events.php` | `events.php` | イベント一覧 | コミュニティカレンダー、チャレンジ | ○ | ✅ |
| 51 | `/event_detail.php` | `event_detail.php` | イベント詳細 | 日時、場所、説明、参加者 | ○ | ✅ |
| 52 | `/create_event.php` | `create_event.php` | イベント作成 | 新規イベントフォーム（要認証、CSRF） | ● | ✅ |
| 53 | `/edit_event.php` | `edit_event.php` | イベント編集 | 既存イベント更新 | ● | ✅ |
| 54 | `/bingo.php` | `bingo.php` | 生きもの観察ビンゴ | イベント連動の3×3生物ビンゴカード | ● | ✅ |
| 55 | `/my_organisms.php` | `my_organisms.php` | マイ生き物リスト | ログインユーザーの観察済み種一覧・ライフリスト | ● | ✅ |
| 56 | `/widget.php` | `widget.php` | 埋め込みウィジェット | 外部サイトへのiframe埋め込み | ○ | ✅ |
| 57 | `/showcase_embed.php` | `showcase_embed.php` | ショーケース埋め込み | パートナーサイト用CSRダッシュボード | ○ | ✅ |

## 9. AI / Omoikane

| # | ルート | ファイル | ページ名 | 機能概要 | Auth | Status |
|---|--------|---------|---------|---------|------|--------|
| 58 | `/omoikane_dashboard.php` | `omoikane_dashboard.php` | Omoikane抽出コンソール | 10万種ナレッジグラフ生成プロジェクトの監視UI | ◐ | ✅ |

## 10. 情報ページ

| # | ルート | ファイル | ページ名 | 機能概要 | Auth | Status |
|---|--------|---------|---------|---------|------|--------|
| 59 | `/about.php` | `about.php` | About | プロジェクトミッション、30by30/TNFD LEAP | ○ | ✅ |
| 60 | `/pricing.php` | `pricing.php` | 料金 | Community（無料）/ Business（¥298k/年） | ○ | ✅ |
| 61 | `/guidelines.php` | `guidelines.php` | ガイドライン | コミュニティルール、モデレーション方針 | ○ | ✅ |
| 62 | `/terms.php` | `terms.php` | 利用規約 | データライセンス（CC BY）、制限事項 | ○ | ✅ |
| 63 | `/privacy.php` | `privacy.php` | プライバシー | 位置情報マスキング、データ取扱い | ○ | ✅ |
| 64 | `/offline.php` | `offline.php` | オフライン | PWAフォールバック、Service Workerエラー | ○ | ✅ |
| 65 | `/updates.php` | `updates.php` | 更新情報 | バージョン履歴、機能アナウンス | ○ | ✅ |
| 66 | `/team.php` | `team.php` | チーム | メンバープロフィール | ○ | ✅ |
| 67 | `/faq.php` | `faq.php` | FAQ | よくある質問 | ○ | ✅ |
| 68 | `/403.php` | `403.php` | 403エラー | アクセス拒否 | ○ | ✅ |
| 69 | `/404.php` | `404.php` | 404エラー | ページ未発見 | ○ | ✅ |
| 70 | `/sitemap.php` | `sitemap.php` | XMLサイトマップ | 静的ページ・種ページ・観察詳細の動的サイトマップ出力 | ○ | ✅ |

## 11. ガイド記事（guide/）

> SEO・生態学教育・企業向けコンテンツマーケ。全ページ公開。

| # | ルート | ファイル | ページ名 | 機能概要 | Auth | Status |
|---|--------|---------|---------|---------|------|--------|
| 71 | `/guide/nature-positive.php` | `guide/nature-positive.php` | ネイチャーポジティブ完全ガイド | 自然再興とお散歩観察健康の三位一体解説 | ○ | ✅ |
| 72 | `/guide/what-is-nature-positive.php` | `guide/what-is-nature-positive.php` | ネイチャーポジティブとは | 30by30・昆明モントリオール目標の入門解説 | ○ | ✅ |
| 73 | `/guide/steps-dementia-prevention.php` | `guide/steps-dementia-prevention.php` | 歩数と認知症予防ガイド | 9,800歩で51%減・JAMA研究に基づく科学記事 | ○ | ✅ |
| 74 | `/guide/walking-brain-science.php` | `guide/walking-brain-science.php` | お散歩と脳科学 | 自然歩行が脳・ストレスに与える5メカニズム | ○ | ✅ |
| 75 | `/guide/species-id-brain-training.php` | `guide/species-id-brain-training.php` | 種同定と脳トレ | 生きもの同定がワーキングメモリを鍛える科学根拠 | ○ | ✅ |
| 76 | `/guide/nature-coexistence-sites-analysis.php` | `guide/nature-coexistence-sites-analysis.php` | 自然共生サイト全件分析 | OECM全420+認定サイトのデータ分析 | ○ | ✅ |
| 77 | `/guide/corporate-walking-program.php` | `guide/corporate-walking-program.php` | 企業向けお散歩プログラム | 経団連334社データ・企業導入5理由の解説 | ○ | ✅ |
| 78 | `/guide/aikan-renri-report.php` | `guide/aikan-renri-report.php` | 愛管連理の木事例記事 | 中小企業の自然共生サイト認定取得全記録 | ○ | ✅ |

## 12. デモ（demo/）

| # | ルート | ファイル | ページ名 | 機能概要 | Auth | Status |
|---|--------|---------|---------|---------|------|--------|
| 79 | `/demo/` | `demo/index.php` | B2Bデモランディング | 愛管実データでikimon法人機能を体験するデモ入口 | ○ | ✅ |
| 80 | `/demo/report.php` | `demo/report.php` | デモレポートラッパー | ikan_hqの匿名化レポートをデモバナー付きで表示 | ○ | ✅ |

## 13. 管理画面（admin/）

> `Auth::requireRole('Admin')` または `Auth::requireRole('Analyst')` で強制ブロック。

| # | ルート | ファイル | ページ名 | 機能概要 | Auth | Status |
|---|--------|---------|---------|---------|------|--------|
| 81 | `/admin/` | `admin/index.php` | 管理画面トップ | 観察数・ユーザー数・フラグ数のシステム概要 | ● | ✅ |
| 82 | `/admin/users.php` | `admin/users.php` | ユーザー管理 | ロール変更・BAN管理（Admin専用） | ● | ✅ |
| 83 | `/admin/observations.php` | `admin/observations.php` | 観察管理 | 全観察記録のステータス・フィルタ・ページング | ● | ✅ |
| 84 | `/admin/moderation.php` | `admin/moderation.php` | モデレーション | 通報管理・コンテンツ非表示・ShadowBan一覧 | ● | ✅ |
| 85 | `/admin/verification.php` | `admin/verification.php` | Speed-ID検証キュー | 専門家向けカード型スワイプ同定インターフェース | ● | ✅ |
| 86 | `/admin/distill_review.php` | `admin/distill_review.php` | 論文蒸留レビュー | Gemini抽出の生態制約・同定キーの承認・却下UI | ● | 🚧 |
| 87 | `/admin/corporate.php` | `admin/corporate.php` | TNFD法人レポートポータル | 企業向けTNFD LEAP対応インパクトレポート | ● | 🚧 |

## 14. モデレーション & 管理補助

| # | ルート | ファイル | ページ名 | 機能概要 | Auth | Status |
|---|--------|---------|---------|---------|------|--------|
| 88 | `/review_queue.php` | `review_queue.php` | Freetextレビューキュー | 自由入力種名の確認・承認・却下UI（管理者専用） | ● | ✅ |
| 89 | `/generate_grant_report.php` | `generate_grant_report.php` | グラント用レポート生成 | イベント主催者・管理者向け助成金申請用レポート | ● | ✅ |
| 90 | `/admin_dashboard.php` | `admin_dashboard.php` | 管理ダッシュボード（旧版） | フラグ通報管理・ユーザー管理の旧版管理画面 | ● | 🚧 |

---

## API エンドポイント一覧（99件）

> `[DEV]` タグ付きは開発・診断用途。本番公開時はアクセス制限推奨。

### 観察 & データ（9件）

| メソッド | エンドポイント | 機能 |
|---------|--------------|------|
| POST | `/api/post_observation.php` | 観察投稿（写真+位置+メタデータ） |
| GET | `/api/get_observations.php` | 観察取得（フィルタ・ページネーション） |
| GET | `/api/get_last_observation.php` | 最新観察取得 |
| POST | `/api/export_observations.php` | CSV出力 |
| POST | `/api/export_dwc.php` | Darwin Core形式出力 |
| POST | `/api/save_snapshot.php` | スナップショット保存 |
| POST | `/api/validate_observation.php` | 観察データバリデーション |
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

### サイト & レポート（13件）

| メソッド | エンドポイント | 機能 |
|---------|--------------|------|
| GET | `/api/list_sites.php` | サイト一覧 |
| GET | `/api/get_site_geojson.php` | GeoJSON境界取得 |
| GET | `/api/get_site_stats.php` | サイト統計 |
| POST | `/api/save_site.php` | サイト作成/更新 |
| POST | `/api/create_field.php` | モニタリングフィールド作成 |
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

### ゲーミフィケーション（7件）

| メソッド | エンドポイント | 機能 |
|---------|--------------|------|
| GET | `/api/get_showcase_data.php` | ダッシュボードメトリクス |
| GET | `/api/get_time_capsule.php` | タイムカプセル |
| GET | `/api/get_ghost_data.php` | ゴースト通知（個別） |
| GET | `/api/get_ghosts.php` | ゴーストデータ一覧 |
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

### エクスポート & 調査（9件）

| メソッド | エンドポイント | 機能 |
|---------|--------------|------|
| POST | `/api/export_dwca.php` | Darwin Core Archive |
| POST | `/api/export_portfolio_dwca.php` | ポートフォリオDwCA出力 |
| POST | `/api/survey.php` | 調査回答 |
| POST | `/api/export_surveys_dwc.php` | 調査データDwC出力 |
| POST | `/api/download_proof_package.php` | 観察証拠パッケージ |
| POST | `/api/gbif_publish.php` | GBIFへのデータ公開 |
| GET | `/api/health.php` | ヘルスチェック |
| GET | `/api/verify_config.php` | 設定検証 |
| POST | `/api/csp_report.php` | CSP違反レポート |

### 検索 & ユーティリティ（4件）

| メソッド | エンドポイント | 機能 |
|---------|--------------|------|
| GET | `/api/search.php` | 汎用検索（観察・種・ユーザー横断） |
| POST | `/api/generate_report.php` | 汎用レポート生成 |
| POST | `/api/generate_bingo_template.php` | ビンゴテンプレート生成 |
| POST | `/api/generate_grant_report.php` | ※廃止予定（`/generate_grant_report.php`へ統合） |

### Omoikane API（ルートレベル）（2件）

> 通常の `/api/` ディレクトリ外に配置されている点に注意。将来的に `/api/` 配下へ移動推奨。

| メソッド | エンドポイント | 機能 |
|---------|--------------|------|
| POST | `/api_omoikane_search.php` | Omoikane種ナレッジグラフ検索 |
| GET | `/api_omoikane_status.php` | Omoikaneワーカー稼働状態確認 |

### v2 API（3件）

| メソッド | エンドポイント | 機能 |
|---------|--------------|------|
| POST | `/api/v2/30by30_report.php` | 30by30進捗レポート |
| POST | `/api/v2/bio-index.php` | Bio-Index計算 |
| POST | `/api/v2/tnfd_leap_report.php` | TNFD LEAPレポート |

---

## 開発・テスト専用ファイル（本番アクセス制限推奨）

> 以下は上記カウントに含めていない開発専用ファイル。本番環境では `.htaccess` 等でアクセス制限すること。

| ファイル | 用途 |
|---------|------|
| `/api/csrf_debug.php` | CSRFトークンデバッグ |
| `/api/test_concurrency.php` | 並行処理テスト |
| `/dev_admin_login.php` | 開発用管理者強制ログイン |
| `/diag_profile.php` | プロフィール診断ツール |

---

## ナビゲーション構造

### デスクトップメニュー

```
[Logo → /]  [検索バー]  [探す ▼]  [共創する ▼]  [🔔]  [👤 ▼]
                         │                │              │
                         ├─ 探索           ├─ 未同定リスト  ├─ プロフィール
                         ├─ フィールドマップ ├─ IDセンター   ├─ サイト管理
                         ├─ いきもの図鑑    ├─ 共生サイト   ├─ ダッシュボード
                         └─ ランキング     ├─ イベント     ├─ 設定
                                          └─ 調査       └─ ログアウト
```

### モバイルボトムナビ

```
[ホーム] [探す] [＋投稿] [地図] [プロフィール]
```
