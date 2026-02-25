<?php
require_once __DIR__ . '/../config/config.php';

$dbFile = DATA_DIR . '/omoikane.sqlite';
echo "DB: $dbFile\n";
echo "Exists: " . (file_exists($dbFile) ? 'YES' : 'NO') . "\n\n";

$db = new PDO("sqlite:$dbFile");
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// List tables
$tables = $db->query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")->fetchAll(PDO::FETCH_COLUMN);
echo "Tables: " . implode(', ', $tables) . "\n\n";

// For each table, show schema and count
foreach ($tables as $table) {
    $count = $db->query("SELECT COUNT(*) FROM `$table`")->fetchColumn();
    echo "=== $table ($count rows) ===\n";

    $cols = $db->query("PRAGMA table_info(`$table`)")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($cols as $col) {
        echo "  {$col['name']} ({$col['type']})\n";
    }

    // Show first 3 rows
    if ($count > 0) {
        $rows = $db->query("SELECT * FROM `$table` LIMIT 3")->fetchAll(PDO::FETCH_ASSOC);
        echo "\n  Sample rows:\n";
        foreach ($rows as $i => $row) {
            echo "  [$i] ";
            foreach ($row as $k => $v) {
                $v = mb_strimwidth((string)$v, 0, 80, '...');
                echo "$k=" . json_encode($v, JSON_UNESCAPED_UNICODE) . " | ";
            }
            echo "\n";
        }
    }
    echo "\n";
}
