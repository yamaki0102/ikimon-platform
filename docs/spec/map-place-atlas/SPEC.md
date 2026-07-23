# Map Place Atlas Profile Specification

Status: implementation target
Contract version: `place_atlas_profile/v1`
Baseline: `2a93c8983e2c836b847730bd77f9ff964c0404a0`
Issue: [#1418](https://github.com/yamaki0102/ikimon-platform/issues/1418)
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

- `kind=field&field_id=<id>`
- `kind=osm_area&entity_key=osm:<way|relation>:<id>&osm_type=<type>&osm_id=<id>`
- `kind=public_cell&cell_id=<public-cell-id>`

raw latitude/longitudeとGeoJSONは受け取らない。OSMのtype、id、entityKeyは相互一致を
検証する。登録済みfieldとtransient OSM areaを同一IDとして扱わない。

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
