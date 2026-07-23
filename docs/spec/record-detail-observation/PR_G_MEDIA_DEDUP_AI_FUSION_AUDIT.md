# PR-G: 公開メディア重複・AI候補統合監査

## 監査境界

- 実施日: 2026-07-23
- exact source SHA: `2e8c22242abc6eccb3a54137af4ed4d063fc6371`
- 対象: 公開ページ、公開API、公開derivative、同SHAのソースコード
- 非対象: production DB、private / limited media、reassess API、AI run / cost logger、既存AI結果の更新
- 代表回帰ケース: `record-1780552463658`

この監査は公開情報だけで再現した。人の同定、accepted identification、元media行、既存AI結果は変更していない。

## 結論

問題は代表記録固有ではない。旧保存経路を含む複数画像記録で、同じ公開derivativeが別`asset_id`として二重に投影される共通パターンを確認した。

同時に、現行AI統合はprimary候補が空でない限りprimaryを主候補にし、censusの動物rankを一律`class`へ変換する。この組み合わせにより、別レーンが具体名を返しても「鳥類」等が残る構造になっている。

## 代表ケースの検証可能な事実

公開ページ:

`https://ikimon.life/ja/observations/record-1780552463658`

公開詳細API:

`https://ikimon.life/api/v1/observations/occ%3Arecord-1780552463658%3A0/public-detail`

| 構図 | asset ID | 同一内容のasset ID | 公開derivative SHA-256 |
|---|---|---|---|
| 鳥の接写 | `36e7dba9-9e6e-4e1b-8ddd-5a26076ba9ea` | `a6c4e4ea-ddb2-4bc1-b22d-c2bccc3730a0` | `0aeb0c5a8125e3c039f9c4a04f2418e713361b58c4d8d2a07aee802be44e8c6c` |
| アンテナ上の遠景 | `8ed39677-0959-44d5-a58e-6c4a8502f1c8` | `bddcb6bd-91bf-441e-b7ad-de12247c9ebe` | `31cbd78411d9d75b500afd4d94e4224ecacb4bb240a7ecc4a7f6440a15bd3358` |
| 建物・植生を含む全景 | `9f0eb001-0c30-46b7-8e29-6c0b0e45d4a9` | `c81eefaa-80ce-46d2-a204-dc57d674daab` | `e89245d213dbcbbb0986aa40110dd5119ab9129ddcb91825e6ea5a89fc8af4a0` |

確認値:

- source media: 6
- unique public compositions: 3
- exact duplicate clusters: 3
- 現行表示: 6枚
- 現行AI候補: `鳥類` / `class`
- 公開APIのexact location露出: なし
- media region: 未保存

画像から第一候補を断定はしない。接写は形態証拠、アンテナ写真は止まり場所、全景は環境証拠として別の役割を持つ。同じ鳥の代替候補を複数subjectへ分ける根拠はない。

## 横断監査

2026-07-23時点の公開マップ48セルから取得できた公開詳細605件をread-onlyで確認した。

| 項目 | 結果 |
|---|---:|
| 公開詳細 | 605件 |
| 複数画像記録 | 463件 |
| AI候補あり | 29件 |
| 公開payloadでexact location露出 | 0件 |
| 公開payloadでmedia regionあり | 0件 |
| 公開video | 0件 |
| 公開audio | 0件 |

AI候補29件のrank:

| rank | 件数 |
|---|---:|
| species | 18 |
| genus | 1 |
| family | 3 |
| order | 1 |
| class | 4 |
| lifeform | 1 |
| unknown | 1 |

複数画像11件の公開derivativeをSHA-256で照合した結果:

| record | 表示数 | unique | exact duplicate |
|---|---:|---:|---:|
| `record-1780552463658` | 6 | 3 | 3 |
| `record-1779005636197` | 12 | 6 | 6 |
| `record-1779005736067` | 12 | 6 | 6 |
| `record-1779401380701` | 10 | 5 | 5 |
| `record-1780021901894` | 10 | 5 | 5 |
| `record-1779402526550` | 10 | 5 | 5 |
| `record-1779401525345` | 10 | 5 | 5 |
| `record-1779401482960` | 8 | 4 | 4 |
| `record-1779687334274` | 8 | 4 | 4 |
| `record-1778643230506` | 8 | 4 | 4 |
| `record-1779687013322` | 8 | 4 | 4 |
| **計** | **102** | **51** | **51** |

監査sampleでは表示の50%が別IDの完全重複だった。これは全公開記録の母比率ではなく、重複が疑われる複数画像sampleの実測値である。

鳥類の公開ケースは最低12件を確認した。回帰比較に使える例:

- `record-1780276266404`: ムクドリ / species / 6画像
- `record-1780552463658`: 鳥類 / class / 6画像
- `record-1780885718116`: 鳥類 / class / 4画像
- `record-1780982506049`: カワラヒワ / species / 6画像
- `record-1783677405995`: 鳥 / class / 1画像
- `record-1784430530197`: ヒヨドリ / species / 3画像
- `record-1784431188621`: スズメ / species / 3画像

公開名・候補から植物25件以上、昆虫・その他無脊椎動物11件以上も確認した。ただし、public read modelだけではペット、群れ、景色のみ、個体不明を権威的に分類できない。AI候補が空の旧記録を「生物非検出」と解釈することもできないため、これらは実記録については未確認とし、権利・位置情報を含まない合成fixtureでUIと判定を検証する。

公開video / audioはsampleに存在しなかった。写真専用回帰へ固定せず、video / audioは合成presentation fixtureで検証する。

## 根本原因

### 表示

`buildObservationDetail`はasset行を順に公開presentationへ写すが、`public_derivative_sha256`をSELECTしていない。`observationFirstRecordDetailHtml.ts`の`safeMedia`も`mediaId`だけを一意キーにする。同一画像が別IDなら両方残る。

### AI入力

`loadPreparedGeminiObservation`は最大12 assetを読み、各行を個別にImages変換して入力する。公開derivativeのcontent hashによる代表選択がないため、同じ画像が別IDなら変換・入力・token消費も重複する。

### 候補統合

`mergeGeminiObservationEvidence`はprimaryに名前があればprimaryを採用し、census primaryはprimary不在時だけ代替になる。さらに`rankForCensus`はanimalを`class`、plantを`lifeform`へ機械変換する。summaryは既存候補の説明を追加するレーンで、新しい具体名を復旧できない。

## 採用する境界

1. 元asset行を削除しない。
2. DB migrationなしで、既存`public_derivative_sha256`を完全一致の正本として使う。
3. displayとAI入力で同じpure dedup plannerを使う。
4. representativeは解像度、鮮明さ、対象比率、圧縮品質、crop安全性、bytes、表示順の順で決める。未計測値は推測せず0として扱う。
5. 近似一致は64-bit perceptual hash、向き正規化aspect ratio、Hamming distance 6以下のguardをpure plannerへ実装する。
6. productionでperceptual hashを新規生成する処理は、誤dedup率とImages変換費を測るまでshadow-onlyとする。
7. 別構図、同じ鳥の別瞬間、接写と遠景は重複扱いしない。
8. AI候補は全レーンのrank、generic度、画像根拠、矛盾、confidence、provenanceで再順位付けする。primary固定優先を廃止する。
9. accepted human identification、community票、位置保護、visibilityは変更しない。

## 固定回帰契約

`src/observationMediaDedup.fixtures.ts`に代表ケースの公開SHA-256と、次の合成negative casesを固定した。

- 圧縮違い
- resize違い
- rotation違い
- 同じ鳥の別瞬間
- 同じ鳥の接写

代表ケースの受け入れ値:

- unique display media = 3
- AI representative images = 3
- exact duplicate clusters = 3
- observation = 同じ鳥1件
- 接写 = primary morphology
- 遠景 = perch / context
- 全景 = environment
- 位置漏洩なし

## 事実・推測・未確認

- 事実: 公開derivativeは3組でbyte-identical。別記録10件にも同じ二重投影パターンがある。
- 事実: 現行コードはmedia ID単位で表示し、AI入力もasset行単位。primary固定優先とcensus rank欠落がある。
- 推測: 二重化が投稿ブラウザ、import、backfillのどの段階で初めて発生したかは公開情報だけでは確定できない。
- 未確認: private / limited、production内部raw AI response、元画像hash、upload request ID、動画・音声の実データ。
- 禁止: 上記を確定するためにproduction DBへ接続しない。本番reprocessもこの変更には含めない。
