# 参照資料同定コマンド データモデル

作成日: 2026-06-01

## 目的

資料ライブラリを「持っている資料一覧」ではなく、「この資料で、この分類群を、どの粒度まで確認できるか」を返す運用データにする。

ユーザー体験上は押しつけず、同定ワークベンチで `この資料で確認` として出す。内部的には、所有証跡と資料スコープが揃った時だけ同定コマンドとして扱う。

## 問題分解

- 資料: 図鑑、論文、Web資料、ikimon内デジタル図鑑。
- 所有/利用証跡: ユーザーがその資料を使えることの証跡。表紙、ISBN、Web capture、ページ証跡など。
- 適用範囲: 資料が扱える分類群、ランク、表記揺れ。
- コマンド: 同定時に出せる操作。確認、比較、除外、読む候補。
- 品質境界: AI推定、本人申告、団体/レビュアー確認、ikimonデジタル図鑑を分ける。

## 正本テーブル

### `knowledge_sources`

資料そのものの canonical catalog。タイトル、出版社、URL、DOIなどの共通メタデータを持つ。

### `knowledge_source_reference_metadata`

図鑑/資料向けの追加メタデータ。ISBN、版、著者表記、catalog status を持つ。

### `user_reference_access_proofs`

ユーザーが資料を使える証跡。証跡画像は private で、公開URLや本文OCRを持たない。

### `reference_identification_scopes`

資料が同定時に使える分類群スコープ。

主要フィールド:

- `source_id`: 資料。
- `scope_taxon_name`, `scope_taxon_rank`, `scope_taxon_key`: 適用分類群。
- `command_kind`: `reference_check` / `support_identification` / `exclude_candidate` / `reading_suggestion`。
- `max_supported_rank`: この資料で支えられる最細ランク。
- `locator_policy`: ページ・図版番号が `optional` / `recommended` / `required`。
- `coverage_basis`: `ai_inferred` / `owner_statement` / `reviewer_curation` / `ikimon_digital_guide` など。
- `verification_status`: `active` / `needs_review` / `deprecated`。

### `reference_identification_scope_aliases`

分類群の表記揺れ、和名、シノニム、旧学名、誤字を scope に寄せる。

### `user_reference_identification_commands`

所有証跡と active scope を結合した read model。UI/API はここを見れば「このユーザーが今使える資料コマンド」を返せる。

## 既存テーブルとの関係

`knowledge_source_taxon_links` は候補検索・初期推定用として残す。新規登録時と migration backfill で `reference_identification_scopes` に昇格させる。

`identification_references` は、実際に同定ログへ選択された資料を残す。つまり:

1. `reference_identification_scopes` が「使える可能性」
2. `user_reference_identification_commands` が「この人が使えるコマンド」
3. `identification_references` が「実際に使った根拠」

## 運用ルール

- AI推定 scope は `reference_check` から始める。いきなり authority にはしない。
- ユーザー確認/団体確認済み scope は `support_identification` にできる。
- species など細かい rank を支える場合は、`locator_policy` を `recommended` 以上にする。
- 図鑑本文やページ全文は保存しない。ページ番号、図版番号、訂正メタデータ、独自メモだけを保存する。
- 重複資料は canonical source に統合し、duplicate source は新規候補から外す。
- Tier 3 / research grade は、同定ログ側の `identification_references` と既存 authority / rank policy を併用して判定する。

## UIコピー

標準表示は `この資料で確認`。

避ける言い方:

- `あなたなら同定できます`
- `社会貢献できます`
- `研究グレードにするには必須です`

使う言い方:

- `この資料で確認`
- `この資料で比較`
- `手元の資料で見られます`
- `ページ・図版番号`

## 次に育てる場所

ikimon内のデジタル図鑑は `coverage_basis = 'ikimon_digital_guide'` として同じ scope model に入れる。外部図鑑と同じ UI で扱い、将来は scope ごとに見分けメモ、誤同定パターン、必要写真、改訂履歴を持つ。
