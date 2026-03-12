<?php
/**
 * Taxonomy backbone update checker.
 * Run monthly via cron: php scripts/check_taxonomy_updates.php
 *
 * Checks:
 *   1. GBIF backbone dataset pubDate
 *   2. Spot-check sample taxa lineage against cached snapshots
 *
 * If changes detected → writes data/taxonomy/update_alert.json
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';

define('STATE_FILE', 'taxonomy/backbone_check_state');
define('ALERT_FILE', 'taxonomy/update_alert');

// GBIF backbone dataset UUID
define('GBIF_BACKBONE_UUID', 'd7dddbf4-2cf0-4f39-9b2a-bb099caae36c');

// Sample taxa to spot-check (mix of kingdoms, common species in ikimon data)
define('SPOT_CHECK_TAXA', [
    ['provider' => 'gbif', 'id' => 8357478, 'name' => 'Graptopsaltria nigrofuscata'],  // アブラゼミ
    ['provider' => 'gbif', 'id' => 2480528, 'name' => 'Prunus serrulata'],              // サクラ
    ['provider' => 'gbif', 'id' => 2435099, 'name' => 'Ardea cinerea'],                 // アオサギ
    ['provider' => 'inat', 'id' => 125742,  'name' => 'Prunus serrulata'],              // iNat サクラ
]);

function log_msg(string $msg): void
{
    echo date('[Y-m-d H:i:s] ') . $msg . "\n";
}

function fetch_json(string $url): ?array
{
    $ctx = stream_context_create(['http' => ['timeout' => 15, 'header' => "Accept: application/json\r\n"]]);
    $json = @file_get_contents($url, false, $ctx);
    if ($json === false) return null;
    return json_decode($json, true);
}

// --- Load previous state ---
$state = DataStore::get(STATE_FILE, 0) ?: [
    'gbif_pub_date' => null,
    'snapshots' => [],
    'last_checked' => null,
];

$changes = [];
$now = date('c');

// --- Check 1: GBIF backbone pubDate ---
log_msg("Checking GBIF backbone pubDate...");
$meta = fetch_json('https://api.gbif.org/v1/dataset/' . GBIF_BACKBONE_UUID);
if ($meta && isset($meta['pubDate'])) {
    $newPubDate = $meta['pubDate'];
    $oldPubDate = $state['gbif_pub_date'];
    if ($oldPubDate !== null && $oldPubDate !== $newPubDate) {
        $changes[] = [
            'type' => 'gbif_backbone_release',
            'old' => $oldPubDate,
            'new' => $newPubDate,
            'message' => "GBIF backbone updated: {$oldPubDate} → {$newPubDate}",
        ];
        log_msg("CHANGE DETECTED: GBIF backbone {$oldPubDate} → {$newPubDate}");
    } else {
        log_msg("GBIF backbone unchanged: {$newPubDate}");
    }
    $state['gbif_pub_date'] = $newPubDate;
} else {
    log_msg("WARNING: Could not fetch GBIF backbone metadata");
}

// --- Check 2: Spot-check sample taxa ---
log_msg("Spot-checking " . count(SPOT_CHECK_TAXA) . " sample taxa...");
foreach (SPOT_CHECK_TAXA as $taxon) {
    $provider = $taxon['provider'];
    $id = $taxon['id'];
    $label = $taxon['name'];
    $key = "{$provider}:{$id}";

    if ($provider === 'gbif') {
        $data = fetch_json("https://api.gbif.org/v1/species/{$id}");
        if (!$data) {
            log_msg("  SKIP {$key} ({$label}): fetch failed");
            continue;
        }
        $snapshot = [
            'key' => $data['key'] ?? null,
            'scientificName' => $data['scientificName'] ?? null,
            'rank' => $data['rank'] ?? null,
            'kingdom' => $data['kingdom'] ?? null,
            'phylum' => $data['phylum'] ?? null,
            'class' => $data['class'] ?? null,
            'order' => $data['order'] ?? null,
            'family' => $data['family'] ?? null,
            'genus' => $data['genus'] ?? null,
            'taxonomicStatus' => $data['taxonomicStatus'] ?? null,
            'acceptedKey' => $data['acceptedKey'] ?? null,
        ];
    } elseif ($provider === 'inat') {
        $data = fetch_json("https://api.inaturalist.org/v1/taxa/{$id}");
        $result = $data['results'][0] ?? null;
        if (!$result) {
            log_msg("  SKIP {$key} ({$label}): fetch failed");
            continue;
        }
        $ancestors = [];
        foreach (($result['ancestors'] ?? []) as $a) {
            $ancestors[] = $a['rank'] . ':' . $a['name'];
        }
        $snapshot = [
            'id' => $result['id'] ?? null,
            'name' => $result['name'] ?? null,
            'rank' => $result['rank'] ?? null,
            'is_active' => $result['is_active'] ?? null,
            'ancestors' => $ancestors,
        ];
    } else {
        continue;
    }

    $oldSnapshot = $state['snapshots'][$key] ?? null;
    if ($oldSnapshot !== null && $oldSnapshot !== $snapshot) {
        $diffs = [];
        foreach ($snapshot as $field => $newVal) {
            $oldVal = $oldSnapshot[$field] ?? null;
            if ($oldVal !== $newVal) {
                $diffs[$field] = ['old' => $oldVal, 'new' => $newVal];
            }
        }
        if (!empty($diffs)) {
            $changes[] = [
                'type' => 'taxon_lineage_change',
                'taxon_key' => $key,
                'taxon_name' => $label,
                'diffs' => $diffs,
                'message' => "{$label} ({$key}) lineage changed: " . implode(', ', array_keys($diffs)),
            ];
            log_msg("  CHANGE: {$label} ({$key}) — " . json_encode($diffs, JSON_UNESCAPED_UNICODE));
        }
    } else {
        log_msg("  OK: {$label} ({$key})");
    }

    $state['snapshots'][$key] = $snapshot;
}

// --- Save state ---
$state['last_checked'] = $now;
DataStore::save(STATE_FILE, $state);
log_msg("State saved.");

// --- Write alert if changes found ---
if (!empty($changes)) {
    $alert = [
        'detected_at' => $now,
        'change_count' => count($changes),
        'changes' => $changes,
        'action_required' => 'Run backfill_taxonomy_consensus.php after reviewing changes',
    ];
    DataStore::save(ALERT_FILE, $alert);
    log_msg("ALERT written: " . count($changes) . " change(s) detected. Review data/taxonomy/update_alert.json");
} else {
    // Clear old alert if everything is clean
    $existingAlert = DataStore::get(ALERT_FILE, 0);
    if ($existingAlert) {
        log_msg("No changes. Previous alert still on file — clear manually after review.");
    } else {
        log_msg("No changes detected. All clear.");
    }
}

log_msg("Done.");
