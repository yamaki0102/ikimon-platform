<?php
/**
 * OMOIKANE JSON Spool DB Writer v2.0
 * 
 * Design: Each file is processed by a fresh PDO connection with strict timeout.
 * If a single write takes >30s, the connection is abandoned and the file is retried later.
 * This prevents the permanent hangs caused by SQLite WAL lock contention.
 */

$spoolDir = __DIR__ . '/../data/spool';
$archiveDir = $spoolDir . '/archive';
if (!is_dir($archiveDir)) @mkdir($archiveDir, 0777, true);

$dbPath = __DIR__ . '/../data/library/omoikane.sqlite3';
date_default_timezone_set('Asia/Tokyo');

echo "[" . date('H:i:s') . "] DB Writer v2.0 started (PID: " . getmypid() . ")\n";

function getConnection($dbPath) {
    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->setAttribute(PDO::ATTR_TIMEOUT, 10);
    $pdo->exec('PRAGMA journal_mode = WAL;');
    $pdo->exec('PRAGMA busy_timeout = 10000;');
    $pdo->exec('PRAGMA foreign_keys = ON;');
    return $pdo;
}

function writeOneFile($file, $dbPath, $archiveDir) {
    $json = @file_get_contents($file);
    if (!$json) return false;
    
    $data = json_decode($json, true);
    if (!$data || !isset($data['scientific_name'])) {
        @rename($file, $archiveDir . '/err_' . basename($file));
        return false;
    }
    
    $scientificName = $data['scientific_name'];
    $spData = $data['extracted_data'] ?? [];
    $isTarget = $data['is_target'] ?? false;
    
    // Fresh connection per file - no stale locks
    $pdo = getConnection($dbPath);
    
    try {
        $pdo->exec('BEGIN');
        
        // Insert/Update species
        $pdo->prepare("INSERT OR IGNORE INTO species (scientific_name, distillation_status, last_distilled_at) VALUES (?, 'pending', ?)")
            ->execute([$scientificName, date('Y-m-d H:i:s')]);
        
        if ($isTarget) {
            $citationsJson = isset($data['source_citations']) ? json_encode($data['source_citations'], JSON_UNESCAPED_UNICODE) : null;
            $pdo->prepare("UPDATE species SET distillation_status = 'distilled', last_distilled_at = ?, source_citations = COALESCE(?, source_citations) WHERE scientific_name = ?")
                ->execute([date('Y-m-d H:i:s'), $citationsJson, $scientificName]);
        }
        
        $speciesId = $pdo->query("SELECT id FROM species WHERE scientific_name = " . $pdo->quote($scientificName))->fetchColumn();
        
        if ($speciesId) {
            // Ecological data
            $eco = $spData['ecological_constraints'] ?? [];
            $habitatVal = is_array($eco['habitat'] ?? '') ? implode(', ', $eco['habitat']) : ($eco['habitat'] ?? null);
            $altitudeVal = $eco['altitude_range'] ?? ($eco['altitude'] ?? null);
            $seasonVal = null;
            if (isset($eco['active_period'])) {
                $ap = $eco['active_period'];
                $seasonVal = is_array($ap) ? (($ap['months'] ?? '') . (isset($ap['region']) ? " ({$ap['region']})" : '')) : (string)$ap;
            } elseif (isset($eco['active_season'])) {
                $seasonVal = is_array($eco['active_season']) ? implode(', ', $eco['active_season']) : $eco['active_season'];
            } elseif (isset($eco['season'])) {
                $seasonVal = $eco['season'];
            }
            $notesVal = is_array($eco['notes'] ?? null) ? implode('; ', $eco['notes']) : ($eco['notes'] ?? null);
            
            if (!empty($habitatVal) || !empty($altitudeVal) || !empty($seasonVal) || !empty($notesVal)) {
                $pdo->prepare("INSERT OR IGNORE INTO ecological_constraints (species_id) VALUES (?)")->execute([$speciesId]);
                $pdo->prepare("UPDATE ecological_constraints SET habitat = COALESCE(NULLIF(?, ''), habitat), altitude = COALESCE(NULLIF(?, ''), altitude), season = COALESCE(NULLIF(?, ''), season), notes = COALESCE(NULLIF(?, ''), notes) WHERE species_id = ?")->execute([$habitatVal, $altitudeVal, $seasonVal, $notesVal, $speciesId]);
            }
            
            // Identification keys
            $keys = $spData['identification_keys'] ?? [];
            $morphTraits = $simSpecies = $keyDiffs = "";
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
            
            // Specimens
            $specimens = $data['specimen_records'] ?? [];
            if (!empty($specimens)) {
                $stmtSp = $pdo->prepare("INSERT OR IGNORE INTO specimen_records (species_id, gbif_occurrence_key, institution_code, collection_code, catalog_number, recorded_by, event_date, country, locality, decimal_latitude, decimal_longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                foreach ($specimens as $spec) {
                    $stmtSp->execute([$speciesId, $spec['gbif_occurrence_key'] ?? '', $spec['institution_code'] ?? '', $spec['collection_code'] ?? '', $spec['catalog_number'] ?? '', $spec['recorded_by'] ?? '', $spec['event_date'] ?? '', $spec['country'] ?? '', $spec['locality'] ?? '', $spec['decimal_latitude'] ?? null, $spec['decimal_longitude'] ?? null]);
                }
            }
        }
        
        $pdo->exec('COMMIT');
        @rename($file, $archiveDir . '/' . basename($file));
        echo "[" . date('H:i:s') . "] WRITE OK: $scientificName\n";
        return true;
        
    } catch (\Exception $e) {
        try { $pdo->exec('ROLLBACK'); } catch (\Exception $_) {}
        // Don't hang - just log and move on. File stays in spool for retry.
        echo "[" . date('H:i:s') . "] RETRY LATER: $scientificName (" . substr($e->getMessage(), 0, 50) . ")\n";
        return false;
    } finally {
        // CRITICAL: Close connection immediately
        $pdo = null;
    }
}

// Main loop
$consecutiveFails = 0;
while (true) {
    $files = glob($spoolDir . '/*.json');
    
    if (empty($files)) {
        usleep(500000);
        $consecutiveFails = 0;
        continue;
    }
    
    // Process up to 20 files per batch
    $batch = array_slice($files, 0, 20);
    $ok = 0;
    $fail = 0;
    
    foreach ($batch as $file) {
        if (writeOneFile($file, $dbPath, $archiveDir)) {
            $ok++;
            $consecutiveFails = 0;
        } else {
            $fail++;
            $consecutiveFails++;
        }
        
        // If we get too many consecutive fails, back off
        if ($consecutiveFails >= 5) {
            echo "[" . date('H:i:s') . "] Too many fails, backing off 10s...\n";
            sleep(10);
            $consecutiveFails = 0;
            break;
        }
    }
    
    // Brief pause between batches
    usleep(100000); // 100ms
}
