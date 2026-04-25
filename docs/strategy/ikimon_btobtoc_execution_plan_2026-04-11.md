# ikimon.life BtoBtoC Field Mentor / Long-term Nature Observatory 実行計画

> Superseded by `docs/strategy/ikimon_place_first_regional_os_execution_plan_2026-04-11.md`

更新日: 2026-04-11

参照:

- `docs/strategy/ikimon_btobtoc_field_mentor_redesign_2026-04-11.md`
- `docs/spec/ikimon_long_term_observatory_data_principles_2026-04-11.md`
- `docs/spec/sitemap.md`
- `docs/strategy/ikimon_execution_plan_2026Q2_Q4.md`
- `docs/strategy/ikimon_future_readiness_audit_2026-04-11.md`

対象リリース:

- 公開トップ
- 個人の初回導線
- 習慣化ページ
- チーム導線
- 管理者ワークスペース
- 計測とレポート

---

## 0. この計画の目的

この計画の目的は、ikimon.life を

- `個人が日常の自然接触を続けたくなるプロダクト`
- `企業が健康経営 / engagement / 自然共生活動を支援できるBtoBtoC基盤`
- `場所の変化を長く読み解ける Long-term Nature Observatory`

として再構成するための、実装前提の全体計画を固定することにある。

重要なのは、単にページをリニューアルすることではない。

やるべきことは次の 3 つを同時に成立させること。

1. 個人の継続率を上げる
2. 企業の導入説明を強くする
3. 100年価値を持つ観測設計を埋め込む
4. 今後の実装判断をブレさせない

---

## 1. 今回の決定

### 1.1 プロダクト定義

ikimon.life は `自然観察SNS` ではなく、次のように定義する。

- 個人向け定義: `日常に自然接触と発見を埋め込む Field Mentor`
- 企業向け定義: `社員の自然接触習慣と拠点活動を支援・可視化する基盤`
- 背骨の定義: `場所の変化を長く読み解く Long-term Nature Observatory`

### 1.2 基本方針

- 表のUXは個人向けにする
- 企業向け価値は裏側の導線・計測・レポートで出す
- BtoBtoC だが、C の心理を壊す B にはしない

### 1.3 実装の原則

- 初回成功体験を最優先する
- 公開面では機能の広さを見せない
- wellness を医療っぽく見せない
- 企業管理画面を監視画面にしない
- `自然に良い / 健康に良い` を過剰断定しない
- 入口メッセージに遠い使命をそのまま置かない

---

## 2. 解く問題

## 2.1 現状の主問題

現状の主問題は `機能不足` ではない。

主問題は次の 4 つ。

- ホームが何のサービスか一瞬でわかりにくい
- 個人の初回体験が広く散っていて、自己効力感が立ちにくい
- wellness が `数字を見るページ` に寄りすぎている
- 企業向け価値が `営業資料` と `管理画面` に分離しており、一貫したストーリーになっていない
- 100年視点で何を残すべきかの設計が、画面計画に十分落ちていない

## 2.2 この再設計で解かない問題

この計画では、以下は主対象にしない。

- 正本DBの全面再設計
- AI基盤の大改修
- 学校モデルの完全実装
- 動画 / 音声の大型プロダクト化
- 研究者向け機能の全面刷新

ただし、次は今回スコープに含める。

- `観測データの最低保存原則` の設計
- `taxon / effort / site condition / uncertainty` の扱い方針

理由:

- まず勝ち筋を一つに寄せる必要がある
- 公開面と日常導線を変えないまま基盤だけ直しても、事業面の改善が見えにくい

---

## 3. 対象ユーザーと価値仮説

## 3.1 主要アクター

### A. 日常利用者

- 企業に所属しているが、プロダクトを個人として使う人
- 目的: 少し外に出る理由、発見、気分転換、軽い継続

### B. 現場推進者

- 人事、健康経営担当、総務、サステナ担当、拠点責任者
- 目的: 社員が無理なく参加する施策を回したい

### C. 決裁者

- 経営層、部門責任者、健康経営 / サステナビリティ責任者
- 目的: 導入の説明が立つか、継続投資に値するかを見たい

### D. 拠点管理者

- 工場、事業所、学校、地域拠点の担当者
- 目的: 場所ごとの参加と活動を見たい

## 3.2 価値仮説

### 個人

- `今日やれそう`
- `自分でも見つけられた`
- `少し続けたくなった`

### 企業

- `社員に押しつけずに回せる`
- `健康経営の施策として説明できる`
- `自然共生活動と接続できる`

### 拠点

- `何が起きているかが見える`
- `次に何をやればよいかが見える`

---

## 4. 心理設計の前提

## 4.1 自己効力感

継続の入口は `説明` ではなく `小さな成功体験`。

必要要素:

- 最初の 1 回が短い
- 失敗しにくい
- できたことがわかる
- 次もできそうに見える

## 4.2 自己決定理論

継続には次の 3 要素が必要。

- autonomy
- competence
- relatedness

設計上の翻訳:

- autonomy: 見る対象や参加タイミングを選べる
- competence: `できた感` が明確
- relatedness: チームや家族とゆるくつながれる

## 4.3 job crafting

プロダクトは新しい仕事を増やすのでなく、既存生活に編み込む。

想定文脈:

- 昼休み
- 通勤
- 現場巡回
- 家族散歩
- 拠点イベント

## 4.4 成人発達

ikimon は `正解を即断する機械` より `観察の目を育てる伴走` に寄せる。

設計上の翻訳:

- なぜその候補かを返す
- 見分けポイントを返す
- 季節や場所との関係を返す

## 4.5 心理距離と時間階層

- 初回獲得は `今日 / ここ / 自分`
- 継続は `今季 / 去年の今ごろ / 過去の自分`
- ミッションは `この場所は10年でどう変わったか`

設計ルール:

- hero copy では `10年後` を主語にしない
- 長期価値は trust section, mission page, site workspace に降ろす
- 比較デフォルトは `他人` より `過去の自分`

## 4.6 参加心理の guardrail

- obligation や group pressure を主導線に置かない
- 企業導線は `強制` でなく `支援`
- 初回記録では `正解` より `できた感`

---

## 5. 目標指標

## 5.1 North Star

`週1回以上、自然接触ログを残したアクティブ利用者数`

理由:

- 投稿数だけでは習慣化が見えない
- ログイン数だけでは価値が見えない
- 企業にも個人にも通じる

## 5.2 Observatory 指標

- repeat site revisit rate
- effort field completion
- site condition logging rate
- confidence captured rate
- seasonality coverage

## 5.3 個人指標

- 新規訪問 -> 記録開始率
- 記録開始 -> 記録完了率
- 初回記録完了までの時間
- 7日以内再訪率
- 週次自然接触ログ率
- `次もやれそう` の自己評価

## 5.4 企業指標

- ワークスペース作成率
- 初回招待完了率
- 週次参加率
- 参加の偏りの少なさ
- 4週継続率
- 拠点ごとの活動有無

## 5.5 Guardrail

- wellness claim に関する誤解問い合わせ数
- 管理画面の利用時間が長すぎないこと
- 強制参加感に関するネガティブ反応
- 初回導線での離脱率
- taxon uncertainty を消した記録比率

---

## 6. 再設計の全体像

## 6.1 層の分離

### Layer 1. Public attraction

対象:

- `index.php`
- `components/nav.php`
- onboarding

役割:

- 個人に価値を直感させる

### Layer 2. Daily loop

対象:

- `post.php`
- `wellness.php`
- `dashboard.php` 一部

役割:

- 日常利用を成立させる

### Layer 2.5 Observatory backbone

対象:

- `docs/spec/ikimon_long_term_observatory_data_principles_2026-04-11.md`
- 観測保存方針
- site revisit / confidence / condition

役割:

- 今日の記録を、将来の比較可能なデータへ変換する

### Layer 3. Team sponsor

対象:

- `for-business/index.php`
- `for-business/apply.php`
- `corporate_dashboard.php`

役割:

- 企業導入の説明と運用支援

### Layer 4. Place workspace

対象:

- `site_dashboard.php`
- site / corporate 関連ページ

役割:

- 拠点活動の可視化

### Layer 5. Evidence and reporting

対象:

- `guide/*`
- `generate_*_report.php`
- showcase 系

役割:

- 導入や継続の正当化

---

## 7. 変更対象マップ

## 7.1 変えるページ

- `upload_package/public_html/index.php`
- `upload_package/public_html/post.php`
- `upload_package/public_html/wellness.php`
- `upload_package/public_html/for-business/index.php`
- `upload_package/public_html/corporate_dashboard.php`
- `upload_package/public_html/components/nav.php`
- `upload_package/public_html/components/onboarding_modal.php`

## 7.2 露出を下げるページ

- `map.php`
- `compare.php`
- `methodology.php`
- 深い `guide/*`
- 研究者向け・行政向け分析ページ
- フィード主導のホーム要素

## 7.3 後段に回すページ

- `site_dashboard.php` の深い分析画面
- `dashboard_portfolio.php`
- `dashboard_municipality.php`
- 重いレポート機能

---

## 8. フェーズ計画

## Phase 0. 仕様固定

期間目安:

- 2-3日

目的:

- 方針を動かない基準にする

成果物:

- 本計画
- 再設計メモ
- 成功指標一覧
- 用語方針

完了条件:

- `表は個人 / 裏は企業` を全ページで維持する判断が固まる
- 実装対象ページの優先順が固定される

## Phase 1. Public Repositioning

期間目安:

- 5-7日

対象:

- `index.php`
- `components/nav.php`
- `components/onboarding_modal.php`
- `for-business/index.php`

目的:

- 公開面の主メッセージを切り替える

やること:

- hero を daily prompt 型へ変更
- CTA を `今日の一歩` と `チームで使う` に整理
- top nav を 5導線中心に再編
- `for-business` を sponsor page に変換

完了条件:

- 初見で個人向け価値が伝わる
- 企業説明が個人主役を壊さない
- トップから深い機能説明を減らせている

依存:

- なし

## Phase 2. Daily Loop Rebuild

期間目安:

- 7-10日

対象:

- `post.php`
- `wellness.php`
- `api/get_wellness_summary.php`
- 関連JS

目的:

- 初回成功体験と習慣ページを作る

やること:

- 記録導線を短くする
- 写真あり / メモのみを整理
- wellness を習慣ページに作り替える
- 主観回復感など最小入力を設計

完了条件:

- 3分以内で記録完了できる
- `wellness` が評価画面でなく次の一歩の画面になっている
- 指標が医療っぽくなりすぎない

依存:

- Phase 1 の公開導線

## Phase 3. Team Sponsor Rebuild

期間目安:

- 7-10日

対象:

- `corporate_dashboard.php`
- `corporate_members.php`
- `corporate_settings.php`
- `for-business/apply.php`

目的:

- 管理画面を支援画面に変える

やること:

- Executive summary の再定義
- `次にやること` を支援導線にする
- 監視ではなく participation support を中心にする
- 企業申し込み導線を簡素化する

完了条件:

- 管理者が `参加 / 継続 / 拠点活動` を一目で理解できる
- KPI より次アクションが先に見える
- 健康経営文脈で説明しやすい

依存:

- Phase 1
- 一部は Phase 2 の指標定義

## Phase 4. Place and Evidence Cleanup

期間目安:

- 5-7日

対象:

- `site_dashboard.php`
- `guide/*`
- `generate_*_report.php`

目的:

- 拠点価値と導入証拠の見せ方を整理する

やること:

- 拠点画面の役割を `活動の可視化` に揃える
- guide 群の導線を整理
- レポート導線を sponsor page から自然接続

完了条件:

- 企業導線が `営業 -> 管理 -> 拠点 -> 証拠` で一貫する
- 過剰な主張を避けられる

依存:

- Phase 3

## Phase 5. Exposure Reduction and Archive Strategy

期間目安:

- 3-5日

対象:

- 露出を下げる対象ページ群
- ナビ / リンク / CTA

目的:

- 主導線を散らす要素を減らす

やること:

- トップからのリンクを削減
- 深いページは 2階層目へ移動
- 旧説明導線を整理

完了条件:

- 主導線が 3 本以上に割れない
- `どこから始めるべきか` が明確

依存:

- Phase 1-4

---

## 9. フェーズ別の詳細タスク

## 9.1 Phase 1 タスク

- `index.php` から feed first な hero を外す
- `today prompt` セクションを新設する
- public stats は補助証拠に下げる
- `for-business/index.php` の見出しを `導入営業` から `チームで支える理由` に変える
- nav の主導線を 5 個に固定する

## 9.2 Phase 2 タスク

- `post.php` の最初の判断数を減らす
- 撮影なし記録の取り扱いを再定義する
- `wellness.php` のカード構成を全刷新する
- `気分` と `回復感` を軽量に取る仕組みを決める
- 記録完了後の `次の一歩` UI を作る

## 9.3 Phase 3 タスク

- `corporate_dashboard.php` のカードを `契約 / 管理` から `参加 / 継続 / 拠点` へ変更
- 現場担当向けの CTA を明確化する
- メンバー招待導線を簡素化する
- `corporate_settings.php` の露出を下げる

## 9.4 Phase 4 タスク

- `site_dashboard.php` の主要タブを整理する
- report 出力を裏方に回す
- guide 群の役割ごとにリンクを集約する

## 9.5 Phase 5 タスク

- ナビから外すページを決める
- link audit を実施する
- archive / noindex / 2階層目送りを仕分ける

---

## 10. データと計測の実装方針

## 10.1 今回増やす計測

- `home_cta_start`
- `home_cta_team`
- `capture_started`
- `capture_completed`
- `weekly_rhythm_viewed`
- `restoration_self_reported`
- `team_workspace_viewed`
- `team_prompt_clicked`

## 10.2 今回まだやらない計測

- 医学的解釈を伴う詳細健康指標
- 高度な個別最適レコメンド
- 多変量の wellness スコア

## 10.3 データ取り扱いの注意

- `健康改善` の断定に見える変数名を避ける
- 自己申告は `参考指標` として扱う
- 企業が個人の詳細心理状態を監視しているように見せない

---

## 11. リスクと対策

## Risk 1. 企業向け価値が弱く見える

対策:

- sponsor page と corporate dashboard に説明責任を寄せる
- 公開トップでは証拠を薄く残す

## Risk 2. wellness が弱く見える

対策:

- 数字ではなく継続支援を価値として定義する
- `回復感 / 屋外時間 / 続けやすさ` を軸にする

## Risk 3. 既存機能利用者が迷う

対策:

- 深いページは消さずに露出だけ下げる
- ナビ変更は段階的に行う

## Risk 4. 実装が拡散する

対策:

- フェーズ完了条件を満たすまで次へ行かない
- 1フェーズごとに効果確認する

---

## 12. 各フェーズの完了判定

## Phase 1 完了判定

- トップが `個人の今日の一歩` を主語にしている
- B向け説明が裏側へ回っている

## Phase 2 完了判定

- 初回記録完了が短い
- `wellness` が `次の一歩` を返す

## Phase 3 完了判定

- 管理者が次の一手を見つけやすい
- 監視感が減っている

## Phase 4 完了判定

- 拠点価値と導入証拠の見せ方が一貫している

## Phase 5 完了判定

- 主導線が散っていない
- 露出整理で迷いが減っている

---

## 13. 実装開始時の順番

実装は次の順番以外で始めない。

1. `index.php`
2. `components/nav.php`
3. `for-business/index.php`
4. `post.php`
5. `wellness.php`
6. `corporate_dashboard.php`
7. `site_dashboard.php`
8. 露出整理

理由:

- 公開面を変えずに裏側だけ変えても改善が見えない
- 個人導線を固めずに企業導線を磨くと、BtoBtoC が崩れる

---

## 14. 実装時の禁止事項

- KPI を公開トップの主役にしない
- 企業ロゴや導入企業文脈を前面に出しすぎない
- 医療効果に見えるコピーを入れない
- 監視や評価に見える文言を使わない
- 深い機能をまたトップへ戻さない

---

## 15. ひとことで言うと

この計画の本質は、`ikimon.life を企業向けにすること` ではない。

本質は、

`個人が続けたくなる自然観察体験を中核に据えたまま、企業が導入しやすい構造に再配線すること`

である。
