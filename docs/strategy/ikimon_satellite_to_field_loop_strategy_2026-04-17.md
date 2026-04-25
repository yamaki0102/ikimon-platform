# ikimon Satellite-to-Field Loop 戦略

更新日: 2026-04-17

## 結論

主案はこれで固定する。

ikimon の地図機能は `衛星画像を眺める地図` ではなく、`現地で何を見るべきかを先回りして教える観察OS` にする。

つまり価値の中心を

- `remote sensing for reporting`

ではなく

- `remote sensing for seeing`

に置く。

衛星画像そのものを売るのではない。  
衛星画像から `現地仮説` を作り、`Field Scan` と `AI Lens` と `Field Note` に流し込み、観察の質と再訪価値を上げる。

この設計なら、単なる森林モニタリング記事や、単なる画像同定アプリを超えられる。

---

## 何を超えるのか

ブラジル日報 2026-04-14 の記事は、衛星データと機械学習で森林再生の炭素蓄積量を広域推定する話としては強い。

ただし限界も明確。

1. 主価値が `面積 / 炭素 / モニタリング効率` に寄っている
2. 現地観察者の行動変容まで閉じていない
3. 観察記録の再利用性や再訪性まで踏み込んでいない
4. 人が何を見て、何を撮り、何を残すべきかの支援がない

ikimon が狙うべき差分はここだ。

- `評価する技術` ではなく `観察を育てる技術`
- `報告のための遠隔解析` ではなく `現場判断のための遠隔解析`
- `炭素の把握` だけでなく `生物多様性記録の質向上`

---

## 勝ち筋

### 一文で言うと

`衛星画像 → 現地仮説 → 追加撮影 → 構造化記録 → 再訪比較`

のループをつくる。

### 中核ループ

1. `Satellite Layer`
   - 植生、地形、水系、裸地、林縁、撹乱、湿潤性の手がかりを取る
2. `Field Hypothesis`
   - この地点で見えるはずの microhabitat を仮説化する
3. `Field Scan`
   - 現地で何を確認すると記録価値が上がるかを返す
4. `AI Lens`
   - 種名断定より、今見えている特徴と足りない証拠を返す
5. `Field Note`
   - 現地文脈と不確実性を構造化して残す
6. `Revisit`
   - 前回との差分を見せ、季節差・管理差・撹乱差を積む

### プロダクト原理

- 答えより目を育てる
- 種名より文脈を厚くする
- 写真より `reviewable evidence` を増やす
- 衛星仮説と現地観察の差分を資産化する
- 不確実性を正式な状態として扱う

---

## 問題空間の定義

このテーマは `地図UI改善` ではない。  
問題空間は次の2つの合成である。

1. `Web体験・デザインシステム`
   - 地図が何を示すべきか
   - どの順で情報を見せるべきか
2. `AI活用・知識作業最適化`
   - どこまでを機械の推定に任せるか
   - どこで不確実性を見せるか

成果指標は `地図閲覧時間` ではない。  
主成果は次の4つ。

- first observation completion
- repeat observation rate
- field note completion rate
- reviewable observation rate

---

## プロダクト構成

### 1. Satellite Context Map

既存の地図に、単なるベースマップではなく `観察文脈レイヤー` を載せる。

表示候補:

- 林縁
- 水際
- 湿地候補
- 裸地 / 造成痕
- 遷移帯
- 草地化
- 樹冠の粗密
- 人為圧の強い境界

ここでは species prediction を前面に出さない。  
前面に出すのは `観察論点` である。

例:

- 「この地点は林縁と開放地の境界」
- 「季節水域の可能性あり」
- 「草地遷移が強い」
- 「水路沿いで湿性環境の痕跡」

### 2. Field Scan

`scan.php` / `field_scan.php` / `field_research.php` 文脈に接続する。

役割は `現地でまず何を見るべきか` を返すこと。

返すべきもの:

- 観察チェック3項目
- 撮るべき部位
- 環境確認ポイント
- その場で残すと強い note 項目

例:

- 「葉のつき方を確認」
- 「水際からの距離を記録」
- 「地表が落葉層か砂礫かを残す」

### 3. AI Lens

AI Lens の責務を固定する。

やること:

- 今見えている特徴の整理
- 足りない証拠の説明
- 候補の粒度調整
- 次回撮影ガイド

やらないこと:

- rare / invasive / out-of-range の単独確定
- species certainty machine 化
- 衛星レイヤーだけでの強い断定

返答の基本フォーマット:

- current best rank
- visible traits
- missing traits
- habitat consistency
- why not more specific
- next capture step

### 4. Structured Field Note

自由記述だけでは弱い。  
最低限、次を構造化する。

- habitat
- substrate
- canopy
- moisture
- edge type
- human impact
- behavior
- uncertainty

自由記述は補助に落とす。

### 5. Seasonal Replay / Revisit

同じ地点の比較を主機能に入れる。

比較軸:

- 前回との差分
- 去年の同時期との差分
- 草刈り前後
- 増水前後
- 落葉前後
- 開花期 / 結実期差分

これにより ikimon は `単発投稿アプリ` から `現地知の時系列OS` に上がる。

---

## 画面仕様

## A. Map 画面

ファーストビューで見せるのは「種がいそう」ではなく「ここで何を観察すると価値が高いか」。

主要UI:

- ベースマップ切替
- 衛星 / 標準 / 地形
- 観察文脈レイヤー ON/OFF
- 現地仮説カード
- 「この地点で見るべき3項目」
- `Field Scan を始める`
- `Field Note を残す`

カード例:

- 仮説: `湿性林縁`
- 理由: `樹冠疎密 + 水路近接 + 低地`
- 現地確認: `ぬかるみ`, `常緑低木`, `落葉厚`
- note 推奨: `地表状態`, `日照`, `人の踏圧`

## B. Scan 画面

既存 `field_research.php` 統合案と接続する。

Scan 開始時に次を3件だけ表示:

- 撮るべき部位
- 環境チェック
- 記録すべき文脈

スキャン中のカード:

- 現在の候補粒度
- 今見えている特徴
- 次に欲しい証拠

例:

- `安全な粒度: genus`
- `見えた特徴: 葉脈, 葉序, 林縁環境`
- `不足: 裏面, 茎, 花`
- `次: 葉裏を1枚`

## C. Field Note 画面

入力は短く、しかし構造化する。

必須:

- habitat
- moisture
- human impact
- uncertainty

任意:

- behavior
- local name
- smell / sound / texture
- satellite hypothesis mismatch

重要なのは `衛星仮説とのズレ` を残せること。

例:

- 衛星仮説: `湿地エッジ`
- 現地: `乾燥化が進み、草本優占`

## D. Observation Detail 画面

観察詳細では、写真・動画・音声の上に `現地文脈` と `仮説差分` を重ねる。

表示順:

1. media
2. current best rank
3. why not more specific
4. field context
5. satellite hypothesis vs field reality
6. revisit history

---

## データモデル

最低限必要な追加概念は次。

### SatelliteContext

- `site_context_id`
- `source_date`
- `source_type`
- `vegetation_pattern`
- `edge_type`
- `water_proximity`
- `disturbance_signal`
- `canopy_density_band`
- `hypothesis_labels[]`
- `confidence`

### FieldHypothesis

- `hypothesis_id`
- `observation_id or draft_id`
- `site_context_id`
- `prompt_items[]`
- `expected_microhabitats[]`
- `recommended_checks[]`
- `recommended_captures[]`

### StructuredFieldNote

- `habitat`
- `substrate`
- `canopy`
- `moisture`
- `edge_type`
- `human_impact`
- `behavior`
- `uncertainty_level`
- `satellite_mismatch`

### RevisitLink

- `place_key`
- `previous_observation_id`
- `comparison_type`
- `difference_summary`

---

## AIの責務分離

既存方針と同じく、AIに責務を混ぜない。

### 衛星レイヤーAI

役割:

- 観察文脈の候補生成
- microhabitat 仮説生成
- 現地チェック項目生成

### 視覚 / 音声AI

役割:

- 観察証拠の整理
- 粒度の安全側判断
- 次回撮影の提案

### LLM / 要約系

役割:

- note の自然文整形
- セッション要約
- 差分説明

### 禁止

- 1モデルに文脈理解、種断定、説明生成を全部背負わせること
- 推論根拠が残らない free-form 結果を正本にすること

---

## 差別化の中身

ikimon が勝つのは `識別精度だけ` ではない。  
勝つのは次の束だ。

1. 地図が観察の目を育てる
2. AI が断定でなく再挑戦を促す
3. note が自由文でなく学習資産になる
4. 再訪で時間差が価値になる
5. 個人の観察が共同学習とAI改善につながる

言い換えると、ikimon の moat は

- `判定器`

ではなく

- `フィールドメンター + 時系列記録OS`

である。

---

## MVP

全部を一気にやる必要はない。  
最小版は次で十分。

1. 地図上に `観察価値の高い地形・植生エッジ` を表示
2. 地点選択時に `見るべき3項目` を返す
3. 投稿時に `足りない証拠` を返す
4. Field Note を5項目だけ構造化
5. 同地点の前回記録を1件だけ比較表示

これだけで思想は通る。

---

## 実装フェーズ

## Phase 1. Surface Integration

目的:

- 地図
- scan
- note

を一本の体験として見せる。

実施:

- `map.php` / `biodiversity_map.php` / `field_research.php` の導線整理
- 地点カードに `観察論点` を追加
- `Field Scan を始める` 導線追加

完了条件:

- 地図が観察前の意思決定に使われる

## Phase 2. Structured Capture

目的:

- note を reviewable asset に変える

実施:

- 構造化 note 項目追加
- `satellite hypothesis mismatch` の保存
- 投稿UIで `次に撮るべき証拠` を返す

完了条件:

- 写真だけの投稿比率が下がる

## Phase 3. Revisit Loop

目的:

- 単発投稿から脱却

実施:

- 前回比較
- 去年比較
- 管理前後比較

完了条件:

- revisit rate が上がる

## Phase 4. Learning Asset Loop

目的:

- 個人記録を将来のAI資産に変える

実施:

- 衛星仮説と現地観察の差分ログ蓄積
- review 済み記録の学習資産化
- 差分パターンの集計

完了条件:

- `どの仮説が当たりやすいか` をモデル改善に戻せる

---

## KPI

主要:

- first observation completion
- repeat observation rate
- field note completion rate
- reviewable observation rate
- revisit rate

補助:

- suggested check completion rate
- retake rate
- `why not more specific` 閲覧率
- satellite mismatch note rate
- previous observation compare click rate

やってはいけないのは、`map pageview` を主KPIにすること。

---

## 採用条件

- 衛星データを species certainty に直結させない
- 現地での追加観察行動が増える
- note が構造化される
- uncertainty が記録される
- 再訪価値が画面に見える

## 不採用条件

- 衛星画像が見た目の豪華さだけで終わる
- map と note が別体験のまま
- AI が断定口調で強い主張を返す
- 自由記述だけで後から学習資産にできない

---

## 推奨する主画面コピー

### 地図トップ

- `ここで何を見ると、記録の価値が上がるか`

### 現地チェック

- `この場所では、まずこの3つを確かめよう`

### AI Lens

- `いま言えるのはここまで。次はこの証拠を足そう`

### Field Note

- `見えたものだけでなく、環境と迷いも残す`

### Revisit

- `前回と比べると、この場所はこう変わった`

---

## 最終判断

やるべき。  
ただし「衛星画像から種を当てる」に寄せると弱い。

勝つ設計は、

- 衛星画像で観察論点を作り
- 現地で見るべきものを返し
- AI で足りない証拠を示し
- note を構造化し
- 再訪で時系列資産にする

この一連のループにある。

ikimon は `森林を可視化するサービス` で終わってはいけない。  
`人の観察能力を増幅し、場所の記憶を長期資産に変えるサービス` に上げるべきだ。
