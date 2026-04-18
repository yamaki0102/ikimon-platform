<?php

/**
 * get_event_ai_suggestion.php — 観察会AIフィールドガイド提案API
 *
 * GET /api/get_event_ai_suggestion.php?event_id=evt_xxxx
 *
 * LIVE中のイベントに対して、Gemini Flash Lite 3.1 で
 * 「次に何を見てみようかな」と思えるヒントを返す。
 *
 * 5分間キャッシュ: 同じイベントの全参加者が同じ提案を見る（集団効力感）
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/AiFieldGuide.php';

Auth::init();

$eventId = trim($_GET['event_id'] ?? '');
if (!$eventId) {
    echo json_encode(['success' => false, 'message' => 'event_id は必須です'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$event = DataStore::findById('events', $eventId);
if (!$event) {
    echo json_encode(['success' => false, 'message' => 'イベントが見つかりません'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$eventDate = $event['event_date'] ?? date('Y-m-d');
$startTime = $event['start_time'] ?? '09:00';
$endTime = $event['end_time'] ?? '12:00';
$now = new DateTime();
$rangeStart = new DateTime("{$eventDate} {$startTime}");
$rangeEnd = new DateTime("{$eventDate} {$endTime}");
$rangeStart->modify('-30 minutes');
$rangeEnd->modify('+30 minutes');

$isLive = ($now >= $rangeStart && $now <= $rangeEnd);
if (!$isLive) {
    echo json_encode(['success' => false, 'message' => 'AI提案はイベント進行中のみ利用可能です'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$eventCode = $event['event_code'] ?? '';
$evtLat = (float)($event['location']['lat'] ?? 0);
$evtLng = (float)($event['location']['lng'] ?? 0);
$radiusM = (int)($event['location']['radius_m'] ?? 500);

$allObs = DataStore::fetchAll('observations');
$matchedObs = [];
$speciesSet = [];
$taxonCounts = [];
$recentNames = [];
$lastObsTime = null;

foreach ($allObs as $obs) {
    $matched = false;

    if ($eventCode && ($obs['event_tag'] ?? '') === $eventCode) {
        $matched = true;
    }

    if (!$matched && !empty($obs['observed_at'])) {
        $obsTime = new DateTime($obs['observed_at']);
        $obsLat = (float)($obs['latitude'] ?? $obs['lat'] ?? 0);
        $obsLng = (float)($obs['longitude'] ?? $obs['lng'] ?? 0);

        if ($obsTime >= $rangeStart && $obsTime <= $rangeEnd && $obsLat && $obsLng && $evtLat && $evtLng) {
            if (class_exists('GeoUtils')) {
                $dist = GeoUtils::distance($obsLat, $obsLng, $evtLat, $evtLng);
                if ($dist <= $radiusM) {
                    $matched = true;
                }
            }
        }
    }

    if (!$matched) continue;

    $matchedObs[] = $obs;
    $name = $obs['taxon_name'] ?? $obs['species_name'] ?? '';
    if ($name) {
        if (!isset($speciesSet[$name])) {
            $speciesSet[$name] = 0;
        }
        $speciesSet[$name]++;

        $group = $obs['taxon_group'] ?? 'その他';
        if (!isset($taxonCounts[$group])) {
            $taxonCounts[$group] = 0;
        }
        $taxonCounts[$group]++;
    }

    $obsAt = $obs['observed_at'] ?? null;
    if ($obsAt && ($lastObsTime === null || $obsAt > $lastObsTime)) {
        $lastObsTime = $obsAt;
    }
}

arsort($speciesSet);
$recentNames = array_slice(array_keys($speciesSet), 0, 5);

$elapsedMinutes = max(0, (int)(($now->getTimestamp() - (new DateTime("{$eventDate} {$startTime}"))->getTimestamp()) / 60));
$minutesSinceLast = $lastObsTime ? max(0, (int)(($now->getTimestamp() - (new DateTime($lastObsTime))->getTimestamp()) / 60)) : $elapsedMinutes;

$targetSpeciesList = $event['target_species'] ?? [];
$targetProgressText = '';
if ($targetSpeciesList) {
    $found = [];
    $notFound = [];
    foreach ($targetSpeciesList as $ts) {
        if (isset($speciesSet[$ts])) {
            $found[] = $ts;
        } else {
            $notFound[] = $ts;
        }
    }
    $targetProgressText = '発見済み: ' . (count($found) ? implode(', ', $found) : 'なし') . ' / 未発見: ' . (count($notFound) ? implode(', ', $notFound) : 'なし');
}

$contributors = [];
foreach ($matchedObs as $obs) {
    $uid = $obs['user_id'] ?? $obs['observer_id'] ?? '';
    if ($uid && !in_array($uid, $contributors, true)) {
        $contributors[] = $uid;
    }
}

$context = [
    'event_id' => $eventId,
    'title' => $event['title'] ?? '観察会',
    'location_name' => $event['location']['name'] ?? '',
    'event_date' => $eventDate,
    'start_time' => $startTime,
    'end_time' => $endTime,
    'participant_count' => max(count($contributors), count($event['participants'] ?? [])),
    'observation_count' => count($matchedObs),
    'species_count' => count($speciesSet),
    'taxon_counts' => $taxonCounts,
    'recent_species' => $recentNames ? implode(', ', $recentNames) : '(まだなし)',
    'target_species' => $targetSpeciesList ? implode(', ', $targetSpeciesList) : '(設定なし)',
    'target_progress' => $targetProgressText ?: '(なし)',
    'elapsed_minutes' => $elapsedMinutes,
    'minutes_since_last' => $minutesSinceLast,
];

$suggestion = AiFieldGuide::suggest($context);

$recentAchievement = '';
if (!empty($matchedObs)) {
    $latest = end($matchedObs);
    $latestName = $latest['taxon_name'] ?? $latest['species_name'] ?? '';
    $latestUser = $latest['user_name'] ?? $latest['observer_name'] ?? '';
    if ($latestName && $latestUser) {
        $recentAchievement = "{$latestUser}さんが{$latestName}を発見！";
    }
}

echo json_encode([
    'success' => true,
    'suggestion' => $suggestion,
    'group_progress' => [
        'species_count' => count($speciesSet),
        'target_total' => max(count($targetSpeciesList), 20),
        'observation_count' => count($matchedObs),
        'participant_count' => count($contributors),
        'recent_achievement' => $recentAchievement,
    ],
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
