<?php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/Taxonomy.php';
require_once __DIR__ . '/../libs/BioUtils.php';
require_once __DIR__ . '/../libs/ObservationRecalcQueue.php';

$observations = DataStore::fetchAll('observations');
$updated = 0;
$skippedStatus = 0;

foreach ($observations as $obs) {
    $changed = false;
    $isAikanImport = str_starts_with((string)($obs['id'] ?? ''), 'aikan-import-');

    // Phase 1: Normalize taxonomy on identifications
    foreach (($obs['identifications'] ?? []) as $index => $identification) {
        $resolved = Taxonomy::resolveFromInput($identification);
        $normalized = array_merge($identification, Taxonomy::toIdentificationFields($resolved));
        if ($normalized !== $identification) {
            $obs['identifications'][$index] = $normalized;
            $changed = true;
        }
    }

    // Phase 2: Normalize observation-level taxon
    if (!empty($obs['taxon']) && is_array($obs['taxon'])) {
        $resolvedObsTaxon = Taxonomy::resolveFromInput($obs['taxon']);
        $normalizedTaxon = Taxonomy::toObservationTaxon($resolvedObsTaxon);
        if ($normalizedTaxon !== $obs['taxon']) {
            $obs['taxon'] = $normalizedTaxon;
            $changed = true;
        }
    }

    // Phase 3: Recalculate consensus
    // aikan-import records: preserve original status (special-case: no photos in source data)
    $oldStatus = $obs['status'] ?? null;
    BioUtils::updateConsensus($obs);
    if ($isAikanImport && ($obs['status'] ?? null) !== $oldStatus) {
        $obs['status'] = $oldStatus;
        $obs['quality_grade'] = $oldStatus;
        $obs['quality_flags']['aikan_status_preserved'] = true;
        $skippedStatus++;
    } elseif (($obs['status'] ?? null) !== $oldStatus) {
        $changed = true;
    }

    if ($changed) {
        $obs['updated_at'] = date('Y-m-d H:i:s');
        DataStore::upsert('observations', $obs);
        ObservationRecalcQueue::enqueue($obs['id'], 'taxonomy_backfill');
        $updated++;
    }
}

echo "updated={$updated} skipped_status={$skippedStatus} total=" . count($observations) . "\n";
