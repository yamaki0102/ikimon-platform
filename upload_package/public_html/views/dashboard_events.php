<div class="flex-1 overflow-y-auto p-8">
    <div class="flex items-center justify-between mb-8">
        <h1 class="text-3xl font-bold">イベント・ミッション管理</h1>
        <div class="flex gap-4">
            <button onclick="openEventModal()"
                class="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition border border-white/10">
                <i data-lucide="calendar-plus" class="w-5 h-5"></i>
                新規イベント作成
            </button>
            <button onclick="openMissionModal()"
                class="bg-green-500 hover:bg-green-600 text-black font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition shadow-lg shadow-green-500/20">
                <i data-lucide="target" class="w-5 h-5"></i>
                新規ミッション作成
            </button>
        </div>
    </div>

    <!-- Missions Section -->
    <section class="mb-12">
        <div class="flex items-center gap-2 mb-4">
            <i data-lucide="target" class="w-5 h-5 text-green-400"></i>
            <h2 class="text-xl font-bold">進行中の観察ミッション</h2>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <!-- Mission Card -->
            <div class="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition group">
                <div class="flex items-start justify-between mb-4">
                    <div>
                        <div class="text-xs font-bold text-yellow-500 uppercase tracking-wider mb-1">Mission</div>
                        <h3 class="text-lg font-bold">外来種「アカミミガメ」調査</h3>
                    </div>
                    <span class="px-2 py-1 bg-green-500/20 text-green-400 text-[10px] font-bold rounded">進行中</span>
                </div>
                <div class="text-sm text-gray-400 mb-4">
                    <div class="flex items-center gap-2 mb-1">
                        <i data-lucide="map-pin" class="w-4 h-4 text-gray-500"></i>
                        佐鳴湖公園 北岸エリア
                    </div>
                    <div class="flex items-center gap-2">
                        <i data-lucide="clock" class="w-4 h-4 text-gray-500"></i>
                        2023/10/01 - 2023/10/31
                    </div>
                </div>
                <div class="w-full bg-gray-800 h-2 rounded-full overflow-hidden mb-2">
                    <div class="bg-yellow-500 h-full" style="width: 65%"></div>
                </div>
                <div class="flex justify-between text-xs text-gray-500">
                    <span>達成率: 65%</span>
                    <span>参加者: 128人</span>
                </div>
            </div>
        </div>
    </section>

    <!-- Events Section -->
    <section>
        <div class="flex items-center gap-2 mb-4">
            <i data-lucide="calendar" class="w-5 h-5 text-blue-400"></i>
            <h2 class="text-xl font-bold">開催予定のイベント</h2>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <!-- Event Card -->
            <div class="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition group">
                <div class="flex items-start justify-between mb-4">
                    <div>
                        <div class="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Event</div>
                        <h3 class="text-lg font-bold">秋の親子自然観察会</h3>
                    </div>
                    <span class="px-2 py-1 bg-blue-500/20 text-blue-400 text-[10px] font-bold rounded">募集中</span>
                </div>
                <div class="text-sm text-gray-400 mb-4">
                    <div class="flex items-center gap-2 mb-1">
                        <i data-lucide="map-pin" class="w-4 h-4 text-gray-500"></i>
                        佐鳴湖公園 北岸エリア
                    </div>
                    <div class="flex items-center gap-2">
                        <i data-lucide="calendar" class="w-4 h-4 text-gray-500"></i>
                        2023/10/15 10:00 - 12:00
                    </div>
                </div>
                <button class="w-full py-2 border border-white/10 rounded hover:bg-white/5 text-sm transition">
                    詳細・参加者管理
                </button>
            </div>
        </div>
    </section>
</div>

<!-- Create Mission Modal -->
<div id="mission-modal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 hidden flex items-center justify-center">
    <!-- Modal content omitted for brevity, logic handled in dashboard.js or inline if simple -->
    <div class="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-lg p-8">
        <h3 class="text-xl font-bold text-white mb-4">Demo: Create Mission</h3>
        <p class="text-gray-400 mb-6">This is a demonstration modal.</p>
        <button onclick="document.getElementById('mission-modal').classList.add('hidden')" class="px-4 py-2 bg-white text-black rounded">Close</button>
    </div>
</div>

<div id="event-modal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 hidden flex items-center justify-center">
    <div class="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-lg p-8">
        <h3 class="text-xl font-bold text-white mb-4">Demo: Create Event</h3>
        <p class="text-gray-400 mb-6">This is a demonstration modal.</p>
        <button onclick="document.getElementById('event-modal').classList.add('hidden')" class="px-4 py-2 bg-white text-black rounded">Close</button>
    </div>
</div>

<script>
function openMissionModal() { document.getElementById('mission-modal').classList.remove('hidden'); }
function openEventModal() { document.getElementById('event-modal').classList.remove('hidden'); }
// Other scripts handled by dashboard.js
</script>
