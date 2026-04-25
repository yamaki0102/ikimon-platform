# Claude への引き継ぎメッセージ

> このファイルの内容をそのまま Claude Code に貼り付けて会話を始めてください。
> このメッセージ単体で完結するように書いてあるので、別ファイルが見つからなくても作業を開始できます。

---

こんにちは。`ikimon.life` の観察会機能を、既存コードを活かしながら完成まで実装してほしい。

## 前提

- プロジェクト: `ikimon.life`
- ワークスペース: `C:\Users\YAMAKI\Documents\Playground`
- 技術スタック: PHP 8.2 / Alpine.js / Tailwind CDN / Lucide / JSONベースDataStore
- 重要ルール:
  - 既存イベント機能を壊さずに拡張する
  - デプロイはしない
  - `upload_package/data/` は手編集しない
  - secrets/config本体は触らない

## 今回の主目的

- 観察会機能を `無料利用 + Public有料1本` の設計で完成させる
- 参加体験は無料のまま強くする
- 団体向けの提出品質アウトプットだけを `Public` に寄せる
- 既存イベント基盤を、観察会主催者が使いやすい形に仕上げる

## 料金設計の固定方針

- 参加者向けの有料プランは作らない
- 観察会への参加自体に課金壁を置かない
- 公開商品は `Public` だけ
- 無料でできること:
  - 観察会作成
  - 募集公開
  - 参加申込
  - ゲスト参加
  - 観察投稿
  - イベント結果の簡易表示
  - KPI表示
- `Public` だけでできること:
  - 正式イベントレポートPDF
  - 種リスト CSV / XLSX / PDF
  - 公開版 / 内部版の出し分け
  - 希少種配慮付きエクスポート
  - 団体提出向けの整形済み成果物

## 重要な市場判断

日本と海外の観察会実例を踏まえたプロダクト判断はこれ。

- 観察会の基本参加は無料または低額が主流
- 単なる参加体験での課金は伸びにくい
- 団体がそのまま提出・共有・保存できるレポートや種リストには有料価値がある
- よって `ikimon.life` では「参加体験は無料」「提出品質アウトプットだけ有料」にする

## 最重要のバグ/設計問題

現状、`upload_package/libs/CorporateManager.php` の `corporationHasFeature()` が corporation `null` のとき `true` を返している。

これにより、団体に紐づかないイベントが実質フル機能扱いになり、料金境界が壊れている。

最優先でこれを直してほしい。

### 必須要件

- corporation 未解決イベントはデフォルトで無料扱い
- `Public` entitlement を持つ主催者またはワークスペースに紐づくイベントだけが、高度出力を使える
- 既存の `community` / `public` という内部planコードは当面そのままでよい
- ただし UI 上の文言は `Community` ではなく `無料` と `Public` に寄せる

## 既存コードで再利用すべき主要ファイル

- `upload_package/libs/EventManager.php`
- `upload_package/libs/CorporatePlanGate.php`
- `upload_package/libs/CorporateManager.php`
- `upload_package/public_html/create_event.php`
- `upload_package/public_html/edit_event.php`
- `upload_package/public_html/events.php`
- `upload_package/public_html/event_detail.php`
- `upload_package/public_html/event_dashboard.php`
- `upload_package/public_html/api/save_event.php`
- `upload_package/public_html/api/get_events.php`
- `upload_package/public_html/api/join_event.php`
- `upload_package/public_html/api/get_event_live.php`
- `upload_package/public_html/api/get_event_leaderboard.php`
- `upload_package/public_html/generate_grant_report.php`

## 現状で既にあるもの

- イベント作成/編集
- ゲスト参加
- イベントコードによる投稿ひも付け
- 空間・時間・サイトIDを使った観察自動収集
- ランキング
- ビンゴ
- 一部のレポート出力
- プランごとの表示制御

つまり、ゼロから作るのではなく既存基盤を観察会向けに磨き込んで完成させてほしい。

## 実装してほしいこと

1. プランゲートと entitlement 判定の整理
2. 観察会作成/編集項目の拡張
3. 無料でも成立する結果ページの整理
4. `Public` 向けの正式レポート出力
5. `Public` 向けの種リスト出力
   - CSV
   - XLSX
   - PDF
6. 無料/`Public` の違いが分かるUIコピーに整理

## 観察会作成で追加・整理したい項目

- タイトル
- サブコピー/概要
- 開催日
- 開始/終了時刻
- 開催地
- 集合場所
- 地図座標
- 半径またはサイトID
- 雨天ポリシー
- 雨天判断時刻
- 注意事項
- 定員
- 申込締切
- 対象年齢
- 難易度
- 歩行距離
- 持ち物
- 貸出機材
- 目標種
- イベント種別
  - 初心者向け
  - 親子向け
  - テーマ観察会
  - 夜間観察
  - BioBlitz
  - 学校/団体調査
- 公開範囲
  - 公開
  - 限定公開

## 無料側で成立させるべき体験

イベント終了後でも、無料主催者は以下を見せられるようにしてほしい。

- 参加人数
- 観察件数
- 発見種数
- ランキング
- 代表写真
- 主催者コメント
- 次回参加導線

ただし無料では、正式な種リストや提出用PDFは出せない状態にする。

## `Public` で出すべき成果物

### 1. 正式イベントレポートPDF

含めたい項目:

- イベント名
- 開催日時
- 開催地
- 主催者
- 概要
- 参加人数
- 観察件数
- 発見種数
- 注目種
- 代表写真
- 活動の意義
- 次回への示唆

### 2. 種リスト CSV / XLSX / PDF

最低限の列:

- 和名
- 学名
- taxon key または内部識別子
- 観察件数
- 初観察時刻
- 最終観察時刻
- 代表写真有無
- 希少種フラグ
- 公開可否フラグ

### 3. 公開版 / 内部版の出し分け

- 公開版:
  - 希少種位置をマスク
  - 一般共有向け
- 内部版:
  - 主催者権限のみ
  - より詳細な種・位置・運営向け集計を含める

## 実装方針

- 既存のイベント機能を置き換えず、拡張で対応
- `generate_grant_report.php` は削除せず、観察会レポートへ転用または互換ラッパー化
- 有料価値の中心は `正式レポート` と `種リストダウンロード`
- 画面で見るだけの簡易結果は無料に残す
- 希少種の位置情報配慮は既存ルールを崩さない
- 内部planコードの大規模改名はしない

## ファイル追加候補

必要なら次を新規作成してよい。

- `upload_package/public_html/generate_event_report.php`
- `upload_package/public_html/api/export_event_species_csv.php`
- `upload_package/public_html/api/export_event_species_xlsx.php`
- `upload_package/public_html/api/export_event_species_pdf.php`
- `upload_package/public_html/components/event_plan_gate.php`

## 完了条件

### 無料主催者

- 観察会を作成できる
- 参加者を集められる
- 終了後に簡易結果ページを共有できる
- 正式レポートと種リスト出力はできない

### `Public` 主催者

- 上記に加えて
- 正式レポートPDFを出力できる
- 種リストCSV/XLSX/PDFを出力できる
- 公開版/内部版の差がある

## 必須確認

- `php tools/lint.php`
- 関連PHPファイルの `php -l`
- 無料イベントで export が拒否されること
- `Public` イベントで export が通ること
- 既存イベント詳細/ランキング/参加導線が壊れていないこと

## 最後に報告してほしいこと

- 変更ファイル一覧
- 料金境界をどう実装したか
- 無料と `Public` の見え方がどう変わったか
- 実行した検証
- 未解決リスク

もしこのメッセージ内で不足があれば、まずローカルコードを読んで補完し、その上で最小の仮定で進めてください。別ドキュメントが見つからないことを理由に停止しないでください。
