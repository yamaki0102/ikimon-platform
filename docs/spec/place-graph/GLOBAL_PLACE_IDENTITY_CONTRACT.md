# ZUKAN Global Place Identity Contract

- 記録日: 2026-07-27
- 状態: `STRATEGY_ADOPTED / IMPLEMENTATION_PENDING`
- 戦略正本: `yamaki0102/ikimon-business-strategy@cd997b58eadeb8a0aba264d743d18b3cbf305934`
- 正式Decision: `decisions/2026-07-27-zukan-place-first-global-spatiotemporal-model.md`
- 詳細原則: `strategy/zukan-global-place-graph-principles.md`
- 実装baseline: `yamaki0102/ikimon-platform@c2e8d81e2c7c01a06757c28764c06694a1219dfe`

## 1. この文書の役割

本書は新しい実装を完了したと示す文書ではない。

ZUKANの世界展開に関わる正式Decisionを、今後の`ikimon-platform`実装が読み落とさないための拘束契約である。

現時点では、production、DB、migration、API、URL、既存ID、runtimeへ変更を加えない。

## 2. 必須不変条件

今後のPlace関連実装は、次を破ってはならない。

1. canonical identityは、名称、slug、住所、Geometry、行政コード、OSM IDから独立する。
2. 国→県→市→町等の固定階層を世界共通schemaにしない。
3. 行政区域、文化圏、自然地域、施設等は、時間・根拠付きのPlaceとRelationとして表現できる。
4. 地域ページは個別DBではなく、共通Place Graphを読むViewとする。
5. 名称、Geometry、所属、関係、外部IDは期間付きAssertionとして履歴を残す。
6. 改称、合併、分割、境界変更で過去Placeと過去Recordを削除・上書きしない。
7. same-place判定は名称や座標だけで自動確定しない。
8. 行政区域、文化圏、流域等は重複でき、単一parent treeへ限定しない。
9. 多言語名、旧称、現地名、外名、transliterationを保持できる。
10. 同じRecordを自治体View、テーマ、企画ごとに複製しない。
11. private exact Geometryとpublic derived Geometryを分離する。
12. AIは候補を作れるが、Place統合、行政所属、境界、歴史的事実を自動確定しない。

## 3. 現行実装の位置づけ

現行資産は作り直さない。

- Record / Observation
- Place Atlas Profile
- Place Atlas timeline
- field / osm_area / public_cell参照
- provenance
- publication suppression
- privacy-safe media / location
- verification state

現行`PlaceAtlasRef`の各kindは、そのまま世界共通canonical identityとはみなさない。

- `field`: 登録済み場所source locator
- `osm_area`: 外部地理Entity locator
- `public_cell`: 公開安全な集約scope

将来のcanonical Place identityへ対応付けるadapter入力として維持する。

## 4. 最初のsource-only slice

DB変更より先に、UI・永続化へ依存しないdomain contractとtestを追加する。

候補型:

- `PlaceIdentity`
- `PlaceAssertion`
- `PlaceRelation`
- `PlaceViewDefinition`
- `PlaceExternalIdentifier`
- `PlaceNameAssertion`
- `PlaceGeometryAssertion`

正式な型名は実装監査後に決める。既存`Place`型との衝突回避を優先し、名称だけで新規概念を増やさない。

最初のsliceで行わないこと:

- DB / migration
- 既存IDの改名
- canonical URL変更
- Place Atlas全体の再設計
- Graph DBまたはRDFへの全面移行
- staging / production deploy
- 磐田固有データの本番投入

## 5. 必須fixture

少なくとも次をpure domain testで固定する。

1. 名称変更しても同一Place ID
2. 同一行政主体の境界変更
3. 新設合併で旧Placeを保持し新Placeを作る
4. 編入等で法的存続主体を根拠付きで判定する
5. 分割で旧Placeと複数successorを保持する
6. 同名・近接だが別Place
7. 行政区域と文化圏が重複する
8. 多言語、複数script、旧称、現地名
9. 複数の境界・所属主張が併存する
10. 住所を持たない自然Place
11. 移築された建物と元敷地を別Placeとして追跡する
12. 同一Recordを現在View、歴史View、テーマViewで複製なしに読む
13. private Geometryがpublic projectionへ出ない
14. 外部ID変更でもcanonical IDが変わらない

## 6. 時間契約

少なくとも次を分離する。

- `valid time`: 現実世界で主張が有効だった時期
- `recorded time`: システムが取得・登録・確認した時期
- `observed time`: Recordが観察された時期

現在の行政所属を過去Recordへ遡及上書きしない。

## 7. identity continuity

identity継続はPlace種別ごとのpolicyとEvidenceで判断する。

- 改称のみ: 原則同一ID + 新Name Assertion
- 法的主体が継続する境界変更: 原則同一ID + 新Geometry / Relation Assertion
- 新設合併: 原則新ID + predecessor / successor
- 分割: 原則新ID群 + split relation
- 移築建造物: 建造物identityを維持し得るが、敷地Placeは別identity
- 判断不能: 統合せずcandidate relationで保留

名称一致、Geometry一致、外部ID一致のいずれか一つだけで統合しない。

## 8. View contract

「磐田ZUKAN」等は、少なくとも次を持つViewとして扱う。

- stable view ID
- scopeとなるPlaceまたはquery
- target time / interval
- theme / program
- publication policy
- creator / operator
- provenance

ViewはRecord・Placeを所有・複製しない。

## 9. 標準整合候補

実装技術を拘束せず、概念の相互運用先として検討する。

- OGC GeoSPARQL 1.1
- W3C PROV-O
- W3C OWL-Time
- IETF BCP 47 / RFC 5646

RDF・Graph DB採用を前提にしない。既存relational modelでもdomain invariantを先に満たす。

## 10. 実装ゲート

DB / migration提案へ進む前に、次を満たす。

- source-only contractがreview済み
- 必須fixtureが通る
- 現行Place Atlasとのadapter境界が明示される
- 既存Record / Observation / Place IDの互換性が説明される
- privacyとpublication suppressionが弱まらない
- rollback可能なadditive migration案がある
- 磐田データを日本専用固定列なしで変換できる

## 11. 禁止

- 市町村名をtenant IDまたはcanonical IDにする
- `country/prefecture/city/town`を必須固定列として追加する
- OSM等の外部IDをcanonical IDとして転用する
- 合併時に旧Placeを新Placeへ単純改名する
- ViewごとにRecordを複製する
- 現在Geometryで過去所属を上書きする
- AIによる自動same-place確定
- 戦略Decisionを更新せずに日本限定modelへ変更する

## 12. 未確認事項

- 正式型名とmodule配置
- Relation vocabulary
- assertion statusとreview workflow
- bitemporal storage
- Geometry versioning
- external identifier mapping
- canonical URL
- disputed / multi-perspective UI
- 既存Placeデータのmapping・移行

これらは別spec・PRで解決する。