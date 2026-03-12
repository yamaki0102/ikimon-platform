<?php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/AiObservationAssessment.php';

if (!AiObservationAssessment::isConfigured()) {
    fwrite(STDERR, "GEMINI_API_KEY is not configured.\n");
    exit(1);
}

$year = isset($argv[1]) ? (int)$argv[1] : (int)date('Y');
$limit = isset($argv[2]) ? max(0, (int)$argv[2]) : 0;
$dryRun = in_array('--dry-run', $argv, true);
$missingOnly = in_array('--missing-only', $argv, true);
$targetIds = parseTargetIds($argv);

$summary = [
    'year' => $year,
    'limit' => $limit,
    'dry_run' => $dryRun,
    'scanned' => 0,
    'eligible' => 0,
    'updated' => 0,
    'skipped_no_photos' => 0,
    'skipped_year' => 0,
    'failed' => 0,
    'files_changed' => 0,
    'skipped_completed' => 0,
    'skipped_not_target' => 0,
    'target_ids' => array_values($targetIds),
];

$targets = discoverObservationFiles($year);

foreach ($targets as $file) {
    $rows = DataStore::get($file, 0);
    if (!is_array($rows) || $rows === []) {
        continue;
    }

    $fileChanged = false;
    foreach ($rows as $index => $observation) {
        if ($limit > 0 && $summary['updated'] >= $limit) {
            break 2;
        }

        $summary['scanned']++;
        if (!isCurrentYearPost($observation, $year)) {
            $summary['skipped_year']++;
            continue;
        }

        if ($targetIds !== [] && !in_array((string)($observation['id'] ?? ''), $targetIds, true)) {
            $summary['skipped_not_target']++;
            continue;
        }

        if (empty($observation['photos']) || !is_array($observation['photos'])) {
            $summary['skipped_no_photos']++;
            continue;
        }

        if ($missingOnly && hasCompletedMachineAssessment($observation)) {
            $summary['skipped_completed']++;
            continue;
        }

        $summary['eligible']++;

        try {
            $assessment = AiObservationAssessment::buildAssessmentForObservation($observation);
            if ($assessment === null) {
                $summary['skipped_no_photos']++;
                continue;
            }

            $rows[$index]['ai_assessment_status'] = 'completed';
            $rows[$index]['ai_assessment_updated_at'] = date('Y-m-d H:i:s');
            $rows[$index]['ai_assessments'] = array_values(array_filter(
                $rows[$index]['ai_assessments'] ?? [],
                fn($entry) => (string)($entry['kind'] ?? '') !== 'machine_assessment'
            ));
            $rows[$index]['ai_assessments'][] = $assessment;
            $rows[$index]['updated_at'] = date('Y-m-d H:i:s');
            $summary['updated']++;
            $fileChanged = true;
        } catch (\Throwable $e) {
            $summary['failed']++;
            fwrite(STDERR, '[' . ($observation['id'] ?? 'unknown') . '] ' . mb_substr($e->getMessage(), 0, 200) . PHP_EOL);
        }
    }

    if ($fileChanged && !$dryRun) {
        DataStore::save($file, $rows);
        $summary['files_changed']++;
    }
}

echo json_encode($summary, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;

function discoverObservationFiles(int $year): array
{
    $files = [];
    $dir = DATA_DIR . '/observations';
    if (is_dir($dir)) {
        foreach (glob($dir . '/' . $year . '-*.json') ?: [] as $path) {
            $files[] = 'observations/' . basename($path, '.json');
        }
    }

    $legacy = DataStore::get('observations', 0);
    if (is_array($legacy) && $legacy !== []) {
        $files[] = 'observations';
    }

    return array_values(array_unique($files));
}

function isCurrentYearPost(array $observation, int $year): bool
{
    $createdAt = (string)($observation['created_at'] ?? '');
    if ($createdAt === '') {
        return false;
    }

    $timestamp = strtotime($createdAt);
    if (!$timestamp) {
        return false;
    }

    return (int)date('Y', $timestamp) === $year;
}

function hasCompletedMachineAssessment(array $observation): bool
{
    if ((string)($observation['ai_assessment_status'] ?? '') !== 'completed') {
        return false;
    }

    foreach (($observation['ai_assessments'] ?? []) as $entry) {
        if ((string)($entry['kind'] ?? '') === 'machine_assessment') {
            return true;
        }
    }

    return false;
}

function parseTargetIds(array $argv): array
{
    $ids = [];
    foreach ($argv as $arg) {
        if (!is_string($arg) || !str_starts_with($arg, '--ids=')) {
            continue;
        }

        $payload = substr($arg, 6);
        foreach (preg_split('/[,\s]+/', (string)$payload) ?: [] as $id) {
            $id = trim((string)$id);
            if ($id !== '') {
                $ids[$id] = $id;
            }
        }
    }

    return array_values($ids);
}
