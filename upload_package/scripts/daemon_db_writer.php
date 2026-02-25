<?php

/**
 * OMOIKANE JSON Spool DB Writer
 * Dedicated single-process daemon to write JSON extraction results into SQLite.
 * Eliminates concurrent write locks and "database is locked" errors.
 */

require_once __DIR__ . '/../libs/OmoikaneDB.php';

$spoolDir = __DIR__ . '/../data/spool';
$archiveDir = $spoolDir . '/archive';
if (!is_dir($archiveDir)) {
    @mkdir($archiveDir, 0777, true);
}

$dbPath = __DIR__ . '/../data/library/omoikane.sqlite3';
$pdo = new PDO('sqlite:' . $dbPath);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
$pdo->exec('PRAGMA foreign_keys = ON;');
$pdo->exec('PRAGMA journal_mode = WAL;');
// busy_timeout is less critical here since this is the ONLY writer, but good practice
$pdo->exec('PRAGMA busy_timeout = 30000;');

// Worker heartbeat registration
$workerFile = __DIR__ . '/../data/library/worker_heartbeats.json';
function updateWriterHeartbeat($file, $status)
{
    date_default_timezone_set('Asia/Tokyo');
    if (!file_exists($file)) return;
    $data = json_decode(file_get_contents($file), true) ?: [];
    $data[getmypid()] = [
        'name' => 'JSON Spool Writer',
        'type' => 'writer',
        'status' => $status,
        'updated_at' => date('Y-m-d H:i:s')
    ];
    file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE));
}

date_default_timezone_set('Asia/Tokyo');
updateWriterHeartbeat($workerFile, '待機中');
$lastHeartbeat = time();

while (true) {
    // 待機中も定期的にハートビートを更新してダッシュボードから消えないようにする
    if (time() - $lastHeartbeat >= 10) {
        updateWriterHeartbeat($workerFile, '待機中');
        $lastHeartbeat = time();
    }

    // 1. Scan for JSON files
    $files = glob($spoolDir . '/*.json');

    if (empty($files)) {
        // Sleep if no files
        usleep(500000); // 0.5s
        continue;
    }

    // Process up to 50 files per batch
    $batch = array_slice($files, 0, 50);

    foreach ($batch as $file) {
        $json = @file_get_contents($file);
        if (!$json) continue;

        $data = json_decode($json, true);
        if (!$data || !isset($data['scientific_name'])) {
            // Invalid JSON, move to archive with error prefix
            @rename($file, $archiveDir . '/err_' . basename($file));
            continue;
        }

        $scientificName = $data['scientific_name'];
        $spData = $data['extracted_data'] ?? [];
        $isTarget = $data['is_target'] ?? false;

        try {
            // Write to DB with Single Transaction
            $pdo->exec('BEGIN IMMEDIATE');

            // Insert or Update Species
            $pdo->prepare("INSERT OR IGNORE INTO species (scientific_name, distillation_status, last_distilled_at) VALUES (?, 'pending', ?)")->execute([$scientificName, date('Y-m-d H:i:s')]);

            if ($isTarget) {
                // Main distilled species
                $citationsJson = isset($data['source_citations']) ? json_encode($data['source_citations'], JSON_UNESCAPED_UNICODE) : null;
                $pdo->prepare("UPDATE species SET distillation_status = 'distilled', last_distilled_at = ?, source_citations = COALESCE(?, source_citations) WHERE scientific_name = ?")->execute([date('Y-m-d H:i:s'), $citationsJson, $scientificName]);
            }

            $stmtGetId = $pdo->prepare("SELECT id FROM species WHERE scientific_name = ?");
            $stmtGetId->execute([$scientificName]);
            $speciesId = $stmtGetId->fetchColumn();

            if ($speciesId) {
                // Parse ecological data
                $eco = $spData['ecological_constraints'] ?? [];
                $habitatVal = is_array($eco['habitat'] ?? '') ? implode(', ', $eco['habitat']) : ($eco['habitat'] ?? null);
                $altitudeVal = $eco['altitude_range'] ?? ($eco['altitude'] ?? null);
                $seasonVal = null;
                if (isset($eco['active_period'])) {
                    $ap = $eco['active_period'];
                    if (is_array($ap)) {
                        $months = $ap['months'] ?? '';
                        $region = $ap['region'] ?? '';
                        $seasonVal = $region ? "{$months} ({$region})" : $months;
                    } else {
                        $seasonVal = (string)$ap;
                    }
                } elseif (isset($eco['active_season'])) {
                    $seasonVal = is_array($eco['active_season']) ? implode(', ', $eco['active_season']) : $eco['active_season'];
                } elseif (isset($eco['season'])) {
                    $seasonVal = $eco['season'];
                }
                $notesVal = $eco['notes'] ?? null;

                if (!empty($habitatVal) || !empty($altitudeVal) || !empty($seasonVal) || !empty($notesVal)) {
                    $pdo->prepare("INSERT OR IGNORE INTO ecological_constraints (species_id) VALUES (?)")->execute([$speciesId]);
                    $pdo->prepare("UPDATE ecological_constraints SET habitat = COALESCE(NULLIF(?, ''), habitat), altitude = COALESCE(NULLIF(?, ''), altitude), season = COALESCE(NULLIF(?, ''), season), notes = COALESCE(NULLIF(?, ''), notes) WHERE species_id = ?")->execute([$habitatVal, $altitudeVal, $seasonVal, $notesVal, $speciesId]);
                }

                // Parse identification keys
                $keys = $spData['identification_keys'] ?? [];
                $morphTraits = "";
                $simSpecies = "";
                $keyDiffs = "";
                if (isset($keys[0]) && is_array($keys[0])) {
                    $morphTraits = implode("\n", array_column($keys, 'feature'));
                    $keyDiffs = implode("\n", array_column($keys, 'description'));
                    $simList = [];
                    foreach ($keys as $k) {
                        if (isset($k['comparison_species']) && is_array($k['comparison_species'])) $simList = array_merge($simList, $k['comparison_species']);
                    }
                    $simSpecies = implode(', ', array_unique($simList));
                } else {
                    $morphTraits = is_array($keys['morphological_traits'] ?? '') ? implode("\n", $keys['morphological_traits']) : ($keys['morphological_traits'] ?? null);
                    $simSpecies = is_array($keys['similar_species'] ?? '') ? implode(', ', $keys['similar_species']) : ($keys['similar_species'] ?? null);
                    $keyDiffs = is_array($keys['key_differences'] ?? '') ? implode("\n", $keys['key_differences']) : ($keys['key_differences'] ?? null);
                }

                if (!empty($morphTraits) || !empty($simSpecies) || !empty($keyDiffs)) {
                    $pdo->prepare("INSERT OR IGNORE INTO identification_keys (species_id) VALUES (?)")->execute([$speciesId]);
                    $pdo->prepare("UPDATE identification_keys SET morphological_traits = COALESCE(NULLIF(?, ''), morphological_traits), similar_species = COALESCE(NULLIF(?, ''), similar_species), key_differences = COALESCE(NULLIF(?, ''), key_differences) WHERE species_id = ?")->execute([$morphTraits, $simSpecies, $keyDiffs, $speciesId]);
                }

                // Parse Specimen Records
                $specimens = $data['specimen_records'] ?? [];
                if (!empty($specimens)) {
                    $stmtSp = $pdo->prepare("INSERT OR IGNORE INTO specimen_records (species_id, gbif_occurrence_key, institution_code, collection_code, catalog_number, recorded_by, event_date, country, locality, decimal_latitude, decimal_longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                    foreach ($specimens as $spec) {
                        $stmtSp->execute([
                            $speciesId,
                            $spec['gbif_occurrence_key'] ?? '',
                            $spec['institution_code'] ?? '',
                            $spec['collection_code'] ?? '',
                            $spec['catalog_number'] ?? '',
                            $spec['recorded_by'] ?? '',
                            $spec['event_date'] ?? '',
                            $spec['country'] ?? '',
                            $spec['locality'] ?? '',
                            $spec['decimal_latitude'] ?? null,
                            $spec['decimal_longitude'] ?? null
                        ]);
                    }
                }
            }

            $pdo->exec('COMMIT');

            @rename($file, $archiveDir . '/' . basename($file));

            echo "[" . date('H:i:s') . "] WRITE OK: $scientificName\n";
            updateWriterHeartbeat($workerFile, "DB書込済: {$scientificName}");
            $lastHeartbeat = time();
        } catch (PDOException $e) {
            try {
                $pdo->exec('ROLLBACK');
            } catch (PDOException $_) {
            }
            echo "[" . date('H:i:s') . "] WRITE FAILED: $scientificName - " . $e->getMessage() . "\n";
            // Leave file in spool to retry on next loop
            usleep(500000); // Wait on DB issue
        }
    }
}
