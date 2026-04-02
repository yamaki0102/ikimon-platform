<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/CorporatePlanGate.php';
require_once __DIR__ . '/../libs/EventManager.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/GeoUtils.php';
require_once __DIR__ . '/../libs/RedListManager.php';

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

$corporation = CorporatePlanGate::resolveCorporationForEvent($event);
if ($corporation && !CorporatePlanGate::canUseAdvancedOutputs($corporation)) {
    http_response_code(403);
    die("Community ワークスペースでは助成金レポートを出力できません。Public プランで有効になります。");
}

// 権限チェック（主催者 or 管理者）
$isOrganizer = ($user['id'] === ($event['organizer_id'] ?? ''));
$isAdmin = (($user['role'] ?? '') === 'Admin');
if (!$isOrganizer && !$isAdmin) {
    die("このレポートを閲覧・生成する権限がありません。");
}

// 1. 観測データの収集 (api/get_event_live.php と同等のロジック)
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
$grantId = $event['grant_id'] ?? '指定なし';

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

$addObs = function ($obs) use (&$finalObservations, &$speciesSet, &$contributors, &$touchedObsIds, &$totalObsCount) {
    if (!isset($obs['id'])) return;
    $id = $obs['id'];
    if (isset($touchedObsIds[$id])) return;
    $touchedObsIds[$id] = true;

    $taxonName = $obs['taxon']['name'] ?? ($obs['identifications'][0]['taxon_name'] ?? '不明');
    $scientificName = $obs['taxon']['scientific_name'] ?? '';
    
    $uid = $obs['user_id'] ?? '';
    if ($uid) {
        if (!isset($contributors[$uid])) {
            $contributors[$uid] = true;
        }
    }

    if ($taxonName && $taxonName !== '不明') {
        if (!isset($speciesSet[$taxonName])) {
            $speciesSet[$taxonName] = [
                'scientific_name' => $scientificName,
                'count' => 0
            ];
        }
        $speciesSet[$taxonName]['count']++;
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

// 2. レッドリスト判定
RedListManager::checkObservations($finalObservations);

$redListSpeciesCount = 0;
$redListDetails = [];
foreach ($finalObservations as $obs) {
    $status = $obs['red_list_status'] ?? 'Not Evaluated';
    if (in_array($status, ['CR', 'EN', 'VU', 'NT', 'EX', 'EW'])) {
        $taxonName = $obs['taxon']['name'] ?? '不明';
        if (!isset($redListDetails[$taxonName])) {
            $redListDetails[$taxonName] = $status;
            $redListSpeciesCount++;
        }
    }
}

// 3. 参加者属性の集計 (Surveys)
$surveys = [];
if ($eventCode) {
    // surveyデータの検索 (eventTagに一致するもの)
    // 期間内のすべてのサーベイを検索対象にするのは非効率だが、最新500件程度でMVP対応
    $surveyCandidates = DataStore::getLatest('surveys', 1000);
    foreach ($surveyCandidates as $srv) {
        if (($srv['event_tag'] ?? '') === $eventCode) {
            $surveys[] = $srv;
        }
    }
}

$ageDemographics = [];
$participantTypes = [];
$surveyCount = count($surveys);

foreach ($surveys as $srv) {
    $ctx = $srv['context'] ?? [];
    $age = $ctx['age_group'] ?? '不明';
    $type = $ctx['participant_type'] ?? '不明';

    if (!isset($ageDemographics[$age])) $ageDemographics[$age] = 0;
    $ageDemographics[$age]++;

    if (!isset($participantTypes[$type])) $participantTypes[$type] = 0;
    $participantTypes[$type]++;
}

$totalSpeciesCount = count($speciesSet);

// Labels mapping
$ageLabels = [
    '10s' => '10代以下',
    '20s' => '20代',
    '30s' => '30代',
    '40s' => '40代',
    '50s' => '50代',
    '60s_plus' => '60代以上',
    '不明' => '未回答'
];
$typeLabels = [
    'local' => '地域住民',
    'visitor' => '観光・来訪者',
    'expert' => '専門家・研究者',
    'student' => '学生',
    'other' => 'その他',
    '不明' => '未回答'
];

$title = htmlspecialchars($event['title'] ?? '無題の観察会');
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>助成金・事業報告書 - <?php echo $title; ?></title>
    <link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700;900&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com/3.4.17"></script>
    <style>
        body { font-family: 'Zen Maru Gothic', sans-serif; background-color: #f3f4f6; }
        @media print {
            body { background-color: white; }
            .no-print { display: none !important; }
            .print-break-inside-avoid { break-inside: avoid; }
            .page-break { page-break-before: always; }
        }
        .report-page { max-width: 800px; margin: 0 auto; background: white; padding: 2.5rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
        @media print { .report-page { box-shadow: none; padding: 0; } }
    </style>
</head>
<body class="py-8 text-gray-800">

    <div class="max-w-[800px] mx-auto mb-4 flex justify-between items-center no-print">
        <a href="event_detail.php?id=<?php echo urlencode($eventId); ?>" class="text-emerald-600 font-bold hover:underline">← イベント詳細へ戻る</a>
        <button onclick="window.print()" class="bg-emerald-600 text-white px-5 py-2 rounded-xl font-bold shadow-sm hover:bg-emerald-700 transition">
            🖨️ PDF保存 / 印刷
        </button>
    </div>

    <div class="report-page rounded-2xl border border-gray-200">
        <!-- HEADER -->
        <header class="border-b-2 border-emerald-600 pb-6 mb-8 mt-2">
            <div class="flex justify-between items-start mb-2">
                <p class="text-sm font-bold text-gray-500 bg-gray-100 inline-block px-3 py-1 rounded-full">助成金・事業実績報告書</p>
                <div class="text-sm text-gray-500 font-mono">Report ID: <?php echo htmlspecialchars($eventCode ?: $eventId); ?></div>
            </div>
            <h1 class="text-3xl font-black text-gray-900 mt-4 leading-tight"><?php echo $title; ?></h1>
            <div class="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                    <span class="text-gray-500 inline-block w-20">開催日</span>
                    <span class="font-bold text-gray-800"><?php echo htmlspecialchars($eventDate); ?></span>
                </div>
                <div>
                    <span class="text-gray-500 inline-block w-20">時間</span>
                    <span class="font-bold text-gray-800"><?php echo htmlspecialchars($startTime); ?> ~ <?php echo htmlspecialchars($endTime); ?></span>
                </div>
                <div>
                    <span class="text-gray-500 inline-block w-20">開催地</span>
                    <span class="font-bold text-gray-800"><?php echo htmlspecialchars($event['location']['name'] ?? '指定なし'); ?></span>
                </div>
                <div>
                    <span class="text-gray-500 inline-block w-20">主催者</span>
                    <span class="font-bold text-gray-800"><?php echo htmlspecialchars($event['organizer_name'] ?? '不明'); ?></span>
                </div>
                <div class="col-span-2 mt-2 pt-2 border-t border-gray-100">
                    <span class="text-gray-500 inline-block w-20">助成事業</span>
                    <span class="font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded"><?php echo htmlspecialchars($grantId); ?></span>
                </div>
            </div>
        </header>

        <!-- KPI SUMMARY -->
        <section class="mb-10">
            <h2 class="text-lg font-bold text-emerald-800 border-l-4 border-emerald-500 pl-3 mb-4">■ 活動の成果 (KPI)</h2>
            <div class="grid grid-cols-4 gap-4">
                <div class="bg-gray-50 p-4 rounded-xl text-center border border-gray-100">
                    <div class="text-3xl font-black text-emerald-600"><?php echo $totalObsCount; ?></div>
                    <div class="text-xs font-bold text-gray-500 mt-1">収集データ数（件）</div>
                </div>
                <div class="bg-gray-50 p-4 rounded-xl text-center border border-gray-100">
                    <div class="text-3xl font-black text-blue-600"><?php echo $totalSpeciesCount; ?></div>
                    <div class="text-xs font-bold text-gray-500 mt-1">確認された種数（種）</div>
                </div>
                <div class="bg-gray-50 p-4 rounded-xl text-center border border-gray-100 relative overflow-hidden">
                    <div class="text-3xl font-black text-red-500 relative z-10"><?php echo $redListSpeciesCount; ?></div>
                    <div class="text-xs font-bold text-gray-500 mt-1 relative z-10">重要種/希少種（種）</div>
                    <?php if ($redListSpeciesCount > 0): ?>
                        <div class="absolute -right-2 -bottom-2 text-4xl opacity-10">⚠️</div>
                    <?php endif; ?>
                </div>
                <div class="bg-gray-50 p-4 rounded-xl text-center border border-gray-100">
                    <div class="text-3xl font-black text-orange-500"><?php echo count($contributors); ?></div>
                    <div class="text-xs font-bold text-gray-500 mt-1">実参加者数（人）</div>
                </div>
            </div>
        </section>

        <!-- DEMOGRAPHICS -->
        <section class="mb-10 print-break-inside-avoid">
            <h2 class="text-lg font-bold text-emerald-800 border-l-4 border-emerald-500 pl-3 mb-4">■ 参加者属性分析（有効回答数: <?php echo $surveyCount; ?>）</h2>
            <?php if ($surveyCount > 0): ?>
                <div class="grid grid-cols-2 gap-6">
                    <!-- 年齢層 -->
                    <div class="bg-white border text-sm border-gray-200 rounded-xl overflow-hidden">
                        <div class="bg-gray-50 px-4 py-2 border-b border-gray-200 font-bold text-gray-700">年齢層分布</div>
                        <div class="p-4 space-y-2">
                            <?php foreach ($ageDemographics as $key => $count): ?>
                                <?php $pct = round(($count / $surveyCount) * 100); ?>
                                <div class="flex items-center text-xs">
                                    <div class="w-20 text-gray-600 font-bold"><?php echo htmlspecialchars($ageLabels[$key] ?? $key); ?></div>
                                    <div class="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden ml-2 mr-3">
                                        <div class="bg-emerald-500 h-full" style="width: <?php echo $pct; ?>%"></div>
                                    </div>
                                    <div class="w-10 text-right text-gray-500 font-mono"><?php echo $count; ?>人</div>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    </div>
                    <!-- 参加属性 -->
                    <div class="bg-white border text-sm border-gray-200 rounded-xl overflow-hidden">
                        <div class="bg-gray-50 px-4 py-2 border-b border-gray-200 font-bold text-gray-700">参加者の居住区域・属性</div>
                        <div class="p-4 space-y-2">
                            <?php foreach ($participantTypes as $key => $count): ?>
                                <?php $pct = round(($count / $surveyCount) * 100); ?>
                                <div class="flex items-center text-xs">
                                    <div class="w-24 text-gray-600 font-bold truncate"><?php echo htmlspecialchars($typeLabels[$key] ?? $key); ?></div>
                                    <div class="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden ml-2 mr-3">
                                        <div class="bg-blue-500 h-full" style="width: <?php echo $pct; ?>%"></div>
                                    </div>
                                    <div class="w-10 text-right text-gray-500 font-mono"><?php echo $count; ?>人</div>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    </div>
                </div>
            <?php else: ?>
                <div class="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-gray-500 text-sm">
                    イベントコード「<?php echo htmlspecialchars($eventCode); ?>」を入力して開始されたアンケートデータがありません。<br>
                    ※アプリ上で調査を開始する際にイベントコードが入力されている必要があります。
                </div>
            <?php endif; ?>
        </section>

        <!-- HIGHLIGHTS & REDLIST -->
        <section class="mb-10 print-break-inside-avoid">
            <h2 class="text-lg font-bold text-emerald-800 border-l-4 border-emerald-500 pl-3 mb-4">■ 希少種・重要種の保全指標</h2>
            <?php if ($redListSpeciesCount > 0): ?>
                <div class="bg-red-50 border border-red-100 rounded-xl p-5">
                    <p class="text-sm text-red-700 font-bold mb-3">当調査エリアにて、以下の環境省指定レッドリスト種（または準絶滅危惧種等）の生息・生育が確認されました。今後の保全活動において重要な指標となります。</p>
                    <div class="grid grid-cols-2 gap-3">
                        <?php foreach ($redListDetails as $tName => $rstatus): ?>
                            <div class="bg-white p-3 rounded-lg border border-red-200 flex items-center justify-between">
                                <span class="font-bold text-gray-800 text-sm"><?php echo htmlspecialchars($tName); ?></span>
                                <span class="bg-red-500 text-white px-2 py-0.5 rounded text-xs font-black"><?php echo htmlspecialchars($rstatus); ?></span>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            <?php else: ?>
                <div class="bg-gray-50 p-5 rounded-xl border border-gray-200 text-center text-sm text-gray-500">
                    今回の調査では、レッドリスト該当種の発見は記録されていません。
                </div>
            <?php endif; ?>
        </section>

        <!-- DATA EXTRACT MESSAGE -->
        <section class="border-t border-gray-200 pt-6 mt-10 print-break-inside-avoid">
            <p class="text-xs text-center text-gray-400 leading-relaxed">
                本報告書の基礎データは、市民参加型生物多様性モニタリングシステム「ikimon.life」を用いて収集・集計されています。<br>
                記録された生物データは、Darwin Core 形式での整理と外部アーカイブ連携を見据えて管理されています。<br>
                Data Export Generated at <?php echo date('Y-m-d H:i'); ?>
            </p>
        </section>
    </div>

</body>
</html>
