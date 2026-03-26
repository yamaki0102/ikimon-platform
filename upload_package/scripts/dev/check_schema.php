<?php
require_once __DIR__ . '/../libs/OmoikaneDB.php';
$db = new OmoikaneDB();
$pdo = $db->getPDO();
$tables = $pdo->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
echo "Tables in omoikane.sqlite3:\n";
foreach ($tables as $t) echo "  - $t\n";
echo "\n";

// Check specimen_records schema
$cols = $pdo->query("PRAGMA table_info(specimen_records)")->fetchAll();
echo "specimen_records columns:\n";
foreach ($cols as $c) echo "  {$c['name']} ({$c['type']})\n";
