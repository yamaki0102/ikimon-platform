# クビアカツヤカミキリ見守り — Target Profile v1

- Status: `DESIGN PROPOSED; CANONICAL DESIGN after merge; RUNTIME NOT IMPLIED`
- Updated: 2026-09-13 JST
- Common contract: [市民参加型バイオセキュリティ詳細設計](../citizen-biosecurity/SPEC.md)
- Parent: [ZUKAN Product Architecture](../zukan-product-architecture/SPEC.md)
- Design: [DESIGN.md](../../../DESIGN.md)
- Delivery: [PLAN.md](PLAN.md)
- National context: [国戦略への対応](NATIONAL_STRATEGY_ALIGNMENT_2026-09-13.md)

## 0. 専門入口と共通原本

クビアカは既存Biodiversity Domain Packの最初の市民参加型biosecurity profile。別アプリ・専用DB・別認証ではない。Record / Media / Evidence / Place / Entity / Claim / Review / Rights / Program / Case / Publicationは共通責務を利用する。

Canonical public entry: `/kubiaka`
Profile ID: `kubiaka-watch`
Legacy `experience_key=kubiaka-watch`は同じprofileへの互換locatorとして保持し、旧記録を複製・再採番しない。
Subject scope: `Aromia bungii`。別名はauthority/source versionに紐付け、学名の一致だけで投稿を確定同定しない。

> 写真は先に保存する。確認は証拠の範囲で返す。行政への連絡は別に扱う。

## 1. 専用ページ

| Route | 対象 | 責務 |
|---|---|---|
| `/kubiaka` | public | 専門ガイドと撮影入口 |
| `/kubiaka/guide` | public | 成虫・痕跡・類似例・撮り方・安全 |
| `/kubiaka/about` | public | 運営者、確認能力、AI、privacy、データ利用 |
| `/kubiaka/faq` | public | 保存、結果、行政連絡、共有端末、削除 |
| `/kubiaka/record` | scoped guest/account | 共通Capture Loopにprofile文脈を付けて保存 |
| `/kubiaka/receipt/:receiptId` | scoped guest/owner | 保存結果・写真単位の確認範囲・次の操作 |
| `/kubiaka/me` | account | 未読結果・追加写真・本人記録・再訪 |
| `/kubiaka/me/records` | account | 本人のprofile付きRecord一覧 |
| `/kubiaka/records/:recordId` | owner | 同じRecordの専門private表示 |
| `/kubiaka/places/:placeId` | authorized owner | 権限内の同じ場所の履歴。全他者記録を混ぜない |
| `/ops/kubiaka/inbox` | scoped reviewer | 既存Review機能のprofile絞込み |
| `/ops/kubiaka/records/:recordId` | scoped reviewer | Evidence確認とfeedback。送信とは別操作 |

Route表は実装済み一覧ではない。接続前のリンク、空の将来ページ、仮の地図を公開しない。public `/kubiaka/area`とoperator coverageは初期対象外。APIは共通commandへadapterで接続し、routeごとの別writerを作らない。

専用headerはZUKANロゴ、クビアカ見守り、ヘルプ、アカウント、ZUKANへ戻る。投稿taskではglobal撮影launcherの二重表示を避ける。言語・アクセシビリティ・privacy操作は残す。

## 2. 文言

H1: `クビアカツヤカミキリを見つけたかも？`

Lead: `気になる虫や、サクラ・ウメなどの木の異変を、写真と場所で残せます。名前が分からなくても大丈夫です。`

Primary CTA: `写真を送る`
Secondary: `見分け方を見る`
Support: `自治体への連絡先を見る`

保存前: `まず非公開で保存します。自治体へ自動送信されることはありません。`
保存確認: `この内容で保存する`
保存後: `写真を保存しました。これは自治体への通報ではありません。`

Guest所有/再開/claimの実証前に「ログイン不要」と表示しない。AI未提供・専門家未提供・確認受付停止を「確認中」にしない。

安全の既定文: `安全な場所から撮影してください。私有地や車道には入らず、生きた虫や被害の疑いのある木を移動させないでください。対応方法は地域の公式案内を確認してください。`

地域機関の現行案内を併記する場合は対象地域・出典・日付を付ける。ZUKANが一律の捕殺・伐採・薬剤施工を指示しない。地域の案内と矛盾する独自の対処文を生成しない。

## 3. 撮影文脈

| 選択 | 推奨する写真 | 判断を留保すること |
|---|---|---|
| 気になる虫 | 安全に撮れる全体、特徴部、周辺 | 赤い部分や黒色だけで種を断定しない |
| 木くず・痕跡 | 痕跡、根元/幹、木全体 | フラスらしいことと原因種を分ける |
| 木の異変 | 木全体、異変部、幹/根元 | 倒木安全・病因・処置方法を確定しない |
| 分からない | 今ある写真 | 撮り直しや種名入力を保存の条件にしない |

Evidence roles: `surroundings / whole_tree / branches / trunk / base / adult_insect / adult_detail / frass / exit_hole / damage_sign / other_context`。

Signal vocabulary: `adult_insect / frass / exit_hole / tree_damage / unknown`。AIのSignal所見も候補であり、投稿者の選択と独立させる。

写真1〜6枚は最初の写真モードの上限。各写真の保存済み/未送信/確認済み/未確認を区別する。寸法・薬剤名・所有地情報を市民の初回必須項目にしない。

成虫、痕跡、類似種、生態、寄主、季節、分布、対処、参考資料はガイドの編集項目。初回画面へ百科事典全体を並べない。画像は由来・権利・credit・加工履歴を保持し、公式Webにあるだけで自由利用と扱わない。

## 4. Private receiptと再訪

共通設計のguest credential、session isolation、receipt単位claim、no-store、CSRF、認可を必須とする。receipt IDだけで写真を読めない。

receipt HTML/metadata/OGPへ正確な座標、住所全文、本人識別、内部宛先、reviewer-only noteを出さない。本人が通報用情報を確認する保護されたpreviewのみ、必要な位置/連絡先を明示して扱う。媒体配信はownerまたは用途を許可された担当者へのprivate認可を通す。

同じ木を再訪する場合、Placeだけでは同一の木と確定しない。確認済みsubject、管理タグ、本人選択を使う。処置後の写真は新Recordとして追加し、旧写真・同定履歴を保持する。

季節・年次の再訪はprofileと地域policyに沿う任意の課題。自動追跡・連続GPS収集・捕獲ランキング・streakを標準にしない。

## 5. 確認とfeedback

クビアカで維持する必須条件:

- submitted/assessed/unassessedは媒体IDで管理し、所見はassessedだけを参照する。
- 一部しか確認していない場合、全記録について「手掛かりなし」としない。
- AIは候補。Review authorityとClaimの支持/不足/異議を分ける。
- 写真に写らないことを「この木にいない」「安全」「根絶」にしない。
- 追加写真を受け取っても旧feedbackが新写真まで確認したことにしない。
- feedbackはappend-only edition。前回との差・未確認範囲・次の撮影案内を返す。
- 専門家Reviewと外部送信を一つのボタンで実行しない。

Usabilityは`isPhotoRecord / isScreenable / isRepeatComparable`の独立した評価。写真枚数でformal survey usableを推定しない。

## 6. 通報と地域policy

初期は通報用情報の整理と公式窓口へのhandoff。自動送信、行政との契約、受付APIは提供済みと表示しない。AI/専門家確認終了を公式窓口案内の前提にしない。

日本の4地域区分は国制度の原文code/label/source/dateとして保持する。実際の自治体区分が未公表・未取得なら`unknown`。海外や別の種へ日本の区分を強制しない。

農地、公園、民有地等で連絡窓口が分かれる可能性をregional policyの適用条件で扱う。所在地だけで土地所有者を推定しない。行政境界付近・位置精度不足・資料矛盾時は候補と確認事項を示す。

浜松等の実在パートナー・専用受付・専門家体制は、この設計では確定扱いにしない。公式な一般案内が見つかっても、専用通報受理契約が成立したことにはならない。

## 7. データ再利用

同じ写真・日時・場所を、本人記録、樹木の年次変化、学校の活動、他の対象種の確認、地域図鑑で参照できる。ただし原記録の目的別権利を継承する。旧no-export/no-aggregation/no-routingを移行で解除しない。

対象外の虫と判明した場合も原Recordを維持する。訂正Claimを加え、クビアカとしてのOccurrence出力・被害集計を止め、必要な外部訂正を追跡する。

## 8. SUPERSEDEDと維持事項

2026-07-29版の本SPECのうち、Kubiaka専用DB/receiptモデルを恒久化すること、Node/PostgreSQLを前提にしたRelease順、P0で通報準備情報も一律隠すことはSUPERSEDED。新しい実装順はPLAN.mdのみを使う。

private-first、通知interlock、guest/shared-device isolation、receipt単位claim、asset accounting、authority分離、非検出の限界、公開map後段化、明示的外部送信を維持する。旧仕様はGit履歴に残る。詳細な共通契約は../citizen-biosecurity/SPEC.mdを正とする。
