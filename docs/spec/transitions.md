# ikimon.life — 画面遷移図

> 最終更新: 2026-03-04

## 1. メインフロー（市民ユーザー）

```mermaid
graph TD
    HOME[ホーム /] --> POST[観察投稿 /post.php]
    HOME --> EXPLORE[探索 /explore.php]
    HOME --> MAP[フィールドマップ /map.php]
    HOME --> OBS_DETAIL[観察詳細 /obs/:id]
    HOME --> PROFILE[プロフィール /profile.php]

    %% 投稿フロー
    POST -->|投稿完了| OBS_DETAIL
    POST -->|ゲスト3件制限| LOGIN[ログイン /login.php]

    %% 探索フロー
    EXPLORE --> SPECIES[種ページ /species/:slug]
    EXPLORE --> OBS_DETAIL
    EXPLORE --> ZUKAN[いきもの図鑑 /zukan.php]

    %% 観察詳細から
    OBS_DETAIL --> ID_FORM[ID入力 /id_form.php]
    OBS_DETAIL --> SPECIES
    OBS_DETAIL --> PROFILE

    %% 種ページから
    SPECIES --> OBS_DETAIL
    SPECIES --> REF[参考文献 /reference_layer.php]

    %% プロフィールから
    PROFILE --> PROFILE_EDIT[プロフィール編集 /profile_edit.php]
    PROFILE --> DASHBOARD[ダッシュボード /dashboard.php]
    PROFILE --> OBS_DETAIL

    %% 認証
    LOGIN --> HOME
    LOGIN -->|OAuth| OAUTH[OAuth /oauth_login.php]
    OAUTH --> OAUTH_CB[コールバック /oauth_callback.php]
    OAUTH_CB --> HOME
```

## 2. 同定フロー

```mermaid
graph TD
    ID_CENTER[IDセンター /id_center.php] --> OBS_DETAIL[観察詳細 /obs/:id]
    OBS_DETAIL --> ID_FORM[ID入力 /id_form.php]
    OBS_DETAIL --> ID_WIZARD[IDウィザード /id_wizard.php]

    ID_WIZARD --> ID_FORM
    ID_FORM -->|同定完了| OBS_DETAIL

    ID_WORKBENCH[IDワークベンチ /id_workbench.php] --> OBS_DETAIL
    ID_WORKBENCH --> ID_FORM

    %% 図鑑との連携
    ID_WIZARD --> SPECIES[種ページ /species/:slug]
    ID_WIZARD --> ZUKAN[いきもの図鑑 /zukan.php]
    ZUKAN --> SPECIES
    SPECIES --> REF[参考文献 /reference_layer.php]
```

## 3. フィールドワーク & ウェルネスフロー

```mermaid
graph TD
    FIELD[フィールドリサーチ /field_research.php] -->|セッション開始| TRACKING[GPSトラッキング中]
    TRACKING -->|生きもの発見| POST[観察投稿 /post.php]
    POST --> TRACKING
    TRACKING -->|セッション終了| WALK[マイフィールド /ikimon_walk.php]

    WALK --> WELLNESS[ウェルネス /wellness.php]
    WALK --> HEATMAP[ヒートマップ /heatmap.php]

    MAP[フィールドマップ /map.php] --> FIELD
    MAP --> OBS_DETAIL[観察詳細 /obs/:id]

    COMPASS[コンパス /compass.php] --> FIELD
```

## 4. B2Bフロー（企業ユーザー）

```mermaid
graph TD
    LP_BIZ[法人LP /for-business.php] --> PRICING[料金 /pricing.php]
    LP_BIZ --> SHOWCASE[ショーケース /showcase.php]

    LOGIN[ログイン] --> SITE_DASH[サイトダッシュボード /site/:id]

    SITE_DASH --> SITE_EDIT[サイトエディタ /site_editor.php]
    SITE_DASH -->|レポート生成| REPORT_PDF[PDF出力]
    SITE_DASH -->|DwCエクスポート| DWC[Darwin Core出力]
    SITE_DASH --> HEATMAP[ヒートマップ /heatmap.php]

    SITE_EDIT -->|GeoJSON保存| SITE_DASH

    CSR[CSRショーケース /csr_showcase.php] --> SHOWCASE_EMBED[埋め込み /showcase_embed.php]
```

## 5. イベントフロー

```mermaid
graph TD
    EVENTS[イベント一覧 /events.php] --> EVENT_DETAIL[イベント詳細 /event_detail.php]
    EVENTS --> CREATE_EVENT[イベント作成 /create_event.php]

    EVENT_DETAIL -->|参加| JOIN[RSVP]
    EVENT_DETAIL --> EDIT_EVENT[イベント編集 /edit_event.php]
    EVENT_DETAIL --> SURVEY[調査参加 /survey.php]

    CREATE_EVENT -->|作成完了| EVENT_DETAIL
    EDIT_EVENT -->|更新完了| EVENT_DETAIL
```

## 6. 情報ページフロー

```mermaid
graph TD
    FOOTER[フッター] --> ABOUT[About /about.php]
    FOOTER --> PRICING[料金 /pricing.php]
    FOOTER --> TERMS[利用規約 /terms.php]
    FOOTER --> PRIVACY[プライバシー /privacy.php]
    FOOTER --> GUIDELINES[ガイドライン /guidelines.php]
    FOOTER --> FAQ[FAQ /faq.php]
    FOOTER --> UPDATES[更新情報 /updates.php]
    FOOTER --> TEAM[チーム /team.php]

    LP_CIT[市民LP /for-citizen.php] --> HOME[ホーム /]
    LP_RES[研究者LP /for-researcher.php] --> ZUKAN[図鑑 /zukan.php]
```

## 7. モバイルナビゲーション遷移

```mermaid
graph LR
    BN_HOME[🏠 ホーム] --- BN_EXPLORE[🔍 探す]
    BN_EXPLORE --- BN_POST[➕ 投稿]
    BN_POST --- BN_MAP[🗺 地図]
    BN_MAP --- BN_PROFILE[👤 プロフィール]

    BN_HOME --> HOME[/]
    BN_EXPLORE --> EXPLORE[/explore.php]
    BN_POST --> POST[/post.php]
    BN_MAP --> MAP[/map.php]
    BN_PROFILE --> PROFILE[/profile.php]
```
