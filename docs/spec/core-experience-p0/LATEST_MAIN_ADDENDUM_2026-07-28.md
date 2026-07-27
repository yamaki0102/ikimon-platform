# Latest main addendum: 磐田市公開データZUKAN View

- 観測日: 2026-07-28
- latest main: `c8ff06e177c6fa43b728fbf6ed9d7674f8abebe3`
- merged PR: #1468
- 親Issue: #1467
- 本文書PR: #1470
- 状態: `SOURCE_IMPLEMENTED / RUNTIME_NOT_VERIFIED`

## 1. 追加されたsource

latest mainへ、磐田市の実公開オープンデータを読取専用の地域Viewとして表示するsourceが追加された。

- route: `/iwata`
- API: `/api/iwata/open-data`
- 59件
- 地図
- 全文検索
- 4カテゴリfilter
- 位置欠損・data接続候補の可視化
- 原典、取得日、原典更新日、利用条件
- source-only snapshotとtests

対象dataset:

- 観光施設
- 都市公園
- 交流センター
- 文化財

主なsource:

- `platform_v2/src/routes/iwataOpenData.ts`
- `platform_v2/src/services/iwataOpenDataSnapshot.ts`
- `platform_v2/src/services/iwataOpenDataSnapshot.test.ts`
- `platform_v2/e2e/iwata-open-data.staging.spec.ts`

## 2. 境界

実装されていない、または本監査では未確認:

- staging deploy・verify・Visual QA
- production deploy・verify
- DB / migration
- 市公式dataへのwriteback
- canonical PlaceIdentityへの確定統合
- existing Observationとのmembership確定
- correction / Review / WritebackReceipt
- 見付deep slice
- 市側責任者・正本担当・正式更新経路

名称・座標だけでsame-placeを自動確定しない境界は維持されている。

## 3. 実施計画への反映

`ZUKAN_EXECUTION_PLAN.md`のWP6は、次の状態へ更新して読む。

```text
Phase 1: public snapshot View source implemented
Phase 2: current main runtime QA pending
Phase 3: PlaceIdentity candidate adapter pending
Phase 4: existing Record / Observation connection pending
Phase 5: deep culture / Mitsuke slice pending
Phase 6: correction / writeback pending
```

WP6をゼロから再実装しない。`iwataOpenDataSnapshot`と`/iwata`を再利用し、Place Graph・P0・Reviewへ接続する。

## 4. P0への影響

個人P0のREADY判定は変わらない。

- `/iwata`表示が存在しても、capture、owner、AI、edit、public safety、Place membershipのfresh E2Eがなければ`NOT_READY_P0`。
- P0 runtime QAはlatest main `c8ff06e...`以降から再構築する。
- Draft PR #1459の古いbaseをそのまま使わない。

## 5. PR #1470のbase

PR #1470 branchは`3c6f355...`から作成されたが、latest mainとの差分はPR #1468の新規Iwata sourceのみで、P0 docs pathとの直接競合はない。

merge前にlatest main追従を確認し、Iwata sourceを失わない。PR本文・台帳ではcurrent implementation mainを`c8ff06e...`として扱う。
