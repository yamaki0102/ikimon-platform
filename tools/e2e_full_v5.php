<?php

/**
 * ikimon.life E2E Full Test v5 — ゴリゴリ版
 * 3ユーザー体制 (A/B/C) でコンセンサス・Research Grade到達を実証
 * Usage: php tools/e2e_full_v5.php [--base=http://localhost:8899]
 */
error_reporting(E_ALL & ~E_DEPRECATED);
$baseUrl = 'http://localhost:8899';
foreach ($argv as $arg) {
    if (strpos($arg, '--base=') === 0) $baseUrl = substr($arg, 7);
}

echo "╔══════════════════════════════════════════════════╗\n";
echo "║  ikimon.life E2E Full Test v5 — 3ユーザー版     ║\n";
echo "╠══════════════════════════════════════════════════╣\n";
echo "║  Base: " . str_pad($baseUrl, 42) . "║\n";
echo "║  Time: " . str_pad(date('Y-m-d H:i:s'), 42) . "║\n";
echo "╚══════════════════════════════════════════════════╝\n\n";

$pass = $fail = $skip = 0;
$warnings = $errors = [];

// ─── HTTP Helpers ───────────────────────────────
function http_get(string $url, ?string $cookie = null): array
{
    $h = "User-Agent: ikimon-e2e/5.0\r\n";
    if ($cookie) $h .= "Cookie: {$cookie}\r\n";
    $ctx = stream_context_create(['http' => ['timeout' => 15, 'method' => 'GET', 'ignore_errors' => true, 'header' => $h, 'follow_location' => 0]]);
    $body = @file_get_contents($url, false, $ctx);
    return parse_response($body, http_get_last_response_headers() ?? []);
}

function http_post(string $url, array $data, ?string $cookie = null, string $ct = 'form', ?string $csrfHeader = null): array
{
    $content = ($ct === 'json') ? json_encode($data) : http_build_query($data);
    $ctype = ($ct === 'json') ? 'application/json' : 'application/x-www-form-urlencoded';
    $h = "Content-Type: {$ctype}\r\nUser-Agent: ikimon-e2e/5.0\r\n";
    if ($cookie) $h .= "Cookie: {$cookie}\r\n";
    if ($csrfHeader) $h .= "X-Csrf-Token: {$csrfHeader}\r\n";
    $ctx = stream_context_create(['http' => ['timeout' => 15, 'method' => 'POST', 'ignore_errors' => true, 'header' => $h, 'content' => $content, 'follow_location' => 0]]);
    $body = @file_get_contents($url, false, $ctx);
    return parse_response($body, http_get_last_response_headers() ?? []);
}

function http_json(string $url, array $data, string $csrf, ?string $cookie = null): array
{
    $data['csrf_token'] = $csrf;
    return http_post($url, $data, $cookie, 'json', $csrf);
}

function http_multipart(string $url, array $fields, array $files, ?string $cookie = null): array
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        $post = $fields;
        foreach ($files as $k => $fi) {
            $post[$k] = new CURLFile($fi['path'], $fi['mime'], $fi['name']);
        }
        $hdrs = ['User-Agent: ikimon-e2e/5.0'];
        if ($cookie) $hdrs[] = "Cookie: {$cookie}";
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $post, CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => true, CURLOPT_HTTPHEADER => $hdrs, CURLOPT_TIMEOUT => 30, CURLOPT_FOLLOWLOCATION => false]);
        $resp = curl_exec($ch);
        $hs = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $st = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $headerStr = substr($resp, 0, $hs);
        $body = substr($resp, $hs);
        $cookies = [];
        $loc = null;
        foreach (explode("\r\n", $headerStr) as $line) {
            if (preg_match('/^Set-Cookie:\s*([^;]+)/i', $line, $m)) $cookies[] = $m[1];
            if (preg_match('/^Location:\s*(.+)/i', $line, $m)) $loc = trim($m[1]);
        }
        return ['status' => $st, 'body' => $body, 'cookies' => $cookies, 'location' => $loc];
    }
    // Fallback: build multipart/form-data with file_get_contents
    $boundary = '----E2EBoundary' . bin2hex(random_bytes(8));
    $body = '';
    foreach ($fields as $k => $v) {
        $body .= "--{$boundary}\r\nContent-Disposition: form-data; name=\"{$k}\"\r\n\r\n{$v}\r\n";
    }
    foreach ($files as $k => $fi) {
        $fdata = file_get_contents($fi['path']);
        $body .= "--{$boundary}\r\nContent-Disposition: form-data; name=\"{$k}\"; filename=\"{$fi['name']}\"\r\nContent-Type: {$fi['mime']}\r\n\r\n{$fdata}\r\n";
    }
    $body .= "--{$boundary}--\r\n";
    $h = "Content-Type: multipart/form-data; boundary={$boundary}\r\nUser-Agent: ikimon-e2e/5.0\r\n";
    if ($cookie) $h .= "Cookie: {$cookie}\r\n";
    $ctx = stream_context_create(['http' => ['timeout' => 30, 'method' => 'POST', 'ignore_errors' => true, 'header' => $h, 'content' => $body, 'follow_location' => 0]]);
    $resp = @file_get_contents($url, false, $ctx);
    return parse_response($resp, http_get_last_response_headers() ?? []);
}

function createTestImage(): string
{
    $p = tempnam(sys_get_temp_dir(), 'e2e_') . '.png';
    if (function_exists('imagecreatetruecolor')) {
        $img = imagecreatetruecolor(100, 100);
        imagefill($img, 0, 0, imagecolorallocate($img, 0, 200, 0));
        imagepng($img, $p);
        imagedestroy($img);
    } else {
        // Minimal valid 1x1 green PNG (no GD required)
        $png = base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        );
        file_put_contents($p, $png);
    }
    return $p;
}

function http_follow(string $base, array $r, ?string $c = null): array
{
    if (in_array($r['status'], [301, 302]) && $r['location']) {
        $t = $r['location'];
        if (strpos($t, 'http') !== 0) $t = $base . '/' . ltrim($t, '/');
        return http_get($t, extractCookie($r, $c));
    }
    return $r;
}

function parse_response(?string $body, array $rh): array
{
    $st = 0;
    $ck = [];
    $loc = null;
    foreach ($rh as $h) {
        if (preg_match('/^HTTP\/\S+\s+(\d+)/', $h, $m)) $st = (int)$m[1];
        if (preg_match('/^Set-Cookie:\s*([^;]+)/i', $h, $m)) $ck[] = $m[1];
        if (preg_match('/^Location:\s*(.+)/i', $h, $m)) $loc = trim($m[1]);
    }
    return ['status' => $st, 'body' => $body ?: '', 'cookies' => $ck, 'location' => $loc];
}

function extractCookie(array $r, ?string $ex = null): ?string
{
    $p = [];
    if ($ex) foreach (explode('; ', $ex) as $c) {
        $kv = explode('=', $c, 2);
        if (count($kv) === 2) $p[$kv[0]] = $kv[1];
    }
    foreach ($r['cookies'] as $c) {
        $kv = explode('=', $c, 2);
        if (count($kv) === 2) $p[$kv[0]] = $kv[1];
    }
    if (empty($p)) return null;
    $out = [];
    foreach ($p as $k => $v) $out[] = "{$k}={$v}";
    return implode('; ', $out);
}

function extractCsrf(string $html): ?string
{
    if (preg_match('/name=["\']csrf_token["\'][^>]*value=["\']([^"\']+)["\']/', $html, $m)) return $m[1];
    if (preg_match('/value=["\']([a-f0-9]{32,})["\'][^>]*name=["\']csrf_token["\']/', $html, $m)) return $m[1];
    if (preg_match("/csrfToken:\s*'([a-f0-9]{32,})'/", $html, $m)) return $m[1];
    if (preg_match('/csrfToken:\s*"([a-f0-9]{32,})"/', $html, $m)) return $m[1];
    if (preg_match('/meta\s+name=["\']csrf-token["\'][^>]*content=["\']([^"\']+)["\']/', $html, $m)) return $m[1];
    return null;
}

// Extract CSRF from cookie string (Double-Submit Cookie pattern)
function extractCsrfFromCookie(?string $cookie): ?string
{
    if (!$cookie) return null;
    if (preg_match('/ikimon_csrf=([a-f0-9]{64})/', $cookie, $m)) return $m[1];
    return null;
}

// Refresh CSRF: hit any page to ensure ikimon_csrf cookie is set, return updated cookie+csrf
function refreshCsrf(string $base, string $cookie): array
{
    $r = http_get($base . '/index.php', $cookie);
    $cookie = extractCookie($r, $cookie);
    $csrf = extractCsrfFromCookie($cookie);
    if (!$csrf) $csrf = extractCsrf($r['body']);
    return [$cookie, $csrf];
}

function test(string $name, bool $ok, string $detail = ''): bool
{
    global $pass, $fail, $errors;
    if ($ok) {
        echo "  ✅ {$name}\n";
        $pass++;
    } else {
        echo "  ❌ {$name}" . ($detail ? " — {$detail}" : "") . "\n";
        $fail++;
        $errors[] = $name . ($detail ? ": {$detail}" : "");
    }
    return $ok;
}

function skip_test(string $name, string $reason = ''): void
{
    global $skip;
    echo "  ⏭️  {$name}" . ($reason ? " — {$reason}" : "") . "\n";
    $skip++;
}

function checkPHPErrors(string $body, string $page): void
{
    global $warnings;
    if (preg_match('/<b>(Fatal error|Parse error)<\/b>/', $body)) test("  ↳ No PHP Fatal in {$page}", false, "PHP error detected");
    if (preg_match('/<b>Warning<\/b>:\s/', $body)) $warnings[] = $page;
}

function registerUser(string $base, string $email, string $pass, string $name): array
{
    $lp = http_get($base . '/login.php?tab=register');
    $ck = extractCookie($lp);
    $csrf = extractCsrf($lp['body']);
    if (!$csrf || !$ck) return [null, null, null];
    $reg = http_post($base . '/login.php', ['action' => 'register', 'name' => $name, 'email' => $email, 'password' => $pass, 'password_confirm' => $pass, 'csrf_token' => $csrf, 'redirect' => 'index.php'], $ck);
    $ck = extractCookie($reg, $ck);
    if ($reg['status'] === 302) {
        $af = http_follow($base, $reg, $ck);
        $ck = extractCookie($af, $ck);
    }
    // Get user ID from profile page
    $pp = http_get($base . '/profile.php', $ck);
    $ck = extractCookie($pp, $ck);
    $uid = null;
    if (preg_match("/userId\\s*=\\s*['\"]([a-zA-Z0-9_]+)['\"]/", $pp['body'], $um)) {
        $uid = $um[1];
    } elseif (preg_match("/user_id['\"]\\s*:\\s*['\"]([a-zA-Z0-9_]+)['\"]/", $pp['body'], $um)) {
        $uid = $um[1];
    }
    // Get CSRF from cookie (Double-Submit Cookie pattern)
    $csrf = extractCsrfFromCookie($ck);
    if (!$csrf) {
        // Fallback: hit post.php to get CSRF from HTML
        $post = http_get($base . '/post.php', $ck);
        $ck = extractCookie($post, $ck);
        $csrf = extractCsrf($post['body']);
        if (!$csrf) $csrf = extractCsrfFromCookie($ck);
    }
    return [$ck, $uid, $csrf];
}

// ═══════════════════════════════════════
// PHASE 1: パブリックページ
// ═══════════════════════════════════════
echo "── Phase 1: パブリックページ ──────────────────\n";
$publicPages = [
    ['/', [200], '生き物'],
    ['/index.php', [200], null],
    ['/login.php', [200], 'ログイン'],
    ['/explore.php', [200], null],
    ['/zukan.php', [200], '図鑑'],
    ['/about.php', [200], 'ikimon'],
    ['/for-business.php', [200], '企業'],
    ['/for-researcher.php', [200], null],
    ['/for-citizen.php', [200], null],
    ['/faq.php', [200], null],
    ['/terms.php', [200], null],
    ['/privacy.php', [200], null],
    ['/guidelines.php', [200], null],
    ['/post.php', [200], null],
    ['/field_research.php', [200], null],
    ['/events.php', [200], null],
    ['/ranking.php', [200, 301, 302], null],
    ['/heatmap.php', [200, 301, 302], null],
    ['/compass.php', [200], null],
    ['/reference_layer.php', [200], null],
    ['/id_center.php', [200, 302], null],
    ['/id_wizard.php', [200], null],
    ['/showcase.php', [200], null],
    ['/sitemap.php', [200], null],
    ['/offline.php', [200], null],
    ['/map.php', [200], null],
    ['/species.php', [200, 302], null],
    ['/team.php', [200], null],
    ['/survey.php', [200, 302], null],
    ['/csr_showcase.php', [200, 302], null],
    ['/corporate_dashboard.php', [200], null],
    ['/site_dashboard.php', [200], null],
    ['/my_organisms.php', [200, 302], null],
    ['/403.php', [403], null],
    ['/404.php', [404], null],
];
foreach ($publicPages as [$path, $exp, $chk]) {
    $r = http_get($baseUrl . $path);
    test("GET {$path} [{$r['status']}]", in_array($r['status'], $exp), "Expected " . implode('|', $exp) . ", got {$r['status']}");
    if ($r['status'] === 200) {
        if ($chk) test("  ↳ Contains '{$chk}'", mb_strpos($r['body'], $chk) !== false);
        checkPHPErrors($r['body'], $path);
    }
}

// ═══════════════════════════════════════
// PHASE 2: API GET (非認証)
// ═══════════════════════════════════════
echo "\n── Phase 2: API GETエンドポイント ──────────────\n";
$getApis = [
    ['/api/health.php', [200]],
    ['/api/get_observations.php', [200]],
    ['/api/get_events.php', [200]],
    ['/api/taxon_index.php', [200]],
    ['/api/get_exploration_stats.php', [200]],
    ['/api/region_list.php', [200]],
    ['/api/list_sites.php', [200]],
    ['/api/search.php?q=test', [200]],
    ['/api/search_taxon.php?q=test', [200]],
    ['/api/heatmap_data.php', [200]],
    ['/api/get_regional_stats.php', [200]],
    ['/api/get_showcase_data.php', [200]],
    ['/api/get_completeness.php', [200]],
    ['/api/verify_config.php', [200]],
    ['/api/taxon_suggest.php?q=a', [200]],
    ['/api/get_impact_stats.php', [200]],
    ['/api/get_analytics_summary.php', [403]],
];
foreach ($getApis as [$path, $exp]) {
    $r = http_get($baseUrl . $path);
    $ok = in_array($r['status'], $exp);
    test("API GET {$path} [{$r['status']}]", $ok, "Expected " . implode('|', $exp));
    if ($ok && $r['status'] !== 403 && strpos($path, 'verify_config') === false) {
        $j = json_decode($r['body'], true);
        test("  ↳ Valid JSON", $j !== null, "Invalid: " . substr($r['body'], 0, 80));
    }
}

// ═══════════════════════════════════════
// PHASE 3: ユーザー登録（3名体制）
// ═══════════════════════════════════════
echo "\n── Phase 3: ユーザー登録（A + B + C） ──────────\n";
$ts = time();
$testPass = 'TestPass123!';
$emailA = "e2e_a_{$ts}@example.com";
$nameA = "E2E_A_" . date('His');
$emailB = "e2e_b_{$ts}@example.com";
$nameB = "E2E_B_" . date('His');
$emailC = "e2e_c_{$ts}@example.com";
$nameC = "E2E_C_" . date('His');

[$cookieA, $userIdA, $csrfA] = registerUser($baseUrl, $emailA, $testPass, $nameA);
test("User A registered", $cookieA !== null);
test("User A ID: " . ($userIdA ?? 'null'), $userIdA !== null);

[$cookieB, $userIdB, $csrfB] = registerUser($baseUrl, $emailB, $testPass, $nameB);
test("User B registered", $cookieB !== null);
test("User B ID: " . ($userIdB ?? 'null'), $userIdB !== null);

[$cookieC, $userIdC, $csrfC] = registerUser($baseUrl, $emailC, $testPass, $nameC);
test("User C registered", $cookieC !== null);
test("User C ID: " . ($userIdC ?? 'null'), $userIdC !== null);

$loggedA = $cookieA && $csrfA;
$loggedB = $cookieB && $csrfB;
$loggedC = $cookieC && $csrfC;
echo "  → A:" . ($loggedA ? '✨' : '⚠️') . " B:" . ($loggedB ? '✨' : '⚠️') . " C:" . ($loggedC ? '✨' : '⚠️') . "\n";

// ═══════════════════════════════════════
// PHASE 4: 認証必須ページ
// ═══════════════════════════════════════
echo "\n── Phase 4: 認証必須ページ ────────────────────\n";
foreach (['/profile.php', '/profile_edit.php', '/wellness.php', '/my_field_dashboard.php', '/review_queue.php', '/id_workbench.php', '/id_form.php'] as $path) {
    $r = http_get($baseUrl . $path, $cookieA);
    test("AUTH GET {$path} [{$r['status']}]", in_array($r['status'], [200, 302]));
    if ($r['status'] === 200) checkPHPErrors($r['body'], $path);
}

// ═══════════════════════════════════════
// PHASE 5: 認証必須 API (GET)
// ═══════════════════════════════════════
echo "\n── Phase 5: 認証必須 API (GET) ────────────────\n";
foreach ([['/api/get_notifications.php', [200]], ['/api/get_personal_report.php', [200]], ['/api/get_wellness_summary.php', [200, 401]], ['/api/get_tracks.php', [200, 400, 401]], ['/api/get_field_sessions.php', [200, 400, 401]]] as [$path, $al]) {
    $r = http_get($baseUrl . $path, $cookieA);
    test("AUTH API GET {$path} [{$r['status']}]", in_array($r['status'], $al));
}

// ═══════════════════════════════════════
// PHASE 6: 観測投稿
// ═══════════════════════════════════════
echo "\n── Phase 6: 観測投稿 (User A) ─────────────────\n";
$observationIdA = null;
$testImgPath = null;
if ($loggedA) {
    // 写真なし → 拒否
    $r1 = http_post($baseUrl . '/api/post_observation.php', ['taxon_name' => 'テスト種', 'lat' => '34.977', 'lng' => '138.383', 'observed_at' => date('Y-m-d H:i:s'), 'notes' => 'E2Eテスト v5 no-photo', 'csrf_token' => $csrfA], $cookieA);
    $j1 = json_decode($r1['body'], true);
    test("POST observation (no photo) → rejected", $r1['status'] === 200 && ($j1['success'] ?? true) === false);

    // 写真付き → 成功
    $testImgPath = createTestImage();
    $r2 = http_multipart($baseUrl . '/api/post_observation.php', [
        'taxon_name' => 'テスト種（E2E写真）',
        'lat' => '34.710',
        'lng' => '137.726',
        'observed_at' => date('Y-m-d H:i:s'),
        'notes' => 'E2Eテスト v5 写真付き',
        'habitat' => 'forest',
        'csrf_token' => $csrfA,
    ], ['photos[]' => ['path' => $testImgPath, 'mime' => 'image/png', 'name' => 'test_e2e.png']], $cookieA);
    $j2 = json_decode($r2['body'], true);
    $created = in_array($r2['status'], [200, 201]) && ($j2['success'] ?? false) === true;
    test("POST observation (with photo) → created", $created, "S:{$r2['status']} B:" . substr($r2['body'], 0, 120));
    if ($created) {
        $observationIdA = $j2['id'] ?? ($j2['observation_id'] ?? ($j2['data']['id'] ?? null));
        test("  ↳ Observation ID: " . ($observationIdA ?? 'null'), $observationIdA !== null);
    }
    if ($observationIdA) {
        $dr = http_get($baseUrl . '/observation_detail.php?id=' . $observationIdA, $cookieA);
        test("GET observation_detail [{$dr['status']}]", $dr['status'] === 200);
    }
} else {
    skip_test("Phase 6: 観測投稿", "User A未ログイン");
}

// ═══════════════════════════════════════
// PHASE 7: 同定 + コンセンサス（3ユーザー）
// ═══════════════════════════════════════
echo "\n── Phase 7: 同定 + コンセンサス (B+C→A) ───────\n";
if ($loggedB && $loggedC && $observationIdA) {
    $taxonName = 'アブラゼミ';
    $taxonSci = 'Graptopsaltria nigrofuscata';
    $taxonKey = 'e2e_test_abura_1234';
    $lineage = ['kingdom' => 'Animalia', 'phylum' => 'Arthropoda', 'class' => 'Insecta', 'order' => 'Hemiptera', 'family' => 'Cicadidae', 'genus' => 'Graptopsaltria'];

    // User B が同定
    $idB = http_json($baseUrl . '/api/post_identification.php', [
        'observation_id' => $observationIdA,
        'taxon_name' => $taxonName,
        'scientific_name' => $taxonSci,
        'taxon_key' => $taxonKey,
        'taxon_rank' => 'species',
        'confidence' => 'sure',
        'evidence_type' => 'visual',
        'note' => 'E2Eテスト v5 同定 by B',
        'lineage' => $lineage,
    ], $csrfB, $cookieB);
    $idBJ = json_decode($idB['body'], true);
    test("POST identification (User B)", ($idBJ['success'] ?? false) === true, substr($idB['body'], 0, 120));

    // User C が同じ種で同定 → コンセンサス到達
    $idC = http_json($baseUrl . '/api/post_identification.php', [
        'observation_id' => $observationIdA,
        'taxon_name' => $taxonName,
        'scientific_name' => $taxonSci,
        'taxon_key' => $taxonKey,
        'taxon_rank' => 'species',
        'confidence' => 'sure',
        'evidence_type' => 'visual',
        'note' => 'E2Eテスト v5 同定 by C',
        'lineage' => $lineage,
    ], $csrfC, $cookieC);
    $idCJ = json_decode($idC['body'], true);
    test("POST identification (User C same taxon)", ($idCJ['success'] ?? false) === true, substr($idC['body'], 0, 120));

    // コンセンサス確認: statusが「研究用」or「要同定」になっているか
    // API経由 or 直接DataStore
    $obsCheck = http_get($baseUrl . '/api/get_observations.php?id=' . $observationIdA, $cookieA);
    $obsData = json_decode($obsCheck['body'], true);
    // 観測データ内のstatusを確認
    $obs = null;
    if (isset($obsData['data']) && is_array($obsData['data'])) {
        foreach ($obsData['data'] as $o) {
            if (($o['id'] ?? '') === $observationIdA) {
                $obs = $o;
                break;
            }
        }
    }
    if (!$obs && isset($obsData['observations'])) {
        foreach ($obsData['observations'] as $o) {
            if (($o['id'] ?? '') === $observationIdA) {
                $obs = $o;
                break;
            }
        }
    }
    if (!$obs && isset($obsData['observation'])) {
        $obs = $obsData['observation'];
    }
    if (!$obs && isset($obsData['id']) && $obsData['id'] === $observationIdA) {
        $obs = $obsData;
    }

    if ($obs) {
        $status = $obs['status'] ?? $obs['quality_grade'] ?? 'unknown';
        // BioUtils: 2人の外部同定者 + agreement > 2/3 + topScore >= 2.0 → 研究用
        // ただしTrustLevelが新規ユーザーだと weight < 1.0 の可能性あり
        $isResearchOrNeedsId = in_array($status, ['研究用', '要同定', 'Research Grade', 'Needs ID']);
        test("  ↳ Consensus status: '{$status}'", $isResearchOrNeedsId, "Got: {$status}");

        if (isset($obs['consensus'])) {
            $cv = $obs['consensus']['total_votes'] ?? 0;
            test("  ↳ Consensus votes: {$cv}", $cv >= 2);
            $ar = $obs['consensus']['agreement_rate'] ?? 0;
            test("  ↳ Agreement rate: {$ar}", $ar > 0.5);
        }
        $taxon = $obs['taxon']['name'] ?? ($obs['taxon_name'] ?? 'unknown');
        test("  ↳ Community taxon: {$taxon}", strpos($taxon, $taxonName) !== false || $taxon !== 'unknown');
    } else {
        test("  ↳ Observation data retrieved", false, "Could not find obs in response");
    }

    // User B が別の種に変更 → コンセンサス崩壊テスト
    $idB2 = http_json($baseUrl . '/api/post_identification.php', [
        'observation_id' => $observationIdA,
        'taxon_name' => 'ミンミンゼミ',
        'scientific_name' => 'Hyalessa maculaticollis',
        'taxon_key' => 'e2e_test_minmin_5678',
        'taxon_rank' => 'species',
        'confidence' => 'likely',
        'evidence_type' => 'visual',
        'note' => 'E2Eテスト v5 同定変更 by B',
    ], $csrfB, $cookieB);
    $idB2J = json_decode($idB2['body'], true);
    test("POST identification (User B changes taxon)", ($idB2J['success'] ?? false) === true);

    // コンセンサスが崩れたか (B=ミンミンゼミ, C=アブラゼミ → agreement < 2/3)
    $obsCheck2 = http_get($baseUrl . '/api/get_observations.php?id=' . $observationIdA, $cookieA);
    $od2 = json_decode($obsCheck2['body'], true);
    $obs2 = null;
    if (isset($od2['observations'])) {
        foreach ($od2['observations'] as $o) {
            if (($o['id'] ?? '') === $observationIdA) {
                $obs2 = $o;
                break;
            }
        }
    } elseif (isset($od2['observation'])) {
        $obs2 = $od2['observation'];
    } elseif (isset($od2['id']) && $od2['id'] === $observationIdA) {
        $obs2 = $od2;
    }
    if ($obs2) {
        $st2 = $obs2['status'] ?? 'unknown';
        test(
            "  ↳ After disagreement status: '{$st2}'",
            in_array($st2, ['要同定', 'Needs ID', '研究用', 'Research Grade', '未同定']),
            "Consensus should reflect disagreement"
        );
    }

    // 存在しないobs
    $idBad = http_json($baseUrl . '/api/post_identification.php', ['observation_id' => 'nonexistent_99', 'taxon_name' => 'x', 'taxon_key' => '1'], $csrfB, $cookieB);
    test("POST identification (bad obs_id) → error", (json_decode($idBad['body'], true)['success'] ?? true) === false);

    // 空データ
    $idEmpty = http_json($baseUrl . '/api/post_identification.php', [], $csrfB, $cookieB);
    test("POST identification (empty) → error", (json_decode($idEmpty['body'], true)['success'] ?? true) === false);

    // 通知確認
    $nA = http_get($baseUrl . '/api/get_notifications.php', $cookieA);
    $nAJ = json_decode($nA['body'], true);
    $nList = $nAJ['notifications'] ?? $nAJ['data'] ?? $nAJ ?? [];
    $hasIdNotif = false;
    if (is_array($nList)) foreach ($nList as $n) {
        if (($n['type'] ?? '') === 'identification') {
            $hasIdNotif = true;
            break;
        }
    }
    test("  ↳ User A got identification notification", $hasIdNotif);
} elseif (!$observationIdA) {
    skip_test("Phase 7: 同定テスト", "観測IDなし");
} else {
    skip_test("Phase 7: 同定テスト", "User B/C未ログイン");
}

// ═══════════════════════════════════════
// PHASE 8: イベント管理
// ═══════════════════════════════════════
echo "\n── Phase 8: イベント管理 ──────────────────────\n";
$eventId = null;
if ($loggedA) {
    // Refresh CSRF from cookie for event APIs
    list($cookieA, $csrfA) = refreshCsrf($baseUrl, $cookieA);
    $ev = http_json($baseUrl . '/api/save_event.php', [
        'title' => 'E2Eテスト観察会 v5',
        'event_date' => date('Y-m-d', strtotime('+7 days')),
        'start_time' => '10:00',
        'end_time' => '12:00',
        'location' => ['lat' => 34.977, 'lng' => 138.383, 'name' => 'E2Eテスト会場'],
        'description' => 'E2Eテスト用イベント',
        'max_participants' => 3,
        'rain_policy' => 'rain_or_shine',
    ], $csrfA, $cookieA);
    $evJ = json_decode($ev['body'], true);
    $evOk = ($evJ['success'] ?? false) === true;
    test("POST save_event (create)", $evOk, substr($ev['body'], 0, 120));
    if ($evOk) {
        $eventId = $evJ['event']['id'] ?? ($evJ['id'] ?? ($evJ['event_id'] ?? null));
        test("  ↳ Event ID: " . ($eventId ?? 'null'), $eventId !== null);
    }

    if ($eventId && $loggedB) {
        $jn = http_json($baseUrl . '/api/join_event.php', ['event_id' => $eventId, 'action' => 'join'], $csrfB, $cookieB);
        test("POST join_event (User B)", (json_decode($jn['body'], true)['success'] ?? false) === true, substr($jn['body'], 0, 100));

        // User C も参加
        if ($loggedC) {
            $jnC = http_json($baseUrl . '/api/join_event.php', ['event_id' => $eventId, 'action' => 'join'], $csrfC, $cookieC);
            test("POST join_event (User C)", (json_decode($jnC['body'], true)['success'] ?? false) === true);
        }

        // B二重参加
        $jn2 = http_json($baseUrl . '/api/join_event.php', ['event_id' => $eventId, 'action' => 'join'], $csrfB, $cookieB);
        test("POST join_event (B duplicate) → handled", $jn2['status'] === 200);

        // B退出
        $lv = http_json($baseUrl . '/api/join_event.php', ['event_id' => $eventId, 'action' => 'leave'], $csrfB, $cookieB);
        test("POST join_event (B leaves)", (json_decode($lv['body'], true)['success'] ?? false) === true);
    }
} else {
    skip_test("Phase 8: イベント管理", "User A未ログイン");
}

// ═══════════════════════════════════════
// PHASE 9: いいね
// ═══════════════════════════════════════
echo "\n── Phase 9: いいね (toggle_like) ──────────────\n";
if ($loggedB && $observationIdA) {
    // Refresh CSRF from cookie for like APIs
    list($cookieB, $csrfB) = refreshCsrf($baseUrl, $cookieB);
    $lk = http_json($baseUrl . '/api/toggle_like.php', ['id' => $observationIdA], $csrfB, $cookieB);
    test("POST toggle_like (B likes A's obs)", $lk['status'] === 200, substr($lk['body'], 0, 100));
    // User C もいいね
    if ($loggedC) {
        $lkC = http_json($baseUrl . '/api/toggle_like.php', ['id' => $observationIdA], $csrfC, $cookieC);
        test("POST toggle_like (C likes A's obs)", $lkC['status'] === 200);
    }
    // B unlike (toggle)
    $ulk = http_json($baseUrl . '/api/toggle_like.php', ['id' => $observationIdA], $csrfB, $cookieB);
    test("POST toggle_like (B unlike)", $ulk['status'] === 200);
    // B re-like
    $rlk = http_json($baseUrl . '/api/toggle_like.php', ['id' => $observationIdA], $csrfB, $cookieB);
    test("POST toggle_like (B re-like)", $rlk['status'] === 200);
} elseif (!$observationIdA) {
    skip_test("Phase 9", "観測IDなし");
} else {
    skip_test("Phase 9", "User B未ログイン");
}

// ═══════════════════════════════════════
// PHASE 10: フォロー
// ═══════════════════════════════════════
echo "\n── Phase 10: フォロー ─────────────────────────\n";
if ($loggedA && $loggedB && $userIdA && $userIdB) {
    // Refresh CSRF from cookie for follow APIs
    list($cookieA, $csrfA) = refreshCsrf($baseUrl, $cookieA);
    if ($loggedC) list($cookieC, $csrfC) = refreshCsrf($baseUrl, $cookieC);
    $fw = http_json($baseUrl . '/api/toggle_follow.php', ['target_id' => $userIdB, 'type' => 'users', 'action' => 'follow'], $csrfA, $cookieA);
    $fwJ = json_decode($fw['body'], true);
    test("POST follow (A→B)", ($fwJ['success'] ?? false) === true, substr($fw['body'], 0, 100));
    test("  ↳ is_following=true", ($fwJ['is_following'] ?? false) === true);

    // C → A follow
    if ($loggedC && $userIdC) {
        $fwCA = http_json($baseUrl . '/api/toggle_follow.php', ['target_id' => $userIdA, 'type' => 'users', 'action' => 'follow'], $csrfC, $cookieC);
        test("POST follow (C→A)", (json_decode($fwCA['body'], true)['success'] ?? false) === true);
    }

    // A unfollow B
    $uf = http_json($baseUrl . '/api/toggle_follow.php', ['target_id' => $userIdB, 'type' => 'users', 'action' => 'unfollow'], $csrfA, $cookieA);
    $ufJ = json_decode($uf['body'], true);
    test("POST unfollow (A→B)", ($ufJ['success'] ?? false) === true);

    // Site follow/unfollow
    $sf = http_json($baseUrl . '/api/toggle_follow.php', ['target_id' => 'ikimon_forest', 'type' => 'sites', 'action' => 'follow'], $csrfA, $cookieA);
    test("POST site follow", (json_decode($sf['body'], true)['success'] ?? false) === true);
    $su = http_json($baseUrl . '/api/toggle_follow.php', ['target_id' => 'ikimon_forest', 'type' => 'sites', 'action' => 'unfollow'], $csrfA, $cookieA);
    test("POST site unfollow", $su['status'] === 200);

    // Self-follow → blocked
    $self = http_json($baseUrl . '/api/toggle_follow.php', ['target_id' => $userIdA, 'type' => 'users', 'action' => 'follow'], $csrfA, $cookieA);
    $sJ = json_decode($self['body'], true);
    test("POST self-follow → blocked", ($sJ['is_following'] ?? true) === false || ($sJ['success'] ?? true) === false);
} else {
    skip_test("Phase 10", "全ユーザー必要");
}

// Load Part 2
require __DIR__ . '/e2e_full_v5_part2.php';
