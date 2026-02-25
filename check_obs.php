<?php
echo "gc_max=" . ini_get('session.gc_maxlifetime') . "\n";
echo "gc_prob=" . ini_get('session.gc_probability') . "\n";
echo "gc_div=" . ini_get('session.gc_divisor') . "\n";
echo "save=" . ini_get('session.save_path') . "\n";

// Check token file paths
$candidates = [
    '/home/r1522484/public_html/ikimon.life/data/remember_tokens.json',
    '/home/r1522484/public_html/ikimon.life/data/tokens',
];
foreach ($candidates as $c) {
    echo "exists($c)=" . (file_exists($c) ? 'YES' : 'NO') . "\n";
}
// Search for any token file
$tokFiles = glob('/home/r1522484/public_html/ikimon.life/data/*token*');
echo "token_files=" . json_encode($tokFiles) . "\n";

// Check session age
$sessDir = '/home/r1522484/public_html/ikimon.life/data/sessions';
$files = scandir($sessDir);
$ages = [];
foreach ($files as $sf) {
    if ($sf === '.' || $sf === '..') continue;
    $ages[] = time() - filemtime("$sessDir/$sf");
}
sort($ages);
echo "sessions=" . count($ages) . "\n";
echo "newest_age=" . ($ages[0] ?? '?') . "s\n";
echo "oldest_age=" . end($ages) . "s\n";
