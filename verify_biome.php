<?php
require_once __DIR__ . '/upload_package/config/config.php';
require_once __DIR__ . '/upload_package/libs/Auth.php';
require_once __DIR__ . '/upload_package/libs/DataStore.php';
require_once __DIR__ . '/upload_package/libs/UserStore.php';

// Mock Login
$user = UserStore::findById('user_ya_001');
Auth::login($user);

// Prepare POST data
$url = 'http://localhost:8899/api/post_observation.php';
$data = [
    'csrf_token' => 'mock_token_bypass', // Needs CSRF bypass or valid token
    'lat' => 35.6895,
    'lng' => 139.6917,
    'biome' => 'forest',
    'note' => 'Testing Biome Intelligence',
    'observed_at' => date('Y-m-d H:i')
];

// Verify BiomeManager
require_once __DIR__ . '/upload_package/libs/BiomeManager.php';
echo "Biome 'forest' label: " . BiomeManager::getLabel('forest') . "\n";
echo "Biome 'invalid' isValid: " . (BiomeManager::isValid('invalid') ? 'YES' : 'NO') . "\n";

// We can't easily test the API via script without a running server and CSRF token.
// So we will verify the logic by simulating the backend process directly.

echo "--------------------------------------------------\n";
echo "Simulating Backend Logic...\n";

$biomeInput = 'forest';
if (!BiomeManager::isValid($biomeInput)) {
    $biomeInput = 'unknown';
}
echo "Input: forest -> Result: {$biomeInput}\n";

$biomeInput = 'invalid_biome';
if (!BiomeManager::isValid($biomeInput)) {
    $biomeInput = 'unknown';
}
echo "Input: invalid_biome -> Result: {$biomeInput}\n";

echo "--------------------------------------------------\n";
echo "Manual Verification Required:\n";
echo "1. Open post.php in browser\n";
echo "2. Select '森林 (Forest)' in Biome dropdown\n";
echo "3. Post observation\n";
echo "4. Check data/observations/YYYY-MM.json for 'biome': 'forest'\n";
