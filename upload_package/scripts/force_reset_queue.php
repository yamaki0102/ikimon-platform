<?php
$f = __DIR__ . '/../data/library/extraction_queue.json';
$q = json_decode(file_get_contents($f), true);
foreach ($q as &$i) {
    if (in_array($i['status'], ['processing', 'fetching_gbif'])) {
        $i['status'] = 'pending';
    }
}
file_put_contents($f, json_encode($q, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
echo "Done.\n";
