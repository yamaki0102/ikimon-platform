# ADR-0001: Place AtlasをDB entityではなくversioned Read Modelとして導入する

Status: accepted for MVP
Date: 2026-07-23
## Context

現行mapにはRecord相当のvisit、Occurrence、field、OSM area、public cell、Place Memory、
Guide Stop、Site Briefが既にある。Record/Observation正規化は進行中で、MVPのために新しい
永続Place entityやtheme列を追加すると、移行とprivacy contractの両方へ大きな結合を作る。

## Decision

`PlaceAtlasRef`を入力とする`place_atlas_profile/v1` Read Modelを導入する。
field、OSM area、public cellをadapterで公開Recordへ結び、Record単位のdedupe、facet、
highlight、suppressionをpure contract builderへ集約する。

場所へのdirect linkageがない場合は公開セル由来を許容するが、
`publication.locationMode=public_cell_derived` としてexact membershipを断定しない。
field public profile policyは確定生物・季節傾向等の詳細公開に優先する。

request-time LLM、DB migration、自由記述の永続編集は導入しない。

## Consequences

### Positive

- 既存データを変更せず、Record/Observation移行後もadapterを差し替えられる。
- NodeとCloudflare Workerで同じ公開contractを共有できる。
- 地図写真とfield Occurrence集計の矛盾をRecord dedupeとprovenanceで解消できる。
- OSM areaを常磐公園専用処理にせず扱える。

### Trade-offs

- direct field linkageがない場所では「場所周辺」の集約であり、polygon内件数ではない。
- contributor、確定taxon、季節傾向は安全に算出できない場合にnullまたはsuppressedとなる。
- 永続theme、編集済み歴史説明、facility catalogは将来migrationが必要。

## Rejected alternatives

- `area-snapshot`のOccurrence数をそのままRecord数として再利用する。
- clientからGeoJSONやraw coordinateをprofile APIへ送る。
- 選択のたびにLLMで場所説明を作文する。
- 常磐公園専用routeや固定fixtureをproduction codeへ入れる。
- Node routeだけ実装し、Cloudflare本番runtimeをorigin fallbackへ任せる。
