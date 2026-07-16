# 連理の木の下で サイエンスアドベンチャー — Analytics / Operations Dashboard Specification

更新日: 2026-07-16

対象時間: 2026-07-19（日）11:10–13:00

状態: **local実装・focused test PASS、staging runtime検証はUNEXECUTED**

## 1. Event registry

このイベントで許可するfunnel event nameは、次の**ちょうど16個**だけとする。別名、version suffix、個人別event nameを増やさない。

| # | Event name | 発火条件 | Dedupe / 注意 |
|---:|---|---|---|
| 1 | `event_qr_open` | 主QRのjoin entryが表示可能になった | 物理scanを厳密に証明する値ではなく、主QR entry impressionとして扱う |
| 2 | `event_join_loaded` | event metadataとjoin UIの描画完了 | page loadごと。session/page view単位で重複排除 |
| 3 | `event_checkin_started` | check-in送信を開始 | 二重tapを別家族として数えない |
| 4 | `event_checkin_succeeded` | serverがparticipantを確定 | participant単位で1回 |
| 5 | `event_checkin_failed` | check-inがretry可能または最終失敗 | allowlist済みreasonだけを記録。参加者テレメトリ由来の参考信号であり、確定障害数にはしない |
| 6 | `event_registration_started` | 写真保存のため登録/loginへ遷移 | メール等の入力値を記録しない |
| 7 | `event_registration_succeeded` | auth後に元event/draftへ復帰 | account identifierを記録しない |
| 8 | `event_rally_opened` | rallyが利用可能になった | page view単位 |
| 9 | `event_photo_selected` | 撮影またはfile選択が完了 | filename、MIME raw値、画像内容を記録しない |
| 10 | `event_observation_submit_started` | 観察送信開始 | client submissionはanalyticsへ生値を送らない |
| 11 | `event_observation_succeeded` | server保存成功を確認 | 一意の保存成功だけ。AI同定完了とは別 |
| 12 | `event_observation_failed` | 保存がretry可能または最終失敗 | allowlist済みreasonだけ。参加者テレメトリ由来の参考信号であり、確定障害数にはしない |
| 13 | `event_live_viewed` | live contentが表示可能 | page view単位 |
| 14 | `event_recap_viewed` | recap contentが表示可能 | page view単位 |
| 15 | `event_offline_queued` | durable local queueへの保存成功 | 単なるoffline検知やmemory上のdraftでは発火禁止 |
| 16 | `event_retry_succeeded` | 直前に失敗した同じ操作がserver成功 | retry対象種別だけをallowlistで付与 |

`event_offline_queued` は実際にdurable queueが存在し、再起動後も復元できる場合だけ使う。現在の実装がdraft保持のみなら発火させず、運営画面でも「未同期queue」と断定しない。

## 2. Allowed properties

| Property | 値の例 | 制約 |
|---|---|---|
| event_code | `RENRI0719` | 本番確定後の公開codeだけ |
| event_session_id | opaque event ID | 人を識別しないevent単位 |
| occurred_at | ISO 8601 / JST表示はdashboard側 | server時刻を優先 |
| page | join / rally / record / live / recap | allowlist |
| auth_state | guest / signed_in | account IDなし |
| device_class | mobile / tablet / desktop | user-agent全文を保存しない |
| browser_family | safari / chrome / in_app / other | major versionまで。fingerprinting禁止 |
| network_state | online / offline / unknown | IPをpropertyへ入れない |
| result_reason | validation / timeout / 4xx / 5xx / permission / unknown | response bodyや自由文を入れない |
| duration_bucket | `<10s` / `10-30s` / `31-120s` / `>120s` | 個人timelineの再識別を避ける |
| retry_kind | checkin / observation / upload | allowlist |

## 3. Forbidden data

analytics payload、event name、dashboard filter、log、screenshotへ次を入れない。

- メールアドレス
- 本名、家族名、ニックネーム
- 生のuser ID、participant ID、client submission ID
- guest credential、cookie、session token
- 正確な緯度経度、住所、IP address
- 写真ファイル名、object key、写真内容、EXIF
- 自由記述本文、species memo
- 未成年者を識別できる属性

hash化した個人IDもこの一日イベントのdashboardには不要。安易なhash化を匿名化として扱わない。

## 4. Operations dashboard

### Funnel

表示する段階は `QR entry → join → check-in → rally → photo selected → submit started → observation saved → live → recap`。各段階で件数、直前段階からの率、失敗件数、最終更新時刻を表示する。

### Domain counters

| Counter | 定義 |
|---|---|
| チェックイン済み家族数 | check-in成功の家族・グループ重複排除数。主催者除外 |
| 観察件数 | server保存成功が確定した一意の観察 |
| 投稿成功数 / 失敗数 | submit開始に対するserver結果。retry成功は成功へ1件だけ |
| 未同期件数 | durable queueに実在する未送信件数。draftだけなら「計測不可」と表示 |
| 最終更新時刻 | dashboard aggregateが最後に更新されたserver時刻 |
| live集計の遅延 | source event時刻とlive反映時刻の差 |
| recap生成状態 | not_started / processing / ready / failed |

analytics件数とdomain counterが食い違う場合、参加組数・観察件数はD1/R2整合性を根拠とするdomain counterを正本にし、差分を計測欠損として記録する。見栄えのために手動補正しない。

## 5. Alert thresholds

| Alert | 条件 | 当日判断 |
|---|---|---|
| check-in failure signal | 連続2件または5分窓で10%以上 | **単独発動禁止**。スタッフ端末で再現、またはdomain/API health異常と一致した場合だけFallback 2/3判断 |
| observation failure signal | 連続2件または未同期増加 | **単独発動禁止**。スタッフ再現、server保存失敗、または未同期の実測と一致した場合だけ写真保持を案内しFallback 2 |
| live delay | 120秒超 | live案内を外しFallback 1 |
| recap failed | status failedまたは件数不一致 | recapを確定成果として案内しない |
| privacy | 禁止dataを1件でも検出 | 直ちに全体表示停止、Fallback 3 |

失敗系2値は匿名・仮名参加者が作り得るuntrusted participant telemetryであり、dashboard APIの`automaticFallbackEligible=false`を正本とする。これらを自動アラート、確定障害数、または単独のFallback条件へ昇格してはならない。

## 6. Runtime implementation

- registry / payload validator: `platform_v2/cloudflare_shadow/src/index.ts` の `OBSERVATION_EVENT_FUNNEL_EVENT_NAMES` と `parseObservationEventFunnelPayload`
- same-origin / participant endpoint: `POST /api/v1/observation-events/:sessionId/analytics`
- organizer-only aggregate API: `GET /api/v1/observation-events/:sessionId/dashboard`
- storage: 既存 `observation_event_live_events` の `type='funnel_metric'` / `scope='organizer'`。actor、guest、team列はすべてNULL
- server-side reach: join entry、check-in、rally、live、recap、observation save、guest→auth registration bridge
- client-side reach: registration start、photo selected、submit start、allowlist reasonのfailure、media retry success
- privacy: endpointは上表9 property以外を400で拒否し、`auth_state` と実際のsession状態の不一致も拒否する
- offline: durable queueをserverが確認できないため `event_offline_queued` は409で拒否し、dashboardは「計測不可」と表示する
- domain counter: 参加組数はparticipant表、観察/成功数は一意の`observation_added`を正本とする。analyticsのtap数で参加組数を増やさない
- registration bridge: production observation upsertでevent session/codeの一致とevent専用cookieを照合し、guest参加行をauth userへclaimしてからevent hookを実行する。成功・idempotent成功では対象event cookieだけをclearする

## 7. Verification record

| Gate | Result | Evidence |
|---|---|---|
| 16 event namesのsource locator | **LOCAL PASS** | `OBSERVATION_EVENT_FUNNEL_EVENT_NAMES`。追加aliasを拒否するfocused test PASS |
| forbidden property unit test | **LOCAL PASS** | email propertyを400で拒否し、D1 live eventへ残らないことを確認 |
| staging network payload inspection | **UNEXECUTED** | |
| dashboard表示 | **LOCAL PASS** | organizer-only API / console、PII非表示をfocused testで確認 |
| domain countersとの一致 | **LOCAL PASS** | 二重tap/idempotent送信で家族・観察を重複加算しないことを確認 |
| guest→auth claim / cookie scope | **LOCAL PASS** | event一致、idempotent success、他event cookie非干渉をfocused testで確認 |
| offline queue実在確認 | **LOCAL確認: server計測不可** | `event_offline_queued`は409。stagingでdurable queueが証明されるまで発火禁止 |

focused test: `observation event analytics stays allowlisted and registration bridge claims the event guest`。

staging結果は `renri_science_adventure_2026-07-19_evidence_index.md` と `renri_science_adventure_2026-07-19_post_event_review.md` へ最終SHA locatorで接続する。
