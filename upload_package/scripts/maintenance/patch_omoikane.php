<?php
// Read the original
$file = "/home/yamaki/projects/ikimon-platform/upload_package/libs/OmoikaneDB.php";
$content = file_get_contents($file);

if (strpos($content, 'specimen_records') !== false) {
    echo "Already patched!\n";
    exit(0);
}

$newTable = '
        // Table: specimen_records (Museum Specimen Data from GBIF)
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS specimen_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                species_id INTEGER NOT NULL,
                gbif_occurrence_key TEXT,
                institution_code TEXT,
                collection_code TEXT,
                catalog_number TEXT,
                recorded_by TEXT,
                event_date TEXT,
                country TEXT,
                locality TEXT,
                decimal_latitude REAL,
                decimal_longitude REAL,
                basis_of_record TEXT DEFAULT \'PRESERVED_SPECIMEN\',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (species_id) REFERENCES species(id) ON DELETE CASCADE,
                UNIQUE(gbif_occurrence_key)
            )
        ");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_specimen_species ON specimen_records(species_id);");

';

$marker = '        // --- Reverse-Lookup Indexes ---';
$content = str_replace($marker, $newTable . $marker, $content);
// Write to tmp
file_put_contents("/tmp/OmoikaneDB_patched.php", $content);
echo "Written to /tmp/OmoikaneDB_patched.php (" . substr_count($content, "\n") . " lines)\n";
