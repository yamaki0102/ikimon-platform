<div class="p-8 overflow-y-auto w-full">
    <div class="flex items-center justify-between mb-8">
        <h2 class="text-2xl font-bold">登録済みエリア一覧</h2>
        <button onclick="openAreaModal()" class="bg-green-500 hover:bg-green-600 text-black font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition">
            <i data-lucide="plus" class="w-5 h-5"></i>
            新規エリアを作成
        </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="area-list">
        <!-- Dummy Area Card -->
        <div class="bg-[var(--color-bg-surface)] border border-gray-200 rounded-xl p-6 hover:bg-gray-100 transition group">
            <div class="flex items-start justify-between mb-4">
                <div>
                    <div class="text-xs font-bold text-green-700 uppercase tracking-wider mb-1">Park</div>
                    <h3 class="text-xl font-bold">佐鳴湖公園 北岸エリア</h3>
                </div>
                <div class="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded">PUBLIC</div>
            </div>
            <div class="aspect-video bg-gray-100 rounded-lg mb-4 relative overflow-hidden">
                <div class="absolute inset-0 flex items-center justify-center">
                    <i data-lucide="map" class="w-8 h-8 text-gray-500"></i>
                </div>
            </div>
            <div class="flex items-center justify-between text-sm text-gray-500">
                <span><i data-lucide="maximize" class="w-4 h-4 inline mr-1"></i> 0.45 km²</span>
                <div class="flex gap-2">
                    <button class="hover:text-gray-900"><i data-lucide="edit-2" class="w-4 h-4"></i></button>
                    <button class="hover:text-red-400"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Modal Logic Simplified for PHP View context -->
<div id="area-modal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 hidden flex items-center justify-center">
    <!-- Simplified for demo -->
    <div class="bg-white border border-gray-200 rounded-2xl w-full max-w-lg p-8 shadow-xl">
        <h3 class="text-xl font-bold text-gray-900 mb-4">Demo: Area Editor</h3>
        <p class="text-gray-500 mb-6">Area editor not fully ported in this view partial.</p>
        <button onclick="document.getElementById('area-modal').classList.add('hidden')" class="px-4 py-2 bg-white text-black rounded">Close</button>
    </div>
</div>

<script nonce="<?= CspNonce::attr() ?>">
    function openAreaModal() {
        document.getElementById('area-modal').classList.remove('hidden');
    }
</script>