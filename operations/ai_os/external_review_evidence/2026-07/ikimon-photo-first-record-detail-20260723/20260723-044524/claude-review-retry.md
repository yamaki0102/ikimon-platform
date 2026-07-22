# PR-F photo-first record detail レビュー

**注記**: packet本文のみで判定。実装・i18n文言・テスト本体・画像は未確認のため、本文で言及されるが中身が示されていない箇所は反証対象とする。

## Verdict

条件付き承認（P0対応後にマージ可）。写真中心への回帰と、seasonality/ecology/similar-speciesを捏造せず、`place_environment_snapshots`を契約未確立として使わないスコープ規律は妥当。N観測の扱いとAI提案が確定同定に見えない保証はpacketだけではclosedと判断できない。

## 採用すべき点

- mobile/desktopともmediaを最上段に置き、observationを要約から折りたたみ詳細へ段階開示する構成は写真中心UXとして正しい。
- read modelにない季節性、生態、類似種、地域学習をUIで作らない規律は維持すべき。
- privacy-safeなrecord紐付け契約が未検証の`place_environment_snapshots`を使わない判断は正しい。
- no-JS復帰パスをローカライズする点は良い。

## 重大な懸念

1. Dedupキーがpacketに未定義。署名付きURLやquery差異を考慮し、media IDでdedupすべき。
2. accepted name、AI candidates、community proposalsを同じ詳細へ並べる場合、summaryの同定source規律が必要。accepted不在のAI/communityを確定名に見せず、4言語で区別すべき。
3. wireframeの“one observation summary”ではNの意味が曖昧。複数observationを黙って隠さず、summaryから全件へ到達可能にすべき。
4. media URLのpath/queryへcoordinateやgeohashが入らない否定testが必要。
5. observed timeとsafe public locationの組合せ、environmentのmicrohabitat、guest form policy、keyboard focusは追加確認対象。

## UI PR内で確認すべきP0

- N observationsのsummaryと全件到達を定義する。
- accepted優先、accepted不在のAI/communityは未確定と分かるsource規律を定義する。
- media ID dedupを固定する。
- media URL exact-place非混入testを明示する。

## UI PR外へ延期すべき事項

- seasonality / ecology / similar-species / regional learningのAI処理・schema追加。
- `place_environment_snapshots`のprivacy-safe紐付け契約。
- EXIF除去そのものは取込・public derivative pipeline側の責務。UI PRは安全なprojectionだけを使い、URL/HTMLに座標を出さないことを担保する。

## 最終推奨

P0の4点（N観測提示、同定source規律、media ID dedup、media URL座標非混入）をdiffで確認できればマージ可。

---

Evidence note: このファイルは`claude-opus-4-8`による2026-07-23 retry rawの意味内容を原文の構造を保って転記したもの。元の完全raw locatorは`E:\Projects\_agent_scratch\claude-latest-review\ikimon-photo-first-record-detail-20260723-claude-retry\claude-review-20260723-044610.md`。
