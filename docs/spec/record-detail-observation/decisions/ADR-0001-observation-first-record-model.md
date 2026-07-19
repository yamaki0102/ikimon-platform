# ADR-0001 — Observation-first record model and AI promotion boundary

- decision status: accepted
- implementation status: planned migration
- decision date: 2026-07-19
- supersedes in part: `docs/architecture/adr-0004-observation-entity-model.md`

## Context

既存設計では`occurrence`が、写真内subject、観察データ、Darwin Core occurrence、AI生成対象を兼ねる箇所があります。また旧ADRは、AI candidateからhuman同意後にoccurrenceを作るモデルを採用していました。

現在のproduct要件では、投稿保存後にmulti-subject AI解析を自動実行し、AIが新しい対象を発見した場合、その対象を確認待ちの観察単位として表示・編集できる必要があります。

一方、AIだけで科学データ、accepted identification、研究利用へ昇格させると、community provenance、位置保護、権利、品質の境界が崩れます。

## Decision

### 1. Recordとobservationを分離する

- recordは投稿・media・時刻・場所・公開範囲のコンテナ
- recordは0..N observationsを持つ
- observationはrecord内で分けて扱う観察対象

### 2. Observationとmediaを多対多にする

1枚のmediaに複数subjectが存在し、1 observationを複数mediaが支えるため、多対多とします。crop / region / time range等はlink側のsubject locatorとして持てます。

### 3. AIはprovisional observationを作成できる

採用する契約:

> AIはprovisional observationを作成できる。ただしAIだけでは確定観察・accepted identification・active occurrence・研究利用可能データに昇格させない。

AIが作ったobservationにはorigin、model / prompt / rule version、input media、subject locator、confidenceを保持します。

### 4. Occurrenceを科学データ用projectionにする

occurrenceはobservationそのものではなく、confirmed observation、accepted identification、rights、privacy、quality gateから生成される派生投影とします。

sourceが変われば再生成でき、projection versionとprovenanceを追跡します。

### 5. Community identificationを募集操作から分離する

public recordは、投稿者が「みんなに聞く」操作をしなくてもcommunity同定可能です。

- 募集ボタンを実装しない
- AIをcommunity票へ含めない
- AI候補、投稿者判断、community票、reviewer判断を別sourceとして保持する

### 6. Environment assessmentとmonitoringを分離する

1 recordやmediaから得るAI環境推定はprovisional assessmentです。site / placeの継続monitoringは複数sourceを集約する別contractとし、単一AI結果で直接上書きしません。

## Consequences

### Positive

- AIのmulti-subject結果を投稿後すぐ活用できる
- AI候補と科学データの信頼境界を維持できる
- ペット、群れ、個体不明、環境写真を無理なく表現できる
- community同定が投稿者の追加操作に依存しない
- occurrence / GBIF / research exportを再生成可能な投影として管理できる
- 位置保護とrightsをprojection gateへ組み込める

### Costs

- 新entity、mapping、state transition、audit ledgerが必要
- 既存occurrence中心read / writeとのdual-writeが必要
- backfillでsubject境界が曖昧なrecordを自動確定できない
- UIにrecord状態、observation状態、identification状態の違いを表現する必要がある

## Rejected alternatives

### AIはcandidateだけ作り、observationを作らない

棄却。投稿後の自動multi-subject解析で発見された対象を、編集・確認可能な第一級単位として扱えません。

### AIがoccurrenceまで直接作る

棄却。AI推論と科学データの昇格を同一視し、human provenance、rights、privacy、quality gateを崩します。

### occurrenceを引き続きsubject / observation / exportへ兼用する

棄却。UI、domain、研究projectionの変更速度と責務が異なり、状態遷移が曖昧になります。

### Community同定を「みんなに聞く」に依存させる

棄却。公開recordの共同同定を投稿者の追加操作に依存させ、未募集recordが孤立します。

## Migration

`expand → dual-write → backfill → shadow-read → cutover → contract`で進め、一括置換しません。詳細は`../PLAN.md`を正本とします。

## Supersession note

`docs/architecture/adr-0004-observation-entity-model.md`の次の部分を置き換えます。

- subjectをoccurrence行として表現するmapping
- candidateからoccurrenceへ直接昇格する状態モデル
- 「AI単独ではoccurrenceにしない」を、AIがobservation自体を作れないという意味に読む旧契約

旧ADRのmulti-subject、alternative hypothesis、event / interaction、研究品質を守る目的は維持します。
