<?php
require_once __DIR__ . '/../config/config.php';

$queueFile = DATA_DIR . '/extraction_queue.json';

if (!file_exists($queueFile)) {
    echo "Queue file not found.\n";
    exit(1);
}

function updateHeartbeat($statusFile, $pid, $name, $status)
{
    if (!file_exists($statusFile)) {
        file_put_contents($statusFile, json_encode([$pid => ['name' => $name, 'status' => $status, 'updated_at' => time()]]));
        return;
    }

    $fp = fopen($statusFile, 'c+');
    if ($fp && flock($fp, LOCK_EX)) {
        clearstatcache(true, $statusFile);
        $sz = filesize($statusFile);
        $data = json_decode($sz > 0 ? fread($fp, $sz) : '', true) ?: [];
        $data[$pid] = ['name' => $name, 'status' => $status, 'updated_at' => time()];
        ftruncate($fp, 0);
        fseek($fp, 0);
        fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
    }
}

$workerStatusFile = DATA_DIR . '/library/worker_heartbeats.json';
$myPid = getmypid();

echo "Starting GBIF Literature Prefetcher (1 request/sec)...\n";

while (true) {
    if (!file_exists($queueFile)) break;
    $queue = json_decode(file_get_contents($queueFile), true);
    if (!is_array($queue)) break;

    $foundPending = false;
    foreach ($queue as $id => &$item) {
        if ($item['status'] === 'pending') {
            $foundPending = true;
            $searchTerm = $item['name'];
            echo "Fetching GBIF Literature for: $searchTerm...\n";
            updateHeartbeat($workerStatusFile, $myPid, "✨ Prefetcher", "GBIF探索中: " . mb_strimwidth($searchTerm, 0, 15, "..."));

            // Mark as fetching temporary to avoid other prefetchers running concurrently
            $item['status'] = 'fetching_gbif';
            file_put_contents($queueFile, json_encode($queue, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

            // Fetch GBIF
            $apiUrl = "https://api.gbif.org/v1/literature/search?q=" . urlencode($searchTerm) . "&limit=3";
            $ch = curl_init($apiUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 30);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
            $gbifJson = curl_exec($ch);

            if (curl_errno($ch)) {
                echo "cURL error on GBIF fetch: " . curl_error($ch) . "\n";
                curl_close($ch);
                // Revert to pending for retry
                $queue = json_decode(file_get_contents($queueFile), true);
                if (isset($queue[$id]) && $queue[$id]['status'] === 'fetching_gbif') {
                    $queue[$id]['status'] = 'pending';
                    file_put_contents($queueFile, json_encode($queue, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
                }
                sleep(2);
                continue; // Move to next or retry
            }
            curl_close($ch);
            $gbifData = json_decode($gbifJson, true);

            // Re-read queue in case of other changes
            $queue = json_decode(file_get_contents($queueFile), true);
            if (!isset($queue[$id]) || $queue[$id]['status'] !== 'fetching_gbif') {
                continue; // Someone else modified it?
            }

            if (empty($gbifData['results'])) {
                echo " -> No literature found.\n";
                $queue[$id]['status'] = 'no_literature';
            } else {
                $validLiterature = [];
                foreach ($gbifData['results'] as $paper) {
                    $doi = $paper['identifiers']['doi'] ?? ($paper['id'] ?? uniqid());
                    $abstract = $paper['abstract'] ?? '';
                    if (strlen(trim($abstract)) < 50) continue;
                    $validLiterature[] = [
                        'doi' => $doi,
                        'title' => $paper['title'] ?? '',
                        'abstract' => $abstract
                    ];
                }

                if (empty($validLiterature)) {
                    echo " -> No valid abstracts found.\n";
                    $queue[$id]['status'] = 'no_literature';
                } else {
                    echo " -> Found " . count($validLiterature) . " valid papers.\n";
                    $queue[$id]['status'] = 'literature_ready';
                    $queue[$id]['prefetched_literature'] = $validLiterature;
                }
            }

            file_put_contents($queueFile, json_encode($queue, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

            // Polite delay (1 second) to spare GBIF API
            usleep(1000000);
            break; // Break the foreach to re-read the array from disk and start over
        }
    }

    if (!$foundPending) {
        echo "No pending items. Sleeping 10s...\n";
        sleep(10);
    }
}
