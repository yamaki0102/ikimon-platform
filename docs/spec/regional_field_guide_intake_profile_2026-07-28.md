# 地域フィールドガイド取込プロファイル v0

- 日付: 2026-07-28
- 対象例: `Inabe Green Map いなべの自然とあそぶ`
- 発行主体: いなべ市
- 状態: source registration implemented / extraction not yet materialized
- production・DB・外部公開変更: なし

## 1. 目的

自治体・地域団体等が発行する紙地図、PDF、冊子、フィールドガイドには、単なる観光地点一覧ではなく、場所、季節、自然体験、安全、参加方法、発行経緯、地域の知見が一つの編集物として集約されている。

ZUKANでは、これらを画像やPDFの置き場として保存するだけでなく、原資料と版を保ったまま、再利用可能な地域知識へ段階的に変換する。

## 2. 保存単位

### Source層

- `Publisher`: 発行主体、企画・編集主体、監修・協力主体
- `SourceWork`: 継続する編集物としての名称
- `SourceEdition`: 発行日、更新日、言語、版
- `SourceObject`: PDF、紙面撮影、画像等の取得物
- `SourceFragment`: ページ、地図番号、欄、写真、注意事項等の根拠範囲
- `ExtractionRun`: どの入力を、どの手順・model・versionで抽出したか
- `ContentObject`: OCR、thumbnail、translation等の派生物

原資料の文面、写真、イラスト、紙面レイアウトと、そこから確認できる事実候補を分離する。

### Knowledge層

- `Place`: 公園、学校、河川、散策路、山、キャンプ場等
- `Entity`: アプリ、プロジェクト、団体、施設、制度等
- `Claim`: 名称、所在地、季節、設備、利用条件、特徴等
- `Relation`: 場所同士、発行主体、活動、地域、河川等の関係
- `Program`: 自然観察、クエスト、モニタリング、親子活動等
- `SafetyClaim`: 立入、水辺、危険生物、服装、応急対応等
- `EvidenceLink`: 各ClaimがどのSourceFragmentに基づくか
- `Review`: 未確認、AI候補、人確認、発行主体確認等

## 3. この種の資料から抽出する情報

1. 発行情報
   - 発行主体
   - 発行日・更新日
   - 企画、編集、監修、協力、寄稿
   - 問い合わせ先
2. 地域・場所
   - 掲載地点
   - 地図上の番号
   - Place種別
   - 所在地、アクセス、駐車場、トイレ等
   - 河川、山地、行政区域との関係
3. 体験・季節
   - おすすめの季節
   - 散策、川遊び、キャンプ、観察等の体験
   - 対象者、所要時間、必要装備
4. 自然・生きもの
   - 掲載された生物・植物
   - 生息・観察に関する記述
   - 写真・イラストとtaxon候補
   - 地域の自然環境に関する説明
5. 安全・利用条件
   - 立入条件、予約、開館・利用時間
   - 水辺、天候、野生生物、危険植物等の注意
   - 持ち物、服装
   - 応急手当、緊急時の案内
6. 参加・更新導線
   - QRコード、公式ページ、アプリ
   - 市民参加型調査、クエスト、モニタリング
   - 現地で確認・更新できる不足情報
7. 編集知
   - コラム、地域住民・専門家の声
   - 地域の特徴や背景
   - 紙面で採用された分類・テーマ・表現

## 4. Rightsと公開境界

このプロファイルの既定値は次とする。

- 公開PDFであっても、本文、写真、イラスト、地図、レイアウトの再掲載権が確認できなければ`INDEX_ONLY`
- 発行物の存在、書誌情報、公式URL等の安全なmetadataは表示可能
- 事実候補はSourceFragmentへ紐付け、表現をそのまま転載せず、人の確認を経てClaim化する
- 画像・OCR・thumbnail・embeddingは別ContentObjectとして個別にrights評価する
- 権利が`unknown`の派生物をpublic publicationへ流さない
- QRコードのリンク先や利用条件は取得時点を記録し、現在も有効とは自動確定しない
- 希少種、未成年、学校、私有地、危険箇所は公開位置を粗くするか非公開とする

## 5. Inabe Green Mapの初期登録

Source Registryには次を登録する。

- publisher: `publisher:inabe-city`
- source: `source:inabe:green-map:2026`
- format: `pdf`
- rights: `INDEX_ONLY`
- state: `RIGHTS_CLASSIFIED`
- issued: `2026-03-01`
- geographic scope: `place:jp-mie-inabe`

この段階ではPDF本文や画像をrepositoryへ複製せず、公式Sourceと版metadataだけを登録する。

## 6. 次の実装段階

1. SourceObjectの取得、hash、fixity receipt
2. ページ・欄・地図番号単位のSourceFragment作成
3. OCR／vision抽出を`provisional`として保存
4. 掲載地点を既存Place候補へ照合し、曖昧なものは候補のまま残す
5. access、season、facility、activity、safety等のClaim候補を生成
6. 人が原資料と照合し、採用・訂正・保留を記録
7. rights-safeな地域View、散策マップ、Quest、更新候補へ投影
8. 新版が出た際にEdition差分を比較し、消えた情報を削除せず変更として残す

## 7. 完了条件

- 原資料と各Claimの根拠箇所を往復できる
- 同じPlaceへ他資料・市民Record・現地確認を重ねられる
- AI候補と人確認を区別できる
- 版差分と有効時点を保持できる
- 権利未確認の本文・写真・紙面を公開しない
- 資料にない位置、営業時間、利用条件を推測で補わない
- 将来、ZUKAN上のPlaceページ、散策体験、地域Publicationへ安全に再利用できる
