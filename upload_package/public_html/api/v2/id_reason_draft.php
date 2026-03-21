<?php
/**
 * ID Reason Draft API — Phase 16
 *
 * POST /api/v2/id_reason_draft.php
 * Body: { "species_name": "スズメ", "scientific_name": "Passer montanus" }
 *
 * GPT-5.4 nano が同定理由のドラフトを自動生成
 */

require_once __DIR__ . '/../../../config/config.php';
require_once __DIR__ . '/../../../libs/OpenAiClient.php';
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('Method not allowed', 405);
}

session_start();
$userId = $_SESSION['user_id'] ?? '';
if (empty($userId)) {
    api_error('Login required', 401);
}

api_rate_limit('id_reason', 10, 60);

$body = api_json_body();
$speciesName = $body['species_name'] ?? '';
$scientificName = $body['scientific_name'] ?? '';

if (empty($speciesName)) {
    api_error('species_name is required', 400);
}

if (!OpenAiClient::isConfigured()) {
    api_error('AI not configured', 503);
}

// Omoikane の identification_keys を取得（利用可能な場合）
$idKeys = '';
try {
    if (file_exists(ROOT_DIR . '/libs/OmoikaneDB.php')) {
        require_once ROOT_DIR . '/libs/OmoikaneDB.php';
        $db = OmoikaneDB::getInstance();
        $keys = $db->getIdentificationKeys($scientificName ?: $speciesName);
        if (!empty($keys)) {
            $keyTexts = [];
            foreach ($keys as $k) {
                $traits = $k['morphological_traits'] ?? '';
                $similar = $k['similar_species'] ?? '';
                $diff = $k['key_differences'] ?? '';
                if ($traits) $keyTexts[] = "形態: {$traits}";
                if ($similar) $keyTexts[] = "類似種: {$similar}";
                if ($diff) $keyTexts[] = "識別点: {$diff}";
            }
            $idKeys = implode("\n", $keyTexts);
        }
    }
} catch (\Throwable $e) {
    // Non-fatal
}

$systemPrompt = <<<PROMPT
あなたは生物同定の専門家です。
種名と識別情報から、この同定の理由を簡潔に日本語で説明してください。
初心者にもわかりやすく、具体的な形態特徴に触れてください。
2〜3文で簡潔に。
PROMPT;

$userMessage = "種名: {$speciesName}";
if ($scientificName) $userMessage .= "\n学名: {$scientificName}";
if ($idKeys) $userMessage .= "\n\n参考情報:\n{$idKeys}";
$userMessage .= "\n\nこの種と同定した理由を2〜3文で書いてください。";

$result = OpenAiClient::generateText($systemPrompt, $userMessage, [
    'max_tokens' => 200,
    'temperature' => 0.5,
]);

if ($result === null) {
    api_error('AI生成に失敗しました', 503);
}

api_success([
    'draft' => $result,
    'species_name' => $speciesName,
    'has_omoikane_data' => !empty($idKeys),
]);
