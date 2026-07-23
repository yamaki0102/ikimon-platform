以下、パケット本文の記載内容に基づきレビューします（画像・添付は本文の検証メモで代替判断します）。

## 1. 採用すべき点

- **根本原因の特定が正確**。`\d` がテンプレートリテラル層で `d` に落ちて「literal d」を照合していた、という診断は具体的で再現性がある。`[0-9]+` 化で emit 後の browser regex を安定させる修正方針は妥当。
- **`typecheck`/`build` をすり抜けるバグ**であることを認識し、実ブラウザで `osm:way:1281984233` を assert する focused E2E を通している点は、この bug クラスに対して正しい検証層を選べている。
- **fail-closed の骨格**：transient selection を「有効な OSM way/relation を持つ public canonical 結果のみ」に限定し、それ以外は旧 area-polygons 経路へフォールバックする設計は方向として正しい。
- **exact Record coordinate を使わず** safe_bbox 投影を再利用し、永続化しない UI selection context と明示している点はプライバシー設計として良い。
- staging-only で DB/migration/secret/prod/coord に変更なし、という**影響範囲の限定**が明確。

## 2. 重大な懸念

- **`generated_radius` の中心が未定義（P0候補）**。「bbox が無い場合のみ generated_radius」とあるが、その円の**中心が何由来か**が本文にない。もし中心が Record の exact coordinate に依存するなら、safe_bbox でせっかく守った位置プライバシーが fallback 経路で漏れる。ここが最大のリスク。
- **即時 profile open と area-polygons 討索の競合（P0候補）**。transient で即座に profile を開きつつ「normal map movement と area discovery を継続」し、かつ旧 delayed matching path も残す＝**selection を書き換える主体が2つ並走**。後着の area-polygons 応答が transient selection を上書き／クリアして stale flip を起こしうる。連打（A→B クリック）時の last-write 保証も不明。
- **marker-click timeout 2件の未解明**。まさに今回変更した操作（クリック→handoff）で isolated timeout が出て targeted rerun で通した、という状態は上記 race を隠蔽している smell の可能性が高い。未説明のまま先へ渡すべきでない。
- **negative テストの欠落**。node のみ／osmSourceId 欠落時に「profile を開かない・空 osm_id を送らない」ことを保証するテストがない。root cause が「空の osm_id を素通りさせた」系である以上、fail-closed は正の証跡だけでは不十分。

## 3. P0で変更すべき仕様

1. **`generated_radius` の中心と半径の出自を明示・保証**する。中心は public な検索 centroid/bbox 由来に限定し、exact record coord を絶対に参照しない不変条件をコード＋テストで固定。半径は 0 でも過大（実質グローバル）でもない上下限を設ける。
2. **selection の順序保証**を入れる。ユーザ操作ごとに selection token（generation counter）を発行し、profile open・area-polygons 応答・旧 matching path のいずれも**現行 token 以外の書き込みを破棄**（last user action wins、last network arrival ではなく）。連打・パン中の後着応答で確実に stale を防ぐ。
3. **marker-click timeout 2件を root-cause 化**し、race に起因しないことを確定させる（起因するなら 2 の修正で解消するはず）。「rerun で緑」で塞がない。
4. **negative regression を追加**：(a) osmSourceId 欠落／(b) node-only の結果で profile を開かず旧経路へ落ちること、(c) emit された bootScript 文字列が `[0-9]+` を含み `\d`/`d+` を含まないことの assert（テンプレートリテラル再エスケープ回帰の安価なガード）。

## 4. P1以降に回すべき仕様

- transient bbox と osm_area 実ジオメトリの**視覚的整合**（実 geometry ロード後に bbox ヒントを破棄し、boundary の jump/flicker を抑制）。機能は成立するので P1。
- bbox の**軸順・座標順の契約整合**（lon/lat と `[minx,miny,maxx,maxy]` 対 `[S,W,N,E]`）の明文確認。既存 public search contract 再利用でリスクは低いため P1、ただし one-line で確認は残す。
- 反経線跨ぎ／退化 bbox（zero-area）の扱いを generated_radius 経路と統一。
- `kind=osm_area` profile が restricted 位置の record を CTA 以外でも露出しないことの網羅確認（現状 CTA 非表示のみ検証）。

## 5. 最終推奨

**条件付きで staging デプロイ可**。中核修正（`[0-9]+`）は正しく、影響範囲も staging 限定・非破壊的。ただし P0 の2点—**generated_radius の中心出自**と**selection 順序保証（+timeout の根本解明）**—は staging 投入前に潰すことを推奨。特に generated_radius の中心が record exact coord 由来でないと確認できるまでは、プライバシー観点で「安全と断定できない」ため fallback 経路を一時無効化（bbox 無し結果は旧経路のみ）にして投入する回避策が安全。

質問への直接回答：
1. **潜在的 P0 あり**。safe_bbox 本体は問題ないが、`generated_radius` 中心が未定義のため leak 可能性を否定できない。
2. **race し得る**。書き込み主体が複数並走し、token による順序保証がない。timeout 2件はその兆候の疑い。
3. **概ね fail-closed**だが negative テストがなく、保証はコードレビュー水準に留まる。
4. **不十分**。正の browser E2E は良いが、negative・emit 文字列・race のテストが欠落。
5. **staging 限定なら実質ブロッカーではない**が、上記 P0 未解決のままの promotion は不可。
