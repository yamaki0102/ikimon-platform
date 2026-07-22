# 記録詳細・複数観察・AI解析・環境モニタリング

## Status

- specification status: current target contract
- implementation status: observation-first read/write cutover済み。通常閲覧面のmedia-first表示契約はADR-0002とPR-F文書を正本とする
- next design status: 季節性・生態・類似種・地域文脈、privacy-safe同一地点comparisonは現行record detail read modelに未保存。追加する場合はprovenance付きread-model拡張を別PRで設計する
- supersedes: `docs/architecture/adr-0004-observation-entity-model.md`のsubject / occurrence昇格契約と「AI単独ではobservationを作らない」に相当する旧解釈
- central execution: `yamaki0102/all-projects-management#435`
- current implementation issue: `yamaki0102/ikimon-platform#1376`

## Purpose

1つの投稿記録を、写真コンテナ、観察対象、同定、科学データ、環境推定、継続モニタリングへ分離し、AI自動解析とcommunity同定を安全に両立させます。

## 読む順番

1. [`SPEC.md`](SPEC.md) — 現在有効なproduct contract
2. [`decisions/ADR-0001-observation-first-record-model.md`](decisions/ADR-0001-observation-first-record-model.md) — 採用理由と旧契約からの変更
3. [`CURRENT_INVENTORY.md`](CURRENT_INVENTORY.md) — 現行実装、衝突、再利用可能部分、未確認事項
4. [`decisions/ADR-0002-photo-first-record-detail-presentation.md`](decisions/ADR-0002-photo-first-record-detail-presentation.md) — 通常閲覧をmedia-firstにする決定と利用可能データ監査
5. [`PR_A_EVIDENCE_MATRIX.md`](PR_A_EVIDENCE_MATRIX.md) — GitHubから確認したwriter/readmodel、D1、privacy、monitoring、競合laneの証拠
6. [`PR_B_ADDITIVE_SCHEMA_DESIGN.md`](PR_B_ADDITIVE_SCHEMA_DESIGN.md) — additive-only schema設計、制約、backfill分類、最終実装判断
7. [`PR_A_EXTERNAL_GATES.md`](PR_A_EXTERNAL_GATES.md) — clean checkout、完全検索、read-only metrics、privacy scan、独立reviewの再現手順
8. [`PR_A_LOCAL_AUDIT_RESULTS.md`](PR_A_LOCAL_AUDIT_RESULTS.md) — exact source、aggregate metrics、残gateの実行証跡
9. [`PLAN.md`](PLAN.md) — migration順、PR分割、verification、rollback
10. `yamaki0102/all-projects-management#435` — 現在フェーズ、blocker、active PR、deploy状態

## Core model

```text
record 1 ── 0..N observation
record 1 ── 1..N media
observation N ── N media
observation 1 ── 0..N AI suggestion
observation 1 ── 0..N human identification claim
observation 1 ── 0..1 active occurrence projection
record / media ── AI analysis result
place / record ── environment assessment
site / place / project ── monitoring series
```

## Non-negotiable contracts

- AIはprovisional observationを作成できる
- AIだけではhuman_asserted、accepted identification、verified、active occurrence、community/research利用可能データへ昇格させない
- community同定と同定キューは投稿者の募集操作に依存しない
- public/limitedは提案受付ONが既定、privateはowner-only、ownerはrecord単位で外部提案をOFFにできる
- AI suggestion、owner decision、community claim、curator decisionを混ぜない
- 「みんなに聞く」は実装しない
- AIをcommunity票へ含めない
- occurrenceはobservationからの科学データ用派生投影
- AI環境推定とmain monitoringを分離する
- 全公開面へ共通位置保護を適用する
- migrationは`expand → dual-write → backfill → shadow-read → cutover → contract`

## Current gate

runtime phase、active PR、staging / production deployの現在値は`yamaki0102/all-projects-management`と中央deploy registryを正本にします。migration apply、DB直接変更、backfill、secret変更はroutine UI deployへ混ぜません。

## Scope boundary

このフォルダはproduct specification、decision、implementation plan、current implementation inventory、phase design、external gate手順の正本です。日々の進捗、deploy実績、production row dataを時系列で複製しません。
