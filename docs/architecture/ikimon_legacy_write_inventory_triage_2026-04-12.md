# ikimon Legacy Write Inventory Triage

更新日: 2026-04-12  
目的: `check_legacy_write_inventory.ps1` の `unknownCandidates=78` を、そのまま backlog にせず `P0 / P1 / P2` に圧縮する。

---

## 1. 現在地

初回実行結果:

- `missingKnownFiles=0`
- `unknownCandidates=78`

これは「inventory が壊れている」のではなく、`write candidate` が broad に拾われていて、まだ棚卸し境界が粗い状態を意味する。

---

## 2. Triage Rule

### P0

cutover / dual-write / rollback safety に直接効くもの。  
次の inventory 更新で必ず拾う。

- auth continuity
- user-facing create/update
- invite / business workspace side effect
- track / passive / asset upload

### P1

運用には効くが、cutover 当日の rollback safety を直撃しないもの。  
Gate 1 を閉じた後に整理する。

- queue / notification / moderation
- report generation / survey outputs
- recommendation / analytics raw
- cache / export helper

### P2

inventory の対象外か、manifest pattern が broad すぎて拾っているもの。  
ignore 候補。

- logger / diagnostics
- export-only file generation
- temporary cache / derived artifact
- directory creation helper

---

## 3. P0 Candidates

次のラリーで inventory へ反映する価値が高い。

### 3.1 Auth / user continuity

- `upload_package/libs/AppOAuthStateStore.php`
- `upload_package/libs/AuthBridge.php`
- `upload_package/public_html/api/push_subscribe.php`

### 3.2 Business / invite / user-facing side effects

- `upload_package/libs/AdminAlertManager.php`
- `upload_package/libs/AffiliateManager.php`
- `upload_package/public_html/api/affiliate/admin.php`
- `upload_package/public_html/api/feedback.php`

### 3.3 Observation-adjacent or capture-adjacent writes

- `upload_package/public_html/api/v2/sound_archive_identify.php`
- `upload_package/public_html/api/v2/sound_archive_report.php`
- `upload_package/public_html/api/v2/audio_batch_callback.php`
- `upload_package/public_html/api/v2/audio_batch_submit.php`
- `upload_package/public_html/api/v2/analyze_audio_perch.php`
- `upload_package/public_html/api/v2/voice_guide.php`

### 3.4 Track / event / site continuity

- `upload_package/public_html/api/save_site.php`
- `upload_package/public_html/api/save_snapshot.php`
- `upload_package/public_html/api/report_content.php`
- `upload_package/public_html/api/report_surveyor.php`

---

## 4. P1 Candidates

後追いでよいが inventory か boundary doc に寄せる候補。

- `AiAssessmentQueue.php`
- `AiBudgetGuard.php`
- `EmbeddingQueue.php`
- `ObservationRecalcQueue.php`
- `SurveyRequestManager.php`
- `Notification.php`
- `Moderation.php`
- `submit_nps.php`
- `save_analytics.php`
- `generate_bingo_template.php`

---

## 5. P2 / Ignore Candidates

manifest から除外してよい可能性が高い。

- `Logger.php`
- `EventLog.php`
- `Cache.php`
- `export_*.php`
- `DwcExportAdapter.php`
- `Index*.php`
- `mkdir` だけを拾っている helper

補足:

- `file_put_contents` でも export-only なら rollback safety の inventory 主語ではない
- `mkdir` は write target でなく path prep のことが多い

---

## 6. Next Action

Gate 1 を閉じる最短順はこれ。

1. P0 を inventory へ追加
2. P2 を manifest ignore へ落とす
3. 再実行して `unknownCandidates` を 20 件未満に圧縮
4. その残りだけ手動判断

この順なら Gate 1 を `運用で回る inventory` に持っていける。
