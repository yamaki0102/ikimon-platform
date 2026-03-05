<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Auth.php';

Auth::init();
header('Content-Type: application/json; charset=utf-8');

$id = $_GET['id'] ?? '';
$obs = DataStore::findById('observations', $id);

if (!$obs) {
    echo json_encode(['success' => false, 'message' => 'Observation not found'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Logic to generate Dr. Ikimon's comment
// In a real system, this might come from a human expert or a high-quality LLM.
// For MVP, we use templates based on the species identification status.

$identifications = $obs['identifications'] ?? [];
$comment = "";
$signature = "Dr. Ikimon (博士)";
$mood = "neutral"; // happy, excited, serious

if (empty($identifications)) {
    // No ID yet
    $comment = "ふむ、興味深い記録じゃな！この写真の特徴からすると…もう少し詳しい情報があると助かるぞ。例えば、周りの環境はどうだったかな？";
    $mood = "thinking";
} else {
    // Has ID - pick the top one
    $topID = end($identifications); // Get latest for now
    $name = $topID['taxon_name'];
    
    if ($obs['cultivation'] === 'wild') {
        $comment = "おお！これは「{$name}」じゃな！素晴らしい発見じゃ。野生の姿を捉えるとは、君の観察眼はなかなかのものじゃよ。この生き物は地域の生態系にとって非常に重要な役割を果たしておる。";
        $mood = "excited";
    } else {
        $comment = "なるほど、「{$name}」か。これは植栽または飼育されている個体のようじゃな。身近な自然としての関わり方もまた、大切な記録の一つじゃよ。";
        $mood = "calm";
    }
}

// Add random trivia if possible (Mock)
$trivia = [
    "知っておったか？この種は季節によって色が変化することがあるんじゃ。",
    "実はこの生き物、昔はもっとたくさんいたんじゃが、最近は少し減ってきておる。",
    "君の投稿のおかげで、また一つこの街の自然のパズルが埋まったぞ！"
];
$comment .= " " . $trivia[array_rand($trivia)];

echo json_encode([
    'success' => true,
    'expert' => [
        'name' => $signature,
        'avatar' => 'assets/img/dr_ikimon.png', // We need an asset for this, or use a placeholder
        'mood' => $mood
    ],
    'comment' => $comment,
    'created_at' => date('Y-m-d H:i:s')
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
