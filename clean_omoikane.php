<?php
$dbPath = __DIR__ . '/upload_package/data/library/omoikane.sqlite3';
$db = new PDO("sqlite:$dbPath");

$keywords = [
    '%Key to%',
    '%Unknown%',
    '%概説続き%',
    '%系統分類%',
    '%出典%',
    '%参考文献%'
];

$totalDeleted = 0;
foreach ($keywords as $kw) {
    $stmt = $db->prepare("DELETE FROM species WHERE scientific_name LIKE :kw COLLATE NOCASE");
    $stmt->execute([':kw' => $kw]);
    $count = $stmt->rowCount();
    $totalDeleted += $count;
    echo "Deleted $count rows matching $kw.\n";
}

echo "Total deleted: $totalDeleted\n";
