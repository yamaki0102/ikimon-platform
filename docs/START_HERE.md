# ikimon.life — Documentation Start Here

このrepoの実装入口はroot [`AGENTS.md`](../AGENTS.md)、機械可読project pointerは[`PROJECT.json`](../PROJECT.json)です。

公開ホームの現行仕様は [`spec/public-home-state-split.md`](spec/public-home-state-split.md)、完了判定は [`operations/public-home-ux-completion-gate.md`](operations/public-home-ux-completion-gate.md) を参照します。

## 読む順番

1. [`AGENTS.md`](../AGENTS.md) — current app、security、test、deploy境界
2. [`PROJECT.json`](../PROJECT.json) — organization / service / projectと外部正本へのpointer
3. このファイル — product docsの入口
4. 対象機能のREADME
5. 現行仕様、ADR、実装計画
6. `yamaki0102/all-projects-management`のcurrent-state packetと中央Issue
7. 対応Issue・PR・code・tests

## Current app

通常の開発対象は`platform_v2/`です。`upload_package/`は互換・rollback・data preservation等の明示的なlegacy作業だけで扱います。

## 主要な仕様入口

### 記録詳細・複数観察・AI解析・環境モニタリング

[`spec/record-detail-observation/README.md`](spec/record-detail-observation/README.md)

この仕様は、record、observation、media、identification、occurrence、AI provisional data、community identification、environment assessment、monitoringの責務を分離します。

### 地域フィールドガイド・紙地図・PDFの知識取込

- 現行仕様: [`spec/regional-field-guide-intake/SPEC.md`](spec/regional-field-guide-intake/SPEC.md)
- 実装計画: [`spec/regional-field-guide-intake/PLAN.md`](spec/regional-field-guide-intake/PLAN.md)
- 決定記録: [`spec/regional-field-guide-intake/decisions/ADR-001-source-first-rights-safe-intake.md`](spec/regional-field-guide-intake/decisions/ADR-001-source-first-rights-safe-intake.md)

原資料、版、fragment、抽出、Claim、identity候補、review、rights、public projectionを分離し、公開PDFをそのまま再掲載せず地域知識へ変換する契約です。

## 正本境界

- product specification / ADR / implementation plan / code: このrepo
- live phase / blocker / next action / deploy state: `yamaki0102/all-projects-management`
- company strategy: `yamaki0102/ikimon-business-strategy`
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
