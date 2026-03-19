<?php
/**
 * Admin: Literature Review — Human-in-the-Loop 文献レビューUI
 *
 * AI蒸留結果を人間が検証・承認するインターフェース。
 * Phase 2: 知識の品質ゲート。
 *
 * 機能:
 *   - 蒸留済み知識の承認/修正/却下
 *   - 論文メタデータの確認
 *   - 学名-論文マッピングの検証
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/PaperStore.php';
require_once __DIR__ . '/../../libs/OmoikaneDB.php';

Auth::init();
Auth::requireRole('Analyst');

$currentUser = Auth::user();

// --- データ取得 ---
$db = new OmoikaneDB();
$pdo = $db->getPDO();

// 統計
$stats = [
    'total_papers' => 0,
    'pending_distill' => 0,
    'distilled' => 0,
    'reviewed' => 0,
];

try {
    $stats['total_papers'] = (int) $pdo->query("SELECT COUNT(*) FROM papers")->fetchColumn();
    $stats['pending_distill'] = (int) $pdo->query("SELECT COUNT(*) FROM papers WHERE distill_status = 'pending'")->fetchColumn();
    $stats['distilled'] = (int) $pdo->query("SELECT COUNT(*) FROM papers WHERE distill_status = 'distilled'")->fetchColumn();
    $stats['reviewed'] = (int) $pdo->query("SELECT COUNT(*) FROM distilled_knowledge WHERE reviewed_by IS NOT NULL")->fetchColumn();
} catch (PDOException $e) {
    // テーブルがない場合はゼロのまま
}

// レビュー待ち知識（最新20件）
$pendingKnowledge = [];
try {
    $stmt = $pdo->query("
        SELECT dk.*, p.title as paper_title, p.journal, p.year, p.url as paper_url
        FROM distilled_knowledge dk
        LEFT JOIN papers p ON dk.doi = p.doi
        WHERE dk.reviewed_by IS NULL
        ORDER BY dk.created_at DESC
        LIMIT 20
    ");
    $pendingKnowledge = $stmt->fetchAll();
} catch (PDOException $e) {
    // 空のまま
}

// 最近の論文（最新10件）
$recentPapers = [];
try {
    $stmt = $pdo->query("
        SELECT p.*, COUNT(pt.taxon_key) as taxon_count
        FROM papers p
        LEFT JOIN paper_taxa pt ON p.doi = pt.doi
        GROUP BY p.doi
        ORDER BY p.ingested_at DESC
        LIMIT 10
    ");
    $recentPapers = $stmt->fetchAll();
} catch (PDOException $e) {
    // 空のまま
}

// --- POST処理: レビューアクション ---
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($_POST['action'])) {
    $action = $_POST['action'];
    $knowledgeId = (int) ($_POST['knowledge_id'] ?? 0);
    $reviewerId = $currentUser['id'] ?? 'unknown';

    if ($knowledgeId > 0) {
        try {
            if ($action === 'approve') {
                $stmt = $pdo->prepare("UPDATE distilled_knowledge SET reviewed_by = :reviewer WHERE id = :id");
                $stmt->execute([':reviewer' => $reviewerId, ':id' => $knowledgeId]);
            } elseif ($action === 'reject') {
                $stmt = $pdo->prepare("DELETE FROM distilled_knowledge WHERE id = :id AND reviewed_by IS NULL");
                $stmt->execute([':id' => $knowledgeId]);
            } elseif ($action === 'edit') {
                $newContent = $_POST['content'] ?? '';
                if ($newContent) {
                    $stmt = $pdo->prepare("UPDATE distilled_knowledge SET content = :content, reviewed_by = :reviewer WHERE id = :id");
                    $stmt->execute([':content' => $newContent, ':reviewer' => $reviewerId, ':id' => $knowledgeId]);
                }
            }
        } catch (PDOException $e) {
            // エラーハンドリング
        }

        header('Location: ' . $_SERVER['REQUEST_URI']);
        exit;
    }
}
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>文献レビュー | ikimon.life Admin</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
</head>
<body class="bg-gray-50 min-h-screen">

<!-- ヘッダー -->
<header class="bg-white border-b sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
            <a href="/admin/" class="text-gray-500 hover:text-gray-700">
                <i data-lucide="arrow-left" class="w-5 h-5"></i>
            </a>
            <h1 class="text-lg font-bold">文献レビュー</h1>
            <span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Phase 2</span>
        </div>
    </div>
</header>

<main class="max-w-7xl mx-auto px-4 py-6 space-y-6">

    <!-- 統計カード -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-xl border p-4">
            <div class="text-2xl font-bold"><?= number_format($stats['total_papers']) ?></div>
            <div class="text-sm text-gray-500">総論文数</div>
        </div>
        <div class="bg-white rounded-xl border p-4">
            <div class="text-2xl font-bold text-amber-600"><?= number_format($stats['pending_distill']) ?></div>
            <div class="text-sm text-gray-500">蒸留待ち</div>
        </div>
        <div class="bg-white rounded-xl border p-4">
            <div class="text-2xl font-bold text-blue-600"><?= number_format($stats['distilled']) ?></div>
            <div class="text-sm text-gray-500">蒸留済み</div>
        </div>
        <div class="bg-white rounded-xl border p-4">
            <div class="text-2xl font-bold text-green-600"><?= number_format($stats['reviewed']) ?></div>
            <div class="text-sm text-gray-500">レビュー済み</div>
        </div>
    </div>

    <!-- レビュー待ち知識 -->
    <section>
        <h2 class="text-lg font-bold mb-3 flex items-center gap-2">
            <i data-lucide="eye" class="w-5 h-5 text-amber-500"></i>
            レビュー待ち
            <?php if (count($pendingKnowledge) > 0): ?>
                <span class="text-sm bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full"><?= count($pendingKnowledge) ?>件</span>
            <?php endif; ?>
        </h2>

        <?php if (empty($pendingKnowledge)): ?>
            <div class="bg-white rounded-xl border p-8 text-center text-gray-400">
                <i data-lucide="check-circle-2" class="w-12 h-12 mx-auto mb-2"></i>
                <p>レビュー待ちの知識はありません</p>
            </div>
        <?php else: ?>
            <div class="space-y-3">
                <?php foreach ($pendingKnowledge as $k): ?>
                    <div class="bg-white rounded-xl border p-4" x-data="{ editing: false }">
                        <div class="flex items-start justify-between gap-4">
                            <div class="flex-1 min-w-0">
                                <!-- 論文情報 -->
                                <div class="text-xs text-gray-400 mb-1">
                                    <?= htmlspecialchars($k['paper_title'] ?? $k['doi'] ?? '不明', ENT_QUOTES) ?>
                                    <?php if ($k['year']): ?>
                                        <span class="ml-1">(<?= (int) $k['year'] ?>)</span>
                                    <?php endif; ?>
                                </div>

                                <!-- 知識タイプ -->
                                <span class="inline-block text-xs px-2 py-0.5 rounded-full mb-2 <?php
                                    echo match ($k['knowledge_type']) {
                                        'ecological_constraint' => 'bg-green-100 text-green-700',
                                        'identification_key'    => 'bg-blue-100 text-blue-700',
                                        'habitat'               => 'bg-emerald-100 text-emerald-700',
                                        default                 => 'bg-gray-100 text-gray-700',
                                    };
                                ?>">
                                    <?= htmlspecialchars($k['knowledge_type'], ENT_QUOTES) ?>
                                </span>
                                <span class="text-xs text-gray-400 ml-1">
                                    <?= htmlspecialchars($k['taxon_key'], ENT_QUOTES) ?>
                                </span>

                                <!-- 内容 -->
                                <div x-show="!editing" class="text-sm mt-1 whitespace-pre-wrap">
                                    <?= htmlspecialchars(mb_substr($k['content'] ?? '', 0, 300), ENT_QUOTES) ?>
                                    <?= mb_strlen($k['content'] ?? '') > 300 ? '...' : '' ?>
                                </div>

                                <!-- 編集フォーム -->
                                <form x-show="editing" method="POST" class="mt-2">
                                    <input type="hidden" name="action" value="edit">
                                    <input type="hidden" name="knowledge_id" value="<?= (int) $k['id'] ?>">
                                    <textarea name="content" rows="4"
                                        class="w-full border rounded-lg p-2 text-sm"
                                    ><?= htmlspecialchars($k['content'] ?? '', ENT_QUOTES) ?></textarea>
                                    <div class="flex gap-2 mt-2">
                                        <button type="submit" class="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">保存</button>
                                        <button type="button" @click="editing = false" class="px-3 py-1 bg-gray-200 text-sm rounded-lg hover:bg-gray-300">キャンセル</button>
                                    </div>
                                </form>

                                <!-- 信頼度 -->
                                <?php if (isset($k['confidence'])): ?>
                                    <div class="mt-1 text-xs text-gray-400">
                                        信頼度: <?= round($k['confidence'] * 100) ?>%
                                    </div>
                                <?php endif; ?>
                            </div>

                            <!-- アクションボタン -->
                            <div class="flex flex-col gap-1.5 shrink-0" x-show="!editing">
                                <form method="POST" class="inline">
                                    <input type="hidden" name="action" value="approve">
                                    <input type="hidden" name="knowledge_id" value="<?= (int) $k['id'] ?>">
                                    <button type="submit" class="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 text-sm rounded-lg hover:bg-green-100 border border-green-200" title="承認">
                                        <i data-lucide="check" class="w-4 h-4"></i> 承認
                                    </button>
                                </form>
                                <button @click="editing = true" class="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 text-sm rounded-lg hover:bg-blue-100 border border-blue-200" title="修正">
                                    <i data-lucide="pencil" class="w-4 h-4"></i> 修正
                                </button>
                                <form method="POST" class="inline" onsubmit="return confirm('この知識を却下しますか？')">
                                    <input type="hidden" name="action" value="reject">
                                    <input type="hidden" name="knowledge_id" value="<?= (int) $k['id'] ?>">
                                    <button type="submit" class="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 text-sm rounded-lg hover:bg-red-100 border border-red-200" title="却下">
                                        <i data-lucide="x" class="w-4 h-4"></i> 却下
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </section>

    <!-- 最近の論文 -->
    <section>
        <h2 class="text-lg font-bold mb-3 flex items-center gap-2">
            <i data-lucide="book-open" class="w-5 h-5 text-blue-500"></i>
            最近取り込まれた論文
        </h2>

        <?php if (empty($recentPapers)): ?>
            <div class="bg-white rounded-xl border p-8 text-center text-gray-400">
                <i data-lucide="book-x" class="w-12 h-12 mx-auto mb-2"></i>
                <p>論文がまだ取り込まれていません</p>
            </div>
        <?php else: ?>
            <div class="bg-white rounded-xl border divide-y">
                <?php foreach ($recentPapers as $p): ?>
                    <div class="p-4 hover:bg-gray-50">
                        <div class="flex items-start justify-between gap-3">
                            <div class="flex-1 min-w-0">
                                <div class="font-medium text-sm truncate">
                                    <?php if ($p['url']): ?>
                                        <a href="<?= htmlspecialchars($p['url'], ENT_QUOTES) ?>" target="_blank" rel="noopener" class="text-blue-600 hover:underline">
                                            <?= htmlspecialchars($p['title'] ?: '(無題)', ENT_QUOTES) ?>
                                        </a>
                                    <?php else: ?>
                                        <?= htmlspecialchars($p['title'] ?: '(無題)', ENT_QUOTES) ?>
                                    <?php endif; ?>
                                </div>
                                <div class="text-xs text-gray-400 mt-0.5">
                                    <?= htmlspecialchars($p['journal'] ?? '', ENT_QUOTES) ?>
                                    <?php if ($p['year']): ?>(<?= (int) $p['year'] ?>)<?php endif; ?>
                                    &middot; <?= htmlspecialchars($p['source'] ?? '', ENT_QUOTES) ?>
                                    &middot; <?= (int) $p['taxon_count'] ?> taxa
                                </div>
                            </div>
                            <span class="shrink-0 text-xs px-2 py-0.5 rounded-full <?php
                                echo match ($p['distill_status'] ?? 'pending') {
                                    'distilled' => 'bg-green-100 text-green-700',
                                    'pending'   => 'bg-amber-100 text-amber-700',
                                    'failed'    => 'bg-red-100 text-red-700',
                                    default     => 'bg-gray-100 text-gray-700',
                                };
                            ?>">
                                <?= htmlspecialchars($p['distill_status'] ?? 'pending', ENT_QUOTES) ?>
                            </span>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </section>

</main>

<script>
    lucide.createIcons();
</script>
</body>
</html>
