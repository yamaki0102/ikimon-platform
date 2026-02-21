<?php

/**
 * post_identification_v2.php — Redirect to unified v1 API
 * 
 * This endpoint has been merged into post_identification.php.
 * All v2 features (evidence, TrustLevel) are now supported by v1.
 * This file exists for backward compatibility only.
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';

Auth::init();

// Forward the request to the unified API
$input = file_get_contents('php://input');

// Internal include approach (avoid HTTP redirect overhead)
$_SERVER['SCRIPT_FILENAME'] = __DIR__ . '/post_identification.php';
include __DIR__ . '/post_identification.php';
