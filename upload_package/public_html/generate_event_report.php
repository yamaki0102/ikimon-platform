<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/EventManager.php';
require_once __DIR__ . '/../libs/CorporatePlanGate.php';
require_once __DIR__ . '/../libs/CorporateManager.php';
require_once __DIR__ . '/../libs/RedListManager.php';
require_once __DIR__ . '/../libs/PrivacyFilter.php';
require_once __DIR__ . '/../libs/GeoUtils.php';

Auth::init();

if (!Auth::isLoggedIn()) {
    header('Location: login.php');
    exit;
}

$user = Auth::user();
$eventId = $_GET['event_id'] ?? '';
if (!$eventId) {
    die("イベントIDが指定されていません。");
}

$event = EventManager::get($eventId);
if (!$event) {
    die("イベントが見つかりません。");
}

$isOrganizer = ($user['id'] === ($event['organizer_id'] ?? ''));
$isAdmin = (($user['role'] ?? '') === 'Admin');
if (!$isOrganizer && !$isAdmin) {
    die("このレポートを閲覧する権限がありません。");
}

$corporation = CorporatePlanGate::resolveCorporationForEvent($event);
if ($corporation && !CorporatePlanGate::canUseAdvancedOutputs($corporation)) {
    header('Location: pricing.php');
    exit;
}

// --- 観測データ収集 ---
$eventDate = $event['event_date'] ?? date('Y-m-d');
$startTime = $event['start_time'] ?? '09:00';
$endTime = $event['end_time'] ?? '12:00';
$bufferMin = 30;

$rangeStart = (new DateTime("{$eventDate} {$startTime}"))->modify("-{$bufferMin} minutes");
$rangeEnd = (new DateTime("{$eventDate} {$endTime}"))->modify("+{$bufferMin} minutes");
$evtLat = (float)($event['location']['lat'] ?? 0);
$evtLng = (float)($event['location']['lng'] ?? 0);
$radiusM = (int)($event['location']['radius_m'] ?? 500);
$eventCode = $event['event_code'] ?? '';

$linkedIds = $event['linked_observations'] ?? [];
$finalObservations = [];
$touchedObsIds = [];

$dateKey = str_replace('-', '', $eventDate);
$partitionFile = "observations/{$dateKey}";
$dayObservations = DataStore::get($partitionFile);
$candidates = $dayObservations ? $dayObservations : DataStore::getLatest('observations', 2000);

$speciesSet = [];
$contributors = [];
$totalObsCount = 0;
$photos = [];

$addObs = function ($obs) use (&$finalObservations, &$speciesSet, &$contributors, &$touchedObsIds, &$totalObsCount, &$photos) {
    if (!isset($obs['id'])) return;
    $id = $obs['id'];
    if (isset($touchedObsIds[$id])) return;
    $touchedObsIds[$id] = true;

    $taxonName = $obs['taxon']['name'] ?? ($obs['identifications'][0]['taxon_name'] ?? '不明');
    $scientificName = $obs['taxon']['scientific_name'] ?? '';

    $uid = $obs['user_id'] ?? '';
    if ($uid && !isset($contributors[$uid])) {
        $contributors[$uid] = true;
    }

    if ($taxonName && $taxonName !== '不明') {
        if (!isset($speciesSet[$taxonName])) {
            $speciesSet[$taxonName] = [
                'scientific_name' => $scientificName,
                'count' => 0,
                'first_seen' => $obs['observed_at'] ?? $obs['created_at'] ?? '',
                'last_seen' => $obs['observed_at'] ?? $obs['created_at'] ?? '',
                'has_photo' => false,
            ];
        }
        $speciesSet[$taxonName]['count']++;

        $obsTime = $obs['observed_at'] ?? $obs['created_at'] ?? '';
        if ($obsTime && $obsTime < $speciesSet[$taxonName]['first_seen']) {
            $speciesSet[$taxonName]['first_seen'] = $obsTime;
        }
        if ($obsTime && $obsTime > $speciesSet[$taxonName]['last_seen']) {
            $speciesSet[$taxonName]['last_seen'] = $obsTime;
        }

        $photoUrl = $obs['photo_url'] ?? ($obs['photos'][0]['url'] ?? '');
        if ($photoUrl) {
            $speciesSet[$taxonName]['has_photo'] = true;
            if (count($photos) < 6) {
                $photos[] = [
                    'url' => $photoUrl,
                    'taxon' => $taxonName,
                ];
            }
        }
    }

    $finalObservations[] = $obs;
    $totalObsCount++;
};

foreach ($candidates as $obs) {
    $obsId = $obs['id'] ?? '';
    $obsTag = $obs['event_tag'] ?? '';
    if (in_array($obsId, $linkedIds) || ($eventCode && $obsTag === $eventCode)) {
        $addObs($obs);
        continue;
    }
    $obsTime = $obs['observed_at'] ?? $obs['created_at'] ?? '';
    if (!$obsTime || strpos($obsTime, $eventDate) !== 0) continue;

    $obsDateTime = new DateTime($obsTime);
    if ($obsDateTime >= $rangeStart && $obsDateTime <= $rangeEnd) {
        $obsLat = (float)($obs['lat'] ?? 0);
        $obsLng = (float)($obs['lng'] ?? 0);
        if ($obsLat && $obsLng && $evtLat && $evtLng && GeoUtils::distance($evtLat, $evtLng, $obsLat, $obsLng) <= $radiusM) {
            $addObs($obs);
        }
    }
}

// --- レッドリスト判定 ---
RedListManager::checkObservations($finalObservations);

$redListSpecies = [];
foreach ($finalObservations as $obs) {
    $status = $obs['red_list_status'] ?? 'Not Evaluated';
    if (in_array($status, ['CR', 'EN', 'VU', 'NT', 'EX', 'EW'])) {
        $taxonName = $obs['taxon']['name'] ?? '不明';
        $scientificName = $obs['taxon']['scientific_name'] ?? '';
        if (!isset($redListSpecies[$taxonName])) {
            $redListSpecies[$taxonName] = [
                'scientific_name' => $scientificName,
                'category' => $status,
            ];
        }
    }
}

$totalSpeciesCount = count($speciesSet);
$totalContributors = count($contributors);
$redListCount = count($redListSpecies);

$title = htmlspecialchars($event['title'] ?? '無題の観察会', ENT_QUOTES, 'UTF-8');
$subtitle = htmlspecialchars($event['subtitle'] ?? ($event['description'] ?? ''), ENT_QUOTES, 'UTF-8');
$locationName = htmlspecialchars($event['location']['name'] ?? '未指定', ENT_QUOTES, 'UTF-8');
$organizerName = htmlspecialchars($event['organizer_name'] ?? '不明', ENT_QUOTES, 'UTF-8');

$redListLabels = [
    'EX' => '絶滅',
    'EW' => '野生絶滅',
    'CR' => '絶滅危惧IA類',
    'EN' => '絶滅危惧IB類',
    'VU' => '絶滅危惧II類',
    'NT' => '準絶滅危惧',
];
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>イベントレポート — <?= $title ?></title>
    <script src="/assets/js/tailwind.3.4.17.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;700;900&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Zen Maru Gothic', sans-serif; background-color: #f3f4f6; }
        @media print {
            body { background-color: white; }
            .no-print { display: none !important; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .report-page { box-shadow: none; padding: 0; }
            .print-break-inside-avoid { break-inside: avoid; }
            .page-break { page-break-before: always; }
        }
        .report-page { max-width: 800px; margin: 0 auto; background: white; padding: 2.5rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
    </style>
</head>
<body class="py-8 text-gray-800">

    <!-- 戻るリンク -->
    <div class="max-w-[800px] mx-auto mb-4 no-print">
        <a href="event_detail.php?id=<?= urlencode($eventId) ?>" class="text-blue-600 font-bold hover:underline">&larr; イベント詳細へ戻る</a>
    </div>

    <div class="report-page rounded-2xl border border-gray-200">

        <!-- 1. ヘッダー -->
        <header class="border-b-2 border-blue-600 pb-6 mb-8 mt-2">
            <div class="flex justify-between items-start mb-2">
                <p class="text-sm font-bold text-blue-700 bg-blue-50 inline-block px-3 py-1 rounded-full">イベントレポート</p>
                <div class="text-xs text-gray-400 font-mono">ikimon.life</div>
            </div>
            <h1 class="text-3xl font-black text-gray-900 mt-4 leading-tight"><?= $title ?></h1>
            <?php if ($subtitle): ?>
                <p class="text-sm text-gray-500 mt-2"><?= $subtitle ?></p>
            <?php endif; ?>
        </header>

        <!-- 2. イベント概要 -->
        <section class="mb-10">
            <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <span class="text-gray-500 inline-block w-20">開催日</span>
                    <span class="font-bold text-gray-800"><?= htmlspecialchars($eventDate, ENT_QUOTES, 'UTF-8') ?></span>
                </div>
                <div>
                    <span class="text-gray-500 inline-block w-20">時間</span>
                    <span class="font-bold text-gray-800"><?= htmlspecialchars($startTime, ENT_QUOTES, 'UTF-8') ?> ~ <?= htmlspecialchars($endTime, ENT_QUOTES, 'UTF-8') ?></span>
                </div>
                <div>
                    <span class="text-gray-500 inline-block w-20">開催地</span>
                    <span class="font-bold text-gray-800"><?= $locationName ?></span>
                </div>
                <div>
                    <span class="text-gray-500 inline-block w-20">主催者</span>
                    <span class="font-bold text-gray-800"><?= $organizerName ?></span>
                </div>
            </div>
        </section>

        <!-- 3. KPI サマリー -->
        <section class="mb-10">
            <h2 class="text-lg font-bold text-blue-800 border-l-4 border-blue-500 pl-3 mb-4">参加・記録サマリー</h2>
            <div class="grid grid-cols-3 gap-4">
                <div class="bg-blue-50 p-5 rounded-xl text-center border border-blue-100">
                    <div class="text-4xl font-black text-blue-600"><?= $totalContributors ?></div>
                    <div class="text-xs font-bold text-gray-500 mt-2">参加人数</div>
                </div>
                <div class="bg-emerald-50 p-5 rounded-xl text-center border border-emerald-100">
                    <div class="text-4xl font-black text-emerald-600"><?= $totalObsCount ?></div>
                    <div class="text-xs font-bold text-gray-500 mt-2">観察記録数</div>
                </div>
                <div class="bg-amber-50 p-5 rounded-xl text-center border border-amber-100">
                    <div class="text-4xl font-black text-amber-600"><?= $totalSpeciesCount ?></div>
                    <div class="text-xs font-bold text-gray-500 mt-2">発見種数</div>
                </div>
            </div>
        </section>

        <!-- 4. 注目種・希少種 -->
        <section class="mb-10 print-break-inside-avoid">
            <h2 class="text-lg font-bold text-blue-800 border-l-4 border-blue-500 pl-3 mb-4">注目種・希少種</h2>
            <?php if ($redListCount > 0): ?>
                <div class="bg-red-50 border border-red-100 rounded-xl p-5">
                    <p class="text-sm text-red-700 font-bold mb-4">レッドリスト該当種が <?= $redListCount ?> 種確認されました。</p>
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="border-b border-red-200">
                                <th class="text-left py-2 text-gray-600 font-bold">和名</th>
                                <th class="text-left py-2 text-gray-600 font-bold">学名</th>
                                <th class="text-center py-2 text-gray-600 font-bold">カテゴリ</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($redListSpecies as $name => $info): ?>
                                <tr class="border-b border-red-100">
                                    <td class="py-2 font-bold text-gray-800"><?= htmlspecialchars($name, ENT_QUOTES, 'UTF-8') ?></td>
                                    <td class="py-2 text-gray-500 italic"><?= htmlspecialchars($info['scientific_name'], ENT_QUOTES, 'UTF-8') ?></td>
                                    <td class="py-2 text-center">
                                        <span class="bg-red-500 text-white px-2 py-0.5 rounded text-xs font-black"><?= htmlspecialchars($info['category'], ENT_QUOTES, 'UTF-8') ?></span>
                                        <span class="text-xs text-red-600 ml-1"><?= htmlspecialchars($redListLabels[$info['category']] ?? '', ENT_QUOTES, 'UTF-8') ?></span>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            <?php else: ?>
                <div class="bg-gray-50 p-5 rounded-xl border border-gray-200 text-center text-sm text-gray-500">
                    今回の観察会では、レッドリスト該当種の記録はありませんでした。
                </div>
            <?php endif; ?>
        </section>

        <!-- 5. 代表写真ギャラリー -->
        <?php if (!empty($photos)): ?>
        <section class="mb-10 print-break-inside-avoid">
            <h2 class="text-lg font-bold text-blue-800 border-l-4 border-blue-500 pl-3 mb-4">代表写真ギャラリー</h2>
            <div class="grid grid-cols-3 gap-3">
                <?php foreach ($photos as $photo): ?>
                    <div class="aspect-square rounded-xl overflow-hidden bg-gray-100 relative">
                        <img src="<?= htmlspecialchars($photo['url'], ENT_QUOTES, 'UTF-8') ?>"
                             alt="<?= htmlspecialchars($photo['taxon'], ENT_QUOTES, 'UTF-8') ?>"
                             class="w-full h-full object-cover"
                             loading="lazy">
                        <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                            <span class="text-white text-xs font-bold"><?= htmlspecialchars($photo['taxon'], ENT_QUOTES, 'UTF-8') ?></span>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        </section>
        <?php endif; ?>

        <!-- 6. 種リスト表 -->
        <section class="mb-10 print-break-inside-avoid">
            <h2 class="text-lg font-bold text-blue-800 border-l-4 border-blue-500 pl-3 mb-4">種リスト（全 <?= $totalSpeciesCount ?> 種）</h2>
            <?php if ($totalSpeciesCount > 0): ?>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm border-collapse">
                        <thead>
                            <tr class="bg-gray-50 border-b-2 border-gray-200">
                                <th class="text-left py-2 px-3 font-bold text-gray-600">#</th>
                                <th class="text-left py-2 px-3 font-bold text-gray-600">和名</th>
                                <th class="text-left py-2 px-3 font-bold text-gray-600">学名</th>
                                <th class="text-center py-2 px-3 font-bold text-gray-600">件数</th>
                                <th class="text-center py-2 px-3 font-bold text-gray-600">希少種</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php
                            $idx = 1;
                            uasort($speciesSet, function ($a, $b) { return $b['count'] - $a['count']; });
                            foreach ($speciesSet as $name => $info):
                                $isRedList = isset($redListSpecies[$name]);
                            ?>
                                <tr class="border-b border-gray-100 <?= $isRedList ? 'bg-red-50' : '' ?>">
                                    <td class="py-2 px-3 text-gray-400"><?= $idx++ ?></td>
                                    <td class="py-2 px-3 font-bold text-gray-800"><?= htmlspecialchars($name, ENT_QUOTES, 'UTF-8') ?></td>
                                    <td class="py-2 px-3 text-gray-500 italic text-xs"><?= htmlspecialchars($info['scientific_name'], ENT_QUOTES, 'UTF-8') ?></td>
                                    <td class="py-2 px-3 text-center font-mono"><?= $info['count'] ?></td>
                                    <td class="py-2 px-3 text-center">
                                        <?php if ($isRedList): ?>
                                            <span class="bg-red-500 text-white px-2 py-0.5 rounded text-xs font-black"><?= htmlspecialchars($redListSpecies[$name]['category'], ENT_QUOTES, 'UTF-8') ?></span>
                                        <?php else: ?>
                                            <span class="text-gray-300">-</span>
                                        <?php endif; ?>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            <?php else: ?>
                <div class="bg-gray-50 p-5 rounded-xl border border-gray-200 text-center text-sm text-gray-500">
                    観察記録がありません。
                </div>
            <?php endif; ?>
        </section>

        <!-- 7. フッター -->
        <footer class="border-t-2 border-gray-200 pt-6 mt-10">
            <div class="flex justify-between items-center text-xs text-gray-400">
                <div>
                    Generated by <span class="font-bold text-gray-500">ikimon.life</span>
                    &mdash; 市民参加型生物多様性プラットフォーム
                </div>
                <div class="font-mono"><?= date('Y-m-d H:i') ?></div>
            </div>
        </footer>

    </div>

    <!-- 印刷 / CSV ボタン -->
    <div class="no-print fixed bottom-6 right-6 flex gap-2">
        <button onclick="window.print()" class="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition cursor-pointer">
            PDF保存 / 印刷
        </button>
        <a href="api/export_event_species_csv.php?event_id=<?= urlencode($eventId) ?>" class="bg-white text-blue-700 border border-blue-200 px-4 py-3 rounded-xl font-bold shadow-lg hover:bg-blue-50 transition">
            CSV
        </a>
    </div>

</body>
</html>
