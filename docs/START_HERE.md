# ikimon.life — Documentation Start Here

このrepoの実装入口はroot [`AGENTS.md`](../AGENTS.md)、機械可読project pointerは[`PROJECT.json`](../PROJECT.json)です。

公開サービスの現行名は`ZUKAN`です。`ikimon.life`、`platform_v2`、repository名、API名は移行承認まで技術識別子として維持します。ZUKANは生き物・自然観察アプリを他領域へ拡張するサービスではなく、地域の写真、資料、観察、活動、出来事等を根拠・時点・権利・確認状態つきで育て、ViewやPublicationへ返す地域知識基盤です。

ZUKANの有効なプロダクト境界は [`spec/zukan-product-architecture/SPEC.md`](spec/zukan-product-architecture/SPEC.md)、実装順は [`spec/zukan-product-architecture/PLAN.md`](spec/zukan-product-architecture/PLAN.md) を参照します。

公開ホームの現行仕様は [`spec/public-home-state-split.md`](spec/public-home-state-split.md)、完了判定は [`operations/public-home-ux-completion-gate.md`](operations/public-home-ux-completion-gate.md) を参照します。

## 読む順番

1. [`AGENTS.md`](../AGENTS.md) — current app、security、test、deploy境界
2. [`PROJECT.json`](../PROJECT.json) — organization / service / projectと外部正本へのpointer
3. [`spec/zukan-product-architecture/SPEC.md`](spec/zukan-product-architecture/SPEC.md) — ZUKANの現行プロダクト境界
4. このファイル — product docsの入口
5. 対象機能のREADME
6. 現行仕様、ADR、実装計画
7. `yamaki0102/all-projects-management`のcurrent-state packetと中央Issue
8. 対応Issue・PR・code・tests

## Current app

通常の開発対象は`platform_v2/`です。`upload_package/`は互換・rollback・data preservation等の明示的なlegacy作業だけで扱います。

## 主要な仕様入口

### ZUKANのプロダクト構造・Record／Claim／Publication／Action境界

[`spec/zukan-product-architecture/SPEC.md`](spec/zukan-product-architecture/SPEC.md)

Knowledge Core、Participation / Workflow、Experience / Publicationの3層と、横断Domain Pack、安全・緊急対応の責任境界を定義します。

### 記録詳細・複数観察・AI解析・環境モニタリング

[`spec/record-detail-observation/README.md`](spec/record-detail-observation/README.md)

この仕様は、record、observation、media、identification、occurrence、AI provisional data、community identification、environment assessment、monitoringの責務を分離します。これらの生物専門モデルはBiodiversity Domain Packとして維持し、ZUKAN全体の対象境界とは解釈しません。

## 正本境界

- company / product strategy: `yamaki0102/ikimon-business-strategy`
- active product specification / ADR / implementation plan / code: このrepo
- live phase / blocker / next action / deploy state: `yamaki0102/all-projects-management`
- organization boundary: `yamaki0102/company-strategy-portfolio`
- global routing: `yamaki0102/github-project-map`

このrepoへ横断的なlive statusや他社戦略を複製しません。

## 書き方

- `SPEC.md`: 現在有効な契約
- `decisions/ADR-*`: 変更理由、棄却案、影響
- `PLAN.md`: 実装順、migration、検証、rollback
- GitHub Issue: 個別作業
- Pull Request: 差分、review、verification evidence

ローカル絶対パス、端末名、secret、OAuth値を恒久的な正本参照として書きません。
