<?php

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../../config/config.php';
require_once __DIR__ . '/../../../libs/CSRF.php';
require_once __DIR__ . '/../../../libs/BusinessApplicationManager.php';

CSRF::validateRequest();

$input = json_decode(file_get_contents('php://input'), true) ?? [];

$required = ['company', 'contact_name', 'email', 'site_name', 'inquiry_type'];
foreach ($required as $field) {
    if (trim((string)($input[$field] ?? '')) === '') {
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'message' => '必須項目が不足しています。',
            'field' => $field,
        ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        exit;
    }
}

$email = trim((string)($input['email'] ?? ''));
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    echo json_encode([
        'success' => false,
        'message' => 'メールアドレスの形式が正しくありません。',
        'field' => 'email',
    ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$application = BusinessApplicationManager::create([
    'company' => $input['company'] ?? '',
    'contact_name' => $input['contact_name'] ?? '',
    'department' => $input['department'] ?? '',
    'email' => $email,
    'phone' => $input['phone'] ?? '',
    'site_name' => $input['site_name'] ?? '',
    'site_location' => $input['site_location'] ?? '',
    'plan' => $input['plan'] ?? '',
    'inquiry_type' => $input['inquiry_type'] ?? '',
    'expected_start' => $input['expected_start'] ?? '',
    'planned_site_count' => $input['planned_site_count'] ?? '',
    'use_mode' => $input['use_mode'] ?? '',
    'collaboration_scope' => $input['collaboration_scope'] ?? '',
    'message' => mb_substr((string)($input['message'] ?? ''), 0, 1500),
    'source_page' => '/for-business/apply.php',
    'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
    'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
]);

echo json_encode([
    'success' => true,
    'reference' => $application['reference'],
    'status' => $application['status'],
    'status_label' => $application['status_label'],
    'inquiry_type_label' => $application['inquiry_type_label'] ?? '',
    'next_action' => $application['ops']['next_action'] ?? '初回連絡',
    'next_due_at' => $application['ops']['next_due_at'] ?? '',
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
