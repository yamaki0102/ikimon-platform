<?php

/**
 * daemon_extraction_engine.php
 * Next Evolution: Continuous Autonomous Extraction Daemon
 * 
 * Runs the extraction engine continuously in the background.
 * Automatically manages memory and provides pacing.
 */

require_once __DIR__ . '/../config/config.php';

echo "============================================\n";
echo " Starting Continuous Extraction Daemon...\n";
echo " Model: Local Qwen 3 Swallow (8B) via Ollama\n";
echo " Target: 100,000 Species Repository\n";
echo "============================================\n";

// Execute self-healing mechanism on startup
echo " Running pre-flight self-healing sequence...\n";
exec("php " . __DIR__ . "/reset_stuck_queue.php");
echo " Pre-flight complete.\n";

$normalWorkers = 16;
$extremeWorkers = 16; // Extreme mode for 1 AM to 7 AM to maximize hardware limit
$batchSize = 10; // Process 10 species per worker loop
$maxIterations = 1000; // Restart daemon after 1000 loops to prevent PHP memory leaks
$iteration = 0;

while ($iteration < $maxIterations) {
    $iteration++;

    // Time-based dynamic concurrency (22 PM to 7 AM = Extreme Mode)
    $currentHour = (int)date('G'); // 24-hour format without leading zeros
    $isExtremeTime = ($currentHour >= 22 || $currentHour < 7);
    $concurrentWorkers = $isExtremeTime ? $extremeWorkers : $normalWorkers;

    echo "\n[Daemon Loop #{$iteration}] Spawning {$concurrentWorkers} parallel workers (Batch size: {$batchSize} each)...\n";
    if ($isExtremeTime) {
        echo " 🌙 EXTREME NIGHT MODE ACTIVE. maximizing GPU and network utilization...\n";
    }

    $cronScript = __DIR__ . '/cron_extraction_engine.php';
    $processes = [];

    for ($i = 0; $i < $concurrentWorkers; $i++) {
        $descriptorspec = [
            0 => ["pipe", "r"],
            1 => ["pipe", "w"],
            2 => ["pipe", "w"]
        ];
        $process = proc_open("php {$cronScript} none {$batchSize}", $descriptorspec, $pipes);
        if (is_resource($process)) {
            stream_set_blocking($pipes[1], false);
            stream_set_blocking($pipes[2], false);
            $processes[] = [
                'process' => $process,
                'pipes'   => $pipes,
                'id'      => $i + 1
            ];
        }
    }

    $active = true;
    while ($active) {
        $active = false;
        foreach ($processes as $key => &$pData) {
            $status = proc_get_status($pData['process']);
            $output = stream_get_contents($pData['pipes'][1]);
            $errorOutput = stream_get_contents($pData['pipes'][2]);
            if ($output) {
                // Formatting worker label
                $lines = explode("\n", trim($output));
                foreach ($lines as $l) {
                    echo "[W{$pData['id']}] " . $l . "\n";
                }
            }
            if ($errorOutput) {
                $lines = explode("\n", trim($errorOutput));
                foreach ($lines as $l) {
                    echo "[W{$pData['id']} ERROR] " . $l . "\n";
                }
            }
            if ($status['running']) {
                $active = true;
            } else {
                fclose($pData['pipes'][0]);
                fclose($pData['pipes'][1]);
                fclose($pData['pipes'][2]);
                proc_close($pData['process']);
                unset($processes[$key]);
            }
        }
        usleep(1000000); // 1s poll
    }

    echo "[Daemon] All {$concurrentWorkers} parallel workers finished.\n";
    sleep(1); // 1-second pause to prevent runaway CPU loops
}

echo "Daemon iteration limit reached or queue finished. Exiting safely.\n";
