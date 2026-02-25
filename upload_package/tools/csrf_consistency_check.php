<?php

/**
 * CSRF Consistency Checker — フロントエンド⇔バックエンド CSRF 整合性検証
 * 
 * バグパターン: APIがCSRF::validateRequest()を要求 → フロントのfetchがトークン未送信 → 403
 * このツールは両側を静的解析して不整合を検出する。
 * 
 * Usage: php tools/csrf_consistency_check.php
 * Exit:  0 = OK, 1 = 不整合あり
 */

$rootDir = dirname(__DIR__);
$apiDir  = $rootDir . '/public_html/api';
$frontendDirs = [
    $rootDir . '/public_html',
    $rootDir . '/public_html/components',
];

echo "=== CSRF Consistency Check ===" . PHP_EOL . PHP_EOL;

// ──────────────────────────────────────
// Phase 1: バックエンドスキャン
//   api/ 配下で CSRF::validateRequest() を呼んでいるファイルを特定
// ──────────────────────────────────────

$csrfRequiredEndpoints = [];

foreach (glob($apiDir . '/*.php') as $apiFile) {
    $content = file_get_contents($apiFile);
    if (
        stripos($content, 'CSRF::validateRequest') !== false
        || stripos($content, 'csrf::validate') !== false
    ) {
        $basename = basename($apiFile);
        $csrfRequiredEndpoints[$basename] = $apiFile;
    }
}

echo "📋 Phase 1: CSRF必須エンドポイント (" . count($csrfRequiredEndpoints) . " 件)" . PHP_EOL;
foreach ($csrfRequiredEndpoints as $name => $path) {
    echo "   ✅ api/{$name}" . PHP_EOL;
}
echo PHP_EOL;

if (empty($csrfRequiredEndpoints)) {
    echo "⚠️  CSRF::validateRequest() を使っている API が見つかりません。" . PHP_EOL;
    exit(0);
}

// ──────────────────────────────────────
// Phase 2: フロントエンドスキャン
//   フロントエンドの PHP/JS ファイルを解析し、
//   上記エンドポイントへの fetch/XMLHttpRequest 呼び出しを特定。
//   各呼び出しで X-CSRF-Token ヘッダーが設定されているか検証。
// ──────────────────────────────────────

$frontendFiles = [];
foreach ($frontendDirs as $dir) {
    if (!is_dir($dir)) continue;
    foreach (glob($dir . '/*.php') as $f) $frontendFiles[] = $f;
    foreach (glob($dir . '/*.js') as $f) $frontendFiles[] = $f;
    foreach (glob($dir . '/js/*.js') as $f) $frontendFiles[] = $f;
}
// Deduplicate
$frontendFiles = array_unique($frontendFiles);

echo "📋 Phase 2: フロントエンドスキャン (" . count($frontendFiles) . " ファイル)" . PHP_EOL;

$issues = [];
$coveredEndpoints = [];

foreach ($frontendFiles as $file) {
    $content = file_get_contents($file);
    $relPath = str_replace($rootDir . '/', '', $file);

    foreach ($csrfRequiredEndpoints as $endpointName => $apiPath) {
        // ──────────────────────────────────────
        // 改善版: 実際の API 呼び出しコンテキストのみ検出
        //   ✅ fetch('api/endpoint.php', ...)
        //   ✅ fetch(`${base}api/endpoint.php`, ...)
        //   ✅ XMLHttpRequest.open('POST', 'api/endpoint.php')
        //   ✅ $.ajax({url: 'api/endpoint.php'})
        //   ✅ $.post('api/endpoint.php')
        //   ✅ <form action="api/endpoint.php">
        //   ❌ <a href="endpoint.php"> → 偽陽性を排除
        //   ❌ コメント内の参照 → 偽陽性を排除
        // ──────────────────────────────────────
        $nameNoExt = str_replace('.php', '', $endpointName);

        // エンドポイント名のエスケープ（正規表現用）
        $escapedName = preg_quote($endpointName, '/');
        $escapedNameNoExt = preg_quote($nameNoExt, '/');

        // api/ パス付きパターン（fetch/ajax コンテキスト）
        $apiPathPattern = "(?:\\/?)api\\/{$escapedName}";
        $apiPathPatternNoExt = "(?:\\/?)api\\/{$escapedNameNoExt}";

        $callPatterns = [
            // fetch('api/xxx.php' or fetch(`...api/xxx.php...`)
            "/fetch\s*\(\s*['\"`][^'\"]*{$apiPathPattern}/i",
            "/fetch\s*\(\s*['\"`][^'\"]*{$apiPathPatternNoExt}['\"`\s]/i",
            // XMLHttpRequest.open('...', 'api/xxx.php')
            "/\.open\s*\(\s*['\"][^'\"]*['\"]\s*,\s*['\"][^'\"]*{$apiPathPattern}/i",
            // $.ajax / $.post / $.get
            "/\$\.\s*(?:ajax|post|get)\s*\(\s*['\"][^'\"]*{$apiPathPattern}/i",
            // <form action="api/xxx.php">
            "/action\s*=\s*['\"][^'\"]*{$apiPathPattern}/i",
            // fetch(variable + 'api/xxx.php') — 変数連結パターン
            "/fetch\s*\([^)]*{$apiPathPattern}/i",
        ];

        $callsEndpoint = false;
        foreach ($callPatterns as $regex) {
            if (preg_match($regex, $content)) {
                $callsEndpoint = true;
                break;
            }
        }

        if (!$callsEndpoint) continue;

        $coveredEndpoints[$endpointName] = true;

        // このファイル内で X-CSRF-Token ヘッダーを探す
        $hasCsrfHeader = false;
        $csrfPatterns = [
            'X-CSRF-Token',
            'X-Csrf-Token',
            'x-csrf-token',
            'csrf-token',      // meta タグからの読み取りパターン
            'csrf_token',      // POSTフィールド
            'csrfToken',       // JS変数名
        ];

        foreach ($csrfPatterns as $cp) {
            if (stripos($content, $cp) !== false) {
                $hasCsrfHeader = true;
                break;
            }
        }

        if ($hasCsrfHeader) {
            echo "   ✅ {$relPath} → api/{$endpointName} (CSRF送信あり)" . PHP_EOL;
        } else {
            echo "   ❌ {$relPath} → api/{$endpointName} (CSRF送信なし!)" . PHP_EOL;
            $issues[] = [
                'file'     => $relPath,
                'endpoint' => "api/{$endpointName}",
                'detail'   => "fetch() で api/{$endpointName} を呼んでいるが、CSRFトークン (X-CSRF-Token) が送信されていない",
            ];
        }
    }
}

echo PHP_EOL;

// ──────────────────────────────────────
// Phase 3: 未参照エンドポイント検出
//   フロントから一切呼ばれていないCSRF必須APIを検出
// ──────────────────────────────────────

$uncalledEndpoints = array_diff_key($csrfRequiredEndpoints, $coveredEndpoints);
if (!empty($uncalledEndpoints)) {
    echo "⚠️  Phase 3: フロントエンドから呼び出しが見つからないCSRF必須API:" . PHP_EOL;
    foreach ($uncalledEndpoints as $name => $path) {
        echo "   ❓ api/{$name} (外部/モバイル専用 or 呼び出し漏れ)" . PHP_EOL;
    }
    echo PHP_EOL;
}

// ──────────────────────────────────────
// Phase 4: meta タグ確認
//   components/meta.php に csrf-token meta タグがあるか
// ──────────────────────────────────────

echo "📋 Phase 4: CSRF meta タグ確認" . PHP_EOL;
$metaFile = $rootDir . '/public_html/components/meta.php';
if (file_exists($metaFile)) {
    $metaContent = file_get_contents($metaFile);
    if (stripos($metaContent, 'csrf-token') !== false) {
        echo "   ✅ components/meta.php に csrf-token meta タグあり" . PHP_EOL;
    } else {
        echo "   ❌ components/meta.php に csrf-token meta タグがない!" . PHP_EOL;
        $issues[] = [
            'file'     => 'components/meta.php',
            'endpoint' => '(グローバル)',
            'detail'   => 'csrf-token meta タグが未設定。CSRF::generate() による meta タグ注入が必要。',
        ];
    }
} else {
    echo "   ⚠️  components/meta.php が見つかりません" . PHP_EOL;
}

echo PHP_EOL;

// ──────────────────────────────────────
// Summary
// ──────────────────────────────────────

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" . PHP_EOL;
if (empty($issues)) {
    echo "✅ ALL CLEAR — CSRF整合性チェック通過" . PHP_EOL;
    exit(0);
} else {
    echo "❌ " . count($issues) . " 件の不整合を検出:" . PHP_EOL;
    foreach ($issues as $i => $issue) {
        echo PHP_EOL;
        echo "  [{$i}] {$issue['file']}" . PHP_EOL;
        echo "      → {$issue['endpoint']}" . PHP_EOL;
        echo "      📝 {$issue['detail']}" . PHP_EOL;
    }
    echo PHP_EOL;
    echo "修正方法: fetch() の headers に 'X-CSRF-Token': document.querySelector('meta[name=\"csrf-token\"]')?.content を追加" . PHP_EOL;
    exit(1);
}
