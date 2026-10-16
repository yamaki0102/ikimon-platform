# ADR-0003: 写真保存後の補足と、確認した内容だけの共有

- Decision date: 2026-10-17 JST
- Status: Proposed for source adoption; deployment and live verification are separate evidence.
- Supersedes: ADR-0001/0002の保存時年齢確認と、訂正後も旧環境共有を閲覧可能にする範囲。

## 理由

写真だけで保存できても、あとから日時・位置・メモを直せなければ、最初の入力を省略する安心感がない。日時の強制共有と保存時の未成年checkboxは、必要な情報だけを共有する意図とも一致しない。

受信箱は元Recordの日時・位置・メモを参照するため、単に編集画面を足すと、訂正した内容を以前の同意で開示してしまう。環境のsnapshotも、本人が誤りを訂正した後は再確認できる必要がある。

## 決定

既存Recordの`details`操作を使い、Mediaや保存処理を複製しない。`capture_details_json`のoptionalなserver-owned edit版、要求key/digest、書込tokenでCASと再試行を管理する。capture APIはこのserver-owned部分を受け入れない。

日時が既知なら既存のprivate observationを使用し、不明なら同じfinalized draftを使用する。切替時には既存assetの参照を同じD1 transactionで更新する。撮影時刻へ受信時刻を代入しない。保存期限と容量は変更しない。

訂正で値または出所が変わった開示項目を特定し、その項目を含むshareだけを同じtransactionで撤回する。環境の手修正は環境選択済みshareだけを撤回する。撤回後も同じ要求keyのretryは撤回状態を返し、自動再提供しない。提供には現在見ているRecord版・選択した環境版・成人本人または保護者の確認が必要となる。

UIは写真のすぐ下に保存を置き、補足は任意の閉じた欄へまとめる。共有では日時も既定選択せず、1項目から提供できる。写真処理のCloudflareへの送信は保存後の本人操作で説明する。既存イラストとtokensを再利用する。

## 互換性と確認

新しいDBやmigrationはない。JSON versionは1のまま、既存readerが読めるoptional情報を追加する。ただし旧Workerへの無条件rollbackはしない。新しい記録の不明日時読取・削除と、訂正時撤回・guardian・確認版の境界を守れる版だけを候補にする。

既存SQLite/R2代替テストに、未知日時との切替、原EXIF/GPSの削除、CAS競合、応答消失、選択対象だけの撤回、古い同意で新値を開示しない否定試験を加える。実写真・provider推論・ステージング・本番の確認は、それぞれ管理正本のrelease evidenceへ記録する。テストtransportの成功を実モデルや配信成功として扱わない。
