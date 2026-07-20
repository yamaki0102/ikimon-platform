# PR-C AI provisional observation dual-write

最終確認日: 2026-07-20

## 実装境界

現行の写真保存→`observation.reassess` outbox/Queue→scheduled Workers AI経路を維持し、そのAI完了batchへobservation-firstのwriteを追加する。record保存はAI完了を待たず、AI失敗は保存済みrecordを取り消さない。

AI responseは主対象と最大6件の別subjectを分ける。同じsubjectの代替名を別subjectへ入れず、各subjectは次へdual-writeする。

- `record_observations`: `ai / provisional / unreviewed / active / personal_only`
- `record_observation_source_map`: legacy AI reassessmentとの対応
- `record_observation_media`: evidence mediaとnormalized subject locator
- `observation_ai_suggestions`: 候補名、confidence、根拠、model/prompt/rule/input provenance
- `observation_lifecycle_events`: AI provisional作成イベント
- `record_observation_consistency_ledger`: old/new writeの対応とchecksum

同じrecord、media、model、prompt、rule、subject keyから決定的UUIDとinput fingerprintを生成する。同一inputの再実行はUPSERT/unique keyで収束し、observation、media link、suggestion、event、ledgerを増殖させない。

## AI-only gate

このwrite pathは次を一切作成・更新しない。

- `observation_identification_claims`
- `accepted_identification_id`
- `human_asserted`
- `verified`
- active `occurrence_projection_versions`
- community vote
- research/community data-use scope

AI候補を従来の`observation_ai_review_targets`にも保存し、既存owner processing UIとの互換性を保つ。別subjectを含むraw candidateと新observation IDsは既存reassessment provenanceへ保持する。

## Rollback

runtimeを直前SHAへ戻すと新規dual-writeだけが停止し、従来AI targetは継続する。追加tableと既存dual-write済み行は削除しない。schema未適用環境へこのruntimeを先行deployしてはいけない。

## 検証

- parser/prompt contract: main subject、coexisting subjects、locator、bounded data
- exact input replay: deterministic observation IDs
- real SQLite schema: 同じplanを2回適用して各entity 2件のまま
- AI-only gate: accepted claim 0、occurrence projection 0
- Cloudflare quick suite、typecheck、Wrangler dry-run
