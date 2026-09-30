# FieldScan Google Play Release Pack 2026-05-17

## Release artifact

- App name: いきものフィールド
- Package name: `life.ikimon.fieldscan`
- Version: `0.8.1`
- Version code: `80002`
- Track target: Internal testing first, then closed/open/production after policy forms clear
- AAB: `mobile/android/ikimon-pocket/app/build/outputs/bundle/release/app-release.aab`
- AAB size: `139,776,341` bytes
- AAB SHA-256: `FDAA8A7FA54F6BBBA3E9B29DF59D63CF80575277FFAA93F151585368BD5814AF`
- Upload signing certificate SHA-256: `13:9F:05:23:C4:FD:CB:C7:CD:65:16:C7:75:FF:FC:3F:72:19:9E:C0:2D:58:9C:B5:C2:4A:F1:66:88:8E:6F:AA`

## Local validation

Run before Play Console upload:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate_fieldscan_play_release.ps1
```

Current pre-account state:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate_fieldscan_play_release.ps1 -AllowPendingScreenshots
```

Verified after emulator capture on 2026-05-17:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate_fieldscan_play_release.ps1
```

Result: passed.

Foreground service start gate verified on 2026-05-17:

- `MainActivity` only enters the active recording UI after the selected foreground service start path returns success.
- Runtime permission checks include location, microphone, camera, and Android 13+ notification permission before service start.
- This prevents a false recording screen when permission prompts interrupt service startup.
- Emulator runtime evidence: `FieldScanService` was active with `isForeground=true`, notification id `1002`, channel `pocket_mode`, and flags `ONGOING_EVENT|NO_CLEAR|FOREGROUND_SERVICE`.

Console paste-ready answers:

- `docs/play/fieldscan_play_console_answer_sheet_2026-05-17.md`

## Play Console status

Verified on 2026-05-17:

- Developer account: `IKIMON`
- Account type: personal account
- Account ID: `7452177191869089046`
- Current blocker: identity verification is pending after document upload.
- Contact phone verification remains locked until Google approves identity verification.
- App creation is still locked with "new app creation requires account verification".
- Device verification no longer appears as an active blocker on the account home page.

Next console action after Google approval email:

1. Complete contact phone verification.
2. Create app `いきものフィールド`.
3. Upload `app-release.aab` to Internal testing.
4. Complete Store listing, Data safety, App content, and foreground service declarations.

## Play Console account decision

Recommended account type: Organization.

Reason: this is not a hobby-only utility. FieldScan is the native app surface for ikimon.life, collects sensitive biodiversity/location context, and may later need organization-level trust, delegation, support contact, and policy review history.

Known requirement: organization Play developer accounts require a D-U-N-S number. If ikimon.life cannot provide one yet, do not create the organization developer account until the D-U-N-S path is confirmed. A personal account is faster but weaker for long-term platform ownership.

Official references:

- https://support.google.com/googleplay/android-developer/answer/13634885
- https://support.google.com/googleplay/android-developer/answer/13628312

## Store listing draft

Short description:

歩きながら、音・位置・景色から自然の手がかりを記録するフィールド観察アプリ

Full description:

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

## Release notes

初回テスト公開。さんぽ、フィールドスキャン、ポケット観測、端末AI対応、位置・音・景色の観察セッション送信に対応しました。

## App category

Primary recommendation: Education.

Alternative: Lifestyle.

Reason: core value is field observation and citizen-science learning, not generic productivity.

## Store assets

- Store icon: `docs/play/assets/store_icon_512.png`
- Store icon verification: 512x512 `Format32bppArgb` PNG, 201,074 bytes, SHA-256 `6BF4F376DDE9CC24AADFF2D4793E57B3D6876330A1BA27D57FB113D87E0B622D`.
- Feature graphic: `docs/play/assets/feature_graphic_1024x500.png`
- Feature graphic verification: 1024x500 `Format24bppRgb` PNG, 51,276 bytes, SHA-256 `F5C2581480A06D7B1F622106B3EAA6CE4044809AC3F87BEA9465B15E0B7CAD78`.
- Screenshots:
  - `docs/play/assets/screenshots/fieldscan_01_home.png` — 1080x1920 `Format24bppRgb`, 168,424 bytes, SHA-256 `65316423546C40D6248D4CA1AE99A2BC2091AE293A5F763EF04D667889961F73`
  - `docs/play/assets/screenshots/fieldscan_02_disclosure.png` — 1080x1920 `Format24bppRgb`, 219,756 bytes, SHA-256 `43F2D6E04BCF915684F785335B13428A7C5D3F4C42A3B99696C2F6525131CA2B`
  - `docs/play/assets/screenshots/fieldscan_03_recording.png` — 1080x1920 `Format24bppRgb`, 107,712 bytes, SHA-256 `E5127E2AD8677A1B51AD0ECC0E0329D8DB70EC82B63FDDEEB48BD974C850ED4D`

Screenshot capture evidence:

- Captured from the actual Android app running in `fieldscan_pixel_9_api35`.
- Debug APK installed successfully on the emulator before capture.
- Emulator screen size was set to 1080x1920 to satisfy Play's screenshot aspect-ratio limit.
- The camera/scan action made the emulator go offline during the fourth capture attempt, so the current submission-ready screenshot set is 3 images, not the 4-image recommendation set.

Official asset requirements checked on 2026-05-17:

- App icon: 32-bit PNG with alpha, 512x512, maximum 1024KB.
- Feature graphic: JPEG or 24-bit PNG without alpha, 1024x500.
- Screenshots: at least 2 screenshots across supported device types, JPEG or 24-bit PNG without alpha, minimum dimension 320px, maximum dimension 3840px, and the long side cannot be more than twice the short side.
- Recommendation eligibility for apps: at least 4 screenshots at minimum 1080px resolution, 16:9 landscape or 9:16 portrait.
- Source: https://support.google.com/googleplay/android-developer/answer/9866151

## App content declarations

### Target audience

Recommended initial answer: 13+ or 16+ depending on Play Console region choices.

Reason: the app uses location, microphone, camera, and background/foreground service behavior. Do not target children until the data minimization and parental-facing disclosure path is designed.

### Ads

Recommended answer: No ads.

### App access

If the app can be used without login for basic scan/session tests, answer no special access required. If login is required for review, provide a reviewer test account.

### Content rating

Expected: general utility/education, but declare user-generated observations if the flow can publish or sync public content through ikimon.life.

## Data safety draft

Use this as the initial Play Console Data safety checklist. Re-check before final submission against the exact shipped binary and privacy policy.

Data collected or transmitted:

- Location: approximate and precise location for observation route, place context, and biodiversity record context.
- Audio: microphone is accessed for natural-sound detection. Raw audio should not be declared as collected if it stays on-device, but detected audio events and derived metadata are collected.
- Photos/videos: camera frames are accessed for scan features. Raw frames should not be declared as collected if they stay on-device, but scene digest and derived metadata are collected.
- App activity: scan sessions, mode, timestamps, upload status, diagnostics.
- Device or other IDs: installation identity or app-generated device/install identifier if used for session continuity.
- Personal info: account identifier or email only if login/user binding is enabled.

Purposes:

- App functionality
- Analytics / quality diagnostics, if server logs or telemetry are used
- Account management, if login/user binding is enabled

Security:

- Data encrypted in transit: yes, release API base uses `https://ikimon.life/api/v1/mobile/field-sessions`.
- Data deletion: must be handled through ikimon.life account/contact flow. Confirm URL before production review.
- Data sharing: no third-party sale. Service providers only if infrastructure/logging/hosting qualifies in the Play form.

Official reference:

- https://support.google.com/googleplay/answer/11416267

## Sensitive permissions

Manifest permissions present in this release:

- `ACCESS_FINE_LOCATION`
- `ACCESS_COARSE_LOCATION`
- `RECORD_AUDIO`
- `CAMERA`
- `FOREGROUND_SERVICE`
- `FOREGROUND_SERVICE_LOCATION`
- `FOREGROUND_SERVICE_MICROPHONE`
- `POST_NOTIFICATIONS`
- `INTERNET`
- `HIGH_SAMPLING_RATE_SENSORS`

Play review posture: the app no longer declares `ACCESS_BACKGROUND_LOCATION`. FieldScan uses user-started foreground services with ongoing notifications for location and microphone work during an active observation session. This keeps the permission surface closer to the current product behavior and avoids asking for always-on background location.

Recommended foreground service declaration:

Pocket and Field observation modes record a user-started field session while the user is walking or observing. Location connects detected natural-sound events and field context to the route of the same session. The app shows an ongoing foreground notification while recording and the user can stop the session from the app.

Video demo requirement:

- 30 seconds or shorter.
- Show the in-app prominent disclosure.
- Show permission runtime prompt.
- Start Field observation mode.
- Show the ongoing notification while recording.
- Return to the app and stop the session.
- Show route/event result.

Prepared evidence assets:

- Foreground service demo video: `docs/play/assets/videos/fieldscan_foreground_service_demo.mp4` — 1080x1920 H.264, 18.006s, 958,084 bytes, SHA-256 `BC8F2094C2074C7D1FC9D2A73764E78DF29CEBB90CD3F788EF3543EA7165329C`.
- Notification evidence screenshot: `docs/play/assets/videos/fieldscan_foreground_notification_evidence.png` — 1080x1920 PNG, 129,636 bytes, SHA-256 `72381A7D05EA5D5EC290C5BC4B7F43D56C198B397D7EFF2C5896A129C3E33EEE`.

Policy references:

- https://support.google.com/googleplay/android-developer/answer/16558241
- https://support.google.com/googleplay/android-developer/answer/9799150

## Prominent disclosure text draft

Use this before requesting location/audio permissions:

いきものフィールドは、観察セッション中に位置情報、マイク、カメラを使います。位置情報は歩いたルートと検出イベントを結びつけるため、マイクは自然音の手がかりを検出するため、カメラはフィールドスキャンの解析に使います。記録中は通知を表示し、通知が出ている間だけセッションを続けます。いつでもアプリから停止できます。映像と音声は端末上の解析を優先し、サーバーには観察の要約と検出イベントを送信します。

## Privacy policy verification

Verified live on 2026-05-17: `https://ikimon.life/ja/privacy` explicitly mentions the Android app and covers:

- foreground-service location during user-started observation sessions
- microphone use for natural-sound detection
- camera use for field scan
- on-device AI processing where available
- derived metadata sent to ikimon.life
- raw media minimization
- account/contact deletion path

Re-check this page immediately before production review if app behavior or declarations change.

## Fastest path to Play

1. Create/verify Play Console developer account.
2. Create app with package `life.ikimon.fieldscan`.
3. Upload AAB to Internal testing.
4. Fill Store listing, Data safety, App content, and Sensitive permissions.
5. Add at least one tester group.
6. Install on Pixel 10 Pro from internal track.
7. Upload the prepared foreground service permission video if Play requires it.
8. Submit to closed/open/production only after privacy policy and declarations match the binary.
