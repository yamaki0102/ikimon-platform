# ikimon.life BtoBtoC Field Mentor / Long-term Nature Observatory Redesign

> Superseded by `docs/strategy/ikimon_place_first_regional_os_master_plan_2026-04-11.md`

更新日: 2026-04-11

対象:

- `upload_package/public_html/index.php`
- `upload_package/public_html/post.php`
- `upload_package/public_html/wellness.php`
- `upload_package/public_html/corporate_dashboard.php`
- `upload_package/public_html/for-business/index.php`
- `upload_package/public_html/components/nav.php`
- 関連する onboarding / dashboard / site pages

---

## 0. 決定

ikimon.life は、次の形に再定義する。

- 表の定義: `個人が日常の自然接触を続けたくなる Field Mentor`
- 背骨の定義: `場所の変化を長く読み解く Long-term Nature Observatory`
- 裏の定義: `企業が健康経営 / engagement / 自然共生活動を支援できる運用基盤`
- 売り方: `BtoBtoC`
- 主役: `使う個人`
- 支払う理由: `企業の継続支援価値`

この文書は、上記判断を `画面 / 導線 / 優先順位 / 実装順` に落とした再設計基準である。

---

## 1. なぜこの形か

### 1.1 構造上の前提

- 買う主体は企業、学校、地域団体になりやすい
- 実際に毎日使う主体は個人
- 続くかどうかは個人の `自己効力感 / autonomy / competence / relatedness` に依存する
- 企業が払う言語は `健康経営 / engagement / learning / local action / reporting`

### 1.2 棄却する設計

- 企業向けに見えるホーム
- KPI 先行の重い wellness app
- 機能一覧を前面に出すプロダクト
- TNFD / CSR / レポートを主役にする公開トップ
- 強制参加に見える組織導線

### 1.3 採用する設計

- 個人には `今日ひとつ見つける` を売る
- 継続では `この春 / 去年の今ごろ` を返す
- ミッションでは `この場所がどう変わるか` を扱う
- 企業には `社員が自分で続ける体験を支援できる` を売る
- 公開面は軽く、運用面は深くする
- データは `個人の発見` と `組織の可視化` を同じ観察基盤から出す
- 種名だけでなく `effort / site condition / uncertainty` を残せるようにする

### 1.4 心理学の優先順位

- 使命は遠くてよいが、入口は近くする
- hero copy に `10年後` をそのまま出さない
- default comparison は `他人` より `過去の自分`
- 企業は `命令者` でなく `場を支えるスポンサー`

---

## 2. 北極星

### 2.1 個人価値

- 外に出る理由が 1 つ増える
- 小さな発見が積み上がる
- 自分でも続けられる感じが出る
- 同定の正解より `観察の目が育つ感じ` が残る
- その記録が後で `場所の変化` を読む材料になる

### 2.2 企業価値

- 健康経営文脈で `自然接触の習慣化` を支援できる
- engagement や社内つながりの施策に使える
- 拠点ごとの自然共生活動を可視化できる
- 参加状況、継続状況、自然接触ログを無理なく把握できる
- 拠点の長期変化を読む材料を蓄積できる

### 2.3 非目標

- 何でも同定する万能AIを前面に出すこと
- 社会課題ワードの盛り込みで強く見せること
- 公開トップで全機能を説明すること
- 企業管理画面を個人UXに混ぜること

---

## 3. 情報設計の原則

### 3.1 Public first, sponsor second

- 公開面は個人が自然に入りやすいことを優先する
- 企業向け情報は `証拠` として置き、主役にしない

### 3.2 Daily loop first

最優先導線は常に次の 5 ステップに寄せる。

1. 外に出る
2. 1つ見つける
3. 撮る or メモする
4. 候補や気づきを得る
5. 次もやれそうだと思う

### 3.3 Time ladder, not one message

- Home: `今日は何がいた?`
- Habit layer: `この春どうだった?`
- Personal memory: `去年の今ごろと比べる`
- Mission layer: `この場所は10年でどう変わった?`

### 3.4 Team support is ambient

- 会社や団体の存在は `見守る / 誘う / 集める / 祝う` に留める
- `評価する / 監視する / 強制する` に見えるUIを避ける

### 3.5 Need-supportive design

- autonomy: いつやるか、何を見るか、何を残すかを個人が選べる
- competence: 初回で必ず `できた感` が出る
- relatedness: チームや家族とゆるくつながれる

### 3.6 Observation over gamification

- バッジやランキングは補助
- 主価値は `観察文脈の蓄積`

### 3.7 What must be preserved

- taxon
- evidence
- effort
- site condition
- uncertainty
- time series

---

## 4. 新サイトマップ

## 4.1 公開トップレベル

### A. 個人導線

- `/` : Home
  - 役割: 初見に `今日ひとつ見つけるサービス` だと理解させる
  - 主CTA: `今日の一歩を始める`
  - 副CTA: `チームで使う`
- `/post.php` : Quick Capture
  - 役割: 最短で記録を残す
- `/explore.php` : Discover
  - 役割: 興味を広げる
- `/profile.php` : My Nature
  - 役割: 個人の積み上がりを感じる
- `/wellness.php` : My Rhythm
  - 役割: wellness の重いダッシュボードでなく、自然接触の習慣ページに再定義

### B. チーム導線

- `/for-business/` : Team Sponsor Page
  - 役割: 企業・学校・団体向けの説明
  - 主CTA: `チーム導入を相談`
  - 副CTA: `まず個人で触る`
- `/corporate_dashboard.php` : Team Workspace
  - 役割: 管理者向けの参加と継続の可視化
- `/site_dashboard.php` : Place Workspace
  - 役割: 拠点ごとの記録と自然共生活動の可視化

### C. 信頼補強

- `/about.php`
- `/guide/corporate-walking-program.php`
- `/guide/walking-brain-science.php`
- `/guide/nature-positive.php`

公開導線は `個人 -> チーム -> 信頼補強` の順で使う。

## 4.2 ナビゲーション再編

モバイル主ナビは 5 つまでに絞る。

- Home
- Record
- Discover
- My Nature
- Teams

次をトップナビから外すか、2階層目に下げる。

- 企業向け説明の細分化ページ
- methodology 系の深い説明
- dashboard 的な統計ページの乱立
- 重い比較ページ、研究向けページ

---

## 5. 主要3画面の再設計

## 5.1 Screen 1: Home (`index.php`)

### 役割

- 初見に価値を 5 秒で伝える
- ログイン済みには `今日やる理由` を返す

### 画面の骨格

- Hero
  - コピー: 散歩と発見を主語にする
  - CTA 1: `今日の一歩を始める`
  - CTA 2: `チームで使う`
- Today prompt
  - `今日は何を見る?`
  - `花 / 鳥 / 水辺 / 木陰 / まかせる`
- Small win section
  - 直近の個人 or 全体の小さな発見
- Team proof strip
  - `社員散歩 / 学校 / 拠点活動` の導入証拠を薄く表示
- How it works
  - 3 step のみ
- Trust section
  - `企業が導入`, `健康経営文脈`, `自然共生活動にも接続`
  - `今日の記録が、季節や場所の変化を残す` を一段低い熱量で補足

### 捨てるもの

- フィード中心のトップ
- 機能一覧の列挙
- stats を主役にした hero
- 企業向け説明の大量差し込み

### 成功指標

- 新規訪問 -> 記録開始率
- 新規訪問 -> ログイン率
- ログイン済み再訪 -> 記録開始率

## 5.2 Screen 2: Quick Capture / My Rhythm (`post.php` + `wellness.php`)

### 役割

- 最初の成功体験を保証する
- wellness を `評価` でなく `習慣化支援` に変える

### 画面の骨格

- Step 1: いまの場所 / 気分 / 見る対象を軽く選ぶ
- Step 2: 写真を撮る or メモだけ残す
- Step 3: 候補と観察ポイントを返す
- Step 4: `保存できた` を明確に見せる
- Step 5: `次は何を見る?` を返す
- Step 6: 可能なら `site condition` を後で補える

### wellness 側の再定義

現在の `wellness.php` は指標ページ色が強い。
これを次のページに変える。

- 今週の自然時間
- 今週の小さな発見
- 次のおすすめ散歩
- 自己評価 1 問
- チーム参加があれば `今週のチーム散歩`

### 捨てるもの

- 医療っぽい見せ方
- 数字だらけの重いカード
- 根拠の弱い合成スコアを主役にすること
- `正しい種名だけが価値` に見えるUI

### 成功指標

- 記録完了率
- 初回記録完了までの時間
- 7日以内再訪率
- 週次自然接触ログ率

## 5.3 Screen 3: Team Workspace (`corporate_dashboard.php`)

### 役割

- 管理者に `導入してよかった` を感じさせる
- 監視でなく支援の画面にする

### 画面の骨格

- Executive summary
  - 参加人数
  - 継続率
  - 今週の自然接触
  - 拠点別の活動状況
- Team prompts
  - `次にやると良いこと`
  - 例: `昼休み散歩を1回追加`, `拠点Aで3件記録`, `季節イベントを作成`
- Stories
  - 社員の発見を匿名 or 同意ベースで表示
- Place view
  - 拠点ごとの観察と変化
- Reporting
  - 健康経営 / CSR / 自然共生サイト文脈で再利用できる出力

### 企業画面で主に見る指標

- activation rate
- weekly active participants
- repeat participation
- average outdoor minutes
- self-reported restoration
- team-level participation spread
- site observation count

### 捨てるもの

- 専門用語だらけのトップ
- TNFD を起点にした日常運用
- 数字偏重で現場の楽しさが見えない画面

---

## 6. メッセージ設計

## 6.1 個人向け

- `今日ひとつ見つける`
- `名前がわかると、景色が変わる`
- `少し外に出る理由ができる`

## 6.2 現場担当者向け

- `無理なく続く`
- `社員に強制しなくてよい`
- `昼休み / 通勤 / 現場巡回に乗せやすい`

## 6.3 決裁者向け

- `健康経営の実施施策として説明しやすい`
- `エンゲージメントと自然共生活動を一緒に扱える`
- `参加と継続の可視化ができる`

---

## 7. 何を下げるか

次の資産は削除より `露出を下げる` を基本とする。

- `map.php`
- `compare.php`
- `methodology.php`
- 深い guide 群
- 研究者向け / 行政向けの濃い分析画面
- feed 的な一覧中心のホーム構成

理由:

- 初回成功体験に効かない
- 継続率に直接効かない
- BtoBtoC の主導線を散らす

---

## 8. 実装順

## Phase 1. Repositioning

対象:

- `index.php`
- `components/nav.php`
- `components/onboarding_modal.php`
- `for-business/index.php`

やること:

- 公開トップのコピーと情報設計を入れ替える
- ナビを再編する
- `for-business` を営業LPから sponsor page に寄せる

## Phase 2. Daily loop rebuild

対象:

- `post.php`
- `wellness.php`
- `api/get_wellness_summary.php`
- 関連 JS

やること:

- quick capture を最短導線にする
- wellness を `習慣ページ` に変える
- 主観回復感や自然接触の軽量記録を追加する

## Phase 3. Team support rebuild

対象:

- `corporate_dashboard.php`
- `site_dashboard.php`
- `corporate_members.php`
- `corporate_settings.php`

やること:

- 管理画面を支援画面へ寄せる
- 監視でなく participation support を中心にする

## Phase 4. Reporting layer cleanup

対象:

- `generate_*_report.php`
- `for-business/apply.php`
- `guide/*`

やること:

- 営業・報告用の資産を `Team Sponsor Page` から自然につなぐ
- wellness claim を過剰にしない

---

## 9. 実装判断ルール

新規UIや新機能を足す時は、必ず次を確認する。

1. これは個人の自己効力感を上げるか
2. これは autonomy / competence / relatedness のどれを支えるか
3. これは既存生活に編み込めるか
4. これは企業の導入説明に転換できるか
5. これは wellness-washing / greenwashing に寄らないか

1つでも明確に答えられないなら、優先度を下げる。

---

## 10. 最初に着手すべき具体項目

- `index.php` の hero を feed 主体から daily prompt 主体へ差し替える
- `components/nav.php` の情報構造を `Home / Record / Discover / My Nature / Teams` に寄せる
- `for-business/index.php` を `導入営業ページ` から `チームで支える理由の説明ページ` に変える
- `wellness.php` の重い score カードを減らし、自然接触ループ中心に再設計する
- `corporate_dashboard.php` の `契約 / 設定 / 管理` 感を下げ、`参加 / 継続 / 拠点活動` を中心に置く

---

## 11. ひとことで言うと

ikimon.life の再設計は、`企業に売る個人向けアプリ` を作ることではない。

やるべきなのは、

`個人が自分の意思で続けたくなる自然観察体験を、企業が支援しやすい形に包み直すこと`

である。
