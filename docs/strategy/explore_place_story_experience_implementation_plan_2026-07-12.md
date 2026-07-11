# IKIMON 探索・場所のストーリー・コース 実装計画

作成日: 2026-07-12
状態: ready for execution
対象リポジトリ: `yamaki0102/ikimon-platform`
対象ランタイム: `platform_v2/`

関連方針:

- `AGENTS.md`
- `platform_v2/src/siteMap.ts`
- `platform_v2/src/ui/guideFlow.ts`
- `platform_v2/src/routes/guideRead.ts`
- `platform_v2/src/services/mapGuideSpots.ts`
- `platform_v2/src/services/guidePrograms.ts`
- `docs/design/location_guide_stories_2026-06-08.md`
- `docs/LIVE_GUIDE_DATA_LIFECYCLE.md`
- `yamaki0102/all-projects-management/operations/ikimon_regional_memory_atlas/explore_place_story_experience_architecture_2026-07-11.md`
- `yamaki0102/all-projects-management/operations/ikimon_regional_memory_atlas/temporal_place_record_integrity_principle.md`

---

## 1. 目的

現在のIKIMONでは、性質の異なる複数の体験がすべて「ガイド」と呼ばれている。

- カメラ・自然音・位置・時間を使い、AIと移動しながら手掛かりを探す機能
- 自治体・企業・土地管理者等が確認した場所の解説
- 複数地点をつなぐ企画
- セッション終了後の成果確認
- 解放済み解説の保存一覧

このまま機能を追加すると、利用者にも運営者にも次の混乱が起きる。

- `ライブガイド` と `現地ガイド` の違いが分からない。
- `ガイド成果` が、AI探索の結果なのか、コース達成結果なのか分からない。
- `マイガイド` が、保存した場所解説なのか、参加コースなのか分からない。
- ものづくり、歴史、観光、自然などテーマが増えるほど、ガイド機能が肥大化する。
- AIによる推測と、確認済みの場所情報が同じ「解説」に見える。

本計画では、既存URL・既存データ・既存利用者の進捗を壊さず、公開名称、画面責務、ドメインモデルを段階的に分離する。

---

## 2. 最終的な公開名称

利用者には内部技術名ではなく、行動で見せる。

| 役割 | 日本語UI | 英語UI | 現行実装 |
|---|---|---|---|
| 一点をすぐ確認 | 目の前のものを見る | Lens | `/lens` |
| 移動しながらAI探索 | 歩きながら探す | Live Explore | `/guide` |
| 確認済みの場所解説 | 場所のストーリー | Place Story | `guide_stop` / unlock |
| 複数地点をめぐる企画 | コース | Experience | `guide_program` |
| セッション終了後 | ふりかえり | Recap | `/guide/outcomes` |
| 次の行動 | 次にできること | Next Step | 新規 `opportunity` |
| 保存済み解説 | 保存したストーリー | Saved Stories | `/my-guides` |

### 公開用語の原則

- 製品名・機能名としての `ガイド` は原則使わない。
- 説明文として「AIが案内する」「音声で案内する」は使用可能。
- URL、DBテーブル名、内部型名の `guide*` は、互換性のため当面維持する。
- 公開コピーの変更と内部リネームを同じPRで行わない。

---

## 3. 非破壊方針

### 必須条件

1. 既存の `/guide`、`/guide/outcomes`、`/guide-programs`、`/my-guides` は消さない。
2. `guide_unlocks` の利用者進捗を失わない。
3. `guide_programs` と `guide_program_spots` を破壊的にリネームしない。
4. `MAP_GUIDE_SPOTS` の既存IDを変更しない。
5. 旧URLから新しい画面へ到達できる状態を最低12か月維持する。
6. AI探索の一時データと、確認済みPlace Storyを同じ保存領域へ混ぜない。
7. 本番データを用いたbackfillは、件数比較・dry run・再実行可能性を確認してから行う。
8. 通常実装では `upload_package/` を変更しない。

### 移行方法

- 最初はコピーと導線だけ変更する。
- 次に、既存データを新しいドメイン名へ変換するread modelを追加する。
- DB変更はすべてadditive migrationにする。
- 新旧read pathを一定期間併存させ、件数・内容のparityを確認する。
- 旧カラムや旧テーブルの削除は本計画の範囲外とする。

---

## 4. 目標となる利用体験

### 4.1 カメラ入口

```text
何をしますか？

[目の前のものを見る]
一つの対象を撮り、候補と見分ける手掛かりを見る

[歩きながら探す]
周囲の変化をAIと一緒に見つける
```

ここでは `Lens` と `Live Explore` の違いだけを伝える。機能説明を長く並べない。

### 4.2 地図・場所ページ

```text
この場所を知る          → 場所のストーリー
この場所で記録する      → Record
近くを歩きながら探す    → Live Explore
この場所を含むコース    → Experience
```

全ボタンを常時表示せず、存在するコンテンツと利用可能条件に応じて最大3つ程度に絞る。

### 4.3 Live Explore

開始時の標準状態:

- カメラON
- 音声OFF
- 徒歩
- 目的・カテゴリは入口のPlace、Experience、theme packから自動設定

主CTA:

> 歩きながら探す

音声、移動方法、詳細設定は開始後に変更できる。自由探索で文脈がない場合のみ、最小限の目的選択を表示する。

### 4.4 Recap

終了時は独立したダッシュボードへ迷わせず、同じ流れの出口として表示する。

```text
今日見つけたこと
まだ確かでないこと
次にできること
```

主CTAは一つにする。

- 記録として残す
- 次の場所を見る
- 体験を予約する
- 学べる場所を見る

のいずれかを文脈に応じて出す。

### 4.5 Place Story

Place Storyは、AIがその場で生成する説明ではない。

- 出典
- 承認主体
- 内容の版
- 対象年代
- 言語
- 公開期間
- 現地再生条件

を持つ確認済みコンテンツとして扱う。

一つのPlaceに、複数のStoryを持てるようにする。

例:

- 現在ここで作られている製品と技能
- 1970年代にここにあった工場
- 地域の自然環境
- 地域住民の証言
- 日本語版、英語版

### 4.6 Experience

Experienceは複数のPlace StoryやStopをまとめる器とする。

- 順番あり / どこからでも
- 開催期間
- 利用可能時間
- 安全・承諾条件
- 必須Stop / 任意Stop
- 次にできること

を持つ。

ランキングや場所の奪い合いを主軸にしない。

---

## 5. 実装フェーズ

大きな一括PRにしない。各フェーズは、原則1〜2目的の小さなPRに分ける。

---

## Phase 0: 現状固定と回帰基準

目的: 変更前の公開コピー、URL、データ件数、主要画面を固定する。

### 実装項目

- [ ] `guide` 関連の公開文字列を全件抽出する。
- [ ] `platform_v2/src/content/`、`siteMap.ts`、`guideFlow.ts`、`guideRead.ts`、`mapGuideSpots.ts` の直接文字列を棚卸しする。
- [ ] `/guide`、`/guide/outcomes`、`/guide-programs`、`/guide-programs/:slug`、`/my-guides`、`/map` のbaseline screenshotを保存する。
- [ ] ログインなし、ログインあり、解放済み0件、解放済みありの状態を固定する。
- [ ] `guide_programs`、`guide_program_spots`、`guide_unlocks` の件数取得手順をrunbook化する。
- [ ] 既存analytics event名を棚卸しし、名称変更後も時系列比較できる対応表を作る。
- [ ] 公開用語guardの対象語と許容箇所を決める。

### 追加候補

- `platform_v2/src/scripts/checkExploreSurfaceTerms.ts`
- `platform_v2/src/scripts/reportGuideMigrationBaseline.ts`
- `platform_v2/docs/operations/guide_to_explore_baseline.md`

### 完了条件

- 変更前後で比較できるスクリーンショット、件数、主要レスポンスが揃っている。
- 本番データを書き換えずにbaselineを取得できる。
- Actionsを使わなくてもローカルで同じ確認を再実行できる。

---

## Phase 1: 公開名称と情報設計の分離

目的: URLとデータを変えず、利用者が機能の違いを理解できる状態にする。

### 主な変更対象

- `platform_v2/src/siteMap.ts`
- `platform_v2/src/ui/guideFlow.ts`
- `platform_v2/src/routes/guideRead.ts`
- `platform_v2/src/ui/siteShell.ts`
- `platform_v2/src/content/short/ja/public.json`
- `platform_v2/src/content/short/en/public.json`
- shared shell copy
- 関連route tests / public copy tests

### 公開表示変更

- [ ] `/guide`: `ライブガイド` → `歩きながら探す`
- [ ] `/guide/outcomes`: `ガイド成果` → `探索のふりかえり`
- [ ] `/guide-programs`: `ガイドリレー企画` → `コース`
- [ ] `/my-guides`: `マイガイド` / `解放した現地ガイド` → `保存したストーリー`
- [ ] `guide_stop`: `現地ガイド` → `場所のストーリー`
- [ ] CTA `ガイドを開く` → `歩きながら探す`
- [ ] `ガイド成果を見る` → `ふりかえりを見る`
- [ ] `次に解放しやすいガイド` → `次に見つけられるストーリー`

### 実装原則

- 公開ラベルはcontent layerへ集約し、route内への日本語直書きを減らす。
- `activeNav: "guide"`、内部アイコンkey `guide` は当面維持する。
- HTML title、OG、構造化データ、aria-labelも同時に更新する。
- API field名は変更しない。

### 用語guard

次の語が公開面へ新規に出ないことをテストする。

- `ガイド成果`
- `マイガイド`
- `ガイドリレー企画`
- 機能名としての `ライブガイド`

許容するもの:

- 過去ドキュメント
- compatibility aliasの説明
- 管理画面の内部識別子
- 「音声で案内します」のような一般説明

### 完了条件

- 旧URLがすべて200または従来どおりの認証レスポンスを返す。
- 既存のguide unlock数が変化しない。
- 主要画面で同一視認範囲に複数種類の「ガイド」が並ばない。
- 日本語・英語の意味が対応している。

---

## Phase 2: Live Explore開始体験の簡素化

目的: 現行基盤を残しながら、開始前の選択過多を解消する。

### 現状課題

現行開始画面には、ミッション、カメラON/OFF、音声ON/OFF、移動モード、カテゴリ等があり、柔軟だが初回利用者の判断負荷が高い。

### 実装項目

- [ ] 標準presetを `camera:on / audio:off / mode:walk` にする。
- [ ] 主CTAを `歩きながら探す` 一つにする。
- [ ] 音声・移動モード・詳細設定を折りたたみ設定へ移す。
- [ ] 位置、カメラ、マイクの許可は、必要になる直前に個別要求する。
- [ ] 音声は開始後でもONにできる。
- [ ] 乗り物モードを通常開始画面から外す。
- [ ] Place / Experience / theme packから探索文脈を受け取る。
- [ ] 自由探索時だけ、簡単な目的選択を出す。
- [ ] 一度に表示するAIヒントを一つに絞る。
- [ ] AI出力に `AIの手掛かり` ラベルを付ける。
- [ ] 終了操作後、自動でRecapを表示する。

### 推奨context contract

既存URLを維持しつつ、query parameterまたはsession stateで受け取る。

```text
/guide?source=place&placeId=...
/guide?source=experience&experienceId=...
/guide?source=free&theme=making_work
```

内部型例:

```ts
type ExplorationEntryContext = {
  source: "place" | "experience" | "record" | "free";
  placeId?: string;
  experienceId?: string;
  theme?: string;
  suggestedMode?: "walk" | "stationary" | "audio_only";
};
```

### 安全条件

- 音声は初期OFFを維持する。
- 人の声らしい音を保存候補から外す既存処理を維持する。
- 元映像の無制限保存を行わない。
- カメラ拒否時の写真選択fallbackを維持する。
- 運転者利用を促さない。
- オフラインqueueを壊さない。

### 完了条件

- 初回利用者が、設定を開かず1アクションで開始できる。
- カメラ拒否、位置拒否、マイク拒否でも行き止まりにならない。
- context付き起動時に、利用者がカテゴリを再選択しなくても適切な探索が始まる。
- 終了後に、記録またはNext Stepへ自然に進める。

---

## Phase 3: Place Story / Experience read model

目的: DBをまだ変えず、既存のGuideデータを新しい責務で表示する。

### 新規domain read model

候補ファイル:

- `platform_v2/src/services/placeStories.ts`
- `platform_v2/src/services/experiences.ts`
- `platform_v2/src/services/explorationRecap.ts`

### Place Story

既存 `MapGuideSpot` から次を変換する。

```ts
type PlaceStory = {
  storyId: string;
  placeRef: { type: "guide_area" | "observation_field" | "coordinates"; id?: string };
  title: string;
  summary: string;
  body: string;
  storyPoints: string[];
  language: string;
  subjectPeriod?: { from?: string; to?: string; precision?: string };
  sources: Array<{ label: string; url: string }>;
  approval: {
    state: "public_source" | "owner_verified" | "editor_verified";
    verifiedBy?: string;
    contentVersion?: string;
  };
  access: {
    triggerType: "gps" | "qr" | "nfc" | "manual";
    publicLocationMode: "exact" | "area" | "hidden";
    availableTimePolicy: string;
  };
};
```

### Experience

既存 `guide_programs` と `guide_program_spots` から変換する。

```ts
type Experience = {
  experienceId: string;
  slug: string;
  title: string;
  summary?: string;
  participationMode: "any_order" | "ordered";
  status: "draft" | "published" | "paused" | "closed";
  startsAt?: string;
  endsAt?: string;
  stops: ExperienceStop[];
  progress: ExperienceProgress;
  nextStep?: NextStep;
};
```

### 画面変更

- [ ] 地図の場所sheetに `この場所を知る` を追加する。
- [ ] Story詳細に、出典、確認状態、対象年代、更新日を表示する。
- [ ] `/guide-programs` の表示責務をExperience一覧として整理する。
- [ ] `/my-guides` をSaved Stories一覧として整理する。
- [ ] 参加コース履歴と保存Storyを同じ一覧に混ぜない。
- [ ] AIの手掛かりとPlace Storyを見た目・ラベル・DOM attributeで区別する。

### 互換性

- APIの既存responseは維持する。
- 新しいread modelはserver-side adapterとして導入する。
- 必要な場合は新API versionを追加し、既存APIを破壊しない。

### 完了条件

- 既存guide spotと新Place Storyの件数が一致する。
- 既存guide programと新Experienceの件数・Stop順が一致する。
- 利用者のunlock済みStoryが欠落しない。
- Storyには最低1つのsourceまたはowner verificationが必要。

---

## Phase 4: ルート別導線の整理

目的: 全機能をトップナビへ増やさず、入口ごとに必要な選択肢だけ出す。

### 地図

- [ ] Place Storyがある場所にだけ `この場所を知る` を表示。
- [ ] Live Explore可能な場所にだけ `近くを歩きながら探す` を表示。
- [ ] Experience所属時だけ `この場所を含むコース` を表示。
- [ ] 公開位置がhiddenの対象について正確な位置を出さない。

### 記録完了

- [ ] 保存後に、関連Place StoryまたはExperienceを一つだけ提案する。
- [ ] 無関係なStoryを閲覧数目的で出さない。

### カメラ入口

- [ ] LensとLive Exploreを2択で示す。
- [ ] 既にLive Explore文脈から来た場合は選択画面を省略する。

### アカウント

- [ ] `自分の記録`
- [ ] `保存したストーリー`
- [ ] `参加したコース`

を分ける。

### 完了条件

- ナビゲーション項目の総数を増やさない。
- どの入口でも、次の主CTAは一つ。
- 旧`guide`系リンクを踏んでも、新しい公開名称と責務で表示される。

---

## Phase 5: Additive DB migration

目的: 複数年代・複数言語・複数テーマのPlace Storyと、Next Stepを永続化する。

### 重要判断

- `guide_programs` は当面そのまま使う。
- `guide_unlocks.guide_spot_id` は削除しない。
- 新しいStory IDは、既存guide spot IDを引き継げる形にする。
- 既存静的seedを一度に廃止しない。

### 新規テーブル案

#### `place_stories`

```sql
story_id TEXT PRIMARY KEY
place_ref_type TEXT NOT NULL
place_ref_id TEXT
language TEXT NOT NULL
subject_from TIMESTAMPTZ
subject_to TIMESTAMPTZ
subject_time_precision TEXT
title TEXT NOT NULL
summary TEXT
body TEXT NOT NULL
audio_asset_ref TEXT
approval_state TEXT NOT NULL
approved_by TEXT
content_version TEXT NOT NULL
status TEXT NOT NULL
source_refs JSONB NOT NULL DEFAULT '[]'
theme_tags JSONB NOT NULL DEFAULT '[]'
original_place_label TEXT
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

#### `place_story_access_points`

```sql
access_point_id UUID PRIMARY KEY
story_id TEXT REFERENCES place_stories(story_id)
trigger_type TEXT
trigger_payload JSONB
public_location_mode TEXT
subject_location_mode TEXT
available_time_policy TEXT
safety_status TEXT
landowner_consent BOOLEAN
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

#### `opportunities`

```sql
opportunity_id UUID PRIMARY KEY
opportunity_type TEXT
provider_name TEXT
title TEXT
summary TEXT
official_url TEXT
valid_from TIMESTAMPTZ
valid_to TIMESTAMPTZ
verified_at TIMESTAMPTZ
status TEXT
metadata JSONB
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

#### relation tables

- `place_story_opportunities`
- `guide_program_opportunities`

物理テーブル名として `guide_programs` を残しても、domain layerではExperienceとして扱う。

### 既存テーブルへのadditive変更案

- `guide_program_spots.story_id TEXT NULL`
- `guide_unlocks.story_id TEXT NULL`

既存 `guide_spot_id` からbackfillし、一定期間dual readする。

### migration順序

1. 新規テーブル・nullable column追加
2. 既存MAP_GUIDE_SPOTSからStory seedを生成
3. dry runで投入予定件数とsource不足を出力
4. stagingへ投入
5. parity report
6. read modelをDB優先・static fallbackへ切り替え
7. productionへ投入
8. dual read監視

### rollback

- 新規read pathをfeature flagでOFFにする。
- static `MAP_GUIDE_SPOTS` fallbackへ戻す。
- 新規テーブルは即時削除しない。
- backfillはupsertで再実行可能にする。

### 完了条件

- static seedとDB Storyの内容差分を機械出力できる。
- migration再実行で重複が発生しない。
- unlock、program progress、Story再生履歴が維持される。
- source、approval、content versionなしでpublishedにできない。

---

## Phase 6: 時間軸と場所の履歴

目的: 住所、自治体、国境、施設、企業、土地利用が変わっても、当時の記録を振り返れるようにする。

### Storyに必要な情報

- 対象年代
- 記録当時の地名
- 現在の地名
- 根拠資料
- 時間精度
- 場所精度
- 現在のStoryとの関係

### UI

通常画面は現在情報を優先する。

```text
現在
職業訓練施設

この場所の過去
1975–2001年: 金属加工工場

記録当時の地名
○○郡△△町
```

`この場所の過去を見る` を押した時だけ、年代別Storyを展開する。

### 実装項目

- [ ] 1つのPlaceに複数Storyを紐づける。
- [ ] Storyの対象年代と確度を表示する。
- [ ] 原地名を現在地名で上書きしない。
- [ ] 企業移転と土地用途変更を別の関係として扱う。
- [ ] 位置・年代が推定の場合、UIでも推定と表示する。
- [ ] 係争地域は単一の政治的正解へ上書きしない。

### 完了条件

- 現在の住所変更後も、旧住所で記録を検索できる。
- 同じ場所の現在Storyと過去Storyを切り替えられる。
- 原記録と後から追加した解釈を区別できる。

---

## Phase 7: ものづくり地域図鑑pilot

目的: 新しい構造が特定テーマ専用ではなく、実運用に耐えることを静岡県案件で検証する。

### pilot範囲

- 県内1地域
- 5〜8拠点
- 2〜3のものづくり分野
- 20〜30 Story
- 2〜3 Experience
- 各Storyに原則1つの主Opportunity

### 使用する機能

- Map
- Place Story
- Experience
- Record
- Recap
- Opportunity

Live Exploreは、屋外、展示、オープンファクトリー、撮影許可エリアだけで補助的に使う。

### 工場内

- QR
- NFC
- 番号入力
- 承認済み素材
- 撮影可能範囲

を優先する。

### 成果指標

- 初めて知った技術・仕事の数
- `次にできること` の閲覧率
- 体験・見学・学校情報への遷移率
- 体験後のRecord作成率
- 別のPlace Story・Experienceへの回遊率
- 子どもと保護者の理解度変化

### pilot完了条件

- 新しいトップナビを増やさず運用できる。
- 自然テーマとものづくりテーマが同じPlace / Story / Experience構造で動く。
- 日本固有の学校・資格制度がcore domainへ埋め込まれていない。

---

## Phase 8: 新URL aliasと内部整理

このPhaseは、P0〜P7が安定してから行う。先に実施しない。

### 新URL候補

- `/explore/live`
- `/explore/recap`
- `/experiences`
- `/saved-stories`

### 移行ルール

- 旧URLは維持する。
- 外部リンク、検索流入、analytics、アプリ内リンクを確認してからcanonicalを切り替える。
- 最初は新旧URLを同じhandlerへbindする。
- 旧URLのredirect化は、互換性監査後に別PRで行う。
- 内部型、DB名、migration名の一括リネームは行わない。

---

## 6. テスト計画

## 6.1 Unit / integration

- [ ] 公開用語guard
- [ ] Live Explore preset
- [ ] query context validation
- [ ] AI hintとverified Storyのtrust boundary
- [ ] Storyのsource / approval / version必須条件
- [ ] Story対象年代のvalidation
- [ ] ExperienceのStop順・必須Stop
- [ ] Opportunityの有効期間
- [ ] legacy guide API compatibility
- [ ] unlock parity
- [ ] static fallback

## 6.2 E2E

最低限のシナリオ:

1. カメラ入口からLensを開く
2. カメラ入口からLive Exploreを1タップで開始
3. カメラ拒否後に写真fallback
4. マイクOFFのまま探索
5. 途中で音声ON
6. オフラインqueueから同期
7. 終了後にRecap
8. RecapからRecordへ昇格
9. Map → Place Story
10. Place Story → Record
11. Place Story → Opportunity
12. Experience → Stop → progress
13. Saved Storiesでunlock済みStoryを再生
14. 旧URLから同じ体験へ到達
15. ログアウト時の認証境界

## 6.3 Visual QA

現行の `desktop-1440` と `mobile-390` だけで完了扱いにしない。

追加するviewports:

- `mobile-se2`: 375 x 667
- `mobile-390`: 390 x 844
- `mobile-large`: 430 x 932
- `tablet-768`: 768 x 1024
- `small-pc`: 1024 x 768
- `mobile-monitor`: 1280 x 720
- `desktop-1440`: 1440 x 1200
- `wide-1920`: 1920 x 1080

確認対象:

- タイトル改行
- CTAの優先順位
- 設定drawer
- カメラpreview
- Recapの3項目
- Story本文・出典
- コース進捗
- Map sheet
- 保存したストーリー
- 横スクロール
- 固定ナビとの重なり
- 56px touch target
- 日本語・英語の文字量差

スクリーンショットは圧縮して保存し、変更前後、判断、未解決事項を記録する。

## 6.4 Accessibility

- キーボードだけで開始・停止・設定変更できる。
- カメラ・マイク状態をaria-liveで伝える。
- 色だけでAI/verifiedを区別しない。
- 音声Storyにはテキストを必須にする。
- reduced motionに対応する。
- 地図なしでもStoryとコース一覧へ到達できる。

## 6.5 Performance

計測項目:

- 初期HTML応答
- Live Explore開始までの時間
- カメラpermission後のfirst hint
- Map sheet表示
- Story音声再生開始
- Recap生成
- offline queue同期

性能悪化時に、機能追加を理由に許容値を緩めない。

## 6.6 Privacy / security

- カメラ・マイクは明示許可前に起動しない。
- 人の声、顔、車両番号、工場機密への既存保護を回帰確認する。
- exact locationを公開進捗へコピーしない。
- 子どもの行動履歴を公開しない。
- Storyの承認者・出典を改ざんできない。
- 管理画面変更はaudit trailへ残す。
- Opportunity URLは許可protocolと検証済みproviderを確認する。

---

## 7. ローカルで再実行できる検証経路

GitHub Actions専用の検証を作らない。同じ処理をCodex管理PC、通常の開発PC、stagingから実行できる構成にする。

### 標準コマンド

```bash
npm --prefix platform_v2 run typecheck
npm --prefix platform_v2 run test:node
npm --prefix platform_v2 run build
```

### 追加予定script

```text
npm --prefix platform_v2 run check:explore-terms
npm --prefix platform_v2 run test:explore-domain
npm --prefix platform_v2 run e2e:local:explore-flow
npm --prefix platform_v2 run report:guide-to-story-parity
```

Windows用に、同じ処理をまとめるscriptを追加する。

```text
scripts/verify_explore_place_story.ps1
```

このscriptは以下を順に実行する。

1. typecheck
2. targeted unit tests
3. public term guard
4. migration dry runまたはschema validation
5. local E2E
6. screenshot batch
7. parity report

CIはこのscriptまたは同じnpm scriptsを再実行するだけにし、Actions内にしかない処理を作らない。

---

## 8. リリース計画

### PR分割例

1. `docs/test: freeze guide baseline`
2. `refactor(copy): separate explore story and experience terms`
3. `feat(explore): simplify live explore start`
4. `feat(recap): make recap the exploration exit`
5. `refactor(domain): add place story read model`
6. `refactor(domain): expose guide programs as experiences`
7. `feat(map): connect place story and experience actions`
8. `feat(db): persist place stories additively`
9. `feat(next-step): add opportunities`
10. `feat(history): support subject period and original place labels`
11. `feat(pilot): add making and work pilot content`
12. `chore(routes): add semantic route aliases`

### 各PRの条件

- 1つの主要目的
- migrationと大幅UI変更を同じPRにしない
- 旧URL smokeを含む
- local verification結果をPR本文へ記載
- 変更前後スクリーンショット
- rollback方法
- 未解決事項

### staging

- 新機能ブランチのcommit SHAをstagingへ反映する。
- 複数viewport screenshotを取得する。
- 実ログイン確認はユーザーの認証後に行う。
- unlock、Story再生、Experience progress、Record昇格を確認する。
- 本番データを使う場合はread-onlyまたは明示したテストデータのみ使用する。

### production

- 本番反映が依頼範囲に含まれる場合のみ進める。
- required checksを無視しない。
- deploy後はread-only smoke、旧URL、Map、Live Explore開始画面、Story表示を確認する。
- 失敗時はfeature flagまたは旧read modelへ戻す。

---

## 9. Feature flags

最低限の切り替えだけにする。細かいflagを増やしすぎない。

候補:

- `LIVE_EXPLORE_START_V1`
- `PLACE_STORY_READ_MODEL_V1`
- `OPPORTUNITY_NEXT_STEP_V1`

公開名称変更はコードrollbackで戻せるため、原則flag化しない。

---

## 10. 監視指標

### 利用体験

- Live Explore開始率
- 開始前離脱率
- 設定drawer利用率
- permission拒否後の継続率
- Recap到達率
- RecapからRecordへの遷移率
- Place Story閲覧率
- StoryからNext Stepへの遷移率
- Experience完了率

### 品質

- AI hintの訂正率
- Place Storyのsource不足件数
- Storyの期限切れOpportunity件数
- unlock parity差分
- static fallback発生数
- offline queue失敗率

### 混乱の検知

- `ガイド`、`ライブガイド`、`マイガイド` に関するhelp/search query
- 同一セッション内の行き戻り
- `/guide` と `/guide-programs` の誤遷移

---

## 11. Definition of Done

本計画は、次をすべて満たした時に完了とする。

### 概念

- [ ] Lens、Live Explore、Place Story、Experience、Recapの責務が文書・コード・UIで一致する。
- [ ] AI推測と確認済みStoryを混同しない。
- [ ] `ガイド` を公開機能名として乱用していない。

### 利用体験

- [ ] 初回利用者がLensとLive Exploreの違いを短時間で判断できる。
- [ ] Live Exploreを1アクションで開始できる。
- [ ] 終了後にRecapと次の行動が分かる。
- [ ] Place StoryとExperienceをトップナビ追加なしで利用できる。

### データ

- [ ] 既存unlockが全件維持される。
- [ ] 既存ProgramとStop順が維持される。
- [ ] Place Storyにsource、approval、versionがある。
- [ ] 過去の地名・年代を現在情報で上書きしない。
- [ ] migrationが再実行可能である。

### 互換性

- [ ] 旧URLが機能する。
- [ ] 既存API clientを破壊しない。
- [ ] static fallbackが動作する。

### QA

- [ ] unit / integration / E2Eが通る。
- [ ] 8 viewportのVisual QAが完了する。
- [ ] accessibility、privacy、offline、安全確認が完了する。
- [ ] 判断記録とスクリーンショットが保存される。

### 運用

- [ ] ローカルから同じ検証を実行できる。
- [ ] Actionsだけに依存する処理がない。
- [ ] rollback手順が確認されている。
- [ ] staging、本番smokeの責任範囲が明確である。

---

## 12. 優先順位

### P0

- baseline固定
- 公開名称整理
- Live Explore開始体験簡素化
- Recapの出口化
- AI / verified trust boundary

### P1

- Place Story read model
- Experience read model
- Map / Record / Account導線整理
- Visual QA viewport拡張

### P2

- Place Story永続化
- Opportunity
- 複数年代Story
- ものづくりpilot

### P3

- semantic URL alias
- 内部命名整理
- static seed依存の縮小

---

## 13. 最初に着手するPR

最初のPRではDBを触らない。

対象:

1. baselineと用語guard
2. 公開名称の変更
3. route/page title/aria/metadataの整合
4. 旧URL smoke
5. 8 viewportのうち、まず変更対象画面のSE2・390・768・1280・1440・1920 screenshot

このPRで利用者の混乱を減らし、その後のLive Explore簡素化とdomain分離を安全に進める。
