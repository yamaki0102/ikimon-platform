# ikimon for-business Phase 4 Execution Todo

更新日: 2026-04-12  
目的: `自然共生サイトモニタリング高速起動` を、実装できる粒度の Todo に落とす。  
前提:

- `docs/strategy/ikimon_nature_site_monitoring_acceleration_plan_2026-04-12.md`
- `docs/strategy/ikimon_renovation_master_plan_2026-04-11.md`
- `C:\Users\YAMAKI\.codex\knowledge\ikimon_biodiversity_os\artifacts\notes\ikimon_identification_system_master_note.md`

---

## 0. 結論

着手順はこれで固定する。

1. LP
2. Site Quickstart
3. Auto Event Bootstrap

この順を崩さない。

理由:

- `何が速く始まるのか` が LP で伝わらないと wizard の価値が伝わらない
- site 作成が迷うと event bootstrap は意味を持たない
- event 自動生成は quickstart が閉じてからの方が acceptance を切りやすい

---

## 1. Track A: LP

### 1.1 対象ファイル

- `upload_package/public_html/for-business/index.php`
- `upload_package/public_html/for-business/pricing.php`
- `upload_package/public_html/for-business/apply.php`
- `upload_package/public_html/components/footer.php`

### 1.2 目的

- `見える化` ではなく `モニタリングをすぐ始められる` を主語にする
- `無料枠`, `初回観察会2件`, `担当者1人でも動ける` を product fact として見せる

### 1.3 必須変更

1. hero の一文を `自然共生サイトのモニタリングを、すぐ始められる。` に固定
2. CTA を `相談する` だけでなく `無料で試す / site を作る` に寄せる
3. flow section を `拠点入力 -> エリア候補 -> 初回観察会2件 -> 記録開始 -> 初回共有` の 5 ステップで出す
4. pricing / apply の文脈を `見える化プラン` ではなく `起動無料・継続有料` に寄せる
5. 制度説明と ikimon の肩代わりする実務を分ける

### 1.4 やらないこと

- GIS 詳説を LP に持ち込まない
- `AI が境界を確定する` と言わない
- `専門家不要` と断定しない

### 1.5 完了条件

- 5 秒で `何が速いか` が伝わる
- `無料でどこまでできるか` が曖昧でない
- `見える化サービス` に見えすぎない

---

## 2. Track B: Site Quickstart

### 2.1 対象ファイル

- `upload_package/public_html/for-business/create.php`
- `upload_package/public_html/site_editor.php`
- `upload_package/public_html/api/` の site / geojson / area candidate 関連
- 必要なら `upload_package/libs/SurveyRecommender.php`
- 必要なら site 保存まわりの `libs/*Site*`

### 2.2 目的

- `住所 or 拠点名入力 -> site 1 件作成` を最短導線で成立させる
- GIS 前提を外す

### 2.3 必須変更

1. `for-business/create.php` を quickstart entry にする
2. 入力を `住所 / 拠点名 / 施設名 / 任意地図指定` に絞る
3. `候補エリア 1-3件` を返す導線を用意する
4. 手修正 UI を `site_editor.php` へ接続する
5. site 保存後に次アクションを `初回観察会を作る` へ一本化する

### 2.4 API / ロジック要件

- 完全自動でなく `候補提示 + 補正`
- source data は attribution と利用条件を出せる前提で扱う
- boundary 候補がない場合も `point-only start` を許す

### 2.5 完了条件

- 担当者が 1 拠点を迷わず作れる
- GeoJSON の知識が不要
- 作成直後の次アクションが 1 つに絞られている

---

## 3. Track C: Auto Event Bootstrap

### 3.1 対象ファイル

- `upload_package/public_html/create_event.php`
- `upload_package/public_html/events.php`
- `upload_package/public_html/event_detail.php`
- `upload_package/public_html/survey.php`
- 関連 event API / `libs/*Event*`
- 必要なら `upload_package/libs/SurveyRecommender.php`

### 3.2 目的

- site 作成直後に `初回観察会 2 件` を product fact にする

### 3.3 必須変更

1. `create_event.php` に quickstart mode を作る
2. `朝 or 日中` と `夕方 or 別分類群` の 2 テンプレを持つ
3. site 作成直後に 2 件まとめて立てる
4. event には `対象エリア / 目安時間 / 推奨分類群 / 目標記録数 / 持ち物` を最低限入れる
5. 発行後の CTA を `参加リンク共有` と `記録開始` に寄せる

### 3.4 同定 stance の反映

- 初回記録は species 強制にしない
- `rough label / 属 / unknown` を正式許容する
- AI は候補提示であって断定にしない

### 3.5 完了条件

- site 作成後 5 分以内に 2 件の観察会が存在する
- event を作った後に `何を共有すればよいか` が明確

---

## 4. 依存関係

### LP -> Site Quickstart

- LP で無料枠と first-run value が固定してから wizard を作る

### Site Quickstart -> Auto Event Bootstrap

- site / boundary / place がないと event template がぶれる

### Auto Event Bootstrap -> Monitoring Workspace

- `何をしたか` が存在して初めて dashboard の次アクションが作れる

---

## 5. Acceptance Matrix

### A. LP

- hero で `高速起動`
- flow で `5 step`
- CTA で `無料開始`

### B. Site Quickstart

- `住所入力`
- `候補返却`
- `手修正`
- `保存`
- `次は観察会`

### C. Auto Event Bootstrap

- `2 event`
- `site linked`
- `sharing CTA`
- `rough label OK`

---

## 6. 実装順の当日 Todo

### Day 1

1. `for-business/index.php` の hero / CTA / flow を高速起動訴求へ差し替える
2. `pricing.php` と `apply.php` の文脈を `起動無料・継続有料` に揃える

### Day 2

1. `for-business/create.php` を quickstart 入口へ作り替える
2. `site_editor.php` の最短フローを整理する

### Day 3

1. site 候補 / area candidate の API 接続を作る
2. `point-only start` fallback を入れる

### Day 4

1. `create_event.php` に quickstart mode を入れる
2. event template 2 本を作る

### Day 5

1. site 作成後に event 2 件自動作成
2. `events.php / event_detail.php / survey.php` の CTA をつなぐ

---

## 7. いまの実装判断

### 今すぐ PHP でやる

- LP copy
- quickstart wizard
- event bootstrap
- workspace の次アクション整理

### v2 まで待つ

- 新規フロント全面刷新
- 高度な地理推定基盤
- shadow sync 前提の本番切替

---

## 8. 直近の Definition of Done

このフェーズで Done と言えるのは次。

1. `for-business/index.php` で高速起動価値が伝わる
2. `for-business/create.php -> site_editor.php` で 1 拠点作成が終わる
3. site 作成後に `初回観察会 2 件` が立つ

これを超える拡張は、その後でよい。
