<?php
$f = __DIR__ . '/../data/library/extraction_queue.json';
$q = json_decode(file_get_contents($f), true);
$c = 0;
foreach ($q as &$i) {
    if ($i['status'] == 'fetching_lit') {
        $i['status'] = 'pending';
        $c++;
    }
}
file_put_contents($f, json_encode($q, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
echo 'Reset ' . $c . " items.\n";
