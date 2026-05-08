# ikimon.life Monitoring Current State and Requirements

作成日: 2026-05-05  
目的: 今後の ikimon.life 開発時に、現在地・外部動向・必要機能を参照するためのメモ  
対象範囲: `ikimon-internal` の既存設計資料、`platform_v2` のコード断面、BioMonWeek 2026 の 2026-05-05 時点公開情報、釣りアプリ/遊漁データ動向

## 0. 結論

ikimon.life は、単なる生きもの投稿サービスや釣りSNSではなく、**地域の生物多様性モニタリングを、観察者・学校・自治体・企業・専門家が共有できる「観察パッケージ基盤」**として設計すべき段階に入っている。

BioMonWeek 2026 の流れを見る限り、国際的な関心は「AIで名前を当てる」よりも、以下へ寄っている。

- 観察データを、努力量・不在・調査方法・位置精度・証拠・同定履歴つきで扱うこと
- GBIF / OBIS / Darwin Core / eDNA metadata / WorkFlowHub / data cubes などへ接続できるデータ構造にすること
- EBV / EOV / 政策実装 / Nature Restoration / private sector monitoring に耐える集計単位を作ること
- 希少種・釣り場・地域資源を守るため、公開粒度と内部粒度を分けること

ikimon.life の現状は、すでにこの方向へ進む土台が多い。一方で、水辺・釣果・遊漁・ゼロキャッチ・CPUE・GBIF/OBIS実運用・データキューブは未完成または未接続である。

最初に作るべきは大きな新画面ではない。まず **観察パッケージの JSON 契約と、水辺/釣果レコード拡張 v0** を定義し、既存の `visits` / `occurrences` / `civic_observation_contexts` / `observation_package` に無理なく載せることが重要。

## 1. 現在地

### 1.1 プロダクト位置づけ

既存資料では、ikimon.life は次の方向で整理されている。

- 「今日の発見体験」と「10年単位の場所モニタリング」を両立する
- 種名だけでなく、証拠・努力量・場所状態・時系列を扱う
- AI同定アプリではなく、観察の質を上げる OS として振る舞う
- 企業向けには TNFD / LEAP / nature positive 文脈へ接続するが、過剰な改善主張はしない
- 新規開発は legacy PHP 画面への差し込みではなく、JSON契約 / TypeScript-friendly schema / runtime境界から設計する

これは BioMonWeek 2026 の方向とかなり近い。

### 1.2 platform_v2 で確認できた土台

`E:\Projects\03_ikimon.life_Product\platform_v2` のコード断面から見た状態。

| 領域 | 現状 | 判定 |
|---|---|---|
| visit / occurrence | `visits`, `occurrences` に調査モード、努力量、位置、同定、個体数、証拠ティア等がある | 土台あり |
| 努力量 | `effort_minutes`, `distance_meters`, `complete_checklist_flag`, `target_taxa_scope` がある | 土台あり |
| 不在記録 | イベントライブ側に `absence_confirm` と `observation_event_absences` がある | 部分あり |
| イベント観察 | discovery / effort_maximize / bingo / absence_confirm / ai_quest のモードがある | 土台あり |
| civic context | `civic_observation_contexts` の migration / service があり、活動目的、参加者役割、公開粒度、リスクレーン、レポート同意を持てる | 土台あり |
| 位置情報保護 | sensitive species masking と civic context の public precision がある | 土台あり |
| 観察パッケージ | `ObservationPackage` v1 に visit / occurrences / evidence / identifications / AI runs / feedback / review state がある | 部分あり |
| AIフィードバック | evidence tier、claim refs、feedback payload の設計がある | 部分あり |
| review / quality | `observation_quality_reviews` と review state の概念がある | 土台あり |
| passive audio | BirdNET-Go / TinyML 系の passive audio ingest ledger がある | 土台あり |
| area resolution | `resolved_field_ids` や site/field 系の解決がある | 土台あり |
| relationship score | Access / Engagement / Learning / Stewardship / Evidence の補助指標がある | 土台あり |
| Darwin Core | 既存仕様に mapping と export 方針がある | 設計あり |

### 1.3 まだ足りないもの

現状の大きな不足は以下。

| 不足 | 意味 |
|---|---|
| 水辺/釣果レコードの明示スキーマ | 釣った、見た、死骸、リリース、持ち帰り、釣れなかった、を区別できない |
| CPUEに必要な項目 | 釣行時間、人数、釣法、道具、対象魚、ゼロキャッチが構造化されていない |
| 水域単位の公開粒度 | メッシュ、流域、水域、港湾、河川区間などへ丸める設計が未確定 |
| 気象・潮汐・水温・水位 | 水辺記録と環境条件の自動紐づけが未確定 |
| GBIF / OBIS export の実運用 | Darwin Core 仕様はあるが、公開・検証・ライセンス・秘匿情報処理まで未確認 |
| data cube / derived indicator | 場所別・季節別・努力量補正済みの集計単位が未確定 |
| 専門家/管理者レビューの運用 | 役割、キュー、承認、差し戻し、公開範囲変更が未確定 |
| private sector monitoring readiness | 企業が「何が足りないか」を見る設計が未確定 |

## 2. BioMonWeek 2026 から読むべきこと

### 2.1 今日までに明示されている流れ

BioMonWeek 2026 は、2026-05-04 から 2026-05-08 にモンペリエで開催される初回の Biodiversity Monitoring Week。400人超の参加が示され、欧州の生物多様性モニタリングのニーズ、優先順位、標準化、データ基盤を扱う場になっている。

公式テーマは大きく以下。

- Terrestrial Monitoring
- Marine Monitoring
- Freshwater Monitoring
- Data Management for Monitoring
- Mass Monitoring
- Public Policy and Funding for Monitoring
- Monitoring Governance
- Monitoring and the Private Sector
- Capacity Building in Monitoring

2026-05-05 時点で特に重要なのは、OBIS / GBIF / eDNA / EBV / EOV / data workflows が同じ場で扱われていること。

2026-05-05 の主な明示セッション:

- GBIF と OBIS への並行データ公開
- survey / monitoring data の標準化と共有
- eDNA-based methods の導入
- EBV / EOV の理解と、観察・評価・意思決定への接続
- eDNA reference libraries と metadata publishing infrastructure

これは ikimon.life にとって、**観察記録をただ蓄積するだけでは不十分で、後から標準化・検証・公開・指標化できる単位で保存する必要がある**という示唆になる。

### 2.2 明日以降のプログラムから見えること

2026-05-06 以降の公開プログラムでは、以下が確認できる。

- Tools for data use, curation, management
- WorkFlowHub Data Workflows and Pipelines
- FAIR data への障壁と EU monitoring projects の整理
- derived data products and outputs for EBVs / EOVs
- eDNA survey data publication, management, interoperability
- mobilizing marine biodiversity monitoring data
- Nature Restoration Regulation や policy implementation に関わる monitoring needs
- private sector monitoring と business needs への接続

### 2.3 推測: おそらくこういうことだろう

ここから高確度に読める方向性は次の通り。

1. **主戦場はUIではなく、データ運用である**

BioMonWeek の中心は「観察アプリをどう魅力的にするか」ではなく、「多様な観測手段から来るデータを、どう標準化・品質管理・再利用・政策接続するか」である。ikimon.life も、フィードや投稿体験だけを磨くより先に、観察パッケージ、データ品質、公開粒度、export contract を固めるべき。

2. **eDNA / 音声 / カメラ / 衛星は、同じ観察体系に入ってくる**

将来は人間の写真投稿だけではなく、eDNA、passive acoustic recorder、camera-based sensor、remote sensing が混ざる。ikimon.life の記録モデルは「人が1匹見つけた」だけに固定せず、survey event / evidence asset / method / detection / non-detection を分ける必要がある。

3. **GBIF / OBIS への接続は、最後の出力ではなく最初の設計制約である**

後から export を作るのでは遅い。発生時点で、eventID、occurrenceID、basisOfRecord、eventDate、locationID、coordinateUncertaintyInMeters、occurrenceStatus、samplingProtocol、samplingEffort、identificationQualifier、license、dataGeneralizations、informationWithheld に相当する情報を欠損しにくい形で持つ必要がある。

4. **企業向けは「きれいなレポート」より「モニタリング準備度」が重要になる**

private sector monitoring は、企業が都合よく自然価値を主張するためではなく、事業時間軸と生態系モニタリング時間軸をどう合わせるかが焦点になるはず。ikimon.life の企業機能は、点数化よりも「データの穴」「継続性」「場所解像度」「証拠レベル」「公開可能性」を見せるべき。

5. **市民科学は、投稿数よりも継続・役割・信頼の設計が勝つ**

BioMonWeek の governance / capacity building の流れから見ると、単発投稿よりも、学校、地域団体、企業、専門家、自治体が役割を分担し、継続観察できる仕組みが必要。ikimon.life の `civic_observation_contexts` はこの方向に合っている。

## 3. 釣りアプリ/遊漁データ動向から読むべきこと

### 3.1 大きな流れ

釣りアプリは、「釣れる場所を探すSNS」から「釣果ビッグデータ / 資源管理 / 市民科学の入口」へ寄っている。

| 動向 | 内容 | ikimon.life への示唆 |
|---|---|---|
| 釣果ビッグデータ化 | ANGLERS、Fishbrain などが大規模釣果記録を持つ | 釣果は観測データになり得る |
| AI自動記録 | 魚種判別、サイズ推定、気象・潮汐の自動紐づけ | 入力負荷を下げるほどデータが集まる |
| 資源管理連携 | 水産庁の遊漁採捕量報告、クロマグロ報告 | 行政側にもニーズがある |
| 場所秘匿 | 釣り場荒れ、混雑、乱獲、希少種リスク | 公開粒度設計が必須 |
| 市民科学化 | 保護種、タグ調査、外来種拡散、移動ネットワーク | 水辺の生物多様性リスク把握に接続できる |

### 3.2 ikimon.life が釣りSNSと競合してはいけない理由

ANGLERS や Fishbrain と同じ「釣れる場所を探す」価値で戦うと、ユーザー数、投稿密度、釣りコミュニティ、地図検索体験で不利になる。

ikimon.life の勝ち筋は別にある。

> 釣果情報を含む、水辺の生物多様性モニタリング基盤

つまり、釣り人SNSではなく、自然観察・環境教育・行政連携・外来種把握・地域の水辺記録に寄せる。

### 3.3 釣果データの扱いで守るべきこと

釣果データは価値が高いが、単独では資源量推定に使いにくい。アプリ利用者は自発参加であり、若い、熟練、釣果率が高いなどの偏りが出る。釣れた記録は「出現」や「季節性」には強いが、「地域全体で増えた/減った」の断定には弱い。

したがって、ikimon.life では次を原則にする。

- 釣果は observation の一種として扱う
- 釣れなかった記録も扱う
- 努力量、人数、釣法、対象魚、リリース/持ち帰りを持つ
- 位置は内部では精密、公開はメッシュ/水域/流域/自治体単位に丸める
- 希少種、外来種、混雑しやすい場所は公開粒度をさらに落とす
- 資源量推定ではなく、まず出現記録、季節変化、外来種・希少種の早期発見、地域教育から始める

## 4. 分類群/観測ベクトルのMECE整理

釣果・魚類は重要だが、モニタリング基盤として見ると魚だけに寄せるのは危ない。分類群ごとに「盛り上がっているコミュニティ」「観測手法」「必要メタデータ」「ikimon.life での入口」が違う。

ここでは、分類群コミュニティと観測ベクトルを分けて整理する。

### 4.1 分類群コミュニティ別

| 分類群/コミュニティ | 代表的な盛り上がり | 強い観測データ | 必要メタデータ | ikimon.life での解釈 |
|---|---|---|---|---|
| 鳥 | eBird、Merlin、BirdNET、Christmas Bird Count、Breeding Bird Survey | チェックリスト、音声、努力量、移動/季節性 | 観察時間、距離、全種リスト、音声、繁殖/渡り、検出/非検出 | 最も「努力量つき市民科学」が成熟。ikimon も checklist / route / audio を学ぶべき |
| 植物 | Pl@ntNet、Flora Incognita、Nature's Notebook、地域植物誌 | 写真、開花/結実、分布、外来/在来、フェノロジー | 野生/植栽、生活史段階、開花/結実、個体/群落、管理地情報 | 場所の長期変化と企業敷地に強い。phenophase と cultivated flag が必要 |
| 菌類/きのこ/地衣類 | FunDiS、Mushroom Observer、菌類同好会、標本庫 | 写真、発生時期、宿主/基質、標本、DNA/バーコード | 傘裏、柄、基質、採集可否、標本番号、DNA、食毒注意 | 写真同定だけでは危険。voucher / expert review / no edible advice が必須 |
| 送粉昆虫/チョウ/ハチ | UK PoMS、European Butterfly Monitoring Scheme、Bumble Bee Watch | トランセクト、定時カウント、訪花関係、季節変動 | 調査時間、天気、花種、訪花、距離、カウント方法 | 農地/庭/学校/企業緑地との相性が高い。Timed count が重要 |
| 両生類/爬虫類 | FrogID、HerpMapper、地域自然史コミュニティ | 鳴き声、繁殖地、道路横断/ロードキル、湿地分布 | 音声、天気、時刻、水辺状態、繁殖行動、位置秘匿 | 希少種・採集圧リスクが高い。公開粒度と音声 evidence が重要 |
| 哺乳類 | Wildlife Insights、camera trap network、足跡/糞/ロードキル調査 | カメラトラップ、痕跡、活動時間、占有 | camera deployment、trap nights、設置位置、検出/非検出、空撮影 | センサー努力量が本体。event/evidence モデルが必要 |
| コウモリ/音響生物 | NABat、BatAMP、音響モニタリング、BirdNET系 | 超音波/音声、活動時間、通過頻度 | detector、周波数、設置時間、天候、モデル信頼度 | passive audio の extension と相性が良い |
| 魚類/水辺生物 | ANGLERS、Fishbrain、MyCatch、水産庁遊漁報告、Reef Life Survey | 釣果、目視、水中調査、eDNA、移動ネットワーク | 努力量、人数、釣法、水域、リリース/持ち帰り、水温/潮汐 | 釣りSNSではなく、水辺モニタリングとして扱う |
| 淡水底生生物/水質 | FreshWater Watch、Riverfly系、学校/市民水質調査 | 水質、底生動物、簡易指標、流域状態 | 採水方法、試薬、流速、水温、採集努力量、同定粒度 | 生物多様性と環境教育をつなげやすい |
| 海岸/磯/サンゴ/海藻 | Reef Life Survey、OBIS、地域磯観察、ダイバー調査 | トランセクト、水中写真、サンゴ/藻場、魚類/無脊椎 | 潜水時間、水深、潮、透明度、ライン長、写真範囲 | marine extension と OBIS 準備が必要 |
| 外来種/病害虫 | EDDMapS、iMapInvasives、行政早期発見網 | 早期発見、分布拡大、防除履歴 | 確認者、被害状況、個体数/面積、防除、再確認 | taxon横断の risk lane。投稿後の管理者キューが重要 |
| 全分類群ナチュラリスト | iNaturalist、Observation.org、GBIF | 出現記録、写真、コミュニティ同定、bioblitz | 位置、日付、写真、同定履歴、ライセンス、品質グレード | ikimon の汎用観察UXの比較対象。専門モニタリングには追加文脈が必要 |

### 4.2 観測ベクトル別

分類群よりも、実装上は観測ベクトルで切った方が設計しやすい。

| 観測ベクトル | 主な分類群 | モニタリング上の強み | 必須データ | ikimon.life の実装単位 |
|---|---|---|---|---|
| Opportunistic photo | 全分類群 | 参加ハードルが低い、出現記録が集まる | 写真、日時、位置、同定履歴、公開粒度 | 現行 observation の基本 |
| Complete checklist | 鳥、植物、昆虫、魚 | 努力量と不在を扱える | 時間、距離、全種/対象種、未検出 | `visit_mode=survey` の強化 |
| Timed count / transect | 送粉昆虫、チョウ、植物、磯 | 比較可能性が高い | 時間、距離、天気、調査幅、対象分類群 | `sampling_protocol` extension |
| Acoustic recording | 鳥、カエル、コウモリ、昆虫 | 夜間/非接触/連続観測に強い | 録音、機器、時間、モデル、信頼度 | passive audio / evidence asset |
| Camera trap | 哺乳類、鳥、一部爬虫類 | 人がいない時間帯の占有/活動を取れる | 設置期間、trap nights、機種、空撮影 | sensor deployment event |
| Catch / capture | 魚、昆虫、小型哺乳類 | サイズ、個体数、採捕圧が取れる | 許可、努力量、方法、リリース/持ち帰り | water/capture extension |
| Specimen / voucher | 菌類、植物、昆虫、微小分類群 | 同定信頼性が高い、再検証できる | 標本番号、保管先、採集許可、DNA | voucher extension |
| eDNA / sample | 水辺、土壌、海洋 | 見えない生物を検出できる | 採水/採土、フィルター、primer、解析系、陰性対照 | sample event / lab result |
| Remote sensing / fixed photo | 植生、湿地、藻場、景観 | 面的変化と時系列に強い | 撮影点、方角、解像度、日時、解析方法 | site condition / landscape snapshot |
| Management action log | 外来種、防除、企業緑地、里山 | 観察と行動を結びつける | 作業内容、面積、実施者、前後比較 | stewardship action |

### 4.3 ikimon.life の設計方針

分類群ごとに別アプリを作るのではなく、共通コアと分類群/手法 extension に分ける。

共通コア:

- `visit`
- `occurrence`
- `evidence_asset`
- `identification_history`
- `civic_observation_context`
- `privacy_access`
- `review_state`
- `report_output`

extension 候補:

| extension | 対象 | 主な追加項目 |
|---|---|---|
| `bird_checklist_extension` | 鳥 | complete checklist、route、duration、heard/seen、breeding code、audio |
| `plant_phenology_extension` | 植物 | wild/cultivated、phenophase、flower/fruit、coverage、management context |
| `fungi_voucher_extension` | 菌類/地衣類 | substrate、host、spore/underside photo、voucher、DNA、toxicity disclaimer |
| `pollinator_count_extension` | 送粉昆虫 | timed count、flower association、weather、transect |
| `herp_audio_extension` | 両爬 | call recording、breeding site、weather、roadkill、sensitive location |
| `camera_trap_extension` | 哺乳類/鳥 | deployment、trap nights、blank images、AI model、sequence |
| `water_record_extension` | 魚/水辺 | catch/no-catch、effort、method、release/kept、水域、潮汐/水温 |
| `sample_edna_extension` | eDNA | sample method、primer、lab、positive/negative、metadata |
| `invasive_response_extension` | 外来種 | priority、extent、treatment、revisit、manager review |

この形にすると、魚と同じ解像度で鳥・植物・菌類・昆虫・両爬・哺乳類を扱える。重要なのは、最初から全部を実装することではなく、**共通コアを壊さずに分類群別 extension を足せる契約にすること**。

### 4.4 優先順位の読み

日本の ikimon.life 文脈では、最初に強いのは次の順。

| 優先 | 理由 |
|---|---|
| 鳥 | 観察人口、音声、季節性、チェックリスト文化が強く、モニタリング手法が成熟 |
| 植物 | 企業敷地、学校、地域緑地、フェノロジー、外来種管理に直結 |
| 昆虫/送粉者 | 農地、庭、都市緑地、自然共生サイトと相性が高い |
| 菌類 | 競合が少なく面白いが、同定難度と食毒リスクが高い |
| 両爬 | 水辺・湿地の健全性に強いが、位置秘匿が重要 |
| 魚/水辺 | 遊漁データとして有望だが、釣り場保護と採捕圧に注意 |
| 哺乳類/カメラトラップ | 企業/自治体案件に強いが、センサー運用が必要 |

したがって、魚だけを深掘りするのではなく、次の開発判断では **bird / plant / pollinator / fungi / water** を同じ粒度で extension 仕様候補に並べるべき。

### 4.5 まだ弱い横断論点

分類群のMECEだけでは足りない。実際にモニタリング基盤として立ち上げるには、分類群を横断する次の論点が必要。

| 論点 | 漏れると起きること | ikimon.life で押さえること |
|---|---|---|
| 国内制度/既存基盤 | BioMonWeek / 海外事例だけに寄り、日本の受け皿とズレる | いきものログ、モニタリングサイト1000、JBIF、S-Net、自然共生サイト、環境省レッドリストを接続先/比較対象に入れる |
| 分類体系/名前解決 | 和名、学名、シノニム、分類変更でデータが割れる | taxon authority、taxon concept、和名履歴、GBIF/JBIF/S-Net ID、ローカル名を分ける |
| 統計的妥当性 | 投稿数の増減を生物の増減と誤読する | effort、non-detection、sampling protocol、detectability、observer bias を保存する |
| データ権利/ライセンス | 外部公開や企業利用で同意違反になる | record consent、media license、research use、commercial report use、withdrawal を分ける |
| 子ども/学校利用 | 教育利用で個人情報や位置情報が漏れる | minor-safe mode、学校/クラス単位、先生承認、公開粒度固定 |
| 採集/捕獲/標本の法務 | 保護種、私有地、採集許可、動物福祉で事故る | permit flag、collection allowed、handling method、release status、protected species warning |
| 食毒/危険生物 | きのこ、毒草、毒虫で危険な助言を出す | no edible advice、safety disclaimer、expert review required、危険種アラート |
| 外来種/病害虫対応 | 投稿だけで終わり、早期発見から対応へつながらない | invasive response queue、管理者通知、防除/再確認ログ、公開注意 |
| レビュアー運用 | 専門家確認が詰まり、信頼性が上がらない | taxon/area別 reviewer role、review queue、confidence、差し戻し、疲弊防止 |
| 参加継続/コミュニティ | 初回投稿は増えても、3か月後に残らない | 地域ミッション、再訪問、学校/企業/同好会単位、成果フィードバック |
| AIガバナンス | AI同定やAI解説が過剰確信になる | model version、confidence、failure mode、human-in-loop、分類群別評価 |
| 悪用対策 | 希少種採集、釣り場荒れ、スクレイピングが起きる | rate limit、public precision、sensitive embargo、trusted access、audit log |
| 運営モデル | 誰がレビュー/保守/外部連携コストを払うか不明になる | B2B report、自治体/学校プラン、研究連携、専門家謝礼の設計 |

この表は、今のMDで最も補強が必要な部分。魚・鳥・植物の extension 以前に、共通コアへ **consent / license / authority / review / safety / abuse prevention** を入れる必要がある。

### 4.6 国内連携先ごとの棲み分け

国内連携は、「どこに全部寄せるか」ではなく、データライフサイクル上の役割を分けて考える。

結論として、ikimon.life は国のデータベースや研究インフラの代替を狙わない。現場の観察、学校・企業・地域活動、証拠メディア、同意、秘匿、再訪問、レポートを束ねて、必要に応じて国内基盤へ渡せる **観察パッケージ生成レイヤー** になるのが自然。

| 主体 | 主な役割 | ikimon.life が担うべき接点 | 任せすぎてはいけないこと |
|---|---|---|---|
| ikimon.life | 現場入力、参加継続、証拠メディア、観察文脈、公開粒度、企業/学校/地域レポート | observation package、extension、consent、public precision、review queue、monitoring readiness | 国の公式アーカイブ、分類体系の最終権威、認定機関、研究統計の最終判断 |
| いきものログ | 環境省が運用する、生きもの情報の収集・提供システム。国・地方公共団体・専門家・市民・団体が利用でき、市民参加型調査にも使える | ikimon 側で整理済みの記録を、将来「報告可能な形」にする。個人/団体観察会の成果を標準項目で出せるようにする | ikimon独自の企業レポート、細かなUX、秘匿ロジック、AIフィードバックを丸投げすること |
| モニタリングサイト1000 | 全国約1000サイトで長期的に自然環境の質的・量的変化を把握する国の長期モニタリング | プロトコル、調査分類、長期比較の考え方を参照する。ikimon の学校/企業/地域調査を「正式調査風」に寄せすぎず、比較可能性を上げる | ikimon の一般投稿をモニ1000相当の長期調査データだと扱うこと |
| JBIF | 日本の生物多様性情報をGBIF等を通じて世界へ発信し、データ公開・利活用・Darwin Core 等を支援する基盤 | reviewed / license-clean / privacy-processed な dataset を将来公開する出口。Darwin Core、metadata、quality check の参照先 | 生データ投稿アプリ、地域コミュニティ運営、専門家レビュー業務の代替 |
| S-Net | 全国の博物館・大学・研究機関が所蔵する自然史標本とデータセットの検索・公開基盤 | voucher / specimen がある菌類・植物・昆虫などで、標本番号や所蔵機関へのリンクを持つ | 写真だけの市民観察をS-Net向け標本データとして扱うこと |
| 自然共生サイト / 30by30 | 民間等の取組により生物多様性保全が図られている区域を認定/制度化する枠組み。増進活動実施計画、モニタリング手法、実施状況報告と接続 | 企業・学校・地域の site report、monitoring readiness、活動ログ、再訪問、証拠整理を支援する | 認定可否の判断、制度申請の保証、保全効果の過剰主張 |
| 研究者 | 調査設計、統計、分類群レビュー、eDNA/音響/カメラ等の専門手法、論文化 | protocol design、review role、分析用 export、匿名化/秘匿済みデータ提供、共同研究 | 日常運用、全投稿レビュー、ユーザー体験設計、同意管理の丸投げ |
| 自治体 | 地域の自然環境政策、環境教育、外来種対応、公園/河川/学校/市民団体連携、地域レッドリスト | 地域ダッシュボード、外来種/希少種 queue、観察会、学校利用、地域施策への報告 | 全国標準化、GBIF公開、専門同定、企業の自然共生サイト申請代行 |

#### データライフサイクルで見た責任分担

| ライフサイクル | 主担当 | ikimon.life の設計要件 |
|---|---|---|
| 1. 現場で記録する | ikimon.life、学校、企業、市民団体、自治体 | モバイル投稿、写真/音声/動画、簡易入力、分類群別 extension |
| 2. 文脈を付ける | ikimon.life | civic context、site/field、活動目的、参加者役割、努力量、再訪問 |
| 3. 同意と秘匿を決める | ikimon.life、投稿者、管理者 | consent、license、public precision、risk lane、minor-safe mode |
| 4. 同定/レビューする | 専門家、研究者、自治体、信頼ユーザー | reviewer role、taxon/area queue、confidence、差し戻し |
| 5. 標準化する | ikimon.life、JBIF、研究者 | Darwin Core mapping、taxon authority、metadata、quality flags |
| 6. 外部公開する | JBIF/GBIF、いきものログ、必要に応じて行政/研究基盤 | reviewed dataset、withheld/generalized fields、license-clean export |
| 7. 標本と結びつける | 博物館、大学、S-Net、研究者 | voucher ID、所蔵機関、specimen link、DNA/バーコード |
| 8. サイト評価に使う | 自然共生サイト申請者、企業、自治体、専門家 | monitoring readiness、data gap、活動ログ、実施状況報告素材 |
| 9. 政策/管理行動に使う | 自治体、環境省、管理者、企業 | invasive response、rare species notice、防除/再確認、施策ログ |
| 10. 長期傾向を評価する | 研究者、行政、専門家 | effort補正、non-detection、protocol consistency、bias注記 |

#### ikimon.life の実務ポジション

ikimon.life は、国内連携先に対して次の立ち位置を取るのが安全。

- いきものログに対して: 競合ではなく、地域活動/企業/学校で生まれた記録を「報告しやすく整理する前処理レイヤー」
- JBIFに対して: 生データを直接投げるのではなく、ライセンス・秘匿・品質を処理した公開候補データセットの作成元
- S-Netに対して: 標本や voucher がある記録だけを接続する。写真観察全体の受け皿とは見なさない
- 自然共生サイトに対して: 認定の代替ではなく、申請/実施状況報告/モニタリング計画の証拠整理を支える
- 研究者に対して: protocol と review と analysis の協力者として扱い、日常運用を押し付けない
- 自治体に対して: 外来種・希少種・学校教育・地域イベント・公園/河川管理に使える、公開粒度調整済みの地域ビューを出す

#### 設計上の含意

この棲み分けから、P0 の共通コアに入れるべき項目が増える。

| 項目 | 理由 |
|---|---|
| `external_reporting_intent` | いきものログ、自治体、研究、企業レポートなど出口を分ける |
| `dataset_license` / `media_license` | JBIF/GBIF や研究利用に必要 |
| `data_generalizations` | 位置や日時を丸めた理由を export に残す |
| `information_withheld` | 希少種、私有地、釣り場、子ども情報などを秘匿した事実を残す |
| `taxon_authority_ref` | JBIF/GBIF/S-Net/環境省レッドリストとの名前解決 |
| `voucher_ref` | S-Net/博物館/大学標本との接続 |
| `site_policy_context` | 自然共生サイト、自治体計画、企業敷地などの文脈 |
| `review_scope` | taxon / area / institution ごとにレビュー責任を切る |
| `handoff_status` | 外部提出候補、提出済み、非公開、研究利用のみ等 |

## 5. ikimon.life に必要な機能

### 5.1 必須機能一覧

| 優先 | 機能 | 必要な理由 | 現状 | 次に必要な設計 |
|---|---|---|---|---|
| P0 | Observation Package 契約 | BioMonWeek 的な data reuse の最小単位 | `ObservationPackage` v1 はあるが claimRefs / reportOutputs が未接続 | JSON schema と versioning を固定 |
| P0 | Civic / Monitoring Context | 誰が、何の目的で、どの公開範囲で観察したかが必要 | migration / service あり | 投稿・イベント・レポートで一貫表示 |
| P0 | 努力量 | CPUE、調査比較、不在記録に必須 | `visits.effort_minutes` 等あり | manual / survey / event の扱いを整理 |
| P0 | 不在/ゼロ記録 | 「見つからなかった」がないと偏り補正できない | event absence はある | 通常記録、水辺記録、釣果記録にも拡張 |
| P0 | 公開粒度制御 | 希少種、釣り場、私有地、企業敷地を守る | sensitive masking あり | 水域/流域/メッシュ/自治体単位を追加 |
| P0 | consent / license | 外部公開、研究利用、企業レポート利用の境界を守る | 未整理 | record consent、media license、use scope を分離 |
| P0 | taxon authority | 分類変更・和名揺れ・外部ID連携に耐える | 未整理 | taxon concept / name usage / external IDs を分ける |
| P0 | safety / legal flags | きのこ食毒、採集許可、保護種、子ども利用で事故を防ぐ | 未整理 | dangerous advice block、permit flag、minor-safe mode |
| P0 | reviewer operations | 専門家確認を現実に回す | review foundation あり | taxon/area別 reviewer role と queue |
| P1 | 水辺/釣果レコード拡張 | 釣り・魚類・水辺観察を構造化する | 明示スキーマなし | `water_record_extension_v0` を作る |
| P1 | 鳥 checklist 拡張 | 努力量つきモニタリングの成熟例 | 未整理 | complete checklist、route、duration、heard/seen |
| P1 | 植物 phenology 拡張 | 企業敷地、学校、自然共生サイトに強い | 未整理 | wild/cultivated、flower/fruit、coverage |
| P1 | 菌類 voucher 拡張 | 同定難度と食毒リスクを扱う | 未整理 | substrate、voucher、DNA、no edible advice |
| P1 | 送粉昆虫 count 拡張 | 農地/都市緑地/企業緑地の指標になりやすい | 未整理 | timed count、flower association、weather |
| P1 | リリース/持ち帰り | 採捕圧の把握に必要 | 未確認 | occurrence または extension に追加 |
| P1 | 釣法/人数/対象魚 | 努力量の意味を決める | 未確認 | trip / effort model を追加 |
| P1 | 環境条件自動紐づけ | 潮汐、水温、水位、天気で解釈が変わる | 未確定 | provider 境界と snapshot schema |
| P1 | Data quality / review queue | 専門家・管理者レビューで信頼性を上げる | review foundation あり | ロール、キュー、公開判定を設計 |
| P1 | Darwin Core / GBIF export | 外部連携の入口 | 仕様あり | exporter、秘匿処理、license、QA |
| P1 | 国内基盤 federation | 日本の受け皿とズレないため | 未整理 | いきものログ/JBIF/S-Net/自然共生サイトとの役割整理 |
| P2 | OBIS / marine export | 海洋・沿岸データを扱うなら必要 | 未実装 | marine metadata と WoRMS alignment |
| P2 | Data cube / 指標 | 場所・季節・努力量別に見るため | 未確定 | occurrence cube / site cube / effort cube |
| P2 | Monitoring Readiness | 企業・自治体が現在地を把握するため | relationship score あり | 点数より gap / confidence 表示 |
| P3 | eDNA ingest | BioMonWeek の主要論点 | 未実装 | method / sample / sequence result を別管理 |
| P3 | camera / acoustic / remote sensing | Mass monitoring への対応 | passive audio ledger あり | evidence method の一般化 |
| P3 | WorkFlowHub / reproducible workflow | FAIR運用の再現性 | 未実装 | export pipeline の記録 |

### 5.2 水辺/釣果レコード拡張 v0

まずは大きく作らず、既存 `visit` と `occurrence` にぶら下がる extension として考える。

候補フィールド:

| フィールド | 意味 |
|---|---|
| `encounter_type` | `observed`, `caught`, `dead`, `trace`, `market_excluded`, `unknown` |
| `water_context` | `river`, `lake`, `pond`, `estuary`, `coast`, `port`, `canal`, `rice_field`, `wetland`, `unknown` |
| `catch_outcome` | `caught`, `released`, `kept`, `lost`, `no_catch`, `observed_only` |
| `target_taxon` | 狙っていた魚種または分類群 |
| `fishing_effort_minutes` | 釣行時間 |
| `angler_count` | 人数 |
| `fishing_method` | 餌釣り、ルアー、フライ、網ではない等 |
| `gear_summary` | 道具の簡易分類 |
| `individual_count` | 匹数 |
| `size_value_cm` | サイズ |
| `size_estimation_method` | 目測、メジャー、AR推定、写真推定 |
| `release_status` | `released_alive`, `released_dead`, `kept`, `unknown` |
| `waterbody_id` | 水域ID |
| `public_waterbody_label` | 公開用の丸めた水域名 |
| `privacy_rule_applied` | 適用した秘匿ルール |

注意点:

- `occurrences.occurrence_status = absent` だけでは「釣れなかった」を十分に表せない。釣りの場合は「対象魚を狙ったが釣れなかった」「何も釣れなかった」「観察はしたが採捕していない」を分ける必要がある。
- `visit.effort_minutes` と `fishing_effort_minutes` は重複し得るため、v0 では `visit` が全体、extension が釣り努力量という整理にする。
- 公開画面では正確な地点を見せず、水域/流域/メッシュに丸める。

### 5.3 位置情報の扱い

ikimon.life では、位置情報を三層で扱うべき。

| 層 | 内容 | 用途 |
|---|---|---|
| Private exact | 緯度経度、端末取得、撮影位置 | 内部解析、本人履歴、許可された専門家レビュー |
| Protected analysis | メッシュ、水域、流域、site/field | レポート、研究、行政連携、企業管理 |
| Public display | 自治体、広域メッシュ、ぼかし水域 | 一般公開、SNS的表示、外部共有 |

釣果と希少種は、本人が公開を選んでも exact public を許さない設計が安全。

## 6. レポート/企業向けに必要な見せ方

企業や自治体向けには、「自然が良くなった」と簡単に言わないことが重要。

代わりに以下を見せる。

| 表示 | 意味 |
|---|---|
| Monitoring Readiness | その場所でモニタリングとして使える記録がどれくらい揃っているか |
| Evidence Coverage | 写真、音声、専門家レビュー、AI補助、再訪問の有無 |
| Effort Coverage | 努力量、不在記録、季節カバー、調査方法の一貫性 |
| Data Gap | 足りない季節、分類群、場所、証拠、レビュー |
| Risk Flags | 希少種、外来種、公開注意、採捕圧、利用者集中 |
| Export Readiness | Darwin Core / GBIF / OBIS / 行政提出に出せるか |

これは既存の relationship score を否定しない。relationship score は人と場所の関わりを見る補助指標として維持し、モニタリング品質とは分ける。

## 7. ロードマップ

### P0: まず契約を固める

- `observation_package_v1` の必須/任意フィールドを明文化する
- `water_record_extension_v0` を定義する
- `public_precision` と `risk_lane` のルールを水辺/釣果にも適用する
- absence / zero record を通常記録にも広げる設計を作る

### P1: UIに最小反映する

- 投稿時に「見た / 釣った / 死骸 / 痕跡 / 釣れなかった」を選べるようにする
- 釣果時だけ、努力量、人数、釣法、リリース/持ち帰りを聞く
- 表示では exact location を出さず、公開粒度を明示する
- 観察詳細に「モニタリング文脈」と「公開粒度」を表示する

### P2: レポートと export を作る

- site / event / school / company 用の monitoring readiness を作る
- Darwin Core CSV export の最小版を作る
- sensitive / withheld / generalized fields を export に含める
- data quality review のキューを作る

### P3: BioMonWeek 系の標準化へ接続する

- GBIF IPT / OBIS / WoRMS / eDNA metadata への接続を検討する
- WorkFlowHub 的に、集計・export・QA の再現手順を保存する
- passive audio / camera / eDNA を同じ observation package に入れる
- data cube を作り、EBV/EOV へ接続できる集計単位を準備する

## 8. 過剰主張を避けるガードレール

ikimon.life は次を言わない。

- アプリ投稿だけで地域の資源量が増減したと断定する
- 釣果件数の増減だけで魚が増えた/減ったと断定する
- AI同定だけで専門家確認済みと扱う
- 希少種や釣り場の正確な位置を一般公開する
- 企業活動により生物多様性が改善したと、証拠不足のまま表現する
- GBIF / OBIS 連携を、export / license / QA / withheld 情報処理なしに完了扱いする

代わりに次の表現を使う。

- 「この場所では、観察記録の継続性が高まっている」
- 「この分類群/季節/エリアは記録が不足している」
- 「この記録は、出現記録として利用できる可能性がある」
- 「この地点は公開粒度を下げて扱う」
- 「現時点では傾向判断ではなく、早期発見・教育・記録蓄積として扱う」

## 9. 開発時の判断基準

迷ったら次で判断する。

1. この変更は observation package に情報を残すか
2. 後から努力量・不在・公開粒度・証拠ティアを説明できるか
3. 希少種、釣り場、私有地、企業敷地を守れるか
4. Darwin Core / GBIF / OBIS 的な外部利用に近づくか
5. 「自然が良くなった」と言いすぎない構造になっているか
6. 参加者が継続しやすく、専門家がレビューしやすいか

## 10. ユーザー行動モードと果たすべき役割

ikimon.life のユーザー行動は、まず次の5モードで捉える。

| モード | ひとことで言うと | 主な成果物 |
|---|---|---|
| 画像投稿 | 単一観察の証拠化 | 写真つき occurrence candidate |
| 動画投稿 | 行動・時間変化・環境を含む証拠化 | 動画 evidence、key frame、行動/環境メモ |
| 同定 | 記録の名前・分類階層・信頼度を更新する | identification history、review state、再撮影/追加証拠依頼 |
| ガイド機能での調査 | プロトコルに沿った観察 | effort、checklist、absence、route/site、recap |
| フィールドスキャン | その場所の状態を短時間で把握する | site snapshot、scan footprint、環境/リスク/候補観察 |

重要なのは、5モードを「投稿UIの種類」として扱わないこと。各モードは、観察パッケージ内で果たすべき責任を持つ。役割は重複してよい。むしろ、重複しないと monitoring data として弱い。

### 10.1 役割カタログ

| ID | 役割 | 内容 | 失敗すると起きること |
|---|---|---|---|
| R01 | 証拠取得 | 写真、動画、音声、key frame、メモを残す | レビュー不能、外部公開不能、AI推定だけになる |
| R02 | 同定支援 | AI候補、観察者仮説、専門家レビューを分離して残す | AI同定を確定扱いし、誤同定が混ざる |
| R03 | 観察文脈 | 誰が、いつ、どこで、何の目的で記録したか | 後で比較、集計、説明ができない |
| R04 | 努力量 | 時間、距離、人数、方法、対象分類群を残す | 増減や比較を語れない |
| R05 | 不在/未検出 | 探したが見つからなかった、釣れなかった、検出されなかったを残す | 出現記録だけに偏り、モニタリングにならない |
| R06 | 個体数/量/サイズ | 個体数、被度、サイズ、面積、密度の手がかり | 指標化や採捕圧把握ができない |
| R07 | 行動/生活史/フェノロジー | 鳴き声、採餌、繁殖、開花、結実、発生段階 | 季節変化や生態的意味を落とす |
| R08 | 生息環境/場所状態 | 水辺、植生、基質、管理状態、攪乱、周辺環境 | 種だけの記録になり、場所改善に使えない |
| R09 | 空間カバー | 点、ルート、範囲、スキャン footprint、site/field を残す | どの範囲を見たか不明になる |
| R10 | 環境条件 | 天気、気温、水温、水位、潮汐、風、照度など | 検出差の理由を解釈できない |
| R11 | 秘匿/安全 | 希少種、釣り場、私有地、子ども、危険生物を守る | 乱獲、採集、炎上、個人情報事故につながる |
| R12 | レビュー可能性 | 追加角度、key frame、音声、標本、メタデータを揃える | 専門家が判断できず、未確定で止まる |
| R13 | 学習/能力形成 | ガイド、再撮影指示、観察ポイント、振り返り | 投稿者が成長せず、データ品質が上がらない |
| R14 | 再訪問/時系列 | 同じ場所、同じ方法、同じ季節で比較できる | 長期変化が見えない |
| R15 | プロトコル遵守 | 調査手順、対象、時間、終了条件を満たす | 調査データとして使えない |
| R16 | レポート化 | 学校、自治体、企業、地域活動へ翻訳できる | 記録が見られるだけで終わる |
| R17 | export readiness | Darwin Core / GBIF / JBIF / 研究利用に出せる項目を満たす | 外部連携時に手戻りする |
| R18 | 管理行動トリガー | 外来種、防除、希少種注意、危険箇所、再確認を起動する | 発見が行動につながらない |
| R19 | 低負荷入力 | その場で完了でき、後で補完できる | 参加が続かない |
| R20 | provenance | 端末、モデル、AI version、編集履歴、アップロード経路を残す | 証拠の由来が追えない |

### 10.2 モード別の役割マトリクス

凡例: `主` = 主責務、`副` = 補助責務、`条件` = 対象や設定次第、`-` = 基本責務ではない

| 役割 | 画像投稿 | 動画投稿 | 同定 | ガイド調査 | フィールドスキャン |
|---|---|---|---|---|---|
| R01 証拠取得 | 主 | 主 | 条件 | 副 | 副 |
| R02 同定支援 | 主 | 主 | 主 | 副 | 条件 |
| R03 観察文脈 | 主 | 主 | 条件 | 主 | 主 |
| R04 努力量 | 条件 | 条件 | - | 主 | 主 |
| R05 不在/未検出 | - | - | 条件 | 主 | 条件 |
| R06 個体数/量/サイズ | 条件 | 条件 | 条件 | 主 | 条件 |
| R07 行動/生活史/フェノロジー | 条件 | 主 | 条件 | 条件 | 条件 |
| R08 生息環境/場所状態 | 条件 | 主 | 条件 | 副 | 主 |
| R09 空間カバー | 副 | 副 | - | 主 | 主 |
| R10 環境条件 | 副 | 副 | - | 主 | 主 |
| R11 秘匿/安全 | 主 | 主 | 主 | 主 | 主 |
| R12 レビュー可能性 | 主 | 主 | 主 | 副 | 条件 |
| R13 学習/能力形成 | 副 | 副 | 主 | 主 | 主 |
| R14 再訪問/時系列 | 条件 | 条件 | 副 | 主 | 主 |
| R15 プロトコル遵守 | - | - | 条件 | 主 | 条件 |
| R16 レポート化 | 副 | 副 | 副 | 主 | 主 |
| R17 export readiness | 副 | 副 | 主 | 主 | 条件 |
| R18 管理行動トリガー | 条件 | 条件 | 条件 | 条件 | 主 |
| R19 低負荷入力 | 主 | 主 | 主 | 副 | 主 |
| R20 provenance | 主 | 主 | 主 | 主 | 主 |

### 10.3 モード別の最低品質ゲート

#### 画像投稿

画像投稿の責任は、**単一観察をレビュー可能な証拠として残すこと**。

最低品質ゲート:

- 写真 evidence が observation package に紐づく
- 撮影/投稿日時、private location、public precision が保存される
- observer hypothesis、AI suggestion、reviewed identification が分離される
- taxon 不明でも投稿できる
- media license と record consent が保存される
- 希少種/釣り場/私有地/子ども情報の秘匿ルールが走る
- 分類群に応じて追加撮影チェックが出せる

果たせない場合:

- 写真なし、日時なし、位置なし、同意なしは export readiness を下げる
- 画像が粗い/角度不足なら `needs_more_evidence`
- AI候補だけなら `identification_status = suggested` のままにする

#### 動画投稿

動画投稿の責任は、**行動、時間変化、複数個体、周辺環境を証拠化すること**。

最低品質ゲート:

- 動画 evidence、duration、key frame が保存される
- 行動、鳴き声、移動、採餌、繁殖、群れ、環境状態を注釈できる
- 複数分類群が映る場合、occurrence を分けられる
- 音声を含む場合、audio evidence としても扱える
- AI抽出結果は候補として保存し、人間確認前に確定扱いしない
- 動画内の位置情報/顔/車/私有地などの公開リスクを確認する

果たせない場合:

- key frame がない動画はレビュー負荷が高い
- 複数種を1 occurrence に混ぜると export が壊れる
- 動画だけで場所状態を語る場合、scan footprint がないと site evidence として弱い

#### 同定

同定の責任は、**記録をより正しい分類階層・信頼度・レビュー状態へ進めること**。これは投稿後の補助機能ではなく、独立したユーザー行動として扱う。

最低品質ゲート:

- 対象 observation / occurrence / evidence を明示する
- 同定者の種別を保存する
- `observer_hypothesis`, `ai_suggestion`, `community_identification`, `trusted_review`, `expert_review` を分ける
- taxon rank を保存し、種まで分からない場合は属/科/目などで止められる
- confidence、理由、見た証拠、判断できなかった理由を残せる
- taxon authority / name usage / synonym を追跡できる
- 既存同定を上書きせず、identification history として追記する
- 証拠不足なら `needs_more_evidence` または `cannot_identify_from_evidence` を返せる
- 希少種、採集圧、食毒、危険生物に関わる場合は安全ガードを通す
- 同定者が precise location を見る場合は access scope と audit log を残す

果たせない場合:

- 同定履歴が残らないと、誰が何を根拠に変えたか追えない
- AI候補と専門家確認が混ざると、review / export / report が壊れる
- 種名を強制すると、誤同定が増える
- きのこ等で食用可否に踏み込むと安全事故につながる

#### ガイド機能での調査

ガイド調査の責任は、**観察を protocol / effort / absence つきの調査データへ変えること**。

最低品質ゲート:

- 調査目的、対象分類群、site/route/plot、開始/終了がある
- effort minutes、distance、人数、観察方法が保存される
- 見つかった記録と、見つからなかった記録を分けて保存する
- complete checklist または target checklist を選べる
- 調査途中の画像/動画/音声が evidence として紐づく
- 終了時に recap、data gap、次回再訪問提案が出る
- protocol を満たしていない場合は monitoring quality を下げる

果たせない場合:

- 努力量がないガイド調査は、通常投稿の束として扱う
- absence がないと「見つかったものリスト」に留まる
- route/site がないと再訪問比較ができない

#### フィールドスキャン

フィールドスキャンの責任は、**その場所の現在状態、空間カバー、管理上の注意点を短時間で把握すること**。

最低品質ゲート:

- scan type、scan footprint、duration、location precision が保存される
- point / route / area / panorama / fixed-point のどれかを明示する
- site condition、habitat、substrate、water condition、disturbance、management action を記録できる
- 候補生物が出ても、review 前は occurrence candidate として扱う
- 外来種、希少種、危険箇所、ゴミ、工事、草刈り、水位異常などを flag 化できる
- 同じ場所で再スキャンできる
- scan 結果はレポート素材になるが、単独で生物の増減を断定しない

果たせない場合:

- footprint がない scan は、場所状態の証拠として弱い
- 生物候補だけを自動で occurrence 確定すると誤検出が混ざる
- fixed point / route がないと時系列比較が難しい

### 10.4 役割不全チェック

各 observation package は、モード別に role fulfillment を持つ。これにより、「機能は使われたが、果たすべき役割を果たしていない」状態を検出する。

推奨構造:

```json
{
  "action_mode": "image_post | video_post | identification | guided_survey | field_scan",
  "role_fulfillment": [
    {
      "role_id": "R01",
      "status": "fulfilled | partial | failed | not_applicable",
      "blocking_level": "none | review | report | export",
      "reason": "evidence_media_missing"
    }
  ]
}
```

最初に見るべき blocking checks:

| チェック | 対象 | blocking level |
|---|---|---|
| evidence media がない | 画像/動画投稿 | review |
| private location または public precision がない | 全モード | report/export |
| consent / license がない | 全モード | export |
| identification history が残らない | 同定 | review/export |
| AI suggestion と expert review が混ざる | 同定 | review/export |
| effort がない | ガイド調査、フィールドスキャン | trend/report |
| absence/no-detection がない | ガイド調査 | monitoring |
| scan footprint がない | フィールドスキャン | report |
| AI suggestion と reviewed ID が混ざっている | 全モード | review/export |
| sensitive risk 判定が未実行 | 全モード | public display |
| protocol が未完了 | ガイド調査 | monitoring |
| multiple taxa が1 occurrenceに混ざる | 動画/スキャン | export |

このチェックにより、UIの完了とデータの完了を分けられる。ユーザーには投稿成功を返しつつ、内部では `review_ready`, `report_ready`, `export_ready`, `monitoring_ready` を別々に判定する。

## 11. AI補助と人間判断の境界

AI は今後さらに強くなる前提で設計する。ただし、ikimon.life では **AIは補助・抽出・推定・下書き・キュー整理まで** とし、**公式確定・公開・外部提出・安全判断は人間が担う** という線を先に敷く。

重要なのは、AIを使わないことではない。むしろ、写真や動画から人間が面倒に感じる観察項目を先に拾い、`AIによる候補/推定` として保存しておくことで、参加者とレビュアーの負担を大きく下げる。

### 11.1 基本原則

| 原則 | 内容 |
|---|---|
| AIは候補を作る | 種候補、個体数、被度、行動、環境、欠損項目、秘匿リスクを提案する |
| AIは確定しない | reviewed identification、公式export、公開粒度上げ、行政提出、保全効果主張は人間が決める |
| AI生成物は分けて保存する | `ai_suggestion`, `ai_measurement`, `ai_summary`, `ai_risk_flag` を人間入力と混ぜない |
| AIの由来を残す | model、version、prompt/task、input evidence、confidence、推定方法、生成時刻を保存する |
| AIは上書きしない | 既存記録を直接変更せず、draft / suggestion / candidate として追記する |
| AIは安全側に倒す | 希少種、採集圧、釣り場、子ども、私有地、危険生物は公開粒度を上げない |
| AIは再評価可能にする | 新モデルで再解析しても、過去のAI出力と人間判断の履歴を残す |

### 11.2 AIに任せてよいこと / 人間が担うこと

| 領域 | AIに補助させる | 人間が確定する |
|---|---|---|
| 同定 | 種/属/科候補、類似種、同定に必要な追加証拠、分類群別注意点 | reviewed ID、expert ID、種まで落とすか上位分類で止めるか |
| 個体数 | 写っている個体の直接カウント、重なりがある場合の範囲推定、被度/密度のフェルミ推定 | レポートに採用する数値、調査データとして使うか |
| 行動/生活史 | 鳴いている、開花、結実、採餌、繁殖、群れ、死骸などの候補タグ | 行動記録の確定、繁殖確認など保全上重い判断 |
| 生息環境 | 草地、水辺、舗装、倒木、基質、管理状態、攪乱の候補 | site condition の正式記録、管理評価 |
| 努力量/不在 | ガイド中の時間、移動、未入力項目、チェック漏れの検出 | 調査完了、absence/no-detection の採用 |
| 秘匿/安全 | 希少種候補、釣り場リスク、顔/車/住所、危険生物、食毒リスクの検出 | 公開可否、公開粒度、危険助言の扱い |
| レビュー運用 | レビュー優先度、専門家への振り分け、証拠不足の判定 | レビュー結果、差し戻し、公開承認 |
| レポート | recap、data gap、Monitoring Readiness、自然共生サイト向け下書き | 企業/自治体/学校へ出す最終レポート |
| export | Darwin Core mapping 候補、欠損チェック、QA report 下書き | 外部公開、GBIF/JBIF/行政提出 |
| エージェント運用 | 欠損補完依頼、再撮影依頼、レビューキュー整理、集計下書き | ユーザーへの重要通知、外部提出、公開設定変更 |

### 11.3 AI数量推定の扱い

写真にセイヨウタンポポが多数写っているような場合、AIはかなり有効に使える。人間が1つずつ数える必要はない。

AIが保存してよい数量情報:

| 種類 | 例 | 保存方針 |
|---|---|---|
| 直接カウント | 画面内に花が23個見える | `count_exact_candidate` として保存。見切れ/重なりが少ない場合のみ |
| 範囲推定 | 20-35個程度 | `count_range_candidate` として保存 |
| 被度推定 | 黄色い花が画面の約8% | `coverage_percent_candidate` として保存 |
| 密度推定 | 1平方mあたり約15株 | 面積根拠がある場合のみ `density_candidate` |
| フェルミ推定 | 写真範囲から草地全体では約300-600株 | `fermi_estimate` として保存し、レポートでは推定扱い |
| 不確実性 | 重なり、ピント、画角、遮蔽が大きい | confidence と quality flag を下げる |

推奨構造:

```json
{
  "ai_measurements": [
    {
      "measurement_type": "count_range_candidate",
      "target": "Taraxacum officinale species complex",
      "value": {
        "min": 20,
        "max": 35
      },
      "method": "vision_count_with_occlusion_adjustment",
      "confidence": 0.72,
      "evidence_refs": ["media_123"],
      "ai_generated": true,
      "review_status": "unreviewed",
      "notes": "Some flowers are partially occluded; estimate should not be treated as exact."
    }
  ]
}
```

注意点:

- AI count は、人間の `individual_count` と別フィールドにする
- レポートでは `AI推定` と明示する
- 調査プロトコル上の正式カウントには、人間レビューまたは protocol 条件が必要
- 種同定が不確かな場合、数量だけ精密に見せない
- セイヨウタンポポのように外来/在来/雑種/類似種が絡む分類群は、種名を確定せず `タンポポ類` や species complex で止められるようにする

### 11.4 行動モード別のAI補助ライン

| モード | AIが補助すべきこと | AIがしてはいけないこと |
|---|---|---|
| 画像投稿 | 種候補、写っている数、被度、必要な追加写真、危険/秘匿リスク、環境タグ | 種名確定、個体数確定、公開粒度を上げる、食用可否判断 |
| 動画投稿 | key frame 抽出、複数種候補、行動タグ、鳴き声/音声候補、個体追跡候補 | 複数種を1 occurrence に確定、繁殖確認を確定、顔/住所入り動画を自動公開 |
| 同定 | 類似種比較、根拠提示、上位分類で止める提案、追加証拠依頼 | expert review の代替、同定履歴の上書き、種レベル強制 |
| ガイド調査 | 入力漏れ検出、effort計測補助、チェックリスト補完、absence候補、recap生成 | protocol完了の最終承認、absenceの確定、調査結果の政策的解釈 |
| フィールドスキャン | site condition候補、外来種/希少種/危険箇所flag、草刈り/水位/攪乱候補、再訪問提案 | 場所状態の正式評価、管理効果の断定、生物増減の断定 |

### 11.5 AIエージェントの権限レベル

将来 ikimon.life 内にAIエージェントを入れる場合、権限を段階化する。

| レベル | 権限 | 許可する例 | 人間承認 |
|---|---|---|---|
| A0 | 表示のみ | 「この写真は追加証拠が必要そうです」と表示 | 不要 |
| A1 | 候補作成 | 種候補、数の候補、環境タグ候補を作る | 不要。ただしAIラベル必須 |
| A2 | 下書き作成 | レポート、export QA、再撮影依頼文、レビュー依頼を下書き | 公開/送信前に必要 |
| A3 | 内部キュー操作 | reviewer queue、missing field queue、risk queue へ振り分け | 監査ログ必須。重要リスクは承認 |
| A4 | 限定自動処理 | 明らかな重複候補の束ね、低リスクなタグ付け | undo と audit log 必須 |
| A5 | 禁止/人間専権 | 公開粒度を上げる、外部提出、専門家確定、危険助言、法務判断 | AI単独禁止 |

最初に実装してよいのは A0-A2 まで。A3 以降は audit log、undo、権限管理、レビューフローが整ってからにする。

### 11.6 AI出力の品質ゲート

AI出力は、次を満たさない限り `report_ready` や `export_ready` にしない。

| チェック | 必須理由 |
|---|---|
| `ai_generated = true` | 人間入力と混ぜないため |
| `model_id` / `model_version` | 後で再評価するため |
| `input_evidence_refs` | 何を見て判断したか追うため |
| `confidence` | 不確実性を見せるため |
| `method` | 直接カウント、範囲推定、フェルミ推定を分けるため |
| `review_status` | 未確認/確認済み/却下を分けるため |
| `human_acceptance` | レポートやexportに採用した責任を残すため |
| `safety_reviewed` | 希少種、食毒、私有地、子ども、釣り場リスクを避けるため |

このラインにより、AIは強く使うが、AIが「記録の責任主体」にならない構造を保てる。

## 12. 最終漏れチェック

ここまでで、分類群、観測手法、国内連携、ユーザー行動、AI境界の主要論点はかなり塞がっている。ただし、実装・運用に入ると次の論点が漏れやすい。ここも暫定 Decision Record として扱う。

| 論点 | 最善案 | 次善案 | 当面の採用 |
|---|---|---|---|
| データ削除/同意撤回 | withdrawal model を作り、本人表示・公開表示・研究利用・企業レポート・外部exportへの影響を分ける。削除は tombstone と downstream invalidation を残す | サポート窓口で手動撤回し、外部export分は個別対応する | `withdrawal_status`, `deleted_at`, `delete_scope`, `exported_dataset_refs` を持つ。完全物理削除はメディア/個人情報を優先 |
| データ保持期間 | record type、user type、media type、site policy ごとに retention policy を持ち、期限切れを purge/anonymize する | 原則保持し、学校/子ども/企業非公開メディアだけ短期保持にする | `retention_policy`, `retain_until`, `anonymize_after` を追加候補にする。子ども/学校/非公開メディアは短めに扱う |
| オフライン/現地運用 | offline-first draft queue、端末内暗号化、後同期、競合解決、GPS精度低下の明示を持つ | オンライン前提だが、下書き保存と再送だけ用意する | まず offline draft + sync status + location accuracy warning。完全offline調査は後段 |
| 大容量メディア | resumable upload、client compression、derived media、key frame、media tiering、原本保持方針を分ける | サイズ上限を厳しめにし、動画は短尺/圧縮のみ受ける | `upload_session`, `media_derivatives`, `key_frame_refs`, `original_retention_policy` を持つ |
| 位置/日時の不確実性 | coordinate/date/time uncertainty と source provenance を必須化し、EXIF/端末GPS/手入力/推定/ぼかしを分ける | 位置精度だけ保存し、日時の不確実性は自由記述にする | `coordinate_uncertainty_m`, `location_source`, `date_uncertainty`, `time_uncertainty`, `precision_modified_by` を持つ |
| 監査ログ | user/admin/reviewer/AI/export/access の変更を append-only audit log に残す | sensitive operations だけ監査する | review、AI採用、公開粒度変更、外部export、管理者閲覧は必ず audit log |
| AIモデル評価 | 分類群別 eval set と regression benchmark を持ち、モデル変更前に false positive/negative を比較する | リリース後にレビュー結果からAI誤り率をサンプリングする | bird / plant / fungi / water / pollinator から小さな eval set を作る。`model_version` と結果を保存 |
| UI上のラベル | `未確認`, `AI候補`, `観察者仮説`, `コミュニティ同定`, `信頼レビュアー確認`, `専門家確認` を統一ラベル化する | 画面ごとに badge を出すが、内部statusだけ共通化する | controlled vocabulary を先に作る。確定語は expert/trusted review 以外で使わない |
| 通知疲れ | severity、frequency cap、digest、user preference、quiet hours を持つ | 重要通知だけ即時、その他はメール/アプリ内通知にまとめる | `notification_severity`, `frequency_cap`, `digest` を採用。再撮影依頼は連発しない |
| コミュニティ健全性 | code of conduct、report/moderation、trusted role、anti-harassment、no ranking-by-volume を設計する | 手動通報と管理者対応から始める | 通報、非表示、trusted reviewer、ランキング抑制を先に入れる。希少種/釣り場晒しは即時対応 |
| 多言語/アクセシビリティ | i18n前提、やさしい日本語、WCAG、音声/画像代替、低視力/シニア対応を設計する | まず plain Japanese と主要UIのアクセシビリティだけ整える | UI文言を短くし、status label をやさしい日本語化。フォーム/ボタン/画像説明はアクセシブルにする |
| コスト管理 | AI task budget、media tiering、provider boundary、quota、cost dashboard を持つ | 高コスト処理を手動/夜間batchに回す | `ai_task_budget`, `media_storage_tier`, `provider_cost_center` を持つ。動画AI解析は初期から制限 |
| セキュリティ | threat model、MIME/拡張子検査、EXIF方針、signed URL、rate limit、RBAC、export権限を設計する | uploadとadmin/export周りだけ重点的に固める | upload validation、EXIF stripping/retention policy、RBAC、rate limit、private media signed URL を必須 |
| 法務/免責 | action/taxon/site別の advice boundary を作り、採集・食毒・立入・釣り・保護種・企業主張を分ける | 汎用免責と危険分類群だけ個別警告にする | no edible advice、no legal permission advice、no conservation outcome guarantee を明示。terms update 前提 |
| 成果指標 | vanity metrics ではなく、role fulfillment と monitoring/export/review readiness を中核KPIにする | 投稿数、継続率、レビュー数に補助指標を足す | `role_fulfillment_score`, `review_ready_rate`, `monitoring_ready_rate`, `export_ready_rate`, `revisit_rate` を採用 |

### 12.1 追加すべき品質指標

投稿数やユーザー数だけでは、ikimon.life がモニタリング基盤になっているか分からない。最低限、次を追う。

| 指標 | 意味 |
|---|---|
| `review_ready_rate` | レビュー可能な証拠と文脈が揃った割合 |
| `monitoring_ready_rate` | effort / absence / protocol / site が揃った割合 |
| `export_ready_rate` | license / consent / taxon / location generalization が揃った割合 |
| `ai_suggestion_acceptance_rate` | AI候補が人間に採用された割合 |
| `ai_false_positive_rate` | AI候補が誤りだった割合 |
| `sensitive_mask_success_rate` | 希少種/釣り場/私有地の秘匿が正しく走った割合 |
| `revisit_rate` | 同じ場所に再訪問が起きた割合 |
| `review_turnaround_time` | レビュー待ち時間 |
| `role_fulfillment_score` | 行動モードごとに果たすべき役割を満たした度合い |

### 12.2 現時点の判断

現時点で残っている漏れは、プロダクトの方向性を変えるようなものではない。大きな方向は次でよい。

- ikimon.life は観察パッケージ生成レイヤー
- ユーザー行動は画像投稿、動画投稿、同定、ガイド調査、フィールドスキャン
- AIは強く補助するが、確定・公開・外部提出・安全判断は人間
- 分類群は bird / plant / pollinator / fungi / water を横並びで扱う
- 国内連携は代替ではなく前処理/証拠整理/出口整備

残る作業は「何を作るか」より、**品質・同意・権限・コスト・運用をどう壊れない形で持つか** に移っている。

## 13. 未決事項の暫定判断

この章は、完全な合意前でも実装が止まらないようにするための暫定 Decision Record。原則として **最善案を採用候補** とし、制度連携・専門家合意・本番状況が未確認の部分だけ次善案へ落とす。

| 論点 | 最善案 | 次善案 | 当面の採用 |
|---|---|---|---|
| 現行本番との同期 | 本番/staging が返す version endpoint に `git_sha`, `migration_head`, `feature_flags`, `built_at` を出し、README/docs と実環境を照合する | 手動の release ledger で、どの機能が本番/staging/local のどこにあるか記録する | version endpoint + release ledger。docsの記述だけで本番反映済み扱いしない |
| 水域ID | `waterbodies` registry を作り、河川区間、湖沼、池、湿地、河口、海岸、港湾、流域を階層IDで管理する | まずはメッシュ/自治体/手入力水域名を保存し、後で registry へ昇格する | 最小 `waterbodies` registry を作る。外部IDがなくても `ikimon_waterbody_id` を発行する |
| 釣果の公開ポリシー | 強制秘匿ルールを最上位に置く。`system risk cap > admin/reviewer > site policy > user preference` の順で公開粒度を決める | ユーザー選択を基本にし、希少種/釣り場/私有地だけ上書きする | 強制秘匿優先。ユーザー設定は公開粒度を下げられるが、上げられない |
| ゼロキャッチ | `no_catch` は occurrence ではなく visit/capture attempt の結果として保存し、対象分類群ごとの absent と分ける | `occurrences.occurrence_status = absent` に target taxon を入れて暫定運用する | `visit` / `effort` / `capture_attempt` 側に `no_catch` を持たせる。species absent と混ぜない |
| 行政連携 | 水産庁等の公式報告を代替せず、必要項目を揃えて本人/団体が報告しやすい形にする。正式連携までは自動提出しない | 公式報告ページへの案内と、ikimon内の補助記録だけにする | 「補完・前処理・証跡整理」と位置づける。公式提出済みフラグだけ持つ |
| ライセンス | occurrence data、media、研究利用、企業レポート利用を分離し、外部公開は明示同意と license-clean な記録だけにする | 初期は全データ非公開/内部利用にして、公開export時に同意を取り直す | デフォルトは外部公開不可。公開候補のみ `dataset_license` と `media_license` を明示する |
| 専門家レビュー | taxon / geography / evidence type / institution ごとに scope を持つ reviewer registry と queue を作る | 鳥・植物・菌類・水辺など大分類ごとの trusted reviewer を手動管理する | scope付き reviewer role を採用。全分類群を1人が見る前提にしない |
| export | Darwin Core CSV + metadata + QA report から始め、DwC-A互換に設計して後から archive 化する | 内部JSON/CSVを先に作り、Darwin Core mapping は後段で行う | Darwin Core CSV v0 から始める。DwC-A は dataset/review/license が安定してから |

### 13.1 判断メモ

#### 現行本番との同期

最善は、アプリ自身が現在の実行状態を返すこと。`platform_v2` の docs や migration を見ただけでは、本番/staging に出ているとは判断しない。

必要な最小項目:

- `git_sha`
- `built_at`
- `migration_head`
- `schema_version`
- `feature_flags`
- `runtime_env`

#### 水域ID

水域は、単なる文字列ではなく階層にする。

推奨階層:

- basin / watershed
- river
- river_segment
- lake / pond
- wetland
- estuary
- coast
- port / harbor
- artificial_canal

外部の正式IDを最初から完全に揃える必要はない。ただし、`ikimon_waterbody_id`、`source`, `source_version`, `geometry_precision`, `public_label` は最初から持つ。

#### 釣果の公開ポリシー

公開粒度はユーザーの自由選択だけにしない。釣り場、希少種、私有地、子ども、企業敷地、保護区域は、システム側が上限を決める。

優先順位:

1. 法令/保護種/希少種/採集圧リスク
2. site policy / landowner policy
3. admin / reviewer decision
4. user preference
5. default public precision

#### ゼロキャッチ

`absent` と `no_catch` は意味が違う。

| 概念 | 意味 | 保存先 |
|---|---|---|
| `occurrence_status = absent` | 対象分類群を探したが検出しなかった | occurrence / survey detection |
| `no_catch` | 釣行または捕獲努力の結果、採捕がなかった | visit / capture attempt |
| `observed_only` | 見たが釣っていない、採っていない | water/capture extension |

釣りで「何も釣れなかった」は、対象魚不在の証明ではない。努力量付きの採捕結果として扱う。

#### 行政連携

ikimon.life は、水産庁の遊漁採捕量報告を置き換えない。将来の正式連携がない限り、ikimon 側の役割は次に留める。

- 公式報告に必要な項目を揃える
- 本人が報告したかを記録する
- 地域/教育/保全向けに、秘匿済みの集計を作る
- 行政・研究者が見ても意味が通る証跡を残す

#### ライセンス

ライセンスは一括にしない。

| 対象 | 推奨 |
|---|---|
| 非公開観察 | 外部公開不可 |
| 公開 occurrence data | CC0 または CC BY 4.0 から選択。初期は CC BY 4.0 を推奨 |
| 写真/音声/動画 | occurrence data と分離。初期は all rights reserved または明示選択 |
| 研究利用 | consent で別管理 |
| 企業レポート利用 | site/report consent で別管理 |

GBIF/JBIF等へ出す候補は、license と秘匿処理が明示された記録だけに限定する。

#### 専門家レビュー

レビュー権限は、人ではなく scope に付ける。

scope 候補:

- taxon group
- geography
- evidence type
- institution / project
- risk lane

レビュー結果は、同定確定だけでなく、公開粒度変更、要再撮影、要標本、要専門家、危険助言ブロックも扱う。

#### export

最初から DwC-A を作ると、dataset metadata、license、review、秘匿処理、更新差分の運用まで一気に必要になる。P0/P1 では Darwin Core CSV v0 と QA report で十分。

最小 export:

- `occurrence.csv`
- `event.csv`
- `multimedia.csv`
- `metadata.json`
- `qa_report.json`
- `withheld_and_generalized_fields.md`

DwC-A は、公開 dataset の運用責任者、license、更新頻度、review基準が決まってからでよい。

## 14. 参照情報

BioMonWeek 2026:

- Official site: <https://2026.biomonweek.eu/>
- Themes and sessions: <https://2026.biomonweek.eu/page/themes-sessions/>
- Biodiversa schedule article: <https://www.biodiversa.eu/2026/04/08/biomonweek2026/>
- Biodiversa day 1 highlights: <https://www.biodiversa.eu/2026/05/04/biomonweek2026-highlights/>
- OBIS BioMonWeek 2026 article: <https://obis.org/2026/05/05/biomonweek-2026/>
- B-Cubed BioMonWeek note: <https://b-cubed.eu/news/discussing-improved-biodiversity-data-access-biomonweek-2026>
- GBIF event page: <https://www.gbif.org/event/3ioWg1a0c3OaUuYQAR9RPb/biomonweek-2026>
- BMD project booth note: <https://bmd-project.eu/news/bmd-will-participate-and-co-host-booth-biomonweek-2026>
- ANERIS event note: <https://aneris.eu/events/biomonweek-2026>

分類群/観測コミュニティ:

- eBird about: <https://ebird.org/about>
- eBird data use / GBIF: <https://support.ebird.org/en/support/solutions/articles/48001078113>
- BirdNET: <https://birdnet.cornell.edu/>
- iNaturalist about: <https://www.inaturalist.org/pages/about>
- iNaturalist data download / GBIF: <https://help.inaturalist.org/en/support/solutions/articles/151000170342-how-can-i-download-data-from-inaturalist->
- Pl@ntNet about: <https://plantnet.org/en/about/>
- Flora Incognita citizen science: <https://floraincognita.com/citizen-science/>
- Nature's Notebook: <https://www.usanpn.org/node/223>
- Fungal Diversity Survey / FunDiS: <https://www.fundis.org/overview>
- Fungal Diversity Survey / NAMA: <https://namyco.org/about/fungal-diversity-survey/>
- Mushroom Observer overview: <https://blogs.cornell.edu/nymasternaturalist/2021/11/01/mushroom-observer/>
- UK Pollinator Monitoring Scheme: <https://ukpoms.org.uk/>
- Bumble Bee Watch: <https://www.bumblebeewatch.org/about/>
- European / Irish Butterfly Monitoring Scheme example: <https://biodiversityireland.ie/surveys/butterfly-monitoring-scheme/>
- FrogID app: <https://www.museum.qld.gov.au/learn-and-discover/apps/frogid-app>
- Wildlife Insights: <https://wildlifeinsights.org/about>
- Wildlife Insights FAQ: <https://www.wildlifeinsights.org/faq>
- iMapInvasives: <https://www.imapinvasives.org/>
- Reef Life Survey: <https://reeflifesurvey.com/about-rls/>
- Chesapeake Water Watch / NASA: <https://science.nasa.gov/citizen-science/chesapeake-water-watch/>

国内制度/データ基盤:

- 環境省 いきものログ: <https://www.env.go.jp/nature/biodic/ikilog/index.html>
- いきものログ / モニタリングサイト1000: <https://ikilog.biodic.go.jp/Moni1000/>
- JBIF: <https://gbif.jp/>
- JBIF about: <https://gbif.jp/en/about/jbif/summary/>
- S-Net / サイエンスミュージアムネット: <https://science-net.kahaku.go.jp/>
- S-Netについて: <https://www.kahaku.go.jp/kenkyu/s-net/about.html>
- 環境省 自然共生サイト: <https://policies.env.go.jp/nature/biodiversity/30by30alliance/kyousei/>
- 環境省 自然共生サイト認定 2026-03-17: <https://www.env.go.jp/press/press_03222.html>
- 環境省 レッドリスト・レッドデータブック: <https://www.env.go.jp/nature/kisho/hozen/redlist/>

釣り/遊漁データ:

- ANGLERS heatmap release: <https://prtimes.jp/main/html/rd/p/000000080.000019379.html>
- ANGLERS Google Play: <https://play.google.com/store/apps/details?hl=ja&id=tokyo.anglers.app>
- 水産庁 遊漁の部屋: <https://www.jfa.maff.go.jp/j/enoki/yugyo/>
- FishRanker PR TIMES STORY: <https://prtimes.jp/story/detail/vBdL6wcDk4B>
- Fishbrain: <https://fishbrain.com/>
- MyCatch / International Joint Commission: <https://www.ijc.org/en/mycatch-lets-anglers-help-scientists-gather-fish-data>
- Fish Rules Citizen Science: <https://fishrulesapp.com/citizenscience>
- Reliability of self-reported catch and effort data via smartphone application: <https://www.sciencedirect.com/science/article/abs/pii/S0165783625002395>
- Citizen science platform users in recreational fisheries data: <https://www.sciencedirect.com/science/article/abs/pii/S0165783620301144>
- Mapping Ocean Wealth report: <https://oceanwealth.org/wp-content/uploads/2025/02/Venturelli-et-al-2025-Marine-recreational-fishing-BSU-and-TNC-Report.pdf>

内部参照:

- `docs/architecture/ikimon_life_navigable_biodiversity_os_design_2026-04-30.md`
- `ikimon_civic_nature_development_plan.md`
- `docs/spec/ikimon_long_term_observatory_data_principles_2026-04-11.md`
- `docs/spec/observation_event_public_plan_spec_2026-04-10.md`
- `docs/spec/ikimon_relationship_score_v0_spec_2026-04-26.md`
- `要件/specs/data_standards.md`
- `E:\Projects\03_ikimon.life_Product\platform_v2`
