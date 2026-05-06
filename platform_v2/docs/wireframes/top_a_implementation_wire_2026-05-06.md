# Top A Implementation Wire 2026-05-06

目的: `senior_monitoring_youtube_like_2026-05-06.html` のトップA案を、実装に渡せる粒度へ分解する。

対象はトップページのみ。観察投稿一覧は別途 `Video Grid Style` を採用する。

## 1. 採用する画面構造

採用案: **YouTube Home + Local Map**

上からこの順に出す。

1. Header
2. Search
3. Primary Actions
4. Topic Tabs
5. Nearby Observations Shelf
6. Identification Shelf
7. Local Map Shelf
8. Learn Shelf

第1ビューで説明文を読ませない。トップの役割は「説明」ではなく「選択」。

## 2. Header

| 要素 | 内容 |
|---|---|
| ロゴマーク | 現行の ikimon.life ロゴマーク |
| 文字ロゴ | `https://ikimon.co.jp/assets/img/logo-white.png` |
| 背景 | 白い文字ロゴが見える濃い緑の台 |
| 右側 | マイページ/ログイン入口 |
| 禁止 | 長いタグライン、理念文、制度説明 |

実装メモ:

- ヘッダーは「現行ロゴマーク + 提供された ikimon 文字ロゴ」の組み合わせにする。
- ロゴマークは装飾扱いなら `alt=""`、文字ロゴ側の alt は `ikimon.life`。
- ロゴ台は高さ44px以上、角丸8px。

## 3. Search

目的: 迷った人が「場所/種名/近く」で探せる逃げ道。

| 状態 | 表示 |
|---|---|
| 通常 | `近くの生きものを検索` |
| フォーカス | 検索ページまたはインライン検索を開く |
| 入力対象 | 種名、場所、観察者、同定待ち |

モバイルでは高さ56px以上。検索が実装未完なら、`/observations` への検索パラメータ付きリンクとして始める。

## 4. Primary Actions

4つだけに絞る。

| 表示 | URL | KPI |
|---|---|---|
| 観察する | `/record` | `landing:topA:primary:record` |
| 同定する | `/explore?filter=needs_id` | `landing:topA:primary:identify` |
| 地図 | `/map` | `landing:topA:primary:map` |
| マイページ | `/profile` | `landing:topA:primary:me` |

設計:

- モバイルは2列。
- 各ボタンは高さ76px以上。
- アイコン + 短い動詞だけ。
- `再訪問` はここに置かない。

## 5. Topic Tabs

| 表示 | 意味 |
|---|---|
| おすすめ | 初期表示 |
| 近く | 位置/地域に寄せる |
| 同定待ち | 同定協力へ送る |
| 地域マップ | 地図棚へスクロールまたは `/map` |

横スクロールだけに依存しない。モバイルでは2列折り返し、または4項目以内に固定する。

## 6. Nearby Observations Shelf

カード情報は最小にする。

| 要素 | 表示 |
|---|---|
| 写真 | 16:9 または 4:3。写真なしは淡いプレースホルダー |
| 見出し | 種名、候補名、または `名前を確認中` |
| 補足 | 場所丸め + 日付 |
| ラベル | `確認中`, `AI候補`, `同定待ち`, `確認済み` |

内部状態をそのまま出さない。

- `review_ready` -> `確認しやすい記録`
- `monitoring_ready` -> `調査に使いやすい記録`
- `needs_more_evidence` -> `追加写真が必要`

## 7. Identification Shelf

目的: 熟練/年配モニターの同定力を活かす。ただし業務画面にしない。

| 表示 | 意味 |
|---|---|
| 同定待ち | 名前の確認が必要 |
| AI候補あり | たたき台がある |
| 追加写真が必要 | 正面/葉裏/腹面などが足りない |
| 専門家へ | 一般同定に向かない |

禁止:

- `確定` をAI候補に使う。
- 同定待ちと確認済みを同じ色にする。
- 1カードに根拠説明を長く書く。

## 8. Local Map Shelf

目的: 案Cの良さをA案に取り込む。

再訪問を直接促しても行動されにくいので、`再訪問してください` ではなく、地域の変化として見せる。

| 表示 | 例 |
|---|---|
| 近くで記録が増えた場所 | `今週 18件` |
| 前にも記録がある場所 | `同じ水辺で春の記録あり` |
| 季節差分 | `去年の同じ時期と比べる` |
| 公開粒度 | `公開位置は丸め済み` |

トップでは操作地図を重くしない。詳細操作は `/map` へ送る。

## 9. Learn Shelf

読み物はトップに広げない。1棚だけ。

候補:

- `はじめての記録`
- `安全な公開範囲`
- `名前が分からなくても大丈夫`

トップでは3カード以内。制度、BioMonWeek、Darwin Core、企業向け説明はサブページへ退避する。

## 10. Footer / Bottom Navigation

結論: **フッターのサイト内リンク構成は今まで通りでよい。**

理由:

- フッターはトップの第1ビューではないため、説明量が多少あっても主行動を邪魔しにくい。
- 既存の `使う / 読む / 広げる / 確認する` の分類は、説明系をサブページへ逃がす今回の方針と相性がよい。
- Footer directory は探索・信頼・規約・更新情報の受け皿として残すべき。

ただし、スマホ下部の固定導線はフッターとは別扱いにする。

| 対象 | 判断 |
|---|---|
| ページ最下部の global footer | 維持 |
| footer directory links | 維持 |
| footer 内の長いブランド説明 | 今回は維持可。ただし将来は短縮候補 |
| fixed bottom record launcher | トップAでは重複に注意。4大入口と競合するなら弱める |
| bottom nav を新設 | 今回は不要 |

トップAで大事なのは、上部の4大入口と下部固定UIが別のことを言い始めないこと。もし fixed bottom record launcher を残すなら、役割は `すぐ記録する` に限定し、地図/同定/マイページまで広げない。

## 11. 実装対象ファイル候補

現行構造から見た候補。

| 役割 | 候補 |
|---|---|
| トップUI | `platform_v2/src/ui/landingTop.ts` |
| 共通シェル/検索 | `platform_v2/src/ui/siteShell.ts` |
| 観察カード | `platform_v2/src/ui/observationCard.ts` or new helper |
| 地図要約 | `platform_v2/src/ui/mapMini.ts` |
| ルート | `platform_v2/src/routes/read.ts` |
| KPI | 既存 `data-kpi-action` パターンに合わせる |

## 12. 完了条件

- 第1ビューに4大入口が出る。
- トップの説明文が1文以下。
- 地域マップ棚がある。
- `再訪問` が主CTAではない。
- 観察カードの文字量が見出し、補足、状態ラベルに収まる。
- 既存フッターは維持し、トップAの4大入口と下部固定導線が競合しない。
- モバイル主要タップ領域が56px以上。
- `npm --prefix platform_v2 run typecheck` が通る。
