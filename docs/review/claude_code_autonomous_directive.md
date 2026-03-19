# Claude Code Autonomous Directive

**対象**: ikimon.life の 3D生態系デジタルツイン / パッシブ観察 / フィールドスキャン機能  
**作成日**: 2026-03-19  
**目的**: Claude Code が、このリポジトリで自律的に最善の設計判断と実装を行うための実行指示書  
**時間軸**: `今日のUX` と `100年後の再解釈可能性` を同時に満たすこと  
**前提**: 共有サーバー制約に合わせた妥協は不要。`KAGOYA VPS` の高スペック契約は許容される

---

## 1. 最重要結論

このプロジェクトの勝ち筋は、`iNaturalist の代替写真投稿サービス` になることではない。  
勝ち筋は、`受動観測 + 場所ベース + 長期時系列 + 保全/自治体活用` の統合プラットフォームになることだ。  
さらに、その全てを **100年後でも再読・再計算・再利用できる形で残すこと** が必須条件である。

したがって、Claude Code は以下を最優先で守ること。

1. **スマホ中心の毎日使う価値**を最上位に置く
2. **3D はコアUXではなく、上位価値・研究/自治体価値として位置づける**
3. **空間データの正本は JSON ではなく、地理空間DB + point cloud 標準フォーマットに移す**
4. **偽の高精度を禁止する**
5. **Eagle は一般ユーザーの必須前提にしない**
6. **いまのベンダー・モデル・座標系・分類体系が消えても意味が残る構造にする**

### 1.1 100年後テスト

Claude Code は、重要な設計判断のたびに次の問いを通すこと。

1. このデータは、`特定ベンダーや特定アプリが消えても` 読めるか
2. この観測は、`今のAIモデル名が無意味になっても` 再評価できるか
3. この位置は、`基盤地図や座標変換手法が変わっても` 再投影できるか
4. この分類結果は、`分類体系が更新されても` taxon concept を追跡できるか
5. このシステムは、`開発者が全員入れ替わっても` 引き継げるか

1つでも `No` なら、その設計は100年運用に耐えない前提で再設計すること。

---

## 2. 北極星アーキテクチャ

Claude Code は、今後の設計判断を必ず以下の target architecture に寄せること。

### 2.1 Canonical Data Plane

- 観測イベント正本: `PostgreSQL + PostGIS + TimescaleDB`
- 点群正本: `COPC/LAZ`
- 3D配信: `3D Tiles`
- 大容量アセット保管: `Object Storage`
- 非同期処理: queue worker
- Web/API: PHP を当面継続してよいが、正本は JSON ファイルに戻さない
- 長期保全: `open format + checksum + provenance manifest + periodic archive export`

### 2.2 論理分解

今の `空間基盤 / 生物レイヤー / 時間レイヤー` という説明は不正確。  
正しい分解は以下:

1. `Geometry Foundation`
2. `Registration & Uncertainty`
3. `Observation Events`
4. `Temporal Versioning`

時間は独立レイヤーではなく、全てを横断する版管理軸として扱うこと。

### 2.3 Century Durability

100年保全のため、canonical layer は以下を満たすこと。

- raw と derived を分離する
- raw は immutable とする
- derived は再生成可能にする
- 各処理に `schema_version`, `pipeline_version`, `model_version`, `taxonomy_version` を残す
- 各アセットに checksum を持たせる
- export だけで再構築できる最小メタデータを維持する
- ベンダー固有APIは adapter 層に閉じ込める

### 2.4 Product Split

- 一般ユーザー向け中核: `passive biodiversity monitoring`
- 同定/投稿コミュニティ向け: `AI補助 + human verification`
- 自治体/研究向け上位機能: `3D ecosystem twin`, `change detection`, `site intelligence`

Eagle は上位機能の入力装置であり、日常UXの前提ではない。

---

## 3. 絶対ルール

Claude Code は以下を禁止事項として扱うこと。

### 3.1 データモデル

- `1エリア = 1巨大JSON正本` を増やさない
- raw point cloud を GeoJSON や独自JSONへ変換して正本化しない
- `taxon_name` 文字列だけで生物レコードをマージしない
- 位置誤差を無視して `±5m GPS` を `2cm 点群` に直接貼り付けない
- 時系列データを巨大配列に閉じ込めない
- provenance のない観測を正本に入れない
- `vendor固有フォーマットだけ` に依存して長期保存しない
- taxon concept を追跡できない識別子設計を採用しない

### 3.2 UX

- `3D がすごい` を日常利用価値と誤認しない
- 一般ユーザーに Eagle 月次運用を要求しない
- 種同定の断定精度を過大表現しない

### 3.3 検証品質

- 人間検証なしで `research_grade` を付与しない
- AI 高信頼だけで研究品質扱いにしない
- ダミー推論を本番仕様として放置しない

### 3.4 プライバシー

- 顔、車両ナンバー、生活導線を含む 8K パノラマ/3D を無加工で公開しない
- 希少種の枝レベル位置を公開しない
- 位置・音声・顔を別データとして扱わず、一体の再識別リスクとして扱う

### 3.5 継承性

- `今の作者しか理解できない暗黙仕様` を残さない
- schema migration を口伝で済ませない
- closed SaaS を唯一の正本保管先にしない
- `いま動く` だけで archive/export を後回しにしない

---

## 4. 現状コードの危険箇所

Claude Code は、以下を「直すべき事実」として認識すること。

### 4.1 EcosystemMapper はまだデジタルツインではない

現状の `EcosystemMapper` は:

- 検出を `taxon_name + round(lat, 4) + round(lng, 4)` で集約している
- 最終的なマージでは `taxon_name` 単位で潰している
- `lidar_summary` の要約を `vegetation` に格納しているだけ
- モデル全体を単一JSONとして再保存している

これは `3D ecosystem twin` ではなく、`GPS付き観察集計JSON` である。  
よって、このクラスを拡張して夢を見るのではなく、責務を縮小または廃止し、新しいデータ層へ段階移行すること。

### 4.2 DataStageManager は研究品質を壊す

現状は:

- `ai_classified -> research_grade` の遷移が許可されている
- `grade <= 'B' && 合意2件` で `research_grade` にしている

これは research-grade の定義として不適切。  
`research_grade` は最低でも:

- 証拠メディアあり
- taxon concept 解決済み
- human verification あり
- 合意件数条件を満たす

を必須にすること。

### 4.3 field_scan / iOS は試作段階

現状は:

- Web 版音声分類がダミー
- Web は 4秒ごとにサーバー AI へ写真送信
- iOS の `classifyCurrentFrame()` は空
- iOS 音声検出は simulated
- iOS は観測位置を `routePoints.last` に潰している
- iOS は毎回 `areaId` を timestamp 新規発行している

したがって、これらを「機能の磨き込み」で済ませず、プロダクション設計へ作り替えること。

---

## 5. いますぐ実装で直すべき順序

Claude Code は、原則として以下の順序で進めること。

### Step 1: データ品質と意味論を壊している箇所を止血

最優先:

1. `DataStageManager` の遷移ルール修正
2. `research_grade` 判定条件の厳格化
3. `EcosystemMapper` の taxon-only merge を停止
4. fake precision を示すフィールドの整理

この段階では、新機能よりも「誤った永続化」を止めることを優先する。

### Step 2: Canonical schema を導入

最低限の新規概念:

- `stable_id`
- `geometry_version`
- `observation_event`
- `location_uncertainty_m`
- `taxon_id`
- `taxon_concept_version`
- `source_device`
- `processing_stage`
- `derived_view`
- `provenance`
- `license`
- `consent_scope`

保存戦略:

- event は append-only
- aggregate は派生
- viewer 用データは派生
- raw asset は immutable
- archive export は定期実行

### Step 3: ingest と viewer を分離

- raw point cloud ingest
- registration
- tiling
- browsing

を別々の責務として設計すること。  
`アップロードAPIがそのまま最終JSONを更新する` 形を続けないこと。

### Step 3.5: 100年保全を先に埋め込む

各データ型ごとに、実装初期から次を持たせること。

- stable identifier
- schema version
- provenance chain
- original observed time
- processing history
- exportability

これらを後から足す前提で実装してはいけない。

### Step 4: UX を分離

一般ユーザー向けの最短価値:

- 散歩中に名前がわかる
- 歩くだけで近所の季節変化が見える
- 不明種はコミュニティに流れる

研究/自治体向け:

- エリア比較
- 差分検知
- 3D閲覧
- 外部GIS連携

### Step 5: 外部連携を積み上げる

優先順位:

1. `VIRTUAL SHIZUOKA`
2. `Google Earth Engine`
3. `Google Earth / KML`
4. `Cesium / 3D Tiles`

---

## 6. 外部連携の方針

### 6.1 VIRTUAL SHIZUOKA

静岡県では、県土全域の3次元点群データ、グラウンドデータ、グリッド、オルソ画像、等高線などを `VIRTUAL SHIZUOKA` として公開している。  
これは Eagle でゼロから県土基盤を作る必要がないことを意味する。

Claude Code は静岡県での設計について、次を前提とすること。

- 広域基盤は `VIRTUAL SHIZUOKA` を優先利用
- Eagle は microhabitat / canopy-understory / 更新差分の高精細補完に使う
- 静岡でのPoCは `VIRTUAL SHIZUOKA + ikimon 観測イベント + 衛星時系列` の統合に寄せる

### 6.2 Google Earth Engine

Google Earth Engine は、地球観測ラスタや時系列解析の文脈追加に使うべきであり、ikimon の system of record にしてはいけない。

用途:

- NDVI/EVI
- 水域変化
- 地表面温度
- 土地被覆
- 火災/洪水/裸地変化
- 季節変動の衛星指標

方針:

- Earth Engine は `context layer` として扱う
- 生物観測の正本は ikimon 側で保持
- site / month / season 単位で集約値を取り込む
- raw user observation を Earth Engine に依存させない
- GEE 側でしか再現できない分析結果を唯一の成果物にしない

### 6.3 Google Earth / KML / KMZ

Google Earth 連携は、軽量な共有・合意形成・プレゼン用途には有効。

用途:

- 研究者/自治体向けレビュー
- 現地点検ルートの共有
- 種分布・希少種非公開版の簡易可視化
- before/after 比較

方針:

- `KML/KMZ export` を提供する
- ただし raw point cloud 正本や内部精度モデルは KML に寄せない
- KML は共有フォーマットであり、保存正本ではない

### 6.4 Google 3D / Maps Platform

Photorealistic 3D Tiles は背景基盤としては面白いが、プロダクトの基幹依存にはしないこと。  
理由: ライセンス・コスト・長期可搬性・独自データ主権の問題がある。

### 6.5 外部連携の原則

外部サービスは全て `replaceable context adapter` として扱うこと。

- `VIRTUAL SHIZUOKA` は基盤候補
- `Google Earth Engine` は解析補助
- `Google Earth` は共有補助
- `Google Maps Platform` は背景候補

いずれも、ikimon の正本・意味論・識別子体系の外に置くこと。

---

## 7. センサー統合の正しい考え方

Claude Code は、異種センサー統合を以下のように扱うこと。

### 7.1 座標系

- グローバル基準: `WGS84 / EPSG:4979`
- エリア内計算: `ENU local frame`
- Eagle: SLAM 座標から georeference
- iPhone: ARKit local frame を anchor で接続
- Pixel: GPS は確率分布として扱う

### 7.2 不確実性

全観測に最低限持たせる:

- `crs`
- `horizontal_uncertainty_m`
- `vertical_uncertainty_m`
- `timestamp_uncertainty_ms`
- `geometry_version_id`
- `geometry_age_sec`

### 7.3 観測保存

保存単位は aggregate ではなく event。

- 同じ種でも統合前に潰さない
- device ごとの差は残す
- マージは query / materialized view 側で行う
- human / AI / rule engine の判断は別レイヤーで保持する
- 100年後に raw から再判定できるようにする

---

## 8. AI パイプラインの決定ルール

### 8.1 原則

- `edge first, server verify`
- リアルタイムUXは端末推論
- サーバー推論は再判定・補強・後処理
- モデル出力は事実ではなく、`versioned interpretation` として保存する

### 8.2 Web

Web版は制約が強い。  
したがって、Web は次のどちらかに寄せること。

1. 明確に `簡易版` と位置づける
2. 本格機能をネイティブへ寄せる

4秒ごとにサーバーへ写真送信する設計をコアUXにしてはいけない。

### 8.3 Android

- BirdNET/TFLite は継続可
- ただし日本運用の閾値校正・誤検知収集・再学習前提で扱う
- バックグラウンド録音はプライバシーとOS制約を明文化する

### 8.4 iOS

- ARKit / Vision / LiDAR はネイティブの強みとして活かす
- ただし BirdNET 相当の audio pipeline は simulated のまま放置しない
- species-level certainty を乱発しない

---

## 9. データ公開とプライバシー

Claude Code は公開レイヤーを最低3段階で設計すること。

1. `private`
2. `community`
3. `public/research-safe`

最低限必要:

- 顔/車両/私有地の自動 masking
- ルートの generalization
- 希少種の精度降格
- viewer ごとの権限制御
- export ごとの redaction policy

`PrivacyFilter` は観察点マスクだけでは足りない。  
3D viewer policy まで含めた再設計が必要。

### 9.1 100年保存と削除要求の両立

Claude Code は、長期保存と削除要求を両立できる構造にすること。

- raw private data と public derived data を分離
- consent scope を明示保持
- redaction 可能な派生物は再生成前提にする
- 法改正時に公開範囲を縮められる構造にする

---

## 10. 実装時の具体的判断ルール

Claude Code は、迷った場合は次のルールで判断すること。

### 10.1 優先順位

1. 正しい正本設計
2. fake precision 排除
3. 100年後の再解釈可能性
4. 日常UXの成立
5. 外部連携
6. 3D表現の華やかさ

### 10.2 技術選定

- 空間正本: PostGIS
- 時系列: TimescaleDB
- 点群正本: COPC
- 配信: 3D Tiles
- 大容量格納: object storage
- viewer: Cesium 系優先
- raw engineering point cloud 閲覧: Potree 系も可

### 10.3 モバイル戦略

Flutter/React Native での統一を急がない。  
LiDAR, ARKit, バックグラウンド音声, GPS 制約差が大きいので、ネイティブ分岐を維持すること。

### 10.4 DB移行

JSON ストアを即全廃できなくてもよい。  
ただし、新しい canonical schema を導入し、旧JSONは read-only 互換層へ寄せること。

### 10.5 ベンダー依存

KAGOYA VPS は現時点の最適解として使ってよい。  
ただし、`KAGOYA 固有の実行環境に閉じた設計` にしてはいけない。

必要:

- IaC または準IaC
- restore 手順
- 別VPS/別クラウドへ移せる構成
- archive/export の定期実行

### 10.6 Century-first rule

短期便利さと100年耐久性が衝突した場合は、原則として100年耐久性を優先すること。  
例外は、日常UXが成立しなくなる場合のみ。その場合も durability を捨てず、二層構造で両立させること。

---

## 11. 直近6ヶ月の成果物

Claude Code は、以下を6ヶ月で実現する計画に寄せること。

### 11.1 必須

- `DataStageManager` の修正
- 観測 event schema 導入
- `EcosystemMapper` の縮退または再定義
- KAGOYA VPS 前提の infra/ops 設計
- 点群 ingest pipeline の別系統化
- KML/GeoPackage/DwC-A export の整理
- `VIRTUAL SHIZUOKA` 連携 PoC
- `Google Earth Engine` 連携 PoC

### 11.2 重要

- uncertainty-aware UI
- passive mode の production hardening
- iOS/Android の実装差吸収
- external viewer 戦略確立
- archive/export パッケージの最小実装
- schema/provenance/versioning の定着

### 11.3 後回しでよい

- 3D Gaussian Splatting を一般UXの中心に置くこと
- Eagle 前提のオンボーディング
- raw PLY を直接Web配信すること

---

## 12. 実装開始時の最初のタスク

Claude Code が最初に着手すべきこと:

1. `DataStageManager` の遷移制約修正
2. `research_grade` 条件を human verification 前提へ修正
3. `EcosystemMapper` の merge ロジックを event-safe に変更、または deprecated 化
4. `field_scan.php` と iOS 実装で dummy / simulated を明示し、本番フローと切り離す
5. 新しい canonical schema と migration ADR を `docs/architecture/` に追加
6. KAGOYA VPS 前提の infra たたき台を作る
7. raw / derived / archive の3層保存戦略を文書化する
8. taxon / schema / model の versioning 方針を文書化する

原則として、UIの見た目改善より先に、データ破壊と意味論破壊を止めること。

---

## 13. 期待される作業スタイル

Claude Code は以下の姿勢で動くこと。

- お世辞不要
- 推測で設計を広げない
- 既存コードを読んでから変える
- 変更は小さく区切るが、判断は大きく最適化する
- 「現状の延長線」ではなく「勝ち筋への収束」で決める
- 迷ったら `毎日使う価値` を守る
- 迷ったら `2126年の研究者が再利用できるか` を先に考える

### 13.1 100年後の引き継ぎ相手を想定せよ

Claude Code は、未来の引き継ぎ相手を次のように想定すること。

- 現在の開発者を知らない研究者
- 法規制が変わった後の自治体担当者
- モデル名やGPU事情が変わった後の保守担当者
- 分類体系が更新された後の生態学者

この相手に説明不能な実装は、未来に残してはいけない。

---

## 14. 外部参照

- `docs/review/codex_review_directive.md`
- `docs/strategy/refactoring_roadmap.md`
- `docs/strategy/mobile_ux_strategy.md`
- `VIRTUAL SHIZUOKA` 公式資料
- `KAGOYA VPS` 公式
- `Google Earth Engine` 公式ガイド
- `Google Earth / KML` 公式情報

実装前提や価格、ライセンス、公開仕様は変化しうる。  
外部サービス依存の判断では、必ず最新の一次情報を確認してから決定すること。

