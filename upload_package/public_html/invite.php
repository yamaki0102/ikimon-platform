<?php
/**
 * invite.php — 招待ランディングページ
 *
 * QRコード/招待リンクからの流入先。
 * 招待者の最新観察+考察ミルの価値を実際に見せて、登録を促す。
 */

require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/InviteManager.php';
require_once __DIR__ . '/../libs/PrivacyFilter.php';

Auth::init();
$currentUser = Auth::user();

// 招待コード取得
$code = trim((string)($_GET['code'] ?? ''));
$inviter = null;
$inviterObs = [];

if ($code !== '') {
    $inviter = InviteManager::resolveCode($code);

    if ($inviter) {
        // 招待コードをセッション+クッキーに保存（登録時に使用）
        $_SESSION['invite_code'] = $code;
        setcookie('invite_code', $code, time() + 86400 * 7, '/', '', true, true);

        // 招待者の最新の考察済み観察を3件取得
        $allObs = DataStore::getLatest('observations', 50, function ($item) use ($inviter) {
            if (($item['user_id'] ?? '') !== $inviter['user_id']) return false;
            $photo = $item['photos'][0] ?? '';
            if (empty($photo) || !preg_match('/^uploads\//', $photo)) return false;
            // 考察済みのものを優先
            $hasAssessment = false;
            foreach ($item['ai_assessments'] ?? [] as $a) {
                if (($a['kind'] ?? '') === 'machine_assessment' && !empty($a['summary'])) {
                    $hasAssessment = true;
                    break;
                }
            }
            return $hasAssessment;
        });
        $inviterObs = array_slice($allObs, 0, 3);
    }
}

// OGP設定
if ($inviter) {
    $meta_title = htmlspecialchars($inviter['user_name']) . 'さんからの招待';
    $meta_description = $inviter['user_name'] . 'さんがikimon.lifeで自然観察に招待しています。見つけた生き物を撮るだけで、AIが名前と見分け方を教えてくれます。';
    if (!empty($inviterObs[0]['photos'][0])) {
        $meta_image = (defined('BASE_URL') ? BASE_URL : 'https://ikimon.life') . '/' . $inviterObs[0]['photos'][0];
    }
} else {
    $meta_title = 'ikimon.life に招待されています';
    $meta_description = '自然を見る目が育つプラットフォーム。見つけた生き物を撮るだけで、AIが名前と見分け方を教えてくれます。';
}
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
</head>
<body class="font-body min-h-screen" style="background:var(--md-surface);color:var(--md-on-surface);">

<?php if (!$inviter && $code !== ''): ?>
    <!-- 無効なコード -->
    <div class="min-h-screen flex items-center justify-center px-4">
        <div class="text-center max-w-sm">
            <div class="w-20 h-20 mx-auto mb-4 bg-surface rounded-full flex items-center justify-center">
                <i data-lucide="link-2-off" class="w-10 h-10 text-muted"></i>
            </div>
            <h1 class="text-xl font-black text-text mb-2">招待リンクが見つかりません</h1>
            <p class="text-sm text-muted mb-6">リンクが間違っているか、期限切れの可能性があります。</p>
            <a href="index.php" class="inline-block px-6 py-3 rounded-full bg-primary text-white font-bold text-sm">
                ikimon.life を見てみる →
            </a>
        </div>
    </div>

<?php elseif ($inviter): ?>
    <!-- 招待ランディング -->
    <div class="min-h-screen flex flex-col">
        <!-- ヒーロー -->
        <div class="flex-1 flex flex-col items-center justify-center px-4 py-8">
            <div class="max-w-sm w-full text-center">
                <!-- 招待者アバター -->
                <div class="mb-4">
                    <img src="<?php echo htmlspecialchars($inviter['user_avatar']); ?>"
                         alt="<?php echo htmlspecialchars($inviter['user_name']); ?>"
                         class="w-16 h-16 rounded-full mx-auto border-2 border-primary shadow-lg shadow-primary/20"
                         onerror="this.src='https://i.pravatar.cc/150?u=default'">
                </div>

                <h1 class="text-xl font-black text-text mb-1">
                    <span class="text-primary"><?php echo htmlspecialchars($inviter['user_name']); ?></span> さんが
                </h1>
                <p class="text-lg font-bold text-text mb-6">自然観察に招待しています</p>

                <!-- 3つの価値提案 -->
                <div class="bg-surface rounded-2xl p-5 mb-6 text-left space-y-4">
                    <div class="flex items-start gap-3">
                        <span class="text-xl flex-shrink-0">📷</span>
                        <div>
                            <p class="text-sm font-bold text-text">見つけた生き物を撮るだけ</p>
                            <p class="text-xs text-muted">散歩中に見つけた虫、鳥、花…なんでもOK</p>
                        </div>
                    </div>
                    <div class="flex items-start gap-3">
                        <span class="text-xl flex-shrink-0">🔬</span>
                        <div>
                            <p class="text-sm font-bold text-text">AIが名前と見分け方を教える</p>
                            <p class="text-xs text-muted">「考察ミル」が写真から特徴を読み取って解説</p>
                        </div>
                    </div>
                    <div class="flex items-start gap-3">
                        <span class="text-xl flex-shrink-0">🌱</span>
                        <div>
                            <p class="text-sm font-bold text-text">自然を見る目が育っていく</p>
                            <p class="text-xs text-muted">「前より見えるようになった自分」を感じられる</p>
                        </div>
                    </div>
                </div>

                <?php if (!empty($inviterObs)): ?>
                <!-- 招待者の最新観察 -->
                <div class="mb-6">
                    <p class="text-[10px] font-black text-muted uppercase tracking-widest mb-3">
                        <?php echo htmlspecialchars($inviter['user_name']); ?> さんの最近の観察
                    </p>
                    <div class="flex gap-2 justify-center">
                        <?php foreach ($inviterObs as $obs): ?>
                            <?php $photo = $obs['photos'][0] ?? ''; ?>
                            <?php if ($photo): ?>
                                <div class="relative group">
                                    <img src="<?php echo htmlspecialchars($photo); ?>"
                                         alt="観察写真"
                                         class="w-24 h-24 rounded-xl object-cover border border-border shadow-sm"
                                         loading="lazy"
                                         onerror="this.parentElement.style.display='none'">
                                    <?php
                                    $taxonName = $obs['taxon']['name'] ?? '';
                                    if ($taxonName): ?>
                                        <span class="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] font-bold px-1 py-0.5 rounded-b-xl truncate">
                                            <?php echo htmlspecialchars($taxonName); ?>
                                        </span>
                                    <?php endif; ?>
                                </div>
                            <?php endif; ?>
                        <?php endforeach; ?>
                    </div>
                    <?php
                    // 考察サマリーを1つ表示
                    $sampleSummary = '';
                    foreach ($inviterObs as $obs) {
                        foreach ($obs['ai_assessments'] ?? [] as $a) {
                            if (($a['kind'] ?? '') === 'machine_assessment') {
                                $sampleSummary = $a['simple_summary'] ?? $a['summary'] ?? '';
                                break 2;
                            }
                        }
                    }
                    if ($sampleSummary):
                    ?>
                    <div class="mt-3 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-xl p-3 text-left">
                        <p class="text-[10px] font-black text-sky-700 dark:text-sky-400 uppercase tracking-widest mb-1">考察ミルの例</p>
                        <p class="text-xs text-sky-800 dark:text-sky-300 leading-relaxed line-clamp-3"><?php echo htmlspecialchars($sampleSummary); ?></p>
                    </div>
                    <?php endif; ?>
                </div>
                <?php endif; ?>

                <!-- CTA -->
                <?php if ($currentUser): ?>
                    <a href="index.php"
                       class="block w-full py-4 rounded-full bg-gradient-to-r from-primary to-accent text-white font-black text-center shadow-lg shadow-primary/20 active:scale-95 transition">
                        ホームに行く →
                    </a>
                <?php else: ?>
                    <a href="login.php?redirect=<?php echo urlencode('post.php'); ?>"
                       class="block w-full py-4 rounded-full bg-gradient-to-r from-primary to-accent text-white font-black text-center shadow-lg shadow-primary/20 active:scale-95 transition">
                        始めてみる →
                    </a>
                    <p class="text-[11px] text-faint mt-3">無料で始められます・メールアドレスで登録</p>
                <?php endif; ?>
            </div>
        </div>

        <!-- フッター -->
        <div class="text-center pb-6">
            <p class="text-xs text-faint">
                <a href="index.php" class="hover:text-text transition">ikimon.life</a>
                — 自然を見る目が育つプラットフォーム
            </p>
        </div>
    </div>

<?php else: ?>
    <!-- コードなし: ikimon.lifeの紹介 -->
    <div class="min-h-screen flex items-center justify-center px-4">
        <div class="text-center max-w-sm">
            <div class="w-20 h-20 mx-auto mb-4 bg-primary-surface rounded-full flex items-center justify-center">
                <span class="text-3xl">🌿</span>
            </div>
            <h1 class="text-xl font-black text-text mb-2">ikimon.life</h1>
            <p class="text-sm text-muted mb-6">自然を見る目が育つプラットフォーム</p>
            <a href="index.php" class="inline-block px-6 py-3 rounded-full bg-primary text-white font-bold text-sm">
                始めてみる →
            </a>
        </div>
    </div>
<?php endif; ?>

</body>
</html>
