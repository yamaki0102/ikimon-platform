# ADR-0002 — 記録詳細の通常閲覧面をmedia-firstにする

- Status: accepted
- Date: 2026-07-23

## Context

observation-firstへのcutover後、記録詳細はobservationごとのmedia、状態、由来、同定履歴、管理操作を一括展開していました。これにより、写真・動画・音を楽しみ、自然に気づくページではなく、observation管理画面として知覚されていました。同一mediaを複数observationが証拠に使う場合は、写真も重複表示されていました。

## Decision

- observation-firstのentity、provenance、policy、migration、no-JS mutationは維持する。
- 通常閲覧面ではrecord mediaを先頭へまとめ、同一mediaを一度だけ表示する。
- 0 observationsではobservation UIを表示しない。ただし、保存済み解析結果がある景色・場所・暮らしの記録は、写真内の構成要素、非検出または判定不能、environmentを同じ共通骨格で表示する。1件では件数を強調せず、複数件では最大3件を1枚のsummaryにまとめる。
- AI suggestion、accepted identification、community claimは混同せず、summaryから操作後の詳細へ進める。
- split、merge、exclude、restore、media reassignment、proposal policy、owner decisionは「詳しい編集」へ下げる。
- community proposal formは常時展開せず、「名前を提案する」操作後に開く。提案0件の空状態は表示しない。
- environmentとlearningは既存read modelに値がある場合だけ軽い補助情報として表示する。存在しない季節性、生態、地域文脈を生成しない。
- 生きものの表示状態は`detected / not_detected / not_assessable`を区別する。`completed_no_candidate`だけを「この写真では姿を確認できなかった」へ、AI再解析`failed`を「この写真だけでは判断できなかった」へ投影し、いずれも不在claimにはしない。解析事実がない0 observationsへ状態を推測表示しない。
- `observation_environment_records`のうち`*_source = derived`である保存済み値だけを、allowlist済みの写真構成要素へ変換する。内部JSON、confidence、未知codeは表示しない。
- 過去比較は、privacy-safeな同一地点identity、比較対象record、比較根拠、利用者向けsummaryが揃った場合だけ表示する。現行D1 read modelはこの契約を満たさないためproduction presentationへ値を供給しない。
- public outputには既存の安全な公開位置だけを使い、座標・cell・mesh・geohash・座標由来IDを追加しない。

## Existing data audit

| Surface | Existing data | This UI |
|---|---|---|
| record media | photo / video / audio public derivatives | record galleryとして表示 |
| AI candidate | suggested name / score / `rationale_json.visualEvidence` / `needsMoreEvidence` | 名前、見分け根拠、追加撮影助言を値がある場合だけ表示 |
| accepted identification | accepted human claim | 確定名として表示 |
| community proposals | human claims | 1件以上の場合だけ表示 |
| environment | latest public `observation_environment_records` | 内部codeを利用者向け要約へ変換 |
| non-detection | `observation_ai_review_targets.ai_assessment_status = completed_no_candidate` | 写真内で候補を確認できなかったことを、不在と断定せず表示 |
| not-assessable | latest `observation_reassessment_requests.request_state = failed` | 判定不能として短く表示。エラー画面にはしない |
| scene elements | `observation_environment_records`の写真由来5項目 | allowlistで水面・草地・樹木・地面・構造物等へ変換 |
| note | record note | 内容がある場合だけ表示 |
| capture information | observed time / safe public location / visibility / media count | metadataと折りたたみ情報へ表示 |
| related records | privacy-safe same-area read model | 存在する場合だけ表示 |
| previous comparison | privacy-safe同一地点comparison projectionは未実装 | UI契約のみ。通常read modelでは非表示 |
| seasonality / ecology / regional learning | record detail read modelに未保存 | 非表示。別PRのread-model拡張候補 |

PostgreSQLの`visual_observation_signals`と`place_environment_snapshots`は、このD1 detailへ安全にrecord-linkする契約がないため直接参照しません。新しいAI API、migration、backfillも追加しません。

## Consequences

閲覧者はmediaを先に見て、必要なときだけ観察詳細・名前提案・詳しい編集へ進みます。管理機能は削除されず、no-JSと既存の権限・冪等性境界も保たれます。将来、季節性・生態・地域文脈を出す場合は、保存・provenance・privacyを定義したread-model拡張を別PRで行います。
