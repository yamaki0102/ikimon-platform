# 外部レビュー採否

- モデル: `gemini-3.1-flash-lite`
- 判定: `CONDITIONAL PASS`

## 採用

- 壊れたJSONでもcron全体を止めないよう、`json_valid` を含む選択SQLへ強化した。
- 現行v3完了結果の再投入禁止、粗い旧結果の優先、公開・非表示・画像privacy条件を同じSQLで実行するSQLiteテストを追加した。
- active上限40、1 tick最大10、上限到達時0件をpure unit testで固定した。
- unique keyと旧payload compare-and-swapによる競合防止をcontract testへ固定した。

## 不採用

- 「v3の粗い結果が無限再処理される」指摘は不採用。選択条件が `ruleVersion <> current` を要求し、テストでもv3粗結果を除外している。
- `BEGIN IMMEDIATE` / `FOR UPDATE` 追加は不採用。D1の実行モデルに対し、既存のunique keyとcompare-and-swapの方が狭く安全である。

## 保留

- 実負荷値はstagingで、pending/processing数、1 tick投入数、D1 query latency、Gemini batch完了率を確認する。

## 未確認

- 本番で代表レコードが具体候補へ更新される最終値。production promotion後のAI生成結果を写真と目視照合する。
