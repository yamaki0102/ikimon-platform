# ikimon.life 戦略・計画ドキュメント

> 最終更新: 2026-03-21
> バージョン: v3.8
> 別紙: [A: Privacy](appendix_a_privacy_governance.md) | [B: Reviewer Ops](appendix_b_reviewer_operations.md) | [C: PoC](appendix_c_phase6_poc.md) | [D: 法務レビュー依頼](appendix_d_legal_review_brief.md)
> ステータス: Living Document（継続的に更新）
> リポジトリ: `docs/strategy/ikimon_life_strategy_2026Q1.md`

---

## 1. ミッション

**「自然が、子どもとまちを結ぶ。」**

ikimon.lifeは「みんなでつくる生き物図鑑」として始まった。しかし本質は生物データの収集ではない。**まちの解像度を上げ、愛着を育て、地域の生き残る力をつくること**。生物多様性だけでなく、生物文化多様性、ウェルビーイング、地域創生が一体となったプラットフォーム。

### 原体験と哲学

玄関先の飛び石をひっくり返してハサミムシと出会う。スキー場でバッタを10匹捕まえる。手つかずの自然だけでなく、**人が手入れをしている場所（玄関先の石畳、管理された里山、草を刈ったゲレンデ）にこそ、子どもが生き物と出会うきっかけがある**。

名前を知ること。季節の変化に気づくこと。それは自分が暮らしている場所の「解像度」が上がるということ。解像度が上がると愛着が生まれ、愛着が生まれるとその場所を大切にしたくなる。

### 3つの循環

1. **子どもの好奇心** → 生き物との出会い → 地元への愛着 → 「ここが好き」と思う次世代
2. **大人の健康** → 自然の中を歩く → ストレス低減＋認知機能維持（9,800歩/日で認知症リスク51%低下：JAMA Neurology） → 余裕のある大人が子どもを見守る
3. **世代を超えた交流** → 親・先生・近所の大人が一緒に歩く → 家族以外の信頼できる大人の存在 → 子どもの安心感

### 消滅可能性自治体に届ける（段階的展開）

2050年までに20-39歳女性人口が50%以上減少する「消滅可能性自治体」が全国744（全自治体の43%）。最も危機的な自治体（若年女性減少率80%以上）にikimon.lifeの全機能を無償提供する。

**ただし全744自治体に同時展開するのではなく、段階的に：**

| フェーズ | 対象 | 規模 | 条件 |
|---------|------|------|------|
| **初期cohort** | 愛管株式会社所在地域＋静岡県内1-2自治体 | 2-3 site-months | reviewer確保＋PoC完了後 |
| **拡大cohort** | 若年女性減少率80%以上の自治体から申込制 | 10-20 site-months | reviewer capacity内（Appendix B7.4参照） |
| **全国展開** | 744自治体全体 | reviewer増員＋Publicプラン収益で持続 | Publicプランの売上がunit costをカバーできた段階 |

### 収益モデルと持続可能性

| プラン | 対象 | 価格 |
|--------|------|------|
| **無償提供** | 消滅可能性自治体（初期cohort→段階的拡大） | 完全無料（全機能） |
| **Community** | 一般市民・小規模団体 | 無料（投稿・同定・図鑑・観察会） |
| **Public** | 企業・大規模自治体 | 有料（種の全リスト、CSV、証跡レポート、調査・報告機能） |

企業・大規模自治体向けPublicプランの収益で持続可能性を保ち、最も支援が必要な地域には無償で届ける。小さな会社だからこそ、届けたい場所に届けられる。

### ミッション Scorecard（3つの循環の測定指標）

| 循環 | 指標 | 測定方法 | 目標（PoC期間） |
|------|------|---------|----------------|
| **子どもの好奇心** | 18歳未満ユーザーの月間投稿数 | ユーザー年齢層別集計 | 測定開始（ベースライン取得） |
| **子どもの好奇心** | 「初めて見た生き物」投稿率 | 投稿時の自己申告 | 測定開始 |
| **大人の健康** | パッシブセンシング利用者の月間歩行距離 | 端末側のGPS軌跡から算出（サーバー非送信） | 測定開始 |
| **大人の健康** | 「自然の中を歩く頻度が増えた」自己報告率 | 四半期アンケート | 測定開始 |
| **世代間交流** | 親子・グループでの同時観察イベント数 | 同一eventIDに複数recordedBy | 測定開始 |
| **地域への愛着** | 「地元の解像度が上がった」自己報告率 | 四半期アンケート | 測定開始 |
| **Enterprise価値** | Tier 3データ到達率 | Evidence Tier集計 | 初回Tier 3達成 |
| **Enterprise価値** | 顧客PoC参加企業の「使えそうか」評価 | ヒアリング（5段階） | 4以上/5 |
| **Enterprise価値** | TNFD/OECM開示レポートドラフト生成成功 | 成果物の有無 | 初回ドラフト完成 |
| **持続可能性** | reviewer capacity utilization | Appendix B7.4の計算式 | < 80% |
| **持続可能性** | Publicプラン見込み顧客数 | ヒアリング・問い合わせ数 | 3社以上のヒアリング完了 |

### 1つのコア基盤、2つの提供面

ikimon.lifeは「地域のためのプロダクト」と「企業向け監査基盤」の2つに見えるかもしれないが、**コア基盤は1つ**。

```
         ┌─────────────────────────────────────┐
         │     Canonical Schema + Evidence Tier  │
         │     + Validation Workbench            │
         │     （1つのコア基盤）                   │
         └──────────┬──────────┬────────────────┘
                    │          │
         ┌──────────▼──┐  ┌───▼──────────────┐
         │ Community面  │  │ Enterprise面      │
         │ 子ども・地域  │  │ OECM・TNFD・      │
         │ ウェルビーイング│  │ クレジット         │
         │ 無料/無償     │  │ 有料（Public）     │
         └─────────────┘  └──────────────────┘
```

趣味で写真を上げる人も、パッシブセンシングで歩く人も、企業の自然共生サイトを調査する人も、**全員が同じコア基盤にデータを蓄積する**。Community面で子どもや市民が楽しみながら貯めたデータが、Enterprise面の企業開示の根拠データにもなる。分離しているのは提供面（UI・課金・機能制限）であって、データとバリデーションの基盤は1つ。

### なぜ今これをやるのか（市場環境）

- 国連GBF（生物多様性枠組み）の365指標のうち51%が市民参加でデータ収集可能（Nature誌）。しかし現行のiNaturalist/eBirdは「能動的な撮影・投稿」前提で参加ハードルが高い
- ISSB BEES（生物多様性・生態系サービス開示基準）の公開草案が2026年10月COP17で発表予定。TNFDは2026年Q3に技術作業完了後ISSBへ移行。日本企業のTNFD早期開示は世界最多（180社）。現時点ではvoluntary adoptionだが、730超の組織（AUM 22兆ドル超）が既に採用
- **日本GX-ETS（排出量取引制度）が2026年4月に義務化開始。** 大手排出事業者が義務的に参加するカーボン市場が始動。J-Creditブルーカーボン方法論の開発も進行中（中部電力・三井住友海上）。カーボン＋生物多様性の複合クレジット需要が生まれ始めている
- 自然共生サイト（OECM）認定が累計485か所・10.5万ha（2025年12月末）。地域生物多様性増進法（2025年4月施行）に基づく認定が加速中
- 生物多様性クレジット市場はWEF予測で **基準シナリオ：2030年$2B/年、2050年$69B/年**。変革シナリオ（transformational）では2030年$7B、2050年$180B。現在は約$8M規模。MRV（測定・報告・検証）の信頼性が市場拡大の鍵 — ikimon.lifeのEvidence Tier＋Validation Workbenchはまさにこれを解く設計

**注意：** 上記の市場数字は基準シナリオと変革シナリオで大幅に異なる。TNFD開示も現時点ではvoluntary adoption。戦略はこの不確実性を前提に設計する。基準シナリオでも十分に大きな市場だが、変革シナリオを前提にはしない。

---

## 2. プロダクトビジョン：生物版デジタルツイン

カメラとマイクを起動しているだけで、周囲の生態系がデータ化される。「撮影」ではなく「常時センシング」。

車を運転しているだけで路上の植生がマッピングされ、調査推奨ポイントが自動で出る。散歩しているだけで鳥の声から種が推定される。ドローンを飛ばすだけで森林のキャノピーが解析される。これらが統合されて、ある地点の生態系が丸ごとデジタルツインとして再現される。

対象は全生物：植物、鳥、虫、哺乳類、爬虫類、魚、菌類…全domain。

### 2つのデータ戦略（どちらも同等に重要）

| 戦略 | 手段 | 特徴 | 役割 |
|------|------|------|------|
| **広く荒いデータ** | パッシブセンシング（カメラ・マイク流しっぱなし、ドローン、LiDAR等） | 面的・連続的 | 生態マッピングの基盤 |
| **ピンポイント精密データ** | 従来の投稿・同定機能、調査クエスト応答 | 個別・高精度 | 検証・裏付け・AI学習データ |

パッシブで広く拾い、個別投稿・クエストで深く確認する。active learningの循環として機能させる。

**加えて「偶発的な貢献」を設計に組み込む。** 趣味で何気なく上げた1枚の生き物写真が、その地域の初記録になることがある。意図的なスキャン（パッシブセンシング）でも、意図的な投稿（クエスト応答）でもない、**日常の延長線上にある「ついでの記録」こそがikimon.lifeの参加の原点**。このデータはTier 1として蓄積され、reviewer次第でTier 2以上に昇格する。参加の敷居を最も低くするのはこの経路。

---

## 3. ロードマップ

### Phase 1-3（現在進行中）：基盤構築
- セマンティック検索・知識グラフ（オモイカネ）で同定支援
- Gemini Embedding 2によるマルチモーダル検索
- ikimon.lifeの基本機能（投稿・同定・図鑑）

### Phase 4：スケール対応 ✅ 完了
- Xserver VPS移行済み（6コア / 12GB RAM / 400GB NVMe SSD / Ubuntu 24.04）

### Phase 5：100年インフラ化
- DwC-A（Darwin Core Archive）フォーマット標準化＋**DwC-DP（Darwin Core Data Package）への将来移行を設計段階から考慮**（GBIFが2026年にDwC-A→DwC-DPへのインフラ移行を主要テーマとして推進中）
- GBIF連携（国際標準データベースとの双方向連携）
- Canonical Schema（セクション5参照）の確定と実装
- 技術レイヤーは交換可能に設計。**不変であるべきなのは原則とprovenance（由来追跡）であって、schemaはversioning前提。** DwC-Aは外部相互運用層として使い、内側のwrite modelは`versioned canonical domain model + export adapter + migration policy`で進化させる。export adapterはDwC-A→DwC-DPの切り替えに対応できる設計にする

### Phase 6：パッシブ観察プラットフォーム（100年基盤の中核）
- ウェアラブル＋オンデバイスAIでパッシブ観察を実現
- **主目的は「誰でも・どこでも・歩くだけで、監査にも耐えうる品質の生物調査データが生まれる基盤」を作ること**
- Evidence Tier（セクション5参照）に基づいた品質管理
- デバイス非依存アーキテクチャ
- Validation Workbench（同定・合意形成・監査ログ）を独立コンポーネントとして育てる
- この基盤が完成すれば、OECM/TNFD向けサービス、学術利用、クレジット算出など、様々な出口が開ける。出口を先に決めるのではなく、基盤の品質を先に作り込む
- **ただし自然発生しないもの：** reviewer供給、顧客開拓、組織化は意図的に設計・育成が必要（セクション16参照）

### Phase 7：生物多様性クレジット ⚠️ 条件付きアップサイド
- **前提条件：** Phase 6のモニタリング基盤が実証済みであること、クレジット方法論が監査人に認められること、市場が十分に成熟していること
- 企業向けマネタイズ
- TNFD/ISSB開示対応
- ブルーカーボンクレジット＋生物多様性クレジットの算出基盤
- 貢献者への還元メカニズム（ikimonポイント）
- **リスク認識：** 市場規模はシナリオ依存（基準$69B、変革$180B/年@2050）。義務化時期は不確実。このPhaseは「到達すべきゴール」ではなく「条件が揃えば実現するアップサイド」として位置づける

**Phase 6の本質は「100年使える基盤を作り込むこと」。** その基盤の上に企業向けサービス（OECM/TNFD）やクレジット算出が自然に乗る。出口から逆算するのではなく、基盤の品質から積み上げる。ただし、開発を100年続けるための持続可能性（資金、コミュニティ）は並行して設計する。

---

## 4. パッシブセンシング詳細設計

### 4.1 センシング手段

| チャネル | 対象 | 技術候補 | 成熟度 |
|----------|------|----------|--------|
| カメラ（視覚） | 映像に映る動物（現時点では哺乳類・鳥類・爬虫類が主。植物・昆虫・菌類は将来拡張） | **Google SpeciesNet**（〜2,500種、カメラトラップ向け、哺乳類/鳥類/爬虫類中心、Apache 2.0）、iNaturalist LiteRT/CoreML（〜500taxa）、将来的にfine-tuned VLM / WildIng | SpeciesNet要検証。「全生物」には程遠い。段階的拡張が前提 |
| マイク（聴覚） | 鳥・虫・カエル等 | **BirdNET**（実績あり、Perchベクトル検索統合版あり） | 最も実証が進んでいる |
| LiDAR（3D空間） | 地形・植生構造 | Eagle LiDAR Scanner, Trimble X7 | ハードウェア手元にあり |
| GPS＋時刻＋気象 | 環境コンテキスト | デバイスセンサー＋気象API | 即時利用可能 |

**技術候補に関する正直な評価：**
- **NVIDIA（GTC 2026発表）：** Nemotron Nano VL 12Bは document intelligence色が強く英語中心、生物認識の直接の本命ではない。ただしNVIDIAはGTC 2026でオープンモデル群（Nemotron/Cosmos/Isaac GR00T/Clara）と10兆トークンの学習データ、100TBのセンサーデータを公開。特にCosmos Reason 2（物理世界の推論VLM）はパッシブ動画解析の基盤技術として中長期で注視。NVIDIAがオープンモデル＋エッジ推論を強力に推進する流れは、ikimonのビジョンにとって追い風
- **Google SpeciesNet（2025年3月〜オープンソース）：** 6,500万枚以上で学習した約2,500種の動物識別モデル。Apache 2.0ライセンス（商用可）。iNaturalist TFLiteの500 taxaに比べ5倍の種数。カメラトラップ画像向けだが、パッシブセンシングの写真/動画候補の自動種同定バックエンドとして検討価値が高い。愛管株式会社サイトでのPoC対象候補
- **iNaturalist公開モデル**は約500 taxaのsmall model。「全生物」には程遠い。SpeciesNetとの比較検証が必要。なおTFLiteの公式後継は**Google LiteRT**（2026年3月7日更新、GPU 1.4倍高速化、新NPUアクセラレーション）。Pixel 10 Proでの推論はLiteRT経由が最適
- **Gemini Embedding 2（ikimon.lifeで導入・運用中）：** テキスト検索は既に実装済み。2026年3月10日のPublic Previewでネイティブマルチモーダル対応（テキスト8,192トークン、画像6枚、動画120秒、**音声80秒**、PDF6ページ）が追加。5モダリティを単一の埋め込み空間にマッピング。レイテンシ最大70%削減。**今後のポテンシャル：** BirdNET音声出力＋カメラ画像＋観察テキストを1つのベクトルインデックスで横断検索できる。マルチモーダル活用の拡張はPoC後に検討（Appendix D「戦略強化」参照）
- **技術は交換可能に設計する：** 上記はすべて2026年3月時点の候補。5年後には全て入れ替わっている可能性がある。Canonical Schema（セクション5）が不変層であり、モデル層は最新のものに差し替える前提

### 4.2 デバイス非依存アーキテクチャ

| デバイス | 調査タイプ | 特徴 |
|----------|-----------|------|
| スマホ | 点〜線 | 最も手軽。参加の敷居が最も低い |
| ハンドヘルドLiDAR（Eagle） | 点〜面 | 3D点群＋8Kカラーを同時取得 |
| 車載カメラ | 線 | 道路沿いの植生マッピング |
| ドローン（リアルタイム含む） | 面 | 人が入れない場所 |
| 測量グレードスキャナー（Trimble X7） | 面（高精度） | 企業ユースケース |
| 固定カメラ | 定点 | 長期モニタリング |
| 水中ドローン（将来） | 水中 | 海洋・河川 |

### 4.3 処理アーキテクチャ

```
端末（オンデバイス）            サーバー（Xserver VPS）
┌───────────────────┐       ┌───────────────────────┐
│ 候補イベントの切り出し │       │ 非同期後処理            │
│ (raw media は上げない) │  ──→  │ Gemini API (画像解析)    │
│                     │       │ Embedding検索(テキスト主)  │
│ BirdNET (音声)       │       │ Validation Workbench    │
│ TFLite (画像候補)    │       │ DwC-A標準化・GBIF連携    │
└───────────────────┘       └───────────────────────┘
```

**Xserver 6コア/12GBでの制約認識：** raw音声/動画をサーバーに上げると処理が追いつかない。端末側で候補イベントだけを切り出し（タイムスタンプ、GPS、候補種名、確信度、サムネイル）、サーバーは非同期後処理に徹する設計。現行PHP/SQLiteはreview appとして維持し、continuous ingestの主系には別途キュー処理基盤が必要になる段階で再設計する。

---

## 5. Canonical Schema と Evidence Tier

### 5.1 Canonical Schema v0.1（5層構造）

**設計原則：** 内側のwrite modelはikimon独自のversioned domain modelとし、DwC-Aは外部export層として使う。schemaはversioning前提で進化させる。不変であるべきなのはprovenance（由来追跡）の原則。

#### Layer 1: Event（観測イベント）

| フィールド | 説明 | DwC-A export mapping | 必須 |
|-----------|------|---------------------|------|
| eventID | 観測イベントの一意識別子 | dwc:eventID | ✅ |
| parentEventID | 親イベント（デプロイメント/セッション単位） | dwc:parentEventID | ✅ |
| eventDate | ISO 8601タイムスタンプ | dwc:eventDate | ✅ |
| decimalLatitude / decimalLongitude | 座標 | dwc:decimalLatitude/Longitude | ✅ |
| coordinateUncertaintyInMeters | 座標の不確実性（デバイスGPS精度等） | dwc:coordinateUncertaintyInMeters | ✅ |
| samplingProtocol | 観測方法（passive-audio, passive-video, manual-photo, lidar-scan等） | dwc:samplingProtocol | ✅ |
| samplingEffort | 観測努力量（時間、距離、フレーム数等） | dwc:samplingEffort | ✅ |
| captureDevice | デバイス情報（機種、OS、センサー種別） | 独自拡張 | ✅ |
| recordedBy | 記録者（ユーザーID） | dwc:recordedBy | ✅ |
| license | データのライセンス（CC-BY, CC0等） | dcterms:license | ✅ |
| schemaVersion | スキーマバージョン（migration用） | 独自 | ✅ |

#### Layer 2: Occurrence（種の出現記録）

| フィールド | 説明 | DwC-A export mapping | 必須 |
|-----------|------|---------------------|------|
| occurrenceID | 出現記録の一意識別子 | dwc:occurrenceID | ✅ |
| eventID | 紐づくイベント | dwc:eventID (FK) | ✅ |
| scientificName | 学名 | dwc:scientificName | Tier 2以上 |
| taxonID | 分類群ID（GBIF taxon key等） | dwc:taxonID | Tier 2以上 |
| vernacularName | 和名 | dwc:vernacularName | |
| taxonRank | 分類階級（種・属・科等） | dwc:taxonRank | Tier 2以上 |
| basisOfRecord | MachineObservation / HumanObservation / MaterialSample | dwc:basisOfRecord | ✅ |
| occurrenceStatus | present / absent | dwc:occurrenceStatus | ✅ |
| individualCount | 個体数（推定含む） | dwc:individualCount | |

#### Layer 3: Evidence（証拠メディア）

| フィールド | 説明 | 必須 |
|-----------|------|------|
| evidenceID | エビデンスの一意識別子 | ✅ |
| occurrenceID | 紐づく出現記録 (FK) | ✅ |
| evidenceType | audio / image / video / lidar-pointcloud / dna-barcode | ✅ |
| mediaURL | メディアファイルへのリンク（端末ローカル or サーバー） | ✅ |
| mediaFormat | MIME type | ✅ |
| mediaHash | SHA-256ハッシュ（改竄検出） | ✅ |
| captureTimestamp | メディア取得時刻 | ✅ |

#### Layer 4: Identification（同定記録）

| フィールド | 説明 | 必須 |
|-----------|------|------|
| identificationID | 同定の一意識別子 | ✅ |
| occurrenceID | 紐づく出現記録 (FK) | ✅ |
| identifiedBy | 同定者（AI or ユーザーID） | ✅ |
| identificationDate | 同定日時 | ✅ |
| identificationConfidence | 確信度（0.0-1.0） | ✅ |
| identificationMethod | AI-auto / human-visual / human-acoustic / dna-barcode / literature | ✅ |
| identificationRemarks | 同定根拠の自由記述 | |
| identificationVerificationStatus | hypothesis / reviewed / validated / disputed | ✅ |
| previousIdentificationID | 再同定の場合、前回の同定ID | |
| auditLog | 変更履歴（いつ誰が何を変えたか） | ✅ |

#### Layer 5: PrivacyAccess（プライバシー・アクセス制御）

| フィールド | 説明 | 必須 |
|-----------|------|------|
| recordID | 対象レコード（event/occurrence/evidence）のID | ✅ |
| coordinatePrecision | 座標の丸め精度（希少種は自動で粗くする） | ✅ |
| dataGeneralizations | どの情報を一般化したか | |
| informationWithheld | 非公開情報の記述 | |
| personalDataFlag | 顔・声・車両ナンバー等の検出フラグ | ✅ |
| accessTier | public / researcher / admin | ✅ |
| legalBasis | 処理の法的根拠（APPI: consent / joint-use-27-5-3 / outsourcing-27-5-1 / academic-exception-18-3-5） | ✅ |
| retentionPeriod | データ保持期間（default: indefinite for scientific data, 3年 for raw personal data） | ✅ |
| deletionRequestStatus | 削除要求の状態（none / requested / processed / denied-scientific-exemption） | ✅ |
| lastAccessAudit | 最後のアクセス監査日時 | |

**DwC-A Export Adapter：** 内側のwrite modelからDwC-A形式にexportする変換層。Layer 1-4の必要フィールドをDwC-Aのevent core / occurrence extension / media extensionにマッピング。Layer 5はexport時にcoordinatePrecisionを適用して座標を丸める。

### 5.2 Evidence Tier（証拠の階層）

パッシブセンシングの粗いデータからクレジット算出の根拠まで、データの信頼性を4段階で管理する。

| Tier | 名称 | 品質 | 用途 | 必要条件 |
|------|------|------|------|---------|
| **Tier 1** | Hypothesis-grade | AI候補のみ、未レビュー | 内部解析、クエスト発行トリガー | AI確信度、GPS、タイムスタンプ |
| **Tier 2** | Review-grade | 1人以上の同定者がレビュー | 図鑑表示、市民科学データ | Tier 1 + 同定者1名の確認 |
| **Tier 3** | Disclosure-grade | 複数同定者の合意、監査ログ付き | TNFD開示、OECM申請、GBIFへの公開 | Tier 2 + 合意形成 + samplingEffort記録 + 監査ログ |
| **Tier 4** | Credit-grade | 第三者検証済み、方法論準拠 | 生物多様性クレジット算出根拠 | Tier 3 + ベースライン比較 + 外部監査 + chain-of-custody |

**Tierの昇格フロー：**
```
パッシブセンシング → Tier 1 (hypothesis)
    → 同定者レビュー → Tier 2 (review)
    → 合意形成＋監査ログ → Tier 3 (disclosure)
    → 外部監査＋方法論準拠 → Tier 4 (credit)
```

クエストシステムはTier 1→Tier 2への昇格を市民参加で加速させる仕組み。

---

## 6. 調査クエストシステム

AI認識の不確実性を「市民参加のトリガー」として活用する。

### 6.1 フィードバックループ

```
パッシブセンシング → Tier 1データ蓄積 → 不確実ポイント抽出
      ↑                                      ↓
  AI精度向上 ←── Tier 2データ ←── 市民がクエスト応答
```

### 6.2 クエスト発行条件

- AIの確信度が低い検出（Tier 1で停滞している候補）
- 珍しい種の可能性がある検出（希少種フラグ）
- データが足りないエリア・時間帯（samplingEffortの空白地帯）
- 季節的に重要な観察タイミング

### 6.3 ⚠️ 倫理設計（安全仕様）

**場所の安全性：**
- クエスト発行前に国交省 地理空間MCPで公共エリア判定を自動チェック
- 私有地・保護区・立入制限エリアにはクエストを出さない（ジオフェンシング）
- **核心原則：「すでにそこにいる人」に声をかける設計。わざわざ行かせない**

**具体的な安全仕様（v3.0で追加）：**

| リスク | 対策 |
|--------|------|
| 運転中の通知 | drive-mode lock：移動速度が一定以上の場合、クエスト通知を完全停止 |
| 希少種周辺への再訪誘発 | rare-species delay/fuzzing：希少種検出は位置を意図的にぼかし、時間差で公開。リアルタイム共有しない |
| 夜間の寄り道 | 日没後はクエスト発行を停止、または「翌日の通勤時に」と時間をずらす |
| 過度な通知 | cooldown：同一ユーザーへのクエスト発行に上限（例：1日3件まで） |
| 通勤ルート推定 | ルート情報はサーバーに保持しない。端末側でマッチングし、結果のみ送信 |
| 未成年利用 | 18歳未満はクエスト機能を無効化。パッシブセンシングの記録のみ |
| 保護区の季節的撹乱 | 繁殖期・渡り期の保護区にはバッファゾーン設定。クエストだけでなくパッシブの推奨ルートからも除外 |

**温度感：**
- 煽らない。「通りかかったついでに記録があると助かります」
- 行かなくても何も失わない。義務感を生まない
- 重要度が不明確なものは正直にそう表示する

---

## 7. 貢献の可視化とモチベーション設計

### 7.1 設計原則

- 内発的動機づけ重視（自己決定理論：自律性・有能感・関係性）
- 外発的報酬で釣らない。「自然を見る行為自体がウェルビーイング」
- 静かなコア体験（マイページの記録が積み上がる）と、地域/チーム単位の軽い協働導線は分けて設計する

### 7.2 自己効力感・集団効力感

AIで貢献フィードバック文を生成。事実ベース、過度に褒めない。

- **個人：**「あなたの記録でこのエリアのデータ空白が埋まりました」
- **集団：**「このエリアの12人の記録から季節変化パターンが見えてきました」
- **チーム導線（v3.0で追加）：** 個人のマイページは静かな蓄積。地域チーム（町内会、企業CSR、学校等）のダッシュボードでは協働の可視化。SNS的な外向き競争ではなく、内向きのチーム達成感

### 7.3 SNS設計方針

- SNS共有は「できるけど目立たない」
- マイページの記録が一番リッチな体験
- **規模拡大との両立：** SNS控えめ方針は品質には効くが規模拡大には弱い。地域/チーム単位の導線で「静かに広がる」設計にする。口コミとチーム招待が主要な成長チャネル

---

## 8. 貢献者還元メカニズム（ikimonポイント構想）

### 8.1 基本設計

| 項目 | 方針 |
|------|------|
| 名称 | ikimonポイント（仮称） |
| 性質 | サービス内ポイント（暗号資産ではない） |
| 獲得方法 | 全ての貢献に応じた情報価値ベースの配分 |
| 売買・譲渡 | 不可 |
| 将来の還元 | クレジット収益化時にポイント保有量に応じて還元（条件付き） |

### 8.2 ポイント設計の哲学

「全データに価値がある」と「同定者を最重視する」は矛盾しない。観察側に情報価値ベースの最低配分を置き、その上に同定・合意形成の倍率を載せる。

### 8.3 AI動的評価アルゴリズム

**同定に対する評価軸：**

| 評価軸 | 内容 |
|--------|------|
| 同定の難易度 | AI確信度が低い＝難しい同定ほど高評価。分類群ごとの難易度考慮 |
| 裏付けの充実度 | 写真の質・枚数、観察メモ、DNA情報の有無 |
| 希少性 | データが少ない種、初記録は最高評価 |
| 同定者の信頼度 | 過去の同定精度の実績（レピュテーションスコア） |
| 合意形成への貢献 | 意見が分かれた時に根拠を示して解決に導いた |

**観察・投稿に対する評価軸：**

| 評価軸 | 内容 |
|--------|------|
| 撮影の丁寧さ | 同定に必要な部位の網羅、ピント |
| 観察記録の質 | 生息環境の記述、行動の記録 |
| 追加調査の深さ | DNA解析、標本作成、文献調査 |

### 8.4 アルゴリズム運用体制

```
データ蓄積 → AIが評価傾向を分析 → パラメータ調整を提案
    → 運営（人間）が判断・承認 → アルゴリズム更新 → 変更ログ公開
```

**スケール対応（v3.0で追加）：**
- 月次のバージョニング（アルゴリズムのバージョンを明記）
- ベンチマークセット（固定の評価用データセットで回帰テスト）
- 変更ログの公開（ユーザーが「なぜポイントが変わったか」を理解できる）
- appealフロー（ユーザーがポイント評価に異議を申し立てる仕組み）

### 8.5 法務・税務上の注意

非譲渡ポイントでも、将来還元を示唆する時点で以下の論点が発生する：
- 景品表示法との関係（ポイント還元の上限）
- 税務上の取り扱い（還元時の所得区分）
- 労務上の論点（ボランティアか労働か）

→ Phase 7に近づいた段階で専門家に相談。現時点ではポイント蓄積のみで還元は約束しない設計にする。

### 8.6 ブロックチェーンの活用可能性

トークンの売買・譲渡はさせないが、「改竄不可能な貢献記録」として活用する選択肢はある。Phase 7の条件が揃った段階で判断。

---

## 9. クレジット算出基盤

### 9.1 対象クレジット

| クレジット | 市場規模 | ikimon.lifeの差別化 |
|-----------|---------|-------------------|
| ブルーカーボン | $20-30/tCO2e、年間発行1,000万トン未満 | カーボン吸収量＋生態系健全性の裏付け |
| 生物多様性 | 現在$8M、WEF基準シナリオ2030年$2B | 連続モニタリングデータによるベースライン比較 |

**差別化の正直な評価：** ブルーカーボンのプレミアムは「生物多様性データがある」だけでは乗らない。買い手と監査人が比較可能だと認める方法論が必要。Evidence Tier 4（Credit-grade）の達成が前提条件。

### 9.2 アーキテクチャ4層

| 層 | 機能 | Evidence Tierとの対応 |
|----|------|---------------------|
| データ取得層 | パッシブセンシング | Tier 1 (hypothesis) |
| データ標準化層 | DwC-A＋GBIF、同定者レビュー | Tier 2-3 (review/disclosure) |
| クレジット算出層 | 定量評価、ベースライン比較 | Tier 4 (credit) |
| 報告・開示層 | TNFD/ISSB、OECM、ブルーカーボン | Tier 3-4 |

### 9.3 ユースケース：企業の自然共生サイト（OECM）

例：**愛管株式会社**が自然共生サイト認定を取得・維持する際

- パッシブセンシングモードで敷地内を歩くだけで Tier 1データが蓄積
- Trimble X7で高精度3Dマッピング
- 同定者レビューを経てTier 2→Tier 3へ昇格
- 四季を通じた時系列データが揃い、TNFD開示に対応可能

---

## 10. 外部データソース連携

### 10.1 国交省 地理空間MCP Server（α版）

- 30種類の地理空間データを自然言語で取得可能
- クエスト安全フィルタ：公共エリア判定に活用
- GitHub: https://github.com/MLIT-DATA-PLATFORM/mlit-dpf-mcp

### 10.2 VIRTUAL SHIZUOKA（静岡県3D点群データ）

- 静岡県全域の3D点群データ、CC BY 4.0
- 静岡県をパイロットエリアとして実証→行政連携の足がかり

### 10.3 連携全体像

```
国交省MCP          → 土地区分の自動判定（安全フィルタ）
VIRTUAL SHIZUOKA   → 3D地形ベースマップ
Eagle / Trimble X7 → 独自3D点群データ
ikimonセンシング    → 生物データレイヤー（Canonical Schemaで記録）
GBIF               → 国際標準データベースとの双方向連携
```

---

## 11. 市場シナリオ分析

5つのシナリオを**確度順**に並べる。

| # | シナリオ | 時期 | 確度 | ikimonへの影響 |
|---|---------|------|------|--------------|
| 1 | 市民科学がGBFモニタリングの重要な補完になる | 2028-2032 | **高** | パッシブセンシングで参加ハードルが劇的に下がる |
| 2 | OECM/TNFD向けモニタリングSaaSとして企業に採用される | 2028-2032 | **高** | Phase 6の本命出口。Tier 3データの継続提供 |
| 3 | ブルーカーボン市場で「生態系健全性の裏付け」として差別化 | 2029-2033 | **中** | Tier 4到達が前提。方法論の確立が必要 |
| 4 | 都市計画・インフラの環境アセスメントがリアルタイム化 | 2032-2040 | **中** | 3D点群＋生物レイヤーの統合が鍵 |
| 5 | 「散歩経済」（歩くだけでクレジット還元） | 2035+ | **低** | Phase 7のフル実現が前提。最もリスクが高い |

**基盤を作り込めば、シナリオ1-4は自然に到達する。** 特定のシナリオに賭けるのではなく、どのシナリオが来ても対応できる基盤（Canonical Schema、Evidence Tier、Validation Workbench）を先に作る。シナリオ5は最もリスクが高いが、基盤が完成していれば挑戦可能。

---

## 12. 競争優位（Moat）の定義

iNaturalist/eBird/GBIFとデータ量で正面から勝負するのは不利。

**ikimon.lifeのMoatは4つ：**

| Moat | 内容 | なぜ真似しにくいか |
|------|------|-------------------|
| **High-trust Validation** ⭐ 最強 | Trusted reviewer network + Evidence Tier + 監査ログ付き合意形成 | 同定者コミュニティの信頼と実績は一朝一夕には作れない。これがデータの価値の源泉 |
| **Enterprise Reporting Workflow** | OECM/TNFD向けのデータ→開示レポートのワークフロー | 市民科学プラットフォームは研究者向け。企業向けレポーティングに対応しているものはほぼない |
| **Longitudinal Dataset** | 特定サイトの長期時系列データ | 他社が簡単に複製できない。時間をかけて蓄積するしかない |
| **Continuous Monitoring** （feature moat） | パッシブセンシングによる連続モニタリング | 機能自体は模倣可能。上3つと組み合わさることで防御力が生まれる |

**Moatの中心はValidation Workbench。** パッシブセンシング自体はfeature moatであり、iNaturalistやGoogleが真似できる。真に防御可能なのは「信頼されたreviewer network + audit trail + enterprise workflow」の統合。加えて、アンカーサイト（OECM/沿岸/都市）での12ヶ月以上のlongitudinal datasetは、後発が時間を短縮できない不可逆資産。

---

## 13. Assumption Ledger（前提条件の管理）

戦略の前提を「検証済み」と「未検証」に分離して管理する。

### 外部エビデンスあり（ikimonローカルでは未検証） 📚

| 前提 | 外部根拠 | ikimonでの検証状況 |
|------|---------|-------------------|
| DwC-A/GBIFは100年持つデータ標準 | 博物館標本の150年以上の実績。GBIFは2001年設立、政府間機構 | 未実装。export adapterの開発が必要 |
| BirdNETは鳥の音声同定に実用的精度 | 査読済み論文多数。700+種を90%以上の精度で同定。Perchベクトル検索統合版あり（2026年3月） | ikimon.lifeのサイトでの精度は未測定 |
| 企業のTNFD関連の開示ニーズは実在する | 730超の組織が自主採用、ISSB BEES基準2026年10月COP17発表予定。日本企業のTNFD早期開示世界最多（180社） | 愛管株式会社の実際のニーズは未ヒアリング |
| カメラトラップ＋音響の組み合わせは単独より検出率が高い | bioRxiv 2026年2月: 小型哺乳類の非侵襲モニタリングで実証 | ikimon.lifeでの検証は未実施 |
| eBird×iNaturalistのデータ統合は97%以上の種で合算可能 | Civic Science Media Lab実証 | マルチソースCanonical Schema統合の参考事例 |
| Google SpeciesNetは約2,500種の動物識別が可能 | 6,500万枚以上で学習、Apache 2.0、Google公式 | ikimon.lifeのサイトでの精度・日本種への適合性は未測定 |
| GX-ETS 2026年4月義務化で企業のカーボン＋生物多様性需要が増加 | 制度開始確定。J-Creditブルーカーボン方法論開発中 | ikimon.lifeの企業向け価値提案は未検証 |

### ローカル実証済み ✅

| 前提 | 根拠 |
|------|------|
| Xserver VPSで現行のreview appは動く | Phase 4完了済み。日常運用で確認 |
| Gemini Embedding 2でテキスト検索が実用的 | ikimon.lifeで実装・運用中 |

### 未検証・要実証 ⚠️

| 前提 | リスク | 検証方法 |
|------|--------|---------|
| スマホのパッシブセンシングで実用的な生物認識精度が出る | 現行オンデバイスモデルは500 taxa限定 | Pixel 10 Pro + BirdNET + TFLiteで1サイト実証 |
| 企業がOECM向けに月額課金でモニタリングSaaSを使う | 市場が存在するか未確認 | 愛管株式会社で1サイト・1季節のPoC |
| パッシブデータがTier 3（Disclosure-grade）まで昇格できる | 同定者のレビュー工数が足りるか | 1サイトのデータ量とレビュー工数を実測 |
| ブルーカーボンクレジットに「生態系健全性」のプレミアムが乗る | 買い手と監査人が方法論を認めるか | 既存の方法論（Verra VCS等）との適合性調査 |
| Xserver VPSでcontinuous ingestが処理できる | 端末候補イベント型でもスケール限界がある | 100ユーザー想定での負荷テスト |
| 市民が「静かな蓄積」だけで継続参加する | SNS的報酬なしで規模が出るか | 地域チーム導線でのリテンション測定 |

### 楽観的仮定（実現時期不明） 🔮

| 前提 | 依存条件 |
|------|---------|
| 生物多様性クレジット市場が$2B+/年に成長 | 各国の政策、方法論の標準化、買い手の需要 |
| TNFD/ISSB開示が主要国で義務化される | 各国の法制化、時期は不確実 |
| 「散歩経済」（散歩→データ→クレジット→還元）が成立 | Phase 7のフル実現＋クレジット市場の成熟 |

---

## 14. Unit Economics（概算）

### 14.1 コスト構造の見積もり

| 項目 | 単位コスト | 備考 |
|------|----------|------|
| Xserver VPS | ¥5,000-10,000/月 | 現行プラン |
| Gemini API | 従量課金 | テキスト埋め込み$0.20/MTok |
| ストレージ（サムネイル＋メタデータ） | 400GB NVMe内 | raw mediaは端末に残す設計 |
| 同定者のレビュー工数 | 0円（ボランティア） | ← 最大のリスク要因。供給能力の試算はセクション14.4参照 |

### 14.2 収益モデル（Phase 6以降）

| 収益源 | 対象 | 価格帯 | 確度 |
|--------|------|--------|------|
| OECM/TNFDモニタリングSaaS | 企業 | 月額課金（要検証） | 中〜高 |
| データライセンス | 研究機関・コンサル | 従量課金 | 中 |
| クレジット算出手数料 | クレジット発行者 | 成功報酬 | 低（Phase 7） |

### 14.3 1 validated recordあたりのコスト

まだ測定できていない。最初の実証（Appendix C参照）で以下を測定する：
- 1観測時間あたりのTier 1イベント数
- Tier 1→Tier 2への昇格率と所要時間
- 1件のTier 2 recordあたりの同定者工数
- Xserver VPSの処理コスト/record

### 14.4 供給能力の定義（site-month / reviewer-hour）

「何自治体まで支えられるか」ではなく、**何site-month / reviewer-hour まで支えられるか**で供給能力を定義する。

**1 site-month** = 1サイトで1ヶ月間のモニタリング運用（パッシブセンシング＋レビュー＋データ管理）

**供給変数の仮推定（PoC前。実証後に更新）：**

| 変数 | 仮値 | 根拠 |
|------|------|------|
| 1 site-monthあたりのTier 1生成量 | 500-2,000件/月 | BirdNET: 10件/時間 × 週2回 × 2時間 × 4週 = 160件（音響のみ）。写真含めると×3-10倍 |
| Tier 1.5自動昇格率 | 40-60% | BirdNET ≥ 0.9の割合（環境依存） |
| reviewer 1人の月間処理能力 | 300-600件 | 3分/record × 1日30分 × 20日 = 200件（控えめ）〜600件（積極的） |
| 1 site-monthの必要reviewer数 | 1-3人 | 生成量500件、昇格率50%で250件要レビュー。reviewer 1人300件/月なら1人で足りる |
| Xserver VPSのcapacity | 50-100 site-months | CPU/ストレージ制約。event-only ingestで軽量 |
| サポート工数（運営） | 2-5時間/site-month | FAQ対応、reviewer管理、データ品質チェック |

**無償提供の上限試算：**

| 前提 | 値 |
|------|-----|
| Active reviewer 10名 | 3,000-6,000件/月の処理能力 |
| VPS capacity | 50-100 site-months |
| 運営工数（八巻1人） | 月40-80時間（フルコミット時） |
| **ボトルネック** | **reviewer throughput**（VPSやサポートより先に詰まる） |
| **無償提供の持続可能上限** | **10-20 site-months**（reviewer 10名前提。超える場合はreviewer増員が必要） |

→ PoCで実測値を取り、この仮推定を更新する。Publicプランの最低単価は、上記のコスト構造から逆算。

---

## 15. プライバシー・データガバナンス設計

### 15.1 個人情報の取り扱い（record設計）

| データ種別 | リスク | 対策 |
|-----------|--------|------|
| 位置情報（常時取得） | 行動パターンの推定 | 端末側で候補イベントのみ抽出。通勤ルート等の生データはサーバーに送信しない |
| 車載映像 | ナンバープレート、歩行者の顔 | 端末側で候補フレームのみ切り出し。人物・車両は自動マスキング |
| 音声データ | 会話の録音 | 端末側でBirdNET等の推論のみ実行。raw音声はサーバーに送信しない |
| 希少種の位置 | 密猟・採集リスク | 座標のfuzzing（自動ぼかし）。時間差公開。研究者のみ正確な位置にアクセス可能 |
| 未成年の利用 | 位置情報の取得 | 保護者の同意必須。クエスト機能は無効化。パッシブ記録のみ |

### 15.2 データガバナンス（APPI準拠の設計）

**基本方針：** ikimon.lifeは私企業であり、単独では「学術研究機関等」（APPI第16条第8項）に該当しない。したがって**学術例外には原則として依拠せず、同意ベースで運用する**。大学・博物館との共同研究の場合のみ、共同研究の範囲で学術例外（第18条第3項第5号、第27条第1項第5号等）を主張可能。

**APPIにおけるデータフローの整理：**

| フロー | APPI上の整理 | 根拠条文 | 対応 |
|--------|-------------|---------|------|
| ユーザー→ikimon.life（投稿・パッシブ） | 本人同意に基づく取得 | 第17条（利用目的の特定）、第21条（通知） | 利用規約で利用目的を明示し、同意を取得 |
| ikimon.life→Xserver VPS | **委託**（第三者提供に該当しない） | 第27条第5項第1号 | Xserverへの安全管理措置の監督義務（第25条） |
| ikimon.life→Gemini API | **委託**（テキストメタデータのみ。raw個人情報は含まない） | 第27条第5項第1号 | Googleのデータ処理契約に基づく。送信データに個人データが含まれない設計 |
| ikimon.life→GBIF | 座標丸め＋recordedBy匿名化により**非個人データ**に加工した上で提供 | 個人データではないためAPPI第27条の制限対象外。**「匿名加工情報」（第2条第6項）の厳格な加工基準は適用しない。「非個人データへの加工」として整理** |
| ikimon.life↔企業（OECM実証） | **共同利用** | 第27条第5項第3号 | 共同利用する旨、項目、範囲、目的、責任者を本人に通知。個別契約で定義 |
| ikimon.life↔大学（共同研究） | **共同利用**＋学術例外の部分適用 | 第27条第5項第3号＋第18条第3項第5号 | 共同利用の枠組み。学術例外は大学側の処理にのみ適用 |

**サーバー上の位置情報の扱い：** 候補イベントのGPS座標はrecordedBy・時刻と結合するため、**サーバー上では個人データとして扱う**（「個人関連情報」に留まるとする甘い解釈は取らない）。coordinateUncertaintyInMetersで精度を記録し、PrivacyAccess Layerで管理。

| 項目 | 方針 |
|------|------|
| **保持期間** | Tier 2以上のoccurrence/identification：無期限保持。raw個人データ（端末側の位置ログ等）：3年で自動削除。メタデータは匿名化して保持 |
| **削除権（利用停止等請求：第35条）** | ユーザーは自身のデータの利用停止・削除を請求可能。Tier 1-2は速やかに対応。Tier 3以上は匿名化（recordedByを匿名IDに置換）して科学データとしての価値を保持。完全削除が法的に求められる場合は個別対応。**法務レビューで第35条の拒否要件を確認要** |
| **研究者への精密座標アクセス** | 研究者登録＋利用目的申請＋アクセスログ監査の3条件。PrivacyAccess LayerのaccessTier=researcher |
| **監査ログ** | 精密座標アクセスは全件記録。四半期監査 |
| **国外移転（第28条）** | GBIFへのexportは非個人データ（座標丸め＋匿名化済み）。APPI第28条の制限対象外。Gemini APIへの送信は委託として整理（テキストメタデータのみ） |

**→ 詳細はAppendix A参照。**

### 15.3 データ所有権

| データ種別 | 所有権 | ライセンス |
|-----------|--------|-----------|
| ユーザーが投稿したraw media | ユーザーに帰属 | 投稿時にCC-BY 4.0でikimon.lifeに利用許諾（変更可能） |
| AI生成の候補イベント（Tier 1） | ikimon.lifeに帰属 | 派生データとして |
| 同定結果（Identification Layer） | 同定者に帰属 | CC-BY 4.0でikimon.lifeに利用許諾 |
| 集計・統計データ | ikimon.lifeに帰属 | オープンデータ（CC0推奨） |
| embeddingベクトル | ikimon.lifeに帰属 | API利用規約に準拠 |
| 企業OECM実証データ | 企業とikimon.lifeの共同利用 | 個別契約で定義 |

### 15.4 地域住民との関係

- 調査エリアの地域住民への事前説明・理解促進
- 地域の利益配分の考慮（特に企業のOECMデータ利用時）
- 伝統的知識の扱い（先住民の知識をデータに含める場合のプロトコル）

---

## 16. 運営体制・持続可能性

### 16.1 現状

- 創業者（八巻毅）が開発・運営を兼任
- 愛管株式会社との連携（Trimble X7、OECM実証の場）

### 16.2 Reviewer供給問題（最大のリスク要因）

レビュー工数が0円（ボランティア）は認識しているが、まだ解いていない。これがPhase 6の成否を決める。

**Tier 1→2のreviewer throughput** がボトルネックになる。パッシブセンシングで大量のTier 1データが生成されても、同定者がいなければTier 2に上がらない。

**具体的な供給戦略：**

| 段階 | 施策 | 期待効果 |
|------|------|---------|
| 即時 | BirdNET等のAI確信度が高い候補は自動でTier 1.5（semi-validated）に。人間レビューの対象を絞る | reviewer工数を50%以上削減 |
| 短期 | 分類群ごとのエキスパート招待。地域の自然観察会、博物館、大学の分類学研究室との連携 | 専門性の高いreviewer確保 |
| 中期 | Trusted Reviewer制度：レピュテーションスコアの高いreviewerの同定は自動でTier 2に昇格。dispute時のみ複数reviewer | throughput改善 |
| 中期 | ikimonポイントによる同定者への報酬（将来の還元） | インセンティブ |
| 長期 | reviewer育成プログラム。初心者→中級→エキスパートの段階的育成 | 持続的な供給 |

**実証で測定すべき指標：**
- 1サイトの1日あたりTier 1イベント数
- reviewer 1人が1時間で処理できるTier 1→2レビュー件数
- 必要なactive reviewer数 = Tier 1生成レート ÷ reviewer処理レート

### 16.3 創業者依存リスクの軽減

| 段階 | 施策 |
|------|------|
| 短期 | CLAUDE.md＋戦略ドキュメントで意思決定の根拠を文書化。AIエージェント（Codex等）でも開発継続可能に |
| 中期 | 同定者コミュニティの自律運営（モデレーター制度）。Trusted Reviewer制度の運用 |
| 長期 | 科学アドバイザリーボード（分類学者、生態学者）の設置。法人化 |

---

## 17. 次にやるべきこと（最優先アクション）

### 即座に（2026年3月〜4月）

1. **BirdNET音響firstの1サイト実証を、成功条件つきで回す**
   - 場所：愛管株式会社の自然共生サイト候補地
   - チャネル：BirdNET（音響）＋写真/短尺動画＋人間レビュー
   - **測定項目（精度ではなくオペレーション指標を先に）：**
     - 1時間あたりTier 1イベント数
     - Tier 1→Tier 2昇格率と所要時間
     - reviewer 1人あたりの分/record
     - Xserver VPSの保存量と負荷
   - **成功条件：** reviewer工数が持続可能な範囲でTier 2が生成できること
   - Pixel 10 Pro（3/24到着）で即開始

2. **Canonical Schema v0.1の5層を実装する**
   - 既存のikimon.lifeの投稿データにeventID / occurrenceID / samplingProtocol / basisOfRecord / licenseを追加
   - DwC-A export adapterのプロトタイプ
   - schemaVersionフィールドでmigration対応

3. **Reviewer供給とPrivacy governanceを同時に設計する**
   - Trusted Reviewer制度の初期設計（レピュテーションスコア、権限レベル）
   - 精密座標のアクセス制御（研究者登録、利用目的申請、監査ログ）
   - データ保持期間・削除フローの決定
   - → これがそのままmoatと持続可能性の核になる

### 中期的に（2026年Q2〜Q3）

4. **OECM/TNFDモニタリングSaaSのプロトタイプ**
   - 愛管株式会社をパイロット顧客として、Tier 3データ→TNFD開示レポートのワークフロー

5. **Assumption Ledgerの検証結果を反映して戦略を更新**

---

## 18. インフラ・技術スタック

### 18.1 サーバー環境

| サービス | 用途 | スペック |
|----------|------|---------|
| **Xserver VPS** | ikimon.life 本番 | 6コア / 12GB RAM / 400GB NVMe SSD / Ubuntu 24.04 / IP: 162.43.44.131 |
| **カゴヤ** | ikan.nexchat.cloud | Matterport＋RAG、Gemini Embedding 2開発環境 |

### 18.2 現行アプリケーション基盤

- PHP 8.2, Alpine.js, SQLite
- Gemini API, Gemini Embedding 2（テキスト検索で運用中。マルチモーダル埋め込み（音声・画像・動画）の活用はPoC後に検討。→Appendix D「戦略強化」参照）
- デプロイ: git push
- リポジトリ: `C:\Users\YAMAKI\ikimon\ikimon.life`

### 18.3 所有デバイス・機材

**モバイル**

| デバイス | チップ | ステータス | 用途 |
|----------|--------|-----------|------|
| Pixel 10 Pro | Tensor G6 NPU | 2026-03-24到着 | Android側テスト |
| iPhone 13 Pro | A15 Bionic Neural Engine | 既所有 | iOS側テスト |

**3Dスキャナー**

| 機材 | 所有 | スペック | 用途 |
|------|------|---------|------|
| 3DMakerpro Eagle LiDAR Scanner | 個人所有 | 最大70m、20万点/秒、8K HDR、PLY出力 | カジュアル3Dスキャン |
| Trimble X7 | 愛管株式会社 | 50万点/秒、3mm精度、最大80m | 企業実証 |

---

## 19. 100年設計の原則

1. **不変であるべきはprovenance（由来追跡）の原則であって、schemaではない**：schema自体はversioning前提で進化させる。DwC-Aは外部相互運用層。内側は`versioned domain model + export adapter + migration policy`
2. **技術レイヤーは交換可能に設計**：モデルは世代交代する前提。Canonical Schemaのversioning + export adapterで互換性を維持
3. **Canonical Schema 5層を基盤にする**：Event / Occurrence / Evidence / Identification / PrivacyAccess
4. **データガバナンスを早期に確定する**：所有権、ライセンス、保持期間、削除権、研究者アクセス条件、監査ログ（セクション15.2-15.3参照）
5. **オープンデータ原則**：科学的価値を担保し、エコシステムを育てる。ただし希少種の位置情報やプライバシーデータは例外（PrivacyAccess Layerで制御）

---

## 20. 関連プロジェクト

| プロジェクト | URL | サーバー | 概要 |
|-------------|-----|---------|------|
| ikimon.life | https://ikimon.life | Xserver VPS | みんなでつくる生き物図鑑（メイン） |
| ikan.nexchat.cloud | https://ikan.nexchat.cloud | カゴヤ | Matterport＋RAG、Gemini Embedding 2開発環境 |

---

## 21. 参考リンク

| リソース | URL |
|----------|-----|
| WEF 生物多様性クレジット（原報） | https://www.weforum.org/publications/biodiversity-credits-demand-drivers-and-guidance-on-early-use/ |
| TNFD / ISSB 自然関連開示 | https://tnfd.global/issb-decision-on-nature-related-standard-setting-drawing-on-tnfd-framework/ |
| Nature - 市民科学×GBF指標 | https://www.nature.com/articles/s41893-024-01447-y |
| GBIF Camera Trap Best Practice | https://docs.gbif.org/camera-trap-guide/en/ |
| GBIF Sampling Event Data | https://ipt.gbif.org/manual/en/ipt/latest/best-practices-sampling-event-data |
| 国交省 地理空間MCP Server | https://github.com/MLIT-DATA-PLATFORM/mlit-dpf-mcp |
| VIRTUAL SHIZUOKA 点群データ | https://www.geospatial.jp/ckan/dataset/virtual-shizuoka-mw |
| iNaturalist 公開モデル | https://github.com/inaturalist/model-files |
| Google SpeciesNet（〜2,500種、Apache 2.0） | https://blog.google/company-news/outreach-and-initiatives/sustainability/speciesnet-open-source-ai-wildlife/ |
| Google LiteRT（TFLite後継） | https://developers.googleblog.com/litert-the-universal-framework-on-device-ai/ |
| WildIng（地理的ドメインシフト対応VLM） | https://www.arxiv.org/pdf/2601.00993 |
| SmartWilds（マルチモーダル環境データセット） | https://www.sciencedirect.com/science/article/pii/S1574954124003571 |
| BirdNET（Perchベクトル検索統合版） | https://github.com/birdnet-team |
| NVIDIA Nemotron Models | https://developer.nvidia.com/nemotron |
| Gemini Embedding 2（マルチモーダル、Public Preview 2026/3/10） | https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-embedding-2/ |
| GBIF 2026 Work Programme（DwC-DP移行） | https://docs.gbif.org/2026-work-programme/en/ |
| GX-ETS（日本排出量取引制度 2026/4義務化） | https://carboncredits.com/2026-could-redefine-voluntary-and-compliance-carbon-market-convergence-with-japan-leading-the-way/ |
| ISSB BEES基準（2026/10 COP17） | https://www.ey.com/ja_jp/insights/climate-change-sustainability-services/issb-tnfd-ssbj-biodiversity-and-ecosystem |
| 自然共生サイト（OECM）認定状況 | https://www.env.go.jp/press/press_01965.html |
| 日本ASEANブルーカーボンイニシアティブ | https://carbon-pulse.com/400493/ |
| カメラトラップ＋音響モニタリング相補性研究 | https://www.biorxiv.org/content/10.64898/2026.02.24.707730v1.full |
| eBird×iNaturalistデータ統合実証 | https://civicsciencemedia.org/merging-data-from-inaturalist-and-ebird-is-it-possible-these-scientists-say-yes/ |
| ブルーカーボン市場動向 | https://e360.yale.edu/features/why-the-market-for-blue-carbon-credits-may-be-poised-to-take-off |

---

## 更新履歴

| 日付 | バージョン | 内容 |
|------|-----------|------|
| 2026-03-21 | v1.0 | 初版作成 |
| 2026-03-21 | v1.1 | サーバー情報修正、所有機材追加 |
| 2026-03-21 | v2.0 | ポイント設計、市場シナリオ追加 |
| 2026-03-21 | v3.0 | 初回レビュー(C評価)反映＋創業者フィードバック反映。Evidence Tier、Canonical Schema 3層、Assumption Ledger等を新設 |
| 2026-03-21 | v3.1 | 2回目レビュー(B評価)反映。Canonical Schema 5層化、Privacy governance拡張、Reviewer供給戦略、Moat修正、Assumption Ledger精緻化 |
| 2026-03-21 | v3.2 | ミッション刷新＋別紙3本新設 |
| 2026-03-21 | v3.3 | 4回目レビュー反映。APPI全面改稿、コア基盤図、偶発的貢献、供給能力定義、PoC 2段階化 |
| 2026-03-21 | v3.4 | テックニュースダイジェスト反映。SpeciesNet、Gemini Embedding 2最新仕様、LiteRT、BirdNET Perch、DwC-DP、GX-ETS、ISSB BEES等を統合 |
| 2026-03-21 | v3.5 | Appendix D新設、Reviewer Runbook、ミッションScorecard、744自治体段階的展開 |
| 2026-03-21 | v3.6 | v3.5レビュー対応。条文修正、GBIF整理統一、Gemini矛盾解消、SpeciesNet表現修正、整合性ノイズ解消 |
| 2026-03-21 | v3.7 | 6回目レビュー対応。法務条文の再整理、Gemini記述の現状化、v3.6懸念の解消を試みた版 |
| 2026-03-21 | v3.8 | Codex改善版。Appendix Aの条文ラベルをAPPI定義条文ベースに修正（位置情報: 第2条第1項 / 第16条第3項 / 第2条第7項）。APPI本文内のGDPR補助整理をノイズ化しない文章に圧縮。顧客PoCの意思決定者を役割ベースで確定条件付きに修正し、ヒアリング成果物に担当者名・評価・導入条件・次アクションを追加。S評価必須アクションの成果物を reviewer処理能力・担当者特定まで具体化 |
