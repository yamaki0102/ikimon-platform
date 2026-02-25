<?php

/**
 * daemon_prefetcher.php
 * Parallel Prefetcher Manager
 * 
 * Runs multiple multi_source_prefetcher.php concurrently to fetch
 * literature rapidly without getting blocked by a single slow thread.
 */

require_once __DIR__ . '/../config/config.php';

echo "============================================\n";
echo " Starting Parallel Prefetcher Daemon...\n";
echo "============================================\n";

$targetWorkers = 5;
$maxWorkersSpawned = 2000;

$script = __DIR__ . '/multi_source_prefetcher.php';
$processes = [];
$totalSpawned = 0;
$emptyQueueDetected = false;

while (true) {
    if ($totalSpawned >= $maxWorkersSpawned && empty($processes)) {
        break;
    }

    // 1. Replenish workers
    while (count($processes) < $targetWorkers && !$emptyQueueDetected && $totalSpawned < $maxWorkersSpawned) {
        $totalSpawned++;
        $descriptorspec = [
            0 => ["pipe", "r"],
            1 => ["pipe", "w"],
            2 => ["pipe", "w"]
        ];
        $process = proc_open("php {$script}", $descriptorspec, $pipes);
        if (is_resource($process)) {
            stream_set_blocking($pipes[1], false);
            stream_set_blocking($pipes[2], false);
            $processes[] = [
                'process' => $process,
                'pipes'   => $pipes,
                'id'      => $totalSpawned
            ];
            echo "[Daemon] Spawned prefetcher " . count($processes) . "/$targetWorkers\n";
        }
    }

    // 2. Monitor existing workers
    foreach ($processes as $key => &$pData) {
        $status = proc_get_status($pData['process']);
        $output = stream_get_contents($pData['pipes'][1]);
        $errorOutput = stream_get_contents($pData['pipes'][2]);

        if ($output) {
            $lines = explode("\n", trim($output));
            foreach ($lines as $l) if ($l) echo $l . "\n";
        }
        if ($errorOutput) {
            $lines = explode("\n", trim($errorOutput));
            foreach ($lines as $l) if ($l) echo "[P{$pData['id']} ERROR] " . $l . "\n";
        }

        if (!$status['running']) {
            fclose($pData['pipes'][0]);
            fclose($pData['pipes'][1]);
            fclose($pData['pipes'][2]);
            proc_close($pData['process']);

            if ($status['exitcode'] === 2) {
                $emptyQueueDetected = true;
            }

            unset($processes[$key]);
        }
    }

    // 3. Handle Empty Queue Sleep
    if ($emptyQueueDetected && count($processes) === 0) {
        echo "[Daemon] All prefetchers finished and queue is empty. Sleeping for 30s...\n";
        sleep(30);
        $emptyQueueDetected = false;
    }

    usleep(500000); // 0.5s poll
}

echo "Prefetcher Daemon spawn limit reached. Exiting safely.\n";
