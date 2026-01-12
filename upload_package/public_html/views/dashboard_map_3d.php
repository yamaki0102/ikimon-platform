<div class="w-full h-full relative overflow-hidden bg-[var(--color-bg-base)] text-sans flex flex-col" 
     x-data="simulation3d()">

    <!-- Header -->
    <div class="absolute top-0 left-0 right-0 z-20 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div>
            <h1 class="text-2xl font-black text-white font-heading tracking-wider flex items-center gap-3">
                <div class="p-2 bg-purple-500/20 rounded-lg text-purple-400 border border-purple-500/30">
                    <i data-lucide="scan-line" class="w-6 h-6"></i>
                </div>
                3Dボクセル解析エンジン <span class="text-xs bg-purple-500 text-black px-2 py-0.5 rounded font-bold">Pro版 (β)</span>
            </h1>
            <p class="text-xs text-purple-300/50 font-mono mt-1 ml-14">点群データ処理システム v2.1</p>
        </div>
        <a href="?view=system" class="pointer-events-auto flex items-center gap-2 text-xs text-gray-500 hover:text-white transition">
            <i data-lucide="arrow-left" class="w-4 h-4"></i> 戻る
        </a>
    </div>

    <!-- Main Stage -->
    <div class="flex-1 relative flex items-center justify-center">
        
        <!-- Background Grid -->
        <div class="absolute inset-0 z-0 opacity-20" 
             style="background-image: linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px); background-size: 40px 40px; transform: perspective(500px) rotateX(60deg);">
        </div>

        <!-- STAGE 1: UPLOAD (Idle) -->
        <div x-show="state === 'idle'" 
             x-transition:enter="transition ease-out duration-500"
             x-transition:enter-start="opacity-0 scale-95"
             x-transition:enter-end="opacity-100 scale-100"
             class="relative z-10 w-full max-w-2xl p-8">
            
            <div class="border-2 border-dashed border-gray-700 bg-gray-900/50 rounded-3xl p-16 text-center hover:border-purple-500/50 hover:bg-purple-900/10 transition cursor-pointer group relative overflow-hidden"
                 @dragover.prevent="dragOver = true"
                 @dragleave.prevent="dragOver = false"
                 @drop.prevent="handleDrop"
                 @click="startSimulation">
                
                <div class="absolute inset-0 bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl"></div>
                
                <div class="relative z-10 space-y-6">
                    <div class="w-24 h-24 mx-auto bg-gray-800 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-xl group-hover:shadow-purple-500/20">
                        <i data-lucide="upload-cloud" class="w-10 h-10 text-gray-400 group-hover:text-purple-400 transition-colors"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-bold text-white mb-2">点群データをアップロード</h3>
                        <p class="text-gray-400 text-sm">または、クリックしてデモデータをロード</p>
                    </div>
                    <div class="flex justify-center gap-2 text-[10px] font-mono text-gray-600 uppercase">
                        <span class="bg-gray-800 px-2 py-1 rounded">.LAS</span>
                        <span class="bg-gray-800 px-2 py-1 rounded">.LAZ</span>
                        <span class="bg-gray-800 px-2 py-1 rounded">.PLY</span>
                        <span class="bg-gray-800 px-2 py-1 rounded">.E57</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- STAGE 2: PROCESSING (Animating) -->
        <div x-show="state === 'processing'" class="relative z-10 text-center w-full max-w-xl">
            <!-- Center Loader -->
            <div class="relative w-48 h-48 mx-auto mb-8">
                <!-- Rings -->
                <div class="absolute inset-0 border-4 border-purple-500/20 rounded-full animate-[spin_3s_linear_infinite]"></div>
                <div class="absolute inset-4 border-4 border-t-purple-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-[spin_2s_linear_infinite]"></div>
                <div class="absolute inset-8 border-4 border-t-transparent border-r-blue-500 border-b-transparent border-l-transparent rounded-full animate-[spin_1.5s_linear_infinite_reverse]"></div>
                
                <!-- Center Icon/Text -->
                <div class="absolute inset-0 flex items-center justify-center flex-col">
                    <span class="text-4xl font-black text-white font-mono" x-text="progress + '%'"></span>
                </div>
            </div>

            <!-- Status Text -->
            <div class="space-y-2">
                <div class="text-xl font-bold text-white animate-pulse" x-text="processStep">Processing...</div>
                <div class="text-xs font-mono text-purple-400 h-4" x-text="processDetail">Initializing...</div>
            </div>

            <!-- Terminal Log -->
            <div class="mt-8 mx-auto w-full max-w-sm bg-black/50 rounded-lg border border-white/10 p-4 font-mono text-[10px] text-green-500 text-left h-32 overflow-hidden relative">
                <div class="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black to-transparent pointer-events-none"></div>
                <div x-ref="logs" class="space-y-1">
                    <template x-for="log in logs">
                        <div class="opacity-80">> <span x-text="log"></span></div>
                    </template>
                </div>
            </div>
        </div>

        <!-- STAGE 3: RESULT (Success) -->
        <div x-show="state === 'complete'" 
             x-transition:enter="transition ease-out duration-700"
             x-transition:enter-start="opacity-0 translate-y-10"
             x-transition:enter-end="opacity-100 translate-y-0"
             class="relative z-10 w-full h-full flex items-center justify-center p-8">
            
            <div class="flex gap-12 items-center max-w-6xl w-full">
                <!-- Left: 3D Visualization (Mock) -->
                <div class="flex-1 aspect-video bg-gray-900 rounded-3xl border border-white/10 relative overflow-hidden group shadow-2xl shadow-purple-900/20">
                    <!-- Fake 3D Viewer Image -->
                    <img src="https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1000&auto=format&fit=crop" class="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen" alt="Point Cloud">
                    <div class="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                    
                    <!-- Overlay Grid -->
                    <div class="absolute inset-0" 
                         style="background-image: linear-gradient(0deg, transparent 24%, rgba(168, 85, 247, .3) 25%, rgba(168, 85, 247, .3) 26%, transparent 27%, transparent 74%, rgba(168, 85, 247, .3) 75%, rgba(168, 85, 247, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(168, 85, 247, .3) 25%, rgba(168, 85, 247, .3) 26%, transparent 27%, transparent 74%, rgba(168, 85, 247, .3) 75%, rgba(168, 85, 247, .3) 76%, transparent 77%, transparent); background-size: 50px 50px;">
                    </div>

                    <!-- Points (Animated) -->
                    <div class="absolute top-1/4 left-1/4 w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                    <div class="absolute bottom-1/3 right-1/3 w-2 h-2 bg-green-500 rounded-full animate-ping" style="animation-delay: 0.5s"></div>

                    <div class="absolute bottom-6 left-6">
                        <div class="text-[10px] text-gray-400 font-mono mb-1">VISUALIZATION</div>
                        <div class="text-white font-bold flex items-center gap-2"><i data-lucide="layers" class="w-4 h-4 text-purple-500"></i> ボクセル密度: 高</div>
                    </div>
                </div>

                <!-- Right: Stats -->
                <div class="w-96 space-y-6">
                    <div class="bg-green-500/10 border border-green-500/30 p-6 rounded-2xl relative overflow-hidden">
                        <div class="absolute top-0 right-0 p-4 opacity-20"><i data-lucide="leaf" class="w-16 h-16 text-green-500"></i></div>
                        <div class="relative z-10">
                            <div class="text-xs text-green-400 font-bold uppercase tracking-widest mb-2">CO2吸収量 (推定)</div>
                            <div class="text-5xl font-black text-white font-heading mb-1">48.2<span class="text-lg text-gray-400 font-medium ml-2">t-CO2</span></div>
                            <div class="text-xs text-green-300 flex items-center gap-1"><i data-lucide="trending-up" class="w-3 h-3"></i> 標準法より +12% 精緻化</div>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-gray-800 p-4 rounded-xl border border-white/10">
                            <div class="text-[10px] text-gray-400 mb-1">バイオマス体積</div>
                            <div class="text-xl font-bold text-white">12,405 <span class="text-xs text-gray-500">m³</span></div>
                        </div>
                        <div class="bg-gray-800 p-4 rounded-xl border border-white/10">
                            <div class="text-[10px] text-gray-400 mb-1">推定樹木本数</div>
                            <div class="text-xl font-bold text-white">842 <span class="text-xs text-gray-500">本</span></div>
                        </div>
                    </div>

                    <div class="p-4 rounded-xl border border-white/10 bg-white/5 space-y-3">
                        <div class="flex justify-between text-xs">
                            <span class="text-gray-400">植生分類 信頼度</span>
                            <span class="text-white font-bold">98.4%</span>
                        </div>
                        <div class="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div class="h-full w-[98.4%] bg-purple-500 shadow-[0_0_10px_#a855f7]"></div>
                        </div>
                        <div class="text-[10px] text-gray-500 mt-2">
                            検出: 杉 (Sugi), 檜 (Hinoki), 楠 (Kusu)...
                        </div>
                    </div>

                    <div class="flex gap-3 mt-6">
                        <a href="?view=reports" class="flex-1 py-3 bg-white text-black font-bold rounded-xl text-center hover:bg-gray-200 transition">レポート出力</a>
                        <button @click="reset" class="px-4 py-3 border border-white/20 text-white rounded-xl hover:bg-white/10 transition"><i data-lucide="rotate-ccw" class="w-5 h-5"></i></button>
                    </div>
                </div>
            </div>
        </div>

    </div>

</div>

<script>
document.addEventListener('alpine:init', () => {
    Alpine.data('simulation3d', () => ({
        state: 'idle', // idle, processing, complete
        progress: 0,
        processStep: '',
        processDetail: '',
        dragOver: false,
        logs: [],
        
        startSimulation() {
            this.state = 'processing';
            this.progress = 0;
            this.logs = ['解析エンジンを起動中...'];
            
            // Sequence of fake processing
            const sequence = [
                { t: 0, p: 5, step: '点群データ読込中', detail: 'LASヘッダー情報を解析中...' },
                { t: 800, p: 15, step: '前処理実行中', detail: 'ノイズ・ゴースト点の除去フィルタ...', log: 'ノイズ除去フィルター適用: RADIUS_OUTLIER' },
                { t: 2000, p: 35, step: 'ボクセル変換中', detail: '10cmグリッドへボクセル化...', log: 'ボクセルグリッド生成: 10,402,110 cell' },
                { t: 3500, p: 60, step: '植生分類中', detail: '地表面と植生を分離中...', log: '地表面抽出: CSFアルゴリズム完了' },
                { t: 5000, p: 85, step: '体積・係数算出中', detail: '樹種ごとのバイオマス推定...', log: 'バイオマス指数 計算完了' },
                { t: 6500, p: 100, step: 'レポート生成中', detail: '出力アセットを作成中...', log: '全プロセス完了' }
            ];

            sequence.forEach(s => {
                setTimeout(() => {
                    this.progress = s.p;
                    this.processStep = s.step;
                    this.processDetail = s.detail;
                    if(s.log) this.logs.push(s.log);
                }, s.t);
            });

            setTimeout(() => {
                this.state = 'complete';
            }, 7500);
        },

        handleDrop(e) {
            this.startSimulation();
        },

        reset() {
            this.state = 'idle';
            this.progress = 0;
            this.logs = [];
        }
    }))
})
</script>
