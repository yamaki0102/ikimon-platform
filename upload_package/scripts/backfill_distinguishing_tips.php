<?php

/**
 * Backfill distinguishing_tips — 既存 AI考察に見分け方ポイントを補完
 *
 * similar_taxa_to_compare を持つが distinguishing_tips がない観察に対して、
 * テキストのみの軽量 Gemini 呼び出しで distinguishing_tips を生成・保存する。
 *
 * Usage:
 *   php scripts/backfill_distinguishing_tips.php
 *   php scripts/backfill_distinguishing_tips.php --limit=30
 *   php scripts/backfill_distinguishing_tips.php --limit=30 --delay=2
 *   php scripts/backfill_distinguishing_tips.php --dry-run
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';

// ── CLI args ──────────────────────────────────────────────────────────────────
$opts    = getopt('', ['limit:', 'delay:', 'dry-run']);
$limit   = max(1, min(200, (int)($opts['limit'] ?? 30)));
$delay   = max(0, (int)($opts['delay'] ?? 1));
$dryRun  = isset($opts['dry-run']);

if (!defined('GEMINI_API_KEY') || GEMINI_API_KEY === '') {
    fwrite(STDERR, "ERROR: GEMINI_API_KEY が設定されていません\n");
    exit(1);
}

$model = 'gemini-3.1-flash-lite-preview';
$apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' . $model . ':generateContent?key=' . GEMINI_API_KEY;

echo "=== backfill_distinguishing_tips ===\n";
echo "limit={$limit}  delay={$delay}s  dry-run=" . ($dryRun ? 'YES' : 'no') . "\n\n";

// ── 対象観察を収集 ────────────────────────────────────────────────────────────
$all = DataStore::fetchAll('observations');
usort($all, fn($a, $b) => strcmp($b['created_at'] ?? '', $a['created_at'] ?? ''));

$targets = [];
foreach ($all as $obs) {
    if (count($targets) >= $limit) break;

    $last = null;
    $lastIdx = null;
    foreach (array_reverse($obs['ai_assessments'] ?? [], true) as $idx => $a) {
        if (($a['kind'] ?? '') === 'machine_assessment') {
            $last = $a;
            $lastIdx = $idx;
            break;
        }
    }
    if (!$last) continue;
    if (empty($last['similar_taxa_to_compare'])) continue;
    if (!empty($last['distinguishing_tips'])) continue;

    $targets[] = [
        'obs'     => $obs,
        'lastIdx' => $lastIdx,
        'last'    => $last,
    ];
}

$total = count($targets);
echo "対象: {$total} 件\n\n";

if ($total === 0) {
    echo "バックフィル不要。終了。\n";
    exit(0);
}

// ── 処理 ──────────────────────────────────────────────────────────────────────
$done = 0;
$failed = 0;

foreach ($targets as $i => $target) {
    $obs     = $target['obs'];
    $lastIdx = $target['lastIdx'];
    $last    = $target['last'];

    $rawCandidates = $last['similar_taxa_to_compare'];
    $candidates = array_values(array_filter(array_map(function($c) {
        if (is_string($c)) return trim($c);
        if (is_array($c)) return trim((string)($c['label'] ?? $c['name'] ?? $c['taxon_name'] ?? ''));
        return '';
    }, $rawCandidates), fn($v) => $v !== ''));

    if (empty($candidates)) continue;

    $rawFeatures = $last['diagnostic_features_seen'] ?? [];
    $features = array_values(array_filter(array_map(function($f) {
        if (is_string($f)) return trim($f);
        if (is_array($f)) return trim((string)($f['label'] ?? $f['feature'] ?? ''));
        return '';
    }, $rawFeatures), fn($v) => $v !== ''));

    $obsId   = $obs['id'] ?? '?';
    $species = $obs['species_name'] ?? ($obs['taxon']['name'] ?? '不明');
    $n       = $i + 1;

    echo "[{$n}/{$total}] {$obsId} ({$species})\n";
    echo "  候補: " . implode(', ', $candidates) . "\n";

    if ($dryRun) {
        echo "  [DRY-RUN] スキップ\n\n";
        continue;
    }

    // ── Gemini テキストのみ呼び出し ──────────────────────────────────────────
    $candidateStr = implode('、', $candidates);
    $featureStr   = $features ? implode('、', $features) : 'なし';

    $prompt = <<<PROMPT
以下の生き物の候補種を見分けるためのポイントを、観察者が野外で実際に確認できる形態・色・模様・サイズ・生育環境などを使って日本語で列挙してください。
「Aは〜だが、Bは〜」のように対比を明確にした短い文で示してください。

候補種: {$candidateStr}
写真から確認できている特徴: {$featureStr}

JSON のみ出力してください（他のテキスト不要）:
{"distinguishing_tips": ["...", "..."]}

条件: 4件以内、各60文字以内、日本語。候補が1種のみの場合は空配列にしてください。
PROMPT;

    $request = [
        'contents' => [['parts' => [['text' => $prompt]]]],
        'generationConfig' => [
            'temperature'       => 0.2,
            'maxOutputTokens'   => 512,
            'responseMimeType'  => 'application/json',
        ],
    ];

    $ch = curl_init($apiUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST          => true,
        CURLOPT_HTTPHEADER    => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS    => json_encode($request, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT       => 20,
        CURLOPT_CONNECTTIMEOUT => 5,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if (!is_string($response) || $response === '' || $httpCode !== 200) {
        echo "  [FAIL] HTTP {$httpCode} {$curlErr}\n\n";
        $failed++;
        continue;
    }

    $decoded = json_decode($response, true);
    $text    = $decoded['candidates'][0]['content']['parts'][0]['text'] ?? '';
    $payload = json_decode($text, true);

    if (!is_array($payload) || !isset($payload['distinguishing_tips'])) {
        echo "  [FAIL] JSON パース失敗: " . substr($text, 0, 80) . "\n\n";
        $failed++;
        continue;
    }

    // ── クリーニング ─────────────────────────────────────────────────────────
    $tips = [];
    foreach (array_slice($payload['distinguishing_tips'], 0, 4) as $tip) {
        $t = mb_substr(trim((string)$tip), 0, 60);
        if ($t !== '') $tips[] = $t;
    }
    $tips = array_values(array_unique($tips));

    echo "  tips: " . implode(' / ', $tips) . "\n";

    // ── observation に書き込み ────────────────────────────────────────────────
    $obs['ai_assessments'][$lastIdx]['distinguishing_tips'] = $tips;

    $saved = DataStore::upsert('observations', $obs);
    if ($saved) {
        echo "  [OK] 保存完了\n\n";
        $done++;
    } else {
        echo "  [FAIL] 保存失敗\n\n";
        $failed++;
    }

    if ($delay > 0) sleep($delay);
}

// ── サマリー ──────────────────────────────────────────────────────────────────
echo "=== 完了 ===\n";
echo "成功: {$done}  失敗: {$failed}  スキップ(dry-run): " . ($dryRun ? $total : 0) . "\n";
