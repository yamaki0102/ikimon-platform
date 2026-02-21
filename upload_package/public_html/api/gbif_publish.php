<?php
/**
 * GBIF Data Trust Publishing Status API (Mock)
 * Phase D (M8): GBIFへの自動パブリッシュ（データトラスト連携）テスト
 *
 * This API simulates a background job that aggregates DataStore observations,
 * converts them to DwC-A, and pushes them to the GBIF UAT (Sandbox) or Production API.
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';

Auth::init();
header('Content-Type: application/json; charset=utf-8');

// Require Admin or Analyst role for global publishing
if (!Auth::hasRole('Admin') && !Auth::hasRole('Analyst')) {
    echo json_encode(['success' => false, 'error' => 'Permission denied. System Admin role required.']);
    exit;
}

$action = $_GET['action'] ?? 'status';

if ($action === 'status') {
    // Return mock status of the last sync
    echo json_encode([
        'success' => true,
        'status' => [
            'last_sync_at' => date('Y-m-d H:i:s', strtotime('-2 hours')),
            'records_published' => 12450,
            'dataset_key' => '1d2b3c4f-5678-90ab-cdef-1234567890ab',
            'gbif_env' => 'UAT (Sandbox)', // Production or Sandbox
            'next_sync_scheduled_at' => date('Y-m-d H:i:s', strtotime('+22 hours'))
        ]
    ]);
    exit;
}

if ($action === 'publish') {
    // Simulate the publishing process
    // In reality, this would trigger an async job (e.g. via queue system) that formats DwC-A 
    // and sends a POST request to GBIF Ingestion API.

    $sleepMs = rand(1500, 3000);
    usleep($sleepMs * 1000); // Simulate network/processing delay

    $newRecords = rand(10, 50);

    echo json_encode([
        'success' => true,
        'message' => 'Publishing job triggered successfully.',
        'job_details' => [
            'job_id' => uniqid('gbif_job_'),
            'status' => 'completed',
            'new_records_pushed' => $newRecords,
            'timestamp' => date('Y-m-d H:i:s')
        ]
    ]);
    exit;
}

echo json_encode(['success' => false, 'error' => 'Invalid action']);
