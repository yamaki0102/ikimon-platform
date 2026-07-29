# ZUKAN クビアカツヤカミキリ Focused Experience — Opus Review Packet

- Status: ready for external review
- Date: 2026-07-29
- Review target: architecture, product plan, data model, privacy, operations, rollout
- Runtime implementation: not approved by this packet
- Recommended current Anthropic model: Claude Opus 4.8 or later Opus-class model
- Reusable when Claude Opus 5 becomes available

## 0. Review objective

ZUKAN上に、クビアカツヤカミキリ専用のFocused Experienceを作る計画を、実装開始前に独立して厳しくレビューする。

レビューの目的は賛同ではない。次を発見することである。

- 数年後に破綻する抽象化
- 不要な汎用化、過剰設計
- 既存ZUKANとの意味重複
- ゲスト所有権の漏洩・誤移譲
- 未成年・自宅・学校・私有地の位置情報リスク
- AIの過信、absenceの過大主張
- 地図coverageの誤解
- 運用能力を無視したfeedback設計
- migration、rollback、Node/Worker parityの穴
- PR依存とrelease順の問題
- 外部共有の責任境界

## 1. 背景

ZUKANは、写真、資料、観察、活動等を、Place、Entity、Time、Source、Evidence、Rights、Review、Change historyへ接続し、用途別のViewやPublicationへ返す地域知識基盤である。

今回、全国的に注目されているクビアカツヤカミキリを入口に、次の体験を作りたい。

- ゲスト・ログイン済みの両方が写真1〜6枚を投稿できる
- 写真は即保存し、確認結果は後から返す
- ログイン後はZUKAN共通Homeではなくクビアカ専用workspaceへ戻る
- 写真の細部・広域・環境情報を後処理で評価する
- 発見候補だけでなく、写真範囲の非検出、再訪、調査努力を扱う
- mapでは発見地点より調査量、品質、反復、鮮度を見せる
- 将来は自治体、管理者、専門家との受託・連携へつなげる

一方、ZUKANは緊急通報経路でも、専門安全判定主体でもない。外部送信は登録済み受信先、受信同意、人間review、operator approvalが揃う場合だけ行う。

## 2. 添付・参照必須ファイル

次を全て読むこと。途中で一つだけを見て結論を出さないこと。

### Strategy

1. `yamaki0102/ikimon-business-strategy/decisions/2026-07-29-zukan-product-architecture-and-safety-boundary.md`
2. `yamaki0102/ikimon-business-strategy/decisions/2026-07-29-zukan-kubiaka-focused-experience.md`

### Platform contract and plan

3. `docs/spec/zukan-product-architecture/SPEC.md`
4. `docs/spec/kubiaka-focused-experience/SPEC.md`
5. `docs/spec/kubiaka-focused-experience/AREA_COVERAGE.md`
6. `docs/spec/kubiaka-focused-experience/PLAN.md`
7. `docs/spec/kubiaka-focused-experience/IMPLEMENTATION_MASTER_PLAN.md`

### Current source implementation candidate

8. `platform_v2/src/services/focusedExperienceRegistry.ts`
9. `platform_v2/src/services/kubiakaExperience.ts`
10. `platform_v2/src/services/kubiakaReadModels.ts`
11. `platform_v2/src/services/kubiakaAreaCoverage.ts`
12. corresponding tests

### Existing reusable implementation evidence

13. current `/record` composer and retry path
14. current member Home / profile draft ownership implementation
15. event-scoped guest credential and guest→account promotion implementation
16. current location privacy and public map aggregate contracts
17. Foundation v2 Survey / Detection / Coverage schema

Private repositoryを直接読めない場合、上記ファイルの内容またはPR patchを添付してからレビューすること。ファイル未読の推測レビューは禁止する。

## 3. Current PR stack

```text
Strategy:
  #42 ZUKAN product architecture and safety boundary
    └─ #43 Kubiaka focused experience

Platform:
  #1489 product architecture contract + shadow envelope
    └─ #1491 Kubiaka full specification and master plan
         └─ #1492 Registry/read models/area coverage pure TypeScript (Draft)
```

現在は計画レビュー段階であり、runtime route、migration、staging、production、external sendは未実施。

## 4. Fixed constraints

これらは勝手に変更せず、問題がある場合は「変更すべき固定条件」として明示すること。

- 投稿は既存ZUKANの写真1〜6枚を再利用する
- 写真全体と細部の両方に価値がある
- 投稿時に調査手順を強制しない
- ゲスト投稿とログイン投稿を両方提供する
- ログイン後はクビアカ専用workspaceを提供する
- ZUKAN共通Account、Record、Media、Placeを複製しない
- 保存はAI完了を待たない
- 丁寧な非同期feedbackを中核価値にする
- AI、人、専門家、受信先回答を区別する
- 写真に写らないことから生息不在を断定しない
- mapは発見地点より調査coverageを初期表示する
- 夏休みは参加促進moduleであり恒常product identityではない
- production、DB、secret、外部送信は明示承認なしに実施しない

## 5. Review questions

### 5.1 Product and abstraction

1. `Focused Experience`という共通抽象は現時点で妥当か。
2. クビアカ固有実装を先に作り、2例目で抽象化すべきではないか。
3. 専用workspaceの没入感とZUKAN共通体験の分断リスクは適切に均衡しているか。
4. 利用者価値が「丁寧なfeedback」に依存しすぎていないか。
5. 夏休み後の継続理由は十分か。

### 5.2 State model

1. Persistence / Assessment / Feedback / Actionの4軸は妥当か。
2. 依然として混同されている状態はないか。
3. contributor-facing stateの優先順位に危険な上書きがないか。
4. stale Assessment、superseded Feedback、follow-up dueを正しく共存できるか。

### 5.3 Data architecture

1. 新規entityは最小か。
2. Foundation v2、Observation、event participant、invasive routingと不必要に重複していないか。
3. `focused_experience_evidence_coverage_items`の正規化は妥当か。
4. Assessment、Feedback、area projectionをimmutable editionにする粒度は適切か。
5. PostgreSQLとD1の責務分離に危険がないか。
6. reconciliation / outboxでRecord保存とexperience linkの部分失敗を十分扱えるか。

### 5.4 Guest ownership and privacy

1. browser guest workspace + receipt単位claimは妥当か。
2. 共有端末で別人のRecordを誤claimする経路は残っていないか。
3. cookie喪失時に回復不能とするP0判断は妥当か。
4. receipt ID enumeration、link preview、cache、analytics leakへの対策は十分か。
5. 未成年、自宅、学校、私有地の推測リスクを十分扱っているか。
6. public aggregate mapの時系列差分から位置を推測できないか。

### 5.5 AI, evidence, and feedback

1. free-form photo、photo-scope no-clear-sign、survey non-detectionの境界は明確か。
2. image role coverageの判定が誤った場合、どの過大主張が生まれるか。
3. automated feedbackを自動公開できる範囲は適切か。
4. no-clear-sign random auditでfalse negativeを十分監視できるか。
5. human reviewer capacityを超えた場合のUXと運用は現実的か。
6. 専用feedbackの文章がauthorityを誤認させないか。

### 5.6 Area coverage

1. quantity / quality / repeat / freshness / denominatorを分ける方針は妥当か。
2. `current_target_met`という状態名は誤解を防げるか。
3. global grid + Japan crosswalk方針は適切か。
4. denominator classは十分か。
5. projection edition、small-count suppression、coarseningでprivacyは十分か。
6. public mapが子どもを危険な場所へ誘導するリスクはないか。
7. cellごとの次行動提示が調査バイアスを悪化させないか。

### 5.7 Operations and business viability

1. 全件保存・非同期Assessment・一部human reviewの運用は持続可能か。
2. feedback queueのbackpressure設計は十分か。
3. 自治体受託へ進む前に何を実証すべきか。
4. 無料市民投稿と有償運用・成果物の境界は合理的か。
5. external routingをRelease Eまで遅らせる判断は妥当か。

### 5.8 Delivery and PR structure

1. Release A〜Eの分割は安全か。
2. migrationを4段階に分ける計画は適切か。
3. static previewを先に作ることで手戻りを減らせるか、表層だけ先行する危険があるか。
4. current PR stackは長すぎないか。
5. どのPRを統合、分割、破棄、作り直すべきか。
6. 最小のcritical pathは何か。

## 6. Required adversarial scenarios

最低限、以下のケースで計画が破綻しないか検討すること。

1. 同じ学校タブレットを複数の子どもが順番に使う
2. guest Aの投稿後、account Bがログインする
3. Record保存成功、experience link保存失敗
4. 6枚中3枚だけupload成功後にofflineになる
5. AIがフラス候補を誤検出する
6. AIが実際の候補を`no clear sign`とする
7. feedbackが7日以上遅延する
8. 公開cellに投稿が1件だけある
9. 隣接cellを見比べると学校位置が推測できる
10. casual photoだけが毎日大量に投稿される
11. 古いsurvey後に新しいcasual photoが1枚追加される
12. 対象木台帳が古い、重複、欠損している
13. recipient consentが期限切れ直前に送信操作される
14. send成功後、acknowledgementが永久に来ない
15. contributorが削除・非公開化を要求する
16. Assessment model versionが廃止される
17. area projectionの生成途中で失敗する
18. summer campaign終了後に利用が急減する
19. 全国報道で一日数万投稿が来る
20. 別外来種へ転用すると語彙・workflowが合わない

## 7. Review method

次の順序でレビューすること。

1. 事実と未確認事項を分離
2. product boundaryを評価
3. data/state/ownershipを評価
4. privacy/securityを評価
5. AI/evidence/feedbackを評価
6. area mapを評価
7. operations/rolloutを評価
8. PR構成を評価
9. 最小修正案を提示
10. 最終Verdictを出す

設計の全文書き直しを最初に行わない。まず問題を特定し、なぜ問題か、どこを最小変更すべきかを示す。

## 8. Required output format

```text
# Verdict
GO / GO WITH BLOCKERS / REDESIGN REQUIRED / STOP

# Executive summary
10行以内

# P0 blockers
各項目:
- ID
- finding
- failure scenario
- affected files/sections
- required change
- verification

# P1 major findings
同形式

# P2 improvements
同形式

# Architecture assessment
- product abstraction
- state model
- data model
- ownership
- privacy
- AI/feedback
- area coverage
- operations
- delivery

# What to delete or simplify
不要なentity、route、state、release、documentを具体的に

# Missing requirements
計画に存在しない必須要件

# Revised critical path
順序付き。各段階のexit criteriaを付ける

# PR recommendation
各PRについて:
- merge as-is
- revise
- split
- rebase
- close/recreate
- do not merge

# Decision table
findingごとにstrategy/spec/plan/code/migrationへの影響

# Final confidence
high / medium / low
未確認事項
```

## 9. Ready-to-use prompt

以下をOpusへ送り、上記ファイルを添付する。

---

あなたは、公共性のある市民参加型地域知識サービスの、Principal Product Architect、Security Reviewer、Data Governance Reviewerとして行動してください。

ZUKANの「クビアカツヤカミキリ Focused Experience」実装計画を、実装開始前に独立・敵対的にレビューしてください。賛同や要約は目的ではありません。数年後に破綻する構造、過剰抽象化、データモデル重複、ゲスト所有権事故、未成年・位置情報リスク、AIの過大主張、調査coverageの誤解、運用不能、migration/rollbackの穴、PR依存の問題を発見してください。

必ず添付された全ファイルを読み、ファイル未読の推測を避けてください。事実、推論、未確認事項を分離してください。現在の固定条件に問題がある場合は、従うふりをせず「変更すべき固定条件」として指摘してください。

特に次を厳しく確認してください。

- Focused Experienceを今抽象化する妥当性
- Persistence / Assessment / Feedback / Actionの4軸状態
- guest workspaceとreceipt単位claim
- Foundation v2と新規tableの重複
- automated feedbackの公開境界
- photo-scope no-clear-signとsurvey non-detection
- area coverageの量・質・反復・鮮度・分母
- sparse cell、時系列差分、学校・自宅の位置推測
- reviewer capacityとqueue backpressure
- Release A〜EおよびPR #42/#43/#1489/#1491/#1492の順序

`Required adversarial scenarios`を全て検討してください。出力は`Required output format`に厳密に従ってください。問題が重大ならGOを出さず、REDESIGN REQUIREDまたはSTOPとしてください。

---

## 10. Reviewer identity record

レビュー受領時に次を記録する。

```text
provider=Anthropic
model_exact=
model_release=
reviewed_at=
input_files=
input_commit_shas=
output_sha256=
context_missing=
```

モデル名を推測で`Opus 5`と記録しない。実際にUI/APIへ表示されたexact modelを記録する。
