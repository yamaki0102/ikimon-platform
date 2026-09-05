# 常磐公園の公開Place情報の採用

状態: `NOAH_ADOPTED / SOURCE_VERIFIED / NOT_RUNTIME_APPLIED`
対象Work: `ZUKAN-PLACE-SEARCH-RECOVERY-1423-20260905` / Issue #1423

既存のPlace Atlas SPECに従い、常磐公園 `plc_e3293ec4bb9288a0` の名称、別表記、地域、公開の公園境界、出典参照だけを、検索・地図・Place詳細のための公開メタデータとして採用する。新しいPlace ID、Record、会員、写真、施設の撮影許可は作らない。

## 採用根拠

- 2026-09-05に[静岡市の施設案内](https://www.city.shizuoka.lg.jp/shisetsu/s0000240.html)で「常磐公園」「葵区常磐町3-1」を確認した。公式ページは事実確認とリンクに使用し、写真・説明本文は転載しない。市によるZUKANの運営・推奨を意味しない。
- [OSM way 125727939](https://www.openstreetmap.org/way/125727939) の現行version 5の名称、英語名、park分類と境界を同日確認した。境界bbox `[138.3793901,34.9695006,138.3812408,34.970775]` は既存seedと一致する。OSM IDを内部Place IDへ置換しない。
- OSM由来データには[ODbLと著作権表示](https://www.openstreetmap.org/copyright)および[帰属表示指針](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines)を適用する。地図で `© OpenStreetMap contributors` とcopyrightページへのリンクを表示する。データとして配布する場合もODbLを明示し、既存の非OSM Record・個人データへライセンスを拡張しない。

## 既存sourceの再利用と限定

sourceは `ops/data/universal_place_atlas_canary.json` の上記Place IDの1件である。元の4件canaryを一括で本番採用する決定ではない。元sourceは `yamaki0102/ikimon-platform@f7b1c9762cad787a70756310a40082dac8b705c0`、SHA-256 `de9cae05e3bceb6d8674ee70d956d279629af873948c5f1b8bbac104dba9a775` に固定し、以後sourceの変更があれば差分を再確認する。

機械可読な採用範囲は `ops/data/adopted/universal_place_atlas_tokiwa_20260905.json`、0068適用後の1件限定importは `ops/data/generated/universal_place_atlas_tokiwa_20260905.d1.sql`（SHA-256 `78c3b4a7dcf069d37231a1aa8d3187b217bf02b8447aa5d7e4f291a8dee623a9`）で固定する。importはNULLを含む既存identity/source/alias/boundary/policyとの不一致を先に停止し、完全一致の再適用だけを許す。既存行を更新せず、Record、membership、media、private rowを作らない。

`recordingPolicy=check_rules`、`photographyRuleStatus=unknown`、`contributionCtaMode=check_rules` を保持する。Record/Place Memory/mediaの追加、既存非公開データの公開、推測によるmembership backfillは0件とする。公開検索APIには既存契約どおりbboxだけを返し、個人の位置を追加しない。

## runtime適用前に必要な証拠

1. 既存0068 broker sourceと、現在登録されたmigration profile/provider/runtimeが一致すること。broker sourceの存在だけをexact import登録やruntime適用と混同しない。
2. 0068は既存の固定brokerを再利用し、上記exact import artifactとdigestを許可済みOBS_DB実行経路のtransaction、restore、read-backへ結び付けること。schema移行とimportを同一transactionへまとめることは要求しない。import単体の原子性と、反映後の対象限定復旧または非公開化・公開応答（キャッシュ含む）の確認が必要である。現在の検索SQLはrollout flagだけでは非公開にならないため、flag無効化だけをrollback成功として扱わない。このexact import bindingは未検証・登録待ちである。artifact自体の1件限定、冪等性、NULLを含む衝突時停止は実SQLite回帰で確認する。旧4件generated SQLは更新句を含むため、そのまま汎用SQL gateへ通さない。
3. stagingで出典リンク、別表記・英語名から正式Place IDへの解決、safe bbox、詳細、該当なし状態、非公開・withdrawn・ineligible・旧版sourceの除外を確認すること。
4. current production authorityと同じsource/回復/read-backを確認してから適用すること。単なるschema作成や空結果200を検索復旧として扱わない。

この採用記録はruntime反映、production完了、NEXUSのWork E2E完走を証明しない。元のstaging canaryの採用範囲は、上記1件のsource採用に限り更新され、残り3件と全Record/mediaの境界は維持される。
