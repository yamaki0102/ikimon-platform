<?php

/**
 * デモデータ完全削除スクリプト
 * 
 * 保守対象: user_ya_001, user_admin_001, guest_* のみ残す
 * それ以外のuser/seed/demo系は全て削除
 */
require_once __DIR__ . '/../upload_package/config/config.php';
require_once __DIR__ . '/../upload_package/libs/DataStore.php';

$dryRun = in_array('--dry-run', $argv ?? []);
if ($dryRun) {
    echo "=== DRY RUN MODE (変更なし) ===\n\n";
} else {
    echo "=== デモデータ削除 (実行モード) ===\n\n";
}

// 保持するユーザーIDパターン
$keepUserIds = ['user_ya_001', 'user_admin_001'];
function shouldKeep(string $userId): bool
{
    global $keepUserIds;
    if (in_array($userId, $keepUserIds)) return true;
    if (strpos($userId, 'guest_') === 0) return true;
    return false;
}

$stats = [
    'users_deleted' => 0,
    'observations_deleted' => 0,
    'identifications_deleted' => 0,
    'events_deleted' => 0,
    'badges_deleted' => 0,
    'fields_deleted' => 0,
    'notifications_deleted' => 0,
    'tracks_deleted' => 0,
    'total_errors' => 0,
];

// ──────────────────────────────
// 1. Users — users.json から削除
// ──────────────────────────────
echo "--- 1. Users ---\n";
$usersFile = DATA_DIR . '/users.json';
$users = json_decode(file_get_contents($usersFile), true) ?: [];
$originalCount = count($users);
$keptUsers = array_filter($users, function ($u) {
    return shouldKeep($u['id'] ?? '');
});
$stats['users_deleted'] = $originalCount - count($keptUsers);
echo "  Before: {$originalCount} → After: " . count($keptUsers) . " (deleted {$stats['users_deleted']})\n";
if (!$dryRun) {
    file_put_contents($usersFile, json_encode(array_values($keptUsers), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// ──────────────────────────────
// 2. users/ ディレクトリ内の個別ファイル
// ──────────────────────────────
echo "--- 2. User profiles ---\n";
$usersDir = DATA_DIR . '/users';
if (is_dir($usersDir)) {
    foreach (glob($usersDir . '/*.json') as $uf) {
        $userData = json_decode(file_get_contents($uf), true);
        $uid = $userData['id'] ?? basename($uf, '.json');
        if (!shouldKeep($uid)) {
            echo "  DELETE: {$uid}\n";
            if (!$dryRun) unlink($uf);
        }
    }
}

// ──────────────────────────────
// 3. Observations — 全パーティション
// ──────────────────────────────
echo "--- 3. Observations ---\n";
$obsDir = DATA_DIR . '/observations';
$obsMainFile = DATA_DIR . '/observations.json';

// Main file
if (file_exists($obsMainFile)) {
    $allObs = json_decode(file_get_contents($obsMainFile), true) ?: [];
    $origCount = count($allObs);
    $keptObs = array_filter($allObs, function ($o) {
        return shouldKeep($o['user_id'] ?? '');
    });
    $deleted = $origCount - count($keptObs);
    $stats['observations_deleted'] += $deleted;
    echo "  observations.json: {$origCount} → " . count($keptObs) . " (deleted {$deleted})\n";
    if (!$dryRun) {
        file_put_contents($obsMainFile, json_encode(array_values($keptObs), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
}

// Partitioned files
if (is_dir($obsDir)) {
    foreach (glob($obsDir . '/*.json') as $pf) {
        $partObs = json_decode(file_get_contents($pf), true) ?: [];
        $origCount = count($partObs);
        $keptPart = array_filter($partObs, function ($o) {
            return shouldKeep($o['user_id'] ?? '');
        });
        $deleted = $origCount - count($keptPart);
        $stats['observations_deleted'] += $deleted;
        $fname = basename($pf);
        echo "  {$fname}: {$origCount} → " . count($keptPart) . " (deleted {$deleted})\n";
        if (!$dryRun) {
            if (count($keptPart) === 0) {
                unlink($pf);
            } else {
                file_put_contents($pf, json_encode(array_values($keptPart), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            }
        }
    }
}

// ──────────────────────────────
// 4. Identifications
// ──────────────────────────────
echo "--- 4. Identifications ---\n";
$idFile = DATA_DIR . '/identifications.json';
if (file_exists($idFile)) {
    $ids = json_decode(file_get_contents($idFile), true) ?: [];
    $origCount = count($ids);
    $keptIds = array_filter($ids, function ($i) {
        return shouldKeep($i['user_id'] ?? '');
    });
    $stats['identifications_deleted'] = $origCount - count($keptIds);
    echo "  Before: {$origCount} → After: " . count($keptIds) . " (deleted {$stats['identifications_deleted']})\n";
    if (!$dryRun) {
        file_put_contents($idFile, json_encode(array_values($keptIds), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
}

// ──────────────────────────────
// 5. Events
// ──────────────────────────────
echo "--- 5. Events ---\n";
$evFile = DATA_DIR . '/events.json';
if (file_exists($evFile)) {
    $events = json_decode(file_get_contents($evFile), true) ?: [];
    $origCount = count($events);
    // イベントは creator で判定
    $keptEvents = array_filter($events, function ($e) {
        return shouldKeep($e['created_by'] ?? ($e['user_id'] ?? ''));
    });
    $stats['events_deleted'] = $origCount - count($keptEvents);
    echo "  Before: {$origCount} → After: " . count($keptEvents) . " (deleted {$stats['events_deleted']})\n";
    if (!$dryRun) {
        file_put_contents($evFile, json_encode(array_values($keptEvents), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
}

// ──────────────────────────────
// 6. User badges
// ──────────────────────────────
echo "--- 6. User badges ---\n";
$badgeDir = DATA_DIR . '/user_badges';
if (is_dir($badgeDir)) {
    foreach (glob($badgeDir . '/*.json') as $bf) {
        $uid = basename($bf, '.json');
        if (!shouldKeep($uid)) {
            echo "  DELETE: {$uid}\n";
            $stats['badges_deleted']++;
            if (!$dryRun) unlink($bf);
        }
    }
}

// ──────────────────────────────
// 7. My fields
// ──────────────────────────────
echo "--- 7. My fields ---\n";
$fieldsDir = DATA_DIR . '/my_fields';
if (is_dir($fieldsDir)) {
    foreach (glob($fieldsDir . '/*.json') as $ff) {
        $fieldData = json_decode(file_get_contents($ff), true);
        $uid = $fieldData['user_id'] ?? basename($ff, '.json');
        if (!shouldKeep($uid)) {
            echo "  DELETE: " . basename($ff) . " (user: {$uid})\n";
            $stats['fields_deleted']++;
            if (!$dryRun) unlink($ff);
        }
    }
}

// ──────────────────────────────
// 8. Notifications
// ──────────────────────────────
echo "--- 8. Notifications ---\n";
$notifDir = DATA_DIR . '/notifications';
if (is_dir($notifDir)) {
    foreach (glob($notifDir . '/*.json') as $nf) {
        $uid = basename($nf, '.json');
        if (!shouldKeep($uid)) {
            echo "  DELETE: {$uid}\n";
            $stats['notifications_deleted']++;
            if (!$dryRun) unlink($nf);
        }
    }
}

// ──────────────────────────────
// 9. Tracks
// ──────────────────────────────
echo "--- 9. Tracks ---\n";
$trackFile = DATA_DIR . '/tracks.json';
if (file_exists($trackFile)) {
    $tracks = json_decode(file_get_contents($trackFile), true) ?: [];
    $origCount = count($tracks);
    $keptTracks = array_filter($tracks, function ($t) {
        return shouldKeep($t['user_id'] ?? '');
    });
    $stats['tracks_deleted'] = $origCount - count($keptTracks);
    echo "  Before: {$origCount} → After: " . count($keptTracks) . " (deleted {$stats['tracks_deleted']})\n";
    if (!$dryRun) {
        file_put_contents($trackFile, json_encode(array_values($keptTracks), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
}

// ──────────────────────────────
// 10. Counts cache (rebuild needed)
// ──────────────────────────────
echo "--- 10. Cache cleanup ---\n";
$cacheDir = DATA_DIR . '/cache';
if (is_dir($cacheDir)) {
    $cacheFiles = glob($cacheDir . '/*');
    echo "  Cache files: " . count($cacheFiles) . " (clearing all)\n";
    if (!$dryRun) {
        foreach ($cacheFiles as $cf) {
            if (is_file($cf)) unlink($cf);
        }
    }
}
$countsDir = DATA_DIR . '/counts';
if (is_dir($countsDir)) {
    $countFiles = glob($countsDir . '/*');
    echo "  Count files: " . count($countFiles) . " (clearing all)\n";
    if (!$dryRun) {
        foreach ($countFiles as $cf) {
            if (is_file($cf)) unlink($cf);
        }
    }
}

// ──────────────────────────────
// 11. Analytics
// ──────────────────────────────
echo "--- 11. Analytics ---\n";
$analyticsDir = DATA_DIR . '/analytics';
if (is_dir($analyticsDir)) {
    foreach (glob($analyticsDir . '/*.json') as $af) {
        echo "  Clearing: " . basename($af) . "\n";
        if (!$dryRun) {
            file_put_contents($af, json_encode([], JSON_PRETTY_PRINT));
        }
    }
}

// ──────────────────────────────
// Summary
// ──────────────────────────────
echo "\n=== SUMMARY ===\n";
foreach ($stats as $key => $val) {
    echo "  {$key}: {$val}\n";
}

if ($dryRun) {
    echo "\n⚠️  DRY RUN — 実際の変更は行われていません。\n";
    echo "   実行するには: php tools/purge_demo_data.php\n";
} else {
    echo "\n✅ デモデータ削除完了!\n";
}
