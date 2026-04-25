<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/CanonicalBootstrap.php';
require_once __DIR__ . '/../../libs/CanonicalStore.php';

CanonicalBootstrap::ensureSchema();
$pdo = new PDO('sqlite:' . DATA_DIR . '/ikimon.db');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$observations = DataStore::fetchAll('observations');
$migrated = 0;
$skipped = 0;
$errors = 0;

foreach ($observations as $obs) {
    try {
        $canonicalEventId = $obs['canonical_refs']['event_id'] ?? null;
        if (!$canonicalEventId) {
            $skipped++;
            continue;
        }

        $placeContext = CanonicalStore::derivePlaceContext([
            'event_date' => $obs['observed_at'] ?? $obs['created_at'] ?? date('c'),
            'decimal_latitude' => $obs['lat'] ?? null,
            'decimal_longitude' => $obs['lng'] ?? null,
            'country' => $obs['country'] ?? null,
            'prefecture' => $obs['prefecture'] ?? null,
            'municipality' => $obs['municipality'] ?? null,
            'site_id' => $obs['site_id'] ?? null,
            'site_name' => $obs['site_name'] ?? null,
            'locality_label' => $obs['site_name'] ?? ($obs['municipality'] ?? null),
        ]);
        $placeId = CanonicalStore::upsertPlace($placeContext);

        $update = $pdo->prepare("
            UPDATE events
            SET place_id = :place_id,
                locality_label = :locality_label,
                locality_context = :locality_context
            WHERE event_id = :event_id
        ");
        $update->execute([
            ':place_id' => $placeId,
            ':locality_label' => $placeContext['locality_label'],
            ':locality_context' => json_encode([
                'country' => $obs['country'] ?? null,
                'prefecture' => $obs['prefecture'] ?? null,
                'municipality' => $obs['municipality'] ?? null,
            ], JSON_UNESCAPED_UNICODE),
            ':event_id' => $canonicalEventId,
        ]);

        CanonicalStore::addPlaceConditionLog([
            'condition_id' => 'cond-' . ($obs['id'] ?? bin2hex(random_bytes(6))),
            'place_id' => $placeId,
            'event_id' => $canonicalEventId,
            'observed_at' => $obs['observed_at'] ?? $obs['created_at'] ?? date('c'),
            'biome' => $obs['biome'] ?? null,
            'substrate_tags' => $obs['substrate_tags'] ?? null,
            'evidence_tags' => $obs['evidence_tags'] ?? null,
            'cultivation' => $obs['cultivation'] ?? null,
            'organism_origin' => $obs['organism_origin'] ?? null,
            'managed_context_type' => $obs['managed_context']['type'] ?? null,
            'managed_site_name' => $obs['managed_context']['site_name'] ?? null,
            'locality_note' => $obs['note'] ?? null,
            'environment_summary' => null,
            'metadata' => ['backfill' => true],
        ]);
        CanonicalStore::refreshPlaceStats($placeId);
        $migrated++;
    } catch (\Throwable $e) {
        $errors++;
        error_log('migrate_place_intelligence failed for observation ' . ($obs['id'] ?? 'unknown') . ': ' . $e->getMessage());
    }
}

echo json_encode([
    'success' => true,
    'migrated' => $migrated,
    'skipped' => $skipped,
    'errors' => $errors,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL;
