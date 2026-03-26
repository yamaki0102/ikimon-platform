<?php
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/HabitEngine.php';

header('Content-Type: application/json; charset=UTF-8');

Auth::init();
$user = Auth::user();

if (!$user) {
    echo json_encode(['today_complete' => false, 'streak' => 0]);
    exit;
}

$state = HabitEngine::getTodayState($user['id']);

echo json_encode([
    'today_complete' => $state['today_complete'] ?? false,
    'streak' => $state['streak']['current_streak'] ?? 0,
    'today_types' => $state['today_types'] ?? [],
], JSON_UNESCAPED_UNICODE);
