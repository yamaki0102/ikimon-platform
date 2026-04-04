<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';

Auth::init();
$currentUser = Auth::user();
$eventId = $_GET['event_id'] ?? '';
if (!$eventId) {
    header('Location: events.php');
    exit;
}

$event = DataStore::findById('events', $eventId);
if (!$event || empty($event['bingo_template_id'])) {
    header('Location: event_detail.php?id=' . urlencode($eventId));
    exit;
}

$template = DataStore::get('bingo_templates/' . $event['bingo_template_id']);
$bingoCells = is_array($template['cells'] ?? null) ? $template['cells'] : [];
if (count($bingoCells) < 8) {
    $bingoCells = ['タンポポ', 'モンシロチョウ', 'ツバメ', 'スズメ', 'シロツメクサ', 'ダンゴムシ', 'アリンコ', 'テントウムシ'];
}
$bingoCells = array_values(array_slice($bingoCells, 0, 8));

$userId = $currentUser['id'] ?? (Auth::isGuest() ? Auth::getGuestId() : 'anonymous');
$progress = DataStore::get('bingo_progress/' . $userId . '/' . $event['bingo_template_id'], 60);
$progressCells = [];
foreach (($progress['cells'] ?? []) as $cell) {
    $name = trim((string)($cell['target_species'] ?? ''));
    if ($name !== '') {
        $progressCells[$name] = $cell;
    }
}

$grid = [];
$cellId = 1;
for ($row = 0; $row < 3; $row++) {
    for ($col = 0; $col < 3; $col++) {
        if ($row === 1 && $col === 1) {
            $grid[] = [
                'id' => $cellId++,
                'name' => 'フリー',
                'matched' => true,
                'is_free' => true,
                'photo' => '',
            ];
            continue;
        }

        $name = array_shift($bingoCells) ?? 'いきもの';
        $matched = !empty($progressCells[$name]['matched']);
        $photo = $progressCells[$name]['photo_url'] ?? '';
        $grid[] = [
            'id' => $cellId++,
            'name' => $name,
            'matched' => $matched,
            'is_free' => false,
            'photo' => $photo,
        ];
    }
}

$meta_title = 'イベントビンゴ';
$meta_description = ($event['title'] ?? 'イベント') . ' のビンゴカード';
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>
    <style>
        .bingo-shell {
            max-width: 720px;
            margin: 0 auto;
            padding: 1rem 1rem 6rem;
        }

        .bingo-hero {
            position: relative;
            overflow: hidden;
            border-radius: 1.75rem;
            padding: 1.25rem;
            background:
                radial-gradient(circle at top right, rgba(16, 185, 129, 0.18), transparent 32%),
                radial-gradient(circle at bottom left, rgba(59, 130, 246, 0.14), transparent 28%),
                linear-gradient(135deg, #f3fbf7 0%, #ffffff 42%, #eef8ff 100%);
            border: 1px solid rgba(16, 185, 129, 0.12);
            box-shadow: 0 20px 40px rgba(15, 23, 42, 0.06);
        }

        .bingo-board {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.75rem;
            margin-top: 1.25rem;
        }

        .bingo-cell {
            position: relative;
            aspect-ratio: 1 / 1;
            border-radius: 1.25rem;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.7);
            background: rgba(255, 255, 255, 0.62);
            backdrop-filter: blur(12px);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.65), 0 10px 28px rgba(15, 23, 42, 0.08);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .bingo-cell:hover {
            transform: translateY(-2px);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.65), 0 16px 34px rgba(15, 23, 42, 0.12);
        }

        .bingo-cell.is-matched {
            border-color: rgba(16, 185, 129, 0.5);
        }

        .bingo-cell.is-free {
            background: linear-gradient(135deg, #10b981 0%, #0f766e 100%);
            color: #fff;
        }

        .bingo-photo {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            opacity: 0.22;
        }

        .bingo-cell.is-matched .bingo-photo {
            opacity: 0.95;
        }

        .bingo-overlay {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding: 0.75rem;
            background: linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(15,23,42,0.4) 100%);
        }

        .bingo-label {
            width: 100%;
            padding: 0.5rem 0.4rem;
            border-radius: 0.85rem;
            text-align: center;
            font-size: 0.8rem;
            line-height: 1.35;
            font-weight: 900;
            background: rgba(255,255,255,0.88);
            color: #111827;
        }

        .bingo-cell.is-free .bingo-label {
            background: rgba(255,255,255,0.16);
            color: #fff;
        }

        .stamp {
            position: absolute;
            inset: 16% 16%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 4px solid rgba(239, 68, 68, 0.9);
            border-radius: 9999px;
            color: rgba(239, 68, 68, 0.92);
            font-size: 2.25rem;
            font-weight: 900;
            transform: rotate(-14deg);
            pointer-events: none;
            text-shadow: 0 0 12px rgba(255,255,255,0.3);
        }

        .strike-line {
            position: absolute;
            border-radius: 9999px;
            background: rgba(239, 68, 68, 0.88);
            box-shadow: 0 0 18px rgba(239, 68, 68, 0.35);
            transform-origin: left center;
            pointer-events: none;
            z-index: 20;
        }

        .bingo-celebration {
            position: fixed;
            inset: 0;
            pointer-events: none;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100;
        }

        .bingo-celebration-text {
            font-family: "Montserrat", "Zen Kaku Gothic New", sans-serif;
            font-size: clamp(3rem, 10vw, 6rem);
            font-weight: 900;
            color: #f59e0b;
            text-shadow: 0 14px 40px rgba(245, 158, 11, 0.35);
            opacity: 0;
        }
    </style>
</head>

<body class="font-body min-h-screen pb-24 safe-area-inset-bottom" style="background:var(--md-surface);color:var(--md-on-surface);">
    <?php include __DIR__ . '/components/nav.php'; ?>
    <div style="height: calc(var(--nav-height, 56px) + var(--safe-top, 0px))"></div>

    <main class="bingo-shell" x-data="bingoBoard()">
        <div class="flex items-center gap-3 mb-4">
            <a href="event_detail.php?id=<?php echo urlencode($eventId); ?>" class="size-10 rounded-full flex items-center justify-center" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);color:var(--md-on-surface-variant);">
                <i data-lucide="arrow-left" class="w-5 h-5"></i>
            </a>
            <div>
                <p class="text-[10px] font-black tracking-[0.24em] text-emerald-600 uppercase">Event Bingo</p>
                <h1 class="text-lg font-black text-gray-900"><?php echo htmlspecialchars($event['title'] ?? 'イベントビンゴ'); ?></h1>
            </div>
        </div>

        <section class="bingo-hero">
            <div class="flex items-start justify-between gap-4">
                <div>
                    <p class="text-xs font-bold text-gray-500"><?php echo htmlspecialchars($event['location']['name'] ?? '指定なし'); ?></p>
                    <p class="text-sm text-gray-600 mt-2 leading-relaxed"><?php echo htmlspecialchars($event['memo'] ?? '見つけたらマスが埋まる、イベント専用のビンゴカードです。'); ?></p>
                </div>
                <div class="rounded-full bg-emerald-100 text-emerald-700 text-xs font-black px-3 py-2 whitespace-nowrap">
                    達成 <span x-text="matchedCount()"></span>/9
                </div>
            </div>

            <div class="relative" id="bingoGrid">
                <div class="bingo-board">
                    <?php foreach ($grid as $cell): ?>
                        <div class="bingo-cell <?php echo $cell['matched'] ? 'is-matched' : ''; ?> <?php echo $cell['is_free'] ? 'is-free' : ''; ?>" data-cell-id="<?php echo (int)$cell['id']; ?>">
                            <?php if (!empty($cell['photo'])): ?>
                                <img src="<?php echo htmlspecialchars($cell['photo']); ?>" alt="<?php echo htmlspecialchars($cell['name']); ?>" class="bingo-photo">
                            <?php endif; ?>
                            <div class="bingo-overlay">
                                <div class="bingo-label"><?php echo htmlspecialchars($cell['name']); ?></div>
                            </div>
                            <?php if ($cell['matched'] && !$cell['is_free']): ?>
                                <div class="stamp">済</div>
                            <?php endif; ?>
                            <?php if ($cell['is_free']): ?>
                                <div class="absolute inset-0 flex items-center justify-center text-4xl">★</div>
                            <?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>

            <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                <a href="post.php?event_id=<?php echo urlencode($eventId); ?>&event_name=<?php echo urlencode($event['title'] ?? ''); ?>" class="block text-center rounded-2xl bg-emerald-500 text-white font-black py-3.5 shadow-lg shadow-emerald-500/20">
                    📸 このイベントで記録する
                </a>
                <a href="event_detail.php?id=<?php echo urlencode($eventId); ?>" class="block text-center rounded-2xl font-black py-3.5" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);color:var(--md-on-surface);">
                    参加ページへ戻る
                </a>
            </div>
        </section>

        <section class="mt-5" style="border-radius:var(--shape-xl);background:var(--md-surface-container);border:1px solid var(--md-outline-variant);padding:1.25rem;box-shadow:var(--elev-1);">
            <h2 class="text-sm font-black text-gray-900 mb-3">遊び方</h2>
            <div class="mb-4">
                <div class="flex items-center justify-between text-xs font-bold text-gray-500 mb-2">
                    <span>コンプリート進捗</span>
                    <span x-text="Math.round((matchedCount() / cells.length) * 100) + '%'"></span>
                </div>
                <div class="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div class="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-500" :style="`width:${(matchedCount() / cells.length) * 100}%`"></div>
                </div>
            </div>
            <ul class="space-y-2 text-sm text-gray-600">
                <li>このイベントで観察を投稿すると、対応するマスが自動で埋まります。</li>
                <li>中央のフリーマスは最初から達成済みです。</li>
                <li>縦・横・斜めの 1 列がそろうと演出が表示されます。</li>
            </ul>
        </section>

        <div class="bingo-celebration" id="bingoCelebration">
            <div class="bingo-celebration-text">BINGO!</div>
        </div>
    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        function bingoBoard() {
            return {
                cells: <?php echo json_encode($grid, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG); ?>,
                bingoLines: [],

                init() {
                    this.$nextTick(() => {
                        this.checkForBingo();
                    });
                },

                matched(index) {
                    return !!this.cells[index]?.matched;
                },

                matchedCount() {
                    return this.cells.filter((cell) => cell.matched).length;
                },

                checkForBingo() {
                    const patterns = [
                        { key: 'row-0', cells: [0, 1, 2] },
                        { key: 'row-1', cells: [3, 4, 5] },
                        { key: 'row-2', cells: [6, 7, 8] },
                        { key: 'col-0', cells: [0, 3, 6] },
                        { key: 'col-1', cells: [1, 4, 7] },
                        { key: 'col-2', cells: [2, 5, 8] },
                        { key: 'diag-1', cells: [0, 4, 8] },
                        { key: 'diag-2', cells: [2, 4, 6] },
                    ];

                    const found = patterns
                        .filter((pattern) => pattern.cells.every((idx) => this.matched(idx)))
                        .map((pattern) => pattern.key);

                    const newlyFound = found.filter((line) => !this.bingoLines.includes(line));
                    this.bingoLines = found;
                    if (newlyFound.length > 0) {
                        this.drawStrikeLines(found);
                        this.celebrate();
                    } else {
                        this.drawStrikeLines(found);
                    }
                },

                drawStrikeLines(lines) {
                    const container = document.getElementById('bingoGrid');
                    if (!container) return;

                    container.querySelectorAll('.strike-line').forEach((line) => line.remove());
                    const rect = container.getBoundingClientRect();
                    const board = container.querySelector('.bingo-board');
                    if (!board) return;
                    const boardRect = board.getBoundingClientRect();
                    const size = boardRect.width / 3;

                    lines.forEach((line) => {
                        const el = document.createElement('div');
                        el.className = 'strike-line';
                        el.style.height = '10px';

                        let width = boardRect.width * 0.94;
                        let left = boardRect.left - rect.left + boardRect.width * 0.03;
                        let top = boardRect.top - rect.top;
                        let rotation = 0;

                        if (line.startsWith('row-')) {
                            const row = Number(line.split('-')[1]);
                            top += row * size + size / 2 - 5;
                        } else if (line.startsWith('col-')) {
                            const col = Number(line.split('-')[1]);
                            left += col * size + size / 2 - 5;
                            top += boardRect.width * 0.03;
                            rotation = 90;
                        } else if (line === 'diag-1') {
                            left += boardRect.width * 0.04;
                            top += boardRect.width * 0.04;
                            width = Math.sqrt(2 * Math.pow(boardRect.width * 0.92, 2));
                            rotation = 45;
                        } else if (line === 'diag-2') {
                            left += boardRect.width * 0.96;
                            top += boardRect.width * 0.04;
                            width = Math.sqrt(2 * Math.pow(boardRect.width * 0.92, 2));
                            rotation = 135;
                        }

                        el.style.left = `${left}px`;
                        el.style.top = `${top}px`;
                        el.style.width = `${width}px`;
                        el.style.transform = `rotate(${rotation}deg)`;
                        container.appendChild(el);
                    });
                },

                celebrate() {
                    if (typeof confetti === 'function') {
                        confetti({
                            particleCount: 140,
                            spread: 85,
                            origin: { y: 0.65 },
                            colors: ['#10b981', '#f59e0b', '#3b82f6', '#ef4444'],
                        });
                    }

                    const textEl = document.querySelector('.bingo-celebration-text');
                    if (textEl && typeof gsap !== 'undefined') {
                        gsap.killTweensOf(textEl);
                        gsap.fromTo(textEl, {
                            opacity: 0,
                            scale: 0.5,
                            y: 40,
                        }, {
                            opacity: 1,
                            scale: 1,
                            y: 0,
                            duration: 0.45,
                            ease: 'back.out(1.7)',
                            onComplete: () => {
                                gsap.to(textEl, {
                                    opacity: 0,
                                    y: -16,
                                    delay: 1.2,
                                    duration: 0.5,
                                });
                            }
                        });
                    }

                    if (window.HapticEngine) window.HapticEngine.success();
                    if (window.SoundManager) window.SoundManager.play('success');
                },
            };
        }
    </script>
</body>

</html>
