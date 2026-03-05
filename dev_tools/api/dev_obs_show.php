<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
$latest = DataStore::getLatest('observations', 1);
echo json_encode($latest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
