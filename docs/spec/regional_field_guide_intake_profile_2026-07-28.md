# 地域フィールドガイド取込プロファイル v0 — Inabe Green Map example

- 作成日: 2026-07-28
- 状態: `superseded as normative contract`
- 正本化日: 2026-07-28
- 現行仕様: [`regional-field-guide-intake/SPEC.md`](regional-field-guide-intake/SPEC.md)
- 実装計画: [`regional-field-guide-intake/PLAN.md`](regional-field-guide-intake/PLAN.md)
- 決定記録: [`regional-field-guide-intake/decisions/ADR-001-source-first-rights-safe-intake.md`](regional-field-guide-intake/decisions/ADR-001-source-first-rights-safe-intake.md)
- 実装Issue: [#1486](https://github.com/yamaki0102/ikimon-platform/issues/1486)

この文書は、`Inabe Green Map いなべの自然とあそぶ`を見本として、紙地図、PDF、冊子、フィールドガイドをZUKANへ蓄積する考え方を初めて整理した説明資料である。

PR #1485で、次のsource-only登録を行った。

- publisher: `publisher:inabe-city`
- source: `source:inabe:green-map:2026`
- format: `pdf`
- rights: `INDEX_ONLY`
- state: `RIGHTS_CLASSIFIED`
- issued: `2026-03-01`
- geographic scope hint: `place:jp-mie-inabe`

PDF本文、写真、イラスト、地図、紙面はrepositoryへ複製していない。SourceObject、SourceFragment、ExtractionRun、Claim候補、人レビュー、public projectionも未実施である。

本書にあった有効なrights、evidence、identity、edition、publicationの契約は`SPEC.md`へ、実装順、migration、verification、rollback、停止条件は`PLAN.md`へ移した。以後、この文書をproduct contractまたは実装順の正本として参照しない。
