# Map Place Atlas MVP Implementation Plan

Status: fixed before implementation
Issue: [#1418](https://github.com/yamaki0102/ikimon-platform/issues/1418)
Baseline: `2a93c8983e2c836b847730bd77f9ff964c0404a0`
## 完了条件

1. field / OSM area / public cellを同一`PlaceAtlasProfile v1`で取得できる。
2. Record・mediaを重複計上せず、nullと0、partialとsuppressedを区別する。
3. 新APIはexact coordinate、private/hidden、sensitive locationを追加公開しない。
4. map selectionはprofileを遅延取得し、競合responseを適用しない。
5. desktop/mobileで地域図鑑を閲覧し、記録CTAと地図へ戻る操作が完了する。
6. NodeとCloudflare Workerが同じcontractを返す。
7. typecheck、Node tests、Worker tests、対象E2E、Visual QA、Wレビューがgreen。
8. exact SHAでstaging、productionを検証し、GitHub・deploy registry・PRへ証跡を残す。

## 変更単位

### 1. Contractと仕様

- `placeAtlasContract.ts`
- `SPEC.md` / `PLAN.md` / ADR
- pure unit tests

検証: ref validation、dedupe、facet、highlight、suppression。

### 2. Read ModelとAPI

- Node adapter `placeAtlasProfile.ts`
- `mapApi.ts`
- Cloudflare Worker D1/OSM adapter
- Node route tests / Worker tests

検証: 3参照kind、invalid/not found、cache、privacy、safe failure。

### 3. UI

- `mapPlaceAtlasProfile.ts`
- `mapExplorer.ts`はclient glueだけ追加
- current area snapshotをAPI failure fallbackとして維持

検証: loading/success/empty/partial/suppressed/error、AbortController、sequence guard、
desktop panel、mobile sheet。

### 4. 品質gate

- `npm --prefix platform_v2 install`
- `npm --prefix platform_v2 run typecheck`
- `npm --prefix platform_v2 run test:node`
- Worker `check` / `test`
- 利用可能なmap E2E
- 375 / 390 / 768 / 1024 / 1280 / 1440+ Visual QA
- secret scan、staged diff check

### 5. GitHubとdeploy

- 目的別commit
- push、Draft PR
- Wレビューraw evidenceと採否logを同一branchへ追加
- 指摘対応後にstaging exact-SHA deploy
- staging green後、明示済み範囲でproduction deploy
- health、ready、`/ja/map`、place-profile、Visual QAを再確認
- PR/Issue/deploy evidenceをcloseout

## 影響範囲

- public map read API
- field / OSM area / public cell selection
- right side panel / mobile bottom sheet
- Cloudflare Worker D1 read path
- public privacy aggregation
- map UI stylesとcontract tests

DB schema、write path、secret、DNS、既存Record/Occurrence dataは変更しない。

## 停止条件

- DB migration、secret、データ削除、権限変更が必要になった場合
- 現行中央deploy registryと実runtimeが矛盾し、正本更新なしに解決できない場合
- Wレビューでprivacy/data integrityの未解消P0/P1が残る場合
- stagingでprofileまたは既存mapの回帰が再現する場合

## Release gate実績

- runtime head `f34bfdb5`: Node 1,365件、Worker 391件、Visual QA 7件がgreen
- Claude `claude-opus-4-8`: `APPROVE_WITH_NONBLOCKING_NOTES`
- Gemini `gemini-3.5-flash`: `APPROVE_WITH_NONBLOCKING_NOTES`
- production blocker、DB migration、secret変更: なし
- raw review、可逆packet、採用判断は
  `operations/ai_os/external_review_evidence/2026-07/map-place-atlas-mvp-20260723-transport-safe/`
  に保存
