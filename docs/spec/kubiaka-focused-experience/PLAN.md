# 市民参加型バイオセキュリティ — クビアカからの実装計画

- Status: `DESIGN PROPOSED; CANONICAL PLAN after merge; EXECUTION NOT STARTED BY THIS FILE`
- Updated: 2026-09-13 JST
- Shared contract: [詳細設計](../citizen-biosecurity/SPEC.md)
- First profile: [SPEC.md](SPEC.md)
- Fixtures: [CONTRACT_EXAMPLES.json](../citizen-biosecurity/CONTRACT_EXAMPLES.json)

## 0. 成果と既存資産

最初の成果は `専門ガイド → 共通撮影 → private保存 → 再表示 → 通報用情報と公式窓口`。AIや専門家待ちをその前提にしない。後続は同じ原Recordを使う確認、再訪、活動・データ出力である。

旧PRを復活させるのではなく、fresh mainのactive Workerと共通Capture Loopから始める。地域別・種別DB、第二カメラ、第二認証、汎用フォームエンジン、専用queue/daemonを作らない。

### Source確認時点

設計開始base: `c6b983443a250937bc7c1ea70a57b4893a83275a`。これは将来の実装開始SHAとして固定しない。

確認済みの正本:

| 場所 | この設計で確認した意味 | 実装時の扱い |
|---|---|---|
| `AGENTS.md` | active Worker/D1/R2、shared UI、権利・release境界 | canonical commandと実装入口をfresh read |
| `docs/spec/zukan-product-architecture/SPEC.md` | Record/Claim/Review/Case分離、Domain Pack | 新しいCoreを追加せず使う |
| `docs/spec/zukan_foundation_v2_implementation_contract_2026-07-28.md` | SurveyEvent等はfrozen source-only契約 | 本番テーブル存在の証明にしない |
| `DESIGN.md` | ブランド・UI・状態・アクセシビリティ | 同じ部品とtokenを適用 |
| `platform_v2/cloudflare_shadow/src/index.ts` | AGENTSが指定するactive request入口 | 当該分岐・writerを実装時に直接確認 |
| `platform_v2/src/services/observationDataRights.ts` | AGENTSが指定する権利実装 | 既存の判定・testsへ対応付ける |
| `platform_v2/cloudflare_shadow/src/publicationFeedNative.ts` | AGENTSが指定するpublic delivery境界 | 実際のsinkで禁止副作用を確認 |

この設計作業では実D1 schema、provider bindings、投稿E2E、本番privateデータを検査していない。ファイルlocatorがあることと再利用可能な実装があることを区別する。

## 1. 実装順

### S1 — 安全な共通保存と専門入口

Outcome: guest/accountがクビアカ文脈の1〜6枚を非公開保存し、同じreceiptを再表示できる。

同じWorkに含めるもの:

- 対象の既存writer/schemaを限定して調べ、論理Record/asset/profile/rights/receipt/claimと物理欄の対応表を作る。
- 既存Capture Loop、媒体予約、owner session、idempotencyを再利用する。
- 独立した関係欄がなければ最小のadditive field/linkだけ追加する。Foundation全DBやKubiaka専用DBは作らない。
- version付き静的Kubiaka profile、source-backed guide、locale、既存デザイン部品。
- active Workerの実出口でprivate contextと管理対象taxonのinterlockを確認する。
- guest credential、receipt単位claim、共有端末reset、部分保存/再送を成立させる。
- common Recordが植物/ハチfixtureにも適合し、別DBを必要としないことを確認する。

Gate: owner/guest A-B隔離、receipt列挙、private media、6枚部分失敗、同一要求再送、context欠落、DB/R2間失敗、generic出口による漏出がnegative testで防げること。

先に情報ページだけを公開する場合、投稿・ログイン不要・確認結果等の未実装能力は表示しない。保存journeyの公開はその権利/再開の実証後とする。

### S2 — 通報用情報と公式窓口

Depends: S1。AI・人Reviewは依存にしない。

Outcome: 保存済み写真から、本人が選んだ情報だけを通報用にまとめ、根拠付きの公式窓口へ進める。

- regional policyのscope/date/sourceと宛先解決。不明・失効・矛盾時は上位公式案内へ戻す。
- 通報用位置・写真・説明・未確認内容をpreviewする。権利がなければその項目は送れない。
- copy/download/open/callのactual capabilityだけを出す。
- prepared/opened/self_reported/submitted/acknowledgedを区別し、初期はZUKAN外部送信なし。
- 規定のAI/専門家同定がない状態でも、未確認であることを記載して本人が連絡できる。

Gate: link/call tapで受付済みにならない、private tokenをpackageへ出さない、期限切れ/境界地域/別tenant/private fieldのテスト。実送信せずstagingでpreviewまで検証する。

S1+S2で最初の実用journeyを閉じる。S3を理由に先送りしない。

### S3 — 確認と価値の返却

Depends: S1。S2と非競合範囲は並行可。

Outcome: asset-aware候補と限界を返し、実在する担当体制の範囲で人Reviewと訂正ができる。

- submitted/assessed/unassessed、参照制約、provider provenance、処理失敗を正しく投影する。
- 低confidenceで自動却下せず、初期triageは保守的なruleと理由表示。
- feedback edition、追加写真、ClaimRevision、未読結果を再利用する。
- operator inboxは既存Reviewのfilterとして実装する。別の管理アプリを作らない。
- reviewerがいない場合は未提供表示。実運用の専門家SLAやAI精度を捏造しない。
- 解析再利用digestと既存予算上限を使い、無変更再解析・無限retryを防ぐ。

Gate: 6枚中3枚確認、所見が未確認画像を参照、写真追加後のstale、同定訂正、role失効、review競合、AI低確信による却下禁止、provider停止。

### S4 — 再訪と権利付き再利用

Depends: S1。人確認が必要な出力だけS3に依存。

Outcome: 同じ木の発見/処置/再訪を追い、同じRecordを活動結果と他のViewへ重複保存せず利用できる。

- 同じPlaceと同じsubjectの区別、確認済みタグ/QR/本人選択。
- 新しいfollow-up Record、Case/action結果、前後比較。
- Program/Quest contributionの参照、目的別の許可・撤回。
- 許可されたJSON/CSVとDwC mapping。exact位置を公開用に流出させない。
- 同定訂正や削除時のderived view/cache/exportの扱い。
- 1つのRecordから複数の生物主張を出すfixture、他種へ訂正されても原Recordを維持するfixture。

Gate: 原Record/媒体数不変、跨tenant参照拒否、旧private権利維持、誤同定の出力停止、再訪を重複と消さない、casual無所見をabsentにしない。

### S5 — 実パートナーに必要な分だけ

S1〜S4の公開を待たせない条件付き拡張。

- 実受信機関がある場合のAPI送信、受付照会、timeout unknown、訂正/撤回Action。
- 実在の調査責任者・protocol・effortがある場合のSurveyEvent/DetectionOutcome。
- 権限内のoperator monitoring mapと、別途承認されたprivacy-safe public aggregate。
- 明示接続・権利が成立した場合のNOCOSIL参照/内部task連携。

Partner名・窓口・SLA・API仕様が不明なままこの段階を実装済み/READY_NOWにしない。実在需要のないプロファイル管理画面・常設多種platformは作らない。

## 2. 共通の実装受入

CONTRACT_EXAMPLES.jsonのtest casesはacceptance oracleであり、製品testsのPASS記録ではない。

| 検証 | 見る境界 |
|---|---|
| pure contract | profile/version、主張/Record分離、状態projection、source/rights mapping |
| persistence integration | 実D1-compatible transaction、unique key、CAS、R2予約/確定/再開、削除整合 |
| security negative | guest/account/workspace隔離、CSRF、IDOR、private媒体、未設定fail-closed |
| actual outbound sink | generic通知、export、public feedへ副作用が0であること |
| browser journey | 正常/一部失敗/通信断/再開/共有端末、320px〜desktop、keyboard/読み上げ |
| contract export | DwC対象の選別、unknown/time/precision/rights、複数Occurrence、訂正ID |
| operational | 登録済みruntime identity、担当能力表示、連絡先版、rollback、残る未提供機能 |

privacyや副作用はソースの文字列検索だけで完了とせず、書込みsink/公開responseが実際にdenyされるテストを持つ。schema・権利未読を無視してfixture成功だけで進めない。

## 3. Migration / rollback

実装開始時に現在schema、旧privateデータの件数/参照だけを必要最小限で確認し、個人内容をChatやGitへ投入しない。

新規migrationは不足している意味だけのadditive changeとし、適用前backup/restore、移行前後件数、FK/unique、旧reader互換を検証する。旧データを勝手にpublicへ変換しない。旧ID→共通IDの対応が必要でも原IDを失わない。

source rollbackは新規capture/assessment/sendの入口を止めても既存receiptのreadを保つ。既に保存したRecordやmediaをrollbackの名目で消さない。未完了objectは既存retentionで回収し、参照確認前の一括削除はしない。

外部送信はsource rollbackで取り消せない。送信後の訂正/撤回はrecipient別Action。公開/送信前にその境界を確認する。

## 4. 公開の前提と既定動作

| 実値が未成立 | 既定動作 |
|---|---|
| guest credential/retention policy | guest captureを公開せず、ログイン不要と宣伝しない |
| 画像解析経路 | private保存と公式案内は維持。AI未提供と表示 |
| 実在reviewer | 専門家未提供と表示。永久に確認中にしない |
| 専用窓口の適用確認 | 公式上位案内と未確認表示。架空のrecipientを作らない |
| 受領Evidence/API契約 | 明示handoffまで。自動送信しない |
| formal protocol | casual/follow-upとして保持。absence/coverageを出さない |
| 公開許可 | privateのまま。Program参加・taxon一致でACL拡大しない |

## 5. 実行と証拠

Work開始はfresh main、該当source、現行Board/admission/deploy catalogから行う。テスト用データはlocalか隔離stagingで扱い、本番へ合成投稿しない。

実装のsource変更・検証はChat+利用可能な登録済みnative/cloud経路で成立させ、ARK/NEXUSを必須にしない。端末ブーストを使ってもcanonical stateはGit/登録済みEvidenceへ戻す。

docs-onlyはリンク・diff・例のJSON整合・仕様矛盾の検査で十分。製品実装は対象のmeaningful testsと必要なbrowser検証を選ぶ。全suite・新しいreview gateを機械的に増やさない。

各Workはexact SHA、changed paths、実行コマンドと結果、差分レビュー、staging/runtime identity、禁止副作用、rollback、未検証境界を短く返す。古いgreen、merge、HTTP 200を本番journey完了の証拠にしない。

## 6. SUPERSEDED

旧PLANのK0〜K14/古いPR番号を前提にした直列実装順、およびIMPLEMENTATION_MASTER_PLAN.mdのPostgreSQL中心の物理設計・release順はSUPERSEDED。再利用するのは安全上の不変条件と、現在の実装で必要性が確かめられたbehavior/testのみ。

AREA_COVERAGE.mdの非検出・公開privacy境界は維持するが、表中の旧URL/物理実装予定を起動許可と解釈しない。新規コードを作る前に本PLANのS1へcurrent sourceを対応付ける。
