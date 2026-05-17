# FieldScan Play Console Answer Sheet 2026-05-17

Use this sheet when the Play Console account lock is cleared. The source of truth remains the shipped AAB plus `fieldscan_play_release_pack_2026-05-17.md`.

## Account blocker

- Current state verified in Play Console: identity verification pending after document upload.
- Still locked: contact phone verification and app creation.
- First action after Google approval email: complete contact phone verification.

## Create app

- App name: `いきものフィールド`
- Default language: Japanese (Japan)
- App or game: App
- Free or paid: Free
- Package name after first upload: `life.ikimon.fieldscan`

## Internal testing release

- Track: Internal testing
- AAB: `mobile/android/ikimon-pocket/app/build/outputs/bundle/release/app-release.aab`
- Version name: `0.8.1`
- Version code: `80002`
- AAB SHA-256: `FDAA8A7FA54F6BBBA3E9B29DF59D63CF80575277FFAA93F151585368BD5814AF`
- Release name: `0.8.1 internal test`
- Release notes:

```text
初回テスト公開。さんぽ、フィールドスキャン、ポケット観測、端末AI対応、位置・音・景色の観察セッション送信に対応しました。
```

## Main store listing

- App name: `いきものフィールド`
- Short description:

```text
歩きながら、音・位置・景色から自然の手がかりを記録するフィールド観察アプリ
```

- Full description:

```text
いきものフィールドは、散歩や調査中に周囲の自然の手がかりを記録するためのフィールド観察アプリです。

位置情報、環境音、カメラ映像から、鳥の声、環境の変化、場所ごとの観察メモを整理します。対応端末では端末上のAI処理を使い、サーバーへ送る情報を最小化しながら、観察セッションの要約を作ります。

主な機能:

- さんぽ・フィールド調査・ポケット観測モード
- GPSによる観察ルートと地点の記録
- マイクによる自然音イベントの検出
- カメラによるフィールドスキャン
- オフライン中の一時保存と再送
- ikimon.life への観察セッション連携

プライバシー方針:

カメラ映像や音声は、原則として端末上の解析と観察メタデータ生成に使います。サーバーへ送るのは、観察セッションの要約、検出イベント、位置情報、端末内AIの処理結果など、記録に必要な情報です。人の声や人物が含まれる可能性のある情報は、公開利用前にプライバシー処理の対象にします。

このアプリは、自然観察、市民科学、地域の生物多様性記録を目的としています。運転中や危険な場所での操作はしないでください。
```

- App category: Education
- Tags: choose field observation / education / nature-like tags if Play offers them. Avoid children-focused tags.

## Graphics

- App icon: `docs/play/assets/store_icon_512.png`
- Feature graphic: `docs/play/assets/feature_graphic_1024x500.png`
- Foreground service declaration video, if requested: `docs/play/assets/videos/fieldscan_foreground_service_demo.mp4`
- Phone screenshots:
  - `docs/play/assets/screenshots/fieldscan_01_home.png`
  - `docs/play/assets/screenshots/fieldscan_02_disclosure.png`
  - `docs/play/assets/screenshots/fieldscan_03_recording.png`

Suggested screenshot alt text:

- Home: `観察方法を選び、記録開始前の状態を確認するホーム画面`
- Disclosure: `位置情報、マイク、カメラの利用目的を説明する同意画面`
- Recording: `観察中に音、画面、記録状態を表示する記録画面`

## Store settings

- App category: Education
- Contact email: use the public support address for ikimon.life if available; otherwise use the Play account email already configured.
- Website: `https://ikimon.life/`
- Privacy policy: `https://ikimon.life/ja/privacy`
- External marketing: leave enabled only if the listing assets are acceptable for Google promotional use.

## App access

Recommended answer: all or some functionality is available without special access.

Reviewer note:

```text
The app can be opened and tested without login. Login is optional and is used only to link field contributions to an ikimon.life account. Reviewers can start an observation session, view the prominent disclosure, grant runtime permissions, and stop the session without a test account.
```

If Play later requires a reviewer login because a specific screen becomes gated, create a temporary reviewer account and update this sheet before submission.

## Ads

- Contains ads: No

## Target audience

- Recommended age target: 13+ and older, or the closest non-child option available in the regional form.
- Do not target children.

Reason:

```text
The app uses location, microphone, camera, and foreground service behavior during user-started observation sessions. It is intended for general field observation and citizen-science use, not for child-directed distribution.
```

## Content rating

Suggested inputs:

- Category: utility / education style app, not game.
- Violence, sexual content, controlled substances, gambling: No.
- User-generated content: Yes if the questionnaire treats uploaded field observations or synced observations as UGC.
- Location sharing: Yes, the app records observation location for biodiversity context.
- Digital purchases: No.
- Browser or unrestricted web access: No, unless Play interprets OAuth/browser login as external web access.

## Data safety

Use the exact shipped behavior. The release sends derived observation/session data to ikimon.life; it does not intentionally upload raw continuous audio or raw camera video as normal session payload.

Data types to declare as collected:

- Location: approximate location and precise location.
- Personal info: email address, user IDs, and name only when optional login is used.
- App activity: app interactions, in-app search/activity, or other user-generated content equivalent for observation sessions if offered by the form.
- App info and performance: crash logs or diagnostics if the diagnostics upload path is active in the release form's interpretation.
- Device or other IDs: app-generated install ID; device model is sent for install registration/login.

Data derived from sensors:

- Audio: microphone is accessed for natural-sound detection. Declare raw audio files as collected only if the final submitted flow uploads audio snippets or reviewer-visible behavior confirms upload. Current mobile session API sends detection events and metadata, not raw continuous audio.
- Photos/videos: camera is accessed for field scan. Declare raw photos/videos as collected only if the final submitted flow uploads raw media. Current session API sends scene digest and detected metadata.

Purposes:

- App functionality
- Account management, when login is used
- Analytics or diagnostics, only for diagnostic uploads/server logs that Play treats as collected data

Security answers:

- Data encrypted in transit: Yes
- Users can request deletion: Yes, through `https://ikimon.life/ja/contact`
- Data shared with third parties: No sale. Declare service providers only if Play requires infrastructure/hosting/logging providers to be treated as sharing.

## Foreground service / sensitive permission declaration

Use this wording where Play asks why foreground location and microphone are needed:

```text
Pocket and field observation modes record a user-started observation session while the user is walking or observing. Location connects detected natural-sound events and field context to the route of the same session. Microphone access is used to detect natural-sound cues during that active session. The app shows an ongoing notification while recording, and the user can stop the session from the app.
```

Prominent disclosure wording shown before permission requests:

```text
いきものフィールドは、観察セッション中に位置情報、マイク、カメラを使います。位置情報は歩いたルートと検出イベントを結びつけるため、マイクは自然音の手がかりを検出するため、カメラはフィールドスキャンの解析に使います。記録中は通知を表示し、通知が出ている間だけセッションを続けます。いつでもアプリから停止できます。映像と音声は端末上の解析を優先し、サーバーには観察の要約と検出イベントを送信します。
```

## Final pre-submit gate

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate_fieldscan_play_release.ps1
```

Do not submit for review if this fails.
