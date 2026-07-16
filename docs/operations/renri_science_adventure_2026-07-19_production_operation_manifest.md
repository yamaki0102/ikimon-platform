# 連理の木の下で サイエンスアドベンチャー — Production Operation Manifest

更新日: 2026-07-16

状態: **DRAFT / NOT APPROVED / NOT EXECUTED**

この文書はGO判定後の再現可能な操作packetであり、production deploy、production event作成、D1/R2変更、migration、secret、DNS、参加者data操作を承認しない。本タスクではproductionへ一切実行しない。

## 1. Immutable operation scope

| Field | Planned value | Gate |
|---|---|---|
| repository | `yamaki0102/ikimon-platform` | fixed |
| branch | `main` | protected branchのみ |
| exact 40-char SHA | `<APPROVED_40_CHAR_SHA>` | PR merge・staging evidence後に固定 |
| event title | `連理の木の下で サイエンスアドベンチャー ブルーベリー狩り` | canonicalと照合 |
| event code | `RENRI0719` | **proposed**。production重複確認前は未確定 |
| participant start | `2026-07-19T11:10:00+09:00` / `2026-07-19T02:10:00Z` | fixed |
| participant end | `2026-07-19T13:00:00+09:00` / `2026-07-19T04:00:00Z` | fixed |
| parent field | existing `連理の木の下で` field | field ID/revision/hash未確定 |
| plan / mode | `community` / `discovery` | active modesは`discovery`,`rally` |
| migration | none planned | production migrationは別承認でも本packet外 |

13:00–13:40の運営振り返り・撤収はparticipant endへ設定しない。

## 2. Current control-plane conflict — hard blocker

2026-07-16のread-only lookupでは、中央registryは`github-actions-cloudflare`を返す一方、repositoryの`docs/DEPLOYMENT.md`と`ops/deploy/deploy_manifest.json`はCloudflare command bus / Sandbox Executorを正規経路としている。GitHub Actionsをexecution backendへ戻すことは禁止されているため、次のlookupがcommand busを現行方式として一致して返すまでproduction issueを発行しない。

```powershell
php E:\Projects\00_all_projects_management\scripts\get_service_deploy_method.php ikimon-life
git show <APPROVED_40_CHAR_SHA>:ops/deploy/deploy_manifest.json
git show <APPROVED_40_CHAR_SHA>:docs/DEPLOYMENT.md
```

期待: control plane、repository manifest、中央registryが同一のcommand bus entrypoint、actions、approval boundaryを示す。locator不達、古い確認日、`visual_qa`/`rollback` action不一致もstop条件。

## 3. Approval records

| Approval ID | Exact scope | Required phrase / locator | State |
|---|---|---|---|
| AP-PROD-DEPLOY | exact SHAをproduction Workerへdeployしverify | `<APPROVE_RENRI_PRODUCTION_DEPLOY_SHA_40CHAR>` + approval record URL | **NOT REQUESTED** |
| AP-EVENT-CREATE | productionにcode `RENRI0719`を1件作成 | `<APPROVE_RENRI_EVENT_CREATE_RENRI0719>` + approver/time | **NOT REQUESTED** |
| AP-QR-FREEZE | verified join URLを3印刷物へ固定 | `<APPROVE_RENRI_QR_MASTER>` + QR checksum | **NOT REQUESTED** |
| AP-ROLLBACK | known-good SHAへのproduction rollback | `<APPROVE_RENRI_PRODUCTION_ROLLBACK_SHA_40CHAR>` | **NOT REQUESTED** |

承認はSHA、environment、action、期限を含む。staging GO、PR approval、event GO票をproduction承認へ読み替えない。

## 4. Preflight — read-only

```powershell
git fetch origin main
git merge-base --is-ancestor <APPROVED_40_CHAR_SHA> origin/main
git show -s --format=%H <APPROVED_40_CHAR_SHA>
gh pr view <PR_NUMBER> --repo yamaki0102/ikimon-platform --json state,mergeCommit,headRefOid,statusCheckRollup,url
gh issue view <STAGING_DRY_RUN_ISSUE> --repo yamaki0102/all-projects-management --json body,labels,state,url
gh issue view <STAGING_DEPLOY_ISSUE> --repo yamaki0102/all-projects-management --json body,labels,state,url
gh issue view <STAGING_VERIFY_ISSUE> --repo yamaki0102/all-projects-management --json body,labels,state,url
gh issue view <STAGING_VISUAL_QA_ISSUE> --repo yamaki0102/all-projects-management --json body,labels,state,url
```

4件のstaging issue body、PR head、runtime、Evidence Bundleが同じ40文字SHAでない場合は停止する。fixture inventory 0、P0/P1 0、iPhone/Android、人間Round 2が未実施ならGO票の規則へ戻す。

## 5. Production deploy command packet — do not execute now

command bus bodyは、実行時点の中央schemaでvalidationする。次のplaceholderをrepo外の`<APPROVED_PACKET_PATH>\production-deploy.md`へ材料化し、30分nonceを含む承認後だけissueを作る。issue body fileではJSONを`json` fenced code blockで囲み、既存command bus Issueと同じ形式にする。

````text
```json
{
  "schema": "ikimon.ops-command/v1",
  "project_id": "ikimon-life",
  "repository": "yamaki0102/ikimon-platform",
  "action": "deploy",
  "environment": "production",
  "commit_sha": "<APPROVED_40_CHAR_SHA>",
  "requested_by": "yamaki0102",
  "request_id": "<UUID>",
  "approval_nonce": "<30_MINUTE_PRODUCTION_NONCE>",
  "approval_locator": "<AP-PROD-DEPLOY_URL>"
}
```
````

```powershell
gh issue create --repo yamaki0102/all-projects-management `
  --title "ops: deploy ikimon-life production <SHA8>" `
  --label "ops:command" `
  --body-file "<APPROVED_PACKET_PATH>\production-deploy.md"
```

Issue作成後はdirect deploy、GitHub Actions、SSHへ迂回しない。terminal success、runtime exact SHA、health/ready、evidence locatorを記録する。schemaが`approval_nonce`等を受理しない場合は推測でfieldを削らず停止し、現行command bus schemaを正本へ反映する。

## 6. Parent field locator — read-only

production event作成前に、既存fieldを検索し、新設や重複を行わない。

```powershell
curl.exe --fail-with-body --get "https://ikimon.life/api/v1/fields" `
  --data-urlencode "q=連理の木の下で" `
  --data-urlencode "limit=24" `
  --output "<EVIDENCE_PATH>\parent-field-search.json"
curl.exe --fail-with-body --output "<EVIDENCE_PATH>\parent-field.json" `
  "https://ikimon.life/api/v1/fields/<VERIFIED_EXISTING_PARENT_FIELD_ID>"
curl.exe --fail-with-body --output "<EVIDENCE_PATH>\parent-field-area-snapshot.json" `
  "https://ikimon.life/api/v1/fields/<VERIFIED_EXISTING_PARENT_FIELD_ID>/area-snapshot"
```

人間が公開名、field ID、親子関係、area revision、geometry hashを元資料と照合する。候補が0件または複数件、revision/hash不明の場合はeventを作らない。

| Field evidence | Value |
|---|---|
| search response SHA-256 | 未記入 |
| selected field ID | 未確定 |
| exact public name | 未確認 |
| area revision | 未確認 |
| geometry hash | 未確認 |
| human verifier / JST | 未記入 |

## 7. Event-code uniqueness — read-only

作成前の期待は404、作成後の期待は1件だけである。

```powershell
curl.exe --silent --show-error --output "<EVIDENCE_PATH>\event-code-before.json" `
  --write-out "%{http_code}" `
  "https://ikimon.life/api/v1/observation-events/by-code/RENRI0719"
```

200または曖昧なresponseなら作成を停止し、既存sessionのowner・time・fieldを確認する。削除、上書き、再利用を推測で行わない。

## 8. Production event creation — separately approved, do not execute now

`<APPROVED_PACKET_PATH>\renri0719-event-create.json` の内容:

```json
{
  "event_code": "RENRI0719",
  "title": "連理の木の下で サイエンスアドベンチャー ブルーベリー狩り",
  "started_at": "2026-07-19T02:10:00Z",
  "ended_at": "2026-07-19T04:00:00Z",
  "field_id": "<VERIFIED_EXISTING_PARENT_FIELD_ID>",
  "plan": "community",
  "primary_mode": "discovery",
  "active_modes": ["discovery", "rally"],
  "target_species": [],
  "config": {
    "event_slug": "renri-science-adventure-blueberry",
    "participant_time_zone": "Asia/Tokyo",
    "participant_window": "11:10-13:00"
  }
}
```

実行command。cookie fileはrepo/Evidence Bundle外のprivate pathを使い、値を表示しない。

```powershell
curl.exe --fail-with-body --request POST "https://ikimon.life/api/v1/observation-events" `
  --header "Origin: https://ikimon.life" `
  --header "Content-Type: application/json" `
  --cookie "<PRIVATE_AUTH_COOKIE_FILE>" `
  --data-binary "@<APPROVED_PACKET_PATH>\renri0719-event-create.json" `
  --output "<EVIDENCE_PATH>\event-create-response.json"
```

responseにはcredentialを含めず、session ID、event code、field ID、start/endだけをredacted evidenceへ転記する。同じcommandをretryする前にby-codeを再確認し、二重sessionを作らない。

## 9. URL / QR materialization

event作成responseで`<SESSION_ID>`を確定する。

| Use | Final pattern |
|---|---|
| main QR / join | `https://ikimon.life/community/events/RENRI0719/join` |
| rally | `https://ikimon.life/events/<SESSION_ID>/rally` |
| live | `https://ikimon.life/events/<SESSION_ID>/live` |
| recap | `https://ikimon.life/events/<SESSION_ID>/recap` |

query、guest credential、user ID、座標を付けない。QR assetと印刷物は`renri_science_adventure_2026-07-19_qr_print_locator.md`でfreezeする。

## 10. Verify and rollback boundary

- post-deploy read-only checks: `renri_science_adventure_2026-07-19_post_deploy_verification.md`
- production event/QR verification: 同文書のevent section
- operational fallback: `renri_science_adventure_2026-07-19_fallback_card.md`
- software/data rollback: `renri_science_adventure_2026-07-19_risk_rollback.md`

rollbackも別のL4承認が必要。known-good SHA、current SHA、data compatibility、command bus supportが揃うまで`rollback` issueを作らない。event rowや参加者dataをrollbackの名目で削除・編集しない。

承認済みrollback issue body template:

````text
```json
{
  "schema": "ikimon.ops-command/v1",
  "project_id": "ikimon-life",
  "repository": "yamaki0102/ikimon-platform",
  "action": "rollback",
  "environment": "production",
  "commit_sha": "<APPROVED_LAST_KNOWN_GOOD_40_CHAR_SHA>",
  "requested_by": "yamaki0102",
  "request_id": "<UUID>",
  "approval_nonce": "<30_MINUTE_ROLLBACK_NONCE>",
  "approval_locator": "<AP-ROLLBACK_URL>"
}
```
````

```powershell
gh issue create --repo yamaki0102/all-projects-management `
  --title "ops: rollback ikimon-life production <KNOWN_GOOD_SHA8>" `
  --label "ops:command" `
  --body-file "<APPROVED_PACKET_PATH>\production-rollback.md"
```

rollback後も`renri_science_adventure_2026-07-19_post_deploy_verification.md`を実行し、event/session dataを自動で戻ったと仮定しない。schemaやrollback supportが現行registryと一致しない場合はissueを作らず、Fallback 2/3でイベント体験を継続する。

## 11. Execution record

| Operation | Status | Issue / Evidence |
|---|---|---|
| production deploy | **NOT EXECUTED** | |
| production verify | **NOT EXECUTED** | |
| parent field selection | **NOT EXECUTED** | |
| event-code uniqueness | **NOT EXECUTED** | |
| production event create | **NOT EXECUTED** | |
| QR freeze / print | **NOT EXECUTED** | |
| migration | **NOT PLANNED / NOT EXECUTED** | |
| rollback | **NOT EXECUTED** | |
