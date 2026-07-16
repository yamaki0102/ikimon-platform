# 連理の木の下で サイエンスアドベンチャー — Security / Privacy Review

更新日: 2026-07-16

状態: **local Node 1335/1335・Worker 265/265 PASS、独立full diff scan完了（正式指摘0件）、staging validationはUNEXECUTED**

この文書はlocal working-tree差分のreview recordである。Codex Securityのthreat model → finding discovery → validation → attack-path analysisを36個のsource-like差分へ実施し、7候補を検証した。6件は修正して再検証し、1件は上限付きの運用制約としてformal findingから除外したため、surviving formal findingsは0件である。ただし、これはproduction安全性やstaging runtimeの合格を意味しない。

以下のlocatorは2026-07-16の未確定worktreeを読んだ時点のもの。scan IDは `ce3d8f70e2fda2be116429d95266a5da2a4abb16_20260716T001859Z`。commit前のcode evidenceをrelease用immutable evidenceとして扱わず、最終SHAとstaging runtimeで再確認する。

local working treeではNode typecheck PASS、全test 1335/1335 PASS、Node build PASS、Worker全test 265/265 PASS、`cloudflare_shadow npm run check` PASS、npm audit 0件を確認した。独立full diff scanでは、終了済みeventへの再check-in、credentialを使うPlaywright trace、匿名rally snapshot、guest→account claim、analytics認可・集計等を検証し、修正後に正式指摘0件となった。ただし対象commit SHAのimmutable CI log、staging negative test、GPS EXIF付き実画像は未実施である。したがってsecurity release resultをPASSへ変更しない。

## 1. Assets and trust boundaries

保護対象は、家族の写真・下書き、未成年者情報、位置、guest credential、account session、event participant mapping、D1/R2 data、analytics/logである。

主な境界:

1. QR/public browser → join/rally/live/recap
2. guest event cookie → participant-scoped mutation/read
3. account session → guest contribution claim
4. browser → observation/upload API
5. original R2 object → public derivative
6. staging fixture operator → prefix限定cleanup
7. event analytics → aggregate dashboard

## 2. Current code-evidence table

`CODE LOCATED` / `TEST LOCATED` は実装箇所を見つけた意味だけで、実行PASSではない。

| Concern | Expected control | Current locator | Current evidence | Final result |
|---|---|---|---|---|
| guest credential | event別opaque credential、HttpOnly/Secure/SameSite、DBはdigest | `platform_v2/cloudflare_shadow/src/index.ts`; `platform_v2/src/services/observationEventGuestCredential.ts` | LOCAL PASS | **STAGING UNVERIFIED** |
| URL/token leakage | URL、public HTML/API、local storageへcredentialを出さない | event join/live/rally/recap implementation and tests | LOCAL PASS | **STAGING UNVERIFIED** |
| session fixation/claim | account login時に同じguest contributionを安全にclaimし重複participantを作らない | Worker/Node event participant claim code | LOCAL PASS（transactional merge） | **STAGING UNVERIFIED** |
| CSRF/same-origin | participant mutationをsame-originで拒否 | Worker event mutations; `platform_v2/src/routes/observationEventApi.ts` | LOCAL PASS | **STAGING UNVERIFIED** |
| IDOR | cookie/accountからsession participantを解決しbody tokenを信頼しない | event actor resolution code | LOCAL PASS | **STAGING UNVERIFIED** |
| minor location | default OFF、minor+share時だけserver-side guardian consent | join/check-in code and integration tests | LOCAL PASS | **STAGING UNVERIFIED** |
| exact location | public payloadにexact coordinateを出さず、share期限をserver決定 | event live/rally/recap code and privacy tests | LOCAL PASS | **STAGING UNVERIFIED** |
| XSS/escaping/CSP | HTML/JSON escaping、nonce付きCSP、inline dataを直接scriptへ埋めない | Worker page renderer and tests | LOCAL PASS | **STAGING UNVERIFIED** |
| redirect validation | event/auth return先をsame-origin allowlistへ限定 | auth/event page routes and tests | LOCAL PASS | **STAGING UNVERIFIED** |
| EXIF/GPS | public derivative bytesからEXIF/GPS除去、private originalを公開しない | Worker asset derivative path; `platform_v2/cloudflare_shadow/src/index.test.ts` | LOCAL CONTRACT PASS、実画像未実施 | **STAGING UNVERIFIED** |
| upload MIME/size | declared typeだけでなくbytes、size、countをserver検証 | observation photo upload path and tests | LOCAL PASS | **STAGING UNVERIFIED** |
| rate limit/replay | event/session/user scope、idempotency、retry storm防止 | check-in/observation/load paths | LOCAL PASS、loadはdry-runのみ | **STAGING UNVERIFIED** |
| logs / retained traces | credential、メール、座標、filename、自由文を出さない | logging paths; credential-bearing E2E `trace: "off"` contract | LOCAL PASS | **STAGING UNVERIFIED** |
| analytics privacy | 16 allowlist event、禁止property、認証前write拒否 | analytics dashboard; Worker analytics route/tests | LOCAL PASS | **STAGING UNVERIFIED** |
| fixture cleanup | staging限定、`renri-e2e-*` prefix限定、production拒否 | `platform_v2/src/services/stagingFixtureGuard.ts`; load runner | LOCAL PASS | **STAGING UNVERIFIED** |
| accessibility | keyboard、label、contrast、200%、touch、error表現 | event UI + Visual QA matrix | runtime未実施 | **UNVERIFIED** |

## 3. Required negative tests

| ID | Attack / misuse | Expected | Result |
|---|---|---|---|
| SEC01 | body/queryへ他guest token注入 | 無視または拒否、他家族dataなし | **LOCAL OBSERVED / STAGING UNEXECUTED** |
| SEC02 | guest cookieを別eventへ再利用 | participant解決不可 | **LOCAL OBSERVED / STAGING UNEXECUTED** |
| SEC03 | cross-site mutation | 403、DB write 0 | **LOCAL OBSERVED / STAGING UNEXECUTED** |
| SEC04 | cookieなしcheck-in | fail-closed、任意token発行なし | **LOCAL OBSERVED / STAGING UNEXECUTED** |
| SEC05 | minor+location+guardian false/string spoof | 400、位置保存0 | **LOCAL OBSERVED / STAGING UNEXECUTED** |
| SEC06 | HTML/JSON payload in family/team/note | script実行なし、escaped表示 | **LOCAL OBSERVED / STAGING UNEXECUTED** |
| SEC07 | redirect external origin / javascript scheme | rejectまたはsafe default | **LOCAL OBSERVED / STAGING UNEXECUTED** |
| SEC08 | MIME spoof / oversized / excessive files | server reject、R2/D1 orphanなし | **LOCAL OBSERVED / STAGING UNEXECUTED** |
| SEC09 | GPS EXIF付きJPEG | public WebP bytes/metadataにEXIF/GPSなし | **LOCAL CONTRACT OBSERVED / STAGING実画像UNEXECUTED** |
| SEC10 | exact location public API/live/recap/rally | exact coordinateなし、匿名rally snapshot拒否 | **LOCAL OBSERVED / STAGING UNEXECUTED** |
| SEC11 | cleanup request in production | fail-closed | **LOCAL OBSERVED / STAGING UNEXECUTED** |
| SEC12 | prefix外または空prefix cleanup | reject、0 mutation | **LOCAL OBSERVED / STAGING UNEXECUTED** |
| SEC13 | repeated submit/replay / 終了後check-in | one participant/observation/live event、終了後write 0 | **LOCAL OBSERVED / STAGING UNEXECUTED** |
| SEC14 | analytics payload inspection | forbidden data 0、未認証write 0 | **LOCAL OBSERVED / STAGING UNEXECUTED** |

## 4. Finding register

| ID | Severity | Finding | Evidence | Owner | State |
|---|---|---|---|---|---|
| SR-001 | P1 | 16 analytics eventのinstrumentation/runtime locator未確認 | analytics spec §6 + Worker route/tests | Codex | Closed / local source+test |
| SR-002 | P1 | GPS EXIF付き実画像のstaging R2/D1/public derivative確認未実施 | SEC09 | 未割当 | Open / execution gap |
| SR-003 | P1 | staging negative tests・runtime validation未実施 | SEC01–SEC14 | 未割当 | Open / execution gap |
| SR-004 | High | 匿名利用者がrally snapshotと内部session情報を取得できた | full diff scan candidate `event-rally-snapshot-unauth-disclosure-001` | Codex | Fixed / participant-or-organizer gate、response最小化、再検証済み |
| SR-005 | Medium | 終了済みeventで新規check-in・guest cookie発行が可能だった | full diff scan candidate `node-event-postclose-reenroll-001` | Codex | Fixed / 409またはrecap redirect、再検証済み |
| SR-006 | Low | credential-bearing Playwright specがtraceへkey/cookieを保持し得た | full diff scan candidate `node-guest-trace-001` | Codex | Fixed / `trace: "off"`、static contract・13 test discoveryで再検証済み |

gapは脆弱性の存在を断定しないが、GOに必要な証拠が欠けているため閉じるまでPASSにしない。

## 5. Review sign-off

| Field | Value |
|---|---|
| reviewed SHA | working-tree diff against `ce3d8f70e2fda2be116429d95266a5da2a4abb16`。最終commit SHAはPRで固定 |
| implementation reviewer | Codex / Ai |
| independent reviewer | Codex Security multi-agent diff scan（scan ID `ce3d8f70e2fda2be116429d95266a5da2a4abb16_20260716T001859Z`） |
| automated security commands | local Node 1335/1335・Worker 265/265・Node typecheck/build・`cloudflare_shadow npm run check` PASS、Node/Worker npm audit 0、full diff scan 36/36 files reviewed・7 candidates validated・0 surviving formal findings |
| staging evidence | 未記入 / UNEXECUTED |
| open P0 | source diff formal finding 0件。release全体ではproduction公開QA event残存が別gateのP0 |
| open P1 | source diff formal finding 0件。staging EXIF/negative/runtime証跡はexecution gapとして未解消 |
| decision | **SOURCE DIFF REVIEW COMPLETE / NOT READY FOR RELEASE SECURITY SIGN-OFF** |

credential、正確な位置、他家族dataの露出を1件でも確認した場合は、詳細値を文書へ貼らず、画面を閉じ、`renri_science_adventure_2026-07-19_fallback_card.md` のFallback 3とincident evidence保全へ移る。
