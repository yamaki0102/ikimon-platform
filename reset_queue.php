<?php
$f = __DIR__ . "/upload_package/data/library/extraction_queue.json";
$d = json_decode(file_get_contents($f), true);
$count = 0;
foreach ($d as &$v) {
    if (isset($v["status"]) && $v["status"] === "processing") {
        $v["status"] = "pending";
        $count++;
    }
}
file_put_contents($f, json_encode($d, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
echo "Reset $count stuck jobs.\n";
