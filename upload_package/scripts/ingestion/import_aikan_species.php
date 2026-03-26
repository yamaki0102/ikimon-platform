<?php

/**
 * import_aikan_species.php — 愛管自然共生サイト 生物種リストインポーター
 * 
 * 既存の調査データ（2024/10〜2025/4）をikimon.life観察レコードに変換。
 * generate_report.phpのデモデータとして機能する。
 * 
 * Usage: php scripts/import_aikan_species.php [--dry-run]
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/BioUtils.php';

$dryRun = in_array('--dry-run', $argv ?? []);
$siteId = 'ikan_hq';
$siteName = '愛管株式会社 本社ビオトープ';
$userId = 'system_import';
$userName = '愛管 生物調査チーム';

// Default center coordinate for records without GPS
$defaultLat = 34.81421;  // 北緯34度48分51秒
$defaultLng = 137.73268; // 東経137度43分58秒

/**
 * Convert DMS (度分秒) string to decimal degrees
 * Input: "北緯34度48分51.83秒" or "東経137度43分58.04秒"
 */
function dmsToDecimal(string $dms): ?float
{
    // Clean up
    $dms = trim($dms);
    if (empty($dms)) return null;

    // Remove directional prefixes
    $dms = preg_replace('/^[北南東西緯経]+/', '', $dms);

    // Extract degrees, minutes, seconds
    if (preg_match('/(\d+)度(\d+)分([\d.]+)秒/', $dms, $m)) {
        $deg = (int)$m[1];
        $min = (int)$m[2];
        $sec = (float)$m[3];
        return $deg + ($min / 60) + ($sec / 3600);
    }

    return null;
}

/**
 * Map zone names to standardized format
 */
function normalizeZone(string $zone): string
{
    $zone = trim($zone);
    $map = [
        '草地エリア' => '園庭ゾーン',
        '畑地エリア' => '農園ゾーン',
        '果樹園エリア' => '農園ゾーン',
        '園庭ゾーン' => '園庭ゾーン',
        '農園ゾーン' => '農園ゾーン',
    ];
    return $map[$zone] ?? $zone;
}

// ============================================
// Define species records from survey data
// ============================================

$speciesData = [
    // === Plants (植物) ===
    ['name' => 'ヒエ', 'sci' => 'Echinochloa sp.', 'group' => 'plant', 'date' => '2024-11-05', 'zone' => '草地エリア', 'wild' => false],
    ['name' => 'タンポポ', 'sci' => 'Taraxacum sp.', 'group' => 'plant', 'date' => '2024-11-08', 'zone' => '果樹園エリア', 'wild' => true],
    ['name' => 'ウリクサ', 'sci' => 'Torenia crustacea', 'group' => 'plant', 'date' => '2024-11-08', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'クズ', 'sci' => 'Pueraria lobata', 'group' => 'plant', 'date' => '2024-10-21', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'クヌギ', 'sci' => 'Quercus acutissima', 'group' => 'plant', 'date' => '2024-11-14', 'zone' => '草地エリア', 'wild' => false, 'lat' => 34.81439, 'lng' => 137.73260],
    ['name' => 'ドウダンツツジ', 'sci' => 'Enkianthus perulatus', 'group' => 'plant', 'date' => '2024-11-05', 'zone' => '畑地エリア', 'wild' => false],
    ['name' => 'ヤブガラシ', 'sci' => 'Causonis japonica', 'group' => 'plant', 'date' => '2024-11-08', 'zone' => '畑地エリア', 'wild' => true],
    ['name' => 'ダイコン', 'sci' => 'Raphanus sativus', 'group' => 'plant', 'date' => '2024-10-21', 'zone' => '畑地エリア', 'wild' => false],
    ['name' => 'キンモクセイ', 'sci' => 'Osmanthus fragrans var. aurantiacus', 'group' => 'plant', 'date' => '2024-10-21', 'zone' => '畑地エリア', 'wild' => false],
    ['name' => 'ゴンズイ', 'sci' => 'Staphylea japonica', 'group' => 'plant', 'date' => '2024-11-12', 'zone' => '畑地エリア', 'wild' => true],
    ['name' => 'タマスダレ', 'sci' => 'Zephyranthes candida', 'group' => 'plant', 'date' => '2024-11-14', 'zone' => '草地エリア', 'wild' => false, 'lat' => 34.81427, 'lng' => 137.73260],
    ['name' => 'センニチコウ', 'sci' => 'Gomphrena globosa', 'group' => 'plant', 'date' => '2024-11-14', 'zone' => '草地エリア', 'wild' => false, 'lat' => 34.81434, 'lng' => 137.73262],
    ['name' => 'サザンカ', 'sci' => 'Camellia sasanqua', 'group' => 'plant', 'date' => '2024-11-06', 'zone' => '畑地エリア', 'wild' => false, 'lat' => 34.81470, 'lng' => 137.73293],
    ['name' => 'ジュズダマ', 'sci' => 'Coix lacryma-jobi', 'group' => 'plant', 'date' => '2024-11-14', 'zone' => '畑地エリア', 'wild' => false, 'lat' => 34.81426, 'lng' => 137.73264],
    ['name' => 'ニチニチソウ', 'sci' => 'Catharanthus roseus', 'group' => 'plant', 'date' => '2024-11-14', 'zone' => '畑地エリア', 'wild' => false, 'lat' => 34.81448, 'lng' => 137.73276],
    ['name' => 'オシロイバナ', 'sci' => 'Mirabilis jalapa', 'group' => 'plant', 'date' => '2024-11-14', 'zone' => '畑地エリア', 'wild' => false, 'lat' => 34.81449, 'lng' => 137.73285],
    ['name' => 'ニンジン', 'sci' => 'Daucus carota', 'group' => 'plant', 'date' => '2024-11-14', 'zone' => '畑地エリア', 'wild' => false, 'lat' => 34.81435, 'lng' => 137.73270],
    ['name' => 'ズッキーニ', 'sci' => 'Cucurbita pepo', 'group' => 'plant', 'date' => '2024-11-14', 'zone' => '畑地エリア', 'wild' => false, 'lat' => 34.81420, 'lng' => 137.73277],
    ['name' => 'イネ', 'sci' => 'Oryza sativa', 'group' => 'plant', 'date' => '2024-10-03', 'zone' => '畑地エリア', 'wild' => false, 'lat' => 34.81438, 'lng' => 137.73246],
    ['name' => 'ホトケノザ', 'sci' => 'Lamium amplexicaule', 'group' => 'plant', 'date' => '2024-12-09', 'zone' => '草地エリア', 'wild' => true, 'lat' => 34.81500, 'lng' => 137.73248],
    ['name' => 'オオジシバリ', 'sci' => 'Ixeris japonica', 'group' => 'plant', 'date' => '2024-12-09', 'zone' => '草地エリア', 'wild' => true, 'lat' => 34.81447, 'lng' => 137.73280],
    ['name' => 'ヨモギ', 'sci' => 'Artemisia indica var. maximowiczii', 'group' => 'plant', 'date' => '2024-12-09', 'zone' => '草地エリア', 'wild' => true, 'lat' => 34.81502, 'lng' => 137.73248],
    ['name' => 'ガガイモ', 'sci' => 'Metaplexis japonica', 'group' => 'plant', 'date' => '2024-12-09', 'zone' => '草地エリア', 'wild' => true, 'lat' => 34.81501, 'lng' => 137.73254],
    ['name' => 'カキドオシ', 'sci' => 'Glechoma hederacea subsp. grandis', 'group' => 'plant', 'date' => '2024-12-09', 'zone' => '草地エリア', 'wild' => true, 'lat' => 34.81500, 'lng' => 137.73257],
    ['name' => 'シロザ', 'sci' => 'Chenopodium album', 'group' => 'plant', 'date' => '2024-12-09', 'zone' => '草地エリア', 'wild' => true, 'lat' => 34.81502, 'lng' => 137.73259],
    ['name' => 'ミゾシダ', 'sci' => 'Thelypteris pozoi', 'group' => 'plant', 'date' => '2024-12-09', 'zone' => '草地エリア', 'wild' => true, 'lat' => 34.81438, 'lng' => 137.73236],
    ['name' => 'ゼニゴケ', 'sci' => 'Marchantia sp.', 'group' => 'plant', 'date' => '2024-12-09', 'zone' => '草地エリア', 'wild' => true, 'lat' => 34.81441, 'lng' => 137.73241],
    ['name' => 'カキノキ', 'sci' => 'Diospyros kaki', 'group' => 'plant', 'date' => '2024-12-09', 'zone' => '草地エリア', 'wild' => false, 'lat' => 34.81441, 'lng' => 137.73218],
    ['name' => 'ヒサカキ', 'sci' => 'Eurya japonica', 'group' => 'plant', 'date' => '2024-12-09', 'zone' => '草地エリア', 'wild' => false, 'lat' => 34.81438, 'lng' => 137.73220],
    ['name' => 'センダン', 'sci' => 'Melia azedarach', 'group' => 'plant', 'date' => '2024-12-09', 'zone' => '草地エリア', 'wild' => false, 'lat' => 34.81417, 'lng' => 137.73237],
    ['name' => 'カタバミ', 'sci' => 'Oxalis corniculata', 'group' => 'plant', 'date' => '2024-12-09', 'zone' => '畑地エリア', 'wild' => true, 'lat' => 34.81426, 'lng' => 137.73296],
    ['name' => 'マグワ', 'sci' => 'Morus alba', 'group' => 'plant', 'date' => '2024-12-09', 'zone' => '畑地エリア', 'wild' => false, 'lat' => 34.81431, 'lng' => 137.73283],
    ['name' => 'フキ', 'sci' => 'Petasites japonicus', 'group' => 'plant', 'date' => '2024-12-09', 'zone' => '畑地エリア', 'wild' => false, 'lat' => 34.81444, 'lng' => 137.73282],
    ['name' => 'オニタビラコ', 'sci' => 'Youngia japonica', 'group' => 'plant', 'date' => '2024-12-09', 'zone' => '畑地エリア', 'wild' => true, 'lat' => 34.81427, 'lng' => 137.73282],
    ['name' => 'コガネタヌキマメ', 'sci' => 'Crotalaria assamica', 'group' => 'plant', 'date' => '2024-12-09', 'zone' => '草地エリア', 'wild' => false, 'lat' => 34.81437, 'lng' => 137.73262],
    ['name' => 'ウラジロチチコグサ', 'sci' => 'Gamochaeta americana', 'group' => 'plant', 'date' => '2024-12-09', 'zone' => '果樹園エリア', 'wild' => true, 'lat' => 34.81461, 'lng' => 137.73321],
    ['name' => 'アメリカフウロ', 'sci' => 'Geranium carolinianum', 'group' => 'plant', 'date' => '2024-12-09', 'zone' => '果樹園エリア', 'wild' => true, 'lat' => 34.81460, 'lng' => 137.73297],
    ['name' => 'ミント', 'sci' => 'Mentha sp.', 'group' => 'plant', 'date' => '2024-12-09', 'zone' => '果樹園エリア', 'wild' => false, 'lat' => 34.81459, 'lng' => 137.73305],
    ['name' => 'ホップ', 'sci' => 'Humulus lupulus', 'group' => 'plant', 'date' => '2024-10-15', 'zone' => '草地エリア', 'wild' => false, 'lat' => 34.81451, 'lng' => 137.73236],
    ['name' => 'スギナ', 'sci' => 'Equisetum arvense', 'group' => 'plant', 'date' => '2024-12-09', 'zone' => '畑地エリア', 'wild' => true, 'lat' => 34.81450, 'lng' => 137.73273],
    ['name' => 'ビワ', 'sci' => 'Eriobotrya japonica', 'group' => 'plant', 'date' => '2024-11-14', 'zone' => '果樹園エリア', 'wild' => false, 'lat' => 34.81447, 'lng' => 137.73293],
    ['name' => 'イチジク', 'sci' => 'Ficus carica', 'group' => 'plant', 'date' => '2024-11-14', 'zone' => '果樹園エリア', 'wild' => false, 'lat' => 34.81429, 'lng' => 137.73294],
    // 2025-04-28 追加調査 (岸本教授)
    ['name' => 'ドクダミ', 'sci' => 'Houttuynia cordata', 'group' => 'plant', 'date' => '2025-04-28', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'オオニワゼキショウ', 'sci' => 'Sisyrinchium angustifolium', 'group' => 'plant', 'date' => '2025-04-28', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'キュウリグサ', 'sci' => 'Trigonotis peduncularis', 'group' => 'plant', 'date' => '2025-04-28', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'コヒルガオ', 'sci' => 'Calystegia hederacea', 'group' => 'plant', 'date' => '2025-04-28', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'オオイヌノフグリ', 'sci' => 'Veronica persica', 'group' => 'plant', 'date' => '2025-04-28', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'マツバウンラン', 'sci' => 'Linaria canadensis', 'group' => 'plant', 'date' => '2025-04-28', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'セイヨウタンポポ', 'sci' => 'Taraxacum officinale', 'group' => 'plant', 'date' => '2025-04-28', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'ノゲシ', 'sci' => 'Sonchus oleraceus', 'group' => 'plant', 'date' => '2025-04-28', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'ブタナ', 'sci' => 'Hypochaeris radicata', 'group' => 'plant', 'date' => '2025-04-28', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'ハハコグサ', 'sci' => 'Gnaphalium affine', 'group' => 'plant', 'date' => '2025-04-28', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'セイタカアワダチソウ', 'sci' => 'Solidago altissima', 'group' => 'plant', 'date' => '2025-04-28', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'スイカズラ', 'sci' => 'Lonicera japonica', 'group' => 'plant', 'date' => '2025-04-28', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'ナガミヒナゲシ', 'sci' => 'Papaver rhoeas', 'group' => 'plant', 'date' => '2025-04-28', 'zone' => '果樹園エリア', 'wild' => true],
    ['name' => 'アケビ', 'sci' => 'Akebia quinata', 'group' => 'plant', 'date' => '2025-04-28', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'シロツメクサ', 'sci' => 'Trifolium repens', 'group' => 'plant', 'date' => '2025-04-28', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'クサイチゴ', 'sci' => 'Rubus hirsutus', 'group' => 'plant', 'date' => '2025-04-28', 'zone' => '果樹園エリア', 'wild' => true],
    ['name' => 'コナラ', 'sci' => 'Quercus serrata', 'group' => 'plant', 'date' => '2025-04-28', 'zone' => '果樹園エリア', 'wild' => true],
    ['name' => 'アカメガシワ', 'sci' => 'Mallotus japonicus', 'group' => 'plant', 'date' => '2025-04-28', 'zone' => '果樹園エリア', 'wild' => true],
    ['name' => 'ナズナ', 'sci' => 'Capsella bursa-pastoris', 'group' => 'plant', 'date' => '2025-04-28', 'zone' => '畑地エリア', 'wild' => true],
    ['name' => 'コハコベ', 'sci' => 'Stellaria media', 'group' => 'plant', 'date' => '2025-04-28', 'zone' => '畑地エリア', 'wild' => true],
    ['name' => 'ヤエムグラ', 'sci' => 'Galium aparine', 'group' => 'plant', 'date' => '2025-04-28', 'zone' => '畑地エリア', 'wild' => true],
    ['name' => 'ヘクソカズラ', 'sci' => 'Paederia scandens', 'group' => 'plant', 'date' => '2025-04-28', 'zone' => '果樹園エリア', 'wild' => true],
    ['name' => 'エノキ', 'sci' => 'Celtis sinensis', 'group' => 'plant', 'date' => '2025-04-28', 'zone' => '果樹園エリア', 'wild' => true],
    ['name' => 'ニガナ', 'sci' => 'Ixeris dentata', 'group' => 'plant', 'date' => '2025-04-28', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'イボタノキ', 'sci' => 'Ligustrum obtusifolium', 'group' => 'plant', 'date' => '2025-04-28', 'zone' => '畑地エリア', 'wild' => true],

    // === Insects (昆虫) ===
    ['name' => 'ヒナバッタ', 'sci' => 'Glyptobothrus maritimus', 'group' => 'insect', 'date' => '2024-11-06', 'zone' => '草地エリア', 'wild' => true, 'lat' => 34.81440, 'lng' => 137.73279],
    ['name' => 'キチョウ', 'sci' => 'Eurema sp.', 'group' => 'insect', 'date' => '2024-11-06', 'zone' => '草地エリア', 'wild' => true, 'lat' => 34.81463, 'lng' => 137.73285],
    ['name' => 'ウスカワマイマイ', 'sci' => 'Acusta sieboldtiana', 'group' => 'insect', 'date' => '2024-11-06', 'zone' => '果樹園エリア', 'wild' => true, 'lat' => 34.81444, 'lng' => 137.73329],
    ['name' => 'ミナミアオカメムシ', 'sci' => 'Nezara sp.', 'group' => 'insect', 'date' => '2024-11-06', 'zone' => '果樹園エリア', 'wild' => true, 'lat' => 34.81426, 'lng' => 137.73300],
    ['name' => 'ヤマトシジミ', 'sci' => 'Pseudozizeeria maha', 'group' => 'insect', 'date' => '2024-11-06', 'zone' => '畑地エリア', 'wild' => true, 'lat' => 34.81438, 'lng' => 137.73291],
    ['name' => 'カブトムシ', 'sci' => 'Trypoxylus dichotomus septentrionalis', 'group' => 'insect', 'date' => '2024-11-15', 'zone' => '畑地エリア', 'wild' => true, 'lat' => 34.81429, 'lng' => 137.73285],
    ['name' => 'アキアカネ', 'sci' => 'Sympetrum frequens', 'group' => 'insect', 'date' => '2024-11-08', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'ハラビロカマキリ', 'sci' => 'Hierodula patellifera', 'group' => 'insect', 'date' => '2024-11-08', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'クロテンイラガ', 'sci' => 'Thosea sinensis', 'group' => 'insect', 'date' => '2024-10-21', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'ヒメクダマキモドキ', 'sci' => 'Phaulula macilenta', 'group' => 'insect', 'date' => '2024-10-21', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'キアゲハ', 'sci' => 'Papilio machaon', 'group' => 'insect', 'date' => '2024-10-11', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'モリチャバネゴキブリ', 'sci' => 'Blattella nipponica', 'group' => 'insect', 'date' => '2024-11-08', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'アゲハ', 'sci' => 'Papilio xuthus', 'group' => 'insect', 'date' => '2025-04-28', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'アオスジアゲハ', 'sci' => 'Graphium sarpedon', 'group' => 'insect', 'date' => '2025-04-28', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'ベニシジミ', 'sci' => 'Lycaena phlaeas', 'group' => 'insect', 'date' => '2025-04-28', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'ルリシジミ', 'sci' => 'Celastrina argiolus', 'group' => 'insect', 'date' => '2025-04-28', 'zone' => '草地エリア', 'wild' => true],

    // === Birds (鳥類) ===
    ['name' => 'キジバト', 'sci' => 'Streptopelia orientalis', 'group' => 'bird', 'date' => '2025-04-28', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'ツバメ', 'sci' => 'Hirundo rustica', 'group' => 'bird', 'date' => '2025-04-28', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'カワラヒワ', 'sci' => 'Chloris sinica', 'group' => 'bird', 'date' => '2025-04-28', 'zone' => '畑地エリア', 'wild' => true],
    ['name' => 'スズメ', 'sci' => 'Passer montanus', 'group' => 'bird', 'date' => '2025-04-28', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'ヒヨドリ', 'sci' => 'Hypsipetes amaurotis', 'group' => 'bird', 'date' => '2025-04-28', 'zone' => '畑地エリア', 'wild' => true],
    ['name' => 'ウグイス', 'sci' => 'Horornis diphone', 'group' => 'bird', 'date' => '2025-04-28', 'zone' => '果樹園エリア', 'wild' => true],
    ['name' => 'ハシボソガラス', 'sci' => 'Corvus corone', 'group' => 'bird', 'date' => '2025-04-28', 'zone' => '果樹園エリア', 'wild' => true],
    ['name' => 'ムクドリ', 'sci' => 'Spodiopsar cineraceus', 'group' => 'bird', 'date' => '2025-04-28', 'zone' => '草地エリア', 'wild' => true],
    ['name' => 'ツグミ', 'sci' => 'Turdus eunomus', 'group' => 'bird', 'date' => '2025-04-28', 'zone' => '草地エリア', 'wild' => true],

    // === Reptiles (爬虫類) ===
    ['name' => 'カナヘビ', 'sci' => 'Takydromus tachydromoides', 'group' => 'reptile', 'date' => '2025-04-28', 'zone' => '草地エリア', 'wild' => true],
];

echo "=== 愛管自然共生サイト 種リストインポーター ===\n";
echo "対象: " . count($speciesData) . " 種\n";
echo "モード: " . ($dryRun ? "DRY RUN (書き込みなし)" : "本番実行") . "\n\n";

$imported = 0;
$skipped = 0;

foreach ($speciesData as $i => $sp) {
    $id = 'aikan-import-' . str_pad($i + 1, 4, '0', STR_PAD_LEFT);
    $lat = $sp['lat'] ?? $defaultLat + (mt_rand(-50, 50) / 100000); // ±0.0005 degree jitter
    $lng = $sp['lng'] ?? $defaultLng + (mt_rand(-50, 50) / 100000);
    $date = $sp['date'] . ' ' . sprintf('%02d:%02d', mt_rand(8, 16), mt_rand(0, 59));
    $zone = normalizeZone($sp['zone']);

    $observation = [
        'id' => $id,
        'user_id' => $userId,
        'user_name' => $userName,
        'user_avatar' => 'https://ikimon.life/assets/aikan_logo.png',
        'user_rank' => 'Researcher',
        'observed_at' => $date,
        'lat' => $lat,
        'lng' => $lng,
        'country' => '日本',
        'prefecture' => '静岡県',
        'municipality' => '浜松市浜名区',
        'cultivation' => $sp['wild'] ? 'wild' : 'cultivated',
        'life_stage' => 'unknown',
        'note' => "自然共生サイト生物調査（{$zone}）",
        'photos' => [], // No photos for imported records
        'status' => 'Research Grade', // Expert-confirmed in original survey
        'event_id' => null,
        'survey_id' => 'aikan-biodiversity-survey-2024',
        'site_id' => $siteId,
        'site_name' => $siteName,
        'created_at' => date('Y-m-d H:i:s'),
        'updated_at' => date('Y-m-d H:i:s'),
        'identifications' => [
            [
                'id' => 'id-' . $id,
                'user_id' => $userId,
                'user_name' => $userName,
                'taxon_name' => $sp['name'],
                'scientific_name' => $sp['sci'],
                'agreed' => true,
                'created_at' => $date,
                'trust_level' => 'expert', // Survey by museum professor
                'source' => 'field_survey',
            ]
        ],
        'taxon' => [
            'name' => $sp['name'],
            'scientific_name' => $sp['sci'],
            'slug' => mb_strtolower(preg_replace('/\s+/', '-', $sp['name'])),
            'rank' => (strpos($sp['sci'], ' sp.') !== false) ? 'genus' : 'species',
            'lineage' => [
                'kingdom' => $sp['group'] === 'plant' ? 'Plantae' : 'Animalia',
                'class' => match ($sp['group']) {
                    'plant' => 'Magnoliopsida',
                    'insect' => 'Insecta',
                    'bird' => 'Aves',
                    'reptile' => 'Reptilia',
                    default => 'Unknown',
                },
            ],
        ],
        'license' => 'CC-BY',
        'quality_flags' => [
            'has_media' => false,
            'has_location' => true,
            'has_date' => true,
            'is_organism' => true,
            'has_id' => true,
            'is_wild' => $sp['wild'],
            'is_recent' => true,
        ],
        'coordinate_accuracy' => null,
        'import_source' => 'aikan_biodiversity_survey_2024',
        'import_batch' => 'aikan-batch-001',
    ];

    if ($dryRun) {
        echo "  [DRY] {$sp['name']} ({$sp['sci']}) — {$sp['date']} {$zone}\n";
    } else {
        $timestamp = strtotime($sp['date']);
        DataStore::append('observations', $observation, $timestamp);
        echo "  [OK] {$sp['name']} ({$sp['sci']}) — {$sp['date']} {$zone}\n";
    }

    $imported++;
}

echo "\n=== 完了 ===\n";
echo "インポート: {$imported} 件\n";
echo "スキップ: {$skipped} 件\n";

if (!$dryRun) {
    echo "\n✅ データはikimon.lifeに保存されました。\n";
    echo "レポート確認: /api/generate_report.php?site_id=ikan_hq\n";
}
