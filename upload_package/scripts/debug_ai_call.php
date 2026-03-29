<?php
require_once __DIR__ . '/../config/config.php';
require_once ROOT_DIR . '/libs/DataStore.php';
require_once ROOT_DIR . '/libs/AiObservationAssessment.php';
require_once ROOT_DIR . '/libs/Taxonomy.php';

$obsId = $argv[1] ?? 'b393d391-4ce2-4bc2-95bb-a01df04f68b1';
$obs = DataStore::findById('observations', $obsId);
if (!$obs) { echo "NOT FOUND\n"; exit(1); }

$photos = $obs['photos'] ?? [];
echo "Photos: " . count($photos) . "\n";

// Manually call the model to see raw response
$images = [];
foreach ($photos as $p) {
    $path = PUBLIC_DIR . '/' . ltrim($p, '/');
    if (!is_file($path)) continue;
    $mime = mime_content_type($path) ?: 'image/webp';
    $data = base64_encode(file_get_contents($path));
    // Resize not needed for debug - but limit to 512px to keep request small
    $images[] = ['mime' => $mime, 'data' => $data];
}

echo "Loaded images: " . count($images) . "\n";

$model = 'gemini-3.1-flash-lite-preview';
$url = 'https://generativelanguage.googleapis.com/v1beta/models/' . $model . ':generateContent?key=' . GEMINI_API_KEY;

$prompt = 'この写真の生物を同定してください。候補をJSON suggestionsで返してください。{"suggestions":[{"label":"種名","confidence":"high|medium|low","reason":"理由"}]}';

$parts = [['text' => $prompt]];
foreach ($images as $img) {
    $parts[] = ['inline_data' => ['mime_type' => $img['mime'], 'data' => $img['data']]];
}

$request = [
    'contents' => [['parts' => $parts]],
    'generationConfig' => [
        'temperature' => 0.1,
        'maxOutputTokens' => 720,
    ],
];

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode($request, JSON_UNESCAPED_UNICODE),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

echo "HTTP: $httpCode\n";
if ($error) echo "Error: $error\n";

$decoded = json_decode($response, true);
$text = $decoded['candidates'][0]['content']['parts'][0]['text'] ?? '';
$finishReason = $decoded['candidates'][0]['finishReason'] ?? 'unknown';
$blockReason = $decoded['promptFeedback']['blockReason'] ?? 'none';

echo "Finish reason: $finishReason\n";
echo "Block reason: $blockReason\n";
echo "Response text:\n$text\n";
