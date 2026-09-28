# Map Place Atlas Profile Specification

Status: MVP implemented; release gates pending
Contract version: `place_atlas_profile/v1`
Baseline: `2a93c8983e2c836b847730bd77f9ff964c0404a0`
Issue: [#1418](https://github.com/yamaki0102/ikimon-platform/issues/1418)

## ZUKAN-GLOBAL-PLACE-04 bounded job

- **Main action:** 地域または場所を探し、同じ探索範囲の地図と一覧から、公開記録・場所の図鑑・開催情報へ進む。
- **Visible problem:** 地図の表示範囲とfilterは復元できても、選択したfield / OSM areaはURLに残らず、詳細から戻った再読込時に場所の選択が失われる。
- **Intended improvement:** 公開可能な安定Place参照だけを探索URLへ保存し、PC / tablet / mobileの既存地図・一覧・panel構成を保ったまま選択を復元する。

Surface classification: **product UI**. Marketing landing page、管理dashboard、地図だけの別製品にはしない。

## Acceptance A01–A24

These identifiers are the implementation acceptance checklist for `ZUKAN-GLOBAL-PLACE-04`. The older offline
prototype checks remain design evidence only; source tests and rendered browser checks are required separately.

| ID | Observable acceptance |
|---|---|
| A01 | `場所`を選ぶと場所検索が主行動として分かる。 |
| A02 | 検索は地域名・場所名を受け、2文字未満では外部検索を開始しない。 |
| A03 | device location is requested only after an explicit current-location action. |
| A04 | 検索結果は現在範囲とその他を区別し、場所種別・地域・確認状態を偽らない。 |
| A05 | 地図と一覧は同じviewport、filter、公開Record集合を使う。 |
| A06 | map failureでも公開記録一覧への導線が残る。 |
| A07 | 0件と読込失敗を別状態として表示し、再試行または条件変更ができる。 |
| A08 | field / OSM area / public cellを同じPlace Atlas閲覧責務で扱う。 |
| A09 | 選択場所はdesktopのside panel、mobile / tabletのbottom sheetに同じ情報順で現れる。 |
| A10 | 場所名、地域、安全に公開できる件数・期間を内部IDより先に表示する。 |
| A11 | 公開RecordはRecord ID単位で重複せず、unknownを0件と表示しない。 |
| A12 | 場所の図鑑から公開Record詳細へ進める。 |
| A13 | 場所に根拠付きで関連する開催情報だけを表示し、将来profileを利用可能に見せない。 |
| A14 | 開催情報への導線は参加者向けで、主催操作と混在しない。 |
| A15 | Place Atlas failureは地図と一覧を壊さず、選択場所だけ再試行できる。 |
| A16 | exact coordinate、private / hidden Record、sensitive locationを探索状態へ保存しない。 |
| A17 | URLへ保存する場所選択はvalidated field IDまたは`osm:way|relation:id`だけとする。 |
| A18 | viewport、zoom、filter、overlay、公開cell、選択Placeを一つの探索URLへ保存する。 |
| A19 | Record / Place Atlas / Programへ進んでbrowser backした時、同じviewportとfilterを復元する。 |
| A20 | 再読込後もURL内の選択Placeが現在取得できる場合はpanel / sheetを再度開く。 |
| A21 | malformed、座標形式、unsupported OSM typeのPlace参照は無視して安全に地図を開く。 |
| A22 | 遅い旧responseは現在の検索・Record・Place Atlas選択を上書きしない。 |
| A23 | 320 / 375、768、1280 / 1440pxで横overflow、fixed navigationとの重なり、44px未満の主要操作を残さない。 |
| A24 | keyboard focus、accessible name、live loading/error、reduced motionを維持し、fixtureと実runtime evidenceを区別する。 |

### Implementation evidence boundary

- `mapExplorerState.ts` owns bounded URL serialization and validation; it never serializes raw Place coordinates.
- `mapExplorer.ts` owns selection restoration only after the current viewport's area collection has loaded. A
  reference that is valid but absent from that collection is left unopened rather than synthesized.
- `mapPlaceAtlasProfile.ts` continues to own the shared Place Atlas state renderer. Navigation to Records and
  Programs remains ordinary links, so browser history owns return navigation; the map URL owns recoverable state.
- Unit tests prove reference validation and Node/browser-runtime parity. Focused Playwright must prove the rendered
  PC / tablet / mobile journey; its fixture result is not staging or production proof.
## 背景

現行の `/ja/map` は、公開セルの写真付き記録、登録済みfieldの
`area-snapshot`、transient OSM areaのclient-side gallery、Place Memory、
Guide Stop、Site Briefを別々に読む。地図は場所を探す入口として機能している一方、
場所を選んだ後に「その場所で何が見えているか」を一つの閲覧単位で理解できない。

今回の中心価値は、地図へ情報を詰め込むことではない。選択した場所について、
公開できるRecord、場所情報、ガイド、思い出、活動を束ねる
`PlaceAtlasProfile` Read Modelを遅延取得し、地域の図鑑として読む体験を作る。

## 現行問題

1. 登録済みfieldは `area-snapshot`、transient OSM areaは現在viewport内の
   client-side recordsを使い、同じ場所選択でも集計範囲が異なる。
2. `area-snapshot.observationSummary.totalObservations` はOccurrence中心で、
   UI上の「記録件数」と一致しない場合がある。
3. transient OSM areaはgalleryに写真があってもsummaryへ0を渡す経路があり、
   「写真があるのに記録がありません」という矛盾を作り得る。
4. エリア選択後のfetchにselection sequence guardとAbortControllerがなく、
   先に選んだ場所の遅いresponseが現在の選択を上書きし得る。
5. Place Memory、Guide Stop、Site Brief、field public profileが
   場所単位の一つの公開contractへ統合されていない。
6. `mapExplorer.ts` に選択、取得、集計、描画の責務が集中している。
7. 本番Cloudflare WorkerはNode APIをproxyせず、D1/R2 read modelを直接読む。
   Nodeだけの変更では本番contractが成立しない。

常磐公園のQA開始地点では、登録済みfield
`d50678d0-ba57-4d3d-a713-2fe441d646ab`、
`entityKey=osm:way:125727939` が選択される。公開地図の同一公開セルには
複数の写真付きRecordがある一方、既存field read modelはsource record統計未接続のため
集約を抑制している。この差が現行矛盾の代表例である。

## 用語

- Record: 人が残した写真、動画、音声、時間、場所、コメント等の投稿単位。
- Observation: Record内で独立した観察対象。
- Identification: Observationに対する名前・分類の主張。
- Occurrence: 人の確認、権利、位置、品質を通過した科学利用向け派生投影。
- Environment assessment: 写真、場所、気象、地形等から得る環境の観測・推定。
- Place atlas profile: 複数Recordと場所情報を束ねる閲覧用Read Model。
- Public cell derived: exact area membershipを断定せず、既に公開済みの
  ぼかしセルを場所周辺の閲覧単位として使う派生集約。

風景、施設、イベント、歴史資料、音、空の写真を偽のOccurrenceへ変換しない。
AI候補だけを確認済みの生きものまたは確認種数として扱わない。

## 責務分離

| 層 | 責務 |
|---|---|
| `placeAtlasContract.ts` | 参照validation、Record/media dedupe、facet、highlight、suppressionを決定論的に構築 |
| `placeAtlasProfile.ts` | Node/PostgreSQL・public map adapterからcontract inputを読む |
| `mapApi.ts` | query validation、HTTP status、cache、失敗隔離 |
| Cloudflare Worker | D1/R2・OSM adapterで同じcontractを返す |
| `mapPlaceAtlasProfile.ts` | loading/success/empty/suppressed/errorのpure HTML renderer |
| `mapExplorer.ts` | 選択イベント、遅延fetch、AbortController、sequence guard、panelへの挿入 |

## Place Atlas参照

```ts
type PlaceAtlasRef =
  | { kind: "field"; fieldId: string }
  | {
      kind: "osm_area";
      entityKey: `osm:${"way" | "relation"}:${number}`;
      osmType: "way" | "relation";
      osmId: number;
    }
  | { kind: "public_cell"; cellId: string };
```

公開API query:

- `kind=field&fieldId=<id>`
- `kind=osm_area&entityKey=osm:<way|relation>:<id>&osmType=<type>&osmId=<id>`
- `kind=public_cell&cellId=<public-cell-id>`

raw latitude/longitudeとGeoJSONは受け取らない。OSMのtype、id、entityKeyは相互一致を
検証する。登録済みfieldとtransient OSM areaを同一IDとして扱わない。既存client互換のため
snake_case aliasも受けるが、公開例と新規clientはcamelCaseを正本とする。

## Read Model contract

```ts
type PlaceAtlasProfile = {
  version: 1;
  placeRef: PlaceAtlasRef;
  place: {
    name: string;
    type: string;
    localityLabel: string | null;
    description: string | null;
    representativeMedia: Array<{
      url: string;
      recordId?: string;
      observedAt?: string;
      kind?: "photo" | "video" | "audio" | "record";
    }>;
  };
  summary: {
    recordCount: number | null;
    contributorCount: number | null;
    firstRecordedAt: string | null;
    latestRecordedAt: string | null;
  };
  facets: PlaceAtlasFacet[];
  highlights: PlaceAtlasHighlight[];
  recentRecords: PlaceAtlasRecord[];
  guide: unknown | null;
  memories: unknown[];
  facilities: unknown[];
  dataGaps: Array<{ key: string; label: string; reason: string }>;
  publication: {
    status: "published" | "partial" | "suppressed";
    suppressedSections: string[];
    locationMode: "field" | "osm_area" | "public_cell" | "public_cell_derived";
  };
  provenance: {
    generatedAt: string;
    profileVersion: "place_atlas_profile/v1";
    sources: string[];
  };
};
```

`null`は未取得・安全に算出不能、`0`は完全な対象集合を評価して該当なしと確認できた場合に
限る。Record数はdistinct Record ID、mediaは正規化URLまたはasset keyで重複排除する。
contributor数は安全なdistinct contributor集計があり、公開閾値を満たす場合だけ返す。
記録導線を抑制する正本tokenは`contribution_cta`とする。NodeとCloudflare Workerは、
学校、`private`、`no`、`restricted`、`customers`、`permit`、sensitive policy抑制を
検出できる範囲で同じtokenを返す。UIは旧response互換のため`direct_record_cta`も抑制として
受理するが、新規responseでは生成しない。

## Facet contract

`taxonGroup`とは別に次の閲覧themeを使う。

- `nature`
- `scenery`
- `daily_life`
- `facility`
- `activity`
- `history`
- `audio_visual`
- `insight`
- `unclassified`

MVPでは永続DB列を追加せず、Recordの構造化情報、media kind、公開済みのguide/memory/facility
から派生する。根拠がなければ分類しない。0件カードを並べず、未充足themeは
`dataGaps`と「次に残せること」へ送る。

## Highlight evidence contract

```ts
type PlaceAtlasHighlight = {
  kind: string;
  text: string;
  evidenceCount: number | null;
  sourceLabel: string;
  confidence: "confirmed" | "derived" | "unknown";
};
```

request-time LLMは使わない。最近の追加、季節の偏り、明確なfacet優勢など、
閾値を満たす決定論的な文だけを返す。証拠不足なら弱い作文をせずhighlight自体を返さない。
AI候補・同定待ちを確認種数や確定taxon highlightへ使わない。

## registered fieldとOSM areaの違い

- registered field:
  - field registryを正本とする。
  - direct field linkageがある公開Recordを優先する。
  - direct linkageがなければpublic cell derivedとして扱い、exact field membershipを断定しない。
  - field public profile policyを優先して確定生物・季節傾向等を抑制する。
- transient OSM area:
  - OSM type/id/entityKeyを安定参照とする。
  - server-sideのtimeout付きOSM lookupから名前と公開scopeを得る。
  - exact area linkageがなければpublic cell derivedと明示する。
  - access制限、学校、私有地等は安全案内を強める。
- public cell:
  - public map snapshotと同じk-anonymous public cellをscopeとする。
  - exact coordinatesやcell centroidをprofile responseへ返さない。

## Privacyと公開閾値

1. exact coordinate、geometry、sensitive speciesの位置を返さない。
2. private、limited、hidden、emergency-hidden、公開品質gate不通過Recordを含めない。
3. source contributorの一覧を返さない。
4. public map aggregateの最低Record数を満たさない集合は件数、recent records、mediaを抑制する。
5. field policyでdetails不許可の場合、確定生物、季節傾向、密度等を抑制する。
6. 公開セル由来の件数は「場所周辺の公開記録」であり、field polygon内の断定ではない。
7. HTMLをescapeし、media URLはsame-origin/public media pathまたは許可済みHTTPSのみとする。
8. OSM文字列と外部URLを信頼せず、長さ・schemeを正規化する。

## UI構成

原則順序:

1. 場所名と短い説明
2. 代表写真
3. 安全に出せるRecord数・期間
4. この場所で見えてきたこと
5. 地域図鑑theme
6. 最近のRecord
7. guide、history、memory、facility
8. まだ少ない記録・次に残せること
9. 記録CTA
10. 公開範囲の案内

desktopは既存right panel、mobileは既存bottom sheetのpeek/fullを維持する。
grip/closeは44px以上、safe-areaと下部navigationを回避し、focus-visibleとreduced motionを
維持する。画像失敗時はカードを隠し、テキストfallbackを残す。

## Loading / empty / error / suppressed

- loading: 場所名が分かる場合は名前を先に示し、profile読込中をlive regionで伝える。
- empty: 完全な公開集合を評価しRecordが0と確認できた場合だけ「まだ記録がない」とする。
- suppressed: 記録の有無を推測させず、公開条件を満たすまで詳細を控えていると伝える。
- error: 地図と選択解除を維持し、profileだけ再試行可能にする。
- partial: 代表mediaや周辺Recordは表示できるが、field内断定・contributor・確定種等は
  `dataGaps`で境界を示す。

## 常磐公園MVP

- 表示名はregistry/OSM由来の `常磐公園` を使う。
- `field`参照でprofileを取得し、常磐公園専用条件分岐を置かない。
- public cellに既に表示可能な複数Recordがある場合、distinct Recordとして反映する。
- direct field membershipが証明できない場合は `public_cell_derived` とし、
  「常磐公園内の43件」と断定しない。
- 同一Recordの複数Occurrence、同一mediaを重複計上しない。
- AI候補と同定待ちは確認種へ含めない。
- 他OSM公園、registered field、public cellへ同じcontractを適用する。

## 非目標

- production DB migration
- secret、DNS、権限変更
- 既存Record/Occurrenceの変換・削除
- Record/Observation移行全体の完了
- 新CMS
- map framework全面置換
- request-time LLM作文
- 常磐公園専用ページ
- 旧PHPへの通常機能追加

## 将来のRecord移行との接続

MVP adapterはlegacy visitをRecord IDとして扱い、`record_observations`が正本化された後も
同じprofile inputへ変換する。ObservationとIdentificationはtheme・確定taxonの根拠に使えるが、
Occurrence件数をRecord件数へ流用しない。関連移行は #1376 を上書きせず、依存リンクとして扱う。

## 将来の永続theme・編集機能

編集済み説明、歴史資料、facility、永続theme、公式source attributionは将来migrationへ分離する。
導入時は編集履歴、権利、review state、source evidenceを必須にし、LLM outputを直接公開しない。

## Rollout / rollback

1. Node・Worker contract tests。
2. local UI fixture / browser QA。
3. Wレビュー証跡を同一branch/PRへ保存。
4. exact SHAでstaging deploy、API/UI/Visual QA。
5. production deploy、health/readiness/map/profile smoke。
6. rollbackは中央deploy registryの直前成功versionを使う。DB migrationがないため、
   code rollbackのみで旧area snapshot UIへ戻せる。

## テスト条件

- ref normalize: field / osm_area / public_cell / invalid
- profile aggregation: Record/media dedupe、facet、highlight、null/0
- publication: minimum threshold、field suppression、private/hidden exclusion
- AI候補を確定種数に含めない
- route: field / OSM / public cell / not found / invalid / suppressed / safe failure
- UI: loading / success / empty / partial / suppressed / error
- 常磐公園相当fixture、desktop side panel、mobile bottom sheet
- CTA href/KPI、keyboard、focus-visible、safe-area、horizontal overflow
- widths: 375、390前後、768、1024、1280、1440以上

## Local validation evidence

2026-07-23の実装完了時点で、Node 1,363件、Cloudflare Worker 386件の全テスト、
両runtimeのtypecheck、production dependency auditを通過した。常磐公園相当fixtureを使う
Playwrightは375 / 390 / 768 / 1024 / 1280 / 1536pxとAPI failureの7ケースを通過した。
画面証跡と観点は [`evidence/README.md`](./evidence/README.md) に固定する。
