<?php

/**
 * BioBlitz Tourism Join — QRコードからのゲスト参加ページ
 *
 * Usage: bioblitz_join.php?code=HAMA26
 *
 * Flow:
 * 1. イベントコードでイベント情報を表示
 * 2. ゲスト参加ボタン（未ログインなら自動ゲスト作成）
 * 3. 参加登録後、field_research.php?site={siteId} へリダイレクト
 */

require_once __DIR__ . '/../config/config.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/EventManager.php';
require_once ROOT_DIR . '/libs/DataStore.php';

Auth::init();

$code = strtoupper(trim($_GET['code'] ?? ''));
$event = null;
$error = '';
$joined = false;

if ($code) {
    $event = EventManager::getByCode($code);
    if (!$event) {
        $error = 'イベントが見つかりませんでした。コードを確認してください。';
    } elseif (!($event['guest_allowed'] ?? false)) {
        $error = 'このイベントはゲスト参加に対応していません。ログインしてからイベントページで参加してください。';
        $event = null;
    }
}

if ($event && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!Auth::isLoggedIn()) {
        Auth::initGuest();
    }
    $user = Auth::user();

    $participants = $event['participants'] ?? [];
    $alreadyJoined = false;
    foreach ($participants as $p) {
        if (($p['user_id'] ?? '') === $user['id']) {
            $alreadyJoined = true;
            break;
        }
    }

    if (!$alreadyJoined) {
        $participants[] = [
            'user_id' => $user['id'],
            'name' => $user['name'] ?? 'Guest',
            'joined_at' => date('c'),
            'source' => 'qr_guest',
        ];
        $event['participants'] = $participants;
        DataStore::upsert('events', $event);
    }

    $siteId = $event['location']['site_id'] ?? '';
    $redirectUrl = $siteId
        ? "/field_research.php?site={$siteId}"
        : "/field_research.php";
    header("Location: {$redirectUrl}");
    exit;
}

$meta_title = $event ? htmlspecialchars($event['title'], ENT_QUOTES, 'UTF-8') . ' に参加' : 'BioBlitz に参加';
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <style>
        .join-card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(16, 185, 129, 0.15);
            border-radius: 24px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);
        }
        .join-hero {
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(245, 158, 11, 0.06));
        }
        .stat-pill {
            background: rgba(16, 185, 129, 0.08);
            border: 1px solid rgba(16, 185, 129, 0.15);
            border-radius: 12px;
            padding: 8px 14px;
        }
        .join-btn {
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            border: none;
            border-radius: 16px;
            padding: 16px 32px;
            font-size: 16px;
            font-weight: 800;
            cursor: pointer;
            width: 100%;
            transition: all 0.2s;
        }
        .join-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(16,185,129,0.3); }
        .join-btn:active { transform: translateY(0); }
        .difficulty-badge {
            display: inline-flex; align-items: center; gap: 4px;
            padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 700;
        }
        .diff-beginner { background: #d1fae5; color: #065f46; }
        .diff-intermediate { background: #fef3c7; color: #92400e; }
        .diff-advanced { background: #fee2e2; color: #991b1b; }
    </style>
</head>

<body class="js-loading pb-24 md:pb-0 font-body" style="background:var(--md-surface);color:var(--md-on-surface);">
    <?php include __DIR__ . '/components/nav.php'; ?>
    <script nonce="<?= \CspNonce::attr() ?>">document.body.classList.remove('js-loading');</script>

    <main class="pt-14 min-h-screen">
        <div class="join-hero py-12 px-4">
            <div class="max-w-lg mx-auto">

                <?php if ($error): ?>
                <!-- Error State -->
                <div class="join-card p-8 text-center">
                    <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
                        <i data-lucide="alert-circle" class="w-8 h-8 text-red-400"></i>
                    </div>
                    <h1 class="text-xl font-black mb-2">参加できませんでした</h1>
                    <p class="text-sm text-muted mb-6"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></p>
                    <a href="/" class="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
                        <i data-lucide="home" class="w-4 h-4"></i> ホームへ
                    </a>
                </div>

                <?php elseif (!$code): ?>
                <!-- Code Entry State -->
                <div class="join-card p-8 text-center">
                    <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-50 flex items-center justify-center">
                        <i data-lucide="scan" class="w-8 h-8 text-emerald-500"></i>
                    </div>
                    <h1 class="text-xl font-black mb-2">BioBlitz に参加する</h1>
                    <p class="text-sm text-muted mb-6">イベントコードを入力してください</p>
                    <form method="get" class="flex gap-2">
                        <input type="text" name="code" placeholder="例: HAMA26"
                            class="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-center text-lg font-mono font-bold uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                            maxlength="8" autocomplete="off" autofocus>
                        <button type="submit" class="px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition">
                            参加
                        </button>
                    </form>
                </div>

                <?php else: ?>
                <!-- Event Found — Join Screen -->
                <div class="join-card overflow-hidden">
                    <!-- Header -->
                    <div class="p-6 pb-4 border-b border-gray-100">
                        <div class="flex items-center gap-2 mb-3">
                            <?php
                            $diffClass = match($event['difficulty'] ?? 'beginner') {
                                'intermediate' => 'diff-intermediate',
                                'advanced' => 'diff-advanced',
                                default => 'diff-beginner',
                            };
                            $diffLabel = match($event['difficulty'] ?? 'beginner') {
                                'intermediate' => '中級',
                                'advanced' => '上級',
                                default => '初心者OK',
                            };
                            $typeLabel = ($event['event_type'] ?? '') === 'tourism_bioblitz' ? 'Tourism BioBlitz' : 'BioBlitz';
                            ?>
                            <span class="text-xs font-bold px-2 py-1 rounded-lg bg-violet-100 text-violet-700"><?= $typeLabel ?></span>
                            <span class="difficulty-badge <?= $diffClass ?>"><?= $diffLabel ?></span>
                        </div>
                        <h1 class="text-xl font-black leading-tight mb-1">
                            <?= htmlspecialchars($event['title'], ENT_QUOTES, 'UTF-8') ?>
                        </h1>
                        <?php if (!empty($event['memo'])): ?>
                        <p class="text-sm text-muted mt-2 leading-relaxed"><?= nl2br(htmlspecialchars($event['memo'], ENT_QUOTES, 'UTF-8')) ?></p>
                        <?php endif; ?>
                    </div>

                    <!-- Info Grid -->
                    <div class="p-6 pb-4 grid grid-cols-2 gap-3">
                        <div class="stat-pill">
                            <p class="text-[10px] text-gray-400 font-bold">日時</p>
                            <p class="text-sm font-bold mt-0.5">
                                <?php
                                $dateObj = new DateTime($event['event_date']);
                                $dow = ['日','月','火','水','木','金','土'][$dateObj->format('w')];
                                echo $dateObj->format('n/j') . "（{$dow}）";
                                ?>
                            </p>
                            <p class="text-xs text-muted"><?= htmlspecialchars($event['start_time'] ?? '09:00', ENT_QUOTES) ?> - <?= htmlspecialchars($event['end_time'] ?? '12:00', ENT_QUOTES) ?></p>
                        </div>
                        <div class="stat-pill">
                            <p class="text-[10px] text-gray-400 font-bold">場所</p>
                            <p class="text-sm font-bold mt-0.5"><?= htmlspecialchars($event['location']['name'] ?? '指定エリア', ENT_QUOTES, 'UTF-8') ?></p>
                            <p class="text-xs text-muted">半径 <?= $event['location']['radius_m'] ?? 500 ?>m</p>
                        </div>
                        <div class="stat-pill">
                            <p class="text-[10px] text-gray-400 font-bold">参加者</p>
                            <p class="text-sm font-bold mt-0.5"><?= count($event['participants'] ?? []) ?> 人</p>
                            <p class="text-xs text-muted">登録不要で参加OK</p>
                        </div>
                        <div class="stat-pill">
                            <p class="text-[10px] text-gray-400 font-bold">主催</p>
                            <p class="text-sm font-bold mt-0.5"><?= htmlspecialchars($event['organizer_name'] ?? '', ENT_QUOTES, 'UTF-8') ?></p>
                        </div>
                    </div>

                    <?php if (!empty($event['meeting_point'])): ?>
                    <div class="px-6 pb-4">
                        <div class="bg-amber-50 rounded-xl p-3 border border-amber-100">
                            <p class="text-xs font-bold text-amber-700 flex items-center gap-1">
                                <i data-lucide="map-pin" class="w-3 h-3"></i> 集合場所
                            </p>
                            <p class="text-sm text-amber-900 mt-1"><?= htmlspecialchars($event['meeting_point'], ENT_QUOTES, 'UTF-8') ?></p>
                        </div>
                    </div>
                    <?php endif; ?>

                    <?php if (!empty($event['target_species'])): ?>
                    <div class="px-6 pb-4">
                        <p class="text-xs font-bold text-gray-400 mb-2">目標種</p>
                        <div class="flex flex-wrap gap-1.5">
                            <?php foreach ($event['target_species'] as $sp): ?>
                            <span class="text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-medium"><?= htmlspecialchars($sp, ENT_QUOTES, 'UTF-8') ?></span>
                            <?php endforeach; ?>
                        </div>
                    </div>
                    <?php endif; ?>

                    <!-- Join Button -->
                    <div class="p-6 pt-2">
                        <form method="post">
                            <button type="submit" class="join-btn flex items-center justify-center gap-2">
                                <i data-lucide="zap" class="w-5 h-5"></i>
                                参加する（登録不要）
                            </button>
                        </form>
                        <p class="text-[11px] text-center text-gray-400 mt-3">
                            ゲストアカウントが自動作成されます。AIレンズでこのエリアを探索できます。
                        </p>
                    </div>
                </div>
                <?php endif; ?>

            </div>
        </div>
    </main>

    <?php include __DIR__ . '/components/footer.php'; ?>
    <script>lucide.createIcons();</script>
</body>

</html>
