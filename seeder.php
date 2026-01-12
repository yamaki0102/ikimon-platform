<?php
require_once __DIR__ . '/upload_package/config/config.php';
require_once __DIR__ . '/upload_package/libs/DataStore.php';

$seedVersion = '2026-01-full';

// Ensure data directory exists
if (!file_exists(DATA_DIR)) {
    mkdir(DATA_DIR, 0777, true);
}

// Ensure uploads directory exists
if (!file_exists(PUBLIC_DIR . '/uploads')) {
    mkdir(PUBLIC_DIR . '/uploads', 0777, true);
}

// --- 1. Generate Realistic Dummy Users ---
$familyNames = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '斎藤', '清水', '山崎', '森', '池田', '橋本', '阿部', '石川', '山下', '中島', '石井', '小川'];
$givenNames = ['大輔', '誠', '直人', '健一', '陽子', '美咲', '愛', '智子', '真由美', '健太', '翔太', '大樹', '翼', '拓海', '葵', 'さくら', '陽菜', '結衣', '美優', '七海', '一郎', '次郎', '三郎', '花子', '太郎', 'ゆかり', 'あゆみ', '剛', '恵', '崇'];
$ranks = ['ビギナー', 'ビギナー', 'ビギナー', '観察者', '観察者', '観察者', '観察者', '熟練者', '熟練者', '認定研究者', '博士'];

$existingUsers = DataStore::get('users');
$seedExists = false;
foreach ($existingUsers as $u) {
    if (!empty($u['is_seed']) && ($u['seed_version'] ?? '') === $seedVersion) {
        $seedExists = true;
        break;
    }
}

$users = $existingUsers;
if (!$seedExists) {
    for ($i = 0; $i < 50; $i++) {
        $uid = uniqid('seed_');
        $lname = $familyNames[array_rand($familyNames)];
        $fname = $givenNames[array_rand($givenNames)];
        $users[] = [
            'id' => $uid,
            'name' => $lname . ' ' . $fname,
            'rank' => $ranks[array_rand($ranks)],
            'role' => 'Observer',
            'avatar' => "https://i.pravatar.cc/150?u={$uid}",
            'is_seed' => true,
            'seed_version' => $seedVersion
        ];
    }
}

// --- 2. Taxonomy & Images ---
$taxa = [
    'insect' => [
        ['name' => 'アブラゼミ', 'scientific_name' => 'Graptopsaltria nigrofuscata'],
        ['name' => 'ミンミンゼミ', 'scientific_name' => 'Hyalessa maculaticollis'],
        ['name' => 'カブトムシ', 'scientific_name' => 'Trypoxylus dichotomus'],
        ['name' => 'モンシロチョウ', 'scientific_name' => 'Pieris rapae'],
        ['name' => 'オニヤンマ', 'scientific_name' => 'Anotogaster sieboldii'],
        ['name' => 'ショウリョウバッタ', 'scientific_name' => 'Acrida cinerea'],
        ['name' => 'ナナホシテントウ', 'scientific_name' => 'Coccinella septempunctata'],
    ],
    'plant' => [
        ['name' => 'セイヨウタンポポ', 'scientific_name' => 'Taraxacum officinale'],
        ['name' => 'ドクダミ', 'scientific_name' => 'Houttuynia cordata'],
        ['name' => 'オオバコ', 'scientific_name' => 'Plantago asiatica'],
        ['name' => 'ススキ', 'scientific_name' => 'Miscanthus sinensis'],
        ['name' => 'ヒメジョオン', 'scientific_name' => 'Erigeron annuus'],
        ['name' => 'シロツメクサ', 'scientific_name' => 'Trifolium repens'],
        ['name' => 'ツユクサ', 'scientific_name' => 'Commelina communis'],
    ],
    'bird' => [
        ['name' => 'ハシブトガラス', 'scientific_name' => 'Corvus macrorhynchos'],
        ['name' => 'スズメ', 'scientific_name' => 'Passer montanus'],
        ['name' => 'ヒヨドリ', 'scientific_name' => 'Hypsipetes amaurotis'],
        ['name' => 'キジバト', 'scientific_name' => 'Streptopelia orientalis'],
        ['name' => 'ツバメ', 'scientific_name' => 'Hirundo rustica'],
        ['name' => 'シジュウカラ', 'scientific_name' => 'Parus minor'],
    ],
    'fish' => [
        ['name' => 'コイ', 'scientific_name' => 'Cyprinus carpio'],
        ['name' => 'フナ', 'scientific_name' => 'Carassius'],
        ['name' => 'メダカ', 'scientific_name' => 'Oryzias latipes'],
        ['name' => 'ナマズ', 'scientific_name' => 'Silurus asotus'],
        ['name' => 'オイカワ', 'scientific_name' => 'Opsariichthys platypus'],
    ],
    'mammal' => [
        ['name' => 'タヌキ', 'scientific_name' => 'Nyctereutes procyonoides'],
        ['name' => 'アライグマ', 'scientific_name' => 'Procyon lotor'],
        ['name' => 'ノネコ', 'scientific_name' => 'Felis catus'],
        ['name' => 'ニホンイタチ', 'scientific_name' => 'Mustela itatsi'],
        ['name' => 'ハクビシン', 'scientific_name' => 'Paguma larvata'],
    ],
    'flower' => [
         ['name' => 'アジサイ', 'scientific_name' => 'Hydrangea macrophylla'],
         ['name' => 'アサガオ', 'scientific_name' => 'Ipomoea nil'],
         ['name' => 'ヒマワリ', 'scientific_name' => 'Helianthus annuus'],
    ]
];

// Map categories to the generated images
$images = [
    'insect' => 'uploads/sample_insect.png',
    'plant' => 'uploads/sample_plant.png',
    'bird' => 'uploads/sample_bird.png',
    'fish' => 'uploads/sample_fish.png',
    'mammal' => 'uploads/sample_mammal.png',
    'flower' => 'uploads/sample_flower.png',
];

$statuses = ['Research Grade', 'Research Grade', 'Research Grade', 'Needs ID', 'Needs ID', 'Casual'];

// Hamamatsu Coordinates
$baseLat = 34.7108;
$baseLng = 137.7261;

$existingObs = DataStore::get('observations');
$seedObsExists = false;
foreach ($existingObs as $o) {
    if (!empty($o['is_seed']) && ($o['seed_version'] ?? '') === $seedVersion) {
        $seedObsExists = true;
        break;
    }
}

$observations = $existingObs;
$total_obs = 200; // Generate 200 observations

if (!$seedObsExists) for ($i = 0; $i < $total_obs; $i++) {
    $category = array_rand($taxa);
    $taxon = $taxa[$category][array_rand($taxa[$category])];
    $user = $users[array_rand($users)];

    // Random location around Hamamatsu (spread out a bit more)
    $lat = $baseLat + (mt_rand(-8000, 8000) / 100000);
    $lng = $baseLng + (mt_rand(-8000, 8000) / 100000);

    // Random date in last 6 months
    $timestamp = time() - mt_rand(0, 180 * 24 * 60 * 60);
    $date = date('Y-m-d H:i:s', $timestamp);

    // Vary the note slightly
    $notes = [
        '公園で見つけました。', '家の近くです。', 'これは何でしょうか？', '綺麗な色でした。',
        '初めて見ました！', '大量に発生していました。', '動きが早かった。', '', '', ''
    ];

    $obs = [
        'id' => uniqid('obs_'),
        'user_id' => $user['id'],
        'user_name' => $user['name'],
        'user_avatar' => $user['avatar'],
        'user_rank' => $user['rank'],
        'photos' => [$images[$category]],
        'observed_at' => $date,
        'created_at' => $date,
        'lat' => $lat,
        'lng' => $lng,
        'cultivation' => (mt_rand(0, 10) > 8) ? 'cultivated' : 'wild',
        'note' => $notes[array_rand($notes)] . ' #' . ($i + 1),
        'status' => $statuses[array_rand($statuses)],
        'taxon' => [
            'key' => md5($taxon['scientific_name']),
            'name' => $taxon['name'],
            'scientific_name' => $taxon['scientific_name'],
            'rank' => 'species'
        ],
        'is_seed' => true,
        'seed_version' => $seedVersion
    ];

    $observations[] = $obs;
}

// Sort by date desc
usort($observations, function($a, $b) {
    return strtotime($b['observed_at']) <=> strtotime($a['observed_at']);
});

// Save Observations
file_put_contents(DATA_DIR . '/observations.json', json_encode($observations, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

// Save Users (Merged)
file_put_contents(DATA_DIR . '/users.json', json_encode($users, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

echo "Seeded users: " . count($users) . " / observations: " . count($observations) . "\n";
