<?php
require_once __DIR__ . '/../../config/config.php';
if (defined('GEMINI_API_KEY')) {
    echo "GEMINI_API_KEY is defined. Length: " . strlen(GEMINI_API_KEY) . "\n";
} else {
    echo "GEMINI_API_KEY is NOT defined.\n";
}
