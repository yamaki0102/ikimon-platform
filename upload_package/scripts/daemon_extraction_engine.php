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
// Clear stale worker heartbeats from previous runs
$heartbeatFile = DATA_DIR . '/library/worker_heartbeats.json';
file_put_contents($heartbeatFile, '{}');
echo " Pre-flight complete.\n";

// Start DB Writer Daemon (Single Process JSON Spooler)
$writerScript = __DIR__ . '/daemon_db_writer.php';
$writerProcess = proc_open("php {$writerScript}", [0=>["pipe","r"],1=>["pipe","w"],2=>["pipe","w"]], $wPipes);
if (is_resource($writerProcess)) {
    echo " Started JSON Spool DB Writer (PID: " . proc_get_status($writerProcess)['pid'] . ")\n";
    // We intentionally do not close the pipes or process here so it runs alongside this daemon.
    // When this daemon dies, the writer might die or become orphaned, which is fine since the full_restart script kills all.
}

$normalWorkers = 4;
$extremeWorkers = 4;
$batchSize = 3;
$maxWorkersSpawned = 5000; // Restart daemon after 5000 spawns to prevent memory leaks

$cronScript = __DIR__ . '/cron_extraction_engine.php';
$processes = [];
$totalSpawned = 0;
$emptyQueueDetected = false;
$lastSweepTime = time();

while (true) {
    if ($totalSpawned >= $maxWorkersSpawned && empty($processes)) {
        break; // Reached limit and all workers finished
    }

    // Time-based dynamic concurrency (22 PM to 7 AM = Extreme Mode)
    $currentHour = (int)date('G'); // 24-hour format without leading zeros
    $isExtremeTime = ($currentHour >= 22 || $currentHour < 7);
    $targetWorkers = $isExtremeTime ? $extremeWorkers : $normalWorkers;

    // 1. Replenish workers up to target limit
    while (count($processes) < $targetWorkers && !$emptyQueueDetected && $totalSpawned < $maxWorkersSpawned) {
        $totalSpawned++;
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
                'id'      => $totalSpawned
            ];
            // Only output if we are not rapidly spinning
            if ($totalSpawned % 16 === 0) echo "[Daemon] Spawned up to 16 workers. Current count: " . count($processes) . "\n";
        }
    }

    // 2. Monitor existing workers
    foreach ($processes as $key => &$pData) {
        $status = proc_get_status($pData['process']);
        $output = stream_get_contents($pData['pipes'][1]);
        $errorOutput = stream_get_contents($pData['pipes'][2]);

        if ($output) {
            $lines = explode("\n", trim($output));
            foreach ($lines as $l) if ($l) echo "[W{$pData['id']}] " . $l . "\n";
        }
        if ($errorOutput) {
            $lines = explode("\n", trim($errorOutput));
            foreach ($lines as $l) if ($l) echo "[W{$pData['id']} ERROR] " . $l . "\n";
        }

        if (!$status['running']) {
            fclose($pData['pipes'][0]);
            fclose($pData['pipes'][1]);
            fclose($pData['pipes'][2]);
            proc_close($pData['process']);

            // Check if queue empty (exit code 2)
            if ($status['exitcode'] === 2) {
                $emptyQueueDetected = true;
            }

            unset($processes[$key]);
        }
    }

    // 3. Handle Empty Queue Sleep
    if ($emptyQueueDetected && count($processes) === 0) {
        echo "[Daemon] All workers finished and queue is empty. Sleeping for 30s...\n";
        sleep(30);
        $emptyQueueDetected = false; // Reset to try again

        // Run stuck sweep before polling again
        echo "[Daemon] Running stuck-item sweep before next cycle...\n";
        exec("php " . __DIR__ . "/reset_stuck_queue.php");
        $lastSweepTime = time();
    }

    // 4. Periodic Stuck Item Sweep (Every 5 minutes)
    if (time() - $lastSweepTime > 300) {
        echo "[Daemon] Running periodic stuck-item sweep...\n";
        exec("php " . __DIR__ . "/reset_stuck_queue.php");
        $lastSweepTime = time();
    }

    usleep(500000); // 0.5s poll
}

echo "Daemon spawn limit reached or queue finished. Exiting safely.\n";
