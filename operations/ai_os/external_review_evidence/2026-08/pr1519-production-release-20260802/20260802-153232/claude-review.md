以下、指定の観点（本番リリース安全性／プライバシー・信頼オリジン境界／ベースラインゲートの真正性／厳密SHAのステージング・本番証跡／ロールバック準備／欠落P0・P1）に沿ってレビューします。パケット本文を直接評価しており、リポジトリの読み取り・変更は行っていません。

## 1. 採用すべき点

- **プライバシー境界の設計順序が正しい**：適格性判定を dedup の「前」に置き、private / blurred / blocked-public を除外している。順序が逆だと重複排除の副作用で除外漏れが起きうるため、この順序は妥当。
- **画像の非合成方針**：0〜5枚状態を fixture-backed に限定し imagery を合成しない、という明示は、ゲストフィードへの実ユーザー画像混入を構造的に避けられる正しい姿勢。
- **信頼オリジンの一元化**：robots / sitemap / LLM discovery / OAuth callback / CSRF が同一の trusted-origin 解決を共有する集約は、境界の二重定義による齟齬を防ぐ良い設計。
- **SVG の nosniff + CSP** と、SVG 本文を保持しつつ制限を掛ける方針。
- **staging noindex / production 限定の discovery** の分離。
- **ローカル検証の網羅**：typecheck / Node 1,674 pass / build / Worker 437 pass / production quick preflight（exact SHA、`productionDeployExecuted=false`、dry-run は read-only）まで揃っており、着手前提の健全性は高い。
- **ベースライン修復を別PR(#1524)に分離**し、3件のPG P1を「移行済・退役・無視可」と偽らず report が引き続き surface している点は、真正性の観点で正しい取り扱い。

## 2. 重大な懸念

1. **Worker-owned marker のなりすまし耐性が未証明**。「forwarded ヘッダは Worker所有マーカー＋allowlist host を要求」とあるが、外部クライアントが同名マーカー＋allowlist内 host を直接送った場合に origin 側で拒否される保証（inbound でのマーカー除去、または origin が Worker 以外からの経路を信頼しない仕組み）がパケットに無い。ここが崩れると trusted-origin 解決全体（CSRF・OAuth callback生成・discovery）が同時に破れる。**本リリースの安全性の土台**。
2. **ロールバック証跡が皆無**。ポリシーと設問4は rollback locator / rollback-evidence を停止条件に挙げているのに、直前の既知良好 production SHA・ロールバック手順・検証方法がパケットに存在しない。code-only とはいえ「戻す先のSHA」を事前確定していないのは本番着手前の欠落。
3. **ステージングの厳密SHA read-back と visual QA が「未実施」**。検証済セクションはローカルのみで、exact-SHA staging deploy/read-back・visual QA は「評価すべきポリシー」側にあり証跡が無い。merge 可否の前提が未充足のまま「進行可」を問う構図。
4. **#1524 の expectation 変更内容が未開示**。boundary-test 期待値の書き換えが「新しい正しい契約への整合」なのか「境界の緩和・隠蔽」なのかは、diff を見ない限り真正性を判定できない。report が P1 を surface していても、期待値側で別の境界が緩んでいないかは別問題。

## 3. P0で変更すべき仕様（着手前に解消必須）

- **P0-1｜marker注入不可の証明**：inbound リクエストから Worker所有マーカーを無条件で strip している（またはクライアント供給のマーカーを origin が信頼しない）ことを、コード上とテストで示す。「マーカー付き＋allowlist host」を偽装した forwarded を送ったときに fail-closed になる負テストを提示。
- **P0-2｜OAuth callback の allowlist 検証**：callback 生成が trusted-origin 由来である以上、host が攻撃者制御になれば open-redirect／アカウント乗っ取り面になる。allowlist の実体列挙と、allowlist 外・曖昧解決時に callback を発行しない負テストを要求。P0-1が破れるとこれも連動して破れるため、独立に fail-closed であることの明示が必要。
- **P0-3｜ロールバック locator の事前確定**：現行 production の既知良好 SHA、redeploy コマンド、read-back による同一性検証、想定復旧時間をパケットに記載してから merge に進む。

## 4. P1以降に回すべき仕様

- **P1-1｜boundary report 実物の添付**：3件のPG P1 が本リリースの guest Home / trusted-origin 経路と交差しない旨を明示（非交差の根拠付き）。
- **P1-2｜#1524 期待値 diff のレビュー**：期待値の書き換えが緩和でなく整合であることを差分で確認。
- **P1-3｜SVG の正確なCSP文字列と供給元**：`script-src 'none'` 等の実際のCSPを提示。SVGがユーザー投稿由来なら同一オリジンXSS面として別途評価、fixture限定ならその旨を明記。
- **P1-4｜CSRF の fail-closed 証跡**：Origin/Referer 解決が曖昧なとき reject する挙動のテスト。
- **P1-5｜full-diff snapshot と head-vs-main の一致確認**：snapshot commit `98899b3…` が PR head `3cb7c8e…` の対 main 累積差分と一致することを確認し、レビュー網羅の空白を閉じる。
- **P1-6｜ゲスト fixture の内容確認**：fixture が実ユーザーの private 画像を含まないことの確認。
- **P1-7｜proto 再構成の https 強制**：public request URL から proto を再構成する際、secure cookie / HSTS がダウングレードしないこと。

## 5. 最終推奨

**条件付きNO-GO（現時点では本番着手不可）。** 設計方針とローカル検証の質は高く、プライバシー順序・信頼オリジン集約・非合成方針・ベースラインP1の非偽装は採用に値します。ただし本パケット単独では、(a) marker のなりすまし不可証明、(b) OAuth callback allowlist の fail-closed、(c) ロールバック locator の事前確定 という**P0**が未充足であり、これらは本番の privacy/trusted-origin 安全性とロールバック準備の根幹です。

推奨手順：**P0-1〜3 を証跡付きで解消 → #1524 期待値diff と full-diff snapshot 一致（P1-2/P1-5）を確認 → 登録済 command-bus 経由で exact-SHA staging deploy/read-back と visual QA を完了 → 正常 merge → merged SHA で本番 code/materialized-UI only を read-back 検証。** いずれかの検証・レビュー・ステージング・runtime同一性・visual QA・ロールバック証跡で失敗したら停止。この順序を満たせば **GO**。

（P0-1と設問2への直接回答：ベースライン修復は「P1をreportがsurfaceし続けている」限りでは真正ですが、#1524の期待値diff未開示のため“隠蔽していない”ことは現状未確認です。P1-2を満たすまでは真正性を確定できません。）
