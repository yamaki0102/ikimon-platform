# FieldScan アップグレード計画 2026-04-04

## 前提

> 詳細な 10x 実装計画は `docs/strategy/fieldscan_10x_data_os_implementation_plan_2026-04-04.md` を参照。

この計画は次の3系統を突き合わせて作成した。

- 現行実装
  - `mobile/android/ikimon-pocket/.../FieldScanService.kt`
  - `mobile/android/ikimon-pocket/.../VisionClassifier.kt`
  - `mobile/android/ikimon-pocket/.../AudioClassifier.kt`
  - `upload_package/public_html/fieldscan.php`
  - `upload_package/public_html/api/v2/passive_event.php`
- 既存戦略文書
  - `docs/strategy/fieldscan_implementation_roadmap.md`
  - `docs/strategy/walk_livescan_unification.md`
- 外部参照
  - note: Gemma4 と Qwen3.5 の比較記事
  - Google AI for Developers / Google Developers Blog
  - Merlin Bird ID / Seek by iNaturalist の公式情報

---

## 結論

FieldScan のアップグレード余地は大きい。  
ただし根本課題は「もっと賢い汎用ローカルLLMを載せること」ではない。

根本課題は次の3つ。

1. **実装と訴求のズレ**
   - 公開ページでは BirdNET V3 + Perch v2 のデュアル音声を訴求しているが、Android 実装の主系統は BirdNET 単体で、Perch 連携は主経路に入っていない。
2. **視覚AIの責務過多**
   - Gemini Nano 系で「種同定」と「環境分析」を同じ生成系フローに背負わせている。これは説明生成には向くが、分類の再現性と検証性が弱い。
3. **記録体験の分断**
   - `field_research.php` と `field_scan.php` と `walk.php` が並立し、記録量を最大化する導線になっていない。

要するに、**FieldScan は AI モデル不足よりも、役割分離不足と、貢献実感を返す設計不足がボトルネック**。

---

## 外部比較からの示唆

### 1. note 記事が示すもの

note 記事では、2026-04-03 時点で Gemma4 はローカル利用で安定性と tools 対応が強み、Qwen3.5 系は長コンテキストと柔軟性が強みという評価になっている。

ここから得られる示唆は1つだけでよい。

- **ローカルLLMは補助用途には使えるが、FieldScan の最優先は情報収集量と証拠品質の最大化**

逆に、FieldScan の主目的である以下は、汎用LLMの単純置換では改善しにくい。

- 種同定精度
- 推論の再現性
- 後からの監査可能性
- Evidence Tier の自動昇格

### 2. Google 公式からの示唆

Google の Gemma 系モバイル資料は、Gemma をモバイル上で動かす用途を主に **text-to-text generation** として案内している。  
つまり FieldScan では、Gemma/Gemini 系を使うとしても、収集系より後段に置くべき。

- セッション要約
- 後処理での構造データ説明
- 研究者向け叙述生成

### 3. 競合アプリからの示唆

Merlin と Seek の強みは明確。

- **Merlin**
  - オフラインでの Photo ID / Sound ID
  - 鳥という狭い対象に絞った高い即応性
- **Seek**
  - リアルタイム画面フィードバック
  - プライバシー優先
  - 初心者向けの摩擦の低さ

ikimon.life / FieldScan が勝てる余地は、単純な識別アプリ競争ではない。

- **視覚 + 音声 + 環境 + GPS + 長期アーカイブ**
- **その記録が ikimon.life 上で社会的価値に変換されること**
- **個人の1回の散歩が、地域全体の生態系ログを前進させたと実感できること**

つまり勝ち筋は「最強の識別器」ではなく、**最強のフィールド記録OS兼貢献可視化OS**。

---

## 現行実装の診断

### A. すぐ直すべきズレ

1. **デュアル音声の実装ギャップ**
   - LP/紹介ページでは Perch v2 併用を前提にしている。
   - しかし Android の `FieldScanService.kt` は BirdNET 系中心。
   - これはプロダクト信頼を削る。

2. **視覚推論の構造化不足**
   - `VisionClassifier.kt` は JSON を生成させて後段でゆるく parse している。
   - taxon 値の妥当性チェック、候補群、分類根拠、既知分類体系への正規化が不足。

3. **環境分析が保存価値に直結していない**
   - `analyzeEnvironment()` はログ出力中心で、保存スキーマと活用導線が弱い。

4. **体験の断絶**
   - 既存の統合構想は正しいが、まだ product surface が統一されていない。

### B. 伸びしろが大きい領域

1. **ローカルLLMの使いどころ再定義**
   - 種同定ではなく、後処理の要約・叙述に限定する。
2. **Evidence Tier をエンジン合意ベースに昇格**
   - 視覚単体 confidence ではなく、音声・環境・位置・季節整合で昇格。
3. **環境タイムカプセルの可視化**
   - 将来価値はここに最もある。
4. **自己効力感 / 集団効力感の設計**
   - 何種拾ったかより、どれだけ記録がたまり、空白を埋め、共同観測に寄与したかを返す。

---

## 実行計画

## Phase 0. Truth Alignment

目的: 実装と訴求を一致させる。

### 実施項目

1. `fieldscan.php` の訴求内容を実装準拠に修正
   - Perch 未統合なら「開発中」表記に下げる
   - 逆に Perch を即入れするなら先に実装を終える
2. Android 実装の機能棚卸しを CI で出力
   - 利用中モデル
   - 端末要件
   - オフライン可否
3. 「現在できること / 近日対応」を公開仕様として固定

### 完了条件

- マーケ表現と実装の食い違いがゼロ

---

## Phase 1. モデル責務の分離

目的: 種同定と環境理解を分ける。

### 実施項目

1. **視覚AIを二層化**
   - 第1層: 軽量な closed-set / taxonomy-aware classifier
   - 第2層: Gemma/Gemini 系で説明生成と環境記述
2. `VisionClassifier.kt` の出力を構造化
   - `top_candidates[]`
   - `taxon_rank`
   - `evidence_features`
   - `reason_codes`
3. サーバー側で taxonomy 正規化
   - 学名揺れ
   - rank の妥当性
   - 地域外候補の抑制

### モデル方針

- **Gemma4 / Qwen3.5 を主分類器にはしない**
- 使うなら次用途に限定
  - セッション要約
  - 現地の短文ガイド
  - ユーザーへの「なぜこの候補か」説明

### 完了条件

- 種同定結果が再現可能な構造データで残る

---

## Phase 2. デュアル音声を本当に実装する

目的: 音声の証拠強度を上げる。

### 実施項目

1. BirdNET + Perch の並列推論
2. `DetectionEvent` を複数エンジン対応に拡張
   - `engines.birdnet`
   - `engines.perch`
   - `consensus`
   - `fused_confidence`
3. サーバー側 `passive_event.php` を複数エンジン前提へ拡張
4. Evidence Tier 昇格ルール追加
   - 合意
   - 季節一致
   - 生息地一致

### 完了条件

- 「デュアル音声」が LP 文言ではなく実データに残る

---

## Phase 3. さんぽ体験の統合

目的: 記録量を増やす。

### 実施項目

1. `field_research.php` を唯一のフィールド入口にする
2. `field_scan.php` と `walk.php` は段階的に統合 / リダイレクト
3. モードは3つだけにする
   - あるく
   - スキャン
   - 静か
4. セッション終了画面を「自然版 Fitbit」へ再設計

### 重要指標

- セッション開始率
- 10分以上継続率
- 同期完了率
- 1セッションあたり記録数
- セッションあたり環境スナップショット数
- セッションあたり有効観測分数
- 空白メッシュ更新数

### 完了条件

- ユーザーがどのページを使うべきか迷わない

---

## Phase 4. 環境タイムカプセルを主役にする

目的: Merlin / Seek が持たない価値を前面化する。

### 実施項目

1. `env_history` を構造化スキーマ化
2. 環境スナップショットを検出単位でも保存
3. セッション詳細で時系列可視化
   - 気圧
   - 照度
   - 音響指数
   - GPS 軌跡
4. 「去年の今頃」と比較するタイムカプセル UX を接続

### 完了条件

- 1回の散歩が単なる検出ログではなく、再訪比較できる環境記録になる

---

## Phase 4.5. 貢献可視化レイヤー

目的: 種の当たり外れではなく、データ蓄積と共同観測への寄与を返す。

### 実施項目

1. セッション終了画面の主指標を変更
   - 種数を主役にしない
   - 代わりに以下を前面に出す
     - 記録分数
     - 収集した環境スナップショット数
     - 音・景観・位置の有効データ点数
     - 新規メッシュ / 再訪メッシュ
2. 「今回たまったデータ」カード
   - 例:
     - 音声ログ 18件
     - 環境ログ 42件
     - 移動軌跡 1.8km
     - 証拠写真 6件
3. 「今回の貢献」カード
   - 例:
     - この地点の春データが 3 回目になった
     - この 500m メッシュの朝帯データが初めて埋まった
     - 先週比で地域の環境ログ密度が 12% 上がった
4. 「みんなで集めた結果」カード
   - 例:
     - 今月この地域で 84 セッション
     - 参加者 21 人
     - 収集時間 39 時間
     - 未観測時間帯があと 2 枠
5. 貢献メトリクスの導入
   - `personal_data_contribution_score`
   - `community_coverage_gain`
   - `repeatability_score`
   - `archive_value_score`

### UI 原則

1. **自己効力感**
   - 「自分の散歩でデータが増えた」
2. **集団効力感**
   - 「みんなの蓄積の一部を自分が前進させた」
3. **希少種依存からの脱却**
   - レア種が出なくても価値を返す
4. **比較対象は他人の強さではなく、地域データの前進**
   - 競争よりカバレッジ前進を主役にする

### 完了条件

- セッション後に「今日は何も見つからなかった」ではなく
- 「今日はこれだけデータを前に進めた」と認識できる

---

## Phase 5. ローカルLLMを正しい位置に置く

目的: Gemma4 / Qwen3.5 を使うなら、収集を邪魔しない後段に置く。

### 優先ユースケース

1. **セッション要約**
   - 3行要約
   - 今日の特徴
   - 前回との差分
2. **研究者向け説明生成**
   - 構造データから自然文に変換
3. **貢献説明生成**
   - 今回の散歩で何が蓄積されたか
   - 地域全体にどう効いたか

### 当面やらない用途

1. 現地ガイド
2. リアルタイム会話アシスタント
3. 観察中の長文説明表示

### 非優先ユースケース

- 生物種の最終決定を LLM 単独に任せること
- free-form JSON 前提の分類パイプライン継続
- 観察中に UI を占有する説明機能

### 完了条件

- LLM が「分類器」ではなく「後処理の叙述エンジン」として働く

---

## 優先順位

### 最優先

1. Phase 0 実装と訴求の整合
2. Phase 1 視覚AIの責務分離
3. Phase 2 デュアル音声の本実装
4. Phase 4 環境タイムカプセル可視化の前提となる収集スキーマ整備
5. Phase 4.5 貢献可視化指標の設計

### 次点

6. Phase 3 フィールド体験統合
7. Phase 4 タイムカプセル可視化

### その次

8. Phase 5 ローカルLLM高度化

---

## やらないこと

1. 「Gemma4 に置き換えれば全部よくなる」という判断
2. 種同定を prompt engineering だけで押し切ること
3. 画面を増やして複雑さで機能追加すること

---

## 90日ロードマップ

### 0-30日

- LP/実装整合
- `VisionClassifier` 出力構造化
- Perch 実装可否の判定
- 計測イベントの設計

### 31-60日

- BirdNET + Perch dual 化
- `passive_event.php` 拡張
- セッションレポート再設計
- 貢献メトリクス算出ロジック実装
- `field_research.php` への統合着手

### 61-90日

- 環境タイムカプセル詳細ページ
- 去年比較 / 前回比較
- 個人 / 地域の貢献ダッシュボード
- ローカルLLMによる要約導入

---

## 成功指標

- 1セッションあたり平均記録数 +30%
- 10分継続率 +25%
- 同期成功率 95%+
- 種同定の expert correction rate 20% 以上改善
- タイムカプセル詳細閲覧率 30%+
- セッション後の再開率 +20%
- 「データ貢献を実感した」自己申告率の上昇
- 地域メッシュの観測カバレッジ増加

---

## 参考

- note: [早速Gemma4とqwen3.5を比べてみた！](https://note.com/lumidina/n/n009585e57d81)
- Google AI for Developers: [Deploy Gemma on mobile devices](https://ai.google.dev/gemma/docs/integrations/mobile)
- Qwen official: [Qwen3: Think Deeper, Act Faster](https://qwenlm.github.io/blog/qwen3/)
- Merlin Bird ID: [公式サイト](https://merlin.allaboutbirds.org/)
- Seek by iNaturalist: [公式ページ](https://www.inaturalist.org/pages/seek_app)
