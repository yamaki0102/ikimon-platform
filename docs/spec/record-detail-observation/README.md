# 記録詳細・複数観察・AI解析・環境モニタリング

## Status

- specification status: current target contract
- implementation status: planned migration; existing code must be audited PR by PR
- supersedes: `docs/architecture/adr-0004-observation-entity-model.md`のsubject / occurrence昇格契約と「AI単独ではobservationを作らない」に相当する旧解釈
- central execution: `yamaki0102/all-projects-management#413`およびikimon.lifeのcurrent-state packet

## Purpose

1つの投稿記録を、写真コンテナ、観察対象、同定、科学データ、環境推定、継続モニタリングへ分離し、AI自動解析とcommunity同定を安全に両立させます。

## 読む順番

1. [`SPEC.md`](SPEC.md) — 現在有効なproduct contract
2. [`decisions/ADR-0001-observation-first-record-model.md`](decisions/ADR-0001-observation-first-record-model.md) — 採用理由と旧契約からの変更
3. [`PLAN.md`](PLAN.md) — additive migration、PR分割、verification、rollback
4. `yamaki0102/all-projects-management` — 現在フェーズ、blocker、active PR、deploy状態

## Core model

```text
record 1 ── 0..N observation
record 1 ── 1..N media
observation N ── N media
observation 1 ── 0..N identification
observation 1 ── 0..1 active occurrence projection
record / media ── AI analysis result
place / record ── environment assessment
site / place / project ── monitoring series
```

## Non-negotiable contracts

- AIはprovisional observationを作成できる
- AIだけではconfirmed observation、accepted identification、active occurrence、研究利用可能データへ昇格させない
- community同定は投稿者の募集操作に依存しない
- 「みんなに聞く」は実装しない
- AIをcommunity票へ含めない
- occurrenceはobservationからの科学データ用派生投影
- AI環境推定とmain monitoringを分離する
- 全公開面へ共通位置保護を適用する
- migrationは`expand → dual-write → backfill → shadow-read → cutover → contract`

## Scope boundary

このフォルダはproduct specification、decision、implementation planの正本です。日々の進捗、PR番号、deploy実績を時系列で追記しません。
