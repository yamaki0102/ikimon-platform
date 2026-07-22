# PR-C observation-first dual-write

最終確認日: 2026-07-22

## 実装境界

`OBSERVATION_DUAL_WRITE_MODE=on` のときだけ、現行writerと同じD1 batchへobservation-first writeを追加する。設定値の既定は全環境で `off`。旧writer、旧reader、旧outboxを維持し、flag offでは追加tableへ一切queryしない。

対象は次の5経路。

- record save/finalize: owner human assertion、record policy、source map、consistency ledger
- AI analysis: provisional observation、subject locator、AI suggestion
- human edit: origin、observed-at、location、environment recordのlifecycle/ledger
- identification: owner/communityのclaimをcandidateとして保存
- media link/reassignment: image/audio/videoをobservationへ割り当て、旧active linkを非active化

record saveはAI完了を待たず、AI失敗は保存済みrecordを取り消さない。human edit・identification・media writeでは、flag有効化前のrecordも同じbatch内でowner observationを補完してから子entityを追加する。

AI responseは主対象と最大6件の別subjectを分ける。同じsubjectの代替名を別subjectへ入れず、各subjectは次へdual-writeする。

- `record_observations`: `ai / provisional / unreviewed / active / personal_only`
- `record_observation_source_map`: legacy AI reassessmentとの対応
- `record_observation_media`: evidence mediaとnormalized subject locator
- `observation_ai_suggestions`: 候補名、confidence、根拠、model/prompt/rule/input provenance
- `observation_lifecycle_events`: AI provisional作成イベント
- `record_observation_consistency_ledger`: old/new writeの対応とchecksum

同じrecord、media、model、prompt、rule、subject keyから決定的UUIDとinput fingerprintを生成する。同一inputの再実行はUPSERT/unique keyで収束し、observation、media link、suggestion、event、ledgerを増殖させない。

owner observationもrecord IDから決定的UUIDを生成する。identificationはlegacy source key、mediaはasset IDをsource keyにし、再送やclient retryで増殖しない。private recordは提案OFFを既定とし、owner overrideはrecord replayで上書きしない。

## AI-only gate

このwrite pathは次を一切作成・更新しない。

- `observation_identification_claims`
- `accepted_identification_id`
- `human_asserted`
- `verified`
- active `occurrence_projection_versions`
- community vote
- research/community data-use scope

AI候補を従来の`observation_ai_review_targets`にも保存し、既存owner processing UIとの互換性を保つ。別subjectを含むraw candidateと新observation IDsは既存reassessment provenanceへ保持する。community identificationは常に `candidate` で、`is_current` をaccepted decisionへ読み替えない。

## Rollback

flagを `off` に戻すと新規dual-writeだけが停止し、旧writer/readerと従来AI targetは継続する。runtime rollbackでも同じ状態へ戻せる。追加tableと既存dual-write済み行は削除しない。schema未適用環境へflag onのruntimeを先行deployしてはいけない。

## 検証

- parser/prompt contract: main subject、coexisting subjects、locator、bounded data
- exact input replay: deterministic observation IDs
- real SQLite schema: AI multi-subject、record、human edit、identification、media planを各2回適用して増殖しない
- AI-only gate: accepted claim 0、occurrence projection 0
- private proposal policyとowner override保持
- Cloudflare quick suite 321/321、typecheck、Wrangler dry-run
