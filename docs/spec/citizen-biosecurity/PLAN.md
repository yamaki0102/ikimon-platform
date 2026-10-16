# Citizen Biosecurity: native self-service implementation plan

`SPEC.md` の匿名保存・自治体メール認証・明示的共有を、現行 Cloudflare writer 上で提供する最初の範囲。実際のPR、適用済みmigration、公開状態、blockerは管理正本のrelease evidenceを参照する。この文書は公開完了の証拠ではない。

## 1. 実装と既存資産の対応

| 責務 | 実装・正本 |
|---|---|
| 保存・再表示・共有・撤回・削除 | `platform_v2/cloudflare_shadow/src/biosecurity.ts` |
| 写真を持つ原記録 | 既存 `draft_observations`、`observations`、`asset_ledger` と同じ private R2 bucket |
| guest credential | event guest と共有する `guestCredentialNative.ts`。用途別 cookie と digest で分離 |
| 担当者の認証 | 既存 `auth_sessions`。専用 cookie と限定 `MunicipalInbox` role。通常会員 session への昇格を拒否 |
| 自治体コード・公式サイト | `src/services/municipalityDirectory.ts` と出典URL付き静的台帳 |
| 追加メールドメインの公開根拠 | `municipalDomainEvidence.ts`。公式サイト上の完全一致 mailbox のみ |
| Target Profile | `src/services/biosecurityProfiles.ts`。version付き静的設定。第2対象はfixtureで検証 |
| 画面 | `src/ui/biosecurity.ts`。既存のデザイントークンと写真準備処理を使用 |
| 写真内の撮影情報 | `src/services/biosecurityPhotoMetadata.ts`。端末内の厳密な日時/GPS抽出 |
| 不明・現地時刻の保存 | `cloudflare_shadow/src/biosecurityCaptureContext.ts`。時差・精度・出所を保持 |
| 任意の環境候補 | `cloudflare_shadow/src/biosecurityPhotoHints.ts`。既存AI bindingのCLEF-flash、固定5項目 |
| 受入・実装ナビゲーション | `platform_v2/product-registry/`。runtime statusの代替にしない |

市区町村別・種別のWorker、DB、カメラ、認証、AI、専用daemonは追加しない。新規cronも追加せず、既存の期限処理から小さいbatchで削除を再開する。共有は既存Recordとassetへの参照であり、写真・位置・観察日時を複製しない。

## 2. 最初の利用範囲

- `/ja/biosecurity`：公開ガイド。プロフィール別 `/ja/biosecurity/:profileId` と撮影入口へ接続する。
- `/ja/biosecurity/:profileId/capture`：ログイン不要。写真1〜6枚だけで非公開保存できる。写真から読めた日時・位置は出所付きで示し、地域・目印・メモと修正は任意にする。
- `/ja/biosecurity/records` と詳細：同じ端末の有効なcredentialで本人分だけを読む。IDだけでは閲覧できない。保護された写真の一覧、保存後の任意情報の補足・訂正・削除、共有先・項目の選択、撤回、写真と記録の削除を提供する。
- 記録詳細の任意操作で、最初の写真から環境候補を求め、訂正・不採用にできる。保存時・画面表示時には実行しない。環境の共有は未選択で始まり、同意時の版を保存する。
- `/ja/biosecurity/municipalities`：自治体を選択し、公式メール宛の一回限りのコードを元のブラウザーで入力する。IKIMONの人的審査は経路に含めない。
- `/ja/biosecurity/inbox`：認証済み自治体を宛先とする、期限内・未撤回の共有だけを受信する。写真・位置・メモは選択された項目だけ。確認済み操作は種の同定、自治体の正式受付、処置完了を意味しない。

都道府県と市区町村を選択できる。政令指定都市の行政区は独立した受信主体とせず所属市へ、東京特別区は各区へ対応する。同名自治体は都道府県とコードで区別する。

公式サイトのドメインを無条件にメール権限へ変換しない。制限された自治体名前空間または公式に掲載されたmailboxを使い、任意の親・兄弟・子ドメインへ権限を広げない。台帳外候補は既知の公式サイトだけを最大4ページ・各200KiB・合計8秒で照合する。申請者のURL、共有メール、委託会社や別自治体のドメインは根拠にしない。掲載根拠が不足する場合は権限を付けず、公式案内へ戻す。

専門家確認、AI同定、機関の公式通報API、学校・施設管理者の新しい管理機能、他端末へのguest復元はこの範囲で提供済みと表示しない。学校等は既存のProgramを利用できるが、Program参加からこのprivate記録の権限は継承しない。

## 3. 保存・同意・認証の不変条件

1. 同じactor・要求key・payloadは同じRecordを返す。異なるpayloadは409。D1の容量予約と関連行を一つのbatchで確保し、R2の保存確認後だけ保存済みにする。
2. JPEG/PNG/WebP以外を保存しない。クライアントで再エンコードし、サーバーでも付加情報を除去する。R2への書込みにはSHA-256 checksumを渡し、実サイズを照合する。圧縮画像を未加工の原画像と称さない。
3. 選択媒体の一部が失敗した場合は成功を表示せず、同じ要求で再試行できる。全枚数の実保存確認が揃うまでRecordを確定しない。未送信の写真を画面を閉じた後も自動送信すると約束しない。
4. 提供には宛先、目的、1項目以上の選択と同意が必要。日時を含め既定選択はない。毎回成人本人の確認または保護者の確認を求め、既知の未成年記録では保護者確認だけを受け入れる。共有時に未成年として確認した記録も、以後その状態を保持する。activeな共有と撤回履歴の全件を本人のreceiptに残し、古い共有をUIから隠す無制限追加を許さない。
5. 閲覧権は各要求で再確認する。R2取得や情報projectionの途中で共有撤回・認証失効・記録期限が生じた場合も応答前に拒否する。
6. 確認コードは8桁、10分、最大5試行、ブラウザーに束縛し、一回だけ消費する。mailbox所有者と自治体を代表する権限は別物。既存の会員accountへメール一致だけで結合しない。
7. mail送信結果が不明なら自動再送しない。送信試行は上限へ計上し、届いていれば同じコードを入力できる。受信箱への登録をメール配信・正式受付と混同しない。
8. 削除はまず閲覧と共有を止め、leaseを持つ一つの処理だけが媒体を削除し容量を返す。不明な結果を成功扱いせず、後続の期限処理から再開する。相手が既に取得した外部コピーの回収を保証しない。
9. 保存後の任意情報は既存`capture_details_json`のserver-owned版でCAS更新する。同じ要求の再試行は重複更新せず、古い画面は409。変更した情報を含む共有の撤回とsource更新を同じD1 batchで行う。共有のINSERTも本人が見たsource版へ束縛する。環境情報の手修正も、その項目を含む共有だけを撤回する。

## 4. 初期の保管・費用上限

記録と写真は保存から90日で閲覧を終了し、その後非公開のまま順次削除する。通信障害中も期限後の閲覧は再開しない。guest credentialは新しい保存で90日更新し、個々の記録の期限は同じ要求の再試行では延長しない。cookie消去や「この端末の利用を終了する」で再開権限を失う。

新規保存の初期上限は共通256MiB、1枚4MiB、1要求18MiB、6枚。日次100記録、guestあたり10記録、IPあたり20記録をD1の原子的予約で制限する。各Recordの共有は撤回済みも含め20件。画像寸法もサーバーで制限する。容量上限では新規保存を止め、保存済み記録の閲覧・撤回・削除と公開ガイドは維持する。

認証メールの初期上限は共通50通/日・1,000通/月、同じメール5通/日・1分間隔、IPあたり10通/日。公式ドメインの追加照合は共通100件/日・IPあたり10件/日、肯定7日・否定15分のcacheを用いる。失効指定はcacheや台帳の版・期限にかかわらず優先する。

既存の `ALERT_EMAIL` と認可済み送信元を使い、alert dispatcherの宛先制限を変更しない。無料枠はアカウントで共有されるため、これらの上限だけで追加課金0円を保証しない。新規メール契約・送信元・DNS・IAM・AI課金は前提にしない。

`BIOSECURITY_ENABLED=on`、有効な `BIOSECURITY_STORAGE_BUDGET_BYTES`、メール用 `BIOSECURITY_EMAIL_ENABLED=on` と既存bindingが揃う操作だけを有効にする。環境のmigrationと実容量・送信能力の確認をrelease evidenceに残す。

写真補助は `BIOSECURITY_PHOTO_HINTS_ENABLED=on` と `BIOSECURITY_PHOTO_HINT_DAILY_TOKENS=60000` の範囲で、保存後の本人操作に限る。1記録1回・写真1枚・固定5項目・8秒以内。1回につき8,000入力tokenを先に予約するので、初期の共通上限は7回/日、guest3回/日、IP5回/日。未確定の呼出しも予約を戻さず、自動再送しない。無料枠の残りはアカウント全体に依存し、追加費用0円の保証にはしない。停止や上限時も写真保存・閲覧・撤回・削除は継続する。

## 5. Migrationとrelease順序

初期版のmigrationはOBSの `0076_biosecurity_selfservice.sql` とCOREの `0021_municipal_mailbox_access.sql`。写真中心の追加版では、適用済み0076に対してOBSの `0077_biosecurity_photo_context.sql` だけを追加する。既存private記録の移送、共有テーブルの再構築、公開範囲変更、権限一括付与を含めない。

保存後編集と確認済み共有の追加はmigration不要。既存JSONへのoptionalなserver-owned edit版だけを加える。旧版が新しい共有確認契約を満たすとは限らないため、自動rollbackの可否は保存形式だけでなくguardian・版照合・訂正時撤回も確認する。新しいsecret、IAM、DNS、予算拡大や新規モデルの有効化を含めない。

1. productのimmutable source SHA/treeに対するtypecheck、共通writer・認証・UIの重点試験を通す。
2. 管理正本の登録済みD1 runnerへ対象SQLのdigest、DB identity、必要な前提、schema probeを束縛したlaneを通常PRで登録する。無関係なpending migrationをapply-allしない。
3. stagingで両laneのplan/migrate/readbackを行い、同じsourceに束縛した実証跡を保存する。
4. 登録済みrelease runnerでstagingを公開し、runtime identityと実画面を確認する。ローカルfixture、実staging、実メール配信の証拠を混同しない。
5. 有効な本番権限とstaging証跡の範囲でproduction migrationと同じsourceのreleaseを行う。productionへsyntheticな記録・通報を作らない。
6. 本番でURL、権限境界、source/runtime identityをread-backする。実在自治体のmailbox所有確認と実投稿の利用検証が未観測なら、その点を残して報告する。

rollbackは登録済みの直前Worker版への復旧またはfeature停止。追加済みテーブルをdropして回復しない。private R2、保存期限、撤回状態を維持し、写真の削除失敗はleaseと残容量予約から前進回復する。

**0077以後に新しい形式の記録が保存された場合は、上記の旧Workerへの単純復旧を適用しない。** 日時不明の共通draftの読み取りと、新しいcontext項目の削除を維持する必要がある。写真補助の問題では補助flagだけを停止し、その他の不具合は互換性を保つ前進修正を使う。857cff6へ戻すだけでは新しい記録の読み取り・削除契約を満たさない。

## 6. 必須の否定試験

- guest A/B、自治体 A/B、cookie重複、CSRF、credential消失・失効、通常sessionへの限定role混入。
- 種未確定・GPS拒否・日付timezone・枚数/形式/容量不正・埋込みEXIF・複数JPEG scan間のmetadata・巨大pixel寸法。
- R2部分失敗、D1 commit後の応答消失、同時再送、予算競合、同じkeyでpayload変更、第2profileで同じRecord/assetを再利用。
- 同意なし、未選択の位置/写真/メモ、未成年の確認なし、共有回数上限、確認済みと撤回の競合、取得中の失効、削除と期限処理の競合。
- mailboxコードの期限・試行・再消費、送信結果不明、日/月上限、台帳外・別自治体・失効ドメイン、SSRF/redirect/HTML内の偽mailbox。
- 320px〜1440px、文字200%、keyboard/focus、画像準備失敗、通信再試行、storage不可、共用端末の終了・履歴復元時のprivate表示消去。
- EXIFなし・不正日・時差不明・日付だけ・範囲外GPS・複数写真の不一致、修正後の補完、読めない写真でも保存可能。
- CLEFの本人同意・別guest拒否・単一呼出し・予算0/同時競合・不正応答・遅い結果と本人訂正・取得中の削除・環境共有版の固定。
- 保存後の不明日時→既知日時→不明日時、原EXIFの明示削除、GPS/noteの保存値削除、同じRecord/Media/容量/期限の維持、訂正と旧同意・CAS競合・応答消失、訂正対象だけの共有撤回。

検証入口は `cloudflare_shadow/src/biosecurity.test.ts`、`biosecurityMedia.test.ts`、`municipalDomainEvidence.test.ts`、`src/services/municipalityDirectory.test.ts`、`src/ui/biosecurity.test.ts` と共通Product Registry / writer tests。
