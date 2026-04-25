<?php

/**
 * Observation Validation API
 *
 * Provides "Soft Validation Alarms" by checking observation data (date, location)
 * against distilled ecological constraints for the selected taxon.
 * Uses Gemini API for semantic comparison if constraints exist.
 */
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/Services/LibraryService.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$taxonSlug = $_POST['taxon_slug'] ?? '';
$taxonName = $_POST['taxon_name'] ?? '';
$lat = $_POST['lat'] ?? '';
$lng = $_POST['lng'] ?? '';
$observedAt = $_POST['observed_at'] ?? '';
$sciName = $_POST['sci_name'] ?? ''; // Pass sci_name from frontend if available

if (!$taxonSlug && !$sciName) {
    echo json_encode(['has_constraints' => false, 'has_warnings' => false, 'warnings' => []]);
    exit;
}

// 1. Fetch ecological constraints
$knowledge = LibraryService::getDistilledKnowledgeForTaxon($sciName ?: $taxonName);
$constraints = $knowledge['ecological_constraints'] ?? [];

if (empty($constraints['habitat']) && empty($constraints['altitude_range']) && empty($constraints['active_season'])) {
    // No constraints available to validate against
    echo json_encode(['has_constraints' => false, 'has_warnings' => false, 'warnings' => []]);
    exit;
}

// 2. Prepare data for Gemini validation
$prompt = "You are an AI assistant supporting a citizen science platform. A user has just submitted a wildlife observation.
IMPORTANT DIRECTIVES REGARDING TONE:
1. You must be extremely positive, encouraging, and respectful. Users are volunteering their time; posting anything at all is great.
2. ABSOLUTELY DO NOT complain, nitpick, or sound like you are doubting their identification expertise.
3. If there is a massive discrepancy between the observation and known constraints, frame it as a 'potential amazing discovery (大発見)', a 'rare valuable record (貴重な記録)', and gently suggest a double-check ('念のため') rather than saying 'This is probably a mistake'.

Observation Data:
- Taxon: {$taxonName} ({$sciName})
- Location: Latitude {$lat}, Longitude {$lng}
- Date observed: {$observedAt}

Known Ecological Constraints for this taxon:
" . json_encode($constraints, JSON_UNESCAPED_UNICODE) . "

Evaluate the observation against these constraints. Are there any significant mismatches (e.g., summer insect reported in mid-winter)?
Respond in JSON format:
{
    \"has_warnings\": boolean,
    \"warnings\": [
        {
            \"type\": \"season\" | \"habitat\" | \"altitude\" | \"other\",
            \"message\": \"Short, extremely positive message in Japanese (e.g. 'すごい大発見かもしれません！図鑑では主に夏に活動するとされていますが、もしこの時期に観察できたなら貴重な記録です。念の為、似ている別の種がないかも見比べてみてくださいね！')\"
        }
    ]
}
If there are no clear mismatches, return has_warnings: false and empty warnings.
";

// 3. Call Gemini API
$apiKey = defined('GEMINI_API_KEY') ? GEMINI_API_KEY : '';
if (!$apiKey) {
    echo json_encode(['warnings' => []]);
    exit;
}

$url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" . $apiKey;
$data = [
    "contents" => [
        [
            "parts" => [
                ["text" => $prompt]
            ]
        ]
    ],
    "generationConfig" => [
        "response_mime_type" => "application/json",
        "temperature" => 0.2
    ]
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_TIMEOUT, 10); // Keep it relatively fast

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200 || !$response) {
    // Fail silently on API error for soft alarms
    echo json_encode(['warnings' => []]);
    exit;
}

$responseData = json_decode($response, true);
$text = $responseData['candidates'][0]['content']['parts'][0]['text'] ?? '{}';
$result = json_decode($text, true);

echo json_encode([
    'has_constraints' => true,
    'has_warnings' => $result['has_warnings'] ?? false,
    'warnings' => $result['warnings'] ?? []
], JSON_UNESCAPED_UNICODE);
