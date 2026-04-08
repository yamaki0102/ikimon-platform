<?php

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/AiObservationAssessment.php';
require_once __DIR__ . '/../../libs/Taxonomy.php';

if (!defined('GEMINI_API_KEY') || GEMINI_API_KEY === '') {
    fwrite(STDERR, "GEMINI_API_KEY is not configured.\n");
    exit(1);
}

$dryRun = in_array('--dry-run', $argv, true);
$limitArg = null;
foreach ($argv as $arg) {
    if (str_starts_with($arg, '--limit=')) {
        $limitArg = (int)substr($arg, 8);
    }
}
$limit = $limitArg ?? 50;

fwrite(STDERR, "=== Reprocess Fallback Assessments ===\n");
fwrite(STDERR, "Mode: " . ($dryRun ? 'DRY RUN' : 'LIVE') . "\n");
fwrite(STDERR, "Limit: $limit\n\n");

$partitionFiles = glob(rtrim(DATA_DIR, '/') . '/observations/*.json') ?: [];
sort($partitionFiles);

$fallbackObservations = [];

foreach ($partitionFiles as $file) {
    $partition = basename($file, '.json');
    $rows = DataStore::get('observations/' . $partition, 0);
    if (!is_array($rows)) {
        continue;
    }

    foreach ($rows as $row) {
        $id = (string)($row['id'] ?? '');
        if ($id === '' || empty($row['photos'])) {
            continue;
        }

        $assessments = $row['ai_assessments'] ?? [];
        if (!is_array($assessments) || $assessments === []) {
            continue;
        }

        $latestMachine = null;
        foreach (array_reverse($assessments) as $assessment) {
            if ((string)($assessment['kind'] ?? '') === 'machine_assessment') {
                $latestMachine = $assessment;
                break;
            }
        }

        if ($latestMachine === null) {
            continue;
        }

        $model = (string)($latestMachine['model'] ?? '');
        if ($model !== 'system-fallback') {
            continue;
        }

        $fallbackObservations[] = [
            'id' => $id,
            'partition' => $partition,
            'photo_count' => count($row['photos']),
            'taxon_name' => (string)($row['taxon']['name'] ?? '不明'),
            'created_at' => (string)($row['created_at'] ?? ''),
        ];
    }
}

fwrite(STDERR, "Found " . count($fallbackObservations) . " observations with system-fallback\n");

if ($fallbackObservations === []) {
    echo json_encode(['found' => 0, 'reprocessed' => 0, 'failed' => 0], JSON_UNESCAPED_UNICODE) . PHP_EOL;
    exit(0);
}

$toProcess = array_slice($fallbackObservations, 0, $limit);
fwrite(STDERR, "Processing " . count($toProcess) . " observations...\n\n");

if ($dryRun) {
    foreach ($toProcess as $item) {
        fwrite(STDERR, "  [DRY] {$item['id']} — {$item['taxon_name']} ({$item['photo_count']} photos)\n");
    }
    echo json_encode([
        'found' => count($fallbackObservations),
        'would_process' => count($toProcess),
        'mode' => 'dry_run',
    ], JSON_UNESCAPED_UNICODE) . PHP_EOL;
    exit(0);
}

$reprocessed = 0;
$failed = 0;
$errors = [];

foreach ($toProcess as $item) {
    $observation = DataStore::findById('observations', $item['id']);
    if (!$observation) {
        fwrite(STDERR, "  [SKIP] {$item['id']} — not found\n");
        $failed++;
        continue;
    }

    fwrite(STDERR, "  [PROCESSING] {$item['id']} — {$item['taxon_name']}...");

    try {
        $assessment = AiObservationAssessment::buildAssessmentForObservation($observation, ['lane' => 'deep']);

        if ($assessment === null) {
            fwrite(STDERR, " NULL result\n");
            $failed++;
            $errors[] = ['id' => $item['id'], 'error' => 'null result'];
            continue;
        }

        $isFallback = (string)($assessment['model'] ?? '') === 'system-fallback';
        if ($isFallback) {
            fwrite(STDERR, " still fallback\n");
            $failed++;
            $errors[] = ['id' => $item['id'], 'error' => 'still fallback after retry'];
            continue;
        }

        $observation['ai_assessment_status'] = 'completed';
        $observation['ai_assessment_updated_at'] = date('Y-m-d H:i:s');
        $observation['ai_assessments'] = array_values(array_filter(
            $observation['ai_assessments'] ?? [],
            fn($entry) => (string)($entry['model'] ?? '') !== 'system-fallback'
        ));
        $observation['ai_assessments'][] = $assessment;
        $observation['updated_at'] = date('Y-m-d H:i:s');
        DataStore::upsert('observations', $observation);

        $newModel = (string)($assessment['model'] ?? 'unknown');
        $band = (string)($assessment['confidence_band'] ?? '?');
        $recName = (string)($assessment['recommended_taxon']['name'] ?? '不明');
        fwrite(STDERR, " OK ($newModel, $band, $recName)\n");
        $reprocessed++;

        usleep(500_000);

    } catch (\Throwable $e) {
        fwrite(STDERR, " ERROR: " . mb_substr($e->getMessage(), 0, 100) . "\n");
        $failed++;
        $errors[] = ['id' => $item['id'], 'error' => mb_substr($e->getMessage(), 0, 200)];
    }
}

$result = [
    'found' => count($fallbackObservations),
    'processed' => count($toProcess),
    'reprocessed' => $reprocessed,
    'failed' => $failed,
    'errors' => $errors,
];
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;

fwrite(STDERR, "\n=== Done: $reprocessed reprocessed, $failed failed ===\n");
