<?php

require_once __DIR__ . '/../config/config.php';

$queueFile = DATA_DIR . '/library/extraction_queue.json';
$queue = file_exists($queueFile) ? json_decode(file_get_contents($queueFile), true) : [];

echo "Current queue size: " . count($queue) . "\n";
echo "Injecting sample batch of 1000 species to flood the queue...\n";

// Generate 1000 sample names (Simulated from existing genera to look realistic)
$genera = ['Corvus', 'Buteo', 'Anas', 'Felis', 'Canis', 'Vulpes', 'Ursus', 'Panthera', 'Equus', 'Cervus'];
$specifics = ['albus', 'niger', 'rufus', 'major', 'minor', 'japonicus', 'chinensis', 'americanus', 'vulgaris', 'sylvestris'];

$totalAdded = 0;
for ($i = 0; $i < 1000; $i++) {
    // Generate a pseudo-realistic binominal name
    $g = $genera[array_rand($genera)];
    $s = $specifics[array_rand($specifics)];
    // Add a random number to guarantee uniqueness for 1000 items
    $name = $g . ' ' . $s . ' var. ' . str_pad($i, 4, '0', STR_PAD_LEFT);

    if (!isset($queue[$name])) {
        $queue[$name] = [
            'species_name' => $name,
            'status' => 'pending',
            'source' => 'sample_injection',
            'retries' => 0,
            'last_processed_at' => null,
            'error_message' => null
        ];
        $totalAdded++;
    }
}

file_put_contents($queueFile, json_encode($queue, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

echo "Injection Complete.\n";
echo "Added {$totalAdded} total new sample species to the extraction queue.\n";
echo "New Total Queue Size: " . count($queue) . "\n";
