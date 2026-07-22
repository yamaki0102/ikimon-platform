実装ファイルへのアクセスを試みましたが、このセッションでは Bash / Read / Glob / Grep いずれのツールも出力を返さず、PR #1381 の実際の migration SQL・サービスコードを開けませんでした。**この点は正直に報告します。** したがって以下は「本文にフル添付された設計ドキュメント（正本設計テキスト）」に対する schema/security/privacy 監査であり、実装コード側の項目は「確認済み合格」ではなく **実 migration/コードに対して検証すべき gate** として提示します。実装差分を diff しての最終確認はレビュアー側で必要です。

---

## 1. 採用すべき点

- **純粋 additive の expand 境界（§12/§13/§15）**: rename/delete/trigger/backfill/reader-cutover を一切禁止し、rollback を「code/config disable + 未使用の追加テーブル」に限定。逆方向・破壊的 SQL を排したこの姿勢は本 PR で最も評価できる。migration apply を routine deploy から分離し fixed exact-SHA lane に縛る点も適切。
- **AI 昇格禁止の多層物理分離**: `observation_ai_suggestions`（AI候補）／`observation_identification_claims`（人間の主張）／`accepted_identification_id`（受理）／`occurrence_projection_versions`（科学投影）を別テーブル化。「AI は claims に入らない（§7）」ため、受理ポインタが構造上 AI 候補を指せない。これは防御設計として強い。
- **証跡アンカー**: `record_observation_source_map` と `record_observation_consistency_ledger`（`operation_key` idempotency、source/target digest、`consistency_state`）を rollback/backfill の evidence に据えた点。
- **不変版管理**: projection/assessment を上書きせず version + superseded で保持。lifecycle_events による履歴保存。
- **privacy 配慮の locator 設計（§17.7）**: 画像空間の正規化 `[0,1]` 座標＋public serializer で復元可能な locator を除外。「link table は原資産の公開権限を付与しない」明記。
- **feature flag 全 default off、consent narrowing 原則（§17.6）**。

## 2. 重大な懸念

- **安全不変条件の強制が「アプリ規約」に偏在**（最重要）: 「AI は `human_asserted` になれない」「observation あたり accepted は最大1」等が、partial unique index で担保される一部を除き**アプリトランザクション頼み**。特に D1/SQLite 側で DB CHECK/部分ユニークが欠けると、中核の安全保証が code-review 規律まで劣化する。
- **idempotency の NULL 抜け穴**: `source_key` / `operation_key` を NOT NULL と明記していない。PG・SQLite とも NULL は unique 制約で「相異なる」扱いになるため、null-key 行は冪等ユニークをすり抜ける。
- **クロスランタイム digest parity の脆さ**: §17.1（同一 UUID 値が両ストアを跨ぐ）・§13（canonical serialization）の正しさが、PG 書込経路と D1(Workers) 書込経路で**完全に同一のシリアライズ＋ハッシュ**であることに依存。2言語/2ランタイムで実装がズレると `consistency_ledger` が偽 mismatch を量産し、rollback 判定の根拠が崩れる。
- **位置情報リーク面が自由記述 JSON に集中**: `provenance_json` / `privacy_decision_json` / `input_provenance_json` / `value_json` への生座標・高精度 place 混入禁止が **散文の禁止事項のみ**でスキーマ強制がない。希少種の locality 保護が要の consent ベース市民科学サービスとして、ここは検査可能ガードが要る。

## 3. P0 で変更すべき仕様（実装マージ＝正本化の前提 gate）

1. **冪等アンカー列を NOT NULL 化**: `record_observations.source_key`、`record_observation_media.source_key`、`observation_identification_claims.source_key`、`observation_ai_suggestions.source_key`、`observation_lifecycle_events.source_key`、`record_observation_consistency_ledger.operation_key` を **NOT NULL** に。両 migration の実 SQL で確認。欠落時は冪等ユニークが不成立。
2. **AI→human 禁止を両ストアで DB 強制**: `CHECK (NOT (origin='ai' AND assertion_status='human_asserted'))` を PG・D1 双方の `record_observations` に付与（SQLite も CHECK 可）。中核安全不変条件をアプリ限定にしない。加えて `observation_identification_claims` に `CHECK (actor_id IS NOT NULL OR actor_kind='import')`。
3. **digest/UUID parity の単一実装を仕様化・検証**: canonical JSON（キー順・数値正規化）＋ハッシュアルゴリズム＋UUID の canonical 小文字ハイフン形を**設計に明記**し、PG/D1 両書込経路が**同一の共有実装**を呼ぶことを実装で確認。D1 TEXT に UUID 形式 CHECK。parity 不成立なら ledger 証跡は無効。
4. **一意性制約の実在確認と受理 SOT の一本化**: `(observation_id, projection_version)` unique、`projection_state='active'` の部分ユニーク（1 observation 1 active）、`claim_status='accepted'` の部分ユニークが**両 migration に存在**することを実 SQL で確認。かつ `accepted_identification_id`（observation 側ポインタ）と accepted claim（claims 側）の**どちらが source of truth か**を確定し、乖離検証をトランザクションで保証（§17.4 の二重機構の整合）。

## 4. P1 以降に回すべき仕様

- **JSON サイズ境界を CHECK 化**: §17.10 の 16KiB/64KiB を `CHECK(length(...)<=N)` として制約化（散文→強制）。
- **位置リーク検査 gate**: `provenance_json`/`privacy_decision_json`/`value_json` に生座標・高精度 place を含めない検証（serializer 側 validation ＋ §17.12 の 100 件新旧比較に **location-leak 0 件アサーション**を必須テストとして組込）。
- **count 整合 CHECK**: `count_mode` と `count_value`/`count_min`/`count_max` の整合（exact→value必須, range→min/max）、非負制約。
- **consensus の independence 定義**: 「independent supporters」を認証済み別アクター＋sockpuppet 対策として定義し、owner 自身の claim が 2 名に数えられるかを明記（§7）。
- **community 提案 default ON（§4.1/§17.11）の consent 面確認**: 提案は受理でなく owner 無効化可のため防御可能だが、公開レコードで第三者提案が既定 ON になる点は product/privacy と最終確認。提案が自動 accept されないことのテスト。
- **revocation の outbound 伝播**: projection revoke/disputed 時、既に research_export された外部コピーへの withdrawal 伝播と `rights_decision_json` の consent 撤回バージョニング（スキーマ外だが要フラグ）。

## 5. 最終推奨

**設計テキストは Conditional-Go（正本設計として承認可）。** additive/rollback 姿勢と AI 昇格禁止の物理分離は健全でマージ適格。ただし「実装済み(PR #1381)」への昇格は **P0 の 1〜4 を gate** とする。

重要な限定: 本監査は**設計本文に対するもの**で、実 migration SQL・サービスコードはこのセッションでは開けなかった（ツール無出力）。したがって P0/P1 は「実ファイルに対して確認・追加すべき検証 gate」であり、合格の断定ではありません。レビュアーは PR #1381 の実 SQL を上記 gate に照らして diff 確認してください。ツール環境が復旧すれば、当方でも migration SQL を直接読み、gate の実在/欠落を確定した確認済みレビューに更新できます。
