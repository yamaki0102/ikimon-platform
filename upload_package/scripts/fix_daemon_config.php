<?php
// Fix the broken daemon file - replace the config block precisely
$file = '/home/yamaki/projects/ikimon-platform/upload_package/scripts/daemon_extraction_engine.php';
$content = file_get_contents($file);

// Find and replace the broken config section
// Current state: $normalWorkers = 6; then broken " = 8;" then $batchSize = 3;
$pattern = '/\$normalWorkers\s*=\s*\d+;\s*\n.*= 8;.*\n\$batchSize\s*=\s*\d+;/';
$replacement = <<<'PHP'
$normalWorkers = 6;
$extremeWorkers = 8;
$batchSize = 3;
PHP;

$content = preg_replace($pattern, $replacement, $content);
file_put_contents($file, $content);
echo "Fixed!\n";

// Verify
$lines = file($file);
for ($i = 25; $i < 35 && $i < count($lines); $i++) {
    echo ($i + 1) . ': ' . $lines[$i];
}
