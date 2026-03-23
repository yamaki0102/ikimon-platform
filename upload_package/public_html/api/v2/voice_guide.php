<?php

/**
 * API v2: Voice Guide — AI解説 + VOICEVOX音声生成
 *
 * GET /api/v2/voice_guide.php
 *   ?name=シジュウカラ&scientific_name=Parus+minor&confidence=0.85&voice_mode=standard|zundamon
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
$voiceMode = api_param('voice_mode', 'standard');
$isZundamon = ($voiceMode === 'zundamon');

$month = (int)date('n');
$hour = (int)date('G');
$seasonName = match(true) {
    $month >= 3 && $month <= 5 => '春',
    $month >= 6 && $month <= 8 => '夏',
    $month >= 9 && $month <= 11 => '秋',
    default => '冬',
};
$timeOfDay = match(true) {
    $hour >= 5 && $hour < 10 => '朝',
    $hour >= 10 && $hour < 16 => '日中',
    $hour >= 16 && $hour < 19 => '夕方',
    default => '夜',
};

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
    $pastTexts[] = ['text' => mb_substr($text, 0, 80), 'at' => date('c')];
    if (count($pastTexts) > 30) $pastTexts = array_slice($pastTexts, -30);
    $dir = DATA_DIR . 'voice_guide_history';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    file_put_contents(DATA_DIR . "voice_guide_history/{$userId}.json",
        json_encode($pastTexts, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
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

    $styleInstruction = $isZundamon
        ? 'ずんだもんの口調で話してください。語尾は「〜のだ」「〜なのだ」。一人称は「ずんだもん」。'
        : '親しい友人のような口調で。敬語は軽めに。';

    $weatherNote = $weather ? "天気: {$weather}" : '';
    $tempNote = $temperature ? "気温: {$temperature}" : '';

    $prompt = <<<PROMPT
あなたは自然散策の相棒です。これからフィールドに出る人に、その場所の空気感を伝える短い挨拶を生成してください。

{$styleInstruction}

場所: {$areaName}（緯度{$lat}、経度{$lng}）
季節: {$seasonName}（{$month}月）  時間帯: {$timeOfDay}
{$weatherNote}
{$tempNote}
この付近の過去の観察記録: {$pastSpeciesCount}種

過去の観察データ:
{$nearbyContext}

要件:
- その場所の空気感・季節感を2文で描写（例: 風、光、音、匂い）
- 過去の観察データがあれば「この辺りでは以前〇〇が観察されてるよ」と1文
- 最後に「何に出会えるかな」的な期待感を1文
- 合計3〜4文、100文字以内
- 百科事典的な説明はしない。五感に訴える情景描写を
- 音声読み上げ用なので難しい漢字はひらがなで
PROMPT;

    $guideText = _callGemini($prompt);
    if (empty($guideText)) {
        $guideText = $isZundamon
            ? "{$areaName}に来たのだ！{$seasonName}の自然を楽しむのだ！"
            : "{$areaName}。{$seasonName}の空気が気持ちいいね。さあ、何に出会えるかな。";
    }

    _saveHistory($userId, $guideText, $pastTexts);

    $result = ['guide_text' => $guideText, 'audio_url' => null, 'mode' => 'opening'];
    if ($isZundamon) {
        $audioUrl = _generateVoicevoxAudio($guideText);
        if ($audioUrl) $result['audio_url'] = $audioUrl;
    }
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

    $styleInstruction = $isZundamon
        ? 'ずんだもんの口調で話してください。語尾は「〜のだ」「〜なのだ」。一人称は「ずんだもん」。'
        : '親しい友人のような温かい口調で。';

    $silentContext = $silentMinutes > 5
        ? "今日は静かな時間が{$silentMinutes}分ほどあった。それも自然体験の一部として肯定的に触れて。"
        : '';

    $prompt = <<<PROMPT
あなたは自然散策の相棒です。セッションが終わった仲間に、今日の体験を記憶に残す短いメッセージを贈ってください。

{$styleInstruction}

場所: {$areaName}
季節: {$seasonName}（{$month}月）  時間帯: {$timeOfDay}
天気: {$weather}
セッション時間: {$durationMin}分
検出された種: {$speciesListRaw}（{$speciesCount}種）
最も印象的な出会い: {$highlightSpecies}
{$silentContext}

要件:
- 数字の羅列（「N分でN種」）で終わらない。その日の体験の手触りを伝える
- 最も印象的な出会いに触れて、その出会いに小さな意味を添える（豆知識1つ）
- 「今日は〇〇な午後だったね」のように、天気や時間帯の空気感を含める
- 最後に「次は〇〇してみて」と再訪の伏線を1つ
- 合計3〜4文、120文字以内
- 集計レポートではなく、友達との会話の終わりのように
- 音声読み上げ用なので難しい漢字はひらがなで
PROMPT;

    $guideText = _callGemini($prompt);
    if (empty($guideText)) {
        $guideText = $isZundamon
            ? "{$durationMin}分のお散歩、お疲れさまなのだ！{$highlightSpecies}との出会いが素敵だったのだ！"
            : "お疲れさま。{$highlightSpecies}との出会い、よかったね。また来よう。";
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

    $result = ['guide_text' => $guideText, 'audio_url' => null, 'mode' => 'closing', 'today_highlight' => $highlight];
    if ($isZundamon) {
        $audioUrl = _generateVoicevoxAudio($guideText);
        if ($audioUrl) $result['audio_url'] = $audioUrl;
    }
    api_success($result);
}

// --- 沈黙モード（何も検出されない時間の価値化） ---
if ($requestMode === 'silence') {
    $lat = api_param('lat', 0, 'float');
    $lng = api_param('lng', 0, 'float');
    $weather = api_param('weather', '');
    $silentMin = api_param('silent_min', 5, 'int');
    $detectedSpecies = api_param('detected_species', '');

    $areaName = '';
    try {
        require_once ROOT_DIR . '/libs/GeoUtils.php';
        $geo = GeoUtils::reverseGeocode($lat, $lng);
        $areaName = trim(($geo['prefecture'] ?? '') . ' ' . ($geo['municipality'] ?? ''));
    } catch (Throwable $e) {}

    $styleInstruction = $isZundamon
        ? 'ずんだもんの口調で話してください。語尾は「〜のだ」「〜なのだ」。一人称は「ずんだもん」。'
        : '穏やかで詩的な口調で。';

    $silenceAngles = [
        '今は耳を澄ませる時間。風の音、葉擦れの音、遠くの鳥の声に意識を向けてみて',
        '静かな時間も自然観察の一部。目を凝らしてみて。足元に小さな発見があるかも',
        '何もいないように見えて、実はたくさんの生き物がこちらを見ている。気配を感じてみて',
        '自然のリズムはゆっくり。焦らなくていい。この静けさを楽しんで',
        '葉っぱの裏を覗いてみて。小さな虫たちの世界が広がっているかも',
        '深呼吸してみて。この場所の匂いを覚えておこう。季節が変われば匂いも変わる',
        '鳥たちは警戒すると黙る。少し立ち止まって待ってみると、また歌い始めるかも',
        '地面をよく見て。小さな足跡や食べ跡があれば、夜の住人がいる証拠',
    ];
    $angle = $silenceAngles[array_rand($silenceAngles)];

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
- 1〜2文、60文字以内
- 説教臭くしない。ふっと心が軽くなるような一言
- 五感（聴覚・嗅覚・触覚）を使った提案を含めて
- 音声読み上げ用なので難しい漢字はひらがなで
PROMPT;

    $guideText = _callGemini($prompt);
    if (empty($guideText)) {
        $guideText = $isZundamon
            ? '静かな時間も大切なのだ。耳を澄ませてみるのだ。'
            : '静かだね。耳を澄ませてみて。遠くで何か鳴いてるかも。';
    }

    _saveHistory($userId, $guideText, $pastTexts);

    $result = ['guide_text' => $guideText, 'audio_url' => null, 'mode' => 'silence'];
    if ($isZundamon) {
        $audioUrl = _generateVoicevoxAudio($guideText);
        if ($audioUrl) $result['audio_url'] = $audioUrl;
    }
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

    $styleInstruction = $isZundamon
        ? 'ずんだもんの口調で話してください。語尾は「〜のだ」「〜なのだ」。一人称は「ずんだもん」。'
        : '優しいネイチャーガイドの口調で話してください。';

    $topicPool = [
        'この地域の自然環境や生態系の特徴',
        'ネイチャーポジティブ（自然再興）の取り組み',
        '30by30目標と日本の生物多様性保全',
        'この季節に見られる生き物の行動パターン',
        '日本の里山が育む生物多様性',
        '身近な鳥や虫の意外な生態',
        '季節の移り変わりと生き物の関係',
        '都市と自然の共生について',
        '水辺の生態系の大切さ',
        '市民科学と生物多様性モニタリング',
        '日本の国立公園と自然保護区',
        '鳥のさえずりの意味と種類',
        '虫の鳴き声と季節の関係',
        '植物と昆虫の共進化',
        '渡り鳥のルートと日本',
        '身近な樹木が支える生態系',
        '土壌の微生物と森の健康',
        '川や湿地の浄化機能',
        '日本固有種の話',
        '外来種問題と生態系への影響',
        '動物の擬態やカモフラージュ',
        '花粉を運ぶ昆虫たちの役割',
        '夜行性の生き物たちの世界',
        '都市のヒートアイランドと生き物',
        '日本の伝統文化と自然の関わり（俳句・和歌・七十二候）',
        '生き物の名前の由来や語源',
        '江戸時代の博物学と本草学',
        '世界と比較した日本の生物多様性',
        'この時間帯に活動する生き物の理由',
        '天候と生き物の行動の関係',
    ];
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

    // 過去発話の要約（直近10件）をプロンプトに注入
    $recentTexts = array_slice(array_column($pastTexts, 'text'), -10);
    $avoidList = !empty($recentTexts)
        ? "以下は最近話した内容です。これらと重複しない、全く別の話題にしてください:\n" . implode("\n", array_map(fn($t) => "- {$t}", $recentTexts))
        : '';

    $prompt = <<<PROMPT
あなたは車や自転車で移動中の人のネイチャーガイドです。
検出の合間に、聞いていて楽しい自然の話をしてください。

{$styleInstruction}

地域: {$areaName}（緯度{$lat}、経度{$lng}付近）
季節: {$seasonName}（{$month}月）  時間帯: {$timeOfDay}
{$weatherContext}
経過時間: {$elapsedMin}分
{$speciesContext}
{$nearbySpeciesContext}
{$depthInstruction}

今回のテーマ: {$topic}

{$avoidList}

条件:
- 2〜3文、80文字以内
- 難しい漢字はひらがなで（例: 囀り→さえずり、蝶→チョウ）
- 学名は使わないで
- 「へぇ」と思える内容、聞いて楽しい話に
- 地域や季節に関連した具体的な話がベスト
PROMPT;

    $guideText = _callGemini($prompt);
    if (empty($guideText)) {
        $guideText = $isZundamon
            ? "この辺りは自然豊かな場所なのだ！"
            : "自然を感じながらのドライブ、いいですね。";
    }

    _saveHistory($userId, $guideText, $pastTexts);

    $result = ['guide_text' => $guideText, 'audio_url' => null];
    if ($isZundamon) {
        $audioUrl = _generateVoicevoxAudio($guideText);
        if ($audioUrl) $result['audio_url'] = $audioUrl;
    }
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

// 地域情報を取得
$lat = api_param('lat', 0, 'float');
$lng = api_param('lng', 0, 'float');
$areaName = '';
if ($lat && $lng) {
    try {
        require_once ROOT_DIR . '/libs/GeoUtils.php';
        $geo = GeoUtils::reverseGeocode($lat, $lng);
        $areaName = trim(($geo['prefecture'] ?? '') . ' ' . ($geo['municipality'] ?? ''));
    } catch (Throwable $e) {}
}

// 分類カテゴリ名かどうか判定（常緑広葉樹、落葉高木 etc → 具体種を教えるモード）
$isCategoryName = preg_match('/^(常緑|落葉|針葉|広葉|低木|高木|草本|つる性|シダ|イネ科|キク科)/', $name);
$nearbyContext = '';
if ($lat && $lng) {
    $nearbyContext = _getNearbyObservations($lat, $lng, 2.0);
}

$styleInstruction = $isZundamon
    ? 'ずんだもんの口調で話してください。語尾は「〜のだ」「〜なのだ」を使い、元気で親しみやすい感じ。一人称は「ずんだもん」。'
    : '優しいネイチャーガイドの口調で話してください。「〜ですよ」「〜なんです」など親しみやすく。';

$recentTexts = array_slice(array_column($pastTexts, 'text'), -10);
$avoidList = !empty($recentTexts)
    ? "以下は最近話した内容です。これらと全く別の話題・切り口にしてください:\n" . implode("\n", array_map(fn($t) => "- {$t}", $recentTexts))
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
    '「もし車を降りて近くで見たら」何に注目すべきか具体的に。五感を使った観察ポイント',
    'この地域の地形・気候の特徴と、そこに暮らす生き物の関係。なぜここにいるのか',
    '過去の観察データがあればそれに触れて「以前この辺りで〇〇も観察されてる」と教えて',
    'この地域の自然の歴史（昔はどうだったか、開発で変わったこと、守られてるものなど）',
    '身近なのに知られてない事実。「毎日見てるけど実は…」的な驚き',
    '「〇〇を見つけたらラッキー」「△△がいたら環境が良い証拠」のような観察の楽しみ方',
    'この{$seasonName}に見逃しがちだけど注目すべき自然現象やイベント',
];
$chosenAngle = $talkAngles[array_rand($talkAngles)];

$emotionInstruction = match($emotionLens) {
    'wonder' => '驚きや愛着を生む話をして。「え、そうなんだ！」と思わせる内容で。',
    'quest' => '次を探したくなる話をして。「あっちに行ったら〇〇がいるかも」と冒険心をくすぐって。',
    'mastery' => '少し賢くなった実感を渡して。観察眼が磨かれるような、見分け方や生態の深い話を。',
    'memory' => 'この出会いを記憶に残る一瞬にして。「この季節のこの場所で出会えたのは特別」のように。',
    'contribution' => 'この記録の意味を伝えて。「キミの記録がこの地域の〇〇に役立つ」のように。',
    default => '',
};

$prompt = <<<PROMPT
あなたは自然散策の相棒です。発見を祝福し、世界の見え方をちょっとだけ変える一言を。

{$styleInstruction}

検出された生き物: {$displayName}
{$areaInstruction}
季節: {$seasonName}（{$month}月）  時間帯: {$timeOfDay}
{$categoryInstruction}

図鑑情報: {$traits}
{$nearbyInstruction}

{$avoidList}

今回の話し方: {$chosenAngle}
{$emotionInstruction}

条件:
- 2〜3文、80文字以内
- 「今回の話し方」に従って、{$areaName}に密着した具体的で面白い話をして
- 「N回目の検出」のような事務的情報は入れない
- 可能なら過去の観察データや地域の特徴に触れて
- 音声読み上げ用なので難しい漢字はひらがなで（例: 囀り→さえずり）
- 学名は読み上げないで
- 聞いて「へぇ」と思える具体的な内容に
PROMPT;

$guideText = _callGemini($prompt);

if (empty($guideText)) {
    $guideText = $isZundamon
        ? "{$displayName}を見つけたのだ！"
        : "{$displayName}がいますよ。";
}

_saveHistory($userId, $guideText, $pastTexts);

$result = ['guide_text' => $guideText, 'audio_url' => null];

if ($isZundamon && !empty($guideText)) {
    $audioUrl = _generateVoicevoxAudio($guideText);
    if ($audioUrl) {
        $result['audio_url'] = $audioUrl;
    }
}

api_success($result);

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

function _callGemini(string $prompt): string
{
    $apiKey = defined('GEMINI_API_KEY') ? GEMINI_API_KEY : '';
    if (!$apiKey) return '';

    $payload = [
        'contents' => [['parts' => [['text' => $prompt]]]],
        'generationConfig' => [
            'temperature' => 1.0,
            'maxOutputTokens' => 150,
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
        CURLOPT_TIMEOUT => 8,
        CURLOPT_CONNECTTIMEOUT => 3,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $response) {
        $data = json_decode($response, true);
        $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
        $text = trim($text);
        return trim($text, '"\'');
    }
    return '';
}

function _generateVoicevoxAudio(string $text): ?string
{
    $voicevoxHost = 'http://127.0.0.1:50021';

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $voicevoxHost . '/audio_query?text=' . urlencode($text) . '&speaker=3',
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
        CURLOPT_URL => $voicevoxHost . '/synthesis?speaker=3',
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => $queryJson,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
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
