# UTSUROU実装実施計画（superseded）

- 初回作成日: 2026-07-26
- superseded: 2026-07-28
- 状態: `HISTORICAL / DO_NOT_EXECUTE`
- current plan: `ZUKAN_EXECUTION_PLAN.md`
- current P0: `SPEC.md`
- 関連Issue: #1469

## 結論

`UTSUROU／うつろう`を公開サービス名として実装する計画は現行ではない。公開サービス名はZUKANへ統一するstrategy candidateが`ikimon-business-strategy#28`に存在する。

旧計画から次をZUKANへ継承する。

- current `ikimon.life` appを作り直さない
- 個人P0
- 常設ナビ`撮る｜場所｜記録｜自分`
- Place Atlas、Place timeline、`この場所のうつろい`
- 磐田公開データ、Quest、Review、correction、writeback
- source、staging、production、domainを分離する
- AIが事実、同定、Place、正本を自動確定しない

次は継承しない。

- UTSUROUをservice name、logo、metadata、URL、contract、正式発表へ使う
- `うつす`をservice-wide canonical actionにする
- 旧SHAをcurrent baselineとして扱う
- UTSUROU brand previewをrelease候補にする

Draft PR #1459の有効なruntime gateは、latest mainからZUKAN目的のfresh PRへ再構築する。旧branchをそのままstaging・productionへ出さない。

過去の詳細はGit履歴に保持する。
