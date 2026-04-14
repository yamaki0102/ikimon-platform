# ikimon.life BtoBtoC UI 実装仕様

更新日: 2026-04-11

参照:

- `docs/strategy/ikimon_btobtoc_execution_plan_2026-04-11.md`
- `docs/strategy/ikimon_btobtoc_field_mentor_redesign_2026-04-11.md`

---

## 0. この仕様の目的

この仕様は、BtoBtoC 再設計を実装する際に、各ページで

- 何を残すか
- 何を消すか
- どの順で見せるか
- どの状態なら完了と見なすか

を固定するためのもの。

コード着手時は、この文書を受け入れ条件の正本として使う。

---

## 1. 共通UI原則

## 1.1 ページ共通

- 主役は常に `使う個人`
- `企業向け価値` は証拠として見せるが、主導線を奪わない
- 上から順に `行動 -> 小さな成功 -> 信頼補強` の順で置く
- 1画面目で情報の軸を増やしすぎない

## 1.2 文言共通

使う:

- `今日の一歩`
- `見つける`
- `記録する`
- `続けやすい`
- `チームで支える`

避ける:

- `改善する`
- `治療`
- `健康になる`
- `監視`
- `評価`
- `従業員データを管理`

## 1.3 見せ方共通

- 数字は補助。数字が意味を奪わない
- スコアは主役にしない
- 企業ロゴは必要最小限
- 専門用語は 1画面目に置かない

---

## 2. Home (`upload_package/public_html/index.php`)

## 2.1 ページ目的

- 初見に `日常の自然接触を続けるサービス` と理解させる
- 既存ユーザーに `今日は何をするか` を返す

## 2.2 対象状態

### 未ログイン

- 価値理解
- 記録開始
- ログイン or ゲスト開始

### ログイン済み

- 今日の一歩の選択
- 記録導線への遷移
- 直近の積み上がり確認

## 2.3 画面構成

### Block 1. Hero

必須:

- 一言で価値がわかるコピー
- CTA 1: `今日の一歩を始める`
- CTA 2: `チームで使う`

消す:

- 統計主役の hero
- フィード主役の hero

### Block 2. Today Prompt

必須:

- `今日は何を見る?`
- 4-5 個の選択肢
- 選択後は `post.php` へ文脈付き遷移できる

### Block 3. Small Win

必須:

- 個人 or 全体の最近の小さな発見
- `自分にもできそう` と感じる内容

### Block 4. Team Proof Strip

必須:

- 学校 / 企業 / 拠点で使われている文脈を薄く見せる

禁止:

- 導入企業向け営業コピーの長文化

### Block 5. How It Works

必須:

- 3 step 以内
- `撮る / 気づく / 続ける` の構成

### Block 6. Trust

必須:

- 健康経営文脈
- 自然共生活動文脈
- 科学ガイドへのリンク

## 2.4 既存要素の処遇

- 最新フィード: above the fold から外す
- 総観察数 / 種数: hero 主役から補助へ降格
- followed / mine / unidentified filter: ホーム主導線から外す
- featured surveyor: 補助セクションに格下げ

## 2.5 受け入れ条件

- 5秒以内に `何のサービスか` が言える
- ファーストビューの主CTAは 2 個以内
- フィード一覧が 1画面目の主役にいない
- `個人向けに見えるがチーム導入も可能` が両立している

---

## 3. Global Nav (`upload_package/public_html/components/nav.php`)

## 3.1 目的

- 導線を 5 本に絞る
- 深い機能を露出しすぎない

## 3.2 主導線

- Home
- Record
- Discover
- My Nature
- Teams

## 3.3 露出方針

トップナビに残す:

- Home
- Record
- Discover
- Teams
- Profile / My Nature

2階層目に下げる:

- map
- biodiversity_map
- compass
- 深い guide
- methodology / report 系
- research / admin 補助導線

## 3.4 モバイル優先条件

- 片手で押しやすい
- ラベルが動詞中心
- Teams は `組織で使う` より `Teams` または `チーム` を優先

## 3.5 受け入れ条件

- 5本以上の主導線を持たない
- `さがす / 参加する / 管理する / 説明を見る` が同列に並ばない
- 企業導線が個人導線を食わない

---

## 4. Team Sponsor Page (`upload_package/public_html/for-business/index.php`)

## 4.1 目的

- 企業、学校、団体に対して `導入したくなる理由` を整理する
- 個人主体の世界観を壊さない

## 4.2 ページの役割変更

現状:

- 営業LP
- 料金説明ページ
- CSR / 自治体説明の混在

変更後:

- `チームで支える理由` を説明する sponsor page
- 料金より `導入の意味` を先に見せる

## 4.3 画面構成

### Block 1. Hero

- 見出し: `個人が続けたくなる自然接触を、チームで支える`
- CTA 1: `導入を相談`
- CTA 2: `まず個人で体験`

### Block 2. Why teams use it

- 健康経営
- engagement
- 拠点活動
- 学び / 地域接点

### Block 3. How it works for teams

- 個人は軽く使う
- チームは支える
- 管理者は参加と継続を見る

### Block 4. Use cases

- 企業
- 学校
- 地域 / 施設

### Block 5. Outputs

- 参加状況
- 自然接触ログ
- 拠点活動記録
- 必要に応じたレポート

### Block 6. Pricing / Contact

- 価格は後段
- 無料 Community と相談 Public の関係を明快にする

## 4.4 受け入れ条件

- 個人向け価値が先に理解できる
- 企業向け価値が健康経営の予算言語で説明できる
- `自然に良い / 健康に良い` の過剰主張がない

---

## 5. Quick Capture (`upload_package/public_html/post.php`)

## 5.1 目的

- 最短で記録完了させる
- `できた感` を作る

## 5.2 ページ方針

- 投稿フォームではなく `記録フロー` として扱う
- 入力負荷を減らす
- 既存の重い分岐は段階的開示にする

## 5.3 画面構成

### Step 1. 今日の文脈

- どこで
- 何を見る
- 気分はどうか

入力は軽く、任意を基本とする。

### Step 2. 記録方法

- 写真を撮る
- 写真なしでメモする

### Step 3. 候補 / 観察ポイント

- 候補
- 見分けポイント
- 季節 / 場所の文脈

### Step 4. 保存完了

- `保存できた`
- `次の一歩`
- `チームの散歩を見る` などの補助導線

## 5.4 既存要素の処遇

- surveyor official mode: 残すが一般導線から分離
- EXIF / GPS / event linkage: 補助機能として維持
- 詳細フォーム: 初回では畳む

## 5.5 新規要件

- 写真なし軽量記録の扱いを仕様化する
- 記録完了後の次アクションを返す

## 5.6 受け入れ条件

- 初回利用者が迷わず進める
- 入力前に判断を多く要求しない
- 保存後に `次もやれそう` が返る
- 調査員向けの深い機能が一般利用者の邪魔をしない

---

## 6. My Rhythm (`upload_package/public_html/wellness.php`)

## 6.1 目的

- wellness の数値評価ではなく、自然接触の習慣化を支援する

## 6.2 役割変更

現状:

- 指標閲覧ページ
- 研究引用ページ
- スコアページ

変更後:

- 今週の自然接触ループを整えるページ

## 6.3 画面構成

### Block 1. Weekly Rhythm

- 今週の自然時間
- 何日できたか
- 次にすすめる1歩

### Block 2. Small Wins

- 今週の発見
- 前回との違い

### Block 3. Self Reflection

- 回復感
- 外に出てどうだったか

### Block 4. Team Context

- チームに参加している場合のみ表示
- `今週のチーム散歩`
- `みんなの小さな発見`

### Block 5. Evidence Footer

- 研究根拠は脚注レベルで短く置く
- 本文の主役にしない

## 6.4 既存要素の処遇

- cognitive engagement score: 主役から外す
- emotional wellness の重スコア: 主役から外す
- 科学的エビデンス長文: 折りたたみ or 別導線へ

## 6.5 受け入れ条件

- 数字を見せるより次の一歩を返している
- 健康アプリに見えすぎない
- 個人の内発性を支える
- チーム文脈は補助であり、圧を出さない

---

## 7. Team Workspace (`upload_package/public_html/corporate_dashboard.php`)

## 7.1 目的

- 管理者に、導入価値と次アクションをわかりやすく返す

## 7.2 役割変更

現状:

- 契約 / 設定 / 管理の色が強い

変更後:

- 参加と継続を支援する workspace

## 7.3 画面構成

### Block 1. Executive Summary

- 参加人数
- 4週継続率
- 今週の自然接触
- 拠点稼働状況

### Block 2. Next Actions

- 次にやるとよいことを 3 件以内で表示

### Block 3. Team Story

- 匿名 / 同意ベースで小さな発見を見せる

### Block 4. Site Activity

- 拠点ごとの動き
- 記録ゼロや空白期間の発見

### Block 5. Reporting

- 健康経営
- CSR
- 自然共生活動

## 7.4 既存要素の処遇

- plan / locale / timezone: 設定領域へ後退
- lifecycle / contract warnings: 必要時のみ見せる
- 設定系導線: 2階層目へ

## 7.5 受け入れ条件

- 監視画面に見えない
- KPI だけでなく次の一手がある
- 健康経営担当がそのまま説明に使える

---

## 8. Place Workspace (`upload_package/public_html/site_dashboard.php`)

## 8.1 目的

- 拠点の活動と自然記録を見せる

## 8.2 ページ方針

- 専門分析より `現場で何が起きているか` を先に見せる
- 高度レポートは後段

## 8.3 画面構成

- Overview
- Seasonal review
- Participation / continuity
- Important observations
- Advanced outputs

## 8.4 受け入れ条件

- 拠点責任者が何を見ればよいかわかる
- 詳細分析が初見の邪魔をしない

---

## 9. 状態別受け入れ条件

## 9.1 Guest

- 価値理解
- 記録開始
- ログイン誘導

## 9.2 Logged-in individual

- 今日の一歩が見える
- 記録完了が短い
- My Rhythm に自然につながる

## 9.3 Manager

- Team Sponsor Page から導入相談へ行ける
- Team Workspace で参加と継続が見える
- 拠点画面まで迷わず進める

---

## 10. Definition of Done

この仕様の DoD は、次のとおり。

- 各ページで主役が一貫している
- 主導線が散っていない
- `個人向けに見えるが企業導入も説明できる` が崩れていない
- wellness / nature / team の表現に過剰主張がない

