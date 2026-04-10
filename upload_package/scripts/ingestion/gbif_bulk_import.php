<?php
/**
 * Omoikane — Bulk Species Importer from GBIF v2.0
 *
 * 全界・全門を対象に GBIF Backbone から承認済み種を取り込む。
 * TERRESTRIAL フィルターを廃止し、海洋・淡水・菌類・藻類を全て含む。
 *
 * 使い方:
 *   php gbif_bulk_import.php              # 全グループ処理
 *   php gbif_bulk_import.php --group=Aves # 特定グループのみ
 *   php gbif_bulk_import.php --limit=1000 # 件数制限（テスト用）
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/ExtractionQueue.php';

$opts  = getopt('', ['group:', 'limit:']);
$onlyGroup = $opts['group'] ?? '';
$globalLimit = isset($opts['limit']) ? (int)$opts['limit'] : 0;

echo "=== GBIF Bulk Species Importer v2.0 ===\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n\n";

$eq = ExtractionQueue::getInstance();
$added = 0;
$skipped = 0;
$errors = 0;

// =========================================================
// 全界・全主要分類群 (旧: 15目 → 新: 60+分類群、制限なし)
// =========================================================
$targetTaxa = [
    // ── 動物界 Animalia ──────────────────────────────────
    // 昆虫綱 全目 (旧: 7目 → 新: 全目をクラスレベルで)
    ['name' => 'Insecta',          'key' => 216],   // 昆虫全体 ~100万種
    ['name' => 'Arachnida',        'key' => 367],   // クモ形類 ~10万種
    ['name' => 'Malacostraca',     'key' => 232],   // 軟甲類(エビ・カニ) ~4万種
    ['name' => 'Maxillopoda',      'key' => 1157],  // カイアシ類
    ['name' => 'Branchiopoda',     'key' => 233],   // ミジンコ類
    ['name' => 'Diplopoda',        'key' => 1005],  // ヤスデ類
    ['name' => 'Chilopoda',        'key' => 1004],  // ムカデ類
    ['name' => 'Collembola',       'key' => 1212],  // トビムシ類
    // 脊椎動物
    ['name' => 'Aves',             'key' => 212],   // 鳥類 ~1万種
    ['name' => 'Mammalia',         'key' => 359],   // 哺乳類 ~6千種
    ['name' => 'Reptilia',         'key' => 358],   // 爬虫類 ~1万種
    ['name' => 'Amphibia',         'key' => 131],   // 両生類 ~8千種
    ['name' => 'Actinopterygii',   'key' => 204],   // 条鰭類(硬骨魚) ~3万種
    ['name' => 'Chondrichthyes',   'key' => 229],   // 軟骨魚(サメ・エイ)
    ['name' => 'Cephalaspidomorphi','key' => 578],  // ヤツメウナギ
    // 軟体動物
    ['name' => 'Gastropoda',       'key' => 225],   // 腹足類(カタツムリ・ウミウシ) ~8万種
    ['name' => 'Bivalvia',         'key' => 137],   // 二枚貝
    ['name' => 'Cephalopoda',      'key' => 224],   // 頭足類(タコ・イカ)
    ['name' => 'Polyplacophora',   'key' => 228],   // ヒザラガイ
    // 環形動物・線形動物
    ['name' => 'Oligochaeta',      'key' => 1310],  // ミミズ
    ['name' => 'Polychaeta',       'key' => 1309],  // 多毛類
    ['name' => 'Nematoda',         'key' => 59],    // 線虫
    // 棘皮動物
    ['name' => 'Asteroidea',       'key' => 1250],  // ヒトデ
    ['name' => 'Echinoidea',       'key' => 1251],  // ウニ
    ['name' => 'Holothuroidea',    'key' => 1254],  // ナマコ
    // 刺胞動物
    ['name' => 'Hydrozoa',         'key' => 1263],  // ヒドロ虫
    ['name' => 'Scyphozoa',        'key' => 1264],  // クラゲ
    ['name' => 'Anthozoa',         'key' => 1265],  // サンゴ・イソギンチャク
    // ── 植物界 Plantae ──────────────────────────────────
    ['name' => 'Magnoliopsida',    'key' => 220],   // 双子葉植物 ~25万種
    ['name' => 'Liliopsida',       'key' => 196],   // 単子葉植物(草本・ラン・イネ) ~6万種
    ['name' => 'Pinopsida',        'key' => 194],   // 裸子植物(針葉樹) ~千種
    ['name' => 'Gnetopsida',       'key' => 193],   // グネツム類
    ['name' => 'Polypodiopsida',   'key' => 121],   // シダ植物
    ['name' => 'Bryophyta',        'key' => 35],    // コケ植物
    ['name' => 'Marchantiophyta',  'key' => 67],    // 苔類(タイ類)
    ['name' => 'Anthocerotophyta', 'key' => 68],    // ツノゴケ類
    ['name' => 'Lycopodiopsida',   'key' => 192],   // ヒカゲノカズラ類
    ['name' => 'Chlorophyta',      'key' => 3152],  // 緑藻
    ['name' => 'Charophyta',       'key' => 7205],  // 車軸藻
    // ── 菌界 Fungi ───────────────────────────────────────
    ['name' => 'Agaricomycetes',   'key' => 8878],  // キノコ類(マツタケ・シイタケ等) ~2万種
    ['name' => 'Pucciniomycetes',  'key' => 8882],  // サビキン(植物病害)
    ['name' => 'Ustilaginomycetes','key' => 8883],  // クロホコリカビ
    ['name' => 'Sordariomycetes',  'key' => 4927],  // 子嚢菌類
    ['name' => 'Leotiomycetes',    'key' => 4926],  // チャワンタケ等
    ['name' => 'Dothideomycetes',  'key' => 4924],  // 腔菌類
    ['name' => 'Eurotiomycetes',   'key' => 4925],  // コウジカビ・ペニシリウム
    ['name' => 'Lecanoromycetes',  'key' => 8841],  // 地衣類
    // ── クロミスタ Chromista ───────────────────────────
    ['name' => 'Phaeophyceae',     'key' => 3169],  // 褐藻(コンブ・ワカメ)
    ['name' => 'Bacillariophyta',  'key' => 3151],  // 珪藻
    ['name' => 'Oomycota',         'key' => 3151],  // 卵菌(疫病菌等)
    // ── 原生動物 Protozoa ────────────────────────────────
    ['name' => 'Ciliophora',       'key' => 49],    // 繊毛虫
    ['name' => 'Sarcomastigophora','key' => 55],    // アメーバ・鞭毛虫
    // ── 細菌・古細菌 (生態系機能として) ─────────────────
    // ※ 細菌は種数が膨大かつ同定が困難なため除外
];

foreach ($targetTaxa as $taxon) {
    echo "\n--- Fetching {$taxon['name']} (GBIF key: {$taxon['key']}) ---\n";
    
    $offset = 0;
    $limit = 300; // Max per request
    $taxonAdded = 0;
    $maxPages = 100; // Up to 30000 species per taxon
    
    for ($page = 0; $page < $maxPages; $page++) {
        // Use GBIF Occurrence Search to find species seen in Japan
        $url = "https://api.gbif.org/v1/species/search?" . http_build_query([
            'highertaxonKey' => $taxon['key'],
            'rank' => 'SPECIES',
            'status' => 'ACCEPTED',
            'limit' => $limit,
            'offset' => $offset,
            // habitat filter removed — include all species (terrestrial, marine, freshwater)
        ]);
        
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: application/json']);
        $resp = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            echo "  [ERROR] HTTP $httpCode at offset $offset\n";
            $errors++;
            break;
        }
        
        $data = json_decode($resp, true);
        $results = $data['results'] ?? [];
        
        if (empty($results)) {
            echo "  No more results at offset $offset\n";
            break;
        }
        
        foreach ($results as $sp) {
            $name = $sp['canonicalName'] ?? $sp['scientificName'] ?? '';
            if (empty($name)) continue;
            
            // Only binomial names (Genus species)
            if (substr_count(trim($name), ' ') !== 1) continue;
            
            $gbifKey = $sp['key'] ?? null;
            $slug = str_replace(' ', '-', strtolower($name));
            
            $wasAdded = $eq->addSpecies($name, [
                'slug' => $slug,
                'status' => 'pending',
                'source' => 'gbif_bulk_v2',
                'gbif_key' => $gbifKey,
                'occurrence_count_jp' => 0,
                'retries' => 0,
            ]);
            
            if ($wasAdded) {
                $added++;
                $taxonAdded++;
            } else {
                $skipped++;
            }
        }
        
        $offset += $limit;
        
        // Don't hammer GBIF API
        usleep(200000); // 200ms
        
        if ($data['endOfRecords'] ?? false) break;
    }
    
    echo "  Added: $taxonAdded new species\n";
}

echo "\n=== Summary ===\n";
echo "Added: $added new species\n";
echo "Skipped (already in queue): $skipped\n";
echo "Errors: $errors\n";

// Show updated queue
$counts = $eq->getCounts();
echo "\n=== Updated Queue ===\n";
foreach ($counts as $k => $v) echo "  $k: $v\n";
echo "\nNew pending species will be picked up by the prefetcher automatically.\n";
