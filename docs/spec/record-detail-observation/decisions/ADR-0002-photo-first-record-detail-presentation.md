# ADR-0002 — 記録詳細の通常閲覧面をmedia-firstにする

- Status: accepted
- Date: 2026-07-23

## Context

observation-firstへのcutover後、記録詳細はobservationごとのmedia、状態、由来、同定履歴、管理操作を一括展開していました。これにより、写真・動画・音を楽しみ、自然に気づくページではなく、observation管理画面として知覚されていました。同一mediaを複数observationが証拠に使う場合は、写真も重複表示されていました。

## Decision

- observation-firstのentity、provenance、policy、migration、no-JS mutationは維持する。
- 通常閲覧面ではrecord mediaを先頭へまとめ、同一mediaを一度だけ表示する。
- 0 observationsではobservation UIを表示しない。1件では件数を強調せず、複数件では最大3件を1枚のsummaryにまとめる。
- AI suggestion、accepted identification、community claimは混同せず、summaryから操作後の詳細へ進める。
- split、merge、exclude、restore、media reassignment、proposal policy、owner decisionは「詳しい編集」へ下げる。
- community proposal formは常時展開せず、「名前を提案する」操作後に開く。提案0件の空状態は表示しない。
- environmentとlearningは既存read modelに値がある場合だけ軽い補助情報として表示する。存在しない季節性、生態、地域文脈を生成しない。
- public outputには既存の安全な公開位置だけを使い、座標・cell・mesh・geohash・座標由来IDを追加しない。

## Existing data audit

| Surface | Existing data | This UI |
|---|---|---|
| record media | photo / video / audio public derivatives | record galleryとして表示 |
| AI candidate | suggested name / score / `rationale_json.visualEvidence` / `needsMoreEvidence` | 名前、見分け根拠、追加撮影助言を値がある場合だけ表示 |
| accepted identification | accepted human claim | 確定名として表示 |
| community proposals | human claims | 1件以上の場合だけ表示 |
| environment | latest public `observation_environment_records` | 内部codeを利用者向け要約へ変換 |
| note | record note | 内容がある場合だけ表示 |
| capture information | observed time / safe public location / visibility / media count | metadataと折りたたみ情報へ表示 |
| related records | privacy-safe same-area read model | 存在する場合だけ表示 |
| seasonality / ecology / regional learning | record detail read modelに未保存 | 非表示。別PRのread-model拡張候補 |

`place_environment_snapshots`はこのdetailへ安全にrecord-linkする契約がないため、この変更では直接参照しません。

## Consequences

閲覧者はmediaを先に見て、必要なときだけ観察詳細・名前提案・詳しい編集へ進みます。管理機能は削除されず、no-JSと既存の権限・冪等性境界も保たれます。将来、季節性・生態・地域文脈を出す場合は、保存・provenance・privacyを定義したread-model拡張を別PRで行います。
