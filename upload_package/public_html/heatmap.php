<?php

/**
 * Heatmap Redirect — heatmap.php は map.php のヒートマップタブに統合されました
 */
require_once __DIR__ . '/../config/config.php';

$redirectUrl = 'map.php?tab=heatmap';
header('HTTP/1.1 301 Moved Permanently');
header('Location: ' . $redirectUrl);
exit;
