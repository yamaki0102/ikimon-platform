<?php

/**
 * Backfill Location Data
 * 
 * Adds `country` and `municipality` fields to existing observations
 * using Nominatim reverse geocoding.
 * 
 * Usage: php scripts/backfill_location.php [--dry-run]
 * 
 * Nominatim policy: max 1 request/sec, User-Agent required.
 * @see https://operations.osmfoundation.org/policies/nominatim/
 */

require_once __DIR__ . '/../config/config.php';

$dryRun = in_array('--dry-run', $argv ?? []);
$file = DATA_DIR . '/observations.json';

if (!file_exists($file)) {
    echo "❌ observations.json not found at: {$file}\n";
    exit(1);
}

$observations = json_decode(file_get_contents($file), true);
if (!is_array($observations)) {
    echo "❌ Could not parse observations.json\n";
    exit(1);
}

echo "📊 Total observations: " . count($observations) . "\n";

$needsBackfill = 0;
$alreadyDone = 0;
$failed = 0;
$updated = 0;

foreach ($observations as &$obs) {
    // Skip if already has both fields
    if (!empty($obs['country']) && !empty($obs['municipality'])) {
        $alreadyDone++;
        continue;
    }

    $lat = $obs['lat'] ?? null;
    $lng = $obs['lng'] ?? null;

    if (!$lat || !$lng) {
        echo "  ⚠️ {$obs['id']}: No lat/lng, skipping\n";
        $failed++;
        continue;
    }

    $needsBackfill++;

    if ($dryRun) {
        echo "  🔍 [DRY RUN] Would geocode {$obs['id']}: ({$lat}, {$lng})\n";
        continue;
    }

    // Nominatim reverse geocoding
    $url = sprintf(
        'https://nominatim.openstreetmap.org/reverse?format=json&lat=%f&lon=%f&zoom=12&addressdetails=1&accept-language=ja',
        $lat,
        $lng
    );

    $ctx = stream_context_create([
        'http' => [
            'header' => "User-Agent: ikimon.life/1.0 (contact@ikimon.life)\r\n",
            'timeout' => 10,
        ]
    ]);

    $response = @file_get_contents($url, false, $ctx);

    if (!$response) {
        echo "  ❌ {$obs['id']}: Nominatim request failed\n";
        $failed++;
        // Respect rate limit even on failure
        sleep(1);
        continue;
    }

    $geo = json_decode($response, true);
    $address = $geo['address'] ?? [];

    // Extract country code (ISO 3166-1 alpha-2, uppercase)
    $countryCode = strtoupper($address['country_code'] ?? '');

    // Extract municipality (city > town > village > county)
    $municipality = $address['city']
        ?? $address['town']
        ?? $address['village']
        ?? $address['county']
        ?? $address['municipality']
        ?? '';

    // Extract state/prefecture for verification
    $state = $address['state'] ?? '';

    // Apply
    $obs['country'] = $countryCode;
    $obs['municipality'] = $municipality;

    // Also backfill prefecture if missing (using ISO mapping)
    if (empty($obs['prefecture']) && $countryCode === 'JP') {
        $obs['prefecture'] = japanStateToPrefCode($state);
    }

    $updated++;
    echo "  ✅ {$obs['id']}: {$countryCode} / {$state} / {$municipality}\n";

    // Rate limit: 1 req/sec
    sleep(1);
}
unset($obs);

if (!$dryRun && $updated > 0) {
    // Write back
    $json = json_encode($observations, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    file_put_contents($file, $json);
    echo "\n💾 Saved {$updated} updates to observations.json\n";
}

echo "\n📋 Summary:\n";
echo "  Already done: {$alreadyDone}\n";
echo "  Updated: " . ($dryRun ? "0 (dry run, {$needsBackfill} would be updated)" : $updated) . "\n";
echo "  Failed: {$failed}\n";
echo "  Total: " . count($observations) . "\n";


/**
 * Map Japanese state name to JP-XX prefecture code.
 */
function japanStateToPrefCode(string $state): string
{
    $map = [
        '北海道' => 'JP-01',
        '青森県' => 'JP-02',
        '岩手県' => 'JP-03',
        '宮城県' => 'JP-04',
        '秋田県' => 'JP-05',
        '山形県' => 'JP-06',
        '福島県' => 'JP-07',
        '茨城県' => 'JP-08',
        '栃木県' => 'JP-09',
        '群馬県' => 'JP-10',
        '埼玉県' => 'JP-11',
        '千葉県' => 'JP-12',
        '東京都' => 'JP-13',
        '神奈川県' => 'JP-14',
        '新潟県' => 'JP-15',
        '富山県' => 'JP-16',
        '石川県' => 'JP-17',
        '福井県' => 'JP-18',
        '山梨県' => 'JP-19',
        '長野県' => 'JP-20',
        '岐阜県' => 'JP-21',
        '静岡県' => 'JP-22',
        '愛知県' => 'JP-23',
        '三重県' => 'JP-24',
        '滋賀県' => 'JP-25',
        '京都府' => 'JP-26',
        '大阪府' => 'JP-27',
        '兵庫県' => 'JP-28',
        '奈良県' => 'JP-29',
        '和歌山県' => 'JP-30',
        '鳥取県' => 'JP-31',
        '島根県' => 'JP-32',
        '岡山県' => 'JP-33',
        '広島県' => 'JP-34',
        '山口県' => 'JP-35',
        '徳島県' => 'JP-36',
        '香川県' => 'JP-37',
        '愛媛県' => 'JP-38',
        '高知県' => 'JP-39',
        '福岡県' => 'JP-40',
        '佐賀県' => 'JP-41',
        '長崎県' => 'JP-42',
        '熊本県' => 'JP-43',
        '大分県' => 'JP-44',
        '宮崎県' => 'JP-45',
        '鹿児島県' => 'JP-46',
        '沖縄県' => 'JP-47',
    ];
    return $map[$state] ?? '';
}
