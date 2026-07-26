# UTSUROU実装実施計画

- 作成日: 2026-07-26
- 状態: source implementation approved / staging・production未承認
- 戦略正本: `yamaki0102/ikimon-business-strategy@3b935b2a6021965ff109ca29b4b5b7e3df8780b4`
- 実装基準: `yamaki0102/ikimon-platform@298bfa16b378fc73dcf874dd036d2df947035298`
- 横断運用基準: `yamaki0102/all-projects-management@aa310c56685a6895d0543be32c62350f0aa42a4b`
- 関連: #1444、#1296、#1365、#1421、PR #1445

## 1. 実装判断

`UTSUROU／うつろう` は新規アプリとして作らない。

現行mainの撮影、保存、本人詳細、AI、公開安全、Place Atlas、Home、自分ページを再利用し、次の順で不足だけを埋める。

1. 既存撮影P0の統合証拠
2. Place時間軸のdomain contract
3. Place Atlasへの時間軸UI統合
4. 磐田市公開データのsource-only接続
5. 修正候補・確認結果の一周
6. provisionalブランド表示
7. 3分デモと利用者テスト
8. exact SHA staging
9. production候補判定

## 2. 語彙契約

常設ナビと主操作は現行の理解を優先する。

| Surface | Copy |
|---|---|
| ブランド | `UTSUROU／うつろう` |
| タグライン | `まちは、うつろう。だから、うつす。` |
| 常設ナビ | `撮る｜場所｜記録｜自分` |
| 主操作 | `撮る`、`写真を撮る` |
| カメラ見出し | `今日のまちを、うつす` |
| 保存完了 | `記録できました` |
| Place時間軸 | `この場所のうつろい` |
| 再記録CTA | `今を撮る`、`もう一度撮る` |

`うつす`を全ボタン、URL、API、storage key、analytics keyへ置換しない。

## 3. 現行実装の再利用台帳

| 能力 | current main | 本計画での扱い |
|---|---|---|
| 共通カメラ | 実装済み | 再利用、再設計しない |
| 端末画像選択 | 実装済み | カメラと明示分離を維持 |
| Record保存 | 実装済み | P0 E2Eで証明 |
| 保存後本人詳細 | #1442/#1443 | 再利用 |
| AI状態・再確認 | #1442 | failure→retry→success証拠を追加 |
| Home／自分 | #1435〜#1440 | 再々設計しない |
| Place Atlas | #1427〜#1437 | domain・privacy・UIを再利用 |
| historic Record reuse | #1434 | Place時間軸の入力候補 |
| Place所属 | #1429等 | 既存membershipを使用 |
| facility policy | Place Atlas | `今を撮る`の表示条件に使用 |
| runtime identity | 未確定 | source完成とrelease判断を分離 |

## 4. Work package

## WP0: 文書正本化

### 成果物

- 本ファイル
- `SPEC.md`、`ISSUE_MAP.md`、3分デモとの整合
- 横断台帳への実行順記録

### 完了条件

- source、staging、productionの状態を混同しない
- ブランド語と操作語の使い分けが一意
- DB・runtime変更なし

## WP1: 撮影P0 closeout

### Flow

`撮る → 保存 → 本人詳細 → AI候補 → 編集／再確認 → 公開安全 → Place所属 → 見返す`

### 必須証拠

- camera granted / denied / unavailable
- explicit gallery selection
- all photo save complete marker
- partial photo failure and retry
- duplicate submit prevention
- AI queued / processing / candidate / completed / retryable failure / unavailable
- owner-only processing state
- owner edit
- private / limited / public
- exact location not public
- Place membership and public projection
- back / cancel / reload

### Release status

source test greenでも`P0_SOURCE_GREEN`に留める。exact SHA staging E2Eが揃うまで`P0_RUNTIME_GREEN`としない。

## WP2: Place timeline pure domain

### 新規source

`platform_v2/src/services/placeTimeline.ts`

`platform_v2/src/services/placeTimeline.test.ts`

### Input contract

各入力Recordは最低限次を持つ。

- stable `recordId`
- `observedAt`
- `publicEligible`
- optional display label
- optional public media URL
- optional source label
- optional verification state

Inputにexact latitude、longitude、owner identityを定義しない。

### Output state

- `empty`: 公開適格Recordなし
- `single_period`: 一つの観察期間だけ
- `timeline`: 二つ以上の観察期間

### Invariants

- `publicEligible !== true`は除外
- 空・不正Record IDは除外
- invalid dateは除外
- Record IDを重複排除
- 同じRecord IDは決定論的に一件だけ
- 日付昇順で整列
- 1時点では変化を示さない
- 2時点以上でも変化を確定しない
- 最近のRecordがない場合だけ再記録提案可能
- 同じ入力から同じ出力

### Test matrix

1. empty
2. private only
3. invalid dates
4. duplicate Record ID
5. one valid date
6. two distinct dates
7. same-day multiple Records
8. order independence
9. future date handling
10. stale record revisit suggestion
11. recent record no suggestion
12. no exact location / owner fields in type

## WP3: Place Atlas UI integration

### Integration point

既存`PlaceAtlasProfile.recentRecords`または公開適格Record projectionからtimeline inputを構築する。

### UI

- section title: `この場所のうつろい`
- oldest to newest
- date, source, verification
- photo absent state
- `別の時期の記録があります`
- `今を撮る`
- no automatic change claim

### Safety

- public profile gateを通過したRecordだけ
- sensitive / restricted / rights不足 / withdrawnを除外
- contribution CTAはexisting facility policyを再利用
- owner・exact coordinateを投影しない

### QA

375 / 390 / 768 / 1024 / 1280 / 1536、Chromium / WebKit / Firefox。mobile bottom sheetとdesktop panelの意味を一致させる。

## WP4: 磐田公開データ source-only

### Initial source families

- 文化財
- 観光施設
- 公共施設
- 公園
- 交流センター

### Source-only deliverables

- source inventory
- license / reuse classification
- parser / importer
- fixture
- normalized Place candidate
- dry-run report
- missing / duplicate / name variance / coordinate gap report

### Boundary

staging D1 apply、migration、seedは別承認。市公式・共同開発・後援と表示しない。

## WP5: Correction loop

### Minimal states

`gap_detected → evidence_added → human_reviewed → correction_proposed → accepted | held | rejected → published`

### First candidate types

- name / reading variance
- current photo missing
- address / location gap
- source freshness
- rename / relocation possibility

### Gate

未確認情報を公開確定へ流さない。IKIMON内部一周と、磐田市への正式還流を別指標にする。

## WP6: provisional brand preview

### Surfaces

- public Top
- signed-in Home
- header/logo
- camera sheet
- record detail
- map/search
- Place profile
- records/self

### Boundary

feature flagまたはpreview routeを優先する。`ikimon.life`、repository、package、API、DB、authを改名しない。

## WP7: Demo and validation

### 3-minute path

`見付のPlace検索 → 出所・過去記録 → 現地撮影 → 保存・AI・公開 → Place timeline → correction proposal → review state`

### User groups

- 市民
- 高校生
- 行政職員
- 教育・地域団体

### Metrics

- reading / spelling reproduction
- photo + place + time understanding
- capture action understanding
- non-SNS understanding
- record result understanding
- administrative understanding of history retention

## 5. PR sequence

| PR | Scope | Merge prerequisite | Deploy |
|---|---|---|---|
| A | docs closeout / PR #1445 | strategy main | none |
| B | timeline domain + tests | A merged | none |
| C | timeline UI + browser tests | B merged | none |
| D | Iwata importer + dry-run | source / rights confirmed | none |
| E | correction loop source | data contract confirmed | none or additive proposal |
| F | brand preview | C〜E source green | staging later |
| G | release closeout | exact SHA green | explicit gates |

各PRは短命branch、squash merge、exact head SHAを使用する。

## 6. Status vocabulary

- `PLAN_CANONICAL`: 計画がmainへmerge済み
- `P0_SOURCE_GREEN`: source testsがgreen
- `TIMELINE_DOMAIN_GREEN`: timeline pure domainがgreen
- `TIMELINE_UI_GREEN`: UI / browser source testsがgreen
- `IWATA_SOURCE_GREEN`: importer dry-runがgreen
- `CORRECTION_LOOP_SOURCE_GREEN`: sourceで一周
- `BRAND_PREVIEW_SOURCE_GREEN`: preview source完成
- `STAGING_VERIFIED`: exact SHA terminal evidence
- `PRODUCTION_CANDIDATE`: 全gate通過、未deploy
- `PRODUCTION_VERIFIED`: 明示承認後のexact SHA確認

## 7. production候補ゲート

次を全て要求する。

- current source、staging、production identityの分離
- P0 runtime E2E
- timeline with distinct observation periods
- no automatic change claim
- same Place recapture
- Iwata thin citywide data and Mitsuke/cultural heritage deep example
- one correction proposal
- no city partnership misrepresentation
- Android physical device
- 4 locales
- rollback identity
- trademark / adjacent-name blockerなし
- explicit production approval

## 8. 最初の実装開始条件

PR #1445がmainへmergeされ、戦略正本のrefを参照できた時点でWP2を開始する。

最初のPRでは次だけを行う。

- `placeTimeline.ts`
- `placeTimeline.test.ts`
- source-only
- no UI
- no DB
- no runtime mutation
- no brand production display
