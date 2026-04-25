<?php
echo "allow_url_fopen: " . ini_get('allow_url_fopen') . "\n";
echo "openssl extension: " . (extension_loaded('openssl') ? 'Yes' : 'No') . "\n";

$url = "https://api.gbif.org/v1/species/suggest?q=test";
$res = @file_get_contents($url);
if ($res) {
    echo "Success: Fetched GBIF\n";
    echo substr($res, 0, 100) . "...\n";
} else {
    echo "Failed to fetch GBIF\n";
    $error = error_get_last();
    print_r($error);
}
