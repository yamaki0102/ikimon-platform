# Codex実装プロンプト: ikimon.life 基本体験P0

## 推奨実行設定

- モデル: GPT-5.6 Sol
- 推論レベル: high
- integrated E2E、複雑なmigration設計、複数runtime境界の調査が必要な場合: ultra
- 実行面: Codex Cloudまたは管理されたfresh worktree

公式ガイドに従い、同じ指示を繰り返さず、repositoryの`AGENTS.md`、仕様、テストを優先する。

---

## そのまま渡す指示

あなたは`yamaki0102/ikimon-platform`の基本体験P0を、調査、実装、テスト、記録まで進める。

### 目的

次のE2Eを、一つのRecordに対する矛盾のない体験として成立させる。

`撮る → 保存される → 本人に紐づく → AI候補が出る → 編集・確認できる → 公開範囲と位置精度を守る → Placeに積み重なる → 後から見返せる`

### 最初に読む正本

1. repository root `AGENTS.md`
2. `docs/spec/core-experience-p0/SPEC.md`
3. `docs/spec/core-experience-p0/ISSUE_MAP.md`
4. `docs/spec/universal-place-atlas/SPEC.md`
5. Issue #1444、#1296、#1365、#1421〜#1426
6. latest `origin/main`、current open PR、中央deploy registryのread-only projection

古い会話、Issue本文の期待SHA、PR本文の過去runtimeを現行値として使わない。必ず作業開始時にlatest main、default branch、current PR head、runtime evidenceの有無を再確認する。

### 作業範囲

- source調査
- source code、tests、docsの変更
- short-lived `codex/<task>` branch
- 一つまたは複数のレビュー可能なDraft PR
- Issueへの証拠付きstatus記録
- local／sandboxで可能なbuild、unit、integration、browser test

### 禁止

明示承認がない限り、次を行わない。

- merge
- productionまたはstaging deploy
- production／staging DB、D1、R2 dataへのwrite
- migration apply、backfill apply
- secret、DNS、権限、課金、外部送信
- branch削除、履歴rewrite
- 既存Record・mediaの削除
- 未コミット変更の破棄

migrationまたはbackfillが必要な場合、additive source、dry-run、read-only diagnosis、rollback設計、承認境界まで作成し、applyしない。

### 作業開始時のread-only監査

次を確認し、`docs/spec/core-experience-p0/CURRENT_AUDIT.md`へ記録する。

- latest `origin/main` SHA
- worktree状態。既存dirtyを破棄しない
- current app entry points
- capture、media upload、Record create、owner policy、processing status、AI request／consumer／writeback、edit、Place membership、public projection、materialization、release scriptsの実path
- #1296の要求ごとのimplemented／partial／missing
- #1365の`/learn`・`/ja/contact` route生成・materialization・Worker lookupの経路
- #1421〜#1426のmerged implementationと未完了条件
- current testsと不足test
- central registryとruntime identityのdrift。live accessがない場合は`unverified`とする

監査だけで終了しない。安全に実装できるsource変更へ続ける。

### 実装順

#### 1. P0 route blockerを修復

Issue #1365をsourceで再現し、`/learn`と`/ja/contact`がbuild artifact／materialization manifest／Worker route contractへ一貫して含まれるようにする。

要件:

- route listの重複正本を減らす
- missing artifactをtestで再現する
- locale aliasとcanonical redirectを確認する
- 問い合わせ送信先、secret、既存PHP／form behaviorを変更しない
- build artifact inspectionとroute smoke testを追加する

#### 2. owner・編集policyを統一

一覧、詳細、編集、processing status、AI retryが同じowner policyを使用するようにする。

要件:

- canonical owner fieldをsourceとmigrationから特定する
- login user ID mappingを共通化する
- 本人RecordはP0項目を編集可能
- 他人Recordはedit／status／retry不可
- 「自分の記録」表示条件とauthorizationを分離しない
- CSRF、validation、optimistic concurrency、negative testを追加する

#### 3. 保存・AI requestの整合性を保証

media、Record、owner、AI requestをcapture session／idempotency key／outboxで結ぶ。

要件:

- response loss後の同key再送で重複Recordを作らない
- media保存だけをRecord保存完了と表示しない
- AI enqueue失敗を`enqueue_pending`としてledgerに残す
- read-only orphan diagnosisを先に作る
- transaction外境界はdurable outbox／ledgerで補う
- public-ready前にowner、rights、mediaをread-backする

#### 4. AI状態と復旧を完成

次の状態をDB／API／UIで同じ意味にする。

`enqueue_pending / queued / analyzing / needs_review / identified / failed_retryable / failed_terminal / suppressed / not_applicable`

要件:

- attempt count、last attempted、next retry、public-safe error code、input version、rule versionを保存する
- owner再解析を冪等化し、active request重複と連打を防ぐ
- provider timeout、schema error、writeback errorのtest doubleを作る
- retryable→再解析成功をE2E化する
- terminal failureでも手動編集で完了できる
- AI候補を自動confirmedにしない

#### 5. RecordをUniversal Place Atlasへ接続

既存Place Atlasを再設計せず、current Record createとのhandoffを完成する。

要件:

- exact internal point、GPS uncertainty、boundary、hierarchyを使用
- inside→confirmed
- boundary／overlap→candidate
- locationなし→Record保存成功、後からPlace追加可能
- ownerが候補を訂正できる
- public-ready confirmed RecordだけをPlace profileへ投影
- Record数とOccurrence数を混同しない
- exact coordinate、owner identity、private noteを公開しない
- private／withdrawnへ変更するとpublic profileから除外する

#### 6. offline／中断復旧

既存draft／IndexedDB実装を監査し、不足分を最小変更で補う。

要件:

- `pending_local / uploading / server_saved`を区別
- online復帰時に同じidempotency keyで再送
- user-scoped storage
- guest→login rekeyは明示・原子的
- 別ユーザーへdraftを表示しない
- storage eviction、期限、破棄を利用者へ説明する

### PR分割

巨大な一PRにしない。実装状況に応じ、次の最大4laneへ分ける。

1. `fix/p0-support-route-materialization`
2. `fix/p0-owner-atomic-record-flow`
3. `feat/p0-ai-state-recovery`
4. `feat/p0-place-offline-handoff`

後続PRが前PRに依存する場合はstack関係とbase SHAを本文へ明示する。独立可能ならlatest mainから分ける。

各PRはDraftで作成し、mergeしない。

### テスト

最低限、既存標準コマンドを実行する。

```bash
npm --prefix platform_v2 run typecheck
npm --prefix platform_v2 run test:node
npm --prefix platform_v2 run build
```

関連するCloudflare Worker／projection／materialization testも、repositoryのAGENTSとpackage scriptsに従って実行する。

追加必須test:

- login user upload→owner保存→detail→edit
- API response loss→同key retry→Record一件
- AI enqueue→needs_review／identified
- provider failure→failed_retryable→owner retry→success
- terminal AI failure→manual edit
- other user edit／status／retry拒否
- location denied→save→Place later
- boundary candidate→manual confirm
- private／withdrawn→Place public profile非表示
- exact coordinate／identityのpublic response不存在
- `/learn`、`/ja/contact` artifact／route smoke
- offline outbox→online replay

browser matrix:

- 320×568
- 360×640
- 375×667
- 390×844
- 412×915
- 768×1024
- 1024×768
- 1280×720
- 1440×900
- 1920×1080

ChromiumとWebKitを必須、可能ならFirefox。実アカウントやproduction dataが必要な確認は、未確認のまま区別し、代替fixtureを実アカウント確認済みと報告しない。

### セキュリティ・privacy gate

- owner共通policy
- CSRF
- input validation
- MIME、size、orientation
- signed/private media URLの漏えい防止
- exact coordinate、private note、contributor identityのpublic response不存在
- school、home、children、people、rare species、restricted facilityのfail-closed
- OSM accessから撮影・公開許可を推定しない
- AI provider error、secret、private locatorを利用者／logへ露出しない

### 完了時の提出物

1. `CURRENT_AUDIT.md`
2. 作成したDraft PR一覧とstack関係
3. changed files
4. 実装済みP0条件
5. 未実装P0／P1と理由
6. test commandと結果
7. Visual QA evidence path
8. migration／backfill案とapply未実施の明記
9. staging／production未実施の明記
10. exact source SHA
11. blockerと次の一手
12. Issue #1444、#1296、#1365、#1421〜#1426へのstatus comment

### 停止条件

次の場合は、推測や強制操作をせず、source変更を安全なところまで完了して`BLOCKED_*`として記録する。

- canonical owner fieldを一意に決められない
- active runtime sourceを確定できない
- migrationがdestructiveになる
- production dataのwriteが必要
- secret／permission／DNS変更が必要
- dirty worktreeの既存変更と競合する
- external provider契約・課金判断が必要

停止しても、read-only監査、tests、source-only fix、Draft PR、再開条件の記録までは進める。

### 成功条件

- source上のP0状態機械と責任分界が一貫する
- owner、media、AI、edit、Place、public projectionが同じRecordへ収束する
- retryable failureから復旧できる
- private／exact locationがpublic面へ漏れない
- support route blockerがsource上で修復される
- 必要なDraft PRと証拠が揃う
- merge、deploy、DB apply、secret、DNS、権限変更を行っていない
