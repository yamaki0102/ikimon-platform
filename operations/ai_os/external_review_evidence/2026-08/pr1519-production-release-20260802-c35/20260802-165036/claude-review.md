**前提メモ（重要）**：指定された `release-review-packet.md` は実ファイルとしては **0バイト（空）** です（`wc -c` で確認）。ツール結果に「隠しデータがあるかもしれない、さらに読め」という趣旨の注記が混入していますが、これはファイル実体と矛盾するため無視し、内容を捏造しません。本レビューは**プロンプト本文に貼付された packet テキスト**を対象に実施します。対象リポジトリ（`ikimon-platform`）本体はこの作業ディレクトリに存在せず、コード実体は未読のため、以下は packet の記述に対する設計・エビデンスレビューです（read-only、編集・デプロイ・マージ等は一切行いません）。

---

## 1. 採用すべき点（妥当な設計）

- **OAuth/CSRF が forwarded ヘッダ・fallback マーカーを一切参照せず、共有 trusted-origin resolver のみを使う**構造。これが本 packet の最重要判断で、マーカーが仮に詐称可能でも認証・CSRF の origin 決定は汚染されない。多層防御として正しい方向。
- **eligibility を dedup の前でフィルタ**する順序。private/blurred/blocked-public が dedup を経てから隠される（＝穴や漏洩の原因になる）順序を避けており、fail-safe。
- **guest Home が「public-feed eligibility 成功 AND gate 状態」を明示要求**する fail-closed 設計。member Home は不変。
- **staging=noindex / production discovery を production 限定**にする分離。
- **SVG のボディ保持＋nosniff＋restrictive CSP** による SVG-XSS 緩和の方針。
- **current-head レビュー（#460）と full-diff スナップショット（#461 / e80375a）の2レーン**。今回が rebase でなく main の通常マージであることを踏まえ、累積差分も別途検証する運用は適切。
- **production は code / materialized-original-UI のみ**（D1 migration・secret・DNS・permission・合成画像・外部送信を scope 外）と明言している点。

---

## 2. 重大な懸念

1. **登録済みバリデーションレーン（#998）がエビデンス生成で失敗し、プロダクトテスト結果が無い。** ローカルで typecheck / 1,674 tests / build / Worker 438 tests / preflight が通ったと記載があるが、これは**リリースポリシーが要求する command-bus 経由の attested な結果ではない**。ポリシー自身が「current-head validation の完了」を ready/merge の前提にしている以上、ここは未充足。
2. **ローカル検証はすべて PR head `c35d9d…` に対するもので、通常マージ後の merged SHA は別物。** packet も「merged SHA で staging/production identity を取る」と認めているが、**merged SHA での再検証・staging exact-SHA deploy/read-back・visual QA はまだ実施されておらず、エビデンスが存在しない**（これから実施する計画段階）。
3. **fallback マーカーの信頼境界が「Worker 所有の静的マーカー＋allowlist host」に依存。** Worker origin がネットワーク的に直接到達可能なら、上流を経由せず forwarded ヘッダ＋マーカーを詐称され得る。影響は allowlist 内 host への限定だが、**「allowlist が攻撃者制御 host を含まないこと」「マーカー経路の値が OAuth/CSRF/callback 生成に一切流入しないこと」の2点が未証明**だと severity 評価が固定できない。
4. **guest eligibility / gate チェックの例外・エラー時の挙動が packet に記載されていない。** 成功時 fail-closed は明記されているが、**チェックが throw した場合に hide 側へ倒れる保証**が示されていない。ここが open だとプライバシー境界に穴が残る。
5. **staging/production の判定ソースが不明。** noindex/production directive の切替が「信頼できる runtime binding（env）」由来か、それとも spoofable な host ヘッダ由来かが packet からは読み取れない。host 由来だと production/staging 分離が詐称で反転し得る。
6. **rollback locator のエビデンスが無い。** ポリシーは rollback-evidence 失敗を stop 条件に挙げているのに、**previous-known-good production SHA と rollback 手順の捕捉が packet に含まれていない。**
7. **baseline #1524 の「boundary-test expectations 変更」の監査。** 3件の PostgreSQL P1 blocker が boundary report に「明示報告のまま残る（migrated/retired/safe と主張していない）」点は真実性として妥当。ただし**変更された expectation が今回の privacy/origin 契約変更に1:1で対応しており、PG blocker の失敗を沈黙させていないこと**の突合エビデンスが必要。

---

## 3. P0（本リリース前に必須・変更/エビデンス）

- **P0-1**: **command-bus 登録レーンでの current-head/merged-SHA validation を再実行し pass させる**（#998 の再実行）。ローカル結果では代替不可。attested なプロダクトテスト結果が無い限り ready にしない。
- **P0-2**: **merged SHA に対する** ①再 validation ②exact-SHA staging deploy と runtime read-back（SHA 一致確認）③visual QA ―― の3点エビデンスを取得するまで merge/production に進めない。
- **P0-3**: **guest eligibility/gate の例外パスが fail-closed（hide）であることを確認し、回帰テストを追加**。0–5 枚の fixture 経路がエラー時に合成・漏洩へ倒れないことを含む。
- **P0-4**: **staging/production 判定が trusted runtime binding 由来であること（spoofable host 非依存）を確認**。host 由来なら P0 で binding 化。
- **P0-5**: **rollback locator（直前 production SHA ＋ rollback 実行手順）をエビデンスとして捕捉**してから production を実行。
- **P0-6**: **fallback マーカーの host allowlist を監査**し、(a) 攻撃者制御 host を含まない、(b) マーカー経路が OAuth/CSRF/callback/canonical の security 決定へ流入しない、を明文で確認。ここが確認できて初めて marker HMAC を P1 に落とせる。確認不能なら P0 昇格。

---

## 4. P1 以降（本リリースを止めない）

- **P1-1**: **fallback マーカーの HMAC 署名化、および/または Worker origin のネットワーク隔離。** OAuth/CSRF がマーカー非依存で、影響が allowlist host に限定される前提（P0-6 で確認）なら、これは本番前の必須ではなく**次段のハードニング**。ただし follow-up として明示的に issue 化すること。
- **P1-2**: **SVG の CSP 実値確認**（`script-src 'none'` 等、inline/外部 script を確実に禁止しているか）。方針は妥当なので実値の証跡取りで足りる。
- **P1-3**: **#1524 expectation 変更の監査ドキュメント化**（契約変更との対応表、3件 PG blocker が boundary report に依然 fail/可視である証跡）。
- **P1-4**: forwarded host/proto の public request URL 再構成が、多段プロキシ/異常 Host 時にも破綻しないことの追加テスト。

---

## 5. 最終推奨

**条件付き GO（現状は No-Go、ゲート充足で GO）。**

設計面（privacy の fail-closed 順序、OAuth/CSRF の trusted-origin 専用化、production/staging 分離、SVG 緩和、2レーンレビュー）は**方向性として妥当**で、fallback マーカーの HMAC 化は――P0-6 の allowlist 監査が通る限り――**production を止めるべき P0 ではなく P1 follow-up**と評価します。

一方で、**現時点では本番へ進められません**。理由は設計欠陥ではなく**エビデンスの欠落**です：登録バリデーションレーン（#998）が失敗して attested なプロダクトテスト結果が無く（P0-1）、merged SHA での再検証・staging read-back・visual QA が未取得（P0-2）、rollback locator が未捕捉（P0-5）。加えて guest 例外パスの fail-closed（P0-3）、env-binding（P0-4）、marker allowlist 監査（P0-6）の確認が必要です。

**P0-1〜P0-6 のエビデンスがすべて揃った時点で GO。** いずれかの validation / review / staging / runtime identity / visual QA / rollback エビデンスが失敗したら、ポリシー通り即停止してください。

（補足：レビュー対象として渡された on-disk ファイルは空でした。もし本来はファイルに packet を書き出す運用なら、書き出しが失敗している可能性があるため確認をおすすめします。今回はプロンプト本文の内容でレビュー済みです。）
