# ikimon.life 改善提案 — Codex Review

> 作成: 2026-03-21 Codex
> 入力: `IMPROVEMENT_IDEAS_OPUS.md` / `DEVELOPMENT_PLAN.md` / `CLAUDE.md`
> 参照範囲: 戦略文書 + 実装ファイルの存在確認 + 主要ファイルのスポット確認

---

## 結論

私の結論は明確だ。

1. **最優先は Opus #8 の「努力量正規化」だが、その正体は新アルゴリズムではなく、`session` 努力量を Canonical Schema に正しく流し込むこと**。
2. **Opus #1「不在データ」と #7「いつ行けば会える」も有望だが、現状の記録粒度ではまだ科学的に信じられる形にならない**。
3. **いちばん危険なのは Opus #6「全フレーム保存」で、これはプロダクト価値より先に法務・同意・保持期限・削除導線を壊す可能性が高い**。

加えて、コード上の事実として、計画書で「完了」とされているものの一部はまだ運用可能な完成度に達していない。

---

## 0. コード事実から見えた前提差分

### C0-1. 努力量データは受け取っているのに Canonical へ十分に保存していない

`upload_package/public_html/api/v2/passive_event.php` の入力仕様コメントには `duration_sec`、`distance_m`、`route_polyline` がある。  
しかし実際に `CanonicalStore::createEvent()` へ渡しているのは、`event_date`、`lat/lng`、`sampling_protocol`、`recorded_by`、`capture_device` が中心で、努力量の核が落ちている。

一方で `upload_package/libs/CanonicalStore.php` は `sampling_effort`、`coordinate_uncertainty_m`、`geodetic_datum` を既に受け取れる設計になっている。  
つまりボトルネックはスキーマ不足より、**取り込み配線の未接続**だ。

### C0-2. KPI ダッシュボードはまだ「真実を測る装置」になっていない

`upload_package/public_html/poc_dashboard.php` の G2-G5 は実質プレースホルダで、G1 も `total_occurrences / 24` という仮計算になっている。  
`upload_package/libs/CanonicalStore.php` の `getKPIMetrics()` も `by_source`、`by_tier`、`unique_species`、`research_grade_count` までで、レビュー速度や昇格速度、努力量あたり検出量を返していない。

結論として、**PoC の Go/No-Go 判定をまだ信じてはいけない**。

### C0-3. 計画書の成果物と実ファイルにズレがある

`DEVELOPMENT_PLAN.md` では `ConsensusEngine.php` と `SurveyRecommender.php` が成果物として書かれているが、少なくとも今回の確認では該当ファイルは見当たらなかった。  
このズレは些細ではない。実装済みと思い込むと、次の意思決定が全部ずれる。

---

## 1. Opus の10提案への批判的レビュー

| ID | 提案 | 判定 | 優先度 | 評価 |
|---|---|---|---|---|
| O1 | 不在データの記録 | 推進 | 今週 | 強い。Opus の中でも本筋。だが「検出ゼロを保存する」だけでは不十分で、`complete checklist` と `target taxa scope` が無い不在は科学的には弱い。`passive_event.php` と `CanonicalStore.php` に `occurrence_status`, `is_complete_checklist`, `survey_target` を足すべき。 |
| O2 | スペクトログラム自動生成 | 条件付き推進 | 今月 | Reviewer UX には効く。だがスペクトログラムは証拠の代替ではなく、証拠の見やすい派生物だ。原音ハッシュ、保存形式、再生成可能性を先に決めるべき。 |
| O3 | カメラ×マイクのクロスモーダル検証 | 推進 | 今月-次四半期 | 競争優位になり得る。ただし「同時刻・同地点・同対象」の定義が曖昧なままだと誤ブーストを起こす。`sensor_tick_id` や `capture_window_ms` を導入してからやるべき。 |
| O4 | 歩行速度をハビタット指標に使う | 保留 | 将来 | 面白いが擬似相関が多すぎる。信号、坂、撮影、疲労、同行者、犬、通行止めでも減速する。研究用の探索仮説としては良いが、今のプロダクト指標に入れるのは危険。 |
| O5 | Soundscape Ecology | 条件付き推進 | 次四半期 | BirdNET 非依存の生態系指標として価値がある。ただしスマホ機種差、AGC、ノイズ抑制、風切り音の影響が大きい。先に端末校正が必要。 |
| O6 | 全フレームを学習データ保存 | 凍結 | 将来 | いま最も危険。人物、私有地、車番、会話、子どもの声が混じる。PoC 段階でやると法務・信頼・ストレージ・削除請求対応を同時に背負う。学習データ化は同意管理と匿名化基盤の後。 |
| O7 | 「いつ行けば会える」予測 | 推進 | 次四半期 | UX と継続率には効く。ただし不在データと努力量補正なしでやると「人が多く観察した場所・時間」を再学習するだけになる。O1 と O8 の後。 |
| O8 | 調査努力量の正規化 | 最優先 | 今週 | Opus の中で最重要。しかも新発明ではなく、既に受け取っている `duration_sec`, `distance_m`, `route_polyline` を Canonical に流すのが先。ここをやらない限り、予測も比較も KPI も歪む。 |
| O9 | ハビタット連続性マッピング | 保留 | 将来 | 価値はあるが、ルート幾何、連続フレーム品質、土地被覆の基準レイヤ、季節差分が要る。PoC の次段階ではなく、研究トラック。 |
| O10 | 検出パターンから個体数推定 | 凍結 | 将来 | いまやるべきではない。個体数推定は検出独立性、距離、方向、再検出モデル、観測誤差を強く要求する。現データで数を出すと、ユーザーに「数字が出たから正しい」という誤信を与える。 |

### 提案以上に重要なもの

- **R1. 努力量の Canonical 接続**  
  Opus #8 の中身はここ。`passive_event.php` から `sampling_effort`, `distance_m`, `duration_sec`, `route_polyline`, `session_mode`, `is_complete_checklist` を正規化保存する。

- **R2. KPI の真値化**  
  ダッシュボードの見た目より先に、`detections_per_effort_hour`, `tier_promotion_latency`, `review_backlog`, `false_positive_rate` を SQL で出す。

- **R3. 同意・保持期限・公開粒度の運用設計**  
  特に音声とライブスキャンは、性能より先に社会受容性が律速になる。

---

## 2. Opus が見落としている改善提案

| ID | 提案 | 価値 | 実装の方向 |
|---|---|---|---|
| N1 | **Protocol Engine** | 市民科学データを「たまたま取れた記録」と「調査として意味のある記録」に分ける核。 | `walk.php` / `field_scan.php` に `Incidental`, `Stationary`, `Traveling`, `Complete Checklist` を追加。`passive_event.php` で `protocol`, `complete_flag`, `target_taxa_scope` を受け、`CanonicalStore.php` へ保存。 |
| N2 | **Device QA / Calibration** | Soundscape, BirdNET, cross-modal の前提精度を揃える。機種差を放置すると後で全解析が腐る。 | `analyze_audio.php` と evidence metadata に `sample_rate_hz`, `codec`, `agc`, `noise_suppression`, `device_model`, `mic_direction` を保存。短い校正セッションを追加。 |
| N3 | **Reviewer QA と disagreement sampling** | Tier を上げるだけでは品質が担保されない。レビュアー同士のズレを測る必要がある。 | `id_workbench.php` と `EvidenceTierPromoter.php` に blind 2nd review、ランダム監査、レビュアー別一致率を追加。将来的に `ReviewQualityService.php` を分離。 |
| N4 | **Audio / Video Consent Layer** | 法務・倫理・信頼の土台。録音していることが分からないとプロダクト自体が嫌われる。 | `walk.php` / `field_scan.php` 開始前に録音録画の明示、利用目的、保持期間、公開範囲、削除方法を表示。`privacy_access` に `consent_scope`, `retention_until`, `human_voice_redacted` を追加。 |
| N5 | **Offline-first Evidence Ledger** | フィールドでは通信が不安定。証拠欠落や重複送信を防ぐには、端末側で append-only の記録が必要。 | `walk.php` / `field_scan.php` / `sw.js` に content hash 付き local queue を持たせる。サーバーは idempotency key で二重登録防止。 |
| N6 | **Rare Species Embargo Workflow** | 位置丸めだけでは足りない。希少種の公開は「いつ・誰に・どの粒度で見せるか」が本体。 | `PrivacyFilter.php`, `CanonicalStore.php`, `map_observations.php`, `DwcExportAdapter.php` に embargo 期間、解除権限、研究者アクセスを実装。 |
| N7 | **Preservation Pack** | 100年視点で最重要。運用 DB と保存フォーマットを分ける。 | `scripts/export_preservation_pack.php` を追加し、`SQLite + JSONL + DwC-A + media manifest + SHA-256` を夜間出力。 |
| N8 | **Institution-linked Missions** | コミュニティ形成は SNS 化より、学校・公園・企業・自治体との「調査依頼」の方が強い。 | `site_dashboard.php` とチャレンジ機能側に、プロトコル付きミッションと reviewer 割当を実装。市民科学の意味づけが一段上がる。 |

---

## 3. 100年後の視点

### 3-1. いま記録すべき追加フィールド

すでに良い点もある。  
`geodetic_datum`, `coordinate_uncertainty_m`, `taxon_concept_version`, `detection_model_hash` を持ち始めているのは正しい。

ただし、100年後に再利用できるデータとしては、まだ以下が足りない。

| ID | 追加すべき項目 | 理由 | 配置候補 |
|---|---|---|---|
| F1 | `session_start_at`, `session_end_at`, `timezone_name`, `utc_offset_minutes` | 単なる ISO8601 では地域時刻の再解釈が弱い。薄明・夜明けとの再照合にも必要。 | `events` |
| F2 | `effort_duration_sec`, `distance_m`, `area_m2`, `complete_checklist_flag`, `target_taxa_scope` | 不在データ、予測、努力量正規化の最低条件。 | `events` |
| F3 | `route_geometry`, `route_points_count`, `route_hash`, `geometry_encoding` | ルート依存解析、将来の再投影、土地被覆との重ね合わせに必要。 | `event_tracks` 新設 |
| F4 | `weather_source`, `temperature_c`, `humidity_pct`, `wind_m_s`, `cloud_cover`, `moon_phase` | 出現予測や音響解析で再現性が大きく変わる。 | `event_context` 新設 |
| F5 | `audio_sample_rate_hz`, `codec`, `bitrate`, `agc_enabled`, `noise_suppression_enabled`, `mic_orientation` | スマホ音声は機材差が大きい。将来再解析の必須文脈。 | `evidence.metadata` |
| F6 | `device_os`, `app_version`, `sensor_fusion_version`, `clock_offset_ms` | クロスモーダル整合性と再現性のため。 | `events` / `evidence.metadata` |
| F7 | `occurrence_status`, `detection_attempted`, `observation_confidence_method` | present だけではなく absent / uncertain を区別すべき。 | `occurrences` |
| F8 | `model_prompt_version`, `threshold_config`, `candidate_region`, `inference_params` | AI 判定の再実行と比較に必要。 | `occurrences` / `evidence.metadata` |
| F9 | `consent_scope`, `human_voice_redacted`, `retention_until`, `deletion_policy_version` | 音声・映像の社会的寿命を管理する。 | `privacy_access` |
| F10 | `rights_license`, `embargo_until`, `release_decision_by`, `derivative_use_allowed` | 学術再利用と公開可否を将来も判断できるようにする。 | `privacy_access` / `evidence` |

### 3-2. いまの根本問題

`passive_event.php` のコメント上は `duration_sec`, `distance_m`, `route_polyline` を持っている。  
しかし Canonical へそのまま流れていない。

つまり現状は、

- 「何が検出されたか」は残る
- 「どういう努力の末に検出されたか」が残りにくい

という構造になっている。  
100年後に価値を持つのは後者を含む記録だ。

### 3-3. 長期保存戦略

1. **運用 DB と保存フォーマットを分離する**  
   `SQLite` は運用に向くが、それだけを「最終保存形式」にしない。

2. **毎日 Preservation Pack を出力する**  
   推奨構成: `SQLite snapshot` + `JSONL` + `DwC-A` + `media manifest.csv` + `checksums.txt` + `README.md`

3. **メディアはハッシュと派生物を分ける**  
   原音、派生スペクトログラム、公開用圧縮版を区別し、それぞれに SHA-256 を付ける。

4. **年1回の再エクスポートを制度化する**  
   スキーマ、分類体系、AI モデル、権限設定が変わるので、年次で保存パックを再生成する。

5. **オフサイトとオフラインの両方を持つ**  
   クラウド保管だけでなく、定期的な冷バックアップを別媒体に持つ。

---

## 4. 気をつけるべき落とし穴

### P1. 「AI が出した種名」をそのまま事実扱いしない

Merlin の公式 Help でも、Sound ID の候補は出発点であり、最終確認は利用者が行うべきだと明言している。  
ikimon.life でも Tier 1 はあくまで「候補」であり、「自動検証済み事実」ではない。

### P2. opportunistic data と structured survey data を混ぜない

eBird は complete checklist と effort 情報を重視し、距離・日付・プロトコルに問題がある checklist は非公開扱いにもする。  
ikimon.life でも `walk` と `live-scan` を一括で同じ重みの科学データにしてはいけない。

### P3. 希少種は「位置精度」だけでなく「公開タイミング」も管理する

環境省は希少種の詳細分布情報を保全上の理由で非公開にする運用を明示している。  
`obscure` だけでは足りず、embargo と trusted access が必要だ。

### P4. 音声・映像は個人情報になり得る

個人情報保護委員会の Q&A では、録音内容から個人識別できる場合は個人情報に該当し得るし、音声特徴を本人認証に使える形へ変換した場合は個人識別符号になり得る。  
また、カメラ取得が本人に容易に認識可能でない場合は、掲示等の措置が必要と整理されている。

### P5. 自転車・自動車モードは安全と法令順守をプロダクト仕様に埋め込むべき

警察庁は「ながらスマホ」が自動車・自転車とも法律で禁止されていると明示している。  
`field_scan.php` の bike / car モードは、UI での手動操作や画面注視を前提にしてはいけない。  
少なくとも bike / car は「開始後は自動・停止後にレビュー」に寄せるべきだ。

### P6. 計画書の「完了」と実装の「運用可能」は別物

今回確認した限りでも、PoC ダッシュボードの KPI は仮値が残り、計画書記載の一部ファイルは未確認だった。  
この状態で高度な提案を積むと、土台が見えないまま上物だけが増える。

---

## 5. 実装優先度マトリクス

### 5-1. Impact × Cost

| 区分 | 項目 |
|---|---|
| 高影響 × 低コスト | O8 努力量正規化, O1 不在データ, N1 Protocol Engine 最小版, R2 KPI 真値化, N4 Consent Layer 最小版 |
| 高影響 × 高コスト | O3 クロスモーダル検証, O7 出現予測, N5 Offline Ledger, N6 Embargo Workflow, N7 Preservation Pack |
| 低影響 × 低コスト | O2 スペクトログラム, N3 disagreement sampling 最小版 |
| 低影響 × 高コスト | O4 速度ハビタット, O9 連続性マッピング, O10 個体数推定, O6 全フレーム学習データ化 |

### 5-2. 今週やるべき

1. `passive_event.php` から `duration_sec`, `distance_m`, `route_polyline`, `complete_checklist_flag` を Canonical に流す
2. `occurrence_status` と `survey_target` を追加し、不在データを保存できるようにする
3. `CanonicalStore::getKPIMetrics()` を拡張し、`detections_per_effort_hour`, `review_latency`, `promotion_latency`, `review_backlog` を返す
4. `poc_dashboard.php` の G1-G7 を仮値から実値に置き換える
5. `walk.php` / `field_scan.php` に録音・録画・公開範囲の明示 UI を入れる

### 今月やるべき

1. スペクトログラム生成を非同期ジョブ化する
2. blind second review と reviewer 一致率計測を入れる
3. 希少種 embargo と trusted reviewer / trusted researcher アクセスを設計する
4. Device QA メタデータを evidence に保存し始める

### 次四半期

1. `sensor_tick_id` を基盤にクロスモーダル検証を入れる
2. 努力量補正済みデータだけで「いつ行けば会える」を出す
3. soundscape 指標を pilot として限定公開する
4. 学校・公園・企業向けの protocol 付き mission を立ち上げる

### 将来検討

1. 歩行速度ハビタット指標
2. ハビタット連続性マッピング
3. 個体数推定
4. 全フレーム保存による学習データ基盤

---

## 6. 実装順の推奨

### Sprint A: 観測設計をつなぐ

- `upload_package/public_html/api/v2/passive_event.php`
- `upload_package/libs/CanonicalStore.php`
- `upload_package/public_html/walk.php`
- `upload_package/public_html/field_scan.php`

やること:

- 努力量
- complete / incomplete
- target taxa
- occurrence_status
- route geometry

を Canonical に保存する。

### Sprint B: 測定可能にする

- `upload_package/libs/CanonicalStore.php`
- `upload_package/public_html/poc_dashboard.php`
- `upload_package/public_html/id_workbench.php`

やること:

- Tier backlog
- review latency
- promotion latency
- detections per effort hour
- false positive audit

を可視化する。

### Sprint C: 社会実装できる形にする

- `upload_package/libs/PrivacyFilter.php`
- `upload_package/public_html/walk.php`
- `upload_package/public_html/field_scan.php`
- `upload_package/libs/DwcExportAdapter.php`

やること:

- consent
- retention
- embargo
- trusted access
- export policy

を整える。

---

## Sources

- Personal Information Protection Commission, Q&A on APPI  
  https://www.ppc.go.jp/personalinfo/faq/APPI_QA/
- Personal Information Protection Commission, APPI Guidelines (General Rules)  
  https://www.ppc.go.jp/files/pdf/250324_guidelines01.pdf
- National Police Agency, leaflet on smartphone use while driving/riding  
  https://www.npa.go.jp/bureau/traffic/keitai/r7_leaflet_nagaeasumaho_jp.pdf
- Ministry of the Environment, handling of non-public rare species distribution information  
  https://www.env.go.jp/press/press_01830.html
- eBird Help, review process  
  https://support.ebird.org/en/support/solutions/articles/48000795278-the-ebird-review-process
- eBird Help, complete checklists and best practices  
  https://support.ebird.org/en/support/solutions/articles/48000967748-birding-as-your-primary-purpose-and-complete-checklists
- eBird Help, rules and best practices  
  https://support.ebird.org/en/support/solutions/articles/48000795623-ebird-rules-and-best-practices
- Merlin Help, Sound ID  
  https://support.ebird.org/en/support/solutions/articles/48001185783-sound-id

---

## 次の進化

1. **すぐやる価値があるもの**  
   `IMPROVEMENT_IDEAS_CODEX.md` を基に、`passive_event.php` と `CanonicalStore.php` の差分仕様書を 1 本に落とし、努力量・不在・protocol の追加項目を確定する。

2. **中期で効くもの**  
   reviewer 運用をコードと制度の両方で設計し、Tier の昇格を「主観的承認」ではなく「測定可能な品質管理フロー」に変える。

3. **10x 改善につながるもの**  
   運用 DB と保存パックを分離し、`Preservation Pack + protocol missions + trusted access` を組み合わせて、単なる観察アプリではなく「100年残る地域生物多様性インフラ」に進化させる。
