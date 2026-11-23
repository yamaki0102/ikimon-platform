# gemini-decision-1（Google Decisions API）仕様と実測 — 2026-11-23

## 仕様（実機で確認済み）
- 口: `POST https://generativelanguage.googleapis.com/v1beta/decisions`、ヘッダ `x-goog-api-key`。generateContent では 404。
- 本文: `{model:"gemini-decision-1", input:[...], questions:{<key>:<q>}}`
  - input: `{type:"image",data:<base64>,mime_type,resolution:"low|medium|high"}` / `{type:"text",text}` / `{type:"audio",data,mime_type:"audio/mpeg"}`（音声は受け付けるが精度低い）。複数画像可。
  - question 型:
    - `noul` `{type:"noul",instructions}` → `answers.k.noul`=はいの確率(0-1)
    - `choice` `{type:"choice",instructions,criteria:{key:説明}}` → `choice`,`confidence`,`probabilities{key:p}`
    - `score` `{type:"score",instructions,criteria:[段階の説明 2〜255個の配列]}` → `score`(期待値),`probabilities`,`legend`。criteria 無しはエラー。
  - 1回に1〜1000問。画像は1回分だけ課金。
- 料金: 入力 $0.10/1M、出力0。`usage.total_input_tokens`。Batch・キャッシュ・多言語指定なし（指示は英語が無難、日本語文も読める）。
- 速さ: 1回 中央値約0.65秒、p95約1秒（20問でも約0.65秒、約220科の選択肢付きで0.72秒）。
- 確率は較正されている: 迷うと0.5付近を返し言い切らない。

## 得意・不得意（ZUKAN ベンチ実測、写真は公開許諾・創業者撮影のみ）
| 用途 | 結果 |
|---|---|
| 写真に名前Xが写っているか（はい/いいえ） | 14/16（3.1 Flash-Lite 12/16） |
| 仲間分け（鳥/虫/植物…）選択 | 18/18 |
| 種の選択（190種の閉じた一覧） | 15/17（Flash-Lite と同等） |
| **科の検索表**（仲間→約220科、各選択に「一覧にない」「判別できない」付き、1回） | 正解の科15/15、採用13件全正解、**正解の科を一覧から外すと15/15で「一覧にない」に逃げ誤受入0**。$0.47/1000件 |
| **確信度の実測**（各名前の noul） | 「高」(p≥0.8) 33/33正解、「中」21/22、外れは「低」に集中。生成AIの自己申告は「高」6件のみ・「低」28件中26件が実は正解 |
| 写真の情報量（score 5段階） | 空だけ0.1、空き地0.2、接写3.8。感覚どおり |
| 似ている種3〜4から選ぶ（Hydrogen が作った見分けカード＋特徴の noul） | 正解が分かる9件で1位9/9。生成AIの誤り（ハシボソ→正しくはハシブト）を直した |
| AIの文章の裏取り（主張ごと noul） | 1件では5/5だが、45件では嘘26件中、閾値0.3で11件しか弾けず正しい文17件を誤って弾く。**自動削除には使えない** |
| 小さく隠れた生き物 | 毎回見落とす。タイル探索の検証役に使うと品質低下（96.4） |
| 鳥の声（音声） | カッコウをウグイスと誤答（1件） |
| 2案の文章比較の採点役 | はっきりした差は LLM 採点と79/90一致、僅差は56/90。ふるい分け専用 |

## 試して不合格だったこと
- 生成AIに事実だけ出させ日本語を型で組み立てる → 0/12、文が硬い。
- 判定モデルが科を当て、文章は安い gemma-4 に書かせる → 8/12・7/12（脇役の植物や環境の読みが落ちる）。全体時間も変わらず。
- 結論: 文章役は 3.1 Flash-Lite のまま。判定モデルの価値は費用削減ではなく、確信度・情報量・似ている種・科名の即時表示（品質と体感速度）。

## ZUKAN での使い方（2026-11-23 時点）
- 本番: 種レベルの主対象の再確認に noul 1問（PR yamaki0102/ikimon-platform#2028）。
- 実装中: 1投稿2回（①写真だけで種類・仲間・科・情報量 ②名前ごとの確信度＋似ている種の選択と特徴）。コード `platform_v2/cloudflare_shadow/src/observationCardMeasure.ts`。
- 方針: 同定は属・科で十分、種の誤りは許容（オーナー 2026-11-23）。モデル評価は安い初期試験→通れば本試験、各モデルにその流儀の指示文を複数試す。
- ベンチ: `platform_v2/src/scripts/observationFeedbackBench.ts`（ブランチ noah/obs-feedback-bench、手元のみ）。科の一覧は `tools/obs-feedback-bench/keytable.json`。
