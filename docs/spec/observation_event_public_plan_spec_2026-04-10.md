# ikimon.life 観察会機能 完成仕様書 / 要件書

最終更新: 2026-04-10
対象プロジェクト: `ikimon.life`
対象ワークスペース: `C:\Users\YAMAKI\Documents\Playground`

## 1. この仕様書の目的

この文書は、`ikimon.life` の既存イベント基盤を「観察会機能」として完成させるための実装正本である。

目的は3つだけ。

1. 参加体験は無料のまま強くする
2. 団体が使える提出品質アウトプットだけを `Public` 有料プランで提供する
3. Claude Code がこの文書だけで設計迷子にならず、実装・検証・仕上げまで進められる状態にする

この仕様では、プロダクト上の料金見せ方を以下に固定する。

- 無料利用: 観察会の作成、募集、参加、観察、簡易結果表示
- `Public` プラン: 公式レポート、種リスト出力、提出品質エクスポート、団体運営向け高機能

重要:

- 公開プランは `Public` の1本だけ
- 参加者向けプレミアム課金は作らない
- イベント参加そのものに課金壁は置かない
- 既存コード上の `community` / `public` という内部planコードは当面維持してよい
- ただしユーザー向けコピーでは `Community` を極力出さず、`無料` と `Public` に整理する

## 2. 背景と調査要約

### 2-1. 市場実態から見た結論

日本と海外の公式事例を見ると、観察会の基本参加は無料または低額が主流で、課金が成立するのは次のどちらかである。

- 専門家同行や研修など、高密度な体験
- 団体・行政・保全活動でそのまま使える完成済みレポートやデータ出力

`ikimon.life` は後者に寄せるのが最も自然である。

### 2-2. 参考にした公式ソース

以下は仕様判断の根拠として採用した公式ソース。詳細引用は避け、論点のみ整理する。

- [東京都公園協会 砧公園 野鳥観察会](https://www.tokyo-park.or.jp/park/kinuta/news/2026/park_info.html)
  - 50円、双眼鏡貸出、持ち物や参加条件の明記
- [東京都公園協会 桜ヶ丘公園 野鳥観察会](https://www.tokyo-park.or.jp/park/sakuragaoka/news/2025/park_info_28.html)
  - 50円、初心者向けの普及型観察会
- [東京都公園協会 葛西臨海公園 夜の昆虫観察会](https://www.tokyo-park.or.jp/park/kasairinkai/news/2024/3.html)
  - 予約不要、定員なし、参加無料
- [Olympic National Park BioBlitz](https://www.nps.gov/olym/learn/news/limited-reservations-still-available-for-bioblitz-at-olympic-national-park.htm)
  - 参加無料、事前予約、初心者歓迎、家族参加、科学者同行
- [The Nature Conservancy City Nature Challenge](https://www.nature.org/en-us/get-involved/how-to-help/events/city-nature-challenge/)
  - 市民科学イベントとして地域横断で集客
- [Australian Guide to Running a BioBlitz](https://www.ala.org.au/wp-content/uploads/2011/10/BIOBLITZ_Guidelines_WEB-final-201507.pdf)
  - イベント後の brief report、species count、スポンサー共有などが標準実務
- [eBird Trip Reports](https://support.ebird.org/en/support/solutions/articles/48001201565-ebird-trip-reports)
  - グループ観察結果を共有可能なライブ要約として無料提供
- [iNaturalist data export help](https://help.inaturalist.org/en/support/solutions/articles/151000170342-how-can-i-download-data-from-inaturalist-)
  - 基本的なデータダウンロードは無料基準として存在
- [環境省 いきものログ 種名調べ支援](https://www.env.go.jp/press/105750.html)
  - 初心者支援と無料投稿の整備
- [環境省 指標昆虫モニタリング手法 PDF](https://www.env.go.jp/content/000210287.pdf)
  - CSVダウンロードや報告項目の整理が前提
- [環境省 NACS-J自然観察指導員講習会](https://www.env.go.jp/policy/nacs-j.html)
  - 自然観察指導員制度そのものが国レベルで整備されており、観察会は一過性ではなく継続的な社会実装分野
- [BTO Data Reports](https://www.bto.org/data/tools-products/data-reports)
  - PDF + Excel の提出品質データレポートは明確な有料価値

### 2-3. この調査から確定するプロダクト原則

- 無料で参加できることは伸びる
- 画面で見るだけの種一覧は無料圏に入りやすい
- 団体の説明責任に耐える帳票やエクスポートは有料価値が高い
- `ikimon.life` は「イベント作成ツール」ではなく「観察会の結果を資産化するOS」を目指すべき

## 3. 現行実装の棚卸し

### 3-1. 既存で使える基盤

現行コードには観察会の土台がかなりある。ゼロから作り直す必要はない。

- `upload_package/public_html/events.php`
- `upload_package/public_html/create_event.php`
- `upload_package/public_html/edit_event.php`
- `upload_package/public_html/event_detail.php`
- `upload_package/public_html/event_dashboard.php`
- `upload_package/public_html/api/save_event.php`
- `upload_package/public_html/api/get_events.php`
- `upload_package/public_html/api/join_event.php`
- `upload_package/public_html/api/get_event_live.php`
- `upload_package/public_html/api/get_event_leaderboard.php`
- `upload_package/public_html/api/get_event_observations.php`
- `upload_package/public_html/generate_grant_report.php`
- `upload_package/public_html/api/generate_activity_report.php`
- `upload_package/libs/EventManager.php`
- `upload_package/libs/CorporatePlanGate.php`
- `upload_package/libs/CorporateManager.php`

既に入っている機能:

- イベント作成/編集
- ゲスト参加
- イベントコードによる投稿ひも付け
- 空間・時間・サイトIDを使った観察自動収集
- ランキング
- ビンゴ
- 一部のレポート出力
- コーポレートプランに応じた表示制御

### 3-2. 現状の問題点

#### 問題1: 料金思想がUIに出ていない

現状は `Community ワークスペースでは... Public プランで有効` という文言が点在しているが、観察会主催者が理解しやすい形に整理されていない。

#### 問題2: null corporation が実質フル機能扱い

`upload_package/libs/CorporateManager.php` の `corporationHasFeature()` は corporation が `null` のとき `true` を返す。
このため、団体に紐づかないイベントが実質フル機能扱いになり、`Public` 有料プランの差分が壊れる。

これは今回の最重要修正事項。

#### 問題3: 出力機能の命名が企業/助成金寄りで、観察会主催者の理解とズレる

`generate_grant_report.php` や `generate_activity_report.php` は土台として優秀だが、観察会主催者が求める「イベントレポート」「種リスト出力」という入口になっていない。

#### 問題4: 典型的な観察会募集項目が足りない

現行 `save_event.php` にある項目だけでは、日本の観察会募集ページとしては不足がある。

不足または整理不足の例:

- 対象年齢
- 難易度
- 歩行距離
- 定員
- 申込締切
- 貸出機材
- 持ち物
- 参加スタイル
- 申込方法
- 雨天時の判断時刻

#### 問題5: 無料/有料の境界が「種名そのもの」だけに寄りすぎている

無料でも「イベントの簡易結果」は見せるべきだが、今の設計は「種名を見せる/見せない」に強く寄っている。
有料の本質は「提出品質のアウトプット」であるべきで、画面上の簡易結果とダウンロード可能帳票は分けて設計する必要がある。

## 4. 今回の最終プロダクト定義

### 4-1. 何を完成とみなすか

観察会機能の完成条件は、以下4つが一気通貫で成立していること。

1. 主催者がスマホでも迷わず観察会を作れる
2. 参加者が登録の有無に関わらず参加して観察を記録できる
3. イベント終了後に、無料でも簡易結果ページが成立する
4. `Public` プランでは団体向けの正式レポートと種リストが出力できる

### 4-2. 誰のための機能か

主対象は以下。

- 地域の自然観察グループ
- 学校・博物館・動植物園
- 自治体の環境部門
- NPO / NGO / 保全団体
- 企業の自然保全活動担当
- 施設のイベント担当

参加者側の主対象:

- 初心者
- 親子
- 学校行事参加者
- 地域住民
- ゲスト参加者

## 5. 料金設計の固定方針

### 5-1. 商品設計

公開商品は次の1本のみ。

- `Public` プラン

無料側は「プラン」として強く売らなくてよい。単に無料利用として見せる。

### 5-2. 無料で提供するもの

- 観察会作成
- 観察会公開
- 申込・参加
- ゲスト参加
- イベントコード発行
- 当日の観察投稿連携
- 簡易ランキング
- 簡易結果ページ
- 画面上の概要KPI表示
  - 参加人数
  - 観察件数
  - 発見種数
- 主催者によるイベント編集

### 5-3. `Public` だけで提供するもの

- 正式イベントレポート PDF
- 種リスト CSV / XLSX / PDF
- 公開版 / 内部版の2系統出力
- 希少種配慮付きエクスポート
- 助成金・行政提出向け整形出力
- シリーズ横断レポート
- 団体ロゴ付き出力
- 詳細な種一覧のダウンロード
- 参加者属性や継続参加率を含む運営向け集計

### 5-4. 重要な線引き

- 無料: その場で参加して自然に触れ、振り返るための体験機能
- `Public`: 団体が活動成果を説明し、提出し、再利用するための運営機能

### 5-5. UI文言の原則

ユーザー向けコピーでは次を徹底する。

- `Community` という内部用語は原則見せない
- `無料ではここまで`
- `Public では正式レポートと種リストを出力`

NG例:

- `Community ワークスペースでは表示できません`

OK例:

- `無料利用では概要のみ表示します`
- `Public では正式な種リストとPDFレポートを出力できます`

## 6. 機能要件

以下は MECE に切った必須要件。

### FR-1. 観察会作成

主催者は以下を設定できること。

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

必須事項:

- 既存 `events` ストアを拡張して保持する
- 新規大型テーブルは作らない
- 入力値は文字数上限と正規化を入れる

### FR-2. 参加導線

参加者は以下のどれでも参加できること。

- イベント詳細ページから参加
- QRコードから参加
- イベントコードから参加

要件:

- ログイン済みユーザーはユーザーIDで参加
- 未ログインは既存ゲストUUID方式で参加
- 定員超過時は待機扱いにできること
- 主催者は参加者一覧を見られること

### FR-3. 当日観察連携

要件:

- 投稿画面とイベントコードが連携すること
- 空間・時間・サイトIDでも自動収集すること
- 手動リンクと自動リンクが重複しても二重計上しないこと
- イベント終了後も結果ページから観察一覧に遷移できること

### FR-4. 無料の結果ページ

無料利用でも、イベント終了後に以下が見えること。

- 参加人数
- 観察件数
- 発見種数
- ランキング
- 代表写真
- 主催者コメント
- 次回参加導線

原則:

- 無料でも「イベントが成立した」ことは十分伝わる
- ただし「正式な種リスト」「外部提出用レポート」は出さない

### FR-5. `Public` の成果物

`Public` では次の成果物を生成できること。

1. イベントレポート PDF
2. 種リスト CSV
3. 種リスト XLSX
4. 種リスト PDF
5. 内部版レポート
6. 公開版レポート

公開版レポートに必要な項目:

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

内部版レポートで追加される項目:

- 完全な種リスト
- 個体数または観察頻度
- 観察者別集計
- 参加者属性集計
- 非公開座標または精度の高い位置情報
- 希少種取り扱い注記

### FR-6. 種リスト要件

種リストには最低限以下を持たせる。

- 和名
- 学名
- taxon key または内部識別子
- 観察件数
- 初観察時刻
- 最終観察時刻
- イベント内の代表写真有無
- 希少種フラグ
- 公開可否フラグ

無料画面:

- 一覧ダウンロード不可
- 種の詳細列は概要に絞る

`Public`:

- CSV / XLSX / PDF でダウンロード可

### FR-7. 希少種・配慮情報

要件:

- 既存 `PrivacyFilter` / `RedListManager` の思想を崩さない
- 公開版では希少種座標をマスクする
- 内部版では権限のある主催者のみ詳細を見られる
- 出力物に「希少種配慮により一部位置情報を加工」注記を入れる

### FR-8. プランゲート

最重要。

次の判定に統一する。

- `Public` の entitlement を持つ主催者またはワークスペースに紐づくイベントのみ、高度出力が使える
- corporation が `null` のイベントはデフォルト無料扱い
- `corporationHasFeature(null)` をこの用途で真にしない

実装方針:

- 既存の内部planコード `community` / `public` は維持
- ただし entitlement 判定を event/organizer 起点で明確化する
- 互換性を壊さないため、既存サイト・法人ワークスペースは引き続き `public` で通す

### FR-9. 運営者向けアップセル導線

無料イベント詳細やレポートボタン周辺に、以下のような自然な導線を置く。

- `この観察会の正式レポートを出力する`
- `Public で種リストCSVをダウンロード`
- `助成金・行政報告に使えるPDFを作成`

アップセル導線は「機能制限の不満」を煽るより、「業務価値」を説明すること。

## 7. 非機能要件

### NFR-1. 既存アーキテクチャ尊重

- 既存 `DataStore` ベースを維持
- 既存 `EventManager` を中心に拡張
- 新規ライブラリは最小限
- 既存 `generate_grant_report.php` は完全削除ではなく、再利用または互換ラッパー化

### NFR-2. セキュリティ

- 出力系エンドポイントは権限チェック必須
- `Public` entitlement がない場合は明確に403またはUI抑止
- JSONレスポンスは `JSON_UNESCAPED_UNICODE | JSON_HEX_TAG`
- HTML出力は `htmlspecialchars`

### NFR-3. 速度

- イベント観察集計は月次パーティション優先
- 同じイベントの重い集計は将来的にキャッシュ可能な構造で書く
- ただし今回フェーズでは correctness を優先

### NFR-4. モバイル

- 主催者作成画面はモバイル優先
- 最低タップ領域56px
- 地図UIが重い場合は入力補助とのバランスを取る

## 8. データモデル要件

`events` レコードに以下フィールドを追加または標準化する。

```php
[
  'summary' => string,
  'description' => string,
  'event_category' => 'beginner'|'family'|'theme'|'night'|'bioblitz'|'school'|'survey',
  'capacity' => int|null,
  'waitlist_enabled' => bool,
  'registration_deadline' => 'c-format datetime'|null,
  'target_age_label' => string|null,
  'difficulty' => 'easy'|'normal'|'advanced'|null,
  'walking_distance_km' => float|null,
  'loan_items' => string[],
  'bring_items' => string[],
  'rain_decision_at' => 'c-format datetime'|null,
  'visibility' => 'public'|'unlisted',
  'result_note' => string|null,
  'report_visibility_mode' => 'summary_only'|'public_outputs',
  'participants_v2' => [
    [
      'user_id' => string,
      'user_name' => string,
      'avatar' => ?string,
      'role' => 'participant'|'waitlist',
      'joined_at' => string
    ]
  ]
]
```

方針:

- 旧 `participants` は互換のため維持しつつ、必要に応じて `participants_v2` に正規化
- 既存レコードは migration-on-read で吸収してよい

## 9. 実装要件: ファイル別

### 9-1. 必ず更新対象に入るファイル

- `upload_package/libs/CorporateManager.php`
- `upload_package/libs/CorporatePlanGate.php`
- `upload_package/libs/EventManager.php`
- `upload_package/public_html/create_event.php`
- `upload_package/public_html/edit_event.php`
- `upload_package/public_html/event_detail.php`
- `upload_package/public_html/events.php`
- `upload_package/public_html/event_dashboard.php`
- `upload_package/public_html/api/save_event.php`
- `upload_package/public_html/api/get_events.php`
- `upload_package/public_html/api/join_event.php`
- `upload_package/public_html/api/get_event_live.php`
- `upload_package/public_html/api/get_event_leaderboard.php`

### 9-2. 高確率で新規または整理が必要なファイル

- `upload_package/public_html/generate_event_report.php`
- `upload_package/public_html/api/export_event_species_csv.php`
- `upload_package/public_html/api/export_event_species_xlsx.php`
- `upload_package/public_html/api/export_event_species_pdf.php`
- `upload_package/public_html/components/event_plan_gate.php`

### 9-3. 既存との互換維持が必要なファイル

- `upload_package/public_html/generate_grant_report.php`
  - 旧URL互換のため、内部で新レポート実装を呼ぶラッパーにしてよい

## 10. UI要件

### 10-1. 作成画面

必須改善:

- 入力項目を「基本」「場所」「参加条件」「当日案内」「結果設定」に分ける
- デフォルト文言を観察会向けにする
- 主催者が何を入力すればよいか迷わない helper text を入れる

### 10-2. イベント詳細

無料主催者向け表示:

- `結果サマリーを見る`
- `正式な種リストとPDFレポートは Public で利用できます`

`Public` 主催者向け表示:

- `イベントレポートを出力`
- `種リストCSV`
- `種リストXLSX`
- `公開版PDF`
- `内部版PDF`

### 10-3. イベント一覧

一覧カードに以下を出す。

- 開催日時
- 場所
- 種別
- 参加しやすさ
- 定員残数または受付状況
- `初心者歓迎`
- `親子向け`
- `夜間`
- `BioBlitz`

### 10-4. 結果ページ

イベント終了後のページは、単なる詳細ページではなく「観察会の成果ページ」として見せる。

見せる内容:

- イベント概要
- KPI
- 当日のハイライト
- 代表写真
- ランキング
- 主催者コメント
- 次の観察会導線

## 11. API要件

### API-1. save_event

追加対応:

- 新フィールド保存
- 文字数/型バリデーション
- 互換マイグレーション

### API-2. join_event

追加対応:

- 定員管理
- 待機参加
- 申込締切判定

### API-3. get_event_live

追加対応:

- 無料では概要中心
- `Public` では詳細種情報を返せる
- `result_note` を返す

### API-4. get_event_leaderboard

追加対応:

- 無料では `top_species` を空にしてもよいが、イベント全体KPIは残す
- `Public` ではダウンロード導線を付けやすいメタ情報を返す

### API-5. new export APIs

追加:

- `GET /api/export_event_species_csv.php?event_id=...`
- `GET /api/export_event_species_xlsx.php?event_id=...`
- `GET /api/export_event_species_pdf.php?event_id=...`

共通要件:

- organizer/admin only
- entitlement check mandatory
- 希少種マスキング対応
- 監査ログが取れるなら取る

## 12. 受け入れ条件

以下をすべて満たしたら完成。

### AC-1. 無料イベント

- 法人ワークスペース未所属の主催者でも観察会を作成できる
- 参加者は参加できる
- 観察は集計される
- 終了後にKPIと簡易結果が見える
- ただしレポートPDFと種リストダウンロードはできない

### AC-2. `Public` イベント

- `public` entitlement を持つ主催者またはサイトのイベントでは、レポートと種リストが出る
- 公開版/内部版の差が動く
- 希少種配慮が効く

### AC-3. null corporation bug

- corporation が解決できないイベントで、advanced output が使えてしまう状態が解消されている

### AC-4. 互換性

- 既存イベント詳細、ランキング、ビンゴ、参加導線が壊れない
- 既存 `generate_grant_report.php` の入口を踏んでもエラーにならない

### AC-5. 文言

- ユーザー向け画面で `Community ワークスペース` のような分かりにくい表現が大幅に減る
- 無料 / `Public` の違いがひと目で分かる

## 13. テスト要件

最低限実施すること。

- `php tools/lint.php`
- 関連PHPファイル個別 `php -l`
- イベント作成から結果表示までの手動確認
- 無料主催者で export を叩いたときの拒否確認
- `Public` 主催者で export 成功確認
- ゲスト参加確認
- 既存イベントの表示崩れ確認

可能なら追加:

- プランゲート判定のユニットテスト
- イベント集計のFeatureテスト

## 14. 実装順

Claude は次の順で進めること。

1. プランゲートと entitlement 判定を修正
2. イベントスキーマ拡張と保存APIを修正
3. 作成/編集UIを観察会仕様へ更新
4. 結果ページを無料/`Public` で整理
5. 正式レポート/種リスト出力を追加
6. 文言整理
7. lint / 手動確認 / 回帰確認

## 15. 実装時の重要判断

### 判断A: 内部コードは無理に改名しない

今このタイミングで `community` を `free` に全面改名しない。
データ互換コストに対して価値が薄い。

代わりに:

- 内部planコードは維持
- UIコピーだけ `無料` にする
- entitlement 判定だけ厳密化する

### 判断B: 既存レポートを捨てずに転用する

`generate_grant_report.php` の集計ロジックは再利用価値が高い。
これを「観察会レポート」へ再パッケージする。

### 判断C: 有料価値はファイル出力に寄せる

単にイベント詳細ページで種名を見せる/見せないだけでは弱い。
価値の中心は「ダウンロードして提出できる成果物」とする。

## 16. Claude への実装指示

Claude Code には次を厳守させること。

- 既存イベント機能を壊さずに拡張する
- 料金体系は `無料利用 + Public有料1本` に固定する
- `corporationHasFeature(null) === true` に依存する既存挙動を是正する
- 新機能の中心は `正式レポート` と `種リスト出力`
- デザインより先に entitlement と出力整合性を固める
- 実装後は lint と手動確認を必ず実施する

## 17. 完成イメージ

完成後の体験はこうなる。

- 無料主催者:
  - 観察会を作る
  - 参加者が集まる
  - 当日の観察がまとまる
  - 終了後に簡易結果ページを共有できる

- `Public` 主催者:
  - 上記に加えて
  - 正式なイベント報告書をPDFで出せる
  - 種リストをCSV/XLSX/PDFで出せる
  - 希少種に配慮した提出用アウトプットが作れる

ここまで実現できれば、`ikimon.life` の観察会機能は「募集ページ」ではなく「自然観察活動の成果基盤」になる。
