# 市民参加型バイオセキュリティ — 詳細設計 v1

- Status: `DESIGN PROPOSED; CANONICAL DESIGN after merge; IMPLEMENTATION NOT IMPLIED`
- Decision date: 2026-09-13 JST
- Owner intent: 対象別には専門的に見せ、記録・証拠・場所・確認結果は他の種や地域活動にも再利用する。
- Parent: [ZUKAN Product Architecture](../zukan-product-architecture/SPEC.md)
- Foundation: [Foundation v2](../zukan_foundation_v2_implementation_contract_2026-07-28.md)
- Design: [DESIGN.md](../../../DESIGN.md)
- First profile: [クビアカ](../kubiaka-focused-experience/SPEC.md)
- Delivery: [実装計画](../kubiaka-focused-experience/PLAN.md)
- Evidence: [一次情報と採用範囲](../kubiaka-focused-experience/GLOBAL_CITIZEN_BIOSECURITY_RESEARCH_2026-09-13.md)
- Examples: [CONTRACT_EXAMPLES.json](CONTRACT_EXAMPLES.json)

## 0. 決定と適用範囲

**入口と撮影ガイドは専門化する。保存・確認・再利用・権利・対応履歴は共通化する。**

Biosecurityは既存Biodiversity Domain Packの対象プロファイル群であり、第四のアーキテクチャ層、別サービス、別データ基盤ではない。Taxon・Occurrence・Identificationを非生物用途の汎用型に改名しない。生物以外への再利用は既存Record / Evidence / Place / Claim / Review / Publicationを使う。

クビアカだけを実運用の最初の対象とする。植物とハチのプロファイルは構造検証用fixtureであり、公開サービス・検証済み識別器・行政連携ではない。対象が増えるたびにDB・認証・カメラ・管理画面を複製しない。一方、最初から任意フォーム生成エンジンやプロファイル管理サービスも作らない。

「写真1件を複数の目的へ参照させられる」が共通化の完了条件である。「種名だけ差し替えられる」では不十分。

## 1. 利用者と完了状態

| 利用者 | 最初に必要なこと | 完了とする状態 |
|---|---|---|
| 気になる虫・痕跡を見つけた人 | 名前を知らずに写真を残す | 保存先と確認状態が分かり、再び開ける |
| 学校・観察会の参加者 | 指定地点・課題に沿って記録 | 原記録を複製せず活動へ参照でき、公開範囲が守られる |
| 土地・施設・樹木の管理者 | 同じ対象の変化を見る | 発見、処置、再訪が別記録として時系列で追える |
| 確認担当者 | 判断に必要な証拠を確認 | 写真単位の確認範囲、理由、権限、訂正が残る |
| 行政・専門機関 | 対応可能な情報を受け取る | 宛先・内容・同意・送信と受付の証拠が区別される |
| データ利用者 | 出典付きの使える記録を得る | 対象・時点・場所精度・確認範囲・利用条件が明確 |

記録量・滞在時間・ランキングを成果にしない。専門家確保・行政契約・対応時間保証が未成立なら、その状態を表示し、受付後の専門対応を約束しない。

## 2. 入口は三つ、記録の所有者は一つ

A. 専門入口: `/kubiaka` → 対象を意識した撮影 → private receipt。
B. 普通のZUKAN投稿: 通常投稿から対象候補が見つかった場合、本人へ専門ガイドを提示。自動で行政送信や追加目的利用を行わない。
C. Program / Quest / 管理対象から: 既存の参加・場所・樹木を引き継いで撮影。Program参加だけではprivate媒体の閲覧権を付与しない。

`entrypoint`は流入経路、`profile_id`は撮影・確認の文脈、`taxon assertion`は生物についての主張である。クビアカページから来たことはクビアカを観察した証拠ではない。

既存記録を活動へ追加するときはRecord参照と目的別許可を追加する。画像、位置、観察日時を再登録させない。異なる公開版・外部提出版は派生物であって第二の原本ではない。

## 3. 共通化する責務と専門差分

| 共通の既存責務 | プロファイルの差分 |
|---|---|
| Record / Media / Evidence | 対象種・種群、痕跡語彙、写真の撮り方 |
| Place / Entity | 寄主・樹木・巣・群落等への関連付け |
| Claim / Assessment / Review | 何を証拠とし、誰がどこまで判断できるか |
| Rights / Consent | 地域・用途ごとの開示条件、安全案内 |
| Program / Quest | 巡回課題、観察対象、調査手順 |
| Case / Action | 通報先、優先度、対応・再訪手順 |
| Publication / Export | 専門ページ、活動結果、自治体向け形式、DwC mapping |

自治体ごとの台帳、カメラ、Record DB、認証基盤、汎用EAVを追加しない。NOCOSILをZUKANの稼働必須依存にしない。

## 4. データモデル — 論理契約

以下は論理フィールドであり、新規物理テーブル一覧ではない。既存のsource実装・実際のD1 schemaへ対応付け、不足分だけを追加する。Foundation全体の新規実装を前提条件にしない。

### 4.1 Record と媒体

| 項目 | 契約 |
|---|---|
| `record_id` | 不変の非意味的ID。種名・市町村名を埋め込まない |
| `owner_ref` | accountまたはscoped guest participant。端末指紋を人物IDにしない |
| `record_kind` | 観察、処置、再訪等の既存kindへ対応付ける |
| `observed_time` | 時刻・期間・日付精度・timezone。未知を保持可能 |
| `submitted_at` | サーバー受信時刻。撮影時刻で代用しない |
| `location_ref` | 原位置、精度、測位方法、本人修正履歴への保護された参照 |
| `subject_refs` | 特定の木・巣等。未確定・複数対象を許容 |
| `asset_ids` | 保存された媒体IDの集合。失敗媒体は別に保持 |
| `entry_context` | profile/version、entrypoint、任意のProgram/Quest/protocol version |
| `rights_ref` | 保管・解析・閲覧・外部提供を別々に評価できる許可 |
| `external_refs` | 外部system + external ID + edition。輸入データの同一性に使う |

撮影日時の修正も原値と修正者を残す。別日に同じ木を撮ったものは別Record。同じ保存要求の再試行は同じRecord。画像hashが同じだけで異なる参加者の原記録を自動統合しない。

媒体には実際のMIME、bytes、checksum、取得/生成元、加工履歴、権利、非公開object参照を持つ。原画像・解析用・表示用・公開用の関係を記録する。圧縮後画像を原画像と称さない。クビアカだけ無料原本永久保存へ変更せず、現行媒体保存方針に従う。微細特徴が失われた画像は追加証拠を求め、画像品質不足を陰性としない。

### 4.2 一つの記録と複数の生物・主張

`Record 1 : N Claim`、`Claim N : M EvidenceAsset`を許容する。一枚に虫と寄主樹木が写る場合、虫の同定と木の同定は別主張にする。必要なら写真内の領域参照をEvidenceLinkへ持たせる。

主張の例:

- 投稿者: 「木くずのようなものがある」
- AI: 「フラスの可能性がある」
- 専門家: 「この写真の虫は対象種である」
- 管理者: 「この木を処置した」

フラスの確認から原因種を無条件に確定しない。対象外の虫と分かっても、写真や樹木の記録を削除・別DBへ移動しない。同定ClaimRevisionだけを追加・訂正し、クビアカ確認一覧は対象外として表示できる。

### 4.3 Claim / Review

各主張はsubject、predicate/version、値、観察時点、記録時点、assertor、evidence asset IDs、assessment/model versionまたはhuman review、limitations、revision、supersedesを持つ。

`verification_state = unreviewed | in_review | supported | not_supported | insufficient | disputed`

これは主張単位の状態であり、Record全体を一個のverifiedフラグにしない。専門家の同定支持は「被害原因確定」「行政確認済み」「場所の安全保証」へ昇格しない。異議は`disputed`として保持し、未確認へ丸めない。

Review authorityは`automated | trained_reviewer | accountable_specialist | approved_recipient_response`を識別し、対象分野・管轄・有効期間が合う権限であることを確認する。自己申告の肩書、いいね数、多数決で専門authorityを付けない。

### 4.4 Place と対象個体

Placeは公園・施設・区域、Entity/Subjectは特定の木・巣・群落等として区別する。同じ公園、近い座標、同じ名前だけで同じ木へ統合しない。既存タグ・QR・本人の明示選択・確認済み対応関係がある場合に同じsubjectへ関連付ける。

位置はWGS84への変換元と座標精度を残す。測位誤差と公開用ぼかしは別属性。日付変更線・行政境界付近・低精度位置では管轄を断定しない。地図操作できない人には住所/目印/地域選択を提供する。

### 4.5 観察・再訪・処置

発見、被害の記録、処置、再訪を新Recordで追加する。処置で最初の発見を上書きしない。何人かが同じ事象を報告した場合も原Recordは保持し、権限のある担当者だけが一つのCaseへ束ねられる。

Caseの完了理由は`対応不要 | 送付先引継ぎ | 処置記録あり | 経過観察 | 誤認 | 重複対応 | その他`等を根拠とともに持つ。`Case closed`と`根絶`は同義ではない。根絶の主張は別の明示的な調査・機関根拠を必要とする。

## 5. Target Profile と地域ルール

### 5.1 Target Profile

初期はversion付きの小さな静的設定と通常のrenderer分岐だけを使う。モデルがprofileを生成して即時有効化しない。

```text
profile_id / version / status
localized_title / route_aliases
subject_scope: taxon reference + verbatim name + authority/version
signal_types / evidence_roles / lookalike_source_refs
capture_guidance_refs / minimum_evidence_for_assessment
review_policy_ref / safety_guidance_refs
regional_policy_refs / privacy_policy_ref
optional survey_protocol_refs
```

`subject_scope`は探している対象であり、投稿の確定種ではない。不明な種名・外部IDは架空IDで埋めない。日本語/英語の別名は表示名であってstable identityではない。

`profile.status = draft | active | read_only | retired`。activeから退役しても原記録と本人閲覧は残す。旧リンクは案内先を表示し、別の種へ黙って転送しない。既存版の意味を変更せず、新versionを発行する。

### 5.2 地域・制度Policy

同じ種でも在来/外来、法的扱い、優先度、窓口は場所と時点で異なる。Taxonに世界共通の`is_invasive=true`や日本の4地域区分を直書きしない。

Policyは既存SourceEdition / version付き宣言設定の一部として表現する。

```text
policy_id / version
jurisdiction_ref / geometry_version
subject_scope / applicability_conditions
effective_from / effective_to
source_edition_refs / checked_at / review_due_at
original_scheme / original_code / original_label
normalized_hint optional
recipient_ref / available_channels
required_fields / allowed_disclosures / safety_guidance
```

日本の4地域区分は日本の当該制度の`original_scheme`に閉じ込める。国の区分定義があることと、各市町村へその区分が指定されたことを混同しない。未取得は`unknown`。投稿ゼロから未被害地域を作らない。

解決順は、適用条件の確認→有効期間→公式に優先指定された管轄→データの具体性。単に「最も新しいURL」「最寄り窓口」を勝者にしない。公式情報同士の矛盾や低精度位置で複数候補が残るときは`unresolved`で返す。

撮影時点の制度と、いま送信するときの窓口を別々に参照する。期限切れ窓口は確認済みとして表示しない。資料が古い場合は出典日を示し、公式の上位案内へ戻せる。

## 6. 市民の画面と文言

### 6.1 専門入口

初期構成は「何を見つけたか」「安全に撮る」「写真を残す」「連絡先」の順。対象種の実写真、類似種、痕跡例、出典、確認担当の実在情報で専門性を出す。行政認定・提携ロゴ・専門家監修を根拠なしに表示しない。

主操作は原則1つ。「見分け方」と「公式窓口」は補助。生命身体の危険がある場合は撮影より地域の緊急連絡案内を優先する。通常の害虫報告と救急連絡を混ぜない。

### 6.2 記録画面

専門ページからの初期写真モードは1〜6枚。種名、住所全文、被害判定を必須にしない。写真→場所/時点の確認→保存の順で、入力は段階的に開示する。

「成虫」「木くず・痕跡」「木の異変」「分からない」を選べる。写真を撮るために近づく、私有地へ入る、枝を切る等を要求しない。

GPS拒否時も目印/地域入力または位置不明として保存できる。連絡に必要な精度が不足することだけを通報準備時に伝える。安全上写真を撮れない場合、撮影せず公式窓口へ進める。媒体なしの懸念Recordは既存kindが対応する段階で扱い、写真必須APIへ空ファイルを送らない。

### 6.3 保存後

表示例:

> 写真を保存しました。これは自治体への通報ではありません。
> 写真6枚のうち、今回は3枚を確認しました。
> この写真だけでは、原因の虫までは分かりません。

次の操作は状態から一つ選ぶ。未送信→再送、追加証拠依頼→写真追加、通報準備可能→連絡内容を確認、再訪課題→同じ場所を記録。本人の意思でいつでも公式窓口へ進め、AI/人Review終了を通報案内の前提にしない。

初期版で専門家がいなければ「専門家確認待ち」ではなく「専門家による確認は提供していません」とする。実在担当者が受け付ける場合に限り確認待ちを表示する。

### 6.4 詳細と履歴

最初に本人の写真と確認内容、次に同じsubject/Placeの前後比較、必要なときだけ行政連絡と対応履歴を展開する。複数目的への利用先は「この記録を使っている活動」で確認・撤回できる。

専門の詳細URLも同じRecordを参照する。公開Recordとは別のprivate viewerを使用し、private URLにpublic canonical/OGPを付けない。公開版を作る場合は明示的Publication操作とする。

### 6.5 共通品質

DESIGN.mdのtokens、44px以上の操作領域、14px下限、可視focus、keyboard操作、読み上げ、文字200%、320px〜1536pxを適用する。色のみで判定を表現しない。既存の大きい撮影ボタンを縮めない。

MapLibre等既存地図を再利用し、地図不可でも文章と一覧で操作できる。巨大hero、新しいテーマ、別ブランド、機能未接続のCTAを作らない。

## 7. 保存と再開

### 7.1 不変条件

`保存済み`は、原Recordへの参照、選択媒体の実保存数、権利、所有者、profile contextがサーバーで確認できること。ローカル保存・アップロード受付・AIキュー投入から保存成功を先取りしない。

D1内の関連更新には既存transaction/batchを使う。D1とR2を一つの原子的transactionとは扱わない。既存媒体予約・再開機構を使い、足りないときだけ次の順で最小追加する。

1. actor + idempotency key + request digestで非公開の保存予約を作る。
2. 認可されたprivate object keyへ媒体を保存し、実MIME/サイズ/checksum/個数を確認する。
3. D1 batchでRecord・媒体参照・context・権利を確定する。
4. 確定後に確認処理を再開する。DB失敗時のobjectは予約に紐づく再開可能な状態として残す。

SQL更新0行は例外とは限らないため、CAS/所有者条件の不成立時に後続書込みが成立しない条件をtransaction内で保証する。同じ要求keyで異なるpayloadは409相当。同じ要求の再試行は元の結果を返す。

選択6枚中3枚だけ保存できた場合は`partial`を表示し、残りを再送するか本人が3枚で確定する。欠損を黙って切り捨てない。既存Recordへの写真追加はevidence revisionを作り、旧Reviewが新写真まで確認したように表示しない。

### 7.2 通信断・端末

既存のlocal draftと復帰処理を再利用する。画面を閉じている間も送信されると保証しない。foreground再開で未完了を再送する。端末保存不能・容量不足は明示する。

端末キャッシュ、下書き、guest sessionはactor単位で分離し、ログアウト・共有端末切替で表示とcredentialを閉じる。他人の下書きを新規ユーザーへ再帰属しない。private receipt/mediaをService Workerの公開cacheへ入れない。

### 7.3 Guest

ログイン不要投稿は最初の本公開journeyの要件。ただしscoped guest所有・閲覧・claimが検証される前には「ログイン不要」を宣伝しない。

既存account認証を再利用し、guestだけ最小のparticipant credentialを追加する。CSPRNG token、サーバーdigest、HttpOnly/Secure/SameSite、__Host- cookie、same-origin/CSRF対策を使う。receipt ID単体やメール内の通常URLを閲覧credentialにしない。

投稿前に過去guest履歴を列挙しない。投稿後は今のsessionのreceiptのみを提示。「別の人が使う」でrotationし、旧表示を閉じる。guestアクセスの期限・保存期間は現行retention policyと整合した値をactivation時に必須化し、未設定ならguest機能を公開しない。

会員化はreceipt単位の原子的claim。Record/mediaの重複を作らず、作成時刻とprovenanceを保存し、成功後はguest mutationを失効する。cookie喪失・別端末で自動復旧できるとは約束しない。通知希望・他端末再開時には通常のaccount接続を案内する。

## 8. 状態は独立させる

| 軸 | 値と意味 |
|---|---|
| Persistence | draft / saving / partial / link_pending / ready / failed / suppressed / erased_reference_only |
| Assessment job | not_started / queued / running / completed / failed / stale / cancelled |
| Claim verification | unreviewed / in_review / supported / not_supported / insufficient / disputed |
| Feedback | none / draft / published / superseded / withheld |
| Handoff | not_started / prepared / opened / self_reported / submitted / acknowledged / rejected / failed / unknown / cancelled |
| Response | no_case / open / assigned / in_progress / follow_up_due / closed |

`completed`は処理完了であって陽性・陰性ではない。`opened`は公式窓口を開いた操作、`self_reported`は本人の申告、`submitted`は送信receipt、`acknowledged`は宛先の受領Evidence。通信のHTTP 200だけを行政受付としない。

状態機械を一つ新設するのでなく、各既存責務からpure projectionで画面状態を導出する。少なくとも「保存済み＋AI失敗」「旧feedback公開中＋新解析待ち」「専門家確認済み＋未送信」「行政受付済み＋未対応」「対応完了＋再訪期限到来」を表示できる。

## 9. AI・人Review・feedback

### 9.1 AIの入力と出力

入力は利用許可された画像、写真役割、対象profile/version、必要最小の地域/季節context。連絡先、guest token、正確な自宅座標、学校名を不要に送らない。画像・メモ・外部ページ内の命令は資料として扱い、tools/権限を操作させない。

出力は機械検証可能な形にする。

```text
assessment_id / provider / model_version / policy_version
submittedAssetIds / assessedAssetIds / unassessedAssetIds
subject_candidates[]
signal_findings[{type, assetIds, visible_scope, limitations}]
quality_flags / uncertainty / triage_reasons
suggested_next_photo_roles[]
```

`assessed`と`unassessed`は重複せず、和集合がsubmittedと一致する。所見のasset参照はassessedの部分集合。provider失敗・読取不能・対象外mediaを「異常なし」に変換しない。検証されていないconfidenceを確率として表示しない。

### 9.2 振分け

初期はルールベースで「安全上の即時案内」「管轄上の優先対象」「証拠不足」「通常確認」を分け、AIは候補抽出と説明補助に留める。新規地域らしい、季節が異例、対象が複数、既存判定と矛盾等は理由付きで担当者へ見せる。

**AIが対象外らしいとしただけで自動却下・自動close・通報禁止にしない。** 地域外・季節外も誤報の証明ではない。将来の自動triageは対象/地域別の検証、低優先群の抜取監査、見逃し検知・rollbackが成立した範囲だけに限定する。外部研究の精度をこの実装の性能として転用しない。

### 9.3 人Review

担当者はqueueから一件を取り、対象写真、既存Claim、必要な管轄情報を確認する。追加撮影依頼、根拠付き支持/不支持/不足/異議の登録、利用者向けfeedbackを行える。確定と外部送信は別操作。

編集競合は既存revision/CASで409相当を返し、後勝ち上書きをしない。役割失効後の新規判断は拒否し、過去の判断はその時点のauthorityと訂正状況を残す。

担当者未割当・能力不足・受付停止は保存を止める理由にせず、review能力と待ち状態を正直に表示する。期限や専門対応を約束せず、必要な公式窓口は常時案内する。

### 9.4 FeedbackEdition

append-only editionとして、確認した写真、確認範囲、分かったこと、分からないこと、前回との違い、次に撮るなら、確認者/確認状態を返す。自動/人Reviewのauthorityを併記する。

公開条件はpersistence ready、asset accounting有効、所見参照有効、制限事項表示、機微情報除去。旧版を訂正しても履歴と訂正理由を残す。全写真未確認時の「この記録に手掛かりなし」は禁止。写真に写らないことから場所の不在・安全を結論しない。

## 10. 通報・行政handoff

### 10.1 初期提供

初期は「連絡内容をまとめる」「公式窓口を開く」まで。ZUKANからの自動外部送信は無効。受信者・制度・手段が未検証の窓口を作り上げない。写真未添付・位置不明でも保存できるが、送付に不足する項目は明示する。

packageは必要最小の写真、観察日時、通報用位置、兆候、本人の説明、AI候補と不確かさ、人Reviewの有無、版と出典を含む。UIで公開用位置と通報用位置の違いを説明する。本人連絡先は必要で本人が選んだ場合だけ含める。

copy/保存/公式form/電話をchannel capabilityとして扱う。メール本文へprivate認証URLや長寿命bearer media URLを貼らない。写真は本人が選んだ添付または承認済みの宛先限定packageで渡す。

### 10.2 将来の連携送信

実在の受信主体、用途、必要fields、受信方法、責任者、受付Evidence、訂正・撤回連絡方法を確定した宛先だけを許可する。URL指定型の汎用HTTP送信機能は作らない。

`recipient + package edition/digest + disclosure scope + explicit consent`を送信意図に固定する。送信直前に現行権利・policy・宛先有効性を再評価。payloadが変われば再確認する。

送信keyは宛先とpackage editionとactorに紐付ける。timeout後、相手の冪等性キー/照会で未受領を確認できない場合は`unknown`とし、自動再送しない。外部のreceipt番号・受領日時・対象editionを記録する。

本人の「送った」申告はself_reportedで保持できるが、公式受付済みと表示しない。電話をかけるボタンのtapは発信・通話完了・受付を証明しない。

### 10.3 送信後の訂正

同定訂正・撤回・画像削除があれば影響したpackage/recipientを特定する。ZUKAN側の将来利用を停止し、外部へは承認された訂正・削除依頼を別Actionとして扱う。既にダウンロードされた第三者copyを回収できたと偽らない。

## 11. 外部通知interlock

新しいprivate profile記録は、public feed、area_watch、taxon subscription、researcher、novelty、webhook、mail、export、自治体delivery等の既存出口へ自動流入させない。

サーバーで保存されたprofile context・taxon候補・rightsを用い、対象profileと管理対象taxonのどちらからも判定する。linkの欠落・pending、設定欠損、権利読取失敗では自動外部副作用をdenyする。クライアントの非公開フラグやAIの一回の対象外判定に依存しない。

このguardは対象と出口に限定し、無関係なZUKAN投稿や通知全体を止めない。既存の退役Node gateを復活させたという理由でactive Workerを保護済みとしない。actual sinkへの到達テストを実装受入に含める。

本人向けpush/mailも初期sliceでは追加しない。receiptでの閲覧を基本とし、将来追加する場合は通知同意と機微情報を含めない配信契約を別途適用する。

## 12. 調査と「見つからなかった」

`casual photo`、`structured survey`、`management follow-up`を区別する。

正式調査は既存SurveyEvent / DetectionOutcomeへ対応付け、protocol/version、対象種群、調査範囲、開始終了、努力量/単位、方法、調査者、検出限界、確認authorityを必要とする。未知・中断・対象外はindeterminate/unassessed/not_applicableとして表現する。

対象が写らないcasual写真は「確認した写真では明確な手掛かりなし」。protocolに基づいて探して見つからない場合だけnot_detected。それでも地域にいない、被害ゼロ、根絶とは言わない。

機関が持つ正式調査はprotocolの適合範囲で集計できる。casual件数と混ぜて被害率、未被害率、網羅率を出さない。分母・方法がない割合は作らない。

## 13. 再利用・公開・権利

初期はprivate。保存、AI解析、担当者review、団体内閲覧、一般公開、行政提供、研究提供、宣伝利用、AI学習は別目的。すべてにUI checkboxを常時並べるのではなく、その操作の直前に必要な同意を示す。

**再利用できる構造と、再利用する許可は別。** 旧クビアカ記録のno-aggregation/no-export/no-routingを新設計で解除しない。後日本人が許可した対象と用途だけを追加する。公開licenseがあることだけでprivate precise locationや連絡先を取り出さない。

権限判定はactor × object × purpose × field × current policy。Program所属・自治体職員・reviewerというロールだけで全privateデータへアクセスさせない。group間の同一画像hashや似た報告の存在も無断で明かさない。

public版は位置だけでなくEXIF、背景の顔・車番・学校名、メモ、正確な日時による推測も評価する。rawのprivate版をCDNへ置いてCSSで隠さない。

削除/撤回時は本人詳細、検索、一覧、地図、thumbnail、export cacheを対象にする。保管義務等がある情報は権利根拠と保持範囲を明示し、原媒体の物理eraseと最小tombstoneを分ける。不変性を理由に削除権を無効化しない。

## 14. 公開地図と運用者の見取り図

最初の提供はprivate record/receiptと管理対象の再訪一覧。public raw detection pins・投稿数ヒートマップは初期対象外。

公式に公表済みの地域情報と、市民投稿からの派生情報は別datasetとして扱う。公式資料を表示できることを理由に市民の位置を公開しない。

後段の担当者viewは権限内の未確認/追加撮影/再訪期限/対応状態を一覧と地図で同じように操作できる。public aggregateは小数セル、差分攻撃、時間精度、再識別、withdrawal伝播を評価した範囲で別途有効化する。地図の空白を「安全」と表示しない。

## 15. 国際データ交換

内部DBをDarwin Coreに置換しない。生物データの適格なPublicationEditionを交換時にmappingする。[一次情報](../kubiaka-focused-experience/GLOBAL_CITIZEN_BIOSECURITY_RESEARCH_2026-09-13.md)

| ZUKANの意味 | 外部mapping |
|---|---|
| 時間・場所における生物の主張 | Occurrence。stable occurrenceIDをRecord + subject assertion identityへ対応付ける |
| 観察時点 | eventDate。投稿日時で代用しない |
| 同定 | scientificName、taxonID、verbatimIdentification、identificationQualifier、identifiedBy/dateIdentified等 |
| 正式調査 | Event + Occurrence、eventID、samplingProtocol、samplingEffort、sampleSizeValue/Unit等 |
| 検出結果 | occurrenceStatus。casual無所見をabsentにしない |
| 位置 | decimalLatitude/Longitude、geodeticDatum、coordinateUncertaintyInMeters |
| ぼかし・非開示 | dataGeneralizations、informationWithheld。bbox等からの不確実性を過小表示しない |
| 利用条件 | license、rightsHolder、accessRights |
| 外来・定着・侵入経路 | establishmentMeans / degreeOfEstablishment / pathway。場所・時点・機関根拠がある場合のみ |
| 行政処理・駆除・再訪依頼 | Case/Action package。Occurrenceのpresence/absenceに押し込まない |

Record一件から複数Occurrenceが出る場合がある。フラスの写真だけで原因種のOccurrenceを確定出力しない。誤同定の訂正時も外部IDを無用に新規発行せず、訂正版と元editionの関係を保持する。

最初は本人用のJSON/CSV packageと、局所fixtureでのDwC mapping設計まで。GBIF/IPTへの自動公開、MCP/API書込み、iNaturalistのprivate座標取得は未実装かつ別権限。現行標準の版をpinし、外部providerの受入要件を別に検証する。

## 16. NOCOSIL・団体運用

ZUKANは原Record、Review、Program、Publicationの正本を維持する。NOCOSILは、権利と接続が成立したとき、許可された参照/editionを使って内部担当タスク・議事録・進捗整理を扱える。private媒体・参加者一覧・連絡先をshared identity planeへ流さない。

同じRecordを両製品で独立編集しない。ZUKAN側の公開/同定変更はZUKANの権限付きcommandへ戻し、NOCOSIL側の内部task更新を生物学的結論にしない。現時点で連携済み・自動同期済みとは扱わない。

学校・子どもはguardian/program policyを継承し、連絡・公開・位置提供に必要な同意が不明なら該当用途を無効にする。ランキング、捕獲競争、地点の公開、危険な探索を標準の動機付けに使わない。

## 17. Command境界と同時実行

以下はlogical operation名。既存のHTTP/MCPへadapterで接続し、専用REST/MCPを別々の業務ロジックとして作らない。

| Operation | 主なinput | output / 副作用 |
|---|---|---|
| ResolveProfile | profile/version、locale、任意地域 | guideと利用可能操作。保存・送信なし |
| PrepareCapture | actor、profile、idempotency key | actor-scoped reservation。public化なし |
| CommitRecord | reservation、媒体refs、time/place、rights | 保存結果/receipt。AI・外部送信と独立 |
| ReadReceipt | actor credential、receipt ID | 権限内のprojection。列挙耐性 |
| ClaimReceipt | signed account + current guest proof + expected revision | 既存Record所有を原子的に引継ぐ |
| AssessRecord | authorized record/evidence version | version付きAI候補。確認確定・送信なし |
| ReviewClaim | reviewer authority、claim revision、evidence scope | new review/feedback。外部送信なし |
| LinkContribution | record、Program/Quest、purpose consent | 参照のみ。ACLの自動拡大なし |
| PrepareHandoff | selected record/claim revisions、recipient policy | preview、missing fields、immutable package digest |
| SendHandoff | validated intent/consent、current policy、idempotency key | 将来の許可宛先だけ。receiptかunknown |
| RecordFollowUp | previous subject/place、new evidence/action | 新Record。以前の発見を保持 |
| WithdrawUse | object、purpose、expected revision | 未来の利用停止と派生物対応。外部削除成功を偽らない |

権限不足/ID不正は既存の403/404非開示方針、競合は409、内容不正は422、rate limitは429、能力なしは503相当へ対応付ける。応答に成功を偽装しない。error詳細で別ownerの存在や座標を漏らさない。

## 18. 実装構造・運用コスト

現行Worker、登録済みD1/private R2、既存Capture Loop、既存Review/Program/Publicationを優先する。新しいqueue、daemon、scheduler、汎用profile DB、vector DBはP0不要。既存の耐久処理がある場合はそれを再利用する。`waitUntil`だけを耐久確認の正本にせず、保存済みjob状態から再開できるようにする。

確認は媒体版・profile/policy/model版のdigestで再利用し、無変更の写真をページ表示のたび再解析しない。ユーザーの明示再解析と訂正は別に履歴化する。重複deliveryを前提に既存retry/idempotencyを適用する。

費用は固定額でなく、媒体byte-month、変換回数、解析画像/token数、再試行、担当者分数、提出package数で測る。モデルは現行登録済みで画像処理に適合した低コスト経路から選び、文章用モデルを画像同定へ流用しない。

プログラムごとの予算/回数上限と受付能力を必須設定にする。上限超過でも保存と公式案内は維持できるようにし、未提供のAI/人Reviewを約束しない。新規課金・有料プラン・専門SLAを本設計で決定しない。

## 19. 測定と受入

主要指標は、保存から再表示までの成功率、未解決の部分保存、再試行の重複、feedback到達/閲覧、追加証拠の有用性、Review担当分数/滞留、宛先解決不能、公式受付Evidenceのある割合、訂正・撤回伝播。

市民投稿数、対象候補数、人確認件数、公式受付数、処置件数は分母と時点を分ける。通報完了率に公式リンクtapを混ぜない。真の検出感度・生物多様性改善・根絶効果は、独立した実地調査なしに数値化しない。

受入はCONTRACT_EXAMPLES.jsonとPLAN.mdのnegative casesを使用する。fixtureはテスト設計であり、製品上で通過したEvidenceではない。対象種の二つ目は公開するのでなく、植物/ハチfixtureでDBやRecordの複製なしに意味が成立するか確かめる。

## 20. 運用開始前に必要な実値

設計としての既定動作は決めているが、次の実値は未確認のまま捏造しない。

- 現行D1 schemaとwriterへの正確な対応、旧private記録の所在と保存方針。
- guest credential/媒体/下書きの有効期間と既存retention policyの対応。
- 専門Reviewを提供する場合の実在責任者・能力・受付範囲。
- 公式窓口の現行適用条件。API送信には受信機関との実接続と訂正経路。
- 必須安全文言・類似種画像・素材権利の版。

未成立の能力は無効・未提供と表示し、独立して提供可能な保存/ガイド/公式案内を止めない。schema migration、provider bill、外部送信、公開位置等の実変更は当該Workの現行権限で実行する。本書のmergeだけでは実装・本番・外部連携の許可または完了を主張しない。

## 21. 明示的なSUPERSEDED

本書がmainへmergeされた時点で、クビアカ領域の以下の読み方をSUPERSEDEDとする。

- 種ごとの専用Record/receipt/Claim DBを恒久正本とする読み方。共通Coreへのprofile参照を優先する。
- `写真投稿 = 確定Occurrence`、`AI低確信 = 自動却下`、`URLを開いた = 通報済み`。
- 日本の4地域区分を世界共通enumとしてCoreに持つこと。
- 古いPostgreSQL依存PR順をcurrent Cloudflare実装へそのまま適用すること。
- すべてを「確認中」等一軸へ畳む状態簡略化。

既存のprivate-first、guest isolation、asset accounting、no casual absence、明示的外部送信、公開map後段化、権利・撤回の制約は維持する。国戦略alignmentはクビアカ地域例、global researchは設計Evidenceであって本書を上書きしない。
