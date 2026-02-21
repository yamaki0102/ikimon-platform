<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
$_GET['taxon'] = 'メダカ';
ob_start();
include __DIR__ . '/../public_html/species.php';
$out = ob_get_clean();
echo "SIZE: " . strlen($out) . " bytes\n";
if (strlen($out) < 2000) {
    echo "CONTENT:\n" . $out . "\n";
} else {
    echo "FIRST500:\n" . substr($out, 0, 500) . "\n";
    echo "---\nRL_BADGE: " . (strpos($out, 'CONSERVATION STATUS') !== false ? 'YES' : 'NO') . "\n";
    echo "MAP: " . (strpos($out, 'species-map') !== false ? 'YES' : 'NO') . "\n";
    echo "NAV: " . (strpos($out, 'nav') !== false ? 'YES' : 'NO') . "\n";
}
