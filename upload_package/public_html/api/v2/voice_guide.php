<?php

/**
 * API v2: Voice Guide — AI解説 + VOICEVOX音声生成
 *
 * GET /api/v2/voice_guide.php
 *   ?name=シジュウカラ&scientific_name=Parus+minor&confidence=0.85&voice_mode=standard|auto|mochiko|ryusei|zundamon
 *   ?mode=ambient&lat=35.0&lng=139.0&detected_species=シジュウカラ,ウグイス  (定期コメンタリー)
 *
 * レスポンス:
 *   { success: true, data: { guide_text: "...", audio_url: "..." } }
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/OmoikaneSearchEngine.php';

Auth::init();
if (!Auth::isLoggedIn()) {
    api_error('Login required', 401);
}

if (!api_rate_limit('voice_guide', 30, 60)) {
    api_error('Rate limit exceeded', 429);
}

$requestMode = api_param('mode', 'detection');
$voiceMode = api_param('voice_mode', 'gemini-bright');
$validModes = ['standard', 'auto', 'mochiko', 'ryusei', 'zundamon', 'gemini-bright', 'gemini-calm'];
if (!in_array($voiceMode, $validModes, true)) {
    $voiceMode = 'gemini-bright';
}
$isZundamonStyle = ($voiceMode === 'zundamon');
$isGeminiTTS = str_starts_with($voiceMode, 'gemini-');

$guideLang = api_param('lang', 'ja');
if (!preg_match('/^[a-z]{2}(-[A-Z]{2})?$/', $guideLang)) $guideLang = 'ja';
$isJapanese = ($guideLang === 'ja');

$useVoicevoxAudio = in_array($voiceMode, ['auto', 'mochiko', 'ryusei', 'zundamon'], true) && $isJapanese;
if (!$isJapanese) {
    $isZundamonStyle = false;
    if (!$isGeminiTTS) $isGeminiTTS = true;
}

$transportMode = api_param('transport_mode', 'walk');
if (!in_array($transportMode, ['walk', 'bike', 'car', 'drive', 'stationary'], true)) {
    $transportMode = 'walk';
}
if ($transportMode === 'drive') $transportMode = 'car';
$transportLabel = $isJapanese ? match($transportMode) {
    'car' => '車',
    'bike' => '自転車',
    'stationary' => '静止',
    default => '徒歩',
} : match($transportMode) {
    'car' => 'car',
    'bike' => 'bicycle',
    'stationary' => 'stationary',
    default => 'walking',
};

$month = (int)date('n');
$hour = (int)date('G');
$seasonName = $isJapanese ? match(true) {
    $month >= 3 && $month <= 5 => '春',
    $month >= 6 && $month <= 8 => '夏',
    $month >= 9 && $month <= 11 => '秋',
    default => '冬',
} : match(true) {
    $month >= 3 && $month <= 5 => 'spring',
    $month >= 6 && $month <= 8 => 'summer',
    $month >= 9 && $month <= 11 => 'autumn',
    default => 'winter',
};
$timeOfDay = $isJapanese ? match(true) {
    $hour >= 5 && $hour < 10 => '朝',
    $hour >= 10 && $hour < 16 => '日中',
    $hour >= 16 && $hour < 19 => '夕方',
    default => '夜',
} : match(true) {
    $hour >= 5 && $hour < 10 => 'morning',
    $hour >= 10 && $hour < 16 => 'daytime',
    $hour >= 16 && $hour < 19 => 'evening',
    default => 'night',
};

$langInstruction = '';
if (!$isJapanese) {
    $langName = match($guideLang) {
        'en' => 'English', 'zh' => 'Chinese (Simplified)', 'ko' => 'Korean',
        'es' => 'Spanish', 'fr' => 'French', 'pt' => 'Portuguese', 'de' => 'German',
        default => $guideLang,
    };
    $langInstruction = "IMPORTANT: Respond ENTIRELY in {$langName}. Translate all Japanese content (landscape history, conservation stories, species names) into {$langName} naturally. Do not include any Japanese text in your response.";
}

// --- 過去発話の記憶（ユーザーごとに直近30件を保持） ---
$user = Auth::user();
$userId = preg_replace('/[^a-zA-Z0-9_\-]/', '', $user['id'] ?? '');
if (empty($userId)) api_error('Invalid session', 401);
$historyFile = DATA_DIR . "voice_guide_history/{$userId}.json";
$pastTexts = [];
if (file_exists($historyFile)) {
    $pastTexts = json_decode(file_get_contents($historyFile), true) ?: [];
}

function _saveHistory(string $userId, string $text, array &$pastTexts): void
{
    // 保存テキスト長を160文字に拡大（重複回避の精度向上）
    $pastTexts[] = ['text' => mb_substr($text, 0, 160), 'at' => date('c')];
    if (count($pastTexts) > 50) $pastTexts = array_slice($pastTexts, -50);
    $dir = DATA_DIR . 'voice_guide_history';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    file_put_contents(DATA_DIR . "voice_guide_history/{$userId}.json",
        json_encode($pastTexts, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

function _getConservationStoryContext(float $lat, float $lng): string
{
    if ($lat == 0 && $lng == 0) return '';
    try {
        require_once ROOT_DIR . '/libs/SiteManager.php';
        foreach (SiteManager::listAll() as $s) {
            if (SiteManager::isPointInSite($lat, $lng, $s['id'])) {
                $guideFile = DATA_DIR . "sites/{$s['id']}/guide.json";
                if (!file_exists($guideFile)) break;
                $gd = json_decode(file_get_contents($guideFile), true);
                $cs = $gd['conservation_story'] ?? null;
                if (!$cs) break;
                $parts = ["【このサイトの保全ストーリー（事実を語って。感動を押し付けない）】"];
                if (!empty($cs['milestones'])) {
                    foreach (array_slice(array_reverse($cs['milestones']), 0, 3) as $m) {
                        $parts[] = "- {$m['year']}年: {$m['title']} — {$m['description']}";
                    }
                }
                if (!empty($cs['key_people'])) {
                    $p = $cs['key_people'][0];
                    $parts[] = "立役者: {$p['role']} — {$p['contribution']}";
                }
                if (!empty($cs['ongoing_activities'])) {
                    $acts = array_column(array_slice($cs['ongoing_activities'], 0, 2), 'title');
                    $parts[] = "現在の活動: " . implode('、', $acts);
                }
                $parts[] = "→ 検出種との関連がありそうなら自然に織り込んで。なければ無理に触れなくてOK。";
                return implode("\n", $parts);
            }
        }
    } catch (Throwable $e) {}
    return '';
}

// --- エリア情報モード（軽量：Gemini不使用、周辺観察データのみ） ---
if ($requestMode === 'area_info') {
    $lat = api_param('lat', 0, 'float');
    $lng = api_param('lng', 0, 'float');

    $areaName = '';
    try {
        require_once ROOT_DIR . '/libs/GeoUtils.php';
        $geo = GeoUtils::reverseGeocode($lat, $lng);
        $areaName = trim(($geo['prefecture'] ?? '') . ' ' . ($geo['municipality'] ?? ''));
    } catch (Throwable $e) {}

    $nearbySpecies = [];
    $totalObs = 0;
    try {
        $allObs = DataStore::fetchAll('observations');
        $R = 6371;
        foreach ($allObs as $obs) {
            $oLat = (float)($obs['location']['lat'] ?? $obs['lat'] ?? 0);
            $oLng = (float)($obs['location']['lng'] ?? $obs['lng'] ?? 0);
            if ($oLat == 0 && $oLng == 0) continue;
            $dLat = deg2rad($oLat - $lat);
            $dLng = deg2rad($oLng - $lng);
            $a = sin($dLat/2)**2 + cos(deg2rad($lat)) * cos(deg2rad($oLat)) * sin($dLng/2)**2;
            $dist = $R * 2 * atan2(sqrt($a), sqrt(1 - $a));
            if ($dist <= 3.0) {
                $totalObs++;
                $name = $obs['taxon']['name'] ?? $obs['species_name'] ?? '';
                if ($name) {
                    $key = $name;
                    if (!isset($nearbySpecies[$key])) {
                        $nearbySpecies[$key] = ['name' => $name, 'count' => 0];
                    }
                    $nearbySpecies[$key]['count']++;
                }
            }
        }
    } catch (Throwable $e) {}

    uasort($nearbySpecies, fn($a, $b) => $b['count'] - $a['count']);
    $topSpecies = array_map(fn($s) => $s['name'], array_slice(array_values($nearbySpecies), 0, 10));

    api_success([
        'area_name' => $areaName,
        'species_count' => count($nearbySpecies),
        'total_observations' => $totalObs,
        'top_species' => $topSpecies,
        'season' => $seasonName,
    ]);
}

// --- オープニングモード（セッション開始時の情景描写） ---
if ($requestMode === 'opening') {
    $lat = api_param('lat', 0, 'float');
    $lng = api_param('lng', 0, 'float');
    $weather = api_param('weather', '');
    $temperature = api_param('temperature', '', 'string');
    $lifeListCount = api_param('life_list_count', 0, 'int');

    $areaName = '';
    try {
        require_once ROOT_DIR . '/libs/GeoUtils.php';
        $geo = GeoUtils::reverseGeocode($lat, $lng);
        $areaName = trim(($geo['prefecture'] ?? '') . ' ' . ($geo['municipality'] ?? ''));
    } catch (Throwable $e) {}

    $nearbyContext = ($lat && $lng) ? _getNearbyObservations($lat, $lng, 2.0) : '';
    $pastSpeciesCount = substr_count($nearbyContext, "\n") + ($nearbyContext ? 1 : 0);

    // 過去の散歩の記憶を引き出す
    $pastHighlights = _loadPastHighlights($userId, 3);
    $memoryContext = '';
    if (!empty($pastHighlights)) {
        $lastVisit = $pastHighlights[0];
        $daysSince = (int)((time() - strtotime($lastVisit['date'])) / 86400);
        if ($daysSince > 0 && $daysSince < 90) {
            $memoryContext = "前回は{$daysSince}日前に{$lastVisit['area']}で{$lastVisit['highlight_species']}に会っている。さりげなく触れて。";
        }
    }

    $styleInstruction = $isZundamonStyle
        ? 'ずんだもんの口調で話してください。語尾は「〜のだ」「〜なのだ」。一人称は「ずんだもん」。'
        : '親しい友人のような口調で。敬語は軽めに。';

    $weatherNote = $weather ? "天気: {$weather}" : '';
    $tempNote = $temperature ? "気温: {$temperature}" : '';

    // 景観史コンテキスト
    $openingLandscape = '';
    if ($lat && $lng) {
        try {
            require_once ROOT_DIR . '/libs/LandscapeHistoryContext.php';
            $openingLandscape = LandscapeHistoryContext::getPromptContext(
                $lat, $lng, null, null, 'opening', $userId
            );
        } catch (Throwable $e) {}
    }

    $openingConservation = _getConservationStoryContext($lat, $lng);

    $prompt = <<<PROMPT
あなたは自然散策の相棒です。これからフィールドに出る人に、その場所の空気感を伝える短い挨拶を生成してください。

{$langInstruction}
{$styleInstruction}

場所: {$areaName}（緯度{$lat}、経度{$lng}）
季節: {$seasonName}（{$month}月）  時間帯: {$timeOfDay}
{$weatherNote}
{$tempNote}
この付近の過去の観察記録: {$pastSpeciesCount}種
{$memoryContext}

過去の観察データ:
{$nearbyContext}

{$openingLandscape}
{$openingConservation}

要件:
- その場所の空気感・季節感を2〜3文で描写（例: 風、光、音、匂い）
- 景観史の情報があれば「昔ここは〇〇だった。だから今でも△△がいる」のように1-2文で自然に織り込む
- 保全ストーリーがあれば「この場所は〇〇年の歴史がある」のように1文で自然に触れる
- 過去の観察データがあれば「この辺りでは以前〇〇が観察されてるよ」と1文
- この場所の自然の特徴や季節ならではの見どころを1〜2文
- 最後に「何に出会えるかな」的な期待感を1文
- 合計4〜8文、200〜400文字。情景描写を豊かに。じっくり語ってOK
- 百科事典的な説明はしない。五感に訴える情景描写を
- 音声読み上げ用なので難しい漢字はひらがなで

表現ルール:
- 「珍しい」「レアな」等の希少性を煽る表現禁止
- 植物は「ある」「生えている」「咲いている」、動物は「いる」「見つけた」と使い分ける
PROMPT;

    $guideText = _callGemini($prompt);
    if (empty($guideText)) {
        $guideText = $isZundamonStyle
            ? "{$areaName}に来たのだ！{$seasonName}の自然を楽しむのだ！"
            : "{$areaName}。{$seasonName}の空気が気持ちいいね。さあ、何に出会えるかな。";
    }

    _saveHistory($userId, $guideText, $pastTexts);

    $result = ['guide_text' => $guideText, 'audio_url' => null, 'mode' => 'opening', 'lang' => $guideLang];
    if (!$isJapanese) {
        $result['tts_locale'] = match($guideLang) {
            'en' => 'en-US', 'zh' => 'zh-CN', 'ko' => 'ko-KR', 'es' => 'es-ES',
            'fr' => 'fr-FR', 'pt' => 'pt-BR', 'de' => 'de-DE', default => $guideLang,
        };
    }
    $audioUrl = _generateAudio($guideText, $voiceMode, $guideLang, $useVoicevoxAudio, $isGeminiTTS);
    if ($audioUrl) $result['audio_url'] = $audioUrl;
    api_success($result);
}

// --- クロージングモード（セッション終了時の記憶化） ---
if ($requestMode === 'closing') {
    $lat = api_param('lat', 0, 'float');
    $lng = api_param('lng', 0, 'float');
    $weather = api_param('weather', '');
    $speciesListRaw = api_param('species', '');
    $durationMin = api_param('duration_min', 0, 'int');
    $speciesCount = api_param('species_count', 0, 'int');
    $highlightSpecies = api_param('highlight_species', '');
    $silentMinutes = api_param('silent_minutes', 0, 'int');

    $areaName = '';
    try {
        require_once ROOT_DIR . '/libs/GeoUtils.php';
        $geo = GeoUtils::reverseGeocode($lat, $lng);
        $areaName = trim(($geo['prefecture'] ?? '') . ' ' . ($geo['municipality'] ?? ''));
    } catch (Throwable $e) {}

    // 過去の today_highlight を読み出し（最新5件）
    $pastHighlights = _loadPastHighlights($userId, 5);
    $memoryContext = '';
    if (!empty($pastHighlights)) {
        $memoryLines = array_map(function($h) {
            return "- {$h['date']} {$h['area']}: {$h['highlight_species']}（{$h['weather']}）";
        }, $pastHighlights);
        $memoryContext = "キミの最近の自然体験:\n" . implode("\n", $memoryLines) . "\n→ 過去の体験と今日をつなげる一言を添えられるなら添えて。";
    }

    $styleInstruction = $isZundamonStyle
        ? 'ずんだもんの口調で話してください。語尾は「〜のだ」「〜なのだ」。一人称は「ずんだもん」。'
        : '親しい友人のような温かい口調で。';

    $silentContext = $silentMinutes > 5
        ? "今日は静かな時間が{$silentMinutes}分ほどあった。それも自然体験の一部として肯定的に触れて。"
        : '';

    $timeFeeling = match($timeOfDay) {
        '朝' => '朝の澄んだ空気の中で',
        '日中' => '',
        '夕方' => '夕暮れの柔らかい光の中で',
        '夜' => '暗がりの静けさの中で',
        default => '',
    };
    $weatherFeeling = match(true) {
        str_contains($weather, '雨') => '雨上がりの匂いが漂う',
        str_contains($weather, '曇') => '雲に覆われた穏やかな',
        str_contains($weather, '晴') => '澄んだ空の下の',
        str_contains($weather, '風') => '風の強い',
        default => '',
    };

    // 景観史コンテキスト（closing用）
    $closingLandscape = '';
    if ($lat && $lng) {
        try {
            require_once ROOT_DIR . '/libs/LandscapeHistoryContext.php';
            $closingLandscape = LandscapeHistoryContext::getPromptContext(
                $lat, $lng, $highlightSpecies ?: null, null, 'closing', $userId
            );
        } catch (Throwable $e) {}
    }

    $closingConservation = _getConservationStoryContext($lat, $lng);

    $prompt = <<<PROMPT
あなたは自然散策の相棒です。セッションが終わった仲間に、今日の体験を記憶に残す短いメッセージを贈ってください。

{$langInstruction}
{$styleInstruction}

場所: {$areaName}
季節: {$seasonName}（{$month}月）  時間帯: {$timeOfDay}
天気: {$weather}
セッション時間: {$durationMin}分
検出された種: {$speciesListRaw}（{$speciesCount}種）
最も印象的な出会い: {$highlightSpecies}
{$silentContext}
{$memoryContext}
{$closingLandscape}
{$closingConservation}

要件:
- 「今日は{$weatherFeeling}{$timeFeeling}…」のように、天気と時間帯の空気感から始める
- 最も印象的な出会いに触れて、その出会いに小さな意味を添える（豆知識1つ）
- 景観史の情報があれば「今日歩いた場所は、昔は〇〇だった。キミのデータがその変化を記録している」のように1-2文添える
- 保全ストーリーがあれば「この場所を守ってきた人たちの努力と、キミの今日の記録がつながっている」のように1文添える
- 数字の羅列（「N分でN種」）で終わらない。その日の体験の手触りを伝える
- 最後に「次は〇〇してみて」と具体的な再訪の伏線を1つ（時間帯・季節・場所を変える提案）
- 合計4〜8文、200〜400文字。体験の余韻を豊かに。じっくり語ってOK
- 集計レポートではなく、散歩から帰る友達に贈る最後の一言として
- 音声読み上げ用なので難しい漢字はひらがなで

表現ルール:
- 「珍しい」「レアな」等の希少性を煽る表現禁止
- 植物は「ある」「生えている」「咲いている」、動物は「いる」「見つけた」と使い分ける
PROMPT;

    $guideText = _callGemini($prompt);
    if (empty($guideText)) {
        $atmosPrefix = $weatherFeeling ? "{$weatherFeeling}一日だったね。" : "{$seasonName}の{$timeOfDay}、お疲れさま。";
        if ($speciesCount === 0) {
            $guideText = $isZundamonStyle
                ? "{$atmosPrefix}生き物には会えなかったけど、{$areaName}の空気を感じられたのだ！次は朝早く来てみるのだ。"
                : "{$atmosPrefix}静かな時間だったけど、それも自然体験。次は違う時間帯に来てみて。";
        } else {
            $guideText = $isZundamonStyle
                ? "{$atmosPrefix}{$highlightSpecies}に会えたのだ！この出会いを覚えておくのだ。次は朝に来てみるのだ！"
                : "{$atmosPrefix}{$highlightSpecies}との出会い、覚えておこう。次は少し早い時間に来てみて。違う顔ぶれに会えるかも。";
        }
    }

    _saveHistory($userId, $guideText, $pastTexts);

    // today_highlight を保存
    $highlight = [
        'date' => date('Y-m-d'),
        'time' => date('H:i'),
        'area' => $areaName,
        'weather' => $weather,
        'season' => $seasonName,
        'duration_min' => $durationMin,
        'species_count' => $speciesCount,
        'highlight_species' => $highlightSpecies,
        'species_list' => $speciesListRaw,
        'closing_message' => mb_substr($guideText, 0, 200),
        'emotion_tags' => _inferEmotionTags($speciesCount, $durationMin, $silentMinutes),
    ];
    _saveTodayHighlight($userId, $highlight);

    $result = ['guide_text' => $guideText, 'audio_url' => null, 'mode' => 'closing', 'lang' => $guideLang, 'today_highlight' => $highlight];
    if (!$isJapanese) {
        $result['tts_locale'] = match($guideLang) {
            'en' => 'en-US', 'zh' => 'zh-CN', 'ko' => 'ko-KR', 'es' => 'es-ES',
            'fr' => 'fr-FR', 'pt' => 'pt-BR', 'de' => 'de-DE', default => $guideLang,
        };
    }
    $audioUrl = _generateAudio($guideText, $voiceMode, $guideLang, $useVoicevoxAudio, $isGeminiTTS);
    if ($audioUrl) $result['audio_url'] = $audioUrl;
    api_success($result);
}

// --- 沈黙モード（何も検出されない時間の価値化） ---
if ($requestMode === 'silence') {
    $lat = api_param('lat', 0, 'float');
    $lng = api_param('lng', 0, 'float');
    $weather = api_param('weather', '');
    $silentMin = api_param('silent_min', 5, 'int');
    $detectedSpecies = api_param('detected_species', '');
    $silenceDepth = api_param('silence_depth', 'gentle');

    $areaName = '';
    try {
        require_once ROOT_DIR . '/libs/GeoUtils.php';
        $geo = GeoUtils::reverseGeocode($lat, $lng);
        $areaName = trim(($geo['prefecture'] ?? '') . ' ' . ($geo['municipality'] ?? ''));
    } catch (Throwable $e) {}

    $styleInstruction = $isZundamonStyle
        ? 'ずんだもんの口調で話してください。語尾は「〜のだ」「〜なのだ」。一人称は「ずんだもん」。'
        : '穏やかで詩的な口調で。';

    $depthAngles = [
        'gentle' => [
            '今は耳を澄ませる時間。風の音、葉擦れの音、遠くの鳥の声に意識を向けてみて',
            '静かな時間も自然観察の一部。目を凝らしてみて。足元に小さな発見があるかも',
            '鳥たちは警戒すると黙る。少し立ち止まって待ってみると、また歌い始めるかも',
        ],
        'sensory' => [
            '深呼吸してみて。この場所の匂いを覚えておこう。季節が変われば匂いも変わる',
            '目を閉じて10秒。風の向き、日差しの温度、足元の感触。五感で覚える散歩にしよう',
            '葉っぱの裏を覗いてみて。小さな虫たちの世界が広がっているかも',
            '地面をよく見て。小さな足跡や食べ跡があれば、夜の住人がいる証拠',
        ],
        'poetic' => [
            '何もいないように見えて、実はたくさんの生き物がこちらを見ている。気配を感じてみて',
            '自然のリズムはゆっくり。この静けさは、次の出会いまでの間合い',
            'この静かな時間を、この場所はきっと覚えている。キミがここにいたことも',
            'いつか「あの日、何も見つからなかったけど良い散歩だった」と思い出す日が来るかもね',
        ],
    ];
    $pool = $depthAngles[$silenceDepth] ?? $depthAngles['gentle'];
    $angle = $pool[array_rand($pool)];

    $recentTexts = array_slice(array_column($pastTexts, 'text'), -5);
    $avoidList = !empty($recentTexts)
        ? "以下は最近話した内容。重複しないで:\n" . implode("\n", array_map(fn($t) => "- {$t}", $recentTexts))
        : '';

    $prompt = <<<PROMPT
あなたは自然散策の相棒です。しばらく生き物の検出がない静かな時間が続いています。
この沈黙を退屈ではなく、価値ある体験として伝えてください。

{$styleInstruction}

場所: {$areaName}
季節: {$seasonName}  時間帯: {$timeOfDay}
天気: {$weather}
静かな時間: {$silentMin}分
{$detectedSpecies}

ヒント: {$angle}

{$avoidList}

条件:
- 2〜4文、100〜150文字。周囲の自然環境について語りかける
- 説教臭くしない。ふっと心が軽くなるような一言
- 五感（聴覚・嗅覚・触覚）を使った提案を含めて
- この場所の環境や季節の特徴について、ちょっとした知識を1つ添える
- 音声読み上げ用なので難しい漢字はひらがなで

表現ルール:
- 「珍しい」「レアな」等の希少性を煽る表現禁止
- 植物は「ある」「生えている」、動物は「いる」と使い分ける
PROMPT;

    $guideText = _callGemini($prompt);
    if (empty($guideText)) {
        $fallbacks = $isZundamonStyle
            ? ['gentle' => '静かな時間も大切なのだ。耳を澄ませてみるのだ。',
               'sensory' => '深呼吸してみるのだ。この場所の匂いを覚えておくのだ。',
               'poetic' => 'この静けさの中に、ずんだもんたちは包まれているのだ。']
            : ['gentle' => '静かだね。耳を澄ませてみて。遠くで何か鳴いてるかも。',
               'sensory' => '深呼吸してみて。この場所の匂いを覚えておこう。',
               'poetic' => 'この静けさも、きっといい思い出になる。'];
        $guideText = $fallbacks[$silenceDepth] ?? $fallbacks['gentle'];
    }

    _saveHistory($userId, $guideText, $pastTexts);

    $result = ['guide_text' => $guideText, 'audio_url' => null, 'mode' => 'silence'];
    $audioUrl = _generateAudio($guideText, $voiceMode, $guideLang, $useVoicevoxAudio, $isGeminiTTS);
    if ($audioUrl) $result['audio_url'] = $audioUrl;
    api_success($result);
}

// --- アンビエントモード（定期コメンタリー） ---
if ($requestMode === 'ambient') {
    $lat = api_param('lat', 0, 'float');
    $lng = api_param('lng', 0, 'float');
    $detectedSpecies = api_param('detected_species', '');
    $elapsedMin = api_param('elapsed_min', 0, 'int');
    $sessionCount = api_param('session_count', 0, 'int');
    $weather = api_param('weather', '');

    $areaName = '';
    try {
        require_once ROOT_DIR . '/libs/GeoUtils.php';
        $geo = GeoUtils::reverseGeocode($lat, $lng);
        $areaName = trim(($geo['prefecture'] ?? '') . ' ' . ($geo['municipality'] ?? ''));
    } catch (Throwable $e) {}

    // 付近の過去観察・同定データを取得（半径2km以内）
    $nearbyContext = _getNearbyObservations($lat, $lng, 2.0);

    $styleInstruction = $isZundamonStyle
        ? 'ずんだもんの口調で話してください。語尾は「〜のだ」「〜なのだ」。一人称は「ずんだもん」。'
        : '優しいネイチャーガイドの口調で話してください。';

    $topicPool = [
        'この地域にいる生き物の「つながり」を1つ教えて。食べる・食べられるだけじゃなく、巣を提供する・花粉を運ぶ・種を撒くみたいな意外な関係で',
        '今キミがいるこの場所で、見えないところで生態系を支えている存在を1つ紹介して。土の中の菌類、落ち葉を分解する虫、木の根のネットワークなど',
        'この地域の自然が「健康かどうか」を見分けるサインを1つ教えて。「〇〇がいれば安心」「△△が減ったら注意」のように、今日の散歩が小さな健康診断になっている話を',
        '30by30って知ってる？日本の陸と海の30%を2030年までに保全する目標。キミが今いるこの場所のデータが、実はその判断材料になっている話をして',
        'この季節ならではの生き物の行動パターンを1つ。今この瞬間に何が起きているか、想像力をくすぐるように',
        '里山って何がすごいか。人が手を入れることで多様性が生まれる、世界的にも珍しい仕組みを、この地域に絡めて',
        'ネイチャーポジティブって、自然を「守る」じゃなく「増やす」こと。この地域で自然が増えている兆しがあるなら、それを。なければ「こうなったらいいよね」という希望を',
        '実は身近な鳥が生態系のエンジニアだという話。巣穴を掘る・種を運ぶ・害虫を食べる。「いて当たり前」に見えて、いなくなったら困る存在',
        '季節の変わり目に起きる生き物のリレー。「〇〇が去ると△△が来る」「花が咲くとあの虫が動き出す」のような連鎖を',
        '都市でも自然は頑張っている話。街路樹の隙間、ビルの屋上、排水溝の脇——意外な場所で生きている生き物と、その逞しさ',
        '市民が記録したデータが実際に保全に使われた事例。キミの1件の記録が、どういう流れで「守る」につながるのか',
        '渡り鳥のルートと日本の位置。今この瞬間、地球の反対側から飛んできた鳥がこの辺りにいるかもしれない話',
        '木1本がどれだけの生き物を養っているか。虫、鳥、菌類、苔——1本の木を中心にした小さな生態系の話',
        '水辺が「腎臓」と呼ばれる理由。川や湿地が水を浄化し、その恩恵で暮らせている私たちの話を、この地域に結びつけて',
        '日本は世界的に見て生物多様性ホットスポット。この狭い島国になぜこんなに多くの種がいるのか、地形と気候の話を短く',
        '外来種がいたらそれも観察の発見。「悪者」としてではなく、なぜここにいるのか、生態系にどう影響しているかを客観的に',
        '花粉を運ぶ虫たちがいなくなったら、この地域の風景はどう変わるか。受粉の仕組みを「もしいなかったら」で伝えて',
        '日本の文化と自然の関わり。俳句の季語に虫の名前が入っている理由、七十二候の細やかさ——昔の日本人は自然をもっと近くに感じていた',
        '生き物の名前の由来を1つ。「なぜそう呼ばれるのか」を知ると、次に見たとき見方が変わる',
        'この時間帯に活動する生き物がいる理由。昼と夜で住人が入れ替わる「シフト交代」の話',
        'この地域の植生タイプ（落葉広葉樹林、常緑樹、水田地帯、河川敷など）を伝えて。「こういう環境だから〇〇が棲める」という地域と生き物のつながりを短く',
        'この地域で過去に観察された種のデータに基づいて「ここには〇〇もいるはず。次に来た時に探してみて」のように、次回の楽しみを提案して',
    ];

    // 景観史テーマをトピックプールに追加（データがある場合は重み3倍で優先選択）
    $ambientLandscape = '';
    if ($lat && $lng) {
        try {
            require_once ROOT_DIR . '/libs/LandscapeHistoryContext.php';
            $ambientLandscape = LandscapeHistoryContext::getPromptContext(
                $lat, $lng, null, null, 'ambient', $userId
            );
        } catch (Throwable $e) {}
    }
    if (!empty($ambientLandscape)) {
        $landscapeTopic = 'この場所の景観の歴史と生き物の関係を語って。下記の景観史情報を使って。';
        $topicPool[] = $landscapeTopic;
        $topicPool[] = $landscapeTopic;
        $topicPool[] = $landscapeTopic;
    }

    $ambientConservation = _getConservationStoryContext($lat, $lng);
    if (!empty($ambientConservation)) {
        $conservationTopic = 'この場所の保全ストーリー（歴史・人・活動）を語って。下記の情報を使って。';
        $topicPool[] = $conservationTopic;
        $topicPool[] = $conservationTopic;
    }

    $topic = $topicPool[array_rand($topicPool)];

    $speciesContext = $detectedSpecies
        ? "今日検出された種: {$detectedSpecies}。この種に関連づけて話を展開して。"
        : '';

    $nearbySpeciesContext = $nearbyContext
        ? "この付近（半径2km）の過去の観察・同定データ:\n{$nearbyContext}\nこのデータを活かして話を展開して。"
        : 'この地域で出会えそうな生き物について話して。';

    $weatherContext = $weather ? "現在の天気: {$weather}" : '';

    // 深さの段階: セッション内の発話回数で進化
    $depthInstruction = match(true) {
        $sessionCount <= 3 => 'リスナーは初心者。基本的で親しみやすい話を。',
        $sessionCount <= 10 => '少し詳しい生態の話を。「実は」で始まるような意外な事実がいい。',
        $sessionCount <= 20 => '通な話題を。研究で分かった最近の発見や、専門家が注目している話題など。',
        default => 'マニアックな深い話を。進化の歴史、生態系の仕組み、保全の課題など踏み込んだ内容で。',
    };

    // 過去発話の要約（直近15件）をプロンプトに注入（重複回避精度向上）
    $recentTexts = array_slice(array_column($pastTexts, 'text'), -15);
    $avoidList = !empty($recentTexts)
        ? "以下は最近話したテーマ・フレーズです。これらと同じ話題・言い回し・キーワードは絶対に使わないでください:\n" . implode("\n", array_map(fn($t) => "- {$t}", $recentTexts))
        : '';

    $prompt = <<<PROMPT
あなたは自然散策の相棒です。検出の合間に、今この場所にいることの意味を感じられる話をしてください。
教科書の解説ではなく、「キミの今の体験」と自然のしくみをつなげる語りを。

{$langInstruction}
{$styleInstruction}

地域: {$areaName}（緯度{$lat}、経度{$lng}付近）
移動手段: {$transportLabel}
季節: {$seasonName}（{$month}月）  時間帯: {$timeOfDay}
{$weatherContext}
経過時間: {$elapsedMin}分
{$speciesContext}
{$nearbySpeciesContext}
{$ambientLandscape}
{$ambientConservation}
{$depthInstruction}

今回のテーマ: {$topic}

{$avoidList}

条件:
- 3〜8文、150〜500文字。散歩を楽しませる解説を豊かに。沈黙より長い解説の方が良い。景観史テーマの場合はじっくり語ってOK
- リスナーは{$transportLabel}で移動中。{$transportLabel}の体験に合った話し方で（徒歩なら「足元」「立ち止まって」、車なら「窓の外」「この道沿い」、自転車なら「風を感じながら」など）
- 「キミが今見ている景色」と結びつけて話す（抽象論ではなく「この場所では…」「今の季節は…」）
- ネイチャーポジティブ・生物多様性・30by30などの概念は、直接名前を出すより体験を通じて感じさせる
- 難しい漢字はひらがなで（例: 囀り→さえずり、蝶→チョウ）
- 学名は使わないで
- 聞いて「へぇ」「そうなんだ」と思える内容に

表現ルール:
- 「珍しい」「レアな」「初めて」等の希少性を煽る表現禁止
- 植物は「ある」「生えている」「咲いている」、動物は「いる」「見つけた」と使い分ける
PROMPT;

    $guideText = _callGemini($prompt);
    if (empty($guideText)) {
        $fallbackAction = match($transportMode) {
            'car' => '自然を感じながらのドライブ、いいですね。',
            'bike' => '自然の中のサイクリング、気持ちいいですね。',
            default => '自然の中の散歩、いいですね。',
        };
        $guideText = $isZundamonStyle
            ? "この辺りは自然豊かな場所なのだ！"
            : $fallbackAction;
    }

    _saveHistory($userId, $guideText, $pastTexts);

    $result = ['guide_text' => $guideText, 'audio_url' => null, 'lang' => $guideLang];
    if (!$isJapanese) {
        $result['tts_locale'] = match($guideLang) {
            'en' => 'en-US', 'zh' => 'zh-CN', 'ko' => 'ko-KR', 'es' => 'es-ES',
            'fr' => 'fr-FR', 'pt' => 'pt-BR', 'de' => 'de-DE', default => $guideLang,
        };
    }
    $audioUrl = _generateAudio($guideText, $voiceMode, $guideLang, $useVoicevoxAudio, $isGeminiTTS);
    if ($audioUrl) $result['audio_url'] = $audioUrl;
    api_success($result);
}

// --- 検出モード ---
$name = api_param('name', '');
$sciName = api_param('scientific_name', '');
$confidence = api_param('confidence', 0.5, 'float');
$detectionCount = api_param('detection_count', 1, 'int');
$isFirstToday = api_param('is_first_today', '1') === '1';
$emotionLens = api_param('emotion_lens', '');

if (empty($name) && empty($sciName)) {
    api_error('name or scientific_name required');
}

$traits = '';
try {
    $engine = new OmoikaneSearchEngine();
    $info = null;
    if ($sciName) {
        $info = $engine->getTraitsByScientificName($sciName);
    }
    if (!$info && $name) {
        $resolved = $engine->resolveByJapaneseName($name);
        if ($resolved && !empty($resolved['scientific_name'])) {
            $info = $engine->getTraitsByScientificName($resolved['scientific_name']);
        }
    }
    if ($info) {
        $parts = [];
        if (!empty($info['habitat'])) $parts[] = '生息地: ' . $info['habitat'];
        if (!empty($info['season'])) $parts[] = '季節: ' . $info['season'];
        if (!empty($info['morphological_traits'])) $parts[] = '特徴: ' . $info['morphological_traits'];
        if (!empty($info['notes'])) $parts[] = '備考: ' . $info['notes'];
        $traits = implode('。', $parts);
    }
} catch (Throwable $e) {
    // non-critical
}

$displayName = $name ?: $sciName;

// --- 生態系知識データの注入 ---
$ecoContext = _getEcologyContext($sciName ?: $name, $displayName);

// 地域情報を取得
$lat = api_param('lat', 0, 'float');
$lng = api_param('lng', 0, 'float');
$areaName = '';
$prefecture = '';
if ($lat && $lng) {
    try {
        require_once ROOT_DIR . '/libs/GeoUtils.php';
        $geo = GeoUtils::reverseGeocode($lat, $lng);
        $prefecture = $geo['prefecture'] ?? '';
        $areaName = trim($prefecture . ' ' . ($geo['municipality'] ?? ''));
    } catch (Throwable $e) {}
}

// 地域生態系データの注入
$regionalContext = _getRegionalEcology($prefecture);
// 季節データの注入
$phenologyContext = _getSeasonalPhenology($month);
// 共起種データの注入
$coOccurrenceContext = _getCoOccurrence($sciName ?: $name, $displayName);

// 景観史コンテキストの注入
$landscapeContext = '';
$landscapeDeliveryHint = 'immediate';
if ($lat && $lng) {
    try {
        require_once ROOT_DIR . '/libs/LandscapeHistoryContext.php';
        $landscapeContext = LandscapeHistoryContext::getPromptContext(
            $lat, $lng, $displayName, $sciName, 'detection', $userId
        );
        $meta = LandscapeHistoryContext::getDeliveryMetadata($lat, $lng, $displayName, 'detection');
        if ($meta) $landscapeDeliveryHint = $meta['delivery_hint'];
    } catch (Throwable $e) {
        // non-critical
    }
}

// サイトの保全ストーリー（conservation_story）の注入
$conservationContext = _getConservationStoryContext($lat, $lng);

// 分類カテゴリ名かどうか判定（常緑広葉樹、落葉高木 etc → 具体種を教えるモード）
$isCategoryName = preg_match('/^(常緑|落葉|針葉|広葉|低木|高木|草本|つる性|シダ|イネ科|キク科)/', $name);
$nearbyContext = '';
if ($lat && $lng) {
    $nearbyContext = _getNearbyObservations($lat, $lng, 2.0);
}

$styleInstruction = $isZundamonStyle
    ? 'ずんだもんの口調で話してください。語尾は「〜のだ」「〜なのだ」を使い、元気で親しみやすい感じ。一人称は「ずんだもん」。'
    : '優しいネイチャーガイドの口調で話してください。「〜ですよ」「〜なんです」など親しみやすく。';

$recentTexts = array_slice(array_column($pastTexts, 'text'), -15);
$avoidList = !empty($recentTexts)
    ? "以下は最近話したテーマ・フレーズです。これらと同じ話題・言い回し・キーワードは絶対に使わないでください:\n" . implode("\n", array_map(fn($t) => "- {$t}", $recentTexts))
    : '';

$categoryInstruction = $isCategoryName
    ? "重要:「{$displayName}」は分類カテゴリ名です。この地域（{$areaName}）で実際に見られる具体的な種名を2〜3種挙げて「この辺りだと〇〇や△△が見られるかも」と話してください。"
    : '';

$areaInstruction = $areaName ? "地域: {$areaName}" : '';
$nearbyInstruction = $nearbyContext
    ? "この付近で過去に観察された生き物:\n{$nearbyContext}\n→ これらの種について触れると面白い。「この辺りでは以前〇〇も観察されてるよ」のように。"
    : '';

// 解説パターンをランダムに選択（飽きさせない工夫）
$talkAngles = [
    'この地域で見られる具体的な種を挙げて「この辺りだと〇〇がいるかも」と教えて。季節に合った種で',
    'この生き物に関する意外な豆知識を1つ（「実は…」で始めて）',
    '今の季節・時間帯ならではの観察のコツを教えて。「明日の朝ここに来たら〇〇が見れるかも」的な',
    '日本の文化との関わりを1つ（俳句・民話・言い伝え・地名の由来など）。地域に絡めて',
    'この生き物と他の生き物の面白い関係（共生・食物連鎖など）を地域の実例で',
    $transportMode === 'car'
        ? '「もし車を降りて近くで見たら」何に注目すべきか具体的に。五感を使った観察ポイント'
        : '「もし立ち止まってじっくり観察したら」何に注目すべきか具体的に。五感を使った観察ポイント',
    'この地域の地形・気候の特徴と、そこに暮らす生き物の関係。なぜここにいるのか',
    '過去の観察データがあればそれに触れて「以前この辺りで〇〇も観察されてる」と教えて',
    'この地域の自然の歴史（昔はどうだったか、開発で変わったこと、守られてるものなど）',
    '身近なのに知られてない事実。「毎日見てるけど実は…」的な驚き',
    '「〇〇を見つけたらラッキー」「△△がいたら環境が良い証拠」のような観察の楽しみ方',
    'この{$seasonName}に見逃しがちだけど注目すべき自然現象やイベント',
    'この地域の植生や環境タイプ（里山・河川敷・都市緑地など）の特徴を短く伝えて。「こういう環境だから〇〇がいる」という地域と生き物のつながりを',
];
$chosenAngle = $talkAngles[array_rand($talkAngles)];

$emotionInstruction = match($emotionLens) {
    'wonder' => '驚きや愛着を生む話をして。「え、そうなんだ！」と思わせる内容で。この生き物が生態系の中でどんな役割を持っているかを、さりげなく1つ添えて（例:「シジュウカラがいるってことは、この場所の虫の量が十分ってこと」）。',
    'quest' => '次を探したくなる話をして。この生き物がいるなら一緒にいそうな種を具体的に挙げて（食物連鎖・共生・同じ環境を好む種）。「〇〇がいたなら、近くに△△がいるかも。探してみて」のように。生態系のつながりを冒険の動機にして。',
    'mastery' => '少し賢くなった実感を渡して。この生き物が環境のバロメーターとしてどう読めるか教えて。「〇〇がいるってことは、水質が良い証拠」「〇〇の数が多いと森が若い」のように。観察が生態系の健康診断になる視点を。',
    'memory' => 'この出会いを記憶に残る一瞬にして。「この季節のこの場所で出会えたのは特別」のように。さりげなく「こういう出会いが続く場所を守ることが、ネイチャーポジティブの第一歩」と添えて。説教ではなく共感として。',
    'contribution' => 'キミが今見つけたこの生き物と、生物多様性の大きな絵をつなげて。「この1件の記録が、この地域の自然がどう変化しているかを追う手がかりになる」「30by30の目標 ——日本の陸と海の30%を保全する——にとって、こういう市民のデータが実は一番大切」のように。データの意味を、押し付けずに伝えて。',
    default => '',
};

$prompt = <<<PROMPT
あなたは散歩中に聴く自然番組のパーソナリティです。検出された生き物をきっかけに、この場所や季節にまつわる面白い話を自然に展開してください。
「〇〇を見つけました！」という報告型ではなく、「あ、〇〇だ。この鳥がいるってことは…」のように、発見を話のフックにして、聞いていて楽しい語りを。

{$langInstruction}
{$styleInstruction}

検出された生き物: {$displayName}
{$areaInstruction}
移動手段: {$transportLabel}
季節: {$seasonName}（{$month}月）  時間帯: {$timeOfDay}
{$categoryInstruction}

図鑑情報: {$traits}
{$ecoContext}
{$coOccurrenceContext}
{$regionalContext}
{$phenologyContext}
{$landscapeContext}
{$conservationContext}
{$nearbyInstruction}

{$avoidList}

今回の話し方: {$chosenAngle}
{$emotionInstruction}

条件:
- 4〜8文、200〜500文字。散歩中に聴く自然番組のパーソナリティのように楽しくじっくり語って。短く切り上げず、リスナーが「もっと聞きたい」と思える密度で
- 景観史の情報がある場合は特にたっぷり語ってOK。話の流れで自然に盛り込んで
- 冒頭で「〇〇を検出しました」「〇〇を見つけました」のような報告は絶対にしない。種名は話の流れの中で自然に出して
- リスナーは{$transportLabel}で移動中。{$transportLabel}の体験に合った話し方で
- 上記の「生態系データ」「共起種」「地域特徴」「季節情報」を根拠にして話す。根拠のない話は作らない
- 「今回の話し方」に従って、{$areaName}に密着した具体的で面白い話をして
- 「N回目の検出」のような事務的情報は入れない
- 音声読み上げ用なので難しい漢字はひらがなで（例: 囀り→さえずり）
- 学名は読み上げないで
- 聞いて「へぇ」と思える具体的な内容に

語りのルール（厳守）:
- 話の前半と後半で異なる角度から語ること。例: 前半で生態の話→後半で地域の文化や歴史につなげる。一本調子にしない
- 文と文のつながりを意識して。「実はね」「で、面白いのが」「それでね」「ちなみに」など、会話の接続詞で自然につないで
- 同じ単語・フレーズの繰り返しを避けること。特に「〜なんです」「〜ですよ」が連続しないよう、語尾を変化させて（「〜でね」「〜なの」「〜だよ」「〜してるんだって」等）
- ガイドらしく、リスナーに語りかけるトーンで。「ほら、あそこに見える？」「知ってた？」のような問いかけを織り交ぜて

表現ルール（厳守）:
- 「珍しい」「初めて」「レアな」「貴重な発見」等の希少性を煽る表現は禁止。地域の人にとって普通の種を珍しいと言わない
- 「記録できました」「見つけました」等、発見と記録の事実を伝える表現を使う
- 植物に「いる」「いました」は使わない。植物は「ある」「生えている」「咲いている」「見られる」を使う
- 動物には「いる」「見つけた」、植物には「ある」「咲いている」を正しく使い分ける
PROMPT;

$guideText = _callGemini($prompt);

if (empty($guideText)) {
    $guideText = $isZundamonStyle
        ? "{$displayName}を見つけたのだ！"
        : "{$displayName}を見つけました。";
}

_saveHistory($userId, $guideText, $pastTexts);

$result = ['guide_text' => $guideText, 'audio_url' => null, 'lang' => $guideLang];
if (!$isJapanese) {
    $ttsLocale = match($guideLang) {
        'en' => 'en-US',
        'zh' => 'zh-CN',
        'ko' => 'ko-KR',
        'es' => 'es-ES',
        'fr' => 'fr-FR',
        'pt' => 'pt-BR',
        'de' => 'de-DE',
        default => $guideLang,
    };
    $result['tts_locale'] = $ttsLocale;
}
if (!empty($landscapeContext)) {
    $result['delivery_hint'] = $landscapeDeliveryHint;
    $result['has_landscape_history'] = true;
}
if (!empty($conservationContext)) {
    $result['has_conservation_story'] = true;
}

$audioUrl = _generateAudio($guideText, $voiceMode, $guideLang, $useVoicevoxAudio, $isGeminiTTS);
if ($audioUrl) {
    $result['audio_url'] = $audioUrl;
}

api_success($result);

// --- 生態系知識データローダー群 ---

function _loadEcologyData(string $filename): array
{
    static $cache = [];
    if (isset($cache[$filename])) return $cache[$filename];
    $path = DATA_DIR . "/ecology/{$filename}";
    if (!file_exists($path)) return $cache[$filename] = [];
    $data = json_decode(file_get_contents($path), true);
    return $cache[$filename] = ($data ?: []);
}

function _getEcologyContext(string $key, string $displayName): string
{
    $roles = _loadEcologyData('ecosystem_roles.json');
    $entry = $roles[$key] ?? null;
    if (!$entry) {
        foreach ($roles as $k => $v) {
            if (($v['ja'] ?? '') === $displayName) { $entry = $v; break; }
        }
    }
    if (!$entry) return '';
    $parts = [];

    // facts（配列）からランダムに1つ選ぶ。旧形式(ecosystem_role文字列)にも対応
    $facts = $entry['facts'] ?? null;
    if (is_array($facts) && !empty($facts)) {
        $parts[] = "生態系の事実: " . $facts[array_rand($facts)];
    } elseif (!empty($entry['ecosystem_role'])) {
        $parts[] = "生態系での役割: {$entry['ecosystem_role']}";
    }

    // indicates（配列）からランダムに1つ選ぶ
    $indicates = $entry['indicates'] ?? null;
    if (is_array($indicates) && !empty($indicates)) {
        $parts[] = "この種がいる意味: " . $indicates[array_rand($indicates)];
    } elseif (is_string($indicates) && !empty($indicates)) {
        $parts[] = "この種がいる意味: {$indicates}";
    }

    if (!empty($entry['food_web'])) $parts[] = "食物連鎖: {$entry['food_web']}";
    return "【生態系データ（事実。これを根拠にして話して）】\n" . implode("\n", $parts);
}

function _getCoOccurrence(string $key, string $displayName): string
{
    $coData = _loadEcologyData('co_occurrence.json');
    if (empty($coData)) return '';
    $matches = [];
    foreach ($coData as $group) {
        $species = $group['species'] ?? [];
        foreach ($species as $sp) {
            if ($sp === $displayName || $sp === $key) {
                $others = array_filter($species, fn($s) => $s !== $displayName && $s !== $key);
                $matches[] = implode('・', array_slice($others, 0, 3)) . "（{$group['reason']}）";
                break;
            }
        }
    }
    if (empty($matches)) return '';
    return "【共起種データ（事実）】一緒にいやすい種: " . implode(' / ', array_slice($matches, 0, 2));
}

function _getRegionalEcology(string $prefecture): string
{
    if (empty($prefecture)) return '';
    $regional = _loadEcologyData('regional_ecology.json');
    $entry = $regional[$prefecture] ?? null;
    if (!$entry) return '';
    $parts = [];
    if (!empty($entry['features'])) $parts[] = $entry['features'];
    if (!empty($entry['biodiversity_note'])) $parts[] = $entry['biodiversity_note'];
    if (empty($parts)) return '';
    return "【地域の生態系（事実）】{$prefecture}: " . implode('。', $parts);
}

function _getSeasonalPhenology(int $month): string
{
    $pheno = _loadEcologyData('seasonal_phenology.json');
    $entry = $pheno[(string)$month] ?? null;
    if (!$entry) return '';
    $events = [];
    foreach (['bird_events', 'plant_events', 'insect_events'] as $key) {
        if (!empty($entry[$key]) && is_array($entry[$key])) {
            $events = array_merge($events, array_slice($entry[$key], 0, 2));
        }
    }
    if (empty($events)) return '';
    $tip = $entry['observation_tips'] ?? '';
    return "【今月の自然（事実）】" . implode('。', array_slice($events, 0, 3)) . ($tip ? "。観察のコツ: {$tip}" : '');
}

function _inferEmotionTags(int $speciesCount, int $durationMin, int $silentMin): array
{
    $tags = [];
    if ($speciesCount >= 5) $tags[] = 'wonder';
    if ($speciesCount === 0) $tags[] = 'stillness';
    if ($silentMin > 10) $tags[] = 'contemplative';
    if ($durationMin >= 30) $tags[] = 'immersive';
    if ($speciesCount >= 1 && $speciesCount <= 3) $tags[] = 'focused';
    if ($durationMin < 15) $tags[] = 'brief';
    if (empty($tags)) $tags[] = 'gentle';
    return $tags;
}

function _loadPastHighlights(string $userId, int $count = 5): array
{
    $file = DATA_DIR . "today_highlights/{$userId}.json";
    if (!file_exists($file)) return [];
    $all = json_decode(file_get_contents($file), true) ?: [];
    return array_slice(array_reverse($all), 0, $count);
}

function _saveTodayHighlight(string $userId, array $highlight): void
{
    $dir = DATA_DIR . 'today_highlights';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $file = "{$dir}/{$userId}.json";
    $existing = [];
    if (file_exists($file)) {
        $existing = json_decode(file_get_contents($file), true) ?: [];
    }
    $existing[] = $highlight;
    if (count($existing) > 100) $existing = array_slice($existing, -100);
    file_put_contents($file, json_encode($existing, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

function _getNearbyObservations(float $lat, float $lng, float $radiusKm): string
{
    try {
        $allObs = DataStore::fetchAll('observations');
        $nearby = [];
        $R = 6371;
        foreach ($allObs as $obs) {
            $oLat = (float)($obs['location']['lat'] ?? $obs['lat'] ?? 0);
            $oLng = (float)($obs['location']['lng'] ?? $obs['lng'] ?? 0);
            if ($oLat == 0 && $oLng == 0) continue;
            $dLat = deg2rad($oLat - $lat);
            $dLng = deg2rad($oLng - $lng);
            $a = sin($dLat/2)**2 + cos(deg2rad($lat)) * cos(deg2rad($oLat)) * sin($dLng/2)**2;
            $dist = $R * 2 * atan2(sqrt($a), sqrt(1 - $a));
            if ($dist <= $radiusKm) {
                $name = $obs['taxon']['name'] ?? $obs['species_name'] ?? '';
                $sci = $obs['taxon']['scientific_name'] ?? '';
                $idStatus = $obs['identification_status'] ?? '';
                if ($name) {
                    $key = $sci ?: $name;
                    if (!isset($nearby[$key])) {
                        $nearby[$key] = ['name' => $name, 'sci' => $sci, 'count' => 0, 'identified' => false];
                    }
                    $nearby[$key]['count']++;
                    if ($idStatus === 'confirmed' || $idStatus === 'agreed') {
                        $nearby[$key]['identified'] = true;
                    }
                }
            }
        }
        if (empty($nearby)) return '';
        uasort($nearby, fn($a, $b) => $b['count'] - $a['count']);
        $lines = [];
        foreach (array_slice($nearby, 0, 8) as $sp) {
            $label = $sp['name'];
            if ($sp['identified']) $label .= '（同定済み）';
            $label .= " — {$sp['count']}回観察";
            $lines[] = "- {$label}";
        }
        return implode("\n", $lines);
    } catch (Throwable $e) {
        return '';
    }
}

function _generateAudio(string $text, string $voiceMode, string $lang, bool $useVoicevox, bool $useGemini): ?string
{
    if (empty($text)) return null;
    if ($useGemini) {
        $url = _generateGeminiAudio($text, $voiceMode, $lang);
        if ($url) return $url;
    }
    if ($useVoicevox) {
        $url = _generateVoicevoxAudio($text, $voiceMode);
        if ($url) return $url;
        if (defined('GEMINI_API_KEY') && GEMINI_API_KEY) {
            $geminiVoice = match($voiceMode) {
                'zundamon', 'mochiko' => 'gemini-bright',
                'ryusei' => 'gemini-calm',
                default => 'gemini-bright',
            };
            return _generateGeminiAudio($text, $geminiVoice, $lang);
        }
    }
    return null;
}

function _callGemini(string $prompt): string
{
    $apiKey = defined('GEMINI_API_KEY') ? GEMINI_API_KEY : '';
    if (!$apiKey) return '';

    $payload = [
        'contents' => [['parts' => [['text' => $prompt]]]],
        'generationConfig' => [
            'temperature' => 1.0,
            'maxOutputTokens' => 1024,
            'topP' => 0.95,
        ],
    ];

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key={$apiKey}",
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_CONNECTTIMEOUT => 3,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $response) {
        $data = json_decode($response, true);
        $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
        $text = trim($text);
        $text = trim($text, '"\'');
        $text = _trimIncomplete($text);
        return $text;
    }
    return '';
}

function _trimIncomplete(string $text): string
{
    $text = trim($text);
    if ($text === '') return '';
    $lastChar = mb_substr($text, -1);
    if (preg_match('/[。！？!?」）】]/', $lastChar)) return $text;
    $lastPeriod = false;
    foreach (['。', '！', '？', '!', '?'] as $p) {
        $pos = mb_strrpos($text, $p);
        if ($pos !== false && ($lastPeriod === false || $pos > $lastPeriod)) {
            $lastPeriod = $pos;
        }
    }
    if ($lastPeriod !== false && $lastPeriod > 0) {
        return mb_substr($text, 0, $lastPeriod + 1);
    }
    return $text;
}

function _pickVoicevoxSpeakerId(array $preferredNames): int
{
    static $speakers = null;

    if ($speakers === null) {
        $voicevoxHost = 'http://127.0.0.1:50021';
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $voicevoxHost . '/speakers',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 2,
            CURLOPT_CONNECTTIMEOUT => 1,
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $speakers = ($httpCode === 200 && $response)
            ? (json_decode($response, true) ?: [])
            : [];
    }

    foreach ($preferredNames as $preferredName) {
        foreach ($speakers as $speaker) {
            if (($speaker['name'] ?? '') !== $preferredName) continue;
            $styles = $speaker['styles'] ?? [];
            foreach ($styles as $style) {
                if (($style['name'] ?? '') === 'ノーマル' && isset($style['id'])) {
                    return (int)$style['id'];
                }
            }
            if (!empty($styles[0]['id'])) {
                return (int)$styles[0]['id'];
            }
        }
    }

    return 3;
}

function _resolveVoicevoxSpeakerId(string $voiceMode): int
{
    return match ($voiceMode) {
        'zundamon' => _pickVoicevoxSpeakerId(['ずんだもん']),
        'mochiko'  => _pickVoicevoxSpeakerId(['もち子さん']),
        'ryusei'   => _pickVoicevoxSpeakerId(['青山龍星']),
        default    => _pickVoicevoxSpeakerId([
            '九州そら', '玄野武宏', '白上虎太郎', '青山龍星',
            '四国めたん', '春日部つむぎ', 'ずんだもん',
        ]),
    };
}

function _generateVoicevoxAudio(string $text, string $voiceMode = 'zundamon'): ?string
{
    $maxChars = 250;
    if (mb_strlen($text) > $maxChars) {
        $truncated = mb_substr($text, 0, $maxChars);
        $lastPeriod = mb_strrpos($truncated, '。');
        if ($lastPeriod !== false && $lastPeriod > $maxChars * 0.5) {
            $text = mb_substr($truncated, 0, $lastPeriod + 1);
        } else {
            $text = $truncated;
        }
    }

    $voicevoxHost = 'http://127.0.0.1:50021';
    $speakerId = _resolveVoicevoxSpeakerId($voiceMode);

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $voicevoxHost . '/audio_query?text=' . urlencode($text) . '&speaker=' . $speakerId,
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_CONNECTTIMEOUT => 1,
    ]);
    $queryJson = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$queryJson) return null;

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $voicevoxHost . '/synthesis?speaker=' . $speakerId,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => $queryJson,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_CONNECTTIMEOUT => 1,
    ]);
    $wavData = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$wavData) return null;

    $yearMonth = date('Y-m');
    $dir = PUBLIC_DIR . "/uploads/audio/voice/{$yearMonth}";
    if (!is_dir($dir)) mkdir($dir, 0755, true);

    $filename = 'vg_' . bin2hex(random_bytes(6)) . '.wav';
    $path = "{$dir}/{$filename}";
    file_put_contents($path, $wavData);

    return "/uploads/audio/voice/{$yearMonth}/{$filename}";
}

function _resolveGeminiVoice(string $voiceMode, string $lang = 'ja'): string
{
    return match ($voiceMode) {
        'gemini-bright'  => 'Zephyr',
        'gemini-calm'    => 'Orus',
        default          => ($lang === 'ja') ? 'Zephyr' : 'Kore',
    };
}

function _generateGeminiAudio(string $text, string $voiceMode = 'gemini-bright', string $lang = 'ja'): ?string
{
    $apiKey = defined('GEMINI_API_KEY') ? GEMINI_API_KEY : '';
    if (!$apiKey || !$text) return null;

    $voiceName = _resolveGeminiVoice($voiceMode, $lang);

    $payload = [
        'contents' => [['parts' => [['text' => $text]]]],
        'generationConfig' => [
            'responseModalities' => ['AUDIO'],
            'speechConfig' => [
                'voiceConfig' => [
                    'prebuiltVoiceConfig' => [
                        'voiceName' => $voiceName,
                    ],
                ],
            ],
        ],
    ];

    $model = 'gemini-2.5-flash-preview-tts';
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}",
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_CONNECTTIMEOUT => 5,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$response) return null;

    $data = json_decode($response, true);
    $audioPart = $data['candidates'][0]['content']['parts'][0]['inlineData'] ?? null;
    if (!$audioPart || empty($audioPart['data'])) return null;

    $pcmData = base64_decode($audioPart['data']);
    if (!$pcmData) return null;

    $wavData = _pcmToWav($pcmData, 24000, 16, 1);

    $yearMonth = date('Y-m');
    $dir = PUBLIC_DIR . "/uploads/audio/voice/{$yearMonth}";
    if (!is_dir($dir)) mkdir($dir, 0755, true);

    $filename = 'vg_' . bin2hex(random_bytes(6)) . '.wav';
    file_put_contents("{$dir}/{$filename}", $wavData);

    return "/uploads/audio/voice/{$yearMonth}/{$filename}";
}

function _pcmToWav(string $pcmData, int $sampleRate = 24000, int $bitsPerSample = 16, int $channels = 1): string
{
    $dataSize = strlen($pcmData);
    $byteRate = $sampleRate * $channels * ($bitsPerSample / 8);
    $blockAlign = $channels * ($bitsPerSample / 8);

    $header = pack('A4V', 'RIFF', 36 + $dataSize);
    $header .= pack('A4', 'WAVE');
    $header .= pack('A4V', 'fmt ', 16);
    $header .= pack('vvVVvv', 1, $channels, $sampleRate, $byteRate, $blockAlign, $bitsPerSample);
    $header .= pack('A4V', 'data', $dataSize);

    return $header . $pcmData;
}
