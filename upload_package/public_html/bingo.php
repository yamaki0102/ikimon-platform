<?php
require_once __DIR__ . '/../libs/Auth.php';

Auth::init();
$currentUser = Auth::user();

// Load Real Data based on event_id
$eventId = $_GET['event_id'] ?? '';
if (!$eventId) {
    header('Location: events.php');
    exit;
}

require_once __DIR__ . '/../libs/DataStore.php';
$event = DataStore::findById('events', $eventId);

if (!$event || empty($event['bingo_template_id'])) {
    // Event doesn't exist or doesn't have bingo set up
    header('Location: event_detail.php?id=' . urlencode($eventId));
    exit;
}

$templateId = $event['bingo_template_id'];
$templatePath = DATA_DIR . '/bingo_templates/' . $templateId . '.json';
$bingoCells = [];

if (file_exists($templatePath)) {
    $tpl = json_decode(file_get_contents($templatePath), true);
    if ($tpl && isset($tpl['cells'])) {
        $bingoCells = $tpl['cells'];
    }
}

// Fallback if template is missing or malformed
if (empty($bingoCells) || count($bingoCells) < 8) {
    $bingoCells = ["タンポポ", "モンシロチョウ", "ツバメ", "スズメ", "シロツメクサ", "ダンゴムシ", "アリンコ", "テントウムシ", "カラス"];
}

// Load user's progress — matches post_observation.php storage format:
// DATA_DIR/bingo_progress/{user_id}/{template_id}.json
$userId = $currentUser ? $currentUser['id'] : 'anonymous';
$progressFile = DATA_DIR . '/bingo_progress/' . $userId . '/' . $templateId . '.json';
$progressCells = [];
if (file_exists($progressFile)) {
    $progData = json_decode(file_get_contents($progressFile), true);
    if ($progData && isset($progData['cells']) && is_array($progData['cells'])) {
        // Index by target_species for fast lookup
        foreach ($progData['cells'] as $pc) {
            $progressCells[$pc['target_species'] ?? ''] = $pc;
        }
    }
}

// Build 3x3 Grid with photos from progress data
$grid = [];
for ($i = 0; $i < 9; $i++) {
    if ($i === 4) {
        // Free space in the middle
        $grid[] = [
            'id' => 5,
            'name' => 'フリー',
            'matched' => true,
            'is_free' => true,
            'photo' => ''
        ];
    } else {
        $speciesName = array_shift($bingoCells);
        $isMatched = false;
        $photoUrl = '';

        // Check progress data (cells array from post_observation.php)
        if (isset($progressCells[$speciesName])) {
            $pc = $progressCells[$speciesName];
            if (!empty($pc['matched'])) {
                $isMatched = true;
                $photoUrl = $pc['photo_url'] ?? '';
            }
        }

        $grid[] = [
            'id' => $i < 4 ? $i + 1 : $i + 2,
            'name' => $speciesName,
            'matched' => $isMatched,
            'photo' => $photoUrl
        ];
    }
}


?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <title>生きものビンゴ - ikimon.life</title>
    <!-- GSAP for Bingo Celebrations -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>

    <style>
        .bingo-board {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            padding: 8px;
        }

        .bingo-cell {
            aspect-ratio: 1 / 1;
            position: relative;
            border-radius: 16px;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            text-align: center;
            transition: transform 0.2s, box-shadow 0.2s;
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.5);
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }

        .bingo-cell.is-free {
            background: linear-gradient(135deg, var(--color-primary-surface) 0%, #059669 100%);
            border: 1px solid var(--color-primary);
            color: white;
        }

        .bingo-cell.is-matched {
            border: 2px solid var(--color-primary);
            box-shadow: 0 0 15px rgba(16, 185, 129, 0.3);
        }

        .bingo-cell.is-matched::after {
            content: '';
            position: absolute;
            inset: 0;
            background: var(--color-primary);
            opacity: 0.1;
            pointer-events: none;
        }

        .stamp-mark {
            position: absolute;
            width: 80%;
            height: 80%;
            z-index: 10;
            opacity: 0.9;
            transform: rotate(-15deg);
            pointer-events: none;
            /* Placeholder for realistic 'Hanko' stamp CSS/SVG */
            color: #ef4444;
            /* red-500 */
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 3rem;
            font-weight: 900;
            border: 4px solid #ef4444;
            border-radius: 50%;
        }

        .bingo-cell:not(.is-matched):active {
            transform: scale(0.95);
        }

        .bingo-img {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            opacity: 0.3;
            mix-blend-mode: multiply;
        }

        .bingo-cell.is-matched .bingo-img {
            opacity: 1;
            mix-blend-mode: normal;
        }

        .line-strike {
            position: absolute;
            background: rgba(239, 68, 68, 0.8);
            z-index: 20;
            pointer-events: none;
            border-radius: 4px;
            box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
            transform-origin: left center;
        }

        /* Celebration Overlay */
        #bingoCelebration {
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 100;
            display: flex;
            align-items: center;
            justify-content: center;
            perspective: 1000px;
        }

        .bingo-text {
            font-size: 6rem;
            font-weight: 900;
            color: #fbbf24;
            /* amber-400 */
            text-shadow: 0 10px 30px rgba(245, 158, 11, 0.5), 0 0 10px white;
            opacity: 0;
            transform: scale(0.5) translateZ(-500px) rotateX(45deg);
        }

        <div class="bg-gradient-to-br from-primary-surface via-white to-accent-surface rounded-2xl p-5 mb-8 shadow-sm border border-primary/20"><div class="flex items-center gap-2 mb-2"><span class="bg-primary text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">EVENT</span><span class="text-xs font-bold text-muted"><?= htmlspecialchars($event['location']['name'] ?? '指定なし') ?></span></div><h2 class="text-xl font-black text-text leading-tight mb-2"><?= htmlspecialchars($event['title'] ?: '名称未設定イベント') ?></h2><p class="text-sm text-text-secondary leading-relaxed mb-4"><?= htmlspecialchars($event['memo'] ?? '') ?></p><div class="flex items-center gap-2 text-xs text-primary-dark font-bold bg-primary/10 rounded-lg p-3"><i data-lucide="gift" class="w-4 h-4"></i>コンプリートして自慢しよう！ </div></div>< !-- Bingo Board Container --><div class="relative bg-white/40 backdrop-blur-xl border border-white/80 rounded-3xl p-2 shadow-xl shadow-primary/5 mx-auto" style="max-width: 400px;" x-data="bingoBoard()">< !-- Background Decoration --><div class="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none"></div><div class="absolute -bottom-10 -left-10 w-32 h-32 bg-accent/10 rounded-full blur-2xl pointer-events-none"></div><div class="bingo-board relative z-10" id="bingoGrid"><?php foreach ($grid as $cell): ?><div class="bingo-cell <?= $cell['matched'] ? 'is-matched' : '' ?> <?= isset($cell['is_free']) && $cell['is_free'] ? 'is-free' : '' ?>"

        @click="triggerCell(<?= $cell['id'] ?>)"><?php if (!empty($cell['photo'])): ?><img src="<?= $cell['photo'] ?>" class="bingo-img"><?php endif; ?><div class="relative z-20 flex flex-col items-center p-2 h-full w-full">< !-- Text distinct background --><div class="w-full bg-white/90 backdrop-blur-sm py-1 px-1 rounded shadow-sm text-center"><span class="text-[11px] font-black <?= isset($cell['is_free']) && $cell['is_free'] ? 'text-primary' : 'text-text' ?> leading-tight block"><?= htmlspecialchars($cell['name']) ?></span></div></div><?php if ($cell['matched'] && empty($cell['is_free'])): ?><div class="stamp-mark" style="transform: rotate(<?= rand(-20, 20) ?>deg);">済</div><?php endif; ?><?php if (isset($cell['is_free']) && $cell['is_free']): ?><div class="absolute inset-0 flex items-center justify-center pointer-events-none"><i data-lucide="star" class="w-8 h-8 text-white opacity-80" fill="currentColor"></i></div><?php endif; ?></div><?php endforeach; ?></div></div><div class="mt-8 text-center"><p class="text-sm font-bold text-muted mb-4">写真を撮ってビンゴのマスを埋めよう！</p><a href="post_observation.php?event_id=<?= urlencode($eventId) ?>" class="btn-primary inline-flex items-center gap-2 px-8 py-4 rounded-full shadow-lg shadow-primary/30 transform hover:scale-105 transition-all text-base font-black active:scale-95"><i data-lucide="camera" class="w-5 h-5"></i>記録する </a></div></section>< !-- Celebration Container --><div id="bingoCelebration"><div class="bingo-text">BINGO !</div></div></main>< !-- Bingo Logic Script --><script nonce="<?= CspNonce::attr() ?>">function bingoBoard() {
            return {
                cells: <?= json_encode($grid) ?>,
                gridSize: 3,
                bingoLines: [],

                init() {

                    // Slight delay to allow DOM to render before checking lines
                    setTimeout(()=> {
                            this.checkForBingo();
                        }

                        , 500);
                }

                ,

                triggerCell(id) {
                    // For Mockup: Toggle matched state
                    const cell=this.cells.find(c=> c.id===id);

                    if (cell && !cell.is_free) {
                        cell.matched= !cell.matched;
                        if (window.HapticEngine) HapticEngine.light();
                        this.checkForBingo();
                    }
                }

                ,

                checkForBingo() {
                    const size=this.gridSize;
                    const grid=[];

                    // Build 2D array representation
                    for (let i=0; i < size; i++) {
                        grid[i]=[];

                        for (let j=0; j < size; j++) {
                            grid[i][j]=this.cells[i * size+j].matched;
                        }
                    }

                    let newLines=[];

                    // Check Rows & Cols
                    for (let i=0; i < size; i++) {
                        if (grid[i].every(val=> val)) newLines.push(`row-$ {
                                i
                            }

                            `);

                        if (grid.every(row=> row[i])) newLines.push(`col-$ {
                                i
                            }

                            `);
                    }

                    // Check Diagonals
                    if (grid.every((row, idx)=> row[idx])) newLines.push('diag-1');
                    if (grid.every((row, idx)=> row[size - 1 - idx])) newLines.push('diag-2');

                    // Find if there's a NEW line that wasn't there before
                    const newlyFound=newLines.filter(line=> !this.bingoLines.includes(line));

                    if (newlyFound.length > 0) {
                        this.bingoLines=newLines; // update state
                        this.drawStrikeLines(newlyFound);
                        this.celebrateBingo();
                    }
                }

                ,

                drawStrikeLines(lines) {
                    const container=document.getElementById('bingoGrid');
                    const cRect=container.getBoundingClientRect();
                    const cellSize=cRect.width / this.gridSize;

                    lines.forEach(line=> {
                            const strike=document.createElement('div');
                            strike.className='line-strike';
                            strike.style.height='12px'; // thickness

                            let lengthToDraw=cRect.width * 0.95;
                            let x=0;
                            let y=0;
                            let rotation=0;

                            if (line.startsWith ('row-')) {
                                const rowIdx=parseInt(line.split('-')[1]);
                                y=(rowIdx * cellSize) + (cellSize / 2) - 6;
                                x=cRect.width * 0.025;
                            }

                            else if (line.startsWith ('col-')) {
                                const colIdx=parseInt(line.split('-')[1]);
                                x=(colIdx * cellSize) + (cellSize / 2) - 6;
                                y=cRect.width * 0.025;
                                rotation=90;
                            }

                            else if (line==='diag-1') {
                                x=cRect.width * 0.05;
                                y=cRect.width * 0.05;
                                lengthToDraw=Math.sqrt(2 * Math.pow(cRect.width * 0.9, 2));
                                rotation=45;
                            }

                            else if (line==='diag-2') {
                                x=cRect.width * 0.95;
                                y=cRect.width * 0.05;
                                lengthToDraw=Math.sqrt(2 * Math.pow(cRect.width * 0.9, 2));
                                rotation=135;
                            }

                            // Set initial state for GCAP animation
                            gsap.set(strike, {
                                width: 0,
                                left: x,
                                top: y,
                                rotation: rotation
                            });

                        container.appendChild(strike);

                        // Animate drawing the line
                        gsap.to(strike, {
                            width: lengthToDraw,
                            duration: 0.6,
                            ease: "power3.out",
                            delay: 0.1
                        });
                });
        }

        ,

        celebrateBingo() {
            // Fire Confetti bursts
            const duration=2000;
            const end=Date.now()+duration;

            (function frame() {
                    confetti({

                        particleCount: 5,
                        angle: 60,
                        spread: 55,
                        origin: {
                            x: 0, y: 0.8
                        }

                        ,
                        colors: ['#10b981', '#f59e0b', '#3b82f6', '#ec4899']
                    });

                confetti({

                    particleCount: 5,
                    angle: 120,
                    spread: 55,
                    origin: {
                        x: 1, y: 0.8
                    }

                    ,
                    colors: ['#10b981', '#f59e0b', '#3b82f6', '#ec4899']
                });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        }

        ());

        // GSAP 3D Text Animation
        const textEl=document.querySelector('.bingo-text');

        gsap.fromTo(textEl,
            {
            opacity: 0, scale: 0.2, z: -500, rotationX: 45
        }

        ,
        {

        opacity: 1,
        scale: 1,
        z: 0,
        rotationX: 0,
        duration: 0.8,
        ease: "back.out(1.7)",
        onComplete: ()=> {

            // Float it
            gsap.to(textEl, {
                y: -20,
                duration: 1.5,
                yoyo: true,
                repeat: -1,
                ease: "sine.inOut"
            });

        // Fade out after 3 seconds
        gsap.to(textEl, {

            opacity: 0,
            delay: 3,
            duration: 1,
            onComplete: ()=> {
                gsap.killTweensOf(textEl);
            }
        });
        }
        });

        if (window.HapticEngine) HapticEngine.success();
        if (window.SoundManager) SoundManager.play('success');
        }
        }
        }

        </script></body></html>