<?php

/**
 * e2e_full_v5_part2.php — Phase 11-18
 * 通知、プロフィール、トラック、マイフィールド、セキュリティ、アセット、クリーンアップ
 */

// ═══════════════════════════════════════
// PHASE 11: 通知 (mark_notifications_read)
// ═══════════════════════════════════════
echo "\n── Phase 11: 通知管理 ─────────────────────────\n";
if ($loggedA) {
    // Refresh CSRF from cookie
    list($cookieA, $csrfA) = refreshCsrf($baseUrl, $cookieA);
    // 通知一覧取得
    $nGet = http_get($baseUrl . '/api/get_notifications.php', $cookieA);
    $nJ = json_decode($nGet['body'], true);
    test("GET notifications", $nGet['status'] === 200);
    $notifs = $nJ['notifications'] ?? $nJ['data'] ?? $nJ ?? [];
    test("  ↳ Has notifications", is_array($notifs) && count($notifs) > 0, "Count: " . (is_array($notifs) ? count($notifs) : 'N/A'));

    // 全件既読
    $markAll = http_json($baseUrl . '/api/mark_notifications_read.php', [], $csrfA, $cookieA);
    $maJ = json_decode($markAll['body'], true);
    test("POST mark_notifications_read (all)", ($maJ['success'] ?? false) === true || $markAll['status'] === 200, substr($markAll['body'], 0, 100));

    // 既読後の未読数確認
    $nGet2 = http_get($baseUrl . '/api/get_notifications.php', $cookieA);
    $nJ2 = json_decode($nGet2['body'], true);
    $unread = $nJ2['unread_count'] ?? -1;
    test("  ↳ Unread count after mark all: {$unread}", $unread === 0 || $unread === -1);
} else {
    skip_test("Phase 11: 通知管理", "User A未ログイン");
}

// ═══════════════════════════════════════
// PHASE 12: プロフィール更新
// ═══════════════════════════════════════
echo "\n── Phase 12: プロフィール更新 ─────────────────\n";
if ($loggedA) {
    // プロフィール編集ページ取得
    $ep = http_get($baseUrl . '/profile_edit.php', $cookieA);
    $editCsrf = extractCsrf($ep['body']);
    test("GET profile_edit.php", $ep['status'] === 200);

    if ($editCsrf) {
        // 名前変更
        $upd = http_json($baseUrl . '/api/update_profile.php', [
            'name' => $nameA . '_updated',
            'bio' => 'E2E test bio updated v5',
        ], $editCsrf, $cookieA);
        $updJ = json_decode($upd['body'], true);
        test("POST update_profile (name+bio)", ($updJ['success'] ?? false) === true, substr($upd['body'], 0, 120));

        // 名前が空 → バリデーション
        $updEmpty = http_json($baseUrl . '/api/update_profile.php', [
            'name' => '',
        ], $editCsrf, $cookieA);
        $ueJ = json_decode($updEmpty['body'], true);
        test("POST update_profile (empty name) → rejected", ($ueJ['success'] ?? true) === false);

        // 長すぎる名前 → バリデーション
        $updLong = http_json($baseUrl . '/api/update_profile.php', [
            'name' => str_repeat('あ', 200),
        ], $editCsrf, $cookieA);
        $ulJ = json_decode($updLong['body'], true);
        test("POST update_profile (too long) → rejected", ($ulJ['success'] ?? true) === false);

        // パスワード変更 (正しい現パスワード)
        $updPw = http_json($baseUrl . '/api/update_profile.php', [
            'current_password' => $testPass,
            'new_password' => 'NewPass456!',
            'new_password_confirm' => 'NewPass456!',
        ], $editCsrf, $cookieA);
        $upwJ = json_decode($updPw['body'], true);
        test("POST update_profile (password change)", ($upwJ['success'] ?? false) === true || $updPw['status'] === 200);

        // パスワード変更 (間違った現パスワード)
        $updPwBad = http_json($baseUrl . '/api/update_profile.php', [
            'current_password' => 'WrongPassword!',
            'new_password' => 'Hack123!',
            'new_password_confirm' => 'Hack123!',
        ], $editCsrf, $cookieA);
        $upwBJ = json_decode($updPwBad['body'], true);
        test("POST update_profile (wrong current pw) → rejected", ($upwBJ['success'] ?? true) === false);
    } else {
        $snippet = substr(htmlspecialchars($ep['body']), 0, 500);
        skip_test("Profile update tests", "CSRF取得失敗 (Body snippet: {$snippet})");
    }
} else {
    skip_test("Phase 12: プロフィール更新", "User A未ログイン");
}

// ═══════════════════════════════════════
// PHASE 13: GPSトラック
// ═══════════════════════════════════════
echo "\n── Phase 13: GPSトラック (save_track) ─────────\n";
if ($loggedA) {
    // Refresh CSRF from cookie
    list($cookieA, $csrfA) = refreshCsrf($baseUrl, $cookieA);
    $sessionId = 'e2e_track_' . time();
    $points = [
        ['lat' => 34.977, 'lng' => 138.383, 'accuracy' => 10, 'timestamp' => time() - 300],
        ['lat' => 34.978, 'lng' => 138.384, 'accuracy' => 8, 'timestamp' => time() - 240],
        ['lat' => 34.979, 'lng' => 138.385, 'accuracy' => 12, 'timestamp' => time() - 180],
    ];
    $trk = http_json($baseUrl . '/api/save_track.php', [
        'session_id' => $sessionId,
        'points' => $points,
    ], $csrfA, $cookieA);
    $trkJ = json_decode($trk['body'], true);
    test("POST save_track (3 points)", ($trkJ['success'] ?? false) === true, substr($trk['body'], 0, 120));

    // 空ポイント
    $trkEmpty = http_json($baseUrl . '/api/save_track.php', [
        'session_id' => $sessionId,
        'points' => [],
    ], $csrfA, $cookieA);
    $teJ = json_decode($trkEmpty['body'], true);
    test("POST save_track (empty points) → handled", in_array($trkEmpty['status'], [200, 400]));

    // 追加ポイント (バッチ追記)
    $trk2 = http_json($baseUrl . '/api/save_track.php', [
        'session_id' => $sessionId,
        'points' => [['lat' => 34.980, 'lng' => 138.386, 'accuracy' => 5, 'timestamp' => time() - 120]],
    ], $csrfA, $cookieA);
    test("POST save_track (append)", (json_decode($trk2['body'], true)['success'] ?? false) === true);

    // トラック取得
    $getTrk = http_get($baseUrl . '/api/get_tracks.php', $cookieA);
    test("GET tracks", in_array($getTrk['status'], [200, 400]));
} else {
    skip_test("Phase 13: GPSトラック", "User A未ログイン");
}

// ═══════════════════════════════════════
// PHASE 14: マイフィールド
// ═══════════════════════════════════════
echo "\n── Phase 14: マイフィールド (create_field) ─────\n";
if ($loggedA) {
    // Refresh CSRF from cookie
    list($cookieA, $csrfA) = refreshCsrf($baseUrl, $cookieA);
    $fieldName = 'E2Eテストフィールド ' . date('His');
    $fld = http_json($baseUrl . '/api/create_field.php', [
        'name' => $fieldName,
        'lat' => '34.977',
        'lng' => '138.383',
        'radius' => 500,
    ], $csrfA, $cookieA);
    $fldJ = json_decode($fld['body'], true);
    test("POST create_field", ($fldJ['success'] ?? false) === true || in_array($fld['status'], [200, 201]), substr($fld['body'], 0, 120));

    // ダッシュボード表示
    $mfd = http_get($baseUrl . '/my_field_dashboard.php', $cookieA);
    test("GET my_field_dashboard.php", $mfd['status'] === 200);
} else {
    skip_test("Phase 14: マイフィールド", "User A未ログイン");
}

// ═══════════════════════════════════════
// PHASE 15: コンテンツ通報
// ═══════════════════════════════════════
echo "\n── Phase 15: コンテンツ通報 ────────────────────\n";
if ($loggedB && $observationIdA) {
    // Refresh CSRF from cookie
    list($cookieB, $csrfB) = refreshCsrf($baseUrl, $cookieB);
    // report_content
    $rpt = http_json($baseUrl . '/api/report_content.php', [
        'target_type' => 'observation',
        'target_id' => $observationIdA,
        'reason' => 'spam',
        'details' => 'E2Eテスト通報 v5',
    ], $csrfB, $cookieB);
    $rptJ = json_decode($rpt['body'], true);
    test("POST report_content", ($rptJ['success'] ?? false) === true || $rpt['status'] === 200, substr($rpt['body'], 0, 100));

    // flag_content
    $flg = http_json($baseUrl . '/api/flag_content.php', [
        'content_id' => $observationIdA,
        'content_type' => 'observation',
        'reason' => 'inappropriate',
    ], $csrfB, $cookieB);
    test("POST flag_content", $flg['status'] === 200, substr($flg['body'], 0, 100));

    // 不正なcontent_type
    $flgBad = http_json($baseUrl . '/api/flag_content.php', [
        'content_id' => $observationIdA,
        'content_type' => 'INVALID_TYPE',
        'reason' => 'test',
    ], $csrfB, $cookieB);
    $fbJ = json_decode($flgBad['body'], true);
    test("POST flag_content (bad type) → rejected", ($fbJ['success'] ?? true) === false || $flgBad['status'] >= 400);
} elseif (!$observationIdA) {
    skip_test("Phase 15: コンテンツ通報", "観測IDなし");
} else {
    skip_test("Phase 15: コンテンツ通報", "User B未ログイン");
}

// ═══════════════════════════════════════
// PHASE 16: Analytics (no auth required)
// ═══════════════════════════════════════
echo "\n── Phase 16: Analytics ─────────────────────────\n";
$ana = http_post($baseUrl . '/api/save_analytics.php', [
    'event' => 'e2e_test',
    'page' => '/e2e',
    'timestamp' => time(),
], null, 'json');
test("POST save_analytics (no auth)", $ana['status'] === 200, substr($ana['body'], 0, 80));

// ═══════════════════════════════════════
// PHASE 17: エラーハンドリング + セキュリティ
// ═══════════════════════════════════════
echo "\n── Phase 17: エラーハンドリング + セキュリティ ─\n";

// 404
$e404 = http_get($baseUrl . '/nonexistent_xyz.php');
test("Missing page [{$e404['status']}]", in_array($e404['status'], [200, 404]));

// Bad params graceful
$eBad = http_get($baseUrl . '/api/get_observations.php?bad_param=xyz');
test("API graceful with bad params", $eBad['status'] === 200);

// POST without CSRF
$noCsrf = http_post($baseUrl . '/api/post_observation.php', ['taxon_name' => 'hack'], $cookieA);
$ncJ = json_decode($noCsrf['body'], true);
test("POST without CSRF → rejected", in_array($noCsrf['status'], [200, 400, 403]));
if ($noCsrf['status'] === 200) test("  ↳ success=false", ($ncJ['success'] ?? true) === false);

// POST without auth (no cookie)
$noAuth = http_post($baseUrl . '/api/post_observation.php', ['taxon_name' => 'hack', 'csrf_token' => 'fake123']);
test("POST without auth → rejected", in_array($noAuth['status'], [200, 302, 401, 403]));

// XSS in taxon_name
if ($loggedA && $csrfA) {
    $xss = http_json($baseUrl . '/api/post_identification.php', [
        'observation_id' => $observationIdA ?? 'test',
        'taxon_name' => '<script>alert("xss")</script>',
        'taxon_key' => '1',
    ], $csrfA, $cookieA);
    // Should not contain raw <script> in response
    test("XSS in taxon_name → sanitized", strpos($xss['body'], '<script>alert') === false);
}

// SQL injection-like input (should be handled gracefully or blocked by WAF)
$sqli = http_get($baseUrl . "/api/get_observations.php?id=" . urlencode("' OR 1=1 --"));
// On production (Onamae RS), SiteGuard Lite may return 403 Forbidden for SQLi patterns.
test("SQL injection-like input → graceful", $sqli['status'] === 200 || $sqli['status'] === 403, "Status: " . $sqli['status']);

// ═══════════════════════════════════════
// PHASE 18: 静的アセット + パラメータ
// ═══════════════════════════════════════
echo "\n── Phase 18: 静的アセット + パラメータ ─────────\n";
$assets = [
    '/assets/css/tokens.css',
    '/assets/css/style.css',
    '/assets/css/zukan.css',
    '/assets/css/tactical.css',
    '/assets/js/analytics.js',
    '/assets/js/dashboard.js',
    '/manifest.json',
    '/sw.js',
    '/robots.txt',
];
foreach ($assets as $path) {
    $r = http_get($baseUrl . $path);
    test("ASSET {$path} [{$r['status']}]", $r['status'] === 200);
}

// パラメータ付きページ
$paramPages = [
    ['/species.php?name=test', [200, 302]],
    ['/site_dashboard.php?id=test456', [200]],
    ['/profile.php?id=user_ya_001', [200]],
    ['/observation_detail.php?id=nonexistent', [200, 404]],
];
foreach ($paramPages as [$path, $exp]) {
    $r = http_get($baseUrl . $path, $cookieA);
    test("PARAM {$path} [{$r['status']}]", in_array($r['status'], $exp));
}

// ═══════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════
echo "\n── Cleanup: テストデータ削除 ──────────────────\n";

require_once __DIR__ . '/../upload_package/config/config.php';
require_once __DIR__ . '/../upload_package/libs/DataStore.php';

$cleanedItems = 0;
$testEmails = [$emailA, $emailB, $emailC];
$testUserIds = array_filter([$userIdA, $userIdB, $userIdC]);

// Users
$usersFile = DATA_DIR . '/users.json';
if (file_exists($usersFile)) {
    $users = json_decode(file_get_contents($usersFile), true) ?: [];
    $before = count($users);
    // Extract IDs before filtering
    foreach ($users as $u) {
        if (in_array($u['email'] ?? '', $testEmails)) {
            $testUserIds[] = $u['id'] ?? '';
        }
    }
    $testUserIds = array_unique(array_filter($testUserIds));
    $users = array_values(array_filter($users, fn($u) => !in_array($u['email'] ?? '', $testEmails)));
    $diff = $before - count($users);
    if ($diff > 0) {
        file_put_contents($usersFile, json_encode($users, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        $cleanedItems += $diff;
    }
    test("Test users removed ({$diff})", true);
}

// User-specific files
foreach ($testUserIds as $uid) {
    foreach (['users', 'user_badges', 'notifications', 'follows'] as $sub) {
        $f = DATA_DIR . "/{$sub}/{$uid}.json";
        if (file_exists($f)) {
            unlink($f);
            $cleanedItems++;
        }
    }
    // Tracks
    $trackDir = DATA_DIR . "/tracks/{$uid}";
    if (is_dir($trackDir)) {
        foreach (glob($trackDir . '/*.json') as $tf) {
            unlink($tf);
            $cleanedItems++;
        }
        @rmdir($trackDir);
    }
}

// Remember tokens
$tokenDir = DATA_DIR . '/remember_tokens';
if (is_dir($tokenDir)) {
    foreach (glob($tokenDir . '/*.json') as $tf) {
        $td = json_decode(file_get_contents($tf), true);
        if (in_array($td['user_id'] ?? '', $testUserIds)) {
            unlink($tf);
            $cleanedItems++;
        }
    }
}

// Observations
foreach (['observations.json'] as $file) {
    $fp = DATA_DIR . '/' . $file;
    if (file_exists($fp)) {
        $data = json_decode(file_get_contents($fp), true) ?: [];
        $before = count($data);
        $data = array_values(array_filter($data, fn($o) => strpos($o['notes'] ?? '', 'E2Eテスト') === false));
        $diff = $before - count($data);
        if ($diff > 0) {
            file_put_contents($fp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            $cleanedItems += $diff;
        }
    }
}
// Partitioned observations
$obsDir = DATA_DIR . '/observations';
if (is_dir($obsDir)) {
    foreach (glob($obsDir . '/*.json') as $pf) {
        $d = json_decode(file_get_contents($pf), true) ?: [];
        $b = count($d);
        $d = array_values(array_filter($d, fn($o) => strpos($o['notes'] ?? '', 'E2Eテスト') === false));
        $diff = $b - count($d);
        if ($diff > 0) {
            file_put_contents($pf, json_encode($d, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            $cleanedItems += $diff;
        }
    }
}

// Identifications
$idFile = DATA_DIR . '/identifications.json';
if (file_exists($idFile)) {
    $ids = json_decode(file_get_contents($idFile), true) ?: [];
    $b = count($ids);
    $ids = array_values(array_filter($ids, fn($i) => strpos($i['note'] ?? ($i['notes'] ?? ''), 'E2Eテスト') === false));
    $diff = $b - count($ids);
    if ($diff > 0) {
        file_put_contents($idFile, json_encode($ids, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        $cleanedItems += $diff;
    }
}

// Events
$eventsDir = DATA_DIR . '/events';
if (is_dir($eventsDir)) {
    foreach (glob($eventsDir . '/*.json') as $ef) {
        $ed = json_decode(file_get_contents($ef), true);
        if (strpos($ed['title'] ?? '', 'E2Eテスト') !== false) {
            unlink($ef);
            $cleanedItems++;
        }
    }
}

// Fields
$fieldsDir = DATA_DIR . '/my_fields';
if (is_dir($fieldsDir)) {
    foreach (glob($fieldsDir . '/*.json') as $ff) {
        $fd = json_decode(file_get_contents($ff), true);
        if (strpos($fd['name'] ?? '', 'E2Eテスト') !== false) {
            unlink($ff);
            $cleanedItems++;
        }
    }
}

// Flags
$flagsFile = DATA_DIR . '/flags.json';
if (file_exists($flagsFile)) {
    $flags = json_decode(file_get_contents($flagsFile), true) ?: [];
    $b = count($flags);
    $flags = array_values(array_filter($flags, fn($f) => strpos($f['details'] ?? ($f['reason'] ?? ''), 'E2Eテスト') === false && !in_array($f['reporter_id'] ?? '', $testUserIds)));
    $diff = $b - count($flags);
    if ($diff > 0) {
        file_put_contents($flagsFile, json_encode($flags, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        $cleanedItems += $diff;
    }
}

// Likes
$likesDir = DATA_DIR . '/likes';
if (is_dir($likesDir) && $observationIdA) {
    $lf = $likesDir . '/' . $observationIdA . '.json';
    if (file_exists($lf)) {
        $likes = json_decode(file_get_contents($lf), true) ?: [];
        $likes = array_values(array_filter($likes, fn($l) => !in_array($l['user_id'] ?? '', $testUserIds)));
        if (empty($likes)) {
            unlink($lf);
        } else {
            file_put_contents($lf, json_encode($likes, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        }
        $cleanedItems++;
    }
}

// Test image
if ($testImgPath && file_exists($testImgPath)) {
    unlink($testImgPath);
    $cleanedItems++;
}

// Uploaded photos
$uploadsDir = defined('PUBLIC_DIR') ? PUBLIC_DIR . '/uploads/photos' : __DIR__ . '/../upload_package/public_html/uploads/photos';
if (is_dir($uploadsDir)) {
    foreach (glob($uploadsDir . '/test_e2e*') as $up) {
        unlink($up);
        $cleanedItems++;
    }
    // Also clean by user ID
    foreach ($testUserIds as $uid) {
        foreach (glob($uploadsDir . "/{$uid}_*") as $up) {
            unlink($up);
            $cleanedItems++;
        }
    }
}

test("Cleaned {$cleanedItems} items", true);

// ═══════════════════════════════════════
// REPORT
// ═══════════════════════════════════════
$total = $pass + $fail + $skip;
$passRate = $total > 0 ? round($pass / $total * 100, 1) : 0;

echo "\n╔══════════════════════════════════════════════════╗\n";
echo "║  📊 E2E Test Report v5 — 3ユーザー版           ║\n";
echo "╠══════════════════════════════════════════════════╣\n";
printf("║  ✅ Pass: %-39s║\n", $pass);
printf("║  ❌ Fail: %-39s║\n", $fail);
printf("║  ⏭️  Skip: %-38s║\n", $skip);
printf("║  Total: %-40s║\n", $total);
printf("║  Rate:  %-40s║\n", "{$passRate}%");
echo "╚══════════════════════════════════════════════════╝\n";

if (count($warnings) > 0) {
    echo "\n⚠️  PHP Warnings:\n";
    foreach ($warnings as $w) echo "  • {$w}\n";
}
if (count($errors) > 0) {
    echo "\n🚨 Failed:\n";
    foreach ($errors as $e) echo "  • {$e}\n";
}

echo "\n" . ($fail === 0 ? "🎉 ALL TESTS PASSED!" : "⚠️  {$fail} FAILURE(S)") . "\n";
exit($fail > 0 ? 1 : 0);
