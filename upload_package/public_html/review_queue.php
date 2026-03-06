<?php

/**
 * Freetext Review Queue — 管理者用レビュー画面
 * 自由入力された種名を確認・承認・却下するUI
 */
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/FreetextReviewService.php';

Auth::init();
$currentUser = Auth::user();
if (!$currentUser || ($currentUser['role'] ?? '') !== 'admin') {
    header('Location: /');
    exit;
}

$stats = FreetextReviewService::getStats();
$queue = FreetextReviewService::getQueue();
$lang = $_GET['lang'] ?? 'ja';
$meta_title = 'Freetext レビューキュー';
?>
<!DOCTYPE html>
<html lang="<?= $lang ?>">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <style>
        .review-container {
            max-width: 1000px;
            margin: 0 auto;
            padding: 24px 16px;
        }

        .review-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            flex-wrap: wrap;
            gap: 12px;
        }

        .review-header h1 {
            font-size: 1.5rem;
            font-weight: 700;
        }

        .stats-bar {
            display: flex;
            gap: 16px;
        }

        .stat-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
        }

        .stat-badge.pending {
            background: #FEF3C7;
            color: #92400E;
        }

        .stat-badge.approved {
            background: #D1FAE5;
            color: #065F46;
        }

        .stat-badge.rejected {
            background: #FEE2E2;
            color: #991B1B;
        }

        .review-card {
            background: var(--bg-card, #fff);
            border: 1px solid var(--border, #e5e7eb);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
            display: grid;
            grid-template-columns: 80px 1fr auto;
            gap: 16px;
            align-items: center;
        }

        .review-card.status-approved {
            opacity: 0.6;
            border-color: #10B981;
        }

        .review-card.status-rejected {
            opacity: 0.5;
            border-color: #EF4444;
        }

        .review-photo {
            width: 80px;
            height: 80px;
            border-radius: 8px;
            object-fit: cover;
            background: #f3f4f6;
        }

        .review-info h3 {
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 4px;
        }

        .review-info .meta {
            font-size: 0.85rem;
            color: var(--text-muted, #6b7280);
        }

        .review-actions {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .btn-sm {
            padding: 6px 14px;
            border: none;
            border-radius: 8px;
            font-size: 0.85rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }

        .btn-approve {
            background: #10B981;
            color: #fff;
        }

        .btn-approve:hover {
            background: #059669;
        }

        .btn-reject {
            background: #EF4444;
            color: #fff;
        }

        .btn-reject:hover {
            background: #DC2626;
        }

        .btn-search {
            background: #3B82F6;
            color: #fff;
        }

        .btn-search:hover {
            background: #2563EB;
        }

        /* Search modal */
        .modal-overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 100;
            align-items: center;
            justify-content: center;
        }

        .modal-overlay.active {
            display: flex;
        }

        .modal-content {
            background: #fff;
            border-radius: 16px;
            padding: 24px;
            width: 90%;
            max-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
        }

        .modal-content h2 {
            font-size: 1.2rem;
            font-weight: 700;
            margin-bottom: 16px;
        }

        .search-input {
            width: 100%;
            padding: 10px 14px;
            border: 2px solid #e5e7eb;
            border-radius: 10px;
            font-size: 1rem;
            margin-bottom: 12px;
        }

        .candidate-list {
            list-style: none;
            padding: 0;
        }

        .candidate-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.15s;
        }

        .candidate-item:hover {
            background: #F3F4F6;
        }

        .candidate-thumb {
            width: 48px;
            height: 48px;
            border-radius: 6px;
            object-fit: cover;
        }

        .candidate-name {
            font-weight: 600;
        }

        .candidate-sci {
            font-size: 0.85rem;
            color: #6b7280;
            font-style: italic;
        }

        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #9ca3af;
        }

        .empty-state .icon {
            font-size: 3rem;
            margin-bottom: 12px;
        }

        @media (max-width: 640px) {
            .review-card {
                grid-template-columns: 60px 1fr;
            }

            .review-actions {
                grid-column: span 2;
                flex-direction: row;
            }
        }
    </style>

    <!-- CSRF Token Auto-Injection for fetch() calls -->
    <script nonce="<?= CspNonce::attr() ?>">
        (function() {
            const originalFetch = window.fetch;
            const UNSAFE_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

            function getCsrfToken() {
                const m = document.cookie.match(/(?:^|;\s*)ikimon_csrf=([a-f0-9]{64})/);
                return m ? m[1] : '';
            }
            window.fetch = function(input, init) {
                init = init || {};
                const method = (init.method || 'GET').toUpperCase();
                if (UNSAFE_METHODS.includes(method)) {
                    const token = getCsrfToken();
                    if (token) {
                        if (init.headers instanceof Headers) {
                            if (!init.headers.has('X-Csrf-Token')) init.headers.set('X-Csrf-Token', token);
                        } else if (typeof init.headers === 'object' && init.headers !== null) {
                            if (!init.headers['X-Csrf-Token']) init.headers['X-Csrf-Token'] = token;
                        } else {
                            init.headers = {
                                'X-Csrf-Token': token
                            };
                        }
                    }
                }
                return originalFetch.call(this, input, init);
            };
        })();
    </script>
</head>

<body>
    <?php include __DIR__ . '/components/header.php'; ?>

    <div class="review-container">
        <div class="review-header">
            <h1>🔍 Freetext レビューキュー</h1>
            <div class="stats-bar">
                <span class="stat-badge pending">⏳ 保留 <?= $stats['pending'] ?></span>
                <span class="stat-badge approved">✅ 承認 <?= $stats['approved'] ?></span>
                <span class="stat-badge rejected">❌ 却下 <?= $stats['rejected'] ?></span>
            </div>
        </div>

        <?php if (empty($queue)): ?>
            <div class="empty-state">
                <div class="icon">🎉</div>
                <p>レビュー待ちの投稿はありません</p>
            </div>
        <?php else: ?>
            <?php foreach ($queue as $item): ?>
                <div class="review-card status-<?= $item['status'] ?>" data-obs-id="<?= htmlspecialchars($item['observation_id']) ?>">
                    <?php if ($item['photo']): ?>
                        <img class="review-photo" src="<?= htmlspecialchars($item['photo']) ?>" alt="<?= htmlspecialchars($item['freetext_name'] ?? '観察写真') ?>">
                    <?php else: ?>
                        <div class="review-photo" style="display:flex;align-items:center;justify-content:center;font-size:2rem;">📷</div>
                    <?php endif; ?>

                    <div class="review-info">
                        <h3><?= htmlspecialchars($item['freetext_name']) ?></h3>
                        <div class="meta">
                            投稿者: <?= htmlspecialchars($item['user_name'] ?: '不明') ?>
                            ・ <?= htmlspecialchars($item['observed_at'] ?: '') ?>
                        </div>
                        <?php if ($item['status'] === 'approved' && $item['resolved_taxon']): ?>
                            <div class="meta" style="color:#059669;">
                                → <?= htmlspecialchars($item['resolved_taxon']['name'] ?? '') ?>
                                (<i><?= htmlspecialchars($item['resolved_taxon']['scientific_name'] ?? '') ?></i>)
                            </div>
                        <?php endif; ?>
                    </div>

                    <?php if ($item['status'] === 'pending'): ?>
                        <div class="review-actions">
                            <button class="btn-sm btn-search" onclick="openSearch('<?= htmlspecialchars($item['observation_id']) ?>', '<?= htmlspecialchars($item['freetext_name']) ?>')">
                                🔎 検索
                            </button>
                            <button class="btn-sm btn-reject" onclick="rejectItem('<?= htmlspecialchars($item['observation_id']) ?>')">
                                ✗ 却下
                            </button>
                        </div>
                    <?php endif; ?>
                </div>
            <?php endforeach; ?>
        <?php endif; ?>
    </div>

    <!-- Search & Approve Modal -->
    <div class="modal-overlay" id="searchModal">
        <div class="modal-content">
            <h2>🔍 正式名を検索</h2>
            <p style="font-size:0.9rem;color:#6b7280;margin-bottom:12px;">
                入力された名前: <strong id="modalFreetextName"></strong>
            </p>
            <input type="text" class="search-input" id="searchInput" placeholder="種名を入力..." oninput="debounceSearch()">
            <ul class="candidate-list" id="candidateList"></ul>
            <div style="text-align:right;margin-top:16px;">
                <button class="btn-sm" style="background:#e5e7eb;" onclick="closeSearch()">キャンセル</button>
            </div>
        </div>
    </div>

    <script nonce="<?= CspNonce::attr() ?>">
        let currentObsId = '';
        let searchTimer = null;

        function openSearch(obsId, name) {
            currentObsId = obsId;
            document.getElementById('modalFreetextName').textContent = name;
            document.getElementById('searchInput').value = name;
            document.getElementById('searchModal').classList.add('active');
            doSearch(name);
        }

        function closeSearch() {
            document.getElementById('searchModal').classList.remove('active');
            document.getElementById('candidateList').innerHTML = '';
            currentObsId = '';
        }

        function debounceSearch() {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                const q = document.getElementById('searchInput').value.trim();
                if (q.length >= 2) doSearch(q);
            }, 400);
        }

        async function doSearch(query) {
            const list = document.getElementById('candidateList');
            list.innerHTML = '<li style="padding:12px;color:#9ca3af;">検索中...</li>';

            try {
                const res = await fetch('/api/freetext_review.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'search',
                        query,
                        observation_id: currentObsId
                    })
                });
                const data = await res.json();

                if (!data.candidates || data.candidates.length === 0) {
                    list.innerHTML = '<li style="padding:12px;color:#9ca3af;">候補が見つかりません</li>';
                    return;
                }

                list.innerHTML = data.candidates.map(c => `
                <li class="candidate-item" onclick='approveWith(${JSON.stringify(c).replace(/'/g, "&#39;")})'>
                    ${c.thumbnail_url ? `<img class="candidate-thumb" src="${c.thumbnail_url}" alt="${c.common_name || c.name || '候補サムネイル'}">` : '<div class="candidate-thumb" style="background:#f3f4f6;display:flex;align-items:center;justify-content:center;">🌿</div>'}
                    <div>
                        <div class="candidate-name">${c.common_name || c.name || ''}</div>
                        <div class="candidate-sci">${c.scientific_name || ''} · ${c.source || ''}</div>
                    </div>
                </li>
            `).join('');
            } catch (e) {
                list.innerHTML = '<li style="padding:12px;color:#EF4444;">エラーが発生しました</li>';
            }
        }

        async function approveWith(taxon) {
            if (!confirm(`「${taxon.common_name || taxon.scientific_name}」として承認しますか？`)) return;

            try {
                const res = await fetch('/api/freetext_review.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'approve',
                        observation_id: currentObsId,
                        resolved_taxon: taxon
                    })
                });
                const data = await res.json();
                if (data.success) {
                    closeSearch();
                    location.reload();
                } else {
                    alert('エラー: ' + (data.message || '不明'));
                }
            } catch (e) {
                alert('通信エラー');
            }
        }

        async function rejectItem(obsId) {
            const reason = prompt('却下理由（任意）:');
            if (reason === null) return;

            try {
                const res = await fetch('/api/freetext_review.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'reject',
                        observation_id: obsId,
                        reason: reason
                    })
                });
                const data = await res.json();
                if (data.success) location.reload();
            } catch (e) {
                alert('通信エラー');
            }
        }
    </script>
</body>

</html>
