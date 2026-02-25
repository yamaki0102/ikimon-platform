$key = "$env:USERPROFILE\.ssh\production.pem"
$dest = "r1522484@www1070.onamae.ne.jp"
$port = "8022"
$root = "~/public_html/ikimon.life/public_html"
$src = "G:/その他のパソコン/マイ ノートパソコン/antigravity/ikimon/ikimon.life/upload_package/public_html"
$ok = 0; $fail = 0
scp -P $port -i $key "$src/403.php" "${dest}:${root}/403.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /403.php" }
scp -P $port -i $key "$src/404.php" "${dest}:${root}/404.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /404.php" }
scp -P $port -i $key "$src/about.php" "${dest}:${root}/about.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /about.php" }
scp -P $port -i $key "$src/admin/components/head.php" "${dest}:${root}/admin/components/head.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /admin/components/head.php" }
scp -P $port -i $key "$src/admin/corporate.php" "${dest}:${root}/admin/corporate.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /admin/corporate.php" }
scp -P $port -i $key "$src/admin/index.php" "${dest}:${root}/admin/index.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /admin/index.php" }
scp -P $port -i $key "$src/admin/moderation.php" "${dest}:${root}/admin/moderation.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /admin/moderation.php" }
scp -P $port -i $key "$src/admin/observations.php" "${dest}:${root}/admin/observations.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /admin/observations.php" }
scp -P $port -i $key "$src/admin/users.php" "${dest}:${root}/admin/users.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /admin/users.php" }
scp -P $port -i $key "$src/admin/verification.php" "${dest}:${root}/admin/verification.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /admin/verification.php" }
scp -P $port -i $key "$src/compass.php" "${dest}:${root}/compass.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /compass.php" }
scp -P $port -i $key "$src/components/badge_notification.php" "${dest}:${root}/components/badge_notification.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /components/badge_notification.php" }
scp -P $port -i $key "$src/components/bg_radar.php" "${dest}:${root}/components/bg_radar.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /components/bg_radar.php" }
scp -P $port -i $key "$src/components/cookie_consent.php" "${dest}:${root}/components/cookie_consent.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /components/cookie_consent.php" }
scp -P $port -i $key "$src/components/meta.php" "${dest}:${root}/components/meta.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /components/meta.php" }
scp -P $port -i $key "$src/components/nav.php" "${dest}:${root}/components/nav.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /components/nav.php" }
scp -P $port -i $key "$src/components/nps_survey.php" "${dest}:${root}/components/nps_survey.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /components/nps_survey.php" }
scp -P $port -i $key "$src/components/onboarding.php" "${dest}:${root}/components/onboarding.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /components/onboarding.php" }
scp -P $port -i $key "$src/components/quick_identify.php" "${dest}:${root}/components/quick_identify.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /components/quick_identify.php" }
scp -P $port -i $key "$src/components/regional_completion.php" "${dest}:${root}/components/regional_completion.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /components/regional_completion.php" }
scp -P $port -i $key "$src/components/ui_feedback.php" "${dest}:${root}/components/ui_feedback.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /components/ui_feedback.php" }
scp -P $port -i $key "$src/corporate_dashboard.php" "${dest}:${root}/corporate_dashboard.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /corporate_dashboard.php" }
scp -P $port -i $key "$src/create_event.php" "${dest}:${root}/create_event.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /create_event.php" }
scp -P $port -i $key "$src/csr_showcase.php" "${dest}:${root}/csr_showcase.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /csr_showcase.php" }
scp -P $port -i $key "$src/dashboard.php" "${dest}:${root}/dashboard.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /dashboard.php" }
scp -P $port -i $key "$src/demo/index.php" "${dest}:${root}/demo/index.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /demo/index.php" }
scp -P $port -i $key "$src/edit_event.php" "${dest}:${root}/edit_event.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /edit_event.php" }
scp -P $port -i $key "$src/event_detail.php" "${dest}:${root}/event_detail.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /event_detail.php" }
scp -P $port -i $key "$src/events.php" "${dest}:${root}/events.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /events.php" }
scp -P $port -i $key "$src/explore.php" "${dest}:${root}/explore.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /explore.php" }
scp -P $port -i $key "$src/faq.php" "${dest}:${root}/faq.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /faq.php" }
scp -P $port -i $key "$src/field_research.php" "${dest}:${root}/field_research.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /field_research.php" }
scp -P $port -i $key "$src/for-business.php" "${dest}:${root}/for-business.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /for-business.php" }
scp -P $port -i $key "$src/for-citizen.php" "${dest}:${root}/for-citizen.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /for-citizen.php" }
scp -P $port -i $key "$src/for-researcher.php" "${dest}:${root}/for-researcher.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /for-researcher.php" }
scp -P $port -i $key "$src/guidelines.php" "${dest}:${root}/guidelines.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /guidelines.php" }
scp -P $port -i $key "$src/id_center.php" "${dest}:${root}/id_center.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /id_center.php" }
scp -P $port -i $key "$src/id_form.php" "${dest}:${root}/id_form.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /id_form.php" }
scp -P $port -i $key "$src/id_wizard.php" "${dest}:${root}/id_wizard.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /id_wizard.php" }
scp -P $port -i $key "$src/id_workbench.php" "${dest}:${root}/id_workbench.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /id_workbench.php" }
scp -P $port -i $key "$src/index.php" "${dest}:${root}/index.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /index.php" }
scp -P $port -i $key "$src/map.php" "${dest}:${root}/map.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /map.php" }
scp -P $port -i $key "$src/my_field_dashboard.php" "${dest}:${root}/my_field_dashboard.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /my_field_dashboard.php" }
scp -P $port -i $key "$src/my_organisms.php" "${dest}:${root}/my_organisms.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /my_organisms.php" }
scp -P $port -i $key "$src/observation_detail.php" "${dest}:${root}/observation_detail.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /observation_detail.php" }
scp -P $port -i $key "$src/offline.php" "${dest}:${root}/offline.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /offline.php" }
scp -P $port -i $key "$src/post.php" "${dest}:${root}/post.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /post.php" }
scp -P $port -i $key "$src/privacy.php" "${dest}:${root}/privacy.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /privacy.php" }
scp -P $port -i $key "$src/profile.php" "${dest}:${root}/profile.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /profile.php" }
scp -P $port -i $key "$src/profile_edit.php" "${dest}:${root}/profile_edit.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /profile_edit.php" }
scp -P $port -i $key "$src/review_queue.php" "${dest}:${root}/review_queue.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /review_queue.php" }
scp -P $port -i $key "$src/showcase.php" "${dest}:${root}/showcase.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /showcase.php" }
scp -P $port -i $key "$src/site_dashboard.php" "${dest}:${root}/site_dashboard.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /site_dashboard.php" }
scp -P $port -i $key "$src/site_editor.php" "${dest}:${root}/site_editor.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /site_editor.php" }
scp -P $port -i $key "$src/species.php" "${dest}:${root}/species.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /species.php" }
scp -P $port -i $key "$src/survey.php" "${dest}:${root}/survey.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /survey.php" }
scp -P $port -i $key "$src/team.php" "${dest}:${root}/team.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /team.php" }
scp -P $port -i $key "$src/terms.php" "${dest}:${root}/terms.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /terms.php" }
scp -P $port -i $key "$src/updates.php" "${dest}:${root}/updates.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /updates.php" }
scp -P $port -i $key "$src/views/dashboard_events.php" "${dest}:${root}/views/dashboard_events.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /views/dashboard_events.php" }
scp -P $port -i $key "$src/views/dashboard_map_3d.php" "${dest}:${root}/views/dashboard_map_3d.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /views/dashboard_map_3d.php" }
scp -P $port -i $key "$src/views/dashboard_overview.php" "${dest}:${root}/views/dashboard_overview.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /views/dashboard_overview.php" }
scp -P $port -i $key "$src/views/dashboard_reports.php" "${dest}:${root}/views/dashboard_reports.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /views/dashboard_reports.php" }
scp -P $port -i $key "$src/views/dashboard_settings.php" "${dest}:${root}/views/dashboard_settings.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /views/dashboard_settings.php" }
scp -P $port -i $key "$src/wellness.php" "${dest}:${root}/wellness.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /wellness.php" }
scp -P $port -i $key "$src/zukan.php" "${dest}:${root}/zukan.php" 2>&1 | Out-Null; if($?) { $ok++ } else { $fail++; Write-Host "FAIL: /zukan.php" }
Write-Host "--- SCP DONE: OK=$ok FAIL=$fail ---"
